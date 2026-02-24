import { AffineContext } from '@affine/core/components/context';
import { AppContainer } from '@affine/core/desktop/components/app-container';
import { router } from '@affine/core/desktop/router';
import { configureCommonModules } from '@affine/core/modules';
import type { CaseFile, LegalDocumentKind } from '@affine/core/modules/case-assistant';
import {
  CaseAssistantService,
  CasePlatformOrchestrationService,
  CaseProviderSettingsService,
  LegalCopilotWorkflowService,
} from '@affine/core/modules/case-assistant';
import { I18nProvider } from '@affine/core/modules/i18n';
import { LifecycleService } from '@affine/core/modules/lifecycle';
import {
  configureLocalStorageStateStorageImpls,
  NbstoreProvider,
} from '@affine/core/modules/storage';
import { PopupWindowProvider } from '@affine/core/modules/url';
import { configureBrowserWorkbenchModule } from '@affine/core/modules/workbench';
import { configureBrowserWorkspaceFlavours } from '@affine/core/modules/workspace-engine';
import createEmotionCache from '@affine/core/utils/create-emotion-cache';
import { getWorkerUrl } from '@affine/env/worker';
import { StoreManagerClient } from '@affine/nbstore/worker/client';
import { setTelemetryTransport } from '@affine/track';
import { CacheProvider } from '@emotion/react';
import { Framework, FrameworkRoot, getCurrentStore } from '@toeverything/infra';
import { OpClient } from '@toeverything/infra/op';
import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';

const cache = createEmotionCache();

let storeManagerClient: StoreManagerClient;

const workerUrl = getWorkerUrl('nbstore');

if (
  window.SharedWorker &&
  localStorage.getItem('disableSharedWorker') !== 'true'
) {
  const worker = new SharedWorker(workerUrl, {
    name: 'affine-shared-worker',
  });
  storeManagerClient = new StoreManagerClient(new OpClient(worker.port));
} else {
  const worker = new Worker(workerUrl);
  storeManagerClient = new StoreManagerClient(new OpClient(worker));
}
setTelemetryTransport(storeManagerClient.telemetry);
window.addEventListener('beforeunload', () => {
  storeManagerClient.dispose();
});
window.addEventListener('focus', () => {
  storeManagerClient.resume();
});
window.addEventListener('click', () => {
  storeManagerClient.resume();
});
window.addEventListener('blur', () => {
  storeManagerClient.pause();
});

const future = {
  v7_startTransition: true,
} as const;

const framework = new Framework();
configureCommonModules(framework);
configureBrowserWorkbenchModule(framework);
configureLocalStorageStateStorageImpls(framework);
configureBrowserWorkspaceFlavours(framework);
framework.impl(NbstoreProvider, {
  openStore(key, options) {
    return storeManagerClient.open(key, options);
  },
});
framework.impl(PopupWindowProvider, {
  open: (target: string) => {
    const targetUrl = new URL(target);

    let url: string;
    // safe to open directly if in the same origin
    if (targetUrl.origin === location.origin) {
      url = target;
    } else {
      const redirectProxy = location.origin + '/redirect-proxy';
      const search = new URLSearchParams({
        redirect_uri: target,
      });

      url = `${redirectProxy}?${search.toString()}`;
    }
    window.open(url, '_blank', 'popup noreferrer noopener');
  },
});
const frameworkProvider = framework.provider();

const enableE2EBridge =
  (import.meta as any)?.env?.PROD !== true ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

