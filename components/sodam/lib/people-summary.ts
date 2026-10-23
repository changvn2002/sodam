import type {
  SodamEntry,
  SodamEvent,
  SodamEventRole,
  SodamPerson,
  SodamReturnItem,
} from '../api/types';

/**
 * Tổng hợp theo-người cho mặt Người — hàm thuần, không phụ thuộc UI.
 *
 * Panel #03 / MEDIUM (R3 vòng 2 §4, R5 corroborate ở ngữ cảnh tang):
 * trước đây mặt Người chỉ cộng KHOẢN (entries): cột 2 "đối lưu" chỉ tính
 * tiền ĐI ĐÁM ở đám nhà mình đi dự (ATTENDED), không bao giờ chứa tiền
 * TRẢ LỄ, và không có nhãn nào. Sheet tuyên "chênh = nhận − đi (khoản)"
 * kể cả sau khi người đó đã được trả dư + tất toán → khẳng định sai
 * nghĩa vụ. Hàm này cộng thêm dòng tiền thứ ba từ `api.listReturns`:
 *
 * - received      = khoản nhận lễ ở đám HOSTED (gross, như cũ — không hồi quy)
 * - attendedGiven = khoản đi đám ở đám ATTENDED ("đi đám" — phạm vi tường minh,
 *                   KHÁC header "Tổng đã đi" vốn = attendedGiven + returnedPaid)
 * - returnedPaid  = số THỰC đã trả lễ (returns DONE: returnedAmountVnd ?? doneAmountVnd)
 * - pendingReturn = số còn chờ trả (returns OPEN, theo số đã nhận)
 * - balance       = received − attendedGiven − returnedPaid
 *                   (chênh ĐÃ trừ tất toán: A nhận 500k, trả 700k → −200k
 *                   "đã trả dư", không còn "chênh 500k" sai nghĩa vụ)
 */

export type PersonReturnState =
  | 'overpaid' // đã trả và trả nhiều hơn số đã nhận (ở các khoản đã tất toán)
  | 'paid' // đã trả, không còn khoản chờ
  | 'partial' // đã trả một phần, vẫn còn khoản chờ
  | 'pending' // có khoản chờ trả, chưa trả khoản nào
  | 'skipped' // mọi khoản trả lễ đều bị bỏ qua
  | 'none'; // không có khoản trả lễ nào (vd chỉ đi dự)

export type PersonSummary = {
  person: SodamPerson;
  /** Tổng khoản nhận lễ ở đám nhà mình tổ chức (HOSTED). */
  received: number;
  /** Tổng khoản đi đám ở đám nhà mình đi dự (ATTENDED) — KHÔNG gồm trả lễ. */
  attendedGiven: number;
  /** Tổng số tiền THỰC đã trả lễ (returns DONE). */
  returnedPaid: number;
  /** Phần trả dư trên các khoản đã trả (paid − received của khoản DONE). */
  overReturned: number;
  /** Tổng số còn chờ trả (returns OPEN, tính theo số đã nhận). */
  pendingReturn: number;
  returnState: PersonReturnState;
  /** received − attendedGiven − returnedPaid (đã trừ tất toán). */
  balance: number;
  latestEventTitle: string | null;
  history: Array<{ entry: SodamEntry; eventTitle: string; role: SodamEventRole }>;
  returnItems: SodamReturnItem[];
};

export function returnStateLabel(state: PersonReturnState): string {
  switch (state) {
    case 'overpaid':
      return 'Đã trả lễ — Trả dư';
    case 'paid':
      return 'Đã trả lễ đủ';
    case 'partial':
      return 'Đã trả lễ một phần — còn khoản chờ trả';
    case 'pending':
      return 'Chưa trả lễ';
    case 'skipped':
      return 'Đã bỏ qua trả lễ';
    default:
      return 'Không có khoản trả lễ';
  }
}

function returnedPaidOf(r: SodamReturnItem): number {
  return r.returnedAmountVnd ?? r.doneAmountVnd ?? 0;
}

