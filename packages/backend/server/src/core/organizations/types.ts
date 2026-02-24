import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { OrganizationMemberStatus } from '@prisma/client';

import { OrgRole } from '../permission';
import { WorkspaceUserType } from '../user/types';

registerEnumType(OrgRole, {
  name: 'OrgRole',
  description: 'User role in organization',
});

registerEnumType(OrganizationMemberStatus, {
  name: 'OrganizationMemberStatus',
  description: 'Member status in organization',
});

@ObjectType()
export class OrganizationType {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Organization name' })
  name!: string;

  @Field({ description: 'Organization slug (URL-friendly identifier)' })
  slug!: string;

  @Field(() => String, { nullable: true, description: 'Avatar key' })
  avatarKey!: string | null;

  @Field({ description: 'Organization created date' })
  createdAt!: Date;

  @Field(() => [OrgMemberType], {
    description: 'Members of organization',
  })
  members!: OrgMemberType[];
}

@ObjectType()
export class OrgMemberType {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Member user info' })
  user!: WorkspaceUserType;

  @Field(() => OrgRole, { description: 'User role in organization' })
  role!: OrgRole;

  @Field(() => OrganizationMemberStatus, {
    description: 'Member status in organization',
  })
  status!: OrganizationMemberStatus;

  @Field({ description: 'Member joined date' })
  createdAt!: Date;
}

@ObjectType()
export class OrgWorkspaceType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true, description: 'Workspace name' })
  name!: string | null;

  @Field({ description: 'Workspace created date' })
  createdAt!: Date;
}

@InputType()
export class CreateOrganizationInput {
  @Field({ description: 'Organization name' })
  name!: string;

  @Field({ description: 'Organization slug (URL-friendly identifier)' })
  slug!: string;
}

@InputType()
export class UpdateOrganizationInput {
  @Field(() => ID)
  id!: string;

  @Field({ nullable: true, description: 'Organization name' })
  name?: string;

  @Field({ nullable: true, description: 'Organization slug' })
  slug?: string;
}

@InputType()
export class InviteOrgMemberInput {
  @Field({ description: 'Organization ID' })
  organizationId!: string;

  @Field({ description: 'Email of the user to invite' })
  email!: string;

  @Field(() => OrgRole, {
    description: 'Role to assign',
    defaultValue: OrgRole.Member,
  })
  role!: OrgRole;
}
