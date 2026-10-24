'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './avatar';

/**
 * Một dòng sổ cái: avatar + tên + meta trái, số tiền Mono căn phải.
 * Số tiền không bọc pill — cột số phải thẳng hàng để mắt quét dọc là cộng được.
 *
 * W3-2 (Recheck R2, ghế 4 M-1): ở khổ hẹp (390) hàng KHÔNG còn ép bốn
 * cột ngang (avatar · tên · tiền · trạng thái) — tên người bị bẻ giữa
 * tên («Bác / Bảy») và tên đám xếp tháp 4 dòng trong cột chưa tới 1/4
 * màn. Cấu trúc mới theo LƯỚI: hàng 1 = avatar + tên/meta TRỌN bề
 * ngang còn lại; hàng 2 (chỉ ở khổ hẹp) = tiền + trạng thái nằm dưới
 * cụm tên. Từ sm trở lên trở lại một hàng ngang như cũ.
 */
export function LedgerRow({
  name,
  personId,
  amountLabel,
  meta,
  trailing,
  onClick,
}: {
  name: string;
  /** Id người (khi có) — truyền làm seed cho avatar để màu/hình ổn định. */
  personId?: string;
  amountLabel: string;
  meta?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const className = cn(
    'grid min-h-[52px] w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-left transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-y-0',
    onClick &&
      'hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset',
  );

  const body = (
    <>
      <PersonAvatar name={name} seed={personId} size="md" className="relative z-[1]" />
      <span className="min-w-0">
        {/* D-4 / B4 (Panel #03 R5): họ tên là khoá đối chiếu trang trọng —
            KHÔNG ellipsis tên để nhường số tiền/chip. Tên dài WRAP xuống
            dòng (overflow-wrap:anywhere cho tên không khoảng trắng), số
            tiền và chip giữ nguyên kích thước (shrink-0).
            W3-2: ở 390 cụm tên nay có TRỌN bề ngang hàng (tiền/trạng
            thái đã xuống hàng dưới) nên tên hai từ như «Bác Bảy» nằm
            nguyên một dòng, không bẻ giữa tên. */}
        <span className="block text-[15px] leading-snug font-medium [overflow-wrap:anywhere] text-ink">
          {name}
        </span>
        {/* F2 (Panel R1): meta là TÊN ĐÁM — ở danh sách Chờ trả lễ tên đám
            (đặc biệt tên người mất) phải WRAP TRỌN, không «…»: hai khoản
            cùng người/cùng tiền chỉ phân biệt được nhờ tên đám này.
            W3-2: meta bẻ dòng theo TỪ (break-words), không bẻ giữa từ
            bằng anywhere — hết tháp chữ một-từ-một-dòng. */}
        {meta ? (
          <span className="mt-0.5 block text-xs leading-snug break-words text-muted">{meta}</span>
        ) : null}
      </span>
      {/* W3-2: tiền + trạng thái là MỘT cụm — ở 390 nằm ở hàng 2 dưới
          cụm tên (cột 2 của lưới), từ sm trở lên về cột phải cùng hàng. */}
      <span className="col-start-2 flex items-center gap-3 sm:col-start-3 sm:justify-self-end">
        <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-ink">
          {amountLabel}
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}
