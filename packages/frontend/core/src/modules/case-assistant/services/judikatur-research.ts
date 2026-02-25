import { Service } from '@toeverything/infra';

import type {
  CitationChain,
  CourtDecision,
  JudikaturSuggestion,
  Jurisdiction,
  LegalNormRegistryRecord,
  LegalArea,
  LegalFinding,
  NormReference,
} from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { CaseProviderSettingsService } from './provider-settings';
import type { RisCrawlerService } from './ris-crawler';

type RemoteDecisionPayload = {
  id?: string;
  fileNumber?: string;
  court?: CourtDecision['court'];
  title?: string;
  summary?: string;
  decisionDate?: string;
  legalAreas?: LegalArea[];
  keywords?: string[];
  jurisdiction?: CourtDecision['jurisdiction'];
  sourceUrl?: string;
};

type JudikaturSearchOptions = {
  preferredJurisdictions?: Jurisdiction[];
  includeInternationalOverlay?: boolean;
};

const ALL_JURISDICTIONS: Jurisdiction[] = ['AT', 'DE', 'CH', 'FR', 'IT', 'PT', 'PL', 'EU', 'ECHR'];
const INTERNATIONAL_JURISDICTIONS = new Set<Jurisdiction>(['EU', 'ECHR']);

function toRisDateParam(dateIsoLike: string) {
  const parsed = new Date(dateIsoLike);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = String(parsed.getFullYear());
  return `${day}.${month}.${year}`;
}

function inferPrecedentialWeight(decision: Pick<CourtDecision, 'jurisdiction' | 'court'>): NonNullable<CourtDecision['precedentialWeight']> {
  const court = String(decision.court).toUpperCase();

  if (
    decision.jurisdiction === 'EU' ||
    decision.jurisdiction === 'ECHR' ||
    court.includes('EUGH') ||
    court.includes('EGMR') ||
    court.includes('EU')
  ) {
    return 'international';
  }

  if (
    [
      'OGH',
      'VFGH',
      'VWGH',
      'BGH',
      'BVERFG',
      'BVERWG',
      'BAG',
      'BSG',
      'BFH',
      'BGER',
      'CE_FR',
      'CC_FR',
      'CDC',
      'CC_IT',
      'STJ_PT',
      'SN_PL',
      'TK_PL',
      'NSA_PL',
    ].some(token => court.includes(token))
  ) {
    return 'supreme';
  }

  if (court.includes('OLG') || court.includes('CA_') || court.includes('SA_') || court.includes('CDA_')) {
    return 'appellate';
  }

  if (court.includes('LG') || court.includes('AG') || court.includes('BG_') || court.includes('TRIB')) {
    return 'first_instance';
  }

  return 'unknown';
}
const LAW_FAMILY_EQUIVALENTS: Record<string, Partial<Record<Jurisdiction, string[]>>> = {
  civil_code: {
    AT: ['ABGB'],
    DE: ['BGB'],
    CH: ['OR', 'ZGB'],
    FR: ['Code civil'],
    IT: ['Codice civile'],
    PT: ['Código Civil'],
    PL: ['KC'],
  },
  civil_procedure: {
    AT: ['ZPO-AT'],
    DE: ['ZPO'],
    CH: ['ZPO-CH'],
    FR: ['CPC-FR'],
    IT: ['CPC-IT'],
    PT: ['CPC-PT'],
    PL: ['KPC'],
  },
  criminal_code: {
    AT: ['StGB-AT'],
    DE: ['StGB'],
    CH: ['StGB-CH'],
    FR: ['Code pénal'],
    IT: ['Codice penale'],
    PT: ['Código Penal'],
    PL: ['KK'],
  },
  human_rights: {
    ECHR: ['EMRK'],
    EU: ['DSGVO/GDPR'],
  },
};

