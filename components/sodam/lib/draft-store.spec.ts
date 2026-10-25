import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, draftKey, loadDraft, saveDraft } from './draft-store';

/**
 * W2 (PWA-FIX): draft-store là lớp persist cho PWA-31 — test các hành
 * vi chính: lưu→đọc khớp, xoá, dữ liệu hỏng ra null an toàn, key tách
 * theo bookId, và hai kho local/session không lẫn nhau. Vitest chạy
 * node (không jsdom) nên cài storage trong bộ nhớ + window giả, cùng
 * mẫu với api/mock-rotate.spec.ts.
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

const g = globalThis as unknown as {
  window?: { localStorage: MemoryStorage; sessionStorage: MemoryStorage };
};

let local: MemoryStorage;
let session: MemoryStorage;

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  g.window = { localStorage: local, sessionStorage: session };
});

afterEach(() => {
  delete g.window;
});

type EntryDraft = { eventId: string; name: string; amount: string; mode: string };

describe('draft-store', () => {
  it('lưu rồi đọc lại khớp nguyên giá trị', () => {
    const key = draftKey('quick-entry', 'book-1');
    const draft: EntryDraft = { eventId: 'ev-1', name: 'Bà Tư', amount: '500000', mode: 'manual' };
    saveDraft(key, draft);
    expect(loadDraft<EntryDraft>(key)).toEqual(draft);
  });

  it('chưa lưu gì → đọc ra null', () => {
    expect(loadDraft(draftKey('quick-entry', 'book-x'))).toBeNull();
  });

  it('xoá xong → đọc ra null, key khác không bị đụng', () => {
    const a = draftKey('quick-entry', 'book-1');
    const b = draftKey('create-event', 'book-1');
    saveDraft(a, { name: 'A' });
    saveDraft(b, { title: 'B' });
    clearDraft(a);
    expect(loadDraft(a)).toBeNull();
    expect(loadDraft(b)).toEqual({ title: 'B' });
  });

  it('dữ liệu hỏng trong kho → null an toàn, không văng lỗi', () => {
    const key = draftKey('quick-entry', 'book-1');
    local.setItem(key, '{không phải json');
    expect(loadDraft(key)).toBeNull();
  });

  it('key tách theo bookId: nháp sổ này không lộ sang sổ khác', () => {
    const keyA = draftKey('quick-entry', 'book-a');
    const keyB = draftKey('quick-entry', 'book-b');
    expect(keyA).not.toBe(keyB);
    saveDraft(keyA, { name: 'Chỉ của sổ A' });
    expect(loadDraft(keyB)).toBeNull();
    expect(loadDraft(keyA)).toEqual({ name: 'Chỉ của sổ A' });
  });

  it('kho session và local tách nhau (mã mời chỉ ở session)', () => {
    const key = draftKey('home-invite-code');
    saveDraft(key, { code: 'ABCD' }, 'session');
    expect(loadDraft(key, 'session')).toEqual({ code: 'ABCD' });
    expect(loadDraft(key, 'local')).toBeNull();
    clearDraft(key, 'session');
    expect(loadDraft(key, 'session')).toBeNull();
  });

  it('storage ném lỗi (quota/private mode) → nuốt lỗi, đọc ra null', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as MemoryStorage;
    g.window = { localStorage: broken, sessionStorage: broken };
    const key = draftKey('quick-entry', 'book-1');
    expect(() => saveDraft(key, { name: 'A' })).not.toThrow();
    expect(() => clearDraft(key)).not.toThrow();
    expect(loadDraft(key)).toBeNull();
  });

  it('không có window (SSR) → đọc null, ghi/xoá là no-op an toàn', () => {
    delete g.window;
    const key = draftKey('quick-entry', 'book-1');
    expect(loadDraft(key)).toBeNull();
    expect(() => saveDraft(key, { name: 'A' })).not.toThrow();
    expect(() => clearDraft(key)).not.toThrow();
  });
});
