import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type {
  AuslageRecord,
  KassenbelegRecord,
  FiscalSignatureRecord,
  RechnungRecord,
  TimeEntry,
  ExportJournalRecord,
  Jurisdiction,
  KanzleiProfile,
} from '../types';
import type { CaseAssistantService } from './case-assistant';
import type { KanzleiProfileService } from './kanzlei-profile';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { RechnungService } from './rechnung';
import type { TimeTrackingService } from './time-tracking';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExportProvider = 'datev' | 'bmd' | 'lexware' | 'csv';

export type ExportFormat =
  | 'datev_ascii'       // DATEV ASCII-Format (Buchungsstapel)
  | 'datev_xml'         // DATEV XML-Online
  | 'bmd_ntcs'          // BMD NTCS Import (Österreich)
  | 'bmd_csv'           // BMD CSV-Import
  | 'lexware_csv'       // Lexware Import
  | 'generic_csv';      // Universelles CSV

export type ExportScope = 'rechnungen' | 'auslagen' | 'zeiteintraege' | 'alles';

export type ExportStatus = 'pending' | 'generating' | 'ready' | 'downloaded' | 'failed';

export interface AccountingComplianceResult {
  jurisdiction: Jurisdiction;
  provider: ExportProvider;
  missingFields: string[];
  ruleViolations: string[];
  warnings: string[];
  isCompliant: boolean;
}

export interface OneClickAccountingExportResult {
  jurisdiction: Jurisdiction;
  provider: ExportProvider;
  run: ExportRun;
  compliance: AccountingComplianceResult;
  reportFileName: string;
  reportHtml: string;
}

export interface DailyClosureReportResult {
  closureDate: string;
  belegCount: number;
  stornoCount: number;
  cashInflow: number;
  stornoAmount: number;
  signatureCount: number;
  chainConsistent: boolean;
  reportFileName: string;
  reportHtml: string;
}

export interface ExportConfig {
  id: string;
  workspaceId: string;
  provider: ExportProvider;
  format: ExportFormat;
  /** DATEV Beraternummer */
  beraternummer?: string;
  /** DATEV Mandantennummer */
  mandantennummer?: string;
  /** DATEV Wirtschaftsjahr-Beginn (MM) */
  wirtschaftsjahrBeginn?: string;
  /** Sachkontenlänge (4 or 5 digits) */
  sachkontenlaenge?: number;
  /** BMD Firmennummer */
  bmdFirmennummer?: string;
  /** Default Erlöskonto */
  erloeskonto: string;
  /** Default Aufwandskonto */
  aufwandskonto: string;
  /** USt-Konto */
  ustKonto: string;
  /** Fremdgeldkonto */
  fremdgeldkonto?: string;
  /** Separator for CSV */
  csvSeparator: string;
  /** Encoding */
  encoding: 'utf-8' | 'iso-8859-1' | 'windows-1252';
  /** Whether to include reversed/cancelled items */
  includeStorniert: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExportRun {
  id: string;
  workspaceId: string;
  configId: string;
  scope: ExportScope;
  format: ExportFormat;
  /** Date range */
  vonDatum: string;
  bisDatum: string;
  /** Filter by matter */
  matterId?: string;
  /** Status */
  status: ExportStatus;
  /** Generated content */
  content?: string;
  fileName?: string;
  /** Stats */
  recordCount: number;
  totalNetto: number;
  totalBrutto: number;
  /** Error info */
  errorMessage?: string;
  /** Who triggered */
  exportedBy: string;
  exportedByName: string;
  createdAt: string;
  completedAt?: string;
}

// ─── DATEV Kontenrahmen (SKR03 / SKR04 simplified) ──────────────────────────

export const DATEV_KONTEN = {
  // SKR03 (Deutschland Standard)
  skr03: {
    erloese_honorar: '8400',
    erloese_19pct: '8400',
    erloese_7pct: '8300',
    erloese_0pct: '8100',
    forderungen: '1400',
    bank: '1200',
    kasse: '1000',
    ust_19: '1776',
    ust_7: '1771',
    vorsteuer_19: '1576',
    vorsteuer_7: '1571',
    fremdgeld: '1590',
    gerichtskosten: '4910',
    reisekosten: '4660',
    porto: '4910',
    sachverstaendiger: '4900',
    sonstige_auslagen: '4900',
  },
  // SKR04 (Industriekontenrahmen)
  skr04: {
    erloese_honorar: '4400',
    erloese_19pct: '4400',
    erloese_7pct: '4300',
    erloese_0pct: '4100',
    forderungen: '1200',
    bank: '1800',
    kasse: '1600',
    ust_19: '3806',
    ust_7: '3801',
    vorsteuer_19: '1406',
    vorsteuer_7: '1401',
    fremdgeld: '1590',
    gerichtskosten: '6830',
    reisekosten: '6650',
    porto: '6830',
    sachverstaendiger: '6827',
    sonstige_auslagen: '6800',
  },
};

// ─── BMD Kontenrahmen (Österreich) ──────────────────────────────────────────

export const BMD_KONTEN = {
  erloese_honorar: '4000',
  erloese_20pct: '4000',
  erloese_10pct: '4010',
  erloese_0pct: '4020',
  forderungen: '2000',
  bank: '2800',
  ust_20: '3500',
  ust_10: '3510',
  vorsteuer_20: '2500',
  fremdgeld: '2790',
  gerichtskosten: '7300',
  reisekosten: '7400',
  sonstige_auslagen: '7390',
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  datev_ascii: 'DATEV ASCII (Buchungsstapel)',
  datev_xml: 'DATEV XML-Online',
  bmd_ntcs: 'BMD NTCS Import',
  bmd_csv: 'BMD CSV-Import',
  lexware_csv: 'Lexware CSV',
  generic_csv: 'Universelles CSV',
};

const ALLOWED_TAX_RATES_BY_JURISDICTION: Partial<Record<Jurisdiction, number[]>> = {
  DE: [0, 7, 19],
  AT: [0, 10, 13, 20],
  CH: [0, 2.6, 3.8, 8.1],
  FR: [0, 2.1, 5.5, 10, 20],
  IT: [0, 4, 5, 10, 22],
  PT: [0, 6, 13, 23],
  PL: [0, 5, 8, 23],
};

const COMPLIANCE_POLICY_BY_JURISDICTION: Record<
  Jurisdiction,
  {
    provider: ExportProvider;
    warnings: string[];
    requiredProfileFields: Array<{ key: keyof KanzleiProfile; label: string }>;
  }
> = {
  DE: {
    provider: 'datev',
    warnings: [],
    requiredProfileFields: [],
  },
  AT: {
    provider: 'bmd',
    warnings: [],
    requiredProfileFields: [],
  },
  CH: {
    provider: 'csv',
    warnings: [
      'CH: Export erfolgt als Generic-CSV; vor Einspielung in Treuhand-/FIBU-System bitte Kontenmapping prüfen.',
    ],
    requiredProfileFields: [{ key: 'ustIdNr', label: 'USt-IdNr' }],
  },
  FR: {
    provider: 'csv',
    warnings: [
      'FR: Export erfolgt als Generic-CSV; TVA-Konten und journal-spezifische Felder im Zielsystem validieren.',
    ],
    requiredProfileFields: [{ key: 'ustIdNr', label: 'USt-IdNr' }],
  },
  IT: {
    provider: 'csv',
    warnings: [
      'IT: Export erfolgt als Generic-CSV; aliquote IVA und Registri vor Verbuchung prüfen.',
    ],
    requiredProfileFields: [{ key: 'ustIdNr', label: 'USt-IdNr' }],
  },
  PT: {
    provider: 'csv',
    warnings: [
      'PT: Export erfolgt als Generic-CSV; SAF-T-/conta-Mapping vor Import im Buchhaltungssystem verifizieren.',
    ],
    requiredProfileFields: [{ key: 'ustIdNr', label: 'USt-IdNr' }],
  },
  PL: {
    provider: 'csv',
    warnings: [
      'PL: Export erfolgt als Generic-CSV; JPK-/KSeF-relevante Felder im Zielprozess ergänzen.',
    ],
    requiredProfileFields: [{ key: 'ustIdNr', label: 'USt-IdNr' }],
  },
  EU: {
    provider: 'csv',
    warnings: [
      'EU: Export erfolgt als Generic-CSV mit grenzüberschreitendem Fallback. Länderspezifische VAT-Details nachgelagert prüfen.',
    ],
    requiredProfileFields: [],
  },
  ECHR: {
    provider: 'csv',
    warnings: [
      'ECHR: Export erfolgt als Generic-CSV; keine nationale Steuerlogik ableitbar, daher manuelle steuerliche Einordnung erforderlich.',
    ],
    requiredProfileFields: [],
  },
};

/**
 * DATEVExportService — Buchhaltungs-Export für Steuerberater
 *
 * Supported formats:
 * - DATEV ASCII (Buchungsstapel) — Standard in DE
 * - DATEV XML-Online
 * - BMD NTCS / CSV — Standard in AT
 * - Lexware CSV
 * - Generic CSV
 *
 * Features:
 * - Rechnungs-Export mit korrekten Konten (SKR03/SKR04/BMD)
 * - Auslagen-Export mit Kategoriezuordnung
 * - Zeiterfassungs-Export
 * - Konfigurierbare Kontenrahmen
 * - Datums-Filter & Matter-Filter
 * - Stornierte Buchungen optional
 * - DATEV-Header mit Berater-/Mandantennummer
 * - Encoding-Support (UTF-8, ISO-8859-1, Windows-1252)
 * - Vollständiger Audit-Trail
 */
export class DATEVExportService extends Service {
  private configsMap$ = new BehaviorSubject<Record<string, ExportConfig>>({});
  private runsMap$ = new BehaviorSubject<Record<string, ExportRun>>({});

