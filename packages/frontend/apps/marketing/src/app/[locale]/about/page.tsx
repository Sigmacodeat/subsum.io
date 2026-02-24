import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';

import { BRAND_NAME, BRAND_SITE_URL } from '@/brand';
import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { buildLocaleUrl, generatePageMetadata } from '@/utils/seo';
import { buildBreadcrumbJsonLd } from '@/utils/seo-schema';

import AboutContent from './content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return generatePageMetadata({
    locale,
    title: t('pageTitle'),
    description: t('pageSubtitle'),
    path: '/about',
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/about' },
  ]);

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t('pageTitle'),
    description: t('pageSubtitle'),
    url: buildLocaleUrl(locale, '/about'),
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      url: BRAND_SITE_URL,
    },
  };

  return (
    <>
      <Script
        id="about-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(webPageJsonLd)}
      </Script>
      <Script
        id="about-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <AboutContent />
    </>
  );
}
