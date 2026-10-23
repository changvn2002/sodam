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
        // CQ-06: đặt tại số đo thật 2026-10-23 (suite đầy đủ, cấu hình
        // include ở trên) trừ biên nhỏ chống dao động giữa các máy:
        // đo được statements 29.14% / lines 29.14% / branches 72.93% /
        // functions 78.14%. Nâng ngưỡng khi thêm test; hạ ngưỡng phải
        // có ghi chú lý do trong CHANGELOG.
        statements: 27,
        branches: 70,
        functions: 75,
        lines: 27,
      },
    },
  },
});
