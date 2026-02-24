import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth';
import type { CurrentUser as CurrentUserType } from '../auth';
import { AccessController } from '../permission';
import { Cache, JobQueue } from '../../base';
import { Models } from '../../models';
import { WebhookDeliveryStatus } from '../../models/webhook-delivery';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const IDEMPOTENCY_TTL_MS = 1000 * 60 * 10;
const IDEMPOTENCY_POLL_INTERVAL_MS = 250;
const IDEMPOTENCY_MAX_WAIT_MS = 5000;

function resolveIdempotencyKey(headerKey?: string) {
  const key = headerKey?.trim();
  if (!key) {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  return key;
}

function parsePositiveInt(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const n = Number(input);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(`Invalid positive integer value: ${input}`);
  }
  return n;
}

function getTotalPages(total: number, pageSize: number) {
  if (total <= 0) return 0;
  return Math.ceil(total / pageSize);
}

function normalizePagination(page?: string, pageSize?: string) {
  const normalizedPage = parsePositiveInt(page, DEFAULT_PAGE);
  const normalizedPageSize = Math.min(
    parsePositiveInt(pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    offset: (normalizedPage - 1) * normalizedPageSize,
  };
}

type IdempotencyEntry<T> =
  | {
      state: 'inflight';
      createdAt: string;
    }
  | {
      state: 'done';
      payload: T;
    };

@ApiTags('public-api')
@ApiBearerAuth('Bearer')
@Controller('/api/public/v1')
export class WebhookDeliveryController {
  constructor(
    private readonly models: Models,
    private readonly ac: AccessController,
    private readonly cache: Cache,
    private readonly queue: JobQueue
  ) {}

  @Get('/workspaces/:workspaceId/webhook-deliveries')
  @ApiOperation({ summary: 'List webhook delivery logs for a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 25 })
  @ApiQuery({ name: 'webhookId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: WebhookDeliveryStatus })
  @ApiQuery({ name: 'eventType', required: false })
  async listDeliveries(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('webhookId') webhookId?: string,
    @Query('status') status?: string,
    @Query('eventType') eventType?: string
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Read');

    const pagination = normalizePagination(page, pageSize);

    const statusFilter = status
      ? (status as WebhookDeliveryStatus)
      : undefined;

    const [total, deliveries] = await this.models.webhookDelivery.listByWorkspace(
      workspaceId,
      {
        webhookId,
        status: statusFilter,
        eventType,
        first: pagination.pageSize,
        offset: pagination.offset,
      }
    );

    return {
      data: deliveries.map(delivery => ({
        id: delivery.id,
        webhookId: delivery.webhookId,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        lastError: delivery.lastError,
        lastResponseStatus: delivery.lastResponseStatus,
        nextRetryAt: delivery.nextRetryAt,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
        succeededAt: delivery.succeededAt,
        failedAt: delivery.failedAt,
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: getTotalPages(total, pagination.pageSize),
      },
    };
  }

  @Get('/workspaces/:workspaceId/webhook-deliveries/:deliveryId')
  @ApiOperation({ summary: 'Get a single webhook delivery with attempts' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'deliveryId' })
  async getDelivery(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('deliveryId') deliveryId: string
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Read');

    const delivery = await this.models.webhookDelivery.get(deliveryId);
    if (!delivery || delivery.workspaceId !== workspaceId) {
      throw new NotFoundException('Webhook delivery not found');
    }

    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventId: delivery.eventId,
      eventType: delivery.eventType,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      lastError: delivery.lastError,
      lastResponseStatus: delivery.lastResponseStatus,
      nextRetryAt: delivery.nextRetryAt,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
      succeededAt: delivery.succeededAt,
      failedAt: delivery.failedAt,
      payload: delivery.payload,
      attempts: delivery.attempts.map(attempt => ({
        id: attempt.id,
        attemptNo: attempt.attemptNo,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        durationMs: attempt.durationMs,
        responseStatus: attempt.responseStatus,
        error: attempt.error,
      })),
    };
  }

  @Post('/workspaces/:workspaceId/webhook-deliveries/:deliveryId/replay')
  @ApiOperation({ summary: 'Replay a failed webhook delivery' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'deliveryId' })
  async replayDelivery(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('deliveryId') deliveryId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader);

    const result = await this.withIdempotency(
      user.id,
      workspaceId,
      'replay-delivery',
      idempotencyKey,
      async () => {
        const delivery = await this.models.webhookDelivery.get(deliveryId);
        if (!delivery || delivery.workspaceId !== workspaceId) {
          throw new NotFoundException('Webhook delivery not found');
        }

        if (delivery.status === WebhookDeliveryStatus.succeeded) {
          throw new BadRequestException(
            'Cannot replay a delivery that already succeeded'
          );
        }

        if (delivery.status === WebhookDeliveryStatus.running) {
          throw new BadRequestException(
            'Cannot replay a delivery that is currently running'
          );
        }

        await this.models.webhookDelivery.bumpAttempt(deliveryId, {
          lastError: null,
          lastResponseStatus: null,
          nextRetryAt: null,
        });

        await this.queue.add('notification.webhookDeliver', {
          deliveryId,
        });

        return {
          id: delivery.id,
          status: 'replayed',
          message: 'Delivery has been re-enqueued for processing',
        };
      }
    );

    return result;
  }

  private async withIdempotency<T>(
    userId: string,
    workspaceId: string,
    scope: string,
    idempotencyKey: string,
    factory: () => Promise<T>
  ) {
    const cacheKey = `public-api:idempotency:${userId}:${workspaceId}:${scope}:${idempotencyKey}`;
    const cached = await this.cache.get<IdempotencyEntry<T>>(cacheKey);
    if (cached?.state === 'done') {
      return cached.payload;
    }

    const claimed = await this.cache.setnx<IdempotencyEntry<T>>(
      cacheKey,
      {
        state: 'inflight',
        createdAt: new Date().toISOString(),
      },
      { ttl: IDEMPOTENCY_TTL_MS }
    );

    if (claimed) {
      try {
        const payload = await factory();
        await this.cache.set<IdempotencyEntry<T>>(
          cacheKey,
          {
            state: 'done',
            payload,
          },
          { ttl: IDEMPOTENCY_TTL_MS }
        );
        return payload;
      } catch (error) {
        await this.cache.delete(cacheKey);
        throw error;
      }
    }

    const maxAttempts = Math.ceil(
      IDEMPOTENCY_MAX_WAIT_MS / IDEMPOTENCY_POLL_INTERVAL_MS
    );
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve =>
        setTimeout(resolve, IDEMPOTENCY_POLL_INTERVAL_MS)
      );
      const polled = await this.cache.get<IdempotencyEntry<T>>(cacheKey);
      if (polled?.state === 'done') {
        return polled.payload;
      }
    }

    throw new ConflictException(
      'Another request with this idempotency key is still processing'
    );
  }
}
