import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type {
  ClientRecord,
  EmailTemplateType,
  MatterRecord,
} from '../types';
import type { EmailService } from './email';
import type { CasePlatformAdapterService } from './platform-adapters';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'portal' | 'sms' | 'push' | 'whatsapp';

export type NotificationPriority = 'immediate' | 'high' | 'normal' | 'low' | 'digest';

export type NotificationDigestFrequency = 'immediate' | 'daily' | 'weekly';

export type NotificationEventType =
  | 'matter.status_changed'
  | 'matter.assigned'
  | 'matter.closed'
  | 'matter.reopened'
  | 'deadline.approaching'
  | 'deadline.expired'
  | 'deadline.created'
  | 'deadline.completed'
  | 'document.uploaded'
  | 'document.finalized'
  | 'document.shared'
  | 'document.signature_required'
  | 'court_date.scheduled'
  | 'court_date.approaching'
  | 'court_date.rescheduled'
  | 'court_date.cancelled'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.overdue'
  | 'invoice.paid'
  | 'invoice.partially_paid'
  | 'payment.received'
  | 'payment.reminder'
  | 'analysis.complete'
  | 'analysis.findings'
  | 'vollmacht.required'
  | 'vollmacht.signed'
  | 'vollmacht.expired'
  | 'kyc.required'
  | 'kyc.submitted'
  | 'kyc.approved'
  | 'kyc.rejected'
  | 'portal.document_request'
  | 'portal.message_received'
  | 'case.milestone'
  | 'case.note_added'
  | 'communication.new_message';

export interface NotificationTriggerRule {
  id: string;
  event: NotificationEventType;
  templateType: EmailTemplateType;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  enabled: boolean;
  delayMinutes: number;
  subjectTemplate: string;
  bodyTemplate: string;
  condition?: string;
}

export interface NotificationPreference {
  id: string;
  workspaceId: string;
  clientId: string;
  channel: NotificationChannel;
  enabled: boolean;
  digestFrequency: NotificationDigestFrequency;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  language: 'de' | 'en' | 'fr' | 'it';
  enabledEvents: NotificationEventType[];
  disabledEvents: NotificationEventType[];
  createdAt: string;
  updatedAt: string;
}

export type NotificationStatus =
  | 'queued'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'failed'
  | 'bounced'
  | 'suppressed';

