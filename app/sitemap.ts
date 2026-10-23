import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  // App hiện có đúng một route trang: "/" (toàn bộ trải nghiệm nằm trong một
  // màn hình). lastModified bổ sung theo QA Portfolio audit #01 (2026-10-23)
  // cho đồng bộ với dichbome.
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
