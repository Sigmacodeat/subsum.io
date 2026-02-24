import { useService } from '@toeverything/infra';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { useMemo, useState, type RefObject } from 'react';

import type { KalenderEvent } from '@affine/core/modules/case-assistant';
import { KalenderService } from '@affine/core/modules/case-assistant';
import * as localStyles from './conflict-center-section.css';

const SOURCE_LABEL: Record<KalenderEvent['source'], string> = {
  deadline: 'Frist',
  wiedervorlage: 'Wiedervorlage',
  gerichtstermin: 'Gerichtstermin',
  user: 'Manuell',
};

const SOURCE_COLOR: Record<KalenderEvent['source'], string> = {
  deadline: cssVarV2('status/error'),
  wiedervorlage: cssVarV2('button/primary'),
  gerichtstermin: cssVarV2('button/primary'),
  user: cssVarV2('text/secondary'),
};

const SOURCE_BG: Record<KalenderEvent['source'], string> = {
  deadline: cssVarV2('layer/background/secondary'),
  wiedervorlage: cssVarV2('layer/background/secondary'),
  gerichtstermin: cssVarV2('layer/background/secondary'),
  user: cssVarV2('layer/background/secondary'),
};

type Collision = {
  id: string;
  day: string;
  kind: 'time-overlap' | 'same-day';
  a: KalenderEvent;
  b: KalenderEvent;
};

function toMinutes(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function dayOf(value: string): string {
  return value.split('T')[0];
}

type ViewMode = 'conflicts' | 'timeline';

export function ConflictCenterSection({
  sectionRef,
  matterId,
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  matterId?: string;
}) {
  const kalenderService = useService(KalenderService);
  const [viewMode, setViewMode] = useState<ViewMode>('conflicts');

  const events = useMemo(() => {
    if (!matterId) return [] as KalenderEvent[];
    return kalenderService
      .getEventsForMatter(matterId)
      .filter(event => event.source !== 'user' || event.title.trim().length > 0)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [kalenderService, matterId]);

  const collisions = useMemo(() => {
    const result: Collision[] = [];

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];

        const dayA = dayOf(a.startAt);
        const dayB = dayOf(b.startAt);
        if (dayA !== dayB) continue;

        const aTime = toMinutes(a.startAt);
        const bTime = toMinutes(b.startAt);

        if (a.allDay || b.allDay || aTime === null || bTime === null) {
          result.push({
            id: `${a.id}:${b.id}:same-day`,
            day: dayA,
            kind: 'same-day',
            a,
            b,
          });
          continue;
        }

        const aEnd = aTime + 120;
        const bEnd = bTime + 120;
        const overlaps = aTime < bEnd && bTime < aEnd;

        if (overlaps) {
          result.push({
            id: `${a.id}:${b.id}:time-overlap`,
            day: dayA,
            kind: 'time-overlap',
            a,
            b,
          });
        }
      }
    }

    return result;
  }, [events]);

  const grouped = useMemo(() => {
    const map = new Map<string, Collision[]>();
    for (const col of collisions) {
      if (!map.has(col.day)) map.set(col.day, []);
      map.get(col.day)!.push(col);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [collisions]);

  const timelineByDay = useMemo(() => {
    const map = new Map<string, KalenderEvent[]>();
    for (const event of events) {
      const day = dayOf(event.startAt);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(event);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 60);
  }, [events]);

  return (
    <section ref={sectionRef} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Konflikt-Center
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Erkennt Kollisionen zwischen Fristen, Wiedervorlagen, Gerichtsterminen und manuellen Events.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('conflicts')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'conflicts'
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Konflikte ({collisions.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'timeline'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Timeline ({events.length})
          </button>
        </div>
      </div>

      {!matterId ? (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Bitte zuerst eine Akte auswählen.
        </div>
      ) : null}

      {viewMode === 'conflicts' ? (
        <div className="space-y-4">
          {matterId && collisions.length === 0 ? (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              Keine Konflikte erkannt — alle Termine und Fristen sind kollisionsfrei.
            </div>
          ) : null}

          {grouped.map(([day, dayCollisions]) => (
            <div key={day} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-700">{day}</h4>
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                  {dayCollisions.length} Konflikt{dayCollisions.length !== 1 ? 'e' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {dayCollisions.map(conflict => (
                  <div
                    key={conflict.id}
                    className={`border rounded-lg p-3 ${
                      conflict.kind === 'time-overlap'
                        ? 'border-red-300 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-2 ${
                      conflict.kind === 'time-overlap' ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {conflict.kind === 'time-overlap' ? 'Zeitüberlappung' : 'Gleicher Tag'}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[conflict.a, conflict.b].map(ev => (
                        <div
                          key={ev.id}
                          className={`rounded-lg px-3 py-2 text-xs ${localStyles.conflictEventCard}`}
                          style={assignInlineVars({
                            [localStyles.surfaceVar]: SOURCE_BG[ev.source],
                            [localStyles.accentVar]: SOURCE_COLOR[ev.source],
                          })}
                        >
                          <div className="font-semibold text-slate-900 truncate">{ev.title}</div>
                          <div className="text-slate-500 mt-0.5">
                            {ev.allDay ? ev.startAt.split('T')[0] : new Date(ev.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            <span
                              className={localStyles.sourceLabel}
                              style={assignInlineVars({ [localStyles.accentVar]: SOURCE_COLOR[ev.source] })}
                            >{SOURCE_LABEL[ev.source]}</span>
                          </div>
                          {ev.location ? (
                            <div className="text-slate-400 mt-0.5 truncate">{ev.location}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {viewMode === 'timeline' ? (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="text-sm text-slate-400">
              Keine Kalenderevents für diese Akte vorhanden.
            </div>
          ) : null}
          {timelineByDay.map(([day, dayEvents]) => {
            const hasConflict = grouped.some(([d]) => d === day);
            return (
              <div key={day} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-700">{day}</h4>
                  {hasConflict ? (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                      Konflikt
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {dayEvents.map(ev => (
                    <div
                      key={ev.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${localStyles.timelineItem}`}
                      style={assignInlineVars({
                        [localStyles.surfaceVar]: SOURCE_BG[ev.source],
                        [localStyles.accentVar]: SOURCE_COLOR[ev.source],
                      })}
                    >
                      <div className="w-14 shrink-0 text-slate-500 font-mono">
                        {ev.allDay ? 'ganztg.' : new Date(ev.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-900 truncate block">{ev.title}</span>
                        {ev.location ? <span className="text-slate-400">{ev.location}</span> : null}
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${localStyles.timelineBadge}`}
                        style={assignInlineVars({
                          [localStyles.accentVar]: SOURCE_COLOR[ev.source],
                          [localStyles.surfaceVar]: SOURCE_BG[ev.source],
                        })}
                      >
                        {SOURCE_LABEL[ev.source]}
                      </span>
                      {ev.reminders.some(r => !r.sent) ? (
                        <span className="shrink-0 text-xs text-blue-500 font-medium">Erinnerung</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
