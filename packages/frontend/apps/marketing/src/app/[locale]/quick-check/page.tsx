import type { Metadata } from 'next';
import Script from 'next/script';
import { setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildServicePageJsonLd,
} from '@/utils/seo-schema';

import QuickCheckContent from './content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isGerman = locale.toLowerCase().startsWith('de');

  return generatePageMetadata({
    locale,
    title: isGerman
      ? 'Akte Quick-Check online: Risiken, Fristen & Widersprüche in Minuten'
      : 'Case file quick check online: detect risk, deadlines, and contradictions in minutes',
    description: isGerman
      ? 'Laden Sie Ihre Akte hoch und erhalten Sie in wenigen Minuten einen strukturierten Quick-Check mit Risikoindikatoren, Fristsignalen und Handlungsempfehlungen.'
      : 'Upload your case file and get a structured quick check in minutes with risk indicators, deadline signals, and next-step recommendations.',
    path: '/quick-check',
  });
}

export default async function QuickCheckPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isGerman = locale.toLowerCase().startsWith('de');

  const pageTitle = isGerman ? 'Akte Quick-Check' : 'Case File Quick Check';
  const pageSubtitle = isGerman
    ? 'Schnelle Vorprüfung für Risiken, Fristen und Widersprüche – mit klarer Empfehlung für den nächsten Schritt.'
    : 'Fast pre-check for risk, deadlines, and contradictions — with a clear recommendation for your next step.';

  const faqs = isGerman
    ? [
        {
          question: 'Ist der Quick-Check eine Rechtsberatung?',
          answer:
            'Nein. Der Quick-Check ist eine technische Voranalyse zur Strukturierung und Priorisierung. Die juristische Bewertung erfolgt weiterhin durch die Kanzlei.',
        },
        {
          question: 'Welche Dateien kann ich hochladen?',
          answer:
            'Unterstützt werden PDF, DOCX, E-Mails, Bilder und weitere gängige Formate. Für die tiefere Analyse werden OCR und semantische Verarbeitung genutzt.',
        },
        {
          question: 'Was passiert nach dem Quick-Check?',
          answer:
            'Sie erhalten eine Zusammenfassung mit Prioritäten. Für vollständige Tiefenanalyse können Sie ein Konto erstellen und Credits bzw. einen Plan aktivieren.',
        },
      ]
    : [
        {
          question: 'Is the quick check legal advice?',
          answer:
            'No. The quick check is a technical pre-assessment for structuring and prioritization. Legal judgment remains with your legal team.',
        },
        {
          question: 'Which files are supported?',
          answer:
            'You can upload PDF, DOCX, emails, images, and additional common formats. Deep analysis uses OCR and semantic processing.',
        },
        {
          question: 'What happens after the quick check?',
          answer:
            'You receive a prioritized summary. For full deep analysis, create an account and activate credits or a plan.',
        },
      ];

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: pageTitle, path: '/quick-check' },
  ]);

  return (
    <>
      <Script
        id="quick-check-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildServicePageJsonLd({
            locale,
            name: pageTitle,
            description: pageSubtitle,
            path: '/quick-check',
          })
        )}
      </Script>
      <Script
        id="quick-check-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildFaqPageJsonLd(faqs))}
      </Script>
      <Script
        id="quick-check-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <QuickCheckContent />
    </>
  );
}
