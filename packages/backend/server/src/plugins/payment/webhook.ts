import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { OnEvent } from '../../base';
import { AffiliateService } from './affiliate';
import { SubscriptionService } from './service';
import { StripeFactory } from './stripe';

/**
 * Stripe webhook events sent in random order, and may be even sent more than once.
 *
 * A good way to avoid events sequence issue is fetch the latest object data regarding that event,
 * and all following operations only depend on the latest state instead of the one in event data.
 */
@Injectable()
export class StripeWebhook {
  constructor(
    private readonly service: SubscriptionService,
    private readonly stripeProvider: StripeFactory,
    private readonly affiliate: AffiliateService
  ) {}

  get stripe() {
    return this.stripeProvider.stripe;
  }

  @OnEvent('stripe.invoice.created')
  @OnEvent('stripe.invoice.updated')
  @OnEvent('stripe.invoice.finalization_failed')
  @OnEvent('stripe.invoice.payment_failed')
  @OnEvent('stripe.invoice.paid')
  async onInvoiceUpdated(
    event:
      | Stripe.InvoiceCreatedEvent
      | Stripe.InvoiceUpdatedEvent
      | Stripe.InvoiceFinalizationFailedEvent
      | Stripe.InvoicePaymentFailedEvent
      | Stripe.InvoicePaidEvent
  ) {
    const invoice = await this.stripe.invoices.retrieve(event.data.object.id);

    if (invoice.status === 'paid') {
      await this.affiliate.processPaidInvoice(invoice.id);
    }

    if (invoice.status === 'void' || invoice.status === 'uncollectible') {
      await this.service.handleRefundedInvoice(invoice.id, 'refund');
      await this.affiliate.reverseInvoiceCommissions(invoice.id, 'refund');
    }

    await this.service.saveStripeInvoice(invoice);
  }

  @OnEvent('stripe.customer.subscription.created')
  @OnEvent('stripe.customer.subscription.updated')
  async onSubscriptionChanges(
    event:
      | Stripe.CustomerSubscriptionUpdatedEvent
      | Stripe.CustomerSubscriptionCreatedEvent
  ) {
    const subscription = await this.stripe.subscriptions.retrieve(
      event.data.object.id,
      {
        expand: ['customer'],
      }
    );

    await this.service.saveStripeSubscription(subscription);
  }

  @OnEvent('stripe.customer.subscription.deleted')
  async onSubscriptionDeleted(event: Stripe.CustomerSubscriptionDeletedEvent) {
    await this.service.deleteStripeSubscription(event.data.object);
  }

  private extractInvoiceId(charge: Stripe.Charge) {
    return typeof charge.invoice === 'string'
      ? charge.invoice
      : charge.invoice?.id;
  }

  @OnEvent('stripe.charge.refunded')
  async onChargeRefunded(event: Stripe.ChargeRefundedEvent) {
    const charge = event.data.object;
    const invoiceId = this.extractInvoiceId(charge);

    if (invoiceId) {
      await this.service.handleRefundedInvoice(invoiceId, 'refund');
      await this.affiliate.reverseInvoiceCommissions(invoiceId, 'refund');
    }
  }

  @OnEvent('stripe.charge.dispute.created')
  async onChargeDisputed(event: Stripe.ChargeDisputeCreatedEvent) {
    const ref = event.data.object.charge;
    if (!ref) return;
    const chargeId = typeof ref === 'string' ? ref : ref.id;

    const charge = await this.stripe.charges.retrieve(chargeId, {
      expand: ['invoice'],
    });

    const invoiceId = this.extractInvoiceId(charge);
    if (invoiceId) {
      await this.service.handleRefundedInvoice(invoiceId, 'dispute_open');
      await this.affiliate.reverseInvoiceCommissions(invoiceId, 'dispute_open');
    }
  }

  @OnEvent('stripe.charge.dispute.closed')
  async onChargeDisputeClosed(event: Stripe.ChargeDisputeClosedEvent) {
    const ref = event.data.object.charge;
    if (!ref) return;
    const chargeId = typeof ref === 'string' ? ref : ref.id;
    const status = event.data.object.status;

    const charge = await this.stripe.charges.retrieve(chargeId, {
      expand: ['invoice'],
    });

    const invoiceId = this.extractInvoiceId(charge);

    if (invoiceId) {
      const reason =
        status === 'won' ? 'dispute_won' : ('dispute_lost' as const);
      await this.service.handleRefundedInvoice(invoiceId, reason);
      await this.affiliate.reverseInvoiceCommissions(invoiceId, reason);
    }
  }

  @OnEvent('stripe.account.updated')
  async onConnectAccountUpdated(event: Stripe.AccountUpdatedEvent) {
    const account = await this.stripe.accounts.retrieve(event.data.object.id);
    await (this.affiliate as any).syncStripeConnectAccount(account);
  }
}
