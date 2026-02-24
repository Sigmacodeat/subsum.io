import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { KalenderEvent, KalenderExportResult } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function generateICalUid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@subsumio.com`;
}

export class KalenderService extends Service {
  private eventsMap$ = new BehaviorSubject<Record<string, KalenderEvent>>({});
  private reminderPolicyBySource: Record<KalenderEvent['source'], number[]> = {
    deadline: [20160, 10080, 1440, 180, 60],
    wiedervorlage: [1440, 120],
    gerichtstermin: [2880, 1440, 120],
    user: [1440],
  };

  readonly eventsList$ = this.eventsMap$.pipe(map(map => Object.values(map)));

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  getEventBySource(source: KalenderEvent['source'], sourceId: string): KalenderEvent | null {
    if (!sourceId) return null;
    const events = Object.values(this.eventsMap$.value);
    return events.find(e => e.source === source && e.sourceId === sourceId) ?? null;
  }

  getEventsBySource(source: KalenderEvent['source'], sourceId: string): KalenderEvent[] {
    if (!sourceId) return [];
    const events = Object.values(this.eventsMap$.value);
    return events.filter(e => e.source === source && e.sourceId === sourceId);
  }

  getAllEvents(): KalenderEvent[] {
    return Object.values(this.eventsMap$.value).sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  }

  listReminderPolicies(): Record<KalenderEvent['source'], number[]> {
    return {
      deadline: [...this.reminderPolicyBySource.deadline],
      wiedervorlage: [...this.reminderPolicyBySource.wiedervorlage],
      gerichtstermin: [...this.reminderPolicyBySource.gerichtstermin],
      user: [...this.reminderPolicyBySource.user],
    };
  }

  getReminderPolicyForSource(source: KalenderEvent['source']): number[] {
    return [...(this.reminderPolicyBySource[source] ?? [1440])];
  }

  setReminderPolicyForSource(source: KalenderEvent['source'], offsets: number[]): number[] {
    const normalized = [...new Set(offsets)]
      .filter(offset => Number.isFinite(offset) && offset >= 0)
      .map(offset => Math.floor(offset))
      .sort((a, b) => b - a);

    this.reminderPolicyBySource[source] = normalized.length > 0 ? normalized : [1440];
    return [...this.reminderPolicyBySource[source]];
  }

  resetReminderPolicyForSource(source: KalenderEvent['source']): number[] {
    const defaults: Record<KalenderEvent['source'], number[]> = {
      deadline: [20160, 10080, 1440, 180, 60],
      wiedervorlage: [1440, 120],
      gerichtstermin: [2880, 1440, 120],
      user: [1440],
    };
    this.reminderPolicyBySource[source] = [...defaults[source]];
    return [...this.reminderPolicyBySource[source]];
  }

  getEventsForMatter(matterId: string): KalenderEvent[] {
    return Object.values(this.eventsMap$.value)
      .filter(e => e.matterId === matterId)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }

  getUpcomingEvents(days: number = 30): KalenderEvent[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return Object.values(this.eventsMap$.value)
      .filter(e => {
        const eventDate = new Date(e.startAt);
        return eventDate >= now && eventDate <= future;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }

  getEventsForDateRange(start: string, end: string): KalenderEvent[] {
    return Object.values(this.eventsMap$.value)
      .filter(e => {
        const eventDate = new Date(e.startAt);
        return eventDate >= new Date(start) && eventDate <= new Date(end);
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }

  async createEvent(input: {
    workspaceId: string;
    matterId?: string;
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    allDay?: boolean;
    location?: string;
    source?: KalenderEvent['source'];
    sourceId?: string;
    reminders?: Array<{ offsetMinutes: number }>;
  }): Promise<KalenderEvent> {
    const now = new Date().toISOString();
    const source = input.source ?? 'user';
    const reminderOffsets = input.reminders?.map(r => r.offsetMinutes) ?? this.getReminderPolicyForSource(source);
    const reminders = [...new Set(reminderOffsets)]
      .filter(offset => Number.isFinite(offset) && offset >= 0)
      .map(offset => Math.floor(offset))
      .sort((a, b) => b - a)
      .map(offsetMinutes => ({ offsetMinutes, sent: false }));

    const event: KalenderEvent = {
      id: createId('kevt'),
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      allDay: input.allDay ?? true,
      location: input.location,
      reminders,
      source,
      sourceId: input.sourceId,
      iCalUid: generateICalUid(),
      createdAt: now,
      updatedAt: now,
    };

    this.eventsMap$.next({
      ...this.eventsMap$.value,
      [event.id]: event,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: 'kalender.event.created',
      severity: 'info',
      details: `Kalender-Event erstellt: ${event.title}`,
      metadata: {
        eventId: event.id,
        source: event.source,
        startAt: event.startAt,
      },
    });

    return event;
  }

  async upsertEventForSource(input: {
    workspaceId: string;
    matterId?: string;
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    allDay: boolean;
    location?: string;
    reminders?: Array<{ offsetMinutes: number }>;
    source: KalenderEvent['source'];
    sourceId: string;
  }): Promise<KalenderEvent> {
    const existing = this.getEventBySource(input.source, input.sourceId);
    const reminderOffsets = input.reminders?.map(r => r.offsetMinutes) ?? this.getReminderPolicyForSource(input.source);
    const normalizedReminders = [...new Set(reminderOffsets)]
      .filter(offset => Number.isFinite(offset) && offset >= 0)
      .map(offset => Math.floor(offset))
      .sort((a, b) => b - a)
      .map(offsetMinutes => ({ offsetMinutes, sent: false }));

    if (existing) {
      const updated = await this.updateEvent(existing.id, {
        workspaceId: input.workspaceId,
        matterId: input.matterId,
        title: input.title,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: input.allDay,
        location: input.location,
        reminders: normalizedReminders,
        source: input.source,
        sourceId: input.sourceId,
      });
      return updated ?? existing;
    }

    return this.createEvent({
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      allDay: input.allDay,
      location: input.location,
      reminders: input.reminders,
      source: input.source,
      sourceId: input.sourceId,
    });
  }

  async deleteEventsForSource(source: KalenderEvent['source'], sourceId: string): Promise<number> {
    const items = this.getEventsBySource(source, sourceId);
    if (items.length === 0) return 0;
    for (const item of items) {
      await this.deleteEvent(item.id);
    }
    return items.length;
  }

  async updateEvent(
    eventId: string,
    updates: Partial<KalenderEvent>
  ): Promise<KalenderEvent | null> {
    const existing = this.eventsMap$.value[eventId];
    if (!existing) return null;

    const updated: KalenderEvent = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.eventsMap$.next({
      ...this.eventsMap$.value,
      [eventId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: updated.workspaceId,
      action: 'kalender.event.updated',
      severity: 'info',
      details: `Kalender-Event aktualisiert: ${updated.title}`,
      metadata: {
        eventId: updated.id,
        source: updated.source,
      },
    });

    return updated;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    const existing = this.eventsMap$.value[eventId];
    if (!existing) return false;

    const updatedMap = { ...this.eventsMap$.value };
    delete updatedMap[eventId];
    this.eventsMap$.next(updatedMap);

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      action: 'kalender.event.deleted',
      severity: 'warning',
      details: `Kalender-Event gelöscht: ${existing.title}`,
      metadata: {
        eventId: existing.id,
        source: existing.source,
      },
    });

    return true;
  }

  async markReminderSent(eventId: string, offsetMinutes: number): Promise<void> {
    const existing = this.eventsMap$.value[eventId];
    if (!existing) return;

    const updatedReminders = existing.reminders.map(r =>
      r.offsetMinutes === offsetMinutes ? { ...r, sent: true } : r
    );

    await this.updateEvent(eventId, { reminders: updatedReminders });
  }

  async markAllRemindersSent(eventId: string): Promise<void> {
    const existing = this.eventsMap$.value[eventId];
    if (!existing) return;

    await this.updateEvent(eventId, {
      reminders: existing.reminders.map(r => ({ ...r, sent: true })),
    });
  }

  async syncWithExternalProvider(
    eventId: string,
    provider: 'google' | 'outlook' | 'apple' | 'ical'
  ): Promise<KalenderEvent | null> {
    const existing = this.eventsMap$.value[eventId];
    if (!existing) return null;

    // In a real implementation, this would call the external API
    return this.updateEvent(eventId, {
      externalProvider: provider,
      externalSyncedAt: new Date().toISOString(),
    });
  }

  exportToICal(
    input?:
      | string
      | {
          matterId?: string;
          sources?: KalenderEvent['source'][];
        }
  ): KalenderExportResult {
    const resolved =
      typeof input === 'string'
        ? ({ matterId: input } as { matterId?: string; sources?: KalenderEvent['source'][] })
        : (input ?? {});

    const baseEvents = resolved.matterId
      ? this.getEventsForMatter(resolved.matterId)
      : Object.values(this.eventsMap$.value);

    const events = resolved.sources && resolved.sources.length > 0
      ? baseEvents.filter(e => resolved.sources!.includes(e.source))
      : baseEvents;

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Subsumio Legal//Legal Calendar//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Subsumio Legal Kalender',
      'X-WR-TIMEZONE:Europe/Vienna',
    ];

    for (const event of events) {
      lines.push(...this.eventToICal(event));
    }

    lines.push('END:VCALENDAR');

    return {
      iCalContent: lines.join('\r\n'),
      eventCount: events.length,
      exportedAt: new Date().toISOString(),
    };
  }

  private eventToICal(event: KalenderEvent): string[] {
    const lines: string[] = ['BEGIN:VEVENT'];

    lines.push(`UID:${event.iCalUid ?? generateICalUid()}`);
    lines.push(`DTSTAMP:${this.formatICalDate(new Date())}`);
    lines.push(`DTSTART${event.allDay ? ';VALUE=DATE' : ''}:${this.formatICalDate(new Date(event.startAt), event.allDay)}`);

    if (event.endAt) {
      lines.push(`DTEND${event.allDay ? ';VALUE=DATE' : ''}:${this.formatICalDate(new Date(event.endAt), event.allDay)}`);
    }

    lines.push(`SUMMARY:${this.escapeICalText(event.title)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${this.escapeICalText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${this.escapeICalText(event.location)}`);
    }

    // Add reminders as VALARM
    for (const reminder of event.reminders) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Erinnerung: ${event.title}`);
      lines.push(`TRIGGER:-PT${reminder.offsetMinutes}M`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');

    return lines;
  }

  private formatICalDate(date: Date, allDay: boolean = false): string {
    if (allDay) {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    }
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  async importFromICal(iCalContent: string, workspaceId: string): Promise<number> {
    const events = this.parseICal(iCalContent);
    let imported = 0;

    for (const event of events) {
      await this.createEvent({
        workspaceId,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        location: event.location,
      });
      imported++;
    }

    return imported;
  }

  private parseICal(content: string): Array<{
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    allDay: boolean;
    location?: string;
  }> {
    const events: Array<{
      title: string;
      description?: string;
      startAt: string;
      endAt?: string;
      allDay: boolean;
      location?: string;
    }> = [];

    const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
    let match;

    while ((match = veventRegex.exec(content)) !== null) {
      const eventContent = match[1];

      const summary = eventContent.match(/SUMMARY:(.*?)(?:\r?\n)/i)?.[1] ?? 'Ohne Titel';
      const description = eventContent.match(/DESCRIPTION:(.*?)(?:\r?\n)/i)?.[1];
      const dtstart = eventContent.match(/DTSTART(?:;VALUE=DATE)?:(.*?)(?:\r?\n)/i)?.[1];
      const dtend = eventContent.match(/DTEND(?:;VALUE=DATE)?:(.*?)(?:\r?\n)/i)?.[1];
      const location = eventContent.match(/LOCATION:(.*?)(?:\r?\n)/i)?.[1];

      if (dtstart) {
        events.push({
          title: this.unescapeICalText(summary),
          description: description ? this.unescapeICalText(description) : undefined,
          startAt: this.parseICalDate(dtstart),
          endAt: dtend ? this.parseICalDate(dtend) : undefined,
          allDay: dtstart.length === 8,
          location: location ? this.unescapeICalText(location) : undefined,
        });
      }
    }

    return events;
  }

  private parseICalDate(dateStr: string): string {
    if (dateStr.length === 8) {
      // All-day event: YYYYMMDD
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    // DateTime: YYYYMMDDTHHMMSSZ
    const cleaned = dateStr.replace('Z', '');
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}Z`;
  }

  private unescapeICalText(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }
}
