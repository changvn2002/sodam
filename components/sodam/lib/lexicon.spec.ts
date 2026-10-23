import { describe, expect, it } from 'vitest';

import type { SodamEventKind } from '../api/types';
import {
  GROUP_STYLE,
  groupOfKind,
  lexiconForKind,
  relationOrderForGroup,
  type EventLexicon,
  type LexiconGroup,
} from './lexicon';

const KIND_TO_GROUP: Array<[SodamEventKind, LexiconGroup]> = [
  ['CUOI', 'celebratory'],
  ['DAM_HOI', 'celebratory'],
  ['THOI_NOI', 'celebratory'],
  ['DAY_THANG', 'celebratory'],
  ['TAN_GIA', 'celebratory'],
  ['KHAI_TRUONG', 'celebratory'],
  ['SINH_NHAT', 'celebratory'],
  ['TOT_NGHIEP', 'celebratory'],
  ['MUNG_TUOI', 'celebratory'],
  ['MA', 'solemn'],
  ['GIO', 'memorial'],
  ['MUNG_THO', 'longevity'],
  ['KHAC', 'neutral'],
];

const REPRESENTATIVE_KIND: Record<LexiconGroup, SodamEventKind> = {
  celebratory: 'CUOI',
  solemn: 'MA',
  memorial: 'GIO',
  longevity: 'MUNG_THO',
  neutral: 'KHAC',
};

function staticStrings(lex: EventLexicon): string[] {
  return [
    lex.totalLabel,
    lex.entryNoun,
    lex.personLabel,
    lex.entryVerb,
    lex.nameFieldLabel,
    lex.amountFieldLabel,
    lex.paidLabel,
    lex.goVerb,
    lex.emptyTitle,
    lex.emptyBody,
    lex.saveLabel,
    lex.searchPlaceholder,
    lex.reviewNoun,
  ];
}

describe('lexicon — 13 kind → nhóm giọng', () => {
  it('ánh xạ đủ 13 kind', () => {
    expect(KIND_TO_GROUP).toHaveLength(13);
    for (const [kind, group] of KIND_TO_GROUP) {
      expect(groupOfKind(kind)).toBe(group);
      expect(lexiconForKind(kind).group).toBe(group);
    }
  });

  it('MUNG_THO tách khỏi celebratory thành longevity', () => {
    expect(groupOfKind('MUNG_THO')).toBe('longevity');
    expect(lexiconForKind('MUNG_THO').group).toBe('longevity');
  });

  it('kind lạ / null / undefined → neutral', () => {
    expect(groupOfKind('KHONG_CO')).toBe('neutral');
    expect(groupOfKind(null)).toBe('neutral');
    expect(groupOfKind(undefined)).toBe('neutral');
    expect(lexiconForKind(null).group).toBe('neutral');
    expect(lexiconForKind(undefined).group).toBe('neutral');
  });
});

