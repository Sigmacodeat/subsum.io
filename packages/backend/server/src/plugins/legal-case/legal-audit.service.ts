import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface AuditLogInput {
  workspaceId: string;
  organizationId?: string;
  userId?: string;
  clientId?: string;
  matterId?: string;
  action: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  details: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LegalAuditService {
  private readonly logger = new Logger(LegalAuditService.name);

  constructor(private readonly db: PrismaClient) {}

  async append(input: AuditLogInput) {
    try {
      return await this.db.legalAuditLog.create({
        data: {
          workspaceId: input.workspaceId,
          organizationId: input.organizationId,
          userId: input.userId,
          clientId: input.clientId,
          matterId: input.matterId,
          action: input.action,
          severity: (input.severity ?? 'info') as any,
          details: input.details,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata as any,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error as Error);
      return null;
    }
  }

  async listByWorkspace(
    workspaceId: string,
    options?: {
      action?: string;
      matterId?: string;
      clientId?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { workspaceId };
    if (options?.action) where.action = options.action;
    if (options?.matterId) where.matterId = options.matterId;
    if (options?.clientId) where.clientId = options.clientId;

    const [items, total] = await Promise.all([
      this.db.legalAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      this.db.legalAuditLog.count({ where }),
    ]);

    return { items, total };
  }

  async listByMatter(matterId: string, limit = 50) {
    return this.db.legalAuditLog.findMany({
      where: { matterId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
