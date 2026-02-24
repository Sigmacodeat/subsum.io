import { Button } from '@affine/component';
import type {
  BulkOperation,
  CaseAssistantAction,
  ClientRecord,
  EmailTemplateType,
  MatterRecord,
} from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useCallback, useMemo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './bulk-operations-section.css';

const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  mandantenbrief: 'Mandantenanschreiben',
  fristenwarnung: 'Fristenwarnung',
  statusbericht: 'Statusbericht',
  dokumentenversand: 'Dokumentenversand',
  terminbestaetigung: 'Terminbestätigung',
  vollmacht: 'Vollmacht anfordern',
  kostenvoranschlag: 'Kostenvoranschlag',
  rechtsschutzanfrage: 'Rechtsschutzanfrage',
  deckungszusage_erinnerung: 'Erinnerung Deckungszusage',
  custom: 'Freier Text',
};

const STATUS_BADGE: Record<
  string,
  {
    label: string;
    accent: string;
    chipBg: string;
    chipFg: string;
  }
> = {
  queued: {
    label: 'Wartend',
    accent: cssVarV2('text/secondary'),
    chipBg: cssVarV2('layer/background/secondary'),
    chipFg: cssVarV2('text/secondary'),
  },
  running: {
    label: 'Läuft…',
    accent: cssVarV2('button/primary'),
    chipBg: cssVarV2('layer/background/secondary'),
    chipFg: cssVarV2('text/primary'),
  },
  completed: {
    label: 'Abgeschlossen',
    accent: cssVarV2('status/success'),
    chipBg: cssVarV2('layer/background/secondary'),
    chipFg: cssVarV2('text/primary'),
  },
  failed: {
    label: 'Fehlgeschlagen',
    accent: cssVarV2('status/error'),
    chipBg: cssVarV2('layer/background/secondary'),
    chipFg: cssVarV2('text/primary'),
  },
  partial: {
    label: 'Teilweise',
    accent: cssVarV2('text/secondary'),
    chipBg: cssVarV2('layer/background/secondary'),
    chipFg: cssVarV2('text/primary'),
  },
};

type BulkTab = 'email' | 'schriftsatz' | 'mandantenbrief' | 'status-update' | 'pdf-export';

type Props = {
  clients: ClientRecord[];
  matters: MatterRecord[];
  canAction: (action: CaseAssistantAction) => boolean;
  isWorkflowBusy: boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;

  onBulkSendEmails: (input: {
    clientIds: string[];
    templateType: EmailTemplateType;
    subject: string;
    bodyTemplate: string;
    templateContext?: {
      fristDatum?: string;
      customFields?: Record<string, string>;
    };
  }) => Promise<BulkOperation | null>;

  onBulkGenerateSchriftsaetze: (input: {
    matterIds: string[];
    template: string;
    customFields?: Record<string, string>;
  }) => Promise<BulkOperation | null>;

  onBulkGenerateMandantenbriefe: (input: {
    matterIds: string[];
    sachverhalt?: string;
  }) => Promise<BulkOperation | null>;

  onBulkUpdateMatterStatus: (input: {
    matterIds: string[];
    newStatus: 'open' | 'closed' | 'archived';
  }) => Promise<BulkOperation | null>;

  onBulkPdfExport: (input: {
    matterIds: string[];
  }) => Promise<BulkOperation | null>;

  lastBulkOperation: BulkOperation | null;
  kanzleiName?: string;
  anwaltName?: string;
  clientsById: Map<string, ClientRecord>;
};

