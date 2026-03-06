import type { LegalDocumentRecord } from '@affine/core/modules/case-assistant';

export type ChatUploadDocumentInput = {
  title: string;
  kind: LegalDocumentRecord['kind'];
  content: string;
  pageCount?: number;
  sourceMimeType?: string;
  sourceSizeBytes?: number;
  sourceLastModifiedAt?: string;
  sourceRef: string;
  folderPath?: string;
};

type ChatUploadIntakeResult = Array<{
  status?: string;
  processingStatus?: string;
}>;

type ChatUploadWorkflowService = {
  intakeDocuments(input: {
    caseId: string;
    workspaceId: string;
    documents: ChatUploadDocumentInput[];
  }): Promise<ChatUploadIntakeResult>;
};

type ChatUploadOrchestrationService = {
  enqueueIngestionJob(input: {
    caseId: string;
    workspaceId: string;
    sourceType: 'upload' | 'folder';
    sourceRef: string;
  }): Promise<{ id: string }>;
  updateJobStatus(input: {
    jobId: string;
    status: 'running' | 'completed' | 'failed';
    progress: number;
    errorMessage?: string;
  }): Promise<unknown>;
};

type RunChatUploadPipelineInput = {
  documents: ChatUploadDocumentInput[];
  selectedCaseId: string;
  workspaceId: string;
  sourceRef: string;
  sourceType?: 'upload' | 'folder';
  chatUploadChunkSize: number;
  legalCopilotWorkflowService: ChatUploadWorkflowService;
  casePlatformOrchestrationService: ChatUploadOrchestrationService;
};

export async function runChatUploadPipeline({
  documents,
  selectedCaseId,
  workspaceId,
  sourceRef,
  sourceType = 'upload',
  chatUploadChunkSize,
  legalCopilotWorkflowService,
  casePlatformOrchestrationService,
}: RunChatUploadPipelineInput): Promise<ChatUploadIntakeResult> {
  if (!selectedCaseId) {
    return [];
  }

  let jobId: string | null = null;
  try {
    const job = await casePlatformOrchestrationService.enqueueIngestionJob({
      caseId: selectedCaseId,
      workspaceId,
      sourceType,
      sourceRef,
    });
    jobId = job.id;

    await casePlatformOrchestrationService.updateJobStatus({
      jobId,
      status: 'running',
      progress: 3,
    });

    const chunks: Array<typeof documents> = [];
    for (let i = 0; i < documents.length; i += chatUploadChunkSize) {
      chunks.push(documents.slice(i, i + chatUploadChunkSize));
    }

    const ingested: ChatUploadIntakeResult = [];
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      const chunkResult = await legalCopilotWorkflowService.intakeDocuments({
        caseId: selectedCaseId,
        workspaceId,
        documents: chunk,
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

    return ingested;
  } catch (error) {
    if (jobId) {
      await casePlatformOrchestrationService.updateJobStatus({
        jobId,
        status: 'failed',
        progress: 100,
        errorMessage: 'Upload über Chat fehlgeschlagen',
      });
    }
    throw error;
  }
}
