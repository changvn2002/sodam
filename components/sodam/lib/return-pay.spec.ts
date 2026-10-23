import { describe, expect, it } from 'vitest';
import { nextReturnPay } from './return-pay';

describe('nextReturnPay — B2 ô tiền trả lễ bám tổng vừa sửa', () => {
  it('chưa sửa tay: bám theo tổng mới sau khi khoản bị sửa 500.000 → 650.000', () => {
    expect(nextReturnPay({ currentPay: '500000', nextReceived: 650_000, touched: false })).toBe(
      '650000',
    );
  });

  it('đã sửa tay: giữ nguyên số người dùng đã gõ, không ghi đè', () => {
    expect(nextReturnPay({ currentPay: '700000', nextReceived: 650_000, touched: true })).toBe(
      '700000',
    );
  });

  it('tổng mới bằng 0 / âm: kẹp về 0', () => {
    expect(nextReturnPay({ currentPay: '500000', nextReceived: 0, touched: false })).toBe('0');
  });
});
