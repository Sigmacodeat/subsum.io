import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OrganizationMemberStatus } from '@prisma/client';

import { EventBus, PaginationInput } from '../base';
import { BaseModel } from './base';
import { OrgRole } from './common';

export { OrganizationMemberStatus };

declare global {
  interface Events {
    'organization.owner.changed': {
      organizationId: string;
      from: string;
      to: string;
    };
    'organization.members.updated': {
      organizationId: string;
    };
    'organization.members.removed': {
      userId: string;
      organizationId: string;
    };
  }
}

@Injectable()
export class OrganizationUserModel extends BaseModel {
  constructor(private readonly event: EventBus) {
    super();
  }

  /**
   * Set or update the [Owner] of an organization.
   * The old [Owner] will be changed to [Admin].
   */
  @Transactional()
  async setOwner(organizationId: string, userId: string) {
    const oldOwner = await this.db.organizationUserRole.findFirst({
      where: {
        organizationId,
        type: OrgRole.Owner,
      },
    });

    if (oldOwner) {
      const newOwnerOldRole = await this.db.organizationUserRole.findFirst({
        where: { organizationId, userId },
      });

      if (
        !newOwnerOldRole ||
        newOwnerOldRole.status !== OrganizationMemberStatus.Accepted
      ) {
        throw new Error('New owner must be an active member of the organization.');
      }

      await this.db.organizationUserRole.update({
        where: { id: oldOwner.id },
        data: { type: OrgRole.Admin },
      });
      await this.db.organizationUserRole.update({
        where: { id: newOwnerOldRole.id },
        data: { type: OrgRole.Owner },
      });
      this.event.emit('organization.owner.changed', {
        organizationId,
        from: oldOwner.userId,
        to: userId,
      });
      this.logger.log(
        `Transfer org owner of [${organizationId}] from [${oldOwner.userId}] to [${userId}]`
      );
    } else {
      await this.db.organizationUserRole.create({
        data: {
          organizationId,
          userId,
          type: OrgRole.Owner,
          status: OrganizationMemberStatus.Accepted,
        },
      });
      this.logger.log(
        `Set org owner of [${organizationId}] to [${userId}]`
      );
    }
  }

  /**
   * Set or update the Role of a user in an organization.
   * Do NOT use this to set Owner – use setOwner instead.
   */
  @Transactional()
  async set(
    organizationId: string,
    userId: string,
    role: OrgRole,
    defaultData: {
      status?: OrganizationMemberStatus;
      inviterId?: string;
    } = {}
  ) {
    if (role === OrgRole.Owner) {
      throw new Error('Cannot grant Owner role directly. Use setOwner instead.');
    }

    const oldRole = await this.get(organizationId, userId);

    if (oldRole) {
      if (oldRole.type === role) {
        return oldRole;
      }
      return await this.db.organizationUserRole.update({
        where: { id: oldRole.id },
        data: { type: role },
      });
    } else {
      const {
        status = OrganizationMemberStatus.Pending,
        inviterId,
      } = defaultData;
      return await this.db.organizationUserRole.create({
        data: {
          organizationId,
          userId,
          type: role,
          status,
          inviterId,
        },
      });
    }
  }

  async setStatus(
    organizationId: string,
    userId: string,
    status: OrganizationMemberStatus
  ) {
    return await this.db.organizationUserRole.update({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      data: { status },
    });
  }

  async delete(organizationId: string, userId: string) {
    await this.db.organizationUserRole.deleteMany({
      where: { organizationId, userId },
    });
  }

  async get(organizationId: string, userId: string) {
    return await this.db.organizationUserRole.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
  }

  async getActive(organizationId: string, userId: string) {
    return await this.db.organizationUserRole.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
        status: OrganizationMemberStatus.Accepted,
      },
    });
  }

  async getOwner(organizationId: string) {
    const role = await this.db.organizationUserRole.findFirst({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      where: {
        organizationId,
        type: OrgRole.Owner,
      },
    });

    if (!role) {
      throw new Error('Organization owner not found');
    }

    return role.user;
  }

  async count(organizationId: string) {
    return this.db.organizationUserRole.count({
      where: { organizationId },
    });
  }

  /**
   * Get all active org roles for a given user (user can be in multiple orgs).
   */
  async getUserActiveRoles(userId: string, filter: { role?: OrgRole } = {}) {
    return await this.db.organizationUserRole.findMany({
      where: {
        userId,
        status: OrganizationMemberStatus.Accepted,
        type: filter.role,
      },
    });
  }

  async paginate(organizationId: string, pagination: PaginationInput) {
    return await Promise.all([
      this.db.organizationUserRole.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        where: {
          organizationId,
          createdAt: pagination.after
            ? { gte: pagination.after }
            : undefined,
        },
        orderBy: { createdAt: 'asc' },
        take: pagination.first,
        skip: pagination.offset + (pagination.after ? 1 : 0),
      }),
      this.count(organizationId),
    ]);
  }
}
