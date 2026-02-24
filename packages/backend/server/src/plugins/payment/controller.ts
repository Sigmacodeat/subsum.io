import type { RawBodyRequest } from '@nestjs/common';
import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';

import {
  BadRequest,
  Cache,
  Config,
  EventBus,
  InternalServerError,
  Throttle,
} from '../../base';
import { Public } from '../../core/auth';
import { StripeFactory } from './stripe';

const WEBHOOK_DEDUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('/api/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly config: Config,
    private readonly stripeProvider: StripeFactory,
    private readonly event: EventBus,
    private readonly cache: Cache
  ) {}

  @Public()
  @Throttle('strict')
  @Post('/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const nestedWebhookKey = this.config.payment.stripe?.webhookKey;
    const legacyWebhookKey = this.config.payment.webhookKey;
    const webhookKey = nestedWebhookKey || legacyWebhookKey || '';
    // Retrieve the event by verifying the signature using the raw body and secret.
    const signature = req.headers['stripe-signature'];
    try {
      const event = this.stripeProvider.stripe.webhooks.constructEvent(
        req.rawBody ?? '',
        signature ?? '',
        webhookKey
      );

      this.logger.debug(
        `[${event.id}] Stripe Webhook {${event.type}} received.`
      );

      const dedupeKey = `stripe:webhook:event:${event.id}`;
      const accepted = await this.cache.setnx(dedupeKey, 1, {
        ttl: WEBHOOK_DEDUP_TTL_MS,
      });
      if (!accepted) {
        const duplicated = await this.cache.has(dedupeKey);
        if (duplicated) {
          this.logger.debug(`[${event.id}] Duplicate Stripe webhook ignored.`);
          return {
            received: true,
          };
        }

        this.logger.warn(
          `[${event.id}] Stripe webhook dedupe unavailable, continue processing event.`
        );
      }

      // Stripe requires responseing webhook immediately and handle event asynchronously.
      setImmediate(() => {
        this.event.emitAsync(`stripe.${event.type}` as any, event).catch(e => {
          this.logger.error('Failed to handle Stripe Webhook event.', e);
        });
      });

      return {
        received: true,
      };
    } catch (err: any) {
      if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new BadRequest('Invalid Stripe webhook signature');
      }

      this.logger.error('Stripe webhook processing failed.', err);
      throw new InternalServerError('Webhook processing failed');
    }
  }
}
