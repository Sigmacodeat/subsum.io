import type {
  CaseBlueprint,
  CaseNormAnalysis,
  CopilotRun,
  CopilotTask,
  LegalDocumentRecord,
  LegalFinding,
  LegalFindingType,
  OcrJob,
} from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useMemo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './case-insights-section.css';
import { priorityLabel } from '../panel-types';

type Props = {
  caseDocuments: LegalDocumentRecord[];
  caseOcrJobs: OcrJob[];
  caseFindings: LegalFinding[];
  caseTaskList: CopilotTask[];
  citationBackedFindingCount: number;
  folderSearchCount: number | null;
  latestCopilotRun: CopilotRun | null;
  latestBlueprint: CaseBlueprint | null;
  normAnalysis: CaseNormAnalysis | null;
  formatSecretUpdatedAt: (value?: string) => string;
};

const FINDING_TYPE_LABEL: Record<LegalFindingType, string> = {
  contradiction: 'Widerspruch',
  cross_reference: 'Querverweis',
  liability: 'Haftung',
  deadline_risk: 'Fristenrisiko',
  evidence_gap: 'Beweislücke',
  action_recommendation: 'Handlungsempfehlung',
  norm_error: 'Norm-Fehler',
  norm_warning: 'Norm-Warnung',
  norm_suggestion: 'Norm-Vorschlag',
};

const SEVERITY_ICON: Record<string, string> = {
  critical: '',
  high: '',
  medium: '',
  low: '',
};

const CATEGORY_GROUPS: Array<{ label: string; types: LegalFindingType[] }> = [
  { label: 'Widersprüche & Fakten', types: ['contradiction', 'cross_reference'] },
  { label: 'Haftung & Risiko', types: ['liability', 'deadline_risk'] },
  { label: 'Beweis & Empfehlung', types: ['evidence_gap', 'action_recommendation'] },
  { label: 'Normen & Paragraphen', types: ['norm_error', 'norm_warning', 'norm_suggestion'] },
];

type FilterMode = 'all' | 'critical' | 'norms' | 'contradictions';

