/**
 * B2 (Panel #03 / R3 MINOR): ô tiền trong form trả lễ phải bám theo tổng
 * khoản VỪA BỊ SỬA khi panel đang mở — nhưng chỉ khi người dùng chưa tự
 * sửa ô trả. Nếu họ đã gõ tay (touched), giữ nguyên số của họ; câu
 * xem-trước-hệ-quả luôn tính lại từ số hiện tại nên vẫn đúng trong cả
 * hai trường hợp.
 *
 * Trả về chuỗi số thô (chỉ chữ số) như state hiện tại của các form.
 */
export function nextReturnPay(input: {
  currentPay: string;
  nextReceived: number;
  touched: boolean;
}): string {
  if (input.touched) return input.currentPay;
  return String(Math.max(0, Math.round(input.nextReceived)));
}
