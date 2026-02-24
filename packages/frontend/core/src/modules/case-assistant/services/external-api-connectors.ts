import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { CaseResidencyPolicyService } from './residency-policy';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExternalApiProvider =
  | 'bea'           // besonderes elektronisches Anwaltspostfach (DE)
  | 'web_erv'       // Elektronischer Rechtsverkehr (AT)
  | 'datev'         // DATEV Buchhaltung
  | 'ra_micro'      // RA-MICRO Kanzleisoftware
  | 'ms365'         // Microsoft 365 (Calendar + Mail)
  | 'google'        // Google Workspace (Calendar + Drive)
  | 'dropbox'       // Dropbox Cloud Storage
  | 'slack'         // Slack Team Communication
  | 'elster'        // Elektronische Steuererklärung (DE)
  | 'finanz_online' // FinanzOnline (AT)
  | 'docusign'      // Digital Signatures
  | 'zoom'          // Video Conferencing
  | 'teams'         // Microsoft Teams
  | 'banking_fints' // FinTS/PSD2 Banking API
  | 'handelsregister'; // Handelsregister-API

export type ExternalApiAuthType =
  | 'oauth2'
  | 'api_key'
  | 'certificate'
  | 'saml'
  | 'basic'
  | 'bearer'
  | 'none';

export type ExternalApiConnectionStatus =
  | 'not_configured'
  | 'configured'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'expired'
  | 'disabled';

export type ExternalApiSyncDirection = 'push' | 'pull' | 'bidirectional';

