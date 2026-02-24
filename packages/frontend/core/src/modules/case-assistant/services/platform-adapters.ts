import { Service } from '@toeverything/infra';

import type { CaseConnectorSecretStore } from '../stores/connector-secret';
import type { ConnectorConfig } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

export interface ConnectorHealthResult {
  connectorId: string;
  ok: boolean;
  httpStatus?: number;
  message: string;
  checkedAt: string;
}

export interface ConnectorActionResult {
  connectorId: string;
  action: 'paperless.ingest' | 'n8n.dispatch' | 'mail.dispatch' | 'dropbox.search';
  ok: boolean;
  httpStatus?: number;
  message: string;
  at: string;
  data?: unknown;
}

type RotationMode = 'soft' | 'hard';

type ConnectorSnapshot = {
  id: string;
  workspaceId: string;
  name: string;
  authType?: 'none' | 'bearer' | 'api-key';
};

export class CasePlatformAdapterService extends Service {
  constructor(
    private readonly orchestrationService: CasePlatformOrchestrationService,
    private readonly secretStore: CaseConnectorSecretStore
  ) {
    super();
  }

  readonly connectors$ = this.orchestrationService.connectors$;

  private getConnectorByKind(kind: 'paperless' | 'n8n' | 'mail' | 'dropbox') {
    return (this.connectors$.value ?? []).find((item: ConnectorConfig) => item.kind === kind) ?? null;
  }

  private normalizeAuthType(value: unknown) {
    if (value === 'bearer' || value === 'api-key' || value === 'none') {
      return value;
    }
    return 'none';
  }

