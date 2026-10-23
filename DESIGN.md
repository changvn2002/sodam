# DESIGN.md — Sổ Đám

## Creative North Star — "The Command Ledger" (Sổ Cái Có Khung Sườn)

Một workspace liên tục: rail chàm kể rõ đang ở sổ nào, đám nào, mặt nào; thanh
ghi nhanh với tới được ở mọi mặt; bảng sổ cái là trung tâm. Chàm của mực sổ,
số tiền ngay cột bằng mono, giọng chữ đổi theo loại đám — tang sự không bao
giờ mang chữ của hỷ sự.

## Color

| Token | Hex | Dùng cho |
|---|---|---|
| `--indigo-950` / `--rail` | `#161A3D` | Rail, header, bìa sổ trong mark |
| `--indigo-900` | `#1E2456` | Brand, nền logo tile |
| `--indigo-800` | `#28306E` | Chỉ nền hover trên rail — không mang chữ |
| `--indigo-700` | `#323C85` | Hành động chính, link, chọn, accent nhóm HỶ |
| `--indigo-600` | `#414DA3` | Hover hành động chính |
| `--indigo-500` | `#5B67B8` | Focus ring trên nền sáng (5,15:1) |
| `--indigo-100` | `#D8DCF2` | Chữ phụ trên nền chàm đậm; focus ring trên rail |
| `--indigo-50` | `#F0F1F8` | Nền chọn/tint, segmented, pill chờ gửi |
| `--solemn-700` | `#3B4054` | Accent nhóm TANG (chip chọn, dải meta) — chàm trầm khói |
| `--solemn-soft` | `#EDEEF3` | Nền soft nhóm TANG |
| `--memorial-700` | `#54452A` | Accent nhóm GIỖ — nâu trầm |
| `--memorial-soft` | `#FBF6EA` | Nền soft nhóm GIỖ |
| `--paper` | `#F5F5F7` | Nền trang |
| `--card` | `#FFFFFF` | Nền bảng |
| `--ink` | `#17192B` | Chữ chính |
| `--muted` | `#565B73` | Chữ phụ + placeholder (hex đặc, không alpha) |
| `--line` | `#DFE1EC` | Hairline trang trí — không bao giờ là biên nhận biết duy nhất |
| `--line-strong` | `#7E85AB` | Viền input/control (≥3,31:1) |
| `--lacquer` | `#B3352C` | Chỉ: tiền đi/trả lễ, cảnh báo phá hủy. **Cấm trên bề mặt tang/giỗ và cấm làm accent loại đám** |
| `--gold` | `#C9A24B` | Chỉ trong artwork + gạch tổng — cấm làm chữ trên nền sáng |
| `--gold-ink` / `--gold-soft` | `#7A5A14` / `#F3E5C3` | Chữ / nền chip âm lịch; accent nhóm MỪNG THỌ |
| `--amber-ink` / `--amber-soft` | `#7C4A03` / `#FBF0D9` | Pill "Chờ trả" |
| `--green-ink` | `#1E7A46` | Pill "Đã trả" (luôn kèm icon + chữ) |
| `--cream` | `#F7F3E8` | Giấy trong artwork/logo |

Shadow (trung tính, đóng): `--shadow-card: 0 1px 2px rgba(23,25,43,.05), 0 8px 24px rgba(23,25,43,.06)` · `--shadow-lift: 0 2px 4px rgba(23,25,43,.06), 0 16px 40px rgba(23,25,43,.10)`.

## Contrast — đo trên nền thật (WCAG 2.2 từ hex)

Phương pháp: tính trên cặp nền thật chữ sẽ nằm trên; chữ không dùng alpha.
Mọi cặp chữ thường ≥4,5:1; biên/focus ≥3:1.

