import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { SessionCache } from '../../base';
import { OAuthProviderFactory } from './factory';
import { OAuthPkceChallenge, OAuthState } from './types';

const OAUTH_STATE_KEY = 'OAUTH_STATE';
const OAUTH_STATE_TTL_MS = 3600 * 3 * 1000;
const UUID_V4_OR_V1_OR_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OAuthService {
  constructor(
    private readonly providerFactory: OAuthProviderFactory,
    private readonly cache: SessionCache
  ) {}

  isValidState(stateStr: string) {
    return UUID_V4_OR_V1_OR_V7_PATTERN.test(stateStr);
  }

  async saveOAuthState(state: OAuthState) {
    const token = randomUUID();
    const payload: OAuthState = { ...state, token };
    await this.cache.set(`${OAUTH_STATE_KEY}:${token}`, payload, {
      ttl: OAUTH_STATE_TTL_MS,
    });

    return token;
  }

  async getOAuthState(token: string) {
    if (!this.isValidState(token)) {
      return null;
    }
    return this.cache.get<OAuthState>(`${OAUTH_STATE_KEY}:${token}`);
  }

  async consumeOAuthState(token: string) {
    if (!this.isValidState(token)) {
      return null;
    }
    const key = `${OAUTH_STATE_KEY}:${token}`;
    const state = await this.cache.get<OAuthState>(key);
    if (!state) {
      return null;
    }

    await this.cache.delete(key);
    return state;
  }

  availableOAuthProviders() {
    return this.providerFactory.providers;
  }

  createPkcePair(): OAuthPkceChallenge {
    const codeVerifier = this.randomBase64Url(96);
    const hash = createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = this.base64UrlEncode(hash);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  private randomBase64Url(byteLength: number) {
    return this.base64UrlEncode(randomBytes(byteLength));
  }

  private base64UrlEncode(buffer: Buffer) {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
