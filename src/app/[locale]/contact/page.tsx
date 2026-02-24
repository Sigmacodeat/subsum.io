import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildContactPageJsonLd,
} from '@/utils/seo-schema';

import ContactContent from './content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return generatePageMetadata({
    locale,
    title: t('pageTitle'),
    description: t('pageSubtitle'),
    path: '/contact',
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/contact' },
  ]);

  return (
    <>
      <Script
        id="contact-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildContactPageJsonLd({
            locale,
            pageTitle: t('pageTitle'),
            description: t('pageSubtitle'),
            email: t('emailDirect'),
            phone: t('phoneDirect'),
          })
        )}
      </Script>
      <Script
        id="contact-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <ContactContent />
    </>
  );
}
