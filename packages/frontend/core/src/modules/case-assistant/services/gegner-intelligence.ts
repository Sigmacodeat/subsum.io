import { Service } from '@toeverything/infra';

import type {
  GegnerIntelligenceSnapshot,
  GegnerKanzleiProfile,
  GegnerProfileSource,
  GegnerStrategyPattern,
  GegnerStrategyType,
  LegalDocumentRecord,
  LegalFinding,
  OpposingParty,
  RichterProfile,
  RichterTendency,
  RichterTendencyArea,
  SemanticChunk,
} from '../types';
import type { CaseAssistantStore } from '../stores/case-assistant';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

const STRATEGY_LABELS: Record<GegnerStrategyType, string> = {
  aggressive_litigation: 'Aggressive Prozessführung',
  settlement_oriented: 'Vergleichsorientiert',
  procedural_delay: 'Verfahrensverzögerung',
  evidence_challenge: 'Beweis-Anfechtung',
  norm_reinterpretation: 'Norm-Neuinterpretation',
  emotional_appeal: 'Emotionale Argumentation',
  cost_pressure: 'Kostendruck-Strategie',
  technical_defense: 'Technische Verteidigung',
  jurisdictional_challenge: 'Zuständigkeitsrüge',
  other: 'Sonstige',
};

const TENDENCY_LABELS: Record<RichterTendencyArea, string> = {
  beweislast: 'Beweislast-Handhabung',
  vergleichsbereitschaft: 'Vergleichsbereitschaft',
  prozessfuehrung: 'Prozessführungsstil',
  fristenstrenge: 'Fristenstrenge',
  parteivortrag: 'Umgang mit Parteivortrag',
  gutachten: 'Gutachten-Nutzung',
  kosten: 'Kostenentscheidung',
};

export { STRATEGY_LABELS as GEGNER_STRATEGY_LABELS, TENDENCY_LABELS as RICHTER_TENDENCY_LABELS };

