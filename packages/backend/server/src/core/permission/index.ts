import { Module } from '@nestjs/common';

import { AccessControllerBuilder } from './builder';
import { DocAccessController } from './doc';
import { EventsListener } from './event';
import { OrganizationAccessController } from './organization';
import { WorkspaceAccessController } from './workspace';

@Module({
  providers: [
    OrganizationAccessController,
    WorkspaceAccessController,
    DocAccessController,
    AccessControllerBuilder,
    EventsListener,
  ],
  exports: [AccessControllerBuilder],
})
export class PermissionModule {}

export { AccessControllerBuilder as AccessController } from './builder';
export {
  DOC_ACTIONS,
  type DocAction,
  DocRole,
  ORG_ACTIONS,
  type OrgAction,
  OrgRole,
  WORKSPACE_ACTIONS,
  type WorkspaceAction,
  WorkspaceRole,
} from './types';
