import { describe, expect, it } from 'vitest';
import type { SodamEntry, SodamEvent, SodamPerson, SodamReturnItem } from '../api/types';
import { buildPeopleSummaries, personAccessibleLabel, returnStateLabel } from './people-summary';

/**
 * Ca chuẩn Panel #03 / R3 vòng 2 (r3-round2 §4) + R5 (tang, cùng số):
 * đám giỗ/tang HOSTED — A nhận 500.000₫ → trả lễ 700.000₫ (Trả dư 200.000₫);
 * B nhận 400.000₫ → trả đúng 400.000₫; C nhận 300.000₫ → chưa trả.
 * Đối chứng cơ chế: A đi dự (ATTENDED) thêm 200.000₫.
 */
const BOOK = 'book-1';
const EVENT_HOSTED = 'evt-hosted';
const EVENT_ATTENDED = 'evt-attended';

function person(id: string, displayName: string): SodamPerson {
  return {
    id,
    bookId: BOOK,
    displayName,
    note: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function entry(id: string, eventId: string, p: SodamPerson, amountVnd: number): SodamEntry {
  return {
    id,
    eventId,
    personId: p.id,
    personName: p.displayName,
    amountVnd,
    source: 'MANUAL',
    rawText: null,
    note: '',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    returnItem: null,
  };
}

function ret(
  id: string,
  p: SodamPerson,
  status: SodamReturnItem['status'],
  received: number,
  done: number | null,
): SodamReturnItem {
  return {
    id,
    bookId: BOOK,
    personId: p.id,
    personName: p.displayName,
    fromEventId: EVENT_HOSTED,
    fromEventTitle: 'Đám giỗ bà Tư',
    status,
    suggestedAmountVnd: received,
    doneAmountVnd: done,
    receivedAmountVnd: received,
    returnedAmountVnd: done,
    overGivenVnd: done != null ? Math.max(0, done - received) : 0,
    doneAt: status === 'DONE' ? '2026-10-03T00:00:00.000Z' : null,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
  };
}

const A = person('per-a', 'Người A');
const B = person('per-b', 'Người B');
const C = person('per-c', 'Người C');

function detail(
  role: SodamEvent['role'],
  title: string,
  entries: SodamEntry[],
): SodamEvent & { entries: SodamEntry[] } {
  return {
    id: role === 'HOSTED' ? EVENT_HOSTED : EVENT_ATTENDED,
    bookId: BOOK,
    title,
    kind: 'GIO',
    role,
    status: 'OPEN',
    occurredOn: '2026-10-02',
    note: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    entries,
  };
}

function build(attendedForA = 0) {
  const details = [
    detail('HOSTED', 'Đám giỗ bà Tư', [
      entry('ent-a', EVENT_HOSTED, A, 500_000),
      entry('ent-b', EVENT_HOSTED, B, 400_000),
      entry('ent-c', EVENT_HOSTED, C, 300_000),
    ]),
    ...(attendedForA > 0
      ? [
          detail('ATTENDED', 'Đám nhà mình đi dự', [
            entry('ent-a2', EVENT_ATTENDED, A, attendedForA),
          ]),
        ]
      : []),
  ];
  const returns = [
    ret('ret-a', A, 'DONE', 500_000, 700_000),
    ret('ret-b', B, 'DONE', 400_000, 400_000),
    ret('ret-c', C, 'OPEN', 300_000, null),
  ];
  return buildPeopleSummaries({
    people: [A, B, C],
    details,
    returns,
    bookId: BOOK,
  });
}

const money = (n: number) => n.toLocaleString('vi-VN') + '₫';

describe('people-summary — MEDIUM trang Người (Panel #03, điều kiện R3)', () => {
  it('(2) sheet data: A chứa số đã trả 700.000₫ và phân biệt A/B/C', () => {
    const rows = build();
    const a = rows.find((r) => r.person.id === A.id)!;
    const b = rows.find((r) => r.person.id === B.id)!;
    const c = rows.find((r) => r.person.id === C.id)!;

    expect(a.received).toBe(500_000);
    expect(a.returnedPaid).toBe(700_000);
    expect(a.overReturned).toBe(200_000);
    expect(a.returnState).toBe('overpaid');
    expect(returnStateLabel(a.returnState)).toContain('Trả dư');

    expect(b.returnedPaid).toBe(400_000);
    expect(b.returnState).toBe('paid');
    expect(returnStateLabel(b.returnState)).toContain('đủ');

    expect(c.returnedPaid).toBe(0);
    expect(c.pendingReturn).toBe(300_000);
    expect(c.returnState).toBe('pending');
    expect(returnStateLabel(c.returnState)).toContain('Chưa trả');

    // Ba trạng thái khác nhau phải cho ba nhãn khác nhau.
    expect(new Set([a.returnState, b.returnState, c.returnState]).size).toBe(3);
  });

  it('(2) chênh ĐÃ trừ tất toán — không còn khẳng định sai 500.000₫ cho A', () => {
    const rows = build();
    const a = rows.find((r) => r.person.id === A.id)!;
    const b = rows.find((r) => r.person.id === B.id)!;
    const c = rows.find((r) => r.person.id === C.id)!;
    // balance = đã nhận − đã đi đám − đã trả lễ (số thực trả)
    expect(a.balance).toBe(500_000 - 0 - 700_000);
    expect(b.balance).toBe(0);
    expect(c.balance).toBe(300_000);
  });

  it('(3) không hồi quy: khoản đi dự 200.000₫ chỉ nhảy cột đi đám, header-đi vẫn = đi dự + đã trả', () => {
    const rows = build(200_000);
    const a = rows.find((r) => r.person.id === A.id)!;
    expect(a.attendedGiven).toBe(200_000);
    expect(a.received).toBe(500_000);
    expect(a.returnedPaid).toBe(700_000);
    expect(a.balance).toBe(500_000 - 200_000 - 700_000);
    // Tổng "đã đi" cấp sổ theo định nghĩa header = đi dự + đã trả lễ.
    const totalGivenHeader = rows.reduce((s, r) => s + r.attendedGiven + r.returnedPaid, 0);
    expect(totalGivenHeader).toBe(200_000 + 1_100_000);
  });

  it('(1) accessible label của hàng là câu đầy đủ gồm nhãn + số cho cả ba dòng tiền', () => {
    const rows = build(200_000);
    const a = rows.find((r) => r.person.id === A.id)!;
    const label = personAccessibleLabel(a, money);
    expect(label).toContain('Người A');
    expect(label).toContain('Đã nhận lễ');
    expect(label).toContain(money(500_000));
    expect(label).toContain('Đã đi đám');
    expect(label).toContain(money(200_000));
    expect(label).toContain('Đã trả lễ');
    expect(label).toContain(money(700_000));
    // Nhãn theo-người phải nói rõ phạm vi "đi đám" — không dùng chữ "đi" trần
    // như header (header gồm cả trả lễ).
    expect(label).not.toMatch(/· đi \d/);
  });

  it('người chỉ đi dự (không khoản trả lễ nào) có trạng thái none, balance = −đi đám', () => {
    const D = person('per-d', 'Người D');
    const rows = buildPeopleSummaries({
      people: [D],
      details: [detail('ATTENDED', 'Đi dự', [entry('ent-d', EVENT_ATTENDED, D, 150_000)])],
      returns: [],
      bookId: BOOK,
    });
    expect(rows[0]!.returnState).toBe('none');
    expect(rows[0]!.balance).toBe(-150_000);
    expect(rows[0]!.attendedGiven).toBe(150_000);
  });
});
