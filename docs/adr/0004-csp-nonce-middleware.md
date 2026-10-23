# ADR-0004: CSP trang bằng nonce từng request trong middleware (SEC-02)

- Trạng thái: Đã chấp nhận (2026-10-23, đợt fix sau Panel #02)
- Bối cảnh: Trang chủ không có Content-Security-Policy (chỉ API có
  `default-src 'none'`). Hai đường chuẩn: (a) CSP có `'unsafe-inline'`
  cho script — gần như vô hiệu trước XSS; (b) hồ sơ ngoại lệ kiểu
  chiatien (path-C) — chấp nhận không có CSP. Cả hai đều yếu hơn một
  CSP thật, và Next.js hỗ trợ nonce qua middleware nên đường thật khả
  thi.

## Quyết định

- `middleware.ts` sinh nonce mỗi request, gắn vào request header
  `x-nonce` (Next tự đóng nonce lên script nó sinh) và vào
  `script-src 'self' 'nonce-…' 'strict-dynamic'` của response.
- Script viết tay duy nhất (JSON-LD trong `app/page.tsx`) đọc lại
  `x-nonce` từ `headers()` và tự gắn nonce.
- `style-src` giữ `'unsafe-inline'` vì React style attribute
  (offline-ui) — ghi rõ đây là đánh đổi có chủ đích; script không có
  bất kỳ `'unsafe-inline'`/`'unsafe-eval'` nào ở production.
- Cùng middleware gắn `X-Robots-Tag: noindex, nofollow` cho biến thể
  `?code=` (SEO-01b/DATA-14).

## Hệ quả

- Trang chủ chuyển sang dynamic rendering (đọc headers) — chấp nhận
  được với quy mô app; nội dung SEO vẫn server-render đầy đủ.
- Kiểm chứng bắt buộc sau mỗi thay đổi chạm vào middleware/CSP: build
  production, mở trang, đối chiếu nonce trong header CSP với nonce
  trên 100% thẻ script trong HTML (đã làm ở đợt đưa vào: 10/10 khớp).
- Nếu sau này cần nhúng script bên thứ ba, phải qua nonce hoặc hash —
  không nới `script-src` bằng host lạ mà không có ADR mới.
