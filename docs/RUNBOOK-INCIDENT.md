# Runbook: Ứng phó sự cố (Incident Response) — Sổ Đám (OPS-11)

Tài liệu này xử lý **sự cố khi hệ thống đang chạy**: dữ liệu sai, mã mời
lộ, dịch vụ sập. Nó KHÁC `docs/RUNBOOK-ROLLBACK.md` (đưa production về
bản code tốt gần nhất) — nhiều sự cố không cần rollback code, và
rollback code không cứu được sự cố dữ liệu/bảo mật. Khi sự cố là do bản
deploy hỏng gây ra, dùng cả hai: rollback trước theo
`RUNBOOK-ROLLBACK.md`, rồi xử lý phần dữ liệu/bảo mật theo tài liệu này.

Mục tiêu mức dịch vụ đối chiếu: `docs/SLO.md`. Sau mỗi sự cố SEV-1/2,
bắt buộc có postmortem theo `docs/POSTMORTEM-TEMPLATE.md`.

## 1. Phân loại mức độ

| Mức | Tiêu chí | Ví dụ | Thời gian bắt đầu xử lý |
|---|---|---|---|
| SEV-1 | Mất/sai dữ liệu diện rộng, hoặc lộ mã mời của sổ đang hoạt động, hoặc app sập hoàn toàn | DB bị ghi đè; mã mời của một sổ bị đăng công khai và sổ bị ghi bậy | ≤ 1 giờ |
| SEV-2 | Một phần chức năng hỏng hoặc dữ liệu sai ở phạm vi một sổ/một đám | Tổng tiền một đám sai; một sổ không mở được | ≤ 1 ngày làm việc |
| SEV-3 | Lỗi nhỏ, có đường vòng, không sai dữ liệu | Lỗi hiển thị; một endpoint phụ trả 500 lẻ tẻ | Hàng đợi bình thường |

Khi chưa rõ phạm vi: phân loại theo mức CAO hơn cho tới khi có bằng
chứng thu hẹp.

## 2. Chương khôi phục dữ liệu (Neon snapshot / branch)

Áp dụng khi dữ liệu bị xoá nhầm, ghi sai hàng loạt, hoặc schema bị
`db:push` phá huỷ.

1. **Đóng băng:** dừng mọi thao tác ghi vào sổ bị ảnh hưởng (thông báo
   người dùng nếu cần); KHÔNG chạy thêm `db:push` hay script ghi nào.
2. **Chụp trạng thái hiện tại:** tạo snapshot/branch của Neon ở thời
   điểm hiện tại TRƯỚC khi khôi phục — trạng thái "hỏng" vẫn là bằng
   chứng và là đường lui nếu khôi phục sai.
3. **Chọn điểm khôi phục:** Neon Console → database `sodam-db` →
   Branches / Point-in-time restore → chọn thời điểm ngay trước sự cố
   (đối chiếu timeline của postmortem).
4. **Khôi phục vào branch riêng trước**, kiểm chứng bằng cách trỏ tạm
   `DATABASE_URL` của một bản preview vào branch đó và mở thử các sổ bị
   ảnh hưởng (tổng tiền, số khoản, nghĩa vụ trả lễ). Không ghi đè
   production khi chưa kiểm chứng.
5. **Chuyển production sang dữ liệu đã khôi phục** (đổi `DATABASE_URL`
   trên Vercel hoặc promote branch theo cơ chế Neon), redeploy, rồi
   kiểm chứng theo mục "Kiểm chứng sau rollback" của
   `RUNBOOK-ROLLBACK.md`.
6. **Đối soát phần ghi sau điểm khôi phục:** các khoản ghi hợp lệ phát
   sinh giữa điểm khôi phục và thời điểm đóng băng sẽ không có trong
   bản khôi phục — liệt kê từ branch chụp ở bước 2 và nhập lại bằng tay
   (CSV export từ branch hỏng → import vào production) với sự đồng ý
   của chủ sổ.

## 3. Chương sự cố bảo mật (lộ mã mời)

Mô hình truy cập: mã mời là credential duy nhất (ADR-0001), máy chủ chỉ
lưu hash SHA-256 (ADR-0002) — lộ mã mời = lộ quyền đọc + ghi của cuốn
sổ đó, nhưng KHÔNG lộ sang sổ khác và không lộ được dữ liệu tài khoản
(không tồn tại tài khoản).

