import {
  BadRequestException,
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
import z from 'zod';

import { Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController, type WorkspaceAction } from '../../core/permission';
import { LegalAuditService } from './legal-audit.service';
import { LegalCaseService } from './legal-case.service';
import { LegalDeadlineCalculator } from './legal-deadline-calculator';

function getIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.socket?.remoteAddress;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

const UpsertClientInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    organizationId: z.string().min(1).optional(),
    kind: z.enum(['person', 'company', 'authority']).optional(),
    displayName: z.string().trim().min(1),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    companyName: z.string().trim().optional(),
    primaryEmail: z.string().trim().email().optional(),
    primaryPhone: z.string().trim().optional(),
    address: z.string().trim().optional(),
    taxId: z.string().trim().optional(),
    dateOfBirth: z.string().trim().regex(ISO_DATE_REGEX).optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    archived: z.boolean().optional(),
    identifiers: z.unknown().optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough();

const UpsertCaseFileInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    title: z.string().trim().min(1),
    summary: z.string().optional(),
    priority: z.string().trim().optional(),
    docIds: z.array(z.string().min(1)).optional(),
    deadlineIds: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough();

const UpsertMatterInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    organizationId: z.string().min(1).optional(),
    clientId: z.string().min(1),
    title: z.string().trim().min(1),
    externalRef: z.string().trim().optional(),
    status: z.enum(['open', 'closed', 'archived']).optional(),
    jurisdiction: z.string().trim().optional(),
    rechtsgebiet: z.string().trim().optional(),
    gericht: z.string().trim().optional(),
    aktenzeichen: z.string().trim().optional(),
    streitwert: z.union([z.number(), z.string()]).optional(),
    assignedAnwaltId: z.string().trim().optional(),
    assignedAnwaltIds: z.array(z.string()).optional(),
    gegnerName: z.string().trim().optional(),
    gegnerAnwalt: z.string().trim().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough();

const UpsertDeadlineInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    caseFileId: z.string().min(1).optional(),
    title: z.string().trim().min(1),
    description: z.string().optional(),
    category: z.enum(['frist', 'wiedervorlage', 'termin', 'custom']).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    status: z.enum(['open', 'alerted', 'acknowledged', 'completed', 'expired']).optional(),
    dueAt: z.string().trim().regex(ISO_DATE_REGEX),
    allDay: z.boolean().optional(),
    reminderOffsetsMinutes: z.array(z.number().int().nonnegative()).optional(),
    legalBasis: z.string().trim().optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough();

const UpsertTimeEntryInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    clientId: z.string().min(1),
    anwaltId: z.string().min(1),
    anwaltUserId: z.string().min(1).optional(),
    description: z.string().trim().min(1),
    activityType: z
      .enum([
        'beratung',
        'schriftsatz',
        'recherche',
        'korrespondenz',
        'termin',
        'akteneinsicht',
        'sonstiges',
      ])
      .optional(),
    durationMinutes: z.number().int().positive(),
    hourlyRate: z.number().positive(),
    date: z.string().trim().regex(ISO_DATE_REGEX),
    status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'invoiced']).optional(),
    invoiceId: z.string().min(1).optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough();

const CreateInvoiceInputSchema = z
  .object({
    matterId: z.string().min(1),
    clientId: z.string().min(1),
    invoiceNumber: z.string().trim().min(1).optional(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'credited']).optional(),
    currency: z.string().trim().length(3).optional(),
    subtotalCents: z.number().int().nonnegative(),
    taxRateBps: z.number().int().nonnegative().optional(),
    issuedAt: z.string().trim().regex(ISO_DATE_REGEX).optional(),
    dueDate: z.string().trim().regex(ISO_DATE_REGEX).optional(),
    notes: z.string().optional(),
    lineItems: z.array(z.unknown()).optional(),
    metadata: z.unknown().optional(),
    timeEntryIds: z.array(z.string().min(1)).optional(),
  })
  .passthrough();

const ConflictCheckInputSchema = z
  .object({
    clientId: z.string().min(1),
    matterId: z.string().min(1).optional(),
    opposingParties: z.array(z.string().trim().min(1)).default([]),
  })
  .passthrough();

const UpsertPortalRequestInputSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string(),
    caseId: z.string().optional(),
    matterId: z.string().optional(),
    type: z.enum(['vollmacht', 'kyc']).optional(),
    channel: z.enum(['email', 'whatsapp']).optional(),
    status: z.string().optional(),
    tokenHash: z.string(),
    expiresAt: z.string(),
    lastSentAt: z.string().optional(),
    openedAt: z.string().optional(),
    completedAt: z.string().optional(),
    revokedAt: z.string().optional(),
    failedAt: z.string().optional(),
    sendCount: z.number().optional(),
    metadata: z.any().optional(),
  })
  .passthrough();

const UpsertVollmachtSigningRequestInputSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string(),
    caseId: z.string().optional(),
    matterId: z.string().optional(),
    portalRequestId: z.string().optional(),
    vollmachtId: z.string().optional(),
    mode: z.enum(['upload', 'esign']).optional(),
    provider: z.enum(['none', 'docusign', 'signaturit', 'dropbox_sign']).optional(),
    providerEnvelopeId: z.string().optional(),
    providerStatus: z.string().optional(),
    status: z.string().optional(),
    uploadedDocumentId: z.string().optional(),
    reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
    decisionNote: z.string().optional(),
    decidedBy: z.string().optional(),
    decidedAt: z.string().optional(),
    metadata: z.any().optional(),
  })
  .passthrough();

const UpsertKycSubmissionInputSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string(),
    caseId: z.string().optional(),
    matterId: z.string().optional(),
    portalRequestId: z.string().optional(),
    status: z.string().optional(),
    uploadedDocumentIds: z.array(z.string()).optional(),
    formData: z.any().optional(),
    reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
    decisionNote: z.string().optional(),
    decidedBy: z.string().optional(),
    decidedAt: z.string().optional(),
    metadata: z.any().optional(),
  })
  .passthrough();

