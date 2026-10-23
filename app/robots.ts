import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Book data is only reachable with an invite code; keep the API out.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
