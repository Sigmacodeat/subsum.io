import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildServicePageJsonLd,
} from '@/utils/seo-schema';

import FeaturesContent from './content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'features' });
  return generatePageMetadata({
    locale,
    title: t('pageTitle'),
    description: t('pageSubtitle'),
    path: '/features',
  });
}

export default async function FeaturesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'features' });

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/features' },
  ]);

  return (
    <>
      <Script
        id="features-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildServicePageJsonLd({
            locale,
            name: t('pageTitle'),
            description: t('pageSubtitle'),
            path: '/features',
          })
        )}
      </Script>
      <Script
        id="features-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <FeaturesContent />
    </>
  );
}
