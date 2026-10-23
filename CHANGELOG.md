# Changelog — Sổ Đám

Mọi thay đổi đáng kể của production https://sodam-tawny.vercel.app.
Định dạng theo Keep a Changelog; phiên bản theo `version` trong
`package.json`.

**Cặp tag ↔ deployment (xem `docs/RUNBOOK-ROLLBACK.md`):** mỗi lần
phát hành gắn tag `vX.Y.Z` lên đúng commit đang chạy production và ghi
một dòng vào bảng cặp ở cuối file này: phiên bản → commit SHA → ngày
deploy. "Về bản vX.Y.Z" khi rollback nghĩa là về commit của tag đó.

## [1.1.1] — hotfix bảo mật dependency (SEC-10)

Phát hành ngày 2026-10-24, tag v1.1.1 — xem bảng cặp ở cuối file.
Cổng audit SEC-10 vừa được siết chặn thật ở v1.1.0 đã bắt được ngay
trên CI của chính v1.1.0:

- **next 16.3.6 → 16.4.2:** vá 2 lỗ hổng CRITICAL — RCE không cần
  xác thực ở Image Optimization API khi dùng SVG
  (GHSA-2464-fhr4-w9xw) và RCE ở `use cache` với typed arrays
  (GHSA-673q-mjm6-r5xr) — cùng 1 HIGH SSRF ở Image Optimization và
  1 HIGH DoS ở App Router/Server Actions.
- **prisma / @prisma/client → 6.19.3** và **override deepmerge-ts
  ^8.0.0** (bản 7.x qua @prisma/config dính HIGH stack exhaustion
  khi merge đồ thị đối tượng đệ quy).

## [1.1.0] — đợt sửa sau Panel #02/#03 + hồ sơ chấm vòng 2–3

Phiên bản này gồm hai đợt: đợt hợp nhất `bfdd463` (đã chạy production —
nội dung từ `FIX-WAVE-STATE.md`, suite tại thời điểm bàn giao: 108/108
test) và đợt sửa sau Panel #03 PASS + re-grade vòng 3
(`FIX-WAVE-PANEL03-STATE.md`). Phát hành ngày 2026-10-24,
tag v1.1.0 — xem bảng cặp ở cuối file.

### Đợt sửa sau Panel #03

