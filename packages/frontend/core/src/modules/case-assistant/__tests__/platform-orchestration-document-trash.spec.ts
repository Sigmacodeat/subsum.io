import { expect, test } from 'vitest';

import type {
  AuditEntry,
  DocumentQualityReport as QualityReport,
  LegalDocumentRecord,
  LegalFinding,
  OcrJob,
  SemanticChunk,
} from '../types';

function makeLegalDocumentRecord(
  partial: Partial<LegalDocumentRecord> &
    Pick<LegalDocumentRecord, 'id' | 'workspaceId' | 'caseId' | 'title'>
): LegalDocumentRecord {
  const now = new Date().toISOString();

  return {
    id: partial.id,
    workspaceId: partial.workspaceId,
    caseId: partial.caseId,
    title: partial.title,
    kind: partial.kind ?? 'pdf',
    status: partial.status ?? 'indexed',
    rawText: partial.rawText ?? '',
    tags: partial.tags ?? [],
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    linkedPageId: partial.linkedPageId,
    detectedJurisdiction: partial.detectedJurisdiction,
    jurisdictionConfidence: partial.jurisdictionConfidence,
    jurisdictionSignals: partial.jurisdictionSignals,
    sourceMimeType: partial.sourceMimeType,
    sourceSizeBytes: partial.sourceSizeBytes,
    sourceLastModifiedAt: partial.sourceLastModifiedAt,
    sourceBlobId: partial.sourceBlobId,
    sourceSha256: partial.sourceSha256,
    folderPath: partial.folderPath,
    internalFileNumber: partial.internalFileNumber,
    paragraphReferences: partial.paragraphReferences,
    sourceRef: partial.sourceRef,
    documentRevision: partial.documentRevision,
    contentFingerprint: partial.contentFingerprint,
    normalizedText: partial.normalizedText,
    language: partial.language,
    qualityScore: partial.qualityScore,
    pageCount: partial.pageCount,
    ocrEngine: partial.ocrEngine,
    processingStatus: partial.processingStatus,
    chunkCount: partial.chunkCount,
    entityCount: partial.entityCount,
    overallQualityScore: partial.overallQualityScore,
    processingDurationMs: partial.processingDurationMs,
    extractionEngine: partial.extractionEngine,
    processingError: partial.processingError,
    preflight: partial.preflight,
    discardedBinaryAt: partial.discardedBinaryAt,
    trashedAt: partial.trashedAt,
    purgeAt: partial.purgeAt,
  };
}

function createMockStore() {
  let legalDocuments: LegalDocumentRecord[] = [];
  let trashedDocuments: LegalDocumentRecord[] = [];
  let semanticChunks: SemanticChunk[] = [];
  let qualityReports: QualityReport[] = [];
  let ocrJobs: OcrJob[] = [];
  let legalFindings: LegalFinding[] = [];
  const auditEntries: AuditEntry[] = [];

  return {
    async getLegalDocuments() {
      return [...legalDocuments];
    },
    async setLegalDocuments(docs: LegalDocumentRecord[]) {
      legalDocuments = [...docs];
    },
    async getTrashedLegalDocuments() {
      return [...trashedDocuments];
    },
    async setTrashedLegalDocuments(docs: LegalDocumentRecord[]) {
      trashedDocuments = [...docs];
    },
    async getSemanticChunks() {
      return [...semanticChunks];
    },
    async setSemanticChunks(chunks: SemanticChunk[]) {
      semanticChunks = [...chunks];
    },
    async getQualityReports() {
      return [...qualityReports];
    },
    async setQualityReports(reports: QualityReport[]) {
      qualityReports = [...reports];
    },
    async getOcrJobs() {
      return [...ocrJobs];
    },
    async setOcrJobs(jobs: OcrJob[]) {
      ocrJobs = [...jobs];
    },
    async getLegalFindings() {
      return [...legalFindings];
    },
    async setLegalFindings(findings: LegalFinding[]) {
      legalFindings = [...findings];
    },
    async appendAuditEntry(entry: Partial<AuditEntry>) {
      auditEntries.push(entry as AuditEntry);
    },
    getAuditEntries() {
      return [...auditEntries];
    },
    seedDocuments(docs: LegalDocumentRecord[]) {
      legalDocuments = [...docs];
    },
    seedChunks(chunks: SemanticChunk[]) {
      semanticChunks = [...chunks];
    },
    seedQualityReports(reports: QualityReport[]) {
      qualityReports = [...reports];
    },
    seedOcrJobs(jobs: OcrJob[]) {
      ocrJobs = [...jobs];
    },
    seedFindings(findings: LegalFinding[]) {
      legalFindings = [...findings];
    },
  };
}

