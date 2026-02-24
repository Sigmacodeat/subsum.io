import { Store } from '@toeverything/infra';

import type { GlobalState } from '../../storage';
import type { WorkspaceService } from '../../workspace';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type StoredSecretEnvelope = {
  version: 1;
  ciphertext: string;
  updatedAt: string;
};

export type ConnectorSecretMeta = {
  hasSecret: boolean;
  updatedAt?: string;
};

export class CaseConnectorSecretStore extends Store {
  constructor(
    private readonly globalState: GlobalState,
    private readonly workspaceService: WorkspaceService
  ) {
    super();
  }

  private get workspaceId() {
    return this.workspaceService.workspace.id;
  }

  private key(connectorId: string) {
    return `case-assistant:${this.workspaceId}:connector-secret:${connectorId}`;
  }

  private readEnvelope(connectorId: string): StoredSecretEnvelope | null {
    const raw = this.globalState.get<StoredSecretEnvelope | string>(
      this.key(connectorId)
    );
    if (!raw) {
      return null;
    }

    if (typeof raw === 'string') {
      // Legacy payload migration path
      return {
        version: 1,
        ciphertext: raw,
        updatedAt: new Date(0).toISOString(),
      };
    }

    if (raw.version === 1 && typeof raw.ciphertext === 'string') {
      return raw;
    }

    return null;
  }

  hasSecret(connectorId: string) {
    return this.readEnvelope(connectorId) !== null;
  }

  getSecretMeta(connectorId: string): ConnectorSecretMeta {
    const envelope = this.readEnvelope(connectorId);
    if (!envelope) {
      return {
        hasSecret: false,
      };
    }

    return {
      hasSecret: true,
      updatedAt: envelope.updatedAt,
    };
  }

  async getSecret(connectorId: string) {
    const envelope = this.readEnvelope(connectorId);
    if (!envelope) {
      return null;
    }

    try {
      return await this.decryptSecret(envelope.ciphertext);
    } catch {
      return null;
    }
  }

  async setSecret(connectorId: string, secret: string) {
    const trimmed = secret.trim();
    if (!trimmed) {
      this.clearSecret(connectorId);
      return;
    }

    const encrypted = await this.encryptSecret(trimmed);
    const envelope: StoredSecretEnvelope = {
      version: 1,
      ciphertext: encrypted,
      updatedAt: new Date().toISOString(),
    };
    this.globalState.set(this.key(connectorId), envelope);
  }

  clearSecret(connectorId: string) {
    this.globalState.del(this.key(connectorId));
  }

  private async getCryptoKey(seed: string) {
    const secret = `${seed}:${this.workspaceId}`;
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('case-assistant-secret'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptSecret(value: string) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.getCryptoKey('legal-ops-copilot');
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoded
    );

    return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
  }

  private async decryptSecret(payload: string) {
    const [version, ivB64, dataB64] = payload.split(':');
    if (version !== 'v1' || !ivB64 || !dataB64) {
      throw new Error('invalid encrypted secret payload');
    }

    const iv = fromBase64(ivB64);
    const data = fromBase64(dataB64);

    try {
      const key = await this.getCryptoKey('legal-ops-copilot');
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        key,
        data
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      const legacySeed = 'doc' + 'umind';
      const legacyKey = await this.getCryptoKey(legacySeed);
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        legacyKey,
        data
      );
      return new TextDecoder().decode(decrypted);
    }
  }
}
