import type { RefObject } from 'react';

import * as styles from '../../case-assistant.css';
import type { DraftReviewStatus, DraftSection } from '../panel-types';
import { CopilotDraftPreviewSection } from './copilot-draft-preview-section';
import { CopilotPromptSection } from './copilot-prompt-section';

type Props = {
  sectionRef: RefObject<HTMLElement | null>;

  isCopilotPanelOpen: boolean;
  setIsCopilotPanelOpen: (updater: (value: boolean) => boolean) => void;
  copilotPrompt: string;
  setCopilotPrompt: (value: string) => void;
  isCopilotRunning: boolean;
  isWorkflowBusy: boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onRunCopilotCommand: () => Promise<void>;
  copilotResponse: string | null;

  copilotDraftPreview: string | null;
  draftReviewStatus: DraftReviewStatus;
  draftSections: DraftSection[];
  acceptedSectionCount: number;
  acceptedWithCitationCount: number;
  acceptedWithoutCitationCount: number;
  isApplyingCopilotDraft: boolean;
  canApproveDraft: boolean;
  violatesFourEyes: boolean;
  auditGateSatisfied: boolean;
  draftReviewNote: string;
  setDraftReviewNote: (value: string) => void;
  draftReviewRequestedByRole: string | null;
  draftApprovedByRole: string | null;
  draftReviewRequestedHash: string | null;
  draftApprovedHash: string | null;
  onRequestDraftReview: () => Promise<void>;
  onApproveDraft: () => Promise<void>;
  onApplyCopilotDraftToDocument: () => Promise<void>;
  onSetDraftSectionStatus: (sectionId: string, status: DraftSection['status']) => void;
  onResetDraftState: () => void;
};

export const CopilotRailSection = (props: Props) => {
  return (
    <section ref={props.sectionRef} className={styles.section}>
      <CopilotPromptSection
        isCopilotPanelOpen={props.isCopilotPanelOpen}
        setIsCopilotPanelOpen={props.setIsCopilotPanelOpen}
        copilotPrompt={props.copilotPrompt}
        setCopilotPrompt={props.setCopilotPrompt}
        isCopilotRunning={props.isCopilotRunning}
        isWorkflowBusy={props.isWorkflowBusy}
        runAsyncUiAction={props.runAsyncUiAction}
        onRunCopilotCommand={props.onRunCopilotCommand}
        copilotResponse={props.copilotResponse}
      />

      {props.copilotDraftPreview ? (
        <details className={styles.toolAccordion}>
          <summary className={styles.toolAccordionSummary}>
            Kategorie B (Erweitert): Entwurfs-Review & Freigabe
          </summary>
          <p className={styles.previewMeta}>
            Öffnen, sobald ein Entwurf erzeugt wurde und Review/Freigabe erforderlich ist.
          </p>
          <CopilotDraftPreviewSection
            copilotDraftPreview={props.copilotDraftPreview}
            draftReviewStatus={props.draftReviewStatus}
            draftSections={props.draftSections}
            acceptedSectionCount={props.acceptedSectionCount}
            acceptedWithCitationCount={props.acceptedWithCitationCount}
            acceptedWithoutCitationCount={props.acceptedWithoutCitationCount}
            isApplyingCopilotDraft={props.isApplyingCopilotDraft}
            canApproveDraft={props.canApproveDraft}
            violatesFourEyes={props.violatesFourEyes}
            auditGateSatisfied={props.auditGateSatisfied}
            draftReviewNote={props.draftReviewNote}
            setDraftReviewNote={props.setDraftReviewNote}
            draftReviewRequestedByRole={props.draftReviewRequestedByRole}
            draftApprovedByRole={props.draftApprovedByRole}
            draftReviewRequestedHash={props.draftReviewRequestedHash}
            draftApprovedHash={props.draftApprovedHash}
            runAsyncUiAction={props.runAsyncUiAction}
            onRequestDraftReview={props.onRequestDraftReview}
            onApproveDraft={props.onApproveDraft}
            onApplyCopilotDraftToDocument={props.onApplyCopilotDraftToDocument}
            onSetDraftSectionStatus={props.onSetDraftSectionStatus}
            onResetDraftState={props.onResetDraftState}
          />
        </details>
      ) : null}

      {!props.isCopilotPanelOpen ? (
        <div className={styles.empty}>
          Copilot ist eingeklappt. Für paralleles Arbeiten ausklappen.
        </div>
      ) : null}
    </section>
  );
};