  readonly configsList$ = this.configsMap$.pipe(map(m => Object.values(m)));
  readonly runsList$ = this.runsMap$.pipe(map(m => Object.values(m)));

  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly rechnungService: RechnungService,
    private readonly timeTracking: TimeTrackingService,
    private readonly caseAssistantService: CaseAssistantService,
    private readonly kanzleiProfileService: KanzleiProfileService
  ) {
    super();
  }

  private getProviderForJurisdiction(jurisdiction: Jurisdiction): ExportProvider {
    return COMPLIANCE_POLICY_BY_JURISDICTION[jurisdiction]?.provider ?? 'csv';
  }

  private getDefaultFormat(provider: ExportProvider): ExportFormat {
    if (provider === 'datev') return 'datev_ascii';
    if (provider === 'bmd') return 'bmd_csv';
    if (provider === 'lexware') return 'lexware_csv';
    return 'generic_csv';
  }

  private buildComplianceResult(input: {
    jurisdiction: Jurisdiction;
    provider: ExportProvider;
    profile: KanzleiProfile | null;
  }): AccountingComplianceResult {
    const missingFields: string[] = [];
    const warnings: string[] = [];
    const profile = input.profile;
    const policy = COMPLIANCE_POLICY_BY_JURISDICTION[input.jurisdiction];

    if (!profile?.name?.trim()) {
      missingFields.push('Kanzleiname');
    }
    if (!profile?.steuernummer?.trim() && !profile?.ustIdNr?.trim()) {
      missingFields.push('Steuernummer/USt-IdNr');
    }

    if (input.provider === 'datev') {
      if (!profile?.datevBeraternummer?.trim()) missingFields.push('DATEV Beraternummer');
      if (!profile?.datevMandantennummer?.trim()) missingFields.push('DATEV Mandantennummer');
      if (!profile?.iban?.trim()) warnings.push('IBAN fehlt (nicht in jedem Export erforderlich, aber empfohlen).');
    }

    if (input.provider === 'bmd') {
      if (!profile?.bmdFirmennummer?.trim()) missingFields.push('BMD Firmennummer');
      if (!profile?.iban?.trim()) warnings.push('IBAN fehlt (BMD-Abstimmung kann erschwert sein).');
    }

    for (const required of policy.requiredProfileFields) {
      const value = profile?.[required.key];
      if (typeof value !== 'string' || !value.trim()) {
        missingFields.push(required.label);
      }
    }

    warnings.push(
      ...(policy?.warnings ?? [])
    );

    if (!ALLOWED_TAX_RATES_BY_JURISDICTION[input.jurisdiction]) {
      warnings.push(
        `Für ${input.jurisdiction} sind keine fixen USt-Regelsätze hinterlegt. Steuerprüfung wird nicht blockierend ausgeführt.`
      );
    }

    return {
      jurisdiction: input.jurisdiction,
      provider: input.provider,
      missingFields,
      ruleViolations: [],
      warnings,
      isCompliant: missingFields.length === 0,
    };
  }

