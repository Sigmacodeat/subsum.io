import { Service } from '@toeverything/infra';

import type { LegalDocumentRecord, LegalFinding } from '../types';
import type { LegalNorm, NormMatchResult } from './legal-norms';
import type { LegalNormsService } from './legal-norms';

/**
 * Document Norm Extractor & Verifier
 *
 * Scans document content for legal norm references (§ / Art.),
 * resolves them against the LegalNormsService database,
 * verifies correctness, and produces structured findings.
 *
 * Capabilities:
 * - Extract all § / Art. references from document text
 * - Match against known norm database (BGB, ZPO, StGB, VwGO, GG, etc.)
 * - Verify: Does the cited norm exist? Is the context plausible?
 * - Detect missing norm references (keywords present but no § cited)
 * - Generate LegalFindings for unverified/unknown norms
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ExtractedNormReference {
  /** Raw text as found in the document, e.g. "§ 280 Abs. 1 BGB" */
  rawText: string;
  /** Normalized paragraph, e.g. "§ 280 Abs. 1" */
  paragraph: string;
  /** Law abbreviation, e.g. "BGB" */
  law: string;
  /** Full normalized key, e.g. "§ 280 Abs. 1 BGB" */
  normalizedKey: string;
  /** Context excerpt around the reference */
  context: string;
  /** Offset in the source text */
  offset: number;
  /** Source document ID */
  documentId: string;
  /** Source document title */
  documentTitle: string;
}

export type NormVerificationStatus =
  | 'verified'      // Norm found in DB and context plausible
  | 'found'         // Norm found in DB but context unclear
  | 'unknown'       // Norm not in DB — could be valid but unverifiable
  | 'suspicious';   // Norm cited but context contradicts typical usage

export interface NormVerificationResult {
  reference: ExtractedNormReference;
  status: NormVerificationStatus;
  matchedNorm: LegalNorm | null;
  matchScore: number;
  contextPlausibility: number;
  notes: string;
}

export interface DocumentNormAnalysis {
  documentId: string;
  documentTitle: string;
  extractedReferences: ExtractedNormReference[];
  verifications: NormVerificationResult[];
  missingNormHints: MissingNormHint[];
  summary: {
    totalReferences: number;
    verified: number;
    found: number;
    unknown: number;
    suspicious: number;
    missingHints: number;
  };
}

export interface MissingNormHint {
  keyword: string;
  suggestedNorm: LegalNorm;
  matchScore: number;
  context: string;
  documentId: string;
}

