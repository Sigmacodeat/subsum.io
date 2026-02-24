import {
  BadRequestException,
  Body,
  BeforeApplicationShutdown,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  BehaviorSubject,
  catchError,
  connect,
  filter,
  finalize,
  from,
  ignoreElements,
  interval,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  Observable,
  reduce,
  Subject,
  take,
  takeUntil,
  tap,
} from 'rxjs';

import {
  applyAttachHeaders,
  BlobNotFound,
  CallMetric,
  Config,
  CopilotFailedToGenerateText,
  CopilotSessionNotFound,
  InternalServerError,
  mapAnyError,
  mapSseError,
  metrics,
  NoCopilotProviderAvailable,
  Throttle,
  UnsplashIsNotConfigured,
} from '../../base';
import { ServerFeature, ServerService } from '../../core';
import { CurrentUser, Public } from '../../core/auth';
import { CopilotContextService } from './context/service';
import { CopilotProviderFactory } from './providers/factory';
import type { CopilotProvider } from './providers/provider';
import {
  ModelInputType,
  ModelOutputType,
  type StreamObject,
} from './providers/types';
import { StreamObjectParser } from './providers/utils';
import { ChatSession, ChatSessionService } from './session';
import { CopilotStorage } from './storage';
import { ChatMessage, ChatQuerySchema } from './types';
import { getSignal, getTools } from './utils';
import { CopilotWorkflowService, GraphExecutorState } from './workflow';

export interface ChatEvent {
  type: 'event' | 'attachment' | 'message' | 'error' | 'ping';
  id?: string;
  data: string | object;
}

type TenantLlmRole = 'system' | 'user' | 'assistant';

type TenantLlmMessage = {
  role: TenantLlmRole;
  content: string;
};

type TenantLlmModelCostTier = 'low' | 'medium' | 'high' | 'premium';

type TenantLlmThinkingLevel = 'low' | 'medium' | 'high';

type TenantLlmModel = {
  id: string;
  providerId: string;
  label: string;
  description: string;
  contextWindow: number;
  supportsStreaming: boolean;
  costTier: TenantLlmModelCostTier;
  icon: string;
  creditMultiplier: number;
  thinkingLevel: TenantLlmThinkingLevel;
};

type TenantLlmChatRequest = {
  model?: string;
  systemPrompt?: string;
  messages?: TenantLlmMessage[];
  temperature?: number;
  maxTokens?: number;
};

const PING_INTERVAL = 5000;

@Controller('/api/copilot')
export class CopilotController implements BeforeApplicationShutdown {
  private readonly logger = new Logger(CopilotController.name);
  private readonly ongoingStreamCount$ = new BehaviorSubject(0);

  constructor(
    private readonly config: Config,
    private readonly server: ServerService,
    private readonly chatSession: ChatSessionService,
    private readonly context: CopilotContextService,
    private readonly provider: CopilotProviderFactory,
    private readonly workflow: CopilotWorkflowService,
    private readonly storage: CopilotStorage
  ) {}

  async beforeApplicationShutdown() {
    await lastValueFrom(
      this.ongoingStreamCount$.asObservable().pipe(
        filter(count => count === 0),
        take(1)
      )
    );
    this.ongoingStreamCount$.complete();
  }

  private inferDefaultModelId(provider: CopilotProvider): string | null {
    const defaultModel = provider.models.find(model =>
      model.capabilities.some(
        capability =>
          capability.output.includes(ModelOutputType.Text) &&
          capability.defaultForOutputType
      )
    );
    if (defaultModel) {
      return defaultModel.id;
    }

    const fallbackModel = provider.models.find(model =>
      model.capabilities.some(capability => capability.output.includes(ModelOutputType.Text))
    );
    return fallbackModel?.id ?? null;
  }

  private inferCostTier(modelId: string): TenantLlmModelCostTier {
    const id = modelId.toLowerCase();
    if (
      id.includes('nano') ||
      id.includes('mini') ||
      id.includes('haiku') ||
      id.includes('flash')
    ) {
      return 'low';
    }
    if (
      id.includes('opus') ||
      id.includes('ultra') ||
      id.includes('o1') ||
      id.includes('gpt-5') ||
      id.includes('grok-4') ||
      id.includes('reasoning-high')
    ) {
      return 'premium';
    }
    if (
      id.includes('sonnet') ||
      id.includes('large') ||
      id.includes('pro') ||
      id.includes('gpt-4o') ||
      id.includes('o3') ||
      id.includes('grok') ||
      id.includes('r1')
    ) {
      return 'high';
    }
    return 'medium';
  }

