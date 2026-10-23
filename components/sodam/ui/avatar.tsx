'use client';

import { useMemo } from 'react';

import { createAvatar } from '@dicebear/core';
import { initials } from '@dicebear/collection';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Avatar người — DiceBear `initials` LOCAL (@dicebear/core +          */
/* @dicebear/collection), sinh 100% tại client, ZERO HTTP: không       */
/* gọi HTTP API bên thứ ba, danh tính không rời thiết bị, offline.     */
/*                                                                     */
/* Điều kiện phiên bản: collection 9.4.2 là styles cho API core 9      */
/* (`createAvatar`); core 10 đã bỏ API đó nên package.json PHẢI ghim   */
/* @dicebear/core ^9.4.3 (đúng bản chiatien đang chạy).                */
/*                                                                     */
/* Bằng chứng đã đọc từ node_modules:                                  */
/* - @dicebear/initials 9.4.2, lib/types.d.ts: Options =               */
/*   { backgroundColor, textColor, fontFamily, fontSize, chars,       */
/*   fontWeight } — KHÔNG có option tách "chữ cái hiển thị" khỏi seed. */
/* - lib/index.js của style: `getInitials(prng.seed.trim())` — glyph   */
/*   CHỈ suy từ seed (từ đơn: 2 cụm ký tự đầu; nhiều từ: ký tự đầu     */
/*   của từ đầu + từ cuối; khớp \p{L}\p{M}* giữ dấu tiếng Việt);       */
/*   màu nền/chữ do prng.pick chọn từ mảng backgroundColor/textColor.  */
/*                                                                     */
/* Phân xử seed/màu (một lời gọi chỉ có MỘT seed cho cả glyph + màu): */
/* - seed truyền vào thư viện = TÊN NGƯỜI THẬT ⇒ glyph đúng chữ cái    */
/*   của người đó (avatar sai chữ cái là lỗi hiển thị trực tiếp).       */
/* - Màu được tách ra ngoài: backgroundColor/textColor truyền mảng    */
/*   ĐÚNG 1 phần tử, chọn bằng hash ổn định của prop `seed` (id        */
/*   thực thể) — prng.pick trên mảng 1 phần tử bị ép cứng, nên sửa    */
/*   tên không đổi màu avatar. Không truyền seed ⇒ hash theo tên.      */
/*                                                                     */
/* Lưu ý: SVG do thư viện sinh có <metadata> chứa chuỗi tĩnh           */
/* attribution CC0 (github.com/dicebear/dicebear, creativecommons) —   */
/* đó là văn bản ghi công trong file, KHÔNG phải tham chiếu mạng:      */
/* SVG-as-image không fetch metadata, không có <image>/href ngoài.     */
/* ------------------------------------------------------------------ */

/** Bảng cặp nền/chữ thuộc hệ chàm redesign — hex KHÔNG '#', theo định dạng DiceBear. */
const AVATAR_TONES = [
  { bg: '161A3D', fg: 'F0F1F8' }, // indigo-950 / indigo-50
  { bg: '1E2456', fg: 'F3E5C3' }, // indigo-900 / gold-soft
  { bg: '323C85', fg: 'F0F1F8' }, // indigo-700 / indigo-50
  { bg: 'F3E5C3', fg: '7A5A14' }, // gold-soft / gold-ink
  { bg: 'F0F1F8', fg: '161A3D' }, // indigo-50 / indigo-950
  { bg: 'B3352C', fg: 'F5F5F7' }, // lacquer (tiết chế) / paper
] as const;

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function toneFromSeed(seed: string, excludeLacquer?: boolean) {
  if (!excludeLacquer) {
    return AVATAR_TONES[hashSeed(seed) % AVATAR_TONES.length]!;
  }
  const pool = AVATAR_TONES.filter((tone) => tone.bg !== 'B3352C');
  return pool[hashSeed(seed) % pool.length]!;
}

/**
 * Viết tắt cho BookAvatar — cùng quy tắc getInitials của DiceBear
 * (1 từ: 2 cụm ký tự đầu; nhiều từ: đầu của từ đầu + từ cuối; rỗng: 'SD').
 */
function initialsOf(name: string) {
  let input = name.trim();
  if (input.includes('@')) input = input.replace(/@.*/, '');
  input = input.replace(/[`´‘’'ʼ]/g, '');
  const matches = input.match(/(\p{L}[\p{L}\p{M}]*)/gu);
  if (!matches || matches.length === 0) return 'SD';
  if (matches.length === 1) {
    const firstTwo = matches[0]!.match(/^(?:\p{L}\p{M}*){1,2}/u);
    return (firstTwo ? firstTwo[0] : matches[0]!.slice(0, 2)).toUpperCase();
  }
  const first = matches[0]!.match(/^(?:\p{L}\p{M}*)/u)?.[0] ?? '';
  const last = matches[matches.length - 1]!.match(/^(?:\p{L}\p{M}*)/u)?.[0] ?? '';
  return (first + last).toUpperCase();
}

const dataUriCache = new Map<string, string>();

/**
 * Sinh avatar initials bằng thư viện DiceBear local — thuần, xác định,
 * không mạng. Glyph suy từ `name` (seed của thư viện); cặp màu nền/chữ
 * suy từ `seed` (id ổn định của thực thể) nếu có, mặc định từ `name`.
 */
export function initialsDataUri(name: string, seed?: string, excludeLacquer?: boolean): string {
  const displayName = name.trim() || 'guest';
  const toneKey = (seed ?? '').trim() || displayName;
  const cacheKey = `${toneKey}|${displayName}|${excludeLacquer ? 'no-lacquer' : 'all'}`;
  const cached = dataUriCache.get(cacheKey);
  if (cached) return cached;

  const tone = toneFromSeed(toneKey, excludeLacquer);
  const uri = createAvatar(initials, {
    seed: displayName,
    backgroundColor: [tone.bg],
    textColor: [tone.fg],
    fontFamily: ['IBM Plex Sans', 'Arial', 'sans-serif'],
    fontSize: 44,
    fontWeight: 700,
  }).toDataUri();
  dataUriCache.set(cacheKey, uri);
  return uri;
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
  const label = initialsOf(name);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(22,26,61,0.18)] ring-1 ring-black/10',
        dim,
        className,
      )}
      style={{ backgroundColor: `#${tone.bg}`, color: `#${tone.fg}` }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="absolute inset-0 size-full opacity-[0.18]" aria-hidden>
        <rect x="6" y="7" width="20" height="18" rx="3" fill="currentColor" />
        <path d="M16 7v18" stroke={`#${tone.bg}`} strokeWidth="1.5" />
      </svg>
      <span className={cn('relative z-[1] font-sans font-semibold tracking-wide', text)}>
        {label}
      </span>
    </span>
  );
}

export function PersonAvatar({
  name,
  size = 'md',
  className,
  seed,
  excludeLacquer,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Id ổn định của người (tuỳ chọn) — ghim màu nền, không ảnh hưởng chữ cái. */
  seed?: string;
  /** Khi true, vòng chọn tone bỏ cặp lacquer (ngữ cảnh tang/giỗ). */
  excludeLacquer?: boolean;
}) {
  const dim =
    size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : size === 'xl' ? 'size-14' : 'size-10';
  const px = size === 'sm' ? 64 : size === 'lg' ? 96 : size === 'xl' ? 112 : 80;
  const uri = useMemo(
    () => initialsDataUri(name, seed, excludeLacquer),
    [name, seed, excludeLacquer],
  );

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
        src={uri}
        alt=""
        width={px}
        height={px}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
