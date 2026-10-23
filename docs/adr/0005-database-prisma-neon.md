# ADR-0005: Cơ sở dữ liệu — Prisma + PostgreSQL (Neon qua Vercel Storage)

- Trạng thái: Đã chấp nhận (2026-10-23, chốt ARC-12 tại đợt fix sau
  Panel #03; quyết định này đã hiệu lực từ bản phát hành độc lập đầu
  tiên và được mô tả trong `ARCHITECTURE.md` — ADR này là hồ sơ quyết
  định chính thức còn thiếu).
- Bối cảnh: Sổ Đám cần một kho dữ liệu dùng chung cho nhiều thiết bị
  (cả nhà ghi cùng một cuốn sổ qua mã mời), ghi đồng thời an toàn, và
  truy vấn tổng hợp tiền theo sổ / đám / người. Bản gốc trong monorepo
  dùng PostgreSQL qua Prisma (các model `Sodam*` trong fragment schema
  của host), nên bản độc lập kế thừa cùng mô hình dữ liệu. Hạ tầng phải
  chạy được ở bậc miễn phí, không vận hành máy chủ riêng, và đi cùng
  được với đường deploy Vercel đã chọn.

## Quyết định

- **PostgreSQL** là cơ sở dữ liệu duy nhất của hệ thống; truy cập qua
  **Prisma** (`prisma/schema.prisma` là nguồn sự thật của schema,
  `@prisma/client` là client duy nhất — không SQL thô rải rác ngoài
  service).
- Nhà cung cấp production: **Neon**, gắn vào dự án qua **Vercel
  Storage** (cơ sở dữ liệu `sodam-db`, region `iad1` — xem mục region
  trong `ARCHITECTURE.md`). Chuỗi kết nối đi qua biến môi trường
  `DATABASE_URL` (dạng pooled), không hard-code ở bất kỳ đâu.
- **Kỷ luật schema: `pnpm db:push`, chưa có migration files.** Thay đổi
  schema chỉ được **cộng thêm** (additive: thêm bảng/cột nullable) để
  rollback code không bao giờ đòi rollback schema — kỷ luật này là một
  phần của quyết định, chi tiết ở `docs/RUNBOOK-ROLLBACK.md`. Trước mọi
  thay đổi schema có tính phá huỷ phải chụp snapshot Neon (xem
  `docs/RUNBOOK-INCIDENT.md`, chương khôi phục dữ liệu).

## Các lựa chọn đã cân nhắc

- **SQLite / file cục bộ:** rẻ và đơn giản, nhưng không phục vụ được
  nhiều instance ghi đồng thời trên Vercel (filesystem tạm thời) và phá
  mô hình "cả nhà dùng chung một sổ" — loại.
- **Supabase:** PostgreSQL tương đương về kỹ thuật; Neon được chọn vì
  gắn trực tiếp qua Vercel Storage (ít một tài khoản/bề mặt cấu hình)
  và connection pooling phù hợp hàm serverless. Nếu đổi nhà cung cấp
  sau này, chỉ `DATABASE_URL` thay đổi — quyết định PostgreSQL + Prisma
  không đổi.
- **Kho key-value / document (Redis, MongoDB):** tổng hợp tiền và quan
  hệ người–đám–khoản là dữ liệu quan hệ điển hình; ép sang document làm
  mất ràng buộc toàn vẹn mà không được lợi gì ở quy mô này — loại.
- **Backend riêng (NestJS như bản gốc trong monorepo):** giữ được
  nhưng nhân đôi bề mặt deploy cho một sản phẩm một-repo; nghiệp vụ đã
  được port nguyên vẹn sang route handlers của Next.js gọi cùng một
  service + cùng một Prisma schema — loại vì chi phí vận hành.

## Hệ quả

- Mọi truy vấn dữ liệu đi qua `lib/server/sodam.service.ts` +
  `lib/server/prisma.ts` (singleton); kiểm soát truy cập
  `requireBookAccess` chạy trước mọi thao tác dữ liệu (ADR-0001/0002).
- Trần Int4 của PostgreSQL áp cho mọi số tiền vào (validate ở service,
  có test hardening) — số tiền là `Int` VND, không dùng float ở bất kỳ
  tầng nào.
- Điểm phụ thuộc vận hành: Neon là điểm dữ liệu duy nhất — khôi phục
  dữ liệu = snapshot/branch của Neon (quy trình ở
  `docs/RUNBOOK-INCIDENT.md`); mất `DATABASE_URL` khớp = mất đường vào
  dữ liệu, nên biến này chỉ sống trong Vercel env + `.env` local bị
  gitignore (`.env*`, ARC-02).
- Nợ đã biết và chấp nhận có ghi: chưa có migration files (ARC-10 /
  OPS-07 nằm ngoài phạm vi đợt chốt này) — khi số lượng thay đổi schema
  tăng hoặc cần thay đổi phá huỷ, phải mở ADR mới chuyển sang
  `prisma migrate` trước khi làm.
