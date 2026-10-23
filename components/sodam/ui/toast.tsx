'use client';

import { X } from 'lucide-react';

export type ToastData = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Chồng toast tối giản của Command Ledger: nền chàm 950, chữ trắng,
 * hành động (vd Hoàn tác) luôn chạm được ≥44px. Thời gian tự huỷ do
 * phía app quản (8000ms — ≥6s theo H-5).
 */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-4 bottom-24 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="flex items-center gap-1 rounded-xl bg-indigo-950 px-4 py-3 text-white shadow-[var(--shadow-lift)]"
        >
          <p className="min-w-0 flex-1 text-sm leading-snug">{t.message}</p>
          {t.actionLabel && t.onAction ? (
            <button
              type="button"
              onClick={() => {
                t.onAction?.();
                onDismiss(t.id);
              }}
              className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] px-2.5 text-sm font-semibold text-gold-soft transition-colors hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-100"
            >
              {t.actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Đóng thông báo"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[10px] text-indigo-100 transition-colors hover:bg-indigo-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-100"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
