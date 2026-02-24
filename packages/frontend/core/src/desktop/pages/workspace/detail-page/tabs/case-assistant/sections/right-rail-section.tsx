import { Button } from '@affine/component';
import type { CaseAssistantRole, DeadlineAlert } from '@affine/core/modules/case-assistant';
import {
  memo,
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
} from 'react';

import * as styles from '../../case-assistant.css';
import type { DraftReviewStatus, DraftSection, DraftSectionStatus } from '../panel-types';
import { AlertsSection } from './alerts-section';
import { CopilotRailSection } from './copilot-rail-section';

type Props = {
  copilotSectionRef: RefObject<HTMLElement | null>;
  alertsSectionRef: RefObject<HTMLElement | null>;

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
  draftReviewRequestedByRole: CaseAssistantRole | null;
  draftApprovedByRole: CaseAssistantRole | null;
  draftReviewRequestedHash: string | null;
  draftApprovedHash: string | null;
  onRequestDraftReview: () => Promise<void>;
  onApproveDraft: () => Promise<void>;
  onApplyCopilotDraftToDocument: () => Promise<void>;
  onSetDraftSectionStatus: (sectionId: string, status: DraftSectionStatus) => void;
  onResetDraftState: () => void;

  onlyCriticalAlerts: boolean;
  filteredAlerts: DeadlineAlert[];
  setOnlyCriticalAlerts: Dispatch<SetStateAction<boolean>>;
  onAck: (alert: DeadlineAlert) => Promise<void>;

  variant?: 'operations' | 'copilot';
  activeRailTab?: 'copilot' | 'alerts';
  onRailTabChange?: (tab: 'copilot' | 'alerts') => void;
};

export const RightRailSection = memo((props: Props) => {
  const isCopilotOnly = props.variant === 'copilot';
  const activeRailTab = props.activeRailTab ?? 'copilot';
  const showCopilotSection = isCopilotOnly && activeRailTab === 'copilot';
  const showAlertsSection = isCopilotOnly ? activeRailTab === 'alerts' : true;

  const onRailTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, tab: 'copilot' | 'alerts') => {
      if (!props.onRailTabChange) {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        props.onRailTabChange(tab === 'copilot' ? 'alerts' : 'copilot');
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        props.onRailTabChange('copilot');
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        props.onRailTabChange('alerts');
      }
    },
    [props.onRailTabChange]
  );

  return (
    <aside
      className={`${isCopilotOnly ? styles.rightRailCopilot : styles.rightRail} ${styles.railStack}`}
      aria-label="Copilot und Fristen Rail"
    >
      <div className={styles.railStack}>
        {isCopilotOnly ? (
          <section className={styles.section}>
            <div className={styles.tabRow} role="tablist" aria-label="Copilot Bereiche">
              <Button
                role="tab"
                aria-selected={activeRailTab === 'copilot'}
                aria-label="KI-Copilot: Prompt, Entwurf, Freigabe"
                title="KI-Copilot: Prompt, Entwurf, Freigabe"
                tabIndex={activeRailTab === 'copilot' ? 0 : -1}
                variant={activeRailTab === 'copilot' ? 'secondary' : 'plain'}
                onKeyDown={event => onRailTabKeyDown(event, 'copilot')}
                onClick={() => props.onRailTabChange?.('copilot')}
              >
                Copilot
              </Button>
              <Button
                role="tab"
                aria-selected={activeRailTab === 'alerts'}
                aria-label="Fristen-Alerts und Erinnerungen"
                title="Fristen-Alerts und Erinnerungen"
                tabIndex={activeRailTab === 'alerts' ? 0 : -1}
                variant={activeRailTab === 'alerts' ? 'secondary' : 'plain'}
                onKeyDown={event => onRailTabKeyDown(event, 'alerts')}
                onClick={() => props.onRailTabChange?.('alerts')}
              >
                Fristen
              </Button>
            </div>
          </section>
        ) : null}

        {showCopilotSection ? (
          <CopilotRailSection
            sectionRef={props.copilotSectionRef}
            isCopilotPanelOpen={props.isCopilotPanelOpen}
            setIsCopilotPanelOpen={props.setIsCopilotPanelOpen}
            copilotPrompt={props.copilotPrompt}
            setCopilotPrompt={props.setCopilotPrompt}
            isCopilotRunning={props.isCopilotRunning}
            isWorkflowBusy={props.isWorkflowBusy}
            runAsyncUiAction={props.runAsyncUiAction}
            onRunCopilotCommand={props.onRunCopilotCommand}
            copilotResponse={props.copilotResponse}
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
            onRequestDraftReview={props.onRequestDraftReview}
            onApproveDraft={props.onApproveDraft}
            onApplyCopilotDraftToDocument={props.onApplyCopilotDraftToDocument}
            onSetDraftSectionStatus={props.onSetDraftSectionStatus}
            onResetDraftState={props.onResetDraftState}
          />
        ) : null}

        {showAlertsSection ? (
          <AlertsSection
            sectionRef={props.alertsSectionRef}
            onlyCriticalAlerts={props.onlyCriticalAlerts}
            filteredAlerts={props.filteredAlerts}
            setOnlyCriticalAlerts={props.setOnlyCriticalAlerts}
            runAsyncUiAction={props.runAsyncUiAction}
            onAck={props.onAck}
          />
        ) : null}
      </div>
    </aside>
  );
});

RightRailSection.displayName = 'RightRailSection';
