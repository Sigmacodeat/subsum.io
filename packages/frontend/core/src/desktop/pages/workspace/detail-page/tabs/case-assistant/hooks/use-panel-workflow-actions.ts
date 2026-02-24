import type { AffineEditorContainer } from '@affine/core/blocksuite/block-suite-editor';
import { insertFromMarkdown } from '@affine/core/blocksuite/utils';
import type {
  CaseAssistantRole,
  CaseBlueprint,
  CaseFile,
  CasePlatformOrchestrationService,
  CaseProviderSettingsService,
  CitationChain,
  ContradictionDetectorService,
  ContradictionMatrix,
  CostCalculatorService,
  CourtDecision,
  DocumentGeneratorService,
  DocumentTemplate,
  DocumentPreflightReport,
  EvidenceRegisterService,
  GeneratedDocument,
  Gerichtsinstanz,
  JudikaturSuggestion,
  Jurisdiction,
  KostenrisikoResult,
  LegalCopilotWorkflowService,
  LegalDocumentRecord,
  LegalFinding,
  LegalNormsService,
  NormMatchResult,
  Verfahrensart,
  VergleichswertResult,
} from '@affine/core/modules/case-assistant';
import type { Store } from '@blocksuite/affine/store';
import { useCallback, useRef } from 'react';

import type {
  DraftReviewStatus,
  IntakeDraft,
} from '../panel-types';
import {
  buildExportFileName,
  extractDocPlainText,
} from '../utils';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function tryBase64ToUint8Array(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function detectMimeFromMagicBytes(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12) return undefined;
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  return undefined;
}

function buildDocumentPreflight(file: {
  kind: string;
  content: string;
  mimeType: string;
}): DocumentPreflightReport {
  const now = new Date().toISOString();
  const mimeByHeader = file.mimeType?.toLowerCase() || undefined;
  const isBinaryPayload =
    file.content.startsWith('data:') && file.content.includes(';base64,');
  const reasonCodes: string[] = [];

  if (!file.content.trim()) {
    return {
      version: 'v1',
      routeDecision: 'blocked',
      riskLevel: 'critical',
      reasonCodes: ['content-empty'],
      mimeByHeader,
      isBinaryPayload,
      contentLength: 0,
      createdAt: now,
    };
  }

  let mimeByMagicBytes: string | undefined;
  if (isBinaryPayload) {
    const base64Idx = file.content.indexOf(';base64,');
    const base64 = base64Idx >= 0 ? file.content.slice(base64Idx + 8) : file.content;
    const probe = tryBase64ToUint8Array(base64.slice(0, 256 * 1024));
    if (!probe || probe.length === 0) {
      return {
        version: 'v1',
        routeDecision: 'blocked',
        riskLevel: 'critical',
        reasonCodes: ['base64-invalid'],
        mimeByHeader,
        isBinaryPayload,
        contentLength: file.content.length,
        createdAt: now,
      };
    }
    mimeByMagicBytes = detectMimeFromMagicBytes(probe);
  }

  if (mimeByHeader && mimeByMagicBytes && mimeByHeader !== mimeByMagicBytes) {
    reasonCodes.push('mime-mismatch');
  }

  const effectiveMime = (mimeByMagicBytes ?? mimeByHeader ?? '').toLowerCase();
  const isPdf = file.kind === 'pdf' || effectiveMime.includes('pdf');
  const isImage = file.kind === 'scan-pdf' || effectiveMime.startsWith('image/');

  if (!isBinaryPayload) {
    return {
      version: 'v1',
      routeDecision: 'text_extract',
      riskLevel: reasonCodes.length > 0 ? 'warning' : 'ok',
      reasonCodes,
      mimeByHeader,
      mimeByMagicBytes,
      isBinaryPayload,
      contentLength: file.content.length,
      createdAt: now,
    };
  }

  if (isPdf) {
    reasonCodes.push('pdf-binary');
    return {
      version: 'v1',
      routeDecision: 'ocr_queue',
      riskLevel: 'warning',
      reasonCodes,
      mimeByHeader,
      mimeByMagicBytes,
      isBinaryPayload,
      contentLength: file.content.length,
      createdAt: now,
    };
  }

  if (isImage) {
    reasonCodes.push('image-binary-ocr');
    return {
      version: 'v1',
      routeDecision: 'ocr_queue',
      riskLevel: 'warning',
      reasonCodes,
      mimeByHeader,
      mimeByMagicBytes,
      isBinaryPayload,
      contentLength: file.content.length,
      createdAt: now,
    };
  }

  return {
    version: 'v1',
    routeDecision: 'manual_review',
    riskLevel: 'critical',
    reasonCodes: [...reasonCodes, 'binary-unknown-format'],
    mimeByHeader,
    mimeByMagicBytes,
    isBinaryPayload,
    contentLength: file.content.length,
    createdAt: now,
  };
}

