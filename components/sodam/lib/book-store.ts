'use client';

/**
 * This device's book registry — the no-login replacement for an account's
 * book list. When a book is created or joined on this device, its id +
 * invite code are kept here; the HTTP layer reads the code back to authorize
 * book-scoped requests (`x-book-code` header), and the home screen resolves
 * "my books" by sending these codes to POST /books/mine.
 *
 * Losing this storage (new phone, cleared browser data) does not lose the
 * book: anyone can re-join with the invite code or the share link.
 */
const KEY = 'sodam_books_v1';

export type KnownBook = { id: string; inviteCode: string; name?: string };

function readAll(): KnownBook[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is KnownBook =>
        Boolean(b) &&
        typeof b === 'object' &&
        typeof (b as KnownBook).id === 'string' &&
        typeof (b as KnownBook).inviteCode === 'string' &&
        ((b as KnownBook).name === undefined || typeof (b as KnownBook).name === 'string'),
    );
  } catch {
    return [];
  }
}

function writeAll(books: KnownBook[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(books));
  } catch {
    // Storage full/blocked — the in-session flow still works; the book can
    // be re-joined by code later. Nothing else sensible to do here.
  }
}

export function rememberBook(id: string, inviteCode: string, name?: string) {
  const existing = readAll().find((b) => b.id === id);
  const books = readAll().filter((b) => b.id !== id);
  books.unshift({ id, inviteCode, name: name ?? existing?.name });
  writeAll(books.slice(0, 50));
}

/** Sổ đã biết trên máy này (id + mã + tên nếu có) — dùng cho bề mặt công khai khi offline. */
export function knownBooks(): KnownBook[] {
  return readAll();
}

export function forgetBook(id: string) {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function knownBookCodes(): string[] {
  return readAll().map((b) => b.inviteCode);
}

export function codeForBook(id: string): string | null {
  return readAll().find((b) => b.id === id)?.inviteCode ?? null;
}
