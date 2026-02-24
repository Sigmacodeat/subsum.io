import { Button } from '@affine/component';
import type {
  CourtDecision,
  Jurisdiction,
} from '@affine/core/modules/case-assistant';

import * as styles from '../../case-assistant.css';
import { isIsoDateInput } from '../utils';

type Props = {
  activeJurisdiction: Jurisdiction;
  canExecuteCopilot: boolean;
  isWorkflowBusy: boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  ingestionStatusSetter: (status: string) => void;

  // RIS
  risImportFromDate: string;
  setRisImportFromDate: (value: string) => void;
  risImportToDate: string;
  setRisImportToDate: (value: string) => void;
  risImportMaxResults: string;
  setRisImportMaxResults: (value: string) => void;
  risImportValidationError: string | null;
  isRisImporting: boolean;
  onImportRecentRisDecisions: () => Promise<void>;

  // BGH
  bghImportFromDate: string;
  setBghImportFromDate: (value: string) => void;
  bghImportToDate: string;
  setBghImportToDate: (value: string) => void;
  bghImportMaxResults: string;
  setBghImportMaxResults: (value: string) => void;
  isBghImporting: boolean;
  onImportRecentBghDecisions: () => Promise<void>;

  // HUDOC
  hudocRespondentState: string;
  setHudocRespondentState: (value: string) => void;
  hudocImportFromDate: string;
  setHudocImportFromDate: (value: string) => void;
  hudocImportToDate: string;
  setHudocImportToDate: (value: string) => void;
  hudocImportMaxResults: string;
  setHudocImportMaxResults: (value: string) => void;
  isHudocImporting: boolean;
  onImportRecentHudocDecisions: () => Promise<void>;

  // Search
  judikaturQuery: string;
  setJudikaturQuery: (value: string) => void;
  onSearchJudikatur: () => Promise<void>;
  judikaturResults: CourtDecision[];
  onInsertJudikaturCitation: (decision: CourtDecision) => Promise<void>;
};

function authorityHintForDecision(
  decision: CourtDecision,
  activeJurisdiction: Jurisdiction
) {
  const isCrossBorder = decision.jurisdiction !== activeJurisdiction;
  const authorityLabel = isCrossBorder
    ? decision.jurisdiction === 'ECHR' || decision.jurisdiction === 'EU'
      ? 'Persuasiv (international)'
      : 'Persuasiv (vergleichend)'
    : 'Primär relevant';

  return {
    isCrossBorder,
    authorityLabel,
  };
}

