import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DATEVExportService,
  KanzleiProfileService,
  RechnungService,
  RECHNUNG_STATUS_LABELS,
  AUSLAGE_KATEGORIE_LABELS,
} from '@affine/core/modules/case-assistant';
import type {
  KanzleiProfile,
  RechnungRecord,
  AuslageRecord,
  KassenbelegRecord,
} from '@affine/core/modules/case-assistant';

/* ═══════════════════════════════════════════════════════════════════════════
   RechnungSection — Rechnungen, Auslagen & AktenFinanzSummary
   ═══════════════════════════════════════════════════════════════════════════ */

interface RechnungSectionProps {
  workspaceId: string;
  matterId: string;
  caseId: string;
  clientId: string;
}

type TabId = 'rechnungen' | 'auslagen' | 'kassenbelege' | 'finanzen';

const statusColor: Record<string, string> = {
  entwurf: 'bg-slate-100 text-slate-600',
  versendet: 'bg-blue-100 text-blue-700',
  bezahlt: 'bg-green-100 text-green-700',
  teilbezahlt: 'bg-amber-100 text-amber-700',
  storniert: 'bg-slate-200 text-slate-500 line-through',
  mahnung_1: 'bg-orange-100 text-orange-700',
  mahnung_2: 'bg-red-100 text-red-600',
  inkasso: 'bg-red-200 text-red-800',
};

