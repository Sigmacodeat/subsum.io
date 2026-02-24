import { Mockers } from '../../mocks';
import { app, e2e } from '../test';

const gql = app.gql as any;

const createOrganizationMutation = {
  id: 'test.createOrganization',
  op: 'createOrganization',
  query: `mutation createOrganization($input: CreateOrganizationInput!) {
  createOrganization(input: $input) {
    id
    name
    slug
  }
}`,
};

const getOrganizationsQuery = {
  id: 'test.getOrganizations',
  op: 'getOrganizations',
  query: `query getOrganizations {
  organizations {
    id
    name
    slug
  }
}`,
};

const getOrganizationByIdQuery = {
  id: 'test.getOrganizationById',
  op: 'getOrganizationById',
  query: `query getOrganizationById($id: String!) {
  organization(id: $id) {
    id
    name
    slug
    members {
      id
      role
      user {
        id
        name
        email
      }
    }
    workspaces {
      id
      name
    }
  }
}`,
};

const updateOrganizationMutation = {
  id: 'test.updateOrganization',
  op: 'updateOrganization',
  query: `mutation updateOrganization($input: UpdateOrganizationInput!) {
  updateOrganization(input: $input) {
    id
    name
    slug
  }
}`,
};

const deleteOrganizationMutation = {
  id: 'test.deleteOrganization',
  op: 'deleteOrganization',
  query: `mutation deleteOrganization($id: String!) {
  deleteOrganization(id: $id)
}`,
};

const inviteOrgMemberMutation = {
  id: 'test.inviteOrgMember',
  op: 'inviteOrgMember',
  query: `mutation inviteOrgMember($input: InviteOrgMemberInput!) {
  inviteOrgMember(input: $input)
}`,
};

const changeOrgMemberRoleMutation = {
  id: 'test.changeOrgMemberRole',
  op: 'changeOrgMemberRole',
  query: `mutation changeOrgMemberRole($organizationId: String!, $userId: String!, $role: OrgRole!) {
  changeOrgMemberRole(organizationId: $organizationId, userId: $userId, role: $role)
}`,
};

const removeOrgMemberMutation = {
  id: 'test.removeOrgMember',
  op: 'removeOrgMember',
  query: `mutation removeOrgMember($organizationId: String!, $userId: String!) {
  removeOrgMember(organizationId: $organizationId, userId: $userId)
}`,
};

const assignWorkspaceToOrgMutation = {
  id: 'test.assignWorkspaceToOrg',
  op: 'assignWorkspaceToOrg',
  query: `mutation assignWorkspaceToOrg($organizationId: String!, $workspaceId: String!) {
  assignWorkspaceToOrg(organizationId: $organizationId, workspaceId: $workspaceId)
}`,
};

const unassignWorkspaceFromOrgMutation = {
  id: 'test.unassignWorkspaceFromOrg',
  op: 'unassignWorkspaceFromOrg',
  query: `mutation unassignWorkspaceFromOrg($organizationId: String!, $workspaceId: String!) {
  unassignWorkspaceFromOrg(organizationId: $organizationId, workspaceId: $workspaceId)
}`,
};

e2e('organization: create/list/get/update/delete flow', async t => {
  const owner = await app.create(Mockers.User);
  await app.login(owner);

  const createRes = (await gql({
    query: createOrganizationMutation,
    variables: {
      input: {
        name: 'Kanzlei Mustermann',
        slug: `kanzlei-${Date.now()}`,
      },
    },
  })) as any;

  t.truthy(createRes.createOrganization.id);

  const listRes = (await gql({
    query: getOrganizationsQuery,
  })) as any;
  t.true(
    listRes.organizations.some((o: any) => o.id === createRes.createOrganization.id),
    'new organization should be visible in organizations list'
  );

  const getRes = (await gql({
    query: getOrganizationByIdQuery,
    variables: { id: createRes.createOrganization.id },
  })) as any;
  t.is(getRes.organization.id, createRes.createOrganization.id);
  t.is(getRes.organization.name, 'Kanzlei Mustermann');

  const updateRes = (await gql({
    query: updateOrganizationMutation,
    variables: {
      input: {
        id: createRes.createOrganization.id,
        name: 'Kanzlei Mustermann & Partner',
        slug: `kanzlei-partner-${Date.now()}`,
      },
    },
  })) as any;
  t.is(updateRes.updateOrganization.name, 'Kanzlei Mustermann & Partner');

  const deleteRes = (await gql({
    query: deleteOrganizationMutation,
    variables: { id: createRes.createOrganization.id },
  })) as any;
  t.true(deleteRes.deleteOrganization);
});

