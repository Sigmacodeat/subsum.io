import { Injectable } from '@nestjs/common';

import { Models } from '../../models';
import { AccessController } from './controller';
import type { Resource } from './resource';
import {
  mapOrgRoleToPermissions,
  OrgAction,
  OrgRole,
} from './types';

@Injectable()
export class OrganizationAccessController extends AccessController<'org'> {
  protected readonly type = 'org';

  constructor(private readonly models: Models) {
    super();
  }

  async role(resource: Resource<'org'>) {
    const role = await this.getRole(resource);

    return {
      role,
      permissions: mapOrgRoleToPermissions(role),
    };
  }

  async can(resource: Resource<'org'>, action: OrgAction) {
    const { permissions, role } = await this.role(resource);
    const allow = permissions[action] || false;

    if (!allow) {
      this.logger.debug('Organization access check failed', {
        action,
        resource,
        role,
      });
    }

    return allow;
  }

  async assert(resource: Resource<'org'>, action: OrgAction) {
    const allow = await this.can(resource, action);

    if (!allow) {
      throw new Error(
        `Access denied: user ${resource.userId} cannot perform ${action} on organization ${resource.organizationId}`
      );
    }
  }

  private async getRole(payload: Resource<'org'>): Promise<OrgRole | null> {
    const userRole = await this.models.organizationUser.getActive(
      payload.organizationId,
      payload.userId
    );

    return (userRole?.type as OrgRole) ?? null;
  }
}
