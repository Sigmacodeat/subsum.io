import type {
  CaseActor,
  CaseDeadline,
  CaseIssue,
  CopilotTask,
  LegalDocumentRecord,
  LegalFinding,
  MatterRecord,
  OpposingParty,
} from '@affine/core/modules/case-assistant';
import clsx from 'clsx';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './case-fact-sheet-section.css';
import { sanitizeDisplayText } from '../utils';
import { legalDocumentKindLabel, legalDocumentStatusLabel } from '../panel-types';

type Props = {
  clientName: string | null;
  matter: MatterRecord | null;
  anwaltName: string | null;
  opposingParties: OpposingParty[];
  actors: CaseActor[];
  deadlines: CaseDeadline[];
  issues: CaseIssue[];
  findings: LegalFinding[];
  tasks: CopilotTask[];
  documents: LegalDocumentRecord[];
  normReferences: string[];
  caseSummary: string | null;
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: cssVarV2('status/error'),
  high: cssVarV2('text/primary'),
  medium: cssVarV2('text/secondary'),
  low: cssVarV2('text/secondary'),
};

const SEVERITY_BG: Record<string, string> = {
  critical: cssVarV2('layer/background/secondary'),
  high: cssVarV2('layer/background/secondary'),
  medium: cssVarV2('layer/background/secondary'),
  low: cssVarV2('layer/background/secondary'),
};

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className={localStyles.statusDot}
      style={assignInlineVars({ [localStyles.accentColorVar]: color })}
      aria-hidden="true"
    />
  );
}

function SectionCard({
  title,
  icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className={`${styles.toolAccordion} ${localStyles.sectionCard}`}
    >
      <summary className={styles.toolAccordionSummary}>
        <span className={localStyles.sectionSummaryRow}>
          <span aria-hidden="true">{icon}</span>
          <span className={localStyles.sectionSummaryTitle}>{title}</span>
          {count !== undefined ? (
            <span
              className={localStyles.sectionCount}
              style={assignInlineVars({
                [localStyles.accentColorVar]: count > 0 ? cssVarV2('button/primary') : cssVarV2('text/secondary'),
              })}
            >
              {count}
            </span>
          ) : null}
        </span>
      </summary>
      <div className={localStyles.sectionBody}>{children}</div>
    </details>
  );
}

