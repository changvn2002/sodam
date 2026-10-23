import { HttpError } from './errors';
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

async function chatJson(system: string, user: string): Promise<Record<string, unknown>> {
  const model = resolveModel('chat');
  if (!model) throw new Error('AI is not configured (OPENAI_API_KEY missing)');
  const response = await fetch(`${model.baseUrl}/chat/completions`, {
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
  const response = await fetch(`${model.baseUrl}/chat/completions`, {
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
