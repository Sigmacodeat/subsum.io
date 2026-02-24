export type FeatureEntry = {
  slug: string;
  titleKey: string;
  descriptionKey: string;
  docsSlugs: string[][];
};

export const FEATURE_DETAILS: readonly FeatureEntry[] = [
  {
    slug: 'smart-document-processing',
    titleKey: 'feature1Title',
    descriptionKey: 'feature1Desc',
    docsSlugs: [
      ['getting-started', 'upload-and-ingest'],
      ['reference', 'supported-file-types'],
    ],
  },
  {
    slug: 'contradiction-detection',
    titleKey: 'feature2Title',
    descriptionKey: 'feature2Desc',
    docsSlugs: [['getting-started', 'overview']],
  },
  {
    slug: 'deadline-automation',
    titleKey: 'feature3Title',
    descriptionKey: 'feature3Desc',
    docsSlugs: [['getting-started', 'overview']],
  },
  {
    slug: 'case-law-research',
    titleKey: 'feature4Title',
    descriptionKey: 'feature4Desc',
    docsSlugs: [['getting-started', 'overview']],
  },
  {
    slug: 'document-builder',
    titleKey: 'feature5Title',
    descriptionKey: 'feature5Desc',
    docsSlugs: [['getting-started', 'overview']],
  },
  {
    slug: 'evidence-management',
    titleKey: 'feature6Title',
    descriptionKey: 'feature6Desc',
    docsSlugs: [['getting-started', 'overview']],
  },
  {
    slug: 'multi-jurisdiction-support',
    titleKey: 'feature7Title',
    descriptionKey: 'feature7Desc',
    docsSlugs: [['getting-started', 'overview']],
  },
  {
    slug: 'firm-management',
    titleKey: 'feature8Title',
    descriptionKey: 'feature8Desc',
    docsSlugs: [['getting-started', 'overview']],
  },
  {
    slug: 'collective-intelligence',
    titleKey: 'feature9Title',
    descriptionKey: 'feature9Desc',
    docsSlugs: [
      ['getting-started', 'upload-and-ingest'],
      ['getting-started', 'overview'],
    ],
  },
] as const;

export function findFeature(slug: string): FeatureEntry | undefined {
  return FEATURE_DETAILS.find(f => f.slug === slug);
}
