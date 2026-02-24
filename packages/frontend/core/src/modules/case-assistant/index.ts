import type { Framework } from '@toeverything/infra';

import { CacheStorage, GlobalState } from '../storage';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { WorkspaceSubscriptionService } from '../cloud/services/workspace-subscription';
import { AktennotizService } from './services/aktennotiz';
import { AnwaltsReminderService } from './services/anwalts-reminder';
import { AnwaltsTagesjournalService } from './services/anwalts-tagesjournal';
import { CaseAlertCenterService } from './services/alert-center';
import { AnalyticsCollectorService } from './services/analytics-collector';
import { CaseAuditExportService } from './services/audit-export';
import { AustriaCostCalculatorService } from './services/austria-cost-calculator';
import { BghCrawlerService } from './services/bgh-crawler';
import { CaseAssistantBootstrapService } from './services/bootstrap';
import { BulkOperationsService } from './services/bulk-operations';
import { BusinessIntelligenceService } from './services/business-intelligence';
import { CaseAccessControlService } from './services/case-access-control';
import { CaseAssistantService } from './services/case-assistant';
import { CaseCockpitService } from './services/cockpit';
import { CollectiveIntelligenceService } from './services/collective-intelligence';
import { CopilotMemoryService } from './services/copilot-memory';
import { CaseContextPackService } from './services/context-pack';
import { ContradictionDetectorService } from './services/contradiction-detector';
import { CopilotNlpCrudService } from './services/copilot-nlp-crud';
import { CostCalculatorService } from './services/cost-calculator';
import { CreditGatewayService } from './services/credit-gateway';
import { CustomerHealthService } from './services/customer-health';
import { DeadlineAlertService } from './services/deadline-alert';
import { DeadlineAutomationService } from './services/deadline-automation';
import { TerminAutomationService } from './services/termin-automation';
import { DocumentGeneratorService } from './services/document-generator';
import { DocumentNormExtractorService } from './services/document-norm-extractor';
import { DocumentProcessingService } from './services/document-processing';
import { DocumentVersioningService } from './services/document-versioning';
import { DSGVOComplianceService } from './services/dsgvo-compliance';
import { EmailService } from './services/email';
import { ErrorMonitoringService } from './services/error-monitoring';
import { EvidenceRegisterService } from './services/evidence-register';
import { ExternalApiConnectorService } from './services/external-api-connectors';
import { FristenkontrolleService } from './services/fristenkontrolle';
import { GegnerIntelligenceService } from './services/gegner-intelligence';
import { GeoSessionAnalyticsService } from './services/geo-session-analytics';
import { GerichtsterminService } from './services/gerichtstermin';
import { GwGComplianceService } from './services/gwg-compliance';
import { HudocCrawlerService } from './services/hudoc-crawler';
import { CaseIngestionService } from './services/ingestion';
import { JudikaturIngestionService } from './services/judikatur-ingestion';
import { JudikaturResearchService } from './services/judikatur-research';
import { JurisdictionService } from './services/jurisdiction';
import { KalenderService } from './services/kalender';
import { KanzleiProfileService } from './services/kanzlei-profile';
import { KanzleiRuleValidationService } from './services/kanzlei-rule-validation';
import { KollisionsPruefungService } from './services/kollisions-pruefung';
import { LegalAnalysisProviderService } from './services/legal-analysis-provider';
import { LegalChatService } from './services/legal-chat';
import { LegalCopilotWorkflowService } from './services/legal-copilot-workflow';
import { LegalNormRegistryService } from './services/legal-norm-registry';
import { LegalNormsService } from './services/legal-norms';
import { LegalPdfExportService } from './services/legal-pdf-export';
import { MandantenPortalService } from './services/mandanten-portal';
import { NormClassificationEngine } from './services/norm-classification-engine';
import { PerformanceMonitorService } from './services/performance-monitor';
import { CasePlatformAdapterService } from './services/platform-adapters';
import { CasePlatformOrchestrationService } from './services/platform-orchestration';
import { CaseProviderSettingsService } from './services/provider-settings';
import { CaseResidencyPolicyService } from './services/residency-policy';
import { RechnungService } from './services/rechnung';
import { AIEmailDraftingService } from './services/ai-email-drafting';
import { BeAConnectorService } from './services/bea-connector';
import { CalendarSyncService } from './services/calendar-sync';
import { DATEVExportService } from './services/datev-export';
import { LiveTimerService } from './services/live-timer';
import { MandantenNotificationService } from './services/mandanten-notification';
import { RisCrawlerService } from './services/ris-crawler';
import { TreuhandkontoService } from './services/treuhandkonto';
import { TimeTrackingService } from './services/time-tracking';
import { VerfahrensstandService } from './services/verfahrensstand';
import { VollmachtService } from './services/vollmacht';
import { WiedervorlageService } from './services/wiedervorlage';
import { CaseAssistantStore } from './stores/case-assistant';
import { CaseConnectorSecretStore } from './stores/connector-secret';

