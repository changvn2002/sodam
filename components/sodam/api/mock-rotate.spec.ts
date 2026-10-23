import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { codeForBook } from '../lib/book-store';
import { createMockSodamApi, resetSodamMockStore } from './mock';

/**
 * F-r3-2: sau rotate, registry thiết bị (book-store) của MOCK transport
 * phải cập nhật mã mới như http.ts làm bằng rememberBook — trước fix wave
 * mock chỉ đổi mã trong store, registry vẫn giữ mã cũ đã chết.
 * book-store guard `typeof window === 'undefined'` nên test cài một
 * localStorage trong bộ nhớ + window = globalThis để registry chạy thật.
 */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };

beforeEach(() => {
  resetSodamMockStore();
  g.window = globalThis;
  g.localStorage = new MemoryStorage();
});

afterEach(() => {
  delete g.window;
  delete g.localStorage;
});

describe('mock rotateInviteCode — registry thiết bị (F-r3-2)', () => {
  it('sau rotate, codeForBook trả mã MỚI (không còn mã cũ đã chết)', async () => {
    const api = createMockSodamApi();
    const book = await api.createBook('Sổ mock F-r3-2');
    const oldCode = book.inviteCode;
    const rotated = await api.rotateInviteCode(book.id);
    expect(rotated.inviteCode).not.toBe(oldCode);
    expect(codeForBook(book.id)).toBe(rotated.inviteCode);
  });
});
