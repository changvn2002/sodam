# Contributing — Sổ Đám

Cảm ơn bạn quan tâm. Tài liệu tối thiểu để đóng góp không làm vỡ các
cổng chất lượng của dự án.

## Setup

```bash
git clone https://github.com/changvn2002/sodam.git
cd sodam
cp .env.example .env        # điền DATABASE_URL (hoặc dùng chế độ mock, xem .env.example)
pnpm install --frozen-lockfile
pnpm db:push                # bỏ qua nếu dùng chế độ mock
pnpm dev                    # http://localhost:3100
```

Yêu cầu: Node.js ≥ 24 (`.nvmrc`), pnpm 10.32.1 (`packageManager` trong
`package.json` — dùng `corepack enable` để lấy đúng bản). Cài đặt luôn
dùng `--frozen-lockfile`: lockfile là một phần của review, thay đổi
dependency phải đi kèm thay đổi lockfile trong cùng PR.

## Các cổng bắt buộc trước khi mở PR

CI (`.github/workflows/ci.yml`) chạy đúng dãy lệnh này trên mọi PR —
chạy local trước để khỏi chờ CI báo đỏ:

```bash
pnpm typecheck     # tsc --noEmit
pnpm lint          # ESLint (eslint-config-next)
pnpm format:check  # Prettier — sửa bằng pnpm format
pnpm test          # Vitest
pnpm build         # build production
node scripts/check-perf-budget.mjs   # ngân sách JS (PERF-08), chạy sau build
```

Thêm quy ước riêng của dự án:

- **Tiền là số nguyên VND** ở mọi tầng; bất biến cộng dồn có test
  property-style (`lib/server/money-invariants.spec.ts`) — sửa logic
  tổng hợp thì chạy và, nếu cần, mở rộng test đó trong cùng PR.
- **Nhãn theo loại đám** phải qua `lib/lexicon.ts` (có test exact-lock);
  không tự chế chữ ở bề mặt.
- **Không đổi hợp đồng truy cập**: mọi thao tác dữ liệu qua service
  phải qua `requireBookAccess` trước (ADR-0001/0002).
- **Quyết định kiến trúc lớn** (đổi DB, đổi mô hình truy cập, nới CSP…)
  cần một ADR mới trong `docs/adr/` theo format 0001–0005.

## Quy ước commit

- Một commit = một ý thay đổi mạch lạc; thông điệp ở thì hiện tại, nói
  rõ cái gì + vì sao (tham chiếu mã hạng mục nếu có, ví dụ `SEC-10:`,
  `PERF-08:` hoặc số issue).
- Không commit file env, secret, hay ảnh chụp chứa mã mời đang sống.
  CI có job quét secret (gitleaks) và sẽ chặn.
- PR mô tả thay đổi nhìn thấy được ở phía người dùng; thay đổi giao
  diện phải kèm ảnh chụp trước/sau.

## Báo lỗi & bảo mật

- Lỗi thường: GitHub Issues — https://github.com/changvn2002/sodam/issues
- Lỗ hổng bảo mật: theo [SECURITY.md](SECURITY.md), không mở issue
  công khai.
