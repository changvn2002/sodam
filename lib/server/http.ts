import { NextResponse } from 'next/server';
import { badRequest, HttpError } from './errors';

/** Run a handler and map results/errors to the JSON shape the client expects (`{ message }` on error, like the original NestJS API). */
export async function handle(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return NextResponse.json(data ?? null);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    // Unexpected errors (Prisma/DB/runtime) are logged server-side ONLY.
    // The client gets a generic Vietnamese message — never the raw error,
    // which leaks ORM internals (model names, INT4 conversion details).
    // (W4-F1 retest, 2026-10-23: the overflow 500 shipped the full Prisma
    // invocation text to anyone who sent amountVnd = 2147483648.)
    console.error(err);
    return NextResponse.json(
      { message: 'Đã xảy ra lỗi ở phía máy chủ. Vui lòng thử lại sau.' },
      { status: 500 },
    );
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = (await req.json()) as unknown;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
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
    throw badRequest(`${field} must be a string of at least ${minLength} character(s)`);
  }
  assertMaxLength(field, v, maxLength);
  return v;
}

export function optString(body: Record<string, unknown>, field: string, maxLength?: number) {
  const v = body[field];
  if (v == null) return undefined;
  if (typeof v !== 'string') throw badRequest(`${field} must be a string`);
  assertMaxLength(field, v, maxLength);
  return v;
}

function assertMaxLength(field: string, v: string, maxLength?: number) {
  if (maxLength != null && v.length > maxLength) {
    throw badRequest(`Trường ${field} quá dài — tối đa ${maxLength} ký tự.`);
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
    throw badRequest(`${field} must be a non-negative integer`);
  }
  if (v > max) {
    throw badRequest(INT4_MAX_MESSAGE);
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
    throw badRequest(`${field} must be one of: ${values.join(', ')}`);
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
