import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { AnalyticsCollectorService } from './analytics-collector';
import type {
  PerformanceMetric,
  PerformanceMetricName,
  PerformanceRating,
  PerformanceSummary,
  ConnectionInfo,
  AnalyticsPeriod,
} from '../types';

const MAX_METRICS = 5000;

const THRESHOLDS: Record<PerformanceMetricName, { good: number; poor: number }> = {
  fcp:          { good: 1800, poor: 3000 },
  lcp:          { good: 2500, poor: 4000 },
  fid:          { good: 100,  poor: 300  },
  cls:          { good: 0.1,  poor: 0.25 },
  ttfb:         { good: 800,  poor: 1800 },
  inp:          { good: 200,  poor: 500  },
  page_load:    { good: 3000, poor: 6000 },
  dom_ready:    { good: 2000, poor: 4000 },
  api_latency:  { good: 500,  poor: 2000 },
  render_time:  { good: 100,  poor: 500  },
  bundle_size:  { good: 500000, poor: 2000000 },
  memory_usage: { good: 100000000, poor: 500000000 },
  long_task:    { good: 50,   poor: 200  },
};

const METRIC_UNITS: Record<PerformanceMetricName, 'ms' | 'score' | 'bytes' | 'count'> = {
  fcp: 'ms', lcp: 'ms', fid: 'ms', cls: 'score', ttfb: 'ms', inp: 'ms',
  page_load: 'ms', dom_ready: 'ms', api_latency: 'ms', render_time: 'ms',
  bundle_size: 'bytes', memory_usage: 'bytes', long_task: 'ms',
};

