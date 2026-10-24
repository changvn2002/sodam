import type { SodamEventKind, SodamRelationType } from '../api/types';

/**
 * Từ vựng theo loại đám (panel ST-5 / REDESIGN-V2 §3): đám tang và đám giỗ
 * không dùng chữ của đám hỷ. Mọi bề mặt hiển thị theo loại đám (thẻ tổng,
 * form ghi khoản, header đám, trả lễ) phải lấy chữ từ đây — không tự chế nhãn.
 */
export type LexiconGroup = 'celebratory' | 'solemn' | 'memorial' | 'longevity' | 'neutral';

const GROUP_BY_KIND: Record<SodamEventKind, LexiconGroup> = {
  CUOI: 'celebratory',
  DAM_HOI: 'celebratory',
  THOI_NOI: 'celebratory',
  DAY_THANG: 'celebratory',
  TAN_GIA: 'celebratory',
  KHAI_TRUONG: 'celebratory',
  SINH_NHAT: 'celebratory',
  TOT_NGHIEP: 'celebratory',
  MUNG_TUOI: 'celebratory',
  MA: 'solemn',
  GIO: 'memorial',
  MUNG_THO: 'longevity',
  KHAC: 'neutral',
};

export type EventLexicon = {
  group: LexiconGroup;
  totalLabel: string;
  entryNoun: string;
  personLabel: string;
  entryVerb: string;
  nameFieldLabel: string;
  amountFieldLabel: string;
  paidLabel: string;
  goVerb: string;
  emptyTitle: string;
  emptyBody: string;
  saveLabel: string;
  searchPlaceholder: string;
  reviewNoun: string;
  savedToast: (name: string) => string;
};

const LEXICONS: Record<LexiconGroup, Omit<EventLexicon, 'group'>> = {
  celebratory: {
    totalLabel: 'Tổng mừng',
    entryNoun: 'tiền mừng',
    personLabel: 'Khách mừng',
    entryVerb: 'Ghi khoản mừng',
    nameFieldLabel: 'Tên khách mừng',
    amountFieldLabel: 'Số tiền mừng',
    paidLabel: 'đã trả',
    goVerb: 'đi mừng',
    emptyTitle: 'Chưa có khách nào',
    emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên của đám này.',
    saveLabel: 'Lưu khoản mừng',
    searchPlaceholder: 'Tìm khách mừng…',
    reviewNoun: 'tiền mừng',
    savedToast: (name: string) => `Đã ghi khoản mừng cho ${name}.`,
  },
  solemn: {
    totalLabel: 'Tổng phúng viếng',
    entryNoun: 'tiền phúng viếng',
    personLabel: 'Người viếng',
    entryVerb: 'Ghi khoản phúng viếng',
    nameFieldLabel: 'Tên người viếng',
    amountFieldLabel: 'Số tiền phúng viếng',
    paidLabel: 'đã đi lại',
    goVerb: 'đi viếng',
    emptyTitle: 'Chưa có người viếng nào',
    emptyBody: 'Bấm Ghi khoản để ghi người viếng đầu tiên.',
    saveLabel: 'Lưu khoản phúng viếng',
    searchPlaceholder: 'Tìm người viếng…',
    reviewNoun: 'tiền phúng viếng',
    savedToast: (name: string) => `Đã ghi khoản phúng viếng cho ${name}.`,
  },
  memorial: {
    totalLabel: 'Tổng tiền nhận',
    entryNoun: 'tiền lễ',
    personLabel: 'Khách đến dự',
    entryVerb: 'Ghi khoản lễ',
    nameFieldLabel: 'Tên khách đến dự',
    amountFieldLabel: 'Số tiền lễ',
    paidLabel: 'đã đi lại',
    goVerb: 'đi lễ',
    emptyTitle: 'Chưa có khách nào',
    emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên của đám này.',
    saveLabel: 'Lưu khoản lễ',
    searchPlaceholder: 'Tìm khách đến dự…',
    reviewNoun: 'tiền lễ',
    savedToast: (name: string) => `Đã ghi khoản lễ cho ${name}.`,
  },
  longevity: {
    totalLabel: 'Tổng mừng thọ',
    entryNoun: 'tiền mừng thọ',
    personLabel: 'Khách mừng thọ',
    entryVerb: 'Ghi khoản mừng thọ',
    nameFieldLabel: 'Tên khách mừng thọ',
    amountFieldLabel: 'Số tiền mừng thọ',
    paidLabel: 'đã trả',
    goVerb: 'đi mừng thọ',
    emptyTitle: 'Chưa có khách nào',
    emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên.',
    saveLabel: 'Lưu khoản mừng thọ',
    searchPlaceholder: 'Tìm khách mừng thọ…',
    reviewNoun: 'tiền mừng thọ',
    savedToast: (name: string) => `Đã ghi khoản mừng thọ cho ${name}.`,
  },
  neutral: {
    totalLabel: 'Tổng tiền nhận',
    entryNoun: 'tiền lễ',
    personLabel: 'Người ghi',
    entryVerb: 'Ghi khoản',
    nameFieldLabel: 'Tên người ghi',
    amountFieldLabel: 'Số tiền',
    paidLabel: 'đã trả',
    goVerb: 'đi lễ',
    emptyTitle: 'Chưa có khoản nào',
    emptyBody: 'Bấm Ghi khoản để ghi khoản đầu tiên.',
    saveLabel: 'Lưu khoản',
    searchPlaceholder: 'Tìm người ghi…',
    reviewNoun: '',
    savedToast: (name: string) => `Đã ghi khoản cho ${name}.`,
  },
};

