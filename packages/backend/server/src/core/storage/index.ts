import './config';

import { Module } from '@nestjs/common';

import { BlobUploadCleanupJob } from './job';
import { R2UploadController } from './r2-proxy';
import {
  AvatarStorage,
  CommentAttachmentStorage,
  IssueReportAttachmentStorage,
  WorkspaceBlobStorage,
} from './wrappers';

@Module({
  controllers: [R2UploadController],
  providers: [
    WorkspaceBlobStorage,
    AvatarStorage,
    CommentAttachmentStorage,
    IssueReportAttachmentStorage,
    BlobUploadCleanupJob,
  ],
  exports: [
    WorkspaceBlobStorage,
    AvatarStorage,
    CommentAttachmentStorage,
    IssueReportAttachmentStorage,
  ],
})
export class StorageModule {}

export {
  AvatarStorage,
  CommentAttachmentStorage,
  IssueReportAttachmentStorage,
  WorkspaceBlobStorage,
};
