import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { z } from 'zod';

import {
  ActionForbidden,
  InvalidCheckoutParameters,
} from '../../base';
import { CurrentUser } from '../../core/auth';
import { StripeFactory } from '../payment/stripe';

export enum AddonType {
  EXTRA_PAGES = 'extra_pages',
  EXTRA_USERS = 'extra_users',
  PREMIUM_SUPPORT = 'premium_support',
  CUSTOM_TEMPLATES = 'custom_templates',
  MIGRATION_ONBOARDING = 'migration_onboarding',
  DEDICATED_INFRASTRUCTURE = 'dedicated_infrastructure',
  EXTRA_AI_CREDITS_5M = 'extra_ai_credits_5m',
  EXTRA_AI_CREDITS_20M = 'extra_ai_credits_20m',
}

export enum AddonRecurring {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  ONETIME = 'onetime',
}

export enum AddonStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

export const ADDON_CONFIG = {
  [AddonType.EXTRA_PAGES]: {
    name: 'Extra 5.000 Seiten/Monat',
    description: '5.000 zusätzliche Seiten KI-Analysekapazität',
    unitPriceCents: 9900,
    recurring: AddonRecurring.MONTHLY,
    stripePriceId: process.env.STRIPE_PRICE_EXTRA_PAGES_MONTHLY,
  },
  [AddonType.EXTRA_USERS]: {
    name: 'Extra 10 Benutzerplätze',
    description: '10 zusätzliche Benutzerplätze',
    unitPriceCents: 19900,
    recurring: AddonRecurring.MONTHLY,
    stripePriceId: process.env.STRIPE_PRICE_EXTRA_USERS_MONTHLY,
  },
  [AddonType.PREMIUM_SUPPORT]: {
    name: 'Premium-Support (24/7 Telefon)',
    description: 'Rund-um-die-Uhr-Telefonsupport mit 1h Antwortzeit',
    unitPriceCents: 19900,
    recurring: AddonRecurring.MONTHLY,
    stripePriceId: process.env.STRIPE_PRICE_PREMIUM_SUPPORT_MONTHLY,
  },
  [AddonType.CUSTOM_TEMPLATES]: {
    name: 'Individuelle Vorlagen-Entwicklung',
    description: 'Maßgeschneiderte Dokumentvorlagen',
    unitPriceCents: 49900,
    recurring: AddonRecurring.ONETIME,
    stripePriceId: process.env.STRIPE_PRICE_CUSTOM_TEMPLATES_ONETIME,
  },
  [AddonType.MIGRATION_ONBOARDING]: {
    name: 'Migration & Onboarding',
    description: 'White-Glove-Migration mit persönlichem Training',
    unitPriceCents: 99900,
    recurring: AddonRecurring.ONETIME,
    stripePriceId: process.env.STRIPE_PRICE_MIGRATION_ONETIME,
  },
  [AddonType.DEDICATED_INFRASTRUCTURE]: {
    name: 'Dedizierte Infrastruktur',
    description: 'Isolierte Rechen- und Speicherressourcen',
    unitPriceCents: 49900,
    recurring: AddonRecurring.MONTHLY,
    stripePriceId: process.env.STRIPE_PRICE_DEDICATED_INFRA_MONTHLY,
  },
  [AddonType.EXTRA_AI_CREDITS_5M]: {
    name: 'Extra 5 Mio. AI Credits/Monat',
    description: '5 Millionen zusätzliche AI Credits',
    unitPriceCents: 9900,
    recurring: AddonRecurring.MONTHLY,
    stripePriceId: process.env.STRIPE_PRICE_AI_CREDITS_5M_MONTHLY,
  },
  [AddonType.EXTRA_AI_CREDITS_20M]: {
    name: 'Extra 20 Mio. AI Credits/Monat',
    description: '20 Millionen zusätzliche AI Credits',
    unitPriceCents: 29900,
    recurring: AddonRecurring.MONTHLY,
    stripePriceId: process.env.STRIPE_PRICE_AI_CREDITS_20M_MONTHLY,
  },
} as const;

