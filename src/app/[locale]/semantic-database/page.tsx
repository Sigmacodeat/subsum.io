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

import SemanticDatabaseContent from './content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const isGerman = locale.toLowerCase().startsWith('de');
  const title = isGerman
    ? 'Semantische KI-Datenbank: Warum Subsumio mehr versteht als klassische Systeme'
    : 'Semantic AI database: why Subsumio understands more than traditional systems';
  const description = isGerman
    ? 'Verstehen statt Keyword-Suche: Subsumio baut eine semantische Wissensbasis Ihrer Akten, erkennt Zusammenhänge, Widersprüche und Risiken – und bleibt dabei auditierbar und compliance-fähig.'
    : 'Understand instead of keyword search: Subsumio builds a semantic case knowledge base, detects connections, contradictions, and risk — while staying auditable and compliance-ready.';

  return generatePageMetadata({
    locale,
    title,
    description,
    path: '/semantic-database',
  });
}

export default async function SemanticDatabasePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isGerman = locale.toLowerCase().startsWith('de');

  const pageTitle = isGerman
    ? 'Semantische KI-Datenbank'
    : 'Semantic AI database';
  const pageSubtitle = isGerman
    ? 'Warum Subsumio Akten als Wissensbasis versteht – statt nur Dateien zu speichern.'
    : 'Why Subsumio understands cases as a knowledge base — not just stored files.';

  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: tNav('features'), path: '/features' },
    { name: pageTitle, path: '/semantic-database' },
  ]);

  return (
    <>
      <Script
        id="semantic-db-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildServicePageJsonLd({
            locale,
            name: pageTitle,
            description: pageSubtitle,
            path: '/semantic-database',
          })
        )}
      </Script>
      <Script
        id="semantic-db-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <SemanticDatabaseContent />
    </>
  );
}
