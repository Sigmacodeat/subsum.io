import { Button, Input, notify } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { GraphQLService } from '@affine/core/modules/cloud';
import type { GraphQLQuery } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import type { OrganizationSettingContext } from './index';

const updateOrganizationMutation: GraphQLQuery = {
  id: 'organizationUpdateMutation',
  op: 'updateOrganization',
  query: `mutation updateOrganization($input: UpdateOrganizationInput!) {
  updateOrganization(input: $input) {
    id
    name
    slug
  }
}`,
};

export const OrganizationGeneralSetting = ({
  context,
}: {
  context: OrganizationSettingContext;
}) => {
  const t = useI18n();
  const gqlService = useService(GraphQLService);

  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setOrgName(context.selectedOrganization?.name ?? '');
    setOrgSlug(context.selectedOrganization?.slug ?? '');
  }, [context.selectedOrganization?.name, context.selectedOrganization?.slug]);

  const handleSave = useCallback(async () => {
    if (!context.selectedOrganizationId) {
      notify.error({ title: 'No organization selected' });
      return;
    }

    if (!orgName.trim() || !orgSlug.trim()) {
      notify.error({ title: 'Organization name is required' });
      return;
    }

    setIsSaving(true);
    try {
      await (gqlService.gql as any)({
        query: updateOrganizationMutation,
        variables: {
          input: {
            id: context.selectedOrganizationId,
            name: orgName.trim(),
            slug: orgSlug.trim(),
          },
        },
      });

      await context.refreshOrganization();
      notify.success({ title: 'Organization updated' });
    } catch (err) {
      console.error(err);
      notify.error({ title: 'Failed to update organization' });
    } finally {
      setIsSaving(false);
    }
  }, [
    context,
    gqlService,
    orgName,
    orgSlug,
  ]);

  return (
    <>
      <SettingHeader
        title={t['com.affine.settings.organization.general.title']()}
        subtitle={t['com.affine.settings.organization.general.description']()}
      />

      <SettingWrapper
        title={t['com.affine.settings.organization.general']()}
      >
        <SettingRow
          name={t['com.affine.settings.organization.fields.name']()}
          desc={t['com.affine.settings.organization.fields.name.description']()}
          spreadCol={false}
        >
          <Input
            value={orgName}
            onChange={setOrgName}
            placeholder="e.g. Kanzlei Mustermann"
            style={{ width: 300 }}
          />
        </SettingRow>

        <SettingRow
          name={t['com.affine.settings.organization.fields.slug']()}
          desc={t['com.affine.settings.organization.fields.slug.description']()}
          spreadCol={false}
        >
          <Input
            value={orgSlug}
            onChange={setOrgSlug}
            placeholder="e.g. kanzlei-mustermann"
            style={{ width: 300 }}
          />
        </SettingRow>

        <SettingRow name="" desc="" spreadCol={false}>
          <Button
            variant="primary"
            onClick={() => {
              handleSave().catch(() => undefined);
            }}
            disabled={isSaving}
          >
            {isSaving
              ? t['com.affine.settings.organization.actions.saving']()
              : t['com.affine.settings.organization.actions.save']()}
          </Button>
        </SettingRow>
      </SettingWrapper>
    </>
  );
};
