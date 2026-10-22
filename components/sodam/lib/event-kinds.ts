/**
 * Taxonomy loại sự kiện (đám) của Sổ Đám — theo văn hoá Việt.
 * Nguồn chốt: docs/VIET-CULTURE.md. Server enum sẽ mở rộng khớp danh sách này.
 *
 * Thứ tự trong EVENT_KIND_ORDER là thứ tự hiển thị gợi ý trên UI
 * (đám vui / hay gặp trước, đám tang đặt giữa danh sách, Khác cuối cùng).
 */

export const EVENT_KIND_LABELS: Record<string, string> = {
  CUOI: 'Đám cưới',
  DAM_HOI: 'Đám hỏi',
  MUNG_THO: 'Mừng thọ',
  THOI_NOI: 'Thôi nôi',
  DAY_THANG: 'Đầy tháng',
  TAN_GIA: 'Tân gia',
  KHAI_TRUONG: 'Khai trương',
  SINH_NHAT: 'Sinh nhật',
  TOT_NGHIEP: 'Tốt nghiệp',
  MUNG_TUOI: 'Mừng tuổi / lì xì',
  GIO: 'Đám giỗ',
  MA: 'Đám tang',
  KHAC: 'Khác',
};

import type { SodamEventKind } from '../api/types';

export const EVENT_KIND_ORDER: SodamEventKind[] = [
  'CUOI',
  'DAM_HOI',
  'MUNG_THO',
  'THOI_NOI',
  'DAY_THANG',
  'TAN_GIA',
  'KHAI_TRUONG',
  'SINH_NHAT',
  'TOT_NGHIEP',
  'MUNG_TUOI',
  'GIO',
  'MA',
  'KHAC',
];

/** Nhãn hiển thị của một loại đám; kind lạ/null trả về 'Khác'. */
export function kindLabel(kind: string | null | undefined): string {
  if (!kind) return EVENT_KIND_LABELS.KHAC;
  return EVENT_KIND_LABELS[kind] ?? EVENT_KIND_LABELS.KHAC;
}
