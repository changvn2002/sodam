import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

/**
 * W4 LOW (half-done at retest): API responses carried `nosniff` but no
 * Content-Security-Policy. API JSON gets a locked-down CSP; HTML pages must
 * NOT get it (it would break the app shell).
 */
describe('next.config headers — CSP for API only', () => {
  it('the /api rule sets Content-Security-Policy: default-src none', async () => {
    const rules = await nextConfig.headers!();
    const api = rules.find((r) => r.source === '/api/:path*');
    expect(api).toBeDefined();
    const csp = api!.headers.find((h) => h.key.toLowerCase() === 'content-security-policy');
    expect(csp?.value).toContain("default-src 'none'");
    // The base security headers stay on API responses too.
    expect(api!.headers.some((h) => h.key === 'X-Content-Type-Options')).toBe(true);
  });

  it('the page rule does NOT set a Content-Security-Policy', async () => {
    const rules = await nextConfig.headers!();
    const pages = rules.find((r) => r.source === '/:path*');
    expect(pages).toBeDefined();
    expect(pages!.headers.some((h) => h.key.toLowerCase() === 'content-security-policy')).toBe(
      false,
    );
  });
});
