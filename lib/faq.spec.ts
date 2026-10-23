import { describe, expect, it } from 'vitest';
import { FAQS } from './faq';

/**
 * U1 wording (retest 2026-10-23): the offline claim was only PARTIALLY true —
 * queued entries do sync automatically, but only once the user returns to
 * the book overview screen. The FAQ answer must carry the proven wording
 * verbatim instead of the old unqualified "tự đồng bộ … khi có mạng trở lại".
 */
const PROVEN_WORDING =
  'Đang mở app mà mất mạng thì vẫn ghi tiếp khoản lễ mới — app xếp hàng trên máy và tự đồng bộ khi có mạng lại và bạn quay về màn hình tổng quan của sổ. Mở sổ và xem dữ liệu vẫn cần kết nối.';

describe('FAQ — offline claim (U1)', () => {
  it('the offline answer contains the retest-proven wording verbatim', () => {
    const offline = FAQS.find((f) => f.question.includes('Mất mạng'));
    expect(offline).toBeDefined();
    expect(offline!.answer).toContain(PROVEN_WORDING);
  });

  it('the old unqualified sync claim is gone', () => {
    const offline = FAQS.find((f) => f.question.includes('Mất mạng'));
    expect(offline!.answer).not.toContain('tự đồng bộ lên sổ khi có mạng trở lại');
  });
});
