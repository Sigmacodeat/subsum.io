import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { AnalyticsCollectorService as _AnalyticsCollectorService } from './analytics-collector';
import type { ErrorMonitoringService as _ErrorMonitoringService } from './error-monitoring';
import type { GeoSessionAnalyticsService as _GeoSessionAnalyticsService } from './geo-session-analytics';
import type {
  AnalyticsEvent,
  AnalyticsPeriod,
  AnalyticsSession,
  DailyActiveMetrics,
  FeatureUsageRecord,
  RetentionCohort,
} from '../types';

function periodToMs(period: AnalyticsPeriod): number {
  switch (period) {
    case 'today': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    case '90d': return 90 * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

function toDateKey(ts: string | number): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return d.toISOString().slice(0, 10);
}

export class BusinessIntelligenceService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    readonly collector: _AnalyticsCollectorService,
    readonly errorMonitoring: _ErrorMonitoringService,
    readonly geoSession: _GeoSessionAnalyticsService
  ) {
    super();
  }

  // ─── DAU / WAU / MAU ──────────────────────────────────────────────────────

  getDAU(date?: string): number {
    const targetDate = date ?? toDateKey(Date.now());
    const sessions = this.getSessions();
    const uniqueUsers = new Set<string>();
    for (const s of sessions) {
      if (toDateKey(s.startedAt) === targetDate && s.userId) {
        uniqueUsers.add(s.userId);
      }
    }
    return uniqueUsers.size || this.getSessionsForDate(targetDate).length;
  }

  getWAU(endDate?: string): number {
    const end = endDate ?? toDateKey(Date.now());
    const endMs = new Date(end).getTime() + 24 * 60 * 60 * 1000;
    const startMs = endMs - 7 * 24 * 60 * 60 * 1000;
    return this.getUniqueUsersInRange(startMs, endMs);
  }

  getMAU(endDate?: string): number {
    const end = endDate ?? toDateKey(Date.now());
    const endMs = new Date(end).getTime() + 24 * 60 * 60 * 1000;
    const startMs = endMs - 30 * 24 * 60 * 60 * 1000;
    return this.getUniqueUsersInRange(startMs, endMs);
  }

  getStickiness(_period: AnalyticsPeriod = '30d'): number {
    const dau = this.getDAU();
    const mau = this.getMAU();
    if (mau === 0) return 0;
    return dau / mau;
  }

  // ─── Daily Metrics ─────────────────────────────────────────────────────────

  getDailyMetrics(period: AnalyticsPeriod = '30d'): DailyActiveMetrics[] {
    const days = Math.floor(periodToMs(period) / (24 * 60 * 60 * 1000));
    const now = new Date();
    const results: DailyActiveMetrics[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = toDateKey(date.toISOString());
      const daySessions = this.getSessionsForDate(dateKey);
      const dayEvents = this.getEventsForDate(dateKey);

      const uniqueUsers = new Set(daySessions.filter(s => s.userId).map(s => s.userId!));
      const returningUsers = new Set(daySessions.filter(s => s.isReturning && s.userId).map(s => s.userId!));
      const newUsers = uniqueUsers.size - returningUsers.size;

      const avgDuration = daySessions.length > 0
        ? daySessions.reduce((sum, s) => sum + s.duration, 0) / daySessions.length
        : 0;

      const bounced = daySessions.filter(s => s.isBounce).length;
      const bounceRate = daySessions.length > 0 ? bounced / daySessions.length : 0;

      const totalPageViews = daySessions.reduce((sum, s) => sum + s.pageViewCount, 0);
      const totalErrors = daySessions.reduce((sum, s) => sum + s.errorCount, 0);

      // Top features
      const featureCounts = new Map<string, number>();
      for (const e of dayEvents) {
        if (e.category === 'feature_usage') {
          featureCounts.set(e.action, (featureCounts.get(e.action) ?? 0) + 1);
        }
      }
      const topFeatures = Array.from(featureCounts.entries())
        .map(([featureId, count]) => ({ featureId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top pages
      const pageCounts = new Map<string, number>();
      for (const e of dayEvents) {
        if (e.category === 'page_view' && e.label) {
          pageCounts.set(e.label, (pageCounts.get(e.label) ?? 0) + 1);
        }
      }
      const topPages = Array.from(pageCounts.entries())
        .map(([url, views]) => ({ url, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);

      // WAU/MAU for this date
      const dateMs = date.getTime();
      const wauUsers = this.getUniqueUsersInRange(dateMs - 7 * 24 * 60 * 60 * 1000, dateMs + 24 * 60 * 60 * 1000);
      const mauUsers = this.getUniqueUsersInRange(dateMs - 30 * 24 * 60 * 60 * 1000, dateMs + 24 * 60 * 60 * 1000);

      results.push({
        date: dateKey,
        dau: uniqueUsers.size || daySessions.length,
        wau: wauUsers,
        mau: mauUsers,
        newUsers: Math.max(0, newUsers),
        returningUsers: returningUsers.size,
        totalSessions: daySessions.length,
        avgSessionDuration: avgDuration,
        bounceRate,
        totalPageViews,
        totalEvents: dayEvents.length,
        totalErrors,
        topFeatures,
        topPages,
      });
    }

    return results;
  }

  // ─── Feature Usage ─────────────────────────────────────────────────────────

  getFeatureUsage(period: AnalyticsPeriod = '30d'): FeatureUsageRecord[] {
    const cutoff = Date.now() - periodToMs(period);
    const events = this.getEvents().filter(
      e => e.category === 'feature_usage' && new Date(e.timestamp).getTime() >= cutoff
    );

    const features = new Map<string, {
      featureId: string;
      featureName: string;
      category: string;
      totalUsageCount: number;
      users: Set<string>;
      durations: number[];
      lastUsedAt: string;
      firstUsedAt: string;
    }>();

    for (const e of events) {
      const featureId = e.action;
      const featureName = e.label ?? e.action;
      const existing = features.get(featureId) ?? {
        featureId,
        featureName,
        category: (e.metadata?.category as string) ?? 'general',
        totalUsageCount: 0,
        users: new Set<string>(),
        durations: [],
        lastUsedAt: e.timestamp,
        firstUsedAt: e.timestamp,
      };

      existing.totalUsageCount++;
      if (e.userId) existing.users.add(e.userId);
      if (e.value && e.value > 0) existing.durations.push(e.value);
      if (e.timestamp > existing.lastUsedAt) existing.lastUsedAt = e.timestamp;
      if (e.timestamp < existing.firstUsedAt) existing.firstUsedAt = e.timestamp;
      features.set(featureId, existing);
    }

    const totalUniqueUsers = this.getUniqueUsersInRange(cutoff, Date.now());

    return Array.from(features.values()).map(f => {
      const uniqueUsers = f.users.size || 1;
      const avgDuration = f.durations.length > 0
        ? f.durations.reduce((a, b) => a + b, 0) / f.durations.length
        : undefined;

      // Trend: compare first half vs second half usage
      const midpoint = cutoff + (Date.now() - cutoff) / 2;
      const firstHalf = events.filter(
        e => e.action === f.featureId && new Date(e.timestamp).getTime() < midpoint
      ).length;
      const secondHalf = events.filter(
        e => e.action === f.featureId && new Date(e.timestamp).getTime() >= midpoint
      ).length;

      let trend: FeatureUsageRecord['trend'] = 'stable';
      const featureAge = Date.now() - new Date(f.firstUsedAt).getTime();
      if (featureAge < 7 * 24 * 60 * 60 * 1000) {
        trend = 'new';
      } else if (secondHalf > firstHalf * 1.3) {
        trend = 'growing';
      } else if (secondHalf < firstHalf * 0.7) {
        trend = 'declining';
      }

      return {
        featureId: f.featureId,
        featureName: f.featureName,
        category: f.category,
        totalUsageCount: f.totalUsageCount,
        uniqueUsers,
        avgUsagePerUser: f.totalUsageCount / uniqueUsers,
        avgDurationMs: avgDuration,
        adoptionRate: totalUniqueUsers > 0 ? uniqueUsers / totalUniqueUsers : 0,
        trend,
        lastUsedAt: f.lastUsedAt,
        firstUsedAt: f.firstUsedAt,
      };
    }).sort((a, b) => b.totalUsageCount - a.totalUsageCount);
  }

  getTopFeatures(period: AnalyticsPeriod = '30d', limit = 10): FeatureUsageRecord[] {
    return this.getFeatureUsage(period).slice(0, limit);
  }

  getFeatureAdoptionRate(featureId: string, period: AnalyticsPeriod = '30d'): number {
    const usage = this.getFeatureUsage(period);
    const feature = usage.find(f => f.featureId === featureId);
    return feature?.adoptionRate ?? 0;
  }

  // ─── Retention Cohorts ─────────────────────────────────────────────────────

  getRetentionCohorts(period: AnalyticsPeriod = '90d', _cohortIntervalDays = 7): RetentionCohort[] {
    const sessions = this.getSessions();
    const cutoff = Date.now() - periodToMs(period);
    const relevantSessions = sessions.filter(s => new Date(s.startedAt).getTime() >= cutoff);

    // Group users by their first session date (cohort date)
    const userFirstSeen = new Map<string, string>();
    for (const s of relevantSessions) {
      const userId = s.userId ?? s.id;
      const dateKey = toDateKey(s.startedAt);
      const existing = userFirstSeen.get(userId);
      if (!existing || dateKey < existing) {
        userFirstSeen.set(userId, dateKey);
      }
    }

    // Group into weekly cohorts
    const cohortUsers = new Map<string, Set<string>>();
    for (const [userId, firstDate] of userFirstSeen) {
      // Round to cohort start
      const d = new Date(firstDate);
      const dayOfWeek = d.getDay();
      const cohortStart = new Date(d.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      const cohortKey = toDateKey(cohortStart.toISOString());
      const users = cohortUsers.get(cohortKey) ?? new Set();
      users.add(userId);
      cohortUsers.set(cohortKey, users);
    }

    // Calculate retention for each cohort
    const userActivityDates = new Map<string, Set<string>>();
    for (const s of relevantSessions) {
      const userId = s.userId ?? s.id;
      const dates = userActivityDates.get(userId) ?? new Set();
      dates.add(toDateKey(s.startedAt));
      userActivityDates.set(userId, dates);
    }

    const cohorts: RetentionCohort[] = [];
    for (const [cohortDate, users] of cohortUsers) {
      const cohortSize = users.size;
      if (cohortSize === 0) continue;

      const retentionByDay: Record<number, number> = {};
      const retentionByWeek: Record<number, number> = {};

      // Check retention for days 1, 3, 7, 14, 30, 60, 90
      for (const dayOffset of [1, 3, 7, 14, 30, 60, 90]) {
        const targetDate = new Date(new Date(cohortDate).getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const targetKey = toDateKey(targetDate.toISOString());
        if (new Date(targetKey).getTime() > Date.now()) break;

        let retained = 0;
        for (const userId of users) {
          const dates = userActivityDates.get(userId);
          if (dates?.has(targetKey)) retained++;
        }
        retentionByDay[dayOffset] = retained / cohortSize;
      }

      // Weekly retention
      for (let week = 1; week <= 12; week++) {
        const weekStart = new Date(new Date(cohortDate).getTime() + week * 7 * 24 * 60 * 60 * 1000);
        if (weekStart.getTime() > Date.now()) break;

        let retained = 0;
        for (const userId of users) {
          const dates = userActivityDates.get(userId);
          if (!dates) continue;
          // User was active any day in the target week
          for (let d = 0; d < 7; d++) {
            const checkDate = toDateKey(new Date(weekStart.getTime() + d * 24 * 60 * 60 * 1000).toISOString());
            if (dates.has(checkDate)) {
              retained++;
              break;
            }
          }
        }
        retentionByWeek[week] = retained / cohortSize;
      }

      cohorts.push({ cohortDate, cohortSize, retentionByDay, retentionByWeek });
    }

    return cohorts.sort((a, b) => a.cohortDate.localeCompare(b.cohortDate));
  }

  // ─── Growth Metrics ────────────────────────────────────────────────────────

  getGrowthRate(period: AnalyticsPeriod = '30d'): { userGrowth: number; sessionGrowth: number; eventGrowth: number } {
    const halfPeriod = periodToMs(period) / 2;
    const now = Date.now();
    const midpoint = now - halfPeriod;
    const start = now - periodToMs(period);

    const sessions = this.getSessions();
    const events = this.getEvents();

    const firstHalfSessions = sessions.filter(s => {
      const t = new Date(s.startedAt).getTime();
      return t >= start && t < midpoint;
    }).length;
    const secondHalfSessions = sessions.filter(s => {
      const t = new Date(s.startedAt).getTime();
      return t >= midpoint && t <= now;
    }).length;

    const firstHalfEvents = events.filter(e => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t < midpoint;
    }).length;
    const secondHalfEvents = events.filter(e => {
      const t = new Date(e.timestamp).getTime();
      return t >= midpoint && t <= now;
    }).length;

    const firstHalfUsers = this.getUniqueUsersInRange(start, midpoint);
    const secondHalfUsers = this.getUniqueUsersInRange(midpoint, now);

    return {
      userGrowth: firstHalfUsers > 0 ? (secondHalfUsers - firstHalfUsers) / firstHalfUsers : 0,
      sessionGrowth: firstHalfSessions > 0 ? (secondHalfSessions - firstHalfSessions) / firstHalfSessions : 0,
      eventGrowth: firstHalfEvents > 0 ? (secondHalfEvents - firstHalfEvents) / firstHalfEvents : 0,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getSessions(): AnalyticsSession[] {
    return this.store.getAnalyticsSessions?.() ?? [];
  }

  private getEvents(): AnalyticsEvent[] {
    return this.store.getAnalyticsEvents?.() ?? [];
  }

  private getSessionsForDate(dateKey: string): AnalyticsSession[] {
    return this.getSessions().filter(s => toDateKey(s.startedAt) === dateKey);
  }

  private getEventsForDate(dateKey: string): AnalyticsEvent[] {
    return this.getEvents().filter(e => toDateKey(e.timestamp) === dateKey);
  }

  private getUniqueUsersInRange(startMs: number, endMs: number): number {
    const sessions = this.getSessions();
    const users = new Set<string>();
    let anonymousSessions = 0;
    for (const s of sessions) {
      const t = new Date(s.startedAt).getTime();
      if (t >= startMs && t < endMs) {
        if (s.userId) {
          users.add(s.userId);
        } else {
          anonymousSessions++;
        }
      }
    }
    return users.size || anonymousSessions;
  }
}
