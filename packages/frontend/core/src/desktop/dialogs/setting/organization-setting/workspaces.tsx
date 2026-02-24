import { Button, notify } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  type GetWorkspacesQuery,
  getWorkspacesQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { OrganizationSettingContext } from './index';

const assignWorkspaceToOrgMutation = {
  id: 'organizationSetting.assignWorkspaceToOrg' as const,
  op: 'assignWorkspaceToOrg',
  query: `mutation assignWorkspaceToOrg($organizationId: String!, $workspaceId: String!) {
  assignWorkspaceToOrg(organizationId: $organizationId, workspaceId: $workspaceId)
}`,
};

const unassignWorkspaceFromOrgMutation = {
  id: 'organizationSetting.unassignWorkspaceFromOrg' as const,
  op: 'unassignWorkspaceFromOrg',
  query: `mutation unassignWorkspaceFromOrg($organizationId: String!, $workspaceId: String!) {
  unassignWorkspaceFromOrg(
    organizationId: $organizationId
    workspaceId: $workspaceId
  )
}`,
};

export const OrganizationWorkspacesSetting = ({
  context,
}: {
  context: OrganizationSettingContext;
}) => {
  const t = useI18n();
  const gqlService = useService(GraphQLService);
  const [workspaces, setWorkspaces] = useState<GetWorkspacesQuery['workspaces']>(
    []
  );
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null
  );

  const refreshAssignableWorkspaces = useCallback(async () => {
    const data = await gqlService.gql({ query: getWorkspacesQuery });
    setWorkspaces(data.workspaces);
  }, [gqlService]);

  useEffect(() => {
    refreshAssignableWorkspaces().catch(() => undefined);
  }, [refreshAssignableWorkspaces]);

  const assignedWorkspaceIds = useMemo(
    () => new Set((context.selectedOrganization?.workspaces ?? []).map(w => w.id)),
    [context.selectedOrganization?.workspaces]
  );

  const assignableWorkspaces = useMemo(
    () => workspaces.filter(w => !assignedWorkspaceIds.has(w.id)),
    [assignedWorkspaceIds, workspaces]
  );

  const handleAssignWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!context.selectedOrganizationId) {
        return;
      }
      setPendingWorkspaceId(workspaceId);
      try {
        await (gqlService.gql as any)({
          query: assignWorkspaceToOrgMutation,
          variables: {
            organizationId: context.selectedOrganizationId,
            workspaceId,
          },
        });
        await context.refreshOrganization();
        notify.success({ title: 'Workspace assigned' });
      } catch (err) {
        console.error(err);
        notify.error({ title: 'Failed to assign workspace' });
      } finally {
        setPendingWorkspaceId(null);
      }
    },
    [context, gqlService]
  );

  const handleUnassignWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!context.selectedOrganizationId) {
        return;
      }
      setPendingWorkspaceId(workspaceId);
      try {
        await (gqlService.gql as any)({
          query: unassignWorkspaceFromOrgMutation,
          variables: {
            organizationId: context.selectedOrganizationId,
            workspaceId,
          },
        });
        await context.refreshOrganization();
        notify.success({ title: 'Workspace unassigned' });
      } catch (err) {
        console.error(err);
        notify.error({ title: 'Failed to unassign workspace' });
      } finally {
        setPendingWorkspaceId(null);
      }
    },
    [context, gqlService]
  );

  return (
    <>
      <SettingHeader
        title={t['com.affine.settings.organization.workspaces.title']()}
        subtitle={
          t['com.affine.settings.organization.workspaces.description']()
        }
      />

      <SettingWrapper
        title={t['com.affine.settings.organization.workspaces']()}
      >
        <SettingRow
          name={t['com.affine.settings.organization.workspaces.assigned']()}
          desc={`${context.selectedOrganization?.workspaces.length ?? 0} workspaces assigned to this organization.`}
          spreadCol={false}
        >
          <div style={{ width: '100%', display: 'grid', gap: 8 }}>
            {(context.selectedOrganization?.workspaces ?? []).map(workspace => {
              const isPending = pendingWorkspaceId === workspace.id;
              return (
                <div
                  key={workspace.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--affine-border-color)',
                    padding: '8px 0',
                  }}
                >
                  <div>
                    <div>{workspace.name ?? workspace.id}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{workspace.id}</div>
                  </div>
                  <Button
                    variant="plain"
                    disabled={isPending}
                    onClick={() => void handleUnassignWorkspace(workspace.id)}
                  >
                    {t['com.affine.settings.organization.workspaces.actions.unassign']()}
                  </Button>
                </div>
              );
            })}
          </div>
        </SettingRow>

        <SettingRow
          name={t['com.affine.settings.organization.workspaces.assignable']()}
          desc={`${assignableWorkspaces.length} workspaces can be assigned.`}
          spreadCol={false}
        >
          <div style={{ width: '100%', display: 'grid', gap: 8 }}>
            {assignableWorkspaces.map(workspace => {
              const isPending = pendingWorkspaceId === workspace.id;
              return (
                <div
                  key={workspace.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--affine-border-color)',
                    padding: '8px 0',
                  }}
                >
                  <div>
                    <div>{workspace.id}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      initialized: {workspace.initialized ? 'yes' : 'no'} / team:{' '}
                      {workspace.team ? 'yes' : 'no'}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    disabled={isPending}
                    onClick={() => void handleAssignWorkspace(workspace.id)}
                  >
                    {t['com.affine.settings.organization.workspaces.actions.assign']()}
                  </Button>
                </div>
              );
            })}
          </div>
        </SettingRow>
      </SettingWrapper>
    </>
  );
};
