import { getPlanMarketingName } from '@affine/core/modules/cloud';
import { SubscriptionPlan } from '@affine/graphql';
import { useI18n } from '@affine/i18n';

import { containerStyle } from './plan-tag.css';

export const PlanTag = () => {
  const t = useI18n();
  return (
    <div className={containerStyle}>
      {getPlanMarketingName(t, SubscriptionPlan.Pro)}
    </div>
  );
};
