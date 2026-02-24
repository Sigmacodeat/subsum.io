import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { LegalNormsService } from './legal-norms';
import type {
  CollectiveContextInjection,
  CollectiveContributionStatus,
  CollectiveKnowledgeCategory,
  CollectiveKnowledgeEntry,
  CollectiveMasterDashboard,
  CollectivePoolStats,
  CollectiveSharingConfig,
  CollectiveSharingLevel,
  LegalFinding,
  SemanticChunk,
  SharedCourtDecision,
} from '../types';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

const ANONYMIZATION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Persons: "Dr. Müller", "Mag. Schmidt", "RA Weber", "Prof. Dr. Meier"
  { pattern: /\b(?:(?:Prof\.|Dr\.|Mag\.|RA|StA|Ri)\s+)+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/g, replacement: '[Person]' },
  { pattern: /\b[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+\b/g, replacement: '[Person]' },
  // Dates: DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD
  { pattern: /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, replacement: '[Datum]' },
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/g, replacement: '[Datum]' },
  // Case numbers: Austrian/German court formats
  { pattern: /\b[A-Z]{1,3}\s*\d+[\s/]\d+[a-z]?\b/gi, replacement: '[AZ]' },
  { pattern: /\b\d{2,3}\s*(?:Cg|C|Cgs|Cga|E|S|U|R|Ob|Os|Hv|HR|Fam|GZ|VR|FN)\s*\d+\/\d+[a-z]?\b/gi, replacement: '[AZ]' },
  // StA file numbers (e.g., 12 Js 1234/24)
  { pattern: /\b\d{1,4}\s*Js\s*\d{1,7}\/\d{2,4}\b/gi, replacement: '[AZ]' },
  // Company names: GmbH, AG, etc. + preceding words
  { pattern: /\b[A-ZÄÖÜ][a-zäöüß]*(?:\s+[A-ZÄÖÜ][a-zäöüß]*)?\s+(?:GmbH|AG|KG|OG|e\.U\.|SE|Ltd|Inc|Holding|Stiftung|Verein|eG|mbH|Co\.?\s*KG)\b/gi, replacement: '[Firma]' },
  { pattern: /\b(?:GmbH|AG|KG|OG|e\.U\.|SE|Ltd|Inc)\b/gi, replacement: '[Firma]' },
  // Email
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[Email]' },
  // Phone numbers (international + local)
  { pattern: /\b(?:\+?\d{1,3}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,}[\s-]?\d{0,4}\b/g, replacement: '[Tel]' },
  // Postal codes + city names
  { pattern: /\b\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß]+\b/g, replacement: '[Ort]' },
  // Street addresses
  { pattern: /(?:Straße|Gasse|Weg|Platz|Ring|Allee|Damm|Ufer|Chaussee)\s*\d+[a-z]?(?:\/\d+)?/gi, replacement: '[Adresse]' },
  // IBAN
  { pattern: /\bIBAN\s*[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{0,4}\b/gi, replacement: '[IBAN]' },
  // Bare IBAN (without "IBAN" prefix)
  { pattern: /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}(?:\s?\d{0,4})?\b/g, replacement: '[IBAN]' },
  // Austrian social insurance number (10 digits: NNNN DDMMYY)
  { pattern: /\b\d{4}\s?\d{2}\d{2}\d{2}\b/g, replacement: '[SVNR]' },
  // Swiss AHV number (756.XXXX.XXXX.XX)
  { pattern: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g, replacement: '[AHV]' },
  // German tax ID (11 digits)
  { pattern: /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g, replacement: '[SteuerID]' },
];

const DEFAULT_SHARING_CONFIG: Omit<CollectiveSharingConfig, 'workspaceId' | 'updatedAt'> = {
  sharingEnabled: true,
  sharingLevel: 'anonymized_shared' as CollectiveSharingLevel,
  sharedCategories: [
    'norm_application',
    'strategy_pattern',
    'contradiction_pattern',
    'evidence_pattern',
    'procedural_insight',
    'court_tendency',
  ],
  receiveCollectiveContext: true,
  maxCollectiveContextEntries: 10,
  minConfidenceThreshold: 0.5,
  autoContribute: true,
};

const CATEGORY_LABELS: Record<CollectiveKnowledgeCategory, string> = {
  norm_application: 'Normanwendung',
  strategy_pattern: 'Strategie-Muster',
  contradiction_pattern: 'Widerspruchs-Muster',
  evidence_pattern: 'Beweis-Muster',
  deadline_pattern: 'Fristen-Muster',
  cost_pattern: 'Kosten-Muster',
  procedural_insight: 'Verfahrens-Erkenntnis',
  court_tendency: 'Gerichts-Tendenz',
  argument_template: 'Argumentations-Vorlage',
  risk_pattern: 'Risiko-Muster',
};

export { CATEGORY_LABELS as COLLECTIVE_CATEGORY_LABELS };

