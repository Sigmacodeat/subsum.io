import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser, type CurrentUser as CurrentUserType } from '../auth';
import { AccessController } from '../permission';
import { TelemetrySupportService } from './support-service';
import type {
  SupportAccessAuditEntry,
  SupportAlertEvent,
  SupportAnalyticsDashboardDto,
  SupportAnalyticsIngestAck,
  SupportAnalyticsIngestPayload,
  SupportEscalationPolicy,
  SupportEscalationPolicyInput,
  SupportIncident,
  SupportPublicStatusDto,
  SupportAnalyticsPeriod,
  SupportRetentionPolicy,
  SupportRetentionPolicyInput,
} from './support-types';

const PERIODS: SupportAnalyticsPeriod[] = new Set(['today', '7d', '30d', '90d', 'custom']);

function normalizePeriod(raw?: string): SupportAnalyticsPeriod {
  if (!raw) return '30d';
  return PERIODS.has(raw as SupportAnalyticsPeriod)
    ? (raw as SupportAnalyticsPeriod)
    : '30d';
}

@Controller('/api/workspaces/:workspaceId/analytics/support')
export class TelemetrySupportController {
  constructor(
    private readonly ac: AccessController,
    private readonly support: TelemetrySupportService
  ) {}

  private async appendAudit(
    req: Request,
    workspaceId: string,
    action: SupportAccessAuditEntry['action'],
    user: CurrentUserType,
    metadata?: Record<string, unknown>
  ) {
    await this.support.appendAccessAudit({
      at: new Date().toISOString(),
      workspaceId,
      action,
      userId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata,
    });
  }

  @Post('/snapshot')
  async ingestSnapshot(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Body() payload: SupportAnalyticsIngestPayload
  ): Promise<SupportAnalyticsIngestAck> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const ack = await this.support.ingestWorkspaceSnapshot(workspaceId, payload, user.id);
    await this.appendAudit(req, workspaceId, 'support.snapshot.ingest', user, {
      hasSnapshot: ack.hasSnapshot,
      errorGroupCount: ack.errorGroupCount,
      customerHealthCount: ack.customerHealthCount,
    });
    return ack;
  }

  @Get('/dashboard')
  async getDashboard(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Query('period') period?: string
  ): Promise<SupportAnalyticsDashboardDto> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const dto = await this.support.getWorkspaceDashboard(
      workspaceId,
      normalizePeriod(period)
    );
    await this.appendAudit(req, workspaceId, 'support.dashboard.read', user, {
      period: dto.period,
      source: dto.source,
    });
    return dto;
  }

  @Get('/retention')
  async getRetentionPolicy(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string
  ): Promise<SupportRetentionPolicy> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const policy = await this.support.getRetentionPolicy(workspaceId);
    await this.appendAudit(req, workspaceId, 'support.retention.read', user);
    return policy;
  }

  @Post('/retention')
  async upsertRetentionPolicy(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Body() payload: SupportRetentionPolicyInput
  ): Promise<SupportRetentionPolicy> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const policy = await this.support.upsertRetentionPolicy(
      workspaceId,
      payload,
      user.id
    );
    await this.appendAudit(req, workspaceId, 'support.retention.update', user, {
      snapshotTtlDays: policy.snapshotTtlDays,
      historyMaxItems: policy.historyMaxItems,
    });
    return policy;
  }

  @Get('/audit')
  async listAudit(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Query('limit') limit?: string
  ): Promise<SupportAccessAuditEntry[]> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.appendAudit(req, workspaceId, 'support.audit.read', user, {
      operation: 'list-audit',
    });
    const n = Number.parseInt(limit ?? '100', 10);
    return this.support.listAccessAudit(workspaceId, Number.isFinite(n) ? n : 100);
  }

  @Get('/escalation')
  async getEscalationPolicy(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string
  ): Promise<SupportEscalationPolicy> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const policy = await this.support.getEscalationPolicy(workspaceId);
    await this.appendAudit(req, workspaceId, 'support.escalation.read', user);
    return policy;
  }

  @Post('/escalation')
  async upsertEscalationPolicy(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Body() payload: SupportEscalationPolicyInput
  ): Promise<SupportEscalationPolicy> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const policy = await this.support.upsertEscalationPolicy(
      workspaceId,
      payload,
      user.id
    );
    await this.appendAudit(req, workspaceId, 'support.escalation.update', user, {
      notifyOn: policy.notifyOn,
      channels: policy.channels,
      throttleMinutes: policy.throttleMinutes,
    });
    return policy;
  }

  @Get('/alerts')
  async listAlerts(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Query('limit') limit?: string
  ): Promise<SupportAlertEvent[]> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.appendAudit(req, workspaceId, 'support.incident.read', user, {
      operation: 'list-alerts',
    });
    const n = Number.parseInt(limit ?? '100', 10);
    return this.support.listAlertEvents(workspaceId, Number.isFinite(n) ? n : 100);
  }

  @Get('/incidents')
  async listIncidents(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Query('limit') limit?: string
  ): Promise<SupportIncident[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    await this.appendAudit(req, workspaceId, 'support.incident.read', user);
    const n = Number.parseInt(limit ?? '50', 10);
    return this.support.listIncidents(workspaceId, Number.isFinite(n) ? n : 50);
  }

  @Get('/status')
  async getStatus(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string
  ): Promise<SupportPublicStatusDto> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    await this.appendAudit(req, workspaceId, 'support.incident.read', user, {
      operation: 'status-read',
    });
    return this.support.getPublicStatus(workspaceId);
  }
}
