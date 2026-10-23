import type { ReactNode } from 'react';
import type { SodamEventKind } from '../api/types';
import { groupOfKind, type LexiconGroup } from '../lib/lexicon';

/**
 * Icon nét vẽ tay — SVG stroke currentColor, không dùng icon hộp quà
 * (Gift) cho bất kỳ nhóm/loại nào (V-5).
 *
 * Panel #02 mục 3 (P1): trước đây icon theo NHÓM giọng khiến 9/13 loại đám
 * dùng chung một phong bì, và nhóm trang trọng (tang) vẽ nguyên hình mặt
 * trời của Lucide (vòng tròn + 8 tia). Nay mỗi LOẠI đám có glyph riêng đúng
 * ngữ cảnh: tang = bát hương, giỗ giữ nến (đã đúng mẫu), cưới = nhẫn đôi,
 * ăn hỏi = nhẫn đính đá, mừng tuổi = bao lì xì có đồng xu (vật thật của
 * loại này — không phải phong bì generic), thôi nôi = lục lạc, đầy tháng =
 * trăng sao, tân gia = nhà, khai trương = mặt tiền cửa hàng, sinh nhật =
 * bánh kem, tốt nghiệp = mũ cử nhân, mừng thọ = quả đào tiên, khác = sổ tay.
 */

/** Bát hương ba nén — glyph trang trọng dùng chung cho nhóm solemn/loại MA. */
const INCENSE_PATH = (
  <>
    <path d="M9 8.4c-.9-1.4.9-2.1 0-3.6" />
    <path d="M15 8.4c-.9-1.4.9-2.1 0-3.6" />
    <line x1="9" y1="9.2" x2="9" y2="13.5" />
    <line x1="12" y1="8.6" x2="12" y2="13.5" />
    <line x1="15" y1="9.2" x2="15" y2="13.5" />
    <path d="M4.5 13.5h15a7.5 5.6 0 0 1-15 0Z" />
    <line x1="9" y1="21.6" x2="15" y2="21.6" />
  </>
);
const GROUP_PATHS: Record<LexiconGroup, ReactNode> = {
  celebratory: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <polyline points="3,7 12,13 21,7" />
    </>
  ),
  solemn: INCENSE_PATH,
  memorial: (
    <>
      <path d="M9 8 C 8 6, 10 5, 9 3" />
      <path d="M15 8 C 14 6, 16 5, 15 3" />
      <line x1="8" y1="10" x2="8" y2="17" />
      <line x1="12" y1="10" x2="12" y2="17" />
      <line x1="16" y1="10" x2="16" y2="17" />
      <line x1="5" y1="19" x2="19" y2="19" />
    </>
  ),
  longevity: (
    <>
      <path d="M5 19 C 8 14, 12 10, 18 6" />
      <circle cx="13" cy="10" r="2" />
      <circle cx="17" cy="8" r="2" />
      <path d="M9 14 C 7 12, 6.5 9.5, 7 7 C 9.5 7.5, 10.5 10, 9 14" />
    </>
  ),
  neutral: (
    <>
      <rect x="6" y="3" width="13" height="18" rx="2" />
      <line x1="9.5" y1="3" x2="9.5" y2="21" />
      <line x1="12.5" y1="9" x2="16.5" y2="9" />
      <line x1="12.5" y1="13" x2="16.5" y2="13" />
    </>
  ),
};

