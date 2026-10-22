import { SodamApp } from '@/components/sodam/app';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

/** Honest structured data: only verifiable facts about the app itself. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  alternateName: 'Sodam',
  url: `${siteUrl()}/`,
  description: SITE_DESCRIPTION,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  inLanguage: 'vi',
  browserRequirements: 'Requires JavaScript',
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SodamApp />
    </>
  );
}
