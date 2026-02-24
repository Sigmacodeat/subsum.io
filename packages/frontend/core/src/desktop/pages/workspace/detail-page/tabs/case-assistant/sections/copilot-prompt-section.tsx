import { Button } from '@affine/component';

import * as styles from '../../case-assistant.css';

type Props = {
  isCopilotPanelOpen: boolean;
  setIsCopilotPanelOpen: (updater: (value: boolean) => boolean) => void;

  copilotPrompt: string;
  setCopilotPrompt: (value: string) => void;

  isCopilotRunning: boolean;
  isWorkflowBusy: boolean;

  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onRunCopilotCommand: () => Promise<void>;

  copilotResponse: string | null;
};

export const CopilotPromptSection = (props: Props) => {
  return (
    <>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Legal Ops CoPilot</h3>
        <Button
          variant="plain"
          onClick={() => props.setIsCopilotPanelOpen(value => !value)}
        >
          {props.isCopilotPanelOpen ? 'Einklappen' : 'Ausklappen'}
        </Button>
      </div>
      <p className={styles.previewMeta}>Für schnelle Eingabe, Ausführung und Ergebnisprüfung.</p>

      {props.isCopilotPanelOpen ? (
        <>
          <label className={styles.formLabel}>
            Schritt 1: Prompt / Befehl
            <textarea
              className={styles.input}
              rows={5}
              value={props.copilotPrompt}
              onChange={event => props.setCopilotPrompt(event.target.value)}
              onKeyDown={event => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  props.runAsyncUiAction(
                    props.onRunCopilotCommand,
                    'copilot command failed'
                  );
                }
              }}
              placeholder="z. B. Erstelle aus allen Dokumenten in /akten/mandant-2026 ein Gerichtsschreiben mit Fristenprüfung"
            />
          </label>
          <p className={styles.previewMeta}>
            Tipp: Mit Cmd/Ctrl + Enter direkt ausführen.
          </p>

          <details className={styles.toolAccordion}>
            <summary className={styles.toolAccordionSummary}>Schnellvorlagen (optional)</summary>
            <div className={styles.quickActionRow}>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt(
                    'Gib mir eine vollständige Übersicht zum aktuellen Fall.'
                  )
                }
              >
                Fallübersicht
              </Button>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt(
                    'Welche Fristen und Termine sind offen?'
                  )
                }
              >
                Fristen
              </Button>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt(
                    'Wer sind die beteiligten Personen und Parteien?'
                  )
                }
              >
                Beteiligte
              </Button>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt(
                    'Welche Widersprüche und Probleme wurden in der Analyse gefunden?'
                  )
                }
              >
                Findings
              </Button>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt(
                    'Welche Aufgaben sind offen und was muss als nächstes getan werden?'
                  )
                }
              >
                Aufgaben
              </Button>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt(
                    'Analysiere den Fall vollständig auf Widersprüche, Haftung und Beweislücken.'
                  )
                }
              >
                Fallanalyse
              </Button>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt(
                    'Erstelle mir anhand der gesamten Dokumente ein Gerichtsschreiben mit klaren Anträgen und Fristenhinweisen.'
                  )
                }
              >
                Gerichtsschreiben
              </Button>
              <Button
                variant="plain"
                onClick={() =>
                  props.setCopilotPrompt('Führe OCR für alle ausstehenden Scan-Dokumente aus.')
                }
              >
                OCR Lauf
              </Button>
            </div>
          </details>

          <div className={styles.buttonRow}>
            <Button
              variant="secondary"
              disabled={props.isCopilotRunning || props.isWorkflowBusy}
              onClick={() => {
                props.runAsyncUiAction(
                  props.onRunCopilotCommand,
                  'run copilot command failed'
                );
              }}
            >
              {props.isCopilotRunning ? 'Copilot arbeitet…' : 'Schritt 2: Befehl ausführen'}
            </Button>
          </div>

          {props.copilotResponse ? (
            <p className={styles.status} aria-live="polite" role="status">
              {props.copilotResponse}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
};
