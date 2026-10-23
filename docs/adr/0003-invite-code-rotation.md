# ADR-0003: Đổi mã mời là đường thu hồi quyền (DATA-04(ii))

- Trạng thái: Đã chấp nhận (2026-10-23, đợt fix sau Panel #02)
- Bối cảnh: Một mã mời đang sống từng bị in công khai trong README
  (hồ sơ chấm vòng 2, SEC-12.5). Khi đó hệ thống không có bất kỳ đường
  thu hồi nào ngoài xoá cả cuốn sổ. Một credential không thu hồi được
  là không chấp nhận được.

## Quyết định

- Endpoint `POST /api/products/sodam/books/:bookId/rotate-code`, xác
  thực bằng mã hiện tại qua `requireBookAccess` như mọi route cấp sổ.
- Đổi mã = một `update` nguyên tử: `inviteCodeHash` ← hash của mã mới,
  `inviteCode` ← null. Không tồn tại cửa sổ hai mã cùng sống; mã cũ
  chết ngay tại thời điểm ghi.
- Mã mới theo đúng kỷ luật ADR-0002 (16 ký tự, chỉ lưu hash, plaintext
  chỉ có trong response).
- Client: lớp http tự ghi mã mới vào đăng ký thiết bị; UI đổi mã nằm
  trong panel chia sẻ, sau một lớp xác nhận nêu hệ quả nguyên văn
  (thiết bị khác giữ mã cũ mất quyền, link đã gửi chết).

## Hệ quả

- Sự cố lộ mã từ nay xử lý được bằng một thao tác trong app thay vì
  xoá sổ.
- Người giữ mã nào cũng đổi được mã (hệ quả của ADR-0001) — chấp nhận
  vì mô hình gia đình tin cậy lẫn nhau; đổi mã có toast xác nhận để
  không âm thầm.
