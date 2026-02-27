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
    title: 'FFG/AWS business plan (Master TOC)',
    description:
      'Master index for the FFG/AWS dossier with chapter-by-chapter navigation and submission workflow.',
    filePath: 'src/docs/content/reference/ffg-aws-businessplan-master-toc.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan-01-executive-company-market'],
    section: 'reference',
    title: 'FFG/AWS Chapter 01 — Executive, Company & Market',
    description:
      'Executive summary, company setup, problem context, and market analysis for DACH legal-tech.',
    filePath:
      'src/docs/content/reference/ffg-aws-businessplan-01-executive-company-market.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan-02-value-product-tech'],
    section: 'reference',
    title: 'FFG/AWS Chapter 02 — Value Proposition & Product',
    description:
      'ROI logic, risk reduction value case, and core product/technology architecture.',
    filePath:
      'src/docs/content/reference/ffg-aws-businessplan-02-value-product-tech.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan-03-business-gtm-team-finance'],
    section: 'reference',
    title: 'FFG/AWS Chapter 03 — Business Model, GTM, Team & Finance',
    description:
      'Commercial model, go-to-market channels, team build-up, and financial baseline.',
    filePath:
      'src/docs/content/reference/ffg-aws-businessplan-03-business-gtm-team-finance.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan-04-project-plan'],
    section: 'reference',
    title: 'FFG/AWS Chapter 04 — 24-Month Project Plan',
    description:
      'FFG/AWS-conform project structure, work packages, milestones, and effort/cost allocation.',
    filePath:
      'src/docs/content/reference/ffg-aws-businessplan-04-project-plan.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan-05-innovation-risk-funding'],
    section: 'reference',
    title: 'FFG/AWS Chapter 05 — Innovation, Risk & Funding Logic',
    description:
      'Research thesis, risk model, and fit-to-program argumentation for FFG and aws.',
    filePath:
      'src/docs/content/reference/ffg-aws-businessplan-05-innovation-risk-funding.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan-06-annex-a-d'],
    section: 'reference',
    title: 'FFG/AWS Chapter 06 — Annex A-D',
    description:
      'Submission checklist, online/PDF process, success factors, and official resource links.',
    filePath:
      'src/docs/content/reference/ffg-aws-businessplan-06-annex-a-d.mdx',
  },
  {
    slug: ['reference', 'ffg-aws-businessplan-07-annex-e-g'],
    section: 'reference',
    title: 'FFG/AWS Chapter 07 — Annex E-G',
    description:
      'Quarterly execution roadmap, sensitivity analysis, and executive one-pager.',
    filePath:
      'src/docs/content/reference/ffg-aws-businessplan-07-annex-e-g.mdx',
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
