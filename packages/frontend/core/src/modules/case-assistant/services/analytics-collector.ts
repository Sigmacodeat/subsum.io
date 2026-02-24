import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type {
  AnalyticsEvent,
  AnalyticsEventCategory,
  AnalyticsSession,
  DeviceInfo,
  DeviceType,
  BrowserFamily,
  OSFamily,
  GeoLocation,
} from '../types';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity → new session
const FLUSH_INTERVAL_MS = 60 * 1000; // flush every 60s
const MAX_BATCH_SIZE = 100;
const MAX_EVENTS_IN_MEMORY = 5000;

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function detectBrowser(): { family: BrowserFamily; version?: string } {
  if (typeof navigator === 'undefined') return { family: 'other' };
  const ua = navigator.userAgent;
  let match: RegExpMatchArray | null;

  if ((match = ua.match(/Edg\/(\d+[\d.]*)/))) return { family: 'edge', version: match[1] };
  if ((match = ua.match(/OPR\/(\d+[\d.]*)/))) return { family: 'opera', version: match[1] };
  if ((match = ua.match(/Chrome\/(\d+[\d.]*)/))) return { family: 'chrome', version: match[1] };
  if ((match = ua.match(/Firefox\/(\d+[\d.]*)/))) return { family: 'firefox', version: match[1] };
  if ((match = ua.match(/Version\/(\d+[\d.]*).*Safari/))) return { family: 'safari', version: match[1] };
  return { family: 'other' };
}

function detectOS(): { family: OSFamily; version?: string } {
  if (typeof navigator === 'undefined') return { family: 'other' };
  const ua = navigator.userAgent;

  if (/Windows NT (\d+[\d.]*)/.test(ua)) return { family: 'windows', version: RegExp.$1 };
  if (/Mac OS X (\d+[._\d]*)/.test(ua)) return { family: 'macos', version: RegExp.$1.replace(/_/g, '.') };
  if (/Linux/.test(ua)) return { family: 'linux' };
  if (/iPhone|iPad|iPod/.test(ua)) {
    const match = ua.match(/OS (\d+[._\d]*)/);
    return { family: 'ios', version: match?.[1]?.replace(/_/g, '.') };
  }
  if (/Android (\d+[\d.]*)/.test(ua)) return { family: 'android', version: RegExp.$1 };
  return { family: 'other' };
}

function collectDeviceInfo(): DeviceInfo {
  const browser = detectBrowser();
  const os = detectOS();
  const w = typeof window !== 'undefined' ? window : undefined;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  return {
    type: detectDeviceType(),
    browser: browser.family,
    browserVersion: browser.version,
    os: os.family,
    osVersion: os.version,
    screenWidth: w?.screen?.width ?? 0,
    screenHeight: w?.screen?.height ?? 0,
    viewportWidth: w?.innerWidth ?? 0,
    viewportHeight: w?.innerHeight ?? 0,
    pixelRatio: w?.devicePixelRatio ?? 1,
    language: nav?.language ?? 'unknown',
    timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone ?? 'unknown',
    touchEnabled: nav ? 'ontouchstart' in window || nav.maxTouchPoints > 0 : false,
    cookiesEnabled: nav?.cookieEnabled ?? false,
    doNotTrack: nav?.doNotTrack === '1',
  };
}

function parseUTMParams(): { source?: string; medium?: string; campaign?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source') ?? undefined,
      medium: params.get('utm_medium') ?? undefined,
      campaign: params.get('utm_campaign') ?? undefined,
    };
  } catch {
    return {};
  }
}

export class AnalyticsCollectorService extends Service {
  private currentSession: AnalyticsSession | null = null;
  private eventBuffer: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private geoLocation: GeoLocation | null = null;
  private isInitialized = false;
  private sessionStartPageViews = 0;

  constructor(private readonly store: CaseAssistantStore) {
    super();
  }

  get workspaceId(): string {
    return (this.store as any).workspaceId ?? 'unknown';
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.deviceInfo = collectDeviceInfo();
    this.startSession();
    this.startFlushTimer();
    this.bindGlobalListeners();
  }

  override dispose(): void {
    this.endSession();
    this.flushSync();
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.activityTimer) clearTimeout(this.activityTimer);
    this.unbindGlobalListeners();
    this.isInitialized = false;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  trackEvent(
    category: AnalyticsEventCategory,
    action: string,
    label?: string,
    value?: number,
    metadata?: Record<string, string | number | boolean>
  ): void {
    if (!this.isInitialized) this.initialize();
    this.touchActivity();

    const event: AnalyticsEvent = {
      id: generateId(),
      workspaceId: this.workspaceId,
      sessionId: this.currentSession?.id ?? generateId(),
      category,
      action,
      label,
      value,
      metadata,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      deviceType: this.deviceInfo?.type,
      geo: this.geoLocation ?? undefined,
    };

    this.pushEvent(event);

    if (this.currentSession) {
      this.currentSession.eventCount++;
      if (category === 'page_view') {
        this.currentSession.pageViewCount++;
        this.sessionStartPageViews++;
      }
      if (category === 'feature_usage') {
        this.currentSession.featureUsageCount++;
      }
      this.currentSession.lastActivityAt = event.timestamp;
      if (!this.currentSession.exitPage) {
        this.currentSession.exitPage = event.url;
      } else {
        this.currentSession.exitPage = event.url;
      }
    }
  }

  trackPageView(url?: string): void {
    this.trackEvent('page_view', 'view', url ?? (typeof window !== 'undefined' ? window.location.pathname : undefined));
  }