  private getAllowedTaxRates(jurisdiction: Jurisdiction): number[] {
    return ALLOWED_TAX_RATES_BY_JURISDICTION[jurisdiction] ?? [];
  }

  private collectTaxRuleViolations(
    rechnungen: RechnungRecord[],
    jurisdiction: Jurisdiction
  ): string[] {
    const allowed = this.getAllowedTaxRates(jurisdiction);
    if (allowed.length === 0) return [];

    const violations: string[] = [];
    for (const rechnung of rechnungen) {
      if (rechnung.status === 'storniert') continue;
      if (!allowed.includes(rechnung.ustProzent)) {
        violations.push(
          `Rechnung ${rechnung.rechnungsnummer}: USt ${rechnung.ustProzent}% ist für ${jurisdiction} nicht zulässig (erlaubt: ${allowed.join(', ')}).`
        );
      }
    }
    return violations;
  }

  private ensureNoComplianceGaps(result: AccountingComplianceResult) {
    if (result.isCompliant) return;
    const missing = result.missingFields.length > 0
      ? `fehlende Pflichtfelder: ${result.missingFields.join(', ')}`
      : '';
    const ruleViolations = result.ruleViolations.length > 0
      ? `Steuer-/Regelverletzungen: ${result.ruleViolations.join(' | ')}`
      : '';
    const details = [missing, ruleViolations].filter(Boolean).join(' · ');
    throw new Error(
      `One-Click Export blockiert (${result.jurisdiction}/${result.provider.toUpperCase()}): ${details}`
    );
  }

