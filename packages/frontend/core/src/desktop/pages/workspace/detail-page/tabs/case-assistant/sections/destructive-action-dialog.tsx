import { Button } from '@affine/component';
import type { RefObject } from 'react';

import * as styles from '../../case-assistant.css';
import type { PendingDestructiveAction } from '../panel-types';

type Props = {
  pendingDestructiveAction: PendingDestructiveAction | null;
  destructiveDialogCardRef: RefObject<HTMLDivElement | null>;
  onCancelDestructiveAction: () => void;
  onConfirmDestructiveAction: () => Promise<void>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
};

export const DestructiveActionDialog = ({
  pendingDestructiveAction,
  destructiveDialogCardRef,
  onCancelDestructiveAction,
  onConfirmDestructiveAction,
  runAsyncUiAction,
}: Props) => {
  if (!pendingDestructiveAction) {
    return null;
  }

  return (
    <div
      className={styles.destructiveDialogOverlay}
      role="presentation"
      onMouseDown={onCancelDestructiveAction}
    >
      <div
        ref={destructiveDialogCardRef}
        className={styles.destructiveDialogCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-assistant-destructive-title"
        onMouseDown={event => {
          event.stopPropagation();
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancelDestructiveAction();
          }
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            runAsyncUiAction(onConfirmDestructiveAction, 'destructive action confirm failed');
          }
        }}
        tabIndex={-1}
      >
        <div id="case-assistant-destructive-title" className={styles.destructiveDialogTitle}>
          {pendingDestructiveAction.kind.includes('delete')
            ? 'Löschen bestätigen'
            : 'Archivieren bestätigen'}
        </div>
        <div className={styles.destructiveDialogBody}>
          {pendingDestructiveAction.kind.includes('delete')
            ? `Soll '${pendingDestructiveAction.label}' wirklich gelöscht werden?`
            : `Soll '${pendingDestructiveAction.label}' wirklich archiviert werden?`}
          <br />
          Diese Aktion wird auditierbar protokolliert.
        </div>
        <div className={styles.destructiveDialogActions}>
          <Button variant="plain" onClick={onCancelDestructiveAction} data-destructive-cancel>
            Abbrechen
          </Button>
          <Button
            variant="secondary"
            data-destructive-confirm
            onClick={() => {
              runAsyncUiAction(onConfirmDestructiveAction, 'destructive action confirm failed');
            }}
          >
            Bestätigen
          </Button>
        </div>
      </div>
    </div>
  );
};