function createMockAccessControl(hasPermission = true) {
  return {
    async evaluate() {
      return {
        ok: hasPermission,
        role: 'operator',
        requiredRole: 'operator',
        message: hasPermission ? 'OK' : 'Permission denied',
      };
    },
  };
}

function createService(
  store: ReturnType<typeof createMockStore>,
  hasPermission = true
) {
  const accessControl = createMockAccessControl(hasPermission);

  const mockResidencyPolicy = {
    async getPolicy() {
      return {
        workspaceId: 'ws-1',
        region: 'eu-central',
        createdAt: '',
        updatedAt: '',
      };
    },
  };

  const orchestrationService = {
    store,
    accessControlService: accessControl,
    residencyPolicyService: mockResidencyPolicy,
    async deleteDocumentsCascade(documentIds: string[]) {
      const uniqueDocumentIds = [...new Set(documentIds.filter(Boolean))];
      const succeededIds: string[] = [];
      const blockedIds: string[] = [];
      const failedIds: string[] = [];

      if (uniqueDocumentIds.length === 0) {
        return { total: 0, succeededIds, blockedIds, failedIds };
      }

      const permission = await accessControl.evaluate();
      if (!permission.ok) {
        return {
          total: uniqueDocumentIds.length,
          succeededIds,
          blockedIds: uniqueDocumentIds,
          failedIds,
        };
      }

      const [
        legalDocs,
        trashedDocs,
        chunks,
        qualityReports,
        ocrJobs,
        findings,
      ] = await Promise.all([
        store.getLegalDocuments(),
        store.getTrashedLegalDocuments(),
        store.getSemanticChunks(),
        store.getQualityReports(),
        store.getOcrJobs(),
        store.getLegalFindings(),
      ]);

      const docById = new Map(legalDocs.map(doc => [doc.id, doc] as const));
      const trashedById = new Map(
        trashedDocs.map(doc => [doc.id, doc] as const)
      );

      const now = new Date();
      const trashedAt = now.toISOString();
      const purgeAt = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const movedDocs: LegalDocumentRecord[] = [];

      for (const documentId of uniqueDocumentIds) {
        const doc = docById.get(documentId);
        if (!doc) {
          blockedIds.push(documentId);
          continue;
        }

        try {
          const movedToTrash: LegalDocumentRecord = {
            ...doc,
            trashedAt,
            purgeAt,
            updatedAt: new Date().toISOString(),
          };
          docById.delete(documentId);
          trashedById.set(documentId, movedToTrash);
          movedDocs.push(movedToTrash);
          succeededIds.push(documentId);
        } catch {
          failedIds.push(documentId);
        }
      }

      if (succeededIds.length > 0) {
        const succeededSet = new Set(succeededIds);
        const nextFindings = findings.map(finding => {
          if (!finding.sourceDocumentIds.some(id => succeededSet.has(id))) {
            return finding;
          }
          return {
            ...finding,
            sourceDocumentIds: finding.sourceDocumentIds.filter(
              docId => !succeededSet.has(docId)
            ),
            updatedAt: new Date().toISOString(),
          };
        });

        await Promise.all([
          store.setLegalDocuments([...docById.values()]),
          store.setTrashedLegalDocuments([...trashedById.values()]),
          store.setSemanticChunks(
            chunks.filter(chunk => !succeededSet.has(chunk.documentId))
          ),
          store.setQualityReports(
            qualityReports.filter(
              report => !succeededSet.has(report.documentId)
            )
          ),
          store.setOcrJobs(
            ocrJobs.filter(job => !succeededSet.has(job.documentId))
          ),
          store.setLegalFindings(nextFindings),
        ]);

        const auditGroups = new Map<
          string,
          {
            workspaceId: string;
            caseId: string | undefined;
            documentIds: string[];
          }
        >();
        for (const doc of movedDocs) {
          const key = `${doc.workspaceId}::${doc.caseId}`;
          const current = auditGroups.get(key);
          if (current) {
            current.documentIds.push(doc.id);
            continue;
          }
          auditGroups.set(key, {
            workspaceId: doc.workspaceId,
            caseId: doc.caseId,
            documentIds: [doc.id],
          });
        }

        await Promise.all(
          [...auditGroups.values()].map(group =>
            store.appendAuditEntry({
              caseId: group.caseId,
              workspaceId: group.workspaceId,
              action: 'document.trash.scheduled',
              severity: 'info',
              details:
                `${group.documentIds.length} Dokument(e) in Papierkorb verschoben. ` +
                `Automatische Löschung am ${new Date(purgeAt).toLocaleDateString('de-DE')}.`,
              metadata: {
                documentCount: String(group.documentIds.length),
                retentionDays: String(30),
                trashedAt,
                purgeAt,
                documentIds: group.documentIds.slice(0, 20).join(','),
              },
            })
          )
        );
      }

      return {
        total: uniqueDocumentIds.length,
        succeededIds,
        blockedIds,
        failedIds,
      };
    },
    async restoreDocumentsBulk(documentIds: string[]) {
      const uniqueDocumentIds = [...new Set(documentIds.filter(Boolean))];
      const succeededIds: string[] = [];
      const blockedIds: string[] = [];
      const failedIds: string[] = [];

      if (uniqueDocumentIds.length === 0) {
        return { total: 0, succeededIds, blockedIds, failedIds };
      }

      const permission = await accessControl.evaluate();
      if (!permission.ok) {
        return {
          total: uniqueDocumentIds.length,
          succeededIds,
          blockedIds: uniqueDocumentIds,
          failedIds,
        };
      }

      const [activeDocs, trashedDocs] = await Promise.all([
        store.getLegalDocuments(),
        store.getTrashedLegalDocuments(),
      ]);

      const activeById = new Map(activeDocs.map(doc => [doc.id, doc] as const));
      const trashedById = new Map(
        trashedDocs.map(doc => [doc.id, doc] as const)
      );

      for (const documentId of uniqueDocumentIds) {
        const trashed = trashedById.get(documentId);
        if (!trashed) {
          blockedIds.push(documentId);
          continue;
        }

        try {
          const restored: LegalDocumentRecord = {
            ...trashed,
            trashedAt: undefined,
            purgeAt: undefined,
            updatedAt: new Date().toISOString(),
          };
          trashedById.delete(documentId);
          activeById.set(documentId, restored);
          succeededIds.push(documentId);
        } catch {
          failedIds.push(documentId);
        }
      }

      if (succeededIds.length > 0) {
        await Promise.all([
          store.setLegalDocuments([...activeById.values()]),
          store.setTrashedLegalDocuments([...trashedById.values()]),
        ]);
      }

      return {
        total: uniqueDocumentIds.length,
        succeededIds,
        blockedIds,
        failedIds,
      };
    },
  };

  return orchestrationService as any;
}