| Cặp | Tỉ lệ | Ghi chú |
|---|---|---|
| Trắng trên `--indigo-950` | 16,81:1 | chữ trên rail |
| Trắng trên `--indigo-700` (nút chính, chip HỶ chọn) | 9,90:1 | |
| Trắng trên `--solemn-700` (chip TANG chọn) | 10,26:1 | đo v2 |
| Trắng trên `--memorial-700` (chip GIỖ chọn) | 9,29:1 | đo v2 |
| Trắng trên `--gold-ink` (chip MỪNG THỌ chọn) | 6,36:1 | đo v2 |
| Trắng trên `--muted` (chip KHÁC chọn) | 6,69:1 | |
| `--indigo-100` trên `--indigo-900` | 10,71:1 | chữ phụ trên chàm đậm |
| `--ink` trên `--paper` / `--card` | 15,93 / 17,35:1 | |
| `--muted` trên `--card` / `--paper` / `--indigo-50` | 6,69 / 6,14 / 5,94:1 | gồm placeholder |
| `--solemn-700` trên `--solemn-soft` | 8,85:1 | dải meta đám tang |
| `--memorial-700` trên `--memorial-soft` | 8,61:1 | dải meta đám giỗ |
| `--gold-ink` trên `--gold-soft` | 5,09:1 | chip âm lịch, meta mừng thọ |
| `--lacquer` trên `--card` | 6,07:1 | |
| `--amber-ink` trên `--amber-soft` | 6,54:1 | |
| `--green-ink` trên `--card` | 5,35:1 | |
| `--indigo-500` (focus, phi-chữ) trên `--card` | 5,15:1 | ≥3:1 ✓ |
| `--line-strong` (viền input) trên `--card` / `--paper` | 3,60 / 3,31:1 | ≥3:1 ✓ |
| `--line` trên `--card` | 1,30:1 | chỉ hairline trang trí |

## Typography

- **IBM Plex Sans** 400/500/600/700 — mọi chữ giao diện. **IBM Plex Mono**
  500/600 — mọi số tiền, mã mời, cột số (`tabular-nums`). Self-host qua
  Fontsource, subset `latin` + `vietnamese` (kiểm lại 2026-10-23 bằng
  fontTools: U+1EA0–U+1EF9 đủ **90/90** ở Sans 500/700 + Mono 500/600, có ₫
  U+20AB trong cùng font với con số — bằng chứng ở DESIGN-LANGUAGE.md §5).
- Thang: Display 28/700 · Headline 20/600 · Title 17/600 · Body 16/400 ·
  Label 14/500 · Caption 12/500 · Amount-L 20 Mono 600 · Amount 15 Mono
  500–600. Sàn chữ chức năng 12px. Input luôn ≥16px. Không serif, không
  Outfit, không kicker in hoa tracking rộng.

## Layout — pattern "Command Ledger"

- **Rail trái 264px** (desktop ≥1024px): Sổ → Đám → Mặt. Mobile: rail thu
  thành khối trên dính (header + hàng chọn đám + điều hướng mặt nhãn đầy đủ)
  + thanh ghi nhanh ghim đáy.
- **Command bar** cố định trên vùng bảng: nút Ghi khoản + chọn đám + tìm +
  chip outbox (khi có hàng chờ). Composer ghi khoản mở từ đây ở **mọi mặt**.
- **Bảng là trung tâm:** mọi danh sách là một họ bảng — header cột dính, cuộn
  nội bộ, cột tiền phải + Mono. Trang không dài theo dữ liệu.
- **Dải tổng dính** trong khung sườn: 4 số của sổ bằng chữ trung tính + 1
  dòng công thức Mono.
- **Workspace chứa 0 khối SEO.** Nội dung SEO chỉ ở bề mặt công khai khi chưa
  mở sổ (accordion mặc định đóng, server-render).
- Spacing bội 4: 4/8/12/16/20/24/32/48; nhịp section luân phiên 24/32.
- Bo góc: bảng 12px, nút 10px, pill 999px. Hàng bảng 52px mobile / 48px desktop.
- Mọi control chạm ≥44px (gồm nút chép link, nút đóng sheet, chip thử-lại
  của outbox).

## Hệ giọng theo loại đám (tóm tắt — bảng đầy đủ ở DESIGN-LANGUAGE §3)

