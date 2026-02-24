import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type {
  InstanzHistorie,
  InstanzLevel,
  Verfahrensphase,
  VerfahrensstandRecord,
} from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export const VERFAHRENSPHASE_LABELS: Record<Verfahrensphase, string> = {
  vorverfahrenlich: 'Vorverfahrenlich',
  klage_eingereicht: 'Klage eingereicht',
  klage_zugestellt: 'Klage zugestellt',
  klageerwiderung: 'Klageerwiderung',
  beweisaufnahme: 'Beweisaufnahme',
  muendliche_verhandlung: 'Mündliche Verhandlung',
  urteil: 'Urteil',
  berufung: 'Berufung',
  berufungsverhandlung: 'Berufungsverhandlung',
  berufungsurteil: 'Berufungsurteil',
  revision: 'Revision',
  revisionsurteil: 'Revisionsurteil',
  vollstreckung: 'Vollstreckung',
  abgeschlossen: 'Abgeschlossen',
  vergleich: 'Vergleich',
  zurueckgewiesen: 'Zurückgewiesen',
};

export const INSTANZ_LABELS: Record<InstanzLevel, string> = {
  erste: '1. Instanz',
  zweite: '2. Instanz',
  dritte: '3. Instanz',
  vierte: '4. Instanz',
};

export class VerfahrensstandService extends Service {
  private verfahrensstandMap$ = new BehaviorSubject<Record<string, VerfahrensstandRecord>>({});
  private instanzHistorieMap$ = new BehaviorSubject<Record<string, InstanzHistorie>>({});

  readonly verfahrensstandList$ = this.verfahrensstandMap$.pipe(
    map(map => Object.values(map))
  );

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  getVerfahrensstandForMatter(matterId: string): VerfahrensstandRecord | undefined {
    const list = this.verfahrensstandMap$.value;
    return Object.values(list).find(v => v.matterId === matterId && !v.completedAt);
  }

  getVerfahrensstandHistory(matterId: string): VerfahrensstandRecord[] {
    const list = this.verfahrensstandMap$.value;
    return Object.values(list)
      .filter(v => v.matterId === matterId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getInstanzHistorie(matterId: string): InstanzHistorie | undefined {
    return this.instanzHistorieMap$.value[matterId];
  }

  async createVerfahrensstand(input: {
    workspaceId: string;
    caseId: string;
    matterId: string;
    phase: Verfahrensphase;
    instanz: InstanzLevel;
    gericht?: string;
    aktenzeichen?: string;
    richter?: string;
    expectedEndAt?: string;
    notes?: string;
  }): Promise<VerfahrensstandRecord> {
    const now = new Date().toISOString();

    const record: VerfahrensstandRecord = {
      id: createId('vstand'),
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      caseId: input.caseId,
      phase: input.phase,
      instanz: input.instanz,
      gericht: input.gericht,
      aktenzeichen: input.aktenzeichen,
      richter: input.richter,
      startedAt: now,
      expectedEndAt: input.expectedEndAt,
      notes: input.notes,
      linkedDocumentIds: [],
      linkedDeadlineIds: [],
      createdAt: now,
      updatedAt: now,
    };

    this.verfahrensstandMap$.next({
      ...this.verfahrensstandMap$.value,
      [record.id]: record,
    });

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'verfahrensstand.created',
      severity: 'info',
      details: `Verfahrensstand erstellt: ${VERFAHRENSPHASE_LABELS[input.phase]} (${INSTANZ_LABELS[input.instanz]})`,
      metadata: {
        phase: input.phase,
        instanz: input.instanz,
        gericht: input.gericht ?? '',
      },
    });

    return record;
  }

