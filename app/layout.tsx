import type { Metadata, Viewport } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, siteUrl } from '@/lib/site';
import { SwRegister } from '@/components/sodam/ui/sw-register';
import './globals.css';

/*
 * Fonts are self-hosted via Fontsource: IBM Plex Sans (UI) + IBM Plex Mono
 * (mọi số tiền, mã mời) — subsets latin + vietnamese, glyph U+1EA0–U+1EF9
 * verified complete for both families (DESIGN-LANGUAGE §4). No other
 * families: one sans for text, one mono for numbers.
 */
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

export const viewport: Viewport = {
  themeColor: '#1F2328',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  verification: {
    google: '4vR-FfACE45r_MqkVxeYtSg9ZY_VjsLS137PyDewq5E',
  },
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
        url: '/og.jpg',
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
    images: ['/og.jpg'],
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
      <body className="font-sans antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
