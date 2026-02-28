import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { findDocEntry, slugToPath } from '@/docs/registry';
import { FEATURE_DETAILS, findFeature } from '@/features/registry';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import { buildBreadcrumbJsonLd, buildFaqPageJsonLd } from '@/utils/seo-schema';

export async function generateStaticParams() {
  return FEATURE_DETAILS.map(f => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'features' });
  const f = findFeature(slug);
  if (!f) return {};

  return generatePageMetadata({
    locale,
    title: t(f.titleKey),
    description: t(f.descriptionKey),
    path: `/features/${slug}`,
  });
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const f = findFeature(slug);
  if (!f) notFound();

  const t = await getTranslations({ locale, namespace: 'features' });
  const td = await getTranslations({ locale, namespace: 'featureDetail' });
  const isCollectiveIntelligence = slug === 'collective-intelligence';

  const title = t(f.titleKey);
  const description = t(f.descriptionKey);

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: t('pageTitle'), path: '/features' },
    { name: title, path: `/features/${slug}` },
  ]);

  const faqs = [
    {
      question: td(isCollectiveIntelligence ? 'collectiveFaq1Q' : 'faq1Q'),
      answer: td(isCollectiveIntelligence ? 'collectiveFaq1A' : 'faq1A'),
    },
    {
      question: td(isCollectiveIntelligence ? 'collectiveFaq2Q' : 'faq2Q'),
      answer: td(isCollectiveIntelligence ? 'collectiveFaq2A' : 'faq2A'),
    },
    {
      question: td(isCollectiveIntelligence ? 'collectiveFaq3Q' : 'faq3Q'),
      answer: td(isCollectiveIntelligence ? 'collectiveFaq3A' : 'faq3A'),
    },
  ];

  const detailLead = isCollectiveIntelligence
    ? td('collectiveLead')
    : description;

  const detailSteps = isCollectiveIntelligence
    ? [td('collectiveStep1'), td('collectiveStep2'), td('collectiveStep3')]
    : [td('step1'), td('step2'), td('step3')];

  const collectiveMechanics = isCollectiveIntelligence
    ? [
        {
          title: td('collectiveMechanic1Title'),
          description: td('collectiveMechanic1Desc'),
        },
        {
          title: td('collectiveMechanic2Title'),
          description: td('collectiveMechanic2Desc'),
        },
        {
          title: td('collectiveMechanic3Title'),
          description: td('collectiveMechanic3Desc'),
        },
        {
          title: td('collectiveMechanic4Title'),
          description: td('collectiveMechanic4Desc'),
        },
      ]
    : [];

  const collectiveCourtroom = isCollectiveIntelligence
    ? [
        {
          title: td('collectiveCourtroom1Title'),
          description: td('collectiveCourtroom1Desc'),
        },
        {
          title: td('collectiveCourtroom2Title'),
          description: td('collectiveCourtroom2Desc'),
        },
        {
          title: td('collectiveCourtroom3Title'),
          description: td('collectiveCourtroom3Desc'),
        },
      ]
    : [];

  const collectiveBenefits = isCollectiveIntelligence
    ? [
        {
          title: td('collectiveBenefit1Title'),
          description: td('collectiveBenefit1Desc'),
        },
        {
          title: td('collectiveBenefit2Title'),
          description: td('collectiveBenefit2Desc'),
        },
        {
          title: td('collectiveBenefit3Title'),
          description: td('collectiveBenefit3Desc'),
        },
      ]
    : [];

  const collectiveOutputs = isCollectiveIntelligence
    ? [
        {
          title: td('collectiveOutput1Title'),
          example: td('collectiveOutput1Example'),
          why: td('collectiveOutput1Why'),
        },
        {
          title: td('collectiveOutput2Title'),
          example: td('collectiveOutput2Example'),
          why: td('collectiveOutput2Why'),
        },
        {
          title: td('collectiveOutput3Title'),
          example: td('collectiveOutput3Example'),
          why: td('collectiveOutput3Why'),
        },
        {
          title: td('collectiveOutput4Title'),
          example: td('collectiveOutput4Example'),
          why: td('collectiveOutput4Why'),
        },
        {
          title: td('collectiveOutput5Title'),
          example: td('collectiveOutput5Example'),
          why: td('collectiveOutput5Why'),
        },
      ]
    : [];

  const collectiveWalkthrough = isCollectiveIntelligence
    ? [
        {
          title: td('collectiveWalkthrough1Title'),
          description: td('collectiveWalkthrough1Desc'),
        },
        {
          title: td('collectiveWalkthrough2Title'),
          description: td('collectiveWalkthrough2Desc'),
        },
        {
          title: td('collectiveWalkthrough3Title'),
          description: td('collectiveWalkthrough3Desc'),
        },
        {
          title: td('collectiveWalkthrough4Title'),
          description: td('collectiveWalkthrough4Desc'),
        },
        {
          title: td('collectiveWalkthrough5Title'),
          description: td('collectiveWalkthrough5Desc'),
        },
      ]
    : [];

  const collectiveDifferentiators = isCollectiveIntelligence
    ? [
        td('collectiveDiff1'),
        td('collectiveDiff2'),
        td('collectiveDiff3'),
        td('collectiveDiff4'),
      ]
    : [];

  const relatedDocs = f.docsSlugs.map(s => findDocEntry(s)).filter(Boolean);

  return (
    <>
      <Script
        id="feature-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <Script
        id="feature-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildFaqPageJsonLd(faqs))}
      </Script>

      <section className="pt-32 pb-14 lg:pt-44 bg-gradient-to-br from-slate-50 via-white to-primary-50/30">
        <div className="container-wide">
          <div className="text-sm text-slate-600">
            <Link
              href="/features"
              className="hover:text-slate-900 transition-colors"
            >
              {t('pageTitle')}
            </Link>
            <span className="mx-2 text-slate-400">/</span>
            <span className="text-slate-900 font-medium">{title}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mt-4">
            {title}
          </h1>
          <p className="text-lg sm:text-xl text-slate-700 mt-4 max-w-3xl leading-relaxed">
            {detailLead}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="https://app.subsum.io/auth/signUp"
              className="btn-primary !px-8 !py-4"
            >
              {td('ctaPrimary')}
            </a>
            <Link href="/pricing" className="btn-secondary !px-8 !py-4">
              {td('ctaSecondary')}
            </Link>
            {isCollectiveIntelligence ? (
              <a
                href="#collective-examples"
                className="btn-secondary !px-8 !py-4"
              >
                {td('collectiveCtaExamples')}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid lg:grid-cols-3 gap-10 items-start">
            <div className="lg:col-span-2">
              <div className="glass-card p-8 rounded-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {td(
                    isCollectiveIntelligence
                      ? 'collectiveHowTitle'
                      : 'howItWorksTitle'
                  )}
                </h2>
                <ol className="mt-4 space-y-3 text-slate-700">
                  {detailSteps.map((step, index) => (
                    <li key={step}>
                      <span className="font-semibold">{index + 1}.</span> {step}
                    </li>
                  ))}
                </ol>
              </div>

              {isCollectiveIntelligence ? (
                <div className="mt-8 glass-card p-8 rounded-2xl">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    {td('collectiveBenefitsTitle')}
                  </h2>
                  <p className="mt-3 text-slate-700 leading-relaxed">
                    {td('collectiveBenefitsSubtitle')}
                  </p>

                  <div className="mt-6 grid sm:grid-cols-2 gap-4">
                    {collectiveBenefits.map(benefit => (
                      <div
                        key={benefit.title}
                        className="rounded-xl border border-slate-200/80 bg-white p-4"
                      >
                        <h3 className="text-base font-semibold text-slate-900">
                          {benefit.title}
                        </h3>
                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                          {benefit.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                      {td('collectiveTrustTitle')}
                    </h3>
                    <p className="mt-2 text-sm text-emerald-900 leading-relaxed">
                      {td('collectiveTrustDesc')}
                    </p>
                  </div>
                </div>
              ) : null}

              {isCollectiveIntelligence ? (
                <div className="mt-8 glass-card p-8 rounded-2xl">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    {td('collectiveMechanicsTitle')}
                  </h2>
                  <p className="mt-3 text-slate-700 leading-relaxed">
                    {td('collectiveMechanicsSubtitle')}
                  </p>

                  <div className="mt-6 grid sm:grid-cols-2 gap-4">
                    {collectiveMechanics.map(m => (
                      <div
                        key={m.title}
                        className="rounded-xl border border-slate-200/80 bg-white p-4"
                      >
                        <h3 className="text-base font-semibold text-slate-900">
                          {m.title}
                        </h3>
                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                          {m.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200/80 bg-white p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {td('collectiveMechanicsNoteTitle')}
                    </div>
                    <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                      {td('collectiveMechanicsNoteDesc')}
                    </p>
                  </div>
                </div>
              ) : null}

              {isCollectiveIntelligence ? (
                <div className="mt-8 glass-card p-8 rounded-2xl">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    {td('collectiveCourtroomTitle')}
                  </h2>
                  <p className="mt-3 text-slate-700 leading-relaxed">
                    {td('collectiveCourtroomSubtitle')}
                  </p>

                  <div className="mt-6 grid sm:grid-cols-2 gap-4">
                    {collectiveCourtroom.map(c => (
                      <div
                        key={c.title}
                        className="rounded-xl border border-slate-200/80 bg-white p-4"
                      >
                        <h3 className="text-base font-semibold text-slate-900">
                          {c.title}
                        </h3>
                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                          {c.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
                      {td('collectiveCourtroomGuardrailsTitle')}
                    </h3>
                    <p className="mt-2 text-sm text-amber-900 leading-relaxed">
                      {td('collectiveCourtroomGuardrailsDesc')}
                    </p>
                  </div>
                </div>
              ) : null}

              {isCollectiveIntelligence ? (
                <div
                  id="collective-examples"
                  className="mt-8 glass-card p-8 rounded-2xl scroll-mt-28"
                >
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    {td('collectiveOutputsTitle')}
                  </h2>
                  <p className="mt-3 text-slate-700 leading-relaxed">
                    {td('collectiveOutputsSubtitle')}
                  </p>

                  <div className="mt-6 space-y-4">
                    {collectiveOutputs.map(o => (
                      <div
                        key={o.title}
                        className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden"
                      >
                        <div className="px-5 py-4 border-b border-slate-100">
                          <h3 className="font-semibold text-slate-900">
                            {o.title}
                          </h3>
                        </div>
                        <div className="px-5 py-4 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                              {td('collectiveOutputsExampleLabel')}
                            </div>
                            <p className="mt-2 text-sm text-slate-800 leading-relaxed">
                              {o.example}
                            </p>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                              {td('collectiveOutputsWhyLabel')}
                            </div>
                            <p className="mt-2 text-sm text-emerald-900 leading-relaxed">
                              {o.why}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {isCollectiveIntelligence ? (
                <div className="mt-8 glass-card p-8 rounded-2xl">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    {td('collectiveWalkthroughTitle')}
                  </h2>
                  <p className="mt-3 text-slate-700 leading-relaxed">
                    {td('collectiveWalkthroughSubtitle')}
                  </p>

                  <ol className="mt-6 space-y-4">
                    {collectiveWalkthrough.map((s, idx) => (
                      <li key={s.title} className="flex gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-cyan-600 text-white font-extrabold text-sm shadow-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div className="pt-0.5">
                          <div className="font-semibold text-slate-900">
                            {s.title}
                          </div>
                          <div className="text-sm text-slate-700 mt-1 leading-relaxed">
                            {s.description}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary-800">
                      {td('collectiveWalkthroughBeforeAfterTitle')}
                    </h3>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {td('collectiveWalkthroughBeforeLabel')}
                        </div>
                        <p className="mt-2 text-sm text-slate-800 leading-relaxed">
                          {td('collectiveWalkthroughBeforeText')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                          {td('collectiveWalkthroughAfterLabel')}
                        </div>
                        <p className="mt-2 text-sm text-emerald-900 leading-relaxed">
                          {td('collectiveWalkthroughAfterText')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {isCollectiveIntelligence ? (
                <div className="mt-8 glass-card p-8 rounded-2xl">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    {td('collectiveDiffTitle')}
                  </h2>
                  <p className="mt-3 text-slate-700 leading-relaxed">
                    {td('collectiveDiffSubtitle')}
                  </p>

                  <ul className="mt-5 space-y-3 text-slate-700">
                    {collectiveDifferentiators.map(d => (
                      <li key={d} className="flex gap-3">
                        <span
                          className="mt-1 h-2 w-2 rounded-full bg-primary-600 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="leading-relaxed">{d}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 rounded-xl border border-slate-200/80 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      {td('collectiveGovernanceTitle')}
                    </h3>
                    <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                      {td('collectiveGovernanceDesc')}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-8 glass-card p-8 rounded-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {td('faqTitle')}
                </h2>
                <div className="mt-5 space-y-4">
                  {faqs.map((f, idx) => (
                    <details
                      key={idx}
                      className="group rounded-xl border border-slate-200 bg-white px-5 py-4"
                    >
                      <summary className="cursor-pointer list-none font-semibold text-slate-900">
                        {f.question}
                      </summary>
                      <p className="mt-3 text-slate-700 leading-relaxed">
                        {f.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </div>

            <aside className="lg:col-span-1">
              <div className="glass-card p-6 rounded-2xl sticky top-28">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                  {td('relatedDocs')}
                </h3>
                {relatedDocs.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-600">
                    {td('relatedDocsEmpty')}
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {relatedDocs.map(d => (
                      <li key={d!.slug.join('/')}>
                        <Link
                          href={slugToPath(d!.slug)}
                          className="block rounded-xl border border-slate-200/70 bg-white/60 hover:bg-white px-4 py-3 transition-colors"
                        >
                          <div className="font-medium text-slate-900">
                            {d!.title}
                          </div>
                          <div className="text-sm text-slate-600 mt-0.5">
                            {d!.description}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-6 pt-6 border-t border-slate-200/70">
                  <Link
                    href="/docs"
                    className="text-sm font-semibold text-primary-700 hover:text-primary-800"
                  >
                    {td('docsIndexLink')}
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
