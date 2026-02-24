import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildServicePageJsonLd,
} from '@/utils/seo-schema';

import TaxOSContent from './content';

function resolveTaxMeta(locale: string) {
  const isGerman = locale.startsWith('de');
  return {
    title: isGerman
      ? 'Tax OS – KI für Steuerberatung'
      : 'Tax OS – AI for Tax Advisory',
    description: isGerman
      ? 'Automatische Bescheid-Prüfung, Fristen-Cockpit und KI-gestützte Steuerberatung für moderne Kanzleien.'
      : 'Automated tax assessment checks, deadline cockpit, and AI-powered tax advisory workflows for modern firms.',
    breadcrumb: isGerman
      ? 'Tax OS für Steuerberatung'
      : 'Tax OS for Tax Advisory',
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = resolveTaxMeta(locale);

  return generatePageMetadata({
    locale,
    title: meta.title,
    description: meta.description,
    path: '/tax',
  });
}

export default async function TaxOSPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const meta = resolveTaxMeta(locale);
  const tFaq = await getTranslations({ locale, namespace: 'faq' });

  const faqs = [
    { question: tFaq('q1'), answer: tFaq('a1') },
    { question: tFaq('q2'), answer: tFaq('a2') },
    { question: tFaq('q3'), answer: tFaq('a3') },
    { question: tFaq('q4'), answer: tFaq('a4') },
    { question: tFaq('q5'), answer: tFaq('a5') },
  ];

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: meta.breadcrumb, path: '/tax' },
  ]);

  return (
    <>
      <Script
        id="tax-service-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildServicePageJsonLd({
            locale,
            name: meta.title,
            description: meta.description,
            path: '/tax',
          })
        )}
      </Script>
      <Script
        id="tax-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildFaqPageJsonLd(faqs))}
      </Script>
      <Script
        id="tax-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <TaxOSContent />
    </>
  );
}