function currency(val: number): string {
  return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function RechnungSection({
  workspaceId,
  matterId,
  caseId,
  clientId,
}: RechnungSectionProps) {
  const rechnungService = useService(RechnungService);
  const datevExportService = useService(DATEVExportService);
  const kanzleiProfileService = useService(KanzleiProfileService);
  const [activeTab, setActiveTab] = useState<TabId>('rechnungen');
  const [refreshKey, setRefreshKey] = useState(0);
  const [kanzleiProfile, setKanzleiProfile] = useState<KanzleiProfile | null>(null);
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let disposed = false;
    void kanzleiProfileService.getKanzleiProfile().then(profile => {
      if (!disposed) {
        setKanzleiProfile(profile);
      }
    });
    return () => {
      disposed = true;
    };
  }, [kanzleiProfileService, refreshKey]);

  const rechnungen = useMemo(
    () => rechnungService.getRechnungenForMatter(matterId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rechnungService, matterId, refreshKey]
  );

  const kassenbelege = useMemo(
    () => rechnungService.getKassenbelegeForMatter(matterId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rechnungService, matterId, refreshKey]
  );

  const auslagen = useMemo(
    () => rechnungService.getAuslagenForMatter(matterId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rechnungService, matterId, refreshKey]
  );

  const summary = useMemo(
    () => rechnungService.getAktenFinanzSummary(matterId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rechnungService, matterId, refreshKey]
  );

  const kpis = useMemo(
    () => rechnungService.getKanzleiFinanzKPIs(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rechnungService, refreshKey]
  );

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleCreateFromTime = useCallback(async () => {
    try {
      await rechnungService.createRechnungFromTimeEntries({
        workspaceId, matterId, caseId, clientId,
        betreff: `Honorar — Akte ${matterId}`,
      });
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [rechnungService, workspaceId, matterId, caseId, clientId, refresh]);

  const handleSend = useCallback(async (id: string) => {
    await rechnungService.sendRechnung(id);
    refresh();
  }, [rechnungService, refresh]);

  const handleMarkPaid = useCallback(async (id: string) => {
    const r = rechnungen.find(x => x.id === id);
    if (!r) return;
    const remaining = Math.max(0, r.brutto - (r.bezahlterBetrag ?? 0));
    await rechnungService.recordPayment(id, {
      amount: remaining || r.brutto,
      method: 'bank_transfer',
    });
    refresh();
  }, [rechnungService, rechnungen, refresh]);

  const handleMarkCashPaid = useCallback(async (id: string) => {
    const r = rechnungen.find(x => x.id === id);
    if (!r) return;
    const remaining = Math.max(0, r.brutto - (r.bezahlterBetrag ?? 0));
    await rechnungService.recordPayment(id, {
      amount: remaining || r.brutto,
      method: 'cash',
    });
    refresh();
  }, [rechnungService, rechnungen, refresh]);

  const handleMahnung = useCallback(async (id: string) => {
    try {
      await rechnungService.createMahnung(id, 5);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [rechnungService, refresh]);

  const handleStorno = useCallback(async (id: string) => {
    if (!confirm('Rechnung wirklich stornieren? Zeiteinträge werden zurückgebucht.')) return;
    await rechnungService.stornieren(id);
    refresh();
  }, [rechnungService, refresh]);

  const triggerExportDownload = useCallback((fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const triggerReportDownload = useCallback((fileName: string, html: string) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const openPrintPreview = useCallback((html: string) => {
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }, []);

  const handleOneClickExport = useCallback(async () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      const result = await datevExportService.runOneClickAccountingExport({
        workspaceId,
        matterId,
        vonDatum: exportFrom,
        bisDatum: exportTo,
        exportedBy: 'case-assistant-panel',
        exportedByName: 'Case Assistant',
      });

      if (!result.run.content || !result.run.fileName) {
        setExportStatus('One-Click Export konnte keine Buchhaltungsdatei erzeugen.');
        return;
      }

      triggerExportDownload(result.run.fileName, result.run.content);
      triggerReportDownload(result.reportFileName, result.reportHtml);
      openPrintPreview(result.reportHtml);

      const warningText =
        result.compliance.warnings.length > 0
          ? ` · Hinweise: ${result.compliance.warnings.join(' | ')}`
          : '';

      setExportStatus(
        `One-Click Export (${result.jurisdiction}/${result.provider.toUpperCase()}) bereit: ${result.run.fileName} + ${result.reportFileName}${warningText}`
      );
    } catch (error) {
      setExportStatus(
        error instanceof Error
          ? `One-Click Export fehlgeschlagen: ${error.message}`
          : 'One-Click Export fehlgeschlagen.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [
    datevExportService,
    exportFrom,
    exportTo,
    matterId,
    openPrintPreview,
    triggerExportDownload,
    triggerReportDownload,
    workspaceId,
  ]);

  const handleDailyClosure = useCallback(async () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      const result = await datevExportService.generateDailyClosureReport({
        workspaceId,
        matterId,
        closureDate: exportTo,
      });

      triggerReportDownload(result.reportFileName, result.reportHtml);
      openPrintPreview(result.reportHtml);

      setExportStatus(
        `Kassenabschluss ${result.closureDate}: ${result.belegCount} Belege · Chain ${result.chainConsistent ? 'OK' : 'FEHLER'}`
      );
    } catch (error) {
      setExportStatus(
        error instanceof Error
          ? `Kassenabschluss fehlgeschlagen: ${error.message}`
          : 'Kassenabschluss fehlgeschlagen.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [
    datevExportService,
    exportTo,
    matterId,
    openPrintPreview,
    triggerReportDownload,
    workspaceId,
  ]);

  const handleExport = useCallback(
    async (provider: 'datev' | 'bmd') => {
      setIsExporting(true);
      setExportStatus(null);
      try {
        const datevBeraternummer = kanzleiProfile?.datevBeraternummer?.trim() ?? '';
        const datevMandantennummer = kanzleiProfile?.datevMandantennummer?.trim() ?? '';
        const bmdFirmennummer = kanzleiProfile?.bmdFirmennummer?.trim() ?? '';

        if (provider === 'datev' && (!datevBeraternummer || !datevMandantennummer)) {
          setExportStatus(
            `DATEV Export blockiert: Beraternummer ${datevBeraternummer ? 'ok' : 'fehlt'}, Mandantennummer ${datevMandantennummer ? 'ok' : 'fehlt'}.`
          );
          return;
        }

        if (provider === 'bmd' && !bmdFirmennummer) {
          setExportStatus('BMD Export blockiert: Firmennummer fehlt.');
          return;
        }

        const existing = datevExportService.getConfigForProvider(workspaceId, provider);
        const config = existing
          ? await datevExportService.updateConfig(existing.id, {
              beraternummer: provider === 'datev' ? datevBeraternummer : existing.beraternummer,
              mandantennummer: provider === 'datev' ? datevMandantennummer : existing.mandantennummer,
              bmdFirmennummer: provider === 'bmd' ? bmdFirmennummer : existing.bmdFirmennummer,
            })
          : await datevExportService.createConfig({
              workspaceId,
              provider,
              format: provider === 'datev' ? 'datev_ascii' : 'bmd_csv',
              beraternummer: provider === 'datev' ? datevBeraternummer : undefined,
              mandantennummer: provider === 'datev' ? datevMandantennummer : undefined,
              bmdFirmennummer: provider === 'bmd' ? bmdFirmennummer : undefined,
            });

        if (!config) {
          setExportStatus('Export-Konfiguration konnte nicht aktualisiert werden.');
          return;
        }

        const run = await datevExportService.runExport({
          workspaceId,
          configId: config.id,
          scope: 'alles',
          vonDatum: exportFrom,
          bisDatum: exportTo,
          matterId,
          exportedBy: 'case-assistant-panel',
          exportedByName: 'Case Assistant',
        });

        if (run.status !== 'ready' || !run.content || !run.fileName) {
          setExportStatus('Export wurde gestartet, aber noch nicht fertiggestellt.');
          return;
        }

        triggerExportDownload(run.fileName, run.content);
        setExportStatus(
          `${provider.toUpperCase()}-Export bereit: ${run.fileName} (${run.recordCount} Buchungen)`
        );
      } catch (error) {
        setExportStatus(
          error instanceof Error
            ? `Export fehlgeschlagen: ${error.message}`
            : 'Export fehlgeschlagen.'
        );
      } finally {
        setIsExporting(false);
      }
    },
    [
      datevExportService,
      exportFrom,
      exportTo,
      kanzleiProfile,
      matterId,
      triggerExportDownload,
      workspaceId,
    ]
  );

  const datevBeraternummer = kanzleiProfile?.datevBeraternummer?.trim() ?? '';
  const datevMandantennummer = kanzleiProfile?.datevMandantennummer?.trim() ?? '';
  const bmdFirmennummer = kanzleiProfile?.bmdFirmennummer?.trim() ?? '';
  const isDatevReady = Boolean(datevBeraternummer && datevMandantennummer);
  const isBmdReady = Boolean(bmdFirmennummer);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'rechnungen', label: 'Rechnungen', count: rechnungen.length },
    { id: 'auslagen', label: 'Auslagen', count: auslagen.length },
    { id: 'kassenbelege', label: 'Kassenbelege', count: kassenbelege.length },
    { id: 'finanzen', label: 'Finanz-Übersicht' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Rechnungen & Finanzen
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Rechnungen, Auslagen und Akten-Finanzsummary
          </p>
        </div>
        {activeTab === 'rechnungen' && (
          <button
            onClick={handleCreateFromTime}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Aus Zeiteinträgen
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Rechnungen Tab ─── */}
      {activeTab === 'rechnungen' && (
        <div className="space-y-3">
          {rechnungen.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Noch keine Rechnungen</p>
              <p className="text-sm mt-1">Erstellen Sie eine Rechnung aus Zeiteinträgen</p>
            </div>
          ) : (
            rechnungen.map((r: RechnungRecord) => (
              <div key={r.id} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-slate-900">{r.rechnungsnummer}</div>
                    <div className="text-sm text-slate-500">{r.betreff}</div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColor[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {RECHNUNG_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-slate-400">Netto:</span>{' '}
                    <span className="font-medium">{currency(r.netto)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">USt {r.ustProzent}%:</span>{' '}
                    <span className="font-medium">{currency(r.ustBetrag)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Brutto:</span>{' '}
                    <span className="font-bold text-slate-900">{currency(r.brutto)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <span>Datum: {r.rechnungsdatum}</span>
                  <span>·</span>
                  <span>Fällig: {r.faelligkeitsdatum}</span>
                  {r.bezahltAm && (
                    <>
                      <span>·</span>
                      <span className="text-green-600">Bezahlt: {r.bezahltAm.split('T')[0]}</span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {r.status === 'entwurf' && (
                    <button onClick={() => handleSend(r.id)} className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                      Versenden
                    </button>
                  )}
                  {(r.status === 'versendet' || r.status === 'teilbezahlt' || r.status === 'mahnung_1' || r.status === 'mahnung_2') && (
                    <>
                      <button onClick={() => handleMarkPaid(r.id)} className="px-3 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                        Zahlung buchen (Überweisung)
                      </button>
                      <button onClick={() => handleMarkCashPaid(r.id)} className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
                        Barzahlung + Kassenbeleg
                      </button>
                      <button onClick={() => handleMahnung(r.id)} className="px-3 py-1 text-xs font-medium bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors">
                        Mahnung senden
                      </button>
                    </>
                  )}
                  {r.status !== 'bezahlt' && r.status !== 'storniert' && (
                    <button onClick={() => handleStorno(r.id)} className="px-3 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                      Stornieren
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Auslagen Tab ─── */}
      {activeTab === 'auslagen' && (
        <div className="space-y-3">
          {auslagen.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Noch keine Auslagen erfasst</p>
            </div>
          ) : (
            auslagen.map((a: AuslageRecord) => (
              <div key={a.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{a.bezeichnung}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {AUSLAGE_KATEGORIE_LABELS[a.kategorie] ?? a.kategorie} · {a.datum}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{currency(a.betrag)}</div>
                    {a.weiterberechnet ? (
                      <span className="text-xs text-green-600">Weiterberechnet</span>
                    ) : (
                      <span className="text-xs text-amber-600">Offen</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Kassenbelege Tab ─── */}
      {activeTab === 'kassenbelege' && (
        <div className="space-y-3">
          {kassenbelege.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Noch keine Kassenbelege</p>
              <p className="text-sm mt-1">
                Bei Barzahlungen werden automatisch Kassenbelege erstellt.
              </p>
            </div>
          ) : (
            kassenbelege.map((b: KassenbelegRecord) => (
              <div key={b.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{b.belegnummer}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Rechnung: {b.rechnungId} · Datum: {b.buchungsdatum.split('T')[0]}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">
                      {currency(b.zahlungsbetrag)}
                    </div>
                    <div className="text-xs text-slate-500">
                      USt: {b.ustProzent}% ({currency(b.ustBetrag)})
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Leistung: {b.leistungsbeschreibung}
                </div>
                {b.storniert ? (
                  <div className="mt-2 text-xs text-red-600">
                    Storniert {b.storniertAm ? `am ${b.storniertAm.split('T')[0]}` : ''}
                    {b.stornoGrund ? ` · ${b.stornoGrund}` : ''}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Finanz-Übersicht Tab ─── */}
      {activeTab === 'finanzen' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
            <div className="mb-2 text-xs text-slate-600">
              DATEV Beraternr.: <strong>{datevBeraternummer || 'fehlt'}</strong>
              {' · '}
              DATEV Mandantennr.: <strong>{datevMandantennummer || 'fehlt'}</strong>
              {' · '}
              BMD Firmennr.: <strong>{bmdFirmennummer || 'fehlt'}</strong>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">
                Von
                <input
                  type="date"
                  value={exportFrom}
                  onChange={e => setExportFrom(e.currentTarget.value)}
                  className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                Bis
                <input
                  type="date"
                  value={exportTo}
                  onChange={e => setExportTo(e.currentTarget.value)}
                  className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                />
              </label>
              <button
                onClick={() => void handleExport('datev')}
                disabled={isExporting || !exportFrom || !exportTo || !isDatevReady}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                title={isDatevReady ? 'DATEV Export starten' : 'DATEV Export nicht möglich: Pflichtfelder fehlen'}
              >
                {isDatevReady ? 'DATEV Export' : 'DATEV Export (fehlt)'}
              </button>
              <button
                onClick={() => void handleExport('bmd')}
                disabled={isExporting || !exportFrom || !exportTo || !isBmdReady}
                className="px-3 py-1.5 text-sm font-medium text-slate-800 bg-slate-200 rounded-lg hover:bg-slate-300 disabled:opacity-60"
                title={isBmdReady ? 'BMD Export starten' : 'BMD Export nicht möglich: Firmennummer fehlt'}
              >
                {isBmdReady ? 'BMD Export' : 'BMD Export (fehlt)'}
              </button>
              <button
                onClick={() => void handleOneClickExport()}
                disabled={isExporting || !exportFrom || !exportTo}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                title="One-Click: landspezifischer Buchhaltungsexport + vorformatierter PDF-Report"
              >
                One-Click Buchhaltung + PDF
              </button>
              <button
                onClick={() => void handleDailyClosure()}
                disabled={isExporting || !exportTo}
                className="px-3 py-1.5 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-60"
                title="Tagesabschluss mit Kassenbericht und Fiskal-Chain-Check"
              >
                Daily Closure
              </button>
            </div>
            {exportStatus ? (
              <p className="mt-2 text-xs text-slate-600" role="status" aria-live="polite">
                {exportStatus}
              </p>
            ) : null}
          </div>

          {/* Akten-Summary */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Akten-Finanzsummary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Zeitwert', value: currency(summary.totalZeitWert), sub: `${Math.round(summary.totalZeitMinuten / 60)}h`, color: 'text-slate-900' },
                { label: 'Auslagen', value: currency(summary.totalAuslagen), color: 'text-slate-900' },
                { label: 'Offene Posten', value: currency(summary.offenePosten), color: summary.offenePosten > 0 ? 'text-amber-600' : 'text-green-600' },
                { label: 'Marge', value: currency(summary.marge), color: summary.marge >= 0 ? 'text-green-600' : 'text-red-600' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                  {'sub' in kpi && kpi.sub && (
                    <div className="text-xs text-slate-400">{kpi.sub}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Kanzlei-KPIs */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Kanzlei-Finanzen (gesamt)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Offene Posten', value: currency(kpis.totalOffenePosten), color: 'text-amber-600' },
                { label: 'Überfällig', value: currency(kpis.totalUeberfaellig), color: kpis.totalUeberfaellig > 0 ? 'text-red-600' : 'text-green-600' },
                { label: 'Umsatz (Monat)', value: currency(kpis.totalUmsatzMonat), color: 'text-green-600' },
                { label: 'Auslagen (Monat)', value: currency(kpis.totalAuslagenMonat), color: 'text-slate-600' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
          </div>

          {kpis.rechnungenUeberfaellig > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-medium text-red-700">
                {kpis.rechnungenUeberfaellig} überfällige Rechnung(en)
              </div>
              <p className="text-sm text-red-600 mt-1">
                Diese Rechnungen haben das Zahlungsziel überschritten. Erwägen Sie eine Mahnung.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
