import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';

import type {
  DocuSignFinalizeSigningRequest,
  DocuSignStartSigningRequest,
} from './docusign.types';
import { DocuSignService } from './docusign.service';

@Throttle('strict')
@Controller('/api/legal/esign/docusign')
export class DocuSignController {
  constructor(
    private readonly ac: AccessController,
    private readonly docusign: DocuSignService
  ) {}

  @Post('/start')
  async start(@CurrentUser() user: any, @Body() input: DocuSignStartSigningRequest) {
    await this.ac.user(user.id).workspace(input.workspaceId).assert('Workspace.Read');
    return await this.docusign.startEmbeddedSigning(input);
  }

  @Post('/finalize')
  async finalize(
    @CurrentUser() user: any,
    @Body() input: DocuSignFinalizeSigningRequest
  ) {
    if (!input?.workspaceId || !input?.signingRequestId) {
      throw new BadRequestException('Missing required fields');
    }
    await this.ac.user(user.id).workspace(input.workspaceId).assert('Workspace.Read');
    await this.ac.user(user.id).workspace(input.workspaceId).assert('Workspace.Blobs.Write');
    await this.ac.user(user.id).workspace(input.workspaceId).assert('Workspace.CreateDoc');

    return await this.docusign.finalizeIfCompleted({
      workspaceId: input.workspaceId,
      signingRequestId: input.signingRequestId,
      userId: user.id,
    });
  }
}
