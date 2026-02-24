import { Button } from '@affine/component';
import type {
  AnalyticsPeriod,
  CustomerHealthScore,
  CustomerHealthStatus,
  DailyActiveMetrics,
  ErrorGroup,
  ErrorSeverity,
  FeatureUsageRecord,
  GeoDistribution,
  PerformanceRating,
  RetentionCohort,
} from '@affine/core/modules/case-assistant';
import { memo, useEffect, useMemo, useState, type RefObject } from 'react';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { cssVarV2 } from '@toeverything/theme/v2';

import * as styles from '../../case-assistant.css';
import * as localStyles from './analytics-dashboard-section.css';

// ─── Sub-Tab Navigation ──────────────────────────────────────────────────────

type DashboardTab =
  | 'overview'
  | 'errors'
  | 'performance'
  | 'geo'
  | 'features'
  | 'customers'
  | 'retention'
  | 'support';

const TAB_LABELS: Record<DashboardTab, string> = {
  overview: 'Übersicht',
  errors: 'Fehler-Monitor',
  performance: 'Performance',
  geo: 'Geo & Sessions',
  features: 'Feature-Nutzung',
  customers: 'Kunden-Health',
  retention: 'Retention',
  support: 'Premium Support',
};

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: 'Heute',
  '7d': '7 Tage',
  '30d': '30 Tage',
  '90d': '90 Tage',
  custom: 'Benutzerdefiniert',
};

const HEALTH_STATUS_STYLE: Record<CustomerHealthStatus, { accent: string; label: string }> = {
  healthy: { accent: cssVarV2('status/success'), label: '● Gesund' },
  'at-risk': { accent: cssVarV2('text/primary'), label: 'Gefährdet' },
  critical: { accent: cssVarV2('status/error'), label: 'Kritisch' },
  churned: { accent: cssVarV2('text/secondary'), label: '✕ Abgewandert' },
  new: { accent: cssVarV2('button/primary'), label: '★ Neu' },
};

const SEVERITY_STYLE: Record<ErrorSeverity, { accent: string; label: string }> = {
  critical: { accent: cssVarV2('status/error'), label: 'Kritisch' },
  high: { accent: cssVarV2('text/primary'), label: 'Hoch' },
  medium: { accent: cssVarV2('text/primary'), label: 'Mittel' },
  low: { accent: cssVarV2('text/secondary'), label: 'Niedrig' },
};

const PERF_RATING_STYLE: Record<PerformanceRating, { accent: string; label: string }> = {
  good: { accent: cssVarV2('status/success'), label: 'Gut' },
  'needs-improvement': { accent: cssVarV2('text/primary'), label: 'Verbesserungswürdig' },
  poor: { accent: cssVarV2('status/error'), label: 'Schlecht' },
};

