import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function assertIsoDate(value: string, field: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} muss ein gültiges Datum sein.`);
  }
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${field} muss eine positive ganze Zahl sein.`);
  }
}

function assertEmail(value: string, field: string) {
  const email = value.trim();
  if (!email || !email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    throw new Error(`${field} muss eine gültige E-Mail-Adresse sein.`);
  }
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeIdList(values?: string[]): string[] {
  if (!values) return [];
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type DSGVORequestType =
  | 'auskunft'          // Art. 15 DSGVO — Right of access
  | 'berichtigung'      // Art. 16 DSGVO — Right to rectification
  | 'loeschung'         // Art. 17 DSGVO — Right to erasure
  | 'einschraenkung'    // Art. 18 DSGVO — Right to restriction
  | 'datenportabilitaet' // Art. 20 DSGVO — Right to data portability
  | 'widerspruch';       // Art. 21 DSGVO — Right to object

export type DSGVORequestStatus =
  | 'received'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'escalated';

export type RetentionCategory =
  | 'mandatsakten'      // 6 Jahre (§ 50 BRAO)
  | 'handakten'         // 6 Jahre (§ 50 BRAO)
  | 'buchhaltung'       // 10 Jahre (§ 147 AO)
  | 'rechnungen'        // 10 Jahre (§ 147 AO)
  | 'korrespondenz'     // 6 Jahre
  | 'vollmachten'       // 6 Jahre nach Mandatsende
  | 'personalakten'     // 3 Jahre nach Ausscheiden
  | 'steuerunterlagen'; // 10 Jahre (§ 147 AO)

export interface DSGVORequest {
  id: string;
  workspaceId: string;
  /** Who made the request (client ID or external) */
  requestorId?: string;
  requestorName: string;
  requestorEmail: string;
  type: DSGVORequestType;
  status: DSGVORequestStatus;
  /** Description of the request */
  description: string;
  /** Legal basis for processing (or retention) */
  legalBasis?: string;
  /** Actions taken */
  actions: Array<{
    action: string;
    performedBy: string;
    performedAt: string;
    details?: string;
  }>;
  /** If rejected, the reason */
  rejectionReason?: string;
  /** Deadline for response (30 days from receipt per DSGVO) */
  responseDeadline: string;
  /** When completed */
  completedAt?: string;
  /** Linked matter IDs affected */
  affectedMatterIds: string[];
  /** Linked client IDs affected */
  affectedClientIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RetentionPolicy {
  id: string;
  workspaceId: string;
  category: RetentionCategory;
  /** Retention period in years */
  retentionYears: number;
  /** Legal basis for retention */
  legalBasis: string;
  /** Description */
  description: string;
  /** Whether automatic deletion is enabled */
  autoDeleteEnabled: boolean;
  /** Grace period after retention expires (days) */
  gracePeriodDays: number;
}

export interface RetentionRecord {
  id: string;
  workspaceId: string;
  /** What is being retained */
  entityType: 'matter' | 'document' | 'client' | 'invoice' | 'time_entry';
  entityId: string;
  entityName: string;
  category: RetentionCategory;
  /** When the retention period started */
  retentionStartDate: string;
  /** When the retention period expires */
  retentionEndDate: string;
  /** Whether it has been reviewed for deletion */
  reviewedForDeletion: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Whether deletion was approved */
  deletionApproved: boolean;
  /** Whether actually deleted */
  deleted: boolean;
  deletedAt?: string;
  /** Reason for keeping beyond retention */
  keepReason?: string;
}

export const DSGVO_REQUEST_TYPE_LABELS: Record<DSGVORequestType, string> = {
  auskunft: 'Auskunftsrecht (Art. 15)',
  berichtigung: 'Berichtigung (Art. 16)',
  loeschung: 'Löschung (Art. 17)',
  einschraenkung: 'Einschränkung (Art. 18)',
  datenportabilitaet: 'Datenportabilität (Art. 20)',
  widerspruch: 'Widerspruch (Art. 21)',
};

export const DSGVO_STATUS_LABELS: Record<DSGVORequestStatus, string> = {
  received: 'Eingegangen',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  rejected: 'Abgelehnt',
  escalated: 'Eskaliert',
};

export const RETENTION_CATEGORY_LABELS: Record<RetentionCategory, string> = {
  mandatsakten: 'Mandatsakten (6 Jahre)',
  handakten: 'Handakten (6 Jahre)',
  buchhaltung: 'Buchhaltungsunterlagen (10 Jahre)',
  rechnungen: 'Rechnungen (10 Jahre)',
  korrespondenz: 'Korrespondenz (6 Jahre)',
  vollmachten: 'Vollmachten (6 Jahre)',
  personalakten: 'Personalakten (3 Jahre)',
  steuerunterlagen: 'Steuerunterlagen (10 Jahre)',
};

const DEFAULT_RETENTION_POLICIES: Omit<RetentionPolicy, 'id' | 'workspaceId'>[] = [
  { category: 'mandatsakten', retentionYears: 6, legalBasis: '§ 50 BRAO', description: 'Mandatsakten nach Mandatsende', autoDeleteEnabled: false, gracePeriodDays: 90 },
  { category: 'handakten', retentionYears: 6, legalBasis: '§ 50 BRAO', description: 'Handakten des Rechtsanwalts', autoDeleteEnabled: false, gracePeriodDays: 90 },
  { category: 'buchhaltung', retentionYears: 10, legalBasis: '§ 147 AO', description: 'Buchungsbelege, Kontoauszüge, Jahresabschlüsse', autoDeleteEnabled: false, gracePeriodDays: 90 },
  { category: 'rechnungen', retentionYears: 10, legalBasis: '§ 147 AO, § 14b UStG', description: 'Ausgangs- und Eingangsrechnungen', autoDeleteEnabled: false, gracePeriodDays: 90 },
  { category: 'korrespondenz', retentionYears: 6, legalBasis: '§ 257 HGB', description: 'Geschäftsbriefe und Korrespondenz', autoDeleteEnabled: false, gracePeriodDays: 60 },
  { category: 'vollmachten', retentionYears: 6, legalBasis: '§ 50 BRAO', description: 'Vollmachten nach Mandatsende', autoDeleteEnabled: false, gracePeriodDays: 60 },
  { category: 'personalakten', retentionYears: 3, legalBasis: '§ 195 BGB', description: 'Personalakten nach Ausscheiden', autoDeleteEnabled: false, gracePeriodDays: 30 },
  { category: 'steuerunterlagen', retentionYears: 10, legalBasis: '§ 147 AO', description: 'Steuerlich relevante Unterlagen', autoDeleteEnabled: false, gracePeriodDays: 90 },
];

/**
 * DSGVOComplianceService — GDPR/DSGVO compliance management.
 *
 * Legal basis:
 * - DSGVO (EU 2016/679) — Datenschutz-Grundverordnung
 * - BDSG — Bundesdatenschutzgesetz (DE)
 * - DSG — Datenschutzgesetz (AT)
 * - § 50 BRAO — Aufbewahrungspflicht Handakten (6 Jahre)
 * - § 147 AO — Aufbewahrungspflicht Buchhaltung (10 Jahre)
 *
 * Features:
 * - DSGVO request management (Art. 15-21)
 * - Retention policies per document category
 * - Automatic retention period tracking
 * - Deletion review workflow
 * - Data portability export
 * - Full audit trail for all DSGVO actions
 */
export class DSGVOComplianceService extends Service {
  private requestsMap$ = new BehaviorSubject<Record<string, DSGVORequest>>({});
  private policiesMap$ = new BehaviorSubject<Record<string, RetentionPolicy>>({});
  private retentionMap$ = new BehaviorSubject<Record<string, RetentionRecord>>({});

  readonly requestsList$ = this.requestsMap$.pipe(map(m => Object.values(m)));
  readonly policiesList$ = this.policiesMap$.pipe(map(m => Object.values(m)));
  readonly retentionList$ = this.retentionMap$.pipe(map(m => Object.values(m)));

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  /**
   * Initialize default retention policies for a workspace
   */
  async initializeDefaultPolicies(workspaceId: string): Promise<RetentionPolicy[]> {
    assertNonEmpty(workspaceId, 'Workspace-ID');

    const existing = Object.values(this.policiesMap$.value).filter(p => p.workspaceId === workspaceId);
    if (existing.length > 0) return existing;

    const policies: RetentionPolicy[] = DEFAULT_RETENTION_POLICIES.map(p => ({
      ...p,
      id: createId('rpol'),
      workspaceId,
    }));

    const updatedMap = { ...this.policiesMap$.value };
    for (const policy of policies) {
      updatedMap[policy.id] = policy;
    }
    this.policiesMap$.next(updatedMap);

    return policies;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DSGVO REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  async createRequest(input: {
    workspaceId: string;
    requestorName: string;
    requestorEmail: string;
    requestorId?: string;
    type: DSGVORequestType;
    description: string;
    affectedMatterIds?: string[];
    affectedClientIds?: string[];
  }): Promise<DSGVORequest> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.requestorName, 'Anfragesteller');
    assertEmail(input.requestorEmail, 'Anfragesteller E-Mail');
    assertNonEmpty(input.description, 'Beschreibung');

    const now = new Date();
    const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const request: DSGVORequest = {
      id: createId('dsgvo'),
      workspaceId: input.workspaceId,
      requestorId: normalizeOptionalString(input.requestorId),
      requestorName: input.requestorName.trim(),
      requestorEmail: input.requestorEmail.trim(),
      type: input.type,
      status: 'received',
      description: input.description.trim(),
      actions: [{
        action: 'Anfrage eingegangen',
        performedBy: 'system',
        performedAt: now.toISOString(),
      }],
      responseDeadline: deadline.toISOString(),
      affectedMatterIds: normalizeIdList(input.affectedMatterIds),
      affectedClientIds: normalizeIdList(input.affectedClientIds),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.requestsMap$.next({
      ...this.requestsMap$.value,
      [request.id]: request,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: `dsgvo.request.${input.type}`,
      severity: 'warning',
      details: `DSGVO-Anfrage (${DSGVO_REQUEST_TYPE_LABELS[input.type]}) von ${input.requestorName}. Frist: ${deadline.toISOString().split('T')[0]}`,
      metadata: {
        requestType: input.type,
        requestorEmail: input.requestorEmail,
        responseDeadline: deadline.toISOString(),
      },
    });

    return request;
  }

  async addAction(
    requestId: string,
    action: string,
    performedBy: string,
    details?: string
  ): Promise<DSGVORequest | null> {
    assertNonEmpty(requestId, 'DSGVO-Request-ID');
    assertNonEmpty(action, 'Aktion');
    assertNonEmpty(performedBy, 'Bearbeiter');

    const existing = this.requestsMap$.value[requestId];
    if (!existing) return null;

    if (existing.status === 'completed' || existing.status === 'rejected') {
      throw new Error('Für abgeschlossene oder abgelehnte Anfragen können keine Aktionen mehr ergänzt werden.');
    }

    const now = new Date().toISOString();

    const updated: DSGVORequest = {
      ...existing,
      status: 'in_progress',
      actions: [
        ...existing.actions,
        {
          action: action.trim(),
          performedBy: performedBy.trim(),
          performedAt: now,
          details: normalizeOptionalString(details),
        },
      ],
      updatedAt: now,
    };

    this.requestsMap$.next({
      ...this.requestsMap$.value,
      [requestId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: 'dsgvo.request.action_added',
      severity: 'info',
      details: `DSGVO-Aktion ergänzt: ${action.trim()} (${existing.requestorName})`,
      metadata: { requestId, status: updated.status },
    });

    return updated;
  }

  async completeRequest(requestId: string, performedBy: string): Promise<DSGVORequest | null> {
    assertNonEmpty(requestId, 'DSGVO-Request-ID');
    assertNonEmpty(performedBy, 'Bearbeiter');

    const existing = this.requestsMap$.value[requestId];
    if (!existing) return null;

    if (existing.status === 'completed') {
      return existing;
    }
    if (existing.status === 'rejected') {
      throw new Error('Abgelehnte Anfragen können nicht abgeschlossen werden.');
    }

    const now = new Date().toISOString();

    const updated: DSGVORequest = {
      ...existing,
      status: 'completed',
      completedAt: now,
      actions: [
        ...existing.actions,
        { action: 'Anfrage abgeschlossen', performedBy: performedBy.trim(), performedAt: now },
      ],
      updatedAt: now,
    };

    this.requestsMap$.next({
      ...this.requestsMap$.value,
      [requestId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: 'dsgvo.request.completed',
      severity: 'info',
      details: `DSGVO-Anfrage abgeschlossen: ${DSGVO_REQUEST_TYPE_LABELS[existing.type]} für ${existing.requestorName}`,
      metadata: { requestId },
    });

    return updated;
  }

  async rejectRequest(requestId: string, reason: string, performedBy: string): Promise<DSGVORequest | null> {
    assertNonEmpty(requestId, 'DSGVO-Request-ID');
    assertNonEmpty(reason, 'Ablehnungsgrund');
    assertNonEmpty(performedBy, 'Bearbeiter');

    const existing = this.requestsMap$.value[requestId];
    if (!existing) return null;

    if (existing.status === 'completed') {
      throw new Error('Abgeschlossene Anfragen können nicht abgelehnt werden.');
    }

    const now = new Date().toISOString();

    const updated: DSGVORequest = {
      ...existing,
      status: 'rejected',
      rejectionReason: reason.trim(),
      actions: [
        ...existing.actions,
        { action: `Abgelehnt: ${reason.trim()}`, performedBy: performedBy.trim(), performedAt: now },
      ],
      updatedAt: now,
    };

    this.requestsMap$.next({
      ...this.requestsMap$.value,
      [requestId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: 'dsgvo.request.rejected',
      severity: 'warning',
      details: `DSGVO-Anfrage abgelehnt: ${DSGVO_REQUEST_TYPE_LABELS[existing.type]} für ${existing.requestorName}`,
      metadata: { requestId, reason: reason.trim() },
    });

    return updated;
  }

  getOverdueRequests(): DSGVORequest[] {
    const now = new Date().toISOString();
    return Object.values(this.requestsMap$.value).filter(
      r => (r.status === 'received' || r.status === 'in_progress') && r.responseDeadline < now
    );
  }

  getOpenRequests(): DSGVORequest[] {
    return Object.values(this.requestsMap$.value).filter(
      r => r.status === 'received' || r.status === 'in_progress'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETENTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async trackRetention(input: {
    workspaceId: string;
    entityType: RetentionRecord['entityType'];
    entityId: string;
    entityName: string;
    category: RetentionCategory;
    retentionStartDate: string;
  }): Promise<RetentionRecord> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.entityId, 'Entity-ID');
    assertNonEmpty(input.entityName, 'Entity-Name');
    assertIsoDate(input.retentionStartDate, 'Aufbewahrungsstart');

    const policy = Object.values(this.policiesMap$.value).find(
      p => p.workspaceId === input.workspaceId && p.category === input.category
    );

    const retentionYears = policy?.retentionYears ?? 6;
    const startDate = new Date(input.retentionStartDate);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + retentionYears);

    const record: RetentionRecord = {
      id: createId('ret'),
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName,
      category: input.category,
      retentionStartDate: input.retentionStartDate,
      retentionEndDate: endDate.toISOString(),
      reviewedForDeletion: false,
      deletionApproved: false,
      deleted: false,
    };

    this.retentionMap$.next({
      ...this.retentionMap$.value,
      [record.id]: record,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: 'retention.tracked',
      severity: 'info',
      details: `Aufbewahrung erfasst: ${input.entityName} (${RETENTION_CATEGORY_LABELS[input.category]})`,
      metadata: {
        retentionId: record.id,
        entityId: input.entityId,
        category: input.category,
      },
    });

    return record;
  }

  getExpiredRetentions(): RetentionRecord[] {
    const now = new Date().toISOString();
    return Object.values(this.retentionMap$.value).filter(
      r => !r.deleted && r.retentionEndDate < now
    );
  }

  getRetentionsExpiringSoon(days: number = 90): RetentionRecord[] {
    assertPositiveInteger(days, 'Tage');

    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    return Object.values(this.retentionMap$.value).filter(
      r => !r.deleted && r.retentionEndDate > now.toISOString() && r.retentionEndDate <= threshold
    );
  }

  async reviewForDeletion(
    retentionId: string,
    reviewedBy: string,
    approve: boolean,
    keepReason?: string
  ): Promise<RetentionRecord | null> {
    assertNonEmpty(retentionId, 'Retention-ID');
    assertNonEmpty(reviewedBy, 'Prüfer');

    const existing = this.retentionMap$.value[retentionId];
    if (!existing) return null;

    if (existing.deleted) {
      throw new Error('Gelöschte Einträge können nicht erneut geprüft werden.');
    }
    if (!approve) {
      assertNonEmpty(keepReason ?? '', 'Begründung zur Aufbewahrung');
    }

    const now = new Date().toISOString();

    const updated: RetentionRecord = {
      ...existing,
      reviewedForDeletion: true,
      reviewedAt: now,
      reviewedBy: reviewedBy.trim(),
      deletionApproved: approve,
      keepReason: approve ? undefined : keepReason?.trim(),
    };

    this.retentionMap$.next({
      ...this.retentionMap$.value,
      [retentionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: approve ? 'retention.deletion_approved' : 'retention.deletion_denied',
      severity: approve ? 'warning' : 'info',
      details: `Löschung ${approve ? 'GENEHMIGT' : 'ABGELEHNT'}: ${existing.entityName} (${RETENTION_CATEGORY_LABELS[existing.category]})`,
      metadata: {
        entityId: existing.entityId,
        entityType: existing.entityType,
        category: existing.category,
      },
    });

    return updated;
  }

  async markAsDeleted(retentionId: string): Promise<RetentionRecord | null> {
    assertNonEmpty(retentionId, 'Retention-ID');

    const existing = this.retentionMap$.value[retentionId];
    if (!existing) return null;

    if (existing.deleted) {
      return existing;
    }
    if (!existing.reviewedForDeletion) {
      throw new Error('Löschung muss erst geprüft werden.');
    }

    if (!existing.deletionApproved) {
      throw new Error('Löschung muss erst genehmigt werden.');
    }

    const updated: RetentionRecord = {
      ...existing,
      deleted: true,
      deletedAt: new Date().toISOString(),
    };

    this.retentionMap$.next({
      ...this.retentionMap$.value,
      [retentionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: 'retention.deleted',
      severity: 'warning',
      details: `Retention-Eintrag als gelöscht markiert: ${existing.entityName}`,
      metadata: {
        retentionId,
        entityId: existing.entityId,
        category: existing.category,
      },
    });

    return updated;
  }

  getDashboardStats(): {
    openRequests: number;
    overdueRequests: number;
    expiredRetentions: number;
    expiringSoon: number;
    pendingDeletion: number;
    totalRetentionRecords: number;
  } {
    return {
      openRequests: this.getOpenRequests().length,
      overdueRequests: this.getOverdueRequests().length,
      expiredRetentions: this.getExpiredRetentions().length,
      expiringSoon: this.getRetentionsExpiringSoon().length,
      pendingDeletion: Object.values(this.retentionMap$.value).filter(r => r.deletionApproved && !r.deleted).length,
      totalRetentionRecords: Object.values(this.retentionMap$.value).length,
    };
  }
}
