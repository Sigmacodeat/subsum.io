import type { ComponentType } from 'react';

export async function loadDocComponentBySlug(
  slug: string[]
): Promise<ComponentType<any> | null> {
  try {
    const slugKey = slug.join('/');

    switch (slugKey) {
      case 'getting-started/overview':
        return (await import('./content/getting-started/overview.mdx')).default;
      case 'getting-started/upload-and-ingest':
        return (await import('./content/getting-started/upload-and-ingest.mdx'))
          .default;
      case 'reference/ffg-aws-businessplan':
        return (
          await import('./content/reference/ffg-aws-businessplan-master-toc.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-01-executive-company-market':
        return (
          await import('./content/reference/ffg-aws-businessplan-01-executive-company-market.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-02-value-product-tech':
        return (
          await import('./content/reference/ffg-aws-businessplan-02-value-product-tech.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-03-business-gtm-team-finance':
        return (
          await import('./content/reference/ffg-aws-businessplan-03-business-gtm-team-finance.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-04-project-plan':
        return (
          await import('./content/reference/ffg-aws-businessplan-04-project-plan.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-05-innovation-risk-funding':
        return (
          await import('./content/reference/ffg-aws-businessplan-05-innovation-risk-funding.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-06-annex-a-d':
        return (
          await import('./content/reference/ffg-aws-businessplan-06-annex-a-d.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-07-annex-e-g':
        return (
          await import('./content/reference/ffg-aws-businessplan-07-annex-e-g.mdx')
        ).default;
      case 'reference/ffg-aws-businessplan-legacy':
        return (await import('./content/reference/ffg-aws-businessplan.mdx'))
          .default;
      case 'reference/supported-file-types':
        return (await import('./content/reference/supported-file-types.mdx'))
          .default;
      case 'reference/security-architecture-factsheet':
        return (
          await import('./content/reference/security-architecture-factsheet.mdx')
        ).default;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