export const BulkOperationsSection = memo((props: Props) => {
  const [activeTab, setActiveTab] = useState<BulkTab>('email');
  const canBulk = props.canAction('bulk.execute');

  // Email state
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateType>('statusbericht');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailFristDatum, setEmailFristDatum] = useState('');
  const [emailVersicherungName, setEmailVersicherungName] = useState('');
  const [emailVersicherungsnummer, setEmailVersicherungsnummer] = useState('');
  const [emailSchadensdatum, setEmailSchadensdatum] = useState('');

  // Schriftsatz state
  const [selectedMatterIds, setSelectedMatterIds] = useState<Set<string>>(new Set());
  const [schriftsatzTemplate, setSchriftsatzTemplate] = useState('klageschrift');
  const [schriftsatzVersicherungsnummer, setSchriftsatzVersicherungsnummer] = useState('');
  const [schriftsatzSchadenNummer, setSchriftsatzSchadenNummer] = useState('');
  const [schriftsatzSchadensdatum, setSchriftsatzSchadensdatum] = useState('');
  const [schriftsatzAntwortfrist, setSchriftsatzAntwortfrist] = useState('');

  // Mandantenbrief state
  const [briefMatterIds, setBriefMatterIds] = useState<Set<string>>(new Set());
  const [briefSachverhalt, setBriefSachverhalt] = useState('');

  // Status-Update state
  const [statusMatterIds, setStatusMatterIds] = useState<Set<string>>(new Set());
  const [newMatterStatus, setNewMatterStatus] = useState<'open' | 'closed' | 'archived'>('closed');

  // PDF-Export state
  const [pdfMatterIds, setPdfMatterIds] = useState<Set<string>>(new Set());

  const isRechtsschutzSchriftsatzTemplate =
    schriftsatzTemplate === 'rechtsschutzanfrage_schriftsatz'
    || schriftsatzTemplate === 'deckungszusage_erinnerung_schriftsatz';
  const isDeckungszusageReminderTemplate =
    schriftsatzTemplate === 'deckungszusage_erinnerung_schriftsatz';

  const activeClients = useMemo(
    () => props.clients.filter(c => !c.archived),
    [props.clients]
  );

  const activeMatters = useMemo(
    () => props.matters.filter(m => m.status !== 'archived'),
    [props.matters]
  );

  const selectedSchriftsatzMatters = useMemo(
    () => activeMatters.filter(m => selectedMatterIds.has(m.id)),
    [activeMatters, selectedMatterIds]
  );

  const selectedRechtsschutzWithoutOpponentCount = useMemo(() => {
    if (!isRechtsschutzSchriftsatzTemplate) return 0;
    return selectedSchriftsatzMatters.filter(m => (m.opposingParties?.length ?? 0) === 0).length;
  }, [isRechtsschutzSchriftsatzTemplate, selectedSchriftsatzMatters]);

  const missingSchriftsatzVersicherung =
    isRechtsschutzSchriftsatzTemplate && !schriftsatzVersicherungsnummer.trim();
  const missingSchriftsatzAntwortfrist =
    isDeckungszusageReminderTemplate && !schriftsatzAntwortfrist.trim();

  const toggleClientId = useCallback((id: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleMatterId = useCallback((id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllClients = useCallback(() => {
    setSelectedClientIds(new Set(activeClients.map(c => c.id)));
  }, [activeClients]);

  const selectAllMatters = useCallback((setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter(new Set(activeMatters.map(m => m.id)));
  }, [activeMatters]);

  const handleBulkEmail = useCallback(async () => {
    if (selectedClientIds.size === 0) return;

    const customFields: Record<string, string> = {};
    if (emailVersicherungName.trim()) customFields.versicherungName = emailVersicherungName.trim();
    if (emailVersicherungsnummer.trim()) customFields.versicherungsnummer = emailVersicherungsnummer.trim();
    if (emailSchadensdatum.trim()) customFields.schadensdatum = emailSchadensdatum.trim();
    const templateContext =
      emailFristDatum.trim() || Object.keys(customFields).length > 0
        ? {
          ...(emailFristDatum.trim() ? { fristDatum: emailFristDatum.trim() } : {}),
          ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        }
        : undefined;

    await props.onBulkSendEmails({
      clientIds: Array.from(selectedClientIds),
      templateType: emailTemplate,
      subject: emailSubject.trim() || `Mitteilung — ${props.kanzleiName ?? 'Kanzlei'}`,
      bodyTemplate: emailBody,
      templateContext,
    });
    setSelectedClientIds(new Set());
    setEmailSubject('');
    setEmailBody('');
    setEmailFristDatum('');
    setEmailVersicherungName('');
    setEmailVersicherungsnummer('');
    setEmailSchadensdatum('');
  }, [
    selectedClientIds,
    emailTemplate,
    emailSubject,
    emailBody,
    emailFristDatum,
    emailVersicherungName,
    emailVersicherungsnummer,
    emailSchadensdatum,
    props,
  ]);

  const handleBulkSchriftsatz = useCallback(async () => {
    if (selectedMatterIds.size === 0) return;
    if (missingSchriftsatzVersicherung || missingSchriftsatzAntwortfrist) return;

    const customFields: Record<string, string> = {};
    if (schriftsatzVersicherungsnummer.trim()) customFields.versicherungsnummer = schriftsatzVersicherungsnummer.trim();
    if (schriftsatzSchadenNummer.trim()) customFields.schadenNummer = schriftsatzSchadenNummer.trim();
    if (schriftsatzSchadensdatum.trim()) customFields.schadensdatum = schriftsatzSchadensdatum.trim();
    if (schriftsatzAntwortfrist.trim()) customFields.antwortfrist = schriftsatzAntwortfrist.trim();

    await props.onBulkGenerateSchriftsaetze({
      matterIds: Array.from(selectedMatterIds),
      template: schriftsatzTemplate,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });
    setSelectedMatterIds(new Set());
    setSchriftsatzVersicherungsnummer('');
    setSchriftsatzSchadenNummer('');
    setSchriftsatzSchadensdatum('');
    setSchriftsatzAntwortfrist('');
  }, [
    selectedMatterIds,
    missingSchriftsatzVersicherung,
    missingSchriftsatzAntwortfrist,
    schriftsatzTemplate,
    schriftsatzVersicherungsnummer,
    schriftsatzSchadenNummer,
    schriftsatzSchadensdatum,
    schriftsatzAntwortfrist,
    props,
  ]);

  const handleBulkBrief = useCallback(async () => {
    if (briefMatterIds.size === 0) return;
    await props.onBulkGenerateMandantenbriefe({
      matterIds: Array.from(briefMatterIds),
      sachverhalt: briefSachverhalt.trim() || undefined,
    });
    setBriefMatterIds(new Set());
    setBriefSachverhalt('');
  }, [briefMatterIds, briefSachverhalt, props]);

  const handleBulkStatusUpdate = useCallback(async () => {
    if (statusMatterIds.size === 0) return;
    await props.onBulkUpdateMatterStatus({
      matterIds: Array.from(statusMatterIds),
      newStatus: newMatterStatus,
    });
    setStatusMatterIds(new Set());
  }, [statusMatterIds, newMatterStatus, props]);

  const handleBulkPdfExport = useCallback(async () => {
    if (pdfMatterIds.size === 0) return;
    await props.onBulkPdfExport({ matterIds: Array.from(pdfMatterIds) });
    setPdfMatterIds(new Set());
  }, [pdfMatterIds, props]);

  const op = props.lastBulkOperation;
  const opBadge = op ? STATUS_BADGE[op.status] : null;

  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary} aria-label="Bulk-Operationen und Sammelaktionen">
        Bulk-Operationen & Sammelversand
      </summary>

      {!canBulk ? (
        <div className={styles.empty}>
          <div className={localStyles.emptyCompact}>
          Bulk-Operationen erfordern die Rolle „Operator" oder höher.
          </div>
        </div>
      ) : (
        <>
          {/* Tab Bar */}
          <div
            role="tablist"
            aria-label="Bulk-Operation auswählen"
            className={localStyles.tabList}
          >
            {([
              { id: 'email' as const, label: 'Sammel-Email' },
              { id: 'schriftsatz' as const, label: 'Schriftsatz' },
              { id: 'mandantenbrief' as const, label: 'Mandantenbrief' },
              { id: 'status-update' as const, label: 'Status' },
              { id: 'pdf-export' as const, label: 'PDF-Export' },
            ]).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={
                  activeTab === tab.id
                    ? `${localStyles.tabButton} ${localStyles.tabButtonActive}`
                    : localStyles.tabButton
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Email Tab */}
          {activeTab === 'email' ? (
            <div role="tabpanel" aria-label="Sammel-Email" className={localStyles.panel}>
              <div className={localStyles.panelHelp}>
                Senden Sie eine E-Mail an mehrere Mandanten gleichzeitig.
              </div>

              <label className={styles.formLabel} htmlFor="bulk-email-template">
                Vorlage
                <select
                  id="bulk-email-template"
                  className={styles.input}
                  value={emailTemplate}
                  onChange={e => setEmailTemplate(e.target.value as EmailTemplateType)}
                >
                  {(Object.entries(EMAIL_TEMPLATE_LABELS) as Array<[EmailTemplateType, string]>).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </label>

              <label className={styles.formLabel} htmlFor="bulk-email-subject">
                Betreff
                <input
                  id="bulk-email-subject"
                  className={styles.input}
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Betreff der E-Mail…"
                />
              </label>

              <label className={styles.formLabel} htmlFor="bulk-email-body">
                Nachricht
                <textarea
                  id="bulk-email-body"
                  className={`${styles.input} ${localStyles.textarea}`}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Inhalt der E-Mail…"
                  rows={4}
                />
              </label>

              {emailTemplate === 'fristenwarnung' ? (
                <label className={styles.formLabel} htmlFor="bulk-email-frist-datum">
                  Fristdatum
                  <input
                    id="bulk-email-frist-datum"
                    className={styles.input}
                    type="date"
                    value={emailFristDatum}
                    onChange={e => setEmailFristDatum(e.target.value)}
                  />
                </label>
              ) : null}

              {(emailTemplate === 'rechtsschutzanfrage' || emailTemplate === 'deckungszusage_erinnerung') ? (
                <>
                  <label className={styles.formLabel} htmlFor="bulk-email-versicherung-name">
                    Versicherung
                    <input
                      id="bulk-email-versicherung-name"
                      className={styles.input}
                      value={emailVersicherungName}
                      onChange={e => setEmailVersicherungName(e.target.value)}
                      placeholder="z. B. ARAG"
                    />
                  </label>
                  <label className={styles.formLabel} htmlFor="bulk-email-versicherungsnummer">
                    Versicherungsschein-Nr.
                    <input
                      id="bulk-email-versicherungsnummer"
                      className={styles.input}
                      value={emailVersicherungsnummer}
                      onChange={e => setEmailVersicherungsnummer(e.target.value)}
                      placeholder="Policenummer"
                    />
                  </label>
                  <label className={styles.formLabel} htmlFor="bulk-email-schadensdatum">
                    Schadensdatum
                    <input
                      id="bulk-email-schadensdatum"
                      className={styles.input}
                      type="date"
                      value={emailSchadensdatum}
                      onChange={e => setEmailSchadensdatum(e.target.value)}
                    />
                  </label>
                </>
              ) : null}

              <fieldset className={localStyles.fieldset}>
                <legend className={localStyles.legend}>
                  Empfänger ({selectedClientIds.size} / {activeClients.length})
                </legend>
                <div className={localStyles.fieldsetActions}>
                  <button
                    type="button"
                    onClick={selectAllClients}
                    className={localStyles.microButton}
                  >
                    Alle auswählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedClientIds(new Set())}
                    className={localStyles.microButton}
                  >
                    Auswahl löschen
                  </button>
                </div>
                <div className={localStyles.optionList}>
                  {activeClients.map(client => (
                    <label
                      key={client.id}
                      className={localStyles.optionRow}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClientIds.has(client.id)}
                        onChange={() => toggleClientId(client.id)}
                      />
                      {client.displayName}
                      {client.primaryEmail ? (
                        <span className={localStyles.optionMeta}>({client.primaryEmail})</span>
                      ) : (
                        <span className={`${localStyles.optionMeta} ${localStyles.optionMetaDanger}`}>
                          (keine E-Mail)
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Button
                variant="secondary"
                disabled={selectedClientIds.size === 0 || props.isWorkflowBusy}
                onClick={() => props.runAsyncUiAction(handleBulkEmail, 'bulk email failed')}
              >
                {props.isWorkflowBusy ? 'Wird gesendet…' : `An ${selectedClientIds.size} Mandanten senden`}
              </Button>
            </div>
          ) : null}

          {/* Schriftsatz Tab */}
          {activeTab === 'schriftsatz' ? (
            <div role="tabpanel" aria-label="Sammel-Schriftsatz" className={localStyles.panel}>
              <div className={localStyles.panelHelp}>
                Generieren Sie Schriftsätze für mehrere Akten auf einmal.
                Mandant (Kläger) und Gegner (Beklagter) werden automatisch aus den Aktendaten übernommen.
              </div>

              <label className={styles.formLabel} htmlFor="bulk-schriftsatz-template">
                Schriftsatz-Vorlage
                <select
                  id="bulk-schriftsatz-template"
                  className={styles.input}
                  value={schriftsatzTemplate}
                  onChange={e => setSchriftsatzTemplate(e.target.value)}
                >
                  <option value="klageschrift">Klageschrift</option>
                  <option value="klageerwiderung">Klageerwiderung</option>
                  <option value="widerspruch">Widerspruch</option>
                  <option value="berufungsschrift">Berufungsschrift</option>
                  <option value="mandantenbrief">Mandantenbrief</option>
                  <option value="sachverhaltsdarstellung">Sachverhaltsdarstellung</option>
                  <option value="mahnung">Mahnung</option>
                  <option value="abmahnung">Abmahnung</option>
                  <option value="kuendigung">Kündigung</option>
                  <option value="rechtsschutzanfrage_schriftsatz">Rechtsschutzanfrage</option>
                  <option value="deckungszusage_erinnerung_schriftsatz">Erinnerung Deckungszusage</option>
                </select>
              </label>

              {isRechtsschutzSchriftsatzTemplate ? (
                <>
                  <label className={styles.formLabel} htmlFor="bulk-schriftsatz-versicherungsnummer">
                    Versicherungsschein-Nr.
                    <input
                      id="bulk-schriftsatz-versicherungsnummer"
                      className={styles.input}
                      value={schriftsatzVersicherungsnummer}
                      onChange={e => setSchriftsatzVersicherungsnummer(e.target.value)}
                      placeholder="Policenummer"
                    />
                  </label>
                  <label className={styles.formLabel} htmlFor="bulk-schriftsatz-schaden-nummer">
                    Schadennummer
                    <input
                      id="bulk-schriftsatz-schaden-nummer"
                      className={styles.input}
                      value={schriftsatzSchadenNummer}
                      onChange={e => setSchriftsatzSchadenNummer(e.target.value)}
                      placeholder="Schaden-ID"
                    />
                  </label>
                  <label className={styles.formLabel} htmlFor="bulk-schriftsatz-schadensdatum">
                    Schadensdatum
                    <input
                      id="bulk-schriftsatz-schadensdatum"
                      className={styles.input}
                      type="date"
                      value={schriftsatzSchadensdatum}
                      onChange={e => setSchriftsatzSchadensdatum(e.target.value)}
                    />
                  </label>
                  {isDeckungszusageReminderTemplate ? (
                    <label className={styles.formLabel} htmlFor="bulk-schriftsatz-antwortfrist">
                      Antwortfrist
                      <input
                        id="bulk-schriftsatz-antwortfrist"
                        className={styles.input}
                        type="date"
                        value={schriftsatzAntwortfrist}
                        onChange={e => setSchriftsatzAntwortfrist(e.target.value)}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}

              <fieldset className={localStyles.fieldset}>
                <legend className={localStyles.legend}>
                  Akten ({selectedMatterIds.size} / {activeMatters.length})
                </legend>
                <div className={localStyles.fieldsetActions}>
                  <button
                    type="button"
                    onClick={() => selectAllMatters(setSelectedMatterIds)}
                    className={localStyles.microButton}
                  >
                    Alle auswählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMatterIds(new Set())}
                    className={localStyles.microButton}
                  >
                    Auswahl löschen
                  </button>
                </div>
                <div className={localStyles.matterList}>
                  {activeMatters.map(matter => {
                    const cIds = matter.clientIds?.length ? matter.clientIds : matter.clientId ? [matter.clientId] : [];
                    const mClients = cIds.map(cid => props.clientsById.get(cid)).filter(Boolean);
                    const opponents = matter.opposingParties ?? [];
                    const isSelected = selectedMatterIds.has(matter.id);
                    return (
                      <div
                        key={matter.id}
                        className={localStyles.matterCard}
                        data-selected={isSelected ? 'true' : 'false'}
                      >
                        <label className={localStyles.matterMainRow}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMatterId(matter.id, setSelectedMatterIds)}
                          />
                          <span className={localStyles.matterTitle}>{matter.title}</span>
                          {matter.externalRef ? (
                            <span className={localStyles.optionMeta}>AZ: {matter.externalRef}</span>
                          ) : null}
                        </label>
                        {isSelected ? (
                          <div className={localStyles.matterDetails}>
                            <span>
                              Mandant: {mClients.length > 0
                                ? mClients.map(c => c!.displayName).join(', ')
                                : <span className={localStyles.inlineWarn}>kein Mandant</span>}
                            </span>
                            <span>
                              Gegner: {opponents.length > 0
                                ? opponents.map(p => p.displayName).join(', ')
                                : <span className={localStyles.optionMeta}>kein Gegner</span>}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              {selectedMatterIds.size > 0 ? (
                <div className={localStyles.infoBanner}>
                  Für jede Akte werden Mandant → Kläger und Gegner → Beklagter automatisch aus den hinterlegten Aktendaten übernommen.
                  Kanzlei-Briefkopf und Anwalt werden ebenfalls eingefügt.
                </div>
              ) : null}

              {missingSchriftsatzVersicherung ? (
                <div className={localStyles.warnBanner}>
                  Für Rechtsschutz-Schriftstücke ist die Versicherungsschein-Nr. ein Pflichtfeld.
                </div>
              ) : null}

              {missingSchriftsatzAntwortfrist ? (
                <div className={localStyles.warnBanner}>
                  Für die Erinnerung zur Deckungszusage muss eine Antwortfrist gesetzt werden.
                </div>
              ) : null}

              {selectedRechtsschutzWithoutOpponentCount > 0 ? (
                <div className={localStyles.infoBanner}>
                  In {selectedRechtsschutzWithoutOpponentCount} ausgewählten Akte
                  {selectedRechtsschutzWithoutOpponentCount === 1 ? '' : 'n'} ist kein Gegner (Versicherer) hinterlegt.
                  Im Dokument wird dann ein Platzhalter verwendet.
                </div>
              ) : null}

              <Button
                variant="secondary"
                disabled={
                  selectedMatterIds.size === 0
                  || props.isWorkflowBusy
                  || missingSchriftsatzVersicherung
                  || missingSchriftsatzAntwortfrist
                }
                onClick={() => props.runAsyncUiAction(handleBulkSchriftsatz, 'bulk schriftsatz failed')}
              >
                {props.isWorkflowBusy ? 'Wird generiert…' : `${selectedMatterIds.size} Schriftsätze generieren`}
              </Button>
            </div>
          ) : null}

          {/* Mandantenbrief Tab */}
          {activeTab === 'mandantenbrief' ? (
            <div role="tabpanel" aria-label="Sammel-Mandantenbrief" className={localStyles.panel}>
              <div className={localStyles.panelHelp}>
                Erzeugen Sie personalisierte Mandantenbriefe für alle Mandanten ausgewählter Akten.
                Empfänger werden automatisch aus der Akten-Zuordnung übernommen.
              </div>

              <label className={styles.formLabel} htmlFor="bulk-brief-sachverhalt">
                Sachstand (optional)
                <textarea
                  id="bulk-brief-sachverhalt"
                  className={`${styles.input} ${localStyles.textarea}`}
                  value={briefSachverhalt}
                  onChange={e => setBriefSachverhalt(e.target.value)}
                  placeholder="Sachstand für alle Briefe…"
                  rows={3}
                />
              </label>

              <fieldset className={localStyles.fieldset}>
                <legend className={localStyles.legend}>
                  Akten ({briefMatterIds.size} / {activeMatters.length})
                </legend>
                <div className={localStyles.fieldsetActions}>
                  <button
                    type="button"
                    onClick={() => selectAllMatters(setBriefMatterIds)}
                    className={localStyles.microButton}
                  >
                    Alle auswählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setBriefMatterIds(new Set())}
                    className={localStyles.microButton}
                  >
                    Auswahl löschen
                  </button>
                </div>
                <div className={localStyles.matterList}>
                  {activeMatters.map(matter => {
                    const cIds = matter.clientIds?.length ? matter.clientIds : matter.clientId ? [matter.clientId] : [];
                    const mClients = cIds.map(cid => props.clientsById.get(cid)).filter(Boolean);
                    const isSelected = briefMatterIds.has(matter.id);
                    return (
                      <div
                        key={matter.id}
                        className={localStyles.matterCard}
                        data-selected={isSelected ? 'true' : 'false'}
                      >
                        <label className={localStyles.matterMainRow}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMatterId(matter.id, setBriefMatterIds)}
                          />
                          <span className={localStyles.matterTitle}>{matter.title}</span>
                        </label>
                        {isSelected ? (
                          <div className={localStyles.matterDetails}>
                            Empfänger:{' '}
                            {mClients.length > 0
                              ? mClients.map(c => c!.displayName).join(', ')
                              : <span className={localStyles.inlineWarn}>kein Mandant zugeordnet</span>}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              {briefMatterIds.size > 0 ? (() => {
                let totalRecipients = 0;
                briefMatterIds.forEach(mid => {
                  const m = activeMatters.find(x => x.id === mid);
                  if (!m) return;
                  const cIds = m.clientIds?.length ? m.clientIds : m.clientId ? [m.clientId] : [];
                  totalRecipients += cIds.length;
                });
                return (
                  <div className={localStyles.infoBanner}>
                    {totalRecipients} Mandantenbrief{totalRecipients !== 1 ? 'e' : ''} werden generiert
                    (aus {briefMatterIds.size} Akte{briefMatterIds.size !== 1 ? 'n' : ''}).
                  </div>
                );
              })() : null}

              <Button
                variant="secondary"
                disabled={briefMatterIds.size === 0 || props.isWorkflowBusy}
                onClick={() => props.runAsyncUiAction(handleBulkBrief, 'bulk mandantenbrief failed')}
              >
                {props.isWorkflowBusy ? 'Wird generiert…' : `Briefe für ${briefMatterIds.size} Akten generieren`}
              </Button>
            </div>
          ) : null}

          {/* Status-Update Tab */}
          {activeTab === 'status-update' ? (
            <div role="tabpanel" aria-label="Bulk-Status-Update" className={localStyles.panel}>
              <div className={localStyles.panelHelp}>
                Setzen Sie den Status mehrerer Akten auf einmal.
              </div>

              <label className={styles.formLabel} htmlFor="bulk-status-select">
                Neuer Status
                <select
                  id="bulk-status-select"
                  className={styles.input}
                  value={newMatterStatus}
                  onChange={e => setNewMatterStatus(e.target.value as 'open' | 'closed' | 'archived')}
                >
                  <option value="open">Offen</option>
                  <option value="closed">Abgeschlossen</option>
                  <option value="archived">Archiviert</option>
                </select>
              </label>

              <fieldset className={localStyles.fieldset}>
                <legend className={localStyles.legend}>
                  Akten ({statusMatterIds.size} / {activeMatters.length})
                </legend>
                <div className={localStyles.fieldsetActions}>
                  <button
                    type="button"
                    onClick={() => selectAllMatters(setStatusMatterIds)}
                    className={localStyles.microButton}
                  >
                    Alle auswählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusMatterIds(new Set())}
                    className={localStyles.microButton}
                  >
                    Auswahl löschen
                  </button>
                </div>
                <div className={localStyles.optionList}>
                  {activeMatters.map(matter => (
                    <label
                      key={matter.id}
                      className={localStyles.optionRow}
                    >
                      <input
                        type="checkbox"
                        checked={statusMatterIds.has(matter.id)}
                        onChange={() => toggleMatterId(matter.id, setStatusMatterIds)}
                      />
                      {matter.title}
                      <span className={`${localStyles.optionMeta} ${localStyles.optionMetaAuto}`}>
                        {matter.status === 'open' ? 'Offen' : matter.status === 'closed' ? 'Abgeschlossen' : 'Archiviert'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {newMatterStatus === 'archived' ? (
                <div className={localStyles.infoBanner}>
                  Archivierte Akten können nicht mehr bearbeitet werden. Nur bereits abgeschlossene Akten können archiviert werden.
                </div>
              ) : null}

              <Button
                variant="secondary"
                disabled={statusMatterIds.size === 0 || props.isWorkflowBusy}
                onClick={() => props.runAsyncUiAction(handleBulkStatusUpdate, 'bulk status update failed')}
              >
                {props.isWorkflowBusy ? 'Wird aktualisiert…' : `${statusMatterIds.size} Akten → ${newMatterStatus === 'open' ? 'Offen' : newMatterStatus === 'closed' ? 'Abgeschlossen' : 'Archiviert'}`}
              </Button>
            </div>
          ) : null}

          {/* PDF-Export Tab */}
          {activeTab === 'pdf-export' ? (
            <div role="tabpanel" aria-label="Bulk-PDF-Export" className={localStyles.panel}>
              <div className={localStyles.panelHelp}>
                Exportieren Sie alle indizierten Dokumente der ausgewählten Akten als HTML (druckbar als PDF).
              </div>

              <fieldset className={localStyles.fieldset}>
                <legend className={localStyles.legend}>
                  Akten ({pdfMatterIds.size} / {activeMatters.length})
                </legend>
                <div className={localStyles.fieldsetActions}>
                  <button
                    type="button"
                    onClick={() => selectAllMatters(setPdfMatterIds)}
                    className={localStyles.microButton}
                  >
                    Alle auswählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfMatterIds(new Set())}
                    className={localStyles.microButton}
                  >
                    Auswahl löschen
                  </button>
                </div>
                <div className={localStyles.optionList}>
                  {activeMatters.map(matter => (
                    <label
                      key={matter.id}
                      className={localStyles.optionRow}
                    >
                      <input
                        type="checkbox"
                        checked={pdfMatterIds.has(matter.id)}
                        onChange={() => toggleMatterId(matter.id, setPdfMatterIds)}
                      />
                      {matter.title}
                      {matter.externalRef ? (
                        <span className={localStyles.optionMeta}>({matter.externalRef})</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={localStyles.infoBanner}>
                Die Dokumente werden als HTML-Dateien heruntergeladen. Öffnen Sie diese im Browser und drucken Sie als PDF (Strg+P → Als PDF speichern).
              </div>

              <Button
                variant="secondary"
                disabled={pdfMatterIds.size === 0 || props.isWorkflowBusy}
                onClick={() => props.runAsyncUiAction(handleBulkPdfExport, 'bulk pdf export failed')}
              >
                {props.isWorkflowBusy ? 'Wird exportiert…' : `Dokumente aus ${pdfMatterIds.size} Akten exportieren`}
              </Button>
            </div>
          ) : null}

          {/* Last Operation Status */}
          {op ? (
            <div
              className={localStyles.opCard}
              style={assignInlineVars({
                [localStyles.accentColorVar]: opBadge?.accent ?? cssVarV2('text/secondary'),
                [localStyles.statusChipBgVar]: opBadge?.chipBg ?? cssVarV2('layer/background/secondary'),
                [localStyles.statusChipFgVar]: opBadge?.chipFg ?? cssVarV2('text/secondary'),
                [localStyles.progressWidthVar]: `${op.progress}%`,
              })}
              role="status"
              aria-live="polite"
            >
              <div className={localStyles.opHeaderRow}>
                <span className={localStyles.opBadge}>
                  {opBadge?.label ?? op.status}
                </span>
                <span className={localStyles.opTitle}>
                  {op.type === 'email' ? 'Sammel-Email' :
                   op.type === 'schriftsatz' ? 'Sammel-Schriftsatz' :
                   op.type === 'mandantenbrief' ? 'Sammel-Mandantenbrief' :
                   op.type}
                </span>
              </div>

              {/* Progress bar */}
              <div className={localStyles.progressTrack}>
                <div className={localStyles.progressFill} />
              </div>

              <div className={localStyles.opSummary}>
                {op.completedItems}/{op.totalItems} erfolgreich
                {op.failedItems > 0 ? ` · ${op.failedItems} fehlgeschlagen` : ''}
              </div>

              {op.results.length > 0 ? (
                <details className={localStyles.opDetails}>
                  <summary className={localStyles.opDetailsSummary}>
                    Details ({op.results.length})
                  </summary>
                  <ul className={localStyles.resultsList}>
                    {op.results.slice(0, 20).map((r, i) => (
                      <li
                        key={i}
                        className={r.success ? localStyles.resultItemSuccess : localStyles.resultItemFail}
                      >
                        {r.success ? '✓' : '✗'} {r.message}
                      </li>
                    ))}
                    {op.results.length > 20 ? (
                      <li className={localStyles.resultItemMore}>
                        … und {op.results.length - 20} weitere
                      </li>
                    ) : null}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </details>
  );
});

BulkOperationsSection.displayName = 'BulkOperationsSection';
