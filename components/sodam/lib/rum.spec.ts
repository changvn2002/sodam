import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addLayoutShift, emptyRumSnapshot, roundRum, startRum } from './rum';

const rumSource = readFileSync(fileURLToPath(new URL('./rum.ts', import.meta.url)), 'utf8');

describe('rum — PERF-12 console-only', () => {
  it('startRum an toàn ở môi trường không có PerformanceObserver (SSR/test): trả null, không throw', () => {
    expect(startRum()).toBeNull();
  });

  it('CLS chỉ cộng shift không do thao tác gần gây ra (hadRecentInput bị loại)', () => {
    let s = emptyRumSnapshot();
    s = addLayoutShift(s, 0.05, false);
    s = addLayoutShift(s, 0.5, true);
    expect(s.cls).toBeCloseTo(0.05);
  });

  it('roundRum làm tròn 2 chữ số, giữ null', () => {
    expect(roundRum({ fcp: 123.456, lcp: null, cls: 0.0049, ttfb: 40 })).toEqual({
      fcp: 123.46,
      lcp: null,
      cls: 0,
      ttfb: 40,
    });
  });

  it('hợp đồng console-only: có [rum] + PerformanceObserver, KHÔNG có đường gửi mạng nào', () => {
    expect(rumSource).toContain("console.info('[rum]'");
    expect(rumSource).toContain('PerformanceObserver');
    expect(rumSource).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest|WebSocket/);
  });
});