const TREND_ICON: Record<string, string> = {
  up: '↑',
  stable: '→',
  down: '↓',
  growing: '↑',
  declining: '↓',
  new: 'Neu',
  increasing: '↑',
  decreasing: '↓',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  sectionRef: RefObject<HTMLElement | null>;

  // KPI data
  kpis: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    totalSessions: number;
    avgSessionDuration: number;
    bounceRate: number;
    totalPageViews: number;
    totalErrors: number;
    errorRate: number;
    avgLoadTime: number;
    customerHealthAvg: number;
    atRiskCustomers: number;
  } | null;

  // Period
  selectedPeriod: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;

  // Daily metrics (chart data)
  dailyMetrics: DailyActiveMetrics[];

  // Error monitoring
  errorGroups: ErrorGroup[];
  onResolveError: (fingerprint: string) => void;
  onUnresolveError: (fingerprint: string) => void;

  // Performance
  coreWebVitals: {
    lcp: { p75: number; rating: PerformanceRating };
    fid: { p75: number; rating: PerformanceRating };
    cls: { p75: number; rating: PerformanceRating };
    inp: { p75: number; rating: PerformanceRating };
    overall: PerformanceRating;
  } | null;
  avgLoadTime: number;

  // Geo
  geoDistribution: GeoDistribution[];
  deviceBreakdown: { desktop: number; tablet: number; mobile: number } | null;
  browserBreakdown: Record<string, number> | null;
  topReferrers: Array<{ source: string; count: number; percentage: number }>;
  sessionsByHour: Array<{ hour: number; count: number }>;

  // Features
  featureUsage: FeatureUsageRecord[];

  // Customer health
  customerHealth: CustomerHealthScore[];
  healthSummary: {
    totalCustomers: number;
    healthy: number;
    atRisk: number;
    critical: number;
    churned: number;
    avgScore: number;
    totalAlerts: number;
    criticalAlerts: number;
  } | null;
  onAcknowledgeAlert: (alertId: string) => void;

  // Retention
  retentionCohorts: RetentionCohort[];

  // Support console
  supportStatusSnapshot: {
    status: 'operational' | 'degraded' | 'major_outage';
    generatedAt: string;
    openIncidentCount: number;
  } | null;
  supportIncidents: Array<{
    id: string;
    severity: 'medium' | 'high' | 'critical';
    title: string;
    reason: string;
    triggeredAt: string;
    status: 'open' | 'acknowledged' | 'resolved';
  }>;
  supportAlerts: Array<{
    id: string;
    incidentId: string;
    severity: 'medium' | 'high' | 'critical';
    channel: 'email' | 'webhook';
    queuedAt: string;
    title: string;
  }>;
  supportAuditTrail: Array<{
    at: string;
    action: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
  }>;
  supportRetentionPolicy: {
    snapshotTtlDays: number;
    historyMaxItems: number;
    updatedAt: string;
  } | null;
  supportEscalationPolicy: {
    notifyOn: Array<'medium' | 'high' | 'critical'>;
    channels: Array<'email' | 'webhook'>;
    throttleMinutes: number;
    updatedAt: string;
  } | null;
  supportOpsError: string | null;
  isSavingSupportRetention: boolean;
  isSavingSupportEscalation: boolean;
  onSaveSupportRetentionPolicy: (payload: {
    snapshotTtlDays: number;
    historyMaxItems: number;
  }) => Promise<boolean>;
  onSaveSupportEscalationPolicy: (payload: {
    notifyOn: Array<'medium' | 'high' | 'critical'>;
    channels: Array<'email' | 'webhook'>;
    throttleMinutes: number;
  }) => Promise<boolean>;

  // Refresh
  onRefreshDashboard: () => void;
  isRefreshing: boolean;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const AnalyticsDashboardSection = memo((props: Props) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  return (
    <section ref={props.sectionRef} className={styles.section}>
      {/* Header */}
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Analytics & Monitoring</h3>
        <Button
          variant="plain"
          onClick={props.onRefreshDashboard}
          disabled={props.isRefreshing}
        >
          {props.isRefreshing ? 'Lade…' : 'Aktualisieren'}
        </Button>
      </div>

      {/* Period Selector */}
      <div className={localStyles.periodRow}>
        {(['today', '7d', '30d', '90d'] as AnalyticsPeriod[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => props.onPeriodChange(p)}
            className={
              props.selectedPeriod === p
                ? `${localStyles.pillButton} ${localStyles.pillButtonActive}`
                : localStyles.pillButton
            }
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className={localStyles.tabRow}>
        {(Object.keys(TAB_LABELS) as DashboardTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? `${localStyles.tabButton} ${localStyles.tabButtonActive}`
                : localStyles.tabButton
            }
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab {...props} />}
      {activeTab === 'errors' && <ErrorsTab {...props} />}
      {activeTab === 'performance' && <PerformanceTab {...props} />}
      {activeTab === 'geo' && <GeoTab {...props} />}
      {activeTab === 'features' && <FeaturesTab {...props} />}
      {activeTab === 'customers' && <CustomersTab {...props} />}
      {activeTab === 'retention' && <RetentionTab {...props} />}
      {activeTab === 'support' && <SupportTab {...props} />}
    </section>
  );
});

AnalyticsDashboardSection.displayName = 'AnalyticsDashboardSection';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

const OverviewTab = memo((props: Props) => {
  const kpis = props.kpis;
  if (!kpis) return <div className={styles.empty}>Lade Analytics-Daten…</div>;

  return (
    <div className={localStyles.contentStack}>
      {/* KPI Grid */}
      <div className={styles.metrics}>
        <KPICard label="Aktive Nutzer" value={formatNumber(kpis.activeUsers)} sub={`${kpis.newUsers} neu`} color={cssVarV2('button/primary')} />
        <KPICard label="Sessions" value={formatNumber(kpis.totalSessions)} sub={formatDuration(kpis.avgSessionDuration) + ' Ø'} color={cssVarV2('text/primary')} />
        <KPICard label="Seitenaufrufe" value={formatNumber(kpis.totalPageViews)} color={cssVarV2('text/primary')} />
        <KPICard label="Bounce Rate" value={formatPercent(kpis.bounceRate)} color={kpis.bounceRate > 0.5 ? cssVarV2('status/error') : cssVarV2('status/success')} />
        <KPICard label="Fehler" value={formatNumber(kpis.totalErrors)} sub={formatPercent(kpis.errorRate) + ' Rate'} color={kpis.totalErrors > 0 ? cssVarV2('status/error') : cssVarV2('status/success')} />
        <KPICard label="Ladezeit Ø" value={formatMs(kpis.avgLoadTime)} color={kpis.avgLoadTime > 3000 ? cssVarV2('status/error') : cssVarV2('status/success')} />
        <KPICard label="Kunden-Health Ø" value={formatPercent(kpis.customerHealthAvg)} color={kpis.customerHealthAvg < 0.5 ? cssVarV2('status/error') : cssVarV2('status/success')} />
        <KPICard label="Gefährdete Kunden" value={String(kpis.atRiskCustomers)} color={kpis.atRiskCustomers > 0 ? cssVarV2('text/primary') : cssVarV2('status/success')} />
      </div>

      {/* Daily Activity Sparkline */}
      {props.dailyMetrics.length > 0 && (
        <div className={localStyles.blockTop}>
          <div className={localStyles.sectionHeading}>
            Tägliche Aktivität ({props.dailyMetrics.length} Tage)
          </div>
          <DailyChart metrics={props.dailyMetrics} />
        </div>
      )}

      {/* Quick Error Summary */}
      {props.errorGroups.length > 0 && (
        <div className={localStyles.blockTop}>
          <div className={`${localStyles.sectionHeading} ${localStyles.sectionHeadingDanger}`}>
            Aktive Fehler ({props.errorGroups.filter(g => !g.isResolved).length})
          </div>
          {props.errorGroups.filter(g => !g.isResolved).slice(0, 3).map(g => (
            <ErrorGroupRow key={g.fingerprint} group={g} onResolve={props.onResolveError} compact />
          ))}
        </div>
      )}

      {/* Quick Health Alerts */}
      {props.healthSummary && props.healthSummary.criticalAlerts > 0 && (
        <div className={localStyles.alertBanner}>
          <div className={localStyles.alertTitle}>
            {props.healthSummary.criticalAlerts} kritische Kunden-Alerts
          </div>
        </div>
      )}
    </div>
  );
});
OverviewTab.displayName = 'OverviewTab';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

const ErrorsTab = memo((props: Props) => {
  const [showResolved, setShowResolved] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<ErrorSeverity | 'all'>('all');

  const filtered = useMemo(() => {
    let groups = props.errorGroups;
    if (!showResolved) groups = groups.filter(g => !g.isResolved);
    if (severityFilter !== 'all') groups = groups.filter(g => g.representativeError.severity === severityFilter);
    return groups;
  }, [props.errorGroups, showResolved, severityFilter]);

  const totalUnresolved = props.errorGroups.filter(g => !g.isResolved).length;
  const totalOccurrences = props.errorGroups.reduce((sum, g) => sum + g.totalOccurrences, 0);

  return (
    <div className={localStyles.contentStackTight}>
      {/* Error KPIs */}
      <div className={styles.metrics}>
        <KPICard label="Fehlergruppen" value={String(totalUnresolved)} sub="ungelöst" color={cssVarV2('status/error')} />
        <KPICard label="Vorfälle gesamt" value={formatNumber(totalOccurrences)} color={cssVarV2('text/primary')} />
        <KPICard label="Betroffene Nutzer" value={formatNumber(new Set(props.errorGroups.flatMap(g => g.representativeError.affectedUserIds)).size)} color={cssVarV2('text/primary')} />
      </div>

      {/* Filters */}
      <div className={localStyles.filterRow}>
        <button
          type="button"
          onClick={() => setShowResolved(!showResolved)}
          aria-pressed={showResolved}
          className={showResolved ? `${localStyles.pillButton} ${localStyles.pillButtonActive}` : localStyles.pillButton}
        >
          {showResolved ? '✓ Gelöste anzeigen' : 'Gelöste anzeigen'}
        </button>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverityFilter(s)}
            className={
              severityFilter === s
                ? `${localStyles.pillButton} ${localStyles.pillButtonActive}`
                : localStyles.pillButton
            }
          >
            {s === 'all' ? 'Alle' : SEVERITY_STYLE[s].label}
          </button>
        ))}
      </div>

      {/* Error List */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {totalUnresolved === 0 ? 'Keine aktiven Fehler — alles im grünen Bereich.' : 'Keine Fehler für diesen Filter.'}
        </div>
      ) : (
        <div className={localStyles.listStack}>
          {filtered.map(g => (
            <ErrorGroupRow
              key={g.fingerprint}
              group={g}
              onResolve={props.onResolveError}
              onUnresolve={props.onUnresolveError}
            />
          ))}
        </div>
      )}
    </div>
  );
});
ErrorsTab.displayName = 'ErrorsTab';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

