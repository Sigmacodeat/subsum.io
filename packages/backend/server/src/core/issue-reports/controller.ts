import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { Admin } from '../common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../auth';
import { AccessController } from '../permission';
import { IssueReportAttachmentStorage } from '../storage';
import { Models } from '../../models';

function normalizeTake(raw?: string, fallback = 50, max = 200) {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, n);
}

function normalizeSkip(raw?: string) {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

type CreateIssueReportBody = {
  app: 'web' | 'electron';
  title?: string;
  description: string;
  expected?: string;
  actual?: string;
  route?: string;
  featureArea?: string;
  appVersion?: string;
  distribution?: string;
  buildType?: string;
  diagnostics?: Record<string, unknown>;
  screenshot?: {
    name: string;
    dataUrl: string;
  };
};

@Controller('/api/workspaces/:workspaceId/issue-reports')
export class WorkspaceIssueReportsController {
  constructor(
    private readonly ac: AccessController,
    private readonly models: Models,
    private readonly attachments: IssueReportAttachmentStorage
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateIssueReportBody
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const description = String(body?.description ?? '').trim();
    if (!description) {
      return { ok: false, error: 'missing_description' } as const;
    }

    const report = await this.models.issueReport.create({
      workspaceId,
      reporterId: user.id,
      status: 'new',
      severity: 'medium',
      app: body.app,
      title: body.title?.slice(0, 512) ?? null,
      description,
      expected: body.expected ?? null,
      actual: body.actual ?? null,
      route: body.route ?? null,
      featureArea: body.featureArea ?? null,
      appVersion: body.appVersion ?? null,
      distribution: body.distribution ?? null,
      buildType: body.buildType ?? null,
      diagnostics: (body.diagnostics as any) ?? null,
      dedupeKey: null,
      duplicateOf: null,
      updatedAt: new Date(),
    });

    if (body.screenshot?.dataUrl && body.screenshot?.name) {
      const match = /^data:([^;]+);base64,(.*)$/.exec(body.screenshot.dataUrl);
      if (match) {
        const mime = match[1];
        const base64 = match[2];
        const buf = Buffer.from(base64, 'base64');
        const key = `screenshot-${Date.now()}`;
        await this.attachments.put({
          workspaceId,
          reportId: report.id,
          key,
          name: body.screenshot.name,
          blob: buf,
        });
        void mime;
      }
    }

    return { ok: true, id: report.id } as const;
  }
}

@Controller('/api/admin/issue-reports')
@Admin()
export class AdminIssueReportsController {
  constructor(
    private readonly models: Models,
    private readonly attachments: IssueReportAttachmentStorage
  ) {}

  @Get()
  async list(
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?:
      | 'new'
      | 'triaged'
      | 'in_progress'
      | 'resolved'
      | 'rejected'
      | 'duplicate',
    @Query('severity') severity?: 'low' | 'medium' | 'high' | 'critical',
    @Query('skip') skip?: string,
    @Query('take') take?: string
  ) {
    const rows = await this.models.issueReport.list({
      workspaceId: workspaceId || undefined,
      status: status as any,
      severity: severity as any,
      skip: normalizeSkip(skip),
      take: normalizeTake(take),
    });
    return { ok: true, rows } as const;
  }

  @Get('/:id')
  async get(@Param('id') id: string) {
    const report = await this.models.issueReport.getById(id);
    if (!report) {
      return { ok: false, error: 'not_found' } as const;
    }
    return { ok: true, report } as const;
  }

  @Post('/:id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() body: { status: 'new' | 'triaged' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate' }
  ) {
    const report = await this.models.issueReport.updateStatus(id, body.status as any);
    return { ok: true, report } as const;
  }

  @Get('/:id/attachments/:key')
  async download(
    @Param('id') reportId: string,
    @Param('key') key: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    void req;
    const report = await this.models.issueReport.getById(reportId);
    if (!report) {
      res.status(404).send('Not found');
      return;
    }

    const attachment = await this.models.issueReportAttachment.get(reportId, key);
    if (!attachment) {
      res.status(404).send('Not found');
      return;
    }

    const { body, metadata, redirectUrl } = await this.attachments.get(
      report.workspaceId,
      reportId,
      key,
      true
    );

    if (redirectUrl) {
      return res.redirect(redirectUrl);
    }

    if (!body) {
      res.status(404).send('Not found');
      return;
    }

    res.setHeader('content-type', metadata?.contentType ?? attachment.mime);
    res.setHeader('cache-control', 'private, max-age=0');
    body.pipe(res);
  }
}
