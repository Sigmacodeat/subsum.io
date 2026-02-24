import { Button } from '@affine/component';
import type {
  AnwaltProfile,
  CaseAssistantAction,
  ClientKind,
  ClientRecord,
  Jurisdiction,
  MatterRecord,
} from '@affine/core/modules/case-assistant';
import { normalizeAuthorityReferences } from '@affine/core/modules/case-assistant';

import * as styles from '../../case-assistant.css';
import * as localStyles from './client-matter-section.css';

type AuthorityRefType = 'gericht' | 'staatsanwaltschaft' | 'polizei' | 'allgemein' | 'unbekannt';

function classifyAuthorityReference(value: string): AuthorityRefType {
  const normalized = value.trim();
  if (!normalized) {
    return 'unbekannt';
  }
  if (/\b(?:StA|Staatsanwaltschaft)\b/i.test(normalized) || /\b\d{1,4}\s*Js\s*\d{1,7}\/[0-9]{2,4}\b/i.test(normalized)) {
    return 'staatsanwaltschaft';
  }
  if (/\b(?:Polizei|Kripo|LKA|BKA|PI)\b/i.test(normalized)) {
    return 'polizei';
  }
  if (/\b(?:AG|LG|OLG|BGH|Bezirksgericht|Landesgericht|Amtsgericht|Landgericht|Oberlandesgericht|Verwaltungsgericht)\b/i.test(normalized)) {
    return 'gericht';
  }
  if (/\b(?:AZ|Aktenzeichen|GZ|Gesch\.?\s*Z\.?)\b/i.test(normalized) || /[A-Z0-9][A-Z0-9\-/.]{3,}/i.test(normalized)) {
    return 'allgemein';
  }
  return 'unbekannt';
}

type Props = {
  caseClient: ClientRecord | null;
  caseMatter: MatterRecord | null;

  canAction: (action: CaseAssistantAction) => boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;

  // Client drafts
  clientDraftName: string;
  setClientDraftName: (value: string) => void;
  clientDraftKind: ClientKind;
  setClientDraftKind: (value: ClientKind) => void;
  clientDraftEmail: string;
  setClientDraftEmail: (value: string) => void;
  clientDraftPhone: string;
  setClientDraftPhone: (value: string) => void;
  clientDraftAddress: string;
  setClientDraftAddress: (value: string) => void;
  clientDraftTags: string;
  setClientDraftTags: (value: string) => void;
  clientDraftNotes: string;
  setClientDraftNotes: (value: string) => void;

  selectedClientId: string;
  setSelectedClientId: (value: string) => void;
  visibleClients: ClientRecord[];
  clientSearchQuery: string;
  setClientSearchQuery: (value: string) => void;

  undoClientSnapshot: ClientRecord | null;
  showArchivedClients: boolean;
  setShowArchivedClients: (updater: (value: boolean) => boolean) => void;

  // Client actions
  onCreateClient: () => Promise<void>;
  onAssignClientToCase: () => Promise<void>;
  onRequestArchiveSelectedClient: () => void;
  onRequestDeleteSelectedClient: () => void;
  onUndoClientAction: () => void;

  // Matter drafts
  matterDraftTitle: string;
  setMatterDraftTitle: (value: string) => void;
  matterDraftStatus: MatterRecord['status'];
  setMatterDraftStatus: (value: MatterRecord['status']) => void;
  matterDraftJurisdiction: Jurisdiction;
  setMatterDraftJurisdiction: (value: Jurisdiction) => void;
  matterDraftExternalRef: string;
  setMatterDraftExternalRef: (value: string) => void;
  matterDraftAuthorityReferences: string;
  setMatterDraftAuthorityReferences: (value: string) => void;
  matterDraftGericht: string;
  setMatterDraftGericht: (value: string) => void;
  matterDraftTags: string;
  setMatterDraftTags: (value: string) => void;
  matterDraftDescription: string;
  setMatterDraftDescription: (value: string) => void;

  matterSearchQuery: string;
  setMatterSearchQuery: (value: string) => void;
  selectedMatterId: string;
  setSelectedMatterId: (value: string) => void;
  visibleMatters: MatterRecord[];

  undoMatterSnapshot: MatterRecord | null;

  // Matter actions
  onCreateMatter: () => Promise<void>;
  onAssignMatterToCase: () => Promise<void>;
  onRequestDeleteSelectedMatter: () => void;
  onRequestArchiveSelectedMatter: () => void;
  onUndoMatterAction: () => void;

  // Anwalt-Zuordnung für Akte
  activeAnwaelte?: AnwaltProfile[];
  matterDraftAssignedAnwaltId: string;
  setMatterDraftAssignedAnwaltId: (value: string) => void;
  onGenerateNextAktenzeichen?: () => Promise<void>;
};

