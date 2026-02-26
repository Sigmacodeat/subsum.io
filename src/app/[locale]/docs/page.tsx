import Script from 'next/script';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  FloatingParticles,
  GradientBlob,
  Parallax,
  ScrollProgressBar,
  ScrollReveal,
  ScrollScale,
} from '@/components/animations';
import { DOCS, groupDocsBySection, slugToPath } from '@/docs/registry';
import DocsSearch from '@/docs/ui/docs-search';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { buildBreadcrumbJsonLd } from '@/utils/seo-schema';

export default async function DocsHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'docs' });

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/docs' },
  ]);

  const groups = groupDocsBySection();

  return (
    <>
      <Script
        id="docs-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>

      <ScrollProgressBar />

      <section className="relative pt-32 pb-10 lg:pt-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
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
            size={450}
            colors={['#1E40AF', '#0E7490', '#dbeafe']}
          />
        </Parallax>
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={22} duration={650}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-4">
              {t('pageTitle')}
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 max-w-3xl">
              {t('pageSubtitle')}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200} direction="up" distance={16} duration={600}>
            <div className="mt-8 max-w-2xl">
              <DocsSearch docs={DOCS} />
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-6">
            {(
              [
                {
                  key: 'getting-started',
                  title: t('sectionGettingStarted'),
                  docs: groups['getting-started'],
                },
                {
                  key: 'guides',
                  title: t('sectionGuides'),
                  docs: groups.guides,
                },
                {
                  key: 'reference',
                  title: t('sectionReference'),
                  docs: groups.reference,
                },
                {
                  key: 'troubleshooting',
                  title: t('sectionTroubleshooting'),
                  docs: groups.troubleshooting,
                },
              ] as const
            )
              .filter(g => g.docs.length > 0)
              .map((group, idx) => (
                <ScrollScale
                  key={group.key}
                  startScale={0.92}
                  endScale={1}
                  startOpacity={0}
                  endOpacity={1}
                  offsetPx={40 + (idx % 2) * 30}
                >
                  <div className="glass-card p-6 rounded-2xl">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                      {group.title}
                    </h2>
                    <ul className="mt-4 space-y-3">
                      {group.docs.map(entry => (
                        <li key={entry.slug.join('/')}>
                          <Link
                            href={slugToPath(entry.slug)}
                            className="block rounded-xl border border-slate-200/70 bg-white/60 hover:bg-white px-4 py-3 transition-colors"
                          >
                            <div className="font-medium text-slate-900">
                              {entry.title}
                            </div>
                            <div className="text-sm text-slate-600 mt-0.5">
                              {entry.description}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollScale>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
