import { Button } from '@affine/component';
import type { CaseBlueprint } from '@affine/core/modules/case-assistant';

import * as styles from '../../case-assistant.css';
import type { DraftReviewStatus } from '../panel-types';

type Props = {
  latestBlueprint: CaseBlueprint | null;
  blueprintObjectiveDraft: string;
  setBlueprintObjectiveDraft: (value: string) => void;
  blueprintReviewStatus: DraftReviewStatus;
  setBlueprintReviewStatus: (value: DraftReviewStatus) => void;
  blueprintReviewNoteDraft: string;
  setBlueprintReviewNoteDraft: (value: string) => void;
  canManageBlueprint: boolean;
  isWorkflowBusy: boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onSaveBlueprintReview: () => Promise<void>;
};

export const BlueprintReviewSection = (props: Props) => {
  return (
    <div className={styles.blueprintEditor}>
      <div className={styles.headerRow}>
        <h4 className={styles.sectionTitle}>Blueprint Review</h4>
      </div>
      {!props.latestBlueprint ? (
        <div className={styles.empty}>Noch kein Blueprint vorhanden.</div>
      ) : (
        <>
          <div className={styles.jobMeta}>
            Status: {props.latestBlueprint.reviewStatus ?? 'draft'}
          </div>
          <label className={styles.formLabel}>
            Objective
            <textarea
              className={styles.input}
              rows={3}
              value={props.blueprintObjectiveDraft}
              onChange={event => props.setBlueprintObjectiveDraft(event.target.value)}
            />
          </label>
          <label className={styles.formLabel}>
            Review Status
            <select
              className={styles.input}
              value={props.blueprintReviewStatus}
              onChange={event =>
                props.setBlueprintReviewStatus(event.target.value as DraftReviewStatus)
              }
            >
              <option value="draft">draft</option>
              <option value="in_review">in_review</option>
              <option value="approved">approved</option>
            </select>
          </label>
          <label className={styles.formLabel}>
            Review Note
            <textarea
              className={styles.input}
              rows={3}
              value={props.blueprintReviewNoteDraft}
              onChange={event => props.setBlueprintReviewNoteDraft(event.target.value)}
              placeholder="Freigabehinweise / offene Punkte"
            />
          </label>
          <div className={styles.quickActionRow}>
            <Button
              variant="secondary"
              disabled={!props.canManageBlueprint || props.isWorkflowBusy}
              onClick={() => {
                props.runAsyncUiAction(
                  props.onSaveBlueprintReview,
                  'save blueprint review failed'
                );
              }}
            >
              Blueprint Review speichern
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