function parseOptionalNumber(
  value: string | undefined,
  field: string
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} muss eine nicht-negative Zahl sein.`);
  }
  return parsed;
}

function formatZodError(error: z.ZodError) {
  return error.issues
    .map(issue => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}

@Controller('/api/legal')
export class LegalCaseController {
  constructor(
    private readonly service: LegalCaseService,
    private readonly audit: LegalAuditService,
    private readonly deadlineCalc: LegalDeadlineCalculator,
    private readonly ac: AccessController
  ) {}

  private async assertWorkspaceAccess(
    userId: string,
    workspaceId: string,
    action: WorkspaceAction
  ) {
    await this.ac.user(userId).workspace(workspaceId).assert(action);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/clients')
  async listClients(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('archived') archived?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listClients(workspaceId, {
      archived:
        archived === 'true' ? true : archived === 'false' ? false : undefined,
      search,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
    });
  }

  @Get('/workspaces/:workspaceId/clients/:clientId')
  async getClient(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('clientId') clientId: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    const client = await this.service.getClient(workspaceId, clientId);
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertClientInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.upsertClient({
      userId: user.id,
      workspaceId,
      input: parsed.data,
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

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
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
    @Query('includeTrashed') includeTrashed?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listMatters(workspaceId, {
      status,
      clientId,
      search,
      includeTrashed: includeTrashed === 'true',
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
    });
  }

  @Get('/workspaces/:workspaceId/matters/:matterId')
  async getMatter(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('matterId') matterId: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    const matter = await this.service.getMatter(workspaceId, matterId);
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertMatterInputSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'validation_error',
        message: parsed.error.issues.map(issue => issue.message).join('; '),
      };
    }

    try {
      const result = await this.service.upsertMatter({
        userId: user.id,
        workspaceId,
        input: parsed.data,
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const result = await this.service.restoreMatter({
      userId: user.id,
      workspaceId,
      matterId,
    });
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CASE FILES
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/case-files')
  async listCaseFiles(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('matterId') matterId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listCaseFiles(workspaceId, {
      matterId,
      search,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
    });
  }

  @Get('/workspaces/:workspaceId/case-files/:caseFileId')
  async getCaseFile(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('caseFileId') caseFileId: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    const caseFile = await this.service.getCaseFile(workspaceId, caseFileId);
    if (!caseFile) return { ok: false, code: 'not_found' };
    return caseFile;
  }

  @Post('/workspaces/:workspaceId/case-files')
  @HttpCode(HttpStatus.OK)
  async upsertCaseFile(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertCaseFileInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.upsertCaseFile({
      userId: user.id,
      workspaceId,
      input: parsed.data,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  @Delete('/workspaces/:workspaceId/case-files/:caseFileId')
  async deleteCaseFile(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('caseFileId') caseFileId: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const deleted = await this.service.deleteCaseFile({
      userId: user.id,
      workspaceId,
      caseFileId,
    });
    return { ok: deleted };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DEADLINES
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/deadlines')
  async listDeadlines(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('dueAfter') dueAfter?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listDeadlines(workspaceId, {
      matterId,
      status,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      dueAfter: dueAfter ? new Date(dueAfter) : undefined,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertDeadlineInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.upsertDeadline({
      userId: user.id,
      workspaceId,
      input: parsed.data,
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

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
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listTimeEntries(workspaceId, {
      matterId,
      clientId,
      status,
      dateFrom,
      dateTo,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertTimeEntryInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.upsertTimeEntry({
      userId: user.id,
      workspaceId,
      input: parsed.data,
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

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
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listInvoices(workspaceId, {
      matterId,
      clientId,
      status,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = CreateInvoiceInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.createInvoice({
      userId: user.id,
      workspaceId,
      input: parsed.data,
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
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = ConflictCheckInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.runConflictCheck({
      userId: user.id,
      workspaceId,
      clientId: parsed.data.clientId,
      matterId: parsed.data.matterId,
      opposingParties: parsed.data.opposingParties,
    });
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/audit-log')
  async listAuditLogs(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('action') action?: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.audit.listByWorkspace(workspaceId, {
      action,
      matterId,
      clientId,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PORTAL REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/portal-requests')
  async listPortalRequests(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listPortalRequests(workspaceId, {
      type,
      status,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
    });
  }

  @Get('/workspaces/:workspaceId/portal-requests/:id')
  async getPortalRequest(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    const result = await this.service.getPortalRequest(workspaceId, id);
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/portal-requests')
  @HttpCode(HttpStatus.OK)
  async upsertPortalRequest(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertPortalRequestInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.upsertPortalRequest({
      userId: user.id,
      workspaceId,
      input: parsed.data,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VOLLMACHT SIGNING REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/vollmacht-signing-requests')
  async listVollmachtSigningRequests(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('status') status?: string,
    @Query('reviewStatus') reviewStatus?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listVollmachtSigningRequests(workspaceId, {
      status,
      reviewStatus,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
    });
  }

  @Get('/workspaces/:workspaceId/vollmacht-signing-requests/:id')
  async getVollmachtSigningRequest(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    const result = await this.service.getVollmachtSigningRequest(workspaceId, id);
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/vollmacht-signing-requests')
  @HttpCode(HttpStatus.OK)
  async upsertVollmachtSigningRequest(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertVollmachtSigningRequestInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.upsertVollmachtSigningRequest({
      userId: user.id,
      workspaceId,
      input: parsed.data,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // KYC SUBMISSIONS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/kyc-submissions')
  async listKycSubmissions(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('status') status?: string,
    @Query('reviewStatus') reviewStatus?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.listKycSubmissions(workspaceId, {
      status,
      reviewStatus,
      limit: parseOptionalNumber(limit, 'limit'),
      offset: parseOptionalNumber(offset, 'offset'),
    });
  }

  @Get('/workspaces/:workspaceId/kyc-submissions/:id')
  async getKycSubmission(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    const result = await this.service.getKycSubmission(workspaceId, id);
    if (!result) return { ok: false, code: 'not_found' };
    return { ok: true, data: result };
  }

  @Post('/workspaces/:workspaceId/kyc-submissions')
  @HttpCode(HttpStatus.OK)
  async upsertKycSubmission(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Sync');

    const parsed = UpsertKycSubmissionInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }

    const result = await this.service.upsertKycSubmission({
      userId: user.id,
      workspaceId,
      input: parsed.data,
      ipAddress: getIp(req),
    });
    return { ok: true, data: result };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('/workspaces/:workspaceId/stats')
  async getStats(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string
  ) {
    await this.assertWorkspaceAccess(user.id, workspaceId, 'Workspace.Read');

    return this.service.getWorkspaceStats(workspaceId);
  }
}
