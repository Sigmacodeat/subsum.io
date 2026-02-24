import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { DeadlineAlert } from '../types';
import type { AnwaltsReminderService } from './anwalts-reminder';
import type { KalenderService } from './kalender';
import type { MandantenNotificationService } from './mandanten-notification';

export class DeadlineAlertService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly kalenderService: KalenderService
  ) {
    super();
  }

  readonly alerts$ = this.store.watchAlerts();
  private poller: ReturnType<typeof setInterval> | null = null;

  // Late-bound references to avoid circular DI — set via wireNotificationServices()
  private _notificationService: MandantenNotificationService | null = null;
  private _anwaltsReminderService: AnwaltsReminderService | null = null;
  /** Set of alert IDs that already triggered a notification dispatch this session */
  private _dispatchedAlertIds = new Set<string>();
  /** Retry gate for failed alert dispatch attempts (alertId -> timestamp) */
  private _dispatchFailedAt = new Map<string, number>();

  /**
   * Wire notification services after construction (avoids circular DI).
   * Called from BootstrapService.
   */
  wireNotificationServices(
    notificationService: MandantenNotificationService,
    anwaltsReminderService: AnwaltsReminderService
  ): void {
    this._notificationService = notificationService;
    this._anwaltsReminderService = anwaltsReminderService;
  }

  async start(intervalMs = 60_000) {
    const effectiveInterval =
      Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 60_000;
    this.stop();
    await this.syncNow();
    this.poller = setInterval(() => {
      this.syncNow().catch(error => {
        console.error('[case-assistant] deadline alert sync failed', error);
      });
    }, effectiveInterval);
  }

  async acknowledgeAlert(alertId: string) {
    const current = await this.store.getAlerts();
    const alert = current.find((item: DeadlineAlert) => item.id === alertId);

    if (alert && alert.id.startsWith('calendar:')) {
      const parsed = this.parseCalendarAlertId(alert.id);
      if (parsed?.eventId) {
        await this.kalenderService.markReminderSent(parsed.eventId, parsed.offsetMinutes);
      }
    }

    const next = current.filter((alert: DeadlineAlert) => alert.id !== alertId);
    await this.store.setAlerts(next);
  }

  async syncNow() {
    const graph = await this.store.getGraph();
    const now = Date.now();
    const createdAt = new Date().toISOString();

    const deadlineAlerts = Object.values(graph.cases).flatMap((caseFile: (typeof graph.cases)[string]) => {
      return caseFile.deadlineIds
        .map((id: string) => graph.deadlines[id])
        .filter((deadline: (typeof graph.deadlines)[string]) => deadline && deadline.status !== 'completed')
        .flatMap((deadline: (typeof graph.deadlines)[string]) => {
          const mirrored = this.kalenderService.getEventBySource('deadline', deadline.id);
          if (mirrored) {
            // Avoid duplicate alerts if deadline is already mirrored to calendar.
            return [];
          }

          const due = new Date(deadline.dueAt).getTime();
          if (!Number.isFinite(due)) {
            return [];
          }

          const minutesUntilDue = Math.floor((due - now) / 60_000);
          if (deadline.status !== 'open') {
            return [];
          }

          if (minutesUntilDue < 0) {
            const overdueAlert: DeadlineAlert = {
              id: `${caseFile.id}:${deadline.id}:overdue`,
              caseId: caseFile.id,
              deadlineId: deadline.id,
              title: `${deadline.title} (überfällig)`,
              dueAt: deadline.dueAt,
              minutesUntilDue,
              priority: 'high',
              source: 'deadline',
              sourceId: deadline.id,
              matterId: caseFile.matterId,
              createdAt,
            };

            return [overdueAlert];
          }

          const reminderOffsets = [...new Set(deadline.reminderOffsetsInMinutes)]
            .filter((offset: number) => Number.isFinite(offset) && offset >= 0)
            .map((offset: number) => Math.floor(offset))
            .sort((a, b) => a - b);

          if (reminderOffsets.length === 0) {
            return [];
          }

          const triggeredOffset = reminderOffsets.find(
            (offset: number) => minutesUntilDue <= offset
          );

          if (typeof triggeredOffset !== 'number') {
            return [];
          }

          const alert: DeadlineAlert = {
            id: `${caseFile.id}:${deadline.id}:offset:${triggeredOffset}`,
            caseId: caseFile.id,
            deadlineId: deadline.id,
            title: deadline.title,
            dueAt: deadline.dueAt,
            minutesUntilDue,
            priority: deadline.priority,
            source: 'deadline',
            sourceId: deadline.id,
            matterId: caseFile.matterId,
            createdAt,
          };

          return [alert];
        });
    });

    const calendarAlerts = this.kalenderService.getAllEvents().flatMap(event => {
      const due = new Date(event.startAt).getTime();
      if (!Number.isFinite(due)) {
        return [] as DeadlineAlert[];
      }

      const minutesUntilDue = Math.floor((due - now) / 60_000);
      if (minutesUntilDue < 0) {
        return [] as DeadlineAlert[];
      }

      const activeReminder = [...(event.reminders ?? [])]
        .filter(reminder => !reminder.sent)
        .sort((a, b) => a.offsetMinutes - b.offsetMinutes)
        .find(reminder => minutesUntilDue <= reminder.offsetMinutes);

      if (!activeReminder) {
        return [] as DeadlineAlert[];
      }

      const isCritical =
        event.source === 'deadline' ||
        event.source === 'gerichtstermin';

      const alert: DeadlineAlert = {
        id: `calendar:${event.id}:offset:${activeReminder.offsetMinutes}`,
        caseId: event.source === 'deadline' && event.sourceId
          ? this.resolveCaseIdForDeadlineId(graph, event.sourceId)
          : this.resolveCaseIdForMatterId(graph, event.matterId),
        deadlineId: event.sourceId ?? event.id,
        title: event.title,
        dueAt: event.startAt,
        minutesUntilDue,
        priority: isCritical ? 'high' : 'medium',
        source: event.source,
        sourceId: event.sourceId,
        matterId: event.matterId,
        createdAt,
      };

      return alert.caseId ? [alert] : [];
    });

    const deduped = new Map<string, DeadlineAlert>();
    for (const alert of [...deadlineAlerts, ...calendarAlerts]) {
      deduped.set(alert.id, alert);
    }

    const merged = [...deduped.values()].sort((a, b) => {
      return a.minutesUntilDue - b.minutesUntilDue;
    });

    await this.store.setAlerts(merged);

    // ── Dispatch notifications for new alerts ──────────────────────────
    await this.dispatchNotificationsForAlerts(merged);
  }

  /**
   * For each alert that hasn't been dispatched yet, fire:
   * 1) Mandanten-Notification (to the client via email/portal/whatsapp)
   * 2) Anwalts-Reminder (to the lawyer via email/push/whatsapp)
   */
  private async dispatchNotificationsForAlerts(alerts: DeadlineAlert[]): Promise<void> {
    const graph = await this.store.getGraph();
    const now = Date.now();

    for (const alert of alerts) {
      if (this._dispatchedAlertIds.has(alert.id)) continue;

      const lastFailedAt = this._dispatchFailedAt.get(alert.id);
      if (lastFailedAt && now - lastFailedAt < 60_000) {
        continue; // bounded retry backoff to avoid hot-loop on hard failures
      }

      // Clean up dispatch set if it grows too large
      if (this._dispatchedAlertIds.size > 5000) {
        const arr = [...this._dispatchedAlertIds];
        this._dispatchedAlertIds = new Set(arr.slice(-2500));
      }

      if (this._dispatchFailedAt.size > 5000) {
        const arr = [...this._dispatchFailedAt.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2500);
        this._dispatchFailedAt = new Map(arr);
      }

      let dispatchSucceeded = true;

      // ── Mandanten-Notification ────────────────────────────────────
      if (this._notificationService && alert.matterId) {
        const matter = graph.matters?.[alert.matterId];
        const clientId = matter?.clientId;
        if (clientId) {
          const isOverdue = alert.minutesUntilDue < 0;
          const event = isOverdue ? 'deadline.expired' as const : 'deadline.approaching' as const;

          try {
            await this._notificationService.fireEvent({
              workspaceId: matter.workspaceId ?? Object.values(graph.cases)[0]?.workspaceId ?? '',
              event,
              clientId,
              matterId: alert.matterId,
              caseId: alert.caseId,
              variables: {
                fristTitel: alert.title,
                fristDatum: new Date(alert.dueAt).toLocaleDateString('de', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                }),
                aktenTitel: matter.title ?? '',
                aktenzeichen: matter.externalRef ?? '',
                handlungsbedarf: isOverdue
                  ? 'Diese Frist ist bereits abgelaufen. Bitte setzen Sie sich umgehend mit uns in Verbindung.'
                  : `Die Frist läuft in ${this.formatMinutes(alert.minutesUntilDue)} ab.`,
              },
            });
          } catch (err) {
            dispatchSucceeded = false;
            console.error('[deadline-alert] notification dispatch failed', err);
          }
        }
      }

      // ── Anwalt-Reminder (owner-side warning) ─────────────────────────
      if (this._anwaltsReminderService) {
        try {
          await this._anwaltsReminderService.dispatchFromDeadlineAlert(alert);
        } catch (err) {
          dispatchSucceeded = false;
          console.error('[deadline-alert] lawyer reminder dispatch failed', err);
        }
      }

      if (dispatchSucceeded) {
        this._dispatchedAlertIds.add(alert.id);
        this._dispatchFailedAt.delete(alert.id);
      } else {
        this._dispatchFailedAt.set(alert.id, now);
      }
    }
  }

  private formatMinutes(minutes: number): string {
    if (minutes < 0) return 'überfällig';
    if (minutes < 60) return `${minutes} Minuten`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} Stunden`;
    const days = Math.floor(minutes / 1440);
    return days === 1 ? '1 Tag' : `${days} Tagen`;
  }

  stop() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  override dispose(): void {
    this.stop();
    super.dispose();
  }

  private parseCalendarAlertId(alertId: string): { eventId: string; offsetMinutes: number } | null {
    // Format: calendar:<eventId>:offset:<minutes>
    const prefix = 'calendar:';
    if (!alertId.startsWith(prefix)) return null;
    const marker = ':offset:';
    const markerIndex = alertId.lastIndexOf(marker);
    if (markerIndex < 0) return null;

    const eventId = alertId.slice(prefix.length, markerIndex);
    const offsetStr = alertId.slice(markerIndex + marker.length);
    const offsetMinutes = Number(offsetStr);
    if (!eventId || !Number.isFinite(offsetMinutes)) return null;
    return { eventId, offsetMinutes };
  }

  private resolveCaseIdForDeadlineId(
    graph: Awaited<ReturnType<CaseAssistantStore['getGraph']>>,
    deadlineId: string
  ): string {
    const match = Object.values(graph.cases).find((caseFile: (typeof graph.cases)[string]) =>
      (caseFile.deadlineIds ?? []).includes(deadlineId)
    );
    return match?.id ?? '';
  }

  private resolveCaseIdForMatterId(
    graph: Awaited<ReturnType<CaseAssistantStore['getGraph']>>,
    matterId?: string
  ): string {
    if (!matterId) return '';
    const match = Object.values(graph.cases).find((caseFile: (typeof graph.cases)[string]) =>
      caseFile.matterId === matterId
    );
    return match?.id ?? '';
  }
}
