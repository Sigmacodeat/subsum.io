import { Button } from '@affine/component';
import type {
  ClientRecord,
  DocumentTemplate,
  GeneratedDocument,
  MatterRecord,
  OpposingParty,
} from '@affine/core/modules/case-assistant';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import { sanitizeDisplayText } from '../utils';
import * as localStyles from './document-generator-section.css';

type TemplateOption = {
  id: string;
  label: string;
};

type Props = {
  templateOptions: TemplateOption[];
  docGenTemplate: DocumentTemplate;
  setDocGenTemplate: (value: DocumentTemplate) => void;
  docGenPartyKlaeger: string;
  setDocGenPartyKlaeger: (value: string) => void;
  docGenPartyBeklagter: string;
  setDocGenPartyBeklagter: (value: string) => void;
  docGenGericht: string;
  setDocGenGericht: (value: string) => void;
  docGenAktenzeichen: string;
  setDocGenAktenzeichen: (value: string) => void;
  onGenerateDocument: () => Promise<void>;
  onExportGeneratedDocumentPdf: () => Promise<void>;
  generatedDoc: GeneratedDocument | null;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onInsertGeneratedDocumentIntoCurrentDoc: () => Promise<void>;
  onOptimizeWithCopilot?: () => void;

  matters: MatterRecord[];
  clients: ClientRecord[];
  clientsById: Map<string, ClientRecord>;
  selectedDocGenMatterId: string;
  setSelectedDocGenMatterId: (id: string) => void;
  currentMatter: MatterRecord | null | undefined;
  currentClient: ClientRecord | null | undefined;
  anwaltDisplayName?: string;
  kanzleiName?: string;
};

const TEMPLATES_NEEDING_PARTIES = new Set<DocumentTemplate>([
  'klageschrift', 'klageerwiderung', 'berufungsschrift', 'widerspruch',
  'vergleichsvorschlag', 'mahnung', 'abmahnung',
  'rechtsschutzanfrage_schriftsatz', 'deckungszusage_erinnerung_schriftsatz',
]);

const TEMPLATES_NEEDING_EMPFAENGER = new Set<DocumentTemplate>([
  'mandantenbrief', 'mahnung', 'kuendigung', 'mietminderungsanzeige',
]);