function generateId(): string {
  return `perf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rateMetric(name: PerformanceMetricName, value: number): PerformanceRating {
  const t = THRESHOLDS[name];
  if (!t) return 'good';
  if (value <= t.good) return 'good';
  if (value >= t.poor) return 'poor';
  return 'needs-improvement';
}

function getConnectionInfo(): ConnectionInfo | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const conn = (navigator as any).connection;
  if (!conn) return undefined;
  return {
    effectiveType: conn.effectiveType ?? '4g',
    downlink: conn.downlink ?? 0,
    rtt: conn.rtt ?? 0,
    saveData: conn.saveData ?? false,
  };
}

function periodToMs(period: AnalyticsPeriod): number {
  switch (period) {
    case 'today': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    case '90d': return 90 * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

export class PerformanceMonitorService extends Service {
  private isObserving = false;
  private perfObserver: PerformanceObserver | null = null;
  private longTaskObserver: PerformanceObserver | null = null;

  constructor(
    private readonly store: CaseAssistantStore,
    private readonly collector: AnalyticsCollectorService
  ) {
    super();
  }

  private get workspaceId(): string {
    return (this.store as any).workspaceId ?? 'unknown';
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  startObserving(): void {
    if (this.isObserving || typeof window === 'undefined') return;
    this.isObserving = true;
    this.observeWebVitals();
    this.observeLongTasks();
    this.captureNavigationTiming();
  }

  stopObserving(): void {
    this.isObserving = false;
    this.perfObserver?.disconnect();
    this.longTaskObserver?.disconnect();
    this.perfObserver = null;
    this.longTaskObserver = null;
  }

  // ─── Public Recording API ──────────────────────────────────────────────────

  recordMetric(name: PerformanceMetricName, value: number, url?: string, element?: string): PerformanceMetric {
    const metric: PerformanceMetric = {
      id: generateId(),
      workspaceId: this.workspaceId,
      sessionId: this.collector.getSessionId(),
      name,
      value,
      unit: METRIC_UNITS[name] ?? 'ms',
      rating: rateMetric(name, value),
      url: url ?? (typeof window !== 'undefined' ? window.location.href : undefined),
      element,
      timestamp: new Date().toISOString(),
      connection: getConnectionInfo(),
    };

    this.persistMetric(metric);
    this.collector.trackEvent('performance', name, metric.rating, value, {
      name,
      rating: metric.rating,
    });

    return metric;
  }

  recordApiLatency(url: string, method: string, durationMs: number, status: number): PerformanceMetric {
    return this.recordMetric('api_latency', durationMs, url, `${method.toUpperCase()} ${status}`);
  }

  recordRenderTime(componentName: string, durationMs: number): PerformanceMetric {
    return this.recordMetric('render_time', durationMs, undefined, componentName);
  }

  recordMemoryUsage(): PerformanceMetric | null {
    if (typeof performance === 'undefined') return null;
    const memInfo = (performance as any).memory;
    if (!memInfo) return null;
    return this.recordMetric('memory_usage', memInfo.usedJSHeapSize ?? 0);
  }

  // ─── Query API ─────────────────────────────────────────────────────────────

  getMetrics(period: AnalyticsPeriod = '30d'): PerformanceMetric[] {
    const all = this.store.getPerformanceMetrics?.() ?? [];
    const cutoff = Date.now() - periodToMs(period);
    return all.filter(m => new Date(m.timestamp).getTime() >= cutoff);
  }

  getMetricsByName(name: PerformanceMetricName, period: AnalyticsPeriod = '30d'): PerformanceMetric[] {
    return this.getMetrics(period).filter(m => m.name === name);
  }

  getSummary(period: AnalyticsPeriod = '30d'): PerformanceSummary {
    const metrics = this.getMetrics(period);
    const metricNames: PerformanceMetricName[] = [
      'fcp', 'lcp', 'fid', 'cls', 'ttfb', 'inp',
      'page_load', 'dom_ready', 'api_latency', 'render_time',
      'bundle_size', 'memory_usage', 'long_task',
    ];

    const p50: Record<string, number> = {};
    const p75: Record<string, number> = {};
    const p95: Record<string, number> = {};
    const p99: Record<string, number> = {};
    const ratings: Record<string, { good: number; needsImprovement: number; poor: number }> = {};

    for (const name of metricNames) {
      const values = metrics.filter(m => m.name === name).map(m => m.value).sort((a, b) => a - b);
      p50[name] = percentile(values, 50);
      p75[name] = percentile(values, 75);
      p95[name] = percentile(values, 95);
      p99[name] = percentile(values, 99);

      const ratingCounts = { good: 0, needsImprovement: 0, poor: 0 };
      for (const v of values) {
        const r = rateMetric(name, v);
        if (r === 'good') ratingCounts.good++;
        else if (r === 'needs-improvement') ratingCounts.needsImprovement++;
        else ratingCounts.poor++;
      }
      ratings[name] = ratingCounts;
    }

    return {
      workspaceId: this.workspaceId,
      period,
      p50: p50 as any,
      p75: p75 as any,
      p95: p95 as any,
      p99: p99 as any,
      ratings: ratings as any,
      sampleCount: metrics.length,
      generatedAt: new Date().toISOString(),
    };
  }

  getAverageLoadTime(period: AnalyticsPeriod = '30d'): number {
    const metrics = this.getMetricsByName('page_load', period);
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }

  getCoreWebVitalsScore(period: AnalyticsPeriod = '30d'): {
    lcp: { p75: number; rating: PerformanceRating };
    fid: { p75: number; rating: PerformanceRating };
    cls: { p75: number; rating: PerformanceRating };
    inp: { p75: number; rating: PerformanceRating };
    overall: PerformanceRating;
  } {
    const summary = this.getSummary(period);
    const lcpVal = summary.p75.lcp ?? 0;
    const fidVal = summary.p75.fid ?? 0;
    const clsVal = summary.p75.cls ?? 0;
    const inpVal = summary.p75.inp ?? 0;

    const lcpRating = rateMetric('lcp', lcpVal);
    const fidRating = rateMetric('fid', fidVal);
    const clsRating = rateMetric('cls', clsVal);
    const inpRating = rateMetric('inp', inpVal);

    const allRatings = [lcpRating, fidRating, clsRating, inpRating];
    let overall: PerformanceRating = 'good';
    if (allRatings.some(r => r === 'poor')) overall = 'poor';
    else if (allRatings.some(r => r === 'needs-improvement')) overall = 'needs-improvement';

    return {
      lcp: { p75: lcpVal, rating: lcpRating },
      fid: { p75: fidVal, rating: fidRating },
      cls: { p75: clsVal, rating: clsRating },
      inp: { p75: inpVal, rating: inpRating },
      overall,
    };
  }

  // ─── Internal Observation ──────────────────────────────────────────────────

  private observeWebVitals(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.perfObserver = new PerformanceObserver(entryList => {
        for (const entry of entryList.getEntries()) {
          const metricMap: Record<string, PerformanceMetricName> = {
            'first-contentful-paint': 'fcp',
            'largest-contentful-paint': 'lcp',
            'first-input': 'fid',
            'layout-shift': 'cls',
          };

          const name = metricMap[entry.entryType] ?? metricMap[entry.name];
          if (!name) continue;

          let value: number;
          if (entry.entryType === 'layout-shift') {
            value = (entry as any).value ?? 0;
          } else if (entry.entryType === 'first-input') {
            value = (entry as any).processingStart - entry.startTime;
          } else {
            value = entry.startTime;
          }

          this.recordMetric(name, value, undefined, (entry as any).element?.tagName);
        }
      });

      // Observe paint entries
      try {
        this.perfObserver.observe({ type: 'paint', buffered: true });
      } catch { /* not supported */ }
      try {
        this.perfObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { /* not supported */ }
      try {
        this.perfObserver.observe({ type: 'first-input', buffered: true });
      } catch { /* not supported */ }
      try {
        this.perfObserver.observe({ type: 'layout-shift', buffered: true });
      } catch { /* not supported */ }
    } catch {
      // PerformanceObserver not available
    }
  }

  private observeLongTasks(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.longTaskObserver = new PerformanceObserver(entryList => {
        for (const entry of entryList.getEntries()) {
          if (entry.duration > 50) {
            this.recordMetric('long_task', entry.duration);
          }
        }
      });
      this.longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask not supported
    }
  }

  private captureNavigationTiming(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;

    // Wait for page load to complete
    const capture = () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;

      if (nav.responseStart > 0) {
        this.recordMetric('ttfb', nav.responseStart - nav.requestStart);
      }
      if (nav.domContentLoadedEventEnd > 0) {
        this.recordMetric('dom_ready', nav.domContentLoadedEventEnd - nav.startTime);
      }
      if (nav.loadEventEnd > 0) {
        this.recordMetric('page_load', nav.loadEventEnd - nav.startTime);
      }
      if (nav.transferSize > 0) {
        this.recordMetric('bundle_size', nav.transferSize);
      }
    };

    if (document.readyState === 'complete') {
      setTimeout(capture, 0);
    } else {
      window.addEventListener('load', () => setTimeout(capture, 100), { once: true });
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private persistMetric(metric: PerformanceMetric): void {
    try {
      const existing = this.store.getPerformanceMetrics?.() ?? [];
      const updated = [...existing, metric];
      const trimmed = updated.length > MAX_METRICS ? updated.slice(updated.length - MAX_METRICS) : updated;
      this.store.setPerformanceMetrics?.(trimmed);
    } catch {
      // Silently fail
    }
  }
}
