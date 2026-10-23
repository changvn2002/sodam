# Runbook: Deploy & Rollback — Sổ Đám

Tài liệu vận hành cho bản production https://sodam-tawny.vercel.app
(Vercel project gắn với repo GitHub `changvn2002/sodam`, nhánh `main`).
Mục tiêu: bất kỳ ai có quyền repo + Vercel đều khôi phục được production
về trạng thái tốt gần nhất trong vài phút, không cần người viết code gốc.

## Mô hình deploy & cặp tag ↔ deployment

- **Một commit trên `main` = một deployment production.** Vercel tự
  build khi có push; không có bước deploy tay.
- **Tag phát hành:** mỗi lần phát hành có thay đổi nhìn thấy được, gắn
  tag `vX.Y.Z` (khớp `version` trong `package.json` và mục tương ứng
  trong `CHANGELOG.md`) lên đúng commit đang chạy production. Tag là
  mốc rollback danh nghĩa: "về bản vX.Y.Z" nghĩa là về commit của tag.
- **Bảng cặp (ghi tại thời điểm phát hành, trong CHANGELOG):** phiên
  bản → commit SHA → ngày deploy. Deployment URL cụ thể xem trong
  Vercel → Project sodam → Deployments (mỗi deployment ghi đúng SHA).

## Rollback — đường nhanh (không đổi code)

1. Vercel → Project **sodam** → **Deployments**.
2. Chọn deployment tốt gần nhất (đối chiếu SHA với tag trong CHANGELOG).
3. `…` → **Promote to Production** (Instant Rollback). Production trỏ
   lại build đó ngay, không build lại.
4. Sang mục **Kiểm chứng sau rollback** ở dưới.

## Rollback — đường git (khi cần giữ lịch sử tuyến tính)

1. `git revert <commit-hỏng>` trên `main` (KHÔNG reset/force-push —
   lịch sử production phải truy vết được).
2. Push `main`; chờ Vercel build xong.
3. Sang mục **Kiểm chứng sau rollback**.

## Kiểm chứng sau rollback (bắt buộc, ghi lại kết quả)

1. Mở https://sodam-tawny.vercel.app — trang chủ tải được, không lỗi
   console chặn đứng.
2. `curl -sI https://sodam-tawny.vercel.app/` — có
   `Content-Security-Policy` với `script-src … 'nonce-…'`; mở HTML và
   đối chiếu nonce khớp trên các thẻ script (ADR-0004).
3. `curl -s "https://sodam-tawny.vercel.app/?code=KIEMTRA1234567"` —
   header có `X-Robots-Tag: noindex, nofollow`.
4. Mở một cuốn sổ thật bằng mã của chính thiết bị kiểm tra → dashboard
   hiện đúng tổng; ghi thử 1 khoản nhỏ rồi xoá nó (kiểm cả đường ghi).
5. `curl -s https://sodam-tawny.vercel.app/sw.js` — tải được; cache
   name khớp bản vừa deploy (tăng số khi danh sách precache đổi).

## Cảnh báo dữ liệu & schema

- **Rollback code KHÔNG rollback schema.** `pnpm db:push` áp schema
  trực tiếp lên Neon production. Quy tắc: chỉ thay đổi **cộng thêm**
  (thêm bảng/cột nullable). Đổi tên/xoá cột phải tách thành hai lần
  phát hành (thêm mới → chuyển dữ liệu → xoá cũ ở lần sau) để bản code
  cũ vẫn chạy được trên schema mới trong lúc rollback.
- Trước mọi lần `db:push` có yếu tố phá huỷ: ghi lại trong CHANGELOG
  và tạo nhánh/snapshot Neon nếu bảng chứa dữ liệu thật.
- Các biến môi trường production (DATABASE_URL…) chỉ sống trong
  Vercel → Settings → Environment Variables; không có bản sao trong
  repo. Rollback deployment không đổi biến môi trường.

## Sự cố thường gặp

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| Trang trắng sau deploy | Console trình duyệt: lỗi CSP (nonce) → đối chiếu ADR-0004; nếu chặn đứng, rollback đường nhanh rồi mới sửa |
| Mọi request API 404 "Book not found" | Mã trên thiết bị đã bị đổi (rotate) — nhập mã mới; không phải sự cố server |
| API 500 hàng loạt | Vercel → Logs: lỗi kết nối DB (Neon) hoặc biến môi trường bị đổi |
| Người dùng thấy bản cũ | Service worker: cache name đã tăng chưa; bản SW mới tự thay khi activate |