  private buildAccountingReportHtml(input: {
    jurisdiction: Jurisdiction;
    profile: KanzleiProfile;
    run: ExportRun;
    matterLabel?: string;
    clientLabels: string[];
    compliance: AccountingComplianceResult;
  }) {
    const runDate = new Date().toLocaleDateString('de-DE');
    const clients = input.clientLabels.length > 0 ? input.clientLabels.join(', ') : 'Nicht zugeordnet';
    const warnings = input.compliance.warnings
      .map(w => `<li>${this.escapeHtml(w)}</li>`)
      .join('');
    const violations = input.compliance.ruleViolations
      .map(v => `<li>${this.escapeHtml(v)}</li>`)
      .join('');

    return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Buchhaltungsreport ${this.escapeHtml(input.run.fileName ?? input.run.id)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 8px 0; }
    h2 { font-size: 14px; margin: 16px 0 8px 0; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 8px; }
    .muted { color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>Buchhaltungs-Exportreport</h1>
  <div class="muted">Erstellt am ${this.escapeHtml(runDate)} · Jurisdiktion ${this.escapeHtml(input.jurisdiction)} · Provider ${this.escapeHtml(input.compliance.provider.toUpperCase())}</div>

  <div class="box">
    <strong>${this.escapeHtml(input.profile.name)}</strong><br />
    ${this.escapeHtml(input.profile.address ?? '-')}<br />
    Steuer: ${this.escapeHtml(input.profile.steuernummer ?? input.profile.ustIdNr ?? '-')}
  </div>

  <h2>Mandatsbezug</h2>
  <div class="box">
    Akte: ${this.escapeHtml(input.matterLabel ?? 'Alle Akten')}<br />
    Mandant(en): ${this.escapeHtml(clients)}
  </div>

  <h2>Exportkennzahlen</h2>
  <table>
    <tr><th>Datei</th><td>${this.escapeHtml(input.run.fileName ?? '-')}</td></tr>
    <tr><th>Zeitraum</th><td>${this.escapeHtml(input.run.vonDatum)} bis ${this.escapeHtml(input.run.bisDatum)}</td></tr>
    <tr><th>Buchungen</th><td>${input.run.recordCount}</td></tr>
    <tr><th>Netto</th><td>${input.run.totalNetto.toFixed(2)} EUR</td></tr>
    <tr><th>Brutto</th><td>${input.run.totalBrutto.toFixed(2)} EUR</td></tr>
  </table>

  ${warnings ? `<h2>Hinweise</h2><ul>${warnings}</ul>` : ''}
  ${violations ? `<h2>Regelverletzungen</h2><ul>${violations}</ul>` : ''}
</body>
</html>`;
  }

  private escapeHtml(input: string) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async runOneClickAccountingExport(input: {
    workspaceId: string;
    matterId?: string;
    vonDatum: string;
    bisDatum: string;
    exportedBy: string;
    exportedByName: string;
  }): Promise<OneClickAccountingExportResult> {
    this.ensureIsoDateRange(input.vonDatum, input.bisDatum);

    const jurisdiction = this.caseAssistantService.getActiveJurisdiction();
    const provider = this.getProviderForJurisdiction(jurisdiction);
    const profile = await this.kanzleiProfileService.getKanzleiProfile();

    const preflightRechnungen = this.getRechnungenInRange(
      input.vonDatum,
      input.bisDatum,
      input.matterId,
      false
    );
    const baseCompliance = this.buildComplianceResult({ jurisdiction, provider, profile });
    const ruleViolations = this.collectTaxRuleViolations(preflightRechnungen, jurisdiction);
    const compliance: AccountingComplianceResult = {
      ...baseCompliance,
      ruleViolations,
      isCompliant:
        baseCompliance.missingFields.length === 0 && ruleViolations.length === 0,
    };

    this.ensureNoComplianceGaps(compliance);

    const existing = this.getConfigForProvider(input.workspaceId, provider);
    const config = existing
      ? await this.updateConfig(existing.id, {
          beraternummer: profile?.datevBeraternummer,
          mandantennummer: profile?.datevMandantennummer,
          bmdFirmennummer: profile?.bmdFirmennummer,
        })
      : await this.createConfig({
          workspaceId: input.workspaceId,
          provider,
          format: this.getDefaultFormat(provider),
          beraternummer: profile?.datevBeraternummer,
          mandantennummer: profile?.datevMandantennummer,
          bmdFirmennummer: profile?.bmdFirmennummer,
        });

    if (!config || !profile) {
      throw new Error('One-Click Export konnte nicht initialisiert werden (Config/Profil fehlt).');
    }

    const run = await this.runExport({
      workspaceId: input.workspaceId,
      configId: config.id,
      scope: 'alles',
      vonDatum: input.vonDatum,
      bisDatum: input.bisDatum,
      matterId: input.matterId,
      exportedBy: input.exportedBy,
      exportedByName: input.exportedByName,
    });

    if (run.status !== 'ready') {
      throw new Error(run.errorMessage ?? 'One-Click Export konnte nicht abgeschlossen werden.');
    }

    const graph = this.caseAssistantService.graph$.value;
    const matter = input.matterId ? graph?.matters?.[input.matterId] : undefined;
    const clientIds = input.matterId
      ? this.caseAssistantService.getClientsForMatter(input.matterId)
      : [];
    const clientLabels = clientIds
      .map(id => graph?.clients?.[id]?.displayName)
      .filter((name): name is string => Boolean(name));

    const reportHtml = this.buildAccountingReportHtml({
      jurisdiction,
      profile,
      run,
      matterLabel: matter?.title,
      clientLabels,
      compliance,
    });

    return {
      jurisdiction,
      provider,
      run,
      compliance,
      reportFileName: `Buchhaltungsreport-${provider.toUpperCase()}-${run.vonDatum}-${run.bisDatum}.html`,
      reportHtml,
    };
  }

  private isIsoDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private ensureIsoDateRange(vonDatum: string, bisDatum: string) {
    if (!this.isIsoDateOnly(vonDatum) || !this.isIsoDateOnly(bisDatum)) {
      throw new Error('Exportzeitraum muss im Format YYYY-MM-DD vorliegen.');
    }
    if (vonDatum > bisDatum) {
      throw new Error('Exportzeitraum ungültig: Von-Datum liegt nach Bis-Datum.');
    }
  }

  private verifyDayChain(signatures: FiscalSignatureRecord[]): boolean {
    if (signatures.length <= 1) return true;
    for (let i = 1; i < signatures.length; i += 1) {
      if (signatures[i].previousHash !== signatures[i - 1].chainHash) {
        return false;
      }
    }
    return true;
  }

  private verifyBelegSignatureCoverage(
    belege: KassenbelegRecord[],
    signatures: FiscalSignatureRecord[]
  ): boolean {
    const chainHashes = new Set(signatures.map(s => s.chainHash));
    for (const beleg of belege) {
      if (!beleg.fiscalSignatureHash) continue;
      if (!chainHashes.has(beleg.fiscalSignatureHash)) {
        return false;
      }
    }
    return true;
  }

  private buildDailyClosureHtml(input: {
    closureDate: string;
    jurisdiction: Jurisdiction;
    profile: KanzleiProfile | null;
    belegCount: number;
    stornoCount: number;
    cashInflow: number;
    stornoAmount: number;
    signatureCount: number;
    chainConsistent: boolean;
  }): string {
    return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Kassenabschluss ${this.escapeHtml(input.closureDate)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 8px 0; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>Kassenabschluss / Daily Closure</h1>
  <div>Datum: ${this.escapeHtml(input.closureDate)} · Jurisdiktion: ${this.escapeHtml(input.jurisdiction)}</div>
  <div class="box">
    <strong>${this.escapeHtml(input.profile?.name ?? 'Kanzlei')}</strong><br />
    Steuer: ${this.escapeHtml(input.profile?.steuernummer ?? input.profile?.ustIdNr ?? '-')}
  </div>
  <table>
    <tr><th>Kassenbelege gesamt</th><td>${input.belegCount}</td></tr>
    <tr><th>Barumsatz aktiv</th><td>${input.cashInflow.toFixed(2)} EUR</td></tr>
    <tr><th>Stornos</th><td>${input.stornoCount}</td></tr>
    <tr><th>Storno-Betrag</th><td>${input.stornoAmount.toFixed(2)} EUR</td></tr>
    <tr><th>Fiskal-Signaturen</th><td>${input.signatureCount}</td></tr>
    <tr><th>Chain-Integrität</th><td>${input.chainConsistent ? 'OK' : 'FEHLER'}</td></tr>
  </table>
</body>
</html>`;
  }

  async generateDailyClosureReport(input: {
    workspaceId: string;
    closureDate: string;
    matterId?: string;
  }): Promise<DailyClosureReportResult> {
    if (!this.isIsoDateOnly(input.closureDate)) {
      throw new Error('closureDate muss im Format YYYY-MM-DD vorliegen.');
    }

    const jurisdiction = this.caseAssistantService.getActiveJurisdiction();
    const profile = await this.kanzleiProfileService.getKanzleiProfile();
    const allBelege = input.matterId
      ? this.rechnungService.getKassenbelegeForMatter(input.matterId)
      : this.rechnungService.getAllKassenbelege();

    const dayBelege: KassenbelegRecord[] = allBelege.filter(
      b =>
        b.workspaceId === input.workspaceId &&
        b.buchungsdatum.startsWith(input.closureDate)
    );

    const signatureEntries = (this.orchestration.fiscalSignatures$.value ?? [])
      .filter(
        s =>
          s.workspaceId === input.workspaceId &&
          s.signedAt.startsWith(input.closureDate) &&
          (!input.matterId || s.matterId === input.matterId)
      )
      .sort((a, b) => a.signedAt.localeCompare(b.signedAt));

    const activeBelege = dayBelege.filter(b => !b.storniert);
    const stornoBelege = dayBelege.filter(b => b.storniert);
    const cashInflow = activeBelege.reduce((sum, b) => sum + b.zahlungsbetrag, 0);
    const stornoAmount = stornoBelege.reduce((sum, b) => sum + b.zahlungsbetrag, 0);
    const chainConsistent =
      this.verifyDayChain(signatureEntries) &&
      this.verifyBelegSignatureCoverage(dayBelege, signatureEntries);

    const reportHtml = this.buildDailyClosureHtml({
      closureDate: input.closureDate,
      jurisdiction,
      profile,
      belegCount: dayBelege.length,
      stornoCount: stornoBelege.length,
      cashInflow,
      stornoAmount,
      signatureCount: signatureEntries.length,
      chainConsistent,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: 'kasse.daily_closure.generated',
      severity: chainConsistent ? 'info' : 'warning',
      details: `Daily Closure erstellt (${input.closureDate}) mit ${dayBelege.length} Kassenbelegen.`,
      metadata: {
        closureDate: input.closureDate,
        chainConsistent: String(chainConsistent),
        signatureCount: String(signatureEntries.length),
      },
    });

    return {
      closureDate: input.closureDate,
      belegCount: dayBelege.length,
      stornoCount: stornoBelege.length,
      cashInflow,
      stornoAmount,
      signatureCount: signatureEntries.length,
      chainConsistent,
      reportFileName: `Kassenabschluss-${input.closureDate}.html`,
      reportHtml,
    };
  }

  private async sha256(value: string) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      throw new Error('Crypto API ist nicht verfügbar. Export-Journal kann nicht signiert werden.');
    }
    const bytes = new TextEncoder().encode(value);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async appendExportJournal(input: {
    workspaceId: string;
    caseId?: string;
    provider: ExportProvider;
    format: ExportFormat;
    scope: ExportScope;
    runId: string;
    fileName?: string;
    recordCount: number;
    totalNetto: number;
    totalBrutto: number;
    status: 'ready' | 'downloaded' | 'failed';
    periodFrom: string;
    periodTo: string;
    triggeredBy: string;
  }) {
    const latest = await this.orchestration.getLatestExportJournal(input.workspaceId);
    const previousHash = latest?.chainHash ?? 'GENESIS';
    const createdAt = new Date().toISOString();
    const canonical = JSON.stringify({
      workspaceId: input.workspaceId,
      caseId: input.caseId ?? null,
      provider: input.provider,
      format: input.format,
      scope: input.scope,
      runId: input.runId,
      fileName: input.fileName ?? null,
      recordCount: input.recordCount,
      totalNetto: input.totalNetto,
      totalBrutto: input.totalBrutto,
      status: input.status,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      triggeredBy: input.triggeredBy,
      createdAt,
    });
    const chainHash = await this.sha256(`${previousHash}:${canonical}`);

    const record: ExportJournalRecord = {
      id: createId('export-journal'),
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      provider: input.provider,
      format: input.format,
      scope: input.scope,
      runId: input.runId,
      fileName: input.fileName,
      recordCount: input.recordCount,
      totalNetto: input.totalNetto,
      totalBrutto: input.totalBrutto,
      status: input.status,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      triggeredBy: input.triggeredBy,
      chainHash,
      previousHash,
      createdAt,
    };

    await this.orchestration.upsertExportJournal(record);
    return record;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async createConfig(input: {
    workspaceId: string;
    provider: ExportProvider;
    format: ExportFormat;
    beraternummer?: string;
    mandantennummer?: string;
    wirtschaftsjahrBeginn?: string;
    sachkontenlaenge?: number;
    bmdFirmennummer?: string;
    erloeskonto?: string;
    aufwandskonto?: string;
    ustKonto?: string;
    fremdgeldkonto?: string;
  }): Promise<ExportConfig> {
    const now = new Date().toISOString();

    const isDATEV = input.provider === 'datev';
    const isBMD = input.provider === 'bmd';

    const config: ExportConfig = {
      id: createId('export-cfg'),
      workspaceId: input.workspaceId,
      provider: input.provider,
      format: input.format,
      beraternummer: input.beraternummer?.trim(),
      mandantennummer: input.mandantennummer?.trim(),
      wirtschaftsjahrBeginn: input.wirtschaftsjahrBeginn ?? '01',
      sachkontenlaenge: input.sachkontenlaenge ?? 4,
      bmdFirmennummer: input.bmdFirmennummer?.trim(),
      erloeskonto: input.erloeskonto ?? (isDATEV ? '8400' : isBMD ? '4000' : '8400'),
      aufwandskonto: input.aufwandskonto ?? (isDATEV ? '4900' : isBMD ? '7390' : '4900'),
      ustKonto: input.ustKonto ?? (isDATEV ? '1776' : isBMD ? '3500' : '1776'),
      fremdgeldkonto: input.fremdgeldkonto,
      csvSeparator: ';',
      encoding: isDATEV ? 'windows-1252' : 'utf-8',
      includeStorniert: false,
      createdAt: now,
      updatedAt: now,
    };

    this.configsMap$.next({ ...this.configsMap$.value, [config.id]: config });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: 'datev.config.created',
      severity: 'info',
      details: `Export-Konfiguration erstellt: ${EXPORT_FORMAT_LABELS[input.format]}`,
      metadata: { configId: config.id, provider: input.provider, format: input.format },
    });

