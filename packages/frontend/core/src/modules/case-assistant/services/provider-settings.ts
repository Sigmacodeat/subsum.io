import { Service } from '@toeverything/infra';

import type { CaseConnectorSecretStore } from '../stores/connector-secret';
import type { GlobalState } from '../../storage';
import type { WorkspaceService } from '../../workspace';

export type ProviderKey = 'ocr' | 'legal-analysis' | 'judikatur' | 'esign';

export type ProviderConfig = {
  endpoint: string;
  hasToken: boolean;
  tokenUpdatedAt?: string;
};

const PROVIDER_TOKEN_SECRET_ID: Record<ProviderKey, string> = {
  ocr: 'provider:ocr',
  'legal-analysis': 'provider:legal-analysis',
  judikatur: 'provider:judikatur',
  esign: 'provider:esign',
};

const PROVIDER_ENDPOINT_KEY: Record<ProviderKey, string> = {
  ocr: 'ocr-endpoint',
  'legal-analysis': 'legal-analysis-endpoint',
  judikatur: 'judikatur-endpoint',
  esign: 'esign-endpoint',
};

export class CaseProviderSettingsService extends Service {
  constructor(
    private readonly globalState: GlobalState,
    private readonly workspaceService: WorkspaceService,
    private readonly secretStore: CaseConnectorSecretStore
  ) {
    super();
  }

  private get workspaceId() {
    return this.workspaceService.workspace.id;
  }

  private endpointKey(provider: ProviderKey) {
    return `case-assistant:${this.workspaceId}:provider:${PROVIDER_ENDPOINT_KEY[provider]}`;
  }

  async getEndpoint(provider: ProviderKey) {
    const value = this.globalState.get<string>(this.endpointKey(provider));
    return value?.trim() || null;
  }

  async setEndpoint(provider: ProviderKey, endpoint: string) {
    const trimmed = endpoint.trim();
    if (!trimmed) {
      this.globalState.del(this.endpointKey(provider));
      return;
    }
    this.globalState.set(this.endpointKey(provider), trimmed);
  }

  async getToken(provider: ProviderKey) {
    return await this.secretStore.getSecret(PROVIDER_TOKEN_SECRET_ID[provider]);
  }

  async setToken(provider: ProviderKey, token: string) {
    await this.secretStore.setSecret(PROVIDER_TOKEN_SECRET_ID[provider], token.trim());
  }

  clearToken(provider: ProviderKey) {
    this.secretStore.clearSecret(PROVIDER_TOKEN_SECRET_ID[provider]);
  }

  async getProviderConfig(provider: ProviderKey): Promise<ProviderConfig> {
    const endpoint = (await this.getEndpoint(provider)) ?? '';
    const tokenMeta = this.secretStore.getSecretMeta(PROVIDER_TOKEN_SECRET_ID[provider]);

    return {
      endpoint,
      hasToken: tokenMeta.hasSecret,
      tokenUpdatedAt: tokenMeta.updatedAt,
    };
  }
}
