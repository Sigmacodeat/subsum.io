import type {
  AnwaltRole,
  CaseAssistantAction,
  CaseAssistantRole,
  CaseAuditExportService,
  CasePriority,
  ClientKind,
  IngestionJobStatus,
  LegalDocumentRecord,
  MatterRecord,
} from '@affine/core/modules/case-assistant';

export type IngestionMode = 'selection' | 'document';

export type ConnectorDraft = {
  endpoint: string;
  authType: 'none' | 'bearer' | 'api-key';
  authHeaderName: string;
  credential: string;
  rotationDays: string;
  rotationMode: 'soft' | 'hard';
};

export type IntakeDraft = {
  title: string;
  kind: 'note' | 'pdf' | 'scan-pdf' | 'email' | 'docx' | 'xlsx' | 'pptx' | 'other';
  folderPath: string;
  internalFileNumber: string;
  paragraphReferences: string;
  tags: string;
  content: string;
};

export type CopilotCommandIntent =
  | 'draft-court-letter'
  | 'run-full-workflow'
  | 'analyze-case'
  | 'process-ocr'
  | 'folder-summary'
  | 'folder-search'
  | 'intake-note'
  | 'case-qa'
  | 'unknown';

export type CopilotCommand = {
  intent: CopilotCommandIntent;
  folderPath?: string;
};

export type SidebarSectionId =
  | 'cockpit'
  | 'kanzlei'
  | 'mandanten'
  | 'queue'
  | 'automation'
  | 'legal-workflow'
  | 'anwalts-workflow'
  | 'verfahrensstand'
  | 'analytics'
  | 'copilot'
  | 'alerts'
  | 'einstellungen'
  | 'kollision'
  | 'fristenkontrolle'
  | 'rechnungen'
  | 'gwg-compliance'
  | 'dsgvo-compliance'
  | 'document-versioning'
  | 'bea-postfach'
  | 'email-inbox';

export type MobileDockAction =
  | 'intake'
  | 'ocr'
  | 'analyze'
  | 'full-workflow'
  | 'export';

export type DraftSectionStatus = 'pending' | 'accepted' | 'rejected';
export type DraftReviewStatus = 'draft' | 'in_review' | 'approved';

export type DraftSectionCitation = {
  findingId: string;
  findingTitle: string;
  severity: CasePriority;
  confidence: number;
  documentTitle: string;
  quote: string;
};

export type DraftSection = {
  id: string;
  title: string;
  content: string;
  status: DraftSectionStatus;
  citations: DraftSectionCitation[];
};

export type AuditVerificationSnapshot = Awaited<
  ReturnType<CaseAuditExportService['verifyAuditChain']>
>;

export type PendingDestructiveAction = {
  kind: 'client.delete' | 'client.archive' | 'matter.delete' | 'matter.archive';
  entityId: string;
  label: string;
};

export type SupportIncidentSeverity = 'medium' | 'high' | 'critical';
export type SupportIncidentStatus = 'open' | 'acknowledged' | 'resolved';

export type SupportIncident = {
  id: string;
  severity: SupportIncidentSeverity;
  title: string;
  reason: string;
  triggeredAt: string;
  status: SupportIncidentStatus;
};

export type SupportAlert = {
  id: string;
  incidentId: string;
  severity: SupportIncidentSeverity;
  channel: 'email' | 'webhook';
  queuedAt: string;
  title: string;
};

export type SupportAuditEntry = {
  at: string;
  action: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
};

export type SupportRetentionPolicy = {
  snapshotTtlDays: number;
  historyMaxItems: number;
  updatedAt: string;
};

export type SupportEscalationPolicy = {
  notifyOn: SupportIncidentSeverity[];
  channels: Array<'email' | 'webhook'>;
  throttleMinutes: number;
  updatedAt: string;
};

export type SupportStatusSnapshot = {
  status: 'operational' | 'degraded' | 'major_outage';
  generatedAt: string;
  openIncidentCount: number;
};

export const priorityLabel: Record<CasePriority, string> = {
  critical: 'Kritisch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

export const jobStatusLabel: Record<IngestionJobStatus, string> = {
  queued: 'In Warteschlange',
  running: 'Wird verarbeitet',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
};

export const roleRank: Record<CaseAssistantRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
};

