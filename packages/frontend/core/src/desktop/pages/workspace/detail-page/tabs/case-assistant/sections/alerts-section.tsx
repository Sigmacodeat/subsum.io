import { Button } from '@affine/component';
import type { DeadlineAlert } from '@affine/core/modules/case-assistant';
import type { Dispatch, Ref, SetStateAction } from 'react';

import * as styles from '../../case-assistant.css';
import { priorityLabel } from '../panel-types';
import { formatDue, formatMinutes } from '../utils';

type Props = {
  sectionRef?: Ref<HTMLElement>;
  onlyCriticalAlerts: boolean;
  filteredAlerts: DeadlineAlert[];
  setOnlyCriticalAlerts: Dispatch<SetStateAction<boolean>>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onAck: (alert: DeadlineAlert) => Promise<void>;
};

export const AlertsSection = ({
  sectionRef,
  onlyCriticalAlerts,
  filteredAlerts,
  setOnlyCriticalAlerts,
  runAsyncUiAction,
  onAck,
}: Props) => {
  return (
    <section ref={sectionRef} className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Fristen-Alerts</h3>
        <Button
          variant="plain"
          aria-pressed={onlyCriticalAlerts}
          onClick={() => setOnlyCriticalAlerts(value => !value)}
        >
          {onlyCriticalAlerts ? 'Alle anzeigen' : 'Nur kritisch'}
        </Button>
      </div>
      {filteredAlerts.length === 0 ? (
        <div className={styles.empty}>Keine aktiven Alerts in dieser Akte.</div>
      ) : (
        <ul className={styles.alertList}>
          {filteredAlerts.map(alert => (
            <li className={styles.alertItem} key={alert.id}>
              <div className={styles.alertTitle}>{alert.title}</div>
              <div className={styles.alertMeta}>
                <span>Fällig: {formatDue(alert.dueAt)}</span>
                <span>{formatMinutes(alert.minutesUntilDue)}</span>
                <span>Priorität: {priorityLabel[alert.priority]}</span>
              </div>
              <div className={styles.buttonRow}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    runAsyncUiAction(() => onAck(alert), 'acknowledge alert failed');
                  }}
                >
                  Bestätigen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
