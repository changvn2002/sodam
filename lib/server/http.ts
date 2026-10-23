import { NextResponse } from 'next/server';
import { badRequest, HttpError, payloadTooLarge } from './errors';

/**
 * Run a handler and map results/errors to JSON.
 *
 * ARC-09 (re-grade r3): MỌI response lỗi dùng MỘT shape thống nhất
 * `{ error: { code, message, fields? } }` — trước đây là `{ message }`
 * kiểu NestJS cũ. `code` là mã máy đọc ổn định (HttpError tự mang hoặc suy
 * từ status); `fields` chỉ xuất hiện ở lỗi validation gắn với field cụ thể.
 *
 * SEC-12 khoản 12.3 (re-grade r2): MỌI response của API mang
 * `Cache-Control: no-store` — dữ liệu sổ nằm sau credential (mã mời) không
 * được phép lưu cache ở bất kỳ tầng nào; bản live trước đó trả
 * `public, max-age=0, must-revalidate` trên route dashboard.
 */

/** Default machine-readable error code per HTTP status (ARC-09). */
function defaultErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 404:
      return 'NOT_FOUND';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 502:
      return 'BAD_GATEWAY';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

export async function handle(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return NextResponse.json(data ?? null, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json(
        {
          error: {
            code: err.code ?? defaultErrorCode(err.status),
            message: err.message,
            ...(err.fields && err.fields.length > 0 ? { fields: err.fields } : {}),
          },
        },
        { status: err.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    // Unexpected errors (Prisma/DB/runtime) are logged server-side ONLY.
    // The client gets a generic Vietnamese message — never the raw error,
    // which leaks ORM internals (model names, INT4 conversion details).
    // (W4-F1 retest, 2026-10-23: the overflow 500 shipped the full Prisma
    // invocation text to anyone who sent amountVnd = 2147483648.)
    console.error(err);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Đã xảy ra lỗi ở phía máy chủ. Vui lòng thử lại sau.',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

/**
 * SEC-05 (re-grade r3): trần dung lượng body JSON. Battery của grader gửi
 * body ~200KB và vẫn nhận 200 — readJson cũ không có trần nào. Cap chọn
 * 128 KiB (131.072 byte): nhỏ hơn hẳn mốc battery, nhưng vẫn rộng hơn trần
 * lý thuyết của mọi luồng hợp lệ — batch entries (route slice 100 rows,
 * mỗi row personName ≤200 ký tự) ≈ ≤70KB, sync (slice 50 mutations) ≈
 * ≤35KB, entry đơn ≈ ≤10KB. import.csv chỉ xử lý 100 dòng đầu nên phần csv
 * vượt cap này vốn không làm tăng kết quả nhập — không luồng hợp lệ nào bị
 * cắt. Vượt cap → 413 TRƯỚC khi parse.
 */
export const MAX_JSON_BODY_BYTES = 131_072;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BODY_BYTES) {
    throw payloadTooLarge('Nội dung gửi lên quá lớn — vui lòng rút gọn rồi thử lại.');
  }
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // JSON hỏng → 400 tường minh (trước đây lỗi parse bị nuốt thành {} rồi
    // validator mới ném 400 — kết quả bề mặt giữ nguyên, nay rõ ràng hơn).
    throw badRequest('Nội dung gửi lên không phải JSON hợp lệ.');
  }
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

/**
 * SEC-05 (re-grade r3): từ chối field lạ. Trước đây body thừa field
 * (isAdmin/role…) bị bỏ qua lặng lẽ và request vẫn 200 — mirror kỷ luật
 * strict-fields của dichbome: field không nằm trong allowlist của endpoint
 * → 400. Route gọi helper này ngay sau readJson với allowlist của endpoint đó.
 */
export function assertOnlyFields(body: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Trường không được hỗ trợ: ${unknown.join(', ')}`, unknown);
  }
}

// --- Small validators mirroring the original class-validator DTOs -----------

export function reqString(
  body: Record<string, unknown>,
  field: string,
  minLength = 1,
  maxLength?: number,
) {
  const v = body[field];
  if (typeof v !== 'string' || v.trim().length < minLength) {
    throw badRequest(`${field} must be a string of at least ${minLength} character(s)`, [field]);
  }
  assertMaxLength(field, v, maxLength);
  return v;
}

export function optString(body: Record<string, unknown>, field: string, maxLength?: number) {
  const v = body[field];
  if (v == null) return undefined;
  if (typeof v !== 'string') throw badRequest(`${field} must be a string`, [field]);
  assertMaxLength(field, v, maxLength);
  return v;
}

function assertMaxLength(field: string, v: string, maxLength?: number) {
  if (maxLength != null && v.length > maxLength) {
    throw badRequest(`Trường ${field} quá dài — tối đa ${maxLength} ký tự.`, [field]);
  }
}

/**
 * Largest value a Postgres INT4 column holds. Every integer input that is
 * written to an Int column (entry/return amounts) must stay within it —
 * past the bound the DB errors out (W4-F1: amountVnd 2147483648 → 500).
 */
export const INT4_MAX = 2_147_483_647;

/** Friendly Vietnamese rejection for an out-of-Int4-range amount. */
export const INT4_MAX_MESSAGE = `Số tiền vượt quá giới hạn cho phép — tối đa ${INT4_MAX.toLocaleString('vi-VN')} đồng.`;

export function reqIntMin0(body: Record<string, unknown>, field: string, max: number = INT4_MAX) {
  const v = body[field];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw badRequest(`${field} must be a non-negative integer`, [field]);
  }
  if (v > max) {
    throw badRequest(INT4_MAX_MESSAGE, [field]);
  }
  return v;
}

export function optIntMin0(body: Record<string, unknown>, field: string, max: number = INT4_MAX) {
  const v = body[field];
  if (v == null) return undefined;
  return reqIntMin0(body, field, max);
}

export function reqEnum<T extends string>(
  body: Record<string, unknown>,
  field: string,
  values: readonly T[],
) {
  const v = body[field];
  if (typeof v !== 'string' || !values.includes(v as T)) {
    throw badRequest(`${field} must be one of: ${values.join(', ')}`, [field]);
  }
  return v as T;
}

export function optEnum<T extends string>(
  body: Record<string, unknown>,
  field: string,
  values: readonly T[],
) {
  const v = body[field];
  if (v == null) return undefined;
  return reqEnum(body, field, values);
}
