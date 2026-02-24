import { useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

import {
  GwGComplianceService,
  GWG_STATUS_LABELS,
  GWG_RISK_LABELS,
  GWG_IDENT_METHOD_LABELS,
} from '@affine/core/modules/case-assistant';
import type {
  GwGOnboardingRecord,
  GwGCheckRecord,
} from '@affine/core/modules/case-assistant/services/gwg-compliance';

/* ═══════════════════════════════════════════════════════════════════════════
   GwGComplianceSection — GwG/KYC Mandanten-Onboarding (§ 2 Abs. 1 Nr. 7 GwG)
   ═══════════════════════════════════════════════════════════════════════════ */

interface GwGComplianceSectionProps {
  currentUserId: string;
  currentUserName: string;
}

type TabId = 'pending' | 'all' | 'dashboard';

const riskColor: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  very_high: 'bg-red-100 text-red-700',
};

const statusColor: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  identification_required: 'bg-amber-100 text-amber-700',
  pep_check_required: 'bg-amber-100 text-amber-700',
  risk_assessment_required: 'bg-blue-100 text-blue-700',
  review_required: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-slate-200 text-slate-500',
};

const checkStatusIcon: Record<string, string> = {
  pending: '–',
  passed: 'OK',
  failed: 'Fehler',
  inconclusive: 'Unklar',
};

