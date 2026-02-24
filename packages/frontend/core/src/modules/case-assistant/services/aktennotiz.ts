import { Service } from '@toeverything/infra';

import type { Aktennotiz, AktennotizKind } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function normalizeOptionalStringArray(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const cleaned = values.map(v => v.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

export class AktennotizService extends Service {
  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  readonly aktennotizen$ = this.orchestration.aktennotizen$;

  getAktennotizenForMatter(matterId: string): Aktennotiz[] {
    return (this.aktennotizen$.value ?? []).filter(
      (n: Aktennotiz) => n.matterId === matterId
    );
  }

  getAktennotizenForClient(clientId: string): Aktennotiz[] {
    return (this.aktennotizen$.value ?? []).filter(
      (n: Aktennotiz) => n.clientId === clientId
    );
  }

  getAktennotizenForCase(caseId: string): Aktennotiz[] {
    return (this.aktennotizen$.value ?? []).filter(
      (n: Aktennotiz) => n.caseId === caseId
    );
  }

  getInternalAktennotizen(matterId: string): Aktennotiz[] {
    return (this.aktennotizen$.value ?? []).filter(
      (n: Aktennotiz) => n.matterId === matterId && n.isInternal
    );
  }

  getAktennotizenByKind(matterId: string, kind: AktennotizKind): Aktennotiz[] {
    return (this.aktennotizen$.value ?? []).filter(
      (n: Aktennotiz) => n.matterId === matterId && n.kind === kind
    );
  }

  async createAktennotiz(input: {
    workspaceId: string;
    caseId: string;
    matterId: string;
    clientId: string;
    title: string;
    content: string;
    kind: AktennotizKind;
    isInternal: boolean;
    authorId: string;
    attachments?: string[];
  }): Promise<Aktennotiz> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.caseId, 'Case-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.clientId, 'Client-ID');
    assertNonEmpty(input.title, 'Titel');
    assertNonEmpty(input.content, 'Inhalt');
    assertNonEmpty(input.authorId, 'Author-ID');

    const now = new Date().toISOString();

    const notiz: Aktennotiz = {
      id: createId('notiz'),
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      matterId: input.matterId,
      clientId: input.clientId,
      title: input.title,
      content: input.content,
      kind: input.kind,
      isInternal: input.isInternal,
      authorId: input.authorId,
      attachments: normalizeOptionalStringArray(input.attachments),
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertAktennotiz(notiz);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'aktennotiz.created',
      severity: 'info',
      details: `Aktennotiz erstellt: ${input.title} (${input.kind})`,
      metadata: {
        kind: input.kind,
        isInternal: String(input.isInternal),
      },
    });

    return notiz;
  }

  async updateAktennotiz(
    entryId: string,
    updates: Partial<Aktennotiz>
  ): Promise<Aktennotiz | null> {
    assertNonEmpty(entryId, 'Aktennotiz-ID');
    if (updates.title !== undefined) {
      assertNonEmpty(updates.title, 'Titel');
    }
    if (updates.content !== undefined) {
      assertNonEmpty(updates.content, 'Inhalt');
    }

    const existing = (this.aktennotizen$.value ?? []).find(
      (n: Aktennotiz) => n.id === entryId
    );
    if (!existing) return null;

    const updated: Aktennotiz = {
      ...existing,
      ...updates,
      attachments:
        updates.attachments !== undefined
          ? normalizeOptionalStringArray(updates.attachments)
          : existing.attachments,
      updatedAt: new Date().toISOString(),
    };

    await this.orchestration.upsertAktennotiz(updated);
    return updated;
  }

  async deleteAktennotiz(entryId: string): Promise<boolean> {
    assertNonEmpty(entryId, 'Aktennotiz-ID');

    const existing = (this.aktennotizen$.value ?? []).find(
      (n: Aktennotiz) => n.id === entryId
    );
    if (!existing) return false;

    await this.orchestration.deleteAktennotiz(entryId);
    return true;
  }

  getRecentAktennotizen(matterId: string, limit: number = 10): Aktennotiz[] {
    return (this.aktennotizen$.value ?? [])
      .filter((n: Aktennotiz) => n.matterId === matterId)
      .sort((a: Aktennotiz, b: Aktennotiz) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  }

  searchAktennotizen(query: string, matterId?: string): Aktennotiz[] {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) return [];
    return (this.aktennotizen$.value ?? []).filter((n: Aktennotiz) => {
      if (matterId && n.matterId !== matterId) return false;
      return (
        n.title.toLowerCase().includes(lowerQuery) ||
        n.content.toLowerCase().includes(lowerQuery)
      );
    });
  }
}
