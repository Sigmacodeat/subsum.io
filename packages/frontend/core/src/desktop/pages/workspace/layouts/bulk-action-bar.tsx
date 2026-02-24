import { useCallback } from 'react';

import * as styles from './bulk-action-bar.css';

export type BulkActionBarProps = {
  containerName: 'akten-body' | 'mandanten-body' | 'fristen-body' | 'akte-detail-body';
  selectedCount: number;
  selectionLabel: string;
  isRunning?: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  canDelete?: boolean;
  deleteLabel?: string;
  onDelete?: () => void;
  onClear: () => void;
};

export function BulkActionBar(props: BulkActionBarProps) {
  const {
    selectedCount,
    selectionLabel,
    isRunning,
    primaryLabel,
    onPrimary,
    canDelete,
    deleteLabel,
    onDelete,
    onClear,
  } = props;

  const handleClear = useCallback(() => {
    if (isRunning) return;
    onClear();
  }, [isRunning, onClear]);

  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className={styles.bar} data-container={props.containerName} aria-live="polite">
      <div className={styles.card} role="region" aria-label="Bulk-Aktionen">
        <div className={styles.left}>
          <span className={styles.countBadge} aria-label={`${selectedCount} ausgewählt`}>
            {selectedCount}
          </span>
          <div className={styles.summary} title={selectionLabel}>
            {selectionLabel}
          </div>
        </div>

        <div className={styles.right}>
          {onPrimary ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={onPrimary}
              disabled={isRunning}
              aria-disabled={isRunning}
            >
              {primaryLabel ?? 'Aktion'}
            </button>
          ) : null}

          {onDelete ? (
            <button
              type="button"
              className={styles.dangerButton}
              onClick={onDelete}
              disabled={isRunning || canDelete === false}
              aria-disabled={isRunning || canDelete === false}
            >
              {deleteLabel ?? 'Löschen'}
            </button>
          ) : null}

          <button
            type="button"
            className={styles.actionButton}
            onClick={handleClear}
            disabled={isRunning}
            aria-disabled={isRunning}
          >
            Auswahl aufheben
          </button>
        </div>
      </div>
    </div>
  );
}