- **Trang Người (MEDIUM Panel #03):** hai cột số tiền được gán nhãn ngữ
  nghĩa rõ ràng — cột đối lưu (chỉ tính tiền đi đám ở đám đi dự) phân
  biệt với số đã trả lễ; tờ chi tiết người hiển thị số đã trả và phân
  biệt người trả đúng / trả dư / chưa trả, thay cho con số "chênh" gây
  hiểu sai nghĩa vụ.
- **Bảo mật API:** trường lạ trong body bị từ chối 400 thay vì nuốt
  lặng; trần dung lượng body JSON (vượt → 413); route ảnh kiểm tra
  allowlist + magic bytes + trần dung lượng thay vì tin `file.type` do
  client khai; `inviteCodeHash` không còn xuất hiện trong payload.
- **CI chặn thật:** bước audit dependency bỏ chế độ chỉ-cảnh-báo — job
  fail khi lockfile có lỗ hổng critical/high; sửa job quét secret
  (gitleaks) fail trên mọi PR của Dependabot: action ≥ v2 bắt buộc
  `GITHUB_TOKEN` khi quét pull request (bằng chứng: annotation của các
  run 39978285479 / 39978280237 / 39978266699).
- **Hạ tầng chất lượng:** ngân sách JS first-load (`perf-budget.json` +
  `scripts/check-perf-budget.mjs`, chạy trong CI sau build); coverage
  thresholds trong Vitest; test bất biến tiền dạng property
  (`lib/server/money-invariants.spec.ts`).
- **Tài liệu:** ADR-0005 (quyết định Prisma + Neon); `docs/SLO.md` +
  mẫu postmortem; runbook sự cố riêng `docs/RUNBOOK-INCIDENT.md`; mục
  quyền riêng tư trong README; `CONTRIBUTING.md`; tuyên bố khả năng
  tiếp cận `docs/ACCESSIBILITY.md`; ghi region DB (`iad1`) vào
  `ARCHITECTURE.md`; thống nhất slash canonical ↔ sitemap (SEO-04);
  `.gitignore` mẫu `.env*` đầy đủ + `.env.example` đủ biến code đọc.

### Đợt hợp nhất bfdd463 (đã lên production)

### Đã sửa (lỗi người dùng thấy được)

- **C-1 (Panel #02, nghiêm trọng):** ghi khoản mới ở ô soạn nhanh không
  còn làm mặt Đám đứng hình — bảng khoản và các con số tổng của đám
  đang mở cập nhật ngay trong cùng phiên, không cần tải lại trang
  (nonce vô hiệu hoá dữ liệu ở tầng workspace; mọi mặt nạp lại qua
  cùng một điểm nghẽn `reloadWorkspace`).
- **T-02 (Panel #02):** màu đỏ sơn mài `#B3352C` bị loại khỏi toàn bộ
  lớp nhận diện — palette avatar không còn tone đỏ (người đi đám tang
  / giỗ không còn bị gán avatar đỏ), màu avatar của một người nay chỉ
  phụ thuộc vào chính người đó nên giống nhau trên mọi trang; các con
  số tiền sổ sách trung tính (đã đi / trả dư) không còn nhuộm đỏ.
- Icon theo từng loại đám vẽ lại đúng ngữ cảnh (đám tang: bát hương;
  cưới: nhẫn đôi; thôi nôi: lục lạc; tân gia: nhà; khai trương: mặt
  tiền…) thay cho một khuôn dùng chung.
- Nhãn khó hiểu đổi sang tiếng Việt công việc: nút "Mặt" → "Xem sổ";
  trạng thái trả thừa "Quá tay" → "Trả dư".
- Công thức tổng ở dải tổng kết không còn bị cắt giữa con số trên
  mobile; badge trên mobile tăng cỡ chữ + vùng chạm; vòng focus của ô
  nhập đậm lên đạt chuẩn tương phản (5.15:1).
- Trạng thái rỗng của sổ không còn ảnh khối xám lệch tông — thay bằng
  minh hoạ SVG cùng palette; mặt Cây họ có khối dẫn hướng + nút hành
  động khi chưa có quan hệ nào.

### Bảo mật

- **CSP thật cho trang (SEC-02):** middleware sinh nonce từng request,
  `script-src 'self' + nonce + 'strict-dynamic'` — không cần hồ sơ
  ngoại lệ (ADR-0004). Kiểm chứng trên bản build production: nonce
  trong header khớp 10/10 thẻ script.
- **Đổi mã mời (mới, ADR-0003):** chủ sổ đổi được mã ngay trong panel
  chia sẻ — mã cũ chết tức thì, chỉ hash của mã mới được lưu; có lớp
  xác nhận nêu rõ hệ quả trước khi đổi. Đây là đường thu hồi khi mã bị
  lộ (trước đây chỉ còn cách xoá cả cuốn sổ).
- **SEC-07:** kiểm tra quyền với sổ không tồn tại chạy phép so hash
  mồi — thời gian phản hồi không còn phân biệt được "sổ không có" với
  "mã sai".
- **SEC-12:** mọi response API mang `Cache-Control: no-store`.
- Link chia sẻ `/?code=…` được phục vụ kèm `X-Robots-Tag: noindex,
  nofollow`; panel chia sẻ thêm lớp 2: xem trước link + cảnh báo hệ
  quả + nút xác nhận "Tôi hiểu, hiện nút chép link" mới hiện nút chép
  (hết chép link 1 chạm).
- Lỗi 503 của endpoint đọc ảnh không còn chứa tên biến môi trường —
  thông điệp tiếng Việt chung.
- CI mới (`.github/workflows/ci.yml`): typecheck / lint / format /
  test / build + quét secret (gitleaks) + audit dependency trên mọi
  push/PR; Dependabot mở PR cập nhật dependency hằng tuần (SEC-10).

### Tài liệu vận hành

- `ARCHITECTURE.md` + 4 ADR trong `docs/adr/` (không đăng nhập,
  hash-only, đổi mã, CSP nonce).
- `docs/RUNBOOK-ROLLBACK.md` — hai đường rollback + kiểm chứng sau
  rollback + kỷ luật schema cộng thêm.
- `THIRD-PARTIES.md` — khai báo dịch vụ/thư viện và dữ liệu rời hệ
  thống; `SECURITY.md` + `public/.well-known/security.txt` — kênh báo
  lỗ hổng qua GitHub Security Advisories.

## [1.0.0] — 2026-10-23 — bản đang chạy production

- **Redesign-v2 «The Command Ledger»** (commit `2d3f515`): rail 3
  tầng + thanh lệnh chung + bảng sổ; hệ giọng theo loại đám
  (`lib/lexicon.ts`, 5 nhóm × 13 loại — đám tang/giỗ dùng từ trang
  trọng riêng, cấm đỏ sơn mài + hình phong bì ở ngữ cảnh tang/giỗ);
  service worker viết tay `sodam-shell-v2`; hợp đồng hành vi §1.7 giữ
  nguyên.
- Gỡ mã mời đang sống khỏi README công khai (commit `5c50884`) + bộ
  ảnh chụp thật trên bản v2 và rà soát README (commit `bddb9c4`).

### Nền móng trong cùng ngày (trước 1.0.0)

- Đợt chức năng (commit `bc1bde2`): mã mời 16 ký tự chỉ lưu hash
  SHA-256 + throttle khi join (10 lần sai / 15 phút → 429) — SEC-08;
  sửa/xoá khoản + hoàn tác trả lễ; bỏ khoản mặc định 500.000₫ âm thầm;
  OCR thu quảng cáo + ẩn lối vào (production không có khoá AI).
- Vá API (commit `1759ab7`): trần Int4 cho mọi số tiền vào (400 tiếng
  Việt, hết rò lỗi Prisma), thông điệp 500 chung, giới hạn độ dài
  trường chữ, CSP cho route API.
- Bỏ đăng nhập (commit `6fcdf3f`): mã mời của cuốn sổ là credential
  duy nhất (ADR-0001).
- Bản phát hành độc lập đầu tiên (commit `2180ec8`, 2026-10-22).

## Bảng cặp tag ↔ deployment

| Phiên bản | Commit | Ngày deploy | Ghi chú |
|---|---|---|---|
| 1.1.1 | `bc1635b` | 2026-10-24 | Hotfix SEC-10 (next 16.4.2 + deepmerge-ts ^8); CI xanh cả audit; tag v1.1.1 tại commit kế tiếp (chỉ bổ sung dòng này) |
| 1.1.0 | `cc1c42b` | 2026-10-24 | Tag v1.1.0 gắn tại commit kế tiếp (chỉ bổ sung dòng này) |
| 1.0.0 | `bddb9c4` | 2026-10-23 | Đã gắn tag v1.0.0 |
