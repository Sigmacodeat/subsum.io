import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import { LegalAuditService } from './legal-audit.service';
import { LegalCaseService } from './legal-case.service';
import { LegalDeadlineCalculator } from './legal-deadline-calculator';

function getIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.socket?.remoteAddress;
}

@Controller('/api/legal')
export class LegalCaseController {
  constructor(
    private readonly service: LegalCaseService,
    private readonly audit: LegalAuditService,
    private readonly deadlineCalc: LegalDeadlineCalculator
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/clients')
  async listClients(
    @CurrentUser() _user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('archived') archived?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.listClients(workspaceId, {
      archived:
        archived === 'true' ? true : archived === 'false' ? false : undefined,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('/workspaces/:workspaceId/clients/:clientId')
  async getClient(
    @CurrentUser() _user: CurrentUser,
    @Param('clientId') clientId: string
  ) {
    const client = await this.service.getClient(clientId);
    if (!client) return { ok: false, code: 'not_found' };
    return client;
  }

  @Post('/workspaces/:workspaceId/clients')
  @HttpCode(HttpStatus.OK)
  async upsertClient(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    const result = await this.service.upsertClient({
      userId: user.id,
      workspaceId,
      input: body,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  @Delete('/workspaces/:workspaceId/clients/:clientId')
  async deleteClient(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('clientId') clientId: string
  ) {
    const deleted = await this.service.deleteClient({
      userId: user.id,
      workspaceId,
      clientId,
    });
    return { ok: deleted };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MATTERS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/matters')
  async listMatters(
    @CurrentUser() _user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
    @Query('includeTrashed') includeTrashed?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.listMatters(workspaceId, {
      status,
      clientId,
      search,
      includeTrashed: includeTrashed === 'true',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('/workspaces/:workspaceId/matters/:matterId')
  async getMatter(
    @CurrentUser() _user: CurrentUser,
    @Param('matterId') matterId: string
  ) {
    const matter = await this.service.getMatter(matterId);
    if (!matter) return { ok: false, code: 'not_found' };
    return matter;
  }

  @Post('/workspaces/:workspaceId/matters')
  @HttpCode(HttpStatus.OK)
  async upsertMatter(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    try {
      const result = await this.service.upsertMatter({
        userId: user.id,
        workspaceId,
        input: body,
        ipAddress: getIp(req),
      });
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        code: 'validation_error',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }

  @Post('/workspaces/:workspaceId/matters/:matterId/trash')
  @HttpCode(HttpStatus.OK)
  async trashMatter(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('matterId') matterId: string
  ) {
    const result = await this.service.trashMatter({
      userId: user.id,
      workspaceId,
      matterId,
    });
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/matters/:matterId/restore')
  @HttpCode(HttpStatus.OK)
  async restoreMatter(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('matterId') matterId: string
  ) {
    const result = await this.service.restoreMatter({
      userId: user.id,
      workspaceId,
      matterId,
    });
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DEADLINES
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/deadlines')
  async listDeadlines(
    @CurrentUser() _user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('dueAfter') dueAfter?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.listDeadlines(workspaceId, {
      matterId,
      status,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      dueAfter: dueAfter ? new Date(dueAfter) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('/workspaces/:workspaceId/deadlines')
  @HttpCode(HttpStatus.OK)
  async upsertDeadline(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    const result = await this.service.upsertDeadline({
      userId: user.id,
      workspaceId,
      input: body,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/deadlines/:deadlineId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDeadline(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('deadlineId') deadlineId: string,
    @Body('isSecondConfirmation') isSecondConfirmation?: boolean
  ) {
    try {
      const result = await this.service.confirmDeadline({
        userId: user.id,
        workspaceId,
        deadlineId,
        isSecondConfirmation,
      });
      if (!result) return { ok: false, code: 'not_found' };
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        code: 'validation_error',
        message:
          error instanceof Error
            ? error.message
            : 'Fehler bei Fristbestätigung',
      };
    }
  }

  @Post('/workspaces/:workspaceId/deadlines/:deadlineId/complete')
  @HttpCode(HttpStatus.OK)
  async completeDeadline(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('deadlineId') deadlineId: string
  ) {
    const result = await this.service.completeDeadline({
      userId: user.id,
      workspaceId,
      deadlineId,
    });
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  @Post('/deadlines/calculate')
  @Throttle('strict')
  @HttpCode(HttpStatus.OK)
  async calculateDeadline(
    @Body('jurisdiction') jurisdiction: string,
    @Body('triggerDate') triggerDate: string,
    @Body('deadlineType') deadlineType: string
  ) {
    return this.service.calculateDeadline({
      jurisdiction,
      triggerDate,
      deadlineType,
    });
  }

  @Get('/deadlines/types')
  async getDeadlineTypes() {
    return { types: this.deadlineCalc.getAvailableTypes() };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TIME ENTRIES
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/time-entries')
  async listTimeEntries(
    @CurrentUser() _user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.listTimeEntries(workspaceId, {
      matterId,
      clientId,
      status,
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('/workspaces/:workspaceId/time-entries')
  @HttpCode(HttpStatus.OK)
  async upsertTimeEntry(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    const result = await this.service.upsertTimeEntry({
      userId: user.id,
      workspaceId,
      input: body,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/time-entries/:entryId/submit')
  @HttpCode(HttpStatus.OK)
  async submitTimeEntry(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('entryId') entryId: string
  ) {
    const result = await this.service.submitTimeEntry({
      userId: user.id,
      workspaceId,
      entryId,
    });
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/time-entries/:entryId/approve')
  @HttpCode(HttpStatus.OK)
  async approveTimeEntry(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('entryId') entryId: string
  ) {
    const result = await this.service.approveTimeEntry({
      userId: user.id,
      workspaceId,
      entryId,
    });
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/time-entries/:entryId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectTimeEntry(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('entryId') entryId: string
  ) {
    const result = await this.service.rejectTimeEntry({
      userId: user.id,
      workspaceId,
      entryId,
    });
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/invoices')
  async listInvoices(
    @CurrentUser() _user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.listInvoices(workspaceId, {
      matterId,
      clientId,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('/workspaces/:workspaceId/invoices')
  @HttpCode(HttpStatus.OK)
  async createInvoice(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    const result = await this.service.createInvoice({
      userId: user.id,
      workspaceId,
      input: body,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFLICT CHECK
  // ═══════════════════════════════════════════════════════════════════════

  @Post('/workspaces/:workspaceId/conflict-check')
  @HttpCode(HttpStatus.OK)
  async runConflictCheck(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any
  ) {
    const result = await this.service.runConflictCheck({
      userId: user.id,
      workspaceId,
      clientId: body.clientId,
      matterId: body.matterId,
      opposingParties: body.opposingParties ?? [],
    });
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/audit-log')
  async listAuditLogs(
    @CurrentUser() _user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('action') action?: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.audit.listByWorkspace(workspaceId, {
      action,
      matterId,
      clientId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/stats')
  async getStats(
    @CurrentUser() _user: CurrentUser,
    @Param('workspaceId') workspaceId: string
  ) {
    return this.service.getWorkspaceStats(workspaceId);
  }
}
