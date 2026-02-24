import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CasePriority } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type FristenKontrolleStatus =
  | 'pending_first_check'
  | 'first_check_done'
  | 'pending_second_check'
  | 'approved'
  | 'rejected'
  | 'escalated';

export interface FristenKontrolleRecord {
  id: string;
  workspaceId: string;
  deadlineId: string;
  matterId: string;
  caseId: string;
  /** Deadline title for display */
  deadlineTitle: string;
  dueAt: string;
  priority: CasePriority;
  status: FristenKontrolleStatus;
  /** First checker (e.g., Rechtsanwaltsfachangestellte) */
  firstCheckerId?: string;
  firstCheckerName?: string;
  firstCheckedAt?: string;
  firstCheckNote?: string;
  /** Second checker (e.g., Rechtsanwalt) — 4-Augen-Prinzip */
  secondCheckerId?: string;
  secondCheckerName?: string;
  secondCheckedAt?: string;
  secondCheckNote?: string;
  /** If rejected, the reason */
  rejectionReason?: string;
  /** If escalated, the reason */
  escalationReason?: string;
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const FRISTENKONTROLLE_STATUS_LABELS: Record<FristenKontrolleStatus, string> = {
  pending_first_check: 'Erste Prüfung ausstehend',
  first_check_done: 'Erste Prüfung erledigt',
  pending_second_check: 'Zweite Prüfung ausstehend',
  approved: 'Geprüft & Freigegeben',
  rejected: 'Abgelehnt',
  escalated: 'Eskaliert',
};

/**
 * FristenkontrolleService — Implements the mandatory 4-Augen-Prinzip
 * (four-eyes principle) for deadline management in German law firms.
 *
 * Legal basis: § 85 Abs. 2 ZPO, BRAO-Berufsordnung
 *
 * Workflow:
 * 1. Frist wird erstellt → automatisch FristenKontrolleRecord mit status 'pending_first_check'
 * 2. Erste Person prüft (z.B. ReFa) → status 'first_check_done' / 'pending_second_check'
 * 3. Zweite Person prüft (z.B. Anwalt) → status 'approved' oder 'rejected'
 * 4. Bei Ablehnung → Korrektur → Neustart
 * 5. Eskalation wenn Frist < 3 Tage und nicht freigegeben
 */
export class FristenkontrolleService extends Service {
  private kontrollenMap$ = new BehaviorSubject<Record<string, FristenKontrolleRecord>>({});

  readonly kontrollenList$ = this.kontrollenMap$.pipe(map(m => Object.values(m)));

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  getKontrolleForDeadline(deadlineId: string): FristenKontrolleRecord | undefined {
    return Object.values(this.kontrollenMap$.value).find(k => k.deadlineId === deadlineId);
  }