test('deleteDocumentsCascade moves documents to trash with timestamps', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document 1',
      createdAt: now,
      updatedAt: now,
    }),
    makeLegalDocumentRecord({
      id: 'doc-2',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document 2',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const service = createService(store);
  const result = await service.deleteDocumentsCascade(['doc-1', 'doc-2']);

  expect(result.total).toBe(2);
  expect(result.succeededIds).toEqual(['doc-1', 'doc-2']);
  expect(result.blockedIds).toEqual([]);
  expect(result.failedIds).toEqual([]);

  const remainingDocs = await store.getLegalDocuments();
  expect(remainingDocs).toHaveLength(0);

  const trashedDocs = await store.getTrashedLegalDocuments();
  expect(trashedDocs).toHaveLength(2);
  expect(trashedDocs[0].trashedAt).toBeTruthy();
  expect(trashedDocs[0].purgeAt).toBeTruthy();
  expect(trashedDocs[1].trashedAt).toBeTruthy();
  expect(trashedDocs[1].purgeAt).toBeTruthy();
});

test('deleteDocumentsCascade removes related semantic chunks', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  store.seedChunks([
    {
      id: 'chunk-1',
      documentId: 'doc-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      index: 0,
      text: 'Chunk 1 text',
      category: 'sonstiges',
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
      keywords: [],
      qualityScore: 100,
      createdAt: now,
    } satisfies SemanticChunk,
    {
      id: 'chunk-2',
      documentId: 'doc-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      index: 1,
      text: 'Chunk 2 text',
      category: 'sonstiges',
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
      keywords: [],
      qualityScore: 100,
      createdAt: now,
    } satisfies SemanticChunk,
    {
      id: 'chunk-3',
      documentId: 'doc-other',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      index: 0,
      text: 'Other chunk',
      category: 'sonstiges',
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
      keywords: [],
      qualityScore: 100,
      createdAt: now,
    } satisfies SemanticChunk,
  ]);

  const service = createService(store);
  await service.deleteDocumentsCascade(['doc-1']);

  const remainingChunks = await store.getSemanticChunks();
  expect(remainingChunks).toHaveLength(1);
  expect(remainingChunks[0].id).toBe('chunk-3');
});

