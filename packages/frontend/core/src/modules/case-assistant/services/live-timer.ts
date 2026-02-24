import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { TimeEntry } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { TimeTrackingService } from './time-tracking';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface TimerSession {
  id: string;
  workspaceId: string;
  caseId: string;
  matterId: string;
  clientId: string;
  anwaltId: string;
  description: string;
  activityType: TimeEntry['activityType'];
  hourlyRate: number;
  status: TimerStatus;
  /** When the timer was originally started */
  startedAt: string;
  /** When the timer was last resumed (or started) */
  lastResumedAt: string;
  /** Total accumulated time in milliseconds (excluding current running segment) */
  accumulatedMs: number;
  /** When the timer was paused (if paused) */
  pausedAt?: string;
  /** Number of pause/resume cycles */
  pauseCount: number;
  /** History of all segments for audit transparency */
  segments: TimerSegment[];
  /** If converted to a TimeEntry */
  timeEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimerSegment {
  startedAt: string;
  stoppedAt?: string;
  durationMs: number;
}

export interface ActiveTimerSnapshot {
  session: TimerSession;
  currentElapsedMs: number;
  totalElapsedMs: number;
  formattedTime: string;
  currentAmount: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * LiveTimerService — Start/Stop/Pause Zeiterfassung mit Live-Tracking
 *
 * Features:
 * - Start/Pause/Resume/Stop Timer pro Akte
 * - Nur ein aktiver Timer gleichzeitig (pro Anwalt)
 * - Segment-basiertes Tracking (jede Pause/Resume wird aufgezeichnet)
 * - Automatische Umwandlung in TimeEntry beim Stoppen
 * - Live-Elapsed-Time Berechnung (für UI-Ticker)
 * - Hourly-Rate-basierte Echtzeit-Kostenberechnung
 * - Auto-Stop nach konfigurierbarem Maximum (z.B. 12h)
 * - Audit-Trail für alle Timer-Aktionen
 */
export class LiveTimerService extends Service {
  private sessionsMap$ = new BehaviorSubject<Record<string, TimerSession>>({});
  private ticker: ReturnType<typeof setInterval> | null = null;
  private tickSubject$ = new BehaviorSubject<number>(Date.now());
  private autoStopMaxMs = 12 * 60 * 60 * 1000; // 12 hours default

  readonly sessionsList$ = this.sessionsMap$.pipe(map(m => Object.values(m)));
  readonly tick$ = this.tickSubject$.asObservable();

  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly timeTracking: TimeTrackingService
  ) {
    super();
    this.startTicker();
  }

  override dispose(): void {
    this.stopTicker();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICKER (for UI real-time updates)
  // ═══════════════════════════════════════════════════════════════════════════

  private startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      this.tickSubject$.next(Date.now());
      this.checkAutoStop();
    }, 1000);
  }

  private stopTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a new timer. Stops any currently running timer for this anwalt first.
   */
  async startTimer(input: {
    workspaceId: string;
    caseId: string;
    matterId: string;
    clientId: string;
    anwaltId: string;
    description: string;
    activityType: TimeEntry['activityType'];
    hourlyRate: number;
  }): Promise<TimerSession> {
    // Auto-stop any running timer for this anwalt
    const runningForAnwalt = this.getActiveTimerForAnwalt(input.anwaltId);
    if (runningForAnwalt) {
      await this.stopTimer(runningForAnwalt.id);
    }

    const now = new Date().toISOString();

    const session: TimerSession = {
      id: createId('timer'),
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      matterId: input.matterId,
      clientId: input.clientId,
      anwaltId: input.anwaltId,
      description: input.description.trim(),
      activityType: input.activityType,
      hourlyRate: input.hourlyRate,
      status: 'running',
      startedAt: now,
      lastResumedAt: now,
      accumulatedMs: 0,
      pauseCount: 0,
      segments: [{
        startedAt: now,
        durationMs: 0,
      }],
      createdAt: now,
      updatedAt: now,
    };

    this.sessionsMap$.next({
      ...this.sessionsMap$.value,
      [session.id]: session,
    });

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'timer.started',
      severity: 'info',
      details: `Timer gestartet: ${input.description} (${input.activityType})`,
      metadata: {
        timerId: session.id,
        anwaltId: input.anwaltId,
        hourlyRate: String(input.hourlyRate),
      },
    });

    return session;
  }

  /**
   * Pause a running timer
   */
  async pauseTimer(sessionId: string): Promise<TimerSession | null> {
    const session = this.sessionsMap$.value[sessionId];
    if (!session || session.status !== 'running') return null;

    const now = new Date().toISOString();
    const currentSegmentMs = Date.now() - new Date(session.lastResumedAt).getTime();

    // Close current segment
    const segments = [...session.segments];
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && !lastSegment.stoppedAt) {
      segments[segments.length - 1] = {
        ...lastSegment,
        stoppedAt: now,
        durationMs: currentSegmentMs,
      };
    }

    const updated: TimerSession = {
      ...session,
      status: 'paused',
      pausedAt: now,
      accumulatedMs: session.accumulatedMs + currentSegmentMs,
      pauseCount: session.pauseCount + 1,
      segments,
      updatedAt: now,
    };

    this.sessionsMap$.next({
      ...this.sessionsMap$.value,
      [sessionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: session.caseId,
      workspaceId: session.workspaceId,
      action: 'timer.paused',
      severity: 'info',
      details: `Timer pausiert: ${session.description} (${this.formatMs(updated.accumulatedMs)})`,
      metadata: { timerId: sessionId, pauseCount: String(updated.pauseCount) },
    });

    return updated;
  }

  /**
   * Resume a paused timer
   */
  async resumeTimer(sessionId: string): Promise<TimerSession | null> {
    const session = this.sessionsMap$.value[sessionId];
    if (!session || session.status !== 'paused') return null;

    const now = new Date().toISOString();

    const updated: TimerSession = {
      ...session,
      status: 'running',
      lastResumedAt: now,
      pausedAt: undefined,
      segments: [
        ...session.segments,
        { startedAt: now, durationMs: 0 },
      ],
      updatedAt: now,
    };

    this.sessionsMap$.next({
      ...this.sessionsMap$.value,
      [sessionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: session.caseId,
      workspaceId: session.workspaceId,
      action: 'timer.resumed',
      severity: 'info',
      details: `Timer fortgesetzt: ${session.description}`,
      metadata: { timerId: sessionId },
    });

    return updated;
  }

  /**
   * Stop a timer and convert to TimeEntry
   */
  async stopTimer(sessionId: string): Promise<{ session: TimerSession; timeEntry: TimeEntry } | null> {
    const session = this.sessionsMap$.value[sessionId];
    if (!session) return null;
    if (session.status === 'idle') return null;

    const now = new Date().toISOString();
    let totalMs = session.accumulatedMs;

    // If running, add current segment
    const segments = [...session.segments];
    if (session.status === 'running') {
      const currentSegmentMs = Date.now() - new Date(session.lastResumedAt).getTime();
      totalMs += currentSegmentMs;

      const lastSegment = segments[segments.length - 1];
      if (lastSegment && !lastSegment.stoppedAt) {
        segments[segments.length - 1] = {
          ...lastSegment,
          stoppedAt: now,
          durationMs: currentSegmentMs,
        };
      }
    }

    // Minimum 1 minute
    const durationMinutes = Math.max(1, Math.round(totalMs / 60_000));

    // Create TimeEntry
    const timeEntry = await this.timeTracking.createTimeEntry({
      workspaceId: session.workspaceId,
      caseId: session.caseId,
      matterId: session.matterId,
      clientId: session.clientId,
      anwaltId: session.anwaltId,
      description: session.description,
      activityType: session.activityType,
      durationMinutes,
      hourlyRate: session.hourlyRate,
      date: new Date().toISOString().split('T')[0],
    });

    const updated: TimerSession = {
      ...session,
      status: 'idle',
      accumulatedMs: totalMs,
      segments,
      timeEntryId: timeEntry.id,
      updatedAt: now,
    };

    this.sessionsMap$.next({
      ...this.sessionsMap$.value,
      [sessionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: session.caseId,
      workspaceId: session.workspaceId,
      action: 'timer.stopped',
      severity: 'info',
      details: `Timer gestoppt: ${session.description} — ${durationMinutes} Min → TimeEntry erstellt`,
      metadata: {
        timerId: sessionId,
        totalMs: String(totalMs),
        durationMinutes: String(durationMinutes),
        timeEntryId: timeEntry.id,
        segments: String(segments.length),
        pauses: String(session.pauseCount),
      },
    });

    return { session: updated, timeEntry };
  }

  /**
   * Discard a timer without creating a TimeEntry
   */
  async discardTimer(sessionId: string): Promise<boolean> {
    const session = this.sessionsMap$.value[sessionId];
    if (!session) return false;

    const updatedMap = { ...this.sessionsMap$.value };
    delete updatedMap[sessionId];
    this.sessionsMap$.next(updatedMap);

    await this.orchestration.appendAuditEntry({
      caseId: session.caseId,
      workspaceId: session.workspaceId,
      action: 'timer.discarded',
      severity: 'warning',
      details: `Timer verworfen: ${session.description} (${this.formatMs(session.accumulatedMs)} nicht erfasst)`,
      metadata: { timerId: sessionId },
    });

    return true;
  }

  /**
   * Update description or activity type while timer is running
   */
  async updateTimerMeta(
    sessionId: string,
    updates: { description?: string; activityType?: TimeEntry['activityType']; hourlyRate?: number }
  ): Promise<TimerSession | null> {
    const session = this.sessionsMap$.value[sessionId];
    if (!session) return null;

    const updated: TimerSession = {
      ...session,
      ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
      ...(updates.activityType !== undefined ? { activityType: updates.activityType } : {}),
      ...(updates.hourlyRate !== undefined ? { hourlyRate: updates.hourlyRate } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.sessionsMap$.next({
      ...this.sessionsMap$.value,
      [sessionId]: updated,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  getActiveTimerForAnwalt(anwaltId: string): TimerSession | null {
    return Object.values(this.sessionsMap$.value).find(
      s => s.anwaltId === anwaltId && (s.status === 'running' || s.status === 'paused')
    ) ?? null;
  }

  getActiveTimers(): TimerSession[] {
    return Object.values(this.sessionsMap$.value).filter(
      s => s.status === 'running' || s.status === 'paused'
    );
  }

  getTimerHistoryForMatter(matterId: string): TimerSession[] {
    return Object.values(this.sessionsMap$.value)
      .filter(s => s.matterId === matterId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTimerHistoryForAnwalt(anwaltId: string, limit = 20): TimerSession[] {
    return Object.values(this.sessionsMap$.value)
      .filter(s => s.anwaltId === anwaltId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get a real-time snapshot of a timer (for UI rendering)
   */
  getTimerSnapshot(sessionId: string): ActiveTimerSnapshot | null {
    const session = this.sessionsMap$.value[sessionId];
    if (!session) return null;

    let currentElapsedMs = 0;
    if (session.status === 'running') {
      currentElapsedMs = Date.now() - new Date(session.lastResumedAt).getTime();
    }

    const totalElapsedMs = session.accumulatedMs + currentElapsedMs;
    const totalHours = totalElapsedMs / 3_600_000;
    const currentAmount = Math.round(totalHours * session.hourlyRate * 100) / 100;

    return {
      session,
      currentElapsedMs,
      totalElapsedMs,
      formattedTime: this.formatMs(totalElapsedMs),
      currentAmount,
    };
  }

  /**
   * Get snapshots for all active timers (for dashboard/header display)
   */
  getAllActiveSnapshots(): ActiveTimerSnapshot[] {
    return this.getActiveTimers()
      .map(s => this.getTimerSnapshot(s.id))
      .filter(Boolean) as ActiveTimerSnapshot[];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-STOP
  // ═══════════════════════════════════════════════════════════════════════════

  setAutoStopMaxHours(hours: number) {
    this.autoStopMaxMs = hours * 60 * 60 * 1000;
  }

  private async checkAutoStop() {
    const running = this.getActiveTimers().filter(s => s.status === 'running');
    for (const session of running) {
      const totalMs = session.accumulatedMs + (Date.now() - new Date(session.lastResumedAt).getTime());
      if (totalMs >= this.autoStopMaxMs) {
        await this.stopTimer(session.id);

        await this.orchestration.appendAuditEntry({
          caseId: session.caseId,
          workspaceId: session.workspaceId,
          action: 'timer.auto_stopped',
          severity: 'warning',
          details: `Timer automatisch gestoppt nach ${this.formatMs(totalMs)} (Maximum erreicht)`,
          metadata: {
            timerId: session.id,
            maxHours: String(this.autoStopMaxMs / 3_600_000),
          },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  getDashboardStats(): {
    activeTimers: number;
    runningTimers: number;
    pausedTimers: number;
    todayTotalMinutes: number;
    todayTotalAmount: number;
    todaySessionCount: number;
  } {
    const all = Object.values(this.sessionsMap$.value);
    const active = all.filter(s => s.status === 'running' || s.status === 'paused');
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = all.filter(s => s.createdAt.startsWith(today));

    let todayTotalMs = 0;
    let todayTotalAmount = 0;

    for (const session of todaySessions) {
      let ms = session.accumulatedMs;
      if (session.status === 'running') {
        ms += Date.now() - new Date(session.lastResumedAt).getTime();
      }
      todayTotalMs += ms;
      todayTotalAmount += (ms / 3_600_000) * session.hourlyRate;
    }

    return {
      activeTimers: active.length,
      runningTimers: active.filter(s => s.status === 'running').length,
      pausedTimers: active.filter(s => s.status === 'paused').length,
      todayTotalMinutes: Math.round(todayTotalMs / 60_000),
      todayTotalAmount: Math.round(todayTotalAmount * 100) / 100,
      todaySessionCount: todaySessions.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private formatMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
