export type DocsSection =
  | 'getting-started'
  | 'guides'
  | 'reference'
  | 'troubleshooting';

export type DocEntry = {
  slug: string[];
  section: DocsSection;
  title: string;
  description: string;
  filePath: string;
};

export const DOCS: readonly DocEntry[] = [
  {
    slug: ['getting-started', 'overview'],
    section: 'getting-started',
    title: 'Overview',
    description:
      'What Subsumio is, who it is for, and how the platform is structured.',
    filePath: 'src/docs/content/getting-started/overview.mdx',
  },
  {
    slug: ['getting-started', 'upload-and-ingest'],
    section: 'getting-started',
    title: 'Upload & ingest',
    description: 'How uploads, OCR, and semantic chunks work end-to-end.',
    filePath: 'src/docs/content/getting-started/upload-and-ingest.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan'],
    section: 'reference',
    title: 'FFG/AWS business plan',
    description:
      'Funding-ready business plan for Subsumio (FFG + aws), including R&D scope, go-to-market, and financial plan.',
    filePath: 'src/docs/content/reference/ffg-aws-businessplan.mdx',
  },
  {
    slug: ['reference', 'supported-file-types'],
    section: 'reference',
    title: 'Supported file types',
    description:
      'Which file types are supported and how to maximize extraction quality.',
    filePath: 'src/docs/content/reference/supported-file-types.mdx',
  },
  {
    slug: ['reference', 'security-architecture-factsheet'],
    section: 'reference',
    title: 'Security architecture factsheet',
    description:
      'Comprehensive overview of security architecture, data flow, controls, and compliance posture.',
    filePath: 'src/docs/content/reference/security-architecture-factsheet.mdx',
  },
] as const;

export function slugToPath(slug: string[]): string {
  return `/docs/${slug.map(encodeURIComponent).join('/')}`;
}

export function findDocEntry(slug: string[]): DocEntry | undefined {
  return DOCS.find(entry => entry.slug.join('/') === slug.join('/'));
}

export function sortDocs(entries: readonly DocEntry[]): DocEntry[] {
  return [...entries].sort((a, b) =>
    a.slug.join('/').localeCompare(b.slug.join('/'))
  );
}

export function getPrevNext(slug: string[]): {
  prev?: DocEntry;
  next?: DocEntry;
} {
  const sorted = sortDocs(DOCS);
  const idx = sorted.findIndex(e => e.slug.join('/') === slug.join('/'));
  if (idx === -1) return {};
  return {
    prev: sorted[idx - 1],
    next: sorted[idx + 1],
  };
}

export function groupDocsBySection(): Record<DocsSection, DocEntry[]> {
  const initial: Record<DocsSection, DocEntry[]> = {
    'getting-started': [],
    guides: [],
    reference: [],
    troubleshooting: [],
  };

  return sortDocs(DOCS).reduce((acc, entry) => {
    acc[entry.section].push(entry);
    return acc;
  }, initial);
}
