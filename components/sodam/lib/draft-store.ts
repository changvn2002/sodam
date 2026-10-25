'use client';

/**
 * Lưu nháp form vào Web Storage (PWA-31: reload / đóng–mở lại sheet
 * không được làm mất lặng dữ liệu đang nhập dở).
 *
 * Helper generic JSON: caller tự định nghĩa kiểu nháp và chọn nơi lưu
 * qua `draftKey(scope, id)` — scope là tên form, id thường là bookId
 * để nháp của từng sổ tách riêng. Hai kho:
 * - 'local' (mặc định): localStorage — sống qua reload và đóng tab.
 * - 'session': sessionStorage — sống qua reload, chết khi đóng tab;
 *   dùng cho dữ liệu nhạy cảm không nên nằm lâu dài trên máy (mã mời
 *   là credential — xem home-view.tsx).
 *
 * Mọi hàm đều SSR-safe (không có window → đọc ra null, ghi/xoá là
 * no-op) và nuốt lỗi storage (quota, private mode, JSON hỏng): mất
 * nháp thì form quay về trống như trước, không bao giờ văng lỗi.
 */

export type DraftStorageKind = 'local' | 'session';

const NAMESPACE = 'sodam_draft_v1';

/** Key có namespace + scope (+ id, thường là bookId) để nháp không lẫn nhau. */
export function draftKey(scope: string, id?: string | null): string {
  return id ? `${NAMESPACE}:${scope}:${id}` : `${NAMESPACE}:${scope}`;
}

function resolveStorage(kind: DraftStorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    // Truy cập storage bị chặn (một số chế độ riêng tư) — coi như không có kho.
    return null;
  }
}

export function saveDraft<T>(key: string, value: T, kind: DraftStorageKind = 'local'): void {
  const storage = resolveStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Hết quota / bị chặn — bỏ qua, luồng nhập liệu chính không phụ thuộc nháp.
  }
}

export function loadDraft<T>(key: string, kind: DraftStorageKind = 'local'): T | null {
  const storage = resolveStorage(kind);
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Dữ liệu hỏng (viết dở, định dạng cũ) — coi như không có nháp.
    return null;
  }
}

export function clearDraft(key: string, kind: DraftStorageKind = 'local'): void {
  const storage = resolveStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Bị chặn — không còn gì làm được, bỏ qua.
  }
}
