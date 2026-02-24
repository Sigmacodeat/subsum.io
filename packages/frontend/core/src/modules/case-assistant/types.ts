export type CasePriority = 'critical' | 'high' | 'medium' | 'low';

export type CaseActorRole =
  | 'lawyer'
  | 'judge'
  | 'prosecutor'
  | 'client'
  | 'victim'
  | 'private_plaintiff'
  | 'employee'
  | 'suspect'
  | 'organization'
  | 'authority'
  | 'court'
  | 'opposing_party'
  | 'witness'
  | 'other';

export type CaseIssueCategory =
  | 'contradiction'
  | 'liability'
  | 'official_liability_claim'
  | 'causality'
  | 'deadline'
  | 'evidence'
  | 'procedure'
  | 'risk'
  | 'other';

export type DeadlineStatus =
  | 'open'
  | 'alerted'
  | 'acknowledged'
  | 'completed'
  | 'expired';

export type WorkspaceResidencyMode = 'cloud' | 'local_only' | 'self_hosted';

export interface WorkspaceResidencyPolicy {
  workspaceId: string;
  mode: WorkspaceResidencyMode;
  region?: string;
  allowCloudSync: boolean;
  allowRemoteOcr: boolean;
  allowExternalConnectors: boolean;
  allowTelemetry: boolean;
  requireMfaForAdmins: boolean;
  requireMfaForMembers: boolean;
  enforceEncryptionAtRest: boolean;
  sessionIdleTimeoutMinutes: number;
  updatedAt: string;
}

export type RechnungsPaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'card'
  | 'sepa_direct_debit'
  | 'other';

export interface RechnungsZahlungRecord {
  id: string;
  rechnungId: string;
  amount: number;
  method: RechnungsPaymentMethod;
  paidAt: string;
  reference?: string;
  createdAt: string;
}

export interface KassenbelegRecord {
  id: string;
  workspaceId: string;
  matterId: string;
  caseId: string;
  clientId: string;
  rechnungId: string;
  belegnummer: string;
  zahlungsbetrag: number;
  waehrung: string;
  ustProzent: number;
  ustBetrag: number;
  nettoBetrag: number;
  paymentMethod: RechnungsPaymentMethod;
  buchungsdatum: string;
  leistungsbeschreibung: string;
  storniert: boolean;
  storniertAm?: string;
  stornoGrund?: string;
  fiscalSignatureId?: string;
  fiscalSignatureHash?: string;
  fiscalPreviousHash?: string;
  createdAt: string;
  updatedAt: string;
}

export type FiscalEventType =
  | 'cash_payment'
  | 'receipt_voided'
  | 'daily_closure'
  | 'system_event';

export interface FiscalSignatureRecord {
  id: string;
  workspaceId: string;
  caseId?: string;
  matterId?: string;
  kassenbelegId?: string;
  eventType: FiscalEventType;
  payloadHash: string;
  previousHash: string;
  chainHash: string;
  algorithm: 'sha256';
  signedAt: string;
}

export interface ExportJournalRecord {
  id: string;
  workspaceId: string;
  caseId?: string;
  provider: 'datev' | 'bmd' | 'lexware' | 'csv';
  format: string;
  scope: 'rechnungen' | 'auslagen' | 'zeiteintraege' | 'alles';
  runId: string;
  fileName?: string;
  recordCount: number;
  totalNetto: number;
  totalBrutto: number;
  status: 'ready' | 'downloaded' | 'failed';
  periodFrom: string;
  periodTo: string;
  triggeredBy: string;
  chainHash: string;
  previousHash: string;
  createdAt: string;
}

export type AnwaltRole = 'partner' | 'senior_associate' | 'associate' | 'counsel' | 'referendar' | 'other';

