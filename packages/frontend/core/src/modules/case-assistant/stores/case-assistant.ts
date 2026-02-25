import { type AsyncMemento,LiveData, Store } from '@toeverything/infra';

import type { GlobalState } from '../../storage';
import type { WorkspaceService } from '../../workspace';
import type {
  Aktennotiz,
  AnalyticsEvent,
  AnalyticsSession,
  AnwaltProfile,
  AuditChainAnchor,
  AuslageRecord,
  CaseActor,
  CaseAssistantRole,
  CaseBlueprint,
  CaseDeadline,
  CaseFile,
  CaseGraphRecord,
  CaseIssue,
  CaseMemoryEvent,
  CitationChain,
  ClientRecord,
  CollectiveKnowledgeEntry,
  CollectiveSharingConfig,
  ComplianceAuditEntry,
  ConnectorConfig,
  CopilotRun,
  CopilotTask,
  CourtDecision,
  CustomerHealthScore,
  DeadlineAlert,
  DocumentQualityReport,
  EmailRecord,
  ErrorLogEntry,
  ExportJournalRecord,
  FiscalSignatureRecord,
  GegnerKanzleiProfile,
  GeoLocation,
  Gerichtstermin,
  IngestionJob,
  JudikaturSuggestion,
  Jurisdiction,
  KanzleiProfile,
  KassenbelegRecord,
  KycSubmissionRecord,
  LegalChatMessage,
  LegalChatSession,
  LegalDocumentRecord,
  LegalFinding,
  LegalNormRegistryRecord,
  MatterRecord,
  OcrJob,
  PerformanceMetric,
  PortalRequestRecord,
  RechnungRecord,
  RichterProfile,
  SemanticChunk,
  SharedCourtDecision,
  TimeEntry,
  Vollmacht,
  VollmachtSigningRequestRecord,
  Wiedervorlage,
  WorkflowEvent,
  WorkspaceResidencyPolicy,
} from '../types';

const EMPTY_GRAPH: CaseGraphRecord = {
  clients: {},
  matters: {},
  cases: {},
  actors: {},
  issues: {},
  deadlines: {},
  termine: {},
  memoryEvents: {},
  updatedAt: new Date(0).toISOString(),
};

// Maximum rawText size per document stored in the reactive/serialized store.
// Anything larger is a bug (e.g. base64 content leaking into rawText).
// 256 KB is generous for extracted plaintext; base64 binaries are 20-100 MB.
const MAX_RAW_TEXT_STORE_BYTES = 256 * 1024;
const BINARY_PLACEHOLDER = '[binary-in-ocr-cache]';

function sanitizeLegalDocForStore(
  doc: LegalDocumentRecord
): LegalDocumentRecord {
  if (!doc.rawText || doc.rawText.length <= MAX_RAW_TEXT_STORE_BYTES) {
    return doc;
  }
  // rawText is oversized — likely base64 content that leaked into the store.
  // Replace with placeholder to prevent JSON.stringify from exceeding V8 string limit.
  const isBase64 =
    doc.rawText.startsWith('data:') && doc.rawText.includes(';base64,');
  console.warn(
    `[store] sanitizeLegalDocForStore: rawText too large for doc "${doc.title}" (${doc.rawText.length} chars, isBase64=${isBase64}). Truncating.`
  );
  return {
    ...doc,
    rawText: isBase64
      ? BINARY_PLACEHOLDER
      : doc.rawText.slice(0, MAX_RAW_TEXT_STORE_BYTES) +
        `\n[truncated at ${MAX_RAW_TEXT_STORE_BYTES} chars]`,
  };
}

