import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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
import { z } from 'zod';

import { BadRequest, Cache, Config, EventBus, Throttle } from '../../base';
import { Public } from '../../core/auth';

const ESIGN_WEBHOOK_DEDUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EsignWebhookPayloadSchema = z
  .object({
    provider: z.enum(['docusign', 'signaturit', 'dropbox_sign']),
    event: z.string().min(1),
    envelopeId: z.string().min(1),
    id: z.string().optional(),
    payload: z.record(z.string()).optional(),
  })
  .passthrough();

function stableStringify(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map(item => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, value]) => `${JSON.stringify(key)}:${stableStringify(value)}`)
    .join(',')}}`;
}

@Controller('/api/esign')
export class EsignWebhookController {
  private readonly logger = new Logger(EsignWebhookController.name);

  constructor(
    private readonly config: Config,
    private readonly event: EventBus,
    private readonly cache: Cache
  ) {}

  private verifySignature(input: {
    rawBody: string;
    signatureHeader?: string;
    timestampHeader?: string;
    secret: string;
    toleranceSec: number;
  }) {
    const signature = input.signatureHeader?.trim() ?? '';
    const timestamp = input.timestampHeader?.trim() ?? '';
    if (!signature || !timestamp) {
      throw new BadRequest('Missing eSign webhook signature headers');
    }

    const timestampMs = Number(timestamp) * 1000;
    if (!Number.isFinite(timestampMs)) {
      throw new BadRequest('Invalid eSign webhook timestamp header');
    }

    const ageMs = Math.abs(Date.now() - timestampMs);
    if (ageMs > input.toleranceSec * 1000) {
      throw new BadRequest('eSign webhook timestamp outside tolerance window');
    }

    const expectedHex = createHmac('sha256', input.secret)
      .update(`${timestamp}.${input.rawBody}`)
      .digest('hex');

    const expected = Buffer.from(expectedHex, 'hex');
    const provided = Buffer.from(signature, 'hex');
    if (
      expected.length === 0 ||
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw new BadRequest('Invalid eSign webhook signature');
    }
  }

  @Public()
  @Throttle('strict')
  @Post('/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const cfg = this.config.payment.esign;
    if (!cfg?.enabled) {
      return { ok: true, skipped: 'disabled' };
    }

    const webhookSecret = cfg.webhookSecret?.trim() ?? '';
    if (!webhookSecret) {
      throw new BadRequest('eSign webhook secret is not configured');
    }

    const rawBody = (req.rawBody ?? '').toString();
    if (!rawBody) {
      throw new BadRequest('Missing raw webhook payload');
    }

    this.verifySignature({
      rawBody,
      signatureHeader: req.headers['x-esign-signature'] as string | undefined,
      timestampHeader: req.headers['x-esign-timestamp'] as string | undefined,
      secret: webhookSecret,
      toleranceSec: cfg.webhookToleranceSec ?? 300,
    });

    let payloadRaw: unknown = req.body;
    if (typeof payloadRaw === 'string') {
      try {
        payloadRaw = JSON.parse(payloadRaw);
      } catch {
        throw new BadRequest('Invalid JSON payload');
      }
    }

    const parsed = EsignWebhookPayloadSchema.safeParse(payloadRaw);
    if (!parsed.success) {
      throw new BadRequest(`Invalid eSign webhook payload: ${parsed.error.message}`);
    }

    const payload = parsed.data;
    const eventId =
      payload.id?.trim() ||
      createHash('sha256')
        .update(`${payload.provider}:${payload.envelopeId}:${payload.event}:${stableStringify(payload.payload ?? {})}`)
        .digest('hex');

    const dedupeKey = `esign:webhook:event:${eventId}`;
    const accepted = await this.cache.setnx(dedupeKey, 1, {
      ttl: ESIGN_WEBHOOK_DEDUP_TTL_MS,
    });
    if (!accepted && (await this.cache.has(dedupeKey))) {
      this.logger.debug(`[${eventId}] Duplicate eSign webhook ignored.`);
      return { ok: true, duplicate: true };
    }

    this.logger.log(
      `[${eventId}] eSign webhook {${payload.provider}/${payload.event}} envelope=${payload.envelopeId}`
    );

    setImmediate(() => {
      this.event
        .emitAsync('esign.webhook', {
          id: eventId,
          provider: payload.provider,
          envelopeId: payload.envelopeId,
          event: payload.event,
          payload: payload.payload ?? {},
        })
        .catch(error => {
          this.logger.error('Failed to handle eSign webhook event.', error);
        });
    });

    return { ok: true };
  }
}