export const CaseInsightsSection = memo((props: Props) => {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFindings = useMemo(() => {
    let list = props.caseFindings;
    if (filter === 'critical') {
      list = list.filter(f => f.severity === 'critical' || f.severity === 'high');
    } else if (filter === 'norms') {
      list = list.filter(f => f.type === 'norm_error' || f.type === 'norm_warning' || f.type === 'norm_suggestion');
    } else if (filter === 'contradictions') {
      list = list.filter(f => f.type === 'contradiction');
    }
    return list;
  }, [props.caseFindings, filter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of props.caseFindings) {
      counts[f.type] = (counts[f.type] ?? 0) + 1;
    }
    return counts;
  }, [props.caseFindings]);

  const normSummary = props.normAnalysis?.globalSummary;

  return (
    <>
      {/* ═══ Dashboard Summary ═══ */}
      <div className={localStyles.summaryGrid}>
        <div className={localStyles.summaryCard}>
          <div className={localStyles.summaryValue}>{props.caseDocuments.length}</div>
          <div className={localStyles.summaryLabel}>Dokumente</div>
        </div>
        <div className={localStyles.summaryCard}>
          <div className={localStyles.summaryValue}>{props.caseFindings.length}</div>
          <div className={localStyles.summaryLabel}>Findings</div>
        </div>
        <div className={localStyles.summaryCard}>
          <div className={localStyles.summaryValue}>{props.caseFindings.filter(f => f.severity === 'critical').length}</div>
          <div
            className={localStyles.summaryLabel}
            style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('status/error') })}
          >Kritisch</div>
        </div>
        <div className={localStyles.summaryCard}>
          <div className={localStyles.summaryValue}>{normSummary?.totalReferences ?? 0}</div>
          <div className={localStyles.summaryLabel}>§-Referenzen</div>
        </div>
        <div className={localStyles.summaryCard}>
          <div className={localStyles.summaryValue}>{props.caseTaskList.length}</div>
          <div className={localStyles.summaryLabel}>Tasks</div>
        </div>
      </div>

      {/* ═══ Copilot Run Status ═══ */}
      <div className={`${styles.jobMeta} ${localStyles.runMeta}`}>
        Copilot: {props.latestCopilotRun
          ? `${props.latestCopilotRun.status} (${props.formatSecretUpdatedAt(props.latestCopilotRun.startedAt)})`
          : 'noch nicht gelaufen'}
        {' · '}
        Blueprint: {props.latestBlueprint ? props.latestBlueprint.title : '—'}
      </div>

      {/* ═══ Norm Analysis Summary ═══ */}
      {normSummary && normSummary.totalReferences > 0 ? (
        <details className={`${styles.toolAccordion} ${localStyles.normAccordion}`}>
          <summary className={styles.toolAccordionSummary}>
            §-Analyse: {normSummary.totalReferences} Referenzen
            {normSummary.suspicious > 0 ? ` · ${normSummary.suspicious} verdächtig` : ''}
            {normSummary.unknown > 0 ? ` · ${normSummary.unknown} unbekannt` : ''}
          </summary>
          <div className={localStyles.chipsRow}>
            <span
              className={`${styles.chip} ${localStyles.statusChip}`}
              style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('status/success') })}
            >
              ✓ {normSummary.verified} verifiziert
            </span>
            {normSummary.unknown > 0 ? (
              <span
                className={`${styles.chip} ${localStyles.statusChip}`}
                style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('text/primary') })}
              >
                ? {normSummary.unknown} unbekannt
              </span>
            ) : null}
            {normSummary.suspicious > 0 ? (
              <span
                className={`${styles.chip} ${localStyles.statusChip}`}
                style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('status/error') })}
              >
                {normSummary.suspicious} verdächtig
              </span>
            ) : null}
            {normSummary.missingHints > 0 ? (
              <span
                className={`${styles.chip} ${localStyles.statusChip}`}
                style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('button/primary') })}
              >
                {normSummary.missingHints} Vorschläge
              </span>
            ) : null}
          </div>
          {props.normAnalysis?.allUniqueNorms && props.normAnalysis.allUniqueNorms.length > 0 ? (
            <div className={localStyles.tinyMeta}>
              Referenzierte Normen: {props.normAnalysis.allUniqueNorms.join(', ')}
            </div>
          ) : null}
        </details>
      ) : null}

      {/* ═══ Category Overview ═══ */}
      {props.caseFindings.length > 0 ? (
        <div className={localStyles.categoryRow}>
          {CATEGORY_GROUPS.map(group => {
            const count = group.types.reduce((sum, t) => sum + (categoryCounts[t] ?? 0), 0);
            if (count === 0) return null;
            return (
              <span key={group.label} className={`${styles.chip} ${localStyles.categoryChip}`}>
                {group.label}: {count}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* ═══ Filter Bar ═══ */}
      {props.caseFindings.length > 0 ? (
        <div className={localStyles.filterRow}>
          {([
            ['all', 'Alle'],
            ['critical', 'Kritisch'],
            ['norms', 'Normen'],
            ['contradictions', 'Widersprüche'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`${localStyles.filterButton} ${filter === key ? localStyles.filterButtonActive : ''}`}
              style={assignInlineVars({
                [localStyles.accentColorVar]: filter === key ? cssVarV2('button/primary') : cssVarV2('text/secondary'),
                [localStyles.borderVar]: filter === key ? cssVarV2('button/primary') : cssVarV2('layer/insideBorder/border'),
              })}
            >
              {label}
              {key === 'all' ? ` (${props.caseFindings.length})` : ''}
            </button>
          ))}
        </div>
      ) : null}

      {/* ═══ Findings List ═══ */}
      {props.caseFindings.length === 0 ? (
        <div className={styles.empty}>
          Noch keine Legal Findings vorhanden. Starten Sie den Analyse-Workflow, um Dokumente zu analysieren.
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className={styles.empty}>
          Keine Findings für den aktuellen Filter.
        </div>
      ) : (
        <ul className={`${styles.jobList} ${localStyles.findingsList}`}>
          {filteredFindings.map(item => {
            const isExpanded = expandedId === item.id;
            const severityAccent =
              item.severity === 'critical'
                ? cssVarV2('status/error')
                : item.severity === 'high'
                  ? cssVarV2('text/primary')
                  : item.severity === 'medium'
                    ? cssVarV2('text/secondary')
                    : cssVarV2('status/success');
            return (
              <li
                className={`${styles.jobItem} ${localStyles.findingItem}`}
                key={item.id}
                style={assignInlineVars({ [localStyles.borderVar]: severityAccent })}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  className={localStyles.findingButton}
                >
                  <span className={localStyles.findingIcon}>{SEVERITY_ICON[item.severity] ?? ''}</span>
                  <span className={localStyles.findingTitle}>{item.title}</span>
                  <span className={`${styles.chip} ${localStyles.typeChip}`}>
                    {FINDING_TYPE_LABEL[item.type] ?? item.type}
                  </span>
                  <span className={localStyles.findingCaret}>{isExpanded ? 'Schließen' : 'Öffnen'}</span>
                </button>

                {isExpanded ? (
                  <div className={localStyles.findingBody}>
                    <div className={styles.jobMeta}>{item.description}</div>
                    <div className={styles.jobMeta}>
                      Severity: {priorityLabel[item.severity]} · Confidence: {Math.round(item.confidence * 100)}%
                      · {item.citations.length} Quelle(n)
                    </div>

                    {item.citations.length > 0 ? (
                      <div className={localStyles.citationsBox}>
                        {item.citations.map((c, i) => (
                          <div key={`${item.id}:c:${i}`} className={localStyles.citationRow}>
                            <strong>Quelle #{i + 1}</strong> (Doc: {c.documentId.slice(0, 16)}…)
                            <div className={localStyles.citationQuote}>
                              „{c.quote.slice(0, 200)}{c.quote.length > 200 ? '…' : ''}"
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
});

CaseInsightsSection.displayName = 'CaseInsightsSection';
