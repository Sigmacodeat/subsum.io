import { Button } from '@affine/component';
import type {
  Gerichtsinstanz,
  KostenrisikoResult,
  Verfahrensart,
  VergleichswertResult,
} from '@affine/core/modules/case-assistant';

import * as styles from '../../case-assistant.css';

type Props = {
  costStreitwert: string;
  setCostStreitwert: (value: string) => void;
  costInstanz: Gerichtsinstanz;
  setCostInstanz: (value: Gerichtsinstanz) => void;
  costVerfahren: Verfahrensart;
  setCostVerfahren: (value: Verfahrensart) => void;
  costObsiegen: string;
  setCostObsiegen: (value: string) => void;
  costVergleichQuote: string;
  setCostVergleichQuote: (value: string) => void;
  onCalculateCosts: () => Promise<void>;
  onCalculateVergleich: () => Promise<void>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  costResult: KostenrisikoResult | null;
  costVergleichResult: VergleichswertResult | null;
};

export const CostCalculatorSection = (props: Props) => {
  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary} aria-label="Kostenrisiko-Kalkulator nach RVG und GKG">
        Kostenrisiko-Kalkulator (RVG/GKG)
      </summary>
      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          Streitwert (€)
          <input
            className={styles.input}
            type="number"
            min={0}
            value={props.costStreitwert}
            onChange={event => props.setCostStreitwert(event.target.value)}
          />
        </label>
        <label className={styles.formLabel}>
          Instanz
          <select
            className={styles.input}
            value={props.costInstanz}
            onChange={event =>
              props.setCostInstanz(event.target.value as Gerichtsinstanz)
            }
          >
            <option value="amtsgericht">Amtsgericht</option>
            <option value="landgericht">Landgericht</option>
            <option value="oberlandesgericht">OLG</option>
            <option value="bundesgerichtshof">BGH</option>
            <option value="arbeitsgericht">Arbeitsgericht</option>
            <option value="verwaltungsgericht">Verwaltungsgericht</option>
            <option value="sozialgericht">Sozialgericht</option>
            <option value="finanzgericht">Finanzgericht</option>
          </select>
        </label>
        <label className={styles.formLabel}>
          Verfahrensart
          <select
            className={styles.input}
            value={props.costVerfahren}
            onChange={event =>
              props.setCostVerfahren(event.target.value as Verfahrensart)
            }
          >
            <option value="klageverfahren">Klageverfahren</option>
            <option value="mahnverfahren">Mahnverfahren</option>
            <option value="eilverfahren">Eilverfahren</option>
            <option value="berufung">Berufung</option>
            <option value="revision">Revision</option>
            <option value="beschwerde">Beschwerde</option>
          </select>
        </label>
        <label className={styles.formLabel}>
          Obsiegensquote (%)
          <input
            className={styles.input}
            type="number"
            min={0}
            max={100}
            value={props.costObsiegen}
            onChange={event => props.setCostObsiegen(event.target.value)}
          />
        </label>
        <label className={styles.formLabel}>
          Vergleichsquote (%)
          <input
            className={styles.input}
            type="number"
            min={0}
            max={100}
            value={props.costVergleichQuote}
            onChange={event => props.setCostVergleichQuote(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          aria-label="Prozesskosten und Risiko berechnen"
          onClick={() => {
            props.runAsyncUiAction(props.onCalculateCosts, 'cost calculation failed');
          }}
        >
          Kosten berechnen
        </Button>
        <Button
          variant="plain"
          aria-label="Vergleichswert und Ersparnis durch außergerichtliche Einigung berechnen"
          onClick={() => {
            props.runAsyncUiAction(
              props.onCalculateVergleich,
              'vergleich calculation failed'
            );
          }}
        >
          Vergleichswert
        </Button>
      </div>
      {props.costResult ? (
        <div className={styles.previewCard}>
          <div className={styles.jobTitle}>
            Kostenrisiko: {props.costResult.gesamtrisiko.toLocaleString('de-DE')} € (
            {props.costResult.risikoklasse})
          </div>
          <div className={styles.metrics}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Bei Verlust</div>
              <div className={styles.metricValue}>
                {props.costResult.gesamtkostenBeiVerlust.toLocaleString('de-DE')} €
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Bei Obsiegen</div>
              <div className={styles.metricValue}>
                {props.costResult.gesamtkostenBeiObsiegen.toLocaleString('de-DE')} €
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                Teilobsiegen ({props.costResult.obsiegensquote}%)
              </div>
              <div className={styles.metricValue}>
                {props.costResult.gesamtkostenBeiTeilobsiegen.toLocaleString('de-DE')} €
              </div>
            </div>
          </div>
          <div className={styles.jobMeta}>{props.costResult.empfehlung}</div>
          <div className={styles.jobMeta}>{props.costResult.pkhHinweis}</div>
          {props.costResult.warnungen.map((w, i) => (
            <div className={styles.warningBanner} key={`cost-warn-${i}`} role="alert">
              {w}
            </div>
          ))}
        </div>
      ) : null}
      {props.costVergleichResult ? (
        <div className={styles.previewCard}>
          <div className={styles.jobTitle}>
            Vergleichswert: {props.costVergleichResult.vergleichswert.toLocaleString('de-DE')} €
          </div>
          <div className={styles.jobMeta}>
            Ersparnis:{' '}
            {props.costVergleichResult.ersparnisDurchVergleich.toLocaleString('de-DE')} €
          </div>
          <div className={styles.jobMeta}>{props.costVergleichResult.empfehlung}</div>
        </div>
      ) : null}
    </details>
  );
};
