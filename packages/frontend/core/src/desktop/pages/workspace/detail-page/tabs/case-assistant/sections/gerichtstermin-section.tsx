import { useService } from '@toeverything/infra';
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useConfirmModal, usePromptModal } from '@affine/component';

import type { Gerichtstermin } from '@affine/core/modules/case-assistant';
import {
  GerichtsterminService,
  TERMINART_LABELS,
  TERMIN_STATUS_LABELS,
} from '@affine/core/modules/case-assistant';

function formatDateTime(datum: string, uhrzeit?: string): string {
  const datePart = datum.split('T')[0];
  if (!uhrzeit) return datePart;
  return `${datePart} ${uhrzeit}`;
}

function statusChipClass(status: Gerichtstermin['status']): string {
  switch (status) {
    case 'bestaetigt':
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'abgesagt':
      return 'border border-rose-200 bg-rose-50 text-rose-700';
    case 'verschoben':
      return 'border border-amber-200 bg-amber-50 text-amber-700';
    case 'abgeschlossen':
      return 'border border-slate-200 bg-slate-100 text-slate-700';
    case 'geplant':
    default:
      return 'border border-blue-200 bg-blue-50 text-blue-700';
  }
}

export function GerichtsterminSection({
  sectionRef,
  workspaceId,
  caseId,
  matterId,
  verfahrensstandId,
  teilnehmerDefault,
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  workspaceId: string;
  caseId: string;
  matterId?: string;
  verfahrensstandId?: string;
  teilnehmerDefault?: string[];
}) {
  const terminService = useService(GerichtsterminService);
  const { openConfirmModal } = useConfirmModal();
  const { openPromptModal } = usePromptModal();

  const termine = useMemo(() => {
    if (!matterId) return [] as Gerichtstermin[];
    return terminService.getTermineForMatter(matterId).filter(t => t.caseId === caseId);
  }, [terminService, matterId, caseId]);

  const upcoming = useMemo(
    () => termine.filter(t => t.status !== 'abgesagt' && t.status !== 'abgeschlossen'),
    [termine]
  );

  const past = useMemo(
    () => termine.filter(t => t.status === 'abgeschlossen' || t.status === 'abgesagt'),
    [termine]
  );

  const [terminart, setTerminart] = useState<Gerichtstermin['terminart']>('muendliche_verhandlung');
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [uhrzeit, setUhrzeit] = useState('09:00');
  const [dauerMinuten, setDauerMinuten] = useState('120');
  const [gericht, setGericht] = useState('');
  const [saal, setSaal] = useState('');
  const [richter, setRichter] = useState('');
  const [teilnehmerText, setTeilnehmerText] = useState((teilnehmerDefault ?? []).join(', '));
  const [notizen, setNotizen] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const disabled = !matterId;

  const selected = useMemo(
    () => (selectedId ? termine.find(t => t.id === selectedId) ?? null : null),
    [selectedId, termine]
  );

  const conflicts = useMemo(() => {
    if (disabled) return [] as Gerichtstermin[];
    const dateIso = datum.includes('T') ? datum : `${datum}T00:00:00.000Z`;
    return terminService.detectConflicts(dateIso, uhrzeit || undefined, selectedId ?? undefined);
  }, [terminService, datum, uhrzeit, disabled, selectedId]);

  const createTermin = useCallback(async () => {
    if (!matterId) return;

    const dateIso = datum.includes('T') ? datum : `${datum}T00:00:00.000Z`;
    const teilnehmer = teilnehmerText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    await terminService.createTermin({
      workspaceId,
      matterId,
      caseId,
      verfahrensstandId,
      terminart,
      datum: dateIso,
      uhrzeit: uhrzeit || undefined,
      dauerMinuten: dauerMinuten ? Number(dauerMinuten) : undefined,
      gericht: gericht.trim() || 'Gericht (bitte ergänzen)',
      saal: saal.trim() || undefined,
      richter: richter.trim() || undefined,
      teilnehmer,
      notizen: notizen.trim() || undefined,
    });

    setActionFeedback('Termin wurde erstellt.');
    setNotizen('');
    setSaal('');
    setRichter('');
  }, [matterId, terminService, workspaceId, caseId, verfahrensstandId, terminart, datum, uhrzeit, dauerMinuten, gericht, saal, richter, teilnehmerText, notizen]);

  const confirmTermin = useCallback(async (id: string) => {
    await terminService.confirmTermin(id);
    setActionFeedback('Termin bestätigt.');
  }, [terminService]);

  const cancelTermin = useCallback(
    async (id: string) => {
      openPromptModal({
        title: 'Termin absagen',
        label: 'Grund (optional)',
        inputOptions: {
          placeholder: 'z.B. Terminkollision, krankheitsbedingt',
        },
        confirmText: 'Absagen',
        cancelText: 'Abbrechen',
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm: async rawReason => {
          await terminService.cancelTermin(id, rawReason.trim() || undefined);
          setActionFeedback('Termin abgesagt.');
        },
      });
    },
    [openPromptModal, terminService]
  );

  const rescheduleTermin = useCallback(
    async (id: string) => {
      openPromptModal({
        title: 'Termin verschieben',
        label: 'Neues Datum / Uhrzeit',
        inputOptions: {
          placeholder: 'YYYY-MM-DD oder YYYY-MM-DD HH:MM',
        },
        confirmText: 'Verschieben',
        cancelText: 'Abbrechen',
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm: async rawValue => {
          const value = rawValue.trim();
          const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?$/);
          if (!match) {
            setActionFeedback('Ungültiges Format. Bitte YYYY-MM-DD oder YYYY-MM-DD HH:MM nutzen.');
            return;
          }
          const newIso = `${match[1]}T00:00:00.000Z`;
          await terminService.rescheduleTermin(id, newIso, match[2]);
          setActionFeedback('Termin verschoben.');
        },
      });
    },
    [openPromptModal, terminService]
  );

  const completeTermin = useCallback(
    async (id: string) => {
      openPromptModal({
        title: 'Termin abschließen',
        label: 'Ergebnis / Protokoll',
        inputOptions: {
          placeholder: 'Kurz zusammenfassen …',
        },
        confirmText: 'Abschließen',
        cancelText: 'Abbrechen',
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm: async rawResult => {
          const result = rawResult.trim();
          if (!result) {
            setActionFeedback('Bitte ein Ergebnis für den Abschluss eingeben.');
            return;
          }
          await terminService.completeTermin(id, result);
          setActionFeedback('Termin abgeschlossen.');
        },
      });
    },
    [openPromptModal, terminService]
  );

  const deleteTermin = useCallback(
    async (id: string) => {
      openConfirmModal({
        title: 'Termin löschen?',
        description: 'Diese Aktion kann nicht rückgängig gemacht werden.',
        cancelText: 'Abbrechen',
        confirmText: 'Löschen',
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm: async () => {
          await terminService.deleteTermin(id);
          if (selectedId === id) setSelectedId(null);
          setActionFeedback('Termin gelöscht.');
        },
      });
    },
    [openConfirmModal, selectedId, terminService]
  );

  return (
    <section
      ref={sectionRef}
      className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-sm space-y-4"
    >
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          Gerichtstermine
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Terminverwaltung inkl. Konfliktprüfung, Status-Workflow, Verschieben & Abschluss.
        </p>
      </div>

      <div aria-live="polite" className="text-sm text-slate-600 min-h-5">
        {actionFeedback ?? ''}
      </div>

      {disabled ? (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Bitte zuerst eine Akte auswählen.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600" htmlFor="terminart">
            Terminart
          </label>
          <select
            id="terminart"
            value={terminart}
            onChange={e => setTerminart(e.target.value as Gerichtstermin['terminart'])}
            disabled={disabled}
            className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
          >
            {Object.keys(TERMINART_LABELS).map(key => (
              <option key={key} value={key}>
                {TERMINART_LABELS[key as Gerichtstermin['terminart']]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="termin-datum">
              Datum
            </label>
            <input
              id="termin-datum"
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
              disabled={disabled}
              className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="termin-uhrzeit">
              Uhrzeit
            </label>
            <input
              id="termin-uhrzeit"
              type="time"
              value={uhrzeit}
              onChange={e => setUhrzeit(e.target.value)}
              disabled={disabled}
              className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="termin-dauer">
              Dauer (Min.)
            </label>
            <input
              id="termin-dauer"
              type="number"
              min={1}
              value={dauerMinuten}
              onChange={e => setDauerMinuten(e.target.value)}
              disabled={disabled}
              className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="termin-saal">
              Saal (optional)
            </label>
            <input
              id="termin-saal"
              value={saal}
              onChange={e => setSaal(e.target.value)}
              disabled={disabled}
              placeholder="Saal"
              className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600" htmlFor="termin-gericht">
            Gericht
          </label>
          <input
            id="termin-gericht"
            value={gericht}
            onChange={e => setGericht(e.target.value)}
            disabled={disabled}
            placeholder="z.B. LG Wien"
            className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600" htmlFor="termin-richter">
            Richter (optional)
          </label>
          <input
            id="termin-richter"
            value={richter}
            onChange={e => setRichter(e.target.value)}
            disabled={disabled}
            placeholder="Richter"
            className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-medium text-slate-600" htmlFor="termin-teilnehmer">
            Teilnehmer (kommagetrennt)
          </label>
          <input
            id="termin-teilnehmer"
            value={teilnehmerText}
            onChange={e => setTeilnehmerText(e.target.value)}
            disabled={disabled}
            placeholder="Mandant, Gegnervertreter, RA, …"
            className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-medium text-slate-600" htmlFor="termin-notizen">
            Notizen (optional)
          </label>
          <textarea
            id="termin-notizen"
            value={notizen}
            onChange={e => setNotizen(e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Notizen / Vorbereitung / Unterlagen…"
            className="w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {conflicts.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Konflikt: {conflicts.length} Termin(e) am selben Tag (ggf. Überlappung).
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void createTermin()}
          disabled={disabled || !gericht.trim()}
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          + Termin anlegen
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Nächste Termine ({upcoming.length})</h4>
          {upcoming.length === 0 ? (
            <div className="text-sm text-slate-400">Keine zukünftigen Termine.</div>
          ) : (
            upcoming.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${selectedId === t.id ? 'border-blue-300 bg-blue-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                aria-label={`Termin öffnen: ${TERMINART_LABELS[t.terminart] ?? t.terminart}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">
                    {TERMINART_LABELS[t.terminart] ?? t.terminart}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusChipClass(t.status)}`}
                  >
                    {TERMIN_STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {formatDateTime(t.datum, t.uhrzeit)} · {t.gericht}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5" onClick={event => event.stopPropagation()}>
                  {t.status === 'geplant' ? (
                    <button
                      type="button"
                      onClick={() => void confirmTermin(t.id)}
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                      aria-label={`Termin bestätigen: ${TERMINART_LABELS[t.terminart] ?? t.terminart}`}
                    >
                      Bestätigen
                    </button>
                  ) : null}
                  {t.status !== 'abgesagt' && t.status !== 'abgeschlossen' ? (
                    <button
                      type="button"
                      onClick={() => void rescheduleTermin(t.id)}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                      aria-label={`Termin verschieben: ${TERMINART_LABELS[t.terminart] ?? t.terminart}`}
                    >
                      Verschieben
                    </button>
                  ) : null}
                  {t.status !== 'abgesagt' && t.status !== 'abgeschlossen' ? (
                    <button
                      type="button"
                      onClick={() => void cancelTermin(t.id)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                      aria-label={`Termin absagen: ${TERMINART_LABELS[t.terminart] ?? t.terminart}`}
                    >
                      Absagen
                    </button>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Historie ({past.length})</h4>
          {past.length === 0 ? (
            <div className="text-sm text-slate-400">Noch keine Termin-Historie.</div>
          ) : (
            past.map(t => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">
                    {TERMINART_LABELS[t.terminart] ?? t.terminart}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusChipClass(t.status)}`}
                  >
                    {TERMIN_STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {formatDateTime(t.datum, t.uhrzeit)} · {t.gericht}
                </div>
                {t.ergebnis ? (
                  <div className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{t.ergebnis}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">Ausgewählt</div>
              <div className="text-sm text-slate-600">
                {TERMINART_LABELS[selected.terminart] ?? selected.terminart} · {formatDateTime(selected.datum, selected.uhrzeit)} · {selected.gericht}
              </div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusChipClass(selected.status)}`}
            >
              {TERMIN_STATUS_LABELS[selected.status] ?? selected.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {selected.status === 'geplant' ? (
              <button
                type="button"
                onClick={() => void confirmTermin(selected.id)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Bestätigen
              </button>
            ) : null}
            {selected.status !== 'abgesagt' && selected.status !== 'abgeschlossen' ? (
              <button
                type="button"
                onClick={() => void cancelTermin(selected.id)}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                Absagen
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void rescheduleTermin(selected.id)}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              Verschieben
            </button>
            {selected.status !== 'abgeschlossen' ? (
              <button
                type="button"
                onClick={() => void completeTermin(selected.id)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Abschließen
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void deleteTermin(selected.id)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Löschen
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
