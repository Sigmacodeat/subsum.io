import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

import { OnEvent } from '../../base';
import { AddonService } from './addon';

@Injectable()
export class AddonWebhookHandler {
  private readonly logger = new Logger(AddonWebhookHandler.name);

  constructor(
    private readonly addonService: AddonService
  ) {}

  @OnEvent('stripe.checkout.session.completed')
  async onCheckoutSessionCompleted(event: Stripe.CheckoutSessionCompletedEvent) {
    const session = event.data.object;
    if (!session?.metadata?.purchase_id) return;

    this.logger.log(
      `Processing addon checkout completion for purchase ${session.metadata.purchase_id}`
    );

    await this.addonService.handleSuccessfulCheckout(session.id);
  }

  // NOTE: We intentionally do NOT auto-credit on invoice.paid here yet.
  @OnEvent('stripe.invoice.paid')
  async onInvoicePaid(event: Stripe.InvoicePaidEvent) {
    const invoiceId = event.data.object.id;
    this.logger.log(`Processing addon invoice paid: ${invoiceId}`);
    await this.addonService.handleInvoicePaid(invoiceId);
  }

  @OnEvent('stripe.customer.subscription.deleted')
  async onSubscriptionDeleted(event: Stripe.CustomerSubscriptionDeletedEvent) {
    const subscriptionId = event.data.object.id;
    this.logger.log(`Processing addon subscription deleted: ${subscriptionId}`);
    await this.addonService.handleSubscriptionDeleted(subscriptionId);
  }
}