| Nhóm | Danh từ tổng | Người | Accent chip chọn |
|---|---|---|---|
| HỶ (cưới, hỏi, thôi nôi…) | Tổng mừng | Khách mừng | `--indigo-700` |
| TANG | Tổng phúng viếng | Người viếng | `--solemn-700` |
| GIỖ | Tổng tiền nhận | Khách đến dự | `--memorial-700` |
| MỪNG THỌ | Tổng mừng thọ | Khách mừng thọ | `--gold-ink` |
| KHÁC | Tổng tiền nhận | Người ghi | `--muted` |

Mọi chữ theo loại đám chỉ lấy từ bảng normative; icon hộp quà chỉ thuộc nhóm
hỷ; lacquer cấm trên tang/giỗ; ngữ cảnh tang/giỗ tắt animation ăn mừng.

## Components (signature đánh dấu *)

- `NavRail`* — rail 3 tầng Sổ → Đám → Mặt; đám đang chọn có accent theo nhóm
  giọng; cuối rail là vị trí cố định của `OutboxChip`.
- `CommandBar`* — Ghi khoản + chọn đám + tìm (phím `/`) + chip outbox (mobile).
- `QuickEntryComposer`* — composer 3 mode (Gõ tay · Giọng nói · Chụp ảnh) mở
  ở mọi mặt với ngữ cảnh đám; mode chưa khả dụng hiện panel trạng thái thiết
  kế (không lỗi thô); ô tiền luôn mở ở trạng thái trống; dòng xem lại bắt buộc.
- `LedgerTable`* / `LedgerRow` — bảng sổ cái hairline; avatar DiceBear
  `initials` local (seed = person id cho màu, glyph từ tên); meta nguồn chỉ
  là nhãn Ghi tay / Ghi miệng / Chụp ảnh.
- `TotalsStrip` — dải tổng dính của sổ (chữ trung tính) + công thức 1 dòng.
- `EntryExpand` — vùng mở trong hàng: sửa tại chỗ / xoá có xác nhận tại chỗ /
  trả lễ — mọi thao tác kèm Hoàn tác.
- `InviteCodeChip` — mã Mono nhóm 4 ký tự, nút chép ≥44px, cho paste khi nhập.
- `StatusPill` — Chờ trả / Đã trả / Đưa quá tay / Đang chờ gửi: icon + chữ.
- `OfflineBanner` — dính trong khối trên, chữ đầy đủ (mục offline dưới).
- `EmptyLedger` — illustration v2 + tiêu đề/câu theo nhóm giọng + 1 CTA.

## Named Rules

1. **No Gradient Rule** — 0 gradient trang trí trong CSS render.
2. **Flat Rows Rule** — ngăn hàng bằng hairline; cấm card lồng card, lưới thẻ đồng dạng cho nội dung tĩnh.
3. **One Indigo Rule** — chàm chỉ cho khung sườn, hành động chính, chọn/focus, link.
4. **Lacquer Rule** — sơn mài chỉ cho tiền đi/trả lễ + cảnh báo phá hủy; cấm trên tang/giỗ.
5. **Numbers Are Mono Rule** — số liệu không bao giờ set bằng Sans.
6. **One Primary Action Rule** — mỗi bề mặt đúng 1 hành động chính.
7. **Hairline Is Decoration Rule** — biên control thiết yếu dùng `--line-strong`.
8. **One Workspace Rule** — một khung sườn; 0 nội dung bề mặt khác trong workspace.
9. **Command Bar Rule** — ghi khoản mở được từ mọi mặt trong ≤1 chạm/phím tắt.
10. **Voice Follows Kind Rule** — chữ + accent + icon theo loại đám chỉ từ bảng normative.
11. **No Raw Internals Rule** — enum/tên công nghệ/thông điệp cấu hình không tới UI.
12. **Honest Feature Rule** — quảng bá = chạy thật trên production; chưa khả dụng = trạng thái thiết kế.
13. **Honest Amount Rule** — ô tiền trống là trống; không số mặc định câm.
14. **Reversible Money Rule** — thao tác tiền nào cũng sửa/hoàn tác được, có câu hệ quả tiếng người.
15. **Real-Background Contrast Rule** — contrast tính trên nền thật; chữ không alpha.
16. **Offline Truth Rule** — UI offline phản ánh đúng outbox thật (chỉ ghi khoản mới).