  trackFeatureUsage(featureId: string, featureName: string, durationMs?: number): void {
    this.trackEvent('feature_usage', featureId, featureName, durationMs, {
      featureId,
      featureName,
      durationMs: durationMs ?? 0,
    });
  }

  trackNavigation(from: string, to: string): void {
    this.trackEvent('navigation', 'navigate', `${from} → ${to}`, undefined, { from, to });
  }

  trackSearch(query: string, resultCount: number): void {
    this.trackEvent('search', 'search', query, resultCount, { resultCount });
  }

  trackDocumentAction(action: string, documentId: string, documentTitle?: string): void {
    this.trackEvent('document', action, documentTitle, undefined, { documentId });
  }

  trackCaseAction(action: string, caseId: string, details?: string): void {
    this.trackEvent('case_action', action, details, undefined, { caseId });
  }

  trackCopilotAction(action: string, mode?: string, durationMs?: number): void {
    this.trackEvent('copilot', action, mode, durationMs);
  }

  trackUserAction(action: string, target?: string, metadata?: Record<string, string | number | boolean>): void {
    this.trackEvent('user_action', action, target, undefined, metadata);
  }

  // ─── Session Management ────────────────────────────────────────────────────

  getCurrentSession(): AnalyticsSession | null {
    return this.currentSession;
  }

  getSessionId(): string {
    return this.currentSession?.id ?? '';
  }

  setGeoLocation(geo: GeoLocation): void {
    this.geoLocation = geo;
    if (this.currentSession) {
      this.currentSession.geo = geo;
    }
  }

  getBufferedEvents(): AnalyticsEvent[] {
    return [...this.eventBuffer];
  }

  getBufferedEventCount(): number {
    return this.eventBuffer.length;
  }

  // ─── Flush ─────────────────────────────────────────────────────────────────

  async flush(): Promise<AnalyticsEvent[]> {
    if (this.eventBuffer.length === 0) return [];
    const drained: AnalyticsEvent[] = [];
    while (this.eventBuffer.length > 0) {
      const batch = this.eventBuffer.splice(0, MAX_BATCH_SIZE);
      drained.push(...batch);
      await this.persistEvents(batch);
    }
    return drained;
  }

  private flushSync(): void {
    if (this.eventBuffer.length === 0) return;
    const batches: AnalyticsEvent[][] = [];
    while (this.eventBuffer.length > 0) {
      batches.push(this.eventBuffer.splice(0, MAX_BATCH_SIZE));
    }
    for (const batch of batches) {
      void this.persistEvents(batch);
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private startSession(): void {
    const now = new Date().toISOString();
    const utm = parseUTMParams();
    const existingSessions = this.store.getAnalyticsSessions?.() ?? [];
    const isReturning = existingSessions.length > 0;

    this.sessionStartPageViews = 0;

    this.currentSession = {
      id: generateId(),
      workspaceId: this.workspaceId,
      startedAt: now,
      lastActivityAt: now,
      duration: 0,
      pageViewCount: 0,
      eventCount: 0,
      errorCount: 0,
      featureUsageCount: 0,
      entryPage: typeof window !== 'undefined' ? window.location.pathname : undefined,
      device: this.deviceInfo ?? collectDeviceInfo(),
      geo: this.geoLocation ?? undefined,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      isBounce: true,
      isReturning,
    };

    this.trackEvent('session', 'session_start');
  }

  private endSession(): void {
    if (!this.currentSession) return;
    const now = new Date();
    this.currentSession.endedAt = now.toISOString();
    this.currentSession.duration = now.getTime() - new Date(this.currentSession.startedAt).getTime();
    this.currentSession.isBounce = this.sessionStartPageViews <= 1 && this.currentSession.eventCount <= 2;
    this.trackEvent('session', 'session_end', undefined, this.currentSession.duration);
    this.persistSession(this.currentSession);
    this.currentSession = null;
  }

  private touchActivity(): void {
    if (this.activityTimer) clearTimeout(this.activityTimer);
    this.activityTimer = setTimeout(() => {
      this.endSession();
      this.startSession();
    }, SESSION_TIMEOUT_MS);
  }

  private pushEvent(event: AnalyticsEvent): void {
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > MAX_EVENTS_IN_MEMORY) {
      this.eventBuffer.splice(0, this.eventBuffer.length - MAX_EVENTS_IN_MEMORY);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private async persistEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      const existing = this.store.getAnalyticsEvents?.() ?? [];
      const merged = [...existing, ...events];
      // Keep last 10k events
      const trimmed = merged.length > 10000 ? merged.slice(merged.length - 10000) : merged;
      this.store.setAnalyticsEvents?.(trimmed);
    } catch {
      // Silently fail — analytics should never break the app
    }
  }

  private persistSession(session: AnalyticsSession): void {
    try {
      const existing = this.store.getAnalyticsSessions?.() ?? [];
      const updated = [...existing, session];
      // Keep last 500 sessions
      const trimmed = updated.length > 500 ? updated.slice(updated.length - 500) : updated;
      this.store.setAnalyticsSessions?.(trimmed);
    } catch {
      // Silently fail
    }
  }

  // ─── Global Listeners ──────────────────────────────────────────────────────

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flushSync();
    }
  };

  private handleBeforeUnload = (): void => {
    this.endSession();
    this.flushSync();
  };

  private handlePopState = (): void => {
    this.trackPageView();
  };

  private bindGlobalListeners(): void {
    if (typeof window === 'undefined') return;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('popstate', this.handlePopState);
  }

  private unbindGlobalListeners(): void {
    if (typeof window === 'undefined') return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('popstate', this.handlePopState);
  }
}
