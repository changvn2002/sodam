import { badRequest, HttpError, payloadTooLarge } from './errors';
import { parseVietnameseGiftLine } from './parse-gift';
import * as sodam from './sodam.service';

/**
 * Port of the host's `SodamAiService`. The host routed AI calls through its
 * PlatformAiService (admin-configured models); the standalone talks directly
 * to any OpenAI-compatible endpoint configured by env:
 *
 *   OPENAI_API_KEY        — enables AI features
 *   AI_TRANSLATE_BASE_URL — default https://api.openai.com/v1
 *   AI_TRANSLATE_MODEL    — default gpt-4o-mini (chat + vision fallback)
 *   OPENAI_BASE_URL / OPENAI_CHAT_MODEL / OPENAI_VISION_MODEL — overrides
 *
 * Fallback behavior is faithful to the original: when the AI call fails (or
 * no key is configured), parse/suggest fall back to the local Vietnamese
 * parser / history average. Photo extraction has no local fallback — without
 * a vision model it fails honestly with 503 instead of inventing results.
 */

type AiModel = { baseUrl: string; apiKey: string; modelName: string };

export function aiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function resolveModel(kind: 'chat' | 'vision'): AiModel | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (
    process.env.OPENAI_BASE_URL ??
    process.env.AI_TRANSLATE_BASE_URL ??
    'https://api.openai.com/v1'
  ).replace(/\/$/, '');
  const modelName =
    (kind === 'chat'
      ? (process.env.OPENAI_CHAT_MODEL ?? process.env.AI_TRANSLATE_MODEL)
      : (process.env.OPENAI_VISION_MODEL ?? process.env.AI_TRANSLATE_MODEL)) ?? 'gpt-4o-mini';
  return { baseUrl, apiKey, modelName };
}

/**
 * ARC-14 (re-grade r3): mọi lời gọi AI đều có timeout tường minh. Trước
 * đây 2 fetch tới AI endpoint không mang signal nào — nhà cung cấp treo là
 * request treo theo mặc định của nền tảng. 15s đủ rộng cho completion ngắn
 * (temperature 0.1, JSON ngắn, kể cả vision) mà vẫn cắt sớm để rơi về
 * đường lỗi hiện hữu: parse/suggest nuốt lỗi vào fallback local, photo đi
 * qua handle() thành 500 generic — lỗi timeout là Error thường, không
 * chứa chi tiết nội bộ nào để lộ ra ngoài.
 */
