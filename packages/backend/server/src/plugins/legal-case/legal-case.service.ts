import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

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

  async getClient(workspaceId: string, id: string) {
    return this.db.legalClient.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });
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

  async getMatter(workspaceId: string, id: string) {
    return this.db.legalMatter.findFirst({
      where: {
        id,
        workspaceId,
      },
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
  // CASE FILES (Fallakten)
  // ═══════════════════════════════════════════════════════════════════════

  async listCaseFiles(
    workspaceId: string,
    options?: {
      matterId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.matterId) where.matterId = options.matterId;
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { summary: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.legalCaseFile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: options?.limit ?? 200,
        skip: options?.offset ?? 0,
      }),
      this.db.legalCaseFile.count({ where }),
    ]);

    return { items, total };
  }

  async getCaseFile(workspaceId: string, caseFileId: string) {
    return this.db.legalCaseFile.findFirst({
      where: {
        id: caseFileId,
        workspaceId,
      },
    });
  }

  async upsertCaseFile(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const matter = await this.db.legalMatter.findFirst({
      where: {
        id: input.matterId,
        workspaceId,
      },
      select: {
        id: true,
        title: true,
      },
    });
    if (!matter) {
      throw new Error('Matter nicht gefunden.');
    }

    const data = {
      workspaceId,
      matterId: input.matterId,
      title: input.title,
      summary: input.summary,
      priority: input.priority ?? 'medium',
      docIds: Array.isArray(input.docIds) ? input.docIds : [],
      deadlineIds: Array.isArray(input.deadlineIds) ? input.deadlineIds : [],
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalCaseFile.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalCaseFile.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      matterId: result.matterId,
      action: input.id ? 'case_file.updated' : 'case_file.created',
      details: `Fallakte "${result.title ?? 'Unbenannt'}" wurde ${input.id ? 'aktualisiert' : 'angelegt'} (Akte: ${matter.title}).`,
      ipAddress,
      metadata: {
        caseFileId: result.id,
        matterId: result.matterId,
      },
    });

    return result;
  }

  async deleteCaseFile(params: {
    userId: string;
    workspaceId: string;
    caseFileId: string;
  }) {
    const caseFile = await this.db.legalCaseFile.findFirst({
      where: {
        id: params.caseFileId,
        workspaceId: params.workspaceId,
      },
    });
    if (!caseFile) return false;

    await this.db.legalCaseFile.delete({
      where: { id: caseFile.id },
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      matterId: caseFile.matterId,
      action: 'case_file.deleted',
      details: `Fallakte "${caseFile.title ?? 'Unbenannt'}" wurde gelöscht.`,
      metadata: {
        caseFileId: caseFile.id,
      },
    });

    return true;
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

    const subtotalCents = Number(input.subtotalCents);
    const taxRateBps = input.taxRateBps ?? 1900;
    const taxAmountCents = Math.round((subtotalCents * taxRateBps) / 10000);
    const totalCents = subtotalCents + taxAmountCents;

    const userProvidedInvoiceNumber =
      typeof input.invoiceNumber === 'string' && input.invoiceNumber.trim()
        ? input.invoiceNumber.trim()
        : undefined;

    let result: Awaited<ReturnType<typeof this.db.legalInvoice.create>> | null =
      null;
    const maxRetries = userProvidedInvoiceNumber ? 1 : 5;

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      const invoiceNumber =
        userProvidedInvoiceNumber ??
        (await this.generateInvoiceNumber(workspaceId));
      try {
        result = await this.db.legalInvoice.create({
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
        break;
      } catch (error) {
        const duplicateInvoiceNumber =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';

        if (!duplicateInvoiceNumber || attempt >= maxRetries - 1) {
          throw error;
        }
      }
    }

    if (!result) {
      throw new Error('Rechnung konnte nicht erstellt werden. Bitte erneut versuchen.');
    }

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
      details: `Rechnung ${result.invoiceNumber} erstellt: €${(totalCents / 100).toFixed(2)}.`,
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
    return this.conflicts.check({
      userId: params.userId,
      workspaceId: params.workspaceId,
      clientId: params.clientId,
      matterId: params.matterId,
      opposingParties: params.opposingParties,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PORTAL REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

  async listPortalRequests(
    workspaceId: string,
    options?: {
      type?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.type) where.type = options.type;
    if (options?.status) where.status = options.status;

    const [items, total] = await Promise.all([
      this.db.legalPortalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.db.legalPortalRequest.count({ where }),
    ]);

    return { items, total };
  }

  async getPortalRequest(workspaceId: string, id: string) {
    return this.db.legalPortalRequest.findFirst({
      where: { id, workspaceId },
    });
  }

  async upsertPortalRequest(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const data = {
      workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      type: input.type ?? 'vollmacht',
      channel: input.channel ?? 'email',
      status: input.status ?? 'created',
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.expiresAt),
      lastSentAt: input.lastSentAt ? new Date(input.lastSentAt) : undefined,
      openedAt: input.openedAt ? new Date(input.openedAt) : undefined,
      completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
      revokedAt: input.revokedAt ? new Date(input.revokedAt) : undefined,
      failedAt: input.failedAt ? new Date(input.failedAt) : undefined,
      sendCount: input.sendCount ?? 0,
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalPortalRequest.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalPortalRequest.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      action: input.id ? 'portal_request.updated' : 'portal_request.created',
      details: `Portal-Request (${result.type}) wurde ${input.id ? 'aktualisiert' : 'angelegt'}.`,
      ipAddress,
      metadata: {
        portalRequestId: result.id,
        type: result.type,
        status: result.status,
      },
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VOLLMACHT SIGNING REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

  async listVollmachtSigningRequests(
    workspaceId: string,
    options?: {
      status?: string;
      reviewStatus?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.status) where.status = options.status;
    if (options?.reviewStatus) where.reviewStatus = options.reviewStatus;

    const [items, total] = await Promise.all([
      this.db.legalVollmachtSigningRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.db.legalVollmachtSigningRequest.count({ where }),
    ]);

    return { items, total };
  }

  async getVollmachtSigningRequest(workspaceId: string, id: string) {
    return this.db.legalVollmachtSigningRequest.findFirst({
      where: { id, workspaceId },
    });
  }

  async upsertVollmachtSigningRequest(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const data = {
      workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      portalRequestId: input.portalRequestId,
      vollmachtId: input.vollmachtId,
      mode: input.mode ?? 'upload',
      provider: input.provider ?? 'none',
      providerEnvelopeId: input.providerEnvelopeId,
      providerStatus: input.providerStatus,
      status: input.status ?? 'requested',
      uploadedDocumentId: input.uploadedDocumentId,
      reviewStatus: input.reviewStatus ?? 'pending',
      decisionNote: input.decisionNote,
      decidedBy: input.decidedBy,
      decidedAt: input.decidedAt ? new Date(input.decidedAt) : undefined,
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalVollmachtSigningRequest.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalVollmachtSigningRequest.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      action: input.id
        ? 'vollmacht_signing.updated'
        : 'vollmacht_signing.created',
      details: `Vollmacht-Signing-Request wurde ${input.id ? 'aktualisiert' : 'angelegt'}.`,
      ipAddress,
      metadata: {
        signingRequestId: result.id,
        status: result.status,
        reviewStatus: result.reviewStatus,
      },
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // KYC SUBMISSIONS
  // ═══════════════════════════════════════════════════════════════════════

  async listKycSubmissions(
    workspaceId: string,
    options?: {
      status?: string;
      reviewStatus?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.status) where.status = options.status;
    if (options?.reviewStatus) where.reviewStatus = options.reviewStatus;

    const [items, total] = await Promise.all([
      this.db.legalKycSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.db.legalKycSubmission.count({ where }),
    ]);

    return { items, total };
  }

  async getKycSubmission(workspaceId: string, id: string) {
    return this.db.legalKycSubmission.findFirst({
      where: { id, workspaceId },
    });
  }

  async upsertKycSubmission(params: {
    userId: string;
    workspaceId: string;
    input: any;
    ipAddress?: string;
  }) {
    const { userId, workspaceId, input, ipAddress } = params;

    const data = {
      workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      portalRequestId: input.portalRequestId,
      status: input.status ?? 'requested',
      uploadedDocumentIds: input.uploadedDocumentIds ?? [],
      formData: input.formData,
      reviewStatus: input.reviewStatus ?? 'pending',
      decisionNote: input.decisionNote,
      decidedBy: input.decidedBy,
      decidedAt: input.decidedAt ? new Date(input.decidedAt) : undefined,
      metadata: input.metadata,
    };

    const result = input.id
      ? await this.db.legalKycSubmission.upsert({
          where: { id: input.id },
          update: data,
          create: { id: input.id, ...data },
        })
      : await this.db.legalKycSubmission.create({ data });

    await this.audit.append({
      workspaceId,
      userId,
      action: input.id ? 'kyc_submission.updated' : 'kyc_submission.created',
      details: `KYC-Submission wurde ${input.id ? 'aktualisiert' : 'angelegt'}.`,
      ipAddress,
      metadata: {
        kycSubmissionId: result.id,
        status: result.status,
        reviewStatus: result.reviewStatus,
      },
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════

  async getWorkspaceStats(workspaceId: string) {
    const [
      clientCount,
      matterCount,
      activeDeadlineCount,
      timeEntryCount,
      invoiceCount,
    ] = await Promise.all([
      this.db.legalClient.count({
        where: { workspaceId, deletedAt: null, archived: false },
      }),
      this.db.legalMatter.count({
        where: { workspaceId, status: 'open', trashedAt: null },
      }),
      this.db.legalDeadline.count({
        where: {
          workspaceId,
          status: { in: ['open', 'alerted', 'acknowledged'] },
        },
      }),
      this.db.legalTimeEntry.count({
        where: { workspaceId },
      }),
      this.db.legalInvoice.count({
        where: { workspaceId },
      }),
    ]);

    return {
      clientCount,
      matterCount,
      activeDeadlineCount,
      timeEntryCount,
      invoiceCount,
    };
  }
}
