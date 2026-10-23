export function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
}

/**
 * Minimal JSON fetch helper. No auth headers exist in this app — book access
 * is authorized per request with the book's invite code (see the sodam HTTP
 * API layer, which sets `x-book-code` from the local book registry).
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : (undefined as T);
  if (!response.ok) {
    // ARC-09: server errors arrive as { error: { code, message, fields? } }.
    // Keep the legacy top-level `message` fallback for safety.
    const errObj =
      data && typeof data === 'object'
        ? ((data as { error?: { message?: unknown } }).error ?? (data as { message?: unknown }))
        : null;
    const raw = errObj?.message;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : raw != null
        ? String(raw)
        : response.statusText;
    throw new Error(message);
  }
  return data;
}
