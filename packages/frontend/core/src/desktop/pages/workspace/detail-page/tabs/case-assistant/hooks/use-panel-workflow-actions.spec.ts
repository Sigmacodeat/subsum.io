/**
 * @vitest-environment happy-dom
 */
import { act,renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { usePanelWorkflowActions } from './use-panel-workflow-actions';

function createBaseParams() {
  const setIsWorkflowBusy = vi.fn();
  const setIngestionStatus = vi.fn();
  const setFolderSearchCount = vi.fn();
  const mockHasStoredOcrTokenSetter = vi.fn();
  const setTaskAssignees = vi.fn();
  const setNormSearchResults = vi.fn();
  const setContradictionMatrix = vi.fn();
  const setCostResult = vi.fn();
  const setCostVergleichResult = vi.fn();
  const setGeneratedDoc = vi.fn();
  const setEvidenceCount = vi.fn();
  const setEvidenceSummaryMarkdown = vi.fn();
  const mockHasStoredLegalAnalysisTokenSetter = vi.fn();
  const mockHasStoredJudikaturTokenSetter = vi.fn();
  const setFolderQuery = vi.fn();

  const intakeDocuments = vi.fn();
  const processPendingOcr = vi.fn().mockResolvedValue([]);
  const retryFailedDocument = vi.fn();
  const removeFailedDocument = vi.fn();
  const analyzeCase = vi.fn();
  const runFullWorkflow = vi.fn();
  const searchFolder = vi.fn();
  const summarizeFolder = vi.fn();
  const saveBlueprintReview = vi.fn();
  const calculateCosts = vi.fn();
  const calculateVergleich = vi.fn();
  const generateDocument = vi.fn();
  const exportGeneratedDocumentPdf = vi.fn();
  const insertGeneratedDocumentIntoCurrentDoc = vi.fn();
  const autoDetectEvidence = vi.fn();
  const runContradictionAnalysis = vi.fn();

  const evaluatePermission = vi.fn().mockResolvedValue({
    ok: true,
    role: 'operator',
    requiredRole: null,
    message: '',
  });
  const setCurrentRole = vi.fn().mockResolvedValue(undefined);
  const enqueueIngestionJob = vi.fn().mockResolvedValue({ id: 'job-1' });
  const updateJobStatus = vi.fn().mockResolvedValue(undefined);

  const params = {
    caseId: 'case-1',
    workspaceId: 'ws-1',
    currentRole: 'viewer',
    sourceDoc: null,
    editorContainer: null,
    intakeDraft: {
      folderPath: '/akte/eingang',
      internalFileNumber: 'INT-42',
      tags: 'ocr,vertrag',
    },
    folderQuery: '',
    setFolderQuery,
    setFolderSearchCount,
    ocrEndpoint: 'https://ocr.example.test',
    ocrToken: 'token',
    normSearchQuery: '',
    setNormSearchResults,
    activeJurisdiction: 'DE',
    costStreitwert: '',
    costInstanz: 'erste_instanz',
    costVerfahren: 'zivilprozess',
    costObsiegen: '',
    costVergleichQuote: '',
    setCostResult,
    setCostVergleichResult,
    docGenTemplate: '',
    docGenPartyKlaeger: '',
    docGenPartyBeklagter: '',
    docGenGericht: '',
    docGenAktenzeichen: '',
    setGeneratedDoc,
    generatedDoc: null,
    caseDocuments: [],
    caseFindings: [],
    caseRecord: null,
    latestBlueprint: null,
    setContradictionMatrix,
    blueprintObjectiveDraft: '',
    blueprintReviewStatus: 'draft',
    blueprintReviewNoteDraft: '',
    taskAssignees: {},
    setTaskAssignees,
    setEvidenceCount,
    setEvidenceSummaryMarkdown,
    legalAnalysisEndpoint: '',
    legalAnalysisToken: '',
    judikaturEndpoint: '',
    judikaturToken: '',
    hasStoredOcrToken: false,
    setHasStoredOcrToken: mockHasStoredOcrTokenSetter,
    hasStoredLegalAnalysisToken: false,
    setHasStoredLegalAnalysisToken: mockHasStoredLegalAnalysisTokenSetter,
    hasStoredJudikaturToken: false,
    setHasStoredJudikaturToken: mockHasStoredJudikaturTokenSetter,
    kanzleiDisplayName: 'Kanzlei Test',
    anwaltDisplayName: 'RA Test',
    kanzleiLogoDataUrl: undefined,
    setIsWorkflowBusy,
    setIngestionStatus,
    legalCopilotWorkflowService: {
      intakeDocuments,
      processPendingOcr,
      retryFailedDocument,
      removeFailedDocument,
      analyzeCase,
      runFullWorkflow,
      searchFolder,
      summarizeFolder,
      saveBlueprintReview,
      calculateCosts,
      calculateVergleich,
      generateDocument,
      exportGeneratedDocumentPdf,
      insertGeneratedDocumentIntoCurrentDoc,
      autoDetectEvidence,
      runContradictionAnalysis,
      ['legalDocuments$']: { value: [] },
    },
    legalNormsService: {
      searchNorms: vi.fn(),
    },
    contradictionDetectorService: {
      analyzeContradictions: vi.fn(),
    },
    costCalculatorService: {
      calculateKostenrisiko: vi.fn(),
      calculateVergleichswert: vi.fn(),
    },
    documentGeneratorService: {
      generate: vi.fn(),
      exportPdf: vi.fn(),
    },
    evidenceRegisterService: {
      autoDetectEvidence: vi.fn(),
    },
    providerSettingsService: {
      setEndpoint: vi.fn(),
      setToken: vi.fn(),
      clearToken: vi.fn(),
    },
    casePlatformOrchestrationService: {
      evaluatePermission,
      setCurrentRole,
      enqueueIngestionJob,
      updateJobStatus,
    },
  } as any;

  return {
    params,
    spies: {
      intakeDocuments,
      processPendingOcr,
      analyzeCase,
      evaluatePermission,
      setCurrentRole,
      enqueueIngestionJob,
      updateJobStatus,
      setIsWorkflowBusy,
      setIngestionStatus,
    },
  };
}

describe('usePanelWorkflowActions upload intake consistency', () => {
  test('single-file upload auto-syncs operator role, forwards preflight metadata, and triggers background OCR', async () => {
    const { params, spies } = createBaseParams();
    spies.evaluatePermission
      .mockResolvedValueOnce({
        ok: false,
        role: 'viewer',
        requiredRole: 'operator',
        message: 'operator required',
      })
      .mockResolvedValueOnce({
        ok: true,
        role: 'operator',
        requiredRole: null,
        message: '',
      });
    spies.intakeDocuments.mockResolvedValueOnce([
      {
        id: 'doc-1',
        status: 'ocr_pending',
        processingStatus: 'extracting',
      },
    ]);

    const { result } = renderHook(() => usePanelWorkflowActions(params));

    let outcome:
      | Awaited<ReturnType<typeof result.current.onUploadFilesDetailed>>
      | undefined;
    await act(async () => {
      outcome = await result.current.onUploadFilesDetailed([
        {
          name: 'scan.png',
          size: 1024,
          kind: 'scan-pdf',
          content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
          mimeType: 'image/png',
          lastModifiedAt: '2026-03-06T10:00:00.000Z',
          pageCount: 1,
        },
      ]);
    });

    expect(outcome?.ingestedCount).toBe(1);
    expect(spies.setCurrentRole).toHaveBeenCalledWith('operator');
    expect(spies.intakeDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        workspaceId: 'ws-1',
        documents: [
          expect.objectContaining({
            title: 'scan.png',
            folderPath: '/akte/eingang',
            internalFileNumber: 'INT-42',
            tags: ['ocr', 'vertrag'],
            preflight: expect.objectContaining({
              routeDecision: 'ocr_queue',
              isBinaryPayload: true,
            }),
          }),
        ],
      })
    );
    expect(spies.setIngestionStatus).toHaveBeenCalledWith(
      expect.stringContaining(
        'Rolle wurde automatisch auf Operator synchronisiert'
      )
    );
    expect(spies.setIngestionStatus).toHaveBeenCalledWith(
      expect.stringContaining('1 Datei(en) erfolgreich aufgenommen.')
    );
    expect(spies.processPendingOcr).toHaveBeenCalledWith('case-1', 'ws-1', {
      ocrRunId: expect.stringMatching(/^ocr-run:/),
    });
    expect(spies.setIsWorkflowBusy).toHaveBeenCalledWith(true);
    expect(spies.setIsWorkflowBusy).toHaveBeenLastCalledWith(false);
  });

  test('batch upload creates ingestion job and marks job failed when one document fails', async () => {
    const { params, spies } = createBaseParams();
    spies.intakeDocuments.mockResolvedValueOnce([
      {
        id: 'doc-1',
        status: 'indexed',
        processingStatus: 'ready',
      },
      {
        id: 'doc-2',
        status: 'failed',
        processingStatus: 'failed',
      },
    ]);

    const { result } = renderHook(() => usePanelWorkflowActions(params));

    const validPdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQ=';

    let outcome:
      | Awaited<ReturnType<typeof result.current.onUploadFilesDetailed>>
      | undefined;
    await act(async () => {
      outcome = await result.current.onUploadFilesDetailed([
        {
          name: 'vertrag-a.pdf',
          size: 2048,
          kind: 'pdf',
          content: validPdfDataUrl,
          mimeType: 'application/pdf',
          lastModifiedAt: '2026-03-06T10:00:00.000Z',
          pageCount: 2,
        },
        {
          name: 'vertrag-b.pdf',
          size: 4096,
          kind: 'pdf',
          content: validPdfDataUrl,
          mimeType: 'application/pdf',
          lastModifiedAt: '2026-03-06T10:01:00.000Z',
          pageCount: 3,
        },
      ]);
    });

    expect(outcome?.ingestedCount).toBe(2);
    expect(outcome?.failedCount).toBe(1);
    expect(spies.enqueueIngestionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        workspaceId: 'ws-1',
        sourceType: 'upload',
      })
    );
    expect(spies.intakeDocuments).toHaveBeenCalledTimes(1);
    expect(spies.updateJobStatus).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'running',
        progress: 3,
      })
    );
    expect(spies.updateJobStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        status: 'failed',
        progress: 100,
        errorMessage: '1 Datei(en) fehlgeschlagen.',
      })
    );
    expect(spies.setIngestionStatus).toHaveBeenCalledWith(
      expect.stringContaining('1 Verarbeitung fehlgeschlagen.')
    );
  });

  test('onProcessOcr blocks cleanly when OCR endpoint is missing', async () => {
    const { params, spies } = createBaseParams();
    params.ocrEndpoint = '   ';
    params.caseDocuments = [
      {
        id: 'doc-ocr-1',
        caseId: 'case-1',
        workspaceId: 'ws-1',
        status: 'ocr_pending',
      },
    ];

    const { result } = renderHook(() => usePanelWorkflowActions(params));

    await act(async () => {
      await result.current.onProcessOcr();
    });

    expect(spies.processPendingOcr).not.toHaveBeenCalled();
    expect(spies.setIsWorkflowBusy).not.toHaveBeenCalledWith(true);
    expect(spies.setIngestionStatus).toHaveBeenCalledWith(
      expect.stringContaining('Remote OCR Provider ist nicht konfiguriert')
    );
  });

  test('onAnalyzeCase surfaces blocked analysis as status and error', async () => {
    const { params, spies } = createBaseParams();
    spies.analyzeCase = vi.fn().mockResolvedValue({
      run: null,
      blockedReason: 'no_indexed_documents',
      findings: [],
      tasks: [],
    });
    params.legalCopilotWorkflowService.analyzeCase = spies.analyzeCase;

    const { result } = renderHook(() => usePanelWorkflowActions(params));

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.onAnalyzeCase();
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      'analysis-blocked:no_indexed_documents'
    );
    expect(spies.analyzeCase).toHaveBeenCalledWith('case-1', 'ws-1');
    expect(spies.setIngestionStatus).toHaveBeenCalledWith(
      expect.stringContaining(
        'Analyse fehlgeschlagen: analysis-blocked:no_indexed_documents'
      )
    );
    expect(spies.setIsWorkflowBusy).toHaveBeenCalledWith(true);
    expect(spies.setIsWorkflowBusy).toHaveBeenLastCalledWith(false);
  });

  test('onRetryDeadLetterBatch remains a no-op for panel compatibility', async () => {
    const { params, spies } = createBaseParams();

    const { result } = renderHook(() => usePanelWorkflowActions(params));

    await act(async () => {
      await result.current.onRetryDeadLetterBatch();
    });

    expect(spies.intakeDocuments).not.toHaveBeenCalled();
    expect(spies.processPendingOcr).not.toHaveBeenCalled();
    expect(spies.setIngestionStatus).not.toHaveBeenCalled();
    expect(spies.setIsWorkflowBusy).not.toHaveBeenCalled();
  });
});
