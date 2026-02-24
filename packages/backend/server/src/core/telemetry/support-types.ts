export type SupportAnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export type SupportAnalyticsIngestPayload = {
  schemaVersion: 1;
  generatedAt?: string;
  snapshot?: Record<string, unknown>;
  errorGroups?: Array<Record<string, unknown>>;
  customerHealth?: Array<Record<string, unknown>>;
  performanceSummary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type SupportAnalyticsIngestAck = {
  ok: true;
  storedAt: string;
  workspaceId: string;
  hasSnapshot: boolean;
  errorGroupCount: number;
  customerHealthCount: number;
};

export type SupportAnalyticsDashboardDto = {
  workspaceId: string;
  period: SupportAnalyticsPeriod;
  generatedAt: string;
  source: 'snapshot' | 'fallback';
  snapshot: Record<string, unknown> | null;
  latestErrorGroups: Array<Record<string, unknown>>;
  latestCustomerHealth: Array<Record<string, unknown>>;
  latestPerformanceSummary: Record<string, unknown> | null;
};

export type SupportRetentionPolicy = {
  workspaceId: string;
  snapshotTtlDays: number;
  historyMaxItems: number;
  updatedAt: string;
  updatedBy?: string;
};

export type SupportRetentionPolicyInput = {
  snapshotTtlDays?: number;
  historyMaxItems?: number;
};

export type SupportAccessAuditEntry = {
  at: string;
  workspaceId: string;
  action:
    | 'support.snapshot.ingest'
    | 'support.dashboard.read'
    | 'support.audit.read'
    | 'support.retention.read'
    | 'support.retention.update'
    | 'support.escalation.read'
    | 'support.escalation.update'
    | 'support.incident.read';
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export type SupportIncidentSeverity = 'medium' | 'high' | 'critical';

export type SupportIncident = {
  id: string;
  workspaceId: string;
  severity: SupportIncidentSeverity;
  title: string;
  reason:
    | 'error_spike'
    | 'critical_error_group'
    | 'customer_health_critical'
    | 'customer_health_at_risk_spike';
  triggeredAt: string;
  status: 'open' | 'acknowledged' | 'resolved';
  metrics?: Record<string, number>;
};

export type SupportEscalationPolicy = {
  workspaceId: string;
  notifyOn: SupportIncidentSeverity[];
  channels: Array<'email' | 'webhook'>;
  throttleMinutes: number;
  updatedAt: string;
  updatedBy?: string;
};

export type SupportEscalationPolicyInput = {
  notifyOn?: SupportIncidentSeverity[];
  channels?: Array<'email' | 'webhook'>;
  throttleMinutes?: number;
};

export type SupportAlertEvent = {
  id: string;
  workspaceId: string;
  incidentId: string;
  severity: SupportIncidentSeverity;
  channel: 'email' | 'webhook';
  status: 'queued';
  queuedAt: string;
  title: string;
};

export type SupportPublicStatusDto = {
  workspaceId: string;
  status: 'operational' | 'degraded' | 'major_outage';
  generatedAt: string;
  openIncidentCount: number;
  incidents: Array<Pick<SupportIncident, 'id' | 'severity' | 'title' | 'triggeredAt'>>;
};