  async advancePhase(
    entryId: string,
    newPhase: Verfahrensphase,
    notes?: string
  ): Promise<VerfahrensstandRecord | null> {
    const existing = this.verfahrensstandMap$.value[entryId];
    if (!existing) return null;

    const now = new Date().toISOString();

    // Complete current phase
    const completed: VerfahrensstandRecord = {
      ...existing,
      completedAt: now,
      notes: notes ?? existing.notes,
      updatedAt: now,
    };

    // Create new phase entry
    const newRecord: VerfahrensstandRecord = {
      ...existing,
      id: createId('vstand'),
      phase: newPhase,
      startedAt: now,
      completedAt: undefined,
      notes: notes,
      createdAt: now,
      updatedAt: now,
    };

    const updatedMap = { ...this.verfahrensstandMap$.value };
    updatedMap[entryId] = completed;
    updatedMap[newRecord.id] = newRecord;

    this.verfahrensstandMap$.next(updatedMap);

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: 'verfahrensstand.advanced',
      severity: 'info',
      details: `Verfahrensstand geändert: ${VERFAHRENSPHASE_LABELS[existing.phase]} → ${VERFAHRENSPHASE_LABELS[newPhase]}`,
      metadata: {
        oldPhase: existing.phase,
        newPhase,
      },
    });

    return newRecord;
  }

  async advanceInstanz(
    matterId: string,
    newInstanz: InstanzLevel,
    gericht: string,
    aktenzeichen: string
  ): Promise<VerfahrensstandRecord | null> {
    const current = this.getVerfahrensstandForMatter(matterId);
    if (!current) return null;

    const now = new Date().toISOString();

    // Complete current instance
    await this.advancePhase(current.id, 'urteil', `Instanzabschluss: ${INSTANZ_LABELS[current.instanz]}`);

    // Create new instance
    const newRecord = await this.createVerfahrensstand({
      workspaceId: current.workspaceId,
      caseId: current.caseId,
      matterId,
      phase: 'berufung',
      instanz: newInstanz,
      gericht,
      aktenzeichen,
    });

    // Update instanz historie
    const historie = this.getInstanzHistorie(matterId);
    const historieEntry = {
      level: current.instanz,
      verfahrensstandId: current.id,
      gericht: current.gericht ?? '',
      aktenzeichen: current.aktenzeichen ?? '',
      startedAt: current.startedAt,
      endedAt: now,
      ergebnis: 'Instanzabschluss',
    };

    const updatedHistorie: InstanzHistorie = {
      id: historie?.id ?? createId('ihist'),
      workspaceId: current.workspaceId,
      matterId,
      instanzen: historie ? [...historie.instanzen, historieEntry] : [historieEntry],
      createdAt: historie?.createdAt ?? now,
      updatedAt: now,
    };

    this.instanzHistorieMap$.next({
      ...this.instanzHistorieMap$.value,
      [matterId]: updatedHistorie,
    });

    return newRecord;
  }

  async linkDocument(entryId: string, documentId: string): Promise<void> {
    const existing = this.verfahrensstandMap$.value[entryId];
    if (!existing) return;

    const updated: VerfahrensstandRecord = {
      ...existing,
      linkedDocumentIds: [...existing.linkedDocumentIds, documentId],
      updatedAt: new Date().toISOString(),
    };

    this.verfahrensstandMap$.next({
      ...this.verfahrensstandMap$.value,
      [entryId]: updated,
    });
  }

  async linkDeadline(entryId: string, deadlineId: string): Promise<void> {
    const existing = this.verfahrensstandMap$.value[entryId];
    if (!existing) return;

    const updated: VerfahrensstandRecord = {
      ...existing,
      linkedDeadlineIds: [...existing.linkedDeadlineIds, deadlineId],
      updatedAt: new Date().toISOString(),
    };

    this.verfahrensstandMap$.next({
      ...this.verfahrensstandMap$.value,
      [entryId]: updated,
    });
  }

  getActivePhasesByInstanz(instanz: InstanzLevel): VerfahrensstandRecord[] {
    return Object.values(this.verfahrensstandMap$.value).filter(
      v => v.instanz === instanz && !v.completedAt
    );
  }

  getPhasesNeedingAttention(): VerfahrensstandRecord[] {
    const now = new Date();
    return Object.values(this.verfahrensstandMap$.value).filter(v => {
      if (v.completedAt) return false;
      if (v.expectedEndAt && new Date(v.expectedEndAt) < now) return true;
      return false;
    });
  }
}
