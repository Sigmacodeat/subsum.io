import { Injectable, Logger } from '@nestjs/common';
import { OrganizationMemberStatus } from '@prisma/client';

import { Models } from '../../models';
import { OrgRole } from '../permission';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(private readonly models: Models) {}

  /**
   * Create a new organization and set the creator as Owner.
   */
  async createOrganization(userId: string, name: string, slug: string) {
    // Validate slug format
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      throw new Error(
        'Slug must be lowercase alphanumeric with optional hyphens, not starting/ending with hyphen'
      );
    }

    // Check slug uniqueness
    const existing = await this.models.organization.getBySlug(slug);
    if (existing) {
      throw new Error('Organization slug already taken');
    }

    const org = await this.models.organization.create(userId, name, slug);
    this.logger.log(
      `Organization created: ${org.id} (${slug}) by user ${userId}`
    );
    return org;
  }

  /**
   * Invite a user (by email) to an organization with a given role.
   */
  async inviteMember(
    organizationId: string,
    email: string,
    role: OrgRole,
    inviterId: string
  ) {
    // Find user by email
    const user = await this.models.user.getUserByEmail(email);
    if (!user) {
      throw new Error(`User with email ${email} not found`);
    }

    // Check if already a member
    const existingRole = await this.models.organizationUser.get(
      organizationId,
      user.id
    );
    if (existingRole) {
      if (existingRole.status === OrganizationMemberStatus.Accepted) {
        throw new Error('User is already a member of this organization');
      }
      // Update pending invitation role
      await this.models.organizationUser.set(organizationId, user.id, role);
      return;
    }

    // Create new invitation
    await this.models.organizationUser.set(organizationId, user.id, role, {
      status: OrganizationMemberStatus.Pending,
      inviterId,
    });

    this.logger.log(
      `User ${user.id} invited to organization ${organizationId} with role ${role}`
    );
  }

  /**
   * Create a new workspace within an organization.
   */
  async createWorkspaceInOrg(organizationId: string, userId: string) {
    const workspace = await this.models.workspace.create(userId);
    await this.models.organization.assignWorkspace(
      organizationId,
      workspace.id
    );
    this.logger.log(
      `Workspace ${workspace.id} created in organization ${organizationId}`
    );
    return workspace;
  }
}
