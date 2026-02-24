import type { Metadata } from 'next';
import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { BRAND_COMPANY_NAME, BRAND_NAME, BRAND_SITE_URL } from '@/brand';
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
  const t = await getTranslations({ locale, namespace: 'legalImprint' });
  return generatePageMetadata({
    locale,
    title: t('pageTitle'),
    description: t('pageTitle'),
    path: '/legal/imprint',
  });
}

function ImprintContent() {
  const t = useTranslations('legalImprint');

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
          </ScrollReveal>
        </div>
      </section>
      <section className="section-padding !pt-8 bg-white">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal direction="up" distance={18} duration={600}>
              <div className="glass-card p-8 rounded-2xl space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">
                    {t('companyName')}
                  </h2>
                  <p className="text-sm text-slate-500">{t('legalForm')}</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t('registeredOffice')}
                    </h3>
                    <p className="text-slate-700">{t('address')}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t('commercialRegister')}
                    </h3>
                    <p className="text-slate-700">{t('registerCourt')}</p>
                    <p className="text-slate-700">{t('registerNumber')}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t('vatId')}
                    </h3>
                    <p className="text-slate-700">{t('vatNumber')}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t('managingDirectors')}
                    </h3>
                    <p className="text-slate-700">{t('director1')}</p>
                    <p className="text-slate-700">{t('director2')}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t('contactTitle')}
                    </h3>
                    <p className="text-slate-700">{t('email')}</p>
                    <p className="text-slate-700">{t('phone')}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t('responsibleForContent')}
                    </h3>
                    <p className="text-slate-700">{t('responsiblePerson')}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {t('disputeResolution')}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {t('disputeText')}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </>
  );
}

export default async function ImprintPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalImprint' });

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/legal/imprint' },
  ]);

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    legalName: BRAND_COMPANY_NAME,
    url: BRAND_SITE_URL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: t('address'),
    },
    email: t('email'),
    telephone: t('phone'),
  };

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('pageTitle'),
    description: t('pageTitle'),
    url: buildLocaleUrl(locale, '/legal/imprint'),
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      url: BRAND_SITE_URL,
    },
  };

  return (
    <>
      <Script
        id="imprint-page-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(webPageJsonLd)}
      </Script>
      <Script
        id="imprint-org-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(orgJsonLd)}
      </Script>
      <Script
        id="imprint-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <ImprintContent />
    </>
  );
}
