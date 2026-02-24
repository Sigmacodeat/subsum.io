import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { JOB_SIGNAL, OnJob } from '../../base';
import { Models } from '../../models';
import { WebhookDeliveryStatus } from '../../models/webhook-delivery';

declare global {
  interface Jobs {
    'notification.webhookDeliver': {
      deliveryId: string;
    };
  }
}

const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [0, 1500, 5000];
const DELIVERY_TIMEOUT_MS = 10000;

interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: string[];
}

@Injectable()
export class WebhookJob {
  private readonly logger = new Logger('WebhookJob');

  constructor(private readonly models: Models) {}

  @OnJob('notification.webhookDeliver')
  async deliverWebhook({ deliveryId }: Jobs['notification.webhookDeliver']) {
    const delivery = await this.models.webhookDelivery.get(deliveryId);
    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found, skipping.`);
      return;
    }

    if (delivery.status === WebhookDeliveryStatus.succeeded) {
      this.logger.debug(`Delivery ${deliveryId} already succeeded, skipping.`);
      return;
    }

    if (delivery.attemptCount >= MAX_ATTEMPTS) {
      this.logger.warn(
        `Delivery ${deliveryId} exhausted all ${MAX_ATTEMPTS} attempts, marking as failed.`
      );
      await this.models.webhookDelivery.markFailed(deliveryId, {
        error: `Exhausted all ${MAX_ATTEMPTS} delivery attempts`,
        responseStatus: delivery.lastResponseStatus,
      });
      return;
    }

    const webhookConfig = await this.getWebhookConfig(
      delivery.workspaceId,
      delivery.webhookId
    );
    if (!webhookConfig) {
      this.logger.warn(
        `Webhook ${delivery.webhookId} not found or deleted, marking delivery as failed.`
      );
      await this.models.webhookDelivery.markFailed(deliveryId, {
        error: 'Webhook configuration not found or deleted',
      });
      return;
    }

    const attemptNo = delivery.attemptCount + 1;
    const startedAt = new Date();

    const attempt = await this.models.webhookDelivery.createAttempt({
      deliveryId,
      attemptNo,
      startedAt,
    });

    await this.models.webhookDelivery.markRunning(deliveryId);

    try {
      const { responseStatus, error } = await this.executeDelivery(
        webhookConfig,
        delivery.payload
      );

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      await this.models.webhookDelivery.finishAttempt(attempt.id, {
        finishedAt,
        durationMs,
        responseStatus,
        error,
      });

      if (responseStatus && responseStatus >= 200 && responseStatus < 300) {
        await this.models.webhookDelivery.markSucceeded(
          deliveryId,
          responseStatus
        );
        this.logger.log(
          `Delivery ${deliveryId} succeeded on attempt ${attemptNo} (HTTP ${responseStatus})`
        );
        return;
      }

      if (attemptNo < MAX_ATTEMPTS) {
        const retryDelay = RETRY_DELAYS_MS[attemptNo - 1] || 5000;
        const nextRetryAt = new Date(Date.now() + retryDelay);

        await this.models.webhookDelivery.bumpAttempt(deliveryId, {
          lastError: error || `HTTP ${responseStatus}`,
          lastResponseStatus: responseStatus,
          nextRetryAt,
        });

        this.logger.warn(
          `Delivery ${deliveryId} attempt ${attemptNo} failed (HTTP ${responseStatus}), retrying in ${retryDelay}ms`
        );

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return JOB_SIGNAL.Retry;
      } else {
        await this.models.webhookDelivery.markFailed(deliveryId, {
          error: error || `HTTP ${responseStatus}`,
          responseStatus,
        });
        this.logger.error(
          `Delivery ${deliveryId} failed after ${attemptNo} attempts (HTTP ${responseStatus})`
        );
        return;
      }
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const errorMessage = err?.message || String(err);

      await this.models.webhookDelivery.finishAttempt(attempt.id, {
        finishedAt,
        durationMs,
        error: errorMessage,
      });

      if (attemptNo < MAX_ATTEMPTS) {
        const retryDelay = RETRY_DELAYS_MS[attemptNo - 1] || 5000;
        const nextRetryAt = new Date(Date.now() + retryDelay);

        await this.models.webhookDelivery.bumpAttempt(deliveryId, {
          lastError: errorMessage,
          nextRetryAt,
        });

        this.logger.warn(
          `Delivery ${deliveryId} attempt ${attemptNo} threw error, retrying in ${retryDelay}ms: ${errorMessage}`
        );

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return JOB_SIGNAL.Retry;
      } else {
        await this.models.webhookDelivery.markFailed(deliveryId, {
          error: errorMessage,
        });
        this.logger.error(
          `Delivery ${deliveryId} failed after ${attemptNo} attempts with error: ${errorMessage}`
        );
        return;
      }
    }
  }

  private async executeDelivery(
    webhook: WebhookConfig,
    payload: unknown
  ): Promise<{ responseStatus?: number; error?: string }> {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      DELIVERY_TIMEOUT_MS
    );

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Subsumio-Signature': signature,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return { responseStatus: response.status };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return { error: `Timeout after ${DELIVERY_TIMEOUT_MS}ms` };
      }
      return { error: err?.message || String(err) };
    }
  }

  private async getWebhookConfig(
    workspaceId: string,
    webhookId: string
  ): Promise<WebhookConfig | null> {
    const config = await this.models.appConfig.get(`webhook:${workspaceId}`);
    if (!config?.value) return null;

    const webhooks = Array.isArray(config.value) ? config.value : [];
    const webhook = webhooks.find((w: any) => w.id === webhookId) as any;
    if (!webhook) return null;

    return {
      id: webhook.id as string,
      url: webhook.url as string,
      secret: webhook.secret as string,
      events: (webhook.events as string[]) || [],
    };
  }
}
