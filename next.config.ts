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
  // SEC-01 (checklist grading vòng 1): tắt header X-Powered-By — bản build
  // trước trả "X-Powered-By: Next.js" trong mọi response.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // API chỉ trả JSON — khoá CSP về `default-src 'none'` (W4 LOW:
        // response API trước đây có nosniff nhưng thiếu CSP). Rule này
        // lặp lại đủ bộ header chung vì Next.js lấy giá trị của rule khớp
        // cuối cùng cho mỗi key; trang HTML không nhận CSP này.
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
        ],
      },
    ];
  },
};

export default nextConfig;
