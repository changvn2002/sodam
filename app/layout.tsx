import type { Metadata, Viewport } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, siteUrl } from '@/lib/site';
import './globals.css';

/*
 * Fonts are self-hosted via Fontsource — the same families, weights and
 * subsets the host loaded through next/font/google (Be Vietnam Pro latin +
 * vietnamese 400–700, Outfit latin 500–700, Playfair Display latin +
 * vietnamese 500–700), but bundled with the app so production builds never
 * depend on reaching Google Fonts. The CSS variables (--font-sans,
 * --font-display, --font-serif-vn) are defined in globals.css.
 *
 * Serif có đủ dấu tiếng Việt cho tiêu đề Sổ Đám. Tuyệt đối không dùng
 * Georgia/Times hệ thống: thiếu glyph tiền tố hợp, dấu tiếng Việt bị
 * chồng/lệch trên Windows.
 */
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';

export const viewport: Viewport = {
  themeColor: '#07332b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'sổ đám',
    'sổ mừng cưới',
    'ghi tiền mừng',
    'trả lễ',
    'sổ đám cưới',
    'phong bì cưới',
    'sổ giỗ',
    'quản lý tiền mừng',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Sổ Đám — sổ ghi lễ cho đám cưới, đám giỗ và các dịp lễ Việt Nam',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  category: 'finance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
