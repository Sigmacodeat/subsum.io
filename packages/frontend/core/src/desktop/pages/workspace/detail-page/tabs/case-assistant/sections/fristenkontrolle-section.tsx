import { useService } from '@toeverything/infra';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { useCallback, useMemo, useState } from 'react';

import {
  FristenkontrolleService,
  FRISTENKONTROLLE_STATUS_LABELS,
} from '@affine/core/modules/case-assistant';
import type { FristenKontrolleRecord } from '@affine/core/modules/case-assistant/services/fristenkontrolle';
import * as localStyles from './fristenkontrolle-section.css';

/* ═══════════════════════════════════════════════════════════════════════════
   FristenkontrolleSection — 4-Augen-Prinzip für Fristenüberwachung
   ═══════════════════════════════════════════════════════════════════════════ */

interface FristenkontrolleSectionProps {
  currentUserId: string;
  currentUserName: string;
  matterId?: string;
}

type TabId = 'pending' | 'completed' | 'dashboard';

export function FristenkontrolleSection({
  currentUserId,
  currentUserName,
  matterId,
}: FristenkontrolleSectionProps) {
  const fkService = useService(FristenkontrolleService);
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const pendingFirst = useMemo(
    () => fkService.getPendingFirstCheck().filter(k => !matterId || k.matterId === matterId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fkService, matterId, refreshKey]
  );

  const pendingSecond = useMemo(
    () => fkService.getPendingSecondCheck().filter(k => !matterId || k.matterId === matterId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fkService, matterId, refreshKey]
  );

  const pendingAll = useMemo(
    () => [...pendingFirst, ...pendingSecond].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    ),
    [pendingFirst, pendingSecond]
  );

  const completedAll = useMemo(
    () => [
      ...fkService.getApproved(),
      ...Object.values((fkService as any).kontrollenMap$?.value ?? {}).filter(
        (k: any) => k.status === 'rejected'
      ) as FristenKontrolleRecord[],
    ]
      .filter(k => !matterId || k.matterId === matterId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fkService, matterId, refreshKey]
  );

  const stats = useMemo(
    () => fkService.getDashboardStats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fkService, refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const handleFirstCheck = useCallback(
    async (kontrolleId: string) => {
      try {
        await fkService.performFirstCheck(
          kontrolleId,
          currentUserId,
          currentUserName,
          noteMap[kontrolleId] || undefined
        );
        setNoteMap(prev => { const n = { ...prev }; delete n[kontrolleId]; return n; });
        refresh();
      } catch (e: any) {
        alert(e.message);
      }
    },
    [fkService, currentUserId, currentUserName, noteMap, refresh]
  );

  const handleSecondCheck = useCallback(
    async (kontrolleId: string, approved: boolean) => {
      try {
        await fkService.performSecondCheck(
          kontrolleId,
          currentUserId,
          currentUserName,
          approved,
          noteMap[kontrolleId] || undefined
        );
        setNoteMap(prev => { const n = { ...prev }; delete n[kontrolleId]; return n; });
        refresh();
      } catch (e: any) {
        alert(e.message);
      }
    },
    [fkService, currentUserId, currentUserName, noteMap, refresh]
  );

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'pending', label: 'Offene Prüfungen', count: pendingAll.length },
    { id: 'completed', label: 'Abgeschlossen', count: completedAll.length },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          Fristenkontrolle (4-Augen-Prinzip)
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Jede Frist muss von zwei verschiedenen Personen geprüft werden (§ 85 Abs. 2 ZPO)
        </p>
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

      {/* ─── Pending Tab ─── */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingAll.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Keine offenen Fristenprüfungen</p>
              <p className="text-sm mt-1">Alle Fristen wurden geprüft</p>
            </div>
          ) : (
            pendingAll.map(check => (
              <div
                key={check.id}
                className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-900">{check.deadlineTitle}</div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      Fällig: {new Date(check.dueAt).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    check.status === 'pending_first_check'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {FRISTENKONTROLLE_STATUS_LABELS[check.status] ?? check.status}
                  </span>
                </div>

                {check.firstCheckerName && (
                  <div className="text-xs text-slate-400 mb-2">
                    1. Prüfung: {check.firstCheckerName} am{' '}
                    {check.firstCheckedAt ? new Date(check.firstCheckedAt).toLocaleDateString('de-DE') : '–'}
                  </div>
                )}

                {/* First check: any user can do it */}
                {check.status === 'pending_first_check' && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={noteMap[check.id] ?? ''}
                      onChange={e => setNoteMap(prev => ({ ...prev, [check.id]: e.target.value }))}
                      placeholder="Anmerkung zur Prüfung (optional)..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      rows={2}
                    />
                    <button
                      onClick={() => handleFirstCheck(check.id)}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Erste Prüfung durchführen
                    </button>
                  </div>
                )}

                {/* Second check: must be different person */}
                {(check.status === 'pending_second_check' || check.status === 'first_check_done') && (
                  check.firstCheckerId === currentUserId ? (
                    <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      Sie haben die 1. Prüfung durchgeführt — die 2. Prüfung muss von einer anderen Person erfolgen (4-Augen-Prinzip).
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={noteMap[check.id] ?? ''}
                        onChange={e => setNoteMap(prev => ({ ...prev, [check.id]: e.target.value }))}
                        placeholder="Anmerkung zur zweiten Prüfung (optional)..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSecondCheck(check.id, true)}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Freigeben
                        </button>
                        <button
                          onClick={() => handleSecondCheck(check.id, false)}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Ablehnen
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Completed Tab ─── */}
      {activeTab === 'completed' && (
        <div className="space-y-2">
          {completedAll.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Noch keine abgeschlossenen Prüfungen</p>
            </div>
          ) : (
            completedAll.map(check => (
              <div key={check.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{check.deadlineTitle}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {check.firstCheckerName} → {check.secondCheckerName}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    check.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {check.status === 'approved' ? 'Freigegeben' : 'Abgelehnt'}
                  </span>
                </div>
                {check.rejectionReason && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                    Grund: {check.rejectionReason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Dashboard Tab ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Gesamt', value: stats.total, color: 'text-slate-900' },
              { label: 'Offen', value: stats.pendingFirstCheck + stats.pendingSecondCheck, color: 'text-amber-600' },
              { label: 'Freigegeben', value: stats.approved, color: 'text-green-600' },
              { label: 'Abgelehnt', value: stats.rejected, color: 'text-red-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Freigabequote</span>
              <span className="text-lg font-bold text-slate-900">{stats.approvalRate}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-green-500 rounded-full transition-all duration-500 ${localStyles.approvalFill}`}
                style={assignInlineVars({ [localStyles.widthVar]: `${stats.approvalRate}%` })}
              />
            </div>
          </div>

          {stats.escalated > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-medium text-red-700">
                {stats.escalated} eskalierte Fristenprüfung(en)
              </div>
              <p className="text-sm text-red-600 mt-1">
                Diese Fristen wurden nicht rechtzeitig geprüft und erfordern sofortige Aufmerksamkeit.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
