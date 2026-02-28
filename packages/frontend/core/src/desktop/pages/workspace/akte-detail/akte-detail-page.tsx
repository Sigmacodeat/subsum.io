import { useConfirmModal } from '@affine/component';
import { useI18n } from '@affine/i18n';
import {
  LEGAL_UPLOAD_ACCEPT_ATTR,
  prepareLegalUploadFiles,
} from '@affine/core/modules/case-assistant';
import { insertFromMarkdown } from '@affine/core/blocksuite/utils';
import { useLiveData, useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import { LegalChatService } from '../../../../modules/case-assistant/services/legal-chat';
import { LegalCopilotWorkflowService } from '../../../../modules/case-assistant/services/legal-copilot-workflow';
import { CasePlatformOrchestrationService } from '../../../../modules/case-assistant/services/platform-orchestration';
import { CaseAssistantStore } from '../../../../modules/case-assistant/stores/case-assistant';
import type {
  AnwaltProfile,
  CaseDeadline,
  CaseFile,
  CasePriority,
  ClientRecord,
  LegalChatMessage,
  LegalChatMode,
  LegalChatSession,
  LegalDocumentRecord,
  LegalDocumentStatus,
  LegalFinding,
  MatterRecord,
  MatterStatus,
  SemanticChunk,
  WorkflowEvent,
} from '../../../../modules/case-assistant/types';
import { DocsService } from '../../../../modules/doc';
import { ViewBody, ViewIcon, ViewTitle } from '../../../../modules/workbench';
import { WorkbenchService } from '../../../../modules/workbench';
import { ViewSidebarTab } from '../../../../modules/workbench/view/view-islands';
import {
  FileUploadZone,
  type UploadedFile,
} from '../detail-page/tabs/case-assistant/sections/file-upload-zone';
import { BulkActionBar } from '../layouts/bulk-action-bar';
import { useBulkSelection } from '../layouts/use-bulk-selection';
import * as styles from './akte-detail-page.css';

type ActiveTab = 'documents' | 'pages' | 'semantic';
type SidePanelTab = 'copilot' | 'info' | 'deadlines';
type AlertTierFilter = 'all' | 'P1' | 'P2' | 'P3';
type AlertKindFilter = 'all' | 'deadline' | 'finding';
type DocumentReviewFilter = 'all' | 'open' | 'reviewed' | 'attention';
type DocumentViewMode = 'list' | 'cards';

const AKTE_CHAT_UPLOAD_CHUNK_SIZE = 20;
const DOC_REVIEW_DONE_TAG = '__review_done';
const DOC_REVIEW_ATTENTION_TAG = '__review_attention';

const STATUS_STYLE: Record<MatterStatus, string> = {
  open: styles.statusOpen,
  closed: styles.statusClosed,
  archived: styles.statusArchived,
};

function relativeTime(
  dateStr: string,
  language: string,
  t: ReturnType<typeof useI18n>
): string {
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) {
    return t['com.affine.caseAssistant.akteDetail.fallback.none']();
  }
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 1) {
    return t['com.affine.caseAssistant.akteDetail.fallback.none']();
  }
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (Math.abs(diffMin) < 60) {
    return rtf.format(-diffMin, 'minute');
  }

  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) {
    return rtf.format(-diffH, 'hour');
  }

  const diffD = Math.round(diffH / 24);
  if (Math.abs(diffD) < 7) {
    return rtf.format(-diffD, 'day');
  }

  const diffW = Math.round(diffD / 7);
  if (Math.abs(diffW) < 5) {
    return rtf.format(-diffW, 'week');
  }

  const diffM = Math.round(diffD / 30);
  if (Math.abs(diffM) < 12) {
    return rtf.format(-diffM, 'month');
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateStr));
}

function getPriorityRank(priority: CasePriority): number {
  switch (priority) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function sanitizeDigestText(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '';
  }
  if (
    /binary/i.test(compact) &&
    /placeholder|verworfen|discarded/i.test(compact)
  ) {
    return '';
  }
  return compact;
}

function buildDocumentSummary(text: string): string {
  if (!text) {
    return '';
  }
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 24);
  const summary = sentences.slice(0, 2).join(' ');
  const candidate = summary || text.slice(0, 260);
  return candidate.length > 260 ? `${candidate.slice(0, 257)}…` : candidate;
}

function buildDocumentToc(input: {
  text: string;
  chunks: SemanticChunk[];
}): string[] {
  const headings = input.text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(
      line =>
        line.length >= 8 &&
        line.length <= 90 &&
        !/[;:,.]$/.test(line) &&
        /[A-Za-zÄÖÜäöü]/.test(line)
    );
  const dedupedHeadings = [...new Set(headings)].slice(0, 4);
  if (dedupedHeadings.length > 0) {
    return dedupedHeadings;
  }

  const keywords = input.chunks
    .flatMap(chunk => chunk.keywords ?? [])
    .filter(Boolean);
  return [...new Set(keywords)].slice(0, 4);
}

function normalizeOcrTextForPage(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (
    trimmed === '[binary-in-ocr-cache]' ||
    (/\bbinary\b/i.test(trimmed) &&
      /placeholder|verworfen|discarded|ocr-cache/i.test(trimmed))
  ) {
    return '';
  }
  return trimmed;
}

function clipForMarkdown(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n\n[... gekürzt für bessere Editor-Performance ...]`;
}

function buildChunkCoverageMarkdown(input: {
  chunks: SemanticChunk[];
  pageCount?: number;
}): string[] {
  const sorted = [...input.chunks].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) {
    return ['- Keine Chunks vorhanden. Manuelle OCR-Prüfung erforderlich.'];
  }

  const pageSet = new Set<number>();
  for (const chunk of sorted) {
    if (typeof chunk.pageNumber === 'number' && Number.isFinite(chunk.pageNumber)) {
      pageSet.add(chunk.pageNumber);
    }
  }

  const pages = [...pageSet].sort((a, b) => a - b);
  const missingPages: number[] = [];
  if (typeof input.pageCount === 'number' && input.pageCount > 0 && pages.length > 0) {
    for (let page = 1; page <= input.pageCount; page++) {
      if (!pageSet.has(page)) {
        missingPages.push(page);
      }
    }
  }

  const previewLines = sorted.slice(0, 12).map(chunk => {
    const page =
      typeof chunk.pageNumber === 'number' && Number.isFinite(chunk.pageNumber)
        ? `S. ${chunk.pageNumber}`
        : 'S. ?';
    const snippet = chunk.text.replace(/\s+/g, ' ').trim().slice(0, 90);
    return `- ${page} · Chunk ${chunk.index + 1}: ${snippet}${chunk.text.length > 90 ? '…' : ''}`;
  });

  const lines: string[] = [
    `- Chunks gesamt: ${sorted.length}`,
    pages.length > 0
      ? `- Seiten mit OCR-Inhalt: ${pages.join(', ')}`
      : '- Keine Seitenzuordnung in Chunks vorhanden.',
  ];
  if (missingPages.length > 0) {
    lines.push(`- Potenziell fehlende Seiten: ${missingPages.join(', ')}`);
  }
  lines.push(...previewLines);
  if (sorted.length > previewLines.length) {
    lines.push(`- ... ${sorted.length - previewLines.length} weitere Chunks verfügbar.`);
  }
  return lines;
}

function buildLegalDocumentHydrationMarkdown(input: {
  doc: LegalDocumentRecord;
  chunks: SemanticChunk[];
}): string {
  const normalizedText = normalizeOcrTextForPage(input.doc.normalizedText);
  const rawText = normalizeOcrTextForPage(input.doc.rawText);
  const chunkText = input.chunks
    .sort((a, b) => a.index - b.index)
    .map(chunk => chunk.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join('\n\n');
  const bestTextSource = normalizedText || chunkText || rawText;
  const clippedBody = bestTextSource
    ? clipForMarkdown(bestTextSource, 120_000)
    : '⚠️ Kein verwertbarer OCR-Text gefunden. Bitte Originaldatei prüfen und OCR ggf. erneut ausführen.';

  const pageCountInfo =
    typeof input.doc.pageCount === 'number' && input.doc.pageCount > 0
      ? `${input.doc.pageCount}`
      : 'unbekannt';
  const processingInfo = input.doc.processingStatus ?? 'unknown';
  const qualityInfo =
    typeof input.doc.overallQualityScore === 'number'
      ? `${Math.round(input.doc.overallQualityScore)} / 100`
      : 'nicht vorhanden';
  const sourceRefInfo = input.doc.sourceRef
    ? `- Quelle: ${input.doc.sourceRef}`
    : '- Quelle: nicht hinterlegt';

  return [
    `## OCR-Import: ${input.doc.title}`,
    '',
    `- Dokument-ID: ${input.doc.id}`,
    sourceRefInfo,
    `- Seiten: ${pageCountInfo}`,
    `- Verarbeitung: ${processingInfo}`,
    `- Qualitäts-Score: ${qualityInfo}`,
    '',
    '## Seiten- & Chunk-Abdeckung',
    '',
    ...buildChunkCoverageMarkdown({
      chunks: input.chunks,
      pageCount: input.doc.pageCount,
    }),
    '',
    '---',
    '',
    '## Extrahierter OCR-Inhalt',
    '',
    clippedBody,
  ].join('\n');
}

function hasDocWorkflowTag(doc: LegalDocumentRecord, tag: string): boolean {
  return Array.isArray(doc.tags) && doc.tags.includes(tag);
}

function upsertDocTag(tags: string[], tag: string, enabled: boolean): string[] {
  const deduped = [...new Set(tags)];
  if (enabled) {
    return deduped.includes(tag) ? deduped : [...deduped, tag];
  }
  return deduped.filter(existing => existing !== tag);
}

