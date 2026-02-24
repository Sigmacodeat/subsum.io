import {
  DMS_FOLDER_LABELS,
  DOCUMENT_VERSION_STATUS_LABELS,
  DocumentVersioningService,
} from '@affine/core/modules/case-assistant';
import type {
  DMSFolderCategory,
  DocumentVersion,
  DocumentVersionGroup,
} from '@affine/core/modules/case-assistant/services/document-versioning';
import { useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   DocumentVersioningSection — Dokumentenversionierung + DMS-Ordnerstruktur
   ═══════════════════════════════════════════════════════════════════════════ */

interface DocumentVersioningSectionProps {
  matterId: string;
  currentUserId: string;
  currentUserName: string;
}

type TabId = 'documents' | 'folders' | 'dashboard';

const statusColor: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  in_review: 'bg-blue-100 text-blue-700',
  review_approved: 'bg-green-100 text-green-700',
  review_rejected: 'bg-red-100 text-red-700',
  final: 'bg-emerald-100 text-emerald-700',
  superseded: 'bg-slate-200 text-slate-500',
  archived: 'bg-slate-200 text-slate-400',
};

export function DocumentVersioningSection({
  matterId,
  currentUserId,
  currentUserName,
}: DocumentVersioningSectionProps) {
  const versioningService = useService(DocumentVersioningService);
  const [activeTab, setActiveTab] = useState<TabId>('documents');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const groups = useMemo(
    () => versioningService.getGroupsForMatter(matterId),
    [versioningService, matterId, refreshKey]
  );

  const allVersions = useMemo(
    () => Object.values((versioningService as any).versionsMap$?.value ?? {}) as DocumentVersion[],
    [versioningService, refreshKey]
  );

  const stats = useMemo(
    () => versioningService.getDashboardStats(),
    [versioningService, refreshKey]
  );

  const getVersionsForGroup = useCallback(
    (groupId: string) =>
      allVersions
        .filter(v => v.documentGroupId === groupId)
        .sort((a, b) => b.versionNumber - a.versionNumber),
    [allVersions]
  );

  // Group by DMS folder
  const folderGroups = useMemo(() => {
    const map: Record<string, DocumentVersionGroup[]> = {};
    for (const g of groups) {
      const folder = g.folderPath ?? 'sonstiges';
      if (!map[folder]) map[folder] = [];
      map[folder].push(g);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [groups]);

  const handleSubmitForReview = useCallback(async (versionId: string) => {
    try {
      await versioningService.submitForReview(versionId);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [versioningService, refresh]);

  const handleApproveReview = useCallback(async (versionId: string) => {
    try {
      await versioningService.reviewVersion(
        versionId, true, currentUserId, currentUserName, 'Freigegeben'
      );
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [versioningService, currentUserId, currentUserName, refresh]);

  const handleRejectReview = useCallback(async (versionId: string) => {
    const note = prompt('Ablehnungsgrund:');
    if (!note) return;
    try {
      await versioningService.reviewVersion(
        versionId, false, currentUserId, currentUserName, note
      );
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [versioningService, currentUserId, currentUserName, refresh]);

  const handleFinalize = useCallback(async (versionId: string) => {
    try {
      await versioningService.markAsFinal(versionId);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }, [versioningService, refresh]);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'documents', label: 'Dokumente', count: groups.length },
    { id: 'folders', label: 'DMS-Ordner', count: folderGroups.length },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  function renderVersionRow(v: DocumentVersion) {
    return (
      <div key={v.id} className="flex items-center justify-between py-2 px-3 border-b border-slate-50 last:border-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-6 text-right">v{v.versionNumber}</span>
          <div>
            <span className="text-sm text-slate-700">{v.label}</span>
            {v.changeDescription && (
              <span className="text-xs text-slate-400 ml-2">— {v.changeDescription}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{v.authorName}</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[v.status] ?? ''}`}>
            {DOCUMENT_VERSION_STATUS_LABELS[v.status]}
          </span>

          {/* Actions */}
          {v.status === 'draft' && (
            <button
              onClick={() => {
                handleSubmitForReview(v.id).catch(() => {});
              }}
              className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            >
              Zur Prüfung
            </button>
          )}
          {v.status === 'in_review' && v.authorId !== currentUserId && (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  handleApproveReview(v.id).catch(() => {});
                }}
                className="px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                aria-label="Review freigeben"
              >
                Freigeben
              </button>
              <button
                onClick={() => {
                  handleRejectReview(v.id).catch(() => {});
                }}
                className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                aria-label="Review ablehnen"
              >
                Ablehnen
              </button>
            </div>
          )}
          {v.status === 'in_review' && v.authorId === currentUserId && (
            <span className="text-xs text-amber-600">Prüfung durch andere Person</span>
          )}
          {v.status === 'review_approved' && (
            <button
              onClick={() => {
                handleFinalize(v.id).catch(() => {});
              }}
              className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors"
            >
              Finalisieren
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Dokumentenversionierung</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Versionskontrolle mit Review-Workflow (Draft → Prüfung → Final)
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

      {/* ─── Documents Tab ─── */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Noch keine versionierten Dokumente</p>
            </div>
          ) : (
            groups.map((group: DocumentVersionGroup) => {
              const isExpanded = expandedGroupId === group.id;
              const versions = getVersionsForGroup(group.id);
              return (
                <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{group.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {group.documentType} · v{group.currentVersionNumber} · {group.totalVersions} Version(en)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.hasFinalVersion && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                          Final vorhanden
                        </span>
                      )}
                      <span className="text-sm text-slate-400">{isExpanded ? 'Schließen' : 'Öffnen'}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {versions.length === 0 ? (
                        <div className="px-4 py-6 text-center text-slate-400 text-sm">
                          Keine Versionen vorhanden
                        </div>
                      ) : (
                        versions.map(renderVersionRow)
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Folders Tab ─── */}
      {activeTab === 'folders' && (
        <div className="space-y-4">
          {folderGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">Noch keine DMS-Ordner</p>
            </div>
          ) : (
            folderGroups.map(([folder, docs]) => (
              <div key={folder}>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  {DMS_FOLDER_LABELS[folder as DMSFolderCategory] ?? folder}
                  <span className="text-xs text-slate-400 font-normal"> ({docs.length})</span>
                </h4>
                <div className="space-y-1">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-slate-900">{doc.title}</span>
                        <span className="text-xs text-slate-400 ml-2">v{doc.currentVersionNumber}</span>
                      </div>
                      {doc.hasFinalVersion ? (
                        <span className="text-xs text-emerald-600">Final</span>
                      ) : (
                        <span className="text-xs text-amber-600">Entwurf</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Dashboard Tab ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Dokumente', value: stats.totalGroups, color: 'text-slate-900' },
              { label: 'Versionen', value: stats.totalVersions, color: 'text-slate-900' },
              { label: 'Entwürfe', value: stats.drafts, color: 'text-slate-600' },
              { label: 'In Prüfung', value: stats.inReview, color: stats.inReview > 0 ? 'text-blue-600' : 'text-slate-600' },
              { label: 'Finalisiert', value: stats.finalized, color: 'text-emerald-600' },
              { label: 'Ohne Final', value: stats.groupsWithoutFinal, color: stats.groupsWithoutFinal > 0 ? 'text-amber-600' : 'text-green-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          {stats.inReview > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="font-medium text-blue-700">
                {stats.inReview} Version(en) warten auf Prüfung
              </div>
            </div>
          )}

          {stats.groupsWithoutFinal > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-medium text-amber-700">
                {stats.groupsWithoutFinal} Dokument(e) ohne finalisierte Version
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
