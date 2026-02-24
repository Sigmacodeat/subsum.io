import { Service } from '@toeverything/infra';

import type { CasePlatformOrchestrationService } from './platform-orchestration';

export type AuditExportFormat = 'json' | 'csv';

export interface AuditExportBundle {
  format: AuditExportFormat;
  fileName: string;
  mimeType: string;
  content: string;
  entryCount: number;
  exportedAt: string;
  chainHead: string;
  draftGovernance?: DraftGovernanceSnapshot;
}

export interface AuditVerificationResult {
  ok: boolean;
  scopeId: string;
  chainHead: string;
  entryCount: number;
  anchorEntryCount: number;
  anchorExportedAt?: string;
  message: string;
  draftGovernance?: DraftGovernanceSnapshot;
}

export interface DraftGovernanceSnapshot {
  strictFlowOk: boolean;
  requestedHashCount: number;
  approvedHashCount: number;
  appliedHashCount: number;
  orphanAppliedHashes: string[];
  orphanApprovedHashes: string[];
  latestRequestedHash?: string;
  latestApprovedHash?: string;
  latestAppliedHash?: string;
  latestRequesterRole?: string;
  latestApproverRole?: string;
  latestReviewerFingerprint?: string;
  latestReviewNote?: string;
}

type HashedAuditEntry = {
  id: string;
  caseId?: string;
  workspaceId: string;
  action: string;
  severity: 'info' | 'warning' | 'error';
  details: string;
  metadata?: Record<string, string>;
  createdAt: string;
  previousHash: string;
  chainHash: string;
};

