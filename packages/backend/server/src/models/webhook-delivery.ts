import { Injectable } from '@nestjs/common';
import { Prisma, WebhookDeliveryStatus } from '@prisma/client';

import { PaginationInput } from '../base';
import { BaseModel } from './base';

export { WebhookDeliveryStatus };

export type WebhookDelivery = {
  id: string;
  workspaceId: string;
  webhookId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  lastError: string | null;
  lastResponseStatus: number | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  succeededAt: Date | null;
  failedAt: Date | null;
};

export type WebhookDeliveryAttempt = {
  id: string;
  deliveryId: string;
  attemptNo: number;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  responseStatus: number | null;
  error: string | null;
  createdAt: Date;
};

@Injectable()
export class WebhookDeliveryModel extends BaseModel {
  async createDelivery(input: {
    workspaceId: string;
    webhookId: string;
    eventId: string;
    eventType: string;
    payload: unknown;
  }) {
    const row = await this.db.webhookDelivery.create({
      data: {
        workspaceId: input.workspaceId,
        webhookId: input.webhookId,
        eventId: input.eventId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        status: WebhookDeliveryStatus.pending,
        attemptCount: 0,
      },
    });
    return row as unknown as WebhookDelivery;
  }

  async markRunning(deliveryId: string) {
    return (await this.db.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: WebhookDeliveryStatus.running },
    })) as unknown as WebhookDelivery;
  }

  async markSucceeded(deliveryId: string, responseStatus: number) {
    return (await this.db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.succeeded,
        lastError: null,
        lastResponseStatus: responseStatus,
        nextRetryAt: null,
        succeededAt: new Date(),
        failedAt: null,
      },
    })) as unknown as WebhookDelivery;
  }

  async markFailed(deliveryId: string, input: { error: string; responseStatus?: number | null; nextRetryAt?: Date | null }) {
    return (await this.db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.failed,
        lastError: input.error,
        lastResponseStatus: input.responseStatus ?? null,
        nextRetryAt: input.nextRetryAt ?? null,
        failedAt: new Date(),
      },
    })) as unknown as WebhookDelivery;
  }

  async bumpAttempt(deliveryId: string, input: { lastError?: string | null; lastResponseStatus?: number | null; nextRetryAt?: Date | null }) {
    return (await this.db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.pending,
        attemptCount: { increment: 1 },
        lastError: input.lastError ?? null,
        lastResponseStatus: input.lastResponseStatus ?? null,
        nextRetryAt: input.nextRetryAt ?? null,
      },
    })) as unknown as WebhookDelivery;
  }

  async createAttempt(input: { deliveryId: string; attemptNo: number; startedAt: Date }) {
    return (await this.db.webhookDeliveryAttempt.create({
      data: {
        deliveryId: input.deliveryId,
        attemptNo: input.attemptNo,
        startedAt: input.startedAt,
      },
    })) as unknown as WebhookDeliveryAttempt;
  }

  async finishAttempt(attemptId: string, input: { finishedAt: Date; durationMs: number; responseStatus?: number | null; error?: string | null }) {
    return (await this.db.webhookDeliveryAttempt.update({
      where: { id: attemptId },
      data: {
        finishedAt: input.finishedAt,
        durationMs: input.durationMs,
        responseStatus: input.responseStatus ?? null,
        error: input.error ?? null,
      },
    })) as unknown as WebhookDeliveryAttempt;
  }

  async get(deliveryId: string) {
    return (await this.db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        attempts: {
          orderBy: { attemptNo: 'desc' },
        },
      },
    })) as unknown as (WebhookDelivery & { attempts: WebhookDeliveryAttempt[] }) | null;
  }

  async listByWorkspace(
    workspaceId: string,
    options?: {
      webhookId?: string;
      status?: WebhookDeliveryStatus;
      eventType?: string;
      from?: Date;
      to?: Date;
    } & PaginationInput
  ) {
    const where: Prisma.WebhookDeliveryWhereInput = {
      workspaceId,
      ...(options?.webhookId ? { webhookId: options.webhookId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.eventType ? { eventType: options.eventType } : {}),
      ...(options?.from || options?.to
        ? {
            createdAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.db.webhookDelivery.count({ where }),
      this.db.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options?.offset,
        take: options?.first,
      }),
    ]);

    return [total, rows as unknown as WebhookDelivery[]] as const;
  }
}
