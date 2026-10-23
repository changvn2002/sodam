/**
 * PERF-12 — RUM console-only theo tiền lệ portfolio: đo Web Vitals tại
 * máy người dùng và CHỈ ghi ra console (`console.info('[rum]', …)`).
 * Không gửi mạng, không endpoint, không tracker, không thêm dependency —
 * thuần PerformanceObserver + Navigation Timing của trình duyệt.
 *
 * Vì sao luôn bật (kể cả dev): mức console.info chỉ người mở DevTools mới
 * thấy; đo ở dev giúp bắt hồi quy hiệu năng ngay khi sửa UI, và không có
 * dữ liệu nào rời thiết bị ở bất kỳ môi trường nào.
 */

export type RumSnapshot = {
  /** First Contentful Paint (ms). */
  fcp: number | null;
  /** Largest Contentful Paint (ms) — cập nhật cho tới khi chốt. */
  lcp: number | null;
  /** Cumulative Layout Shift (tổng, không thứ nguyên). */
  cls: number;
  /** Time To First Byte từ Navigation Timing (ms). */
  ttfb: number | null;
};

export function emptyRumSnapshot(): RumSnapshot {
  return { fcp: null, lcp: null, cls: 0, ttfb: null };
}

/** Cộng dồn CLS từ các layout-shift entry (bỏ qua shift sau thao tác chạm/gõ <500ms — theo chuẩn web-vitals). */
export function addLayoutShift(
  snapshot: RumSnapshot,
  value: number,
  hadRecentInput: boolean,
): RumSnapshot {
  if (hadRecentInput) return snapshot;
  return { ...snapshot, cls: snapshot.cls + value };
}

export function roundRum(snapshot: RumSnapshot): RumSnapshot {
  const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
  return {
    fcp: r2(snapshot.fcp),
    lcp: r2(snapshot.lcp),
    cls: r2(snapshot.cls)!,
    ttfb: r2(snapshot.ttfb),
  };
}

/**
 * Bắt đầu đo. Trả về hàm dừng (disconnect) hoặc null khi môi trường
 * không có PerformanceObserver (SSR/test) — không bao giờ throw.
 * Mount đúng 1 lần ở component gốc của app (app.tsx).
 */
export function startRum(
  log: (snapshot: RumSnapshot) => void = (s) => console.info('[rum]', s),
): (() => void) | null {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return null;

  let snapshot = emptyRumSnapshot();
  const observers: PerformanceObserver[] = [];
  const emit = () => log(roundRum(snapshot));

  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    if (nav) snapshot = { ...snapshot, ttfb: nav.responseStart };

    const observe = (type: string, handle: (entry: PerformanceEntry) => void) => {
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) handle(entry);
          emit();
        });
        obs.observe({ type, buffered: true } as PerformanceObserverInit);
        observers.push(obs);
      } catch {
        // Loại entry này không được trình duyệt hỗ trợ — bỏ qua, đo phần còn lại.
      }
    };

    observe('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') snapshot = { ...snapshot, fcp: entry.startTime };
    });
    observe('largest-contentful-paint', (entry) => {
      snapshot = { ...snapshot, lcp: entry.startTime };
    });
    observe('layout-shift', (entry) => {
      const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
      snapshot = addLayoutShift(snapshot, shift.value ?? 0, Boolean(shift.hadRecentInput));
    });

    emit();
  } catch {
    return null;
  }

  return () => {
    for (const obs of observers) obs.disconnect();
  };
}
