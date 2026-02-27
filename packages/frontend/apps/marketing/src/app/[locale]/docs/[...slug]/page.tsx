import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';

import { mdxComponents } from '@/docs/mdx-components';
import {
  DOCS,
  findDocEntry,
  getPrevNext,
  groupDocsBySection,
  slugToPath,
} from '@/docs/registry';
import { extractTocFromMdx } from '@/docs/toc';
import PdfDownloadButton from '@/docs/ui/pdf-download-button';
import PrintOnLoad from '@/docs/ui/print-on-load';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import { buildBreadcrumbJsonLd } from '@/utils/seo-schema';

async function readDocSourceSafe(filePath: string): Promise<string | null> {
  try {
    const absolute = path.join(process.cwd(), filePath);
    return await fs.readFile(absolute, 'utf8');
  } catch {
    return null;
  }
}

async function compileDocSourceSafe(source: string) {
  try {
    const { content } = await compileMDX({
      source,
      components: mdxComponents as any,
      options: {
        parseFrontmatter: false,
        mdxOptions: {
          remarkPlugins: [remarkGfm],
        },
      },
    });
    return content;
  } catch {
    return null;
  }
}

function extractTocFromSourceSafe(source: string | null) {
  if (!source) return [];
  try {
    return extractTocFromMdx(source);
  } catch {
    return [];
  }
}

type DocsUiCopy = {
  pageTitle: string;
  sectionGettingStarted: string;
  sectionGuides: string;
  sectionReference: string;
  sectionTroubleshooting: string;
  onThisPage: string;
  noToc: string;
  prev: string;
  next: string;
};

async function getDocsUiCopySafe(locale: string): Promise<DocsUiCopy> {
  try {
    const t = await getTranslations({ locale, namespace: 'docs' });
    return {
      pageTitle: t('pageTitle'),
      sectionGettingStarted: t('sectionGettingStarted'),
      sectionGuides: t('sectionGuides'),
      sectionReference: t('sectionReference'),
      sectionTroubleshooting: t('sectionTroubleshooting'),
      onThisPage: t('onThisPage'),
      noToc: t('noToc'),
      prev: t('prev'),
      next: t('next'),
    };
  } catch {
    return {
      pageTitle: 'Documentation',
      sectionGettingStarted: 'Getting started',
      sectionGuides: 'Guides',
      sectionReference: 'Reference',
      sectionTroubleshooting: 'Troubleshooting',
      onThisPage: 'On this page',
      noToc: 'No sections',
      prev: 'Previous',
      next: 'Next',
    };
  }
}

