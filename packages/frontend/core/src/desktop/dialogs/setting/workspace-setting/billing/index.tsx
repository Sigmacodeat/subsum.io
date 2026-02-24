import { Button, Loading } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { SWRErrorBoundary } from '@affine/core/components/pure/swr-error-bundary';
import { WorkspaceSubscriptionService } from '@affine/core/modules/cloud';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';
import type { FallbackProps } from 'react-error-boundary';

import { TeamResumeAction } from '../../general-setting/plans/actions';
import { BillingHistory } from './billing-history';
import { PaymentMethodUpdater } from './payment-method';
import { TeamCard } from './team-card';
import { TypeformLink } from './typeform-link';

const WorkspaceBillingErrorFallback = ({
  resetErrorBoundary,
}: FallbackProps) => {
  const t = useI18n();
  return (
    <SettingWrapper
      title={t['com.affine.payment.billing-setting.information']()}
    >
      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <span>{t['com.affine.payment.plans-error-tip']()}</span>
        <a
          onClick={resetErrorBoundary}
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
        >
          {t['com.affine.payment.plans-error-retry']()}
        </a>
      </div>
    </SettingWrapper>
  );
};

export const WorkspaceSettingBilling = () => {
  return (
    <SWRErrorBoundary FallbackComponent={WorkspaceBillingErrorFallback}>
      <WorkspaceSettingBillingInner />
    </SWRErrorBoundary>
  );
};

const WorkspaceSettingBillingInner = () => {
  const workspace = useService(WorkspaceService).workspace;

  const t = useI18n();

  const subscriptionService = workspace?.scope.get(
    WorkspaceSubscriptionService
  );
  const subscription = useLiveData(
    subscriptionService?.subscription.subscription$
  );

  useEffect(() => {
    subscriptionService?.subscription.revalidate();
  }, [subscriptionService?.subscription]);

  if (workspace === null) {
    return null;
  }

  if (!subscription) {
    return <Loading />;
  }

  return (
    <>
      <SettingHeader
        title={t['com.affine.payment.billing-setting.title']()}
        subtitle={t['com.affine.payment.billing-setting.subtitle']()}
      />
      <SettingWrapper
        title={t['com.affine.payment.billing-setting.information']()}
      >
        <TeamCard />
        <TypeformLink />
        <PaymentMethodUpdater />
        {subscription?.end && subscription.canceledAt ? (
          <ResumeSubscription expirationDate={subscription.end} />
        ) : null}
      </SettingWrapper>

      <SettingWrapper title={t['com.affine.payment.billing-setting.history']()}>
        <BillingHistory />
      </SettingWrapper>
    </>
  );
};

const ResumeSubscription = ({ expirationDate }: { expirationDate: string }) => {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const handleClick = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <SettingRow
      name={t['com.affine.payment.billing-setting.expiration-date']()}
      desc={t['com.affine.payment.billing-setting.expiration-date.description'](
        {
          expirationDate: new Date(expirationDate).toLocaleDateString(),
        }
      )}
    >
      <TeamResumeAction open={open} onOpenChange={setOpen}>
        <Button onClick={handleClick} variant="primary">
          {t['com.affine.payment.billing-setting.resume-subscription']()}
        </Button>
      </TeamResumeAction>
    </SettingRow>
  );
};
