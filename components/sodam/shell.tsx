'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Minus,
  Plus,
  Search,
  Share2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OfflineBanner } from './ui/offline-ui';
import { GROUP_STYLE, groupOfKind } from './lib/lexicon';
import type { SodamEvent } from './api/types';

export type SodamFace = 'overview' | 'event' | 'returns' | 'people' | 'tree';

export const FACE_LABELS: Record<SodamFace, string> = {
  overview: 'Tổng quan',
  event: 'Đám',
  returns: 'Trả lễ',
  people: 'Người',
  tree: 'Cây họ',
};

const FACE_ORDER: SodamFace[] = ['overview', 'returns', 'people', 'tree'];

/** Mã mời hiển thị theo nhóm 4 ký tự (A11Y-09). */
export function formatInviteCode(code: string): string {
  const clean = code.replace(/\s+/g, '').toUpperCase();
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/* ------------------------------------------------------------------ */
/* Khung sườn Command Ledger (REDESIGN-V2): rail trái chàm ở desktop, */
/* khối trên + thanh ghi nhanh ghim đáy ở mobile. Rail kể câu chuyện  */
/* sổ → đám → mặt; vùng children cuộn nội bộ, trang không dài theo    */
/* dữ liệu (SC-2).                                                    */
/* ------------------------------------------------------------------ */

export type WorkspaceShellProps = {
  bookName: string;
  inviteCode?: string;
  online: boolean;
  error: string | null;
  books: Array<{ id: string; name: string }>;
  events: SodamEvent[];
  activeBookId: string | null;
  activeEventId: string | null;
  face: SodamFace;
  returnsBadge?: number;
  onSelectBook: (id: string) => void;
  onSelectEvent: (id: string) => void;
  onFace: (face: SodamFace) => void;
  onHome: () => void;
  onCreateBook: () => void;
  onCreateEvent: () => void;
  totalsStrip?: ReactNode;
  commandBar?: ReactNode;
  outboxChip?: ReactNode;
  shareMenu?: ReactNode;
  overflowMenu?: ReactNode;
  mobileTotal?: { label: string; value: string };
  quickBarAction?: ReactNode;
  children: ReactNode;
};

export function WorkspaceShell({
  bookName,
  online,
  error,
  books,
  events,
  activeBookId,
  activeEventId,
  face,
  returnsBadge,
  onSelectBook,
  onSelectEvent,
  onFace,
  onHome,
  onCreateBook,
  onCreateEvent,
  totalsStrip,
  commandBar,
  outboxChip,
  shareMenu,
  overflowMenu,
  mobileTotal,
  quickBarAction,
  children,
}: WorkspaceShellProps) {
  const faceLabel = FACE_LABELS[face];

  const railSectionLabel = 'px-5 pt-5 pb-1.5 text-xs font-medium text-indigo-100';
  const railRow =
    'flex min-h-11 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-100';

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Rail — desktop */}
      <aside className="hidden min-h-0 flex-col overflow-y-auto bg-indigo-950 text-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/products/brand/sodam-logo.svg"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg"
          />
          <p className="text-[17px] font-semibold">Sổ Đám</p>
        </div>

        <p className={railSectionLabel}>Sổ</p>
        <nav aria-label="Sổ của bạn" className="space-y-0.5 px-2">
          {books.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelectBook(b.id)}
              aria-current={b.id === activeBookId ? 'true' : undefined}
              className={cn(
                railRow,
                b.id === activeBookId
                  ? 'bg-indigo-800 font-semibold text-white'
                  : 'text-indigo-100 hover:bg-indigo-800 hover:text-white',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onCreateBook}
            className={cn(
              railRow,
              'font-medium text-indigo-100 hover:bg-indigo-800 hover:text-white',
            )}
          >
            <Plus className="size-4 shrink-0" aria-hidden /> Tạo sổ
          </button>
        </nav>

        <p className={railSectionLabel}>Đám</p>
        <nav aria-label="Đám trong sổ" className="space-y-0.5 px-2">
          {events.map((e) => {
            const style = GROUP_STYLE[groupOfKind(e.kind)];
            const active = e.id === activeEventId && face === 'event';
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvent(e.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  railRow,
                  active
                    ? 'bg-indigo-800 font-semibold text-white'
                    : 'text-indigo-100 hover:bg-indigo-800 hover:text-white',
                )}
              >
                <span className={cn('size-2 shrink-0 rounded-full', style.dot)} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onCreateEvent}
            className={cn(
              railRow,
              'font-medium text-indigo-100 hover:bg-indigo-800 hover:text-white',
            )}
          >
            <Plus className="size-4 shrink-0" aria-hidden /> Tạo đám
          </button>
        </nav>

        <p className={railSectionLabel}>Xem sổ</p>
        <nav aria-label="Các mục xem sổ" className="space-y-0.5 px-2">
          {FACE_ORDER.map((f) => {
            const active = face === f || (f === 'overview' && face === 'event');
            return (
              <button
                key={f}
                type="button"
                onClick={() => onFace(f)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  railRow,
                  active
                    ? 'bg-indigo-800 font-semibold text-white'
                    : 'text-indigo-100 hover:bg-indigo-800 hover:text-white',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{FACE_LABELS[f]}</span>
                {f === 'returns' && returnsBadge ? (
                  <span className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-gold-soft px-1.5 font-mono text-xs font-semibold text-gold-ink tabular-nums">
                    {returnsBadge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {outboxChip ? <div className="mt-auto px-4 pt-4 pb-5">{outboxChip}</div> : null}
      </aside>

      {/* Cột phải */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Thanh trên — desktop */}
        <header className="hidden min-h-[52px] items-center gap-3 border-b border-line bg-card px-5 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">
              {bookName} / {faceLabel}
            </p>
            <h1 className="truncate text-[17px] leading-tight font-semibold">{bookName}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {shareMenu}
            {overflowMenu}
          </div>
        </header>

        {/* Khối trên — mobile */}
        <div className="border-b border-line bg-card lg:hidden">
          <div className="flex min-h-14 items-center gap-1 px-2">
            <button
              type="button"
              onClick={onHome}
              aria-label="Về danh sách sổ"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[10px] text-ink transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{bookName}</h1>
            <div className="flex shrink-0 items-center">
              {shareMenu}
              {overflowMenu}
            </div>
          </div>

          <div
            className="flex gap-1.5 overflow-x-auto px-3 pb-2"
            role="group"
            aria-label="Chọn đám"
          >
            {events.map((e) => {
              const style = GROUP_STYLE[groupOfKind(e.kind)];
              const active = e.id === activeEventId && face === 'event';
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelectEvent(e.id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    active
                      ? cn('font-semibold', style.selectedChip)
                      : 'border-line-strong bg-card text-ink',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', style.dot)} aria-hidden />
                  {e.title}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onCreateEvent}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line-strong bg-card px-3 text-sm font-medium whitespace-nowrap text-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Plus className="size-4" aria-hidden /> Tạo đám
            </button>
          </div>

          <nav aria-label="Các mục xem sổ" className="flex px-2">
            {FACE_ORDER.map((f) => {
              const active = face === f || (f === 'overview' && face === 'event');
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFace(f)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'relative inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 px-1 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    active ? 'font-semibold text-indigo-700' : 'font-medium text-muted',
                  )}
                >
                  {FACE_LABELS[f]}
                  {f === 'returns' && returnsBadge ? (
                    <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-gold-soft px-1 font-mono text-xs font-semibold text-gold-ink tabular-nums">
                      {returnsBadge}
                    </span>
                  ) : null}
                  {active ? (
                    <span
                      className="absolute right-2 bottom-0 left-2 h-0.5 bg-indigo-700"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <OfflineBanner online={online} />
        {commandBar}
        {totalsStrip}

        {error ? (
          <div className="px-4 pt-3 lg:px-5">
            <p
              role="alert"
              className="rounded-xl border border-lacquer bg-card px-3 py-2.5 text-sm text-ink"
            >
              {error}
            </p>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {/* Thanh ghi nhanh ghim đáy — mobile */}
        <div
          className="flex min-h-[52px] items-center gap-3 border-t border-line bg-card px-4 py-2 lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {mobileTotal ? (
            <div className="min-w-0">
              <p className="text-xs text-muted">{mobileTotal.label}</p>
              <p className="truncate font-mono text-[15px] font-semibold tabular-nums">
                {mobileTotal.value}
              </p>
            </div>
          ) : null}
          {outboxChip}
          {quickBarAction ? <div className="ml-auto shrink-0">{quickBarAction}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Command bar: nút ghi khoản phổ quát + chọn đám + tìm trong bảng.  */
/* ------------------------------------------------------------------ */

export function CommandBar({
  onQuickEntry,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  showSearch = false,
  events,
  activeEventId,
  onSelectEvent,
  outboxChip,
}: {
  onQuickEntry: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  showSearch?: boolean;
  events: SodamEvent[];
  activeEventId: string | null;
  onSelectEvent: (id: string) => void;
  outboxChip?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-line bg-card px-4 py-1.5 lg:px-5">
      <Btn onClick={onQuickEntry}>
        <Plus className="size-4" aria-hidden /> Ghi khoản
      </Btn>
      {events.length > 0 ? (
        <label className="sr-only" htmlFor="sodam-event-select">
          Chọn đám đang xem
        </label>
      ) : null}
      {events.length > 0 ? (
        <select
          id="sodam-event-select"
          aria-label="Chọn đám đang xem"
          value={activeEventId ?? ''}
          onChange={(e) => {
            if (e.target.value) onSelectEvent(e.target.value);
          }}
          className="min-h-11 max-w-44 truncate rounded-[10px] border border-line-strong bg-card px-2.5 text-sm text-ink outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="" disabled>
            Chọn đám
          </option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      ) : null}
      {showSearch ? (
        <div className="relative min-w-36 flex-1 sm:max-w-xs sm:flex-none sm:basis-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <label className="sr-only" htmlFor="sodam-search">
            {searchLabel ?? 'Tìm trong bảng'}
          </label>
          <input
            id="sodam-search"
            type="search"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder ?? 'Tìm…'}
            aria-label={searchLabel ?? 'Tìm trong bảng'}
            className="min-h-11 w-full rounded-[10px] border border-line-strong bg-card pr-3 pl-9 text-sm text-ink outline-none placeholder:text-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      ) : null}
      {outboxChip ? <span className="hidden lg:inline-flex">{outboxChip}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dải tổng của sổ: 4 số trung tính + 1 dòng công thức Mono.          */
/* ------------------------------------------------------------------ */

export function TotalsStrip({
  received,
  given,
  kept,
  pendingLabel,
  pendingValue,
  pendingCount,
  overGiven,
}: {
  received: string;
  given: string;
  kept: string;
  pendingLabel: string;
  pendingValue: string;
  pendingCount: number;
  overGiven?: string | null;
}) {
  const cells = [
    { label: 'Tổng đã nhận', value: received },
    { label: 'Tổng đã đi', value: given },
    { label: 'Còn giữ', value: kept },
    {
      label: pendingLabel,
      value: pendingValue,
      sub: pendingCount > 0 ? `${pendingCount} khoản` : undefined,
    },
  ];
  return (
    <section aria-label="Tổng của sổ" className="border-b border-line bg-card px-4 py-2 lg:px-5">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {cells.map((c) => (
          <p key={c.label} className="text-sm whitespace-nowrap">
            <span className="text-muted">{c.label} </span>
            <span className="font-mono font-semibold tabular-nums">{c.value}</span>
            {c.sub ? <span className="text-muted"> ({c.sub})</span> : null}
          </p>
        ))}
      </div>
      {/* Panel #02 mục 5: KHÔNG truncate — từng vế là một khối nowrap, dòng
          công thức tự xuống dòng giữa các vế để con số kết luận "còn giữ"
          luôn hiện trọn trên mobile 390px. */}
      <p className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-xs tabular-nums text-muted">
        <span className="whitespace-nowrap">Đã nhận {received}</span>
        <span className="whitespace-nowrap">− đã đi {given}</span>
        <span className="whitespace-nowrap">= còn giữ {kept}</span>
        {overGiven ? <span className="whitespace-nowrap">· đi nhiều hơn {overGiven}</span> : null}
      </p>
    </section>
  );
}

/** Nút chia sẻ sổ: chép link chứa mã mời (menu chia sẻ do app dựng khi cần preview). */
export function ShareBookButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  async function share() {
    const link = `${window.location.origin}/?code=${encodeURIComponent(inviteCode)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Sổ Đám', url: link });
        return;
      } catch {
        // Người dùng hủy share sheet — rơi xuống chép link.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setFallback(link);
    }
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[10px] px-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Chia sẻ sổ cho người nhà"
      >
        {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
        <span className="hidden sm:inline">{copied ? 'Đã chép link' : 'Chia sẻ'}</span>
      </button>
      {fallback ? (
        <span className="absolute top-full right-0 z-10 mt-1 block w-64 rounded-lg border border-line bg-card p-2 font-mono text-xs break-all text-ink">
          {fallback}
        </span>
      ) : null}
    </span>
  );
}

/** Mã mời mono theo nhóm 4 + nút chép ≥44px. */
export function InviteCodeChip({ code, dark = false }: { code: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bị chặn — mã vẫn đọc/chép tay được từ chính chip này.
    }
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full py-0.5 pr-0.5 pl-3',
        dark ? 'bg-indigo-900 text-white' : 'border border-line bg-indigo-50 text-ink',
      )}
    >
      <span className="font-mono text-[13px] font-medium tracking-wide tabular-nums">
        {formatInviteCode(code)}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          dark ? 'text-indigo-100 hover:text-white' : 'text-indigo-700 hover:bg-card',
        )}
        aria-label={copied ? 'Đã chép mã mời' : 'Chép mã mời'}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </span>
  );
}

export function SegmentedTabs({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 overflow-x-auto rounded-xl border border-line bg-indigo-50 p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              active
                ? 'bg-card font-semibold text-indigo-700 shadow-[var(--shadow-card)]'
                : 'font-medium text-muted hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusPill({
  status,
  label,
}: {
  status: 'OPEN' | 'DONE' | 'OVER' | 'SKIPPED' | 'PENDING';
  label?: string;
}) {
  if (status === 'PENDING') {
    return (
      <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700">
        <Clock className="size-3.5" aria-hidden />
        {label ?? 'Đang chờ gửi'}
      </span>
    );
  }
  if (status === 'DONE') {
    return (
      <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-indigo-50 px-2.5 text-xs font-semibold text-green-ink">
        <Check className="size-3.5" aria-hidden />
        {label ?? 'Đã trả'}
      </span>
    );
  }
  if (status === 'OVER') {
    return (
      <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-indigo-50 px-2.5 text-xs font-semibold text-gold-ink">
        <TriangleAlert className="size-3.5" aria-hidden />
        {label ?? 'Trả dư'}
      </span>
    );
  }
  if (status === 'SKIPPED') {
    return (
      <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-indigo-50 px-2.5 text-xs font-semibold text-muted">
        <Minus className="size-3.5" aria-hidden />
        {label ?? 'Bỏ qua'}
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-amber-soft px-2.5 text-xs font-semibold text-amber-ink">
      <Clock className="size-3.5" aria-hidden />
      {label ?? 'Chờ trả'}
    </span>
  );
}

/** Bottom sheet trên mobile / dialog giữa màn hình trên desktop. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-ink/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet relative flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-2xl bg-card shadow-[var(--shadow-lift)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-indigo-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Đóng cửa sổ"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Trạng thái trống chuẩn: minh hoạ sổ mở vẽ tay + 1 câu + 1 CTA.
 *
 * Panel #02 mục 7: ảnh raster cũ (sodam-empty.webp) dán nguyên khối nền xám
 * #f6f6f6 lệch tông với mọi canvas (paper #f5f5f7 / card trắng). Nay vẽ SVG
 * inline ngay tại đây — nền trong suốt, nét chàm + điểm vàng thuộc hệ
 * redesign — nên khớp tông ở mọi bề mặt và không tốn một request nào.
 */
export function EmptyLedger({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <svg
        viewBox="0 0 200 132"
        className="h-auto w-full max-w-[200px]"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Sổ mở hai trang */}
        <path
          d="M100 22c-13-8.5-30-11-48-8.5v96c18-2.5 35 0 48 8.5 13-8.5 30-11 48-8.5v-96c-18-2.5-35 0-48 8.5Z"
          fill="#F0F1F8"
          stroke="#323C85"
          strokeWidth="2.5"
        />
        <path d="M100 22v96.5" stroke="#323C85" strokeWidth="2.5" />
        {/* Dòng kẻ chờ ghi — trang trái */}
        <path d="M64 44h24M64 60h24M64 76h16" stroke="#7E85AB" strokeWidth="2.5" />
        {/* Dòng kẻ chờ ghi — trang phải */}
        <path d="M112 44h24M112 60h24M112 76h16" stroke="#7E85AB" strokeWidth="2.5" />
        {/* Đồng xu vàng chưa ghi khoản nào */}
        <circle cx="160" cy="98" r="13" fill="#F3E5C3" stroke="#C9A24B" strokeWidth="2.5" />
        <path d="M160 91v14M155.5 94.5h6.5a3 3 0 0 1 0 6h-5" stroke="#7A5A14" strokeWidth="2.2" />
        {/* Nét bút chờ */}
        <path
          d="M38 108l14-4-4 14-3.5-6.5L38 108Z"
          fill="#161A3D"
          stroke="#161A3D"
          strokeWidth="2"
        />
      </svg>
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
            ) : null}
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-ink">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-sm font-medium text-lacquer">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Input(props: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'min-h-12 w-full rounded-[10px] border border-line-strong bg-card px-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500',
        props.className,
      )}
    />
  );
}

export function Select(props: React.ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn(
        'min-h-12 w-full rounded-[10px] border border-line-strong bg-card px-3 text-base text-ink outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500',
        props.className,
      )}
    />
  );
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  className,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' && 'bg-indigo-700 text-white hover:bg-indigo-600',
        variant === 'secondary' && 'border border-line-strong bg-card text-ink hover:bg-indigo-50',
        variant === 'ghost' && 'text-indigo-700 hover:bg-indigo-50',
        variant === 'danger' && 'bg-lacquer text-white hover:bg-lacquer/90',
        className,
      )}
    >
      {children}
    </button>
  );
}
