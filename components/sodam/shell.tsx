'use client';

import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  GitBranch,
  Home,
  LayoutDashboard,
  Link2,
  Mic,
  Search,
  Users,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SodamNavId = 'home' | 'overview' | 'returns' | 'people' | 'tree' | 'event';

type ShellProps = {
  title: string;
  subtitle?: string;
  bookName?: string;
  inviteCode?: string;
  online: boolean;
  aiBlocked: boolean;
  error: string | null;
  activeNav: SodamNavId;
  onNav: (id: SodamNavId) => void;
  showBookNav: boolean;
  onBackHome?: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
};

const bookNav: Array<{ id: SodamNavId; label: string; short: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Tổng quan', short: 'Tổng', icon: LayoutDashboard },
  { id: 'returns', label: 'Trả lễ', short: 'Trả', icon: Users },
  { id: 'people', label: 'Người', short: 'Người', icon: Search },
  { id: 'tree', label: 'Họ hàng', short: 'Họ', icon: GitBranch },
];

export function SodamShell({
  title,
  subtitle,
  bookName,
  inviteCode,
  online,
  aiBlocked,
  error,
  activeNav,
  onNav,
  showBookNav,
  onBackHome,
  headerAction,
  children,
}: ShellProps) {
  return (
    <div
      className="flex min-h-dvh flex-col bg-paper"
      style={
        {
          '--paper': '#FAF6EF',
          '--card': '#FFFDF8',
          '--line': '#E7DCC8',
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(1000px 480px at -5% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 58%), radial-gradient(800px 400px at 110% 0%, color-mix(in srgb, var(--ink) 7%, transparent), transparent 52%), linear-gradient(180deg, color-mix(in srgb, var(--card) 78%, var(--paper)), var(--paper) 38%)',
        }}
      />

      <header className="sticky top-0 z-30 border-b border-black/20 bg-jade-deep text-[#FAF6EF] shadow-[0_1px_0_rgba(0,0,0,0.15)]">
        <div
          className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <Link
            href="/"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#FAF6EF]/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Về trang chủ Sổ Đám"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/products/brand/sodam-logo.svg"
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-[0.7rem] shadow-[0_2px_8px_rgba(16,20,24,0.18)] ring-1 ring-ink/10"
            />
            <div className="min-w-0">
              <p className="font-serif-vn truncate text-base font-semibold tracking-tight text-[#FAF6EF] sm:text-lg">
                {title}
              </p>
              {subtitle || bookName ? (
                <p className="truncate text-xs text-[#FAF6EF]/65">
                  {bookName ? (
                    <>
                      <span className="text-[#FAF6EF]/85">{bookName}</span>
                      {inviteCode ? (
                        <span className="ml-2 rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                          {inviteCode}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    subtitle
                  )}
                </p>
              ) : null}
              {bookName && inviteCode ? <ShareLinkButton inviteCode={inviteCode} /> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!online ? (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 text-xs text-muted">
                <WifiOff className="size-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            ) : null}
            {headerAction}
          </div>
        </div>
      </header>

      {(aiBlocked || error) && (
        <div className="mx-auto w-full max-w-6xl space-y-2 px-4 pt-3 sm:px-6">
          {aiBlocked ? (
            <Banner tone="warn">
              AI tạm khóa — vẫn ghi tay / ảnh duyệt được. Liên hệ admin để mở.
            </Banner>
          ) : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        {showBookNav ? (
          <nav
            className="sticky top-[4.25rem] hidden h-[calc(100dvh-4.25rem)] w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line/70 p-4 md:flex"
            aria-label="Điều hướng sổ"
          >
            {onBackHome ? (
              <button
                type="button"
                onClick={onBackHome}
                className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted transition-colors hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Home className="size-4" />
                Tất cả sổ
              </button>
            ) : null}
            <p className="mb-1 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
              Workspace
            </p>
            {bookNav.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNav(item.id)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    active
                      ? 'bg-jade-deep font-medium text-[#FAF6EF] shadow-[0_1px_0_rgba(16,20,24,0.08)]'
                      : 'text-muted hover:bg-card hover:text-ink',
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-90" />
                  {item.label}
                </button>
              );
            })}
            <div className="mt-auto rounded-2xl border border-line bg-card p-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-accent" />
                <p className="text-xs font-medium text-ink">Mẹo</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Ghi miệng trước, sửa sau. Tiền chỉ lưu khi bạn xác nhận Đúng.
              </p>
            </div>
          </nav>
        ) : null}

        <main
          className={cn(
            'min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6',
            showBookNav ? 'pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-10' : 'pb-10',
          )}
        >
          {children}
        </main>
      </div>

      {showBookNav ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-black/25 bg-jade-deep md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Điều hướng sổ"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-0.5 px-2 py-1.5">
            {bookNav.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNav(item.id)}
                  className={cn(
                    'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                    active
                      ? 'font-semibold text-[#FAF6EF]'
                      : 'text-[#FAF6EF]/55 hover:text-[#FAF6EF]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      active ? 'bg-white/12 text-gold' : 'text-[#FAF6EF]/55',
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  {item.short}
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function Banner({ children, tone }: { children: ReactNode; tone: 'warn' | 'danger' }) {
  return (
    <p
      className={cn(
        'rounded-xl border px-3 py-2.5 text-sm',
        tone === 'warn' && 'border-line bg-card text-muted',
        tone === 'danger' && 'border-line bg-card text-ink',
      )}
    >
      {children}
    </p>
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
        'overflow-hidden rounded-3xl border border-line/70 bg-card shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-serif-vn text-[15px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted sm:text-sm">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm text-ink">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/80 hover:border-ink/20 focus:border-accent focus:ring-2 focus:ring-accent/25',
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
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' &&
          'bg-jade-deep text-[#FAF6EF] shadow-[var(--shadow-card)] hover:bg-jade-deep/90',
        variant === 'secondary' &&
          'border border-line bg-card text-ink hover:border-ink/25 hover:bg-paper',
        variant === 'ghost' && 'text-muted hover:bg-paper hover:text-ink',
        variant === 'danger' && 'border border-line bg-card text-ink hover:bg-paper',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  featured = false,
}: {
  label: string;
  value: string;
  icon?: typeof BookOpen;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border px-4 py-4',
        featured
          ? 'border-jade-deep bg-jade-deep shadow-[var(--shadow-card)]'
          : 'border-line bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-[11px] font-medium tracking-wide uppercase',
            featured ? 'text-[#FAF6EF]/70' : 'text-muted',
          )}
        >
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-lg',
              featured ? 'bg-white/10 text-gold' : 'bg-paper text-accent',
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight',
          featured ? 'font-serif-vn text-gold-soft' : 'font-display text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function QuickAction({
  icon: Icon,
  label,
  hint,
  onClick,
  tone = 'default',
}: {
  icon: typeof Mic;
  label: string;
  hint: string;
  onClick: () => void;
  tone?: 'default' | 'accent';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[6.25rem] flex-col items-start justify-between rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        tone === 'accent'
          ? 'border-lacquer/40 bg-lacquer text-card hover:bg-lacquer/90'
          : 'border-line bg-card hover:border-ink/20 hover:bg-paper',
      )}
    >
      <span
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-xl transition-colors',
          tone === 'accent' ? 'bg-card/15 text-card' : 'bg-paper text-ink group-hover:bg-card',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span>
        <span
          className={cn(
            'block text-sm font-semibold',
            tone === 'accent' ? 'text-card' : 'text-ink',
          )}
        >
          {label}
        </span>
        <span
          className={cn('mt-0.5 block text-xs', tone === 'accent' ? 'text-card/80' : 'text-muted')}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/products/sodam-empty.svg"
        alt=""
        width={240}
        height={160}
        className="h-auto w-full max-w-[220px] drop-shadow-sm"
      />
      <h3 className="mt-5 font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * "Chia sẻ sổ" — không còn tài khoản/mời thành viên: gửi link này cho người
 * nhà, mở link là vào thẳng sổ và ghi chung. Link chứa mã sổ nên chỉ chia
 * sẻ cho người trong nhà.
 */
function ShareLinkButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  async function copy() {
    const link = `${window.location.origin}/?code=${encodeURIComponent(inviteCode)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setFallback(null);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard bị chặn (trình duyệt nhúng, quyền) — hiện link để chép tay.
      setFallback(link);
    }
  }

  return (
    <span className="mt-0.5 block">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex min-h-6 items-center gap-1 rounded-md text-[11px] text-[#FAF6EF]/75 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {copied ? <Check className="size-3" /> : <Link2 className="size-3" />}
        {copied ? 'Đã chép link chia sẻ' : 'Chép link chia sẻ cho người nhà'}
      </button>
      {fallback ? (
        <span className="mt-1 block max-w-[240px] truncate font-mono text-[10px] text-[#FAF6EF]/60">
          {fallback}
        </span>
      ) : null}
    </span>
  );
}

export { Camera, Mic, BookOpen, Users };
