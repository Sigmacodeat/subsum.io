import { SubscriptionPlan } from '@affine/graphql';
import type { useI18n } from '@affine/i18n';
import { AfFiNeIcon } from '@blocksuite/icons/rc';
import { createElement, type ReactNode } from 'react';

export const CLOUD_TRIAL_DAYS = 14 as const;
export const MONEY_BACK_GUARANTEE_I18N_KEY =
  'com.affine.payment.money-back-guarantee' as const;

export type PlanMarketingKey = 'free' | 'solo' | 'kanzlei' | 'ai';

export type PlanScope = 'account' | 'workspace';

export type Benefits = Record<
  string,
  Array<{
    icon?: ReactNode;
    title: ReactNode;
  }>
>;

type T = ReturnType<typeof useI18n>;

export type BenefitGroupDefinition = {
  titleKey: keyof T;
  itemKeys: Array<keyof T>;
  featuredItemKey?: keyof T;
};

export type PlanDefinition = {
  marketingKey: PlanMarketingKey;
  subscriptionPlan: SubscriptionPlan;
  scope: PlanScope;
  nameKey: keyof T;
  descriptionKey: keyof T;
  benefitGroups: BenefitGroupDefinition[];
};

const CLOUD_PLAN_DEFINITIONS: Record<
  Extract<PlanMarketingKey, 'free' | 'solo' | 'kanzlei'>,
  Omit<PlanDefinition, 'nameKey' | 'descriptionKey' | 'benefitGroups'> & {
    nameKey: keyof T;
    descriptionKey: keyof T;
    benefitGroups: BenefitGroupDefinition[];
  }
> = {
  free: {
    marketingKey: 'free',
    subscriptionPlan: SubscriptionPlan.Free,
    scope: 'account',
    nameKey: 'com.affine.payment.cloud.free.name',
    descriptionKey: 'com.affine.payment.cloud.free.description',
    benefitGroups: [
      {
        titleKey: 'com.affine.payment.cloud.free.benefit.g1',
        itemKeys: [
          'com.affine.payment.cloud.free.benefit.g1-1',
          'com.affine.payment.cloud.free.benefit.g1-2',
          'com.affine.payment.cloud.free.benefit.g1-3',
        ],
      },
      {
        titleKey: 'com.affine.payment.cloud.free.benefit.g2',
        itemKeys: [
          'com.affine.payment.cloud.free.benefit.g2-1',
          'com.affine.payment.cloud.free.benefit.g2-2',
          'com.affine.payment.cloud.free.benefit.g2-3',
          'com.affine.payment.cloud.free.benefit.g2-4',
          'com.affine.payment.cloud.free.benefit.g2-5',
        ],
      },
    ],
  },
  solo: {
    marketingKey: 'solo',
    subscriptionPlan: SubscriptionPlan.Pro,
    scope: 'account',
    nameKey: 'com.affine.payment.cloud.pro.name',
    descriptionKey: 'com.affine.payment.cloud.pro.description',
    benefitGroups: [
      {
        titleKey: 'com.affine.payment.cloud.pro.benefit.g1',
        itemKeys: [
          'com.affine.payment.cloud.pro.benefit.g1-1',
          'com.affine.payment.cloud.pro.benefit.g1-2',
          'com.affine.payment.cloud.pro.benefit.g1-3',
          'com.affine.payment.cloud.pro.benefit.g1-4',
          'com.affine.payment.cloud.pro.benefit.g1-5',
          'com.affine.payment.cloud.pro.benefit.g1-7',
          'com.affine.payment.cloud.pro.benefit.g1-8',
        ],
        featuredItemKey: 'com.affine.payment.cloud.pro.benefit.g1-1',
      },
    ],
  },
  kanzlei: {
    marketingKey: 'kanzlei',
    subscriptionPlan: SubscriptionPlan.Team,
    scope: 'workspace',
    nameKey: 'com.affine.payment.cloud.team-workspace.name',
    descriptionKey: 'com.affine.payment.cloud.team-workspace.description',
    benefitGroups: [
      {
        titleKey: 'com.affine.payment.cloud.team-workspace.benefit.g1',
        itemKeys: [
          'com.affine.payment.cloud.team-workspace.benefit.g1-1',
          'com.affine.payment.cloud.team-workspace.benefit.g1-2',
          'com.affine.payment.cloud.team-workspace.benefit.g1-3',
          'com.affine.payment.cloud.team-workspace.benefit.g1-4',
          'com.affine.payment.cloud.team-workspace.benefit.g1-5',
          'com.affine.payment.cloud.team-workspace.benefit.g1-6',
        ],
        featuredItemKey: 'com.affine.payment.cloud.team-workspace.benefit.g1-1',
      },
    ],
  },
};

export const AI_PLAN_DEFINITION: PlanDefinition = {
  marketingKey: 'ai',
  subscriptionPlan: SubscriptionPlan.AI,
  scope: 'account',
  nameKey: 'com.affine.payment.billing-setting.ai-plan',
  descriptionKey: 'com.affine.payment.billing-setting.ai.free-desc',
  benefitGroups: [],
};

export function getCloudPlanDefinition(
  marketingKey: Extract<PlanMarketingKey, 'free' | 'solo' | 'kanzlei'>
): PlanDefinition {
  return CLOUD_PLAN_DEFINITIONS[marketingKey];
}

export function getCloudPlanDefinitions(): PlanDefinition[] {
  return [
    CLOUD_PLAN_DEFINITIONS.free,
    CLOUD_PLAN_DEFINITIONS.solo,
    CLOUD_PLAN_DEFINITIONS.kanzlei,
  ];
}

export function buildPlanBenefits(t: T, definition: PlanDefinition): Benefits {
  const benefits: Benefits = {};

  for (const group of definition.benefitGroups) {
    const groupTitle = t[group.titleKey]();
    const featuredKey = group.featuredItemKey;

    benefits[groupTitle] = group.itemKeys.map(key => ({
      title: t[key](),
      icon:
        featuredKey && key === featuredKey
          ? createElement(AfFiNeIcon)
          : undefined,
    }));
  }

  return benefits;
}

export function getPlanMarketingName(t: T, plan: SubscriptionPlan): string {
  switch (plan) {
    case SubscriptionPlan.Pro:
      return t['com.affine.payment.cloud.pro.name']();
    case SubscriptionPlan.Team:
      return t['com.affine.payment.cloud.team-workspace.name']();
    case SubscriptionPlan.AI:
      return t['com.affine.payment.billing-setting.ai-plan']();
    case SubscriptionPlan.Free:
    default:
      return t['com.affine.payment.cloud.free.name']();
  }
}
