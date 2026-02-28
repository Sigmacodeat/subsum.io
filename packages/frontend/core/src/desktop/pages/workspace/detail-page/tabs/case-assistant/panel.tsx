import { Button } from '@affine/component';
import type { AffineEditorContainer } from '@affine/core/blocksuite/block-suite-editor';
import { insertFromMarkdown } from '@affine/core/blocksuite/utils';
import type {
  AnwaltProfile,
  BulkOperation,
  CaseActor,
  CaseAssistantRole,
  CaseAuditResult,
  CaseBlueprint,
  CaseDeadline,
  CaseGraphRecord,
  CaseIssue,
  CaseNormAnalysis,
  ClientKind,
  ClientRecord,
  ConnectorConfig,
  ContradictionMatrix,
  CopilotRun,
  CopilotTask,
  CourtDecision,
  DeadlineAlert,
  DocumentQualityReport,
  DocumentTemplate,
  EmailTemplateType,
  GeneratedDocument,
  Gerichtsinstanz,
  IngestionJob,
  Jurisdiction,
  KanzleiProfile,
  KostenrisikoResult,
  LegalDocumentRecord,
  LegalFinding,
  MatterRecord,
  NormMatchResult,
  OcrJob,
  Verfahrensart,
  VergleichswertResult,
  Vollmacht,
  WorkspaceResidencyPolicy,
} from '@affine/core/modules/case-assistant';
import {
  AnalyticsCollectorService,
  BulkOperationsService,
  BusinessIntelligenceService,
  CaseAlertCenterService,
  CaseAssistantService,
  CaseAuditExportService,
  CaseCockpitService,
  CaseIngestionService,
  CasePlatformAdapterService,
  CasePlatformOrchestrationService,
  CaseProviderSettingsService,
  ContradictionDetectorService,
  CostCalculatorService,
  CustomerHealthService,
  DeadlineAlertService,
  DocumentGeneratorService,
  DocumentNormExtractorService,
  EmailService,
  ErrorMonitoringService,
  EvidenceRegisterService,
  GeoSessionAnalyticsService,
  GwGComplianceService,
  JudikaturIngestionService,
  JudikaturResearchService,
  JurisdictionService,
  KanzleiProfileService,
  KollisionsPruefungService,
  LegalCopilotWorkflowService,
  LegalNormsService,
  MandantenPortalService,
  NormClassificationEngine,
  PerformanceMonitorService,
  VollmachtService,
} from '@affine/core/modules/case-assistant';
import type { ComplianceAuditEntry } from '@affine/core/modules/case-assistant/types';
import {
  type Member,
  WorkspaceMembersService,
} from '@affine/core/modules/permissions';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import type { Store } from '@blocksuite/affine/store';
import { useLiveData, useService } from '@toeverything/infra';
import { useTheme } from 'next-themes';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as styles from '../case-assistant.css';
import { useCaseActionGuards } from './hooks/use-access-actions';
import { usePanelClientMatterActions } from './hooks/use-panel-client-matter-actions';
import { usePanelCopilotJudikaturActions } from './hooks/use-panel-copilot-judikatur-actions';
import { usePanelPlatformActions } from './hooks/use-panel-platform-actions';
import { usePanelWorkflowActions } from './hooks/use-panel-workflow-actions';
import type {
  AuditVerificationSnapshot,
  ConnectorDraft,
  DraftReviewStatus,
  DraftSection,
  DraftSectionStatus,
  IngestionMode,
  IntakeDraft,
  PendingDestructiveAction,
  SidebarSectionId,
  SupportAlert,
  SupportAuditEntry,
  SupportEscalationPolicy,
  SupportIncident,
  SupportIncidentSeverity,
  SupportRetentionPolicy,
  SupportStatusSnapshot,
} from './panel-types';
import { jobStatusLabel, roleRank } from './panel-types';
import { AktenauditSection } from './sections/aktenaudit-section';
import { AnalyticsDashboardSection } from './sections/analytics-dashboard-section';
import { AnwaltsWorkflowSection } from './sections/anwalts-workflow-section';
import { BeaPostfachSection } from './sections/bea-postfach-section';
import { BlueprintReviewSection } from './sections/blueprint-review-section';
import { BulkOperationsSection } from './sections/bulk-operations-section';
import { CaseFactSheetSection } from './sections/case-fact-sheet-section';
import { CaseInsightsSection } from './sections/case-insights-section';
import { CaseOnboardingWizard } from './sections/case-onboarding-wizard';
import { ClientMatterSection } from './sections/client-matter-section';
import { CockpitSection } from './sections/cockpit-section';
import { ContradictionSection } from './sections/contradiction-section';
import { CostCalculatorSection } from './sections/cost-calculator-section';
import { DestructiveActionDialog } from './sections/destructive-action-dialog';
import { DocumentGeneratorSection } from './sections/document-generator-section';
import { DocumentVersioningSection } from './sections/document-versioning-section';
import { DSGVOComplianceSection } from './sections/dsgvo-compliance-section';
import { EinstellungenSection } from './sections/einstellungen-section';
import { EmailInboxSection } from './sections/email-inbox-section';
import { EvidenceSection } from './sections/evidence-section';
import type { UploadTelemetryAlert } from './sections/file-upload-zone';
import { FristenkontrolleSection } from './sections/fristenkontrolle-section';
import { GwGComplianceSection } from './sections/gwg-compliance-section';
import { IntakeChecklistSection } from './sections/intake-checklist-section';
import { JudikaturSection } from './sections/judikatur-section';
import { KanzleiProfileSection } from './sections/kanzlei-profile-section';
import { KollisionsPruefungSection } from './sections/kollisions-pruefung-section';
import { LegalWorkflowSection } from './sections/legal-workflow-section';
import { MandantenSection } from './sections/mandanten-section';
import { NormSearchSection } from './sections/norm-search-section';
import { OpposingPartySection } from './sections/opposing-party-section';
import { ProviderSettingsSection } from './sections/provider-settings-section';
import { QueueSection } from './sections/queue-section';
import { RechnungSection } from './sections/rechnung-section';
import { RightRailSection } from './sections/right-rail-section';
import { SidebarLinksSection } from './sections/sidebar-links-section';
import { TaskBoardSection } from './sections/task-board-section';
import { VerfahrensstandSection } from './sections/verfahrensstand-section';
import {
  buildIdMap,
  selectCaseClient,
  selectCaseDocuments,
  selectCaseFindings,
  selectCaseMatter,
  selectCaseOcrJobs,
  selectCaseTasks,
  selectCitationBackedFindingCount,
  selectLatestBlueprint,
  selectLatestCopilotRun,
  selectOcrFailedCount,
  selectOcrRunningCount,
  selectRecommendedMobileAction,
  selectRecommendedMobileActionText,
  selectVisibleClients,
  selectVisibleMatters,
  selectWorkspaceClients,
  selectWorkspaceMatters,
} from './selectors';
import {
  buildDraftIntegrityHash,
  composeAcceptedDraft,
  extractDocPlainText,
  extractSelectionPlainText,
  formatSecretUpdatedAt,
  hashFingerprint,
  isCredentialRotationDue,
  isIsoDateInput,
  normalizeRotationMode,
  parseRotationDays,
} from './utils';

type AnwaltsWorkflowTabId =
  | 'wiedervorlage'
  | 'notizen'
  | 'vollmachten'
  | 'zeiten'
  | 'termine'
  | 'kalender'
  | 'finanzen'
  | 'konflikte';

