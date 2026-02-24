import type {
  CanActivate,
  ExecutionContext,
  OnModuleInit,
} from '@nestjs/common';
import { Injectable, UseGuards } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import {
  ActionForbidden,
  Config,
  SessionCache,
  getRequestResponseFromContext,
} from '../../base';
import { FeatureService } from '../features/service';

const ADMIN_STEP_UP_PREFIX = 'ADMIN_STEP_UP_SESSION';

@Injectable()
export class AdminGuard implements CanActivate, OnModuleInit {
  private feature!: FeatureService;
  private cache!: SessionCache;

  constructor(
    private readonly ref: ModuleRef,
    private readonly config: Config
  ) {}

  onModuleInit() {
    this.feature = this.ref.get(FeatureService, { strict: false });
    this.cache = this.ref.get(SessionCache, { strict: false });
  }

  async canActivate(context: ExecutionContext) {
    const { req } = getRequestResponseFromContext(context);
    let allow = false;
    if (req.session) {
      allow = await this.feature.isAdmin(req.session.user.id);
    }

    if (!allow) {
      throw new ActionForbidden();
    }

    if (req.session?.sessionId && req.session?.createdAt) {
      const now = Date.now();
      const graceWindowMs = this.config.auth.adminSession.stepUpTtl * 1000;
      const sessionAgeMs = now - req.session.createdAt.getTime();

      if (sessionAgeMs > graceWindowMs) {
        const hasStepUp = await this.cache.has(
          `${ADMIN_STEP_UP_PREFIX}:${req.session.sessionId}`
        );
        if (!hasStepUp) {
          throw new ActionForbidden();
        }
      }
    }

    return true;
  }
}

/**
 * This guard is used to protect routes/queries/mutations that require a user to be administrator.
 *
 * @example
 *
 * ```typescript
 * \@Admin()
 * \@Mutation(() => UserType)
 * createAccount(userInput: UserInput) {
 *   // ...
 * }
 * ```
 */
export const Admin = () => {
  return UseGuards(AdminGuard);
};