describe('lexicon — giá trị normative của 5 nhóm', () => {
  it('celebratory', () => {
    const lex = lexiconForKind('CUOI');
    expect(lex.totalLabel).toBe('Tổng mừng');
    expect(lex.personLabel).toBe('Khách mừng');
    expect(lex.entryNoun).toBe('tiền mừng');
    expect(lex.entryVerb).toBe('Ghi khoản mừng');
    expect(lex.saveLabel).toBe('Lưu khoản mừng');
    expect(lex.searchPlaceholder).toBe('Tìm khách mừng…');
    expect(lex.amountFieldLabel).toBe('Số tiền mừng');
  });

  it('solemn', () => {
    const lex = lexiconForKind('MA');
    expect(lex.totalLabel).toBe('Tổng phúng viếng');
    expect(lex.personLabel).toBe('Người viếng');
    expect(lex.entryNoun).toBe('tiền phúng viếng');
    expect(lex.entryVerb).toBe('Ghi khoản phúng viếng');
    expect(lex.saveLabel).toBe('Lưu khoản phúng viếng');
    expect(lex.searchPlaceholder).toBe('Tìm người viếng…');
    expect(lex.amountFieldLabel).toBe('Số tiền phúng viếng');
  });

  it('memorial', () => {
    const lex = lexiconForKind('GIO');
    expect(lex.totalLabel).toBe('Tổng tiền nhận');
    expect(lex.personLabel).toBe('Khách đến dự');
    expect(lex.entryNoun).toBe('tiền lễ');
    expect(lex.entryVerb).toBe('Ghi khoản lễ');
    expect(lex.saveLabel).toBe('Lưu khoản lễ');
    expect(lex.searchPlaceholder).toBe('Tìm khách đến dự…');
    expect(lex.amountFieldLabel).toBe('Số tiền lễ');
  });

  it('longevity', () => {
    const lex = lexiconForKind('MUNG_THO');
    expect(lex.totalLabel).toBe('Tổng mừng thọ');
    expect(lex.personLabel).toBe('Khách mừng thọ');
    expect(lex.entryNoun).toBe('tiền mừng thọ');
    expect(lex.entryVerb).toBe('Ghi khoản mừng thọ');
    expect(lex.saveLabel).toBe('Lưu khoản mừng thọ');
    expect(lex.searchPlaceholder).toBe('Tìm khách mừng thọ…');
    expect(lex.amountFieldLabel).toBe('Số tiền mừng thọ');
  });

  it('neutral', () => {
    const lex = lexiconForKind('KHAC');
    expect(lex.totalLabel).toBe('Tổng tiền nhận');
    expect(lex.personLabel).toBe('Người ghi');
    expect(lex.entryNoun).toBe('tiền lễ');
    expect(lex.entryVerb).toBe('Ghi khoản');
    expect(lex.saveLabel).toBe('Lưu khoản');
    expect(lex.searchPlaceholder).toBe('Tìm người ghi…');
    expect(lex.amountFieldLabel).toBe('Số tiền');
  });
});

describe('lexicon — khóa exact 6 ô còn lại (F3-4: emptyTitle/emptyBody/nameFieldLabel/paidLabel/savedToast/reviewNoun)', () => {
  const EXACT: Array<{
    kind: SodamEventKind;
    emptyTitle: string;
    emptyBody: string;
    nameFieldLabel: string;
    paidLabel: string;
    savedToast: string;
    reviewNoun: string;
  }> = [
    {
      kind: 'CUOI',
      emptyTitle: 'Chưa có khách nào',
      emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên của đám này.',
      nameFieldLabel: 'Tên khách mừng',
      paidLabel: 'đã trả',
      savedToast: 'Đã ghi khoản mừng cho Nguyễn Văn A.',
      reviewNoun: 'tiền mừng',
    },
    {
      kind: 'MA',
      emptyTitle: 'Chưa có người viếng nào',
      emptyBody: 'Bấm Ghi khoản để ghi người viếng đầu tiên.',
      nameFieldLabel: 'Tên người viếng',
      paidLabel: 'đã đi lại',
      savedToast: 'Đã ghi khoản phúng viếng cho Nguyễn Văn A.',
      reviewNoun: 'tiền phúng viếng',
    },
    {
      kind: 'GIO',
      emptyTitle: 'Chưa có khách nào',
      emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên của đám này.',
      nameFieldLabel: 'Tên khách đến dự',
      paidLabel: 'đã đi lại',
      savedToast: 'Đã ghi khoản lễ cho Nguyễn Văn A.',
      reviewNoun: 'tiền lễ',
    },
    {
      kind: 'MUNG_THO',
      emptyTitle: 'Chưa có khách nào',
      emptyBody: 'Bấm Ghi khoản để ghi khách đầu tiên.',
      nameFieldLabel: 'Tên khách mừng thọ',
      paidLabel: 'đã trả',
      savedToast: 'Đã ghi khoản mừng thọ cho Nguyễn Văn A.',
      reviewNoun: 'tiền mừng thọ',
    },
    {
      kind: 'KHAC',
      emptyTitle: 'Chưa có khoản nào',
      emptyBody: 'Bấm Ghi khoản để ghi khoản đầu tiên.',
      nameFieldLabel: 'Tên người ghi',
      paidLabel: 'đã trả',
      savedToast: 'Đã ghi khoản cho Nguyễn Văn A.',
      reviewNoun: '',
    },
  ];

  it('cả 5 nhóm khớp nguyên văn DESIGN-LANGUAGE §3.2 ở 6 ô', () => {
    for (const row of EXACT) {
      const lex = lexiconForKind(row.kind);
      expect(lex.emptyTitle).toBe(row.emptyTitle);
      expect(lex.emptyBody).toBe(row.emptyBody);
      expect(lex.nameFieldLabel).toBe(row.nameFieldLabel);
      expect(lex.paidLabel).toBe(row.paidLabel);
      expect(lex.savedToast('Nguyễn Văn A')).toBe(row.savedToast);
      expect(lex.reviewNoun).toBe(row.reviewNoun);
    }
  });
});

