# DESIGN.md — Sổ Đám (đề xuất, thay bản DESIGN.md hiện không tồn tại trong repo)

> File này là bản **đề xuất** trong gói redesign `~/workspace/mini-apps/redesign/sodam/`.
> Khi implement, chép nguyên văn thành `DESIGN.md` ở gốc repo sodam và đồng bộ token
> vào `app/globals.css`. Định dạng theo Impeccable (rule 08). Mọi con số tương phản /
> bằng chứng font nằm ở DESIGN-LANGUAGE.md của gói redesign — file này là bản normative rút gọn để code theo.

## Creative North Star — "The Indigo Ledger" (Sổ Chàm)

Cuốn sổ kế toán nhuộm chàm của một gia đình Việt: bìa chàm đậm, giấy kẻ ngang, số
tiền ngay cột bằng mực mono. Tĩnh, chính xác, lưu được lâu. Không fintech neon,
không serif hoài cổ trang trí, không thẻ bay.

## Color

| Token | Hex | Dùng cho |
|---|---|---|
| `--indigo-950` | `#161A3D` | AppBar, Băng tổng, bìa sổ trong mark |
| `--indigo-900` | `#1E2456` | Brand, nền logo tile |
| `--indigo-700` | `#323C85` | Hành động chính, link, chọn |
| `--indigo-600` | `#414DA3` | Hover hành động chính |
| `--indigo-500` | `#5B67B8` | Focus ring (5,15:1 trên trắng) |
| `--indigo-100` | `#D8DCF2` | Chữ phụ trên nền chàm đậm (10,71:1) |
| `--indigo-50` | `#F0F1F8` | Nền chọn/tint, segmented |
| `--paper` | `#F5F5F7` | Nền trang |
| `--card` | `#FFFFFF` | Nền bảng/thẻ |
| `--ink` | `#17192B` | Chữ chính |
| `--muted` | `#565B73` | Chữ phụ (≥5,94:1 trên mọi nền sáng được dùng) |
| `--line` | `#DFE1EC` | Hairline trang trí — không bao giờ là biên nhận biết duy nhất |
| `--line-strong` | `#7E85AB` | Viền input/control (≥3,31:1) |
| `--lacquer` | `#B3352C` | Chỉ: tiền đi/trả lễ, phong bì trong art, cảnh báo phá hủy |
| `--gold` | `#C9A24B` | Chỉ trong artwork — cấm làm chữ trên nền sáng |
| `--gold-ink` / `--gold-soft` | `#7A5A14` / `#F3E5C3` | Chữ / nền chip âm lịch (5,09:1) |
| `--amber-ink` / `--amber-soft` | `#7C4A03` / `#FBF0D9` | Pill "Chờ trả" (6,54:1) |
| `--green-ink` | `#1E7A46` | Pill "Đã trả" (luôn kèm icon + chữ) |
| `--cream` | `#F7F3E8` | Giấy trong artwork/logo |

Shadow vocabulary (trung tính, đóng): `--shadow-card: 0 1px 2px rgba(23,25,43,.05), 0 8px 24px rgba(23,25,43,.06)` · `--shadow-lift: 0 2px 4px rgba(23,25,43,.06), 0 16px 40px rgba(23,25,43,.10)`.

## Typography

- **IBM Plex Sans** 400/500/600/700 — mọi chữ giao diện. **IBM Plex Mono** 500/600 —
  mọi số tiền, mã mời, cột số (`tabular-nums`). Self-host qua Fontsource, subset
  `latin` + `vietnamese` (đã kiểm glyph: khối U+1EA0–U+1EF9 đủ 90/90 ở cả hai họ;
  số tabular theo cấu tạo — bằng chứng ở DESIGN-LANGUAGE.md §4).
- Thang: Display 28/700 · Headline 20/600 · Title 17/600 · Body 16/400 · Label
  14/500 · Caption 12/500 · Amount-L 20 Mono 600 · Amount 15 Mono 500–600.
- Input luôn ≥16px. Không serif. Không kicker in hoa tracking rộng.

## Layout

- Pattern: **dashboard lưới thẻ (tổng quan) + bảng sổ cái table-first (danh sách)**.
- Tổng quan = một Băng tổng chàm chia ô bằng hairline, không stat-card rời.
- Danh sách khoản = bảng; mobile thu thành dòng sổ nhưng cột tiền luôn phải + mono.
  Bảng cuộn trong khung riêng, header cột dính — trang không dài theo dữ liệu.
- Mọi form tạo/sửa nằm trong bottom sheet (mobile) / dialog (desktop).
- Sticky: trên = AppBar + tabs (một khối); dưới = thanh hành động (tổng + Ghi khoản).
- Spacing bội 4: 4/8/12/16/20/24/32/48; nhịp section luân phiên 24/32.
- Bo góc: bảng/thẻ 12px, nút 10px, pill 999px. Dòng bảng 52px mobile / 48px desktop.

## Components (signature đánh dấu *)

