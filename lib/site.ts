/**
 * Public base URL of this deployment — used for metadata, sitemap, robots and JSON-LD.
 * Defaults to this repo's projected Vercel domain; set NEXT_PUBLIC_SITE_URL at deploy
 * time when a custom domain exists — no code change needed.
 */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sodam.vercel.app').replace(/\/$/, '');
}

export const SITE_NAME = 'Sổ Đám';
export const SITE_TAGLINE = 'Nhận lễ, trả lễ, với ai — nói hoặc chụp ảnh như sổ dưới quê.';
export const SITE_DESCRIPTION =
  'Sổ Đám — sổ ghi tiền mừng cưới, đám hỏi, đám tang, giỗ, mừng thọ và các dịp lễ của người Việt. Ghi lễ bằng giọng nói hoặc chụp ảnh sổ tay, theo dõi nghĩa vụ trả lễ, đồng sổ gia đình bằng mã mời và xem cây họ.';
