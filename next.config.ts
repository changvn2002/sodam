import type { NextConfig } from 'next';

/**
 * Security headers cho mọi route — bổ sung theo QA Portfolio audit #01
 * (2026-10-23), cùng bộ với dichbome: production trước đó chỉ có HSTS do
 * Vercel cấp, thiếu các header chống clickjacking / MIME-sniffing / rò
 * referrer. Permissions-Policy tắt các quyền ở dạng getUserMedia mà app
 * không dùng: ghi lễ bằng giọng nói đi qua Web Speech API của trình duyệt
 * và chụp ảnh qua ô chọn file (capture) — cả hai không qua getUserMedia.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
