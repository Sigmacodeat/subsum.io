import { Module } from '@nestjs/common';

import { DocStorageModule } from '../doc';
import { PermissionModule } from '../permission';
import { IndexerModule } from '../../plugins/indexer';
import { PublicApiController } from './public-api.controller';
import { QuickCheckController } from './quick-check.controller';
import { WebhookDeliveryController } from './webhook-delivery.controller';
import { WebhookJob } from './webhook-job';

@Module({
  imports: [PermissionModule, DocStorageModule, IndexerModule],
  controllers: [PublicApiController, QuickCheckController, WebhookDeliveryController],
  providers: [WebhookJob],
})
export class PublicApiModule {}
