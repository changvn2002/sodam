import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      // Chỉ đo code sản phẩm — scripts/docs/config không tính vào mẫu số.
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'middleware.ts',
      ],
      thresholds: {
        // CQ-06 (hiệu chuẩn 2026-10-26, vitest 4): đặt tại số đo thật
        // 2026-10-26 trên cây sau nâng vitest 4.1.12 (suite đầy đủ 169
        // test, cấu hình include ở trên): ngưỡng = ceil(số đo − 3) để
        // hiệu thực tế đo − ngưỡng không vượt 3 điểm ở mọi chỉ số
        // (biên chống dao động giữa các máy nằm trong [2, 3]): đo
        // được statements 33.25% (941/2830) / branches 24.86%
        // (573/2304) / functions 28.85% (215/745) / lines 33.97%
        // (853/2511) → ngưỡng mới 31 / 22 / 26 / 31 (hiệu lần lượt
        // 2.25 / 2.86 / 2.85 / 2.97). Lý do hạ branches/functions từ
        // 70 / 75: vitest 4 đổi cách đếm coverage — mẫu số phình mạnh
        // so với v3 (hồ sơ XAPP-2: branches 724→2080, functions
        // 196→708; đo lần này branches 2304, functions 745) nên tỉ lệ
        // % giảm dù số test tăng 161→169. Nâng ngưỡng khi thêm test;
        // hạ ngưỡng phải có lý do — lý do lần này là ghi chú này +
        // mục CHANGELOG ngày 2026-10-26.
        statements: 31,
        branches: 22,
        functions: 26,
        lines: 31,
      },
    },
  },
});
