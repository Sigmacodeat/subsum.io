import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission';
import { UserModule } from '../user';
import {
  OrganizationMemberResolver,
  OrganizationResolver,
} from './resolvers';
import { OrganizationService } from './service';

@Module({
  imports: [PermissionModule, UserModule],
  providers: [
    OrganizationResolver,
    OrganizationMemberResolver,
    OrganizationService,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}

export { OrganizationService } from './service';
export { OrganizationType } from './types';