export { AktennotizService } from './services/aktennotiz';
export type {
  AnwaltsReminder,
  AnwaltsReminderCategory,
  AnwaltsReminderChannel,
  AnwaltsReminderPreferences,
  AnwaltsReminderPriority,
  AnwaltsReminderStatus,
} from './services/anwalts-reminder';
export {
  ANWALTS_REMINDER_CATEGORY_LABELS,
  ANWALTS_REMINDER_STATUS_LABELS,
  AnwaltsReminderService,
} from './services/anwalts-reminder';
export type {
  TagesjournalEntry,
  TagesjournalItem,
  TagesjournalSection,
  TagesjournalSectionKind,
  TagesjournalStats,
} from './services/anwalts-tagesjournal';
export {
  AnwaltsTagesjournalService,
  TAGESJOURNAL_SECTION_ICONS,
  TAGESJOURNAL_SECTION_LABELS,
} from './services/anwalts-tagesjournal';
export { CaseAlertCenterService } from './services/alert-center';
export { AnalyticsCollectorService } from './services/analytics-collector';
export { CaseAuditExportService } from './services/audit-export';
export { AustriaCostCalculatorService } from './services/austria-cost-calculator';
export { BghCrawlerService } from './services/bgh-crawler';
export { CaseAssistantBootstrapService } from './services/bootstrap';
export type {
  BulkEmailInput,
  BulkPdfExportInput,
  BulkSchriftsatzInput,
  BulkStatusUpdateInput,
} from './services/bulk-operations';
export { BulkOperationsService } from './services/bulk-operations';
export { BusinessIntelligenceService } from './services/business-intelligence';
export { CaseAccessControlService } from './services/case-access-control';
export { CaseAssistantService } from './services/case-assistant';
export { CaseCockpitService } from './services/cockpit';
export { COLLECTIVE_CATEGORY_LABELS,CollectiveIntelligenceService } from './services/collective-intelligence';
export { CaseContextPackService } from './services/context-pack';
export type {
  CopilotMemory,
  CopilotMemoryScope,
  CopilotMemoryCategory,
  CopilotMemoryStatus,
  CopilotMemorySource,
  CrossCheckReport,
  CrossCheckFinding,
  CrossCheckTrigger,
  CrossCheckStatus,
  ReasoningChain,
  ReasoningStep,
  ReasoningStepType,
  AnswerConfidence,
  ConfidenceFactor,
  ConfidenceLevel,
  MessageFeedback,
  FeedbackRating,
  FeedbackCategory,
  ChatMessageIntelligenceFields,
} from './types';
export {
  CopilotMemoryService,
  MEMORY_SCOPE_LABELS,
  MEMORY_CATEGORY_LABELS,
} from './services/copilot-memory';
export type {
  ContradictionCategory,
  ContradictionMatrix,
  ContradictionPair,
} from './services/contradiction-detector';
export { ContradictionDetectorService } from './services/contradiction-detector';
export type {
  CrudEntityType,
  CrudIntent,
  NlpCrudActionResult,
  NlpCrudContext,
  ParsedNlpIntent,
} from './services/copilot-nlp-crud';
export { CopilotNlpCrudService } from './services/copilot-nlp-crud';
export type {
  AnwaltsgebuerenResult,
  Gerichtsinstanz,
  GerichtskostenResult,
  KostenInput,
  KostenrisikoResult,
  Verfahrensart,
  VergleichswertResult,
} from './services/cost-calculator';
export { CostCalculatorService } from './services/cost-calculator';
export type {
  CreditBalance,
  CreditCheckResult,
  CreditConsumeResult,
  CreditType,
  PageQuotaWarning,
  PlanPageQuota,
  SubscriptionPlan,
} from './services/credit-gateway';
export { CREDIT_COSTS,CreditGatewayService } from './services/credit-gateway';
export { CustomerHealthService } from './services/customer-health';
export { DeadlineAlertService } from './services/deadline-alert';
export { DeadlineAutomationService } from './services/deadline-automation';
export { TerminAutomationService } from './services/termin-automation';
export type {
  DocumentGeneratorInput,
  DocumentTemplate,
  GeneratedDocument,
} from './services/document-generator';
export { DocumentGeneratorService } from './services/document-generator';
export type {
  CaseNormAnalysis,
  DocumentNormAnalysis,
  ExtractedNormReference,
  MissingNormHint,
  NormVerificationResult,
  NormVerificationStatus,
} from './services/document-norm-extractor';
export { DocumentNormExtractorService } from './services/document-norm-extractor';
export type {
  LegalUploadRejection,
  PreparedLegalUploadFile,
  StagedLegalFile,
} from './services/document-upload';
export {
  detectLegalDocumentKind,
  estimateUploadedPageCount,
  isSupportedLegalUploadFile,
  LEGAL_UPLOAD_ACCEPT_ATTR,
  LEGAL_UPLOAD_ACCEPTED_EXTENSIONS,
  LEGAL_UPLOAD_MAX_FILE_SIZE_BYTES,
  LEGAL_UPLOAD_MAX_TOTAL_SIZE_BYTES,
  prepareLegalUploadFiles,
  readLegalUploadFile,
  readStagedFileBatch,
  readStagedFilesStreaming,
  stageLegalUploadFiles,
} from './services/document-upload';

