import { Service } from '@toeverything/infra';

import type { CourtDecision, Jurisdiction, LegalArea, NormReference } from '../types';

export interface RisCrawlerSearchParams {
  businessNumber?: string;
  fromDate?: string;
  toDate?: string;
  maxResults?: number;
}

const RIS_BASE_URL = 'https://www.ris.bka.gv.at';

const LEGAL_AREA_KEYWORDS: Array<{ area: LegalArea; keywords: string[] }> = [
  {
    area: 'mietrecht',
    keywords: ['miete', 'mietvertrag', 'mietzins', 'mrg', 'wohnung'],
  },
  {
    area: 'arbeitsrecht',
    keywords: ['arbeitsvertrag', 'arbeitnehmer', 'arbeitgeber', 'kuendigung'],
  },
  {
    area: 'strafrecht',
    keywords: ['straf', 'angeklagte', 'verurteilung', 'taeter', 'tatbestand'],
  },
  {
    area: 'verwaltungsrecht',
    keywords: ['verwaltungs', 'behoerde', 'bescheid', 'oeffentliches recht'],
  },
  {
    area: 'zivilrecht',
    keywords: ['schadenersatz', 'vertrag', 'anspruch', 'abgb', 'haftung'],
  },
  {
    area: 'familienrecht',
    keywords: ['obsorge', 'unterhalt', 'scheidung', 'familie'],
  },
  {
    area: 'handelsrecht',
    keywords: ['ugb', 'gesellschaft', 'kaufmann', 'firma'],
  },
];

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function sanitizeBusinessNumber(input: string) {
  return normalizeWhitespace(input).replace(/\s+/g, '');
}

function extractByRegex(content: string, regex: RegExp) {
  const match = content.match(regex);
  if (!match) {
    return null;
  }
  return normalizeWhitespace(match[1] ?? match[0]);
}

function parseDateToIso(dateValue: string | null) {
  if (!dateValue) {
    return null;
  }
  const normalized = normalizeWhitespace(dateValue);
  const m = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) {
    return null;
  }
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  return `${m[3]}-${month}-${day}`;
}

