import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

/**
 * SEO-01b / DATA-14: link chia sẻ /?code=… không bao giờ được index;
 * trang chủ thường không bị gắn noindex (SEO-01 giữ PASS).
 */
describe('middleware — X-Robots-Tag cho biến thể ?code=', () => {
  it('/?code=… → noindex, nofollow', () => {
    const res = middleware(new NextRequest('https://sodam.example/?code=ABCD2345EFGH6789'));
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('trang chủ không code → không gắn header', () => {
    const res = middleware(new NextRequest('https://sodam.example/'));
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('query khác (không phải code) → không gắn header', () => {
    const res = middleware(new NextRequest('https://sodam.example/?utm_source=test'));
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });
});

describe('middleware — SEC-02 CSP bằng nonce', () => {
  it('mọi response trang chủ đều có CSP với nonce + strict-dynamic, không unsafe-inline cho script', () => {
    const res = middleware(new NextRequest('https://sodam.example/'));
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    const scriptSrc = csp!
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('script-src'))!;
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    if (process.env.NODE_ENV !== 'development') {
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    }
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('nonce đổi theo từng request và khớp header x-nonce chuyển cho page', () => {
    const a = middleware(new NextRequest('https://sodam.example/'));
    const b = middleware(new NextRequest('https://sodam.example/'));
    const nonceOf = (res: ReturnType<typeof middleware>) =>
      res.headers.get('content-security-policy')!.match(/'nonce-([^']+)'/)![1];
    expect(nonceOf(a)).not.toBe(nonceOf(b));
    // NextResponse.next({ request }) phơi header request qua tiền tố nội bộ này.
    const forwarded = a.headers.get('x-middleware-request-x-nonce');
    if (forwarded) expect(forwarded).toBe(nonceOf(a));
  });
});
