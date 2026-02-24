import type {
  AuditRiskLevel,
  CaseAuditResult,
  ReclassificationSuggestion,
  TatbestandsCheckResult,
  QualificationChainResult,
  BeweislastCheckResult,
} from '@affine/core/modules/case-assistant';
import clsx from 'clsx';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useMemo, useState } from 'react';

import * as localStyles from './aktenaudit-section.css';

type Props = {
  auditResult: CaseAuditResult | null;
};

const RISK_BADGE: Record<AuditRiskLevel, { icon: string; label: string; accent: string }> = {
  low: { icon: '', label: 'Niedriges Risiko', accent: cssVarV2('status/success') },
  medium: { icon: '', label: 'Mittleres Risiko', accent: cssVarV2('text/primary') },
  high: { icon: '', label: 'Hohes Risiko', accent: cssVarV2('text/primary') },
  critical: { icon: '', label: 'Kritisches Risiko', accent: cssVarV2('status/error') },
};

const DIRECTION_LABEL: Record<string, string> = {
  upgrade: 'Qualifikations-Upgrade',
  downgrade: 'Herabstufung',
  alternative: 'Alternative Einordnung',
};

type TabId = 'overview' | 'norms' | 'reclassifications' | 'chains' | 'beweislast';

export const AktenauditSection = memo((props: Props) => {
  const { auditResult } = props;
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedNormId, setExpandedNormId] = useState<string | null>(null);
  const [expandedReclassId, setExpandedReclassId] = useState<string | null>(null);

  const tabs: Array<{ id: TabId; label: string; count?: number }> = useMemo(() => {
    if (!auditResult) return [];
    return [
      { id: 'overview', label: 'Übersicht' },
      { id: 'norms', label: 'Erkannte Normen', count: auditResult.detectedNorms.length },
      { id: 'reclassifications', label: 'Reklassifizierung', count: auditResult.reclassifications.length },
      { id: 'chains', label: 'Qualifikationsketten', count: auditResult.qualificationChains.length },
      { id: 'beweislast', label: 'Beweislast', count: auditResult.beweislastAnalysis.length },
    ];
  }, [auditResult]);

  if (!auditResult) {
    return (
      <div className={localStyles.root}>
        <div className={localStyles.title}>Aktenaudit</div>
        <p className={localStyles.emptyText}>
          Noch kein Aktenaudit durchgeführt. Starten Sie die Fallanalyse, um den automatischen Audit zu aktivieren.
        </p>
      </div>
    );
  }

  const risk = RISK_BADGE[auditResult.riskLevel];

  return (
    <div className={localStyles.root}>
      <div className={localStyles.title}>Aktenaudit</div>

      {/* ── Risk Score Banner ── */}
      <div
        className={localStyles.riskBanner}
        style={assignInlineVars({ [localStyles.accentColorVar]: risk.accent })}
      >
        <span className={localStyles.riskIcon}>{risk.icon}</span>
        <div className={localStyles.riskMetaWrap}>
          <div
            className={localStyles.riskLabel}
            style={assignInlineVars({ [localStyles.accentColorVar]: risk.accent })}
          >
            {risk.label}
          </div>
          <div className={localStyles.riskSub}>
            Score: {auditResult.overallRiskScore}/100 — {auditResult.summary}
          </div>
        </div>
        <div
          className={localStyles.riskScoreBubble}
          style={assignInlineVars({ [localStyles.accentColorVar]: risk.accent })}
        >
          {auditResult.overallRiskScore}
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className={localStyles.kpiGrid}>
        <KpiCard label="Normen erkannt" value={auditResult.stats.totalNormsDetected} />
        <KpiCard label="Reklassifizierungen" value={auditResult.stats.totalReclassifications} highlight={auditResult.stats.totalReclassifications > 0} />
        <KpiCard label="Qualifikations-Upgrades" value={auditResult.stats.totalQualificationUpgrades} highlight={auditResult.stats.totalQualificationUpgrades > 0} />
        <KpiCard label="Beweislast-Lücken" value={auditResult.stats.totalBeweislastGaps} highlight={auditResult.stats.totalBeweislastGaps > 0} />
        <KpiCard label="Hohe Konfidenz" value={auditResult.stats.highConfidenceNorms} />
        <KpiCard label="Audit-Dauer" value={`${auditResult.auditDurationMs}ms`} />
      </div>

      {/* ── Tab Bar ── */}
      <div className={localStyles.tabRow}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              localStyles.tabButton,
              activeTab === tab.id && localStyles.tabButtonActive
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={localStyles.tabCount}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && <OverviewTab audit={auditResult} />}
      {activeTab === 'norms' && (
        <NormsTab
          norms={auditResult.detectedNorms}
          expandedId={expandedNormId}
          onToggle={id => setExpandedNormId(expandedNormId === id ? null : id)}
        />
      )}
      {activeTab === 'reclassifications' && (
        <ReclassificationsTab
          reclassifications={auditResult.reclassifications}
          expandedId={expandedReclassId}
          onToggle={id => setExpandedReclassId(expandedReclassId === id ? null : id)}
        />
      )}
      {activeTab === 'chains' && <ChainsTab chains={auditResult.qualificationChains} />}
      {activeTab === 'beweislast' && <BeweislastTab items={auditResult.beweislastAnalysis} />}
    </div>
  );
});
AktenauditSection.displayName = 'AktenauditSection';

