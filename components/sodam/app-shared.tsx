'use client';

import type { SodamRelationType } from './api/types';
import { formatLunarVi, solarToLunar } from './lib/lunar';
import type { SodamFace } from './shell';

export type Face = SodamFace;

export type GhostEntry = { eventId: string; personName: string; amountVnd: number; source: string };

export const money = (n: number) => n.toLocaleString('vi-VN') + '₫';

/** Chuỗi lỗi thô của fetch không bao giờ tới UI (F-W5-05) — ánh xạ sang tiếng Việt. */
export function friendlyError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : '';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Không kết nối được máy chủ — kiểm tra mạng rồi thử lại.';
  }
  return msg || fallback;
}

/** Mốc tiền quen thuộc — chỉ điền khi người dùng chạm vào. */
export const QUICK_AMOUNTS = [100_000, 200_000, 300_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

export const formatAmountInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
};

export function QuickAmounts({ onPick }: { onPick: (value: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn nhanh số tiền">
      {QUICK_AMOUNTS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-card px-3 font-mono text-[13px] font-medium tabular-nums text-ink transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {money(v)}
        </button>
      ))}
    </div>
  );
}

/** Ngày dương (để hiển thị) + ngày âm tương ứng của một sự kiện. */
export function eventDateLabels(occurredOn?: string): { solar: string; lunar: string } | null {
  if (!occurredOn) return null;
  let day: number;
  let month: number;
  let year: number;
  const m = occurredOn.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else {
    const dt = new Date(occurredOn);
    if (Number.isNaN(dt.getTime())) return null;
    day = dt.getDate();
    month = dt.getMonth() + 1;
    year = dt.getFullYear();
  }
  const solar = `${day}/${month}/${year}`;
  try {
    const l = solarToLunar(day, month, year);
    return { solar, lunar: formatLunarVi(l.day, l.month, l.leap) };
  } catch {
    return { solar, lunar: '' };
  }
}

/** Câu hệ quả trả lễ theo 3 tình huống (COPY-DIET §4 — thay toàn bộ câu cũ). */
export function returnConsequence(pay: number, received: number, name: string): string {
  if (pay < received) {
    return `Trả ${money(pay)} trong ${money(received)} đã nhận — phần còn lại ${money(received - pay)} vẫn ở khoản Chờ trả.`;
  }
  if (pay > received) {
    return `Trả ${money(pay)}, nhiều hơn ${money(received)} đã nhận — phần dư ${money(pay - received)} được ghi là Trả dư.`;
  }
  return `Trả ${money(pay)} — sổ sẽ ghi bạn đã trả đủ cho ${name}.`;
}

export type PushToast = (
  message: string,
  action?: { label: string; run: () => void | Promise<void> },
) => void;

export const RELATION_LABELS: Record<SodamRelationType, string> = {
  SPOUSE: 'Vợ/Chồng',
  PARENT: 'Cha/Mẹ',
  CHILD: 'Con',
  SIBLING: 'Anh/Chị/Em',
  OTHER: 'Họ hàng',
};