const SEED_DECISIONS: CourtDecision[] = [
  {
    id: 'jud:de:bgh:vi-zr-123-20',
    jurisdiction: 'DE',
    court: 'BGH',
    precedentialWeight: 'supreme',
    fileNumber: 'VI ZR 123/20',
    decisionDate: '2021-03-15T00:00:00.000Z',
    appliesFrom: '2021-03-15T00:00:00.000Z',
    decisionType: 'urteil',
    title: 'Amtshaftung bei pflichtwidriger Behördenauskunft',
    headnotes: ['Amtspflichtverletzung kann bei fehlerhafter Auskunft drittschützend sein.'],
    summary:
      'BGH konkretisiert Voraussetzungen der Amtshaftung bei fehlerhafter behördlicher Auskunft und Drittbezug.',
    legalAreas: ['verwaltungsrecht', 'zivilrecht'],
    keywords: ['amtshaftung', 'amtspflichtverletzung', 'auskunft', 'drittbezogenheit'],
    referencedNorms: [
      { normId: 'bgb-839', law: 'BGB', paragraph: '§ 839', jurisdiction: 'DE' },
      { normId: 'gg-34', law: 'GG', paragraph: 'Art. 34', jurisdiction: 'DE' },
    ],
    referencedDecisions: [],
    citedByDecisions: [],
    sourceDatabase: 'manual',
    isLeadingCase: true,
    isOverruled: false,
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'jud:de:bgh:viii-zr-311-19',
    jurisdiction: 'DE',
    court: 'BGH',
    precedentialWeight: 'supreme',
    fileNumber: 'VIII ZR 311/19',
    decisionDate: '2022-06-22T00:00:00.000Z',
    appliesFrom: '2022-06-22T00:00:00.000Z',
    decisionType: 'urteil',
    title: 'Mietminderung bei erheblichem Wohnungsmangel',
    headnotes: ['Mietminderung nach § 536 BGB tritt kraft Gesetzes ein.'],
    summary:
      'BGH bestätigt Anforderungen an Mängelanzeige und Umfang der Minderung bei Wohnraummängeln.',
    legalAreas: ['mietrecht', 'zivilrecht'],
    keywords: ['mietminderung', 'mangel', 'mietsache', '536 bgb'],
    referencedNorms: [{ normId: 'bgb-536', law: 'BGB', paragraph: '§ 536', jurisdiction: 'DE' }],
    referencedDecisions: [],
    citedByDecisions: [],
    sourceDatabase: 'manual',
    isLeadingCase: true,
    isOverruled: false,
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'jud:de:bverwg:8-c-14-18',
    jurisdiction: 'DE',
    court: 'BVerwG',
    precedentialWeight: 'supreme',
    fileNumber: '8 C 14.18',
    decisionDate: '2020-11-10T00:00:00.000Z',
    appliesFrom: '2020-11-10T00:00:00.000Z',
    decisionType: 'urteil',
    title: 'Widerspruchsfrist bei fehlerhafter Rechtsbehelfsbelehrung',
    headnotes: ['Fehlerhafte Belehrung kann Fristlauf beeinflussen (§ 58 VwGO).'],
    summary:
      'BVerwG zur Widerspruchsfrist und Wiedereinsetzung bei unklarer Rechtsbehelfsbelehrung.',
    legalAreas: ['verwaltungsrecht'],
    keywords: ['widerspruch', 'frist', 'rechtsbehelfsbelehrung', '58 vwgo'],
    referencedNorms: [],
    referencedDecisions: [],
    citedByDecisions: [],
    sourceDatabase: 'manual',
    isLeadingCase: false,
    isOverruled: false,
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function buildUnicodeRegex(
  pattern: string,
  flags: string,
  fallback: RegExp
): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return fallback;
  }
}

function resolvePrimaryJurisdiction(preferred: Jurisdiction[]): Jurisdiction {
  return preferred.find(item => !INTERNATIONAL_JURISDICTIONS.has(item)) ?? preferred[0] ?? 'DE';
}

function classifyAuthorityLevel(input: {
  decisionJurisdiction: Jurisdiction;
  primaryJurisdiction: Jurisdiction;
  relevanceScore: number;
  precedentialWeight?: CourtDecision['precedentialWeight'];
}): NonNullable<JudikaturSuggestion['authorityLevel']> {
  if (
    input.decisionJurisdiction === input.primaryJurisdiction &&
    (input.precedentialWeight === 'supreme' || input.precedentialWeight === 'international')
  ) {
    return 'binding';
  }

  if (input.decisionJurisdiction === input.primaryJurisdiction) {
    return 'binding';
  }

  if (INTERNATIONAL_JURISDICTIONS.has(input.decisionJurisdiction)) {
    return input.relevanceScore >= 0.45 ? 'persuasive' : 'reference';
  }

  return input.relevanceScore >= 0.5 ? 'persuasive' : 'reference';
}

function evaluateTemporalApplicability(decision: CourtDecision): {
  temporalApplicability: NonNullable<JudikaturSuggestion['temporalApplicability']>;
  temporalReason: string;
} {
  const nowMs = Date.now();

  if (decision.isOverruled) {
    return {
      temporalApplicability: 'historical',
      temporalReason: decision.overruledBy
        ? `Entscheidung wurde überholt (overruledBy: ${decision.overruledBy}).`
        : 'Entscheidung ist als überholt markiert.',
    };
  }

  if (decision.appliesUntil) {
    const appliesUntilMs = new Date(decision.appliesUntil).getTime();
    if (Number.isFinite(appliesUntilMs) && appliesUntilMs < nowMs) {
      return {
        temporalApplicability: 'historical',
        temporalReason: `Anwendungszeitraum endete am ${new Date(decision.appliesUntil).toLocaleDateString('de-DE')}.`,
      };
    }
  }

  if (decision.decisionDate) {
    const decisionDateMs = new Date(decision.decisionDate).getTime();
    if (Number.isFinite(decisionDateMs)) {
      const ageYears = (nowMs - decisionDateMs) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears > 20 && !decision.isLeadingCase) {
        return {
          temporalApplicability: 'unknown',
          temporalReason: 'Ältere Entscheidung ohne Leitentscheidungsstatus – Aktualität prüfen.',
        };
      }
    }
  }

  return {
    temporalApplicability: 'current',
    temporalReason: 'Kein Hinweis auf Überholung oder zeitliche Einschränkung erkannt.',
  };
}

