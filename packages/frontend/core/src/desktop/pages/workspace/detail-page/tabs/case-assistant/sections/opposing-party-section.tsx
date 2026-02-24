import { Button } from '@affine/component';
import type {
  CaseAssistantAction,
  OpposingParty,
  OpposingPartyKind,
} from '@affine/core/modules/case-assistant';
import { memo, useCallback, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './opposing-party-section.css';

const KIND_LABEL: Record<OpposingPartyKind, string> = {
  person: 'Natürliche Person',
  company: 'Unternehmen',
  authority: 'Behörde',
  other: 'Sonstige',
};

type Props = {
  opposingParties: OpposingParty[];
  canAction: (action: CaseAssistantAction) => boolean;
  isWorkflowBusy: boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onAddOpposingParty: (party: Omit<OpposingParty, 'id'>) => Promise<void>;
  onUpdateOpposingParty: (party: OpposingParty) => Promise<void>;
  onRemoveOpposingParty: (partyId: string) => Promise<void>;
};

export const OpposingPartySection = memo((props: Props) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<OpposingPartyKind>('person');
  const [draftRepresentative, setDraftRepresentative] = useState('');
  const [draftLawFirm, setDraftLawFirm] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftNotes, setDraftNotes] = useState('');

  const canManage = props.canAction('opposing_party.manage');

  const resetDraft = useCallback(() => {
    setDraftName('');
    setDraftKind('person');
    setDraftRepresentative('');
    setDraftLawFirm('');
    setDraftEmail('');
    setDraftPhone('');
    setDraftAddress('');
    setDraftNotes('');
    setIsAdding(false);
    setEditingId(null);
  }, []);

  const loadPartyIntoDraft = useCallback((party: OpposingParty) => {
    setDraftName(party.displayName);
    setDraftKind(party.kind);
    setDraftRepresentative(party.legalRepresentative ?? '');
    setDraftLawFirm(party.lawFirm ?? '');
    setDraftEmail(party.email ?? '');
    setDraftPhone(party.phone ?? '');
    setDraftAddress(party.address ?? '');
    setDraftNotes(party.notes ?? '');
    setEditingId(party.id);
    setIsAdding(true);
  }, []);

  const handleSave = useCallback(async () => {
    const name = draftName.trim();
    if (!name) return;

    const partyData = {
      kind: draftKind,
      displayName: name,
      legalRepresentative: draftRepresentative.trim() || undefined,
      lawFirm: draftLawFirm.trim() || undefined,
      email: draftEmail.trim() || undefined,
      phone: draftPhone.trim() || undefined,
      address: draftAddress.trim() || undefined,
      notes: draftNotes.trim() || undefined,
    };

    if (editingId) {
      await props.onUpdateOpposingParty({ id: editingId, ...partyData });
    } else {
      await props.onAddOpposingParty(partyData);
    }
    resetDraft();
  }, [
    draftName, draftKind, draftRepresentative, draftLawFirm,
    draftEmail, draftPhone, draftAddress, draftNotes,
    editingId, props.onAddOpposingParty, props.onUpdateOpposingParty, resetDraft,
  ]);

  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary} aria-label="Gegner und Beteiligte verwalten">
        Gegner / Beteiligte
        {props.opposingParties.length > 0 ? ` (${props.opposingParties.length})` : ''}
      </summary>

      <div className={styles.quickActionRow}>
        {canManage && !isAdding ? (
          <Button
            variant="secondary"
            disabled={props.isWorkflowBusy}
            onClick={() => setIsAdding(true)}
            aria-label="Neue Gegenpartei hinzufügen"
          >
            + Gegenpartei hinzufügen
          </Button>
        ) : null}
      </div>

      {isAdding ? (
        <div
          className={localStyles.formCard}
          role="form"
          aria-label={editingId ? 'Gegenpartei bearbeiten' : 'Neue Gegenpartei'}
        >
          <div className={localStyles.formTitle}>
            {editingId ? 'Gegenpartei bearbeiten' : 'Neue Gegenpartei'}
          </div>

          <label className={styles.formLabel} htmlFor="op-party-name">
            Name *
            <input
              id="op-party-name"
              className={styles.input}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              placeholder="Name der Gegenpartei"
              aria-required="true"
            />
          </label>

          <label className={styles.formLabel} htmlFor="op-party-kind">
            Art
            <select
              id="op-party-kind"
              className={styles.input}
              value={draftKind}
              onChange={e => setDraftKind(e.target.value as OpposingPartyKind)}
            >
              {(Object.entries(KIND_LABEL) as Array<[OpposingPartyKind, string]>).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </label>

          <label className={styles.formLabel} htmlFor="op-party-rep">
            Anwalt / Vertreter
            <input
              id="op-party-rep"
              className={styles.input}
              value={draftRepresentative}
              onChange={e => setDraftRepresentative(e.target.value)}
              placeholder="RA Max Mustermann"
            />
          </label>

          <label className={styles.formLabel} htmlFor="op-party-firm">
            Kanzlei
            <input
              id="op-party-firm"
              className={styles.input}
              value={draftLawFirm}
              onChange={e => setDraftLawFirm(e.target.value)}
              placeholder="Kanzlei Gegenseite"
            />
          </label>

          <label className={styles.formLabel} htmlFor="op-party-email">
            E-Mail
            <input
              id="op-party-email"
              className={styles.input}
              type="email"
              value={draftEmail}
              onChange={e => setDraftEmail(e.target.value)}
              placeholder="gegner@kanzlei.de"
            />
          </label>

          <label className={styles.formLabel} htmlFor="op-party-phone">
            Telefon
            <input
              id="op-party-phone"
              className={styles.input}
              type="tel"
              value={draftPhone}
              onChange={e => setDraftPhone(e.target.value)}
              placeholder="+49 ..."
            />
          </label>

          <label className={styles.formLabel} htmlFor="op-party-address">
            Adresse
            <input
              id="op-party-address"
              className={styles.input}
              value={draftAddress}
              onChange={e => setDraftAddress(e.target.value)}
              placeholder="Straße, PLZ Ort"
            />
          </label>

          <label className={styles.formLabel} htmlFor="op-party-notes">
            Notizen
            <textarea
              id="op-party-notes"
              className={`${styles.input} ${localStyles.resizeVertical}`}
              value={draftNotes}
              onChange={e => setDraftNotes(e.target.value)}
              placeholder="Interne Anmerkungen..."
              rows={2}
            />
          </label>

          <div className={localStyles.formActions}>
            <Button
              variant="secondary"
              disabled={!draftName.trim()}
              onClick={() => props.runAsyncUiAction(handleSave, 'opposing party save failed')}
            >
              {editingId ? 'Aktualisieren' : 'Hinzufügen'}
            </Button>
            <Button variant="plain" onClick={resetDraft}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {props.opposingParties.length === 0 && !isAdding ? (
        <div className={`${styles.empty} ${localStyles.emptyCompact}`}>
          Keine Gegenparteien/Beteiligte erfasst.
        </div>
      ) : (
        <ul className={localStyles.list}>
          {props.opposingParties.map(party => {
            const isExp = expandedId === party.id;
            return (
              <li key={party.id} className={localStyles.item}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExp ? null : party.id)}
                  aria-expanded={isExp}
                  aria-label={`${party.displayName} - ${KIND_LABEL[party.kind] ?? 'Sonstige'}`}
                  className={localStyles.itemButton}
                >
                  <span className={localStyles.partyIcon}>
                    {KIND_LABEL[party.kind] ?? 'Sonstige'}
                  </span>
                  <span className={localStyles.partyName}>
                    {party.displayName}
                  </span>
                  {party.legalRepresentative ? (
                    <span className={localStyles.repLabel}>
                      RA: {party.legalRepresentative}
                    </span>
                  ) : null}
                  <span className={localStyles.caret}>{isExp ? 'Schließen' : 'Öffnen'}</span>
                </button>

                {isExp ? (
                  <div className={localStyles.expandedPanel}>
                    <div className={localStyles.detailMuted}>
                      Art: {KIND_LABEL[party.kind]}
                    </div>
                    {party.lawFirm ? (
                      <div className={localStyles.detailText}>Kanzlei: {party.lawFirm}</div>
                    ) : null}
                    {party.email ? (
                      <div className={localStyles.detailText}>E-Mail: {party.email}</div>
                    ) : null}
                    {party.phone ? (
                      <div className={localStyles.detailText}>Tel.: {party.phone}</div>
                    ) : null}
                    {party.address ? (
                      <div className={localStyles.detailText}>Adresse: {party.address}</div>
                    ) : null}
                    {party.notes ? (
                      <div className={localStyles.detailItalic}>
                        {party.notes}
                      </div>
                    ) : null}

                    {canManage ? (
                      <div className={localStyles.itemActions}>
                        <Button
                          variant="plain"
                          onClick={() => loadPartyIntoDraft(party)}
                          aria-label={`${party.displayName} bearbeiten`}
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          variant="plain"
                          onClick={() => props.runAsyncUiAction(
                            () => props.onRemoveOpposingParty(party.id),
                            'opposing party remove failed'
                          )}
                          aria-label={`${party.displayName} entfernen`}
                          className={localStyles.dangerButton}
                        >
                          Entfernen
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
});

OpposingPartySection.displayName = 'OpposingPartySection';
