import { describe, expect, test, vi } from 'vitest';

import type { DocumentProcessingResult } from '../services/document-processing';
import { LegalCopilotWorkflowService } from '../services/legal-copilot-workflow';
import type { SemanticChunk } from '../types';

vi.mock('@toeverything/infra', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Service: class {},
  };
});

function createProcessingResult(input: {
  documentId: string;
  caseId: string;
  workspaceId: string;
  processingStatus: DocumentProcessingResult['processingStatus'];
  extractionEngine?: string;
  chunks?: SemanticChunk[];
}): DocumentProcessingResult {
  return {
    extractedText: '',
    normalizedText: '',
    language: 'unknown',
    chunks: input.chunks ?? [],
    qualityReport: {
      documentId: input.documentId,
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      overallScore: input.processingStatus === 'failed' ? 0 : 85,
      ocrConfidence: 0,
      extractedPageCount: 1,
      totalChunks: (input.chunks ?? []).length,
      totalEntities: 0,
      problems: [],
      checklistItems: [],
      processedAt: new Date().toISOString(),
      processingDurationMs: 1,
    },
    processingStatus: input.processingStatus,
    extractionEngine: input.extractionEngine ?? 'binary-no-text',
    allEntities: {
      persons: [],
      organizations: [],
      dates: [],
      legalRefs: [],
      amounts: [],
      caseNumbers: [],
      addresses: [],
      ibans: [],
    },
    processingDurationMs: 1,
    contentFidelity: {
      extractedChars: 0,
      normalizedChars: 0,
      chunkCount: (input.chunks ?? []).length,
      totalChunkChars: 0,
      estimatedOverlapChars: 0,
      effectiveChunkChars: 0,
      fidelityRatio: 1,
      extractionYieldPerPage: input.processingStatus === 'failed' ? 0 : 120,
      suspiciousLowYield: false,
      suspiciousHighRatio: false,
      contentIntegrityOk: true,
    },
  };
}

