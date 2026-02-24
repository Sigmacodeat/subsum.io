import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { OrganizationMemberStatus } from '@prisma/client';

import { Models } from '../../../models';
import { CurrentUser } from '../../auth';
import { AccessController, OrgRole } from '../../permission';
import { OrganizationService } from '../service.js';
import { InviteOrgMemberInput, OrganizationType } from '../types';

@Resolver(() => OrganizationType)
export class OrganizationMemberResolver {
  constructor(
    private readonly models: Models,
    private readonly ac: AccessController,
    private readonly orgService: OrganizationService
  ) {}

  @Mutation(() => Boolean, {
    description: 'Invite a user to an organization',
  })
  async inviteOrgMember(
    @CurrentUser() user: CurrentUser,
    @Args('input') input: InviteOrgMemberInput
  ) {
    await this.ac
      .user(user.id)
      .organization(input.organizationId)
      .assert('Organization.Members.Invite');

    await this.orgService.inviteMember(
      input.organizationId,
      input.email,
      input.role,
      user.id
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Accept an organization invitation',
  })
  async acceptOrgInvitation(
    @CurrentUser() user: CurrentUser,
    @Args('organizationId') organizationId: string
  ) {
    const role = await this.models.organizationUser.get(
      organizationId,
      user.id
    );

    if (!role) {
      throw new Error('Invitation not found');
    }

    if (role.status !== OrganizationMemberStatus.Pending) {
      throw new Error('Invitation already processed');
    }

    await this.models.organizationUser.setStatus(
      organizationId,
      user.id,
      OrganizationMemberStatus.Accepted
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Remove a member from an organization',
  })
  async removeOrgMember(
    @CurrentUser() user: CurrentUser,
    @Args('organizationId') organizationId: string,
    @Args('userId') userId: string
  ) {
    if (userId === user.id) {
      throw new Error('Cannot remove yourself from the organization');
    }

    await this.ac
      .user(user.id)
      .organization(organizationId)
      .assert('Organization.Members.Remove');

    const role = await this.models.organizationUser.get(
      organizationId,
      userId
    );

    if (!role) {
      throw new Error('Member not found in organization');
    }

    if ((role.type as OrgRole) === OrgRole.Owner) {
      throw new Error('Cannot remove the owner of the organization');
    }

    await this.models.organizationUser.delete(organizationId, userId);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Change the role of a member in an organization',
  })
  async changeOrgMemberRole(
    @CurrentUser() user: CurrentUser,
    @Args('organizationId') organizationId: string,
    @Args('userId') userId: string,
    @Args('role', { type: () => OrgRole }) newRole: OrgRole
  ) {
    if (newRole === OrgRole.Owner) {
      await this.ac
        .user(user.id)
        .organization(organizationId)
        .assert('Organization.TransferOwner');

      await this.models.organizationUser.setOwner(organizationId, userId);
    } else {
      await this.ac
        .user(user.id)
        .organization(organizationId)
        .assert('Organization.Members.Manage');

      await this.models.organizationUser.set(
        organizationId,
        userId,
        newRole
      );
    }

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Assign a workspace to an organization',
  })
  async assignWorkspaceToOrg(
    @CurrentUser() user: CurrentUser,
    @Args('organizationId') organizationId: string,
    @Args('workspaceId') workspaceId: string
  ) {
    await this.ac
      .user(user.id)
      .organization(organizationId)
      .assert('Organization.Workspaces.Assign');

    // Verify workspace ownership
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.models.organization.assignWorkspace(
      organizationId,
      workspaceId
    );
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Unassign a workspace from an organization',
  })
  async unassignWorkspaceFromOrg(
    @CurrentUser() user: CurrentUser,
    @Args('organizationId') organizationId: string,
    @Args('workspaceId') workspaceId: string
  ) {
    await this.ac
      .user(user.id)
      .organization(organizationId)
      .assert('Organization.Workspaces.Unassign');

    await this.models.organization.unassignWorkspace(workspaceId);
    return true;
  }
}