export function groupOfKind(kind: SodamEventKind | string | null | undefined): LexiconGroup {
  if (!kind) return 'neutral';
  return GROUP_BY_KIND[kind as SodamEventKind] ?? 'neutral';
}

export function lexiconForKind(kind: SodamEventKind | string | null | undefined): EventLexicon {
  const group = groupOfKind(kind);
  return { group, ...LEXICONS[group] };
}

export const GROUP_STYLE: Record<
  LexiconGroup,
  { selectedChip: string; softBg: string; accentText: string; dot: string }
> = {
  // B′ «Trang Sổ Kẻ»: phân biệt hỷ/tang bằng CÓ/KHÔNG accent + giọng chữ —
  // KHÔNG màu thứ hai. Chip đang chọn ở MỌI nhóm = mực đen (nút chính = mực);
  // accent #0969DA (indigo-700 sau remap) chỉ sống ở dot/kicker nhóm HỶ và
  // vai link/focus/chọn. Tang (solemn) + giỗ (memorial): 0 accent tuyệt đối —
  // dot, chữ nhấn đều xám mực trung tính; softBg = trắng (paper = #FFFFFF).
  celebratory: {
    selectedChip: 'border-ink bg-ink text-white',
    softBg: 'bg-card',
    accentText: 'text-indigo-700',
    dot: 'bg-indigo-700',
  },
  solemn: {
    selectedChip: 'border-ink bg-ink text-white',
    softBg: 'bg-card',
    accentText: 'text-solemn-700',
    dot: 'bg-solemn-700',
  },
  memorial: {
    selectedChip: 'border-ink bg-ink text-white',
    softBg: 'bg-card',
    accentText: 'text-memorial-700',
    dot: 'bg-memorial-700',
  },
  longevity: {
    selectedChip: 'border-ink bg-ink text-white',
    softBg: 'bg-card',
    accentText: 'text-gold-ink',
    dot: 'bg-gold-ink',
  },
  neutral: {
    selectedChip: 'border-ink bg-ink text-white',
    softBg: 'bg-card',
    accentText: 'text-muted',
    dot: 'bg-muted',
  },
};

export function relationOrderForGroup(group: LexiconGroup): SodamRelationType[] {
  if (group === 'solemn' || group === 'memorial') {
    return ['PARENT', 'CHILD', 'SIBLING', 'SPOUSE', 'OTHER'];
  }
  return ['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'OTHER'];
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
