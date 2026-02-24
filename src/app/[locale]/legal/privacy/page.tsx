import type { Metadata } from 'next';
import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { BRAND_NAME, BRAND_SITE_URL } from '@/brand';
import {
  FloatingParticles,
  GradientBlob,
  Parallax,
  ScrollProgressBar,
  ScrollReveal,
} from '@/components/animations';
import type { Locale } from '@/i18n/config';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { buildLocaleUrl, generatePageMetadata } from '@/utils/seo';
import { buildBreadcrumbJsonLd } from '@/utils/seo-schema';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPrivacy' });
  return generatePageMetadata({
    locale,
    title: t('pageTitle'),
    description: t('intro'),
    path: '/legal/privacy',
  });
}

function PrivacyContent() {
  const t = useTranslations('legalPrivacy');
  const sections = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <>
      <ScrollProgressBar />

      <section className="relative pt-32 pb-14 lg:pt-40 lg:pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/20" />
        <Parallax speed={0.04} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern opacity-40" />
        </Parallax>
        <FloatingParticles
          count={3}
          colors={['bg-primary-400/6', 'bg-cyan-400/5', 'bg-sky-300/5']}
        />
        <Parallax speed={0.03} className="absolute inset-0">
          <GradientBlob
            className="-top-40 -right-40 animate-breathe"
            size={400}
            colors={['#1E40AF', '#0E7490', '#dbeafe']}
          />
        </Parallax>
        <div className="container-wide text-center relative">
          <ScrollReveal direction="up" distance={20} duration={650}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-3 text-balance">
              {t('pageTitle')}
            </h1>
            <p className="text-sm text-slate-500">{t('lastUpdated')}</p>
          </ScrollReveal>
        </div>
      </section>
      <section className="section-padding !pt-8 bg-white">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal direction="up" distance={18} duration={600}>
              <div className="glass-card p-8 rounded-2xl">
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  {t('intro')}
                </p>
                {sections.map(i => (
                  <ScrollReveal
                    key={i}
                    delay={i * 40}
                    direction="up"
                    distance={10}
                    duration={450}
                  >
                    <div className="mb-8 last:mb-0">
                      <h2 className="text-xl font-bold text-slate-900 mb-3">
                        {t(`section${i}Title`)}
                      </h2>
                      <p className="text-slate-600 leading-relaxed">
                        {t(`section${i}Content`)}
                      </p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </>
  );
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPrivacy' });

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/legal/privacy' },
  ]);

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('pageTitle'),
    description: t('intro'),
    url: buildLocaleUrl(locale, '/legal/privacy'),
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      url: BRAND_SITE_URL,
    },
  };

  return (
    <>
      <Script
        id="privacy-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(webPageJsonLd)}
      </Script>
      <Script
        id="privacy-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <PrivacyContent />
    </>
  );
}
