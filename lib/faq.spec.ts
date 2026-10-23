import { describe, expect, it } from 'vitest';
import { FAQS } from './faq';

/**
 * Offline wording (redesign wave 2026-10-23): the outbox now flushes on its
 * own when connectivity returns — the old "only once you return to the book
 * overview" qualification no longer describes the app, so the FAQ must
 * carry the new behaviour and must not resurrect the old one. The FAQ also
 * must not advertise features that are not live (photo reading) or leak
 * implementation terms to end users.
 */
const OFFLINE_WORDING =
  'đang mở app mà mất mạng, bạn vẫn ghi tiếp khoản mới — khoản đó nằm trong hàng chờ trên máy này và tự gửi lên sổ khi có mạng lại';

describe('FAQ — offline claim', () => {
  it('the offline answer states the current outbox behaviour', () => {
    const offline = FAQS.find((f) => f.question.includes('Mất mạng'));
    expect(offline).toBeDefined();
    expect(offline!.answer).toContain(OFFLINE_WORDING);
    expect(offline!.answer).toContain('Mở sổ và xem dữ liệu cần có mạng');
    expect(offline!.answer).toContain('sửa hoặc xóa khoản lúc mất mạng sẽ không được phát lại');
  });

  it('the old overview-only sync qualification is gone', () => {
    const offline = FAQS.find((f) => f.question.includes('Mất mạng'));
    expect(offline!.answer).not.toContain('quay về màn hình tổng quan');
  });
});

describe('FAQ — honesty of advertised features', () => {
  it('keeps all 7 questions (FAQPage JSON-LD source)', () => {
    expect(FAQS).toHaveLength(7);
  });

  it('invite code is described as 16 characters', () => {
    const account = FAQS.find((f) => f.question.includes('tài khoản'));
    expect(account!.answer).toContain('16 ký tự');
    expect(account!.answer).not.toContain('12 ký tự');
  });

  it('no answer advertises photo reading or names implementation terms', () => {
    for (const faq of FAQS) {
      expect(faq.answer).not.toContain('chụp ảnh');
      expect(faq.answer).not.toContain('PostgreSQL');
      expect(faq.answer).not.toContain('OCR');
    }
  });

  it('answers stay within the copy-diet word budget', () => {
    for (const faq of FAQS) {
      const words = faq.answer.trim().split(/\s+/).length;
      const budget = faq.question.includes('Mất mạng') ? 80 : 55;
      expect(words, faq.question).toBeLessThanOrEqual(budget);
    }
  });
});
