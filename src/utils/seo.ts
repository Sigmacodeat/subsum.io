import type { Metadata } from 'next';

import { BRAND_NAME, BRAND_SITE_URL } from '@/brand';
import { resolveSeoContentCluster } from '@/content/seo-content-clusters';
import { resolveSeoMarketOverride } from '@/content/seo-market-content';
import {
  defaultLocale,
  type Locale,
  locales,
  localeToSeoHreflang,
  resolveLocaleMarket,
} from '@/i18n/config';
import { assertLocalizationSeoIntegrity } from '@/i18n/validation';

const BASE_URL = BRAND_SITE_URL;

type SeoInput = {
  locale: string;
  title: string;
  description: string;
  keywords?: string | string[];
  path?: string;
  noindex?: boolean;
};

export function normalizeLocale(locale: string): Locale {
  return (
    locales.includes(locale as Locale) ? locale : defaultLocale
  ) as Locale;
}

export function normalizePath(path = ''): string {
  if (!path) return '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath === '/' ? '' : normalizedPath;
}

export function localePrefix(locale: Locale): string {
  return locale === defaultLocale ? '' : `/${locale}`;
}

export function buildLocaleUrl(locale: string, path = ''): string {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedPath = normalizePath(path);
  return `${BASE_URL}${localePrefix(normalizedLocale)}${normalizedPath}`;
}

export function buildLanguageAlternates(path = ''): Record<string, string> {
  assertLocalizationSeoIntegrity();
  const normalizedPath = normalizePath(path);
  const alternates: Record<string, string> = {};

  for (const locale of locales) {
    const hreflang = localeToSeoHreflang[locale];
    alternates[hreflang] = buildLocaleUrl(locale, normalizedPath);
  }

  alternates['x-default'] = `${BASE_URL}${normalizedPath}`;
  return alternates;
}

export function generatePageMetadata({
  locale,
  title,
  description,
  keywords,
  path = '',
  noindex = false,
}: SeoInput): Metadata {
  assertLocalizationSeoIntegrity();
  const normalizedLocale = normalizeLocale(locale);
  const normalizedPath = normalizePath(path);
  const market = resolveLocaleMarket(normalizedLocale);
  const url = buildLocaleUrl(normalizedLocale, normalizedPath);
  const alternates = buildLanguageAlternates(normalizedPath);
  const contentCluster = resolveSeoContentCluster(
    normalizedLocale,
    normalizedPath || ''
  );
  const marketOverride = resolveSeoMarketOverride(
    normalizedLocale,
    normalizedPath || ''
  );
  const openGraphLocale = `${market.language}_${market.country}`;
  const customKeywords = Array.isArray(keywords)
    ? keywords
    : keywords
      ? [keywords]
      : [];
  const clusterKeywords = [
    ...(contentCluster?.primaryKeywords ?? []),
    ...(contentCluster?.secondaryKeywords ?? []),
  ];
  const overrideKeywords = marketOverride?.keywords ?? [];
  const normalizedKeywords = [
    ...new Set([...customKeywords, ...clusterKeywords, ...overrideKeywords]),
  ].join(', ');
  const effectiveTitle = marketOverride?.title ?? title;
  const effectiveDescription = marketOverride?.description ?? description;
  const effectiveNoindex = noindex || marketOverride?.noindex === true;

  return {
    title: effectiveTitle,
    description: effectiveDescription,
    metadataBase: new URL(BASE_URL),
    keywords: normalizedKeywords || undefined,
    alternates: {
      canonical: url,
      languages: alternates,
    },
    openGraph: {
      title: effectiveTitle,
      description: effectiveDescription,
      url,
      siteName: BRAND_NAME,
      type: 'website',
      locale: openGraphLocale,
    },
    twitter: {
      card: 'summary_large_image',
      title: effectiveTitle,
      description: effectiveDescription,
    },
    robots: {
      index: !effectiveNoindex,
      follow: true,
    },
  };
}
