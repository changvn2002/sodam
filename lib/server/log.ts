import { createHash } from 'node:crypto';

/**
 * SEC-13 (re-grade r3, RECOMMENDED): log sự kiện bảo mật có cấu trúc.
 *
 * Trước đây server chỉ có `console.error(err)` ở http.ts — sự kiện throttle
 * mở sổ và sự kiện đổi mã mời không để lại dấu vết vận hành nào. Helper này
 * ghi MỘT dòng JSON qua console (log của nền tảng host thu thập), không
 * tracker ngoài, không endpoint ngoài.
 *
 * Kỷ luật dữ liệu trong log (bắt buộc):
 * - KHÔNG log mã mời (plaintext hay hash của mã) — mã mời là credential.
 * - KHÔNG log IP đầy đủ — chỉ ghi `ipHash`: SHA-256 của IP, rút gọn 16 ký
 *   tự hex đầu. Đủ để tương quan các lần thử từ cùng một nguồn trong cửa
 *   sổ vận hành, không đủ để khôi phục IP.
 */
export function hashIpForLog(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export function logSecurityEvent(
  event: string,
  fields: { route?: string; ip?: string; bookId?: string } = {},
) {
  const line: Record<string, string> = {
    ts: new Date().toISOString(),
    level: 'security',
    event,
  };
  if (fields.route) line.route = fields.route;
  if (fields.ip) line.ipHash = hashIpForLog(fields.ip);
  if (fields.bookId) line.bookId = fields.bookId;
  console.info(JSON.stringify(line));
}