function normalizeForHash(entry: {
  id: string;
  caseId?: string;
  workspaceId: string;
  action: string;
  severity: 'info' | 'warning' | 'error';
  details: string;
  metadata?: Record<string, string>;
  createdAt: string;
}) {
  return JSON.stringify({
    id: entry.id,
    caseId: entry.caseId ?? null,
    workspaceId: entry.workspaceId,
    action: entry.action,
    severity: entry.severity,
    details: entry.details,
    metadata: entry.metadata ?? null,
    createdAt: entry.createdAt,
  });
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export class CaseAuditExportService extends Service {
  constructor(
    private readonly orchestrationService: CasePlatformOrchestrationService
  ) {
    super();
  }

  private async sha256(value: string) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      throw new Error('Crypto API ist nicht verfügbar. Audit-Export kann nicht signiert werden.');
    }
    const bytes = new TextEncoder().encode(value);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async withHashChain(
    entries: Array<{
      id: string;
      caseId?: string;
      workspaceId: string;
      action: string;
      severity: 'info' | 'warning' | 'error';
      details: string;
      metadata?: Record<string, string>;
      createdAt: string;
    }>
  ) {
    const sorted = [...entries].sort((a, b) => {
      if (a.createdAt === b.createdAt) {
        return a.id.localeCompare(b.id);
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    const result: HashedAuditEntry[] = [];
    let previousHash = 'GENESIS';

    for (const entry of sorted) {
      const canonical = normalizeForHash(entry);
      const chainHash = await this.sha256(`${previousHash}:${canonical}`);
      result.push({
        ...entry,
        previousHash,
        chainHash,
      });
      previousHash = chainHash;
    }

    return {
      entries: result,
      chainHead: previousHash,
    };
  }

  private scopeId(workspaceId: string, caseId?: string) {
    return `${workspaceId}:${caseId ?? '*'}`;
  }

  private latestByAction(
    entries: Array<{
      action: string;
      metadata?: Record<string, string>;
      createdAt: string;
    }>,
    action: string
  ) {
    return entries
      .filter(entry => entry.action === action)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  private extractDraftGovernance(
    entries: Array<{
      action: string;
      metadata?: Record<string, string>;
      createdAt: string;
    }>
  ): DraftGovernanceSnapshot {
    const requestedEntries = entries.filter(
      entry => entry.action === 'copilot.draft.review_requested'
    );
    const approvedEntries = entries.filter(
      entry => entry.action === 'copilot.draft.approved'
    );
    const appliedEntries = entries.filter(
      entry => entry.action === 'copilot.draft.applied'
    );

    const requestedHashes = new Set(
      requestedEntries
        .map(entry => entry.metadata?.requestedDraftHash?.trim())
        .filter((value): value is string => !!value)
    );
    const approvedHashes = new Set(
      approvedEntries
        .map(entry => entry.metadata?.approvedDraftHash?.trim())
        .filter((value): value is string => !!value)
    );
    const appliedHashes = new Set(
      appliedEntries
        .map(entry => entry.metadata?.appliedDraftHash?.trim())
        .filter((value): value is string => !!value)
    );

    const orphanAppliedHashes = [...appliedHashes].filter(
      hash => !approvedHashes.has(hash)
    );
    const orphanApprovedHashes = [...approvedHashes].filter(
      hash => !requestedHashes.has(hash)
    );

    const latestRequested = this.latestByAction(entries, 'copilot.draft.review_requested');
    const latestApproved = this.latestByAction(entries, 'copilot.draft.approved');
    const latestApplied = this.latestByAction(entries, 'copilot.draft.applied');

    return {
      strictFlowOk:
        orphanAppliedHashes.length === 0 && orphanApprovedHashes.length === 0,
      requestedHashCount: requestedHashes.size,
      approvedHashCount: approvedHashes.size,
      appliedHashCount: appliedHashes.size,
      orphanAppliedHashes,
      orphanApprovedHashes,
      latestRequestedHash: latestRequested?.metadata?.requestedDraftHash,
      latestApprovedHash: latestApproved?.metadata?.approvedDraftHash,
      latestAppliedHash: latestApplied?.metadata?.appliedDraftHash,
      latestRequesterRole: latestRequested?.metadata?.requestedByRole,
      latestApproverRole: latestApproved?.metadata?.approvedByRole,
      latestReviewerFingerprint: latestApproved?.metadata?.reviewerFingerprint,
      latestReviewNote: latestApproved?.metadata?.reviewNote,
    };
  }

  private scopedAuditEntries(input: { workspaceId: string; caseId?: string }) {
    const allEntries = this.orchestrationService.auditEntries$.value ?? [];
    return allEntries.filter((entry: (typeof allEntries)[number]) => {
      if (entry.workspaceId !== input.workspaceId) {
        return false;
      }
      if (!input.caseId) {
        return true;
      }
      return entry.caseId === input.caseId;
    });
  }

  async exportAudit(input: {
    workspaceId: string;
    caseId?: string;
    format: AuditExportFormat;
  }): Promise<AuditExportBundle | null> {
    const permission = await this.orchestrationService.evaluatePermission('audit.export');
    if (!permission.ok) {
      await this.orchestrationService.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'audit.export.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const filtered = this.scopedAuditEntries(input);

    const { entries, chainHead } = await this.withHashChain(filtered);
    const draftGovernance = this.extractDraftGovernance(entries);
    const exportedAt = new Date().toISOString();
    const scopeLabel = input.caseId ? `case-${input.caseId}` : 'workspace';
    const scopeId = this.scopeId(input.workspaceId, input.caseId);

    await this.orchestrationService.upsertAuditAnchor({
      scopeId,
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      entryCount: entries.length,
      chainHead,
      exportedAt,
    });

    if (input.format === 'json') {
      const payload = {
        version: 1,
        workspaceId: input.workspaceId,
        caseId: input.caseId ?? null,
        exportedAt,
        chainHead,
        entryCount: entries.length,
        draftGovernance,
        entries,
      };

      await this.orchestrationService.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'audit.exported',
        severity: 'info',
        details: `Audit-Export erstellt (${entries.length} Einträge, format=json).`,
      });

      return {
        format: 'json',
        fileName: `legal-ops-copilot-audit-${scopeLabel}-${exportedAt}.json`,
        mimeType: 'application/json',
        content: JSON.stringify(payload, null, 2),
        entryCount: entries.length,
        exportedAt,
        chainHead,
        draftGovernance,
      };
    }

    const header = [
      'id',
      'workspaceId',
      'caseId',
      'action',
      'severity',
      'details',
      'createdAt',
      'previousHash',
      'chainHash',
      'metadata',
    ];

    const body = entries.map(entry =>
      [
        entry.id,
        entry.workspaceId,
        entry.caseId ?? '',
        entry.action,
        entry.severity,
        entry.details,
        entry.createdAt,
        entry.previousHash,
        entry.chainHash,
        entry.metadata ? JSON.stringify(entry.metadata) : '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const content = [header.join(','), ...body].join('\n');

    await this.orchestrationService.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'audit.exported',
      severity: 'info',
      details: `Audit-Export erstellt (${entries.length} Einträge, format=csv).`,
    });

    return {
      format: 'csv',
      fileName: `legal-ops-copilot-audit-${scopeLabel}-${exportedAt}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content,
      entryCount: entries.length,
      exportedAt,
      chainHead,
      draftGovernance,
    };
  }

  async verifyAuditChain(input: {
    workspaceId: string;
    caseId?: string;
  }): Promise<AuditVerificationResult | null> {
    const permission = await this.orchestrationService.evaluatePermission('audit.verify');
    if (!permission.ok) {
      await this.orchestrationService.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'audit.verify.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      return null;
    }

    const scopeId = this.scopeId(input.workspaceId, input.caseId);
    const anchor = await this.orchestrationService.getAuditAnchor(scopeId);
    const filtered = this.scopedAuditEntries(input);

    if (!anchor) {
      const message = 'Keine Audit-Verankerung gefunden. Bitte zuerst Audit-Export ausführen.';
      await this.orchestrationService.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'audit.verify.missing_anchor',
        severity: 'warning',
        details: message,
      });
      return {
        ok: false,
        scopeId,
        chainHead: 'GENESIS',
        entryCount: filtered.length,
        anchorEntryCount: 0,
        message,
      };
    }

    const { entries, chainHead } = await this.withHashChain(filtered);
    const draftGovernance = this.extractDraftGovernance(entries);

    if (!draftGovernance.strictFlowOk) {
      const message =
        'Audit-Kette ungültig: Draft-Governance-Flow inkonsistent (requested/approved/applied Hash-Verkettung fehlerhaft).';
      await this.orchestrationService.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'audit.verify.failed',
        severity: 'error',
        details: message,
        metadata: {
          scopeId,
          orphanAppliedHashes: draftGovernance.orphanAppliedHashes.join('|') || '-',
          orphanApprovedHashes: draftGovernance.orphanApprovedHashes.join('|') || '-',
        },
      });
      return {
        ok: false,
        scopeId,
        chainHead,
        entryCount: entries.length,
        anchorEntryCount: anchor.entryCount,
        anchorExportedAt: anchor.exportedAt,
        message,
        draftGovernance,
      };
    }

    if (entries.length < anchor.entryCount) {
      const message = `Audit-Kette ungültig: erwartete mindestens ${anchor.entryCount} Einträge, gefunden ${entries.length}.`;
      await this.orchestrationService.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'audit.verify.failed',
        severity: 'error',
        details: message,
        metadata: {
          scopeId,
          anchorChainHead: anchor.chainHead,
          actualChainHead: chainHead,
        },
      });
      return {
        ok: false,
        scopeId,
        chainHead,
        entryCount: entries.length,
        anchorEntryCount: anchor.entryCount,
        anchorExportedAt: anchor.exportedAt,
        message,
        draftGovernance,
      };
    }

    const anchoredChainHead =
      anchor.entryCount === 0
        ? 'GENESIS'
        : entries[anchor.entryCount - 1]?.chainHash ?? 'GENESIS';

    if (anchoredChainHead !== anchor.chainHead) {
      const message = 'Audit-Kette ungültig: verankerter Chain-Head stimmt nicht überein.';
      await this.orchestrationService.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'audit.verify.failed',
        severity: 'error',
        details: message,
        metadata: {
          scopeId,
          anchorChainHead: anchor.chainHead,
          actualChainHead: anchoredChainHead,
        },
      });
      return {
        ok: false,
        scopeId,
        chainHead,
        entryCount: entries.length,
        anchorEntryCount: anchor.entryCount,
        anchorExportedAt: anchor.exportedAt,
        message,
        draftGovernance,
      };
    }

    const message = `Audit-Kette verifiziert (Anker ${anchor.exportedAt}, ${anchor.entryCount} Einträge).`;
    await this.orchestrationService.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'audit.verify.passed',
      severity: 'info',
      details: message,
      metadata: {
        scopeId,
        anchorChainHead: anchor.chainHead,
        currentChainHead: chainHead,
        draftGovernanceStrict: String(draftGovernance.strictFlowOk),
      },
    });

    return {
      ok: true,
      scopeId,
      chainHead,
      entryCount: entries.length,
      anchorEntryCount: anchor.entryCount,
      anchorExportedAt: anchor.exportedAt,
      message,
      draftGovernance,
    };
  }
}
