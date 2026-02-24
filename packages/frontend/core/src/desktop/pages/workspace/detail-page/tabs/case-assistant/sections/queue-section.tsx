import { Button, notify } from '@affine/component';
import { useConfirmModal } from '@affine/component';
import type {
  CaseAssistantAction,
  IngestionJob,
} from '@affine/core/modules/case-assistant';
import { memo, type RefObject, useCallback, useMemo } from 'react';

import * as styles from '../../case-assistant.css';
import { jobStatusLabel } from '../panel-types';

type Props = {
  sectionRef: RefObject<HTMLElement | null>;
  caseJobs: IngestionJob[];
  canAction: (action: CaseAssistantAction) => boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onCancelJob: (jobId: string) => Promise<void>;
  onRetryJob: (jobId: string) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<IngestionJob | null>;
  onClearJobHistory: () => Promise<IngestionJob[]>;
  onRestoreJob: (job: IngestionJob) => Promise<IngestionJob | null>;
  onRestoreJobHistory: (jobs: IngestionJob[]) => Promise<number>;
};

export const QueueSection = memo((props: Props) => {
  const { openConfirmModal } = useConfirmModal();

  const hasRunningJobs = useMemo(
    () => props.caseJobs.some(j => j.status === 'queued' || j.status === 'running'),
    [props.caseJobs]
  );

  const parseSourceInfo = (sourceRef: string) => {
    const [kind, rawCount] = sourceRef.split(':');
    const fileCount = Number.parseInt(rawCount ?? '', 10);
    return {
      kind: kind || 'upload',
      fileCount: Number.isFinite(fileCount) ? fileCount : null,
    };
  };

  const confirmClearHistory = useCallback(() => {
    openConfirmModal({
      title: 'Upload-Verlauf wirklich löschen?',
      description:
        'Alle abgeschlossenen Uploadversuche dieser Akte werden entfernt. Laufende Jobs müssen vorher abgebrochen werden.',
      cancelText: 'Abbrechen',
      confirmText: 'Verlauf löschen',
      confirmButtonOptions: {
        variant: 'error',
      },
      onConfirm: () => {
        props.runAsyncUiAction(async () => {
          const deletedJobs = await props.onClearJobHistory();
          if (deletedJobs.length === 0) {
            return;
          }
          notify.success({
            title: `Verlauf gelöscht (${deletedJobs.length})`,
            message: 'Uploadversuche wurden entfernt.',
            actions: [
              {
                key: 'undo-clear-upload-history',
                label: 'Rückgängig',
                onClick: async () => {
                  await props.onRestoreJobHistory(deletedJobs);
                },
              },
            ],
          });
        }, 'clear job history failed');
      },
    });
  }, [openConfirmModal, props]);

  const confirmDeleteJob = useCallback(
    (job: IngestionJob) => {
      openConfirmModal({
        title: 'Uploadversuch löschen?',
        description:
          'Dieser Uploadversuch wird aus dem Verlauf entfernt. Das betrifft nur den Versuch (Job), nicht die bereits übernommenen Dokumente.',
        cancelText: 'Abbrechen',
        confirmText: 'Löschen',
        confirmButtonOptions: {
          variant: 'error',
        },
        onConfirm: () => {
          props.runAsyncUiAction(async () => {
            const deleted = await props.onDeleteJob(job.id);
            if (!deleted) {
              return;
            }
            notify.success({
              title: 'Uploadversuch gelöscht',
              message: `Job ${job.id.slice(0, 8)}… wurde entfernt.`,
              actions: [
                {
                  key: `undo-delete-job-${job.id}`,
                  label: 'Rückgängig',
                  onClick: async () => {
                    await props.onRestoreJob(deleted);
                  },
                },
              ],
            });
          }, 'delete job failed');
        },
      });
    },
    [openConfirmModal, props]
  );

  return (
    <section ref={props.sectionRef} className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Verarbeitungs-Warteschlange</h3>
        <Button
          variant="plain"
          disabled={!props.canAction('job.retry') || hasRunningJobs}
          onClick={() => {
            confirmClearHistory();
          }}
        >
          Verlauf löschen
        </Button>
      </div>
      {props.caseJobs.length === 0 ? (
        <div className={styles.empty}>Keine aktiven Verarbeitungsaufträge.</div>
      ) : (
        <ul className={styles.jobList}>
          {props.caseJobs.map(job => (
            <li className={styles.jobItem} key={job.id}>
              <div className={styles.headerRow}>
                <div className={styles.jobTitle}>{job.sourceType === 'folder' ? 'Ordner-Upload' : 'Upload'}</div>
                <div className={styles.jobMetaStrong}>{jobStatusLabel[job.status]}</div>
              </div>
              <div className={styles.jobProgressTrack} aria-label={`Job-Fortschritt ${job.progress}%`}>
                <div className={styles.jobProgressFill} style={{ width: `${job.progress}%` }} />
              </div>
              <div className={styles.jobMeta}>
                {(() => {
                  const parsed = parseSourceInfo(job.sourceRef);
                  return `${parsed.kind === 'folder' ? 'Ordner' : 'Quelle'}${parsed.fileCount !== null ? ` · ${parsed.fileCount} Datei(en)` : ''}`;
                })()}
                {' · '}
                Fortschritt: {job.progress}%
              </div>
              {job.errorMessage ? (
                <div className={styles.jobMeta}>Fehler: {job.errorMessage}</div>
              ) : null}
              <div className={styles.buttonRow}>
                {(job.status === 'queued' || job.status === 'running') && (
                  <Button
                    variant="plain"
                    disabled={!props.canAction('job.cancel')}
                    onClick={() => {
                      props.runAsyncUiAction(
                        () => props.onCancelJob(job.id),
                        'cancel job failed'
                      );
                    }}
                  >
                    Abbrechen
                  </Button>
                )}
                {(job.status === 'failed' || job.status === 'cancelled') && (
                  <Button
                    variant="secondary"
                    disabled={!props.canAction('job.retry')}
                    onClick={() => {
                      props.runAsyncUiAction(() => props.onRetryJob(job.id), 'retry job failed');
                    }}
                  >
                    Wiederholen
                  </Button>
                )}
                {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                  <Button
                    variant="plain"
                    disabled={!props.canAction('job.retry')}
                    onClick={() => {
                      confirmDeleteJob(job);
                    }}
                  >
                    Löschen
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

QueueSection.displayName = 'QueueSection';
