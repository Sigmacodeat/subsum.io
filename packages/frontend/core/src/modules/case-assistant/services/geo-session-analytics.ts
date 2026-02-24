import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { AnalyticsCollectorService } from './analytics-collector';
import type {
  AnalyticsSession,
  GeoLocation,
  GeoDistribution,
  DeviceType,
  BrowserFamily,
  OSFamily,
  AnalyticsPeriod,
} from '../types';

const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h cache
const GEO_API_ENDPOINTS = [
  'https://ipapi.co/json/',
  'https://ip-api.com/json/?fields=status,country,countryCode,regionName,city,lat,lon,timezone,isp',
];

interface GeoCache {
  location: GeoLocation;
  cachedAt: number;
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

export class GeoSessionAnalyticsService extends Service {
  private geoCache: GeoCache | null = null;
  private geoResolvePromise: Promise<GeoLocation | null> | null = null;

  constructor(
    private readonly store: CaseAssistantStore,
    private readonly collector: AnalyticsCollectorService
  ) {
    super();
  }

  // ─── Geo Location ──────────────────────────────────────────────────────────

  async resolveGeoLocation(): Promise<GeoLocation | null> {
    // Return cached if fresh
    if (this.geoCache && Date.now() - this.geoCache.cachedAt < GEO_CACHE_TTL_MS) {
      return this.geoCache.location;
    }

    // Check persisted cache
    const persisted = this.store.getGeoCache?.();
    if (persisted && Date.now() - persisted.cachedAt < GEO_CACHE_TTL_MS) {
      this.geoCache = persisted;
      this.collector.setGeoLocation(persisted.location);
      return persisted.location;
    }

    // Deduplicate concurrent calls
    if (this.geoResolvePromise) return this.geoResolvePromise;

    this.geoResolvePromise = this.fetchGeoLocation().finally(() => {
      this.geoResolvePromise = null;
    });

    return this.geoResolvePromise;
  }

  getCachedGeo(): GeoLocation | null {
    return this.geoCache?.location ?? null;
  }

  private async fetchGeoLocation(): Promise<GeoLocation | null> {
    for (const endpoint of GEO_API_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();
        const geo = this.normalizeGeoResponse(data, endpoint);
        if (!geo) continue;

        this.geoCache = { location: geo, cachedAt: Date.now() };
        this.store.setGeoCache?.(this.geoCache);
        this.collector.setGeoLocation(geo);
        return geo;
      } catch {
        continue;
      }
    }
    return null;
  }

  private normalizeGeoResponse(data: any, endpoint: string): GeoLocation | null {
    if (!data) return null;
    const now = new Date().toISOString();

    if (endpoint.includes('ipapi.co')) {
      if (!data.country_name) return null;
      return {
        country: data.country_name,
        countryCode: data.country_code ?? '',
        region: data.region ?? undefined,
        city: data.city ?? undefined,
        latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
        longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
        timezone: data.timezone ?? undefined,
        isp: data.org ?? undefined,
        resolvedAt: now,
      };
    }

    if (endpoint.includes('ip-api.com')) {
      if (data.status !== 'success') return null;
      return {
        country: data.country ?? '',
        countryCode: data.countryCode ?? '',
        region: data.regionName ?? undefined,
        city: data.city ?? undefined,
        latitude: typeof data.lat === 'number' ? data.lat : undefined,
        longitude: typeof data.lon === 'number' ? data.lon : undefined,
        timezone: data.timezone ?? undefined,
        isp: data.isp ?? undefined,
        resolvedAt: now,
      };
    }

    return null;
  }

  // ─── Session Analytics ─────────────────────────────────────────────────────

  getSessions(period: AnalyticsPeriod = '30d'): AnalyticsSession[] {
    const sessions = this.store.getAnalyticsSessions?.() ?? [];
    const cutoff = Date.now() - periodToMs(period);
    return sessions.filter(s => new Date(s.startedAt).getTime() >= cutoff);
  }

  getSessionCount(period: AnalyticsPeriod = '30d'): number {
    return this.getSessions(period).length;
  }

  getAverageSessionDuration(period: AnalyticsPeriod = '30d'): number {
    const sessions = this.getSessions(period).filter(s => s.duration > 0);
    if (sessions.length === 0) return 0;
    return sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
  }

  getBounceRate(period: AnalyticsPeriod = '30d'): number {
    const sessions = this.getSessions(period);
    if (sessions.length === 0) return 0;
    const bounced = sessions.filter(s => s.isBounce).length;
    return bounced / sessions.length;
  }

  getReturningUserRate(period: AnalyticsPeriod = '30d'): number {
    const sessions = this.getSessions(period);
    if (sessions.length === 0) return 0;
    const returning = sessions.filter(s => s.isReturning).length;
    return returning / sessions.length;
  }

  getTotalPageViews(period: AnalyticsPeriod = '30d'): number {
    return this.getSessions(period).reduce((sum, s) => sum + s.pageViewCount, 0);
  }

  getAvgPagesPerSession(period: AnalyticsPeriod = '30d'): number {
    const sessions = this.getSessions(period);
    if (sessions.length === 0) return 0;
    const totalPages = sessions.reduce((sum, s) => sum + s.pageViewCount, 0);
    return totalPages / sessions.length;
  }

  // ─── Geo Distribution ──────────────────────────────────────────────────────

