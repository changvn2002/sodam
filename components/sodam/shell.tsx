'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Clock, Copy, Home, Minus, Share2, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OfflineBanner } from './ui/offline-ui';

export type SodamNavId = 'home' | 'overview' | 'returns' | 'people' | 'tree' | 'event';

/** Mã mời hiển thị theo nhóm 4 ký tự (A11Y-09). */
export function formatInviteCode(code: string): string {
  const clean = code.replace(/\s+/g, '').toUpperCase();
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

const bookNav: Array<{ id: SodamNavId; label: string }> = [
  { id: 'overview', label: 'Đám' },
  { id: 'returns', label: 'Trả lễ' },
  { id: 'people', label: 'Người' },
  { id: 'tree', label: 'Cây họ' },
];

type ShellProps = {
  /** Tên hiển thị trên AppBar: tên sổ khi đang trong sổ, "Sổ Đám" ở trang chủ. */
  title: string;
  inviteCode?: string;
  online: boolean;
  error: string | null;
  activeNav: SodamNavId;
  onNav: (id: SodamNavId) => void;
  showBookNav: boolean;
  onBackHome?: () => void;
  children: ReactNode;
};

export function SodamShell({
  title,
  inviteCode,
  online,
  error,
  activeNav,
  onNav,
  showBookNav,
  onBackHome,
  children,
}: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="sticky top-0 z-30">
        <header className="bg-indigo-950 text-white shadow-[var(--shadow-card)]">
          <div
            className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {showBookNav && onBackHome ? (
              <button
                type="button"
                onClick={onBackHome}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[10px] text-indigo-100 transition-colors hover:bg-indigo-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Về danh sách sổ"
              >
                <ArrowLeft className="size-5" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/products/brand/sodam-logo.svg"
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg"
            />
            <p className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</p>
            {inviteCode ? <ShareBookButton inviteCode={inviteCode} /> : null}
          </div>
          {inviteCode ? (
            <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 pb-2.5 sm:px-6">
              <span className="text-xs text-indigo-100">Mã mời</span>
              <InviteCodeChip code={inviteCode} dark />
            </div>
          ) : null}
        </header>

        {showBookNav ? (
          <div className="border-b border-line bg-card">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <SegmentedTabs
                ariaLabel="Mục trong sổ"
                value={activeNav === 'event' ? 'overview' : activeNav}
                onChange={(id) => onNav(id as SodamNavId)}
                options={bookNav.map((n) => ({ id: n.id, label: n.label }))}
                className="border-0 bg-transparent p-0"
              />
            </div>
          </div>
        ) : null}

        <OfflineBanner online={online} />
      </div>

      {error ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
          <p
            role="alert"
            className="rounded-xl border border-lacquer bg-card px-3 py-2.5 text-sm text-ink"
          >
            {error}
          </p>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}

function ShareBookButton({ inviteCode }: { inviteCode: string }) {
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
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[10px] px-2 text-sm font-medium text-white transition-colors hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Chia sẻ sổ cho người nhà"
      >
        {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
        <span className="hidden sm:inline">{copied ? 'Đã chép link' : 'Chia sẻ'}</span>
      </button>
      {fallback ? (
        <span className="absolute right-0 top-full z-10 mt-1 block w-64 rounded-lg border border-line bg-card p-2 font-mono text-xs break-all text-ink">
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
  status: 'OPEN' | 'DONE' | 'OVER' | 'SKIPPED';
  label?: string;
}) {
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
      <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-indigo-50 px-2.5 text-xs font-semibold text-lacquer">
        <TriangleAlert className="size-3.5" aria-hidden />
        {label ?? 'Quá tay'}
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

/** Băng tổng chàm: 4 ô chia hairline, số Mono trắng, ô đầu gạch chân gold. */
export function KpiBand({
  items,
}: {
  items: Array<{ label: string; value: string; sub?: string }>;
}) {
  return (
    <section
      aria-label="Tổng quan tiền của sổ"
      className="grid grid-cols-2 overflow-hidden rounded-xl bg-indigo-950 text-white lg:grid-cols-4"
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            'border-indigo-100/25 px-4 py-3.5',
            i % 2 === 1 && 'border-l',
            i >= 2 && 'border-t lg:border-t-0',
            i > 0 && 'lg:border-l',
          )}
        >
          <p className="text-xs font-medium text-indigo-100">{item.label}</p>
          <p
            className={cn(
              'mt-1 font-mono text-xl font-semibold tabular-nums',
              i === 0 && 'underline decoration-gold decoration-2 underline-offset-4',
            )}
          >
            {item.value}
          </p>
          {item.sub ? <p className="mt-0.5 text-xs text-indigo-100">{item.sub}</p> : null}
        </div>
      ))}
    </section>
  );
}

/** Thanh dính đáy trong sổ/đám: tổng Mono + chip hàng chờ + nút hành động chính. */
export function StickyActionBar({
  totalLabel,
  totalValue,
  chip,
  children,
}: {
  totalLabel: string;
  totalValue: string;
  chip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card shadow-[var(--shadow-lift)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex min-h-[52px] w-full max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs text-muted">{totalLabel}</p>
          <p className="truncate font-mono text-[15px] font-semibold tabular-nums">{totalValue}</p>
        </div>
        {chip}
        <div className="ml-auto shrink-0">{children}</div>
      </div>
    </div>
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

/** Trạng thái trống chuẩn: illustration sổ trống + 1 câu + 1 CTA. */
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/products/sodam-empty.webp"
        alt=""
        width={240}
        height={160}
        className="h-auto w-full max-w-[200px]"
      />
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
        'min-h-12 w-full rounded-[10px] border border-line-strong bg-card px-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30',
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
        'min-h-12 w-full rounded-[10px] border border-line-strong bg-card px-3 text-base text-ink outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30',
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

export { Home };
