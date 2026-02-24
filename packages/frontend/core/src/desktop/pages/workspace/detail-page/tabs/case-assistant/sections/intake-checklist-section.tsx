import type {
  DocumentQualityReport,
  IntakeChecklistItem,
  LegalDocumentRecord,
  QualityProblem,
} from '@affine/core/modules/case-assistant';
import clsx from 'clsx';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useCallback, useMemo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './intake-checklist-section.css';

type Props = {
  documents: LegalDocumentRecord[];
  qualityReports: DocumentQualityReport[];
  onVerifyChecklistItem?: (documentId: string, itemId: string) => void;
};

const STATUS_ICON: Record<string, string> = {
  ok: 'OK',
  warning: 'Warnung',
  error: 'Fehler',
  skipped: 'Übersprungen',
};

const STATUS_COLOR: Record<string, string> = {
  ok: cssVarV2('status/success'),
  warning: cssVarV2('text/primary'),
  error: cssVarV2('status/error'),
  skipped: cssVarV2('text/secondary'),
};

const PROCESSING_STATUS_LABELS: Record<string, { label: string; accent: string; bg: string }> = {
  ready: { label: 'Verarbeitet', accent: cssVarV2('status/success'), bg: cssVarV2('layer/background/secondary') },
  needs_review: { label: 'Prüfung nötig', accent: cssVarV2('text/primary'), bg: cssVarV2('layer/background/secondary') },
  failed: { label: 'Fehlgeschlagen', accent: cssVarV2('status/error'), bg: cssVarV2('layer/background/secondary') },
  uploading: { label: 'Hochladen…', accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary') },
  extracting: { label: 'Extrahiere…', accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary') },
  chunking: { label: 'Analysiere…', accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary') },
  analyzing: { label: 'Analysiere…', accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary') },
};

function QualityBar({ score }: { score: number }) {
  const accent = score >= 80 ? cssVarV2('status/success') : score >= 50 ? cssVarV2('text/primary') : cssVarV2('status/error');
  return (
    <div className={localStyles.qualityBarRow}>
      <div className={localStyles.qualityTrack}>
        <div
          className={localStyles.qualityFill}
          style={assignInlineVars({
            [localStyles.barWidthVar]: `${Math.min(100, score)}%`,
            [localStyles.accentColorVar]: accent,
          })}
        />
      </div>
      <span
        className={localStyles.qualityLabel}
        style={assignInlineVars({ [localStyles.accentColorVar]: accent })}
      >{score}%</span>
    </div>
  );
}

function ProblemList({ problems }: { problems: QualityProblem[] }) {
  if (problems.length === 0) return null;
  return (
    <div className={localStyles.problemList}>
      {problems.map((p, i) => (
        <div key={i} className={localStyles.problemRow}>
          <span>{p.severity === 'error' ? 'Fehler' : p.severity === 'warning' ? 'Warnung' : 'Info'}</span>
          <span>{p.description}</span>
        </div>
      ))}
    </div>
  );
}

function ChecklistItemRow({
  item,
  onVerify,
}: {
  item: IntakeChecklistItem;
  onVerify?: () => void;
}) {
  const accent = STATUS_COLOR[item.status] ?? cssVarV2('text/secondary');
  return (
    <div className={localStyles.checklistItem}>
      <span className={localStyles.checklistIcon}>{STATUS_ICON[item.status] ?? '–'}</span>
      <span
        className={clsx(localStyles.checklistLabel, item.status === 'error' && localStyles.checklistLabelError)}
        style={assignInlineVars({ [localStyles.accentColorVar]: accent })}
      >
        {item.label}
      </span>
      {item.detail ? (
        <span className={localStyles.checklistDetail}>
          {item.detail}
        </span>
      ) : null}
      {item.status !== 'ok' && item.status !== 'skipped' && !item.userVerified && onVerify ? (
        <button
          type="button"
          onClick={onVerify}
          className={localStyles.verifyButton}
          title="Manuell bestätigen"
        >
          Bestätigen
        </button>
      ) : null}
      {item.userVerified ? (
        <span className={localStyles.verifiedBadge}>
          ✓ geprüft
        </span>
      ) : null}
    </div>
  );
}

function DocumentChecklistCard({
  doc,
  report,
  isExpanded,
  onToggle,
  onVerifyItem,
}: {
  doc: LegalDocumentRecord;
  report: DocumentQualityReport | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  onVerifyItem?: (itemId: string) => void;
}) {
  const status =
    PROCESSING_STATUS_LABELS[doc.processingStatus ?? 'ready'] ?? PROCESSING_STATUS_LABELS.ready;
  const score = report?.overallScore ?? doc.overallQualityScore ?? 0;

  return (
    <div className={localStyles.documentCard}>
      <button
        type="button"
        onClick={onToggle}
        className={localStyles.documentHeaderButton}
        aria-expanded={isExpanded}
      >
        <span className={localStyles.chevron}>{isExpanded ? 'Schließen' : 'Öffnen'}</span>
        <span className={localStyles.documentTitle}>
          {doc.title}
        </span>
        <span
          className={localStyles.processingBadge}
          style={assignInlineVars({
            [localStyles.accentColorVar]: status.accent,
            [localStyles.surfaceVar]: status.bg,
          })}
        >
          {status.label}
        </span>
        <QualityBar score={score} />
      </button>

      {isExpanded ? (
        <div className={localStyles.documentBody}>
          <div className={localStyles.documentMeta}>
            <span><strong>Art:</strong> {doc.kind}</span>
            <span><strong>Engine:</strong> {doc.extractionEngine ?? doc.ocrEngine ?? '—'}</span>
            <span><strong>Chunks:</strong> {doc.chunkCount ?? 0}</span>
            <span><strong>Entities:</strong> {doc.entityCount ?? 0}</span>
            {doc.processingDurationMs ? <span><strong>Dauer:</strong> {doc.processingDurationMs}ms</span> : null}
            {doc.discardedBinaryAt ? <span className={localStyles.successMeta}>Binary verworfen ✓</span> : null}
          </div>

          {report && report.problems.length > 0 ? <ProblemList problems={report.problems} /> : null}

          {report && report.checklistItems.length > 0 ? (
            <div className={localStyles.checklistStack}>
              <div className={localStyles.checklistHeading}>
                Prüfpunkte:
              </div>
              {report.checklistItems.map(item => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  onVerify={onVerifyItem ? () => onVerifyItem(item.id) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className={localStyles.legacyHint}>
              Kein Qualitätsbericht vorhanden — Dokument wurde vor dem Pipeline-Update aufgenommen.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const IntakeChecklistSection = memo((props: Props) => {
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [localVerifiedItems, setLocalVerifiedItems] = useState<Record<string, true>>({});

  const reportsByDocId = new Map<string, DocumentQualityReport>();
  for (const report of props.qualityReports) {
    reportsByDocId.set(report.documentId, report);
  }

  const onToggle = useCallback((docId: string) => {
    setExpandedDocId(prev => (prev === docId ? null : docId));
  }, []);

  const onVerifyItem = useCallback(
    (documentId: string, itemId: string) => {
      setLocalVerifiedItems(prev => ({ ...prev, [`${documentId}:${itemId}`]: true }));
      props.onVerifyChecklistItem?.(documentId, itemId);
    },
    [props.onVerifyChecklistItem]
  );

  if (props.documents.length === 0) {
    return (
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Akt-Checkliste</h4>
        <div className={localStyles.emptyDocuments}>
          Noch keine Dokumente aufgenommen. Laden Sie Akten hoch, um die Checkliste zu sehen.
        </div>
      </section>
    );
  }

  const totalDocs = props.documents.length;
  const readyCount = props.documents.filter(d => d.processingStatus === 'ready').length;
  const reviewCount = props.documents.filter(d => d.processingStatus === 'needs_review').length;
  const failedCount = props.documents.filter(d => d.processingStatus === 'failed').length;
  const avgScore = Math.round(
    props.documents.reduce((sum, d) => sum + (d.overallQualityScore ?? 0), 0) / Math.max(1, totalDocs)
  );
  const totalChunks = props.documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);
  const totalEntities = props.documents.reduce((sum, d) => sum + (d.entityCount ?? 0), 0);
  const binaryDiscarded = props.documents.filter(d => !!d.discardedBinaryAt).length;

  const orderedDocuments = useMemo(() => {
    const priority = (doc: LegalDocumentRecord) =>
      doc.processingStatus === 'failed'
        ? 0
        : doc.processingStatus === 'needs_review'
          ? 1
          : 2;

    return [...props.documents].sort((a, b) => {
      const p = priority(a) - priority(b);
      if (p !== 0) return p;
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    });
  }, [props.documents]);

  const failureReasons = useMemo(() => {
    const reasons = new Map<string, number>();

    for (const doc of props.documents.filter(item => item.processingStatus === 'failed')) {
      const report = reportsByDocId.get(doc.id);
      const reason =
        report?.problems.find(p => p.severity === 'error')?.description
        ?? report?.problems[0]?.description
        ?? 'Extraktion fehlgeschlagen';
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }

    return [...reasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [props.documents, reportsByDocId]);

  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>Akt-Checkliste</h4>

      <div className={localStyles.kpiGrid}>
        {[
          { label: 'Dokumente', value: totalDocs, accent: cssVarV2('button/primary') },
          { label: 'Verarbeitet', value: readyCount, accent: cssVarV2('status/success') },
          { label: 'Zur Prüfung', value: reviewCount, accent: reviewCount > 0 ? cssVarV2('text/primary') : cssVarV2('text/secondary') },
          { label: 'Fehlgeschlagen', value: failedCount, accent: failedCount > 0 ? cssVarV2('status/error') : cssVarV2('text/secondary') },
        ].map(kpi => (
          <div key={kpi.label} className={localStyles.kpiCard}>
            <div
              className={localStyles.kpiValue}
              style={assignInlineVars({ [localStyles.accentColorVar]: kpi.accent })}
            >{kpi.value}</div>
            <div className={localStyles.kpiLabel}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className={localStyles.statsRow}>
        <span>Ø Qualität: <strong
          className={localStyles.statsHighlight}
          style={assignInlineVars({
            [localStyles.accentColorVar]: avgScore >= 80
              ? cssVarV2('status/success')
              : avgScore >= 50
                ? cssVarV2('text/primary')
                : cssVarV2('status/error'),
          })}
        >{avgScore}%</strong></span>
        <span>Chunks: <strong>{totalChunks}</strong></span>
        <span>Entities: <strong>{totalEntities}</strong></span>
        {binaryDiscarded > 0 ? <span className={localStyles.successMeta}>{binaryDiscarded} Binary(s) verworfen</span> : null}
      </div>

      {failedCount > 0 ? (
        <div className={localStyles.failureSummary} role="status" aria-live="polite">
          <div className={localStyles.failureSummaryTitle}>Fehler-Cluster</div>
          <div className={localStyles.failureSummaryList}>
            {failureReasons.map(([reason, count]) => (
              <div key={reason} className={localStyles.failureSummaryItem}>
                <span>{count}×</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={localStyles.completenessBox}>
        <div className={localStyles.completenessTitle}>Akt-Vollständigkeitsprüfung:</div>
        {[
          { label: 'Alle Dokumente verarbeitet', ok: failedCount === 0, detail: failedCount > 0 ? `${failedCount} fehlgeschlagen` : `${totalDocs} von ${totalDocs}` },
          { label: 'Kein Dokument mit Qualität < 60%', ok: props.documents.every(d => (d.overallQualityScore ?? 100) >= 60), detail: `Ø ${avgScore}%` },
          { label: 'Keine manuellen Prüfungen offen', ok: reviewCount === 0, detail: reviewCount > 0 ? `${reviewCount} zu prüfen` : 'Alle OK' },
          { label: 'Personen/Fristen/Normen extrahiert', ok: totalEntities > 0, detail: `${totalEntities} Entities` },
          { label: 'Semantische Abschnitte erstellt', ok: totalChunks > 0, detail: `${totalChunks} Chunks` },
        ].map(item => (
          <div key={item.label} className={localStyles.completenessRow}>
            <span>{item.ok ? 'OK' : 'Warnung'}</span>
            <span
              className={clsx(localStyles.completenessLabel, !item.ok && localStyles.completenessWarn)}
              style={assignInlineVars({
                [localStyles.accentColorVar]: item.ok ? cssVarV2('status/success') : cssVarV2('text/primary'),
              })}
            >{item.label}</span>
            <span className={localStyles.completenessDetail}>{item.detail}</span>
          </div>
        ))}
      </div>

      <div className={localStyles.documentList}>
        <div className={localStyles.documentListHeading}>Einzeldokumente:</div>
        {orderedDocuments.map(doc => {
          const report = reportsByDocId.get(doc.id);
          const mergedReport = report
            ? {
                ...report,
                checklistItems: report.checklistItems.map(item => ({
                  ...item,
                  userVerified: item.userVerified || !!localVerifiedItems[`${doc.id}:${item.id}`],
                })),
              }
            : undefined;
          return (
            <DocumentChecklistCard
              key={doc.id}
              doc={doc}
              report={mergedReport}
              isExpanded={expandedDocId === doc.id}
              onToggle={() => onToggle(doc.id)}
              onVerifyItem={itemId => onVerifyItem(doc.id, itemId)}
            />
          );
        })}
      </div>
    </section>
  );
});

IntakeChecklistSection.displayName = 'IntakeChecklistSection';
