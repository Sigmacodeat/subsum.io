import { Service } from '@toeverything/infra';

import type { CourtDecision, LegalArea } from '../types';

export interface HudocCrawlerSearchParams {
  query?: string;
  applicationNumber?: string;
  respondentState?: string;
  fromDate?: string;
  toDate?: string;
  maxResults?: number;
}

type HudocDocument = {
  itemid?: string;
  docname?: string;
  importance?: string;
  kpdate?: string;
  appno?: string;
  languageisocode?: string;
  originatingbody?: string;
  documentcollectionid2?: string;
  title?: string;
  conclusion?: string;
  [key: string]: unknown;
};

const HUDOC_QUERY_URL = 'https://hudoc.echr.coe.int/app/query/results';

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  const normalized = normalizeWhitespace(value);
  const isoLike = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
  }
  const compact = normalized.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (compact) {
    return `${compact[3]}-${compact[2]}-${compact[1]}`;
  }
  return null;
}

function inferLegalAreas(text: string): LegalArea[] {
  const lower = text.toLowerCase();
  const areas: LegalArea[] = [];

  if (lower.includes('article 6') || lower.includes('fair trial') || lower.includes('verfahren')) {
    areas.push('verfassungsrecht');
  }
  if (lower.includes('article 8') || lower.includes('private') || lower.includes('family')) {
    areas.push('menschenrechte');
  }
  if (lower.includes('property') || lower.includes('protocol no. 1')) {
    areas.push('zivilrecht');
  }
  if (lower.includes('detention') || lower.includes('criminal')) {
    areas.push('strafrecht');
  }

  if (areas.length === 0) {
    areas.push('menschenrechte');
  }

  return [...new Set(areas)];
}

function inferDecisionType(text: string): CourtDecision['decisionType'] {
  const lower = text.toLowerCase();
  if (lower.includes('decision')) {
    return 'entscheidung';
  }
  if (lower.includes('judgment')) {
    return 'urteil';
  }
  return 'entscheidung';
}

function pickDocuments(payload: unknown): HudocDocument[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const obj = payload as Record<string, unknown>;

  const candidates = [
    obj.results,
    obj.documents,
    obj.Items,
    obj.items,
    (obj.result as Record<string, unknown> | undefined)?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as HudocDocument[];
    }
  }

  return [];
}

function buildHudocQuery(params: HudocCrawlerSearchParams) {
  const clauses: string[] = [];

  if (params.applicationNumber) {
    clauses.push(`(appno="${params.applicationNumber}")`);
  }
  if (params.respondentState) {
    clauses.push(`(respondent="${params.respondentState}")`);
  }
  if (params.fromDate) {
    clauses.push(`(kpdate>="${params.fromDate}")`);
  }
  if (params.toDate) {
    clauses.push(`(kpdate<="${params.toDate}")`);
  }
  if (params.query) {
    clauses.push(`(${params.query})`);
  }

  if (clauses.length === 0) {
    return '(documentcollectionid2="GRANDCHAMBER" OR documentcollectionid2="CHAMBER")';
  }

  return clauses.join(' AND ');
}

export class HudocCrawlerService extends Service {
  async search(params: HudocCrawlerSearchParams = {}) {
    const maxResults = Math.max(1, Math.min(params.maxResults ?? 20, 100));
    const query = buildHudocQuery(params);

    const response = await fetch(HUDOC_QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        start: 0,
        length: maxResults,
        sort: 'kpdate desc',
      }),
    });

    if (!response.ok) {
      throw new Error(`HUDOC request failed (${response.status})`);
    }

    const payload = (await response.json()) as unknown;
    const docs = pickDocuments(payload).slice(0, maxResults);
    const now = new Date().toISOString();

    return docs.map((doc, index): CourtDecision => {
      const applicationNo = normalizeWhitespace(String(doc.appno ?? doc.itemid ?? `ECHR-${index}`));
      const title = normalizeWhitespace(
        String(doc.title ?? doc.docname ?? `EGMR Entscheidung ${applicationNo}`)
      );
      const summary = normalizeWhitespace(
        String(doc.conclusion ?? doc.docname ?? 'HUDOC Entscheidung ohne Kurzbeschreibung.')
      );
      const chamberRaw = String(doc.originatingbody ?? '').trim();
      const chamber = chamberRaw ? normalizeWhitespace(chamberRaw) : undefined;
      const decisionDate = parseDate(String(doc.kpdate ?? '')) ?? now.slice(0, 10);
      const sourceUrl = `https://hudoc.echr.coe.int/eng?i=${encodeURIComponent(
        String(doc.itemid ?? applicationNo)
      )}`;
      const legalAreas = inferLegalAreas(`${title} ${summary}`);

      return {
        id: `egmr:${applicationNo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        jurisdiction: 'ECHR',
        court: 'EGMR',
        chamber,
        fileNumber: applicationNo,
        decisionDate,
        decisionType: inferDecisionType(`${title} ${summary}`),
        title,
        headnotes: [summary],
        summary,
        legalAreas,
        keywords: [
          ...new Set((`${title} ${summary}`.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? []).slice(0, 20)),
        ],
        referencedNorms: [
          {
            normId: 'emrk-6',
            law: 'EMRK',
            paragraph: 'Art. 6',
            jurisdiction: 'ECHR',
          },
        ],
        referencedDecisions: [],
        citedByDecisions: [],
        sourceUrl,
        sourceDatabase: 'hudoc',
        isLeadingCase: String(doc.importance ?? '').toLowerCase().includes('high'),
        isOverruled: false,
        importedAt: now,
        updatedAt: now,
      };
    });
  }

  async fetchDecisionByApplicationNumber(applicationNumber: string) {
    const results = await this.search({
      applicationNumber,
      maxResults: 1,
    });
    return results[0] ?? null;
  }

  async fetchRecentDecisions(params: HudocCrawlerSearchParams = {}) {
    return await this.search({
      ...params,
      maxResults: params.maxResults ?? 20,
    });
  }
}
