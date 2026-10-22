import { api } from '@/lib/api';
import type { SodamApi, SodamEventKind, SodamEventRole, SodamReturnStatus } from './types';

const base = '/api/products/sodam';

export function createHttpSodamApi(): SodamApi {
  return {
    status: () => api(`${base}`),
    listBooks: () => api(`${base}/books`),
    createBook: (name) => api(`${base}/books`, { method: 'POST', body: JSON.stringify({ name }) }),
    joinBook: (inviteCode) =>
      api(`${base}/books/join`, { method: 'POST', body: JSON.stringify({ inviteCode }) }),
    dashboard: (bookId) => api(`${base}/books/${bookId}/dashboard`),
    listEvents: (bookId) => api(`${base}/books/${bookId}/events`),
    createEvent: (bookId, input) =>
      api(`${base}/books/${bookId}/events`, { method: 'POST', body: JSON.stringify(input) }),
    getEvent: (bookId, eventId) => api(`${base}/books/${bookId}/events/${eventId}`),
    closeEvent: (bookId, eventId) =>
      api(`${base}/books/${bookId}/events/${eventId}/close`, { method: 'POST', body: '{}' }),
    createEntry: (bookId, eventId, input) =>
      api(`${base}/books/${bookId}/events/${eventId}/entries`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateEntry: (bookId, eventId, entryId, input) =>
      api(`${base}/books/${bookId}/events/${eventId}/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    deleteEntry: async (bookId, eventId, entryId) => {
      await api(`${base}/books/${bookId}/events/${eventId}/entries/${entryId}`, {
        method: 'DELETE',
      });
    },
    batchEntries: (bookId, eventId, rows) =>
      api(`${base}/books/${bookId}/events/${eventId}/entries/batch`, {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
    listPeople: (bookId) => api(`${base}/books/${bookId}/people`),
    searchPeople: (bookId, q) =>
      api(`${base}/books/${bookId}/people/search?q=${encodeURIComponent(q)}`),
    upsertPerson: (bookId, input) =>
      api(`${base}/books/${bookId}/people`, { method: 'POST', body: JSON.stringify(input) }),
    listRelations: (bookId) => api(`${base}/books/${bookId}/relations`),
    createRelation: (bookId, input) =>
      api(`${base}/books/${bookId}/relations`, { method: 'POST', body: JSON.stringify(input) }),
    tree: (bookId) => api(`${base}/books/${bookId}/tree`),
    listReturns: (bookId, status?: SodamReturnStatus) =>
      api(`${base}/books/${bookId}/returns${status ? `?status=${status}` : ''}`),
    markReturn: (bookId, returnId, input) =>
      api(`${base}/books/${bookId}/returns/${returnId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    exportCsv: async (bookId) => {
      const data = await api<{ csv: string }>(`${base}/books/${bookId}/export.csv`);
      return data.csv;
    },
    importCsv: (bookId, csv) =>
      api(`${base}/books/${bookId}/import.csv`, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    parseUtterance: (bookId, text) =>
      api(`${base}/books/${bookId}/ai/parse`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    suggestAmount: (bookId, personId) =>
      api(`${base}/books/${bookId}/ai/suggest-amount`, {
        method: 'POST',
        body: JSON.stringify({ personId }),
      }),
    photoCandidates: async (bookId, file) => {
      const form = new FormData();
      form.append('file', file);
      return api(`${base}/books/${bookId}/ai/photo`, { method: 'POST', body: form });
    },
    sync: (bookId, mutations) =>
      api(`${base}/books/${bookId}/sync`, {
        method: 'POST',
        body: JSON.stringify({ mutations }),
      }),
  };
}

export type { SodamEventKind, SodamEventRole };
