import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';

import { getMonetizationCards } from '@/content/pricing-offer';
import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildPricingPageJsonLd,
} from '@/utils/seo-schema';

import PricingContent from './content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return generatePageMetadata({
    locale,
    title: t('pageTitle'),
    description: t('pageSubtitle'),
    path: '/pricing',
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });

  const currency = locale.startsWith('de') ? 'EUR' : 'USD';

  const tiers = getMonetizationCards(locale).map(card => ({
    name: card.title,
    price: card.price,
    priceCurrency: currency,
    billingPeriod: 'P1M' as const,
    description: card.description,
  }));

  const faqs = [
    { question: t('faq1Q'), answer: t('faq1A') },
    { question: t('faq2Q'), answer: t('faq2A') },
    { question: t('faq3Q'), answer: t('faq3A') },
    { question: t('faq6Q'), answer: t('faq6A') },
    { question: t('faq7Q'), answer: t('faq7A') },
    { question: t('faq8Q'), answer: t('faq8A') },
  ];

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('label'), path: '/pricing' },
  ]);

  return (
    <>
      <Script
        id="pricing-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildPricingPageJsonLd({
            locale,
            pageTitle: t('pageTitle'),
            description: t('pageSubtitle'),
            path: '/pricing',
            tiers,
          })
        )}
      </Script>
      <Script
        id="pricing-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildFaqPageJsonLd(faqs))}
      </Script>
      <Script
        id="pricing-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <PricingContent />
    </>
  );
}
