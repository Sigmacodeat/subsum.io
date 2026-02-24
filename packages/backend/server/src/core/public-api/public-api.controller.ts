import {
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, Public } from '../auth';
import type { CurrentUser as CurrentUserType } from '../auth';
import { DocReader, DocWriter, PgWorkspaceDocStorageAdapter } from '../doc';
import { AccessController } from '../permission';
import { Cache, JobQueue } from '../../base';
import { Models } from '../../models';
import { IndexerService } from '../../plugins/indexer';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const PUBLIC_API_BASE_PATH = '/api/public/v1';
const IDEMPOTENCY_TTL_MS = 1000 * 60 * 10;
const WEBHOOK_APP_CONFIG_PREFIX = 'publicApi.webhooks';
const WEBHOOK_EVENT_TYPES = [
  'document.created',
  'document.updated',
  'document.deleted',
] as const;
const IDEMPOTENCY_POLL_INTERVAL_MS = 250;
const IDEMPOTENCY_MAX_WAIT_MS = 5000;

interface CreateDocumentRequest {
  title?: string;
  content?: string;
}

function resolveIdempotencyKey(headerKey?: string) {
  const key = headerKey?.trim();
  if (!key) {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  return key;
}

function normalizeWebhookEvents(events: string[] | undefined) {
  if (!events?.length) {
    throw new BadRequestException('events must contain at least one event type');
  }
  const normalized = [...new Set(events.map(event => event.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new BadRequestException('events must contain at least one event type');
  }
  const invalid = normalized.filter(
    event => !WEBHOOK_EVENT_TYPES.includes(event as (typeof WEBHOOK_EVENT_TYPES)[number])
  );
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Unsupported event types: ${invalid.join(', ')}. Supported: ${WEBHOOK_EVENT_TYPES.join(', ')}`
    );
  }
  return normalized;
}

function normalizeWebhookUrl(urlInput: string | undefined) {
  const normalized = urlInput?.trim();
  if (!normalized) {
    throw new BadRequestException('url is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new BadRequestException('url must be a valid https endpoint');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('url must use https');
  }

  return parsed.toString();
}

interface UpdateDocumentRequest {
  title?: string;
  content?: string;
}

interface CreateWebhookRequest {
  url?: string;
  events?: string[];
}

interface UpdateWebhookRequest {
  url?: string;
  events?: string[];
  enabled?: boolean;
  rotateSecret?: boolean;
}

type PublicApiWebhook = {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

type IdempotencyEntry<T> =
  | {
      state: 'inflight';
      createdAt: string;
    }
  | {
      state: 'done';
      payload: T;
    };

type PublicApiWebhookResponse = Omit<PublicApiWebhook, 'secret'>;

type PublicApiWebhookEvent = {
  id: string;
  type: (typeof WEBHOOK_EVENT_TYPES)[number];
  occurredAt: string;
  workspaceId: string;
  data: Record<string, unknown>;
};

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

@ApiTags('public-api')
@ApiBearerAuth('Bearer')
@Controller('/api/public/v1')
export class PublicApiController {
  private readonly logger = new Logger(PublicApiController.name);

  constructor(
    private readonly models: Models,
    private readonly ac: AccessController,
    private readonly docReader: DocReader,
    private readonly indexer: IndexerService,
    private readonly docWriter: DocWriter,
    private readonly workspaceStorage: PgWorkspaceDocStorageAdapter,
    private readonly cache: Cache,
    private readonly queue: JobQueue
  ) {}

  private webhookConfigKey(workspaceId: string, webhookId: string) {
    return `${WEBHOOK_APP_CONFIG_PREFIX}.${workspaceId}.${webhookId}`;
  }

  private async listWorkspaceWebhooks(workspaceId: string) {
    const all = await this.models.appConfig.load();
    const prefix = `${WEBHOOK_APP_CONFIG_PREFIX}.${workspaceId}.`;
    return all
      .filter(item => item.id.startsWith(prefix))
      .map(item => item.value as PublicApiWebhook)
      .filter(webhook => !webhook.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private toPublicWebhook(webhook: PublicApiWebhook): PublicApiWebhookResponse {
    const { secret: _, ...publicWebhook } = webhook;
    return publicWebhook;
  }

  private async enqueueWebhookDelivery(
    webhook: PublicApiWebhook,
    event: PublicApiWebhookEvent
  ) {
    try {
      const delivery = await this.models.webhookDelivery.createDelivery({
        workspaceId: webhook.workspaceId,
        webhookId: webhook.id,
        eventId: event.id,
        eventType: event.type,
        payload: event,
      });

      await this.queue.add('notification.webhookDeliver', {
        deliveryId: delivery.id,
      });

      this.logger.debug(
        `Enqueued webhook delivery ${delivery.id} for workspace ${webhook.workspaceId} webhook ${webhook.id} event ${event.id}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue webhook delivery for workspace ${webhook.workspaceId} webhook ${webhook.id} event ${event.id}`,
        error as Error
      );
    }
  }

  private async dispatchWorkspaceWebhooks(
    workspaceId: string,
    eventType: (typeof WEBHOOK_EVENT_TYPES)[number],
    data: Record<string, unknown>
  ) {
    const webhooks = await this.listWorkspaceWebhooks(workspaceId);
    const subscribed = webhooks.filter(
      webhook => webhook.enabled && webhook.events.includes(eventType)
    );

    if (subscribed.length === 0) {
      return;
    }

    const event: PublicApiWebhookEvent = {
      id: randomBytes(12).toString('hex'),
      type: eventType,
      occurredAt: new Date().toISOString(),
      workspaceId,
      data,
    };

    void Promise.allSettled(
      subscribed.map(webhook => this.enqueueWebhookDelivery(webhook, event))
    );
  }

  private async getWorkspaceWebhook(workspaceId: string, webhookId: string) {
    const all = await this.models.appConfig.load();
    const key = this.webhookConfigKey(workspaceId, webhookId);
    const item = all.find(entry => entry.id === key);
    if (!item) return null;
    const webhook = item.value as PublicApiWebhook;
    if (webhook.deletedAt) return null;
    return webhook;
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

    const maxAttempts = Math.ceil(IDEMPOTENCY_MAX_WAIT_MS / IDEMPOTENCY_POLL_INTERVAL_MS);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, IDEMPOTENCY_POLL_INTERVAL_MS));
      const entry = await this.cache.get<IdempotencyEntry<T>>(cacheKey);
      if (entry?.state === 'done') {
        return entry.payload;
      }
    }

    throw new ConflictException(
      'A request with this Idempotency-Key is already in progress. Retry shortly.'
    );
  }

  private ok<T>(data: T, meta?: Record<string, unknown>) {
    return {
      ok: true,
      data,
      ...(meta ? { meta } : {}),
    };
  }

  @Public()
  @Get('/health')
  @ApiOperation({
    summary: 'Public API health check',
    description: 'Lightweight endpoint for uptime and integration liveness checks.',
  })
  @ApiResponse({ status: 200, description: 'Public API is available.' })
  health() {
    return {
      ok: true,
      service: 'subsumio-public-api',
      version: 'v1',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('/workspaces/:workspaceId/documents')
  @ApiOperation({ summary: 'Create a new document from markdown content' })
  @ApiParam({ name: 'workspaceId' })
  async createDocument(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: CreateDocumentRequest
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.CreateDoc');
    const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader);

    const title = body.title?.trim() ?? '';
    const content = body.content ?? '';

    if (!title) {
      throw new BadRequestException('title is required');
    }
    if (typeof content !== 'string') {
      throw new BadRequestException('content must be a string');
    }

    const payload = await this.withIdempotency(
      user.id,
      workspaceId,
      'create-document',
      idempotencyKey,
      async () => {
        const result = await this.docWriter.createDoc(
          workspaceId,
          title,
          content,
          user.id
        );
        const doc = await this.models.doc.getDocInfo(workspaceId, result.docId);

        return {
          id: result.docId,
          workspaceId,
          title,
          createdAt: doc?.createdAt ?? new Date().toISOString(),
          updatedAt: doc?.updatedAt ?? new Date().toISOString(),
        };
      }
    );
    void this.dispatchWorkspaceWebhooks(workspaceId, 'document.created', {
      documentId: payload.id,
      title: payload.title,
      createdAt: payload.createdAt,
    });

    return this.ok(payload);
  }

  @Patch('/workspaces/:workspaceId/documents/:docId')
  @ApiOperation({ summary: 'Update document title and/or markdown content' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'docId' })
  async updateDocument(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: UpdateDocumentRequest
  ) {
    const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader);
    const doc = await this.models.doc.getDocInfo(workspaceId, docId);
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const hasTitle = body.title !== undefined;
    const hasContent = body.content !== undefined;
    if (!hasTitle && !hasContent) {
      throw new BadRequestException('At least one of title or content is required');
    }

    const payload = await this.withIdempotency(
      user.id,
      workspaceId,
      `update-document:${docId}`,
      idempotencyKey,
      async () => {
        if (hasContent) {
          await this.ac.user(user.id).doc(workspaceId, docId).assert('Doc.Update');
          if (typeof body.content !== 'string') {
            throw new BadRequestException('content must be a string');
          }
          await this.docWriter.updateDoc(workspaceId, docId, body.content, user.id);
        }

        if (hasTitle) {
          await this.ac
            .user(user.id)
            .doc(workspaceId, docId)
            .assert('Doc.Properties.Update');
          const title = body.title?.trim();
          if (!title) {
            throw new BadRequestException('title must be a non-empty string');
          }
          await this.docWriter.updateDocMeta(workspaceId, docId, { title }, user.id);
        }

        const updated = await this.models.doc.getDocInfo(workspaceId, docId);

        return {
          id: docId,
          workspaceId,
          title: updated?.title ?? null,
          updatedAt: updated?.updatedAt ?? new Date().toISOString(),
          success: true,
        };
      }
    );
    void this.dispatchWorkspaceWebhooks(workspaceId, 'document.updated', {
      documentId: payload.id,
      title: payload.title,
      updatedAt: payload.updatedAt,
    });

    return this.ok(payload);
  }

  @Delete('/workspaces/:workspaceId/documents/:docId')
  @ApiOperation({ summary: 'Delete a document and its history' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'docId' })
  async deleteDocument(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined
  ) {
    const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader);
    const doc = await this.models.doc.getDocInfo(workspaceId, docId);
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const payload = await this.withIdempotency(
      user.id,
      workspaceId,
      `delete-document:${docId}`,
      idempotencyKey,
      async () => {
        await this.ac.user(user.id).doc(workspaceId, docId).assert('Doc.Delete');
        await this.workspaceStorage.deleteDoc(workspaceId, docId);

        return {
          id: docId,
          workspaceId,
          deleted: true,
          deletedAt: new Date().toISOString(),
        };
      }
    );
    void this.dispatchWorkspaceWebhooks(workspaceId, 'document.deleted', {
      documentId: payload.id,
      deletedAt: payload.deletedAt,
    });

    return this.ok(payload);
  }

  @Get('/workspaces/:workspaceId/webhooks')
  @ApiOperation({ summary: 'List webhook subscriptions for a workspace' })
  @ApiParam({ name: 'workspaceId' })
  async listWebhooks(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Read');

    const webhooks = await this.listWorkspaceWebhooks(workspaceId);
    return this.ok(webhooks.map(webhook => this.toPublicWebhook(webhook)), {
      eventTypes: WEBHOOK_EVENT_TYPES,
      signatureHeader: 'X-Subsumio-Signature',
    });
  }

  @Get('/workspaces/:workspaceId/webhooks/:webhookId')
  @ApiOperation({ summary: 'Get a single webhook subscription' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'webhookId' })
  async getWebhook(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Read');

    const webhook = await this.getWorkspaceWebhook(workspaceId, webhookId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.ok(this.toPublicWebhook(webhook), {
      eventTypes: WEBHOOK_EVENT_TYPES,
      signatureHeader: 'X-Subsumio-Signature',
    });
  }

  @Post('/workspaces/:workspaceId/webhooks')
  @ApiOperation({ summary: 'Create webhook subscription for document events' })
  @ApiParam({ name: 'workspaceId' })
  async createWebhook(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: CreateWebhookRequest
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader);

    const url = normalizeWebhookUrl(body.url);
    const events = normalizeWebhookEvents(body.events);

    const payload = await this.withIdempotency(
      user.id,
      workspaceId,
      'create-webhook',
      idempotencyKey,
      async () => {
        const id = randomBytes(8).toString('hex');
        const secret = randomBytes(24).toString('hex');
        const now = new Date().toISOString();
        const webhook: PublicApiWebhook = {
          id,
          workspaceId,
          url,
          events,
          enabled: true,
          secret,
          createdAt: now,
          updatedAt: now,
        };

        await this.models.appConfig.save(user.id, [
          {
            key: this.webhookConfigKey(workspaceId, id),
            value: webhook,
          },
        ]);

        return {
          ...this.toPublicWebhook(webhook),
          signingSecret: secret,
        };
      }
    );
    return this.ok(payload);
  }

  @Patch('/workspaces/:workspaceId/webhooks/:webhookId')
  @ApiOperation({ summary: 'Update webhook endpoint, events, and secret rotation' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'webhookId' })
  async updateWebhook(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: UpdateWebhookRequest
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader);

    const webhook = await this.getWorkspaceWebhook(workspaceId, webhookId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const payload = await this.withIdempotency(
      user.id,
      workspaceId,
      `update-webhook:${webhookId}`,
      idempotencyKey,
      async () => {
        const nextUrl = body.url
          ? normalizeWebhookUrl(body.url)
          : webhook.url;

        const nextEvents = body.events ? normalizeWebhookEvents(body.events) : webhook.events;
        const nextWebhook: PublicApiWebhook = {
          ...webhook,
          url: nextUrl,
          events: nextEvents,
          enabled: body.enabled ?? webhook.enabled,
          secret: body.rotateSecret ? randomBytes(24).toString('hex') : webhook.secret,
          updatedAt: new Date().toISOString(),
        };

        await this.models.appConfig.save(user.id, [
          {
            key: this.webhookConfigKey(workspaceId, webhookId),
            value: nextWebhook,
          },
        ]);

        return {
          ...this.toPublicWebhook(nextWebhook),
          ...(body.rotateSecret
            ? {
                signingSecret: nextWebhook.secret,
              }
            : {}),
        };
      }
    );
    return this.ok(payload);
  }

  @Delete('/workspaces/:workspaceId/webhooks/:webhookId')
  @ApiOperation({ summary: 'Delete (disable) webhook subscription' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'webhookId' })
  async deleteWebhook(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader);

    const webhook = await this.getWorkspaceWebhook(workspaceId, webhookId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const payload = await this.withIdempotency(
      user.id,
      workspaceId,
      `delete-webhook:${webhookId}`,
      idempotencyKey,
      async () => {
        const deletedWebhook: PublicApiWebhook = {
          ...webhook,
          enabled: false,
          updatedAt: new Date().toISOString(),
          deletedAt: new Date().toISOString(),
        };
        await this.models.appConfig.save(user.id, [
          {
            key: this.webhookConfigKey(workspaceId, webhookId),
            value: deletedWebhook,
          },
        ]);

        return {
          id: webhookId,
          workspaceId,
          deleted: true,
          deletedAt: deletedWebhook.deletedAt,
        };
      }
    );
    return this.ok(payload);
  }

  @Public()
  @Get('/meta')
  @ApiOperation({
    summary: 'Public API capabilities and integration metadata',
    description:
      'Provides discovery metadata for integrators: auth mode, docs endpoints, and currently available resources.',
  })
  @ApiResponse({ status: 200, description: 'Public API metadata.' })
  meta() {
    return {
      ok: true,
      version: 'v1',
      basePath: PUBLIC_API_BASE_PATH,
      auth: {
        type: 'bearer',
        header: 'Authorization: Bearer <access_token>',
      },
      docs: {
        swagger: '/api/docs',
        graphql: '/graphql',
      },
      resources: [
        {
          name: 'health',
          path: `${PUBLIC_API_BASE_PATH}/health`,
          public: true,
        },
        {
          name: 'workspaces',
          path: `${PUBLIC_API_BASE_PATH}/workspaces`,
          public: false,
        },
        {
          name: 'workspace',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId`,
          public: false,
        },
        {
          name: 'workspace-stats',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/stats`,
          public: false,
        },
        {
          name: 'documents',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/documents`,
          public: false,
        },
        {
          name: 'document-create',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/documents [POST]`,
          public: false,
        },
        {
          name: 'document-content',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/documents/:docId/content`,
          public: false,
        },
        {
          name: 'document',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/documents/:docId`,
          public: false,
        },
        {
          name: 'document-update',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/documents/:docId [PATCH]`,
          public: false,
        },
        {
          name: 'document-delete',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/documents/:docId [DELETE]`,
          public: false,
        },
        {
          name: 'workspace-search',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/search?query=...`,
          public: false,
        },
        {
          name: 'blob-download-url',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/blobs/:blobKey`,
          public: false,
        },
        {
          name: 'webhooks',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/webhooks`,
          public: false,
        },
        {
          name: 'webhook',
          path: `${PUBLIC_API_BASE_PATH}/workspaces/:workspaceId/webhooks/:webhookId`,
          public: false,
        },
      ],
      advanced: {
        idempotencyHeader: 'Idempotency-Key',
        webhookEvents: WEBHOOK_EVENT_TYPES,
        webhookSignatureHeader: 'X-Subsumio-Signature',
        webhookRetryScheduleMs: [0, 1500, 5000],
        webhookMaxAttempts: 4,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/workspaces')
  @ApiOperation({
    summary: 'List workspaces accessible by the API token user',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 25 })
  async listWorkspaces(
    @CurrentUser() user: CurrentUserType,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const pagination = normalizePagination(page, pageSize);
    const roles = await this.models.workspaceUser.getUserActiveRoles(user.id);
    const workspaceIds = [...new Set(roles.map(role => role.workspaceId))];

    const workspaces = workspaceIds.length
      ? await this.models.workspace.findMany(workspaceIds)
      : [];

    const roleMap = new Map(roles.map(role => [role.workspaceId, role.type]));
    const sorted = [...workspaces].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const pageItems = sorted
      .slice(pagination.offset, pagination.offset + pagination.pageSize)
      .map(workspace => ({
        id: workspace.id,
        name: workspace.name,
        public: workspace.public,
        createdAt: workspace.createdAt,
        role: roleMap.get(workspace.id) ?? null,
      }));

    return {
      data: pageItems,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: sorted.length,
        totalPages: getTotalPages(sorted.length, pagination.pageSize),
      },
    };
  }

  @Get('/workspaces/:workspaceId')
  @ApiOperation({ summary: 'Get single workspace metadata' })
  @ApiParam({ name: 'workspaceId' })
  async getWorkspace(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const workspace = await this.models.workspace.get(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const role = await this.models.workspaceUser.getActive(workspaceId, user.id);
    return {
      id: workspace.id,
      name: workspace.name,
      public: workspace.public,
      createdAt: workspace.createdAt,
      role: role?.type ?? null,
    };
  }

  @Get('/workspaces/:workspaceId/documents')
  @ApiOperation({ summary: 'List workspace documents' })
  @ApiParam({ name: 'workspaceId' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 25 })
  async listDocuments(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const pagination = normalizePagination(page, pageSize);
    const [total, docs] = await this.models.doc.paginateDocInfoByUpdatedAt(
      workspaceId,
      {
        first: pagination.pageSize,
        offset: pagination.offset,
      }
    );

    return {
      data: docs.map(doc => ({
        id: doc.docId,
        title: doc.title,
        public: doc.public,
        mode: doc.mode,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: getTotalPages(total, pagination.pageSize),
      },
    };
  }

  @Get('/workspaces/:workspaceId/stats')
  @ApiOperation({ summary: 'Get workspace-level usage counters' })
  @ApiParam({ name: 'workspaceId' })
  async getWorkspaceStats(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const [memberCount, [documentCount]] = await Promise.all([
      this.models.workspaceUser.count(workspaceId),
      this.models.doc.paginateDocInfoByUpdatedAt(workspaceId, {
        first: 1,
        offset: 0,
      }),
    ]);

    return {
      workspaceId,
      counters: {
        members: memberCount,
        documents: documentCount,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  @Get('/workspaces/:workspaceId/documents/:docId')
  @ApiOperation({ summary: 'Get single document metadata' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'docId' })
  async getDocument(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string
  ) {
    await this.ac.user(user.id).doc(workspaceId, docId).assert('Doc.Read');

    const doc = await this.models.doc.getDocInfo(workspaceId, docId);
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    return {
      id: doc.docId,
      workspaceId: doc.workspaceId,
      title: doc.title,
      summary: doc.summary,
      public: doc.public,
      mode: doc.mode,
      defaultRole: doc.defaultRole,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      creatorId: doc.creatorId ?? null,
      lastUpdaterId: doc.lastUpdaterId ?? null,
    };
  }

  @Get('/workspaces/:workspaceId/documents/:docId/content')
  @ApiOperation({
    summary: 'Export document content as markdown',
  })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'docId' })
  async getDocumentContent(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string
  ) {
    await this.ac.user(user.id).doc(workspaceId, docId).assert('Doc.Read');

    const markdown = await this.docReader.getDocMarkdown(workspaceId, docId, false);
    if (!markdown) {
      throw new NotFoundException('Document content not found');
    }

    return {
      id: docId,
      workspaceId,
      title: markdown.title ?? null,
      format: 'markdown',
      content: markdown.markdown,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get('/workspaces/:workspaceId/search')
  @ApiOperation({ summary: 'Search documents in a workspace by keyword' })
  @ApiParam({ name: 'workspaceId' })
  @ApiQuery({ name: 'query', required: true, example: 'deadline extension' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async searchWorkspaceDocuments(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Query('query') query: string | undefined,
    @Query('limit') limit?: string
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const keyword = query?.trim();
    if (!keyword) {
      throw new BadRequestException('query is required');
    }

    const searchLimit = Math.min(
      parsePositiveInt(limit, DEFAULT_SEARCH_LIMIT),
      MAX_SEARCH_LIMIT
    );

    const docs = await this.indexer.searchDocsByKeyword(workspaceId, keyword, {
      limit: searchLimit,
    });
    const readableDocs = await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .docs(docs, 'Doc.Read');

    return {
      query: keyword,
      data: readableDocs.map(doc => ({
        id: doc.docId,
        blockId: doc.blockId,
        title: doc.title,
        highlight: doc.highlight,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      pagination: {
        limit: searchLimit,
        total: readableDocs.length,
      },
    };
  }

  @Get('/workspaces/:workspaceId/blobs/:blobKey')
  @ApiOperation({
    summary: 'Get stable blob download URL for workspace attachments',
  })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'blobKey' })
  async getBlobDownloadUrl(
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Param('blobKey') blobKey: string
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const blob = await this.models.blob.get(workspaceId, blobKey);
    if (!blob || blob.deletedAt || blob.status !== 'completed') {
      throw new NotFoundException('Blob not found');
    }

    return {
      workspaceId,
      blobKey,
      contentType: blob.mime,
      size: blob.size,
      download: {
        url: `/api/workspaces/${workspaceId}/blobs/${blobKey}?redirect=manual`,
        method: 'GET',
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
