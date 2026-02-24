import { Service } from '@toeverything/infra';

import type { WorkspaceService } from '../../workspace';
import type { CaseAssistantStore } from '../stores/case-assistant';
import type { WorkspaceResidencyPolicy } from '../types';

export type ResidencyCapability = 'remote_ocr' | 'external_connectors' | 'cloud_sync';

export class CaseResidencyPolicyService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly workspaceService: WorkspaceService
  ) {
    super();
  }

  readonly policy$ = this.store.watchWorkspaceResidencyPolicy();

  private get workspaceId() {
    return this.workspaceService.workspace.id;
  }

  private buildDefaultPolicy(): WorkspaceResidencyPolicy {
    const now = new Date().toISOString();
    const isLocalWorkspace = this.workspaceService.workspace.flavour === 'local';

    if (isLocalWorkspace) {
      return {
        workspaceId: this.workspaceId,
        mode: 'local_only',
        allowCloudSync: false,
        allowRemoteOcr: false,
        allowExternalConnectors: false,
        allowTelemetry: false,
        requireMfaForAdmins: true,
        requireMfaForMembers: false,
        enforceEncryptionAtRest: true,
        sessionIdleTimeoutMinutes: 30,
        updatedAt: now,
      };
    }

    return {
      workspaceId: this.workspaceId,
      mode: 'cloud',
      allowCloudSync: true,
      allowRemoteOcr: true,
      allowExternalConnectors: true,
      allowTelemetry: true,
      requireMfaForAdmins: true,
      requireMfaForMembers: false,
      enforceEncryptionAtRest: true,
      sessionIdleTimeoutMinutes: 60,
      updatedAt: now,
    };
  }

  async getPolicy(): Promise<WorkspaceResidencyPolicy> {
    const existing = await this.store.getWorkspaceResidencyPolicy();
    if (existing?.workspaceId === this.workspaceId) {
      const normalized = {
        ...this.buildDefaultPolicy(),
        ...existing,
        workspaceId: this.workspaceId,
      };
      if (JSON.stringify(normalized) !== JSON.stringify(existing)) {
        await this.store.setWorkspaceResidencyPolicy(normalized);
      }
      return normalized;
    }

    const defaultPolicy = this.buildDefaultPolicy();
    await this.store.setWorkspaceResidencyPolicy(defaultPolicy);
    return defaultPolicy;
  }

  async setPolicy(policy: WorkspaceResidencyPolicy) {
    const defaultPolicy = this.buildDefaultPolicy();
    const next: WorkspaceResidencyPolicy = {
      ...defaultPolicy,
      ...policy,
      workspaceId: this.workspaceId,
      sessionIdleTimeoutMinutes: Math.min(
        240,
        Math.max(5, Number(policy.sessionIdleTimeoutMinutes ?? defaultPolicy.sessionIdleTimeoutMinutes))
      ),
      updatedAt: new Date().toISOString(),
    };
    await this.store.setWorkspaceResidencyPolicy(next);
    return next;
  }

  async assertCapabilityAllowed(capability: ResidencyCapability): Promise<{
    ok: boolean;
    policy: WorkspaceResidencyPolicy;
    reason?: string;
  }> {
    const policy = await this.getPolicy();

    if (capability === 'remote_ocr' && !policy.allowRemoteOcr) {
      return {
        ok: false,
        policy,
        reason: 'Remote OCR ist durch die Workspace-Residency-Policy deaktiviert.',
      };
    }

    if (capability === 'external_connectors' && !policy.allowExternalConnectors) {
      return {
        ok: false,
        policy,
        reason: 'Externe Connectoren sind durch die Workspace-Residency-Policy deaktiviert.',
      };
    }

    if (capability === 'cloud_sync' && !policy.allowCloudSync) {
      return {
        ok: false,
        policy,
        reason: 'Cloud-Synchronisation ist durch die Workspace-Residency-Policy deaktiviert.',
      };
    }

    return { ok: true, policy };
  }
}
