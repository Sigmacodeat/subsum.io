import { Service } from '@toeverything/infra';

import type { CourtDecision, LegalArea, NormReference } from '../types';

export interface BghCrawlerSearchParams {
  fileNumber?: string;
  fromDate?: string;
  toDate?: string;
  maxResults?: number;
}

const BGH_BASE_URL = 'https://www.bundesgerichtshof.de';

const LEGAL_AREA_HINTS: Array<{ area: LegalArea; keywords: string[] }> = [
  {
    area: 'mietrecht',
    keywords: ['miete', 'mietvertrag', 'mietminderung', 'wohnung'],
  },
  {
    area: 'arbeitsrecht',
    keywords: ['arbeits', 'kuendigung', 'arbeitnehmer', 'arbeitgeber'],
  },
  {
    area: 'verwaltungsrecht',
    keywords: ['behoerde', 'verwaltung', 'verwaltungs', 'bescheid'],
  },
  {
    area: 'strafrecht',
    keywords: ['straf', 'angeklagt', 'verurteilung', 'tat'],
  },
  {
    area: 'zivilrecht',
    keywords: ['vertrag', 'anspruch', 'schadenersatz', 'haftung'],
  },
  {
    area: 'wettbewerbsrecht',
    keywords: ['wettbewerb', 'uwg', 'unterlassung', 'marktverhalten'],
  },
  {
    area: 'datenschutzrecht',
    keywords: ['datenschutz', 'dsgvo', 'personenbezogen', 'verarbeitung'],
  },
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeFileNumber(value: string) {
  return normalizeWhitespace(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/');
}

function parseDateToIso(value: string | null) {
  if (!value) {
    return null;
  }
  const normalized = normalizeWhitespace(value);
  const dateMatch = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) {
    return null;
  }
  const day = dateMatch[1].padStart(2, '0');
  const month = dateMatch[2].padStart(2, '0');
  return `${dateMatch[3]}-${month}-${day}`;
}

function extractByRegex(input: string, regex: RegExp) {
  const match = input.match(regex);
  if (!match) {
    return null;
  }
  return normalizeWhitespace(match[1] ?? match[0]);
}

function classifyLegalAreas(text: string): LegalArea[] {
  const lower = text.toLowerCase();
  const scored = LEGAL_AREA_HINTS.map(item => {
    const score = item.keywords.reduce((acc, kw) => {
      return acc + (lower.includes(kw) ? 1 : 0);
    }, 0);
    return { area: item.area, score };
  }).filter(item => item.score > 0);

  if (scored.length === 0) {
    return ['zivilrecht'];
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(item => item.area);
}

function extractNormReferences(text: string): NormReference[] {
  const pattern =
    /(?:§|Art\.)\s*\d+[a-zA-Z]*\s*(?:Abs\.?\s*\d+)?\s*(BGB|GG|StGB|ZPO|VwGO|BDSG|UWG|DSGVO|HGB)/g;
  const refs: NormReference[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const token = normalizeWhitespace(match[0]);
    const law = match[1]?.toUpperCase() ?? 'BGB';
    const paragraph = token.replace(new RegExp(`\\s*${law}$`, 'i'), '').trim();
    const id = `${law}:${paragraph}`.toLowerCase();
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    refs.push({
      normId: id,
      law,
      paragraph,
      jurisdiction: 'DE',
    });
  }

  return refs;
}

function extractLinks(html: string) {
  const pattern = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

export class BghCrawlerService extends Service {
  private async fetchText(url: string) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) {
      throw new Error(`BGH request failed (${response.status}) for ${url}`);
    }
    return await response.text();
  }

  private normalizeUrl(url: string) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${BGH_BASE_URL}${url}`;
    }
    return `${BGH_BASE_URL}/${url.replace(/^\.\//, '')}`;
  }

  private parseFileNumber(html: string, fallbackFileNumber?: string) {
    const fromAz = extractByRegex(html, /(?:Az\.?|Aktenzeichen)\s*[:-]?\s*([A-Z0-9\s.\-/]+)/i);
    return normalizeFileNumber(fromAz ?? fallbackFileNumber ?? `BGH-${Date.now()}`);
  }

  private parseDecisionDate(html: string, text: string) {
    const parsed =
      parseDateToIso(
        extractByRegex(
          html,
          /(?:Entscheidung\s+vom|Urteil\s+vom|Beschluss\s+vom|Datum)\s*[:-]?\s*([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})/i
        )
      ) ?? parseDateToIso(extractByRegex(text, /([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})/));

    return parsed ?? new Date().toISOString().slice(0, 10);
  }

  private parseDecisionType(text: string): CourtDecision['decisionType'] {
    const lower = text.toLowerCase();
    if (lower.includes('beschluss')) {
      return 'beschluss';
    }
    if (lower.includes('erkenntnis')) {
      return 'erkenntnis';
    }
    if (lower.includes('entscheidung')) {
      return 'entscheidung';
    }
    return 'urteil';
  }

  private parseHeadnotes(html: string, fallbackText: string) {
    const bullets = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(match => normalizeWhitespace(match[1].replace(/<[^>]+>/g, ' ')))
      .filter(Boolean)
      .slice(0, 8);

    if (bullets.length > 0) {
      return bullets;
    }

    const excerpt = fallbackText
      .split(/(?<=[.!?])\s+/)
      .map(item => item.trim())
      .filter(item => item.length > 40)
      .slice(0, 3);

    return excerpt.length > 0
      ? excerpt
      : ['Leitsatz konnte nicht eindeutig aus dem BGH-Dokument extrahiert werden.'];
  }

  private parseDocument(html: string, sourceUrl: string, fallbackFileNumber?: string): CourtDecision {
    const text = normalizeWhitespace(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    );

    const title =
      extractByRegex(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, ' ') ??
      extractByRegex(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
      'BGH Entscheidung';

    const fileNumber = this.parseFileNumber(html, fallbackFileNumber);
    const decisionDate = this.parseDecisionDate(html, text);
    const headnotes = this.parseHeadnotes(html, text);
    const legalAreas = classifyLegalAreas(`${title} ${headnotes.join(' ')} ${text.slice(0, 1500)}`);
    const referencedNorms = extractNormReferences(text);

    return {
      id: `bgh:${fileNumber.toLowerCase().replace(/\s+/g, '-')}`,
      jurisdiction: 'DE',
      court: 'BGH',
      fileNumber,
      decisionDate,
      decisionType: this.parseDecisionType(text),
      title: normalizeWhitespace(title),
      headnotes,
      summary: headnotes[0] ?? normalizeWhitespace(title),
      fullText: text,
      legalAreas,
      keywords: [
        ...new Set(
          (`${title} ${headnotes.join(' ')}`.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? []).slice(
            0,
            20
          )
        ),
      ],
      referencedNorms,
      referencedDecisions: [],
      citedByDecisions: [],
      sourceUrl,
      sourceDatabase: 'openlegaldata',
      isLeadingCase: headnotes.length >= 2 || text.toLowerCase().includes('leitsatz'),
      isOverruled: false,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async findDecisionUrlByFileNumber(fileNumber: string) {
    const normalized = normalizeFileNumber(fileNumber);
    const searchUrl = `${BGH_BASE_URL}/DE/Entscheidungen/Suche/suche_node.html?suchbegriff=${encodeURIComponent(normalized)}`;
    const html = await this.fetchText(searchUrl);
    const links = extractLinks(html)
      .map(link => this.normalizeUrl(link))
      .filter(link =>
        link.includes('/DE/Entscheidungen/') || link.includes('/SharedDocs/Entscheidungen/')
      );

    return links[0] ?? null;
  }

  async fetchDecisionByFileNumber(fileNumber: string) {
    const url = await this.findDecisionUrlByFileNumber(fileNumber);
    if (!url) {
      return null;
    }
    const html = await this.fetchText(url);
    return this.parseDocument(html, url, fileNumber);
  }

  async fetchDecisionByUrl(url: string, fallbackFileNumber?: string) {
    const html = await this.fetchText(url);
    return this.parseDocument(html, url, fallbackFileNumber);
  }

  async fetchRecentDecisions(params: BghCrawlerSearchParams = {}) {
    const maxResults = Math.max(1, Math.min(params.maxResults ?? 10, 100));
    const searchUrl = `${BGH_BASE_URL}/DE/Entscheidungen/entscheidungen_node.html`;
    const html = await this.fetchText(searchUrl);

    const links = extractLinks(html)
      .map(link => this.normalizeUrl(link))
      .filter(link =>
        link.includes('/DE/Entscheidungen/') || link.includes('/SharedDocs/Entscheidungen/')
      )
      .slice(0, maxResults);

    const decisions: CourtDecision[] = [];
    for (const url of links) {
      try {
        const decision = await this.fetchDecisionByUrl(url);
        decisions.push(decision);
      } catch {
        // Best-effort crawl; skip malformed or unavailable pages.
      }
    }

    return decisions;
  }
}
