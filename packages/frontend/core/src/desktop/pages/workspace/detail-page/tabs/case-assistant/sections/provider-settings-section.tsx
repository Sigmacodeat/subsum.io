import { Button } from '@affine/component';

import * as styles from '../../case-assistant.css';

type Props = {
  legalAnalysisEndpoint: string;
  setLegalAnalysisEndpoint: (value: string) => void;
  legalAnalysisToken: string;
  setLegalAnalysisToken: (value: string) => void;
  judikaturEndpoint: string;
  setJudikaturEndpoint: (value: string) => void;
  judikaturToken: string;
  setJudikaturToken: (value: string) => void;
  onSaveLegalProviderSettings: () => Promise<void>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
};

export const ProviderSettingsSection = (props: Props) => {
  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary}>LLM & Judikatur Provider</summary>
      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          Legal Analysis Endpoint
          <input
            className={styles.input}
            value={props.legalAnalysisEndpoint}
            onChange={event => props.setLegalAnalysisEndpoint(event.target.value)}
            placeholder="https://.../legal-analysis"
          />
        </label>
        <label className={styles.formLabel}>
          Legal Analysis Token
          <input
            className={styles.input}
            type="password"
            value={props.legalAnalysisToken}
            onChange={event => props.setLegalAnalysisToken(event.target.value)}
            placeholder="Bearer Token (optional)"
          />
        </label>
        <label className={styles.formLabel}>
          Judikatur Endpoint
          <input
            className={styles.input}
            value={props.judikaturEndpoint}
            onChange={event => props.setJudikaturEndpoint(event.target.value)}
            placeholder="https://.../judikatur-search"
          />
        </label>
        <label className={styles.formLabel}>
          Judikatur Token
          <input
            className={styles.input}
            type="password"
            value={props.judikaturToken}
            onChange={event => props.setJudikaturToken(event.target.value)}
            placeholder="Bearer Token (optional)"
          />
        </label>
      </div>
      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          onClick={() => {
            props.runAsyncUiAction(
              props.onSaveLegalProviderSettings,
              'save legal provider settings failed'
            );
          }}
        >
          Provider speichern
        </Button>
      </div>
    </details>
  );
};
