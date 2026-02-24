import { Button } from '@affine/component';
import type { Beweismittel, BeweisLuecke } from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './evidence-section.css';

const ART_LABEL: Record<string, string> = {
  urkunde: 'Urkunde',
  zeuge: 'Zeuge',
  sachverstaendiger: 'Sachverständiger',
  augenschein: 'Augenschein',
  parteivernehmung: 'Parteivernehmung',
  elektronisch: 'Elektronisch',
  gutachten: 'Gutachten',
  sonstiges: 'Sonstiges',
};

const STAERKE_COLOR: Record<string, string> = {
  stark: cssVarV2('status/success'),
  mittel: cssVarV2('text/primary'),
  schwach: cssVarV2('status/error'),
  unklar: cssVarV2('text/secondary'),
};

const STAERKE_PCT: Record<string, number> = {
  stark: 90,
  mittel: 55,
  schwach: 25,
  unklar: 10,
};

type Props = {
  caseDocumentsCount: number;
  isWorkflowBusy: boolean;
  onAutoDetectEvidence: () => Promise<void>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  evidenceCount: number;
  evidenceSummaryMarkdown: string | null;
  evidenceItems?: Beweismittel[];
  evidenceGaps?: BeweisLuecke[];
};

export const EvidenceSection = memo((props: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'beweise' | 'luecken'>('beweise');

  const items = props.evidenceItems ?? [];
  const gaps = props.evidenceGaps ?? [];

  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary}>
        Beweismittel-Register & Lückenanalyse
        {props.evidenceCount > 0 ? ` (${props.evidenceCount})` : ''}
        {gaps.length > 0 ? ` · ${gaps.length} Lücken` : ''}
      </summary>

      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          disabled={props.caseDocumentsCount === 0 || props.isWorkflowBusy}
          aria-label={props.isWorkflowBusy ? 'Beweismittel werden analysiert' : `Beweismittel automatisch erkennen aus ${props.caseDocumentsCount} Dokumenten`}
          onClick={() => props.runAsyncUiAction(props.onAutoDetectEvidence, 'evidence detect failed')}
        >
          {props.isWorkflowBusy ? 'Analysiere…' : `Beweismittel erkennen (${props.caseDocumentsCount} Dok.)`}
        </Button>
      </div>

      {items.length === 0 && gaps.length === 0 ? (
        <div className={`${styles.empty} ${localStyles.emptyCompact}`} role="status">
          Noch keine Beweismittel erkannt. Starte die Analyse.
        </div>
      ) : (
        <>
          {/* Tab Bar */}
          <div className={localStyles.tabRow} role="tablist" aria-label="Beweismittel-Ansicht">
            {(['beweise', 'luecken'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                role="tab"
                onClick={() => setActiveTab(tab)}
                aria-selected={activeTab === tab}
                tabIndex={activeTab === tab ? 0 : -1}
                className={`${localStyles.tabButton} ${activeTab === tab ? localStyles.tabButtonActive : ''}`}
                style={assignInlineVars({
                  [localStyles.accentColorVar]: activeTab === tab ? cssVarV2('button/primary') : cssVarV2('text/secondary'),
                })}
              >
                {tab === 'beweise' ? `Beweismittel (${items.length})` : `Lücken (${gaps.length})`}
              </button>
            ))}
          </div>

          {activeTab === 'beweise' ? (
            <ul className={localStyles.list}>
              {items.map(item => {
                const isExp = expandedId === item.id;
                const color = STAERKE_COLOR[item.staerke] ?? cssVarV2('text/secondary');
                return (
                  <li key={item.id} className={localStyles.item}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExp ? null : item.id)}
                      aria-expanded={isExp}
                      className={localStyles.itemButton}
                    >
                      <span className={localStyles.artIcon}>{ART_LABEL[item.art] ?? 'Sonstiges'}</span>
                      <span className={localStyles.itemTitle}>{item.bezeichnung}</span>
                      <div className={localStyles.strengthRow}>
                        <div className={localStyles.strengthTrack}>
                          <div
                            className={localStyles.strengthFill}
                            style={assignInlineVars({
                              [localStyles.widthVar]: `${STAERKE_PCT[item.staerke] ?? 10}%`,
                              [localStyles.accentColorVar]: color,
                            })}
                          />
                        </div>
                        <span
                          className={localStyles.strengthLabel}
                          style={assignInlineVars({ [localStyles.accentColorVar]: color })}
                        >{item.staerke}</span>
                        <span className={localStyles.caret}>{isExp ? 'Schließen' : 'Öffnen'}</span>
                      </div>
                    </button>
                    {isExp ? (
                      <div className={localStyles.expandedPanel}>
                        {item.beschreibung ? <div className={localStyles.detailText}>{item.beschreibung}</div> : null}
                        <div className={localStyles.detailMuted}>
                          Themen: {item.themen.join(', ')} · Beweislast: {item.beweislast}
                        </div>
                        {item.quelleDocumentId ? (
                          <div className={localStyles.detailMuted}>Quelle: {item.quelleDocumentTitle ?? item.quelleDocumentId}</div>
                        ) : null}
                        {item.anlagenNummer ? (
                          <div className={localStyles.detailAccent}>Anlage: {item.anlagenNummer}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className={localStyles.list}>
              {gaps.length === 0 ? (
                <li className={localStyles.noGaps}>✓ Keine Beweislücken erkannt.</li>
              ) : gaps.map((gap, i) => (
                <li key={`gap-${i}`} className={localStyles.gapItem}>
                  <div className={localStyles.gapTitle}>{gap.thema}</div>
                  <div className={localStyles.gapDesc}>{gap.beschreibung}</div>
                  {gap.empfohleneBeweismittelArt?.length ? (
                    <div className={localStyles.gapHint}>Empfohlen: {gap.empfohleneBeweismittelArt.join(', ')}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </details>
  );
});

EvidenceSection.displayName = 'EvidenceSection';