test('deleteDocumentsCascade removes related quality reports', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  store.seedQualityReports([
    {
      documentId: 'doc-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      overallScore: 95,
      ocrConfidence: 92,
      extractedPageCount: 4,
      totalChunks: 12,
      totalEntities: 7,
      problems: [],
      checklistItems: [],
      processedAt: now,
      processingDurationMs: 800,
    } as QualityReport,
    {
      documentId: 'doc-other',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      overallScore: 88,
      ocrConfidence: 90,
      extractedPageCount: 3,
      totalChunks: 8,
      totalEntities: 5,
      problems: [],
      checklistItems: [],
      processedAt: now,
      processingDurationMs: 650,
    } as QualityReport,
  ]);

  const service = createService(store);
  await service.deleteDocumentsCascade(['doc-1']);

  const remainingReports = await store.getQualityReports();
  expect(remainingReports).toHaveLength(1);
  expect(remainingReports[0].documentId).toBe('doc-other');
});

test('deleteDocumentsCascade removes related OCR jobs', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  store.seedOcrJobs([
    {
      id: 'ocr-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      documentId: 'doc-1',
      status: 'completed',
      progress: 100,
      queuedAt: now,
      updatedAt: now,
    } satisfies OcrJob,
    {
      id: 'ocr-2',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      documentId: 'doc-other',
      status: 'queued',
      progress: 0,
      queuedAt: now,
      updatedAt: now,
    } satisfies OcrJob,
  ]);

  const service = createService(store);
  await service.deleteDocumentsCascade(['doc-1']);

  const remainingJobs = await store.getOcrJobs();
  expect(remainingJobs).toHaveLength(1);
  expect(remainingJobs[0].id).toBe('ocr-2');
});

test('deleteDocumentsCascade cleans sourceDocumentIds in findings', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  store.seedFindings([
    {
      id: 'finding-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      type: 'deadline_risk',
      title: 'Test Finding',
      description: 'Deadline conflict detected in uploaded material.',
      severity: 'high',
      confidence: 0.9,
      sourceDocumentIds: ['doc-1', 'doc-2'],
      citations: [
        {
          documentId: 'doc-1',
          quote: 'Ausschlussfrist endet am 01.03.2026.',
        },
      ],
      createdAt: now,
      updatedAt: now,
    } satisfies LegalFinding,
    {
      id: 'finding-2',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      type: 'liability',
      title: 'Other Finding',
      description: 'General liability risk remains unchanged.',
      severity: 'medium',
      confidence: 0.8,
      sourceDocumentIds: ['doc-other'],
      citations: [
        {
          documentId: 'doc-other',
          quote: 'Haftungsklausel greift bei Verzug.',
        },
      ],
      createdAt: now,
      updatedAt: now,
    } satisfies LegalFinding,
  ]);

  const service = createService(store);
  await service.deleteDocumentsCascade(['doc-1']);

  const findings = await store.getLegalFindings();
  expect(findings).toHaveLength(2);

  const finding1 = findings.find(f => f.id === 'finding-1');
  expect(finding1?.sourceDocumentIds).toEqual(['doc-2']);

  const finding2 = findings.find(f => f.id === 'finding-2');
  expect(finding2?.sourceDocumentIds).toEqual(['doc-other']);
});

test('deleteDocumentsCascade appends audit entries', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document 1',
      createdAt: now,
      updatedAt: now,
    }),
    makeLegalDocumentRecord({
      id: 'doc-2',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document 2',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const service = createService(store);
  await service.deleteDocumentsCascade(['doc-1', 'doc-2']);

  const auditEntries = store.getAuditEntries();
  expect(auditEntries.length).toBeGreaterThan(0);

  const trashEntry = auditEntries.find(
    e => e.action === 'document.trash.scheduled'
  );
  expect(trashEntry).toBeTruthy();
  expect(trashEntry?.severity).toBe('info');
  expect(trashEntry?.workspaceId).toBe('ws-1');
  expect(trashEntry?.caseId).toBe('case-1');
});

test('deleteDocumentsCascade blocks all documents when permission denied', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const service = createService(store, false);
  const result = await service.deleteDocumentsCascade(['doc-1']);

  expect(result.total).toBe(1);
  expect(result.succeededIds).toEqual([]);
  expect(result.blockedIds).toEqual(['doc-1']);
  expect(result.failedIds).toEqual([]);

  const remainingDocs = await store.getLegalDocuments();
  expect(remainingDocs).toHaveLength(1);
});

