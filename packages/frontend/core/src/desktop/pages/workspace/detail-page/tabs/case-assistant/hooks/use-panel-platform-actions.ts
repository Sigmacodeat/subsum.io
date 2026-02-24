import type {
  IngestionJob,
  CaseAssistantRole,
  CaseAlertCenterService,
  CaseAssistantService,
  CaseAuditExportService,
  CasePlatformAdapterService,
  CasePlatformOrchestrationService,
  ConnectorConfig,
  DeadlineAlert,
} from '@affine/core/modules/case-assistant';
import { useCallback } from 'react';

import type { ConnectorDraft } from '../panel-types';
import type { AuditVerificationSnapshot } from '../panel-types';
import { normalizeRotationMode, parseRotationDays, downloadTextFile } from '../utils';

type Params = {
  caseId: string;
  workspaceId: string;
  currentRole: CaseAssistantRole;
  connectors: ConnectorConfig[];
  connectorDrafts: Record<string, ConnectorDraft>;
  setConnectorDrafts: React.Dispatch<React.SetStateAction<Record<string, ConnectorDraft>>>;
  setIngestionStatus: (status: string) => void;
  setLastAuditVerification: (value: AuditVerificationSnapshot) => void;
  casePlatformOrchestrationService: CasePlatformOrchestrationService;
  casePlatformAdapterService: CasePlatformAdapterService;
  caseAlertCenterService: CaseAlertCenterService;
  caseAssistantService: CaseAssistantService;
  caseAuditExportService: CaseAuditExportService;
};

