import { Button, Menu, MenuItem } from '@affine/component';
import {
  LEGAL_UPLOAD_ACCEPT_ATTR,
  type LegalDocumentKind,
  readStagedFilesStreaming,
  type StagedLegalFile,
  stageLegalUploadFiles,
} from '@affine/core/modules/case-assistant';
import { useI18n } from '@affine/i18n';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import {
  type ChangeEvent,
  type DragEvent,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as s from './file-upload-zone.css';

export type UploadedFile = {
  name: string;
  size: number;
  kind: LegalDocumentKind;
  content: string;
  mimeType: string;
  lastModifiedAt: string;
  pageCount?: number;
  folderPath?: string;
};

/* ═══════════════ Constants ═══════════════ */

const MAX_STAGED_RENDER = 60;
const LARGE_SELECTION_PAGE_SIZE = 200;
const MAX_ERROR_DISPLAY = 5;
const DEFAULT_MAX_FILES = 2000;
const MAX_PENDING_SELECTION_QUEUE = 6;
/** Files to read & send to pipeline per streaming micro-batch at commit time */
const COMMIT_READ_BATCH = 8;
/** Files to send to onFilesReady per pipeline call at commit time */
const COMMIT_PIPELINE_BATCH = 20;

type PendingSelection = {
  files: File[];
  autoSubmit: boolean;
};

function toKey(
  f: Pick<UploadedFile, 'name' | 'size' | 'lastModifiedAt' | 'folderPath'>
) {
  return `${f.name}:${f.size}:${f.lastModifiedAt}:${f.folderPath ?? ''}`;
}

function retryOutcomeLabel(
  action: 'success' | 'still_failed' | 'crashed' | 'no_content'
): string {
  if (action === 'success') return 'Retry erfolgreich';
  if (action === 'still_failed') return 'Retry weiterhin fehlgeschlagen';
  if (action === 'crashed') return 'Retry abgestuerzt';
  return 'Retry ohne Quelldaten';
}

function toLocalDateTime(value: string | undefined): string {
  if (!value) return '-';
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return '-';
  return ts.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toUserFacingError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function toPreparedKey(
  f: Pick<UploadedFile, 'name' | 'size' | 'lastModifiedAt'>
) {
  return `${f.name}:${f.size}:${f.lastModifiedAt}`;
}

function toStagedPreparedKey(
  f: Pick<StagedLegalFile, 'name' | 'size' | 'lastModifiedAt'>
) {
  return `${f.name}:${f.size}:${f.lastModifiedAt}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const total = Math.ceil(seconds);
  if (total < 60) return `${total}s`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}m ${sec}s`;
}

function pickAdaptiveReadBatch(
  items: Array<{ size: number }>,
  fallback = COMMIT_READ_BATCH
): number {
  if (items.length === 0) return fallback;
  const avg = items.reduce((sum, item) => sum + item.size, 0) / items.length;
  if (avg > 25 * 1024 * 1024) return 2;
  if (avg > 10 * 1024 * 1024) return 4;
  if (avg > 4 * 1024 * 1024) return 6;
  if (avg > 1 * 1024 * 1024) return 8;
  return 12;
}

function pickAdaptivePipelineBatch(
  items: Array<{ size: number }>,
  fallback = COMMIT_PIPELINE_BATCH
): number {
  if (items.length === 0) return fallback;
  const avg = items.reduce((sum, item) => sum + item.size, 0) / items.length;
  if (avg > 25 * 1024 * 1024) return 4;
  if (avg > 10 * 1024 * 1024) return 8;
  if (avg > 4 * 1024 * 1024) return 12;
  if (avg > 1 * 1024 * 1024) return 16;
  return 24;
}

function extractFolder(file: File): string | undefined {
  const p = (file.webkitRelativePath ?? '').trim().replace(/\\/g, '/');
  if (!p) return undefined;
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : `/${p.slice(0, i)}`;
}

/* ═══════════════ Types ═══════════════ */

type Progress = {
  total: number;
  processed: number;
  accepted: number;
  rejected: number;
  skipped: number;
  phase: 'idle' | 'preparing' | 'complete' | 'error';
};

type ErrorEntry = { name: string; reason: string; recommendation?: string };
type ErrorSeverity = 'critical' | 'warning' | 'info';

export type UploadTelemetryAlert = {
  type: 'queue_spike' | 'slow_chunk';
  message: string;
  severity: 'warning' | 'info';
  metrics: Record<string, string | number>;
};

export type PipelineFailureItem = {
  documentId: string;
  title: string;
  processingError?: string;
  extractionEngine?: string;
  updatedAt?: string;
  retryCount?: number;
  lastRetryAt?: string;
  lastRetryOutcome?: 'success' | 'still_failed' | 'crashed' | 'no_content';
  retryHistory?: Array<{
    action: 'success' | 'still_failed' | 'crashed' | 'no_content';
    createdAt: string;
  }>;
};

type FailureCategory = {
  label: string;
  tone: 'error' | 'warning';
  recommendation: string;
};

function classifyPipelineFailure(item: PipelineFailureItem): FailureCategory {
  const haystack =
    `${item.processingError ?? ''} ${item.extractionEngine ?? ''}`.toLowerCase();
  if (haystack.includes('verschlüsselt') || haystack.includes('encrypted')) {
    return {
      label: 'Verschlüsselt',
      tone: 'error',
      recommendation: 'PDF entsperren oder unverschlüsselte Version hochladen.',
    };
  }
  if (haystack.includes('timeout') || haystack.includes('zeitüberschreitung')) {
    return {
      label: 'Timeout',
      tone: 'warning',
      recommendation:
        'Erneut starten; bei großen Dateien in kleinere Teile aufteilen.',
    };
  }
  if (
    haystack.includes('base64') ||
    haystack.includes('mime') ||
    haystack.includes('ungültig') ||
    haystack.includes('invalid') ||
    haystack.includes('format')
  ) {
    return {
      label: 'Format',
      tone: 'error',
      recommendation:
        'Dateiformat prüfen und ggf. als PDF/Scan neu exportieren.',
    };
  }
  if (
    haystack.includes('berechtigung') ||
    haystack.includes('permission') ||
    haystack.includes('policy') ||
    haystack.includes('blocked')
  ) {
    return {
      label: 'Policy',
      tone: 'warning',
      recommendation: 'Rolle, Workspace-Policy und OCR-Freigaben prüfen.',
    };
  }
  if (
    haystack.includes('blob') ||
    haystack.includes('cache') ||
    haystack.includes('store')
  ) {
    return {
      label: 'Speicher',
      tone: 'warning',
      recommendation:
        'Datei erneut hochladen und anschließend Retry ausführen.',
    };
  }
  if (haystack.includes('ocr')) {
    return {
      label: 'OCR',
      tone: 'warning',
      recommendation:
        'OCR-Provider prüfen und Datei erneut in die OCR-Warteschlange geben.',
    };
  }
  return {
    label: 'Unbekannt',
    tone: 'warning',
    recommendation: 'Datei erneut starten und Fehlerdetails im Audit prüfen.',
  };
}

function classifyErrorSeverity(entry: ErrorEntry): ErrorSeverity {
  const text = `${entry.reason} ${entry.recommendation ?? ''}`.toLowerCase();
  if (
    text.includes('beschädigt') ||
    text.includes('ungültig') ||
    text.includes('kritisch') ||
    text.includes('abgestürzt') ||
    text.includes('timeout') ||
    text.includes('zeitüberschreitung')
  ) {
    return 'critical';
  }
  if (
    text.includes('zu groß') ||
    text.includes('überschreitet') ||
    text.includes('nicht unterstützt') ||
    text.includes('abgelehnt')
  ) {
    return 'warning';
  }
  return 'info';
}

function severityLabel(severity: ErrorSeverity): string {
  if (severity === 'critical') return 'Kritisch';
  if (severity === 'warning') return 'Warnung';
  return 'Hinweis';
}

type UploadTelemetry = {
  queueDepth: number;
  queuedSelections: number;
  queuedFiles: number;
  chunkCount: number;
  lastChunkMs: number;
  peakChunkMs: number;
  lastThroughput: number;
  peakThroughput: number;
};

type UploadFlowStep = 'select' | 'review' | 'upload';

type Props = {
  onFilesReady: (files: UploadedFile[]) => void | Promise<void>;
  /** Called with StagedLegalFile refs when files are staged (not auto-submitted).
   *  The parent can store these to read file content lazily at commit time. */
  onStagedRefsReady?: (refs: StagedLegalFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  autoSubmitFolderSelection?: boolean;
  pipelineProgress?: {
    phaseLabel: string;
    progress: number;
    active: boolean;
    totalCount?: number;
    processedCount?: number;
    inFlightCount?: number;
    unaccountedCount?: number;
    indexedCount: number;
    ocrPendingCount: number;
    ocrRunningCount: number;
    failedCount: number;
  };
  pipelineFailures?: PipelineFailureItem[];
  onRetryFailedDocument?: (documentId: string) => Promise<boolean>;
  onRemoveFailedDocument?: (documentId: string) => Promise<boolean>;
  onRetryFailedBatch?: () => Promise<void>;
  onUploadTelemetryAlert?: (
    alert: UploadTelemetryAlert
  ) => void | Promise<void>;
};

const KIND_LABEL: Record<LegalDocumentKind, string> = {
  note: 'TXT',
  pdf: 'PDF',
  'scan-pdf': 'SCAN',
  email: 'MAIL',
  docx: 'DOCX',
  xlsx: 'XLSX',
  pptx: 'PPTX',
  other: 'FILE',
};

/* ═══════════════ Component ═══════════════ */

export const FileUploadZone = memo((props: Props) => {
  const {
    disabled,
    onFilesReady,
    onStagedRefsReady,
    pipelineProgress,
    pipelineFailures,
    autoSubmitFolderSelection = false,
  } = props;

  const t = useI18n();

  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<UploadedFile[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [folderLabel, setFolderLabel] = useState<string | null>(null);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({
    total: 0,
    processed: 0,
    accepted: 0,
    rejected: 0,
    skipped: 0,
    phase: 'idle',
  });
  const [liveStatus, setLiveStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isSelectionWindowOpen, setIsSelectionWindowOpen] = useState(false);
  const [selectionPage, setSelectionPage] = useState(0);
  const [showOnlySelectedInLargeWindow, setShowOnlySelectedInLargeWindow] =
    useState(false);
  const [largeSelectionQuery, setLargeSelectionQuery] = useState('');
  const [isResultWindowOpen, setIsResultWindowOpen] = useState(false);
  const [retryingFailedId, setRetryingFailedId] = useState<string | null>(null);
  const [removingFailedId, setRemovingFailedId] = useState<string | null>(null);
  const [isRetryBatchRunning, setIsRetryBatchRunning] = useState(false);
  const [telemetry, setTelemetry] = useState<UploadTelemetry>({
    queueDepth: 0,
    queuedSelections: 0,
    queuedFiles: 0,
    chunkCount: 0,
    lastChunkMs: 0,
    peakChunkMs: 0,
    lastThroughput: 0,
    peakThroughput: 0,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const pendingSelectionQueueRef = useRef<PendingSelection[]>([]);
  const maxFiles = props.maxFiles ?? DEFAULT_MAX_FILES;
  const locked = disabled || isBusy;
  const liveRegionId = useId();
  const dropzoneHintId = useId();
  const prepProgressLabelId = useId();
  const pipelineProgressLabelId = useId();
  const telemetryAlertSentAtRef = useRef<Record<string, number>>({});
  const pipelineWasActiveRef = useRef(false);
  const hasSeenPipelineRunRef = useRef(false);

  const emitTelemetryAlert = useCallback(
    (alert: UploadTelemetryAlert, throttleMs = 45_000) => {
      if (!props.onUploadTelemetryAlert) return;
      const now = Date.now();
      const last = telemetryAlertSentAtRef.current[alert.type] ?? 0;
      if (now - last < throttleMs) return;
      telemetryAlertSentAtRef.current[alert.type] = now;
      Promise.resolve(props.onUploadTelemetryAlert(alert)).catch(
        () => undefined
      );
    },
    [props]
  );

  // Staged files hold StagedLegalFile references (no content in memory)
  const stagedRefs = useRef<Map<string, StagedLegalFile>>(new Map());

  /* ── Core: INSTANT staging — no FileReader, no content, no freeze ── */
  const processFiles = useCallback(
    async (list: FileList | File[], opts?: { autoSubmit?: boolean }) => {
      if (disabled) return;

      if (processingRef.current) {
        const queuedFiles = Array.from(list);
        if (queuedFiles.length === 0) {
          return;
        }
        if (
          pendingSelectionQueueRef.current.length >= MAX_PENDING_SELECTION_QUEUE
        ) {
          setLiveStatus(
            t['com.affine.caseAssistant.uploadZone.status.queueFull']()
          );
          return;
        }
        pendingSelectionQueueRef.current.push({
          files: queuedFiles,
          autoSubmit: opts?.autoSubmit ?? false,
        });
        setTelemetry(prev => ({
          ...prev,
          queueDepth: pendingSelectionQueueRef.current.length,
          queuedSelections: prev.queuedSelections + 1,
          queuedFiles: prev.queuedFiles + queuedFiles.length,
        }));
        setLiveStatus(
          t.t('com.affine.caseAssistant.uploadZone.status.queuedSelection', {
            fileCount: queuedFiles.length,
            queueDepth: pendingSelectionQueueRef.current.length,
            queueMax: MAX_PENDING_SELECTION_QUEUE,
          })
        );
        if (pendingSelectionQueueRef.current.length >= 4) {
          emitTelemetryAlert({
            type: 'queue_spike',
            severity: 'warning',
            message: t.t(
              'com.affine.caseAssistant.uploadZone.telemetry.queueSpike',
              {
                queueDepth: pendingSelectionQueueRef.current.length,
                queueMax: MAX_PENDING_SELECTION_QUEUE,
              }
            ),
            metrics: {
              queueDepth: pendingSelectionQueueRef.current.length,
              queuedFiles: queuedFiles.length,
              mode: opts?.autoSubmit ? 'auto_submit' : 'staged',
            },
          });
        }
        return;
      }

      processingRef.current = true;
      setIsBusy(true);
      setErrors([]);
      setFatalError(null);
      setTelemetry(prev => ({
        ...prev,
        queueDepth: pendingSelectionQueueRef.current.length,
        chunkCount: 0,
        lastChunkMs: 0,
        lastThroughput: 0,
      }));

      try {
        const all = Array.from(list);
        const folder0 = all.find(f => f.webkitRelativePath?.trim());
        if (folder0?.webkitRelativePath) {
          setFolderLabel(
            folder0.webkitRelativePath.split('/')[0]?.trim() || 'Ordner'
          );
        }

        const cap = Number.isFinite(maxFiles);
        const overflow = cap ? Math.max(0, all.length - maxFiles) : 0;
        const files = cap ? all.slice(0, maxFiles) : all;
        if (!files.length) {
          setLiveStatus(
            t['com.affine.caseAssistant.uploadZone.status.noFiles']()
          );
          return;
        }

        setProgress({
          total: files.length,
          processed: 0,
          accepted: 0,
          rejected: 0,
          skipped: 0,
          phase: 'preparing',
        });

        // INSTANT staging — O(1) per file, no FileReader
        const result = stageLegalUploadFiles({
          files,
          maxFiles,
          extractFolder,
        });

        const collectedErrors: ErrorEntry[] = [];
        for (const r of result.rejected) {
          collectedErrors.push({
            name: r.fileName,
            reason: r.reason,
            recommendation: r.recommendation,
          });
        }

        // Deduplicate against already staged files
        const seen = new Set(stagedFiles.map(toKey));
        let dupes = 0;
        const accepted: UploadedFile[] = [];
        for (const staged of result.staged) {
          const placeholder: UploadedFile = {
            name: staged.name,
            size: staged.size,
            kind: staged.kind,
            content: '', // NO content in state — read lazily at commit
            mimeType: staged.mimeType,
            lastModifiedAt: staged.lastModifiedAt,
            pageCount: staged.pageCount,
            folderPath: staged.folderPath,
          };
          const k = toKey(placeholder);
          if (seen.has(k)) {
            dupes++;
            continue;
          }
          seen.add(k);
          accepted.push(placeholder);
          stagedRefs.current.set(k, staged); // Keep File reference for lazy read
        }

        const ok = accepted.length;
        const bad = result.rejected.length;

        if (opts?.autoSubmit && ok > 0) {
          // For auto-submit (folder upload), read content now in streaming batches
          setProgress({
            total: files.length,
            processed: 0,
            accepted: 0,
            rejected: bad,
            skipped: 0,
            phase: 'preparing',
          });
          const existingKeys = new Set(stagedFiles.map(toKey));
          const stagedToRead = result.staged.filter(s => {
            const k = toKey({
              name: s.name,
              size: s.size,
              lastModifiedAt: s.lastModifiedAt,
              folderPath: s.folderPath,
            });
            return !existingKeys.has(k);
          });
          const stagedFolderByPreparedKey = new Map<
            string,
            string | undefined
          >();
          for (const s of stagedToRead) {
            stagedFolderByPreparedKey.set(toStagedPreparedKey(s), s.folderPath);
          }
          const adaptiveReadBatch = pickAdaptiveReadBatch(stagedToRead);
          const startedAt = Date.now();
          let readOk = 0;
          for await (const batch of readStagedFilesStreaming(
            stagedToRead,
            adaptiveReadBatch
          )) {
            const chunkStartedAt = performance.now();
            if (batch.prepared.length > 0) {
              const withFolders = batch.prepared.map(p => ({
                ...p,
                folderPath: stagedFolderByPreparedKey.get(toPreparedKey(p)),
              }));
              await onFilesReady(withFolders);
              readOk += batch.prepared.length;
            }
            const chunkMs = Math.max(0.1, performance.now() - chunkStartedAt);
            if (chunkMs > 3000) {
              emitTelemetryAlert(
                {
                  type: 'slow_chunk',
                  severity: 'info',
                  message: `Langsame Upload-Vorbereitung erkannt (${chunkMs.toFixed(0)}ms).`,
                  metrics: {
                    chunkMs: chunkMs.toFixed(0),
                    processed: batch.processedSoFar,
                    total: batch.totalFiles,
                  },
                },
                20_000
              );
            }
            for (const r of batch.rejected) {
              collectedErrors.push({
                name: r.fileName,
                reason: r.reason,
                recommendation: r.recommendation,
              });
            }
            setProgress(p => ({
              ...p,
              processed: batch.processedSoFar,
              accepted: readOk,
            }));
            const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
            const throughput = batch.processedSoFar / elapsedSec;
            setTelemetry(prev => ({
              ...prev,
              chunkCount: prev.chunkCount + 1,
              lastChunkMs: chunkMs,
              peakChunkMs: Math.max(prev.peakChunkMs, chunkMs),
              lastThroughput: throughput,
              peakThroughput: Math.max(prev.peakThroughput, throughput),
            }));
            const remaining = Math.max(
              0,
              batch.totalFiles - batch.processedSoFar
            );
            const etaSec = remaining / Math.max(0.1, throughput);
            setLiveStatus(
              t.t('com.affine.caseAssistant.uploadZone.status.eta', {
                processed: batch.processedSoFar,
                total: batch.totalFiles,
                throughput: throughput.toFixed(1),
                eta: formatEta(etaSec),
              })
            );
          }
          setProgress(p => ({
            ...p,
            processed: files.length,
            accepted: readOk,
            phase: 'complete',
          }));
          setLiveStatus(
            t.t('com.affine.caseAssistant.uploadZone.status.handedToPipeline', {
              count: readOk,
            })
          );
        } else if (ok > 0) {
          setStagedFiles(prev => {
            const next = [...prev, ...accepted];
            setSelectedKeys(sel => {
              const merged = new Set(sel);
              for (const f of accepted) merged.add(toKey(f));
              return merged;
            });
            return next;
          });
          // Notify parent of StagedLegalFile refs for lazy reading at commit time
          if (onStagedRefsReady) {
            const newRefs = result.staged.filter(s => {
              const k = toKey({
                name: s.name,
                size: s.size,
                lastModifiedAt: s.lastModifiedAt,
                folderPath: s.folderPath,
              });
              return accepted.some(a => toKey(a) === k);
            });
            onStagedRefsReady(newRefs);
          }
          setProgress({
            total: files.length,
            processed: files.length,
            accepted: ok,
            rejected: bad + overflow,
            skipped: dupes + overflow,
            phase: 'complete',
          });
          setLiveStatus(
            ok > 0
              ? t.t('com.affine.caseAssistant.uploadZone.status.readyCount', {
                  count: ok,
                })
              : t[
                  'com.affine.caseAssistant.uploadZone.status.noSupportedFiles'
                ]()
          );
        } else {
          setProgress({
            total: files.length,
            processed: files.length,
            accepted: 0,
            rejected: bad + overflow,
            skipped: dupes + overflow,
            phase: 'complete',
          });
          setLiveStatus(
            t['com.affine.caseAssistant.uploadZone.status.noSupportedFiles']()
          );
        }

        setErrors(collectedErrors.slice(0, MAX_ERROR_DISPLAY));
      } catch (error) {
        const message = toUserFacingError(
          error,
          t['com.affine.caseAssistant.uploadZone.error.readFailed']()
        );
        setLiveStatus(message);
        setFatalError(message);
        setErrors([{ name: 'Upload', reason: message }]);
        setProgress(p => ({ ...p, phase: 'error' }));
      } finally {
        processingRef.current = false;
        setIsBusy(false);
        const nextSelection = pendingSelectionQueueRef.current.shift();
        if (nextSelection) {
          window.setTimeout(() => {
            void processFiles(nextSelection.files, {
              autoSubmit: nextSelection.autoSubmit,
            }).catch(() => {});
          }, 0);
          setTelemetry(prev => ({
            ...prev,
            queueDepth: pendingSelectionQueueRef.current.length,
          }));
        } else {
          setTelemetry(prev => ({
            ...prev,
            queueDepth: 0,
          }));
        }
      }
    },
    [disabled, maxFiles, onFilesReady, onStagedRefsReady, stagedFiles]
  );

  /* ── Handlers ── */
  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (!locked && e.dataTransfer.files.length)
        processFiles(e.dataTransfer.files).catch(() => {});
    },
    [locked, processFiles]
  );

  const onInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (locked) {
        e.target.value = '';
        return;
      }
      if (e.target.files?.length) {
        const isFolder = e.target === folderRef.current;
        processFiles(e.target.files, {
          autoSubmit: isFolder && autoSubmitFolderSelection,
        }).catch(() => {});
      }
      e.target.value = '';
    },
    [autoSubmitFolderSelection, locked, processFiles]
  );

  const onClickZone = useCallback(() => {
    if (!locked) fileRef.current?.click();
  }, [locked]);
  const onPickFolder = useCallback(() => {
    if (!locked) folderRef.current?.click();
  }, [locked]);
  const onPickFiles = useCallback(() => {
    if (!locked) fileRef.current?.click();
  }, [locked]);

  const onRemove = useCallback(
    (k: string) => {
      if (isBusy) return;
      setStagedFiles(prev => prev.filter(f => toKey(f) !== k));
      stagedRefs.current.delete(k);
      setSelectedKeys(prev => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    },
    [isBusy]
  );

  const onToggleSelected = useCallback(
    (k: string) => {
      if (isBusy) return;
      setSelectedKeys(prev => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });
    },
    [isBusy]
  );

  const onSelectAll = useCallback(() => {
    if (isBusy) return;
    setSelectedKeys(new Set(stagedFiles.map(toKey)));
  }, [isBusy, stagedFiles]);

  const onSelectNone = useCallback(() => {
    if (isBusy) return;
    setSelectedKeys(new Set());
  }, [isBusy]);

  const onInvertSelection = useCallback(() => {
    if (isBusy) return;
    setSelectedKeys(prev => {
      const next = new Set<string>();
      for (const file of stagedFiles) {
        const k = toKey(file);
        if (!prev.has(k)) {
          next.add(k);
        }
      }
      return next;
    });
  }, [isBusy, stagedFiles]);

  const onRemoveSelected = useCallback(() => {
    if (isBusy) return;
    setStagedFiles(prev => prev.filter(f => !selectedKeys.has(toKey(f))));
    for (const key of selectedKeys) {
      stagedRefs.current.delete(key);
    }
    setSelectedKeys(new Set());
  }, [isBusy, selectedKeys]);

  const onConfirm = useCallback(
    async (forcedSelection?: UploadedFile[]) => {
      if (!stagedFiles.length || isBusy) return;
      const selected =
        forcedSelection ?? stagedFiles.filter(f => selectedKeys.has(toKey(f)));
      if (selected.length === 0) {
        setLiveStatus(
          t['com.affine.caseAssistant.uploadZone.status.noneSelected']()
        );
        return;
      }
      setIsBusy(true);
      setFatalError(null);
      setProgress({
        total: selected.length,
        processed: 0,
        accepted: 0,
        rejected: 0,
        skipped: 0,
        phase: 'preparing',
      });
      try {
        // Collect StagedLegalFile refs for selected files
        const refsToRead: StagedLegalFile[] = [];
        for (const f of selected) {
          const k = toKey(f);
          const ref = stagedRefs.current.get(k);
          if (ref) {
            refsToRead.push(ref);
          }
        }
        const directReady = selected.filter(
          file =>
            !stagedRefs.current.get(toKey(file)) &&
            file.content.trim().length > 0
        );
        const uploadedKeys: string[] = [];

        const pushUploaded = async (chunk: UploadedFile[]) => {
          await onFilesReady(chunk);
          for (const file of chunk) {
            uploadedKeys.push(toKey(file));
          }
        };

        if (refsToRead.length === 0) {
          // Fallback: files already have content (e.g. small batch from legacy path)
          const source = directReady.length > 0 ? directReady : selected;
          const directPipelineBatch = pickAdaptivePipelineBatch(source);
          let uploadedDirectCount = 0;
          const directStartedAt = Date.now();
          for (let i = 0; i < source.length; i += directPipelineBatch) {
            const chunkStartedAt = performance.now();
            const chunk = source.slice(i, i + directPipelineBatch);
            await pushUploaded(chunk);
            const chunkMs = Math.max(0.1, performance.now() - chunkStartedAt);
            if (chunkMs > 3000) {
              emitTelemetryAlert(
                {
                  type: 'slow_chunk',
                  severity: 'info',
                  message: `Langsame Upload-Chunkverarbeitung erkannt (${chunkMs.toFixed(0)}ms).`,
                  metrics: {
                    chunkMs: chunkMs.toFixed(0),
                    processed: Math.min(
                      selected.length,
                      uploadedDirectCount + chunk.length
                    ),
                    total: selected.length,
                  },
                },
                20_000
              );
            }
            uploadedDirectCount += chunk.length;
            const processedSoFar = Math.min(
              selected.length,
              uploadedDirectCount
            );
            const elapsedSec = Math.max(
              0.001,
              (Date.now() - directStartedAt) / 1000
            );
            const throughput = processedSoFar / elapsedSec;
            setTelemetry(prev => ({
              ...prev,
              chunkCount: prev.chunkCount + 1,
              lastChunkMs: chunkMs,
              peakChunkMs: Math.max(prev.peakChunkMs, chunkMs),
              lastThroughput: throughput,
              peakThroughput: Math.max(prev.peakThroughput, throughput),
            }));
            setProgress(p => ({
              ...p,
              processed: Math.min(selected.length, uploadedDirectCount),
              accepted: uploadedDirectCount,
            }));
          }
          const uploadedSet = new Set(uploadedKeys);
          setStagedFiles(prev => prev.filter(f => !uploadedSet.has(toKey(f))));
          setSelectedKeys(prev => {
            const next = new Set(prev);
            for (const k of uploadedSet) next.delete(k);
            return next;
          });
          for (const key of uploadedSet) {
            stagedRefs.current.delete(key);
          }
          setLiveStatus(
            t.t('com.affine.caseAssistant.uploadZone.status.handedOff', {
              count: uploadedDirectCount,
            })
          );
          setProgress(p => ({
            ...p,
            processed: selected.length,
            accepted: uploadedDirectCount,
            phase: 'complete',
          }));
          return;
        }

        // Read file content in streaming batches and send to pipeline
        let totalOk = 0;
        let totalBad = 0;
        const pipelineBatch: UploadedFile[] = [];
        const refByPreparedKey = new Map<string, StagedLegalFile>();
        for (const ref of refsToRead) {
          refByPreparedKey.set(toStagedPreparedKey(ref), ref);
        }
        const adaptiveReadBatch = pickAdaptiveReadBatch(refsToRead);
        const adaptivePipelineBatch = pickAdaptivePipelineBatch(refsToRead);
        const startedAt = Date.now();

        for await (const batch of readStagedFilesStreaming(
          refsToRead,
          adaptiveReadBatch
        )) {
          const chunkStartedAt = performance.now();
          for (const p of batch.prepared) {
            const matchedRef = refByPreparedKey.get(toPreparedKey(p));
            pipelineBatch.push({
              ...p,
              folderPath: matchedRef?.folderPath,
            });
          }
          totalBad += batch.rejected.length;

          // Send to pipeline in adaptive chunks
          while (pipelineBatch.length >= adaptivePipelineBatch) {
            const chunk = pipelineBatch.splice(0, adaptivePipelineBatch);
            await pushUploaded(chunk);
            totalOk += chunk.length;
          }
          const chunkMs = Math.max(0.1, performance.now() - chunkStartedAt);
          if (chunkMs > 3000) {
            emitTelemetryAlert(
              {
                type: 'slow_chunk',
                severity: 'info',
                message: `Langsame Upload-Chunkverarbeitung erkannt (${chunkMs.toFixed(0)}ms).`,
                metrics: {
                  chunkMs: chunkMs.toFixed(0),
                  processed: batch.processedSoFar,
                  total: batch.totalFiles,
                },
              },
              20_000
            );
          }

          setProgress(p => ({
            ...p,
            processed: batch.processedSoFar,
            accepted: totalOk + pipelineBatch.length,
            rejected: totalBad,
          }));
          const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
          const throughput = batch.processedSoFar / elapsedSec;
          setTelemetry(prev => ({
            ...prev,
            chunkCount: prev.chunkCount + 1,
            lastChunkMs: chunkMs,
            peakChunkMs: Math.max(prev.peakChunkMs, chunkMs),
            lastThroughput: throughput,
            peakThroughput: Math.max(prev.peakThroughput, throughput),
          }));
          const remaining = Math.max(
            0,
            batch.totalFiles - batch.processedSoFar
          );
          const etaSec = remaining / Math.max(0.1, throughput);
          setLiveStatus(
            t.t('com.affine.caseAssistant.uploadZone.status.readingEta', {
              processed: batch.processedSoFar,
              total: batch.totalFiles,
              throughput: throughput.toFixed(1),
              eta: formatEta(etaSec),
            })
          );
        }

        // Flush remaining pipeline batch
        if (pipelineBatch.length > 0) {
          await pushUploaded(pipelineBatch);
          totalOk += pipelineBatch.length;
        }

        // Edge case: mixed selection with direct-ready files (no refs)
        if (directReady.length > 0) {
          const directPipelineBatch = pickAdaptivePipelineBatch(directReady);
          for (let i = 0; i < directReady.length; i += directPipelineBatch) {
            const chunk = directReady.slice(i, i + directPipelineBatch);
            await pushUploaded(chunk);
            totalOk += chunk.length;
          }
        }

        const uploadedSet = new Set(uploadedKeys);

        // Clean up staged refs
        for (const k of uploadedSet) {
          stagedRefs.current.delete(k);
        }

        setStagedFiles(prev => prev.filter(f => !uploadedSet.has(toKey(f))));
        setSelectedKeys(prev => {
          const next = new Set(prev);
          for (const k of uploadedSet) next.delete(k);
          return next;
        });
        setProgress(p => ({
          ...p,
          processed: selected.length,
          accepted: totalOk,
          rejected: totalBad,
          phase: 'complete',
        }));
        setLiveStatus(
          t.t('com.affine.caseAssistant.uploadZone.status.handedOff', {
            count: totalOk,
          })
        );
      } catch (error) {
        const message = toUserFacingError(
          error,
          t['com.affine.caseAssistant.uploadZone.error.handoffFailed']()
        );
        setLiveStatus(message);
        setFatalError(message);
        setErrors([{ name: 'Upload', reason: message }]);
        setProgress(p => ({ ...p, phase: 'error' }));
      } finally {
        setIsBusy(false);
      }
    },
    [stagedFiles, selectedKeys, isBusy, onFilesReady, emitTelemetryAlert]
  );

  const failedErrorEntries = useMemo(
    () => errors.filter(item => item.name !== 'Upload'),
    [errors]
  );
  const failedNameSet = useMemo(
    () => new Set(failedErrorEntries.map(item => item.name)),
    [failedErrorEntries]
  );
  const failedSelection = useMemo(
    () => stagedFiles.filter(file => failedNameSet.has(file.name)),
    [failedNameSet, stagedFiles]
  );
  const onRetryFailedOnly = useCallback(async () => {
    if (isBusy) return;
    if (failedSelection.length === 0) {
      setLiveStatus(
        t['com.affine.caseAssistant.uploadZone.status.noFailedToRetry']()
      );
      return;
    }
    await onConfirm(failedSelection);
  }, [failedSelection, isBusy, onConfirm]);

  const onClear = useCallback(() => {
    if (isBusy) return;
    setStagedFiles([]);
    setFolderLabel(null);
    setErrors([]);
    setSelectedKeys(new Set());
    setIsSelectionWindowOpen(false);
    setSelectionPage(0);
    setShowOnlySelectedInLargeWindow(false);
    setLargeSelectionQuery('');
    setProgress({
      total: 0,
      processed: 0,
      accepted: 0,
      rejected: 0,
      skipped: 0,
      phase: 'idle',
    });
    setLiveStatus('');
    setFatalError(null);
    stagedRefs.current.clear();
  }, [isBusy]);

  const onToggleSelectionWindow = useCallback(() => {
    if (isBusy) return;
    setIsSelectionWindowOpen(prev => !prev);
    setSelectionPage(0);
  }, [isBusy]);

  const onSelectionPagePrev = useCallback(() => {
    setSelectionPage(prev => Math.max(0, prev - 1));
  }, []);

  const onSelectionPageNext = useCallback((pageCount: number) => {
    setSelectionPage(prev => Math.min(pageCount - 1, prev + 1));
  }, []);

  const onToggleShowOnlySelected = useCallback(() => {
    if (isBusy) return;
    setSelectionPage(0);
    setShowOnlySelectedInLargeWindow(prev => !prev);
  }, [isBusy]);

  const onLargeSelectionQueryChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSelectionPage(0);
      setLargeSelectionQuery(e.target.value);
    },
    []
  );

  /* ── Derived ── */
  const pct =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;
  const isActive = progress.phase === 'preparing';
  const isDone = progress.phase === 'complete';
  const totalBytes = useMemo(
    () => stagedFiles.reduce((s, f) => s + f.size, 0),
    [stagedFiles]
  );
  const scanCount = useMemo(
    () => stagedFiles.filter(f => f.kind === 'scan-pdf').length,
    [stagedFiles]
  );
  const renderFiles = useMemo(
    () => stagedFiles.slice(0, MAX_STAGED_RENDER),
    [stagedFiles]
  );
  const isLargeSelectionMode = stagedFiles.length > MAX_STAGED_RENDER;
  const largeSelectionBaseSource = useMemo(
    () =>
      showOnlySelectedInLargeWindow
        ? stagedFiles.filter(file => selectedKeys.has(toKey(file)))
        : stagedFiles,
    [showOnlySelectedInLargeWindow, stagedFiles, selectedKeys]
  );
  const normalizedLargeSelectionQuery = largeSelectionQuery
    .trim()
    .toLowerCase();
  const largeSelectionSource = useMemo(() => {
    if (!normalizedLargeSelectionQuery) {
      return largeSelectionBaseSource;
    }
    return largeSelectionBaseSource.filter(file =>
      file.name.toLowerCase().includes(normalizedLargeSelectionQuery)
    );
  }, [largeSelectionBaseSource, normalizedLargeSelectionQuery]);
  const selectionPageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(largeSelectionSource.length / LARGE_SELECTION_PAGE_SIZE)
      ),
    [largeSelectionSource.length]
  );
  const activeSelectionPage = Math.min(selectionPage, selectionPageCount - 1);
  const largeSelectionFiles = useMemo(() => {
    if (!isLargeSelectionMode) {
      return [] as UploadedFile[];
    }
    const start = activeSelectionPage * LARGE_SELECTION_PAGE_SIZE;
    return largeSelectionSource.slice(start, start + LARGE_SELECTION_PAGE_SIZE);
  }, [activeSelectionPage, isLargeSelectionMode, largeSelectionSource]);
  const selectedCount = useMemo(() => {
    if (stagedFiles.length === 0) return 0;
    let count = 0;
    for (const f of stagedFiles) {
      if (selectedKeys.has(toKey(f))) count++;
    }
    return count;
  }, [selectedKeys, stagedFiles]);

  const flowStep: UploadFlowStep = useMemo(() => {
    if (isBusy || isActive) return 'upload';
    if (stagedFiles.length > 0) return 'review';
    return 'select';
  }, [isActive, isBusy, stagedFiles.length]);

  const activeFlowStep = useMemo(() => {
    switch (flowStep) {
      case 'review':
        return {
          index: 2,
          label: t['com.affine.caseAssistant.uploadZone.flow.label.review'](),
        };
      case 'upload':
        return {
          index: 3,
          label: t['com.affine.caseAssistant.uploadZone.flow.label.upload'](),
        };
      default:
        return {
          index: 1,
          label: t['com.affine.caseAssistant.uploadZone.flow.label.select'](),
        };
    }
  }, [flowStep, t]);

  const shouldShowPreparationCard = progress.total > 0 && flowStep === 'upload';

  const shouldShowPipelineCard = useMemo(() => {
    if (!pipelineProgress) return false;
    const hasPersistedPipelineState =
      (pipelineProgress.totalCount ?? 0) > 0 ||
      pipelineProgress.indexedCount > 0 ||
      pipelineProgress.ocrPendingCount > 0 ||
      pipelineProgress.ocrRunningCount > 0 ||
      pipelineProgress.failedCount > 0;
    return pipelineProgress.active || hasPersistedPipelineState;
  }, [pipelineProgress]);

  const shouldShowTechnicalMetrics = useMemo(() => {
    return (
      telemetry.queueDepth > 0 ||
      telemetry.chunkCount > 0 ||
      telemetry.lastChunkMs > 0 ||
      telemetry.lastThroughput > 0
    );
  }, [telemetry]);

  const pipelineFailureItems = useMemo(
    () => pipelineFailures ?? [],
    [pipelineFailures]
  );

  useEffect(() => {
    const active = pipelineProgress?.active ?? false;
    if (active) {
      hasSeenPipelineRunRef.current = true;
      pipelineWasActiveRef.current = true;
      return;
    }

    if (!pipelineWasActiveRef.current || !hasSeenPipelineRunRef.current) {
      pipelineWasActiveRef.current = false;
      return;
    }

    const hasTerminalSnapshot =
      (pipelineProgress?.processedCount ?? 0) > 0 ||
      (pipelineProgress?.failedCount ?? 0) > 0 ||
      (pipelineProgress?.indexedCount ?? 0) > 0;
    if (hasTerminalSnapshot) {
      setIsResultWindowOpen(true);
    }
    pipelineWasActiveRef.current = false;
  }, [pipelineProgress]);

  const onRetryFailedItem = useCallback(
    async (documentId: string) => {
      if (isBusy || !props.onRetryFailedDocument) return;
      setRetryingFailedId(documentId);
      try {
        const ok = await props.onRetryFailedDocument(documentId);
        setLiveStatus(
          ok
            ? 'Dokument wurde erfolgreich erneut verarbeitet.'
            : 'Dokument konnte nicht erneut verarbeitet werden.'
        );
      } catch {
        setLiveStatus(
          'Retry konnte nicht ausgeführt werden. Bitte erneut versuchen.'
        );
      } finally {
        setRetryingFailedId(null);
      }
    },
    [isBusy, props]
  );

  const onRemoveFailedItem = useCallback(
    async (documentId: string) => {
      if (isBusy || !props.onRemoveFailedDocument) return;
      setRemovingFailedId(documentId);
      try {
        const ok = await props.onRemoveFailedDocument(documentId);
        setLiveStatus(
          ok
            ? 'Fehlgeschlagenes Dokument wurde entfernt.'
            : 'Dokument konnte nicht entfernt werden.'
        );
      } catch {
        setLiveStatus(
          'Entfernen konnte nicht ausgeführt werden. Bitte erneut versuchen.'
        );
      } finally {
        setRemovingFailedId(null);
      }
    },
    [isBusy, props]
  );

  const onRetryBatch = useCallback(async () => {
    if (isBusy || isRetryBatchRunning) return;
    setIsRetryBatchRunning(true);
    try {
      if (props.onRetryFailedBatch) {
        await props.onRetryFailedBatch();
      } else if (
        props.onRetryFailedDocument &&
        pipelineFailureItems.length > 0
      ) {
        for (const item of pipelineFailureItems) {
          await props.onRetryFailedDocument(item.documentId);
        }
      }
      setLiveStatus('Retry für fehlgeschlagene Dokumente gestartet.');
    } catch {
      setLiveStatus('Batch-Retry konnte nicht gestartet werden.');
    } finally {
      setIsRetryBatchRunning(false);
    }
  }, [isBusy, isRetryBatchRunning, pipelineFailureItems, props]);

  /* ── Render ── */
  return (
    <div className={s.root} aria-busy={isBusy}>
      <div
        id={liveRegionId}
        aria-live="polite"
        aria-atomic="true"
        className={s.srOnly}
      >
        {liveStatus}
      </div>

      {flowStep === 'upload' ? (
        <>
          {shouldShowPreparationCard ? (
            <div
              className={`${s.glassCard} ${isActive ? s.glassCardLive : ''}`}
              role="status"
              aria-live="polite"
            >
              <div className={s.cardHeader}>
                <span id={prepProgressLabelId} className={s.cardTitle}>
                  {isActive && <span className={s.liveDot} />}
                  {folderLabel
                    ? `${folderLabel}`
                    : t[
                        'com.affine.caseAssistant.uploadZone.status.preparation'
                      ]()}
                </span>
                <span className={s.cardPercent}>{pct}%</span>
              </div>

              <div
                className={s.progressTrack}
                role="progressbar"
                aria-labelledby={prepProgressLabelId}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div
                  className={`${s.progressFill} ${isActive ? s.progressFillShimmer : ''}`}
                  style={assignInlineVars({
                    [s.widthVar]: `${pct}%`,
                    [s.accentColorVar]: cssVarV2('button/primary'),
                  })}
                />
              </div>

              <div className={s.chipRow}>
                <span
                  className={`${s.chip} ${progress.accepted > 0 ? s.chipSuccess : ''}`}
                >
                  {progress.accepted}{' '}
                  {t['com.affine.caseAssistant.uploadZone.status.ready']()}
                </span>
                <span className={s.chip}>
                  {progress.processed}/{progress.total}
                </span>
                {progress.rejected > 0 && (
                  <span className={`${s.chip} ${s.chipError}`}>
                    {progress.rejected}{' '}
                    {t['com.affine.caseAssistant.uploadZone.status.rejected']()}
                  </span>
                )}
                {progress.skipped > 0 && (
                  <span className={s.chip}>
                    {progress.skipped}{' '}
                    {t['com.affine.caseAssistant.uploadZone.status.skipped']()}
                  </span>
                )}
              </div>

              {isDone && (
                <div className={s.cardMeta}>
                  {progress.accepted > 0
                    ? t.t('com.affine.caseAssistant.uploadZone.status.done', {
                        count: progress.accepted,
                      })
                    : t[
                        'com.affine.caseAssistant.uploadZone.status.noSupportedFiles'
                      ]()}
                </div>
              )}
            </div>
          ) : null}

          {shouldShowPipelineCard && pipelineProgress ? (
            <div
              className={`${s.glassCard} ${pipelineProgress.active ? s.glassCardLive : ''}`}
              role="status"
              aria-live="polite"
            >
              <div className={s.cardHeader}>
                <span id={pipelineProgressLabelId} className={s.cardTitle}>
                  {pipelineProgress.active && <span className={s.liveDot} />}
                  Pipeline: {pipelineProgress.phaseLabel}
                </span>
                <span className={s.cardPercent}>
                  {pipelineProgress.progress}%
                </span>
              </div>
              <div
                className={s.progressTrack}
                role="progressbar"
                aria-labelledby={pipelineProgressLabelId}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.max(
                  0,
                  Math.min(100, pipelineProgress.progress)
                )}
              >
                <div
                  className={`${s.progressFill} ${pipelineProgress.active ? s.progressFillShimmer : ''}`}
                  style={assignInlineVars({
                    [s.widthVar]: `${pipelineProgress.progress}%`,
                    [s.accentColorVar]: pipelineProgress.active
                      ? cssVarV2('button/primary')
                      : cssVarV2('text/secondary'),
                  })}
                />
              </div>
              <div className={s.chipRow}>
                {typeof pipelineProgress.totalCount === 'number' &&
                pipelineProgress.totalCount > 0 ? (
                  <span className={s.chip}>
                    {pipelineProgress.processedCount ??
                      pipelineProgress.indexedCount +
                        pipelineProgress.failedCount}
                    /{pipelineProgress.totalCount} verarbeitet
                  </span>
                ) : null}
                <span className={`${s.chip} ${s.chipSuccess}`}>
                  {pipelineProgress.indexedCount} indexiert
                </span>
                <span className={s.chip}>
                  {pipelineProgress.ocrRunningCount} OCR
                </span>
                <span className={s.chip}>
                  {pipelineProgress.ocrPendingCount} ausstehend
                </span>
                {pipelineProgress.failedCount > 0 && (
                  <span className={`${s.chip} ${s.chipError}`}>
                    {pipelineProgress.failedCount} fehlgeschlagen
                  </span>
                )}
                {(pipelineProgress.inFlightCount ?? 0) > 0 && (
                  <span className={s.chip}>
                    {pipelineProgress.inFlightCount} in Arbeit
                  </span>
                )}
                {(pipelineProgress.unaccountedCount ?? 0) > 0 && (
                  <span className={`${s.chip} ${s.chipError}`}>
                    {pipelineProgress.unaccountedCount} unklar
                  </span>
                )}
              </div>
              {pipelineProgress.failedCount > 0 ? (
                <div className={s.cardMeta}>
                  {pipelineProgress.failedCount} Datei(en) konnten nicht
                  eingelesen werden und sind als "fehlgeschlagen" markiert.
                </div>
              ) : null}
            </div>
          ) : null}

          {errors.length > 0 ? (
            <div className={s.errorBox} role="alert" aria-live="assertive">
              {fatalError ? <div>{fatalError}</div> : null}
              {errors.map((e, i) => (
                <div key={i} className={s.errorEntry}>
                  <div className={s.errorHeader}>
                    <span
                      className={
                        classifyErrorSeverity(e) === 'critical'
                          ? `${s.errorSeverityChip} ${s.errorSeverityCritical}`
                          : classifyErrorSeverity(e) === 'warning'
                            ? `${s.errorSeverityChip} ${s.errorSeverityWarning}`
                            : `${s.errorSeverityChip} ${s.errorSeverityInfo}`
                      }
                    >
                      {severityLabel(classifyErrorSeverity(e))}
                    </span>
                    <span>{e.name}</span>
                  </div>
                  <div>{e.reason}</div>
                  {e.recommendation ? <div>{e.recommendation}</div> : null}
                </div>
              ))}
              {progress.rejected > MAX_ERROR_DISPLAY && (
                <div>… und {progress.rejected - MAX_ERROR_DISPLAY} weitere</div>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {flowStep !== 'upload' ? (
        <div
          className={`${s.selectionPanel} ${stagedFiles.length > 0 ? s.selectionPanelCollapsed : ''}`}
          aria-hidden={stagedFiles.length > 0}
        >
          <div
            className={s.flowGuide}
            aria-label={t['com.affine.caseAssistant.uploadZone.aria.flow']()}
          >
            <div className={s.flowStep} data-active="true">
              <span className={s.flowStepIndex}>{activeFlowStep.index}</span>
              <span>
                {t.t('com.affine.caseAssistant.uploadZone.flow.step', {
                  current: activeFlowStep.index,
                  label: activeFlowStep.label,
                })}
              </span>
            </div>
          </div>

          {/* ─── Drop Zone ─── */}
          <div
            role="button"
            tabIndex={locked || stagedFiles.length > 0 ? -1 : 0}
            aria-label={
              isBusy
                ? t['com.affine.caseAssistant.uploadZone.status.processing']()
                : t['com.affine.caseAssistant.uploadZone.aria.drop']()
            }
            aria-describedby={`${liveRegionId} ${dropzoneHintId}`}
            aria-disabled={locked || stagedFiles.length > 0}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onClickZone}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClickZone();
              }
            }}
            className={[
              s.dropZone,
              isDragOver && s.dropZoneActive,
              stagedFiles.length > 0 && s.dropZoneCompact,
            ]
              .filter(Boolean)
              .join(' ')}
            style={assignInlineVars({
              [s.opacityVar]: locked ? '0.5' : '1',
            })}
          >
            {isBusy ? (
              <div className={s.compactHint} role="status">
                {t['com.affine.caseAssistant.uploadZone.status.processing']()}
              </div>
            ) : stagedFiles.length === 0 ? (
              <>
                <div className={s.heroIcon} aria-hidden="true">
                  {isDragOver ? '↓' : '↑'}
                </div>
                <div className={s.heroTitle}>
                  {isDragOver
                    ? t[
                        'com.affine.caseAssistant.uploadZone.dropzone.dropHere'
                      ]()
                    : t['com.affine.caseAssistant.uploadZone.dropzone.title']()}
                </div>
                <div id={dropzoneHintId} className={s.heroHint}>
                  {t['com.affine.caseAssistant.uploadZone.dropzone.hint']()}
                </div>
              </>
            ) : (
              <div id={dropzoneHintId} className={s.compactHint}>
                {t['com.affine.caseAssistant.uploadZone.dropzone.more']()}
              </div>
            )}
          </div>

          {/* ─── Action Buttons ─── */}
          <div className={s.actionRow}>
            <Button
              variant="primary"
              disabled={locked}
              onClick={onPickFolder}
              className={s.primaryAction}
              aria-label={t[
                'com.affine.caseAssistant.uploadZone.button.pickFolder'
              ]()}
            >
              {t['com.affine.caseAssistant.uploadZone.button.pickFolder']()}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ─── Hidden Inputs ─── */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={LEGAL_UPLOAD_ACCEPT_ATTR}
        className={s.hiddenInput}
        onChange={onInput}
        aria-hidden="true"
      />
      <input
        ref={node => {
          folderRef.current = node;
          if (node) {
            node.setAttribute('webkitdirectory', '');
            node.setAttribute('directory', '');
          }
        }}
        type="file"
        multiple
        className={s.hiddenInput}
        onChange={onInput}
        aria-hidden="true"
      />

      {/* ─── Progress Card ─── */}
      {shouldShowPreparationCard && flowStep !== 'upload' ? (
        <div
          className={`${s.glassCard} ${isActive ? s.glassCardLive : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className={s.cardHeader}>
            <span id={prepProgressLabelId} className={s.cardTitle}>
              {isActive && <span className={s.liveDot} />}
              {folderLabel
                ? `${folderLabel}`
                : t['com.affine.caseAssistant.uploadZone.status.preparation']()}
            </span>
            <span className={s.cardPercent}>{pct}%</span>
          </div>

          <div
            className={s.progressTrack}
            role="progressbar"
            aria-labelledby={prepProgressLabelId}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className={`${s.progressFill} ${isActive ? s.progressFillShimmer : ''}`}
              style={assignInlineVars({
                [s.widthVar]: `${pct}%`,
                [s.accentColorVar]: cssVarV2('button/primary'),
              })}
            />
          </div>

          <div className={s.chipRow}>
            <span
              className={`${s.chip} ${progress.accepted > 0 ? s.chipSuccess : ''}`}
            >
              {progress.accepted}{' '}
              {t['com.affine.caseAssistant.uploadZone.status.ready']()}
            </span>
            <span className={s.chip}>
              {progress.processed}/{progress.total}
            </span>
            {progress.rejected > 0 && (
              <span className={`${s.chip} ${s.chipError}`}>
                {progress.rejected}{' '}
                {t['com.affine.caseAssistant.uploadZone.status.rejected']()}
              </span>
            )}
            {progress.skipped > 0 && (
              <span className={s.chip}>
                {progress.skipped}{' '}
                {t['com.affine.caseAssistant.uploadZone.status.skipped']()}
              </span>
            )}
          </div>

          {shouldShowTechnicalMetrics ? (
            <details className={s.cardMetaDetails}>
              <summary>
                {t[
                  'com.affine.caseAssistant.uploadZone.status.technicalDetails'
                ]()}
              </summary>
              <div className={s.cardMeta}>
                {t[
                  'com.affine.caseAssistant.uploadZone.status.technicalDetailsQueue'
                ]()}{' '}
                {telemetry.queueDepth} ·{' '}
                {t[
                  'com.affine.caseAssistant.uploadZone.status.technicalDetailsChunks'
                ]()}{' '}
                {telemetry.chunkCount} ·{' '}
                {t[
                  'com.affine.caseAssistant.uploadZone.status.technicalDetailsLast'
                ]()}{' '}
                {telemetry.lastChunkMs.toFixed(0)}ms ·{' '}
                {t[
                  'com.affine.caseAssistant.uploadZone.status.technicalDetailsPeak'
                ]()}{' '}
                {telemetry.peakChunkMs.toFixed(0)}ms ·{' '}
                {t[
                  'com.affine.caseAssistant.uploadZone.status.technicalDetailsThroughput'
                ]()}{' '}
                {telemetry.lastThroughput.toFixed(1)}{' '}
                {t[
                  'com.affine.caseAssistant.uploadZone.status.technicalDetailsFilesPerSecond'
                ]()}
              </div>
            </details>
          ) : null}

          {isDone && (
            <div className={s.cardMeta}>
              {progress.accepted > 0
                ? t.t('com.affine.caseAssistant.uploadZone.status.done', {
                    count: progress.accepted,
                  })
                : t[
                    'com.affine.caseAssistant.uploadZone.status.noSupportedFiles'
                  ]()}
            </div>
          )}
        </div>
      ) : null}

      {/* ─── Pipeline Card ─── */}
      {shouldShowPipelineCard && pipelineProgress && flowStep !== 'upload' ? (
        <div
          className={`${s.glassCard} ${pipelineProgress.active ? s.glassCardLive : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className={s.cardHeader}>
            <span id={pipelineProgressLabelId} className={s.cardTitle}>
              {pipelineProgress.active && <span className={s.liveDot} />}
              {t['com.affine.caseAssistant.uploadZone.status.pipeline']()}{' '}
              {pipelineProgress.phaseLabel}
            </span>
            <span className={s.cardPercent}>{pipelineProgress.progress}%</span>
          </div>
          <div
            className={s.progressTrack}
            role="progressbar"
            aria-labelledby={pipelineProgressLabelId}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(
              0,
              Math.min(100, pipelineProgress.progress)
            )}
          >
            <div
              className={`${s.progressFill} ${pipelineProgress.active ? s.progressFillShimmer : ''}`}
              style={assignInlineVars({
                [s.widthVar]: `${pipelineProgress.progress}%`,
                [s.accentColorVar]: pipelineProgress.active
                  ? cssVarV2('button/primary')
                  : cssVarV2('text/secondary'),
              })}
            />
          </div>
          <div className={s.chipRow}>
            {typeof pipelineProgress.totalCount === 'number' &&
            pipelineProgress.totalCount > 0 ? (
              <span className={s.chip}>
                {pipelineProgress.processedCount ??
                  pipelineProgress.indexedCount + pipelineProgress.failedCount}
                /{pipelineProgress.totalCount}{' '}
                {t['com.affine.caseAssistant.uploadZone.status.done']()
                  .split('—')[0]
                  ?.trim() || 'verarbeitet'}
              </span>
            ) : null}
            <span className={`${s.chip} ${s.chipSuccess}`}>
              {pipelineProgress.indexedCount}{' '}
              {t['com.affine.caseAssistant.uploadZone.status.indexed']()}
            </span>
            <span className={s.chip}>
              {pipelineProgress.ocrRunningCount}{' '}
              {t['com.affine.caseAssistant.uploadZone.status.ocr']()}
            </span>
            <span className={s.chip}>
              {pipelineProgress.ocrPendingCount}{' '}
              {t['com.affine.caseAssistant.uploadZone.status.pending']()}
            </span>
            {pipelineProgress.failedCount > 0 && (
              <span className={`${s.chip} ${s.chipError}`}>
                {pipelineProgress.failedCount}{' '}
                {t['com.affine.caseAssistant.uploadZone.status.failed']()}
              </span>
            )}
            {(pipelineProgress.inFlightCount ?? 0) > 0 && (
              <span className={s.chip}>
                {pipelineProgress.inFlightCount} in Arbeit
              </span>
            )}
            {(pipelineProgress.unaccountedCount ?? 0) > 0 && (
              <span className={`${s.chip} ${s.chipError}`}>
                {pipelineProgress.unaccountedCount} unklar
              </span>
            )}
          </div>
          {pipelineProgress.failedCount > 0 ? (
            <div className={s.cardMeta}>
              {pipelineProgress.failedCount} Datei(en) konnten nicht eingelesen
              werden und sind als "
              {t['com.affine.caseAssistant.uploadZone.status.failed']()}"
              markiert.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ─── Result Window ─── */}
      {isResultWindowOpen && pipelineProgress ? (
        <div
          className={s.resultWindow}
          role="dialog"
          aria-label="Ergebnisfenster Upload-Pipeline"
          aria-modal="false"
        >
          <div className={s.resultWindowHeader}>
            <div className={s.resultWindowTitle}>
              Ergebnisfenster · Upload & Parsing
            </div>
            <Button
              variant="plain"
              className={s.clearButton}
              onClick={() => setIsResultWindowOpen(false)}
            >
              Schließen
            </Button>
          </div>

          <div className={s.chipRow}>
            <span className={s.chip}>
              {pipelineProgress.processedCount ??
                pipelineProgress.indexedCount + pipelineProgress.failedCount}
              /{pipelineProgress.totalCount ?? 0} verarbeitet
            </span>
            <span className={`${s.chip} ${s.chipSuccess}`}>
              {pipelineProgress.indexedCount} indexiert
            </span>
            <span className={s.chip}>
              {pipelineProgress.ocrRunningCount} OCR läuft
            </span>
            <span className={s.chip}>
              {pipelineProgress.ocrPendingCount} OCR ausstehend
            </span>
            {pipelineProgress.failedCount > 0 ? (
              <span className={`${s.chip} ${s.chipError}`}>
                {pipelineProgress.failedCount} fehlgeschlagen
              </span>
            ) : null}
          </div>

          {(pipelineProgress.inFlightCount ?? 0) > 0 ||
          (pipelineProgress.unaccountedCount ?? 0) > 0 ? (
            <div className={s.integrityHint}>
              Zwischenschritte: {pipelineProgress.inFlightCount ?? 0} in Arbeit
              · {pipelineProgress.unaccountedCount ?? 0} unklar. Bitte Pipeline
              bis zur Vollkonsistenz laufen lassen.
            </div>
          ) : null}

          {pipelineFailureItems.length > 0 ? (
            <div className={s.resultWindowList}>
              {pipelineFailureItems.map(item => {
                const retryBusy = retryingFailedId === item.documentId;
                const removeBusy = removingFailedId === item.documentId;
                const category = classifyPipelineFailure(item);
                const retryHistory = item.retryHistory ?? [];
                return (
                  <div key={item.documentId} className={s.resultWindowItem}>
                    <div className={s.resultWindowItemTitle}>{item.title}</div>
                    <div className={s.resultWindowMetaRow}>
                      <span
                        className={`${s.chip} ${category.tone === 'error' ? s.chipError : s.chipWarning}`}
                      >
                        Fehlerkategorie: {category.label}
                      </span>
                      {item.extractionEngine ? (
                        <span className={s.chip}>
                          Engine: {item.extractionEngine}
                        </span>
                      ) : null}
                    </div>
                    <div className={s.resultWindowItemMeta}>
                      {item.processingError?.trim() ||
                        'Unbekannter Verarbeitungsfehler.'}
                    </div>
                    <div className={s.resultWindowRecommendation}>
                      {category.recommendation}
                    </div>
                    {retryHistory.length > 0 || item.retryCount ? (
                      <div className={s.resultWindowTimeline}>
                        <div className={s.resultWindowTimelineItem}>
                          <span className={s.resultWindowTimelineLabel}>
                            Retry-Versuche
                          </span>
                          <span className={s.resultWindowTimelineTime}>
                            {item.retryCount ?? retryHistory.length}
                          </span>
                        </div>
                        {item.lastRetryOutcome ? (
                          <div className={s.resultWindowTimelineItem}>
                            <span>
                              {retryOutcomeLabel(item.lastRetryOutcome)}
                            </span>
                            <span className={s.resultWindowTimelineTime}>
                              {toLocalDateTime(item.lastRetryAt)}
                            </span>
                          </div>
                        ) : null}
                        {retryHistory
                          .slice(
                            item.lastRetryOutcome ? 1 : 0,
                            item.lastRetryOutcome ? 4 : 3
                          )
                          .map((entry, index) => (
                            <div
                              key={`${item.documentId}-retry-${index}`}
                              className={s.resultWindowTimelineItem}
                            >
                              <span>{retryOutcomeLabel(entry.action)}</span>
                              <span className={s.resultWindowTimelineTime}>
                                {toLocalDateTime(entry.createdAt)}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : null}
                    <div className={s.resultWindowActions}>
                      <Button
                        variant="plain"
                        className={s.clearButton}
                        disabled={
                          isBusy ||
                          retryBusy ||
                          removeBusy ||
                          !props.onRetryFailedDocument
                        }
                        onClick={() => {
                          void onRetryFailedItem(item.documentId).catch(
                            () => {}
                          );
                        }}
                      >
                        {retryBusy ? 'Retry…' : 'Datei erneut starten'}
                      </Button>
                      <Button
                        variant="plain"
                        className={s.clearButton}
                        disabled={
                          isBusy ||
                          retryBusy ||
                          removeBusy ||
                          !props.onRemoveFailedDocument
                        }
                        onClick={() => {
                          void onRemoveFailedItem(item.documentId).catch(
                            () => {}
                          );
                        }}
                      >
                        {removeBusy ? 'Entfernen…' : 'Aus Akte entfernen'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={s.integrityHint}>
              Keine Detailfehler aus diesem Lauf verfügbar. Falls notwendig, OCR
              erneut ausführen oder Upload erneut starten.
            </div>
          )}

          {pipelineProgress.failedCount > 0 ||
          pipelineFailureItems.length > 0 ? (
            <div className={s.resultWindowActions}>
              <Button
                variant="secondary"
                disabled={
                  isBusy ||
                  isRetryBatchRunning ||
                  (!props.onRetryFailedBatch && !props.onRetryFailedDocument)
                }
                onClick={() => {
                  void onRetryBatch().catch(() => {});
                }}
              >
                {isRetryBatchRunning
                  ? 'Retry läuft…'
                  : 'Alle Fehler erneut starten'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ─── Errors ─── */}
      {errors.length > 0 && flowStep !== 'upload' ? (
        <div className={s.errorBox} role="alert" aria-live="assertive">
          {fatalError ? <div>{fatalError}</div> : null}
          {errors.map((e, i) => (
            <div key={i} className={s.errorEntry}>
              <div className={s.errorHeader}>
                <span
                  className={
                    classifyErrorSeverity(e) === 'critical'
                      ? `${s.errorSeverityChip} ${s.errorSeverityCritical}`
                      : classifyErrorSeverity(e) === 'warning'
                        ? `${s.errorSeverityChip} ${s.errorSeverityWarning}`
                        : `${s.errorSeverityChip} ${s.errorSeverityInfo}`
                  }
                >
                  {severityLabel(classifyErrorSeverity(e))}
                </span>
                <span>{e.name}</span>
              </div>
              <div>{e.reason}</div>
              {e.recommendation ? <div>{e.recommendation}</div> : null}
            </div>
          ))}
          {progress.rejected > MAX_ERROR_DISPLAY && (
            <div>… und {progress.rejected - MAX_ERROR_DISPLAY} weitere</div>
          )}
        </div>
      ) : null}

      {/* ─── Staged Files ─── */}
      {stagedFiles.length > 0 && flowStep !== 'upload' ? (
        <div className={s.stagedRoot}>
          <div className={s.stagedHeader}>
            <span className={s.stagedTitle}>
              {selectedCount}/{stagedFiles.length}{' '}
              {t['com.affine.caseAssistant.uploadZone.staged.selected']()} ·{' '}
              {fmtSize(totalBytes)}
            </span>
            <div className={s.stagedHeaderActions}>
              <Menu
                items={
                  <>
                    <MenuItem
                      onClick={onPickFiles}
                      onAuxClick={onPickFiles}
                      disabled={locked}
                    >
                      {t[
                        'com.affine.caseAssistant.uploadZone.button.pickFiles'
                      ]()}
                    </MenuItem>
                    <MenuItem
                      onClick={onPickFolder}
                      onAuxClick={onPickFolder}
                      disabled={locked}
                    >
                      {t[
                        'com.affine.caseAssistant.uploadZone.button.pickFolder'
                      ]()}
                    </MenuItem>
                  </>
                }
              >
                <Button
                  variant="plain"
                  className={s.clearButton}
                  disabled={locked}
                  aria-label={t[
                    'com.affine.caseAssistant.uploadZone.button.moreFiles'
                  ]()}
                >
                  {t['com.affine.caseAssistant.uploadZone.button.moreFiles']()}{' '}
                  ▾
                </Button>
              </Menu>
              <Button
                variant="plain"
                onClick={onSelectAll}
                className={s.clearButton}
                disabled={isBusy}
                aria-label={t[
                  'com.affine.caseAssistant.uploadZone.button.selectAll'
                ]()}
              >
                {t['com.affine.caseAssistant.uploadZone.button.selectAll']()}
              </Button>
              <Button
                variant="plain"
                onClick={onSelectNone}
                className={s.clearButton}
                disabled={isBusy}
                aria-label={t[
                  'com.affine.caseAssistant.uploadZone.button.selectNone'
                ]()}
              >
                {t['com.affine.caseAssistant.uploadZone.button.selectNone']()}
              </Button>
              <Button
                variant="plain"
                onClick={onInvertSelection}
                className={s.clearButton}
                disabled={isBusy || stagedFiles.length === 0}
                aria-label={t[
                  'com.affine.caseAssistant.uploadZone.button.invertSelection'
                ]()}
              >
                {t[
                  'com.affine.caseAssistant.uploadZone.button.invertSelection'
                ]()}
              </Button>
              <Button
                variant="plain"
                onClick={onRemoveSelected}
                className={s.clearButton}
                disabled={isBusy || selectedCount === 0}
                aria-label={t[
                  'com.affine.caseAssistant.uploadZone.button.removeSelected'
                ]()}
              >
                {t[
                  'com.affine.caseAssistant.uploadZone.button.removeSelected'
                ]()}
              </Button>
              <Button
                variant="plain"
                onClick={onClear}
                className={s.clearButton}
                disabled={isBusy}
                aria-label={t[
                  'com.affine.caseAssistant.uploadZone.button.reset'
                ]()}
              >
                {t['com.affine.caseAssistant.uploadZone.button.reset']()}
              </Button>
              <Button
                variant="plain"
                onClick={() => {
                  void onRetryFailedOnly().catch(() => {});
                }}
                className={s.clearButton}
                disabled={isBusy || failedSelection.length === 0}
                aria-label={t[
                  'com.affine.caseAssistant.uploadZone.button.retryFailed'
                ]()}
              >
                {t['com.affine.caseAssistant.uploadZone.button.retryFailed']()}
              </Button>
            </div>
          </div>

          {stagedFiles.length <= MAX_STAGED_RENDER ? (
            <ul className={s.stagedList}>
              {renderFiles.map((file, index) => {
                const k = toKey(file);
                const checkboxId = `legal-upload-select-${index}`;
                const isSelected = selectedKeys.has(k);
                return (
                  <li
                    key={k}
                    className={s.stagedItem}
                    data-selected={isSelected ? 'true' : 'false'}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className={s.selectCheckbox}
                      checked={selectedKeys.has(k)}
                      onChange={() => onToggleSelected(k)}
                      disabled={isBusy}
                      aria-label={t.t(
                        'com.affine.caseAssistant.uploadZone.button.selectFile',
                        { name: file.name }
                      )}
                    />
                    <label htmlFor={checkboxId} className={s.stagedItemLabel}>
                      <span className={s.kindBadge}>
                        {KIND_LABEL[file.kind]}
                      </span>
                      <span className={s.fileName}>{file.name}</span>
                      <span className={s.fileSize}>{fmtSize(file.size)}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onRemove(k)}
                      className={s.removeButton}
                      aria-label={t.t(
                        'com.affine.caseAssistant.uploadZone.button.removeFile',
                        { name: file.name }
                      )}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={s.largeSelectionRoot}>
              <div className={s.scanHint}>
                {t.t(
                  'com.affine.caseAssistant.uploadZone.largeSelection.hint',
                  {
                    count: stagedFiles.length,
                  }
                )}
              </div>
              <div className={s.largeSelectionActions}>
                <Button
                  variant="plain"
                  onClick={onToggleSelectionWindow}
                  className={s.clearButton}
                  disabled={isBusy}
                  aria-expanded={isSelectionWindowOpen}
                  aria-controls="upload-selection-window"
                >
                  {isSelectionWindowOpen
                    ? 'Auswahlfenster schließen'
                    : 'Auswahlfenster öffnen'}
                </Button>
                <Button
                  variant="plain"
                  onClick={onToggleShowOnlySelected}
                  className={s.clearButton}
                  disabled={isBusy || selectedCount === 0}
                  aria-pressed={showOnlySelectedInLargeWindow}
                >
                  {showOnlySelectedInLargeWindow
                    ? 'Alle anzeigen'
                    : 'Nur ausgewählte'}
                </Button>
                <span className={s.scanHint}>
                  Seite {activeSelectionPage + 1}/{selectionPageCount} ·{' '}
                  {LARGE_SELECTION_PAGE_SIZE} pro Seite ·{' '}
                  {largeSelectionSource.length} sichtbar
                </span>
                <input
                  type="text"
                  value={largeSelectionQuery}
                  onChange={onLargeSelectionQueryChange}
                  placeholder="Dateiname filtern…"
                  style={{
                    minWidth: 180,
                    flex: '1 1 220px',
                    maxWidth: 320,
                    borderRadius: 8,
                    border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
                    background: cssVarV2('layer/background/primary'),
                    color: cssVarV2('text/primary'),
                    fontSize: 11,
                    lineHeight: '16px',
                    padding: '6px 8px',
                  }}
                  disabled={isBusy}
                  aria-label={t[
                    'com.affine.caseAssistant.uploadZone.aria.filterSelection'
                  ]()}
                />
              </div>

              {isSelectionWindowOpen ? (
                <div
                  id="upload-selection-window"
                  className={s.largeSelectionWindow}
                  role="group"
                  aria-label={t[
                    'com.affine.caseAssistant.uploadZone.aria.selectionWindow'
                  ]()}
                >
                  <div className={s.largeSelectionPager}>
                    <Button
                      variant="plain"
                      onClick={onSelectionPagePrev}
                      className={s.clearButton}
                      disabled={isBusy || activeSelectionPage === 0}
                      aria-label={t[
                        'com.affine.caseAssistant.uploadZone.aria.prevPage'
                      ]()}
                    >
                      {t[
                        'com.affine.caseAssistant.uploadZone.button.prevPage'
                      ]()}
                    </Button>
                    <span className={s.scanHint}>
                      {t.t(
                        'com.affine.caseAssistant.uploadZone.selection.pager',
                        {
                          from:
                            activeSelectionPage * LARGE_SELECTION_PAGE_SIZE + 1,
                          to: Math.min(
                            (activeSelectionPage + 1) *
                              LARGE_SELECTION_PAGE_SIZE,
                            largeSelectionSource.length
                          ),
                          total: largeSelectionSource.length,
                        }
                      )}
                    </span>
                    <Button
                      variant="plain"
                      onClick={() => onSelectionPageNext(selectionPageCount)}
                      className={s.clearButton}
                      disabled={
                        isBusy || activeSelectionPage >= selectionPageCount - 1
                      }
                      aria-label={t[
                        'com.affine.caseAssistant.uploadZone.aria.nextPage'
                      ]()}
                    >
                      {t[
                        'com.affine.caseAssistant.uploadZone.button.nextPage'
                      ]()}
                    </Button>
                  </div>
                  <ul className={s.stagedList}>
                    {largeSelectionFiles.map((file, index) => {
                      const k = toKey(file);
                      const checkboxId = `large-upload-select-${activeSelectionPage}-${index}`;
                      const isSelected = selectedKeys.has(k);
                      return (
                        <li
                          key={k}
                          className={s.stagedItem}
                          data-selected={isSelected ? 'true' : 'false'}
                        >
                          <input
                            id={checkboxId}
                            className={s.selectCheckbox}
                            type="checkbox"
                            checked={selectedKeys.has(k)}
                            onChange={() => onToggleSelected(k)}
                            disabled={isBusy}
                            aria-label={`${file.name} auswählen`}
                          />
                          <label
                            htmlFor={checkboxId}
                            className={s.stagedItemLabel}
                          >
                            <span className={s.kindBadge}>
                              {KIND_LABEL[file.kind]}
                            </span>
                            <span className={s.fileName}>{file.name}</span>
                            <span className={s.fileSize}>
                              {fmtSize(file.size)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          <div className={s.integrityHint} role="note">
            {t['com.affine.caseAssistant.uploadZone.integrityHint']()}
          </div>

          <div className={s.actionRow}>
            <Button
              variant="primary"
              disabled={locked || selectedCount === 0}
              onClick={() => {
                void onConfirm().catch(() => {});
              }}
              className={s.primaryAction}
              aria-label={t.t(
                'com.affine.caseAssistant.uploadZone.button.commitSelectedAria',
                {
                  count: selectedCount,
                }
              )}
            >
              {isBusy
                ? t['com.affine.caseAssistant.uploadZone.status.processing']()
                : t.t(
                    'com.affine.caseAssistant.uploadZone.button.commitSelected',
                    {
                      count: selectedCount,
                    }
                  )}
            </Button>
          </div>

          {scanCount > 0 ? (
            <div className={s.scanHint} role="note">
              {t.t('com.affine.caseAssistant.uploadZone.status.scanHint', {
                count: scanCount,
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

FileUploadZone.displayName = 'FileUploadZone';
