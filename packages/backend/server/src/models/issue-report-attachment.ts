import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BaseModel } from './base';

export type CreateIssueReportAttachmentInput =
  Prisma.IssueReportAttachmentCreateArgs['data'];

@Injectable()
export class IssueReportAttachmentModel extends BaseModel {
  async create(input: CreateIssueReportAttachmentInput) {
    return await this.db.issueReportAttachment.create({
      data: input,
    });
  }

  async list(reportId: string) {
    return await this.db.issueReportAttachment.findMany({
      where: { reportId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(reportId: string, key: string) {
    return await this.db.issueReportAttachment.findUnique({
      where: {
        reportId_key: {
          reportId,
          key,
        },
      },
    });
  }
}
