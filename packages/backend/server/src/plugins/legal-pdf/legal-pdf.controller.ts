import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { applyAttachHeaders, Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';

import type { LegalPdfExportRequest } from './legal-pdf.types';
import { LegalPdfRenderService } from './legal-pdf.service';

@Throttle('strict')
@Controller('/api/legal/pdf')
export class LegalPdfController {
  constructor(private readonly legalPdf: LegalPdfRenderService) {}

  @Post('/export')
  async exportPdf(
    @CurrentUser() user: any,
    @Body() input: LegalPdfExportRequest,
    @Res() res: Response
  ) {
    if (!input?.workspaceId || !input?.title || !input?.markdown) {
      throw new BadRequestException('Missing required fields');
    }

    const result = await this.legalPdf.exportPdf({
      user,
      input,
    });

    if (!result.ok) {
      res.status(result.code === 'insufficient_credits' ? 402 : 400).send(result);
      return;
    }

    res.setHeader('content-type', 'application/pdf');
    applyAttachHeaders(res, {
      contentType: 'application/pdf',
      filename: result.fileName,
    });

    res.setHeader('x-legal-pdf-blob-key', result.blobKey);
    res.setHeader('x-legal-pdf-doc-id', result.docId);

    res.send(result.pdf);
  }
}