// ─── Sub-Components ─────────────────────────────────────────────────────────

const KpiCard = memo(({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) => (
  <div className={clsx(localStyles.kpiCard, highlight && localStyles.kpiCardHighlight)}>
    <div className={localStyles.kpiLabel}>{label}</div>
    <div className={localStyles.kpiValue}>{value}</div>
  </div>
));
KpiCard.displayName = 'KpiCard';

const OverviewTab = memo(({ audit }: { audit: CaseAuditResult }) => {
  const topNorms = audit.detectedNorms
    .filter(n => n.overallScore >= 0.3)
    .slice(0, 5);

  return (
    <div className={localStyles.contentStack}>
      {topNorms.length > 0 && (
        <div>
          <div className={localStyles.sectionHeading}>Top erkannte Tatbestände</div>
          {topNorms.map(n => (
            <div key={n.normId} className={localStyles.rowCard}>
              <ScoreBar score={n.overallScore} />
              <div className={localStyles.rowMeta}>
                <strong>{n.law} {n.paragraph}</strong> — {n.normTitle}
              </div>
              <span className={localStyles.subText}>
                {(n.overallScore * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {audit.reclassifications.length > 0 && (
        <div>
          <div className={clsx(localStyles.sectionHeading, localStyles.sectionHeadingAccent)}>
            Reklassifizierungs-Vorschläge
          </div>
          {audit.reclassifications.slice(0, 3).map(r => (
            <div key={r.id} className={localStyles.borderedCardAccent}>
              <div className={localStyles.accordionBody}>
                <div className={localStyles.titleStrong}>
                {DIRECTION_LABEL[r.direction]} — {r.suggestedNormTitle}
                </div>
                <div className={clsx(localStyles.text11Muted, localStyles.marginTop2)}>
                Statt: {r.currentNormTitle}
                </div>
                <div className={clsx(localStyles.text11Muted, localStyles.marginTop4)}>
                Konfidenz: {(r.confidence * 100).toFixed(0)}% — {r.triggeredByIndicators.slice(0, 3).join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {audit.reclassifications.length === 0 && topNorms.length === 0 && (
        <p className={localStyles.emptyParagraph}>
          Keine relevanten Tatbestände mit ausreichender Konfidenz erkannt.
        </p>
      )}
    </div>
  );
});
OverviewTab.displayName = 'OverviewTab';

const NormsTab = memo(({ norms, expandedId, onToggle }: {
  norms: TatbestandsCheckResult[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) => {
  if (norms.length === 0) {
    return <p className={localStyles.emptyParagraph}>Keine Normen erkannt.</p>;
  }

  return (
    <div className={localStyles.stack4}>
      {norms.map(n => {
        const isExpanded = expandedId === n.normId;
        const fulfilledCount = n.merkmale.filter(m => m.fulfilled).length;
        const requiredFulfilled = n.merkmale.filter(m => m.required && m.fulfilled).length;
        const requiredTotal = n.merkmale.filter(m => m.required).length;

        return (
          <div key={n.normId} className={localStyles.borderedCard}>
            <button
              onClick={() => onToggle(n.normId)}
              className={localStyles.accordionButton}
            >
              <ScoreBar score={n.overallScore} />
              <div className={localStyles.flex1}>
                <div className={localStyles.titleStrong}>
                  {n.law} {n.paragraph} — {n.normTitle}
                </div>
                <div className={localStyles.text11Muted}>
                  {fulfilledCount}/{n.merkmale.length} Merkmale erfüllt
                  {requiredTotal > 0 && ` (${requiredFulfilled}/${requiredTotal} Pflicht)`}
                  {n.allRequiredFulfilled && requiredTotal > 0 && ' (erfüllt)'}
                </div>
              </div>
              <span className={localStyles.scorePercent}>
                {(n.overallScore * 100).toFixed(0)}%
              </span>
              <span className={localStyles.iconSm}>{isExpanded ? 'Schließen' : 'Öffnen'}</span>
            </button>

            {isExpanded && (
              <div className={localStyles.accordionBody}>
                <div className={localStyles.titleXsStrong}>Tatbestandsmerkmale:</div>
                {n.merkmale.map(m => (
                  <div key={m.merkmalId} className={localStyles.merkmalRow}>
                    <span className={localStyles.iconLg}>
                      {m.fulfilled ? 'Erfüllt' : m.required ? 'Fehlt' : 'Optional'}
                    </span>
                    <div className={localStyles.flex1}>
                      <div className={localStyles.titleXsStrong}>
                        {m.label}
                        {m.required && <span className={localStyles.requiredAsterisk}>*</span>}
                      </div>
                      <div className={localStyles.text10Muted}>
                        {m.description}
                      </div>
                      {m.matchedIndicators.length > 0 && (
                        <div className={clsx(localStyles.text10Success, localStyles.marginTop2)}>
                          Matched: {m.matchedIndicators.join(', ')}
                        </div>
                      )}
                      {m.sourceExcerpts.length > 0 && (
                        <div className={clsx(localStyles.text10Muted, localStyles.marginTop2)}>
                          &quot;{m.sourceExcerpts[0].slice(0, 150)}&quot;
                        </div>
                      )}
                    </div>
                    <div className={localStyles.confidenceNowrap}>
                      {(m.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
                {n.matchedKeywords.length > 0 && (
                  <div className={clsx(localStyles.text10Muted, localStyles.marginTop4)}>
                    Keywords: {n.matchedKeywords.slice(0, 8).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
NormsTab.displayName = 'NormsTab';

const ReclassificationsTab = memo(({ reclassifications, expandedId, onToggle }: {
  reclassifications: ReclassificationSuggestion[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) => {
  if (reclassifications.length === 0) {
    return (
      <p className={localStyles.emptyParagraph}>
        Keine Reklassifizierungs-Vorschläge. Alle Norm-Zuordnungen erscheinen korrekt.
      </p>
    );
  }

  return (
    <div className={localStyles.contentStack}>
      {reclassifications.map(r => {
        const isExpanded = expandedId === r.id;
        const confidenceClass =
          r.confidence >= 0.7
            ? localStyles.confidenceHigh
            : r.confidence >= 0.4
              ? localStyles.confidenceMedium
              : localStyles.confidenceLow;

        return (
          <div
            key={r.id}
            className={clsx(
              localStyles.borderedCard,
              r.direction === 'upgrade' && localStyles.borderedCardAccent
            )}
          >
            <button
              onClick={() => onToggle(r.id)}
              className={localStyles.accordionButton}
            >
              <span className={localStyles.iconLg}>
                {r.direction === 'upgrade' ? '↑' : r.direction === 'downgrade' ? '↓' : '↔'}
              </span>
              <div className={localStyles.flex1}>
                <div className={localStyles.titleStrong}>
                  {DIRECTION_LABEL[r.direction]}
                </div>
                <div className={localStyles.text11Muted}>
                  {r.currentNormTitle} → {r.suggestedNormTitle}
                </div>
              </div>
              <span className={clsx(localStyles.confidenceBadge, confidenceClass)}>
                {(r.confidence * 100).toFixed(0)}%
              </span>
              <span className={localStyles.iconSm}>{isExpanded ? 'Schließen' : 'Öffnen'}</span>
            </button>

            {isExpanded && (
              <div className={localStyles.accordionBody}>
                <div className={clsx(localStyles.text11, localStyles.marginTop2)}>{r.reason}</div>

                <div className={localStyles.rowWrap}>
                  {r.strafrahmenCurrent && (
                    <div>
                      <span className={localStyles.text11Muted}>Aktuell: </span>
                      <strong>{r.strafrahmenCurrent}</strong>
                    </div>
                  )}
                  {r.strafrahmenSuggested && (
                    <div>
                      <span className={localStyles.text11Muted}>Vorgeschlagen: </span>
                      <strong className={localStyles.text10Error}>{r.strafrahmenSuggested}</strong>
                    </div>
                  )}
                </div>

                {r.triggeredByIndicators.length > 0 && (
                  <div className={clsx(localStyles.text10Muted, localStyles.marginTop6)}>
                    Indikatoren: {r.triggeredByIndicators.join(', ')}
                  </div>
                )}

                <div className={clsx(localStyles.text10Muted, localStyles.marginTop4)}>
                  Rechtsgrundlage: {r.legalBasis}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
ReclassificationsTab.displayName = 'ReclassificationsTab';

const ChainsTab = memo(({ chains }: { chains: QualificationChainResult[] }) => {
  if (chains.length === 0) {
    return (
      <p className={localStyles.emptyParagraph}>
        Keine Qualifikationsketten erkannt.
      </p>
    );
  }

  return (
    <div className={localStyles.contentStack}>
      {chains.map((chain, idx) => (
        <div key={idx} className={localStyles.accordionBody}>
          <div className={localStyles.titleStrongWithBottom}>
            Grundtatbestand: {chain.baseNormTitle}
          </div>
          <div className={clsx(localStyles.text11Muted, localStyles.marginTop2)}>
            {chain.chainDescription}
          </div>

          <div className={localStyles.stack4}>
            {chain.detectedQualifications.map((q, qi) => (
              <div key={qi} className={localStyles.qualifierCard}>
                <span className={localStyles.qualifierLevel}>
                  Lvl {q.level}
                </span>
                <div className={clsx(localStyles.flex1, localStyles.text11)}>
                  <strong>{q.normTitle}</strong>
                </div>
                <ScoreBar score={q.score} />
                <span className={localStyles.text10Muted}>{(q.score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          <div className={localStyles.recommendationBox}>
            Empfehlung: {chain.recommendedNormTitle}
          </div>
        </div>
      ))}
    </div>
  );
});
ChainsTab.displayName = 'ChainsTab';

const BeweislastTab = memo(({ items }: { items: BeweislastCheckResult[] }) => {
  if (items.length === 0) {
    return (
      <p className={localStyles.emptyParagraph}>
        Keine Beweislast-Analyse vorhanden.
      </p>
    );
  }

  return (
    <div className={localStyles.contentStack}>
      {items.map(b => (
        <div
          key={b.normId}
          className={clsx(
            localStyles.accordionBody,
            b.identifiedGaps.length > 0 && localStyles.borderedCardAccent
          )}
        >
          <div className={localStyles.titleStrong}>{b.normTitle}</div>
          <div className={clsx(localStyles.text11, localStyles.marginTop2)}>
            <span className={localStyles.text11Muted}>Beweislast: </span>
            {b.burdenDescription}
          </div>

          {b.identifiedGaps.length > 0 && (
            <div className={localStyles.marginTop6}>
              <div className={localStyles.text10Warn}>
                Lücken ({b.identifiedGaps.length}):
              </div>
              {b.identifiedGaps.map((gap, gi) => (
                <div key={gi} className={localStyles.gapItem}>
                  {gap}
                </div>
              ))}
            </div>
          )}

          {b.missingEvidence.length > 0 && (
            <div className={localStyles.marginTop6}>
              <div className={localStyles.text10Error}>
                Fehlende Beweise:
              </div>
              {b.missingEvidence.map((ev, ei) => (
                <div key={ei} className={localStyles.dotListItem}>
                  • {ev}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
BeweislastTab.displayName = 'BeweislastTab';

const ScoreBar = memo(({ score }: { score: number }) => {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? cssVarV2('status/success')
      : pct >= 40
        ? cssVarV2('text/primary')
        : cssVarV2('status/error');

  return (
    <div className={localStyles.scoreWrap}>
      <div
        className={localStyles.scoreFill}
        style={assignInlineVars({
          [localStyles.accentColorVar]: color,
          [localStyles.barWidthVar]: `${pct}%`,
        })}
      />
    </div>
  );
});
ScoreBar.displayName = 'ScoreBar';
