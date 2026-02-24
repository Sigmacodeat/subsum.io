import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type {
  Aktennotiz,
  AuditChainAnchor,
  CaseAssistantAction,
  CaseAssistantRole,
  CaseBlueprint,
  CaseDeadline,
  CaseMemoryEvent,
  CaseFile,
  CitationChain,
  ClientRecord,
  ComplianceAuditEntry,
  ConnectorConfig,
  CopilotRun,
  CopilotTask,
  CourtDecision,
  DocumentQualityReport,
  EmailRecord,
  Gerichtstermin,
  IngestionJob,
  IngestionJobStatus,
  IntakeSourceType,
  JudikaturSuggestion,
  LegalDocumentRecord,
  LegalFinding,
  LegalNormRegistryRecord,
  MatterRecord,
  OcrJob,
  PortalRequestRecord,
  KycSubmissionRecord,
  RechnungRecord,
  AuslageRecord,
  KassenbelegRecord,
  FiscalSignatureRecord,
  ExportJournalRecord,
  SemanticChunk,
  TimeEntry,
  VollmachtSigningRequestRecord,
  Vollmacht,
  Wiedervorlage,
  WorkflowEvent,
  WorkflowEventType,
  WorkspaceResidencyPolicy,
} from '../types';
import type { CaseAccessControlService } from './case-access-control';
import type { CaseResidencyPolicyService } from './residency-policy';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

const DOCUMENT_TRASH_RETENTION_DAYS = 30;
const MATTER_TRASH_RETENTION_DAYS = 90;

function buildTrashTimestamps(retentionDays: number) {
  const now = new Date();
  const purgeAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  return {
    trashedAt: now.toISOString(),
    purgeAt: purgeAt.toISOString(),
  };
}