export interface KanzleiProfile {
  id: string;
  workspaceId: string;
  name: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  steuernummer?: string;
  ustIdNr?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  datevBeraternummer?: string;
  datevMandantennummer?: string;
  bmdFirmennummer?: string;
  rechtsanwaltskammer?: string;
  aktenzeichenSchema?: string;
  /** Base64-encoded data URL for the law firm logo (max ~200KB recommended) */
  logoDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type PortalRequestType = 'vollmacht' | 'kyc';

export type PortalRequestChannel = 'email' | 'whatsapp';

export type PortalRequestStatus =
  | 'created'
  | 'sent'
  | 'opened'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'revoked';

export interface PortalRequestRecord {
  id: string;
  workspaceId: string;
  clientId: string;
  caseId?: string;
  matterId?: string;
  type: PortalRequestType;
  channel: PortalRequestChannel;
  status: PortalRequestStatus;
  tokenHash: string;
  expiresAt: string;
  lastSentAt?: string;
  openedAt?: string;
  completedAt?: string;
  revokedAt?: string;
  failedAt?: string;
  sendCount: number;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type VollmachtSigningMode = 'upload' | 'esign';

export type VollmachtSigningProvider =
  | 'none'
  | 'docusign'
  | 'signaturit'
  | 'dropbox_sign';

export type VollmachtSigningStatus =
  | 'requested'
  | 'email_sent'
  | 'opened'
  | 'uploaded'
  | 'provider_sent'
  | 'provider_viewed'
  | 'provider_signed'
  | 'provider_declined'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revoked';

export interface VollmachtSigningRequestRecord {
  id: string;
  workspaceId: string;
  clientId: string;
  caseId?: string;
  matterId?: string;
  portalRequestId?: string;
  vollmachtId?: string;
  mode: VollmachtSigningMode;
  provider: VollmachtSigningProvider;
  providerEnvelopeId?: string;
  providerStatus?: string;
  status: VollmachtSigningStatus;
  uploadedDocumentId?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type KycSubmissionStatus =
  | 'requested'
  | 'email_sent'
  | 'opened'
  | 'uploaded'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revoked';

export interface KycSubmissionRecord {
  id: string;
  workspaceId: string;
  clientId: string;
  caseId?: string;
  matterId?: string;
  portalRequestId?: string;
  status: KycSubmissionStatus;
  uploadedDocumentIds: string[];
  formData?: Record<string, string>;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AnwaltProfile {
  id: string;
  workspaceId: string;
  kanzleiId: string;
  /** Linked real workspace user account for permission-safe assignment. */
  workspaceUserId?: string;
  /** Snapshot of linked workspace user email for display/audit resilience. */
  workspaceUserEmail?: string;
  title: string;
  firstName: string;
  lastName: string;
  fachgebiet?: string;
  email?: string;
  phone?: string;
  zulassungsnummer?: string;
  role: AnwaltRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClientKind = 'person' | 'company' | 'authority' | 'other';

export interface ClientRecord {
  id: string;
  workspaceId: string;
  kind: ClientKind;
  displayName: string;
  identifiers?: string[];
  primaryEmail?: string;
  primaryPhone?: string;
  address?: string;
  notes?: string;
  tags: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MatterStatus = 'open' | 'closed' | 'archived';

export interface MatterRecord {
  id: string;
  workspaceId: string;
  /** Primary client — backward-compatible single reference */
  clientId: string;
  /** All clients linked to this matter (multi-mandant: Streitgenossenschaft, Erbengemeinschaft, etc.) */
  clientIds?: string[];
  /** Jurisdiktion der Akte (z.B. AT/DE/CH/EU) */
  jurisdiction?: Jurisdiction;
  assignedAnwaltId?: string;
  /** Additional assigned lawyers for multi-Anwalt matters */
  assignedAnwaltIds?: string[];
  title: string;
  description?: string;
  externalRef?: string;
  /** Additional authority references extracted from documents (e.g. Staatsanwaltschaft/Polizei/Gericht file numbers). */
  authorityReferences?: string[];
  /** Zuständiges Gericht (z.B. "Landesgericht Wien", "Amtsgericht München") */
  gericht?: string;
  status: MatterStatus;
  /** Opposing party information */
  opposingParties?: OpposingParty[];
  tags: string[];
  /** AFFiNE page IDs of documents created/linked within this Akte */
  linkedPageIds?: string[];
  /** Timestamp when matter was archived (status changed to 'archived') */
  archivedAt?: string;
  /** Timestamp when matter was marked for deletion (moved to trash) */
  trashedAt?: string;
  /** Timestamp when matter will be permanently purged from trash */
  purgeAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpposingPartyKind = 'person' | 'company' | 'authority' | 'other';

export interface OpposingParty {
  id: string;
  kind: OpposingPartyKind;
  displayName: string;
  legalRepresentative?: string;
  lawFirm?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export type BulkOperationType =
  | 'email'
  | 'pdf-export'
  | 'schriftsatz'
  | 'mandantenbrief'
  | 'status-update';

export type BulkOperationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial';

export interface BulkOperation {
  id: string;
  workspaceId: string;
  type: BulkOperationType;
  targetMatterIds: string[];
  targetClientIds: string[];
  status: BulkOperationStatus;
  progress: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  results: BulkOperationResult[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkOperationResult {
  targetId: string;
  success: boolean;
  message: string;
  outputRef?: string;
}

export type EmailStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'failed' | 'bounced';

export type EmailTemplateType =
  | 'mandantenbrief'
  | 'fristenwarnung'
  | 'statusbericht'
  | 'dokumentenversand'
  | 'terminbestaetigung'
  | 'vollmacht'
  | 'kostenvoranschlag'
  | 'rechtsschutzanfrage'
  | 'deckungszusage_erinnerung'
  | 'custom';

export interface EmailRecord {
  id: string;
  workspaceId: string;
  matterId?: string;
  clientId?: string;
  templateType: EmailTemplateType;
  subject: string;
  bodyHtml: string;
  bodyPlainText: string;
  recipientEmail: string;
  recipientName: string;
  ccEmails?: string[];
  bccEmails?: string[];
  senderName: string;
  senderEmail: string;
  attachmentRefs?: string[];
  status: EmailStatus;
  sentAt?: string;
  errorMessage?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CaseActor {
  id: string;
  name: string;
  role: CaseActorRole;
  aliases?: string[];
  organizationName?: string;
  representedBy?: string;
  representedByConflicts?: string[];
  representedParties?: string[];
  phones?: string[];
  emails?: string[];
  addresses?: string[];
  demands?: string[];
  claimAmounts?: string[];
  confidence?: number;
  extractedFromText?: string[];
  sourceDocIds: string[];
  notes?: string;
  updatedAt: string;
}

export interface CaseIssue {
  id: string;
  category: CaseIssueCategory;
  title: string;
  description: string;
  priority: CasePriority;
  confidence: number;
  sourceDocIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseDeadline {
  id: string;
  title: string;
  dueAt: string;
  derivedFrom?: 'auto_template' | 'limitation_rule' | 'regex_extract' | 'manual';
  baseEventAt?: string;
  detectionConfidence?: number;
  requiresReview?: boolean;
  evidenceSnippets?: string[];
  reviewedAt?: string;
  reviewedBy?: string;
  sourceDocIds: string[];
  status: DeadlineStatus;
  priority: CasePriority;
  reminderOffsetsInMinutes: number[];
  alertedAt?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseMemoryEvent {
  id: string;
  actorId?: string;
  issueId?: string;
  deadlineId?: string;
  summary: string;
  sourceDocIds: string[];
  createdAt: string;
}

export interface CaseFile {
  id: string;
  workspaceId: string;
  /**
   * Kanzlei-Workflow: Ein Case (konkretes Problem/Verfahren) gehört zu einer Akte (Matter).
   * Optional für Backward-Compatibility; wird bei Migration automatisch gesetzt.
   */
  matterId?: string;
  title: string;
  summary?: string;
  externalRef?: string;
  actorIds: string[];
  issueIds: string[];
  deadlineIds: string[];
  terminIds?: string[];
  memoryEventIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseGraphRecord {
  kanzleiProfile?: KanzleiProfile;
  anwaelte?: Record<string, AnwaltProfile>;
  clients?: Record<string, ClientRecord>;
  matters?: Record<string, MatterRecord>;
  cases: Record<string, CaseFile>;
  actors: Record<string, CaseActor>;
  issues: Record<string, CaseIssue>;
  deadlines: Record<string, CaseDeadline>;
  termine?: Record<string, Gerichtstermin>;
  memoryEvents: Record<string, CaseMemoryEvent>;
  updatedAt: string;
}

export interface DeadlineAlert {
  id: string;
  caseId: string;
  deadlineId: string;
  title: string;
  dueAt: string;
  minutesUntilDue: number;
  priority: CasePriority;
  source?: 'deadline' | 'wiedervorlage' | 'gerichtstermin' | 'user';
  sourceId?: string;
  matterId?: string;
  createdAt: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  tags?: string[];
}

export interface CaseIngestionResult {
  caseFile: CaseFile;
  actors: CaseActor[];
  issues: CaseIssue[];
  deadlines: CaseDeadline[];
  memoryEvents: CaseMemoryEvent[];
}

export interface ConversationContextPack {
  caseId: string;
  summary?: string;
  openDeadlines: CaseDeadline[];
  criticalIssues: CaseIssue[];
  keyActors: CaseActor[];
  latestMemoryEvents: CaseMemoryEvent[];
  /** Extended context for case Q&A */
  clientName?: string;
  matterTitle?: string;
  aktenzeichen?: string;
  gericht?: string;
  anwaltName?: string;
  opposingPartyNames?: string[];
  documentCount: number;
  indexedDocumentCount: number;
  ocrPendingCount: number;
  findingsSummary?: string;
  tasksSummary?: string;
  normReferences?: string[];
  semanticChunksSummary?: string;
  totalChunks?: number;
  totalEntities?: number;
  generatedAt: string;
}

export type ConnectorKind = 'paperless' | 'n8n' | 'mail' | 'dropbox';

export type ConnectorStatus = 'connected' | 'disconnected' | 'error';

export type ConnectorAuthType = 'none' | 'bearer' | 'api-key';

export interface ConnectorConfig {
  id: string;
  workspaceId: string;
  kind: ConnectorKind;
  name: string;
  endpoint: string;
  authType: ConnectorAuthType;
  authHeaderName?: string;
  enabled: boolean;
  status: ConnectorStatus;
  lastSyncedAt?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type IntakeSourceType =
  | 'selection'
  | 'document'
  | 'folder'
  | 'upload'
  | 'external';

export type IngestionJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface IngestionJob {
  id: string;
  caseId: string;
  workspaceId: string;
  sourceType: IntakeSourceType;
  sourceRef: string;
  status: IngestionJobStatus;
  progress: number;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
}

export type LegalDocumentKind =
  | 'note'
  | 'pdf'
  | 'scan-pdf'
  | 'email'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'other';

export type LegalDocumentStatus =
  | 'uploaded'
  | 'ocr_pending'
  | 'ocr_running'
  | 'ocr_completed'
  | 'indexed'
  | 'failed';

export type JurisdictionDetectionSignalType =
  | 'court'
  | 'authority'
  | 'law_reference'
  | 'citation'
  | 'address'
  | 'domain'
  | 'language'
  | 'other';

export interface JurisdictionDetectionSignal {
  type: JurisdictionDetectionSignalType;
  value: string;
  weight: number;
  evidence?: string;
}

export interface JurisdictionDetectionResult {
  jurisdiction: Jurisdiction;
  confidence: number;
  signals: JurisdictionDetectionSignal[];
}

export type DocumentProcessingStatus =
  | 'uploading'
  | 'extracting'
  | 'chunking'
  | 'analyzing'
  | 'ready'
  | 'needs_review'
  | 'failed';

export type DocumentPreflightRouteDecision =
  | 'text_extract'
  | 'ocr_queue'
  | 'manual_review'
  | 'blocked';

export type DocumentPreflightRiskLevel = 'ok' | 'warning' | 'critical';

export interface DocumentPreflightReport {
  version: 'v1';
  routeDecision: DocumentPreflightRouteDecision;
  riskLevel: DocumentPreflightRiskLevel;
  reasonCodes: string[];
  mimeByHeader?: string;
  mimeByMagicBytes?: string;
  isBinaryPayload: boolean;
  contentLength: number;
  createdAt: string;
}

export interface IntakeDocumentInput {
  id?: string;
  title: string;
  kind: LegalDocumentKind;
  content: string;
  sourceMimeType?: string;
  sourceSizeBytes?: number;
  sourceLastModifiedAt?: string | number;
  sourceRef?: string;
  folderPath?: string;
  internalFileNumber?: string | number;
  paragraphReferences?: string[];
  pageCount?: number;
  tags?: string[];
  preflight?: DocumentPreflightReport;
}

export interface LegalDocumentRecord {
  id: string;
  caseId: string;
  workspaceId: string;
  title: string;
  kind: LegalDocumentKind;
  status: LegalDocumentStatus;
  detectedJurisdiction?: Jurisdiction;
  jurisdictionConfidence?: number;
  jurisdictionSignals?: JurisdictionDetectionSignal[];
  sourceMimeType?: string;
  sourceSizeBytes?: number;
  sourceLastModifiedAt?: string;
  sourceBlobId?: string;
  sourceSha256?: string;
  folderPath?: string;
  internalFileNumber?: string;
  paragraphReferences?: string[];
  sourceRef?: string;
  documentRevision?: number;
  contentFingerprint?: string;
  rawText: string;
  normalizedText?: string;
  language?: string;
  qualityScore?: number;
  pageCount?: number;
  ocrEngine?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  processingStatus?: DocumentProcessingStatus;
  chunkCount?: number;
  entityCount?: number;
  overallQualityScore?: number;
  processingDurationMs?: number;
  extractionEngine?: string;
  /** Human-readable error description when processingStatus is 'failed' or 'needs_review'. */
  processingError?: string;
  preflight?: DocumentPreflightReport;
  discardedBinaryAt?: string;
  trashedAt?: string;
  purgeAt?: string;
}

export type SemanticChunkCategory =
  | 'sachverhalt'
  | 'rechtsausfuehrung'
  | 'antrag'
  | 'begruendung'
  | 'frist'
  | 'bescheid'
  | 'urteil'
  | 'vertrag'
  | 'korrespondenz'
  | 'beweis'
  | 'zeuge'
  | 'gutachten'
  | 'anklageschrift'
  | 'protokoll'
  | 'vollmacht'
  | 'rechnung'
  | 'strafanzeige'
  | 'klageschrift'
  | 'berufung'
  | 'mahnung'
  | 'sonstiges';

export interface ChunkExtractedEntities {
  persons: string[];
  organizations: string[];
  dates: string[];
  legalRefs: string[];
  amounts: string[];
  caseNumbers: string[];
  addresses: string[];
  ibans: string[];
}

export interface SemanticChunk {
  id: string;
  documentId: string;
  caseId: string;
  workspaceId: string;
  index: number;
  text: string;
  category: SemanticChunkCategory;
  pageNumber?: number;
  extractedEntities: ChunkExtractedEntities;
  keywords: string[];
  qualityScore: number;
  createdAt: string;
}

export type QualityProblemType =
  | 'ocr_low_confidence'
  | 'missing_pages'
  | 'garbled_text'
  | 'no_text_extracted'
  | 'suspicious_characters'
  | 'truncated'
  | 'column_layout_detected';

export interface QualityProblem {
  type: QualityProblemType;
  description: string;
  severity: 'error' | 'warning' | 'info';
  pageNumber?: number;
  chunkIndex?: number;
}

export type ChecklistItemStatus = 'ok' | 'warning' | 'error' | 'skipped';

export interface IntakeChecklistItem {
  id: string;
  label: string;
  status: ChecklistItemStatus;
  detail?: string;
  userVerified?: boolean;
  verifiedAt?: string;
}

export interface DocumentQualityReport {
  documentId: string;
  caseId: string;
  workspaceId: string;
  overallScore: number;
  ocrConfidence: number;
  extractedPageCount: number;
  expectedPageCount?: number;
  totalChunks: number;
  totalEntities: number;
  problems: QualityProblem[];
  checklistItems: IntakeChecklistItem[];
  processedAt: string;
  processingDurationMs: number;
}

export type OcrJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface OcrJob {
  id: string;
  caseId: string;
  workspaceId: string;
  documentId: string;
  status: OcrJobStatus;
  progress: number;
  stage?: 'queued' | 'rendering' | 'recognizing' | 'postprocess' | 'persist';
  currentPage?: number;
  totalPages?: number;
  lastHeartbeatAt?: string;
  engine?: string;
  languageHint?: string;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
}

export type LegalFindingType =
  | 'contradiction'
  | 'cross_reference'
  | 'liability'
  | 'deadline_risk'
  | 'evidence_gap'
  | 'action_recommendation'
  | 'norm_error'
  | 'norm_warning'
  | 'norm_suggestion';

export interface LegalFinding {
  id: string;
  caseId: string;
  workspaceId: string;
  type: LegalFindingType;
  title: string;
  description: string;
  severity: CasePriority;
  confidence: number;
  sourceDocumentIds: string[];
  citations: Array<{
    documentId: string;
    quote: string;
    startOffset?: number;
    endOffset?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type CopilotTaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';

export interface CopilotTask {
  id: string;
  caseId: string;
  workspaceId: string;
  title: string;
  description: string;
  priority: CasePriority;
  status: CopilotTaskStatus;
  assignee?: string;
  dueAt?: string;
  linkedFindingIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseBlueprint {
  id: string;
  caseId: string;
  workspaceId: string;
  title: string;
  objective: string;
  sections: Array<{
    id: string;
    heading: string;
    content: string;
    linkedFindingIds: string[];
  }>;
  generatedBy: 'copilot' | 'user';
  reviewStatus?: 'draft' | 'in_review' | 'approved';
  reviewNote?: string;
  reviewedAt?: string;
  generatedAt: string;
  updatedAt: string;
}

export type CopilotRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface CopilotRun {
  id: string;
  caseId: string;
  workspaceId: string;
  mode: 'analysis' | 'summary' | 'blueprint' | 'task_plan';
  inputDocumentIds: string[];
  status: CopilotRunStatus;
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
  outputSummary?: string;
}

export type Jurisdiction = 'AT' | 'DE' | 'CH' | 'FR' | 'IT' | 'PT' | 'PL' | 'EU' | 'ECHR';

/**
 * Configuration for a specific jurisdiction.
 * Used by the JurisdictionService to adapt the entire SaaS to a country.
 */
export interface JurisdictionConfig {
  id: Jurisdiction;
  label: string;
  flag: string;
  /** Primary language codes for this jurisdiction */
  languages: string[];
  /** National court hierarchy */
  courtLevels: CourtLevel[];
  /** Primary civil code identifiers */
  civilCodeRefs: string[];
  /** Primary criminal code identifiers */
  criminalCodeRefs: string[];
  /** Primary procedural code identifiers */
  proceduralCodeRefs: string[];
  /** Data protection authority name */
  dataProtectionAuthority: string;
  /** Currency code (for cost calculations) */
  currency: string;
  /** Timezone for deadline calculations */
  timezone: string;
  /** Whether this jurisdiction uses the metric date format (DD.MM.YYYY) */
  dateFormat: string;
}

export type CourtLevel =
  // Austria
  | 'OGH'
  | 'VfGH'
  | 'VwGH'
  | 'OLG'
  | 'LG_AT'
  | 'BG_AT'
  | 'BVwG'
  | 'LVwG'
  | 'ASG'
  // Germany
  | 'BGH'
  | 'BVerfG'
  | 'BVerwG'
  | 'BAG'
  | 'BSG'
  | 'BFH'
  | 'OLG_DE'
  | 'LG_DE'
  | 'AG_DE'
  // Switzerland
  | 'BGer'
  | 'BVGer_CH'
  | 'BStGer_CH'
  | 'KGer_CH'
  | 'OGer_CH'
  | 'BezGer_CH'
  // France
  | 'CdC'
  | 'CE_FR'
  | 'CC_FR'
  | 'CA_FR'
  | 'TGI_FR'
  | 'TJ_FR'
  // Italy
  | 'CdC_IT'
  | 'CC_IT'
  | 'CdA_IT'
  | 'Trib_IT'
  | 'GdP_IT'
  // Portugal
  | 'STJ_PT'
  | 'TC_PT'
  | 'STA_PT'
  | 'TRL_PT'
  | 'TRC_PT'
  | 'TRE_PT'
  | 'TRP_PT'
  // Poland
  | 'SN_PL'
  | 'TK_PL'
  | 'NSA_PL'
  | 'SA_PL'
  | 'SO_PL'
  | 'SR_PL'
  // EU / International
  | 'EGMR'
  | 'EuGH'
  | 'EuG';

export type LegalArea =
  | 'zivilrecht'
  | 'strafrecht'
  | 'verwaltungsrecht'
  | 'arbeitsrecht'
  | 'sozialrecht'
  | 'steuerrecht'
  | 'verfassungsrecht'
  | 'menschenrechte'
  | 'handelsrecht'
  | 'mietrecht'
  | 'familienrecht'
  | 'insolvenzrecht'
  | 'medienrecht'
  | 'datenschutzrecht'
  | 'wettbewerbsrecht'
  | 'vergaberecht';

export interface NormReference {
  normId: string;
  law: string;
  paragraph: string;
  jurisdiction: Jurisdiction;
  effectiveFrom?: string;
  effectiveTo?: string;
  isRepealed?: boolean;
  repealedByNormId?: string;
  validityNote?: string;
}

export interface CourtDecision {
  id: string;
  jurisdiction: Jurisdiction;
  court: CourtLevel;
  precedentialWeight?: 'supreme' | 'appellate' | 'first_instance' | 'international' | 'unknown';
  chamber?: string;
  fileNumber: string;
  ecli?: string;
  decisionDate: string;
  appliesFrom?: string;
  appliesUntil?: string;
  publicationDate?: string;
  decisionType: 'urteil' | 'beschluss' | 'erkenntnis' | 'entscheidung';
  title: string;
  headnotes: string[];
  summary: string;
  fullText?: string;
  facts?: string;
  reasoning?: string;
  legalAreas: LegalArea[];
  keywords: string[];
  referencedNorms: NormReference[];
  referencedDecisions: string[];
  citedByDecisions: string[];
  sourceUrl?: string;
  sourceDatabase: 'ris' | 'openlegaldata' | 'hudoc' | 'juris' | 'beck' | 'manual';
  isLeadingCase: boolean;
  isOverruled: boolean;
  overruledBy?: string;
  embeddingVector?: number[];
  embeddingModel?: string;
  importedAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface LegalNormRegistryRecord {
  id: string;
  jurisdiction: Jurisdiction;
  law: string;
  paragraph: string;
  title: string;
  shortDescription: string;
  legalAreas: LegalArea[];
  keywords: string[];
  limitationPeriodYears?: number;
  burdenOfProof?: 'claimant' | 'defendant' | 'shared';
  equivalentNorms?: Array<{
    jurisdiction: Jurisdiction;
    normId: string;
    similarity: 'identical' | 'similar' | 'related';
  }>;
  leadingCaseIds: string[];
  recentCaseIds: string[];
  sourceUrl?: string;
  importedAt: string;
  updatedAt: string;
}

export interface JudikaturSuggestion {
  id: string;
  caseId: string;
  workspaceId: string;
  decisionId: string;
  decisionDate?: string;
  decisionJurisdiction?: Jurisdiction;
  /** Primary jurisdiction of the analyzed case context (e.g. AT for an Austrian case). */
  primaryJurisdiction?: Jurisdiction;
  /** True when suggestion comes from a different jurisdiction than the case primary jurisdiction. */
  isCrossBorder?: boolean;
  /** Practical authority classification for legal drafting assistance. */
  authorityLevel?: 'binding' | 'persuasive' | 'reference';
  temporalApplicability?: 'current' | 'historical' | 'unknown';
  temporalReason?: string;
  sourceVerified?: boolean;
  relevanceScore: number;
  matchReason: string;
  matchedKeywords: string[];
  matchedNorms: string[];
  suggestedUsage: 'support' | 'counter' | 'reference';
  citationMarkdown: string;
  appliedToDocumentId?: string;
  createdAt: string;
  dismissedAt?: string;
}

export interface CitationEntry {
  order: number;
  type: 'norm' | 'decision' | 'commentary' | 'custom';
  normReference?: NormReference;
  decisionId?: string;
  decisionFileNumber?: string;
  decisionCourt?: string;
  decisionDate?: string;
  headnote?: string;
  quote?: string;
  annotation?: string;
  citationFormatted: string;
}

export interface CitationChain {
  id: string;
  caseId: string;
  workspaceId: string;
  title: string;
  entries: CitationEntry[];
  generatedAt: string;
  updatedAt: string;
}

export type WorkflowEventType =
  | 'job.queued'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'connector.updated'
  | 'alert.acknowledged'
  | 'document.uploaded'
  | 'ocr.job.queued'
  | 'ocr.job.running'
  | 'ocr.job.completed'
  | 'ocr.job.failed'
  | 'ocr.job.cancelled'
  | 'analysis.completed'
  | 'blueprint.generated'
  | 'task.generated'
  | 'client.updated'
  | 'client.deleted'
  | 'matter.updated'
  | 'matter.deleted'
  | 'case.updated'
  | 'case.matter.assigned'
  | 'gerichtstermin.updated'
  | 'gerichtstermin.deleted'
  | 'bulk.operation.started'
  | 'bulk.operation.completed'
  | 'bulk.operation.failed'
  | 'email.sent'
  | 'email.failed'
  | 'opposing_party.updated'
  | 'opposing_party.deleted'
  | 'deadline.acknowledged'
  | 'deadline.completed'
  | 'deadline.reopened'
  | 'finding.acknowledged'
  | 'finding.dismissed';

export type CaseAssistantRole = 'viewer' | 'operator' | 'admin' | 'owner';

export type CaseAssistantAction =
  | 'connector.configure'
  | 'connector.toggle'
  | 'connector.healthcheck'
  | 'connector.rotate'
  | 'connector.clear_auth'
  | 'connector.dispatch'
  | 'case.manage'
  | 'client.manage'
  | 'matter.manage'
  | 'audit.export'
  | 'audit.verify'
  | 'job.cancel'
  | 'job.retry'
  | 'document.upload'
  | 'document.ocr'
  | 'document.analyze'
  | 'task.manage'
  | 'blueprint.manage'
  | 'copilot.execute'
  | 'kanzlei.manage'
  | 'residency.manage'
  | 'folder.search'
  | 'folder.summarize'
  | 'bulk.execute'
  | 'email.send'
  | 'opposing_party.manage'
  | 'deadline.manage'
  | 'finding.manage';

export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  caseId?: string;
  workspaceId: string;
  actor: 'system' | 'user';
  payload: Record<string, string | number | boolean | null>;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS & MONITORING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AnalyticsEventCategory =
  | 'page_view'
  | 'feature_usage'
  | 'user_action'
  | 'navigation'
  | 'search'
  | 'document'
  | 'case_action'
  | 'copilot'
  | 'error'
  | 'performance'
  | 'session'
  | 'system';

export type AnalyticsEventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface AnalyticsEvent {
  id: string;
  workspaceId: string;
  userId?: string;
  sessionId: string;
  category: AnalyticsEventCategory;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
  url?: string;
  referrer?: string;
  userAgent?: string;
  deviceType?: DeviceType;
  geo?: GeoLocation;
}

export type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'unknown';

export type BrowserFamily = 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'other';

export type OSFamily = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'other';

export interface DeviceInfo {
  type: DeviceType;
  browser: BrowserFamily;
  browserVersion?: string;
  os: OSFamily;
  osVersion?: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  language: string;
  timezone: string;
  touchEnabled: boolean;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
}

export interface GeoLocation {
  country: string;
  countryCode: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  resolvedAt: string;
}

export interface AnalyticsSession {
  id: string;
  workspaceId: string;
  userId?: string;
  startedAt: string;
  lastActivityAt: string;
  endedAt?: string;
  duration: number;
  pageViewCount: number;
  eventCount: number;
  errorCount: number;
  featureUsageCount: number;
  entryPage?: string;
  exitPage?: string;
  device: DeviceInfo;
  geo?: GeoLocation;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  isBounce: boolean;
  isReturning: boolean;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory =
  | 'javascript'
  | 'network'
  | 'api'
  | 'rendering'
  | 'state'
  | 'permission'
  | 'timeout'
  | 'validation'
  | 'unknown';

export interface ErrorLogEntry {
  id: string;
  workspaceId: string;
  userId?: string;
  sessionId: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  componentName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  fileName?: string;
  userAgent?: string;
  device?: DeviceInfo;
  geo?: GeoLocation;
  metadata?: Record<string, string | number | boolean>;
  fingerprint: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  isResolved: boolean;
  affectedUserIds: string[];
}

export interface ErrorGroup {
  fingerprint: string;
  representativeError: ErrorLogEntry;
  totalOccurrences: number;
  affectedUsers: number;
  affectedSessions: number;
  firstSeenAt: string;
  lastSeenAt: string;
  trend: 'increasing' | 'stable' | 'decreasing' | 'new';
  isResolved: boolean;
}

export type PerformanceMetricName =
  | 'fcp'
  | 'lcp'
  | 'fid'
  | 'cls'
  | 'ttfb'
  | 'inp'
  | 'page_load'
  | 'dom_ready'
  | 'api_latency'
  | 'render_time'
  | 'bundle_size'
  | 'memory_usage'
  | 'long_task';

export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

export interface PerformanceMetric {
  id: string;
  workspaceId: string;
  sessionId: string;
  userId?: string;
  name: PerformanceMetricName;
  value: number;
  unit: 'ms' | 'score' | 'bytes' | 'count';
  rating: PerformanceRating;
  url?: string;
  element?: string;
  timestamp: string;
  device?: DeviceInfo;
  connection?: ConnectionInfo;
}

export interface ConnectionInfo {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface PerformanceSummary {
  workspaceId: string;
  period: AnalyticsPeriod;
  p50: Record<PerformanceMetricName, number>;
  p75: Record<PerformanceMetricName, number>;
  p95: Record<PerformanceMetricName, number>;
  p99: Record<PerformanceMetricName, number>;
  ratings: Record<PerformanceMetricName, { good: number; needsImprovement: number; poor: number }>;
  sampleCount: number;
  generatedAt: string;
}

export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface AnalyticsDateRange {
  from: string;
  to: string;
}

export interface FeatureUsageRecord {
  featureId: string;
  featureName: string;
  category: string;
  totalUsageCount: number;
  uniqueUsers: number;
  avgUsagePerUser: number;
  avgDurationMs?: number;
  adoptionRate: number;
  trend: 'growing' | 'stable' | 'declining' | 'new';
  lastUsedAt: string;
  firstUsedAt: string;
}

export interface DailyActiveMetrics {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  returningUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  totalPageViews: number;
  totalEvents: number;
  totalErrors: number;
  topFeatures: Array<{ featureId: string; count: number }>;
  topPages: Array<{ url: string; views: number }>;
}

export interface RetentionCohort {
  cohortDate: string;
  cohortSize: number;
  retentionByDay: Record<number, number>;
  retentionByWeek: Record<number, number>;
}

export type CustomerHealthStatus = 'healthy' | 'at-risk' | 'critical' | 'churned' | 'new';

export interface CustomerHealthScore {
  workspaceId: string;
  userId?: string;
  customerName: string;
  overallScore: number;
  status: CustomerHealthStatus;
  engagementScore: number;
  adoptionScore: number;
  errorScore: number;
  performanceScore: number;
  retentionScore: number;
  lastActiveAt: string;
  daysSinceLastActive: number;
  totalSessions30d: number;
  totalErrors30d: number;
  avgSessionDuration30d: number;
  featuresUsed30d: number;
  churnRisk: number;
  trends: {
    engagement: 'up' | 'stable' | 'down';
    errors: 'up' | 'stable' | 'down';
    usage: 'up' | 'stable' | 'down';
  };
  alerts: CustomerHealthAlert[];
  computedAt: string;
}

export interface CustomerHealthAlert {
  id: string;
  type: 'error_spike' | 'usage_drop' | 'performance_degradation' | 'feature_abandonment' | 'inactivity' | 'churn_risk';
  severity: ErrorSeverity;
  message: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  triggeredAt: string;
  acknowledgedAt?: string;
}

export interface GeoDistribution {
  country: string;
  countryCode: string;
  userCount: number;
  sessionCount: number;
  percentage: number;
  cities: Array<{
    city: string;
    region?: string;
    userCount: number;
    sessionCount: number;
    latitude?: number;
    longitude?: number;
  }>;
}

export interface AnalyticsDashboardSnapshot {
  workspaceId: string;
  period: AnalyticsPeriod;
  generatedAt: string;
  kpis: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    totalSessions: number;
    avgSessionDuration: number;
    bounceRate: number;
    totalPageViews: number;
    totalErrors: number;
    errorRate: number;
    avgLoadTime: number;
    customerHealthAvg: number;
    atRiskCustomers: number;
  };
  dailyMetrics: DailyActiveMetrics[];
  featureUsage: FeatureUsageRecord[];
  errorGroups: ErrorGroup[];
  geoDistribution: GeoDistribution[];
  performanceSummary: PerformanceSummary;
  customerHealth: CustomerHealthScore[];
  retentionCohorts: RetentionCohort[];
  topReferrers: Array<{ source: string; count: number; percentage: number }>;
  deviceBreakdown: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
  browserBreakdown: Record<BrowserFamily, number>;
  osBreakdown: Record<OSFamily, number>;
}

export type AuditSeverity = 'info' | 'warning' | 'error';

export interface ComplianceAuditEntry {
  id: string;
  caseId?: string;
  workspaceId: string;
  action: string;
  severity: AuditSeverity;
  details: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface AuditChainAnchor {
  scopeId: string;
  workspaceId: string;
  caseId?: string;
  entryCount: number;
  chainHead: string;
  exportedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AKTENAUDIT & NORM-KLASSIFIZIERUNG TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TatbestandsMerkmalCheck {
  merkmalId: string;
  label: string;
  description: string;
  fulfilled: boolean;
  confidence: number;
  matchedIndicators: string[];
  sourceExcerpts: string[];
  required: boolean;
  weight: number;
}

export interface TatbestandsCheckResult {
  normId: string;
  normTitle: string;
  law: string;
  paragraph: string;
  domain: string;
  merkmale: TatbestandsMerkmalCheck[];
  overallScore: number;
  /** Ratio of fulfilled required merkmale to total required */
  fulfillmentRatio: number;
  /** Ratio of fulfilled weighted merkmale */
  weightedScore: number;
  /** Whether ALL required merkmale are fulfilled */
  allRequiredFulfilled: boolean;
  matchedKeywords: string[];
  sourceDocumentIds: string[];
}

export type ReclassificationDirection = 'upgrade' | 'downgrade' | 'alternative';

export interface ReclassificationSuggestion {
  id: string;
  currentNormId: string;
  currentNormTitle: string;
  suggestedNormId: string;
  suggestedNormTitle: string;
  direction: ReclassificationDirection;
  reason: string;
  confidence: number;
  triggeredByIndicators: string[];
  legalBasis: string;
  strafrahmenCurrent?: string;
  strafrahmenSuggested?: string;
}

export interface QualificationChainResult {
  baseNormId: string;
  baseNormTitle: string;
  detectedQualifications: Array<{
    normId: string;
    normTitle: string;
    level: number;
    score: number;
    triggerIndicators: string[];
  }>;
  recommendedNormId: string;
  recommendedNormTitle: string;
  chainDescription: string;
}

export interface BeweislastCheckResult {
  normId: string;
  normTitle: string;
  burden: 'claimant' | 'defendant' | 'shared';
  burdenDescription: string;
  identifiedGaps: string[];
  missingEvidence: string[];
}

export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CaseAuditResult {
  id: string;
  caseId: string;
  workspaceId: string;
  auditedDocumentIds: string[];
  /** All norms detected as potentially applicable based on facts */
  detectedNorms: TatbestandsCheckResult[];
  /** Suggestions to reclassify from one norm to another */
  reclassifications: ReclassificationSuggestion[];
  /** Full qualification chains analyzed */
  qualificationChains: QualificationChainResult[];
  /** Beweislast analysis per detected norm */
  beweislastAnalysis: BeweislastCheckResult[];
  /** Overall risk score 0-100 */
  overallRiskScore: number;
  riskLevel: AuditRiskLevel;
  /** Human-readable summary */
  summary: string;
  /** KPI counters */
  stats: {
    totalDocumentsAudited: number;
    totalNormsDetected: number;
    totalReclassifications: number;
    totalQualificationUpgrades: number;
    totalBeweislastGaps: number;
    highConfidenceNorms: number;
  };
  generatedAt: string;
  auditDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGAL AI PREMIUM CHAT — "LEGAL COPILOT"
// ═══════════════════════════════════════════════════════════════════════════════

export type LegalChatMode =
  | 'general'
  | 'strategie'
  | 'subsumtion'
  | 'gegner'
  | 'richter'
  | 'beweislage'
  | 'fristen'
  | 'normen';

export type LegalChatMessageRole = 'user' | 'assistant' | 'system';

export type LegalChatMessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

// ── LLM Model / Provider Selection ──────────────────────────────────────────

export type LlmProviderId =
  | 'openai'
  | 'anthropic'
  | 'anthropicVertex'
  | 'mistral'
  | 'google'
  | 'gemini'
  | 'geminiVertex'
  | 'perplexity'
  | 'fal'
  | 'morph'
  | 'custom'
  | 'tenant';

export interface LlmModelOption {
  id: string;
  providerId: LlmProviderId;
  label: string;
  description: string;
  contextWindow: number;
  /** Whether this model supports streaming */
  supportsStreaming: boolean;
  /** Relative cost tier for credit calculation */
  costTier: 'low' | 'medium' | 'high' | 'premium';
  /** Icon emoji or identifier */
  icon: string;
  /** Optional explicit credit multiplier (overrides cost tier mapping when present) */
  creditMultiplier?: number;
  /** Optional reasoning/thinking strength shown in UI */
  thinkingLevel?: 'low' | 'medium' | 'high';
}

// ── Tool Call Types (visible in chat like Cascade) ──────────────────────────

export type ChatToolCallStatus =
  | 'running'
  | 'complete'
  | 'error'
  | 'awaiting_approval'
  | 'cancelled'
  | 'skipped'
  | 'blocked';

export type ChatToolCallName =
  | 'search_chunks'
  | 'search_norms'
  | 'analyze_evidence'
  | 'analyze_case'
  | 'check_deadlines'
  | 'detect_contradictions'
  | 'generate_document'
  | 'clarify_request'
  | 'approval_gate'
  | 'search_judikatur'
  | 'build_context'
  | 'credit_check'
  | 'norm_subsumtion'
  | 'gegner_profile'
  | 'collective_intelligence'
  | 'upload_documents'
  | 'ocr_processing'
  | 'chunk_extraction'
  | 'entity_extraction'
  | 'jurisdiction_detection'
  | 'contradiction_scan'
  | 'deadline_derivation'
  | 'norm_classification'
  | 'evidence_mapping'
  | 'document_finalize'
  | 'save_to_akte'
  | 'memory_lookup'
  | 'cross_check'
  | 'reasoning_chain'
  | 'confidence_score';

export type ChatToolCallCategory =
  | 'preparation'   // credit check, context building
  | 'retrieval'     // search chunks, norms, judikatur
  | 'analysis'      // evidence, contradictions, subsumtion
  | 'generation'    // document generation, LLM call
  | 'ingestion'     // upload, OCR, chunking, entity extraction
  | 'persistence';  // save to akte, finalize

export interface ChatToolCall {
  id: string;
  name: ChatToolCallName;
  label: string;
  status: ChatToolCallStatus;
  /** Category for visual grouping (like Cascade groups file changes) */
  category?: ChatToolCallCategory;
  /** Input summary shown to user */
  inputSummary?: string;
  /** Output summary shown to user */
  outputSummary?: string;
  /** Expandable detail lines (like Cascade's file change list) */
  detailLines?: ChatToolCallDetailLine[];
  /** Progress 0-100 for long-running steps */
  progress?: number;
  /** Duration in ms */
  durationMs?: number;
  /** Optional approval request metadata for return-of-control UX */
  approvalRequest?: ChatToolApprovalRequest;
  startedAt: string;
  finishedAt?: string;
}

export interface ChatToolApprovalField {
  key: string;
  label: string;
  value: string;
  required?: boolean;
  placeholder?: string;
}

export interface ChatToolApprovalRequest {
  title: string;
  description: string;
  riskLevel?: 'low' | 'medium' | 'high';
  fields: ChatToolApprovalField[];
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ChatToolCallDetailLine {
  /** Icon type for visual differentiation */
  icon: 'file' | 'norm' | 'finding' | 'deadline' | 'chunk' | 'warning' | 'check' | 'document';
  /** Primary label (e.g. file name, norm reference) */
  label: string;
  /** Secondary text (e.g. category, status) */
  meta?: string;
  /** Diff-style counts: lines/chunks added/removed */
  added?: number;
  removed?: number;
}

// ── Chat Artifact Types (generated documents, downloadable in chat) ──────────

export type ChatArtifactKind =
  | 'schriftsatz'    // Klageschrift, Berufung, etc.
  | 'gutachten'      // Legal opinion / Gutachten
  | 'vertrag'        // Contract / Vertrag
  | 'brief'          // Letter / Anschreiben
  | 'notiz'          // Internal note
  | 'analyse'        // Analysis report
  | 'zusammenfassung' // Summary document
  | 'generic';       // Generic document

export interface ChatArtifact {
  id: string;
  /** Display title */
  title: string;
  /** Document kind for icon/badge */
  kind: ChatArtifactKind;
  /** MIME type of the artifact */
  mimeType: string;
  /** Content as string (markdown/text) */
  content: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Whether this artifact has been saved to the Akte */
  savedToAkte: boolean;
  /** Document ID in Akte (if saved) */
  akteDocumentId?: string;
  /** Template used for generation */
  templateName?: string;
  createdAt: string;
}

export interface LegalChatSourceCitation {
  documentId: string;
  documentTitle: string;
  chunkIndex?: number;
  quote: string;
  category?: SemanticChunkCategory;
  relevanceScore: number;
}

export interface LegalChatNormCitation {
  normId: string;
  law: string;
  paragraph: string;
  title: string;
  relevance: string;
}

export interface LegalChatFindingRef {
  findingId: string;
  title: string;
  type: LegalFindingType;
  severity: CasePriority;
}

export interface LegalChatMessage {
  id: string;
  sessionId: string;
  role: LegalChatMessageRole;
  content: string;
  mode: LegalChatMode;
  status: LegalChatMessageStatus;
  /** Source citations from semantic chunks */
  sourceCitations: LegalChatSourceCitation[];
  /** Referenced legal norms */
  normCitations: LegalChatNormCitation[];
  /** Referenced findings */
  findingRefs: LegalChatFindingRef[];
  /** Tool calls executed during this message (visible as cards in UI) */
  toolCalls?: ChatToolCall[];
  /** Generated document artifacts (downloadable / saveable to Akte) */
  artifacts?: ChatArtifact[];
  /** Which LLM model was used for this response */
  modelId?: string;
  /** Token count for context window management */
  tokenEstimate: number;
  /** Processing duration in ms */
  durationMs?: number;
  // ── Copilot Intelligence Layer fields ──────────────────────────────────
  /** Reasoning chain for this message (visible thinking steps) */
  reasoningChain?: {
    id: string;
    messageId: string;
    steps: Array<{
      id: string;
      type: string;
      label: string;
      detail?: string;
      sourceRefs?: Array<{ type: string; id: string; title: string }>;
      durationMs?: number;
      confidenceAfter?: number;
      status: string;
    }>;
    totalDurationMs: number;
    finalConfidence: number;
    isStreaming: boolean;
    createdAt: string;
  };
  /** Confidence assessment of the answer */
  confidence?: {
    score: number;
    level: string;
    factors: Array<{ name: string; weight: number; score: number; description: string }>;
    supportingSources: number;
    contradictingSources: number;
    hasUnverifiedClaims: boolean;
    warnings: string[];
  };
  /** Cross-check report ID if triggered by this message */
  crossCheckReportId?: string;
  /** User feedback on this message */
  feedback?: {
    id: string;
    messageId: string;
    rating: string;
    category?: string;
    comment?: string;
    createdAt: string;
  };
  /** Memory IDs that were used in context for this message */
  usedMemoryIds?: string[];
  /** Memory IDs that were created from this message */
  createdMemoryIds?: string[];
  trashedAt?: string;
  purgeAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalChatSession {
  id: string;
  caseId: string;
  workspaceId: string;
  title: string;
  mode: LegalChatMode;
  /** Selected LLM model for this session */
  modelId?: string;
  messageCount: number;
  /** Total tokens used across all messages */
  totalTokens: number;
  /** Last user message preview */
  lastMessagePreview: string;
  isPinned: boolean;
  trashedAt?: string;
  purgeAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalChatContextSnapshot {
  caseId: string;
  workspaceId: string;
  mode: LegalChatMode;
  /** Relevant semantic chunks injected into context */
  relevantChunks: Array<{
    chunkId: string;
    documentId: string;
    documentTitle: string;
    text: string;
    category: SemanticChunkCategory;
    relevanceScore: number;
  }>;
  /** Active findings summary */
  findingsSummary: string;
  /** Active norms in play */
  activeNorms: string[];
  /** Deadline warnings */
  deadlineWarnings: string[];
  /** Contradiction highlights */
  contradictionHighlights: string[];
  /** Evidence gaps */
  evidenceGaps: string[];
  /** Opposing party context */
  opposingPartyContext: string;
  /** Ranked judikatur context with authority and temporal metadata */
  judikaturContext: Array<{
    decisionId: string;
    citationMarkdown: string;
    authorityLevel?: 'binding' | 'persuasive' | 'reference';
    temporalApplicability?: 'current' | 'historical' | 'unknown';
    relevanceScore: number;
  }>;
  /** Reliability warnings (e.g. historical/overruled references) for safer answers */
  sourceReliabilityWarnings: string[];
  /** Generated system prompt */
  systemPrompt: string;
  /** Collective intelligence context injected */
  collectiveContext?: CollectiveContextInjection;
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTIVE LEGAL INTELLIGENCE — Cross-Tenant Knowledge Sharing
// ═══════════════════════════════════════════════════════════════════════════════

export type CollectiveKnowledgeCategory =
  | 'norm_application'
  | 'strategy_pattern'
  | 'contradiction_pattern'
  | 'evidence_pattern'
  | 'deadline_pattern'
  | 'cost_pattern'
  | 'procedural_insight'
  | 'court_tendency'
  | 'argument_template'
  | 'risk_pattern';

export type CollectiveContributionStatus =
  | 'pending'
  | 'anonymized'
  | 'verified'
  | 'published'
  | 'rejected';

export type SharedJudikaturStatus =
  | 'ingested'
  | 'verified'
  | 'enriched'
  | 'published';

export type CollectiveSharingLevel =
  | 'private'
  | 'anonymized_shared'
  | 'public';

/** A single anonymized knowledge entry contributed by a tenant */
export interface CollectiveKnowledgeEntry {
  id: string;
  /** Anonymized — no workspace identifiers stored */
  contributorHash: string;
  category: CollectiveKnowledgeCategory;
  /** Anonymized title (no names, no AZ, no personal data) */
  title: string;
  /** Anonymized content — legal patterns, not case details */
  content: string;
  /** Legal domain tags (e.g., 'zivilrecht', 'strafrecht', 'verwaltungsrecht') */
  legalDomains: string[];
  /** Referenced norms (e.g., ['§ 823 BGB', '§ 263 StGB']) */
  normReferences: string[];
  /** Jurisdictions this applies to */
  jurisdictions: Array<'AT' | 'DE' | 'EU' | 'CH'>;
  /** Keywords for semantic search */
  keywords: string[];
  /** How many tenants have validated/upvoted this pattern */
  validationCount: number;
  /** Confidence score 0-1 based on cross-tenant validation */
  confidenceScore: number;
  /** Quality score from automated checks */
  qualityScore: number;
  status: CollectiveContributionStatus;
  /** Embedding vector for semantic search (simplified: keyword-based scoring) */
  embeddingKeywords: string[];
  createdAt: string;
  updatedAt: string;
}

/** Aggregated statistics from the collective knowledge pool */
export interface CollectivePoolStats {
  totalEntries: number;
  totalContributors: number;
  totalNormsReferenced: number;
  totalValidations: number;
  entriesByCategory: Record<CollectiveKnowledgeCategory, number>;
  entriesByJurisdiction: Record<string, number>;
  topNorms: Array<{ norm: string; count: number; avgConfidence: number }>;
  topDomains: Array<{ domain: string; count: number }>;
  recentContributions: number;
  averageConfidence: number;
  lastUpdatedAt: string;
}

/** A shared court decision (Urteil) available to all tenants */
export interface SharedCourtDecision {
  id: string;
  /** Court identifier (e.g., 'OGH', 'BGH', 'EGMR') */
  court: string;
  /** Decision reference number */
  referenceNumber: string;
  /** Decision date */
  decisionDate: string;
  /** Legal area */
  legalArea: string;
  /** Summary of the decision */
  summary: string;
  /** Key legal principles established (Leitsätze) */
  headnotes: string[];
  /** Referenced norms */
  normReferences: string[];
  /** Keywords */
  keywords: string[];
  /** Full text (if available) */
  fullText?: string;
  status: SharedJudikaturStatus;
  /** How many tenants have cited this decision */
  citationCount: number;
  /** Relevance score based on usage */
  relevanceScore: number;
  /** Contributed by (anonymized hash, or 'system' for crawled decisions) */
  contributorHash: string;
  createdAt: string;
  updatedAt: string;
}

/** Tenant-level configuration for knowledge sharing */
export interface CollectiveSharingConfig {
  workspaceId: string;
  /** Whether this tenant contributes anonymized knowledge */
  sharingEnabled: boolean;
  /** Level of sharing */
  sharingLevel: CollectiveSharingLevel;
  /** Categories this tenant opts in to share */
  sharedCategories: CollectiveKnowledgeCategory[];
  /** Whether to receive collective knowledge in chat context */
  receiveCollectiveContext: boolean;
  /** Maximum collective entries to inject per query */
  maxCollectiveContextEntries: number;
  /** Minimum confidence threshold for injected knowledge */
  minConfidenceThreshold: number;
  /** Auto-contribute findings after anonymization */
  autoContribute: boolean;
  updatedAt: string;
}

/** Context injection from collective pool into chat/copilot */
export interface CollectiveContextInjection {
  /** Relevant collective entries matched by query */
  matchedEntries: Array<{
    entryId: string;
    title: string;
    content: string;
    category: CollectiveKnowledgeCategory;
    normReferences: string[];
    confidenceScore: number;
    relevanceScore: number;
    validationCount: number;
  }>;
  /** Relevant shared court decisions */
  matchedDecisions: Array<{
    decisionId: string;
    court: string;
    referenceNumber: string;
    summary: string;
    headnotes: string[];
    normReferences: string[];
    relevanceScore: number;
  }>;
  /** Aggregated norm application patterns from the collective */
  normPatterns: Array<{
    norm: string;
    applicationCount: number;
    successRate: number;
    commonArguments: string[];
    commonCounterArguments: string[];
  }>;
  /** Total entries searched */
  totalSearched: number;
  /** How many tenants contributed to these results */
  contributorCount: number;
  generatedAt: string;
}

/** Admin Master Dashboard — aggregated view across all tenants */
export interface CollectiveMasterDashboard {
  /** Overall pool statistics */
  poolStats: CollectivePoolStats;
  /** Trending legal topics across all tenants */
  trendingTopics: Array<{
    topic: string;
    mentionCount: number;
    trend: 'rising' | 'stable' | 'declining';
    relatedNorms: string[];
  }>;
  /** Most active norm applications across platform */
  normHeatmap: Array<{
    norm: string;
    law: string;
    applicationCount: number;
    successIndicator: number;
    avgConfidence: number;
    jurisdictions: string[];
  }>;
  /** Strategy patterns that work across multiple cases */
  provenStrategies: Array<{
    id: string;
    title: string;
    description: string;
    legalDomain: string;
    validationCount: number;
    confidenceScore: number;
    normReferences: string[];
  }>;
  /** Emerging case law patterns from shared decisions */
  caseLawTrends: Array<{
    court: string;
    legalArea: string;
    trend: string;
    recentDecisions: number;
    direction: 'plaintiff_favorable' | 'defendant_favorable' | 'neutral';
  }>;
  /** Cross-tenant contradiction patterns (anonymized) */
  commonContradictions: Array<{
    pattern: string;
    frequency: number;
    legalDomain: string;
    resolutionHints: string[];
  }>;
  /** Knowledge gaps identified across the platform */
  knowledgeGaps: Array<{
    area: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    suggestedAction: string;
  }>;
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEGNER INTELLIGENCE — Opposing Counsel & Judge Profiling
// ═══════════════════════════════════════════════════════════════════════════════

export type GegnerStrategyType =
  | 'aggressive_litigation'
  | 'settlement_oriented'
  | 'procedural_delay'
  | 'evidence_challenge'
  | 'norm_reinterpretation'
  | 'emotional_appeal'
  | 'cost_pressure'
  | 'technical_defense'
  | 'jurisdictional_challenge'
  | 'other';

export type GegnerProfileSource = 'case_document' | 'manual_entry' | 'court_decision' | 'collective';

export interface GegnerStrategyPattern {
  id: string;
  type: GegnerStrategyType;
  description: string;
  normReferences: string[];
  observationCount: number;
  /** How often the opponent succeeded with this (0-1) */
  opponentSuccessRate: number;
  counterStrategies: string[];
  sourceCaseIds: string[];
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface GegnerArgumentPattern {
  argument: string;
  normReferences: string[];
  legalDomain: string;
  frequency: number;
  effectiveness: number;
  knownWeaknesses: string[];
}

export interface GegnerKanzleiProfile {
  id: string;
  firmName: string;
  knownAttorneys: string[];
  specializations: string[];
  strategyPatterns: GegnerStrategyPattern[];
  argumentPatterns: GegnerArgumentPattern[];
  aggressivenessScore: number;
  settlementTendency: number;
  delayTendency: number;
  totalEncounters: number;
  record: { wins: number; losses: number; settlements: number; pending: number };
  avgCaseDurationDays: number;
  preferredCourts: string[];
  preferredNorms: string[];
  notes: string;
  sources: GegnerProfileSource[];
  encounterCaseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type RichterTendencyArea =
  | 'beweislast'
  | 'vergleichsbereitschaft'
  | 'prozessfuehrung'
  | 'fristenstrenge'
  | 'parteivortrag'
  | 'gutachten'
  | 'kosten';

export interface RichterTendency {
  area: RichterTendencyArea;
  description: string;
  strength: number;
  observationCount: number;
}

export interface RichterProfile {
  id: string;
  name: string;
  court: string;
  senate: string;
  legalAreas: string[];
  tendencies: RichterTendency[];
  totalCasesObserved: number;
  plaintiffFavorableRate: number;
  settlementEncouragement: number;
  deadlineStrictness: number;
  evidenceThoroughness: number;
  preferredArgumentStyles: string[];
  pitfalls: string[];
  notableDecisionRefs: string[];
  sourceCaseIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface GegnerIntelligenceSnapshot {
  firmProfile: GegnerKanzleiProfile | null;
  richterProfile: RichterProfile | null;
  topStrategies: GegnerStrategyPattern[];
  topArguments: GegnerArgumentPattern[];
  counterRecommendations: string[];
  richterAdvice: string[];
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANWALTS-WORKFLOW GAPS — Zeiterfassung, Wiedervorlage, Aktennotizen, Vollmacht
// ═══════════════════════════════════════════════════════════════════════════════

export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'invoiced' | 'rejected';

export interface TimeEntry {
  id: string;
  workspaceId: string;
  caseId: string;
  matterId: string;
  clientId: string;
  anwaltId: string;
  description: string;
  activityType: 'beratung' | 'schriftsatz' | 'telefonat' | 'termin' | 'recherche' | 'akteneinsicht' | 'korrespondenz' | 'sonstiges';
  durationMinutes: number;
  hourlyRate: number;
  amount: number;
  date: string;
  status: TimeEntryStatus;
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export type WiedervorlageStatus = 'pending' | 'completed' | 'cancelled';

export interface Wiedervorlage {
  id: string;
  workspaceId: string;
  caseId: string;
  matterId: string;
  clientId: string;
  title: string;
  description?: string;
  dueAt: string;
  assignedAnwaltId?: string;
  priority: CasePriority;
  status: WiedervorlageStatus;
  completedAt?: string;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AktennotizKind = 'telefonat' | 'besprechung' | 'beschluss' | 'sonstiges';

export interface Aktennotiz {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export type VollmachtStatus = 'active' | 'expired' | 'revoked' | 'pending';

export interface Vollmacht {
  id: string;
  workspaceId: string;
  clientId: string;
  caseId?: string;
  matterId?: string;
  type: 'general' | 'special' | 'procuration' | 'process';
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
  status: VollmachtStatus;
  createdAt: string;
  updatedAt: string;
}

// Österreichische Kosten (RATG/GGG)
export type ATGerichtsinstanz =
  | 'bezirksgericht'
  | 'landesgericht'
  | 'oberlandesgericht'
  | 'oberster_gerichtshof'
  | 'verwaltungsgericht'
  | 'verfassungsgerichtshof';

export type ATVerfahrensart =
  | 'streitiges_verfahren'
  | 'mahnverfahren'
  | 'eilverfahren'
  | 'beschwerde'
  | 'rekurs'
  | 'revision';

export interface ATKostenInput {
  streitwert: number;
  instanz: ATGerichtsinstanz;
  verfahrensart: ATVerfahrensart;
  anzahlTermine?: number;
  beweisaufnahme?: boolean;
}

export interface ATAnwaltsgebuerenResult {
  grundgebuehr: number;
  schreibgebuehr: number;
  postengebuehr: number;
  einigungsgebihr: number;
  reisegebuehr: number;
  auslagen: number;
  ust: number;
  gesamt: number;
  details: string[];
}

export interface ATGerichtskostenResult {
  streitwert: number;
  gebuehrensatz: number;
  gerichtsgebihr: number;
  manipulationsgebuehr: number;
  gesamt: number;
  details: string[];
}

export interface ATKostenrisikoResult {
  streitwert: number;
  instanz: string;
  verfahrensart: string;
  eigeneAnwaltskosten: ATAnwaltsgebuerenResult;
  gerichtskosten: ATGerichtskostenResult;
  gesamtkostenBeiVerlust: number;
  gesamtkostenBeiObsiegen: number;
  gesamtrisiko: number;
  risikoklasse: 'niedrig' | 'mittel' | 'hoch' | 'sehr_hoch';
  empfehlung: string;
  warnungen: string[];
  berechnetAm: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANWALTS-WORKFLOW GAPS — Kollisionsprüfung (Conflict of Interest)
// ═══════════════════════════════════════════════════════════════════════════════

export type KollisionsRolle = 'mandant' | 'gegner' | 'beteiligter' | 'anwalt' | 'zeuge' | 'mitarbeiter';

export type KollisionsMatchLevel = 'exact' | 'high' | 'medium' | 'low';

export interface KollisionsTreffer {
  id: string; // uuid
  matchedName: string;
  matchedRolle: KollisionsRolle;
  matchLevel: KollisionsMatchLevel;
  relatedCaseId?: string;
  relatedMatterId?: string;
  relatedMatterName?: string;
  score: number; // 0-100
}

export interface KollisionsCheckResult {
  query: string;
  timestamp: string;
  treffer: KollisionsTreffer[];
  isClean: boolean; // true if treffer.length === 0 or only low scores
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANWALTS-WORKFLOW GAPS — Verfahrensstand & Instanzen
// ═══════════════════════════════════════════════════════════════════════════════

export type Verfahrensphase =
  | 'vorverfahrenlich'
  | 'klage_eingereicht'
  | 'klage_zugestellt'
  | 'klageerwiderung'
  | 'beweisaufnahme'
  | 'muendliche_verhandlung'
  | 'urteil'
  | 'berufung'
  | 'berufungsverhandlung'
  | 'berufungsurteil'
  | 'revision'
  | 'revisionsurteil'
  | 'vollstreckung'
  | 'abgeschlossen'
  | 'vergleich'
  | 'zurueckgewiesen';

export type InstanzLevel = 'erste' | 'zweite' | 'dritte' | 'vierte';

export interface VerfahrensstandRecord {
  id: string;
  workspaceId: string;
  matterId: string;
  caseId: string;
  phase: Verfahrensphase;
  instanz: InstanzLevel;
  gericht?: string;
  aktenzeichen?: string;
  richter?: string;
  startedAt: string;
  expectedEndAt?: string;
  completedAt?: string;
  notes?: string;
  linkedDocumentIds: string[];
  linkedDeadlineIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Gerichtstermin {
  id: string;
  workspaceId: string;
  matterId: string;
  caseId: string;
  verfahrensstandId?: string;
  derivedFrom?: 'document_extraction' | 'nlp_crud' | 'manual';
  sourceDocIds?: string[];
  detectionConfidence?: number;
  requiresReview?: boolean;
  evidenceSnippets?: string[];
  kategorie?: 'gerichtstermin' | 'gespraech' | 'sonstiger';
  terminart: 'muendliche_verhandlung' | 'beweisaufnahme' | 'gutachtentermin' | 'vergleichstermin' | 'urteilsverkündung' | 'sonstiger';
  datum: string;
  uhrzeit?: string;
  dauerMinuten?: number;
  gericht: string;
  saal?: string;
  richter?: string;
  berichterstatter?: string;
  teilnehmer: string[];
  notizen?: string;
  status: 'geplant' | 'bestaetigt' | 'abgesagt' | 'verschoben' | 'abgeschlossen';
  ergebnis?: string;
  folgeterminId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstanzHistorie {
  id: string;
  workspaceId: string;
  matterId: string;
  instanzen: Array<{
    level: InstanzLevel;
    verfahrensstandId: string;
    gericht: string;
    aktenzeichen: string;
    startedAt: string;
    endedAt?: string;
    ergebnis?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANWALTS-WORKFLOW GAPS — Kalender-Integration
// ═══════════════════════════════════════════════════════════════════════════════

export interface KalenderEvent {
  id: string;
  workspaceId: string;
  matterId?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  allDay: boolean;
  location?: string;
  reminders: Array<{ offsetMinutes: number; sent: boolean }>;
  source: 'deadline' | 'wiedervorlage' | 'gerichtstermin' | 'user';
  sourceId?: string;
  iCalUid?: string;
  externalProvider?: 'google' | 'outlook' | 'apple' | 'ical';
  externalSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KalenderExportResult {
  iCalContent: string;
  eventCount: number;
  exportedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANWALTS-WORKFLOW GAPS — Finanzen pro Akte
// ═══════════════════════════════════════════════════════════════════════════════

export interface RechnungRecord {
  id: string;
  workspaceId: string;
  matterId: string;
  caseId: string;
  clientId: string;
  rechnungsnummer: string;
  rechnungsdatum: string;
  faelligkeitsdatum: string;
  betreff: string;
  positionen: Array<{
    bezeichnung: string;
    anzahl: number;
    einheit: 'stunde' | 'pauschale' | 'seite' | 'stück';
    einzelpreis: number;
    gesamt: number;
    timeEntryId?: string;
  }>;
  netto: number;
  ustProzent: number;
  ustBetrag: number;
  brutto: number;
  honorarModell?: 'none' | 'hourly' | 'flat' | 'rvg' | 'ratg';
  honorarTarifCode?: string;
  leistungszeitraumVon?: string;
  leistungszeitraumBis?: string;
  status: 'entwurf' | 'versendet' | 'bezahlt' | 'teilbezahlt' | 'storniert' | 'mahnung_1' | 'mahnung_2' | 'inkasso';
  bezahltAm?: string;
  bezahlterBetrag?: number;
  zahlungen?: RechnungsZahlungRecord[];
  mahnungen: Array<{
    datum: string;
    mahnstufe: number;
    mahngebuehr: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AuslageRecord {
  id: string;
  workspaceId: string;
  matterId: string;
  caseId: string;
  clientId: string;
  bezeichnung: string;
  betrag: number;
  waehrung: string;
  datum: string;
  belegRef?: string;
  kategorie: 'gerichtskosten' | 'sachverstaendiger' | 'zeuge' | 'reisekosten' | 'kopien' | 'post' | 'sonstiges';
  weiterberechnet: boolean;
  rechnungId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AktenFinanzSummary {
  matterId: string;
  totalZeitMinuten: number;
  totalZeitWert: number;
  totalAuslagen: number;
  totalRechnungenNetto: number;
  totalRechnungenBezahlt: number;
  offenePosten: number;
  marge: number;
  generatedAt: string;
}

export interface KollisionsAuditLog {
  id: string;
  workspaceId: string;
  timestamp: string;
  anwaltId: string;
  query: string;
  result: KollisionsCheckResult;
  overridden: boolean;
  overrideReason?: string;
  matterId?: string; // If it was done for a specific matter
}
