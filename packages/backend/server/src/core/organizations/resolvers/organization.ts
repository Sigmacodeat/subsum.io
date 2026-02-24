import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import { Models } from '../../../models';
import { CurrentUser } from '../../auth';
import { AccessController, OrgRole } from '../../permission';
import { OrganizationService } from '../service';
import {
  CreateOrganizationInput,
  OrgMemberType,
  OrganizationType,
  OrgWorkspaceType,
  UpdateOrganizationInput,
} from '../types';

@Resolver(() => OrganizationType)
export class OrganizationResolver {
  constructor(
    private readonly models: Models,
    private readonly ac: AccessController,
    private readonly orgService: OrganizationService
  ) {}

  @Query(() => [OrganizationType], {
    description: 'Get all organizations for the current user',
  })
  async organizations(@CurrentUser() user: CurrentUser) {
    const roles = await this.models.organizationUser.getUserActiveRoles(
      user.id
    );

    const orgIds = roles.map(r => r.organizationId);
    const orgs = await this.models.organization.findMany(orgIds);

    return orgs;
  }

  @Query(() => OrganizationType, {
    description: 'Get organization by id',
  })
  async organization(
    @CurrentUser() user: CurrentUser,
    @Args('id') id: string
  ) {
    await this.ac
      .user(user.id)
      .organization(id)
      .assert('Organization.Read');

    const org = await this.models.organization.get(id);

    if (!org) {
      throw new Error('Organization not found');
    }

    return org;
  }

  @ResolveField(() => [OrgMemberType], {
    description: 'Members of the organization',
  })
  async members(
    @CurrentUser() user: CurrentUser,
    @Parent() org: OrganizationType,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number
  ) {
    await this.ac
      .user(user.id)
      .organization(org.id)
      .assert('Organization.Members.Read');

    const [members] = await this.models.organizationUser.paginate(org.id, {
      first: take ?? 50,
      offset: skip ?? 0,
    });

    return members.map(m => ({
      id: m.id,
      user: m.user,
      role: m.type as OrgRole,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }

  @ResolveField(() => Int, {
    description: 'Number of members in the organization',
  })
  async memberCount(@Parent() org: OrganizationType) {
    return this.models.organizationUser.count(org.id);
  }

  @ResolveField(() => [OrgWorkspaceType], {
    description: 'Workspaces belonging to the organization',
  })
  async workspaces(
    @CurrentUser() user: CurrentUser,
    @Parent() org: OrganizationType
  ) {
    await this.ac
      .user(user.id)
      .organization(org.id)
      .assert('Organization.Workspaces.Read');

    return this.models.organization.getWorkspaces(org.id);
  }

  @Mutation(() => OrganizationType, {
    description: 'Create a new organization',
  })
  async createOrganization(
    @CurrentUser() user: CurrentUser,
    @Args('input') input: CreateOrganizationInput
  ) {
    return this.orgService.createOrganization(user.id, input.name, input.slug);
  }

  @Mutation(() => OrganizationType, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @CurrentUser() user: CurrentUser,
    @Args('input') input: UpdateOrganizationInput
  ) {
    await this.ac
      .user(user.id)
      .organization(input.id)
      .assert('Organization.Update');

    const data: Record<string, string> = {};
    if (input.name) data.name = input.name;
    if (input.slug) data.slug = input.slug;

    return this.models.organization.update(input.id, data);
  }

  @Mutation(() => Boolean, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @CurrentUser() user: CurrentUser,
    @Args('id') id: string
  ) {
    await this.ac
      .user(user.id)
      .organization(id)
      .assert('Organization.Delete');

    await this.models.organization.delete(id);
    return true;
  }
}