export type {
  AuthorityReferenceIssue,
  AuthorityReferenceIssueCode,
  NormalizedAuthorityReferences,
} from './services/stammdaten-normalization';
export {
  normalizeAuthorityReferences,
  normalizeDisplayText,
} from './services/stammdaten-normalization';
export type {
  DMSFolderCategory,
  DocumentVersion,
  DocumentVersionGroup,
  DocumentVersionStatus,
} from './services/document-versioning';
export {
  DMS_FOLDER_LABELS,
  DOCUMENT_VERSION_STATUS_LABELS,
  DocumentVersioningService,
} from './services/document-versioning';
export type {
  DSGVORequest,
  DSGVORequestStatus,
  DSGVORequestType,
  RetentionCategory,
  RetentionPolicy,
  RetentionRecord,
} from './services/dsgvo-compliance';
export {
  DSGVO_REQUEST_TYPE_LABELS,
  DSGVO_STATUS_LABELS,
  DSGVOComplianceService,
  RETENTION_CATEGORY_LABELS,
} from './services/dsgvo-compliance';
export type { EmailTemplateContext,SendEmailInput, SendEmailResult } from './services/email';
export { EmailService } from './services/email';
export { ErrorMonitoringService } from './services/error-monitoring';
export type {
  BeweisLuecke,
  Beweismittel,
  BeweismittelArt,
  BeweisRegisterSummary,
  BeweisThema,
} from './services/evidence-register';
export { EvidenceRegisterService } from './services/evidence-register';
export type {
  ExternalApiAuthType,
  ExternalApiConfig,
  ExternalApiConnectionStatus,
  ExternalApiProvider,
  ExternalApiProviderMeta,
  ExternalApiSyncDirection,
  ExternalApiSyncLog,
} from './services/external-api-connectors';
export {
  EXTERNAL_API_PROVIDER_LABELS,
  EXTERNAL_API_PROVIDERS,
  ExternalApiConnectorService,
} from './services/external-api-connectors';
export type {
  FristenKontrolleRecord,
  FristenKontrolleStatus,
} from './services/fristenkontrolle';
export {
  FRISTENKONTROLLE_STATUS_LABELS,
  FristenkontrolleService,
} from './services/fristenkontrolle';
export { GEGNER_STRATEGY_LABELS, GegnerIntelligenceService, RICHTER_TENDENCY_LABELS } from './services/gegner-intelligence';
export { GeoSessionAnalyticsService } from './services/geo-session-analytics';
export { GerichtsterminService, TERMIN_STATUS_LABELS,TERMINART_LABELS } from './services/gerichtstermin';
export type {
  GwGBeneficialOwner,
  GwGCheckRecord,
  GwGCheckType,
  GwGIdentification,
  GwGIdentificationMethod,
  GwGOnboardingRecord,
  GwGOnboardingStatus,
  GwGRiskLevel,
} from './services/gwg-compliance';
export {
  GWG_IDENT_METHOD_LABELS,
  GWG_RISK_LABELS,
  GWG_STATUS_LABELS,
  GwGComplianceService,
} from './services/gwg-compliance';
export { HudocCrawlerService } from './services/hudoc-crawler';
export { CaseIngestionService } from './services/ingestion';
export { JudikaturIngestionService } from './services/judikatur-ingestion';
export { JudikaturResearchService } from './services/judikatur-research';
export {
  COURT_LEVEL_LABELS,
  JURISDICTION_CONFIGS,
  JurisdictionService,
  LOCALE_TO_JURISDICTION,
} from './services/jurisdiction';
export { KalenderService } from './services/kalender';
export { ANWALT_ROLE_LABEL, KanzleiProfileService } from './services/kanzlei-profile';
export type { KanzleiRuleViolation, KanzleiValidationResult } from './services/kanzlei-rule-validation';
export { KanzleiRuleValidationService } from './services/kanzlei-rule-validation';
export { KollisionsPruefungService } from './services/kollisions-pruefung';
export { LegalAnalysisProviderService } from './services/legal-analysis-provider';
export { LEGAL_CHAT_MODE_LABELS,LegalChatService } from './services/legal-chat';
export type {
  OnboardingDetectionResult,
  OnboardingFinalizeInput,
  OnboardingFinalizeResult,
} from './services/legal-copilot-workflow';
export { LegalCopilotWorkflowService } from './services/legal-copilot-workflow';
export { LegalNormRegistryService } from './services/legal-norm-registry';
export type {
  AnspruchsgrundlageChain,
  LegalDomain,
  LegalNorm,
  NormMatchResult,
  TatbestandsMerkmal,
  VerjährungsResult,
} from './services/legal-norms';
export { LegalNormsService } from './services/legal-norms';
export type { LegalPdfExportInput } from './services/legal-pdf-export';
export { LegalPdfExportService } from './services/legal-pdf-export';
export { MandantenPortalService } from './services/mandanten-portal';
export { NormClassificationEngine } from './services/norm-classification-engine';
export { PerformanceMonitorService } from './services/performance-monitor';
export type { ConnectorHealthResult } from './services/platform-adapters';
export { CasePlatformAdapterService } from './services/platform-adapters';
export { CasePlatformOrchestrationService } from './services/platform-orchestration';
export type { ProviderConfig, ProviderKey } from './services/provider-settings';
export { CaseProviderSettingsService } from './services/provider-settings';
export type { ResidencyCapability } from './services/residency-policy';
export { CaseResidencyPolicyService } from './services/residency-policy';
export { AUSLAGE_KATEGORIE_LABELS,RECHNUNG_STATUS_LABELS, RechnungService } from './services/rechnung';
export type {
  DraftGenerationInput,
  EmailDraft,
  EmailDraftPurpose,
  EmailDraftStatus,
  EmailDraftTone,
} from './services/ai-email-drafting';
export {
  AIEmailDraftingService,
  EMAIL_DRAFT_PURPOSE_LABELS,
  EMAIL_DRAFT_TONE_LABELS,
} from './services/ai-email-drafting';
export type {
  BeAAttachment,
  BeAConnection,
  BeAConnectionStatus,
  BeADocumentFormat,
  BeAMessage,
  BeAMessageDirection,
  BeAMessageStatus,
  BeAProvider,
  XJustizNachrichtentyp,
} from './services/bea-connector';
export {
  BEA_PROVIDER_LABELS,
  BEA_STATUS_LABELS,
  BeAConnectorService,
  XJUSTIZ_LABELS,
} from './services/bea-connector';
export type {
  CalendarConnection,
  CalendarConflictResolution,
  CalendarProvider,
  CalendarSyncDirection,
  CalendarSyncResult,
  CalendarSyncStatus,
} from './services/calendar-sync';
export {
  CALENDAR_PROVIDER_LABELS,
  CALENDAR_SYNC_STATUS_LABELS,
  CalendarSyncService,
} from './services/calendar-sync';
export type {
  ExportConfig,
  ExportFormat,
  ExportProvider,
  ExportRun,
  ExportScope,
  ExportStatus,
} from './services/datev-export';
export {
  BMD_KONTEN,
  DATEV_KONTEN,
  DATEVExportService,
  EXPORT_FORMAT_LABELS,
} from './services/datev-export';
export type {
  ActiveTimerSnapshot,
  TimerSegment,
  TimerSession,
  TimerStatus,
} from './services/live-timer';
export { LiveTimerService } from './services/live-timer';
export type {
  NotificationChannel,
  NotificationDigest,
  NotificationDigestFrequency,
  NotificationEventType,
  NotificationPreference,
  NotificationPriority,
  NotificationRecord,
  NotificationStatus,
  NotificationTriggerRule,
} from './services/mandanten-notification';
export {
  MandantenNotificationService,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_STATUS_LABELS,
} from './services/mandanten-notification';
export { RisCrawlerService } from './services/ris-crawler';
export { TimeTrackingService } from './services/time-tracking';
export type {
  TreuhandKonto,
  TreuhandMatterBalance,
  TreuhandReconciliation,
  TreuhandTransaction,
  TreuhandTransactionStatus,
  TreuhandTransactionType,
} from './services/treuhandkonto';
export {
  TREUHAND_STATUS_LABELS,
  TREUHAND_TRANSACTION_TYPE_LABELS,
  TreuhandkontoService,
} from './services/treuhandkonto';
export { INSTANZ_LABELS,VERFAHRENSPHASE_LABELS, VerfahrensstandService } from './services/verfahrensstand';
export { VollmachtService } from './services/vollmacht';
export { WiedervorlageService } from './services/wiedervorlage';
export type {
  AktenFinanzSummary,
  Aktennotiz,
  AktennotizKind,
  AnalyticsDashboardSnapshot,
  AnalyticsDateRange,
  AnalyticsEvent,
  AnalyticsEventCategory,
  AnalyticsEventSeverity,
  AnalyticsPeriod,
  AnalyticsSession,
  AnwaltProfile,
  AnwaltRole,
  ATAnwaltsgebuerenResult,
  ATGerichtsinstanz,
  ATGerichtskostenResult,
  ATKostenInput,
  ATKostenrisikoResult,
  ATVerfahrensart,
  AuditChainAnchor,
  AuditRiskLevel,
  AuditSeverity,
  AuslageRecord,
  BeweislastCheckResult,
  BrowserFamily,
  BulkOperation,
  BulkOperationResult,
  BulkOperationStatus,
  BulkOperationType,
  CaseActor,
  CaseActorRole,
  CaseAssistantAction,
  CaseAssistantRole,
  CaseAuditResult,
  CaseBlueprint,
  CaseDeadline,
  CaseFile,
  CaseGraphRecord,
  CaseIngestionResult,
  CaseIssue,
  CaseIssueCategory,
  CaseMemoryEvent,
  CasePriority,
  ChecklistItemStatus,
  ChunkExtractedEntities,
  CitationChain,
  CitationEntry,
  ClientKind,
  ClientRecord,
  CollectiveContextInjection,
  CollectiveContributionStatus,
  CollectiveKnowledgeCategory,
  CollectiveKnowledgeEntry,
  CollectiveMasterDashboard,
  CollectivePoolStats,
  CollectiveSharingConfig,
  CollectiveSharingLevel,
  ComplianceAuditEntry,
  ConnectionInfo,
  ConnectorAuthType,
  ConnectorConfig,
  ConnectorKind,
  ConnectorStatus,
  ConversationContextPack,
  CopilotRun,
  CopilotRunStatus,
  CopilotTask,
  CopilotTaskStatus,
  CourtDecision,
  CourtLevel,
  CustomerHealthAlert,
  CustomerHealthScore,
  CustomerHealthStatus,
  DailyActiveMetrics,
  DeadlineAlert,
  DeadlineStatus,
  DocumentPreflightReport,
  DocumentPreflightRiskLevel,
  DocumentPreflightRouteDecision,
  DeviceInfo,
  DeviceType,
  DocumentProcessingStatus,
  DocumentQualityReport,
  EmailRecord,
  EmailStatus,
  EmailTemplateType,
  ErrorCategory,
  ErrorGroup,
  ErrorLogEntry,
  ErrorSeverity,
  FeatureUsageRecord,
  GegnerArgumentPattern,
  GegnerIntelligenceSnapshot,
  GegnerKanzleiProfile,
  GegnerProfileSource,
  GegnerStrategyPattern,
  GegnerStrategyType,
  GeoDistribution,
  GeoLocation,
  Gerichtstermin,
  IngestionJob,
  IngestionJobStatus,
  InstanzHistorie,
  InstanzLevel,
  IntakeChecklistItem,
  IntakeSourceType,
  JudikaturSuggestion,
  Jurisdiction,
  JurisdictionConfig,
  KalenderEvent,
  KalenderExportResult,
  KanzleiProfile,
  KollisionsAuditLog,
  KollisionsCheckResult,
  KollisionsMatchLevel,
  KollisionsRolle,
  KollisionsTreffer,
  LegalArea,
  LegalChatContextSnapshot,
  LegalChatFindingRef,
  LegalChatMessage,
  LegalChatMessageRole,
  LegalChatMessageStatus,
  LegalChatMode,
  LegalChatNormCitation,
  LegalChatSession,
  LegalChatSourceCitation,
  ChatArtifact,
  ChatArtifactKind,
  ChatToolCall,
  ChatToolCallCategory,
  ChatToolCallDetailLine,
  ChatToolCallName,
  ChatToolCallStatus,
  LlmModelOption,
  LlmProviderId,
  LegalDocumentKind,
  LegalDocumentRecord,
  LegalDocumentStatus,
  LegalFinding,
  LegalFindingType,
  LegalNormRegistryRecord,
  MatterRecord,
  MatterStatus,
  NormReference,
  OcrJob,
  OcrJobStatus,
  OpposingParty,
  OpposingPartyKind,
  OSFamily,
  PerformanceMetric,
  PerformanceMetricName,
  PerformanceRating,
  PerformanceSummary,
  QualificationChainResult,
  QualityProblem,
  QualityProblemType,
  FiscalSignatureRecord,
  FiscalEventType,
  ExportJournalRecord,
  KassenbelegRecord,
  RechnungRecord,
  RechnungsPaymentMethod,
  RechnungsZahlungRecord,
  ReclassificationDirection,
  ReclassificationSuggestion,
  RetentionCohort,
  RichterProfile,
  RichterTendency,
  RichterTendencyArea,
  SemanticChunk,
  SemanticChunkCategory,
  WorkspaceResidencyMode,
  WorkspaceResidencyPolicy,
  SharedCourtDecision,
  SharedJudikaturStatus,
  SourceDocument,
  TatbestandsCheckResult,
  TatbestandsMerkmalCheck,
  TimeEntry,
  // ── Anwalts-Workflow Gap Types ─────────────────────────────────────────────
  Verfahrensphase,
  VerfahrensstandRecord,
  Vollmacht,
  Wiedervorlage,
  WiedervorlageStatus,
  WorkflowEvent,
  WorkflowEventType,
} from './types';

