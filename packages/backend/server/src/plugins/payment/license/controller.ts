import { randomUUID } from 'node:crypto';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { PrismaClient, Subscription } from '@prisma/client';
import type { Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';

import {
  CustomerPortalCreateFailed,
  InvalidLicenseToActivate,
  InvalidLicenseUpdateParams,
  LicenseNotFound,
  metrics,
  Mutex,
  Throttle,
} from '../../../base';
import { Public } from '../../../core/auth';
import { SelfhostTeamSubscriptionManager } from '../manager/selfhost';
import { SubscriptionService } from '../service';
import { StripeFactory } from '../stripe';
import {
  SubscriptionPlan,
  SubscriptionRecurring,
  SubscriptionStatus,
} from '../types';

const UpdateSeatsParams = z.object({
  seats: z.number().min(1),
});

const UpdateRecurringParams = z.object({
  recurring: z.enum([
    SubscriptionRecurring.Monthly,
    SubscriptionRecurring.Yearly,
  ]),
});

@Public()
@Throttle('strict')
@Controller('/api/team/licenses')
export class LicenseController {
  private readonly logger = new Logger(LicenseController.name);

  private readonly teamLicenseEndpointCounter =
    metrics.controllers.counter('team_license_endpoint_total');

  constructor(
    private readonly db: PrismaClient,
    private readonly mutex: Mutex,
    private readonly subscription: SubscriptionService,
    private readonly manager: SelfhostTeamSubscriptionManager,
    private readonly stripeProvider: StripeFactory
  ) {}

  @Post('/:license/activate')
  async activate(@Res() res: Response, @Param('license') key: string) {
    await using lock = await this.mutex.acquire(`license-activation:${key}`);

    if (!lock) {
      this.recordEndpointResult('activate', 'rate_limited');
      throw new InvalidLicenseToActivate({
        reason: 'Too Many Requests',
      });
    }

    const license = await this.db.license.findUnique({
      where: {
        key,
      },
    });

    if (!license) {
      this.recordEndpointResult('activate', 'license_not_found');
      throw new InvalidLicenseToActivate({
        reason: 'License not found',
      });
    }

    const subscription = await this.manager.getActiveSubscription({
      key: license.key,
      plan: SubscriptionPlan.SelfHostedTeam,
    });

    if (
      !subscription ||
      license.installedAt ||
      subscription.status !== SubscriptionStatus.Active
    ) {
      this.recordEndpointResult('activate', 'invalid_license');
      throw new InvalidLicenseToActivate({
        reason: 'Invalid license',
      });
    }

    const validateKey = randomUUID();
    await this.db.license.update({
      where: {
        key,
      },
      data: {
        installedAt: new Date(),
        validateKey,
      },
    });

    res
      .status(HttpStatus.OK)
      .header('x-next-validate-key', validateKey)
      .json(this.license(subscription));

    this.recordEndpointResult('activate', 'success');
  }

  @Post('/:license/deactivate')
  async deactivate(
    @Param('license') key: string,
    @Headers('x-validate-key') validateKey: string
  ) {
    await this.ensureValidatedLicense(key, validateKey, 'deactivate');

    await this.db.license.update({
      where: {
        key,
      },
      data: {
        installedAt: null,
        validateKey: null,
      },
    });

    this.recordEndpointResult('deactivate', 'success');

    return {
      success: true,
    };
  }

  @Get('/:license/health')
  async health(
    @Res() res: Response,
    @Param('license') key: string,
    @Headers('x-validate-key') revalidateKey: string
  ) {
    await using lock = await this.mutex.acquire(`license-health:${key}`);

    if (!lock) {
      metrics.controllers.counter('team_license_health_rate_limited').add(1);
      this.recordEndpointResult('health', 'rate_limited');
      throw new InvalidLicenseToActivate({
        reason: 'Too Many Requests',
      });
    }

    await this.ensureValidatedLicense(key, revalidateKey, 'health');

    const subscription = await this.manager.getActiveSubscription({
      key,
      plan: SubscriptionPlan.SelfHostedTeam,
    });

    if (!subscription) {
      this.recordEndpointResult('health', 'license_not_found');
      throw new LicenseNotFound();
    }

    const validateKey = randomUUID();
    await this.db.license.update({
      where: {
        key,
      },
      data: {
        validateKey,
      },
    });

    res
      .status(HttpStatus.OK)
      .header('x-next-validate-key', validateKey)
      .json(this.license(subscription));

    this.recordEndpointResult('health', 'success');
  }

  @Post('/:license/seats')
  async updateSeats(
    @Param('license') key: string,
    @Headers('x-validate-key') validateKey: string,
    @Body() body: z.infer<typeof UpdateSeatsParams>
  ) {
    const license = await this.ensureValidatedLicense(key, validateKey, 'seats');

    const parseResult = UpdateSeatsParams.safeParse(body);

    if (parseResult.error) {
      throw new InvalidLicenseUpdateParams({
        reason: parseResult.error.message,
      });
    }

    await this.subscription.updateSubscriptionQuantity(
      {
        key: license.key,
        plan: SubscriptionPlan.SelfHostedTeam,
      },
      parseResult.data.seats
    );

    this.recordEndpointResult('seats', 'success');
  }

  @Post('/:license/recurring')
  async updateRecurring(
    @Param('license') key: string,
    @Headers('x-validate-key') validateKey: string,
    @Body() body: z.infer<typeof UpdateRecurringParams>
  ) {
    const license = await this.ensureValidatedLicense(
      key,
      validateKey,
      'recurring'
    );

    const parseResult = UpdateRecurringParams.safeParse(body);

    if (parseResult.error) {
      throw new InvalidLicenseUpdateParams({
        reason: parseResult.error.message,
      });
    }

    await this.subscription.updateSubscriptionRecurring(
      {
        key: license.key,
        plan: SubscriptionPlan.SelfHostedTeam,
      },
      parseResult.data.recurring
    );

    this.recordEndpointResult('recurring', 'success');
  }

  @Post('/:license/create-customer-portal')
  async createCustomerPortal(
    @Param('license') key: string,
    @Headers('x-validate-key') validateKey: string
  ) {
    await this.ensureValidatedLicense(key, validateKey, 'create_customer_portal');

    const subscription = await this.db.subscription.findFirst({
      where: {
        targetId: key,
      },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      this.recordEndpointResult('create_customer_portal', 'license_not_found');
      throw new LicenseNotFound();
    }

    const subscriptionData =
      await this.stripeProvider.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
        {
          expand: ['customer'],
        }
      );

    const customer = subscriptionData.customer as Stripe.Customer;
    try {
      const portal =
        await this.stripeProvider.stripe.billingPortal.sessions.create({
          customer: customer.id,
        });

      this.recordEndpointResult('create_customer_portal', 'success');

      return { url: portal.url };
    } catch (e) {
      this.recordEndpointResult('create_customer_portal', 'portal_create_failed');
      this.logger.error('Failed to create customer portal.', e);
      throw new CustomerPortalCreateFailed();
    }
  }

  license(subscription: Subscription) {
    return {
      plan: subscription.plan,
      recurring: subscription.recurring,
      quantity: subscription.quantity,
      endAt: subscription.end?.getTime(),
    };
  }

  private async ensureValidatedLicense(
    key: string,
    validateKey: string | undefined,
    endpoint:
      | 'deactivate'
      | 'seats'
      | 'recurring'
      | 'create_customer_portal'
      | 'health'
  ) {
    const license = await this.db.license.findUnique({
      where: {
        key,
      },
    });

    if (!license) {
      this.recordEndpointResult(endpoint, 'license_not_found');
      throw new LicenseNotFound();
    }

    if (!license.validateKey || license.validateKey !== validateKey) {
      metrics.controllers
        .counter('team_license_validate_key_rejected')
        .add(1, { endpoint });
      this.recordEndpointResult(endpoint, 'invalid_validate_key');
      this.logger.warn(
        `Rejected team license request due to invalid validate key: ${endpoint}`
      );
      throw new InvalidLicenseToActivate({
        reason: 'Invalid validate key',
      });
    }

    return license;
  }

  private recordEndpointResult(
    endpoint:
      | 'activate'
      | 'deactivate'
      | 'seats'
      | 'recurring'
      | 'create_customer_portal'
      | 'health',
    outcome:
      | 'success'
      | 'rate_limited'
      | 'license_not_found'
      | 'invalid_validate_key'
      | 'invalid_license'
      | 'portal_create_failed'
  ) {
    this.teamLicenseEndpointCounter.add(1, {
      endpoint,
      outcome,
    });
  }
}
