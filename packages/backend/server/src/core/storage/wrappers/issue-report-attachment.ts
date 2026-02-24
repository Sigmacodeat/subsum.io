import { Injectable, Logger } from '@nestjs/common';

import {
  autoMetadata,
  Config,
  EventBus,
  OnEvent,
  type StorageProvider,
  StorageProviderFactory,
} from '../../../base';
import { Models } from '../../../models';

declare global {
  interface Events {
    'issue-report.attachment.delete': {
      reportId: string;
      key: string;
    };
  }
}

@Injectable()
export class IssueReportAttachmentStorage {
  private readonly logger = new Logger(IssueReportAttachmentStorage.name);
  private provider!: StorageProvider;

  get config() {
    return this.AFFiNEConfig.storages.blob;
  }

  constructor(
    private readonly AFFiNEConfig: Config,
    private readonly event: EventBus,
    private readonly storageFactory: StorageProviderFactory,
    private readonly models: Models
  ) {}

  @OnEvent('config.init')
  async onConfigInit() {
    this.provider = this.storageFactory.create(this.config.storage);
  }

  @OnEvent('config.changed')
  async onConfigChanged(event: Events['config.changed']) {
    if (event.updates.storages?.blob?.storage) {
      this.provider = this.storageFactory.create(this.config.storage);
    }
  }

  private storageKey(workspaceId: string, reportId: string, key: string) {
    return `issue-report-attachments/${workspaceId}/${reportId}/${key}`;
  }

  async put(params: {
    workspaceId: string;
    reportId: string;
    key: string;
    name: string;
    blob: Buffer;
  }) {
    const meta = autoMetadata(params.blob);

    await this.provider.put(
      this.storageKey(params.workspaceId, params.reportId, params.key),
      params.blob,
      meta
    );

    const mime = meta.contentType ?? 'application/octet-stream';
    const size = params.blob.length;

    await this.models.issueReportAttachment.create({
      reportId: params.reportId,
      key: params.key,
      name: params.name,
      mime,
      size,
    });

    this.logger.log(
      `uploaded issue report attachment ${params.workspaceId}/${params.reportId}/${params.key} with size ${size}, mime: ${mime}`
    );
  }

  async get(
    workspaceId: string,
    reportId: string,
    key: string,
    signedUrl?: boolean
  ) {
    return await this.provider.get(
      this.storageKey(workspaceId, reportId, key),
      signedUrl
    );
  }

  @OnEvent('issue-report.attachment.delete')
  async onDelete({ reportId, key }: Events['issue-report.attachment.delete']) {
    try {
      const attachment = await this.models.issueReportAttachment.get(reportId, key);
      if (!attachment) return;
      const report = await this.models.issueReport.getById(reportId);
      if (!report) return;
      await this.provider.delete(this.storageKey(report.workspaceId, reportId, key));
      this.logger.log(`deleted issue report attachment ${report.workspaceId}/${reportId}/${key}`);
    } catch (e) {
      this.logger.error('failed to delete issue report attachment', e);
    }
  }
}
