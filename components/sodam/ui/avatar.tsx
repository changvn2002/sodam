'use client';

import { cn } from '@/lib/utils';

/** Bảng màu avatar theo hệ E2 Ngọc + sơn mài — không dùng đen/xám lạnh ngoài hệ. */
function toneFromSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const palettes = [
    { bg: '#07332B', fg: '#E9C87E' },
    { bg: '#B3352C', fg: '#FAF6EF' },
    { bg: '#0E4A3A', fg: '#FAF6EF' },
    { bg: '#F3E5C3', fg: '#7A5A14' },
    { bg: '#8E2A22', fg: '#F3E5C3' },
    { bg: '#FAF6EF', fg: '#07332B' },
  ] as const;
  return palettes[h % palettes.length]!;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SD';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

/**
 * DiceBear initials — clean enterprise people marks (not cartoon faces).
 * @see https://www.dicebear.com/
 */
export function dicebearUrl(seed: string, size = 96) {
  const q = new URLSearchParams({
    seed: seed.trim() || 'guest',
    size: String(size),
    backgroundColor: '07332b,b3352c,f3e5c3,0e4a3a',
    fontSize: '42',
    fontWeight: '600',
  });
  return `https://api.dicebear.com/9.x/initials/svg?${q.toString()}`;
}

/** Book / event mark — monogram + ledger glyph, not a human avatar. */
export function BookAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const dim =
    size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : size === 'xl' ? 'size-14' : 'size-10';
  const text =
    size === 'sm'
      ? 'text-[10px]'
      : size === 'lg'
        ? 'text-sm'
        : size === 'xl'
          ? 'text-base'
          : 'text-xs';
  const tone = toneFromSeed(name.trim() || 'so');
  const label = initials(name);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(4,35,28,0.18)] ring-1 ring-black/10',
        dim,
        className,
      )}
      style={{ backgroundColor: tone.bg, color: tone.fg }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="absolute inset-0 size-full opacity-[0.18]" aria-hidden>
        <rect x="6" y="7" width="20" height="18" rx="3" fill="currentColor" />
        <path d="M16 7v18" stroke={tone.bg} strokeWidth="1.5" />
      </svg>
      <span className={cn('font-serif-vn relative z-[1] font-semibold tracking-wide', text)}>
        {label}
      </span>
    </span>
  );
}

export function PersonAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const dim =
    size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : size === 'xl' ? 'size-14' : 'size-10';
  const px = size === 'sm' ? 64 : size === 'lg' ? 96 : size === 'xl' ? 112 : 80;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full bg-paper shadow-[inset_0_0_0_1px_rgba(16,20,24,0.06)] ring-2 ring-card',
        dim,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dicebearUrl(name, px)}
        alt=""
        width={px}
        height={px}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}