function receivedBasisOf(r: SodamReturnItem): number {
  return r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0;
}

export function buildPeopleSummaries(input: {
  people: SodamPerson[];
  details: Array<(SodamEvent & { entries: SodamEntry[] }) | null | undefined>;
  returns: SodamReturnItem[];
  bookId: string;
}): PersonSummary[] {
  const map = new Map<string, PersonSummary>();

  const ensure = (person: SodamPerson): PersonSummary => {
    let agg = map.get(person.id);
    if (!agg) {
      agg = {
        person,
        received: 0,
        attendedGiven: 0,
        returnedPaid: 0,
        overReturned: 0,
        pendingReturn: 0,
        returnState: 'none',
        balance: 0,
        latestEventTitle: null,
        history: [],
        returnItems: [],
      };
      map.set(person.id, agg);
    }
    return agg;
  };

  for (const p of input.people) ensure(p);

  for (const detail of input.details) {
    if (!detail) continue;
    for (const entry of detail.entries) {
      const key = entry.personId ?? entry.personName;
      const agg = ensure(
        entry.personId
          ? (map.get(entry.personId)?.person ?? {
              id: key,
              bookId: input.bookId,
              displayName: entry.personName,
              note: '',
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            })
          : {
              id: key,
              bookId: input.bookId,
              displayName: entry.personName,
              note: '',
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            },
      );
      if (detail.role === 'HOSTED') agg.received += entry.amountVnd;
      else agg.attendedGiven += entry.amountVnd;
      agg.history.push({ entry, eventTitle: detail.title, role: detail.role });
    }
  }

  for (const r of input.returns) {
    const existing = map.get(r.personId);
    const agg = ensure(
      existing?.person ?? {
        id: r.personId,
        bookId: input.bookId,
        displayName: r.personName ?? r.personId,
        note: '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    );
    agg.returnItems.push(r);
  }

  for (const agg of map.values()) {
    let doneCount = 0;
    let openCount = 0;
    let skippedCount = 0;
    for (const r of agg.returnItems) {
      if (r.status === 'DONE') {
        doneCount += 1;
        const paid = returnedPaidOf(r);
        agg.returnedPaid += paid;
        agg.overReturned += Math.max(0, paid - receivedBasisOf(r));
      } else if (r.status === 'OPEN') {
        openCount += 1;
        agg.pendingReturn += receivedBasisOf(r);
      } else {
        skippedCount += 1;
      }
    }
    agg.returnState =
      doneCount > 0 && agg.overReturned > 0 && openCount === 0
        ? 'overpaid'
        : doneCount > 0 && openCount === 0
          ? 'paid'
          : doneCount > 0
            ? 'partial'
            : openCount > 0
              ? 'pending'
              : skippedCount > 0
                ? 'skipped'
                : 'none';
    agg.balance = agg.received - agg.attendedGiven - agg.returnedPaid;
    const sorted = [...agg.history].sort((a, b) =>
      b.entry.createdAt.localeCompare(a.entry.createdAt),
    );
    agg.latestEventTitle = sorted[0]?.eventTitle ?? null;
  }

  return [...map.values()].sort((a, b) =>
    a.person.displayName.localeCompare(b.person.displayName, 'vi'),
  );
}

/**
 * Tên truy cập đầy đủ của một hàng người (điều kiện R3 (i)): câu gồm
 * nhãn tường minh + số cho cả ba dòng tiền, để screen reader không còn
 * đọc "hai số tiền nối liền" (WCAG 1.3.1). `money` do UI truyền vào.
 */
export function personAccessibleLabel(s: PersonSummary, money: (n: number) => string): string {
  const parts = [
    s.person.displayName,
    `Đã nhận lễ ${money(s.received)}`,
    `Đã đi đám ${money(s.attendedGiven)}`,
    `Đã trả lễ ${money(s.returnedPaid)}`,
    returnStateLabel(s.returnState),
    `Chênh sau trả lễ và đi đám ${money(s.balance)}`,
  ];
  return parts.join('. ');
}