  private inferCreditMultiplier(costTier: TenantLlmModelCostTier): number {
    switch (costTier) {
      case 'low':
        return 0.5;
      case 'medium':
        return 1;
      case 'high':
        return 1.5;
      case 'premium':
        return 2.5;
      default:
        return 1;
    }
  }

  private inferProviderIdFromModelId(modelId: string, fallbackProviderId: string): string {
    const normalized = modelId.toLowerCase();
    if (normalized.includes('/')) {
      const [prefix] = normalized.split('/');
      if (prefix) {
        return prefix;
      }
    }
    return fallbackProviderId;
  }

  private inferLabelFromModelId(modelId: string): string {
    const parts = modelId.split('/');
    return parts[parts.length - 1] || modelId;
  }

  private inferThinkingLevel(modelId: string): TenantLlmThinkingLevel {
    const id = modelId.toLowerCase();
    if (id.includes('o1') || id.includes('reasoning-high') || id.includes('thinking-high')) {
      return 'high';
    }
    if (id.includes('o3') || id.includes('reasoning') || id.includes('thinking')) {
      return 'medium';
    }
    return 'low';
  }

  private inferContextWindow(modelId: string): number {
    const id = modelId.toLowerCase();
    if (id.includes('gemini')) {
      return 1_000_000;
    }
    if (id.includes('claude')) {
      return 200_000;
    }
    if (id.includes('gpt-4') || id.includes('gpt-5') || id.includes('o1') || id.includes('o3')) {
      return 128_000;
    }
    return 64_000;
  }

  private inferProviderIcon(providerId: string): string {
    switch (providerId) {
      case 'openai':
        return '🟢';
      case 'anthropic':
      case 'anthropicVertex':
        return '🟣';
      case 'gemini':
      case 'geminiVertex':
        return '🔴';
      case 'perplexity':
        return '🟠';
      case 'morph':
        return '⚙️';
      case 'fal':
        return '🟡';
      case 'x-ai':
      case 'xai':
        return '⚫';
      default:
        return '🔵';
    }
  }

  private toTenantModel(
    modelId: string,
    providerId: string,
    label?: string
  ): TenantLlmModel {
    const resolvedProviderId = this.inferProviderIdFromModelId(modelId, providerId);
    const costTier = this.inferCostTier(modelId);
    return {
      id: modelId,
      providerId: resolvedProviderId,
      label: label ?? this.inferLabelFromModelId(modelId),
      description: `${label ?? this.inferLabelFromModelId(modelId)} via Tenant Shared API`,
      contextWindow: this.inferContextWindow(modelId),
      supportsStreaming: true,
      costTier,
      icon: this.inferProviderIcon(resolvedProviderId),
      creditMultiplier: this.inferCreditMultiplier(costTier),
      thinkingLevel: this.inferThinkingLevel(modelId),
    };
  }

  private async chooseProvider(
    outputType: ModelOutputType,
    userId: string,
    sessionId: string,
    messageId?: string,
    modelId?: string
  ): Promise<{
    provider: CopilotProvider;
    model: string;
    hasAttachment: boolean;
  }> {
    const [, session] = await Promise.all([
      this.chatSession.checkQuota(userId),
      this.chatSession.get(sessionId),
    ]);

    if (!session || session.config.userId !== userId) {
      throw new CopilotSessionNotFound();
    }

    const model = await session.resolveModel(
      this.server.features.includes(ServerFeature.Payment),
      modelId
    );

    const hasAttachment = messageId
      ? !!(await session.getMessageById(messageId)).attachments?.length
      : false;

    const provider = await this.provider.getProvider({
      outputType,
      modelId: model,
    });
    if (!provider) {
      throw new NoCopilotProviderAvailable({ modelId: model });
    }

    return { provider, model, hasAttachment };
  }