  getGeoDistribution(period: AnalyticsPeriod = '30d'): GeoDistribution[] {
    const sessions = this.getSessions(period).filter(s => s.geo?.countryCode);
    if (sessions.length === 0) return [];

    const byCountry = new Map<string, {
      country: string;
      countryCode: string;
      users: Set<string>;
      sessions: number;
      cities: Map<string, { city: string; region?: string; users: Set<string>; sessions: number; lat?: number; lon?: number }>;
    }>();

    for (const session of sessions) {
      const geo = session.geo!;
      const cc = geo.countryCode;
      const entry = byCountry.get(cc) ?? {
        country: geo.country,
        countryCode: cc,
        users: new Set<string>(),
        sessions: 0,
        cities: new Map(),
      };

      if (session.userId) entry.users.add(session.userId);
      entry.sessions++;

      if (geo.city) {
        const cityKey = `${geo.city}|${geo.region ?? ''}`;
        const cityEntry = entry.cities.get(cityKey) ?? {
          city: geo.city,
          region: geo.region,
          users: new Set<string>(),
          sessions: 0,
          lat: geo.latitude,
          lon: geo.longitude,
        };
        if (session.userId) cityEntry.users.add(session.userId);
        cityEntry.sessions++;
        entry.cities.set(cityKey, cityEntry);
      }

      byCountry.set(cc, entry);
    }

    const totalSessions = sessions.length;

    return Array.from(byCountry.values())
      .map(entry => ({
        country: entry.country,
        countryCode: entry.countryCode,
        userCount: entry.users.size,
        sessionCount: entry.sessions,
        percentage: entry.sessions / totalSessions,
        cities: Array.from(entry.cities.values())
          .map(city => ({
            city: city.city,
            region: city.region,
            userCount: city.users.size,
            sessionCount: city.sessions,
            latitude: city.lat,
            longitude: city.lon,
          }))
          .sort((a, b) => b.sessionCount - a.sessionCount),
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);
  }

  // ─── Device & Browser Breakdown ────────────────────────────────────────────

  getDeviceBreakdown(period: AnalyticsPeriod = '30d'): Record<DeviceType, number> {
    const sessions = this.getSessions(period);
    const breakdown: Record<DeviceType, number> = { desktop: 0, tablet: 0, mobile: 0, unknown: 0 };
    for (const s of sessions) {
      breakdown[s.device.type]++;
    }
    return breakdown;
  }

  getBrowserBreakdown(period: AnalyticsPeriod = '30d'): Record<BrowserFamily, number> {
    const sessions = this.getSessions(period);
    const breakdown: Record<BrowserFamily, number> = { chrome: 0, firefox: 0, safari: 0, edge: 0, opera: 0, other: 0 };
    for (const s of sessions) {
      breakdown[s.device.browser]++;
    }
    return breakdown;
  }

  getOSBreakdown(period: AnalyticsPeriod = '30d'): Record<OSFamily, number> {
    const sessions = this.getSessions(period);
    const breakdown: Record<OSFamily, number> = { windows: 0, macos: 0, linux: 0, ios: 0, android: 0, other: 0 };
    for (const s of sessions) {
      breakdown[s.device.os]++;
    }
    return breakdown;
  }

  // ─── Top Pages & Referrers ─────────────────────────────────────────────────

  getTopEntryPages(period: AnalyticsPeriod = '30d', limit = 10): Array<{ page: string; count: number }> {
    const sessions = this.getSessions(period);
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.entryPage) {
        counts.set(s.entryPage, (counts.get(s.entryPage) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getTopReferrers(period: AnalyticsPeriod = '30d', limit = 10): Array<{ source: string; count: number; percentage: number }> {
    const sessions = this.getSessions(period).filter(s => s.referrer);
    if (sessions.length === 0) return [];

    const counts = new Map<string, number>();
    for (const s of sessions) {
      try {
        const hostname = new URL(s.referrer!).hostname;
        counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
      } catch {
        counts.set(s.referrer!, (counts.get(s.referrer!) ?? 0) + 1);
      }
    }

    const total = sessions.length;
    return Array.from(counts.entries())
      .map(([source, count]) => ({ source, count, percentage: count / total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getUTMBreakdown(period: AnalyticsPeriod = '30d'): Array<{ source: string; medium: string; campaign: string; count: number }> {
    const sessions = this.getSessions(period).filter(s => s.utmSource);
    const key = (s: AnalyticsSession) => `${s.utmSource}|${s.utmMedium ?? ''}|${s.utmCampaign ?? ''}`;
    const counts = new Map<string, { source: string; medium: string; campaign: string; count: number }>();

    for (const s of sessions) {
      const k = key(s);
      const existing = counts.get(k) ?? {
        source: s.utmSource!,
        medium: s.utmMedium ?? '',
        campaign: s.utmCampaign ?? '',
        count: 0,
      };
      existing.count++;
      counts.set(k, existing);
    }

    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }

  // ─── Session Timeline ──────────────────────────────────────────────────────

  getSessionsByHour(period: AnalyticsPeriod = '7d'): Array<{ hour: number; count: number }> {
    const sessions = this.getSessions(period);
    const hourly = new Array(24).fill(0) as number[];
    for (const s of sessions) {
      const hour = new Date(s.startedAt).getHours();
      hourly[hour]++;
    }
    return hourly.map((count, hour) => ({ hour, count }));
  }

  getSessionsByDayOfWeek(period: AnalyticsPeriod = '30d'): Array<{ day: number; dayName: string; count: number }> {
    const sessions = this.getSessions(period);
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const daily = new Array(7).fill(0) as number[];
    for (const s of sessions) {
      const day = new Date(s.startedAt).getDay();
      daily[day]++;
    }
    return daily.map((count, day) => ({ day, dayName: dayNames[day]!, count }));
  }
}