function scoreLegalAreas(input: string): LegalArea[] {
  const lower = input.toLowerCase();
  const scored = LEGAL_AREA_KEYWORDS.map(item => {
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

function extractNormReferences(input: string): NormReference[] {
  const pattern = /§\s*\d+[a-zA-Z]*\s*(?:Abs\.?\s*\d+)?\s*(ABGB|MRG|StGB|StPO|ZPO|EO|IO|UGB|ASVG|KSchG|EMRK)/g;
  const references: NormReference[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    const token = normalizeWhitespace(match[0]);
    const law = match[1]?.toUpperCase() ?? 'ABGB';
    const paragraph = token.replace(new RegExp(`\\s*${law}$`, 'i'), '').trim();
    const id = `${law}:${paragraph}`.toLowerCase();
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    references.push({
      normId: id,
      law,
      paragraph,
      jurisdiction: law === 'EMRK' ? 'ECHR' : 'AT',
    });
  }

  return references;
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

export class RisCrawlerService extends Service {
  private async fetchText(url: string) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`RIS request failed (${response.status}) for ${url}`);
    }

    return await response.text();
  }

  private parseHeadnotes(html: string, fallbackText: string) {
    const listItems = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(match => normalizeWhitespace(match[1].replace(/<[^>]+>/g, ' ')))
      .filter(Boolean)
      .slice(0, 8);

    if (listItems.length > 0) {
      return listItems;
    }

    const sentenceCandidates = fallbackText
      .split(/(?<=[.!?])\s+/)
      .map(item => item.trim())
      .filter(item => item.length > 40)
      .slice(0, 3);

    return sentenceCandidates.length > 0
      ? sentenceCandidates
      : ['Leitsatz konnte nicht eindeutig extrahiert werden.'];
  }

  private parseTitle(html: string) {
    const h1 = extractByRegex(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) {
      return h1.replace(/<[^>]+>/g, ' ').trim();
    }
    const title = extractByRegex(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    return title ?? 'RIS Entscheidung';
  }

  private parseFileNumber(html: string, businessNumber?: string) {
    const extracted =
      extractByRegex(html, /(?:GZ|Geschaeftszahl|Geschäftszahl)\s*[:-]?\s*([0-9A-Za-z\s/.-]+)/i) ??
      extractByRegex(html, /([0-9]\s*Ob\s*[0-9]+\/[0-9]{2,4}[a-z]?)/i);

    return sanitizeBusinessNumber(extracted ?? businessNumber ?? `RIS-${Date.now()}`);
  }

  private parseDecisionDate(html: string, text: string) {
    const dateLabel =
      parseDateToIso(
        extractByRegex(
          html,
          /(?:Entscheidungsdatum|Entscheidung vom|Datum)\s*[:-]?\s*([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})/i
        )
      ) ?? parseDateToIso(extractByRegex(text, /([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})/));

    return dateLabel ?? new Date().toISOString().slice(0, 10);
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

  private normalizeUrl(link: string) {
    if (!link) {
      return null;
    }
    if (link.startsWith('http://') || link.startsWith('https://')) {
      return link;
    }
    if (link.startsWith('/')) {
      return `${RIS_BASE_URL}${link}`;
    }
    return `${RIS_BASE_URL}/${link.replace(/^\.\//, '')}`;
  }

  private parseDocumentFromHtml(
    html: string,
    sourceUrl: string,
    businessNumber?: string
  ): CourtDecision {
    const bodyText = normalizeWhitespace(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));

    const title = this.parseTitle(html);
    const fileNumber = this.parseFileNumber(html, businessNumber);
    const decisionDate = this.parseDecisionDate(html, bodyText);
    const headnotes = this.parseHeadnotes(html, bodyText);
    const referencedNorms = extractNormReferences(bodyText);
    const legalAreas = scoreLegalAreas(`${title} ${headnotes.join(' ')} ${bodyText.slice(0, 1500)}`);

    return {
      id: `ogh:${fileNumber.toLowerCase()}`,
      jurisdiction: 'AT' as Jurisdiction,
      court: 'OGH',
      precedentialWeight: 'supreme',
      fileNumber,
      decisionDate,
      appliesFrom: decisionDate,
      decisionType: this.parseDecisionType(bodyText),
      title,
      headnotes,
      summary: headnotes[0] ?? title,
      fullText: bodyText,
      legalAreas,
      keywords: [...new Set((`${title} ${headnotes.join(' ')}`.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? []).slice(0, 20))],
      referencedNorms,
      referencedDecisions: [],
      citedByDecisions: [],
      sourceUrl,
      sourceDatabase: 'ris',
      isLeadingCase: headnotes.length >= 2 || bodyText.toLowerCase().includes('rechtssatz'),
      isOverruled: false,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'ris-crawler',
    };
  }

  async findDecisionUrlByBusinessNumber(businessNumber: string) {
    const gz = sanitizeBusinessNumber(businessNumber);
    const searchUrl = `${RIS_BASE_URL}/Ergebnis.wxe?Abfrage=Justiz&GZ=${encodeURIComponent(gz)}`;
    const html = await this.fetchText(searchUrl);
    const candidates = extractLinks(html)
      .map(link => this.normalizeUrl(link))
      .filter((link): link is string => !!link)
      .filter(link => link.includes('/Dokument.wxe') || link.includes('/Dokumente/Justiz/'));

    return candidates[0] ?? null;
  }

  async fetchDecisionByBusinessNumber(businessNumber: string) {
    const url = await this.findDecisionUrlByBusinessNumber(businessNumber);
    if (!url) {
      return null;
    }
    const html = await this.fetchText(url);
    return this.parseDocumentFromHtml(html, url, businessNumber);
  }

  async fetchDecisionByUrl(url: string, fallbackBusinessNumber?: string) {
    const html = await this.fetchText(url);
    return this.parseDocumentFromHtml(html, url, fallbackBusinessNumber);
  }

  async fetchRecentDecisions(params: RisCrawlerSearchParams = {}) {
    const maxResults = Math.max(1, Math.min(params.maxResults ?? 10, 100));
    const query = new URLSearchParams({
      Abfrage: 'Justiz',
      Gericht: 'OGH',
      ImRisSeit: 'True',
    });
    if (params.fromDate) {
      query.set('VonDatum', params.fromDate);
    }
    if (params.toDate) {
      query.set('BisDatum', params.toDate);
    }

    const searchUrl = `${RIS_BASE_URL}/Ergebnis.wxe?${query.toString()}`;
    const html = await this.fetchText(searchUrl);
    const decisionUrls = extractLinks(html)
      .map(link => this.normalizeUrl(link))
      .filter((link): link is string => !!link)
      .filter(link => link.includes('/Dokument.wxe') || link.includes('/Dokumente/Justiz/'))
      .slice(0, maxResults);

    const decisions: CourtDecision[] = [];
    for (const url of decisionUrls) {
      try {
        const decision = await this.fetchDecisionByUrl(url);
        decisions.push(decision);
      } catch {
        // Skip malformed or unavailable entries, keep pipeline robust.
      }
    }

    return decisions;
  }
}