export const DocumentGeneratorSection = memo((props: Props) => {
  const [isAutoPopulated, setIsAutoPopulated] = useState(false);

  const activeMatters = useMemo(
    () => props.matters.filter(m => m.status !== 'archived'),
    [props.matters]
  );

  const selectedMatter = useMemo(() => {
    if (props.selectedDocGenMatterId) {
      return activeMatters.find(m => m.id === props.selectedDocGenMatterId) ?? null;
    }
    return props.currentMatter ?? null;
  }, [props.selectedDocGenMatterId, activeMatters, props.currentMatter]);

  const matterClients = useMemo(() => {
    if (!selectedMatter) return [];
    const ids = selectedMatter.clientIds?.length
      ? selectedMatter.clientIds
      : selectedMatter.clientId ? [selectedMatter.clientId] : [];
    return ids.map(id => props.clientsById.get(id)).filter(Boolean) as ClientRecord[];
  }, [selectedMatter, props.clientsById]);

  const matterOpposingParties = useMemo(
    () => selectedMatter?.opposingParties ?? [],
    [selectedMatter]
  );

  const needsParties = TEMPLATES_NEEDING_PARTIES.has(props.docGenTemplate);
  const needsEmpfaenger = TEMPLATES_NEEDING_EMPFAENGER.has(props.docGenTemplate);

  const { setSelectedDocGenMatterId } = props;
  const onSelectMatter = useCallback((matterId: string) => {
    setSelectedDocGenMatterId(matterId);
    setIsAutoPopulated(false);
  }, [setSelectedDocGenMatterId]);

  const { setDocGenPartyKlaeger, setDocGenPartyBeklagter, setDocGenAktenzeichen, setDocGenGericht } = props;

  useEffect(() => {
    if (!selectedMatter || isAutoPopulated) return;

    if (matterClients.length > 0) {
      const names = matterClients.map(c => c.displayName).join(', ');
      setDocGenPartyKlaeger(names);
    }

    if (matterOpposingParties.length > 0) {
      const names = matterOpposingParties.map(p => p.displayName).join(', ');
      setDocGenPartyBeklagter(names);
    }

    if (selectedMatter.externalRef) {
      setDocGenAktenzeichen(selectedMatter.externalRef);
    }

    if (selectedMatter.gericht) {
      setDocGenGericht(selectedMatter.gericht);
    }

    setIsAutoPopulated(true);
  }, [selectedMatter, matterClients, matterOpposingParties, isAutoPopulated, setDocGenPartyKlaeger, setDocGenPartyBeklagter, setDocGenAktenzeichen, setDocGenGericht]);

  const contextBadge = selectedMatter ? (
    <div className={localStyles.contextBadge}>
      <span className={localStyles.contextBadgeTitle}>{selectedMatter.title}</span>
      {selectedMatter.externalRef ? (
        <span className={localStyles.metaText}>AZ: {selectedMatter.externalRef}</span>
      ) : null}
      {matterClients.length > 0 ? (
        <span>• Mandant: {matterClients.map(c => c.displayName).join(', ')}</span>
      ) : null}
      {matterOpposingParties.length > 0 ? (
        <span>• Gegenseite: {matterOpposingParties.map(p => p.displayName).join(', ')}</span>
      ) : null}
    </div>
  ) : null;

  return (
    <details className={styles.toolAccordion} open>
      <summary className={styles.toolAccordionSummary} aria-label="Schriftsatz-Generator">
        Schriftsatz-Generator (13 Templates)
      </summary>

      {/* Step 1: Matter Selection */}
      <div className={localStyles.stepBlock}>
        <div className={localStyles.stepLabel}>
          Schritt 1 — Akte wählen (für auto-Vorbelegung)
        </div>
        <label className={styles.formLabel} htmlFor="docgen-matter-picker">
          Akte / Verfahren
          <select
            id="docgen-matter-picker"
            className={styles.input}
            value={props.selectedDocGenMatterId || selectedMatter?.id || ''}
            onChange={e => onSelectMatter(e.target.value)}
          >
            <option value="">— Keine Akte gewählt —</option>
            {activeMatters.map(m => {
              const client = props.clientsById.get(m.clientId);
              return (
                <option key={m.id} value={m.id}>
                  {m.title}{m.externalRef ? ` (${m.externalRef})` : ''}{client ? ` — ${client.displayName}` : ''}
                </option>
              );
            })}
          </select>
        </label>

        {contextBadge}

        {selectedMatter && matterClients.length === 0 ? (
          <div className={localStyles.warnBanner} role="alert">
            Dieser Akte ist kein Mandant zugeordnet. Bitte zuerst einen Mandanten in der Mandantenverwaltung anlegen.
          </div>
        ) : null}

        {selectedMatter && needsParties && matterOpposingParties.length === 0 ? (
          <div className={localStyles.infoBanner} role="status">
            Keine Gegenseite hinterlegt. Sie können den Beklagten manuell eingeben oder in der Gegner-Verwaltung anlegen.
          </div>
        ) : null}
      </div>

      {/* Step 2: Template + Party Fields */}
      <div className={`${localStyles.stepBlock} ${localStyles.stepBlockSeparated}`}>
        <div className={localStyles.stepLabel}>
          Schritt 2 — Template & Parteien
        </div>

        <div className={styles.formGrid}>
          <label className={styles.formLabel} htmlFor="docgen-template">
            Template
            <select
              id="docgen-template"
              className={styles.input}
              value={props.docGenTemplate}
              onChange={event =>
                props.setDocGenTemplate(event.target.value as DocumentTemplate)
              }
            >
              {props.templateOptions.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {needsParties || needsEmpfaenger ? (
            <label className={styles.formLabel} htmlFor="docgen-klaeger">
              {needsEmpfaenger ? 'Empfänger / Mandant' : 'Kläger/in'}
              <div className={localStyles.inlineRow}>
                <input
                  id="docgen-klaeger"
                  className={`${styles.input} ${localStyles.grow}`}
                  value={props.docGenPartyKlaeger}
                  onChange={event => props.setDocGenPartyKlaeger(event.target.value)}
                  placeholder={needsEmpfaenger ? 'Mandant wählen oder eingeben' : 'Max Mustermann'}
                />
                {matterClients.length > 0 ? (
                  <select
                    className={`${styles.input} ${localStyles.compactSelect}`}
                    value=""
                    onChange={e => {
                      if (e.target.value) props.setDocGenPartyKlaeger(e.target.value);
                    }}
                    title="Mandant aus Akte übernehmen"
                  >
                    <option value="">Aus Akte übernehmen</option>
                    {matterClients.map(c => (
                      <option key={c.id} value={c.displayName}>
                        {c.displayName}
                      </option>
                    ))}
                    {matterClients.length > 1 ? (
                      <option value={matterClients.map(c => c.displayName).join(', ')}>
                        Alle ({matterClients.length})
                      </option>
                    ) : null}
                  </select>
                ) : null}
              </div>
            </label>
          ) : null}

          {needsParties ? (
            <label className={styles.formLabel} htmlFor="docgen-beklagter">
              Beklagte/r
              <div className={localStyles.inlineRow}>
                <input
                  id="docgen-beklagter"
                  className={`${styles.input} ${localStyles.grow}`}
                  value={props.docGenPartyBeklagter}
                  onChange={event => props.setDocGenPartyBeklagter(event.target.value)}
                  placeholder="Firma XY GmbH"
                />
                {matterOpposingParties.length > 0 ? (
                  <select
                    className={`${styles.input} ${localStyles.compactSelect}`}
                    value=""
                    onChange={e => {
                      if (e.target.value) props.setDocGenPartyBeklagter(e.target.value);
                    }}
                    title="Gegner aus Akte übernehmen"
                  >
                    <option value="">Aus Akte übernehmen</option>
                    {matterOpposingParties.map((p: OpposingParty) => (
                      <option key={p.id} value={p.displayName}>
                        {p.displayName}
                      </option>
                    ))}
                    {matterOpposingParties.length > 1 ? (
                      <option value={matterOpposingParties.map((p: OpposingParty) => p.displayName).join(', ')}>
                        Alle ({matterOpposingParties.length})
                      </option>
                    ) : null}
                  </select>
                ) : null}
              </div>
            </label>
          ) : null}

          <label className={styles.formLabel} htmlFor="docgen-gericht">
            Gericht
            <input
              id="docgen-gericht"
              className={styles.input}
              value={props.docGenGericht}
              onChange={event => props.setDocGenGericht(event.target.value)}
              placeholder="Landgericht Berlin"
            />
          </label>
          <label className={styles.formLabel} htmlFor="docgen-aktenzeichen">
            Aktenzeichen
            <input
              id="docgen-aktenzeichen"
              className={styles.input}
              value={props.docGenAktenzeichen}
              onChange={event => props.setDocGenAktenzeichen(event.target.value)}
              placeholder="12 O 123/25"
            />
          </label>
        </div>

        {props.anwaltDisplayName || props.kanzleiName ? (
          <div className={localStyles.autoMetaRow}>
            {props.anwaltDisplayName ? <span>{props.anwaltDisplayName}</span> : null}
            {props.kanzleiName ? <span>{props.kanzleiName}</span> : null}
            <span className={localStyles.autoMetaSpacer}>wird automatisch eingefügt</span>
          </div>
        ) : null}
      </div>

      {/* Step 3: Generate + Actions */}
      <div className={`${localStyles.stepBlock} ${localStyles.stepBlockSeparated}`}>
        <div className={localStyles.stepLabel}>
          Schritt 3 — Generieren & Exportieren
        </div>
        <div className={styles.quickActionRow}>
          <Button
            variant="secondary"
            aria-label="Schriftsatz aus Falldaten generieren"
            onClick={() => {
              props.runAsyncUiAction(props.onGenerateDocument, 'document generation failed');
            }}
          >
            Dokument generieren
          </Button>
          <Button
            variant="plain"
            disabled={!props.generatedDoc}
            aria-label="Generierten Schriftsatz als PDF mit juristischem Layout exportieren"
            onClick={() => {
              props.runAsyncUiAction(
                props.onExportGeneratedDocumentPdf,
                'export generated pdf failed'
              );
            }}
          >
            PDF exportieren (juristisches Layout)
          </Button>
        </div>
      </div>

      {/* Generated Document Preview */}
      {props.generatedDoc ? (
        <div className={`${styles.previewCard} ${localStyles.previewCardSpaced}`}>
          <div className={styles.jobTitle}>
            {sanitizeDisplayText(props.generatedDoc.title)}
          </div>
          <div className={styles.jobMeta}>
            {props.generatedDoc.sections.length} Abschnitte •{' '}
            {props.generatedDoc.citations.length} Quellen •{' '}
            {props.generatedDoc.warnings.length} Warnungen
          </div>
          {props.generatedDoc.warnings.map((w, i) => (
            <div className={styles.warningBanner} key={`docgen-warn-${i}`} role="alert">
              {w}
            </div>
          ))}
          <pre className={styles.legalPreviewContent}>{props.generatedDoc.markdown}</pre>
          <div className={styles.quickActionRow}>
            <Button
              variant="plain"
              aria-label="Generierten Schriftsatz in das aktuell geöffnete Dokument einfügen"
              onClick={() => {
                props.runAsyncUiAction(
                  props.onInsertGeneratedDocumentIntoCurrentDoc,
                  'insert generated document failed'
                );
              }}
            >
              In aktuelles Dokument einfügen
            </Button>
            {props.onOptimizeWithCopilot ? (
              <Button
                variant="plain"
                aria-label="Generierten Schriftsatz im Copilot-Chat mit Aktenkontext weiter optimieren"
                onClick={props.onOptimizeWithCopilot}
              >
                Im Copilot weiteroptimieren
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </details>
  );
});

DocumentGeneratorSection.displayName = 'DocumentGeneratorSection';