export const EditorCaseAssistantPanel = ({
  caseId,
  workspaceId,
  title,
  sourceDoc,
  editorContainer,
  initialSidebarSection = 'cockpit',
  initialSelectedMatterId,
  initialSelectedClientId,
  initialOnboardingFlow,
  initialAnwaltsWorkflowTab,
  initialDeadlineId,
  variant = 'operations',
}: {
  caseId: string;
  workspaceId: string;
  title: string;
  sourceDoc: Store | null;
  editorContainer: AffineEditorContainer | null;
  initialSidebarSection?: SidebarSectionId;
  initialSelectedMatterId?: string;
  initialSelectedClientId?: string;
  initialOnboardingFlow?: 'manual' | 'documents-first';
  initialAnwaltsWorkflowTab?: AnwaltsWorkflowTabId;
  initialDeadlineId?: string;
  variant?: 'operations' | 'copilot';
}) => {
  type CopilotWorkspaceTab = 'workflow' | 'matter' | 'insights';

  const { theme, setTheme } = useTheme();
  const activeThemeMode: 'system' | 'light' | 'dark' =
    theme === 'light' || theme === 'dark' ? theme : 'system';
  const caseAssistantService = useService(CaseAssistantService);
  const caseCockpitService = useService(CaseCockpitService);
  const caseAlertCenterService = useService(CaseAlertCenterService);
  const caseIngestionService = useService(CaseIngestionService);
  const caseAuditExportService = useService(CaseAuditExportService);
  const legalCopilotWorkflowService = useService(LegalCopilotWorkflowService);
  const casePlatformAdapterService = useService(CasePlatformAdapterService);
  const casePlatformOrchestrationService = useService(
    CasePlatformOrchestrationService
  );
  const workbench = useService(WorkbenchService).workbench;
  const workspaceService = useService(WorkspaceService);
  const providerSettingsService = useService(CaseProviderSettingsService);
  const deadlineAlertService = useService(DeadlineAlertService);
  const legalNormsService = useService(LegalNormsService);
  const contradictionDetectorService = useService(ContradictionDetectorService);
  const costCalculatorService = useService(CostCalculatorService);
  const documentGeneratorService = useService(DocumentGeneratorService);
  const evidenceRegisterService = useService(EvidenceRegisterService);
  const judikaturIngestionService = useService(JudikaturIngestionService);
  const judikaturResearchService = useService(JudikaturResearchService);
  const vollmachtService = useService(VollmachtService);
  const gwgComplianceService = useService(GwGComplianceService);
  const mandantenPortalService = useService(MandantenPortalService);
  const jurisdictionService = useService(JurisdictionService);
  const kanzleiProfileService = useService(KanzleiProfileService);
  const documentNormExtractorService = useService(DocumentNormExtractorService);
  const normClassificationEngine = useService(NormClassificationEngine);
  const bulkOperationsService = useService(BulkOperationsService);
  // EmailService is used indirectly through BulkOperationsService
  useService(EmailService);
  const analyticsCollector = useService(AnalyticsCollectorService);
  const errorMonitoring = useService(ErrorMonitoringService);
  const geoSessionAnalytics = useService(GeoSessionAnalyticsService);
  const performanceMonitor = useService(PerformanceMonitorService);
  const businessIntelligence = useService(BusinessIntelligenceService);
  const customerHealthService = useService(CustomerHealthService);
  const workspaceMembersService = useService(WorkspaceMembersService);
  const kollisionsPruefungService = useService(KollisionsPruefungService);
  void kollisionsPruefungService;
  const graph = useLiveData(
    caseAssistantService.graph$
  ) as CaseGraphRecord | null;
  const activeJurisdiction: Jurisdiction =
    useLiveData(caseAssistantService.activeJurisdiction$) ?? 'AT';
  const alerts = useLiveData(caseAlertCenterService.alerts$);
  const workspaceMembers =
    useLiveData(workspaceMembersService.members.pageMembers$) ?? [];
  const connectors: ConnectorConfig[] =
    useLiveData(casePlatformOrchestrationService.connectors$) ?? [];
  const ingestionJobs: IngestionJob[] =
    useLiveData(casePlatformOrchestrationService.ingestionJobs$) ?? [];
  const currentRole: CaseAssistantRole =
    useLiveData(casePlatformOrchestrationService.role$) ?? 'owner';
  const residencyPolicyLive = useLiveData(
    casePlatformOrchestrationService.residencyPolicy$
  );
  const legalDocuments: LegalDocumentRecord[] =
    useLiveData(legalCopilotWorkflowService.legalDocuments$) ?? [];
  const legalFindings: LegalFinding[] =
    useLiveData(legalCopilotWorkflowService.findings$) ?? [];
  const copilotTasks: CopilotTask[] =
    useLiveData(legalCopilotWorkflowService.tasks$) ?? [];
  const caseBlueprints: CaseBlueprint[] =
    useLiveData(legalCopilotWorkflowService.blueprints$) ?? [];
  const copilotRuns: CopilotRun[] =
    useLiveData(legalCopilotWorkflowService.copilotRuns$) ?? [];
  const ocrJobs: OcrJob[] =
    useLiveData(legalCopilotWorkflowService.ocrJobs$) ?? [];
  const qualityReports: DocumentQualityReport[] =
    useLiveData(casePlatformOrchestrationService.qualityReports$) ?? [];
  const vollmachten: Vollmacht[] =
    useLiveData(vollmachtService.vollmachten$) ?? [];
  const vollmachtSigningRequests =
    useLiveData(casePlatformOrchestrationService.vollmachtSigningRequests$) ??
    [];
  const auditEntries: ComplianceAuditEntry[] =
    useLiveData(casePlatformOrchestrationService.auditEntries$) ?? [];
  const [ingestionMode, setIngestionMode] =
    useState<IngestionMode>('selection');
  const [onlyCriticalAlerts, setOnlyCriticalAlerts] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState<string | null>(null);
  const [isWorkflowBusy, setIsWorkflowBusy] = useState(false);
  const [connectorDrafts, setConnectorDrafts] = useState<
    Record<string, ConnectorDraft>
  >({});
  const [intakeDraft, setIntakeDraft] = useState<IntakeDraft>({
    title: '',
    kind: 'note',
    folderPath: '',
    internalFileNumber: '',
    paragraphReferences: '',
    tags: '',
    content: '',
  });
  const [folderQuery, setFolderQuery] = useState('');
  const [folderSearchCount, setFolderSearchCount] = useState<number | null>(
    null
  );
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSectionId>(initialSidebarSection);
  const [residencyPolicyDraft, setResidencyPolicyDraft] =
    useState<WorkspaceResidencyPolicy>({
      workspaceId,
      mode: 'cloud',
      allowCloudSync: true,
      allowRemoteOcr: true,
      allowExternalConnectors: true,
      allowTelemetry: true,
      requireMfaForAdmins: true,
      requireMfaForMembers: false,
      enforceEncryptionAtRest: true,
      sessionIdleTimeoutMinutes: 60,
      updatedAt: new Date(0).toISOString(),
    });
  const [activeCopilotRailTab, setActiveCopilotRailTab] = useState<
    'copilot' | 'alerts'
  >(initialSidebarSection === 'alerts' ? 'alerts' : 'copilot');
  const [activeCopilotWorkspaceTab, setActiveCopilotWorkspaceTab] =
    useState<CopilotWorkspaceTab>('workflow');
  const copilotWorkspaceTabs = useMemo<CopilotWorkspaceTab[]>(
    () => ['workflow', 'matter', 'insights'],
    []
  );
  const copilotWorkspaceStorageKey = useMemo(
    () => `case-assistant:copilot-workspace-tab:${workspaceId}:${caseId}`,
    [workspaceId, caseId]
  );
  const [isCopilotPanelOpen, setIsCopilotPanelOpen] = useState(true);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotResponse, setCopilotResponse] = useState<string | null>(null);
  const [copilotDraftPreview, setCopilotDraftPreview] = useState<string | null>(
    null
  );

  useEffect(() => {
    void kanzleiProfileService.syncFromBackend(workspaceId).catch(() => {
      // ignore
    });
  }, [kanzleiProfileService, workspaceId]);
  const [draftSections, setDraftSections] = useState<DraftSection[]>([]);
  const [draftReviewStatus, setDraftReviewStatus] =
    useState<DraftReviewStatus>('draft');
  const [draftReviewNote, setDraftReviewNote] = useState('');
  const [draftReviewRequestedByRole, setDraftReviewRequestedByRole] =
    useState<CaseAssistantRole | null>(null);
  const [draftApprovedByRole, setDraftApprovedByRole] =
    useState<CaseAssistantRole | null>(null);
  const [draftReviewRequestedHash, setDraftReviewRequestedHash] = useState<
    string | null
  >(null);
  const [draftApprovedHash, setDraftApprovedHash] = useState<string | null>(
    null
  );
  const [isCopilotRunning, setIsCopilotRunning] = useState(false);
  const [isApplyingCopilotDraft, setIsApplyingCopilotDraft] = useState(false);
  const [ocrEndpoint, setOcrEndpoint] = useState('');
  const [ocrToken, setOcrToken] = useState('');
  const [hasStoredOcrToken, setHasStoredOcrToken] = useState(false);
  const [taskAssignees, setTaskAssignees] = useState<Record<string, string>>(
    {}
  );
  const [blueprintObjectiveDraft, setBlueprintObjectiveDraft] = useState('');
  const [blueprintReviewStatus, setBlueprintReviewStatus] = useState<
    'draft' | 'in_review' | 'approved'
  >('draft');
  const [blueprintReviewNoteDraft, setBlueprintReviewNoteDraft] = useState('');
  const isCopilotVariant = variant === 'copilot';

  // ═══ New Legal Service States ═══
  const [normSearchQuery, setNormSearchQuery] = useState('');
  const [normSearchResults, setNormSearchResults] = useState<NormMatchResult[]>(
    []
  );
  const [contradictionMatrix, setContradictionMatrix] =
    useState<ContradictionMatrix | null>(null);
  const [costStreitwert, setCostStreitwert] = useState('10000');
  const [costInstanz, setCostInstanz] =
    useState<Gerichtsinstanz>('landgericht');
  const [costVerfahren, setCostVerfahren] =
    useState<Verfahrensart>('klageverfahren');
  const [costObsiegen, setCostObsiegen] = useState('50');

  const jurisdictionManualOverrideRef = useRef(false);

  const [costResult, setCostResult] = useState<KostenrisikoResult | null>(null);
  const [costVergleichQuote, setCostVergleichQuote] = useState('60');
  const [costVergleichResult, setCostVergleichResult] =
    useState<VergleichswertResult | null>(null);
  const [docGenTemplate, setDocGenTemplate] =
    useState<DocumentTemplate>('klageschrift');
  const [docGenPartyKlaeger, setDocGenPartyKlaeger] = useState('');
  const [docGenPartyBeklagter, setDocGenPartyBeklagter] = useState('');
  const [docGenGericht, setDocGenGericht] = useState('');
  const [docGenAktenzeichen, setDocGenAktenzeichen] = useState('');
  const [selectedDocGenMatterId, setSelectedDocGenMatterId] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(
    null
  );
  const [evidenceSummaryMarkdown, setEvidenceSummaryMarkdown] = useState<
    string | null
  >(null);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [judikaturQuery, setJudikaturQuery] = useState('');
  const [judikaturResults, setJudikaturResults] = useState<CourtDecision[]>([]);
  const [risImportFromDate, setRisImportFromDate] = useState('');
  const [risImportToDate, setRisImportToDate] = useState('');
  const [risImportMaxResults, setRisImportMaxResults] = useState('25');
  const [isRisImporting, setIsRisImporting] = useState(false);
  const [bghImportFromDate, setBghImportFromDate] = useState('');
  const [bghImportToDate, setBghImportToDate] = useState('');
  const [bghImportMaxResults, setBghImportMaxResults] = useState('25');
  const [isBghImporting, setIsBghImporting] = useState(false);
  const [hudocImportFromDate, setHudocImportFromDate] = useState('');
  const [hudocImportToDate, setHudocImportToDate] = useState('');
  const [hudocImportMaxResults, setHudocImportMaxResults] = useState('25');
  const [hudocRespondentState, setHudocRespondentState] = useState('Austria');
  const [isHudocImporting, setIsHudocImporting] = useState(false);
  const [legalAnalysisEndpoint, setLegalAnalysisEndpoint] = useState('');
  const [legalAnalysisToken, setLegalAnalysisToken] = useState('');
  const [hasStoredLegalAnalysisToken, setHasStoredLegalAnalysisToken] =
    useState(false);
  const [judikaturEndpoint, setJudikaturEndpoint] = useState('');
  const [judikaturToken, setJudikaturToken] = useState('');
  const [hasStoredJudikaturToken, setHasStoredJudikaturToken] = useState(false);

  const [lastAuditVerification, setLastAuditVerification] =
    useState<AuditVerificationSnapshot>(null);
  const [clientDraftName, setClientDraftName] = useState('');
  const [clientDraftKind, setClientDraftKind] = useState<ClientKind>('person');
  const [clientDraftEmail, setClientDraftEmail] = useState('');
  const [clientDraftPhone, setClientDraftPhone] = useState('');
  const [clientDraftAddress, setClientDraftAddress] = useState('');
  const [clientDraftTags, setClientDraftTags] = useState('');
  const [clientDraftNotes, setClientDraftNotes] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showArchivedClients, setShowArchivedClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [matterDraftTitle, setMatterDraftTitle] = useState('');
  const [matterDraftDescription, setMatterDraftDescription] = useState('');
  const [matterDraftExternalRef, setMatterDraftExternalRef] = useState('');
  const [matterDraftAuthorityReferences, setMatterDraftAuthorityReferences] =
    useState('');
  const [matterDraftGericht, setMatterDraftGericht] = useState('');
  const [matterDraftPolizei, setMatterDraftPolizei] = useState('');
  const [matterDraftStaatsanwaltschaft, setMatterDraftStaatsanwaltschaft] =
    useState('');
  const [matterDraftRichter, setMatterDraftRichter] = useState('');
  const [matterDraftGerichtsaktenzeichen, setMatterDraftGerichtsaktenzeichen] =
    useState('');
  const [
    matterDraftStaatsanwaltschaftAktenzeichen,
    setMatterDraftStaatsanwaltschaftAktenzeichen,
  ] = useState('');
  const [matterDraftPolizeiAktenzeichen, setMatterDraftPolizeiAktenzeichen] =
    useState('');
  const [matterDraftStatus, setMatterDraftStatus] =
    useState<MatterRecord['status']>('open');
  const [matterDraftJurisdiction, setMatterDraftJurisdiction] =
    useState<Jurisdiction>(activeJurisdiction);
  const [matterDraftTags, setMatterDraftTags] = useState('');
  const [matterDraftAssignedAnwaltId, setMatterDraftAssignedAnwaltId] =
    useState('');
  const [matterSearchQuery, setMatterSearchQuery] = useState('');
  const [showArchivedMatters, setShowArchivedMatters] = useState(false);
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] =
    useState<import('@affine/core/modules/case-assistant').AnalyticsPeriod>(
      '30d'
    );
  const [isAnalyticsRefreshing, setIsAnalyticsRefreshing] = useState(false);
  const [analyticsKpis, setAnalyticsKpis] = useState<any>(null);
  const [analyticsDailyMetrics, setAnalyticsDailyMetrics] = useState<any[]>([]);
  const [analyticsErrorGroups, setAnalyticsErrorGroups] = useState<any[]>([]);
  const [analyticsCoreWebVitals, setAnalyticsCoreWebVitals] =
    useState<any>(null);
  const [analyticsAvgLoadTime, setAnalyticsAvgLoadTime] = useState(0);
  const [analyticsGeoDistribution, setAnalyticsGeoDistribution] = useState<
    any[]
  >([]);
  const [analyticsDeviceBreakdown, setAnalyticsDeviceBreakdown] =
    useState<any>(null);
  const [analyticsBrowserBreakdown, setAnalyticsBrowserBreakdown] =
    useState<any>(null);
  const [analyticsTopReferrers, setAnalyticsTopReferrers] = useState<any[]>([]);
  const [analyticsSessionsByHour, setAnalyticsSessionsByHour] = useState<any[]>(
    []
  );
  const [analyticsFeatureUsage, setAnalyticsFeatureUsage] = useState<any[]>([]);
  const [analyticsCustomerHealth, setAnalyticsCustomerHealth] = useState<any[]>(
    []
  );
  const [analyticsHealthSummary, setAnalyticsHealthSummary] =
    useState<any>(null);
  const [analyticsRetentionCohorts, setAnalyticsRetentionCohorts] = useState<
    any[]
  >([]);
  const [supportStatusSnapshot, setSupportStatusSnapshot] =
    useState<SupportStatusSnapshot | null>(null);
  const [supportIncidents, setSupportIncidents] = useState<SupportIncident[]>(
    []
  );
  const [supportAlerts, setSupportAlerts] = useState<SupportAlert[]>([]);
  const [supportAuditTrail, setSupportAuditTrail] = useState<
    SupportAuditEntry[]
  >([]);
  const [supportRetentionPolicy, setSupportRetentionPolicy] =
    useState<SupportRetentionPolicy | null>(null);
  const [supportEscalationPolicy, setSupportEscalationPolicy] =
    useState<SupportEscalationPolicy | null>(null);
  const [supportOpsError, setSupportOpsError] = useState<string | null>(null);
  const [isSavingSupportRetention, setIsSavingSupportRetention] =
    useState(false);
  const [isSavingSupportEscalation, setIsSavingSupportEscalation] =
    useState(false);
  const supportRetentionSaveInFlightRef = useRef(false);
  const supportEscalationSaveInFlightRef = useRef(false);
  const [selectedMatterId, setSelectedMatterId] = useState('');
  const [undoClientSnapshot, setUndoClientSnapshot] =
    useState<ClientRecord | null>(null);
  const [undoMatterSnapshot, setUndoMatterSnapshot] =
    useState<MatterRecord | null>(null);
  const [pendingDestructiveAction, setPendingDestructiveAction] =
    useState<PendingDestructiveAction | null>(null);

  const hasAutoOpenedOnboardingRef = useRef(false);

  useEffect(() => {
    if (hasAutoOpenedOnboardingRef.current) {
      return;
    }
    if (variant !== 'operations') {
      return;
    }
    if (!initialOnboardingFlow) {
      return;
    }
    hasAutoOpenedOnboardingRef.current = true;
    setIsOnboardingWizardOpen(true);
  }, [initialOnboardingFlow, variant]);

  const caseRecord = graph?.cases[caseId];

  const clients = useMemo(
    () => selectWorkspaceClients(graph, workspaceId),
    [graph, workspaceId]
  );

  const matters = useMemo(
    () => selectWorkspaceMatters(graph, workspaceId),
    [graph, workspaceId]
  );

  const clientsById = useMemo(() => buildIdMap(clients), [clients]);

  const mattersById = useMemo(() => buildIdMap(matters), [matters]);

  const caseMatter = useMemo(
    () => selectCaseMatter(caseRecord, mattersById),
    [caseRecord, mattersById]
  );

  const caseClient = useMemo(
    () => selectCaseClient(caseMatter, clientsById),
    [caseMatter, clientsById]
  );

  const hasExternalPreselection =
    Boolean(initialSelectedMatterId) || Boolean(initialSelectedClientId);
  const externalPreselectionAppliedRef = useRef(false);

  const visibleClients = useMemo(
    () =>
      selectVisibleClients({
        clients,
        query: clientSearchQuery,
        showArchivedClients,
      }),
    [clientSearchQuery, clients, showArchivedClients]
  );

  const visibleMatters = useMemo(
    () =>
      selectVisibleMatters({
        matters,
        query: matterSearchQuery,
        showArchivedMatters,
        selectedClientId,
      }),
    [matterSearchQuery, matters, selectedClientId, showArchivedMatters]
  );

  const currentMatter = caseMatter;
  const currentClient = caseClient;
  const matterOptions = visibleMatters;

  const kanzleiProfile: KanzleiProfile | null = graph?.kanzleiProfile ?? null;
  const anwaelte: AnwaltProfile[] = useMemo(
    () => Object.values(graph?.anwaelte ?? {}),
    [graph?.anwaelte]
  );

  const linkedWorkspaceUsers = useMemo(() => {
    const acceptedMembers = workspaceMembers.filter(
      member => member.status === 'Accepted' && member.email !== null
    ) as Member[];
    const seen = new Set<string>();

    return acceptedMembers
      .filter(member => {
        if (!member.id || seen.has(member.id)) {
          return false;
        }
        seen.add(member.id);
        return true;
      })
      .map(member => ({
        id: member.id,
        email: member.email!, // Safe because we filtered out null emails
        name: member.name,
      }));
  }, [workspaceMembers]);

  const anwaelteByIdMap = useMemo(
    () => new Map(anwaelte.map(a => [a.id, a])),
    [anwaelte]
  );

  const activeAnwalt = useMemo(
    () => anwaelte.find(a => a.isActive) ?? null,
    [anwaelte]
  );

  const activeAnwaltDisplayName = useMemo(() => {
    return activeAnwalt
      ? `${activeAnwalt.title} ${activeAnwalt.firstName} ${activeAnwalt.lastName}`
      : null;
  }, [activeAnwalt]);

  const handleDecideVollmachtSigningRequest = useCallback(
    async (input: {
      signingRequestId: string;
      decision: 'approve' | 'reject';
      decisionNote?: string;
    }) => {
      if (!activeAnwalt) {
        setIngestionStatus('Keine aktive Anwalt-Identität gefunden.');
        return;
      }
      await mandantenPortalService.decideVollmachtSigningRequest({
        signingRequestId: input.signingRequestId,
        decision: input.decision,
        decisionNote: input.decisionNote,
        decidedBy: `anwalt:${activeAnwalt.id}`,
      });
      setIngestionStatus(
        input.decision === 'approve'
          ? 'Vollmacht wurde freigegeben.'
          : 'Vollmacht wurde abgelehnt.'
      );
    },
    [activeAnwalt, mandantenPortalService, setIngestionStatus]
  );

  const onSaveKanzleiProfile = useCallback(
    async (draft: {
      name: string;
      address: string;
      phone: string;
      fax: string;
      email: string;
      website: string;
      steuernummer: string;
      ustIdNr: string;
      iban: string;
      bic: string;
      bankName: string;
      datevBeraternummer: string;
      datevMandantennummer: string;
      bmdFirmennummer: string;
      rechtsanwaltskammer: string;
      aktenzeichenSchema: string;
      logoDataUrl?: string;
    }) => {
      const result = await kanzleiProfileService.saveKanzleiProfile({
        workspaceId,
        name: draft.name,
        address: draft.address || undefined,
        phone: draft.phone || undefined,
        fax: draft.fax || undefined,
        email: draft.email || undefined,
        website: draft.website || undefined,
        steuernummer: draft.steuernummer || undefined,
        ustIdNr: draft.ustIdNr || undefined,
        iban: draft.iban || undefined,
        bic: draft.bic || undefined,
        bankName: draft.bankName || undefined,
        datevBeraternummer: draft.datevBeraternummer || undefined,
        datevMandantennummer: draft.datevMandantennummer || undefined,
        bmdFirmennummer: draft.bmdFirmennummer || undefined,
        rechtsanwaltskammer: draft.rechtsanwaltskammer || undefined,
        aktenzeichenSchema: draft.aktenzeichenSchema || undefined,
        logoDataUrl: draft.logoDataUrl,
      });
      if (result) {
        setIngestionStatus('Kanzleiprofil gespeichert.');
      } else {
        setIngestionStatus(
          'Kanzleiprofil konnte nicht gespeichert werden (fehlende Berechtigung).'
        );
      }
    },
    [kanzleiProfileService, workspaceId]
  );

  const onSaveAnwalt = useCallback(
    async (draft: {
      id: string;
      workspaceUserId: string;
      workspaceUserEmail: string;
      title: string;
      firstName: string;
      lastName: string;
      fachgebiet: string;
      email: string;
      phone: string;
      zulassungsnummer: string;
      role: string;
    }) => {
      const kanzleiId = kanzleiProfile?.id ?? '';
      const result = await kanzleiProfileService.saveAnwalt({
        ...(draft.id ? { id: draft.id } : {}),
        workspaceId,
        kanzleiId,
        workspaceUserId: draft.workspaceUserId || undefined,
        workspaceUserEmail: draft.workspaceUserEmail || undefined,
        title: draft.title,
        firstName: draft.firstName,
        lastName: draft.lastName,
        fachgebiet: draft.fachgebiet || undefined,
        email: draft.email || undefined,
        phone: draft.phone || undefined,
        zulassungsnummer: draft.zulassungsnummer || undefined,
        role: draft.role as AnwaltProfile['role'],
        isActive: true,
      });
      if (result) {
        setIngestionStatus(
          `Anwalt ${result.firstName} ${result.lastName} gespeichert.`
        );
      } else {
        setIngestionStatus(
          'Anwalt konnte nicht gespeichert werden (fehlende Berechtigung).'
        );
      }
    },
    [kanzleiProfile?.id, kanzleiProfileService, workspaceId]
  );

  const onDeactivateAnwalt = useCallback(
    async (anwaltId: string) => {
      const ok = await kanzleiProfileService.deactivateAnwalt(anwaltId);
      setIngestionStatus(
        ok
          ? 'Anwalt deaktiviert.'
          : 'Anwalt konnte nicht deaktiviert werden (ggf. noch aktiven Akten zugewiesen oder fehlende Berechtigung).'
      );
    },
    [kanzleiProfileService]
  );

  const onGenerateNextAktenzeichen = useCallback(async () => {
    const clientName = caseClient?.displayName;
    const nextAz =
      await kanzleiProfileService.generateNextAktenzeichen(clientName);
    setMatterDraftExternalRef(nextAz);
    setIngestionStatus(`Nächstes Aktenzeichen generiert: ${nextAz}`);
  }, [kanzleiProfileService, caseClient?.displayName]);

  useEffect(() => {
    workspaceMembersService.members.setPageNum(0);
    workspaceMembersService.members.revalidate();
  }, [workspaceMembersService]);

  useEffect(() => {
    deadlineAlertService.start().catch((error: unknown) => {
      console.error('[case-assistant] failed to start alert service', error);
      setIngestionStatus(
        'Alert-Service konnte nicht gestartet werden. Bitte erneut versuchen.'
      );
    });

    return () => {
      deadlineAlertService.stop();
    };
  }, [deadlineAlertService]);

  // ═══ Analytics Initialization ═══
  useEffect(() => {
    analyticsCollector.initialize();
    errorMonitoring.startListening();
    performanceMonitor.startObserving();
    geoSessionAnalytics.resolveGeoLocation().catch((error: unknown) => {
      console.warn('[case-assistant] geo location resolution failed', error);
    });
    return () => {
      analyticsCollector.dispose();
      errorMonitoring.stopListening();
      performanceMonitor.stopObserving();
    };
  }, [
    analyticsCollector,
    errorMonitoring,
    performanceMonitor,
    geoSessionAnalytics,
  ]);

  const syncSupportSnapshotRemote = useCallback(
    async (payload: {
      kpis: Record<string, unknown>;
      dailyMetrics: unknown[];
      errorGroups: unknown[];
      customerHealth: unknown[];
      performanceSummary: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }) => {
      try {
        await fetch(
          `/api/workspaces/${workspaceId}/analytics/support/snapshot`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              schemaVersion: 1,
              generatedAt: new Date().toISOString(),
              snapshot: payload,
              errorGroups: payload.errorGroups,
              customerHealth: payload.customerHealth,
              performanceSummary: payload.performanceSummary,
              metadata: payload.metadata,
            }),
          }
        );
      } catch (error) {
        console.warn(
          '[case-assistant] remote support snapshot sync failed',
          error
        );
      }
    },
    [workspaceId]
  );

  const fetchSupportDashboardRemote = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/analytics/support/dashboard?period=${encodeURIComponent(
          analyticsPeriod
        )}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as {
        source: 'snapshot' | 'fallback';
        snapshot: Record<string, unknown> | null;
        latestErrorGroups: unknown[];
        latestCustomerHealth: unknown[];
      };
    } catch (error) {
      console.warn(
        '[case-assistant] remote support dashboard fetch failed',
        error
      );
      return null;
    }
  }, [workspaceId, analyticsPeriod]);

  const fetchSupportOpsJson = useCallback(
    async <T,>(endpoint: string): Promise<T | null> => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/analytics/support${endpoint}`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );
        if (!res.ok) {
          return null;
        }
        return (await res.json()) as T;
      } catch {
        return null;
      }
    },
    [workspaceId]
  );

  const updateSupportRetentionPolicy = useCallback(
    async (payload: { snapshotTtlDays: number; historyMaxItems: number }) => {
      if (supportRetentionSaveInFlightRef.current) {
        return false;
      }
      supportRetentionSaveInFlightRef.current = true;
      setIsSavingSupportRetention(true);
      setSupportOpsError(null);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/analytics/support/retention`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          setSupportOpsError(
            'Retention-Policy konnte nicht gespeichert werden.'
          );
          return false;
        }
        const next = (await res.json()) as SupportRetentionPolicy;
        setSupportRetentionPolicy(next);
        setSupportOpsError(null);
        return true;
      } catch {
        setSupportOpsError('Retention-Policy konnte nicht gespeichert werden.');
        return false;
      } finally {
        setIsSavingSupportRetention(false);
        supportRetentionSaveInFlightRef.current = false;
      }
    },
    [workspaceId]
  );

  const updateSupportEscalationPolicy = useCallback(
    async (payload: {
      notifyOn: SupportIncidentSeverity[];
      channels: Array<'email' | 'webhook'>;
      throttleMinutes: number;
    }) => {
      if (supportEscalationSaveInFlightRef.current) {
        return false;
      }
      supportEscalationSaveInFlightRef.current = true;
      setIsSavingSupportEscalation(true);
      setSupportOpsError(null);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/analytics/support/escalation`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          setSupportOpsError(
            'Eskalations-Policy konnte nicht gespeichert werden.'
          );
          return false;
        }
        const next = (await res.json()) as SupportEscalationPolicy;
        setSupportEscalationPolicy(next);
        setSupportOpsError(null);
        return true;
      } catch {
        setSupportOpsError(
          'Eskalations-Policy konnte nicht gespeichert werden.'
        );
        return false;
      } finally {
        setIsSavingSupportEscalation(false);
        supportEscalationSaveInFlightRef.current = false;
      }
    },
    [workspaceId]
  );

  const refreshAnalyticsDashboard = useCallback(async () => {
    setIsAnalyticsRefreshing(true);
    try {
      const sessions = geoSessionAnalytics.getSessions(analyticsPeriod);
      const totalSessions = sessions.length;
      const avgDuration =
        geoSessionAnalytics.getAverageSessionDuration(analyticsPeriod);
      const bounceRate = geoSessionAnalytics.getBounceRate(analyticsPeriod);
      const totalPageViews =
        geoSessionAnalytics.getTotalPageViews(analyticsPeriod);
      const errorLogs = errorMonitoring.getUnresolvedErrors();
      const avgLoad = performanceMonitor.getAverageLoadTime(analyticsPeriod);
      const healthScores = customerHealthService.computeHealthScores();
      const avgHealth = customerHealthService.getAverageHealthScore();
      const atRisk = healthScores.filter(
        s => s.status === 'at-risk' || s.status === 'critical'
      ).length;
      const uniqueUsers = new Set(
        sessions.filter(s => s.userId).map(s => s.userId!)
      );
      const newUsers = sessions.filter(s => !s.isReturning && s.userId).length;

      const kpis = {
        totalUsers: uniqueUsers.size || totalSessions,
        activeUsers: uniqueUsers.size || totalSessions,
        newUsers,
        totalSessions,
        avgSessionDuration: avgDuration,
        bounceRate,
        totalPageViews,
        totalErrors: errorLogs.length,
        errorRate: totalSessions > 0 ? errorLogs.length / totalSessions : 0,
        avgLoadTime: avgLoad,
        customerHealthAvg: avgHealth,
        atRiskCustomers: atRisk,
      };

      const dailyMetrics =
        businessIntelligence.getDailyMetrics(analyticsPeriod);
      const errorGroups = errorMonitoring.getErrorGroups();
      const coreWebVitals =
        performanceMonitor.getCoreWebVitalsScore(analyticsPeriod);
      const geoDistribution =
        geoSessionAnalytics.getGeoDistribution(analyticsPeriod);
      const deviceBreakdown =
        geoSessionAnalytics.getDeviceBreakdown(analyticsPeriod);
      const browserBreakdown =
        geoSessionAnalytics.getBrowserBreakdown(analyticsPeriod);
      const topReferrers = geoSessionAnalytics.getTopReferrers(analyticsPeriod);
      const sessionsByHour =
        geoSessionAnalytics.getSessionsByHour(analyticsPeriod);
      const featureUsage =
        businessIntelligence.getFeatureUsage(analyticsPeriod);
      const retentionCohorts =
        businessIntelligence.getRetentionCohorts(analyticsPeriod);
      const healthSummary = customerHealthService.getHealthSummary();

      setAnalyticsKpis(kpis);
      setAnalyticsDailyMetrics(dailyMetrics);
      setAnalyticsErrorGroups(errorGroups);
      setAnalyticsCoreWebVitals(coreWebVitals);
      setAnalyticsAvgLoadTime(avgLoad);
      setAnalyticsGeoDistribution(geoDistribution);
      setAnalyticsDeviceBreakdown(deviceBreakdown);
      setAnalyticsBrowserBreakdown(browserBreakdown);
      setAnalyticsTopReferrers(topReferrers);
      setAnalyticsSessionsByHour(sessionsByHour);
      setAnalyticsFeatureUsage(featureUsage);
      setAnalyticsCustomerHealth(healthScores);
      setAnalyticsHealthSummary(healthSummary);
      setAnalyticsRetentionCohorts(retentionCohorts);

      await syncSupportSnapshotRemote({
        kpis,
        dailyMetrics,
        errorGroups,
        customerHealth: healthScores,
        performanceSummary: {
          coreWebVitals,
          averageLoadTime: avgLoad,
        },
        metadata: {
          caseId,
          workspaceId,
          period: analyticsPeriod,
          syncedBy: 'case-assistant-panel',
        },
      });

      const remote = await fetchSupportDashboardRemote();
      const [
        statusSnapshot,
        incidents,
        alerts,
        auditTrail,
        retentionPolicy,
        escalationPolicy,
      ] = await Promise.all([
        fetchSupportOpsJson<SupportStatusSnapshot>('/status'),
        fetchSupportOpsJson<SupportIncident[]>('/incidents?limit=50'),
        fetchSupportOpsJson<SupportAlert[]>('/alerts?limit=100'),
        fetchSupportOpsJson<SupportAuditEntry[]>('/audit?limit=100'),
        fetchSupportOpsJson<SupportRetentionPolicy>('/retention'),
        fetchSupportOpsJson<SupportEscalationPolicy>('/escalation'),
      ]);

      const remoteSnapshot = remote?.snapshot;
      if (remote?.source === 'snapshot' && remoteSnapshot) {
        const remoteKpis = remoteSnapshot.kpis;
        if (remoteKpis && typeof remoteKpis === 'object') {
          setAnalyticsKpis(remoteKpis);
        }
        const remoteDaily = remoteSnapshot.dailyMetrics;
        if (Array.isArray(remoteDaily)) {
          setAnalyticsDailyMetrics(remoteDaily);
        }
        const remoteFeatures = remoteSnapshot.featureUsage;
        if (Array.isArray(remoteFeatures)) {
          setAnalyticsFeatureUsage(remoteFeatures);
        }
      }
      if (
        Array.isArray(remote?.latestErrorGroups) &&
        remote.latestErrorGroups.length > 0
      ) {
        setAnalyticsErrorGroups(remote.latestErrorGroups);
      }
      if (
        Array.isArray(remote?.latestCustomerHealth) &&
        remote.latestCustomerHealth.length > 0
      ) {
        setAnalyticsCustomerHealth(remote.latestCustomerHealth);
      }

      if (statusSnapshot) setSupportStatusSnapshot(statusSnapshot);
      if (Array.isArray(incidents)) setSupportIncidents(incidents);
      if (Array.isArray(alerts)) setSupportAlerts(alerts);
      if (Array.isArray(auditTrail)) setSupportAuditTrail(auditTrail);
      if (retentionPolicy) setSupportRetentionPolicy(retentionPolicy);
      if (escalationPolicy) setSupportEscalationPolicy(escalationPolicy);

      const supportOpsFetchResults = [
        statusSnapshot,
        incidents,
        alerts,
        auditTrail,
        retentionPolicy,
        escalationPolicy,
      ];
      const supportOpsSuccessCount = supportOpsFetchResults.filter(
        result => result !== null
      ).length;

      if (supportOpsSuccessCount === 0) {
        setSupportOpsError(
          'Support-Konsole konnte nicht remote geladen werden (Berechtigung oder Netzwerk).'
        );
      } else if (supportOpsSuccessCount < supportOpsFetchResults.length) {
        setSupportOpsError(
          'Support-Konsole teilweise geladen. Einige Datenquellen sind aktuell nicht erreichbar.'
        );
      } else {
        setSupportOpsError(null);
      }
    } finally {
      setIsAnalyticsRefreshing(false);
    }
  }, [
    caseId,
    workspaceId,
    analyticsPeriod,
    geoSessionAnalytics,
    errorMonitoring,
    performanceMonitor,
    customerHealthService,
    businessIntelligence,
    syncSupportSnapshotRemote,
    fetchSupportDashboardRemote,
    fetchSupportOpsJson,
  ]);

  useEffect(() => {
    if (activeSidebarSection === 'analytics') {
      refreshAnalyticsDashboard().catch((error: unknown) => {
        console.warn('[case-assistant] analytics refresh failed', error);
      });
    }
  }, [activeSidebarSection, analyticsPeriod, refreshAnalyticsDashboard]);

  const onResolveAnalyticsError = useCallback(
    (fingerprint: string) => {
      errorMonitoring.resolveError(fingerprint);
      setAnalyticsErrorGroups(errorMonitoring.getErrorGroups());
    },
    [errorMonitoring]
  );

  const onUnresolveAnalyticsError = useCallback(
    (fingerprint: string) => {
      errorMonitoring.unresolveError(fingerprint);
      setAnalyticsErrorGroups(errorMonitoring.getErrorGroups());
    },
    [errorMonitoring]
  );

  const onAcknowledgeHealthAlert = useCallback(
    (alertId: string) => {
      customerHealthService.acknowledgeAlert(alertId);
      setAnalyticsCustomerHealth(customerHealthService.getHealthScores());
      setAnalyticsHealthSummary(customerHealthService.getHealthSummary());
    },
    [customerHealthService]
  );

  useEffect(() => {
    if (caseMatter?.externalRef) {
      setIntakeDraft(prev => {
        if (prev.internalFileNumber) return prev;
        return { ...prev, internalFileNumber: caseMatter.externalRef! };
      });
    }
  }, [caseMatter?.externalRef]);

  useEffect(() => {
    if (connectors.length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const defaults = [
      {
        id: `connector:${workspaceId}:paperless`,
        workspaceId,
        kind: 'paperless' as const,
        name: 'Paperless-ngx',
        endpoint: 'http://localhost:8000',
        authType: 'api-key' as const,
        authHeaderName: 'X-API-Key',
      },
      {
        id: `connector:${workspaceId}:n8n`,
        workspaceId,
        kind: 'n8n' as const,
        name: 'n8n Automation',
        endpoint: 'http://localhost:5678',
        authType: 'bearer' as const,
      },
      {
        id: `connector:${workspaceId}:mail`,
        workspaceId,
        kind: 'mail' as const,
        name: 'Mail Gateway',
        endpoint: 'smtp://localhost:1025',
        authType: 'api-key' as const,
        authHeaderName: 'X-Mail-Token',
      },
      {
        id: `connector:${workspaceId}:dropbox`,
        workspaceId,
        kind: 'dropbox' as const,
        name: 'Dropbox Search Bridge',
        endpoint: 'http://localhost:8787/dropbox/search',
        authType: 'bearer' as const,
      },
    ];

    Promise.all(
      defaults.map(connector =>
        casePlatformOrchestrationService.upsertConnector({
          ...connector,
          enabled: false,
          status: 'disconnected',
          createdAt: now,
          updatedAt: now,
        })
      )
    ).catch(error => {
      console.error(
        '[case-assistant] failed to seed connector defaults',
        error
      );
      setIngestionStatus(
        'Standard-Connectoren konnten nicht initialisiert werden. Bitte erneut versuchen.'
      );
    });
  }, [casePlatformOrchestrationService, connectors.length, workspaceId]);

  useEffect(() => {
    setConnectorDrafts(prev => {
      const next = { ...prev };
      for (const connector of connectors) {
        const current = next[connector.id];
        if (current) {
          next[connector.id] = {
            ...current,
            endpoint: connector.endpoint,
            authType: connector.authType,
            authHeaderName: connector.authHeaderName ?? '',
          };
          continue;
        }

        next[connector.id] = {
          endpoint: connector.endpoint,
          authType: connector.authType,
          authHeaderName: connector.authHeaderName ?? '',
          credential: '',
          rotationDays: connector.metadata?.rotationDays ?? '30',
          rotationMode: normalizeRotationMode(connector.metadata?.rotationMode),
        };
      }
      return next;
    });
  }, [connectors]);

  useEffect(() => {
    if (caseRecord) {
      return;
    }

    caseAssistantService
      .upsertCaseFile({
        id: caseId,
        workspaceId,
        title,
        actorIds: [],
        issueIds: [],
        deadlineIds: [],
        memoryEventIds: [],
        tags: ['auto-created'],
      })
      .catch((error: unknown) => {
        console.error(
          '[case-assistant] failed to initialize case record',
          error
        );
        setIngestionStatus(
          'Akte konnte nicht initialisiert werden. Bitte erneut versuchen.'
        );
      });
  }, [caseAssistantService, caseId, caseRecord, title, workspaceId]);

  useEffect(() => {
    if (!hasExternalPreselection || externalPreselectionAppliedRef.current) {
      return;
    }

    let applied = false;

    if (initialSelectedMatterId && mattersById.has(initialSelectedMatterId)) {
      setSelectedMatterId(initialSelectedMatterId);
      const preselectedMatter = mattersById.get(initialSelectedMatterId);
      if (preselectedMatter?.clientId) {
        setSelectedClientId(preselectedMatter.clientId);
      }
      applied = true;
    }

    if (initialSelectedClientId && clientsById.has(initialSelectedClientId)) {
      setSelectedClientId(initialSelectedClientId);
      applied = true;
    }

    if (applied) {
      externalPreselectionAppliedRef.current = true;
    }
  }, [
    clientsById,
    hasExternalPreselection,
    initialSelectedClientId,
    initialSelectedMatterId,
    mattersById,
  ]);

  useEffect(() => {
    if (hasExternalPreselection && externalPreselectionAppliedRef.current) {
      return;
    }

    if (caseClient) {
      setSelectedClientId(caseClient.id);
    }
    if (caseMatter) {
      setSelectedMatterId(caseMatter.id);
    }
  }, [caseClient, caseMatter, hasExternalPreselection]);

  const cockpit = useMemo(() => {
    return caseCockpitService.buildCockpit(caseId);
  }, [caseCockpitService, caseId, graph, alerts]);

  const caseDeadlines = useMemo<CaseDeadline[]>(() => {
    const deadlineIds = new Set(caseRecord?.deadlineIds ?? []);
    const all = Object.values(graph?.deadlines ?? {}) as CaseDeadline[];
    return all
      .filter(d => deadlineIds.has(d.id))
      .sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );
  }, [graph?.deadlines, caseRecord?.deadlineIds]);

  const suggestTemplateForDeadline = useCallback(
    (deadline: CaseDeadline): DocumentTemplate => {
      const text = [deadline.title, ...(deadline.evidenceSnippets ?? [])]
        .join(' ')
        .toLowerCase();
      if (text.includes('widerspruch')) return 'widerspruch';
      if (text.includes('berufung')) return 'berufungsschrift';
      if (text.includes('klageerwider')) return 'klageerwiderung';
      if (text.includes('klage')) return 'klageschrift';
      if (text.includes('abmahnung')) return 'abmahnung';
      if (text.includes('mahnung')) return 'mahnung';
      if (text.includes('kuendigung') || text.includes('kündigung'))
        return 'kuendigung';
      if (text.includes('mietminderung')) return 'mietminderungsanzeige';
      if (text.includes('vergleich')) return 'vergleichsvorschlag';
      return 'sachverhaltsdarstellung';
    },
    []
  );

  const caseActors = useMemo(() => {
    const actorIds = new Set(caseRecord?.actorIds ?? []);
    const all = Object.values(graph?.actors ?? {}) as CaseActor[];
    return all.filter(a => actorIds.has(a.id));
  }, [graph?.actors, caseRecord?.actorIds]);

  const caseIssues = useMemo(() => {
    const issueIds = new Set(caseRecord?.issueIds ?? []);
    const all = Object.values(graph?.issues ?? {}) as CaseIssue[];
    return all.filter(i => issueIds.has(i.id));
  }, [graph?.issues, caseRecord?.issueIds]);

  const caseNormReferences = useMemo(() => {
    const refs = new Set<string>();
    const docs = (legalDocuments ?? []).filter(
      (d: LegalDocumentRecord) =>
        d.caseId === caseId &&
        d.workspaceId === workspaceId &&
        d.status === 'indexed'
    );
    for (const doc of docs) {
      if (doc.paragraphReferences) {
        for (const ref of doc.paragraphReferences) {
          refs.add(ref);
        }
      }
    }
    return Array.from(refs);
  }, [legalDocuments, caseId, workspaceId]);

  const caseAlerts: DeadlineAlert[] = useMemo(() => {
    return caseAlertCenterService.listByCase(caseId);
  }, [caseAlertCenterService, caseId, alerts]);

  const filteredAlerts: DeadlineAlert[] = useMemo(() => {
    if (!onlyCriticalAlerts) {
      return caseAlerts;
    }
    return caseAlerts.filter(
      alert => alert.priority === 'critical' || alert.priority === 'high'
    );
  }, [caseAlerts, onlyCriticalAlerts]);

  const caseDocuments = useMemo(
    () => selectCaseDocuments(legalDocuments, caseId, workspaceId),
    [caseId, legalDocuments, workspaceId]
  );

  const normAnalysis = useMemo<CaseNormAnalysis | null>(() => {
    if (caseDocuments.length === 0) return null;
    const indexed = caseDocuments.filter(d => d.status === 'indexed');
    if (indexed.length === 0) return null;
    return documentNormExtractorService.analyzeCase({
      caseId,
      workspaceId,
      documents: indexed,
    });
  }, [caseDocuments, caseId, workspaceId, documentNormExtractorService]);

  const caseAuditResult = useMemo<CaseAuditResult | null>(() => {
    if (caseDocuments.length === 0) return null;
    const indexed = caseDocuments.filter(d => d.status === 'indexed');
    if (indexed.length === 0) return null;
    return normClassificationEngine.runCaseAudit({
      caseId,
      workspaceId,
      documents: indexed,
    });
  }, [caseDocuments, caseId, workspaceId, normClassificationEngine]);

  const caseOcrJobs = useMemo(
    () => selectCaseOcrJobs(ocrJobs, caseId, workspaceId),
    [caseId, ocrJobs, workspaceId]
  );

  const ocrRunningCount = useMemo(
    () => selectOcrRunningCount(caseOcrJobs),
    [caseOcrJobs]
  );

  const ocrFailedCount = useMemo(
    () => selectOcrFailedCount(caseOcrJobs),
    [caseOcrJobs]
  );

  const caseFindings = useMemo(
    () => selectCaseFindings(legalFindings, caseId, workspaceId),
    [caseId, legalFindings, workspaceId]
  );

  const caseTaskList = useMemo(
    () => selectCaseTasks(copilotTasks, caseId, workspaceId),
    [caseId, copilotTasks, workspaceId]
  );

  const latestBlueprint = useMemo(
    () => selectLatestBlueprint(caseBlueprints, caseId, workspaceId),
    [caseBlueprints, caseId, workspaceId]
  );

  const latestCopilotRun = useMemo(
    () => selectLatestCopilotRun(copilotRuns, caseId, workspaceId),
    [caseId, copilotRuns, workspaceId]
  );

  const citationBackedFindingCount = useMemo(
    () => selectCitationBackedFindingCount(caseFindings),
    [caseFindings]
  );

  const recommendedMobileAction = useMemo(
    () =>
      selectRecommendedMobileAction({
        caseDocumentsCount: caseDocuments.length,
        ocrRunningCount,
        ocrFailedCount,
        caseFindingsCount: caseFindings.length,
        hasGeneratedDoc: !!generatedDoc,
      }),
    [
      caseDocuments.length,
      caseFindings.length,
      generatedDoc,
      ocrFailedCount,
      ocrRunningCount,
    ]
  );

  const recommendedMobileActionText = useMemo(
    () => selectRecommendedMobileActionText(recommendedMobileAction),
    [recommendedMobileAction]
  );

  const residencyModeLabel = useMemo(() => {
    if (residencyPolicyDraft.mode === 'local_only') {
      return 'Local Only';
    }
    if (residencyPolicyDraft.mode === 'self_hosted') {
      return 'Self-hosted';
    }
    return 'Cloud Sync';
  }, [residencyPolicyDraft.mode]);

  useEffect(() => {
    let disposed = false;
    void providerSettingsService
      .getProviderConfig('ocr')
      .then(config => {
        if (disposed) {
          return;
        }
        setOcrEndpoint(config.endpoint);
        setHasStoredOcrToken(config.hasToken);
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setIngestionStatus(
          'OCR-Provider-Konfiguration konnte nicht geladen werden.'
        );
      });

    return () => {
      disposed = true;
    };
  }, [providerSettingsService]);

  useEffect(() => {
    let disposed = false;
    void casePlatformOrchestrationService
      .getWorkspaceResidencyPolicy()
      .then(policy => {
        if (disposed) {
          return;
        }
        setResidencyPolicyDraft(policy);
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setIngestionStatus(
          'Workspace-Residency-Policy konnte nicht geladen werden.'
        );
      });

    return () => {
      disposed = true;
    };
  }, [casePlatformOrchestrationService]);

  useEffect(() => {
    if (!residencyPolicyLive) {
      return;
    }
    setResidencyPolicyDraft(residencyPolicyLive);
  }, [residencyPolicyLive]);

  useEffect(() => {
    if (!latestBlueprint) {
      setBlueprintObjectiveDraft('');
      setBlueprintReviewNoteDraft('');
      setBlueprintReviewStatus('draft');
      return;
    }
    setBlueprintObjectiveDraft(latestBlueprint.objective);
    setBlueprintReviewNoteDraft(latestBlueprint.reviewNote ?? '');
    setBlueprintReviewStatus(latestBlueprint.reviewStatus ?? 'draft');
  }, [latestBlueprint]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      providerSettingsService.getProviderConfig('legal-analysis'),
      providerSettingsService.getProviderConfig('judikatur'),
    ])
      .then(([legalConfig, judikaturConfig]) => {
        if (disposed) {
          return;
        }
        setLegalAnalysisEndpoint(legalConfig.endpoint);
        setHasStoredLegalAnalysisToken(legalConfig.hasToken);
        setJudikaturEndpoint(judikaturConfig.endpoint);
        setHasStoredJudikaturToken(judikaturConfig.hasToken);
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setIngestionStatus(
          'Legal-Provider-Konfiguration konnte nicht geladen werden.'
        );
      });

    return () => {
      disposed = true;
    };
  }, [providerSettingsService]);

  const handleQuickIngest = useCallback(async () => {
    setIsIngesting(true);
    setIngestionStatus(null);
    let jobId: string | null = null;

    const selectedText = await extractSelectionPlainText(editorContainer);
    const documentText = extractDocPlainText(sourceDoc);
    const docText = ingestionMode === 'selection' ? selectedText : documentText;

    if (docText.length < 20) {
      setIngestionStatus(
        ingestionMode === 'selection'
          ? 'Zu wenig markierter Inhalt. Bitte erst Text markieren.'
          : 'Zu wenig verwertbarer Seiteninhalt. Bitte erst Inhalte hinzufügen.'
      );
      setIsIngesting(false);
      return;
    }

    try {
      const job = await casePlatformOrchestrationService.enqueueIngestionJob({
        caseId,
        workspaceId,
        sourceType: ingestionMode,
        sourceRef: `${caseId}:${ingestionMode}:${Date.now()}`,
      });
      jobId = job.id;
      await casePlatformOrchestrationService.updateJobStatus({
        jobId: job.id,
        status: 'running',
        progress: 15,
      });

      const result = await caseIngestionService.ingestCaseFromDocuments({
        caseId,
        workspaceId,
        title,
        docs: [
          {
            id: `${caseId}:active-doc:${Date.now()}`,
            title,
            content: docText,
            createdAt: new Date().toISOString(),
            tags: ['quick-ingest'],
          },
        ],
        tags: ['quick-ingest'],
      });

      setIngestionStatus(
        `Akte aktualisiert: ${result.issues.length} Issues, ${result.deadlines.length} Fristen erkannt.`
      );
      await casePlatformOrchestrationService.updateJobStatus({
        jobId: job.id,
        status: 'completed',
        progress: 100,
      });
      await casePlatformOrchestrationService.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'case.quick_ingestion.completed',
        severity: 'info',
        details: `Quick-Ingestion (${ingestionMode}) erfolgreich abgeschlossen.`,
      });
      await deadlineAlertService.syncNow();
    } catch (error) {
      console.error('[case-assistant] quick ingestion failed', error);
      setIngestionStatus(
        'Schnellanalyse fehlgeschlagen. Bitte erneut versuchen.'
      );
      const latestJob =
        (jobId ? ingestionJobs.find(job => job.id === jobId) : null) ??
        ingestionJobs.find(
          job =>
            job.caseId === caseId &&
            job.workspaceId === workspaceId &&
            (job.status === 'queued' || job.status === 'running')
        );
      if (latestJob) {
        await casePlatformOrchestrationService.updateJobStatus({
          jobId: latestJob.id,
          status: 'failed',
          progress: latestJob.progress,
          errorMessage: 'Quick-Ingestion fehlgeschlagen',
        });
      }
      await casePlatformOrchestrationService.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'case.quick_ingestion.failed',
        severity: 'error',
        details: `Quick-Ingestion (${ingestionMode}) fehlgeschlagen.`,
      });
    } finally {
      setIsIngesting(false);
    }
  }, [
    caseId,
    caseIngestionService,
    casePlatformOrchestrationService,
    deadlineAlertService,
    editorContainer,
    ingestionJobs,
    ingestionMode,
    sourceDoc,
    title,
    workspaceId,
  ]);

  const onApplyCopilotDraftToDocument = useCallback(async () => {
    if (!copilotDraftPreview?.trim()) {
      setCopilotResponse('Kein Entwurf zum Einfügen vorhanden.');
      return;
    }

    const acceptedSections = draftSections.filter(
      section => section.status === 'accepted'
    );
    const acceptedWithoutCitations = acceptedSections.filter(
      section => section.citations.length === 0
    );
    const acceptedDraft = composeAcceptedDraft(draftSections).trim();
    if (!acceptedDraft) {
      setCopilotResponse(
        'Bitte mindestens einen Abschnitt auf "Akzeptieren" setzen, bevor der Entwurf eingefügt wird.'
      );
      return;
    }

    if (draftReviewStatus !== 'approved') {
      setCopilotResponse(
        'Entwurf ist noch nicht freigegeben. Bitte zuerst "Zur Freigabe" und danach "Freigeben" ausführen.'
      );
      return;
    }

    const currentDraftHash = buildDraftIntegrityHash(
      copilotDraftPreview,
      draftSections
    );
    if (!draftApprovedHash || draftApprovedHash !== currentDraftHash) {
      setCopilotResponse(
        'Entwurf wurde nach Freigabe verändert. Bitte erneut zur Freigabe senden und freigeben.'
      );
      return;
    }

    const auditGateOk =
      !!lastAuditVerification?.ok &&
      !!lastAuditVerification?.draftGovernance?.strictFlowOk &&
      !!draftApprovedHash &&
      lastAuditVerification?.draftGovernance?.latestApprovedHash ===
        draftApprovedHash;

    if (!auditGateOk) {
      setCopilotResponse(
        'Audit-Gate nicht erfüllt. Bitte zuerst "Audit Verify" ausführen, damit die aktuelle Freigabe verifiziert ist.'
      );
      return;
    }

    if (acceptedWithoutCitations.length > 0) {
      const message =
        `Einfügen blockiert: ${acceptedWithoutCitations.length} akzeptierte Abschnitt(e) ohne Citation.` +
        ' Bitte erst Belege ergänzen oder Abschnitt auf "Ablehnen" setzen.';
      setIngestionStatus(message);
      setCopilotResponse(message);
      return;
    }

    if (!sourceDoc) {
      setCopilotResponse('Aktuelles Dokument nicht verfügbar.');
      return;
    }

    const notes = sourceDoc.getBlocksByFlavour('affine:note');
    const firstNote = notes[0];
    const parentId = firstNote?.id ?? sourceDoc.root?.id;
    if (!parentId) {
      setCopilotResponse('Kein gültiger Einfügepunkt im Dokument gefunden.');
      return;
    }

    setIsApplyingCopilotDraft(true);
    try {
      await insertFromMarkdown(
        editorContainer?.host,
        acceptedDraft,
        sourceDoc,
        parentId,
        firstNote?.model?.children?.length ?? 0
      );

      const message =
        'Copilot-Entwurf wurde in das aktuelle Dokument eingefügt. Änderungen sind live sichtbar.';
      setIngestionStatus(message);
      setCopilotResponse(message);

      await casePlatformOrchestrationService.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'copilot.draft.applied',
        severity: 'info',
        details: 'Copilot-Entwurf in aktuelles Dokument eingefügt.',
        metadata: {
          totalSections: String(draftSections.length),
          acceptedSections: String(
            draftSections.filter(section => section.status === 'accepted')
              .length
          ),
          rejectedSections: String(
            draftSections.filter(section => section.status === 'rejected')
              .length
          ),
          acceptedWithoutCitations: String(acceptedWithoutCitations.length),
          appliedDraftHash: currentDraftHash,
        },
      });
    } catch (error) {
      console.error('[case-assistant] apply copilot draft failed', error);
      setCopilotResponse(
        'Entwurf konnte nicht eingefügt werden. Bitte erneut versuchen.'
      );
    } finally {
      setIsApplyingCopilotDraft(false);
    }
  }, [
    caseId,
    casePlatformOrchestrationService,
    copilotDraftPreview,
    draftApprovedHash,
    draftReviewStatus,
    draftSections,
    editorContainer,
    lastAuditVerification,
    sourceDoc,
    workspaceId,
  ]);

  const onRequestDraftReview = useCallback(async () => {
    if (!copilotDraftPreview?.trim()) {
      setCopilotResponse('Kein Entwurf zur Freigabe vorhanden.');
      return;
    }
    const requestedHash = buildDraftIntegrityHash(
      copilotDraftPreview,
      draftSections
    );
    setDraftReviewStatus('in_review');
    setDraftReviewRequestedByRole(currentRole);
    setDraftApprovedByRole(null);
    setDraftReviewRequestedHash(requestedHash);
    setDraftApprovedHash(null);
    setLastAuditVerification(null);
    setCopilotResponse('Entwurf wurde zur Freigabe markiert.');
    await casePlatformOrchestrationService.appendAuditEntry({
      caseId,
      workspaceId,
      action: 'copilot.draft.review_requested',
      severity: 'info',
      details: 'Copilot-Entwurf zur Freigabe eingereicht.',
      metadata: {
        requestedByRole: currentRole,
        fourEyesRequired: 'true',
        requestedDraftHash: requestedHash,
      },
    });
  }, [
    caseId,
    casePlatformOrchestrationService,
    copilotDraftPreview,
    currentRole,
    draftSections,
    workspaceId,
  ]);

  const onApproveDraft = useCallback(async () => {
    const canApprove = roleRank[currentRole] >= roleRank.admin;
    if (!canApprove) {
      setCopilotResponse(
        `Freigabe blockiert: Rolle ${currentRole} benötigt Admin oder höher.`
      );
      return;
    }
    if (!copilotDraftPreview?.trim()) {
      setCopilotResponse('Kein Entwurf zur Freigabe vorhanden.');
      return;
    }
    if (draftReviewStatus !== 'in_review') {
      setCopilotResponse('Entwurf muss zuerst auf "in_review" gesetzt werden.');
      return;
    }
    if (!draftReviewRequestedByRole) {
      setCopilotResponse(
        'Freigabe nicht möglich: Requester-Rolle fehlt. Bitte erneut zur Freigabe senden.'
      );
      return;
    }
    if (draftReviewRequestedByRole === currentRole) {
      setCopilotResponse(
        `4-Augen-Prinzip: Rolle ${currentRole} darf eigenen Review-Request nicht freigeben.`
      );
      return;
    }
    if (!draftReviewRequestedHash) {
      setCopilotResponse(
        'Freigabe nicht möglich: Draft-Hash fehlt. Bitte erneut zur Freigabe senden.'
      );
      return;
    }
    if (draftReviewNote.trim().length < 12) {
      setCopilotResponse(
        'Bitte eine aussagekräftige Review-Notiz (mind. 12 Zeichen) für die Freigabe hinterlegen.'
      );
      return;
    }

    const currentDraftHash = buildDraftIntegrityHash(
      copilotDraftPreview,
      draftSections
    );
    if (currentDraftHash !== draftReviewRequestedHash) {
      setCopilotResponse(
        'Entwurf wurde seit Review-Request verändert. Bitte erneut "Zur Freigabe" ausführen.'
      );
      return;
    }

    const reviewerFingerprint = hashFingerprint(
      `${workspaceId}:${caseId}:${draftReviewRequestedByRole}:${currentRole}:${Date.now()}`
    );

    setDraftReviewStatus('approved');
    setDraftApprovedByRole(currentRole);
    setDraftApprovedHash(currentDraftHash);
    setLastAuditVerification(null);
    setCopilotResponse(
      'Entwurf wurde freigegeben. Bitte jetzt Audit Verify ausführen.'
    );
    await casePlatformOrchestrationService.appendAuditEntry({
      caseId,
      workspaceId,
      action: 'copilot.draft.approved',
      severity: 'info',
      details: 'Copilot-Entwurf freigegeben (Admin+).',
      metadata: {
        approvedByRole: currentRole,
        requestedByRole: draftReviewRequestedByRole,
        reviewerFingerprint,
        approvedDraftHash: currentDraftHash,
        reviewNote: draftReviewNote.trim(),
      },
    });
  }, [
    caseId,
    casePlatformOrchestrationService,
    copilotDraftPreview,
    currentRole,
    draftReviewRequestedHash,
    draftReviewRequestedByRole,
    draftReviewNote,
    draftReviewStatus,
    draftSections,
    workspaceId,
  ]);

  const onSetDraftSectionStatus = useCallback(
    (sectionId: string, status: DraftSectionStatus) => {
      setDraftSections(prev =>
        prev.map(section =>
          section.id === sectionId
            ? {
                ...section,
                status,
              }
            : section
        )
      );
      setDraftReviewStatus('draft');
      setDraftReviewRequestedByRole(null);
      setDraftApprovedByRole(null);
      setDraftReviewRequestedHash(null);
      setDraftApprovedHash(null);
      setLastAuditVerification(null);
    },
    []
  );

  const acceptedSectionCount = useMemo(
    () => draftSections.filter(section => section.status === 'accepted').length,
    [draftSections]
  );

  const canApproveDraft = useMemo(
    () => roleRank[currentRole] >= roleRank.admin,
    [currentRole]
  );

  const violatesFourEyes = useMemo(
    () =>
      draftReviewStatus === 'in_review' &&
      !!draftReviewRequestedByRole &&
      draftReviewRequestedByRole === currentRole,
    [currentRole, draftReviewRequestedByRole, draftReviewStatus]
  );

  const caseJobs = useMemo(
    () =>
      ingestionJobs.filter(
        j => j.caseId === caseId && j.workspaceId === workspaceId
      ),
    [ingestionJobs, caseId, workspaceId]
  );

  const pipelineProgress = useMemo(() => {
    const latestJob =
      caseJobs.length > 0
        ? [...caseJobs].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          )[0]
        : null;

    const indexedCount = caseDocuments.filter(
      doc => doc.status === 'indexed'
    ).length;
    const ocrPendingCount = caseDocuments.filter(
      doc => doc.status === 'ocr_pending'
    ).length;
    const ocrRunningCount = caseDocuments.filter(
      doc => doc.status === 'ocr_running'
    ).length;
    const failedCount = caseDocuments.filter(
      doc => doc.status === 'failed'
    ).length;
    const uploadedCount = caseDocuments.filter(
      doc => doc.status === 'uploaded'
    ).length;
    const ocrCompletedCount = caseDocuments.filter(
      doc => doc.status === 'ocr_completed'
    ).length;

    const totalCount = caseDocuments.length;
    const inFlightCount =
      uploadedCount + ocrCompletedCount + ocrPendingCount + ocrRunningCount;
    const processedCount = indexedCount + failedCount;
    const accountedCount = Math.min(totalCount, processedCount + inFlightCount);
    const unaccountedCount = Math.max(0, totalCount - accountedCount);
    const fallbackProgress =
      totalCount === 0
        ? 0
        : inFlightCount > 0
          ? Math.max(55, Math.round((processedCount / totalCount) * 100))
          : Math.round((accountedCount / totalCount) * 100);

    const defaultPhaseLabel =
      ocrRunningCount > 0
        ? 'OCR läuft'
        : ocrPendingCount > 0
          ? 'OCR ausstehend'
          : indexedCount > 0
            ? 'Indexierung abgeschlossen'
            : 'Warten auf Upload';

    return {
      phaseLabel: latestJob
        ? `${latestJob.sourceType === 'folder' ? 'Ordner-Upload' : 'Upload'} · ${jobStatusLabel[latestJob.status] ?? latestJob.status}`
        : defaultPhaseLabel,
      progress: latestJob?.progress ?? fallbackProgress,
      active: Boolean(
        latestJob &&
        (latestJob.status === 'queued' || latestJob.status === 'running')
      ),
      totalCount,
      processedCount,
      inFlightCount,
      unaccountedCount,
      indexedCount,
      ocrPendingCount,
      ocrRunningCount,
      failedCount,
    };
  }, [caseJobs, caseDocuments]);

  const statusTone = useMemo<'info' | 'error'>(() => {
    const message = (ingestionStatus ?? copilotResponse ?? '').toLowerCase();
    if (!message) return 'info';
    return /fehl|blockiert|ungültig|nicht\s+verfügbar|konnte\s+nicht|kein\s+gültig/.test(
      message
    )
      ? 'error'
      : 'info';
  }, [copilotResponse, ingestionStatus]);

  const announceText = useMemo(
    () => [ingestionStatus, copilotResponse].filter(Boolean).join(' | '),
    [copilotResponse, ingestionStatus]
  );

  const { canAction, runAsyncUiAction } = useCaseActionGuards({
    currentRole,
    setIngestionStatus,
    setIsWorkflowBusy,
  });

  const handleMatterSelect = useCallback(
    (nextMatterId: string) => {
      setSelectedMatterId(nextMatterId);
      if (!nextMatterId) return;
      runAsyncUiAction(async () => {
        const result = await casePlatformOrchestrationService.assignCaseMatter({
          caseId,
          workspaceId,
          matterId: nextMatterId,
        });
        if (!result) {
          setIngestionStatus(
            `Akte konnte nicht zugeordnet werden (Rolle ${currentRole}, benötigt: operator).`
          );
        }
      }, 'matter switch failed');
    },
    [
      caseId,
      casePlatformOrchestrationService,
      currentRole,
      runAsyncUiAction,
      workspaceId,
    ]
  );

  const handleRoleChange = useCallback(
    (nextRole: CaseAssistantRole) => {
      runAsyncUiAction(
        () => casePlatformOrchestrationService.setCurrentRole(nextRole),
        'role change failed'
      );
    },
    [casePlatformOrchestrationService, runAsyncUiAction]
  );

  const handleJurisdictionChange = useCallback(
    (nextJurisdiction: Jurisdiction) => {
      jurisdictionManualOverrideRef.current = true;
      caseAssistantService.setActiveJurisdiction(nextJurisdiction);
      setIngestionStatus(
        `Jurisdiktion gewechselt auf ${nextJurisdiction}. Normen- und Fristenlogik wurden angepasst.`
      );
    },
    [caseAssistantService, setIngestionStatus]
  );

  const onResidencyPolicyDraftChange = useCallback(
    (patch: Partial<WorkspaceResidencyPolicy>) => {
      setResidencyPolicyDraft(current => {
        const merged: WorkspaceResidencyPolicy = {
          ...current,
          ...patch,
          workspaceId,
        };

        if (patch.mode === 'local_only') {
          return {
            ...merged,
            allowCloudSync: false,
            allowRemoteOcr: false,
            allowExternalConnectors: false,
            allowTelemetry: false,
            enforceEncryptionAtRest: true,
            requireMfaForAdmins: true,
            sessionIdleTimeoutMinutes: Math.min(
              60,
              Math.max(5, Number(merged.sessionIdleTimeoutMinutes || 30))
            ),
          };
        }

        return merged;
      });
    },
    [workspaceId]
  );

  const onSaveResidencyPolicy = useCallback(async () => {
    const result =
      await casePlatformOrchestrationService.setWorkspaceResidencyPolicy(
        residencyPolicyDraft
      );
    if (!result) {
      setIngestionStatus(
        'Residency-Policy konnte nicht gespeichert werden (fehlende Berechtigung).'
      );
      return;
    }
    setResidencyPolicyDraft(result);
    setIngestionStatus(`Residency-Policy gespeichert (${result.mode}).`);
  }, [
    casePlatformOrchestrationService,
    residencyPolicyDraft,
    setIngestionStatus,
  ]);

  useEffect(() => {
    const selected = selectedMatterId
      ? mattersById.get(selectedMatterId)
      : null;
    const matterJurisdiction = selected?.jurisdiction;

    if (matterJurisdiction && matterJurisdiction !== activeJurisdiction) {
      // Matter jurisdiction is authoritative for the workflow.
      jurisdictionManualOverrideRef.current = false;
      caseAssistantService.setActiveJurisdiction(matterJurisdiction);
      setIngestionStatus(
        `Jurisdiktion automatisch auf ${matterJurisdiction} gesetzt (Akte).`
      );
      return;
    }

    if (jurisdictionManualOverrideRef.current) {
      return;
    }

    const caseDocs = (legalDocuments ?? []).filter(
      doc =>
        doc.caseId === caseId &&
        doc.workspaceId === workspaceId &&
        doc.status === 'indexed' &&
        !!doc.detectedJurisdiction
    );
    if (caseDocs.length === 0) {
      return;
    }

    const counts = new Map<Jurisdiction, number>();
    for (const doc of caseDocs) {
      const j = doc.detectedJurisdiction;
      if (!j) continue;
      counts.set(j, (counts.get(j) ?? 0) + 1);
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    if (!top) return;

    const [topJurisdiction, topCount] = top;
    const secondCount = sorted[1]?.[1] ?? 0;
    const hasStrongMajority = topCount >= 2 && topCount - secondCount >= 1;

    if (hasStrongMajority && topJurisdiction !== activeJurisdiction) {
      caseAssistantService.setActiveJurisdiction(topJurisdiction);
      setIngestionStatus(
        `Jurisdiktion automatisch auf ${topJurisdiction} gesetzt (Dokumente: ${topCount}/${caseDocs.length}).`
      );
    }
  }, [
    activeJurisdiction,
    caseAssistantService,
    caseId,
    legalDocuments,
    mattersById,
    selectedMatterId,
    setIngestionStatus,
    workspaceId,
  ]);

  const jurisdictionOptions = useMemo(
    () =>
      jurisdictionService.getAllConfigs().map(config => ({
        id: config.id,
        label: config.label,
        flag: config.flag,
      })),
    [jurisdictionService]
  );

  const handleToggleArchivedMatters = useCallback(() => {
    setShowArchivedMatters(prev => !prev);
  }, []);

  const handleQuickIngestClick = useCallback(() => {
    runAsyncUiAction(handleQuickIngest, 'quick ingest failed');
  }, [handleQuickIngest, runAsyncUiAction]);

  const getGwgOnboardingForClient = useCallback(
    (clientId: string) => gwgComplianceService.getOnboardingForClient(clientId),
    [gwgComplianceService]
  );

  const handleRequestGeneralVollmacht = useCallback(
    async (input: {
      clientId: string;
      matterId?: string;
      caseId?: string;
      title?: string;
      scope?: string;
    }) => {
      if (!activeAnwalt || !activeAnwaltDisplayName) {
        setIngestionStatus(
          'Keine aktive Anwalt-Identität gefunden. Bitte Kanzlei/Anwälte konfigurieren.'
        );
        return;
      }

      const senderEmail =
        activeAnwalt.email?.trim() ||
        kanzleiProfile?.email?.trim() ||
        'noreply@app.subsum.io';

      const result = await mandantenPortalService.requestVollmachtPortal({
        workspaceId,
        clientId: input.clientId,
        matterId: input.matterId,
        caseId: input.caseId,
        title: input.title,
        scope: input.scope,
        mode: 'esign',
        provider: 'none',
        senderName: activeAnwaltDisplayName,
        senderEmail,
        senderId: activeAnwalt.id,
        senderDisplayName: activeAnwaltDisplayName,
      });

      setIngestionStatus(
        result.success
          ? 'Vollmacht-Link wurde per E-Mail versendet.'
          : `Vollmacht-Link konnte nicht versendet werden: ${result.message}`
      );
    },
    [
      activeAnwalt,
      activeAnwaltDisplayName,
      kanzleiProfile?.email,
      mandantenPortalService,
      setIngestionStatus,
      workspaceId,
    ]
  );

  const handleStartGwgOnboarding = useCallback(
    async (input: {
      clientId: string;
      clientName: string;
      clientKind: ClientKind;
    }) => {
      const senderEmail =
        activeAnwalt?.email?.trim() ||
        kanzleiProfile?.email?.trim() ||
        'noreply@app.subsum.io';

      const result = await mandantenPortalService.requestKycPortal({
        workspaceId,
        clientId: input.clientId,
        matterId: selectedMatterId || undefined,
        clientName: input.clientName,
        clientKind: input.clientKind,
        senderName:
          activeAnwaltDisplayName ?? kanzleiProfile?.name ?? 'Kanzlei',
        senderEmail,
      });

      setIngestionStatus(
        result.success
          ? 'KYC-Link wurde per E-Mail versendet.'
          : `KYC-Link konnte nicht versendet werden: ${result.message}`
      );
    },
    [
      activeAnwalt?.email,
      activeAnwaltDisplayName,
      kanzleiProfile?.email,
      kanzleiProfile?.name,
      mandantenPortalService,
      selectedMatterId,
      setIngestionStatus,
      workspaceId,
    ]
  );

  const connectorCards = useMemo(() => {
    return connectors.map(connector => {
      const credentialMeta = casePlatformAdapterService.getCredentialMeta(
        connector.id
      );
      const rotationDays = parseRotationDays(
        connectorDrafts[connector.id]?.rotationDays ??
          connector.metadata?.rotationDays ??
          '30',
        30
      );
      const rotationMode = normalizeRotationMode(
        connectorDrafts[connector.id]?.rotationMode ??
          connector.metadata?.rotationMode
      );
      const rotationDue = isCredentialRotationDue(
        credentialMeta.updatedAt,
        rotationDays
      );
      return {
        connector,
        credentialMeta,
        rotationDays,
        rotationMode,
        rotationDue,
      };
    });
  }, [casePlatformAdapterService, connectorDrafts, connectors]);

  const risImportValidationError = useMemo(() => {
    const fromDate = risImportFromDate.trim();
    const toDate = risImportToDate.trim();
    const maxRaw = risImportMaxResults.trim();
    if (fromDate && !isIsoDateInput(fromDate))
      return 'RIS Import (von) ist ungültig. Bitte YYYY-MM-DD verwenden.';
    if (toDate && !isIsoDateInput(toDate))
      return 'RIS Import (bis) ist ungültig. Bitte YYYY-MM-DD verwenden.';
    if (fromDate && toDate && fromDate > toDate)
      return 'RIS Import Zeitraum ist ungültig: "von" darf nicht nach "bis" liegen.';
    const parsed = Number.parseInt(maxRaw || '25', 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100)
      return 'RIS Import Max muss zwischen 1 und 100 liegen.';
    return null;
  }, [risImportFromDate, risImportMaxResults, risImportToDate]);

  const {
    onToggleConnector,
    onCancelJob,
    onRetryJob,
    onDeleteJob,
    onClearJobHistory,
    onRestoreJob,
    onRestoreJobHistory,
    onHealthcheckConnector,
    onConnectorDraftChange,
    onSaveConnectorSettings,
    onClearConnectorCredential,
    onRotateConnectorCredential,
    onAck,
  } = usePanelPlatformActions({
    caseId,
    workspaceId,
    currentRole,
    connectors,
    connectorDrafts,
    setConnectorDrafts,
    setIngestionStatus,
    setLastAuditVerification,
    casePlatformOrchestrationService,
    casePlatformAdapterService,
    caseAlertCenterService,
    caseAssistantService,
    caseAuditExportService,
  });

  const lastFocusedElementBeforeDestructiveDialogRef =
    useRef<HTMLElement | null>(null);

  const {
    onCreateClient,
    onCreateMatter,
    onAssignMatterToCase,
    onAssignClientToCase,
    onRequestDeleteSelectedClient,
    onRequestArchiveSelectedClient,
    onRequestDeleteSelectedMatter,
    onRequestArchiveSelectedMatter,
    onUndoClientAction,
    onUndoMatterAction,
    onCancelDestructiveAction: onCancelDestructiveActionFromHook,
    onConfirmDestructiveAction: onConfirmDestructiveActionFromHook,
  } = usePanelClientMatterActions({
    caseId,
    workspaceId,
    currentRole,
    canAction,
    setIngestionStatus,
    caseRecord: caseRecord ?? null,
    caseClient,
    caseMatter,
    clients,
    matters,
    activeJurisdiction,
    selectedClientId,
    setSelectedClientId,
    selectedMatterId,
    setSelectedMatterId,
    clientDraftName,
    clientDraftKind,
    clientDraftEmail,
    clientDraftPhone,
    clientDraftAddress,
    clientDraftTags,
    clientDraftNotes,
    setClientDraftName,
    setClientDraftEmail,
    setClientDraftPhone,
    setClientDraftAddress,
    setClientDraftTags,
    setClientDraftNotes,
    matterDraftTitle,
    matterDraftDescription,
    matterDraftExternalRef,
    matterDraftAuthorityReferences,
    matterDraftGericht,
    matterDraftPolizei,
    matterDraftStaatsanwaltschaft,
    matterDraftRichter,
    matterDraftGerichtsaktenzeichen,
    matterDraftStaatsanwaltschaftAktenzeichen,
    matterDraftPolizeiAktenzeichen,
    matterDraftStatus,
    matterDraftJurisdiction,
    matterDraftTags,
    matterDraftAssignedAnwaltId,
    setMatterDraftTitle,
    setMatterDraftDescription,
    setMatterDraftExternalRef,
    setMatterDraftAuthorityReferences,
    setMatterDraftGericht,
    setMatterDraftPolizei,
    setMatterDraftStaatsanwaltschaft,
    setMatterDraftRichter,
    setMatterDraftGerichtsaktenzeichen,
    setMatterDraftStaatsanwaltschaftAktenzeichen,
    setMatterDraftPolizeiAktenzeichen,
    setMatterDraftJurisdiction,
    setMatterDraftTags,
    setMatterDraftAssignedAnwaltId,
    undoClientSnapshot,
    setUndoClientSnapshot,
    undoMatterSnapshot,
    setUndoMatterSnapshot,
    pendingDestructiveAction,
    setPendingDestructiveAction,
    lastFocusedElementBeforeDestructiveDialogRef,
    casePlatformOrchestrationService,
  });

  const onUploadTelemetryAlert = useCallback(
    async (alert: UploadTelemetryAlert) => {
      await casePlatformOrchestrationService.appendAuditEntry({
        caseId,
        workspaceId,
        action: `document.upload.telemetry.${alert.type}`,
        severity: alert.severity,
        details: alert.message,
        metadata: Object.fromEntries(
          Object.entries(alert.metrics).map(([key, value]) => [
            key,
            String(value),
          ])
        ),
      });
    },
    [caseId, casePlatformOrchestrationService, workspaceId]
  );

  const {
    onRunCopilotCommand,
    onImportRecentRisDecisions,
    onImportRecentBghDecisions,
    onImportRecentHudocDecisions,
    onSearchJudikatur,
    onInsertJudikaturCitation,
  } = usePanelCopilotJudikaturActions({
    caseId,
    workspaceId,
    currentRole,
    canAction,
    judikaturQuery,
    setJudikaturResults,
    setIngestionStatus,
    risImportFromDate,
    risImportToDate,
    risImportMaxResults,
    risImportValidationError,
    setIsRisImporting,
    bghImportFromDate,
    bghImportToDate,
    bghImportMaxResults,
    setIsBghImporting,
    hudocRespondentState,
    hudocImportFromDate,
    hudocImportToDate,
    hudocImportMaxResults,
    setIsHudocImporting,
    sourceDoc,
    editorContainer,
    copilotPrompt,
    folderQuery,
    setFolderQuery,
    setFolderSearchCount,
    setIsCopilotRunning,
    setCopilotResponse,
    setCopilotDraftPreview,
    setDraftReviewStatus,
    setDraftReviewNote,
    setDraftReviewRequestedByRole,
    setDraftApprovedByRole,
    setDraftReviewRequestedHash,
    setDraftApprovedHash,
    setLastAuditVerification,
    setDraftSections,
    setIntakeDraft,
    caseFindings,
    caseDocuments,
    caseClientName: caseClient?.displayName ?? null,
    caseMatterTitle: caseMatter?.title ?? null,
    caseAktenzeichen: caseMatter?.externalRef ?? null,
    caseGericht: caseMatter?.gericht ?? null,
    caseAnwaltName: activeAnwaltDisplayName,
    caseOpposingPartyNames: (caseMatter?.opposingParties ?? []).map(
      p => p.displayName
    ),
    judikaturIngestionService,
    judikaturResearchService,
    legalCopilotWorkflowService,
    casePlatformOrchestrationService,
  });

  const resetDraftState = useCallback(() => {
    setCopilotDraftPreview(null);
    setDraftSections([]);
    setDraftReviewStatus('draft');
    setDraftReviewRequestedByRole(null);
    setDraftApprovedByRole(null);
    setDraftReviewRequestedHash(null);
    setDraftApprovedHash(null);
    setLastAuditVerification(null);
  }, []);

  const {
    onUploadFiles,
    onUploadFilesDetailed,
    onRetryDeadLetterBatch,
    onProcessOcr,
    onAnalyzeCase,
    onRunFullWorkflow,
    onFolderSearch,
    onFolderSummarize,
    onSaveOcrProviderSettings,
    onTaskAssigneeChange,
    onUpdateTaskStatus,
    onSaveBlueprintReview,
    onSearchNorms,
    onRunContradictionAnalysis,
    onCalculateCosts,
    onCalculateVergleich,
    onGenerateDocument,
    onExportGeneratedDocumentPdf,
    onInsertGeneratedDocumentIntoCurrentDoc,
    onAutoDetectEvidence,
    onSaveLegalProviderSettings,
    onRetryFailedDocument,
    onRemoveFailedDocument,
  } = usePanelWorkflowActions({
    caseId,
    workspaceId,
    currentRole,
    sourceDoc,
    editorContainer,
    intakeDraft,
    folderQuery,
    setFolderQuery,
    setFolderSearchCount,
    ocrEndpoint,
    ocrToken,
    normSearchQuery,
    setNormSearchResults,
    activeJurisdiction,
    costStreitwert,
    costInstanz,
    costVerfahren,
    costObsiegen,
    costVergleichQuote,
    setCostResult,
    setCostVergleichResult,
    docGenTemplate,
    docGenPartyKlaeger,
    docGenPartyBeklagter,
    docGenGericht,
    docGenAktenzeichen,
    setGeneratedDoc,
    generatedDoc,
    caseDocuments,
    caseFindings,
    caseRecord: caseRecord ?? null,
    latestBlueprint,
    setContradictionMatrix,
    blueprintObjectiveDraft,
    blueprintReviewStatus,
    blueprintReviewNoteDraft,
    taskAssignees,
    setTaskAssignees,
    setEvidenceCount,
    setEvidenceSummaryMarkdown,
    legalAnalysisEndpoint,
    legalAnalysisToken,
    judikaturEndpoint,
    judikaturToken,
    hasStoredOcrToken,
    setHasStoredOcrToken,
    hasStoredLegalAnalysisToken,
    setHasStoredLegalAnalysisToken,
    hasStoredJudikaturToken,
    setHasStoredJudikaturToken,
    legalCopilotWorkflowService,
    legalNormsService,
    contradictionDetectorService,
    costCalculatorService,
    documentGeneratorService,
    evidenceRegisterService,
    providerSettingsService,
    casePlatformOrchestrationService,
    kanzleiDisplayName: kanzleiProfile?.name,
    kanzleiLogoDataUrl: kanzleiProfile?.logoDataUrl,
    anwaltDisplayName: activeAnwaltDisplayName ?? undefined,
    setIngestionStatus,
    setIsWorkflowBusy,
  });

  const onCancelDestructiveAction = onCancelDestructiveActionFromHook;
  const onConfirmDestructiveAction = onConfirmDestructiveActionFromHook;

  const onInferOnboardingMetadata = useCallback(async () => {
    try {
      return await legalCopilotWorkflowService.inferOnboardingMetadata({
        caseId,
        workspaceId,
      });
    } catch {
      setIngestionStatus(
        'Onboarding-Metadaten konnten nicht ermittelt werden.'
      );
      return null;
    }
  }, [caseId, legalCopilotWorkflowService, setIngestionStatus, workspaceId]);

  const onFinalizeOnboarding = useCallback(
    async (input: { reviewConfirmed: boolean; proofNote: string }) => {
      const result = await legalCopilotWorkflowService.finalizeOnboarding({
        caseId,
        workspaceId,
        clientId: selectedClientId || undefined,
        matterId: selectedMatterId || undefined,
        reviewConfirmed: input.reviewConfirmed,
        proofNote: input.proofNote,
      });
      setIngestionStatus(result.message);
      return result;
    },
    [
      caseId,
      legalCopilotWorkflowService,
      selectedClientId,
      selectedMatterId,
      setIngestionStatus,
      workspaceId,
    ]
  );

  const [lastBulkOperation, setLastBulkOperation] =
    useState<BulkOperation | null>(null);

  const currentOpposingParties = useMemo(
    () => caseMatter?.opposingParties ?? [],
    [caseMatter]
  );

  const onAddOpposingParty = useCallback(
    async (
      party: Omit<
        import('@affine/core/modules/case-assistant').OpposingParty,
        'id'
      >
    ) => {
      if (!caseMatter) return;
      const id = `op:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
      const updated = {
        ...caseMatter,
        opposingParties: [
          ...(caseMatter.opposingParties ?? []),
          { id, ...party },
        ],
      };
      await casePlatformOrchestrationService.upsertMatter(updated);
      setIngestionStatus(`Gegenpartei hinzugefügt: ${party.displayName}`);
    },
    [caseMatter, casePlatformOrchestrationService, setIngestionStatus]
  );

  const onUpdateOpposingParty = useCallback(
    async (
      party: import('@affine/core/modules/case-assistant').OpposingParty
    ) => {
      if (!caseMatter) return;
      const updated = {
        ...caseMatter,
        opposingParties: (caseMatter.opposingParties ?? []).map(p =>
          p.id === party.id ? party : p
        ),
      };
      await casePlatformOrchestrationService.upsertMatter(updated);
      setIngestionStatus(`Gegenpartei aktualisiert: ${party.displayName}`);
    },
    [caseMatter, casePlatformOrchestrationService, setIngestionStatus]
  );

  const onRemoveOpposingParty = useCallback(
    async (partyId: string) => {
      if (!caseMatter) return;
      const removed = (caseMatter.opposingParties ?? []).find(
        p => p.id === partyId
      );
      const updated = {
        ...caseMatter,
        opposingParties: (caseMatter.opposingParties ?? []).filter(
          p => p.id !== partyId
        ),
      };
      await casePlatformOrchestrationService.upsertMatter(updated);
      setIngestionStatus(
        `Gegenpartei entfernt: ${removed?.displayName ?? partyId}`
      );
    },
    [caseMatter, casePlatformOrchestrationService, setIngestionStatus]
  );

  const onBulkSendEmails = useCallback(
    async (input: {
      clientIds: string[];
      templateType: EmailTemplateType;
      subject: string;
      bodyTemplate: string;
      templateContext?: {
        fristDatum?: string;
        customFields?: Record<string, string>;
      };
    }) => {
      setIsWorkflowBusy(true);
      try {
        const op = await bulkOperationsService.bulkSendEmails({
          workspaceId,
          clientIds: input.clientIds,
          templateType: input.templateType,
          subject: input.subject,
          bodyTemplate: input.bodyTemplate,
          templateContext: input.templateContext,
          senderName: kanzleiProfile?.name ?? 'Kanzlei',
          senderEmail: kanzleiProfile?.email ?? '',
        });
        setLastBulkOperation(op);
        setIngestionStatus(
          `Bulk-Email: ${op.completedItems}/${op.totalItems} gesendet.`
        );
        return op;
      } finally {
        setIsWorkflowBusy(false);
      }
    },
    [
      bulkOperationsService,
      workspaceId,
      kanzleiProfile,
      setIngestionStatus,
      setIsWorkflowBusy,
    ]
  );

  const onBulkGenerateSchriftsaetze = useCallback(
    async (input: {
      matterIds: string[];
      template: string;
      customFields?: Record<string, string>;
    }) => {
      setIsWorkflowBusy(true);
      try {
        const op = await bulkOperationsService.bulkGenerateSchriftsaetze({
          workspaceId,
          matterIds: input.matterIds,
          template: input.template,
          customFields: input.customFields,
          parties: {
            anwalt: activeAnwaltDisplayName ?? undefined,
            kanzlei: kanzleiProfile?.name,
            logoDataUrl: kanzleiProfile?.logoDataUrl,
          },
        });
        setLastBulkOperation(op);
        setIngestionStatus(
          `Bulk-Schriftsätze: ${op.completedItems}/${op.totalItems} generiert.`
        );
        return op;
      } finally {
        setIsWorkflowBusy(false);
      }
    },
    [
      bulkOperationsService,
      workspaceId,
      anwaelte,
      kanzleiProfile,
      setIngestionStatus,
      setIsWorkflowBusy,
    ]
  );

  const onBulkGenerateMandantenbriefe = useCallback(
    async (input: { matterIds: string[]; sachverhalt?: string }) => {
      setIsWorkflowBusy(true);
      try {
        const op = await bulkOperationsService.bulkGenerateMandantenbriefe({
          workspaceId,
          matterIds: input.matterIds,
          anwalt: activeAnwaltDisplayName ?? undefined,
          kanzlei: kanzleiProfile?.name,
          logoDataUrl: kanzleiProfile?.logoDataUrl,
          sachverhalt: input.sachverhalt,
        });
        setLastBulkOperation(op);
        setIngestionStatus(
          `Bulk-Mandantenbriefe: ${op.completedItems}/${op.totalItems} generiert.`
        );
        return op;
      } finally {
        setIsWorkflowBusy(false);
      }
    },
    [
      bulkOperationsService,
      workspaceId,
      anwaelte,
      kanzleiProfile,
      setIngestionStatus,
      setIsWorkflowBusy,
    ]
  );

  const onBulkUpdateMatterStatus = useCallback(
    async (input: {
      matterIds: string[];
      newStatus: 'open' | 'closed' | 'archived';
    }) => {
      setIsWorkflowBusy(true);
      try {
        const op = await bulkOperationsService.bulkUpdateMatterStatus({
          workspaceId,
          matterIds: input.matterIds,
          newStatus: input.newStatus,
        });
        setLastBulkOperation(op);
        setIngestionStatus(
          `Bulk-Status-Update: ${op.completedItems}/${op.totalItems} Akten aktualisiert.`
        );
        return op;
      } finally {
        setIsWorkflowBusy(false);
      }
    },
    [bulkOperationsService, workspaceId, setIngestionStatus, setIsWorkflowBusy]
  );

  const onBulkPdfExport = useCallback(
    async (input: { matterIds: string[] }) => {
      setIsWorkflowBusy(true);
      try {
        const docs = caseDocuments
          .filter(d => {
            const caseFile = graph?.cases
              ? Object.values(graph.cases).find(c => c.id === d.caseId)
              : undefined;
            return (
              caseFile && input.matterIds.includes(caseFile.matterId ?? '')
            );
          })
          .map(d => ({
            id: d.id,
            title: d.title,
            caseId: d.caseId,
            markdown: d.normalizedText ?? d.rawText,
          }));
        const op = await bulkOperationsService.bulkPdfExport({
          workspaceId,
          matterIds: input.matterIds,
          documents: docs,
        });
        setLastBulkOperation(op);
        setIngestionStatus(
          `Bulk-PDF-Export: ${op.completedItems}/${op.totalItems} Dokumente exportiert.`
        );
        return op;
      } finally {
        setIsWorkflowBusy(false);
      }
    },
    [
      bulkOperationsService,
      workspaceId,
      caseDocuments,
      graph,
      setIngestionStatus,
      setIsWorkflowBusy,
    ]
  );

  const templateOptions = useMemo(
    () => documentGeneratorService.listTemplates(),
    [documentGeneratorService]
  );

  const acceptedWithCitationCount = useMemo(
    () =>
      draftSections.filter(
        s => s.status === 'accepted' && s.citations.length > 0
      ).length,
    [draftSections]
  );

  const acceptedWithoutCitationCount = useMemo(
    () =>
      draftSections.filter(
        s => s.status === 'accepted' && s.citations.length === 0
      ).length,
    [draftSections]
  );

  const auditGateSatisfied = useMemo(
    () => draftReviewStatus === 'approved' && !!draftApprovedHash,
    [draftApprovedHash, draftReviewStatus]
  );

  const isOperationsSectionVisible = useCallback(
    (section: SidebarSectionId) => {
      return !isCopilotVariant && activeSidebarSection === section;
    },
    [activeSidebarSection, isCopilotVariant]
  );

  const isCopilotWorkspaceTabVisible = useCallback(
    (tab: CopilotWorkspaceTab) => {
      return isCopilotVariant && activeCopilotWorkspaceTab === tab;
    },
    [activeCopilotWorkspaceTab, isCopilotVariant]
  );

  const onCopilotWorkspaceTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, tab: CopilotWorkspaceTab) => {
      const index = copilotWorkspaceTabs.indexOf(tab);
      if (index < 0) {
        return;
      }

      let targetIndex = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        targetIndex = (index + 1) % copilotWorkspaceTabs.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        targetIndex =
          (index - 1 + copilotWorkspaceTabs.length) %
          copilotWorkspaceTabs.length;
      } else if (event.key === 'Home') {
        targetIndex = 0;
      } else if (event.key === 'End') {
        targetIndex = copilotWorkspaceTabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      const targetTab = copilotWorkspaceTabs[targetIndex];
      setActiveCopilotWorkspaceTab(targetTab);
      document
        .getElementById(`case-assistant-copilot-workspace-tab-${targetTab}`)
        ?.focus();
    },
    [copilotWorkspaceTabs]
  );

  useEffect(() => {
    if (!isCopilotVariant) {
      return;
    }

    try {
      const storedTab = globalThis.localStorage.getItem(
        copilotWorkspaceStorageKey
      );
      if (
        storedTab &&
        copilotWorkspaceTabs.includes(storedTab as CopilotWorkspaceTab)
      ) {
        setActiveCopilotWorkspaceTab(storedTab as CopilotWorkspaceTab);
      }
    } catch {
      // localStorage can be unavailable in restricted contexts; keep default tab.
    }
  }, [copilotWorkspaceStorageKey, copilotWorkspaceTabs, isCopilotVariant]);

  useEffect(() => {
    if (!isCopilotVariant) {
      return;
    }

    try {
      globalThis.localStorage.setItem(
        copilotWorkspaceStorageKey,
        activeCopilotWorkspaceTab
      );
    } catch {
      // Persistence is best-effort.
    }
  }, [activeCopilotWorkspaceTab, copilotWorkspaceStorageKey, isCopilotVariant]);

  const cockpitSectionRef = useRef<HTMLElement | null>(null);
  const kanzleiSectionRef = useRef<HTMLElement | null>(null);
  const mandantenSectionRef = useRef<HTMLElement | null>(null);
  const queueSectionRef = useRef<HTMLElement | null>(null);
  const automationSectionRef = useRef<HTMLElement | null>(null);
  const legalWorkflowSectionRef = useRef<HTMLElement | null>(null);
  const anwaltsWorkflowSectionRef = useRef<HTMLElement | null>(null);
  const verfahrensstandSectionRef = useRef<HTMLElement | null>(null);
  const copilotSectionRef = useRef<HTMLElement | null>(null);
  const alertsSectionRef = useRef<HTMLElement | null>(null);
  const einstellungenSectionRef = useRef<HTMLElement | null>(null);
  const analyticsSectionRef = useRef<HTMLElement | null>(null);
  const kollisionSectionRef = useRef<HTMLElement | null>(null);
  const fristenkontrolleSectionRef = useRef<HTMLElement | null>(null);
  const rechnungenSectionRef = useRef<HTMLElement | null>(null);
  const gwgComplianceSectionRef = useRef<HTMLElement | null>(null);
  const dsgvoComplianceSectionRef = useRef<HTMLElement | null>(null);
  const documentVersioningSectionRef = useRef<HTMLElement | null>(null);
  const beaPostfachSectionRef = useRef<HTMLElement | null>(null);
  const emailInboxSectionRef = useRef<HTMLElement | null>(null);
  const documentGeneratorSectionRef = useRef<HTMLElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const destructiveDialogCardRef = useRef<HTMLDivElement | null>(null);

  const handlePrepareDeadlineDocument = useCallback(
    (deadline: CaseDeadline) => {
      const template = suggestTemplateForDeadline(deadline);
      setDocGenTemplate(template);

      if (caseMatter?.id) {
        setSelectedDocGenMatterId(caseMatter.id);
        if (!docGenAktenzeichen?.trim() && caseMatter.externalRef) {
          setDocGenAktenzeichen(caseMatter.externalRef);
        }
        if (!docGenGericht?.trim() && caseMatter.gericht) {
          setDocGenGericht(caseMatter.gericht);
        }
        if (
          !docGenPartyBeklagter?.trim() &&
          (caseMatter.opposingParties?.length ?? 0) > 0
        ) {
          setDocGenPartyBeklagter(
            (caseMatter.opposingParties ?? [])
              .map(party => party.displayName)
              .join(', ')
          );
        }
      }

      if (!docGenPartyKlaeger?.trim() && caseClient?.displayName) {
        setDocGenPartyKlaeger(caseClient.displayName);
      }

      setIngestionStatus(
        `Frist erkannt: "${deadline.title}". Vorlage "${template}" wurde vorbereitet – bitte Schriftsatz generieren und bei Bedarf im Copilot-Chat optimieren.`
      );

      documentGeneratorSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    },
    [
      caseClient?.displayName,
      caseMatter,
      docGenAktenzeichen,
      docGenGericht,
      docGenPartyBeklagter,
      docGenPartyKlaeger,
      suggestTemplateForDeadline,
    ]
  );

  const handleOptimizeGeneratedWithCopilot = useCallback(() => {
    if (!generatedDoc) {
      setIngestionStatus(
        'Bitte zuerst ein Dokument generieren, bevor die Copilot-Optimierung startet.'
      );
      return;
    }

    const prompt = [
      `Bitte optimiere den folgenden Entwurf präzise für die Akte "${caseMatter?.title ?? caseId}".`,
      `Vorlage: ${docGenTemplate}`,
      caseMatter?.externalRef ? `Aktenzeichen: ${caseMatter.externalRef}` : '',
      caseMatter?.gericht ? `Gericht: ${caseMatter.gericht}` : '',
      '',
      'Optimierungsziele:',
      '1) juristische Stringenz und konsistente Argumentationskette',
      '2) klare Anträge/Begründung',
      '3) Lücken, Risiken und Gegenargumente markieren',
      '4) konkrete Verbesserungsvorschläge mit finalem überarbeiteten Entwurf',
      '',
      `Entwurfstitel: ${generatedDoc.title}`,
      generatedDoc.markdown.slice(0, 2400),
    ]
      .filter(Boolean)
      .join('\n');

    const params = new URLSearchParams();
    params.set('caCaseId', caseId);
    if (caseMatter?.id) {
      params.set('caMatterId', caseMatter.id);
    }
    if (caseClient?.id) {
      params.set('caClientId', caseClient.id);
    }
    params.set('caPrompt', prompt);

    workbench.open(`/chat?${params.toString()}`);
    setIngestionStatus(
      'Copilot-Optimierung geöffnet: Entwurf wurde als Prompt in den Hauptchat übernommen.'
    );
  }, [
    caseClient?.id,
    caseId,
    caseMatter?.externalRef,
    caseMatter?.gericht,
    caseMatter?.id,
    caseMatter?.title,
    docGenTemplate,
    generatedDoc,
    workbench,
  ]);

  const scrollToSection = useCallback((section: SidebarSectionId) => {
    setActiveSidebarSection(section);
    const sectionRefMap: Record<SidebarSectionId, HTMLElement | null> = {
      cockpit: cockpitSectionRef.current,
      kanzlei: kanzleiSectionRef.current,
      mandanten: mandantenSectionRef.current,
      queue: queueSectionRef.current,
      automation: automationSectionRef.current,
      'legal-workflow': legalWorkflowSectionRef.current,
      'anwalts-workflow': anwaltsWorkflowSectionRef.current,
      verfahrensstand: verfahrensstandSectionRef.current,
      analytics: analyticsSectionRef.current,
      copilot: copilotSectionRef.current,
      alerts: alertsSectionRef.current,
      einstellungen: einstellungenSectionRef.current,
      kollision: kollisionSectionRef.current,
      fristenkontrolle: fristenkontrolleSectionRef.current,
      rechnungen: rechnungenSectionRef.current,
      'gwg-compliance': gwgComplianceSectionRef.current,
      'dsgvo-compliance': dsgvoComplianceSectionRef.current,
      'document-versioning': documentVersioningSectionRef.current,
      'bea-postfach': beaPostfachSectionRef.current,
      'email-inbox': emailInboxSectionRef.current,
    };
    sectionRefMap[section]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  return (
    <div
      ref={panelRootRef}
      className={`${styles.root} ${isCopilotVariant ? styles.rootCopilotOnly : ''}`}
      aria-busy={
        isWorkflowBusy || isIngesting || isRisImporting || isCopilotRunning
      }
    >
      <a href="#case-assistant-main" className={styles.skipLink}>
        Zum Hauptinhalt springen
      </a>
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announceText}
      </div>
      {isCopilotVariant ? (
        <main
          id="case-assistant-main"
          className={styles.copilotMain}
          aria-label="Legal Copilot Hauptarbeitsfläche"
        >
          <section className={styles.section}>
            <div className={styles.headerRow}>
              <h3 className={styles.sectionTitle}>Legal Copilot Workspace</h3>
              <span className={styles.chip}>{activeJurisdiction}</span>
              <span className={styles.chip}>
                Residency: {residencyModeLabel}
              </span>
              <span className={styles.summary}>
                Hauptarbeitsfläche für Chat, Workflow-Steuerung, Mandatsdaten
                und Insights.
              </span>
            </div>
            <div
              className={styles.copilotWorkspaceTabs}
              role="tablist"
              aria-label="Legal Copilot Bereiche"
            >
              <Button
                id="case-assistant-copilot-workspace-tab-workflow"
                role="tab"
                aria-selected={activeCopilotWorkspaceTab === 'workflow'}
                tabIndex={activeCopilotWorkspaceTab === 'workflow' ? 0 : -1}
                variant={
                  activeCopilotWorkspaceTab === 'workflow'
                    ? 'secondary'
                    : 'plain'
                }
                className={styles.copilotWorkspaceTabButton}
                onKeyDown={event =>
                  onCopilotWorkspaceTabKeyDown(event, 'workflow')
                }
                onClick={() => setActiveCopilotWorkspaceTab('workflow')}
              >
                Workflow
              </Button>
              <Button
                id="case-assistant-copilot-workspace-tab-matter"
                role="tab"
                aria-selected={activeCopilotWorkspaceTab === 'matter'}
                tabIndex={activeCopilotWorkspaceTab === 'matter' ? 0 : -1}
                variant={
                  activeCopilotWorkspaceTab === 'matter' ? 'secondary' : 'plain'
                }
                className={styles.copilotWorkspaceTabButton}
                onKeyDown={event =>
                  onCopilotWorkspaceTabKeyDown(event, 'matter')
                }
                onClick={() => setActiveCopilotWorkspaceTab('matter')}
              >
                Akte & Mandant
              </Button>
              <Button
                id="case-assistant-copilot-workspace-tab-insights"
                role="tab"
                aria-selected={activeCopilotWorkspaceTab === 'insights'}
                tabIndex={activeCopilotWorkspaceTab === 'insights' ? 0 : -1}
                variant={
                  activeCopilotWorkspaceTab === 'insights'
                    ? 'secondary'
                    : 'plain'
                }
                className={styles.copilotWorkspaceTabButton}
                onKeyDown={event =>
                  onCopilotWorkspaceTabKeyDown(event, 'insights')
                }
                onClick={() => setActiveCopilotWorkspaceTab('insights')}
              >
                Insights
              </Button>
            </div>
          </section>

          {isCopilotWorkspaceTabVisible('workflow') ? (
            <LegalWorkflowSection
              sectionRef={legalWorkflowSectionRef}
              caseClientName={caseClient?.displayName ?? null}
              caseMatterTitle={caseMatter?.title ?? null}
              caseMatterAuthorityReferences={
                caseMatter?.authorityReferences ?? []
              }
              caseDocuments={caseDocuments}
              caseAuditEntries={auditEntries.filter(
                entry =>
                  entry.workspaceId === workspaceId &&
                  (!entry.caseId || entry.caseId === caseId)
              )}
              caseFindingsCount={caseFindings.length}
              ocrRunningCount={ocrRunningCount}
              ocrFailedCount={ocrFailedCount}
              recommendedMobileActionText={recommendedMobileActionText}
              recommendedMobileAction={recommendedMobileAction}
              canAction={canAction}
              isWorkflowBusy={isWorkflowBusy}
              runAsyncUiAction={runAsyncUiAction}
              onUploadFiles={onUploadFiles}
              onUploadTelemetryAlert={onUploadTelemetryAlert}
              onProcessOcr={onProcessOcr}
              onAnalyzeCase={onAnalyzeCase}
              onRunFullWorkflow={onRunFullWorkflow}
              onRetryFailedDocument={onRetryFailedDocument}
              onRemoveFailedDocument={onRemoveFailedDocument}
              onExportGeneratedDocumentPdf={onExportGeneratedDocumentPdf}
              generatedDoc={generatedDoc}
              folderQuery={folderQuery}
              setFolderQuery={setFolderQuery}
              ocrEndpoint={ocrEndpoint}
              setOcrEndpoint={setOcrEndpoint}
              ocrToken={ocrToken}
              setOcrToken={setOcrToken}
              hasStoredOcrToken={hasStoredOcrToken}
              onFolderSearch={onFolderSearch}
              onFolderSummarize={onFolderSummarize}
              onSaveOcrProviderSettings={onSaveOcrProviderSettings}
            />
          ) : null}

          {isCopilotWorkspaceTabVisible('matter') ? (
            <>
              <ClientMatterSection
                caseClient={caseClient}
                caseMatter={caseMatter}
                canAction={canAction}
                runAsyncUiAction={runAsyncUiAction}
                clientDraftName={clientDraftName}
                setClientDraftName={setClientDraftName}
                clientDraftKind={clientDraftKind}
                setClientDraftKind={setClientDraftKind}
                clientDraftEmail={clientDraftEmail}
                setClientDraftEmail={setClientDraftEmail}
                clientDraftPhone={clientDraftPhone}
                setClientDraftPhone={setClientDraftPhone}
                clientDraftAddress={clientDraftAddress}
                setClientDraftAddress={setClientDraftAddress}
                clientDraftTags={clientDraftTags}
                setClientDraftTags={setClientDraftTags}
                clientDraftNotes={clientDraftNotes}
                setClientDraftNotes={setClientDraftNotes}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
                visibleClients={visibleClients}
                clientSearchQuery={clientSearchQuery}
                setClientSearchQuery={setClientSearchQuery}
                undoClientSnapshot={undoClientSnapshot}
                showArchivedClients={showArchivedClients}
                setShowArchivedClients={setShowArchivedClients}
                onCreateClient={onCreateClient}
                onAssignClientToCase={onAssignClientToCase}
                onRequestArchiveSelectedClient={onRequestArchiveSelectedClient}
                onRequestDeleteSelectedClient={onRequestDeleteSelectedClient}
                onUndoClientAction={() => {
                  onUndoClientAction().catch(() => {
                    // handled in onUndoClientAction
                  });
                }}
                matterDraftTitle={matterDraftTitle}
                setMatterDraftTitle={setMatterDraftTitle}
                matterDraftStatus={matterDraftStatus}
                setMatterDraftStatus={setMatterDraftStatus}
                matterDraftJurisdiction={matterDraftJurisdiction}
                setMatterDraftJurisdiction={setMatterDraftJurisdiction}
                matterDraftExternalRef={matterDraftExternalRef}
                setMatterDraftExternalRef={setMatterDraftExternalRef}
                matterDraftAuthorityReferences={matterDraftAuthorityReferences}
                setMatterDraftAuthorityReferences={
                  setMatterDraftAuthorityReferences
                }
                matterDraftGericht={matterDraftGericht}
                setMatterDraftGericht={setMatterDraftGericht}
                matterDraftTags={matterDraftTags}
                setMatterDraftTags={setMatterDraftTags}
                matterDraftDescription={matterDraftDescription}
                setMatterDraftDescription={setMatterDraftDescription}
                matterSearchQuery={matterSearchQuery}
                setMatterSearchQuery={setMatterSearchQuery}
                selectedMatterId={selectedMatterId}
                setSelectedMatterId={setSelectedMatterId}
                visibleMatters={visibleMatters}
                undoMatterSnapshot={undoMatterSnapshot}
                onCreateMatter={onCreateMatter}
                onAssignMatterToCase={onAssignMatterToCase}
                onRequestDeleteSelectedMatter={onRequestDeleteSelectedMatter}
                onRequestArchiveSelectedMatter={onRequestArchiveSelectedMatter}
                onUndoMatterAction={() => {
                  onUndoMatterAction().catch(() => {
                    // handled in onUndoMatterAction
                  });
                }}
                activeAnwaelte={anwaelte.filter(a => a.isActive)}
                matterDraftAssignedAnwaltId={matterDraftAssignedAnwaltId}
                setMatterDraftAssignedAnwaltId={setMatterDraftAssignedAnwaltId}
                onGenerateNextAktenzeichen={
                  kanzleiProfile
                    ? () => {
                        return onGenerateNextAktenzeichen().catch(() => {
                          // handled in onGenerateNextAktenzeichen
                        });
                      }
                    : undefined
                }
              />
              <MandantenSection
                sectionRef={mandantenSectionRef}
                clients={clients}
                matters={matters}
                cases={Object.values(graph?.cases ?? {})}
                legalDocuments={legalDocuments}
                legalFindings={legalFindings}
                vollmachten={vollmachten}
                vollmachtSigningRequests={vollmachtSigningRequests}
                auditEntries={auditEntries}
                workspace={workspaceService.workspace}
                activeAnwaltId={activeAnwalt?.id ?? null}
                activeAnwaltName={activeAnwaltDisplayName ?? null}
                kanzleiName={kanzleiProfile?.name ?? null}
                getGwgOnboardingForClient={getGwgOnboardingForClient}
                onRequestGeneralVollmacht={handleRequestGeneralVollmacht}
                onDecideVollmachtSigningRequest={
                  handleDecideVollmachtSigningRequest
                }
                onStartGwgOnboarding={handleStartGwgOnboarding}
                clientSearchQuery={clientSearchQuery}
                setClientSearchQuery={setClientSearchQuery}
                showArchivedClients={showArchivedClients}
                setShowArchivedClients={setShowArchivedClients}
                canAction={canAction}
                runAsyncUiAction={runAsyncUiAction}
                onSelectMatter={handleMatterSelect}
                highlightMatterId={selectedMatterId || undefined}
                anwaelteById={anwaelteByIdMap}
              />
            </>
          ) : null}

          {isCopilotWorkspaceTabVisible('insights') ? (
            <>
              <CaseInsightsSection
                caseDocuments={caseDocuments}
                caseOcrJobs={caseOcrJobs}
                caseFindings={caseFindings}
                caseTaskList={caseTaskList}
                citationBackedFindingCount={citationBackedFindingCount}
                folderSearchCount={folderSearchCount}
                latestCopilotRun={latestCopilotRun}
                latestBlueprint={latestBlueprint}
                normAnalysis={normAnalysis}
                formatSecretUpdatedAt={formatSecretUpdatedAt}
              />
              <IntakeChecklistSection
                documents={caseDocuments}
                qualityReports={qualityReports.filter(
                  r => r.caseId === caseId && r.workspaceId === workspaceId
                )}
              />
              <TaskBoardSection
                caseTaskList={caseTaskList}
                taskAssignees={taskAssignees}
                canAction={canAction}
                isWorkflowBusy={isWorkflowBusy}
                onTaskAssigneeChange={onTaskAssigneeChange}
                onUpdateTaskStatus={onUpdateTaskStatus}
                runAsyncUiAction={runAsyncUiAction}
              />
              <AktenauditSection auditResult={caseAuditResult} />
            </>
          ) : null}
        </main>
      ) : null}
      {!isCopilotVariant ? (
        <>
          <aside
            className={`${styles.leftRail} ${styles.railStack}`}
            aria-label="Case cockpit rail"
          >
            <SidebarLinksSection
              onScrollToSection={scrollToSection}
              activeSection={activeSidebarSection}
              variant="operations"
            />
          </aside>

          <main
            id="case-assistant-main"
            className={`${styles.centerRail} ${styles.railStack}`}
            aria-label="Connector and queue operations"
          >
            {/* ── Breadcrumb Navigation ── */}
            <nav aria-label="Breadcrumb" className={styles.breadcrumbNav}>
              <button
                type="button"
                onClick={() => scrollToSection('kanzlei')}
                className={styles.breadcrumbLink}
              >
                {kanzleiProfile?.name ?? 'Kanzlei'}
              </button>
              {caseClient ? (
                <>
                  <span className={styles.breadcrumbDivider} aria-hidden="true">
                    /
                  </span>
                  <button
                    type="button"
                    onClick={() => scrollToSection('mandanten')}
                    className={styles.breadcrumbLink}
                  >
                    {caseClient.displayName}
                  </button>
                </>
              ) : null}
              {caseMatter ? (
                <>
                  <span className={styles.breadcrumbDivider} aria-hidden="true">
                    /
                  </span>
                  <span className={styles.breadcrumbCurrent}>
                    {caseMatter.title}
                    {caseMatter.externalRef
                      ? ` (${caseMatter.externalRef})`
                      : ''}
                  </span>
                </>
              ) : null}
            </nav>

            {isOperationsSectionVisible('cockpit') ? (
              <>
                <CockpitSection
                  sectionRef={cockpitSectionRef}
                  currentMatter={currentMatter}
                  matterOptions={matterOptions}
                  clientsById={clientsById}
                  matterSearchQuery={matterSearchQuery}
                  onMatterSearchQueryChange={setMatterSearchQuery}
                  showArchivedMatters={showArchivedMatters}
                  onToggleArchivedMatters={handleToggleArchivedMatters}
                  currentClient={currentClient}
                  ingestionMode={ingestionMode}
                  isIngesting={isIngesting}
                  onIngestionModeChange={setIngestionMode}
                  onQuickIngest={handleQuickIngestClick}
                  onSelectMatter={handleMatterSelect}
                  cockpit={cockpit}
                  caseDeadlines={caseDeadlines}
                  onPrepareDeadlineDocument={handlePrepareDeadlineDocument}
                  ingestionStatus={ingestionStatus}
                  statusTone={statusTone}
                  canAction={canAction}
                  runAsyncUiAction={runAsyncUiAction}
                />
                <section
                  className={`${styles.section} ${styles.centeredSection}`}
                >
                  <div className={styles.warningBanner}>
                    <strong>Start-Empfehlung:</strong> Laden Sie zuerst alle
                    Aktenunterlagen hoch — die Pipeline extrahiert Mandant/Akte,
                    führt OCR aus und analysiert automatisch.
                  </div>
                  <div className={styles.onboardingButtonRow}>
                    <button
                      type="button"
                      data-testid="case-assistant:onboarding-wizard:open"
                      onClick={() => {
                        setIsOnboardingWizardOpen(true);
                      }}
                      className={styles.onboardingButton}
                    >
                      Mit Dokumenten starten (KI extrahiert zuerst)
                    </button>
                  </div>
                </section>
              </>
            ) : null}

            {isOperationsSectionVisible('kanzlei') ? (
              <KanzleiProfileSection
                sectionRef={kanzleiSectionRef}
                kanzleiProfile={kanzleiProfile}
                anwaelte={anwaelte}
                linkedWorkspaceUsers={linkedWorkspaceUsers}
                canAction={canAction}
                runAsyncUiAction={runAsyncUiAction}
                onSaveKanzleiProfile={onSaveKanzleiProfile}
                onSaveAnwalt={onSaveAnwalt}
                onDeactivateAnwalt={onDeactivateAnwalt}
              />
            ) : null}

            {isOperationsSectionVisible('queue') ? (
              <QueueSection
                sectionRef={queueSectionRef}
                caseJobs={caseJobs}
                canAction={canAction}
                runAsyncUiAction={runAsyncUiAction}
                onCancelJob={onCancelJob}
                onRetryJob={onRetryJob}
                onDeleteJob={onDeleteJob}
                onClearJobHistory={onClearJobHistory}
                onRestoreJob={onRestoreJob}
                onRestoreJobHistory={onRestoreJobHistory}
              />
            ) : null}

            {isOperationsSectionVisible('automation') ? (
              <>
                <section ref={automationSectionRef} className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    🔄 Workflow-Automation
                  </h3>
                  <p className={styles.summary}>
                    Dokumenten-Intake, OCR-Verarbeitung und KI-Vollworkflow —
                    vollständig automatisiert mit Audit-Trail und
                    Qualitätssicherung.
                  </p>
                </section>

                <LegalWorkflowSection
                  sectionRef={legalWorkflowSectionRef}
                  caseClientName={caseClient?.displayName ?? null}
                  caseMatterTitle={caseMatter?.title ?? null}
                  caseMatterAuthorityReferences={
                    caseMatter?.authorityReferences ?? []
                  }
                  caseDocuments={caseDocuments}
                  caseAuditEntries={auditEntries.filter(
                    entry =>
                      entry.workspaceId === workspaceId &&
                      (!entry.caseId || entry.caseId === caseId)
                  )}
                  caseFindingsCount={caseFindings.length}
                  ocrRunningCount={ocrRunningCount}
                  ocrFailedCount={ocrFailedCount}
                  recommendedMobileActionText={recommendedMobileActionText}
                  recommendedMobileAction={recommendedMobileAction}
                  canAction={canAction}
                  isWorkflowBusy={isWorkflowBusy}
                  runAsyncUiAction={runAsyncUiAction}
                  onUploadFiles={onUploadFiles}
                  onUploadTelemetryAlert={onUploadTelemetryAlert}
                  onProcessOcr={onProcessOcr}
                  onAnalyzeCase={onAnalyzeCase}
                  onRunFullWorkflow={onRunFullWorkflow}
                  onRetryFailedDocument={onRetryFailedDocument}
                  onRemoveFailedDocument={onRemoveFailedDocument}
                  onExportGeneratedDocumentPdf={onExportGeneratedDocumentPdf}
                  generatedDoc={generatedDoc}
                  folderQuery={folderQuery}
                  setFolderQuery={setFolderQuery}
                  ocrEndpoint={ocrEndpoint}
                  setOcrEndpoint={setOcrEndpoint}
                  ocrToken={ocrToken}
                  setOcrToken={setOcrToken}
                  hasStoredOcrToken={hasStoredOcrToken}
                  pipelineProgress={pipelineProgress}
                  onFolderSearch={onFolderSearch}
                  onFolderSummarize={onFolderSummarize}
                  onSaveOcrProviderSettings={onSaveOcrProviderSettings}
                />
              </>
            ) : null}

            {isOperationsSectionVisible('legal-workflow') ? (
              <>
                <CaseFactSheetSection
                  clientName={caseClient?.displayName ?? null}
                  matter={caseMatter ?? null}
                  anwaltName={activeAnwaltDisplayName}
                  opposingParties={caseMatter?.opposingParties ?? []}
                  actors={caseActors}
                  deadlines={caseDeadlines}
                  issues={caseIssues}
                  findings={caseFindings}
                  tasks={caseTaskList}
                  documents={caseDocuments}
                  normReferences={caseNormReferences}
                  caseSummary={caseRecord?.summary ?? null}
                />

                <IntakeChecklistSection
                  documents={caseDocuments}
                  qualityReports={qualityReports.filter(
                    r => r.caseId === caseId && r.workspaceId === workspaceId
                  )}
                />

                <CaseInsightsSection
                  caseDocuments={caseDocuments}
                  caseOcrJobs={caseOcrJobs}
                  caseFindings={caseFindings}
                  caseTaskList={caseTaskList}
                  citationBackedFindingCount={citationBackedFindingCount}
                  folderSearchCount={folderSearchCount}
                  latestCopilotRun={latestCopilotRun}
                  latestBlueprint={latestBlueprint}
                  normAnalysis={normAnalysis}
                  formatSecretUpdatedAt={formatSecretUpdatedAt}
                />

                <AktenauditSection auditResult={caseAuditResult} />

                <TaskBoardSection
                  caseTaskList={caseTaskList}
                  taskAssignees={taskAssignees}
                  canAction={canAction}
                  isWorkflowBusy={isWorkflowBusy}
                  onTaskAssigneeChange={onTaskAssigneeChange}
                  onUpdateTaskStatus={onUpdateTaskStatus}
                  runAsyncUiAction={runAsyncUiAction}
                />

                <div className={styles.blueprintEditor}>
                  <div className={styles.headerRow}>
                    <h4 className={styles.sectionTitle}>
                      ⚖️ Juristische Werkzeuge
                    </h4>
                  </div>

                  <ClientMatterSection
                    caseClient={caseClient}
                    caseMatter={caseMatter}
                    canAction={canAction}
                    runAsyncUiAction={runAsyncUiAction}
                    clientDraftName={clientDraftName}
                    setClientDraftName={setClientDraftName}
                    clientDraftKind={clientDraftKind}
                    setClientDraftKind={setClientDraftKind}
                    clientDraftEmail={clientDraftEmail}
                    setClientDraftEmail={setClientDraftEmail}
                    clientDraftPhone={clientDraftPhone}
                    setClientDraftPhone={setClientDraftPhone}
                    clientDraftAddress={clientDraftAddress}
                    setClientDraftAddress={setClientDraftAddress}
                    clientDraftTags={clientDraftTags}
                    setClientDraftTags={setClientDraftTags}
                    clientDraftNotes={clientDraftNotes}
                    setClientDraftNotes={setClientDraftNotes}
                    selectedClientId={selectedClientId}
                    setSelectedClientId={setSelectedClientId}
                    visibleClients={visibleClients}
                    clientSearchQuery={clientSearchQuery}
                    setClientSearchQuery={setClientSearchQuery}
                    undoClientSnapshot={undoClientSnapshot}
                    showArchivedClients={showArchivedClients}
                    setShowArchivedClients={setShowArchivedClients}
                    onCreateClient={onCreateClient}
                    onAssignClientToCase={onAssignClientToCase}
                    onRequestArchiveSelectedClient={
                      onRequestArchiveSelectedClient
                    }
                    onRequestDeleteSelectedClient={
                      onRequestDeleteSelectedClient
                    }
                    onUndoClientAction={() => {
                      onUndoClientAction().catch(() => {
                        // handled in onUndoClientAction
                      });
                    }}
                    matterDraftTitle={matterDraftTitle}
                    setMatterDraftTitle={setMatterDraftTitle}
                    matterDraftStatus={matterDraftStatus}
                    setMatterDraftStatus={setMatterDraftStatus}
                    matterDraftJurisdiction={matterDraftJurisdiction}
                    setMatterDraftJurisdiction={setMatterDraftJurisdiction}
                    matterDraftExternalRef={matterDraftExternalRef}
                    setMatterDraftExternalRef={setMatterDraftExternalRef}
                    matterDraftAuthorityReferences={
                      matterDraftAuthorityReferences
                    }
                    setMatterDraftAuthorityReferences={
                      setMatterDraftAuthorityReferences
                    }
                    matterDraftGericht={matterDraftGericht}
                    setMatterDraftGericht={setMatterDraftGericht}
                    matterDraftTags={matterDraftTags}
                    setMatterDraftTags={setMatterDraftTags}
                    matterDraftDescription={matterDraftDescription}
                    setMatterDraftDescription={setMatterDraftDescription}
                    matterSearchQuery={matterSearchQuery}
                    setMatterSearchQuery={setMatterSearchQuery}
                    selectedMatterId={selectedMatterId}
                    setSelectedMatterId={setSelectedMatterId}
                    visibleMatters={visibleMatters}
                    undoMatterSnapshot={undoMatterSnapshot}
                    onCreateMatter={onCreateMatter}
                    onAssignMatterToCase={onAssignMatterToCase}
                    onRequestDeleteSelectedMatter={
                      onRequestDeleteSelectedMatter
                    }
                    onRequestArchiveSelectedMatter={
                      onRequestArchiveSelectedMatter
                    }
                    onUndoMatterAction={() => {
                      onUndoMatterAction().catch(() => {
                        // handled in onUndoMatterAction
                      });
                    }}
                    activeAnwaelte={anwaelte.filter(a => a.isActive)}
                    matterDraftAssignedAnwaltId={matterDraftAssignedAnwaltId}
                    setMatterDraftAssignedAnwaltId={
                      setMatterDraftAssignedAnwaltId
                    }
                    onGenerateNextAktenzeichen={
                      kanzleiProfile
                        ? () => {
                            return onGenerateNextAktenzeichen().catch(() => {
                              // handled in onGenerateNextAktenzeichen
                            });
                          }
                        : undefined
                    }
                  />

                  <NormSearchSection
                    normSearchQuery={normSearchQuery}
                    setNormSearchQuery={setNormSearchQuery}
                    onSearchNorms={onSearchNorms}
                    runAsyncUiAction={runAsyncUiAction}
                    normSearchResults={normSearchResults}
                  />

                  <ProviderSettingsSection
                    legalAnalysisEndpoint={legalAnalysisEndpoint}
                    setLegalAnalysisEndpoint={setLegalAnalysisEndpoint}
                    legalAnalysisToken={legalAnalysisToken}
                    setLegalAnalysisToken={setLegalAnalysisToken}
                    judikaturEndpoint={judikaturEndpoint}
                    setJudikaturEndpoint={setJudikaturEndpoint}
                    judikaturToken={judikaturToken}
                    setJudikaturToken={setJudikaturToken}
                    onSaveLegalProviderSettings={onSaveLegalProviderSettings}
                    runAsyncUiAction={runAsyncUiAction}
                  />

                  <JudikaturSection
                    activeJurisdiction={activeJurisdiction}
                    canExecuteCopilot={canAction('copilot.execute')}
                    isWorkflowBusy={isWorkflowBusy}
                    runAsyncUiAction={runAsyncUiAction}
                    ingestionStatusSetter={setIngestionStatus}
                    risImportFromDate={risImportFromDate}
                    setRisImportFromDate={setRisImportFromDate}
                    risImportToDate={risImportToDate}
                    setRisImportToDate={setRisImportToDate}
                    risImportMaxResults={risImportMaxResults}
                    setRisImportMaxResults={setRisImportMaxResults}
                    risImportValidationError={risImportValidationError}
                    isRisImporting={isRisImporting}
                    onImportRecentRisDecisions={onImportRecentRisDecisions}
                    bghImportFromDate={bghImportFromDate}
                    setBghImportFromDate={setBghImportFromDate}
                    bghImportToDate={bghImportToDate}
                    setBghImportToDate={setBghImportToDate}
                    bghImportMaxResults={bghImportMaxResults}
                    setBghImportMaxResults={setBghImportMaxResults}
                    isBghImporting={isBghImporting}
                    onImportRecentBghDecisions={onImportRecentBghDecisions}
                    hudocRespondentState={hudocRespondentState}
                    setHudocRespondentState={setHudocRespondentState}
                    hudocImportFromDate={hudocImportFromDate}
                    setHudocImportFromDate={setHudocImportFromDate}
                    hudocImportToDate={hudocImportToDate}
                    setHudocImportToDate={setHudocImportToDate}
                    hudocImportMaxResults={hudocImportMaxResults}
                    setHudocImportMaxResults={setHudocImportMaxResults}
                    isHudocImporting={isHudocImporting}
                    onImportRecentHudocDecisions={onImportRecentHudocDecisions}
                    judikaturQuery={judikaturQuery}
                    setJudikaturQuery={setJudikaturQuery}
                    onSearchJudikatur={onSearchJudikatur}
                    judikaturResults={judikaturResults}
                    onInsertJudikaturCitation={onInsertJudikaturCitation}
                  />

                  <ContradictionSection
                    caseDocumentsCount={caseDocuments.length}
                    isWorkflowBusy={isWorkflowBusy}
                    onRunContradictionAnalysis={onRunContradictionAnalysis}
                    runAsyncUiAction={runAsyncUiAction}
                    contradictionMatrix={contradictionMatrix}
                  />

                  <CostCalculatorSection
                    costStreitwert={costStreitwert}
                    setCostStreitwert={setCostStreitwert}
                    costInstanz={costInstanz}
                    setCostInstanz={setCostInstanz}
                    costVerfahren={costVerfahren}
                    setCostVerfahren={setCostVerfahren}
                    costObsiegen={costObsiegen}
                    setCostObsiegen={setCostObsiegen}
                    costVergleichQuote={costVergleichQuote}
                    setCostVergleichQuote={setCostVergleichQuote}
                    onCalculateCosts={onCalculateCosts}
                    onCalculateVergleich={onCalculateVergleich}
                    runAsyncUiAction={runAsyncUiAction}
                    costResult={costResult}
                    costVergleichResult={costVergleichResult}
                  />

                  <section ref={documentGeneratorSectionRef}>
                    <DocumentGeneratorSection
                      templateOptions={templateOptions}
                      docGenTemplate={docGenTemplate}
                      setDocGenTemplate={setDocGenTemplate}
                      docGenPartyKlaeger={docGenPartyKlaeger}
                      setDocGenPartyKlaeger={setDocGenPartyKlaeger}
                      docGenPartyBeklagter={docGenPartyBeklagter}
                      setDocGenPartyBeklagter={setDocGenPartyBeklagter}
                      docGenGericht={docGenGericht}
                      setDocGenGericht={setDocGenGericht}
                      docGenAktenzeichen={docGenAktenzeichen}
                      setDocGenAktenzeichen={setDocGenAktenzeichen}
                      onGenerateDocument={onGenerateDocument}
                      onExportGeneratedDocumentPdf={
                        onExportGeneratedDocumentPdf
                      }
                      generatedDoc={generatedDoc}
                      runAsyncUiAction={runAsyncUiAction}
                      onInsertGeneratedDocumentIntoCurrentDoc={
                        onInsertGeneratedDocumentIntoCurrentDoc
                      }
                      onOptimizeWithCopilot={handleOptimizeGeneratedWithCopilot}
                      matters={matters}
                      clients={clients}
                      clientsById={clientsById}
                      selectedDocGenMatterId={selectedDocGenMatterId}
                      setSelectedDocGenMatterId={setSelectedDocGenMatterId}
                      currentMatter={caseMatter}
                      currentClient={caseClient}
                      anwaltDisplayName={activeAnwaltDisplayName ?? undefined}
                      kanzleiName={kanzleiProfile?.name ?? undefined}
                    />
                  </section>

                  <EvidenceSection
                    caseDocumentsCount={caseDocuments.length}
                    isWorkflowBusy={isWorkflowBusy}
                    onAutoDetectEvidence={onAutoDetectEvidence}
                    runAsyncUiAction={runAsyncUiAction}
                    evidenceCount={evidenceCount}
                    evidenceSummaryMarkdown={evidenceSummaryMarkdown}
                    evidenceItems={evidenceRegisterService.getAll(caseId)}
                    evidenceGaps={evidenceRegisterService.analyzeLuecken(
                      caseId
                    )}
                  />

                  <OpposingPartySection
                    opposingParties={currentOpposingParties}
                    canAction={canAction}
                    isWorkflowBusy={isWorkflowBusy}
                    runAsyncUiAction={runAsyncUiAction}
                    onAddOpposingParty={onAddOpposingParty}
                    onUpdateOpposingParty={onUpdateOpposingParty}
                    onRemoveOpposingParty={onRemoveOpposingParty}
                  />

                  <BulkOperationsSection
                    clients={clients}
                    matters={matters}
                    clientsById={clientsById}
                    canAction={canAction}
                    isWorkflowBusy={isWorkflowBusy}
                    runAsyncUiAction={runAsyncUiAction}
                    onBulkSendEmails={onBulkSendEmails}
                    onBulkGenerateSchriftsaetze={onBulkGenerateSchriftsaetze}
                    onBulkGenerateMandantenbriefe={
                      onBulkGenerateMandantenbriefe
                    }
                    onBulkUpdateMatterStatus={onBulkUpdateMatterStatus}
                    onBulkPdfExport={onBulkPdfExport}
                    lastBulkOperation={lastBulkOperation}
                    kanzleiName={kanzleiProfile?.name}
                    anwaltName={activeAnwaltDisplayName ?? undefined}
                  />
                </div>

                <BlueprintReviewSection
                  latestBlueprint={latestBlueprint}
                  blueprintObjectiveDraft={blueprintObjectiveDraft}
                  setBlueprintObjectiveDraft={setBlueprintObjectiveDraft}
                  blueprintReviewStatus={blueprintReviewStatus}
                  setBlueprintReviewStatus={setBlueprintReviewStatus}
                  blueprintReviewNoteDraft={blueprintReviewNoteDraft}
                  setBlueprintReviewNoteDraft={setBlueprintReviewNoteDraft}
                  canManageBlueprint={canAction('blueprint.manage')}
                  isWorkflowBusy={isWorkflowBusy}
                  runAsyncUiAction={runAsyncUiAction}
                  onSaveBlueprintReview={onSaveBlueprintReview}
                />
              </>
            ) : null}

            {isOperationsSectionVisible('anwalts-workflow') ? (
              <>
                <section
                  ref={anwaltsWorkflowSectionRef}
                  className={styles.section}
                >
                  <div className={styles.headerRow}>
                    <h3 className={styles.sectionTitle}>🧾 Anwalts-Workflow</h3>
                    <span className={styles.chip}>
                      Residency: {residencyModeLabel}
                    </span>
                  </div>
                  <p className={styles.summary}>
                    Operative Bearbeitung für Wiedervorlagen, Aktennotizen,
                    Vollmachten und Zeiterfassung in einer klaren,
                    mandatsbezogenen Arbeitsfläche.
                  </p>
                </section>

                <AnwaltsWorkflowSection
                  workspaceId={workspaceId}
                  caseId={caseId}
                  matterId={caseMatter?.id}
                  clientId={caseClient?.id}
                  anwaltId={activeAnwalt?.id}
                  caseClientName={caseClient?.displayName ?? null}
                  activeAnwaltName={activeAnwaltDisplayName ?? null}
                  opposingPartyNames={(caseMatter?.opposingParties ?? []).map(
                    p => p.displayName
                  )}
                  initialTab={initialAnwaltsWorkflowTab}
                  highlightedDeadlineId={initialDeadlineId}
                />
              </>
            ) : null}

            {isOperationsSectionVisible('verfahrensstand') ? (
              <>
                <section
                  ref={verfahrensstandSectionRef}
                  className={styles.section}
                >
                  <h3 className={styles.sectionTitle}>🏛️ Verfahrensstand</h3>
                  <p className={styles.summary}>
                    Phasen- und Instanzsteuerung je Akte inklusive aktueller
                    Lage und Historie.
                  </p>
                </section>

                <VerfahrensstandSection
                  workspaceId={workspaceId}
                  caseId={caseId}
                  matterId={caseMatter?.id}
                />
              </>
            ) : null}

            {isOperationsSectionVisible('kollision') ? (
              <KollisionsPruefungSection
                sectionRef={kollisionSectionRef}
                workspaceId={workspaceId}
                caseId={caseId}
                matterId={caseMatter?.id}
                anwaltId={caseMatter?.assignedAnwaltId}
              />
            ) : null}

            {isOperationsSectionVisible('analytics') ? (
              <AnalyticsDashboardSection
                sectionRef={analyticsSectionRef}
                kpis={analyticsKpis}
                selectedPeriod={analyticsPeriod}
                onPeriodChange={setAnalyticsPeriod}
                dailyMetrics={analyticsDailyMetrics}
                errorGroups={analyticsErrorGroups}
                onResolveError={onResolveAnalyticsError}
                onUnresolveError={onUnresolveAnalyticsError}
                coreWebVitals={analyticsCoreWebVitals}
                avgLoadTime={analyticsAvgLoadTime}
                geoDistribution={analyticsGeoDistribution}
                deviceBreakdown={analyticsDeviceBreakdown}
                browserBreakdown={analyticsBrowserBreakdown}
                topReferrers={analyticsTopReferrers}
                sessionsByHour={analyticsSessionsByHour}
                featureUsage={analyticsFeatureUsage}
                customerHealth={analyticsCustomerHealth}
                healthSummary={analyticsHealthSummary}
                onAcknowledgeAlert={onAcknowledgeHealthAlert}
                retentionCohorts={analyticsRetentionCohorts}
                supportStatusSnapshot={supportStatusSnapshot}
                supportIncidents={supportIncidents}
                supportAlerts={supportAlerts}
                supportAuditTrail={supportAuditTrail}
                supportRetentionPolicy={supportRetentionPolicy}
                supportEscalationPolicy={supportEscalationPolicy}
                supportOpsError={supportOpsError}
                isSavingSupportRetention={isSavingSupportRetention}
                isSavingSupportEscalation={isSavingSupportEscalation}
                onSaveSupportRetentionPolicy={updateSupportRetentionPolicy}
                onSaveSupportEscalationPolicy={updateSupportEscalationPolicy}
                onRefreshDashboard={() => {
                  refreshAnalyticsDashboard().catch((error: unknown) => {
                    console.warn(
                      '[case-assistant] manual analytics refresh failed',
                      error
                    );
                  });
                }}
                isRefreshing={isAnalyticsRefreshing}
              />
            ) : null}

            {isOperationsSectionVisible('alerts') ? (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>🔔 Fristen-Alerts</h3>
                <p className={styles.summary}>
                  Die Fristen-Alerts befinden sich in der rechten Spalte. Dort
                  können aktive Fristen priorisiert gefiltert, bestätigt und
                  verwaltet werden.
                </p>
              </section>
            ) : null}

            {isOperationsSectionVisible('mandanten') ? (
              <MandantenSection
                sectionRef={mandantenSectionRef}
                clients={clients}
                matters={matters}
                cases={Object.values(graph?.cases ?? {})}
                legalDocuments={legalDocuments}
                legalFindings={legalFindings}
                vollmachten={vollmachten}
                vollmachtSigningRequests={vollmachtSigningRequests}
                auditEntries={auditEntries}
                workspace={workspaceService.workspace}
                activeAnwaltId={activeAnwalt?.id ?? null}
                activeAnwaltName={activeAnwaltDisplayName ?? null}
                kanzleiName={kanzleiProfile?.name ?? null}
                getGwgOnboardingForClient={getGwgOnboardingForClient}
                onRequestGeneralVollmacht={handleRequestGeneralVollmacht}
                onDecideVollmachtSigningRequest={
                  handleDecideVollmachtSigningRequest
                }
                onStartGwgOnboarding={handleStartGwgOnboarding}
                clientSearchQuery={clientSearchQuery}
                setClientSearchQuery={setClientSearchQuery}
                showArchivedClients={showArchivedClients}
                setShowArchivedClients={setShowArchivedClients}
                canAction={canAction}
                runAsyncUiAction={runAsyncUiAction}
                onSelectMatter={handleMatterSelect}
                highlightMatterId={selectedMatterId || undefined}
                anwaelteById={anwaelteByIdMap}
              />
            ) : null}

            {isOperationsSectionVisible('einstellungen') ? (
              <EinstellungenSection
                sectionRef={einstellungenSectionRef}
                currentRole={currentRole}
                onRoleChange={handleRoleChange}
                currentJurisdiction={activeJurisdiction}
                onJurisdictionChange={handleJurisdictionChange}
                jurisdictionOptions={jurisdictionOptions}
                themeMode={activeThemeMode}
                onThemeModeChange={mode => {
                  setTheme(mode);
                }}
                residencyPolicyDraft={residencyPolicyDraft}
                onResidencyPolicyDraftChange={onResidencyPolicyDraftChange}
                onSaveResidencyPolicy={onSaveResidencyPolicy}
                connectorCards={connectorCards}
                connectorDrafts={connectorDrafts}
                canAction={canAction}
                runAsyncUiAction={runAsyncUiAction}
                onConnectorDraftChange={onConnectorDraftChange}
                onRotateConnectorCredential={onRotateConnectorCredential}
                onSaveConnectorSettings={onSaveConnectorSettings}
                onToggleConnector={onToggleConnector}
                onHealthcheckConnector={onHealthcheckConnector}
                onClearConnectorCredential={onClearConnectorCredential}
                formatSecretUpdatedAt={formatSecretUpdatedAt}
                normalizeRotationMode={normalizeRotationMode}
                ingestionStatus={ingestionStatus}
                statusTone={statusTone}
              />
            ) : null}

            {isOperationsSectionVisible('fristenkontrolle') ? (
              <section
                ref={fristenkontrolleSectionRef}
                className={styles.section}
              >
                <FristenkontrolleSection
                  currentUserId={caseId}
                  currentUserName={title}
                />
              </section>
            ) : null}

            {isOperationsSectionVisible('rechnungen') ? (
              <section ref={rechnungenSectionRef} className={styles.section}>
                <RechnungSection
                  workspaceId={workspaceId}
                  matterId={selectedMatterId ?? ''}
                  caseId={caseId}
                  clientId={selectedClientId ?? ''}
                />
              </section>
            ) : null}

            {isOperationsSectionVisible('gwg-compliance') ? (
              <section ref={gwgComplianceSectionRef} className={styles.section}>
                <GwGComplianceSection currentUserName={title} />
              </section>
            ) : null}

            {isOperationsSectionVisible('dsgvo-compliance') ? (
              <section
                ref={dsgvoComplianceSectionRef}
                className={styles.section}
              >
                <DSGVOComplianceSection currentUserName={title} />
              </section>
            ) : null}

            {isOperationsSectionVisible('document-versioning') ? (
              <section
                ref={documentVersioningSectionRef}
                className={styles.section}
              >
                <DocumentVersioningSection
                  matterId={selectedMatterId ?? ''}
                  currentUserId={caseId}
                  currentUserName={title}
                />
              </section>
            ) : null}

            {isOperationsSectionVisible('bea-postfach') ? (
              <BeaPostfachSection
                sectionRef={beaPostfachSectionRef}
                workspaceId={workspaceId}
                connectorStatus={(() => {
                  const beaConnector = connectors.find(
                    c =>
                      c.name.toLowerCase().includes('bea') ||
                      c.name.toLowerCase().includes('werv')
                  );
                  if (beaConnector?.status === 'connected') return 'connected';
                  if (beaConnector?.status === 'error') return 'error';
                  return 'disconnected';
                })()}
              />
            ) : null}

            {isOperationsSectionVisible('email-inbox') ? (
              <EmailInboxSection
                sectionRef={emailInboxSectionRef}
                workspaceId={workspaceId}
                caseId={caseId}
                clients={clients}
                matters={matters}
                clientsById={clientsById}
                kanzleiProfile={kanzleiProfile}
                activeAnwaltName={activeAnwaltDisplayName}
              />
            ) : null}
          </main>
        </>
      ) : null}

      <RightRailSection
        copilotSectionRef={copilotSectionRef}
        alertsSectionRef={alertsSectionRef}
        isCopilotPanelOpen={isCopilotPanelOpen}
        setIsCopilotPanelOpen={setIsCopilotPanelOpen}
        copilotPrompt={copilotPrompt}
        setCopilotPrompt={setCopilotPrompt}
        isCopilotRunning={isCopilotRunning}
        isWorkflowBusy={isWorkflowBusy}
        runAsyncUiAction={runAsyncUiAction}
        onRunCopilotCommand={onRunCopilotCommand}
        copilotResponse={copilotResponse}
        copilotDraftPreview={copilotDraftPreview}
        draftReviewStatus={draftReviewStatus}
        draftSections={draftSections}
        acceptedSectionCount={acceptedSectionCount}
        acceptedWithCitationCount={acceptedWithCitationCount}
        acceptedWithoutCitationCount={acceptedWithoutCitationCount}
        isApplyingCopilotDraft={isApplyingCopilotDraft}
        canApproveDraft={canApproveDraft}
        violatesFourEyes={violatesFourEyes}
        auditGateSatisfied={auditGateSatisfied}
        draftReviewNote={draftReviewNote}
        setDraftReviewNote={setDraftReviewNote}
        draftReviewRequestedByRole={draftReviewRequestedByRole}
        draftApprovedByRole={draftApprovedByRole}
        draftReviewRequestedHash={draftReviewRequestedHash}
        draftApprovedHash={draftApprovedHash}
        onRequestDraftReview={onRequestDraftReview}
        onApproveDraft={onApproveDraft}
        onApplyCopilotDraftToDocument={onApplyCopilotDraftToDocument}
        onSetDraftSectionStatus={onSetDraftSectionStatus}
        onResetDraftState={resetDraftState}
        onlyCriticalAlerts={onlyCriticalAlerts}
        filteredAlerts={filteredAlerts}
        setOnlyCriticalAlerts={setOnlyCriticalAlerts}
        onAck={onAck}
        variant={isCopilotVariant ? 'copilot' : 'operations'}
        activeRailTab={activeCopilotRailTab}
        onRailTabChange={setActiveCopilotRailTab}
      />

      <CaseOnboardingWizard
        isOpen={isOnboardingWizardOpen}
        onClose={() => setIsOnboardingWizardOpen(false)}
        initialFlow={initialOnboardingFlow ?? 'documents-first'}
        caseId={caseId}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        clients={clients}
        selectedClientId={selectedClientId}
        setSelectedClientId={setSelectedClientId}
        selectedMatterId={selectedMatterId}
        clientDraftName={clientDraftName}
        setClientDraftName={setClientDraftName}
        clientDraftKind={clientDraftKind}
        setClientDraftKind={setClientDraftKind}
        onCreateClient={onCreateClient}
        matterDraftTitle={matterDraftTitle}
        setMatterDraftTitle={setMatterDraftTitle}
        matterDraftJurisdiction={matterDraftJurisdiction}
        setMatterDraftJurisdiction={setMatterDraftJurisdiction}
        matterDraftExternalRef={matterDraftExternalRef}
        setMatterDraftExternalRef={setMatterDraftExternalRef}
        matterDraftAuthorityReferences={matterDraftAuthorityReferences}
        setMatterDraftAuthorityReferences={setMatterDraftAuthorityReferences}
        matterDraftGericht={matterDraftGericht}
        setMatterDraftGericht={setMatterDraftGericht}
        matterDraftPolizei={matterDraftPolizei}
        setMatterDraftPolizei={setMatterDraftPolizei}
        matterDraftStaatsanwaltschaft={matterDraftStaatsanwaltschaft}
        setMatterDraftStaatsanwaltschaft={setMatterDraftStaatsanwaltschaft}
        matterDraftRichter={matterDraftRichter}
        setMatterDraftRichter={setMatterDraftRichter}
        matterDraftGerichtsaktenzeichen={matterDraftGerichtsaktenzeichen}
        setMatterDraftGerichtsaktenzeichen={setMatterDraftGerichtsaktenzeichen}
        matterDraftStaatsanwaltschaftAktenzeichen={
          matterDraftStaatsanwaltschaftAktenzeichen
        }
        setMatterDraftStaatsanwaltschaftAktenzeichen={
          setMatterDraftStaatsanwaltschaftAktenzeichen
        }
        matterDraftPolizeiAktenzeichen={matterDraftPolizeiAktenzeichen}
        setMatterDraftPolizeiAktenzeichen={setMatterDraftPolizeiAktenzeichen}
        matterDraftAssignedAnwaltId={matterDraftAssignedAnwaltId}
        setMatterDraftAssignedAnwaltId={setMatterDraftAssignedAnwaltId}
        anwaelte={anwaelte}
        onCreateMatter={onCreateMatter}
        onGenerateNextAktenzeichen={() => {
          onGenerateNextAktenzeichen().catch(() => {
            // handled in onGenerateNextAktenzeichen
          });
        }}
        onUploadFiles={onUploadFiles}
        onUploadFilesDetailed={onUploadFilesDetailed}
        onRetryDeadLetterBatch={onRetryDeadLetterBatch}
        canAction={canAction}
        isWorkflowBusy={isWorkflowBusy}
        onRunFullWorkflow={onRunFullWorkflow}
        onAnalyzeCase={onAnalyzeCase}
        onProcessOcr={onProcessOcr}
        onRetryFailedDocument={onRetryFailedDocument}
        onRemoveFailedDocument={onRemoveFailedDocument}
        onInferOnboardingMetadata={onInferOnboardingMetadata}
        onFinalizeOnboarding={onFinalizeOnboarding}
        runAsyncUiAction={runAsyncUiAction}
        currentClient={caseClient ?? null}
        currentMatter={caseMatter ?? null}
        anwaltDisplayName={activeAnwaltDisplayName}
        actors={caseActors}
        deadlines={caseDeadlines}
        issues={caseIssues}
        findings={caseFindings}
        tasks={caseTaskList}
        documents={caseDocuments}
        qualityReports={qualityReports.filter(
          r => r.caseId === caseId && r.workspaceId === workspaceId
        )}
        normReferences={caseNormReferences}
        caseSummary={caseRecord?.summary ?? null}
      />

      <DestructiveActionDialog
        pendingDestructiveAction={pendingDestructiveAction}
        destructiveDialogCardRef={destructiveDialogCardRef}
        onCancelDestructiveAction={onCancelDestructiveAction}
        onConfirmDestructiveAction={onConfirmDestructiveAction}
        runAsyncUiAction={runAsyncUiAction}
      />
    </div>
  );
};
