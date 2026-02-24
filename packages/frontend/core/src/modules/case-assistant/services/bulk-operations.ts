import { Service } from '@toeverything/infra';

import type {
  BulkOperation,
  BulkOperationType,
  CitationChain,
  ClientRecord,
  CourtDecision,
  EmailTemplateType,
  JudikaturSuggestion,
  MatterRecord,
} from '../types';
import type { CaseAccessControlService } from './case-access-control';
import type { DocumentGeneratorService, DocumentTemplate } from './document-generator';
import type { EmailService } from './email';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export interface BulkEmailInput {
  workspaceId: string;
  matterId?: string;
  clientIds: string[];
  templateType: EmailTemplateType;
  subject: string;
  bodyTemplate: string;
  senderName: string;
  senderEmail: string;
  attachmentRefs?: string[];
  ccEmails?: string[];
  templateContext?: {
    fristDatum?: string;
    customFields?: Record<string, string>;
  };
}

export interface BulkSchriftsatzInput {
  workspaceId: string;
  matterIds: string[];
  template: string;
  customFields?: Record<string, string>;
  parties?: {
    klaeger?: string;
    beklagter?: string;
    gericht?: string;
    aktenzeichen?: string;
    anwalt?: string;
    kanzlei?: string;
    logoDataUrl?: string;
  };
}

export interface BulkPdfExportInput {
  workspaceId: string;
  matterIds: string[];
  /** Pre-filtered documents to export — caller resolves which docs belong to which matters */
  documents: Array<{ id: string; title: string; caseId: string; markdown: string }>;
}

export interface BulkStatusUpdateInput {
  workspaceId: string;
  matterIds: string[];
  newStatus: MatterRecord['status'];
}

/**
 * Bulk Operations Service
 *
 * Handles batch operations across multiple clients/matters:
 * - Bulk email to all clients in a matter or across matters
 * - Bulk Schriftsatz generation for multiple parties
 * - Bulk PDF export
 * - Bulk status updates
 * - Bulk Mandantenbrief generation
 */