const PerformanceTab = memo((props: Props) => {
  const cwv = props.coreWebVitals;

  return (
    <div className={localStyles.contentStack}>
      {/* Core Web Vitals */}
      <div className={localStyles.sectionHeading}>
        Core Web Vitals
        {cwv && (
          <span
            className={localStyles.tintBadge}
            style={assignInlineVars({
              [localStyles.accentColorVar]: PERF_RATING_STYLE[cwv.overall].accent,
            })}
          >
            {PERF_RATING_STYLE[cwv.overall].label}
          </span>
        )}
      </div>

      {cwv ? (
        <div className={styles.metrics}>
          <CWVCard name="LCP" value={formatMs(cwv.lcp.p75)} description="Largest Contentful Paint" rating={cwv.lcp.rating} target="< 2.5s" />
          <CWVCard name="FID" value={formatMs(cwv.fid.p75)} description="First Input Delay" rating={cwv.fid.rating} target="< 100ms" />
          <CWVCard name="CLS" value={cwv.cls.p75.toFixed(3)} description="Cumulative Layout Shift" rating={cwv.cls.rating} target="< 0.1" />
          <CWVCard name="INP" value={formatMs(cwv.inp.p75)} description="Interaction to Next Paint" rating={cwv.inp.rating} target="< 200ms" />
        </div>
      ) : (
        <div className={styles.empty}>Noch keine Performance-Daten gesammelt.</div>
      )}

      {/* Page Load */}
      <div className={localStyles.blockTop}>
        <div className={localStyles.mutedHeading}>
          Durchschnittliche Ladezeit: <strong>{formatMs(props.avgLoadTime)}</strong>
        </div>
      </div>
    </div>
  );
});
PerformanceTab.displayName = 'PerformanceTab';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GEO & SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