export function GwGComplianceSection({
  currentUserName,
}: Omit<GwGComplianceSectionProps, 'currentUserId'>) {
  const gwgService = useService(GwGComplianceService);
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const pendingOnboardings = useMemo(
    () => gwgService.getPendingOnboardings(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwgService, refreshKey]
  );

  const allOnboardings = useMemo(
    () => Object.values((gwgService as any).onboardingMap$?.value ?? {}) as GwGOnboardingRecord[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwgService, refreshKey]
  );

  const stats = useMemo(
    () => gwgService.getDashboardStats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwgService, refreshKey]
  );

  const handleRiskAssessment = useCallback(async (id: string) => {
    try {
      await gwgService.performRiskAssessment(id, currentUserName);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [gwgService, currentUserName, refresh]);

  const handleDecide = useCallback(async (id: string, approved: boolean) => {
    try {
      await gwgService.decide(id, approved, currentUserName);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [gwgService, currentUserName, refresh]);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'pending', label: 'Offene Prüfungen', count: pendingOnboardings.length },
    { id: 'all', label: 'Alle Mandanten', count: allOnboardings.length },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  function renderOnboardingCard(record: GwGOnboardingRecord) {
    const isExpanded = expandedId === record.id;
    return (
      <div
        key={record.id}
        className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors"
      >
        {/* Header */}
        <button
          onClick={() => setExpandedId(isExpanded ? null : record.id)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div>
            <div className="font-semibold text-slate-900">{record.clientName}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {record.clientKind === 'company' ? 'Unternehmen' : 'Natürliche Person'}
              {record.isPEP && <span className="ml-2 text-amber-600 font-medium">PEP</span>}
              {record.isSanctioned && <span className="ml-2 text-red-600 font-medium">SANKTIONIERT</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${riskColor[record.riskLevel] ?? ''}`}>
              {GWG_RISK_LABELS[record.riskLevel]}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[record.status] ?? ''}`}>
              {GWG_STATUS_LABELS[record.status]}
            </span>
            <span className="text-slate-400 text-sm">{isExpanded ? 'Schließen' : 'Öffnen'}</span>
          </div>
        </button>

        {/* Expanded details */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
            {/* Checks grid */}
            <div>
              <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Prüfschritte</h5>
              <div className="grid grid-cols-2 gap-2">
                {record.checks.map((check: GwGCheckRecord) => (
                  <div key={check.id} className="flex items-center gap-2 text-sm">
                    <span>{checkStatusIcon[check.status] ?? '–'}</span>
                    <span className="text-slate-700">
                      {check.type === 'identity_verification' && 'Identifizierung'}
                      {check.type === 'pep_check' && 'PEP-Prüfung'}
                      {check.type === 'sanctions_check' && 'Sanktionsprüfung'}
                      {check.type === 'risk_assessment' && 'Risikobewertung'}
                      {check.type === 'beneficial_owner' && 'Wirtsch. Berechtigte'}
                      {check.type === 'source_of_funds' && 'Mittelherkunft'}
                      {check.type === 'ongoing_monitoring' && 'Laufende Überwachung'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Identification */}
            {record.identification && (
              <div className="bg-slate-50 rounded-lg p-3">
                <h5 className="text-xs font-semibold text-slate-500 mb-1">Identifizierung</h5>
                <div className="text-sm text-slate-700">
                  {GWG_IDENT_METHOD_LABELS[record.identification.method]}
                  {record.identification.documentNumber && ` · ${record.identification.documentNumber}`}
                  {record.identification.nationality && ` · ${record.identification.nationality}`}
                </div>
              </div>
            )}

            {/* Beneficial owners */}
            {record.beneficialOwners.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3">
                <h5 className="text-xs font-semibold text-slate-500 mb-1">Wirtschaftlich Berechtigte</h5>
                {record.beneficialOwners.map(bo => (
                  <div key={bo.id} className="text-sm text-slate-700">
                    {bo.name} — {bo.ownershipPercentage}% ({bo.controlType})
                  </div>
                ))}
              </div>
            )}

            {/* Risk factors */}
            {record.riskFactors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <h5 className="text-xs font-semibold text-amber-700 mb-1">Risikofaktoren</h5>
                <ul className="text-sm text-amber-700 space-y-0.5">
                  {record.riskFactors.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap pt-1">
              {record.status === 'risk_assessment_required' && (
                <button
                  onClick={() => handleRiskAssessment(record.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Risikobewertung durchführen
                </button>
              )}
              {record.status === 'review_required' && (
                <>
                  <button
                    onClick={() => handleDecide(record.id, true)}
                    className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Mandatsannahme freigeben
                  </button>
                  <button
                    onClick={() => handleDecide(record.id, false)}
                    className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Ablehnen
                  </button>
                </>
              )}
            </div>

            {/* Decision info */}
            {record.decidedBy && (
              <div className="text-xs text-slate-400">
                Entscheidung: {record.decidedBy} am {record.decidedAt?.split('T')[0]}
                {record.decisionNote && ` — ${record.decisionNote}`}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          GwG/KYC Compliance
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Mandanten-Onboarding nach § 2 Abs. 1 Nr. 7 GwG — Identifizierung, PEP, Sanktionen, Risikobewertung
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
          {pendingOnboardings.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Keine offenen GwG-Prüfungen</p>
            </div>
          ) : (
            pendingOnboardings.map(renderOnboardingCard)
          )}
        </div>
      )}

      {/* ─── All Tab ─── */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {allOnboardings.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Noch keine GwG-Onboardings</p>
            </div>
          ) : (
            allOnboardings
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map(renderOnboardingCard)
          )}
        </div>
      )}

      {/* ─── Dashboard Tab ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Gesamt', value: stats.totalOnboardings, color: 'text-slate-900' },
              { label: 'Offen', value: stats.pendingOnboardings, color: 'text-amber-600' },
              { label: 'Freigegeben', value: stats.approvedOnboardings, color: 'text-green-600' },
              { label: 'Abgelehnt', value: stats.rejectedOnboardings, color: 'text-red-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.highRiskClients}</div>
              <div className="text-xs text-orange-600 mt-1">Hochrisiko-Mandanten</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.pepClients}</div>
              <div className="text-xs text-purple-600 mt-1">PEP-Mandanten</div>
            </div>
            <div className={`rounded-xl p-4 text-center ${stats.needingReview > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className={`text-2xl font-bold ${stats.needingReview > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.needingReview}
              </div>
              <div className={`text-xs mt-1 ${stats.needingReview > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Review fällig
              </div>
            </div>
          </div>

          {stats.needingReview > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-medium text-red-700">
                {stats.needingReview} Mandant(en) benötigen eine Wiederholungsprüfung
              </div>
              <p className="text-sm text-red-600 mt-1">
                Die reguläre GwG-Überprüfungsfrist ist abgelaufen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