  getKontrollenForMatter(matterId: string): FristenKontrolleRecord[] {
    return Object.values(this.kontrollenMap$.value)
      .filter(k => k.matterId === matterId)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  getPendingFirstCheck(): FristenKontrolleRecord[] {
    return Object.values(this.kontrollenMap$.value)
      .filter(k => k.status === 'pending_first_check')
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  getPendingSecondCheck(): FristenKontrolleRecord[] {
    return Object.values(this.kontrollenMap$.value)
      .filter(k => k.status === 'pending_second_check' || k.status === 'first_check_done')
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  getApproved(): FristenKontrolleRecord[] {
    return Object.values(this.kontrollenMap$.value)
      .filter(k => k.status === 'approved');
  }

  getEscalated(): FristenKontrolleRecord[] {
    return Object.values(this.kontrollenMap$.value)
      .filter(k => k.status === 'escalated');
  }

  /**
   * Creates a Fristenkontrolle record for a deadline.
   * Called automatically when a new deadline is created.
   */
  async createKontrolle(input: {
    workspaceId: string;
    deadlineId: string;
    matterId: string;
    caseId: string;
    deadlineTitle: string;
    dueAt: string;
    priority: CasePriority;
  }): Promise<FristenKontrolleRecord> {
    // Check if already exists
    const existing = this.getKontrolleForDeadline(input.deadlineId);
    if (existing) return existing;

    const now = new Date().toISOString();

    const kontrolle: FristenKontrolleRecord = {
      id: createId('fk'),
      workspaceId: input.workspaceId,
      deadlineId: input.deadlineId,
      matterId: input.matterId,
      caseId: input.caseId,
      deadlineTitle: input.deadlineTitle,
      dueAt: input.dueAt,
      priority: input.priority,
      status: 'pending_first_check',
      createdAt: now,
      updatedAt: now,
    };

    this.kontrollenMap$.next({
      ...this.kontrollenMap$.value,
      [kontrolle.id]: kontrolle,
    });

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'fristenkontrolle.created',
      severity: 'info',
      details: `Fristenkontrolle erstellt für: ${input.deadlineTitle} (fällig: ${input.dueAt})`,
      metadata: {
        deadlineId: input.deadlineId,
        priority: input.priority,
      },
    });

    return kontrolle;
  }

  /**
   * First check — typically done by Rechtsanwaltsfachangestellte
   */
  async performFirstCheck(
    kontrolleId: string,
    checkerId: string,
    checkerName: string,
    note?: string
  ): Promise<FristenKontrolleRecord | null> {
    const existing = this.kontrollenMap$.value[kontrolleId];
    if (!existing) return null;

    if (existing.status !== 'pending_first_check') {
      throw new Error(`Erste Prüfung nur im Status 'pending_first_check' möglich. Aktuell: ${existing.status}`);
    }

    const now = new Date().toISOString();

    const updated: FristenKontrolleRecord = {
      ...existing,
      status: 'pending_second_check',
      firstCheckerId: checkerId,
      firstCheckerName: checkerName,
      firstCheckedAt: now,
      firstCheckNote: note,
      updatedAt: now,
    };

    this.kontrollenMap$.next({
      ...this.kontrollenMap$.value,
      [kontrolleId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: 'fristenkontrolle.first_check',
      severity: 'info',
      details: `Erste Fristenkontrolle durch ${checkerName}: ${existing.deadlineTitle}`,
      metadata: {
        checkerId,
        deadlineId: existing.deadlineId,
      },
    });

    return updated;
  }

  /**
   * Second check — typically done by Rechtsanwalt (4-Augen-Prinzip)
   * The second checker MUST be different from the first checker.
   */
  async performSecondCheck(
    kontrolleId: string,
    checkerId: string,
    checkerName: string,
    approved: boolean,
    note?: string
  ): Promise<FristenKontrolleRecord | null> {
    const existing = this.kontrollenMap$.value[kontrolleId];
    if (!existing) return null;

    if (existing.status !== 'pending_second_check' && existing.status !== 'first_check_done') {
      throw new Error(`Zweite Prüfung nur nach erster Prüfung möglich. Aktuell: ${existing.status}`);
    }

    // 4-Augen-Prinzip: Second checker must be different from first
    if (existing.firstCheckerId === checkerId) {
      throw new Error(
        '4-Augen-Prinzip verletzt: Die zweite Prüfung muss von einer anderen Person durchgeführt werden als die erste.'
      );
    }

    const now = new Date().toISOString();

    const updated: FristenKontrolleRecord = {
      ...existing,
      status: approved ? 'approved' : 'rejected',
      secondCheckerId: checkerId,
      secondCheckerName: checkerName,
      secondCheckedAt: now,
      secondCheckNote: note,
      rejectionReason: approved ? undefined : note,
      updatedAt: now,
    };

    this.kontrollenMap$.next({
      ...this.kontrollenMap$.value,
      [kontrolleId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: approved ? 'fristenkontrolle.approved' : 'fristenkontrolle.rejected',
      severity: approved ? 'info' : 'warning',
      details: `Zweite Fristenkontrolle durch ${checkerName}: ${existing.deadlineTitle} — ${approved ? 'FREIGEGEBEN' : 'ABGELEHNT'}`,
      metadata: {
        checkerId,
        deadlineId: existing.deadlineId,
        approved: String(approved),
      },
    });

    return updated;
  }

  /**
   * Escalation — when a deadline is approaching and not yet approved
   */
  async escalate(
    kontrolleId: string,
    reason: string
  ): Promise<FristenKontrolleRecord | null> {
    const existing = this.kontrollenMap$.value[kontrolleId];
    if (!existing) return null;

    if (existing.status === 'approved') {
      return existing; // Already approved, no escalation needed
    }

    const now = new Date().toISOString();

    const updated: FristenKontrolleRecord = {
      ...existing,
      status: 'escalated',
      escalationReason: reason,
      escalatedAt: now,
      updatedAt: now,
    };

    this.kontrollenMap$.next({
      ...this.kontrollenMap$.value,
      [kontrolleId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: 'fristenkontrolle.escalated',
      severity: 'error',
      details: `ESKALATION Fristenkontrolle: ${existing.deadlineTitle} — ${reason}`,
      metadata: {
        deadlineId: existing.deadlineId,
        dueAt: existing.dueAt,
      },
    });

    return updated;
  }

  /**
   * Reset a rejected kontrolle back to pending_first_check
   */
  async resetKontrolle(kontrolleId: string): Promise<FristenKontrolleRecord | null> {
    const existing = this.kontrollenMap$.value[kontrolleId];
    if (!existing) return null;

    const now = new Date().toISOString();

    const updated: FristenKontrolleRecord = {
      ...existing,
      status: 'pending_first_check',
      firstCheckerId: undefined,
      firstCheckerName: undefined,
      firstCheckedAt: undefined,
      firstCheckNote: undefined,
      secondCheckerId: undefined,
      secondCheckerName: undefined,
      secondCheckedAt: undefined,
      secondCheckNote: undefined,
      rejectionReason: undefined,
      escalationReason: undefined,
      escalatedAt: undefined,
      updatedAt: now,
    };

    this.kontrollenMap$.next({
      ...this.kontrollenMap$.value,
      [kontrolleId]: updated,
    });

    return updated;
  }

  /**
   * Auto-escalation check — call periodically.
   * Escalates all unapproved deadlines that are due within `thresholdDays`.
   */
  autoEscalateUrgent(thresholdDays: number = 3): FristenKontrolleRecord[] {
    const threshold = new Date(
      Date.now() + thresholdDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const urgentUnapproved = Object.values(this.kontrollenMap$.value).filter(k => {
      if (k.status === 'approved' || k.status === 'escalated') return false;
      return k.dueAt <= threshold;
    });

    const escalated: FristenKontrolleRecord[] = [];

    for (const kontrolle of urgentUnapproved) {
      const daysUntilDue = Math.ceil(
        (new Date(kontrolle.dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      void this.escalate(
        kontrolle.id,
        `Automatische Eskalation: Frist "${kontrolle.deadlineTitle}" in ${daysUntilDue} Tag(en) fällig, aber noch nicht durch 4-Augen-Prinzip freigegeben.`
      ).then(result => {
        if (result) escalated.push(result);
      });
    }

    return escalated;
  }

  /**
   * Dashboard KPIs for Fristenkontrolle
   */
  getDashboardStats(): {
    pendingFirstCheck: number;
    pendingSecondCheck: number;
    approved: number;
    rejected: number;
    escalated: number;
    total: number;
    approvalRate: number;
  } {
    const all = Object.values(this.kontrollenMap$.value);
    const pendingFirst = all.filter(k => k.status === 'pending_first_check').length;
    const pendingSecond = all.filter(k => k.status === 'pending_second_check' || k.status === 'first_check_done').length;
    const approved = all.filter(k => k.status === 'approved').length;
    const rejected = all.filter(k => k.status === 'rejected').length;
    const escalated = all.filter(k => k.status === 'escalated').length;
    const total = all.length;
    const decided = approved + rejected;

    return {
      pendingFirstCheck: pendingFirst,
      pendingSecondCheck: pendingSecond,
      approved,
      rejected,
      escalated,
      total,
      approvalRate: decided > 0 ? Math.round((approved / decided) * 100) : 0,
    };
  }
}
