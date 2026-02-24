import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildServicePageJsonLd,
} from '@/utils/seo-schema';

import SecurityContent from './content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'security' });
  return generatePageMetadata({
    locale,
    title: t('pageTitle'),
    description: t('pageSubtitle'),
    path: '/security',
  });
}

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'security' });

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/security' },
  ]);

  return (
    <>
      <Script
        id="security-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildServicePageJsonLd({
            locale,
            name: t('pageTitle'),
            description: t('pageSubtitle'),
            path: '/security',
          })
        )}
      </Script>
      <Script
        id="security-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <SecurityContent />
    </>
  );
}