1. **Xác nhận phạm vi:** sổ nào, mã lộ ở đâu (ảnh chụp, README, link
   công khai…), từ khi nào. Kiểm tra sổ có khoản ghi bất thường không
   (khoản lạ, tên lạ, tổng nhảy bất thường).
2. **Thu hồi ngay:** chủ sổ (hoặc người vận hành cùng chủ sổ) dùng tính
   năng **Đổi mã mời** trong panel chia sẻ — mã cũ chết tức thì, chỉ
   hash của mã mới được lưu (ADR-0003). Đây là đường thu hồi chính
   thức; không cần xoá sổ.
3. **Dọn dữ liệu bị ghi bậy (nếu có):** xoá các khoản không thuộc về
   gia đình trong sổ; nếu phạm vi ghi bậy lớn hoặc không phân biệt
   được, chuyển sang Chương 2 (khôi phục dữ liệu) về thời điểm trước
   khi lộ.
4. **Gỡ nguồn lộ:** xoá/sửa nơi mã đã bị đăng (repo, ảnh chụp, tin
   nhắn công khai). Lưu ý lịch sử git: mã ĐÃ đổi ở bước 2 nên mã trong
   lịch sử vô hại, nhưng vẫn phải gỡ các bề mặt đang sống.
5. **Cấp mã mới cho gia đình** qua kênh riêng; nhắc lại nguyên tắc coi
   mã mời như mật khẩu (README, mục Quyền riêng tư).
6. **Ghi postmortem** kể cả khi không có thiệt hại dữ liệu — kênh lộ là
   bài học quy trình.

Sự cố bảo mật ở tầng mã nguồn/secret của DỰ ÁN (lộ `DATABASE_URL`,
khoá AI…): thu hồi/rotate secret tại nhà cung cấp ngay, cập nhật Vercel
env, redeploy, rà soát log truy cập của nhà cung cấp; quy trình báo cáo
lỗ hổng ở `SECURITY.md`.

## 4. Chương sự cố dữ liệu (ghi sai / xoá nhầm ở mức ứng dụng)

1. **Ghi sai một khoản:** sửa trực tiếp trong app (mặt Đám → sửa khoản)
   — tổng và nghĩa vụ trả lễ tự tính lại (bất biến được test ở
   `lib/server/money-invariants.spec.ts`). Không sửa thẳng DB cho lỗi
   mức này.
2. **Xoá nhầm một khoản:** khoản đã xoá không có thùng rác — nếu còn
   trong hàng chờ offline của thiết bị hoặc trong CSV đã xuất, nhập
   lại; nếu không, ghi lại từ trí nhớ của chủ sổ. Nghĩa vụ trả lễ gắn
   với khoản HOSTED tự đồng bộ theo khoản mới.
3. **Sai hàng loạt / không rõ phạm vi:** nâng mức độ lên SEV-2/1 và đi
   theo Chương 2 — đừng sửa tay từng dòng khi chưa biết tổng số dòng
   sai.
4. **Tổng tiền hiển thị sai nhưng dữ liệu gốc đúng:** đây là lỗi code,
   không phải sự cố dữ liệu — xử lý như bug thường (fix + test bất
   biến), không đụng vào DB.

## 5. Kênh liên lạc & escalation

- **Người dùng báo sự cố:** GitHub Issues
  (https://github.com/changvn2002/sodam/issues); lỗ hổng bảo mật đi
  đường riêng theo `SECURITY.md`, không đăng công khai.
- **Người vận hành xử lý:** chủ repo `changvn2002/sodam` — người có
  quyền Vercel (project sodam) + Neon (database `sodam-db`) là người
  duy nhất thực thi được Chương 2 và 3; nếu người đó không phản hồi
  trong khung thời gian của mức độ, leo thang trực tiếp cho chủ tài
  khoản Vercel/Neon (cùng chủ sở hữu dự án) — không tự tạo quyền truy
  cập mới cho bên thứ ba trong lúc sự cố.
- **Thông báo cho người dùng bị ảnh hưởng:** ngay khi có kết luận đầu
  tiên về phạm vi (dù chưa khôi phục xong): sổ nào, dữ liệu nào, đang
  làm gì, dự kiến bước tiếp theo. Sự cố SEV-1 phải có ít nhất một lần
  cập nhật trạng thái mỗi giờ cho tới khi khôi phục.
- **Sau sự cố:** postmortem theo mẫu trong vòng 3 ngày làm việc
  (SEV-1/2), hành động khắc phục vào hàng đợi fix wave kế tiếp.
