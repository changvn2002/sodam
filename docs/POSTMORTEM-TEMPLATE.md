# Postmortem — <tên sự cố ngắn gọn>

> Mẫu chuẩn (OPS-10a). Sao chép file này thành
> `docs/postmortems/YYYY-MM-DD-<slug-su-co>.md` và điền mọi mục; mục
> nào không áp dụng ghi rõ "không áp dụng + lý do", không xoá mục.
> Viết vô tư, không đổ lỗi cá nhân (blameless) — chỉ sự kiện, số đo và
> hành động.

- **Ngày sự cố:** YYYY-MM-DD
- **Mức độ:** SEV-1 / SEV-2 / SEV-3 (theo `docs/RUNBOOK-INCIDENT.md`)
- **Người xử lý:**
- **Trạng thái:** Đang xử lý / Đã khôi phục / Đã đóng

## 1. Tóm tắt

<2–4 câu: chuyện gì đã xảy ra, người dùng thấy gì, kết cục ra sao.>

## 2. Tác động

- Số sổ / người dùng bị ảnh hưởng (ước lượng kèm cách ước lượng):
- Thời gian ảnh hưởng: từ HH:MM đến HH:MM (múi giờ), tổng X phút:
- Dữ liệu: có mất/sai dữ liệu không? Phạm vi cụ thể:
- Đối chiếu SLO (`docs/SLO.md`): ngân sách lỗi tiêu tốn bao nhiêu?

## 3. Timeline

| Thời gian | Sự kiện |
|---|---|
| HH:MM | Phát hiện (ai/công cụ nào, tín hiệu gì) |
| HH:MM | Chẩn đoán: kết luận nguyên nhân tạm thời |
| HH:MM | Hành động giảm thiểu (mitigation) |
| HH:MM | Khôi phục hoàn toàn + kiểm chứng |

## 4. Nguyên nhân gốc

<Nguyên nhân kỹ thuật đến tận gốc (5 Whys nếu cần). Phân biệt rõ:
trigger (cái châm ngòi) ≠ root cause (cái làm hệ thống dễ vỡ).>

## 5. Vì sao không phát hiện sớm hơn / vì sao lan rộng

<Điểm mù giám sát, thiếu test, thiếu cổng CI, kỷ luật vận hành nào bị
bỏ qua — trả lời trung thực; đây là phần tạo ra hành động cải tiến.>

## 6. Hành động khắc phục

| # | Hành động | Loại (code / test / quy trình / tài liệu) | Chủ sở hữu | Hạn | Trạng thái |
|---|---|---|---|---|---|
| 1 | | | | | |

## 7. Bài học mang sang nơi khác

<Điều gì đúng cho cả portfolio, không chỉ app này — ghi để các đợt
fix wave sau tham chiếu.>