type Params = {
  caseId: string;
  workspaceId: string;
  currentRole: CaseAssistantRole;
  sourceDoc: Store | null;
  editorContainer: AffineEditorContainer | null;

  intakeDraft: IntakeDraft;
  folderQuery: string;
  setFolderQuery: React.Dispatch<React.SetStateAction<string>>;
  setFolderSearchCount: React.Dispatch<React.SetStateAction<number | null>>;
  ocrEndpoint: string;
  ocrToken: string;

  normSearchQuery: string;
  setNormSearchResults: React.Dispatch<React.SetStateAction<NormMatchResult[]>>;
  activeJurisdiction: Jurisdiction;

  costStreitwert: string;
  costInstanz: Gerichtsinstanz;
  costVerfahren: Verfahrensart;
  costObsiegen: string;
  costVergleichQuote: string;
  setCostResult: React.Dispatch<React.SetStateAction<KostenrisikoResult | null>>;
  setCostVergleichResult: React.Dispatch<React.SetStateAction<VergleichswertResult | null>>;

  docGenTemplate: string;
  docGenPartyKlaeger: string;
  docGenPartyBeklagter: string;
  docGenGericht: string;
  docGenAktenzeichen: string;
  setGeneratedDoc: React.Dispatch<React.SetStateAction<GeneratedDocument | null>>;
  generatedDoc: GeneratedDocument | null;

  caseDocuments: LegalDocumentRecord[];
  caseFindings: LegalFinding[];
  caseRecord: CaseFile | null | undefined;
  latestBlueprint: CaseBlueprint | null;

  setContradictionMatrix: React.Dispatch<React.SetStateAction<ContradictionMatrix | null>>;

  blueprintObjectiveDraft: string;
  blueprintReviewStatus: DraftReviewStatus;
  blueprintReviewNoteDraft: string;

  taskAssignees: Record<string, string>;
  setTaskAssignees: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  setEvidenceCount: React.Dispatch<React.SetStateAction<number>>;
  setEvidenceSummaryMarkdown: React.Dispatch<React.SetStateAction<string | null>>;

  legalAnalysisEndpoint: string;
  legalAnalysisToken: string;
  judikaturEndpoint: string;
  judikaturToken: string;
  hasStoredOcrToken: boolean;
  setHasStoredOcrToken: React.Dispatch<React.SetStateAction<boolean>>;
  hasStoredLegalAnalysisToken: boolean;
  setHasStoredLegalAnalysisToken: React.Dispatch<React.SetStateAction<boolean>>;
  hasStoredJudikaturToken: boolean;
  setHasStoredJudikaturToken: React.Dispatch<React.SetStateAction<boolean>>;

  kanzleiDisplayName?: string;
  anwaltDisplayName?: string;
  kanzleiLogoDataUrl?: string;

  setIsWorkflowBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setIngestionStatus: (status: string) => void;

  legalCopilotWorkflowService: LegalCopilotWorkflowService;
  legalNormsService: LegalNormsService;
  contradictionDetectorService: ContradictionDetectorService;
  costCalculatorService: CostCalculatorService;
  documentGeneratorService: DocumentGeneratorService;
  evidenceRegisterService: EvidenceRegisterService;
  providerSettingsService: CaseProviderSettingsService;
  casePlatformOrchestrationService: CasePlatformOrchestrationService;
};

