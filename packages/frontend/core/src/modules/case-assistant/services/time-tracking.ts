import { Service } from '@toeverything/infra';

import type { TimeEntry } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function assertPositiveNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} muss eine positive Zahl sein.`);
  }
}

function assertNonNegativeNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} darf nicht negativ sein.`);
  }
}

function assertIsoDate(date: string, field: string) {
  if (!date || Number.isNaN(Date.parse(date))) {
    throw new Error(`${field} muss ein gültiges Datum sein.`);
  }
}

export class TimeTrackingService extends Service {
  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  readonly timeEntries$ = this.orchestration.timeEntries$;

  getTimeEntriesForMatter(matterId: string): TimeEntry[] {
    return (this.timeEntries$.value ?? []).filter(
      (entry: TimeEntry) => entry.matterId === matterId
    );
  }

  getTimeEntriesForClient(clientId: string): TimeEntry[] {
    return (this.timeEntries$.value ?? []).filter(
      (entry: TimeEntry) => entry.clientId === clientId
    );
  }

  getTimeEntriesForAnwalt(anwaltId: string): TimeEntry[] {
    return (this.timeEntries$.value ?? []).filter(
      (entry: TimeEntry) => entry.anwaltId === anwaltId
    );
  }

  getTimeEntriesForCase(caseId: string): TimeEntry[] {
    return (this.timeEntries$.value ?? []).filter(
      (entry: TimeEntry) => entry.caseId === caseId
    );
  }

  getTimeEntriesByDateRange(startDate: string, endDate: string): TimeEntry[] {
    return (this.timeEntries$.value ?? []).filter((entry: TimeEntry) => {
      return entry.date >= startDate && entry.date <= endDate;
    });
  }

  getUnbilledTimeEntries(matterId?: string): TimeEntry[] {
    return (this.timeEntries$.value ?? []).filter((entry: TimeEntry) => {
      if (entry.status !== 'approved') return false;
      if (matterId && entry.matterId !== matterId) return false;
      return !entry.invoiceId;
    });
  }

  async createTimeEntry(input: {
    workspaceId: string;
    caseId: string;
    matterId: string;
    clientId: string;
    anwaltId: string;
    description: string;
    activityType: TimeEntry['activityType'];
    durationMinutes: number;
    hourlyRate: number;
    date: string;
  }): Promise<TimeEntry> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.caseId, 'Case-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.clientId, 'Client-ID');
    assertNonEmpty(input.anwaltId, 'Anwalt-ID');
    assertNonEmpty(input.description, 'Beschreibung');
    assertPositiveNumber(input.durationMinutes, 'Dauer (Minuten)');
    assertNonNegativeNumber(input.hourlyRate, 'Stundensatz');
    assertIsoDate(input.date, 'Datum');

    const now = new Date().toISOString();
    const amount = Math.round((input.durationMinutes / 60) * input.hourlyRate * 100) / 100;

    const entry: TimeEntry = {
      id: createId('time-entry'),
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      matterId: input.matterId,
      clientId: input.clientId,
      anwaltId: input.anwaltId,
      description: input.description,
      activityType: input.activityType,
      durationMinutes: input.durationMinutes,
      hourlyRate: input.hourlyRate,
      amount,
      date: input.date,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertTimeEntry(entry);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'time_entry.created',
      severity: 'info',
      details: `Zeiterfassung erstellt: ${input.durationMinutes} Min für ${input.description}`,
      metadata: {
        duration: String(input.durationMinutes),
        amount: String(amount),
      },
    });

    return entry;
  }

  async updateTimeEntry(entryId: string, updates: Partial<TimeEntry>): Promise<TimeEntry | null> {
    assertNonEmpty(entryId, 'Zeiteintrag-ID');

    if (updates.description !== undefined) {
      assertNonEmpty(updates.description, 'Beschreibung');
    }
    if (updates.durationMinutes !== undefined) {
      assertPositiveNumber(updates.durationMinutes, 'Dauer (Minuten)');
    }
    if (updates.hourlyRate !== undefined) {
      assertNonNegativeNumber(updates.hourlyRate, 'Stundensatz');
    }
    if (updates.date !== undefined) {
      assertIsoDate(updates.date, 'Datum');
    }

    const existing = (this.timeEntries$.value ?? []).find(
      (e: TimeEntry) => e.id === entryId
    );
    if (!existing) return null;

    const updated: TimeEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.durationMinutes !== undefined || updates.hourlyRate !== undefined) {
      const duration = updates.durationMinutes ?? existing.durationMinutes;
      const rate = updates.hourlyRate ?? existing.hourlyRate;
      updated.amount = Math.round((duration / 60) * rate * 100) / 100;
    }

    await this.orchestration.upsertTimeEntry(updated);
    return updated;
  }

  async submitTimeEntry(entryId: string): Promise<TimeEntry | null> {
    return this.updateTimeEntry(entryId, { status: 'submitted' });
  }

  async approveTimeEntry(entryId: string): Promise<TimeEntry | null> {
    return this.updateTimeEntry(entryId, { status: 'approved' });
  }

  async rejectTimeEntry(entryId: string): Promise<TimeEntry | null> {
    return this.updateTimeEntry(entryId, { status: 'rejected' });
  }

  async markAsInvoiced(entryId: string, invoiceId: string): Promise<TimeEntry | null> {
    return this.updateTimeEntry(entryId, { status: 'invoiced', invoiceId });
  }

  async deleteTimeEntry(entryId: string): Promise<boolean> {
    const existing = (this.timeEntries$.value ?? []).find(
      (e: TimeEntry) => e.id === entryId
    );
    if (!existing) return false;

    await this.orchestration.deleteTimeEntry(entryId);
    return true;
  }

  getTotalHoursForMatter(matterId: string): number {
    const entries = this.getTimeEntriesForMatter(matterId);
    return entries.reduce((sum: number, e: TimeEntry) => sum + e.durationMinutes, 0) / 60;
  }

  getTotalAmountForMatter(matterId: string): number {
    const entries = this.getTimeEntriesForMatter(matterId);
    return entries.reduce((sum: number, e: TimeEntry) => sum + e.amount, 0);
  }

  getTotalHoursForAnwaltToday(anwaltId: string): number {
    const today = new Date().toISOString().split('T')[0];
    const entries = (this.timeEntries$.value ?? []).filter(
      (e: TimeEntry) => e.anwaltId === anwaltId && e.date === today
    );
    return entries.reduce((sum: number, e: TimeEntry) => sum + e.durationMinutes, 0) / 60;
  }
}
