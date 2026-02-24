import { slugifyHeading } from './slug';

export type TocItem = {
  depth: 2 | 3;
  text: string;
  id: string;
};

export function extractTocFromMdx(source: string): TocItem[] {
  const lines = source.split(/\r?\n/);
  const items: TocItem[] = [];

  for (const line of lines) {
    const m2 = /^##\s+(.+)$/.exec(line);
    if (m2) {
      const text = m2[1].trim();
      items.push({ depth: 2, text, id: slugifyHeading(text) });
      continue;
    }
    const m3 = /^###\s+(.+)$/.exec(line);
    if (m3) {
      const text = m3[1].trim();
      items.push({ depth: 3, text, id: slugifyHeading(text) });
    }
  }

  return items;
}