export function configureCaseAssistantModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .store(CaseAssistantStore, [WorkspaceService, GlobalState, CacheStorage])
    .store(CaseConnectorSecretStore, [GlobalState, WorkspaceService])
    .service(CaseAccessControlService, [CaseAssistantStore])
    .service(CaseProviderSettingsService, [
      GlobalState,
      WorkspaceService,
      CaseConnectorSecretStore,
    ])
    .service(CaseResidencyPolicyService, [CaseAssistantStore, WorkspaceService])
    .service(ContradictionDetectorService)
    .service(LegalAnalysisProviderService, [CaseProviderSettingsService])
    .service(CasePlatformOrchestrationService, [
      CaseAssistantStore,
      CaseAccessControlService,
      CaseResidencyPolicyService,
    ])
    .service(KalenderService, [CasePlatformOrchestrationService])
    .service(CaseAssistantService, [CaseAssistantStore, KalenderService])
    .service(DeadlineAlertService, [CaseAssistantStore, KalenderService])
    .service(CaseAlertCenterService, [DeadlineAlertService])
    .service(CaseIngestionService, [CaseAssistantService])
    .service(DeadlineAutomationService, [CaseAssistantService])
    .service(TerminAutomationService, [CasePlatformOrchestrationService])
    .service(JudikaturResearchService, [
      CasePlatformOrchestrationService,
      CaseProviderSettingsService,
      RisCrawlerService,
    ])
    .service(LegalPdfExportService)
    .service(DocumentProcessingService)
    .service(NormClassificationEngine, [LegalNormsService])
    .service(LegalCopilotWorkflowService, [
      CasePlatformOrchestrationService,
      WorkspaceService,
      CaseIngestionService,
      LegalAnalysisProviderService,
      DeadlineAutomationService,
      TerminAutomationService,
      JudikaturResearchService,
      ContradictionDetectorService,
      DocumentNormExtractorService,
      CaseProviderSettingsService,
      CaseResidencyPolicyService,
      DocumentProcessingService,
      JurisdictionService,
      NormClassificationEngine,
      KollisionsPruefungService,
      CreditGatewayService,
    ])
    .service(CaseContextPackService, [CaseAssistantService])
    .service(CaseCockpitService, [CaseContextPackService, DeadlineAlertService])
    .service(CasePlatformAdapterService, [
      CasePlatformOrchestrationService,
      CaseConnectorSecretStore,
    ])
    .service(CaseAuditExportService, [CasePlatformOrchestrationService])
    .service(AnwaltsTagesjournalService, [
      CaseAssistantStore,
      KalenderService,
    ])
    .service(AnwaltsReminderService, [
      CaseAssistantStore,
      CasePlatformOrchestrationService,
      KalenderService,
      KanzleiProfileService,
      EmailService,
      CasePlatformAdapterService,
    ])
    .service(CaseAssistantBootstrapService, [
      DeadlineAlertService,
      MandantenNotificationService,
      AnwaltsReminderService,
      CalendarSyncService,
    ])
    .service(KanzleiProfileService, [CaseAssistantStore, CaseAccessControlService])
    .service(KanzleiRuleValidationService)
    .service(LegalNormsService)
    .service(LegalNormRegistryService, [CaseAssistantStore, LegalNormsService])
    // ── Jurisdiction Service ──────────────────────────────────────────────
    .service(JurisdictionService)
    .service(DocumentNormExtractorService, [LegalNormsService])
    .service(AustriaCostCalculatorService)
    .service(CostCalculatorService)
    .service(DocumentGeneratorService)
    .service(EvidenceRegisterService)
    .service(BghCrawlerService)
    .service(RisCrawlerService)
    .service(HudocCrawlerService)
    .service(JudikaturIngestionService, [
      CasePlatformOrchestrationService,
      RisCrawlerService,
      BghCrawlerService,
      HudocCrawlerService,
    ])
    .service(EmailService, [
      CasePlatformOrchestrationService,
      CaseAccessControlService,
    ])
    .service(BulkOperationsService, [
      CasePlatformOrchestrationService,
      CaseAccessControlService,
      DocumentGeneratorService,
      EmailService,
    ])
    // ── Collective Legal Intelligence ─────────────────────────────────────────
    .service(CollectiveIntelligenceService, [
      CaseAssistantStore,
      CasePlatformOrchestrationService,
      LegalNormsService,
    ])
    // ── Gegner Intelligence ─────────────────────────────────────────────────
    .service(GegnerIntelligenceService, [
      CaseAssistantStore,
      CasePlatformOrchestrationService,
    ])
    // ── Copilot Intelligence Layer ───────────────────────────────────────────────
    .service(CopilotMemoryService, [
      CaseAssistantStore,
      CasePlatformOrchestrationService,
      ContradictionDetectorService,
    ])
    // ── Legal AI Premium Chat ────────────────────────────────────────────────────────
    .service(LegalChatService, [
      CaseAssistantStore,
      CasePlatformOrchestrationService,
      CaseProviderSettingsService,
      EvidenceRegisterService,
      LegalNormsService,
      CollectiveIntelligenceService,
      GegnerIntelligenceService,
      CreditGatewayService,
      WorkspaceSubscriptionService,
      CopilotMemoryService,
    ])
    // ── Analytics & Monitoring ─────────────────────────────────────────────
    .service(AnalyticsCollectorService, [CaseAssistantStore])
    .service(ErrorMonitoringService, [CaseAssistantStore, AnalyticsCollectorService])
    .service(GeoSessionAnalyticsService, [CaseAssistantStore, AnalyticsCollectorService])
    .service(PerformanceMonitorService, [CaseAssistantStore, AnalyticsCollectorService])
    .service(BusinessIntelligenceService, [
      CaseAssistantStore,
      AnalyticsCollectorService,
      ErrorMonitoringService,
      GeoSessionAnalyticsService,
    ])
    // ── Anwalts-Workflow Services ───────────────────────────────────────
    .service(VerfahrensstandService, [CasePlatformOrchestrationService])
    .service(KollisionsPruefungService, [CasePlatformOrchestrationService])
    .service(WiedervorlageService, [CasePlatformOrchestrationService, KalenderService])
    .service(AktennotizService, [CasePlatformOrchestrationService])
    .service(VollmachtService, [CasePlatformOrchestrationService])
    .service(TimeTrackingService, [CasePlatformOrchestrationService])
    // ── Gerichtstermine & Kalender ─────────────────────────────────────
    .service(GerichtsterminService, [CasePlatformOrchestrationService, KalenderService])
    // ── Finanzen (Rechnungen + Auslagen) ─────────────────────────────────
    .service(RechnungService, [
      CasePlatformOrchestrationService,
      TimeTrackingService,
      MandantenNotificationService,
    ])
    // ── Fristenkontrolle (4-Augen-Prinzip) ───────────────────────────────
    .service(FristenkontrolleService, [CasePlatformOrchestrationService])
    // ── GwG/KYC Compliance ───────────────────────────────────────────────
    .service(GwGComplianceService, [CasePlatformOrchestrationService])
    .service(MandantenPortalService, [
      CasePlatformOrchestrationService,
      VollmachtService,
      GwGComplianceService,
      EmailService,
      LegalCopilotWorkflowService,
      CaseProviderSettingsService,
    ])
    // ── External API Connectors ──────────────────────────────────────────
    .service(ExternalApiConnectorService, [
      CasePlatformOrchestrationService,
      CaseResidencyPolicyService,
    ])
    // ── Document Versioning ───────────────────────────────────────────
    .service(DocumentVersioningService, [CasePlatformOrchestrationService])
    // ── DSGVO/GDPR Compliance ─────────────────────────────────────────
    .service(DSGVOComplianceService, [CasePlatformOrchestrationService])
    // ── Credit Gateway (balance check & consume) ─────────────────
    .service(CreditGatewayService)
    // ── Copilot NLP CRUD (natural language database actions) ──────────
    .service(CopilotNlpCrudService, [
      CaseAssistantService,
      CasePlatformOrchestrationService,
      CaseProviderSettingsService,
      RechnungService,
      TimeTrackingService,
    ])
    .service(CustomerHealthService, [
      CaseAssistantStore,
      AnalyticsCollectorService,
      ErrorMonitoringService,
      GeoSessionAnalyticsService,
      PerformanceMonitorService,
      BusinessIntelligenceService,
    ])
    // ── Gap-Analyse Services (Kanzleisoftware-Vollständigkeit) ──────────
    .service(MandantenNotificationService, [
      CasePlatformOrchestrationService,
      EmailService,
      CasePlatformAdapterService,
    ])
    .service(LiveTimerService, [
      CasePlatformOrchestrationService,
      TimeTrackingService,
    ])
    .service(TreuhandkontoService, [CasePlatformOrchestrationService])
    .service(CalendarSyncService, [
      CasePlatformOrchestrationService,
      KalenderService,
    ])
    .service(BeAConnectorService, [CasePlatformOrchestrationService])
    .service(DATEVExportService, [
      CasePlatformOrchestrationService,
      RechnungService,
      TimeTrackingService,
      CaseAssistantService,
      KanzleiProfileService,
    ])
    .service(AIEmailDraftingService, [
      CasePlatformOrchestrationService,
      EmailService,
      CaseProviderSettingsService,
    ]);
}
