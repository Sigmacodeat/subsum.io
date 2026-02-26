import type { Locale } from '@/i18n/config';

import type { SeoIndexablePath } from './seo-routes';

export type LandingPageEntry = {
  locale: Locale;
  path: SeoIndexablePath;
};

export function generateLandingPageEntries(
  locales: readonly Locale[],
  paths: readonly SeoIndexablePath[]
): LandingPageEntry[] {
  return locales.flatMap(locale => paths.map(path => ({ locale, path })));
}