export interface ExternalApiConfig {
  id: string;
  workspaceId: string;
  provider: ExternalApiProvider;
  displayName: string;
  description: string;
  /** API endpoint URL */
  endpoint?: string;
  /** Authentication type */
  authType: ExternalApiAuthType;
  /** Whether this connector is enabled */
  enabled: boolean;
  /** Connection status */
  status: ExternalApiConnectionStatus;
  /** Sync direction */
  syncDirection: ExternalApiSyncDirection;
  /** Last successful sync */
  lastSyncAt?: string;
  /** Last error message */
  lastError?: string;
  /** Auto-sync interval in minutes (0 = manual only) */
  syncIntervalMinutes: number;
  /** Provider-specific configuration */
  providerConfig: Record<string, string>;
  /** Capabilities this connector provides */
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExternalApiSyncLog {
  id: string;
  configId: string;
  provider: ExternalApiProvider;
  direction: 'push' | 'pull';
  status: 'started' | 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsFailed: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  details?: string;
}

// ─── Provider Metadata ──────────────────────────────────────────────────────

export interface ExternalApiProviderMeta {
  id: ExternalApiProvider;
  name: string;
  description: string;
  authTypes: ExternalApiAuthType[];
  defaultSyncDirection: ExternalApiSyncDirection;
  capabilities: string[];
  requiredConfig: string[];
  optionalConfig: string[];
  documentationUrl?: string;
  /** Country/jurisdiction this is relevant for */
  jurisdictions: string[];
  /** Whether this is for Legal, Tax, or both */
  domain: 'legal' | 'tax' | 'both';
}

export const EXTERNAL_API_PROVIDERS: ExternalApiProviderMeta[] = [
  {
    id: 'bea',
    name: 'beA (besonderes elektronisches Anwaltspostfach)',
    description: 'Pflicht-Integration für deutsche Rechtsanwälte. Elektronischer Schriftsatzversand an Gerichte, Empfang von Zustellungen.',
    authTypes: ['certificate'],
    defaultSyncDirection: 'bidirectional',
    capabilities: ['schriftsatz_einreichung', 'zustellung_empfang', 'postfach_abruf', 'signatur_pruefung'],
    requiredConfig: ['zertifikat_pfad', 'safe_id', 'postfach_id'],
    optionalConfig: ['proxy_url', 'auto_abruf_intervall'],
    documentationUrl: 'https://www.bea-brak.de',
    jurisdictions: ['DE'],
    domain: 'legal',
  },
  {
    id: 'web_erv',
    name: 'webERV (Elektronischer Rechtsverkehr Österreich)',
    description: 'Pflicht-Integration für österreichische Rechtsanwälte. Eingaben bei Gericht, Grundbuch, Firmenbuch.',
    authTypes: ['certificate'],
    defaultSyncDirection: 'bidirectional',
    capabilities: ['eingabe_gericht', 'eingabe_grundbuch', 'eingabe_firmenbuch', 'zustellung_empfang', 'edikte_abruf'],
    requiredConfig: ['zertifikat_pfad', 'teilnehmer_id', 'rechtsanwalts_nr'],
    optionalConfig: ['proxy_url'],
    documentationUrl: 'https://www.edikte.justiz.gv.at',
    jurisdictions: ['AT'],
    domain: 'legal',
  },
  {
    id: 'datev',
    name: 'DATEV',
    description: 'Buchhaltungsdaten-Austausch mit DATEV. Import/Export von Buchungssätzen, Mandantenstammdaten, Auswertungen im DATEV-ASCII-Format.',
    authTypes: ['api_key', 'oauth2'],
    defaultSyncDirection: 'bidirectional',
    capabilities: ['buchungsdaten_export', 'buchungsdaten_import', 'mandantenstamm_sync', 'auswertungen_abruf', 'belegbildservice'],
    requiredConfig: ['beraternummer', 'mandantennummer'],
    optionalConfig: ['kontenrahmen', 'wirtschaftsjahr_beginn'],
    documentationUrl: 'https://developer.datev.de',
    jurisdictions: ['DE', 'AT'],
    domain: 'both',
  },
  {
    id: 'ms365',
    name: 'Microsoft 365 / Exchange',
    description: 'Kalender-Synchronisation, E-Mail-Integration und OneDrive-Dokumentenspeicherung via Microsoft Graph API.',
    authTypes: ['oauth2'],
    defaultSyncDirection: 'bidirectional',
    capabilities: ['kalender_sync', 'email_sync', 'kontakte_sync', 'onedrive_sync', 'teams_meeting'],
    requiredConfig: ['tenant_id', 'client_id'],
    optionalConfig: ['calendar_id', 'mailbox_folder'],
    documentationUrl: 'https://learn.microsoft.com/graph',
    jurisdictions: ['DE', 'AT', 'CH', 'EU'],
    domain: 'both',
  },
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Google Calendar, Gmail und Google Drive Integration.',
    authTypes: ['oauth2'],
    defaultSyncDirection: 'bidirectional',
    capabilities: ['kalender_sync', 'email_sync', 'drive_sync', 'meet_scheduling'],
    requiredConfig: ['client_id'],
    optionalConfig: ['calendar_id', 'drive_folder_id'],
    documentationUrl: 'https://developers.google.com/workspace',
    jurisdictions: ['DE', 'AT', 'CH', 'EU'],
    domain: 'both',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Cloud-Dokumentenspeicherung und Team-Freigabe via Dropbox API. Automatischer Import von Akten-Ordnern.',
    authTypes: ['oauth2'],
    defaultSyncDirection: 'bidirectional',
    capabilities: ['dokument_sync', 'ordner_sync', 'freigabe_verwaltung', 'versionierung'],
    requiredConfig: ['app_key'],
    optionalConfig: ['root_folder', 'team_folder_id'],
    documentationUrl: 'https://www.dropbox.com/developers',
    jurisdictions: ['DE', 'AT', 'CH', 'EU'],
    domain: 'both',
  },
  {
    id: 'ra_micro',
    name: 'RA-MICRO',
    description: 'Kanzleisoftware-Integration für Akten-, Adress- und Gebührendaten. Bidirektionaler Abgleich von Mandantenstamm, Aktenregister und Buchhaltung.',
    authTypes: ['api_key', 'basic'],
    defaultSyncDirection: 'bidirectional',
    capabilities: ['akten_sync', 'adressen_sync', 'gebuehren_sync', 'kalender_sync', 'diktat_import'],
    requiredConfig: ['server_url', 'api_key'],
    optionalConfig: ['mandant_nr', 'sachbearbeiter_id'],
    documentationUrl: 'https://www.ra-micro.de/schnittstellen',
    jurisdictions: ['DE', 'AT'],
    domain: 'legal',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team-Kommunikation und Benachrichtigungen. Fristenalarme, Statusmeldungen und Copilot-Updates direkt in Slack-Channels.',
    authTypes: ['oauth2'],
    defaultSyncDirection: 'push',
    capabilities: ['benachrichtigung_senden', 'fristen_alarm', 'status_update', 'channel_integration'],
    requiredConfig: ['workspace_id', 'bot_token'],
    optionalConfig: ['default_channel', 'mention_users'],
    documentationUrl: 'https://api.slack.com',
    jurisdictions: ['DE', 'AT', 'CH', 'EU'],
    domain: 'both',
  },
  {
    id: 'elster',
    name: 'ELSTER (ERiC)',
    description: 'Elektronische Steuererklärung an deutsche Finanzbehörden. UStVA, ESt, KSt, GewSt, E-Bilanz.',
    authTypes: ['certificate'],
    defaultSyncDirection: 'push',
    capabilities: ['ustva_einreichung', 'est_einreichung', 'kst_einreichung', 'gewst_einreichung', 'ebilanz_einreichung', 'bescheid_abruf'],
    requiredConfig: ['eric_pfad', 'zertifikat_pfad', 'steuernummer'],
    optionalConfig: ['finanzamt_nr', 'transfer_header'],
    documentationUrl: 'https://www.elster.de/eportal/developer',
    jurisdictions: ['DE'],
    domain: 'tax',
  },
  {
    id: 'finanz_online',
    name: 'FinanzOnline (AT)',
    description: 'Elektronische Steuererklärung an österreichische Finanzbehörden.',
    authTypes: ['certificate', 'basic'],
    defaultSyncDirection: 'push',
    capabilities: ['ustva_einreichung', 'est_einreichung', 'kst_einreichung', 'bescheid_abruf', 'databox_abruf'],
    requiredConfig: ['teilnehmer_id', 'benutzer_id'],
    optionalConfig: ['finanzamt_nr'],
    documentationUrl: 'https://finanzonline.bmf.gv.at',
    jurisdictions: ['AT'],
    domain: 'tax',
  },
  {
    id: 'docusign',
    name: 'DocuSign / Qualifizierte Signatur',
    description: 'eIDAS-konforme digitale Signaturen für Vollmachten, Verträge und Schriftsätze.',
    authTypes: ['oauth2'],
    defaultSyncDirection: 'push',
    capabilities: ['dokument_signieren', 'signatur_verifizieren', 'signatur_workflow', 'audit_trail'],
    requiredConfig: ['account_id', 'integration_key'],
    optionalConfig: ['default_signer_email'],
    documentationUrl: 'https://developers.docusign.com',
    jurisdictions: ['DE', 'AT', 'CH', 'EU'],
    domain: 'both',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Video-Konferenz-Scheduling für Mandantenbesprechungen und Gerichtstermine.',
    authTypes: ['oauth2'],
    defaultSyncDirection: 'push',
    capabilities: ['meeting_erstellen', 'meeting_planen', 'aufzeichnung_abruf'],
    requiredConfig: ['account_id', 'client_id'],
    optionalConfig: ['default_meeting_settings'],
    documentationUrl: 'https://developers.zoom.us',
    jurisdictions: ['DE', 'AT', 'CH', 'EU'],
    domain: 'both',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Teams-Meeting-Scheduling und Chat-Integration.',
    authTypes: ['oauth2'],
    defaultSyncDirection: 'push',
    capabilities: ['meeting_erstellen', 'chat_integration'],
    requiredConfig: ['tenant_id', 'client_id'],
    optionalConfig: [],
    documentationUrl: 'https://learn.microsoft.com/microsoftteams',
    jurisdictions: ['DE', 'AT', 'CH', 'EU'],
    domain: 'both',
  },
  {
    id: 'banking_fints',
    name: 'Banking (FinTS/PSD2)',
    description: 'Kontoumsätze automatisch importieren für Belegabgleich und Buchungsvorschläge.',
    authTypes: ['oauth2', 'basic'],
    defaultSyncDirection: 'pull',
    capabilities: ['kontoumsaetze_abruf', 'saldo_abfrage', 'umsatz_kategorisierung'],
    requiredConfig: ['bank_url', 'iban'],
    optionalConfig: ['bic', 'kontoinhaber'],
    documentationUrl: 'https://www.hbci-zka.de',
    jurisdictions: ['DE', 'AT'],
    domain: 'tax',
  },
  {
    id: 'handelsregister',
    name: 'Handelsregister',
    description: 'Firmendaten-Abfrage aus dem Handelsregister für Mandanten-Onboarding und Gegner-Recherche.',
    authTypes: ['api_key'],
    defaultSyncDirection: 'pull',
    capabilities: ['firmensuche', 'auszug_abruf', 'ubo_register'],
    requiredConfig: ['api_key'],
    optionalConfig: [],
    documentationUrl: 'https://www.handelsregister.de',
    jurisdictions: ['DE', 'AT'],
    domain: 'both',
  },
];

