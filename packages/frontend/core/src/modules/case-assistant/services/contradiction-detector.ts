import { Service } from '@toeverything/infra';

import type {
  CasePriority,
  LegalDocumentRecord,
  LegalFinding,
} from '../types';

/**
 * Cross-Document Contradiction Detector
 *
 * Performs pairwise comparison of documents within a case to find:
 * - Widersprüchliche Datumsangaben
 * - Widersprüchliche Beträge/Zahlen
 * - Widersprüchliche Sachverhaltsdarstellungen
 * - Inkonsistente Personenangaben
 * - Zeitliche Inkonsistenzen in der Ereigniskette
 */

export type ContradictionCategory =
  | 'date_mismatch'
  | 'amount_mismatch'
  | 'fact_inconsistency'
  | 'person_mismatch'
  | 'timeline_gap'
  | 'legal_position_conflict';

export interface ContradictionPair {
  id: string;
  category: ContradictionCategory;
  documentA: { id: string; title: string; excerpt: string };
  documentB: { id: string; title: string; excerpt: string };
  description: string;
  severity: CasePriority;
  confidence: number;
  detectedAt: string;
}

export interface ContradictionMatrix {
  caseId: string;
  workspaceId: string;
  totalDocuments: number;
  totalComparisons: number;
  contradictions: ContradictionPair[];
  summaryByCategory: Record<ContradictionCategory, number>;
  generatedAt: string;
}

type ExtractedDate = {
  raw: string;
  normalized: string;
  context: string;
  docId: string;
  docTitle: string;
};

type ExtractedAmount = {
  raw: string;
  value: number;
  context: string;
  docId: string;
  docTitle: string;
};