  private async appendSessionMessage(
    sessionId: string,
    messageId?: string,
    retry = false
  ): Promise<[ChatMessage | undefined, ChatSession]> {
    const session = await this.chatSession.get(sessionId);
    if (!session) {
      throw new CopilotSessionNotFound();
    }

    let latestMessage = undefined;
    if (!messageId || retry) {
      // revert the latest message generated by the assistant
      // if messageId is provided, we will also revert latest user message
      await this.chatSession.revertLatestMessage(sessionId, !!messageId);
      session.revertLatestMessage(!!messageId);
      if (!messageId) {
        latestMessage = session.latestUserMessage;
      }
    }

    if (messageId) {
      await session.pushByMessageId(messageId);
    }

    return [latestMessage, session];
  }

  private parseNumber(value: string | string[] | undefined) {
    if (!value) {
      return undefined;
    }
    const num = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
    if (Number.isNaN(num)) {
      return undefined;
    }
    return num;
  }

  private mergePingStream(
    messageId: string,
    source$: Observable<ChatEvent>
  ): Observable<ChatEvent> {
    const subject$ = new Subject();
    const ping$ = interval(PING_INTERVAL).pipe(
      map(() => ({ type: 'ping' as const, id: messageId, data: '' })),
      takeUntil(subject$)
    );

    return merge(source$.pipe(finalize(() => subject$.next(null))), ping$);
  }

  private async prepareChatSession(
    user: CurrentUser,
    sessionId: string,
    query: Record<string, string | string[]>,
    outputType: ModelOutputType
  ) {
    let { messageId, retry, modelId, params } = ChatQuerySchema.parse(query);

    const { provider, model } = await this.chooseProvider(
      outputType,
      user.id,
      sessionId,
      messageId,
      modelId
    );

    const [latestMessage, session] = await this.appendSessionMessage(
      sessionId,
      messageId,
      retry
    );

    const context = await this.context.getBySessionId(sessionId);
    const contextParams =
      (Array.isArray(context?.files) && context.files.length > 0) ||
      (Array.isArray(context?.blobs) && context.blobs.length > 0)
        ? {
            contextFiles: [
              ...context.files,
              ...(await context.getBlobMetadata()),
            ],
          }
        : {};
    const lastParams = latestMessage
      ? {
          ...latestMessage.params,
          content: latestMessage.content,
          attachments: latestMessage.attachments,
        }
      : {};

    const finalMessage = session.finish({
      ...params,
      ...lastParams,
      ...contextParams,
    });

    return {
      provider,
      model,
      session,
      finalMessage,
    };
  }

