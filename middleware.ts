import { NextResponse, type NextRequest } from 'next/server';

/**
 * Hai việc bảo mật ở tầng edge cho trang chủ (bề mặt HTML duy nhất của app):
 *
 * 1) SEC-02 (re-grade r2) — CSP THẬT bằng nonce từng request: trước đây
 *    trang không có Content-Security-Policy nào (chỉ route API có
 *    `default-src 'none'`). Nonce được đặt vào request header `x-nonce` để
 *    Next.js tự gắn vào mọi script nó sinh ra; script JSON-LD viết tay
 *    trong app/page.tsx đọc lại đúng nonce này. `'strict-dynamic'` để các
 *    script đã có nonce được phép nạp tiếp script con của chính chúng.
 *    style-src giữ 'unsafe-inline' vì app dùng style attribute của React
 *    (offline-ui) — rủi ro style-injection thấp hơn script nhiều bậc và
 *    đây là cấu hình chuẩn của các app React/Next có nonce CSP.
 *
 * 2) SEO-01b / DATA-14 / SEC-12.5 — biến thể link chia sẻ `/?code=…` chứa
 *    credential của một cuốn sổ thật: response PHẢI mang
 *    `X-Robots-Tag: noindex, nofollow`. Trang chủ không có `code` giữ
 *    nguyên khả năng index (SEO-01).
 */
export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  if (req.nextUrl.searchParams.has('code')) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const config = {
  // Trang chủ là bề mặt HTML duy nhất nhận link chia sẻ và cần CSP;
  // API/static đi các tầng header riêng trong next.config.ts.
  matcher: ['/'],
};
