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
    console.error(err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Internal server error' },
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

export function reqString(body: Record<string, unknown>, field: string, minLength = 1) {
  const v = body[field];
  if (typeof v !== 'string' || v.trim().length < minLength) {
    throw badRequest(`${field} must be a string of at least ${minLength} character(s)`);
  }
  return v;
}

export function optString(body: Record<string, unknown>, field: string) {
  const v = body[field];
  if (v == null) return undefined;
  if (typeof v !== 'string') throw badRequest(`${field} must be a string`);
  return v;
}

export function reqIntMin0(body: Record<string, unknown>, field: string) {
  const v = body[field];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw badRequest(`${field} must be a non-negative integer`);
  }
  return v;
}

export function optIntMin0(body: Record<string, unknown>, field: string) {
  const v = body[field];
  if (v == null) return undefined;
  return reqIntMin0(body, field);
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
