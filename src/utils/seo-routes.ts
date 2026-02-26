export const seoIndexablePaths = [
  '',
  '/about',
  '/systems',
  '/features',
  '/quick-check',
  '/developers/api',
  '/docs',
  '/pricing',
  '/security',
  '/contact',
  '/legal/imprint',
  '/legal/privacy',
  '/legal/terms',
] as const;

export type SeoIndexablePath = (typeof seoIndexablePaths)[number];
