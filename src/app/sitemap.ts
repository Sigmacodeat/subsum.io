import type { MetadataRoute } from 'next';

import { DOCS, slugToPath } from '@/docs/registry';
import { FEATURE_DETAILS } from '@/features/registry';
import { locales } from '@/i18n/config';
import { generateLandingPageEntries } from '@/utils/landingpage-generator';
import { buildLanguageAlternates, buildLocaleUrl } from '@/utils/seo';
import { seoIndexablePaths } from '@/utils/seo-routes';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries = generateLandingPageEntries(locales, seoIndexablePaths);
  const docPaths = DOCS.map(doc => slugToPath(doc.slug));
  const featurePaths = FEATURE_DETAILS.map(f => `/features/${f.slug}`);

  const docEntries = generateLandingPageEntries(locales, docPaths as any);

  const featureEntries = generateLandingPageEntries(
    locales,
    featurePaths as any
  );

  return [...entries, ...docEntries, ...featureEntries].map(
    ({ locale, path }) => ({
      url: buildLocaleUrl(locale, path),
      lastModified: now,
      alternates: {
        languages: buildLanguageAlternates(path),
      },
      changeFrequency: path === '' ? 'daily' : 'weekly',
      priority: path === '' ? 1 : 0.8,
    })
  );
}
