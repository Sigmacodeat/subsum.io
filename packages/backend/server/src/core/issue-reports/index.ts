import { Module } from '@nestjs/common';

import { StorageModule } from '../storage';
import { PermissionModule } from '../permission';
import { WorkspaceIssueReportsController, AdminIssueReportsController } from './controller';

@Module({
  imports: [PermissionModule, StorageModule],
  controllers: [WorkspaceIssueReportsController, AdminIssueReportsController],
})
export class IssueReportsModule {}

