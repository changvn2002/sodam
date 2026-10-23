import { SodamApp } from '@/components/sodam/app';
import { FAQS } from '@/lib/faq';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

/**
 * Honest structured data: only verifiable facts about the app itself, plus
 * an FAQPage built from the exact same FAQS data the visible FAQ section
 * renders (lib/faq.ts) — structured data must match on-page content.
 * The SEO sections themselves render inside the app, only on the home view
 * below the fold — never under an open book's workspace (panel ST-3).
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${siteUrl()}/`,
      inLanguage: 'vi',
    },
    {
      '@type': 'WebApplication',
      name: SITE_NAME,
      alternateName: 'Sodam',
      url: `${siteUrl()}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      inLanguage: 'vi',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <SodamApp />
    </>
  );
}
