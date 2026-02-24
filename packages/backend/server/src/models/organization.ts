import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { Prisma } from '@prisma/client';

import { EventBus } from '../base';
import { BaseModel } from './base';

declare global {
  interface Events {
    'organization.updated': {
      id: string;
      name: string;
    };
    'organization.deleted': {
      id: string;
    };
  }
}

@Injectable()
export class OrganizationModel extends BaseModel {
  constructor(private readonly event: EventBus) {
    super();
  }

  /**
   * Create a new organization and set the creator as Owner.
   */
  @Transactional()
  async create(userId: string, name: string, slug: string) {
    const organization = await this.db.organization.create({
      data: {
        name,
        slug,
      },
    });
    this.logger.log(`Organization created: ${organization.id} (${slug})`);
    await this.models.organizationUser.setOwner(organization.id, userId);
    return organization;
  }

  async get(organizationId: string) {
    return await this.db.organization.findUnique({
      where: { id: organizationId },
    });
  }

  async getBySlug(slug: string) {
    return await this.db.organization.findUnique({
      where: { slug },
    });
  }

  async update(
    organizationId: string,
    data: { name?: string; slug?: string; avatarKey?: string }
  ) {
    const organization = await this.db.organization.update({
      where: { id: organizationId },
      data,
    });
    this.event.emit('organization.updated', {
      id: organization.id,
      name: organization.name,
    });
    return organization;
  }

  async delete(organizationId: string) {
    // First unlink all workspaces
    await this.db.workspace.updateMany({
      where: { organizationId },
      data: { organizationId: null },
    });
    await this.db.organization.delete({
      where: { id: organizationId },
    });
    this.event.emit('organization.deleted', { id: organizationId });
    this.logger.log(`Organization [${organizationId}] deleted`);
  }

  async findMany(ids: string[]) {
    return await this.db.organization.findMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Get all workspaces belonging to an organization.
   */
  async getWorkspaces(organizationId: string) {
    return await this.db.workspace.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Assign a workspace to this organization.
   */
  async assignWorkspace(organizationId: string, workspaceId: string) {
    return await this.db.workspace.update({
      where: { id: workspaceId },
      data: { organizationId },
    });
  }

  /**
   * Remove workspace from organization.
   */
  async unassignWorkspace(workspaceId: string) {
    return await this.db.workspace.update({
      where: { id: workspaceId },
      data: { organizationId: null },
    });
  }

  async list<S extends Prisma.OrganizationSelect>(
    where: Prisma.OrganizationWhereInput = {},
    select?: S,
    limit?: number
  ) {
    return (await this.db.organization.findMany({
      where,
      select,
      take: limit,
      orderBy: { createdAt: 'asc' },
    })) as Prisma.OrganizationGetPayload<{ select: S }>[];
  }
}
