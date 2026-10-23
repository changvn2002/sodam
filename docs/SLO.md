# SLO — Mục tiêu mức dịch vụ của Sổ Đám (OPS-10a)

Tài liệu này khai các mục tiêu dịch vụ **theo quy mô thật** của Sổ Đám:
một ứng dụng gia đình, lưu lượng thấp, một route nội dung, dữ liệu trong
Neon PostgreSQL, phục vụ qua Vercel. SLO viết cho quy mô này — không sao
chép các con số của hệ thống lớn — và mỗi mục tiêu ghi rõ **cách đo hiện
có**; những gì chưa có công cụ đo thì nói thẳng là chưa đo được thay vì
vẽ số.

## Mục tiêu

| Hạng mục | Mục tiêu | Cách đo hiện có |
|---|---|---|
| Khả dụng trang chủ + API | ≥ 99,9% cửa sổ 30 ngày trượt (ngân sách lỗi ≈ 43 phút/tháng) | Vercel deployment status + kiểm tra thủ công theo `docs/RUNBOOK-ROLLBACK.md` mục kiểm chứng. **Chưa có uptime monitor ngoài** — đây là khoảng trống đã biết (OPS-08), SLO này không giả vờ đã đo liên tục. |
| Độ trễ API (đọc sổ: dashboard / events / returns) | p95 < 800 ms đo phía máy chủ trong region `iad1` | Chưa có dashboard độ trễ tự động; đo điểm bằng `curl -w` từ khu vực gần region khi có sự cố hoặc sau thay đổi lớn (ghi kết quả vào postmortem nếu là sự cố). |
| Độ trễ ghi khoản (tạo/sửa entry) | p95 < 1.200 ms trong điều kiện mạng bình thường | Đo điểm như trên. Phía người dùng: hàng chờ offline (IndexedDB outbox) là cơ chế chịu lỗi chính thức khi mạng chập chờn — khoản ghi không mất dù API chậm/sập tạm thời. |
| Toàn vẹn dữ liệu tiền | 0 sai lệch: tổng theo người = tổng theo sự kiện = tổng theo sổ trên mọi trạng thái dữ liệu | Test bất biến property-style `lib/server/money-invariants.spec.ts` chạy trong CI mỗi push/PR (CQ-09); battery hardening ở `app/api/products/sodam/hardening.spec.ts`. |
| Khôi phục dữ liệu (RPO/RTO khi sự cố dữ liệu) | RPO ≤ thời điểm snapshot Neon gần nhất; RTO ≤ 1 giờ theo quy trình khôi phục | Quy trình ở `docs/RUNBOOK-INCIDENT.md` (chương khôi phục dữ liệu). Kỷ luật snapshot trước thay đổi phá huỷ ở `docs/RUNBOOK-ROLLBACK.md`. |
| Thời gian phản hồi sự cố | SEV-1: bắt đầu xử lý ≤ 1 giờ kể từ khi phát hiện; thông báo trạng thái cho người dùng bị ảnh hưởng ngay khi có kết luận đầu tiên | Phân loại mức độ + escalation ở `docs/RUNBOOK-INCIDENT.md`. |

## Ngoài phạm vi SLO này

- Độ trễ/độ khả dụng của các dịch vụ ngoài tầm kiểm soát (Vercel, Neon)
  theo SLA của chính họ — sự cố phía họ xử lý theo runbook sự cố với
  phân loại "phụ thuộc ngoài".
- Tính năng AI tuỳ chọn: không thuộc SLO (mặc định tắt trên production;
  khi bật, độ trễ thuộc về nhà cung cấp AI đã cấu hình).

## Rà soát

- Rà soát SLO mỗi lần phát hành minor hoặc sau mỗi postmortem SEV-1/2:
  cập nhật cột "cách đo" khi có công cụ đo mới, và hạ/nâng mục tiêu chỉ
  bằng số đo thật, không bằng cảm tính.
