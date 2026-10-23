#!/usr/bin/env node
/**
 * Kiểm ngân sách JS (PERF-08) từ output build thật — mirror mẫu chiatien
 * (scripts/check-bundle-budget.mjs), thích ứng với sodam:
 * - Route '/' của sodam render ĐỘNG (CSP nonce từng request, ADR-0004)
 *   nên không có .next/server/app/index.html để đọc <script src> như
 *   chiatien. Tập JS trên critical path của lần tải đầu route '/' =
 *   hợp của:
 *     (a) rootMainFiles trong .next/build-manifest.json (runtime +
 *         framework, nạp trên mọi route), và
 *     (b) mọi chunk JS mà .next/server/app/page_client-reference-manifest.js
 *         của route '/' tham chiếu (client modules của trang).
 * - Gzip từng file (zlib, level 9) và cộng tổng — xấp xỉ JS transfer size
 *   trên đường truyền (phép đo chuẩn của mục là Lighthouse trên live;
 *   job này là hàng rào CI chống phình, số tuyệt đối có thể lệch nhẹ).
 * - So với perf-budget.json: vượt ngân sách đã khai HOẶC vượt trần cứng
 *   300 KB của checklist -> exit 1.
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const budget = JSON.parse(readFileSync(path.join(root, 'perf-budget.json'), 'utf8'));

const buildManifestPath = path.join(root, '.next/build-manifest.json');
const pageManifestPath = path.join(root, '.next/server/app/page_client-reference-manifest.js');
if (!existsSync(buildManifestPath) || !existsSync(pageManifestPath)) {
  console.error(
    'Chưa có output build (.next/build-manifest.json / page_client-reference-manifest.js) — chạy `pnpm build` trước.',
  );
  process.exit(2);
}

const files = new Set();
const buildManifest = JSON.parse(readFileSync(buildManifestPath, 'utf8'));
for (const f of buildManifest.rootMainFiles ?? []) {
  if (f.endsWith('.js')) files.add(f);
}
const pageManifest = readFileSync(pageManifestPath, 'utf8');
for (const m of pageManifest.matchAll(/"((?:\/_next\/)?static\/chunks\/[^"]+\.js)"/g)) {
  files.add(m[1].replace(/^\/?_next\//, ''));
}

let total = 0;
const rows = [];
for (const rel of files) {
  const file = path.join(root, '.next', rel);
  const raw = readFileSync(file);
  const gz = gzipSync(raw, { level: 9 }).length;
  total += gz;
  rows.push({ rel, rawBytes: raw.length, gzipBytes: gz });
}
rows.sort((a, b) => b.gzipBytes - a.gzipBytes);
for (const r of rows) {
  console.log(
    `${String(r.gzipBytes).padStart(9)} B gzip  ${String(r.rawBytes).padStart(9)} B raw  /_next/${r.rel}`,
  );
}
console.log(
  `TỔNG JS critical path route '/': ${total} B gzip (${(total / 1024).toFixed(1)} KiB) / ngân sách ${budget.firstRouteJsGzipBudgetBytes} B, trần cứng ${budget.hardCapBytes} B`,
);
if (total > budget.hardCapBytes) {
  console.error(`FAIL: vượt trần cứng PERF-08 (${budget.hardCapBytes} B).`);
  process.exit(1);
}
if (total > budget.firstRouteJsGzipBudgetBytes) {
  console.error(
    `FAIL: vượt ngân sách đã khai trong perf-budget.json (${budget.firstRouteJsGzipBudgetBytes} B). Muốn nới phải có ADR và không quá +10%/release (PERF-08).`,
  );
  process.exit(1);
}
console.log('PASS: JS critical path trong ngân sách.');
