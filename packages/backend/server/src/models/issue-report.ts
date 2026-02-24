import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BaseModel } from './base';

type IssueReportStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'duplicate';
type IssueReportSeverity = 'low' | 'medium' | 'high' | 'critical';
type IssueReportApp = 'web' | 'electron';

export type CreateIssueReportInput = {
  workspaceId: string;
  reporterId?: string | null;
  status?: IssueReportStatus;
  severity?: IssueReportSeverity;
  app: IssueReportApp;
  title?: string | null;
  description: string;
  expected?: string | null;
  actual?: string | null;
  route?: string | null;
  featureArea?: string | null;
  appVersion?: string | null;
  distribution?: string | null;
  buildType?: string | null;
  diagnostics?: unknown;
  dedupeKey?: string | null;
  duplicateOf?: string | null;
};

@Injectable()
export class IssueReportModel extends BaseModel {
  async create(input: CreateIssueReportInput) {
    return await this.db.issueReport.create({
      data: input,
    });
  }

  async getById(id: string) {
    return await this.db.issueReport.findUnique({
      where: { id },
      include: {
        attachments: true,
      },
    });
  }

  async list(params: {
    workspaceId?: string;
    status?: Prisma.IssueReportWhereInput['status'];
    severity?: Prisma.IssueReportWhereInput['severity'];
    skip?: number;
    take?: number;
  }) {
    return await this.db.issueReport.findMany({
      where: {
        workspaceId: params.workspaceId,
        status: params.status,
        severity: params.severity,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: params.skip ?? 0,
      take: params.take ?? 50,
      include: {
        attachments: true,
      },
    });
  }

  async updateStatus(id: string, status: IssueReportStatus) {
    return await this.db.issueReport.update({
      where: { id },
      data: { status },
      include: { attachments: true },
    });
  }

  async markDuplicate(id: string, duplicateOf: string) {
    return await this.db.issueReport.update({
      where: { id },
      data: {
        status: 'duplicate',
        duplicateOf,
      },
      include: { attachments: true },
    });
  }
}
