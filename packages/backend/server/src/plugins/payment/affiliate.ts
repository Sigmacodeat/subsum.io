import { Injectable } from '@nestjs/common';
import {
  Args,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import {
  PrismaClient,
} from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';
import Stripe from 'stripe';

import { BadRequest, URLHelper } from '../../base';
import { CurrentUser } from '../../core/auth';
import { Admin } from '../../core/common';
import { StripeFactory } from './stripe';

const DEFAULT_LEVEL_ONE_RATE_BPS = 2000;
const DEFAULT_LEVEL_TWO_RATE_BPS = 500;
const COMMISSION_LOCK_DAYS = 30;
const AFFILIATE_TERMS_VERSION = '2026-02-21';

const STRIPE_CONNECT_REFRESH_PATH = '/settings?tab=affiliate';
const STRIPE_CONNECT_RETURN_PATH = '/settings?tab=affiliate';

const AFFILIATE_PAYOUT_STATUS = {
  pending: 'pending',
  processing: 'processing',
  paid: 'paid',
  failed: 'failed',
} as const;

type AffiliatePayoutStatus =
  (typeof AFFILIATE_PAYOUT_STATUS)[keyof typeof AFFILIATE_PAYOUT_STATUS];

const AFFILIATE_STATUS = {
  pending: 'pending',
  active: 'active',
  suspended: 'suspended',
  blocked: 'blocked',
} as const;

type AffiliateStatus = (typeof AFFILIATE_STATUS)[keyof typeof AFFILIATE_STATUS];

const AFFILIATE_LEDGER_STATUS = {
  pending: 'pending',
  approved: 'approved',
  paid: 'paid',
  reversed: 'reversed',
} as const;

type AffiliateLedgerStatus =
  (typeof AFFILIATE_LEDGER_STATUS)[keyof typeof AFFILIATE_LEDGER_STATUS];

function normalizeReferralCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
}

function normalizeEmailForFraudCheck(email: string | null | undefined) {
  if (!email) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  const [local = '', domain = ''] = normalized.split('@');
  if (!local || !domain) {
    return normalized;
  }
  const localWithoutPlus = local.split('+')[0] ?? local;
  return `${localWithoutPlus}@${domain}`;
}

@InputType()
class SetupStripeConnectInput {
  @Field(() => String)
  country!: string;

  @Field(() => String, { nullable: true })
  email?: string;
}

@ObjectType()
class StripeConnectLinkType {
  @Field(() => String)
  url!: string;
}

function randomSuffix(len = 4) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len)
    .toUpperCase();
}

@ObjectType()
class AffiliateProfileType {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  referralCode!: string;

  @Field(() => String)
  status!: AffiliateStatus;

  @Field(() => Int)
  levelOneRateBps!: number;

  @Field(() => Int)
  levelTwoRateBps!: number;

  @Field(() => String, { nullable: true })
  payoutEmail!: string | null;

  @Field(() => String, { nullable: true })
  stripeConnectCountry!: string | null;

  @Field(() => String, { nullable: true })
  stripeConnectAccountId!: string | null;

  @Field(() => Boolean)
  stripeDetailsSubmitted!: boolean;

  @Field(() => Boolean)
  stripePayoutsEnabled!: boolean;

  @Field(() => GraphQLJSONObject, { nullable: true })
  stripeRequirements!: object | null;

  @Field(() => Date, { nullable: true })
  termsAcceptedAt!: Date | null;

  @Field(() => String, { nullable: true })
  termsVersion!: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  taxInfo!: object | null;

  @Field(() => String, { nullable: true })
  parentAffiliateUserId!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
class AffiliateReferralType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  referredUserId!: string;

  @Field(() => String, { nullable: true })
  referredEmail!: string | null;

  @Field(() => String, { nullable: true })
  referredName!: string | null;

  @Field(() => String)
  referralCode!: string;

  @Field(() => String, { nullable: true })
  source!: string | null;

  @Field(() => String, { nullable: true })
  campaign!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  activatedAt!: Date | null;
}

@ObjectType()
class AffiliateLedgerEntryType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  referredUserId!: string;

  @Field(() => String, { nullable: true })
  invoiceId!: string | null;

  @Field(() => Int)
  level!: number;

  @Field(() => String)
  status!: AffiliateLedgerStatus;

  @Field(() => Int)
  amountCents!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => String, { nullable: true })
  reason!: string | null;

  @Field(() => Date)
  availableAt!: Date;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class AffiliatePayoutType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  status!: AffiliatePayoutStatus;

  @Field(() => Int)
  totalCents!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  paidAt!: Date | null;

  @Field(() => String, { nullable: true })
  stripeTransferId!: string | null;

  @Field(() => String, { nullable: true })
  stripeTransferStatus!: string | null;
}

@ObjectType()
class AffiliateHierarchyNodeType {
  @Field(() => String)
  userId!: string;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => String, { nullable: true })
  name!: string | null;

  @Field(() => String)
  referralCode!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => Int)
  directReferralCount!: number;

  @Field(() => Int)
  activeReferralCount!: number;

  @Field(() => Int)
  totalCommissionsCents!: number;

  @Field(() => Date)
  joinedAt!: Date;

  @Field(() => [AffiliateHierarchyNodeType])
  children!: AffiliateHierarchyNodeType[];
}

@ObjectType()
class AffiliatePayoutItemType {
  @Field(() => String)
  ledgerId!: string;

  @Field(() => Int)
  amountCents!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => String)
  referredUserId!: string;

  @Field(() => String, { nullable: true })
  invoiceId!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  termsAcceptedAt!: Date | null;

  @Field(() => Boolean)
  taxInfoComplete!: boolean;
}

@ObjectType()
class AffiliateAdminPayoutDetailType {
  @Field(() => AffiliatePayoutType)
  payout!: AffiliatePayoutType;