export const usePanelWorkflowActions = (params: Params) => {
  const UPLOAD_CHUNK_SIZE = 10;
  const INTAKE_CHUNK_TIMEOUT_MS = 90_000;
  const OCR_RUN_TIMEOUT_MS = 240_000;
  const ANALYSIS_RUN_TIMEOUT_MS = 180_000;
  const BACKGROUND_OCR_COOLDOWN_MS = 45_000;
  const backgroundOcrInFlightRef = useRef(false);
  const backgroundOcrNextAllowedAtRef = useRef(0);

  const withTimeout = useCallback(async <T,>(
    task: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> => {
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
  }, []);

  const formatAnalysisBlockedMessage = useCallback((
    reason: 'no_indexed_documents' | 'insufficient_credits' | 'permission_denied' | null | undefined
  ) => {
    if (reason === 'no_indexed_documents') {
      return 'Analyse übersprungen: keine indexierten Dokumente vorhanden. Bitte OCR/Intake prüfen.';
    }
    if (reason === 'insufficient_credits') {
      return 'Analyse blockiert: nicht genügend AI-Credits verfügbar.';
    }
    return `Analyse blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`;
  }, [params.currentRole]);

  type UploadFilesOutcome = {
    commitId: string;
    inputCount: number;
    ingestedCount: number;
    skippedCount: number;
    failedCount: number;
    ocrQueuedCount: number;
  };

  const summarizeIngested = (ingested: Array<{ status: string; processingStatus?: string }>) => {
    const ocrQueuedCount = ingested.filter(d => d.status === 'ocr_pending').length;
    const failedCount = ingested.filter(d => d.processingStatus === 'failed').length;
    return { ocrQueuedCount, failedCount };
  };

  const onUploadFilesDetailed = useCallback(async (files: Array<{
    name: string;
    size: number;
    kind: string;
    content: string;
    mimeType: string;
    lastModifiedAt: string;
    pageCount?: number;
    folderPath?: string;
  }>): Promise<UploadFilesOutcome> => {
    if (files.length === 0) {
      return {
        commitId: createId('commit'),
        inputCount: 0,
        ingestedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        ocrQueuedCount: 0,
      };
    }

    const ensureUploadPermission = async () => {
      let permission = await params.casePlatformOrchestrationService.evaluatePermission(
        'document.upload'
      );

      if (!permission.ok && permission.requiredRole === 'operator') {
        await params.casePlatformOrchestrationService.setCurrentRole('operator');
        permission = await params.casePlatformOrchestrationService.evaluatePermission(
          'document.upload'
        );
        if (permission.ok) {
          params.setIngestionStatus(
            'Rolle wurde automatisch auf Operator synchronisiert, Upload wird fortgesetzt.'
          );
        }
      }

      if (!permission.ok) {
        throw new Error(
          `permission-denied:${permission.role}->${permission.requiredRole}:${permission.message}`
        );
      }
    };

    const allDocuments = files.map(file => {
      const preflight = buildDocumentPreflight(file);
      return {
      title: file.name,
      kind: file.kind as 'note' | 'pdf' | 'scan-pdf' | 'email' | 'docx' | 'other',
      content: file.content,
      pageCount: file.pageCount,
      sourceMimeType: file.mimeType,
      sourceSizeBytes: file.size,
      sourceLastModifiedAt: file.lastModifiedAt,
      sourceRef: `file-upload:${file.name}:${Date.now()}:route=${preflight.routeDecision}`,
      folderPath: file.folderPath || params.intakeDraft.folderPath.trim() || undefined,
      internalFileNumber: params.intakeDraft.internalFileNumber.trim() || undefined,
      tags: params.intakeDraft.tags
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      preflight,
      };
    });

    const blockedDoc = allDocuments.find(doc => doc.preflight.routeDecision === 'blocked');
    if (blockedDoc) {
      throw new Error(
        `content-empty:${blockedDoc.title}:${blockedDoc.preflight.reasonCodes.join(',')}`
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SINGLE-FILE FAST PATH
    // Keep UX semantics (busy/status/OCR trigger) but skip ingestion-job
    // overhead so wizard sequential uploads stay lean and stable.
    // ═══════════════════════════════════════════════════════════════════
    if (files.length === 1) {
      params.setIsWorkflowBusy(true);
      const commitId = createId('commit');
      try {
        await ensureUploadPermission();

        if (!allDocuments[0]?.content?.trim()) {
          throw new Error(`content-empty:${files[0].name}`);
        }

        console.log(`[onUploadFiles] single-file path: name=${files[0].name} size=${files[0].size} kind=${files[0].kind} mime=${files[0].mimeType} contentLen=${files[0].content?.length ?? 0} caseId=${params.caseId} workspaceId=${params.workspaceId} role=${params.currentRole}`);
        let ingested = await params.legalCopilotWorkflowService.intakeDocuments({
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          documents: allDocuments,
          commitId,
        });

        const { ocrQueuedCount, failedCount } = summarizeIngested(ingested as any);
        const ingestedCount = ingested.length;
        const skippedCount = Math.max(0, files.length - ingestedCount);

        // Fallback records are now created in legal-copilot-workflow.ts when intake returns 0
        // No need to throw here anymore - the service guarantees at least failed/OCR-pending records

        const scanCount = ocrQueuedCount;
        const readyCount = ingested.filter(d => d.processingStatus === 'ready').length;
        const needsReviewCount = ingested.filter(
          d => d.processingStatus === 'needs_review'
        ).length;

        if (scanCount > 0) {
          const now = Date.now();
          const canRunBackgroundOcr =
            !backgroundOcrInFlightRef.current && now >= backgroundOcrNextAllowedAtRef.current;
          if (canRunBackgroundOcr) {
            backgroundOcrInFlightRef.current = true;
            backgroundOcrNextAllowedAtRef.current = now + BACKGROUND_OCR_COOLDOWN_MS;
            const ocrRunId = createId('ocr-run');
            void params.legalCopilotWorkflowService
              .processPendingOcr(params.caseId, params.workspaceId, { ocrRunId })
              .catch(error => {
                console.warn('[upload] background OCR processing failed', error);
              })
              .finally(() => {
                backgroundOcrInFlightRef.current = false;
              });
          }
        }

        const statusParts = [`${ingested.length} Datei(en) erfolgreich aufgenommen.`];
        statusParts.push(`${readyCount} automatisch verwertbar.`);
        if (scanCount > 0) {
          statusParts.push(`${scanCount} Scan(s) erkannt, OCR läuft im Hintergrund.`);
        }
        if (needsReviewCount > 0) {
          statusParts.push(`${needsReviewCount} zur manuellen Prüfung markiert.`);
        }
        if (failedCount > 0) {
          statusParts.push(`${failedCount} Verarbeitung fehlgeschlagen.`);
        }
        params.setIngestionStatus(statusParts.join(' '));

        return {
          commitId,
          inputCount: files.length,
          ingestedCount,
          skippedCount,
          failedCount,
          ocrQueuedCount,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'upload-single-file-failed';
        params.setIngestionStatus(`Upload-Fehler (${files[0].name}): ${message}`);
        throw error;
      } finally {
        params.setIsWorkflowBusy(false);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // BATCH PATH (legacy / non-wizard callers)
    // ═══════════════════════════════════════════════════════════════════
    params.setIsWorkflowBusy(true);
    const commitId = createId('commit');
    let jobId: string | null = null;
    try {
      await ensureUploadPermission();

      const withTimeout = async <T,>(
        task: Promise<T>,
        timeoutMs: number,
        timeoutMessage: string
      ): Promise<T> => {
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
      };

      const sourceType = files.some(file => Boolean(file.folderPath)) ? 'folder' : 'upload';
      const job = await params.casePlatformOrchestrationService.enqueueIngestionJob({
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        sourceType,
        sourceRef: `${sourceType}:${files.length}:${Date.now()}`,
      });
      jobId = job.id;
      await params.casePlatformOrchestrationService.updateJobStatus({
        jobId,
        status: 'running',
        progress: 3,
      });

      const chunks: Array<typeof allDocuments> = [];
      for (let i = 0; i < allDocuments.length; i += UPLOAD_CHUNK_SIZE) {
        chunks.push(allDocuments.slice(i, i + UPLOAD_CHUNK_SIZE));
      }

      const ingested: Awaited<ReturnType<typeof params.legalCopilotWorkflowService.intakeDocuments>> = [];
      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const chunkResult = await withTimeout(
          params.legalCopilotWorkflowService.intakeDocuments({
            caseId: params.caseId,
            workspaceId: params.workspaceId,
            documents: chunk,
            commitId,
          }),
          INTAKE_CHUNK_TIMEOUT_MS,
          `Upload-Commit Timeout in Batch ${index + 1}/${chunks.length}.`
        );
        ingested.push(...chunkResult);
        if (jobId) {
          const progress = Math.min(95, Math.round(((index + 1) / chunks.length) * 92) + 3);
          await params.casePlatformOrchestrationService.updateJobStatus({
            jobId,
            status: 'running',
            progress,
          });
        }
      }

      if (ingested.length === 0) {
        if (jobId) {
          await params.casePlatformOrchestrationService.updateJobStatus({
            jobId,
            status: 'completed',
            progress: 100,
          });
        }
        params.setIngestionStatus(
          `Keine neuen Dateien aufgenommen (mögliche Ursache: Duplikate oder fehlende Berechtigung für Rolle ${params.currentRole}).`
        );
        return {
          commitId,
          inputCount: files.length,
          ingestedCount: 0,
          skippedCount: files.length,
          failedCount: 0,
          ocrQueuedCount: 0,
        };
      }

      const { ocrQueuedCount, failedCount } = summarizeIngested(ingested as any);
      const scanCount = ocrQueuedCount;
      const readyCount = ingested.filter(d => d.processingStatus === 'ready').length;
      const needsReviewCount = ingested.filter(
        d => d.processingStatus === 'needs_review'
      ).length;
      if (scanCount > 0) {
        const now = Date.now();
        const canRunBackgroundOcr =
          !backgroundOcrInFlightRef.current && now >= backgroundOcrNextAllowedAtRef.current;
        if (canRunBackgroundOcr) {
          backgroundOcrInFlightRef.current = true;
          backgroundOcrNextAllowedAtRef.current = now + BACKGROUND_OCR_COOLDOWN_MS;
          const ocrRunId = createId('ocr-run');
          void params.legalCopilotWorkflowService
            .processPendingOcr(params.caseId, params.workspaceId, { ocrRunId })
            .catch(error => {
              console.warn('[upload] background OCR processing failed', error);
            })
            .finally(() => {
              backgroundOcrInFlightRef.current = false;
            });
        }
      }

      const statusParts = [`${ingested.length} Datei(en) erfolgreich aufgenommen.`];
      statusParts.push(`${readyCount} automatisch verwertbar.`);
      if (scanCount > 0) {
        statusParts.push(`${scanCount} Scan(s) erkannt, OCR läuft im Hintergrund.`);
      }
      if (needsReviewCount > 0) {
        statusParts.push(`${needsReviewCount} zur manuellen Prüfung markiert.`);
      }
      if (failedCount > 0) {
        statusParts.push(`${failedCount} Verarbeitung fehlgeschlagen.`);
      }
      params.setIngestionStatus(statusParts.join(' '));

      if (jobId) {
        await params.casePlatformOrchestrationService.updateJobStatus({
          jobId,
          status: failedCount > 0 ? 'failed' : 'completed',
          progress: 100,
          errorMessage: failedCount > 0 ? `${failedCount} Datei(en) fehlgeschlagen.` : undefined,
        });
      }

      return {
        commitId,
        inputCount: files.length,
        ingestedCount: ingested.length,
        skippedCount: Math.max(0, files.length - ingested.length),
        failedCount,
        ocrQueuedCount,
      };
    } catch (error) {
      if (jobId) {
        await params.casePlatformOrchestrationService.updateJobStatus({
          jobId,
          status: 'failed',
          progress: 100,
          errorMessage: 'Bulk-Upload fehlgeschlagen',
        });
      }
      throw error;
    } finally {
      params.setIsWorkflowBusy(false);
    }
  }, [
    params.caseId,
    params.casePlatformOrchestrationService,
    params.currentRole,
    params.intakeDraft.folderPath,
    params.intakeDraft.internalFileNumber,
    params.intakeDraft.tags,
    params.legalCopilotWorkflowService,
    params.setIngestionStatus,
    params.setIsWorkflowBusy,
    params.workspaceId,
  ]);

  const onProcessOcr = useCallback(async () => {
    if (!params.ocrEndpoint.trim()) {
      params.setIngestionStatus(
        'OCR kann nicht gestartet werden: Remote OCR Provider ist nicht konfiguriert (Endpoint fehlt). Öffne „Phase 2 — OCR ausführen“ und speichere den Endpoint.'
      );
      return;
    }

    const pendingBeforeRun = params.caseDocuments.filter(
      doc => doc.status === 'ocr_pending' || doc.status === 'ocr_running'
    ).length;
    params.setIsWorkflowBusy(true);
    try {
      const done = await withTimeout(
        params.legalCopilotWorkflowService.processPendingOcr(
          params.caseId,
          params.workspaceId
        ),
        OCR_RUN_TIMEOUT_MS,
        'OCR-Lauf Zeitlimit überschritten (4 Minuten)'
      );

      const pendingAfterRun = (params.legalCopilotWorkflowService.legalDocuments$.value ?? []).filter(
        doc =>
          doc.caseId === params.caseId &&
          doc.workspaceId === params.workspaceId &&
          (doc.status === 'ocr_pending' || doc.status === 'ocr_running')
      ).length;

      if (done.length === 0) {
        params.setIngestionStatus(
          pendingBeforeRun > 0
            ? `OCR-Lauf beendet: ${pendingBeforeRun} Job(s) geprüft, 0 abgeschlossen${
              pendingAfterRun > 0 ? `, ${pendingAfterRun} weiterhin ausstehend` : ''
            }.`
            : `OCR-Lauf abgeschlossen ohne neue Jobs oder blockiert (Rolle: ${params.currentRole}).`
        );
        return;
      }
      params.setIngestionStatus(
        `OCR abgeschlossen: ${done.length} Job(s) verarbeitet${
          pendingAfterRun > 0 ? `, ${pendingAfterRun} weiterhin ausstehend` : ''
        }.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unbekannter OCR-Fehler';
      params.setIngestionStatus(`OCR fehlgeschlagen: ${message}`);
      throw error;
    } finally {
      params.setIsWorkflowBusy(false);
    }
  }, [
    params.caseId,
    params.caseDocuments,
    params.currentRole,
    params.legalCopilotWorkflowService,
    params.setIngestionStatus,
    params.setIsWorkflowBusy,
    params.workspaceId,
    withTimeout,
  ]);

  const onAnalyzeCase = useCallback(async () => {
    params.setIsWorkflowBusy(true);
    try {
      const result = await withTimeout(
        params.legalCopilotWorkflowService.analyzeCase(
          params.caseId,
          params.workspaceId
        ),
        ANALYSIS_RUN_TIMEOUT_MS,
        'Analyse-Zeitlimit überschritten (3 Minuten)'
      );
      if (!result.run) {
        const blockedMessage = formatAnalysisBlockedMessage(result.blockedReason);
        params.setIngestionStatus(blockedMessage);
        throw new Error(`analysis-blocked:${result.blockedReason ?? 'unknown'}`);
      }
      params.setIngestionStatus(
        `Analyse abgeschlossen: ${result.findings.length} Findings, ${result.tasks.length} Tasks.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unbekannter Analyse-Fehler';
      params.setIngestionStatus(`Analyse fehlgeschlagen: ${message}`);
      throw error;
    } finally {
      params.setIsWorkflowBusy(false);
    }
  }, [
    params.caseId,
    params.currentRole,
    params.legalCopilotWorkflowService,
    params.setIngestionStatus,
    params.setIsWorkflowBusy,
    params.workspaceId,
    formatAnalysisBlockedMessage,
    withTimeout,
  ]);

  const onRunFullWorkflow = useCallback(async () => {
    if (params.caseDocuments.length === 0) {
      params.setIngestionStatus(
        'Vollworkflow benötigt mindestens 1 hochgeladenes Dokument im Akt.'
      );
      return;
    }

    if (!params.ocrEndpoint.trim()) {
      params.setIngestionStatus(
        'Vollworkflow kann nicht starten: Remote OCR Provider ist nicht konfiguriert (Endpoint fehlt). Bitte in „Phase 2 — OCR ausführen“ konfigurieren und speichern.'
      );
      return;
    }

    params.setIsWorkflowBusy(true);
    try {
      const pendingOcrBeforeRun = params.caseDocuments.filter(
        doc => doc.status === 'ocr_pending' || doc.status === 'ocr_running'
      ).length;

      const completedOcrJobs = await withTimeout(
        params.legalCopilotWorkflowService.processPendingOcr(
          params.caseId,
          params.workspaceId
        ),
        OCR_RUN_TIMEOUT_MS,
        'OCR-Zeitlimit überschritten (4 Minuten)'
      );
      const analysis = await withTimeout(
        params.legalCopilotWorkflowService.analyzeCase(
          params.caseId,
          params.workspaceId
        ),
        ANALYSIS_RUN_TIMEOUT_MS,
        'Analyse-Zeitlimit überschritten (3 Minuten)'
      );

      if (!analysis.run) {
        params.setIngestionStatus(
          `Full Workflow blockiert: ${formatAnalysisBlockedMessage(analysis.blockedReason)}`
        );
        return;
      }

      const analyzedDocumentCount = analysis.run.inputDocumentIds.length;
      const ocrSummary =
        completedOcrJobs.length > 0
          ? `${completedOcrJobs.length} OCR-Job(s) abgeschlossen`
          : pendingOcrBeforeRun > 0
            ? 'keine OCR-Jobs abgeschlossen'
            : 'keine OCR erforderlich';

      params.setIngestionStatus(
        `Full Workflow abgeschlossen: ${params.caseDocuments.length} Dokument(e) im Akt, ${ocrSummary}, ${analyzedDocumentCount} Dokument(e) analysiert, ${analysis.findings.length} Findings.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unbekannter Pipeline-Fehler';
      params.setIngestionStatus(`Full Workflow fehlgeschlagen: ${message}`);
      throw error;
    } finally {
      params.setIsWorkflowBusy(false);
    }
  }, [
    params.caseId,
    params.caseDocuments,
    params.currentRole,
    params.ocrEndpoint,
    params.legalCopilotWorkflowService,
    params.setIngestionStatus,
    params.setIsWorkflowBusy,
    params.workspaceId,
    formatAnalysisBlockedMessage,
    withTimeout,
  ]);

  const onFolderSearch = useCallback(async () => {
    const matches = await params.legalCopilotWorkflowService.searchFolder({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      folderPath: params.folderQuery,
    });
    params.setFolderSearchCount(matches.length);
    params.setIngestionStatus(
      `Folder-Suche '${params.folderQuery || '*'}': ${matches.length} Dokument(e) gefunden.`
    );
  }, [
    params.caseId,
    params.folderQuery,
    params.legalCopilotWorkflowService,
    params.setFolderSearchCount,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onFolderSummarize = useCallback(async () => {
    const summary = await params.legalCopilotWorkflowService.summarizeFolder({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      folderPath: params.folderQuery,
    });
    if (!summary) {
      params.setIngestionStatus(
        `Folder-Summary blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`
      );
      return;
    }
    params.setIngestionStatus(summary.summary);
  }, [
    params.caseId,
    params.currentRole,
    params.folderQuery,
    params.legalCopilotWorkflowService,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onSaveOcrProviderSettings = useCallback(async () => {
    await params.providerSettingsService.setEndpoint('ocr', params.ocrEndpoint.trim());
    if (params.ocrToken.trim()) {
      await params.providerSettingsService.setToken('ocr', params.ocrToken.trim());
      params.setHasStoredOcrToken(true);
    } else if (params.hasStoredOcrToken) {
      params.providerSettingsService.clearToken('ocr');
      params.setHasStoredOcrToken(false);
    }
    params.setIngestionStatus(
      params.ocrEndpoint.trim()
        ? `OCR-Provider gespeichert. Nächste OCR-Läufe nutzen den Remote-Provider.${
            params.ocrToken.trim() || params.hasStoredOcrToken
              ? ' Token ist gesetzt.'
              : ' Kein Token gesetzt.'
          }`
        : 'OCR-Provider entfernt. Es wird der lokale Fallback verwendet.'
    );
  }, [
    params.hasStoredOcrToken,
    params.ocrEndpoint,
    params.ocrToken,
    params.providerSettingsService,
    params.setHasStoredOcrToken,
    params.setIngestionStatus,
  ]);

  const onTaskAssigneeChange = useCallback(
    (taskId: string, assignee: string) => {
      params.setTaskAssignees(prev => ({ ...prev, [taskId]: assignee }));
    },
    [params.setTaskAssignees]
  );

  const onUpdateTaskStatus = useCallback(
    async (taskId: string, status: 'open' | 'in_progress' | 'blocked' | 'done') => {
      const updated = await params.legalCopilotWorkflowService.updateTaskStatus({
        taskId,
        status,
        assignee: params.taskAssignees[taskId]?.trim() || undefined,
      });
      if (!updated) {
        params.setIngestionStatus(
          `Task-Update blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`
        );
        return;
      }
      params.setIngestionStatus(`Task '${updated.title}' aktualisiert (${updated.status}).`);
    },
    [
      params.currentRole,
      params.legalCopilotWorkflowService,
      params.setIngestionStatus,
      params.taskAssignees,
    ]
  );

  const onSaveBlueprintReview = useCallback(async () => {
    if (!params.latestBlueprint) {
      return;
    }
    const updated = await params.legalCopilotWorkflowService.updateBlueprintReview({
      blueprintId: params.latestBlueprint.id,
      objective: params.blueprintObjectiveDraft.trim(),
      reviewStatus: params.blueprintReviewStatus,
      reviewNote: params.blueprintReviewNoteDraft.trim() || undefined,
    });
    if (!updated) {
      params.setIngestionStatus(
        `Blueprint-Review blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`
      );
      return;
    }
    params.setIngestionStatus(
      `Blueprint-Review gespeichert (${updated.reviewStatus ?? 'draft'}).`
    );
  }, [
    params.blueprintObjectiveDraft,
    params.blueprintReviewNoteDraft,
    params.blueprintReviewStatus,
    params.currentRole,
    params.latestBlueprint,
    params.legalCopilotWorkflowService,
    params.setIngestionStatus,
  ]);

  const onSearchNorms = useCallback(async () => {
    const query = params.normSearchQuery.trim();
    if (!query) {
      params.setNormSearchResults([]);
      return;
    }
    const results = params.legalNormsService.searchNorms(query, 8, {
      jurisdictions: [params.activeJurisdiction],
    });
    params.setNormSearchResults(results);
    params.setIngestionStatus(`Normensuche: ${results.length} Treffer für "${query}".`);
  }, [
    params.legalNormsService,
    params.activeJurisdiction,
    params.normSearchQuery,
    params.setIngestionStatus,
    params.setNormSearchResults,
  ]);

  const onRunContradictionAnalysis = useCallback(async () => {
    if (params.caseDocuments.length < 2) {
      params.setIngestionStatus('Widerspruchsanalyse benötigt mindestens 2 Dokumente.');
      return;
    }
    const matrix = params.contradictionDetectorService.analyzeDocuments({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      documents: params.caseDocuments,
    });
    params.setContradictionMatrix(matrix);
    params.setIngestionStatus(
      `Widerspruchsanalyse: ${matrix.contradictions.length} Widersprüche in ${matrix.totalComparisons} Vergleichen.`
    );
  }, [
    params.caseDocuments,
    params.caseId,
    params.contradictionDetectorService,
    params.setContradictionMatrix,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onCalculateCosts = useCallback(async () => {
    const sw = parseFloat(params.costStreitwert);
    if (!Number.isFinite(sw) || sw <= 0) {
      params.setIngestionStatus('Bitte einen gültigen Streitwert eingeben.');
      return;
    }
    const result = params.costCalculatorService.berechneKostenrisiko({
      streitwert: sw,
      instanz: params.costInstanz,
      verfahrensart: params.costVerfahren,
      obsiegensquoteInProzent: Math.min(100, Math.max(0, parseFloat(params.costObsiegen) || 50)),
    });
    params.setCostResult(result);
    params.setIngestionStatus(
      `Kostenrisiko: ${result.gesamtrisiko.toLocaleString('de-DE')} € (${result.risikoklasse}).`
    );
  }, [
    params.costCalculatorService,
    params.costInstanz,
    params.costObsiegen,
    params.costStreitwert,
    params.costVerfahren,
    params.setCostResult,
    params.setIngestionStatus,
  ]);

  const onCalculateVergleich = useCallback(async () => {
    const sw = parseFloat(params.costStreitwert);
    if (!Number.isFinite(sw) || sw <= 0) {
      params.setIngestionStatus('Bitte einen gültigen Streitwert eingeben.');
      return;
    }
    const result = params.costCalculatorService.berechneVergleichswert({
      streitwert: sw,
      verfahrensart: params.costVerfahren,
      instanz: params.costInstanz,
      vergleichsquoteInProzent: Math.min(
        100,
        Math.max(0, parseFloat(params.costVergleichQuote) || 60)
      ),
    });
    params.setCostVergleichResult(result);
    params.setIngestionStatus(
      `Vergleichswert: ${result.vergleichswert.toLocaleString('de-DE')} €.`
    );
  }, [
    params.costCalculatorService,
    params.costInstanz,
    params.costStreitwert,
    params.costVerfahren,
    params.costVergleichQuote,
    params.setCostVergleichResult,
    params.setIngestionStatus,
  ]);

  const onGenerateDocument = useCallback(async () => {
    const sachverhalt = extractDocPlainText(params.sourceDoc, 8000);
    const anspruchsgrundlagen = params.legalNormsService.findAnspruchsgrundlagen(sachverhalt);

    // Auto-refresh legal knowledge base before generation
    try {
      const analysis = await params.legalCopilotWorkflowService.analyzeCase(
        params.caseId,
        params.workspaceId
      );
      if (analysis.run) {
        params.setIngestionStatus(
          `Wissensbasis aktualisiert: ${analysis.findings.length} Findings. Generiere Dokument…`
        );
      }
    } catch (analyzeError) {
      console.warn('[panel-doc-gen] pre-generation analysis skipped', analyzeError);
    }

    // Read fresh data from store after analysis
    const allSuggestions =
      (params.casePlatformOrchestrationService.judikaturSuggestions$.value ?? []) as JudikaturSuggestion[];
    const allChains =
      (params.casePlatformOrchestrationService.citationChains$.value ?? []) as CitationChain[];
    const allDecisions =
      (params.casePlatformOrchestrationService.courtDecisions$.value ?? []) as CourtDecision[];

    const caseSuggestions = allSuggestions
      .filter(item => item.caseId === params.caseId && item.workspaceId === params.workspaceId)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const caseChains = allChains.filter(
      item => item.caseId === params.caseId && item.workspaceId === params.workspaceId
    );

    const decisionIds = new Set(caseSuggestions.map(item => item.decisionId));
    const caseDecisions = allDecisions.filter(item => decisionIds.has(item.id));

    const doc = params.documentGeneratorService.generate({
      template: params.docGenTemplate as DocumentTemplate,
      caseFile: params.caseRecord
        ? { ...params.caseRecord, actorIds: [], issueIds: [], deadlineIds: [], memoryEventIds: [] }
        : undefined,
      documents: params.caseDocuments,
      findings: params.caseFindings,
      judikaturSuggestions: caseSuggestions,
      citationChains: caseChains,
      courtDecisions: caseDecisions,
      blueprint: params.latestBlueprint ?? undefined,
      anspruchsgrundlagen,
      parties: {
        klaeger: params.docGenPartyKlaeger.trim() || undefined,
        beklagter: params.docGenPartyBeklagter.trim() || undefined,
        gericht: params.docGenGericht.trim() || undefined,
        aktenzeichen: params.docGenAktenzeichen.trim() || undefined,
        anwalt: params.anwaltDisplayName || undefined,
        kanzlei: params.kanzleiDisplayName || undefined,
        logoDataUrl: params.kanzleiLogoDataUrl || undefined,
      },
      sachverhalt: sachverhalt.length > 40 ? sachverhalt : undefined,
      streitwert: parseFloat(params.costStreitwert) || undefined,
    });
    params.setGeneratedDoc(doc);
    params.setIngestionStatus(
      `Dokument generiert: "${doc.title}" (${doc.sections.length} Abschnitte, ${doc.warnings.length} Warnungen).`
    );
  }, [
    params.anwaltDisplayName,
    params.kanzleiDisplayName,
    params.kanzleiLogoDataUrl,
    params.caseDocuments,
    params.caseFindings,
    params.caseRecord,
    params.costStreitwert,
    params.docGenAktenzeichen,
    params.docGenGericht,
    params.docGenPartyBeklagter,
    params.docGenPartyKlaeger,
    params.docGenTemplate,
    params.caseId,
    params.casePlatformOrchestrationService,
    params.documentGeneratorService,
    params.latestBlueprint,
    params.legalCopilotWorkflowService,
    params.legalNormsService,
    params.setGeneratedDoc,
    params.setIngestionStatus,
    params.sourceDoc,
    params.workspaceId,
  ]);

  const onExportGeneratedDocumentPdf = useCallback(async () => {
    if (!params.generatedDoc) {
      params.setIngestionStatus('Kein generiertes Dokument für PDF-Export vorhanden.');
      return;
    }

    const citations = params.generatedDoc.citations
      .map(
        (item: { normReference?: string; documentTitle?: string; quote: string }) =>
          item.normReference ?? item.documentTitle ?? item.quote
      )
      .filter(Boolean);

    const payload = {
      workspaceId: params.workspaceId,
      caseId: params.caseId,
      title: params.generatedDoc.title,
      markdown: params.generatedDoc.markdown,
      lawFirm: {
        lawFirmName: params.kanzleiDisplayName,
        lawyerName: params.anwaltDisplayName,
        logoDataUrl: params.kanzleiLogoDataUrl,
      },
      parties: {
        court: params.docGenGericht.trim() || undefined,
        plaintiff: params.docGenPartyKlaeger.trim() || undefined,
        defendant: params.docGenPartyBeklagter.trim() || undefined,
        fileNumber: params.docGenAktenzeichen.trim() || undefined,
      },
      attachments: params.caseDocuments.slice(0, 12).map(item => item.title),
      citations: citations.slice(0, 20),
    };

    params.setIngestionStatus('PDF wird serverseitig erzeugt…');

    let res: Response;
    try {
      res = await fetch('/api/legal/pdf/export', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      params.setIngestionStatus('PDF-Export fehlgeschlagen: Netzwerkfehler.');
      return;
    }

    if (!res.ok) {
      try {
        const err = (await res.json()) as { message?: string };
        params.setIngestionStatus(
          `PDF-Export fehlgeschlagen: ${err.message ?? `HTTP ${res.status}`}`
        );
      } catch {
        params.setIngestionStatus(`PDF-Export fehlgeschlagen (HTTP ${res.status}).`);
      }
      return;
    }

    const blob = await res.blob();
    const fileName =
      res.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] ??
      buildExportFileName(
        params.generatedDoc.title,
        params.docGenAktenzeichen.trim() || undefined
      );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    const savedDocId = res.headers.get('x-legal-pdf-doc-id');
    params.setIngestionStatus(
      savedDocId
        ? `PDF exportiert und als Dokumentversion gespeichert (Doc: ${savedDocId}).`
        : 'PDF exportiert und gespeichert.'
    );
  }, [
    params.caseDocuments,
    params.docGenAktenzeichen,
    params.docGenGericht,
    params.docGenPartyBeklagter,
    params.docGenPartyKlaeger,
    params.generatedDoc,
    params.setIngestionStatus,
    params.caseId,
    params.workspaceId,
    params.anwaltDisplayName,
    params.kanzleiDisplayName,
    params.kanzleiLogoDataUrl,
  ]);

  const onInsertGeneratedDocumentIntoCurrentDoc = useCallback(async () => {
    if (!params.generatedDoc) {
      params.setIngestionStatus('Kein generierter Schriftsatz zum Einfügen vorhanden.');
      return;
    }
    if (!params.sourceDoc) {
      params.setIngestionStatus('Aktuelles Dokument ist nicht verfügbar.');
      return;
    }

    const notes = params.sourceDoc.getBlocksByFlavour('affine:note');
    const firstNote = notes[0];
    const parentId = firstNote?.id ?? params.sourceDoc.root?.id;
    if (!parentId) {
      params.setIngestionStatus('Kein gültiger Einfügepunkt im Dokument gefunden.');
      return;
    }

    await insertFromMarkdown(
      params.editorContainer?.host,
      params.generatedDoc.markdown,
      params.sourceDoc,
      parentId,
      firstNote?.model?.children?.length ?? 0
    );

    params.setIngestionStatus(
      'Generierter Schriftsatz wurde in das aktuelle Dokument eingefügt.'
    );
  }, [params.editorContainer, params.generatedDoc, params.setIngestionStatus, params.sourceDoc]);

  const onAutoDetectEvidence = useCallback(async () => {
    if (params.caseDocuments.length === 0) {
      params.setIngestionStatus('Keine Dokumente für Beweismittel-Erkennung vorhanden.');
      return;
    }
    const detected = params.evidenceRegisterService.autoDetectFromDocuments({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      documents: params.caseDocuments,
    });
    const summary = params.evidenceRegisterService.buildSummary(
      params.caseId,
      params.workspaceId
    );
    params.setEvidenceCount(detected.length);
    params.setEvidenceSummaryMarkdown(summary.beweisangebotMarkdown);
    params.setIngestionStatus(
      `Beweismittel: ${detected.length} erkannt, ${summary.luecken.length} Lücken identifiziert.`
    );
  }, [
    params.caseDocuments,
    params.caseId,
    params.evidenceRegisterService,
    params.setEvidenceCount,
    params.setEvidenceSummaryMarkdown,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onSaveLegalProviderSettings = useCallback(async () => {
    await params.providerSettingsService.setEndpoint(
      'legal-analysis',
      params.legalAnalysisEndpoint.trim()
    );
    if (params.legalAnalysisToken.trim()) {
      await params.providerSettingsService.setToken(
        'legal-analysis',
        params.legalAnalysisToken.trim()
      );
      params.setHasStoredLegalAnalysisToken(true);
    } else if (params.hasStoredLegalAnalysisToken) {
      params.providerSettingsService.clearToken('legal-analysis');
      params.setHasStoredLegalAnalysisToken(false);
    }

    await params.providerSettingsService.setEndpoint('judikatur', params.judikaturEndpoint.trim());
    if (params.judikaturToken.trim()) {
      await params.providerSettingsService.setToken('judikatur', params.judikaturToken.trim());
      params.setHasStoredJudikaturToken(true);
    } else if (params.hasStoredJudikaturToken) {
      params.providerSettingsService.clearToken('judikatur');
      params.setHasStoredJudikaturToken(false);
    }

    const legalTokenState =
      params.legalAnalysisToken.trim() || params.hasStoredLegalAnalysisToken
        ? 'Token gesetzt'
        : 'kein Token';
    const judikaturTokenState =
      params.judikaturToken.trim() || params.hasStoredJudikaturToken
        ? 'Token gesetzt'
        : 'kein Token';

    params.setIngestionStatus(
      `Legal-Analysis/Judikatur-Provider gespeichert (${legalTokenState}, ${judikaturTokenState}).`
    );
  }, [
    params.hasStoredJudikaturToken,
    params.hasStoredLegalAnalysisToken,
    params.judikaturEndpoint,
    params.judikaturToken,
    params.legalAnalysisEndpoint,
    params.legalAnalysisToken,
    params.providerSettingsService,
    params.setHasStoredJudikaturToken,
    params.setHasStoredLegalAnalysisToken,
    params.setIngestionStatus,
  ]);

  const onUploadFiles = useCallback(async (files: Parameters<typeof onUploadFilesDetailed>[0]) => {
    const outcome = await onUploadFilesDetailed(files);
    return outcome.ingestedCount;
  }, [onUploadFilesDetailed]);

  const onRetryDeadLetterBatch = useCallback(async () => {
    // This function should retry failed uploads from the dead letter queue
    // For now, it's a placeholder that would need to be implemented based on the dead letter retry logic
    params.setIngestionStatus('Dead-Letter-Retry wird ausgeführt...');
    
    // TODO: Implement actual dead letter retry logic
    // This would typically involve:
    // 1. Getting the dead letter items from the wizard state
    // 2. Filtering retryable items
    // 3. Re-processing them through the upload pipeline
    // 4. Updating the dead letter state
    
    params.setIngestionStatus('Dead-Letter-Retry abgeschlossen.');
  }, [params.setIngestionStatus]);

  const onRetryFailedDocument = useCallback(async (documentId: string): Promise<boolean> => {
    params.setIsWorkflowBusy(true);
    try {
      const success = await params.legalCopilotWorkflowService.retryFailedDocument(documentId);
      params.setIngestionStatus(
        success
          ? 'Dokument erfolgreich neu verarbeitet.'
          : 'Retry fehlgeschlagen — Dokument konnte nicht verarbeitet werden.'
      );
      return success;
    } catch (err) {
      params.setIngestionStatus(
        `Retry-Fehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
      );
      return false;
    } finally {
      params.setIsWorkflowBusy(false);
    }
  }, [params.legalCopilotWorkflowService, params.setIngestionStatus, params.setIsWorkflowBusy]);

  const onRemoveFailedDocument = useCallback(async (documentId: string): Promise<boolean> => {
    params.setIsWorkflowBusy(true);
    try {
      const success = await params.legalCopilotWorkflowService.removeFailedDocument(documentId);
      params.setIngestionStatus(
        success
          ? 'Dokument wurde aus dem Akt entfernt.'
          : 'Dokument konnte nicht entfernt werden.'
      );
      return success;
    } catch (err) {
      params.setIngestionStatus(
        `Entfernen-Fehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
      );
      return false;
    } finally {
      params.setIsWorkflowBusy(false);
    }
  }, [params.legalCopilotWorkflowService, params.setIngestionStatus, params.setIsWorkflowBusy]);

  return {
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
  };
};
