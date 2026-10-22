import { SodamEventKind } from '@prisma/client';

/**
 * Danh sách loại đám của Sổ Đám — nguồn sự thật phía server.
 * Phải khớp 1-1 với enum `SodamEventKind` trong `server/prisma/schema.prisma`;
 * `satisfies` bên dưới khiến typecheck báo lỗi ngay nếu hai bên lệch nhau.
 * Nhãn hiển thị phía client do client tự quản lý theo danh sách này.
 */
export const SODAM_EVENT_KINDS = [
  'CUOI',
  'DAM_HOI',
  'MA',
  'GIO',
  'MUNG_THO',
  'THOI_NOI',
  'DAY_THANG',
  'TAN_GIA',
  'KHAI_TRUONG',
  'SINH_NHAT',
  'MUNG_TUOI',
  'TOT_NGHIEP',
  'KHAC',
] as const satisfies readonly SodamEventKind[];

/** Nhãn tiếng Việt dùng phía server (export, thống kê, thông báo). */
export const SODAM_EVENT_KIND_LABELS_VI: Record<SodamEventKind, string> = {
  CUOI: 'Đám cưới',
  DAM_HOI: 'Đám hỏi',
  MA: 'Đám tang',
  GIO: 'Đám giỗ',
  MUNG_THO: 'Mừng thọ',
  THOI_NOI: 'Thôi nôi',
  DAY_THANG: 'Đầy tháng',
  TAN_GIA: 'Tân gia',
  KHAI_TRUONG: 'Khai trương',
  SINH_NHAT: 'Sinh nhật',
  MUNG_TUOI: 'Mừng tuổi / lì xì',
  TOT_NGHIEP: 'Tốt nghiệp',
  KHAC: 'Khác',
};

export function sodamEventKindLabelVi(kind: SodamEventKind): string {
  return SODAM_EVENT_KIND_LABELS_VI[kind];
}
