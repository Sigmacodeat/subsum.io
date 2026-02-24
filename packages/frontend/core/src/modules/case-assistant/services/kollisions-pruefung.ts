import { Service } from '@toeverything/infra';

import type { ClientRecord, KollisionsCheckResult, KollisionsRolle, KollisionsTreffer, MatterRecord } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export class KollisionsPruefungService extends Service {
  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  /**
   * Führt eine Kollisionsprüfung für einen gegebenen Suchbegriff durch.
   * Sucht in Mandanten, Gegnern und Beteiligten über alle Akten hinweg.
   */
  async checkKollision(query: string, currentMatterId?: string): Promise<KollisionsCheckResult> {
    if (!query || query.trim().length < 3) {
      return {
        query,
        timestamp: new Date().toISOString(),
        treffer: [],
        isClean: true,
      };
    }

    const normalizedQuery = query.toLowerCase().trim();
    const queryParts = normalizedQuery.split(/\s+/);
    const treffer: KollisionsTreffer[] = [];

    const graph = await this.orchestration.getGraph();
    const matters: MatterRecord[] = Object.values(graph.matters ?? {});
    const clients: ClientRecord[] = Object.values(graph.clients ?? {});
    const caseIdByMatterId = new Map<string, string>();
    for (const caseRecord of Object.values(graph.cases ?? {})) {
      if (caseRecord.matterId) {
        caseIdByMatterId.set(caseRecord.matterId, caseRecord.id);
      }
    }

    // 1. Suche in Mandanten (Clients)
    for (const client of clients) {
      const matchScore = this.calculateMatchScore(client.displayName, normalizedQuery, queryParts);
      if (matchScore > 0) {
        // Finde alle Akten, in denen dieser Mandant involviert ist
        const relatedMatters = matters.filter((m) =>
          (m.clientIds ?? [m.clientId]).includes(client.id)
        );

        for (const matter of relatedMatters) {
          // Ignoriere die aktuelle Akte, falls wir gerade in ihr arbeiten
          if (currentMatterId && matter.id === currentMatterId) continue;

          treffer.push({
            id: createId('kollision'),
            matchedName: client.displayName,
            matchedRolle: 'mandant',
            matchLevel: this.getMatchLevel(matchScore),
            relatedCaseId: caseIdByMatterId.get(matter.id),
            relatedMatterId: matter.id,
            relatedMatterName: matter.title || matter.externalRef || 'Unbenannte Akte',
            score: matchScore,
          });
        }
      }
    }

    // 2. Suche in Gegnern und Beteiligten (OpposingParties pro Matter)
    for (const matter of matters) {
      if (currentMatterId && matter.id === currentMatterId) continue;

      const opposingParties = matter.opposingParties ?? [];
      for (const party of opposingParties) {
        let nameToMatch = party.displayName || '';
        if (party.lawFirm && !nameToMatch.includes(party.lawFirm)) {
          nameToMatch += ' ' + party.lawFirm;
        }

        const matchScore = this.calculateMatchScore(nameToMatch, normalizedQuery, queryParts);
        if (matchScore > 0) {
          // OpposingPartyKind: 'person' | 'company' | 'authority' | 'other'
          // All opposing parties are treated as 'gegner' by default
          const rolle: KollisionsRolle = 'gegner';

          treffer.push({
            id: createId('kollision'),
            matchedName: party.displayName || party.lawFirm || 'Unbekannt',
            matchedRolle: rolle,
            matchLevel: this.getMatchLevel(matchScore),
            relatedCaseId: caseIdByMatterId.get(matter.id),
            relatedMatterId: matter.id,
            relatedMatterName: matter.title || matter.externalRef || 'Unbenannte Akte',
            score: matchScore,
          });
        }
      }
    }

    // Sortiere nach Score absteigend
    treffer.sort((a, b) => b.score - a.score);

    // Entferne Duplikate (gleicher Name, selbe Akte, selbe Rolle)
    const uniqueTreffer = treffer.filter(
      (t, index, self) =>
        index ===
        self.findIndex(
          (other) =>
            other.matchedName === t.matchedName &&
            other.relatedMatterId === t.relatedMatterId &&
            other.matchedRolle === t.matchedRolle
        )
    );

    const isClean = uniqueTreffer.length === 0 || uniqueTreffer.every((t) => t.matchLevel === 'low');

    return {
      query,
      timestamp: new Date().toISOString(),
      treffer: uniqueTreffer,
      isClean,
    };
  }

  /**
   * Loggt ein Kollisionsprüfungsergebnis in den Audit-Log.
   */
  async logKollisionsCheck(
    workspaceId: string,
    caseId: string,
    _anwaltId: string,
    result: KollisionsCheckResult,
    overridden: boolean,
    overrideReason?: string,
    _matterId?: string
  ): Promise<void> {
    await this.orchestration.appendAuditEntry({
      caseId,
      workspaceId,
      action: overridden ? 'kollisionspruefung.overridden' : 'kollisionspruefung.clean',
      severity: overridden ? 'warning' : 'info',
      details: `Kollisionsprüfung für "${result.query}": ${result.treffer.length} Treffer. ${
        overridden ? `Warnung ignoriert. Grund: ${overrideReason}` : 'Keine kritischen Konflikte.'
      }`,
      metadata: {
        anwaltId: _anwaltId,
        matterId: _matterId ?? '',
        query: result.query,
        trefferCount: String(result.treffer.length),
        isClean: String(result.isClean),
        overridden: String(overridden),
        overrideReason: overrideReason ?? '',
      },
    });
  }

  private calculateMatchScore(target: string, query: string, queryParts: string[]): number {
    if (!target) return 0;
    const normalizedTarget = target.toLowerCase().trim();

    // Exakter Match
    if (normalizedTarget === query) return 100;

    // Enthält kompletten Query String
    if (normalizedTarget.includes(query)) return 80;

    // Check wie viele Teile des Queries enthalten sind (Fuzzy)
    let matchedParts = 0;
    for (const part of queryParts) {
      if (part.length > 2 && normalizedTarget.includes(part)) {
        matchedParts++;
      }
    }

    if (matchedParts > 0 && queryParts.length > 0) {
      const ratio = matchedParts / queryParts.length;
      return Math.round(ratio * 60); // Max 60 for partial matches
    }

    return 0;
  }

  private getMatchLevel(score: number): 'exact' | 'high' | 'medium' | 'low' {
    if (score >= 100) return 'exact';
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
}