export interface NotificationRecord {
  id: string;
  workspaceId: string;
  clientId: string;
  matterId?: string;
  caseId?: string;
  event: NotificationEventType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
  recipientEmail?: string;
  recipientPhone?: string;
  emailId?: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDigest {
  id: string;
  workspaceId: string;
  clientId: string;
  frequency: NotificationDigestFrequency;
  notifications: string[];
  scheduledAt: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
}

// ─── Default Trigger Rules ──────────────────────────────────────────────────

const DEFAULT_TRIGGER_RULES: Omit<NotificationTriggerRule, 'id'>[] = [
  // ── Akten-Status ────────────────────────────────────────────────────────
  {
    event: 'matter.status_changed',
    templateType: 'statusbericht',
    channels: ['email', 'portal'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Statusänderung Ihrer Akte {aktenzeichen}',
    bodyTemplate: 'Der Status Ihrer Akte ({aktenTitel}) hat sich geändert auf: **{neuerStatus}**.\n\n{details}',
  },
  {
    event: 'matter.closed',
    templateType: 'statusbericht',
    channels: ['email', 'portal'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Ihre Akte {aktenzeichen} wurde geschlossen',
    bodyTemplate: 'Ihre Akte ({aktenTitel}) wurde abgeschlossen.\n\n{details}\n\nVielen Dank für Ihr Vertrauen.',
  },
  {
    event: 'matter.assigned',
    templateType: 'mandantenbrief',
    channels: ['email'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Neue Zuständigkeit für Ihre Akte {aktenzeichen}',
    bodyTemplate: 'Für Ihre Akte ({aktenTitel}) ist ab sofort {anwaltName} zuständig.',
  },
  // ── Fristen ─────────────────────────────────────────────────────────────
  {
    event: 'deadline.approaching',
    templateType: 'fristenwarnung',
    channels: ['email', 'portal', 'push'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'FRIST: {fristTitel} läuft ab am {fristDatum}',
    bodyTemplate: 'Eine wichtige Frist in Ihrer Akte ({aktenTitel}) läuft bald ab:\n\n**{fristTitel}**\nAblauf: **{fristDatum}**\n\n{handlungsbedarf}',
  },
  {
    event: 'deadline.expired',
    templateType: 'fristenwarnung',
    channels: ['email', 'portal', 'push'],
    priority: 'immediate',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'ÜBERFÄLLIG: Frist {fristTitel} abgelaufen',
    bodyTemplate: 'Die Frist **{fristTitel}** in Ihrer Akte ({aktenTitel}) ist abgelaufen.\n\nBitte setzen Sie sich umgehend mit uns in Verbindung.',
  },
  {
    event: 'deadline.created',
    templateType: 'mandantenbrief',
    channels: ['email', 'portal'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 5,
    subjectTemplate: 'Neue Frist in Ihrer Akte {aktenzeichen}',
    bodyTemplate: 'In Ihrer Akte ({aktenTitel}) wurde eine neue Frist erfasst:\n\n**{fristTitel}**\nFällig am: **{fristDatum}**',
  },
  // ── Dokumente ───────────────────────────────────────────────────────────
  {
    event: 'document.uploaded',
    templateType: 'dokumentenversand',
    channels: ['email', 'portal'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 2,
    subjectTemplate: 'Neues Dokument in Ihrer Akte {aktenzeichen}',
    bodyTemplate: 'Ein neues Dokument wurde in Ihre Akte ({aktenTitel}) hochgeladen:\n\n**{dokumentName}**\n\nSie können das Dokument über Ihr Mandantenportal einsehen.',
  },
  {
    event: 'document.finalized',
    templateType: 'dokumentenversand',
    channels: ['email', 'portal'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Finales Dokument bereit — Akte {aktenzeichen}',
    bodyTemplate: 'Ein Dokument in Ihrer Akte ({aktenTitel}) wurde finalisiert:\n\n**{dokumentName}**\n\nBitte prüfen und bestätigen Sie den Erhalt.',
  },
  {
    event: 'document.signature_required',
    templateType: 'vollmacht',
    channels: ['email', 'portal', 'push'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Unterschrift erforderlich — Akte {aktenzeichen}',
    bodyTemplate: 'Bitte unterzeichnen Sie das folgende Dokument:\n\n**{dokumentName}**\n\n{portalLink}',
  },
  // ── Gerichtstermine ─────────────────────────────────────────────────────
  {
    event: 'court_date.scheduled',
    templateType: 'terminbestaetigung',
    channels: ['email', 'portal'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Gerichtstermin vereinbart — Akte {aktenzeichen}',
    bodyTemplate: 'Für Ihre Akte ({aktenTitel}) wurde ein Gerichtstermin anberaumt:\n\n**Datum:** {terminDatum}\n**Uhrzeit:** {terminUhrzeit}\n**Gericht:** {gerichtName}\n**Saal:** {saalNummer}\n\nBitte bringen Sie alle relevanten Unterlagen mit.',
  },
  {
    event: 'court_date.approaching',
    templateType: 'terminbestaetigung',
    channels: ['email', 'portal', 'push'],
    priority: 'immediate',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Erinnerung: Gerichtstermin morgen — Akte {aktenzeichen}',
    bodyTemplate: 'Erinnerung an Ihren Gerichtstermin:\n\n**Datum:** {terminDatum}\n**Uhrzeit:** {terminUhrzeit}\n**Gericht:** {gerichtName}\n\nBitte erscheinen Sie pünktlich.',
  },
  {
    event: 'court_date.rescheduled',
    templateType: 'terminbestaetigung',
    channels: ['email', 'portal'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Gerichtstermin verschoben — Akte {aktenzeichen}',
    bodyTemplate: 'Der Gerichtstermin wurde verschoben:\n\n**Neues Datum:** {terminDatum}\n**Uhrzeit:** {terminUhrzeit}\n\nDer alte Termin am {alterTermin} entfällt.',
  },
  // ── Rechnungen & Zahlungen ──────────────────────────────────────────────
  {
    event: 'invoice.created',
    templateType: 'kostenvoranschlag',
    channels: ['email', 'portal'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Neue Rechnung {rechnungsnummer} — Akte {aktenzeichen}',
    bodyTemplate: 'Zu Ihrer Akte ({aktenTitel}) wurde eine Rechnung erstellt:\n\n**Rechnung Nr.:** {rechnungsnummer}\n**Betrag:** {brutto} EUR\n**Fällig am:** {faelligkeitsdatum}\n\nSie können die Rechnung über Ihr Portal einsehen und bezahlen.',
  },
  {
    event: 'invoice.overdue',
    templateType: 'custom',
    channels: ['email', 'portal', 'push'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Zahlungserinnerung: Rechnung {rechnungsnummer} überfällig',
    bodyTemplate: 'Die Rechnung {rechnungsnummer} über {brutto} EUR ist seit {ueberfaelligTage} Tagen überfällig.\n\nBitte überweisen Sie den offenen Betrag umgehend.',
  },
  {
    event: 'payment.received',
    templateType: 'custom',
    channels: ['email', 'portal'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Zahlungseingang bestätigt — Rechnung {rechnungsnummer}',
    bodyTemplate: 'Vielen Dank für Ihre Zahlung über {betrag} EUR zu Rechnung {rechnungsnummer}.\n\nIhr Konto ist damit ausgeglichen.',
  },
  // ── Analyse ─────────────────────────────────────────────────────────────
  {
    event: 'analysis.complete',
    templateType: 'statusbericht',
    channels: ['email', 'portal', 'whatsapp'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 5,
    subjectTemplate: 'Fallanalyse abgeschlossen — Akte {aktenzeichen}',
    bodyTemplate: 'Die Analyse Ihrer Akte ({aktenTitel}) ist abgeschlossen.\n\n**Ergebnisse:**\n{analyseSummary}\n\nIhr Anwalt wird sich zeitnah mit einer Einschätzung bei Ihnen melden.',
  },
  {
    event: 'invoice.sent',
    templateType: 'kostenvoranschlag',
    channels: ['email', 'portal', 'whatsapp'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Rechnung {rechnungsnummer} versendet — Akte {aktenzeichen}',
    bodyTemplate: 'Ihre Rechnung {rechnungsnummer} über {brutto} EUR wurde versendet.\n\nFällig am: {faelligkeitsdatum}\n\n{paymentHint}',
  },
  // ── Vollmacht & KYC ────────────────────────────────────────────────────
  {
    event: 'vollmacht.required',
    templateType: 'vollmacht',
    channels: ['email', 'portal', 'push'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Vollmacht erforderlich — Akte {aktenzeichen}',
    bodyTemplate: 'Für die Bearbeitung Ihrer Akte ({aktenTitel}) benötigen wir eine Vollmacht.\n\nBitte nutzen Sie den sicheren Link: {portalLink}',
  },
  {
    event: 'kyc.required',
    templateType: 'custom',
    channels: ['email', 'portal'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Identitätsnachweis erforderlich',
    bodyTemplate: 'Gemäß den gesetzlichen Sorgfaltspflichten (GwG) benötigen wir einen Identitätsnachweis.\n\nBitte laden Sie Ihren Ausweis über den sicheren Link hoch: {portalLink}',
  },
  // ── Portal ──────────────────────────────────────────────────────────────
  {
    event: 'portal.document_request',
    templateType: 'custom',
    channels: ['email', 'portal', 'push'],
    priority: 'high',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Dokumenten-Upload erbeten — Akte {aktenzeichen}',
    bodyTemplate: 'Bitte laden Sie folgende Dokumente über Ihr Mandantenportal hoch:\n\n{dokumentListe}\n\nLink: {portalLink}',
  },
  {
    event: 'portal.message_received',
    templateType: 'custom',
    channels: ['email'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 1,
    subjectTemplate: 'Neue Nachricht von Ihrer Kanzlei — Akte {aktenzeichen}',
    bodyTemplate: 'Sie haben eine neue Nachricht zu Ihrer Akte ({aktenTitel}).\n\nBitte loggen Sie sich in Ihr Mandantenportal ein, um die Nachricht zu lesen.',
  },
  // ── Meilensteine ────────────────────────────────────────────────────────
  {
    event: 'case.milestone',
    templateType: 'statusbericht',
    channels: ['email', 'portal'],
    priority: 'normal',
    enabled: true,
    delayMinutes: 0,
    subjectTemplate: 'Meilenstein erreicht — Akte {aktenzeichen}',
    bodyTemplate: 'In Ihrer Akte ({aktenTitel}) wurde ein Meilenstein erreicht:\n\n**{meilensteinTitel}**\n\n{details}',
  },
];

// ─── Event-to-Template Mapping Labels ────────────────────────────────────────

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  'matter.status_changed': 'Akten-Status geändert',
  'matter.assigned': 'Neue Zuständigkeit',
  'matter.closed': 'Akte geschlossen',
  'matter.reopened': 'Akte wiedereröffnet',
  'deadline.approaching': 'Frist läuft ab',
  'deadline.expired': 'Frist abgelaufen',
  'deadline.created': 'Neue Frist',
  'deadline.completed': 'Frist erledigt',
  'document.uploaded': 'Dokument hochgeladen',
  'document.finalized': 'Dokument finalisiert',
  'document.shared': 'Dokument geteilt',
  'document.signature_required': 'Unterschrift erforderlich',
  'court_date.scheduled': 'Gerichtstermin anberaumt',
  'court_date.approaching': 'Gerichtstermin-Erinnerung',
  'court_date.rescheduled': 'Termin verschoben',
  'court_date.cancelled': 'Termin abgesagt',
  'invoice.created': 'Rechnung erstellt',
  'invoice.sent': 'Rechnung versendet',
  'invoice.overdue': 'Rechnung überfällig',
  'invoice.paid': 'Rechnung bezahlt',
  'invoice.partially_paid': 'Teilzahlung eingegangen',
  'payment.received': 'Zahlungseingang',
  'payment.reminder': 'Zahlungserinnerung',
  'analysis.complete': 'Analyse abgeschlossen',
  'analysis.findings': 'Neue Erkenntnisse',
  'vollmacht.required': 'Vollmacht erforderlich',
  'vollmacht.signed': 'Vollmacht unterzeichnet',
  'vollmacht.expired': 'Vollmacht abgelaufen',
  'kyc.required': 'KYC erforderlich',
  'kyc.submitted': 'KYC eingereicht',
  'kyc.approved': 'KYC freigegeben',
  'kyc.rejected': 'KYC abgelehnt',
  'portal.document_request': 'Dokument-Upload erbeten',
  'portal.message_received': 'Neue Nachricht',
  'case.milestone': 'Meilenstein erreicht',
  'case.note_added': 'Aktennotiz hinzugefügt',
  'communication.new_message': 'Neue Kommunikation',
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  queued: 'In Warteschlange',
  scheduled: 'Geplant',
  sending: 'Wird gesendet',
  sent: 'Gesendet',
  delivered: 'Zugestellt',
  opened: 'Geöffnet',
  clicked: 'Link geklickt',
  failed: 'Fehlgeschlagen',
  bounced: 'Zurückgewiesen',
  suppressed: 'Unterdrückt',
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * MandantenNotificationService — Automatisierte Mandanten-Benachrichtigungen
 *
 * Event-basierte Auto-Notifications bei Statusänderungen, Fristen, Dokumenten,
 * Rechnungen, Gerichtsterminen und Portal-Aktionen.
 *
 * Features:
 * - 35+ Event-Trigger mit konfigurierbaren Regeln
 * - Per-Mandant Notification Preferences (Kanal, Digest, Quiet Hours, Sprache)
 * - Priority-basierte Zustellung (immediate/high/normal/low/digest)
 * - Digest-Zusammenfassung (sofort/täglich/wöchentlich)
 * - Quiet Hours Respektierung
 * - Multi-Channel (Email, Portal, SMS, Push)
 * - Retry-Logik mit exponential Backoff
 * - Delivery-Tracking (queued → sent → delivered → opened)
 * - Vollständiger Audit-Trail
 */
export class MandantenNotificationService extends Service {
  private rulesMap$ = new BehaviorSubject<Record<string, NotificationTriggerRule>>({});
  private preferencesMap$ = new BehaviorSubject<Record<string, NotificationPreference>>({});
  private notificationsMap$ = new BehaviorSubject<Record<string, NotificationRecord>>({});
  private digestMap$ = new BehaviorSubject<Record<string, NotificationDigest>>({});
  private poller: ReturnType<typeof setInterval> | null = null;

  readonly rulesList$ = this.rulesMap$.pipe(map(m => Object.values(m)));
  readonly preferencesList$ = this.preferencesMap$.pipe(map(m => Object.values(m)));
  readonly notificationsList$ = this.notificationsMap$.pipe(map(m => Object.values(m)));
  readonly digestList$ = this.digestMap$.pipe(map(m => Object.values(m)));

  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly emailService: EmailService,
    private readonly adapterService: CasePlatformAdapterService
  ) {
    super();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  async start(intervalMs = 60_000) {
    this.stop();
    await this.initializeDefaultRules();
    await this.processQueue();
    this.poller = setInterval(() => {
      this.processQueue().catch(err =>
        console.error('[notification] queue processing failed', err)
      );
    }, intervalMs);
  }

  stop() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  override dispose(): void {
    this.stop();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIGGER RULES
  // ═══════════════════════════════════════════════════════════════════════════

  async initializeDefaultRules() {
    if (Object.keys(this.rulesMap$.value).length > 0) return;

    const rulesMap: Record<string, NotificationTriggerRule> = {};
    for (const rule of DEFAULT_TRIGGER_RULES) {
      const id = createId('ntf-rule');
      rulesMap[id] = { ...rule, id };
    }
    this.rulesMap$.next(rulesMap);
  }

  getRulesForEvent(event: NotificationEventType): NotificationTriggerRule[] {
    return Object.values(this.rulesMap$.value).filter(
      r => r.event === event && r.enabled
    );
  }

  async updateRule(
    ruleId: string,
    updates: Partial<Omit<NotificationTriggerRule, 'id'>>
  ): Promise<NotificationTriggerRule | null> {
    const existing = this.rulesMap$.value[ruleId];
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    this.rulesMap$.next({ ...this.rulesMap$.value, [ruleId]: updated });
    return updated;
  }

  async toggleRule(ruleId: string, enabled: boolean): Promise<NotificationTriggerRule | null> {
    return this.updateRule(ruleId, { enabled });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════

  getPreferencesForClient(clientId: string): NotificationPreference[] {
    return Object.values(this.preferencesMap$.value).filter(
      p => p.clientId === clientId
    );
  }

  getEffectivePreference(clientId: string, channel: NotificationChannel): NotificationPreference | null {
    return Object.values(this.preferencesMap$.value).find(
      p => p.clientId === clientId && p.channel === channel
    ) ?? null;
  }

  async upsertPreference(input: {
    workspaceId: string;
    clientId: string;
    channel: NotificationChannel;
    enabled?: boolean;
    digestFrequency?: NotificationDigestFrequency;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    language?: 'de' | 'en' | 'fr' | 'it';
    enabledEvents?: NotificationEventType[];
    disabledEvents?: NotificationEventType[];
  }): Promise<NotificationPreference> {
    const existing = this.getEffectivePreference(input.clientId, input.channel);
    const now = new Date().toISOString();

    const pref: NotificationPreference = {
      id: existing?.id ?? createId('ntf-pref'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      channel: input.channel,
      enabled: input.enabled ?? existing?.enabled ?? true,
      digestFrequency: input.digestFrequency ?? existing?.digestFrequency ?? 'immediate',
      quietHoursStart: input.quietHoursStart ?? existing?.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd ?? existing?.quietHoursEnd,
      language: input.language ?? existing?.language ?? 'de',
      enabledEvents: input.enabledEvents ?? existing?.enabledEvents ?? [],
      disabledEvents: input.disabledEvents ?? existing?.disabledEvents ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.preferencesMap$.next({ ...this.preferencesMap$.value, [pref.id]: pref });
    return pref;
  }

  private isEventEnabledForClient(clientId: string, event: NotificationEventType, channel: NotificationChannel): boolean {
    const pref = this.getEffectivePreference(clientId, channel);
    if (!pref) return true;
    if (!pref.enabled) return false;
    if (pref.disabledEvents.includes(event)) return false;
    if (pref.enabledEvents.length > 0 && !pref.enabledEvents.includes(event)) return false;
    return true;
  }

  private isInQuietHours(clientId: string, channel: NotificationChannel): boolean {
    const pref = this.getEffectivePreference(clientId, channel);
    if (!pref?.quietHoursStart || !pref?.quietHoursEnd) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = pref.quietHoursStart.split(':').map(Number);
    const [endH, endM] = pref.quietHoursEnd.split(':').map(Number);
    const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  private getDigestFrequency(clientId: string, channel: NotificationChannel): NotificationDigestFrequency {
    const pref = this.getEffectivePreference(clientId, channel);
    return pref?.digestFrequency ?? 'immediate';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIRE NOTIFICATION (Main Entry Point)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fire a notification event — resolves rules, checks preferences, creates records
   */
  async fireEvent(input: {
    workspaceId: string;
    event: NotificationEventType;
    clientId: string;
    matterId?: string;
    caseId?: string;
    variables: Record<string, string>;
  }): Promise<NotificationRecord[]> {
    const rules = this.getRulesForEvent(input.event);
    if (rules.length === 0) return [];

    const graph = await this.orchestration.getGraph();
    const client = graph.clients?.[input.clientId];
    if (!client) return [];

    const matter = input.matterId ? graph.matters?.[input.matterId] : undefined;

    const contextVars = this.buildContextVariables(client, matter, input.variables);
    const created: NotificationRecord[] = [];

    for (const rule of rules) {
      for (const channel of rule.channels) {
        if (!this.isEventEnabledForClient(input.clientId, input.event, channel)) {
          continue;
        }

        const subject = this.interpolate(rule.subjectTemplate, contextVars);
        const bodyPlain = this.interpolate(rule.bodyTemplate, contextVars);
        const bodyHtml = this.plainToHtml(bodyPlain);

        const shouldDelay =
          rule.delayMinutes > 0 ||
          this.isInQuietHours(input.clientId, channel) ||
          rule.priority === 'digest';

        const digest = this.getDigestFrequency(input.clientId, channel);
        const useDigest = digest !== 'immediate' && rule.priority !== 'immediate' && rule.priority !== 'high';

        const scheduledAt = shouldDelay && !useDigest
          ? new Date(Date.now() + rule.delayMinutes * 60_000).toISOString()
          : undefined;

        const now = new Date().toISOString();

        const record: NotificationRecord = {
          id: createId('ntf'),
          workspaceId: input.workspaceId,
          clientId: input.clientId,
          matterId: input.matterId,
          caseId: input.caseId,
          event: input.event,
          channel,
          priority: rule.priority,
          status: useDigest ? 'scheduled' : (scheduledAt ? 'scheduled' : 'queued'),
          subject,
          bodyPlain,
          bodyHtml,
          recipientEmail: client.primaryEmail,
          recipientPhone: client.primaryPhone,
          retryCount: 0,
          maxRetries: 3,
          scheduledAt,
          metadata: {
            triggeredBy: rule.id,
            ...input.variables,
          },
          createdAt: now,
          updatedAt: now,
        };

        this.notificationsMap$.next({
          ...this.notificationsMap$.value,
          [record.id]: record,
        });

        if (useDigest) {
          await this.addToDigest(record);
        }

        created.push(record);
      }
    }

    if (created.length > 0) {
      await this.orchestration.appendAuditEntry({
        workspaceId: input.workspaceId,
        caseId: input.caseId ?? '',
        action: `notification.event.${input.event}`,
        severity: 'info',
        details: `${created.length} Benachrichtigung(en) für Event '${NOTIFICATION_EVENT_LABELS[input.event]}' erstellt.`,
        metadata: {
          event: input.event,
          clientId: input.clientId,
          channels: [...new Set(created.map(n => n.channel))].join(','),
          count: String(created.length),
        },
      });

      await this.processQueue();
    }

    return created;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUEUE PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  async processQueue(): Promise<{ sent: number; failed: number }> {
    const now = Date.now();
    const queued = Object.values(this.notificationsMap$.value).filter(n => {
      if (n.status !== 'queued' && n.status !== 'scheduled') return false;
      if (n.status === 'scheduled' && n.scheduledAt) {
        return new Date(n.scheduledAt).getTime() <= now;
      }
      return n.status === 'queued';
    });

    let sent = 0;
    let failed = 0;

    for (const notification of queued) {
      try {
        await this.sendNotification(notification);
        sent++;
      } catch {
        failed++;
        await this.markFailed(notification.id, 'Versand fehlgeschlagen');
      }
    }

    return { sent, failed };
  }

  private async sendNotification(notification: NotificationRecord): Promise<void> {
    if (notification.channel === 'email') {
      await this.sendEmailNotification(notification);
    } else if (notification.channel === 'whatsapp') {
      await this.sendWhatsappNotification(notification);
    } else if (notification.channel === 'portal') {
      await this.sendPortalNotification(notification);
    } else if (notification.channel === 'push') {
      await this.sendPushNotification(notification);
    } else if (notification.channel === 'sms') {
      await this.sendSmsNotification(notification);
    }
  }

  private async sendEmailNotification(notification: NotificationRecord): Promise<void> {
    if (!notification.recipientEmail) {
      await this.markFailed(notification.id, 'Keine E-Mail-Adresse vorhanden');
      return;
    }

    this.updateNotificationStatus(notification.id, 'sending');

    const graph = await this.orchestration.getGraph();
    const kanzleiProfile = graph.kanzleiProfile;
    const senderName = kanzleiProfile?.name ?? 'Kanzlei';
    const senderEmail = kanzleiProfile?.email ?? 'kanzlei@subsum.io';

    const result = await this.emailService.sendEmail({
      workspaceId: notification.workspaceId,
      matterId: notification.matterId,
      clientId: notification.clientId,
      recipientEmail: notification.recipientEmail,
      templateType: 'custom',
      subject: notification.subject,
      bodyTemplate: notification.bodyPlain,
      senderName,
      senderEmail,
    });

    if (result.success) {
      this.updateNotificationStatus(notification.id, 'sent', {
        emailId: result.emailId,
        sentAt: new Date().toISOString(),
      });
    } else {
      if (notification.retryCount < notification.maxRetries) {
        const backoffMs = Math.pow(2, notification.retryCount) * 30_000;
        this.updateNotificationStatus(notification.id, 'scheduled', {
          retryCount: notification.retryCount + 1,
          scheduledAt: new Date(Date.now() + backoffMs).toISOString(),
          errorMessage: result.message,
        });
      } else {
        await this.markFailed(notification.id, result.message);
      }
    }
  }

  private async sendPortalNotification(notification: NotificationRecord): Promise<void> {
    this.updateNotificationStatus(notification.id, 'sent', {
      sentAt: new Date().toISOString(),
      metadata: {
        ...notification.metadata,
        delivery: 'portal_inbox',
      },
    });
  }

  private async sendPushNotification(notification: NotificationRecord): Promise<void> {
    this.updateNotificationStatus(notification.id, 'sent', {
      sentAt: new Date().toISOString(),
      metadata: {
        ...notification.metadata,
        delivery: 'push_queued',
      },
    });
  }

  private async sendSmsNotification(notification: NotificationRecord): Promise<void> {
    if (!notification.recipientPhone) {
      await this.markFailed(notification.id, 'Keine Telefonnummer vorhanden');
      return;
    }

    this.updateNotificationStatus(notification.id, 'sent', {
      sentAt: new Date().toISOString(),
      metadata: {
        ...notification.metadata,
        delivery: 'sms_queued',
      },
    });
  }

  private async sendWhatsappNotification(notification: NotificationRecord): Promise<void> {
    if (!notification.recipientPhone) {
      await this.markFailed(notification.id, 'Keine Telefonnummer für WhatsApp vorhanden');
      return;
    }

    this.updateNotificationStatus(notification.id, 'sending');

    const attachmentRefs = notification.metadata?.attachmentRefs ?? '';
    const result = await this.adapterService.dispatchN8nWorkflow({
      caseId: notification.caseId ?? '',
      workspaceId: notification.workspaceId,
      workflow: 'mandanten_whatsapp_dispatch',
      payload: {
        clientId: notification.clientId,
        matterId: notification.matterId ?? '',
        notificationId: notification.id,
        event: notification.event,
        toPhone: notification.recipientPhone,
        subject: notification.subject,
        message: `${notification.subject}\n\n${notification.bodyPlain}`,
        attachmentRefs,
      },
    });

    if (result.ok) {
      this.updateNotificationStatus(notification.id, 'sent', {
        sentAt: new Date().toISOString(),
        metadata: {
          ...notification.metadata,
          delivery: 'whatsapp_dispatched',
          connectorId: result.connectorId,
        },
      });
      return;
    }

    if (notification.retryCount < notification.maxRetries) {
      const backoffMs = Math.pow(2, notification.retryCount) * 30_000;
      this.updateNotificationStatus(notification.id, 'scheduled', {
        retryCount: notification.retryCount + 1,
        scheduledAt: new Date(Date.now() + backoffMs).toISOString(),
        errorMessage: result.message,
      });
    } else {
      await this.markFailed(notification.id, result.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIGEST
  // ═══════════════════════════════════════════════════════════════════════════

  private async addToDigest(notification: NotificationRecord): Promise<void> {
    const frequency = this.getDigestFrequency(notification.clientId, notification.channel);

    const existing = Object.values(this.digestMap$.value).find(
      d => d.clientId === notification.clientId &&
           d.frequency === frequency &&
           d.status === 'pending'
    );

    if (existing) {
      this.digestMap$.next({
        ...this.digestMap$.value,
        [existing.id]: {
          ...existing,
          notifications: [...existing.notifications, notification.id],
        },
      });
    } else {
      const scheduledMs = frequency === 'daily' ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000;
      const digest: NotificationDigest = {
        id: createId('ntf-digest'),
        workspaceId: notification.workspaceId,
        clientId: notification.clientId,
        frequency,
        notifications: [notification.id],
        scheduledAt: new Date(Date.now() + scheduledMs).toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      this.digestMap$.next({ ...this.digestMap$.value, [digest.id]: digest });
    }
  }

  async processPendingDigests(): Promise<number> {
    const now = new Date().toISOString();
    const pending = Object.values(this.digestMap$.value).filter(
      d => d.status === 'pending' && d.scheduledAt <= now
    );

    let sent = 0;

    for (const digest of pending) {
      const notifications = digest.notifications
        .map(id => this.notificationsMap$.value[id])
        .filter(Boolean) as NotificationRecord[];

      if (notifications.length === 0) continue;

      const subject = `Zusammenfassung: ${notifications.length} Neuigkeiten zu Ihren Akten`;
      const bodyParts = notifications.map(
        n => `• **${n.subject}**\n  ${n.bodyPlain.split('\n')[0]}`
      );
      const bodyPlain = `Hier ist Ihre Zusammenfassung:\n\n${bodyParts.join('\n\n')}`;

      const graph = await this.orchestration.getGraph();
      const client = graph.clients?.[digest.clientId];
      if (!client?.primaryEmail) continue;

      const kanzleiProfile = graph.kanzleiProfile;

      await this.emailService.sendEmail({
        workspaceId: digest.workspaceId,
        clientId: digest.clientId,
        recipientEmail: client.primaryEmail,
        templateType: 'custom',
        subject,
        bodyTemplate: bodyPlain,
        senderName: kanzleiProfile?.name ?? 'Kanzlei',
        senderEmail: kanzleiProfile?.email ?? 'kanzlei@subsum.io',
      });

      this.digestMap$.next({
        ...this.digestMap$.value,
        [digest.id]: { ...digest, status: 'sent', sentAt: new Date().toISOString() },
      });

      for (const n of notifications) {
        this.updateNotificationStatus(n.id, 'sent', { sentAt: new Date().toISOString() });
      }

      sent++;
    }

    return sent;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  private updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus,
    updates?: Partial<NotificationRecord>
  ): void {
    const existing = this.notificationsMap$.value[notificationId];
    if (!existing) return;

    this.notificationsMap$.next({
      ...this.notificationsMap$.value,
      [notificationId]: {
        ...existing,
        ...updates,
        status,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  private async markFailed(notificationId: string, errorMessage: string): Promise<void> {
    this.updateNotificationStatus(notificationId, 'failed', {
      failedAt: new Date().toISOString(),
      errorMessage,
    });

    const notification = this.notificationsMap$.value[notificationId];
    if (notification) {
      await this.orchestration.appendAuditEntry({
        workspaceId: notification.workspaceId,
        caseId: notification.caseId ?? '',
        action: 'notification.failed',
        severity: 'warning',
        details: `Benachrichtigung fehlgeschlagen: ${errorMessage}`,
        metadata: {
          notificationId,
          event: notification.event,
          channel: notification.channel,
        },
      });
    }
  }

  async markDelivered(notificationId: string): Promise<void> {
    this.updateNotificationStatus(notificationId, 'delivered', {
      deliveredAt: new Date().toISOString(),
    });
  }

  async markOpened(notificationId: string): Promise<void> {
    this.updateNotificationStatus(notificationId, 'opened', {
      openedAt: new Date().toISOString(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  getNotificationsForClient(clientId: string): NotificationRecord[] {
    return Object.values(this.notificationsMap$.value)
      .filter(n => n.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getNotificationsForMatter(matterId: string): NotificationRecord[] {
    return Object.values(this.notificationsMap$.value)
      .filter(n => n.matterId === matterId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getRecentNotifications(limit = 50): NotificationRecord[] {
    return Object.values(this.notificationsMap$.value)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  getFailedNotifications(): NotificationRecord[] {
    return Object.values(this.notificationsMap$.value).filter(n => n.status === 'failed');
  }

  async retryFailedNotification(notificationId: string): Promise<boolean> {
    const existing = this.notificationsMap$.value[notificationId];
    if (!existing || existing.status !== 'failed') return false;

    this.updateNotificationStatus(notificationId, 'queued', {
      retryCount: existing.retryCount + 1,
      errorMessage: undefined,
      failedAt: undefined,
    });

    await this.processQueue();
    return true;
  }

  getDashboardStats(): {
    totalSent: number;
    totalFailed: number;
    totalQueued: number;
    totalOpened: number;
    openRate: number;
    channelBreakdown: Record<NotificationChannel, number>;
    eventBreakdown: Record<string, number>;
  } {
    const all = Object.values(this.notificationsMap$.value);

    const totalSent = all.filter(n => n.status === 'sent' || n.status === 'delivered' || n.status === 'opened').length;
    const totalFailed = all.filter(n => n.status === 'failed' || n.status === 'bounced').length;
    const totalQueued = all.filter(n => n.status === 'queued' || n.status === 'scheduled').length;
    const totalOpened = all.filter(n => n.status === 'opened').length;
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

    const channelBreakdown: Record<NotificationChannel, number> = {
      email: 0, portal: 0, sms: 0, push: 0, whatsapp: 0,
    };
    for (const n of all) {
      channelBreakdown[n.channel] = (channelBreakdown[n.channel] ?? 0) + 1;
    }

    const eventBreakdown: Record<string, number> = {};
    for (const n of all) {
      eventBreakdown[n.event] = (eventBreakdown[n.event] ?? 0) + 1;
    }

    return {
      totalSent,
      totalFailed,
      totalQueued,
      totalOpened,
      openRate,
      channelBreakdown,
      eventBreakdown,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private buildContextVariables(
    client: ClientRecord,
    matter: MatterRecord | undefined,
    custom: Record<string, string>
  ): Record<string, string> {
    return {
      mandantName: client.displayName,
      mandantAnrede: client.kind === 'company' ? 'Firma' :
                     client.kind === 'authority' ? '' : 'Herr/Frau',
      aktenzeichen: matter?.externalRef ?? '',
      aktenTitel: matter?.title ?? '',
      datum: new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date()),
      ...custom,
    };
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value ?? '');
    }
    return result;
  }

  private plainToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }
}
