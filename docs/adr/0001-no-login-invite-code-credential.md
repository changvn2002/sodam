# ADR-0001: Không đăng nhập — mã mời là credential của cuốn sổ

- Trạng thái: Đã chấp nhận (2026-10-23)
- Bối cảnh: Người dùng mục tiêu là gia đình Việt dùng chung một cuốn sổ
  lễ. Hàng rào tài khoản/mật khẩu khiến người lớn tuổi bị loại khỏi vòng
  dùng chung; chủ dự án chốt "no-login" là yêu cầu sản phẩm.

## Quyết định

Không có tài khoản, không phiên đăng nhập. Mỗi cuốn sổ có một mã mời;
trình mã đúng (gõ tay, chép link, hoặc link `/?code=…`) là đủ quyền mở
sổ. Client giữ mã trong đăng ký localStorage của thiết bị; mọi request
cấp sổ gửi mã qua header `x-book-code`.

## Hệ quả

- Mã mời lộ = sổ lộ. Toàn bộ các lớp bảo vệ khác (hash-only, throttle,
  noindex link chia sẻ, cảnh báo 2 lớp khi chia sẻ, đổi mã thu hồi) tồn
  tại để giảm thiểu đúng rủi ro này — xem ADR-0002, ADR-0003.
- Không có khái niệm "chủ sổ" phân biệt với "người được mời": ai giữ mã
  cũng có toàn quyền, kể cả đổi mã. Đây là đánh đổi có ý thức cho mô
  hình gia đình.
- Mã sai và sổ không tồn tại phải không phân biệt được (404 giống hệt),
  nếu không mã trở thành thứ dò được theo book id.
