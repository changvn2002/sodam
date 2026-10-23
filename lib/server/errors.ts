/**
 * HTTP error carrying a status code. The route handlers turn it into the
 * unified ARC-09 error shape `{ error: { code, message, fields? } }`
 * (see lib/server/http.ts `handle()`).
 *
 * `code` is a stable machine-readable token (defaults are derived from the
 * status in http.ts when not given); `fields` optionally names the input
 * fields the error is about (validation errors).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly fields?: string[],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(message: string) {
  return new HttpError(404, message);
}

export function badRequest(message: string, fields?: string[]) {
  return new HttpError(400, message, undefined, fields);
}

export function payloadTooLarge(message: string) {
  return new HttpError(413, message);
}
