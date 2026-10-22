/**
 * Sinh các bản PNG phục vụ SEO/PWA từ SVG brand CHÍNH THỨC trong public/products/brand/:
 *   public/og.png                        1200×630 — ảnh Open Graph / Twitter card
 *   public/icons/icon-192.png            192×192  — icon PWA
 *   public/icons/icon-512.png            512×512  — icon PWA
 *   public/icons/icon-maskable-512.png   512×512  — icon maskable (logo 80% trên nền ngọc)
 *   public/icons/apple-touch-icon.png    180×180  — icon iOS
 *
 * Nguyên tắc brand: artwork KHÔNG bị sửa — không đổi màu, không vẽ lại, không cắt xén.
 * Script chỉ (1) raster hoá nguyên bản SVG ở kích thước đích, và (2) khi nền tảng bắt
 * buộc vùng an toàn/nền đục (maskable), đặt nguyên bản logo vào giữa nền #07332B — đúng
 * màu nền mà logo tự vẽ (theme color của app), nên liền mạch tuyệt đối. Riêng og.png:
 * hero chính thức 1200×800 được thu nguyên tỉ lệ theo chiều cao (×0.7875 = 945×630),
 * căn giữa; hai dải bên được lấp bằng CHÍNH trường màu gradient "wall" của hero
 * (cùng gradient userSpaceOnUse, chỉ nới rộng rect lấy mẫu) — không crop mất chi tiết
 * nào của tranh, không thêm màu ngoại lai. Apple touch icon: logo đã là một app icon
 * đục hoàn chỉnh (nền ngọc bo góc do artwork tự vẽ, giống app/icon.svg) nên raster
 * nguyên bản 180×180, iOS tự bo góc theo mask của nó.
 *
 * Cách chạy (cần @resvg/resvg-js — chỉ là tool sinh ảnh một lần, KHÔNG phải
 * dependency runtime của app nên không nằm trong package.json):
 *   mkdir -p ~/resvg-tool && cd ~/resvg-tool && npm init -y && npm i @resvg/resvg-js
 *   RESVG_DIR=~/resvg-tool node scripts/generate-brand-pngs.mjs
 * Nếu đã cài @resvg/resvg-js ngay trong repo thì chỉ cần: node scripts/generate-brand-pngs.mjs
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const anchor = process.env.RESVG_DIR
  ? path.join(process.env.RESVG_DIR, 'package.json')
  : path.join(root, 'package.json');
const { Resvg } = createRequire(anchor)('@resvg/resvg-js');

const JADE = '#07332B'; // nền logo tự vẽ + theme color của app

function readBrand(file) {
  return readFileSync(path.join(root, 'public/products/brand', file), 'utf8');
}

/** Nhúng nguyên bản một SVG vào khung lớn hơn: bỏ width/height gốc, gán x/y/width/height mới. */
function nest(svg, { x, y, width, height }) {
  return svg.replace(/<svg([^>]*?)>/, (_m, attrs) => {
    const cleaned = attrs.replace(/\swidth="[^"]*"/, '').replace(/\sheight="[^"]*"/, '');
    return `<svg x="${x}" y="${y}" width="${width}" height="${height}"${cleaned}>`;
  });
}

function render(svg, width, outFile) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
  const out = path.join(root, 'public', outFile);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log(`✓ ${outFile} (${png.length} bytes)`);
}

const logo = readBrand('sodam-logo.svg');
const hero = readBrand('sodam-hero.svg');

// Icon PWA thường: raster nguyên bản logo (nền ngọc bo góc là một phần của artwork).
render(logo, 192, 'icons/icon-192.png');
render(logo, 512, 'icons/icon-512.png');

// Icon maskable 512: logo chiếm 80% trong vùng an toàn, trên nền đúng màu logo tự vẽ.
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" fill="${JADE}"/>` +
    nest(logo, { x: 51, y: 51, width: 410, height: 410 }) +
    `</svg>`,
  512,
  'icons/icon-maskable-512.png',
);

// Apple touch icon 180: logo đã là app icon đục hoàn chỉnh — raster nguyên bản.
render(logo, 180, 'icons/apple-touch-icon.png');

// OG 1200×630: hero 1200×800 thu nguyên tỉ lệ theo chiều cao (×0.7875 = 945×630), căn giữa.
// Hai dải bên: nới rộng rect lấy mẫu của chính gradient "wall" (userSpaceOnUse nên cùng
// một trường màu toán học — hero bắt đầu ở local x=0 ↔ canvas x=127.5, hệ số 0.7875,
// suy ra canvas 0..1200 ↔ local −161.9048..1361.9048). Đổi id bản sao thành wallBg
// để không trùng id với defs của hero lồng bên trong.
const wallGradient = hero
  .match(/<linearGradient id="wall"[\s\S]*?<\/linearGradient>/)[0]
  .replace('id="wall"', 'id="wallBg"');
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<defs>${wallGradient}</defs>` +
    `<svg x="0" y="0" width="1200" height="630" viewBox="-161.9048 0 1523.8095 800">` +
    `<rect x="-161.9048" y="0" width="1523.8095" height="800" fill="url(#wallBg)"/>` +
    `</svg>` +
    nest(hero, { x: 127.5, y: 0, width: 945, height: 630 }) +
    `</svg>`,
  1200,
  'og.png',
);

if (!existsSync(path.join(root, 'public/og.png'))) {
  throw new Error('og.png was not written');
}
console.log('Done — brand artwork was only scaled/composited, never modified.');
