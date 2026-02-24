import { Injectable, Logger } from '@nestjs/common';

import { Config, OnEvent } from '../../base';

@Injectable()
export class EsignWebhookHandler {
  private readonly logger = new Logger(EsignWebhookHandler.name);

  constructor(private readonly config: Config) {}

  @OnEvent('esign.webhook')
  async onWebhook(event: Events['esign.webhook']) {
    const relayEndpoint = this.config.payment.esign?.relayEndpoint?.trim();
    if (!relayEndpoint) {
      this.logger.debug(
        `[${event.id}] eSign webhook received (provider=${event.provider}, event=${event.event}) without relay endpoint.`
      );
      return;
    }

    const relayToken = this.config.payment.esign?.relayAuthToken?.trim();

    const response = await fetch(relayEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(relayToken ? { Authorization: `Bearer ${relayToken}` } : {}),
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[${event.id}] eSign relay failed (${response.status}): ${text || 'unknown error'}`
      );
    }

    this.logger.log(
      `[${event.id}] eSign webhook relayed successfully to configured endpoint.`
    );
  }
}
