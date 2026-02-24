import { Button } from '@affine/component';
import type { ContradictionMatrix } from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './contradiction-section.css';

const SEV_STYLE: Record<string, { bg: string; border: string; accent: string; label: string }> = {
  critical: { bg: cssVarV2('layer/background/secondary'), border: cssVarV2('status/error'), accent: cssVarV2('status/error'), label: 'Kritisch' },
  high: { bg: cssVarV2('layer/background/secondary'), border: cssVarV2('text/primary'), accent: cssVarV2('text/primary'), label: 'Hoch' },
  medium: { bg: cssVarV2('layer/background/secondary'), border: cssVarV2('text/secondary'), accent: cssVarV2('text/secondary'), label: 'Mittel' },
  low: { bg: cssVarV2('layer/background/secondary'), border: cssVarV2('layer/insideBorder/border'), accent: cssVarV2('text/secondary'), label: 'Niedrig' },
};

const CAT_LABEL: Record<string, string> = {
  date_mismatch:   'Datum',
  amount_mismatch: 'Betrag',
  person_mismatch: 'Person',
  fact_mismatch:   'Sachverhalt',
  status_mismatch: 'Status',
  norm_mismatch:   'Norm',
};

type Props = {
  caseDocumentsCount: number;
  isWorkflowBusy: boolean;
  onRunContradictionAnalysis: () => Promise<void>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  contradictionMatrix: ContradictionMatrix | null;
};

export const ContradictionSection = memo((props: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const matrix = props.contradictionMatrix;
  const allContradictions = matrix?.contradictions ?? [];
  const filtered = severityFilter === 'all'
    ? allContradictions
    : allContradictions.filter(c => c.severity === severityFilter);

  const criticalCount = allContradictions.filter(c => c.severity === 'critical').length;
  const highCount = allContradictions.filter(c => c.severity === 'high').length;

  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary}>
        Widerspruchsanalyse (Cross-Document)
        {allContradictions.length > 0 ? ` · ${allContradictions.length} Widersprüche` : ''}
        {criticalCount > 0 ? ` · ${criticalCount} kritisch` : ''}
      </summary>

      <div className={styles.quickActionRow}>
        <Button
          variant="secondary"
          disabled={props.caseDocumentsCount < 2 || props.isWorkflowBusy}
          aria-label={props.isWorkflowBusy ? 'Widerspruchsanalyse läuft' : `Cross-Document-Widerspruchsanalyse über ${props.caseDocumentsCount} Dokumente starten`}
          onClick={() => props.runAsyncUiAction(props.onRunContradictionAnalysis, 'contradiction analysis failed')}
        >
          {props.isWorkflowBusy ? 'Analysiere…' : `Widersprüche erkennen (${props.caseDocumentsCount} Dok.)`}
        </Button>
      </div>

      {matrix ? (
        <>
          {/* KPI-Zeile */}
          <div className={localStyles.kpiRow}>
            {[
              { label: 'Dokumente', val: matrix.totalDocuments },
              { label: 'Vergleiche', val: matrix.totalComparisons },
              { label: 'Widersprüche', val: allContradictions.length },
              { label: 'Kritisch', val: criticalCount, warn: criticalCount > 0 },
              { label: 'Hoch', val: highCount, warn: highCount > 0 },
            ].map(kpi => (
              <div
                key={kpi.label}
                className={localStyles.kpiChip}
                style={assignInlineVars({
                  [localStyles.surfaceVar]: cssVarV2('layer/background/secondary'),
                  [localStyles.accentColorVar]: kpi.warn ? cssVarV2('status/error') : cssVarV2('text/secondary'),
                  [localStyles.borderVar]: kpi.warn ? cssVarV2('status/error') : cssVarV2('layer/insideBorder/border'),
                })}
              >
                {kpi.label}: {kpi.val}
              </div>
            ))}
          </div>

          {/* Filter */}
          {allContradictions.length > 0 ? (
            <div className={localStyles.filterRow}>
              {['all', 'critical', 'high', 'medium'].map(sev => (
                <button key={sev} type="button" onClick={() => setSeverityFilter(sev)}
                  aria-pressed={severityFilter === sev}
                  className={`${localStyles.filterButton} ${severityFilter === sev ? localStyles.filterButtonActive : ''}`}
                  style={assignInlineVars({
                    [localStyles.accentColorVar]: severityFilter === sev ? cssVarV2('button/primary') : cssVarV2('text/secondary'),
                    [localStyles.borderVar]: severityFilter === sev ? cssVarV2('button/primary') : cssVarV2('layer/insideBorder/border'),
                  })}
                >
                  {sev === 'all' ? 'Alle' : SEV_STYLE[sev]?.label ?? sev}
                </button>
              ))}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className={`${styles.empty} ${localStyles.emptyCompact}`}>
              {allContradictions.length === 0 ? '✓ Keine Widersprüche erkannt.' : 'Keine Treffer für diesen Filter.'}
            </div>
          ) : (
            <ul className={localStyles.list}>
              {filtered.map(c => {
                const sev = SEV_STYLE[c.severity] ?? SEV_STYLE.low;
                const isExp = expandedId === c.id;
                return (
                  <li
                    key={c.id}
                    className={localStyles.item}
                    style={assignInlineVars({
                      [localStyles.borderVar]: sev.border,
                      [localStyles.surfaceVar]: sev.bg,
                    })}
                  >
                    <button type="button" onClick={() => setExpandedId(isExp ? null : c.id)}
                      aria-expanded={isExp}
                      className={localStyles.itemButton}
                    >
                      <div className={localStyles.itemMain}>
                        <div className={localStyles.badgeRow}>
                          <span
                            className={localStyles.severityBadge}
                            style={assignInlineVars({
                              [localStyles.accentColorVar]: sev.accent,
                              [localStyles.surfaceVar]: sev.bg,
                              [localStyles.borderVar]: sev.border,
                            })}
                          >
                            {sev.label}
                          </span>
                          <span className={localStyles.categoryBadge}>
                            {CAT_LABEL[c.category] ?? c.category}
                          </span>
                          <span className={localStyles.confidence}>
                            {Math.round(c.confidence * 100)}% Konfidenz
                          </span>
                        </div>
                        <div className={`${localStyles.description} ${isExp ? localStyles.descriptionExpanded : ''}`}>
                          {c.description}
                        </div>
                      </div>
                      <span className={localStyles.caret}>{isExp ? 'Schließen' : 'Öffnen'}</span>
                    </button>
                    {isExp ? (
                      <div className={localStyles.expanded}>
                        <div className={localStyles.compareRow}>
                          <div className={localStyles.compareCard}>
                            <div className={localStyles.compareTitle}>DOKUMENT A</div>
                            <div className={localStyles.compareName}>{c.documentA.title}</div>
                            {c.documentA.excerpt ? <div className={localStyles.compareExcerpt}>„{c.documentA.excerpt.slice(0, 80)}“</div> : null}
                          </div>
                          <div className={localStyles.compareCard}>
                            <div className={localStyles.compareTitle}>DOKUMENT B</div>
                            <div className={localStyles.compareName}>{c.documentB.title}</div>
                            {c.documentB.excerpt ? <div className={localStyles.compareExcerpt}>„{c.documentB.excerpt.slice(0, 80)}“</div> : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <div className={`${styles.empty} ${localStyles.emptyCompact}`}>
          Noch keine Analyse. Mindestens 2 Dokumente erforderlich.
        </div>
      )}
    </details>
  );
});

ContradictionSection.displayName = 'ContradictionSection';
