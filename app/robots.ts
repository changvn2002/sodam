import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // App data is behind login; keep auth/API surfaces out of the index.
        disallow: ['/api/', '/login'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