export const actionRequiredRole: Record<CaseAssistantAction, CaseAssistantRole> = {
  'connector.configure': 'admin',
  'connector.toggle': 'admin',
  'connector.healthcheck': 'operator',
  'connector.rotate': 'operator',
  'connector.clear_auth': 'admin',
  'connector.dispatch': 'operator',
  'client.manage': 'operator',
  'matter.manage': 'operator',
  'audit.export': 'admin',
  'audit.verify': 'operator',
  'job.cancel': 'operator',
  'job.retry': 'operator',
  'document.upload': 'operator',
  'document.ocr': 'operator',
  'document.analyze': 'operator',
  'task.manage': 'operator',
  'blueprint.manage': 'operator',
  'copilot.execute': 'operator',
  'kanzlei.manage': 'admin',
  'residency.manage': 'admin',
  'folder.search': 'viewer',
  'folder.summarize': 'operator',
  'bulk.execute': 'operator',
  'email.send': 'operator',
  'opposing_party.manage': 'operator',
  'deadline.manage': 'operator',
  'finding.manage': 'operator',
};

export const legalDocumentKindLabel: Record<IntakeDraft['kind'], string> = {
  note: 'Notiz',
  pdf: 'PDF',
  'scan-pdf': 'Scan-PDF',
  email: 'E-Mail',
  docx: 'DOCX',
  xlsx: 'XLSX',
  pptx: 'PPTX',
  other: 'Sonstiges',
};

export const legalDocumentStatusLabel: Record<LegalDocumentRecord['status'], string> = {
  uploaded: 'Hochgeladen',
  ocr_pending: 'OCR ausstehend',
  ocr_running: 'OCR läuft',
  ocr_completed: 'OCR abgeschlossen',
  indexed: 'Indiziert',
  failed: 'Fehlgeschlagen',
};

export const clientKindLabel: Record<ClientKind, string> = {
  person: 'Natürliche Person',
  company: 'Unternehmen',
  authority: 'Behörde',
  other: 'Sonstiges',
};

export const matterStatusLabel: Record<MatterRecord['status'], string> = {
  open: 'Offen',
  closed: 'Abgeschlossen',
  archived: 'Archiviert',
};

export const anwaltRoleLabel: Record<AnwaltRole, string> = {
  partner: 'Partner / Sozius',
  senior_associate: 'Senior Associate (RA)',
  associate: 'Associate (RA)',
  counsel: 'Of Counsel',
  referendar: 'Rechtsanwaltsanwärter',
  other: 'Sonstige',
};

export const bulkOperationTypeLabel: Record<string, string> = {
  email: 'Sammel-Email',
  'pdf-export': 'PDF-Export',
  schriftsatz: 'Sammel-Schriftsatz',
  mandantenbrief: 'Sammel-Mandantenbrief',
  'status-update': 'Status-Update',
};

export const bulkOperationStatusLabel: Record<string, string> = {
  queued: 'Wartend',
  running: 'Wird ausgeführt…',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
  partial: 'Teilweise abgeschlossen',
};

export const emailTemplateTypeLabel: Record<string, string> = {
  mandantenbrief: 'Mandantenanschreiben',
  fristenwarnung: 'Fristenwarnung',
  statusbericht: 'Statusbericht',
  dokumentenversand: 'Dokumentenversand',
  terminbestaetigung: 'Terminbestätigung',
  vollmacht: 'Vollmacht anfordern',
  kostenvoranschlag: 'Kostenvoranschlag',
  custom: 'Freier Text',
};

export const emailStatusLabel: Record<string, string> = {
  draft: 'Entwurf',
  queued: 'Wartend',
  sending: 'Wird gesendet…',
  sent: 'Gesendet',
  failed: 'Fehlgeschlagen',
  bounced: 'Unzustellbar',
};

export const opposingPartyKindLabel: Record<string, string> = {
  person: 'Natürliche Person',
  company: 'Unternehmen',
  authority: 'Behörde',
  other: 'Sonstige',
};
