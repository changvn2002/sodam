/**
 * Public base URL of this deployment — used for metadata, sitemap, robots and JSON-LD.
 * Defaults to this repo's projected Vercel domain; set NEXT_PUBLIC_SITE_URL at deploy
 * time when a custom domain exists — no code change needed.
 */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sodam-tawny.vercel.app').replace(/\/$/, '');
}

export const SITE_NAME = 'Sổ Đám';
export const SITE_TAGLINE = 'Nhận lễ, trả lễ, với ai — ghi bằng lời nói, như sổ dưới quê.';
export const SITE_DESCRIPTION =
  'Sổ Đám là sổ ghi tiền mừng cưới, đám giỗ, đám tang, mừng thọ và các dịp lễ Việt. Ghi lễ bằng giọng nói, theo dõi trả lễ, dùng chung cả nhà bằng mã mời, xem cây họ.';
