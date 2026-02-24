import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { AnalyticsCollectorService } from './analytics-collector';
import type { ErrorMonitoringService } from './error-monitoring';
import type { GeoSessionAnalyticsService } from './geo-session-analytics';
import type { PerformanceMonitorService } from './performance-monitor';
import type { BusinessIntelligenceService } from './business-intelligence';
import type {
  AnalyticsSession,
  CustomerHealthAlert,
  CustomerHealthScore,
  CustomerHealthStatus,
  ErrorSeverity,
} from '../types';

const HEALTH_WEIGHTS = {
  engagement: 0.25,
  adoption: 0.20,
  error: 0.20,
  performance: 0.15,
  retention: 0.20,
};

const INACTIVITY_THRESHOLDS_DAYS = {
  warning: 7,
  critical: 14,
  churned: 30,
};

const ERROR_SPIKE_THRESHOLD = 3; // 3x increase = spike
const USAGE_DROP_THRESHOLD = 0.5; // 50% drop = significant

function generateAlertId(): string {
  return `ha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function scoreToStatus(score: number, daysSinceActive: number): CustomerHealthStatus {
  if (daysSinceActive >= INACTIVITY_THRESHOLDS_DAYS.churned) return 'churned';
  if (score >= 0.75) return 'healthy';
  if (score >= 0.5) return 'at-risk';
  return 'critical';
}

function trendDirection(current: number, previous: number): 'up' | 'stable' | 'down' {
  if (current > previous * 1.15) return 'up';
  if (current < previous * 0.85) return 'down';
  return 'stable';
}

export class CustomerHealthService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    readonly _collector: AnalyticsCollectorService,
    private readonly errorMonitoring: ErrorMonitoringService,
    readonly _geoSession: GeoSessionAnalyticsService,
    private readonly perfMonitor: PerformanceMonitorService,
    private readonly bizIntel: BusinessIntelligenceService
  ) {
    super();
  }

  // ─── Health Score Computation ──────────────────────────────────────────────

  computeHealthScores(): CustomerHealthScore[] {
    const sessions = this.store.getAnalyticsSessions?.() ?? [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    // Group sessions by user/workspace
    const userSessions = new Map<string, AnalyticsSession[]>();
    for (const s of sessions) {
      const key = s.userId ?? s.workspaceId;
      const existing = userSessions.get(key) ?? [];
      existing.push(s);
      userSessions.set(key, existing);
    }

    const errorsByUser = this.errorMonitoring.getErrorCountByCustomer();
    const errorMap = new Map(errorsByUser.map(e => [e.userId, e]));
    const featureUsage = this.bizIntel.getFeatureUsage('30d');
    const totalFeatures = featureUsage.length;

    const scores: CustomerHealthScore[] = [];

    for (const [userId, allSessions] of userSessions) {
      const recent30d = allSessions.filter(s => new Date(s.startedAt).getTime() >= thirtyDaysAgo);
      const previous30d = allSessions.filter(s => {
        const t = new Date(s.startedAt).getTime();
        return t >= sixtyDaysAgo && t < thirtyDaysAgo;
      });

      const lastSession = allSessions.sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      )[0];
      const lastActiveAt = lastSession?.lastActivityAt ?? new Date(0).toISOString();
      const daysSinceLastActive = Math.floor((now - new Date(lastActiveAt).getTime()) / (24 * 60 * 60 * 1000));

      // ── Engagement Score (session count + duration) ───
      const recentSessionCount = recent30d.length;
      const previousSessionCount = previous30d.length;
      const avgDuration30d = recent30d.length > 0
        ? recent30d.reduce((sum, s) => sum + s.duration, 0) / recent30d.length
        : 0;

      // Normalize: 1 session/day = healthy (30 sessions/30d)
      const sessionFreqScore = clamp01(recentSessionCount / 30);
      // Normalize: 5min avg = healthy
      const durationScore = clamp01(avgDuration30d / (5 * 60 * 1000));
      const engagementScore = clamp01(sessionFreqScore * 0.6 + durationScore * 0.4);

      // ── Adoption Score (features used) ───
      const userFeatures = new Set<string>();
      const events = this.store.getAnalyticsEvents?.() ?? [];
      for (const e of events) {
        if (
          e.category === 'feature_usage' &&
          (e.userId === userId || (!e.userId && e.sessionId && recent30d.some(s => s.id === e.sessionId))) &&
          new Date(e.timestamp).getTime() >= thirtyDaysAgo
        ) {
          userFeatures.add(e.action);
        }
      }
      const featuresUsed30d = userFeatures.size;
      const adoptionScore = totalFeatures > 0 ? clamp01(featuresUsed30d / Math.max(totalFeatures * 0.5, 1)) : 0.5;

      // ── Error Score (inverse: fewer errors = higher score) ───
      const userErrors = errorMap.get(userId);
      const totalErrors30d = userErrors?.errorCount ?? 0;
      const criticalErrors = userErrors?.criticalCount ?? 0;
      // 0 errors = 1.0, 10+ errors = 0.0
      const rawErrorScore = 1 - clamp01(totalErrors30d / 10);
      // Critical errors have extra penalty
      const criticalPenalty = clamp01(criticalErrors * 0.15);
      const errorScore = clamp01(rawErrorScore - criticalPenalty);

      // ── Performance Score ───
      const cwv = this.perfMonitor.getCoreWebVitalsScore('30d');
      let performanceScore = 0.7; // Default decent
      if (cwv.overall === 'good') performanceScore = 1.0;
      else if (cwv.overall === 'needs-improvement') performanceScore = 0.5;
      else if (cwv.overall === 'poor') performanceScore = 0.2;

      // ── Retention Score ───
      const isReturning = recent30d.some(s => s.isReturning);
      const daysSinceScore = clamp01(1 - daysSinceLastActive / 30);
      const retentionScore = clamp01(
        (isReturning ? 0.5 : 0) + daysSinceScore * 0.5
      );

      // ── Overall ───
      const overallScore = clamp01(
        engagementScore * HEALTH_WEIGHTS.engagement +
        adoptionScore * HEALTH_WEIGHTS.adoption +
        errorScore * HEALTH_WEIGHTS.error +
        performanceScore * HEALTH_WEIGHTS.performance +
        retentionScore * HEALTH_WEIGHTS.retention
      );

      const status = scoreToStatus(overallScore, daysSinceLastActive);

      // ── Trends ───
      const engagementTrend = trendDirection(recentSessionCount, previousSessionCount);
      const previousErrors = previous30d.reduce((sum, s) => sum + s.errorCount, 0);
      const recentErrors = recent30d.reduce((sum, s) => sum + s.errorCount, 0);
      const errorTrend = trendDirection(recentErrors, previousErrors);
      // For errors, "up" is bad, so we invert for display
      const usageTrend = trendDirection(
        recent30d.reduce((sum, s) => sum + s.eventCount, 0),
        previous30d.reduce((sum, s) => sum + s.eventCount, 0)
      );

      // ── Churn Risk ───
      const churnRisk = clamp01(1 - overallScore);

      // ── Alerts ───
      const alerts: CustomerHealthAlert[] = [];
      const alertNow = new Date().toISOString();

      // Error spike
      if (previousErrors > 0 && recentErrors > previousErrors * ERROR_SPIKE_THRESHOLD) {
        alerts.push({
          id: generateAlertId(),
          type: 'error_spike',
          severity: recentErrors > previousErrors * 5 ? 'critical' : 'high',
          message: `Fehler-Anstieg: ${previousErrors} → ${recentErrors} Fehler (${Math.round(recentErrors / previousErrors)}x)`,
          metric: 'errors_30d',
          threshold: previousErrors * ERROR_SPIKE_THRESHOLD,
          currentValue: recentErrors,
          triggeredAt: alertNow,
        });
      }

      // Usage drop
      if (previousSessionCount > 3 && recentSessionCount < previousSessionCount * USAGE_DROP_THRESHOLD) {
        alerts.push({
          id: generateAlertId(),
          type: 'usage_drop',
          severity: 'medium',
          message: `Nutzungsrückgang: ${previousSessionCount} → ${recentSessionCount} Sessions (-${Math.round((1 - recentSessionCount / previousSessionCount) * 100)}%)`,
          metric: 'sessions_30d',
          threshold: previousSessionCount * USAGE_DROP_THRESHOLD,
          currentValue: recentSessionCount,
          triggeredAt: alertNow,
        });
      }

      // Inactivity
      if (daysSinceLastActive >= INACTIVITY_THRESHOLDS_DAYS.warning) {
        const severity: ErrorSeverity = daysSinceLastActive >= INACTIVITY_THRESHOLDS_DAYS.critical ? 'high' : 'medium';
        alerts.push({
          id: generateAlertId(),
          type: 'inactivity',
          severity,
          message: `Inaktiv seit ${daysSinceLastActive} Tagen`,
          metric: 'days_since_active',
          threshold: INACTIVITY_THRESHOLDS_DAYS.warning,
          currentValue: daysSinceLastActive,
          triggeredAt: alertNow,
        });
      }

      // Churn risk
      if (churnRisk >= 0.7) {
        alerts.push({
          id: generateAlertId(),
          type: 'churn_risk',
          severity: churnRisk >= 0.85 ? 'critical' : 'high',
          message: `Hohe Abwanderungsgefahr (${Math.round(churnRisk * 100)}%)`,
          metric: 'churn_risk',
          threshold: 0.7,
          currentValue: churnRisk,
          triggeredAt: alertNow,
        });
      }

      // Performance degradation
      if (cwv.overall === 'poor') {
        alerts.push({
          id: generateAlertId(),
          type: 'performance_degradation',
          severity: 'medium',
          message: `Schlechte Core Web Vitals (LCP: ${Math.round(cwv.lcp.p75)}ms)`,
          metric: 'cwv_overall',
          triggeredAt: alertNow,
        });
      }

      // Feature abandonment (used features before, now not)
      if (featuresUsed30d === 0 && previousSessionCount > 5) {
        alerts.push({
          id: generateAlertId(),
          type: 'feature_abandonment',
          severity: 'medium',
          message: 'Keine Feature-Nutzung in den letzten 30 Tagen trotz vorheriger Aktivität',
          metric: 'features_used_30d',
          threshold: 1,
          currentValue: 0,
          triggeredAt: alertNow,
        });
      }

      scores.push({
        workspaceId: allSessions[0]?.workspaceId ?? '',
        userId,
        customerName: userId,
        overallScore,
        status,
        engagementScore,
        adoptionScore,
        errorScore,
        performanceScore,
        retentionScore,
        lastActiveAt,
        daysSinceLastActive,
        totalSessions30d: recentSessionCount,
        totalErrors30d,
        avgSessionDuration30d: avgDuration30d,
        featuresUsed30d,
        churnRisk,
        trends: {
          engagement: engagementTrend,
          errors: errorTrend,
          usage: usageTrend,
        },
        alerts,
        computedAt: alertNow,
      });
    }

    // Sort: critical first, then at-risk, then healthy
    const statusOrder: Record<CustomerHealthStatus, number> = {
      critical: 0,
      'at-risk': 1,
      churned: 2,
      new: 3,
      healthy: 4,
    };

    scores.sort((a, b) => {
      const statusDiff = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
      if (statusDiff !== 0) return statusDiff;
      return a.overallScore - b.overallScore;
    });

    // Persist
    this.store.setCustomerHealthScores?.(scores);

    return scores;
  }

  // ─── Query API ─────────────────────────────────────────────────────────────

  getHealthScores(): CustomerHealthScore[] {
    return this.store.getCustomerHealthScores?.() ?? [];
  }

  getAtRiskCustomers(): CustomerHealthScore[] {
    return this.getHealthScores().filter(s => s.status === 'at-risk' || s.status === 'critical');
  }

  getChurnedCustomers(): CustomerHealthScore[] {
    return this.getHealthScores().filter(s => s.status === 'churned');
  }

  getHealthyCustomers(): CustomerHealthScore[] {
    return this.getHealthScores().filter(s => s.status === 'healthy');
  }

  getCustomerHealth(userId: string): CustomerHealthScore | null {
    return this.getHealthScores().find(s => s.userId === userId) ?? null;
  }

  getAverageHealthScore(): number {
    const scores = this.getHealthScores();
    if (scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;
  }

  getAllAlerts(): CustomerHealthAlert[] {
    return this.getHealthScores().flatMap(s => s.alerts);
  }

  getUnacknowledgedAlerts(): CustomerHealthAlert[] {
    return this.getAllAlerts().filter(a => !a.acknowledgedAt);
  }

  getCriticalAlerts(): CustomerHealthAlert[] {
    return this.getAllAlerts().filter(a => a.severity === 'critical' && !a.acknowledgedAt);
  }

  acknowledgeAlert(alertId: string): void {
    const scores = this.getHealthScores();
    const now = new Date().toISOString();
    const updated = scores.map(s => ({
      ...s,
      alerts: s.alerts.map(a =>
        a.id === alertId ? { ...a, acknowledgedAt: now } : a
      ),
    }));
    this.store.setCustomerHealthScores?.(updated);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  getHealthSummary(): {
    totalCustomers: number;
    healthy: number;
    atRisk: number;
    critical: number;
    churned: number;
    avgScore: number;
    totalAlerts: number;
    criticalAlerts: number;
  } {
    const scores = this.getHealthScores();
    return {
      totalCustomers: scores.length,
      healthy: scores.filter(s => s.status === 'healthy').length,
      atRisk: scores.filter(s => s.status === 'at-risk').length,
      critical: scores.filter(s => s.status === 'critical').length,
      churned: scores.filter(s => s.status === 'churned').length,
      avgScore: this.getAverageHealthScore(),
      totalAlerts: this.getAllAlerts().length,
      criticalAlerts: this.getCriticalAlerts().length,
    };
  }
}