describe('lexicon — luật cấm theo nhóm', () => {
  it('solemn không chứa chữ hỷ', () => {
    const lex = lexiconForKind('MA');
    const joined = [
      ...staticStrings(lex),
      lex.savedToast('Nguyễn Văn A'),
      lex.entryVerb,
      lex.searchPlaceholder,
    ].join(' | ');
    expect(joined).not.toContain('mừng');
    expect(joined).not.toContain('quà');
    expect(joined).not.toContain('chúc');
    expect(joined).not.toContain('hỷ');
    // 'phúng viếng' là hợp lệ cho nhóm tang.
    expect(joined).toContain('phúng viếng');
  });

  it('memorial không chứa mừng, không chứa phúng viếng', () => {
    const lex = lexiconForKind('GIO');
    const joined = [...staticStrings(lex), lex.savedToast('Nguyễn Văn A')].join(' | ');
    expect(joined).not.toContain('mừng');
    expect(joined).not.toContain('phúng viếng');
  });

  it('mọi nhóm không chứa enum thô MANUAL / OPEN / DONE', () => {
    for (const group of Object.keys(REPRESENTATIVE_KIND) as LexiconGroup[]) {
      const lex = lexiconForKind(REPRESENTATIVE_KIND[group]);
      const joined = [...staticStrings(lex), lex.savedToast('Nguyễn Văn A')].join(' | ');
      expect(joined).not.toContain('MANUAL');
      expect(joined).not.toContain('OPEN');
      expect(joined).not.toContain('DONE');
    }
  });
});

describe('GROUP_STYLE', () => {
  it('selectedChip của solemn/memorial không chứa lacquer', () => {
    expect(GROUP_STYLE.solemn.selectedChip).not.toContain('lacquer');
    expect(GROUP_STYLE.memorial.selectedChip).not.toContain('lacquer');
  });

  it('không style nào chứa B3352C', () => {
    for (const style of Object.values(GROUP_STYLE)) {
      const joined = [style.selectedChip, style.softBg, style.accentText, style.dot].join(' ');
      expect(joined).not.toContain('B3352C');
    }
  });
});

describe('relationOrderForGroup', () => {
  it('solemn/memorial: SPOUSE đứng sau SIBLING', () => {
    for (const group of ['solemn', 'memorial'] as const) {
      const order = relationOrderForGroup(group);
      expect(order.indexOf('SPOUSE')).toBeGreaterThan(order.indexOf('SIBLING'));
      expect(order).toEqual(['PARENT', 'CHILD', 'SIBLING', 'SPOUSE', 'OTHER']);
    }
  });

  it('celebratory giữ SPOUSE đầu', () => {
    const order = relationOrderForGroup('celebratory');
    expect(order[0]).toBe('SPOUSE');
    expect(order).toEqual(['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'OTHER']);
  });
});