export class BulkOperationsService extends Service {
  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly accessControl: CaseAccessControlService,
    private readonly documentGenerator: DocumentGeneratorService,
    private readonly emailService: EmailService
  ) {
    super();
  }

  private async createBulkOperation(input: {
    workspaceId: string;
    type: BulkOperationType;
    targetMatterIds: string[];
    targetClientIds: string[];
    totalItems: number;
  }): Promise<BulkOperation> {
    const now = new Date().toISOString();
    return {
      id: createId('bulk-op'),
      workspaceId: input.workspaceId,
      type: input.type,
      targetMatterIds: input.targetMatterIds,
      targetClientIds: input.targetClientIds,
      status: 'queued',
      progress: 0,
      totalItems: input.totalItems,
      completedItems: 0,
      failedItems: 0,
      results: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Resolve all client IDs for given matter IDs (including multi-mandant clientIds[])
   */
  resolveClientsForMatters(
    matters: MatterRecord[],
    allClients: ClientRecord[]
  ): Map<string, ClientRecord[]> {
    const result = new Map<string, ClientRecord[]>();
    const clientMap = new Map(allClients.map(c => [c.id, c]));

    for (const matter of matters) {
      const clientIds = new Set<string>();
      clientIds.add(matter.clientId);
      if (matter.clientIds) {
        for (const cid of matter.clientIds) {
          clientIds.add(cid);
        }
      }

      const clients: ClientRecord[] = [];
      for (const cid of clientIds) {
        const client = clientMap.get(cid);
        if (client && !client.archived) {
          clients.push(client);
        }
      }
      result.set(matter.id, clients);
    }

    return result;
  }

  /**
   * Send bulk emails to all clients across specified matters
   */
  async bulkSendEmails(input: BulkEmailInput): Promise<BulkOperation> {
    const permission = await this.accessControl.evaluate('bulk.execute');
    if (!permission.ok) {
      const op = await this.createBulkOperation({
        workspaceId: input.workspaceId,
        type: 'email',
        targetMatterIds: input.matterId ? [input.matterId] : [],
        targetClientIds: input.clientIds,
        totalItems: input.clientIds.length,
      });
      op.status = 'failed';
      op.errorMessage = `Berechtigung verweigert: ${permission.message}`;
      return op;
    }

    const op = await this.createBulkOperation({
      workspaceId: input.workspaceId,
      type: 'email',
      targetMatterIds: input.matterId ? [input.matterId] : [],
      targetClientIds: input.clientIds,
      totalItems: input.clientIds.length,
    });
    op.status = 'running';

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: 'bulk.email.started',
      severity: 'info',
      details: `Bulk-Email an ${input.clientIds.length} Empfänger gestartet.`,
    });

    for (let i = 0; i < input.clientIds.length; i++) {
      const clientId = input.clientIds[i];
      try {
        const result = await this.emailService.sendEmail({
          workspaceId: input.workspaceId,
          matterId: input.matterId,
          clientId,
          templateType: input.templateType,
          subject: input.subject,
          bodyTemplate: input.bodyTemplate,
          senderName: input.senderName,
          senderEmail: input.senderEmail,
          attachmentRefs: input.attachmentRefs,
          ccEmails: input.ccEmails,
          templateContext: input.templateContext,
        });

        op.results.push({
          targetId: clientId,
          success: result.success,
          message: result.message,
          outputRef: result.emailId,
        });

        if (result.success) {
          op.completedItems++;
        } else {
          op.failedItems++;
        }
      } catch (error) {
        op.failedItems++;
        op.results.push({
          targetId: clientId,
          success: false,
          message: error instanceof Error ? error.message : 'Unbekannter Fehler',
        });
      }

      op.progress = Math.round(((i + 1) / input.clientIds.length) * 100);
      op.updatedAt = new Date().toISOString();
    }

    op.status = op.failedItems === 0 ? 'completed'
      : op.completedItems === 0 ? 'failed'
      : 'partial';
    op.updatedAt = new Date().toISOString();

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: op.status === 'completed' ? 'bulk.email.completed' : 'bulk.email.partial',
      severity: op.failedItems > 0 ? 'warning' : 'info',
      details: `Bulk-Email: ${op.completedItems}/${op.totalItems} erfolgreich, ${op.failedItems} fehlgeschlagen.`,
    });

    return op;
  }

  /**
   * Generate Schriftsätze for multiple matters at once.
   * Resolves per-matter party data from graph: clients → Kläger, opposingParties → Beklagter.
   */
  async bulkGenerateSchriftsaetze(input: BulkSchriftsatzInput): Promise<BulkOperation> {
    const permission = await this.accessControl.evaluate('bulk.execute');
    if (!permission.ok) {
      const op = await this.createBulkOperation({
        workspaceId: input.workspaceId,
        type: 'schriftsatz',
        targetMatterIds: input.matterIds,
        targetClientIds: [],
        totalItems: input.matterIds.length,
      });
      op.status = 'failed';
      op.errorMessage = `Berechtigung verweigert: ${permission.message}`;
      return op;
    }

    const graph = await this.orchestration.getGraph();

    const op = await this.createBulkOperation({
      workspaceId: input.workspaceId,
      type: 'schriftsatz',
      targetMatterIds: input.matterIds,
      targetClientIds: [],
      totalItems: input.matterIds.length,
    });
    op.status = 'running';

    for (let i = 0; i < input.matterIds.length; i++) {
      const matterId = input.matterIds[i];
      try {
        const matter = graph.matters?.[matterId];
        // Pick the most recently updated case for this matter (deterministic)
        const caseRecord = Object.values(graph.cases ?? {})
          .filter(item => item.matterId === matterId)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

        const allSuggestions = (this.orchestration.judikaturSuggestions$.value ?? []) as JudikaturSuggestion[];
        const allChains = (this.orchestration.citationChains$.value ?? []) as CitationChain[];
        const allDecisions = (this.orchestration.courtDecisions$.value ?? []) as CourtDecision[];

        const caseSuggestions = caseRecord
          ? allSuggestions
              .filter(
                item => item.caseId === caseRecord.id && item.workspaceId === input.workspaceId
              )
              .sort((a, b) => b.relevanceScore - a.relevanceScore)
          : [];
        const caseChains = caseRecord
          ? allChains.filter(
              item => item.caseId === caseRecord.id && item.workspaceId === input.workspaceId
            )
          : [];
        const decisionIds = new Set(caseSuggestions.map(item => item.decisionId));
        const caseDecisions = allDecisions.filter(item => decisionIds.has(item.id));

        const clientIds = matter?.clientIds?.length
          ? matter.clientIds
          : matter?.clientId ? [matter.clientId] : [];
        const matterClients = clientIds
          .map(cid => graph.clients?.[cid])
          .filter(Boolean) as ClientRecord[];
        const opposingParties = matter?.opposingParties ?? [];

        const klaeger = matterClients.length > 0
          ? matterClients.map(c => c.displayName).join(', ')
          : input.parties?.klaeger;
        const beklagter = opposingParties.length > 0
          ? opposingParties.map(p => p.displayName).join(', ')
          : input.parties?.beklagter;
        const aktenzeichen = matter?.externalRef || input.parties?.aktenzeichen;
        const gericht = matter?.gericht || input.parties?.gericht;

        const doc = this.documentGenerator.generate({
          template: input.template as DocumentTemplate,
          caseFile: caseRecord,
          judikaturSuggestions: caseSuggestions,
          citationChains: caseChains,
          courtDecisions: caseDecisions,
          customFields: input.customFields,
          parties: {
            klaeger,
            beklagter,
            klaegerList: matterClients.length > 1 ? matterClients.map(c => c.displayName) : undefined,
            beklagterList: opposingParties.length > 1 ? opposingParties.map(p => p.displayName) : undefined,
            gericht,
            aktenzeichen,
            anwalt: input.parties?.anwalt,
            kanzlei: input.parties?.kanzlei,
            logoDataUrl: input.parties?.logoDataUrl,
          },
        });

        op.results.push({
          targetId: matterId,
          success: true,
          message: `Schriftsatz generiert: ${doc.title} (${klaeger ?? '?'} vs. ${beklagter ?? '?'})`,
          outputRef: doc.id,
        });
        op.completedItems++;
      } catch (error) {
        op.failedItems++;
        op.results.push({
          targetId: matterId,
          success: false,
          message: error instanceof Error ? error.message : 'Generierung fehlgeschlagen',
        });
      }

      op.progress = Math.round(((i + 1) / input.matterIds.length) * 100);
      op.updatedAt = new Date().toISOString();
    }

    op.status = op.failedItems === 0 ? 'completed'
      : op.completedItems === 0 ? 'failed'
      : 'partial';
    op.updatedAt = new Date().toISOString();

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: 'bulk.schriftsatz.completed',
      severity: 'info',
      details: `Bulk-Schriftsätze: ${op.completedItems}/${op.totalItems} generiert.`,
    });

    return op;
  }

  /**
   * Bulk status update for multiple matters (open, closed, archived)
   */
  async bulkUpdateMatterStatus(input: BulkStatusUpdateInput): Promise<BulkOperation> {
    const permission = await this.accessControl.evaluate('bulk.execute');
    if (!permission.ok) {
      const op = await this.createBulkOperation({
        workspaceId: input.workspaceId,
        type: 'status-update',
        targetMatterIds: input.matterIds,
        targetClientIds: [],
        totalItems: input.matterIds.length,
      });
      op.status = 'failed';
      op.errorMessage = `Berechtigung verweigert: ${permission.message}`;
      return op;
    }

    const op = await this.createBulkOperation({
      workspaceId: input.workspaceId,
      type: 'status-update',
      targetMatterIds: input.matterIds,
      targetClientIds: [],
      totalItems: input.matterIds.length,
    });
    op.status = 'running';

    const graph = await this.orchestration.getGraph();

    for (let i = 0; i < input.matterIds.length; i++) {
      const matterId = input.matterIds[i];
      try {
        const matter = graph.matters?.[matterId];
        if (!matter) {
          op.failedItems++;
          op.results.push({ targetId: matterId, success: false, message: 'Akte nicht gefunden' });
        } else if (input.newStatus === 'archived') {
          const result = await this.orchestration.archiveMatter(matterId);
          op.results.push({
            targetId: matterId,
            success: !!result,
            message: result ? `Akte archiviert: ${result.title}` : 'Archivierung fehlgeschlagen',
          });
          if (result) op.completedItems++;
          else op.failedItems++;
        } else {
          await this.orchestration.upsertMatter({ ...matter, status: input.newStatus });
          op.results.push({
            targetId: matterId,
            success: true,
            message: `"${matter.title}" → ${input.newStatus}`,
          });
          op.completedItems++;
        }
      } catch (error) {
        op.failedItems++;
        op.results.push({
          targetId: matterId,
          success: false,
          message: error instanceof Error ? error.message : 'Status-Update fehlgeschlagen',
        });
      }

      op.progress = Math.round(((i + 1) / input.matterIds.length) * 100);
      op.updatedAt = new Date().toISOString();
    }

    op.status = op.failedItems === 0 ? 'completed'
      : op.completedItems === 0 ? 'failed'
      : 'partial';
    op.updatedAt = new Date().toISOString();

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: 'bulk.status-update.completed',
      severity: op.failedItems > 0 ? 'warning' : 'info',
      details: `Bulk-Status-Update auf '${input.newStatus}': ${op.completedItems}/${op.totalItems} erfolgreich.`,
    });

    return op;
  }

  /**
   * Bulk PDF export for all indexed documents across multiple matters
   */
  async bulkPdfExport(input: BulkPdfExportInput): Promise<BulkOperation> {
    const permission = await this.accessControl.evaluate('bulk.execute');
    if (!permission.ok) {
      const op = await this.createBulkOperation({
        workspaceId: input.workspaceId,
        type: 'pdf-export',
        targetMatterIds: input.matterIds,
        targetClientIds: [],
        totalItems: input.matterIds.length,
      });
      op.status = 'failed';
      op.errorMessage = `Berechtigung verweigert: ${permission.message}`;
      return op;
    }

    const docs = input.documents;

    const op = await this.createBulkOperation({
      workspaceId: input.workspaceId,
      type: 'pdf-export',
      targetMatterIds: input.matterIds,
      targetClientIds: [],
      totalItems: docs.length,
    });
    op.status = 'running';

    if (docs.length === 0) {
      op.status = 'completed';
      op.updatedAt = new Date().toISOString();
      return op;
    }

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      try {
        // Browser-side: trigger HTML download (PDF via print dialog)
        if (typeof window !== 'undefined') {
          const blob = new Blob(
            [`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title></head><body><pre>${doc.markdown}</pre></body></html>`],
            { type: 'text/html' }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.html`;
          a.click();
          URL.revokeObjectURL(url);
        }
        op.results.push({
          targetId: doc.id,
          success: true,
          message: `HTML-Export: ${doc.title}`,
          outputRef: doc.id,
        });
        op.completedItems++;
      } catch (error) {
        op.failedItems++;
        op.results.push({
          targetId: doc.id,
          success: false,
          message: error instanceof Error ? error.message : 'Export fehlgeschlagen',
        });
      }

      op.progress = Math.round(((i + 1) / docs.length) * 100);
      op.updatedAt = new Date().toISOString();
    }

    op.status = op.failedItems === 0 ? 'completed'
      : op.completedItems === 0 ? 'failed'
      : 'partial';
    op.updatedAt = new Date().toISOString();

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: 'bulk.pdf-export.completed',
      severity: op.failedItems > 0 ? 'warning' : 'info',
      details: `Bulk-PDF-Export: ${op.completedItems}/${op.totalItems} Dokumente exportiert.`,
    });

    return op;
  }

  /**
   * Generate Mandantenbriefe for all clients in given matters.
   * Reads graph directly for consistent, up-to-date client resolution (like bulkGenerateSchriftsaetze).
   */
  async bulkGenerateMandantenbriefe(input: {
    workspaceId: string;
    matterIds: string[];
    anwalt?: string;
    kanzlei?: string;
    logoDataUrl?: string;
    sachverhalt?: string;
  }): Promise<BulkOperation> {
    const graph = await this.orchestration.getGraph();

    const graphMatters = Object.values(graph.matters ?? {}).filter(
      m => input.matterIds.includes(m.id)
    );
    const graphClients = Object.values(graph.clients ?? {}).filter(c => !c.archived);

    const matterClientMap = this.resolveClientsForMatters(graphMatters, graphClients);

    const allClientIds: string[] = [];
    for (const clients of matterClientMap.values()) {
      for (const c of clients) {
        if (!allClientIds.includes(c.id)) allClientIds.push(c.id);
      }
    }

    const op = await this.createBulkOperation({
      workspaceId: input.workspaceId,
      type: 'mandantenbrief',
      targetMatterIds: input.matterIds,
      targetClientIds: allClientIds,
      totalItems: allClientIds.length,
    });
    op.status = 'running';

    let idx = 0;
    for (const [_matterId, clients] of matterClientMap.entries()) {
      for (const client of clients) {
        try {
          const doc = this.documentGenerator.generate({
            template: 'mandantenbrief',
            parties: {
              mandant: client.displayName,
              anwalt: input.anwalt,
              kanzlei: input.kanzlei,
              logoDataUrl: input.logoDataUrl,
            },
            sachverhalt: input.sachverhalt,
          });

          op.results.push({
            targetId: client.id,
            success: true,
            message: `Mandantenbrief für ${client.displayName} generiert`,
            outputRef: doc.id,
          });
          op.completedItems++;
        } catch (error) {
          op.failedItems++;
          op.results.push({
            targetId: client.id,
            success: false,
            message: error instanceof Error ? error.message : 'Brief-Generierung fehlgeschlagen',
          });
        }

        idx++;
        op.progress = Math.round((idx / allClientIds.length) * 100);
        op.updatedAt = new Date().toISOString();
      }
    }

    op.status = op.failedItems === 0 ? 'completed'
      : op.completedItems === 0 ? 'failed'
      : 'partial';
    op.updatedAt = new Date().toISOString();

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: 'bulk.mandantenbrief.completed',
      severity: 'info',
      details: `Bulk-Mandantenbriefe: ${op.completedItems}/${op.totalItems} generiert für ${input.matterIds.length} Akten.`,
    });

    return op;
  }
}
