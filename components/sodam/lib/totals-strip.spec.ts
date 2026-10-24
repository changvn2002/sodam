import { describe, expect, it } from 'vitest';
import type { SodamDashboardTotals } from '../api/types';
import { totalsTerms } from './totals-strip';

/**
 * TC-1 (Panel #04) — khoá bất biến của dòng phụ TotalsStrip sau khi bỏ
 * phương trình cũ «Đã nhận R − đã đi G = còn giữ K · đi nhiều hơn O».
 *
 * Ký hiệu (đúng trường máy chủ ở lib/server/sodam-service/dashboard.ts):
 *   R = receivedGrossVnd (Σ HOSTED) · S = settledVnd · O = overGivenVnd
 *   A = attendedVnd (đi đám ATTENDED — biến nội bộ server, KHÔNG có
 *       trường riêng trong SodamDashboardTotals)
 *   P = returnedPaidVnd = S + O · G = givenVnd = A + P
 *   K = receivedVnd = max(0, R − S) · Pend = pendingReturnVnd
 * Mọi fixture dưới đây đều nhất quán theo các đẳng thức trên (có test
 * tự kiểm ở cuối khối fixture).
 */
type Fixture = {
  R: number;
  S: number;
  O: number;
  A: number;
  P: number;
  G: number;
  K: number;
  Pend: number;
};

function toTotals(f: Fixture): SodamDashboardTotals {
  return {
    receivedGrossVnd: f.R,
    settledVnd: f.S,
    returnedPaidVnd: f.P,
    overGivenVnd: f.O,
    pendingReturnVnd: f.Pend,
    givenVnd: f.G,
    receivedVnd: f.K,
    people: 0,
  };
}

const sumTerms = (f: Fixture) => totalsTerms(toTotals(f)).reduce((s, t) => s + t.valueVnd, 0);
const termOf = (f: Fixture, key: 'in-pool' | 'out-pool') =>
  totalsTerms(toTotals(f)).find((t) => t.key === key);

/** (0) không hoạt động: có nhận + còn chờ trả, chưa tất toán khoản nào. */
const SHAPE0: Fixture = {
  R: 1_000_000,
  S: 0,
  O: 0,
  A: 0,
  P: 0,
  G: 0,
  K: 1_000_000,
  Pend: 1_000_000,
};
/** (1) chỉ trả lễ thường: trả đúng số đã nhận, không đi đám, không trả dư. */
const SHAPE1: Fixture = {
  R: 1_000_000,
  S: 400_000,
  O: 0,
  A: 0,
  P: 400_000,
  G: 400_000,
  K: 600_000,
  Pend: 600_000,
};
/** (2) chỉ đi đám: chưa trả lễ khoản nào, chỉ chi đi dự. */
const SHAPE2: Fixture = {
  R: 1_000_000,
  S: 0,
  O: 0,
  A: 200_000,
  P: 0,
  G: 200_000,
  K: 1_000_000,
  Pend: 1_000_000,
};
/** (3) hỗn hợp có trả dư: tất toán hết khoản đã nhận + trả dư + đi đám. */
const SHAPE3: Fixture = {
  R: 500_000,
  S: 500_000,
  O: 200_000,
  A: 100_000,
  P: 700_000,
  G: 800_000,
  K: 0,
  Pend: 0,
};
/** Neo kiểm chứng của panel R3″ (sodam-panel-04.md mục 8). */
const ANCHOR_R3: Fixture = {
  R: 1_400_000,
  S: 900_000,
  O: 200_000,
  A: 450_000,
  P: 1_100_000,
  G: 1_550_000,
  K: 500_000,
  Pend: 500_000,
};
/**
 * Ca R1 của panel: «Đã nhận 4.000.000 − đã đi 700.000» mà còn giữ
 * 3.500.000 — suy nhất quán: S = R − K = 500.000, O = 200.000,
 * A = 0, P = S + O = 700.000, G = A + P = 700.000.
 */
const CASE_R1: Fixture = {
  R: 4_000_000,
  S: 500_000,
  O: 200_000,
  A: 0,
  P: 700_000,
  G: 700_000,
  K: 3_500_000,
  Pend: 3_500_000,
};

const ALL_FIXTURES = [SHAPE0, SHAPE1, SHAPE2, SHAPE3, ANCHOR_R3, CASE_R1];