  @Get('/tenant-llm/models')
  @CallMetric('ai', 'tenant_llm_models')
  async tenantModels(@CurrentUser() user: CurrentUser): Promise<TenantLlmModel[]> {
    await this.chatSession.checkQuota(user.id);

    const configuredProviders = this.provider.listConfiguredProviders();
    const models = new Map<string, TenantLlmModel>();

    await Promise.all(
      configuredProviders.map(async ({ provider }) => {
        try {
          await provider.refreshOnlineModels();
        } catch {
          // best-effort only
        }
      })
    );

    for (const { type, provider } of configuredProviders) {
      for (const model of provider.models) {
        const supportsText = model.capabilities.some(capability =>
          capability.output.includes(ModelOutputType.Text)
        );
        if (!supportsText) {
          continue;
        }
        if (!models.has(model.id)) {
          models.set(model.id, this.toTenantModel(model.id, type, model.name));
        }
      }

      for (const modelId of provider.getOnlineModelIds()) {
        if (!modelId || models.has(modelId)) {
          continue;
        }
        models.set(modelId, this.toTenantModel(modelId, type));
      }
    }

    return Array.from(models.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  @Post('/tenant-llm/chat')
  @CallMetric('ai', 'tenant_llm_chat')
  async tenantChat(
    @CurrentUser() user: CurrentUser,
    @Body() body: TenantLlmChatRequest
  ): Promise<{ answer: string; model: string }> {
    await this.chatSession.checkQuota(user.id);

    const messages = (Array.isArray(body.messages) ? body.messages : []).filter(
      message =>
        message &&
        typeof message.role === 'string' &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0
    );

    const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
    if (!systemPrompt && messages.length === 0) {
      throw new BadRequestException('At least one message or system prompt is required');
    }

    const requestedModel =
      typeof body.model === 'string' && body.model.trim().length > 0
        ? body.model.trim()
        : undefined;

    const provider = await this.provider.getProvider({
      outputType: ModelOutputType.Text,
      modelId: requestedModel,
    });
    if (!provider) {
      throw new NoCopilotProviderAvailable({ modelId: requestedModel ?? 'auto' });
    }

    const resolvedModel = requestedModel ?? this.inferDefaultModelId(provider);
    if (!resolvedModel) {
      throw new NoCopilotProviderAvailable({ modelId: requestedModel ?? 'auto' });
    }

    const promptMessages = [
      ...(systemPrompt ? ([{ role: 'system', content: systemPrompt }] as const) : []),
      ...messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const answer = await provider.text(
      { modelId: resolvedModel },
      promptMessages,
      {
        temperature:
          typeof body.temperature === 'number'
            ? Math.min(1, Math.max(0, body.temperature))
            : 0.3,
        maxTokens:
          typeof body.maxTokens === 'number'
            ? Math.min(8_192, Math.max(256, Math.round(body.maxTokens)))
            : 4_000,
        user: user.id,
      }
    );

    return { answer, model: resolvedModel };
  }

  @Get('/chat/:sessionId')
  @CallMetric('ai', 'chat', { timer: true })
  async chat(
    @CurrentUser() user: CurrentUser,
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Query() query: Record<string, string | string[]>
  ): Promise<string> {
    const info: any = { sessionId, params: query };

    try {
      const { provider, model, session, finalMessage } =
        await this.prepareChatSession(
          user,
          sessionId,
          query,
          ModelOutputType.Text
        );

      info.model = model;
      info.finalMessage = finalMessage.filter(m => m.role !== 'system');
      metrics.ai.counter('chat_calls').add(1, { model });

      const { reasoning, webSearch, toolsConfig } =
        ChatQuerySchema.parse(query);
      const content = await provider.text({ modelId: model }, finalMessage, {
        ...session.config.promptConfig,
        signal: getSignal(req).signal,
        user: user.id,
        session: session.config.sessionId,
        workspace: session.config.workspaceId,
        reasoning,
        webSearch,
        tools: getTools(session.config.promptConfig?.tools, toolsConfig),
      });

      session.push({
        role: 'assistant',
        content,
        createdAt: new Date(),
      });
      await session.save();

      return content;
    } catch (e: any) {
      metrics.ai.counter('chat_errors').add(1);
      let error = mapAnyError(e);
      if (error instanceof InternalServerError) {
        error = new CopilotFailedToGenerateText(e.message);
      }
      error.log('CopilotChat', info);
      throw error;
    }
  }

  @Sse('/chat/:sessionId/stream')
  @CallMetric('ai', 'chat_stream', { timer: true })
  async chatStream(
    @CurrentUser() user: CurrentUser,
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Query() query: Record<string, string>
  ): Promise<Observable<ChatEvent>> {
    const info: any = { sessionId, params: query, throwInStream: false };

    try {
      const { provider, model, session, finalMessage } =
        await this.prepareChatSession(
          user,
          sessionId,
          query,
          ModelOutputType.Text
        );

      info.model = model;
      info.finalMessage = finalMessage.filter(m => m.role !== 'system');
      metrics.ai.counter('chat_stream_calls').add(1, { model });
      this.ongoingStreamCount$.next(this.ongoingStreamCount$.value + 1);

      const { signal, onConnectionClosed } = getSignal(req);
      let endBeforePromiseResolve = false;
      onConnectionClosed(isAborted => {
        if (isAborted) {
          endBeforePromiseResolve = true;
        }
      });

      const { messageId, reasoning, webSearch, toolsConfig } =
        ChatQuerySchema.parse(query);

      const source$ = from(
        provider.streamText({ modelId: model }, finalMessage, {
          ...session.config.promptConfig,
          signal,
          user: user.id,
          session: session.config.sessionId,
          workspace: session.config.workspaceId,
          reasoning,
          webSearch,
          tools: getTools(session.config.promptConfig?.tools, toolsConfig),
        })
      ).pipe(
        connect(shared$ =>
          merge(
            // actual chat event stream
            shared$.pipe(
              map(data => ({ type: 'message' as const, id: messageId, data }))
            ),
            // save the generated text to the session
            shared$.pipe(
              reduce((acc, chunk) => acc + chunk, ''),
              tap(buffer => {
                session.push({
                  role: 'assistant',
                  content: endBeforePromiseResolve
                    ? '> Request aborted'
                    : buffer,
                  createdAt: new Date(),
                });
                void session
                  .save()
                  .catch(err =>
                    this.logger.error(
                      'Failed to save session in sse stream',
                      err
                    )
                  );
              }),
              ignoreElements()
            )
          )
        ),
        catchError(e => {
          metrics.ai.counter('chat_stream_errors').add(1);
          info.throwInStream = true;
          return mapSseError(e, info);
        }),
        finalize(() => {
          this.ongoingStreamCount$.next(this.ongoingStreamCount$.value - 1);
        })
      );

      return this.mergePingStream(messageId || '', source$);
    } catch (err) {
      metrics.ai.counter('chat_stream_errors').add(1, info);
      return mapSseError(err, info);
    }
  }

  @Sse('/chat/:sessionId/stream-object')
  @CallMetric('ai', 'chat_object_stream', { timer: true })
  async chatStreamObject(
    @CurrentUser() user: CurrentUser,
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Query() query: Record<string, string>
  ): Promise<Observable<ChatEvent>> {
    const info: any = { sessionId, params: query, throwInStream: false };

    try {
      const { provider, model, session, finalMessage } =
        await this.prepareChatSession(
          user,
          sessionId,
          query,
          ModelOutputType.Object
        );

      info.model = model;
      info.finalMessage = finalMessage.filter(m => m.role !== 'system');
      metrics.ai.counter('chat_object_stream_calls').add(1, { model });
      this.ongoingStreamCount$.next(this.ongoingStreamCount$.value + 1);

      const { signal, onConnectionClosed } = getSignal(req);
      let endBeforePromiseResolve = false;
      onConnectionClosed(isAborted => {
        if (isAborted) {
          endBeforePromiseResolve = true;
        }
      });

      const { messageId, reasoning, webSearch, toolsConfig } =
        ChatQuerySchema.parse(query);

      const source$ = from(
        provider.streamObject({ modelId: model }, finalMessage, {
          ...session.config.promptConfig,
          signal,
          user: user.id,
          session: session.config.sessionId,
          workspace: session.config.workspaceId,
          reasoning,
          webSearch,
          tools: getTools(session.config.promptConfig?.tools, toolsConfig),
        })
      ).pipe(
        connect(shared$ =>
          merge(
            // actual chat event stream
            shared$.pipe(
              map(data => ({ type: 'message' as const, id: messageId, data }))
            ),
            // save the generated text to the session
            shared$.pipe(
              reduce((acc, chunk) => acc.concat([chunk]), [] as StreamObject[]),
              tap(result => {
                const parser = new StreamObjectParser();
                const streamObjects = parser.mergeTextDelta(result);
                const content = parser.mergeContent(streamObjects);
                session.push({
                  role: 'assistant',
                  content: endBeforePromiseResolve
                    ? '> Request aborted'
                    : content,
                  streamObjects: endBeforePromiseResolve ? null : streamObjects,
                  createdAt: new Date(),
                });
                void session
                  .save()
                  .catch(err =>
                    this.logger.error(
                      'Failed to save session in sse stream',
                      err
                    )
                  );
              }),
              ignoreElements()
            )
          )
        ),
        catchError(e => {
          metrics.ai.counter('chat_object_stream_errors').add(1);
          info.throwInStream = true;
          return mapSseError(e, info);
        }),
        finalize(() => {
          this.ongoingStreamCount$.next(this.ongoingStreamCount$.value - 1);
        })
      );

      return this.mergePingStream(messageId || '', source$);
    } catch (err) {
      metrics.ai.counter('chat_object_stream_errors').add(1, info);
      return mapSseError(err, info);
    }
  }

  @Sse('/chat/:sessionId/workflow')
  @CallMetric('ai', 'chat_workflow', { timer: true })
  async chatWorkflow(
    @CurrentUser() user: CurrentUser,
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Query() query: Record<string, string>
  ): Promise<Observable<ChatEvent>> {
    const info: any = { sessionId, params: query, throwInStream: false };
    try {
      let { messageId, params } = ChatQuerySchema.parse(query);

      const [, session] = await this.appendSessionMessage(sessionId, messageId);
      info.model = session.model;

      metrics.ai.counter('workflow_calls').add(1, { model: session.model });

      const latestMessage = session.stashMessages.findLast(
        m => m.role === 'user'
      );
      if (latestMessage) {
        params = Object.assign({}, params, latestMessage.params, {
          content: latestMessage.content,
          attachments: latestMessage.attachments,
        });
      }
      this.ongoingStreamCount$.next(this.ongoingStreamCount$.value + 1);

      const { signal, onConnectionClosed } = getSignal(req);
      let endBeforePromiseResolve = false;
      onConnectionClosed(isAborted => {
        if (isAborted) {
          endBeforePromiseResolve = true;
        }
      });

      const source$ = from(
        this.workflow.runGraph(params, session.model, {
          ...session.config.promptConfig,
          signal,
          user: user.id,
          session: session.config.sessionId,
          workspace: session.config.workspaceId,
        })
      ).pipe(
        connect(shared$ =>
          merge(
            // actual chat event stream
            shared$.pipe(
              map(data => {
                switch (data.status) {
                  case GraphExecutorState.EmitContent:
                    return {
                      type: 'message' as const,
                      id: messageId,
                      data: data.content,
                    };
                  case GraphExecutorState.EmitAttachment:
                    return {
                      type: 'attachment' as const,
                      id: messageId,
                      data: data.attachment,
                    };
                  default:
                    return {
                      type: 'event' as const,
                      id: messageId,
                      data: {
                        status: data.status,
                        id: data.node.id,
                        type: data.node.config.nodeType,
                      },
                    };
                }
              })
            ),
            // save the generated text to the session
            shared$.pipe(
              reduce((acc, chunk) => {
                if (chunk.status === GraphExecutorState.EmitContent) {
                  acc += chunk.content;
                }
                return acc;
              }, ''),
              tap(content => {
                session.push({
                  role: 'assistant',
                  content: endBeforePromiseResolve
                    ? '> Request aborted'
                    : content,
                  createdAt: new Date(),
                });
                void session
                  .save()
                  .catch(err =>
                    this.logger.error(
                      'Failed to save session in sse stream',
                      err
                    )
                  );
              }),
              ignoreElements()
            )
          )
        ),
        catchError(e => {
          metrics.ai.counter('workflow_errors').add(1, info);
          info.throwInStream = true;
          return mapSseError(e, info);
        }),
        finalize(() =>
          this.ongoingStreamCount$.next(this.ongoingStreamCount$.value - 1)
        )
      );

      return this.mergePingStream(messageId || '', source$);
    } catch (err) {
      metrics.ai.counter('workflow_errors').add(1, info);
      return mapSseError(err, info);
    }
  }

  @Sse('/chat/:sessionId/images')
  @CallMetric('ai', 'chat_images', { timer: true })
  async chatImagesStream(
    @CurrentUser() user: CurrentUser,
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Query() query: Record<string, string>
  ): Promise<Observable<ChatEvent>> {
    const info: any = { sessionId, params: query, throwInStream: false };
    try {
      let { messageId, params } = ChatQuerySchema.parse(query);

      const { provider, model, hasAttachment } = await this.chooseProvider(
        ModelOutputType.Image,
        user.id,
        sessionId,
        messageId
      );

      const [latestMessage, session] = await this.appendSessionMessage(
        sessionId,
        messageId
      );
      info.model = model;
      metrics.ai.counter('images_stream_calls').add(1, { model });

      if (latestMessage) {
        params = Object.assign({}, params, latestMessage.params, {
          content: latestMessage.content,
          attachments: latestMessage.attachments,
        });
      }

      const handleRemoteLink = this.storage.handleRemoteLink.bind(
        this.storage,
        user.id,
        sessionId
      );
      this.ongoingStreamCount$.next(this.ongoingStreamCount$.value + 1);

      const { signal, onConnectionClosed } = getSignal(req);
      let endBeforePromiseResolve = false;
      onConnectionClosed(isAborted => {
        if (isAborted) {
          endBeforePromiseResolve = true;
        }
      });

      const source$ = from(
        provider.streamImages(
          {
            modelId: model,
            inputTypes: hasAttachment
              ? [ModelInputType.Image]
              : [ModelInputType.Text],
          },
          session.finish(params),
          {
            ...session.config.promptConfig,
            quality: params.quality || undefined,
            seed: this.parseNumber(params.seed),
            signal,
            user: user.id,
            session: session.config.sessionId,
            workspace: session.config.workspaceId,
          }
        )
      ).pipe(
        mergeMap(handleRemoteLink),
        connect(shared$ =>
          merge(
            // actual chat event stream
            shared$.pipe(
              map(attachment => ({
                type: 'attachment' as const,
                id: messageId,
                data: attachment,
              }))
            ),
            // save the generated text to the session
            shared$.pipe(
              reduce((acc, chunk) => acc.concat([chunk]), [] as string[]),
              tap(attachments => {
                session.push({
                  role: 'assistant',
                  content: endBeforePromiseResolve ? '> Request aborted' : '',
                  attachments: endBeforePromiseResolve ? [] : attachments,
                  createdAt: new Date(),
                });
                void session
                  .save()
                  .catch(err =>
                    this.logger.error(
                      'Failed to save session in sse stream',
                      err
                    )
                  );
              }),
              ignoreElements()
            )
          )
        ),
        catchError(e => {
          metrics.ai.counter('images_stream_errors').add(1, info);
          info.throwInStream = true;
          return mapSseError(e, info);
        }),
        finalize(() =>
          this.ongoingStreamCount$.next(this.ongoingStreamCount$.value - 1)
        )
      );

      return this.mergePingStream(messageId || '', source$);
    } catch (err) {
      metrics.ai.counter('images_stream_errors').add(1, info);
      return mapSseError(err, info);
    }
  }

  @Get('/unsplash/photos')
  @CallMetric('ai', 'unsplash')
  async unsplashPhotos(
    @Req() req: Request,
    @Res() res: Response,
    @Query() params: Record<string, string>
  ) {
    const { key } = this.config.copilot.unsplash;
    if (!key) {
      throw new UnsplashIsNotConfigured();
    }

    const query = new URLSearchParams(params);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?${query}`,
      {
        headers: { Authorization: `Client-ID ${key}` },
        signal: getSignal(req).signal,
      }
    );

    res.set({
      'Content-Type': response.headers.get('Content-Type'),
      'Content-Length': response.headers.get('Content-Length'),
      'X-Ratelimit-Limit': response.headers.get('X-Ratelimit-Limit'),
      'X-Ratelimit-Remaining': response.headers.get('X-Ratelimit-Remaining'),
    });

    res.status(response.status).send(await response.json());
  }

  @Public()
  @Throttle('default')
  @Get('/blob/:userId/:workspaceId/:key')
  async getBlob(
    @Res() res: Response,
    @Param('userId') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('key') key: string
  ) {
    const { body, metadata, redirectUrl } = await this.storage.get(
      userId,
      workspaceId,
      key,
      true
    );

    if (redirectUrl) {
      // redirect to signed url
      return res.redirect(redirectUrl);
    }

    if (!body) {
      throw new BlobNotFound({
        spaceId: workspaceId,
        blobId: key,
      });
    }

    // metadata should always exists if body is not null
    if (metadata) {
      res.setHeader('content-type', metadata.contentType);
      res.setHeader('last-modified', metadata.lastModified.toUTCString());
      res.setHeader('content-length', metadata.contentLength);
    } else {
      this.logger.warn(`Blob ${workspaceId}/${key} has no metadata`);
    }
    applyAttachHeaders(res, {
      contentType: metadata?.contentType,
      filename: key,
    });

    res.setHeader('cache-control', 'public, max-age=2592000, immutable');
    body.pipe(res);
  }
}
