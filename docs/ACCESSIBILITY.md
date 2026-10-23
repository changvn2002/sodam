# Tuyên bố khả năng tiếp cận — Sổ Đám (DOC-12)

Tài liệu này tuyên bố **trung thực** trạng thái khả năng tiếp cận hiện
tại của Sổ Đám: cái đã đo được, kèm nguồn đo; cái chưa đo thì nói là
chưa đo. Cập nhật mỗi khi có đợt đo mới.

## Mục tiêu

Sổ Đám hướng tới **WCAG 2.2 mức AA** cho toàn bộ các mặt chính (Tổng
quan / Đám / Trả lễ / Người / Cây họ) trên mobile và desktop.

## Đã đo — Panel #03 (2026-10-23, đo trên bản live bởi ghế Accessibility độc lập)

Nguồn: hồ sơ panel `ui-panels/sodam-panel-03.md` §4–§5 (ghế R4 —
Accessibility & số đo, đo trực tiếp trên production bằng audit
computed-style/DOM):

- **Tương phản chữ:** cặp tệ nhất đo được là **5,09:1**; **0/763 phần
  tử dưới 4,5:1** — đạt AA cho chữ thường trên toàn bộ bề mặt đã đo.
- **Vùng chạm:** **0/343 target dưới 44px**; target nhỏ nhất đo được
  đúng 44,0px — mọi nút/chip/ô nhập đều ≥ 44×44px.
- **Focus nhìn thấy được:** vòng focus của ô nhập đo **5,15:1** (kênh
  box-shadow) và 3,6:1 (kênh border) — cả hai ≥ 3:1 theo WCAG 2.2 cho
  chỉ báo focus.
- Font chữ nhỏ nhất toàn hệ: 12px (badge trạng thái, tương phản 6,54:1).

## Khoảng trống đã biết

- **Gói bằng chứng A11Y-EV chưa chạy**: chưa có lượt quét tự động bằng
  axe/Playwright trên toàn bộ mặt + trạng thái (A11Y-12). Các số ở trên
  là đo thủ công theo mẫu của một ghế panel, không phải quét toàn
  diện — không tuyên bố "đạt WCAG" ở mức chứng nhận.
- **Ngữ nghĩa trang Người (đang sửa):** Panel #03 ghi một khiếm khuyết
  mức MEDIUM — hai cột số tiền ở trang Người thiếu nhãn xác định được
  bằng chương trình (không `th`/aria-label), khiến trình đọc màn hình
  không gán được nghĩa cho số. Đợt fix sau Panel #03 đang xử lý mục này;
  tuyên bố sẽ cập nhật khi có đo lại.
- Chưa kiểm chứng toàn trình với trình đọc màn hình thật (NVDA/VoiceOver)
  trên mọi luồng (tạo sổ, ghi khoản, trả lễ, cây họ).

## Cam kết duy trì

- Mọi thay đổi giao diện phải giữ sàn: tương phản ≥ 4,5:1 cho chữ,
  target ≥ 44px, focus nhìn thấy ≥ 3:1 — panel chấm giao diện của dự án
  đo lại các số này trên bản live ở mỗi đợt redesign.
- Báo vấn đề tiếp cận qua GitHub Issues:
  https://github.com/changvn2002/sodam/issues (gắn nhãn accessibility
  nếu có thể mô tả).