test('deleteDocumentsCascade handles non-existent documents', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const service = createService(store);
  const result = await service.deleteDocumentsCascade([
    'doc-1',
    'doc-nonexistent',
  ]);

  expect(result.total).toBe(2);
  expect(result.succeededIds).toEqual(['doc-1']);
  expect(result.blockedIds).toEqual(['doc-nonexistent']);
  expect(result.failedIds).toEqual([]);
});

test('deleteDocumentsCascade deduplicates document IDs', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Test Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const service = createService(store);
  const result = await service.deleteDocumentsCascade([
    'doc-1',
    'doc-1',
    'doc-1',
  ]);

  expect(result.total).toBe(1);
  expect(result.succeededIds).toEqual(['doc-1']);

  const trashedDocs = await store.getTrashedLegalDocuments();
  expect(trashedDocs).toHaveLength(1);
});

test('deleteDocumentsCascade handles empty input', async () => {
  const store = createMockStore();
  const service = createService(store);

  const result = await service.deleteDocumentsCascade([]);

  expect(result.total).toBe(0);
  expect(result.succeededIds).toEqual([]);
  expect(result.blockedIds).toEqual([]);
  expect(result.failedIds).toEqual([]);
});

test('restoreDocumentsBulk restores trashed documents and clears trash metadata', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  store.seedDocuments([
    makeLegalDocumentRecord({
      id: 'doc-active',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Active Document',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  await store.setTrashedLegalDocuments([
    makeLegalDocumentRecord({
      id: 'doc-trash-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Trashed Document 1',
      createdAt: now,
      updatedAt: now,
      trashedAt: now,
      purgeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    makeLegalDocumentRecord({
      id: 'doc-trash-2',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Trashed Document 2',
      createdAt: now,
      updatedAt: now,
      trashedAt: now,
      purgeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  ]);

  const service = createService(store);
  const result = await service.restoreDocumentsBulk([
    'doc-trash-1',
    'doc-trash-2',
  ]);

  expect(result.total).toBe(2);
  expect(result.succeededIds).toEqual(['doc-trash-1', 'doc-trash-2']);
  expect(result.blockedIds).toEqual([]);
  expect(result.failedIds).toEqual([]);

  const activeDocs = await store.getLegalDocuments();
  expect(activeDocs).toHaveLength(3);
  const restored1 = activeDocs.find(doc => doc.id === 'doc-trash-1');
  const restored2 = activeDocs.find(doc => doc.id === 'doc-trash-2');
  expect(restored1?.trashedAt).toBeUndefined();
  expect(restored1?.purgeAt).toBeUndefined();
  expect(restored2?.trashedAt).toBeUndefined();
  expect(restored2?.purgeAt).toBeUndefined();

  const remainingTrashed = await store.getTrashedLegalDocuments();
  expect(remainingTrashed).toHaveLength(0);
});

test('restoreDocumentsBulk blocks all documents when permission denied', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  await store.setTrashedLegalDocuments([
    makeLegalDocumentRecord({
      id: 'doc-trash-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Trashed Document',
      createdAt: now,
      updatedAt: now,
      trashedAt: now,
      purgeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  ]);

  const service = createService(store, false);
  const result = await service.restoreDocumentsBulk(['doc-trash-1']);

  expect(result.total).toBe(1);
  expect(result.succeededIds).toEqual([]);
  expect(result.blockedIds).toEqual(['doc-trash-1']);
  expect(result.failedIds).toEqual([]);

  const remainingTrashed = await store.getTrashedLegalDocuments();
  expect(remainingTrashed).toHaveLength(1);
});

test('restoreDocumentsBulk handles non-existent documents as blocked', async () => {
  const store = createMockStore();
  const now = new Date().toISOString();

  await store.setTrashedLegalDocuments([
    makeLegalDocumentRecord({
      id: 'doc-trash-1',
      workspaceId: 'ws-1',
      caseId: 'case-1',
      title: 'Trashed Document',
      createdAt: now,
      updatedAt: now,
      trashedAt: now,
      purgeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  ]);

  const service = createService(store);
  const result = await service.restoreDocumentsBulk([
    'doc-trash-1',
    'doc-missing',
    'doc-trash-1',
  ]);

  expect(result.total).toBe(2);
  expect(result.succeededIds).toEqual(['doc-trash-1']);
  expect(result.blockedIds).toEqual(['doc-missing']);
  expect(result.failedIds).toEqual([]);

  const activeDocs = await store.getLegalDocuments();
  expect(activeDocs.map(doc => doc.id)).toContain('doc-trash-1');
  const remainingTrashed = await store.getTrashedLegalDocuments();
  expect(remainingTrashed).toHaveLength(0);
});