  @Field(() => [AffiliatePayoutItemType])
  items!: AffiliatePayoutItemType[];

  @Field(() => [AffiliateComplianceEventType])
  events!: AffiliateComplianceEventType[];
}

@ObjectType()
class AffiliateComplianceEventType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  eventType!: string;

  @Field(() => String)
  severity!: string;

  @Field(() => String)
  message!: string;

  @Field(() => String, { nullable: true })
  actorUserId!: string | null;

  @Field(() => String)
  affiliateUserId!: string;

  @Field(() => String, { nullable: true })
  payoutId!: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata!: object | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class AffiliateDashboardType {
  @Field(() => AffiliateProfileType)
  profile!: AffiliateProfileType;

  @Field(() => Int)
  referralCount!: number;

  @Field(() => Int)
  activeReferralCount!: number;

  @Field(() => Int)
  pendingCommissionsCents!: number;

  @Field(() => Int)
  paidCommissionsCents!: number;

  @Field(() => [AffiliateReferralType])
  recentReferrals!: AffiliateReferralType[];

  @Field(() => [AffiliateLedgerEntryType])
  recentLedgerEntries!: AffiliateLedgerEntryType[];

  @Field(() => [AffiliatePayoutType])
  payouts!: AffiliatePayoutType[];

  @Field(() => [AffiliateHierarchyNodeType])
  hierarchy!: AffiliateHierarchyNodeType[];
}

@ObjectType()
class AffiliateAdminOverviewType {
  @Field(() => Int)
  activeAffiliates!: number;

  @Field(() => Int)
  totalReferralCount!: number;

  @Field(() => Int)
  periodReferralCount!: number;

  @Field(() => Int)
  pendingCommissionsCents!: number;

  @Field(() => Int)
  paidCommissionsCents!: number;

  @Field(() => Int)
  reversedCommissionsCents!: number;

  @Field(() => Int)
  paidOutCents!: number;
}

@ObjectType()
class AffiliateAdminListItemType {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String)
  referralCode!: string;

  @Field(() => String)
  status!: AffiliateStatus;

  @Field(() => Int)
  referrals!: number;

  @Field(() => Int)
  pendingCents!: number;

  @Field(() => Int)
  paidCents!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  termsAcceptedAt!: Date | null;

  @Field(() => Boolean)
  taxInfoComplete!: boolean;
}

@InputType()
class UpsertAffiliateProfileInput {
  @Field(() => String, { nullable: true })
  payoutEmail?: string;

  @Field(() => String, { nullable: true })
  parentReferralCode?: string;

  @Field(() => Int, { nullable: true })
  levelOneRateBps?: number;

  @Field(() => Int, { nullable: true })
  levelTwoRateBps?: number;

  @Field(() => Boolean, { nullable: true })
  acceptTerms?: boolean;

  @Field(() => String, { nullable: true })
  legalName?: string;

  @Field(() => String, { nullable: true })
  taxCountry?: string;

  @Field(() => String, { nullable: true })
  taxId?: string;
}

@InputType()
class AdminPayoutActionInput {
  @Field(() => String)
  payoutId!: string;

  @Field(() => String, { nullable: true })
  note?: string;
}

@InputType()
class AdminUpdateAffiliateInput {
  @Field(() => String)
  userId!: string;

  @Field(() => String, { nullable: true })
  status?: AffiliateStatus;

  @Field(() => String, { nullable: true })
  payoutEmail?: string;

  @Field(() => Int, { nullable: true })
  levelOneRateBps?: number;

  @Field(() => Int, { nullable: true })
  levelTwoRateBps?: number;
}

@Injectable()
export class AffiliateService {
  constructor(
    private readonly db: PrismaClient,
    private readonly stripeFactory: StripeFactory,
    private readonly url: URLHelper
  ) {}

  private get stripe() {
    return this.stripeFactory.stripe;
  }

  private normalizeTaxInfo(input: {
    legalName?: string | null;
    taxCountry?: string | null;
    taxId?: string | null;
  }) {
    const legalName = input.legalName?.trim() || null;
    const taxCountry = input.taxCountry?.trim().toUpperCase() || null;
    const taxId = input.taxId?.trim() || null;
    return {
      legalName,
      taxCountry: taxCountry && /^[A-Z]{2}$/.test(taxCountry) ? taxCountry : null,
      taxId,
    };
  }

  private isTaxInfoComplete(taxInfo: unknown): boolean {
    if (!taxInfo || typeof taxInfo !== 'object') {
      return false;
    }
    const record = taxInfo as Record<string, unknown>;
    const legalName = typeof record.legalName === 'string' ? record.legalName.trim() : '';
    const taxCountry = typeof record.taxCountry === 'string' ? record.taxCountry.trim() : '';
    const taxId = typeof record.taxId === 'string' ? record.taxId.trim() : '';
    return Boolean(legalName && /^[A-Z]{2}$/.test(taxCountry) && taxId);
  }