describe('totals-strip — TC-1 (Panel #04): bỏ phương trình, tách 2 hạng có nhãn', () => {
  it('fixture tự nhất quán: G = A + (S + O), P = S + O, K = R − S ở mọi fixture', () => {
    for (const f of ALL_FIXTURES) {
      expect(f.P).toBe(f.S + f.O);
      expect(f.G).toBe(f.A + f.P);
      expect(f.K).toBe(f.R - f.S);
    }
  });

  it('(0) không hoạt động → terms rỗng (không render dòng phụ)', () => {
    expect(totalsTerms(toTotals(SHAPE0))).toEqual([]);
  });

  it('(1) chỉ trả lễ thường → chỉ hạng in-pool 400.000', () => {
    expect(totalsTerms(toTotals(SHAPE1))).toEqual([
      { key: 'in-pool', label: 'Đã đi trong khoản đã nhận', valueVnd: 400_000 },
    ]);
  });

  it('(2) chỉ đi đám → chỉ hạng out-pool 200.000, nhãn «Đi đám» (TC5-4: O = 0)', () => {
    expect(totalsTerms(toTotals(SHAPE2))).toEqual([
      { key: 'out-pool', label: 'Đi đám', valueVnd: 200_000 },
    ]);
  });

  it('(3) hỗn hợp có trả dư → 2 hạng: 500.000 + 300.000', () => {
    expect(totalsTerms(toTotals(SHAPE3))).toEqual([
      { key: 'in-pool', label: 'Đã đi trong khoản đã nhận', valueVnd: 500_000 },
      { key: 'out-pool', label: 'Trả dư + đi đám', valueVnd: 300_000 },
    ]);
  });

  it('neo R3″ của panel → hạng 900.000 + 650.000, các tổng gốc giữ nguyên', () => {
    const totals = toTotals(ANCHOR_R3);
    expect(totalsTerms(totals)).toEqual([
      { key: 'in-pool', label: 'Đã đi trong khoản đã nhận', valueVnd: 900_000 },
      { key: 'out-pool', label: 'Trả dư + đi đám', valueVnd: 650_000 },
    ]);
    // Neo kiểm chứng §8: KHÔNG đổi tổng gốc để ép cân.
    expect(totals.receivedGrossVnd).toBe(1_400_000);
    expect(totals.givenVnd).toBe(1_550_000);
    expect(totals.receivedVnd).toBe(500_000);
    expect(totals.pendingReturnVnd).toBe(500_000);
  });

  it('ca R1 của panel → hạng 500.000 + 200.000 (nhãn hạng 2 = «Trả dư» theo TC5-4 vì A = 0)', () => {
    expect(totalsTerms(toTotals(CASE_R1))).toEqual([
      { key: 'in-pool', label: 'Đã đi trong khoản đã nhận', valueVnd: 500_000 },
      { key: 'out-pool', label: 'Trả dư', valueVnd: 200_000 },
    ]);
  });

  it('bất biến: tổng các hạng = givenVnd ở mọi fixture có settledVnd', () => {
    for (const f of ALL_FIXTURES) {
      expect(sumTerms(f)).toBe(f.G);
    }
  });

  it('bất biến: hạng in-pool = settledVnd từng đồng; S = 0 thì không có hạng', () => {
    for (const f of ALL_FIXTURES) {
      if (f.S > 0) expect(termOf(f, 'in-pool')?.valueVnd).toBe(f.S);
      else expect(termOf(f, 'in-pool')).toBeUndefined();
    }
  });

  it('bất biến: hạng out-pool = G − S = A + O từng đồng', () => {
    for (const f of ALL_FIXTURES) {
      if (f.G - f.S > 0) expect(termOf(f, 'out-pool')?.valueVnd).toBe(f.A + f.O);
      else expect(termOf(f, 'out-pool')).toBeUndefined();
    }
  });

  it('settledVnd thiếu (undefined / null) → terms rỗng, không khẳng định gì', () => {
    const base = toTotals(SHAPE3);
    expect(totalsTerms({ ...base, settledVnd: undefined })).toEqual([]);
    expect(totalsTerms({ ...base, settledVnd: null as unknown as number })).toEqual([]);
  });

  it('lệch của phương trình cũ (lý do bỏ phương trình, ghi vĩnh viễn): (R − G) − K = −(A + O)', () => {
    // Tính thuần số học trên fixture — phương trình cũ «R − G = K» sai
    // đúng bằng phần chi ngoài khoản đã nhận ở các trạng thái thường nhật.
    const gap = (f: Fixture) => f.R - f.G - f.K;
    expect(gap(SHAPE2)).toBe(-(SHAPE2.A + SHAPE2.O));
    expect(gap(SHAPE2)).toBe(-200_000);
    expect(gap(SHAPE3)).toBe(-(SHAPE3.A + SHAPE3.O));
    expect(gap(SHAPE3)).toBe(-300_000);
    expect(gap(ANCHOR_R3)).toBe(-(ANCHOR_R3.A + ANCHOR_R3.O));
    expect(gap(ANCHOR_R3)).toBe(-650_000);
  });

  it('dose-response theo trả dư O: O từ 0 → 500.000 bước 100.000, tổng hạng = G ở mọi điểm', () => {
    const S = 400_000;
    const A = 100_000;
    const R = 1_000_000;
    for (let O = 0; O <= 500_000; O += 100_000) {
      const f: Fixture = { R, S, O, A, P: S + O, G: A + S + O, K: R - S, Pend: 0 };
      expect(sumTerms(f)).toBe(f.G);
      expect(termOf(f, 'in-pool')?.valueVnd).toBe(S);
      expect(termOf(f, 'out-pool')?.valueVnd).toBe(A + O);
    }
  });

  it('dose-response theo đi đám A: A từ 0 → 500.000 bước 100.000, tổng hạng = G ở mọi điểm', () => {
    const S = 400_000;
    const O = 100_000;
    const R = 1_000_000;
    for (let A = 0; A <= 500_000; A += 100_000) {
      const f: Fixture = { R, S, O, A, P: S + O, G: A + S + O, K: R - S, Pend: 0 };
      expect(sumTerms(f)).toBe(f.G);
      expect(termOf(f, 'in-pool')?.valueVnd).toBe(S);
      expect(termOf(f, 'out-pool')?.valueVnd).toBe(A + O);
    }
  });
});