const KIND_PATHS: Partial<Record<SodamEventKind, ReactNode>> = {
  // Cưới — hai chiếc nhẫn lồng nhau.
  CUOI: (
    <>
      <circle cx="9" cy="14.5" r="5.5" />
      <circle cx="15" cy="9.5" r="5.5" />
    </>
  ),
  // Ăn hỏi — nhẫn đính đá.
  DAM_HOI: (
    <>
      <path d="M12 2.6 14.3 5.3 12 8 9.7 5.3 12 2.6Z" />
      <circle cx="12" cy="14.6" r="5.2" />
    </>
  ),
  // Tang — bát hương ba nén, khói nhang (thay glyph mặt trời của Lucide).
  MA: INCENSE_PATH,
  // Giỗ — nến trên đài (giữ nguyên mẫu panel đã duyệt).
  GIO: GROUP_PATHS.memorial,
  // Mừng thọ — quả đào tiên (vật biểu trưng mừng thọ).
  // B8 (Panel #03 / R1): glyph cành đào cũ (cành chéo + 2 vòng tròn) đọc
  // như chiếc chìa khoá ở cỡ chip — thay bằng quả đào: thân quả có rãnh
  // dọc + cuống lá ở đỉnh, cùng kỷ luật stroke/viewBox với 13 chip.
  MUNG_THO: (
    <>
      <path d="M12 21C7.2 17.2 4.8 13.6 4.8 10.2 4.8 7.1 7.2 5.2 9.7 5.8c.9-.9 3.7-.9 4.6 0 2.5-.6 4.9 1.3 4.9 4.4 0 3.4-2.4 7-7.2 10.8Z" />
      <path d="M12 5.9c-.8 2.5-.8 5.2 0 7.9" />
      <path d="M12.9 4.9c.4-1.7 1.8-2.8 3.8-3 .1 2-1.1 3.3-3 3.6" />
    </>
  ),
  // Thôi nôi — lục lạc trẻ nhỏ: đầu tròn có vòng trong + bi, tay cầm xiên
  // có hai ngấn nắm. B8: bản cũ (tròn + que thẳng + 2 chấm) mơ hồ; bản này
  // thêm vòng trong/bi/tay cầm xiên có ngấn để đọc ra lục lạc ngay ở cỡ chip.
  THOI_NOI: (
    <>
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="2.4" />
      <circle cx="7.6" cy="6.8" r="0.4" fill="currentColor" />
      <path d="M14.3 14.3 20.2 20.2" />
      <path d="M15.9 18.1l2.3-2.3M18 20.2l2.3-2.3" />
    </>
  ),
  // Đầy tháng — trăng lưỡi liềm + sao.
  DAY_THANG: (
    <>
      <path d="M20 15.2A8.2 8.2 0 1 1 8.8 4a6.8 6.8 0 0 0 11.2 11.2Z" />
      <path d="M17.6 3.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" />
    </>
  ),
  // Tân gia — mái nhà.
  TAN_GIA: (
    <>
      <path d="M4 11.2 12 4l8 7.2" />
      <path d="M6.3 9.4V20h11.4V9.4" />
      <path d="M10.2 20v-4.8h3.6V20" />
    </>
  ),
  // Khai trương — mặt tiền cửa hàng có mái che.
  KHAI_TRUONG: (
    <>
      <path d="M4.2 8.6 5.8 4h12.4l1.6 4.6" />
      <path d="M4.2 8.6a1.95 1.95 0 0 0 3.9 0 1.95 1.95 0 0 0 3.9 0 1.95 1.95 0 0 0 3.9 0 1.95 1.95 0 0 0 3.9 0" />
      <path d="M5.8 12.4V20h12.4v-7.6" />
      <path d="M10 20v-4.4h4V20" />
    </>
  ),
  // Sinh nhật — bánh kem một nến.
  SINH_NHAT: (
    <>
      <path d="M12 3.8c1.1 1.3 1.2 2.5 0 3.6-1.2-1.1-1.1-2.3 0-3.6Z" />
      <line x1="12" y1="8.8" x2="12" y2="13.2" />
      <rect x="4.5" y="13.2" width="15" height="6.3" rx="1.2" />
      <path d="M4.5 16.4h15" />
      <path d="M3.5 21h17" />
    </>
  ),
  // Mừng tuổi — bao lì xì có đồng xu (vật thật của mừng tuổi đầu năm).
  MUNG_TUOI: (
    <>
      <rect x="5.5" y="3" width="13" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.8" />
      <path d="M8.5 16.6h7" />
    </>
  ),
  // Tốt nghiệp — mũ cử nhân.
  TOT_NGHIEP: (
    <>
      <path d="M12 5 22 9.5 12 14 2 9.5 12 5Z" />
      <path d="M6.3 11.6v4.2c0 1.5 11.4 1.5 11.4 0v-4.2" />
      <path d="M22 9.5v5.5" />
    </>
  ),
  // Khác — sổ tay.
  KHAC: GROUP_PATHS.neutral,
};

function IconShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function GroupIcon({ group, className }: { group: LexiconGroup; className?: string }) {
  return <IconShell className={className}>{GROUP_PATHS[group]}</IconShell>;
}

export function KindIcon({
  kind,
  className,
}: {
  kind: SodamEventKind | string | null | undefined;
  className?: string;
}) {
  const perKind = KIND_PATHS[kind as SodamEventKind];
  if (perKind) return <IconShell className={className}>{perKind}</IconShell>;
  return <GroupIcon group={groupOfKind(kind)} className={className} />;
}
