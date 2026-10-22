import { describe, expect, it } from 'vitest';
import { formatLunarVi, solarToLunar } from './lunar';

describe('solarToLunar (âm lịch Việt Nam, UTC+7)', () => {
  it('10/02/2024 dương = 1/1 âm — Tết Giáp Thìn', () => {
    expect(solarToLunar(10, 2, 2024)).toEqual({
      day: 1,
      month: 1,
      year: 2024,
      leap: false,
    });
  });

  it('29/01/2025 dương = 1/1 âm — Tết Ất Tỵ', () => {
    expect(solarToLunar(29, 1, 2025)).toEqual({
      day: 1,
      month: 1,
      year: 2025,
      leap: false,
    });
  });

  it('17/09/2024 dương = 15/8 âm — Trung thu', () => {
    expect(solarToLunar(17, 9, 2024)).toEqual({
      day: 15,
      month: 8,
      year: 2024,
      leap: false,
    });
  });

  it('22/01/2023 dương = 1/1 âm — Tết Quý Mão', () => {
    expect(solarToLunar(22, 1, 2023)).toEqual({
      day: 1,
      month: 1,
      year: 2023,
      leap: false,
    });
  });

  it('22/03/2023 dương = 1/2 nhuận âm — năm Quý Mão nhuận tháng 2', () => {
    expect(solarToLunar(22, 3, 2023)).toEqual({
      day: 1,
      month: 2,
      year: 2023,
      leap: true,
    });
  });
});

describe('formatLunarVi', () => {
  it('định dạng ngày thường', () => {
    expect(formatLunarVi(15, 8)).toBe('15/8 âm lịch');
  });

  it('định dạng tháng nhuận', () => {
    expect(formatLunarVi(1, 2, true)).toBe('1/2 nhuận âm lịch');
  });
});
