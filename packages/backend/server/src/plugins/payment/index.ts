import './config';

import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { HelpersModule } from '../../base/helpers';
import { FeatureModule } from '../../core/features';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { QuotaModule } from '../../core/quota';
import { UserModule } from '../../core/user';
import { WorkspaceModule } from '../../core/workspaces';
import { StripeWebhookController } from './controller';
import { SubscriptionCronJobs } from './cron';
import { EsignWebhookController } from './esign.controller';
import { PaymentEventHandlers } from './event';
import {
  AffiliateAdminResolver,
  AffiliateResolver,
  AffiliateService,
} from './affiliate';
import { LicenseController } from './license/controller';
import {
  SelfhostTeamSubscriptionManager,
  UserSubscriptionManager,
  WorkspaceSubscriptionManager,
} from './manager';
import {
  SubscriptionResolver,
  UserSubscriptionResolver,
  WorkspaceSubscriptionResolver,
} from './resolver';
import {
  RevenueCatService,
  RevenueCatWebhookController,
  RevenueCatWebhookHandler,
} from './revenuecat';
import { SubscriptionService } from './service';
import { StripeFactory, StripeProvider } from './stripe';
import { StripeWebhook } from './webhook';
import { AddonService } from './addon';
import { AddonController } from './addon.controller';
import { AddonWebhookHandler } from './addon.webhook';
import { EsignWebhookHandler } from './esign.webhook';

@Module({
  imports: [
    HelpersModule,
    FeatureModule,
    QuotaModule,
    UserModule,
    PermissionModule,
    WorkspaceModule,
    MailModule,
    ServerConfigModule,
  ],
  providers: [
    StripeFactory,
    StripeProvider,
    RevenueCatService,
    SubscriptionService,
    SubscriptionResolver,
    UserSubscriptionResolver,
    StripeWebhook,
    RevenueCatWebhookHandler,
    UserSubscriptionManager,
    WorkspaceSubscriptionManager,
    SelfhostTeamSubscriptionManager,
    SubscriptionCronJobs,
    WorkspaceSubscriptionResolver,
    PaymentEventHandlers,
    AddonService,
    AddonWebhookHandler,
    EsignWebhookHandler,
    AffiliateService,
    AffiliateResolver,
    AffiliateAdminResolver,
  ],
  controllers: [
    StripeWebhookController,
    LicenseController,
    RevenueCatWebhookController,
    AddonController,
    EsignWebhookController,
  ],
  exports: [AddonService],
})
export class PaymentModule {}