function tokenize(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/gi, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 3)
  );
}

function normalizeScorableText(decision: CourtDecision) {
  return [
    decision.fileNumber,
    decision.title,
    decision.summary,
    decision.headnotes.join(' '),
    decision.fullText ?? '',
    decision.keywords.join(' '),
    decision.referencedNorms.map(item => `${item.law} ${item.paragraph}`).join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

function scoreDecision(tokens: Set<string>, decision: CourtDecision) {
  let score = 0;
  const text = normalizeScorableText(decision);

  for (const token of tokens) {
    if (text.includes(token)) {
      score += 1;
    }
  }

  for (const keyword of decision.keywords) {
    const parts = keyword.toLowerCase().split(/\s+/);
    const matched = parts.filter(part => tokens.has(part)).length;
    if (matched > 0) {
      score += matched / parts.length;
    }
  }

  if (decision.isLeadingCase) {
    score += 0.75;
  }

  const precedentialWeight = decision.precedentialWeight ?? inferPrecedentialWeight(decision);
  if (precedentialWeight === 'supreme') {
    score += 0.65;
  } else if (precedentialWeight === 'international') {
    score += 0.7;
  } else if (precedentialWeight === 'appellate') {
    score += 0.25;
  }

  if (decision.verifiedAt) {
    score += 0.2;
  }

  if (decision.sourceDatabase === 'ris' || decision.sourceDatabase === 'hudoc' || decision.sourceDatabase === 'juris') {
    score += 0.2;
  }

  if (tokens.has('frist') && text.includes('frist')) {
    score += 0.5;
  }

  return score;
}

function uniqueNormReferences(input: CourtDecision['referencedNorms']) {
  const seen = new Set<string>();
  return input.filter(item => {
    const key = `${item.jurisdiction}:${item.law}:${item.paragraph}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueStrings(input: string[]) {
  return [...new Set(input.filter(Boolean).map(item => item.trim()).filter(Boolean))];
}

function normalizeLawToken(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(
      buildUnicodeRegex(String.raw`[^\p{L}\p{N}\- ]`, 'gu', /[^A-Za-zÄÖÜäöüß0-9\- ]/g),
      ''
    )
    .trim();
}

function normalizeParagraphToken(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(
      buildUnicodeRegex(
        String.raw`[^\p{L}\p{N}\-§./ ]`,
        'gu',
        /[^A-Za-zÄÖÜäöüß0-9\-§./ ]/g
      ),
      ''
    )
    .trim();
}

function resolveLawFamily(law: string): string | null {
  const normalizedLaw = normalizeLawToken(law);
  for (const [family, byJurisdiction] of Object.entries(LAW_FAMILY_EQUIVALENTS)) {
    for (const aliases of Object.values(byJurisdiction)) {
      if (!aliases) continue;
      if (aliases.some(alias => normalizeLawToken(alias) === normalizedLaw)) {
        return family;
      }
    }
  }
  return null;
}

function mergeEquivalentNorms(
  a: NonNullable<LegalNormRegistryRecord['equivalentNorms']>,
  b: NonNullable<LegalNormRegistryRecord['equivalentNorms']>
) {
  const seen = new Set<string>();
  const out: NonNullable<LegalNormRegistryRecord['equivalentNorms']> = [];
  for (const item of [...a, ...b]) {
    const key = `${item.jurisdiction}:${item.normId}:${item.similarity}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normRegistryIdFromReference(ref: NormReference) {
  return `norm-registry:${ref.jurisdiction.toLowerCase()}:${normalizeLawToken(ref.law)}:${normalizeParagraphToken(ref.paragraph)}`;
}

function normalizeSearchOptions(options: JudikaturSearchOptions): Required<JudikaturSearchOptions> {
  const preferred = uniqueStrings(options.preferredJurisdictions ?? [])
    .map(item => item.toUpperCase() as Jurisdiction)
    .filter((item): item is Jurisdiction => ALL_JURISDICTIONS.includes(item));

  return {
    preferredJurisdictions: preferred.length > 0 ? preferred : ['DE'],
    includeInternationalOverlay: options.includeInternationalOverlay !== false,
  };
}

function detectProceedingSignals(query: string) {
  const q = query.toLowerCase();
  return {
    humanRights: /\b(emrk|echr|menschenrecht|grundrecht|diskriminierung)\b/.test(q),
    euLaw: /\b(eu|union|dsgvo|gdpr|eu-gh|eugh|richtlinie|verordnung)\b/.test(q),
    constitutional: /\b(verfassung|verfassungsgericht|vfgh|bverfg)\b/.test(q),
    criminal: /\b(straf|anklage|beschuldig|stpo|stgb)\b/.test(q),
    procedural: /\b(zpo|prozess|verfahren|frist|rechtsmittel|berufung|revision)\b/.test(q),
  };
}

function buildJurisdictionBonusMap(
  options: Required<JudikaturSearchOptions>,
  query = ''
) {
  const map = new Map<Jurisdiction, number>();
  const signals = detectProceedingSignals(query);

  for (const jurisdiction of ALL_JURISDICTIONS) {
    if (INTERNATIONAL_JURISDICTIONS.has(jurisdiction)) {
      map.set(jurisdiction, options.includeInternationalOverlay ? 0.45 : 0.05);
    } else {
      map.set(jurisdiction, 0.2);
    }
  }

  options.preferredJurisdictions.forEach((jurisdiction, index) => {
    map.set(jurisdiction, Math.max(3.0 - index * 0.45, 1.3));
  });

  if (options.includeInternationalOverlay) {
    map.set('EU', Math.max(map.get('EU') ?? 0, 0.75));
    map.set('ECHR', Math.max(map.get('ECHR') ?? 0, 0.6));
  }

  if (signals.humanRights) {
    map.set('ECHR', (map.get('ECHR') ?? 0) + 1.3);
    map.set('EU', (map.get('EU') ?? 0) + 0.7);
  }

  if (signals.euLaw) {
    map.set('EU', (map.get('EU') ?? 0) + 1.1);
  }

  if (signals.constitutional) {
    map.set('ECHR', (map.get('ECHR') ?? 0) + 0.5);
    map.set('EU', (map.get('EU') ?? 0) + 0.4);
  }

  if (signals.criminal || signals.procedural) {
    for (const preferred of options.preferredJurisdictions) {
      map.set(preferred, (map.get(preferred) ?? 0) + 0.25);
    }
  }

  return map;
}

function buildExplainableMatchReason(input: {
  decision: CourtDecision;
  matchedKeywords: string[];
  lexicalScore: number;
  jurisdictionBonus: number;
  proceedingSignals: ReturnType<typeof detectProceedingSignals>;
  primaryJurisdiction: Jurisdiction;
  authorityLevel: NonNullable<JudikaturSuggestion['authorityLevel']>;
  isCrossBorder: boolean;
}) {
  const parts = [
    input.matchedKeywords.length > 0
      ? `Keyword-Match: ${input.matchedKeywords.join(', ')}`
      : 'Semantischer Match über Fallkontext',
    `Jurisdiktion: ${input.decision.jurisdiction}`,
    `Score: lexical ${input.lexicalScore.toFixed(2)} + jurisdiction ${input.jurisdictionBonus.toFixed(2)}`,
    `Autorität: ${input.authorityLevel}`,
  ];

  if (input.isCrossBorder) {
    parts.push(`Cross-Border-Referenz (${input.primaryJurisdiction} → ${input.decision.jurisdiction})`);
  }

  if (input.decision.isLeadingCase) {
    parts.push('Leitentscheidung-Bonus aktiv');
  }
  if (input.proceedingSignals.humanRights && input.decision.jurisdiction === 'ECHR') {
    parts.push('EMRK-Overlay wegen Grundrechts-/Menschenrechtsbezug');
  }
  if (input.proceedingSignals.euLaw && input.decision.jurisdiction === 'EU') {
    parts.push('EU-Overlay wegen Unionsrechts-/DSGVO-Bezug');
  }

  return parts.join(' | ');
}

function extractAustrianBusinessNumbers(query: string) {
  const matches = [
    ...query.matchAll(/\b\d+\s*Ob\s*\d+\/[0-9]{2,4}[a-z]?\b/gi),
    ...query.matchAll(/\b\d+\s*Os\s*\d+\/[0-9]{2,4}[a-z]?\b/gi),
    ...query.matchAll(/\b\d+\s*Nc\s*\d+\/[0-9]{2,4}[a-z]?\b/gi),
  ];
  return uniqueStrings(matches.map(match => match[0] ?? ''));
}

function dedupeDecisions(decisions: CourtDecision[]) {
  const byKey = new Map<string, CourtDecision>();
  for (const decision of decisions) {
    const key = `${decision.id}::${decision.fileNumber}::${decision.court}`.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, decision);
    }
  }
  return [...byKey.values()];
}

function dedupeNormReferences(refs: NormReference[]) {
  const seen = new Set<string>();
  const out: NormReference[] = [];
  for (const ref of refs) {
    const key = `${ref.jurisdiction}:${ref.law}:${ref.paragraph}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export class JudikaturResearchService extends Service {
  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly providerSettingsService: CaseProviderSettingsService,
    private readonly risCrawlerService: RisCrawlerService
  ) {
    super();
  }

  private buildEquivalentNormReferences(
    source: NormReference,
    preferredJurisdictions: Jurisdiction[]
  ): NormReference[] {
    const family = resolveLawFamily(source.law);
    if (!family) {
      return [];
    }

    const paragraph = source.paragraph.trim();
    const byJurisdiction = LAW_FAMILY_EQUIVALENTS[family] ?? {};
    const orderedJurisdictions = [
      ...preferredJurisdictions,
      ...ALL_JURISDICTIONS.filter(j => !preferredJurisdictions.includes(j)),
    ];

    const out: NormReference[] = [];
    for (const jurisdiction of orderedJurisdictions) {
      if (jurisdiction === source.jurisdiction) {
        continue;
      }
      const laws = byJurisdiction[jurisdiction] ?? [];
      if (laws.length === 0) {
        continue;
      }
      const law = laws[0];
      out.push({
        normId: `norm-registry:${jurisdiction.toLowerCase()}:${normalizeLawToken(law)}:${normalizeParagraphToken(paragraph)}`,
        law,
        paragraph,
        jurisdiction,
      });
    }

    return out;
  }

  private async upsertNormRegistryFromDecision(
    decision: CourtDecision,
    preferredJurisdictions: Jurisdiction[]
  ) {
    const now = new Date().toISOString();
    const registry = (this.orchestration.legalNormRegistry$.value ?? []) as LegalNormRegistryRecord[];

    for (const ref of decision.referencedNorms) {
      const id = normRegistryIdFromReference(ref);
      const existing = registry.find(item => item.id === id);
      const equivalentRefs = this.buildEquivalentNormReferences(ref, preferredJurisdictions);
      const equivalentNorms = mergeEquivalentNorms(
        existing?.equivalentNorms ?? [],
        equivalentRefs.map(item => ({
          jurisdiction: item.jurisdiction,
          normId: item.normId,
          similarity: INTERNATIONAL_JURISDICTIONS.has(item.jurisdiction) ? 'related' : 'similar',
        }))
      );

      const merged: LegalNormRegistryRecord = {
        id,
        jurisdiction: ref.jurisdiction,
        law: ref.law,
        paragraph: ref.paragraph,
        title: existing?.title ?? `${ref.law} ${ref.paragraph}`,
        shortDescription:
          existing?.shortDescription ??
          `Automatisch aus Judikatur referenzierte Norm (${decision.court} ${decision.fileNumber}).`,
        legalAreas: uniqueStrings([...(existing?.legalAreas ?? []), ...decision.legalAreas]) as LegalArea[],
        keywords: uniqueStrings([
          ...(existing?.keywords ?? []),
          ref.law,
          ref.paragraph,
          ...decision.keywords,
        ]),
        limitationPeriodYears: existing?.limitationPeriodYears,
        burdenOfProof: existing?.burdenOfProof,
        equivalentNorms,
        leadingCaseIds: uniqueStrings([
          ...(existing?.leadingCaseIds ?? []),
          ...(decision.isLeadingCase ? [decision.id] : []),
        ]),
        recentCaseIds: uniqueStrings([...(existing?.recentCaseIds ?? []), decision.id]),
        sourceUrl: decision.sourceUrl ?? existing?.sourceUrl,
        importedAt: existing?.importedAt ?? now,
        updatedAt: now,
      };

      await this.orchestration.upsertLegalNormRegistryRecord(merged);
    }
  }

  private buildComparativeCitationChain(input: {
    caseId: string;
    workspaceId: string;
    suggestions: JudikaturSuggestion[];
    decisionPool: CourtDecision[];
    preferredJurisdictions: Jurisdiction[];
  }): CitationChain | null {
    const preferred = input.preferredJurisdictions;
    const primaryJurisdiction = preferred[0] ?? 'DE';
    const decisionById = new Map(input.decisionPool.map(item => [item.id, item]));
    const rankedSuggestions = [...input.suggestions].sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    );

    const baseDecisions = rankedSuggestions
      .map(item => decisionById.get(item.decisionId))
      .filter((item): item is CourtDecision => !!item)
      .filter(item => item.jurisdiction === primaryJurisdiction)
      .slice(0, 3);

    if (baseDecisions.length === 0) {
      return null;
    }

    const relatedDecisionCandidates = input.decisionPool
      .filter(item => item.jurisdiction !== primaryJurisdiction)
      .map(item => {
        let overlapScore = 0;
        for (const base of baseDecisions) {
          const areaOverlap = item.legalAreas.filter(area => base.legalAreas.includes(area)).length;
          const keywordOverlap = item.keywords.filter(kw =>
            base.keywords.some(baseKw => baseKw.toLowerCase() === kw.toLowerCase())
          ).length;
          overlapScore = Math.max(overlapScore, areaOverlap * 2 + keywordOverlap);
        }
        const preferredBoost = preferred.includes(item.jurisdiction) ? 2 : 0;
        const internationalBoost = INTERNATIONAL_JURISDICTIONS.has(item.jurisdiction) ? 1 : 0;
        return { decision: item, score: overlapScore + preferredBoost + internationalBoost };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.decision);

    const equivalentNormRefs: NormReference[] = [];
    for (const base of baseDecisions) {
      for (const ref of base.referencedNorms) {
        equivalentNormRefs.push(...this.buildEquivalentNormReferences(ref, preferred).slice(0, 2));
      }
    }

    const dedupEquivalentNormRefs = dedupeNormReferences(equivalentNormRefs).slice(0, 6);

    const entries: CitationChain['entries'] = [];
    let order = 1;

    for (const base of baseDecisions) {
      entries.push({
        order: order++,
        type: 'decision',
        decisionId: base.id,
        decisionFileNumber: base.fileNumber,
        decisionCourt: base.court,
        decisionDate: base.decisionDate,
        headnote: base.headnotes[0],
        annotation: `Nationale Leitentscheidung (${base.jurisdiction})`,
        citationFormatted: `${base.court}, ${base.fileNumber} — ${base.title}`,
      });
    }

    for (const normRef of dedupEquivalentNormRefs) {
      entries.push({
        order: order++,
        type: 'norm',
        normReference: normRef,
        annotation: `Jurisdiktionsvergleich: äquivalente Norm in ${normRef.jurisdiction}`,
        citationFormatted: `${normRef.law} ${normRef.paragraph} [${normRef.jurisdiction}]`,
      });
    }

    for (const comparison of relatedDecisionCandidates) {
      entries.push({
        order: order++,
        type: 'decision',
        decisionId: comparison.id,
        decisionFileNumber: comparison.fileNumber,
        decisionCourt: comparison.court,
        decisionDate: comparison.decisionDate,
        headnote: comparison.headnotes[0],
        annotation: `Vergleichsentscheidung (${comparison.jurisdiction})`,
        citationFormatted: `${comparison.court}, ${comparison.fileNumber} — ${comparison.title}`,
      });
    }

    if (entries.length <= baseDecisions.length) {
      return null;
    }

    const now = new Date().toISOString();
    const secondaryJurisdictions = uniqueStrings(preferred.filter(j => j !== primaryJurisdiction));
    return {
      id: createId('citation-chain-comparative'),
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      title: `Vergleichsrechtsprechung ${primaryJurisdiction} → ${secondaryJurisdictions.join(' / ') || 'EU / ECHR'}`,
      entries,
      generatedAt: now,
      updatedAt: now,
    };
  }

  private rankAndLimit(
    query: string,
    decisions: CourtDecision[],
    limit: number,
    options: Required<JudikaturSearchOptions>
  ) {
    const tokens = tokenize(query);
    const jurisdictionBonusMap = buildJurisdictionBonusMap(options, query);

    return dedupeDecisions(decisions)
      .map(decision => ({
        decision,
        score:
          scoreDecision(tokens, decision) +
          (jurisdictionBonusMap.get(decision.jurisdiction) ?? 0),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.decision);
  }

  private mergeDecisionRecord(existing: CourtDecision | undefined, incoming: CourtDecision): CourtDecision {
    if (!existing) {
      return incoming;
    }

    const mergedFullText =
      (incoming.fullText?.length ?? 0) >= (existing.fullText?.length ?? 0)
        ? incoming.fullText
        : existing.fullText;

    const mergedReasoning =
      (incoming.reasoning?.length ?? 0) >= (existing.reasoning?.length ?? 0)
        ? incoming.reasoning
        : existing.reasoning;

    const mergedFacts =
      (incoming.facts?.length ?? 0) >= (existing.facts?.length ?? 0)
        ? incoming.facts
        : existing.facts;

    return {
      ...existing,
      ...incoming,
      chamber: incoming.chamber ?? existing.chamber,
      ecli: incoming.ecli ?? existing.ecli,
      publicationDate: incoming.publicationDate ?? existing.publicationDate,
      precedentialWeight: incoming.precedentialWeight ?? existing.precedentialWeight,
      appliesFrom: incoming.appliesFrom ?? existing.appliesFrom,
      appliesUntil: incoming.appliesUntil ?? existing.appliesUntil,
      summary: incoming.summary.length >= existing.summary.length ? incoming.summary : existing.summary,
      fullText: mergedFullText,
      facts: mergedFacts,
      reasoning: mergedReasoning,
      headnotes: uniqueStrings([...(existing.headnotes ?? []), ...(incoming.headnotes ?? [])]),
      keywords: uniqueStrings([...(existing.keywords ?? []), ...(incoming.keywords ?? [])]),
      referencedNorms: uniqueNormReferences([
        ...(existing.referencedNorms ?? []),
        ...(incoming.referencedNorms ?? []),
      ]),
      referencedDecisions: uniqueStrings([
        ...(existing.referencedDecisions ?? []),
        ...(incoming.referencedDecisions ?? []),
      ]),
      citedByDecisions: uniqueStrings([
        ...(existing.citedByDecisions ?? []),
        ...(incoming.citedByDecisions ?? []),
      ]),
      importedAt: existing.importedAt ?? incoming.importedAt,
      updatedAt: new Date().toISOString(),
      verifiedAt: incoming.verifiedAt ?? existing.verifiedAt,
      verifiedBy: incoming.verifiedBy ?? existing.verifiedBy,
    };
  }

  private localSearch(
    query: string,
    limit: number,
    options: Required<JudikaturSearchOptions>
  ): CourtDecision[] {
    const tokens = tokenize(query);
    const jurisdictionBonusMap = buildJurisdictionBonusMap(options, query);
    const fromStore = (this.orchestration.courtDecisions$.value ?? []) as CourtDecision[];

    const candidates = [...fromStore, ...SEED_DECISIONS];
    const scored = candidates
      .map(decision => ({
        decision,
        score:
          scoreDecision(tokens, decision) +
          (jurisdictionBonusMap.get(decision.jurisdiction) ?? 0),
      }))
      .filter(item => item.score > 0);

    const byId = new Map<string, { decision: CourtDecision; score: number }>();
    for (const item of scored) {
      const existing = byId.get(item.decision.id);
      if (!existing || item.score > existing.score) {
        byId.set(item.decision.id, item);
      }
    }

    return [...byId.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.decision);
  }

  private async remoteSearch(
    query: string,
    options: Required<JudikaturSearchOptions>
  ): Promise<CourtDecision[] | null> {
    const endpoint = await this.providerSettingsService.getEndpoint('judikatur');
    if (!endpoint) {
      return null;
    }

    try {
      const token = await this.providerSettingsService.getToken('judikatur');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query,
          limit: 14,
          jurisdictions: options.preferredJurisdictions,
          includeInternationalOverlay: options.includeInternationalOverlay,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { decisions?: RemoteDecisionPayload[] };
      const decisions = payload.decisions ?? [];
      const now = new Date().toISOString();

      return decisions
        .filter(item => !!item.fileNumber && !!item.title)
        .map(item => ({
          id: item.id ?? createId('court-decision'),
          jurisdiction: item.jurisdiction ?? 'DE',
          court: item.court ?? 'BGH',
          precedentialWeight: inferPrecedentialWeight({
            jurisdiction: item.jurisdiction ?? 'DE',
            court: item.court ?? 'BGH',
          }),
          fileNumber: item.fileNumber as string,
          decisionDate: item.decisionDate ?? now,
          appliesFrom: item.decisionDate ?? now,
          decisionType: 'urteil',
          title: item.title as string,
          headnotes: [],
          summary: item.summary ?? 'Externe Judikatur-Recherche ohne Summary.',
          legalAreas: item.legalAreas ?? ['zivilrecht'],
          keywords: item.keywords ?? [],
          referencedNorms: [],
          referencedDecisions: [],
          citedByDecisions: [],
          sourceUrl: item.sourceUrl,
          sourceDatabase: 'manual',
          isLeadingCase: false,
          isOverruled: false,
          importedAt: now,
          updatedAt: now,
          verifiedAt: item.sourceUrl ? now : undefined,
          verifiedBy: item.sourceUrl ? 'remote-judikatur' : undefined,
        }));
    } catch {
      return null;
    }
  }

  private async fetchRisCandidatesForAustria(query: string, limit: number) {
    const businessNumbers = extractAustrianBusinessNumbers(query);
    const out: CourtDecision[] = [];
    const existingDecisions = (this.orchestration.courtDecisions$.value ?? []) as CourtDecision[];
    const latestKnownRisAtDate = existingDecisions
      .filter(item => item.jurisdiction === 'AT' && item.sourceDatabase === 'ris')
      .map(item => item.decisionDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    const fromDate = latestKnownRisAtDate
      ? (toRisDateParam(latestKnownRisAtDate) ?? undefined)
      : undefined;

    for (const businessNumber of businessNumbers.slice(0, 5)) {
      try {
        const match = await this.risCrawlerService.fetchDecisionByBusinessNumber(businessNumber);
        if (match) {
          out.push(match);
        }
      } catch {
        // Ignore single RIS lookup failures; continue with remaining candidates.
      }
    }

    try {
      const recent = await this.risCrawlerService.fetchRecentDecisions({
        fromDate,
        maxResults: Math.max(6, Math.min(20, limit * 2)),
      });
      out.push(...recent);
    } catch {
      // Ignore RIS crawl failures to keep pipeline robust.
    }

    return dedupeDecisions(out);
  }

  async search(query: string, limit = 6, options: JudikaturSearchOptions = {}) {
    const q = query.trim();
    if (!q) {
      return [] as CourtDecision[];
    }

    const normalizedOptions = normalizeSearchOptions(options);
    const shouldEnrichWithRis = normalizedOptions.preferredJurisdictions.includes('AT');

    const [remote, risCandidates] = await Promise.all([
      this.remoteSearch(q, normalizedOptions),
      shouldEnrichWithRis
        ? this.fetchRisCandidatesForAustria(q, limit)
        : Promise.resolve([] as CourtDecision[]),
    ]);

    const local = this.localSearch(q, Math.max(limit * 4, 24), normalizedOptions);
    return this.rankAndLimit(
      q,
      [...risCandidates, ...(remote ?? []), ...local],
      limit,
      normalizedOptions
    );
  }

  async suggestForFindings(input: {
    caseId: string;
    workspaceId: string;
    findings: LegalFinding[];
    preferredJurisdictions?: Jurisdiction[];
    includeInternationalOverlay?: boolean;
  }) {
    const text = input.findings
      .map(item => `${item.title} ${item.description}`)
      .join(' ')
      .slice(0, 4000);

    const normalizedOptions = normalizeSearchOptions({
      preferredJurisdictions: input.preferredJurisdictions,
      includeInternationalOverlay: input.includeInternationalOverlay,
    });
    const decisions = await this.search(text, 12, normalizedOptions);
    const now = new Date().toISOString();
    const suggestions: JudikaturSuggestion[] = [];
    const primaryJurisdiction = resolvePrimaryJurisdiction(
      normalizedOptions.preferredJurisdictions
    );
    const existingDecisions = (this.orchestration.courtDecisions$.value ?? []) as CourtDecision[];
    const queryTokens = tokenize(text);
    const proceedingSignals = detectProceedingSignals(text);
    const jurisdictionBonusMap = buildJurisdictionBonusMap(normalizedOptions, text);

    for (const decision of decisions) {
      const existing = existingDecisions.find(
        item =>
          item.id === decision.id ||
          (item.fileNumber === decision.fileNumber && item.court === decision.court)
      );
      const merged = this.mergeDecisionRecord(existing, {
        ...decision,
        verifiedAt: decision.sourceUrl ? now : decision.verifiedAt,
        verifiedBy: decision.sourceUrl ? 'judikatur-research' : decision.verifiedBy,
      });

      await this.orchestration.upsertCourtDecision(merged);
      await this.upsertNormRegistryFromDecision(merged, normalizedOptions.preferredJurisdictions);

      const matchedKeywords = merged.keywords.filter((keyword: string) =>
        text.toLowerCase().includes(keyword.toLowerCase())
      );
      const lexicalScore = scoreDecision(queryTokens, merged);
      const jurisdictionBoost = jurisdictionBonusMap.get(merged.jurisdiction) ?? 0;
      const relevanceScore = Math.min(0.99, (lexicalScore + jurisdictionBoost) / 6.5);
      const isCrossBorder = merged.jurisdiction !== primaryJurisdiction;
      const authorityLevel = classifyAuthorityLevel({
        decisionJurisdiction: merged.jurisdiction,
        primaryJurisdiction,
        relevanceScore,
        precedentialWeight: merged.precedentialWeight,
      });
      const temporal = evaluateTemporalApplicability(merged);

      const suggestion: JudikaturSuggestion = {
        id: createId('judikatur-suggestion'),
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        decisionId: merged.id,
        decisionDate: merged.decisionDate,
        decisionJurisdiction: merged.jurisdiction,
        primaryJurisdiction,
        isCrossBorder,
        authorityLevel,
        temporalApplicability: temporal.temporalApplicability,
        temporalReason: temporal.temporalReason,
        sourceVerified: Boolean(merged.verifiedAt || merged.sourceUrl),
        relevanceScore,
        matchReason: buildExplainableMatchReason({
          decision: merged,
          matchedKeywords,
          lexicalScore,
          jurisdictionBonus: jurisdictionBoost,
          proceedingSignals,
          primaryJurisdiction,
          authorityLevel,
          isCrossBorder,
        }),
        matchedKeywords,
        matchedNorms: merged.referencedNorms.map(
          (norm): string => `${norm.law} ${norm.paragraph}`
        ),
        suggestedUsage:
          authorityLevel === 'binding' || authorityLevel === 'persuasive'
            ? relevanceScore >= 0.68
              ? 'support'
              : 'reference'
            : 'reference',
        citationMarkdown: `${merged.court}, ${merged.fileNumber}, ${new Date(
          merged.decisionDate
        ).toLocaleDateString('de-DE')} — ${merged.title}`,
        createdAt: now,
      };
      await this.orchestration.upsertJudikaturSuggestion(suggestion);
      suggestions.push(suggestion);
    }

    if (suggestions.length > 0) {
      const chain: CitationChain = {
        id: createId('citation-chain'),
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        title: 'Judikatur-Recherchekette',
        entries: suggestions.map((suggestion, index) => {
          const decision = decisions.find((item: CourtDecision) => item.id === suggestion.decisionId);
          return {
            order: index + 1,
            type: 'decision' as const,
            decisionId: suggestion.decisionId,
            decisionFileNumber: decision?.fileNumber,
            decisionCourt: decision?.court,
            decisionDate: decision?.decisionDate,
            headnote: decision?.headnotes[0],
            annotation: suggestion.matchReason,
            citationFormatted: suggestion.citationMarkdown,
          };
        }),
        generatedAt: now,
        updatedAt: now,
      };
      await this.orchestration.upsertCitationChain(chain);

      const comparativeChain = this.buildComparativeCitationChain({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        suggestions,
        decisionPool: dedupeDecisions([...existingDecisions, ...decisions]),
        preferredJurisdictions: normalizedOptions.preferredJurisdictions,
      });
      if (comparativeChain) {
        await this.orchestration.upsertCitationChain(comparativeChain);
      }
    }

    return suggestions;
  }
}
