import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
} from '@nestjs/common';

import { Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';

import { LawFirmProfileService } from './law-firm-profile.service';

@Throttle('strict')
@Controller('/api/legal/law-firm-profile')
export class LawFirmProfileController {
  constructor(
    private readonly ac: AccessController,
    private readonly profiles: LawFirmProfileService
  ) {}

  @Get('/:workspaceId')
  async getProfile(
    @CurrentUser() user: any,
    @Param('workspaceId') workspaceId: string
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Settings.Read');

    const profile = await this.profiles.get(workspaceId);
    return profile ?? { workspaceId, name: '', updatedAt: new Date().toISOString() };
  }

  @Put('/:workspaceId')
  async upsertProfile(
    @CurrentUser() user: any,
    @Param('workspaceId') workspaceId: string,
    @Body() input: unknown
  ) {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    try {
      return await this.profiles.upsert({ workspaceId, input, userId: user.id });
    } catch (e) {
      throw new BadRequestException((e as Error)?.message ?? 'Invalid input');
    }
  }
}