export const AI_FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`AI request timed out after ${AI_FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function chatJson(system: string, user: string): Promise<Record<string, unknown>> {
  const model = resolveModel('chat');
  if (!model) throw new Error('AI is not configured (OPENAI_API_KEY missing)');
  const response = await fetchWithTimeout(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model.modelName,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI chat failed: ${detail.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;
}

export async function parseUtterance(bookId: string, code: string, text: string) {
  await sodam.requireBookAccess(bookId, code);
  const local = parseVietnameseGiftLine(text);
  try {
    const json = await chatJson(
      'You extract Vietnamese wedding/funeral gift ledger lines. Return JSON keys: intent (record|correct|ask|unknown), name (string|null), amountVnd (number|null), speakBack (Vietnamese confirmation sentence). Amounts in VND integers.',
      text,
    );
    const name = (json.name as string | null) ?? local.name;
    const amountVnd = typeof json.amountVnd === 'number' ? json.amountVnd : local.amountVnd;
    const intent = (json.intent as string) || (name && amountVnd != null ? 'record' : 'ask');
    const speakBack =
      (json.speakBack as string) ||
      (name && amountVnd != null
        ? `Đã ghi ${name}, ${amountVnd.toLocaleString('vi-VN')} đồng. Đúng không?`
        : 'Chưa nghe rõ tên hoặc số tiền. Xin đọc lại.');
    return { intent, name, amountVnd, rawText: text, speakBack };
  } catch {
    const name = local.name;
    const amountVnd = local.amountVnd;
    if (name && amountVnd != null) {
      return {
        intent: 'record' as const,
        name,
        amountVnd,
        rawText: text,
        speakBack: `Đã ghi ${name}, ${amountVnd.toLocaleString('vi-VN')} đồng. Đúng không?`,
      };
    }
    return {
      intent: 'ask' as const,
      name,
      amountVnd,
      rawText: text,
      speakBack: 'Chưa nghe rõ tên hoặc số tiền. Xin đọc lại.',
    };
  }
}

export async function suggestAmount(bookId: string, code: string, personId: string) {
  await sodam.requireBookAccess(bookId, code);
  const people = await sodam.listPeople(bookId, code);
  const person = people.find((p) => p.id === personId);
  const rows = person
    ? ((await sodam.searchPeople(bookId, code, person.displayName)).find((p) => p.id === personId)
        ?.history ?? [])
    : [];
  const avg =
    rows.length > 0
      ? Math.round(rows.reduce((s, e) => s + e.amountVnd, 0) / rows.length / 50_000) * 50_000
      : 500_000;

  try {
    const json = await chatJson(
      'Suggest a reciprocal gift amount in VND for Vietnamese ceremony. Return JSON: amountVnd (number), reason (Vietnamese short).',
      JSON.stringify({
        personName: person?.displayName,
        history: rows.slice(0, 10).map((e) => e.amountVnd),
        fallback: avg || 500_000,
      }),
    );
    return {
      amountVnd: typeof json.amountVnd === 'number' ? json.amountVnd : avg || 500_000,
      reason: (json.reason as string) || 'Gợi ý theo lịch sử.',
    };
  } catch {
    return {
      amountVnd: avg || 500_000,
      reason: 'Gợi ý theo trung bình các lần trước.',
    };
  }
}

/**
 * SEC-15 (re-grade r3): kiểm tra file ảnh TRƯỚC khi bất kỳ byte dữ liệu
 * ảnh nào bị đọc trọn vào bộ nhớ cho bước xử lý AI. Route cũ tin thẳng
 * `file.type` do client khai và `arrayBuffer()` nạp toàn bộ file trước
 * mọi kiểm tra. Thứ tự kiểm tra ở đây là bắt buộc:
 *   1. `file.size` (metadata, chưa đọc nội dung) — trần 10 MiB → 413.
 *      10 MiB rộng hơn nhu cầu thật (ảnh chụp trang sổ trên điện thoại
 *      thường 2–6 MiB) nhưng chặn được file khổng lồ dội vào bộ nhớ.
 *   2. Định dạng khai báo phải thuộc allowlist jpeg/png/webp — đúng 3
 *      định dạng ảnh chụp phổ biến mà đường vision nhận; khác → 400.
 *   3. MAGIC BYTES đọc từ `file.slice(0, 16)` (tối đa 16 byte): JPEG
 *      `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF....WEBP`. Magic phải
 *      KHỚP định dạng đã khai — lệch → 400.
 * Mime trả về là mime suy từ magic bytes (sự thật của file), không phải
 * lời khai của client; route dùng mime này cho bước AI.
 */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

function sniffPhotoMimeType(head: Uint8Array): PhotoMimeType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    head.length >= 4 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 && // R
    head[1] === 0x49 && // I
    head[2] === 0x46 && // F
    head[3] === 0x46 && // F
    head[8] === 0x57 && // W
    head[9] === 0x45 && // E
    head[10] === 0x42 && // B
    head[11] === 0x50 // P
  ) {
    return 'image/webp';
  }
  return null;
}

export async function inspectPhotoFile(file: File): Promise<{ mimeType: PhotoMimeType }> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw payloadTooLarge('Ảnh quá lớn — tối đa 10 MB. Vui lòng chọn ảnh nhỏ hơn.');
  }
  if (!(PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw badRequest('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffPhotoMimeType(head);
  if (!sniffed || sniffed !== file.type) {
    throw badRequest('Nội dung file không khớp định dạng ảnh đã khai.');
  }
  return { mimeType: sniffed };
}

export async function photoCandidates(
  bookId: string,
  code: string,
  imageBase64: string,
  mimeType: string,
) {
  await sodam.requireBookAccess(bookId, code);
  const model = resolveModel('vision');
  if (!model) {
    // SEC-11 (re-grade r2, chi tiết 5): message lỗi công khai TUYỆT ĐỐI
    // không chứa tên biến môi trường hay chi tiết cấu hình — chỉ nói tính
    // năng chưa bật, bằng tiếng Việt, như mọi lỗi người dùng khác.
    throw new HttpError(
      503,
      'Tính năng đọc ảnh chưa được bật trên máy chủ này. Bạn vẫn ghi khoản bằng tay hoặc bằng giọng nói được.',
    );
  }
  const response = await fetchWithTimeout(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model.modelName,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract gift ledger rows from an image of a Vietnamese ceremony notebook. Return JSON { candidates: [{ name, amountVnd }] }. amountVnd integer VND.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all name/amount rows.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(502, `Vision failed: ${detail.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as {
    candidates?: Array<{ name: string; amountVnd: number }>;
  };
  return {
    candidates: (parsed.candidates ?? [])
      .filter((c) => c.name && Number.isFinite(c.amountVnd))
      .slice(0, 100),
  };
}
