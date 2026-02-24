import { webcrypto } from 'node:crypto';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { DATEVExportService } from '../services/datev-export';
import { RechnungService } from '../services/rechnung';
import type {
  ComplianceAuditEntry,
  ExportJournalRecord,
  FiscalSignatureRecord,
  KassenbelegRecord,
  RechnungRecord,
  AuslageRecord,
  TimeEntry,
} from '../types';

vi.mock('@toeverything/infra', async importOriginal => {
  const actual = await importOriginal<typeof import('@toeverything/infra')>();
  return {
    ...actual,
    Service: class {},
  };
});

function createTimeTrackingMock() {
  return {
    getUnbilledTimeEntries: (_matterId: string) => [] as TimeEntry[],
    async markAsInvoiced(_entryId: string, _invoiceId: string) {
      return;
    },
    async updateTimeEntry(_entryId: string, _updates: Partial<TimeEntry>) {
      return null;
    },
    getTimeEntriesForMatter: (_matterId: string) => [] as TimeEntry[],
    getTimeEntriesByDateRange: (_from: string, _to: string) => [] as TimeEntry[],
  };
}

function createOrchestrationMock() {
  const rechnungen$ = new BehaviorSubject<RechnungRecord[]>([]);
  const auslagen$ = new BehaviorSubject<AuslageRecord[]>([]);
  const kassenbelege$ = new BehaviorSubject<KassenbelegRecord[]>([]);
  const fiscalSignatures$ = new BehaviorSubject<FiscalSignatureRecord[]>([]);
  const exportJournal$ = new BehaviorSubject<ExportJournalRecord[]>([]);
  const auditEntries$ = new BehaviorSubject<ComplianceAuditEntry[]>([]);

  return {
    rechnungen$,
    auslagen$,
    kassenbelege$,
    fiscalSignatures$,
    exportJournal$,
    auditEntries$,
    async upsertRechnung(entry: RechnungRecord) {
      const next = [...rechnungen$.value.filter(e => e.id !== entry.id), entry];
      rechnungen$.next(next);
      return entry;
    },
    async deleteRechnung(entryId: string) {
      rechnungen$.next(rechnungen$.value.filter(e => e.id !== entryId));
    },
    async upsertAuslage(entry: AuslageRecord) {
      const next = [...auslagen$.value.filter(e => e.id !== entry.id), entry];
      auslagen$.next(next);
      return entry;
    },
    async deleteAuslage(entryId: string) {
      auslagen$.next(auslagen$.value.filter(e => e.id !== entryId));
    },
    async upsertKassenbeleg(entry: KassenbelegRecord) {
      const next = [...kassenbelege$.value.filter(e => e.id !== entry.id), entry];
      kassenbelege$.next(next);
      return entry;
    },
    async deleteKassenbeleg(entryId: string) {
      kassenbelege$.next(kassenbelege$.value.filter(e => e.id !== entryId));
    },
    async upsertFiscalSignature(entry: FiscalSignatureRecord) {
      const next = [...fiscalSignatures$.value.filter(e => e.id !== entry.id), entry];
      fiscalSignatures$.next(next);
      return entry;
    },
    async getLatestFiscalSignature(workspaceId: string) {
      return (
        [...fiscalSignatures$.value]
          .filter(e => e.workspaceId === workspaceId)
          .sort((a, b) => b.signedAt.localeCompare(a.signedAt))[0] ?? null
      );
    },
    async upsertExportJournal(entry: ExportJournalRecord) {
      const next = [...exportJournal$.value.filter(e => e.id !== entry.id), entry];
      exportJournal$.next(next);
      return entry;
    },
    async getLatestExportJournal(workspaceId: string) {
      return (
        [...exportJournal$.value]
          .filter(e => e.workspaceId === workspaceId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      );
    },
    async appendAuditEntry(entry: Omit<ComplianceAuditEntry, 'id' | 'createdAt'>) {
      const now = new Date().toISOString();
      const nextEntry: ComplianceAuditEntry = {
        id: `audit:${auditEntries$.value.length + 1}`,
        ...entry,
        createdAt: now,
      };
      auditEntries$.next([...auditEntries$.value, nextEntry]);
      return nextEntry;
    },
  };
}

describe('Billing compliance hardening', () => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  }

  test('creates a fiscal signature chain for cash payment and receipt voiding', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const service = new RechnungService(orchestration as never, timeTracking as never);

    const invoice = await service.createRechnung({
      workspaceId: 'ws-1',
      matterId: 'matter-1',
      caseId: 'case-1',
      clientId: 'client-1',
      betreff: 'Beratung',
      rechnungsdatum: '2026-02-20',
      positionen: [
        {
          bezeichnung: 'Telefonat',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 200,
        },
      ],
    });

    await service.sendRechnung(invoice.id);
    await service.recordPayment(invoice.id, {
      method: 'cash',
      amount: 238,
      paidAt: '2026-02-21',
    });

    const firstSignature = orchestration.fiscalSignatures$.value[0];
    expect(firstSignature).toBeTruthy();
    expect(firstSignature.eventType).toBe('cash_payment');
    expect(firstSignature.previousHash).toBe('GENESIS');

    await service.stornieren(invoice.id);

    const signatures = [...orchestration.fiscalSignatures$.value].sort((a, b) =>
      a.signedAt.localeCompare(b.signedAt)
    );

    expect(signatures).toHaveLength(2);
    expect(signatures[1].eventType).toBe('receipt_voided');
    expect(signatures[1].previousHash).toBe(signatures[0].chainHash);
  });

  test('writes hash-chained export journal entries for ready and downloaded states', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    await rechnungService.createRechnung({
      workspaceId: 'ws-2',
      matterId: 'matter-2',
      caseId: 'case-2',
      clientId: 'client-2',
      betreff: 'Gutachten',
      rechnungsdatum: '2026-02-20',
      positionen: [
        {
          bezeichnung: 'Gutachten',
          anzahl: 2,
          einheit: 'stunde',
          einzelpreis: 150,
        },
      ],
    });

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'DE',
        graph$: {
          value: {
            clients: {
              'client-2': { displayName: 'Mandant 2' },
            },
            matters: {
              'matter-2': { title: 'Akte 2' },
            },
          },
        },
        getClientsForMatter: () => ['client-2'],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-1',
            workspaceId: 'ws-2',
            name: 'Kanzlei Beispiel',
            steuernummer: '12/345/6789',
            datevBeraternummer: '1234',
            datevMandantennummer: '5678',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    const config = await exportService.createConfig({
      workspaceId: 'ws-2',
      provider: 'datev',
      format: 'datev_ascii',
      beraternummer: '1234',
      mandantennummer: '5678',
    });

    const run = await exportService.runExport({
      workspaceId: 'ws-2',
      configId: config.id,
      scope: 'alles',
      vonDatum: '2026-02-01',
      bisDatum: '2026-02-28',
      exportedBy: 'user-1',
      exportedByName: 'Max Mustermann',
    });

    expect(run.status).toBe('ready');

    const firstJournal = orchestration.exportJournal$.value.find(e => e.runId === run.id && e.status === 'ready');
    expect(firstJournal).toBeTruthy();
    expect(firstJournal?.previousHash).toBe('GENESIS');

    await exportService.markDownloaded(run.id);

    const downloadedEntry = orchestration.exportJournal$.value
      .filter(e => e.runId === run.id && e.status === 'downloaded')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    expect(downloadedEntry).toBeTruthy();
    expect(downloadedEntry.previousHash).toBe(firstJournal?.chainHash);
  });

  test('blocks one-click export when tax rate violates jurisdiction rules', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    await rechnungService.createRechnung({
      workspaceId: 'ws-3',
      matterId: 'matter-3',
      caseId: 'case-3',
      clientId: 'client-3',
      betreff: 'Auslandsleistung',
      rechnungsdatum: '2026-02-20',
      ustProzent: 13,
      positionen: [
        {
          bezeichnung: 'Leistung',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 100,
        },
      ],
    });

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'DE',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-3',
            workspaceId: 'ws-3',
            name: 'Kanzlei Beispiel',
            steuernummer: '12/345/6789',
            datevBeraternummer: '1234',
            datevMandantennummer: '5678',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    await expect(
      exportService.runOneClickAccountingExport({
        workspaceId: 'ws-3',
        vonDatum: '2026-02-01',
        bisDatum: '2026-02-28',
        exportedBy: 'user-3',
        exportedByName: 'Test',
      })
    ).rejects.toThrow('Steuer-/Regelverletzungen');
  });

  test('blocks one-click export for invalid date ranges', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'DE',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-5',
            workspaceId: 'ws-5',
            name: 'Kanzlei Beispiel',
            steuernummer: '12/345/6789',
            datevBeraternummer: '1234',
            datevMandantennummer: '5678',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    await expect(
      exportService.runOneClickAccountingExport({
        workspaceId: 'ws-5',
        vonDatum: '2026-03-01',
        bisDatum: '2026-02-01',
        exportedBy: 'user-5',
        exportedByName: 'Test',
      })
    ).rejects.toThrow('Von-Datum liegt nach Bis-Datum');
  });

  test('blocks one-click export for FR when tax rate is not allowed', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    await rechnungService.createRechnung({
      workspaceId: 'ws-fr',
      matterId: 'matter-fr',
      caseId: 'case-fr',
      clientId: 'client-fr',
      betreff: 'FR Leistung',
      rechnungsdatum: '2026-02-20',
      ustProzent: 19,
      positionen: [
        {
          bezeichnung: 'Leistung',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 100,
        },
      ],
    });

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'FR',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-fr',
            workspaceId: 'ws-fr',
            name: 'Cabinet Exemple',
            steuernummer: 'FR123',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    await expect(
      exportService.runOneClickAccountingExport({
        workspaceId: 'ws-fr',
        vonDatum: '2026-02-01',
        bisDatum: '2026-02-28',
        exportedBy: 'user-fr',
        exportedByName: 'Test',
      })
    ).rejects.toThrow('Steuer-/Regelverletzungen');
  });

  test('allows EU one-click export without fixed tax matrix and returns warning', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    await rechnungService.createRechnung({
      workspaceId: 'ws-eu',
      matterId: 'matter-eu',
      caseId: 'case-eu',
      clientId: 'client-eu',
      betreff: 'EU Leistung',
      rechnungsdatum: '2026-02-20',
      ustProzent: 19,
      positionen: [
        {
          bezeichnung: 'Leistung',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 100,
        },
      ],
    });

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'EU',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-eu',
            workspaceId: 'ws-eu',
            name: 'Kanzlei EU',
            steuernummer: 'EU123',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    const result = await exportService.runOneClickAccountingExport({
      workspaceId: 'ws-eu',
      vonDatum: '2026-02-01',
      bisDatum: '2026-02-28',
      exportedBy: 'user-eu',
      exportedByName: 'Test',
    });

    expect(result.run.status).toBe('ready');
    expect(
      result.compliance.warnings.some(w => w.includes('keine fixen USt-Regelsätze'))
    ).toBe(true);
  });

  test('blocks CH one-click export when required USt-IdNr is missing', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    await rechnungService.createRechnung({
      workspaceId: 'ws-ch',
      matterId: 'matter-ch',
      caseId: 'case-ch',
      clientId: 'client-ch',
      betreff: 'CH Leistung',
      rechnungsdatum: '2026-02-20',
      ustProzent: 8.1,
      positionen: [
        {
          bezeichnung: 'Leistung',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 100,
        },
      ],
    });

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'CH',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-ch-1',
            workspaceId: 'ws-ch',
            name: 'Kanzlei CH',
            steuernummer: 'CHE-123',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    await expect(
      exportService.runOneClickAccountingExport({
        workspaceId: 'ws-ch',
        vonDatum: '2026-02-01',
        bisDatum: '2026-02-28',
        exportedBy: 'user-ch',
        exportedByName: 'Test',
      })
    ).rejects.toThrow('USt-IdNr');
  });

  test('allows CH one-click export when required USt-IdNr is present', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    await rechnungService.createRechnung({
      workspaceId: 'ws-ch-2',
      matterId: 'matter-ch-2',
      caseId: 'case-ch-2',
      clientId: 'client-ch-2',
      betreff: 'CH Leistung 2',
      rechnungsdatum: '2026-02-20',
      ustProzent: 8.1,
      positionen: [
        {
          bezeichnung: 'Leistung',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 100,
        },
      ],
    });

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'CH',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-ch-2',
            workspaceId: 'ws-ch-2',
            name: 'Kanzlei CH',
            steuernummer: 'CHE-456',
            ustIdNr: 'CHE-123.456.789 MWST',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    const result = await exportService.runOneClickAccountingExport({
      workspaceId: 'ws-ch-2',
      vonDatum: '2026-02-01',
      bisDatum: '2026-02-28',
      exportedBy: 'user-ch-2',
      exportedByName: 'Test',
    });

    expect(result.provider).toBe('csv');
    expect(result.run.status).toBe('ready');
  });

  test('daily closure reports inconsistent chain when signature links are broken', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    const invoice = await rechnungService.createRechnung({
      workspaceId: 'ws-4',
      matterId: 'matter-4',
      caseId: 'case-4',
      clientId: 'client-4',
      betreff: 'Barleistung',
      rechnungsdatum: '2026-02-20',
      positionen: [
        {
          bezeichnung: 'Leistung',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 100,
        },
      ],
    });

    await rechnungService.sendRechnung(invoice.id);
    await rechnungService.recordPayment(invoice.id, {
      method: 'cash',
      amount: 119,
      paidAt: '2026-02-21T08:00:00.000Z',
    });

    const signature = orchestration.fiscalSignatures$.value[0];
    orchestration.fiscalSignatures$.next([
      {
        ...signature,
        id: 'fiscal:base',
        signedAt: '2026-02-21T09:00:00.000Z',
      },
      {
        ...signature,
        id: 'fiscal:broken',
        previousHash: 'BROKEN-PREV-HASH',
        chainHash: 'BROKEN-CHAIN-HASH',
        signedAt: '2026-02-21T10:00:00.000Z',
      },
    ]);

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'AT',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-4',
            workspaceId: 'ws-4',
            name: 'Kanzlei Beispiel',
            steuernummer: 'ATU123',
            bmdFirmennummer: 'AT-1001',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    const closure = await exportService.generateDailyClosureReport({
      workspaceId: 'ws-4',
      closureDate: '2026-02-21',
    });

    expect(closure.belegCount).toBeGreaterThan(0);
    expect(closure.chainConsistent).toBe(false);
  });

  test('daily closure reports inconsistent chain when beleg references missing signature hash', async () => {
    const orchestration = createOrchestrationMock();
    const timeTracking = createTimeTrackingMock();
    const rechnungService = new RechnungService(orchestration as never, timeTracking as never);

    const invoice = await rechnungService.createRechnung({
      workspaceId: 'ws-6',
      matterId: 'matter-6',
      caseId: 'case-6',
      clientId: 'client-6',
      betreff: 'Barleistung 2',
      rechnungsdatum: '2026-02-20',
      positionen: [
        {
          bezeichnung: 'Leistung',
          anzahl: 1,
          einheit: 'stunde',
          einzelpreis: 100,
        },
      ],
    });

    await rechnungService.sendRechnung(invoice.id);
    await rechnungService.recordPayment(invoice.id, {
      method: 'cash',
      amount: 119,
      paidAt: '2026-02-21T08:00:00.000Z',
    });

    const beleg = orchestration.kassenbelege$.value[0];
    orchestration.kassenbelege$.next([
      {
        ...beleg,
        fiscalSignatureHash: 'UNKNOWN-HASH',
      },
    ]);

    const exportService = new DATEVExportService(
      orchestration as never,
      rechnungService,
      timeTracking as never,
      {
        getActiveJurisdiction: () => 'AT',
        graph$: { value: { clients: {}, matters: {} } },
        getClientsForMatter: () => [],
      } as never,
      {
        async getKanzleiProfile() {
          return {
            id: 'kanzlei-6',
            workspaceId: 'ws-6',
            name: 'Kanzlei Beispiel',
            steuernummer: 'ATU123',
            bmdFirmennummer: 'AT-1001',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
        },
      } as never
    );

    const closure = await exportService.generateDailyClosureReport({
      workspaceId: 'ws-6',
      closureDate: '2026-02-21',
    });

    expect(closure.belegCount).toBeGreaterThan(0);
    expect(closure.chainConsistent).toBe(false);
  });
});
