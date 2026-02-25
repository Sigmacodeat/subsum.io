import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { LegalAuditService } from './legal-audit.service';
import { LegalConflictService } from './legal-conflict.service';
import { LegalDeadlineCalculator } from './legal-deadline-calculator';

@Injectable()
export class LegalCaseService {
  constructor(
    private readonly db: PrismaClient,
    private readonly audit: LegalAuditService,
    private readonly conflicts: LegalConflictService,
    private readonly deadlineCalc: LegalDeadlineCalculator
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // CLIENTS (Mandanten)
  // ═══════════════════════════════════════════════════════════════════════

  async listClients(
    workspaceId: string,
    options?: {
      archived?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId, deletedAt: null };
    if (options?.archived !== undefined) where.archived = options.archived;
    if (options?.search) {
      where.OR = [
        { displayName: { contains: options.search, mode: 'insensitive' } },
        { primaryEmail: { contains: options.search, mode: 'insensitive' } },
        { companyName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.legalClient.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.db.legalClient.count({ where }),
    ]);

    return { items, total };
  }

  async getClient(id: string) {
    return this.db.legalClient.findUnique({ where: { id } });
  }

  async upsertClient(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const data = {
      workspaceId,
      organizationId: input.organizationId,
      kind: input.kind ?? 'person',
      displayName: input.displayName,
      firstName: input.firstName,
      lastName: input.lastName,
      companyName: input.companyName,
      primaryEmail: input.primaryEmail,
      primaryPhone: input.primaryPhone,
      address: input.address,
      taxId: input.taxId,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      notes: input.notes,
      tags: input.tags ?? [],
      archived: input.archived ?? false,
      identifiers: input.identifiers,
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalClient.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalClient.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      clientId: result.id,
      action: input.id ? 'client.updated' : 'client.created',
      details: `Mandant ${result.displayName} wurde ${input.id ? 'aktualisiert' : 'angelegt'}.`,
      ipAddress,
    });

    return result;
  }

  async deleteClient(params: {
    userId: string;
    workspaceId: string;
    clientId: string;
  }) {
    const client = await this.db.legalClient.findUnique({
      where: { id: params.clientId },
    });
    if (!client || client.workspaceId !== params.workspaceId) return false;

    await this.db.legalClient.update({
      where: { id: params.clientId },
      data: { deletedAt: new Date() },
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      clientId: params.clientId,
      action: 'client.deleted',
      details: `Mandant ${client.displayName} wurde gelöscht (soft-delete).`,
    });

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MATTERS (Akten)
  // ═══════════════════════════════════════════════════════════════════════

  async listMatters(
    workspaceId: string,
    options?: {
      status?: string;
      clientId?: string;
      search?: string;
      includeTrashed?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };

    if (!options?.includeTrashed) {
      where.trashedAt = null;
    }
    if (options?.status) where.status = options.status;
    if (options?.clientId) where.clientId = options.clientId;
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { externalRef: { contains: options.search, mode: 'insensitive' } },
        { aktenzeichen: { contains: options.search, mode: 'insensitive' } },
        { gericht: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.legalMatter.findMany({
        where,
        include: {
          client: { select: { id: true, displayName: true, kind: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.db.legalMatter.count({ where }),
    ]);

    return { items, total };
  }

  async getMatter(id: string) {
    return this.db.legalMatter.findUnique({
      where: { id },
      include: {
        client: true,
        matterClients: { include: { client: true } },
        deadlines: { orderBy: { dueAt: 'asc' } },
        caseFiles: { orderBy: { updatedAt: 'desc' } },
      },
    });
  }

  async upsertMatter(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const clientExists = await this.db.legalClient.findUnique({
      where: { id: input.clientId },
    });
    if (!clientExists) {
      throw new Error('Client nicht gefunden.');
    }

    const data = {
      workspaceId,
      organizationId: input.organizationId,
      clientId: input.clientId,
      title: input.title,
      externalRef: input.externalRef,
      status: input.status ?? 'open',
      jurisdiction: input.jurisdiction,
      rechtsgebiet: input.rechtsgebiet,
      gericht: input.gericht,
      aktenzeichen: input.aktenzeichen,
      streitwert: input.streitwert,
      assignedAnwaltId: input.assignedAnwaltId,
      assignedAnwaltIds: input.assignedAnwaltIds ?? [],
      gegnerName: input.gegnerName,
      gegnerAnwalt: input.gegnerAnwalt,
      summary: input.summary,
      tags: input.tags ?? [],
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalMatter.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalMatter.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      matterId: result.id,
      clientId: input.clientId,
      action: input.id ? 'matter.updated' : 'matter.created',
      details: `Akte "${result.title}" wurde ${input.id ? 'aktualisiert' : 'angelegt'}.`,
      ipAddress,
    });

    return result;
  }

  async trashMatter(params: {
    userId: string;
    workspaceId: string;
    matterId: string;
  }) {
    const matter = await this.db.legalMatter.findUnique({
      where: { id: params.matterId },
    });
    if (!matter || matter.workspaceId !== params.workspaceId) return null;

    const now = new Date();
    const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updated = await this.db.legalMatter.update({
      where: { id: params.matterId },
      data: { trashedAt: now, purgeAt },
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      matterId: params.matterId,
      action: 'matter.trashed',
      severity: 'warning',
      details: `Akte "${matter.title}" zur Löschung markiert. Wird gelöscht am ${purgeAt.toISOString().slice(0, 10)}.`,
    });

    return updated;
  }

  async restoreMatter(params: {
    userId: string;
    workspaceId: string;
    matterId: string;
  }) {
    const matter = await this.db.legalMatter.findUnique({
      where: { id: params.matterId },
    });
    if (!matter || matter.workspaceId !== params.workspaceId) return null;

    const updated = await this.db.legalMatter.update({
      where: { id: params.matterId },
      data: { trashedAt: null, purgeAt: null },
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      matterId: params.matterId,
      action: 'matter.restored',
      details: `Akte "${matter.title}" wiederhergestellt.`,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DEADLINES (Fristen)
  // ═══════════════════════════════════════════════════════════════════════

  async listDeadlines(
    workspaceId: string,
    options?: {
      matterId?: string;
      status?: string;
      dueBefore?: Date;
      dueAfter?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.matterId) where.matterId = options.matterId;
    if (options?.status) where.status = options.status;
    if (options?.dueBefore || options?.dueAfter) {
      where.dueAt = {};
      if (options?.dueBefore) where.dueAt.lte = options.dueBefore;
      if (options?.dueAfter) where.dueAt.gte = options.dueAfter;
    }

    const [items, total] = await Promise.all([
      this.db.legalDeadline.findMany({
        where,
        include: {
          matter: { select: { id: true, title: true, externalRef: true } },
        },
        orderBy: { dueAt: 'asc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.db.legalDeadline.count({ where }),
    ]);

    return { items, total };
  }

  async upsertDeadline(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const data = {
      workspaceId,
      matterId: input.matterId,
      caseFileId: input.caseFileId,
      title: input.title,
      description: input.description,
      category: input.category ?? 'frist',
      priority: input.priority ?? 'medium',
      status: input.status ?? 'open',
      dueAt: new Date(input.dueAt),
      allDay: input.allDay ?? false,
      reminderOffsetsMinutes: input.reminderOffsetsMinutes ?? [1440, 60, 15],
      legalBasis: input.legalBasis,
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalDeadline.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalDeadline.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      matterId: input.matterId,
      action: input.id ? 'deadline.updated' : 'deadline.created',
      details: `Frist "${result.title}" (${result.category}) – fällig ${result.dueAt.toISOString().slice(0, 10)}.`,
      ipAddress,
    });

    return result;
  }

  async confirmDeadline(params: {
    userId: string;
    workspaceId: string;
    deadlineId: string;
    isSecondConfirmation?: boolean;
  }) {
    const deadline = await this.db.legalDeadline.findUnique({
      where: { id: params.deadlineId },
    });
    if (!deadline || deadline.workspaceId !== params.workspaceId) return null;

    const updateData: any = {};

    if (params.isSecondConfirmation) {
      if (deadline.confirmedByUserId === params.userId) {
        throw new Error(
          '4-Augen-Prinzip: Zweite Bestätigung muss von anderem Benutzer erfolgen.'
        );
      }
      updateData.secondConfirmedByUserId = params.userId;
      updateData.secondConfirmedAt = new Date();
      updateData.status = 'acknowledged';
      updateData.acknowledgedAt = new Date();
    } else {
      updateData.confirmedByUserId = params.userId;
      updateData.confirmedAt = new Date();
    }

    const updated = await this.db.legalDeadline.update({
      where: { id: params.deadlineId },
      data: updateData,
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      matterId: deadline.matterId,
      action: params.isSecondConfirmation
        ? 'deadline.confirmed.second'
        : 'deadline.confirmed.first',
      details: `Frist "${deadline.title}" wurde ${params.isSecondConfirmation ? 'zweitbestätigt (4-Augen)' : 'erstbestätigt'}.`,
    });

    return updated;
  }

  async completeDeadline(params: {
    userId: string;
    workspaceId: string;
    deadlineId: string;
  }) {
    const deadline = await this.db.legalDeadline.findUnique({
      where: { id: params.deadlineId },
    });
    if (!deadline || deadline.workspaceId !== params.workspaceId) return null;

    const updated = await this.db.legalDeadline.update({
      where: { id: params.deadlineId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      matterId: deadline.matterId,
      action: 'deadline.completed',
      details: `Frist "${deadline.title}" als erledigt markiert.`,
    });

    return updated;
  }

  async calculateDeadline(params: {
    jurisdiction: string;
    triggerDate: string;
    deadlineType: string;
  }) {
    return this.deadlineCalc.calculate(params);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TIME ENTRIES (Zeiterfassung)
  // ═══════════════════════════════════════════════════════════════════════

  async listTimeEntries(
    workspaceId: string,
    options?: {
      matterId?: string;
      clientId?: string;
      anwaltUserId?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.matterId) where.matterId = options.matterId;
    if (options?.clientId) where.clientId = options.clientId;
    if (options?.anwaltUserId) where.anwaltUserId = options.anwaltUserId;
    if (options?.status) where.status = options.status;
    if (options?.dateFrom || options?.dateTo) {
      where.date = {};
      if (options?.dateFrom) where.date.gte = new Date(options.dateFrom);
      if (options?.dateTo) where.date.lte = new Date(options.dateTo);
    }

    const [items, total] = await Promise.all([
      this.db.legalTimeEntry.findMany({
        where,
        include: {
          matter: { select: { id: true, title: true } },
          client: { select: { id: true, displayName: true } },
        },
        orderBy: { date: 'desc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.db.legalTimeEntry.count({ where }),
    ]);

    return { items, total };
  }

  async upsertTimeEntry(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;
    const durationMinutes = Number(input.durationMinutes);
    const hourlyRate = Number(input.hourlyRate);
    const amount = Math.round((durationMinutes / 60) * hourlyRate * 100) / 100;

    const data = {
      workspaceId,
      matterId: input.matterId,
      clientId: input.clientId,
      anwaltId: input.anwaltId,
      anwaltUserId: input.anwaltUserId ?? userId,
      description: input.description,
      activityType: input.activityType ?? 'sonstiges',
      durationMinutes,
      hourlyRate,
      amount,
      date: new Date(input.date),
      status: input.status ?? 'draft',
      invoiceId: input.invoiceId,
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalTimeEntry.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalTimeEntry.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      matterId: input.matterId,
      clientId: input.clientId,
      action: input.id ? 'time_entry.updated' : 'time_entry.created',
      details: `Zeiterfassung: ${durationMinutes} Min, €${amount.toFixed(2)} – ${input.description}`,
      ipAddress,
    });

    return result;
  }

  async submitTimeEntry(params: {
    userId: string;
    workspaceId: string;
    entryId: string;
  }) {
    return this.updateTimeEntryStatus(params, 'submitted');
  }

  async approveTimeEntry(params: {
    userId: string;
    workspaceId: string;
    entryId: string;
  }) {
    return this.updateTimeEntryStatus(params, 'approved');
  }

  async rejectTimeEntry(params: {
    userId: string;
    workspaceId: string;
    entryId: string;
  }) {
    return this.updateTimeEntryStatus(params, 'rejected');
  }

  private async updateTimeEntryStatus(
    params: { userId: string; workspaceId: string; entryId: string },
    newStatus: string
  ) {
    const entry = await this.db.legalTimeEntry.findUnique({
      where: { id: params.entryId },
    });
    if (!entry || entry.workspaceId !== params.workspaceId) return null;

    const updated = await this.db.legalTimeEntry.update({
      where: { id: params.entryId },
      data: { status: newStatus as any },
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      matterId: entry.matterId,
      action: `time_entry.${newStatus}`,
      details: `Zeiterfassung "${entry.description}" → ${newStatus}.`,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INVOICES (Rechnungen)
  // ═══════════════════════════════════════════════════════════════════════

  async listInvoices(
    workspaceId: string,
    options?: {
      matterId?: string;
      clientId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.matterId) where.matterId = options.matterId;
    if (options?.clientId) where.clientId = options.clientId;
    if (options?.status) where.status = options.status;

    const [items, total] = await Promise.all([
      this.db.legalInvoice.findMany({
        where,
        include: {
          matter: { select: { id: true, title: true } },
          client: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      this.db.legalInvoice.count({ where }),
    ]);

    return { items, total };
  }

  async createInvoice(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const invoiceNumber =
      input.invoiceNumber ?? (await this.generateInvoiceNumber(workspaceId));

    const subtotalCents = Number(input.subtotalCents);
    const taxRateBps = input.taxRateBps ?? 1900;
    const taxAmountCents = Math.round((subtotalCents * taxRateBps) / 10000);
    const totalCents = subtotalCents + taxAmountCents;

    const result = await this.db.legalInvoice.create({
      data: {
        workspaceId,
        matterId: input.matterId,
        clientId: input.clientId,
        invoiceNumber,
        status: input.status ?? 'draft',
        currency: input.currency ?? 'EUR',
        subtotalCents,
        taxRateBps,
        taxAmountCents,
        totalCents,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : undefined,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        notes: input.notes,
        lineItems: input.lineItems ?? [],
        metadata: input.metadata,
      },
    });

    if (input.timeEntryIds?.length) {
      await this.db.legalTimeEntry.updateMany({
        where: { id: { in: input.timeEntryIds }, workspaceId },
        data: { invoiceId: result.id, status: 'invoiced' },
      });
    }

    await this.audit.append({
      workspaceId,
      userId,
      matterId: input.matterId,
      clientId: input.clientId,
      action: 'invoice.created',
      details: `Rechnung ${invoiceNumber} erstellt: €${(totalCents / 100).toFixed(2)}.`,
      ipAddress,
    });

    return result;
  }

  private async generateInvoiceNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.db.legalInvoice.count({
      where: {
        workspaceId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
    return `RE-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFLICT CHECK (Kollisionsprüfung)
  // ═══════════════════════════════════════════════════════════════════════

  async runConflictCheck(params: {
    userId: string;
    workspaceId: string;
    clientId: string;
    matterId?: string;
    opposingParties: string[];
  }) {
    return this.conflicts.check(params);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════

  async getWorkspaceStats(workspaceId: string) {
    const [
      clientCount,
      matterCount,
      openMatterCount,
      deadlineCount,
      overdueDeadlineCount,
      unbilledTimeMinutes,
      draftInvoiceCount,
    ] = await Promise.all([
      this.db.legalClient.count({ where: { workspaceId, deletedAt: null } }),
      this.db.legalMatter.count({ where: { workspaceId, trashedAt: null } }),
      this.db.legalMatter.count({
        where: { workspaceId, status: 'open', trashedAt: null },
      }),
      this.db.legalDeadline.count({
        where: { workspaceId, status: { in: ['open', 'alerted'] } },
      }),
      this.db.legalDeadline.count({
        where: {
          workspaceId,
          status: { in: ['open', 'alerted'] },
          dueAt: { lt: new Date() },
        },
      }),
      this.db.legalTimeEntry.aggregate({
        where: { workspaceId, status: 'approved', invoiceId: null },
        _sum: { durationMinutes: true },
      }),
      this.db.legalInvoice.count({ where: { workspaceId, status: 'draft' } }),
    ]);

    return {
      clientCount,
      matterCount,
      openMatterCount,
      deadlineCount,
      overdueDeadlineCount,
      unbilledHours:
        Math.round((unbilledTimeMinutes._sum.durationMinutes ?? 0) / 6) / 10,
      draftInvoiceCount,
    };
  }
}