export const ClientMatterSection = (props: Props) => {
  const authorityRefs = normalizeAuthorityReferences(props.matterDraftAuthorityReferences).values;
  const authorityRefStats = authorityRefs.reduce(
    (acc: Record<AuthorityRefType, number>, ref: string) => {
      const type = classifyAuthorityReference(ref);
      acc[type] += 1;
      return acc;
    },
    {
      gericht: 0,
      staatsanwaltschaft: 0,
      polizei: 0,
      allgemein: 0,
      unbekannt: 0,
    }
  );

  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary} aria-label="Mandanten und Akten verwalten">Mandanten & Akten verwalten</summary>
      <div className={styles.jobMeta}>
        Aktueller Kontext: Mandant {props.caseClient?.displayName ?? '—'} • Akte{' '}
        {props.caseMatter?.title ?? '—'}
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formLabel} htmlFor="cm-client-name">
          Neuer Mandant (Name)
          <input
            id="cm-client-name"
            className={styles.input}
            value={props.clientDraftName}
            onChange={event => props.setClientDraftName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                props.runAsyncUiAction(props.onCreateClient, 'create client failed');
              }
            }}
            placeholder="z. B. Max Mustermann GmbH"
            aria-required="true"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-kind">
          Mandantentyp
          <select
            id="cm-client-kind"
            className={styles.input}
            value={props.clientDraftKind}
            onChange={event => props.setClientDraftKind(event.target.value as ClientKind)}
          >
            <option value="person">Person</option>
            <option value="company">Unternehmen</option>
            <option value="authority">Behörde</option>
            <option value="other">Sonstige</option>
          </select>
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-email">
          E-Mail
          <input
            id="cm-client-email"
            className={styles.input}
            type="email"
            value={props.clientDraftEmail}
            onChange={event => props.setClientDraftEmail(event.target.value)}
            placeholder="mandant@example.com"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-phone">
          Telefon
          <input
            id="cm-client-phone"
            className={styles.input}
            type="tel"
            value={props.clientDraftPhone}
            onChange={event => props.setClientDraftPhone(event.target.value)}
            placeholder="+43 / +49 …"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-address">
          Adresse
          <input
            id="cm-client-address"
            className={styles.input}
            value={props.clientDraftAddress}
            onChange={event => props.setClientDraftAddress(event.target.value)}
            placeholder="Straße, PLZ Ort"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-tags">
          Mandanten-Tags
          <input
            id="cm-client-tags"
            className={styles.input}
            value={props.clientDraftTags}
            onChange={event => props.setClientDraftTags(event.target.value)}
            placeholder="vip, b2b"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-notes">
          Notizen
          <textarea
            id="cm-client-notes"
            className={styles.input}
            rows={2}
            value={props.clientDraftNotes}
            onChange={event => props.setClientDraftNotes(event.target.value)}
            placeholder="Konflikte, Erreichbarkeit, Besonderheiten"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-select">
          Mandant auswählen
          <select
            id="cm-client-select"
            className={styles.input}
            value={props.selectedClientId}
            onChange={event => props.setSelectedClientId(event.target.value)}
          >
            <option value="">Bitte wählen</option>
            {props.visibleClients.map(client => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.formLabel} htmlFor="cm-client-filter">
          Mandantenfilter
          <input
            id="cm-client-filter"
            className={styles.input}
            value={props.clientSearchQuery}
            onChange={event => props.setClientSearchQuery(event.target.value)}
            placeholder="Name, E-Mail, Tag"
          />
        </label>
      </div>

      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          disabled={!props.canAction('client.manage')}
          onClick={() => {
            props.runAsyncUiAction(props.onCreateClient, 'create client failed');
          }}
        >
          Mandant anlegen
        </Button>
        <Button
          variant="plain"
          disabled={!props.canAction('client.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              props.onAssignClientToCase,
              'assign client to case failed'
            );
          }}
        >
          Mandant dieser Akte zuordnen
        </Button>
        <Button
          variant="plain"
          disabled={!props.canAction('client.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              async () => props.onRequestArchiveSelectedClient(),
              'request archive client failed'
            );
          }}
        >
          Archivieren
        </Button>
        <Button
          variant="plain"
          disabled={!props.canAction('client.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              async () => props.onRequestDeleteSelectedClient(),
              'request delete client failed'
            );
          }}
        >
          Löschen
        </Button>
        <Button
          variant="plain"
          disabled={!props.undoClientSnapshot || !props.canAction('client.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              async () => props.onUndoClientAction(),
              'undo client action failed'
            );
          }}
        >
          ↩ Rückgängig
        </Button>
        <Button
          variant={props.showArchivedClients ? 'secondary' : 'plain'}
          aria-pressed={props.showArchivedClients}
          onClick={() => props.setShowArchivedClients(value => !value)}
        >
          {props.showArchivedClients
            ? 'Nur aktive Mandanten'
            : 'Archivierte Mandanten anzeigen'}
        </Button>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formLabel} htmlFor="cm-matter-title">
          Neue Akte (Titel)
          <input
            id="cm-matter-title"
            className={styles.input}
            value={props.matterDraftTitle}
            onChange={event => props.setMatterDraftTitle(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                props.runAsyncUiAction(props.onCreateMatter, 'create matter failed');
              }
            }}
            placeholder="z. B. Kündigungsschutz 2026"
            aria-required="true"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-matter-status">
          Aktenstatus
          <select
            id="cm-matter-status"
            className={styles.input}
            value={props.matterDraftStatus}
            onChange={event =>
              props.setMatterDraftStatus(event.target.value as MatterRecord['status'])
            }
          >
            <option value="open">Offen</option>
            <option value="closed">Abgeschlossen</option>
            <option value="archived">Archiviert</option>
          </select>
        </label>
        <label className={styles.formLabel} htmlFor="cm-matter-jurisdiction">
          Jurisdiktion *
          <select
            id="cm-matter-jurisdiction"
            className={styles.input}
            value={props.matterDraftJurisdiction}
            onChange={event =>
              props.setMatterDraftJurisdiction(event.target.value as Jurisdiction)
            }
            aria-required="true"
          >
            <option value="AT">Österreich (AT)</option>
            <option value="DE">Deutschland (DE)</option>
            <option value="CH">Schweiz (CH)</option>
            <option value="EU">Europäische Union (EU)</option>
            <option value="ECHR">EGMR / EMRK (ECHR)</option>
            <option value="FR">Frankreich (FR)</option>
            <option value="IT">Italien (IT)</option>
            <option value="PT">Portugal (PT)</option>
            <option value="PL">Polen (PL)</option>
          </select>
        </label>
        <label className={styles.formLabel} htmlFor="cm-matter-ref">
          Aktenzeichen / Referenz
          <div className={localStyles.refRow}>
            <input
              id="cm-matter-ref"
              className={`${styles.input} ${localStyles.refInputGrow}`}
              value={props.matterDraftExternalRef}
              onChange={event => props.setMatterDraftExternalRef(event.target.value)}
              placeholder="z. B. 2026/001"
            />
            {props.onGenerateNextAktenzeichen ? (
              <Button
                variant="plain"
                className={localStyles.nextAzButton}
                onClick={() =>
                  props.runAsyncUiAction(
                    props.onGenerateNextAktenzeichen!,
                    'auto AZ failed'
                  )
                }
                title="Nächstes Aktenzeichen gemäß Kanzlei-Schema generieren"
              >
                Nächstes AZ
              </Button>
            ) : null}
          </div>
        </label>
        <label className={styles.formLabel} htmlFor="cm-matter-gericht">
          Zuständiges Gericht
          <input
            id="cm-matter-gericht"
            className={styles.input}
            value={props.matterDraftGericht}
            onChange={event => props.setMatterDraftGericht(event.target.value)}
            placeholder="z. B. Landesgericht Wien, Amtsgericht München"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-matter-authority-refs">
          Behörden-Referenzen (Gericht/StA/Polizei)
          <textarea
            id="cm-matter-authority-refs"
            className={styles.input}
            rows={2}
            value={props.matterDraftAuthorityReferences}
            onChange={event => props.setMatterDraftAuthorityReferences(event.target.value)}
            placeholder="z. B. StA Wien 123 Js 456/26; PI Innere Stadt A1/23456"
          />
          <span className={styles.previewMeta}>
            Erkannt: {authorityRefs.length} · Gericht {authorityRefStats.gericht} · StA {authorityRefStats.staatsanwaltschaft} · Polizei {authorityRefStats.polizei} · Allgemein {authorityRefStats.allgemein}
            {authorityRefStats.unbekannt > 0 ? ` · ${authorityRefStats.unbekannt} unklar` : ''}
          </span>
        </label>
        {(props.activeAnwaelte ?? []).length > 0 ? (
          <label className={styles.formLabel} htmlFor="cm-matter-anwalt">
            Bearbeiter (Anwalt)
            <select
              id="cm-matter-anwalt"
              className={styles.input}
              value={props.matterDraftAssignedAnwaltId}
              onChange={event => props.setMatterDraftAssignedAnwaltId(event.target.value)}
            >
              <option value="">— Kein Anwalt zugeordnet —</option>
              {(props.activeAnwaelte ?? []).map(a => (
                <option key={a.id} value={a.id}>
                  {a.title} {a.firstName} {a.lastName}{a.fachgebiet ? ` (${a.fachgebiet})` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className={styles.formLabel} htmlFor="cm-matter-tags">
          Akten-Tags
          <input
            id="cm-matter-tags"
            className={styles.input}
            value={props.matterDraftTags}
            onChange={event => props.setMatterDraftTags(event.target.value)}
            placeholder="arbeitsrecht, fristkritisch"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-matter-desc">
          Aktenbeschreibung
          <textarea
            id="cm-matter-desc"
            className={styles.input}
            rows={2}
            value={props.matterDraftDescription}
            onChange={event => props.setMatterDraftDescription(event.target.value)}
            placeholder="Kurze Beschreibung der Akte"
          />
        </label>
        <label className={styles.formLabel} htmlFor="cm-matter-filter">
          Aktenfilter
          <input
            id="cm-matter-filter"
            className={styles.input}
            value={props.matterSearchQuery}
            onChange={event => props.setMatterSearchQuery(event.target.value)}
            placeholder="Titel, Referenz, Tag"
          />
        </label>
        <label className={styles.formLabel}>
          Akte auswählen
          <select
            className={styles.input}
            value={props.selectedMatterId}
            onChange={event => props.setSelectedMatterId(event.target.value)}
          >
            <option value="">Bitte wählen</option>
            {props.visibleMatters.map(matter => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          disabled={!props.canAction('matter.manage')}
          onClick={() => {
            props.runAsyncUiAction(props.onCreateMatter, 'create matter failed');
          }}
        >
          Akte anlegen
        </Button>
        <Button
          variant="plain"
          disabled={!props.canAction('matter.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              props.onAssignMatterToCase,
              'assign matter to case failed'
            );
          }}
        >
          Akte diesem Case zuordnen
        </Button>
        <Button
          variant="plain"
          disabled={!props.canAction('matter.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              async () => props.onRequestDeleteSelectedMatter(),
              'request delete matter failed'
            );
          }}
        >
          Löschen
        </Button>
        <Button
          variant="plain"
          disabled={!props.canAction('matter.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              async () => props.onRequestArchiveSelectedMatter(),
              'request archive matter failed'
            );
          }}
        >
          Archivieren
        </Button>
        <Button
          variant="plain"
          disabled={!props.undoMatterSnapshot || !props.canAction('matter.manage')}
          onClick={() => {
            props.runAsyncUiAction(
              async () => props.onUndoMatterAction(),
              'undo matter action failed'
            );
          }}
        >
          ↩ Rückgängig
        </Button>
      </div>
    </details>
  );
};
