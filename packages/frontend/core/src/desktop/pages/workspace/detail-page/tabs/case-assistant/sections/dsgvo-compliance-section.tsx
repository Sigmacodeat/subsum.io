import { useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

import {
  DSGVOComplianceService,
  DSGVO_REQUEST_TYPE_LABELS,
  DSGVO_STATUS_LABELS,
} from '@affine/core/modules/case-assistant';
import type { DSGVORequest } from '@affine/core/modules/case-assistant/services/dsgvo-compliance';

/* ═══════════════════════════════════════════════════════════════════════════
   DSGVOComplianceSection — DSGVO Art. 15-21 Requests + Aufbewahrungsfristen
   ═══════════════════════════════════════════════════════════════════════════ */

interface DSGVOComplianceSectionProps {
  currentUserName: string;
}

type TabId = 'requests' | 'retention' | 'dashboard';

const statusColor: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  escalated: 'bg-purple-100 text-purple-700',
};

export function DSGVOComplianceSection({
  currentUserName,
}: DSGVOComplianceSectionProps) {
  const dsgvoService = useService(DSGVOComplianceService);
  const [activeTab, setActiveTab] = useState<TabId>('requests');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const openRequests = useMemo(
    () => dsgvoService.getOpenRequests(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dsgvoService, refreshKey]
  );

  const overdueRequests = useMemo(
    () => dsgvoService.getOverdueRequests(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dsgvoService, refreshKey]
  );

  const expiredRetentions = useMemo(
    () => dsgvoService.getExpiredRetentions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dsgvoService, refreshKey]
  );

  const expiringSoon = useMemo(
    () => dsgvoService.getRetentionsExpiringSoon(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dsgvoService, refreshKey]
  );

  const stats = useMemo(
    () => dsgvoService.getDashboardStats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dsgvoService, refreshKey]
  );

  const handleComplete = useCallback(async (id: string) => {
    try {
      await dsgvoService.completeRequest(id, currentUserName);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [dsgvoService, currentUserName, refresh]);

  const handleReject = useCallback(async (id: string) => {
    const reason = prompt('Ablehnungsgrund:');
    if (!reason) return;
    try {
      await dsgvoService.rejectRequest(id, reason, currentUserName);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [dsgvoService, currentUserName, refresh]);

  const handleAddAction = useCallback(async (id: string) => {
    const action = prompt('Durchgeführte Aktion:');
    if (!action) return;
    try {
      await dsgvoService.addAction(id, action, currentUserName);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [dsgvoService, currentUserName, refresh]);

  function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (86400000));
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'requests', label: 'DSGVO-Anfragen', count: openRequests.length },
    { id: 'retention', label: 'Aufbewahrung', count: expiredRetentions.length + expiringSoon.length },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          DSGVO Compliance
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Betroffenenanfragen (Art. 15-21 DSGVO) und Aufbewahrungsfristen
        </p>
      </div>

      {/* Urgency Banner */}
      {overdueRequests.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
                    <div>
            <div className="font-semibold text-red-700">
              {overdueRequests.length} überfällige DSGVO-Anfrage(n)!
            </div>
            <p className="text-sm text-red-600">
              Die 30-Tage-Frist ist abgelaufen. Sofortige Bearbeitung erforderlich.
            </p>
          </div>
        </div>
      )}

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
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Requests Tab ─── */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {openRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Keine offenen DSGVO-Anfragen</p>
            </div>
          ) : (
            openRequests.map((req: DSGVORequest) => {
              const isExpanded = expandedId === req.id;
              const days = daysUntil(req.responseDeadline);
              const isOverdue = days < 0;
              return (
                <div key={req.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {DSGVO_REQUEST_TYPE_LABELS[req.type]}
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        {req.requestorName} · {req.requestorEmail}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        isOverdue ? 'bg-red-100 text-red-700' : days <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isOverdue ? `${Math.abs(days)}d überfällig` : `${days}d verbleibend`}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[req.status] ?? ''}`}>
                        {DSGVO_STATUS_LABELS[req.status]}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                      <p className="text-sm text-slate-700">{req.description}</p>

                      {/* Action log */}
                      {req.actions.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Verlauf</h5>
                          <div className="space-y-1">
                            {req.actions.map((a, i) => (
                              <div key={i} className="text-xs text-slate-500 flex gap-2">
                                <span className="text-slate-400 shrink-0">
                                  {new Date(a.performedAt).toLocaleDateString('de-DE')}
                                </span>
                                <span className="text-slate-700">{a.action}</span>
                                <span className="text-slate-400">({a.performedBy})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {req.status !== 'completed' && req.status !== 'rejected' && (
                        <div className="flex gap-2 flex-wrap pt-1">
                          <button
                            onClick={() => handleAddAction(req.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            + Aktion hinzufügen
                          </button>
                          <button
                            onClick={() => handleComplete(req.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            Abschließen
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            Ablehnen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Retention Tab ─── */}
      {activeTab === 'retention' && (
        <div className="space-y-4">
          {expiredRetentions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2">
                Aufbewahrungsfrist abgelaufen ({expiredRetentions.length})
              </h4>
              <div className="space-y-2">
                {expiredRetentions.map((r: any) => (
                  <div key={r.id} className="border border-red-200 bg-red-50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{r.entityName}</div>
                      <div className="text-xs text-red-600">
                        Abgelaufen: {new Date(r.retentionEndDate).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      r.reviewedForDeletion ? (r.deletionApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') : 'bg-red-100 text-red-700'
                    }`}>
                      {r.reviewedForDeletion ? (r.deletionApproved ? 'Löschung genehmigt' : 'Aufbewahrt') : 'Prüfung ausstehend'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiringSoon.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-amber-700 mb-2">
                Bald ablaufend ({expiringSoon.length})
              </h4>
              <div className="space-y-2">
                {expiringSoon.map((r: any) => (
                  <div key={r.id} className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{r.entityName}</div>
                      <div className="text-xs text-amber-600">
                        Läuft ab: {new Date(r.retentionEndDate).toLocaleDateString('de-DE')} ({daysUntil(r.retentionEndDate)} Tage)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiredRetentions.length === 0 && expiringSoon.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Keine kritischen Aufbewahrungsfristen</p>
              <p className="text-sm mt-1">Alle Fristen sind im grünen Bereich</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Dashboard Tab ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Offene Anfragen', value: stats.openRequests, color: stats.openRequests > 0 ? 'text-amber-600' : 'text-green-600' },
              { label: 'Überfällig', value: stats.overdueRequests, color: stats.overdueRequests > 0 ? 'text-red-600' : 'text-green-600' },
              { label: 'Abgelaufene Fristen', value: stats.expiredRetentions, color: stats.expiredRetentions > 0 ? 'text-red-600' : 'text-green-600' },
              { label: 'Bald ablaufend', value: stats.expiringSoon, color: stats.expiringSoon > 0 ? 'text-amber-600' : 'text-slate-600' },
              { label: 'Löschung ausstehend', value: stats.pendingDeletion, color: 'text-slate-600' },
              { label: 'Retention Records', value: stats.totalRetentionRecords, color: 'text-slate-900' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
