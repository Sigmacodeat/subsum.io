import { Service } from '@toeverything/infra';

import type {
  BeweislastCheckResult,
  CaseAuditResult,
  AuditRiskLevel,
  LegalDocumentRecord,
  QualificationChainResult,
  ReclassificationSuggestion,
  TatbestandsCheckResult,
  TatbestandsMerkmalCheck,
} from '../types';
import type { LegalNorm } from './legal-norms';
import type { LegalNormsService } from './legal-norms';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function extractExcerpt(text: string, indicator: string, radius = 100): string {
  const idx = text.toLowerCase().indexOf(indicator.toLowerCase());
  if (idx < 0) return '';
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + indicator.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

// ═══════════════════════════════════════════════════════════════════════════
// Norm Classification Engine
//
// Analyzes case facts against the full norm database:
// 1. Tatbestandsmerkmale-Prüfung (structured element checking)
// 2. Qualification chain detection (Betrug → schwerer Betrug → Bandenbetrug)
// 3. Reclassification suggestions (upgrade/downgrade/alternative)
// 4. Beweislast analysis
// 5. Overall risk scoring
// ═══════════════════════════════════════════════════════════════════════════

export class NormClassificationEngine extends Service {
  constructor(private readonly legalNormsService: LegalNormsService) {
    super();
  }

  // ─── 1. Tatbestandsmerkmale-Prüfung ──────────────────────────────────

  /**
   * Check a single norm's Tatbestandsmerkmale against the case text.
   */
  checkTatbestand(
    norm: LegalNorm,
    caseText: string,
    sourceDocIds: string[]
  ): TatbestandsCheckResult | null {
    if (!norm.tatbestandsMerkmale || norm.tatbestandsMerkmale.length === 0) {
      return null;
    }

    const lowerText = caseText.toLowerCase();
    const merkmale: TatbestandsMerkmalCheck[] = [];

    for (const merkmal of norm.tatbestandsMerkmale) {
      const matched: string[] = [];
      const excerpts: string[] = [];

      for (const indicator of merkmal.indicators) {
        if (lowerText.includes(indicator.toLowerCase())) {
          matched.push(indicator);
          const excerpt = extractExcerpt(caseText, indicator, 80);
          if (excerpt) excerpts.push(excerpt);
        }
      }

      const fulfilled = matched.length > 0;
      const confidence = fulfilled
        ? Math.min(1, matched.length / Math.max(merkmal.indicators.length * 0.3, 1))
        : 0;

      merkmale.push({
        merkmalId: merkmal.id,
        label: merkmal.label,
        description: merkmal.description,
        fulfilled,
        confidence,
        matchedIndicators: matched,
        sourceExcerpts: excerpts.slice(0, 3),
        required: merkmal.required,
        weight: merkmal.weight,
      });
    }

    const totalRequired = merkmale.filter(m => m.required);
    const fulfilledRequired = totalRequired.filter(m => m.fulfilled);
    const allRequiredFulfilled = totalRequired.length === 0 || fulfilledRequired.length === totalRequired.length;
    const fulfillmentRatio = totalRequired.length > 0
      ? fulfilledRequired.length / totalRequired.length
      : merkmale.filter(m => m.fulfilled).length / Math.max(merkmale.length, 1);

    const totalWeight = merkmale.reduce((s, m) => s + m.weight, 0);
    const fulfilledWeight = merkmale
      .filter(m => m.fulfilled)
      .reduce((s, m) => s + m.weight * m.confidence, 0);
    const weightedScore = totalWeight > 0 ? fulfilledWeight / totalWeight : 0;

    const overallScore = (fulfillmentRatio * 0.6 + weightedScore * 0.4);

    // Also check keyword matches for additional scoring context
    const matchedKeywords = norm.keywords.filter(kw => lowerText.includes(kw.toLowerCase()));

    // Check exclusion indicators
    if (norm.exclusionIndicators) {
      const exclusionHits = norm.exclusionIndicators.filter(ei => lowerText.includes(ei.toLowerCase()));
      if (exclusionHits.length > 0) {
        // Reduce score significantly but don't zero it
        return {
          normId: norm.id,
          normTitle: norm.title,
          law: norm.law,
          paragraph: norm.paragraph,
          domain: norm.domain,
          merkmale,
          overallScore: overallScore * 0.3,
          fulfillmentRatio,
          weightedScore: weightedScore * 0.3,
          allRequiredFulfilled: false,
          matchedKeywords,
          sourceDocumentIds: sourceDocIds,
        };
      }
    }

    return {
      normId: norm.id,
      normTitle: norm.title,
      law: norm.law,
      paragraph: norm.paragraph,
      domain: norm.domain,
      merkmale,
      overallScore,
      fulfillmentRatio,
      weightedScore,
      allRequiredFulfilled,
      matchedKeywords,
      sourceDocumentIds: sourceDocIds,
    };
  }

  /**
   * Scan ALL norms with Tatbestandsmerkmale against the case text.
   * Returns only norms where at least one merkmal is fulfilled.
   */
  detectApplicableNorms(
    caseText: string,
    sourceDocIds: string[],
    minScore = 0.15
  ): TatbestandsCheckResult[] {
    const results: TatbestandsCheckResult[] = [];

    for (const norm of this.legalNormsService.norms) {
      if (!norm.tatbestandsMerkmale || norm.tatbestandsMerkmale.length === 0) continue;

      const check = this.checkTatbestand(norm, caseText, sourceDocIds);
      if (check && check.overallScore >= minScore) {
        results.push(check);
      }
    }

    return results.sort((a, b) => b.overallScore - a.overallScore);
  }

  // ─── 2. Qualification Chain Detection ─────────────────────────────────

  /**
   * For each detected base norm, check if qualifications apply.
   * E.g., if § 263 Betrug matches AND indicators for Bande/gewerbsmäßig,
   * suggest § 263 Abs. 5 Bandenbetrug.
   */
  analyzeQualificationChains(
    caseText: string,
    detectedNorms: TatbestandsCheckResult[]
  ): QualificationChainResult[] {
    const chains: QualificationChainResult[] = [];
    const lowerText = caseText.toLowerCase();

    // Find all base norms (qualificationLevel 0) that were detected
    const baseNormIds = new Set(
      detectedNorms
        .filter(n => {
          const norm = this.legalNormsService.getNormById(n.normId);
          return norm && (norm.qualificationLevel === 0 || norm.qualificationLevel === undefined);
        })
        .map(n => n.normId)
    );

    for (const baseId of baseNormIds) {
      const baseNorm = this.legalNormsService.getNormById(baseId);
      if (!baseNorm || !baseNorm.qualifiedBy || baseNorm.qualifiedBy.length === 0) continue;

      const qualifications: QualificationChainResult['detectedQualifications'] = [];

      for (const qualId of baseNorm.qualifiedBy) {
        const qualNorm = this.legalNormsService.getNormById(qualId);
        if (!qualNorm) continue;

        // Check qualification indicators
        let qualScore = 0;
        const triggers: string[] = [];

        if (qualNorm.tatbestandsMerkmale) {
          for (const merkmal of qualNorm.tatbestandsMerkmale) {
            for (const indicator of merkmal.indicators) {
              if (lowerText.includes(indicator.toLowerCase())) {
                qualScore += merkmal.weight;
                triggers.push(indicator);
              }
            }
          }
        }

        // Also check keywords
        for (const kw of qualNorm.keywords) {
          if (lowerText.includes(kw.toLowerCase())) {
            qualScore += 0.3;
            if (!triggers.includes(kw)) triggers.push(kw);
          }
        }

        if (qualScore > 0.3 && triggers.length > 0) {
          qualifications.push({
            normId: qualNorm.id,
            normTitle: qualNorm.title,
            level: qualNorm.qualificationLevel ?? 1,
            score: Math.min(1, qualScore / 3),
            triggerIndicators: [...new Set(triggers)].slice(0, 10),
          });
        }
      }

      if (qualifications.length > 0) {
        // Sort by level descending, then score descending
        qualifications.sort((a, b) => b.level - a.level || b.score - a.score);
        const recommended = qualifications[0];
        const chainDesc = qualifications
          .map(q => `${q.normTitle} (Level ${q.level}, Score ${(q.score * 100).toFixed(0)}%)`)
          .join(' → ');

        chains.push({
          baseNormId: baseId,
          baseNormTitle: baseNorm.title,
          detectedQualifications: qualifications,
          recommendedNormId: recommended.normId,
          recommendedNormTitle: recommended.normTitle,
          chainDescription: `${baseNorm.law} ${baseNorm.paragraph} ${baseNorm.title} → ${chainDesc}`,
        });
      }
    }

    return chains;
  }

  // ─── 3. Reclassification Suggestions ──────────────────────────────────

  /**
   * Generate concrete reclassification suggestions based on detected norms
   * and qualification chains.
   */
  generateReclassifications(
    detectedNorms: TatbestandsCheckResult[],
    qualificationChains: QualificationChainResult[]
  ): ReclassificationSuggestion[] {
    const suggestions: ReclassificationSuggestion[] = [];

    // From qualification chains: suggest upgrades
    for (const chain of qualificationChains) {
      const baseNorm = this.legalNormsService.getNormById(chain.baseNormId);
      const recommendedNorm = this.legalNormsService.getNormById(chain.recommendedNormId);
      if (!baseNorm || !recommendedNorm || chain.baseNormId === chain.recommendedNormId) continue;

      const bestQual = chain.detectedQualifications[0];

      suggestions.push({
        id: createId('reclass'),
        currentNormId: chain.baseNormId,
        currentNormTitle: `${baseNorm.law} ${baseNorm.paragraph} — ${baseNorm.title}`,
        suggestedNormId: chain.recommendedNormId,
        suggestedNormTitle: `${recommendedNorm.law} ${recommendedNorm.paragraph} — ${recommendedNorm.title}`,
        direction: 'upgrade',
        reason: `Qualifikationsmerkmale für ${recommendedNorm.title} erkannt: ${bestQual.triggerIndicators.slice(0, 5).join(', ')}. ` +
          `Score: ${(bestQual.score * 100).toFixed(0)}%. ` +
          `Prüfung empfohlen, ob statt ${baseNorm.paragraph} ${baseNorm.law} die Qualifikation ${recommendedNorm.paragraph} ${recommendedNorm.law} einschlägig ist.`,
        confidence: bestQual.score,
        triggeredByIndicators: bestQual.triggerIndicators,
        legalBasis: `${recommendedNorm.law} ${recommendedNorm.paragraph}`,
        strafrahmenCurrent: baseNorm.strafrahmen
          ? `${baseNorm.strafrahmen.min ?? ''} bis ${baseNorm.strafrahmen.max ?? ''}`.trim()
          : undefined,
        strafrahmenSuggested: recommendedNorm.strafrahmen
          ? `${recommendedNorm.strafrahmen.min ?? ''} bis ${recommendedNorm.strafrahmen.max ?? ''}`.trim()
          : undefined,
      });
    }

    // Cross-norm alternatives: if multiple base norms from same domain detected,
    // suggest the one with higher score as primary
    const criminalNorms = detectedNorms
      .filter(n => n.domain === 'criminal' && n.overallScore >= 0.3)
      .sort((a, b) => b.overallScore - a.overallScore);

    // Check for § 129 StGB (kriminelle Vereinigung) applicability
    // when multiple persons / organized indicators are present
    const org129 = detectedNorms.find(n => n.normId === 'stgb-129');
    if (org129 && org129.overallScore >= 0.25) {
      for (const crimNorm of criminalNorms) {
        if (crimNorm.normId === 'stgb-129' || crimNorm.normId === 'stgb-129a') continue;
        const alreadySuggested = suggestions.some(
          s => s.currentNormId === crimNorm.normId && s.suggestedNormId === 'stgb-129'
        );
        if (alreadySuggested) continue;

        const baseNorm = this.legalNormsService.getNormById(crimNorm.normId);
        const org129Norm = this.legalNormsService.getNormById('stgb-129');
        if (!baseNorm || !org129Norm) continue;

        suggestions.push({
          id: createId('reclass'),
          currentNormId: crimNorm.normId,
          currentNormTitle: `${baseNorm.law} ${baseNorm.paragraph} — ${baseNorm.title}`,
          suggestedNormId: 'stgb-129',
          suggestedNormTitle: `${org129Norm.law} ${org129Norm.paragraph} — ${org129Norm.title}`,
          direction: 'alternative',
          reason: `Neben ${baseNorm.paragraph} ${baseNorm.law} könnten Indikatoren für eine kriminelle Vereinigung (§ 129 StGB) vorliegen. ` +
            `Geprüft werden sollte: organisierter Zusammenschluss, mind. 3 Personen, gemeinsamer Straftatenzweck. ` +
            `Matched: ${org129.matchedKeywords.slice(0, 5).join(', ')}.`,
          confidence: org129.overallScore,
          triggeredByIndicators: org129.matchedKeywords,
          legalBasis: '§ 129 StGB — Bildung krimineller Vereinigungen',
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // ─── 4. Beweislast-Analyse ────────────────────────────────────────────

  analyzeBeweislast(
    detectedNorms: TatbestandsCheckResult[],
    caseText: string
  ): BeweislastCheckResult[] {
    const results: BeweislastCheckResult[] = [];
    const lowerText = caseText.toLowerCase();

    for (const check of detectedNorms) {
      if (check.overallScore < 0.3) continue;

      const norm = this.legalNormsService.getNormById(check.normId);
      if (!norm || !norm.burdenOfProof) continue;

      const gaps: string[] = [];
      const missingEvidence: string[] = [];

      // Check which Tatbestandsmerkmale are NOT fulfilled
      for (const merkmal of check.merkmale) {
        if (merkmal.required && !merkmal.fulfilled) {
          gaps.push(`${merkmal.label}: ${merkmal.description} — nicht nachgewiesen`);
          missingEvidence.push(`Beweis für "${merkmal.label}" fehlt`);
        }
      }

      // Check if key evidence terms are present
      const evidenceTerms = ['beweis', 'zeuge', 'urkunde', 'gutachten', 'sachverständig', 'anlage'];
      const hasEvidence = evidenceTerms.some(t => lowerText.includes(t));
      if (!hasEvidence && norm.domain === 'criminal') {
        gaps.push('Keine Beweismittel-Referenzen im Sachverhalt erkannt');
      }

      const burdenMap: Record<string, string> = {
        claimant: 'Kläger/Ankläger trägt die Beweislast',
        defendant: 'Beklagter/Beschuldigter trägt die Beweislast (Exkulpation)',
        shared: 'Geteilte Beweislast',
      };

      results.push({
        normId: norm.id,
        normTitle: `${norm.law} ${norm.paragraph} — ${norm.title}`,
        burden: norm.burdenOfProof,
        burdenDescription: burdenMap[norm.burdenOfProof] ?? 'Unbekannt',
        identifiedGaps: gaps,
        missingEvidence: missingEvidence,
      });
    }

    return results;
  }

  // ─── 5. Full Case Audit ───────────────────────────────────────────────

  /**
   * Run a complete audit on all case documents.
   * This is the main entry point called during document intake.
   */
  runCaseAudit(input: {
    caseId: string;
    workspaceId: string;
    documents: LegalDocumentRecord[];
  }): CaseAuditResult {
    const startTime = Date.now();
    const now = new Date().toISOString();

    // Combine all document text
    const allText = input.documents
      .map(d => d.normalizedText ?? d.rawText)
      .filter(t => t && t.length > 20)
      .join('\n\n');

    if (!allText || allText.length < 50) {
      return this._emptyResult(input, startTime, now);
    }

    const sourceDocIds = input.documents.map(d => d.id);

    // Step 1: Detect applicable norms via Tatbestandsmerkmale
    const detectedNorms = this.detectApplicableNorms(allText, sourceDocIds, 0.15);

    // Step 2: Analyze qualification chains
    const qualificationChains = this.analyzeQualificationChains(allText, detectedNorms);

    // Step 3: Generate reclassification suggestions
    const reclassifications = this.generateReclassifications(detectedNorms, qualificationChains);

    // Step 4: Beweislast analysis
    const beweislastAnalysis = this.analyzeBeweislast(detectedNorms, allText);

    // Step 5: Compute risk score
    const riskScore = this._computeRiskScore(detectedNorms, reclassifications, beweislastAnalysis);
    const riskLevel = this._riskLevel(riskScore);

    // Step 6: Generate summary
    const summary = this._generateSummary(detectedNorms, reclassifications, qualificationChains, beweislastAnalysis, riskLevel);

    const highConfidence = detectedNorms.filter(n => n.overallScore >= 0.5).length;
    const auditDurationMs = Date.now() - startTime;

    return {
      id: createId('audit'),
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      auditedDocumentIds: sourceDocIds,
      detectedNorms: detectedNorms.slice(0, 20),
      reclassifications,
      qualificationChains,
      beweislastAnalysis,
      overallRiskScore: riskScore,
      riskLevel,
      summary,
      stats: {
        totalDocumentsAudited: input.documents.length,
        totalNormsDetected: detectedNorms.length,
        totalReclassifications: reclassifications.length,
        totalQualificationUpgrades: qualificationChains.reduce((s, c) => s + c.detectedQualifications.length, 0),
        totalBeweislastGaps: beweislastAnalysis.reduce((s, b) => s + b.identifiedGaps.length, 0),
        highConfidenceNorms: highConfidence,
      },
      generatedAt: now,
      auditDurationMs,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private _emptyResult(
    input: { caseId: string; workspaceId: string; documents: LegalDocumentRecord[] },
    startTime: number,
    now: string
  ): CaseAuditResult {
    return {
      id: createId('audit'),
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      auditedDocumentIds: input.documents.map(d => d.id),
      detectedNorms: [],
      reclassifications: [],
      qualificationChains: [],
      beweislastAnalysis: [],
      overallRiskScore: 0,
      riskLevel: 'low',
      summary: 'Kein ausreichender Text für Aktenaudit vorhanden.',
      stats: {
        totalDocumentsAudited: input.documents.length,
        totalNormsDetected: 0,
        totalReclassifications: 0,
        totalQualificationUpgrades: 0,
        totalBeweislastGaps: 0,
        highConfidenceNorms: 0,
      },
      generatedAt: now,
      auditDurationMs: Date.now() - startTime,
    };
  }

  private _computeRiskScore(
    norms: TatbestandsCheckResult[],
    reclassifications: ReclassificationSuggestion[],
    beweislast: BeweislastCheckResult[]
  ): number {
    let score = 0;

    // High-confidence criminal norms increase risk
    const criminalNorms = norms.filter(n => n.domain === 'criminal');
    for (const n of criminalNorms) {
      score += n.overallScore * 20;
    }

    // Reclassification upgrades increase risk
    const upgrades = reclassifications.filter(r => r.direction === 'upgrade');
    score += upgrades.length * 15;

    // Beweislast gaps increase risk
    const totalGaps = beweislast.reduce((s, b) => s + b.identifiedGaps.length, 0);
    score += totalGaps * 5;

    // § 129 (kriminelle Vereinigung) significantly increases risk
    const org129 = norms.find(n => n.normId === 'stgb-129');
    if (org129 && org129.overallScore >= 0.3) {
      score += 25;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  private _riskLevel(score: number): AuditRiskLevel {
    if (score >= 70) return 'critical';
    if (score >= 45) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  private _generateSummary(
    norms: TatbestandsCheckResult[],
    reclassifications: ReclassificationSuggestion[],
    chains: QualificationChainResult[],
    beweislast: BeweislastCheckResult[],
    riskLevel: AuditRiskLevel
  ): string {
    const parts: string[] = [];

    const riskLabel: Record<AuditRiskLevel, string> = {
      low: 'Niedriges Risiko',
      medium: 'Mittleres Risiko',
      high: 'Hohes Risiko',
      critical: 'Kritisches Risiko',
    };
    parts.push(`Aktenaudit: ${riskLabel[riskLevel]}.`);

    const highConf = norms.filter(n => n.overallScore >= 0.5);
    if (highConf.length > 0) {
      parts.push(
        `${highConf.length} Norm(en) mit hoher Konfidenz erkannt: ${highConf.slice(0, 3).map(n => `${n.law} ${n.paragraph}`).join(', ')}.`
      );
    }

    if (reclassifications.length > 0) {
      const upgrades = reclassifications.filter(r => r.direction === 'upgrade');
      const alternatives = reclassifications.filter(r => r.direction === 'alternative');
      if (upgrades.length > 0) {
        parts.push(`${upgrades.length} Qualifikations-Upgrade(s) vorgeschlagen.`);
      }
      if (alternatives.length > 0) {
        parts.push(`${alternatives.length} alternative Einordnung(en) geprüft.`);
      }
    }

    if (chains.length > 0) {
      parts.push(`${chains.length} Qualifikationskette(n) analysiert.`);
    }

    const totalGaps = beweislast.reduce((s, b) => s + b.identifiedGaps.length, 0);
    if (totalGaps > 0) {
      parts.push(`${totalGaps} Beweislast-Lücke(n) identifiziert.`);
    }

    return parts.join(' ');
  }

  // ─── Conversion to LegalFindings ──────────────────────────────────────

  /**
   * Convert audit reclassifications to LegalFindings for persistence.
   */
  toFindings(audit: CaseAuditResult): import('../types').LegalFinding[] {
    const now = new Date().toISOString();
    const findings: import('../types').LegalFinding[] = [];

    // Reclassification suggestions → high-priority findings
    for (const reclass of audit.reclassifications) {
      findings.push({
        id: `audit-reclass:${reclass.id}`,
        caseId: audit.caseId,
        workspaceId: audit.workspaceId,
        type: reclass.direction === 'upgrade' ? 'norm_error' : 'norm_suggestion',
        title: `Reklassifizierung: ${reclass.currentNormTitle} → ${reclass.suggestedNormTitle}`,
        description: reclass.reason,
        severity: reclass.direction === 'upgrade' ? 'critical' : 'high',
        confidence: reclass.confidence,
        sourceDocumentIds: audit.auditedDocumentIds,
        citations: [{
          documentId: audit.auditedDocumentIds[0] ?? '',
          quote: `Indikatoren: ${reclass.triggeredByIndicators.slice(0, 5).join(', ')}`,
        }],
        createdAt: now,
        updatedAt: now,
      });
    }

    // Beweislast gaps → medium findings
    for (const bew of audit.beweislastAnalysis) {
      if (bew.identifiedGaps.length > 0) {
        findings.push({
          id: `audit-beweislast:${bew.normId}:${Date.now().toString(36)}`,
          caseId: audit.caseId,
          workspaceId: audit.workspaceId,
          type: 'evidence_gap',
          title: `Beweislast-Lücken: ${bew.normTitle}`,
          description: `${bew.burdenDescription}. Lücken: ${bew.identifiedGaps.join('; ')}`,
          severity: 'medium',
          confidence: 0.7,
          sourceDocumentIds: audit.auditedDocumentIds,
          citations: [],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return findings;
  }
}