e2e('organization: invite member, change role, remove member', async t => {
  const owner = await app.create(Mockers.User);
  const member = await app.create(Mockers.User);

  await app.login(owner);
  const createRes = (await gql({
    query: createOrganizationMutation,
    variables: {
      input: {
        name: 'Kanzlei Invite Test',
        slug: `org-invite-${Date.now()}`,
      },
    },
  })) as any;

  const organizationId = createRes.createOrganization.id;

  const inviteRes = (await gql({
    query: inviteOrgMemberMutation,
    variables: {
      input: {
        organizationId,
        email: member.email,
        role: 'Member',
      },
    },
  })) as any;
  t.true(inviteRes.inviteOrgMember);

  let getRes = (await gql({
    query: getOrganizationByIdQuery,
    variables: { id: organizationId },
  })) as any;
  const invited = getRes.organization.members.find((m: any) => m.user.id === member.id);
  t.truthy(invited, 'invited member should be in organization member list');

  const roleRes = (await gql({
    query: changeOrgMemberRoleMutation,
    variables: {
      organizationId,
      userId: member.id,
      role: 'Admin',
    },
  })) as any;
  t.true(roleRes.changeOrgMemberRole);

  getRes = (await gql({
    query: getOrganizationByIdQuery,
    variables: { id: organizationId },
  })) as any;
  const changed = getRes.organization.members.find((m: any) => m.user.id === member.id);
  t.is(changed?.role, 'Admin');

  const removeRes = (await gql({
    query: removeOrgMemberMutation,
    variables: {
      organizationId,
      userId: member.id,
    },
  })) as any;
  t.true(removeRes.removeOrgMember);

  getRes = (await gql({
    query: getOrganizationByIdQuery,
    variables: { id: organizationId },
  })) as any;
  t.false(
    getRes.organization.members.some((m: any) => m.user.id === member.id),
    'removed member should not remain in organization'
  );
});

e2e('organization: assign and unassign workspace', async t => {
  const owner = await app.create(Mockers.User);
  const workspace = await app.create(Mockers.Workspace, {
    owner: { id: owner.id },
  });

  await app.login(owner);
  const createRes = (await gql({
    query: createOrganizationMutation,
    variables: {
      input: {
        name: 'Kanzlei Workspace Binding',
        slug: `org-workspace-${Date.now()}`,
      },
    },
  })) as any;

  const organizationId = createRes.createOrganization.id;

  const assignRes = (await gql({
    query: assignWorkspaceToOrgMutation,
    variables: {
      organizationId,
      workspaceId: workspace.id,
    },
  })) as any;
  t.true(assignRes.assignWorkspaceToOrg);

  let getRes = (await gql({
    query: getOrganizationByIdQuery,
    variables: { id: organizationId },
  })) as any;
  t.true(
    getRes.organization.workspaces.some((w: any) => w.id === workspace.id),
    'workspace should be assigned to organization'
  );

  const unassignRes = (await gql({
    query: unassignWorkspaceFromOrgMutation,
    variables: {
      organizationId,
      workspaceId: workspace.id,
    },
  })) as any;
  t.true(unassignRes.unassignWorkspaceFromOrg);

  getRes = (await gql({
    query: getOrganizationByIdQuery,
    variables: { id: organizationId },
  })) as any;
  t.false(
    getRes.organization.workspaces.some((w: any) => w.id === workspace.id),
    'workspace should be unassigned from organization'
  );
});

e2e('organization: non-member cannot read organization', async t => {
  const owner = await app.create(Mockers.User);
  const outsider = await app.create(Mockers.User);

  await app.login(owner);
  const createRes = (await gql({
    query: createOrganizationMutation,
    variables: {
      input: {
        name: 'Kanzlei Permission',
        slug: `org-permission-${Date.now()}`,
      },
    },
  })) as any;

  await app.login(outsider);
  await t.throwsAsync(
    gql({
      query: getOrganizationByIdQuery,
      variables: { id: createRes.createOrganization.id },
    })
  );
});
