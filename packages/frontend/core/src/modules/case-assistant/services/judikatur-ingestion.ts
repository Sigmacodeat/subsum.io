import { Service } from '@toeverything/infra';

import type { CourtDecision, LegalNormRegistryRecord } from '../types';
import type {BghCrawlerService } from './bgh-crawler';
import { type BghCrawlerSearchParams } from './bgh-crawler';
import type {HudocCrawlerService } from './hudoc-crawler';
import { type HudocCrawlerSearchParams } from './hudoc-crawler';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type {RisCrawlerService } from './ris-crawler';
import { type RisCrawlerSearchParams } from './ris-crawler';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function toTitleCase(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return normalized;
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export interface ImportRisDecisionInput {
  workspaceId: string;
  caseId?: string;
  businessNumber: string;
}

export interface ImportRisDecisionsBatchInput {
  workspaceId: string;
  caseId?: string;
  fromDate?: string;
  toDate?: string;
  maxResults?: number;
}

export interface ImportBghDecisionInput {
  workspaceId: string;
  caseId?: string;
  fileNumber: string;
}

export interface ImportBghDecisionsBatchInput {
  workspaceId: string;
  caseId?: string;
  fromDate?: string;
  toDate?: string;
  maxResults?: number;
}

export interface ImportEchrDecisionInput {
  workspaceId: string;
  caseId?: string;
  applicationNumber: string;
}

export interface ImportEchrDecisionsBatchInput {
  workspaceId: string;
  caseId?: string;
  query?: string;
  respondentState?: string;
  fromDate?: string;
  toDate?: string;
  maxResults?: number;
}

export class JudikaturIngestionService extends Service {
  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly risCrawler: RisCrawlerService,
    private readonly bghCrawler: BghCrawlerService,
    private readonly hudocCrawler: HudocCrawlerService
  ) {
    super();
  }

  private buildNormRegistryRecordsFromDecision(decision: CourtDecision) {
    const now = new Date().toISOString();
    const seen = new Set<string>();

    const records: LegalNormRegistryRecord[] = [];
    for (const item of decision.referencedNorms) {
      const key = `${item.jurisdiction}:${item.law}:${item.paragraph}`.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      records.push({
        id: `norm-registry:${key}`,
        jurisdiction: item.jurisdiction,
        law: item.law,
        paragraph: item.paragraph,
        title: `${item.law} ${item.paragraph}`,
        shortDescription: `Automatisch aus Judikatur referenzierte Norm (${decision.fileNumber}).`,
        legalAreas: decision.legalAreas,
        keywords: [
          item.law.toLowerCase(),
          item.paragraph.toLowerCase(),
          ...decision.keywords.slice(0, 5),
        ],
        leadingCaseIds: decision.isLeadingCase ? [decision.id] : [],
        recentCaseIds: [decision.id],
        sourceUrl: decision.sourceUrl,
        importedAt: now,
        updatedAt: now,
      });
    }

    return records;
  }

  private async persistDecision(params: {
    workspaceId: string;
    caseId?: string;
    decision: CourtDecision;
  }) {
    await this.orchestration.upsertCourtDecision(params.decision);

    const normRecords = this.buildNormRegistryRecordsFromDecision(params.decision);
    for (const record of normRecords) {
      await this.orchestration.upsertLegalNormRegistryRecord(record);
    }

    await this.orchestration.appendAuditEntry({
      workspaceId: params.workspaceId,
      caseId: params.caseId,
      action: 'judikatur.imported',
      severity: 'info',
      details: `Judikatur importiert: ${params.decision.court} ${params.decision.fileNumber}.`,
      metadata: {
        decisionId: params.decision.id,
        sourceDatabase: params.decision.sourceDatabase,
        legalAreas: params.decision.legalAreas.join(','),
        normReferenceCount: String(params.decision.referencedNorms.length),
      },
    });

    return {
      decision: params.decision,
      normRecords,
    };
  }

  async importRisDecisionByBusinessNumber(input: ImportRisDecisionInput) {
    const decision = await this.risCrawler.fetchDecisionByBusinessNumber(input.businessNumber);
    if (!decision) {
      await this.orchestration.appendAuditEntry({
        workspaceId: input.workspaceId,
        caseId: input.caseId,
        action: 'judikatur.import.not_found',
        severity: 'warning',
        details: `Keine RIS-Entscheidung für GZ '${input.businessNumber}' gefunden.`,
      });
      return null;
    }

    return await this.persistDecision({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      decision,
    });
  }

  async importRisDecisionByUrl(input: {
    workspaceId: string;
    caseId?: string;
    url: string;
    fallbackBusinessNumber?: string;
  }) {
    const decision = await this.risCrawler.fetchDecisionByUrl(
      input.url,
      input.fallbackBusinessNumber
    );

    return await this.persistDecision({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      decision,
    });
  }

  async importRecentRisDecisions(input: ImportRisDecisionsBatchInput) {
    const crawlerParams: RisCrawlerSearchParams = {
      fromDate: input.fromDate,
      toDate: input.toDate,
      maxResults: input.maxResults ?? 25,
    };

    const decisions = await this.risCrawler.fetchRecentDecisions(crawlerParams);
    const imported: CourtDecision[] = [];
    let skipped = 0;

    for (const decision of decisions) {
      try {
        await this.persistDecision({
          workspaceId: input.workspaceId,
          caseId: input.caseId,
          decision,
        });
        imported.push(decision);
      } catch {
        skipped++;
      }
    }

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      action: 'judikatur.import.batch.completed',
      severity: skipped > 0 ? 'warning' : 'info',
      details:
        `RIS Batch-Import abgeschlossen: ${imported.length} importiert, ${skipped} übersprungen. ` +
        `Zeitraum: ${toTitleCase(input.fromDate ?? 'offen')} bis ${toTitleCase(input.toDate ?? 'heute')}.`,
      metadata: {
        importedCount: String(imported.length),
        skippedCount: String(skipped),
      },
    });

    return {
      batchId: createId('judikatur-batch'),
      imported,
      skipped,
      completedAt: new Date().toISOString(),
    };
  }

  async importBghDecisionByFileNumber(input: ImportBghDecisionInput) {
    const decision = await this.bghCrawler.fetchDecisionByFileNumber(input.fileNumber);
    if (!decision) {
      await this.orchestration.appendAuditEntry({
        workspaceId: input.workspaceId,
        caseId: input.caseId,
        action: 'judikatur.import.not_found',
        severity: 'warning',
        details: `Keine BGH-Entscheidung für Az. '${input.fileNumber}' gefunden.`,
      });
      return null;
    }

    return await this.persistDecision({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      decision,
    });
  }

  async importBghDecisionByUrl(input: {
    workspaceId: string;
    caseId?: string;
    url: string;
    fallbackFileNumber?: string;
  }) {
    const decision = await this.bghCrawler.fetchDecisionByUrl(
      input.url,
      input.fallbackFileNumber
    );

    return await this.persistDecision({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      decision,
    });
  }

  async importRecentBghDecisions(input: ImportBghDecisionsBatchInput) {
    const crawlerParams: BghCrawlerSearchParams = {
      fromDate: input.fromDate,
      toDate: input.toDate,
      maxResults: input.maxResults ?? 25,
    };

    const decisions = await this.bghCrawler.fetchRecentDecisions(crawlerParams);
    const imported: CourtDecision[] = [];
    let skipped = 0;

    for (const decision of decisions) {
      try {
        await this.persistDecision({
          workspaceId: input.workspaceId,
          caseId: input.caseId,
          decision,
        });
        imported.push(decision);
      } catch {
        skipped++;
      }
    }

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      action: 'judikatur.import.batch.completed',
      severity: skipped > 0 ? 'warning' : 'info',
      details:
        `BGH Batch-Import abgeschlossen: ${imported.length} importiert, ${skipped} übersprungen. ` +
        `Zeitraum: ${toTitleCase(input.fromDate ?? 'offen')} bis ${toTitleCase(input.toDate ?? 'heute')}.`,
      metadata: {
        importedCount: String(imported.length),
        skippedCount: String(skipped),
      },
    });

    return {
      batchId: createId('judikatur-batch'),
      imported,
      skipped,
      completedAt: new Date().toISOString(),
    };
  }

  async importEchrDecisionByApplicationNumber(input: ImportEchrDecisionInput) {
    const decision = await this.hudocCrawler.fetchDecisionByApplicationNumber(
      input.applicationNumber
    );
    if (!decision) {
      await this.orchestration.appendAuditEntry({
        workspaceId: input.workspaceId,
        caseId: input.caseId,
        action: 'judikatur.import.not_found',
        severity: 'warning',
        details: `Keine EGMR-Entscheidung für Beschwerde-Nr. '${input.applicationNumber}' gefunden.`,
      });
      return null;
    }

    return await this.persistDecision({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      decision,
    });
  }

  async importRecentEchrDecisions(input: ImportEchrDecisionsBatchInput) {
    const crawlerParams: HudocCrawlerSearchParams = {
      query: input.query,
      respondentState: input.respondentState,
      fromDate: input.fromDate,
      toDate: input.toDate,
      maxResults: input.maxResults ?? 25,
    };

    const decisions = await this.hudocCrawler.fetchRecentDecisions(crawlerParams);
    const imported: CourtDecision[] = [];
    let skipped = 0;

    for (const decision of decisions) {
      try {
        await this.persistDecision({
          workspaceId: input.workspaceId,
          caseId: input.caseId,
          decision,
        });
        imported.push(decision);
      } catch {
        skipped++;
      }
    }

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      action: 'judikatur.import.batch.completed',
      severity: skipped > 0 ? 'warning' : 'info',
      details:
        `EGMR Batch-Import abgeschlossen: ${imported.length} importiert, ${skipped} übersprungen. ` +
        `Zeitraum: ${toTitleCase(input.fromDate ?? 'offen')} bis ${toTitleCase(input.toDate ?? 'heute')}.`,
      metadata: {
        importedCount: String(imported.length),
        skippedCount: String(skipped),
      },
    });

    return {
      batchId: createId('judikatur-batch'),
      imported,
      skipped,
      completedAt: new Date().toISOString(),
    };
  }
}
