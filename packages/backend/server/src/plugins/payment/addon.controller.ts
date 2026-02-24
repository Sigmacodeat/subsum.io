import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AddonService } from './addon';
import type { CreateAddonPurchaseInput, AddonType } from './addon';

@ApiTags('addon')
@Throttle('strict')
@Controller('/api/addon')
export class AddonController {
  constructor(private readonly addonService: AddonService) {}

  @Post('/purchase')
  @ApiOperation({ summary: 'Create addon purchase' })
  @ApiResponse({ status: 200, description: 'Checkout session created' })
  async createPurchase(
    @CurrentUser() user: any,
    @Body() input: CreateAddonPurchaseInput
  ) {
    return this.addonService.createAddonPurchase(user, input);
  }

  @Get('/purchases')
  @ApiOperation({ summary: 'Get user addon purchases' })
  @ApiResponse({ status: 200, description: 'List of addon purchases' })
  async getPurchases(@CurrentUser() user: any) {
    return this.addonService.getAddonPurchases(user);
  }

  @Get('/balances')
  @ApiOperation({ summary: 'Get all addon credit balances' })
  @ApiResponse({ status: 200, description: 'List of addon balances' })
  async getBalances(@CurrentUser() user: any) {
    return this.addonService.listBalances(user);
  }

  @Get('/balance/:addonType')
  @ApiOperation({ summary: 'Get addon credit balance' })
  @ApiResponse({ status: 200, description: 'Addon credit balance' })
  async getBalance(
    @CurrentUser() user: any,
    @Param('addonType') addonType: AddonType
  ) {
    return this.addonService.getAddonBalance(user, addonType);
  }

  @Post('/consume')
  @ApiOperation({ summary: 'Consume addon credits' })
  @ApiResponse({ status: 200, description: 'Credits consumed successfully' })
  @ApiResponse({ status: 402, description: 'Insufficient credits' })
  async consumeCredits(
    @CurrentUser() user: any,
    @Body() input: { addonType: AddonType; amount: number; description?: string; referenceId?: string }
  ) {
    const success = await this.addonService.consumeAddonCredit(
      user,
      input.addonType,
      input.amount,
      input.description,
      input.referenceId
    );

    if (!success) {
      const balance = await this.addonService.getAddonBalance(user, input.addonType);
      return {
        success: false,
        newBalance: balance.currentBalance,
        message: 'Insufficient credits',
      };
    }

    const updatedBalance = await this.addonService.getAddonBalance(user, input.addonType);
    return {
      success: true,
      newBalance: updatedBalance.currentBalance,
    };
  }

  @Delete('/purchase/:purchaseId/cancel')
  @ApiOperation({ summary: 'Cancel addon subscription' })
  @ApiResponse({ status: 200, description: 'Addon subscription canceled' })
  async cancelPurchase(
    @CurrentUser() user: any,
    @Param('purchaseId') purchaseId: string
  ) {
    return this.addonService.cancelAddonPurchase(user, purchaseId);
  }
}