export class CaseAssistantStore extends Store {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly globalState: GlobalState,
    private readonly cacheStorage: AsyncMemento
  ) {
    super();
  }

  private watchState<T>(key: string, fallback: T) {
    return LiveData.from(this.globalState.watch<T>(key), fallback);
  }

  private async readState<T>(key: string) {
    const persisted = this.globalState.get<T>(key);
    if (persisted !== undefined) {
      return persisted;
    }

    const cached = await this.cacheStorage.get<T>(key);
    if (cached !== undefined) {
      try {
        this.globalState.set(key, cached);
      } catch {
        // globalState (localStorage) may fail for large data — that's OK,
        // the value is still served from cacheStorage (IndexedDB).
      }
      return cached;
    }

    return undefined;
  }

  private async writeState<T>(key: string, value: T) {
    try {
      this.globalState.set(key, value);
    } catch (error) {
      // globalState uses JSON.stringify + localStorage which can throw
      // "Invalid string length" (RangeError) or QuotaExceededError for large data.
      // Fall through to cacheStorage (IndexedDB) which uses structured clone
      // and has much higher limits.
      console.warn(
        `[store] writeState: globalState.set("${key}") failed, falling back to cacheStorage only.`,
        error instanceof Error ? error.message : error
      );
    }
    await this.cacheStorage.set(key, value);
  }

  private get workspaceId() {
    return this.workspaceService.workspace!.id;
  }

  getWorkspaceId() {
    return this.workspaceId;
  }

  private get graphKey() {
    return `case-assistant:${this.workspaceId}:graph`;
  }

  private get defaultClientId() {
    return `client:${this.workspaceId}:default`;
  }

  private ensureGraphShape(graph: CaseGraphRecord): CaseGraphRecord {
    const now = new Date().toISOString();
    const clients = graph.clients ?? {};
    const matters = graph.matters ?? {};
    const anwaelte = graph.anwaelte ?? {};
    const termine = graph.termine ?? {};

    if (!clients[this.defaultClientId]) {
      clients[this.defaultClientId] = {
        id: this.defaultClientId,
        workspaceId: this.workspaceId,
        kind: 'other',
        displayName: 'Default Mandant',
        archived: false,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    // Migration: ensure clientIds[] is populated from clientId for backward compat
    for (const matter of Object.values(matters)) {
      if (!matter.clientIds || matter.clientIds.length === 0) {
        matter.clientIds = [matter.clientId];
      } else if (!matter.clientIds.includes(matter.clientId)) {
        matter.clientIds = [matter.clientId, ...matter.clientIds];
      }
      if (!matter.opposingParties) {
        matter.opposingParties = [];
      }
    }

    for (const caseId of Object.keys(graph.cases ?? {})) {
      const caseFile = graph.cases[caseId];
      if (!caseFile) {
        continue;
      }

      if (!caseFile.matterId) {
        const matterId = `matter:${this.workspaceId}:${caseId}`;
        caseFile.matterId = matterId;
        if (!matters[matterId]) {
          matters[matterId] = {
            id: matterId,
            workspaceId: this.workspaceId,
            clientId: this.defaultClientId,
            title: caseFile.title || 'Akte',
            status: 'open',
            tags: [],
            createdAt: caseFile.createdAt ?? now,
            updatedAt: now,
          };
        }
      }
    }

    return {
      ...graph,
      clients,
      matters,
      anwaelte,
      termine,
      updatedAt: graph.updatedAt || now,
    };
  }

  private get alertsKey() {
    return `case-assistant:${this.workspaceId}:alerts`;
  }

  private get anwaltsReminderPrefsKey() {
    return `case-assistant:${this.workspaceId}:anwalts-reminder-prefs`;
  }

  private get anwaltsReminderRuntimeKey() {
    return `case-assistant:${this.workspaceId}:anwalts-reminder-runtime`;
  }

  private get connectorsKey() {
    return `case-assistant:${this.workspaceId}:connectors`;
  }

  private get ingestionJobsKey() {
    return `case-assistant:${this.workspaceId}:ingestion-jobs`;
  }

  private get legalDocumentsKey() {
    return `case-assistant:${this.workspaceId}:legal-documents`;
  }

  private get legalDocumentsTrashKey() {
    return `case-assistant:${this.workspaceId}:legal-documents-trash`;
  }

  private get ocrJobsKey() {
    return `case-assistant:${this.workspaceId}:ocr-jobs`;
  }

  private get legalFindingsKey() {
    return `case-assistant:${this.workspaceId}:legal-findings`;
  }

  private get copilotTasksKey() {
    return `case-assistant:${this.workspaceId}:copilot-tasks`;
  }

  private get blueprintsKey() {
    return `case-assistant:${this.workspaceId}:blueprints`;
  }

  private get copilotRunsKey() {
    return `case-assistant:${this.workspaceId}:copilot-runs`;
  }

  private get workflowEventsKey() {
    return `case-assistant:${this.workspaceId}:workflow-events`;
  }

  private get auditEntriesKey() {
    return `case-assistant:${this.workspaceId}:audit-entries`;
  }

  private get roleKey() {
    return `case-assistant:${this.workspaceId}:role`;
  }

  private get auditAnchorsKey() {
    return `case-assistant:${this.workspaceId}:audit-anchors`;
  }

  private get courtDecisionsKey() {
    return `case-assistant:${this.workspaceId}:court-decisions`;
  }

  private get legalNormRegistryKey() {
    return `case-assistant:${this.workspaceId}:legal-norm-registry`;
  }

  private get judikaturSuggestionsKey() {
    return `case-assistant:${this.workspaceId}:judikatur-suggestions`;
  }

  private get citationChainsKey() {
    return `case-assistant:${this.workspaceId}:citation-chains`;
  }

  private get semanticChunksKey() {
    return `case-assistant:${this.workspaceId}:semantic-chunks`;
  }

  private get qualityReportsKey() {
    return `case-assistant:${this.workspaceId}:quality-reports`;
  }

  private get emailsKey() {
    return `case-assistant:${this.workspaceId}:emails`;
  }

  private get portalRequestsKey() {
    return `case-assistant:${this.workspaceId}:portal-requests`;
  }

  private get vollmachtSigningRequestsKey() {
    return `case-assistant:${this.workspaceId}:vollmacht-signing-requests`;
  }

  private get kycSubmissionsKey() {
    return `case-assistant:${this.workspaceId}:kyc-submissions`;
  }

  // ── Analytics & Monitoring Keys ────────────────────────────────────────────

  private get analyticsEventsKey() {
    return `case-assistant:${this.workspaceId}:analytics-events`;
  }

  private get analyticsSessionsKey() {
    return `case-assistant:${this.workspaceId}:analytics-sessions`;
  }

  private get errorLogsKey() {
    return `case-assistant:${this.workspaceId}:error-logs`;
  }

  private get performanceMetricsKey() {
    return `case-assistant:${this.workspaceId}:performance-metrics`;
  }

  private get customerHealthScoresKey() {
    return `case-assistant:${this.workspaceId}:customer-health-scores`;
  }

  private get geoCacheKey() {
    return `case-assistant:${this.workspaceId}:geo-cache`;
  }

  // ── Legal AI Premium Chat Keys ──────────────────────────────────────────────

  private get chatSessionsKey() {
    return `case-assistant:${this.workspaceId}:chat-sessions`;
  }

  private get chatSessionsTrashKey() {
    return `case-assistant:${this.workspaceId}:chat-sessions-trash`;
  }

  private get chatMessagesKey() {
    return `case-assistant:${this.workspaceId}:chat-messages`;
  }

  private get chatMessagesTrashKey() {
    return `case-assistant:${this.workspaceId}:chat-messages-trash`;
  }

  private get copilotMemoriesKey() {
    return `case-assistant:${this.workspaceId}:copilot-memories`;
  }

  private get crossCheckReportsKey() {
    return `case-assistant:${this.workspaceId}:cross-check-reports`;
  }

  private get messageFeedbackKey() {
    return `case-assistant:${this.workspaceId}:message-feedback`;
  }

  private get gegnerProfilesKey() {
    return `case-assistant:${this.workspaceId}:gegner-profiles`;
  }

  private get richterProfilesKey() {
    return `case-assistant:${this.workspaceId}:richter-profiles`;
  }

  watchGraph() {
    return this.watchState<CaseGraphRecord>(this.graphKey, EMPTY_GRAPH).map(
      (graph: CaseGraphRecord | undefined) =>
        this.ensureGraphShape(graph ?? EMPTY_GRAPH)
    );
  }

  async getGraph() {
    const graph = await this.readState<CaseGraphRecord>(this.graphKey);
    if (!graph) {
      return {
        ...EMPTY_GRAPH,
        updatedAt: new Date().toISOString(),
      };
    }

    return this.ensureGraphShape(graph);
  }

  async setGraph(graph: CaseGraphRecord) {
    await this.writeState(this.graphKey, this.ensureGraphShape(graph));
  }

  watchAlerts() {
    return this.watchState<DeadlineAlert[]>(this.alertsKey, []);
  }

  async getAlerts() {
    return (await this.readState<DeadlineAlert[]>(this.alertsKey)) ?? [];
  }

  async setAlerts(alerts: DeadlineAlert[]) {
    await this.writeState(this.alertsKey, alerts);
  }

  async getAnwaltsReminderPreferences<T extends Record<string, unknown>>() {
    return (await this.readState<T>(this.anwaltsReminderPrefsKey)) ?? null;
  }

  async setAnwaltsReminderPreferences(value: Record<string, unknown>) {
    await this.writeState(this.anwaltsReminderPrefsKey, value);
  }

  async getAnwaltsReminderRuntime<T extends Record<string, unknown>>() {
    return (await this.readState<T>(this.anwaltsReminderRuntimeKey)) ?? null;
  }

  async setAnwaltsReminderRuntime(value: Record<string, unknown>) {
    await this.writeState(this.anwaltsReminderRuntimeKey, value);
  }

  watchConnectors() {
    return this.watchState<ConnectorConfig[]>(this.connectorsKey, []);
  }

  async getConnectors() {
    return (await this.readState<ConnectorConfig[]>(this.connectorsKey)) ?? [];
  }

  async setConnectors(connectors: ConnectorConfig[]) {
    await this.writeState(this.connectorsKey, connectors);
  }

  watchIngestionJobs() {
    return this.watchState<IngestionJob[]>(this.ingestionJobsKey, []);
  }

  async getIngestionJobs() {
    return (await this.readState<IngestionJob[]>(this.ingestionJobsKey)) ?? [];
  }

  async setIngestionJobs(jobs: IngestionJob[]) {
    await this.writeState(this.ingestionJobsKey, jobs);
  }

  watchLegalDocuments() {
    return this.watchState<LegalDocumentRecord[]>(this.legalDocumentsKey, []);
  }

  async getLegalDocuments(options?: { includeTrashed?: boolean }) {
    const rawActive =
      (await this.readState<LegalDocumentRecord[]>(this.legalDocumentsKey)) ??
      [];
    const trashed =
      (await this.readState<LegalDocumentRecord[]>(
        this.legalDocumentsTrashKey
      )) ?? [];

    // Sanitize on read: strip oversized rawText from any previously corrupted records.
    // This self-heals the store so subsequent writes succeed.
    let needsSanitize = false;
    const active = rawActive.map(doc => {
      const sanitized = sanitizeLegalDocForStore(doc);
      if (sanitized !== doc) needsSanitize = true;
      return sanitized;
    });
    if (needsSanitize) {
      // Write back sanitized data silently to prevent future failures
      await this.writeState(this.legalDocumentsKey, active);
    }

    const nowMs = Date.now();
    const cleanedTrashed = trashed.filter(
      doc => !doc.purgeAt || new Date(doc.purgeAt).getTime() > nowMs
    );
    if (cleanedTrashed.length !== trashed.length) {
      await this.writeState(this.legalDocumentsTrashKey, cleanedTrashed);
    }
    if (options?.includeTrashed) {
      return [...active, ...cleanedTrashed];
    }
    return active;
  }

  async setLegalDocuments(items: LegalDocumentRecord[]) {
    await this.writeState(this.legalDocumentsKey, items);
  }

  async getTrashedLegalDocuments() {
    return (
      (await this.readState<LegalDocumentRecord[]>(
        this.legalDocumentsTrashKey
      )) ?? []
    );
  }

  async setTrashedLegalDocuments(items: LegalDocumentRecord[]) {
    await this.writeState(this.legalDocumentsTrashKey, items);
  }

  watchOcrJobs() {
    return this.watchState<OcrJob[]>(this.ocrJobsKey, []);
  }

  async getOcrJobs() {
    return (await this.readState<OcrJob[]>(this.ocrJobsKey)) ?? [];
  }

  async setOcrJobs(items: OcrJob[]) {
    await this.writeState(this.ocrJobsKey, items);
  }

  watchLegalFindings() {
    return this.watchState<LegalFinding[]>(this.legalFindingsKey, []);
  }

  async getLegalFindings() {
    return (await this.readState<LegalFinding[]>(this.legalFindingsKey)) ?? [];
  }

  async setLegalFindings(items: LegalFinding[]) {
    await this.writeState(this.legalFindingsKey, items);
  }

  watchCopilotTasks() {
    return this.watchState<CopilotTask[]>(this.copilotTasksKey, []);
  }

  async getCopilotTasks() {
    return (await this.readState<CopilotTask[]>(this.copilotTasksKey)) ?? [];
  }

  async setCopilotTasks(items: CopilotTask[]) {
    await this.writeState(this.copilotTasksKey, items);
  }

  watchBlueprints() {
    return this.watchState<CaseBlueprint[]>(this.blueprintsKey, []);
  }

  async getBlueprints() {
    return (await this.readState<CaseBlueprint[]>(this.blueprintsKey)) ?? [];
  }

  async setBlueprints(items: CaseBlueprint[]) {
    await this.writeState(this.blueprintsKey, items);
  }

  watchCopilotRuns() {
    return this.watchState<CopilotRun[]>(this.copilotRunsKey, []);
  }

  async getCopilotRuns() {
    return (await this.readState<CopilotRun[]>(this.copilotRunsKey)) ?? [];
  }

  async setCopilotRuns(items: CopilotRun[]) {
    await this.writeState(this.copilotRunsKey, items);
  }

  watchWorkflowEvents() {
    return this.watchState<WorkflowEvent[]>(this.workflowEventsKey, []);
  }

  async getWorkflowEvents() {
    return (
      (await this.readState<WorkflowEvent[]>(this.workflowEventsKey)) ?? []
    );
  }

  async setWorkflowEvents(events: WorkflowEvent[]) {
    await this.writeState(this.workflowEventsKey, events);
  }

  watchAuditEntries() {
    return this.watchState<ComplianceAuditEntry[]>(this.auditEntriesKey, []);
  }

  async getAuditEntries() {
    return (
      (await this.readState<ComplianceAuditEntry[]>(this.auditEntriesKey)) ?? []
    );
  }

  async setAuditEntries(entries: ComplianceAuditEntry[]) {
    await this.writeState(this.auditEntriesKey, entries);
  }

  watchAuditAnchors() {
    return this.watchState<AuditChainAnchor[]>(this.auditAnchorsKey, []);
  }

  async getAuditAnchors() {
    return (
      (await this.readState<AuditChainAnchor[]>(this.auditAnchorsKey)) ?? []
    );
  }

  async setAuditAnchors(anchors: AuditChainAnchor[]) {
    await this.writeState(this.auditAnchorsKey, anchors);
  }

  watchCourtDecisions() {
    return this.watchState<CourtDecision[]>(this.courtDecisionsKey, []);
  }

  async getCourtDecisions() {
    return (
      (await this.readState<CourtDecision[]>(this.courtDecisionsKey)) ?? []
    );
  }

  async setCourtDecisions(items: CourtDecision[]) {
    await this.writeState(this.courtDecisionsKey, items);
  }

  watchLegalNormRegistry() {
    return this.watchState<LegalNormRegistryRecord[]>(
      this.legalNormRegistryKey,
      []
    );
  }

  async getLegalNormRegistry() {
    return (
      (await this.readState<LegalNormRegistryRecord[]>(
        this.legalNormRegistryKey
      )) ?? []
    );
  }

  async setLegalNormRegistry(items: LegalNormRegistryRecord[]) {
    await this.writeState(this.legalNormRegistryKey, items);
  }

  watchJudikaturSuggestions() {
    return this.watchState<JudikaturSuggestion[]>(
      this.judikaturSuggestionsKey,
      []
    );
  }

  async getJudikaturSuggestions() {
    return (
      (await this.readState<JudikaturSuggestion[]>(
        this.judikaturSuggestionsKey
      )) ?? []
    );
  }

  async setJudikaturSuggestions(items: JudikaturSuggestion[]) {
    await this.writeState(this.judikaturSuggestionsKey, items);
  }

  watchCitationChains() {
    return this.watchState<CitationChain[]>(this.citationChainsKey, []);
  }

  async getCitationChains() {
    return (
      (await this.readState<CitationChain[]>(this.citationChainsKey)) ?? []
    );
  }

  async setCitationChains(items: CitationChain[]) {
    await this.writeState(this.citationChainsKey, items);
  }

  watchSemanticChunks() {
    return this.watchState<SemanticChunk[]>(this.semanticChunksKey, []);
  }

  async getSemanticChunks() {
    return (
      (await this.readState<SemanticChunk[]>(this.semanticChunksKey)) ?? []
    );
  }

  async setSemanticChunks(items: SemanticChunk[]) {
    await this.writeState(this.semanticChunksKey, items);
  }

  watchQualityReports() {
    return this.watchState<DocumentQualityReport[]>(this.qualityReportsKey, []);
  }

  async getQualityReports() {
    return (
      (await this.readState<DocumentQualityReport[]>(this.qualityReportsKey)) ??
      []
    );
  }

  async setQualityReports(items: DocumentQualityReport[]) {
    await this.writeState(this.qualityReportsKey, items);
  }

  watchEmails() {
    return this.watchState<EmailRecord[]>(this.emailsKey, []);
  }

  async getEmails() {
    return (await this.readState<EmailRecord[]>(this.emailsKey)) ?? [];
  }

  async setEmails(items: EmailRecord[]) {
    await this.writeState(this.emailsKey, items);
  }

  watchPortalRequests() {
    return this.watchState<PortalRequestRecord[]>(this.portalRequestsKey, []);
  }

  async getPortalRequests() {
    return (
      (await this.readState<PortalRequestRecord[]>(this.portalRequestsKey)) ??
      []
    );
  }

  async setPortalRequests(items: PortalRequestRecord[]) {
    await this.writeState(this.portalRequestsKey, items);
  }

  async upsertPortalRequest(record: PortalRequestRecord) {
    const items = await this.getPortalRequests();
    const next = items.filter(item => item.id !== record.id);
    next.unshift(record);
    await this.setPortalRequests(next);
  }

  watchVollmachtSigningRequests() {
    return this.watchState<VollmachtSigningRequestRecord[]>(
      this.vollmachtSigningRequestsKey,
      []
    );
  }

  async getVollmachtSigningRequests() {
    return (
      (await this.readState<VollmachtSigningRequestRecord[]>(
        this.vollmachtSigningRequestsKey
      )) ?? []
    );
  }

  async setVollmachtSigningRequests(items: VollmachtSigningRequestRecord[]) {
    await this.writeState(this.vollmachtSigningRequestsKey, items);
  }

  async upsertVollmachtSigningRequest(record: VollmachtSigningRequestRecord) {
    const items = await this.getVollmachtSigningRequests();
    const next = items.filter(item => item.id !== record.id);
    next.unshift(record);
    await this.setVollmachtSigningRequests(next);
  }

  watchKycSubmissions() {
    return this.watchState<KycSubmissionRecord[]>(this.kycSubmissionsKey, []);
  }

  async getKycSubmissions() {
    return (
      (await this.readState<KycSubmissionRecord[]>(this.kycSubmissionsKey)) ??
      []
    );
  }

  async setKycSubmissions(items: KycSubmissionRecord[]) {
    await this.writeState(this.kycSubmissionsKey, items);
  }

  async upsertKycSubmission(record: KycSubmissionRecord) {
    const items = await this.getKycSubmissions();
    const next = items.filter(item => item.id !== record.id);
    next.unshift(record);
    await this.setKycSubmissions(next);
  }

  async upsertEmail(record: EmailRecord) {
    const items = await this.getEmails();
    const existing = items.find(item => item.id === record.id);
    if (existing) {
      await this.setEmails(
        items.map(item => (item.id === record.id ? record : item))
      );
      return;
    }
    await this.setEmails([record, ...items]);
  }

  async getAuditAnchor(scopeId: string) {
    const anchors = await this.getAuditAnchors();
    return (
      anchors.find((anchor: AuditChainAnchor) => anchor.scopeId === scopeId) ??
      null
    );
  }

  async upsertAuditAnchor(anchor: AuditChainAnchor, maxItems = 100) {
    const anchors = await this.getAuditAnchors();
    const next = [
      anchor,
      ...anchors.filter(
        (item: AuditChainAnchor) => item.scopeId !== anchor.scopeId
      ),
    ].slice(0, maxItems);
    await this.setAuditAnchors(next);
  }

  watchRole() {
    return this.watchState<CaseAssistantRole>(
      this.roleKey,
      'owner' as CaseAssistantRole
    );
  }

  async getRole() {
    return (await this.readState<CaseAssistantRole>(this.roleKey)) ?? 'owner';
  }

  async setRole(role: CaseAssistantRole) {
    await this.writeState(this.roleKey, role);
  }

  async upsertCaseFile(record: CaseFile) {
    const graph = await this.getGraph();
    graph.cases[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async upsertClient(record: ClientRecord) {
    const graph = await this.getGraph();
    graph.clients = graph.clients ?? {};
    graph.clients[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async upsertMatter(record: MatterRecord) {
    const graph = await this.getGraph();
    graph.matters = graph.matters ?? {};
    graph.matters[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async deleteClient(clientId: string) {
    const graph = await this.getGraph();
    if (!graph.clients?.[clientId]) {
      return false;
    }
    delete graph.clients[clientId];
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
    return true;
  }

  async deleteMatter(matterId: string) {
    const graph = await this.getGraph();
    if (!graph.matters?.[matterId]) {
      return false;
    }
    delete graph.matters[matterId];
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
    return true;
  }

  async upsertActor(record: CaseActor) {
    const graph = await this.getGraph();
    graph.actors[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async deleteActor(actorId: string) {
    const graph = await this.getGraph();
    if (!graph.actors?.[actorId]) {
      return false;
    }
    delete graph.actors[actorId];
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
    return true;
  }

  async upsertIssue(record: CaseIssue) {
    const graph = await this.getGraph();
    graph.issues[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async deleteIssue(issueId: string) {
    const graph = await this.getGraph();
    if (!graph.issues?.[issueId]) {
      return false;
    }
    delete graph.issues[issueId];
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
    return true;
  }

  async upsertDeadline(record: CaseDeadline) {
    const graph = await this.getGraph();
    graph.deadlines[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async upsertGerichtstermin(record: Gerichtstermin) {
    const graph = await this.getGraph();
    graph.termine = graph.termine ?? {};
    graph.termine[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async deleteGerichtstermin(terminId: string) {
    const graph = await this.getGraph();
    if (!graph.termine?.[terminId]) {
      return false;
    }
    delete graph.termine[terminId];
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
    return true;
  }

  async upsertMemoryEvent(record: CaseMemoryEvent) {
    const graph = await this.getGraph();
    graph.memoryEvents[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async deleteMemoryEvent(memoryEventId: string) {
    const graph = await this.getGraph();
    if (!graph.memoryEvents?.[memoryEventId]) {
      return false;
    }
    delete graph.memoryEvents[memoryEventId];
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
    return true;
  }

  async upsertConnector(record: ConnectorConfig) {
    const items = await this.getConnectors();
    const next = items.filter((item: ConnectorConfig) => item.id !== record.id);
    next.unshift(record);
    await this.setConnectors(next);
  }

  async upsertIngestionJob(record: IngestionJob) {
    const jobs = await this.getIngestionJobs();
    const next = jobs.filter((item: IngestionJob) => item.id !== record.id);
    next.unshift(record);
    await this.setIngestionJobs(next);
  }

  async upsertLegalDocument(record: LegalDocumentRecord) {
    const sanitizedRecord = sanitizeLegalDocForStore(record);
    const items = await this.getLegalDocuments();
    // Sanitize ALL existing docs on write to clean up any previously corrupted data
    const next = items
      .filter((item: LegalDocumentRecord) => item.id !== sanitizedRecord.id)
      .map(sanitizeLegalDocForStore);
    next.unshift(sanitizedRecord);
    const trashed = await this.getTrashedLegalDocuments();
    const nextTrash = trashed.filter(
      (item: LegalDocumentRecord) => item.id !== sanitizedRecord.id
    );
    await this.setLegalDocuments(next);
    await this.setTrashedLegalDocuments(nextTrash);
  }

  async upsertOcrJob(record: OcrJob) {
    const items = await this.getOcrJobs();
    const next = items.filter((item: OcrJob) => item.id !== record.id);
    next.unshift(record);
    await this.setOcrJobs(next);
  }

  async upsertLegalFinding(record: LegalFinding) {
    const items = await this.getLegalFindings();
    const next = items.filter((item: LegalFinding) => item.id !== record.id);
    next.unshift(record);
    await this.setLegalFindings(next);
  }

  async upsertCopilotTask(record: CopilotTask) {
    const items = await this.getCopilotTasks();
    const next = items.filter((item: CopilotTask) => item.id !== record.id);
    next.unshift(record);
    await this.setCopilotTasks(next);
  }

  async upsertBlueprint(record: CaseBlueprint) {
    const items = await this.getBlueprints();
    const next = items.filter((item: CaseBlueprint) => item.id !== record.id);
    next.unshift(record);
    await this.setBlueprints(next);
  }

  async upsertCopilotRun(record: CopilotRun) {
    const items = await this.getCopilotRuns();
    const next = items.filter((item: CopilotRun) => item.id !== record.id);
    next.unshift(record);
    await this.setCopilotRuns(next);
  }

  async upsertCourtDecision(record: CourtDecision) {
    const items = await this.getCourtDecisions();
    const next = items.filter((item: CourtDecision) => item.id !== record.id);
    next.unshift(record);
    await this.setCourtDecisions(next);
  }

  async upsertLegalNormRegistryRecord(record: LegalNormRegistryRecord) {
    const items = await this.getLegalNormRegistry();
    const next = items.filter(
      (item: LegalNormRegistryRecord) => item.id !== record.id
    );
    next.unshift(record);
    await this.setLegalNormRegistry(next);
  }

  async upsertJudikaturSuggestion(record: JudikaturSuggestion) {
    const items = await this.getJudikaturSuggestions();
    const next = items.filter(
      (item: JudikaturSuggestion) => item.id !== record.id
    );
    next.unshift(record);
    await this.setJudikaturSuggestions(next);
  }

  async upsertCitationChain(record: CitationChain) {
    const items = await this.getCitationChains();
    const next = items.filter((item: CitationChain) => item.id !== record.id);
    next.unshift(record);
    await this.setCitationChains(next);
  }

  async appendWorkflowEvent(event: WorkflowEvent, maxItems = 500) {
    const items = await this.getWorkflowEvents();
    const next = [event, ...items].slice(0, maxItems);
    await this.setWorkflowEvents(next);
  }

  async appendAuditEntry(entry: ComplianceAuditEntry, maxItems = 1000) {
    const items = await this.getAuditEntries();
    const next = [entry, ...items].slice(0, maxItems);
    await this.setAuditEntries(next);
  }

  async upsertKanzleiProfile(profile: KanzleiProfile) {
    const graph = await this.getGraph();
    graph.kanzleiProfile = profile;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async upsertAnwalt(record: AnwaltProfile) {
    const graph = await this.getGraph();
    graph.anwaelte = graph.anwaelte ?? {};
    graph.anwaelte[record.id] = record;
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
  }

  async deleteAnwalt(anwaltId: string) {
    const graph = await this.getGraph();
    if (!graph.anwaelte?.[anwaltId]) {
      return false;
    }
    delete graph.anwaelte[anwaltId];
    graph.updatedAt = new Date().toISOString();
    await this.setGraph(graph);
    return true;
  }

  // ── Analytics & Monitoring ─────────────────────────────────────────────────

  getAnalyticsEvents(): AnalyticsEvent[] {
    return (
      this.globalState.get<AnalyticsEvent[]>(this.analyticsEventsKey) ?? []
    );
  }

  setAnalyticsEvents(events: AnalyticsEvent[]): void {
    this.globalState.set(this.analyticsEventsKey, events);
  }

  watchAnalyticsEvents() {
    return this.watchState<AnalyticsEvent[]>(this.analyticsEventsKey, []);
  }

  getAnalyticsSessions(): AnalyticsSession[] {
    return (
      this.globalState.get<AnalyticsSession[]>(this.analyticsSessionsKey) ?? []
    );
  }

  setAnalyticsSessions(sessions: AnalyticsSession[]): void {
    this.globalState.set(this.analyticsSessionsKey, sessions);
  }

  watchAnalyticsSessions() {
    return this.watchState<AnalyticsSession[]>(this.analyticsSessionsKey, []);
  }

  getErrorLogs(): ErrorLogEntry[] {
    return this.globalState.get<ErrorLogEntry[]>(this.errorLogsKey) ?? [];
  }

  setErrorLogs(logs: ErrorLogEntry[]): void {
    this.globalState.set(this.errorLogsKey, logs);
  }

  watchErrorLogs() {
    return this.watchState<ErrorLogEntry[]>(this.errorLogsKey, []);
  }

  getPerformanceMetrics(): PerformanceMetric[] {
    return (
      this.globalState.get<PerformanceMetric[]>(this.performanceMetricsKey) ??
      []
    );
  }

  setPerformanceMetrics(metrics: PerformanceMetric[]): void {
    this.globalState.set(this.performanceMetricsKey, metrics);
  }

  watchPerformanceMetrics() {
    return this.watchState<PerformanceMetric[]>(this.performanceMetricsKey, []);
  }

  getCustomerHealthScores(): CustomerHealthScore[] {
    return (
      this.globalState.get<CustomerHealthScore[]>(
        this.customerHealthScoresKey
      ) ?? []
    );
  }

  setCustomerHealthScores(scores: CustomerHealthScore[]): void {
    this.globalState.set(this.customerHealthScoresKey, scores);
  }

  watchCustomerHealthScores() {
    return this.watchState<CustomerHealthScore[]>(
      this.customerHealthScoresKey,
      []
    );
  }

  getGeoCache(): { location: GeoLocation; cachedAt: number } | null {
    return (
      this.globalState.get<{ location: GeoLocation; cachedAt: number }>(
        this.geoCacheKey
      ) ?? null
    );
  }

  setGeoCache(cache: { location: GeoLocation; cachedAt: number }): void {
    this.globalState.set(this.geoCacheKey, cache);
  }

  // ── Legal AI Premium Chat ────────────────────────────────────────────────────

  getChatSessions(): LegalChatSession[] {
    return this.globalState.get<LegalChatSession[]>(this.chatSessionsKey) ?? [];
  }

  setChatSessions(sessions: LegalChatSession[]): void {
    this.globalState.set(this.chatSessionsKey, sessions);
  }

  getTrashedChatSessions(): LegalChatSession[] {
    return (
      this.globalState.get<LegalChatSession[]>(this.chatSessionsTrashKey) ?? []
    );
  }

  setTrashedChatSessions(sessions: LegalChatSession[]): void {
    this.globalState.set(this.chatSessionsTrashKey, sessions);
  }

  watchChatSessions() {
    return this.watchState<LegalChatSession[]>(this.chatSessionsKey, []);
  }

  getChatMessages(): LegalChatMessage[] {
    return this.globalState.get<LegalChatMessage[]>(this.chatMessagesKey) ?? [];
  }

  setChatMessages(messages: LegalChatMessage[]): void {
    this.globalState.set(this.chatMessagesKey, messages);
  }

  getTrashedChatMessages(): LegalChatMessage[] {
    return (
      this.globalState.get<LegalChatMessage[]>(this.chatMessagesTrashKey) ?? []
    );
  }

  setTrashedChatMessages(messages: LegalChatMessage[]): void {
    this.globalState.set(this.chatMessagesTrashKey, messages);
  }

  watchChatMessages() {
    return this.watchState<LegalChatMessage[]>(this.chatMessagesKey, []);
  }

  watchCopilotMemories() {
    return this.watchState<any[]>(this.copilotMemoriesKey, []);
  }

  async getCopilotMemories() {
    return (await this.readState<any[]>(this.copilotMemoriesKey)) ?? [];
  }

  async setCopilotMemories(items: any[]) {
    await this.writeState(this.copilotMemoriesKey, items);
  }

  watchCrossCheckReports() {
    return this.watchState<any[]>(this.crossCheckReportsKey, []);
  }

  async getCrossCheckReports() {
    return (await this.readState<any[]>(this.crossCheckReportsKey)) ?? [];
  }

  async setCrossCheckReports(items: any[]) {
    await this.writeState(this.crossCheckReportsKey, items);
  }

  watchMessageFeedback() {
    return this.watchState<any[]>(this.messageFeedbackKey, []);
  }

  async getMessageFeedback() {
    return (await this.readState<any[]>(this.messageFeedbackKey)) ?? [];
  }

  async setMessageFeedback(items: any[]) {
    await this.writeState(this.messageFeedbackKey, items);
  }

  // ── Gegner Intelligence ─────────────────────────────────────────────────

  getGegnerProfiles(): GegnerKanzleiProfile[] {
    return (
      this.globalState.get<GegnerKanzleiProfile[]>(this.gegnerProfilesKey) ?? []
    );
  }

  setGegnerProfiles(profiles: GegnerKanzleiProfile[]): void {
    this.globalState.set(this.gegnerProfilesKey, profiles);
  }

  watchGegnerProfiles() {
    return this.watchState<GegnerKanzleiProfile[]>(this.gegnerProfilesKey, []);
  }

  getRichterProfiles(): RichterProfile[] {
    return (
      this.globalState.get<RichterProfile[]>(this.richterProfilesKey) ?? []
    );
  }

  setRichterProfiles(profiles: RichterProfile[]): void {
    this.globalState.set(this.richterProfilesKey, profiles);
  }

  watchRichterProfiles() {
    return this.watchState<RichterProfile[]>(this.richterProfilesKey, []);
  }

  // ── Collective Legal Intelligence ───────────────────────────────────────────

  private get collectiveKnowledgePoolKey() {
    return `case-assistant:collective:knowledge-pool`;
  }

  private get sharedCourtDecisionsKey() {
    return `case-assistant:collective:shared-court-decisions`;
  }

  private get collectiveSharingConfigKey() {
    return `case-assistant:${this.workspaceId}:collective-sharing-config`;
  }

  getCollectiveKnowledgePool(): CollectiveKnowledgeEntry[] {
    return (
      this.globalState.get<CollectiveKnowledgeEntry[]>(
        this.collectiveKnowledgePoolKey
      ) ?? []
    );
  }

  setCollectiveKnowledgePool(entries: CollectiveKnowledgeEntry[]): void {
    this.globalState.set(this.collectiveKnowledgePoolKey, entries);
  }

  watchCollectiveKnowledgePool() {
    return this.watchState<CollectiveKnowledgeEntry[]>(
      this.collectiveKnowledgePoolKey,
      []
    );
  }

  getSharedCourtDecisions(): SharedCourtDecision[] {
    return (
      this.globalState.get<SharedCourtDecision[]>(
        this.sharedCourtDecisionsKey
      ) ?? []
    );
  }

  setSharedCourtDecisions(decisions: SharedCourtDecision[]): void {
    this.globalState.set(this.sharedCourtDecisionsKey, decisions);
  }

  watchSharedCourtDecisions() {
    return this.watchState<SharedCourtDecision[]>(
      this.sharedCourtDecisionsKey,
      []
    );
  }

  getCollectiveSharingConfig(): CollectiveSharingConfig | null {
    return (
      this.globalState.get<CollectiveSharingConfig>(
        this.collectiveSharingConfigKey
      ) ?? null
    );
  }

  setCollectiveSharingConfig(config: CollectiveSharingConfig): void {
    this.globalState.set(this.collectiveSharingConfigKey, config);
  }

  watchCollectiveSharingConfig() {
    return this.watchState<CollectiveSharingConfig | null>(
      this.collectiveSharingConfigKey,
      null
    );
  }

  // ═══ Jurisdiction ═══

  private get activeJurisdictionKey() {
    return `case-assistant:${this.workspaceId}:active-jurisdiction`;
  }

  private get residencyPolicyKey() {
    return `case-assistant:${this.workspaceId}:residency-policy`;
  }

  getActiveJurisdiction(): Jurisdiction {
    return (
      this.globalState.get<Jurisdiction>(this.activeJurisdictionKey) ?? 'AT'
    );
  }

  setActiveJurisdiction(jurisdiction: Jurisdiction): void {
    this.globalState.set(this.activeJurisdictionKey, jurisdiction);
  }

  watchActiveJurisdiction() {
    return this.watchState<Jurisdiction>(this.activeJurisdictionKey, 'AT');
  }

  watchWorkspaceResidencyPolicy() {
    return this.watchState<WorkspaceResidencyPolicy | null>(
      this.residencyPolicyKey,
      null
    );
  }

  async getWorkspaceResidencyPolicy() {
    return (
      (await this.readState<WorkspaceResidencyPolicy>(
        this.residencyPolicyKey
      )) ?? null
    );
  }

  async setWorkspaceResidencyPolicy(policy: WorkspaceResidencyPolicy) {
    await this.writeState(this.residencyPolicyKey, policy);
  }

  // ═══ Anwalt-Workflow Features (Gaps) ═══

  private get timeEntriesKey() {
    return `case-assistant:${this.workspaceId}:time-entries`;
  }

  private get wiedervorlagenKey() {
    return `case-assistant:${this.workspaceId}:wiedervorlagen`;
  }

  private get aktennotizenKey() {
    return `case-assistant:${this.workspaceId}:aktennotizen`;
  }

  private get vollmachtenKey() {
    return `case-assistant:${this.workspaceId}:vollmachten`;
  }

  private get rechnungenKey() {
    return `case-assistant:${this.workspaceId}:rechnungen`;
  }

  private get auslagenKey() {
    return `case-assistant:${this.workspaceId}:auslagen`;
  }

  private get kassenbelegeKey() {
    return `case-assistant:${this.workspaceId}:kassenbelege`;
  }

  private get fiscalSignaturesKey() {
    return `case-assistant:${this.workspaceId}:fiscal-signatures`;
  }

  private get exportJournalKey() {
    return `case-assistant:${this.workspaceId}:export-journal`;
  }

  watchTimeEntries() {
    return this.watchState<TimeEntry[]>(this.timeEntriesKey, []);
  }

  async getTimeEntries() {
    return (await this.readState<TimeEntry[]>(this.timeEntriesKey)) ?? [];
  }

  async setTimeEntries(items: TimeEntry[]) {
    await this.writeState(this.timeEntriesKey, items);
  }

  watchWiedervorlagen() {
    return this.watchState<Wiedervorlage[]>(this.wiedervorlagenKey, []);
  }

  async getWiedervorlagen() {
    return (
      (await this.readState<Wiedervorlage[]>(this.wiedervorlagenKey)) ?? []
    );
  }

  async setWiedervorlagen(items: Wiedervorlage[]) {
    await this.writeState(this.wiedervorlagenKey, items);
  }

  watchAktennotizen() {
    return this.watchState<Aktennotiz[]>(this.aktennotizenKey, []);
  }

  async getAktennotizen() {
    return (await this.readState<Aktennotiz[]>(this.aktennotizenKey)) ?? [];
  }

  async setAktennotizen(items: Aktennotiz[]) {
    await this.writeState(this.aktennotizenKey, items);
  }

  watchVollmachten() {
    return this.watchState<Vollmacht[]>(this.vollmachtenKey, []);
  }

  async getVollmachten() {
    return (await this.readState<Vollmacht[]>(this.vollmachtenKey)) ?? [];
  }

  async setVollmachten(items: Vollmacht[]) {
    await this.writeState(this.vollmachtenKey, items);
  }

  watchRechnungen() {
    return this.watchState<RechnungRecord[]>(this.rechnungenKey, []);
  }

  async getRechnungen() {
    return (await this.readState<RechnungRecord[]>(this.rechnungenKey)) ?? [];
  }

  async setRechnungen(items: RechnungRecord[]) {
    await this.writeState(this.rechnungenKey, items);
  }

  watchAuslagen() {
    return this.watchState<AuslageRecord[]>(this.auslagenKey, []);
  }

  async getAuslagen() {
    return (await this.readState<AuslageRecord[]>(this.auslagenKey)) ?? [];
  }

  async setAuslagen(items: AuslageRecord[]) {
    await this.writeState(this.auslagenKey, items);
  }

  watchKassenbelege() {
    return this.watchState<KassenbelegRecord[]>(this.kassenbelegeKey, []);
  }

  async getKassenbelege() {
    return (
      (await this.readState<KassenbelegRecord[]>(this.kassenbelegeKey)) ?? []
    );
  }

  async setKassenbelege(items: KassenbelegRecord[]) {
    await this.writeState(this.kassenbelegeKey, items);
  }

  watchFiscalSignatures() {
    return this.watchState<FiscalSignatureRecord[]>(
      this.fiscalSignaturesKey,
      []
    );
  }

  async getFiscalSignatures() {
    return (
      (await this.readState<FiscalSignatureRecord[]>(
        this.fiscalSignaturesKey
      )) ?? []
    );
  }

  async setFiscalSignatures(items: FiscalSignatureRecord[]) {
    await this.writeState(this.fiscalSignaturesKey, items);
  }

  watchExportJournal() {
    return this.watchState<ExportJournalRecord[]>(this.exportJournalKey, []);
  }

  async getExportJournal() {
    return (
      (await this.readState<ExportJournalRecord[]>(this.exportJournalKey)) ?? []
    );
  }

  async setExportJournal(items: ExportJournalRecord[]) {
    await this.writeState(this.exportJournalKey, items);
  }
}
