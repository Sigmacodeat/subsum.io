import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { SessionCache } from '../../base';
import { CalendarProviderName } from './providers';

export interface CalendarOAuthState {
  provider: CalendarProviderName;
  userId: string;
  redirectUri?: string;
  token?: string;
}

const CALENDAR_OAUTH_STATE_KEY = 'CALENDAR_OAUTH_STATE';
const CALENDAR_OAUTH_STATE_TTL_MS = 3600 * 3 * 1000;
const UUID_V4_OR_V1_OR_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CalendarOAuthService {
  constructor(private readonly cache: SessionCache) {}

  isValidState(stateStr: string) {
    return UUID_V4_OR_V1_OR_V7_PATTERN.test(stateStr);
  }

  async saveOAuthState(state: CalendarOAuthState) {
    const token = randomUUID();
    const payload: CalendarOAuthState = { ...state, token };
    await this.cache.set(`${CALENDAR_OAUTH_STATE_KEY}:${token}`, payload, {
      ttl: CALENDAR_OAUTH_STATE_TTL_MS,
    });
    return token;
  }

  async getOAuthState(token: string) {
    if (!this.isValidState(token)) {
      return null;
    }
    return this.cache.get<CalendarOAuthState>(
      `${CALENDAR_OAUTH_STATE_KEY}:${token}`
    );
  }
}
