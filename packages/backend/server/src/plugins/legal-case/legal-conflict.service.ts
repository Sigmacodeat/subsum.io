import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { LegalAuditService } from './legal-audit.service';

@Injectable()
export class LegalConflictService {
  constructor(
    private readonly db: PrismaClient,
    private readonly audit: LegalAuditService
  ) {}

  async check(params: {
    userId: string;
    workspaceId: string;
    clientId: string;
    matterId?: string;
    opposingParties: string[];
  }) {
    const { workspaceId, clientId, matterId, opposingParties } = params;

    if (!opposingParties.length) {
      return this.createResult(params, 'clear', [], []);
    }

    const searchTerms = opposingParties
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);

    // Search across all clients in the same organization scope
    const workspace = await (this.db as any).workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });

    const orgFilter: any = workspace?.organizationId
      ? { organizationId: workspace.organizationId }
      : { workspaceId };

    // Search for matching clients (opposing party is an existing client)
    const allClients = await (this.db as any).legalClient.findMany({
      where: {
        ...orgFilter,
        deletedAt: null,
        id: { not: clientId },
      },
      select: {
        id: true,
        displayName: true,
        companyName: true,
        primaryEmail: true,
      },
    });

    const matchedClientIds: string[] = [];
    for (const client of allClients) {
      const clientNames = [
        client.displayName?.toLowerCase(),
        client.companyName?.toLowerCase(),
        client.primaryEmail?.toLowerCase(),
      ].filter(Boolean);

      for (const term of searchTerms) {
        if (
          clientNames.some(
            (name: string) => name.includes(term) || term.includes(name)
          )
        ) {
          matchedClientIds.push(client.id);
          break;
        }
      }
    }

    // Search for matching matters where opposing party matches existing clients
    const allMatters = await (this.db as any).legalMatter.findMany({
      where: {
        ...orgFilter,
        trashedAt: null,
        ...(matterId ? { id: { not: matterId } } : {}),
      },
      select: {
        id: true,
        title: true,
        gegnerName: true,
        gegnerAnwalt: true,
        clientId: true,
      },
    });

    const matchedMatterIds: string[] = [];
    for (const matter of allMatters) {
      // Check if our client appears as opposing party in another matter
      const gegnerNames = [
        matter.gegnerName?.toLowerCase(),
        matter.gegnerAnwalt?.toLowerCase(),
      ].filter(Boolean);

      // Check if any search term matches gegner in other matters
      for (const term of searchTerms) {
        if (gegnerNames.some((name: string) => name.includes(term))) {
          matchedMatterIds.push(matter.id);
          break;
        }
      }

      // Check if our client's name appears as gegner elsewhere
      if (
        matchedClientIds.includes(matter.clientId) &&
        !matchedMatterIds.includes(matter.id)
      ) {
        matchedMatterIds.push(matter.id);
      }
    }

    const status =
      matchedClientIds.length > 0 || matchedMatterIds.length > 0
        ? 'potential_conflict'
        : 'clear';

    return this.createResult(
      params,
      status,
      matchedClientIds,
      matchedMatterIds
    );
  }

  private async createResult(
    params: {
      userId: string;
      workspaceId: string;
      clientId: string;
      matterId?: string;
      opposingParties: string[];
    },
    status: string,
    matchedClientIds: string[],
    matchedMatterIds: string[]
  ) {
    const workspace = await (this.db as any).workspace.findUnique({
      where: { id: params.workspaceId },
      select: { organizationId: true },
    });

    const result = await (this.db as any).legalConflictCheck.create({
      data: {
        workspaceId: params.workspaceId,
        organizationId: workspace?.organizationId,
        clientId: params.clientId,
        matterId: params.matterId,
        checkedByUserId: params.userId,
        status,
        opposingParties: params.opposingParties,
        matchedClientIds,
        matchedMatterIds,
        details:
          status === 'clear'
            ? 'Keine Konflikte gefunden.'
            : `Potenzielle Konflikte: ${matchedClientIds.length} Mandanten, ${matchedMatterIds.length} Akten.`,
      },
    });

    const severity = status === 'clear' ? 'info' : 'warning';
    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      clientId: params.clientId,
      matterId: params.matterId,
      action: 'conflict_check.completed',
      severity: severity as any,
      details:
        status === 'clear'
          ? `Kollisionsprüfung: Keine Konflikte (${params.opposingParties.join(', ')}).`
          : `Kollisionsprüfung: POTENZIELLE KONFLIKTE gefunden! ${matchedClientIds.length} Mandanten, ${matchedMatterIds.length} Akten betroffen.`,
      metadata: {
        opposingParties: params.opposingParties,
        matchedClientIds,
        matchedMatterIds,
      },
    });

    return result;
  }

  async waiveConflict(params: {
    userId: string;
    workspaceId: string;
    conflictCheckId: string;
    reason: string;
  }) {
    const check = await (this.db as any).legalConflictCheck.findUnique({
      where: { id: params.conflictCheckId },
    });
    if (!check || check.workspaceId !== params.workspaceId) return null;

    const updated = await (this.db as any).legalConflictCheck.update({
      where: { id: params.conflictCheckId },
      data: {
        status: 'waived',
        waivedByUserId: params.userId,
        waivedAt: new Date(),
        waiverReason: params.reason,
      },
    });

    await this.audit.append({
      workspaceId: params.workspaceId,
      userId: params.userId,
      clientId: check.clientId,
      matterId: check.matterId,
      action: 'conflict_check.waived',
      severity: 'warning',
      details: `Kollisionskonflikt aufgehoben: ${params.reason}`,
    });

    return updated;
  }
}
