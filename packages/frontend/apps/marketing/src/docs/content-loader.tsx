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
