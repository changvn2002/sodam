import { describe, expect, it } from 'vitest';
import { parseVietnameseGiftLine } from './parse-money';

describe('parse-money', () => {
  it('parses 500 nghìn', () => {
    const r = parseVietnameseGiftLine('Lê C 500 nghìn');
    expect(r.amountVnd).toBe(500_000);
    expect(r.name).toMatch(/Lê C/i);
  });
});
