import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { Gerichtstermin, LegalDocumentRecord } from '../types';
import type { KalenderService } from './kalender';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export const TERMINART_LABELS: Record<Gerichtstermin['terminart'], string> = {
  muendliche_verhandlung: 'Mündliche Verhandlung',
  beweisaufnahme: 'Beweisaufnahme',
  gutachtentermin: 'Gutachtentermin',
  vergleichstermin: 'Vergleichstermin',
  urteilsverkündung: 'Urteilsverkündung',
  sonstiger: 'Sonstiger Termin',
};

export const TERMIN_STATUS_LABELS: Record<Gerichtstermin['status'], string> = {
  geplant: 'Geplant',
  bestaetigt: 'Bestätigt',
  abgesagt: 'Abgesagt',
  verschoben: 'Verschoben',
  abgeschlossen: 'Abgeschlossen',
};

export class GerichtsterminService extends Service {
  private termineMap$ = new BehaviorSubject<Record<string, Gerichtstermin>>({});
  private lastDocSyncFingerprint = '';

  readonly termineList$ = this.termineMap$.pipe(map(map => Object.values(map)));

  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly kalenderService: KalenderService
  ) {
    super();

    this.orchestration.graph$.subscribe(graph => {
      const next = (graph?.termine ?? {}) as Record<string, Gerichtstermin>;
      this.termineMap$.next(next);
    });

    this.orchestration.legalDocuments$.subscribe(docs => {
      void this.removeOrphanedTermineForCasesWithoutDocuments(docs ?? []);
    });
  }

  private async removeOrphanedTermineForCasesWithoutDocuments(docs: LegalDocumentRecord[]) {
    const docsByCase = new Map<string, number>();
    for (const doc of docs) {
      docsByCase.set(doc.caseId, (docsByCase.get(doc.caseId) ?? 0) + 1);
    }

    const nextFingerprint = [...docsByCase.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([caseId, count]) => `${caseId}:${count}`)
      .join('|');
    if (nextFingerprint === this.lastDocSyncFingerprint) {
      return;
    }
    this.lastDocSyncFingerprint = nextFingerprint;

    const currentMap = this.termineMap$.value;
    const orphaned = Object.values(currentMap).filter(termin => {
      return (docsByCase.get(termin.caseId) ?? 0) === 0;
    });
    if (orphaned.length === 0) {
      return;
    }

    const nextMap = { ...currentMap };
    for (const termin of orphaned) {
      delete nextMap[termin.id];
    }
    this.termineMap$.next(nextMap);

    await Promise.all(
      orphaned.map(termin => this.kalenderService.deleteEventsForSource('gerichtstermin', termin.id))
    );

    const first = orphaned[0];
    await this.orchestration.appendAuditEntry({
      workspaceId: first.workspaceId,
      caseId: first.caseId,
      action: 'gerichtstermin.cleanup.orphaned',
      severity: 'info',
      details: `${orphaned.length} Gerichtstermin(e) entfernt, da keine verknüpften Dokumente mehr vorhanden sind.`,
      metadata: {
        removedCount: String(orphaned.length),
      },
    });
  }

  getTermineForMatter(matterId: string): Gerichtstermin[] {
    return Object.values(this.termineMap$.value)
      .filter(t => t.matterId === matterId)
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
  }

  getUpcomingTermine(days: number = 30): Gerichtstermin[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return Object.values(this.termineMap$.value)
      .filter(t => {
        if (t.status === 'abgesagt' || t.status === 'abgeschlossen') return false;
        const termDate = new Date(t.datum);
        return termDate >= now && termDate <= future;
      })
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
  }

  getPastTermine(): Gerichtstermin[] {
    const now = new Date();
    return Object.values(this.termineMap$.value)
      .filter(t => new Date(t.datum) < now || t.status === 'abgeschlossen')
      .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
  }

  detectConflicts(datum: string, uhrzeit?: string, excludeId?: string): Gerichtstermin[] {
    const conflicts: Gerichtstermin[] = [];
    const targetDate = datum.split('T')[0];

    for (const termin of Object.values(this.termineMap$.value)) {
      if (termin.id === excludeId) continue;
      if (termin.status === 'abgesagt') continue;

      const termDate = termin.datum.split('T')[0];
      if (termDate !== targetDate) continue;

      // Same day - check time overlap if both have times
      if (uhrzeit && termin.uhrzeit) {
        const targetStart = this.timeToMinutes(uhrzeit);
        const targetEnd = targetStart + 120; // Assume 2h default duration
        const termStart = this.timeToMinutes(termin.uhrzeit);
        const termEnd = termStart + (termin.dauerMinuten ?? 120);

        if (targetStart < termEnd && targetEnd > termStart) {
          conflicts.push(termin);
        }
      } else {
        // No time specified - same day is a conflict
        conflicts.push(termin);
      }
    }

    return conflicts;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async createTermin(input: {
    workspaceId: string;
    matterId: string;
    caseId: string;
    verfahrensstandId?: string;
    terminart: Gerichtstermin['terminart'];
    datum: string;
    uhrzeit?: string;
    dauerMinuten?: number;
    gericht: string;
    saal?: string;
    richter?: string;
    berichterstatter?: string;
    teilnehmer: string[];
    notizen?: string;
  }): Promise<Gerichtstermin> {
    const now = new Date().toISOString();

    const termin: Gerichtstermin = {
      id: createId('gterm'),
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      caseId: input.caseId,
      verfahrensstandId: input.verfahrensstandId,
      terminart: input.terminart,
      datum: input.datum,
      uhrzeit: input.uhrzeit,
      dauerMinuten: input.dauerMinuten,
      gericht: input.gericht,
      saal: input.saal,
      richter: input.richter,
      berichterstatter: input.berichterstatter,
      teilnehmer: input.teilnehmer,
      notizen: input.notizen,
      status: 'geplant',
      createdAt: now,
      updatedAt: now,
    };

    const persisted = await this.orchestration.upsertGerichtstermin(termin);
    await this.syncTerminToKalender(persisted);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'gerichtstermin.created',
      severity: 'info',
      details: `Gerichtstermin erstellt: ${TERMINART_LABELS[input.terminart]} am ${input.datum}${input.uhrzeit ? ` um ${input.uhrzeit}` : ''} bei ${input.gericht}`,
      metadata: {
        terminart: input.terminart,
        datum: input.datum,
        gericht: input.gericht,
      },
    });

    return persisted;
  }

  async updateTermin(
    terminId: string,
    updates: Partial<Gerichtstermin>
  ): Promise<Gerichtstermin | null> {
    const existing = this.termineMap$.value[terminId];
    if (!existing) return null;

    const updated: Gerichtstermin = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const persisted = await this.orchestration.upsertGerichtstermin(updated);
    await this.syncTerminToKalender(persisted);
    return persisted;
  }

  async confirmTermin(terminId: string): Promise<Gerichtstermin | null> {
    return this.updateTermin(terminId, { status: 'bestaetigt' });
  }

  async cancelTermin(terminId: string, grund?: string): Promise<Gerichtstermin | null> {
    const existing = this.termineMap$.value[terminId];
    if (!existing) return null;

    return this.updateTermin(terminId, {
      status: 'abgesagt',
      notizen: grund ? `${existing.notizen ?? ''}\nAbgesagt: ${grund}`.trim() : existing.notizen,
    });
  }

  async rescheduleTermin(
    terminId: string,
    newDatum: string,
    newUhrzeit?: string
  ): Promise<Gerichtstermin | null> {
    const existing = this.termineMap$.value[terminId];
    if (!existing) return null;

    const updated = await this.updateTermin(terminId, {
      status: 'verschoben',
      notizen: `${existing.notizen ?? ''}\nVerschoben von ${existing.datum} auf ${newDatum}`.trim(),
    });

    if (!updated) return null;

    // Create new termin
    const newTermin = await this.createTermin({
      workspaceId: existing.workspaceId,
      matterId: existing.matterId,
      caseId: existing.caseId,
      verfahrensstandId: existing.verfahrensstandId,
      terminart: existing.terminart,
      datum: newDatum,
      uhrzeit: newUhrzeit ?? existing.uhrzeit,
      dauerMinuten: existing.dauerMinuten,
      gericht: existing.gericht,
      saal: existing.saal,
      richter: existing.richter,
      berichterstatter: existing.berichterstatter,
      teilnehmer: existing.teilnehmer,
      notizen: `Verschoben von ${existing.datum}`,
    });

    // Link old termin as folgetermin
    await this.updateTermin(terminId, { folgeterminId: newTermin.id });

    return newTermin;
  }

  async completeTermin(
    terminId: string,
    ergebnis: string,
    folgeterminData?: {
      datum: string;
      uhrzeit?: string;
    }
  ): Promise<Gerichtstermin | null> {
    const existing = this.termineMap$.value[terminId];
    if (!existing) return null;

    const updated = await this.updateTermin(terminId, {
      status: 'abgeschlossen',
      ergebnis,
    });

    if (!updated) return null;

    if (folgeterminData) {
      const folgeTermin = await this.createTermin({
        workspaceId: existing.workspaceId,
        matterId: existing.matterId,
        caseId: existing.caseId,
        terminart: existing.terminart,
        datum: folgeterminData.datum,
        uhrzeit: folgeterminData.uhrzeit,
        gericht: existing.gericht,
        teilnehmer: existing.teilnehmer,
      });

      await this.updateTermin(terminId, { folgeterminId: folgeTermin.id });
    }

    return updated;
  }

  async deleteTermin(terminId: string): Promise<boolean> {
    const existing = this.termineMap$.value[terminId];
    if (!existing) return false;
    const ok = await this.orchestration.deleteGerichtstermin(terminId);
    if (!ok) return false;
    await this.kalenderService.deleteEventsForSource('gerichtstermin', terminId);
    return true;
  }

  private async syncTerminToKalender(termin: Gerichtstermin): Promise<void> {
    const isAllDay = !termin.uhrzeit;
    const startAt = termin.uhrzeit
      ? `${termin.datum.split('T')[0]}T${termin.uhrzeit}:00.000Z`
      : termin.datum;

    const statusPrefix =
      termin.status === 'abgesagt'
        ? '❌ '
        : termin.status === 'verschoben'
          ? '↔️ '
          : termin.status === 'abgeschlossen'
            ? '✅ '
            : termin.status === 'bestaetigt'
              ? '📌 '
              : '';

    const descriptionLines = [
      `Status: ${TERMIN_STATUS_LABELS[termin.status] ?? termin.status}`,
      `Gericht: ${termin.gericht}`,
      termin.saal ? `Saal: ${termin.saal}` : '',
      termin.richter ? `Richter: ${termin.richter}` : '',
      termin.teilnehmer.length > 0 ? `Teilnehmer: ${termin.teilnehmer.join(', ')}` : '',
      '',
      termin.notizen ?? '',
      termin.ergebnis ? `Ergebnis: ${termin.ergebnis}` : '',
    ].filter(Boolean);

    await this.kalenderService.upsertEventForSource({
      workspaceId: termin.workspaceId,
      matterId: termin.matterId,
      title: `${statusPrefix}${TERMINART_LABELS[termin.terminart] ?? termin.terminart} — ${termin.gericht}`,
      description: descriptionLines.join('\n'),
      startAt,
      allDay: isAllDay,
      location: termin.saal ? `${termin.gericht} · ${termin.saal}` : termin.gericht,
      reminders: [{ offsetMinutes: 1440 }, { offsetMinutes: 120 }],
      source: 'gerichtstermin',
      sourceId: termin.id,
    });
  }
}