const GeoTab = memo((props: Props) => {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  return (
    <div className={localStyles.contentStack}>
      {/* Device Breakdown */}
      {props.deviceBreakdown && (
        <div>
          <div className={localStyles.sectionHeading}>Geräte-Verteilung</div>
          <div className={styles.metrics}>
            <KPICard label="Desktop" value={String(props.deviceBreakdown.desktop)} color={cssVarV2('text/primary')} />
            <KPICard label="Tablet" value={String(props.deviceBreakdown.tablet)} color={cssVarV2('text/primary')} />
            <KPICard label="Mobile" value={String(props.deviceBreakdown.mobile)} color={cssVarV2('text/primary')} />
          </div>
        </div>
      )}

      {/* Browser Breakdown */}
      {props.browserBreakdown && Object.keys(props.browserBreakdown).length > 0 && (
        <div>
          <div className={localStyles.sectionHeading}>Browser-Verteilung</div>
          <div className={localStyles.chipRow}>
            {Object.entries(props.browserBreakdown)
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([browser, count]) => (
                <span key={browser} className={localStyles.chip}>
                  {browser}: {count}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Session Heat Map by Hour */}
      {props.sessionsByHour.length > 0 && (
        <div>
          <div className={localStyles.sectionHeading}>Sessions nach Uhrzeit</div>
          <div className={`${localStyles.chartRow} ${localStyles.chartRowSessions}`}>
            {props.sessionsByHour.map(({ hour, count }) => {
              const max = Math.max(...props.sessionsByHour.map(h => h.count), 1);
              const height = Math.max(2, (count / max) * 48);
              const accent = cssVarV2('button/primary');
              return (
                <div
                  key={hour}
                  title={`${String(hour).padStart(2, '0')}:00 — ${count} Sessions`}
                  className={localStyles.chartBar}
                  style={assignInlineVars({
                    [localStyles.accentColorVar]: accent,
                    [localStyles.barHeightVar]: `${height}px`,
                  })}
                />
              );
            })}
          </div>
          <div className={localStyles.chartAxis}>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}

      {/* Geo Distribution */}
      <div>
        <div className={localStyles.sectionHeading}>
          Geo-Verteilung ({props.geoDistribution.length} Länder)
        </div>
        {props.geoDistribution.length === 0 ? (
          <div className={styles.empty}>Noch keine Geo-Daten verfügbar. Daten werden automatisch beim nächsten Besuch erfasst.</div>
        ) : (
          <div className={localStyles.listStack}>
            {props.geoDistribution.map(geo => (
              <div key={geo.countryCode}>
                <button
                  type="button"
                  onClick={() => setExpandedCountry(expandedCountry === geo.countryCode ? null : geo.countryCode)}
                  className={localStyles.geoButton}
                >
                  <span className={localStyles.geoFlag}>{countryFlag(geo.countryCode)}</span>
                  <span className={localStyles.geoCountry}>{geo.country}</span>
                  <span className={localStyles.geoMeta}>{geo.userCount} Nutzer</span>
                  <span className={localStyles.geoMeta}>{geo.sessionCount} Sessions</span>
                  <span className={localStyles.geoPercent}>{formatPercent(geo.percentage)}</span>
                  {/* Bar */}
                  <div className={localStyles.barTrack}>
                    <div
                      className={localStyles.barFill}
                      style={assignInlineVars({
                        [localStyles.accentColorVar]: cssVarV2('button/primary'),
                        [localStyles.barWidthVar]: `${geo.percentage * 100}%`,
                        [localStyles.barHeightVar]: '100%',
                      })}
                    />
                  </div>
                  <span className={localStyles.caret}>
                    {expandedCountry === geo.countryCode ? 'Schließen' : 'Öffnen'}
                  </span>
                </button>
                {expandedCountry === geo.countryCode && geo.cities.length > 0 && (
                  <div className={localStyles.geoCities}>
                    {geo.cities.slice(0, 10).map(city => (
                      <div key={`${city.city}-${city.region}`} className={localStyles.geoCityRow}>
                        <span className={localStyles.geoCityName}>
                          {city.city}{city.region ? `, ${city.region}` : ''}
                        </span>
                        <span className={localStyles.geoMeta}>{city.userCount} Nutzer</span>
                        <span className={localStyles.geoMeta}>{city.sessionCount} Sessions</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Referrers */}
      {props.topReferrers.length > 0 && (
        <div>
          <div className={localStyles.sectionHeading}>Top Referrer</div>
          <div className={localStyles.listStack}>
            {props.topReferrers.slice(0, 8).map(ref => (
              <div key={ref.source} className={localStyles.geoCityRow}>
                <span className={localStyles.geoCityName}>{ref.source}</span>
                <span className={localStyles.geoMeta}>{ref.count}x</span>
                <span className={localStyles.geoPercent}>{formatPercent(ref.percentage)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
GeoTab.displayName = 'GeoTab';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

const FeaturesTab = memo((props: Props) => {
  const [sortBy, setSortBy] = useState<'usage' | 'adoption' | 'users'>('usage');

  const sorted = useMemo(() => {
    const features = [...props.featureUsage];
    if (sortBy === 'usage') features.sort((a, b) => b.totalUsageCount - a.totalUsageCount);
    else if (sortBy === 'adoption') features.sort((a, b) => b.adoptionRate - a.adoptionRate);
    else features.sort((a, b) => b.uniqueUsers - a.uniqueUsers);
    return features;
  }, [props.featureUsage, sortBy]);

  return (
    <div className={localStyles.contentStackTight}>
      <div className={localStyles.headerRow}>
        <span className={localStyles.sectionHeading}>Feature-Nutzung ({props.featureUsage.length})</span>
        <div className={localStyles.headerRowSpacer}>
          {(['usage', 'adoption', 'users'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={
                sortBy === s
                  ? `${localStyles.microPill} ${localStyles.microPillActive}`
                  : localStyles.microPill
              }
            >
              {s === 'usage' ? 'Nutzung' : s === 'adoption' ? 'Adoption' : 'Nutzer'}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>Noch keine Feature-Nutzungsdaten erfasst.</div>
      ) : (
        <div className={localStyles.listStack}>
          {sorted.map(f => (
            <div key={f.featureId} className={localStyles.featureCard}>
              <div className={localStyles.featureTopRow}>
                <span className={localStyles.featureName}>{f.featureName}</span>
                <span className={localStyles.featureMeta}>{f.category}</span>
                <span className={localStyles.featureCount}>{f.totalUsageCount}x</span>
                <span className={localStyles.featureMeta}>{f.uniqueUsers} Nutzer</span>
                <span
                  className={localStyles.trendBadge}
                  style={assignInlineVars({
                    [localStyles.accentColorVar]:
                      f.trend === 'growing'
                        ? cssVarV2('status/success')
                        : f.trend === 'declining'
                          ? cssVarV2('status/error')
                          : cssVarV2('text/secondary'),
                  })}
                >
                  {TREND_ICON[f.trend] ?? ''} {f.trend === 'growing' ? 'Wachsend' : f.trend === 'declining' ? 'Rückläufig' : f.trend === 'new' ? 'Neu' : 'Stabil'}
                </span>
              </div>
              {/* Adoption bar */}
              <div className={localStyles.adoptionRow}>
                <span className={localStyles.adoptionLabel}>Adoption: {formatPercent(f.adoptionRate)}</span>
                <div className={localStyles.adoptionTrack}>
                  <div
                    className={localStyles.adoptionFill}
                    style={assignInlineVars({
                      [localStyles.barWidthVar]: `${Math.min(f.adoptionRate * 100, 100)}%`,
                    })}
                  />
                </div>
                {f.avgDurationMs !== undefined && (
                  <span className={localStyles.featureMeta}>Ø {formatMs(f.avgDurationMs)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
FeaturesTab.displayName = 'FeaturesTab';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

const CustomersTab = memo((props: Props) => {
  const [statusFilter, setStatusFilter] = useState<CustomerHealthStatus | 'all'>('all');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return props.customerHealth;
    return props.customerHealth.filter(c => c.status === statusFilter);
  }, [props.customerHealth, statusFilter]);

  const summary = props.healthSummary;

  return (
    <div className={localStyles.contentStackTight}>
      {/* Health Summary KPIs */}
      {summary && (
        <div className={styles.metrics}>
          <KPICard label="Kunden gesamt" value={String(summary.totalCustomers)} color={cssVarV2('text/primary')} />
          <KPICard label="● Gesund" value={String(summary.healthy)} color={cssVarV2('status/success')} />
          <KPICard label="Gefährdet" value={String(summary.atRisk)} color={cssVarV2('text/primary')} />
          <KPICard label="Kritisch" value={String(summary.critical)} color={cssVarV2('status/error')} />
          <KPICard label="✕ Abgewandert" value={String(summary.churned)} color={cssVarV2('text/secondary')} />
          <KPICard label="Ø Score" value={formatPercent(summary.avgScore)} color={cssVarV2('button/primary')} />
          <KPICard
            label="Alerts"
            value={String(summary.totalAlerts)}
            sub={`${summary.criticalAlerts} kritisch`}
            color={summary.criticalAlerts > 0 ? cssVarV2('status/error') : cssVarV2('text/primary')}
          />
        </div>
      )}

      {/* Status Filter */}
      <div className={localStyles.filterRow}>
        {(['all', 'critical', 'at-risk', 'healthy', 'churned', 'new'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={
              statusFilter === s
                ? `${localStyles.pillButton} ${localStyles.pillButtonActive}`
                : localStyles.pillButton
            }
          >
            {s === 'all' ? 'Alle' : HEALTH_STATUS_STYLE[s].label}
          </button>
        ))}
      </div>

      {/* Customer List */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>Keine Kunden für diesen Filter.</div>
      ) : (
        <div className={localStyles.listStack}>
          {filtered.map(c => {
            const hs = HEALTH_STATUS_STYLE[c.status];
            const isExpanded = expandedCustomer === (c.userId ?? c.workspaceId);
            return (
              <div
                key={c.userId ?? c.workspaceId}
                className={localStyles.tintCard}
                style={assignInlineVars({
                  [localStyles.accentColorVar]: hs.accent,
                  [localStyles.tintBgVar]: cssVarV2('layer/background/secondary'),
                })}
              >
                <button
                  type="button"
                  onClick={() => setExpandedCustomer(isExpanded ? null : (c.userId ?? c.workspaceId))}
                  className={localStyles.tintCardButton}
                >
                  <span className={localStyles.tintCardTitle}>
                    {c.customerName}
                  </span>
                  <span
                    className={localStyles.tintBadge}
                    style={assignInlineVars({ [localStyles.accentColorVar]: hs.accent })}
                  >
                    {hs.label}
                  </span>
                  <span className={localStyles.scorePercent} style={assignInlineVars({ [localStyles.accentColorVar]: hs.accent })}>{formatPercent(c.overallScore)}</span>
                  {c.alerts.length > 0 && (
                    <span className={localStyles.alertCountBadge}>
                      {c.alerts.filter(a => !a.acknowledgedAt).length} Alerts
                    </span>
                  )}
                  <span className={localStyles.caret}>{isExpanded ? 'Schließen' : 'Öffnen'}</span>
                </button>

                {isExpanded && (
                  <div className={localStyles.tintCardBody}>
                    {/* Score Breakdown */}
                    <div className={localStyles.scoreGrid}>
                      <ScoreBar label="Engagement" value={c.engagementScore} trend={c.trends.engagement} />
                      <ScoreBar label="Adoption" value={c.adoptionScore} />
                      <ScoreBar label="Fehler (inv.)" value={c.errorScore} trend={c.trends.errors} />
                      <ScoreBar label="Performance" value={c.performanceScore} />
                      <ScoreBar label="Retention" value={c.retentionScore} />
                    </div>

                    {/* Details */}
                    <div className={localStyles.detailMetaRow}>
                      <span>Sessions (30d): <strong>{c.totalSessions30d}</strong></span>
                      <span>Fehler (30d): <strong>{c.totalErrors30d}</strong></span>
                      <span>Ø Dauer: <strong>{formatDuration(c.avgSessionDuration30d)}</strong></span>
                      <span>Features: <strong>{c.featuresUsed30d}</strong></span>
                      <span>Inaktiv: <strong>{c.daysSinceLastActive}d</strong></span>
                      <span>Churn-Risiko: <strong>{formatPercent(c.churnRisk)}</strong></span>
                    </div>

                    {/* Alerts */}
                    {c.alerts.length > 0 && (
                      <div className={localStyles.listStack}>
                        {c.alerts.map(a => (
                          <div key={a.id} className={localStyles.alertRow}>
                            <span
                              className={localStyles.alertMessage}
                              style={assignInlineVars({
                                [localStyles.accentColorVar]: SEVERITY_STYLE[a.severity]?.accent ?? cssVarV2('text/primary'),
                              })}
                            >
                              {a.message}
                            </span>
                            {!a.acknowledgedAt ? (
                              <button
                                type="button"
                                onClick={() => props.onAcknowledgeAlert(a.id)}
                                className={localStyles.miniGhostButton}
                              >
                                ✓ OK
                              </button>
                            ) : (
                              <span className={localStyles.inlineMeta}>✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
CustomersTab.displayName = 'CustomersTab';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: RETENTION
// ═══════════════════════════════════════════════════════════════════════════════

const RetentionTab = memo((props: Props) => {
  const cohorts = props.retentionCohorts ?? [];
  const weekNumbers = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className={localStyles.contentStackTight}>
      <div className={localStyles.sectionHeading}>Retention-Kohorten (wöchentlich)</div>

      {/* Retention Table */}
      <div className={localStyles.retentionTableWrap}>
        <table className={localStyles.retentionTable}>
          <thead>
            <tr>
              <th className={localStyles.retentionTh}>Kohorte</th>
              <th className={`${localStyles.retentionTh} ${localStyles.retentionThCenter}`}>Größe</th>
              {weekNumbers.map(w => (
                <th key={w} className={localStyles.retentionThWeek}>W{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map(c => (
              <tr key={c.cohortDate}>
                <td className={localStyles.retentionTd}>{c.cohortDate}</td>
                <td className={`${localStyles.retentionTd} ${localStyles.retentionTdCenter}`}>{c.cohortSize}</td>
                {weekNumbers.map(w => {
                  const ret = c.retentionByWeek[w];
                  if (ret === undefined) {
                    return (
                      <td key={w} className={`${localStyles.retentionTd} ${localStyles.retentionTdCenter} ${localStyles.retentionTdEmpty}`}>
                        —
                      </td>
                    );
                  }
                  const opacity = ret * 0.6;
                  const bgColor = `color-mix(in srgb, ${cssVarV2('button/primary')} ${opacity * 100}%, transparent)`;
                  return (
                    <td
                      key={w}
                      className={`${localStyles.retentionTd} ${localStyles.retentionTdHeat}`}
                      style={assignInlineVars({
                        [localStyles.accentColorVar]: bgColor,
                      })}
                    >
                      {formatPercent(ret)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
RetentionTab.displayName = 'RetentionTab';

const SupportTab = memo((props: Props) => {
  const [retentionDraft, setRetentionDraft] = useState({
    snapshotTtlDays: props.supportRetentionPolicy?.snapshotTtlDays ?? 90,
    historyMaxItems: props.supportRetentionPolicy?.historyMaxItems ?? 120,
  });
  const [escalationDraft, setEscalationDraft] = useState({
    notifyOn: props.supportEscalationPolicy?.notifyOn ?? ['high', 'critical'],
    channels: props.supportEscalationPolicy?.channels ?? ['email'],
    throttleMinutes: props.supportEscalationPolicy?.throttleMinutes ?? 30,
  });

  useEffect(() => {
    if (!props.supportRetentionPolicy) return;
    setRetentionDraft({
      snapshotTtlDays: props.supportRetentionPolicy.snapshotTtlDays,
      historyMaxItems: props.supportRetentionPolicy.historyMaxItems,
    });
  }, [props.supportRetentionPolicy]);

  useEffect(() => {
    if (!props.supportEscalationPolicy) return;
    setEscalationDraft({
      notifyOn: props.supportEscalationPolicy.notifyOn,
      channels: props.supportEscalationPolicy.channels,
      throttleMinutes: props.supportEscalationPolicy.throttleMinutes,
    });
  }, [props.supportEscalationPolicy]);

  const hasSupportData =
    !!props.supportStatusSnapshot ||
    props.supportIncidents.length > 0 ||
    props.supportAlerts.length > 0 ||
    props.supportAuditTrail.length > 0 ||
    !!props.supportRetentionPolicy ||
    !!props.supportEscalationPolicy;

  const clampNumber = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

  const normalizedRetentionDraft = {
    snapshotTtlDays: Math.round(clampNumber(retentionDraft.snapshotTtlDays, 7, 365)),
    historyMaxItems: Math.round(clampNumber(retentionDraft.historyMaxItems, 30, 1000)),
  };
  const isRetentionDraftValid =
    Number.isFinite(retentionDraft.snapshotTtlDays) &&
    Number.isFinite(retentionDraft.historyMaxItems) &&
    retentionDraft.snapshotTtlDays >= 7 &&
    retentionDraft.snapshotTtlDays <= 365 &&
    retentionDraft.historyMaxItems >= 30 &&
    retentionDraft.historyMaxItems <= 1000;

  const normalizedEscalationDraft = {
    notifyOn: (escalationDraft.notifyOn.length
      ? escalationDraft.notifyOn
      : ['high', 'critical']) as Array<'medium' | 'high' | 'critical'>,
    channels: (escalationDraft.channels.length
      ? escalationDraft.channels
      : ['email']) as Array<'email' | 'webhook'>,
    throttleMinutes: Math.round(clampNumber(escalationDraft.throttleMinutes, 1, 240)),
  };
  const isEscalationDraftValid =
    Number.isFinite(escalationDraft.throttleMinutes) &&
    escalationDraft.throttleMinutes >= 1 &&
    escalationDraft.throttleMinutes <= 240;

  const statusColor =
    props.supportStatusSnapshot?.status === 'major_outage'
      ? cssVarV2('status/error')
      : props.supportStatusSnapshot?.status === 'degraded'
        ? cssVarV2('text/primary')
        : cssVarV2('status/success');

  return (
    <div className={localStyles.contentStack}>
      {props.supportOpsError ? (
        <div className={localStyles.alertBanner}>
          {props.supportOpsError}
        </div>
      ) : null}

      {!hasSupportData && props.isRefreshing ? (
        <div className={styles.empty}>Lade Premium-Support-Daten…</div>
      ) : null}

      {!hasSupportData && !props.isRefreshing ? (
        <div className={styles.empty}>
          Noch keine Premium-Support-Daten verfügbar. Bitte Dashboard aktualisieren.
        </div>
      ) : null}

      {props.supportStatusSnapshot ? (
        <div
          className={localStyles.statusBanner}
          style={assignInlineVars({ [localStyles.accentColorVar]: statusColor })}
        >
          <span
            className={localStyles.statusLabel}
            style={assignInlineVars({ [localStyles.accentColorVar]: statusColor })}
          >
            Status: {props.supportStatusSnapshot.status}
          </span>
          <span className={localStyles.statusMeta}>
            Offene Incidents: {props.supportStatusSnapshot.openIncidentCount}
          </span>
          <span className={localStyles.statusMetaAuto}>
            {new Date(props.supportStatusSnapshot.generatedAt).toLocaleString('de-DE')}
          </span>
        </div>
      ) : null}

      <div className={styles.metrics}>
        <KPICard
          label="Offene Incidents"
          value={String(
            props.supportIncidents.filter(i => i.status !== 'resolved').length
          )}
          color={cssVarV2('status/error')}
        />
        <KPICard
          label="Alert Queue"
          value={String(props.supportAlerts.length)}
          color={cssVarV2('text/primary')}
        />
        <KPICard
          label="Audit Events"
          value={String(props.supportAuditTrail.length)}
          color={cssVarV2('button/primary')}
        />
      </div>

      <div className={localStyles.policyGrid}>
        <div className={localStyles.policyCard}>
          <div className={localStyles.policyHeading}>
            Retention Policy
          </div>
          <div className={localStyles.policyStack}>
            <label className={localStyles.policyLabel}>
              Snapshot TTL (Tage)
              <input
                type="number"
                min={7}
                max={365}
                value={retentionDraft.snapshotTtlDays}
                onChange={e =>
                  setRetentionDraft(prev => ({
                    ...prev,
                    snapshotTtlDays: Number(e.target.value),
                  }))
                }
                className={localStyles.policyInput}
              />
            </label>
            <label className={localStyles.policyLabel}>
              History Max Items
              <input
                type="number"
                min={30}
                max={1000}
                value={retentionDraft.historyMaxItems}
                onChange={e =>
                  setRetentionDraft(prev => ({
                    ...prev,
                    historyMaxItems: Number(e.target.value),
                  }))
                }
                className={localStyles.policyInput}
              />
            </label>
            <Button
              variant="primary"
              disabled={
                props.isRefreshing ||
                props.isSavingSupportRetention ||
                !isRetentionDraftValid
              }
              onClick={() => {
                void props.onSaveSupportRetentionPolicy(normalizedRetentionDraft);
              }}
            >
              {props.isSavingSupportRetention ? 'Speichert…' : 'Retention speichern'}
            </Button>
            {!isRetentionDraftValid ? (
              <div className={localStyles.policyError}>
                Bitte gültige Werte setzen (TTL 7-365, History 30-1000).
              </div>
            ) : null}
          </div>
        </div>

        <div className={localStyles.policyCard}>
          <div className={localStyles.policyHeading}>
            Escalation Policy
          </div>
          <div className={localStyles.policyStack}>
            <label className={localStyles.policyLabel}>
              Notify On
              <div className={localStyles.chipRow}>
                {(['medium', 'high', 'critical'] as const).map(severity => {
                  const active = escalationDraft.notifyOn.includes(severity);
                  return (
                    <button
                      key={severity}
                      type="button"
                      onClick={() => {
                        setEscalationDraft(prev => ({
                          ...prev,
                          notifyOn: active
                            ? prev.notifyOn.filter(s => s !== severity)
                            : [...prev.notifyOn, severity],
                        }));
                      }}
                      className={
                        active
                          ? `${localStyles.microPill} ${localStyles.microPillActive}`
                          : localStyles.microPill
                      }
                    >
                      {severity}
                    </button>
                  );
                })}
              </div>
            </label>
            <label className={localStyles.policyLabel}>
              Channels
              <div className={localStyles.chipRow}>
                {(['email', 'webhook'] as const).map(channel => {
                  const active = escalationDraft.channels.includes(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => {
                        setEscalationDraft(prev => ({
                          ...prev,
                          channels: active
                            ? prev.channels.filter(c => c !== channel)
                            : [...prev.channels, channel],
                        }));
                      }}
                      className={
                        active
                          ? `${localStyles.microPill} ${localStyles.microPillActive}`
                          : localStyles.microPill
                      }
                    >
                      {channel}
                    </button>
                  );
                })}
              </div>
            </label>
            <label className={localStyles.policyLabel}>
              Throttle (Min.)
              <input
                type="number"
                min={1}
                max={240}
                value={escalationDraft.throttleMinutes}
                onChange={e =>
                  setEscalationDraft(prev => ({
                    ...prev,
                    throttleMinutes: Number(e.target.value),
                  }))
                }
                className={localStyles.policyInput}
              />
            </label>
            <Button
              variant="primary"
              disabled={
                props.isRefreshing ||
                props.isSavingSupportEscalation ||
                !isEscalationDraftValid
              }
              onClick={() => {
                void props.onSaveSupportEscalationPolicy(normalizedEscalationDraft);
              }}
            >
              {props.isSavingSupportEscalation ? 'Speichert…' : 'Eskalation speichern'}
            </Button>
            {!isEscalationDraftValid ? (
              <div className={localStyles.policyError}>
                Bitte gültigen Throttle-Wert setzen (1-240 Minuten).
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={localStyles.policyGrid}>
        <div>
          <div className={localStyles.sectionHeading}>
            Aktive Incidents
          </div>
          {props.supportIncidents.length === 0 ? (
            <div className={styles.empty}>Keine Incidents.</div>
          ) : (
            <div className={localStyles.listStack}>
              {props.supportIncidents.slice(0, 8).map(incident => {
                const severityColor =
                  incident.severity === 'critical'
                    ? cssVarV2('status/error')
                    : incident.severity === 'high'
                      ? cssVarV2('text/primary')
                      : cssVarV2('button/primary');
                return (
                  <div key={incident.id} className={localStyles.incidentCard}>
                    <div className={localStyles.incidentTopRow}>
                      <span className={localStyles.incidentTitle}>{incident.title}</span>
                      <span
                        className={localStyles.incidentSeverityBadge}
                        style={assignInlineVars({ [localStyles.accentColorVar]: severityColor })}
                      >
                        {incident.severity}
                      </span>
                      <span className={localStyles.incidentStatus}>{incident.status}</span>
                    </div>
                    <div className={localStyles.incidentMeta}>
                      {new Date(incident.triggeredAt).toLocaleString('de-DE')} · {incident.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className={localStyles.sectionHeading}>
            Alert Queue
          </div>
          {props.supportAlerts.length === 0 ? (
            <div className={styles.empty}>Keine Alerts in Queue.</div>
          ) : (
            <div className={localStyles.listStack}>
              {props.supportAlerts.slice(0, 8).map(alert => (
                <div key={alert.id} className={localStyles.incidentCard}>
                  <div className={localStyles.incidentTopRow}>
                    <span className={localStyles.incidentTitle}>{alert.title}</span>
                    <span className={localStyles.incidentStatus}>{alert.channel}</span>
                  </div>
                  <div className={localStyles.incidentMeta}>
                    {new Date(alert.queuedAt).toLocaleString('de-DE')} · Incident {alert.incidentId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className={localStyles.sectionHeading}>
          Zugriffsaudit (letzte Events)
        </div>
        {props.supportAuditTrail.length === 0 ? (
          <div className={styles.empty}>Keine Audit-Events vorhanden.</div>
        ) : (
          <div className={localStyles.auditTableWrap}>
            <table className={localStyles.auditTable}>
              <thead>
                <tr>
                  <th className={localStyles.auditTh}>Zeit</th>
                  <th className={localStyles.auditTh}>Aktion</th>
                  <th className={localStyles.auditTh}>User</th>
                  <th className={localStyles.auditTh}>IP</th>
                </tr>
              </thead>
              <tbody>
                {props.supportAuditTrail.slice(0, 12).map((entry, idx) => (
                  <tr key={`${entry.at}-${entry.action}-${idx}`}>
                    <td className={localStyles.auditTd}>
                      {new Date(entry.at).toLocaleString('de-DE')}
                    </td>
                    <td className={localStyles.auditTd}>{entry.action}</td>
                    <td className={localStyles.auditTd}>{entry.userId ?? '—'}</td>
                    <td className={localStyles.auditTd}>{entry.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});
SupportTab.displayName = 'SupportTab';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const KPICard = memo(({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
  <div className={styles.metricCard}>
    <div className={styles.metricLabel}>{label}</div>
    <div className={localStyles.kpiValue} style={assignInlineVars({ [localStyles.accentColorVar]: color })}>
      {value}
    </div>
    {sub && <div className={localStyles.kpiSub}>{sub}</div>}
  </div>
));
KPICard.displayName = 'KPICard';

const CWVCard = memo(({ name, value, description, rating, target }: {
  name: string; value: string; description: string; rating: PerformanceRating; target: string;
}) => {
  const style = PERF_RATING_STYLE[rating];
  return (
    <div
      className={localStyles.tintCard}
      style={assignInlineVars({
        [localStyles.accentColorVar]: style.accent,
        [localStyles.tintBgVar]: cssVarV2('layer/background/secondary'),
      })}
    >
      <div className={localStyles.tintCardBody}>
        <div className={localStyles.sectionHeading}>{name}</div>
        <div className={styles.metricValue} style={assignInlineVars({ [localStyles.accentColorVar]: style.accent })}>
          {value}
        </div>
        <div className={localStyles.kpiSub}>{description}</div>
        <div className={localStyles.inlineMeta}>
          <span style={assignInlineVars({ [localStyles.accentColorVar]: style.accent })}>
            {style.label}
          </span>
          <span> · Ziel: {target}</span>
        </div>
      </div>
    </div>
  );
});
CWVCard.displayName = 'CWVCard';

const ErrorGroupRow = memo(({ group, onResolve, onUnresolve, compact }: {
  group: ErrorGroup;
  onResolve: (fp: string) => void;
  onUnresolve?: (fp: string) => void;
  compact?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const err = group.representativeError;
  const sev = SEVERITY_STYLE[err.severity];

  return (
    <div
      className={localStyles.tintCard}
      style={assignInlineVars({
        [localStyles.accentColorVar]: sev.accent,
        [localStyles.tintBgVar]: cssVarV2('layer/background/secondary'),
      })}
    >
      <button
        type="button"
        onClick={() => !compact && setExpanded(!expanded)}
        className={localStyles.tintCardButton}
      >
        <span
          className={localStyles.tintBadge}
          style={assignInlineVars({ [localStyles.accentColorVar]: sev.accent })}
        >
          {sev.label}
        </span>
        <span className={localStyles.tintCardTitle}>
          {err.message}
        </span>
        <span className={localStyles.inlineMeta}>{group.totalOccurrences}x</span>
        <span className={localStyles.inlineMeta}>{group.affectedUsers} Nutzer</span>
        {group.trend !== 'stable' && (
          <span
            className={localStyles.trendBadge}
            style={assignInlineVars({
              [localStyles.accentColorVar]:
                group.trend === 'increasing'
                  ? cssVarV2('status/error')
                  : group.trend === 'new'
                    ? cssVarV2('text/primary')
                    : cssVarV2('status/success'),
            })}
          >
            {TREND_ICON[group.trend] ?? ''} {group.trend === 'increasing' ? 'Steigend' : group.trend === 'new' ? 'Neu' : 'Sinkend'}
          </span>
        )}
        {!compact && <span className={localStyles.caret}>{expanded ? 'Schließen' : 'Öffnen'}</span>}
      </button>

      {expanded && !compact && (
        <div className={localStyles.tintCardBody}>
          <div className={localStyles.detailMetaRow}>
            <span>Kategorie: <strong>{err.category}</strong></span>
            <span>Erste Meldung: <strong>{new Date(group.firstSeenAt).toLocaleDateString('de-DE')}</strong></span>
            <span>Letzte: <strong>{new Date(group.lastSeenAt).toLocaleDateString('de-DE')}</strong></span>
            {err.componentName && <span>Komponente: <strong>{err.componentName}</strong></span>}
            {err.url && <span>URL: <strong>{err.url}</strong></span>}
          </div>
          {err.stack && (
            <pre className={localStyles.codeBlock}>
              {err.stack}
            </pre>
          )}
          <div className={localStyles.inlineActionRow}>
            {!group.isResolved ? (
              <button
                type="button"
                onClick={() => onResolve(group.fingerprint)}
                className={`${localStyles.miniButton} ${localStyles.miniButtonPositive}`}
              >
                ✓ Als gelöst markieren
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onUnresolve?.(group.fingerprint)}
                className={localStyles.miniGhostButton}
              >
                Wiedereröffnen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
ErrorGroupRow.displayName = 'ErrorGroupRow';

const ScoreBar = memo(({ label, value, trend }: { label: string; value: number; trend?: 'up' | 'stable' | 'down' }) => {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75
      ? cssVarV2('status/success')
      : pct >= 50
        ? cssVarV2('text/primary')
        : cssVarV2('status/error');
  const trendColor = trend === 'up' ? cssVarV2('status/success') : trend === 'down' ? cssVarV2('status/error') : cssVarV2('text/secondary');
  return (
    <div className={localStyles.inlineMeta}>
      <div className={localStyles.scoreBarRow}>
        <span>{label}</span>
        <span className={localStyles.scorePercent} style={assignInlineVars({ [localStyles.accentColorVar]: color })}>
          {pct}%
          {trend && (
            <span
              className={localStyles.scoreTrendIcon}
              style={assignInlineVars({ [localStyles.accentColorVar]: trendColor })}
            >
              {TREND_ICON[trend]}
            </span>
          )}
        </span>
      </div>
      <div className={localStyles.barTrack}>
        <div
          className={localStyles.barFill}
          style={assignInlineVars({
            [localStyles.accentColorVar]: color,
            [localStyles.barWidthVar]: `${pct}%`,
            [localStyles.barHeightVar]: '100%',
          })}
        />
      </div>
    </div>
  );
});
ScoreBar.displayName = 'ScoreBar';

const DailyChart = memo(({ metrics }: { metrics: DailyActiveMetrics[] }) => {
  const maxSessions = Math.max(...metrics.map(m => m.totalSessions), 1);
  return (
    <div className={`${localStyles.chartRow} ${localStyles.chartRowDaily}`}>
      {metrics.map(m => {
        const heightPx = Math.max(2, (m.totalSessions / maxSessions) * 38);
        const hasErrors = m.totalErrors > 0;
        const barColor = hasErrors ? cssVarV2('text/primary') : cssVarV2('button/primary');
        return (
          <div
            key={m.date}
            title={`${m.date}: ${m.totalSessions} Sessions, ${m.dau} DAU, ${m.totalErrors} Fehler`}
            className={localStyles.chartBar}
            style={assignInlineVars({
              [localStyles.accentColorVar]: barColor,
              [localStyles.barHeightVar]: `${heightPx}px`,
            })}
          />
        );
      })}
    </div>
  );
});
DailyChart.displayName = 'DailyChart';

function countryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const offset = 0x1F1E6;
  const A = 'A'.charCodeAt(0);
  const first = countryCode.charCodeAt(0) - A + offset;
  const second = countryCode.charCodeAt(1) - A + offset;
  return String.fromCodePoint(first) + String.fromCodePoint(second);
}