  private async logComplianceEvent(input: {
    affiliateUserId: string;
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    actorUserId?: string | null;
    payoutId?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    await (this.db as any).affiliateComplianceEvent.create({
      data: {
        affiliateUserId: input.affiliateUserId,
        actorUserId: input.actorUserId ?? null,
        payoutId: input.payoutId ?? null,
        eventType: input.eventType,
        severity: input.severity,
        message: input.message,
        metadata: input.metadata ?? null,
      },
    });
  }

  private async generateUniqueReferralCode(seed: string): Promise<string> {
    const base = normalizeReferralCode(seed).slice(0, 12) || 'PARTNER';

    for (let i = 0; i < 10; i++) {
      const candidate = `${base}${randomSuffix(4)}`;
      const exists = await (this.db as any).affiliateProfile.findUnique({
        where: { referralCode: candidate },
        select: { userId: true },
      });
      if (!exists) {
        return candidate;
      }
    }

    return `${base}${Date.now().toString(36).toUpperCase()}`;
  }

  async ensureProfile(userId: string) {
    const existing = await (this.db as any).affiliateProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const seed = user?.email?.split('@')[0] || user?.name || 'partner';
    const referralCode = await this.generateUniqueReferralCode(seed);

    return (this.db as any).affiliateProfile.create({
      data: {
        userId,
        referralCode,
        status: AFFILIATE_STATUS.active,
        levelOneRateBps: DEFAULT_LEVEL_ONE_RATE_BPS,
        levelTwoRateBps: DEFAULT_LEVEL_TWO_RATE_BPS,
      },
    });
  }

  async setupStripeConnect(userId: string, input: SetupStripeConnectInput) {
    const profile = await this.ensureProfile(userId);
    const country = input.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new BadRequest('Invalid country code');
    }

    let connectAccountId = (profile as any).stripeConnectAccountId as string | null | undefined;

    if (!connectAccountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country,
        email: input.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          affiliateUserId: userId,
        },
      });
      connectAccountId = account.id;
    }

    const refreshUrl = this.url.link(STRIPE_CONNECT_REFRESH_PATH);
    const returnUrl = this.url.link(STRIPE_CONNECT_RETURN_PATH);

    const link = await this.stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    await (this.db as any).affiliateProfile.update({
      where: { userId },
      data: {
        stripeConnectAccountId: connectAccountId,
        stripeConnectCountry: country,
      },
    });

    // sync latest flags immediately
    const account = await this.stripe.accounts.retrieve(connectAccountId);
    await this.syncStripeConnectAccount(account);

    return { url: link.url };
  }

  async syncStripeConnectAccount(account: Stripe.Account) {
    const affiliateUserId =
      (account.metadata?.affiliateUserId as string | undefined) ?? undefined;

    // If metadata missing, try lookup by account id
    const profile = affiliateUserId
      ? await (this.db as any).affiliateProfile.findUnique({
          where: { userId: affiliateUserId },
        })
      : await (this.db as any).affiliateProfile.findFirst({
          where: { stripeConnectAccountId: account.id },
        });

    if (!profile) {
      return;
    }

    await (this.db as any).affiliateProfile.update({
      where: { userId: profile.userId },
      data: {
        stripeConnectAccountId: account.id,
        stripeConnectCountry: account.country?.toUpperCase() ?? profile.stripeConnectCountry,
        stripeChargesEnabled: Boolean(account.charges_enabled),
        stripePayoutsEnabled: Boolean(account.payouts_enabled),
        stripeDetailsSubmitted: Boolean(account.details_submitted),
        stripeRequirements: (account.requirements as any) ?? null,
      },
    });
  }

  async upsertProfile(userId: string, input: UpsertAffiliateProfileInput) {
    const profile = await this.ensureProfile(userId);

    let parentAffiliateUserId: string | null | undefined;
    if (input.parentReferralCode !== undefined) {
      const normalized = normalizeReferralCode(input.parentReferralCode || '');
      if (!normalized) {
        parentAffiliateUserId = null;
      } else {
        const parent = await (this.db as any).affiliateProfile.findUnique({
          where: { referralCode: normalized },
          select: { userId: true },
        });
        if (!parent) {
          throw new BadRequest('Invalid parent referral code.');
        }
        if (parent.userId === userId) {
          throw new BadRequest('Self parent referral is not allowed.');
        }
        parentAffiliateUserId = parent.userId;
      }
    }

    const levelOneRateBps = input.levelOneRateBps;
    const levelTwoRateBps = input.levelTwoRateBps;
    if (levelOneRateBps !== undefined && (levelOneRateBps < 0 || levelOneRateBps > 5000)) {
      throw new BadRequest('levelOneRateBps must be in range 0..5000');
    }
    if (levelTwoRateBps !== undefined && (levelTwoRateBps < 0 || levelTwoRateBps > 2000)) {
      throw new BadRequest('levelTwoRateBps must be in range 0..2000');
    }

    const nextTaxInfo = this.normalizeTaxInfo({
      legalName: input.legalName,
      taxCountry: input.taxCountry,
      taxId: input.taxId,
    });

    const shouldUpdateTaxInfo =
      input.legalName !== undefined ||
      input.taxCountry !== undefined ||
      input.taxId !== undefined;

    const updated = await (this.db as any).affiliateProfile.update({
      where: { userId: profile.userId },
      data: {
        payoutEmail: input.payoutEmail,
        parentAffiliateUserId,
        levelOneRateBps,
        levelTwoRateBps,
        termsAcceptedAt: input.acceptTerms ? new Date() : undefined,
        termsVersion: input.acceptTerms ? AFFILIATE_TERMS_VERSION : undefined,
        taxInfo: shouldUpdateTaxInfo ? nextTaxInfo : undefined,
      },
    });

    if (input.acceptTerms) {
      await this.logComplianceEvent({
        affiliateUserId: profile.userId,
        eventType: 'affiliate_terms_accepted',
        severity: 'info',
        message: 'Affiliate accepted partner terms.',
        metadata: {
          termsVersion: AFFILIATE_TERMS_VERSION,
        },
      });
    }

    if (shouldUpdateTaxInfo) {
      await this.logComplianceEvent({
        affiliateUserId: profile.userId,
        eventType: 'affiliate_tax_info_updated',
        severity: 'info',
        message: 'Affiliate updated tax and billing information.',
        metadata: {
          hasLegalName: Boolean(nextTaxInfo.legalName),
          taxCountry: nextTaxInfo.taxCountry,
          hasTaxId: Boolean(nextTaxInfo.taxId),
        },
      });
    }

    return updated;
  }

  async captureReferral(referredUserId: string, code: string, source?: string | null, campaign?: string | null) {
    const normalizedCode = normalizeReferralCode(code);
    if (!normalizedCode) {
      throw new BadRequest('Referral code is required.');
    }

    const profile = await (this.db as any).affiliateProfile.findUnique({
      where: { referralCode: normalizedCode },
      select: { userId: true, status: true },
    });

    if (!profile || profile.status !== AFFILIATE_STATUS.active) {
      throw new BadRequest('Invalid or inactive referral code.');
    }

    if (profile.userId === referredUserId) {
      throw new BadRequest('Self-referral is not allowed.');
    }

    const [referredUser, affiliateUser] = await Promise.all([
      this.db.user.findUnique({
        where: { id: referredUserId },
        select: { email: true },
      }),
      this.db.user.findUnique({
        where: { id: profile.userId },
        select: { email: true },
      }),
    ]);

    const normalizedReferredEmail = normalizeEmailForFraudCheck(referredUser?.email);
    const normalizedAffiliateEmail = normalizeEmailForFraudCheck(affiliateUser?.email);

    if (
      normalizedAffiliateEmail &&
      normalizedReferredEmail &&
      normalizedAffiliateEmail === normalizedReferredEmail
    ) {
      await this.logComplianceEvent({
        affiliateUserId: profile.userId,
        eventType: 'referral_rejected_alias_self_referral',
        severity: 'critical',
        message: 'Referral rejected because affiliate and referred email normalize to the same identity.',
        metadata: {
          source: source ?? null,
          campaign: campaign ?? null,
          normalizedAffiliateEmail,
          normalizedReferredEmail,
        },
      });
      throw new BadRequest('Self-referral alias is not allowed.');
    }

    const existing = await (this.db as any).affiliateReferralAttribution.findUnique({
      where: { referredUserId },
      select: { activatedAt: true },
    });

    // once a referred account has converted, lock attribution to avoid hijacking
    if (existing?.activatedAt) {
      return true;
    }

    await (this.db as any).affiliateReferralAttribution.upsert({
      where: { referredUserId },
      create: {
        affiliateUserId: profile.userId,
        referredUserId,
        referralCode: normalizedCode,
        source: source ?? null,
        campaign: campaign ?? null,
      },
      update: {
        affiliateUserId: profile.userId,
        referralCode: normalizedCode,
        source: source ?? null,
        campaign: campaign ?? null,
      },
    });

    return true;
  }

  async processPaidInvoice(invoiceId: string) {
    const invoice = await this.db.invoice.findUnique({
      where: { stripeInvoiceId: invoiceId },
      select: {
        stripeInvoiceId: true,
        targetId: true,
        amount: true,
        currency: true,
        status: true,
      },
    });

    if (!invoice || invoice.status !== 'paid' || invoice.amount <= 0) {
      return;
    }

    const attribution = await (this.db as any).affiliateReferralAttribution.findUnique({
      where: { referredUserId: invoice.targetId },
    });

    if (!attribution) {
      return;
    }

    const profile = await this.ensureProfile(attribution.affiliateUserId);
    const existingLevelOne = await (this.db as any).affiliateCommissionLedger.findFirst({
      where: {
        invoiceId,
        affiliateUserId: profile.userId,
        level: 1,
      },
      select: { id: true },
    });

    if (existingLevelOne) {
      return;
    }

    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + COMMISSION_LOCK_DAYS);

    const levelOneAmount = Math.floor((invoice.amount * profile.levelOneRateBps) / 10000);

    await this.db.$transaction(async tx => {
      if (levelOneAmount > 0) {
        await (tx as any).affiliateCommissionLedger.create({
          data: {
            affiliateUserId: profile.userId,
            referredUserId: invoice.targetId,
            invoiceId,
            level: 1,
            amountCents: levelOneAmount,
            currency: invoice.currency.toLowerCase(),
            status: AFFILIATE_LEDGER_STATUS.pending,
            availableAt,
            reason: 'subscription_paid',
          },
        });
      }

      if (profile.parentAffiliateUserId && profile.levelTwoRateBps > 0) {
        const parent = await (tx as any).affiliateProfile.findUnique({
          where: { userId: profile.parentAffiliateUserId },
          select: { userId: true, status: true },
        });

        if (parent && parent.status === AFFILIATE_STATUS.active) {
          const levelTwoAmount = Math.floor(
            (invoice.amount * profile.levelTwoRateBps) / 10000
          );

          if (levelTwoAmount > 0) {
            await (tx as any).affiliateCommissionLedger.create({
              data: {
                affiliateUserId: parent.userId,
                referredUserId: invoice.targetId,
                invoiceId,
                level: 2,
                amountCents: levelTwoAmount,
                currency: invoice.currency.toLowerCase(),
                status: AFFILIATE_LEDGER_STATUS.pending,
                availableAt,
                reason: 'subscription_paid_level2',
              },
            });
          }
        }
      }

      await (tx as any).affiliateReferralAttribution.update({
        where: { referredUserId: invoice.targetId },
        data: {
          activatedAt: attribution.activatedAt ?? new Date(),
        },
      });
    });
  }

  async reverseInvoiceCommissions(invoiceId: string, reason: string = 'refund') {
    await (this.db as any).affiliateCommissionLedger.updateMany({
      where: {
        invoiceId,
        status: {
          in: [
            AFFILIATE_LEDGER_STATUS.pending,
            AFFILIATE_LEDGER_STATUS.approved,
            AFFILIATE_LEDGER_STATUS.paid,
          ],
        },
      },
      data: {
        status: AFFILIATE_LEDGER_STATUS.reversed,
        reversedAt: new Date(),
        reason,
      },
    });
  }

  async runPayouts(runAt: Date = new Date()) {
    const releasable = await (this.db as any).affiliateCommissionLedger.findMany({
      where: {
        status: AFFILIATE_LEDGER_STATUS.pending,
        availableAt: { lte: runAt },
      },
      include: {
        affiliateUser: {
          include: {
            affiliateProfile: {
              select: {
                status: true,
                payoutEmail: true,
                stripeConnectAccountId: true,
                stripePayoutsEnabled: true,
                termsAcceptedAt: true,
                termsVersion: true,
                taxInfo: true,
              },
            },
          },
        },
      },
      orderBy: [{ affiliateUserId: 'asc' }, { createdAt: 'asc' }],
    });

    const eligibleIds = (releasable as Array<any>)
      .filter((item: any) => {
        const profile = item.affiliateUser?.affiliateProfile as
          | {
              status: AffiliateStatus;
              stripeConnectAccountId: string | null;
              stripePayoutsEnabled: boolean;
              termsAcceptedAt: Date | null;
              termsVersion: string | null;
              taxInfo: unknown;
            }
          | null
          | undefined;
        return Boolean(
          profile &&
            profile.status === AFFILIATE_STATUS.active &&
            profile.stripeConnectAccountId &&
            profile.stripePayoutsEnabled &&
            profile.termsAcceptedAt &&
            profile.termsVersion === AFFILIATE_TERMS_VERSION &&
            this.isTaxInfoComplete(profile.taxInfo)
        );
      })
      .map((item: any) => item.id);

    const blockedItems = (releasable as Array<any>).filter((item: any) => {
      const profile = item.affiliateUser?.affiliateProfile as
        | {
            status: AffiliateStatus;
            stripeConnectAccountId: string | null;
            stripePayoutsEnabled: boolean;
            termsAcceptedAt: Date | null;
            termsVersion: string | null;
            taxInfo: unknown;
          }
        | null
        | undefined;
      return !(profile &&
          profile.status === AFFILIATE_STATUS.active &&
          profile.stripeConnectAccountId &&
          profile.stripePayoutsEnabled &&
          profile.termsAcceptedAt &&
          profile.termsVersion === AFFILIATE_TERMS_VERSION &&
          this.isTaxInfoComplete(profile.taxInfo));
    });

    for (const item of blockedItems) {
      const profile = item.affiliateUser?.affiliateProfile as
        | {
            status: AffiliateStatus;
            stripeConnectAccountId: string | null;
            stripePayoutsEnabled: boolean;
            termsAcceptedAt: Date | null;
            termsVersion: string | null;
            taxInfo: unknown;
          }
        | null
        | undefined;

      if (!profile) {
        continue;
      }

      const missingReasons: string[] = [];
      if (!profile.termsAcceptedAt || profile.termsVersion !== AFFILIATE_TERMS_VERSION) {
        missingReasons.push('terms_not_accepted');
      }
      if (!this.isTaxInfoComplete(profile.taxInfo)) {
        missingReasons.push('tax_info_incomplete');
      }
      if (!profile.stripeConnectAccountId || !profile.stripePayoutsEnabled) {
        missingReasons.push('stripe_payout_not_ready');
      }
      if (profile.status !== AFFILIATE_STATUS.active) {
        missingReasons.push('affiliate_not_active');
      }

      await this.logComplianceEvent({
        affiliateUserId: item.affiliateUserId,
        eventType: 'payout_hold_compliance',
        severity: 'warning',
        message: 'Payout held due to missing compliance prerequisites.',
        metadata: {
          ledgerId: item.id,
          missingReasons,
        },
      });
    }

    if (eligibleIds.length === 0) {
      return 0;
    }

    await (this.db as any).affiliateCommissionLedger.updateMany({
      where: {
        id: {
          in: eligibleIds,
        },
        status: AFFILIATE_LEDGER_STATUS.pending,
      },
      data: {
        status: AFFILIATE_LEDGER_STATUS.approved,
      },
    });

    const approved = await (this.db as any).affiliateCommissionLedger.findMany({
      where: {
        id: {
          in: eligibleIds,
        },
        status: AFFILIATE_LEDGER_STATUS.approved,
        payoutItems: {
          none: {},
        },
      },
      orderBy: [{ affiliateUserId: 'asc' }, { createdAt: 'asc' }],
    });

    const byAffiliateCurrency = new Map<string, Array<any>>();

    for (const item of approved as Array<any>) {
      const key = `${item.affiliateUserId}:${item.currency}`;
      const current = byAffiliateCurrency.get(key) ?? [];
      current.push(item);
      byAffiliateCurrency.set(key, current);
    }

    let payoutCount = 0;
    const periodStart = new Date(runAt.getFullYear(), runAt.getMonth(), 1);
    const periodEnd = new Date(runAt);

    for (const entries of byAffiliateCurrency.values()) {
      const totalCents = entries.reduce(
        (sum: number, item: any) => sum + (item.amountCents as number),
        0
      );
      if (totalCents <= 0) {
        continue;
      }

      const affiliateProfile = await (this.db as any).affiliateProfile.findUnique({
        where: { userId: entries[0].affiliateUserId },
      });

      if (!affiliateProfile?.stripeConnectAccountId || !affiliateProfile?.stripePayoutsEnabled) {
        continue;
      }

      await this.db.$transaction(async tx => {
        const payout = await (tx as any).affiliatePayout.create({
          data: {
            affiliateUserId: entries[0].affiliateUserId,
            status: AFFILIATE_PAYOUT_STATUS.processing,
            periodStart,
            periodEnd,
            totalCents,
            currency: entries[0].currency,
          },
        });

        await (tx as any).affiliatePayoutItem.createMany({
          data: entries.map(item => ({
            payoutId: payout.id,
            ledgerId: item.id,
          })),
          skipDuplicates: true,
        });

      });

      // Create a Stripe transfer idempotently for this payout
      const payout = await (this.db as any).affiliatePayout.findFirst({
        where: {
          affiliateUserId: entries[0].affiliateUserId,
          periodStart,
          periodEnd,
          totalCents,
          currency: entries[0].currency,
          status: AFFILIATE_PAYOUT_STATUS.processing,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (payout && !payout.stripeTransferId) {
        const transfer = await this.stripe.transfers.create(
          {
            amount: payout.totalCents,
            currency: payout.currency,
            destination: affiliateProfile.stripeConnectAccountId,
            metadata: {
              affiliateUserId: payout.affiliateUserId,
              payoutId: payout.id,
            },
            description: `Affiliate payout ${payout.id}`,
          },
          {
            idempotencyKey: `affiliate:payout:transfer:${payout.id}`,
          }
        );

        await (this.db as any).affiliatePayout.update({
          where: { id: payout.id },
          data: {
            stripeTransferId: transfer.id,
            stripeTransferStatus: 'created',
          },
        });
      }

      payoutCount++;
    }

    return payoutCount;
  }

  async adminGetPayoutDetail(payoutId: string): Promise<AffiliateAdminPayoutDetailType> {
    const payout = await (this.db as any).affiliatePayout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) {
      throw new BadRequest('Payout not found');
    }

    const items = await (this.db as any).affiliatePayoutItem.findMany({
      where: { payoutId },
      include: {
        ledger: true,
      },
      orderBy: {
        ledger: {
          createdAt: 'asc',
        },
      },
    });

    const affiliateProfile = await (this.db as any).affiliateProfile.findUnique({
      where: { userId: payout.affiliateUserId },
      select: {
        termsAcceptedAt: true,
        taxInfo: true,
      },
    });

    const taxInfoComplete = this.isTaxInfoComplete(affiliateProfile?.taxInfo);

    return {
      payout,
      items: (items as Array<any>).map((i: any) => ({
        ledgerId: i.ledgerId,
        amountCents: i.ledger.amountCents,
        currency: i.ledger.currency,
        level: i.ledger.level,
        referredUserId: i.ledger.referredUserId,
        invoiceId: i.ledger.invoiceId,
        createdAt: i.ledger.createdAt,
        termsAcceptedAt: affiliateProfile?.termsAcceptedAt ?? null,
        taxInfoComplete,
      })),
      events: await (this.db as any).affiliateComplianceEvent.findMany({
        where: {
          OR: [
            { payoutId },
            { affiliateUserId: payout.affiliateUserId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    };
  }

  async adminMarkPayoutPaid(input: AdminPayoutActionInput, actorUserId: string) {
    const payout = await (this.db as any).affiliatePayout.findUnique({
      where: { id: input.payoutId },
    });
    if (!payout) {
      throw new BadRequest('Payout not found');
    }

    if (payout.status === AFFILIATE_PAYOUT_STATUS.paid) {
      return payout;
    }

    if (payout.status === AFFILIATE_PAYOUT_STATUS.failed) {
      throw new BadRequest('Cannot mark a failed payout as paid. Create a new payout run.');
    }

    const paidAt = new Date();

    return this.db.$transaction(async tx => {
      const updated = await (tx as any).affiliatePayout.update({
        where: { id: input.payoutId },
        data: {
          status: AFFILIATE_PAYOUT_STATUS.paid,
          paidAt,
          note: input.note,
        },
      });

      const payoutItems = await (tx as any).affiliatePayoutItem.findMany({
        where: { payoutId: input.payoutId },
        select: { ledgerId: true },
      });

      await (tx as any).affiliateCommissionLedger.updateMany({
        where: {
          id: {
            in: (payoutItems as Array<any>).map((i: any) => i.ledgerId),
          },
          status: AFFILIATE_LEDGER_STATUS.approved,
        },
        data: {
          status: AFFILIATE_LEDGER_STATUS.paid,
          paidAt,
        },
      });

      await (tx as any).affiliateComplianceEvent.create({
        data: {
          affiliateUserId: updated.affiliateUserId,
          actorUserId,
          payoutId: updated.id,
          eventType: 'admin_mark_payout_paid',
          severity: 'info',
          message: 'Admin marked payout as paid.',
          metadata: {
            note: input.note ?? null,
            paidAt,
          },
        },
      });

      return updated;
    });
  }

  async adminMarkPayoutFailed(input: AdminPayoutActionInput, actorUserId: string) {
    const payout = await (this.db as any).affiliatePayout.findUnique({
      where: { id: input.payoutId },
    });
    if (!payout) {
      throw new BadRequest('Payout not found');
    }

    if (payout.status === AFFILIATE_PAYOUT_STATUS.failed) {
      return payout;
    }

    if (payout.status === AFFILIATE_PAYOUT_STATUS.paid) {
      throw new BadRequest('Cannot fail a paid payout.');
    }

    const updated = await (this.db as any).affiliatePayout.update({
      where: { id: input.payoutId },
      data: {
        status: AFFILIATE_PAYOUT_STATUS.failed,
        note: input.note,
      },
    });

    await this.logComplianceEvent({
      affiliateUserId: updated.affiliateUserId,
      actorUserId,
      payoutId: updated.id,
      eventType: 'admin_mark_payout_failed',
      severity: 'warning',
      message: 'Admin marked payout as failed.',
      metadata: {
        note: input.note ?? null,
      },
    });

    return updated;
  }

  async getDashboard(userId: string): Promise<AffiliateDashboardType> {
    const profile = await this.ensureProfile(userId);

    const [
      referralCount,
      activeReferralCount,
      pendingSum,
      paidSum,
      recentReferrals,
      recentLedgerEntries,
      payouts,
      hierarchy,
    ] = await Promise.all([
      (this.db as any).affiliateReferralAttribution.count({ where: { affiliateUserId: userId } }),
      (this.db as any).affiliateReferralAttribution.count({
        where: { affiliateUserId: userId, activatedAt: { not: null } },
      }),
      (this.db as any).affiliateCommissionLedger.aggregate({
        where: {
          affiliateUserId: userId,
          status: {
            in: [AFFILIATE_LEDGER_STATUS.pending, AFFILIATE_LEDGER_STATUS.approved],
          },
        },
        _sum: { amountCents: true },
      }),
      (this.db as any).affiliateCommissionLedger.aggregate({
        where: {
          affiliateUserId: userId,
          status: AFFILIATE_LEDGER_STATUS.paid,
        },
        _sum: { amountCents: true },
      }),
      (this.db as any).affiliateReferralAttribution.findMany({
        where: { affiliateUserId: userId },
        include: {
          referredUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      (this.db as any).affiliateCommissionLedger.findMany({
        where: { affiliateUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      (this.db as any).affiliatePayout.findMany({
        where: { affiliateUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.buildHierarchy(userId),
    ]);

    return {
      profile,
      referralCount,
      activeReferralCount,
      pendingCommissionsCents: pendingSum._sum.amountCents ?? 0,
      paidCommissionsCents: paidSum._sum.amountCents ?? 0,
      recentReferrals: (recentReferrals as Array<any>).map((item: any) => ({
        id: item.id,
        referredUserId: item.referredUserId,
        referredEmail: item.referredUser.email,
        referredName: item.referredUser.name,
        referralCode: item.referralCode,
        source: item.source,
        campaign: item.campaign,
        createdAt: item.createdAt,
        activatedAt: item.activatedAt,
      })),
      recentLedgerEntries,
      payouts,
      hierarchy,
    };
  }

  private async buildHierarchy(
    userId: string,
    currentLevel = 1,
    maxDepth = 2
  ): Promise<AffiliateHierarchyNodeType[]> {
    if (currentLevel > maxDepth) {
      return [];
    }

    const myReferrals = await (this.db as any).affiliateReferralAttribution.findMany({
      where: {
        affiliateUserId: userId,
        activatedAt: { not: null },
      },
      include: {
        referredUser: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { activatedAt: 'desc' },
    });

    const nodes: AffiliateHierarchyNodeType[] = [];

    for (const ref of myReferrals) {
      const referredUserId = ref.referredUserId;

      const affiliateProfile = await (this.db as any).affiliateProfile.findUnique({
        where: { userId: referredUserId },
      });

      const [directCount, activeCount, commissionSum] = await Promise.all([
        (this.db as any).affiliateReferralAttribution.count({
          where: { affiliateUserId: referredUserId },
        }),
        (this.db as any).affiliateReferralAttribution.count({
          where: { affiliateUserId: referredUserId, activatedAt: { not: null } },
        }),
        (this.db as any).affiliateCommissionLedger.aggregate({
          where: { affiliateUserId: referredUserId },
          _sum: { amountCents: true },
        }),
      ]);

      const children =
        currentLevel < maxDepth
          ? await this.buildHierarchy(referredUserId, currentLevel + 1, maxDepth)
          : [];

      nodes.push({
        userId: referredUserId,
        email: ref.referredUser.email,
        name: ref.referredUser.name,
        referralCode: affiliateProfile?.referralCode ?? '',
        level: currentLevel,
        directReferralCount: directCount,
        activeReferralCount: activeCount,
        totalCommissionsCents: commissionSum._sum.amountCents ?? 0,
        joinedAt: ref.activatedAt!,
        children,
      });
    }

    return nodes;
  }

  async getAdminOverview(periodDays: number): Promise<AffiliateAdminOverviewType> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - Math.max(1, periodDays));
    const periodEnd = new Date(now);

    const [
      activeAffiliates,
      totalReferralCount,
      periodReferralCount,
      pendingCommissions,
      paidCommissions,
      reversedCommissions,
      paidOut,
    ] = await Promise.all([
      (this.db as any).affiliateProfile.count({ where: { status: AFFILIATE_STATUS.active } }),
      (this.db as any).affiliateReferralAttribution.count(),
      (this.db as any).affiliateReferralAttribution.count({
        where: {
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      }),
      (this.db as any).affiliateCommissionLedger.aggregate({
        where: { status: AFFILIATE_LEDGER_STATUS.pending },
        _sum: { amountCents: true },
      }),
      (this.db as any).affiliateCommissionLedger.aggregate({
        where: { status: AFFILIATE_LEDGER_STATUS.paid },
        _sum: { amountCents: true },
      }),
      (this.db as any).affiliateCommissionLedger.aggregate({
        where: { status: AFFILIATE_LEDGER_STATUS.reversed },
        _sum: { amountCents: true },
      }),
      (this.db as any).affiliatePayout.aggregate({
        where: { status: AFFILIATE_PAYOUT_STATUS.paid },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      activeAffiliates,
      totalReferralCount,
      periodReferralCount,
      pendingCommissionsCents: pendingCommissions._sum.amountCents ?? 0,
      paidCommissionsCents: paidCommissions._sum.amountCents ?? 0,
      reversedCommissionsCents: reversedCommissions._sum.amountCents ?? 0,
      paidOutCents: paidOut._sum.totalCents ?? 0,
    };
  }

  async listAdminAffiliates(skip = 0, first = 50, keyword?: string) {
    const profiles = await (this.db as any).affiliateProfile.findMany({
      where: keyword
        ? {
            OR: [
              { referralCode: { contains: keyword, mode: 'insensitive' } },
              {
                user: {
                  email: { contains: keyword, mode: 'insensitive' },
                },
              },
              {
                user: {
                  name: { contains: keyword, mode: 'insensitive' },
                },
              },
            ],
          }
        : undefined,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Math.min(first, 200),
    });

    const result = await Promise.all(
      profiles.map(async (profile: any) => {
        const [referrals, pending, paid] = await Promise.all([
          (this.db as any).affiliateReferralAttribution.count({
            where: { affiliateUserId: profile.userId },
          }),
          (this.db as any).affiliateCommissionLedger.aggregate({
            where: {
              affiliateUserId: profile.userId,
              status: {
                in: [AFFILIATE_LEDGER_STATUS.pending, AFFILIATE_LEDGER_STATUS.approved],
              },
            },
            _sum: { amountCents: true },
          }),
          (this.db as any).affiliateCommissionLedger.aggregate({
            where: {
              affiliateUserId: profile.userId,
              status: AFFILIATE_LEDGER_STATUS.paid,
            },
            _sum: { amountCents: true },
          }),
        ]);

        return {
          userId: profile.userId,
          name: profile.user.name,
          email: profile.user.email,
          referralCode: profile.referralCode,
          status: profile.status,
          referrals,
          pendingCents: pending._sum.amountCents ?? 0,
          paidCents: paid._sum.amountCents ?? 0,
          createdAt: profile.createdAt,
          termsAcceptedAt: profile.termsAcceptedAt ?? null,
          taxInfoComplete: this.isTaxInfoComplete(profile.taxInfo),
        };
      })
    );

    return result;
  }

  async adminUpdateAffiliate(input: AdminUpdateAffiliateInput, actorUserId: string) {
    const levelOneRateBps = input.levelOneRateBps;
    const levelTwoRateBps = input.levelTwoRateBps;

    if (levelOneRateBps !== undefined && (levelOneRateBps < 0 || levelOneRateBps > 5000)) {
      throw new BadRequest('levelOneRateBps must be in range 0..5000');
    }
    if (levelTwoRateBps !== undefined && (levelTwoRateBps < 0 || levelTwoRateBps > 2000)) {
      throw new BadRequest('levelTwoRateBps must be in range 0..2000');
    }

    await this.ensureProfile(input.userId);

    const updated = await (this.db as any).affiliateProfile.update({
      where: { userId: input.userId },
      data: {
        status: input.status,
        payoutEmail: input.payoutEmail,
        levelOneRateBps,
        levelTwoRateBps,
      },
    });

    await this.logComplianceEvent({
      affiliateUserId: input.userId,
      actorUserId,
      eventType: 'admin_update_affiliate_profile',
      severity: 'info',
      message: 'Admin updated affiliate profile settings.',
      metadata: {
        status: input.status ?? null,
        payoutEmail: input.payoutEmail ?? null,
        levelOneRateBps: levelOneRateBps ?? null,
        levelTwoRateBps: levelTwoRateBps ?? null,
      },
    });

    return updated;
  }

  async adminRecentPayouts(limit: number): Promise<AffiliatePayoutType[]> {
    return (this.db as any).affiliatePayout.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}

@Resolver(() => AffiliateDashboardType)
export class AffiliateResolver {
  constructor(private readonly service: AffiliateService) {}

  @Query(() => AffiliateProfileType)
  async myAffiliateProfile(@CurrentUser() user: CurrentUser) {
    return this.service.ensureProfile(user.id);
  }

  @Query(() => AffiliateDashboardType)
  async myAffiliateDashboard(@CurrentUser() user: CurrentUser) {
    return this.service.getDashboard(user.id);
  }

  @Mutation(() => AffiliateProfileType)
  async upsertAffiliateProfile(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => UpsertAffiliateProfileInput })
    input: UpsertAffiliateProfileInput
  ) {
    return this.service.upsertProfile(user.id, input);
  }

  @Mutation(() => Boolean)
  async captureAffiliateReferral(
    @CurrentUser() user: CurrentUser,
    @Args('code', { type: () => String }) code: string,
    @Args('source', { type: () => String, nullable: true }) source?: string,
    @Args('campaign', { type: () => String, nullable: true }) campaign?: string
  ) {
    return this.service.captureReferral(user.id, code, source, campaign);
  }

  @Mutation(() => StripeConnectLinkType)
  async setupAffiliateStripeConnect(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => SetupStripeConnectInput })
    input: SetupStripeConnectInput
  ) {
    return this.service.setupStripeConnect(user.id, input);
  }
}

@Admin()
@Resolver(() => AffiliateAdminOverviewType)
export class AffiliateAdminResolver {
  constructor(private readonly service: AffiliateService) {}

  @Query(() => AffiliateAdminOverviewType)
  async adminAffiliateOverview(
    @Args('periodDays', { type: () => Int, nullable: true, defaultValue: 30 })
    periodDays: number
  ) {
    return this.service.getAdminOverview(periodDays);
  }

  @Query(() => [AffiliateAdminListItemType])
  async adminAffiliates(
    @Args('skip', { type: () => Int, nullable: true, defaultValue: 0 })
    skip: number,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 50 })
    first: number,
    @Args('keyword', { type: () => String, nullable: true })
    keyword?: string
  ) {
    return this.service.listAdminAffiliates(skip, first, keyword);
  }

  @Mutation(() => Int)
  async runAffiliatePayouts() {
    return this.service.runPayouts();
  }

  @Query(() => AffiliateAdminPayoutDetailType)
  async adminAffiliatePayoutDetail(
    @Args('payoutId', { type: () => String })
    payoutId: string
  ) {
    return this.service.adminGetPayoutDetail(payoutId);
  }

  @Mutation(() => AffiliatePayoutType)
  async adminMarkAffiliatePayoutPaid(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => AdminPayoutActionInput })
    input: AdminPayoutActionInput
  ) {
    return this.service.adminMarkPayoutPaid(input, user.id);
  }

  @Mutation(() => AffiliatePayoutType)
  async adminMarkAffiliatePayoutFailed(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => AdminPayoutActionInput })
    input: AdminPayoutActionInput
  ) {
    return this.service.adminMarkPayoutFailed(input, user.id);
  }

  @Query(() => [AffiliatePayoutType])
  async adminRecentAffiliatePayouts(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit: number
  ) {
    return this.service.adminRecentPayouts(limit);
  }

  @Mutation(() => AffiliateProfileType)
  async adminUpdateAffiliate(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => AdminUpdateAffiliateInput })
    input: AdminUpdateAffiliateInput
  ) {
    return this.service.adminUpdateAffiliate(input, user.id);
  }
}
