import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CaseDeadline } from '../types';
import type { CaseAssistantStore } from '../stores/case-assistant';
import type { KalenderService } from './kalender';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TagesjournalEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD
  workspaceId: string;
  generatedAt: string;
  sections: TagesjournalSection[];
  /** Stats summary for the header */
  stats: TagesjournalStats;
}

export interface TagesjournalStats {
  overdueDeadlines: number;
  todayDeadlines: number;
  weekDeadlines: number;
  todayTermine: number;
  todayWiedervorlagen: number;
  todayCalendarEvents: number;
  activeMatters: number;
  totalOpenDeadlines: number;
}

export type TagesjournalSectionKind =
  | 'overdue_deadlines'
  | 'today_deadlines'
  | 'today_termine'
  | 'today_wiedervorlagen'
  | 'today_calendar'
  | 'week_deadlines'
  | 'week_termine'
  | 'active_matters_summary'
  | 'notes';

export interface TagesjournalSection {
  kind: TagesjournalSectionKind;
  title: string;
  icon: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  items: TagesjournalItem[];
  collapsed?: boolean;
}

export interface TagesjournalItem {
  id: string;
  label: string;
  sublabel?: string;
  time?: string;
  /** Link target: matterId, deadlineId, terminId, etc. */
  linkType?: 'matter' | 'deadline' | 'termin' | 'calendar_event';
  linkId?: string;
  matterId?: string;
  urgency?: 'critical' | 'soon' | 'normal';
  /** Status chip text */
  statusText?: string;
  statusVariant?: 'danger' | 'warning' | 'success' | 'neutral';
}

export const TAGESJOURNAL_SECTION_LABELS: Record<TagesjournalSectionKind, string> = {
  overdue_deadlines: 'Überfällige Fristen',
  today_deadlines: 'Fristen heute',
  today_termine: 'Gerichtstermine heute',
  today_wiedervorlagen: 'Wiedervorlagen heute',
  today_calendar: 'Weitere Termine heute',
  week_deadlines: 'Fristen diese Woche',
  week_termine: 'Termine diese Woche',
  active_matters_summary: 'Aktive Akten',
  notes: 'Tagesnotizen',
};

