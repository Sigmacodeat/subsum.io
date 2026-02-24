import { Injectable } from '@nestjs/common';

import { CacheRedis } from '../../base/redis';
import type {
  SupportAccessAuditEntry,
  SupportAlertEvent,
  SupportAnalyticsDashboardDto,
  SupportAnalyticsIngestAck,
  SupportAnalyticsIngestPayload,
  SupportEscalationPolicy,
  SupportEscalationPolicyInput,
  SupportIncident,
  SupportIncidentSeverity,
  SupportAnalyticsPeriod,
  SupportPublicStatusDto,
  SupportRetentionPolicy,
  SupportRetentionPolicyInput,
} from './support-types';

const KEY_PREFIX = 'telemetry:support-analytics';
const SNAPSHOT_TTL_SECONDS = 90 * 24 * 60 * 60;
const AUDIT_HISTORY_MAX = 500;
const INCIDENT_HISTORY_MAX = 200;

const RETENTION_DEFAULT_DAYS = 90;
const RETENTION_MIN_DAYS = 7;
const RETENTION_MAX_DAYS = 365;

const RETENTION_HISTORY_DEFAULT = 120;
const RETENTION_HISTORY_MIN = 30;
const RETENTION_HISTORY_MAX = 1000;

const ESCALATION_DEFAULT_NOTIFY_ON: SupportIncidentSeverity[] = ['high', 'critical'];
const ESCALATION_DEFAULT_CHANNELS: Array<'email' | 'webhook'> = ['email'];
const ESCALATION_DEFAULT_THROTTLE_MINUTES = 30;
const ESCALATION_MIN_THROTTLE_MINUTES = 1;
const ESCALATION_MAX_THROTTLE_MINUTES = 240;

const ALERT_HISTORY_MAX = 300;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\+?\d[\d\s()./-]{6,}\d/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const TOKEN_RE = /\b(?:sk|pk|api|token|bearer|secret)_[A-Za-z0-9._-]{8,}\b/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_RE = /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/gi;

function historyKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:history`;
}

function parseEscalationPolicy(
  workspaceId: string,
  raw: string | null
): SupportEscalationPolicy {
  if (!raw) {
    return {
      workspaceId,
      notifyOn: ESCALATION_DEFAULT_NOTIFY_ON,
      channels: ESCALATION_DEFAULT_CHANNELS,
      throttleMinutes: ESCALATION_DEFAULT_THROTTLE_MINUTES,
      updatedAt: new Date(0).toISOString(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SupportEscalationPolicy>;
    const notifyOn = Array.isArray(parsed.notifyOn)
      ? parsed.notifyOn.filter(
          (s): s is SupportIncidentSeverity =>
            s === 'medium' || s === 'high' || s === 'critical'
        )
      : ESCALATION_DEFAULT_NOTIFY_ON;
    const channels = Array.isArray(parsed.channels)
      ? parsed.channels.filter((c): c is 'email' | 'webhook' => c === 'email' || c === 'webhook')
      : ESCALATION_DEFAULT_CHANNELS;

    return {
      workspaceId,
      notifyOn: notifyOn.length ? notifyOn : ESCALATION_DEFAULT_NOTIFY_ON,
      channels: channels.length ? channels : ESCALATION_DEFAULT_CHANNELS,
      throttleMinutes: clampInt(
        parsed.throttleMinutes,
        ESCALATION_MIN_THROTTLE_MINUTES,
        ESCALATION_MAX_THROTTLE_MINUTES,
        ESCALATION_DEFAULT_THROTTLE_MINUTES
      ),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      updatedBy: parsed.updatedBy,
    };
  } catch {
    return {
      workspaceId,
      notifyOn: ESCALATION_DEFAULT_NOTIFY_ON,
      channels: ESCALATION_DEFAULT_CHANNELS,
      throttleMinutes: ESCALATION_DEFAULT_THROTTLE_MINUTES,
      updatedAt: new Date().toISOString(),
    };
  }
}

function auditKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:audit`;
}

function incidentsKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:incidents`;
}

function alertsKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:alerts`;
}

function escalationPolicyKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:escalation-policy`;
}

function escalationThrottleKey(workspaceId: string, severity: SupportIncidentSeverity) {
  return `${KEY_PREFIX}:${workspaceId}:escalation-throttle:${severity}`;
}

function latestSnapshotKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:latest:snapshot`;
}

function latestErrorsKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:latest:error-groups`;
}

function latestHealthKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:latest:customer-health`;
}

function latestPerformanceKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:latest:performance-summary`;
}

function retentionPolicyKey(workspaceId: string) {
  return `${KEY_PREFIX}:${workspaceId}:retention-policy`;
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonArray(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item === 'object');
  } catch {
    return [];
  }
}

function parseRetentionPolicy(
  workspaceId: string,
  raw: string | null
): SupportRetentionPolicy {
  if (!raw) {
    return {
      workspaceId,
      snapshotTtlDays: RETENTION_DEFAULT_DAYS,
      historyMaxItems: RETENTION_HISTORY_DEFAULT,
      updatedAt: new Date(0).toISOString(),
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SupportRetentionPolicy>;
    const snapshotTtlDays = clampInt(
      parsed.snapshotTtlDays,
      RETENTION_MIN_DAYS,
      RETENTION_MAX_DAYS,
      RETENTION_DEFAULT_DAYS
    );
    const historyMaxItems = clampInt(
      parsed.historyMaxItems,
      RETENTION_HISTORY_MIN,
      RETENTION_HISTORY_MAX,
      RETENTION_HISTORY_DEFAULT
    );
    return {
      workspaceId,
      snapshotTtlDays,
      historyMaxItems,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      updatedBy: parsed.updatedBy,
    };
  } catch {
    return {
      workspaceId,
      snapshotTtlDays: RETENTION_DEFAULT_DAYS,
      historyMaxItems: RETENTION_HISTORY_DEFAULT,
      updatedAt: new Date().toISOString(),
    };
  }
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function redactString(input: string): string {
  return input
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(PHONE_RE, '[redacted-phone]')
    .replace(IBAN_RE, '[redacted-iban]')
    .replace(TOKEN_RE, '[redacted-token]')
    .replace(IPV4_RE, '[redacted-ip]')
    .replace(IPV6_RE, '[redacted-ip]');
}

function redactValue(input: unknown): unknown {
  if (typeof input === 'string') {
    return redactString(input);
  }
  if (Array.isArray(input)) {
    return input.map(redactValue);
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (/password|secret|token|authorization|cookie|session/i.test(key)) {
        out[key] = '[redacted-sensitive]';
      } else {
        out[key] = redactValue(value);
      }
    }
    return out;
  }
  return input;
}

function extractMetricNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return 0;
}

function createIncidentId(workspaceId: string, reason: string, severity: string): string {
  const stamp = Date.now().toString(36);
  return `inc:${workspaceId}:${reason}:${severity}:${stamp}`;
}

function createAlertId(workspaceId: string, incidentId: string, channel: string): string {
  const stamp = Date.now().toString(36);
  return `alert:${workspaceId}:${incidentId}:${channel}:${stamp}`;
}

@Injectable()
export class TelemetrySupportService {
  constructor(private readonly redis: CacheRedis) {}

  private async getRetentionPolicyInternal(
    workspaceId: string
  ): Promise<SupportRetentionPolicy> {
    const raw = await this.redis.get(retentionPolicyKey(workspaceId));
    return parseRetentionPolicy(workspaceId, raw);
  }

  async getRetentionPolicy(workspaceId: string): Promise<SupportRetentionPolicy> {
    return this.getRetentionPolicyInternal(workspaceId);
  }

  async upsertRetentionPolicy(
    workspaceId: string,
    input: SupportRetentionPolicyInput,
    updatedBy?: string
  ): Promise<SupportRetentionPolicy> {
    const existing = await this.getRetentionPolicyInternal(workspaceId);
    const policy: SupportRetentionPolicy = {
      workspaceId,
      snapshotTtlDays: clampInt(
        input.snapshotTtlDays ?? existing.snapshotTtlDays,
        RETENTION_MIN_DAYS,
        RETENTION_MAX_DAYS,
        RETENTION_DEFAULT_DAYS
      ),
      historyMaxItems: clampInt(
        input.historyMaxItems ?? existing.historyMaxItems,
        RETENTION_HISTORY_MIN,
        RETENTION_HISTORY_MAX,
        RETENTION_HISTORY_DEFAULT
      ),
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await this.redis.set(
      retentionPolicyKey(workspaceId),
      JSON.stringify(policy),
      'EX',
      policy.snapshotTtlDays * 24 * 60 * 60
    );

    return policy;
  }

  async appendAccessAudit(entry: SupportAccessAuditEntry): Promise<void> {
    const key = auditKey(entry.workspaceId);
    const tx = this.redis.multi();
    tx.lpush(key, JSON.stringify(entry));
    tx.ltrim(key, 0, AUDIT_HISTORY_MAX - 1);
    tx.expire(key, SNAPSHOT_TTL_SECONDS);
    await tx.exec();
  }

  async listAccessAudit(workspaceId: string, limit = 100): Promise<SupportAccessAuditEntry[]> {
    const items = await this.redis.lrange(auditKey(workspaceId), 0, Math.max(0, limit - 1));
    return items
      .map(item => {
        try {
          return JSON.parse(item) as SupportAccessAuditEntry;
        } catch {
          return null;
        }
      })
      .filter((item): item is SupportAccessAuditEntry => Boolean(item));
  }

  private async getEscalationPolicyInternal(
    workspaceId: string
  ): Promise<SupportEscalationPolicy> {
    const raw = await this.redis.get(escalationPolicyKey(workspaceId));
    return parseEscalationPolicy(workspaceId, raw);
  }

  async getEscalationPolicy(workspaceId: string): Promise<SupportEscalationPolicy> {
    return this.getEscalationPolicyInternal(workspaceId);
  }

  async upsertEscalationPolicy(
    workspaceId: string,
    input: SupportEscalationPolicyInput,
    updatedBy?: string
  ): Promise<SupportEscalationPolicy> {
    const existing = await this.getEscalationPolicyInternal(workspaceId);
    const next: SupportEscalationPolicy = {
      workspaceId,
      notifyOn:
        input.notifyOn?.filter(
          (s): s is SupportIncidentSeverity =>
            s === 'medium' || s === 'high' || s === 'critical'
        ) ?? existing.notifyOn,
      channels:
        input.channels?.filter((c): c is 'email' | 'webhook' => c === 'email' || c === 'webhook') ??
        existing.channels,
      throttleMinutes: clampInt(
        input.throttleMinutes ?? existing.throttleMinutes,
        ESCALATION_MIN_THROTTLE_MINUTES,
        ESCALATION_MAX_THROTTLE_MINUTES,
        ESCALATION_DEFAULT_THROTTLE_MINUTES
      ),
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await this.redis.set(
      escalationPolicyKey(workspaceId),
      JSON.stringify(next),
      'EX',
      SNAPSHOT_TTL_SECONDS
    );

    return {
      ...next,
      notifyOn: next.notifyOn.length ? next.notifyOn : ESCALATION_DEFAULT_NOTIFY_ON,
      channels: next.channels.length ? next.channels : ESCALATION_DEFAULT_CHANNELS,
    };
  }

  async listAlertEvents(workspaceId: string, limit = 100): Promise<SupportAlertEvent[]> {
    const items = await this.redis.lrange(alertsKey(workspaceId), 0, Math.max(0, limit - 1));
    return items
      .map(item => {
        try {
          return JSON.parse(item) as SupportAlertEvent;
        } catch {
          return null;
        }
      })
      .filter((item): item is SupportAlertEvent => Boolean(item));
  }

  async getPublicStatus(workspaceId: string): Promise<SupportPublicStatusDto> {
    const incidents = await this.listIncidents(workspaceId, 20);
    const openIncidents = incidents.filter(item => item.status !== 'resolved');
    const status: SupportPublicStatusDto['status'] = openIncidents.some(
      item => item.severity === 'critical'
    )
      ? 'major_outage'
      : openIncidents.some(item => item.severity === 'high')
        ? 'degraded'
        : 'operational';

    return {
      workspaceId,
      status,
      generatedAt: new Date().toISOString(),
      openIncidentCount: openIncidents.length,
      incidents: openIncidents.map(item => ({
        id: item.id,
        severity: item.severity,
        title: item.title,
        triggeredAt: item.triggeredAt,
      })),
    };
  }

  private async queueEscalationAlerts(
    workspaceId: string,
    incidents: SupportIncident[],
    policy: SupportEscalationPolicy,
    retentionPolicy: SupportRetentionPolicy
  ): Promise<void> {
    if (!incidents.length) return;

    const now = new Date().toISOString();
    const allowedSeverities = new Set(policy.notifyOn);
    const channels = policy.channels.length ? policy.channels : ESCALATION_DEFAULT_CHANNELS;

    for (const incident of incidents) {
      if (!allowedSeverities.has(incident.severity)) continue;

      const throttleKey = escalationThrottleKey(workspaceId, incident.severity);
      const hasActiveThrottle = await this.redis.get(throttleKey);
      if (hasActiveThrottle) continue;

      const tx = this.redis.multi();
      for (const channel of channels) {
        const alert: SupportAlertEvent = {
          id: createAlertId(workspaceId, incident.id, channel),
          workspaceId,
          incidentId: incident.id,
          severity: incident.severity,
          channel,
          status: 'queued',
          queuedAt: now,
          title: incident.title,
        };
        tx.lpush(alertsKey(workspaceId), JSON.stringify(alert));
      }

      tx.ltrim(alertsKey(workspaceId), 0, ALERT_HISTORY_MAX - 1);
      tx.expire(alertsKey(workspaceId), retentionPolicy.snapshotTtlDays * 24 * 60 * 60);
      tx.set(
        throttleKey,
        '1',
        'EX',
        clampInt(
          policy.throttleMinutes,
          ESCALATION_MIN_THROTTLE_MINUTES,
          ESCALATION_MAX_THROTTLE_MINUTES,
          ESCALATION_DEFAULT_THROTTLE_MINUTES
        ) * 60
      );
      await tx.exec();
    }
  }

  private async detectAndStoreIncidents(
    workspaceId: string,
    snapshot: Record<string, unknown> | null,
    errorGroups: Array<Record<string, unknown>>,
    customerHealth: Array<Record<string, unknown>>,
    policy: SupportRetentionPolicy
  ): Promise<void> {
    const incidents: SupportIncident[] = [];
    const now = new Date().toISOString();
    const escalationPolicy = await this.getEscalationPolicyInternal(workspaceId);

    const criticalErrors = errorGroups.filter(group => {
      const rep = group.representativeError;
      return !!rep && typeof rep === 'object' && (rep as Record<string, unknown>).severity === 'critical';
    }).length;

    const unresolvedErrors = errorGroups.filter(group => {
      const val = group.isResolved;
      return val !== true;
    }).length;

    if (criticalErrors > 0) {
      incidents.push({
        id: createIncidentId(workspaceId, 'critical_error_group', 'critical'),
        workspaceId,
        severity: 'critical',
        title: `${criticalErrors} kritische Fehlergruppe(n) erkannt`,
        reason: 'critical_error_group',
        triggeredAt: now,
        status: 'open',
        metrics: {
          criticalErrorGroups: criticalErrors,
          unresolvedErrorGroups: unresolvedErrors,
        },
      });
    }

    const criticalCustomers = customerHealth.filter(item => item.status === 'critical').length;
    const atRiskCustomers = customerHealth.filter(item => item.status === 'at-risk').length;
    if (criticalCustomers > 0) {
      incidents.push({
        id: createIncidentId(workspaceId, 'customer_health_critical', 'high'),
        workspaceId,
        severity: 'high',
        title: `${criticalCustomers} kritische Kundengesundheit(en)`,
        reason: 'customer_health_critical',
        triggeredAt: now,
        status: 'open',
        metrics: {
          criticalCustomers,
          atRiskCustomers,
        },
      });
    }

    if (snapshot) {
      const kpis = snapshot.kpis;
      if (kpis && typeof kpis === 'object') {
        const metrics = kpis as Record<string, unknown>;
        const totalErrors = extractMetricNumber(metrics, 'totalErrors');
        const totalSessions = extractMetricNumber(metrics, 'totalSessions');
        const errorRate = totalSessions > 0 ? totalErrors / totalSessions : 0;
        if (totalErrors >= 50 || errorRate >= 0.1) {
          const severity: SupportIncidentSeverity =
            totalErrors >= 200 || errorRate >= 0.2 ? 'critical' : 'high';
          incidents.push({
            id: createIncidentId(workspaceId, 'error_spike', severity),
            workspaceId,
            severity,
            title: `Error Spike erkannt (${totalErrors} Fehler, ${(errorRate * 100).toFixed(1)}%)`,
            reason: 'error_spike',
            triggeredAt: now,
            status: 'open',
            metrics: {
              totalErrors,
              totalSessions,
              errorRate,
            },
          });
        }
      }
    }

    if (!incidents.length) return;

    const incidentKey = incidentsKey(workspaceId);
    const tx = this.redis.multi();
    for (const incident of incidents) {
      tx.lpush(incidentKey, JSON.stringify(incident));
    }
    tx.ltrim(incidentKey, 0, Math.max(0, Math.min(policy.historyMaxItems, INCIDENT_HISTORY_MAX) - 1));
    tx.expire(incidentKey, policy.snapshotTtlDays * 24 * 60 * 60);
    await tx.exec();

    await this.queueEscalationAlerts(
      workspaceId,
      incidents,
      escalationPolicy,
      policy
    );
  }

  async listIncidents(workspaceId: string, limit = 50): Promise<SupportIncident[]> {
    const items = await this.redis.lrange(incidentsKey(workspaceId), 0, Math.max(0, limit - 1));
    return items
      .map(item => {
        try {
          return JSON.parse(item) as SupportIncident;
        } catch {
          return null;
        }
      })
      .filter((item): item is SupportIncident => Boolean(item));
  }

  async ingestWorkspaceSnapshot(
    workspaceId: string,
    payload: SupportAnalyticsIngestPayload,
    userId?: string
  ): Promise<SupportAnalyticsIngestAck> {
    const policy = await this.getRetentionPolicyInternal(workspaceId);
    const ttlSeconds = policy.snapshotTtlDays * 24 * 60 * 60;
    const storedAt = new Date().toISOString();
    const snapshot = redactValue(payload.snapshot ?? null) as Record<string, unknown> | null;
    const errorGroups = Array.isArray(payload.errorGroups)
      ? (redactValue(payload.errorGroups) as Array<Record<string, unknown>>)
      : [];
    const customerHealth = Array.isArray(payload.customerHealth)
      ? (redactValue(payload.customerHealth) as Array<Record<string, unknown>>)
      : [];
    const performanceSummary = redactValue(payload.performanceSummary ?? null) as Record<string, unknown> | null;

    const historyItem = {
      workspaceId,
      storedAt,
      generatedAt: payload.generatedAt ?? storedAt,
      hasSnapshot: !!snapshot,
      errorGroupCount: errorGroups.length,
      customerHealthCount: customerHealth.length,
      userId: userId ?? null,
      metadata: (redactValue(payload.metadata ?? {}) as Record<string, unknown>) ?? {},
    };

    const tx = this.redis.multi();

    if (snapshot) {
      tx.set(
        latestSnapshotKey(workspaceId),
        JSON.stringify({ ...snapshot, generatedAt: payload.generatedAt ?? storedAt, storedAt }),
        'EX',
        ttlSeconds
      );
    }

    tx.set(
      latestErrorsKey(workspaceId),
      JSON.stringify(errorGroups),
      'EX',
      ttlSeconds
    );
    tx.set(
      latestHealthKey(workspaceId),
      JSON.stringify(customerHealth),
      'EX',
      ttlSeconds
    );

    if (performanceSummary) {
      tx.set(
        latestPerformanceKey(workspaceId),
        JSON.stringify(performanceSummary),
        'EX',
        ttlSeconds
      );
    }

    tx.lpush(historyKey(workspaceId), JSON.stringify(historyItem));
    tx.ltrim(historyKey(workspaceId), 0, policy.historyMaxItems - 1);
    tx.expire(historyKey(workspaceId), ttlSeconds);

    await tx.exec();

    await this.detectAndStoreIncidents(
      workspaceId,
      snapshot,
      errorGroups,
      customerHealth,
      policy
    );

    return {
      ok: true,
      storedAt,
      workspaceId,
      hasSnapshot: !!snapshot,
      errorGroupCount: errorGroups.length,
      customerHealthCount: customerHealth.length,
    };
  }

  async getWorkspaceDashboard(
    workspaceId: string,
    period: SupportAnalyticsPeriod
  ): Promise<SupportAnalyticsDashboardDto> {
    const [snapshotRaw, errorsRaw, healthRaw, perfRaw] = await Promise.all([
      this.redis.get(latestSnapshotKey(workspaceId)),
      this.redis.get(latestErrorsKey(workspaceId)),
      this.redis.get(latestHealthKey(workspaceId)),
      this.redis.get(latestPerformanceKey(workspaceId)),
    ]);

    const snapshot = parseJsonObject(snapshotRaw);
    const latestErrorGroups = parseJsonArray(errorsRaw);
    const latestCustomerHealth = parseJsonArray(healthRaw);
    const latestPerformanceSummary = parseJsonObject(perfRaw);

    return {
      workspaceId,
      period,
      generatedAt: new Date().toISOString(),
      source: snapshot ? 'snapshot' : 'fallback',
      snapshot,
      latestErrorGroups,
      latestCustomerHealth,
      latestPerformanceSummary,
    };
  }
}
