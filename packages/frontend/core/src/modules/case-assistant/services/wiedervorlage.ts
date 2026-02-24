import { Service } from '@toeverything/infra';

import type { CasePriority, Wiedervorlage } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { KalenderService } from './kalender';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function assertIsoDate(value: string, field: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} muss ein gültiges Datum sein.`);
  }
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) {
    throw new Error(`${field} muss eine positive ganze Zahl sein.`);
  }
}

export class WiedervorlageService extends Service {
  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly kalenderService: KalenderService
  ) {
    super();
  }

  readonly wiedervorlagen$ = this.orchestration.wiedervorlagen$;

  getWiedervorlagenForMatter(matterId: string): Wiedervorlage[] {
    return (this.wiedervorlagen$.value ?? []).filter(
      (wv: Wiedervorlage) => wv.matterId === matterId
    );
  }

  getWiedervorlagenForClient(clientId: string): Wiedervorlage[] {
    return (this.wiedervorlagen$.value ?? []).filter(
      (wv: Wiedervorlage) => wv.clientId === clientId
    );
  }

  getPendingWiedervorlagen(): Wiedervorlage[] {
    return (this.wiedervorlagen$.value ?? []).filter(
      (wv: Wiedervorlage) => wv.status === 'pending'
    );
  }

  getOverdueWiedervorlagen(): Wiedervorlage[] {
    const now = new Date().toISOString();
    return (this.wiedervorlagen$.value ?? []).filter(
      (wv: Wiedervorlage) => wv.status === 'pending' && wv.dueAt < now
    );
  }

  getWiedervorlagenDueSoon(days: number = 7): Wiedervorlage[] {
    assertPositiveInteger(days, 'Tage');

    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();
    const futureStr = future.toISOString();

    return (this.wiedervorlagen$.value ?? []).filter(
      (wv: Wiedervorlage) =>
        wv.status === 'pending' && wv.dueAt >= nowStr && wv.dueAt <= futureStr
    );
  }

  async createWiedervorlage(input: {
    workspaceId: string;
    caseId: string;
    matterId: string;
    clientId: string;
    title: string;
    description?: string;
    dueAt: string;
    assignedAnwaltId?: string;
    priority: CasePriority;
  }): Promise<Wiedervorlage> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.caseId, 'Case-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.clientId, 'Client-ID');
    assertNonEmpty(input.title, 'Titel');
    assertIsoDate(input.dueAt, 'Fälligkeitsdatum');

    const now = new Date().toISOString();

    const wiedervorlage: Wiedervorlage = {
      id: createId('wv'),
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      matterId: input.matterId,
      clientId: input.clientId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      assignedAnwaltId: input.assignedAnwaltId,
      priority: input.priority,
      status: 'pending',
      reminderSent: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertWiedervorlage(wiedervorlage);
    await this.syncWiedervorlageToKalender(wiedervorlage);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'wiedervorlage.created',
      severity: 'info',
      details: `Wiedervorlage erstellt: ${input.title} fällig am ${input.dueAt}`,
      metadata: {
        dueAt: input.dueAt,
        priority: input.priority,
      },
    });

    return wiedervorlage;
  }

  async updateWiedervorlage(
    entryId: string,
    updates: Partial<Wiedervorlage>
  ): Promise<Wiedervorlage | null> {
    assertNonEmpty(entryId, 'Wiedervorlage-ID');
    if (updates.title !== undefined) {
      assertNonEmpty(updates.title, 'Titel');
    }
    if (updates.dueAt !== undefined) {
      assertIsoDate(updates.dueAt, 'Fälligkeitsdatum');
    }

    const existing = (this.wiedervorlagen$.value ?? []).find(
      (wv: Wiedervorlage) => wv.id === entryId
    );
    if (!existing) return null;

    const updated: Wiedervorlage = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updated.status === 'completed' && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    if (updated.status !== 'completed') {
      updated.completedAt = undefined;
    }

    await this.orchestration.upsertWiedervorlage(updated);
    await this.syncWiedervorlageToKalender(updated);
    return updated;
  }

  async completeWiedervorlage(entryId: string): Promise<Wiedervorlage | null> {
    const now = new Date().toISOString();
    return this.updateWiedervorlage(entryId, {
      status: 'completed',
      completedAt: now,
    });
  }

  async cancelWiedervorlage(entryId: string): Promise<Wiedervorlage | null> {
    return this.updateWiedervorlage(entryId, { status: 'cancelled' });
  }

  async deleteWiedervorlage(entryId: string): Promise<boolean> {
    const existing = (this.wiedervorlagen$.value ?? []).find(
      (wv: Wiedervorlage) => wv.id === entryId
    );
    if (!existing) return false;

    await this.orchestration.deleteWiedervorlage(entryId);
    await this.kalenderService.deleteEventsForSource('wiedervorlage', entryId);
    return true;
  }

  async markReminderSent(entryId: string): Promise<Wiedervorlage | null> {
    return this.updateWiedervorlage(entryId, { reminderSent: true });
  }

  getWiedervorlagenByAnwalt(anwaltId: string): Wiedervorlage[] {
    return (this.wiedervorlagen$.value ?? []).filter(
      (wv: Wiedervorlage) =>
        wv.assignedAnwaltId === anwaltId && wv.status === 'pending'
    );
  }

  getWiedervorlagenByPriority(priority: CasePriority): Wiedervorlage[] {
    return (this.wiedervorlagen$.value ?? []).filter(
      (wv: Wiedervorlage) => wv.priority === priority && wv.status === 'pending'
    );
  }

  private async syncWiedervorlageToKalender(entry: Wiedervorlage): Promise<void> {
    const statusPrefix =
      entry.status === 'completed'
        ? '✅ '
        : entry.status === 'cancelled'
          ? '❌ '
          : '📝 ';

    const title = `${statusPrefix}Wiedervorlage: ${entry.title}`;
    const descriptionLines = [
      `Priorität: ${entry.priority}`,
      `Status: ${entry.status}`,
    ];
    if (entry.description) {
      descriptionLines.push('');
      descriptionLines.push(entry.description);
    }

    await this.kalenderService.upsertEventForSource({
      workspaceId: entry.workspaceId,
      matterId: entry.matterId,
      title,
      description: descriptionLines.join('\n'),
      startAt: entry.dueAt,
      allDay: false,
      reminders: [{ offsetMinutes: 1440 }, { offsetMinutes: 120 }],
      source: 'wiedervorlage',
      sourceId: entry.id,
    });
  }
}