export const TAGESJOURNAL_SECTION_ICONS: Record<TagesjournalSectionKind, string> = {
  overdue_deadlines: '🚨',
  today_deadlines: '📋',
  today_termine: '⚖️',
  today_wiedervorlagen: '📌',
  today_calendar: '📅',
  week_deadlines: '📆',
  week_termine: '🗓️',
  active_matters_summary: '📂',
  notes: '📝',
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * AnwaltsTagesjournalService — Generates a structured daily agenda for the lawyer.
 *
 * Instead of AFFiNE's generic empty journal page, this creates a rich,
 * structured daily view containing:
 *
 * 1. Overdue deadlines (CRITICAL — red alarm)
 * 2. Today's deadlines
 * 3. Today's court dates (Gerichtstermine)
 * 4. Today's Wiedervorlagen
 * 5. Other calendar events
 * 6. This week's upcoming deadlines
 * 7. This week's upcoming Termine
 * 8. Active matters summary
 *
 * The journal is auto-generated on first access per day and cached.
 * It can be refreshed manually.
 */
export class AnwaltsTagesjournalService extends Service {
  private journalCache$ = new BehaviorSubject<Record<string, TagesjournalEntry>>({});

  readonly todayJournal$ = this.journalCache$.pipe(
    map(cache => {
      const todayKey = new Date().toISOString().slice(0, 10);
      return cache[todayKey] ?? null;
    })
  );

  constructor(
    private readonly store: CaseAssistantStore,
    private readonly kalenderService: KalenderService
  ) {
    super();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATE JOURNAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get or generate the journal for a specific date.
   * Cached per day — regenerates if stale (>5 min) or forced.
   */
  async getJournalForDate(dateKey: string, force = false): Promise<TagesjournalEntry> {
    const cached = this.journalCache$.value[dateKey];
    if (cached && !force) {
      const ageMs = Date.now() - new Date(cached.generatedAt).getTime();
      if (ageMs < 5 * 60 * 1000) return cached; // <5min old — use cache
    }

    return this.generateJournal(dateKey);
  }

  /**
   * Get today's journal (most common use case).
   */
  async getTodayJournal(force = false): Promise<TagesjournalEntry> {
    const todayKey = new Date().toISOString().slice(0, 10);
    return this.getJournalForDate(todayKey, force);
  }

  /**
   * Force-refresh the journal for today.
   */
  async refreshTodayJournal(): Promise<TagesjournalEntry> {
    return this.getTodayJournal(true);
  }

  private async generateJournal(dateKey: string): Promise<TagesjournalEntry> {
    const graph = await this.store.getGraph();
    const now = Date.now();
    const dayStart = new Date(dateKey).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const weekEnd = dayStart + 7 * 24 * 60 * 60 * 1000;

    const workspaceId = (Object.values(graph.cases ?? {})[0] as any)?.workspaceId ?? '';
    const sections: TagesjournalSection[] = [];

    // ── 1. Overdue Deadlines ─────────────────────────────────────────────
    const overdueDeadlines = this.collectDeadlines(graph, d => {
      const due = new Date(d.dueAt).getTime();
      return Number.isFinite(due) && due < now && d.status === 'open';
    });
    if (overdueDeadlines.length > 0) {
      sections.push({
        kind: 'overdue_deadlines',
        title: TAGESJOURNAL_SECTION_LABELS.overdue_deadlines,
        icon: TAGESJOURNAL_SECTION_ICONS.overdue_deadlines,
        priority: 'critical',
        items: overdueDeadlines.map(({ deadline, matter }) => {
          const daysOverdue = Math.floor((now - new Date(deadline.dueAt).getTime()) / (24 * 60 * 60 * 1000));
          return {
            id: deadline.id,
            label: deadline.title,
            sublabel: matter ? `${matter.title}${matter.externalRef ? ` (${matter.externalRef})` : ''}` : undefined,
            time: `${daysOverdue} Tag${daysOverdue !== 1 ? 'e' : ''} überfällig`,
            linkType: 'deadline' as const,
            linkId: deadline.id,
            matterId: matter?.id,
            urgency: 'critical' as const,
            statusText: 'ÜBERFÄLLIG',
            statusVariant: 'danger' as const,
          };
        }),
      });
    }

    // ── 2. Today's Deadlines ─────────────────────────────────────────────
    const todayDeadlines = this.collectDeadlines(graph, d => {
      const due = new Date(d.dueAt).getTime();
      return Number.isFinite(due) && due >= dayStart && due < dayEnd && d.status === 'open';
    });
    if (todayDeadlines.length > 0) {
      sections.push({
        kind: 'today_deadlines',
        title: TAGESJOURNAL_SECTION_LABELS.today_deadlines,
        icon: TAGESJOURNAL_SECTION_ICONS.today_deadlines,
        priority: 'high',
        items: todayDeadlines.map(({ deadline, matter }) => ({
          id: deadline.id,
          label: deadline.title,
          sublabel: matter ? matter.title : undefined,
          time: new Date(deadline.dueAt).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
          linkType: 'deadline' as const,
          linkId: deadline.id,
          matterId: matter?.id,
          urgency: 'soon' as const,
          statusText: `Priorität: ${deadline.priority}`,
          statusVariant: deadline.priority === 'high' ? 'warning' as const : 'neutral' as const,
        })),
      });
    }

    // ── 3. Today's Court Dates ───────────────────────────────────────────
    const todayTermine = Object.values(graph.termine ?? {})
      .filter(t => {
        if (t.status === 'abgesagt' || t.status === 'abgeschlossen') return false;
        const tDate = new Date(t.datum).getTime();
        return Number.isFinite(tDate) && tDate >= dayStart && tDate < dayEnd;
      })
      .sort((a, b) => {
        const aTime = a.uhrzeit ?? '00:00';
        const bTime = b.uhrzeit ?? '00:00';
        return aTime.localeCompare(bTime);
      });

    if (todayTermine.length > 0) {
      sections.push({
        kind: 'today_termine',
        title: TAGESJOURNAL_SECTION_LABELS.today_termine,
        icon: TAGESJOURNAL_SECTION_ICONS.today_termine,
        priority: 'high',
        items: todayTermine.map(t => {
          const matter = graph.matters?.[t.matterId];
          return {
            id: t.id,
            label: t.gericht,
            sublabel: matter ? `${matter.title}${matter.externalRef ? ` (${matter.externalRef})` : ''}` : undefined,
            time: t.uhrzeit ?? 'ganztägig',
            linkType: 'termin' as const,
            linkId: t.id,
            matterId: t.matterId,
            urgency: 'soon' as const,
            statusText: t.saal ? `Saal ${t.saal}` : t.status,
            statusVariant: 'neutral' as const,
          };
        }),
      });
    }

    // ── 4. Today's Wiedervorlagen ────────────────────────────────────────
    const todayWiedervorlagen = this.kalenderService.getAllEvents()
      .filter(e => {
        if (e.source !== 'wiedervorlage') return false;
        const eDate = new Date(e.startAt).getTime();
        return Number.isFinite(eDate) && eDate >= dayStart && eDate < dayEnd;
      });

    if (todayWiedervorlagen.length > 0) {
      sections.push({
        kind: 'today_wiedervorlagen',
        title: TAGESJOURNAL_SECTION_LABELS.today_wiedervorlagen,
        icon: TAGESJOURNAL_SECTION_ICONS.today_wiedervorlagen,
        priority: 'normal',
        items: todayWiedervorlagen.map(w => ({
          id: w.id,
          label: w.title,
          sublabel: w.description ?? undefined,
          time: w.allDay ? 'ganztägig' : new Date(w.startAt).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
          linkType: 'calendar_event' as const,
          linkId: w.id,
          matterId: w.matterId,
          urgency: 'normal' as const,
        })),
      });
    }

    // ── 5. Other Calendar Events Today ───────────────────────────────────
    const otherCalendarEvents = this.kalenderService.getAllEvents()
      .filter(e => {
        if (e.source === 'wiedervorlage' || e.source === 'deadline') return false;
        const eDate = new Date(e.startAt).getTime();
        return Number.isFinite(eDate) && eDate >= dayStart && eDate < dayEnd;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    if (otherCalendarEvents.length > 0) {
      sections.push({
        kind: 'today_calendar',
        title: TAGESJOURNAL_SECTION_LABELS.today_calendar,
        icon: TAGESJOURNAL_SECTION_ICONS.today_calendar,
        priority: 'normal',
        items: otherCalendarEvents.map(e => ({
          id: e.id,
          label: e.title,
          sublabel: e.location ?? undefined,
          time: e.allDay ? 'ganztägig' : new Date(e.startAt).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
          linkType: 'calendar_event' as const,
          linkId: e.id,
          matterId: e.matterId,
          urgency: 'normal' as const,
        })),
      });
    }

    // ── 6. This Week's Deadlines (next 7 days, excluding today) ──────────
    const weekDeadlines = this.collectDeadlines(graph, d => {
      const due = new Date(d.dueAt).getTime();
      return Number.isFinite(due) && due >= dayEnd && due < weekEnd && d.status === 'open';
    });
    if (weekDeadlines.length > 0) {
      sections.push({
        kind: 'week_deadlines',
        title: TAGESJOURNAL_SECTION_LABELS.week_deadlines,
        icon: TAGESJOURNAL_SECTION_ICONS.week_deadlines,
        priority: 'normal',
        collapsed: true,
        items: weekDeadlines.slice(0, 15).map(({ deadline, matter }) => ({
          id: deadline.id,
          label: deadline.title,
          sublabel: matter ? matter.title : undefined,
          time: new Date(deadline.dueAt).toLocaleDateString('de', { weekday: 'short', day: '2-digit', month: '2-digit' }),
          linkType: 'deadline' as const,
          linkId: deadline.id,
          matterId: matter?.id,
          urgency: 'normal' as const,
          statusText: `Priorität: ${deadline.priority}`,
          statusVariant: deadline.priority === 'high' ? 'warning' as const : 'neutral' as const,
        })),
      });
    }

    // ── 7. This Week's Termine (next 7 days, excluding today) ────────────
    const weekTermine = Object.values(graph.termine ?? {})
      .filter(t => {
        if (t.status === 'abgesagt' || t.status === 'abgeschlossen') return false;
        const tDate = new Date(t.datum).getTime();
        return Number.isFinite(tDate) && tDate >= dayEnd && tDate < weekEnd;
      })
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());

    if (weekTermine.length > 0) {
      sections.push({
        kind: 'week_termine',
        title: TAGESJOURNAL_SECTION_LABELS.week_termine,
        icon: TAGESJOURNAL_SECTION_ICONS.week_termine,
        priority: 'normal',
        collapsed: true,
        items: weekTermine.slice(0, 10).map(t => {
          const matter = graph.matters?.[t.matterId];
          return {
            id: t.id,
            label: t.gericht,
            sublabel: matter ? matter.title : undefined,
            time: `${new Date(t.datum).toLocaleDateString('de', { weekday: 'short', day: '2-digit', month: '2-digit' })}${t.uhrzeit ? ` ${t.uhrzeit}` : ''}`,
            linkType: 'termin' as const,
            linkId: t.id,
            matterId: t.matterId,
            urgency: 'normal' as const,
          };
        }),
      });
    }

    // ── 8. Active Matters Summary ────────────────────────────────────────
    const activeMatters = Object.values(graph.matters ?? {})
      .filter((m: any) => !m.trashedAt && (m.status === 'active' || m.status === 'pending'))
      .sort((a: any, b: any) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

    if (activeMatters.length > 0) {
      sections.push({
        kind: 'active_matters_summary',
        title: TAGESJOURNAL_SECTION_LABELS.active_matters_summary,
        icon: TAGESJOURNAL_SECTION_ICONS.active_matters_summary,
        priority: 'low',
        collapsed: true,
        items: activeMatters.slice(0, 20).map((m: any) => {
          const client = m.clientId ? graph.clients?.[m.clientId] : undefined;
          const matterDeadlines = Object.values(graph.cases ?? {})
            .filter((c: any) => c.matterId === m.id)
            .flatMap((c: any) => (c.deadlineIds ?? []))
            .map((id: string) => graph.deadlines?.[id])
            .filter((d: any) => d && d.status === 'open');

          return {
            id: m.id,
            label: `${m.title}${m.externalRef ? ` (${m.externalRef})` : ''}`,
            sublabel: client ? `Mandant: ${client.displayName}` : undefined,
            linkType: 'matter' as const,
            linkId: m.id,
            matterId: m.id,
            urgency: 'normal' as const,
            statusText: `${matterDeadlines.length} offene Fristen`,
            statusVariant: matterDeadlines.length > 3 ? 'warning' as const : 'neutral' as const,
          };
        }),
      });
    }

    // ── 9. Empty Notes Section (for user-added content) ──────────────────
    sections.push({
      kind: 'notes',
      title: TAGESJOURNAL_SECTION_LABELS.notes,
      icon: TAGESJOURNAL_SECTION_ICONS.notes,
      priority: 'low',
      items: [],
    });

    // ── Build Stats ──────────────────────────────────────────────────────
    const totalOpenDeadlines = (Object.values(graph.deadlines ?? {}) as CaseDeadline[])
      .filter(d => d.status === 'open').length;

    const stats: TagesjournalStats = {
      overdueDeadlines: overdueDeadlines.length,
      todayDeadlines: todayDeadlines.length,
      weekDeadlines: weekDeadlines.length,
      todayTermine: todayTermine.length,
      todayWiedervorlagen: todayWiedervorlagen.length,
      todayCalendarEvents: otherCalendarEvents.length,
      activeMatters: activeMatters.length,
      totalOpenDeadlines,
    };

    const entry: TagesjournalEntry = {
      id: createId('tj'),
      dateKey,
      workspaceId,
      generatedAt: new Date().toISOString(),
      sections,
      stats,
    };

    // Cache
    this.journalCache$.next({
      ...this.journalCache$.value,
      [dateKey]: entry,
    });

    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT TO MARKDOWN (for pasting into AFFiNE journal doc)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Export journal as Markdown — can be injected into AFFiNE's journal doc template.
   */
  journalToMarkdown(entry: TagesjournalEntry): string {
    const lines: string[] = [];
    const dateFormatted = new Date(entry.dateKey).toLocaleDateString('de', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });

    lines.push(`# Tagesprogramm — ${dateFormatted}\n`);

    // Stats bar
    const s = entry.stats;
    const statParts: string[] = [];
    if (s.overdueDeadlines > 0) statParts.push(`🚨 ${s.overdueDeadlines} überfällig`);
    if (s.todayDeadlines > 0) statParts.push(`📋 ${s.todayDeadlines} Fristen heute`);
    if (s.todayTermine > 0) statParts.push(`⚖️ ${s.todayTermine} Termine`);
    if (s.todayWiedervorlagen > 0) statParts.push(`📌 ${s.todayWiedervorlagen} Wiedervorlagen`);
    statParts.push(`📂 ${s.activeMatters} aktive Akten`);
    lines.push(`> ${statParts.join(' · ')}\n`);

    for (const section of entry.sections) {
      if (section.items.length === 0 && section.kind !== 'notes') continue;

      lines.push(`## ${section.icon} ${section.title}\n`);

      if (section.kind === 'notes') {
        lines.push('*(Platz für Ihre Tagesnotizen)*\n');
        lines.push('- \n');
        continue;
      }

      for (const item of section.items) {
        let line = `- **${item.label}**`;
        if (item.time) line += ` — ${item.time}`;
        if (item.sublabel) line += `\n  ${item.sublabel}`;
        if (item.statusText) line += ` [${item.statusText}]`;
        lines.push(line);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private collectDeadlines(
    graph: any,
    filter: (d: CaseDeadline) => boolean
  ): Array<{ deadline: CaseDeadline; matter: any }> {
    const deadlines = Object.values(graph.deadlines ?? {}) as CaseDeadline[];
    return deadlines
      .filter(d => d.status !== 'completed' && d.status !== 'acknowledged' && filter(d))
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .map(deadline => {
        const caseFile = Object.values(graph.cases ?? {}).find((c: any) =>
          (c.deadlineIds ?? []).includes(deadline.id)
        ) as any;
        const matter = caseFile?.matterId ? graph.matters?.[caseFile.matterId] : undefined;
        return { deadline, matter };
      });
  }

  /**
   * Get date keys that have journal entries (for calendar dot indicators).
   */
  getJournalDateKeys(): Set<string> {
    return new Set(Object.keys(this.journalCache$.value));
  }

  /**
   * Check if a specific date has items worth showing.
   */
  async hasItemsForDate(dateKey: string): Promise<boolean> {
    const journal = await this.getJournalForDate(dateKey);
    return journal.sections.some(s => s.items.length > 0 && s.kind !== 'notes');
  }
}
