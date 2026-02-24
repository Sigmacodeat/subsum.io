import { Service } from '@toeverything/infra';

import type { Gerichtstermin, LegalDocumentRecord } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

type TerminMatch = {
  datum: string;
  uhrzeit?: string;
  terminart: Gerichtstermin['terminart'];
  kategorie: NonNullable<Gerichtstermin['kategorie']>;
  gericht: string;
  evidenceSnippets: string[];
  confidence: number;
};

const MAX_AUTO_TERMINE_PER_DOC = 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))];
}

function parseIsoDateOnly(raw: string): string | null {
  const numeric = raw.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (numeric) {
    const dd = numeric[1].padStart(2, '0');
    const mm = numeric[2].padStart(2, '0');
    const yyyy = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    return `${yyyy}-${mm}-${dd}T09:00:00.000Z`;
  }

  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}T09:00:00.000Z`;
  }

  const slash = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    const dd = slash[1].padStart(2, '0');
    const mm = slash[2].padStart(2, '0');
    const yyyy = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${yyyy}-${mm}-${dd}T09:00:00.000Z`;
  }

  return null;
}

function parseTime(raw: string): string | null {
  const m = raw.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function lineEvidence(text: string, patterns: RegExp[]): string[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 240);

  const snippets: string[] = [];
  for (const line of lines) {
    if (patterns.some(p => p.test(line))) {
      snippets.push(line.slice(0, 240));
      if (snippets.length >= 3) break;
    }
  }
  return snippets;
}

function inferTerminart(line: string): Gerichtstermin['terminart'] {
  const lower = line.toLowerCase();
  if (/(mündliche\s+verhandlung|muendliche\s+verhandlung|verhandlungstermin)/i.test(lower)) {
    return 'muendliche_verhandlung';
  }
  if (/(vergleich|güteverhandlung|gueteverhandlung)/i.test(lower)) {
    return 'vergleichstermin';
  }
  if (/(beweisaufnahme|zeug(e|en)|sachverständig|sachverstaendig)/i.test(lower)) {
    return 'beweisaufnahme';
  }
  if (/(gutachten|begutachtung)/i.test(lower)) {
    return 'gutachtentermin';
  }
  if (/(urteilsverk(ü|u)ndung)/i.test(lower)) {
    return 'urteilsverkündung';
  }
  return 'sonstiger';
}

function inferKategorie(line: string): NonNullable<Gerichtstermin['kategorie']> {
  const lower = line.toLowerCase();
  if (
    /(gericht|amtsgericht|landesgericht|oberlandesgericht|bezirksgericht|verwaltungsgericht|verfassungsgerichtshof|bundesgerichtshof)/i.test(
      lower
    )
  ) {
    return 'gerichtstermin';
  }
  if (/(besprechung|meeting|call|telefonat|telefontermin|mandant|zoom|teams)/i.test(lower)) {
    return 'gespraech';
  }
  return 'sonstiger';
}

function inferGericht(line: string): string {
  const match = line.match(
    /\b(?:Amtsgericht|Landesgericht|Oberlandesgericht|Bezirksgericht|Verwaltungsgericht|Verfassungsgerichtshof|Bundesgerichtshof)\s+[A-ZÄÖÜ][\p{L}-]+\b/iu
  );
  if (match?.[0]) return match[0];
  if (/\bgericht\b/i.test(line)) return 'Gericht (nicht spezifiziert)';
  return '—';
}

function computeConfidence(input: { hasTime: boolean; isCourt: boolean; hasTerminKeyword: boolean }) {
  let confidence = 0.52;
  if (input.hasTerminKeyword) confidence += 0.18;
  if (input.hasTime) confidence += 0.16;
  if (input.isCourt) confidence += 0.1;
  return clamp(confidence, 0.35, 0.95);
}

export class TerminAutomationService extends Service {
  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  deriveTermineFromDocuments(input: {
    caseId: string;
    workspaceId: string;
    matterId: string;
    docs: LegalDocumentRecord[];
  }): Gerichtstermin[] {
    const now = new Date().toISOString();
    const output: Gerichtstermin[] = [];

    const triggerPatterns: RegExp[] = [
      /\btermin\b/gi,
      /\bmündliche\s+verhandlung\b/gi,
      /\bmuendliche\s+verhandlung\b/gi,
      /\bverhandlungstermin\b/gi,
      /\bgüteverhandlung\b/gi,
      /\bgueteverhandlung\b/gi,
      /\bbeweisaufnahme\b/gi,
      /\bvergleich\b/gi,
      /\bbesprechung\b/gi,
      /\btelefontermin\b/gi,
      /\bmeeting\b/gi,
      /\bzoom\b/gi,
      /\bteams\b/gi,
    ];

    for (const doc of input.docs) {
      const text = (doc.normalizedText ?? doc.rawText).slice(0, 35_000);
      if (!text.trim()) continue;

      const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .slice(0, 320);

      const candidates: TerminMatch[] = [];

      for (const line of lines) {
        const hasTrigger = triggerPatterns.some(p => p.test(line));
        if (!hasTrigger) continue;

        const iso = parseIsoDateOnly(line);
        if (!iso) continue;

        const time = parseTime(line) ?? undefined;
        const kategorie = inferKategorie(line);
        const terminart = inferTerminart(line);
        const gericht = kategorie === 'gerichtstermin' ? inferGericht(line) : '—';
        const confidence = computeConfidence({
          hasTime: Boolean(time),
          isCourt: kategorie === 'gerichtstermin',
          hasTerminKeyword: /\btermin\b/i.test(line),
        });

        const evidenceSnippets = uniq([
          ...lineEvidence(text, triggerPatterns),
          line.slice(0, 240),
        ]).slice(0, 3);

        candidates.push({
          datum: iso,
          uhrzeit: time,
          terminart,
          kategorie,
          gericht,
          evidenceSnippets,
          confidence,
        });

        if (candidates.length >= MAX_AUTO_TERMINE_PER_DOC) break;
      }

      for (const match of candidates) {
        const day = match.datum.slice(0, 10);
        const timeKey = match.uhrzeit ? match.uhrzeit.replace(':', '') : 'allday';
        const id = `termin:auto:${input.caseId}:${doc.id}:${day}:${timeKey}:${match.kategorie}:${match.terminart}`;

        output.push({
          id,
          workspaceId: input.workspaceId,
          matterId: input.matterId,
          caseId: input.caseId,
          derivedFrom: 'document_extraction',
          sourceDocIds: [doc.id],
          detectionConfidence: match.confidence,
          requiresReview: match.confidence < 0.78,
          evidenceSnippets: match.evidenceSnippets,
          kategorie: match.kategorie,
          terminart: match.terminart,
          datum: match.datum,
          uhrzeit: match.uhrzeit,
          dauerMinuten: match.kategorie === 'gerichtstermin' ? 60 : 30,
          gericht: match.gericht,
          teilnehmer: [],
          status: 'geplant',
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const dedup = new Map<string, Gerichtstermin>();
    for (const item of output) dedup.set(item.id, item);
    return [...dedup.values()];
  }

  async upsertAutoTermine(input: { caseId: string; workspaceId: string; termine: Gerichtstermin[] }) {
    for (const termin of input.termine) {
      await this.orchestration.upsertGerichtstermin(termin);
    }
    return input.termine.length;
  }
}
