import { Button } from '@affine/component';
import type { CasePriority } from '@affine/core/modules/case-assistant';

import * as styles from '../../case-assistant.css';
import type { DraftReviewStatus, DraftSection } from '../panel-types';
import { priorityLabel } from '../panel-types';

type SectionCitation = {
  findingId: string;
  findingTitle: string;
  documentTitle: string;
  quote: string;
  severity: CasePriority;
  confidence: number;
};

type Props = {
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

  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;

  onRequestDraftReview: () => Promise<void>;
  onApproveDraft: () => Promise<void>;
  onApplyCopilotDraftToDocument: () => Promise<void>;

  onSetDraftSectionStatus: (sectionId: string, status: DraftSection['status']) => void;

  onResetDraftState: () => void;
};

export const CopilotDraftPreviewSection = (props: Props) => {
  if (!props.copilotDraftPreview) {
    return null;
  }

  const canRequestReview =
    !props.isApplyingCopilotDraft && props.draftReviewStatus === 'draft';
  const canApprove =
    !props.isApplyingCopilotDraft &&
    props.canApproveDraft &&
    !props.violatesFourEyes &&
    props.draftReviewStatus === 'in_review';
  const canApply =
    !props.isApplyingCopilotDraft &&
    props.acceptedSectionCount > 0 &&
    props.acceptedWithoutCitationCount === 0 &&
    props.auditGateSatisfied &&
    props.draftReviewStatus === 'approved';

  const nextStepHint = canApply
    ? 'Nächster Schritt: Freigegebenen Entwurf einfügen.'
    : canApprove
      ? 'Nächster Schritt: Entwurf freigeben (4-Augen-Prinzip beachten).'
      : canRequestReview
        ? 'Nächster Schritt: Entwurf zur Freigabe senden.'
        : 'Nächster Schritt: Abschnittsstatus/Citations prüfen.';

  return (
    <div className={styles.previewCard}>
      <div className={styles.previewHeader}>
        <span className={styles.sectionTitle}>Schritt 3: Entwurf prüfen & freigeben</span>
        <span className={styles.reviewBadge}>Review: {props.draftReviewStatus}</span>
        <span className={styles.previewMeta}>
          {props.acceptedSectionCount}/{props.draftSections.length} akzeptiert
        </span>
        <span className={styles.previewMeta}>
          {props.acceptedWithCitationCount} mit Citation
        </span>
        <div className={styles.modeSwitcher}>
          <Button
            variant="plain"
            disabled={props.isApplyingCopilotDraft}
            onClick={() => {
              props.onResetDraftState();
            }}
          >
            Verwerfen
          </Button>
          <Button
            variant="plain"
            disabled={!canRequestReview}
            onClick={() => {
              props.runAsyncUiAction(
                props.onRequestDraftReview,
                'request draft review failed'
              );
            }}
          >
            3.1 Zur Freigabe
          </Button>
          <Button
            variant="plain"
            disabled={!canApprove}
            onClick={() => {
              props.runAsyncUiAction(props.onApproveDraft, 'approve draft failed');
            }}
          >
            3.2 Freigeben
          </Button>
          <Button
            variant="secondary"
            disabled={!canApply}
            onClick={() => {
              props.runAsyncUiAction(
                props.onApplyCopilotDraftToDocument,
                'apply copilot draft action failed'
              );
            }}
          >
            {props.isApplyingCopilotDraft
              ? 'Füge ein…'
              : '3.3 In Dokument einfügen'}
          </Button>
        </div>
      </div>

      <p className={styles.previewMeta}>{nextStepHint}</p>

      <label className={styles.formLabel}>
        Review-Notiz (für Freigabe/Audit)
        <textarea
          className={styles.input}
          rows={3}
          value={props.draftReviewNote}
          onChange={event => props.setDraftReviewNote(event.target.value)}
          placeholder="z. B. Quellen geprüft, Anträge vollständig, Fristen abgeglichen."
        />
      </label>

      <div className={styles.previewMeta}>
        Audit Gate: {props.auditGateSatisfied ? 'VERIFIED' : 'VERIFY REQUIRED'}
      </div>

      {!props.auditGateSatisfied ? (
        <div className={styles.warningBanner}>
          Für das Einfügen ist ein aktuelles "Audit Verify" der freigegebenen
          Draft-Hash-Version erforderlich.
        </div>
      ) : null}

      <details className={styles.toolAccordion}>
        <summary className={styles.toolAccordionSummary}>Audit-Details (optional)</summary>
        <div className={styles.previewMeta}>
          Requester: {props.draftReviewRequestedByRole ?? '—'} • Approver:{' '}
          {props.draftApprovedByRole ?? '—'}
        </div>
        <div className={styles.previewMeta}>
          Requested Hash: {props.draftReviewRequestedHash ?? '—'}
        </div>
        <div className={styles.previewMeta}>
          Approved Hash: {props.draftApprovedHash ?? '—'}
        </div>
      </details>

      {props.violatesFourEyes ? (
        <div className={styles.warningBanner}>
          4-Augen-Block: Dieselbe Rolle darf den eigenen Review-Request nicht
          freigeben.
        </div>
      ) : null}

      {props.draftSections.length === 0 ? (
        <pre className={styles.previewContent}>{props.copilotDraftPreview}</pre>
      ) : (
        <ul className={styles.sectionReviewList}>
          {props.acceptedWithoutCitationCount > 0 ? (
            <li className={styles.warningBanner}>
              {props.acceptedWithoutCitationCount} akzeptierte Abschnitt(e) haben noch
              keine Citation.
            </li>
          ) : null}
          {props.draftSections.map(section => (
            <li className={styles.sectionReviewItem} key={section.id}>
              <div className={styles.sectionReviewHeader}>
                <span className={styles.jobTitle}>{section.title}</span>
                <span className={styles.jobMeta}>Status: {section.status}</span>
              </div>
              <pre className={styles.previewContent}>{section.content}</pre>
              {section.citations.length > 0 ? (
                <ul className={styles.citationList}>
                  {section.citations.map((citation: SectionCitation) => (
                    <li
                      className={styles.citationItem}
                      key={`${section.id}:${citation.findingId}:${citation.documentTitle}`}
                    >
                      <div className={styles.citationMeta}>
                        {citation.findingTitle} • {citation.documentTitle} • Severity{' '}
                        {priorityLabel[citation.severity]} • Confidence{' '}
                        {Math.round(citation.confidence * 100)}%
                      </div>
                      <div className={styles.citationQuote}>"{citation.quote}"</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.empty}>
                  Für diesen Abschnitt wurde noch keine Citation zugeordnet.
                </div>
              )}
              <div className={styles.quickActionRow}>
                <Button
                  variant="plain"
                  disabled={props.isApplyingCopilotDraft}
                  onClick={() => props.onSetDraftSectionStatus(section.id, 'pending')}
                >
                  Zurücksetzen
                </Button>
                <Button
                  variant="plain"
                  disabled={props.isApplyingCopilotDraft}
                  onClick={() => props.onSetDraftSectionStatus(section.id, 'rejected')}
                >
                  Ablehnen
                </Button>
                <Button
                  variant="secondary"
                  disabled={props.isApplyingCopilotDraft}
                  onClick={() => props.onSetDraftSectionStatus(section.id, 'accepted')}
                >
                  Akzeptieren
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
