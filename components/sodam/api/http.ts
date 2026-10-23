import { api } from '@/lib/api';
import { codeForBook, rememberBook } from '../lib/book-store';
import type {
  SodamApi,
  SodamBook,
  SodamEventKind,
  SodamEventRole,
  SodamReturnStatus,
} from './types';

const base = '/api/products/sodam';

/**
 * HTTP API for the no-login build. There is no session token: every
 * book-scoped call presents the book's invite code in the `x-book-code`
 * header, read from this device's local registry (lib/book-store). Creating
 * or joining a book registers its code there.
 */
function bookInit(bookId: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  const code = codeForBook(bookId);
  if (code) headers.set('x-book-code', code);
  return { ...init, headers };
}

export function createHttpSodamApi(): SodamApi {
  return {
    status: () => api(`${base}`),
    listBooks: (codes) =>
      api(`${base}/books/mine`, { method: 'POST', body: JSON.stringify({ codes }) }),
    createBook: async (name) => {
      const book = await api<SodamBook>(`${base}/books`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      rememberBook(book.id, book.inviteCode);
      return book;
    },
    joinBook: async (inviteCode) => {
      const book = await api<SodamBook>(`${base}/books/join`, {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });
      rememberBook(book.id, book.inviteCode);
      return book;
    },
    rotateInviteCode: async (bookId) => {
      const book = await api<SodamBook>(
        `${base}/books/${bookId}/rotate-code`,
        bookInit(bookId, { method: 'POST', body: '{}' }),
      );
      // Sổ đăng ký trên thiết bị này phải trỏ sang mã mới ngay — mã cũ đã
      // chết ở máy chủ, giữ lại là mọi lần gọi sau đều 404.
      rememberBook(book.id, book.inviteCode);
      return book;
    },
    dashboard: (bookId) => api(`${base}/books/${bookId}/dashboard`, bookInit(bookId)),
    listEvents: (bookId) => api(`${base}/books/${bookId}/events`, bookInit(bookId)),
    createEvent: (bookId, input) =>
      api(
        `${base}/books/${bookId}/events`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify(input) }),
      ),
    getEvent: (bookId, eventId) =>
      api(`${base}/books/${bookId}/events/${eventId}`, bookInit(bookId)),
    closeEvent: (bookId, eventId) =>
      api(
        `${base}/books/${bookId}/events/${eventId}/close`,
        bookInit(bookId, { method: 'POST', body: '{}' }),
      ),
    createEntry: (bookId, eventId, input) =>
      api(
        `${base}/books/${bookId}/events/${eventId}/entries`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify(input) }),
      ),
    updateEntry: (bookId, eventId, entryId, input) =>
      api(
        `${base}/books/${bookId}/events/${eventId}/entries/${entryId}`,
        bookInit(bookId, { method: 'PATCH', body: JSON.stringify(input) }),
      ),
    deleteEntry: async (bookId, eventId, entryId) => {
      await api(
        `${base}/books/${bookId}/events/${eventId}/entries/${entryId}`,
        bookInit(bookId, { method: 'DELETE' }),
      );
    },
    batchEntries: (bookId, eventId, rows) =>
      api(
        `${base}/books/${bookId}/events/${eventId}/entries/batch`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify({ rows }) }),
      ),
    listPeople: (bookId) => api(`${base}/books/${bookId}/people`, bookInit(bookId)),
    searchPeople: (bookId, q) =>
      api(`${base}/books/${bookId}/people/search?q=${encodeURIComponent(q)}`, bookInit(bookId)),
    upsertPerson: (bookId, input) =>
      api(
        `${base}/books/${bookId}/people`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify(input) }),
      ),
    listRelations: (bookId) => api(`${base}/books/${bookId}/relations`, bookInit(bookId)),
    createRelation: (bookId, input) =>
      api(
        `${base}/books/${bookId}/relations`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify(input) }),
      ),
    deleteRelation: async (bookId, relationId) => {
      await api(
        `${base}/books/${bookId}/relations/${relationId}`,
        bookInit(bookId, { method: 'DELETE' }),
      );
    },
    tree: (bookId) => api(`${base}/books/${bookId}/tree`, bookInit(bookId)),
    listReturns: (bookId, status?: SodamReturnStatus) =>
      api(`${base}/books/${bookId}/returns${status ? `?status=${status}` : ''}`, bookInit(bookId)),
    markReturn: (bookId, returnId, input) =>
      api(
        `${base}/books/${bookId}/returns/${returnId}`,
        bookInit(bookId, { method: 'PATCH', body: JSON.stringify(input) }),
      ),
    exportCsv: async (bookId) => {
      const data = await api<{ csv: string }>(
        `${base}/books/${bookId}/export.csv`,
        bookInit(bookId),
      );
      return data.csv;
    },
    importCsv: (bookId, csv) =>
      api(
        `${base}/books/${bookId}/import.csv`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify({ csv }) }),
      ),
    parseUtterance: (bookId, text) =>
      api(
        `${base}/books/${bookId}/ai/parse`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify({ text }) }),
      ),
    suggestAmount: (bookId, personId) =>
      api(
        `${base}/books/${bookId}/ai/suggest-amount`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify({ personId }) }),
      ),
    photoCandidates: async (bookId, file) => {
      const form = new FormData();
      form.append('file', file);
      return api(
        `${base}/books/${bookId}/ai/photo`,
        bookInit(bookId, { method: 'POST', body: form }),
      );
    },
    sync: (bookId, mutations) =>
      api(
        `${base}/books/${bookId}/sync`,
        bookInit(bookId, { method: 'POST', body: JSON.stringify({ mutations }) }),
      ),
  };
}

export type { SodamEventKind, SodamEventRole };