export interface CaseNormAnalysis {
  caseId: string;
  workspaceId: string;
  documentAnalyses: DocumentNormAnalysis[];
  allUniqueNorms: string[];
  globalSummary: {
    totalDocuments: number;
    totalReferences: number;
    verified: number;
    unknown: number;
    suspicious: number;
    missingHints: number;
  };
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Regex Patterns
// ═══════════════════════════════════════════════════════════════════════════

const PARAGRAPH_PATTERN =
  /§§?\s*(\d{1,4}(?:\s*[a-z])?)(?:\s*(?:Abs\.\s*\d+|Absatz\s+\d+))?(?:\s*(?:S\.\s*\d+|Satz\s+\d+|Nr\.\s*\d+|Nummer\s+\d+|lit\.\s*[a-z]|Buchst\.\s*[a-z]))*\s+(BGB|StGB|ZPO|VwGO|GG|HGB|InsO|AO|SGB|GewO|BetrVG|KSchG|AGG|TzBfG|MuSchG|BDSG|UrhG|MarkenG|PatG|StPO|OWiG|BauGB|WEG|MietR|ABGB|MRG|UGB|StVO|VStG|AVG|ZPO-AT|StGB-AT|AktG|GmbHG|WpHG|EStG|KStG|UStG|ASVG|ASGG|IO)/gi;

const ARTICLE_PATTERN =
  /Art\.?\s*(\d{1,4}(?:\s*[a-z])?(?:\s*ZP\d+)?)\s*(?:Abs\.\s*\d+\s*)?(?:S\.\s*\d+\s*)?(GG|EMRK|EMRK-ZP1|EU[-‑]?GRCh|AEUV|EUV|GRC|B[-‑]?VG|StGG|EGMR)/gi;

const LAW_KEYWORDS: Record<string, string[]> = {
  BGB: ['vertrag', 'schadensersatz', 'pflichtverletzung', 'kündigung', 'mangel', 'gewährleistung', 'miete', 'kaufpreis', 'haftung', 'verzug', 'unmöglichkeit', 'rücktritt', 'anfechtung', 'verjährung', 'werkvertrag', 'dienstvertrag'],
  StGB: ['straftat', 'betrug', 'diebstahl', 'körperverletzung', 'nötigung', 'sachbeschädigung', 'urkundenfälschung', 'untreue', 'erpressung', 'unterschlagung'],
  ZPO: ['klage', 'berufung', 'beweis', 'beweisaufnahme', 'zustellung', 'vollstreckung', 'einstweilige verfügung', 'arrest', 'streitwert', 'mahnbescheid', 'vollstreckungsbescheid'],
  VwGO: ['verwaltungsakt', 'widerspruch', 'anfechtungsklage', 'ermessen', 'verhältnismäßigkeit', 'verpflichtungsklage', 'normenkontrolle'],
  GG: ['grundrecht', 'menschenwürde', 'gleichheit', 'meinungsfreiheit', 'berufsfreiheit', 'eigentum', 'versammlungsfreiheit', 'vereinigungsfreiheit'],
  KSchG: ['kündigungsschutz', 'sozialauswahl', 'abmahnung', 'betriebsbedingt', 'personenbedingt', 'verhaltensbedingt'],
  ABGB: ['schadenersatz', 'gewährleistung', 'vertragsschluss', 'irrtumsanfechtung', 'abgb', 'österreich', 'allgemeines bürgerliches gesetzbuch'],
  MRG: ['mietrecht', 'mietzins', 'befristung', 'kündigung', 'mrg', 'mietrechtsgesetz', 'hauptmiete', 'untermiete'],
  AVG: ['bescheid', 'verwaltungsverfahren', 'avg', 'allgemeines verwaltungsverfahrensgesetz', 'behörde'],
  'ZPO-AT': ['zivilprozess österreich', 'klage österreich', 'berufung österreich', 'rekurs', 'revision ogh'],
  'StGB-AT': ['strafrecht österreich', 'stgb österreich', 'betrug österreich', 'körperverletzung österreich'],
  EMRK: ['art 6 emrk', 'art 8 emrk', 'fair trial', 'faires verfahren', 'menschenrechtskonvention', 'egmr', 'europäischer gerichtshof für menschenrechte'],
  'EMRK-ZP1': ['eigentumsschutz', 'zp1', 'eigentumsrecht emrk'],
  HGB: ['handelsrecht', 'kaufmann', 'handelsgesellschaft', 'prokura', 'handelsregister'],
  InsO: ['insolvenz', 'insolvenzverwaltung', 'anfechtung insolvenz', 'gläubiger', 'insolvenzplan'],
  ASVG: ['sozialversicherung', 'asvg', 'krankenversicherung', 'unfallversicherung', 'pensionsversicherung'],
};

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function extractExcerpt(text: string, offset: number, radius = 120): string {
  const start = Math.max(0, offset - radius);
  const end = Math.min(text.length, offset + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

function normalizeParagraph(raw: string): string {
  return raw
    .replace(/§§\s*/, '§ ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildNormKey(paragraph: string, law: string): string {
  return `${paragraph} ${law}`.toUpperCase().replace(/\s+/g, ' ').trim();
}

function computeContextPlausibility(
  context: string,
  norm: LegalNorm
): number {
  const contextLower = context.toLowerCase();
  let hits = 0;
  for (const kw of norm.keywords) {
    if (contextLower.includes(kw.toLowerCase())) {
      hits++;
    }
  }
  if (norm.prerequisites.some(p => contextLower.includes(p.toLowerCase().slice(0, 20)))) {
    hits += 2;
  }
  return Math.min(1, hits / Math.max(norm.keywords.length, 1));
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

export class DocumentNormExtractorService extends Service {
  constructor(private readonly legalNormsService: LegalNormsService) {
    super();
  }

  /**
   * Extract all § / Art. references from a single document's text.
   */
  extractReferences(doc: LegalDocumentRecord): ExtractedNormReference[] {
    const text = doc.normalizedText ?? doc.rawText;
    if (!text || text.length < 10) return [];

    const refs: ExtractedNormReference[] = [];
    const seen = new Set<string>();

    // § references
    const paraRegex = new RegExp(PARAGRAPH_PATTERN.source, PARAGRAPH_PATTERN.flags);
    let match: RegExpExecArray | null;
    while ((match = paraRegex.exec(text)) !== null) {
      const rawText = match[0].trim();
      const paragraphNum = match[1].trim();
      const law = match[2].toUpperCase();
      const paragraph = normalizeParagraph(`§ ${paragraphNum}`);
      const normalizedKey = buildNormKey(paragraph, law);

      if (seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);

      refs.push({
        rawText,
        paragraph,
        law,
        normalizedKey,
        context: extractExcerpt(text, match.index, 150),
        offset: match.index,
        documentId: doc.id,
        documentTitle: doc.title,
      });
    }

    // Art. references
    const artRegex = new RegExp(ARTICLE_PATTERN.source, ARTICLE_PATTERN.flags);
    while ((match = artRegex.exec(text)) !== null) {
      const rawText = match[0].trim();
      const articleNum = match[1].trim();
      const law = match[2].toUpperCase();
      const paragraph = `Art. ${articleNum}`;
      const normalizedKey = buildNormKey(paragraph, law);

      if (seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);

      refs.push({
        rawText,
        paragraph,
        law,
        normalizedKey,
        context: extractExcerpt(text, match.index, 150),
        offset: match.index,
        documentId: doc.id,
        documentTitle: doc.title,
      });
    }

    return refs;
  }

  /**
   * Verify a single extracted norm reference against the database.
   */
  verifyReference(ref: ExtractedNormReference): NormVerificationResult {
    const normResults: NormMatchResult[] = this.legalNormsService.searchNorms(
      `${ref.paragraph} ${ref.law}`,
      5
    );

    const exactMatch = normResults.find(r => {
      const normPara = r.norm.paragraph.toUpperCase().replace(/\s+/g, ' ');
      const refPara = ref.paragraph.toUpperCase().replace(/\s+/g, ' ');
      return (
        r.norm.law.toUpperCase() === ref.law.toUpperCase() &&
        (normPara.includes(refPara) || refPara.includes(normPara))
      );
    });

    if (!exactMatch) {
      const fuzzyMatch = normResults[0];
      if (fuzzyMatch && fuzzyMatch.matchScore > 0.5) {
        const plausibility = computeContextPlausibility(ref.context, fuzzyMatch.norm);
        return {
          reference: ref,
          status: 'found',
          matchedNorm: fuzzyMatch.norm,
          matchScore: fuzzyMatch.matchScore,
          contextPlausibility: plausibility,
          notes: `Ähnliche Norm gefunden: ${fuzzyMatch.norm.law} ${fuzzyMatch.norm.paragraph} — ${fuzzyMatch.norm.title}. Bitte prüfen ob korrekt zitiert.`,
        };
      }

      return {
        reference: ref,
        status: 'unknown',
        matchedNorm: null,
        matchScore: 0,
        contextPlausibility: 0,
        notes: `Norm "${ref.normalizedKey}" nicht in der Datenbank. Möglicherweise ein spezialisiertes Gesetz oder veraltete Fassung.`,
      };
    }

    const plausibility = computeContextPlausibility(ref.context, exactMatch.norm);

    if (plausibility < 0.1) {
      return {
        reference: ref,
        status: 'suspicious',
        matchedNorm: exactMatch.norm,
        matchScore: exactMatch.matchScore,
        contextPlausibility: plausibility,
        notes: `Norm "${ref.normalizedKey}" existiert, aber der Kontext passt nicht zu den typischen Voraussetzungen von ${exactMatch.norm.title}. Mögliche Fehlzitation.`,
      };
    }

    return {
      reference: ref,
      status: plausibility > 0.3 ? 'verified' : 'found',
      matchedNorm: exactMatch.norm,
      matchScore: exactMatch.matchScore,
      contextPlausibility: plausibility,
      notes: plausibility > 0.3
        ? `Verifiziert: ${exactMatch.norm.law} ${exactMatch.norm.paragraph} — ${exactMatch.norm.title}. Kontext plausibel.`
        : `Norm gefunden: ${exactMatch.norm.title}. Kontext-Plausibilität niedrig — manuelle Prüfung empfohlen.`,
    };
  }

  /**
   * Detect keywords suggesting a norm should be cited but isn't.
   */
  detectMissingNorms(doc: LegalDocumentRecord, alreadyCited: Set<string>): MissingNormHint[] {
    const text = (doc.normalizedText ?? doc.rawText).toLowerCase();
    if (!text || text.length < 50) return [];

    const hints: MissingNormHint[] = [];

    for (const [law, keywords] of Object.entries(LAW_KEYWORDS)) {
      for (const kw of keywords) {
        if (!text.includes(kw)) continue;

        const normResults = this.legalNormsService.searchNorms(`${kw} ${law}`, 1);
        if (normResults.length === 0) continue;

        const suggested = normResults[0];
        const normKey = buildNormKey(suggested.norm.paragraph, suggested.norm.law);
        if (alreadyCited.has(normKey)) continue;

        const idx = text.indexOf(kw);
        hints.push({
          keyword: kw,
          suggestedNorm: suggested.norm,
          matchScore: suggested.matchScore,
          context: extractExcerpt(doc.normalizedText ?? doc.rawText, idx, 100),
          documentId: doc.id,
        });
      }
    }

    // Dedupe by suggested norm ID
    const seen = new Set<string>();
    return hints.filter(h => {
      if (seen.has(h.suggestedNorm.id)) return false;
      seen.add(h.suggestedNorm.id);
      return true;
    }).slice(0, 10);
  }

  /**
   * Full analysis of a single document: extract → verify → detect missing.
   */
  analyzeDocument(doc: LegalDocumentRecord): DocumentNormAnalysis {
    const refs = this.extractReferences(doc);
    const verifications = refs.map(r => this.verifyReference(r));
    const citedKeys = new Set(refs.map(r => r.normalizedKey));
    const missingHints = this.detectMissingNorms(doc, citedKeys);

    const summary = {
      totalReferences: refs.length,
      verified: verifications.filter(v => v.status === 'verified').length,
      found: verifications.filter(v => v.status === 'found').length,
      unknown: verifications.filter(v => v.status === 'unknown').length,
      suspicious: verifications.filter(v => v.status === 'suspicious').length,
      missingHints: missingHints.length,
    };

    return {
      documentId: doc.id,
      documentTitle: doc.title,
      extractedReferences: refs,
      verifications,
      missingNormHints: missingHints,
      summary,
    };
  }

  /**
   * Full case-wide analysis across all indexed documents.
   */
  analyzeCase(input: {
    caseId: string;
    workspaceId: string;
    documents: LegalDocumentRecord[];
  }): CaseNormAnalysis {
    const analyses = input.documents
      .filter(d => (d.normalizedText ?? d.rawText).trim().length > 20)
      .map(d => this.analyzeDocument(d));

    const allNorms = new Set<string>();
    let totalRefs = 0;
    let verified = 0;
    let unknown = 0;
    let suspicious = 0;
    let missingHints = 0;

    for (const a of analyses) {
      totalRefs += a.summary.totalReferences;
      verified += a.summary.verified;
      unknown += a.summary.unknown;
      suspicious += a.summary.suspicious;
      missingHints += a.summary.missingHints;
      for (const ref of a.extractedReferences) {
        allNorms.add(ref.normalizedKey);
      }
    }

    return {
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      documentAnalyses: analyses,
      allUniqueNorms: [...allNorms].sort(),
      globalSummary: {
        totalDocuments: analyses.length,
        totalReferences: totalRefs,
        verified,
        unknown,
        suspicious,
        missingHints,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Convert norm analysis results to LegalFindings for persistence.
   */
  toFindings(analysis: CaseNormAnalysis): LegalFinding[] {
    const now = new Date().toISOString();
    const findings: LegalFinding[] = [];

    for (const docAnalysis of analysis.documentAnalyses) {
      // Suspicious norms → critical findings
      for (const v of docAnalysis.verifications.filter(x => x.status === 'suspicious')) {
        findings.push({
          id: `norm-suspicious:${v.reference.documentId}:${v.reference.normalizedKey}:${Date.now().toString(36)}`,
          caseId: analysis.caseId,
          workspaceId: analysis.workspaceId,
          type: 'norm_error',
          title: `Verdächtige Norm-Zitation: ${v.reference.normalizedKey}`,
          description: v.notes,
          severity: 'high',
          confidence: 0.75,
          sourceDocumentIds: [v.reference.documentId],
          citations: [{
            documentId: v.reference.documentId,
            quote: v.reference.context.slice(0, 220),
          }],
          createdAt: now,
          updatedAt: now,
        });
      }

      // Unknown norms → medium findings
      for (const v of docAnalysis.verifications.filter(x => x.status === 'unknown')) {
        findings.push({
          id: `norm-unknown:${v.reference.documentId}:${v.reference.normalizedKey}:${Date.now().toString(36)}`,
          caseId: analysis.caseId,
          workspaceId: analysis.workspaceId,
          type: 'norm_warning',
          title: `Unbekannte Norm: ${v.reference.normalizedKey}`,
          description: v.notes,
          severity: 'medium',
          confidence: 0.6,
          sourceDocumentIds: [v.reference.documentId],
          citations: [{
            documentId: v.reference.documentId,
            quote: v.reference.context.slice(0, 220),
          }],
          createdAt: now,
          updatedAt: now,
        });
      }

      // Missing norm hints → low findings
      for (const hint of docAnalysis.missingNormHints.slice(0, 5)) {
        findings.push({
          id: `norm-missing:${hint.documentId}:${hint.suggestedNorm.id}:${Date.now().toString(36)}`,
          caseId: analysis.caseId,
          workspaceId: analysis.workspaceId,
          type: 'norm_suggestion',
          title: `Fehlende Norm-Referenz: ${hint.suggestedNorm.law} ${hint.suggestedNorm.paragraph}`,
          description: `Keyword "${hint.keyword}" gefunden, aber ${hint.suggestedNorm.paragraph} ${hint.suggestedNorm.law} (${hint.suggestedNorm.title}) nicht zitiert. Prüfung empfohlen.`,
          severity: 'low',
          confidence: hint.matchScore,
          sourceDocumentIds: [hint.documentId],
          citations: [{
            documentId: hint.documentId,
            quote: hint.context.slice(0, 220),
          }],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return findings;
  }
}
