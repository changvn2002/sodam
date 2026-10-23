# Kiến trúc Sổ Đám (sodam)

Tài liệu này mô tả hệ thống như nó đang chạy thật trên production
(https://sodam-tawny.vercel.app). Các quyết định lớn có ADR riêng trong
[`docs/adr/`](docs/adr/). Hợp đồng hành vi của lớp trình bày (redesign-v2)
nằm ở `DESIGN.md`; tài liệu này chỉ nói về cấu trúc kỹ thuật.

## Tổng quan

Một ứng dụng Next.js duy nhất chứa cả giao diện lẫn API; không có backend
riêng, không có tài khoản người dùng. Dữ liệu nằm trong PostgreSQL (Neon,
gắn qua Vercel Storage).

**Region (OPS-02):** cơ sở dữ liệu Neon `sodam-db` đặt tại region
**`iad1`** (US East — N. Virginia; nguồn: hồ sơ cấu hình Vercel Storage
của dự án). Khuyến nghị giữ region của Vercel Functions khớp region của
DB (`iad1`) để mỗi truy vấn Prisma không trả thêm độ trễ liên vùng —
hàm serverless và DB cùng region là cấu hình chuẩn cho độ trễ API trong
`docs/SLO.md`. Việc ghim function region bằng `vercel.json` là thay đổi
hành vi deploy, chỉ thực hiện khi có quyết định riêng của người vận
hành (chưa ghim tại thời điểm viết tài liệu này).

```
Trình duyệt
├─ App shell (React, components/sodam/) — 5 "mặt": Tổng quan / Đám / Trả lễ / Người / Cây họ
├─ Service worker viết tay (public/sw.js) — cache app shell + tài sản tĩnh, KHÔNG chạm /api/*
├─ Hàng chờ offline (IndexedDB outbox, components/sodam/lib/offline.ts)
└─ Đăng ký sổ theo thiết bị (localStorage `sodam_books_v1`: bookId → mã mời)
        │  HTTPS, header `x-book-code` cho mọi route cấp sổ
Middleware (middleware.ts) — CSP nonce từng request + X-Robots-Tag cho ?code=
        │
Next.js route handlers (app/api/products/sodam/[[...path]]/route.ts)
└─ lib/server/sodam.service.ts — toàn bộ nghiệp vụ + kiểm soát truy cập
        │
Prisma → PostgreSQL (Neon): SodamBook / SodamEvent / SodamEntry /
SodamPerson / SodamPersonRelation / SodamReturnItem / SodamSyncCursor /
SodamJoinThrottle
```

## Mô hình truy cập (không đăng nhập)

Xem [ADR-0001](docs/adr/0001-no-login-invite-code-credential.md). Mã mời
16 ký tự (~79 bit entropy) là credential duy nhất của một cuốn sổ: ai có
mã (gõ tay hoặc qua link `/?code=…`) đều mở được sổ. Máy chủ chỉ lưu
SHA-256 của mã ([ADR-0002](docs/adr/0002-hash-only-invite-codes.md)); mã
sai, mã của sổ khác, và sổ không tồn tại đều trả cùng một 404. Đổi mã để
thu hồi quyền là [ADR-0003](docs/adr/0003-invite-code-rotation.md).

## Các ranh giới chính

| Khu vực | Trách nhiệm | Không được làm |
|---|---|---|
| `components/sodam/app.tsx` + `shell.tsx` | Trình bày + điều phối state phía client; mọi mutation chốt qua `reloadWorkspace` (nonce vô hiệu hoá dữ liệu — Panel #02/C-1) | Tự chế nhãn theo loại đám — phải qua `lib/lexicon.ts` |
| `components/sodam/lib/lexicon.ts` | Hệ giọng theo loại đám (5 nhóm × 13 loại), test exact-lock | Thêm chữ ở bề mặt mà không qua đây |
| `components/sodam/api/` | Client API hai chế độ `http` / `mock` (cùng một type `SodamApi`) | Gọi fetch trực tiếp từ component |
| `app/api/products/sodam/[[...path]]/route.ts` | Dispatch + validate input (lib/server/http.ts) | Chứa nghiệp vụ — nghiệp vụ ở service |
| `lib/server/sodam.service.ts` | Nghiệp vụ + `requireBookAccess` trước mọi thao tác dữ liệu | Trả dữ liệu khi chưa qua `requireBookAccess` |
| `lib/server/http.ts` (`handle`) | Ánh xạ lỗi → `{ message }` tiếng Việt; `Cache-Control: no-store` mọi response | Để lỗi thô (Prisma/DB) lọt ra client |
| `middleware.ts` | CSP nonce (SEC-02, [ADR-0004](docs/adr/0004-csp-nonce-middleware.md)) + noindex cho `?code=` | Nới CSP bằng `'unsafe-inline'` cho script |

## Luồng dữ liệu đáng chú ý

- **Ghi khoản khi mất mạng:** client đưa mutation vào outbox IndexedDB,
  hiện "khoản đang chờ gửi"; khi có mạng lại, outbox flush lên endpoint
  sync và workspace nạp lại. Service worker không tham gia vào dữ liệu.
- **Trả lễ:** mỗi khoản HOSTED sinh một `SodamReturnItem`; đánh dấu DONE
  ghi số đã trả, trả dư được tính `overGivenVnd` và hiển thị là "Trả dư".
- **Đổi mã mời:** một `update` nguyên tử thay hash; client tự cập nhật
  đăng ký cục bộ bằng mã mới trong response.

## Mở rộng

- **Thêm loại đám:** thêm kind vào `lib/server/sodam-event-kinds.ts`,
  `SodamEventKind` (components/sodam/api/types.ts), nhóm giọng trong
  lexicon + icon trong `components/sodam/ui/kind-icon.tsx`. Test
  exact-lock của lexicon sẽ bắt mọi ô chữ còn thiếu.
- **Thêm route API:** thêm nhánh dispatch trong route.ts + hàm service
  tương ứng (bắt đầu bằng `requireBookAccess`) + method vào `SodamApi`
  ở cả hai chế độ http/mock + test trong route.spec.ts.
- **Đổi schema:** sửa `prisma/schema.prisma` rồi `pnpm db:push`. Chỉ
  thay đổi cộng thêm (additive) — xem runbook rollback về vì sao.

## Nợ cấu trúc đã biết

- `components/sodam/app.tsx` là một file lớn chứa cả 5 mặt + các sheet
  (hồ sơ chấm vòng 2, ARC-11). Ranh giới tách đã rõ (mỗi mặt là một
  component độc lập trong cùng file) nhưng việc tách file cần một đợt
  riêng có panel chấm lại, không làm vội trong các đợt sửa điểm.
