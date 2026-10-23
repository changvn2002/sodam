import type { SodamEventKind } from '../api/types';

/**
 * Từ vựng theo loại đám (panel ST-5 / P0.4): đám tang và đám giỗ không dùng
 * chữ của đám hỷ. Mọi bề mặt hiển thị theo loại đám (thẻ tổng, form ghi
 * khoản, header đám, trả lễ) phải lấy chữ từ đây — không tự chế nhãn.
 */
export type LexiconGroup = 'celebratory' | 'solemn' | 'memorial' | 'neutral';

const GROUP_BY_KIND: Record<SodamEventKind, LexiconGroup> = {
  CUOI: 'celebratory',
  DAM_HOI: 'celebratory',
  MUNG_THO: 'celebratory',
  THOI_NOI: 'celebratory',
  DAY_THANG: 'celebratory',
  TAN_GIA: 'celebratory',
  KHAI_TRUONG: 'celebratory',
  SINH_NHAT: 'celebratory',
  MUNG_TUOI: 'celebratory',
  TOT_NGHIEP: 'celebratory',
  MA: 'solemn',
  GIO: 'memorial',
  KHAC: 'neutral',
};

export type EventLexicon = {
  group: LexiconGroup;
  /** Nhãn ô tổng của đám: "Tổng mừng" / "Tổng phúng viếng" / "Tổng tiền nhận". */
  totalLabel: string;
  /** Cách gọi người ghi khoản: "Khách mừng" / "Người viếng" / … */
  personLabel: string;
  /** Danh từ của khoản tiền: "tiền mừng" / "tiền phúng viếng" / "tiền lễ". */
  entryNoun: string;
  /** Nhãn trường tên trong form ghi khoản. */
  nameFieldLabel: string;
  /** Tiêu đề trạng thái trống của sổ khoản. */
  emptyTitle: string;
  /** Câu trạng thái trống của sổ khoản. */
  emptyBody: string;
};

const LEXICONS: Record<LexiconGroup, Omit<EventLexicon, 'group'>> = {
  celebratory: {
    totalLabel: 'Tổng mừng',
    personLabel: 'Khách mừng',
    entryNoun: 'tiền mừng',
    nameFieldLabel: 'Tên khách mừng',
    emptyTitle: 'Chưa có khách nào',
    emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên của đám này.',
  },
  solemn: {
    totalLabel: 'Tổng phúng viếng',
    personLabel: 'Người viếng',
    entryNoun: 'tiền phúng viếng',
    nameFieldLabel: 'Tên người viếng',
    emptyTitle: 'Chưa có người viếng nào',
    emptyBody: 'Bấm Ghi khoản để ghi người viếng đầu tiên.',
  },
  memorial: {
    totalLabel: 'Tổng tiền nhận',
    personLabel: 'Khách đến dự',
    entryNoun: 'tiền lễ',
    nameFieldLabel: 'Tên khách đến dự',
    emptyTitle: 'Chưa có khách nào',
    emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên của đám này.',
  },
  neutral: {
    totalLabel: 'Tổng tiền nhận',
    personLabel: 'Người ghi',
    entryNoun: 'tiền lễ',
    nameFieldLabel: 'Tên người ghi',
    emptyTitle: 'Chưa có khoản nào',
    emptyBody: 'Bấm Ghi khoản để ghi khoản đầu tiên của đám này.',
  },
};

export function lexiconForKind(kind: SodamEventKind | string | null | undefined): EventLexicon {
  const group = (kind && GROUP_BY_KIND[kind as SodamEventKind]) || 'neutral';
  return { group, ...LEXICONS[group] };
}

/** Nhãn nguồn ghi khoản bằng tiếng người dùng — không bao giờ render enum thô. */
export const ENTRY_SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Ghi tay',
  VOICE: 'Ghi miệng',
  PHOTO: 'Chụp ảnh',
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'Ghi tay';
  return ENTRY_SOURCE_LABELS[source] ?? 'Ghi tay';
}