export class CollectiveIntelligenceService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    readonly orchestration: CasePlatformOrchestrationService,
    readonly legalNormsService: LegalNormsService
  ) {
    super();
  }

  readonly collectivePool$ = this.store.watchCollectiveKnowledgePool();
  readonly sharedDecisions$ = this.store.watchSharedCourtDecisions();
  readonly sharingConfig$ = this.store.watchCollectiveSharingConfig();

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  getSharingConfig(): CollectiveSharingConfig {
    const existing = this.store.getCollectiveSharingConfig();
    if (existing) return existing;

    const workspaceId = (this.store as any).workspaceId ?? 'unknown';
    const defaultConfig: CollectiveSharingConfig = {
      ...DEFAULT_SHARING_CONFIG,
      workspaceId,
      updatedAt: new Date().toISOString(),
    };
    this.store.setCollectiveSharingConfig(defaultConfig);
    return defaultConfig;
  }

  updateSharingConfig(updates: Partial<Omit<CollectiveSharingConfig, 'workspaceId'>>): CollectiveSharingConfig {
    const current = this.getSharingConfig();
    const updated: CollectiveSharingConfig = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.store.setCollectiveSharingConfig(updated);
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANONYMIZATION ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  anonymizeText(text: string): string {
    let result = text;
    for (const { pattern, replacement } of ANONYMIZATION_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  private anonymizeFinding(finding: LegalFinding, workspaceId: string): CollectiveKnowledgeEntry {
    const now = new Date().toISOString();
    const category = this.findingTypeToCategory(finding.type);
    const anonymizedTitle = this.anonymizeText(finding.title);
    const anonymizedDesc = this.anonymizeText(finding.description);

    const normRefs: string[] = this.extractNormRefsFromText(
      finding.title + ' ' + finding.description
    );

    const keywords = this.extractKeywords(anonymizedTitle + ' ' + anonymizedDesc);

    return {
      id: createId('cke'),
      contributorHash: hashString(workspaceId),
      category,
      title: anonymizedTitle,
      content: anonymizedDesc,
      legalDomains: this.inferLegalDomains(normRefs, anonymizedDesc),
      normReferences: [...new Set(normRefs)],
      jurisdictions: this.inferJurisdictions(normRefs),
      keywords,
      validationCount: 1,
      confidenceScore: this.calculateInitialConfidence(finding),
      qualityScore: this.assessQuality(anonymizedTitle, anonymizedDesc, normRefs),
      status: 'anonymized' as CollectiveContributionStatus,
      embeddingKeywords: keywords,
      createdAt: now,
      updatedAt: now,
    };
  }

  private anonymizeChunk(chunk: SemanticChunk, workspaceId: string): CollectiveKnowledgeEntry {
    const now = new Date().toISOString();
    const anonymizedText = this.anonymizeText(chunk.text);
    const keywords = [...chunk.keywords, ...this.extractKeywords(anonymizedText)];
    const uniqueKeywords = [...new Set(keywords)];

    const normRefs: string[] = [];
    if (chunk.extractedEntities?.legalRefs) {
      normRefs.push(...chunk.extractedEntities.legalRefs);
    }

    return {
      id: createId('cke'),
      contributorHash: hashString(workspaceId),
      category: this.chunkCategoryToKnowledgeCategory(chunk.category),
      title: `${chunk.category} — Chunk`,
      content: anonymizedText.slice(0, 2000),
      legalDomains: this.inferLegalDomains(normRefs, anonymizedText),
      normReferences: normRefs,
      jurisdictions: this.inferJurisdictions(normRefs),
      keywords: uniqueKeywords,
      validationCount: 1,
      confidenceScore: chunk.qualityScore * 0.8,
      qualityScore: chunk.qualityScore,
      status: 'anonymized' as CollectiveContributionStatus,
      embeddingKeywords: uniqueKeywords,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTRIBUTION — Auto-contribute from case analysis
  // ═══════════════════════════════════════════════════════════════════════════

  contributeFindings(findings: LegalFinding[], workspaceId: string): CollectiveKnowledgeEntry[] {
    const config = this.getSharingConfig();
    if (!config.sharingEnabled || config.sharingLevel === 'private') return [];

    const pool = this.store.getCollectiveKnowledgePool();
    const newEntries: CollectiveKnowledgeEntry[] = [];

    for (const finding of findings) {
      if (finding.severity === 'low') continue;

      const category = this.findingTypeToCategory(finding.type);
      if (!config.sharedCategories.includes(category)) continue;

      const entryNorms = this.extractNormRefsFromText(finding.title + ' ' + finding.description);
      const existing = pool.find(e =>
        e.category === category &&
        e.normReferences.some(n => entryNorms.some(en => en.includes(n) || n.includes(en)))
      );

      if (existing) {
        existing.validationCount++;
        existing.confidenceScore = Math.min(1, existing.confidenceScore + 0.05);
        existing.updatedAt = new Date().toISOString();
        if (existing.status === 'anonymized') {
          existing.status = 'verified';
        }
      } else {
        const entry = this.anonymizeFinding(finding, workspaceId);
        newEntries.push(entry);
      }
    }

    if (newEntries.length > 0) {
      this.store.setCollectiveKnowledgePool([...newEntries, ...pool]);
    } else if (pool.some(e => e.updatedAt > new Date(Date.now() - 1000).toISOString())) {
      this.store.setCollectiveKnowledgePool([...pool]);
    }

    return newEntries;
  }

  contributeChunks(chunks: SemanticChunk[], workspaceId: string): number {
    const config = this.getSharingConfig();
    if (!config.sharingEnabled || config.sharingLevel === 'private') return 0;

    const highQualityChunks = chunks.filter(c => c.qualityScore >= 0.6);
    if (highQualityChunks.length === 0) return 0;

    const pool = this.store.getCollectiveKnowledgePool();
    const newEntries: CollectiveKnowledgeEntry[] = [];

    for (const chunk of highQualityChunks.slice(0, 20)) {
      if (chunk.text.length < 100) continue;

      const entry = this.anonymizeChunk(chunk, workspaceId);
      const category = entry.category;
      if (!config.sharedCategories.includes(category)) continue;

      const isDuplicate = pool.some(e =>
        e.category === category &&
        this.computeSimilarity(e.embeddingKeywords, entry.embeddingKeywords) > 0.7
      );

      if (!isDuplicate) {
        newEntries.push(entry);
      }
    }

    if (newEntries.length > 0) {
      this.store.setCollectiveKnowledgePool([...newEntries, ...pool]);
    }

    return newEntries.length;
  }

  contributeCourtDecision(decision: {
    court: string;
    referenceNumber: string;
    decisionDate: string;
    legalArea: string;
    summary: string;
    headnotes: string[];
    normReferences: string[];
    keywords: string[];
    fullText?: string;
  }, workspaceId: string): SharedCourtDecision {
    const now = new Date().toISOString();
    const decisions = this.store.getSharedCourtDecisions();

    const existing = decisions.find(d =>
      d.referenceNumber === decision.referenceNumber &&
      d.court === decision.court
    );

    if (existing) {
      existing.citationCount++;
      existing.relevanceScore = Math.min(1, existing.relevanceScore + 0.02);
      existing.updatedAt = now;
      this.store.setSharedCourtDecisions([...decisions]);
      return existing;
    }

    const newDecision: SharedCourtDecision = {
      id: createId('scd'),
      ...decision,
      status: 'ingested',
      citationCount: 1,
      relevanceScore: 0.5,
      contributorHash: hashString(workspaceId),
      createdAt: now,
      updatedAt: now,
    };

    this.store.setSharedCourtDecisions([newDecision, ...decisions]);
    return newDecision;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERYING — Semantic search across collective pool
  // ═══════════════════════════════════════════════════════════════════════════

  searchCollectiveKnowledge(
    query: string,
    options?: {
      categories?: CollectiveKnowledgeCategory[];
      jurisdictions?: Array<'AT' | 'DE' | 'EU' | 'CH'>;
      minConfidence?: number;
      maxResults?: number;
      normFilter?: string[];
    }
  ): CollectiveKnowledgeEntry[] {
    const pool = this.store.getCollectiveKnowledgePool();
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const maxResults = options?.maxResults ?? 20;
    const minConfidence = options?.minConfidence ?? 0.3;

    const scored = pool
      .filter(entry => {
        if (entry.status === 'rejected') return false;
        if (entry.confidenceScore < minConfidence) return false;
        if (options?.categories?.length && !options.categories.includes(entry.category)) return false;
        if (options?.jurisdictions?.length && !entry.jurisdictions.some(j => options.jurisdictions!.includes(j))) return false;
        if (options?.normFilter?.length && !entry.normReferences.some(n => options.normFilter!.some(f => n.includes(f)))) return false;
        return true;
      })
      .map(entry => {
        let score = 0;

        for (const word of queryWords) {
          if (entry.title.toLowerCase().includes(word)) score += 3;
          if (entry.content.toLowerCase().includes(word)) score += 1;
          for (const kw of entry.keywords) {
            if (kw.toLowerCase().includes(word)) score += 2;
          }
          for (const norm of entry.normReferences) {
            if (norm.toLowerCase().includes(word)) score += 4;
          }
        }

        score += entry.confidenceScore * 3;
        score += entry.validationCount * 0.5;
        score += entry.qualityScore * 2;

        return { entry, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored.map(s => s.entry);
  }

  searchSharedDecisions(
    query: string,
    options?: {
      court?: string;
      legalArea?: string;
      maxResults?: number;
    }
  ): SharedCourtDecision[] {
    const decisions = this.store.getSharedCourtDecisions();
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const maxResults = options?.maxResults ?? 10;

    return decisions
      .filter(d => {
        if (options?.court && d.court !== options.court) return false;
        if (options?.legalArea && d.legalArea !== options.legalArea) return false;
        return true;
      })
      .map(d => {
        let score = 0;
        for (const word of queryWords) {
          if (d.summary.toLowerCase().includes(word)) score += 2;
          for (const h of d.headnotes) {
            if (h.toLowerCase().includes(word)) score += 3;
          }
          for (const kw of d.keywords) {
            if (kw.toLowerCase().includes(word)) score += 2;
          }
          for (const norm of d.normReferences) {
            if (norm.toLowerCase().includes(word)) score += 4;
          }
        }
        score += d.relevanceScore * 2;
        score += d.citationCount * 0.3;
        return { decision: d, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(s => s.decision);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT INJECTION — For Chat & Copilot
  // ═══════════════════════════════════════════════════════════════════════════

  buildCollectiveContext(
    query: string,
    activeNorms: string[],
    _legalDomains?: string[]
  ): CollectiveContextInjection {
    const config = this.getSharingConfig();
    if (!config.receiveCollectiveContext) {
      return this.emptyInjection();
    }

    const maxEntries = config.maxCollectiveContextEntries;
    const minConfidence = config.minConfidenceThreshold;

    const normFilter = activeNorms.length > 0 ? activeNorms : undefined;

    const matchedKnowledge = this.searchCollectiveKnowledge(query, {
      minConfidence,
      maxResults: maxEntries,
      normFilter,
    });

    const matchedDecisions = this.searchSharedDecisions(query, {
      maxResults: Math.min(5, Math.ceil(maxEntries / 2)),
    });

    const normPatterns = this.aggregateNormPatterns(matchedKnowledge, activeNorms);

    const contributorHashes = new Set<string>();
    for (const e of matchedKnowledge) contributorHashes.add(e.contributorHash);
    for (const d of matchedDecisions) contributorHashes.add(d.contributorHash);

    return {
      matchedEntries: matchedKnowledge.map(e => ({
        entryId: e.id,
        title: e.title,
        content: e.content.slice(0, 800),
        category: e.category,
        normReferences: e.normReferences,
        confidenceScore: e.confidenceScore,
        relevanceScore: e.qualityScore,
        validationCount: e.validationCount,
      })),
      matchedDecisions: matchedDecisions.map(d => ({
        decisionId: d.id,
        court: d.court,
        referenceNumber: d.referenceNumber,
        summary: d.summary.slice(0, 500),
        headnotes: d.headnotes.slice(0, 3),
        normReferences: d.normReferences,
        relevanceScore: d.relevanceScore,
      })),
      normPatterns,
      totalSearched: this.store.getCollectiveKnowledgePool().length + this.store.getSharedCourtDecisions().length,
      contributorCount: contributorHashes.size,
      generatedAt: new Date().toISOString(),
    };
  }

  collectiveContextToPrompt(injection: CollectiveContextInjection): string {
    if (injection.matchedEntries.length === 0 && injection.matchedDecisions.length === 0) {
      return '';
    }

    const parts: string[] = [];
    parts.push(`\n═══ KOLLEKTIVES WISSEN (${injection.contributorCount} Kanzleien, ${injection.totalSearched} Einträge durchsucht) ═══`);

    if (injection.matchedEntries.length > 0) {
      parts.push(`\n--- Bewährte Muster & Erkenntnisse ---`);
      for (const entry of injection.matchedEntries.slice(0, 5)) {
        parts.push(`[${CATEGORY_LABELS[entry.category]}] ${entry.title} (Konfidenz: ${(entry.confidenceScore * 100).toFixed(0)}%, ${entry.validationCount}x validiert)`);
        parts.push(`  ${entry.content}`);
        if (entry.normReferences.length > 0) {
          parts.push(`  Normen: ${entry.normReferences.join(', ')}`);
        }
      }
    }

    if (injection.matchedDecisions.length > 0) {
      parts.push(`\n--- Relevante Rechtsprechung (Shared Pool) ---`);
      for (const d of injection.matchedDecisions.slice(0, 3)) {
        parts.push(`${d.court} ${d.referenceNumber}: ${d.summary}`);
        if (d.headnotes.length > 0) {
          parts.push(`  Leitsätze: ${d.headnotes.join('; ')}`);
        }
      }
    }

    if (injection.normPatterns.length > 0) {
      parts.push(`\n--- Norm-Anwendungsmuster ---`);
      for (const np of injection.normPatterns.slice(0, 5)) {
        parts.push(`${np.norm}: ${np.applicationCount}x angewandt`);
        if (np.commonArguments.length > 0) {
          parts.push(`  Häufige Argumente: ${np.commonArguments.join('; ')}`);
        }
        if (np.commonCounterArguments.length > 0) {
          parts.push(`  Gegenargumente: ${np.commonCounterArguments.join('; ')}`);
        }
      }
    }

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN MASTER DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  generateMasterDashboard(): CollectiveMasterDashboard {
    const pool = this.store.getCollectiveKnowledgePool();
    const decisions = this.store.getSharedCourtDecisions();
    const poolStats = this.computePoolStats(pool, decisions);

    const trendingTopics = this.computeTrendingTopics(pool);
    const normHeatmap = this.computeNormHeatmap(pool);
    const provenStrategies = this.computeProvenStrategies(pool);
    const caseLawTrends = this.computeCaseLawTrends(decisions);
    const commonContradictions = this.computeCommonContradictions(pool);
    const knowledgeGaps = this.computeKnowledgeGaps(pool, decisions);

    return {
      poolStats,
      trendingTopics,
      normHeatmap,
      provenStrategies,
      caseLawTrends,
      commonContradictions,
      knowledgeGaps,
      generatedAt: new Date().toISOString(),
    };
  }

  private computePoolStats(
    pool: CollectiveKnowledgeEntry[],
    decisions: SharedCourtDecision[]
  ): CollectivePoolStats {
    const contributors = new Set(pool.map(e => e.contributorHash));
    const allNorms = new Set<string>();
    pool.forEach(e => e.normReferences.forEach(n => allNorms.add(n)));

    const byCategory = {} as Record<CollectiveKnowledgeCategory, number>;
    const categories: CollectiveKnowledgeCategory[] = [
      'norm_application', 'strategy_pattern', 'contradiction_pattern',
      'evidence_pattern', 'deadline_pattern', 'cost_pattern',
      'procedural_insight', 'court_tendency', 'argument_template', 'risk_pattern',
    ];
    for (const cat of categories) byCategory[cat] = 0;
    for (const e of pool) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;

    const byJurisdiction: Record<string, number> = {};
    for (const e of pool) {
      for (const j of e.jurisdictions) {
        byJurisdiction[j] = (byJurisdiction[j] ?? 0) + 1;
      }
    }

    const normCounts: Record<string, { count: number; totalConf: number }> = {};
    for (const e of pool) {
      for (const norm of e.normReferences) {
        if (!normCounts[norm]) normCounts[norm] = { count: 0, totalConf: 0 };
        normCounts[norm].count++;
        normCounts[norm].totalConf += e.confidenceScore;
      }
    }
    const topNorms = Object.entries(normCounts)
      .map(([norm, data]) => ({
        norm,
        count: data.count,
        avgConfidence: data.totalConf / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const domainCounts: Record<string, number> = {};
    for (const e of pool) {
      for (const d of e.legalDomains) {
        domainCounts[d] = (domainCounts[d] ?? 0) + 1;
      }
    }
    const topDomains = Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const weekAgo = Date.now() - 7 * 86_400_000;
    const recentContributions = pool.filter(e => new Date(e.createdAt).getTime() > weekAgo).length;

    const avgConf = pool.length > 0
      ? pool.reduce((sum, e) => sum + e.confidenceScore, 0) / pool.length
      : 0;

    return {
      totalEntries: pool.length + decisions.length,
      totalContributors: contributors.size,
      totalNormsReferenced: allNorms.size,
      totalValidations: pool.reduce((sum, e) => sum + e.validationCount, 0),
      entriesByCategory: byCategory,
      entriesByJurisdiction: byJurisdiction,
      topNorms,
      topDomains,
      recentContributions,
      averageConfidence: avgConf,
      lastUpdatedAt: pool.length > 0
        ? pool.reduce((latest, e) => e.updatedAt > latest ? e.updatedAt : latest, pool[0].updatedAt)
        : new Date().toISOString(),
    };
  }

  private computeTrendingTopics(pool: CollectiveKnowledgeEntry[]) {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const twoWeeksAgo = Date.now() - 14 * 86_400_000;

    const topicCounts: Record<string, { recent: number; older: number; norms: Set<string> }> = {};

    for (const entry of pool) {
      for (const domain of entry.legalDomains) {
        if (!topicCounts[domain]) topicCounts[domain] = { recent: 0, older: 0, norms: new Set() };
        const ts = new Date(entry.createdAt).getTime();
        if (ts > weekAgo) topicCounts[domain].recent++;
        else if (ts > twoWeeksAgo) topicCounts[domain].older++;
        entry.normReferences.forEach(n => topicCounts[domain].norms.add(n));
      }
    }

    return Object.entries(topicCounts)
      .map(([topic, data]) => ({
        topic,
        mentionCount: data.recent + data.older,
        trend: (data.recent > data.older * 1.2 ? 'rising' : data.recent < data.older * 0.8 ? 'declining' : 'stable') as 'rising' | 'stable' | 'declining',
        relatedNorms: Array.from(data.norms).slice(0, 5),
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 15);
  }

  private computeNormHeatmap(pool: CollectiveKnowledgeEntry[]) {
    const normData: Record<string, {
      count: number;
      totalConf: number;
      jurisdictions: Set<string>;
      law: string;
    }> = {};

    for (const entry of pool) {
      for (const normRef of entry.normReferences) {
        if (!normData[normRef]) {
          const law = normRef.replace(/§\s*\d+[a-z]?\s*/i, '').trim() || 'Unbekannt';
          normData[normRef] = { count: 0, totalConf: 0, jurisdictions: new Set(), law };
        }
        normData[normRef].count++;
        normData[normRef].totalConf += entry.confidenceScore;
        entry.jurisdictions.forEach(j => normData[normRef].jurisdictions.add(j));
      }
    }

    return Object.entries(normData)
      .map(([norm, data]) => ({
        norm,
        law: data.law,
        applicationCount: data.count,
        successIndicator: data.totalConf / data.count,
        avgConfidence: data.totalConf / data.count,
        jurisdictions: Array.from(data.jurisdictions),
      }))
      .sort((a, b) => b.applicationCount - a.applicationCount)
      .slice(0, 30);
  }

  private computeProvenStrategies(pool: CollectiveKnowledgeEntry[]) {
    return pool
      .filter(e => e.category === 'strategy_pattern' && e.validationCount >= 2 && e.confidenceScore >= 0.6)
      .sort((a, b) => b.validationCount - a.validationCount)
      .slice(0, 15)
      .map(e => ({
        id: e.id,
        title: e.title,
        description: e.content.slice(0, 300),
        legalDomain: e.legalDomains[0] ?? 'allgemein',
        validationCount: e.validationCount,
        confidenceScore: e.confidenceScore,
        normReferences: e.normReferences,
      }));
  }

  private computeCaseLawTrends(decisions: SharedCourtDecision[]) {
    const courtAreaGroups: Record<string, SharedCourtDecision[]> = {};
    for (const d of decisions) {
      const key = `${d.court}:${d.legalArea}`;
      if (!courtAreaGroups[key]) courtAreaGroups[key] = [];
      courtAreaGroups[key].push(d);
    }

    return Object.entries(courtAreaGroups)
      .map(([key, group]) => {
        const [court, legalArea] = key.split(':');
        return {
          court,
          legalArea,
          trend: `${group.length} Entscheidungen im Pool`,
          recentDecisions: group.length,
          direction: 'neutral' as const,
        };
      })
      .sort((a, b) => b.recentDecisions - a.recentDecisions)
      .slice(0, 10);
  }

  private computeCommonContradictions(pool: CollectiveKnowledgeEntry[]) {
    const contradictions = pool.filter(e => e.category === 'contradiction_pattern');

    const patterns: Record<string, { count: number; domain: string; hints: Set<string> }> = {};
    for (const c of contradictions) {
      const patternKey = c.keywords.slice(0, 3).sort().join('-') || c.title;
      if (!patterns[patternKey]) {
        patterns[patternKey] = { count: 0, domain: c.legalDomains[0] ?? 'allgemein', hints: new Set() };
      }
      patterns[patternKey].count += c.validationCount;
      c.keywords.forEach(k => patterns[patternKey].hints.add(k));
    }

    return Object.entries(patterns)
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        legalDomain: data.domain,
        resolutionHints: Array.from(data.hints).slice(0, 5),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private computeKnowledgeGaps(pool: CollectiveKnowledgeEntry[], decisions: SharedCourtDecision[]) {
    const gaps: Array<{ area: string; description: string; severity: 'low' | 'medium' | 'high'; suggestedAction: string }> = [];

    const categoryCounts = {} as Record<CollectiveKnowledgeCategory, number>;
    for (const e of pool) categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;

    const allCategories: CollectiveKnowledgeCategory[] = [
      'norm_application', 'strategy_pattern', 'contradiction_pattern',
      'evidence_pattern', 'deadline_pattern', 'cost_pattern',
      'procedural_insight', 'court_tendency', 'argument_template', 'risk_pattern',
    ];
    for (const cat of allCategories) {
      if ((categoryCounts[cat] ?? 0) < 3) {
        gaps.push({
          area: CATEGORY_LABELS[cat],
          description: `Nur ${categoryCounts[cat] ?? 0} Einträge in der Kategorie "${CATEGORY_LABELS[cat]}". Mehr Daten benötigt.`,
          severity: (categoryCounts[cat] ?? 0) === 0 ? 'high' : 'medium',
          suggestedAction: `Mehr Fälle mit ${CATEGORY_LABELS[cat]}-Erkenntnissen analysieren und beitragen.`,
        });
      }
    }

    const jurisdictions = new Set<string>();
    pool.forEach(e => e.jurisdictions.forEach(j => jurisdictions.add(j)));
    if (!jurisdictions.has('CH')) {
      gaps.push({
        area: 'Schweizer Recht',
        description: 'Keine Einträge für Schweizer Jurisdiktion vorhanden.',
        severity: 'medium',
        suggestedAction: 'Schweizer Rechtsfälle beitragen, um CH-Abdeckung zu verbessern.',
      });
    }

    if (decisions.length < 10) {
      gaps.push({
        area: 'Judikatur-Datenbank',
        description: `Nur ${decisions.length} geteilte Urteile vorhanden. Empfehlung: Mehr Urteile importieren.`,
        severity: decisions.length < 3 ? 'high' : 'medium',
        suggestedAction: 'OGH/BGH/EGMR-Crawler aktivieren und Urteile zum Shared Pool beitragen.',
      });
    }

    return gaps;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION — Cross-tenant verification
  // ═══════════════════════════════════════════════════════════════════════════

  validateEntry(entryId: string): boolean {
    const pool = this.store.getCollectiveKnowledgePool();
    const entry = pool.find(e => e.id === entryId);
    if (!entry) return false;

    entry.validationCount++;
    entry.confidenceScore = Math.min(1, entry.confidenceScore + 0.05);
    if (entry.validationCount >= 3 && entry.status !== 'published') {
      entry.status = 'verified';
    }
    if (entry.validationCount >= 5) {
      entry.status = 'published';
    }
    entry.updatedAt = new Date().toISOString();

    this.store.setCollectiveKnowledgePool([...pool]);
    return true;
  }

  rejectEntry(entryId: string): boolean {
    const pool = this.store.getCollectiveKnowledgePool();
    const entry = pool.find(e => e.id === entryId);
    if (!entry) return false;

    entry.status = 'rejected';
    entry.updatedAt = new Date().toISOString();
    this.store.setCollectiveKnowledgePool([...pool]);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private emptyInjection(): CollectiveContextInjection {
    return {
      matchedEntries: [],
      matchedDecisions: [],
      normPatterns: [],
      totalSearched: 0,
      contributorCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  private findingTypeToCategory(type: string): CollectiveKnowledgeCategory {
    switch (type) {
      case 'contradiction': return 'contradiction_pattern';
      case 'norm_reference': case 'norm_conflict': return 'norm_application';
      case 'deadline_risk': return 'deadline_pattern';
      case 'evidence_gap': return 'evidence_pattern';
      case 'cost_risk': return 'cost_pattern';
      case 'procedural': return 'procedural_insight';
      case 'risk': return 'risk_pattern';
      default: return 'norm_application';
    }
  }

  private chunkCategoryToKnowledgeCategory(category: string): CollectiveKnowledgeCategory {
    switch (category) {
      case 'rechtsausfuehrung': case 'begruendung': return 'norm_application';
      case 'antrag': return 'strategy_pattern';
      case 'beweis': case 'zeuge': case 'gutachten': return 'evidence_pattern';
      case 'urteil': return 'court_tendency';
      case 'frist': case 'bescheid': return 'deadline_pattern';
      case 'korrespondenz': return 'argument_template';
      default: return 'procedural_insight';
    }
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'aber', 'ist', 'sind', 'war',
      'hat', 'haben', 'wird', 'werden', 'bei', 'mit', 'von', 'für', 'auf', 'aus',
      'nach', 'über', 'unter', 'vor', 'durch', 'als', 'wie', 'wenn', 'dass', 'dem',
      'den', 'des', 'sich', 'auch', 'noch', 'nicht', 'nur', 'kann', 'zum', 'zur',
      'person', 'datum', 'firma', 'email', 'tel', 'ort', 'adresse', 'iban',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-zäöüß§\s\d]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .reduce((acc: string[], word) => {
        if (!acc.includes(word)) acc.push(word);
        return acc;
      }, [])
      .slice(0, 30);
  }

  private inferLegalDomains(normRefs: string[], text: string): string[] {
    const domains = new Set<string>();
    const textLower = text.toLowerCase();

    if (normRefs.some(n => /bgb|abgb|miet|mietrecht|mrg/i.test(n)) || /zivilrecht|schadensersatz|vertrag/i.test(textLower)) {
      domains.add('zivilrecht');
    }
    if (normRefs.some(n => /stgb|stpo/i.test(n)) || /strafrecht|betrug|diebstahl|körperverletzung/i.test(textLower)) {
      domains.add('strafrecht');
    }
    if (normRefs.some(n => /avg|vwgvg/i.test(n)) || /verwaltungsrecht|behörde|bescheid/i.test(textLower)) {
      domains.add('verwaltungsrecht');
    }
    if (normRefs.some(n => /inso|insolvenz/i.test(n)) || /insolvenz|konkurs/i.test(textLower)) {
      domains.add('insolvenzrecht');
    }
    if (normRefs.some(n => /hgb|ugb/i.test(n)) || /handelsrecht|gesellschaftsrecht/i.test(textLower)) {
      domains.add('handelsrecht');
    }
    if (normRefs.some(n => /zpo/i.test(n)) || /prozessrecht|klage|berufung|revision/i.test(textLower)) {
      domains.add('prozessrecht');
    }
    if (normRefs.some(n => /emrk|egmr/i.test(n)) || /menschenrecht|grundrecht/i.test(textLower)) {
      domains.add('menschenrechte');
    }
    if (normRefs.some(n => /arbg|betrvg|agg/i.test(n)) || /arbeitsrecht|kündigung|arbeitnehmer/i.test(textLower)) {
      domains.add('arbeitsrecht');
    }

    if (domains.size === 0) domains.add('allgemein');
    return Array.from(domains);
  }

  private inferJurisdictions(normRefs: string[]): Array<'AT' | 'DE' | 'EU' | 'CH'> {
    const jurisdictions = new Set<'AT' | 'DE' | 'EU' | 'CH'>();

    for (const norm of normRefs) {
      if (/abgb|mrg|avg|ogh|stgb.*at|stpo.*at/i.test(norm)) jurisdictions.add('AT');
      if (/bgb|hgb|inso|bgh|stgb(?!.*at)|zpo(?!.*at)|stpo(?!.*at)|gkg|rvg/i.test(norm)) jurisdictions.add('DE');
      if (/emrk|egmr|eu.*verordnung|eu.*richtlinie/i.test(norm)) jurisdictions.add('EU');
      if (/or|zgb|schweizerisch/i.test(norm)) jurisdictions.add('CH');
    }

    if (jurisdictions.size === 0) {
      jurisdictions.add('AT');
      jurisdictions.add('DE');
    }
    return Array.from(jurisdictions);
  }

  private calculateInitialConfidence(finding: LegalFinding): number {
    let confidence = 0.4;
    if (finding.severity === 'critical') confidence += 0.2;
    else if (finding.severity === 'high') confidence += 0.15;
    else if (finding.severity === 'medium') confidence += 0.1;
    if (finding.sourceDocumentIds.length > 0) confidence += 0.1;
    if (finding.citations && finding.citations.length > 0) confidence += 0.1;
    return Math.min(1, confidence);
  }

  private assessQuality(title: string, content: string, normRefs: string[]): number {
    let score = 0.3;
    if (title.length > 10) score += 0.1;
    if (content.length > 50) score += 0.1;
    if (content.length > 200) score += 0.1;
    if (normRefs.length > 0) score += 0.15;
    if (normRefs.length > 2) score += 0.1;
    if (!/\[Person\]|\[AZ\]|\[Datum\]/.test(content)) score += 0.05;
    return Math.min(1, score);
  }

  private computeSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    let intersection = 0;
    for (const kw of set1) {
      if (set2.has(kw)) intersection++;
    }
    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private extractNormRefsFromText(text: string): string[] {
    const refs: string[] = [];
    const normRegex = /§\s*\d+[a-z]?(?:\s+(?:Abs\.?\s*\d+)?)?\s*[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*/g;
    const artRegex = /Art\.?\s*\d+(?:\s+(?:Abs\.?\s*\d+)?)?\s*[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*/g;
    const matches1 = text.match(normRegex) ?? [];
    const matches2 = text.match(artRegex) ?? [];
    refs.push(...matches1, ...matches2);
    return [...new Set(refs.map(r => r.trim()))];
  }

  private aggregateNormPatterns(
    entries: CollectiveKnowledgeEntry[],
    activeNorms: string[]
  ): CollectiveContextInjection['normPatterns'] {
    const normGroups: Record<string, {
      count: number;
      arguments: string[];
      counterArguments: string[];
    }> = {};

    const relevantNorms = new Set(activeNorms);

    for (const entry of entries) {
      for (const norm of entry.normReferences) {
        if (relevantNorms.size > 0 && !Array.from(relevantNorms).some(n => norm.includes(n))) continue;

        if (!normGroups[norm]) {
          normGroups[norm] = { count: 0, arguments: [], counterArguments: [] };
        }
        normGroups[norm].count += entry.validationCount;

        if (entry.category === 'strategy_pattern' || entry.category === 'argument_template') {
          normGroups[norm].arguments.push(entry.title);
        }
        if (entry.category === 'contradiction_pattern') {
          normGroups[norm].counterArguments.push(entry.title);
        }
      }
    }

    return Object.entries(normGroups)
      .map(([norm, data]) => ({
        norm,
        applicationCount: data.count,
        successRate: 0.7,
        commonArguments: [...new Set(data.arguments)].slice(0, 3),
        commonCounterArguments: [...new Set(data.counterArguments)].slice(0, 3),
      }))
      .sort((a, b) => b.applicationCount - a.applicationCount)
      .slice(0, 10);
  }
}