- `AppBar` — băng indigo-950, logo mark 32px, nút chia sẻ ≥44px.
- `KpiBand`* — 4 ô tổng trong một băng chàm, số Mono trắng, ô "Còn giữ" gạch chân gold 2px.
- `LedgerTable`* / `LedgerRow` — bảng sổ cái hairline; avatar chữ cái đầu indigo-50.
- `SegmentedTabs` — điều hướng trong sổ: Đám · Trả lễ · Người · Cây họ.
- `EntrySheet` — ghi khoản 3 mode (Gõ tay · Giọng nói · Ảnh) + dòng xem lại trước khi lưu.
- `StickyActionBar` — tổng (Mono) + nút Ghi khoản chàm đặc, ≥52px, safe-area.
- `InviteCodeChip` — mã mono nhóm 4-4-4, nút chép ≥44px, cho paste khi nhập.
- `StatusPill` — Chờ trả / Đã trả / Quá tay: icon + chữ, không chỉ màu.
- `SeasonStrip` — mùa lễ 1 hàng. `SeoAccordion` — nội dung SEO/FAQ, mặc định đóng.
- `EmptyLedger` — illustration sổ trống + 1 câu + 1 CTA.

## Named Rules

1. **No Gradient Rule** — 0 gradient trang trí trong CSS render.
2. **Flat Rows Rule** — ngăn hàng bằng hairline; cấm card lồng card và lưới thẻ đồng dạng cho nội dung tĩnh.
3. **One Indigo Rule** — chàm chỉ cho brand band, hành động chính, chọn/focus, link.
4. **Lacquer Rule** — sơn mài chỉ cho tiền đi/trả lễ, phong bì art, cảnh báo phá hủy.
5. **Numbers Are Mono Rule** — số liệu không bao giờ set bằng Sans.
6. **One Primary Action Rule** — mỗi màn hình đúng 1 hành động chính.
7. **Hairline Is Decoration Rule** — biên control thiết yếu dùng `--line-strong`.

## Motion

Sheet/dialog 240ms cubic-bezier(.22,1,.36,1); hàng mới 200ms ease-out; chuyển tab
160ms — chỉ `transform`/`opacity`. `prefers-reduced-motion`: hiện tức thì.
Cấm bounce/elastic và mọi animation ngoài danh mục này.

## Imagery

Phẳng, lì, đúng 4 màu hệ (chàm/kem/sơn mài/vàng): sổ mở, dòng kẻ chì đỏ, phong bì,
đồng tiền. Không người, không 3D, không bóng đổ mềm, không texture nhiễu. Logo mark
là SVG dựng tay (`assets/logo-mark.svg` trong gói redesign) — nguồn sự thật của mọi
icon PNG. Empty-state dùng `sodam-empty-ledger.webp`, không dùng ảnh skeleton xám.

## App shell & offline (ràng buộc cứng — W5-01)

- **Service worker là thành phần bắt buộc**: đăng ký từ lần tải đầu, precache app
  shell (document `/`, CSS/JS route đầu, font Plex subset latin + vietnamese,
  logo/icon, illustration empty-state) trong cache có phiên bản theo build. Mở app
  khi offline phải ra shell + trạng thái offline — không bao giờ ra trang lỗi
  trình duyệt. (Bằng chứng thiếu SW: F-W5-01/H5, Team Test đợt 01.)
- Dữ liệu sổ ở server: mở sổ/tạo sổ cần mạng; **API không cache** (`no-store`).
  Shell luôn mở được, phần cần mạng degrade bằng panel tiếng Việt thân thiện.
- Trạng thái offline có `OfflineBanner` dính dưới AppBar: "Đang offline — kiểm tra
  kết nối mạng." `OutboxChip` phản ánh hàng chờ IndexedDB thật (chỉ cho ghi khoản
  mới `createEntry`): "N khoản đang chờ gửi", tự flush khi có mạng trong cùng
  phiên, không mất khoản nào im lặng.
- **Cấm lộ lỗi thô**: chuỗi ngoại lệ ("Failed to fetch" — F-W5-05/M4) không bao
  giờ tới UI; mọi lỗi qua lớp ánh xạ sang thông điệp tiếng Việt theo tình huống
  (bảng chuẩn ở LAYOUT-SPEC §10.4 của gói redesign). Tạo sổ offline: giữ input +
  "Chưa có mạng — chưa tạo được sổ… bấm Thử lại khi có mạng." — không hứa tự tạo
  lại (việc tự đồng bộ tạo sổ là UNKNOWN chưa kiểm chứng theo W5).
- PWA installable phải đạt: SW + manifest standalone + icon bộ chàm mới +
  `theme_color` `#161A3D` (đồng bộ manifest ↔ meta). Nghiệm thu bằng Lighthouse
  Installable + test offline reload nguội + test outbox end-to-end (LAYOUT-SPEC §10.6).

## Anti-patterns (bản cũ — cấm tái phạm)

Gradient wash sau hero · nền lưới trang trí · 3 họ font song song · serif cho mọi
tiêu đề · input 14px · icon tile bo tròn trên mọi heading · stat-card rời cho mọi con
số · panel form chèn giữa trang · section SEO mở sẵn đẩy công cụ xuống · nút phụ
<44px trong header · avatar từ API bên thứ ba · không có service worker (chết khi
offline reload, không cài được PWA) · lộ chuỗi lỗi thô tiếng Anh của fetch lên UI.