export const JudikaturSection = (props: Props) => {
  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary}>Judikatur-Recherche</summary>
      <div className={styles.jobMeta}>
        Local-first: nutzt importierte RIS/HUDOC/BGH Entscheidungen (offline) + optionalen Remote-Endpoint.
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          RIS Import (von)
          <input
            className={styles.input}
            type="date"
            value={props.risImportFromDate}
            onChange={event => props.setRisImportFromDate(event.target.value)}
            aria-invalid={
              !!props.risImportFromDate.trim() && !isIsoDateInput(props.risImportFromDate.trim())
            }
          />
        </label>
        <label className={styles.formLabel}>
          RIS Import (bis)
          <input
            className={styles.input}
            type="date"
            value={props.risImportToDate}
            onChange={event => props.setRisImportToDate(event.target.value)}
            aria-invalid={
              !!props.risImportToDate.trim() && !isIsoDateInput(props.risImportToDate.trim())
            }
          />
        </label>
        <label className={styles.formLabel}>
          RIS Import Max
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={props.risImportMaxResults}
            onChange={event => props.setRisImportMaxResults(event.target.value)}
            aria-invalid={!!props.risImportValidationError}
          />
        </label>
      </div>
      {props.risImportValidationError ? (
        <div className={styles.warningText} role="alert">
          {props.risImportValidationError}
        </div>
      ) : null}
      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          disabled={
            !props.canExecuteCopilot ||
            props.isWorkflowBusy ||
            props.isRisImporting ||
            !!props.risImportValidationError
          }
          onClick={() => {
            props.runAsyncUiAction(props.onImportRecentRisDecisions, 'RIS import failed');
          }}
        >
          {props.isRisImporting ? 'Importiere RIS…' : 'RIS (OGH) importieren'}
        </Button>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          BGH Import (von)
          <input
            className={styles.input}
            value={props.bghImportFromDate}
            onChange={event => props.setBghImportFromDate(event.target.value)}
            placeholder="YYYY-MM-DD (optional)"
          />
        </label>
        <label className={styles.formLabel}>
          BGH Import (bis)
          <input
            className={styles.input}
            value={props.bghImportToDate}
            onChange={event => props.setBghImportToDate(event.target.value)}
            placeholder="YYYY-MM-DD (optional)"
          />
        </label>
        <label className={styles.formLabel}>
          BGH Import Max
          <input
            className={styles.input}
            type="number"
            min={1}
            max={100}
            value={props.bghImportMaxResults}
            onChange={event => props.setBghImportMaxResults(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          disabled={!props.canExecuteCopilot || props.isWorkflowBusy || props.isBghImporting}
          onClick={() => {
            props.runAsyncUiAction(props.onImportRecentBghDecisions, 'BGH import failed');
          }}
        >
          {props.isBghImporting ? 'Importiere BGH…' : 'BGH importieren'}
        </Button>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          HUDOC Staat
          <input
            className={styles.input}
            value={props.hudocRespondentState}
            onChange={event => props.setHudocRespondentState(event.target.value)}
            placeholder="Austria / Germany"
          />
        </label>
        <label className={styles.formLabel}>
          HUDOC Import (von)
          <input
            className={styles.input}
            value={props.hudocImportFromDate}
            onChange={event => props.setHudocImportFromDate(event.target.value)}
            placeholder="YYYY-MM-DD (optional)"
          />
        </label>
        <label className={styles.formLabel}>
          HUDOC Import (bis)
          <input
            className={styles.input}
            value={props.hudocImportToDate}
            onChange={event => props.setHudocImportToDate(event.target.value)}
            placeholder="YYYY-MM-DD (optional)"
          />
        </label>
        <label className={styles.formLabel}>
          HUDOC Import Max
          <input
            className={styles.input}
            type="number"
            min={1}
            max={100}
            value={props.hudocImportMaxResults}
            onChange={event => props.setHudocImportMaxResults(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          disabled={!props.canExecuteCopilot || props.isWorkflowBusy || props.isHudocImporting}
          onClick={() => {
            props.runAsyncUiAction(props.onImportRecentHudocDecisions, 'HUDOC import failed');
          }}
        >
          {props.isHudocImporting ? 'Importiere HUDOC…' : 'HUDOC (EGMR) importieren'}
        </Button>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          Recherche-Query
          <input
            className={styles.input}
            value={props.judikaturQuery}
            onChange={event => props.setJudikaturQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                props.runAsyncUiAction(props.onSearchJudikatur, 'judikatur search failed');
              }
            }}
            placeholder="z. B. Kündigung treuwidrig Mietrecht"
          />
        </label>
      </div>
      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          onClick={() => {
            props.runAsyncUiAction(props.onSearchJudikatur, 'judikatur search failed');
          }}
        >
          Entscheide suchen
        </Button>
      </div>
      {props.judikaturResults.length > 0 ? (
        <ul className={styles.jobList}>
          {props.judikaturResults.map(item => (
            <li className={styles.jobItem} key={item.id}>
              {(() => {
                const authority = authorityHintForDecision(item, props.activeJurisdiction);
                return (
                  <>
              <div className={styles.jobTitle}>
                {item.court} {item.fileNumber} — {item.title}
              </div>
              <div className={styles.jobMeta}>
                {new Date(item.decisionDate).toLocaleDateString('de-DE')} • {item.legalAreas.join(', ')} •{' '}
                {item.jurisdiction} • {authority.authorityLabel}
              </div>
              {authority.isCrossBorder ? (
                <div className={styles.jobMeta} role="note" aria-live="polite">
                  Cross-Border-Hinweis: Diese Entscheidung stärkt die Argumentation vergleichend, ist im Regelfall aber nicht bindend.
                </div>
              ) : null}
              <div className={styles.jobMeta}>{item.summary}</div>
              <div className={styles.quickActionRow}>
                <Button
                  variant="plain"
                  aria-label={`Zitation kopieren: ${item.court} ${item.fileNumber}`}
                  onClick={() => {
                    const citation = `${item.court} ${item.fileNumber}, ${new Date(
                      item.decisionDate
                    ).toLocaleDateString('de-DE')} — ${item.title}`;
                    if (!navigator.clipboard?.writeText) {
                      props.ingestionStatusSetter(
                        'Zwischenablage ist in diesem Kontext nicht verfügbar.'
                      );
                      return;
                    }
                    props.runAsyncUiAction(async () => {
                      await navigator.clipboard.writeText(citation);
                      props.ingestionStatusSetter('Zitation in Zwischenablage kopiert.');
                    }, 'copy citation failed');
                  }}
                >
                  Zitieren
                </Button>
                <Button
                  variant="secondary"
                  aria-label={`Entscheidung in Dokument einfügen: ${item.court} ${item.fileNumber}`}
                  onClick={() => {
                    props.runAsyncUiAction(
                      () => props.onInsertJudikaturCitation(item),
                      'insert judikatur citation failed'
                    );
                  }}
                >
                  In Dokument einfügen
                </Button>
              </div>
              {item.sourceUrl ? (
                <a className={styles.jobMeta} href={item.sourceUrl} target="_blank" rel="noreferrer">
                  Quelle öffnen
                </a>
              ) : null}
                  </>
                );
              })()}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
};