  private parseRotationDays(value: string | undefined, fallback = 30) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(365, Math.max(7, parsed));
  }

  private normalizeRotationMode(value: unknown): RotationMode {
    return value === 'hard' ? 'hard' : 'soft';
  }

  private isCredentialRotationDue(updatedAt: string | undefined, rotationDays: number) {
    if (!updatedAt) {
      return false;
    }
    const ts = new Date(updatedAt).getTime();
    if (!Number.isFinite(ts)) {
      return false;
    }
    const ageMs = Date.now() - ts;
    return ageMs > rotationDays * 24 * 60 * 60 * 1000;
  }

  hasCredential(connectorId: string) {
    return this.secretStore.hasSecret(connectorId);
  }

  getCredentialMeta(connectorId: string) {
    return this.secretStore.getSecretMeta(connectorId);
  }

  async setConnectorCredential(connectorId: string, credential: string) {
    const permission = await this.orchestrationService.evaluatePermission(
      'connector.rotate'
    );
    if (!permission.ok) {
      const connector = (this.connectors$.value ?? []).find(
        (item: ConnectorConfig) => item.id === connectorId
      );
      if (connector) {
        await this.orchestrationService.appendAuditEntry({
          workspaceId: connector.workspaceId,
          action: 'connector.rotate.denied',
          severity: 'warning',
          details: permission.message,
          metadata: {
            connectorId,
            role: permission.role,
            requiredRole: permission.requiredRole,
          },
        });
      }
      return false;
    }

    await this.secretStore.setSecret(connectorId, credential);
    return true;
  }

  async clearConnectorCredential(connectorId: string) {
    const permission = await this.orchestrationService.evaluatePermission(
      'connector.clear_auth'
    );
    if (!permission.ok) {
      const connector = (this.connectors$.value ?? []).find(
        (item: ConnectorConfig) => item.id === connectorId
      );
      if (connector) {
        await this.orchestrationService.appendAuditEntry({
          workspaceId: connector.workspaceId,
          action: 'connector.clear_auth.denied',
          severity: 'warning',
          details: permission.message,
          metadata: {
            connectorId,
            role: permission.role,
            requiredRole: permission.requiredRole,
          },
        });
      }
      return false;
    }

    this.secretStore.clearSecret(connectorId);
    return true;
  }

  private async buildAuthHeaders(connector: {
    id: string;
    authType?: 'none' | 'bearer' | 'api-key';
    authHeaderName?: string;
  }) {
    const authType = this.normalizeAuthType(connector.authType);

    if (authType === 'none') {
      return {} as Record<string, string>;
    }

    const credential = await this.secretStore.getSecret(connector.id);
    if (!credential) {
      throw new Error('Fehlendes Connector-Credential');
    }

    if (authType === 'bearer') {
      return {
        Authorization: `Bearer ${credential}`,
      };
    }

    return {
      [connector.authHeaderName ?? 'X-API-Key']: credential,
    };
  }

  private async buildMissingCredentialResult(params: {
    connector: ConnectorSnapshot;
    action: ConnectorActionResult['action'] | 'connector.healthcheck';
    at: string;
    checkedAt?: string;
  }): Promise<ConnectorActionResult | ConnectorHealthResult> {
    const message = `${params.connector.name}: Credential fehlt`;
    await this.orchestrationService.appendAuditEntry({
      workspaceId: params.connector.workspaceId,
      action: params.action,
      severity: 'warning',
      details: message,
    });

    if (params.action === 'connector.healthcheck') {
      return {
        connectorId: params.connector.id,
        ok: false,
        message,
        checkedAt: params.checkedAt ?? params.at,
      };
    }

    return {
      connectorId: params.connector.id,
      action: params.action,
      ok: false,
      message,
      at: params.at,
    };
  }

  private async buildMissingCredentialActionResult(params: {
    connector: ConnectorSnapshot;
    action: ConnectorActionResult['action'];
    at: string;
  }): Promise<ConnectorActionResult> {
    return (await this.buildMissingCredentialResult(params)) as ConnectorActionResult;
  }

  private async buildMissingCredentialHealthResult(params: {
    connector: ConnectorSnapshot;
    checkedAt: string;
  }): Promise<ConnectorHealthResult> {
    return (await this.buildMissingCredentialResult({
      ...params,
      action: 'connector.healthcheck',
      at: params.checkedAt,
      checkedAt: params.checkedAt,
    })) as ConnectorHealthResult;
  }

  private async invokeConnectorAction(params: {
    kind: 'paperless' | 'n8n' | 'mail' | 'dropbox';
    action: ConnectorActionResult['action'];
    body: Record<string, string | number | boolean | null>;
  }): Promise<ConnectorActionResult> {
    const connector = this.getConnectorByKind(params.kind);
    const at = new Date().toISOString();

    if (!connector) {
      return {
        connectorId: `${params.kind}:missing`,
        action: params.action,
        ok: false,
        message: `${params.kind}-Connector nicht gefunden`,
        at,
      };
    }

    if (!connector.enabled) {
      return {
        connectorId: connector.id,
        action: params.action,
        ok: false,
        message: `${connector.name} ist deaktiviert`,
        at,
      };
    }

    const permission = await this.orchestrationService.evaluatePermission(
      'connector.dispatch'
    );
    if (!permission.ok) {
      await this.orchestrationService.appendAuditEntry({
        caseId: typeof params.body.caseId === 'string' ? params.body.caseId : undefined,
        workspaceId: connector.workspaceId,
        action: `${params.action}.denied`,
        severity: 'warning',
        details: permission.message,
        metadata: {
          connectorId: connector.id,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return {
        connectorId: connector.id,
        action: params.action,
        ok: false,
        message: permission.message,
        at,
      };
    }

    const authType = this.normalizeAuthType(connector.authType);
    if (authType !== 'none' && !this.secretStore.hasSecret(connector.id)) {
      return this.buildMissingCredentialActionResult({
        connector: {
          id: connector.id,
          workspaceId: connector.workspaceId,
          name: connector.name,
          authType: connector.authType,
        },
        action: params.action,
        at,
      });
    }

    if (authType !== 'none') {
      const rotationDays = this.parseRotationDays(
        connector.metadata?.rotationDays,
        30
      );
      const rotationMode = this.normalizeRotationMode(
        connector.metadata?.rotationMode
      );
      const credentialMeta = this.secretStore.getSecretMeta(connector.id);
      if (
        rotationMode === 'hard' &&
        this.isCredentialRotationDue(credentialMeta.updatedAt, rotationDays)
      ) {
        const message = `${connector.name}: Credential-Rotation erforderlich (> ${rotationDays} Tage)`;
        await this.orchestrationService.appendAuditEntry({
          caseId:
            typeof params.body.caseId === 'string' ? params.body.caseId : undefined,
          workspaceId: connector.workspaceId,
          action: params.action,
          severity: 'warning',
          details: `${message} (Hard-Mode blockiert Dispatch)`,
        });

        return {
          connectorId: connector.id,
          action: params.action,
          ok: false,
          message,
          at,
        };
      }
    }

    try {
      const authHeaders = await this.buildAuthHeaders(connector);
      const response = await fetch(connector.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(params.body),
      });

      const ok = response.ok;
      const message = ok ? 'OK' : `HTTP ${response.status}`;
      let data: unknown;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = undefined;
        }
      }

      await this.orchestrationService.appendWorkflowEvent({
        type: ok ? 'job.completed' : 'job.failed',
        actor: 'system',
        caseId: typeof params.body.caseId === 'string' ? params.body.caseId : undefined,
        workspaceId: connector.workspaceId,
        payload: {
          connectorId: connector.id,
          action: params.action,
          httpStatus: response.status,
        },
      });

      await this.orchestrationService.appendAuditEntry({
        caseId: typeof params.body.caseId === 'string' ? params.body.caseId : undefined,
        workspaceId: connector.workspaceId,
        action: params.action,
        severity: ok ? 'info' : 'warning',
        details: `${connector.name}: ${params.action} -> ${message}`,
      });

      return {
        connectorId: connector.id,
        action: params.action,
        ok,
        httpStatus: response.status,
        message,
        at,
        data,
      };
    } catch (error) {
      await this.orchestrationService.appendAuditEntry({
        caseId: typeof params.body.caseId === 'string' ? params.body.caseId : undefined,
        workspaceId: connector.workspaceId,
        action: params.action,
        severity: 'error',
        details: `${connector.name}: ${params.action} mit Fehler beendet`,
      });

      return {
        connectorId: connector.id,
        action: params.action,
        ok: false,
        message:
          error instanceof Error ? error.message : 'Unbekannter Connector-Fehler',
        at,
      };
    }
  }

  async healthcheckConnector(connectorId: string): Promise<ConnectorHealthResult> {
    const connector = (this.connectors$.value ?? []).find((item: ConnectorConfig) => item.id === connectorId);
    const checkedAt = new Date().toISOString();

    if (!connector) {
      return {
        connectorId,
        ok: false,
        message: 'Connector nicht gefunden',
        checkedAt,
      };
    }

    const permission = await this.orchestrationService.evaluatePermission(
      'connector.healthcheck'
    );
    if (!permission.ok) {
      await this.orchestrationService.appendAuditEntry({
        workspaceId: connector.workspaceId,
        action: 'connector.healthcheck.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          connectorId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return {
        connectorId,
        ok: false,
        message: permission.message,
        checkedAt,
      };
    }

    const authType = this.normalizeAuthType(connector.authType);
    if (authType !== 'none' && !this.secretStore.hasSecret(connector.id)) {
      return this.buildMissingCredentialHealthResult({
        connector: {
          id: connector.id,
          workspaceId: connector.workspaceId,
          name: connector.name,
          authType: connector.authType,
        },
        checkedAt,
      });
    }

    if (!connector.enabled) {
      await this.orchestrationService.upsertConnector({
        ...connector,
        status: 'disconnected',
        lastSyncedAt: connector.lastSyncedAt,
      });

      return {
        connectorId,
        ok: false,
        message: 'Connector ist deaktiviert',
        checkedAt,
      };
    }

    try {
      const authHeaders = await this.buildAuthHeaders(connector);
      const response = await fetch(connector.endpoint, {
        method: 'GET',
        headers: authHeaders,
      });

      const ok = response.ok;
      await this.orchestrationService.upsertConnector({
        ...connector,
        status: ok ? 'connected' : 'error',
        lastSyncedAt: checkedAt,
      });

      await this.orchestrationService.appendAuditEntry({
        workspaceId: connector.workspaceId,
        action: 'connector.healthcheck',
        severity: ok ? 'info' : 'warning',
        details: `${connector.name} Healthcheck ${ok ? 'ok' : 'fehlgeschlagen'} (${response.status})`,
      });

      return {
        connectorId,
        ok,
        httpStatus: response.status,
        message: ok ? 'OK' : 'Nicht erreichbar',
        checkedAt,
      };
    } catch (error) {
      await this.orchestrationService.upsertConnector({
        ...connector,
        status: 'error',
        lastSyncedAt: checkedAt,
      });
      await this.orchestrationService.appendAuditEntry({
        workspaceId: connector.workspaceId,
        action: 'connector.healthcheck',
        severity: 'error',
        details: `${connector.name} Healthcheck mit Fehler beendet`,
      });

      return {
        connectorId,
        ok: false,
        message:
          error instanceof Error ? error.message : 'Unbekannter Verbindungsfehler',
        checkedAt,
      };
    }
  }

  async triggerPaperlessIngest(input: {
    caseId: string;
    workspaceId: string;
    sourceRef: string;
  }) {
    return this.invokeConnectorAction({
      kind: 'paperless',
      action: 'paperless.ingest',
      body: {
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        sourceRef: input.sourceRef,
      },
    });
  }

  async dispatchN8nWorkflow(input: {
    caseId: string;
    workspaceId: string;
    workflow: string;
    payload?: Record<string, string>;
  }) {
    return this.invokeConnectorAction({
      kind: 'n8n',
      action: 'n8n.dispatch',
      body: {
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        workflow: input.workflow,
        ...input.payload,
      },
    });
  }

  async dispatchMailAction(input: {
    caseId: string;
    workspaceId: string;
    template: string;
    recipientCount: number;
  }) {
    return this.invokeConnectorAction({
      kind: 'mail',
      action: 'mail.dispatch',
      body: {
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        template: input.template,
        recipientCount: input.recipientCount,
      },
    });
  }

  async searchDropboxDocuments(input: {
    caseId: string;
    workspaceId: string;
    query: string;
    folderPath?: string;
    maxResults?: number;
  }) {
    return this.invokeConnectorAction({
      kind: 'dropbox',
      action: 'dropbox.search',
      body: {
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        query: input.query,
        folderPath: input.folderPath ?? '',
        maxResults: input.maxResults ?? 8,
      },
    });
  }
}
