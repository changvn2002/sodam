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

/* ------------------------------------------------------------------ */
/* W3 (PWA-FIX 6.3, PWA-31): sổ mở gần nhất — để reload khi đang xem  */
/* trong sổ tự vào lại đúng sổ đó thay vì văng về landing. Chỉ là id  */
/* của sổ (không chứa mã mời — mã vẫn chỉ sống trong registry ở trên, */
/* và việc khôi phục phải đối chiếu id này còn trong registry/server  */
/* mới được vào, xem app.tsx). Xoá khi người dùng chủ động về landing */
/* để reload ở landing không tự nhảy lại vào sổ.                      */
/* ------------------------------------------------------------------ */
const LAST_BOOK_KEY = 'sodam_last_book_v1';

export function rememberLastBook(id: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_BOOK_KEY, id);
  } catch {
    // Storage bị chặn — mất khôi phục sau reload, luồng chính vẫn chạy.
  }
}

export function lastBookId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_BOOK_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function clearLastBook() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LAST_BOOK_KEY);
  } catch {
    // Bị chặn — không còn gì làm được, bỏ qua.
  }
}
