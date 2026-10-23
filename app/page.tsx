import { SodamApp } from '@/components/sodam/app';
import InfoSections from '@/components/seo/InfoSections';
import { FAQS } from '@/lib/faq';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

/**
 * Honest structured data: only verifiable facts about the app itself, plus
 * an FAQPage built from the exact same FAQS data the visible FAQ section
 * renders (lib/faq.ts) — structured data must match on-page content.
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
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
      <InfoSections />
    </>
  );
}
