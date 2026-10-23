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
    const message =
      data && typeof data === 'object' && 'message' in data
        ? Array.isArray((data as { message: unknown }).message)
          ? (data as { message: string[] }).message.join(', ')
          : String((data as { message: unknown }).message)
        : response.statusText;
    throw new Error(message);
  }
  return data;
}
