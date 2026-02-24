import { Service } from '@toeverything/infra';

import type { Vollmacht } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

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

export class VollmachtService extends Service {
  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  readonly vollmachten$ = this.orchestration.vollmachten$;

  getVollmachtenForClient(clientId: string): Vollmacht[] {
    return (this.vollmachten$.value ?? []).filter(
      (v: Vollmacht) => v.clientId === clientId
    );
  }

  getVollmachtenForMatter(matterId: string): Vollmacht[] {
    return (this.vollmachten$.value ?? []).filter(
      (v: Vollmacht) => v.matterId === matterId
    );
  }

  getActiveVollmachten(clientId: string): Vollmacht[] {
    const now = new Date().toISOString();
    return (this.vollmachten$.value ?? []).filter((v: Vollmacht) => {
      if (v.clientId !== clientId) return false;
      if (v.status !== 'active') return false;
      if (v.validUntil && v.validUntil < now) return false;
      return true;
    });
  }

  getExpiringVollmachten(days: number = 30): Vollmacht[] {
    assertPositiveInteger(days, 'Tage');

    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();
    const futureStr = future.toISOString();

    return (this.vollmachten$.value ?? []).filter((v: Vollmacht) => {
      if (v.status !== 'active') return false;
      if (!v.validUntil) return false;
      return v.validUntil >= nowStr && v.validUntil <= futureStr;
    });
  }

  getExpiredVollmachten(): Vollmacht[] {
    const now = new Date().toISOString();
    return (this.vollmachten$.value ?? []).filter((v: Vollmacht) => {
      if (v.status !== 'active') return false;
      if (!v.validUntil) return false;
      return v.validUntil < now;
    });
  }

  async createVollmacht(input: {
    workspaceId: string;
    clientId: string;
    caseId?: string;
    matterId?: string;
    type: Vollmacht['type'];
    title: string;
    grantedTo: string;
    grantedToName: string;
    validFrom: string;
    validUntil?: string;
    scope?: string;
    notarized?: boolean;
    registered?: boolean;
    notes?: string;
    documentId?: string;
  }): Promise<Vollmacht> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.clientId, 'Client-ID');
    assertNonEmpty(input.title, 'Titel');
    assertNonEmpty(input.grantedTo, 'Bevollmächtigter (ID)');
    assertNonEmpty(input.grantedToName, 'Bevollmächtigter (Name)');
    assertIsoDate(input.validFrom, 'Gültig von');
    if (input.validUntil !== undefined) {
      assertIsoDate(input.validUntil, 'Gültig bis');
      if (new Date(input.validUntil).getTime() < new Date(input.validFrom).getTime()) {
        throw new Error('Gültig bis darf nicht vor Gültig von liegen.');
      }
    }

    const now = new Date().toISOString();

    const vollmacht: Vollmacht = {
      id: createId('vollmacht'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      type: input.type,
      title: input.title,
      grantedTo: input.grantedTo,
      grantedToName: input.grantedToName,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      scope: input.scope,
      notarized: input.notarized,
      registered: input.registered,
      notes: input.notes,
      documentId: input.documentId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertVollmacht(vollmacht);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId ?? '',
      workspaceId: input.workspaceId,
      action: 'vollmacht.created',
      severity: 'info',
      details: `Vollmacht erstellt: ${input.title} für ${input.grantedToName}`,
      metadata: {
        type: input.type,
        validUntil: input.validUntil ?? 'unbegrenzt',
      },
    });

    return vollmacht;
  }

  /**
   * Create a pending request for a general power of attorney.
   * This is the entry point for email-first / portal-based signing (implemented separately).
   */
  async requestGeneralVollmacht(input: {
    workspaceId: string;
    clientId: string;
    caseId?: string;
    matterId?: string;
    grantedTo: string;
    grantedToName: string;
    title?: string;
    scope?: string;
    notes?: string;
  }): Promise<Vollmacht> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.clientId, 'Client-ID');
    assertNonEmpty(input.grantedTo, 'Bevollmächtigter (ID)');
    assertNonEmpty(input.grantedToName, 'Bevollmächtigter (Name)');

    const now = new Date().toISOString();
    const vollmacht: Vollmacht = {
      id: createId('vollmacht'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      type: 'general',
      title: input.title ?? 'Generalvollmacht',
      grantedTo: input.grantedTo,
      grantedToName: input.grantedToName,
      validFrom: now,
      validUntil: undefined,
      scope: input.scope,
      notarized: false,
      registered: false,
      notes: input.notes,
      documentId: undefined,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertVollmacht(vollmacht);
    await this.orchestration.appendAuditEntry({
      caseId: input.caseId ?? '',
      workspaceId: input.workspaceId,
      action: 'vollmacht.requested',
      severity: 'info',
      details: `Vollmacht angefordert: ${vollmacht.title} für ${input.grantedToName}`,
      metadata: {
        type: vollmacht.type,
        status: vollmacht.status,
        clientId: input.clientId,
        matterId: input.matterId ?? 'none',
      },
    });

    return vollmacht;
  }

  async updateVollmacht(
    entryId: string,
    updates: Partial<Vollmacht>
  ): Promise<Vollmacht | null> {
    assertNonEmpty(entryId, 'Vollmacht-ID');
    if (updates.title !== undefined) {
      assertNonEmpty(updates.title, 'Titel');
    }
    if (updates.grantedTo !== undefined) {
      assertNonEmpty(updates.grantedTo, 'Bevollmächtigter (ID)');
    }
    if (updates.grantedToName !== undefined) {
      assertNonEmpty(updates.grantedToName, 'Bevollmächtigter (Name)');
    }
    if (updates.validFrom !== undefined) {
      assertIsoDate(updates.validFrom, 'Gültig von');
    }
    if (updates.validUntil !== undefined) {
      assertIsoDate(updates.validUntil, 'Gültig bis');
    }

    const existing = (this.vollmachten$.value ?? []).find(
      (v: Vollmacht) => v.id === entryId
    );
    if (!existing) return null;

    const updated: Vollmacht = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const validFromMs = Date.parse(updated.validFrom);
    if (!Number.isNaN(validFromMs) && updated.validUntil) {
      const validUntilMs = Date.parse(updated.validUntil);
      if (Number.isNaN(validUntilMs)) {
        throw new Error('Gültig bis muss ein gültiges Datum sein.');
      }
      if (validUntilMs < validFromMs) {
        throw new Error('Gültig bis darf nicht vor Gültig von liegen.');
      }
    }

    await this.orchestration.upsertVollmacht(updated);
    return updated;
  }

  async revokeVollmacht(entryId: string): Promise<Vollmacht | null> {
    return this.updateVollmacht(entryId, { status: 'revoked' });
  }

  async expireVollmacht(entryId: string): Promise<Vollmacht | null> {
    return this.updateVollmacht(entryId, { status: 'expired' });
  }

  async deleteVollmacht(entryId: string): Promise<boolean> {
    assertNonEmpty(entryId, 'Vollmacht-ID');

    const existing = (this.vollmachten$.value ?? []).find(
      (v: Vollmacht) => v.id === entryId
    );
    if (!existing) return false;

    await this.orchestration.deleteVollmacht(entryId);
    return true;
  }

  getVollmachtByType(clientId: string, type: Vollmacht['type']): Vollmacht[] {
    return (this.vollmachten$.value ?? []).filter(
      (v: Vollmacht) => v.clientId === clientId && v.type === type
    );
  }

  hasValidGeneralVollmacht(clientId: string): boolean {
    return this.getActiveVollmachten(clientId).some(
      (v: Vollmacht) => v.type === 'general'
    );
  }
}
