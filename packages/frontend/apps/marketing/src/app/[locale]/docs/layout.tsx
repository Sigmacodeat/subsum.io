import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { generatePageMetadata } from '@/utils/seo';

async function getDocsMetaCopySafe(locale: string): Promise<{
  pageTitle: string;
  pageSubtitle: string;
}> {
  try {
    const t = await getTranslations({ locale, namespace: 'docs' });
    return {
      pageTitle: t('pageTitle'),
      pageSubtitle: t('pageSubtitle'),
    };
  } catch {
    return {
      pageTitle: 'Documentation',
      pageSubtitle: 'Guides and reference material for Subsumio.',
    };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = await getDocsMetaCopySafe(locale);

  return generatePageMetadata({
    locale,
    title: copy.pageTitle,
    description: copy.pageSubtitle,
    path: '/docs',
  });
}

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return children;
}