export class GegnerIntelligenceService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly orchestration: CasePlatformOrchestrationService
  ) {
    super();
  }

  readonly gegnerProfiles$ = this.store.watchGegnerProfiles();
  readonly richterProfiles$ = this.store.watchRichterProfiles();

  // ═══════════════════════════════════════════════════════════════════════════
  // GEGNER KANZLEI PROFILE CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  getGegnerProfiles(): GegnerKanzleiProfile[] {
    return this.store.getGegnerProfiles();
  }

  getGegnerProfile(profileId: string): GegnerKanzleiProfile | null {
    return this.store.getGegnerProfiles().find(p => p.id === profileId) ?? null;
  }

  findGegnerByFirmName(firmName: string): GegnerKanzleiProfile | null {
    const lower = firmName.toLowerCase().trim();
    return this.store.getGegnerProfiles().find(
      p => p.firmName.toLowerCase().includes(lower) || lower.includes(p.firmName.toLowerCase())
    ) ?? null;
  }

  upsertGegnerProfile(profile: GegnerKanzleiProfile): void {
    const profiles = this.store.getGegnerProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = { ...profile, updatedAt: new Date().toISOString() };
    } else {
      profiles.unshift(profile);
    }
    this.store.setGegnerProfiles(profiles);
  }

  createGegnerProfile(input: {
    firmName: string;
    knownAttorneys?: string[];
    specializations?: string[];
    notes?: string;
    source?: GegnerProfileSource;
  }): GegnerKanzleiProfile {
    const now = new Date().toISOString();
    const profile: GegnerKanzleiProfile = {
      id: createId('gegner'),
      firmName: input.firmName.trim(),
      knownAttorneys: input.knownAttorneys ?? [],
      specializations: input.specializations ?? [],
      strategyPatterns: [],
      argumentPatterns: [],
      aggressivenessScore: 0.5,
      settlementTendency: 0.5,
      delayTendency: 0.3,
      totalEncounters: 0,
      record: { wins: 0, losses: 0, settlements: 0, pending: 0 },
      avgCaseDurationDays: 0,
      preferredCourts: [],
      preferredNorms: [],
      notes: input.notes ?? '',
      sources: [input.source ?? 'manual_entry'],
      encounterCaseIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.upsertGegnerProfile(profile);
    return profile;
  }

  deleteGegnerProfile(profileId: string): boolean {
    const profiles = this.store.getGegnerProfiles();
    const filtered = profiles.filter(p => p.id !== profileId);
    if (filtered.length === profiles.length) return false;
    this.store.setGegnerProfiles(filtered);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RICHTER PROFILE CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  getRichterProfiles(): RichterProfile[] {
    return this.store.getRichterProfiles();
  }

  getRichterProfile(profileId: string): RichterProfile | null {
    return this.store.getRichterProfiles().find(p => p.id === profileId) ?? null;
  }

  findRichterByName(name: string): RichterProfile | null {
    const lower = name.toLowerCase().trim();
    return this.store.getRichterProfiles().find(
      p => p.name.toLowerCase().includes(lower)
    ) ?? null;
  }

  upsertRichterProfile(profile: RichterProfile): void {
    const profiles = this.store.getRichterProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = { ...profile, updatedAt: new Date().toISOString() };
    } else {
      profiles.unshift(profile);
    }
    this.store.setRichterProfiles(profiles);
  }

  createRichterProfile(input: {
    name: string;
    court: string;
    senate?: string;
    legalAreas?: string[];
    notes?: string;
  }): RichterProfile {
    const now = new Date().toISOString();
    const profile: RichterProfile = {
      id: createId('richter'),
      name: input.name.trim(),
      court: input.court.trim(),
      senate: input.senate ?? '',
      legalAreas: input.legalAreas ?? [],
      tendencies: [],
      totalCasesObserved: 0,
      plaintiffFavorableRate: 0.5,
      settlementEncouragement: 0.5,
      deadlineStrictness: 0.5,
      evidenceThoroughness: 0.5,
      preferredArgumentStyles: [],
      pitfalls: [],
      notableDecisionRefs: [],
      sourceCaseIds: [],
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
    };
    this.upsertRichterProfile(profile);
    return profile;
  }

  deleteRichterProfile(profileId: string): boolean {
    const profiles = this.store.getRichterProfiles();
    const filtered = profiles.filter(p => p.id !== profileId);
    if (filtered.length === profiles.length) return false;
    this.store.setRichterProfiles(filtered);
    return true;
  }

  addRichterTendency(profileId: string, tendency: RichterTendency): void {
    const profile = this.getRichterProfile(profileId);
    if (!profile) return;
    const existing = profile.tendencies.findIndex(t => t.area === tendency.area);
    if (existing >= 0) {
      const old = profile.tendencies[existing];
      profile.tendencies[existing] = {
        ...tendency,
        observationCount: old.observationCount + tendency.observationCount,
        strength: (old.strength + tendency.strength) / 2,
      };
    } else {
      profile.tendencies.push(tendency);
    }
    this.upsertRichterProfile(profile);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PATTERN EXTRACTION — From case documents and findings
  // ═══════════════════════════════════════════════════════════════════════════

  async extractGegnerPatternsFromCase(input: {
    caseId: string;
    workspaceId: string;
    gegnerProfileId: string;
  }): Promise<{ strategiesAdded: number; argumentsAdded: number }> {
    const profile = this.getGegnerProfile(input.gegnerProfileId);
    if (!profile) return { strategiesAdded: 0, argumentsAdded: 0 };

    const docs = await this.store.getLegalDocuments();
    const findings = await this.store.getLegalFindings();
    const chunks = await this.store.getSemanticChunks();

    const caseDocs = docs.filter(
      (d: LegalDocumentRecord) => d.caseId === input.caseId && d.workspaceId === input.workspaceId
    );
    const caseFindings = findings.filter(
      (f: LegalFinding) => f.caseId === input.caseId && f.workspaceId === input.workspaceId
    );
    const caseChunks = chunks.filter(
      (c: SemanticChunk) => c.caseId === input.caseId && c.workspaceId === input.workspaceId
    );

    let strategiesAdded = 0;
    let argumentsAdded = 0;
    const now = new Date().toISOString();

    // Extract strategies from findings
    for (const finding of caseFindings) {
      const strategyType = this.inferStrategyFromFinding(finding);
      if (strategyType) {
        const existingPattern = profile.strategyPatterns.find(
          p => p.type === strategyType
        );
        if (existingPattern) {
          existingPattern.observationCount++;
          existingPattern.lastObservedAt = now;
          if (!existingPattern.sourceCaseIds.includes(input.caseId)) {
            existingPattern.sourceCaseIds.push(input.caseId);
          }
        } else {
          profile.strategyPatterns.push({
            id: createId('gsp'),
            type: strategyType,
            description: `${STRATEGY_LABELS[strategyType]} — erkannt aus Finding: ${finding.title}`,
            normReferences: this.extractNormRefsFromText(finding.title + ' ' + finding.description),
            observationCount: 1,
            opponentSuccessRate: 0.5,
            counterStrategies: this.suggestCounterStrategies(strategyType),
            sourceCaseIds: [input.caseId],
            firstObservedAt: now,
            lastObservedAt: now,
          });
          strategiesAdded++;
        }
      }
    }

    // Extract argument patterns from opposing-party-authored chunks
    const gegnerChunks = caseChunks.filter(
      (c: SemanticChunk) => c.category === 'antrag' || c.category === 'rechtsausfuehrung' || c.category === 'korrespondenz'
    );

    for (const chunk of gegnerChunks.slice(0, 15)) {
      const normRefs = chunk.extractedEntities?.legalRefs ?? [];
      if (normRefs.length === 0 && chunk.text.length < 100) continue;

      const argText = chunk.text.slice(0, 300).trim();
      const existingArg = profile.argumentPatterns.find(
        a => this.textSimilarity(a.argument, argText) > 0.5
      );

      if (!existingArg) {
        profile.argumentPatterns.push({
          argument: argText,
          normReferences: normRefs,
          legalDomain: this.inferDomainFromNorms(normRefs),
          frequency: 1,
          effectiveness: 0.5,
          knownWeaknesses: [],
        });
        argumentsAdded++;
      } else {
        existingArg.frequency++;
      }
    }

    // Update encounter stats
    if (!profile.encounterCaseIds.includes(input.caseId)) {
      profile.encounterCaseIds.push(input.caseId);
      profile.totalEncounters = profile.encounterCaseIds.length;
    }

    // Extract preferred norms
    const normSet = new Set(profile.preferredNorms);
    for (const doc of caseDocs) {
      for (const ref of doc.paragraphReferences ?? []) {
        normSet.add(ref);
      }
    }
    profile.preferredNorms = Array.from(normSet);

    // Recalculate aggregate scores
    this.recalculateProfileScores(profile);

    this.upsertGegnerProfile(profile);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'gegner.intelligence.extract',
      severity: 'info',
      details: `Gegner-Profil "${profile.firmName}" aktualisiert: +${strategiesAdded} Strategien, +${argumentsAdded} Argumente`,
    });

    return { strategiesAdded, argumentsAdded };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-MATCH — Find opponent profile from OpposingParty
  // ═══════════════════════════════════════════════════════════════════════════

  autoMatchGegnerProfile(opposingParties: OpposingParty[]): GegnerKanzleiProfile | null {
    for (const party of opposingParties) {
      if (party.lawFirm) {
        const match = this.findGegnerByFirmName(party.lawFirm);
        if (match) return match;
      }
      if (party.legalRepresentative) {
        const profiles = this.store.getGegnerProfiles();
        const match = profiles.find(p =>
          p.knownAttorneys.some(a =>
            a.toLowerCase().includes(party.legalRepresentative!.toLowerCase())
          )
        );
        if (match) return match;
      }
    }
    return null;
  }

  autoMatchRichterProfile(gericht?: string): RichterProfile | null {
    if (!gericht) return null;
    const lower = gericht.toLowerCase();
    return this.store.getRichterProfiles().find(
      p => p.court.toLowerCase().includes(lower) || lower.includes(p.court.toLowerCase())
    ) ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE SNAPSHOT — For Chat Context Injection
  // ═══════════════════════════════════════════════════════════════════════════

  buildIntelligenceSnapshot(input: {
    gegnerProfileId?: string;
    richterProfileId?: string;
    opposingParties?: OpposingParty[];
    gericht?: string;
  }): GegnerIntelligenceSnapshot {
    let firmProfile: GegnerKanzleiProfile | null = null;
    let richterProfile: RichterProfile | null = null;

    if (input.gegnerProfileId) {
      firmProfile = this.getGegnerProfile(input.gegnerProfileId);
    }
    if (!firmProfile && input.opposingParties?.length) {
      firmProfile = this.autoMatchGegnerProfile(input.opposingParties);
    }

    if (input.richterProfileId) {
      richterProfile = this.getRichterProfile(input.richterProfileId);
    }
    if (!richterProfile && input.gericht) {
      richterProfile = this.autoMatchRichterProfile(input.gericht);
    }

    const topStrategies = firmProfile
      ? [...firmProfile.strategyPatterns]
          .sort((a, b) => b.observationCount - a.observationCount)
          .slice(0, 5)
      : [];

    const topArguments = firmProfile
      ? [...firmProfile.argumentPatterns]
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 5)
      : [];

    const counterRecommendations = this.buildCounterRecommendations(firmProfile, topStrategies);
    const richterAdvice = this.buildRichterAdvice(richterProfile);

    return {
      firmProfile,
      richterProfile,
      topStrategies,
      topArguments,
      counterRecommendations,
      richterAdvice,
      generatedAt: new Date().toISOString(),
    };
  }

  intelligenceSnapshotToPrompt(snapshot: GegnerIntelligenceSnapshot): string {
    const parts: string[] = [];

    if (snapshot.firmProfile) {
      const fp = snapshot.firmProfile;
      parts.push(`\n═══ GEGNER-PROFIL: ${fp.firmName} ═══`);
      parts.push(`Begegnungen: ${fp.totalEncounters} Fälle`);
      parts.push(`Bilanz: ${fp.record.wins}W / ${fp.record.losses}L / ${fp.record.settlements}V / ${fp.record.pending}P`);
      parts.push(`Aggressivität: ${(fp.aggressivenessScore * 100).toFixed(0)}%`);
      parts.push(`Vergleichsbereitschaft: ${(fp.settlementTendency * 100).toFixed(0)}%`);
      parts.push(`Verzögerungstaktik: ${(fp.delayTendency * 100).toFixed(0)}%`);

      if (fp.knownAttorneys.length > 0) {
        parts.push(`Bekannte Anwälte: ${fp.knownAttorneys.join(', ')}`);
      }
      if (fp.specializations.length > 0) {
        parts.push(`Spezialisierungen: ${fp.specializations.join(', ')}`);
      }
      if (fp.preferredNorms.length > 0) {
        parts.push(`Bevorzugte Normen: ${fp.preferredNorms.slice(0, 10).join(', ')}`);
      }
    }

    if (snapshot.topStrategies.length > 0) {
      parts.push(`\n--- Bekannte Strategien der Gegenseite ---`);
      for (const s of snapshot.topStrategies) {
        parts.push(`• ${STRATEGY_LABELS[s.type]} (${s.observationCount}x beobachtet, Erfolgsrate: ${(s.opponentSuccessRate * 100).toFixed(0)}%)`);
        parts.push(`  ${s.description}`);
        if (s.counterStrategies.length > 0) {
          parts.push(`  → Gegenmaßnahmen: ${s.counterStrategies.join('; ')}`);
        }
      }
    }

    if (snapshot.topArguments.length > 0) {
      parts.push(`\n--- Wiederkehrende Argumente der Gegenseite ---`);
      for (const a of snapshot.topArguments) {
        parts.push(`• [${a.legalDomain}] "${a.argument.slice(0, 150)}…" (${a.frequency}x)`);
        if (a.knownWeaknesses.length > 0) {
          parts.push(`  Schwachstellen: ${a.knownWeaknesses.join('; ')}`);
        }
      }
    }

    if (snapshot.counterRecommendations.length > 0) {
      parts.push(`\n--- Empfohlene Gegenstrategien ---`);
      for (const r of snapshot.counterRecommendations) {
        parts.push(`→ ${r}`);
      }
    }

    if (snapshot.richterProfile) {
      const rp = snapshot.richterProfile;
      parts.push(`\n═══ RICHTER-PROFIL: ${rp.name} (${rp.court}${rp.senate ? `, ${rp.senate}` : ''}) ═══`);
      parts.push(`Beobachtete Fälle: ${rp.totalCasesObserved}`);
      parts.push(`Kläger-Freundlichkeit: ${(rp.plaintiffFavorableRate * 100).toFixed(0)}%`);
      parts.push(`Vergleichsdrang: ${(rp.settlementEncouragement * 100).toFixed(0)}%`);
      parts.push(`Fristenstrenge: ${(rp.deadlineStrictness * 100).toFixed(0)}%`);
      parts.push(`Beweis-Gründlichkeit: ${(rp.evidenceThoroughness * 100).toFixed(0)}%`);

      if (rp.tendencies.length > 0) {
        parts.push(`\nTendenzen:`);
        for (const t of rp.tendencies) {
          parts.push(`  • ${TENDENCY_LABELS[t.area]}: ${t.description} (Stärke: ${(t.strength * 100).toFixed(0)}%, ${t.observationCount}x beobachtet)`);
        }
      }

      if (rp.preferredArgumentStyles.length > 0) {
        parts.push(`Wirksame Argumentationsstile: ${rp.preferredArgumentStyles.join(', ')}`);
      }
      if (rp.pitfalls.length > 0) {
        parts.push(`⚠️ Zu vermeiden: ${rp.pitfalls.join('; ')}`);
      }
    }

    if (snapshot.richterAdvice.length > 0) {
      parts.push(`\n--- Richter-spezifische Empfehlungen ---`);
      for (const a of snapshot.richterAdvice) {
        parts.push(`→ ${a}`);
      }
    }

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private inferStrategyFromFinding(finding: LegalFinding): GegnerStrategyType | null {
    const text = (finding.title + ' ' + finding.description).toLowerCase();

    if (/verjährung|frist.*versäum|verwirk|unzuläss/i.test(text)) return 'procedural_delay';
    if (/beweis.*unverwertbar|beweisverwertungsverbot|beweis.*anfechtung/i.test(text)) return 'evidence_challenge';
    if (/vergleich|einigung|gütlich|settlement/i.test(text)) return 'settlement_oriented';
    if (/kosten.*druck|prozesskostenrisiko|streitwert.*erhöh/i.test(text)) return 'cost_pressure';
    if (/zuständig|unzuständig|verweis/i.test(text)) return 'jurisdictional_challenge';
    if (/norm.*interpretati|auslegung|teleologisch/i.test(text)) return 'norm_reinterpretation';
    if (/aggressiv|scharf|angriff|vorwurf/i.test(text)) return 'aggressive_litigation';
    if (/technisch|formfehler|formell|mangelhaft/i.test(text)) return 'technical_defense';
    if (/emotional|persönlich|moralisch/i.test(text)) return 'emotional_appeal';

    return null;
  }

  private suggestCounterStrategies(strategyType: GegnerStrategyType): string[] {
    switch (strategyType) {
      case 'aggressive_litigation':
        return ['Sachlich bleiben, Fakten betonen', 'Prozessökonomie-Argument', 'Vorschlag mündliche Verhandlung'];
      case 'settlement_oriented':
        return ['Vergleichsbereitschaft prüfen', 'Eigene Mindestforderung definieren', 'Zeitdruck nutzen'];
      case 'procedural_delay':
        return ['Fristwahrung dokumentieren', 'Beschleunigungsantrag stellen', 'Kosten der Verzögerung beziffern'];
      case 'evidence_challenge':
        return ['Beweiskette lückenlos dokumentieren', 'Zusätzliche Beweismittel sichern', 'Beweislast-Argument vorbereiten'];
      case 'norm_reinterpretation':
        return ['Herrschende Meinung zitieren', 'OGH/BGH-Rechtsprechung anführen', 'Systematische Auslegung darlegen'];
      case 'cost_pressure':
        return ['Prozesskostenhilfe prüfen', 'Streitwert korrekt festsetzen lassen', 'Teilklage erwägen'];
      case 'technical_defense':
        return ['Formelle Voraussetzungen doppelt prüfen', 'Heilungsmöglichkeiten nutzen', 'Sachliche Argumentation in den Vordergrund'];
      case 'jurisdictional_challenge':
        return ['Zuständigkeit vorab sichern', 'Hilfsweise Verweisung beantragen', 'Forum Shopping prüfen'];
      case 'emotional_appeal':
        return ['Auf Sachebene zurückführen', 'Objektive Fakten betonen', 'Richter auf Rechtsfragen fokussieren'];
      default:
        return ['Gegnerische Position genau analysieren', 'Schwachstellen identifizieren'];
    }
  }

  private buildCounterRecommendations(
    profile: GegnerKanzleiProfile | null,
    topStrategies: GegnerStrategyPattern[]
  ): string[] {
    if (!profile) return [];
    const recommendations: string[] = [];

    if (profile.aggressivenessScore > 0.7) {
      recommendations.push('Gegner neigt zu aggressiver Prozessführung — sachlich, strukturiert und faktenbasiert reagieren.');
    }
    if (profile.settlementTendency > 0.6) {
      recommendations.push('Gegner ist vergleichsbereit — frühzeitig Vergleichsangebot prüfen, eigene Position klar definieren.');
    }
    if (profile.delayTendency > 0.5) {
      recommendations.push('Gegner verzögert typischerweise — Beschleunigungsantrag vorbereiten, Fristen dokumentieren.');
    }

    for (const strategy of topStrategies.slice(0, 3)) {
      if (strategy.counterStrategies.length > 0) {
        recommendations.push(`Gegen "${STRATEGY_LABELS[strategy.type]}": ${strategy.counterStrategies[0]}`);
      }
    }

    return recommendations;
  }

  private buildRichterAdvice(profile: RichterProfile | null): string[] {
    if (!profile) return [];
    const advice: string[] = [];

    if (profile.settlementEncouragement > 0.7) {
      advice.push('Richter drängt auf Vergleich — vorbereitet sein, Vergleichsrahmen kennen.');
    }
    if (profile.deadlineStrictness > 0.7) {
      advice.push('Richter ist sehr streng bei Fristen — keine Fristverlängerung erwarten, pünktlich einreichen.');
    }
    if (profile.evidenceThoroughness > 0.7) {
      advice.push('Richter prüft Beweise gründlich — Beweiskette lückenlos aufbereiten.');
    }
    if (profile.plaintiffFavorableRate > 0.65) {
      advice.push('Richter entscheidet tendenziell klägerfreundlich — als Kläger Fakten klar präsentieren.');
    }
    if (profile.plaintiffFavorableRate < 0.35) {
      advice.push('Richter entscheidet tendenziell beklagtenfreundlich — als Kläger besonders überzeugend argumentieren.');
    }

    for (const tendency of profile.tendencies) {
      if (tendency.strength > 0.6) {
        advice.push(`${TENDENCY_LABELS[tendency.area]}: ${tendency.description}`);
      }
    }

    if (profile.preferredArgumentStyles.length > 0) {
      advice.push(`Wirksame Stile bei diesem Richter: ${profile.preferredArgumentStyles.join(', ')}`);
    }
    if (profile.pitfalls.length > 0) {
      advice.push(`Vermeiden: ${profile.pitfalls.join('; ')}`);
    }

    return advice;
  }

  private recalculateProfileScores(profile: GegnerKanzleiProfile): void {
    const strategies = profile.strategyPatterns;
    if (strategies.length === 0) return;

    const totalObs = strategies.reduce((s, p) => s + p.observationCount, 0);
    if (totalObs === 0) return;

    let aggrScore = 0;
    let settleScore = 0;
    let delayScore = 0;

    for (const s of strategies) {
      const weight = s.observationCount / totalObs;
      if (s.type === 'aggressive_litigation' || s.type === 'cost_pressure') {
        aggrScore += weight;
      }
      if (s.type === 'settlement_oriented') {
        settleScore += weight;
      }
      if (s.type === 'procedural_delay') {
        delayScore += weight;
      }
    }

    profile.aggressivenessScore = Math.min(1, aggrScore + 0.3);
    profile.settlementTendency = Math.min(1, settleScore + 0.2);
    profile.delayTendency = Math.min(1, delayScore + 0.1);
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    return intersection / Math.max(wordsA.size, wordsB.size);
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

  private inferDomainFromNorms(normRefs: string[]): string {
    for (const n of normRefs) {
      if (/bgb|abgb/i.test(n)) return 'zivilrecht';
      if (/stgb|stpo/i.test(n)) return 'strafrecht';
      if (/zpo/i.test(n)) return 'prozessrecht';
      if (/avg|vwgvg/i.test(n)) return 'verwaltungsrecht';
      if (/hgb|ugb/i.test(n)) return 'handelsrecht';
      if (/inso/i.test(n)) return 'insolvenzrecht';
    }
    return 'allgemein';
  }
}