if (enableE2EBridge) {
  (window as any).__AFFINE_FRAMEWORK_PROVIDER__ = frameworkProvider;

  const resolveWorkspaceScope = () => {
    const current = (globalThis as any).currentWorkspace;
    const scope = current?.scope;
    if (!scope) {
      throw new Error(
        'E2E bridge: currentWorkspace.scope is not ready. Navigate to a workspace first.'
      );
    }
    return scope as any;
  };

  const resolveWorkspaceId = () => {
    const current = (globalThis as any).currentWorkspace;
    return current?.meta?.id ?? current?.id;
  };

  (window as any).__AFFINE_E2E__ = {
    getWorkspaceId: () => {
      const id = resolveWorkspaceId();
      if (!id) {
        throw new Error('E2E bridge: currentWorkspace is not ready');
      }
      return id;
    },

    ensureCase: async (input: { caseId: string; title: string }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const now = new Date().toISOString();
      const record: CaseFile = {
        id: input.caseId,
        workspaceId,
        title: input.title,
        actorIds: [],
        issueIds: [],
        deadlineIds: [],
        memoryEventIds: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      const scope = resolveWorkspaceScope();
      await (scope.get(CaseAssistantService) as any).upsertCaseFile(record);
      return { caseId: input.caseId, workspaceId };
    },

    runWorkflow: async (input: {
      caseId: string;
      documents: Array<{
        title: string;
        kind: LegalDocumentKind;
        content: string;
        sourceMimeType?: string;
        sourceSizeBytes?: number;
        sourceLastModifiedAt?: string;
        sourceRef?: string;
        folderPath?: string;
      }>;
    }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const scope = resolveWorkspaceScope();
      return await (scope.get(LegalCopilotWorkflowService) as any).runFullWorkflow({
        caseId: input.caseId,
        workspaceId,
        documents: input.documents,
      });
    },

    intakeDocuments: async (input: {
      caseId: string;
      documents: Array<{
        title: string;
        kind: LegalDocumentKind;
        content: string;
        sourceMimeType?: string;
        sourceSizeBytes?: number;
        sourceLastModifiedAt?: string;
        sourceRef?: string;
        folderPath?: string;
      }>;
    }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const scope = resolveWorkspaceScope();
      return await (scope.get(LegalCopilotWorkflowService) as any).intakeDocuments({
        caseId: input.caseId,
        workspaceId,
        documents: input.documents,
      });
    },

    processPendingOcr: async (input: { caseId: string }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const scope = resolveWorkspaceScope();
      return await scope
        .get(LegalCopilotWorkflowService)
        .processPendingOcr(input.caseId, workspaceId);
    },

    drainOcr: async (input: { caseId: string; maxRounds?: number }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const scope = resolveWorkspaceScope();
      const workflow = scope.get(LegalCopilotWorkflowService) as any;
      const orchestration = scope.get(CasePlatformOrchestrationService) as any;
      const maxRounds = input.maxRounds ?? 50;

      const completed: any[] = [];
      for (let round = 0; round < maxRounds; round++) {
        const open = (orchestration.ocrJobs$.value ?? []).filter(
          (j: any) =>
            j.caseId === input.caseId &&
            j.workspaceId === workspaceId &&
            (j.status === 'queued' || j.status === 'running')
        );
        if (open.length === 0) break;
        const batch = await workflow.processPendingOcr(input.caseId, workspaceId);
        completed.push(...batch);
      }
      return completed;
    },

    snapshotCaseState: async (input: { caseId: string }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const scope = resolveWorkspaceScope();
      const orchestration = scope.get(CasePlatformOrchestrationService) as any;
      const docs = (orchestration.legalDocuments$.value ?? []).filter(
        (d: any) => d.caseId === input.caseId && d.workspaceId === workspaceId
      );
      const jobs = (orchestration.ocrJobs$.value ?? []).filter(
        (j: any) => j.caseId === input.caseId && j.workspaceId === workspaceId
      );
      const chunks = (orchestration.semanticChunks$.value ?? []).filter(
        (c: any) => c.caseId === input.caseId && c.workspaceId === workspaceId
      );
      const reports = (orchestration.qualityReports$.value ?? []).filter(
        (r: any) => r.caseId === input.caseId && r.workspaceId === workspaceId
      );
      const auditEntries = (orchestration.auditEntries$.value ?? []).filter(
        (e: any) => e.caseId === input.caseId && e.workspaceId === workspaceId
      );

      return {
        workspaceId,
        documentCount: docs.length,
        ocrJobCount: jobs.length,
        chunkCount: chunks.length,
        reportCount: reports.length,
        documents: docs,
        ocrJobs: jobs,
        semanticChunks: chunks,
        qualityReports: reports,
        auditEntries,
      };
    },

    analyzeCase: async (input: { caseId: string }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const scope = resolveWorkspaceScope();
      const workflow = scope.get(LegalCopilotWorkflowService) as any;
      return await workflow.analyzeCase(input.caseId, workspaceId);
    },

    getOcrProviderConfig: async () => {
      const scope = resolveWorkspaceScope();
      return await scope.get(CaseProviderSettingsService).getProviderConfig('ocr');
    },

    setOcrProviderConfig: async (input: { endpoint?: string; token?: string }) => {
      const scope = resolveWorkspaceScope();
      const service = scope.get(CaseProviderSettingsService);
      if (typeof input.endpoint === 'string') {
        await service.setEndpoint('ocr', input.endpoint);
      }
      if (typeof input.token === 'string') {
        if (input.token.trim()) {
          await service.setToken('ocr', input.token);
        } else {
          service.clearToken('ocr');
        }
      }
      return await service.getProviderConfig('ocr');
    },

    seedDeadlineScenario: async (input?: {
      caseId?: string;
      matterId?: string;
      deadlineId?: string;
      title?: string;
      dueAt?: string;
    }) => {
      const workspaceId = (window as any).__AFFINE_E2E__!.getWorkspaceId();
      const scope = resolveWorkspaceScope();
      const caseAssistant = scope.get(CaseAssistantService) as any;

      const caseId = input?.caseId ?? 'e2e-case-legal';
      const matterId = input?.matterId ?? `matter:${workspaceId}:${caseId}`;
      const deadlineId = input?.deadlineId ?? `deadline:${workspaceId}:${caseId}`;
      const dueAt =
        input?.dueAt ??
        new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const title = input?.title ?? 'E2E Frist: Schriftsatz einreichen';

      await caseAssistant.upsertMatter({
        id: matterId,
        workspaceId,
        clientId: `client:${workspaceId}:default`,
        title: 'E2E Akte Legal Journal',
        status: 'open',
        tags: [],
      });

      await caseAssistant.upsertCaseFile({
        id: caseId,
        workspaceId,
        matterId,
        title: 'E2E Fall Legal Journal',
        actorIds: [],
        issueIds: [],
        deadlineIds: [deadlineId],
        memoryEventIds: [],
        tags: [],
      });

      await caseAssistant.upsertDeadline({
        id: deadlineId,
        title,
        dueAt,
        sourceDocIds: [],
        priority: 'high',
        reminderOffsetsInMinutes: [180, 60],
        status: 'open',
      });

      return {
        workspaceId,
        caseId,
        matterId,
        deadlineId,
        dueAt,
        title,
      };
    },
  };
}

// setup application lifecycle events, and emit application start event
window.addEventListener('focus', () => {
  frameworkProvider.get(LifecycleService).applicationFocus();
});
frameworkProvider.get(LifecycleService).applicationStart();

export function App() {
  return (
    <Suspense>
      <FrameworkRoot framework={frameworkProvider}>
        <CacheProvider value={cache}>
          <I18nProvider>
            <AffineContext store={getCurrentStore()}>
              <RouterProvider
                fallbackElement={<AppContainer fallback />}
                router={router}
                future={future}
              />
            </AffineContext>
          </I18nProvider>
        </CacheProvider>
      </FrameworkRoot>
    </Suspense>
  );
}
