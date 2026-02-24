import { GraphQLService } from '@affine/core/modules/cloud';
import type { SettingTab } from '@affine/core/modules/dialogs/constant';
import type { GraphQLQuery } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  CollaborationIcon,
  FolderIcon,
  SettingsIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SettingSidebarItem, SettingState } from '../types';
import { OrganizationGeneralSetting } from './general';
import { OrganizationMembersSetting } from './members';
import { OrganizationWorkspacesSetting } from './workspaces';

type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  avatarKey: string | null;
  createdAt: string;
};

type OrganizationDetail = OrganizationSummary & {
  memberCount: number;
  members: Array<{
    id: string;
    role: 'Owner' | 'Admin' | 'Member';
    status: 'Pending' | 'Accepted' | 'Rejected';
    createdAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  workspaces: Array<{
    id: string;
    name: string | null;
    createdAt: string;
  }>;
};

const getOrganizationsQuery: GraphQLQuery = {
  id: 'organizationListQuery',
  op: 'getOrganizations',
  query: `query getOrganizations {
  organizations {
    id
    name
    slug
    avatarKey
    createdAt
  }
}`,
};

const getOrganizationByIdQuery: GraphQLQuery = {
  id: 'organizationByIdQuery',
  op: 'getOrganizationById',
  query: `query getOrganizationById($id: String!) {
  organization(id: $id) {
    id
    name
    slug
    avatarKey
    createdAt
    memberCount
    members {
      id
      role
      status
      createdAt
      user {
        id
        name
        email
        avatarUrl
      }
    }
    workspaces {
      id
      name
      createdAt
    }
  }
}`,
};

export type OrganizationSettingContext = {
  selectedOrganizationId: string | null;
  selectedOrganization: OrganizationDetail | null;
  organizations: OrganizationSummary[];
  refreshOrganization: () => Promise<void>;
};

export const OrganizationSetting = ({
  activeTab,
  onChangeSettingState,
}: {
  activeTab: SettingTab;
  onChangeSettingState: (settingState: SettingState) => void;
}) => {
  const t = useI18n();
  const gqlService = useService(GraphQLService);

  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(null);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshOrganizations = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = (await (gqlService.gql as any)({
        query: getOrganizationsQuery,
        variables: {},
      })) as {
        organizations: OrganizationSummary[];
      };
      const orgs = data.organizations;
      setOrganizations(orgs);

      if (!selectedOrganizationId && orgs.length > 0) {
        setSelectedOrganizationId(orgs[0].id);
      }

      if (
        selectedOrganizationId &&
        !orgs.some((org: OrganizationSummary) => org.id === selectedOrganizationId)
      ) {
        setSelectedOrganizationId(orgs[0]?.id ?? null);
      }
    } catch (err) {
      console.error(err);
      setLoadError('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, [gqlService, selectedOrganizationId]);

  const refreshOrganization = useCallback(async () => {
    if (!selectedOrganizationId) {
      setSelectedOrganization(null);
      return;
    }
    const data = (await (gqlService.gql as any)({
      query: getOrganizationByIdQuery,
      variables: { id: selectedOrganizationId },
    })) as {
      organization: OrganizationDetail | null;
    };
    setSelectedOrganization(data.organization);
  }, [gqlService, selectedOrganizationId]);

  useEffect(() => {
    refreshOrganizations().catch(() => undefined);
  }, [refreshOrganizations]);

  useEffect(() => {
    refreshOrganization().catch(() => undefined);
  }, [refreshOrganization]);

  const orgContext = useMemo<OrganizationSettingContext>(
    () => ({
      selectedOrganizationId,
      selectedOrganization,
      organizations,
      refreshOrganization,
    }),
    [organizations, refreshOrganization, selectedOrganization, selectedOrganizationId]
  );

  if (isLoading && organizations.length === 0) {
    return <div>{t['Loading...']?.() ?? 'Loading...'}</div>;
  }

  if (loadError) {
    return <div>{loadError}</div>;
  }

  if (organizations.length === 0) {
    return <div>{t['com.affine.settings.organization.empty']()}</div>;
  }

  const orgSwitcher = (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
        {t['com.affine.settings.organization.switcher.label']()}
      </label>
      <select
        value={selectedOrganizationId ?? ''}
        onChange={e => setSelectedOrganizationId(e.target.value)}
        style={{ width: 320, height: 32 }}
      >
        {organizations.map((org: OrganizationSummary) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );

  switch (activeTab) {
    case 'organization:general':
      return (
        <>
          {orgSwitcher}
          <OrganizationGeneralSetting context={orgContext} />
        </>
      );
    case 'organization:members':
      return (
        <>
          {orgSwitcher}
          <OrganizationMembersSetting
            onChangeSettingState={onChangeSettingState}
            context={orgContext}
          />
        </>
      );
    case 'organization:workspaces':
      return (
        <>
          {orgSwitcher}
          <OrganizationWorkspacesSetting context={orgContext} />
        </>
      );
    default:
      return null;
  }
};

export const useOrganizationSettingList = (): SettingSidebarItem[] => {
  const t = useI18n();

  const items = useMemo<SettingSidebarItem[]>(() => {
    return [
      {
        key: 'organization:general',
        title: t['com.affine.settings.organization.general'](),
        icon: <SettingsIcon />,
        testId: 'organization-setting:general',
      },
      {
        key: 'organization:members',
        title: t['com.affine.settings.organization.members'](),
        icon: <CollaborationIcon />,
        testId: 'organization-setting:members',
      },
      {
        key: 'organization:workspaces',
        title: t['com.affine.settings.organization.workspaces'](),
        icon: <FolderIcon />,
        testId: 'organization-setting:workspaces',
      },
    ];
  }, [t]);

  return items;
};
