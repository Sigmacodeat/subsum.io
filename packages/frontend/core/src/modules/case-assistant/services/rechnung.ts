import { Service } from '@toeverything/infra';
import { BehaviorSubject, map, type Subscription } from 'rxjs';

import type {
  AuslageRecord,
  RechnungRecord,
  AktenFinanzSummary,
  TimeEntry,
  RechnungsPaymentMethod,
  RechnungsZahlungRecord,
  KassenbelegRecord,
  FiscalSignatureRecord,
} from '../types';
import type { MandantenNotificationService } from './mandanten-notification';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { TimeTrackingService } from './time-tracking';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function assertPositiveNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} muss eine positive Zahl sein.`);
  }
}

function assertNonNegativeNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} darf nicht negativ sein.`);
  }
}

function assertIsoDate(value: string, field: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} muss ein gültiges Datum sein.`);
  }
}

function toAsciiPdfText(value: string): string {
  return value
    .replace(/[\u00e4]/g, 'ae')
    .replace(/[\u00f6]/g, 'oe')
    .replace(/[\u00fc]/g, 'ue')
    .replace(/[\u00c4]/g, 'Ae')
    .replace(/[\u00d6]/g, 'Oe')
    .replace(/[\u00dc]/g, 'Ue')
    .replace(/[\u00df]/g, 'ss')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const EDITABLE_FIELDS_AFTER_SEND = new Set<keyof RechnungRecord>([
  'status',
  'bezahltAm',
  'bezahlterBetrag',
  'zahlungen',
  'mahnungen',
  'updatedAt',
]);

const OPEN_PAYMENT_STATUSES: RechnungRecord['status'][] = new Set([
  'versendet',
  'teilbezahlt',
  'mahnung_1',
  'mahnung_2',
  'inkasso',
]);

function validateHonorarModel(input: {
  honorarModell?: RechnungRecord['honorarModell'];
  honorarTarifCode?: string;
}) {
  const model = input.honorarModell ?? 'hourly';
  const tariffCode = input.honorarTarifCode?.trim() ?? '';

  if ((model === 'rvg' || model === 'ratg') && !tariffCode) {
    throw new Error(`Für Honorar-Modell "${model.toUpperCase()}" ist ein Tarifcode erforderlich.`);
  }
}

export const RECHNUNG_STATUS_LABELS: Record<RechnungRecord['status'], string> = {
  entwurf: 'Entwurf',
  versendet: 'Versendet',
  bezahlt: 'Bezahlt',
  teilbezahlt: 'Teilbezahlt',
  storniert: 'Storniert',
  mahnung_1: '1. Mahnung',
  mahnung_2: '2. Mahnung',
  inkasso: 'Inkasso',
};

export const AUSLAGE_KATEGORIE_LABELS: Record<AuslageRecord['kategorie'], string> = {
  gerichtskosten: 'Gerichtskosten',
  sachverstaendiger: 'Sachverständiger',
  zeuge: 'Zeugengeld',
  reisekosten: 'Reisekosten',
  kopien: 'Kopien / Ausdrucke',
  post: 'Porto / Zustellung',
  sonstiges: 'Sonstiges',
};

/**
 * RechnungService — CRUD for invoices (Rechnungen) and expenses (Auslagen)
 * per matter, including dunning workflow and financial summaries.
 */
export class RechnungService extends Service {
  private rechnungenMap$ = new BehaviorSubject<Record<string, RechnungRecord>>({});
  private auslagenMap$ = new BehaviorSubject<Record<string, AuslageRecord>>({});
  private kassenbelegeMap$ = new BehaviorSubject<Record<string, KassenbelegRecord>>({});
  private readonly subscriptions: Subscription[] = [];

  readonly rechnungenList$ = this.rechnungenMap$.pipe(map(m => Object.values(m)));
  readonly auslagenList$ = this.auslagenMap$.pipe(map(m => Object.values(m)));
  readonly kassenbelegeList$ = this.kassenbelegeMap$.pipe(map(m => Object.values(m)));

  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly timeTracking: TimeTrackingService,
    private readonly notificationService: MandantenNotificationService
  ) {
    super();

    this.subscriptions.push(
      this.orchestration.rechnungen$.subscribe(items => {
        const nextMap: Record<string, RechnungRecord> = {};
        for (const item of items ?? []) {
          nextMap[item.id] = item;
        }
        this.rechnungenMap$.next(nextMap);
      })
    );

    this.subscriptions.push(
      this.orchestration.auslagen$.subscribe(items => {
        const nextMap: Record<string, AuslageRecord> = {};
        for (const item of items ?? []) {
          nextMap[item.id] = item;
        }
        this.auslagenMap$.next(nextMap);
      })
    );

    this.subscriptions.push(
      this.orchestration.kassenbelege$.subscribe(items => {
        const nextMap: Record<string, KassenbelegRecord> = {};
        for (const item of items ?? []) {
          nextMap[item.id] = item;
        }
        this.kassenbelegeMap$.next(nextMap);
      })
    );
  }

  override dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.length = 0;
    super.dispose();
  }

  private async sha256(value: string) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      throw new Error('Crypto API ist nicht verfügbar. Fiskale Signatur kann nicht erstellt werden.');
    }
    const bytes = new TextEncoder().encode(value);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async signFiscalEvent(input: {
    workspaceId: string;
    caseId?: string;
    matterId?: string;
    kassenbelegId?: string;
    eventType: 'cash_payment' | 'receipt_voided';
    payload: Record<string, string>;
  }): Promise<FiscalSignatureRecord> {
    const latest = await this.orchestration.getLatestFiscalSignature(input.workspaceId);
    const previousHash = latest?.chainHash ?? 'GENESIS';
    const payloadHash = await this.sha256(JSON.stringify(input.payload));
    const chainHash = await this.sha256(`${previousHash}:${payloadHash}`);
    const signedAt = new Date().toISOString();

    const signature: FiscalSignatureRecord = {
      id: createId('fiscal-signature'),
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      matterId: input.matterId,
      kassenbelegId: input.kassenbelegId,
      eventType: input.eventType,
      payloadHash,
      previousHash,
      chainHash,
      algorithm: 'sha256',
      signedAt,
    };

    await this.orchestration.upsertFiscalSignature(signature);
    return signature;
  }

  private buildRechnungComplianceSnapshot(record: RechnungRecord): string {
    const sortedPositionen = [...record.positionen].map(pos => ({
      bezeichnung: pos.bezeichnung,
      anzahl: pos.anzahl,
      einheit: pos.einheit,
      einzelpreis: pos.einzelpreis,
      gesamt: pos.gesamt,
      timeEntryId: pos.timeEntryId ?? null,
    }));
    const sortedPayments = [...(record.zahlungen ?? [])].map(payment => ({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.paidAt,
      reference: payment.reference ?? null,
    }));
    const sortedMahnungen = [...(record.mahnungen ?? [])].map(item => ({
      datum: item.datum,
      mahnstufe: item.mahnstufe,
      mahngebuehr: item.mahngebuehr,
    }));

    return JSON.stringify({
      id: record.id,
      rechnungsnummer: record.rechnungsnummer,
      rechnungsdatum: record.rechnungsdatum,
      faelligkeitsdatum: record.faelligkeitsdatum,
      betreff: record.betreff,
      netto: record.netto,
      ustProzent: record.ustProzent,
      ustBetrag: record.ustBetrag,
      brutto: record.brutto,
      honorarModell: record.honorarModell ?? null,
      honorarTarifCode: record.honorarTarifCode ?? null,
      leistungszeitraumVon: record.leistungszeitraumVon ?? null,
      leistungszeitraumBis: record.leistungszeitraumBis ?? null,
      status: record.status,
      bezahltAm: record.bezahltAm ?? null,
      bezahlterBetrag: record.bezahlterBetrag ?? 0,
      positionen: sortedPositionen,
      zahlungen: sortedPayments,
      mahnungen: sortedMahnungen,
    });
  }

  private buildInvoicePdfDataUrl(record: RechnungRecord): string {
    const lines: string[] = [
      `Rechnung ${record.rechnungsnummer}`,
      `Datum: ${record.rechnungsdatum}`,
      `Faelligkeit: ${record.faelligkeitsdatum}`,
      `Betreff: ${record.betreff}`,
      '--- Positionen ---',
      ...record.positionen.map(pos =>
        `${pos.bezeichnung} | ${pos.anzahl} ${pos.einheit} x ${pos.einzelpreis.toFixed(2)} EUR = ${pos.gesamt.toFixed(2)} EUR`
      ),
      '--- Summen ---',
      `Netto: ${record.netto.toFixed(2)} EUR`,
      `USt (${record.ustProzent}%): ${record.ustBetrag.toFixed(2)} EUR`,
      `Brutto: ${record.brutto.toFixed(2)} EUR`,
      `Status: ${record.status}`,
    ];

    let y = 790;
    const contentStream = [
      'BT',
      '/F1 10 Tf',
      '50 820 Td',
      `(Kanzlei-Rechnung) Tj`,
    ];
    for (const line of lines) {
      y -= 14;
      contentStream.push(`1 0 0 1 50 ${y} Tm`);
      contentStream.push(`(${toAsciiPdfText(line)}) Tj`);
    }
    contentStream.push('ET');
    const streamText = contentStream.join('\n');

    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${streamText.length} >>\nstream\n${streamText}\nendstream\nendobj\n`,
    ];

    const header = '%PDF-1.4\n';
    let body = '';
    const offsets: number[] = [0];
    let cursor = header.length;
    for (const object of objects) {
      offsets.push(cursor);
      body += object;
      cursor += object.length;
    }

    const xrefStart = header.length + body.length;
    let xref = `xref\n0 ${offsets.length}\n`;
    xref += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i++) {
      xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const pdfText = `${header}${body}${xref}${trailer}`;
    const pdfBytes = new TextEncoder().encode(pdfText);
    return `data:application/pdf;base64,${bytesToBase64(pdfBytes)}`;
  }

  private async appendRechnungComplianceAudit(input: {
    action: string;
    severity: 'info' | 'warning' | 'error';
    details: string;
    before?: RechnungRecord;
    after?: RechnungRecord;
    metadata?: Record<string, string>;
  }) {
    const workspaceId = input.after?.workspaceId ?? input.before?.workspaceId;
    const caseId = input.after?.caseId ?? input.before?.caseId;
    const beforeHash = input.before
      ? await this.sha256(this.buildRechnungComplianceSnapshot(input.before))
      : undefined;
    const afterHash = input.after
      ? await this.sha256(this.buildRechnungComplianceSnapshot(input.after))
      : undefined;

    await this.orchestration.appendAuditEntry({
      caseId,
      workspaceId: workspaceId ?? '',
      action: input.action,
      severity: input.severity,
      details: input.details,
      metadata: {
        rechnungId: input.after?.id ?? input.before?.id ?? '',
        rechnungsnummer:
          input.after?.rechnungsnummer ?? input.before?.rechnungsnummer ?? '',
        fromStatus: input.before?.status ?? '',
        toStatus: input.after?.status ?? '',
        beforeIntegrityHash: beforeHash ?? '',
        afterIntegrityHash: afterHash ?? '',
        ...(input.metadata ?? {}),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECHNUNGEN — CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  getRechnungenForMatter(matterId: string): RechnungRecord[] {
    return Object.values(this.rechnungenMap$.value)
      .filter(r => r.matterId === matterId)
      .sort((a, b) => new Date(b.rechnungsdatum).getTime() - new Date(a.rechnungsdatum).getTime());
  }

  getRechnungenForClient(clientId: string): RechnungRecord[] {
    return Object.values(this.rechnungenMap$.value)
      .filter(r => r.clientId === clientId)
      .sort((a, b) => new Date(b.rechnungsdatum).getTime() - new Date(a.rechnungsdatum).getTime());
  }

  getAllRechnungen(): RechnungRecord[] {
    return Object.values(this.rechnungenMap$.value).sort(
      (a, b) =>
        new Date(b.rechnungsdatum).getTime() - new Date(a.rechnungsdatum).getTime()
    );
  }

  getAllAuslagen(): AuslageRecord[] {
    return Object.values(this.auslagenMap$.value).sort(
      (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime()
    );
  }

  getOffeneRechnungen(): RechnungRecord[] {
    return Object.values(this.rechnungenMap$.value).filter(
      r => r.status === 'versendet' || r.status === 'teilbezahlt' || r.status === 'mahnung_1' || r.status === 'mahnung_2'
    );
  }

  getUeberfaelligeRechnungen(): RechnungRecord[] {
    const now = new Date().toISOString();
    return this.getOffeneRechnungen().filter(r => r.faelligkeitsdatum < now);
  }

  getRechnungById(id: string): RechnungRecord | undefined {
    return this.rechnungenMap$.value[id];
  }

  /**
   * Generates the next invoice number based on pattern: RE-YYYY-NNNN
   */
  generateNextRechnungsnummer(): string {
    const year = new Date().getFullYear();
    const prefix = `RE-${year}-`;
    const existing = Object.values(this.rechnungenMap$.value)
      .map(r => r.rechnungsnummer)
      .filter(n => n.startsWith(prefix));

    let maxSeq = 0;
    for (const num of existing) {
      const seqStr = num.replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  async createRechnung(input: {
    workspaceId: string;
    matterId: string;
    caseId: string;
    clientId: string;
    betreff: string;
    rechnungsdatum?: string;
    zahlungszielTage?: number;
    ustProzent?: number;
    honorarModell?: RechnungRecord['honorarModell'];
    honorarTarifCode?: string;
    leistungszeitraumVon?: string;
    leistungszeitraumBis?: string;
    positionen: Array<{
      bezeichnung: string;
      anzahl: number;
      einheit: 'stunde' | 'pauschale' | 'seite' | 'stück';
      einzelpreis: number;
      timeEntryId?: string;
    }>;
  }): Promise<RechnungRecord> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.clientId, 'Client-ID');
    assertNonEmpty(input.betreff, 'Betreff');

    if (!input.positionen || input.positionen.length === 0) {
      throw new Error('Mindestens eine Rechnungsposition erforderlich.');
    }

    validateHonorarModel(input);

    const now = new Date().toISOString();
    const rechnungsdatum = input.rechnungsdatum ?? now.split('T')[0];
    const zahlungszielTage = input.zahlungszielTage ?? 14;
    const ustProzent = input.ustProzent ?? 19;

    const faelligkeitsdatum = new Date(
      new Date(rechnungsdatum).getTime() + zahlungszielTage * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0];

    const positionen = input.positionen.map(p => ({
      bezeichnung: p.bezeichnung,
      anzahl: p.anzahl,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      gesamt: Math.round(p.anzahl * p.einzelpreis * 100) / 100,
      timeEntryId: p.timeEntryId,
    }));

    const netto = positionen.reduce((sum, p) => sum + p.gesamt, 0);
    const ustBetrag = Math.round(netto * (ustProzent / 100) * 100) / 100;
    const brutto = Math.round((netto + ustBetrag) * 100) / 100;

    const rechnung: RechnungRecord = {
      id: createId('rechnung'),
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      caseId: input.caseId,
      clientId: input.clientId,
      rechnungsnummer: this.generateNextRechnungsnummer(),
      rechnungsdatum,
      faelligkeitsdatum,
      betreff: input.betreff,
      positionen,
      netto: Math.round(netto * 100) / 100,
      ustProzent,
      ustBetrag,
      brutto,
      honorarModell: input.honorarModell ?? 'hourly',
      honorarTarifCode: input.honorarTarifCode,
      leistungszeitraumVon: input.leistungszeitraumVon,
      leistungszeitraumBis: input.leistungszeitraumBis,
      status: 'entwurf',
      zahlungen: [],
      mahnungen: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertRechnung(rechnung);

    await this.appendRechnungComplianceAudit({
      action: 'rechnung.created',
      severity: 'info',
      details: `Rechnung ${rechnung.rechnungsnummer} erstellt: ${rechnung.brutto} EUR (${rechnung.betreff})`,
      after: rechnung,
      metadata: {
        brutto: String(rechnung.brutto),
        legalEvent: 'invoice_created',
      },
    });

    return rechnung;
  }

  /**
   * Creates an invoice from unbilled time entries for a matter
   */
  async createRechnungFromTimeEntries(input: {
    workspaceId: string;
    matterId: string;
    caseId: string;
    clientId: string;
    betreff: string;
    ustProzent?: number;
    zahlungszielTage?: number;
    honorarModell?: RechnungRecord['honorarModell'];
    honorarTarifCode?: string;
    leistungszeitraumVon?: string;
    leistungszeitraumBis?: string;
  }): Promise<RechnungRecord> {
    const unbilled = this.timeTracking.getUnbilledTimeEntries(input.matterId);
    if (unbilled.length === 0) {
      throw new Error('Keine abrechenbaren Zeiteinträge für diese Akte.');
    }

    const positionen = unbilled.map((entry: TimeEntry) => ({
      bezeichnung: `${entry.description} (${entry.date})`,
      anzahl: Math.round((entry.durationMinutes / 60) * 100) / 100,
      einheit: 'stunde' as const,
      einzelpreis: entry.hourlyRate,
      timeEntryId: entry.id,
    }));

    const rechnung = await this.createRechnung({
      ...input,
      positionen,
    });

    // Mark time entries as invoiced
    for (const entry of unbilled) {
      await this.timeTracking.markAsInvoiced(entry.id, rechnung.id);
    }

    return rechnung;
  }

  async updateRechnung(
    rechnungId: string,
    updates: Partial<RechnungRecord>
  ): Promise<RechnungRecord | null> {
    const existing = this.rechnungenMap$.value[rechnungId];
    if (!existing) return null;

    if (existing.status !== 'entwurf') {
      const touchedFields = Object.keys(updates) as Array<keyof RechnungRecord>;
      const disallowed = touchedFields.filter(
        field => !EDITABLE_FIELDS_AFTER_SEND.has(field)
      );
      if (disallowed.length > 0) {
        throw new Error(
          `Rechnung ${existing.rechnungsnummer} ist nicht mehr frei editierbar. Nicht erlaubte Felder nach Versand: ${disallowed.join(', ')}`
        );
      }
    }

    if (
      updates.status &&
      existing.status === 'storniert' &&
      updates.status !== 'storniert'
    ) {
      throw new Error('Stornierte Rechnungen dürfen nicht reaktiviert werden. Bitte neue Rechnung erstellen.');
    }

    const updated: RechnungRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate totals if positionen changed
    if (updates.positionen) {
      updated.netto = Math.round(
        updated.positionen.reduce((sum, p) => sum + p.gesamt, 0) * 100
      ) / 100;
      updated.ustBetrag = Math.round(
        updated.netto * (updated.ustProzent / 100) * 100
      ) / 100;
      updated.brutto = Math.round(
        (updated.netto + updated.ustBetrag) * 100
      ) / 100;
    }

    await this.orchestration.upsertRechnung(updated);

    await this.appendRechnungComplianceAudit({
      action: 'rechnung.updated',
      severity: 'info',
      details: `Rechnung ${updated.rechnungsnummer} aktualisiert.`,
      before: existing,
      after: updated,
      metadata: {
        changedFields: Object.keys(updates).join(','),
        legalEvent: 'invoice_updated',
      },
    });

    return updated;
  }

  async sendRechnung(rechnungId: string): Promise<RechnungRecord | null> {
    const existing = this.rechnungenMap$.value[rechnungId];
    if (!existing) return null;
    if (existing.status !== 'entwurf') {
      throw new Error('Nur Entwurfs-Rechnungen können versendet werden.');
    }

    const updated = await this.updateRechnung(rechnungId, { status: 'versendet' });
    if (!updated) return null;

    await this.appendRechnungComplianceAudit({
      action: 'rechnung.sent',
      severity: 'info',
      details: `Rechnung ${updated.rechnungsnummer} wurde als versendet markiert.`,
      before: existing,
      after: updated,
      metadata: {
        legalEvent: 'invoice_sent',
      },
    });

    await this.notificationService.fireEvent({
      workspaceId: updated.workspaceId,
      caseId: updated.caseId,
      matterId: updated.matterId,
      event: 'invoice.sent',
      clientId: updated.clientId,
      variables: {
        rechnungsnummer: updated.rechnungsnummer,
        brutto: updated.brutto.toFixed(2),
        faelligkeitsdatum: updated.faelligkeitsdatum,
        paymentHint: 'Bitte überweisen Sie den Betrag fristgerecht auf das Kanzleikonto.',
        attachmentRefs: this.buildInvoicePdfDataUrl(updated),
      },
    });

    return updated;
  }

  async markBezahlt(rechnungId: string, betrag?: number): Promise<RechnungRecord | null> {
    return this.recordPayment(rechnungId, {
      amount: betrag,
      method: 'bank_transfer',
      paidAt: new Date().toISOString(),
    });
  }

  async recordPayment(
    rechnungId: string,
    input: {
      amount?: number;
      method: RechnungsPaymentMethod;
      paidAt?: string;
      reference?: string;
    }
  ): Promise<RechnungRecord | null> {
    const existing = this.rechnungenMap$.value[rechnungId];
    if (!existing) return null;
    if (existing.status === 'storniert') {
      throw new Error('Stornierte Rechnungen können nicht bezahlt werden.');
    }
    if (!OPEN_PAYMENT_STATUSES.has(existing.status) && existing.status !== 'bezahlt') {
      throw new Error('Zahlung nur für versendete/offene Rechnungen zulässig.');
    }

    const amount = input.amount ?? existing.brutto;
    assertPositiveNumber(amount, 'Zahlungsbetrag');

    const paidAt = input.paidAt ?? new Date().toISOString();
    assertIsoDate(paidAt, 'Zahlungsdatum');
    if (new Date(paidAt).getTime() < new Date(existing.rechnungsdatum).getTime()) {
      throw new Error('Zahlungsdatum darf nicht vor dem Rechnungsdatum liegen.');
    }

    const payments = [...(existing.zahlungen ?? [])];
    const payment: RechnungsZahlungRecord = {
      id: createId('zahlung'),
      rechnungId,
      amount: Math.round(amount * 100) / 100,
      method: input.method,
      paidAt,
      reference: input.reference?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    payments.push(payment);

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid > existing.brutto + 0.01) {
      throw new Error(
        `Überzahlung nicht zulässig: offen ${(existing.brutto - (existing.bezahlterBetrag ?? 0)).toFixed(2)} EUR.`
      );
    }
    const cappedPaid = Math.min(totalPaid, existing.brutto);
    const nextStatus: RechnungRecord['status'] =
      cappedPaid >= existing.brutto ? 'bezahlt' : 'teilbezahlt';

    const updated = await this.updateRechnung(rechnungId, {
      status: nextStatus,
      bezahltAm: paidAt,
      bezahlterBetrag: Math.round(cappedPaid * 100) / 100,
      zahlungen: payments,
    });

    if (!updated) return null;

    if (input.method === 'cash') {
      await this.createOrUpdateKassenbeleg(updated, payment);
    }

    await this.appendRechnungComplianceAudit({
      action: 'rechnung.payment.recorded',
      severity: 'info',
      details: `Zahlung erfasst: ${payment.amount.toFixed(2)} EUR via ${payment.method} für ${existing.rechnungsnummer}`,
      before: existing,
      after: updated,
      metadata: {
        paymentId: payment.id,
        totalPaid: String(cappedPaid),
        paymentMethod: payment.method,
        legalEvent: 'invoice_payment_recorded',
      },
    });

    await this.notificationService.fireEvent({
      workspaceId: updated.workspaceId,
      caseId: updated.caseId,
      matterId: updated.matterId,
      event: nextStatus === 'bezahlt' ? 'invoice.paid' : 'invoice.partially_paid',
      clientId: updated.clientId,
      variables: {
        rechnungsnummer: updated.rechnungsnummer,
        betrag: payment.amount.toFixed(2),
      },
    });

    return updated;
  }

  async stornieren(rechnungId: string): Promise<RechnungRecord | null> {
    const existing = this.rechnungenMap$.value[rechnungId];
    if (!existing) return null;
    if (existing.status === 'storniert') {
      return existing;
    }

    // Unmark time entries that were linked to this invoice
    for (const pos of existing.positionen) {
      if (pos.timeEntryId) {
        await this.timeTracking.updateTimeEntry(pos.timeEntryId, {
          status: 'approved',
          invoiceId: undefined,
        });
      }
    }

    const updated = await this.updateRechnung(rechnungId, { status: 'storniert' });
    if (!updated) return null;

    await this.appendRechnungComplianceAudit({
      action: 'rechnung.storniert',
      severity: 'warning',
      details: `Rechnung ${updated.rechnungsnummer} wurde storniert.`,
      before: existing,
      after: updated,
      metadata: {
        legalEvent: 'invoice_voided',
      },
    });

    const belege = this.getKassenbelegeForRechnung(rechnungId);
    if (belege.length > 0) {
      const nextMap = { ...this.kassenbelegeMap$.value };
      const now = new Date().toISOString();
      for (const beleg of belege) {
        const updatedBeleg: KassenbelegRecord = {
          ...beleg,
          storniert: true,
          storniertAm: now,
          stornoGrund: 'Rechnung storniert',
          updatedAt: now,
        };

        const voidSignature = await this.signFiscalEvent({
          workspaceId: existing.workspaceId,
          caseId: existing.caseId,
          matterId: existing.matterId,
          kassenbelegId: updatedBeleg.id,
          eventType: 'receipt_voided',
          payload: {
            rechnungId: existing.id,
            belegnummer: updatedBeleg.belegnummer,
            zahlungsbetrag: String(updatedBeleg.zahlungsbetrag),
            stornoGrund: updatedBeleg.stornoGrund ?? 'Rechnung storniert',
            storniertAm: updatedBeleg.storniertAm ?? now,
          },
        });

        updatedBeleg.fiscalSignatureId = voidSignature.id;
        updatedBeleg.fiscalSignatureHash = voidSignature.chainHash;
        updatedBeleg.fiscalPreviousHash = voidSignature.previousHash;

        nextMap[beleg.id] = updatedBeleg;
        await this.orchestration.upsertKassenbeleg(updatedBeleg);

        await this.orchestration.appendAuditEntry({
          caseId: existing.caseId,
          workspaceId: existing.workspaceId,
          action: 'kassenbeleg.storniert',
          severity: 'warning',
          details: `Kassenbeleg ${updatedBeleg.belegnummer} wurde wegen Rechnungsstorno storniert.`,
          metadata: {
            rechnungId: existing.id,
            belegId: updatedBeleg.id,
          },
        });
      }
      this.kassenbelegeMap$.next(nextMap);
    }

    return updated;
  }

  /**
   * Dunning workflow — creates a Mahnung entry on the invoice
   */
  async createMahnung(
    rechnungId: string,
    mahngebuehr: number = 0
  ): Promise<RechnungRecord | null> {
    const existing = this.rechnungenMap$.value[rechnungId];
    if (!existing) return null;
    if (existing.status === 'storniert') {
      throw new Error('Für stornierte Rechnungen können keine Mahnungen erzeugt werden.');
    }

    assertNonNegativeNumber(mahngebuehr, 'Mahngebühr');

    const currentMahnungen = existing.mahnungen ?? [];
    const nextStufe = currentMahnungen.length + 1;

    if (nextStufe > 3) {
      throw new Error('Maximale Mahnstufe (3) bereits erreicht. Bitte Inkasso einleiten.');
    }

    const newMahnung = {
      datum: new Date().toISOString().split('T')[0],
      mahnstufe: nextStufe,
      mahngebuehr,
    };

    const newStatus: RechnungRecord['status'] =
      nextStufe === 1 ? 'mahnung_1' :
      nextStufe === 2 ? 'mahnung_2' :
      'inkasso';

    const updated = await this.updateRechnung(rechnungId, {
      status: newStatus,
      mahnungen: [...currentMahnungen, newMahnung],
    });
    if (!updated) return null;

    await this.appendRechnungComplianceAudit({
      action: 'rechnung.mahnung.created',
      severity: 'warning',
      details: `Mahnung Stufe ${nextStufe} für ${updated.rechnungsnummer} erstellt.`,
      before: existing,
      after: updated,
      metadata: {
        mahnstufe: String(nextStufe),
        mahngebuehr: String(mahngebuehr),
        legalEvent: 'invoice_dunning_step_created',
      },
    });

    return updated;
  }

  async deleteRechnung(rechnungId: string): Promise<boolean> {
    const existing = this.rechnungenMap$.value[rechnungId];
    if (!existing) return false;

    if (existing.status !== 'entwurf') {
      throw new Error('Nur Entwurfs-Rechnungen können gelöscht werden. Versendet → Stornieren.');
    }

    const updatedMap = { ...this.rechnungenMap$.value };
    delete updatedMap[rechnungId];
    this.rechnungenMap$.next(updatedMap);
    await this.orchestration.deleteRechnung(rechnungId);

    await this.appendRechnungComplianceAudit({
      action: 'rechnung.deleted',
      severity: 'warning',
      details: `Entwurfs-Rechnung ${existing.rechnungsnummer} wurde gelöscht.`,
      before: existing,
      metadata: {
        legalEvent: 'invoice_draft_deleted',
      },
    });

    return true;
  }

  getKassenbelegeForRechnung(rechnungId: string): KassenbelegRecord[] {
    return Object.values(this.kassenbelegeMap$.value)
      .filter(b => b.rechnungId === rechnungId)
      .sort(
        (a, b) =>
          new Date(b.buchungsdatum).getTime() -
          new Date(a.buchungsdatum).getTime()
      );
  }

  getKassenbelegeForMatter(matterId: string): KassenbelegRecord[] {
    return Object.values(this.kassenbelegeMap$.value)
      .filter(b => b.matterId === matterId)
      .sort(
        (a, b) =>
          new Date(b.buchungsdatum).getTime() -
          new Date(a.buchungsdatum).getTime()
      );
  }

  getAllKassenbelege(): KassenbelegRecord[] {
    return Object.values(this.kassenbelegeMap$.value).sort(
      (a, b) =>
        new Date(b.buchungsdatum).getTime() - new Date(a.buchungsdatum).getTime()
    );
  }

  private async createOrUpdateKassenbeleg(
    rechnung: RechnungRecord,
    payment: RechnungsZahlungRecord
  ) {
    const now = new Date().toISOString();
    const paymentIdParts = payment.id.split(':');
    const paymentSuffix = paymentIdParts[paymentIdParts.length - 1] ?? payment.id;
    const ustFactor = rechnung.ustProzent / 100;
    const nettoBetrag = Math.round((payment.amount / (1 + ustFactor)) * 100) / 100;
    const ustBetrag = Math.round((payment.amount - nettoBetrag) * 100) / 100;

    const beleg: KassenbelegRecord = {
      id: createId('kassenbeleg'),
      workspaceId: rechnung.workspaceId,
      matterId: rechnung.matterId,
      caseId: rechnung.caseId,
      clientId: rechnung.clientId,
      rechnungId: rechnung.id,
      belegnummer: `K-${new Date().getFullYear()}-${paymentSuffix}`,
      zahlungsbetrag: payment.amount,
      waehrung: 'EUR',
      ustProzent: rechnung.ustProzent,
      ustBetrag,
      nettoBetrag,
      paymentMethod: payment.method,
      buchungsdatum: payment.paidAt,
      leistungsbeschreibung: rechnung.betreff,
      storniert: false,
      createdAt: now,
      updatedAt: now,
    };

    const signature = await this.signFiscalEvent({
      workspaceId: rechnung.workspaceId,
      caseId: rechnung.caseId,
      matterId: rechnung.matterId,
      kassenbelegId: beleg.id,
      eventType: 'cash_payment',
      payload: {
        rechnungId: rechnung.id,
        rechnungsnummer: rechnung.rechnungsnummer,
        belegnummer: beleg.belegnummer,
        zahlungsbetrag: String(beleg.zahlungsbetrag),
        zahlungsdatum: beleg.buchungsdatum,
      },
    });

    beleg.fiscalSignatureId = signature.id;
    beleg.fiscalSignatureHash = signature.chainHash;
    beleg.fiscalPreviousHash = signature.previousHash;

    await this.orchestration.upsertKassenbeleg(beleg);

    await this.orchestration.appendAuditEntry({
      caseId: rechnung.caseId,
      workspaceId: rechnung.workspaceId,
      action: 'kassenbeleg.created',
      severity: 'info',
      details: `Kassenbeleg erstellt (${beleg.belegnummer}) für Rechnung ${rechnung.rechnungsnummer}`,
      metadata: {
        rechnungId: rechnung.id,
        belegId: beleg.id,
        amount: String(beleg.zahlungsbetrag),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUSLAGEN — CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  getAuslagenForMatter(matterId: string): AuslageRecord[] {
    return Object.values(this.auslagenMap$.value)
      .filter(a => a.matterId === matterId)
      .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
  }

  getAuslagenForClient(clientId: string): AuslageRecord[] {
    return Object.values(this.auslagenMap$.value)
      .filter(a => a.clientId === clientId)
      .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
  }

  getNichtWeiterberechneteAuslagen(matterId?: string): AuslageRecord[] {
    return Object.values(this.auslagenMap$.value).filter(a => {
      if (a.weiterberechnet) return false;
      if (matterId && a.matterId !== matterId) return false;
      return true;
    });
  }

  async createAuslage(input: {
    workspaceId: string;
    matterId: string;
    caseId: string;
    clientId: string;
    bezeichnung: string;
    betrag: number;
    waehrung?: string;
    datum: string;
    belegRef?: string;
    kategorie: AuslageRecord['kategorie'];
  }): Promise<AuslageRecord> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.clientId, 'Client-ID');
    assertNonEmpty(input.bezeichnung, 'Bezeichnung');
    assertPositiveNumber(input.betrag, 'Betrag');
    assertIsoDate(input.datum, 'Datum');

    const now = new Date().toISOString();

    const auslage: AuslageRecord = {
      id: createId('auslage'),
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      caseId: input.caseId,
      clientId: input.clientId,
      bezeichnung: input.bezeichnung,
      betrag: input.betrag,
      waehrung: input.waehrung ?? 'EUR',
      datum: input.datum,
      belegRef: input.belegRef,
      kategorie: input.kategorie,
      weiterberechnet: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertAuslage(auslage);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'auslage.created',
      severity: 'info',
      details: `Auslage erfasst: ${input.bezeichnung} — ${input.betrag} ${input.waehrung ?? 'EUR'}`,
      metadata: {
        betrag: String(input.betrag),
        kategorie: input.kategorie,
      },
    });

    return auslage;
  }

  async updateAuslage(
    auslageId: string,
    updates: Partial<AuslageRecord>
  ): Promise<AuslageRecord | null> {
    const existing = this.auslagenMap$.value[auslageId];
    if (!existing) return null;

    const updated: AuslageRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.orchestration.upsertAuslage(updated);

    return updated;
  }

  async markAuslageWeiterberechnet(auslageId: string, rechnungId: string): Promise<AuslageRecord | null> {
    return this.updateAuslage(auslageId, {
      weiterberechnet: true,
      rechnungId,
    });
  }

  async deleteAuslage(auslageId: string): Promise<boolean> {
    const existing = this.auslagenMap$.value[auslageId];
    if (!existing) return false;

    if (existing.weiterberechnet) {
      throw new Error('Weiterberechnete Auslagen können nicht gelöscht werden.');
    }

    const updatedMap = { ...this.auslagenMap$.value };
    delete updatedMap[auslageId];
    this.auslagenMap$.next(updatedMap);
    await this.orchestration.deleteAuslage(auslageId);

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AKTEN-FINANZ-SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  getAktenFinanzSummary(matterId: string): AktenFinanzSummary {
    const timeEntries = this.timeTracking.getTimeEntriesForMatter(matterId);
    const rechnungen = this.getRechnungenForMatter(matterId);
    const auslagen = this.getAuslagenForMatter(matterId);

    const totalZeitMinuten = timeEntries.reduce(
      (sum: number, e: TimeEntry) => sum + e.durationMinutes, 0
    );
    const totalZeitWert = timeEntries.reduce(
      (sum: number, e: TimeEntry) => sum + e.amount, 0
    );
    const totalAuslagen = auslagen.reduce((sum, a) => sum + a.betrag, 0);

    const totalRechnungenNetto = rechnungen
      .filter(r => r.status !== 'storniert')
      .reduce((sum, r) => sum + r.netto, 0);
    const totalRechnungenBezahlt = rechnungen
      .filter(r => r.status === 'bezahlt' || r.status === 'teilbezahlt')
      .reduce((sum, r) => sum + (r.bezahlterBetrag ?? 0), 0);

    const offenePosten = rechnungen
      .filter(r =>
        r.status === 'versendet' ||
        r.status === 'teilbezahlt' ||
        r.status === 'mahnung_1' ||
        r.status === 'mahnung_2' ||
        r.status === 'inkasso'
      )
      .reduce((sum, r) => sum + r.brutto - (r.bezahlterBetrag ?? 0), 0);

    const marge = totalRechnungenBezahlt - totalAuslagen;

    return {
      matterId,
      totalZeitMinuten: Math.round(totalZeitMinuten),
      totalZeitWert: Math.round(totalZeitWert * 100) / 100,
      totalAuslagen: Math.round(totalAuslagen * 100) / 100,
      totalRechnungenNetto: Math.round(totalRechnungenNetto * 100) / 100,
      totalRechnungenBezahlt: Math.round(totalRechnungenBezahlt * 100) / 100,
      offenePosten: Math.round(offenePosten * 100) / 100,
      marge: Math.round(marge * 100) / 100,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns financial KPIs across all matters
   */
  getKanzleiFinanzKPIs(): {
    totalOffenePosten: number;
    totalUeberfaellig: number;
    totalUmsatzMonat: number;
    totalAuslagenMonat: number;
    rechnungenEntwurf: number;
    rechnungenOffen: number;
    rechnungenUeberfaellig: number;
  } {
    const allRechnungen = Object.values(this.rechnungenMap$.value);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const offeneRechnungen = allRechnungen.filter(
      r => r.status === 'versendet' || r.status === 'teilbezahlt' ||
           r.status === 'mahnung_1' || r.status === 'mahnung_2' || r.status === 'inkasso'
    );

    const ueberfaelligeRechnungen = offeneRechnungen.filter(
      r => r.faelligkeitsdatum < now.toISOString()
    );

    const bezahlteDiesenMonat = allRechnungen.filter(
      r => r.status === 'bezahlt' && r.bezahltAm && r.bezahltAm >= monthStart
    );

    const auslagenDiesenMonat = Object.values(this.auslagenMap$.value).filter(
      a => a.datum >= monthStart
    );

    return {
      totalOffenePosten: offeneRechnungen.reduce(
        (sum, r) => sum + r.brutto - (r.bezahlterBetrag ?? 0), 0
      ),
      totalUeberfaellig: ueberfaelligeRechnungen.reduce(
        (sum, r) => sum + r.brutto - (r.bezahlterBetrag ?? 0), 0
      ),
      totalUmsatzMonat: bezahlteDiesenMonat.reduce(
        (sum, r) => sum + (r.bezahlterBetrag ?? 0), 0
      ),
      totalAuslagenMonat: auslagenDiesenMonat.reduce(
        (sum, a) => sum + a.betrag, 0
      ),
      rechnungenEntwurf: allRechnungen.filter(r => r.status === 'entwurf').length,
      rechnungenOffen: offeneRechnungen.length,
      rechnungenUeberfaellig: ueberfaelligeRechnungen.length,
    };
  }
}