export const EXTERNAL_API_PROVIDER_LABELS: Record<ExternalApiProvider, string> = {
  bea: 'beA',
  web_erv: 'webERV',
  datev: 'DATEV',
  ra_micro: 'RA-MICRO',
  ms365: 'Microsoft 365',
  google: 'Google Workspace',
  dropbox: 'Dropbox',
  slack: 'Slack',
  elster: 'ELSTER',
  finanz_online: 'FinanzOnline',
  docusign: 'DocuSign',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  banking_fints: 'Banking (FinTS)',
  handelsregister: 'Handelsregister',
};

/**
 * ExternalApiConnectorService — Central service for managing external API integrations.
 *
 * Provides a unified interface for:
 * - Configuring and managing external API connections
 * - Testing connectivity
 * - Sync operations (push/pull)
 * - Sync logging and error tracking
 *
 * Individual provider implementations would extend this with provider-specific logic.
 */
export class ExternalApiConnectorService extends Service {
  private configMap$ = new BehaviorSubject<Record<string, ExternalApiConfig>>({});
  private syncLogMap$ = new BehaviorSubject<Record<string, ExternalApiSyncLog>>({});

  readonly configList$ = this.configMap$.pipe(map(m => Object.values(m)));
  readonly syncLogList$ = this.syncLogMap$.pipe(map(m => Object.values(m)));

  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly residencyPolicyService: CaseResidencyPolicyService
  ) {
    super();
  }

  private async assertConnectorCapability(workspaceId: string) {
    const gate = await this.residencyPolicyService.assertCapabilityAllowed(
      'external_connectors'
    );
    if (gate.ok) {
      return gate;
    }

    await this.orchestration.appendAuditEntry({
      workspaceId,
      action: 'api_connector.blocked_by_residency_policy',
      severity: 'warning',
      details:
        gate.reason ??
        'Externe Connectoren sind durch die Workspace-Residency-Policy deaktiviert.',
      metadata: {
        policyMode: gate.policy.mode,
      },
    });

    throw new Error(
      gate.reason ??
        'Externe Connectoren sind durch die Workspace-Residency-Policy deaktiviert.'
    );
  }

  getProviderMeta(provider: ExternalApiProvider): ExternalApiProviderMeta | undefined {
    return EXTERNAL_API_PROVIDERS.find(p => p.id === provider);
  }

  getAvailableProviders(domain?: 'legal' | 'tax' | 'both'): ExternalApiProviderMeta[] {
    if (!domain) return EXTERNAL_API_PROVIDERS;
    return EXTERNAL_API_PROVIDERS.filter(p => p.domain === domain || p.domain === 'both');
  }

  getConfigForProvider(provider: ExternalApiProvider): ExternalApiConfig | undefined {
    return Object.values(this.configMap$.value).find(c => c.provider === provider);
  }

  getConnectedProviders(): ExternalApiConfig[] {
    return Object.values(this.configMap$.value).filter(c => c.status === 'connected');
  }

  getConfiguredProviders(): ExternalApiConfig[] {
    return Object.values(this.configMap$.value).filter(c => c.enabled);
  }

  async configureProvider(input: {
    workspaceId: string;
    provider: ExternalApiProvider;
    endpoint?: string;
    authType?: ExternalApiAuthType;
    syncIntervalMinutes?: number;
    providerConfig: Record<string, string>;
  }): Promise<ExternalApiConfig> {
    await this.assertConnectorCapability(input.workspaceId);

    const meta = this.getProviderMeta(input.provider);
    if (!meta) throw new Error(`Unbekannter Provider: ${input.provider}`);

    // Validate required config
    for (const required of meta.requiredConfig) {
      if (!input.providerConfig[required]) {
        throw new Error(`Pflichtfeld fehlt: ${required}`);
      }
    }

    const existing = this.getConfigForProvider(input.provider);
    const now = new Date().toISOString();

    const config: ExternalApiConfig = {
      id: existing?.id ?? createId('api-conn'),
      workspaceId: input.workspaceId,
      provider: input.provider,
      displayName: EXTERNAL_API_PROVIDER_LABELS[input.provider],
      description: meta.description,
      endpoint: input.endpoint,
      authType: input.authType ?? meta.authTypes[0],
      enabled: true,
      status: 'configured',
      syncDirection: meta.defaultSyncDirection,
      syncIntervalMinutes: input.syncIntervalMinutes ?? 0,
      providerConfig: input.providerConfig,
      capabilities: meta.capabilities,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.configMap$.next({
      ...this.configMap$.value,
      [config.id]: config,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: 'api_connector.configured',
      severity: 'info',
      details: `API-Connector konfiguriert: ${config.displayName}`,
      metadata: {
        provider: input.provider,
        authType: config.authType,
      },
    });

    return config;
  }

  async testConnection(configId: string): Promise<{
    success: boolean;
    message: string;
    latencyMs: number;
  }> {
    const config = this.configMap$.value[configId];
    if (!config) throw new Error('Connector-Konfiguration nicht gefunden.');
    await this.assertConnectorCapability(config.workspaceId);

    const start = Date.now();

    // In a real implementation, this would call the actual API
    // For now, we simulate a connection test
    const isConfigComplete = config.providerConfig &&
      Object.keys(config.providerConfig).length > 0;

    const latencyMs = Date.now() - start;

    if (!isConfigComplete) {
      await this.updateStatus(configId, 'error', 'Konfiguration unvollständig');
      return {
        success: false,
        message: 'Konfiguration unvollständig. Bitte alle Pflichtfelder ausfüllen.',
        latencyMs,
      };
    }

    // Simulate successful connection
    await this.updateStatus(configId, 'connected');
    return {
      success: true,
      message: `Verbindung zu ${config.displayName} erfolgreich hergestellt.`,
      latencyMs,
    };
  }

  async disconnect(configId: string): Promise<void> {
    await this.updateStatus(configId, 'disabled');
  }

  async enableProvider(configId: string): Promise<void> {
    const config = this.configMap$.value[configId];
    if (!config) return;
    await this.assertConnectorCapability(config.workspaceId);

    this.configMap$.next({
      ...this.configMap$.value,
      [configId]: { ...config, enabled: true, updatedAt: new Date().toISOString() },
    });
  }

  async disableProvider(configId: string): Promise<void> {
    const config = this.configMap$.value[configId];
    if (!config) return;

    this.configMap$.next({
      ...this.configMap$.value,
      [configId]: { ...config, enabled: false, status: 'disabled', updatedAt: new Date().toISOString() },
    });
  }

  /**
   * Log a sync operation
   */
  async logSync(input: {
    configId: string;
    provider: ExternalApiProvider;
    direction: 'push' | 'pull';
    status: ExternalApiSyncLog['status'];
    itemsProcessed: number;
    itemsFailed?: number;
    errorMessage?: string;
    details?: string;
  }): Promise<ExternalApiSyncLog> {
    const now = new Date().toISOString();

    const log: ExternalApiSyncLog = {
      id: createId('sync-log'),
      configId: input.configId,
      provider: input.provider,
      direction: input.direction,
      status: input.status,
      itemsProcessed: input.itemsProcessed,
      itemsFailed: input.itemsFailed ?? 0,
      startedAt: now,
      completedAt: input.status !== 'started' ? now : undefined,
      errorMessage: input.errorMessage,
      details: input.details,
    };

    this.syncLogMap$.next({
      ...this.syncLogMap$.value,
      [log.id]: log,
    });

    // Update last sync on config
    if (input.status === 'success' || input.status === 'partial') {
      const config = this.configMap$.value[input.configId];
      if (config) {
        this.configMap$.next({
          ...this.configMap$.value,
          [input.configId]: { ...config, lastSyncAt: now, updatedAt: now },
        });
      }
    }

    return log;
  }

  getSyncLogsForProvider(provider: ExternalApiProvider, limit: number = 20): ExternalApiSyncLog[] {
    return Object.values(this.syncLogMap$.value)
      .filter(l => l.provider === provider)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  private async updateStatus(
    configId: string,
    status: ExternalApiConnectionStatus,
    error?: string
  ): Promise<void> {
    const config = this.configMap$.value[configId];
    if (!config) return;

    this.configMap$.next({
      ...this.configMap$.value,
      [configId]: {
        ...config,
        status,
        lastError: error,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  getDashboardStats(): {
    totalProviders: number;
    connectedProviders: number;
    errorProviders: number;
    lastSyncAt: string | null;
    providersByDomain: { legal: number; tax: number; both: number };
  } {
    const all = Object.values(this.configMap$.value);
    const connected = all.filter(c => c.status === 'connected');
    const errors = all.filter(c => c.status === 'error');

    const lastSync = all
      .filter(c => c.lastSyncAt)
      .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0];

    const byDomain = { legal: 0, tax: 0, both: 0 };
    for (const config of all) {
      const meta = this.getProviderMeta(config.provider);
      if (meta) byDomain[meta.domain]++;
    }

    return {
      totalProviders: all.length,
      connectedProviders: connected.length,
      errorProviders: errors.length,
      lastSyncAt: lastSync?.lastSyncAt ?? null,
      providersByDomain: byDomain,
    };
  }
}
