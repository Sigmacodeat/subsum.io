import { Button } from '@affine/component';
import type {
  AnwaltProfile,
  CaseActor,
  CaseAssistantAction,
  CaseAssistantRole,
  CaseDeadline,
  CaseIssue,
  ClientKind,
  ClientRecord,
  CopilotTask,
  DocumentQualityReport,
  Jurisdiction,
  LegalDocumentRecord,
  LegalFinding,
  MatterRecord,
  OnboardingDetectionResult,
  OnboardingFinalizeResult,
  StagedLegalFile,
} from '@affine/core/modules/case-assistant';
import { readStagedFilesStreaming } from '@affine/core/modules/case-assistant';
import {
  normalizeAuthorityReferences,
  normalizeDisplayText,
} from '@affine/core/modules/case-assistant';
import { useI18n } from '@affine/i18n';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import * as styles from '../../case-assistant.css';
import { CaseFactSheetSection } from './case-fact-sheet-section';
import * as wizardStyles from './case-onboarding-wizard.css';
import { FileUploadZone, type UploadedFile } from './file-upload-zone';
import { IntakeChecklistSection } from './intake-checklist-section';

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const total = Math.ceil(seconds);
  if (total < 60) return `${total}s`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}m ${sec}s`;
}

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

type WizardStep = 1 | 2 | 3 | 4 | 5;
type AuthorityRefType =
  | 'gericht'
  | 'staatsanwaltschaft'
  | 'polizei'
  | 'allgemein'
  | 'unbekannt';
type UploadCommitProgress = {
  active: boolean;
  uploadedCount: number;
  skippedCount: number;
  totalCount: number;
  batchIndex: number;
  totalBatches: number;
  failed: boolean;
};

type UploadCommitBaseline = {
  ready: number;
  review: number;
  failed: number;
  failedDocumentIds: string[];
};

type UploadDeadLetterItem = {
  fileKey: string;
  fileName: string;
  stage: 'read' | 'intake';
  reasonCode: string;
  details: string;
  retryCount: number;
  lastAttemptAt: string;
};

type CommitLogLevel = 'info' | 'success' | 'warn' | 'error';

type CommitLogEvent = {
  id: string;
  ts: number;
  level: CommitLogLevel;
  label: string;
  fileName?: string;
  phase?: string;
  durationMs?: number;
};

type CommitLiveMetrics = {
  fileCurrent: number;
  fileTotal: number;
  throughput: number;
  etaSec: number;
  updatedAt: number;
};

const MAX_UPLOAD_DEAD_LETTER_ITEMS = 200;

function normalizeUploadDeadLetters(input: unknown): UploadDeadLetterItem[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized = input
    .filter(
      (item): item is UploadDeadLetterItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as UploadDeadLetterItem).fileKey === 'string' &&
        typeof (item as UploadDeadLetterItem).fileName === 'string' &&
        ((item as UploadDeadLetterItem).stage === 'read' ||
          (item as UploadDeadLetterItem).stage === 'intake') &&
        typeof (item as UploadDeadLetterItem).reasonCode === 'string' &&
        typeof (item as UploadDeadLetterItem).details === 'string' &&
        typeof (item as UploadDeadLetterItem).retryCount === 'number' &&
        typeof (item as UploadDeadLetterItem).lastAttemptAt === 'string'
    )
    .sort((a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt));
  return normalized.slice(0, MAX_UPLOAD_DEAD_LETTER_ITEMS);
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialFlow: 'documents-first' | 'manual';
  caseId: string;

  currentRole: CaseAssistantRole;
  onRoleChange: (role: CaseAssistantRole) => void;

  // Step 1 — Client
  clients: ClientRecord[];
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  clientDraftName: string;
  setClientDraftName: (v: string) => void;
  clientDraftKind: ClientKind;
  setClientDraftKind: (v: ClientKind) => void;
  onCreateClient: () => Promise<void>;

  // Step 2 — Matter
  selectedMatterId: string;
  matterDraftTitle: string;
  setMatterDraftTitle: (v: string) => void;
  matterDraftJurisdiction: Jurisdiction;
  setMatterDraftJurisdiction: (v: Jurisdiction) => void;
  matterDraftExternalRef: string;
  setMatterDraftExternalRef: (v: string) => void;
  matterDraftAuthorityReferences: string;
  setMatterDraftAuthorityReferences: (v: string) => void;
  matterDraftGericht: string;
  setMatterDraftGericht: (v: string) => void;
  matterDraftPolizei: string;
  setMatterDraftPolizei: (v: string) => void;
  matterDraftStaatsanwaltschaft: string;
  setMatterDraftStaatsanwaltschaft: (v: string) => void;
  matterDraftRichter: string;
  setMatterDraftRichter: (v: string) => void;
  matterDraftGerichtsaktenzeichen: string;
  setMatterDraftGerichtsaktenzeichen: (v: string) => void;
  matterDraftStaatsanwaltschaftAktenzeichen: string;
  setMatterDraftStaatsanwaltschaftAktenzeichen: (v: string) => void;
  matterDraftPolizeiAktenzeichen: string;
  setMatterDraftPolizeiAktenzeichen: (v: string) => void;
  matterDraftAssignedAnwaltId: string;
  setMatterDraftAssignedAnwaltId: (v: string) => void;
  anwaelte: AnwaltProfile[];
  onCreateMatter: () => Promise<void>;
  onGenerateNextAktenzeichen: () => void;

  // Step 3 — Upload
  onUploadFiles: (files: UploadedFile[]) => Promise<number>;
  onUploadFilesDetailed?: (files: UploadedFile[]) => Promise<{
    commitId: string;
    inputCount: number;
    ingestedCount: number;
    skippedCount: number;
    failedCount: number;
    ocrQueuedCount: number;
  }>;
  onRetryDeadLetterBatch: () => Promise<void>;
  canAction: (action: CaseAssistantAction) => boolean;

  // Step 4 — Analysis
  isWorkflowBusy: boolean;
  onRunFullWorkflow: () => Promise<void>;
  onAnalyzeCase: () => Promise<void>;
  onProcessOcr: () => Promise<void>;
  onRetryFailedDocument?: (documentId: string) => Promise<boolean>;
  onRemoveFailedDocument?: (documentId: string) => Promise<boolean>;
  onInferOnboardingMetadata: () => Promise<OnboardingDetectionResult | null>;
  onFinalizeOnboarding: (input: {
    reviewConfirmed: boolean;
    proofNote: string;
  }) => Promise<OnboardingFinalizeResult>;
  runAsyncUiAction: (
    action: () => void | Promise<unknown>,
    errorContext: string
  ) => void;

  // Step 5 — Fact Sheet data
  currentClient: ClientRecord | null;
  currentMatter: MatterRecord | null;
  anwaltDisplayName: string | null;
  actors: CaseActor[];
  deadlines: CaseDeadline[];
  issues: CaseIssue[];
  findings: LegalFinding[];
  tasks: CopilotTask[];
  documents: LegalDocumentRecord[];
  qualityReports: DocumentQualityReport[];
  normReferences: string[];
  caseSummary: string | null;
};

function classifyAuthorityReference(value: string): AuthorityRefType {
  const normalized = value.trim();
  if (!normalized) {
    return 'unbekannt';
  }
  if (
    /\b(?:StA|Staatsanwaltschaft)\b/i.test(normalized) ||
    /\b\d{1,4}\s*Js\s*\d{1,7}\/[0-9]{2,4}\b/i.test(normalized)
  ) {
    return 'staatsanwaltschaft';
  }
  if (/\b(?:Polizei|Kripo|LKA|BKA|PI)\b/i.test(normalized)) {
    return 'polizei';
  }
  if (
    /\b(?:AG|LG|OLG|BGH|Bezirksgericht|Landesgericht|Amtsgericht|Landgericht|Oberlandesgericht|Verwaltungsgericht)\b/i.test(
      normalized
    )
  ) {
    return 'gericht';
  }
  if (
    /\b(?:AZ|Aktenzeichen|GZ|Gesch\.?\s*Z\.?)\b/i.test(normalized) ||
    /[A-Z0-9][A-Z0-9\-/.]{3,}/i.test(normalized)
  ) {
    return 'allgemein';
  }
  return 'unbekannt';
}

type DocFilter = 'all' | 'review' | 'failed' | 'problematic';
type ReviewDocTone = 'ready' | 'review' | 'failed' | 'unknown';
type PdfPrequalificationTone = 'good' | 'ocr' | 'warning';
type UploadFailureCause =
  | 'ocr_required'
  | 'empty_or_incomplete'
  | 'unsupported_or_binary'
  | 'extraction_failed';

type PdfPrequalification = {
  fileKey: string;
  fileName: string;
  readableLikely: boolean;
  ocrParsableLikely: boolean;
  tone: PdfPrequalificationTone;
  reasons: string[];
};

function getUploadFileKey(file: UploadedFile) {
  return `${file.name}:${file.size}:${file.lastModifiedAt}:${file.folderPath ?? ''}`;
}

function toMillis(value: string | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function isLikelyDuplicateUpload(
  file: UploadedFile,
  existingDocs: LegalDocumentRecord[]
): boolean {
  const fileModifiedAt = toMillis(file.lastModifiedAt);
  return existingDocs.some(doc => {
    if ((doc.title ?? '').trim() !== file.name.trim()) return false;
    if ((doc.sourceSizeBytes ?? -1) !== file.size) return false;

    const docModifiedAt = toMillis(doc.sourceLastModifiedAt);
    if (fileModifiedAt !== null && docModifiedAt !== null) {
      return fileModifiedAt === docModifiedAt;
    }
    return true;
  });
}

function isPdfLikeUpload(file: UploadedFile): boolean {
  const lowerName = file.name.toLowerCase();
  const mime = file.mimeType.toLowerCase();
  return (
    file.kind === 'pdf' ||
    file.kind === 'scan-pdf' ||
    lowerName.endsWith('.pdf') ||
    mime.includes('pdf')
  );
}

function prequalifyPdfUpload(
  file: UploadedFile,
  t: ReturnType<typeof useI18n>,
  hasDeferredPayload = false
): PdfPrequalification | null {
  if (!isPdfLikeUpload(file)) {
    return null;
  }

  const reasons: string[] = [];
  const lowerName = file.name.toLowerCase();
  const isScan = file.kind === 'scan-pdf' || lowerName.includes('scan');
  const looksBinaryPayload =
    file.content.startsWith('data:') && file.content.includes(';base64,');

  let readableLikely = true;
  let ocrParsableLikely = true;
  let tone: PdfPrequalificationTone = 'good';

  if (isScan) {
    readableLikely = false;
    tone = 'ocr';
    reasons.push(t['com.affine.caseAssistant.wizard.pdf.scanDetected']());
  } else {
    reasons.push(t['com.affine.caseAssistant.wizard.pdf.textLayer']());
  }

  if (hasDeferredPayload && file.content.trim().length === 0) {
    reasons.push(
      'Datei-Inhalt wird beim Commit aus der gestagten Referenz gelesen.'
    );
  } else if (!looksBinaryPayload && file.content.trim().length < 40) {
    readableLikely = false;
    ocrParsableLikely = false;
    tone = 'warning';
    reasons.push(t['com.affine.caseAssistant.wizard.pdf.incompleteContent']());
  }

  if (file.size > 35 * 1024 * 1024) {
    tone = 'warning';
    reasons.push(t['com.affine.caseAssistant.wizard.pdf.largeFile']());
  }

  if ((file.pageCount ?? 0) > 280) {
    tone = 'warning';
    reasons.push(t['com.affine.caseAssistant.wizard.pdf.highPageCount']());
  }

  return {
    fileKey: getUploadFileKey(file),
    fileName: file.name,
    readableLikely,
    ocrParsableLikely,
    tone,
    reasons,
  };
}

function getReviewDocTone(status: string | undefined): ReviewDocTone {
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'needs_review') {
    return 'review';
  }
  if (status === 'ready') {
    return 'ready';
  }
  return 'unknown';
}

function getReviewDocStatusLabel(
  status: string | undefined,
  t: ReturnType<typeof useI18n>
): string {
  if (status === 'failed') {
    return t['com.affine.caseAssistant.wizard.docStatus.failed']();
  }
  if (status === 'needs_review') {
    return t['com.affine.caseAssistant.wizard.docStatus.review']();
  }
  if (status === 'ready') {
    return t['com.affine.caseAssistant.wizard.docStatus.ready']();
  }
  return t['com.affine.caseAssistant.wizard.docStatus.unknown']();
}

function classifyUploadFailureCause(input: {
  status?: string;
  kind?: string;
  reason: string;
}): UploadFailureCause {
  const reason = input.reason.toLowerCase();

  if (
    input.status === 'ocr_pending' ||
    input.status === 'ocr_running' ||
    input.kind === 'scan-pdf' ||
    reason.includes('ocr')
  ) {
    return 'ocr_required';
  }

  if (
    reason.includes('leer') ||
    reason.includes('unvoll') ||
    reason.includes('empty') ||
    reason.includes('too short') ||
    reason.includes('keine inhalte')
  ) {
    return 'empty_or_incomplete';
  }

  if (
    reason.includes('format') ||
    reason.includes('nicht unterstützt') ||
    reason.includes('unsupported') ||
    reason.includes('binary')
  ) {
    return 'unsupported_or_binary';
  }

  return 'extraction_failed';
}

function buildFailureActionPlan(input: {
  cause: UploadFailureCause;
  t: ReturnType<typeof useI18n>;
}) {
  const { cause, t } = input;

  if (cause === 'ocr_required') {
    return {
      label: t.t(
        'com.affine.caseAssistant.wizard.uploadFailure.ocrRequired.label'
      ),
      nextStep: t['com.affine.caseAssistant.wizard.pdf.ocrPending'](),
      recommendation: t.t(
        'com.affine.caseAssistant.wizard.uploadFailure.ocrRequired.recommendation'
      ),
      prioritizeOcr: true,
    };
  }

  if (cause === 'empty_or_incomplete') {
    return {
      label: t.t(
        'com.affine.caseAssistant.wizard.uploadFailure.incomplete.label'
      ),
      nextStep: t['com.affine.caseAssistant.wizard.pdf.incompleteContent'](),
      recommendation: t.t(
        'com.affine.caseAssistant.wizard.uploadFailure.incomplete.recommendation'
      ),
      prioritizeOcr: false,
    };
  }

  if (cause === 'unsupported_or_binary') {
    return {
      label: t.t('com.affine.caseAssistant.wizard.uploadFailure.format.label'),
      nextStep: t['com.affine.caseAssistant.wizard.pdf.extractionFailed'](),
      recommendation: t.t(
        'com.affine.caseAssistant.wizard.uploadFailure.format.recommendation'
      ),
      prioritizeOcr: false,
    };
  }

  return {
    label: t.t(
      'com.affine.caseAssistant.wizard.uploadFailure.extractionFailed.label'
    ),
    nextStep: t['com.affine.caseAssistant.wizard.pdf.extractionFailed'](),
    recommendation: t.t(
      'com.affine.caseAssistant.wizard.uploadFailure.extractionFailed.recommendation'
    ),
    prioritizeOcr: false,
  };
}

export const CaseOnboardingWizard = (props: Props) => {
  const {
    isOpen,
    onClose,
    initialFlow,
    caseId,

    onRetryDeadLetterBatch,
    canAction,
    isWorkflowBusy,

    documents,
    qualityReports,
  } = props;
  const matterDraftAuthorityReferences = props.matterDraftAuthorityReferences;
  const t = useI18n();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const stepViewportRef = useRef<HTMLDivElement | null>(null);
  const stagedUploadRefs = useRef<Map<string, StagedLegalFile>>(new Map());
  const hasAutoInferredMetadataRef = useRef(false);
  const hasAutoAdvancedAfterCommitRef = useRef(false);
  const hasAutoStep4PipelineRunRef = useRef(false);
  const hasAutoAdvancedToManualReviewRef = useRef(false);
  const lastInitOpenRef = useRef(false);
  const lastInitKeyRef = useRef<string>('');
  const [step, setStep] = useState<WizardStep>(1);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>(
    'forward'
  );
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<string | null>(null);
  const [finalizeStatus, setFinalizeStatus] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [proofNote, setProofNote] = useState('');
  const [docFilter, setDocFilter] = useState<DocFilter>('all');
  const [stagedUploadFiles, setStagedUploadFiles] = useState<UploadedFile[]>(
    []
  );
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [uploadBatchStatus, setUploadBatchStatus] = useState<string | null>(
    null
  );
  const [uploadCommitProgress, setUploadCommitProgress] =
    useState<UploadCommitProgress | null>(null);
  const [uploadCommitBaseline, setUploadCommitBaseline] =
    useState<UploadCommitBaseline | null>(null);
  const [uploadDeadLetters, setUploadDeadLetters] = useState<
    UploadDeadLetterItem[]
  >([]);
  const [commitLogEvents, setCommitLogEvents] = useState<CommitLogEvent[]>([]);
  const [isCommitLogCollapsed, setIsCommitLogCollapsed] = useState(true);
  const [commitLogAutoScroll, setCommitLogAutoScroll] = useState(true);
  const commitLogBodyRef = useRef<HTMLDivElement | null>(null);
  const [commitLiveMetrics, setCommitLiveMetrics] =
    useState<CommitLiveMetrics | null>(null);
  const [detectedMetadata, setDetectedMetadata] =
    useState<OnboardingDetectionResult | null>(null);
  const [hasStartedUploadJourney, setHasStartedUploadJourney] = useState(false);
  const [pipelineStage, _setPipelineStage] = useState<
    'idle' | 'ocr' | 'analysis' | 'metadata' | 'complete'
  >('idle');
  const [pipelineProgress, _setPipelineProgress] = useState(0);
  const [extractedAktenzeichen, setExtractedAktenzeichen] = useState<
    string | null
  >(null);
  const [showAktenzeichenConfirmation, setShowAktenzeichenConfirmation] =
    useState(false);

  const storageKey = `case-onboarding-wizard:${caseId}:${initialFlow}`;

  const initialStep: WizardStep = initialFlow === 'documents-first' ? 3 : 1;

  const visibleSteps: WizardStep[] =
    initialFlow === 'documents-first' ? [3, 4, 2, 1, 5] : [1, 2, 3, 4, 5];
  const visibleStepIndex = Math.max(0, visibleSteps.indexOf(step));
  const progressPercent = Math.round(
    ((visibleStepIndex + 1) / visibleSteps.length) * 100
  );

  const needsReviewCount = documents.filter(
    d => d.processingStatus === 'needs_review'
  ).length;
  const failedDocumentCount = documents.filter(
    d => d.processingStatus === 'failed'
  ).length;
  const readyDocumentCount = documents.filter(
    d => d.processingStatus === 'ready'
  ).length;
  const indexedDocumentCount = documents.filter(
    d => d.status === 'indexed'
  ).length;
  const problematicDocumentCount = needsReviewCount + failedDocumentCount;
  const totalChunkCount = documents.reduce(
    (sum, doc) => sum + (doc.chunkCount ?? 0),
    0
  );
  const qualityReportCoverageCount = qualityReports.filter(report =>
    documents.some(doc => doc.id === report.documentId)
  ).length;
  const averageQualityScore =
    qualityReports.length > 0
      ? Math.round(
          qualityReports.reduce(
            (sum, report) => sum + (report.overallScore ?? 0),
            0
          ) / qualityReports.length
        )
      : null;
  const hasDocuments = documents.length > 0;
  const hasMatterContext = Boolean(
    props.selectedMatterId || props.currentMatter?.id
  );
  const canUploadDocuments = canAction('document.upload');
  const isUploadDisabled =
    !canUploadDocuments || isWorkflowBusy || !hasMatterContext;
  const hasStagedUploadFiles = stagedUploadFiles.length > 0;
  const missingSummaryFields = useMemo(() => {
    const missing: string[] = [];
    if (!normalizeDisplayText(props.matterDraftExternalRef)) {
      missing.push(
        t.t('com.affine.caseAssistant.wizard.step2.missing.externalRef')
      );
    }
    if (!normalizeDisplayText(props.matterDraftGericht)) {
      missing.push(t.t('com.affine.caseAssistant.wizard.step2.missing.court'));
    }
    if (!props.matterDraftAssignedAnwaltId && props.anwaelte.length > 0) {
      missing.push(t.t('com.affine.caseAssistant.wizard.step2.missing.lawyer'));
    }
    return missing;
  }, [
    props.anwaelte.length,
    props.matterDraftAssignedAnwaltId,
    props.matterDraftExternalRef,
    props.matterDraftGericht,
    t,
  ]);
  const adoptedSummaryItems = useMemo(() => {
    const items: string[] = [];
    const clientLabel = normalizeDisplayText(
      props.currentClient?.displayName || props.clientDraftName
    );
    const matterLabel = normalizeDisplayText(props.matterDraftTitle);
    const refLabel = normalizeDisplayText(props.matterDraftExternalRef);
    const courtLabel = normalizeDisplayText(props.matterDraftGericht);

    if (clientLabel) {
      items.push(
        t.t('com.affine.caseAssistant.wizard.step2.summary.client', {
          value: clientLabel,
        })
      );
    }
    if (matterLabel) {
      items.push(
        t.t('com.affine.caseAssistant.wizard.step2.summary.matter', {
          value: matterLabel,
        })
      );
    }
    if (refLabel) {
      items.push(
        t.t('com.affine.caseAssistant.wizard.step2.summary.externalRef', {
          value: refLabel,
        })
      );
    }
    if (courtLabel) {
      items.push(
        t.t('com.affine.caseAssistant.wizard.step2.summary.court', {
          value: courtLabel,
        })
      );
    }
    if (props.matterDraftAssignedAnwaltId && props.anwaltDisplayName) {
      items.push(
        t.t('com.affine.caseAssistant.wizard.step2.summary.lawyer', {
          value: props.anwaltDisplayName,
        })
      );
    }
    items.push(
      t.t('com.affine.caseAssistant.wizard.step2.summary.indexedDocuments', {
        count: indexedDocumentCount,
      })
    );
    items.push(
      t.t('com.affine.caseAssistant.wizard.step2.summary.semanticChunks', {
        count: totalChunkCount,
      })
    );
    return items;
  }, [
    props.currentClient?.displayName,
    props.clientDraftName,
    hasMatterContext,
    props.matterDraftTitle,
    props.matterDraftExternalRef,
    props.matterDraftGericht,
    props.matterDraftAssignedAnwaltId,
    props.anwaltDisplayName,
    indexedDocumentCount,
    totalChunkCount,
    t,
  ]);
  const openSummaryItems = useMemo(() => {
    type OpenIssue = {
      label: string;
      priority: 'P1' | 'P2' | 'P3';
      blocker: boolean;
    };
    const issues: OpenIssue[] = [];

    if (!reviewConfirmed) {
      issues.push({
        label: t.t(
          'com.affine.caseAssistant.wizard.step5.issues.reviewMissing'
        ),
        priority: 'P1',
        blocker: true,
      });
    }
    if (needsReviewCount > 0 && proofNote.trim().length < 16) {
      issues.push({
        label: t.t(
          'com.affine.caseAssistant.wizard.step5.issues.proofNoteMissing'
        ),
        priority: 'P1',
        blocker: true,
      });
    }
    if (failedDocumentCount > 0) {
      issues.push({
        label: t.t(
          'com.affine.caseAssistant.wizard.step5.issues.failedDocuments',
          {
            count: failedDocumentCount,
          }
        ),
        priority: 'P2',
        blocker: false,
      });
    }
    if (needsReviewCount > 0) {
      issues.push({
        label: t.t('com.affine.caseAssistant.wizard.step5.issues.needsReview', {
          count: needsReviewCount,
        }),
        priority: 'P2',
        blocker: false,
      });
    }
    for (const field of missingSummaryFields) {
      issues.push({ label: field, priority: 'P3', blocker: false });
    }

    return issues;
  }, [
    failedDocumentCount,
    missingSummaryFields,
    needsReviewCount,
    proofNote,
    reviewConfirmed,
    t,
  ]);
  const hasClientIdentity = Boolean(
    normalizeDisplayText(
      props.currentClient?.displayName || props.clientDraftName
    ) || props.selectedClientId
  );
  const hasMatterIdentity = Boolean(
    normalizeDisplayText(props.matterDraftTitle)
  );
  const needsProofNote = needsReviewCount > 0 && proofNote.trim().length < 16;
  const blockerIssues = openSummaryItems.filter(issue => issue.blocker);
  const hasBlockers = blockerIssues.length > 0;
  const finalizeBlockerText = useMemo(() => {
    if (!hasBlockers) {
      return null;
    }
    const blockerLabels = blockerIssues.map(issue => issue.label);
    if (blockerLabels.length === 1) {
      return `Abschluss gesperrt: ${blockerLabels[0]}`;
    }
    return `Abschluss gesperrt: ${blockerLabels.length} Pflichtpunkte offen`;
  }, [hasBlockers, blockerIssues]);

  const filteredDocuments = useMemo(() => {
    if (docFilter === 'all') {
      return documents;
    }

    if (docFilter === 'problematic') {
      return documents.filter(
        doc =>
          doc.processingStatus === 'needs_review' ||
          doc.processingStatus === 'failed'
      );
    }

    if (docFilter === 'review') {
      return documents.filter(doc => doc.processingStatus === 'needs_review');
    }

    return documents.filter(doc => doc.processingStatus === 'failed');
  }, [docFilter, documents]);

  const prioritizedFilteredDocuments = useMemo(() => {
    const statusPriority: Record<ReviewDocTone, number> = {
      failed: 0,
      review: 1,
      unknown: 2,
      ready: 3,
    };

    const items = filteredDocuments
      .map(doc => {
        const tone = getReviewDocTone(doc.processingStatus);
        const statusLabel = getReviewDocStatusLabel(doc.processingStatus, t);
        const isOcrInFlight =
          doc.status === 'ocr_pending' || doc.status === 'ocr_running';

        return {
          doc,
          tone,
          statusLabel,
          isOcrInFlight,
        };
      })
      .sort((a, b) => {
        const ap = statusPriority[a.tone];
        const bp = statusPriority[b.tone];
        if (ap !== bp) {
          return ap - bp;
        }

        if (a.isOcrInFlight !== b.isOcrInFlight) {
          return a.isOcrInFlight ? -1 : 1;
        }

        return (b.doc.chunkCount ?? 0) - (a.doc.chunkCount ?? 0);
      });

    let rank = 0;
    return items.map(item => {
      const isProblematic =
        item.tone === 'failed' || item.tone === 'review' || item.isOcrInFlight;
      if (isProblematic && rank < 3) {
        rank += 1;
        return { ...item, priorityRank: rank };
      }
      return { ...item, priorityRank: undefined };
    });
  }, [filteredDocuments, t]);
  const uploadSubstep = hasStartedUploadJourney
    ? 'commit'
    : hasStagedUploadFiles
      ? 'review'
      : 'select';
  const isUploadCommitPhase =
    step === 3 && (uploadSubstep === 'commit' || isBatchUploading);
  const showUploadSelectPanel =
    step === 3 && uploadSubstep === 'select' && !isBatchUploading;
  const showUploadReviewPanel =
    step === 3 && uploadSubstep === 'review' && !isBatchUploading;
  const showCommitProgressCard = Boolean(
    uploadCommitProgress?.active || uploadCommitProgress?.failed
  );

  const [isUploadSelectExiting, setIsUploadSelectExiting] = useState(false);
  const lastShowUploadSelectPanelRef = useRef(showUploadSelectPanel);

  useEffect(() => {
    const wasShowing = lastShowUploadSelectPanelRef.current;
    lastShowUploadSelectPanelRef.current = showUploadSelectPanel;

    if (!wasShowing || showUploadSelectPanel) {
      if (showUploadSelectPanel) {
        setIsUploadSelectExiting(false);
      }
      return;
    }

    if (step !== 3 || isBatchUploading) {
      setIsUploadSelectExiting(false);
      return;
    }

    if (uploadSubstep !== 'review' && uploadSubstep !== 'commit') {
      setIsUploadSelectExiting(false);
      return;
    }

    setIsUploadSelectExiting(true);
    const handle = window.setTimeout(() => {
      setIsUploadSelectExiting(false);
    }, 230);
    return () => {
      window.clearTimeout(handle);
    };
  }, [isBatchUploading, showUploadSelectPanel, step, uploadSubstep]);

  const shouldRenderUploadSelectPanel =
    showUploadSelectPanel || isUploadSelectExiting;
  const uploadCommitPercent = uploadCommitProgress
    ? Math.round(
        (Math.min(
          uploadCommitProgress.totalCount,
          Math.max(
            uploadCommitProgress.batchIndex,
            uploadCommitProgress.uploadedCount
          )
        ) /
          uploadCommitProgress.totalCount) *
          100
      )
    : 0;
  const visibleUploadCommitPercent = uploadCommitProgress?.active
    ? Math.min(95, uploadCommitPercent || 0)
    : uploadCommitPercent;
  const uploadCommitDelta = uploadCommitBaseline
    ? {
        ready: Math.max(0, readyDocumentCount - uploadCommitBaseline.ready),
        review: Math.max(0, needsReviewCount - uploadCommitBaseline.review),
        failed: Math.max(0, failedDocumentCount - uploadCommitBaseline.failed),
      }
    : null;

  const stagedUploadKeySet = useMemo(() => {
    if (stagedUploadFiles.length === 0) {
      return new Set<string>();
    }
    return new Set(stagedUploadFiles.map(file => getUploadFileKey(file)));
  }, [stagedUploadFiles]);

  const retryableDeadLetterCount = useMemo(() => {
    if (uploadDeadLetters.length === 0 || stagedUploadKeySet.size === 0) {
      return 0;
    }
    let count = 0;
    for (const item of uploadDeadLetters) {
      if (stagedUploadKeySet.has(item.fileKey)) {
        count += 1;
      }
    }
    return count;
  }, [stagedUploadKeySet, uploadDeadLetters]);
  const deadLetterPreview = uploadDeadLetters.slice(0, 5);
  const hasCommitFailure = Boolean(uploadCommitProgress?.failed);
  const isUploadRecoveryMode =
    step === 3 && hasCommitFailure && !isBatchUploading;
  const isUploadMinimalMode = step === 3;
  const firstCommitFailureDiagnostic = useMemo(() => {
    if (!hasCommitFailure) {
      return null;
    }

    const firstDeadLetter = uploadDeadLetters[0];
    if (!firstDeadLetter) {
      return null;
    }

    const stagedFile = stagedUploadFiles.find(
      file => getUploadFileKey(file) === firstDeadLetter.fileKey
    );
    const cause = classifyUploadFailureCause({
      status: undefined,
      kind: stagedFile?.kind,
      reason: firstDeadLetter.details || firstDeadLetter.reasonCode,
    });
    const actionPlan = buildFailureActionPlan({ cause, t });

    return {
      cause,
      causeLabel: actionPlan.label,
      title: firstDeadLetter.fileName,
      reason: firstDeadLetter.details || firstDeadLetter.reasonCode,
      nextStepHint: actionPlan.nextStep,
      recommendation: actionPlan.recommendation,
      prioritizeOcr: actionPlan.prioritizeOcr,
    };
  }, [hasCommitFailure, stagedUploadFiles, t, uploadDeadLetters]);
  const failedDocumentDiagnostics = useMemo(() => {
    const failedDocs = documents.filter(
      doc => doc.processingStatus === 'failed'
    );
    if (failedDocs.length === 0) {
      return [];
    }

    return failedDocs.map(doc => {
      const reason = doc.processingError?.trim().length
        ? doc.processingError
        : t.t(
            'com.affine.caseAssistant.wizard.step4.diagnostics.unknownProcessingError'
          );

      const cause = classifyUploadFailureCause({
        status: doc.processingStatus,
        kind: doc.kind,
        reason,
      });
      const actionPlan = buildFailureActionPlan({ cause, t });

      return {
        documentId: doc.id,
        cause,
        causeLabel: actionPlan.label,
        title: doc.title ?? 'Unbenanntes Dokument',
        reason,
        nextStepHint: actionPlan.nextStep,
        recommendation: actionPlan.recommendation,
        prioritizeOcr: actionPlan.prioritizeOcr,
      };
    });
  }, [documents, t]);
  const stagedUploadStats = useMemo(() => {
    if (isUploadCommitPhase || stagedUploadFiles.length === 0) {
      return {
        pdfCount: 0,
        scanPdfCount: 0,
        docxCount: 0,
        emailCount: 0,
        otherCount: 0,
        totalSizeBytes: 0,
      };
    }

    let pdfCount = 0;
    let scanPdfCount = 0;
    let docxCount = 0;
    let emailCount = 0;
    let otherCount = 0;
    let totalSizeBytes = 0;

    for (const file of stagedUploadFiles) {
      totalSizeBytes += file.size;
      if (file.kind === 'pdf') pdfCount += 1;
      else if (file.kind === 'scan-pdf') scanPdfCount += 1;
      else if (file.kind === 'docx') docxCount += 1;
      else if (file.kind === 'email') emailCount += 1;
      else otherCount += 1;
    }

    return {
      pdfCount,
      scanPdfCount,
      docxCount,
      emailCount,
      otherCount,
      totalSizeBytes,
    };
  }, [isUploadCommitPhase, stagedUploadFiles]);

  const stagedDuplicateSummary = useMemo(() => {
    if (isUploadCommitPhase || stagedUploadFiles.length === 0) {
      return {
        duplicateCount: 0,
        freshCount: 0,
      };
    }

    const duplicateCount = stagedUploadFiles.filter(file =>
      isLikelyDuplicateUpload(file, documents)
    ).length;
    const freshCount = Math.max(0, stagedUploadFiles.length - duplicateCount);

    return {
      duplicateCount,
      freshCount,
    };
  }, [documents, isUploadCommitPhase, stagedUploadFiles]);

  const stagedDuplicateFilePreview = useMemo(() => {
    if (isUploadCommitPhase || stagedUploadFiles.length === 0) {
      return [] as string[];
    }
    return stagedUploadFiles
      .filter(file => isLikelyDuplicateUpload(file, documents))
      .map(file => file.name)
      .slice(0, 8);
  }, [documents, isUploadCommitPhase, stagedUploadFiles]);

  const stagedPdfPrequalification = useMemo(() => {
    if (isUploadCommitPhase || stagedUploadFiles.length === 0) {
      return {
        totalPdf: 0,
        readableLikelyCount: 0,
        ocrParsableLikelyCount: 0,
        warningCount: 0,
        ocrRouteCount: 0,
        likelyBlockedCount: 0,
        topRisks: [] as PdfPrequalification[],
      };
    }

    let totalPdf = 0;
    let readableLikelyCount = 0;
    let ocrParsableLikelyCount = 0;
    let warningCount = 0;
    let ocrRouteCount = 0;
    let likelyBlockedCount = 0;
    const topRisks: PdfPrequalification[] = [];

    for (const file of stagedUploadFiles) {
      if (file.kind !== 'pdf' && file.kind !== 'scan-pdf') {
        continue;
      }
      const item = prequalifyPdfUpload(file, t);
      if (!item) {
        continue;
      }

      totalPdf += 1;
      if (item.readableLikely) readableLikelyCount += 1;
      if (item.ocrParsableLikely) ocrParsableLikelyCount += 1;
      if (item.tone === 'warning') {
        warningCount += 1;
        if (topRisks.length < 5) topRisks.push(item);
      }
      if (item.tone === 'ocr') ocrRouteCount += 1;
      if (!item.readableLikely && !item.ocrParsableLikely)
        likelyBlockedCount += 1;
    }

    return {
      totalPdf,
      readableLikelyCount,
      ocrParsableLikelyCount,
      warningCount,
      ocrRouteCount,
      likelyBlockedCount,
      topRisks,
    };
  }, [isUploadCommitPhase, stagedUploadFiles, t]);
  const normalizedAuthorityRefs = useMemo(
    () => normalizeAuthorityReferences(matterDraftAuthorityReferences),
    [matterDraftAuthorityReferences]
  );
  const authorityRefs = normalizedAuthorityRefs.values;
  const authorityRefStats = authorityRefs.reduce(
    (acc: Record<AuthorityRefType, number>, ref: string) => {
      const type = classifyAuthorityReference(ref);
      acc[type] += 1;
      return acc;
    },
    {
      gericht: 0,
      staatsanwaltschaft: 0,
      polizei: 0,
      allgemein: 0,
      unbekannt: 0,
    }
  );

  const stepVisualHeadlineKey = {
    1: 'com.affine.caseAssistant.wizard.visual.headline.1',
    2: 'com.affine.caseAssistant.wizard.visual.headline.2',
    3: 'com.affine.caseAssistant.wizard.visual.headline.3',
    4: 'com.affine.caseAssistant.wizard.visual.headline.4',
    5: 'com.affine.caseAssistant.wizard.visual.headline.5',
  };

  const formatCommitLogLine = useCallback((event: CommitLogEvent) => {
    const date = new Date(event.ts);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const time = `${hh}:${mm}:${ss}`;
    const filePart = event.fileName ? ` · ${event.fileName}` : '';
    const phasePart = event.phase ? ` · ${event.phase}` : '';
    const durationPart =
      typeof event.durationMs === 'number'
        ? ` · ${event.durationMs < 1000 ? `${Math.round(event.durationMs)}ms` : `${(event.durationMs / 1000).toFixed(1)}s`}`
        : '';
    return `${time} · ${event.label}${filePart}${phasePart}${durationPart}`;
  }, []);

  const copyCommitLogToClipboard = useCallback(async () => {
    const lines = commitLogEvents.map(formatCommitLogLine).join('\n');
    if (!lines.trim()) {
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lines);
        return;
      }
    } catch {
      // fall through
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = lines;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      // ignore
    }
  }, [commitLogEvents, formatCommitLogLine]);

  // Navigation handlers
  const goNextVisibleStep = useCallback(() => {
    const currentIndex = visibleSteps.indexOf(step);
    const nextIndex = currentIndex + 1;
    if (nextIndex < visibleSteps.length) {
      setStepDirection('forward');
      setStep(visibleSteps[nextIndex]);
    }
  }, [step, visibleSteps]);

  const goPrevVisibleStep = useCallback(() => {
    const currentIndex = visibleSteps.indexOf(step);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStepDirection('backward');
      setStep(visibleSteps[prevIndex]);
    }
  }, [step, visibleSteps]);

  const onReturnToUploadSelect = useCallback(() => {
    setStepDirection('backward');
    setStep(3);
  }, []);

  const onStageFilesForUpload = useCallback((files: UploadedFile[]) => {
    setStagedUploadFiles(prev => {
      // Deduplicate: only add files not already staged
      const existingKeys = new Set(
        prev.map(
          f => `${f.name}:${f.size}:${f.lastModifiedAt}:${f.folderPath ?? ''}`
        )
      );
      const newFiles = files.filter(
        f =>
          !existingKeys.has(
            `${f.name}:${f.size}:${f.lastModifiedAt}:${f.folderPath ?? ''}`
          )
      );
      if (newFiles.length === 0) return prev;
      return [...prev, ...newFiles];
    });
  }, []);

  const onStagedRefsReady = useCallback((refs: StagedLegalFile[]) => {
    // MERGE into existing map instead of replacing
    for (const ref of refs) {
      const key = `${ref.name}:${ref.size}:${ref.lastModifiedAt}:${ref.folderPath ?? ''}`;
      stagedUploadRefs.current.set(key, ref);
    }
  }, []);

  const onCommitStagedUploadFiles = useCallback(
    async (files: UploadedFile[]) => {
      if (files.length === 0 || isBatchUploading || props.isWorkflowBusy) {
        return;
      }
      if (!hasMatterContext) {
        setUploadBatchStatus(
          t['com.affine.caseAssistant.onboarding.uploadGate.warning']()
        );
        setStep(2);
        return;
      }

      const duplicateFiles = files.filter(file =>
        isLikelyDuplicateUpload(file, documents)
      );
      const duplicateKeys = new Set(duplicateFiles.map(getUploadFileKey));
      const filesToCommit = files.filter(
        file => !duplicateKeys.has(getUploadFileKey(file))
      );
      const duplicateCount = duplicateFiles.length;

      if (filesToCommit.length === 0) {
        setHasStartedUploadJourney(true);
        setUploadCommitBaseline({
          ready: readyDocumentCount,
          review: needsReviewCount,
          failed: failedDocumentCount,
          failedDocumentIds: documents
            .filter(d => d.processingStatus === 'failed')
            .map(d => d.id),
        });
        setUploadCommitProgress({
          active: false,
          uploadedCount: 0,
          skippedCount: files.length,
          totalCount: files.length,
          batchIndex: 1,
          totalBatches: 1,
          failed: false,
        });
        setStagedUploadFiles([]);
        stagedUploadRefs.current.clear();
        setUploadBatchStatus(
          `Nur Duplikate erkannt (${duplicateCount}). Keine neue Verarbeitung gestartet.`
        );
        return;
      }

      setHasStartedUploadJourney(true);
      setUploadCommitBaseline({
        ready: readyDocumentCount,
        review: needsReviewCount,
        failed: failedDocumentCount,
        failedDocumentIds: documents
          .filter(d => d.processingStatus === 'failed')
          .map(d => d.id),
      });
      setUploadCommitProgress({
        active: true,
        uploadedCount: 0,
        skippedCount: duplicateCount,
        totalCount: files.length,
        batchIndex: 1,
        totalBatches: 1,
        failed: false,
      });

      setIsBatchUploading(true);
      setUploadBatchStatus(
        t['com.affine.caseAssistant.wizard.step3.commit.running']()
      );

      try {
        // ── Phase 1: Read file content from StagedLegalFile refs ──
        // Files in stagedUploadFiles have content='' (lazy-loaded design).
        // We must read actual content from stagedUploadRefs before sending to pipeline.
        const refsToRead: StagedLegalFile[] = [];
        const directReadyFiles: UploadedFile[] = [];
        for (const f of filesToCommit) {
          const key = `${f.name}:${f.size}:${f.lastModifiedAt}:${f.folderPath ?? ''}`;
          const ref = stagedUploadRefs.current.get(key);
          if (ref) {
            refsToRead.push(ref);
          } else if (f.content.trim().length > 0) {
            directReadyFiles.push(f);
          }
        }

        // Collect all files with content for the pipeline
        const filesWithContent: UploadedFile[] = [...directReadyFiles];
        let readCount = 0;

        if (refsToRead.length > 0) {
          const READ_BATCH = 8;
          for await (const batch of readStagedFilesStreaming(
            refsToRead,
            READ_BATCH
          )) {
            for (const p of batch.prepared) {
              // Find matching ref to restore folderPath
              const matchKey = `${p.name}:${p.size}:${p.lastModifiedAt}`;
              const matchedRef = refsToRead.find(
                r => `${r.name}:${r.size}:${r.lastModifiedAt}` === matchKey
              );
              filesWithContent.push({
                ...p,
                folderPath: matchedRef?.folderPath,
              });
            }
            readCount += batch.prepared.length;
            setUploadBatchStatus(
              t.t('com.affine.caseAssistant.wizard.upload.reading', {
                read: readCount,
                total: refsToRead.length,
              })
            );
            setUploadCommitProgress(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                batchIndex: readCount,
                totalBatches: refsToRead.length,
              };
            });
          }
        }

        if (filesWithContent.length === 0) {
          setUploadCommitProgress(prev => ({
            ...(prev ?? {
              active: true,
              uploadedCount: 0,
              skippedCount: 0,
              totalCount: files.length,
              batchIndex: 1,
              totalBatches: 1,
              failed: false,
            }),
            active: false,
            uploadedCount: 0,
            skippedCount: files.length,
            totalCount: files.length,
            failed: false,
          }));
          setStagedUploadFiles([]);
          stagedUploadRefs.current.clear();
          setUploadBatchStatus(
            t.t('com.affine.caseAssistant.wizard.upload.noReadable')
          );
          return;
        }

        // ── Phase 2: Send to pipeline ──
        setUploadBatchStatus(
          duplicateCount > 0
            ? t.t(
                'com.affine.caseAssistant.wizard.upload.pipeline.withDuplicates',
                {
                  newCount: filesWithContent.length,
                  duplicateCount,
                }
              )
            : t.t(
                'com.affine.caseAssistant.wizard.upload.pipeline.processing',
                {
                  count: filesWithContent.length,
                }
              )
        );

        const outcome = props.onUploadFilesDetailed
          ? await withTimeout(
              props.onUploadFilesDetailed(filesWithContent),
              8 * 60 * 1000,
              'Upload-Commit Timeout (pipeline)'
            )
          : await (async () => {
              const ingestedCount = await withTimeout(
                props.onUploadFiles(filesWithContent),
                8 * 60 * 1000,
                'Upload-Commit Timeout (pipeline)'
              );
              const skippedCount = Math.max(
                0,
                filesWithContent.length - ingestedCount
              );
              return {
                commitId: 'commit',
                inputCount: filesWithContent.length,
                ingestedCount,
                skippedCount,
                failedCount: 0,
                ocrQueuedCount: 0,
              };
            })();

        setUploadCommitProgress(prev => {
          const base =
            prev ??
            ({
              active: true,
              uploadedCount: 0,
              skippedCount: 0,
              totalCount: files.length,
              batchIndex: 1,
              totalBatches: 1,
              failed: false,
            } satisfies UploadCommitProgress);
          return {
            ...base,
            active: false,
            uploadedCount: outcome.ingestedCount,
            skippedCount: outcome.skippedCount + duplicateCount,
            totalCount: files.length,
            failed: false,
          };
        });

        setStagedUploadFiles([]);
        stagedUploadRefs.current.clear();
        if (outcome.ingestedCount <= 0) {
          setUploadBatchStatus(
            duplicateCount > 0
              ? t.t(
                  'com.affine.caseAssistant.wizard.upload.commit.noneWithDuplicates',
                  {
                    duplicateCount,
                  }
                )
              : t.t('com.affine.caseAssistant.wizard.upload.commit.none')
          );
        } else if (duplicateCount > 0) {
          setUploadBatchStatus(
            t.t(
              'com.affine.caseAssistant.wizard.upload.commit.doneWithDuplicates',
              {
                ingestedCount: outcome.ingestedCount,
                duplicateCount,
              }
            )
          );
        } else {
          setUploadBatchStatus(
            t['com.affine.caseAssistant.wizard.step3.commit.done']()
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? 'unknown');
        setUploadCommitProgress(prev => {
          const base =
            prev ??
            ({
              active: true,
              uploadedCount: 0,
              skippedCount: 0,
              totalCount: files.length,
              batchIndex: 1,
              totalBatches: 1,
              failed: false,
            } satisfies UploadCommitProgress);
          return {
            ...base,
            active: false,
            failed: true,
          };
        });
        setUploadBatchStatus(
          t.t('com.affine.caseAssistant.wizard.upload.commit.failed', {
            message,
          })
        );
        throw error;
      } finally {
        setIsBatchUploading(false);
      }
    },
    [
      documents,
      failedDocumentCount,
      hasMatterContext,
      isBatchUploading,
      needsReviewCount,
      props,
      readyDocumentCount,
      t,
    ]
  );

  const canGoNext = useCallback(() => {
    if (step === 1) {
      // Step 1: Need either selected client or valid client draft name
      return (
        props.selectedClientId !== '' || props.clientDraftName.trim() !== ''
      );
    }
    if (step === 2) {
      // Step 2: existing matter context is sufficient, otherwise need matter title
      return hasMatterContext || props.matterDraftTitle.trim() !== '';
    }
    // Step 3 and 4: Navigation handled by upload/analysis completion
    return false;
  }, [
    step,
    props.selectedClientId,
    props.clientDraftName,
    hasMatterContext,
    props.matterDraftTitle,
  ]);

  const onNext = useCallback(async () => {
    if (step === 1) {
      // Step 1: Validate and create/select client
      if (!props.selectedClientId && !props.clientDraftName.trim()) {
        return;
      }
      if (!props.selectedClientId) {
        await props.onCreateClient();
      }
      goNextVisibleStep();
    } else if (step === 2) {
      // Step 2: If matter context already exists, continue directly.
      if (hasMatterContext) {
        goNextVisibleStep();
        return;
      }
      // Otherwise create a new matter from draft data.
      if (!props.matterDraftTitle.trim()) {
        return;
      }
      await props.onCreateMatter();
      goNextVisibleStep();
    } else if (step === 3) {
      // Step 3: Upload step - navigation handled by upload completion
      return;
    } else if (step === 4) {
      // Step 4: Analysis step - navigation handled by pipeline completion
      return;
    }
  }, [
    step,
    props.selectedClientId,
    props.clientDraftName,
    props.matterDraftTitle,
    props.onCreateClient,
    props.onCreateMatter,
    goNextVisibleStep,
  ]);

  const onFinalize = useCallback(async () => {
    setIsFinalizing(true);
    try {
      await props.onFinalizeOnboarding({
        reviewConfirmed,
        proofNote,
      });
      props.onClose();
    } finally {
      setIsFinalizing(false);
    }
  }, [reviewConfirmed, proofNote, props.onFinalizeOnboarding, props.onClose]);

  const onRunAnalysis = useCallback(async () => {
    setAnalysisStatus(
      t['com.affine.caseAssistant.wizard.status.analysis.running']()
    );
    try {
      await props.onAnalyzeCase();
      setAnalysisStatus(
        t['com.affine.caseAssistant.wizard.status.analysis.completed']()
      );
      return true;
    } catch (error) {
      setAnalysisStatus(
        t['com.affine.caseAssistant.wizard.status.analysis.failed']()
      );
      return false;
    }
  }, [props.onAnalyzeCase, t]);

  const [isDetectingMetadata, setIsDetectingMetadata] = useState(false);
  const onInferMetadata = useCallback(async () => {
    setIsDetectingMetadata(true);
    setDetectionStatus(
      t['com.affine.caseAssistant.wizard.status.detection.running']()
    );
    try {
      const result = await props.onInferOnboardingMetadata();
      if (result) {
        setDetectedMetadata(result);
        setDetectionStatus(
          t['com.affine.caseAssistant.wizard.status.detection.completed']()
        );
      } else {
        setDetectionStatus(
          t['com.affine.caseAssistant.wizard.status.detection.noResults']()
        );
      }
    } catch (error) {
      setDetectionStatus(
        t['com.affine.caseAssistant.wizard.status.detection.failed']()
      );
    } finally {
      setIsDetectingMetadata(false);
    }
  }, [props.onInferOnboardingMetadata, t]);

  useEffect(() => {
    if (isCommitLogCollapsed || !commitLogAutoScroll) {
      return;
    }
    const el = commitLogBodyRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [commitLogEvents, isCommitLogCollapsed, commitLogAutoScroll]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (step === 5) {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        const isTypingSurface =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          Boolean(target?.isContentEditable);

        if (!isTypingSurface) {
          const key = event.key;
          const nextFilter: DocFilter | null =
            key === '1'
              ? 'all'
              : key === '2'
                ? 'problematic'
                : key === '3'
                  ? 'review'
                  : key === '4'
                    ? 'failed'
                    : null;

          if (nextFilter) {
            event.preventDefault();
            setDocFilter(nextFilter);
            setFilterStatus(
              nextFilter === 'all'
                ? t['com.affine.caseAssistant.wizard.status.filterDoc.all']()
                : nextFilter === 'problematic'
                  ? t[
                      'com.affine.caseAssistant.wizard.status.filterDoc.problematic'
                    ]()
                  : nextFilter === 'review'
                    ? t[
                        'com.affine.caseAssistant.wizard.status.filterDoc.review'
                      ]()
                    : t[
                        'com.affine.caseAssistant.wizard.status.filterDoc.failed'
                      ]()
            );
            return;
          }
        }
      }

      if (event.key === 'Tab' && cardRef.current) {
        const focusable = Array.from(
          cardRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) {
          return;
        }
        const first = focusable[0] as HTMLElement | undefined;
        const last = focusable[focusable.length - 1] as HTMLElement | undefined;
        const active = document.activeElement;

        if (!event.shiftKey && active === last) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, props.onClose, step]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        step,
        reviewConfirmed,
        proofNote,
        docFilter,
        uploadDeadLetters: uploadDeadLetters.slice(
          0,
          MAX_UPLOAD_DEAD_LETTER_ITEMS
        ),
      })
    );
  }, [
    isOpen,
    storageKey,
    step,
    reviewConfirmed,
    proofNote,
    docFilter,
    uploadDeadLetters,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const wasOpen = lastInitOpenRef.current;
    const lastKey = lastInitKeyRef.current;
    const shouldInit = isOpen && (!wasOpen || lastKey !== storageKey);
    lastInitOpenRef.current = isOpen;
    lastInitKeyRef.current = storageKey;

    if (!shouldInit) {
      return;
    }

    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          step?: WizardStep;
          reviewConfirmed?: boolean;
          proofNote?: string;
          docFilter?: DocFilter;
          uploadDeadLetters?: UploadDeadLetterItem[];
        };
        if (parsed.step && parsed.step >= 1 && parsed.step <= 5) {
          const restoredStep = parsed.step;
          if (!hasDocuments) {
            setStep(3);
          } else if (visibleSteps.includes(restoredStep)) {
            setStep(restoredStep);
          } else {
            setStep(initialStep);
          }
        } else {
          setStep(initialStep);
        }
        setReviewConfirmed(Boolean(parsed.reviewConfirmed));
        setProofNote(parsed.proofNote ?? '');
        setDocFilter(parsed.docFilter ?? 'all');
        setUploadDeadLetters(
          normalizeUploadDeadLetters(parsed.uploadDeadLetters)
        );
      } catch {
        setStep(initialStep);
        setUploadDeadLetters([]);
      }
    } else {
      setStep(initialStep);
      setReviewConfirmed(false);
      setProofNote('');
      setDocFilter('all');
      setUploadDeadLetters([]);
    }
    setAnalysisStatus(null);
    setDetectionStatus(null);
    setFinalizeStatus(null);
    setFilterStatus(null);
    setStagedUploadFiles([]);
    stagedUploadRefs.current.clear();
    setIsBatchUploading(false);
    setUploadBatchStatus(null);
    setUploadCommitProgress(null);
    setUploadCommitBaseline(null);
    setCommitLogEvents([]);
    setIsCommitLogCollapsed(true);
    setCommitLogAutoScroll(true);
    setCommitLiveMetrics(null);
    setDetectedMetadata(null);
    setHasStartedUploadJourney(false);
    setIsSubmittingStep(false);
    setIsFinalizing(false);
    hasAutoInferredMetadataRef.current = false;
    hasAutoAdvancedAfterCommitRef.current = false;
    hasAutoStep4PipelineRunRef.current = false;
    hasAutoAdvancedToManualReviewRef.current = false;

    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
  }, [hasDocuments, initialStep, isOpen, storageKey, visibleSteps]);

  useEffect(() => {
    if (!isOpen) {
      hasAutoAdvancedAfterCommitRef.current = false;
      return;
    }
    if (step !== 3) {
      hasAutoAdvancedAfterCommitRef.current = false;
      return;
    }
    if (
      !uploadCommitProgress ||
      uploadCommitProgress.active ||
      uploadCommitProgress.failed ||
      isBatchUploading ||
      false
    ) {
      return;
    }
    if (hasAutoAdvancedAfterCommitRef.current) {
      return;
    }

    hasAutoAdvancedAfterCommitRef.current = true;
    setUploadBatchStatus(
      t['com.affine.caseAssistant.wizard.status.commitRedirecting']()
    );
    goNextVisibleStep();
  }, [
    props.isOpen,
    step,
    uploadCommitProgress,
    isBatchUploading,
    hasDocuments,
    t,
    goNextVisibleStep,
  ]);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }
    if (step !== 4) {
      return;
    }
    if (!hasDocuments || hasAutoStep4PipelineRunRef.current) {
      return;
    }

    hasAutoStep4PipelineRunRef.current = true;
    hasAutoInferredMetadataRef.current = true;
    props.runAsyncUiAction(async () => {
      const analysisOk = await onRunAnalysis();
      if (!analysisOk) {
        return;
      }
      await onInferMetadata();

      // After successful OCR + analysis + metadata pipeline, open manual review
      // directly so users do not need to navigate manually.
      if (!hasAutoAdvancedToManualReviewRef.current) {
        hasAutoAdvancedToManualReviewRef.current = true;
        setStepDirection('forward');
        setStep(5);
      }
    }, 'wizard auto pipeline failed');
  }, [
    props.isOpen,
    step,
    hasDocuments,
    onRunAnalysis,
    onInferMetadata,
    props.runAsyncUiAction,
  ]);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }
    const viewport = stepViewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }, [props.isOpen, step]);

  if (!props.isOpen) return null;

  if (typeof document === 'undefined') {
    return null;
  }

  const wizardDialog = (
    <div
      className={wizardStyles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t['com.affine.caseAssistant.wizard.aria.dialog']()}
      data-testid="case-assistant:onboarding-wizard:dialog"
      data-current-step={step}
      ref={overlayRef}
    >
      <div
        className={wizardStyles.card}
        ref={cardRef}
        aria-describedby="case-onboarding-help"
      >
        {/* Header */}
        <div className={wizardStyles.header}>
          <div className={wizardStyles.headerText}>
            <h2 className={wizardStyles.title}>Subsumio – Intake Studio</h2>
            <p className={wizardStyles.subtitle}>
              {t['com.affine.caseAssistant.wizard.subtitle']()}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className={wizardStyles.closeButton}
            aria-label={t['com.affine.caseAssistant.wizard.aria.close']()}
            data-testid="case-assistant:onboarding-wizard:close"
            ref={closeButtonRef}
          >
            ✕
          </button>
        </div>

        {!isUploadMinimalMode && !isUploadCommitPhase ? (
          <div className={wizardStyles.simpleProgressRail}>
            <div className={wizardStyles.simpleProgressTrack}>
              <div
                className={wizardStyles.simpleProgressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className={wizardStyles.simpleProgressCaption}>
              Schritt {visibleStepIndex + 1} von {visibleSteps.length}
            </div>
          </div>
        ) : null}

        <p id="case-onboarding-help" className={wizardStyles.srOnly}>
          {t['com.affine.caseAssistant.wizard.aria.help']()}
        </p>

        <div className={wizardStyles.stepViewport} ref={stepViewportRef}>
          <div className={wizardStyles.stepViewportInner}>
            {!isUploadMinimalMode && !isUploadCommitPhase ? (
              <div className={wizardStyles.simpleStepHeader}>
                <div className={wizardStyles.simpleStepTitle}>
                  {t.t(stepVisualHeadlineKey[step])}
                </div>
              </div>
            ) : null}

            {/* ── Step 1: Mandant ── */}
            {step === 1 ? (
              <div
                className={`${wizardStyles.stepBody} ${wizardStyles.stepPane} ${stepDirection === 'forward' ? wizardStyles.stepPaneForward : wizardStyles.stepPaneBackward}`}
              >
                <p className={wizardStyles.helpText}>
                  {t['com.affine.caseAssistant.wizard.step1.help']()}
                </p>

                {props.clients.length > 0 ? (
                  <label className={wizardStyles.formLabel}>
                    {t[
                      'com.affine.caseAssistant.wizard.step1.existingClient.label'
                    ]()}
                    <select
                      className={styles.input}
                      value={props.selectedClientId}
                      onChange={e => props.setSelectedClientId(e.target.value)}
                    >
                      <option value="">
                        {t[
                          'com.affine.caseAssistant.wizard.step1.newClient.option'
                        ]()}
                      </option>
                      {props.clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.displayName} ({c.kind})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {!props.selectedClientId ? (
                  <>
                    <label className={wizardStyles.formLabel}>
                      {t[
                        'com.affine.caseAssistant.wizard.step1.clientName.label'
                      ]()}
                      <input
                        className={styles.input}
                        value={props.clientDraftName}
                        onChange={e => props.setClientDraftName(e.target.value)}
                        placeholder={t[
                          'com.affine.caseAssistant.wizard.step1.clientName.placeholder'
                        ]()}
                        autoFocus
                      />
                    </label>
                    <label className={wizardStyles.formLabel}>
                      {t[
                        'com.affine.caseAssistant.wizard.step1.clientKind.label'
                      ]()}
                      <select
                        className={styles.input}
                        value={props.clientDraftKind}
                        onChange={e =>
                          props.setClientDraftKind(e.target.value as ClientKind)
                        }
                      >
                        <option value="person">
                          {t[
                            'com.affine.caseAssistant.wizard.step1.clientKind.person'
                          ]()}
                        </option>
                        <option value="company">
                          {t[
                            'com.affine.caseAssistant.wizard.step1.clientKind.company'
                          ]()}
                        </option>
                        <option value="authority">
                          {t[
                            'com.affine.caseAssistant.wizard.step1.clientKind.authority'
                          ]()}
                        </option>
                        <option value="other">
                          {t[
                            'com.affine.caseAssistant.wizard.step1.clientKind.other'
                          ]()}
                        </option>
                      </select>
                    </label>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* ── Step 2: Akte ── */}
            {step === 2 ? (
              <div
                className={`${wizardStyles.stepBody} ${wizardStyles.stepPane} ${stepDirection === 'forward' ? wizardStyles.stepPaneForward : wizardStyles.stepPaneBackward}`}
              >
                <p className={wizardStyles.helpText}>
                  {t['com.affine.caseAssistant.wizard.step2.help']()}
                </p>

                <Button
                  variant="plain"
                  onClick={() =>
                    props.runAsyncUiAction(
                      onInferMetadata,
                      'wizard metadata detection failed'
                    )
                  }
                  disabled={
                    props.isWorkflowBusy || props.documents.length === 0
                  }
                  className={wizardStyles.fullWidthPlainButton}
                >
                  {t['com.affine.caseAssistant.wizard.step2.autofill']()}
                </Button>

                {detectionStatus ? (
                  <div
                    className={wizardStyles.analysisStatus}
                    role="status"
                    aria-live="polite"
                    data-loading={isDetectingMetadata ? 'true' : undefined}
                  >
                    {isDetectingMetadata ? (
                      <span
                        className={wizardStyles.detectionSpinner}
                        aria-hidden="true"
                      />
                    ) : null}
                    {detectionStatus}
                  </div>
                ) : null}

                {detectedMetadata?.evidence?.length ? (
                  <div className={wizardStyles.evidenceList}>
                    {detectedMetadata.evidence
                      .slice(0, 4)
                      .map((item: string) => (
                        <div key={item}>• {item}</div>
                      ))}
                  </div>
                ) : null}

                <label className={wizardStyles.formLabel}>
                  {t[
                    'com.affine.caseAssistant.wizard.step2.matterTitle.label'
                  ]()}
                  <input
                    className={styles.input}
                    value={props.matterDraftTitle}
                    onChange={e => props.setMatterDraftTitle(e.target.value)}
                    placeholder={t[
                      'com.affine.caseAssistant.wizard.step2.matterTitle.placeholder'
                    ]()}
                    autoFocus
                  />
                </label>
                <label className={wizardStyles.formLabel}>
                  {t[
                    'com.affine.caseAssistant.wizard.step2.jurisdiction.label'
                  ]()}
                  <select
                    className={styles.input}
                    value={props.matterDraftJurisdiction}
                    onChange={e =>
                      props.setMatterDraftJurisdiction(
                        e.target.value as Jurisdiction
                      )
                    }
                    aria-required="true"
                  >
                    <option value="AT">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.AT'
                      )}
                    </option>
                    <option value="DE">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.DE'
                      )}
                    </option>
                    <option value="CH">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.CH'
                      )}
                    </option>
                    <option value="EU">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.EU'
                      )}
                    </option>
                    <option value="ECHR">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.ECHR'
                      )}
                    </option>
                    <option value="FR">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.FR'
                      )}
                    </option>
                    <option value="IT">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.IT'
                      )}
                    </option>
                    <option value="PT">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.PT'
                      )}
                    </option>
                    <option value="PL">
                      {t.t(
                        'com.affine.caseAssistant.wizard.step2.jurisdiction.option.PL'
                      )}
                    </option>
                  </select>
                </label>

                <div className={wizardStyles.grid2}>
                  <label className={wizardStyles.formLabel}>
                    {t[
                      'com.affine.caseAssistant.wizard.step2.externalRef.label'
                    ]()}
                    <div className={wizardStyles.row}>
                      <input
                        value={props.matterDraftExternalRef}
                        onChange={e =>
                          props.setMatterDraftExternalRef(e.target.value)
                        }
                        placeholder={t[
                          'com.affine.caseAssistant.wizard.step2.externalRef.placeholder'
                        ]()}
                        className={`${styles.input} ${wizardStyles.flex1}`}
                      />
                      <Button
                        variant="plain"
                        onClick={props.onGenerateNextAktenzeichen}
                        className={wizardStyles.smallActionButton}
                      >
                        {t[
                          'com.affine.caseAssistant.wizard.step2.externalRef.auto'
                        ]()}
                      </Button>
                    </div>
                  </label>

                  <label className={wizardStyles.formLabel}>
                    {t['com.affine.caseAssistant.wizard.step2.court.label']()}
                    <input
                      className={`${styles.input} ${wizardStyles.flex1}`}
                      value={props.matterDraftGericht}
                      onChange={e =>
                        props.setMatterDraftGericht(e.target.value)
                      }
                      placeholder={t[
                        'com.affine.caseAssistant.wizard.step2.court.placeholder'
                      ]()}
                    />
                  </label>
                </div>

                <label className={wizardStyles.formLabel}>
                  {t[
                    'com.affine.caseAssistant.wizard.step2.authorityRefs.label'
                  ]()}
                  <textarea
                    className={styles.input}
                    rows={2}
                    value={props.matterDraftAuthorityReferences}
                    onChange={e =>
                      props.setMatterDraftAuthorityReferences(e.target.value)
                    }
                    placeholder={t[
                      'com.affine.caseAssistant.wizard.step2.authorityRefs.placeholder'
                    ]()}
                  />
                  <span className={wizardStyles.hintMuted}>
                    {t.t(
                      'com.affine.caseAssistant.wizard.step2.authorityRefs.hint',
                      {
                        total: authorityRefs.length,
                        court: authorityRefStats.gericht,
                        da: authorityRefStats.staatsanwaltschaft,
                        police: authorityRefStats.polizei,
                        general: authorityRefStats.allgemein,
                      }
                    )}
                    {authorityRefStats.unbekannt > 0
                      ? t.t(
                          'com.affine.caseAssistant.wizard.step2.authorityRefs.hintUnknown',
                          { count: authorityRefStats.unbekannt }
                        )
                      : ''}
                  </span>
                </label>

                <div className={wizardStyles.grid2}>
                  <label className={wizardStyles.formLabel}>
                    Polizei / Dienststelle
                    <input
                      className={`${styles.input} ${wizardStyles.flex1}`}
                      value={props.matterDraftPolizei}
                      onChange={e =>
                        props.setMatterDraftPolizei(e.target.value)
                      }
                      placeholder="z. B. LKA Wien"
                    />
                  </label>

                  <label className={wizardStyles.formLabel}>
                    Staatsanwaltschaft
                    <input
                      className={`${styles.input} ${wizardStyles.flex1}`}
                      value={props.matterDraftStaatsanwaltschaft}
                      onChange={e =>
                        props.setMatterDraftStaatsanwaltschaft(e.target.value)
                      }
                      placeholder="z. B. StA Wien"
                    />
                  </label>

                  <label className={wizardStyles.formLabel}>
                    Richter / Richterin
                    <input
                      className={`${styles.input} ${wizardStyles.flex1}`}
                      value={props.matterDraftRichter}
                      onChange={e =>
                        props.setMatterDraftRichter(e.target.value)
                      }
                      placeholder="z. B. Dr. Max Mustermann"
                    />
                  </label>

                  <label className={wizardStyles.formLabel}>
                    Gerichts-Aktenzeichen
                    <input
                      className={`${styles.input} ${wizardStyles.flex1}`}
                      value={props.matterDraftGerichtsaktenzeichen}
                      onChange={e =>
                        props.setMatterDraftGerichtsaktenzeichen(e.target.value)
                      }
                      placeholder="z. B. 25 Cg 12/26t"
                    />
                  </label>

                  <label className={wizardStyles.formLabel}>
                    StA-Aktenzeichen
                    <input
                      className={`${styles.input} ${wizardStyles.flex1}`}
                      value={props.matterDraftStaatsanwaltschaftAktenzeichen}
                      onChange={e =>
                        props.setMatterDraftStaatsanwaltschaftAktenzeichen(
                          e.target.value
                        )
                      }
                      placeholder="z. B. 123 St 45/26"
                    />
                  </label>

                  <label className={wizardStyles.formLabel}>
                    Polizei-Aktenzeichen
                    <input
                      className={`${styles.input} ${wizardStyles.flex1}`}
                      value={props.matterDraftPolizeiAktenzeichen}
                      onChange={e =>
                        props.setMatterDraftPolizeiAktenzeichen(e.target.value)
                      }
                      placeholder="z. B. PI-2026-00421"
                    />
                  </label>
                </div>

                {props.anwaelte.length > 0 ? (
                  <label className={wizardStyles.formLabel}>
                    {t['com.affine.caseAssistant.wizard.step2.lawyer.label']()}
                    <select
                      className={styles.input}
                      value={props.matterDraftAssignedAnwaltId}
                      onChange={e =>
                        props.setMatterDraftAssignedAnwaltId(e.target.value)
                      }
                    >
                      <option value="">
                        {t[
                          'com.affine.caseAssistant.wizard.step2.lawyer.unassigned'
                        ]()}
                      </option>
                      {props.anwaelte
                        .filter(a => a.isActive)
                        .map(a => (
                          <option key={a.id} value={a.id}>
                            {a.title} {a.firstName} {a.lastName}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}

                {/* Warnungen für optionale Felder (nicht blockierend) */}
                <div className={wizardStyles.optionalFieldsWarnings}>
                  {!props.matterDraftExternalRef.trim() ? (
                    <div className={wizardStyles.bannerInfo} role="status">
                      <strong>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step2.optional.externalRef.title'
                        )}
                      </strong>
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step2.optional.externalRef.body'
                        )}
                      </div>
                    </div>
                  ) : null}

                  {!props.matterDraftGericht.trim() ? (
                    <div className={wizardStyles.bannerInfo} role="status">
                      <strong>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step2.optional.court.title'
                        )}
                      </strong>
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step2.optional.court.body'
                        )}
                      </div>
                    </div>
                  ) : null}

                  {!props.matterDraftAssignedAnwaltId &&
                  props.anwaelte.length > 0 ? (
                    <div className={wizardStyles.bannerInfo} role="status">
                      <strong>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step2.optional.lawyer.title'
                        )}
                      </strong>
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step2.optional.lawyer.body'
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* ── Step 3: Upload ── */}
            {step === 3 ? (
              <div
                className={`${wizardStyles.stepBody} ${wizardStyles.stepPane} ${stepDirection === 'forward' ? wizardStyles.stepPaneForward : wizardStyles.stepPaneBackward}`}
              >
                {!hasMatterContext ? (
                  <div
                    className={wizardStyles.bannerWarn}
                    role="alert"
                    style={{ marginBottom: 10 }}
                  >
                    <div>
                      {t.t('com.affine.caseAssistant.wizard.step3.gate.banner')}
                    </div>
                    <div className={wizardStyles.row} style={{ marginTop: 10 }}>
                      <Button
                        variant="primary"
                        disabled={props.isWorkflowBusy || isBatchUploading}
                        onClick={() => setStep(2)}
                      >
                        {t.t(
                          'com.affine.caseAssistant.wizard.step3.gate.button'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isUploadCommitPhase ? (
                  <div
                    className={wizardStyles.helpText}
                    role="status"
                    aria-live="polite"
                  >
                    {t[
                      'com.affine.caseAssistant.wizard.step3.commitPhase.hint'
                    ]()}
                  </div>
                ) : null}

                {showCommitProgressCard && uploadCommitProgress ? (
                  <div
                    className={clsx(
                      wizardStyles.uploadCommitProgressCard,
                      wizardStyles.uploadSubstepSurface,
                      wizardStyles.uploadSubstepCommit
                    )}
                    role="status"
                    aria-live="polite"
                    aria-busy={uploadCommitProgress.active ? 'true' : 'false'}
                  >
                    <div className={wizardStyles.uploadCommitProgressHeader}>
                      <strong>
                        {uploadCommitProgress.active
                          ? t[
                              'com.affine.caseAssistant.wizard.step3.commit.running'
                            ]()
                          : uploadCommitProgress.failed
                            ? t[
                                'com.affine.caseAssistant.wizard.step3.commit.interrupted'
                              ]()
                            : t[
                                'com.affine.caseAssistant.wizard.step3.commit.done'
                              ]()}
                      </strong>
                      <span>{visibleUploadCommitPercent}%</span>
                    </div>
                    <div className={wizardStyles.uploadCommitProgressTrack}>
                      <div
                        className={wizardStyles.uploadCommitProgressFill}
                        data-active={
                          uploadCommitProgress.active ? 'true' : 'false'
                        }
                        style={{ width: `${visibleUploadCommitPercent}%` }}
                      />
                    </div>
                    <div className={wizardStyles.uploadCommitProgressMeta}>
                      <span>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step3.commit.files',
                          {
                            uploaded: uploadCommitProgress.uploadedCount,
                            total: uploadCommitProgress.totalCount,
                          }
                        )}
                      </span>
                      <span>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step3.commit.batch',
                          {
                            current: Math.max(
                              uploadCommitProgress.batchIndex,
                              1
                            ),
                            total: uploadCommitProgress.totalBatches,
                          }
                        )}
                      </span>
                      <span
                        className={wizardStyles.uploadCommitMetaChip}
                        data-tone="success"
                      >
                        {t.t('com.affine.caseAssistant.wizard.kpi.ready', {
                          count: uploadCommitDelta?.ready ?? 0,
                        })}
                      </span>
                      <span
                        className={wizardStyles.uploadCommitMetaChip}
                        data-tone="warning"
                      >
                        {t.t('com.affine.caseAssistant.wizard.kpi.review', {
                          count: uploadCommitDelta?.review ?? 0,
                        })}
                      </span>
                      <span
                        className={wizardStyles.uploadCommitMetaChip}
                        data-tone="error"
                      >
                        {t.t('com.affine.caseAssistant.wizard.kpi.failed', {
                          count: uploadCommitDelta?.failed ?? 0,
                        })}
                      </span>
                      <span className={wizardStyles.uploadCommitMetaChip}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step3.commit.skipped',
                          {
                            count: uploadCommitProgress.skippedCount,
                          }
                        )}
                      </span>
                    </div>

                    <div className={wizardStyles.commitTerminalPanel}>
                      <div className={wizardStyles.commitTerminalHeader}>
                        <button
                          type="button"
                          className={wizardStyles.commitTerminalToggle}
                          onClick={() => setIsCommitLogCollapsed(v => !v)}
                          aria-label={
                            isCommitLogCollapsed
                              ? t.t(
                                  'com.affine.caseAssistant.wizard.step3.commitLog.toggle.show.aria'
                                )
                              : t.t(
                                  'com.affine.caseAssistant.wizard.step3.commitLog.toggle.hide.aria'
                                )
                          }
                        >
                          <strong>
                            {t.t(
                              'com.affine.caseAssistant.wizard.step3.commitLog.title'
                            )}
                            {commitLiveMetrics
                              ? ` · ${commitLiveMetrics.fileCurrent}/${commitLiveMetrics.fileTotal}`
                              : ''}
                          </strong>
                          <span className={wizardStyles.commitTerminalHint}>
                            {commitLiveMetrics
                              ? `${commitLiveMetrics.throughput.toFixed(1)}/s · ETA ${formatEta(commitLiveMetrics.etaSec)}`
                              : isCommitLogCollapsed
                                ? t.t(
                                    'com.affine.caseAssistant.wizard.step3.commitLog.details'
                                  )
                                : t.t(
                                    'com.affine.caseAssistant.wizard.step3.commitLog.compact'
                                  )}
                          </span>
                        </button>
                        <div className={wizardStyles.commitTerminalActions}>
                          {commitLogEvents.length > 0 ? (
                            <label
                              className={wizardStyles.commitTerminalToggle}
                            >
                              <input
                                type="checkbox"
                                checked={commitLogAutoScroll}
                                onChange={e =>
                                  setCommitLogAutoScroll(e.target.checked)
                                }
                                aria-label={t.t(
                                  'com.affine.caseAssistant.wizard.step3.commitLog.autoscroll.aria'
                                )}
                              />
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.commitLog.autoscroll'
                              )}
                            </label>
                          ) : null}
                          <button
                            type="button"
                            className={wizardStyles.commitTerminalCopy}
                            onClick={() => {
                              copyCommitLogToClipboard().catch(() => {
                                // status feedback is handled in copyCommitLogToClipboard
                              });
                            }}
                            disabled={commitLogEvents.length === 0}
                            aria-label={t.t(
                              'com.affine.caseAssistant.wizard.step3.commitLog.copy.aria'
                            )}
                          >
                            {t.t(
                              'com.affine.caseAssistant.wizard.step3.commitLog.copy'
                            )}
                          </button>
                        </div>
                      </div>
                      <div
                        ref={commitLogBodyRef}
                        className={wizardStyles.commitTerminalBody}
                        data-collapsed={isCommitLogCollapsed ? 'true' : 'false'}
                        role="log"
                        aria-live="polite"
                        aria-relevant="additions"
                      >
                        {(commitLogEvents.length === 0
                          ? [
                              {
                                id: 'empty',
                                ts: Date.now(),
                                level: 'info' as const,
                                label: t.t(
                                  'com.affine.caseAssistant.wizard.step3.commitLog.empty'
                                ),
                              } as CommitLogEvent,
                            ]
                          : commitLogEvents
                        )
                          .slice(
                            Math.max(
                              0,
                              commitLogEvents.length -
                                (isCommitLogCollapsed ? 6 : 120)
                            )
                          )
                          .map(item => (
                            <div
                              key={item.id}
                              className={wizardStyles.commitTerminalLine}
                              data-level={item.level}
                              title={formatCommitLogLine(item)}
                            >
                              {formatCommitLogLine(item)}
                            </div>
                          ))}
                      </div>
                    </div>

                    {isUploadRecoveryMode && !uploadCommitProgress.active ? (
                      <>
                        <div
                          className={wizardStyles.recoveryActions}
                          style={{ marginTop: 10 }}
                        >
                          <Button
                            variant="primary"
                            disabled={
                              props.isWorkflowBusy ||
                              isBatchUploading ||
                              retryableDeadLetterCount <= 0
                            }
                            onClick={() =>
                              props.runAsyncUiAction(
                                onRetryDeadLetterBatch,
                                'wizard dead-letter retry failed'
                              )
                            }
                          >
                            {t.t(
                              'com.affine.caseAssistant.wizard.step3.commit.retryRejected',
                              {
                                count: retryableDeadLetterCount,
                              }
                            )}
                          </Button>
                          <Button
                            variant="plain"
                            disabled={props.isWorkflowBusy || isBatchUploading}
                            onClick={onReturnToUploadSelect}
                          >
                            {t[
                              'com.affine.caseAssistant.wizard.step3.addMoreFiles'
                            ]()}
                          </Button>
                        </div>

                        {firstCommitFailureDiagnostic ||
                        deadLetterPreview.length > 0 ? (
                          <details
                            className={wizardStyles.recoveryDetails}
                            style={{ marginTop: 10 }}
                          >
                            <summary className={wizardStyles.recoverySummary}>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.recovery.details'
                              )}
                            </summary>

                            {firstCommitFailureDiagnostic ? (
                              <div
                                className={wizardStyles.bannerWarn}
                                role="alert"
                                style={{ marginTop: 10 }}
                              >
                                <strong>
                                  {t.t(
                                    'com.affine.caseAssistant.wizard.step4.diagnostics.firstError',
                                    {
                                      causeLabel:
                                        firstCommitFailureDiagnostic.causeLabel,
                                      title: firstCommitFailureDiagnostic.title,
                                    }
                                  )}
                                </strong>
                                <div style={{ marginTop: 6 }}>
                                  {firstCommitFailureDiagnostic.reason}
                                </div>
                                <div
                                  className={wizardStyles.hintMuted}
                                  style={{ marginTop: 6 }}
                                >
                                  {t.t(
                                    'com.affine.caseAssistant.wizard.step4.diagnostics.nextStepPrefix',
                                    {
                                      value:
                                        firstCommitFailureDiagnostic.nextStepHint,
                                    }
                                  )}
                                </div>
                                <div
                                  className={wizardStyles.hintMuted}
                                  style={{ marginTop: 4 }}
                                >
                                  {t.t(
                                    'com.affine.caseAssistant.wizard.step4.diagnostics.solutionPrefix',
                                    {
                                      value:
                                        firstCommitFailureDiagnostic.recommendation,
                                    }
                                  )}
                                </div>
                                <div
                                  className={wizardStyles.row}
                                  style={{ marginTop: 10 }}
                                >
                                  {firstCommitFailureDiagnostic.prioritizeOcr ? (
                                    <>
                                      <Button
                                        variant="primary"
                                        disabled={
                                          props.isWorkflowBusy ||
                                          isBatchUploading
                                        }
                                        onClick={() =>
                                          props.runAsyncUiAction(
                                            props.onProcessOcr,
                                            'wizard immediate ocr retry failed'
                                          )
                                        }
                                      >
                                        {t[
                                          'com.affine.caseAssistant.wizard.step4.diagnostics.ocrRetry'
                                        ]()}
                                      </Button>
                                      <Button
                                        variant="plain"
                                        disabled={
                                          props.isWorkflowBusy ||
                                          isBatchUploading
                                        }
                                        onClick={() =>
                                          props.runAsyncUiAction(
                                            onRunAnalysis,
                                            'wizard immediate analysis retry failed'
                                          )
                                        }
                                      >
                                        {t[
                                          'com.affine.caseAssistant.wizard.step4.diagnostics.analysisRetry'
                                        ]()}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="primary"
                                        disabled={
                                          props.isWorkflowBusy ||
                                          isBatchUploading
                                        }
                                        onClick={() =>
                                          props.runAsyncUiAction(
                                            onRunAnalysis,
                                            'wizard immediate analysis retry failed'
                                          )
                                        }
                                      >
                                        {t[
                                          'com.affine.caseAssistant.wizard.step4.diagnostics.analysisRetry'
                                        ]()}
                                      </Button>
                                      <Button
                                        variant="plain"
                                        disabled={
                                          props.isWorkflowBusy ||
                                          isBatchUploading
                                        }
                                        onClick={() =>
                                          props.runAsyncUiAction(
                                            props.onProcessOcr,
                                            'wizard immediate ocr retry failed'
                                          )
                                        }
                                      >
                                        {t[
                                          'com.affine.caseAssistant.wizard.step4.diagnostics.ocrRetry'
                                        ]()}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ) : null}

                            {deadLetterPreview.length > 0 ? (
                              <div
                                className={wizardStyles.prequalificationCard}
                                style={{ marginTop: 10 }}
                              >
                                <div
                                  className={
                                    wizardStyles.prequalificationHeader
                                  }
                                >
                                  <strong>
                                    {t.t(
                                      'com.affine.caseAssistant.wizard.step3.commit.deadLetterTitle',
                                      {
                                        count: uploadDeadLetters.length,
                                      }
                                    )}
                                  </strong>
                                  <span>
                                    {t.t(
                                      'com.affine.caseAssistant.wizard.step3.commit.retryableCount',
                                      {
                                        count: retryableDeadLetterCount,
                                      }
                                    )}
                                  </span>
                                </div>
                                <div
                                  className={
                                    wizardStyles.prequalificationRiskList
                                  }
                                >
                                  {deadLetterPreview.map(item => {
                                    const friendlyReason =
                                      item.reasonCode === 'intake-timeout'
                                        ? t.t(
                                            'com.affine.caseAssistant.wizard.step3.deadLetter.reason.intakeTimeout'
                                          )
                                        : item.reasonCode ===
                                            'permission-denied'
                                          ? t.t(
                                              'com.affine.caseAssistant.wizard.step3.deadLetter.reason.permissionDenied'
                                            )
                                          : item.reasonCode === 'content-empty'
                                            ? t.t(
                                                'com.affine.caseAssistant.wizard.step3.deadLetter.reason.contentEmpty'
                                              )
                                            : item.reasonCode === 'read-empty'
                                              ? t.t(
                                                  'com.affine.caseAssistant.wizard.step3.deadLetter.reason.readEmpty'
                                                )
                                              : item.reasonCode === 'read-error'
                                                ? t.t(
                                                    'com.affine.caseAssistant.wizard.step3.deadLetter.reason.readError'
                                                  )
                                                : t.t(
                                                    'com.affine.caseAssistant.wizard.step3.deadLetter.reason.generic'
                                                  );
                                    return (
                                      <div
                                        key={item.fileKey}
                                        className={
                                          wizardStyles.prequalificationRiskItem
                                        }
                                      >
                                        <strong>{item.fileName}</strong>
                                        <span>
                                          {friendlyReason}
                                          {item.retryCount > 1
                                            ? t.t(
                                                'com.affine.caseAssistant.wizard.step3.deadLetter.retryAttempt',
                                                { count: item.retryCount }
                                              )
                                            : ''}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </details>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {firstCommitFailureDiagnostic ? (
                          <div
                            className={wizardStyles.bannerWarn}
                            role="alert"
                            style={{ marginTop: 10 }}
                          >
                            <strong>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.recovery.firstErrorLegacy',
                                {
                                  causeLabel:
                                    firstCommitFailureDiagnostic.causeLabel,
                                  title: firstCommitFailureDiagnostic.title,
                                }
                              )}
                            </strong>
                            <div style={{ marginTop: 6 }}>
                              {firstCommitFailureDiagnostic.reason}
                            </div>
                            <div
                              className={wizardStyles.hintMuted}
                              style={{ marginTop: 6 }}
                            >
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.recovery.nextStepLegacy',
                                {
                                  value:
                                    firstCommitFailureDiagnostic.nextStepHint,
                                }
                              )}
                            </div>
                            <div
                              className={wizardStyles.hintMuted}
                              style={{ marginTop: 4 }}
                            >
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.recovery.solutionLegacy',
                                {
                                  value:
                                    firstCommitFailureDiagnostic.recommendation,
                                }
                              )}
                            </div>
                            <div
                              className={wizardStyles.row}
                              style={{ marginTop: 10 }}
                            >
                              {firstCommitFailureDiagnostic.prioritizeOcr ? (
                                <>
                                  <Button
                                    variant="primary"
                                    disabled={
                                      props.isWorkflowBusy || isBatchUploading
                                    }
                                    onClick={() =>
                                      props.runAsyncUiAction(
                                        props.onProcessOcr,
                                        'wizard immediate ocr retry failed'
                                      )
                                    }
                                  >
                                    {t[
                                      'com.affine.caseAssistant.wizard.step4.diagnostics.ocrRetry'
                                    ]()}
                                  </Button>
                                  <Button
                                    variant="plain"
                                    disabled={
                                      props.isWorkflowBusy || isBatchUploading
                                    }
                                    onClick={() =>
                                      props.runAsyncUiAction(
                                        onRunAnalysis,
                                        'wizard immediate analysis retry failed'
                                      )
                                    }
                                  >
                                    {t[
                                      'com.affine.caseAssistant.wizard.step4.diagnostics.analysisRetry'
                                    ]()}
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="primary"
                                    disabled={
                                      props.isWorkflowBusy || isBatchUploading
                                    }
                                    onClick={() =>
                                      props.runAsyncUiAction(
                                        onRunAnalysis,
                                        'wizard immediate analysis retry failed'
                                      )
                                    }
                                  >
                                    {t[
                                      'com.affine.caseAssistant.wizard.step4.diagnostics.analysisRetry'
                                    ]()}
                                  </Button>
                                  <Button
                                    variant="plain"
                                    disabled={
                                      props.isWorkflowBusy || isBatchUploading
                                    }
                                    onClick={() =>
                                      props.runAsyncUiAction(
                                        props.onProcessOcr,
                                        'wizard immediate ocr retry failed'
                                      )
                                    }
                                  >
                                    {t[
                                      'com.affine.caseAssistant.wizard.step4.diagnostics.ocrRetry'
                                    ]()}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {deadLetterPreview.length > 0 &&
                        !uploadCommitProgress.active ? (
                          <div
                            className={wizardStyles.prequalificationCard}
                            style={{ marginTop: 10 }}
                          >
                            <div
                              className={wizardStyles.prequalificationHeader}
                            >
                              <strong>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step3.commit.deadLetterTitle',
                                  {
                                    count: uploadDeadLetters.length,
                                  }
                                )}
                              </strong>
                              <span>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step3.commit.retryableCount',
                                  {
                                    count: retryableDeadLetterCount,
                                  }
                                )}
                              </span>
                            </div>
                            <div
                              className={wizardStyles.prequalificationRiskList}
                            >
                              {deadLetterPreview.map(item => {
                                const friendlyReason =
                                  item.reasonCode === 'intake-timeout'
                                    ? t.t(
                                        'com.affine.caseAssistant.wizard.step3.deadLetter.reason.intakeTimeout'
                                      )
                                    : item.reasonCode === 'permission-denied'
                                      ? t.t(
                                          'com.affine.caseAssistant.wizard.step3.deadLetter.reason.permissionDenied'
                                        )
                                      : item.reasonCode === 'content-empty'
                                        ? t.t(
                                            'com.affine.caseAssistant.wizard.step3.deadLetter.reason.contentEmpty'
                                          )
                                        : item.reasonCode === 'read-empty'
                                          ? t.t(
                                              'com.affine.caseAssistant.wizard.step3.deadLetter.reason.readEmpty'
                                            )
                                          : item.reasonCode === 'read-error'
                                            ? t.t(
                                                'com.affine.caseAssistant.wizard.step3.deadLetter.reason.readError'
                                              )
                                            : t.t(
                                                'com.affine.caseAssistant.wizard.step3.deadLetter.reason.generic'
                                              );
                                return (
                                  <div
                                    key={item.fileKey}
                                    className={
                                      wizardStyles.prequalificationRiskItem
                                    }
                                  >
                                    <strong>{item.fileName}</strong>
                                    <span>
                                      {friendlyReason}
                                      {item.retryCount > 1
                                        ? t.t(
                                            'com.affine.caseAssistant.wizard.step3.deadLetter.retryAttempt',
                                            { count: item.retryCount }
                                          )
                                        : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div
                              className={wizardStyles.row}
                              style={{ marginTop: 10 }}
                            >
                              <Button
                                variant="primary"
                                disabled={
                                  props.isWorkflowBusy ||
                                  isBatchUploading ||
                                  retryableDeadLetterCount <= 0
                                }
                                onClick={() =>
                                  props.runAsyncUiAction(
                                    onRetryDeadLetterBatch,
                                    'wizard dead-letter retry failed'
                                  )
                                }
                              >
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step3.commit.retryRejected',
                                  {
                                    count: retryableDeadLetterCount,
                                  }
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                {shouldRenderUploadSelectPanel && !isUploadRecoveryMode ? (
                  <div
                    className={clsx(
                      wizardStyles.uploadStagePanel,
                      wizardStyles.uploadSubstepSurface,
                      wizardStyles.uploadSubstepSelect,
                      isUploadSelectExiting &&
                        wizardStyles.uploadSubstepSelectExit
                    )}
                    data-substep="select"
                  >
                    <FileUploadZone
                      onFilesReady={files => onStageFilesForUpload(files)}
                      onStagedRefsReady={onStagedRefsReady}
                      disabled={isUploadDisabled}
                      autoSubmitFolderSelection={false}
                    />
                    <div
                      className={wizardStyles.hintMuted}
                      style={{ marginTop: 8 }}
                    >
                      {t[
                        'com.affine.caseAssistant.wizard.step3.selectOnly.hint'
                      ]()}
                    </div>
                  </div>
                ) : null}

                {showUploadReviewPanel && !isUploadRecoveryMode ? (
                  <div
                    className={clsx(
                      wizardStyles.uploadStagePanelMuted,
                      wizardStyles.uploadSubstepSurface,
                      wizardStyles.uploadSubstepReview
                    )}
                    data-substep={uploadSubstep}
                  >
                    <div className={wizardStyles.uploadChecklist}>
                      <div
                        dangerouslySetInnerHTML={{
                          __html:
                            t[
                              'com.affine.caseAssistant.wizard.step3.checklist.select'
                            ](),
                        }}
                      />
                      <div
                        dangerouslySetInnerHTML={{
                          __html:
                            t[
                              'com.affine.caseAssistant.wizard.step3.checklist.review'
                            ](),
                        }}
                      />
                      <div
                        dangerouslySetInnerHTML={{
                          __html:
                            t[
                              'com.affine.caseAssistant.wizard.step3.checklist.commit'
                            ](),
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {hasStagedUploadFiles &&
                !isUploadCommitPhase &&
                !isUploadRecoveryMode ? (
                  <div
                    className={clsx(
                      wizardStyles.uploadBatchCard,
                      wizardStyles.uploadSubstepSurface,
                      wizardStyles.uploadSubstepReview
                    )}
                    data-substep={uploadSubstep}
                    role="status"
                    aria-live="polite"
                  >
                    <div className={wizardStyles.uploadBatchHeader}>
                      <strong>
                        {t[
                          'com.affine.caseAssistant.wizard.step3.staging.title'
                        ]()}
                      </strong>
                      <span>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step3.staging.fileCount',
                          { count: stagedUploadFiles.length }
                        )}
                      </span>
                    </div>
                    <div className={wizardStyles.uploadBatchStats}>
                      <span>PDF: {stagedUploadStats.pdfCount}</span>
                      <span>Scan-PDF: {stagedUploadStats.scanPdfCount}</span>
                      <span>DOCX: {stagedUploadStats.docxCount}</span>
                      <span>E-Mail: {stagedUploadStats.emailCount}</span>
                      {stagedUploadStats.otherCount > 0 ? (
                        <span>
                          {t.t(
                            'com.affine.caseAssistant.wizard.step3.staging.other',
                            { count: stagedUploadStats.otherCount }
                          )}
                        </span>
                      ) : null}
                      <span>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step3.staging.size',
                          {
                            size: (
                              stagedUploadStats.totalSizeBytes /
                              (1024 * 1024)
                            ).toFixed(1),
                          }
                        )}
                      </span>
                    </div>

                    {stagedDuplicateSummary.duplicateCount > 0 ? (
                      <div
                        className={wizardStyles.bannerInfo}
                        role="status"
                        style={{ marginTop: 10 }}
                      >
                        <strong>
                          {t.t(
                            'com.affine.caseAssistant.wizard.step3.duplicates.title'
                          )}
                        </strong>
                        <div style={{ marginTop: 6, fontSize: 12 }}>
                          {t.t(
                            'com.affine.caseAssistant.wizard.step3.duplicates.body',
                            {
                              duplicateCount:
                                stagedDuplicateSummary.duplicateCount,
                            }
                          )}
                          {stagedDuplicateSummary.freshCount > 0
                            ? t.t(
                                'com.affine.caseAssistant.wizard.step3.duplicates.freshSuffix',
                                {
                                  freshCount: stagedDuplicateSummary.freshCount,
                                }
                              )
                            : t.t(
                                'com.affine.caseAssistant.wizard.step3.duplicates.noneFreshSuffix'
                              )}
                        </div>
                        {stagedDuplicateFilePreview.length > 0 ? (
                          <ul
                            style={{
                              marginTop: 8,
                              marginBottom: 0,
                              paddingLeft: 18,
                              fontSize: 12,
                            }}
                          >
                            {stagedDuplicateFilePreview.map(name => (
                              <li key={name}>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step3.duplicates.item',
                                  {
                                    name,
                                  }
                                )}
                              </li>
                            ))}
                            {stagedDuplicateSummary.duplicateCount >
                            stagedDuplicateFilePreview.length ? (
                              <li>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step3.duplicates.more',
                                  {
                                    count:
                                      stagedDuplicateSummary.duplicateCount -
                                      stagedDuplicateFilePreview.length,
                                  }
                                )}
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {stagedPdfPrequalification.totalPdf > 0 ? (
                      <div className={wizardStyles.prequalificationCard}>
                        <div className={wizardStyles.prequalificationHeader}>
                          <strong>
                            {t[
                              'com.affine.caseAssistant.wizard.step3.preflight.title'
                            ]()}
                          </strong>
                          <span>
                            {t.t(
                              'com.affine.caseAssistant.wizard.step3.preflight.files',
                              {
                                count: stagedPdfPrequalification.totalPdf,
                              }
                            )}
                          </span>
                        </div>
                        <div className={wizardStyles.prequalificationStats}>
                          {stagedPdfPrequalification.readableLikelyCount >
                            0 && (
                            <span>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.preflight.readableInstant',
                                {
                                  count:
                                    stagedPdfPrequalification.readableLikelyCount,
                                }
                              )}
                            </span>
                          )}
                          {stagedPdfPrequalification.ocrRouteCount > 0 && (
                            <span>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.preflight.ocrNeeded',
                                {
                                  count:
                                    stagedPdfPrequalification.ocrRouteCount,
                                }
                              )}
                            </span>
                          )}
                          {stagedPdfPrequalification.warningCount > 0 && (
                            <span>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.preflight.largeFiles',
                                {
                                  count: stagedPdfPrequalification.warningCount,
                                }
                              )}
                            </span>
                          )}
                          {stagedPdfPrequalification.likelyBlockedCount > 0 && (
                            <span>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step3.preflight.problematicFiles',
                                {
                                  count:
                                    stagedPdfPrequalification.likelyBlockedCount,
                                }
                              )}
                            </span>
                          )}
                        </div>
                        {stagedPdfPrequalification.topRisks.length > 0 ? (
                          <div
                            className={wizardStyles.prequalificationRiskList}
                          >
                            {stagedPdfPrequalification.topRisks.map(item => (
                              <div
                                key={item.fileKey}
                                className={
                                  wizardStyles.prequalificationRiskItem
                                }
                              >
                                <strong>{item.fileName}</strong>
                                <span>
                                  {item.reasons[0] ??
                                    t[
                                      'com.affine.caseAssistant.wizard.step3.preflight.fallbackRisk'
                                    ]()}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={wizardStyles.hintMuted}>
                            {t[
                              'com.affine.caseAssistant.wizard.step3.preflight.noRisks'
                            ]()}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className={wizardStyles.uploadBatchActions}>
                      <Button
                        variant="primary"
                        className={wizardStyles.uploadActionPrimary}
                        disabled={
                          props.isWorkflowBusy ||
                          isBatchUploading ||
                          !canUploadDocuments ||
                          !hasMatterContext
                        }
                        data-testid="case-assistant:onboarding-wizard:commit-all"
                        onClick={() =>
                          props.runAsyncUiAction(
                            () => onCommitStagedUploadFiles(stagedUploadFiles),
                            'wizard staged upload all failed'
                          )
                        }
                      >
                        {t.t(
                          'com.affine.caseAssistant.wizard.step3.commitAll',
                          {
                            count:
                              stagedDuplicateSummary.freshCount > 0
                                ? stagedDuplicateSummary.freshCount
                                : stagedUploadFiles.length,
                          }
                        )}
                      </Button>
                    </div>
                    {uploadBatchStatus ? (
                      <div className={wizardStyles.analysisStatus}>
                        {uploadBatchStatus}
                      </div>
                    ) : null}
                    {hasDocuments ? (
                      <div className={wizardStyles.uploadBatchFooter}>
                        <Button
                          variant="plain"
                          className={wizardStyles.uploadBatchNextButton}
                          disabled={props.isWorkflowBusy || isBatchUploading}
                          data-testid="case-assistant:onboarding-wizard:step3-continue"
                          onClick={goNextVisibleStep}
                        >
                          {t['com.affine.caseAssistant.wizard.nav.next']()}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!canUploadDocuments ? (
                  <div className={wizardStyles.bannerWarn} role="alert">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: t.t(
                          'com.affine.caseAssistant.wizard.step3.roleBlocked',
                          { role: props.currentRole }
                        ),
                      }}
                    />
                    <div className={wizardStyles.row} style={{ marginTop: 10 }}>
                      <Button
                        variant="primary"
                        onClick={() =>
                          props.runAsyncUiAction(
                            () => props.onRoleChange('operator'),
                            'wizard role elevate failed'
                          )
                        }
                        disabled={props.isWorkflowBusy}
                      >
                        {t[
                          'com.affine.caseAssistant.wizard.step3.elevateRole'
                        ]()}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {props.isWorkflowBusy ? (
                  <div
                    className={wizardStyles.hintMuted}
                    role="status"
                    aria-live="polite"
                  >
                    {t['com.affine.caseAssistant.wizard.step3.workflowBusy']()}
                  </div>
                ) : null}

                {hasCommitFailure &&
                uploadSubstep === 'commit' &&
                props.documents.length > 0 &&
                !isUploadRecoveryMode ? (
                  <div
                    className={wizardStyles.bannerOk}
                    data-commit-reveal="true"
                  >
                    {t.t('com.affine.caseAssistant.wizard.step3.docsIngested', {
                      count: props.documents.length,
                    })}
                  </div>
                ) : null}

                {isUploadCommitPhase && !isUploadRecoveryMode ? (
                  <div className={wizardStyles.row}>
                    <Button
                      variant="plain"
                      disabled={isBatchUploading || props.isWorkflowBusy}
                      onClick={onReturnToUploadSelect}
                    >
                      {t[
                        'com.affine.caseAssistant.wizard.step3.addMoreFiles'
                      ]()}
                    </Button>
                  </div>
                ) : null}

                {hasCommitFailure &&
                uploadSubstep === 'commit' &&
                props.documents.length > 0 &&
                !isUploadRecoveryMode ? (
                  <div
                    className={wizardStyles.uploadStatsGrid}
                    data-commit-reveal="true"
                  >
                    <div className={wizardStyles.uploadStatCard}>
                      <div className={wizardStyles.uploadStatValue}>
                        {props.documents.length}
                      </div>
                      <div className={wizardStyles.uploadStatLabel}>
                        {t[
                          'com.affine.caseAssistant.wizard.step3.stats.documents'
                        ]()}
                      </div>
                    </div>
                    <div className={wizardStyles.uploadStatCard}>
                      <div className={wizardStyles.uploadStatValue}>
                        {readyDocumentCount}
                      </div>
                      <div className={wizardStyles.uploadStatLabel}>
                        {t[
                          'com.affine.caseAssistant.wizard.step3.stats.processed'
                        ]()}
                      </div>
                    </div>
                    <div
                      className={wizardStyles.uploadStatCard}
                      data-tone="warning"
                    >
                      <div className={wizardStyles.uploadStatValue}>
                        {needsReviewCount}
                      </div>
                      <div className={wizardStyles.uploadStatLabel}>
                        {t[
                          'com.affine.caseAssistant.wizard.step3.stats.review'
                        ]()}
                      </div>
                    </div>
                    <div
                      className={wizardStyles.uploadStatCard}
                      data-tone="error"
                    >
                      <div className={wizardStyles.uploadStatValue}>
                        {failedDocumentCount}
                      </div>
                      <div className={wizardStyles.uploadStatLabel}>
                        {t[
                          'com.affine.caseAssistant.wizard.step3.stats.failed'
                        ]()}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ── Step 4: Analysis ── */}
            {step === 4 ? (
              <div
                className={`${wizardStyles.stepBody} ${wizardStyles.stepPane} ${stepDirection === 'forward' ? wizardStyles.stepPaneForward : wizardStyles.stepPaneBackward}`}
              >
                <p className={wizardStyles.helpText}>
                  {t['com.affine.caseAssistant.wizard.step4.help']()}
                </p>

                {props.documents.length === 0 ? (
                  <div className={wizardStyles.bannerWarn}>
                    {t['com.affine.caseAssistant.wizard.step4.noDocuments']()}
                  </div>
                ) : (
                  <div className={wizardStyles.stepBody}>
                    {pipelineStage !== 'idle' &&
                    pipelineStage !== 'complete' ? (
                      <div
                        className={wizardStyles.pipelineProgressCard}
                        role="status"
                        aria-live="polite"
                      >
                        <div className={wizardStyles.pipelineProgressHeader}>
                          <strong>
                            {t.t(
                              'com.affine.caseAssistant.wizard.step4.pipeline.title'
                            )}
                          </strong>
                          <span>{pipelineProgress}%</span>
                        </div>
                        <div className={wizardStyles.uploadCommitProgressTrack}>
                          <div
                            className={wizardStyles.uploadCommitProgressFill}
                            data-active="true"
                            style={{ width: `${pipelineProgress}%` }}
                          />
                        </div>
                        <div className={wizardStyles.pipelineStages}>
                          <div
                            className={wizardStyles.pipelineStage}
                            data-active={
                              pipelineStage === 'ocr' ? 'true' : 'false'
                            }
                            data-done={pipelineProgress > 33 ? 'true' : 'false'}
                          >
                            <span>{pipelineProgress > 33 ? '✓' : '1'}</span>
                            <span>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step4.pipeline.stage.ocr'
                              )}
                            </span>
                          </div>
                          <div
                            className={wizardStyles.pipelineStage}
                            data-active={
                              pipelineStage === 'analysis' ? 'true' : 'false'
                            }
                            data-done={pipelineProgress > 66 ? 'true' : 'false'}
                          >
                            <span>{pipelineProgress > 66 ? '✓' : '2'}</span>
                            <span>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step4.pipeline.stage.analysis'
                              )}
                            </span>
                          </div>
                          <div
                            className={wizardStyles.pipelineStage}
                            data-active={
                              pipelineStage === 'metadata' ? 'true' : 'false'
                            }
                            data-done={
                              pipelineProgress >= 100 ? 'true' : 'false'
                            }
                          >
                            <span>{pipelineProgress >= 100 ? '✓' : '3'}</span>
                            <span>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step4.pipeline.stage.metadata'
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {showAktenzeichenConfirmation && detectedMetadata ? (
                      <div
                        className={wizardStyles.aktenzeichenConfirmationBanner}
                        role="alert"
                        aria-live="assertive"
                      >
                        <div
                          className={
                            wizardStyles.aktenzeichenConfirmationHeader
                          }
                        >
                          <strong>
                            {t.t(
                              'com.affine.caseAssistant.wizard.step4.metadataConfirm.title'
                            )}
                          </strong>
                          <span>
                            {t.t(
                              'com.affine.caseAssistant.wizard.step4.metadataConfirm.subtitle'
                            )}
                          </span>
                        </div>
                        <div
                          className={wizardStyles.aktenzeichenConfirmationBody}
                        >
                          {detectedMetadata.suggestedClientName &&
                          !props.selectedClientId ? (
                            <label className={wizardStyles.formLabel}>
                              <strong>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.client.label'
                                )}
                              </strong>
                              <input
                                className={styles.input}
                                value={
                                  props.clientDraftName ||
                                  detectedMetadata.suggestedClientName
                                }
                                onChange={e =>
                                  props.setClientDraftName(e.target.value)
                                }
                                placeholder={t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.client.placeholder'
                                )}
                              />
                            </label>
                          ) : null}

                          {detectedMetadata.suggestedMatterTitle ? (
                            <label className={wizardStyles.formLabel}>
                              <strong>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.matter.label'
                                )}
                              </strong>
                              <input
                                className={styles.input}
                                value={
                                  props.matterDraftTitle ||
                                  detectedMetadata.suggestedMatterTitle
                                }
                                onChange={e =>
                                  props.setMatterDraftTitle(e.target.value)
                                }
                                placeholder={t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.matter.placeholder'
                                )}
                              />
                            </label>
                          ) : null}

                          {detectedMetadata.suggestedExternalRef ? (
                            <label className={wizardStyles.formLabel}>
                              <strong>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.externalRef.label'
                                )}
                              </strong>
                              <input
                                className={styles.input}
                                value={
                                  extractedAktenzeichen ||
                                  detectedMetadata.suggestedExternalRef
                                }
                                onChange={e =>
                                  setExtractedAktenzeichen(e.target.value)
                                }
                                placeholder={t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.externalRef.placeholder'
                                )}
                                autoFocus
                              />
                            </label>
                          ) : null}

                          {detectedMetadata.suggestedCourt ? (
                            <label className={wizardStyles.formLabel}>
                              <strong>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.court.label'
                                )}
                              </strong>
                              <input
                                className={styles.input}
                                value={
                                  props.matterDraftGericht ||
                                  detectedMetadata.suggestedCourt
                                }
                                onChange={e =>
                                  props.setMatterDraftGericht(e.target.value)
                                }
                                placeholder={t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.court.placeholder'
                                )}
                              />
                            </label>
                          ) : null}

                          {detectedMetadata.suggestedAuthorityRefs.length >
                          0 ? (
                            <label className={wizardStyles.formLabel}>
                              <strong>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.authorityRefs.label'
                                )}
                              </strong>
                              <textarea
                                className={styles.input}
                                rows={2}
                                value={
                                  props.matterDraftAuthorityReferences ||
                                  detectedMetadata.suggestedAuthorityRefs.join(
                                    '; '
                                  )
                                }
                                onChange={e =>
                                  props.setMatterDraftAuthorityReferences(
                                    e.target.value
                                  )
                                }
                                placeholder={t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.authorityRefs.placeholder'
                                )}
                              />
                            </label>
                          ) : null}

                          <div
                            className={wizardStyles.hintMuted}
                            style={{ marginTop: 8 }}
                          >
                            {t.t(
                              'com.affine.caseAssistant.wizard.step4.metadataConfirm.extractedHint',
                              {
                                count: props.documents.length,
                                percent: Math.round(
                                  detectedMetadata.confidence * 100
                                ),
                              }
                            )}
                          </div>

                          <div className={wizardStyles.metadataResolutionPanel}>
                            <div
                              className={wizardStyles.metadataResolutionHeader}
                            >
                              <strong>
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.resolutionTitle'
                                )}
                              </strong>
                              <div
                                className={
                                  wizardStyles.metadataResolutionBadges
                                }
                              >
                                <span
                                  className={
                                    wizardStyles.metadataResolutionBadge
                                  }
                                  data-tone={detectedMetadata.confidenceLevel}
                                >
                                  {`Confidence: ${detectedMetadata.confidenceLevel.toUpperCase()} (${Math.round(
                                    detectedMetadata.confidence * 100
                                  )}%)`}
                                </span>
                                <div
                                  className={
                                    wizardStyles.metadataResolutionBadge
                                  }
                                  data-tone={
                                    detectedMetadata.hasConflicts
                                      ? 'conflict'
                                      : 'stable'
                                  }
                                >
                                  {detectedMetadata.candidateExternalRefs
                                    .slice(0, 3)
                                    .map(candidate => (
                                      <span
                                        key={candidate.value}
                                        className={
                                          wizardStyles.metadataCandidateItem
                                        }
                                      >
                                        {`${candidate.value} · ${candidate.occurrences}x`}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            </div>

                            {detectedMetadata.candidateClientNames.length >
                            0 ? (
                              <div
                                className={wizardStyles.metadataCandidateBlock}
                              >
                                <strong>
                                  {t.t(
                                    'com.affine.caseAssistant.wizard.step4.metadataConfirm.topClientsTitle'
                                  )}
                                </strong>
                                <div
                                  className={wizardStyles.metadataCandidateList}
                                >
                                  {detectedMetadata.candidateClientNames
                                    .slice(0, 3)
                                    .map(candidate => (
                                      <span
                                        key={candidate.value}
                                        className={
                                          wizardStyles.metadataCandidateItem
                                        }
                                      >
                                        {`${candidate.value} · ${candidate.occurrences}x`}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            ) : null}

                            {detectedMetadata.evidence.length > 0 ? (
                              <details
                                className={wizardStyles.metadataEvidenceDetails}
                              >
                                <summary>
                                  {t.t(
                                    'com.affine.caseAssistant.wizard.step4.metadataConfirm.evidenceToggle'
                                  )}
                                </summary>
                                <div
                                  className={wizardStyles.metadataEvidenceList}
                                >
                                  {detectedMetadata.evidence
                                    .slice(0, 8)
                                    .map(item => (
                                      <div
                                        key={item}
                                        className={
                                          wizardStyles.metadataEvidenceItem
                                        }
                                      >
                                        • {item}
                                      </div>
                                    ))}
                                </div>
                              </details>
                            ) : null}
                          </div>

                          {(() => {
                            const adoptionPreviewItems: string[] = [];
                            if (
                              detectedMetadata.suggestedClientName &&
                              !props.selectedClientId &&
                              !props.clientDraftName
                            ) {
                              adoptionPreviewItems.push(
                                t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.adoption.client',
                                  {
                                    value: detectedMetadata.suggestedClientName,
                                  }
                                )
                              );
                            }
                            if (
                              detectedMetadata.suggestedMatterTitle &&
                              !props.matterDraftTitle
                            ) {
                              adoptionPreviewItems.push(
                                t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.adoption.matter',
                                  {
                                    value:
                                      detectedMetadata.suggestedMatterTitle,
                                  }
                                )
                              );
                            }
                            if (
                              extractedAktenzeichen &&
                              !props.matterDraftExternalRef.trim()
                            ) {
                              adoptionPreviewItems.push(
                                t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.adoption.externalRef',
                                  {
                                    value: extractedAktenzeichen,
                                  }
                                )
                              );
                            }
                            if (
                              detectedMetadata.suggestedCourt &&
                              !props.matterDraftGericht
                            ) {
                              adoptionPreviewItems.push(
                                t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.adoption.court',
                                  {
                                    value: detectedMetadata.suggestedCourt,
                                  }
                                )
                              );
                            }
                            if (
                              detectedMetadata.suggestedPolice &&
                              !props.matterDraftPolizei
                            ) {
                              adoptionPreviewItems.push(
                                `Polizei: ${detectedMetadata.suggestedPolice}`
                              );
                            }
                            if (
                              detectedMetadata.suggestedProsecutor &&
                              !props.matterDraftStaatsanwaltschaft
                            ) {
                              adoptionPreviewItems.push(
                                `Staatsanwaltschaft: ${detectedMetadata.suggestedProsecutor}`
                              );
                            }
                            if (
                              detectedMetadata.suggestedJudge &&
                              !props.matterDraftRichter
                            ) {
                              adoptionPreviewItems.push(
                                `Richter: ${detectedMetadata.suggestedJudge}`
                              );
                            }
                            if (
                              detectedMetadata.suggestedCourtFileNumber &&
                              !props.matterDraftGerichtsaktenzeichen
                            ) {
                              adoptionPreviewItems.push(
                                `Gerichts-AZ: ${detectedMetadata.suggestedCourtFileNumber}`
                              );
                            }
                            if (
                              detectedMetadata.suggestedProsecutorFileNumber &&
                              !props.matterDraftStaatsanwaltschaftAktenzeichen
                            ) {
                              adoptionPreviewItems.push(
                                `StA-AZ: ${detectedMetadata.suggestedProsecutorFileNumber}`
                              );
                            }
                            if (
                              detectedMetadata.suggestedPoliceFileNumber &&
                              !props.matterDraftPolizeiAktenzeichen
                            ) {
                              adoptionPreviewItems.push(
                                `Polizei-AZ: ${detectedMetadata.suggestedPoliceFileNumber}`
                              );
                            }
                            if (
                              detectedMetadata.suggestedAuthorityRefs.length >
                                0 &&
                              !props.matterDraftAuthorityReferences
                            ) {
                              adoptionPreviewItems.push(
                                t.t(
                                  'com.affine.caseAssistant.wizard.step4.metadataConfirm.adoption.authorityRefs',
                                  {
                                    value:
                                      detectedMetadata.suggestedAuthorityRefs
                                        .slice(0, 3)
                                        .join(', '),
                                  }
                                )
                              );
                            }
                            if (adoptionPreviewItems.length === 0) {
                              return null;
                            }
                            return (
                              <div
                                className={wizardStyles.adoptionPreviewCard}
                                role="note"
                                aria-live="polite"
                              >
                                <strong>
                                  {t.t(
                                    'com.affine.caseAssistant.wizard.step4.metadataConfirm.adoptionPreviewTitle',
                                    {
                                      count: adoptionPreviewItems.length,
                                    }
                                  )}
                                </strong>
                                <ul
                                  className={wizardStyles.adoptionPreviewList}
                                >
                                  {adoptionPreviewItems.map(item => (
                                    <li
                                      key={item}
                                      className={
                                        wizardStyles.adoptionPreviewItem
                                      }
                                    >
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })()}

                          <div
                            className={
                              wizardStyles.aktenzeichenConfirmationActions
                            }
                          >
                            <Button
                              variant="primary"
                              onClick={() => {
                                if (
                                  detectedMetadata.suggestedClientName &&
                                  !props.selectedClientId &&
                                  !props.clientDraftName
                                ) {
                                  props.setClientDraftName(
                                    detectedMetadata.suggestedClientName
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedMatterTitle &&
                                  !props.matterDraftTitle
                                ) {
                                  props.setMatterDraftTitle(
                                    detectedMetadata.suggestedMatterTitle
                                  );
                                }
                                if (
                                  extractedAktenzeichen &&
                                  !props.matterDraftExternalRef.trim()
                                ) {
                                  props.setMatterDraftExternalRef(
                                    extractedAktenzeichen
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedCourt &&
                                  !props.matterDraftGericht
                                ) {
                                  props.setMatterDraftGericht(
                                    detectedMetadata.suggestedCourt
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedPolice &&
                                  !props.matterDraftPolizei
                                ) {
                                  props.setMatterDraftPolizei(
                                    detectedMetadata.suggestedPolice
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedProsecutor &&
                                  !props.matterDraftStaatsanwaltschaft
                                ) {
                                  props.setMatterDraftStaatsanwaltschaft(
                                    detectedMetadata.suggestedProsecutor
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedJudge &&
                                  !props.matterDraftRichter
                                ) {
                                  props.setMatterDraftRichter(
                                    detectedMetadata.suggestedJudge
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedCourtFileNumber &&
                                  !props.matterDraftGerichtsaktenzeichen
                                ) {
                                  props.setMatterDraftGerichtsaktenzeichen(
                                    detectedMetadata.suggestedCourtFileNumber
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedProsecutorFileNumber &&
                                  !props.matterDraftStaatsanwaltschaftAktenzeichen
                                ) {
                                  props.setMatterDraftStaatsanwaltschaftAktenzeichen(
                                    detectedMetadata.suggestedProsecutorFileNumber
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedPoliceFileNumber &&
                                  !props.matterDraftPolizeiAktenzeichen
                                ) {
                                  props.setMatterDraftPolizeiAktenzeichen(
                                    detectedMetadata.suggestedPoliceFileNumber
                                  );
                                }
                                if (
                                  detectedMetadata.suggestedAuthorityRefs
                                    .length > 0 &&
                                  !props.matterDraftAuthorityReferences
                                ) {
                                  props.setMatterDraftAuthorityReferences(
                                    detectedMetadata.suggestedAuthorityRefs.join(
                                      '; '
                                    )
                                  );
                                }
                                setShowAktenzeichenConfirmation(false);
                              }}
                            >
                              {t.t(
                                'com.affine.caseAssistant.wizard.step4.metadataConfirm.applyAll'
                              )}
                            </Button>
                            <Button
                              variant="plain"
                              onClick={() => {
                                setShowAktenzeichenConfirmation(false);
                              }}
                            >
                              {t.t(
                                'com.affine.caseAssistant.wizard.step4.metadataConfirm.defer'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className={wizardStyles.analysisHeroCard}>
                      <div className={wizardStyles.analysisHeroTitle}>
                        {t[
                          'com.affine.caseAssistant.wizard.step4.analysisReady.title'
                        ]()}
                      </div>
                      <div className={wizardStyles.analysisHeroMetrics}>
                        <span>
                          {t.t(
                            'com.affine.caseAssistant.wizard.step4.analysisReady.docs',
                            { count: props.documents.length }
                          )}
                        </span>
                        <span>
                          {t.t(
                            'com.affine.caseAssistant.wizard.step4.analysisReady.ready',
                            { count: readyDocumentCount }
                          )}
                        </span>
                        <span>
                          {t.t(
                            'com.affine.caseAssistant.wizard.step4.analysisReady.problematic',
                            { count: problematicDocumentCount }
                          )}
                        </span>
                      </div>
                      {failedDocumentCount > 0 ? (
                        <div
                          className={wizardStyles.analysisFailureHint}
                          role="status"
                          aria-live="polite"
                        >
                          {t.t(
                            'com.affine.caseAssistant.wizard.step4.failedHint',
                            { count: failedDocumentCount }
                          )}
                        </div>
                      ) : null}
                      {props.documents.some(d => d.kind === 'scan-pdf') ? (
                        <span className={wizardStyles.analysisCardAccent}>
                          {' '}
                          {t.t(
                            'com.affine.caseAssistant.wizard.step4.scanHint',
                            {
                              count: props.documents.filter(
                                d => d.kind === 'scan-pdf'
                              ).length,
                            }
                          )}
                        </span>
                      ) : null}
                    </div>

                    {failedDocumentDiagnostics.length > 0 ? (
                      <div
                        className={wizardStyles.bannerWarn}
                        role="status"
                        aria-live="polite"
                      >
                        <div>
                          {t.t(
                            'com.affine.caseAssistant.wizard.step4.diagnostics.affected',
                            {
                              count: failedDocumentDiagnostics.length,
                            }
                          )}
                        </div>
                        {failedDocumentDiagnostics.slice(0, 5).map(diag => (
                          <div
                            key={diag.documentId}
                            className={wizardStyles.failedDocRow}
                          >
                            <div className={wizardStyles.failedDocInfo}>
                              <span className={wizardStyles.failedDocTitle}>
                                {diag.title}
                              </span>
                              <span className={wizardStyles.failedDocReason}>
                                {diag.reason}
                              </span>
                            </div>
                            <div className={wizardStyles.failedDocActions}>
                              <Button
                                variant="plain"
                                disabled={props.isWorkflowBusy}
                                onClick={() =>
                                  props.runAsyncUiAction(
                                    () =>
                                      props.onRetryFailedDocument?.(
                                        diag.documentId
                                      ),
                                    'wizard retry failed doc'
                                  )
                                }
                                className={
                                  wizardStyles.analysisActionButtonSecondary
                                }
                                aria-label={t.t(
                                  'com.affine.caseAssistant.wizard.step4.failedDoc.retry.aria',
                                  { title: diag.title }
                                )}
                              >
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.failedDoc.retry'
                                )}
                              </Button>
                              <Button
                                variant="plain"
                                disabled={props.isWorkflowBusy}
                                onClick={() =>
                                  props.runAsyncUiAction(
                                    () =>
                                      props.onRemoveFailedDocument?.(
                                        diag.documentId
                                      ),
                                    'wizard remove failed doc'
                                  )
                                }
                                className={
                                  wizardStyles.analysisActionButtonSecondary
                                }
                                aria-label={t.t(
                                  'com.affine.caseAssistant.wizard.step4.failedDoc.remove.aria',
                                  { title: diag.title }
                                )}
                              >
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step4.failedDoc.remove'
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className={wizardStyles.failureDiagnosticsActions}>
                          <Button
                            variant="plain"
                            disabled={props.isWorkflowBusy}
                            onClick={() =>
                              props.runAsyncUiAction(
                                props.onProcessOcr,
                                'wizard ocr retry failed'
                              )
                            }
                            className={
                              wizardStyles.analysisActionButtonSecondary
                            }
                          >
                            {t[
                              'com.affine.caseAssistant.wizard.step4.diagnostics.ocrRetry'
                            ]()}
                          </Button>
                          <Button
                            variant="primary"
                            disabled={props.isWorkflowBusy}
                            onClick={() =>
                              props.runAsyncUiAction(
                                onRunAnalysis,
                                'wizard analysis retry failed'
                              )
                            }
                            className={wizardStyles.analysisActionButtonPrimary}
                          >
                            {t[
                              'com.affine.caseAssistant.wizard.step4.diagnostics.analysisRetry'
                            ]()}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className={wizardStyles.analysisActionDeck}>
                      <div
                        className={wizardStyles.analysisActionItem}
                        data-tone="primary"
                      >
                        <div className={wizardStyles.analysisActionTitle}>
                          {t[
                            'com.affine.caseAssistant.wizard.step4.quickAnalysis.title'
                          ]()}
                        </div>
                        <div className={wizardStyles.analysisActionHint}>
                          {t[
                            'com.affine.caseAssistant.wizard.step4.quickAnalysis.hint'
                          ]()}
                        </div>
                        <Button
                          variant="primary"
                          disabled={props.isWorkflowBusy}
                          onClick={() =>
                            props.runAsyncUiAction(
                              onRunAnalysis,
                              'wizard analysis failed'
                            )
                          }
                          className={wizardStyles.analysisActionButtonPrimary}
                        >
                          {props.isWorkflowBusy
                            ? t[
                                'com.affine.caseAssistant.wizard.step4.quickAnalysis.running'
                              ]()
                            : t[
                                'com.affine.caseAssistant.wizard.step4.quickAnalysis.start'
                              ]()}
                        </Button>
                      </div>

                      <div
                        className={wizardStyles.analysisActionItem}
                        data-tone="neutral"
                      >
                        <div className={wizardStyles.analysisActionTitle}>
                          {t[
                            'com.affine.caseAssistant.wizard.step4.fullWorkflow.title'
                          ]()}
                        </div>
                        <div className={wizardStyles.analysisActionHint}>
                          {t[
                            'com.affine.caseAssistant.wizard.step4.fullWorkflow.hint'
                          ]()}
                        </div>
                        <Button
                          variant="plain"
                          disabled={props.isWorkflowBusy}
                          onClick={() =>
                            props.runAsyncUiAction(
                              props.onRunFullWorkflow,
                              'wizard full workflow failed'
                            )
                          }
                          className={wizardStyles.analysisActionButtonSecondary}
                        >
                          {t[
                            'com.affine.caseAssistant.wizard.step4.fullWorkflow.button'
                          ]()}
                        </Button>
                      </div>

                      <div
                        className={wizardStyles.analysisActionItem}
                        data-tone="neutral"
                      >
                        <div className={wizardStyles.analysisActionTitle}>
                          {t[
                            'com.affine.caseAssistant.wizard.step4.autofill.title'
                          ]()}
                        </div>
                        <div className={wizardStyles.analysisActionHint}>
                          {t[
                            'com.affine.caseAssistant.wizard.step4.autofill.hint'
                          ]()}
                        </div>
                        <Button
                          variant="plain"
                          disabled={
                            props.isWorkflowBusy || props.documents.length === 0
                          }
                          onClick={() =>
                            props.runAsyncUiAction(
                              onInferMetadata,
                              'wizard metadata detection failed'
                            )
                          }
                          className={wizardStyles.analysisActionButtonSecondary}
                        >
                          {t[
                            'com.affine.caseAssistant.wizard.step4.autofill.button'
                          ]()}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {analysisStatus ? (
                  <div
                    className={clsx(
                      wizardStyles.analysisStatus,
                      analysisStatus.includes(
                        t[
                          'com.affine.caseAssistant.wizard.status.analysisError'
                        ]().slice(0, 6)
                      )
                        ? wizardStyles.analysisStatusError
                        : undefined
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    {analysisStatus}
                  </div>
                ) : null}

                {detectionStatus ? (
                  <div
                    className={wizardStyles.analysisStatus}
                    role="status"
                    aria-live="polite"
                  >
                    {detectionStatus}
                  </div>
                ) : null}

                {detectedMetadata ? (
                  <div className={wizardStyles.evidenceList}>
                    <div>
                      <strong>
                        {t[
                          'com.affine.caseAssistant.wizard.step4.extraction.title'
                        ]()}
                      </strong>{' '}
                      {t.t(
                        'com.affine.caseAssistant.wizard.step4.extraction.confidence',
                        {
                          percent: Math.round(
                            detectedMetadata.confidence * 100
                          ),
                        }
                      )}
                    </div>
                    <div>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step4.extraction.client',
                        {
                          value:
                            detectedMetadata.suggestedClientName ??
                            t[
                              'com.affine.caseAssistant.wizard.step4.extraction.notSure'
                            ](),
                        }
                      )}
                    </div>
                    <div>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step4.extraction.matter',
                        {
                          value:
                            detectedMetadata.suggestedMatterTitle ??
                            t[
                              'com.affine.caseAssistant.wizard.step4.extraction.notSure'
                            ](),
                        }
                      )}
                    </div>
                    <div>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step4.extraction.ref',
                        {
                          value:
                            detectedMetadata.suggestedExternalRef ??
                            t[
                              'com.affine.caseAssistant.wizard.step4.extraction.notDetected'
                            ](),
                        }
                      )}
                    </div>
                    <div>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step4.extraction.court',
                        {
                          value:
                            detectedMetadata.suggestedCourt ??
                            t[
                              'com.affine.caseAssistant.wizard.step4.extraction.notDetected'
                            ](),
                        }
                      )}
                    </div>
                    <div>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step4.extraction.authorityRefs',
                        {
                          value:
                            detectedMetadata.suggestedAuthorityRefs.length > 0
                              ? detectedMetadata.suggestedAuthorityRefs
                                  .slice(0, 3)
                                  .join(', ')
                              : t[
                                  'com.affine.caseAssistant.wizard.step4.extraction.notDetected'
                                ](),
                        }
                      )}
                    </div>
                    {detectedMetadata.evidence
                      .slice(0, 4)
                      .map((item: string) => (
                        <div key={item}>• {item}</div>
                      ))}
                  </div>
                ) : null}

                {detectedMetadata?.requiresManualClient ? (
                  <div className={wizardStyles.bannerWarn}>
                    {t[
                      'com.affine.caseAssistant.wizard.step4.manualClientRequired'
                    ]()}
                  </div>
                ) : null}

                {props.findings.length > 0 ? (
                  <div className={wizardStyles.bannerOk}>
                    {t.t('com.affine.caseAssistant.wizard.step4.findings', {
                      findings: props.findings.length,
                      tasks: props.tasks.length,
                    })}
                  </div>
                ) : null}

                <div className={wizardStyles.statsRow}>
                  <span>
                    {t[
                      'com.affine.caseAssistant.wizard.step4.stats.processed'
                    ]()}
                    <strong>
                      {
                        props.documents.filter(
                          d => d.processingStatus === 'ready'
                        ).length
                      }
                    </strong>
                  </span>
                  <span>
                    {t['com.affine.caseAssistant.wizard.step4.stats.review']()}
                    <strong>
                      {
                        props.documents.filter(
                          d => d.processingStatus === 'needs_review'
                        ).length
                      }
                    </strong>
                  </span>
                  <span>
                    {t['com.affine.caseAssistant.wizard.step4.stats.failed']()}
                    <strong>
                      {
                        props.documents.filter(
                          d => d.processingStatus === 'failed'
                        ).length
                      }
                    </strong>
                  </span>
                </div>

                <IntakeChecklistSection
                  documents={props.documents}
                  qualityReports={props.qualityReports}
                />
              </div>
            ) : null}

            {/* ── Step 5: Fact Sheet ── */}
            {step === 5 ? (
              <div
                className={`${wizardStyles.stepBody} ${wizardStyles.stepPane} ${stepDirection === 'forward' ? wizardStyles.stepPaneForward : wizardStyles.stepPaneBackward}`}
              >
                <p className={wizardStyles.helpText}>
                  {t['com.affine.caseAssistant.wizard.step3.help']()}
                </p>

                {showCommitProgressCard ? (
                  <div className={wizardStyles.bannerWarn}>
                    {t['com.affine.caseAssistant.wizard.step5.noDocuments']()}
                  </div>
                ) : null}

                <div
                  className={wizardStyles.finalSnapshotGrid}
                  role="status"
                  aria-live="polite"
                >
                  <div className={wizardStyles.finalSnapshotCard}>
                    <span className={wizardStyles.finalSnapshotLabel}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.snapshot.documentsTotal'
                      )}
                    </span>
                    <strong className={wizardStyles.finalSnapshotValue}>
                      {documents.length}
                    </strong>
                  </div>
                  <div className={wizardStyles.finalSnapshotCard}>
                    <span className={wizardStyles.finalSnapshotLabel}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.snapshot.indexed'
                      )}
                    </span>
                    <strong className={wizardStyles.finalSnapshotValue}>
                      {indexedDocumentCount}
                    </strong>
                  </div>
                  <div className={wizardStyles.finalSnapshotCard}>
                    <span className={wizardStyles.finalSnapshotLabel}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.snapshot.semanticChunks'
                      )}
                    </span>
                    <strong className={wizardStyles.finalSnapshotValue}>
                      {totalChunkCount}
                    </strong>
                  </div>
                  <div className={wizardStyles.finalSnapshotCard}>
                    <span className={wizardStyles.finalSnapshotLabel}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.snapshot.qualityReports'
                      )}
                    </span>
                    <strong className={wizardStyles.finalSnapshotValue}>
                      {qualityReportCoverageCount}
                    </strong>
                  </div>
                  <div className={wizardStyles.finalSnapshotCard}>
                    <span className={wizardStyles.finalSnapshotLabel}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.snapshot.findings'
                      )}
                    </span>
                    <strong className={wizardStyles.finalSnapshotValue}>
                      {props.findings.length}
                    </strong>
                  </div>
                  <div className={wizardStyles.finalSnapshotCard}>
                    <span className={wizardStyles.finalSnapshotLabel}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.snapshot.openTasks'
                      )}
                    </span>
                    <strong className={wizardStyles.finalSnapshotValue}>
                      {
                        props.tasks.filter(task => task.status !== 'done')
                          .length
                      }
                    </strong>
                  </div>
                </div>

                {averageQualityScore !== null ? (
                  <div className={wizardStyles.hintMuted} role="note">
                    {t.t('com.affine.caseAssistant.wizard.step5.avgQuality', {
                      percent: averageQualityScore,
                    })}
                  </div>
                ) : null}

                {missingSummaryFields.length > 0 ? (
                  <div className={wizardStyles.bannerInfo} role="alert">
                    <strong>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.missingFields.title'
                      )}
                    </strong>
                    <ul className={wizardStyles.missingFieldList}>
                      {missingSummaryFields.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className={wizardStyles.finalFlowGrid}>
                  <section
                    className={wizardStyles.finalFlowCard}
                    data-tone="stable"
                    aria-label={t.t(
                      'com.affine.caseAssistant.wizard.step5.finalCard.adopted.aria'
                    )}
                  >
                    <div className={wizardStyles.finalFlowCardTitle}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.finalCard.adopted'
                      )}
                    </div>
                    <ul className={wizardStyles.finalFlowList}>
                      {adoptedSummaryItems.slice(0, 8).map(item => (
                        <li key={item} className={wizardStyles.finalFlowItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section
                    className={wizardStyles.finalFlowCard}
                    data-tone={
                      openSummaryItems.length > 0 ? 'review' : 'stable'
                    }
                    aria-label={t.t(
                      'com.affine.caseAssistant.wizard.step5.finalCard.open.aria'
                    )}
                  >
                    <div className={wizardStyles.finalFlowCardTitle}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.finalCard.open'
                      )}
                    </div>
                    {openSummaryItems.length > 0 ? (
                      <ul className={wizardStyles.finalFlowList}>
                        {openSummaryItems.slice(0, 8).map(issue => (
                          <li
                            key={issue.label}
                            className={wizardStyles.finalFlowItem}
                            data-priority={issue.priority}
                          >
                            <span className={wizardStyles.priorityBadge}>
                              {issue.priority}
                            </span>
                            {issue.label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className={wizardStyles.hintMuted}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step5.finalCard.open.none'
                        )}
                      </div>
                    )}
                  </section>
                  <section
                    className={wizardStyles.finalFlowCard}
                    data-tone="impact"
                    aria-label={t.t(
                      'com.affine.caseAssistant.wizard.step5.finalCard.impact.aria'
                    )}
                  >
                    <div className={wizardStyles.finalFlowCardTitle}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.finalCard.impact'
                      )}
                    </div>
                    <ul className={wizardStyles.finalFlowList}>
                      <li className={wizardStyles.finalFlowItem}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step5.impact.persistedDocs',
                          {
                            count: indexedDocumentCount,
                          }
                        )}
                      </li>
                      <li className={wizardStyles.finalFlowItem}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step5.impact.semanticChunks',
                          {
                            count: totalChunkCount,
                          }
                        )}
                      </li>
                      <li className={wizardStyles.finalFlowItem}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step5.impact.qualityReports',
                          {
                            count: qualityReportCoverageCount,
                          }
                        )}
                      </li>
                      <li className={wizardStyles.finalFlowItem}>
                        {t.t(
                          'com.affine.caseAssistant.wizard.step5.impact.findingsTasks',
                          {
                            findings: props.findings.length,
                            tasks: props.tasks.length,
                          }
                        )}
                      </li>
                    </ul>
                  </section>
                </div>

                <div
                  className={wizardStyles.workflowQuickActions}
                  role="group"
                  aria-label={t.t(
                    'com.affine.caseAssistant.wizard.step5.quickFix.aria'
                  )}
                >
                  {!hasClientIdentity ? (
                    <Button
                      variant="plain"
                      className={wizardStyles.workflowQuickActionButton}
                      onClick={() => setStep(1)}
                      aria-label={t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.client.aria'
                      )}
                    >
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.client'
                      )}
                    </Button>
                  ) : null}
                  {!hasMatterIdentity || missingSummaryFields.length > 0 ? (
                    <Button
                      variant="plain"
                      className={wizardStyles.workflowQuickActionButton}
                      onClick={() => setStep(2)}
                      aria-label={t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.matter.aria'
                      )}
                    >
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.matter'
                      )}
                    </Button>
                  ) : null}
                  {problematicDocumentCount > 0 ? (
                    <Button
                      variant="plain"
                      className={wizardStyles.workflowQuickActionButton}
                      onClick={() => {
                        setDocFilter('problematic');
                        setFilterStatus(
                          t.t(
                            'com.affine.caseAssistant.wizard.step5.filterStatus.problematic'
                          )
                        );
                      }}
                      aria-label={t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.problematic.aria'
                      )}
                    >
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.problematic'
                      )}
                    </Button>
                  ) : null}
                  {failedDocumentCount > 0 || needsReviewCount > 0 ? (
                    <Button
                      variant="plain"
                      className={wizardStyles.workflowQuickActionButton}
                      onClick={() => setStep(4)}
                      aria-label={t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.backToAnalysis.aria'
                      )}
                    >
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.backToAnalysis'
                      )}
                    </Button>
                  ) : null}
                  {needsProofNote ? (
                    <Button
                      variant="plain"
                      className={wizardStyles.workflowQuickActionButton}
                      onClick={() => {
                        const el = document.getElementById('wizard-proof-note');
                        el?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        });
                        el?.focus();
                      }}
                      aria-label={t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.proofNote.aria'
                      )}
                    >
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.quickFix.proofNote'
                      )}
                    </Button>
                  ) : null}
                </div>

                <div
                  className={wizardStyles.reviewReadinessCard}
                  data-tone={
                    !hasDocuments
                      ? 'blocked'
                      : problematicDocumentCount > 0
                        ? 'review'
                        : 'ready'
                  }
                >
                  <div className={wizardStyles.reviewReadinessTitle}>
                    {t[
                      'com.affine.caseAssistant.wizard.step5.readiness.title'
                    ]()}
                  </div>
                  <div className={wizardStyles.reviewReadinessText}>
                    {!hasDocuments
                      ? t[
                          'com.affine.caseAssistant.wizard.step5.readiness.blocked'
                        ]()
                      : problematicDocumentCount > 0
                        ? t[
                            'com.affine.caseAssistant.wizard.step5.readiness.review'
                          ]()
                        : t[
                            'com.affine.caseAssistant.wizard.step5.readiness.ready'
                          ]()}
                  </div>
                  <div className={wizardStyles.reviewReadinessMetrics}>
                    <span>
                      {t.t('com.affine.caseAssistant.wizard.kpi.ready', {
                        count: readyDocumentCount,
                      })}
                    </span>
                    <span>
                      {t.t('com.affine.caseAssistant.wizard.kpi.review', {
                        count: needsReviewCount,
                      })}
                    </span>
                    <span>
                      {t.t('com.affine.caseAssistant.wizard.kpi.failed', {
                        count: failedDocumentCount,
                      })}
                    </span>
                  </div>
                </div>

                <div
                  className={wizardStyles.filtersRow}
                  role="group"
                  aria-label={t[
                    'com.affine.caseAssistant.wizard.step5.filter.aria'
                  ]()}
                >
                  <Button
                    variant="plain"
                    onClick={() => setDocFilter('all')}
                    className={wizardStyles.filterChipButton}
                    data-active={docFilter === 'all' ? 'true' : 'false'}
                    aria-pressed={docFilter === 'all'}
                  >
                    {t.t('com.affine.caseAssistant.wizard.step5.filter.all', {
                      count: props.documents.length,
                    })}
                  </Button>
                  <Button
                    variant="plain"
                    onClick={() => setDocFilter('problematic')}
                    className={wizardStyles.filterChipButton}
                    data-active={docFilter === 'problematic' ? 'true' : 'false'}
                    aria-pressed={docFilter === 'problematic'}
                  >
                    {t.t(
                      'com.affine.caseAssistant.wizard.step5.filter.problematic',
                      {
                        count: props.documents.filter(
                          d =>
                            d.processingStatus === 'needs_review' ||
                            d.processingStatus === 'failed'
                        ).length,
                      }
                    )}
                  </Button>
                  <Button
                    variant="plain"
                    onClick={() => setDocFilter('review')}
                    className={wizardStyles.filterChipButton}
                    data-active={docFilter === 'review' ? 'true' : 'false'}
                    aria-pressed={docFilter === 'review'}
                  >
                    {t.t(
                      'com.affine.caseAssistant.wizard.step5.filter.review',
                      { count: needsReviewCount }
                    )}
                  </Button>
                  <Button
                    variant="plain"
                    onClick={() => setDocFilter('failed')}
                    className={wizardStyles.filterChipButton}
                    data-active={docFilter === 'failed' ? 'true' : 'false'}
                    aria-pressed={docFilter === 'failed'}
                  >
                    {t.t(
                      'com.affine.caseAssistant.wizard.step5.filter.failed',
                      {
                        count: props.documents.filter(
                          d => d.processingStatus === 'failed'
                        ).length,
                      }
                    )}
                  </Button>
                </div>

                <details
                  className={wizardStyles.documentReviewDetails}
                  open={problematicDocumentCount > 0}
                >
                  <summary className={wizardStyles.documentReviewSummary}>
                    Dokumentkontrolle ({prioritizedFilteredDocuments.length})
                  </summary>
                  <div className={wizardStyles.reviewDocList}>
                    {prioritizedFilteredDocuments.slice(0, 12).map(item => {
                      const showDebugDetails =
                        item.doc.processingStatus === 'failed' ||
                        item.doc.processingStatus === 'needs_review' ||
                        item.doc.status === 'ocr_pending' ||
                        item.doc.status === 'ocr_running';

                      return (
                        <div
                          key={item.doc.id}
                          className={wizardStyles.reviewDocItem}
                          data-tone={item.tone}
                          data-priority={item.priorityRank ? 'true' : 'false'}
                          style={
                            item.priorityRank
                              ? {
                                  animationDelay: `${item.priorityRank * 55}ms`,
                                }
                              : undefined
                          }
                        >
                          <strong className={wizardStyles.reviewDocTitle}>
                            {item.doc.title}
                          </strong>
                          <div className={wizardStyles.reviewDocMetaRow}>
                            <span
                              className={wizardStyles.reviewDocStatusBadge}
                              data-tone={item.tone}
                            >
                              {item.statusLabel}
                            </span>
                            {item.priorityRank ? (
                              <span
                                className={wizardStyles.reviewDocPriorityPill}
                              >
                                {t.t(
                                  'com.affine.caseAssistant.wizard.step5.doc.priority',
                                  { rank: item.priorityRank }
                                )}
                              </span>
                            ) : null}
                            <span className={wizardStyles.reviewDocChunkMeta}>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step5.doc.chunks',
                                { count: item.doc.chunkCount ?? 0 }
                              )}
                            </span>
                          </div>

                          {showDebugDetails &&
                          typeof window !== 'undefined' &&
                          (window.location.hostname === 'localhost' ||
                            window.location.search.includes('debug=true')) ? (
                            <details
                              className={wizardStyles.recoveryDetails}
                              style={{ marginTop: 10 }}
                            >
                              <summary className={wizardStyles.recoverySummary}>
                                Technische Details (nur für Entwickler)
                              </summary>
                              <div
                                className={wizardStyles.bannerWarn}
                                role="note"
                                style={{ marginTop: 10 }}
                              >
                                <div
                                  style={{
                                    fontFamily:
                                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    fontSize: 12,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {[
                                    `documentId: ${item.doc.id}`,
                                    `title: ${item.doc.title}`,
                                    `kind: ${item.doc.kind}`,
                                    `status: ${item.doc.status}`,
                                    `processingStatus: ${item.doc.processingStatus ?? 'unknown'}`,
                                    `processingError: ${item.doc.processingError ?? '-'}`,
                                    `extractionEngine: ${item.doc.extractionEngine ?? '-'}`,
                                    `ocrEngine: ${item.doc.ocrEngine ?? '-'}`,
                                    `chunkCount: ${String(item.doc.chunkCount ?? 0)}`,
                                    `pageCount: ${String(item.doc.pageCount ?? 0)}`,
                                    `overallQualityScore: ${String(item.doc.overallQualityScore ?? 0)}`,
                                    `sourceMimeType: ${item.doc.sourceMimeType ?? '-'}`,
                                    `sourceSizeBytes: ${String(item.doc.sourceSizeBytes ?? 0)}`,
                                  ].join('\n')}
                                </div>
                              </div>
                            </details>
                          ) : null}
                        </div>
                      );
                    })}
                    {prioritizedFilteredDocuments.length === 0 ? (
                      <div className={wizardStyles.hintMuted}>
                        {t['com.affine.caseAssistant.wizard.step5.doc.empty']()}
                      </div>
                    ) : null}
                  </div>
                </details>

                <div className={wizardStyles.stammdatenOverviewCard}>
                  <div className={wizardStyles.stammdatenOverviewHeader}>
                    <strong>Stammdaten-Übersicht</strong>
                    <Button
                      variant="plain"
                      onClick={() => setStep(2)}
                      className={wizardStyles.smallActionButton}
                    >
                      Bearbeiten
                    </Button>
                  </div>
                  <div className={wizardStyles.stammdatenOverviewGrid}>
                    <div className={wizardStyles.stammdatenOverviewItem}>
                      <span className={wizardStyles.stammdatenOverviewLabel}>
                        Mandant:
                      </span>
                      <span className={wizardStyles.stammdatenOverviewValue}>
                        {normalizeDisplayText(
                          props.currentClient?.displayName ||
                            props.clientDraftName
                        ) || 'fehlt'}
                        {props.currentClient?.kind
                          ? ` (${props.currentClient.kind})`
                          : props.clientDraftKind
                            ? ` (${props.clientDraftKind})`
                            : ''}
                      </span>
                    </div>
                    <div className={wizardStyles.stammdatenOverviewItem}>
                      <span className={wizardStyles.stammdatenOverviewLabel}>
                        Akte:
                      </span>
                      <span className={wizardStyles.stammdatenOverviewValue}>
                        {normalizeDisplayText(props.matterDraftTitle) ||
                          'fehlt'}
                      </span>
                    </div>
                    <div className={wizardStyles.stammdatenOverviewItem}>
                      <span className={wizardStyles.stammdatenOverviewLabel}>
                        Aktenzahl:
                      </span>
                      <span className={wizardStyles.stammdatenOverviewValue}>
                        {normalizeDisplayText(props.matterDraftExternalRef) ||
                          'fehlt'}
                      </span>
                    </div>
                    <div className={wizardStyles.stammdatenOverviewItem}>
                      <span className={wizardStyles.stammdatenOverviewLabel}>
                        Jurisdiktion:
                      </span>
                      <span className={wizardStyles.stammdatenOverviewValue}>
                        {props.matterDraftJurisdiction}
                      </span>
                    </div>
                    {props.matterDraftGericht ? (
                      <div className={wizardStyles.stammdatenOverviewItem}>
                        <span className={wizardStyles.stammdatenOverviewLabel}>
                          Gericht:
                        </span>
                        <span className={wizardStyles.stammdatenOverviewValue}>
                          {normalizeDisplayText(props.matterDraftGericht)}
                        </span>
                      </div>
                    ) : null}
                    {normalizedAuthorityRefs.values.length > 0 ? (
                      <div className={wizardStyles.stammdatenOverviewItem}>
                        <span className={wizardStyles.stammdatenOverviewLabel}>
                          Behördenreferenzen:
                        </span>
                        <span className={wizardStyles.stammdatenOverviewValue}>
                          {normalizedAuthorityRefs.values.join('; ')}
                          {normalizedAuthorityRefs.rejected.length > 0 ? (
                            <details className={wizardStyles.hintMuted}>
                              <summary>
                                {`${normalizedAuthorityRefs.rejected.length} Eingabe(n) verworfen (Format unplausibel).`}
                              </summary>
                              <div
                                style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}
                              >
                                {normalizedAuthorityRefs.rejected.join('\n')}
                              </div>
                            </details>
                          ) : null}
                        </span>
                      </div>
                    ) : null}
                    {props.anwaltDisplayName ? (
                      <div className={wizardStyles.stammdatenOverviewItem}>
                        <span className={wizardStyles.stammdatenOverviewLabel}>
                          Vertretender Anwalt:
                        </span>
                        <span className={wizardStyles.stammdatenOverviewValue}>
                          {props.anwaltDisplayName}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Warnungen für fehlende optionale Felder vor Finalisierung */}
                {!props.matterDraftExternalRef.trim() ||
                !props.matterDraftGericht.trim() ||
                !props.matterDraftAssignedAnwaltId ? (
                  <div className={wizardStyles.bannerInfo} role="alert">
                    <strong>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.optionalMissing.title'
                      )}
                    </strong>
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.optionalMissing.body'
                      )}
                      <ul
                        style={{
                          marginTop: 6,
                          marginBottom: 0,
                          paddingLeft: 20,
                        }}
                      >
                        {!props.matterDraftExternalRef.trim() && (
                          <li>
                            {t.t(
                              'com.affine.caseAssistant.wizard.step5.optionalMissing.externalRef'
                            )}
                          </li>
                        )}
                        {!props.matterDraftGericht.trim() && (
                          <li>
                            {t.t(
                              'com.affine.caseAssistant.wizard.step5.optionalMissing.court'
                            )}
                          </li>
                        )}
                        {!props.matterDraftAssignedAnwaltId &&
                          props.anwaelte.length > 0 && (
                            <li>
                              {t.t(
                                'com.affine.caseAssistant.wizard.step5.optionalMissing.lawyer'
                              )}
                            </li>
                          )}
                      </ul>
                    </div>
                    <Button
                      variant="plain"
                      onClick={() => setStep(2)}
                      style={{ marginTop: 10 }}
                    >
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.optionalMissing.action'
                      )}
                    </Button>
                  </div>
                ) : null}

                <label className={wizardStyles.reviewConfirmationRow}>
                  <input
                    type="checkbox"
                    checked={reviewConfirmed}
                    onChange={event => setReviewConfirmed(event.target.checked)}
                  />
                  <span>
                    {t.t('com.affine.caseAssistant.wizard.step5.reviewConfirm')}
                  </span>
                </label>

                {needsReviewCount > 0 ? (
                  <label className={wizardStyles.formLabel}>
                    <strong>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.proofNote.requiredTitle'
                      )}
                    </strong>
                    <textarea
                      id="wizard-proof-note"
                      className={styles.input}
                      value={proofNote}
                      onChange={event => setProofNote(event.target.value)}
                      rows={3}
                      placeholder={t.t(
                        'com.affine.caseAssistant.wizard.step5.proofNote.requiredPlaceholder'
                      )}
                      aria-invalid={
                        proofNote.trim().length > 0 &&
                        proofNote.trim().length < 16
                      }
                      aria-required="true"
                    />
                    <span className={wizardStyles.hintMuted}>
                      {t.t(
                        'com.affine.caseAssistant.wizard.step5.proofNote.requiredHint',
                        {
                          count: needsReviewCount,
                        }
                      )}
                    </span>
                  </label>
                ) : (
                  <label className={wizardStyles.formLabel}>
                    {t[
                      'com.affine.caseAssistant.wizard.step5.proofNote.label'
                    ]()}{' '}
                    <span className={wizardStyles.hintMuted}>(optional)</span>
                    <textarea
                      className={styles.input}
                      value={proofNote}
                      onChange={event => setProofNote(event.target.value)}
                      rows={2}
                      placeholder={t[
                        'com.affine.caseAssistant.wizard.step5.proofNote.placeholder'
                      ]()}
                    />
                  </label>
                )}

                {finalizeStatus ? (
                  <div
                    className={wizardStyles.analysisStatus}
                    role="status"
                    aria-live="polite"
                  >
                    {finalizeStatus}
                  </div>
                ) : null}

                <CaseFactSheetSection
                  clientName={props.currentClient?.displayName ?? null}
                  matter={props.currentMatter ?? null}
                  anwaltName={props.anwaltDisplayName}
                  opposingParties={props.currentMatter?.opposingParties ?? []}
                  actors={props.actors}
                  deadlines={props.deadlines}
                  issues={props.issues}
                  findings={props.findings}
                  tasks={props.tasks}
                  documents={props.documents}
                  normReferences={props.normReferences}
                  caseSummary={props.caseSummary}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className={wizardStyles.navBar}>
          <div className={wizardStyles.navMeta}>
            {visibleStepIndex > 0 ? (
              <Button
                variant="plain"
                onClick={goPrevVisibleStep}
                disabled={props.isWorkflowBusy}
                data-testid="case-assistant:onboarding-wizard:nav-back"
              >
                {t['com.affine.caseAssistant.wizard.nav.back']()}
              </Button>
            ) : null}
          </div>

          <div className={wizardStyles.navRight}>
            {isUploadMinimalMode ? null : (
              <>
                {step === 4 ? (
                  <Button
                    variant="plain"
                    onClick={goNextVisibleStep}
                    disabled={props.isWorkflowBusy}
                    className={wizardStyles.skipButton}
                    data-testid="case-assistant:onboarding-wizard:step4-skip"
                  >
                    {t['com.affine.caseAssistant.wizard.nav.skip']()}
                  </Button>
                ) : null}

                {step !== 5 ? (
                  <Button
                    variant="primary"
                    disabled={
                      !canGoNext() || props.isWorkflowBusy || isSubmittingStep
                    }
                    data-testid="case-assistant:onboarding-wizard:nav-next"
                    onClick={() =>
                      props.runAsyncUiAction(onNext, 'wizard step failed')
                    }
                  >
                    {step === 1 &&
                    !props.selectedClientId &&
                    props.clientDraftName.trim()
                      ? t['com.affine.caseAssistant.wizard.nav.createClient']()
                      : step === 2
                        ? t[
                            'com.affine.caseAssistant.wizard.nav.createMatter'
                          ]()
                        : isSubmittingStep
                          ? t['com.affine.caseAssistant.wizard.nav.saving']()
                          : t['com.affine.caseAssistant.wizard.nav.next']()}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() =>
                      props.runAsyncUiAction(
                        onFinalize,
                        'wizard finalize failed'
                      )
                    }
                    disabled={
                      !canGoNext() || props.isWorkflowBusy || isFinalizing
                    }
                    data-testid="case-assistant:onboarding-wizard:finalize"
                    title={finalizeBlockerText ?? undefined}
                  >
                    {isFinalizing
                      ? t['com.affine.caseAssistant.wizard.nav.finalizing']()
                      : hasBlockers
                        ? t.t(
                            'com.affine.caseAssistant.wizard.nav.finalizeLocked'
                          )
                        : t['com.affine.caseAssistant.wizard.nav.finalize']()}
                  </Button>
                )}
                {finalizeBlockerText ? (
                  <div
                    className={wizardStyles.hintMuted}
                    role="alert"
                    style={{ marginTop: 8, fontSize: 12 }}
                  >
                    {finalizeBlockerText}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div
          className={wizardStyles.srOnly}
          aria-live="polite"
          aria-atomic="true"
        >
          {analysisStatus ??
            detectionStatus ??
            finalizeStatus ??
            filterStatus ??
            ''}
        </div>
      </div>
    </div>
  );

  return createPortal(wizardDialog, document.body);
};

CaseOnboardingWizard.displayName = 'CaseOnboardingWizard';