describe('LegalCopilotWorkflowService OCR queueing', () => {
  const caseId = 'case-ocr-1';
  const workspaceId = 'ws-ocr-1';

  function createHarness() {
    const graph = {
      clients: {
        'client:ws-ocr-1:default': {
          id: 'client:ws-ocr-1:default',
          workspaceId,
          kind: 'other',
          displayName: 'Default Mandant',
          tags: [],
          archived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      matters: {
        'matter:ws-ocr-1:case-ocr-1': {
          id: 'matter:ws-ocr-1:case-ocr-1',
          workspaceId,
          clientId: 'client:ws-ocr-1:default',
          title: 'Testakte',
          status: 'open',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      cases: {
        [caseId]: {
          id: caseId,
          workspaceId,
          matterId: 'matter:ws-ocr-1:case-ocr-1',
          title: 'Case',
          actorIds: [],
          issueIds: [],
          deadlineIds: [],
          memoryEventIds: [],
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    };

    const orchestration: Record<string, unknown> = {
      evaluatePermission: vi
        .fn()
        .mockResolvedValue({ ok: true, role: 'operator', message: '' }),
      appendAuditEntry: vi.fn().mockResolvedValue(undefined),
      upsertLegalDocument: vi.fn().mockResolvedValue(undefined),
      upsertSemanticChunks: vi.fn().mockResolvedValue(undefined),
      upsertQualityReport: vi.fn().mockResolvedValue(undefined),
      upsertOcrJob: vi.fn().mockResolvedValue(undefined),
      upsertMatter: vi.fn().mockImplementation(async input => input),
      getGraph: vi.fn().mockResolvedValue(graph),
    };
    orchestration['legalDocuments$'] = { value: [] };
    orchestration['ocrJobs$'] = { value: [] };
    orchestration['legalFindings$'] = { value: [] };
    orchestration['copilotTasks$'] = { value: [] };
    orchestration['blueprints$'] = { value: [] };
    orchestration['copilotRuns$'] = { value: [] };
    orchestration['semanticChunks$'] = { value: [] };
    orchestration['qualityReports$'] = { value: [] };

    const documentProcessingService = {
      computeFingerprint: vi
        .fn()
        .mockImplementation((title: string) => `fp:${title}`),
      isDuplicate: vi.fn().mockReturnValue(null),
      processDocumentAsync: vi.fn(),
    };

    const creditGateway = {
      checkPageQuota: vi.fn().mockResolvedValue({ warning: null }),
      checkAiCredits: vi
        .fn()
        .mockResolvedValue({ allowed: true, message: null }),
      consumeAiCredits: vi
        .fn()
        .mockResolvedValue({ success: true, message: null }),
      recordPageUsage: vi.fn().mockResolvedValue(undefined),
    };

    const jurisdictionService = {
      detectFromText: vi.fn().mockReturnValue({
        jurisdiction: 'DE',
        confidence: 0.8,
        signals: [],
      }),
    };

    const residencyPolicyService = {
      assertCapabilityAllowed: vi.fn().mockResolvedValue({
        ok: true,
        policy: {
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
          updatedAt: new Date().toISOString(),
        },
      }),
    };

    const providerSettingsService = {
      getEndpoint: vi.fn().mockResolvedValue('https://ocr.example.test/v1/ocr'),
      getToken: vi.fn().mockResolvedValue('test-token'),
    };

    if (!globalThis.crypto) {
      (globalThis as unknown as { crypto?: unknown }).crypto = {
        subtle: {
          digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        },
      };
    }

    const blobs = new Map<string, { data: Uint8Array; mime: string }>();
    const workspaceService = {
      workspace: {
        engine: {
          blob: {
            set: vi
              .fn()
              .mockImplementation(
                async (input: {
                  key: string;
                  data: Uint8Array;
                  mime: string;
                }) => {
                  blobs.set(input.key, { data: input.data, mime: input.mime });
                  return input.key;
                }
              ),
            get: vi.fn().mockImplementation(async (key: string) => {
              const found = blobs.get(key);
              return found ? { data: found.data, mime: found.mime } : null;
            }),
          },
        },
      },
    };

    const ragSync = {
      syncChunksToBackend: vi.fn().mockResolvedValue(undefined),
      syncAndVerifyChunks: vi.fn().mockResolvedValue({
        ok: true,
        expectedCount: 1,
        persistedCount: 1,
        withEmbeddingCount: 1,
        matchedCount: 1,
        missingChunkIndexes: [],
        hashMismatchIndexes: [],
        lengthMismatchIndexes: [],
        sourceHashMatched: true,
        expectedSourceHash: 'source-hash',
        persistedSourceHash: 'source-hash',
        coverage: 1,
      }),
      isBackendAvailable: true,
    };

    const service = new LegalCopilotWorkflowService(
      orchestration as any,
      workspaceService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      providerSettingsService as any,
      residencyPolicyService as any,
      documentProcessingService as any,
      jurisdictionService as any,
      {} as any,
      {} as any,
      creditGateway as any,
      ragSync as any,
      {} as any
    );

    return {
      service,
      orchestration,
      creditGateway,
      documentProcessingService,
      residencyPolicyService,
      providerSettingsService,
      workspaceService,
      ragSync,
    };
  }

  test('analyzeCase returns blockedReason no_indexed_documents when no indexed docs are present', async () => {
    const { service } = createHarness();

    const result = await service.analyzeCase(caseId, workspaceId);

    expect(result.run).toBeNull();
    expect(result.blockedReason).toBe('no_indexed_documents');
  });

  test('analyzeCase returns blockedReason insufficient_credits when AI credits are missing', async () => {
    const { service, orchestration, creditGateway } = createHarness();
    const now = new Date().toISOString();

    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-analyze-credits-1',
        caseId,
        workspaceId,
        title: 'Analyse-Dokument',
        kind: 'pdf',
        status: 'indexed',
        rawText: 'Kurztext',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    creditGateway.checkAiCredits.mockResolvedValueOnce({
      allowed: false,
      message: 'Nicht genügend AI-Credits',
    });

    const result = await service.analyzeCase(caseId, workspaceId);

    expect(result.run).toBeNull();
    expect(result.blockedReason).toBe('insufficient_credits');
  });

  test('analyzeCase returns blockedReason permission_denied when permission check fails', async () => {
    const { service, orchestration } = createHarness();
    const now = new Date().toISOString();

    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-analyze-permission-1',
        caseId,
        workspaceId,
        title: 'Analyse-Dokument',
        kind: 'pdf',
        status: 'indexed',
        rawText: 'Kurztext',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    (
      orchestration.evaluatePermission as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      ok: false,
      role: 'viewer',
      message: 'Denied',
    });

    const result = await service.analyzeCase(caseId, workspaceId);

    expect(result.run).toBeNull();
    expect(result.blockedReason).toBe('permission_denied');
  });

  test('does not enqueue OCR for failed non-OCR-eligible base64 file (xlsx)', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-xlsx-failed',
        caseId,
        workspaceId,
        processingStatus: 'failed',
      })
    );

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-xlsx-failed',
          title: 'beweise.xlsx',
          kind: 'other',
          content:
            'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,AAAA',
          sourceMimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          sourceRef: 'upload:xlsx',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('failed');
    expect(orchestration.upsertOcrJob).not.toHaveBeenCalled();
  });

  test('enqueues OCR for failed OCR-eligible scan/image upload', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-scan-failed',
        caseId,
        workspaceId,
        processingStatus: 'failed',
      })
    );

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-scan-failed',
          title: 'scan-akte.png',
          kind: 'scan-pdf',
          content: 'data:image/png;base64,AAAA',
          sourceMimeType: 'image/png',
          sourceRef: 'upload:scan',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('ocr_pending');
    expect(orchestration.upsertOcrJob).toHaveBeenCalledTimes(1);
  });

  test('blocks OCR enqueue when remote OCR is forbidden by residency policy', async () => {
    const {
      service,
      orchestration,
      documentProcessingService,
      residencyPolicyService,
    } = createHarness();

    residencyPolicyService.assertCapabilityAllowed.mockResolvedValue({
      ok: false,
      reason:
        'Remote OCR ist durch die Workspace-Residency-Policy deaktiviert.',
      policy: {
        workspaceId,
        mode: 'local_only',
        allowCloudSync: false,
        allowRemoteOcr: false,
        allowExternalConnectors: false,
        allowTelemetry: false,
        requireMfaForAdmins: true,
        requireMfaForMembers: false,
        enforceEncryptionAtRest: true,
        sessionIdleTimeoutMinutes: 30,
        updatedAt: new Date().toISOString(),
      },
    });

    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-scan-blocked',
        caseId,
        workspaceId,
        processingStatus: 'failed',
      })
    );

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-scan-blocked',
          title: 'scan-gesperrt.png',
          kind: 'scan-pdf',
          content: 'data:image/png;base64,AAAA',
          sourceMimeType: 'image/png',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('failed');
    expect(orchestration.upsertOcrJob).not.toHaveBeenCalled();
    expect(orchestration.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.ocr.blocked_by_residency_policy',
        severity: 'warning',
      })
    );
  });

  test('intakeDocuments marks document ragIndexed true when backend verify succeeds', async () => {
    const { service, orchestration, documentProcessingService, ragSync } =
      createHarness();
    const now = new Date().toISOString();

    const chunks: SemanticChunk[] = [
      {
        id: 'chunk-rag-ok-1',
        documentId: 'doc-rag-ok-1',
        caseId,
        workspaceId,
        index: 0,
        text: '§ 433 BGB Kaufvertrag und Zahlungsanspruch.',
        category: 'rechtsausfuehrung',
        keywords: ['433', 'kaufvertrag'],
        qualityScore: 0.93,
        extractedEntities: {
          persons: [],
          organizations: [],
          dates: [],
          legalRefs: ['§ 433 BGB'],
          amounts: [],
          caseNumbers: [],
          addresses: [],
          ibans: [],
        },
        createdAt: now,
      },
    ];

    documentProcessingService.processDocumentAsync.mockResolvedValue({
      ...createProcessingResult({
        documentId: 'doc-rag-ok-1',
        caseId,
        workspaceId,
        processingStatus: 'ready',
        extractionEngine: 'pdf-text',
        chunks,
      }),
      normalizedText: '§ 433 BGB Kaufvertrag und Zahlungsanspruch.',
    });

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-rag-ok-1',
          title: 'kaufvertrag.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,AAAA',
          sourceMimeType: 'application/pdf',
          sourceRef: 'upload:kaufvertrag',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(ragSync.syncAndVerifyChunks).toHaveBeenCalledWith(
      workspaceId,
      caseId,
      'doc-rag-ok-1',
      chunks,
      '§ 433 BGB Kaufvertrag und Zahlungsanspruch.'
    );

    await Promise.resolve();

    expect(orchestration.upsertLegalDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-rag-ok-1',
        ragIndexed: true,
      }),
      expect.objectContaining({ skipWorkflowEvent: true })
    );
  });

  test('intakeDocuments marks document ragIndexed false and audits when backend verify fails', async () => {
    const { service, orchestration, documentProcessingService, ragSync } =
      createHarness();
    const now = new Date().toISOString();

    const chunks: SemanticChunk[] = [
      {
        id: 'chunk-rag-fail-1',
        documentId: 'doc-rag-fail-1',
        caseId,
        workspaceId,
        index: 0,
        text: 'Mahnung mit Fristsetzung bis zum 10.03.2026.',
        category: 'sachverhalt',
        keywords: ['mahnung', 'fristsetzung'],
        qualityScore: 0.88,
        extractedEntities: {
          persons: [],
          organizations: [],
          dates: ['10.03.2026'],
          legalRefs: [],
          amounts: [],
          caseNumbers: [],
          addresses: [],
          ibans: [],
        },
        createdAt: now,
      },
    ];

    ragSync.syncAndVerifyChunks.mockResolvedValueOnce({
      ok: false,
      expectedCount: 1,
      persistedCount: 0,
      withEmbeddingCount: 0,
      matchedCount: 0,
      missingChunkIndexes: [0],
      hashMismatchIndexes: [],
      lengthMismatchIndexes: [],
      sourceHashMatched: false,
      expectedSourceHash: 'expected-hash',
      persistedSourceHash: 'persisted-hash',
      coverage: 0,
    });

    documentProcessingService.processDocumentAsync.mockResolvedValue({
      ...createProcessingResult({
        documentId: 'doc-rag-fail-1',
        caseId,
        workspaceId,
        processingStatus: 'ready',
        extractionEngine: 'pdf-text',
        chunks,
      }),
      normalizedText: 'Mahnung mit Fristsetzung bis zum 10.03.2026.',
    });

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-rag-fail-1',
          title: 'mahnung.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,BBBB',
          sourceMimeType: 'application/pdf',
          sourceRef: 'upload:mahnung',
        },
      ],
    });

    expect(records).toHaveLength(1);

    await Promise.resolve();

    expect(orchestration.upsertLegalDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-rag-fail-1',
        ragIndexed: false,
      }),
      expect.objectContaining({ skipWorkflowEvent: true })
    );
    expect(orchestration.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.rag.verify_failed',
        severity: 'warning',
        metadata: expect.objectContaining({
          documentId: 'doc-rag-fail-1',
          expectedCount: '1',
          persistedCount: '0',
          matchedCount: '0',
          sourceHashMatched: 'false',
        }),
      })
    );
  });

  test('intakeDocuments audits when backend verify is unavailable', async () => {
    const { service, orchestration, documentProcessingService, ragSync } =
      createHarness();
    const now = new Date().toISOString();

    const chunks: SemanticChunk[] = [
      {
        id: 'chunk-rag-unavailable-1',
        documentId: 'doc-rag-unavailable-1',
        caseId,
        workspaceId,
        index: 0,
        text: 'Beweisfoto mit OCR-erkanntem Vermerk.',
        category: 'beweis',
        keywords: ['beweisfoto', 'ocr'],
        qualityScore: 0.81,
        extractedEntities: {
          persons: [],
          organizations: [],
          dates: [],
          legalRefs: [],
          amounts: [],
          caseNumbers: [],
          addresses: [],
          ibans: [],
        },
        createdAt: now,
      },
    ];

    ragSync.syncAndVerifyChunks.mockResolvedValueOnce(null);

    documentProcessingService.processDocumentAsync.mockResolvedValue({
      ...createProcessingResult({
        documentId: 'doc-rag-unavailable-1',
        caseId,
        workspaceId,
        processingStatus: 'ready',
        extractionEngine: 'remote-ocr',
        chunks,
      }),
      normalizedText: 'Beweisfoto mit OCR-erkanntem Vermerk.',
    });

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-rag-unavailable-1',
          title: 'beweisfoto.png',
          kind: 'pdf',
          content: 'data:application/pdf;base64,Q0NDQw==',
          sourceMimeType: 'application/pdf',
          sourceRef: 'upload:beweisfoto',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(ragSync.syncAndVerifyChunks).toHaveBeenCalledWith(
      workspaceId,
      caseId,
      'doc-rag-unavailable-1',
      chunks,
      'Beweisfoto mit OCR-erkanntem Vermerk.'
    );

    await Promise.resolve();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(orchestration.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.rag.verify_unavailable',
        severity: 'warning',
        metadata: expect.objectContaining({
          documentId: 'doc-rag-unavailable-1',
          title: 'beweisfoto.png',
        }),
      })
    );
  });

  test('intakeDocuments does not enqueue OCR for encrypted PDFs and returns failed record', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-pdf-encrypted-1',
        caseId,
        workspaceId,
        processingStatus: 'failed',
        extractionEngine: 'pdf-encrypted',
      })
    );

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-pdf-encrypted-1',
          title: 'schutz.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,RU5DUllQVEVE',
          sourceMimeType: 'application/pdf',
          sourceRef: 'upload:encrypted',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('failed');
    expect(records[0].processingStatus).toBe('failed');
    expect(orchestration.upsertOcrJob).not.toHaveBeenCalled();
    expect(orchestration.upsertLegalDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-pdf-encrypted-1',
        status: 'failed',
        extractionEngine: 'pdf-encrypted',
      })
    );
  });

  test('intakeDocuments routes PDF without text layer into OCR queue', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-pdf-no-text-1',
        caseId,
        workspaceId,
        processingStatus: 'failed',
        extractionEngine: 'pdf-no-text-layer',
      })
    );

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-pdf-no-text-1',
          title: 'scan-ohne-textlayer.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,Tk9fVEVYVF9MQVlFUg==',
          sourceMimeType: 'application/pdf',
          sourceRef: 'upload:no-text-layer',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('ocr_pending');
    expect(records[0].processingStatus).toBe('extracting');
    expect(orchestration.upsertOcrJob).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-pdf-no-text-1',
        status: 'queued',
      })
    );
  });

  test('intakeDocuments audits fidelity warnings for low-yield OCR results', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();
    const now = new Date().toISOString();

    const chunks: SemanticChunk[] = [
      {
        id: 'chunk-fidelity-1',
        documentId: 'doc-fidelity-1',
        caseId,
        workspaceId,
        index: 0,
        text: 'Kurztext',
        category: 'beweis',
        keywords: ['ocr'],
        qualityScore: 0.4,
        extractedEntities: {
          persons: [],
          organizations: [],
          dates: [],
          legalRefs: [],
          amounts: [],
          caseNumbers: [],
          addresses: [],
          ibans: [],
        },
        createdAt: now,
      },
    ];

    documentProcessingService.processDocumentAsync.mockResolvedValue({
      ...createProcessingResult({
        documentId: 'doc-fidelity-1',
        caseId,
        workspaceId,
        processingStatus: 'needs_review',
        extractionEngine: 'remote-ocr',
        chunks,
      }),
      normalizedText: 'Kurztext',
      contentFidelity: {
        extractedChars: 8,
        normalizedChars: 8,
        chunkCount: 1,
        totalChunkChars: 8,
        estimatedOverlapChars: 0,
        effectiveChunkChars: 8,
        fidelityRatio: 0.58,
        extractionYieldPerPage: 12,
        suspiciousLowYield: true,
        suspiciousHighRatio: false,
        contentIntegrityOk: false,
      },
    });

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-fidelity-1',
          title: 'schlechter-scan.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,TE9XX1lJRUxE',
          sourceMimeType: 'application/pdf',
          sourceRef: 'upload:low-yield',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].processingStatus).toBe('needs_review');
    expect(orchestration.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.fidelity.warning',
        severity: 'warning',
        metadata: expect.objectContaining({
          documentId: 'doc-fidelity-1',
          extractionEngine: 'remote-ocr',
        }),
      })
    );
  });

  test('intakeDocuments marks document failed when semantic chunk persistence fails', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();
    const now = new Date().toISOString();

    const chunks: SemanticChunk[] = [
      {
        id: 'chunk-persist-fail-1',
        documentId: 'doc-persist-fail-1',
        caseId,
        workspaceId,
        index: 0,
        text: 'Relevanter Vertragsinhalt.',
        category: 'vertrag',
        keywords: ['vertrag'],
        qualityScore: 0.91,
        extractedEntities: {
          persons: [],
          organizations: [],
          dates: [],
          legalRefs: [],
          amounts: [],
          caseNumbers: [],
          addresses: [],
          ibans: [],
        },
        createdAt: now,
      },
    ];

    documentProcessingService.processDocumentAsync.mockResolvedValue({
      ...createProcessingResult({
        documentId: 'doc-persist-fail-1',
        caseId,
        workspaceId,
        processingStatus: 'ready',
        extractionEngine: 'pdf-text',
        chunks,
      }),
      normalizedText: 'Relevanter Vertragsinhalt.',
    });
    orchestration.upsertSemanticChunks = vi
      .fn()
      .mockRejectedValue(new Error('disk full'));

    const records = await service.intakeDocuments({
      caseId,
      workspaceId,
      documents: [
        {
          id: 'doc-persist-fail-1',
          title: 'vertrag.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,Q0hVTktfRkFJTA==',
          sourceMimeType: 'application/pdf',
          sourceRef: 'upload:vertrag',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('failed');
    expect(records[0].processingStatus).toBe('failed');
    expect(
      (orchestration.upsertLegalDocument as any).mock.calls.some(
        ([payload]: [
          {
            id: string;
            status: string;
            processingStatus: string;
            processingError?: string;
          },
        ]) =>
          payload.id === 'doc-persist-fail-1' &&
          payload.status === 'failed' &&
          payload.processingStatus === 'failed' &&
          (payload.processingError ?? '').includes(
            'Semantic chunk persistence failed'
          )
      )
    ).toBe(true);
    expect(orchestration.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.semantic_chunks.persist_failed',
        severity: 'warning',
        metadata: expect.objectContaining({
          documentId: 'doc-persist-fail-1',
          error: 'disk full',
        }),
      })
    );
  });

  test('processPendingOcr retries transient remote OCR failures and sets deterministic fallback error reason', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    const now = new Date().toISOString();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-ocr-timeout-1',
        caseId,
        workspaceId,
        title: 'scan-timeout.png',
        kind: 'scan-pdf',
        status: 'ocr_pending',
        rawText: 'data:image/png;base64,AAAA',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    (orchestration['ocrJobs$'] as { value: unknown[] }).value = [
      {
        id: 'ocr-job-timeout-1',
        caseId,
        workspaceId,
        documentId: 'doc-ocr-timeout-1',
        status: 'queued',
        progress: 0,
        engine: 'remote-ocr',
        queuedAt: now,
        updatedAt: now,
      },
    ];

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('network timeout'));
    vi.stubGlobal('fetch', fetchMock);

    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-ocr-timeout-1',
        caseId,
        workspaceId,
        processingStatus: 'failed',
        extractionEngine: 'binary-no-text',
      })
    );

    try {
      const completed = await service.processPendingOcr(caseId, workspaceId);
      expect(completed).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const finalFailedUpdate = (orchestration.upsertOcrJob as any).mock.calls
        .map((call: [Record<string, unknown>]) => call[0])
        .reverse()
        .find(
          (payload: Record<string, unknown>) => payload.status === 'failed'
        );

      expect(finalFailedUpdate).toEqual(
        expect.objectContaining({
          documentId: 'doc-ocr-timeout-1',
          errorMessage:
            'Remote OCR nicht erreichbar/timeout; lokaler Fallback konnte das Dokument nicht extrahieren.',
        })
      );
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  test('processPendingOcr requeues failed OCR-eligible docs without active OCR jobs', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    const now = new Date().toISOString();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-failed-retry-1',
        caseId,
        workspaceId,
        title: 'scan-retry.pdf',
        kind: 'scan-pdf',
        status: 'failed',
        rawText: 'data:application/pdf;base64,AAAA',
        sourceMimeType: 'application/pdf',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    (orchestration['ocrJobs$'] as { value: unknown[] }).value = [
      {
        id: 'ocr-old-failed-1',
        caseId,
        workspaceId,
        documentId: 'doc-failed-retry-1',
        status: 'failed',
        progress: 100,
        engine: 'remote-ocr',
        queuedAt: now,
        updatedAt: now,
      },
    ];

    (service as any).performOcr = vi.fn().mockResolvedValue({
      text: 'OCR neu erkannt.',
      language: 'de',
      qualityScore: 0.9,
      pageCount: 1,
      engine: 'remote-ocr',
    });
    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-failed-retry-1',
        caseId,
        workspaceId,
        processingStatus: 'ready',
        extractionEngine: 'remote-ocr',
      })
    );

    const completed = await service.processPendingOcr(caseId, workspaceId);

    expect(completed).toHaveLength(1);
    expect(completed[0].documentId).toBe('doc-failed-retry-1');

    expect(orchestration.upsertOcrJob).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-failed-retry-1',
        status: 'queued',
      })
    );
    expect(
      (orchestration.upsertLegalDocument as any).mock.calls.some(
        ([payload]: [{ id: string; status: string }]) =>
          payload.id === 'doc-failed-retry-1' &&
          payload.status === 'ocr_pending'
      )
    ).toBe(true);
    expect(
      (orchestration.upsertLegalDocument as any).mock.calls.some(
        ([payload]: [{ id: string; status: string }]) =>
          payload.id === 'doc-failed-retry-1' && payload.status === 'indexed'
      )
    ).toBe(true);
  });

  test('processPendingOcr continues remaining jobs when one OCR job crashes', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    const now = new Date().toISOString();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-ocr-1',
        caseId,
        workspaceId,
        title: 'scan-1.png',
        kind: 'scan-pdf',
        status: 'ocr_pending',
        rawText: 'data:image/png;base64,AAAA',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc-ocr-2',
        caseId,
        workspaceId,
        title: 'scan-2.png',
        kind: 'scan-pdf',
        status: 'ocr_pending',
        rawText: 'data:image/png;base64,BBBB',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    (orchestration['ocrJobs$'] as { value: unknown[] }).value = [
      {
        id: 'ocr-job-1',
        caseId,
        workspaceId,
        documentId: 'doc-ocr-1',
        status: 'queued',
        progress: 0,
        engine: 'remote-ocr',
        queuedAt: now,
        updatedAt: now,
      },
      {
        id: 'ocr-job-2',
        caseId,
        workspaceId,
        documentId: 'doc-ocr-2',
        status: 'queued',
        progress: 0,
        engine: 'remote-ocr',
        queuedAt: now,
        updatedAt: now,
      },
    ];

    (service as any).performOcr = vi
      .fn()
      .mockRejectedValueOnce(new Error('OCR provider timeout'))
      .mockResolvedValueOnce({
        text: 'Das ist erkannter OCR-Text.',
        language: 'de',
        qualityScore: 0.92,
        pageCount: 1,
        engine: 'remote-ocr',
      });

    documentProcessingService.processDocumentAsync.mockResolvedValue(
      createProcessingResult({
        documentId: 'doc-ocr-2',
        caseId,
        workspaceId,
        processingStatus: 'ready',
        extractionEngine: 'remote-ocr',
      })
    );

    const completed = await service.processPendingOcr(caseId, workspaceId);

    expect(completed).toHaveLength(1);
    expect(completed[0].documentId).toBe('doc-ocr-2');

    const ocrUpdates = (orchestration.upsertOcrJob as any).mock.calls.map(
      (call: [Record<string, unknown>]) => call[0]
    );
    const queuedRetry = ocrUpdates.find(
      (update: Record<string, unknown>) =>
        update.status === 'queued' && (update.retryAttempt as number) === 1
    );
    expect(queuedRetry).toBeTruthy();
    expect(
      ocrUpdates.some(
        (update: Record<string, unknown>) => update.status === 'completed'
      )
    ).toBe(true);

    const retryAudit = (orchestration.appendAuditEntry as any).mock.calls
      .map((call: [Record<string, unknown>]) => call[0])
      .find(
        (entry: Record<string, unknown>) =>
          entry.action === 'document.ocr.retry_scheduled'
      );
    expect(retryAudit).toEqual(
      expect.objectContaining({
        action: 'document.ocr.retry_scheduled',
        severity: 'warning',
      })
    );
  });

  test('processPendingOcr survives high-volume mixed OCR failures and completes remaining jobs', async () => {
    const { service, orchestration, documentProcessingService } =
      createHarness();

    const now = new Date().toISOString();
    const totalJobs = 60;
    const failingIndexes = new Set([7, 13, 21, 34, 55]);

    (orchestration['legalDocuments$'] as { value: unknown[] }).value =
      Array.from({ length: totalJobs }, (_, i) => ({
        id: `doc-load-${i}`,
        caseId,
        workspaceId,
        title: `scan-${i}.png`,
        kind: 'scan-pdf',
        status: 'ocr_pending',
        rawText: `data:image/png;base64,${i}`,
        tags: [],
        createdAt: now,
        updatedAt: now,
      }));

    (orchestration['ocrJobs$'] as { value: unknown[] }).value = Array.from(
      { length: totalJobs },
      (_, i) => ({
        id: `ocr-job-load-${i}`,
        caseId,
        workspaceId,
        documentId: `doc-load-${i}`,
        status: 'queued',
        progress: 0,
        engine: 'remote-ocr',
        queuedAt: now,
        updatedAt: now,
      })
    );

    (service as any).performOcr = vi
      .fn()
      .mockImplementation(async (doc: { id: string }) => {
        const index = Number(doc.id.replace('doc-load-', ''));
        if (failingIndexes.has(index)) {
          throw new Error(
            index % 2 === 0 ? 'OCR provider timeout' : 'OCR provider crashed'
          );
        }
        return {
          text: `Erkannter OCR-Text ${index}`,
          language: 'de',
          qualityScore: 0.9,
          pageCount: 1,
          engine: 'remote-ocr',
        };
      });

    documentProcessingService.processDocumentAsync.mockImplementation(
      async (input: { documentId: string }) =>
        createProcessingResult({
          documentId: input.documentId,
          caseId,
          workspaceId,
          processingStatus: 'ready',
          extractionEngine: 'remote-ocr',
        })
    );

    const completed = await service.processPendingOcr(caseId, workspaceId);

    expect(completed).toHaveLength(totalJobs - failingIndexes.size);

    const ocrPayloads = (orchestration.upsertOcrJob as any).mock.calls.map(
      (call: [{ status: string; errorMessage?: string }]) => call[0]
    );
    const retryQueuedUpdates = ocrPayloads.filter(
      (update: { status: string; retryAttempt?: number }) =>
        update.status === 'queued' && (update.retryAttempt ?? 0) > 0
    );
    const completedFinalUpdates = ocrPayloads.filter(
      (update: { status: string }) => update.status === 'completed'
    );

    expect(retryQueuedUpdates.length).toBe(failingIndexes.size);
    expect(completedFinalUpdates.length).toBe(totalJobs - failingIndexes.size);

    const retryAudits = (orchestration.appendAuditEntry as any).mock.calls
      .map((call: [Record<string, unknown>]) => call[0])
      .filter(
        (entry: Record<string, unknown>) =>
          entry.action === 'document.ocr.retry_scheduled'
      );

    expect(retryAudits).toHaveLength(failingIndexes.size);
    expect(
      retryAudits.every(
        (entry: Record<string, unknown>) => entry.severity === 'warning'
      )
    ).toBe(true);
  });

  test('processPendingOcr marks stale queued jobs as failed via watchdog and writes audit trail', async () => {
    const { service, orchestration } = createHarness();

    const oldIso = new Date(Date.now() - 31 * 60_000).toISOString();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-stale-queued-1',
        caseId,
        workspaceId,
        title: 'stale-queued.pdf',
        kind: 'scan-pdf',
        status: 'ocr_pending',
        rawText: 'data:application/pdf;base64,AAAA',
        tags: [],
        createdAt: oldIso,
        updatedAt: oldIso,
      },
    ];
    (orchestration['ocrJobs$'] as { value: unknown[] }).value = [
      {
        id: 'ocr-stale-queued-1',
        caseId,
        workspaceId,
        documentId: 'doc-stale-queued-1',
        status: 'queued',
        progress: 0,
        engine: 'remote-ocr',
        queuedAt: oldIso,
        updatedAt: oldIso,
      },
    ];

    (service as any).performOcr = vi.fn();

    const completed = await service.processPendingOcr(caseId, workspaceId);

    expect(completed).toEqual([]);
    expect((service as any).performOcr).not.toHaveBeenCalled();
    expect(orchestration.upsertOcrJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ocr-stale-queued-1',
        status: 'failed',
        errorMessage:
          'OCR-Job zu lange in Warteschlange ohne Start (Watchdog-Abbruch).',
      })
    );

    const staleAudit = (orchestration.appendAuditEntry as any).mock.calls
      .map((call: [Record<string, unknown>]) => call[0])
      .find(
        (entry: Record<string, unknown>) =>
          entry.action === 'document.ocr.stale_job_failed'
      );
    expect(staleAudit).toEqual(
      expect.objectContaining({
        severity: 'warning',
        metadata: expect.objectContaining({
          jobId: 'ocr-stale-queued-1',
          documentId: 'doc-stale-queued-1',
          staleKind: 'queued',
        }),
      })
    );
  });

  test('processPendingOcr writes structured failure audit with timeout classification on crash', async () => {
    const { service, orchestration } = createHarness();

    const now = new Date().toISOString();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-crash-timeout-1',
        caseId,
        workspaceId,
        title: 'timeout-crash.pdf',
        kind: 'scan-pdf',
        status: 'ocr_pending',
        rawText: 'data:application/pdf;base64,BBBB',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    (orchestration['ocrJobs$'] as { value: unknown[] }).value = [
      {
        id: 'ocr-crash-timeout-1',
        caseId,
        workspaceId,
        documentId: 'doc-crash-timeout-1',
        status: 'queued',
        progress: 0,
        engine: 'remote-ocr',
        retryAttempt: 4,
        queuedAt: now,
        updatedAt: now,
      },
    ];

    (service as any).performOcr = vi
      .fn()
      .mockRejectedValue(new Error('OCR timeout while waiting for provider'));

    const completed = await service.processPendingOcr(caseId, workspaceId);
    expect(completed).toEqual([]);

    const failedAudit = (orchestration.appendAuditEntry as any).mock.calls
      .map((call: [Record<string, unknown>]) => call[0])
      .find(
        (entry: Record<string, unknown>) =>
          entry.action === 'document.ocr.failed'
      );

    expect(failedAudit).toEqual(
      expect.objectContaining({
        severity: 'error',
        metadata: expect.objectContaining({
          jobId: 'ocr-crash-timeout-1',
          documentId: 'doc-crash-timeout-1',
          failureCode: 'ocr_timeout',
          errorSignature: expect.any(String),
        }),
      })
    );
  });

  test('processPendingOcr exits early when residency policy blocks remote OCR', async () => {
    const { service, orchestration, residencyPolicyService } = createHarness();

    residencyPolicyService.assertCapabilityAllowed.mockResolvedValue({
      ok: false,
      reason:
        'Remote OCR ist durch die Workspace-Residency-Policy deaktiviert.',
      policy: {
        workspaceId,
        mode: 'local_only',
        allowCloudSync: false,
        allowRemoteOcr: false,
        allowExternalConnectors: false,
        allowTelemetry: false,
        requireMfaForAdmins: true,
        requireMfaForMembers: false,
        enforceEncryptionAtRest: true,
        sessionIdleTimeoutMinutes: 30,
        updatedAt: new Date().toISOString(),
      },
    });

    const now = new Date().toISOString();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-ocr-blocked-1',
        caseId,
        workspaceId,
        title: 'scan-blocked.png',
        kind: 'scan-pdf',
        status: 'ocr_pending',
        rawText: 'data:image/png;base64,AAAA',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];

    const completed = await service.processPendingOcr(caseId, workspaceId);

    expect(completed).toEqual([]);
    expect(orchestration.upsertOcrJob).not.toHaveBeenCalled();
    expect(orchestration.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.ocr.blocked_by_residency_policy',
        severity: 'warning',
      })
    );
  });

  test('infers onboarding metadata from uploaded legal text', async () => {
    const { service, orchestration } = createHarness();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-meta-1',
        caseId,
        workspaceId,
        title: 'Klage.pdf',
        kind: 'pdf',
        status: 'indexed',
        rawText:
          'Herr Max Mustermann beantragt Schadenersatz. Aktenzeichen AZ-2026-00421. Zuständig: Landgericht München.',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const result = await service.inferOnboardingMetadata({
      caseId,
      workspaceId,
    });
    expect(result.suggestedClientName).toBe('Max Mustermann');
    expect(result.suggestedExternalRef).toBe('AZ-2026-00421');
    expect(result.suggestedCourt?.toLowerCase()).toContain(
      'landgericht münchen'
    );
    expect(result.suggestedAuthorityRefs).toContain('AZ-2026-00421');
  });

  test('finalization blocks default client and succeeds with real client + chunks', async () => {
    const { service, orchestration } = createHarness();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-final-1',
        caseId,
        workspaceId,
        title: 'Schriftsatz.docx',
        kind: 'docx',
        status: 'indexed',
        rawText: 'Inhalt',
        processingStatus: 'ready',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    (orchestration['semanticChunks$'] as { value: unknown[] }).value = [
      {
        id: 'chunk-1',
        documentId: 'doc-final-1',
        caseId,
        workspaceId,
        index: 0,
        text: 'Chunk',
        category: 'sachverhalt',
        extractedEntities: {
          persons: [],
          dates: [],
          legalRefs: [],
          amounts: [],
          caseNumbers: [],
        },
        keywords: [],
        qualityScore: 0.9,
        createdAt: new Date().toISOString(),
      },
    ];

    const blocked = await service.finalizeOnboarding({
      caseId,
      workspaceId,
      reviewConfirmed: true,
      proofNote: 'Review bestätigt',
    });
    expect(blocked.ok).toBe(false);

    const now = new Date().toISOString();
    const graph = await (orchestration.getGraph as any)();
    graph.clients['client:ws-ocr-1:real'] = {
      id: 'client:ws-ocr-1:real',
      workspaceId,
      kind: 'person',
      displayName: 'Max Mustermann',
      tags: [],
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    graph.matters['matter:ws-ocr-1:case-ocr-1'].clientId =
      'client:ws-ocr-1:real';

    const ok = await service.finalizeOnboarding({
      caseId,
      workspaceId,
      reviewConfirmed: true,
      proofNote: 'Manuelle Prüfung inkl. OCR-Gegencheck durchgeführt.',
    });
    expect(ok.ok).toBe(true);
    expect(orchestration.appendAuditEntry).toHaveBeenCalled();
  });

  test('finalizeOnboarding persists authority references on matter and audits them', async () => {
    const { service, orchestration } = createHarness();
    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-final-refs-1',
        caseId,
        workspaceId,
        title: 'Anzeige.pdf',
        kind: 'pdf',
        status: 'indexed',
        rawText:
          'Staatsanwaltschaft Wien 123 Js 456/26. Polizei PI Innere Stadt A1/23456. Aktenzeichen AZ-2026-01001.',
        processingStatus: 'ready',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    (orchestration['semanticChunks$'] as { value: unknown[] }).value = [
      {
        id: 'chunk-refs-1',
        documentId: 'doc-final-refs-1',
        caseId,
        workspaceId,
        index: 0,
        text: 'Chunk',
        category: 'sachverhalt',
        extractedEntities: {
          persons: [],
          dates: [],
          legalRefs: [],
          amounts: [],
          caseNumbers: [],
        },
        keywords: [],
        qualityScore: 0.9,
        createdAt: new Date().toISOString(),
      },
    ];

    const now = new Date().toISOString();
    const graph = await (orchestration.getGraph as any)();
    graph.clients['client:ws-ocr-1:real'] = {
      id: 'client:ws-ocr-1:real',
      workspaceId,
      kind: 'person',
      displayName: 'Max Mustermann',
      tags: [],
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    graph.matters['matter:ws-ocr-1:case-ocr-1'].clientId =
      'client:ws-ocr-1:real';
    graph.matters['matter:ws-ocr-1:case-ocr-1'].authorityReferences = [
      'Bestandsref 42',
    ];

    const ok = await service.finalizeOnboarding({
      caseId,
      workspaceId,
      reviewConfirmed: true,
      proofNote: 'Behörden-Referenzen überprüft und freigegeben.',
    });

    expect(ok.ok).toBe(true);
    expect(orchestration.upsertMatter).toHaveBeenCalled();
    const updatedMatter = (orchestration.upsertMatter as any).mock.calls.at(
      -1
    )?.[0];
    expect(updatedMatter.authorityReferences).toContain('Bestandsref 42');
    expect(updatedMatter.authorityReferences).toContain('AZ-2026-01001');
    expect(updatedMatter.authorityReferences.length).toBeGreaterThanOrEqual(3);

    const auditPayload = (orchestration.appendAuditEntry as any).mock.calls.at(
      -1
    )?.[0];
    expect(auditPayload.metadata.authorityRefCount).toBeDefined();
    expect(auditPayload.metadata.authorityRefs).toContain('AZ-2026-01001');
  });

  test('finalizeOnboarding blocks when case has unresolved review deadlines', async () => {
    const { service, orchestration } = createHarness();
    const now = new Date().toISOString();

    (orchestration['legalDocuments$'] as { value: unknown[] }).value = [
      {
        id: 'doc-final-review-1',
        caseId,
        workspaceId,
        title: 'Review-Dokument.pdf',
        kind: 'pdf',
        status: 'indexed',
        rawText: 'Inhalt',
        processingStatus: 'ready',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ];

    (orchestration['semanticChunks$'] as { value: unknown[] }).value = [
      {
        id: 'chunk-review-1',
        documentId: 'doc-final-review-1',
        caseId,
        workspaceId,
        index: 0,
        text: 'Chunk',
        category: 'sachverhalt',
        extractedEntities: {
          persons: [],
          dates: [],
          legalRefs: [],
          amounts: [],
          caseNumbers: [],
        },
        keywords: [],
        qualityScore: 0.9,
        createdAt: now,
      },
    ];

    const graph = await (orchestration.getGraph as any)();
    graph.clients['client:ws-ocr-1:real'] = {
      id: 'client:ws-ocr-1:real',
      workspaceId,
      kind: 'person',
      displayName: 'Max Mustermann',
      tags: [],
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    graph.matters['matter:ws-ocr-1:case-ocr-1'].clientId =
      'client:ws-ocr-1:real';
    graph.cases[caseId].deadlineIds = ['deadline:review:1'];
    graph.deadlines = {
      ...graph.deadlines,
      'deadline:review:1': {
        id: 'deadline:review:1',
        title: 'Widerspruch prüfen',
        dueAt: '2026-03-05T09:00:00.000Z',
        sourceDocIds: ['doc-final-review-1'],
        status: 'open',
        priority: 'high',
        reminderOffsetsInMinutes: [1440],
        derivedFrom: 'auto_template',
        detectionConfidence: 0.62,
        requiresReview: true,
        createdAt: now,
        updatedAt: now,
      },
    };

    const blocked = await service.finalizeOnboarding({
      caseId,
      workspaceId,
      reviewConfirmed: true,
      proofNote: 'Manuelle Prüfung inkl. OCR-Gegencheck durchgeführt.',
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.message.toLowerCase()).toContain('fristen');
    expect(blocked.message.toLowerCase()).toContain('manuelle prüfung');
  });
});
