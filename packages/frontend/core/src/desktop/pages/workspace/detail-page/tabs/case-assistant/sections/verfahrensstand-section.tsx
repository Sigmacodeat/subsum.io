import { useMemo, useState, type RefObject } from 'react';

import type { InstanzLevel, Verfahrensphase, VerfahrensstandRecord } from '@affine/core/modules/case-assistant';
import {
  INSTANZ_LABELS,
  VERFAHRENSPHASE_LABELS,
  VerfahrensstandService,
} from '@affine/core/modules/case-assistant';
import { useService } from '@toeverything/infra';

import * as localStyles from './verfahrensstand-section.css';

const phaseOptions = Object.keys(VERFAHRENSPHASE_LABELS) as Verfahrensphase[];
const instanzOptions = Object.keys(INSTANZ_LABELS) as InstanzLevel[];

export function VerfahrensstandSection({
  sectionRef,
  workspaceId,
  caseId,
  matterId,
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  workspaceId: string;
  caseId: string;
  matterId?: string;
}) {
  const verfahrensstandService = useService(VerfahrensstandService);

  const entries = useMemo(
    () => {
      if (!matterId) {
        return [] as VerfahrensstandRecord[];
      }
      return verfahrensstandService
        .getVerfahrensstandHistory(matterId)
        .filter(entry => entry.caseId === caseId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
    [verfahrensstandService, caseId, matterId]
  );

  const current = entries.find(entry => !entry.completedAt);

  const [phase, setPhase] = useState<Verfahrensphase>('vorverfahrenlich');
  const [instanz, setInstanz] = useState<InstanzLevel>('erste');
  const [gericht, setGericht] = useState('');
  const [aktenzeichen, setAktenzeichen] = useState('');
  const [richter, setRichter] = useState('');
  const [expectedEndAt, setExpectedEndAt] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const disabled = !matterId;

  return (
    <section ref={sectionRef} className={localStyles.section}>
      <h4 className={localStyles.heading}>Verfahrensstand</h4>

      <div aria-live="polite" className={localStyles.feedback}>
        {feedback ?? ''}
      </div>

      {disabled ? (
        <div className={localStyles.warningBox}>
          Bitte zuerst eine Akte auswählen.
        </div>
      ) : null}

      <div className={localStyles.formGrid}>
        <div className={localStyles.twoCol}>
          <select
            aria-label="Verfahrensphase"
            value={phase}
            onChange={e => setPhase(e.target.value as Verfahrensphase)}
            disabled={disabled}
            className={localStyles.control}
          >
            {phaseOptions.map(option => (
              <option key={option} value={option}>
                {VERFAHRENSPHASE_LABELS[option]}
              </option>
            ))}
          </select>
          <select
            aria-label="Instanz"
            value={instanz}
            onChange={e => setInstanz(e.target.value as InstanzLevel)}
            disabled={disabled}
            className={localStyles.control}
          >
            {instanzOptions.map(option => (
              <option key={option} value={option}>
                {INSTANZ_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className={localStyles.twoCol}>
          <input
            aria-label="Gericht"
            value={gericht}
            onChange={e => setGericht(e.target.value)}
            placeholder="Gericht"
            disabled={disabled}
            className={localStyles.control}
          />
          <input
            aria-label="Aktenzeichen"
            value={aktenzeichen}
            onChange={e => setAktenzeichen(e.target.value)}
            placeholder="Aktenzeichen"
            disabled={disabled}
            className={localStyles.control}
          />
        </div>

        <div className={localStyles.twoCol}>
          <input
            aria-label="Richter"
            value={richter}
            onChange={e => setRichter(e.target.value)}
            placeholder="Richter"
            disabled={disabled}
            className={localStyles.control}
          />
          <input
            aria-label="Geplantes Ende"
            type="date"
            value={expectedEndAt}
            onChange={e => setExpectedEndAt(e.target.value)}
            disabled={disabled}
            className={localStyles.control}
          />
        </div>

        <textarea
          aria-label="Notizen zum Verfahrensstand"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Notizen"
          disabled={disabled}
          className={localStyles.control}
        />

        <div className={localStyles.actionRow}>
          <button
            type="button"
            disabled={disabled}
            className={localStyles.actionButton}
            onClick={() => {
              if (!matterId) return;
              void verfahrensstandService
                .createVerfahrensstand({
                  workspaceId,
                  caseId,
                  matterId,
                  phase,
                  instanz,
                  gericht: gericht.trim() || undefined,
                  aktenzeichen: aktenzeichen.trim() || undefined,
                  richter: richter.trim() || undefined,
                  expectedEndAt: expectedEndAt || undefined,
                  notes: notes.trim() || undefined,
                })
                .then(() => {
                  setNotes('');
                  setFeedback('Verfahrensstand wurde angelegt.');
                })
                .catch((error: unknown) => {
                  setFeedback(error instanceof Error ? error.message : 'Verfahrensstand konnte nicht angelegt werden.');
                });
            }}
          >
            Verfahrensstand anlegen
          </button>

          <button
            type="button"
            disabled={disabled || !current}
            className={localStyles.actionButton}
            onClick={() => {
              if (!current) return;
              void verfahrensstandService
                .advancePhase(current.id, phase, notes.trim() || undefined)
                .then(() => {
                  setFeedback('Aktive Phase wurde fortgeschrieben.');
                })
                .catch((error: unknown) => {
                  setFeedback(error instanceof Error ? error.message : 'Phase konnte nicht fortgeschrieben werden.');
                });
            }}
          >
            Aktive Phase fortschreiben
          </button>
        </div>

        {current ? (
          <div className={localStyles.activeBox}>
            Aktiv: {VERFAHRENSPHASE_LABELS[current.phase]} · {INSTANZ_LABELS[current.instanz]}
            {current.gericht ? ` · ${current.gericht}` : ''}
          </div>
        ) : (
          <div className={localStyles.muted}>Noch kein aktiver Verfahrensstand.</div>
        )}

        {entries.map(entry => (
          <div key={entry.id} className={localStyles.historyItem}>
            <strong>{VERFAHRENSPHASE_LABELS[entry.phase]}</strong> · {INSTANZ_LABELS[entry.instanz]}
            {entry.gericht ? ` · ${entry.gericht}` : ''}
            <div className={localStyles.muted}>
              Start: {new Date(entry.startedAt).toLocaleString('de-DE')}
              {entry.completedAt ? ` · Ende: ${new Date(entry.completedAt).toLocaleString('de-DE')}` : ' · offen'}
            </div>
          </div>
        ))}
        {!disabled && entries.length === 0 ? (
          <div className={localStyles.muted}>
            Für diese Akte ist noch kein Verfahrensstand erfasst.
          </div>
        ) : null}
      </div>
    </section>
  );
}
