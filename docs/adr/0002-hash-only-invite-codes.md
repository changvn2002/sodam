# ADR-0002: Chỉ lưu hash của mã mời + throttle khi join (SEC-08)

- Trạng thái: Đã chấp nhận (2026-10-23)
- Bối cảnh: Nếu DB lưu mã mời dạng rõ, một lần rò DB là mọi cuốn sổ bị
  mở. Đồng thời endpoint join là bề mặt đoán mã công khai duy nhất.

## Quyết định

- Mã mới: 16 ký tự từ bảng 31 ký tự không gây nhầm (bỏ 0/O/1/I/L), sinh
  bằng `crypto.randomBytes` với rejection sampling — entropy ≈ 79.27
  bit. Chỉ SHA-256 của mã được lưu (`inviteCodeHash`, unique).
- So khớp bằng `timingSafeEqual` trên digest thô.
- Sổ cũ còn lưu mã dạng rõ được nâng cấp cơ hội (opportunistic): lần
  trình mã đúng đầu tiên sẽ ghi hash và xoá bản rõ.
- Join bị throttle: 10 lần thất bại / 15 phút theo IP và theo hash của
  mã thử → 429 tiếng Việt; join đúng xoá bộ đếm.
- Đường kiểm tra quyền (`requireBookAccess`) với sổ không tồn tại cũng
  chạy một phép so hash mồi để cân bằng timing với đường sổ thật
  (SEC-07).

## Hệ quả

- Quên mã = mất sổ (không có đường khôi phục). Giao diện phải nói rõ
  điều này ở các điểm tạo/chia sẻ sổ.
- Mọi tính năng cần "mã hiện tại" (đổi mã) đều xác thực qua mã người
  dùng đang giữ trên thiết bị, không qua DB dạng rõ.
