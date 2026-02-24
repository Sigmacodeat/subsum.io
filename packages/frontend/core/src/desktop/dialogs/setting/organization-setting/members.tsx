import { Button, Input, notify } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { GraphQLService } from '@affine/core/modules/cloud';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import type { SettingState } from '../types';
import type { OrganizationSettingContext } from './index';

type OrgRole = 'Owner' | 'Admin' | 'Member';

const OrgRole = {
  Owner: 'Owner' as OrgRole,
  Admin: 'Admin' as OrgRole,
  Member: 'Member' as OrgRole,
};

const inviteOrgMemberMutation = {
  id: 'organizationSetting.inviteOrgMember' as const,
  op: 'inviteOrgMember',
  query: `mutation inviteOrgMember($input: InviteOrgMemberInput!) {
  inviteOrgMember(input: $input)
}`,
};

const removeOrgMemberMutation = {
  id: 'organizationSetting.removeOrgMember' as const,
  op: 'removeOrgMember',
  query: `mutation removeOrgMember($organizationId: String!, $userId: String!) {
  removeOrgMember(organizationId: $organizationId, userId: $userId)
}`,
};

const changeOrgMemberRoleMutation = {
  id: 'organizationSetting.changeOrgMemberRole' as const,
  op: 'changeOrgMemberRole',
  query: `mutation changeOrgMemberRole($organizationId: String!, $userId: String!, $role: OrgRole!) {
  changeOrgMemberRole(organizationId: $organizationId, userId: $userId, role: $role)
}`,
};

export const OrganizationMembersSetting = ({
  onChangeSettingState: _onChangeSettingState,
  context,
}: {
  onChangeSettingState: (settingState: SettingState) => void;
  context: OrganizationSettingContext;
}) => {
  const t = useI18n();
  const gqlService = useService(GraphQLService);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [changingMemberId, setChangingMemberId] = useState<string | null>(null);

  const canManageMembers = !!context.selectedOrganizationId;

  const handleInvite = useCallback(async () => {
    if (!context.selectedOrganizationId) {
      notify.error({ title: 'No organization selected' });
      return;
    }

    if (!inviteEmail.trim()) {
      notify.error({ title: 'Email is required' });
      return;
    }
    setIsInviting(true);
    try {
      await (gqlService.gql as any)({
        query: inviteOrgMemberMutation,
        variables: {
          input: {
            organizationId: context.selectedOrganizationId,
            email: inviteEmail.trim(),
            role: OrgRole.Member,
          },
        },
      });
      notify.success({
        title: 'Invitation sent',
        message: `Invited ${inviteEmail} to the organization.`,
      });
      setInviteEmail('');
      await context.refreshOrganization();
    } catch (err) {
      console.error(err);
      notify.error({ title: 'Failed to send invitation' });
    } finally {
      setIsInviting(false);
    }
  }, [context, gqlService, inviteEmail]);

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!context.selectedOrganizationId) {
        return;
      }
      setChangingMemberId(userId);
      try {
        await (gqlService.gql as any)({
          query: removeOrgMemberMutation,
          variables: {
            organizationId: context.selectedOrganizationId,
            userId,
          },
        });
        await context.refreshOrganization();
        notify.success({ title: 'Member removed' });
      } catch (err) {
        console.error(err);
        notify.error({ title: 'Failed to remove member' });
      } finally {
        setChangingMemberId(null);
      }
    },
    [context, gqlService]
  );

  const handleRoleChange = useCallback(
    async (userId: string, role: OrgRole) => {
      if (!context.selectedOrganizationId) {
        return;
      }
      setChangingMemberId(userId);
      try {
        await (gqlService.gql as any)({
          query: changeOrgMemberRoleMutation,
          variables: {
            organizationId: context.selectedOrganizationId,
            userId,
            role,
          },
        });
        await context.refreshOrganization();
        notify.success({ title: 'Member role updated' });
      } catch (err) {
        console.error(err);
        notify.error({ title: 'Failed to update role' });
      } finally {
        setChangingMemberId(null);
      }
    },
    [context, gqlService]
  );

  return (
    <>
      <SettingHeader
        title={t['com.affine.settings.organization.members.title']()}
        subtitle={
          t['com.affine.settings.organization.members.description']()
        }
      />

      <SettingWrapper
        title={t['com.affine.settings.organization.members']()}
      >
        <SettingRow
          name={t['com.affine.settings.organization.members.invite']()}
          desc={t['com.affine.settings.organization.members.invite.description']()}
          spreadCol={true}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="email@example.com"
              style={{ width: 260 }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleInvite().catch(() => undefined);
                }
              }}
            />
            <Button
              variant="primary"
              onClick={() => {
                handleInvite().catch(() => undefined);
              }}
              disabled={!canManageMembers || isInviting || !inviteEmail.trim()}
            >
              {isInviting ? 'Inviting...' : 'Invite'}
            </Button>
          </div>
        </SettingRow>

        <SettingRow
          name={t['com.affine.settings.organization.members.list']()}
          desc={`${context.selectedOrganization?.members.length ?? 0} members in this organization.`}
          spreadCol={false}
        >
          <div style={{ width: '100%', display: 'grid', gap: 8 }}>
            {(context.selectedOrganization?.members ?? []).map(member => {
              const isChanging = changingMemberId === member.user.id;
              return (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--affine-border-color)',
                  }}
                >
                  <div>
                    <div>{member.user.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {member.user.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={member.role}
                      disabled={isChanging}
                      onChange={e =>
                        void handleRoleChange(
                          member.user.id,
                          e.target.value as OrgRole
                        )
                      }
                    >
                      <option value={OrgRole.Member}>Member</option>
                      <option value={OrgRole.Admin}>Admin</option>
                      <option value={OrgRole.Owner}>Owner</option>
                    </select>
                    <Button
                      variant="plain"
                      disabled={isChanging || member.role === OrgRole.Owner}
                      onClick={() => void handleRemoveMember(member.user.id)}
                    >
                      {t['com.affine.settings.organization.members.actions.remove']()}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </SettingRow>
      </SettingWrapper>
    </>
  );
};