export const usePanelPlatformActions = (params: Params) => {
  const onToggleConnector = useCallback(
    async (connectorId: string, enabled: boolean) => {
      await params.casePlatformOrchestrationService.setConnectorEnabled(
        connectorId,
        enabled
      );
    },
    [params.casePlatformOrchestrationService]
  );

  const onCancelJob = useCallback(
    async (jobId: string) => {
      await params.casePlatformOrchestrationService.cancelIngestionJob(jobId);
    },
    [params.casePlatformOrchestrationService]
  );

  const onRetryJob = useCallback(
    async (jobId: string) => {
      await params.casePlatformOrchestrationService.retryIngestionJob(jobId);
    },
    [params.casePlatformOrchestrationService]
  );

  const onDeleteJob = useCallback(
    async (jobId: string) => {
      return await params.casePlatformOrchestrationService.deleteIngestionJob(jobId);
    },
    [params.casePlatformOrchestrationService]
  );

  const onClearJobHistory = useCallback(async () => {
    return await params.casePlatformOrchestrationService.clearIngestionJobHistory({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
    });
  }, [params.caseId, params.casePlatformOrchestrationService, params.workspaceId]);

  const onRestoreJob = useCallback(
    async (job: IngestionJob) => {
      return await params.casePlatformOrchestrationService.restoreIngestionJob(job);
    },
    [params.casePlatformOrchestrationService]
  );

  const onRestoreJobHistory = useCallback(
    async (jobs: IngestionJob[]) => {
      return await params.casePlatformOrchestrationService.restoreIngestionJobHistory({
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        jobs,
      });
    },
    [params.caseId, params.casePlatformOrchestrationService, params.workspaceId]
  );

  const onHealthcheckConnector = useCallback(
    async (connectorId: string) => {
      const result = await params.casePlatformAdapterService.healthcheckConnector(
        connectorId
      );
      params.setIngestionStatus(
        result.ok
          ? `Connector-Healthcheck OK (${connectorId})`
          : `Connector-Healthcheck fehlgeschlagen (${connectorId}): ${result.message}`
      );
    },
    [params.casePlatformAdapterService, params.setIngestionStatus]
  );

  const onConnectorDraftChange = useCallback(
    (connectorId: string, patch: Partial<ConnectorDraft>) => {
      params.setConnectorDrafts(prev => {
        const current = prev[connectorId];
        if (!current) {
          return prev;
        }
        return {
          ...prev,
          [connectorId]: {
            ...current,
            ...patch,
          },
        };
      });
    },
    [params.setConnectorDrafts]
  );

  const onSaveConnectorSettings = useCallback(
    async (connectorId: string) => {
      const connector = params.connectors.find(item => item.id === connectorId);
      const draft = params.connectorDrafts[connectorId];
      if (!connector || !draft) {
        return;
      }

      const authHeaderName =
        draft.authType === 'api-key'
          ? draft.authHeaderName.trim() || 'X-API-Key'
          : undefined;
      const rotationDays = String(parseRotationDays(draft.rotationDays, 30));
      const rotationMode = normalizeRotationMode(draft.rotationMode);

      const savedConnector =
        await params.casePlatformOrchestrationService.saveConnectorConfiguration({
          ...connector,
          endpoint: draft.endpoint.trim(),
          authType: draft.authType,
          authHeaderName,
          metadata: {
            ...connector.metadata,
            rotationDays,
            rotationMode,
          },
        });
      if (!savedConnector) {
        params.setIngestionStatus(
          `Aktion blockiert: Rolle ${params.currentRole} darf Connector-Konfiguration nicht ändern.`
        );
        return;
      }

      if (draft.credential.trim()) {
        const rotated = await params.casePlatformAdapterService.setConnectorCredential(
          connectorId,
          draft.credential
        );
        if (!rotated) {
          params.setIngestionStatus(
            `Credential nicht gespeichert: Rolle ${params.currentRole} unzureichend.`
          );
          return;
        }
      }

      params.setConnectorDrafts(prev => ({
        ...prev,
        [connectorId]: {
          ...prev[connectorId],
          credential: '',
        },
      }));

      params.setIngestionStatus(
        `${connector.name} Konfiguration gespeichert (secure store).`
      );
    },
    [
      params.casePlatformAdapterService,
      params.casePlatformOrchestrationService,
      params.connectorDrafts,
      params.connectors,
      params.currentRole,
      params.setConnectorDrafts,
      params.setIngestionStatus,
    ]
  );

  const onClearConnectorCredential = useCallback(
    async (connectorId: string) => {
      const cleared = await params.casePlatformAdapterService.clearConnectorCredential(
        connectorId
      );
      if (!cleared) {
        params.setIngestionStatus(
          `Clear Auth blockiert: Rolle ${params.currentRole} benötigt Admin oder höher.`
        );
        return;
      }
      onConnectorDraftChange(connectorId, { credential: '' });
      params.setIngestionStatus(`Credential für ${connectorId} gelöscht.`);
    },
    [
      params.casePlatformAdapterService,
      params.currentRole,
      params.setIngestionStatus,
      onConnectorDraftChange,
    ]
  );

  const onRotateConnectorCredential = useCallback(
    async (connectorId: string) => {
      const connector = params.connectors.find(item => item.id === connectorId);
      const draft = params.connectorDrafts[connectorId];
      const credential = draft?.credential?.trim() ?? '';
      if (!connector || !draft) {
        return;
      }
      if (!credential) {
        params.setIngestionStatus(
          `Rotation für ${connector.name} benötigt ein neues Credential.`
        );
        return;
      }

      const rotated = await params.casePlatformAdapterService.setConnectorCredential(
        connectorId,
        credential
      );
      if (!rotated) {
        params.setIngestionStatus(
          `Rotation blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`
        );
        return;
      }

      params.setConnectorDrafts(prev => ({
        ...prev,
        [connectorId]: {
          ...prev[connectorId],
          credential: '',
        },
      }));

      params.setIngestionStatus(`Credential für ${connector.name} wurde rotiert.`);
    },
    [
      params.casePlatformAdapterService,
      params.connectorDrafts,
      params.connectors,
      params.currentRole,
      params.setConnectorDrafts,
      params.setIngestionStatus,
    ]
  );

  const onDispatchPaperless = useCallback(async () => {
    const result = await params.casePlatformAdapterService.triggerPaperlessIngest({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      sourceRef: `${params.caseId}:bulk-intake:${Date.now()}`,
    });
    params.setIngestionStatus(
      result.ok
        ? 'Paperless-Ingest erfolgreich ausgelöst.'
        : `Paperless-Ingest fehlgeschlagen: ${result.message}`
    );
  }, [
    params.caseId,
    params.casePlatformAdapterService,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onDispatchN8n = useCallback(async () => {
    const result = await params.casePlatformAdapterService.dispatchN8nWorkflow({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      workflow: 'case-sync-and-alerts',
    });
    params.setIngestionStatus(
      result.ok
        ? 'n8n-Workflow erfolgreich ausgelöst.'
        : `n8n-Workflow fehlgeschlagen: ${result.message}`
    );
  }, [
    params.caseId,
    params.casePlatformAdapterService,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onDispatchMail = useCallback(async () => {
    const result = await params.casePlatformAdapterService.dispatchMailAction({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      template: 'case-update-digest',
      recipientCount: 1,
    });
    params.setIngestionStatus(
      result.ok
        ? 'Mail-Dispatch erfolgreich ausgelöst.'
        : `Mail-Dispatch fehlgeschlagen: ${result.message}`
    );
  }, [
    params.caseId,
    params.casePlatformAdapterService,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onAck = useCallback(
    async (alert: DeadlineAlert) => {
      await params.caseAlertCenterService.acknowledge(alert.id);
      if (alert.source === 'deadline' || !alert.source) {
        await params.caseAssistantService.markDeadlineAcknowledged(alert.deadlineId);
      }
    },
    [params.caseAlertCenterService, params.caseAssistantService]
  );

  const onExportAudit = useCallback(
    async (format: 'json' | 'csv') => {
      const result = await params.caseAuditExportService.exportAudit({
        workspaceId: params.workspaceId,
        caseId: params.caseId,
        format,
      });
      if (!result) {
        params.setIngestionStatus(
          `Audit-Export blockiert: Rolle ${params.currentRole} benötigt Admin oder höher.`
        );
        return;
      }

      downloadTextFile(result.fileName, result.mimeType, result.content);
      params.setIngestionStatus(
        `Audit-Export ${format.toUpperCase()} erstellt (${result.entryCount} Einträge).`
      );
    },
    [
      params.caseAuditExportService,
      params.caseId,
      params.currentRole,
      params.setIngestionStatus,
      params.workspaceId,
    ]
  );

  const onVerifyAudit = useCallback(async () => {
    const result = await params.caseAuditExportService.verifyAuditChain({
      workspaceId: params.workspaceId,
      caseId: params.caseId,
    });
    if (!result) {
      params.setLastAuditVerification(null);
      params.setIngestionStatus(
        `Audit-Verifikation blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`
      );
      return;
    }
    params.setLastAuditVerification(result);
    params.setIngestionStatus(result.message);
  }, [
    params.caseAuditExportService,
    params.caseId,
    params.currentRole,
    params.setIngestionStatus,
    params.setLastAuditVerification,
    params.workspaceId,
  ]);

  return {
    onToggleConnector,
    onCancelJob,
    onRetryJob,
    onDeleteJob,
    onClearJobHistory,
    onRestoreJob,
    onRestoreJobHistory,
    onHealthcheckConnector,
    onConnectorDraftChange,
    onSaveConnectorSettings,
    onClearConnectorCredential,
    onRotateConnectorCredential,
    onDispatchPaperless,
    onDispatchN8n,
    onDispatchMail,
    onAck,
    onExportAudit,
    onVerifyAudit,
  };
};