export async function generateStaticParams() {
  return DOCS.map(doc => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const entry = findDocEntry(slug);
  if (!entry) return {};

  return generatePageMetadata({
    locale,
    title: entry.title,
    description: entry.description,
    path: `/docs/${slug.join('/')}`,
  });
}

export default async function DocsArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const sp = (await searchParams) ?? {};
  const printParamRaw = sp.print;
  const printParam = Array.isArray(printParamRaw)
    ? printParamRaw[0]
    : printParamRaw;
  const isPrintMode = printParam === '1' || printParam === 'true';

  const entry = findDocEntry(slug);
  if (!entry) notFound();

  const source = await readDocSourceSafe(entry.filePath);
  const compiledContent = source ? await compileDocSourceSafe(source) : null;
  if (!compiledContent) notFound();

  const toc = extractTocFromSourceSafe(source);
  const { prev, next } = getPrevNext(slug);

  const copy = await getDocsUiCopySafe(locale);

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: copy.pageTitle, path: '/docs' },
    { name: entry.title, path: `/docs/${slug.join('/')}` },
  ]);

  const groups = groupDocsBySection();
  const tocItemsExpanded =
    toc.length > 14 ? toc.filter(item => item.depth <= 2) : toc;
  const tocItemsCompact =
    tocItemsExpanded.length > 10
      ? tocItemsExpanded.filter(item => item.depth <= 1)
      : tocItemsExpanded;

  return (
    <>
      <Script
        id="docs-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>

      <PrintOnLoad enabled={isPrintMode} />

      <section className="pt-28 lg:pt-36 pb-6 bg-gradient-to-br from-slate-50 via-white to-primary-50/30 print:pt-8 print:pb-3">
        <div className="container-wide">
          <div className="text-sm text-slate-600">
            <Link
              href="/docs"
              className="hover:text-slate-900 transition-colors"
            >
              {copy.pageTitle}
            </Link>
            <span className="mx-2 text-slate-400">/</span>
            <span className="text-slate-900 font-medium">{entry.title}</span>
          </div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
                {entry.title}
              </h1>
              <p className="text-lg text-slate-600 mt-3 max-w-3xl">
                {entry.description}
              </p>
            </div>
            {!isPrintMode ? (
              <div className="flex items-center gap-2 print:hidden">
                <PdfDownloadButton
                  title={entry.title}
                  className="btn-secondary !px-4 !py-2.5 !text-sm inline-flex items-center gap-2"
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className={
          isPrintMode
            ? 'section-padding !pt-6 bg-white'
            : 'section-padding !pt-10 bg-white'
        }
      >
        <div className="container-wide">
          <div
            className={
              isPrintMode
                ? 'grid grid-cols-1'
                : 'grid lg:grid-cols-[260px,minmax(0,1fr),268px] xl:grid-cols-[272px,minmax(0,1fr),284px] gap-8 xl:gap-10'
            }
          >
            {/* Sidebar */}
            <aside className="hidden lg:block docs-sidebar">
              <div className="sticky top-24 xl:top-20 space-y-6">
                {(
                  [
                    {
                      key: 'getting-started',
                      title: copy.sectionGettingStarted,
                      docs: groups['getting-started'],
                    },
                    {
                      key: 'guides',
                      title: copy.sectionGuides,
                      docs: groups.guides,
                    },
                    {
                      key: 'reference',
                      title: copy.sectionReference,
                      docs: groups.reference,
                    },
                    {
                      key: 'troubleshooting',
                      title: copy.sectionTroubleshooting,
                      docs: groups.troubleshooting,
                    },
                  ] as const
                )
                  .filter(g => g.docs.length > 0)
                  .map(group => (
                    <div key={group.key}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2.5">
                        {group.title}
                      </div>
                      <ul className="space-y-1">
                        {group.docs.map(d => {
                          const active = d.slug.join('/') === slug.join('/');
                          return (
                            <li key={d.slug.join('/')}>
                              <Link
                                href={slugToPath(d.slug)}
                                className={
                                  active
                                    ? 'block px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 font-medium leading-snug'
                                    : 'block px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 leading-snug'
                                }
                              >
                                {d.title}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
              </div>
            </aside>

            {/* Article */}
            <article className="min-w-0">
              <div className="prose prose-slate max-w-none prose-headings:scroll-mt-28 prose-a:text-primary-700 prose-a:no-underline hover:prose-a:underline prose-code:font-mono">
                {compiledContent}
              </div>

              <div className="mt-10 grid sm:grid-cols-2 gap-4">
                {prev ? (
                  <Link
                    href={slugToPath(prev.slug)}
                    className="glass-card p-5 rounded-2xl hover:shadow-xl transition-shadow"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {copy.prev}
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {prev.title}
                    </div>
                  </Link>
                ) : (
                  <div />
                )}
                {next ? (
                  <Link
                    href={slugToPath(next.slug)}
                    className="glass-card p-5 rounded-2xl hover:shadow-xl transition-shadow"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {copy.next}
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {next.title}
                    </div>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            </article>

            {/* TOC */}
            <aside className="hidden lg:block docs-toc">
              <div className="sticky top-20 xl:top-20 rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-sm px-3.5 py-3.5 xl:px-4 xl:py-4 shadow-sm">
                <div className="text-[10px] xl:text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2 xl:mb-2.5">
                  {copy.onThisPage}
                </div>
                {tocItemsExpanded.length === 0 ? (
                  <div className="text-sm text-slate-500">{copy.noToc}</div>
                ) : (
                  <>
                    <ul className="space-y-1 xl:hidden">
                      {tocItemsCompact.map(item => (
                        <li key={`compact-${item.id}`}>
                          <a
                            href={`#${item.id}`}
                            className="block text-[12px] leading-[1.25] text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            {item.text}
                          </a>
                        </li>
                      ))}
                    </ul>

                    <ul className="hidden xl:block space-y-1.5">
                      {tocItemsExpanded.map(item => (
                        <li
                          key={item.id}
                          className={item.depth >= 3 ? 'pl-2.5' : ''}
                        >
                          <a
                            href={`#${item.id}`}
                            className="block text-[13px] leading-snug text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            {item.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {isPrintMode ? (
        <div className="docs-print-footer" aria-hidden="true">
          <div className="docs-print-footer-inner">
            <div className="docs-print-footer-title">{entry.title}</div>
            <div className="docs-print-footer-meta">
              Stand: Februar 2026 · Subsumio (Wien) · Vertraulich
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