type ExtractedPerson = {
  name: string;
  role: string;
  context: string;
  docId: string;
  docTitle: string;
};

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function extractExcerpt(text: string, keyword: string, radius = 120): string {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + keyword.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

const DATE_PATTERNS = [
  /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/g,
  /(\d{1,2})\.\s?(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi,
  /(\d{4})-(\d{2})-(\d{2})/g,
];

const MONTH_MAP: Record<string, string> = {
  januar: '01', februar: '02', märz: '03', april: '04',
  mai: '05', juni: '06', juli: '07', august: '08',
  september: '09', oktober: '10', november: '11', dezember: '12',
};

function normalizeDate(raw: string): string {
  const numericMatch = raw.match(/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/);
  if (numericMatch) {
    const d = numericMatch[1].padStart(2, '0');
    const m = numericMatch[2].padStart(2, '0');
    return `${numericMatch[3]}-${m}-${d}`;
  }

  const textMatch = raw.match(/(\d{1,2})\.\s?(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i);
  if (textMatch) {
    const d = textMatch[1].padStart(2, '0');
    const m = MONTH_MAP[textMatch[2].toLowerCase()] ?? '01';
    return `${textMatch[3]}-${m}-${d}`;
  }

  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return raw;
}

function extractDates(text: string, docId: string, docTitle: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const seen = new Set<string>();

  for (const pattern of DATE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      const normalized = normalizeDate(raw);
      const key = `${normalized}:${docId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        raw,
        normalized,
        context: extractExcerpt(text, raw, 80),
        docId,
        docTitle,
      });
    }
  }

  return results;
}

const AMOUNT_PATTERN = /(\d[\d.,]*)\s*(?:€|EUR|Euro|euro)/gi;

function parseAmount(raw: string): number {
  const cleaned = raw
    .replace(/€|EUR|Euro|euro/gi, '')
    .trim()
    .replace(/\./g, '')
    .replace(/,/g, '.');
  return parseFloat(cleaned);
}

function extractAmounts(text: string, docId: string, docTitle: string): ExtractedAmount[] {
  const results: ExtractedAmount[] = [];
  const regex = new RegExp(AMOUNT_PATTERN.source, AMOUNT_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const value = parseAmount(raw);
    if (isNaN(value) || value === 0) continue;

    results.push({
      raw,
      value,
      context: extractExcerpt(text, raw, 80),
      docId,
      docTitle,
    });
  }

  return results;
}

const PERSON_PATTERNS = [
  /(?:Herr|Frau|Dr\.|Prof\.)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){0,2})/g,
  /(?:Kläger(?:in)?|Beklagte[r]?|Mandant(?:in)?|Zeuge|Zeugin|Sachverständige[r]?)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/g,
];

const ROLE_PATTERNS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /kläger(?:in)?/i, role: 'Kläger' },
  { pattern: /beklagte[r]?/i, role: 'Beklagter' },
  { pattern: /mandant(?:in)?/i, role: 'Mandant' },
  { pattern: /zeug(?:e|in)/i, role: 'Zeuge' },
  { pattern: /sachverständige[r]?/i, role: 'Sachverständiger' },
  { pattern: /richter(?:in)?/i, role: 'Richter' },
  { pattern: /vermieter(?:in)?/i, role: 'Vermieter' },
  { pattern: /mieter(?:in)?/i, role: 'Mieter' },
  { pattern: /arbeitgeber(?:in)?/i, role: 'Arbeitgeber' },
  { pattern: /arbeitnehmer(?:in)?/i, role: 'Arbeitnehmer' },
];

function detectRole(context: string): string {
  for (const { pattern, role } of ROLE_PATTERNS) {
    if (pattern.test(context)) return role;
  }
  return 'unbekannt';
}

function extractPersons(text: string, docId: string, docTitle: string): ExtractedPerson[] {
  const results: ExtractedPerson[] = [];
  const seen = new Set<string>();

  for (const pattern of PERSON_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const name = (match[1] ?? match[0]).trim();
      if (name.length < 3 || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const context = extractExcerpt(text, name, 60);
      results.push({
        name,
        role: detectRole(context),
        context,
        docId,
        docTitle,
      });
    }
  }

  return results;
}

function dateContextOverlaps(ctxA: string, ctxB: string): boolean {
  const keywords = [
    'zustellung', 'kündigung', 'frist', 'termin', 'datum',
    'unterzeichn', 'abschluss', 'bescheid', 'zahlung', 'eingang',
    'vertragsschluss', 'unfall', 'vorfall', 'annahme',
  ];
  const ctxALower = ctxA.toLowerCase();
  const ctxBLower = ctxB.toLowerCase();
  return keywords.some(kw => ctxALower.includes(kw) && ctxBLower.includes(kw));
}

function amountContextOverlaps(ctxA: string, ctxB: string): boolean {
  const keywords = [
    'miete', 'gehalt', 'schadensersatz', 'kaufpreis', 'betrag',
    'forderung', 'zahlung', 'kosten', 'vergütung', 'provision',
    'darlehen', 'kredit', 'streitwert', 'gebühr',
  ];
  const ctxALower = ctxA.toLowerCase();
  const ctxBLower = ctxB.toLowerCase();
  return keywords.some(kw => ctxALower.includes(kw) && ctxBLower.includes(kw));
}

export class ContradictionDetectorService extends Service {
  analyzeDocuments(input: {
    caseId: string;
    workspaceId: string;
    documents: LegalDocumentRecord[];
  }): ContradictionMatrix {
    const now = new Date().toISOString();
    const docs = input.documents.filter(d => (d.normalizedText ?? d.rawText).trim().length > 20);
    const contradictions: ContradictionPair[] = [];
    let comparisons = 0;

    const allDates = new Map<string, ExtractedDate[]>();
    const allAmounts = new Map<string, ExtractedAmount[]>();
    const allPersons = new Map<string, ExtractedPerson[]>();

    for (const doc of docs) {
      const text = doc.normalizedText ?? doc.rawText;
      allDates.set(doc.id, extractDates(text, doc.id, doc.title));
      allAmounts.set(doc.id, extractAmounts(text, doc.id, doc.title));
      allPersons.set(doc.id, extractPersons(text, doc.id, doc.title));
    }

    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        comparisons++;
        const docA = docs[i];
        const docB = docs[j];

        // 1. Date contradictions
        const datesA = allDates.get(docA.id) ?? [];
        const datesB = allDates.get(docB.id) ?? [];
        for (const dA of datesA) {
          for (const dB of datesB) {
            if (
              dA.normalized !== dB.normalized &&
              dateContextOverlaps(dA.context, dB.context)
            ) {
              contradictions.push({
                id: createId('contradiction'),
                category: 'date_mismatch',
                documentA: { id: docA.id, title: docA.title, excerpt: dA.context },
                documentB: { id: docB.id, title: docB.title, excerpt: dB.context },
                description: `Widersprüchliche Datumsangaben: "${dA.raw}" vs. "${dB.raw}" im selben Kontext.`,
                severity: 'high',
                confidence: 0.78,
                detectedAt: now,
              });
            }
          }
        }

        // 2. Amount contradictions
        const amountsA = allAmounts.get(docA.id) ?? [];
        const amountsB = allAmounts.get(docB.id) ?? [];
        for (const aA of amountsA) {
          for (const aB of amountsB) {
            const diff = Math.abs(aA.value - aB.value);
            const relativeDiff = diff / Math.max(aA.value, aB.value, 1);
            if (
              relativeDiff > 0.05 &&
              diff > 10 &&
              amountContextOverlaps(aA.context, aB.context)
            ) {
              contradictions.push({
                id: createId('contradiction'),
                category: 'amount_mismatch',
                documentA: { id: docA.id, title: docA.title, excerpt: aA.context },
                documentB: { id: docB.id, title: docB.title, excerpt: aB.context },
                description: `Widersprüchliche Beträge: ${aA.raw} vs. ${aB.raw} (Δ ${diff.toFixed(2)} €, ${(relativeDiff * 100).toFixed(1)}%).`,
                severity: relativeDiff > 0.2 ? 'critical' : 'high',
                confidence: 0.82,
                detectedAt: now,
              });
            }
          }
        }

        // 3. Person/role contradictions
        const personsA = allPersons.get(docA.id) ?? [];
        const personsB = allPersons.get(docB.id) ?? [];
        for (const pA of personsA) {
          for (const pB of personsB) {
            if (
              pA.name.toLowerCase() === pB.name.toLowerCase() &&
              pA.role !== 'unbekannt' &&
              pB.role !== 'unbekannt' &&
              pA.role !== pB.role
            ) {
              contradictions.push({
                id: createId('contradiction'),
                category: 'person_mismatch',
                documentA: { id: docA.id, title: docA.title, excerpt: pA.context },
                documentB: { id: docB.id, title: docB.title, excerpt: pB.context },
                description: `Person "${pA.name}" wird unterschiedlich referenziert: "${pA.role}" vs. "${pB.role}".`,
                severity: 'medium',
                confidence: 0.7,
                detectedAt: now,
              });
            }
          }
        }

        // 4. Fact inconsistency detection (keyword-based)
        const textA = (docA.normalizedText ?? docA.rawText).toLowerCase();
        const textB = (docB.normalizedText ?? docB.rawText).toLowerCase();

        const factPairs: Array<{ keywordA: string; keywordB: string; desc: string }> = [
          { keywordA: 'kündigung wurde zugestellt', keywordB: 'kündigung nicht zugegangen', desc: 'Zustellung der Kündigung' },
          { keywordA: 'zahlung erfolgte', keywordB: 'zahlung nicht geleistet', desc: 'Zahlungsstatus' },
          { keywordA: 'vertrag geschlossen', keywordB: 'kein vertrag zustande', desc: 'Vertragsschluss' },
          { keywordA: 'mangel angezeigt', keywordB: 'keine mängelanzeige', desc: 'Mängelanzeige' },
          { keywordA: 'frist eingehalten', keywordB: 'frist versäumt', desc: 'Fristeinhaltung' },
          { keywordA: 'einverständnis erteilt', keywordB: 'zustimmung verweigert', desc: 'Einverständnis' },
        ];

        for (const pair of factPairs) {
          const aHasFirst = textA.includes(pair.keywordA);
          const bHasSecond = textB.includes(pair.keywordB);
          const aHasSecond = textA.includes(pair.keywordB);
          const bHasFirst = textB.includes(pair.keywordA);

          if ((aHasFirst && bHasSecond) || (aHasSecond && bHasFirst)) {
            contradictions.push({
              id: createId('contradiction'),
              category: 'fact_inconsistency',
              documentA: {
                id: docA.id,
                title: docA.title,
                excerpt: extractExcerpt(
                  docA.normalizedText ?? docA.rawText,
                  aHasFirst ? pair.keywordA : pair.keywordB,
                  100
                ),
              },
              documentB: {
                id: docB.id,
                title: docB.title,
                excerpt: extractExcerpt(
                  docB.normalizedText ?? docB.rawText,
                  bHasSecond ? pair.keywordB : pair.keywordA,
                  100
                ),
              },
              description: `Widersprüchliche Sachverhaltsdarstellung bzgl. ${pair.desc}.`,
              severity: 'critical',
              confidence: 0.85,
              detectedAt: now,
            });
          }
        }

        // 5. Timeline gap detection
        // If both docs reference events with dates, check for implausible chronology
        const sortedDatesA = datesA
          .map(d => ({ ...d, ts: new Date(d.normalized).getTime() }))
          .filter(d => !isNaN(d.ts))
          .sort((a, b) => a.ts - b.ts);
        const sortedDatesB = datesB
          .map(d => ({ ...d, ts: new Date(d.normalized).getTime() }))
          .filter(d => !isNaN(d.ts))
          .sort((a, b) => a.ts - b.ts);

        if (sortedDatesA.length >= 2 && sortedDatesB.length >= 1) {
          // Check if doc B references a date between two dates in doc A
          // where doc A implies a continuous sequence (e.g., event A then event C,
          // but doc B says event B happened, contradicting the timeline)
          const earliestA = sortedDatesA[0];
          const latestA = sortedDatesA[sortedDatesA.length - 1];
          for (const dB of sortedDatesB) {
            // If doc B references an event BEFORE doc A's earliest event
            // but doc B's context suggests it happened AFTER
            const afterKeywords = ['danach', 'anschließend', 'daraufhin', 'in folge', 'nachdem'];
            const beforeKeywords = ['zuvor', 'vorher', 'bevor', 'vor dem'];
            const ctxBLower = dB.context.toLowerCase();

            if (dB.ts < earliestA.ts && afterKeywords.some(kw => ctxBLower.includes(kw))) {
              contradictions.push({
                id: createId('contradiction'),
                category: 'timeline_gap',
                documentA: { id: docA.id, title: docA.title, excerpt: earliestA.context },
                documentB: { id: docB.id, title: docB.title, excerpt: dB.context },
                description: `Zeitliche Inkonsistenz: Dok B referenziert "${dB.raw}" als nachfolgendes Ereignis, aber das Datum liegt VOR dem frühesten Datum in Dok A ("${earliestA.raw}").`,
                severity: 'high',
                confidence: 0.65,
                detectedAt: now,
              });
            }
            if (dB.ts > latestA.ts && beforeKeywords.some(kw => ctxBLower.includes(kw))) {
              contradictions.push({
                id: createId('contradiction'),
                category: 'timeline_gap',
                documentA: { id: docA.id, title: docA.title, excerpt: latestA.context },
                documentB: { id: docB.id, title: docB.title, excerpt: dB.context },
                description: `Zeitliche Inkonsistenz: Dok B referenziert "${dB.raw}" als vorheriges Ereignis, aber das Datum liegt NACH dem spätesten Datum in Dok A ("${latestA.raw}").`,
                severity: 'high',
                confidence: 0.65,
                detectedAt: now,
              });
            }
          }
        }

        // 6. Legal position conflict detection
        // Detect when documents take opposing legal positions on the same issue
        const legalPositionPairs: Array<{ posA: string; posB: string; issue: string }> = [
          { posA: 'anspruch besteht', posB: 'anspruch besteht nicht', issue: 'Anspruchsbestehen' },
          { posA: 'haftung liegt vor', posB: 'haftung wird bestritten', issue: 'Haftungsfrage' },
          { posA: 'verjährung eingetreten', posB: 'nicht verjährt', issue: 'Verjährungsstatus' },
          { posA: 'schuldig', posB: 'unschuldig', issue: 'Schuldfrage' },
          { posA: 'vertragswidrig', posB: 'vertragsgemäß', issue: 'Vertragskonformität' },
          { posA: 'rechtswidrig', posB: 'rechtmäßig', issue: 'Rechtmäßigkeit' },
          { posA: 'schadenersatzpflichtig', posB: 'kein schadenersatz', issue: 'Schadenersatzpflicht' },
          { posA: 'pflichtverletzung', posB: 'pflichtgemäß', issue: 'Pflichtverletzung' },
          { posA: 'kausalzusammenhang', posB: 'kein kausalzusammenhang', issue: 'Kausalität' },
          { posA: 'verschulden', posB: 'kein verschulden', issue: 'Verschulden' },
        ];

        for (const lp of legalPositionPairs) {
          const aHasPosA = textA.includes(lp.posA);
          const bHasPosB = textB.includes(lp.posB);
          const aHasPosB = textA.includes(lp.posB);
          const bHasPosA = textB.includes(lp.posA);

          if ((aHasPosA && bHasPosB) || (aHasPosB && bHasPosA)) {
            const keyInA = aHasPosA ? lp.posA : lp.posB;
            const keyInB = bHasPosB ? lp.posB : lp.posA;
            contradictions.push({
              id: createId('contradiction'),
              category: 'legal_position_conflict',
              documentA: {
                id: docA.id,
                title: docA.title,
                excerpt: extractExcerpt(docA.normalizedText ?? docA.rawText, keyInA, 100),
              },
              documentB: {
                id: docB.id,
                title: docB.title,
                excerpt: extractExcerpt(docB.normalizedText ?? docB.rawText, keyInB, 100),
              },
              description: `Widersprüchliche Rechtsposition bzgl. ${lp.issue}: "${keyInA}" vs. "${keyInB}".`,
              severity: 'critical',
              confidence: 0.8,
              detectedAt: now,
            });
          }
        }
      }
    }

    const summaryByCategory: Record<ContradictionCategory, number> = {
      date_mismatch: 0,
      amount_mismatch: 0,
      fact_inconsistency: 0,
      person_mismatch: 0,
      timeline_gap: 0,
      legal_position_conflict: 0,
    };

    for (const c of contradictions) {
      summaryByCategory[c.category]++;
    }

    return {
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      totalDocuments: docs.length,
      totalComparisons: comparisons,
      contradictions: contradictions.sort((a, b) => {
        const rank: Record<CasePriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return rank[b.severity] - rank[a.severity];
      }),
      summaryByCategory,
      generatedAt: now,
    };
  }

  contradictionsToFindings(matrix: ContradictionMatrix): LegalFinding[] {
    return matrix.contradictions.map(c => ({
      id: c.id,
      caseId: matrix.caseId,
      workspaceId: matrix.workspaceId,
      type: 'contradiction' as const,
      title: c.description.slice(0, 120),
      description: c.description,
      severity: c.severity,
      confidence: c.confidence,
      sourceDocumentIds: [c.documentA.id, c.documentB.id],
      citations: [
        { documentId: c.documentA.id, quote: c.documentA.excerpt },
        { documentId: c.documentB.id, quote: c.documentB.excerpt },
      ],
      createdAt: c.detectedAt,
      updatedAt: c.detectedAt,
    }));
  }
}
