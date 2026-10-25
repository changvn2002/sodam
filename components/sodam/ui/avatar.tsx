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
/* Điều kiện phiên bản: collection 9.4.3 là styles cho API core 9      */
/* (`createAvatar`); core 10 đã bỏ API đó nên package.json PHẢI ghim   */
/* @dicebear/core ^9.4.3 (đúng bản chiatien đang chạy).                */
/*                                                                     */
/* Bằng chứng đã đọc từ node_modules:                                  */
/* - @dicebear/initials 9.4.3, lib/types.d.ts: Options =               */
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

/**
 * Bảng cặp nền/chữ thuộc hệ chàm redesign — hex KHÔNG '#', theo định dạng DiceBear.
 *
 * Panel #02 / T-02 (2026-10-23): đỏ sơn mài `B3352C` bị PURGE khỏi toàn bộ
 * lớp identity — palette này không còn bất kỳ tone đỏ nào, và màu của một
 * người CHỈ suy từ seed của chính người đó (không còn biến thể theo ngữ
 * cảnh route như tham số excludeLacquer trước đây: cùng một người từng có
 * 2 fill khác nhau theo trang, và khách tang/giỗ nhận đúng hex sơn mài đã
 * khai tử trên các bề mặt cấp sổ). Ngữ cảnh tang/giỗ bám theo THỰC THỂ —
 * avatar người viếng tang phải trang trọng ở mọi bề mặt, kể cả Tổng quan.
 */
const AVATAR_TONES = [
  // B′ «Trang Sổ Kẻ» (2026-10-24): initials NÉP vào thế giới sổ — toàn xám
  // trung tính Primer, cỡ khiêm tốn; 0 màu bản sắc, 0 vàng, 0 chàm. Màu vẫn
  // CHỈ suy từ seed của chính người đó (ổn định mọi bề mặt, kể cả tang/giỗ).
  { bg: 'ECEFF2', fg: '454C54' },
  { bg: 'E4E8EC', fg: '1F2328' },
  { bg: 'F6F8FA', fg: '59636E' },
  { bg: 'D8DEE4', fg: '1F2328' },
  { bg: '59636E', fg: 'FFFFFF' },
] as const;

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * W3-4 (Recheck R2, ghế 4 mục 7): KHOÁ DANH TÍNH cho tông avatar.
 * Kiểm chứng trên render thật + pixel của pack round-2 (probe-r3.cjs):
 * tông của Chị Lan đã là #D8DEE4 KHỚP NHAU ở people/tree, cả 390 lẫn
 * 1440 — không có trôi tông thật trong code hiện tại. Nguy cơ duy nhất
 * còn lại đúng như ghế nghi: BIẾN THỂ CHUỖI TÊN hiển thị (thừa khoảng
 * trắng, dạng tổ hợp NFD thay vì NFC, giãn cách giữa các từ) làm hash
 * lệch và đổi tông cùng một người. Mọi khoá danh tính (seed của thư
 * viện + khoá tông) đều đi qua hàm chuẩn hoá này trước: NFC, cắt
 * khoảng đầu/cuối, gộp mọi dãy khoảng trắng thành một — cùng một
 * người, mọi biến thể chuỗi đều cho đúng một tông/một glyph.
 */
export function normalizePersonKey(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Màu avatar = hàm thuần của seed người đó — ổn định ở mọi bề mặt/ngữ cảnh. */
function toneFromSeed(seed: string) {
  return AVATAR_TONES[hashSeed(seed) % AVATAR_TONES.length]!;
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
export function initialsDataUri(name: string, seed?: string): string {
  // W3-4: cả tên (glyph) lẫn seed (tông) đều chuẩn hoá danh tính trước
  // khi băm — biến thể chuỗi của cùng một người không đổi tông/glyph.
  const displayName = normalizePersonKey(name) || 'guest';
  const toneKey = normalizePersonKey(seed ?? '') || displayName;
  const cacheKey = `${toneKey}|${displayName}`;
  const cached = dataUriCache.get(cacheKey);
  if (cached) return cached;

  const tone = toneFromSeed(toneKey);
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
  const tone = toneFromSeed(normalizePersonKey(name) || 'so');
  const label = initialsOf(name);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[7px] shadow-[inset_0_0_0_1px_rgba(31,35,40,0.18)] ring-1 ring-black/10',
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
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Id ổn định của người (tuỳ chọn) — ghim màu nền, không ảnh hưởng chữ cái. */
  seed?: string;
}) {
  const dim =
    size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : size === 'xl' ? 'size-14' : 'size-10';
  const px = size === 'sm' ? 64 : size === 'lg' ? 96 : size === 'xl' ? 112 : 80;
  // F8 (Panel R1, ghế 4): cùng một người phải GIỐNG HỆT ở mọi bề mặt và
  // mọi khổ — tông màu khoá theo TÊN HIỂN THỊ (thứ mắt người dùng đối
  // chiếu), không theo id ngẫu nhiên của bản ghi: id đổi theo lần tạo dữ
  // liệu khiến cùng một người lệch tông giữa các ảnh/màn. Hàm thuần
  // initialsDataUri vẫn giữ cơ chế seed cho kiểm thử; lớp UI ghim seed
  // bằng chính tên người. Đánh đổi ghi nhận: hai người trùng hệt tên
  // hiển thị sẽ cùng tông (chữ tắt vốn cũng đã trùng hệt).
  // W3-4 (Recheck R2): khoá này nay đi qua normalizePersonKey bên trong
  // initialsDataUri (NFC + gộp khoảng trắng) — biến thể chuỗi của cùng
  // một người không còn đường nào làm trôi tông nữa.
  void seed;
  const uri = useMemo(() => initialsDataUri(name, name), [name]);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full bg-paper shadow-[inset_0_0_0_1px_rgba(16,20,24,0.06)] ring-2 ring-card',
        dim,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- src là data-URI do DiceBear sinh tại client (@dicebear/core, deterministic seed); next/image không áp dụng được cho data-URI động */}
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