    return config;
  }

  async updateConfig(
    configId: string,
    updates: Partial<Omit<ExportConfig, 'id' | 'workspaceId' | 'createdAt'>>
  ): Promise<ExportConfig | null> {
    const existing = this.configsMap$.value[configId];
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.configsMap$.next({ ...this.configsMap$.value, [configId]: updated });
    return updated;
  }

  getConfigForProvider(workspaceId: string, provider: ExportProvider): ExportConfig | undefined {
    return Object.values(this.configsMap$.value).find(
      c => c.workspaceId === workspaceId && c.provider === provider
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT RUNS
  // ═══════════════════════════════════════════════════════════════════════════

  async runExport(input: {
    workspaceId: string;
    configId: string;
    scope: ExportScope;
    vonDatum: string;
    bisDatum: string;
    matterId?: string;
    exportedBy: string;
    exportedByName: string;
  }): Promise<ExportRun> {
    assertNonEmpty(input.configId, 'Config-ID');
    assertNonEmpty(input.vonDatum, 'Von-Datum');
    assertNonEmpty(input.bisDatum, 'Bis-Datum');

    const config = this.configsMap$.value[input.configId];
    if (!config) throw new Error('Export-Konfiguration nicht gefunden.');

    const now = new Date().toISOString();

    const run: ExportRun = {
      id: createId('export-run'),
      workspaceId: input.workspaceId,
      configId: input.configId,
      scope: input.scope,
      format: config.format,
      vonDatum: input.vonDatum,
      bisDatum: input.bisDatum,
      matterId: input.matterId,
      status: 'generating',
      recordCount: 0,
      totalNetto: 0,
      totalBrutto: 0,
      exportedBy: input.exportedBy,
      exportedByName: input.exportedByName,
      createdAt: now,
    };

    this.runsMap$.next({ ...this.runsMap$.value, [run.id]: run });

    try {
      const result = await this.generateExport(config, run);

      const completed: ExportRun = {
        ...run,
        status: 'ready',
        content: result.content,
        fileName: result.fileName,
        recordCount: result.recordCount,
        totalNetto: result.totalNetto,
        totalBrutto: result.totalBrutto,
        completedAt: new Date().toISOString(),
      };

      this.runsMap$.next({ ...this.runsMap$.value, [run.id]: completed });

      await this.appendExportJournal({
        workspaceId: input.workspaceId,
        provider: config.provider,
        format: config.format,
        scope: run.scope,
        runId: run.id,
        fileName: completed.fileName,
        recordCount: completed.recordCount,
        totalNetto: completed.totalNetto,
        totalBrutto: completed.totalBrutto,
        status: 'ready',
        periodFrom: run.vonDatum,
        periodTo: run.bisDatum,
        triggeredBy: run.exportedBy,
      });

      await this.orchestration.appendAuditEntry({
        workspaceId: input.workspaceId,
        caseId: '',
        action: 'datev.export.completed',
        severity: 'info',
        details: `Export abgeschlossen: ${EXPORT_FORMAT_LABELS[config.format]} — ${result.recordCount} Buchungen, ${result.totalBrutto.toFixed(2)} EUR`,
        metadata: {
          runId: run.id,
          format: config.format,
          recordCount: String(result.recordCount),
          totalBrutto: String(result.totalBrutto),
        },
      });

      return completed;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export fehlgeschlagen';
      const failed: ExportRun = {
        ...run,
        status: 'failed',
        errorMessage,
        completedAt: new Date().toISOString(),
      };

      this.runsMap$.next({ ...this.runsMap$.value, [run.id]: failed });

      await this.appendExportJournal({
        workspaceId: input.workspaceId,
        provider: config.provider,
        format: config.format,
        scope: run.scope,
        runId: run.id,
        fileName: failed.fileName,
        recordCount: failed.recordCount,
        totalNetto: failed.totalNetto,
        totalBrutto: failed.totalBrutto,
        status: 'failed',
        periodFrom: run.vonDatum,
        periodTo: run.bisDatum,
        triggeredBy: run.exportedBy,
      });

      return failed;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  private async generateExport(
    config: ExportConfig,
    run: ExportRun
  ): Promise<{ content: string; fileName: string; recordCount: number; totalNetto: number; totalBrutto: number }> {
    // Gather data
    const rechnungen = this.getRechnungenInRange(run.vonDatum, run.bisDatum, run.matterId, config.includeStorniert);
    const auslagen = run.scope === 'rechnungen' ? [] : this.getAuslagenInRange(run.vonDatum, run.bisDatum, run.matterId);
    const zeiteintraege = run.scope === 'zeiteintraege' || run.scope === 'alles'
      ? this.getZeiteintraegeInRange(run.vonDatum, run.bisDatum, run.matterId)
      : [];

    const totalNetto = rechnungen.reduce((s, r) => s + r.netto, 0);
    const totalBrutto = rechnungen.reduce((s, r) => s + r.brutto, 0);
    const recordCount = rechnungen.length + auslagen.length + zeiteintraege.length;

    let content: string;
    let fileName: string;

    switch (config.format) {
      case 'datev_ascii':
        content = this.generateDATEVAscii(config, rechnungen, auslagen);
        fileName = `EXTF_Buchungsstapel_${run.vonDatum}_${run.bisDatum}.csv`;
        break;
      case 'datev_xml':
        content = this.generateDATEVXml(config, rechnungen, auslagen);
        fileName = `DATEV_Export_${run.vonDatum}_${run.bisDatum}.xml`;
        break;
      case 'bmd_csv':
        content = this.generateBMDCsv(config, rechnungen, auslagen);
        fileName = `BMD_Export_${run.vonDatum}_${run.bisDatum}.csv`;
        break;
      case 'bmd_ntcs':
        content = this.generateBMDNtcs(config, rechnungen, auslagen);
        fileName = `BMD_NTCS_${run.vonDatum}_${run.bisDatum}.csv`;
        break;
      case 'generic_csv':
      default:
        content = this.generateGenericCsv(config, rechnungen, auslagen, zeiteintraege);
        fileName = `Export_${run.vonDatum}_${run.bisDatum}.csv`;
        break;
    }

    return { content, fileName, recordCount, totalNetto, totalBrutto };
  }

  // ── DATEV ASCII Format (EXTF) ─────────────────────────────────────────────

  private generateDATEVAscii(config: ExportConfig, rechnungen: RechnungRecord[], auslagen: AuslageRecord[]): string {
    const sep = config.csvSeparator;
    const lines: string[] = [];

    // DATEV Header (Row 1)
    const now = new Date();
    lines.push([
      '"EXTF"', // Format
      '700',    // Version
      '21',     // Kategorie (Buchungsstapel)
      '"Buchungsstapel"',
      '12',     // Format-Version
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`, // Created date
      '',       // Imported
      '"SU"',   // Origin (Subsumio)
      '""',     // Exported by
      '""',     // Imported by
      config.beraternummer ? `"${config.beraternummer}"` : '""',
      config.mandantennummer ? `"${config.mandantennummer}"` : '""',
      config.wirtschaftsjahrBeginn ?? '01', // WJ-Beginn
      String(config.sachkontenlaenge ?? 4),
      '',       // Datum von
      '',       // Datum bis
      '""',     // Bezeichnung
      '""',     // Diktatkürzel
      '0',      // Buchungstyp
      '0',      // Rechnungslegungszweck
      '0',      // Festschreibung
      '"EUR"',  // Währung
    ].join(sep));

    // Column headers (Row 2)
    lines.push([
      'Umsatz (ohne Soll/Haben-Kz)',
      'Soll/Haben-Kennzeichen',
      'WKZ Umsatz',
      'Kurs',
      'Basis-Umsatz',
      'WKZ Basis-Umsatz',
      'Konto',
      'Gegenkonto (ohne BU-Schlüssel)',
      'BU-Schlüssel',
      'Belegdatum',
      'Belegfeld 1',
      'Belegfeld 2',
      'Skonto',
      'Buchungstext',
      'Postensperre',
      'Diverse Adressnummer',
      'Geschäftspartnerbank',
      'Sachverhalt',
      'Zinssperre',
      'Beleglink',
    ].map(h => `"${h}"`).join(sep));

    // Rechnungen
    for (const rechnung of rechnungen) {
      const belegdatum = this.formatDateDATEV(rechnung.rechnungsdatum);
      const isStorno = rechnung.status === 'storniert';

      // Netto-Buchung
      lines.push([
        this.formatAmountDATEV(rechnung.netto),
        isStorno ? '"H"' : '"S"',
        '"EUR"',
        '',
        '',
        '',
        `"${config.erloeskonto}"`,
        '"1400"',  // Forderungen
        rechnung.ustProzent === 19 ? '3' : rechnung.ustProzent === 7 ? '2' : '',
        `"${belegdatum}"`,
        `"${rechnung.rechnungsnummer}"`,
        '',
        '',
        `"${this.sanitizeDATEV(rechnung.betreff)}"`,
        '',
        '',
        '',
        '',
        '',
        '',
      ].join(sep));
    }

    // Auslagen
    for (const auslage of auslagen) {
      const belegdatum = this.formatDateDATEV(auslage.datum);
      const konto = this.mapAuslagenKonto(auslage.kategorie, config);

      lines.push([
        this.formatAmountDATEV(auslage.betrag),
        '"S"',
        `"${auslage.waehrung}"`,
        '',
        '',
        '',
        `"${konto}"`,
        '"1200"',  // Bank
        '',
        `"${belegdatum}"`,
        `"${auslage.belegRef ?? ''}"`,
        '',
        '',
        `"${this.sanitizeDATEV(auslage.bezeichnung)}"`,
        '',
        '',
        '',
        '',
        '',
        '',
      ].join(sep));
    }

    return lines.join('\r\n');
  }

  // ── DATEV XML ──────────────────────────────────────────────────────────────

  private generateDATEVXml(config: ExportConfig, rechnungen: RechnungRecord[], auslagen: AuslageRecord[]): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<LedgerImport xmlns="http://xml.datev.de/bedi/tps/ledger/v050">');
    lines.push(`  <consolidate><accountsPayableLedger>`);

    for (const rechnung of rechnungen) {
      lines.push(`    <bookingRow>`);
      lines.push(`      <date>${rechnung.rechnungsdatum}</date>`);
      lines.push(`      <amount>${rechnung.brutto.toFixed(2)}</amount>`);
      lines.push(`      <accountNumber>${config.erloeskonto}</accountNumber>`);
      lines.push(`      <contraAccountNumber>1400</contraAccountNumber>`);
      lines.push(`      <bookingText>${this.escapeXml(rechnung.betreff)}</bookingText>`);
      lines.push(`      <invoiceId>${rechnung.rechnungsnummer}</invoiceId>`);
      lines.push(`      <currencyCode>EUR</currencyCode>`);
      if (rechnung.ustProzent > 0) {
        lines.push(`      <taxRate>${rechnung.ustProzent}</taxRate>`);
      }
      lines.push(`    </bookingRow>`);
    }

    for (const auslage of auslagen) {
      const konto = this.mapAuslagenKonto(auslage.kategorie, config);
      lines.push(`    <bookingRow>`);
      lines.push(`      <date>${auslage.datum}</date>`);
      lines.push(`      <amount>${auslage.betrag.toFixed(2)}</amount>`);
      lines.push(`      <accountNumber>${konto}</accountNumber>`);
      lines.push(`      <contraAccountNumber>1200</contraAccountNumber>`);
      lines.push(`      <bookingText>${this.escapeXml(auslage.bezeichnung)}</bookingText>`);
      lines.push(`      <currencyCode>${auslage.waehrung}</currencyCode>`);
      lines.push(`    </bookingRow>`);
    }

    lines.push(`  </accountsPayableLedger></consolidate>`);
    lines.push('</LedgerImport>');

    return lines.join('\n');
  }

  // ── BMD CSV ────────────────────────────────────────────────────────────────

  private generateBMDCsv(config: ExportConfig, rechnungen: RechnungRecord[], auslagen: AuslageRecord[]): string {
    const sep = config.csvSeparator;
    const lines: string[] = [];

    // Header
    lines.push([
      'Satzart', 'Buchungsdatum', 'Belegnummer', 'Buchungstext',
      'Sollkonto', 'Habenkonto', 'Betrag', 'USt-Code', 'USt-Betrag',
      'Waehrung', 'Firmennummer',
    ].map(h => `"${h}"`).join(sep));

    for (const rechnung of rechnungen) {
      const ustCode = rechnung.ustProzent === 20 ? 'U20' : rechnung.ustProzent === 10 ? 'U10' : '';

      lines.push([
        '"B"',
        `"${this.formatDateBMD(rechnung.rechnungsdatum)}"`,
        `"${rechnung.rechnungsnummer}"`,
        `"${this.sanitizeDATEV(rechnung.betreff)}"`,
        `"${BMD_KONTEN.forderungen}"`,
        `"${config.erloeskonto}"`,
        `"${rechnung.brutto.toFixed(2)}"`,
        `"${ustCode}"`,
        `"${rechnung.ustBetrag.toFixed(2)}"`,
        '"EUR"',
        `"${config.bmdFirmennummer ?? ''}"`,
      ].join(sep));
    }

    for (const auslage of auslagen) {
      lines.push([
        '"B"',
        `"${this.formatDateBMD(auslage.datum)}"`,
        `"${auslage.belegRef ?? ''}"`,
        `"${this.sanitizeDATEV(auslage.bezeichnung)}"`,
        `"${BMD_KONTEN.sonstige_auslagen}"`,
        `"${BMD_KONTEN.bank}"`,
        `"${auslage.betrag.toFixed(2)}"`,
        '""',
        '"0.00"',
        `"${auslage.waehrung}"`,
        `"${config.bmdFirmennummer ?? ''}"`,
      ].join(sep));
    }

    return lines.join('\r\n');
  }

  // ── BMD NTCS ───────────────────────────────────────────────────────────────

  private generateBMDNtcs(config: ExportConfig, rechnungen: RechnungRecord[], auslagen: AuslageRecord[]): string {
    // NTCS uses the same format as BMD CSV but with a different header row
    return this.generateBMDCsv(config, rechnungen, auslagen);
  }

  // ── Generic CSV ────────────────────────────────────────────────────────────

  private generateGenericCsv(
    config: ExportConfig,
    rechnungen: RechnungRecord[],
    auslagen: AuslageRecord[],
    zeiteintraege: TimeEntry[]
  ): string {
    const sep = config.csvSeparator;
    const lines: string[] = [];

    lines.push([
      'Typ', 'Datum', 'Belegnummer', 'Beschreibung', 'Mandant-ID',
      'Akte-ID', 'Netto', 'USt%', 'USt-Betrag', 'Brutto', 'Waehrung', 'Status',
    ].join(sep));

    for (const r of rechnungen) {
      lines.push([
        'Rechnung', r.rechnungsdatum, r.rechnungsnummer, `"${r.betreff}"`,
        r.clientId, r.matterId, r.netto.toFixed(2), String(r.ustProzent),
        r.ustBetrag.toFixed(2), r.brutto.toFixed(2), 'EUR', r.status,
      ].join(sep));
    }

    for (const a of auslagen) {
      lines.push([
        'Auslage', a.datum, a.belegRef ?? '', `"${a.bezeichnung}"`,
        a.clientId, a.matterId, a.betrag.toFixed(2), '0', '0',
        a.betrag.toFixed(2), a.waehrung, a.kategorie,
      ].join(sep));
    }

    for (const t of zeiteintraege) {
      lines.push([
        'Zeit', t.date, t.id, `"${t.description}"`,
        t.clientId, t.matterId, t.amount.toFixed(2), '0', '0',
        t.amount.toFixed(2), 'EUR', t.status,
      ].join(sep));
    }

    return lines.join('\r\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════════════

  private getRechnungenInRange(von: string, bis: string, matterId?: string, includeStorniert = false): RechnungRecord[] {
    const all = matterId
      ? this.rechnungService.getRechnungenForMatter(matterId)
      : this.rechnungService.getAllRechnungen();

    return all.filter((r: RechnungRecord) => {
      if (r.rechnungsdatum < von || r.rechnungsdatum > bis) return false;
      if (!includeStorniert && r.status === 'storniert') return false;
      return true;
    });
  }

  private getAuslagenInRange(von: string, bis: string, matterId?: string): AuslageRecord[] {
    const all = matterId
      ? this.rechnungService.getAuslagenForMatter(matterId)
      : this.rechnungService.getAllAuslagen();

    return all.filter((a: AuslageRecord) => {
      if (a.datum < von || a.datum > bis) return false;
      if (matterId && a.matterId !== matterId) return false;
      return true;
    });
  }

  private getZeiteintraegeInRange(von: string, bis: string, matterId?: string): TimeEntry[] {
    return this.timeTracking.getTimeEntriesByDateRange(von, bis).filter(
      t => !matterId || t.matterId === matterId
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private formatDateDATEV(isoDate: string): string {
    // DDMM format for DATEV
    const parts = isoDate.split('T')[0].split('-');
    return `${parts[2]}${parts[1]}`;
  }

  private formatDateBMD(isoDate: string): string {
    // DD.MM.YYYY for BMD
    const parts = isoDate.split('T')[0].split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  private formatAmountDATEV(amount: number): string {
    // DATEV uses comma as decimal separator
    return `"${amount.toFixed(2).replace('.', ',')}"`;
  }

  private sanitizeDATEV(text: string): string {
    return text.replace(/"/g, '').replace(/;/g, ',').substring(0, 60);
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private mapAuslagenKonto(kategorie: AuslageRecord['kategorie'], config: ExportConfig): string {
    const mapping: Record<AuslageRecord['kategorie'], string> = {
      gerichtskosten: config.provider === 'bmd' ? BMD_KONTEN.gerichtskosten : '4910',
      sachverstaendiger: '4900',
      zeuge: '4900',
      reisekosten: config.provider === 'bmd' ? BMD_KONTEN.reisekosten : '4660',
      kopien: '4900',
      post: '4910',
      sonstiges: config.aufwandskonto,
    };
    return mapping[kategorie] ?? config.aufwandskonto;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  async markDownloaded(runId: string): Promise<void> {
    const run = this.runsMap$.value[runId];
    if (!run) return;

    const nextRun: ExportRun = { ...run, status: 'downloaded' };
    this.runsMap$.next({
      ...this.runsMap$.value,
      [runId]: nextRun,
    });

    const config = this.configsMap$.value[run.configId];
    if (!config) return;

    await this.appendExportJournal({
      workspaceId: run.workspaceId,
      provider: config.provider,
      format: run.format,
      scope: run.scope,
      runId: run.id,
      fileName: run.fileName,
      recordCount: run.recordCount,
      totalNetto: run.totalNetto,
      totalBrutto: run.totalBrutto,
      status: 'downloaded',
      periodFrom: run.vonDatum,
      periodTo: run.bisDatum,
      triggeredBy: run.exportedBy,
    });
  }

  getExportContent(runId: string): { content: string; fileName: string } | null {
    const run = this.runsMap$.value[runId];
    if (!run || !run.content || !run.fileName) return null;
    return { content: run.content, fileName: run.fileName };
  }

  getRunHistory(workspaceId: string, limit = 20): ExportRun[] {
    return Object.values(this.runsMap$.value)
      .filter(r => r.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  getDashboardStats(): {
    totalExports: number;
    lastExportAt: string | null;
    configuredProviders: ExportProvider[];
  } {
    const runs = Object.values(this.runsMap$.value);
    const configs = Object.values(this.configsMap$.value);

    return {
      totalExports: runs.filter(r => r.status === 'ready' || r.status === 'downloaded').length,
      lastExportAt: runs
        .filter(r => r.completedAt)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]?.completedAt ?? null,
      configuredProviders: [...new Set(configs.map(c => c.provider))],
    };
  }
}
