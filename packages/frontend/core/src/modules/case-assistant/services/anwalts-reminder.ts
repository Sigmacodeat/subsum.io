import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { CaseDeadline, DeadlineAlert } from '../types';
import type { EmailService } from './email';
import type { KalenderService } from './kalender';
import type { KanzleiProfileService } from './kanzlei-profile';
import type { CasePlatformAdapterService } from './platform-adapters';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnwaltsReminderChannel = 'email' | 'push' | 'whatsapp' | 'in_app';

export type AnwaltsReminderPriority = 'critical' | 'high' | 'normal' | 'low';

export type AnwaltsReminderCategory =
  | 'deadline_approaching'
  | 'deadline_expired'
  | 'court_date_approaching'
  | 'court_date_tomorrow'
  | 'wiedervorlage_due'
  | 'morning_briefing'
  | 'weekly_summary'
  | 'calendar_conflict'
  | 'document_action_required';

export type AnwaltsReminderStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'acknowledged'
  | 'failed'
  | 'suppressed';

export interface AnwaltsReminder {
  id: string;
  workspaceId: string;
  /** Anwalt user ID (from KanzleiProfile) */
  anwaltId: string;
  category: AnwaltsReminderCategory;
  priority: AnwaltsReminderPriority;
  channel: AnwaltsReminderChannel;
  status: AnwaltsReminderStatus;
  title: string;
  body: string;
  /** Related matter/case IDs */
  matterId?: string;
  caseId?: string;
  deadlineId?: string;
  terminId?: string;
  /** Dedup key — same key won't fire twice in 24h */
  dedupKey: string;
  /** When the reminder was sent */
  sentAt?: string;
  acknowledgedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface AnwaltsReminderPreferences {
  /** Channels to use for different priority levels */
  criticalChannels: AnwaltsReminderChannel[];
  highChannels: AnwaltsReminderChannel[];
  normalChannels: AnwaltsReminderChannel[];
  lowChannels: AnwaltsReminderChannel[];
  /** Email for the anwalt (from KanzleiProfile) */
  anwaltEmail?: string;
  anwaltPhone?: string;
  /** Quiet hours (no notifications except critical) */
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "07:00"
  /** Morning briefing time */
  morningBriefingTime: string; // "07:30"
  morningBriefingEnabled: boolean;
  /** Weekly summary day */
  weeklySummaryDay: 'monday' | 'friday' | 'sunday';
  weeklySummaryEnabled: boolean;
  /** How many minutes before deadline to send first reminder */
  deadlineReminderThresholds: number[]; // [20160, 10080, 1440, 180, 60] (14d, 7d, 1d, 3h, 1h)
  /** Court date reminders */
  courtDateReminderThresholds: number[]; // [1440, 180, 60] (1d, 3h, 1h)
  /** Enable/disable categories */
  disabledCategories: AnwaltsReminderCategory[];
}

const DEFAULT_PREFERENCES: AnwaltsReminderPreferences = {
  criticalChannels: ['email', 'push', 'whatsapp'],
  highChannels: ['email', 'push'],
  normalChannels: ['email'],
  lowChannels: ['in_app'],
  morningBriefingTime: '07:30',
  morningBriefingEnabled: true,
  weeklySummaryDay: 'monday',
  weeklySummaryEnabled: true,
  deadlineReminderThresholds: [20160, 10080, 1440, 180, 60],
  courtDateReminderThresholds: [1440, 180, 60],
  disabledCategories: [],
};

export const ANWALTS_REMINDER_CATEGORY_LABELS: Record<AnwaltsReminderCategory, string> = {
  deadline_approaching: 'Frist nähert sich',
  deadline_expired: 'Frist abgelaufen',
  court_date_approaching: 'Gerichtstermin nähert sich',
  court_date_tomorrow: 'Gerichtstermin morgen',
  wiedervorlage_due: 'Wiedervorlage fällig',
  morning_briefing: 'Morgen-Briefing',
  weekly_summary: 'Wochenzusammenfassung',
  calendar_conflict: 'Terminkonflikt',
  document_action_required: 'Dokument-Aktion erforderlich',
};

export const ANWALTS_REMINDER_STATUS_LABELS: Record<AnwaltsReminderStatus, string> = {
  pending: 'Ausstehend',
  sent: 'Gesendet',
  delivered: 'Zugestellt',
  acknowledged: 'Bestätigt',
  failed: 'Fehlgeschlagen',
  suppressed: 'Unterdrückt (Ruhezeit)',
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * AnwaltsReminderService — Proaktive Erinnerungen FÜR DEN ANWALT
 *
 * Im Gegensatz zu MandantenNotificationService (der Mandanten benachrichtigt)
 * sendet dieser Service Erinnerungen an den Anwalt selbst:
 *
 * - Frist-Erinnerungen (14d, 7d, 1d, 3h, 1h vor Ablauf)
 * - Gerichtstermin-Erinnerungen (1d, 3h, 1h vor Termin)
 * - Wiedervorlage-Erinnerungen
 * - Morgen-Briefing (täglich um konfigurierte Uhrzeit)
 * - Wochenzusammenfassung
 * - Terminkonflikt-Warnungen
 * - Dokument-Aktionen (Review nötig, Unterschrift ausstehend)
 *
 * Channels: Email, Push, WhatsApp, In-App
 * Dedup: Gleiche Erinnerung wird nur 1× pro 24h gesendet
 * Quiet Hours: Nur kritische Erinnerungen außerhalb Bürozeiten
 */
export class AnwaltsReminderService extends Service {
  private readonly remindersMap$ = new BehaviorSubject<Record<string, AnwaltsReminder>>({});
  private readonly preferences$ = new BehaviorSubject<AnwaltsReminderPreferences>({ ...DEFAULT_PREFERENCES });
  private sentDedupKeys = new Map<string, number>(); // dedupKey → timestamp
  private deferredDedupKeys = new Map<string, number>(); // dedupKey queued during quiet hours
  private poller: ReturnType<typeof setInterval> | null = null;
  private morningBriefingTimer: ReturnType<typeof setTimeout> | null = null;
  private weeklySummaryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBriefingDateKey = '';
  private lastWeeklySummaryDateKey = '';
  private resolvedAnwaltId = 'default-anwalt';
  private resolvedAnwaltEmail = '';
  private resolvedAnwaltPhone = '';

  readonly remindersList$ = this.remindersMap$.pipe(map(m => Object.values(m)));
  readonly preferences$$ = this.preferences$.asObservable();
  readonly pendingCount$ = this.remindersMap$.pipe(
    map(m => Object.values(m).filter(r => r.status === 'pending').length)
  );

  constructor(
    private readonly store: CaseAssistantStore,
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly kalenderService: KalenderService,
    private readonly kanzleiProfileService: KanzleiProfileService,
    private readonly emailService: EmailService,
    private readonly adapterService: CasePlatformAdapterService
  ) {
    super();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  async start(intervalMs = 60_000) {
    this.stop();
    await this.hydrateState();
    await this.resolveAndCacheAnwaltContext();
    // Initial sync
    await this.checkAndFireReminders();
    // Poll every minute
    this.poller = setInterval(() => {
      this.checkAndFireReminders().catch(err =>
        console.error('[anwalts-reminder] check failed', err)
      );
    }, intervalMs);
    // Schedule morning briefing
    this.scheduleMorningBriefing();
    this.scheduleWeeklySummary();
  }

  stop() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
    if (this.morningBriefingTimer) {
      clearTimeout(this.morningBriefingTimer);
      this.morningBriefingTimer = null;
    }
    if (this.weeklySummaryTimer) {
      clearTimeout(this.weeklySummaryTimer);
      this.weeklySummaryTimer = null;
    }
  }

  override dispose(): void {
    this.stop();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════

  getPreferences(): AnwaltsReminderPreferences {
    return { ...this.preferences$.value };
  }

  updatePreferences(updates: Partial<AnwaltsReminderPreferences>): AnwaltsReminderPreferences {
    const current = this.preferences$.value;
    const updated = { ...current, ...updates };
    this.preferences$.next(updated);
    // Reschedule morning briefing if time changed
    if (updates.morningBriefingTime || updates.morningBriefingEnabled !== undefined) {
      this.scheduleMorningBriefing();
    }
    if (updates.weeklySummaryDay || updates.weeklySummaryEnabled !== undefined) {
      this.scheduleWeeklySummary();
    }
    this.persistPreferences().catch(err => {
      console.error('[anwalts-reminder] persist preferences failed', err);
    });
    return { ...updated };
  }

  /**
   * Public bridge for DeadlineAlertService: emits an explicit lawyer reminder
   * for a generated deadline alert.
   */
  async dispatchFromDeadlineAlert(alert: DeadlineAlert): Promise<void> {
    const graph = await this.store.getGraph();
    const anwaltId = this.resolveAnwaltId();
    const workspaceId = this.resolveWorkspaceId(graph);
    const isOverdue = alert.minutesUntilDue < 0;
    const category: AnwaltsReminderCategory = isOverdue
      ? 'deadline_expired'
      : alert.source === 'gerichtstermin'
        ? 'court_date_approaching'
        : 'deadline_approaching';

    const priority: AnwaltsReminderPriority = isOverdue
      ? 'critical'
      : alert.minutesUntilDue <= 180
        ? 'high'
        : 'normal';

    const matter = alert.matterId ? graph.matters?.[alert.matterId] : undefined;
    const title = isOverdue
      ? `ÜBERFÄLLIG: ${alert.title}`
      : `${alert.source === 'gerichtstermin' ? 'Gerichtstermin' : 'Frist'} in ${this.formatTimeUntil(alert.minutesUntilDue)}: ${alert.title}`;

    const body = [
      `Ein wichtiger Vorgang benötigt Aufmerksamkeit:`,
      '',
      `Titel: ${alert.title}`,
      `Fällig: ${new Date(alert.dueAt).toLocaleString('de')}`,
      `Verbleibend: ${this.formatTimeUntil(alert.minutesUntilDue)}`,
      matter ? `Akte: ${matter.title}${matter.externalRef ? ` (${matter.externalRef})` : ''}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    await this.fireReminder({
      workspaceId,
      anwaltId,
      category,
      priority,
      title,
      body,
      matterId: alert.matterId,
      caseId: alert.caseId,
      deadlineId: alert.deadlineId,
      dedupKey: `deadline-alert:${alert.id}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN CHECK LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  async checkAndFireReminders(): Promise<number> {
    const prefs = this.preferences$.value;
    const graph = await this.store.getGraph();
    const now = Date.now();
    let firedCount = 0;

    await this.flushDeferredRemindersIfNeeded();

    const anwaltId = this.resolveAnwaltId();
    const workspaceId = this.resolveWorkspaceId(graph);

    // ── 1. Deadline Reminders ────────────────────────────────────────────
    const deadlines = Object.values(graph.deadlines ?? {}) as CaseDeadline[];
    for (const deadline of deadlines) {
      if (deadline.status === 'completed' || deadline.status === 'acknowledged') continue;

      const due = new Date(deadline.dueAt).getTime();
      if (!Number.isFinite(due)) continue;
      const minutesUntilDue = Math.floor((due - now) / 60_000);

      // Overdue
      if (minutesUntilDue < 0) {
        const fired = await this.fireReminder({
          workspaceId,
          anwaltId,
          category: 'deadline_expired',
          priority: 'critical',
          title: `ÜBERFÄLLIG: ${deadline.title}`,
          body: this.buildDeadlineBody(deadline, graph, minutesUntilDue),
          matterId: this.resolveMatterForDeadline(graph, deadline.id),
          deadlineId: deadline.id,
          dedupKey: `deadline_expired:${deadline.id}`,
        });
        if (fired) firedCount++;
        continue;
      }

      // Approaching thresholds
      if (prefs.disabledCategories.includes('deadline_approaching')) continue;
      for (const threshold of prefs.deadlineReminderThresholds) {
        if (minutesUntilDue <= threshold) {
          const priority = this.derivePriority(minutesUntilDue);
          const fired = await this.fireReminder({
            workspaceId,
            anwaltId,
            category: 'deadline_approaching',
            priority,
            title: `Frist in ${this.formatTimeUntil(minutesUntilDue)}: ${deadline.title}`,
            body: this.buildDeadlineBody(deadline, graph, minutesUntilDue),
            matterId: this.resolveMatterForDeadline(graph, deadline.id),
            deadlineId: deadline.id,
            dedupKey: `deadline_approaching:${deadline.id}:${threshold}`,
          });
          if (fired) firedCount++;
          break; // Only fire the most urgent threshold
        }
      }
    }

    // ── 2. Court Date Reminders ──────────────────────────────────────────
    if (!prefs.disabledCategories.includes('court_date_approaching')) {
      const termine = Object.values(graph.termine ?? {});
      for (const termin of termine) {
        if (termin.status === 'abgesagt' || termin.status === 'abgeschlossen') continue;

        const terminDate = new Date(termin.datum).getTime();
        if (!Number.isFinite(terminDate)) continue;
        const minutesUntil = Math.floor((terminDate - now) / 60_000);
        if (minutesUntil < 0) continue;

        for (const threshold of prefs.courtDateReminderThresholds) {
          if (minutesUntil <= threshold) {
            const isTomorrow = minutesUntil <= 1440 && minutesUntil > 60;
            const category: AnwaltsReminderCategory = isTomorrow
              ? 'court_date_tomorrow'
              : 'court_date_approaching';
            const priority = minutesUntil <= 180 ? 'critical' : 'high';

            const matter = graph.matters?.[termin.matterId];
            const fired = await this.fireReminder({
              workspaceId,
              anwaltId,
              category,
              priority,
              title: `Gerichtstermin in ${this.formatTimeUntil(minutesUntil)}: ${termin.gericht}`,
              body: this.buildTerminBody(termin, matter, minutesUntil),
              matterId: termin.matterId,
              terminId: termin.id,
              dedupKey: `court_date:${termin.id}:${threshold}`,
            });
            if (fired) firedCount++;
            break;
          }
        }
      }
    }

    // ── 3. Wiedervorlage Reminders ───────────────────────────────────────
    if (!prefs.disabledCategories.includes('wiedervorlage_due')) {
      const wiedervorlagen = this.kalenderService.getAllEvents()
        .filter(e => e.source === 'wiedervorlage');

      for (const wv of wiedervorlagen) {
        const due = new Date(wv.startAt).getTime();
        if (!Number.isFinite(due)) continue;
        const minutesUntil = Math.floor((due - now) / 60_000);
        if (minutesUntil < 0 || minutesUntil > 1440) continue; // Only remind within 24h

        const fired = await this.fireReminder({
          workspaceId,
          anwaltId,
          category: 'wiedervorlage_due',
          priority: minutesUntil <= 60 ? 'high' : 'normal',
          title: `Wiedervorlage fällig: ${wv.title}`,
          body: `Die Wiedervorlage "${wv.title}" ist in ${this.formatTimeUntil(minutesUntil)} fällig.\n\n${wv.description ?? ''}`,
          matterId: wv.matterId,
          dedupKey: `wiedervorlage:${wv.id}`,
        });
        if (fired) firedCount++;
      }
    }

    // ── 4. Calendar Conflict Detection ───────────────────────────────────
    if (!prefs.disabledCategories.includes('calendar_conflict')) {
      const conflicts = this.detectCalendarConflicts();
      for (const conflict of conflicts) {
        const fired = await this.fireReminder({
          workspaceId,
          anwaltId,
          category: 'calendar_conflict',
          priority: 'high',
          title: `Terminkonflikt: ${conflict.event1Title} ↔ ${conflict.event2Title}`,
          body: `Zwei Termine überschneiden sich:\n\n1) ${conflict.event1Title} — ${conflict.event1Time}\n2) ${conflict.event2Title} — ${conflict.event2Time}\n\nBitte einen Termin verschieben.`,
          dedupKey: `conflict:${conflict.key}`,
        });
        if (fired) firedCount++;
      }
    }

    // Clean old dedup keys (>24h)
    this.cleanDedupKeys();

    return firedCount;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MORNING BRIEFING
  // ═══════════════════════════════════════════════════════════════════════════

  async generateMorningBriefing(): Promise<AnwaltsReminder | null> {
    const prefs = this.preferences$.value;
    if (!prefs.morningBriefingEnabled) return null;
    if (prefs.disabledCategories.includes('morning_briefing')) return null;

    const todayKey = new Date().toISOString().slice(0, 10);
    if (this.lastBriefingDateKey === todayKey) return null;
    this.lastBriefingDateKey = todayKey;
    this.persistRuntimeState().catch(err => {
      console.error('[anwalts-reminder] persist runtime failed', err);
    });

    const graph = await this.store.getGraph();
    const anwaltId = this.resolveAnwaltId();
    const workspaceId = this.resolveWorkspaceId(graph);
    const now = Date.now();

    // Collect today's items
    const todayStart = new Date(todayKey).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    // Deadlines due today or overdue
    const deadlinesToday: Array<{ title: string; dueAt: string; overdue: boolean; matterId: string }> = [];
    const deadlinesThisWeek: Array<{ title: string; dueAt: string; matterId: string }> = [];
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

    for (const deadline of Object.values(graph.deadlines ?? {}) as CaseDeadline[]) {
      if (deadline.status === 'completed' || deadline.status === 'acknowledged') continue;
      const due = new Date(deadline.dueAt).getTime();
      if (!Number.isFinite(due)) continue;
      const matterId = this.resolveMatterForDeadline(graph, deadline.id);

      if (due < now) {
        deadlinesToday.push({ title: deadline.title, dueAt: deadline.dueAt, overdue: true, matterId });
      } else if (due >= todayStart && due < todayEnd) {
        deadlinesToday.push({ title: deadline.title, dueAt: deadline.dueAt, overdue: false, matterId });
      } else if (due >= todayEnd && due < weekEnd) {
        deadlinesThisWeek.push({ title: deadline.title, dueAt: deadline.dueAt, matterId });
      }
    }

    // Termine today
    const termineToday: Array<{ title: string; datum: string; uhrzeit?: string; gericht: string }> = [];
    for (const termin of Object.values(graph.termine ?? {})) {
      if (termin.status === 'abgesagt' || termin.status === 'abgeschlossen') continue;
      const tDate = new Date(termin.datum).getTime();
      if (tDate >= todayStart && tDate < todayEnd) {
        termineToday.push({
          title: `${termin.gericht}`,
          datum: termin.datum,
          uhrzeit: termin.uhrzeit,
          gericht: termin.gericht,
        });
      }
    }

    // Calendar events today
    const calendarEventsToday = this.kalenderService.getAllEvents()
      .filter(e => {
        const eDate = new Date(e.startAt).getTime();
        return eDate >= todayStart && eDate < todayEnd;
      });

    // Wiedervorlagen today
    const wiedervorlagenToday = calendarEventsToday.filter(e => e.source === 'wiedervorlage');

    // Build briefing text
    const lines: string[] = [];
    const dateFormatted = new Date(todayKey).toLocaleDateString('de', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    lines.push(`Guten Morgen! Ihr Tagesprogramm für ${dateFormatted}:\n`);

    // Overdue deadlines (CRITICAL)
    const overdue = deadlinesToday.filter(d => d.overdue);
    if (overdue.length > 0) {
      lines.push(`⚠️ ÜBERFÄLLIGE FRISTEN (${overdue.length}):`);
      for (const d of overdue) {
        const matter = d.matterId ? graph.matters?.[d.matterId] : undefined;
        lines.push(`  • ${d.title}${matter ? ` — Akte: ${matter.title}` : ''}`);
      }
      lines.push('');
    }

    // Today's deadlines
    const todayDue = deadlinesToday.filter(d => !d.overdue);
    if (todayDue.length > 0) {
      lines.push(`📋 FRISTEN HEUTE (${todayDue.length}):`);
      for (const d of todayDue) {
        const matter = d.matterId ? graph.matters?.[d.matterId] : undefined;
        lines.push(`  • ${d.title}${matter ? ` — Akte: ${matter.title}` : ''}`);
      }
      lines.push('');
    }

    // Court dates
    if (termineToday.length > 0) {
      lines.push(`⚖️ GERICHTSTERMINE HEUTE (${termineToday.length}):`);
      for (const t of termineToday) {
        lines.push(`  • ${t.uhrzeit ?? 'ganztägig'} — ${t.gericht}`);
      }
      lines.push('');
    }

    // Wiedervorlagen
    if (wiedervorlagenToday.length > 0) {
      lines.push(`📌 WIEDERVORLAGEN HEUTE (${wiedervorlagenToday.length}):`);
      for (const w of wiedervorlagenToday) {
        lines.push(`  • ${w.title}`);
      }
      lines.push('');
    }

    // Other calendar events
    const otherEvents = calendarEventsToday.filter(
      e => e.source !== 'wiedervorlage' && e.source !== 'deadline'
    );
    if (otherEvents.length > 0) {
      lines.push(`📅 WEITERE TERMINE (${otherEvents.length}):`);
      for (const e of otherEvents) {
        const time = e.allDay ? 'ganztägig' : new Date(e.startAt).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' });
        lines.push(`  • ${time} — ${e.title}`);
      }
      lines.push('');
    }

    // This week's deadlines
    if (deadlinesThisWeek.length > 0) {
      lines.push(`📆 FRISTEN DIESE WOCHE (${deadlinesThisWeek.length}):`);
      for (const d of deadlinesThisWeek.slice(0, 5)) {
        const dDate = new Date(d.dueAt).toLocaleDateString('de', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const matter = d.matterId ? graph.matters?.[d.matterId] : undefined;
        lines.push(`  • ${dDate}: ${d.title}${matter ? ` — ${matter.title}` : ''}`);
      }
      if (deadlinesThisWeek.length > 5) {
        lines.push(`  ... und ${deadlinesThisWeek.length - 5} weitere`);
      }
      lines.push('');
    }

    // Summary stats
    const totalOpen = (Object.values(graph.deadlines ?? {}) as CaseDeadline[])
      .filter(d => d.status === 'open').length;
    const totalMatters = Object.values(graph.matters ?? {})
      .filter((m: any) => m.status === 'active' || m.status === 'pending').length;

    lines.push(`── Zusammenfassung ──`);
    lines.push(`Offene Fristen: ${totalOpen} | Aktive Akten: ${totalMatters}`);

    if (deadlinesToday.length === 0 && termineToday.length === 0 && wiedervorlagenToday.length === 0) {
      lines.push('\nHeute stehen keine dringenden Termine oder Fristen an. Guter Tag für Aktenarbeit!');
    }

    const body = lines.join('\n');
    const hasCritical = overdue.length > 0;
    const hasImportant = todayDue.length > 0 || termineToday.length > 0;

    const reminder = await this.createAndSendReminder({
      workspaceId,
      anwaltId,
      category: 'morning_briefing',
      priority: hasCritical ? 'critical' : hasImportant ? 'high' : 'normal',
      title: `Morgen-Briefing: ${deadlinesToday.length} Fristen, ${termineToday.length} Termine`,
      body,
      dedupKey: `morning_briefing:${todayKey}`,
    });

    return reminder;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  async generateWeeklySummary(): Promise<AnwaltsReminder | null> {
    const prefs = this.preferences$.value;
    if (!prefs.weeklySummaryEnabled) return null;
    if (prefs.disabledCategories.includes('weekly_summary')) return null;

    const todayKey = new Date().toISOString().slice(0, 10);
    if (this.lastWeeklySummaryDateKey === todayKey) {
      return null;
    }
    this.lastWeeklySummaryDateKey = todayKey;
    this.persistRuntimeState().catch(err => {
      console.error('[anwalts-reminder] persist runtime failed', err);
    });

    const graph = await this.store.getGraph();
    const anwaltId = this.resolveAnwaltId();
    const workspaceId = this.resolveWorkspaceId(graph);

    const now = Date.now();
    const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
    const weekKey = `week:${new Date().toISOString().slice(0, 10)}`;

    // Deadlines next 7 days
    const upcomingDeadlines = (Object.values(graph.deadlines ?? {}) as CaseDeadline[])
      .filter(d => {
        if (d.status === 'completed' || d.status === 'acknowledged') return false;
        const due = new Date(d.dueAt).getTime();
        return Number.isFinite(due) && due >= now && due < weekEnd;
      })
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    // Termine next 7 days
    const upcomingTermine = Object.values(graph.termine ?? {})
      .filter(t => {
        if (t.status === 'abgesagt' || t.status === 'abgeschlossen') return false;
        const tDate = new Date(t.datum).getTime();
        return Number.isFinite(tDate) && tDate >= now && tDate < weekEnd;
      })
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());

    const overdue = (Object.values(graph.deadlines ?? {}) as CaseDeadline[])
      .filter(d => d.status === 'open' && new Date(d.dueAt).getTime() < now).length;

    const lines: string[] = [];
    lines.push('Wochenzusammenfassung:\n');
    lines.push(`📊 Überfällige Fristen: ${overdue}`);
    lines.push(`📋 Fristen diese Woche: ${upcomingDeadlines.length}`);
    lines.push(`⚖️ Termine diese Woche: ${upcomingTermine.length}\n`);

    if (upcomingDeadlines.length > 0) {
      lines.push('FRISTEN:');
      for (const d of upcomingDeadlines.slice(0, 10)) {
        const dDate = new Date(d.dueAt).toLocaleDateString('de', { weekday: 'short', day: '2-digit', month: '2-digit' });
        lines.push(`  • ${dDate}: ${d.title}`);
      }
      lines.push('');
    }

    if (upcomingTermine.length > 0) {
      lines.push('TERMINE:');
      for (const t of upcomingTermine.slice(0, 10)) {
        const tDate = new Date(t.datum).toLocaleDateString('de', { weekday: 'short', day: '2-digit', month: '2-digit' });
        lines.push(`  • ${tDate}${t.uhrzeit ? ` ${t.uhrzeit}` : ''}: ${t.gericht}`);
      }
    }

    return this.createAndSendReminder({
      workspaceId,
      anwaltId,
      category: 'weekly_summary',
      priority: overdue > 0 ? 'high' : 'normal',
      title: `Wochenbericht: ${upcomingDeadlines.length} Fristen, ${upcomingTermine.length} Termine`,
      body: lines.join('\n'),
      dedupKey: `weekly_summary:${weekKey}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIRE & SEND
  // ═══════════════════════════════════════════════════════════════════════════

  private async fireReminder(input: {
    workspaceId: string;
    anwaltId: string;
    category: AnwaltsReminderCategory;
    priority: AnwaltsReminderPriority;
    title: string;
    body: string;
    matterId?: string;
    caseId?: string;
    deadlineId?: string;
    terminId?: string;
    dedupKey: string;
  }): Promise<boolean> {
    // Check dedup
    const lastSent = this.sentDedupKeys.get(input.dedupKey);
    if (lastSent && Date.now() - lastSent < 24 * 60 * 60 * 1000) {
      return false; // Already sent in last 24h
    }
    const lastDeferred = this.deferredDedupKeys.get(input.dedupKey);
    if (lastDeferred && Date.now() - lastDeferred < 24 * 60 * 60 * 1000) {
      return false; // Already queued in quiet-hours
    }

    // Check disabled categories
    const prefs = this.preferences$.value;
    if (prefs.disabledCategories.includes(input.category)) {
      return false;
    }

    await this.createAndSendReminder(input);
    return true;
  }

  private async createAndSendReminder(input: {
    workspaceId: string;
    anwaltId: string;
    category: AnwaltsReminderCategory;
    priority: AnwaltsReminderPriority;
    title: string;
    body: string;
    matterId?: string;
    caseId?: string;
    deadlineId?: string;
    terminId?: string;
    dedupKey: string;
  }): Promise<AnwaltsReminder> {
    const prefs = this.preferences$.value;
    const channels = this.getChannelsForPriority(input.priority, prefs);
    const now = new Date().toISOString();

    // Check quiet hours
    const inQuietHours = this.isInQuietHours(prefs);
    const isDeferredByQuietHours = inQuietHours && input.priority !== 'critical';
    const effectiveChannels = channels;

    // Mark dedup immediately as sent OR queued, so polling won't create duplicates.
    if (isDeferredByQuietHours) {
      this.deferredDedupKeys.set(input.dedupKey, Date.now());
    } else {
      this.sentDedupKeys.set(input.dedupKey, Date.now());
    }
    this.persistRuntimeState().catch(err => {
      console.error('[anwalts-reminder] persist runtime failed', err);
    });

    // Create one reminder per channel
    let primaryReminder: AnwaltsReminder | null = null;

    for (const channel of effectiveChannels) {
      const reminder: AnwaltsReminder = {
        id: createId('ar'),
        workspaceId: input.workspaceId,
        anwaltId: input.anwaltId,
        category: input.category,
        priority: input.priority,
        channel,
        status: isDeferredByQuietHours ? 'suppressed' : 'pending',
        title: input.title,
        body: input.body,
        matterId: input.matterId,
        caseId: input.caseId,
        deadlineId: input.deadlineId,
        terminId: input.terminId,
        dedupKey: input.dedupKey,
        createdAt: now,
      };

      this.remindersMap$.next({
        ...this.remindersMap$.value,
        [reminder.id]: reminder,
      });

      if (!primaryReminder) primaryReminder = reminder;

      // Send immediately (non-blocking)
      if (reminder.status === 'pending') {
        this.sendReminder(reminder).catch(err =>
          console.error(`[anwalts-reminder] send failed for ${channel}`, err)
        );
      }
    }

    // Audit
    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: input.caseId ?? '',
      action: `anwalt.reminder.${input.category}`,
      severity: input.priority === 'critical' ? 'error' : 'info',
      details: `Anwalts-Erinnerung: ${input.title}`,
      metadata: {
        category: input.category,
        priority: input.priority,
        channels: effectiveChannels.join(','),
        dedupKey: input.dedupKey,
        deferredByQuietHours: isDeferredByQuietHours ? 'true' : 'false',
      },
    });

    return primaryReminder!;
  }

  private async sendReminder(reminder: AnwaltsReminder): Promise<void> {
    const prefs = this.preferences$.value;

    try {
      if (reminder.channel === 'email') {
        await this.sendEmailReminder(reminder, prefs);
      } else if (reminder.channel === 'whatsapp') {
        await this.sendWhatsAppReminder(reminder, prefs);
      } else if (reminder.channel === 'push' || reminder.channel === 'in_app') {
        // In-app / push: just mark sent (UI reads from remindersList$)
        this.updateReminderStatus(reminder.id, 'sent');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Versand fehlgeschlagen';
      this.updateReminderStatus(reminder.id, 'failed', msg);
    }
  }

  private async sendEmailReminder(reminder: AnwaltsReminder, prefs: AnwaltsReminderPreferences): Promise<void> {
    const email = prefs.anwaltEmail ?? this.resolveAnwaltEmail();
    if (!email) {
      this.updateReminderStatus(reminder.id, 'failed', 'Keine Anwalts-E-Mail konfiguriert');
      return;
    }

    this.updateReminderStatus(reminder.id, 'sent');

    const result = await this.emailService.sendEmail({
      workspaceId: reminder.workspaceId,
      matterId: reminder.matterId,
      clientId: reminder.anwaltId,
      recipientEmail: email,
      templateType: 'custom',
      subject: `[Subsumio] ${reminder.title}`,
      bodyTemplate: reminder.body,
      senderName: 'Subsumio Copilot',
      senderEmail: 'copilot@subsum.io',
    });

    if (result.success) {
      this.updateReminderStatus(reminder.id, 'delivered');
    } else {
      this.updateReminderStatus(reminder.id, 'failed', result.message);
    }
  }

  private async sendWhatsAppReminder(reminder: AnwaltsReminder, prefs: AnwaltsReminderPreferences): Promise<void> {
    const phone = prefs.anwaltPhone ?? this.resolveAnwaltPhone();
    if (!phone) {
      this.updateReminderStatus(reminder.id, 'failed', 'Keine Anwalts-Telefonnummer konfiguriert');
      return;
    }

    this.updateReminderStatus(reminder.id, 'sent');

    const result = await this.adapterService.dispatchN8nWorkflow({
      caseId: reminder.caseId ?? '',
      workspaceId: reminder.workspaceId,
      workflow: 'anwalt_whatsapp_reminder',
      payload: {
        anwaltId: reminder.anwaltId,
        toPhone: phone,
        subject: reminder.title,
        message: `${reminder.title}\n\n${reminder.body}`,
        priority: reminder.priority,
        category: reminder.category,
      },
    });

    if (result.ok) {
      this.updateReminderStatus(reminder.id, 'delivered');
    } else {
      this.updateReminderStatus(reminder.id, 'failed', result.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACKNOWLEDGE
  // ═══════════════════════════════════════════════════════════════════════════

  acknowledgeReminder(reminderId: string): void {
    const existing = this.remindersMap$.value[reminderId];
    if (!existing) return;

    this.remindersMap$.next({
      ...this.remindersMap$.value,
      [reminderId]: {
        ...existing,
        status: 'acknowledged',
        acknowledgedAt: new Date().toISOString(),
      },
    });
  }

  acknowledgeAllForCategory(category: AnwaltsReminderCategory): void {
    const now = new Date().toISOString();
    const updated = { ...this.remindersMap$.value };
    for (const [id, reminder] of Object.entries(updated)) {
      if (reminder.category === category && reminder.status !== 'acknowledged') {
        updated[id] = { ...reminder, status: 'acknowledged', acknowledgedAt: now };
      }
    }
    this.remindersMap$.next(updated);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getChannelsForPriority(
    priority: AnwaltsReminderPriority,
    prefs: AnwaltsReminderPreferences
  ): AnwaltsReminderChannel[] {
    switch (priority) {
      case 'critical': return prefs.criticalChannels;
      case 'high': return prefs.highChannels;
      case 'normal': return prefs.normalChannels;
      case 'low': return prefs.lowChannels;
    }
  }

  private derivePriority(minutesUntilDue: number): AnwaltsReminderPriority {
    if (minutesUntilDue <= 60) return 'critical';
    if (minutesUntilDue <= 180) return 'high';
    if (minutesUntilDue <= 1440) return 'high';
    return 'normal';
  }

  private formatTimeUntil(minutes: number): string {
    if (minutes < 0) return 'überfällig';
    if (minutes < 60) return `${minutes} Min.`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} Std.`;
    const days = Math.floor(minutes / 1440);
    return days === 1 ? '1 Tag' : `${days} Tagen`;
  }

  private isInQuietHours(prefs: AnwaltsReminderPreferences): boolean {
    if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
    const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  private scheduleMorningBriefing(): void {
    if (this.morningBriefingTimer) {
      clearTimeout(this.morningBriefingTimer);
      this.morningBriefingTimer = null;
    }

    const prefs = this.preferences$.value;
    if (!prefs.morningBriefingEnabled) return;

    const [h, m] = prefs.morningBriefingTime.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h ?? 7, m ?? 30, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();
    this.morningBriefingTimer = setTimeout(() => {
      this.generateMorningBriefing().catch(err =>
        console.error('[anwalts-reminder] morning briefing failed', err)
      );
      // Reschedule for next day
      this.scheduleMorningBriefing();
    }, delay);
  }

  private scheduleWeeklySummary(): void {
    if (this.weeklySummaryTimer) {
      clearTimeout(this.weeklySummaryTimer);
      this.weeklySummaryTimer = null;
    }

    const prefs = this.preferences$.value;
    if (!prefs.weeklySummaryEnabled) return;

    const targetWeekday = this.weekdayToNumber(prefs.weeklySummaryDay);
    const now = new Date();
    const target = new Date(now);
    target.setHours(8, 0, 0, 0);

    const currentWeekday = target.getDay();
    let daysUntil = targetWeekday - currentWeekday;
    if (daysUntil < 0 || (daysUntil === 0 && target.getTime() <= now.getTime())) {
      daysUntil += 7;
    }
    target.setDate(target.getDate() + daysUntil);

    const delay = target.getTime() - now.getTime();
    this.weeklySummaryTimer = setTimeout(() => {
      this.generateWeeklySummary().catch(err =>
        console.error('[anwalts-reminder] weekly summary failed', err)
      );
      this.scheduleWeeklySummary();
    }, delay);
  }

  private weekdayToNumber(day: AnwaltsReminderPreferences['weeklySummaryDay']): number {
    switch (day) {
      case 'monday':
        return 1;
      case 'friday':
        return 5;
      case 'sunday':
      default:
        return 0;
    }
  }

  private cleanDedupKeys(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let changed = false;
    for (const [key, ts] of this.sentDedupKeys) {
      if (ts < cutoff) {
        this.sentDedupKeys.delete(key);
        changed = true;
      }
    }
    for (const [key, ts] of this.deferredDedupKeys) {
      if (ts < cutoff) {
        this.deferredDedupKeys.delete(key);
        changed = true;
      }
    }
    if (changed) {
      this.persistRuntimeState().catch(err => {
        console.error('[anwalts-reminder] persist runtime failed', err);
      });
    }
  }

  private async flushDeferredRemindersIfNeeded(): Promise<void> {
    const prefs = this.preferences$.value;
    if (this.isInQuietHours(prefs)) {
      return;
    }

    const suppressedReminders = Object.values(this.remindersMap$.value).filter(
      reminder => reminder.status === 'suppressed'
    );
    if (suppressedReminders.length === 0) {
      return;
    }

    const releasedDedupKeys = new Set<string>();
    for (const reminder of suppressedReminders) {
      const current = this.remindersMap$.value[reminder.id];
      if (!current || current.status !== 'suppressed') continue;

      this.updateReminderStatus(reminder.id, 'pending');
      await this.sendReminder({ ...current, status: 'pending' });
      releasedDedupKeys.add(current.dedupKey);
    }

    const now = Date.now();
    for (const dedupKey of releasedDedupKeys) {
      this.deferredDedupKeys.delete(dedupKey);
      this.sentDedupKeys.set(dedupKey, now);
    }
    if (releasedDedupKeys.size > 0) {
      this.persistRuntimeState().catch(err => {
        console.error('[anwalts-reminder] persist runtime failed', err);
      });
    }
  }

  private detectCalendarConflicts(): Array<{
    event1Title: string;
    event1Time: string;
    event2Title: string;
    event2Time: string;
    key: string;
  }> {
    const events = this.kalenderService.getUpcomingEvents(7)
      .filter(e => !e.allDay && e.endAt);

    const conflicts: Array<{
      event1Title: string;
      event1Time: string;
      event2Title: string;
      event2Time: string;
      key: string;
    }> = [];

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];
        const aStart = new Date(a.startAt).getTime();
        const aEnd = new Date(a.endAt!).getTime();
        const bStart = new Date(b.startAt).getTime();
        const bEnd = new Date(b.endAt!).getTime();

        if (aStart < bEnd && bStart < aEnd) {
          const key = [a.id, b.id].sort().join(':');
          conflicts.push({
            event1Title: a.title,
            event1Time: new Date(a.startAt).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
            event2Title: b.title,
            event2Time: new Date(b.startAt).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
            key,
          });
        }
      }
    }

    return conflicts;
  }

  private buildDeadlineBody(
    deadline: CaseDeadline,
    graph: any,
    minutesUntilDue: number
  ): string {
    const matterId = this.resolveMatterForDeadline(graph, deadline.id);
    const matter = matterId ? graph.matters?.[matterId] : undefined;
    const lines: string[] = [];

    lines.push(`Frist: ${deadline.title}`);
    lines.push(`Fällig: ${new Date(deadline.dueAt).toLocaleDateString('de', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`);
    if (minutesUntilDue < 0) {
      lines.push(`Status: ÜBERFÄLLIG seit ${this.formatTimeUntil(Math.abs(minutesUntilDue))}`);
    } else {
      lines.push(`Verbleibend: ${this.formatTimeUntil(minutesUntilDue)}`);
    }
    lines.push(`Priorität: ${deadline.priority}`);
    if (matter) {
      lines.push(`Akte: ${matter.title}${matter.externalRef ? ` (${matter.externalRef})` : ''}`);
    }
    if (deadline.evidenceSnippets?.length) {
      lines.push(`\nHinweise: ${deadline.evidenceSnippets.join('; ')}`);
    }

    return lines.join('\n');
  }

  private buildTerminBody(
    termin: any,
    matter: any,
    minutesUntil: number
  ): string {
    const lines: string[] = [];
    lines.push(`Termin: ${termin.gericht}`);
    const datum = new Date(termin.datum).toLocaleDateString('de', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    lines.push(`Datum: ${datum}${termin.uhrzeit ? ` um ${termin.uhrzeit}` : ''}`);
    lines.push(`In: ${this.formatTimeUntil(minutesUntil)}`);
    if (termin.saal) lines.push(`Saal: ${termin.saal}`);
    if (matter) {
      lines.push(`Akte: ${matter.title}${matter.externalRef ? ` (${matter.externalRef})` : ''}`);
    }
    if (termin.aktenzeichen) lines.push(`Aktenzeichen: ${termin.aktenzeichen}`);
    return lines.join('\n');
  }

  private resolveMatterForDeadline(graph: any, deadlineId: string): string {
    const caseFile = Object.values(graph.cases ?? {}).find((c: any) =>
      (c.deadlineIds ?? []).includes(deadlineId)
    ) as any;
    return caseFile?.matterId ?? '';
  }

  private resolveAnwaltId(): string {
    return this.resolvedAnwaltId;
  }

  private resolveAnwaltEmail(): string {
    const prefs = this.preferences$.value;
    return prefs.anwaltEmail ?? this.resolvedAnwaltEmail;
  }

  private resolveAnwaltPhone(): string {
    const prefs = this.preferences$.value;
    return prefs.anwaltPhone ?? this.resolvedAnwaltPhone;
  }

  private resolveWorkspaceId(graph: any): string {
    const firstCase = Object.values(graph.cases ?? {})[0] as any;
    return firstCase?.workspaceId ?? '';
  }

  private updateReminderStatus(
    id: string,
    status: AnwaltsReminderStatus,
    errorMessage?: string
  ): void {
    const existing = this.remindersMap$.value[id];
    if (!existing) return;

    this.remindersMap$.next({
      ...this.remindersMap$.value,
      [id]: {
        ...existing,
        status,
        sentAt: status === 'sent' || status === 'delivered' ? existing.sentAt ?? new Date().toISOString() : existing.sentAt,
        failedAt: status === 'failed' ? new Date().toISOString() : existing.failedAt,
        errorMessage: errorMessage ?? existing.errorMessage,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  getRecentReminders(limit = 50): AnwaltsReminder[] {
    return Object.values(this.remindersMap$.value)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  getActiveReminders(): AnwaltsReminder[] {
    return Object.values(this.remindersMap$.value)
      .filter(r => r.status === 'pending' || r.status === 'sent' || r.status === 'delivered')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getRemindersByCategory(category: AnwaltsReminderCategory): AnwaltsReminder[] {
    return Object.values(this.remindersMap$.value)
      .filter(r => r.category === category)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getDashboardStats(): {
    totalSent: number;
    pendingCount: number;
    failedCount: number;
    todayCount: number;
    criticalCount: number;
  } {
    const all = Object.values(this.remindersMap$.value);
    const todayStart = new Date().toISOString().slice(0, 10);
    return {
      totalSent: all.filter(r => r.status === 'sent' || r.status === 'delivered').length,
      pendingCount: all.filter(r => r.status === 'pending').length,
      failedCount: all.filter(r => r.status === 'failed').length,
      todayCount: all.filter(r => r.createdAt.startsWith(todayStart)).length,
      criticalCount: all.filter(r => r.priority === 'critical' && r.status !== 'acknowledged').length,
    };
  }

  private async hydrateState(): Promise<void> {
    const persistedPrefs = await this.store.getAnwaltsReminderPreferences<Partial<AnwaltsReminderPreferences>>();
    if (persistedPrefs) {
      this.preferences$.next({
        ...DEFAULT_PREFERENCES,
        ...persistedPrefs,
      });
    }

    const runtime = await this.store.getAnwaltsReminderRuntime<{
      lastBriefingDateKey?: string;
      lastWeeklySummaryDateKey?: string;
      sentDedupKeys?: [string, number][];
      deferredDedupKeys?: [string, number][];
    }>();
    if (runtime?.lastBriefingDateKey) {
      this.lastBriefingDateKey = runtime.lastBriefingDateKey;
    }
    if (runtime?.lastWeeklySummaryDateKey) {
      this.lastWeeklySummaryDateKey = runtime.lastWeeklySummaryDateKey;
    }
    if (runtime?.sentDedupKeys?.length) {
      this.sentDedupKeys = new Map(runtime.sentDedupKeys);
    }
    if (runtime?.deferredDedupKeys?.length) {
      this.deferredDedupKeys = new Map(runtime.deferredDedupKeys);
    }
    this.cleanDedupKeys();
  }

  private async persistPreferences(): Promise<void> {
    await this.store.setAnwaltsReminderPreferences(this.preferences$.value as unknown as Record<string, unknown>);
  }

  private async persistRuntimeState(): Promise<void> {
    await this.store.setAnwaltsReminderRuntime({
      lastBriefingDateKey: this.lastBriefingDateKey,
      lastWeeklySummaryDateKey: this.lastWeeklySummaryDateKey,
      sentDedupKeys: [...this.sentDedupKeys.entries()].slice(-4000),
      deferredDedupKeys: [...this.deferredDedupKeys.entries()].slice(-4000),
    });
  }

  private async resolveAndCacheAnwaltContext(): Promise<void> {
    const active = await this.kanzleiProfileService.getActiveAnwaelte();
    const primary = active[0];
    const profile = await this.kanzleiProfileService.getKanzleiProfile();

    this.resolvedAnwaltId = primary?.workspaceUserId ?? primary?.id ?? 'default-anwalt';
    this.resolvedAnwaltEmail = primary?.email ?? profile?.email ?? '';
    this.resolvedAnwaltPhone = primary?.phone ?? profile?.phone ?? '';

    const prefs = this.preferences$.value;
    const nextPrefs: AnwaltsReminderPreferences = {
      ...prefs,
      anwaltEmail: (prefs.anwaltEmail ?? this.resolvedAnwaltEmail) || undefined,
      anwaltPhone: (prefs.anwaltPhone ?? this.resolvedAnwaltPhone) || undefined,
    };
    this.preferences$.next(nextPrefs);
    await this.persistPreferences();
  }
}