function isPreviewableSourceRef(value?: string): boolean {
  if (!value) {
    return false;
  }
  return /^(https?:\/\/|blob:|data:application\/pdf)/i.test(value.trim());
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function getDocStatusInfo(
  status: LegalDocumentStatus,
  t: ReturnType<typeof useI18n>
): { label: string; className: string } {
  switch (status) {
    case 'indexed':
      return {
        label: t['com.affine.caseAssistant.akteDetail.docStatus.ready'](),
        className: styles.docStatusReady,
      };
    case 'uploaded':
    case 'ocr_pending':
    case 'ocr_running':
    case 'ocr_completed':
      return {
        label: t['com.affine.caseAssistant.akteDetail.docStatus.processing'](),
        className: styles.docStatusPending,
      };
    case 'failed':
      return {
        label: t['com.affine.caseAssistant.akteDetail.docStatus.failed'](),
        className: styles.docStatusFailed,
      };
    default:
      return { label: String(status), className: styles.docStatusPending };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const AkteDetailPage = () => {
  const { workspaceId = '', matterId = '' } = useParams();
  const store = useService(CaseAssistantStore);
  const docsService = useService(DocsService);
  const workbenchService = useService(WorkbenchService);
  const workbench = workbenchService.workbench;
  const casePlatformOrchestrationService = useService(
    CasePlatformOrchestrationService
  );
  const copilotWorkflowService = useService(LegalCopilotWorkflowService);
  const chatService = useService(LegalChatService);
  const { openConfirmModal } = useConfirmModal();
  const t = useI18n();
  const none = t['com.affine.caseAssistant.akteDetail.fallback.none']();
  const language = t.language;

  const graph = (useLiveData(store.watchGraph()) ?? {
    clients: {},
    matters: {},
    cases: {},
    actors: {},
    issues: {},
    deadlines: {},
    memoryEvents: {},
    updatedAt: new Date(0).toISOString(),
  }) as {
    clients: Record<string, ClientRecord>;
    matters: Record<string, MatterRecord>;
    cases: Record<string, CaseFile>;
    actors: Record<string, unknown>;
    issues: Record<string, unknown>;
    deadlines: Record<string, CaseDeadline>;
    memoryEvents: Record<string, unknown>;
    updatedAt: string;
    anwaelte?: Record<string, AnwaltProfile>;
  };

  const legalDocs: LegalDocumentRecord[] =
    useLiveData(copilotWorkflowService.legalDocuments$) ?? [];
  const legalFindings: LegalFinding[] =
    useLiveData(copilotWorkflowService.findings$) ?? [];
  const semanticChunks: SemanticChunk[] =
    useLiveData(store.watchSemanticChunks()) ?? [];
  const chatSessions: LegalChatSession[] =
    useLiveData(chatService.chatSessions$) ?? [];
  const chatMessages: LegalChatMessage[] =
    useLiveData(chatService.chatMessages$) ?? [];
  const workflowEvents: WorkflowEvent[] =
    useLiveData(store.watchWorkflowEvents()) ?? [];

  // ═══ Derived Data ═══
  const matter = useMemo(
    () => graph.matters?.[matterId] as MatterRecord | undefined,
    [graph.matters, matterId]
  );
  const client = useMemo(
    () =>
      matter?.clientId
        ? (graph.clients?.[matter.clientId] as ClientRecord | undefined)
        : undefined,
    [graph.clients, matter?.clientId]
  );
  const anwaelte = useMemo(
    () => (graph as any).anwaelte ?? {},
    [graph]
  ) as Record<string, AnwaltProfile>;
  const assignedAnwalt = useMemo(
    () =>
      matter?.assignedAnwaltId
        ? (anwaelte[matter.assignedAnwaltId] as AnwaltProfile | undefined)
        : undefined,
    [anwaelte, matter?.assignedAnwaltId]
  );

  const caseFiles = useMemo(
    () =>
      Object.values(graph.cases ?? {}).filter(
        (c: CaseFile) => c.matterId === matterId
      ),
    [graph.cases, matterId]
  );
  const caseIds = useMemo(() => new Set(caseFiles.map(c => c.id)), [caseFiles]);

  const docKindLabel = useMemo(
    () => ({
      note: t['com.affine.caseAssistant.akteDetail.docKind.note'](),
      pdf: t['com.affine.caseAssistant.akteDetail.docKind.pdf'](),
      'scan-pdf': t['com.affine.caseAssistant.akteDetail.docKind.scanPdf'](),
      email: t['com.affine.caseAssistant.akteDetail.docKind.email'](),
      docx: t['com.affine.caseAssistant.akteDetail.docKind.docx'](),
      xlsx: t['com.affine.caseAssistant.akteDetail.docKind.xlsx'](),
      pptx: t['com.affine.caseAssistant.akteDetail.docKind.pptx'](),
      other: t['com.affine.caseAssistant.akteDetail.docKind.other'](),
    }),
    [t]
  );

  const statusLabel = useMemo(
    () => ({
      open: t['com.affine.caseAssistant.akteDetail.matterStatus.open'](),
      closed: t['com.affine.caseAssistant.akteDetail.matterStatus.closed'](),
      archived:
        t['com.affine.caseAssistant.akteDetail.matterStatus.archived'](),
    }),
    [t]
  );

  const deadlineStatusLabel = useMemo(
    () => ({
      open: t.t('com.affine.caseAssistant.akteDetail.deadlineStatus.open'),
      alerted: t.t(
        'com.affine.caseAssistant.akteDetail.deadlineStatus.alerted'
      ),
      acknowledged: t.t(
        'com.affine.caseAssistant.akteDetail.deadlineStatus.acknowledged'
      ),
      completed: t.t(
        'com.affine.caseAssistant.akteDetail.deadlineStatus.completed'
      ),
      expired: t.t(
        'com.affine.caseAssistant.akteDetail.deadlineStatus.expired'
      ),
    }),
    [t]
  );

  const matterDocs = useMemo(
    () =>
      legalDocs.filter(
        d => caseIds.has(d.caseId) && d.workspaceId === workspaceId
      ),
    [legalDocs, caseIds, workspaceId]
  );

  const matterChunks = useMemo(
    () =>
      semanticChunks.filter(
        (c: SemanticChunk) =>
          caseIds.has(c.caseId) && c.workspaceId === workspaceId
      ),
    [semanticChunks, caseIds, workspaceId]
  );

  const matterFindings = useMemo(
    () =>
      legalFindings
        .filter(
          (finding: LegalFinding) =>
            caseIds.has(finding.caseId) && finding.workspaceId === workspaceId
        )
        .sort((a, b) => {
          const rankDiff =
            getPriorityRank(b.severity) - getPriorityRank(a.severity);
          if (rankDiff !== 0) return rankDiff;
          return b.confidence - a.confidence;
        }),
    [legalFindings, caseIds, workspaceId]
  );

  const deadlines = useMemo(() => {
    const allDeadlineIds = caseFiles.flatMap(c => c.deadlineIds);
    return allDeadlineIds
      .map(id => graph.deadlines?.[id])
      .filter((d): d is CaseDeadline => Boolean(d))
      .sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );
  }, [caseFiles, graph.deadlines]);

  const openDeadlines = useMemo(
    () =>
      deadlines.filter(d => d.status !== 'completed' && d.status !== 'expired'),
    [deadlines]
  );

  const latestCaseSummary = useMemo(() => {
    const latestCase = [...caseFiles].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    return (latestCase?.summary ?? '').trim();
  }, [caseFiles]);

  const deadlineAlertBuckets = useMemo(() => {
    const critical = openDeadlines.filter(d => daysUntil(d.dueAt) <= 0);
    const next7 = openDeadlines.filter(d => {
      const days = daysUntil(d.dueAt);
      return days > 0 && days <= 7;
    });
    return {
      critical,
      next7,
    };
  }, [openDeadlines]);

  const findingRiskAlerts = useMemo(() => {
    const riskyTypes = new Set<LegalFinding['type']>([
      'deadline_risk',
      'evidence_gap',
      'contradiction',
      'norm_error',
      'norm_warning',
    ]);
    return matterFindings
      .filter(finding => riskyTypes.has(finding.type))
      .slice(0, 6)
      .map(finding => {
        const sourceDocTitles = finding.sourceDocumentIds
          .map(id => matterDocs.find(doc => doc.id === id)?.title)
          .filter(Boolean)
          .slice(0, 2) as string[];
        const citation = finding.citations[0]?.quote?.trim();
        return {
          id: finding.id,
          title: finding.title,
          description: finding.description,
          severity: finding.severity,
          confidence: finding.confidence,
          type: finding.type,
          sourceDocTitles,
          citation,
        };
      });
  }, [matterFindings, matterDocs]);

  const findingDecisionById = useMemo(() => {
    const relevantEvents = workflowEvents
      .filter(
        event =>
          caseIds.has(event.caseId ?? '') &&
          (event.type === 'finding.acknowledged' ||
            event.type === 'finding.dismissed')
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const state = new Map<string, 'acknowledged' | 'dismissed'>();
    for (const event of relevantEvents) {
      const findingId = event.payload.findingId;
      if (typeof findingId !== 'string' || state.has(findingId)) {
        continue;
      }
      state.set(
        findingId,
        event.type === 'finding.dismissed' ? 'dismissed' : 'acknowledged'
      );
    }
    return state;
  }, [caseIds, workflowEvents]);

  const linkedPageIds = useMemo(
    () => matter?.linkedPageIds ?? [],
    [matter?.linkedPageIds]
  );

  // ═══ Local State ═══
  const [activeTab, setActiveTab] = useState<ActiveTab>('documents');
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('copilot');
  const [docSearch, setDocSearch] = useState('');
  const [docReviewFilter, setDocReviewFilter] =
    useState<DocumentReviewFilter>('all');
  const [docViewMode, setDocViewMode] = useState<DocumentViewMode>('cards');
  const [compareDocId, setCompareDocId] = useState<string | null>(null);
  const [comparePreviewFailed, setComparePreviewFailed] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isIntakeRunning, setIsIntakeRunning] = useState(false);
  const [intakeProgress, setIntakeProgress] = useState(0);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['/', ''])
  );
  const [isBulkDeletingDocs, setIsBulkDeletingDocs] = useState(false);
  const [lastBulkTrashedDocIds, setLastBulkTrashedDocIds] = useState<string[]>(
    []
  );
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [alertTierFilter, setAlertTierFilter] =
    useState<AlertTierFilter>('all');
  const [alertKindFilter, setAlertKindFilter] =
    useState<AlertKindFilter>('all');
  const uploadZoneRootRef = useRef<HTMLDivElement | null>(null);
  const linkedPageBackfillSignatureRef = useRef<string>('');

  const pipelineProgress = useMemo(() => {
    const indexedCount = matterDocs.filter(
      doc => doc.status === 'indexed'
    ).length;
    const ocrPendingCount = matterDocs.filter(
      doc => doc.status === 'ocr_pending'
    ).length;
    const ocrRunningCount = matterDocs.filter(
      doc => doc.status === 'ocr_running'
    ).length;
    const failedCount = matterDocs.filter(
      doc => doc.status === 'failed'
    ).length;
    const uploadedCount = matterDocs.filter(
      doc => doc.status === 'uploaded'
    ).length;
    const ocrCompletedCount = matterDocs.filter(
      doc => doc.status === 'ocr_completed'
    ).length;

    const total = matterDocs.length;
    const activeCount =
      uploadedCount + ocrCompletedCount + ocrPendingCount + ocrRunningCount;
    const completedCount = indexedCount + failedCount;

    const progress = isIntakeRunning
      ? intakeProgress
      : total === 0
        ? 0
        : activeCount > 0
          ? Math.max(55, Math.round((completedCount / total) * 100))
          : 100;

    const phaseLabel = isIntakeRunning
      ? t['com.affine.caseAssistant.akteDetail.pipeline.phase.upload']()
      : ocrRunningCount > 0
        ? t['com.affine.caseAssistant.akteDetail.pipeline.phase.ocrRunning']()
        : ocrPendingCount > 0
          ? t['com.affine.caseAssistant.akteDetail.pipeline.phase.ocrPending']()
          : indexedCount > 0
            ? t['com.affine.caseAssistant.akteDetail.pipeline.phase.indexed']()
            : failedCount > 0
              ? t['com.affine.caseAssistant.akteDetail.pipeline.phase.failed']()
              : t['com.affine.caseAssistant.akteDetail.pipeline.phase.idle']();

    return {
      phaseLabel,
      progress,
      active: isIntakeRunning || ocrRunningCount > 0 || ocrPendingCount > 0,
      indexedCount,
      ocrPendingCount,
      ocrRunningCount,
      failedCount,
    };
  }, [isIntakeRunning, intakeProgress, matterDocs, t]);

  // ═══ Chat State ═══
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(
    null
  );
  const [activeChatMode, setActiveChatMode] =
    useState<LegalChatMode>('general');
  const [isChatBusy, setIsChatBusy] = useState(false);

  const caseChatSessions = useMemo(() => {
    // Get ALL sessions from the store and filter by the matter's case IDs
    const allSessions = chatSessions;
    return allSessions
      .filter(s => caseIds.has(s.caseId) && s.workspaceId === workspaceId)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [caseIds, workspaceId, chatSessions]);

  const activeChatMessages = useMemo(
    () =>
      activeChatSessionId
        ? chatService.getSessionMessages(activeChatSessionId)
        : [],
    [chatService, activeChatSessionId, chatMessages]
  );

  // Auto-select first chat session
  useEffect(() => {
    if (!activeChatSessionId && caseChatSessions.length > 0) {
      setActiveChatSessionId(caseChatSessions[0].id);
    }
  }, [activeChatSessionId, caseChatSessions]);

  // ═══ Filter & Group Documents ═══
  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return matterDocs.filter(d => {
      const matchesSearch =
        q.length === 0 ||
        d.title.toLowerCase().includes(q) ||
        d.folderPath?.toLowerCase().includes(q) ||
        d.tags.some(tag => tag.toLowerCase().includes(q));

      const isReviewed = hasDocWorkflowTag(d, DOC_REVIEW_DONE_TAG);
      const needsAttention = hasDocWorkflowTag(d, DOC_REVIEW_ATTENTION_TAG);
      const matchesReviewFilter =
        docReviewFilter === 'all'
          ? true
          : docReviewFilter === 'reviewed'
            ? isReviewed
            : docReviewFilter === 'attention'
              ? needsAttention
              : !isReviewed && !needsAttention;

      return matchesSearch && matchesReviewFilter;
    });
  }, [matterDocs, docReviewFilter, docSearch]);

  const docReviewCounts = useMemo(() => {
    let reviewed = 0;
    let attention = 0;
    for (const doc of matterDocs) {
      if (hasDocWorkflowTag(doc, DOC_REVIEW_DONE_TAG)) {
        reviewed++;
      }
      if (hasDocWorkflowTag(doc, DOC_REVIEW_ATTENTION_TAG)) {
        attention++;
      }
    }
    return {
      all: matterDocs.length,
      reviewed,
      attention,
      open: Math.max(0, matterDocs.length - reviewed - attention),
    };
  }, [matterDocs]);

  const reviewCoveragePercent = useMemo(() => {
    if (docReviewCounts.all <= 0) {
      return 0;
    }
    return Math.round((docReviewCounts.reviewed / docReviewCounts.all) * 100);
  }, [docReviewCounts]);

  const folderGroups = useMemo(() => {
    const groups = new Map<string, LegalDocumentRecord[]>();
    for (const doc of filteredDocs) {
      const folder = doc.folderPath?.trim() || '/';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(doc);
    }
    // Sort folders alphabetically, root first
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b, 'de');
    });
    return sorted;
  }, [filteredDocs]);

  const sortedFilteredDocs = useMemo(
    () =>
      [...filteredDocs].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [filteredDocs]
  );

  const compareDoc = useMemo(
    () => (compareDocId ? matterDocs.find(doc => doc.id === compareDocId) ?? null : null),
    [compareDocId, matterDocs]
  );

  useEffect(() => {
    setComparePreviewFailed(false);
  }, [compareDocId]);

  const documentDigestById = useMemo(() => {
    const chunksByDocId = new Map<string, SemanticChunk[]>();
    for (const chunk of matterChunks) {
      if (!chunksByDocId.has(chunk.documentId)) {
        chunksByDocId.set(chunk.documentId, []);
      }
      chunksByDocId.get(chunk.documentId)!.push(chunk);
    }

    const digest = new Map<string, { summary: string; toc: string[] }>();
    for (const doc of matterDocs) {
      const docChunks = (chunksByDocId.get(doc.id) ?? []).sort(
        (a, b) => a.index - b.index
      );
      const textSource = sanitizeDigestText(doc.normalizedText || doc.rawText);
      const summary = buildDocumentSummary(
        textSource || docChunks.map(chunk => chunk.text).join(' ')
      );
      const toc = buildDocumentToc({
        text: textSource,
        chunks: docChunks,
      });
      digest.set(doc.id, { summary, toc });
    }

    return digest;
  }, [matterChunks, matterDocs]);

  const visibleDocIds = useMemo(() => {
    return folderGroups.flatMap(([, docs]) => docs.map(d => d.id));
  }, [folderGroups]);

  const bulkSelection = useBulkSelection({
    itemIds: visibleDocIds,
  });

  // ═══ Status Toast Helper ═══
  const showStatus = useCallback((msg: string) => {
    setActionStatus(msg);
    const timer = window.setTimeout(() => setActionStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  // ═══ Ensure CaseFile exists for this matter ═══
  const ensureCaseFile = useCallback(async (): Promise<string | null> => {
    if (caseFiles.length > 0) return caseFiles[0].id;
    if (!matter) return null;

    const now = new Date().toISOString();
    const newCaseId = `case-${matterId}-${Date.now()}`;
    const newCase: CaseFile = {
      id: newCaseId,
      workspaceId,
      matterId,
      title: t.t('com.affine.caseAssistant.akteDetail.autoCase.title', {
        matterTitle: matter.title,
      }),
      summary: t.t('com.affine.caseAssistant.akteDetail.autoCase.summary', {
        matterTitle: matter.title,
      }),
      actorIds: [],
      issueIds: [],
      deadlineIds: [],
      memoryEventIds: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await store.upsertCaseFile(newCase);
    showStatus(
      t['com.affine.caseAssistant.akteDetail.toast.autoCaseCreated']()
    );
    return newCaseId;
  }, [caseFiles, matter, matterId, workspaceId, store, showStatus, t]);

  // ═══ Navigation ═══
  const handleBackToAkten = useCallback(() => {
    workbench.openAkten();
  }, [workbench]);

  const handleOpenClient = useCallback(
    (clientId: string) => {
      if (!clientId) {
        showStatus(
          t['com.affine.caseAssistant.akteDetail.toast.noClientLinked']()
        );
        return;
      }
      workbench.open(`/mandanten/${clientId}`);
    },
    [showStatus, t, workbench]
  );

  const handleOpenFristenOverview = useCallback(() => {
    const params = new URLSearchParams();
    if (matterId) params.set('matterId', matterId);
    if (matter?.clientId) params.set('clientId', matter.clientId);
    workbench.open(`/fristen${params.size > 0 ? `?${params.toString()}` : ''}`);
  }, [matter?.clientId, matterId, workbench]);

  const openMainChatForMatter = useCallback(
    (statusLabel: string) => {
      const preferredCase = [...caseFiles].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      const params = new URLSearchParams({
        caMatterId: matterId,
        caClientId: matter?.clientId ?? '',
      });
      if (preferredCase?.id) {
        params.set('caCaseId', preferredCase.id);
      }
      workbench.open(`/chat?${params.toString()}`);
      showStatus(statusLabel);
    },
    [caseFiles, matterId, matter?.clientId, showStatus, workbench]
  );

  const classifyDeadlineTier = useCallback(
    (deadline: CaseDeadline): 'P1' | 'P2' | 'P3' => {
      const days = daysUntil(deadline.dueAt);
      if (days <= 0) return 'P1';
      if (days <= 3) return 'P2';
      return 'P3';
    },
    []
  );

  const classifyFindingTier = useCallback(
    (finding: { severity: CasePriority }): 'P1' | 'P2' | 'P3' => {
      if (finding.severity === 'critical' || finding.severity === 'high')
        return 'P1';
      if (finding.severity === 'medium') return 'P2';
      return 'P3';
    },
    []
  );

  const handleAcknowledgeDeadline = useCallback(
    async (deadline: CaseDeadline) => {
      if (
        deadline.status === 'acknowledged' ||
        deadline.status === 'completed'
      ) {
        return;
      }
      const result =
        await casePlatformOrchestrationService.markDeadlineAcknowledged(
          deadline.id
        );
      if (!result) {
        showStatus(
          t['com.affine.caseAssistant.akteDetail.toast.deadline.ack.failed']()
        );
        return;
      }
      showStatus(
        t.t('com.affine.caseAssistant.akteDetail.toast.deadline.ack.success', {
          title: deadline.title,
        })
      );
    },
    [casePlatformOrchestrationService, showStatus, t]
  );

  const handleResolveDeadline = useCallback(
    async (deadline: CaseDeadline) => {
      if (deadline.status === 'completed') {
        return;
      }
      const result =
        await casePlatformOrchestrationService.markDeadlineCompleted(
          deadline.id
        );
      if (!result) {
        showStatus(
          t[
            'com.affine.caseAssistant.akteDetail.toast.deadline.complete.failed'
          ]()
        );
        return;
      }
      showStatus(
        t.t(
          'com.affine.caseAssistant.akteDetail.toast.deadline.complete.success',
          { title: deadline.title }
        )
      );
    },
    [casePlatformOrchestrationService, showStatus, t]
  );

  const handleAcknowledgeFinding = useCallback(
    async (finding: { id: string; title: string }) => {
      const currentDecision = findingDecisionById.get(finding.id);
      if (
        currentDecision === 'acknowledged' ||
        currentDecision === 'dismissed'
      ) {
        return;
      }
      const result = await casePlatformOrchestrationService.acknowledgeFinding(
        finding.id
      );
      if (!result) {
        showStatus(
          t['com.affine.caseAssistant.akteDetail.toast.finding.ack.failed']()
        );
        return;
      }
      showStatus(
        t.t('com.affine.caseAssistant.akteDetail.toast.finding.ack.success', {
          title: finding.title,
        })
      );
    },
    [casePlatformOrchestrationService, findingDecisionById, showStatus, t]
  );

  const handleDismissFinding = useCallback(
    async (finding: { id: string; title: string }) => {
      const currentDecision = findingDecisionById.get(finding.id);
      if (currentDecision === 'dismissed') {
        return;
      }
      const reason = window.prompt(
        t.t(
          'com.affine.caseAssistant.akteDetail.toast.finding.dismiss.prompt',
          { title: finding.title }
        ),
        t[
          'com.affine.caseAssistant.akteDetail.toast.finding.dismiss.defaultReason'
        ]()
      );
      if (!reason || !reason.trim()) {
        return;
      }
      const result = await casePlatformOrchestrationService.dismissFinding(
        finding.id,
        reason.trim()
      );
      if (!result) {
        showStatus(
          t[
            'com.affine.caseAssistant.akteDetail.toast.finding.dismiss.failed'
          ]()
        );
        return;
      }
      showStatus(
        t.t(
          'com.affine.caseAssistant.akteDetail.toast.finding.dismiss.success',
          { title: finding.title }
        )
      );
    },
    [casePlatformOrchestrationService, findingDecisionById, showStatus, t]
  );

  const filteredDeadlineAlerts = useMemo(() => {
    if (alertKindFilter === 'finding') return [];
    const source = [
      ...deadlineAlertBuckets.critical,
      ...deadlineAlertBuckets.next7,
    ];
    if (alertTierFilter === 'all') {
      return source;
    }
    return source.filter(
      deadline => classifyDeadlineTier(deadline) === alertTierFilter
    );
  }, [
    alertKindFilter,
    alertTierFilter,
    classifyDeadlineTier,
    deadlineAlertBuckets.critical,
    deadlineAlertBuckets.next7,
  ]);

  const filteredFindingAlerts = useMemo(() => {
    if (alertKindFilter === 'deadline') return [];
    const actionableFindings = findingRiskAlerts.filter(
      finding => findingDecisionById.get(finding.id) !== 'dismissed'
    );
    if (alertTierFilter === 'all') return actionableFindings;
    return actionableFindings.filter(
      finding => classifyFindingTier(finding) === alertTierFilter
    );
  }, [
    alertKindFilter,
    alertTierFilter,
    classifyFindingTier,
    findingDecisionById,
    findingRiskAlerts,
  ]);

  const nextActions = useMemo(() => {
    const actions: Array<{
      id: string;
      title: string;
      detail: string;
      tier: 'P1' | 'P2' | 'P3';
      onRun: () => void;
    }> = [];

    if (deadlineAlertBuckets.critical.length > 0) {
      actions.push({
        id: 'deadline-critical',
        title:
          t[
            'com.affine.caseAssistant.akteDetail.nextAction.deadlineCritical.title'
          ](),
        detail: t.t(
          'com.affine.caseAssistant.akteDetail.nextAction.deadlineCritical.detail',
          { count: deadlineAlertBuckets.critical.length }
        ),
        tier: 'P1',
        onRun: () =>
          openMainChatForMatter(
            t[
              'com.affine.caseAssistant.akteDetail.nextAction.deadlineCritical.title'
            ]()
          ),
      });
    }

    const topFinding = findingRiskAlerts[0];
    if (topFinding) {
      actions.push({
        id: `finding-${topFinding.id}`,
        title: t.t(
          'com.affine.caseAssistant.akteDetail.nextAction.riskCheck.title',
          { title: topFinding.title }
        ),
        detail: t.t(
          'com.affine.caseAssistant.akteDetail.nextAction.riskCheck.detail',
          {
            severity: topFinding.severity.toUpperCase(),
            confidence: (topFinding.confidence * 100).toFixed(0),
          }
        ),
        tier: classifyFindingTier(topFinding),
        onRun: () =>
          openMainChatForMatter(
            t.t(
              'com.affine.caseAssistant.akteDetail.nextAction.riskCheck.title',
              { title: topFinding.title }
            )
          ),
      });
    }

    if (
      pipelineProgress.ocrPendingCount > 0 ||
      pipelineProgress.ocrRunningCount > 0
    ) {
      actions.push({
        id: 'ocr-pipeline',
        title:
          t['com.affine.caseAssistant.akteDetail.nextAction.pipeline.title'](),
        detail: t.t(
          'com.affine.caseAssistant.akteDetail.nextAction.pipeline.detail',
          {
            pending: pipelineProgress.ocrPendingCount,
            running: pipelineProgress.ocrRunningCount,
          }
        ),
        tier: 'P2',
        onRun: () =>
          openMainChatForMatter(
            t['com.affine.caseAssistant.akteDetail.nextAction.pipeline.title']()
          ),
      });
    }

    if (actions.length === 0) {
      actions.push({
        id: 'analysis-next',
        title:
          t['com.affine.caseAssistant.akteDetail.nextAction.analysis.title'](),
        detail:
          t['com.affine.caseAssistant.akteDetail.nextAction.analysis.detail'](),
        tier: 'P3',
        onRun: () =>
          openMainChatForMatter(
            t['com.affine.caseAssistant.akteDetail.nextAction.analysis.title']()
          ),
      });
    }

    return actions.slice(0, 3);
  }, [
    classifyFindingTier,
    deadlineAlertBuckets.critical.length,
    findingRiskAlerts,
    openMainChatForMatter,
    pipelineProgress.ocrPendingCount,
    pipelineProgress.ocrRunningCount,
    t,
  ]);

  const handleBulkReviewUpdate = useCallback(
    async (mode: 'reviewed' | 'attention') => {
      const ids = Array.from(bulkSelection.selectedIds);
      if (ids.length === 0) {
        return;
      }
      const selectedDocs = matterDocs.filter(doc => ids.includes(doc.id));
      if (selectedDocs.length === 0) {
        return;
      }

      const now = new Date().toISOString();
      await Promise.all(
        selectedDocs.map(async doc => {
          const withReviewed = upsertDocTag(
            doc.tags ?? [],
            DOC_REVIEW_DONE_TAG,
            mode === 'reviewed'
          );
          const nextTags = upsertDocTag(
            withReviewed,
            DOC_REVIEW_ATTENTION_TAG,
            mode === 'attention'
          );
          await casePlatformOrchestrationService.upsertLegalDocument({
            ...doc,
            tags: nextTags,
            updatedAt: now,
          });
        })
      );

      const workspaceForAudit = selectedDocs[0]?.workspaceId ?? workspaceId;
      await casePlatformOrchestrationService.appendAuditEntry({
        caseId: selectedDocs[0]?.caseId,
        workspaceId: workspaceForAudit,
        action:
          mode === 'reviewed'
            ? 'document.review.bulk.completed'
            : 'document.review.bulk.attention',
        severity: mode === 'reviewed' ? 'info' : 'warning',
        details:
          mode === 'reviewed'
            ? `${selectedDocs.length} Dokument(e) als Abgleich OK markiert.`
            : `${selectedDocs.length} Dokument(e) als Prüfen markiert.`,
        metadata: {
          count: String(selectedDocs.length),
          documentIds: selectedDocs.map(doc => doc.id).join(','),
        },
      });

      showStatus(
        mode === 'reviewed'
          ? `${selectedDocs.length} Dokument(e) als Abgleich OK markiert.`
          : `${selectedDocs.length} Dokument(e) als Prüfen markiert.`
      );
    },
    [
      bulkSelection.selectedIds,
      casePlatformOrchestrationService,
      matterDocs,
      showStatus,
      workspaceId,
    ]
  );

  const timelineEvents = useMemo(() => {
    const actorLabel = (actor: string) =>
      actor === 'user'
        ? t['com.affine.caseAssistant.akteDetail.timeline.actor.user']()
        : t['com.affine.caseAssistant.akteDetail.timeline.actor.system']();
    const daysLabel = (days: number) =>
      days < 0
        ? t.t('com.affine.caseAssistant.akteDetail.days.overdue', {
            count: Math.abs(days),
          })
        : days === 0
          ? t['com.affine.caseAssistant.akteDetail.days.today']()
          : t.t('com.affine.caseAssistant.akteDetail.days.remaining', {
              count: days,
            });

    const deadlineEvents = openDeadlines.map(deadline => {
      const days = daysUntil(deadline.dueAt);
      return {
        id: `deadline-${deadline.id}`,
        at: new Date(deadline.updatedAt || deadline.dueAt).getTime(),
        title: t.t('com.affine.caseAssistant.akteDetail.timeline.deadline', {
          title: deadline.title,
        }),
        detail: daysLabel(days),
        tier: classifyDeadlineTier(deadline),
        source:
          t['com.affine.caseAssistant.akteDetail.timeline.source.deadline'](),
      };
    });

    const findingEvents = findingRiskAlerts.map(finding => ({
      id: `finding-${finding.id}`,
      at: matterFindings.some(item => item.id === finding.id)
        ? new Date(
            matterFindings.find(item => item.id === finding.id)!.updatedAt
          ).getTime()
        : Date.now(),
      title: t.t('com.affine.caseAssistant.akteDetail.timeline.risk', {
        title: finding.title,
      }),
      detail: `${finding.type} · ${t.t('com.affine.caseAssistant.akteDetail.alert.confidence', { value: (finding.confidence * 100).toFixed(0) })}`,
      tier: classifyFindingTier(finding),
      source:
        t['com.affine.caseAssistant.akteDetail.timeline.source.analysis'](),
    }));

    const documentEvents = [...matterDocs]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 6)
      .map(doc => {
        const docStatusInfo = getDocStatusInfo(doc.status, t);
        const kindKey = (doc.kind ?? 'other') as keyof typeof docKindLabel;
        const kindLabel = docKindLabel[kindKey] ?? docKindLabel.other;
        return {
          id: `doc-${doc.id}`,
          at: new Date(doc.updatedAt).getTime(),
          title: t.t('com.affine.caseAssistant.akteDetail.timeline.document', {
            title: doc.title,
          }),
          detail: `${kindLabel} · ${docStatusInfo.label}`,
          tier:
            doc.status === 'failed'
              ? ('P1' as const)
              : doc.status === 'ocr_pending' || doc.status === 'ocr_running'
                ? ('P2' as const)
                : ('P3' as const),
          source:
            t[
              'com.affine.caseAssistant.akteDetail.timeline.source.ingestion'
            ](),
        };
      });

    const workflowAuditEvents = workflowEvents
      .filter(
        event =>
          caseIds.has(event.caseId ?? '') &&
          [
            'deadline.acknowledged',
            'deadline.completed',
            'deadline.reopened',
            'finding.acknowledged',
            'finding.dismissed',
          ].includes(event.type)
      )
      .slice(0, 20)
      .map(event => {
        const auditSource =
          t['com.affine.caseAssistant.akteDetail.timeline.source.audit']();
        if (event.type === 'deadline.acknowledged') {
          const dlTitle =
            typeof event.payload.deadlineTitle === 'string'
              ? event.payload.deadlineTitle
              : t[
                  'com.affine.caseAssistant.akteDetail.timeline.unnamedDeadline'
                ]();
          return {
            id: `wf-${event.id}`,
            at: new Date(event.createdAt).getTime(),
            title: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.deadlineAck',
              { title: dlTitle }
            ),
            detail: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.deadlineAck.detail',
              { actor: actorLabel(event.actor) }
            ),
            tier: 'P2' as const,
            source: auditSource,
          };
        }
        if (event.type === 'deadline.completed') {
          const dlTitle =
            typeof event.payload.deadlineTitle === 'string'
              ? event.payload.deadlineTitle
              : t[
                  'com.affine.caseAssistant.akteDetail.timeline.unnamedDeadline'
                ]();
          return {
            id: `wf-${event.id}`,
            at: new Date(event.createdAt).getTime(),
            title: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.deadlineCompleted',
              { title: dlTitle }
            ),
            detail: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.deadlineCompleted.detail',
              { actor: actorLabel(event.actor) }
            ),
            tier: 'P3' as const,
            source: auditSource,
          };
        }
        if (event.type === 'deadline.reopened') {
          const dlTitle =
            typeof event.payload.deadlineTitle === 'string'
              ? event.payload.deadlineTitle
              : t[
                  'com.affine.caseAssistant.akteDetail.timeline.unnamedDeadline'
                ]();
          return {
            id: `wf-${event.id}`,
            at: new Date(event.createdAt).getTime(),
            title: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.deadlineReopened',
              { title: dlTitle }
            ),
            detail: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.deadlineReopened.detail',
              { actor: actorLabel(event.actor) }
            ),
            tier: 'P1' as const,
            source: auditSource,
          };
        }
        if (event.type === 'finding.dismissed') {
          const fTitle =
            typeof event.payload.findingTitle === 'string'
              ? event.payload.findingTitle
              : t[
                  'com.affine.caseAssistant.akteDetail.timeline.unnamedFinding'
                ]();
          const reason =
            typeof event.payload.reason === 'string' &&
            event.payload.reason.trim().length > 0
              ? event.payload.reason
              : t['com.affine.caseAssistant.akteDetail.timeline.noReason']();
          return {
            id: `wf-${event.id}`,
            at: new Date(event.createdAt).getTime(),
            title: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.findingDismissed',
              { title: fTitle }
            ),
            detail: t.t(
              'com.affine.caseAssistant.akteDetail.timeline.findingDismissed.detail',
              { actor: actorLabel(event.actor), reason }
            ),
            tier: 'P2' as const,
            source: auditSource,
          };
        }

        const fTitle =
          typeof event.payload.findingTitle === 'string'
            ? event.payload.findingTitle
            : t[
                'com.affine.caseAssistant.akteDetail.timeline.unnamedFinding'
              ]();
        const confidence =
          typeof event.payload.confidence === 'number'
            ? t.t(
                'com.affine.caseAssistant.akteDetail.timeline.confidenceValue',
                { value: (event.payload.confidence * 100).toFixed(0) }
              )
            : t['com.affine.caseAssistant.akteDetail.timeline.confidenceNA']();
        return {
          id: `wf-${event.id}`,
          at: new Date(event.createdAt).getTime(),
          title: t.t(
            'com.affine.caseAssistant.akteDetail.timeline.findingAck',
            { title: fTitle }
          ),
          detail: t.t(
            'com.affine.caseAssistant.akteDetail.timeline.findingAck.detail',
            { actor: actorLabel(event.actor), confidence }
          ),
          tier: 'P3' as const,
          source: auditSource,
        };
      });

    return [
      ...workflowAuditEvents,
      ...deadlineEvents,
      ...findingEvents,
      ...documentEvents,
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 12);
  }, [
    caseIds,
    classifyDeadlineTier,
    classifyFindingTier,
    findingRiskAlerts,
    matterDocs,
    matterFindings,
    openDeadlines,
    t,
    workflowEvents,
  ]);

  const handleOpenDocument = useCallback(
    async (doc: LegalDocumentRecord) => {
      const openPage = (pageId: string) => {
        setSelectedPageId(pageId);
        workbench.openDoc(pageId);
        window.setTimeout(() => {
          workbench.activeView$.value?.activeSidebarTab('case-assistant');
        }, 0);
      };

      const ensureMatterLinkedPage = async (pageId: string) => {
        if (!matter) {
          return;
        }
        const existingIds = matter.linkedPageIds ?? [];
        if (existingIds.includes(pageId)) {
          return;
        }
        const result = await casePlatformOrchestrationService.upsertMatter({
          ...matter,
          linkedPageIds: [...existingIds, pageId],
          updatedAt: new Date().toISOString(),
        });
        if (!result) {
          throw new Error('matter-link-failed');
        }
      };

      const hydrateLinkedPageIfEmpty = async (
        pageId: string,
        sourceDoc: LegalDocumentRecord
      ) => {
        const markdown = buildLegalDocumentHydrationMarkdown({
          doc: sourceDoc,
          chunks: matterChunks.filter(chunk => chunk.documentId === sourceDoc.id),
        });

        let releaseDoc: (() => void) | null = null;
        let disposePriority: (() => void) | null = null;
        try {
          const opened = docsService.open(pageId);
          releaseDoc = opened.release;
          disposePriority = opened.doc.addPriorityLoad(10);
          await opened.doc.waitForSyncReady();
          disposePriority();
          disposePriority = null;

          const bsDoc = opened.doc.blockSuiteDoc;
          const noteBlock = bsDoc.getBlocksByFlavour('affine:note')[0];
          if (!noteBlock) {
            return;
          }

          const noteModel = noteBlock.model as {
            children?: Array<{
              props?: {
                text?: {
                  length?: number;
                };
              };
            }>;
          };
          const children = noteModel.children ?? [];
          const onlyChildTextLength = children[0]?.props?.text?.length ?? 0;
          const hasUserContent =
            children.length > 1 ||
            (children.length === 1 && Number(onlyChildTextLength) > 0);

          if (hasUserContent) {
            return;
          }

          await insertFromMarkdown(undefined, markdown, bsDoc, noteBlock.id, 0);
        } catch (error) {
          console.error('[akte-detail] OCR hydration failed', {
            pageId,
            documentId: sourceDoc.id,
            error,
          });
          showStatus(
            `Hinweis: OCR-Inhalt für "${sourceDoc.title}" konnte nicht automatisch eingefügt werden.`
          );
        } finally {
          disposePriority?.();
          releaseDoc?.();
        }
      };

      const openLinkedPage = async () => {
        if (doc.linkedPageId) {
          await ensureMatterLinkedPage(doc.linkedPageId);
          await hydrateLinkedPageIfEmpty(doc.linkedPageId, doc);
          openPage(doc.linkedPageId);
          return true;
        }

        const docRecord = docsService.createDoc({
          primaryMode: 'page',
          title: doc.title || 'Schriftsatz',
        });
        const linkedPageId = docRecord.id;

        await ensureMatterLinkedPage(linkedPageId);
        await casePlatformOrchestrationService.upsertLegalDocument({
          ...doc,
          linkedPageId,
          updatedAt: new Date().toISOString(),
        });

        await hydrateLinkedPageIfEmpty(linkedPageId, {
          ...doc,
          linkedPageId,
        });

        showStatus(`Arbeitsseite erstellt: ${doc.title}`);
        openPage(linkedPageId);
        return true;
      };

      try {
        if (await openLinkedPage()) {
          return;
        }
      } catch {
        // fallback to previous context-open behavior
      }

      const relatedCase = caseFiles.find(c => c.id === doc.caseId);
      if (relatedCase) {
        const params = new URLSearchParams({
          caMatterId: matterId,
          caClientId: matter?.clientId ?? '',
        });
        workbench.open(`/${relatedCase.id}?${params.toString()}`);
        workbench.openSidebar();
        window.setTimeout(() => {
          workbench.activeView$.value?.activeSidebarTab('case-assistant');
        }, 0);
      }
    },
    [
      caseFiles,
      casePlatformOrchestrationService,
      docsService,
      matter,
      matterId,
      matter?.clientId,
      matterChunks,
      showStatus,
      workbench,
    ]
  );

  const handleMarkDocumentReviewed = useCallback(
    async (doc: LegalDocumentRecord, reviewed: boolean) => {
      const withReview = upsertDocTag(
        doc.tags ?? [],
        DOC_REVIEW_DONE_TAG,
        reviewed
      );
      const nextTags = reviewed
        ? upsertDocTag(withReview, DOC_REVIEW_ATTENTION_TAG, false)
        : withReview;

      await casePlatformOrchestrationService.upsertLegalDocument({
        ...doc,
        tags: nextTags,
        updatedAt: new Date().toISOString(),
      });

      await casePlatformOrchestrationService.appendAuditEntry({
        caseId: doc.caseId,
        workspaceId: doc.workspaceId,
        action: reviewed ? 'document.review.completed' : 'document.review.reset',
        severity: 'info',
        details: reviewed
          ? `Abgleich als abgeschlossen markiert: ${doc.title}`
          : `Abgleich zurückgesetzt: ${doc.title}`,
        metadata: {
          documentId: doc.id,
          title: doc.title,
        },
      });

      showStatus(
        reviewed
          ? `Abgleich abgeschlossen: ${doc.title}`
          : `Abgleich zurückgesetzt: ${doc.title}`
      );
    },
    [casePlatformOrchestrationService, showStatus]
  );

  const handleToggleDocumentAttention = useCallback(
    async (doc: LegalDocumentRecord) => {
      const currentlyAttention = hasDocWorkflowTag(doc, DOC_REVIEW_ATTENTION_TAG);
      const nextAttention = !currentlyAttention;
      const withAttention = upsertDocTag(
        doc.tags ?? [],
        DOC_REVIEW_ATTENTION_TAG,
        nextAttention
      );
      const nextTags = nextAttention
        ? upsertDocTag(withAttention, DOC_REVIEW_DONE_TAG, false)
        : withAttention;

      await casePlatformOrchestrationService.upsertLegalDocument({
        ...doc,
        tags: nextTags,
        updatedAt: new Date().toISOString(),
      });

      showStatus(
        nextAttention
          ? `Prüfhinweis gesetzt: ${doc.title}`
          : `Prüfhinweis entfernt: ${doc.title}`
      );
    },
    [casePlatformOrchestrationService, showStatus]
  );

  const handleBulkDeleteDocuments = useCallback(() => {
    const ids = Array.from(bulkSelection.selectedIds);
    if (ids.length === 0) {
      return;
    }

    openConfirmModal({
      title:
        t['com.affine.caseAssistant.akteDetail.documents.bulk.confirm.title'](),
      description: t.t(
        'com.affine.caseAssistant.akteDetail.documents.bulk.moveToTrash.description',
        { count: ids.length }
      ),
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText:
        t[
          'com.affine.caseAssistant.akteDetail.documents.bulk.moveToTrash.confirm'
        ](),
      confirmButtonOptions: {
        variant: 'error',
      },
      onConfirm: async () => {
        if (isBulkDeletingDocs) {
          return;
        }
        setIsBulkDeletingDocs(true);
        try {
          const result =
            await casePlatformOrchestrationService.deleteDocumentsCascade(ids);
          bulkSelection.clear();
          setLastBulkTrashedDocIds(result.succeededIds);
          const failedSuffix =
            result.failedIds.length > 0
              ? t.t(
                  'com.affine.caseAssistant.akteDetail.documents.bulk.result.failedSuffix',
                  {
                    count: result.failedIds.length,
                  }
                )
              : '';
          showStatus(
            t.t(
              'com.affine.caseAssistant.akteDetail.documents.bulk.moveToTrash.success',
              {
                succeeded: result.succeededIds.length,
                total: result.total,
                failedSuffix,
              }
            )
          );
        } finally {
          setIsBulkDeletingDocs(false);
        }
      },
    });
  }, [
    bulkSelection,
    casePlatformOrchestrationService,
    isBulkDeletingDocs,
    openConfirmModal,
    showStatus,
    t,
  ]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === 'Escape' && bulkSelection.selectedCount > 0) {
        bulkSelection.clear();
      }

      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        bulkSelection.selectedCount > 0 &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA'
      ) {
        e.preventDefault();
        handleBulkDeleteDocuments();
      }

      if (
        (e.key === 'a' || e.key === 'A') &&
        (e.metaKey || e.ctrlKey) &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA'
      ) {
        e.preventDefault();
        bulkSelection.selectAllVisible(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bulkSelection, handleBulkDeleteDocuments]);

  const handleOpenPage = useCallback(
    (pageId: string) => {
      setSelectedPageId(pageId);
      workbench.openDoc(pageId);
      window.setTimeout(() => {
        workbench.activeView$.value?.activeSidebarTab('case-assistant');
      }, 0);
    },
    [workbench, matterId, matter?.clientId]
  );

  useEffect(() => {
    if (!matter) {
      linkedPageBackfillSignatureRef.current = '';
      return;
    }
    const existing = new Set(matter.linkedPageIds ?? []);
    const missing = Array.from(
      new Set(
        matterDocs
          .map(doc => doc.linkedPageId)
          .filter((id): id is string => Boolean(id && !existing.has(id)))
      )
    );
    if (missing.length === 0) {
      linkedPageBackfillSignatureRef.current = '';
      return;
    }

    const signature = `${matter.id}:${missing.sort().join('|')}`;
    if (linkedPageBackfillSignatureRef.current === signature) {
      return;
    }
    linkedPageBackfillSignatureRef.current = signature;

    void casePlatformOrchestrationService
      .upsertMatter({
        ...matter,
        linkedPageIds: [...existing, ...missing],
        updatedAt: new Date().toISOString(),
      })
      .catch(() => {
        linkedPageBackfillSignatureRef.current = '';
      });
  }, [casePlatformOrchestrationService, matter, matterDocs]);

  useEffect(() => {
    if (lastBulkTrashedDocIds.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLastBulkTrashedDocIds([]);
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [lastBulkTrashedDocIds]);

  const handleUndoBulkDocumentTrash = useCallback(async () => {
    if (lastBulkTrashedDocIds.length === 0) {
      return;
    }
    const result = await casePlatformOrchestrationService.restoreDocumentsBulk(
      lastBulkTrashedDocIds
    );
    const blockedSuffix =
      result.blockedIds.length > 0
        ? ` · ${result.blockedIds.length} blockiert`
        : '';
    const failedSuffix =
      result.failedIds.length > 0
        ? ` · ${result.failedIds.length} fehlgeschlagen`
        : '';
    showStatus(
      `Undo Dokumente: ${result.succeededIds.length}/${result.total} wiederhergestellt${blockedSuffix}${failedSuffix}.`
    );
    setLastBulkTrashedDocIds([]);
  }, [casePlatformOrchestrationService, lastBulkTrashedDocIds, showStatus]);

  const mainTabListId = `akte-detail-main-tabs-${matterId}`;
  const getMainTabId = (tab: ActiveTab) => `${mainTabListId}-tab-${tab}`;
  const getMainPanelId = (tab: ActiveTab) => `${mainTabListId}-panel-${tab}`;
  const mainTabs: ReadonlyArray<{
    key: ActiveTab;
    label: string;
    count: number;
  }> = [
    {
      key: 'documents',
      label: t['com.affine.caseAssistant.akteDetail.tabs.documents'](),
      count: matterDocs.length,
    },
    {
      key: 'pages',
      label: t['com.affine.caseAssistant.akteDetail.tabs.pages'](),
      count: linkedPageIds.length,
    },
    {
      key: 'semantic',
      label: t['com.affine.caseAssistant.akteDetail.tabs.semantic'](),
      count: matterChunks.length,
    },
  ];

  const documentViewOptions: ReadonlyArray<{
    key: DocumentViewMode;
    label: string;
  }> = [
    { key: 'cards', label: 'Karten' },
    { key: 'list', label: 'Liste' },
  ];

  const documentReviewOptions: ReadonlyArray<{
    key: DocumentReviewFilter;
    label: string;
    count: number;
  }> = [
    { key: 'all', label: 'Alle', count: docReviewCounts.all },
    { key: 'open', label: 'Offen', count: docReviewCounts.open },
    {
      key: 'reviewed',
      label: 'Abgleich OK',
      count: docReviewCounts.reviewed,
    },
    {
      key: 'attention',
      label: 'Prüfen',
      count: docReviewCounts.attention,
    },
  ];

  const sideTabListId = `akte-detail-side-tabs-${matterId}`;
  const getSideTabId = (tab: SidePanelTab) => `${sideTabListId}-tab-${tab}`;
  const getSidePanelId = (tab: SidePanelTab) => `${sideTabListId}-panel-${tab}`;

  const handleMainTabsKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const order: ActiveTab[] = ['documents', 'pages', 'semantic'];
      const currentIndex = order.indexOf(activeTab);
      const nextIndex =
        (currentIndex + (e.key === 'ArrowRight' ? 1 : -1) + order.length) %
        order.length;
      const nextTab = order[nextIndex];
      e.preventDefault();
      setActiveTab(nextTab);
      requestAnimationFrame(() => {
        const el = document.getElementById(
          `akte-detail-main-tabs-${matterId}-tab-${nextTab}`
        ) as HTMLButtonElement | null;
        el?.focus();
      });
    },
    [activeTab, matterId]
  );

  const handleSideTabsKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const order: SidePanelTab[] = ['copilot', 'info', 'deadlines'];
      const currentIndex = order.indexOf(sidePanelTab);
      const nextIndex =
        (currentIndex + (e.key === 'ArrowRight' ? 1 : -1) + order.length) %
        order.length;
      const nextTab = order[nextIndex];
      e.preventDefault();
      setSidePanelTab(nextTab);
      requestAnimationFrame(() => {
        const el = document.getElementById(
          `akte-detail-side-tabs-${matterId}-tab-${nextTab}`
        ) as HTMLButtonElement | null;
        el?.focus();
      });
    },
    [sidePanelTab, matterId]
  );

  // ═══ Create New Page in Akte ═══
  const handleCreatePage = useCallback(async () => {
    const title =
      newPageTitle.trim() ||
      t.t('com.affine.caseAssistant.akteDetail.toast.page.defaultTitle', {
        date: new Date().toLocaleDateString(language),
      });
    try {
      const docRecord = docsService.createDoc({
        primaryMode: 'page',
        title,
      });
      const docId = docRecord.id;

      // Add to matter's linkedPageIds
      if (matter) {
        const currentLinkedIds = matter.linkedPageIds ?? [];
        const updated: MatterRecord = {
          ...matter,
          linkedPageIds: [...currentLinkedIds, docId],
          updatedAt: new Date().toISOString(),
        };
        const result =
          await casePlatformOrchestrationService.upsertMatter(updated);
        if (!result) {
          showStatus(
            t['com.affine.caseAssistant.akteDetail.toast.page.updateFailed']()
          );
          return;
        }
      }

      setNewPageTitle('');
      showStatus(
        t.t('com.affine.caseAssistant.akteDetail.toast.page.created', { title })
      );

      // Open the new page with Akte context
      const params = new URLSearchParams({
        caMatterId: matterId,
        caClientId: matter?.clientId ?? '',
      });
      workbench.open(`/${docId}?${params.toString()}`);
      workbench.openSidebar();
      window.setTimeout(() => {
        workbench.activeView$.value?.activeSidebarTab('case-assistant');
      }, 0);
    } catch (error) {
      console.error('[akte-detail] failed to create page', error);
      showStatus(
        t['com.affine.caseAssistant.akteDetail.toast.page.createFailed']()
      );
    }
  }, [
    newPageTitle,
    docsService,
    matter,
    matterId,
    casePlatformOrchestrationService,
    showStatus,
    workbench,
    t,
    language,
  ]);

  // ═══ Remove Page from Akte ═══
  const handleRemovePageFromAkte = useCallback(
    async (pageId: string) => {
      if (!matter) return;
      const updated: MatterRecord = {
        ...matter,
        linkedPageIds: (matter.linkedPageIds ?? []).filter(id => id !== pageId),
        updatedAt: new Date().toISOString(),
      };
      const result =
        await casePlatformOrchestrationService.upsertMatter(updated);
      showStatus(
        result
          ? t['com.affine.caseAssistant.akteDetail.toast.page.removed']()
          : t['com.affine.caseAssistant.akteDetail.toast.page.removeFailed']()
      );
    },
    [casePlatformOrchestrationService, matter, showStatus, t]
  );

  // ═══ Upload Documents ═══
  const handlePreparedFiles = useCallback(
    async (files: UploadedFile[]) => {
      const targetCaseId = await ensureCaseFile();
      if (!targetCaseId) {
        showStatus(
          t['com.affine.caseAssistant.akteDetail.toast.chat.noCaseAvailable']()
        );
        return;
      }
      if (files.length === 0) {
        showStatus(
          t['com.affine.caseAssistant.akteDetail.toast.noSupportedFiles']()
        );
        return;
      }

      const documents = [];
      for (const file of files) {
        documents.push({
          title: file.name,
          kind: file.kind,
          content: file.content,
          pageCount: file.pageCount,
          sourceMimeType: file.mimeType || 'application/octet-stream',
          sourceSizeBytes: file.size,
          sourceLastModifiedAt: file.lastModifiedAt,
          sourceRef: `akte-upload:${matterId}:${file.name}:${Date.now()}`,
          tags: [] as string[],
        });
      }

      try {
        setIsIntakeRunning(true);
        setIntakeProgress(5);
        const chunks: Array<typeof documents> = [];
        for (let i = 0; i < documents.length; i += 25) {
          chunks.push(documents.slice(i, i + 25));
        }

        type IngestedDoc = Partial<LegalDocumentRecord> & {
          status?: string;
          processingStatus?: string;
        };
        const ingested: IngestedDoc[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const result = await copilotWorkflowService.intakeDocuments({
            caseId: targetCaseId,
            workspaceId,
            documents: chunk,
          });
          ingested.push(...(result as IngestedDoc[]));
          const nextProgress = Math.min(
            95,
            Math.round(((i + 1) / chunks.length) * 90) + 5
          );
          setIntakeProgress(nextProgress);
        }
        setIntakeProgress(100);
        const duplicateOrDeniedCount = Math.max(
          0,
          files.length - ingested.length
        );
        const scanCount = ingested.filter(
          (d: IngestedDoc) => d.status === 'ocr_pending'
        ).length;
        const needsReviewCount = ingested.filter(
          (d: IngestedDoc) => d.processingStatus === 'needs_review'
        ).length;
        const failedCount = ingested.filter(
          (d: IngestedDoc) => d.processingStatus === 'failed'
        ).length;
        let completedOcrJobsCount = 0;
        if (scanCount > 0) {
          const completedOcrJobs =
            await copilotWorkflowService.processPendingOcr(
              targetCaseId,
              workspaceId
            );
          completedOcrJobsCount = completedOcrJobs.length;
        }

        if (ingested.length === 0) {
          showStatus(
            duplicateOrDeniedCount > 0
              ? t[
                  'com.affine.caseAssistant.akteDetail.toast.noFilesIngested.duplicates'
                ]()
              : t[
                  'com.affine.caseAssistant.akteDetail.toast.noFilesIngested.generic'
                ]()
          );
          return;
        }

        showStatus(
          t.t('com.affine.caseAssistant.akteDetail.toast.upload.summary', {
            count: ingested.length,
            ocrSuffix:
              scanCount > 0
                ? completedOcrJobsCount > 0
                  ? ` ${completedOcrJobsCount}/${scanCount} OCR abgeschlossen.`
                  : t.t(
                      'com.affine.caseAssistant.akteDetail.toast.upload.ocrSuffix',
                      { count: scanCount }
                    )
                : '',
            reviewSuffix:
              needsReviewCount > 0
                ? t.t(
                    'com.affine.caseAssistant.akteDetail.toast.upload.reviewSuffix',
                    { count: needsReviewCount }
                  )
                : '',
            failedSuffix:
              failedCount > 0
                ? t.t(
                    'com.affine.caseAssistant.akteDetail.toast.upload.failedSuffix',
                    { count: failedCount }
                  )
                : '',
            skippedSuffix:
              duplicateOrDeniedCount > 0
                ? t.t(
                    'com.affine.caseAssistant.akteDetail.toast.upload.skippedSuffix',
                    { count: duplicateOrDeniedCount }
                  )
                : '',
          })
        );
      } catch (error) {
        console.error('[akte-detail] upload failed', error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : t[
                'com.affine.caseAssistant.akteDetail.toast.upload.failedGeneric'
              ]();
        showStatus(
          t.t('com.affine.caseAssistant.akteDetail.toast.upload.failed', {
            message,
          })
        );
      } finally {
        setIsIntakeRunning(false);
      }
    },
    [
      ensureCaseFile,
      matterId,
      workspaceId,
      copilotWorkflowService,
      showStatus,
      t,
    ]
  );

  const focusUploadZone = useCallback(() => {
    const root = uploadZoneRootRef.current;
    if (!root) return;
    const button = root.querySelector('[role="button"]') as HTMLElement | null;
    button?.click();
  }, []);

  // ═══ Chat Actions ═══
  const onCreateChatSession = useCallback(
    async (mode?: LegalChatMode) => {
      const caseId = await ensureCaseFile();
      if (!caseId) {
        showStatus(
          t['com.affine.caseAssistant.akteDetail.toast.chat.noCaseAvailable']()
        );
        return;
      }
      const session = chatService.createSession({
        caseId,
        workspaceId,
        mode: mode ?? activeChatMode,
      });
      setActiveChatSessionId(session.id);
      if (mode) setActiveChatMode(mode);
    },
    [chatService, ensureCaseFile, workspaceId, activeChatMode, showStatus, t]
  );

  const onSendChatMessage = useCallback(
    async (content: string, attachments: UploadedFile[] = []) => {
      if (
        !activeChatSessionId ||
        isChatBusy ||
        (!content.trim() && attachments.length === 0)
      )
        return;
      setIsChatBusy(true);
      try {
        const caseId =
          caseChatSessions.find(s => s.id === activeChatSessionId)?.caseId ??
          caseFiles[0]?.id;
        if (!caseId) {
          showStatus(
            t['com.affine.caseAssistant.akteDetail.toast.chat.noCaseForChat']()
          );
          return;
        }

        let effectiveContent = content.trim();
        if (attachments.length > 0) {
          const sourceRef = `akte-chat-upload:${activeChatSessionId}:${Date.now()}`;
          let jobId: string | null = null;

          try {
            const job = await casePlatformOrchestrationService.enqueueIngestionJob({
              caseId,
              workspaceId,
              sourceType: 'upload',
              sourceRef,
            });
            jobId = job.id;

            await casePlatformOrchestrationService.updateJobStatus({
              jobId,
              status: 'running',
              progress: 3,
            });

            const documents = attachments.map(file => ({
              title: file.name,
              kind: file.kind,
              content: file.content,
              pageCount: file.pageCount,
              sourceMimeType: file.mimeType,
              sourceSizeBytes: file.size,
              sourceLastModifiedAt: file.lastModifiedAt,
              sourceRef: `${sourceRef}:${file.name}`,
              folderPath: file.folderPath || '/akte/eingang/chat',
            }));

            const chunks: Array<typeof documents> = [];
            for (
              let index = 0;
              index < documents.length;
              index += AKTE_CHAT_UPLOAD_CHUNK_SIZE
            ) {
              chunks.push(
                documents.slice(index, index + AKTE_CHAT_UPLOAD_CHUNK_SIZE)
              );
            }

            const ingested: Array<
              Partial<LegalDocumentRecord> & {
                status?: string;
                processingStatus?: string;
              }
            > = [];

            for (let index = 0; index < chunks.length; index++) {
              const chunkResult = await copilotWorkflowService.intakeDocuments({
                caseId,
                workspaceId,
                documents: chunks[index],
              });
              ingested.push(...chunkResult);

              const progress = Math.min(
                95,
                Math.round(((index + 1) / chunks.length) * 92) + 3
              );
              await casePlatformOrchestrationService.updateJobStatus({
                jobId,
                status: 'running',
                progress,
              });
            }

            const failedCount = ingested.filter(
              item => item.processingStatus === 'failed'
            ).length;
            await casePlatformOrchestrationService.updateJobStatus({
              jobId,
              status: failedCount > 0 ? 'failed' : 'completed',
              progress: 100,
              errorMessage:
                failedCount > 0
                  ? `${failedCount} Datei(en) in der Verarbeitung fehlgeschlagen.`
                  : undefined,
            });

            if (ingested.length === 0) {
              showStatus(
                'Keine neuen Dateien aufgenommen (Duplikat oder fehlende Rechte).'
              );
            } else {
              const scanCount = ingested.filter(
                item => item.status === 'ocr_pending'
              ).length;
              showStatus(
                scanCount > 0
                  ? `${ingested.length} Datei(en) aufgenommen, ${scanCount} in OCR-Warteschlange.`
                  : `${ingested.length} Datei(en) aufgenommen.`
              );
            }

            if (!effectiveContent) {
              effectiveContent =
                'Bitte analysiere die soeben hochgeladenen Dokumente und erstelle eine strukturierte Ersteinschätzung mit Quellen.';
            }
          } catch (error) {
            if (jobId) {
              await casePlatformOrchestrationService.updateJobStatus({
                jobId,
                status: 'failed',
                progress: 100,
                errorMessage: 'Upload über Akte-Chat fehlgeschlagen',
              });
            }
            console.error('[akte-detail] attachment ingestion failed', error);
            showStatus('Datei-Import im Akte-Chat fehlgeschlagen.');
            return;
          }
        }

        await chatService.sendMessage({
          sessionId: activeChatSessionId,
          caseId,
          workspaceId,
          content: effectiveContent,
          mode: activeChatMode,
        });
      } catch (error) {
        console.error('[akte-detail] chat failed', error);
        showStatus(
          t['com.affine.caseAssistant.akteDetail.toast.chat.failed']()
        );
      } finally {
        setIsChatBusy(false);
      }
    },
    [
      chatService,
      activeChatSessionId,
      isChatBusy,
      activeChatMode,
      workspaceId,
      caseChatSessions,
      caseFiles,
      casePlatformOrchestrationService,
      copilotWorkflowService,
      showStatus,
      t,
    ]
  );

  // ═══ Folder Toggle ═══
  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }, []);

  // ═══ Not Found ═══
  if (!matter) {
    return (
      <>
        <ViewTitle
          title={t['com.affine.caseAssistant.akteDetail.notFound.title']()}
        />
        <ViewIcon icon="allDocs" />
        <ViewBody>
          <div className={styles.body}>
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>
                {t['com.affine.caseAssistant.akteDetail.notFound.title']()}
              </div>
              <div className={styles.emptyDescription}>
                {t[
                  'com.affine.caseAssistant.akteDetail.notFound.description'
                ]()}
              </div>
              <button
                type="button"
                className={styles.headerButton}
                onClick={handleBackToAkten}
              >
                {t['com.affine.caseAssistant.akteDetail.notFound.back']()}
              </button>
            </div>
          </div>
        </ViewBody>
      </>
    );
  }

  const anwaltName = assignedAnwalt
    ? `${assignedAnwalt.title ? assignedAnwalt.title + ' ' : ''}${assignedAnwalt.firstName} ${assignedAnwalt.lastName}`
    : null;

  return (
    <>
      <ViewTitle title={matter.title} />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div className={styles.body}>
          {/* ═══ Breadcrumb ═══ */}
          <div className={styles.breadcrumb}>
            <button
              type="button"
              className={styles.breadcrumbLink}
              onClick={handleBackToAkten}
            >
              {t['com.affine.caseAssistant.akteDetail.breadcrumb.akten']()}
            </button>
            <span className={styles.breadcrumbSep}>›</span>
            <span className={styles.breadcrumbCurrent}>
              {matter.externalRef ? `${matter.externalRef} — ` : ''}
              {matter.title}
            </span>
          </div>

          {/* ═══ Akte Header Card ═══ */}
          <div className={styles.akteHeader}>
            <div className={styles.akteHeaderTop}>
              <div className={styles.akteHeaderLeft}>
                <h1 className={styles.akteTitle}>{matter.title}</h1>
                <div className={styles.akteSubtitle}>
                  {client ? (
                    <button
                      type="button"
                      className={styles.breadcrumbLink}
                      onClick={() => handleOpenClient(client.id)}
                    >
                      {client.displayName}
                    </button>
                  ) : (
                    none
                  )}
                  {matter.gericht ? <span>· {matter.gericht}</span> : null}
                  {matter.externalRef ? (
                    <span>
                      ·{' '}
                      {t[
                        'com.affine.caseAssistant.akteDetail.header.refPrefix'
                      ]()}{' '}
                      {matter.externalRef}
                    </span>
                  ) : null}
                  {anwaltName ? <span>· {anwaltName}</span> : null}
                </div>
                <div className={styles.akteMetaRow}>
                  <span className={styles.akteMetaBadge}>
                    <span className={styles.akteMetaBadgeLabel}>
                      {t[
                        'com.affine.caseAssistant.akteDetail.meta.caseFiles'
                      ]()}
                    </span>
                    {caseFiles.length}
                  </span>
                  <span className={styles.akteMetaBadge}>
                    <span className={styles.akteMetaBadgeLabel}>
                      {t[
                        'com.affine.caseAssistant.akteDetail.meta.documents'
                      ]()}
                    </span>
                    {matterDocs.length}
                  </span>
                  <span className={styles.akteMetaBadge}>
                    <span className={styles.akteMetaBadgeLabel}>
                      {t['com.affine.caseAssistant.akteDetail.meta.pages']()}
                    </span>
                    {linkedPageIds.length}
                  </span>
                  <span className={styles.akteMetaBadge}>
                    <span className={styles.akteMetaBadgeLabel}>
                      {t['com.affine.caseAssistant.akteDetail.meta.chunks']()}
                    </span>
                    {matterChunks.length}
                  </span>
                  {openDeadlines.length > 0 && (
                    <span
                      className={`${styles.akteMetaBadge} ${styles.akteMetaBadgeUrgent}`}
                    >
                      <span className={styles.akteMetaBadgeLabel}>
                        {t[
                          'com.affine.caseAssistant.akteDetail.meta.deadlines'
                        ]()}
                      </span>
                      {openDeadlines.length}
                    </span>
                  )}
                  <span className={styles.akteMetaBadge}>
                    <span className={styles.akteMetaBadgeLabel}>Review</span>
                    {reviewCoveragePercent}%
                  </span>
                  <span className={styles.akteMetaBadge}>
                    <span className={styles.akteMetaBadgeLabel}>Abgleich OK</span>
                    {docReviewCounts.reviewed}
                  </span>
                  <span
                    className={`${styles.akteMetaBadge} ${
                      docReviewCounts.attention > 0
                        ? styles.akteMetaBadgeUrgent
                        : ''
                    }`}
                  >
                    <span className={styles.akteMetaBadgeLabel}>Prüfen</span>
                    {docReviewCounts.attention}
                  </span>
                  <span className={styles.akteMetaBadge}>
                    <span className={styles.akteMetaBadgeLabel}>Offen</span>
                    {docReviewCounts.open}
                  </span>
                </div>
                {latestCaseSummary ? (
                  <div className={styles.caseSummaryInline}>
                    <strong>Akten-Kurzlage:</strong> {latestCaseSummary}
                  </div>
                ) : null}
              </div>
              <div className={styles.akteHeaderActions}>
                <span
                  className={`${styles.statusBadge} ${STATUS_STYLE[matter.status]}`}
                >
                  {statusLabel[matter.status]}
                </span>
                <button
                  type="button"
                  className={styles.headerButton}
                  onClick={focusUploadZone}
                  title={t[
                    'com.affine.caseAssistant.akteDetail.documents.upload.tooltip'
                  ]()}
                >
                  {t['com.affine.caseAssistant.akteDetail.button.upload']()}
                </button>
                <button
                  type="button"
                  className={styles.headerButton}
                  onClick={handleOpenFristenOverview}
                  title={t[
                    'com.affine.caseAssistant.akteDetail.button.deadlines.title'
                  ]()}
                >
                  {t['com.affine.caseAssistant.akteDetail.button.deadlines']()}
                </button>
                <button
                  type="button"
                  className={`${styles.headerButton} ${styles.headerButtonPrimary}`}
                  onClick={() => {
                    setActiveTab('pages');
                    setNewPageTitle('');
                  }}
                  title={t[
                    'com.affine.caseAssistant.akteDetail.button.newPage.title'
                  ]()}
                >
                  {t['com.affine.caseAssistant.akteDetail.button.newPage']()}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.middleScrollArea}>
            <section
              className={styles.alertCenter}
              aria-label={t[
                'com.affine.caseAssistant.akteDetail.alert.title'
              ]()}
            >
              <div className={styles.alertCenterHeader}>
                <div>
                  <h2 className={styles.alertCenterTitle}>
                    {t['com.affine.caseAssistant.akteDetail.alert.title']()}
                  </h2>
                  <p className={styles.alertCenterSubtitle}>
                    {t['com.affine.caseAssistant.akteDetail.alert.subtitle']()}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${styles.headerButton} ${styles.headerButtonPrimary}`}
                  onClick={() =>
                    openMainChatForMatter(
                      t['com.affine.caseAssistant.akteDetail.alert.title']()
                    )
                  }
                >
                  {t['com.affine.caseAssistant.akteDetail.alert.openChat']()}
                </button>
              </div>

              <div className={styles.alertSummaryRow}>
                <div className={styles.alertSummaryCard}>
                  <span className={styles.alertSummaryLabel}>
                    {t[
                      'com.affine.caseAssistant.akteDetail.alert.summary.critical'
                    ]()}
                  </span>
                  <span className={styles.alertSummaryValue}>
                    {deadlineAlertBuckets.critical.length}
                  </span>
                </div>
                <div className={styles.alertSummaryCard}>
                  <span className={styles.alertSummaryLabel}>
                    {t[
                      'com.affine.caseAssistant.akteDetail.alert.summary.next7'
                    ]()}
                  </span>
                  <span className={styles.alertSummaryValue}>
                    {deadlineAlertBuckets.next7.length}
                  </span>
                </div>
                <div className={styles.alertSummaryCard}>
                  <span className={styles.alertSummaryLabel}>
                    {t[
                      'com.affine.caseAssistant.akteDetail.alert.summary.riskFindings'
                    ]()}
                  </span>
                  <span className={styles.alertSummaryValue}>
                    {findingRiskAlerts.length}
                  </span>
                </div>
              </div>

              <div className={styles.alertFilterBar}>
                <div className={styles.alertFilterGroup}>
                  {(['all', 'P1', 'P2', 'P3'] as const).map(tier => (
                    <button
                      key={tier}
                      type="button"
                      className={styles.alertFilterChip}
                      data-active={
                        alertTierFilter === tier ? 'true' : undefined
                      }
                      onClick={() => setAlertTierFilter(tier)}
                    >
                      {tier === 'all'
                        ? t[
                            'com.affine.caseAssistant.akteDetail.alert.filter.allPriorities'
                          ]()
                        : tier}
                    </button>
                  ))}
                </div>
                <div className={styles.alertFilterGroup}>
                  {(['all', 'deadline', 'finding'] as const).map(kind => (
                    <button
                      key={kind}
                      type="button"
                      className={styles.alertFilterChip}
                      data-active={
                        alertKindFilter === kind ? 'true' : undefined
                      }
                      onClick={() => setAlertKindFilter(kind)}
                    >
                      {kind === 'all'
                        ? t[
                            'com.affine.caseAssistant.akteDetail.alert.filter.allTypes'
                          ]()
                        : kind === 'deadline'
                          ? t[
                              'com.affine.caseAssistant.akteDetail.alert.filter.deadlines'
                            ]()
                          : t[
                              'com.affine.caseAssistant.akteDetail.alert.filter.findings'
                            ]()}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.alertGrid}>
                <div className={styles.alertColumn}>
                  <h3 className={styles.alertColumnTitle}>
                    {t[
                      'com.affine.caseAssistant.akteDetail.alert.col.deadlineRisks'
                    ]()}
                  </h3>
                  {filteredDeadlineAlerts.length === 0 ? (
                    <div className={styles.alertEmpty}>
                      {t[
                        'com.affine.caseAssistant.akteDetail.alert.empty.deadlines'
                      ]()}
                    </div>
                  ) : (
                    filteredDeadlineAlerts.slice(0, 5).map(deadline => {
                      const days = daysUntil(deadline.dueAt);
                      return (
                        <article key={deadline.id} className={styles.alertCard}>
                          <div className={styles.alertCardHeader}>
                            <span className={styles.alertCardTitle}>
                              {deadline.title}
                            </span>
                            <span
                              className={styles.alertTierBadge}
                              data-tier={classifyDeadlineTier(deadline)}
                            >
                              {classifyDeadlineTier(deadline)}
                            </span>
                          </div>
                          <p className={styles.alertCardMeta}>
                            {new Date(deadline.dueAt).toLocaleDateString(
                              language
                            )}{' '}
                            ·{' '}
                            {days < 0
                              ? t.t(
                                  'com.affine.caseAssistant.akteDetail.days.overdue',
                                  { count: Math.abs(days) }
                                )
                              : days === 0
                                ? t[
                                    'com.affine.caseAssistant.akteDetail.days.today'
                                  ]()
                                : t.t(
                                    'com.affine.caseAssistant.akteDetail.days.remaining',
                                    { count: days }
                                  )}
                          </p>
                          <p className={styles.alertCardMeta}>
                            {t.t(
                              'com.affine.caseAssistant.akteDetail.alert.status',
                              {
                                status: deadlineStatusLabel[deadline.status],
                              }
                            )}
                          </p>
                          <div className={styles.alertCardActions}>
                            <button
                              type="button"
                              className={styles.alertInlineButton}
                              onClick={() => {
                                handleAcknowledgeDeadline(deadline).catch(
                                  () => {
                                    showStatus(
                                      t[
                                        'com.affine.caseAssistant.akteDetail.alert.catch.deadlineAck'
                                      ]()
                                    );
                                  }
                                );
                              }}
                              disabled={
                                deadline.status === 'acknowledged' ||
                                deadline.status === 'completed'
                              }
                            >
                              {t[
                                'com.affine.caseAssistant.akteDetail.alert.btn.acknowledge'
                              ]()}
                            </button>
                            <button
                              type="button"
                              className={styles.alertInlineButton}
                              onClick={() => {
                                handleResolveDeadline(deadline).catch(() => {
                                  showStatus(
                                    t[
                                      'com.affine.caseAssistant.akteDetail.alert.catch.deadlineResolve'
                                    ]()
                                  );
                                });
                              }}
                              disabled={deadline.status === 'completed'}
                            >
                              {t[
                                'com.affine.caseAssistant.akteDetail.alert.btn.resolve'
                              ]()}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                <div className={styles.alertColumn}>
                  <h3 className={styles.alertColumnTitle}>
                    {t[
                      'com.affine.caseAssistant.akteDetail.alert.col.findingRisks'
                    ]()}
                  </h3>
                  {filteredFindingAlerts.length === 0 ? (
                    <div className={styles.alertEmpty}>
                      {t[
                        'com.affine.caseAssistant.akteDetail.alert.empty.findings'
                      ]()}
                    </div>
                  ) : (
                    filteredFindingAlerts.slice(0, 5).map(finding => (
                      <article key={finding.id} className={styles.alertCard}>
                        <div className={styles.alertCardHeader}>
                          <span className={styles.alertCardTitle}>
                            {finding.title}
                          </span>
                          <span
                            className={styles.alertTierBadge}
                            data-tier={classifyFindingTier(finding)}
                          >
                            {classifyFindingTier(finding)}
                          </span>
                        </div>
                        <p className={styles.alertCardMeta}>
                          {finding.type} ·{' '}
                          {t.t(
                            'com.affine.caseAssistant.akteDetail.alert.confidence',
                            { value: (finding.confidence * 100).toFixed(0) }
                          )}
                        </p>
                        <p className={styles.alertCardDescription}>
                          {finding.description}
                        </p>
                        {finding.sourceDocTitles.length > 0 ? (
                          <p className={styles.alertCardSource}>
                            {t.t(
                              'com.affine.caseAssistant.akteDetail.alert.source',
                              { sources: finding.sourceDocTitles.join(' · ') }
                            )}
                          </p>
                        ) : null}
                        {finding.citation ? (
                          <blockquote className={styles.alertCardQuote}>
                            “{finding.citation.slice(0, 180)}
                            {finding.citation.length > 180 ? '…' : ''}”
                          </blockquote>
                        ) : null}
                        <div className={styles.alertCardActions}>
                          <button
                            type="button"
                            className={styles.alertInlineButton}
                            onClick={() => {
                              handleAcknowledgeFinding(finding).catch(() => {
                                showStatus(
                                  t[
                                    'com.affine.caseAssistant.akteDetail.alert.catch.findingAck'
                                  ]()
                                );
                              });
                            }}
                            disabled={
                              findingDecisionById.get(finding.id) ===
                                'acknowledged' ||
                              findingDecisionById.get(finding.id) ===
                                'dismissed'
                            }
                          >
                            {t[
                              'com.affine.caseAssistant.akteDetail.alert.btn.acknowledge'
                            ]()}
                          </button>
                          <button
                            type="button"
                            className={styles.alertInlineButton}
                            onClick={() => {
                              handleDismissFinding(finding).catch(() => {
                                showStatus(
                                  t[
                                    'com.affine.caseAssistant.akteDetail.alert.catch.findingDismiss'
                                  ]()
                                );
                              });
                            }}
                            disabled={
                              findingDecisionById.get(finding.id) ===
                              'dismissed'
                            }
                          >
                            {t[
                              'com.affine.caseAssistant.akteDetail.alert.btn.dismiss'
                            ]()}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className={styles.alertColumn}>
                  <h3 className={styles.alertColumnTitle}>
                    {t[
                      'com.affine.caseAssistant.akteDetail.alert.col.nextSteps'
                    ]()}
                  </h3>
                  <div className={styles.nextActionsList}>
                    {nextActions.map(action => (
                      <button
                        key={action.id}
                        type="button"
                        className={styles.nextActionButton}
                        onClick={action.onRun}
                      >
                        <div className={styles.alertCardHeader}>
                          <span className={styles.alertCardTitle}>
                            {action.title}
                          </span>
                          <span
                            className={styles.alertTierBadge}
                            data-tier={action.tier}
                          >
                            {action.tier}
                          </span>
                        </div>
                        <span className={styles.alertCardMeta}>
                          {action.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.alertTimelineSection}>
                <h3 className={styles.alertColumnTitle}>
                  {t[
                    'com.affine.caseAssistant.akteDetail.alert.col.timeline'
                  ]()}
                </h3>
                {timelineEvents.length === 0 ? (
                  <div className={styles.alertEmpty}>
                    {t[
                      'com.affine.caseAssistant.akteDetail.alert.empty.timeline'
                    ]()}
                  </div>
                ) : (
                  <div className={styles.alertTimelineList}>
                    {timelineEvents.map(event => (
                      <article
                        key={event.id}
                        className={styles.alertTimelineItem}
                      >
                        <div className={styles.alertCardHeader}>
                          <span className={styles.alertCardTitle}>
                            {event.title}
                          </span>
                          <span
                            className={styles.alertTierBadge}
                            data-tier={event.tier}
                          >
                            {event.tier}
                          </span>
                        </div>
                        <p className={styles.alertCardMeta}>
                          {event.source} ·{' '}
                          {new Date(event.at).toLocaleString(language)}
                        </p>
                        <p className={styles.alertCardDescription}>
                          {event.detail}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ═══ Main Content Area ═══ */}
            <div className={styles.contentLayout}>
              {/* ═══ LEFT: Documents/Pages/Semantic ═══ */}
              <div className={styles.mainPanel}>
                {/* Tabs */}
                <div
                  className={styles.tabBar}
                  role="tablist"
                  aria-label="Akte Inhalte"
                  id={mainTabListId}
                  onKeyDown={handleMainTabsKeyDown}
                >
                  {mainTabs.map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      className={styles.tab}
                      data-active={activeTab === tab.key}
                      role="tab"
                      id={getMainTabId(tab.key)}
                      aria-selected={activeTab === tab.key}
                      aria-controls={getMainPanelId(tab.key)}
                      tabIndex={activeTab === tab.key ? 0 : -1}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                      <span className={styles.tabCount}>{tab.count}</span>
                    </button>
                  ))}
                </div>

                {/* Search Toolbar */}
                {activeTab === 'documents' && (
                  <div className={styles.docListToolbar}>
                    <input
                      className={styles.searchInput}
                      type="text"
                      placeholder={t[
                        'com.affine.caseAssistant.akteDetail.documents.search.placeholder'
                      ]()}
                      value={docSearch}
                      onChange={e => setDocSearch(e.target.value)}
                      aria-label={t[
                        'com.affine.caseAssistant.akteDetail.documents.search.aria'
                      ]()}
                    />
                    <span className={styles.docListCount}>
                      {filteredDocs.length} von {matterDocs.length}
                    </span>
                    <div
                      className={styles.alertFilterGroup}
                      role="group"
                      aria-label="Darstellung"
                    >
                      {documentViewOptions.map(option => (
                        <button
                          key={option.key}
                          type="button"
                          className={styles.alertFilterChip}
                          data-active={docViewMode === option.key ? 'true' : undefined}
                          aria-pressed={docViewMode === option.key}
                          onClick={() => setDocViewMode(option.key)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div
                      className={styles.alertFilterGroup}
                      role="group"
                      aria-label="Prüfstatus"
                    >
                      {documentReviewOptions.map(option => (
                        <button
                          key={option.key}
                          type="button"
                          className={styles.alertFilterChip}
                          data-active={
                            docReviewFilter === option.key ? 'true' : undefined
                          }
                          aria-pressed={docReviewFilter === option.key}
                          onClick={() => setDocReviewFilter(option.key)}
                        >
                          {option.label} {option.count}
                        </button>
                      ))}
                    </div>
                    {bulkSelection.selectedIds.size > 0 ? (
                      <div className={styles.alertFilterGroup}>
                        <button
                          type="button"
                          className={styles.alertFilterChip}
                          onClick={() => {
                            handleBulkReviewUpdate('reviewed').catch(() => {
                              showStatus('Bulk-Abgleichstatus konnte nicht gespeichert werden.');
                            });
                          }}
                        >
                          ✓ Auswahl als Abgleich OK
                        </button>
                        <button
                          type="button"
                          className={styles.alertFilterChip}
                          onClick={() => {
                            handleBulkReviewUpdate('attention').catch(() => {
                              showStatus('Bulk-Prüfhinweis konnte nicht gespeichert werden.');
                            });
                          }}
                        >
                          ⚠︎ Auswahl als Prüfen
                        </button>
                      </div>
                    ) : null}
                    {compareDoc ? (
                      <div className={styles.alertFilterGroup}>
                        <button
                          type="button"
                          className={styles.alertFilterChip}
                          data-active="true"
                          onClick={() => {
                            handleOpenDocument(compareDoc).catch(() => {});
                          }}
                        >
                          Abgleich: {compareDoc.title}
                        </button>
                        <button
                          type="button"
                          className={styles.alertFilterChip}
                          onClick={() => setCompareDocId(null)}
                        >
                          Schließen
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {activeTab === 'documents' ? (
                  <BulkActionBar
                    containerName="akte-detail-body"
                    selectedCount={bulkSelection.selectedIds.size}
                    selectionLabel={t.t(
                      'com.affine.caseAssistant.akteDetail.documents.bulk.selectedCount',
                      {
                        count: bulkSelection.selectedIds.size,
                      }
                    )}
                    isRunning={isBulkDeletingDocs}
                    canDelete={bulkSelection.selectedIds.size > 0}
                    deleteLabel={t[
                      'com.affine.caseAssistant.akteDetail.documents.bulk.moveToTrash'
                    ]()}
                    onDelete={handleBulkDeleteDocuments}
                    onClear={bulkSelection.clear}
                  />
                ) : null}

                {activeTab === 'documents' &&
                lastBulkTrashedDocIds.length > 0 ? (
                  <div className={styles.docListToolbar}>
                    <span className={styles.docListCount}>
                      {t.t(
                        'com.affine.caseAssistant.akteDetail.documents.bulk.trashed.status',
                        { count: lastBulkTrashedDocIds.length }
                      )}
                    </span>
                    <button
                      type="button"
                      className={styles.docActionButton}
                      onClick={() => {
                        handleUndoBulkDocumentTrash().catch(() => {
                          // no-op: status feedback is handled in the action itself
                        });
                      }}
                    >
                      {t[
                        'com.affine.caseAssistant.akteDetail.documents.bulk.trashed.undo'
                      ]()}
                    </button>
                  </div>
                ) : null}

                {/* Content */}
                <div className={styles.scrollArea}>
                  <div
                    role="tabpanel"
                    id={getMainPanelId('documents')}
                    aria-labelledby={getMainTabId('documents')}
                    hidden={activeTab !== 'documents'}
                  >
                    {activeTab === 'documents' && (
                      <div className={styles.docListContainer}>
                        <div ref={uploadZoneRootRef}>
                          <FileUploadZone
                            maxFiles={80}
                            onFilesReady={handlePreparedFiles}
                            pipelineProgress={pipelineProgress}
                          />
                        </div>

                        {compareDoc ? (
                          <section className={styles.docComparePanel}>
                            <div className={styles.docComparePanelHeader}>
                              <strong>OCR-Abgleich aktiv:</strong> {compareDoc.title}
                            </div>
                            <div className={styles.docComparePanelGrid}>
                              <div className={styles.docComparePane}>
                                <div className={styles.docComparePaneTitle}>
                                  Original (PDF/Quelle)
                                </div>
                                {isPreviewableSourceRef(compareDoc.sourceRef) &&
                                !comparePreviewFailed ? (
                                  <iframe
                                    title={`Quelle ${compareDoc.title}`}
                                    className={styles.docCompareIframe}
                                    src={compareDoc.sourceRef}
                                    onError={() => setComparePreviewFailed(true)}
                                  />
                                ) : (
                                  <div className={styles.docComparePlaceholder}>
                                    {comparePreviewFailed
                                      ? 'Vorschau konnte nicht geladen werden. Bitte Quelle direkt öffnen.'
                                      : 'Keine direkte Vorschau-URL verfügbar. Bitte Original über Repository/Quelle öffnen.'}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className={styles.inlineCreateButton}
                                  onClick={() => {
                                    if (!compareDoc.sourceRef) {
                                      showStatus('Keine Quell-Referenz vorhanden.');
                                      return;
                                    }
                                    window.open(compareDoc.sourceRef, '_blank', 'noopener,noreferrer');
                                  }}
                                >
                                  Quelle im neuen Tab öffnen
                                </button>
                              </div>
                              <div className={styles.docComparePane}>
                                <div className={styles.docComparePaneTitle}>
                                  Semantischer Arbeitsstand (Akte-Doc)
                                </div>
                                <div className={styles.docComparePlaceholder}>
                                  Die semantische Version wird in der verknüpften Seite geöffnet.
                                  Dort findest du Metadaten, Chunk-Abdeckung und den extrahierten OCR-Inhalt
                                  für die weitere Bearbeitung.
                                </div>
                                <button
                                  type="button"
                                  className={styles.inlineCreateButton}
                                  onClick={() => {
                                    handleOpenDocument(compareDoc).catch(() => {});
                                  }}
                                >
                                  Semantische Seite öffnen
                                </button>
                              </div>
                            </div>
                          </section>
                        ) : null}

                        {filteredDocs.length === 0 ? (
                          <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}></div>
                            <div className={styles.emptyTitle}>
                              {docSearch
                                ? t[
                                    'com.affine.caseAssistant.akteDetail.documents.empty.filtered.title'
                                  ]()
                                : t[
                                    'com.affine.caseAssistant.akteDetail.documents.empty.initial.title'
                                  ]()}
                            </div>
                            <div className={styles.emptyDescription}>
                              {docSearch
                                ? t[
                                    'com.affine.caseAssistant.akteDetail.documents.empty.filtered.description'
                                  ]()
                                : t[
                                    'com.affine.caseAssistant.akteDetail.documents.empty.initial.description'
                                  ]()}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Document List Grouped by Folder */}
                            {docViewMode === 'cards' ? (
                              <div className={styles.docCardGrid}>
                                {sortedFilteredDocs.map(doc => {
                                  const statusInfo = getDocStatusInfo(doc.status, t);
                                  const isReviewDone = hasDocWorkflowTag(
                                    doc,
                                    DOC_REVIEW_DONE_TAG
                                  );
                                  const needsAttention = hasDocWorkflowTag(
                                    doc,
                                    DOC_REVIEW_ATTENTION_TAG
                                  );
                                  const digest = documentDigestById.get(doc.id);
                                  return (
                                    <button
                                      key={doc.id}
                                      type="button"
                                      className={styles.docCard}
                                      aria-label={`Dokument öffnen: ${doc.title}`}
                                      onClick={() => {
                                        handleOpenDocument(doc).catch(() => {});
                                      }}
                                    >
                                      <div className={styles.docCardThumb}>
                                        <span className={styles.docCardThumbTitle}>
                                          {(doc.title || 'D').slice(0, 2).toUpperCase()}
                                        </span>
                                        <span className={styles.docCardThumbMeta}>
                                          {doc.pageCount ? `${doc.pageCount} S.` : 'Seiten ?'}
                                        </span>
                                      </div>
                                      <div className={styles.docCardBody}>
                                        <div className={styles.docTitle}>{doc.title}</div>
                                        <div className={styles.docDigestSummary}>
                                          {digest?.summary ??
                                            'Semantische Vorschau wird aus Chunks aufgebaut.'}
                                        </div>
                                        <div className={styles.docDigestToc}>
                                          <span
                                            className={`${styles.docStatusBadge} ${statusInfo.className}`}
                                          >
                                            {statusInfo.label}
                                          </span>
                                          {isReviewDone ? (
                                            <span
                                              className={`${styles.docStatusBadge} ${styles.docStatusReady}`}
                                            >
                                              Abgleich OK
                                            </span>
                                          ) : null}
                                          {needsAttention ? (
                                            <span
                                              className={`${styles.docStatusBadge} ${styles.docStatusPending}`}
                                            >
                                              Prüfen
                                            </span>
                                          ) : null}
                                          <span className={styles.docKindBadge}>
                                            {doc.chunkCount ?? 0} Chunks
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              folderGroups.map(([folder, docs]) => {
                                const folderPanelId = `${mainTabListId}-folder-${folder
                                  .replace(/[^a-zA-Z0-9_-]/g, '-')
                                  .toLowerCase()}`;
                                return (
                                <div key={folder} className={styles.folderSection}>
                                <button
                                  type="button"
                                  className={styles.folderHeader}
                                  onClick={() => toggleFolder(folder)}
                                  aria-expanded={expandedFolders.has(folder)}
                                  aria-controls={folderPanelId}
                                >
                                  <span
                                    className={styles.folderChevron}
                                    data-open={expandedFolders.has(folder)}
                                  >
                                    ›
                                  </span>
                                  <span className={styles.folderName}>
                                    {folder === '/'
                                      ? t[
                                          'com.affine.caseAssistant.akteDetail.documents.folder.root'
                                        ]()
                                      : folder}
                                  </span>
                                  <span className={styles.folderCount}>
                                    {docs.length}
                                  </span>
                                </button>

                                {expandedFolders.has(folder) && (
                                  <div
                                    id={folderPanelId}
                                    className={styles.folderContent}
                                  >
                                    {/* Header */}
                                    <div className={styles.docHeaderRow}>
                                      <span className={styles.docSelectCell}>
                                        <input
                                          className={styles.docSelectCheckbox}
                                          type="checkbox"
                                          checked={
                                            docs.length > 0 &&
                                            docs.every(d =>
                                              bulkSelection.selectedIds.has(
                                                d.id
                                              )
                                            )
                                          }
                                          ref={el => {
                                            if (!el) return;
                                            const anySelected = docs.some(d =>
                                              bulkSelection.selectedIds.has(
                                                d.id
                                              )
                                            );
                                            el.indeterminate =
                                              anySelected &&
                                              !docs.every(d =>
                                                bulkSelection.selectedIds.has(
                                                  d.id
                                                )
                                              );
                                          }}
                                          onChange={e => {
                                            for (const doc of docs) {
                                              bulkSelection.toggle(
                                                doc.id,
                                                e.currentTarget.checked
                                              );
                                            }
                                          }}
                                          aria-label={
                                            folder === '/'
                                              ? t[
                                                  'com.affine.caseAssistant.akteDetail.documents.selectAll.root'
                                                ]()
                                              : t.t(
                                                  'com.affine.caseAssistant.akteDetail.documents.selectAll.folder',
                                                  {
                                                    folder,
                                                  }
                                                )
                                          }
                                        />
                                      </span>
                                      <span>
                                        {t[
                                          'com.affine.caseAssistant.akteDetail.documents.table.document'
                                        ]()}
                                      </span>
                                      <span>
                                        {t[
                                          'com.affine.caseAssistant.akteDetail.documents.table.type'
                                        ]()}
                                      </span>
                                      <span className={styles.docMeta}>
                                        {t[
                                          'com.affine.caseAssistant.akteDetail.documents.table.date'
                                        ]()}
                                      </span>
                                      <span>
                                        {t[
                                          'com.affine.caseAssistant.akteDetail.documents.table.status'
                                        ]()}
                                      </span>
                                    </div>
                                    {docs
                                      .sort(
                                        (a, b) =>
                                          new Date(b.updatedAt).getTime() -
                                          new Date(a.updatedAt).getTime()
                                      )
                                      .map(doc => {
                                        const statusInfo = getDocStatusInfo(
                                          doc.status,
                                          t
                                        );
                                        const isReviewDone = hasDocWorkflowTag(
                                          doc,
                                          DOC_REVIEW_DONE_TAG
                                        );
                                        const needsAttention = hasDocWorkflowTag(
                                          doc,
                                          DOC_REVIEW_ATTENTION_TAG
                                        );
                                        const digest = documentDigestById.get(
                                          doc.id
                                        );
                                        return (
                                          <div
                                            key={doc.id}
                                            className={styles.docRow}
                                            data-selected={bulkSelection.isSelected(
                                              doc.id
                                            )}
                                            onClick={() => {
                                              handleOpenDocument(doc).catch(
                                                () => {
                                                  // fallback handling happens inside handleOpenDocument
                                                }
                                              );
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={e => {
                                              if (
                                                e.key === 'Enter' ||
                                                e.key === ' '
                                              ) {
                                                e.preventDefault();
                                                handleOpenDocument(doc).catch(
                                                  () => {
                                                    // fallback handling happens inside handleOpenDocument
                                                  }
                                                );
                                              }
                                            }}
                                          >
                                            <span
                                              className={styles.docSelectCell}
                                            >
                                              <input
                                                className={
                                                  styles.docSelectCheckbox
                                                }
                                                type="checkbox"
                                                checked={bulkSelection.isSelected(
                                                  doc.id
                                                )}
                                                onClick={e => {
                                                  e.stopPropagation();
                                                }}
                                                onChange={e => {
                                                  bulkSelection.toggleWithRange(
                                                    doc.id,
                                                    {
                                                      shiftKey: (
                                                        e.nativeEvent as any
                                                      ).shiftKey,
                                                    }
                                                  );
                                                }}
                                                aria-label={t.t(
                                                  'com.affine.caseAssistant.akteDetail.documents.selectOne.aria',
                                                  {
                                                    title: doc.title,
                                                  }
                                                )}
                                              />
                                            </span>
                                            <div className={styles.docTitleCol}>
                                              <div className={styles.docTitle}>
                                                {doc.title}
                                                {doc.chunkCount ? (
                                                  <span
                                                    className={
                                                      styles.docKindBadge
                                                    }
                                                  >
                                                    {doc.chunkCount} Chunks
                                                  </span>
                                                ) : null}
                                              </div>
                                              {digest?.summary ? (
                                                <div
                                                  className={
                                                    styles.docDigestSummary
                                                  }
                                                >
                                                  {digest.summary}
                                                </div>
                                              ) : null}
                                              {digest?.toc &&
                                              digest.toc.length > 0 ? (
                                                <div
                                                  className={
                                                    styles.docDigestToc
                                                  }
                                                >
                                                  {digest.toc.map(item => (
                                                    <span
                                                      key={`${doc.id}:${item}`}
                                                      className={
                                                        styles.docDigestTocItem
                                                      }
                                                    >
                                                      {item}
                                                    </span>
                                                  ))}
                                                </div>
                                              ) : null}
                                            </div>
                                            <span>
                                              <span
                                                className={styles.docKindBadge}
                                              >
                                                {docKindLabel[
                                                  (doc.kind ??
                                                    'other') as keyof typeof docKindLabel
                                                ] ?? docKindLabel.other}
                                              </span>
                                            </span>
                                            <span className={styles.docMeta}>
                                              {relativeTime(
                                                doc.updatedAt,
                                                language,
                                                t
                                              )}
                                            </span>
                                            <span className={styles.docMeta}>
                                              <span className={styles.docDigestToc}>
                                                <span
                                                  className={`${styles.docStatusBadge} ${statusInfo.className}`}
                                                >
                                                  {statusInfo.label}
                                                </span>
                                                {isReviewDone ? (
                                                  <span
                                                    className={`${styles.docStatusBadge} ${styles.docStatusReady}`}
                                                  >
                                                    Abgleich OK
                                                  </span>
                                                ) : null}
                                                {needsAttention ? (
                                                  <span
                                                    className={`${styles.docStatusBadge} ${styles.docStatusPending}`}
                                                  >
                                                    Prüfen
                                                  </span>
                                                ) : null}
                                              </span>
                                              <span className={styles.docRowActions}>
                                                <button
                                                  type="button"
                                                  className={styles.docActionButton}
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    handleMarkDocumentReviewed(
                                                      doc,
                                                      !isReviewDone
                                                    ).catch(() => {
                                                      showStatus(
                                                        `Abgleichstatus konnte nicht gespeichert werden: ${doc.title}`
                                                      );
                                                    });
                                                  }}
                                                  aria-label={
                                                    isReviewDone
                                                      ? `Abgleich zurücksetzen für ${doc.title}`
                                                      : `Abgleich als abgeschlossen markieren für ${doc.title}`
                                                  }
                                                >
                                                  {isReviewDone ? '↺' : '✓'}
                                                </button>
                                                <button
                                                  type="button"
                                                  className={styles.docActionButton}
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    handleToggleDocumentAttention(doc).catch(
                                                      () => {
                                                        showStatus(
                                                          `Prüfhinweis konnte nicht gespeichert werden: ${doc.title}`
                                                        );
                                                      }
                                                    );
                                                  }}
                                                  aria-label={
                                                    needsAttention
                                                      ? `Prüfhinweis entfernen für ${doc.title}`
                                                      : `Prüfhinweis setzen für ${doc.title}`
                                                  }
                                                >
                                                  ⚠︎
                                                </button>
                                                <button
                                                  type="button"
                                                  className={styles.docActionButton}
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    setCompareDocId(doc.id);
                                                    handleOpenDocument(doc).catch(() => {});
                                                  }}
                                                  aria-label={`Abgleichsansicht öffnen für ${doc.title}`}
                                                >
                                                  ⇄
                                                </button>
                                              </span>
                                            </span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                                </div>
                              );
                              })
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    role="tabpanel"
                    id={getMainPanelId('pages')}
                    aria-labelledby={getMainTabId('pages')}
                    hidden={activeTab !== 'pages'}
                  >
                    {activeTab === 'pages' && (
                      <div className={styles.docListContainer}>
                        {/* Inline Create */}
                        <div className={styles.inlineCreate}>
                          <input
                            className={styles.inlineCreateInput}
                            type="text"
                            placeholder={t[
                              'com.affine.caseAssistant.akteDetail.pages.createPlaceholder'
                            ]()}
                            value={newPageTitle}
                            onChange={e => setNewPageTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreatePage().catch(() => {
                                  // Fehlerstatus wird bereits innerhalb von handleCreatePage gesetzt.
                                });
                              }
                            }}
                          />
                          <button
                            type="button"
                            className={styles.inlineCreateButton}
                            onClick={() => {
                              handleCreatePage().catch(() => {
                                // Fehlerstatus wird bereits innerhalb von handleCreatePage gesetzt.
                              });
                            }}
                          >
                            {t[
                              'com.affine.caseAssistant.akteDetail.pages.createButton'
                            ]()}
                          </button>
                        </div>

                        {linkedPageIds.length === 0 ? (
                          <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}></div>
                            <div className={styles.emptyTitle}>
                              {t[
                                'com.affine.caseAssistant.akteDetail.pages.empty.title'
                              ]()}
                            </div>
                            <div className={styles.emptyDescription}>
                              {t[
                                'com.affine.caseAssistant.akteDetail.pages.empty.description'
                              ]()}
                            </div>
                          </div>
                        ) : (
                          linkedPageIds.map(pageId => {
                            const docRecord =
                              docsService.list.doc$(pageId).value;
                            const title =
                              docRecord?.meta$.value?.title || 'Untitled';
                            return (
                              <div
                                key={pageId}
                                className={styles.pageDocRow}
                                data-selected={selectedPageId === pageId}
                                onClick={() => handleOpenPage(pageId)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleOpenPage(pageId);
                                  }
                                }}
                              >
                                <span className={styles.pageDocIcon}></span>
                                <span className={styles.pageDocTitle}>
                                  {title}
                                </span>
                                <span className={styles.pageDocMeta}>
                                  {docRecord?.meta$.value?.updatedDate
                                    ? relativeTime(
                                        new Date(
                                          docRecord.meta$.value.updatedDate
                                        ).toISOString(),
                                        language,
                                        t
                                      )
                                    : ''}
                                </span>
                                <button
                                  type="button"
                                  className={styles.docActionButton}
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleRemovePageFromAkte(pageId).catch(
                                      () => {
                                        // Fehlerstatus wird bereits innerhalb von handleRemovePageFromAkte gesetzt.
                                      }
                                    );
                                  }}
                                  title={t[
                                    'com.affine.caseAssistant.akteDetail.pages.removeTooltip'
                                  ]()}
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    role="tabpanel"
                    id={getMainPanelId('semantic')}
                    aria-labelledby={getMainTabId('semantic')}
                    hidden={activeTab !== 'semantic'}
                  >
                    {activeTab === 'semantic' && (
                      <div className={styles.docListContainer}>
                        {matterChunks.length === 0 ? (
                          <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}></div>
                            <div className={styles.emptyTitle}>
                              {t[
                                'com.affine.caseAssistant.akteDetail.semantic.empty.title'
                              ]()}
                            </div>
                            <div className={styles.emptyDescription}>
                              {t[
                                'com.affine.caseAssistant.akteDetail.semantic.empty.description'
                              ]()}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={styles.docHeaderRow}>
                              <span>
                                {t.t(
                                  'com.affine.caseAssistant.akteDetail.semantic.header.chunkCategory'
                                )}
                              </span>
                              <span>
                                {t.t(
                                  'com.affine.caseAssistant.akteDetail.semantic.header.document'
                                )}
                              </span>
                              <span className={styles.docMeta}>
                                {t.t(
                                  'com.affine.caseAssistant.akteDetail.semantic.header.quality'
                                )}
                              </span>
                              <span>
                                {t.t(
                                  'com.affine.caseAssistant.akteDetail.semantic.header.keywords'
                                )}
                              </span>
                            </div>
                            {matterChunks.slice(0, 100).map(chunk => {
                              const sourceDoc = matterDocs.find(
                                d => d.id === chunk.documentId
                              );
                              return (
                                <div
                                  key={chunk.id}
                                  className={styles.docRow}
                                  tabIndex={0}
                                >
                                  <div className={styles.docTitle}>
                                    <span className={styles.docIcon}></span>
                                    <span className={styles.chunkCategory}>
                                      {chunk.category}
                                    </span>
                                    <span className={styles.docKindBadge}>
                                      #{chunk.index}
                                    </span>
                                  </div>
                                  <span className={styles.chunkDocTitle}>
                                    {sourceDoc?.title?.slice(0, 30) ?? none}
                                  </span>
                                  <span className={styles.docMeta}>
                                    {(chunk.qualityScore * 100).toFixed(0)}%
                                  </span>
                                  <span className={styles.chunkKeywords}>
                                    {chunk.keywords.slice(0, 3).join(', ')}
                                  </span>
                                </div>
                              );
                            })}
                            {matterChunks.length > 100 && (
                              <div className={styles.chunkMore}>
                                {t.t(
                                  'com.affine.caseAssistant.akteDetail.semantic.moreChunks',
                                  {
                                    count: matterChunks.length - 100,
                                  }
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Status Toast */}
          {actionStatus && (
            <div className={styles.actionStatus} role="status" aria-live="polite">
              {actionStatus}
            </div>
          )}
        </div>
      </ViewBody>

      <ViewSidebarTab
        tabId="akte-panel"
        icon={
          <span aria-hidden="true" className={styles.sidebarTabIcon}>
            A
          </span>
        }
        unmountOnInactive={false}
      >
        <div className={styles.sidePanel}>
          <div
            className={styles.sidePanelHeader}
            role="tablist"
            aria-label={t['com.affine.caseAssistant.akteDetail.sideTab.info']()}
            id={sideTabListId}
            onKeyDown={handleSideTabsKeyDown}
          >
            <button
              type="button"
              className={styles.sidePanelTab}
              data-active={sidePanelTab === 'copilot'}
              role="tab"
              id={getSideTabId('copilot')}
              aria-selected={sidePanelTab === 'copilot'}
              aria-controls={getSidePanelId('copilot')}
              tabIndex={sidePanelTab === 'copilot' ? 0 : -1}
              onClick={() => setSidePanelTab('copilot')}
            >
              {t['com.affine.caseAssistant.akteDetail.sideTab.copilot']()}
            </button>
            <button
              type="button"
              className={styles.sidePanelTab}
              data-active={sidePanelTab === 'info'}
              role="tab"
              id={getSideTabId('info')}
              aria-selected={sidePanelTab === 'info'}
              aria-controls={getSidePanelId('info')}
              tabIndex={sidePanelTab === 'info' ? 0 : -1}
              onClick={() => setSidePanelTab('info')}
            >
              {t['com.affine.caseAssistant.akteDetail.sideTab.info']()}
            </button>
            <button
              type="button"
              className={styles.sidePanelTab}
              data-active={sidePanelTab === 'deadlines'}
              role="tab"
              id={getSideTabId('deadlines')}
              aria-selected={sidePanelTab === 'deadlines'}
              aria-controls={getSidePanelId('deadlines')}
              tabIndex={sidePanelTab === 'deadlines' ? 0 : -1}
              onClick={() => setSidePanelTab('deadlines')}
            >
              {t[
                'com.affine.caseAssistant.akteDetail.sideTab.deadlinesLabel'
              ]()}{' '}
              {openDeadlines.length > 0 && (
                <span className={styles.sidePanelTabBadge}>
                  {openDeadlines.length}
                </span>
              )}
            </button>
          </div>

          <div className={styles.sidePanelBody}>
            <div
              role="tabpanel"
              id={getSidePanelId('copilot')}
              aria-labelledby={getSideTabId('copilot')}
              hidden={sidePanelTab !== 'copilot'}
            >
              {sidePanelTab === 'copilot' && (
                <AkteChatPanel
                  sessions={caseChatSessions}
                  activeSessionId={activeChatSessionId}
                  activeMessages={activeChatMessages}
                  activeMode={activeChatMode}
                  isBusy={isChatBusy}
                  matterTitle={matter.title}
                  clientName={client?.displayName ?? null}
                  onCreateSession={onCreateChatSession}
                  onSelectSession={setActiveChatSessionId}
                  onSwitchMode={setActiveChatMode}
                  onSendMessage={(content, attachments) => {
                    onSendChatMessage(content, attachments).catch(() => {
                      // Fehlerstatus wird bereits innerhalb von onSendChatMessage gesetzt.
                    });
                  }}
                />
              )}
            </div>

            <div
              role="tabpanel"
              id={getSidePanelId('info')}
              aria-labelledby={getSideTabId('info')}
              hidden={sidePanelTab !== 'info'}
            >
              {sidePanelTab === 'info' && (
                <div className={styles.contextInfoSection}>
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.matter'
                    ]()}
                    value={matter.title}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.client'
                    ]()}
                    value={client?.displayName ?? none}
                  />
                  <InfoRow
                    label={t['com.affine.caseAssistant.akteDetail.info.ref']()}
                    value={matter.externalRef ?? none}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.court'
                    ]()}
                    value={matter.gericht ?? none}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.lawyer'
                    ]()}
                    value={anwaltName ?? none}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.status'
                    ]()}
                    value={statusLabel[matter.status]}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.created'
                    ]()}
                    value={new Date(matter.createdAt).toLocaleDateString(
                      language
                    )}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.updated'
                    ]()}
                    value={relativeTime(matter.updatedAt, language, t)}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.caseFiles'
                    ]()}
                    value={String(caseFiles.length)}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.documents'
                    ]()}
                    value={String(matterDocs.length)}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.semanticChunks'
                    ]()}
                    value={String(matterChunks.length)}
                  />
                  <InfoRow
                    label={t[
                      'com.affine.caseAssistant.akteDetail.info.pages'
                    ]()}
                    value={String(linkedPageIds.length)}
                  />
                  {matter.description && (
                    <div className={styles.matterDescription}>
                      {matter.description}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              role="tabpanel"
              id={getSidePanelId('deadlines')}
              aria-labelledby={getSideTabId('deadlines')}
              hidden={sidePanelTab !== 'deadlines'}
            >
              {sidePanelTab === 'deadlines' && (
                <div className={styles.contextInfoSection}>
                  {openDeadlines.length === 0 ? (
                    <div className={styles.sidePanelEmptyState}>
                      Keine offenen Fristen.
                    </div>
                  ) : (
                    openDeadlines.map(d => {
                      const days = daysUntil(d.dueAt);
                      const isUrgent = days <= 3;
                      return (
                        <div
                          key={d.id}
                          className={`${styles.contextInfoRow} ${styles.deadlineRow}`}
                        >
                          <div>
                            <div
                              className={styles.deadlineTitle}
                              data-urgent={isUrgent ? 'true' : undefined}
                            >
                              {d.title}
                            </div>
                            <div className={styles.deadlineMeta}>
                              {new Date(d.dueAt).toLocaleDateString(language)}
                              {' · '}
                              {days < 0
                                ? t.t(
                                    'com.affine.caseAssistant.akteDetail.days.overdue',
                                    { count: Math.abs(days) }
                                  )
                                : days === 0
                                  ? t[
                                      'com.affine.caseAssistant.akteDetail.days.today'
                                    ]()
                                  : t.t(
                                      'com.affine.caseAssistant.akteDetail.days.remaining',
                                      { count: days }
                                    )}
                            </div>
                          </div>
                          <span
                            className={`${styles.docStatusBadge} ${
                              isUrgent
                                ? styles.docStatusFailed
                                : styles.docStatusPending
                            }`}
                          >
                            {d.priority}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ViewSidebarTab>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INFO ROW
// ═══════════════════════════════════════════════════════════════════════════════

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.contextInfoRow}>
    <span className={styles.contextInfoLabel}>{label}</span>
    <span className={styles.contextInfoValue}>{value}</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// AKTE CHAT PANEL (Embedded Copilot)
// ═══════════════════════════════════════════════════════════════════════════════

const CHAT_MODE_IDS: LegalChatMode[] = [
  'general',
  'strategie',
  'gegner',
  'richter',
  'beweislage',
  'fristen',
  'normen',
];

type AkteChatPanelProps = {
  sessions: LegalChatSession[];
  activeSessionId: string | null;
  activeMessages: LegalChatMessage[];
  activeMode: LegalChatMode;
  isBusy: boolean;
  matterTitle: string;
  clientName: string | null;
  onCreateSession: (mode?: LegalChatMode) => void | Promise<void>;
  onSelectSession: (id: string) => void;
  onSwitchMode: (mode: LegalChatMode) => void;
  onSendMessage: (content: string, attachments?: UploadedFile[]) => void;
};

const AkteChatPanel = ({
  sessions,
  activeSessionId,
  activeMessages,
  activeMode,
  isBusy,
  matterTitle,
  clientName,
  onCreateSession,
  onSelectSession,
  onSwitchMode,
  onSendMessage,
}: AkteChatPanelProps) => {
  const t = useI18n();
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isPreparingAttachments, setIsPreparingAttachments] =
    useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatModes = useMemo(
    () =>
      CHAT_MODE_IDS.map(id => ({
        id,
        label:
          t[
            `com.affine.caseAssistant.akteDetail.chat.mode.${id}` as keyof typeof t
          ](),
      })),
    [t]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (isBusy || isPreparingAttachments) return;
    if (!trimmed && attachedFiles.length === 0) return;
    onSendMessage(trimmed, attachedFiles);
    setInputValue('');
    setAttachedFiles([]);
    setAttachmentError(null);
  }, [attachedFiles, inputValue, isBusy, isPreparingAttachments, onSendMessage]);

  const onOpenFilePicker = useCallback(() => {
    if (isBusy || isPreparingAttachments) return;
    fileInputRef.current?.click();
  }, [isBusy, isPreparingAttachments]);

  const onAttachmentInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      event.target.value = '';
      if (!activeSessionId) {
        setAttachmentError('Bitte zuerst eine Chat-Session auswählen.');
        return;
      }
      if (!list || list.length === 0) {
        return;
      }

      const files = Array.from(list);
      (async () => {
        setIsPreparingAttachments(true);
        setAttachmentError(null);
        try {
          const { accepted, rejected } = await prepareLegalUploadFiles({
            files,
            maxFiles: 80,
          });

          if (accepted.length === 0) {
            setAttachmentError(
              rejected[0]?.reason ?? 'Keine unterstützten Dateien ausgewählt.'
            );
            return;
          }

          if (rejected.length > 0) {
            setAttachmentError(
              `${rejected.length} Datei(en) wurden übersprungen (nicht unterstützt, zu groß oder Lesefehler).`
            );
          }

          setAttachedFiles(prev => {
            const seen = new Set(
              prev.map(item => `${item.name}:${item.size}:${item.lastModifiedAt}`)
            );
            const merged = [...prev];
            for (const file of accepted) {
              const key = `${file.name}:${file.size}:${file.lastModifiedAt}`;
              if (!seen.has(key)) {
                seen.add(key);
                merged.push(file);
              }
            }
            return merged;
          });
        } catch {
          setAttachmentError('Dateianhänge konnten nicht gelesen werden.');
        } finally {
          setIsPreparingAttachments(false);
        }
      })().catch(() => {
        setAttachmentError('Dateianhänge konnten nicht gelesen werden.');
        setIsPreparingAttachments(false);
      });
    },
    [activeSessionId]
  );

  const onDropFiles = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      if (!activeSessionId || isBusy || isPreparingAttachments) {
        return;
      }

      const dropped = event.dataTransfer?.files;
      if (!dropped || dropped.length === 0) {
        return;
      }

      const fakeEvent = {
        target: { files: dropped, value: '' },
      } as unknown as ChangeEvent<HTMLInputElement>;

      onAttachmentInputChange(fakeEvent);
    },
    [activeSessionId, isBusy, isPreparingAttachments, onAttachmentInputChange]
  );

  const onDragOverSection = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }, [isDragOver]);

  const onDragLeaveSection = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

  const onRemoveAttachment = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  return (
    <div className={styles.chatRoot}>
      {/* Mode Selector */}
      <div className={styles.chatModeBar}>
        {chatModes.map(mode => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSwitchMode(mode.id)}
            className={
              activeMode === mode.id
                ? styles.chatModeButtonActive
                : styles.chatModeButton
            }
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Session List */}
      {sessions.length > 0 && (
        <div className={styles.chatSessionBar}>
          {sessions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSession(s.id)}
              className={styles.chatSessionChip}
              data-active={s.id === activeSessionId ? 'true' : undefined}
            >
              {s.title.slice(0, 20)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              Promise.resolve(onCreateSession()).catch(() => {
                // Fehlerstatus wird bereits innerhalb von onCreateSession gesetzt.
              });
            }}
            className={styles.chatSessionAdd}
          >
            ＋
          </button>
        </div>
      )}

      {/* Messages */}
      <div className={styles.chatMessagesArea}>
        {!activeSessionId ? (
          <div className={styles.chatEmptyState}>
            <div className={styles.chatEmptyTitle}>
              {t['com.affine.caseAssistant.akteDetail.chat.emptyTitle']()}
            </div>
            <div className={styles.chatEmptySubtitle}>
              {clientName && matterTitle
                ? `${clientName} — ${matterTitle}`
                : t['com.affine.caseAssistant.akteDetail.chat.emptySubtitle']()}
            </div>
            <div className={styles.chatEmptyModes}>
              {chatModes.slice(0, 4).map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    Promise.resolve(onCreateSession(mode.id)).catch(() => {
                      // Fehlerstatus wird bereits innerhalb von onCreateSession gesetzt.
                    });
                  }}
                  className={styles.chatModeButton}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        ) : activeMessages.length === 0 ? (
          <div className={styles.chatHint}>
            {t['com.affine.caseAssistant.akteDetail.chat.hint']()}
          </div>
        ) : (
          activeMessages.map(msg => (
            <div
              key={msg.id}
              className={`${styles.chatMessage} ${msg.role === 'user' ? styles.chatMessageUser : ''}`}
            >
              <div className={styles.chatMessageMeta}>
                {msg.role === 'user'
                  ? t['com.affine.caseAssistant.akteDetail.chat.role.user']()
                  : t[
                      'com.affine.caseAssistant.akteDetail.chat.role.copilot'
                    ]()}
                {msg.durationMs
                  ? ` · ${(msg.durationMs / 1000).toFixed(1)}s`
                  : ''}
              </div>
              <div className={styles.chatMessageContent}>
                {msg.status === 'pending'
                  ? t['com.affine.caseAssistant.akteDetail.chat.pending']()
                  : msg.content}
              </div>
              {msg.sourceCitations.length > 0 && (
                <div className={styles.chatCitations}>
                  {t.t('com.affine.caseAssistant.akteDetail.chat.sources', {
                    count: msg.sourceCitations.length,
                  })}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className={styles.chatInputBar}
        data-drag-over={isDragOver ? 'true' : undefined}
        onDrop={onDropFiles}
        onDragOver={onDragOverSection}
        onDragLeave={onDragLeaveSection}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept={LEGAL_UPLOAD_ACCEPT_ATTR}
          onChange={onAttachmentInputChange}
        />
        <button
          type="button"
          className={styles.chatAttachButton}
          onClick={onOpenFilePicker}
          disabled={!activeSessionId || isBusy || isPreparingAttachments}
          title="Dateien anhängen"
        >
          📎
        </button>
        <textarea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            activeSessionId
              ? t[
                  'com.affine.caseAssistant.akteDetail.chat.placeholder.active'
                ]()
              : t[
                  'com.affine.caseAssistant.akteDetail.chat.placeholder.inactive'
                ]()
          }
          disabled={!activeSessionId || isBusy}
          rows={2}
          className={styles.chatTextarea}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={
            (!inputValue.trim() && attachedFiles.length === 0) ||
            !activeSessionId ||
            isBusy ||
            isPreparingAttachments
          }
          className={styles.chatSendButton}
        >
          {isBusy || isPreparingAttachments ? '…' : '→'}
        </button>
      </div>
      {attachedFiles.length > 0 && (
        <div className={styles.chatAttachmentList}>
          {attachedFiles.map((file, index) => (
            <button
              key={`${file.name}:${file.size}:${file.lastModifiedAt}`}
              type="button"
              className={styles.chatAttachmentChip}
              onClick={() => onRemoveAttachment(index)}
              title="Anhang entfernen"
            >
              {file.name}
            </button>
          ))}
        </div>
      )}
      {attachmentError && (
        <div className={styles.chatAttachmentError}>{attachmentError}</div>
      )}
      {isBusy && <div className={styles.chatBusyHint}>Copilot analysiert…</div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const Component = () => {
  return <AkteDetailPage />;
};

export default Component;
