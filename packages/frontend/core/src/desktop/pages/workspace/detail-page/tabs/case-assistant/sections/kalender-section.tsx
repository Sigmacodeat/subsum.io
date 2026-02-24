import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { KalenderEvent } from '@affine/core/modules/case-assistant';
import { KalenderService } from '@affine/core/modules/case-assistant';

type TabId = 'events' | 'ical';

type SourceFilter = KalenderEvent['source'] | 'all';

const SOURCE_LABEL: Record<SourceFilter, string> = {
  all: 'Alle Quellen',
  user: 'Manuell',
  deadline: 'Fristen',
  wiedervorlage: 'Wiedervorlage',
  gerichtstermin: 'Gerichtstermin',
};

function sourceChipClass(source: KalenderEvent['source']): string {
  switch (source) {
    case 'gerichtstermin':
      return 'border border-blue-200 bg-blue-50 text-blue-700';
    case 'deadline':
      return 'border border-rose-200 bg-rose-50 text-rose-700';
    case 'wiedervorlage':
      return 'border border-amber-200 bg-amber-50 text-amber-700';
    case 'user':
    default:
      return 'border border-slate-200 bg-slate-100 text-slate-700';
  }
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function KalenderSection({
  sectionRef,
  workspaceId,
  matterId,
  highlightedDeadlineId,
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  workspaceId: string;
  matterId?: string;
  highlightedDeadlineId?: string;
}) {
  const kalenderService = useService(KalenderService);

  const [tab, setTab] = useState<TabId>('events');
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 10));
  const [allDay, setAllDay] = useState(true);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [policyInputBySource, setPolicyInputBySource] = useState<Record<KalenderEvent['source'], string>>({
    deadline: '',
    wiedervorlage: '',
    gerichtstermin: '',
    user: '',
  });
  const eventCardRefs = useRef(new Map<string, HTMLDivElement>());

  const disabled = !matterId;

  const events = useMemo(() => {
    if (!matterId) return [] as KalenderEvent[];
    return kalenderService.getEventsForMatter(matterId);
  }, [kalenderService, matterId]);

  const reminderPolicies = useMemo(
    () => kalenderService.listReminderPolicies(),
    [kalenderService, events]
  );

  const visibleEvents = useMemo(() => {
    if (sourceFilter === 'all') return events;
    return events.filter(e => e.source === sourceFilter);
  }, [events, sourceFilter]);

  const highlightedEventId = useMemo(
    () =>
      highlightedDeadlineId
        ? events.find(event => event.source === 'deadline' && event.sourceId === highlightedDeadlineId)?.id
        : undefined,
    [events, highlightedDeadlineId]
  );

  useEffect(() => {
    if (!highlightedDeadlineId) {
      return;
    }
    setSourceFilter('deadline');
  }, [highlightedDeadlineId]);

  useEffect(() => {
    if (!highlightedEventId) {
      return;
    }
    eventCardRefs.current.get(highlightedEventId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [highlightedEventId]);

  const upcoming = useMemo(
    () => kalenderService.getUpcomingEvents(60).filter(e => (matterId ? e.matterId === matterId : true)),
    [kalenderService, matterId, events]
  );

  const createEvent = useCallback(async () => {
    if (!title.trim()) return;

    const startIso = startAt.includes('T')
      ? startAt
      : allDay
        ? `${startAt}`
        : `${startAt}T09:00:00.000Z`;

    await kalenderService.createEvent({
      workspaceId,
      matterId: matterId ?? undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      startAt: startIso,
      allDay,
      location: location.trim() || undefined,
      source: 'user',
      reminders: kalenderService
        .getReminderPolicyForSource('user')
        .map(offsetMinutes => ({ offsetMinutes })),
    });

    setTitle('');
    setDescription('');
    setLocation('');
    setFeedback('Kalenderevent angelegt.');
  }, [kalenderService, workspaceId, matterId, title, startAt, allDay, location, description]);

  const exportICal = useCallback(() => {
    const res = kalenderService.exportToICal({
      matterId: matterId ?? undefined,
      sources: sourceFilter === 'all' ? undefined : [sourceFilter],
    });
    setExportText(res.iCalContent);
    setFeedback(`${res.eventCount} Event(s) exportiert.`);
  }, [kalenderService, matterId, sourceFilter]);

  const importICal = useCallback(async () => {
    if (!importText.trim()) return;
    const count = await kalenderService.importFromICal(importText, workspaceId);
    setFeedback(`${count} Event(s) importiert.`);
    setImportText('');
  }, [kalenderService, importText, workspaceId]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!confirm('Event wirklich löschen?')) return;
    await kalenderService.deleteEvent(id);
    setFeedback('Event gelöscht.');
  }, [kalenderService]);

  const savePolicy = useCallback((source: KalenderEvent['source']) => {
    const text = policyInputBySource[source].trim();
    const offsets = text
      .split(',')
      .map(part => Number(part.trim()))
      .filter(value => Number.isFinite(value) && value >= 0)
      .map(value => Math.floor(value));

    const saved = kalenderService.setReminderPolicyForSource(source, offsets);
    setFeedback(`Reminder-Regel gespeichert (${SOURCE_LABEL[source]}): ${saved.join(', ')} min`);
  }, [kalenderService, policyInputBySource]);

  const resetPolicy = useCallback((source: KalenderEvent['source']) => {
    const reset = kalenderService.resetReminderPolicyForSource(source);
    setFeedback(`Reminder-Regel zurückgesetzt (${SOURCE_LABEL[source]}): ${reset.join(', ')} min`);
  }, [kalenderService]);

  return (
    <section
      ref={sectionRef}
      className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-sm space-y-4"
    >
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          Kalender
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Zentrale Kalenderansicht pro Akte. Fristen, Wiedervorlagen und Gerichtstermine werden automatisch gespiegelt. Reminder-Regeln pro Quelle konfigurierbar.
        </p>
      </div>

      <div aria-live="polite" className="text-sm text-slate-600 min-h-5">
        {feedback ?? ''}
      </div>

      {disabled ? (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Bitte zuerst eine Akte auswählen.
        </div>
      ) : null}

      <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {([
          { id: 'events', label: `Events (${events.length})` },
          { id: 'ical', label: 'iCal Export/Import' },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'events' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Reminder-Regeln pro Quelle</h4>
              <p className="text-xs text-slate-500">Format: Minuten, kommagetrennt (z.B. 2880,1440,120)</p>
            </div>
            {(['deadline', 'gerichtstermin', 'wiedervorlage', 'user'] as const).map(source => (
              <div key={source} className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto_auto] gap-2 items-center">
                <div className="text-xs font-medium text-slate-700">{SOURCE_LABEL[source]}</div>
                <input
                  value={policyInputBySource[source] || reminderPolicies[source].join(',')}
                  onChange={e =>
                    setPolicyInputBySource(prev => ({
                      ...prev,
                      [source]: e.target.value,
                    }))
                  }
                  className="border border-slate-200 rounded-xl bg-white px-3 py-1.5 text-xs"
                  aria-label={`Reminder-Regel ${SOURCE_LABEL[source]}`}
                />
                <button
                  type="button"
                  onClick={() => savePolicy(source)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => resetPolicy(source)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Reset
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600">Quelle</div>
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value as SourceFilter)}
                disabled={disabled}
                className="border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
                aria-label="Quelle filtern"
              >
                {(['all', 'gerichtstermin', 'deadline', 'wiedervorlage', 'user'] as const).map(s => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400">
              Sichtbar: <span className="font-medium text-slate-600">{visibleEvents.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="kal-title">Titel</label>
              <input
                id="kal-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={disabled}
                placeholder="z.B. Mandant anrufen / Schriftsatz finalisieren"
                className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="kal-start">Datum / Start</label>
              <input
                id="kal-start"
                type={allDay ? 'date' : 'datetime-local'}
                value={startAt}
                onChange={e => setStartAt(e.target.value)}
                disabled={disabled}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="kal-allday">Ganztägig</label>
              <select
                id="kal-allday"
                value={allDay ? 'yes' : 'no'}
                onChange={e => setAllDay(e.target.value === 'yes')}
                disabled={disabled}
                className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
              >
                <option value="yes">Ja</option>
                <option value="no">Nein</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="kal-location">Ort (optional)</label>
              <input
                id="kal-location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                disabled={disabled}
                placeholder="z.B. LG Wien, Saal 101 / Teams"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="kal-desc">Beschreibung (optional)</label>
              <textarea
                id="kal-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={disabled}
                rows={3}
                placeholder="Kurznotizen / Agenda / Unterlagen"
                className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void createEvent()}
            disabled={disabled || !title.trim()}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            + Event anlegen
          </button>

          <div>
            <h4 className="text-sm font-semibold text-slate-700">Nächste 60 Tage</h4>
            {upcoming.length === 0 ? (
              <div className="text-sm text-slate-400 mt-2">Keine Events in den nächsten 60 Tagen.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {upcoming
                  .filter(e => (sourceFilter === 'all' ? true : e.source === sourceFilter))
                  .map(e => (
                  <div
                    key={e.id}
                    ref={node => {
                      if (node) {
                        eventCardRefs.current.set(e.id, node);
                        return;
                      }
                      eventCardRefs.current.delete(e.id);
                    }}
                    className={`rounded-2xl border bg-white p-3 flex items-start justify-between gap-3 ${
                      highlightedEventId === e.id
                        ? 'border-blue-400 ring-2 ring-blue-200/80 shadow-md'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-slate-900">{e.title}</div>
                      <div className="text-sm text-slate-600 mt-0.5">
                        {e.allDay ? e.startAt.split('T')[0] : new Date(e.startAt).toLocaleString('de-DE')}
                        {e.location ? ` · ${e.location}` : ''}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500">
                          Quelle: <span className="font-medium">{SOURCE_LABEL[e.source]}</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sourceChipClass(e.source)}`}
                        >
                          {SOURCE_LABEL[e.source]}
                        </span>
                        {e.reminders.length > 0 ? (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            {e.reminders.filter(r => !r.sent).length}/{e.reminders.length} Reminder
                          </span>
                        ) : null}
                      </div>
                      {e.description ? (
                        <div className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{e.description}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteEvent(e.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    >
                      Löschen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'ical' ? (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportICal}
              disabled={disabled}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              iCal exportieren
            </button>
          </div>

          {exportText ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">Export (VCALENDAR)</div>
              <textarea
                value={exportText}
                readOnly
                rows={10}
                className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-xs font-mono"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(exportText);
                    setFeedback('In Zwischenablage kopiert.');
                  }}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Kopieren
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const suffix = sourceFilter === 'all' ? 'all' : sourceFilter;
                    const matterSuffix = matterId ? `-${matterId.slice(0, 8)}` : '';
                    downloadTextFile(
                      `subsumio-kalender${matterSuffix}-${suffix}.ics`,
                      exportText,
                      'text/calendar;charset=utf-8'
                    );
                    setFeedback('Download gestartet.');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  .ics herunterladen
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">Import (VCALENDAR einfügen)</div>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={10}
              className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-xs font-mono"
              placeholder="BEGIN:VCALENDAR\n..."
            />
            <button
              type="button"
              onClick={() => void importICal()}
              disabled={!importText.trim()}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Importieren
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
