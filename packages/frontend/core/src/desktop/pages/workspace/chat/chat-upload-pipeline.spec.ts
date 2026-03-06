/**
 * @vitest-environment happy-dom
 */
import { describe, expect, test, vi } from 'vitest';

import { runChatUploadPipeline } from './chat-upload-pipeline';

function createHarness() {
  const intakeDocuments = vi.fn();
  const enqueueIngestionJob = vi.fn().mockResolvedValue({ id: 'job-chat-1' });
  const updateJobStatus = vi.fn().mockResolvedValue(undefined);

  return {
    legalCopilotWorkflowService: {
      intakeDocuments,
    },
    casePlatformOrchestrationService: {
      enqueueIngestionJob,
      updateJobStatus,
    },
    spies: {
      intakeDocuments,
      enqueueIngestionJob,
      updateJobStatus,
    },
  };
}

describe('runChatUploadPipeline', () => {
  test('returns empty result when no case is selected', async () => {
    const harness = createHarness();

    const result = await runChatUploadPipeline({
      documents: [
        {
          title: 'scan.png',
          kind: 'scan-pdf',
          content: 'data:image/png;base64,AAAA',
          sourceRef: 'chat-upload:scan.png',
        },
      ],
      selectedCaseId: '',
      workspaceId: 'ws-1',
      sourceRef: 'chat-upload:batch-1',
      chatUploadChunkSize: 20,
      legalCopilotWorkflowService: harness.legalCopilotWorkflowService as any,
      casePlatformOrchestrationService:
        harness.casePlatformOrchestrationService as any,
    });

    expect(result).toEqual([]);
    expect(harness.spies.enqueueIngestionJob).not.toHaveBeenCalled();
    expect(harness.spies.intakeDocuments).not.toHaveBeenCalled();
  });

  test('chunks chat uploads, updates job progress, and completes when all documents succeed', async () => {
    const harness = createHarness();
    harness.spies.intakeDocuments
      .mockResolvedValueOnce([
        {
          id: 'doc-1',
          status: 'indexed',
          processingStatus: 'ready',
        },
        {
          id: 'doc-2',
          status: 'indexed',
          processingStatus: 'ready',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'doc-3',
          status: 'indexed',
          processingStatus: 'ready',
        },
      ]);

    const result = await runChatUploadPipeline({
      documents: [
        {
          title: 'a.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,AAA',
          sourceRef: 'chat:a.pdf',
        },
        {
          title: 'b.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,BBB',
          sourceRef: 'chat:b.pdf',
        },
        {
          title: 'c.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,CCC',
          sourceRef: 'chat:c.pdf',
        },
      ],
      selectedCaseId: 'case-1',
      workspaceId: 'ws-1',
      sourceRef: 'chat-upload:batch-2',
      chatUploadChunkSize: 2,
      legalCopilotWorkflowService: harness.legalCopilotWorkflowService as any,
      casePlatformOrchestrationService:
        harness.casePlatformOrchestrationService as any,
    });

    expect(result).toHaveLength(3);
    expect(harness.spies.enqueueIngestionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        workspaceId: 'ws-1',
        sourceType: 'upload',
        sourceRef: 'chat-upload:batch-2',
      })
    );
    expect(harness.spies.intakeDocuments).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        caseId: 'case-1',
        workspaceId: 'ws-1',
        documents: [
          expect.objectContaining({ title: 'a.pdf' }),
          expect.objectContaining({ title: 'b.pdf' }),
        ],
      })
    );
    expect(harness.spies.intakeDocuments).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        caseId: 'case-1',
        workspaceId: 'ws-1',
        documents: [expect.objectContaining({ title: 'c.pdf' })],
      })
    );
    expect(harness.spies.updateJobStatus).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobId: 'job-chat-1',
        status: 'running',
        progress: 3,
      })
    );
    expect(harness.spies.updateJobStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jobId: 'job-chat-1',
        status: 'completed',
        progress: 100,
      })
    );
  });

  test('marks chat ingestion job failed when one processed document fails', async () => {
    const harness = createHarness();
    harness.spies.intakeDocuments.mockResolvedValueOnce([
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

    const result = await runChatUploadPipeline({
      documents: [
        {
          title: 'bad-scan.pdf',
          kind: 'pdf',
          content: 'data:application/pdf;base64,BAD',
          sourceRef: 'chat:bad-scan.pdf',
        },
      ],
      selectedCaseId: 'case-2',
      workspaceId: 'ws-1',
      sourceRef: 'chat-upload:batch-3',
      chatUploadChunkSize: 5,
      legalCopilotWorkflowService: harness.legalCopilotWorkflowService as any,
      casePlatformOrchestrationService:
        harness.casePlatformOrchestrationService as any,
    });

    expect(result).toHaveLength(2);
    expect(harness.spies.updateJobStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jobId: 'job-chat-1',
        status: 'failed',
        progress: 100,
        errorMessage: '1 Datei(en) in der Verarbeitung fehlgeschlagen.',
      })
    );
  });

  test('marks chat ingestion job failed when intake throws', async () => {
    const harness = createHarness();
    harness.spies.intakeDocuments.mockRejectedValueOnce(new Error('boom'));

    await expect(
      runChatUploadPipeline({
        documents: [
          {
            title: 'throw.pdf',
            kind: 'pdf',
            content: 'data:application/pdf;base64,THROW',
            sourceRef: 'chat:throw.pdf',
          },
        ],
        selectedCaseId: 'case-3',
        workspaceId: 'ws-1',
        sourceRef: 'chat-upload:batch-4',
        chatUploadChunkSize: 10,
        legalCopilotWorkflowService: harness.legalCopilotWorkflowService as any,
        casePlatformOrchestrationService:
          harness.casePlatformOrchestrationService as any,
      })
    ).rejects.toThrow('boom');

    expect(harness.spies.updateJobStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jobId: 'job-chat-1',
        status: 'failed',
        progress: 100,
        errorMessage: 'Upload über Chat fehlgeschlagen',
      })
    );
  });
});