export const CreateAddonPurchaseSchema = z.object({
  addonType: z.nativeEnum(AddonType),
  quantity: z.number().min(1).max(100).default(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreateAddonPurchaseInput = z.infer<typeof CreateAddonPurchaseSchema>;

@Injectable()
export class AddonService {
  private readonly logger = new Logger(AddonService.name);

  constructor(
    private readonly stripeProvider: StripeFactory,
    private readonly db: PrismaClient
  ) {}

  get stripe() {
    return this.stripeProvider.stripe;
  }

  async createAddonPurchase(
    user: CurrentUser,
    input: CreateAddonPurchaseInput
  ): Promise<{ checkoutUrl: string; purchaseId: string }> {
    const result = CreateAddonPurchaseSchema.safeParse(input);
    if (!result.success) {
      throw new InvalidCheckoutParameters();
    }

    const { addonType, quantity, successUrl, cancelUrl } = result.data;
    const config = ADDON_CONFIG[addonType];

    if (!config || !config.stripePriceId) {
      throw new InvalidCheckoutParameters('Addon configuration not found');
    }

    // Get or create Stripe customer
    const customer = await this.getOrCreateCustomer(user);

    // Create addon purchase record
    const purchase = await this.db.addonPurchase.create({
      data: {
        userId: user.id,
        addonType,
        addonName: config.name,
        stripePriceId: config.stripePriceId,
        quantity,
        unitPriceCents: config.unitPriceCents,
        totalPriceCents: config.unitPriceCents * quantity,
        currency: 'eur',
        recurring: config.recurring,
        status: AddonStatus.PENDING,
        metadata: {
          config: JSON.stringify(config),
        },
      },
    });

    try {
      // Create Stripe checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customer.stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: config.stripePriceId,
            quantity,
          },
        ],
        mode: config.recurring === AddonRecurring.ONETIME ? 'payment' : 'subscription',
        subscription_data:
          config.recurring === AddonRecurring.ONETIME
            ? undefined
            : {
                metadata: {
                  purchase_id: purchase.id.toString(),
                  user_id: user.id,
                  addon_type: addonType,
                },
              },
        success_url: `${successUrl}?purchase_id=${purchase.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cancelUrl}?purchase_id=${purchase.id}`,
        metadata: {
          purchase_id: purchase.id.toString(),
          user_id: user.id,
          addon_type: addonType,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        customer_update: {
          address: 'auto',
          name: 'auto',
        },
      });

      // Update purchase with session ID
      await this.db.addonPurchase.update({
        where: { id: purchase.id },
        data: {
          stripeCheckoutSessionId: session.id,
        },
      });

      return {
        checkoutUrl: session.url!,
        purchaseId: purchase.id.toString(),
      };
    } catch (error) {
      // Clean up purchase record if checkout fails
      await this.db.addonPurchase.delete({
        where: { id: purchase.id },
      });
      throw error;
    }
  }

  async handleSuccessfulCheckout(sessionId: string): Promise<void> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'line_items'],
    });

    const purchaseId = session.metadata?.purchase_id;
    if (!purchaseId) {
      this.logger.warn(`No purchase_id found in session ${sessionId}`);
      return;
    }

    const parsedPurchaseId = this.parsePurchaseId(purchaseId, `checkout_session:${sessionId}`);
    if (!parsedPurchaseId) {
      return;
    }

    const purchase = await this.db.addonPurchase.findUnique({
      where: { id: parsedPurchaseId },
    });

    if (!purchase) {
      this.logger.warn(`Purchase ${purchaseId} not found`);
      return;
    }

    if (purchase.status === AddonStatus.ACTIVE) {
      return;
    }

    const isSubscription = session.mode === 'subscription';
    const subscriptionId = isSubscription ? (session.subscription as Stripe.Subscription)?.id : null;
    const invoiceId = !isSubscription ? (session.payment_intent as Stripe.PaymentIntent)?.latest_charge : null;

    const activated = await this.db.addonPurchase.updateMany({
      where: {
        id: purchase.id,
        status: {
          not: AddonStatus.ACTIVE,
        },
      },
      data: {
        status: AddonStatus.ACTIVE,
        stripeSubscriptionId: subscriptionId,
        stripeInvoiceId: typeof invoiceId === 'string' ? invoiceId : null,
        startsAt: new Date(),
        endsAt: isSubscription
          ? null
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for onetime
      },
    });

    if (activated.count === 0) {
      return;
    }

    // Credit the addon balance
    await this.creditAddonBalance(
      purchase.userId,
      purchase.addonType as AddonType,
      purchase.quantity,
      {
        transactionType: 'purchase',
        referenceId: `checkout_session:${session.id}`,
        description: `Initial purchase for ${purchase.addonName}`,
      }
    );
  }

  async handleInvoicePaid(invoiceId: string): Promise<void> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;

    if (!subscriptionId) return;

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const purchaseId = subscription.metadata?.purchase_id;

    if (!purchaseId) {
      return;
    }

    const parsedPurchaseId = this.parsePurchaseId(purchaseId, `invoice:${invoiceId}`);
    if (!parsedPurchaseId) {
      return;
    }

    const purchase = await this.db.addonPurchase.findUnique({
      where: { id: parsedPurchaseId },
    });
    if (!purchase) return;

    if (purchase.status !== AddonStatus.ACTIVE) {
      await this.db.addonPurchase.update({
        where: { id: purchase.id },
        data: {
          status: AddonStatus.ACTIVE,
          stripeSubscriptionId: subscription.id,
          startsAt: purchase.startsAt ?? new Date(),
        },
      });
    }

    await this.creditAddonBalance(
      purchase.userId,
      purchase.addonType as AddonType,
      purchase.quantity,
      {
        transactionType: 'recurring',
        referenceId: invoice.id,
        description: `Recurring payment for ${purchase.addonName}`,
      }
    );
  }

  async handleSubscriptionDeleted(subscriptionId: string): Promise<void> {
    const purchase = await this.db.addonPurchase.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!purchase) return;

    await this.db.addonPurchase.update({
      where: { id: purchase.id },
      data: {
        status: AddonStatus.CANCELED,
        canceledAt: purchase.canceledAt ?? new Date(),
        endsAt: purchase.endsAt ?? new Date(),
      },
    });
  }

  async cancelAddonPurchase(
    user: CurrentUser,
    purchaseId: string
  ): Promise<void> {
    const parsedPurchaseId = this.parsePurchaseId(purchaseId, `cancel_request_user:${user.id}`);
    if (!parsedPurchaseId) {
      throw new ActionForbidden('Invalid purchase id');
    }

    const purchase = await this.db.addonPurchase.findUnique({
      where: { id: parsedPurchaseId },
    });

    if (!purchase || purchase.userId !== user.id) {
      throw new ActionForbidden();
    }

    if (purchase.status !== AddonStatus.ACTIVE || !purchase.stripeSubscriptionId) {
      throw new ActionForbidden('Addon cannot be canceled');
    }

    // Cancel Stripe subscription
    await this.stripe.subscriptions.update(purchase.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update purchase record
    await this.db.addonPurchase.update({
      where: { id: purchase.id },
      data: {
        status: AddonStatus.CANCELED,
        canceledAt: new Date(),
      },
    });
  }

  async getAddonPurchases(user: CurrentUser): Promise<any[]> {
    return this.db.addonPurchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listBalances(user: CurrentUser) {
    return this.db.addonCreditBalance.findMany({
      where: { userId: user.id },
      orderBy: { addonType: 'asc' },
    });
  }

  async getAddonBalance(user: CurrentUser, addonType: AddonType): Promise<any> {
    const balance = await this.db.addonCreditBalance.findUnique({
      where: { userId_addonType: { userId: user.id, addonType } },
    });

    return balance || {
      currentBalance: 0,
      totalPurchased: 0,
      totalConsumed: 0,
    };
  }

  async consumeAddonCredit(
    user: CurrentUser,
    addonType: AddonType,
    amount: number,
    description?: string,
    referenceId?: string
  ): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ActionForbidden('Invalid credit amount');
    }

    const balance = await this.getAddonBalance(user, addonType);

    if (balance.currentBalance < amount) {
      return false;
    }

    const result = await this.db.$transaction(async (tx) => {
      // Update only if enough balance is still available (race-condition safe)
      const updateResult = await tx.addonCreditBalance.updateMany({
        where: {
          userId: user.id,
          addonType,
          currentBalance: {
            gte: amount,
          },
        },
        data: {
          currentBalance: {
            decrement: amount,
          },
          totalConsumed: {
            increment: amount,
          },
          lastUpdatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        return null;
      }

      const updated = await tx.addonCreditBalance.findUnique({
        where: { userId_addonType: { userId: user.id, addonType } },
      });
      if (!updated) {
        return null;
      }

      // Record transaction
      await tx.addonCreditTransaction.create({
        data: {
          userId: user.id,
          addonType,
          transactionType: 'consumption',
          amount: -amount,
          balanceBefore: balance.currentBalance,
          balanceAfter: updated.currentBalance,
          description,
          referenceId,
        },
      });

      return updated;
    });

    return result ? result.currentBalance >= 0 : false;
  }

  /**
   * Consume AI credits across all AI credit balances (currently 5M + 20M packs).
   * This supports partial consumption across multiple balances and is transaction-safe.
   */
  async consumeAiCredits(
    user: CurrentUser,
    amount: number,
    description?: string,
    referenceId?: string
  ): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ActionForbidden('Invalid credit amount');
    }

    const aiTypes: AddonType[] = [
      AddonType.EXTRA_AI_CREDITS_5M,
      AddonType.EXTRA_AI_CREDITS_20M,
    ];

    const balances = await this.db.addonCreditBalance.findMany({
      where: { userId: user.id, addonType: { in: aiTypes } },
    });

    const total = balances.reduce(
      (sum, item) => sum + (item.currentBalance ?? 0),
      0
    );
    if (total < amount) {
      return false;
    }

    const txResult = await this.db.$transaction(async tx => {
      let remaining = amount;

      for (const addonType of aiTypes) {
        if (remaining <= 0) break;

        const current = await tx.addonCreditBalance.findUnique({
          where: { userId_addonType: { userId: user.id, addonType } },
        });
        const available = current?.currentBalance ?? 0;
        if (available <= 0) continue;

        const take = Math.min(available, remaining);

        const updateResult = await tx.addonCreditBalance.updateMany({
          where: {
            userId: user.id,
            addonType,
            currentBalance: {
              gte: take,
            },
          },
          data: {
            currentBalance: {
              decrement: take,
            },
            totalConsumed: {
              increment: take,
            },
            lastUpdatedAt: new Date(),
          },
        });

        if (updateResult.count === 0) {
          return null;
        }

        const updated = await tx.addonCreditBalance.findUnique({
          where: { userId_addonType: { userId: user.id, addonType } },
        });
        if (!updated) {
          return null;
        }

        await tx.addonCreditTransaction.create({
          data: {
            userId: user.id,
            addonType,
            transactionType: 'consumption',
            amount: -take,
            balanceBefore: current?.currentBalance ?? 0,
            balanceAfter: updated.currentBalance,
            description,
            referenceId: referenceId ? `${referenceId}:${addonType}` : undefined,
          },
        });

        remaining -= take;
      }

      return remaining <= 0 ? true : null;
    });

    return txResult === true;
  }

  async creditAddonBalance(
    userId: string,
    addonType: AddonType,
    quantity: number,
    opts?: {
      transactionType?: 'purchase' | 'recurring';
      referenceId?: string;
      description?: string;
    }
  ): Promise<void> {
    const config = ADDON_CONFIG[addonType];
    let creditAmount = 0;

    // Define credit amounts based on addon type
    switch (addonType) {
      case AddonType.EXTRA_PAGES:
        creditAmount = 5000 * quantity; // 5000 pages per unit
        break;
      case AddonType.EXTRA_USERS:
        creditAmount = 10 * quantity; // 10 users per unit
        break;
      case AddonType.EXTRA_AI_CREDITS_5M:
        creditAmount = 5000000 * quantity; // 5M credits per unit
        break;
      case AddonType.EXTRA_AI_CREDITS_20M:
        creditAmount = 20000000 * quantity; // 20M credits per unit
        break;
      default:
        // Support addons don't have consumable credits
        return;
    }

    await this.db.$transaction(async (tx) => {
      const existing = await tx.addonCreditBalance.findUnique({
        where: { userId_addonType: { userId, addonType } },
      });

      const balanceBefore = existing?.currentBalance ?? 0;
      const balanceAfter = balanceBefore + creditAmount;

      await tx.addonCreditBalance.upsert({
        where: { userId_addonType: { userId, addonType } },
        create: {
          userId,
          addonType,
          currentBalance: creditAmount,
          totalPurchased: creditAmount,
          totalConsumed: 0,
        },
        update: {
          currentBalance: {
            increment: creditAmount,
          },
          totalPurchased: {
            increment: creditAmount,
          },
          lastUpdatedAt: new Date(),
        },
      });

      try {
        await tx.addonCreditTransaction.create({
          data: {
            userId,
            addonType,
            transactionType: opts?.transactionType ?? 'purchase',
            amount: creditAmount,
            balanceBefore,
            balanceAfter,
            description:
              opts?.description ?? `Purchased ${quantity}x ${config.name}`,
            referenceId: opts?.referenceId,
          },
        });
      } catch (e: any) {
        // If the unique idempotency constraint blocks a duplicate credit, silently ignore.
        return;
      }
    });
  }

  private parsePurchaseId(rawPurchaseId: string, source: string): number | null {
    if (!/^\d+$/.test(rawPurchaseId)) {
      this.logger.warn(`Invalid purchase_id format from ${source}: ${rawPurchaseId}`);
      return null;
    }

    const parsedPurchaseId = Number(rawPurchaseId);
    if (!Number.isSafeInteger(parsedPurchaseId) || parsedPurchaseId <= 0) {
      this.logger.warn(`Invalid purchase_id value from ${source}: ${rawPurchaseId}`);
      return null;
    }

    return parsedPurchaseId;
  }

  private async getOrCreateCustomer(user: CurrentUser) {
    let customer = await this.db.userStripeCustomer.findUnique({
      where: { userId: user.id },
    });

    if (!customer) {
      const stripeCustomersList = await this.stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      let stripeCustomer: Stripe.Customer | undefined;
      if (stripeCustomersList.data.length) {
        stripeCustomer = stripeCustomersList.data[0];
      } else {
        stripeCustomer = await this.stripe.customers.create({
          email: user.email,
        });
      }

      customer = await this.db.userStripeCustomer.create({
        data: {
          userId: user.id,
          stripeCustomerId: stripeCustomer.id,
        },
      });
    }

    return customer;
  }
}
