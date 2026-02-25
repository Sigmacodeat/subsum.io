import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type {
  Aktennotiz,
  AuditChainAnchor,
  AuslageRecord,
  CaseAssistantAction,
  CaseAssistantRole,
  CaseBlueprint,
  CaseDeadline,
  CaseFile,
  CaseMemoryEvent,
  CitationChain,
  ClientRecord,
  ComplianceAuditEntry,
  ConnectorConfig,
  CopilotRun,
  CopilotTask,
  CourtDecision,
  DocumentQualityReport,
  EmailRecord,
  ExportJournalRecord,
  FiscalSignatureRecord,
  Gerichtstermin,
  IngestionJob,
  IngestionJobStatus,
  IntakeSourceType,
  JudikaturSuggestion,
  KassenbelegRecord,
  KycSubmissionRecord,
  LegalDocumentRecord,
  LegalFinding,
  LegalNormRegistryRecord,
  MatterRecord,
  OcrJob,
  OpposingParty,
  PortalRequestRecord,
  RechnungRecord,
  SemanticChunk,
  TimeEntry,
  Vollmacht,
  VollmachtSigningRequestRecord,
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
  readonly vollmachtSigningRequests$ =
    this.store.watchVollmachtSigningRequests();
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
    const permission =
      await this.accessControlService.evaluate('residency.manage');
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

  private async postLegalApi<T = any>(
    endpoint: string,
    payload: unknown
  ): Promise<T | null> {
    if (typeof globalThis.fetch !== 'function') {
      return null;
    }
    try {
      const res = await globalThis.fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-affine-version': BUILD_CONFIG.appVersion,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  private async deleteLegalApi(endpoint: string): Promise<boolean> {
    if (typeof globalThis.fetch !== 'function') {
      return false;
    }
    try {
      const res = await globalThis.fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'x-affine-version': BUILD_CONFIG.appVersion,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async getLegalApi<T = any>(endpoint: string): Promise<T | null> {
    if (typeof globalThis.fetch !== 'function') {
      return null;
    }
    try {
      const res = await globalThis.fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-affine-version': BUILD_CONFIG.appVersion,
        },
      });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async syncLegalDomainFromBackendBestEffort() {
    const workspaceId = this.store.getWorkspaceId();
    if (!workspaceId) {
      return false;
    }

    const [
      clientsRes,
      mattersRes,
      caseFilesRes,
      deadlinesRes,
      timeEntriesRes,
      invoicesRes,
    ] =
      await Promise.all([
        this.getLegalApi<{ items?: any[] }>(
          `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/clients?limit=500`
        ),
        this.getLegalApi<{ items?: any[] }>(
          `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/matters?limit=500&includeTrashed=true`
        ),
        this.getLegalApi<{ items?: any[] }>(
          `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/case-files?limit=1000`
        ),
        this.getLegalApi<{ items?: any[] }>(
          `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/deadlines?limit=1000`
        ),
        this.getLegalApi<{ items?: any[] }>(
          `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/time-entries?limit=1000`
        ),
        this.getLegalApi<{ items?: any[] }>(
          `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/invoices?limit=500`
        ),
      ]);

    const remoteClients = clientsRes?.items ?? [];
    const remoteMatters = mattersRes?.items ?? [];
    const remoteCaseFiles = caseFilesRes?.items ?? [];
    const remoteDeadlines = deadlinesRes?.items ?? [];
    const remoteTimeEntries = timeEntriesRes?.items ?? [];
    const remoteInvoices = invoicesRes?.items ?? [];

    // Early return if no data at all
    if (
      remoteClients.length === 0 &&
      remoteMatters.length === 0 &&
      remoteCaseFiles.length === 0 &&
      remoteDeadlines.length === 0 &&
      remoteTimeEntries.length === 0 &&
      remoteInvoices.length === 0
    ) {
      return false;
    }

    const graph = await this.store.getGraph();
    const nextGraph = {
      ...graph,
      clients: { ...graph.clients },
      matters: { ...graph.matters },
      deadlines: { ...graph.deadlines },
      cases: { ...graph.cases },
    };

    let hasTimeEntryChanges = false;
    let hasInvoiceChanges = false;

    // Clients
    let hasClientChanges = false;
    for (const c of remoteClients) {
      const kind =
        c.kind === 'person' || c.kind === 'company' || c.kind === 'authority'
          ? c.kind
          : 'other';
      const clientRecord = {
        id: c.id,
        workspaceId,
        kind,
        displayName: c.displayName ?? c.companyName ?? c.firstName ?? 'Mandant',
        identifiers: Array.isArray(c.identifiers) ? c.identifiers : [],
        primaryEmail: c.primaryEmail ?? undefined,
        primaryPhone: c.primaryPhone ?? undefined,
        address: c.address ?? undefined,
        notes: c.notes ?? undefined,
        tags: Array.isArray(c.tags) ? c.tags : [],
        archived: Boolean(c.archived),
        createdAt: new Date(c.createdAt ?? Date.now()).toISOString(),
        updatedAt: new Date(c.updatedAt ?? Date.now()).toISOString(),
      };

      // Only update if the record has changed
      const existing = nextGraph.clients[c.id];
      if (
        !existing ||
        JSON.stringify(existing) !== JSON.stringify(clientRecord)
      ) {
        nextGraph.clients[c.id] = clientRecord;
        hasClientChanges = true;
      }
    }

    // Matters
    let hasMatterChanges = false;
    for (const m of remoteMatters) {
      const matterId = String(m.id);
      const existing = nextGraph.matters[matterId];
      const authorities = (m.metadata?.structuredAuthorities ?? {}) as Record<
        string,
        string | null
      >;
      const matterRecord: MatterRecord = {
        id: matterId,
        workspaceId,
        clientId: String(m.clientId),
        clientIds: Array.isArray(m.clientIds)
          ? m.clientIds.map(String)
          : undefined,
        jurisdiction: m.jurisdiction ?? undefined,
        assignedAnwaltId:
          typeof m.assignedAnwaltId === 'string'
            ? m.assignedAnwaltId
            : m.assignedAnwaltId != null
              ? String(m.assignedAnwaltId)
              : undefined,
        assignedAnwaltIds: Array.isArray(m.assignedAnwaltIds)
          ? m.assignedAnwaltIds.map(String)
          : undefined,
        title: m.title ?? existing?.title ?? 'Akte',
        description: m.summary ?? existing?.description,
        externalRef: m.externalRef ?? undefined,
        authorityReferences: Array.isArray(m.metadata?.authorityReferences)
          ? m.metadata.authorityReferences
          : undefined,
        gericht: m.gericht ?? undefined,
        polizei: authorities.polizei ?? undefined,
        staatsanwaltschaft: authorities.staatsanwaltschaft ?? undefined,
        richter: authorities.richter ?? undefined,
        gerichtsaktenzeichen:
          authorities.gerichtsaktenzeichen ?? m.aktenzeichen ?? undefined,
        staatsanwaltschaftAktenzeichen:
          authorities.staatsanwaltschaftAktenzeichen ?? undefined,
        polizeiAktenzeichen: authorities.polizeiAktenzeichen ?? undefined,
        status:
          m.status === 'closed' || m.status === 'archived' ? m.status : 'open',
        opposingParties:
          m.gegnerName || m.gegnerAnwalt
            ? [
                {
                  id: `op-${String(m.id)}`,
                  kind: 'person',
                  displayName: String(m.gegnerName ?? 'Gegenseite'),
                  lawFirm:
                    m.gegnerAnwalt != null ? String(m.gegnerAnwalt) : undefined,
                } satisfies OpposingParty,
              ]
            : existing?.opposingParties,
        tags: Array.isArray(m.tags) ? m.tags : [],
        archivedAt:
          m.status === 'archived'
            ? new Date(m.updatedAt ?? Date.now()).toISOString()
            : undefined,
        trashedAt: m.trashedAt
          ? new Date(m.trashedAt).toISOString()
          : undefined,
        purgeAt: m.purgeAt ? new Date(m.purgeAt).toISOString() : undefined,
        createdAt: new Date(m.createdAt ?? Date.now()).toISOString(),
        updatedAt: new Date(m.updatedAt ?? Date.now()).toISOString(),
      };

      // Only update if the record has changed
      if (
        !existing ||
        JSON.stringify(existing) !== JSON.stringify(matterRecord)
      ) {
        nextGraph.matters[matterId] = matterRecord;
        hasMatterChanges = true;
      }
    }

    // Case files
    let hasCaseFileChanges = false;
    for (const c of remoteCaseFiles) {
      const caseFileId = String(c.id);
      const existing = nextGraph.cases[caseFileId];
      const metadata = (c.metadata ?? {}) as Record<string, unknown>;

      const caseFileRecord: CaseFile = {
        id: caseFileId,
        workspaceId,
        matterId: c.matterId ? String(c.matterId) : existing?.matterId,
        title: c.title ?? existing?.title ?? 'Fallakte',
        summary: c.summary ?? existing?.summary,
        externalRef:
          typeof metadata['externalRef'] === 'string'
            ? metadata['externalRef']
            : existing?.externalRef,
        actorIds: Array.isArray(metadata['actorIds'])
          ? (metadata['actorIds'] as string[]).map(String)
          : (existing?.actorIds ?? []),
        issueIds: Array.isArray(metadata['issueIds'])
          ? (metadata['issueIds'] as string[]).map(String)
          : (existing?.issueIds ?? []),
        deadlineIds: Array.isArray(c.deadlineIds)
          ? c.deadlineIds.map(String)
          : Array.isArray(metadata['deadlineIds'])
            ? (metadata['deadlineIds'] as string[]).map(String)
            : (existing?.deadlineIds ?? []),
        terminIds: Array.isArray(metadata['terminIds'])
          ? (metadata['terminIds'] as string[]).map(String)
          : existing?.terminIds,
        memoryEventIds: Array.isArray(metadata['memoryEventIds'])
          ? (metadata['memoryEventIds'] as string[]).map(String)
          : (existing?.memoryEventIds ?? []),
        tags: Array.isArray(metadata['tags'])
          ? (metadata['tags'] as string[]).map(String)
          : (existing?.tags ?? []),
        createdAt: new Date(c.createdAt ?? Date.now()).toISOString(),
        updatedAt: new Date(c.updatedAt ?? Date.now()).toISOString(),
      };

      if (
        !existing ||
        JSON.stringify(existing) !== JSON.stringify(caseFileRecord)
      ) {
        nextGraph.cases[caseFileId] = caseFileRecord;
        hasCaseFileChanges = true;
      }
    }

    // Deadlines + case linkage
    let hasDeadlineChanges = false;
    let hasCaseLinkageChanges = false;
    for (const d of remoteDeadlines) {
      const deadline: CaseDeadline = {
        id: d.id,
        title: d.title ?? 'Frist',
        dueAt: new Date(d.dueAt ?? Date.now()).toISOString(),
        derivedFrom: d.legalBasis ? 'manual' : undefined,
        baseEventAt: undefined,
        detectionConfidence:
          typeof d.metadata?.detectionConfidence === 'number'
            ? d.metadata.detectionConfidence
            : undefined,
        requiresReview: Boolean(d.metadata?.requiresReview),
        evidenceSnippets: Array.isArray(d.metadata?.sourceDocIds)
          ? d.metadata.sourceDocIds
          : undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
        sourceDocIds: Array.isArray(d.metadata?.sourceDocIds)
          ? d.metadata.sourceDocIds
          : [],
        status:
          d.status === 'alerted' ||
          d.status === 'acknowledged' ||
          d.status === 'completed' ||
          d.status === 'expired'
            ? d.status
            : 'open',
        priority:
          d.priority === 'critical' ||
          d.priority === 'high' ||
          d.priority === 'medium' ||
          d.priority === 'low'
            ? d.priority
            : 'medium',
        reminderOffsetsInMinutes: Array.isArray(d.reminderOffsetsMinutes)
          ? d.reminderOffsetsMinutes
          : [1440, 60, 15],
        alertedAt: undefined,
        acknowledgedAt: d.acknowledgedAt
          ? new Date(d.acknowledgedAt).toISOString()
          : undefined,
        completedAt: d.completedAt
          ? new Date(d.completedAt).toISOString()
          : undefined,
        createdAt: new Date(d.createdAt ?? Date.now()).toISOString(),
        updatedAt: new Date(d.updatedAt ?? Date.now()).toISOString(),
      };

      // Only update if the record has changed
      const existing = nextGraph.deadlines[d.id];
      if (!existing || JSON.stringify(existing) !== JSON.stringify(deadline)) {
        nextGraph.deadlines[d.id] = deadline;
        hasDeadlineChanges = true;
      }

      const caseId =
        typeof d.caseFileId === 'string'
          ? d.caseFileId
          : (Object.values(nextGraph.cases).find(c => c.matterId === d.matterId)
              ?.id ?? null);

      if (caseId && nextGraph.cases[caseId]) {
        const currentDeadlineIds = nextGraph.cases[caseId].deadlineIds ?? [];
        if (!currentDeadlineIds.includes(d.id)) {
          nextGraph.cases[caseId] = {
            ...nextGraph.cases[caseId],
            deadlineIds: [...currentDeadlineIds, d.id],
            updatedAt: new Date().toISOString(),
          };
          hasCaseLinkageChanges = true;
        }
      }
    }

    const hasGraphChanges =
      hasClientChanges ||
      hasMatterChanges ||
      hasCaseFileChanges ||
      hasDeadlineChanges ||
      hasCaseLinkageChanges;

    if (hasGraphChanges) {
      nextGraph.updatedAt = new Date().toISOString();
      await this.store.setGraph(nextGraph);
    }

    // Time entries
    if (remoteTimeEntries.length > 0) {
      const existingTimeEntries = await this.store.getTimeEntries();
      const nextTimeEntries = new Map<string, TimeEntry>(
        existingTimeEntries.map((item: TimeEntry) => [item.id, item])
      );
      for (const item of remoteTimeEntries) {
        const caseId =
          Object.values(nextGraph.cases).find(c => c.matterId === item.matterId)
            ?.id ?? `case:${item.matterId}`;
        const timeEntryRecord: TimeEntry = {
          id: item.id,
          workspaceId,
          caseId,
          matterId: item.matterId,
          clientId: item.clientId,
          anwaltId: item.anwaltId,
          description: item.description ?? '',
          activityType: item.activityType ?? 'sonstiges',
          durationMinutes: Number(item.durationMinutes ?? 0),
          hourlyRate: Number(item.hourlyRate ?? 0),
          amount: Number(item.amount ?? 0),
          date: new Date(item.date ?? Date.now()).toISOString().slice(0, 10),
          status:
            item.status === 'submitted' ||
            item.status === 'approved' ||
            item.status === 'invoiced' ||
            item.status === 'rejected'
              ? item.status
              : 'draft',
          invoiceId: item.invoiceId ?? undefined,
          createdAt: new Date(item.createdAt ?? Date.now()).toISOString(),
          updatedAt: new Date(item.updatedAt ?? Date.now()).toISOString(),
        };

        // Only update if the record has changed
        const existing = nextTimeEntries.get(item.id);
        if (
          !existing ||
          JSON.stringify(existing) !== JSON.stringify(timeEntryRecord)
        ) {
          nextTimeEntries.set(item.id, timeEntryRecord);
          hasTimeEntryChanges = true;
        }
      }
      if (hasTimeEntryChanges) {
        await this.store.setTimeEntries(Array.from(nextTimeEntries.values()));
      }
    }

    // Invoices
    if (remoteInvoices.length > 0) {
      const existingInvoices = await this.store.getRechnungen();
      const nextInvoices = new Map<string, RechnungRecord>(
        existingInvoices.map((item: RechnungRecord) => [item.id, item])
      );
      for (const item of remoteInvoices) {
        const caseId =
          Object.values(nextGraph.cases).find(c => c.matterId === item.matterId)
            ?.id ?? `case:${item.matterId}`;
        const lineItems = Array.isArray(item.lineItems) ? item.lineItems : [];
        const invoiceRecord: RechnungRecord = {
          id: item.id,
          workspaceId,
          matterId: item.matterId,
          caseId,
          clientId: item.clientId,
          rechnungsnummer: item.invoiceNumber ?? `RE-${item.id.slice(0, 8)}`,
          rechnungsdatum: item.issuedAt
            ? new Date(item.issuedAt).toISOString().slice(0, 10)
            : new Date(item.createdAt ?? Date.now()).toISOString().slice(0, 10),
          faelligkeitsdatum: item.dueDate
            ? new Date(item.dueDate).toISOString().slice(0, 10)
            : new Date(item.createdAt ?? Date.now()).toISOString().slice(0, 10),
          betreff: item.notes ?? 'Rechnung',
          positionen: lineItems.map((li: any) => ({
            bezeichnung: li.description ?? 'Leistung',
            anzahl: Number(li.quantity ?? 1),
            einheit: 'stück' as const,
            einzelpreis: Number((li.unitPriceCents ?? 0) / 100),
            gesamt: Number((li.totalCents ?? 0) / 100),
            timeEntryId: li.timeEntryId ?? undefined,
          })),
          netto: Number((item.subtotalCents ?? 0) / 100),
          ustProzent: Number((item.taxRateBps ?? 0) / 100),
          ustBetrag: Number((item.taxAmountCents ?? 0) / 100),
          brutto: Number((item.totalCents ?? 0) / 100),
          status:
            item.status === 'sent'
              ? 'versendet'
              : item.status === 'paid'
                ? 'bezahlt'
                : item.status === 'overdue'
                  ? 'mahnung_1'
                  : item.status === 'cancelled'
                    ? 'storniert'
                    : 'entwurf',
          mahnungen: [],
          createdAt: new Date(item.createdAt ?? Date.now()).toISOString(),
          updatedAt: new Date(item.updatedAt ?? Date.now()).toISOString(),
        };

        // Only update if the record has changed
        const existing = nextInvoices.get(item.id);
        if (
          !existing ||
          JSON.stringify(existing) !== JSON.stringify(invoiceRecord)
        ) {
          nextInvoices.set(item.id, invoiceRecord);
          hasInvoiceChanges = true;
        }
      }
      if (hasInvoiceChanges) {
        await this.store.setRechnungen(Array.from(nextInvoices.values()));
      }
    }

    return hasGraphChanges || hasTimeEntryChanges || hasInvoiceChanges;
  }

  private toLegalClientPayload(record: ClientRecord) {
    return {
      id: record.id,
      kind: record.kind === 'other' ? 'person' : record.kind,
      displayName: record.displayName,
      primaryEmail: record.primaryEmail,
      primaryPhone: record.primaryPhone,
      address: record.address,
      notes: record.notes,
      tags: record.tags,
      archived: record.archived,
      identifiers: record.identifiers,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toLegalCaseFilePayload(record: CaseFile) {
    return {
      id: record.id,
      matterId: record.matterId,
      title: record.title,
      summary: record.summary,
      priority: 'medium',
      docIds: [],
      deadlineIds: record.deadlineIds,
      metadata: {
        actorIds: record.actorIds,
        issueIds: record.issueIds,
        memoryEventIds: record.memoryEventIds,
        terminIds: record.terminIds ?? [],
        tags: record.tags,
        externalRef: record.externalRef,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toLegalMatterPayload(record: MatterRecord) {
    return {
      id: record.id,
      clientId: record.clientId,
      title: record.title,
      externalRef: record.externalRef,
      status: record.status,
      jurisdiction: record.jurisdiction,
      gericht: record.gericht,
      aktenzeichen: record.gerichtsaktenzeichen,
      assignedAnwaltId: record.assignedAnwaltId,
      assignedAnwaltIds: record.assignedAnwaltIds,
      gegnerName: record.opposingParties?.[0]?.displayName,
      gegnerAnwalt: record.opposingParties?.[0]?.lawFirm,
      summary: record.description,
      metadata: {
        authorityReferences: record.authorityReferences ?? [],
        structuredAuthorities: {
          polizei: record.polizei ?? null,
          staatsanwaltschaft: record.staatsanwaltschaft ?? null,
          richter: record.richter ?? null,
          gerichtsaktenzeichen: record.gerichtsaktenzeichen ?? null,
          staatsanwaltschaftAktenzeichen:
            record.staatsanwaltschaftAktenzeichen ?? null,
          polizeiAktenzeichen: record.polizeiAktenzeichen ?? null,
        },
      },
      tags: record.tags,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private resolveMatterIdForDeadline(
    graph: Awaited<ReturnType<CaseAssistantStore['getGraph']>>,
    deadlineId: string
  ): string | undefined {
    const caseFiles = Object.values(graph.cases ?? {}) as CaseFile[];
    for (const c of caseFiles) {
      if ((c.deadlineIds ?? []).includes(deadlineId) && c.matterId) {
        return c.matterId;
      }
    }
    return undefined;
  }

  private toLegalDeadlinePayload(
    record: CaseDeadline,
    matterId: string,
    caseFileId?: string
  ) {
    return {
      id: record.id,
      matterId,
      caseFileId,
      title: record.title,
      description: record.evidenceSnippets?.join('\n') ?? undefined,
      category: 'frist',
      priority: record.priority,
      status: record.status,
      dueAt: record.dueAt,
      allDay: false,
      reminderOffsetsMinutes: record.reminderOffsetsInMinutes,
      legalBasis: record.derivedFrom,
      metadata: {
        sourceDocIds: record.sourceDocIds,
        detectionConfidence: record.detectionConfidence,
        requiresReview: record.requiresReview,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toLegalTimeEntryPayload(entry: TimeEntry) {
    return {
      id: entry.id,
      matterId: entry.matterId,
      clientId: entry.clientId,
      anwaltId: entry.anwaltId,
      description: entry.description,
      activityType: entry.activityType,
      durationMinutes: entry.durationMinutes,
      hourlyRate: entry.hourlyRate,
      date: entry.date,
      status: entry.status,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  private mapRechnungStatusToLegalInvoice(
    status: RechnungRecord['status']
  ): 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'credited' {
    switch (status) {
      case 'entwurf':
        return 'draft';
      case 'versendet':
        return 'sent';
      case 'bezahlt':
      case 'teilbezahlt':
        return 'paid';
      case 'storniert':
        return 'cancelled';
      case 'mahnung_1':
      case 'mahnung_2':
      case 'inkasso':
        return 'overdue';
      default:
        return 'draft';
    }
  }

  async canAccess(action: CaseAssistantAction) {
    return await this.accessControlService.can(action);
  }

  async evaluatePermission(action: CaseAssistantAction) {
    return await this.accessControlService.evaluate(action);
  }

  private getConnectorById(connectorId: string) {
    return (
      (this.connectors$.value ?? []).find(
        (item: ConnectorConfig) => item.id === connectorId
      ) ?? null
    );
  }

  private getJobById(jobId: string) {
    return (
      (this.ingestionJobs$.value ?? []).find(
        (item: IngestionJob) => item.id === jobId
      ) ?? null
    );
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
        const nextTerminIds = (caseFile.terminIds ?? []).filter(
          id => id !== terminId
        );
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

    const workspaceId =
      Object.values(graph.cases ?? {})[0]?.workspaceId ?? 'workspace:unknown';
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

  async deleteMattersCascadeBulk(matterIds: string[]): Promise<{
    total: number;
    succeededIds: string[];
    blockedIds: string[];
    failedIds: string[];
  }> {
    const uniqueMatterIds = [...new Set(matterIds.filter(Boolean))];
    const succeededIds: string[] = [];
    const blockedIds: string[] = [];
    const failedIds: string[] = [];

    for (const matterId of uniqueMatterIds) {
      try {
        const deleted = await this.deleteMatterCascade(matterId);
        if (deleted) {
          succeededIds.push(matterId);
        } else {
          blockedIds.push(matterId);
        }
      } catch {
        failedIds.push(matterId);
      }
    }

    return {
      total: uniqueMatterIds.length,
      succeededIds,
      blockedIds,
      failedIds,
    };
  }

  async upsertClient(
    input: Omit<ClientRecord, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const permission =
      await this.accessControlService.evaluate('client.manage');
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

    await this.postLegalApi(
      `/api/legal/workspaces/${encodeURIComponent(record.workspaceId)}/clients`,
      this.toLegalClientPayload(record)
    );

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
    const permission =
      await this.accessControlService.evaluate('matter.manage');
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
    const invalidAssignedAnwaltIds = uniqueAssignedAnwaltIds.filter(
      anwaltId => {
        const anwalt = graph.anwaelte?.[anwaltId];
        return !anwalt || !anwalt.isActive;
      }
    );
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
        uniqueAssignedAnwaltIds.length > 0
          ? uniqueAssignedAnwaltIds
          : undefined,
      createdAt: input.createdAt ?? current?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    await this.postLegalApi(
      `/api/legal/workspaces/${encodeURIComponent(record.workspaceId)}/matters`,
      this.toLegalMatterPayload(record)
    );

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

    if (record.matterId) {
      await this.postLegalApi(
        `/api/legal/workspaces/${encodeURIComponent(record.workspaceId)}/case-files`,
        this.toLegalCaseFilePayload(record)
      );
    }

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
    const workspaceId =
      Object.values(graph.cases ?? {})[0]?.workspaceId ?? 'workspace:unknown';

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
        normalizedOffsets.length > 0
          ? normalizedOffsets
          : DEFAULT_REMINDER_OFFSETS,
      createdAt: current?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    const caseFiles = Object.values(graph.cases ?? {}) as CaseFile[];
    const linkedCase = caseFiles.find(c =>
      (c.deadlineIds ?? []).includes(record.id)
    );
    const matterId = this.resolveMatterIdForDeadline(graph, record.id);
    if (matterId) {
      await this.postLegalApi(
        `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/deadlines`,
        this.toLegalDeadlinePayload(record, matterId, linkedCase?.id)
      );
    }

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

  async assignCaseMatter(input: {
    caseId: string;
    workspaceId: string;
    matterId: string;
  }) {
    const permission =
      await this.accessControlService.evaluate('matter.manage');
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
    if (
      caseFile.workspaceId !== input.workspaceId ||
      matter.workspaceId !== input.workspaceId
    ) {
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

    const permission =
      await this.accessControlService.evaluate('matter.manage');
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

    const { trashedAt, purgeAt } = buildTrashTimestamps(
      MATTER_TRASH_RETENTION_DAYS
    );
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

  async restoreMattersBulk(matterIds: string[]): Promise<{
    total: number;
    succeededIds: string[];
    blockedIds: string[];
    failedIds: string[];
  }> {
    const uniqueMatterIds = [...new Set(matterIds.filter(Boolean))];
    const succeededIds: string[] = [];
    const blockedIds: string[] = [];
    const failedIds: string[] = [];

    for (const matterId of uniqueMatterIds) {
      try {
        const restored = await this.restoreMatter(matterId);
        if (restored) {
          succeededIds.push(matterId);
        } else {
          blockedIds.push(matterId);
        }
      } catch {
        failedIds.push(matterId);
      }
    }

    return {
      total: uniqueMatterIds.length,
      succeededIds,
      blockedIds,
      failedIds,
    };
  }

  async restoreMatter(matterId: string) {
    const graph = await this.store.getGraph();
    const matter = graph.matters?.[matterId];
    if (!matter) {
      return null;
    }

    const permission =
      await this.accessControlService.evaluate('matter.manage');
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

    await this.postLegalApi(
      `/api/legal/workspaces/${encodeURIComponent(matter.workspaceId)}/matters/${encodeURIComponent(matterId)}/restore`,
      {}
    );

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

    const permission =
      await this.accessControlService.evaluate('matter.manage');
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
      new Set(linkedCases.flatMap(c => c.deadlineIds ?? []).filter(Boolean))
    );
    const linkedTerminIds = Array.from(
      new Set(linkedCases.flatMap(c => c.terminIds ?? []).filter(Boolean))
    );

    const legalDocs = await this.store.getLegalDocuments();
    const linkedDocs = legalDocs.filter(d => linkedCaseIds.includes(d.caseId));
    if (linkedDocs.length > 0) {
      await this.appendAuditEntry({
        workspaceId: matter.workspaceId,
        action: 'matter.purge.rejected',
        severity: 'warning',
        details:
          'Akte kann nicht endgültig gelöscht werden, solange Dokumente verknüpft sind.',
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
          if (
            memoryEvent.deadlineId &&
            linkedDeadlineIds.includes(memoryEvent.deadlineId)
          ) {
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
      const [
        ingestionJobs,
        ocrJobs,
        findings,
        chunks,
        workflowEvents,
        auditEntries,
      ] = await Promise.all([
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
        this.store.setOcrJobs(
          ocrJobs.filter(j => !linkedCaseIds.includes(j.caseId))
        ),
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

    await this.postLegalApi(
      `/api/legal/workspaces/${encodeURIComponent(matter.workspaceId)}/matters/${encodeURIComponent(matterId)}/trash`,
      {}
    );

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

    const permission =
      await this.accessControlService.evaluate('matter.manage');
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
        details:
          'Akte kann nicht gelöscht werden, solange Cases verknüpft sind.',
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

    const permission =
      await this.accessControlService.evaluate('matter.manage');
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
      new Set(linkedCases.flatMap(c => c.deadlineIds ?? []).filter(Boolean))
    );
    const linkedTerminIds = Array.from(
      new Set(linkedCases.flatMap(c => c.terminIds ?? []).filter(Boolean))
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
          if (
            memoryEvent.deadlineId &&
            linkedDeadlineIds.includes(memoryEvent.deadlineId)
          ) {
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
      const [
        ingestionJobs,
        ocrJobs,
        findings,
        chunks,
        workflowEvents,
        auditEntries,
      ] = await Promise.all([
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
        this.store.setOcrJobs(
          ocrJobs.filter(j => !linkedCaseIds.includes(j.caseId))
        ),
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

    const permission =
      await this.accessControlService.evaluate('client.manage');
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
        details:
          'Mandant kann nicht gelöscht werden, solange Akten verknüpft sind.',
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

    await this.deleteLegalApi(
      `/api/legal/workspaces/${encodeURIComponent(client.workspaceId)}/clients/${encodeURIComponent(clientId)}`
    );

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

  async deleteClientsBulk(clientIds: string[]): Promise<{
    total: number;
    succeededIds: string[];
    blockedIds: string[];
    failedIds: string[];
  }> {
    const uniqueClientIds = [...new Set(clientIds.filter(Boolean))];
    const succeededIds: string[] = [];
    const blockedIds: string[] = [];
    const failedIds: string[] = [];

    for (const clientId of uniqueClientIds) {
      try {
        const deleted = await this.deleteClient(clientId);
        if (deleted) {
          succeededIds.push(clientId);
        } else {
          blockedIds.push(clientId);
        }
      } catch {
        failedIds.push(clientId);
      }
    }

    return {
      total: uniqueClientIds.length,
      succeededIds,
      blockedIds,
      failedIds,
    };
  }

  async deleteDocumentsCascade(documentIds: string[]): Promise<{
    total: number;
    succeededIds: string[];
    blockedIds: string[];
    failedIds: string[];
  }> {
    const uniqueDocumentIds = [...new Set(documentIds.filter(Boolean))];
    const succeededIds: string[] = [];
    const blockedIds: string[] = [];
    const failedIds: string[] = [];

    if (uniqueDocumentIds.length === 0) {
      return {
        total: 0,
        succeededIds,
        blockedIds,
        failedIds,
      };
    }

    const permission =
      await this.accessControlService.evaluate('document.upload');
    if (!permission.ok) {
      for (const documentId of uniqueDocumentIds) {
        blockedIds.push(documentId);
      }
      return {
        total: uniqueDocumentIds.length,
        succeededIds,
        blockedIds,
        failedIds,
      };
    }

    const [legalDocs, trashedDocs, chunks, qualityReports, ocrJobs, findings] =
      await Promise.all([
        this.store.getLegalDocuments(),
        this.store.getTrashedLegalDocuments(),
        this.store.getSemanticChunks(),
        this.store.getQualityReports(),
        this.store.getOcrJobs(),
        this.store.getLegalFindings(),
      ]);

    const docById = new Map(legalDocs.map(doc => [doc.id, doc] as const));
    const trashedById = new Map(trashedDocs.map(doc => [doc.id, doc] as const));
    const { trashedAt, purgeAt } = buildTrashTimestamps(
      DOCUMENT_TRASH_RETENTION_DAYS
    );
    const movedDocs: LegalDocumentRecord[] = [];

    for (const documentId of uniqueDocumentIds) {
      const doc = docById.get(documentId);
      if (!doc) {
        blockedIds.push(documentId);
        continue;
      }

      try {
        const movedToTrash: LegalDocumentRecord = {
          ...doc,
          trashedAt,
          purgeAt,
          updatedAt: new Date().toISOString(),
        };
        docById.delete(documentId);
        trashedById.set(documentId, movedToTrash);
        movedDocs.push(movedToTrash);
        succeededIds.push(documentId);
      } catch {
        failedIds.push(documentId);
      }
    }

    if (succeededIds.length > 0) {
      const succeededSet = new Set(succeededIds);
      const nextFindings = findings.map(finding => {
        if (!finding.sourceDocumentIds.some(id => succeededSet.has(id))) {
          return finding;
        }
        return {
          ...finding,
          sourceDocumentIds: finding.sourceDocumentIds.filter(
            docId => !succeededSet.has(docId)
          ),
          updatedAt: new Date().toISOString(),
        };
      });

      await Promise.all([
        this.store.setLegalDocuments([...docById.values()]),
        this.store.setTrashedLegalDocuments([...trashedById.values()]),
        this.store.setSemanticChunks(
          chunks.filter(chunk => !succeededSet.has(chunk.documentId))
        ),
        this.store.setQualityReports(
          qualityReports.filter(report => !succeededSet.has(report.documentId))
        ),
        this.store.setOcrJobs(
          ocrJobs.filter(job => !succeededSet.has(job.documentId))
        ),
        this.store.setLegalFindings(nextFindings),
      ]);

      const auditGroups = new Map<
        string,
        {
          workspaceId: string;
          caseId: string | undefined;
          documentIds: string[];
        }
      >();
      for (const doc of movedDocs) {
        const key = `${doc.workspaceId}::${doc.caseId}`;
        const current = auditGroups.get(key);
        if (current) {
          current.documentIds.push(doc.id);
          continue;
        }
        auditGroups.set(key, {
          workspaceId: doc.workspaceId,
          caseId: doc.caseId,
          documentIds: [doc.id],
        });
      }

      await Promise.all(
        [...auditGroups.values()].map(group =>
          this.appendAuditEntry({
            caseId: group.caseId,
            workspaceId: group.workspaceId,
            action: 'document.trash.scheduled',
            severity: 'info',
            details:
              `${group.documentIds.length} Dokument(e) in Papierkorb verschoben. ` +
              `Automatische Löschung am ${new Date(purgeAt).toLocaleDateString('de-DE')}.`,
            metadata: {
              documentCount: String(group.documentIds.length),
              retentionDays: String(DOCUMENT_TRASH_RETENTION_DAYS),
              trashedAt,
              purgeAt,
              documentIds: group.documentIds.slice(0, 20).join(','),
            },
          })
        )
      );
    }

    return {
      total: uniqueDocumentIds.length,
      succeededIds,
      blockedIds,
      failedIds,
    };
  }

  async restoreDocumentsBulk(documentIds: string[]): Promise<{
    total: number;
    succeededIds: string[];
    blockedIds: string[];
    failedIds: string[];
  }> {
    const uniqueDocumentIds = [...new Set(documentIds.filter(Boolean))];
    const succeededIds: string[] = [];
    const blockedIds: string[] = [];
    const failedIds: string[] = [];

    if (uniqueDocumentIds.length === 0) {
      return {
        total: 0,
        succeededIds,
        blockedIds,
        failedIds,
      };
    }

    const permission =
      await this.accessControlService.evaluate('document.upload');
    if (!permission.ok) {
      blockedIds.push(...uniqueDocumentIds);
      return {
        total: uniqueDocumentIds.length,
        succeededIds,
        blockedIds,
        failedIds,
      };
    }

    const [activeDocs, trashedDocs] = await Promise.all([
      this.store.getLegalDocuments(),
      this.store.getTrashedLegalDocuments(),
    ]);

    const activeById = new Map(activeDocs.map(doc => [doc.id, doc] as const));
    const trashedById = new Map(trashedDocs.map(doc => [doc.id, doc] as const));

    for (const documentId of uniqueDocumentIds) {
      const trashed = trashedById.get(documentId);
      if (!trashed) {
        blockedIds.push(documentId);
        continue;
      }

      try {
        const restored: LegalDocumentRecord = {
          ...trashed,
          trashedAt: undefined,
          purgeAt: undefined,
          updatedAt: new Date().toISOString(),
        };
        trashedById.delete(documentId);
        activeById.set(documentId, restored);
        succeededIds.push(documentId);
      } catch {
        failedIds.push(documentId);
      }
    }

    if (succeededIds.length > 0) {
      await Promise.all([
        this.store.setLegalDocuments([...activeById.values()]),
        this.store.setTrashedLegalDocuments([...trashedById.values()]),
      ]);
    }

    return {
      total: uniqueDocumentIds.length,
      succeededIds,
      blockedIds,
      failedIds,
    };
  }

  async saveConnectorConfiguration(
    input: Omit<ConnectorConfig, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    const permission = await this.accessControlService.evaluate(
      'connector.configure'
    );
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

    const permission =
      await this.accessControlService.evaluate('connector.toggle');
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
      throw new Error(
        'Semantic chunk payload mismatch: documentId is inconsistent.'
      );
    }

    const caseIds = new Set(chunks.map(chunk => chunk.caseId));
    const workspaceIds = new Set(chunks.map(chunk => chunk.workspaceId));
    if (caseIds.size > 1 || workspaceIds.size > 1) {
      throw new Error(
        'Semantic chunk payload mismatch: mixed case/workspace data detected.'
      );
    }

    // GAP-5 FIX: Optimized upsert — avoid full-array serialization when possible.
    // At scale (500+ docs × 10+ chunks = 5000+ chunks), reading/filtering/writing
    // the entire array on every document intake is expensive and risks hitting
    // V8's JSON.stringify limit (~268M chars).
    const existing = await this.store.getSemanticChunks();

    // Fast path: if no existing chunks for this document, just append
    const hasExisting = existing.some(
      (c: SemanticChunk) => c.documentId === documentId
    );
    if (!hasExisting) {
      // Append-only — avoids full array copy + filter
      await this.store.setSemanticChunks(existing.concat(chunks));
      return;
    }

    // Replace path: only rebuild if document already had chunks
    const filtered = existing.filter(
      (c: SemanticChunk) => c.documentId !== documentId
    );
    await this.store.setSemanticChunks(filtered.concat(chunks));
  }

  async upsertQualityReport(report: DocumentQualityReport) {
    const existingDoc = (await this.store.getLegalDocuments()).find(
      d => d.id === report.documentId
    );
    if (
      existingDoc &&
      (existingDoc.caseId !== report.caseId ||
        existingDoc.workspaceId !== report.workspaceId)
    ) {
      throw new Error(
        'Quality report payload mismatch: case/workspace differs from source document.'
      );
    }

    const existing = await this.store.getQualityReports();
    const filtered = existing.filter(
      (r: DocumentQualityReport) => r.documentId !== report.documentId
    );
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
      startedAt:
        current.startedAt ?? (params.status === 'running' ? now : undefined),
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
        details:
          'Job kann nur gelöscht werden, wenn er nicht queued/running ist. Bitte zuerst abbrechen.',
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
    const caseJobs = existingJobs.filter(
      j => j.caseId === input.caseId && j.workspaceId === input.workspaceId
    );
    const hasRunning = caseJobs.some(
      j => j.status === 'queued' || j.status === 'running'
    );
    if (hasRunning) {
      await this.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'job.history_clear.blocked_running',
        severity: 'warning',
        details:
          'Verlauf kann nicht gelöscht werden solange Jobs queued/running sind. Bitte zuerst abbrechen.',
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

    const caseFile = Object.values(graph.cases ?? {}).find((c: CaseFile) =>
      (c.deadlineIds ?? []).includes(deadlineId)
    );
    const matter = caseFile?.matterId
      ? graph.matters?.[caseFile.matterId]
      : undefined;

    return { deadline, caseFile: caseFile ?? null, matter: matter ?? null };
  }

  async markDeadlineAcknowledged(deadlineId: string) {
    const ctx = await this.resolveDeadlineContext(deadlineId);
    if (!ctx) return null;

    const permission =
      await this.accessControlService.evaluate('deadline.manage');
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

    if (
      ctx.deadline.status === 'acknowledged' ||
      ctx.deadline.status === 'completed'
    ) {
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

    const permission =
      await this.accessControlService.evaluate('deadline.manage');
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

    const permission =
      await this.accessControlService.evaluate('deadline.manage');
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

    const permission =
      await this.accessControlService.evaluate('deadline.manage');
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

    const permission =
      await this.accessControlService.evaluate('finding.manage');
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

    const permission =
      await this.accessControlService.evaluate('finding.manage');
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
    const existing = (await this.store.getTimeEntries()).find(
      e => e.id === entry.id
    );

    if (existing && existing.status !== entry.status) {
      const actionByStatus: Partial<Record<TimeEntry['status'], string>> = {
        submitted: 'submit',
        approved: 'approve',
        rejected: 'reject',
      };
      const action = actionByStatus[entry.status];
      if (action) {
        await this.postLegalApi(
          `/api/legal/workspaces/${encodeURIComponent(entry.workspaceId)}/time-entries/${encodeURIComponent(entry.id)}/${action}`,
          {}
        );
      } else {
        await this.postLegalApi(
          `/api/legal/workspaces/${encodeURIComponent(entry.workspaceId)}/time-entries`,
          this.toLegalTimeEntryPayload(entry)
        );
      }
    } else {
      await this.postLegalApi(
        `/api/legal/workspaces/${encodeURIComponent(entry.workspaceId)}/time-entries`,
        this.toLegalTimeEntryPayload(entry)
      );
    }

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
    const entries = (await this.store.getTimeEntries()).filter(
      e => e.id !== entryId
    );
    await this.store.setTimeEntries(entries);
  }

  async upsertWiedervorlage(entry: Wiedervorlage) {
    const existing = (await this.store.getWiedervorlagen()).find(
      e => e.id === entry.id
    );
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
    const entries = (await this.store.getWiedervorlagen()).filter(
      e => e.id !== entryId
    );
    await this.store.setWiedervorlagen(entries);
  }

  async upsertAktennotiz(entry: Aktennotiz) {
    const existing = (await this.store.getAktennotizen()).find(
      e => e.id === entry.id
    );
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
    const entries = (await this.store.getAktennotizen()).filter(
      e => e.id !== entryId
    );
    await this.store.setAktennotizen(entries);
  }

  async upsertVollmacht(entry: Vollmacht) {
    const existing = (await this.store.getVollmachten()).find(
      e => e.id === entry.id
    );
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
    const entries = (await this.store.getVollmachten()).filter(
      e => e.id !== entryId
    );
    await this.store.setVollmachten(entries);
  }

  async upsertRechnung(entry: RechnungRecord) {
    await this.postLegalApi(
      `/api/legal/workspaces/${encodeURIComponent(entry.workspaceId)}/invoices`,
      {
        invoiceNumber: entry.rechnungsnummer,
        matterId: entry.matterId,
        clientId: entry.clientId,
        status: this.mapRechnungStatusToLegalInvoice(entry.status),
        subtotalCents: Math.round(entry.netto * 100),
        taxRateBps: Math.round(entry.ustProzent * 100),
        issuedAt: entry.rechnungsdatum,
        dueDate: entry.faelligkeitsdatum,
        notes: entry.betreff,
        lineItems: entry.positionen.map(item => ({
          description: item.bezeichnung,
          quantity: item.anzahl,
          unitPriceCents: Math.round(item.einzelpreis * 100),
          totalCents: Math.round(item.gesamt * 100),
          timeEntryId: item.timeEntryId,
        })),
        timeEntryIds: entry.positionen
          .map(item => item.timeEntryId)
          .filter((id): id is string => Boolean(id)),
      }
    );

    const existing = (await this.store.getRechnungen()).find(
      e => e.id === entry.id
    );
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
    const entries = (await this.store.getRechnungen()).filter(
      e => e.id !== entryId
    );
    await this.store.setRechnungen(entries);
  }

  async upsertAuslage(entry: AuslageRecord) {
    const existing = (await this.store.getAuslagen()).find(
      e => e.id === entry.id
    );
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
    const entries = (await this.store.getAuslagen()).filter(
      e => e.id !== entryId
    );
    await this.store.setAuslagen(entries);
  }

  async upsertKassenbeleg(entry: KassenbelegRecord) {
    const existing = (await this.store.getKassenbelege()).find(
      e => e.id === entry.id
    );
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
    const entries = (await this.store.getKassenbelege()).filter(
      e => e.id !== entryId
    );
    await this.store.setKassenbelege(entries);
  }

  async upsertFiscalSignature(entry: FiscalSignatureRecord) {
    const existing = (await this.store.getFiscalSignatures()).find(
      e => e.id === entry.id
    );
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
    const existing = (await this.store.getExportJournal()).find(
      e => e.id === entry.id
    );
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