export class CasePlatformOrchestrationService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly accessControlService: CaseAccessControlService,
    private readonly residencyPolicyService: CaseResidencyPolicyService
  ) {
    super();
  }

  readonly graph$ = this.store.watchGraph();

  readonly connectors$ = this.store.watchConnectors();
  readonly ingestionJobs$ = this.store.watchIngestionJobs();
  readonly legalDocuments$ = this.store.watchLegalDocuments();
  readonly ocrJobs$ = this.store.watchOcrJobs();
  readonly legalFindings$ = this.store.watchLegalFindings();
  readonly copilotTasks$ = this.store.watchCopilotTasks();
  readonly blueprints$ = this.store.watchBlueprints();
  readonly copilotRuns$ = this.store.watchCopilotRuns();
  readonly workflowEvents$ = this.store.watchWorkflowEvents();
  readonly auditEntries$ = this.store.watchAuditEntries();
  readonly auditAnchors$ = this.store.watchAuditAnchors();
  readonly courtDecisions$ = this.store.watchCourtDecisions();
  readonly legalNormRegistry$ = this.store.watchLegalNormRegistry();
  readonly judikaturSuggestions$ = this.store.watchJudikaturSuggestions();
  readonly citationChains$ = this.store.watchCitationChains();
  readonly semanticChunks$ = this.store.watchSemanticChunks();
  readonly qualityReports$ = this.store.watchQualityReports();
  readonly emails$ = this.store.watchEmails();
  readonly portalRequests$ = this.store.watchPortalRequests();
  readonly vollmachtSigningRequests$ = this.store.watchVollmachtSigningRequests();
  readonly kycSubmissions$ = this.store.watchKycSubmissions();
  readonly timeEntries$ = this.store.watchTimeEntries();
  readonly wiedervorlagen$ = this.store.watchWiedervorlagen();
  readonly aktennotizen$ = this.store.watchAktennotizen();
  readonly vollmachten$ = this.store.watchVollmachten();
  readonly rechnungen$ = this.store.watchRechnungen();
  readonly auslagen$ = this.store.watchAuslagen();
  readonly kassenbelege$ = this.store.watchKassenbelege();
  readonly fiscalSignatures$ = this.store.watchFiscalSignatures();
  readonly exportJournal$ = this.store.watchExportJournal();
  readonly residencyPolicy$ = this.residencyPolicyService.policy$;
  readonly role$ = this.accessControlService.role$;

  async getCurrentRole() {
    return await this.accessControlService.getRole();
  }

  async setCurrentRole(role: CaseAssistantRole) {
    await this.accessControlService.setRole(role);
  }

  async getWorkspaceResidencyPolicy() {
    return await this.residencyPolicyService.getPolicy();
  }

  async setWorkspaceResidencyPolicy(policy: WorkspaceResidencyPolicy) {
    const permission = await this.accessControlService.evaluate('residency.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: policy.workspaceId,
        action: 'residency.manage.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const nextPolicy = await this.residencyPolicyService.setPolicy(policy);
    await this.appendAuditEntry({
      workspaceId: nextPolicy.workspaceId,
      action: 'residency.policy.updated',
      severity: 'info',
      details: `Workspace-Residency-Policy gespeichert (${nextPolicy.mode}).`,
      metadata: {
        mode: nextPolicy.mode,
        allowCloudSync: String(nextPolicy.allowCloudSync),
        allowRemoteOcr: String(nextPolicy.allowRemoteOcr),
        allowExternalConnectors: String(nextPolicy.allowExternalConnectors),
        allowTelemetry: String(nextPolicy.allowTelemetry),
        requireMfaForAdmins: String(nextPolicy.requireMfaForAdmins),
        requireMfaForMembers: String(nextPolicy.requireMfaForMembers),
        enforceEncryptionAtRest: String(nextPolicy.enforceEncryptionAtRest),
        sessionIdleTimeoutMinutes: String(nextPolicy.sessionIdleTimeoutMinutes),
      },
    });

    return nextPolicy;
  }

  private hasArchivedTag(client: ClientRecord) {
    return client.tags.includes('__archived');
  }

  async canAccess(action: CaseAssistantAction) {
    return await this.accessControlService.can(action);
  }

  async evaluatePermission(action: CaseAssistantAction) {
    return await this.accessControlService.evaluate(action);
  }

  private getConnectorById(connectorId: string) {
    return (
      (this.connectors$.value ?? []).find((item: ConnectorConfig) => item.id === connectorId) ?? null
    );
  }

  private getJobById(jobId: string) {
    return (this.ingestionJobs$.value ?? []).find((item: IngestionJob) => item.id === jobId) ?? null;
  }

  private async purgeExpiredDocumentTrash() {
    const trashedDocs = await this.store.getTrashedLegalDocuments();
    const nowMs = Date.now();
    const nextTrashedDocs = trashedDocs.filter(
      doc => !doc.purgeAt || new Date(doc.purgeAt).getTime() > nowMs
    );
    if (nextTrashedDocs.length !== trashedDocs.length) {
      await this.store.setTrashedLegalDocuments(nextTrashedDocs);
    }
  }

  private async purgeExpiredMatterTrash() {
    const graph = await this.store.getGraph();
    const matters = Object.values(graph.matters ?? {});
    const nowMs = Date.now();
    const expiredMatters = matters.filter(
      m => m.trashedAt && m.purgeAt && new Date(m.purgeAt).getTime() <= nowMs
    );
    
    if (expiredMatters.length === 0) {
      return;
    }

    for (const matter of expiredMatters) {
      await this.purgeMatter(matter.id);
    }
  }

  async upsertConnector(
    input: Omit<ConnectorConfig, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const now = new Date().toISOString();
    const current = (this.connectors$.value ?? []).find(
      (item: ConnectorConfig) => item.id === input.id
    );
    const record: ConnectorConfig = {
      ...input,
      createdAt: input.createdAt ?? current?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    await this.store.upsertConnector(record);
    await this.appendWorkflowEvent({
      type: 'connector.updated',
      actor: 'user',
      workspaceId: record.workspaceId,
      payload: {
        connectorId: record.id,
        connectorKind: record.kind,
        status: record.status,
      },
    });

    return record;
  }

  async upsertGerichtstermin(
    input: Omit<Gerichtstermin, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const now = new Date().toISOString();
    const graph = await this.store.getGraph();
    const current = graph.termine?.[input.id];

    const record: Gerichtstermin = {
      ...input,
      createdAt: current?.createdAt ?? input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    await this.store.upsertGerichtstermin(record);

    const caseFile = graph.cases?.[record.caseId];
    if (caseFile) {
      const currentTerminIds = caseFile.terminIds ?? [];
      if (!currentTerminIds.includes(record.id)) {
        await this.store.upsertCaseFile({
          ...caseFile,
          terminIds: [...currentTerminIds, record.id],
          updatedAt: now,
        });
      }
    }

    await this.appendWorkflowEvent({
      type: 'gerichtstermin.updated',
      actor: 'user',
      workspaceId: record.workspaceId,
      caseId: record.caseId,
      payload: {
        terminId: record.id,
        terminart: record.terminart,
        datum: record.datum,
        status: record.status,
        gericht: record.gericht,
        kategorie: record.kategorie ?? 'gerichtstermin',
      },
    });
    return record;
  }

  async deleteGerichtstermin(terminId: string) {
    const graph = await this.store.getGraph();
    const existing = graph.termine?.[terminId];
    if (existing) {
      const caseFile = graph.cases?.[existing.caseId];
      if (caseFile) {
        const nextTerminIds = (caseFile.terminIds ?? []).filter(id => id !== terminId);
        if (nextTerminIds.length !== (caseFile.terminIds ?? []).length) {
          await this.store.upsertCaseFile({
            ...caseFile,
            terminIds: nextTerminIds,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    const ok = await this.store.deleteGerichtstermin(terminId);
    if (ok && existing) {
      await this.appendWorkflowEvent({
        type: 'gerichtstermin.deleted',
        actor: 'user',
        workspaceId: existing.workspaceId,
        caseId: existing.caseId,
        payload: {
          terminId: existing.id,
          terminart: existing.terminart,
          datum: existing.datum,
          status: existing.status,
          gericht: existing.gericht,
          kategorie: existing.kategorie ?? 'gerichtstermin',
        },
      });
    }
    return ok;
  }

  async deleteDeadlineCascade(deadlineId: string) {
    const graph = await this.store.getGraph();
    const deadline = graph.deadlines?.[deadlineId];
    if (!deadline) {
      return false;
    }

    const workspaceId = Object.values(graph.cases ?? {})[0]?.workspaceId ?? 'workspace:unknown';
    const permission = await this.accessControlService.evaluate('task.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId,
        action: 'task.manage.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          deadlineId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return false;
    }

    const now = new Date().toISOString();
    let linkedCaseCount = 0;
    for (const caseFile of Object.values(graph.cases ?? {}) as CaseFile[]) {
      const deadlineIds = caseFile.deadlineIds ?? [];
      if (!deadlineIds.includes(deadlineId)) {
        continue;
      }
      linkedCaseCount += 1;
      graph.cases[caseFile.id] = {
        ...caseFile,
        deadlineIds: deadlineIds.filter(id => id !== deadlineId),
        updatedAt: now,
      };
    }

    if (graph.memoryEvents) {
      for (const memoryEvent of Object.values(graph.memoryEvents)) {
        if (memoryEvent.deadlineId === deadlineId) {
          delete graph.memoryEvents[memoryEvent.id];
        }
      }
    }

    delete graph.deadlines[deadlineId];
    graph.updatedAt = now;
    await this.store.setGraph(graph);

    await this.appendAuditEntry({
      workspaceId,
      action: 'deadline.deleted',
      severity: 'info',
      details: `Frist ${deadline.title} wurde gelöscht.`,
      metadata: {
        deadlineId,
        linkedCaseCount: String(linkedCaseCount),
      },
    });

    return true;
  }

  async upsertClient(
    input: Omit<ClientRecord, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const permission = await this.accessControlService.evaluate('client.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: input.workspaceId,
        action: 'client.manage.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          clientId: input.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const now = new Date().toISOString();
    const graph = await this.store.getGraph();
    const current = graph.clients?.[input.id];

    const record: ClientRecord = {
      ...input,
      createdAt: input.createdAt ?? current?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    await this.store.upsertClient(record);
    await this.appendWorkflowEvent({
      type: 'client.updated',
      actor: 'user',
      workspaceId: record.workspaceId,
      payload: {
        clientId: record.id,
        kind: record.kind,
        archived: this.hasArchivedTag(record),
      },
    });
    await this.appendAuditEntry({
      workspaceId: record.workspaceId,
      action: 'client.updated',
      severity: 'info',
      details: `Mandant ${record.displayName} wurde gespeichert.`,
      metadata: {
        clientId: record.id,
      },
    });

    return record;
  }

  async upsertMatter(
    input: Omit<MatterRecord, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const permission = await this.accessControlService.evaluate('matter.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: input.workspaceId,
        action: 'matter.manage.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          matterId: input.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const graph = await this.store.getGraph();
    const client = graph.clients?.[input.clientId];
    if (!client) {
      await this.appendAuditEntry({
        workspaceId: input.workspaceId,
        action: 'matter.updated.rejected',
        severity: 'warning',
        details: 'Akte kann nicht gespeichert werden: Mandant nicht gefunden.',
        metadata: {
          matterId: input.id,
          clientId: input.clientId,
        },
      });
      return null;
    }

    const normalizedAssignedAnwaltIds = [
      ...(input.assignedAnwaltId ? [input.assignedAnwaltId] : []),
      ...(input.assignedAnwaltIds ?? []),
    ].filter(Boolean);
    const uniqueAssignedAnwaltIds = [...new Set(normalizedAssignedAnwaltIds)];
    const invalidAssignedAnwaltIds = uniqueAssignedAnwaltIds.filter(anwaltId => {
      const anwalt = graph.anwaelte?.[anwaltId];
      return !anwalt || !anwalt.isActive;
    });
    if (invalidAssignedAnwaltIds.length > 0) {
      await this.appendAuditEntry({
        workspaceId: input.workspaceId,
        action: 'matter.updated.rejected',
        severity: 'warning',
        details:
          'Akte kann nicht gespeichert werden: zugewiesener Anwalt ist nicht aktiv oder existiert nicht.',
        metadata: {
          matterId: input.id,
          invalidAssignedAnwaltIds: invalidAssignedAnwaltIds.join(','),
        },
      });
      return null;
    }

    const now = new Date().toISOString();
    const current = graph.matters?.[input.id];
    const record: MatterRecord = {
      ...input,
      assignedAnwaltId: uniqueAssignedAnwaltIds[0],
      assignedAnwaltIds:
        uniqueAssignedAnwaltIds.length > 0 ? uniqueAssignedAnwaltIds : undefined,
      createdAt: input.createdAt ?? current?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    await this.store.upsertMatter(record);
    await this.appendWorkflowEvent({
      type: 'matter.updated',
      actor: 'user',
      workspaceId: record.workspaceId,
      payload: {
        matterId: record.id,
        clientId: record.clientId,
        status: record.status,
      },
    });
    await this.appendAuditEntry({
      workspaceId: record.workspaceId,
      action: 'matter.updated',
      severity: 'info',
      details: `Akte ${record.title} wurde gespeichert.`,
      metadata: {
        matterId: record.id,
        clientId: record.clientId,
      },
    });

    return record;
  }

  async upsertCaseFile(
    input: Omit<CaseFile, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const permission = await this.accessControlService.evaluate('case.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: input.id,
        workspaceId: input.workspaceId,
        action: 'case.manage.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          caseId: input.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const now = new Date().toISOString();
    const graph = await this.store.getGraph();
    const current = graph.cases?.[input.id] as CaseFile | undefined;

    const record: CaseFile = {
      ...input,
      createdAt: input.createdAt ?? current?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    await this.store.upsertCaseFile(record);
    await this.appendWorkflowEvent({
      type: 'case.updated',
      actor: 'user',
      caseId: record.id,
      workspaceId: record.workspaceId,
      payload: {
        caseId: record.id,
        matterId: record.matterId ?? null,
      },
    });
    await this.appendAuditEntry({
      caseId: record.id,
      workspaceId: record.workspaceId,
      action: 'case.updated',
      severity: 'info',
      details: `Case wurde gespeichert.`,
      metadata: {
        caseId: record.id,
      },
    });

    return record;
  }

  async upsertDeadline(
    input: Omit<CaseDeadline, 'createdAt' | 'updatedAt' | 'status'> & {
      status?: CaseDeadline['status'];
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const graph = await this.store.getGraph();
    const workspaceId = Object.values(graph.cases ?? {})[0]?.workspaceId ?? 'workspace:unknown';

    const permission = await this.accessControlService.evaluate('task.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId,
        action: 'task.manage.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          deadlineId: input.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const now = new Date().toISOString();
    const current = graph.deadlines?.[input.id];

    const DEFAULT_REMINDER_OFFSETS = [1440, 60, 15];
    const normalizedOffsets = [...new Set(input.reminderOffsetsInMinutes)]
      .filter(offset => Number.isFinite(offset) && offset >= 0)
      .map(offset => Math.floor(offset))
      .sort((a, b) => b - a);

    const record: CaseDeadline = {
      ...input,
      status: input.status ?? current?.status ?? 'open',
      reminderOffsetsInMinutes:
        normalizedOffsets.length > 0 ? normalizedOffsets : DEFAULT_REMINDER_OFFSETS,
      createdAt: current?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    await this.store.upsertDeadline(record);

    await this.appendWorkflowEvent({
      type: 'task.generated',
      actor: 'user',
      workspaceId,
      payload: {
        deadlineId: record.id,
        status: record.status,
        priority: record.priority,
      },
    });

    await this.appendAuditEntry({
      workspaceId,
      action: 'deadline.updated',
      severity: 'info',
      details: `Frist ${record.title} wurde gespeichert.`,
      metadata: {
        deadlineId: record.id,
        status: record.status,
      },
    });

    return record;
  }

  async assignCaseMatter(input: { caseId: string; workspaceId: string; matterId: string }) {
    const permission = await this.accessControlService.evaluate('matter.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'case.matter.assign.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          matterId: input.matterId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const graph = await this.store.getGraph();
    const caseFile = graph.cases?.[input.caseId] as CaseFile | undefined;
    const matter = graph.matters?.[input.matterId];
    if (!caseFile || !matter) {
      return null;
    }
    if (caseFile.workspaceId !== input.workspaceId || matter.workspaceId !== input.workspaceId) {
      return null;
    }

    const updatedCase: CaseFile = {
      ...caseFile,
      matterId: matter.id,
      updatedAt: new Date().toISOString(),
    };
    await this.store.upsertCaseFile(updatedCase);

    await this.appendWorkflowEvent({
      type: 'case.matter.assigned',
      actor: 'user',
      caseId: updatedCase.id,
      workspaceId: updatedCase.workspaceId,
      payload: {
        caseId: updatedCase.id,
        matterId: matter.id,
      },
    });

    await this.appendAuditEntry({
      caseId: updatedCase.id,
      workspaceId: updatedCase.workspaceId,
      action: 'case.matter.assigned',
      severity: 'info',
      details: `Case wurde mit Akte ${matter.title} verknüpft.`,
      metadata: {
        matterId: matter.id,
      },
    });

    return updatedCase;
  }

  async archiveMatter(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return null;
    }
    const now = new Date().toISOString();
    return await this.upsertMatter({
      ...matter,
      status: 'archived',
      archivedAt: matter.archivedAt ?? now,
    });
  }

  async scheduleMatterDeletion(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return null;
    }

    const permission = await this.accessControlService.evaluate('matter.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.trash.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          matterId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (matter.status !== 'archived') {
      const archived = await this.archiveMatter(matterId);
      if (!archived) {
        return null;
      }
    }

    const { trashedAt, purgeAt } = buildTrashTimestamps(MATTER_TRASH_RETENTION_DAYS);
    const updated = await this.upsertMatter({
      ...matter,
      status: 'archived',
      archivedAt: matter.archivedAt ?? trashedAt,
      trashedAt,
      purgeAt,
    });

    await this.appendAuditEntry({
      workspaceId: matter.workspaceId,
      action: 'matter.trash.scheduled',
      severity: 'info',
      details: `Akte "${matter.title}" zur Löschung markiert. Wird automatisch gelöscht am ${new Date(purgeAt).toLocaleDateString('de-DE')}.`,
      metadata: {
        matterId,
        trashedAt,
        purgeAt,
        retentionDays: String(MATTER_TRASH_RETENTION_DAYS),
      },
    });

    return updated;
  }

  async restoreMatter(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return null;
    }

    const permission = await this.accessControlService.evaluate('matter.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.restore.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          matterId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (!matter.trashedAt) {
      return matter;
    }

    const updated = await this.upsertMatter({
      ...matter,
      trashedAt: undefined,
      purgeAt: undefined,
    });

    await this.appendAuditEntry({
      workspaceId: matter.workspaceId,
      action: 'matter.restored',
      severity: 'info',
      details: `Akte "${matter.title}" wiederhergestellt.`,
      metadata: {
        matterId,
      },
    });

    return updated;
  }

  async purgeMatter(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return false;
    }

    const permission = await this.accessControlService.evaluate('matter.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.purge.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          matterId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return false;
    }

    const linkedCases = Object.values(graph.cases ?? {}).filter(
      (item: CaseFile) => item.matterId === matterId
    );
    const linkedCaseIds = linkedCases.map(c => c.id);
    const linkedDeadlineIds = Array.from(
      new Set(
        linkedCases
          .flatMap(c => c.deadlineIds ?? [])
          .filter(Boolean)
      )
    );
    const linkedTerminIds = Array.from(
      new Set(
        linkedCases
          .flatMap(c => c.terminIds ?? [])
          .filter(Boolean)
      )
    );

    const legalDocs = await this.store.getLegalDocuments();
    const linkedDocs = legalDocs.filter(d => linkedCaseIds.includes(d.caseId));
    if (linkedDocs.length > 0) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.purge.rejected',
        severity: 'warning',
        details: 'Akte kann nicht endgültig gelöscht werden, solange Dokumente verknüpft sind.',
        metadata: {
          matterId,
          linkedDocsCount: String(linkedDocs.length),
        },
      });
      return false;
    }

    if (linkedDeadlineIds.length > 0) {
      for (const deadlineId of linkedDeadlineIds) {
        delete graph.deadlines?.[deadlineId];
      }

      if (graph.memoryEvents) {
        for (const memoryEvent of Object.values(graph.memoryEvents)) {
          if (memoryEvent.deadlineId && linkedDeadlineIds.includes(memoryEvent.deadlineId)) {
            delete graph.memoryEvents[memoryEvent.id];
          }
        }
      }
    }

    if (linkedTerminIds.length > 0) {
      for (const terminId of linkedTerminIds) {
        delete graph.termine?.[terminId];
      }
    }

    for (const caseId of linkedCaseIds) {
      delete graph.cases[caseId];
    }
    graph.updatedAt = new Date().toISOString();
    await this.store.setGraph(graph);

    if (linkedCaseIds.length > 0) {
      const [ingestionJobs, ocrJobs, findings, chunks, workflowEvents, auditEntries] =
        await Promise.all([
          this.store.getIngestionJobs(),
          this.store.getOcrJobs(),
          this.store.getLegalFindings(),
          this.store.getSemanticChunks(),
          this.store.getWorkflowEvents(),
          this.store.getAuditEntries(),
        ]);

      await Promise.all([
        this.store.setIngestionJobs(
          ingestionJobs.filter(j => !linkedCaseIds.includes(j.caseId))
        ),
        this.store.setOcrJobs(ocrJobs.filter(j => !linkedCaseIds.includes(j.caseId))),
        this.store.setLegalFindings(
          findings.filter(f => !linkedCaseIds.includes(f.caseId))
        ),
        this.store.setSemanticChunks(
          chunks.filter(c => !linkedCaseIds.includes(c.caseId))
        ),
        this.store.setWorkflowEvents(
          workflowEvents.filter(e => !linkedCaseIds.includes(e.caseId ?? ''))
        ),
        this.store.setAuditEntries(
          auditEntries.filter(e => !linkedCaseIds.includes(e.caseId ?? ''))
        ),
      ]);
    }

    const deleted = await this.store.deleteMatter(matterId);
    if (!deleted) {
      return false;
    }

    await this.appendWorkflowEvent({
      type: 'matter.deleted',
      actor: 'user',
      workspaceId: matter.workspaceId,
      payload: {
        matterId,
      },
    });
    await this.appendAuditEntry({
      workspaceId: matter.workspaceId,
      action: 'matter.purged',
      severity: 'warning',
      details: `Akte "${matter.title}" wurde endgültig gelöscht.`,
      metadata: {
        matterId,
        deletedCaseCount: String(linkedCaseIds.length),
        deletedDeadlineCount: String(linkedDeadlineIds.length),
        deletedTerminCount: String(linkedTerminIds.length),
      },
    });

    return true;

  }

  async archiveClient(clientId: string) {
    const graph = await this.store.getGraph();
    const client = graph.clients?.[clientId];
    if (!client) {
      return null;
    }

    if (this.hasArchivedTag(client)) {
      return client;
    }

    const tags = [...new Set([...client.tags, '__archived'])];
    return await this.upsertClient({
      id: client.id,
      workspaceId: client.workspaceId,
      kind: client.kind ?? 'person',
      displayName: client.displayName ?? 'Mandant',
      identifiers: client.identifiers,
      primaryEmail: client.primaryEmail,
      primaryPhone: client.primaryPhone,
      address: client.address,
      notes: client.notes,
      tags,
      archived: true,
    });
  }

  async deleteMatter(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return false;
    }

    const permission = await this.accessControlService.evaluate('matter.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.delete.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          matterId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return false;
    }

    const linkedCase = Object.values(graph.cases ?? {}).find(
      (item: CaseFile) => item.matterId === matterId
    );
    if (linkedCase) {
      await this.appendAuditEntry({
        caseId: linkedCase.id,
        workspaceId: matter.workspaceId,
        action: 'matter.delete.rejected',
        severity: 'warning',
        details: 'Akte kann nicht gelöscht werden, solange Cases verknüpft sind.',
        metadata: {
          matterId,
          linkedCaseId: linkedCase.id,
        },
      });
      return false;
    }

    if (matter.status !== 'archived') {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.delete.rejected',
        severity: 'warning',
        details: 'Akte muss vor dem Löschen archiviert werden.',
        metadata: {
          matterId,
          status: matter.status,
        },
      });
      return false;
    }

    const deleted = await this.store.deleteMatter(matterId);
    if (!deleted) {
      return false;
    }

    await this.appendWorkflowEvent({
      type: 'matter.deleted',
      actor: 'user',
      workspaceId: matter.workspaceId,
      payload: {
        matterId,
      },
    });
    await this.appendAuditEntry({
      workspaceId: matter.workspaceId,
      action: 'matter.deleted',
      severity: 'warning',
      details: `Akte ${matter.title} wurde gelöscht.`,
      metadata: {
        matterId,
      },
    });

    return true;
  }

  async deleteMatterCascade(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return false;
    }

    const permission = await this.accessControlService.evaluate('matter.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.delete.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          matterId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return false;
    }

    const linkedCases = Object.values(graph.cases ?? {}).filter(
      (item: CaseFile) => item.matterId === matterId
    );
    const linkedCaseIds = linkedCases.map(c => c.id);
    const linkedDeadlineIds = Array.from(
      new Set(
        linkedCases
          .flatMap(c => c.deadlineIds ?? [])
          .filter(Boolean)
      )
    );
    const linkedTerminIds = Array.from(
      new Set(
        linkedCases
          .flatMap(c => c.terminIds ?? [])
          .filter(Boolean)
      )
    );

    const legalDocs = await this.store.getLegalDocuments();
    const linkedDocs = legalDocs.filter(d => linkedCaseIds.includes(d.caseId));
    if (linkedDocs.length > 0) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.delete.rejected',
        severity: 'warning',
        details:
          'Akte kann nicht gelöscht werden, solange Dokumente verknüpft sind. Bitte zuerst Dokumente entfernen oder Akte archivieren.',
        metadata: {
          matterId,
          linkedDocsCount: String(linkedDocs.length),
        },
      });
      return false;
    }

    if (matter.status !== 'archived') {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.delete.rejected',
        severity: 'warning',
        details: 'Akte muss vor dem Löschen archiviert werden.',
        metadata: {
          matterId,
          status: matter.status,
        },
      });
      return false;
    }

    if (linkedDeadlineIds.length > 0) {
      for (const deadlineId of linkedDeadlineIds) {
        delete graph.deadlines?.[deadlineId];
      }

      if (graph.memoryEvents) {
        for (const memoryEvent of Object.values(graph.memoryEvents)) {
          if (memoryEvent.deadlineId && linkedDeadlineIds.includes(memoryEvent.deadlineId)) {
            delete graph.memoryEvents[memoryEvent.id];
          }
        }
      }
    }

    if (linkedTerminIds.length > 0) {
      for (const terminId of linkedTerminIds) {
        delete graph.termine?.[terminId];
      }
    }

    for (const caseId of linkedCaseIds) {
      delete graph.cases[caseId];
    }
    graph.updatedAt = new Date().toISOString();
    await this.store.setGraph(graph);

    if (linkedCaseIds.length > 0) {
      const [ingestionJobs, ocrJobs, findings, chunks, workflowEvents, auditEntries] =
        await Promise.all([
          this.store.getIngestionJobs(),
          this.store.getOcrJobs(),
          this.store.getLegalFindings(),
          this.store.getSemanticChunks(),
          this.store.getWorkflowEvents(),
          this.store.getAuditEntries(),
        ]);

      await Promise.all([
        this.store.setIngestionJobs(
          ingestionJobs.filter(j => !linkedCaseIds.includes(j.caseId))
        ),
        this.store.setOcrJobs(ocrJobs.filter(j => !linkedCaseIds.includes(j.caseId))),
        this.store.setLegalFindings(
          findings.filter(f => !linkedCaseIds.includes(f.caseId))
        ),
        this.store.setSemanticChunks(
          chunks.filter(c => !linkedCaseIds.includes(c.caseId))
        ),
        this.store.setWorkflowEvents(
          workflowEvents.filter(e => !linkedCaseIds.includes(e.caseId ?? ''))
        ),
        this.store.setAuditEntries(
          auditEntries.filter(e => !linkedCaseIds.includes(e.caseId ?? ''))
        ),
      ]);
    }

    const deleted = await this.store.deleteMatter(matterId);
    if (!deleted) {
      return false;
    }

    await this.appendWorkflowEvent({
      type: 'matter.deleted',
      actor: 'user',
      workspaceId: matter.workspaceId,
      payload: {
        matterId,
      },
    });
    await this.appendAuditEntry({
      workspaceId: matter.workspaceId,
      action: 'matter.deleted',
      severity: 'warning',
      details: `Akte ${matter.title} wurde gelöscht.`,
      metadata: {
        matterId,
        deletedCaseCount: String(linkedCaseIds.length),
        deletedDeadlineCount: String(linkedDeadlineIds.length),
        deletedTerminCount: String(linkedTerminIds.length),
      },
    });

    return true;
  }

  async deleteClient(clientId: string) {
    const graph = await this.store.getGraph();
    const client = graph.clients?.[clientId];
    if (!client) {
      return false;
    }

    const permission = await this.accessControlService.evaluate('client.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: client.workspaceId,
        action: 'client.delete.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          clientId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return false;
    }

    if (clientId === `client:${client.workspaceId}:default`) {
      await this.appendAuditEntry({
        workspaceId: client.workspaceId,
        action: 'client.delete.rejected',
        severity: 'warning',
        details: 'Default-Mandant kann nicht gelöscht werden.',
        metadata: {
          clientId,
        },
      });
      return false;
    }

    const linkedMatter = Object.values(graph.matters ?? {}).find(
      (item: MatterRecord) =>
        item.clientId === clientId || (item.clientIds ?? []).includes(clientId)
    );
    if (linkedMatter) {
      await this.appendAuditEntry({
        workspaceId: client.workspaceId,
        action: 'client.delete.rejected',
        severity: 'warning',
        details: 'Mandant kann nicht gelöscht werden, solange Akten verknüpft sind.',
        metadata: {
          clientId,
          linkedMatterId: linkedMatter.id,
        },
      });
      return false;
    }

    if (!this.hasArchivedTag(client)) {
      await this.appendAuditEntry({
        workspaceId: client.workspaceId,
        action: 'client.delete.rejected',
        severity: 'warning',
        details: 'Mandant muss vor dem Löschen archiviert werden.',
        metadata: {
          clientId,
        },
      });
      return false;
    }

    const deleted = await this.store.deleteClient(clientId);
    if (!deleted) {
      return false;
    }

    await this.appendWorkflowEvent({
      type: 'client.deleted',
      actor: 'user',
      workspaceId: client.workspaceId,
      payload: {
        clientId,
      },
    });
    await this.appendAuditEntry({
      workspaceId: client.workspaceId,
      action: 'client.deleted',
      severity: 'warning',
      details: `Mandant ${client.displayName} wurde gelöscht.`,
      metadata: {
        clientId,
      },
    });

    return true;
  }

  async saveConnectorConfiguration(
    input: Omit<ConnectorConfig, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const permission = await this.accessControlService.evaluate('connector.configure');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: input.workspaceId,
        action: 'connector.configure.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          connectorId: input.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    return await this.upsertConnector(input);
  }

  async setConnectorEnabled(connectorId: string, enabled: boolean) {
    const current = this.getConnectorById(connectorId);
    if (!current) {
      return null;
    }

    const permission = await this.accessControlService.evaluate('connector.toggle');
    if (!permission.ok) {
      await this.appendAuditEntry({
        workspaceId: current.workspaceId,
        action: 'connector.enabled_toggled.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          connectorId: current.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const next = await this.upsertConnector({
      ...current,
      enabled,
      status: enabled ? 'connected' : 'disconnected',
      lastSyncedAt: enabled ? new Date().toISOString() : current.lastSyncedAt,
    });

    await this.appendAuditEntry({
      workspaceId: current.workspaceId,
      action: 'connector.enabled_toggled',
      severity: 'info',
      details: `${current.name} wurde ${enabled ? 'aktiviert' : 'deaktiviert'}.`,
      metadata: {
        connectorId: current.id,
        enabled: String(enabled),
      },
    });

    return next;
  }

  async enqueueIngestionJob(input: {
    caseId: string;
    workspaceId: string;
    sourceType: IntakeSourceType;
    sourceRef: string;
  }) {
    const now = new Date().toISOString();
    const job: IngestionJob = {
      id: createId('ingestion-job'),
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      status: 'queued',
      progress: 0,
      queuedAt: now,
      updatedAt: now,
    };

    await this.store.upsertIngestionJob(job);
    await this.appendWorkflowEvent({
      type: 'job.queued',
      actor: 'user',
      caseId: job.caseId,
      workspaceId: job.workspaceId,
      payload: {
        jobId: job.id,
        sourceType: job.sourceType,
      },
    });

    return job;
  }

  async upsertLegalDocument(input: LegalDocumentRecord) {
    await this.store.upsertLegalDocument(input);
    await this.appendWorkflowEvent({
      type: 'document.uploaded',
      actor: 'user',
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      payload: {
        documentId: input.id,
        documentKind: input.kind,
        status: input.status,
      },
    });
    return input;
  }

  async upsertSemanticChunks(documentId: string, chunks: SemanticChunk[]) {
    if (chunks.some(chunk => chunk.documentId !== documentId)) {
      throw new Error('Semantic chunk payload mismatch: documentId is inconsistent.');
    }

    const caseIds = new Set(chunks.map(chunk => chunk.caseId));
    const workspaceIds = new Set(chunks.map(chunk => chunk.workspaceId));
    if (caseIds.size > 1 || workspaceIds.size > 1) {
      throw new Error('Semantic chunk payload mismatch: mixed case/workspace data detected.');
    }

    // GAP-5 FIX: Optimized upsert — avoid full-array serialization when possible.
    // At scale (500+ docs × 10+ chunks = 5000+ chunks), reading/filtering/writing
    // the entire array on every document intake is expensive and risks hitting
    // V8's JSON.stringify limit (~268M chars).
    const existing = await this.store.getSemanticChunks();

    // Fast path: if no existing chunks for this document, just append
    const hasExisting = existing.some((c: SemanticChunk) => c.documentId === documentId);
    if (!hasExisting) {
      // Append-only — avoids full array copy + filter
      await this.store.setSemanticChunks(existing.concat(chunks));
      return;
    }

    // Replace path: only rebuild if document already had chunks
    const filtered = existing.filter((c: SemanticChunk) => c.documentId !== documentId);
    await this.store.setSemanticChunks(filtered.concat(chunks));
  }

  async upsertQualityReport(report: DocumentQualityReport) {
    const existingDoc = (await this.store.getLegalDocuments()).find(d => d.id === report.documentId);
    if (existingDoc) {
      if (
        existingDoc.caseId !== report.caseId ||
        existingDoc.workspaceId !== report.workspaceId
      ) {
        throw new Error('Quality report payload mismatch: case/workspace differs from source document.');
      }
    }

    const existing = await this.store.getQualityReports();
    const filtered = existing.filter((r: DocumentQualityReport) => r.documentId !== report.documentId);
    await this.store.setQualityReports([...filtered, report]);
  }

  async upsertEmail(record: EmailRecord) {
    await this.store.upsertEmail(record);
    return record;
  }

  async getEmails() {
    return await this.store.getEmails();
  }

  async upsertPortalRequest(record: PortalRequestRecord) {
    await this.store.upsertPortalRequest(record);
    return record;
  }

  async getPortalRequests() {
    return await this.store.getPortalRequests();
  }

  async upsertVollmachtSigningRequest(record: VollmachtSigningRequestRecord) {
    await this.store.upsertVollmachtSigningRequest(record);
    return record;
  }

  async getVollmachtSigningRequests() {
    return await this.store.getVollmachtSigningRequests();
  }

  async upsertKycSubmission(record: KycSubmissionRecord) {
    await this.store.upsertKycSubmission(record);
    return record;
  }

  async getKycSubmissions() {
    return await this.store.getKycSubmissions();
  }

  async upsertOcrJob(record: OcrJob) {
    await this.store.upsertOcrJob(record);
    const typeByStatus: Record<OcrJob['status'], WorkflowEventType> = {
      queued: 'ocr.job.queued',
      running: 'ocr.job.running',
      completed: 'ocr.job.completed',
      failed: 'ocr.job.failed',
      cancelled: 'ocr.job.cancelled',
    };
    const type = typeByStatus[record.status];
    await this.appendWorkflowEvent({
      type,
      actor: 'system',
      caseId: record.caseId,
      workspaceId: record.workspaceId,
      payload: {
        ocrJobId: record.id,
        documentId: record.documentId,
        status: record.status,
        progress: record.progress,
      },
    });
    return record;
  }

  async upsertLegalFinding(record: LegalFinding) {
    await this.store.upsertLegalFinding(record);
    await this.appendWorkflowEvent({
      type: 'analysis.completed',
      actor: 'system',
      caseId: record.caseId,
      workspaceId: record.workspaceId,
      payload: {
        findingId: record.id,
        findingType: record.type,
        confidence: record.confidence,
      },
    });
    return record;
  }

  async upsertCopilotTask(record: CopilotTask) {
    await this.store.upsertCopilotTask(record);
    await this.appendWorkflowEvent({
      type: 'task.generated',
      actor: 'system',
      caseId: record.caseId,
      workspaceId: record.workspaceId,
      payload: {
        taskId: record.id,
        priority: record.priority,
        status: record.status,
      },
    });
    return record;
  }

  async upsertBlueprint(record: CaseBlueprint) {
    await this.store.upsertBlueprint(record);
    await this.appendWorkflowEvent({
      type: 'blueprint.generated',
      actor: record.generatedBy === 'copilot' ? 'system' : 'user',
      caseId: record.caseId,
      workspaceId: record.workspaceId,
      payload: {
        blueprintId: record.id,
        sectionCount: record.sections.length,
      },
    });
    return record;
  }

  async upsertCopilotRun(record: CopilotRun) {
    await this.store.upsertCopilotRun(record);
    return record;
  }

  async upsertCourtDecision(record: CourtDecision) {
    await this.store.upsertCourtDecision(record);
    return record;
  }

  async upsertLegalNormRegistryRecord(record: LegalNormRegistryRecord) {
    await this.store.upsertLegalNormRegistryRecord(record);
    return record;
  }

  async upsertJudikaturSuggestion(record: JudikaturSuggestion) {
    await this.store.upsertJudikaturSuggestion(record);
    return record;
  }

  async upsertCitationChain(record: CitationChain) {
    await this.store.upsertCitationChain(record);
    return record;
  }

  async updateJobStatus(params: {
    jobId: string;
    status: IngestionJobStatus;
    progress?: number;
    errorMessage?: string;
  }) {
    const current = (this.ingestionJobs$.value ?? []).find(
      (job: IngestionJob) => job.id === params.jobId
    );
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    const next: IngestionJob = {
      ...current,
      status: params.status,
      progress: params.progress ?? current.progress,
      errorMessage: params.errorMessage,
      startedAt: current.startedAt ?? (params.status === 'running' ? now : undefined),
      finishedAt:
        params.status === 'completed' ||
        params.status === 'failed' ||
        params.status === 'cancelled'
          ? now
          : current.finishedAt,
      updatedAt: now,
    };

    await this.store.upsertIngestionJob(next);

    const eventType: Record<IngestionJobStatus, WorkflowEventType> = {
      queued: 'job.queued',
      running: 'job.started',
      completed: 'job.completed',
      failed: 'job.failed',
      cancelled: 'job.failed',
    };

    await this.appendWorkflowEvent({
      type: eventType[params.status],
      actor: 'system',
      caseId: next.caseId,
      workspaceId: next.workspaceId,
      payload: {
        jobId: next.id,
        status: next.status,
        progress: next.progress,
        errorMessage: next.errorMessage ?? null,
      },
    });

    return next;
  }

  async cancelIngestionJob(jobId: string) {
    const current = this.getJobById(jobId);
    if (!current) {
      return null;
    }

    const permission = await this.accessControlService.evaluate('job.cancel');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: current.caseId,
        workspaceId: current.workspaceId,
        action: 'job.cancel.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          jobId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (current.status !== 'queued' && current.status !== 'running') {
      return current;
    }

    const next = await this.updateJobStatus({
      jobId,
      status: 'cancelled',
      progress: current.progress,
      errorMessage: 'Vom Nutzer abgebrochen',
    });

    if (next) {
      await this.appendAuditEntry({
        caseId: next.caseId,
        workspaceId: next.workspaceId,
        action: 'job.cancelled',
        severity: 'warning',
        details: `Ingestion-Job ${next.id} wurde manuell abgebrochen.`,
      });
    }

    return next;
  }

  async retryIngestionJob(jobId: string) {
    const current = this.getJobById(jobId);
    if (!current) {
      return null;
    }

    const permission = await this.accessControlService.evaluate('job.retry');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: current.caseId,
        workspaceId: current.workspaceId,
        action: 'job.retry.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          jobId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (current.status !== 'failed' && current.status !== 'cancelled') {
      return current;
    }

    const retried = await this.enqueueIngestionJob({
      caseId: current.caseId,
      workspaceId: current.workspaceId,
      sourceType: current.sourceType,
      sourceRef: `${current.sourceRef}:retry:${Date.now()}`,
    });

    await this.appendAuditEntry({
      caseId: retried.caseId,
      workspaceId: retried.workspaceId,
      action: 'job.retried',
      severity: 'info',
      details: `Retry für Ingestion-Job ${current.id} gestartet als ${retried.id}.`,
    });

    return retried;
  }

  async deleteIngestionJob(jobId: string): Promise<IngestionJob | null> {
    const current = this.getJobById(jobId);
    if (!current) {
      return null;
    }

    const permission = await this.accessControlService.evaluate('job.retry');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: current.caseId,
        workspaceId: current.workspaceId,
        action: 'job.delete.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          jobId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (current.status === 'queued' || current.status === 'running') {
      await this.appendAuditEntry({
        caseId: current.caseId,
        workspaceId: current.workspaceId,
        action: 'job.delete.blocked_running',
        severity: 'warning',
        details: 'Job kann nur gelöscht werden, wenn er nicht queued/running ist. Bitte zuerst abbrechen.',
        metadata: {
          jobId,
          status: current.status,
        },
      });
      return null;
    }

    const existingJobs = await this.store.getIngestionJobs();
    const filteredJobs = existingJobs.filter(j => j.id !== jobId);
    await this.store.setIngestionJobs(filteredJobs);

    const existingEvents = await this.store.getWorkflowEvents();
    const filteredEvents = existingEvents.filter(e => {
      if (e.workspaceId !== current.workspaceId) return true;
      if (e.caseId !== current.caseId) return true;
      return String(e.payload?.jobId ?? '') !== jobId;
    });
    await this.store.setWorkflowEvents(filteredEvents);

    await this.appendAuditEntry({
      caseId: current.caseId,
      workspaceId: current.workspaceId,
      action: 'job.deleted',
      severity: 'info',
      details: `Ingestion-Job ${jobId} wurde gelöscht.`,
    });

    return current;
  }

  async clearIngestionJobHistory(input: {
    caseId: string;
    workspaceId: string;
  }): Promise<IngestionJob[]> {
    const permission = await this.accessControlService.evaluate('job.retry');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'job.history_clear.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return [] as IngestionJob[];
    }

    const existingJobs = await this.store.getIngestionJobs();
    const caseJobs = existingJobs.filter(j => j.caseId === input.caseId && j.workspaceId === input.workspaceId);
    const hasRunning = caseJobs.some(j => j.status === 'queued' || j.status === 'running');
    if (hasRunning) {
      await this.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'job.history_clear.blocked_running',
        severity: 'warning',
        details: 'Verlauf kann nicht gelöscht werden solange Jobs queued/running sind. Bitte zuerst abbrechen.',
      });
      return [];
    }

    const remainingJobs = existingJobs.filter(
      j => !(j.caseId === input.caseId && j.workspaceId === input.workspaceId)
    );
    await this.store.setIngestionJobs(remainingJobs);

    const existingEvents = await this.store.getWorkflowEvents();
    const caseJobIds = new Set(caseJobs.map(j => j.id));
    const remainingEvents = existingEvents.filter(e => {
      if (e.workspaceId !== input.workspaceId) return true;
      if (e.caseId !== input.caseId) return true;
      const jobId = String(e.payload?.jobId ?? '');
      return !caseJobIds.has(jobId);
    });
    await this.store.setWorkflowEvents(remainingEvents);

    await this.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'job.history_cleared',
      severity: 'info',
      details: `Upload-/Ingestion-Verlauf gelöscht (${caseJobs.length} Job(s)).`,
    });

    return caseJobs;
  }

  async restoreIngestionJob(job: IngestionJob): Promise<IngestionJob | null> {
    const permission = await this.accessControlService.evaluate('job.retry');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: job.caseId,
        workspaceId: job.workspaceId,
        action: 'job.restore.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          jobId: job.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    await this.store.upsertIngestionJob(job);
    await this.appendAuditEntry({
      caseId: job.caseId,
      workspaceId: job.workspaceId,
      action: 'job.restored',
      severity: 'info',
      details: `Ingestion-Job ${job.id} wurde wiederhergestellt.`,
    });
    return job;
  }

  async restoreIngestionJobHistory(input: {
    caseId: string;
    workspaceId: string;
    jobs: IngestionJob[];
  }): Promise<number> {
    const permission = await this.accessControlService.evaluate('job.retry');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'job.history_restore.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return 0;
    }

    if (input.jobs.length === 0) {
      return 0;
    }

    const existingJobs = await this.store.getIngestionJobs();
    const existingIds = new Set(existingJobs.map(j => j.id));
    const merged = [...existingJobs];
    for (const job of input.jobs) {
      if (!existingIds.has(job.id)) {
        merged.push(job);
      }
    }
    await this.store.setIngestionJobs(merged);

    await this.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'job.history_restored',
      severity: 'info',
      details: `Upload-/Ingestion-Verlauf wiederhergestellt (${input.jobs.length} Job(s)).`,
    });

    return input.jobs.length;
  }

  async appendWorkflowEvent(
    input: Omit<WorkflowEvent, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: string;
    }
  ) {
    const record: WorkflowEvent = {
      ...input,
      id: input.id ?? createId('workflow-event'),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    await this.store.appendWorkflowEvent(record);
    return record;
  }

  async appendAuditEntry(
    input: Omit<ComplianceAuditEntry, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: string;
    }
  ) {
    const record: ComplianceAuditEntry = {
      ...input,
      id: input.id ?? createId('audit-entry'),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    await this.store.appendAuditEntry(record);
    return record;
  }

  async getGraph() {
    return await this.store.getGraph();
  }

  async getAuditAnchor(scopeId: string) {
    return await this.store.getAuditAnchor(scopeId);
  }

  async upsertAuditAnchor(anchor: AuditChainAnchor) {
    await this.store.upsertAuditAnchor(anchor);
    return anchor;
  }

  // ═══ Deadline Management (Audit-Safe) ═══

  private async resolveDeadlineContext(deadlineId: string) {
    const graph = await this.store.getGraph();
    const deadline = graph.deadlines?.[deadlineId] as CaseDeadline | undefined;
    if (!deadline) return null;

    const caseFile = Object.values(graph.cases ?? {}).find(
      (c: CaseFile) => (c.deadlineIds ?? []).includes(deadlineId)
    );
    const matter = caseFile?.matterId ? graph.matters?.[caseFile.matterId] : undefined;

    return { deadline, caseFile: caseFile ?? null, matter: matter ?? null };
  }

  async markDeadlineAcknowledged(deadlineId: string) {
    const ctx = await this.resolveDeadlineContext(deadlineId);
    if (!ctx) return null;

    const permission = await this.accessControlService.evaluate('deadline.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: ctx.caseFile?.id,
        workspaceId: ctx.caseFile?.workspaceId ?? '',
        action: 'deadline.acknowledge.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          deadlineId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (ctx.deadline.status === 'acknowledged' || ctx.deadline.status === 'completed') {
      return ctx.deadline;
    }

    const now = new Date().toISOString();
    await this.store.upsertDeadline({
      ...ctx.deadline,
      status: 'acknowledged',
      acknowledgedAt: now,
      updatedAt: now,
    });

    const workspaceId = ctx.caseFile?.workspaceId ?? '';
    await this.appendWorkflowEvent({
      type: 'deadline.acknowledged',
      actor: 'user',
      caseId: ctx.caseFile?.id,
      workspaceId,
      payload: {
        deadlineId,
        deadlineTitle: ctx.deadline.title,
        matterId: ctx.matter?.id ?? '',
        matterTitle: ctx.matter?.title ?? '',
        previousStatus: ctx.deadline.status,
      },
    });
    await this.appendAuditEntry({
      caseId: ctx.caseFile?.id,
      workspaceId,
      action: 'deadline.acknowledged',
      severity: 'info',
      details: `Frist „${ctx.deadline.title}" wurde bestätigt (Akte: ${ctx.matter?.title ?? '—'}).`,
      metadata: {
        deadlineId,
        matterId: ctx.matter?.id ?? '',
        dueAt: ctx.deadline.dueAt,
      },
    });

    return { ...ctx.deadline, status: 'acknowledged' as const };
  }

  async markDeadlineCompleted(deadlineId: string) {
    const ctx = await this.resolveDeadlineContext(deadlineId);
    if (!ctx) return null;

    const permission = await this.accessControlService.evaluate('deadline.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: ctx.caseFile?.id,
        workspaceId: ctx.caseFile?.workspaceId ?? '',
        action: 'deadline.complete.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          deadlineId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (ctx.deadline.status === 'completed') {
      return ctx.deadline;
    }

    const completedAt = new Date().toISOString();
    await this.store.upsertDeadline({
      ...ctx.deadline,
      status: 'completed',
      completedAt,
      updatedAt: completedAt,
    });

    const workspaceId = ctx.caseFile?.workspaceId ?? '';
    await this.appendWorkflowEvent({
      type: 'deadline.completed',
      actor: 'user',
      caseId: ctx.caseFile?.id,
      workspaceId,
      payload: {
        deadlineId,
        deadlineTitle: ctx.deadline.title,
        matterId: ctx.matter?.id ?? '',
        matterTitle: ctx.matter?.title ?? '',
        previousStatus: ctx.deadline.status,
      },
    });
    await this.appendAuditEntry({
      caseId: ctx.caseFile?.id,
      workspaceId,
      action: 'deadline.completed',
      severity: 'info',
      details: `Frist „${ctx.deadline.title}" wurde als erledigt markiert (Akte: ${ctx.matter?.title ?? '—'}).`,
      metadata: {
        deadlineId,
        matterId: ctx.matter?.id ?? '',
        dueAt: ctx.deadline.dueAt,
        completedAt,
      },
    });

    return { ...ctx.deadline, status: 'completed' as const };
  }

  async markDeadlineCompletedExternal(deadlineId: string, note?: string) {
    const trimmedNote = note?.trim() ?? '';
    const updated = await this.markDeadlineCompleted(deadlineId);
    if (!updated) return null;

    if (!trimmedNote) {
      return updated;
    }

    const ctx = await this.resolveDeadlineContext(deadlineId);
    if (!ctx) return updated;

    const permission = await this.accessControlService.evaluate('deadline.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: ctx.caseFile?.id,
        workspaceId: ctx.caseFile?.workspaceId ?? '',
        action: 'deadline.complete.note.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          deadlineId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return updated;
    }

    const createdAt = new Date().toISOString();
    const memoryEvent: CaseMemoryEvent = {
      id: createId('memory-event'),
      deadlineId,
      summary: `Extern erledigt: ${trimmedNote}`,
      sourceDocIds: ctx.deadline.sourceDocIds ?? [],
      createdAt,
    };

    await this.store.upsertMemoryEvent(memoryEvent);

    if (ctx.caseFile) {
      const currentIds = ctx.caseFile.memoryEventIds ?? [];
      if (!currentIds.includes(memoryEvent.id)) {
        await this.store.upsertCaseFile({
          ...ctx.caseFile,
          memoryEventIds: [...currentIds, memoryEvent.id],
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const workspaceId = ctx.caseFile?.workspaceId ?? '';
    await this.appendWorkflowEvent({
      type: 'deadline.completed',
      actor: 'user',
      caseId: ctx.caseFile?.id,
      workspaceId,
      payload: {
        deadlineId,
        external: true,
        note: trimmedNote,
        memoryEventId: memoryEvent.id,
        matterId: ctx.matter?.id ?? '',
      },
    });
    await this.appendAuditEntry({
      caseId: ctx.caseFile?.id,
      workspaceId,
      action: 'deadline.completed.external',
      severity: 'info',
      details: `Frist „${ctx.deadline.title}" extern erledigt (Notiz gespeichert).`,
      metadata: {
        deadlineId,
        memoryEventId: memoryEvent.id,
      },
    });

    return updated;
  }

  async reopenDeadline(deadlineId: string) {
    const ctx = await this.resolveDeadlineContext(deadlineId);
    if (!ctx) return null;

    const permission = await this.accessControlService.evaluate('deadline.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: ctx.caseFile?.id,
        workspaceId: ctx.caseFile?.workspaceId ?? '',
        action: 'deadline.reopen.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          deadlineId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    if (ctx.deadline.status === 'open') {
      return ctx.deadline;
    }

    await this.store.upsertDeadline({
      ...ctx.deadline,
      status: 'open',
      updatedAt: new Date().toISOString(),
    });

    const workspaceId = ctx.caseFile?.workspaceId ?? '';
    await this.appendWorkflowEvent({
      type: 'deadline.reopened',
      actor: 'user',
      caseId: ctx.caseFile?.id,
      workspaceId,
      payload: {
        deadlineId,
        deadlineTitle: ctx.deadline.title,
        matterId: ctx.matter?.id ?? '',
        previousStatus: ctx.deadline.status,
      },
    });
    await this.appendAuditEntry({
      caseId: ctx.caseFile?.id,
      workspaceId,
      action: 'deadline.reopened',
      severity: 'warning',
      details: `Frist „${ctx.deadline.title}" wurde wiedereröffnet (Akte: ${ctx.matter?.title ?? '—'}).`,
      metadata: {
        deadlineId,
        matterId: ctx.matter?.id ?? '',
      },
    });

    return { ...ctx.deadline, status: 'open' as const };
  }

  // ═══ Finding Risk Management (Audit-Safe) ═══

  async acknowledgeFinding(findingId: string, note?: string) {
    const findings = await this.store.getLegalFindings();
    const finding = findings.find((f: LegalFinding) => f.id === findingId);
    if (!finding) return null;

    const permission = await this.accessControlService.evaluate('finding.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: finding.caseId,
        workspaceId: finding.workspaceId,
        action: 'finding.acknowledge.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          findingId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    await this.appendWorkflowEvent({
      type: 'finding.acknowledged',
      actor: 'user',
      caseId: finding.caseId,
      workspaceId: finding.workspaceId,
      payload: {
        findingId,
        findingType: finding.type,
        findingTitle: finding.title,
        severity: finding.severity,
        confidence: finding.confidence,
        note: note ?? '',
      },
    });
    await this.appendAuditEntry({
      caseId: finding.caseId,
      workspaceId: finding.workspaceId,
      action: 'finding.acknowledged',
      severity: 'info',
      details: `Risiko-Finding „${finding.title}" wurde vom Anwalt geprüft und bestätigt.${note ? ` Notiz: ${note}` : ''}`,
      metadata: {
        findingId,
        findingType: finding.type,
        severity: finding.severity,
        confidence: String(finding.confidence),
        note: note ?? '',
      },
    });

    return finding;
  }

  async dismissFinding(findingId: string, reason: string) {
    const findings = await this.store.getLegalFindings();
    const finding = findings.find((f: LegalFinding) => f.id === findingId);
    if (!finding) return null;

    const permission = await this.accessControlService.evaluate('finding.manage');
    if (!permission.ok) {
      await this.appendAuditEntry({
        caseId: finding.caseId,
        workspaceId: finding.workspaceId,
        action: 'finding.dismiss.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          findingId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    await this.appendWorkflowEvent({
      type: 'finding.dismissed',
      actor: 'user',
      caseId: finding.caseId,
      workspaceId: finding.workspaceId,
      payload: {
        findingId,
        findingType: finding.type,
        findingTitle: finding.title,
        severity: finding.severity,
        reason,
      },
    });
    await this.appendAuditEntry({
      caseId: finding.caseId,
      workspaceId: finding.workspaceId,
      action: 'finding.dismissed',
      severity: 'warning',
      details: `Risiko-Finding „${finding.title}" wurde vom Anwalt verworfen. Grund: ${reason}`,
      metadata: {
        findingId,
        findingType: finding.type,
        severity: finding.severity,
        reason,
      },
    });

    return finding;
  }

  // ═══ Anwalt-Workflow Features (Gaps) ═══

  async upsertTimeEntry(entry: TimeEntry) {
    const existing = (await this.store.getTimeEntries()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getTimeEntries()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setTimeEntries(updated);
    } else {
      const entries = await this.store.getTimeEntries();
      await this.store.setTimeEntries([...entries, entry]);
    }
    return entry;
  }

  async deleteTimeEntry(entryId: string) {
    const entries = (await this.store.getTimeEntries()).filter(e => e.id !== entryId);
    await this.store.setTimeEntries(entries);
  }

  async upsertWiedervorlage(entry: Wiedervorlage) {
    const existing = (await this.store.getWiedervorlagen()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getWiedervorlagen()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setWiedervorlagen(updated);
    } else {
      const entries = await this.store.getWiedervorlagen();
      await this.store.setWiedervorlagen([...entries, entry]);
    }
    return entry;
  }

  async deleteWiedervorlage(entryId: string) {
    const entries = (await this.store.getWiedervorlagen()).filter(e => e.id !== entryId);
    await this.store.setWiedervorlagen(entries);
  }

  async upsertAktennotiz(entry: Aktennotiz) {
    const existing = (await this.store.getAktennotizen()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getAktennotizen()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setAktennotizen(updated);
    } else {
      const entries = await this.store.getAktennotizen();
      await this.store.setAktennotizen([...entries, entry]);
    }
    return entry;
  }

  async deleteAktennotiz(entryId: string) {
    const entries = (await this.store.getAktennotizen()).filter(e => e.id !== entryId);
    await this.store.setAktennotizen(entries);
  }

  async upsertVollmacht(entry: Vollmacht) {
    const existing = (await this.store.getVollmachten()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getVollmachten()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setVollmachten(updated);
    } else {
      const entries = await this.store.getVollmachten();
      await this.store.setVollmachten([...entries, entry]);
    }
    return entry;
  }

  async deleteVollmacht(entryId: string) {
    const entries = (await this.store.getVollmachten()).filter(e => e.id !== entryId);
    await this.store.setVollmachten(entries);
  }

  async upsertRechnung(entry: RechnungRecord) {
    const existing = (await this.store.getRechnungen()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getRechnungen()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setRechnungen(updated);
    } else {
      const entries = await this.store.getRechnungen();
      await this.store.setRechnungen([...entries, entry]);
    }
    return entry;
  }

  async deleteRechnung(entryId: string) {
    const entries = (await this.store.getRechnungen()).filter(e => e.id !== entryId);
    await this.store.setRechnungen(entries);
  }

  async upsertAuslage(entry: AuslageRecord) {
    const existing = (await this.store.getAuslagen()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getAuslagen()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setAuslagen(updated);
    } else {
      const entries = await this.store.getAuslagen();
      await this.store.setAuslagen([...entries, entry]);
    }
    return entry;
  }

  async deleteAuslage(entryId: string) {
    const entries = (await this.store.getAuslagen()).filter(e => e.id !== entryId);
    await this.store.setAuslagen(entries);
  }

  async upsertKassenbeleg(entry: KassenbelegRecord) {
    const existing = (await this.store.getKassenbelege()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getKassenbelege()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setKassenbelege(updated);
    } else {
      const entries = await this.store.getKassenbelege();
      await this.store.setKassenbelege([...entries, entry]);
    }
    return entry;
  }

  async deleteKassenbeleg(entryId: string) {
    const entries = (await this.store.getKassenbelege()).filter(e => e.id !== entryId);
    await this.store.setKassenbelege(entries);
  }

  async upsertFiscalSignature(entry: FiscalSignatureRecord) {
    const existing = (await this.store.getFiscalSignatures()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getFiscalSignatures()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setFiscalSignatures(updated);
    } else {
      const entries = await this.store.getFiscalSignatures();
      await this.store.setFiscalSignatures([...entries, entry]);
    }
    return entry;
  }

  async getLatestFiscalSignature(workspaceId: string) {
    const entries = (await this.store.getFiscalSignatures())
      .filter(e => e.workspaceId === workspaceId)
      .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
    return entries[0] ?? null;
  }

  async upsertExportJournal(entry: ExportJournalRecord) {
    const existing = (await this.store.getExportJournal()).find(e => e.id === entry.id);
    if (existing) {
      const updated = (await this.store.getExportJournal()).map(e =>
        e.id === entry.id ? entry : e
      );
      await this.store.setExportJournal(updated);
    } else {
      const entries = await this.store.getExportJournal();
      await this.store.setExportJournal([...entries, entry]);
    }
    return entry;
  }

  async getLatestExportJournal(workspaceId: string) {
    const entries = (await this.store.getExportJournal())
      .filter(e => e.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return entries[0] ?? null;
  }
}