## Motion

Sheet/dialog 240ms cubic-bezier(.22,1,.36,1); hàng mới 200ms ease-out; chuyển
mặt (vùng bảng) 160ms cross-fade — chỉ `transform`/`opacity`.
`prefers-reduced-motion`: hiện tức thì. Ngữ cảnh tang/giỗ: tắt hiệu ứng hàng
mới + mọi animation ăn mừng. Cấm bounce/elastic và animation ngoài danh mục.

## Imagery

Phẳng, lì, đúng hệ màu: rail chàm + trang sổ kem + dòng kẻ + gạch vàng tổng.
Không người, không mặt, không 3D, không bóng mềm, không texture nhiễu, không
chữ do máy vẽ. Logo mark v2 là SVG dựng tay (`assets/logo-mark.svg` trong gói
redesign-v2) — nguồn sự thật của mọi icon PNG. Empty-state dùng
`assets/empty-state.webp`. Avatar người: DiceBear `initials` sinh local bằng
`@dicebear/core` + `@dicebear/collection` (ghim core ^9.4.3), seed màu = id
người, palette trang trọng của hệ; cấm DiceBear HTTP API; fallback monogram
tự vẽ khi thư viện lỗi — không bao giờ avatar trống.

## App shell & offline (ràng buộc cứng — W5-01)

- **Service worker bắt buộc**: đăng ký từ lần tải đầu, precache app shell
  (document `/`, CSS/JS route đầu, font Plex latin + vietnamese, logo/icon
  v2, illustration empty-state) trong cache có phiên bản theo build. Mở app
  offline ra shell + trạng thái offline — không bao giờ trang lỗi trình duyệt.
- Dữ liệu sổ ở server: mở sổ/tạo sổ cần mạng; **API không cache** (`no-store`).
- `OfflineBanner` dính trong khối trên: "Đang offline — kiểm tra kết nối
  mạng." `OutboxChip` ở vị trí cố định (cuối rail / thanh ghi nhanh mobile)
  phản ánh IndexedDB outbox thật — **chỉ ghi khoản mới (`createEntry`)**:
  "N khoản đang chờ gửi", tự flush trong cùng phiên khi có mạng, lỗi thì
  thành nút thử lại ≥44px. Hàng khoản chờ có pill "Đang chờ gửi". Sửa/xoá
  offline không vào hàng chờ và UI nói rõ điều đó.
- **Cấm lộ lỗi thô**: "Failed to fetch" và mọi chuỗi ngoại lệ không bao giờ
  tới UI; lỗi qua bảng ánh xạ tiếng Việt ở LAYOUT-SPEC §9.4. Tạo sổ offline:
  giữ input + thông điệp Thử lại — không hứa tự tạo lại.
- PWA installable: SW + manifest standalone + bộ icon v2 + `theme_color`
  `#161A3D` đồng bộ manifest ↔ meta. Nghiệm thu: Lighthouse Installable +
  offline reload nguội + outbox end-to-end (LAYOUT-SPEC §9.6).

## Anti-patterns (cấm tái phạm — từ panel #01)

Template hỷ cho tang (chữ "mừng" + hộp quà + chip đỏ trên đám tang) · enum thô
trên UI ("· MANUAL") · quảng cáo tính năng chết + lộ thông điệp cấu hình
("set OPENAI_API_KEY…") · SEO render trong workspace · ô tiền tự điền số ·
thao tác tiền 1 chạm không hoàn tác · khoản không sửa/xoá được · nút <44px ·
placeholder/meta bằng màu alpha mờ · font vá glyph (Outfit) · mono hệ thống
không có ₫ · avatar qua API bên thứ ba / avatar trống · nhãn nav cụt · tên sổ
tiền điền sẵn · lỗi mã sai im lặng hoặc sai vị trí · không service worker ·
lộ "Failed to fetch".
