import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type {
  CaseActor,
  Jurisdiction,
  CaseDeadline,
  CaseFile,
  CaseIssue,
  CaseMemoryEvent,
  ClientRecord,
  MatterRecord,
} from '../types';
import type { KalenderService } from './kalender';

const DEFAULT_REMINDER_OFFSETS_MINUTES = [20160, 10080, 4320, 1440, 180, 60];

export class CaseAssistantService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly kalenderService: KalenderService
  ) {
    super();
  }

  readonly graph$ = this.store.watchGraph();
  readonly alerts$ = this.store.watchAlerts();
  readonly activeJurisdiction$ = this.store.watchActiveJurisdiction();

  getActiveJurisdiction(): Jurisdiction {
    return this.store.getActiveJurisdiction();
  }

  setActiveJurisdiction(jurisdiction: Jurisdiction): void {
    this.store.setActiveJurisdiction(jurisdiction);
  }

  private defaultClientId(workspaceId: string) {
    return `client:${workspaceId}:default`;
  }

  async upsertClient(input: Omit<ClientRecord, 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const current = this.graph$.value?.clients?.[input.id];

    const record: ClientRecord = {
      ...input,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    await this.store.upsertClient(record);
    return record;
  }

  async upsertMatter(input: Omit<MatterRecord, 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const graph = this.graph$.value;
    const current = graph?.matters?.[input.id];

    const normalizedAssignedAnwaltIds = [
      ...(input.assignedAnwaltId ? [input.assignedAnwaltId] : []),
      ...(input.assignedAnwaltIds ?? []),
    ].filter(Boolean);
    const uniqueAssignedAnwaltIds = [...new Set(normalizedAssignedAnwaltIds)];

    if (graph?.anwaelte) {
      const hasInvalidAssignedAnwalt = uniqueAssignedAnwaltIds.some(anwaltId => {
        const anwalt = graph.anwaelte?.[anwaltId];
        return !anwalt || !anwalt.isActive;
      });
      if (hasInvalidAssignedAnwalt) {
        return null;
      }
    }

    const record: MatterRecord = {
      ...input,
      assignedAnwaltId: uniqueAssignedAnwaltIds[0],
      assignedAnwaltIds:
        uniqueAssignedAnwaltIds.length > 0 ? uniqueAssignedAnwaltIds : undefined,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    await this.store.upsertMatter(record);
    return record;
  }

  async deleteClient(clientId: string) {
    const graph = await this.store.getGraph();
    const client = graph.clients?.[clientId];
    if (!client) {
      return false;
    }

    graph.matters = graph.matters ?? {};
    const defaultClientId = this.defaultClientId(client.workspaceId);
    const now = new Date().toISOString();
    for (const matter of Object.values(graph.matters ?? {})) {
      const isPrimary = matter.clientId === clientId;
      const isInList = matter.clientIds?.includes(clientId);

      if (isPrimary || isInList) {
        const updatedClientIds = (matter.clientIds ?? [matter.clientId]).filter(id => id !== clientId);
        const newPrimary = isPrimary
          ? (updatedClientIds[0] ?? defaultClientId)
          : matter.clientId;

        graph.matters[matter.id] = {
          ...matter,
          clientId: newPrimary,
          clientIds: updatedClientIds.length > 0 ? updatedClientIds : [newPrimary],
          updatedAt: now,
        };
      }
    }

    graph.updatedAt = now;
    await this.store.setGraph(graph);
    return await this.store.deleteClient(clientId);
  }

  /**
   * Add an additional client to a matter (multi-mandant: Streitgenossenschaft, Erbengemeinschaft)
   */
  async addClientToMatter(matterId: string, clientId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) return null;

    const existing = matter.clientIds ?? [matter.clientId];
    if (existing.includes(clientId)) return matter;

    const updated: MatterRecord = {
      ...matter,
      clientIds: [...existing, clientId],
      updatedAt: new Date().toISOString(),
    };

    await this.store.upsertMatter(updated);
    return updated;
  }

  /**
   * Remove a client from a matter's clientIds[] (cannot remove primary clientId)
   */
  async removeClientFromMatter(matterId: string, clientId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) return null;

    if (matter.clientId === clientId) {
      return null;
    }

    const updated: MatterRecord = {
      ...matter,
      clientIds: (matter.clientIds ?? [matter.clientId]).filter(id => id !== clientId),
      updatedAt: new Date().toISOString(),
    };

    await this.store.upsertMatter(updated);
    return updated;
  }

  /**
   * Get all client IDs for a matter (including multi-mandant clientIds[])
   */
  getClientsForMatter(matterId: string): string[] {
    const matter = this.graph$.value?.matters?.[matterId];
    if (!matter) return [];

    const ids = new Set<string>();
    ids.add(matter.clientId);
    if (matter.clientIds) {
      for (const cid of matter.clientIds) {
        ids.add(cid);
      }
    }
    return Array.from(ids);
  }

  async deleteMatter(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return false;
    }

    for (const caseFile of Object.values(graph.cases ?? {})) {
      if (caseFile.matterId === matterId) {
        graph.cases[caseFile.id] = {
          ...caseFile,
          matterId: undefined,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    graph.updatedAt = new Date().toISOString();
    await this.store.setGraph(graph);
    return await this.store.deleteMatter(matterId);
  }

  async upsertCaseFile(input: Omit<CaseFile, 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const current = this.graph$.value?.cases?.[input.id];

    const record: CaseFile = {
      ...input,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    await this.store.upsertCaseFile(record);
    return record;
  }

  async upsertActor(input: Omit<CaseActor, 'updatedAt'>) {
    const record: CaseActor = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    await this.store.upsertActor(record);
    return record;
  }

  async deleteActor(actorId: string) {
    return await this.store.deleteActor(actorId);
  }

  async upsertIssue(input: Omit<CaseIssue, 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const current = this.graph$.value?.issues?.[input.id];

    const record: CaseIssue = {
      ...input,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    await this.store.upsertIssue(record);
    return record;
  }

  async deleteIssue(issueId: string) {
    return await this.store.deleteIssue(issueId);
  }

  async upsertDeadline(
    input: Omit<CaseDeadline, 'createdAt' | 'updatedAt' | 'status'> & {
      status?: CaseDeadline['status'];
    }
  ) {
    const now = new Date().toISOString();
    const current = this.graph$.value?.deadlines?.[input.id];
    const normalizedReminderOffsets = [...new Set(input.reminderOffsetsInMinutes)]
      .filter(offset => Number.isFinite(offset) && offset >= 0)
      .map(offset => Math.floor(offset))
      .sort((a, b) => b - a);

    const record: CaseDeadline = {
      ...input,
      status: input.status ?? current?.status ?? 'open',
      reminderOffsetsInMinutes:
        normalizedReminderOffsets.length > 0
          ? normalizedReminderOffsets
          : DEFAULT_REMINDER_OFFSETS_MINUTES,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    await this.store.upsertDeadline(record);
    await this.syncDeadlineToKalender(record);
    return record;
  }

  async upsertMemoryEvent(input: Omit<CaseMemoryEvent, 'createdAt'>) {
    const current = this.graph$.value?.memoryEvents?.[input.id];
    const record: CaseMemoryEvent = {
      ...input,
      createdAt: current?.createdAt ?? new Date().toISOString(),
    };

    await this.store.upsertMemoryEvent(record);
    return record;
  }

  async deleteMemoryEvent(memoryEventId: string) {
    return await this.store.deleteMemoryEvent(memoryEventId);
  }

  async markDeadlineAcknowledged(deadlineId: string) {
    const current = this.graph$.value?.deadlines?.[deadlineId];
    if (!current) {
      return;
    }

    const updated: CaseDeadline = {
      ...current,
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.store.upsertDeadline(updated);
    await this.syncDeadlineToKalender(updated);
  }

  private async syncDeadlineToKalender(deadline: CaseDeadline): Promise<void> {
    const graph = this.graph$.value;
    if (!graph) return;

    const caseFile = Object.values(graph.cases ?? {}).find(c =>
      (c.deadlineIds ?? []).includes(deadline.id)
    );
    if (!caseFile) return;

    const statusPrefix =
      deadline.status === 'completed'
        ? '✅ '
        : deadline.status === 'acknowledged'
          ? '📌 '
          : deadline.status === 'expired' || deadline.status === 'alerted'
            ? '⚠️ '
            : '';

    await this.kalenderService.upsertEventForSource({
      workspaceId: caseFile.workspaceId,
      matterId: caseFile.matterId,
      title: `${statusPrefix}Frist: ${deadline.title}`,
      description: `Friststatus: ${deadline.status}\nPriorität: ${deadline.priority}`,
      startAt: deadline.dueAt,
      allDay: false,
      reminders: (deadline.reminderOffsetsInMinutes ?? []).map(offset => ({
        offsetMinutes: offset,
      })),
      source: 'deadline',
      sourceId: deadline.id,
    });
  }
}
