import clsx from 'clsx';
import { memo } from 'react';

import type { QuickCheckHandoffPayload } from '../hooks/use-quick-check-handoff';
import * as styles from './quick-check-banner.css';

const tierLabels: Record<
  QuickCheckHandoffPayload['recommendationTier'],
  { de: string; en: string }
> = {
  credit: { de: 'Credit-Paket', en: 'Credit Pack' },
  trial: { de: '14-Tage Reverse Trial', en: '14-Day Reverse Trial' },
  kanzlei: { de: 'Kanzlei-Plan', en: 'Firm Plan' },
};

export const QuickCheckBanner = memo(function QuickCheckBanner({
  payload,
  onDismiss,
  onStartAnalysis,
  locale = 'en',
}: {
  payload: QuickCheckHandoffPayload;
  onDismiss: () => void;
  onStartAnalysis?: () => void;
  locale?: string;
}) {
  const isGerman = locale.toLowerCase().startsWith('de');
  const scoreClass =
    payload.score >= 70
      ? styles.scoreHigh
      : payload.score >= 40
        ? styles.scoreMedium
        : styles.scoreLow;

  const tierLabel = isGerman
    ? tierLabels[payload.recommendationTier].de
    : tierLabels[payload.recommendationTier].en;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={clsx(styles.scoreChip, scoreClass)}>
        {payload.score}%
      </div>
      <div className={styles.content}>
        <span className={styles.title}>
          {isGerman
            ? 'Quick-Check abgeschlossen'
            : 'Quick-Check completed'}
        </span>
        <span className={styles.subtitle}>
          {isGerman
            ? `${payload.supported} Datei(en) analysiert · Empfehlung: ${tierLabel}`
            : `${payload.supported} file(s) analyzed · Recommendation: ${tierLabel}`}
        </span>
      </div>
      <div className={styles.actions}>
        {onStartAnalysis ? (
          <button
            className={clsx(styles.actionButton, styles.primaryAction)}
            onClick={onStartAnalysis}
          >
            {isGerman ? 'Tiefenanalyse starten' : 'Start deep analysis'}
          </button>
        ) : null}
        <button
          className={clsx(styles.actionButton, styles.dismissAction)}
          onClick={onDismiss}
        >
          {isGerman ? 'Schließen' : 'Dismiss'}
        </button>
      </div>
    </div>
  );
});
