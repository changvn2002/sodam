import type { SodamDashboardTotals } from '../api/types';

/**
 * Các hạng của dòng phụ dưới dải tổng cấp sổ — hàm thuần, không UI.
 *
 * TC-1 (Panel #04, MEDIUM niềm tin): dòng cũ in một PHƯƠNG TRÌNH lấy
 * đã nhận {R} trừ đã đi {G} rồi kết luận là số còn giữ {K}, kèm hậu tố
 * phần trả dư {O} — nhưng K = R − S (chỉ trừ phần trả lễ nằm trong
 * khoản đã nhận), nên
 * R − G = K − (A + O): phương trình lệch đúng trả dư + đi đám ở mọi
 * trạng thái có đi đám hoặc trả dư, và hậu tố {O} chỉ đối soát phần
 * trả dư. Mọi số gốc đều đúng từng đồng (dashboard server) — lỗi nằm
 * ở cách ghép hai định nghĩa khác nhau dưới một dấu «=».
 *
 * Dạng mới (điều kiện đóng §8 của panel, nhánh 2): BỎ phương trình,
 * tách «đã đi» thành hai hạng có nhãn riêng, mỗi hạng truy về đúng
 * một trường máy chủ và không khẳng định phép trừ nào:
 * - in-pool  «Đã đi trong khoản đã nhận» = S = settledVnd
 *            (phần trả lễ tính theo số khách đã mừng — đúng phần đã
 *            trừ khỏi "còn giữ")
 * - out-pool «Trả dư + đi đám» = G − S = A + O từng đồng
 *            (G = givenVnd = A + P, P = returnedPaidVnd = S + O)
 * Bất biến khoá ở totals-strip.spec.ts: tổng các hạng = givenVnd.
 */

export type TotalsTerm = {
  key: 'in-pool' | 'out-pool';
  label: string;
  valueVnd: number;
};

export function totalsTerms(totals: SodamDashboardTotals): TotalsTerm[] {
  const settled = totals.settledVnd;
  // Thiếu dữ kiện tất toán (API cũ / payload thiếu trường): không
  // khẳng định hạng nào — 4 ô chính của dải vẫn hiển thị như cũ.
  if (settled == null) return [];

  const terms: TotalsTerm[] = [];
  if (settled > 0) {
    terms.push({ key: 'in-pool', label: 'Đã đi trong khoản đã nhận', valueVnd: settled });
  }
  const outPool = totals.givenVnd - settled;
  if (outPool > 0) {
    terms.push({ key: 'out-pool', label: 'Trả dư + đi đám', valueVnd: outPool });
  }
  return terms;
}