export const CaseFactSheetSection = memo((props: Props) => {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const openDeadlines = props.deadlines.filter(d => d.status === 'open');
  const overdueDeadlines = openDeadlines.filter(d => new Date(d.dueAt) < new Date());
  const indexedDocs = props.documents.filter(d => d.status === 'indexed');
  const ocrPendingDocs = props.documents.filter(
    d => d.status === 'ocr_pending' || d.status === 'ocr_running'
  );
  const openTasks = props.tasks.filter(t => t.status !== 'done');
  const criticalFindings = props.findings.filter(
    f => f.severity === 'critical' || f.severity === 'high'
  );

  const hasMatter = !!props.matter;
  const hasData = props.documents.length > 0 || props.findings.length > 0 || props.tasks.length > 0;

  return (
    <section className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Akt-Faktenbericht</h3>
        {hasMatter ? (
          <span className={localStyles.headingMeta}>
            AZ: {props.matter?.externalRef ?? '—'}
          </span>
        ) : null}
      </div>

      {!hasMatter ? (
        <div className={styles.warningBanner} role="alert">
          Kein Akt ausgewählt. Bitte zuerst Mandant und Akte unter „Mandanten & Akten" zuordnen.
        </div>
      ) : null}

      {/* ── KPI Row ── */}
      {hasMatter ? (
        <div className={localStyles.kpiGrid}>
          {[
            { label: 'Dokumente', value: props.documents.length, color: cssVarV2('button/primary') },
            { label: 'Indexiert', value: indexedDocs.length, color: cssVarV2('status/success') },
            { label: 'OCR ausstehend', value: ocrPendingDocs.length, color: ocrPendingDocs.length > 0 ? cssVarV2('text/primary') : cssVarV2('text/secondary') },
            { label: 'Findings', value: props.findings.length, color: criticalFindings.length > 0 ? cssVarV2('status/error') : cssVarV2('button/primary') },
            { label: 'Fristen offen', value: openDeadlines.length, color: overdueDeadlines.length > 0 ? cssVarV2('status/error') : cssVarV2('status/success') },
            { label: 'Tasks offen', value: openTasks.length, color: openTasks.length > 0 ? cssVarV2('text/primary') : cssVarV2('status/success') },
          ].map(kpi => (
            <div key={kpi.label} className={localStyles.kpiCard}>
              <div
                className={localStyles.kpiValue}
                style={assignInlineVars({ [localStyles.accentColorVar]: kpi.color })}
              >
                {kpi.value}
              </div>
              <div className={localStyles.kpiLabel}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Parteien ── */}
      {hasMatter ? (
        <SectionCard title="Parteien & Zuordnung" icon="" defaultOpen>
          <div className={localStyles.partyGrid}>
            <div>
              <span className={localStyles.labelStrong}>Mandant:</span>{' '}
              <span className={localStyles.valueText}>{props.clientName ?? '—'}</span>
            </div>
            <div>
              <span className={localStyles.labelStrong}>Anwalt:</span>{' '}
              <span className={localStyles.valueText}>{props.anwaltName ?? '—'}</span>
            </div>
            <div>
              <span className={localStyles.labelStrong}>Akte:</span>{' '}
              <span className={localStyles.valueText}>{props.matter?.title ?? '—'}</span>
            </div>
            <div>
              <span className={localStyles.labelStrong}>Gericht:</span>{' '}
              <span className={localStyles.valueText}>{props.matter?.gericht ?? '—'}</span>
            </div>
            <div>
              <span className={localStyles.labelStrong}>Aktenzeichen:</span>{' '}
              <span className={localStyles.valueText}>{props.matter?.externalRef ?? '—'}</span>
            </div>
            <div>
              <span className={localStyles.labelStrong}>Status:</span>{' '}
              <span className={localStyles.valueText}>{props.matter?.status ?? '—'}</span>
            </div>
          </div>
          {props.opposingParties.length > 0 ? (
            <div className={localStyles.mt6Pad4}>
              <div className={localStyles.subHeading}>
                Gegner / Beteiligte:
              </div>
              {props.opposingParties.map((p, i) => (
                <div key={i} className={localStyles.rowText10}>
                  <span className={localStyles.labelStrong}>{p.displayName}</span>
                  {p.kind ? <span className={localStyles.mutedText}> ({p.kind})</span> : null}
                  {p.legalRepresentative ? <span className={localStyles.mutedText}> — RA: {p.legalRepresentative}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {/* ── Extrahierte Personen ── */}
      {props.actors.length > 0 ? (
        <SectionCard title="Extrahierte Personen" icon="" count={props.actors.length}>
          <ul className={localStyles.listReset}>
            {props.actors.map(actor => (
              <li key={actor.id} className={localStyles.rowItem}>
                <span className={localStyles.nameStrong}>{actor.name}</span>
                <span className={localStyles.roleChip}>
                  {actor.role}
                </span>
                <span className={localStyles.tinyMuted}>
                  {actor.sourceDocIds.length} Dok.
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── Rechtliche Referenzen ── */}
      {props.normReferences.length > 0 ? (
        <SectionCard title="Rechtliche Referenzen" icon="" count={props.normReferences.length}>
          <div className={localStyles.refsWrap}>
            {props.normReferences.map((ref, i) => (
              <span key={i} className={localStyles.refPill}>
                {ref}
              </span>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Fristen ── */}
      {props.deadlines.length > 0 ? (
        <SectionCard
          title="Fristen"
          icon=""
          count={openDeadlines.length}
          defaultOpen={overdueDeadlines.length > 0}
        >
          <ul className={localStyles.listReset}>
            {props.deadlines
              .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
              .map(d => {
                const isOverdue = d.status === 'open' && new Date(d.dueAt) < new Date();
                const isOpen = d.status === 'open';
                const bg = isOverdue
                  ? cssVarV2('layer/background/secondary')
                  : isOpen
                    ? cssVarV2('layer/background/secondary')
                    : cssVarV2('layer/background/secondary');
                const border = isOverdue
                  ? cssVarV2('status/error')
                  : isOpen
                    ? cssVarV2('text/primary')
                    : cssVarV2('status/success');
                const dot = isOverdue
                  ? cssVarV2('status/error')
                  : isOpen
                    ? cssVarV2('text/primary')
                    : cssVarV2('status/success');
                return (
                  <li
                    key={d.id}
                    className={localStyles.rowItemLoose}
                    style={assignInlineVars({
                      [localStyles.tintBgVar]: bg,
                      [localStyles.tintBorderVar]: border,
                    })}
                  >
                    <StatusDot color={dot} />
                    <span className={`${localStyles.nameStrong} ${localStyles.valueText}`}>{d.title}</span>
                    <span
                      className={localStyles.docStatus}
                      style={assignInlineVars({
                        [localStyles.accentColorVar]: isOverdue ? cssVarV2('status/error') : cssVarV2('text/secondary'),
                      })}
                    >
                      {new Date(d.dueAt).toLocaleDateString('de-DE')}
                      {isOverdue ? ' ÜBERFÄLLIG' : ''}
                    </span>
                  </li>
                );
              })}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── Findings ── */}
      {props.findings.length > 0 ? (
        <SectionCard
          title="Analyse-Findings"
          icon=""
          count={props.findings.length}
          defaultOpen={criticalFindings.length > 0}
        >
          <ul className={localStyles.listReset}>
            {props.findings
              .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, low: 3 };
                return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
              })
              .map(f => {
                const isExpanded = expandedFinding === f.id;
                const bg = SEVERITY_BG[f.severity] ?? cssVarV2('layer/background/secondary');
                const dot = SEVERITY_COLOR[f.severity] ?? cssVarV2('text/secondary');
                return (
                  <li key={f.id} className={localStyles.findingListItem}>
                    <button
                      type="button"
                      onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                      aria-expanded={isExpanded}
                      className={localStyles.findingButton}
                      style={assignInlineVars({ [localStyles.tintBgVar]: bg })}
                    >
                      <StatusDot color={dot} />
                      <div className={localStyles.valueText}>
                        <div className={clsx(localStyles.findingTitle, isExpanded && localStyles.findingTitleExpanded)}>
                          {f.title}
                        </div>
                        {!isExpanded ? (
                          <div className={localStyles.findingMeta}>
                            {f.severity} · {Math.round(f.confidence * 100)}% Konfidenz
                          </div>
                        ) : null}
                      </div>
                      <span className={localStyles.caret}>{isExpanded ? 'Schließen' : 'Öffnen'}</span>
                    </button>
                    {isExpanded ? (
                      <div
                        className={localStyles.findingBody}
                        style={assignInlineVars({ [localStyles.tintBgVar]: bg })}
                      >
                        <div>{f.description}</div>
                        <div className={localStyles.findingMeta}>
                          Typ: {f.type} · Konfidenz: {Math.round(f.confidence * 100)}% · Quellen: {f.sourceDocumentIds.length} Dok.
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── Aufgaben ── */}
      {props.tasks.length > 0 ? (
        <SectionCard title="Aufgaben" icon="" count={openTasks.length}>
          <ul className={localStyles.listReset}>
            {props.tasks.map(t => {
              const isDone = t.status === 'done';
              return (
                <li
                  key={t.id}
                  className={`${localStyles.rowItem} ${localStyles.opacityDone}`}
                  style={assignInlineVars({ [localStyles.rowOpacityVar]: isDone ? '0.6' : '1' })}
                >
                  <span className={localStyles.valueText}>{isDone ? '☑' : '☐'}</span>
                  <span className={clsx(localStyles.taskTitle, isDone && localStyles.taskTitleDone)}>
                    {t.title}
                  </span>
                  <span
                    className={localStyles.taskPriority}
                    style={assignInlineVars({
                      [localStyles.accentColorVar]: SEVERITY_COLOR[t.priority] ?? cssVarV2('text/secondary'),
                    })}
                  >
                    {t.priority}
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── Dokumente ── */}
      {props.documents.length > 0 ? (
        <SectionCard title="Akten-Dokumente" icon="" count={props.documents.length}>
          <ul className={localStyles.listReset}>
            {props.documents.map(doc => {
              const isIndexed = doc.status === 'indexed';
              const isPending = doc.status === 'ocr_pending' || doc.status === 'ocr_running';
              return (
                <li key={doc.id} className={localStyles.rowItem}>
                  <span className={localStyles.valueText}>
                    {isIndexed ? 'Indexiert' : isPending ? 'Ausstehend' : 'Fehler'}
                  </span>
                  <span className={localStyles.taskTitle}>
                    {sanitizeDisplayText(doc.title) || 'Unbenannt'}
                  </span>
                  <span className={localStyles.tinyMuted}>
                    {legalDocumentKindLabel[doc.kind]}
                  </span>
                  <span
                    className={localStyles.docStatus}
                    style={assignInlineVars({
                      [localStyles.accentColorVar]: isPending
                        ? cssVarV2('text/primary')
                        : isIndexed
                          ? cssVarV2('status/success')
                          : cssVarV2('status/error'),
                    })}
                  >
                    {legalDocumentStatusLabel[doc.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── Zusammenfassung ── */}
      {props.caseSummary ? (
        <SectionCard title="Fall-Zusammenfassung" icon="">
          <div className={localStyles.summaryText}>
            {props.caseSummary}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Empty State ── */}
      {hasMatter && !hasData ? (
        <div className={`${styles.empty} ${localStyles.emptyState}`}>
          <div className={localStyles.emptyIcon}></div>
          <div className={localStyles.emptyTitle}>Noch keine Daten extrahiert</div>
          <div className={localStyles.emptyHint}>
            Laden Sie Dokumente hoch und starten Sie die Analyse, um den Faktenbericht zu füllen.
          </div>
        </div>
      ) : null}
    </section>
  );
});

CaseFactSheetSection.displayName = 'CaseFactSheetSection';
