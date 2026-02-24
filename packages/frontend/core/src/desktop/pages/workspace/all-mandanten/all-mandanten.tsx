import { useLiveData, useService } from '@toeverything/infra';
import { useI18n } from '@affine/i18n';
import { useConfirmModal, usePromptModal } from '@affine/component';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  ViewBody,
  ViewIcon,
  ViewTitle,
} from '../../../../modules/workbench';
import { WorkbenchService } from '../../../../modules/workbench';
import { WorkspaceService } from '../../../../modules/workspace';
import { LegalCopilotWorkflowService } from '../../../../modules/case-assistant/services/legal-copilot-workflow';
import { CasePlatformOrchestrationService } from '../../../../modules/case-assistant/services/platform-orchestration';
import { CaseAssistantStore } from '../../../../modules/case-assistant/stores/case-assistant';
import type {
  CaseDeadline,
  ClientRecord,
  ClientKind,
  LegalDocumentRecord,
  MatterRecord,
  Vollmacht,
} from '../../../../modules/case-assistant/types';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { createLocalRecordId } from '../detail-page/tabs/case-assistant/utils';
import { BulkActionBar } from '../layouts/bulk-action-bar';
import { useBulkSelection } from '../layouts/use-bulk-selection';
import * as styles from './all-mandanten.css';

type SortKey = 'updatedAt' | 'displayName' | 'kind' | 'aktenCount';
type SortDir = 'asc' | 'desc';
type MandantenSavedView = 'active' | 'companies' | 'authorities' | 'archived' | 'custom';
type ComplianceFocusTarget = 'vollmacht' | 'ausweis';

const kindLabelKey: Record<ClientKind, string> = {
  person: 'com.affine.caseAssistant.allMandanten.kind.person',
  company: 'com.affine.caseAssistant.allMandanten.kind.company',
  authority: 'com.affine.caseAssistant.allMandanten.kind.authority',
  other: 'com.affine.caseAssistant.allMandanten.kind.other',
};

const kindStyleMap: Record<ClientKind, string> = {
  person: styles.kindPerson,
  company: styles.kindCompany,
  authority: styles.kindAuthority,
  other: styles.kindOther,
};

const mandantKindIconStyleMap: Record<ClientKind, string> = {
  person: styles.mandantKindIconPerson,
  company: styles.mandantKindIconCompany,
  authority: styles.mandantKindIconAuthority,
  other: styles.mandantKindIconOther,
};

const sortKeyLabelKey: Record<SortKey, string> = {
  updatedAt: 'com.affine.caseAssistant.allMandanten.sort.updatedAt',
  displayName: 'com.affine.caseAssistant.allMandanten.sort.displayName',
  kind: 'com.affine.caseAssistant.allMandanten.sort.kind',
  aktenCount: 'com.affine.caseAssistant.allMandanten.sort.aktenCount',
};

function getClientStateVisual(client: Pick<MandantWithStats, 'archived' | 'criticalAlertsCount' | 'openAktenCount'>): {
  label: string;
  className: string;
} {
  if (client.archived) {
    return { label: 'Archiviert', className: styles.clientStateArchived };
  }
  if (client.criticalAlertsCount > 0) {
    return { label: 'Frist kritisch', className: styles.clientStateCritical };
  }
  if (client.openAktenCount > 0) {
    return { label: 'Aktiv', className: styles.clientStateActive };
  }
  return { label: 'Ruhend', className: styles.clientStateIdle };
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

type ComplianceState = 'ok' | 'missing' | 'na';

function isLikelyAusweisDocument(doc: Pick<LegalDocumentRecord, 'title' | 'sourceRef' | 'tags'>): boolean {
  const haystack = [doc.title, doc.sourceRef, ...(doc.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return [
    'ausweis',
    'personalausweis',
    'reisepass',
    'passport',
    'id card',
    'identity card',
    'identitätsnachweis',
  ].some(keyword => haystack.includes(keyword));
}

interface MandantWithStats extends ClientRecord {
  aktenCount: number;
  openAktenCount: number;
  docCount: number;
  criticalAlertsCount: number;
  latestMatterUpdatedAt: string | null;
  nextDeadlineLabel: string | null;
  nextDeadlineUrgent: boolean;
  linkedMattersPreview: Array<{
    label: string;
    status: MatterRecord['status'];
  }>;
}

interface ClientEditDraft {
  displayName: string;
  primaryEmail: string;
  primaryPhone: string;
  kind: ClientKind;
  archived: boolean;
}

export const AllMandantenPage = () => {
  const t = useI18n();
  const store = useService(CaseAssistantStore);
  const workbench = useService(WorkbenchService).workbench;
  const workspace = useService(WorkspaceService).workspace;
  const legalCopilotWorkflowService = useService(LegalCopilotWorkflowService);
  const casePlatformOrchestrationService = useService(CasePlatformOrchestrationService);
  const { openPromptModal } = usePromptModal();
  const { openConfirmModal } = useConfirmModal();

  const graph = useLiveData(store.watchGraph());
  const legalDocs = useLiveData(legalCopilotWorkflowService.legalDocuments$) ?? [];
  const allVollmachten = useLiveData(casePlatformOrchestrationService.vollmachten$) ?? [];

  const [kindFilter, setKindFilter] = useState<ClientKind | 'all'>('all');
  const [savedView, setSavedView] = useState<MandantenSavedView>('active');
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openingClientId, setOpeningClientId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [savingClientId, setSavingClientId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ClientEditDraft | null>(null);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const rowClickTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const actionStatusTimerRef = useRef<number | null>(null);
  const language = t.language || 'en';

  const kindLabel = useMemo(
    () => ({
      person: t[kindLabelKey.person](),
      company: t[kindLabelKey.company](),
      authority: t[kindLabelKey.authority](),
      other: t[kindLabelKey.other](),
    }),
    [t]
  );

  const sortKeyLabel = useMemo(
    () => ({
      updatedAt: t[sortKeyLabelKey.updatedAt](),
      displayName: t[sortKeyLabelKey.displayName](),
      kind: t[sortKeyLabelKey.kind](),
      aktenCount: t[sortKeyLabelKey.aktenCount](),
    }),
    [t]
  );

  const searchPlaceholder = useMemo(() => {
    const localized = t['com.affine.caseAssistant.allMandanten.search.placeholder']();
    return localized === 'com.affine.caseAssistant.allMandanten.search.placeholder'
      ? 'Mandant suchen'
      : localized;
  }, [t]);

  const allClients = useMemo(() => Object.values(graph.clients ?? {}), [graph.clients]);
  const allMatters = useMemo(() => Object.values(graph.matters ?? {}), [graph.matters]);
  const caseFiles = useMemo(() => Object.values(graph.cases ?? {}), [graph.cases]);
  const allDeadlines = useMemo(() => graph.deadlines ?? {}, [graph.deadlines]);

  const matterById = useMemo(() => {
    const map = new Map<string, MatterRecord>();
    for (const matter of allMatters) {
      map.set(matter.id, matter);
    }
    return map;
  }, [allMatters]);

  const caseToMatterMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of caseFiles) {
      if (!c.matterId) continue;
      map.set(c.id, c.matterId);
    }
    return map;
  }, [caseFiles]);

  const docCountByMatter = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of legalDocs) {
      const matterId = caseToMatterMap.get(doc.caseId);
      if (!matterId) continue;
      map.set(matterId, (map.get(matterId) ?? 0) + 1);
    }
    return map;
  }, [caseToMatterMap, legalDocs]);

  const complianceByClientId = useMemo(() => {
    const activeVollmachtClientIds = new Set<string>();
    const nowTs = Date.now();

    for (const vollmacht of allVollmachten as Vollmacht[]) {
      if (vollmacht.status !== 'active' && vollmacht.status !== 'pending') continue;
      if (vollmacht.validUntil && new Date(vollmacht.validUntil).getTime() < nowTs) continue;
      activeVollmachtClientIds.add(vollmacht.clientId);
    }

    const caseClientIds = new Map<string, Set<string>>();
    for (const caseFile of caseFiles) {
      if (!caseFile.matterId) continue;
      const matter = matterById.get(caseFile.matterId);
      if (!matter) continue;
      const ids = new Set<string>([matter.clientId, ...(matter.clientIds ?? [])]);
      caseClientIds.set(caseFile.id, ids);
    }

    const ausweisClientIds = new Set<string>();
    for (const doc of legalDocs as LegalDocumentRecord[]) {
      if (doc.trashedAt) continue;
      if (!isLikelyAusweisDocument(doc)) continue;
      const linkedClientIds = caseClientIds.get(doc.caseId);
      if (!linkedClientIds) continue;
      for (const clientId of linkedClientIds) {
        ausweisClientIds.add(clientId);
      }
    }

    const map = new Map<string, { vollmacht: ComplianceState; ausweis: ComplianceState }>();
    for (const client of allClients) {
      if (client.kind === 'authority' || client.kind === 'other') {
        map.set(client.id, { vollmacht: 'na', ausweis: 'na' });
        continue;
      }
      map.set(client.id, {
        vollmacht: activeVollmachtClientIds.has(client.id) ? 'ok' : 'missing',
        ausweis: ausweisClientIds.has(client.id) ? 'ok' : 'missing',
      });
    }
    return map;
  }, [allClients, allVollmachten, caseFiles, legalDocs, matterById]);

  useEffect(() => {
    const t = window.setTimeout(() => setShowInitialSkeleton(false), 420);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(
    () => () => {
      if (rowClickTimerRef.current) {
        window.clearTimeout(rowClickTimerRef.current);
      }
      if (actionStatusTimerRef.current) {
        window.clearTimeout(actionStatusTimerRef.current);
      }
    },
    []
  );

  const showActionStatus = useCallback((msg: string) => {
    setActionStatus(msg);
    if (actionStatusTimerRef.current) window.clearTimeout(actionStatusTimerRef.current);
    actionStatusTimerRef.current = window.setTimeout(() => setActionStatus(null), 4000);
  }, []);

  const cancelEditClient = useCallback(() => {
    setEditingClientId(null);
    setEditDraft(null);
  }, []);

  // "/" focuses search; Escape cancels edit
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape' && editingClientId) {
        cancelEditClient();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingClientId, cancelEditClient]);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, items: MandantWithStats[]) => {
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, items.length - 1);
          document.querySelector<HTMLElement>(`[data-mandant-row-index="${next}"]`)?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          document.querySelector<HTMLElement>(`[data-mandant-row-index="${next}"]`)?.focus();
          return next;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedIndex(0);
        document.querySelector<HTMLElement>('[data-mandant-row-index="0"]')?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = items.length - 1;
        setFocusedIndex(last);
        document.querySelector<HTMLElement>(`[data-mandant-row-index="${last}"]`)?.focus();
      }
    },
    []
  );

  // Enrich clients with matter stats
  const enrichedClients: MandantWithStats[] = useMemo(() => {
    return allClients.map(client => {
      const clientMatters = allMatters.filter(
        m => m.clientId === client.id || (m.clientIds ?? []).includes(client.id)
      );
      const openAkten = clientMatters.filter(m => m.status === 'open');
      const latestMatter = clientMatters.reduce<MatterRecord | null>((latest, m) => {
        if (!latest) return m;
        return new Date(m.updatedAt) > new Date(latest.updatedAt) ? m : latest;
      }, null);

      // Find next deadline for this client's matters
      const clientMatterIds = new Set(clientMatters.map(m => m.id));
      const clientDeadlineIds = caseFiles
        .filter(c => c.matterId && clientMatterIds.has(c.matterId))
        .flatMap(c => c.deadlineIds ?? []);
      const clientDeadlines = clientDeadlineIds
        .map(dId => allDeadlines[dId])
        .filter((d): d is CaseDeadline =>
          Boolean(d) && d.status !== 'completed' && d.status !== 'expired' && Boolean(d.dueAt)
        )
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

      const nextDeadline = clientDeadlines[0] ?? null;
      let nextDeadlineLabel: string | null = null;
      let nextDeadlineUrgent = false;
      if (nextDeadline) {
        const days = daysUntil(nextDeadline.dueAt);
        nextDeadlineUrgent = days <= 3;
        if (days < 0)
          nextDeadlineLabel = t.t(
            'com.affine.caseAssistant.allMandanten.deadline.overdue',
            {
              count: Math.abs(days),
            }
          );
        else if (days === 0)
          nextDeadlineLabel = t['com.affine.caseAssistant.allMandanten.deadline.today']();
        else if (days <= 7)
          nextDeadlineLabel = t.t(
            'com.affine.caseAssistant.allMandanten.deadline.inDays',
            {
              count: days,
            }
          );
        else
          nextDeadlineLabel = new Date(nextDeadline.dueAt).toLocaleDateString(
            language
          );
      }

      const criticalAlertsCount = clientDeadlines.filter(d => daysUntil(d.dueAt) <= 0).length;
      const docCount = clientMatters.reduce(
        (sum, matter) => sum + (docCountByMatter.get(matter.id) ?? 0),
        0
      );

      const linkedMattersPreview = [...clientMatters]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3)
        .map(m => {
          return {
            label: `${m.externalRef ? `${m.externalRef} · ` : ''}${m.title}`,
            status: m.status,
          };
        });

      return {
        ...client,
        aktenCount: clientMatters.length,
        openAktenCount: openAkten.length,
        docCount,
        criticalAlertsCount,
        latestMatterUpdatedAt: latestMatter?.updatedAt ?? null,
        nextDeadlineLabel,
        nextDeadlineUrgent,
        linkedMattersPreview,
      };
    });
  }, [allClients, allDeadlines, allMatters, caseFiles, docCountByMatter, language, t]);

  const archivedCount = useMemo(
    () => enrichedClients.filter(client => client.archived).length,
    [enrichedClients]
  );

  // Filtering
  const filtered = useMemo(() => {
    let result = enrichedClients;

    if (savedView === 'archived') {
      result = result.filter(c => c.archived);
    } else {
      if (!showArchived) {
        result = result.filter(c => !c.archived);
      }
    }

    if (savedView === 'companies') {
      result = result.filter(c => c.kind === 'company');
    } else if (savedView === 'authorities') {
      result = result.filter(c => c.kind === 'authority');
    } else {
      if (kindFilter !== 'all') {
        result = result.filter(c => c.kind === kindFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        (c.primaryEmail ?? '').toLowerCase().includes(q) ||
        (c.primaryPhone ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q) ||
        (c.notes ?? '').toLowerCase().includes(q) ||
        c.linkedMattersPreview.some(item => item.label.toLowerCase().includes(q))
      );
    }
    return result;
  }, [enrichedClients, kindFilter, savedView, searchQuery, showArchived]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'displayName':
          cmp = a.displayName.localeCompare(b.displayName, language);
          break;
        case 'kind':
          cmp = kindLabel[a.kind].localeCompare(kindLabel[b.kind], language);
          break;
        case 'aktenCount':
          cmp = a.aktenCount - b.aktenCount;
          break;
        case 'updatedAt':
        default: {
          const aTime = a.latestMatterUpdatedAt
            ? Math.max(new Date(a.updatedAt).getTime(), new Date(a.latestMatterUpdatedAt).getTime())
            : new Date(a.updatedAt).getTime();
          const bTime = b.latestMatterUpdatedAt
            ? Math.max(new Date(b.updatedAt).getTime(), new Date(b.latestMatterUpdatedAt).getTime())
            : new Date(b.updatedAt).getTime();
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, kindLabel, language, sortKey, sortDir]);

  const bulkSelection = useBulkSelection({
    itemIds: useMemo(() => sorted.map(c => c.id), [sorted]),
  });

  const [isBulkDeletingClients, setIsBulkDeletingClients] = useState(false);

  const handleBulkDeleteClients = useCallback(() => {
    const targets = sorted.filter(c => bulkSelection.selectedIds.has(c.id));
    if (targets.length === 0) {
      showActionStatus(t['com.affine.caseAssistant.allMandanten.bulk.empty']());
      return;
    }

    openConfirmModal({
      title: `Mandanten löschen?`,
      description:
        `Du löschst ${targets.length} Mandant(en). Mandanten müssen zuvor archiviert sein und dürfen nicht mit Akten verknüpft sein.`,
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText: 'Löschen',
      confirmButtonOptions: {
        variant: 'error',
      },
      onConfirm: async () => {
        if (isBulkDeletingClients) return;
        setIsBulkDeletingClients(true);
        try {
          const result = await casePlatformOrchestrationService.deleteClientsBulk(
            targets.map(c => c.id)
          );

          const blockedSuffix =
            result.blockedIds.length > 0
              ? ` · ${result.blockedIds.length} blockiert`
              : '';
          const failedSuffix =
            result.failedIds.length > 0
              ? ` · ${result.failedIds.length} fehlgeschlagen`
              : '';

          showActionStatus(
            `Mandanten gelöscht: ${result.succeededIds.length}/${result.total}${blockedSuffix}${failedSuffix}.`
          );
          bulkSelection.clear();
        } finally {
          setIsBulkDeletingClients(false);
        }
      },
    });
  }, [bulkSelection, casePlatformOrchestrationService, isBulkDeletingClients, openConfirmModal, showActionStatus, sorted, t]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === 'Escape' && bulkSelection.selectedCount > 0) {
        bulkSelection.clear();
      }

      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        bulkSelection.selectedCount > 0 &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA'
      ) {
        e.preventDefault();
        handleBulkDeleteClients();
      }

      if (
        (e.key === 'a' || e.key === 'A') &&
        (e.metaKey || e.ctrlKey) &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA'
      ) {
        e.preventDefault();
        bulkSelection.selectAllVisible(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bulkSelection, handleBulkDeleteClients]);

  const handleOpenClientDetail = useCallback((clientId: string, focusTarget?: ComplianceFocusTarget) => {
    setOpeningClientId(clientId);
    const selectedClient = allClients.find(c => c.id === clientId);
    if (selectedClient) {
      showActionStatus(
        t.t('com.affine.caseAssistant.allMandanten.openDetail.opening', {
          name: selectedClient.displayName,
        })
      );
    }
    if (selectedClient?.id) {
      const query = focusTarget ? `?focus=${focusTarget}` : '';
      workbench.open(`/mandanten/${selectedClient.id}${query}`);
    } else {
      showActionStatus(t['com.affine.caseAssistant.allMandanten.openDetail.failed']());
    }
    window.setTimeout(() => {
      setOpeningClientId(null);
    }, 0);
  }, [allClients, showActionStatus, t, workbench]);

  const startEditClient = useCallback((client: MandantWithStats) => {
    setEditingClientId(client.id);
    setEditDraft({
      displayName: client.displayName,
      primaryEmail: client.primaryEmail ?? '',
      primaryPhone: client.primaryPhone ?? '',
      kind: client.kind,
      archived: client.archived,
    });
  }, []);

  const saveClientEdit = useCallback(async () => {
    if (!editingClientId || !editDraft) return;
    const current = allClients.find(client => client.id === editingClientId);
    if (!current) return;

    const displayName = editDraft.displayName.trim();
    if (!displayName) {
      showActionStatus(
        t['com.affine.caseAssistant.allMandanten.edit.validation.displayNameRequired']()
      );
      return;
    }

    setSavingClientId(editingClientId);
    const now = new Date().toISOString();
    const result = await casePlatformOrchestrationService.upsertClient({
      ...current,
      displayName,
      primaryEmail: editDraft.primaryEmail.trim() || undefined,
      primaryPhone: editDraft.primaryPhone.trim() || undefined,
      kind: editDraft.kind,
      archived: editDraft.archived,
      updatedAt: now,
    });

    if (!result) {
      setSavingClientId(null);
      showActionStatus(
        t.t('com.affine.caseAssistant.allMandanten.edit.saveFailed', {
          name: displayName,
        })
      );
      return;
    }

    setSavingClientId(null);
    setEditingClientId(null);
    setEditDraft(null);
    showActionStatus(
      t.t('com.affine.caseAssistant.allMandanten.edit.saved', {
        name: displayName,
      })
    );
  }, [allClients, casePlatformOrchestrationService, editDraft, editingClientId, showActionStatus, t]);

  const handleBulkArchive = useCallback(
    async (archived: boolean) => {
      const targets = sorted.filter(client => client.archived !== archived);
      if (!targets.length) {
        showActionStatus(t['com.affine.caseAssistant.allMandanten.bulk.empty']());
        return;
      }
      const now = new Date().toISOString();
      const results = await Promise.all(
        targets.map(client =>
          casePlatformOrchestrationService.upsertClient({
            ...client,
            archived,
            updatedAt: now,
          })
        )
      );
      const succeeded = results.filter(Boolean).length;
      const failed = targets.length - succeeded;
      showActionStatus(
        failed > 0
          ? t.t('com.affine.caseAssistant.allMandanten.bulk.partial', {
              successCount: succeeded,
              failedCount: failed,
              action: archived
                ? t['com.affine.caseAssistant.allMandanten.bulk.action.archived']()
                : t['com.affine.caseAssistant.allMandanten.bulk.action.reactivated'](),
            })
          : t.t('com.affine.caseAssistant.allMandanten.bulk.success', {
              count: targets.length,
              action: archived
                ? t['com.affine.caseAssistant.allMandanten.bulk.action.archived']()
                : t['com.affine.caseAssistant.allMandanten.bulk.action.reactivated'](),
            })
      );
    },
    [casePlatformOrchestrationService, showActionStatus, sorted, t]
  );

  const handleCreateClient = useCallback(() => {
    if (!workspace) {
      showActionStatus('Workspace nicht bereit. Bitte erneut versuchen.');
      return;
    }

    openPromptModal({
      title: 'Neu+ Mandant',
      label: 'Name',
      inputOptions: {
        placeholder: 'z. B. Max Mustermann GmbH',
      },
      confirmText: 'Mandant anlegen',
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm: async rawName => {
        const displayName = rawName.trim();
        if (!displayName) {
          showActionStatus('Bitte einen Mandantennamen angeben.');
          return;
        }

        const created = await casePlatformOrchestrationService.upsertClient({
          id: createLocalRecordId('client'),
          workspaceId: workspace.id,
          kind: 'person',
          displayName,
          archived: false,
          tags: [],
        });

        if (!created) {
          showActionStatus(`Mandant konnte nicht angelegt werden: ${displayName}.`);
          return;
        }

        setSavedView('active');
        setShowArchived(false);
        setSearchQuery('');
        showActionStatus(`Mandant angelegt: ${created.displayName}.`);
      },
    });
  }, [
    casePlatformOrchestrationService,
    openPromptModal,
    showActionStatus,
    t,
    workspace,
  ]);

  const isInitialLoading =
    showInitialSkeleton &&
    allClients.length === 0 &&
    allMatters.length === 0 &&
    caseFiles.length === 0;

  const savedViewOptions: Array<{ key: MandantenSavedView; label: string }> = [
    { key: 'active', label: t['com.affine.caseAssistant.allMandanten.view.active']() },
    {
      key: 'companies',
      label: t['com.affine.caseAssistant.allMandanten.view.companies'](),
    },
    {
      key: 'authorities',
      label: t['com.affine.caseAssistant.allMandanten.view.authorities'](),
    },
    { key: 'archived', label: t['com.affine.caseAssistant.allMandanten.view.archived']() },
    { key: 'custom', label: 'Individuell' },
  ];

  const kindFilterOptions: Array<{ key: ClientKind | 'all'; label: string }> = [
    { key: 'all', label: t['com.affine.caseAssistant.allMandanten.kindFilter.all']() },
    {
      key: 'person',
      label: t['com.affine.caseAssistant.allMandanten.kindFilter.person'](),
    },
    {
      key: 'company',
      label: t['com.affine.caseAssistant.allMandanten.kindFilter.company'](),
    },
    {
      key: 'authority',
      label: t['com.affine.caseAssistant.allMandanten.kindFilter.authority'](),
    },
  ];

  const visibleKindFilterOptions = useMemo(() => {
    if (savedView === 'companies') {
      return kindFilterOptions.filter(option => option.key !== 'company');
    }
    if (savedView === 'authorities') {
      return kindFilterOptions.filter(option => option.key !== 'authority');
    }
    return kindFilterOptions;
  }, [kindFilterOptions, savedView]);

  const handleSegmentKeyDown = useCallback(
    <T extends string>(
      event: KeyboardEvent<HTMLButtonElement>,
      options: Array<{ key: T }>,
      activeKey: T,
      onSelect: (key: T) => void
    ) => {
      const currentIndex = options.findIndex(option => option.key === activeKey);
      if (currentIndex < 0) return;

      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % options.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + options.length) % options.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = options.length - 1;
      else return;

      event.preventDefault();
      onSelect(options[nextIndex].key);

      window.requestAnimationFrame(() => {
        const parent = event.currentTarget.parentElement;
        const buttons = parent?.querySelectorAll<HTMLButtonElement>('button');
        buttons?.[nextIndex]?.focus();
      });
    },
    []
  );

  return (
    <>
      <ViewTitle title={t['com.affine.caseAssistant.allMandanten.title']()} />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div className={styles.body}>
          <div className={styles.srOnlyLive} aria-live="polite" aria-atomic="true">
            {actionStatus ?? ''}
          </div>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <label className={styles.toolbarControl}>
                <span className={styles.toolbarLabel}>Ansicht</span>
                <select
                  className={styles.toolbarSelect}
                  value={savedView}
                  onChange={event => {
                    const nextView = event.target.value as MandantenSavedView;
                    setSavedView(nextView);
                    if (nextView !== 'custom') {
                      setKindFilter('all');
                      setShowArchived(false);
                    }
                  }}
                  aria-label={t['com.affine.caseAssistant.allMandanten.aria.viewFilter']()}
                >
                  {savedViewOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {t.t('com.affine.caseAssistant.allMandanten.view.prefix', {
                        label: option.label,
                      })}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.topActionRow}>
                <button
                  className={styles.filterChip}
                  onClick={handleCreateClient}
                  aria-label="Neuen Mandanten anlegen"
                >
                  Neu+ Mandant
                </button>
                {sorted.length > 0 ? (
                  <>
                    <button
                      className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                      onClick={() => void handleBulkArchive(true)}
                    >
                      {t['com.affine.caseAssistant.allMandanten.bulk.archiveFiltered']()}
                    </button>
                    <button
                      className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                      onClick={() => void handleBulkArchive(false)}
                    >
                      {t['com.affine.caseAssistant.allMandanten.bulk.reactivateFiltered']()}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className={styles.filterRow}>
              <label className={styles.toolbarControl}>
                <span className={styles.toolbarLabel}>{t['com.affine.caseAssistant.allMandanten.toolbar.sort']()}</span>
                <select
                  className={styles.toolbarSelect}
                  value={sortKey}
                  onChange={event => setSortKey(event.target.value as SortKey)}
                  aria-label={t['com.affine.caseAssistant.allMandanten.aria.sortField']()}
                >
                  <option value="updatedAt">{sortKeyLabel.updatedAt}</option>
                  <option value="displayName">{sortKeyLabel.displayName}</option>
                  <option value="kind">{sortKeyLabel.kind}</option>
                  <option value="aktenCount">{sortKeyLabel.aktenCount}</option>
                </select>
              </label>

              <button
                type="button"
                className={styles.toolbarSortDirectionButton}
                onClick={() => setSortDir(current => (current === 'desc' ? 'asc' : 'desc'))}
                data-dir={sortDir}
                aria-label={
                  sortDir === 'desc'
                    ? t['com.affine.caseAssistant.allMandanten.aria.sortDirection.descToAsc']()
                    : t['com.affine.caseAssistant.allMandanten.aria.sortDirection.ascToDesc']()
                }
              >
                {sortDir === 'desc' ? '↓' : '↑'}
              </button>

              <div className={styles.filterGroup}>
                <div className={styles.filterSegment} role="group" aria-label={t['com.affine.caseAssistant.allMandanten.aria.kindFilter']()}>
                  {visibleKindFilterOptions.map(option => (
                    <button
                      key={option.key}
                      className={styles.filterChip}
                      data-active={kindFilter === option.key}
                      onClick={() => {
                        setSavedView('custom');
                        setKindFilter(option.key);
                      }}
                      onKeyDown={event =>
                        handleSegmentKeyDown(event, visibleKindFilterOptions, kindFilter, key => {
                          setSavedView('custom');
                          setKindFilter(key);
                        })
                      }
                      aria-pressed={kindFilter === option.key}
                    >
                      {option.label}
                    </button>
                  ))}
                  {savedView !== 'archived' ? (
                    <button
                      className={styles.filterChip}
                      data-active={showArchived ? 'true' : undefined}
                      onClick={() => {
                        setSavedView('custom');
                        setShowArchived(v => !v);
                      }}
                      aria-pressed={showArchived}
                    >
                      {t.t('com.affine.caseAssistant.allMandanten.filter.archived', {
                        count: archivedCount,
                      })}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={styles.filterGroupRight}>
                <div className={styles.searchWrap}>
                  <input
                    ref={searchInputRef}
                    className={styles.searchInput}
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label={t['com.affine.caseAssistant.allMandanten.aria.search']()}
                  />
                  {searchQuery ? (
                    <button
                      className={styles.searchClear}
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label={t['com.affine.caseAssistant.allMandanten.aria.clearSearch']()}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {actionStatus ? <div className={styles.actionStatus}>{actionStatus}</div> : null}

          {/* Table */}
          <div className={styles.scrollArea}>
            <div
              className={styles.listContainer}
              role="grid"
              onKeyDown={event => handleListKeyDown(event, sorted)}
              aria-label={t['com.affine.caseAssistant.allMandanten.aria.grid']()}
            >
              {/* Header Row */}
              <div className={styles.headerRow} role="row">
                <span className={styles.selectionCell} role="columnheader">
                  <input
                    type="checkbox"
                    className={styles.selectionCheckbox}
                    checked={bulkSelection.headerState.checked}
                    ref={el => {
                      if (el) {
                        el.indeterminate = bulkSelection.headerState.indeterminate;
                      }
                    }}
                    onChange={e => bulkSelection.selectAllVisible(e.target.checked)}
                    aria-label="Alle sichtbaren Mandanten auswählen"
                  />
                </span>
                <span className={styles.sortButton} role="columnheader">{t['com.affine.caseAssistant.allMandanten.header.client']()}</span>
                <span className={styles.sortButton} role="columnheader">{t['com.affine.caseAssistant.allMandanten.header.matters']()}</span>
                <span className={styles.mandantMetaHideSm}>
                  {t['com.affine.caseAssistant.allMandanten.header.nextDeadline']()}
                </span>
                <span className={styles.mandantMeta}>
                  {t['com.affine.caseAssistant.allMandanten.header.kind']()}
                </span>
              </div>

              {isInitialLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`mandanten-skeleton-${index}`}
                    className={styles.skeletonRow}
                    role="row"
                    aria-hidden="true"
                  />
                ))
              ) : sorted.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyTitle}>
                    {searchQuery || kindFilter !== 'all'
                      ? t['com.affine.caseAssistant.allMandanten.empty.filtered.title']()
                      : t['com.affine.caseAssistant.allMandanten.empty.initial.title']()}
                  </div>
                  <div className={styles.emptyDescription}>
                    {searchQuery || kindFilter !== 'all'
                      ? t['com.affine.caseAssistant.allMandanten.empty.filtered.description']()
                      : t['com.affine.caseAssistant.allMandanten.empty.initial.description']()}
                  </div>
                  <button
                    type="button"
                    className={styles.filterChip}
                    onClick={handleCreateClient}
                    aria-label="Neuen Mandanten anlegen"
                  >
                    Neu+ Mandant
                  </button>
                </div>
              ) : (
                sorted.map((client, index) => {
                  const isEditing = editingClientId === client.id;
                  const clientState = getClientStateVisual(client);
                  const compliance = complianceByClientId.get(client.id) ?? {
                    vollmacht: 'missing',
                    ausweis: 'missing',
                  };

                  if (isEditing && editDraft) {
                    return (
                      <div key={client.id} className={styles.mandantEditRow} role="row">
                        <div className={styles.selectionCell} aria-hidden="true" />
                        <div className={styles.editPanel}>
                          <div className={styles.editInputRow}>
                            <input
                              className={styles.editInput}
                              value={editDraft.displayName}
                              onChange={e =>
                                setEditDraft(prev =>
                                  prev ? { ...prev, displayName: e.target.value } : prev
                                )
                              }
                              placeholder={t['com.affine.caseAssistant.allMandanten.edit.placeholder.displayName']()}
                              aria-label={t['com.affine.caseAssistant.allMandanten.edit.aria.displayName']()}
                            />
                            <select
                              className={styles.editSelect}
                              value={editDraft.kind}
                              onChange={e =>
                                setEditDraft(prev =>
                                  prev
                                    ? {
                                        ...prev,
                                        kind: e.target.value as ClientKind,
                                      }
                                    : prev
                                )
                              }
                              aria-label={t['com.affine.caseAssistant.allMandanten.edit.aria.kind']()}
                            >
                              <option value="person">{t['com.affine.caseAssistant.allMandanten.kind.person']()}</option>
                              <option value="company">{t['com.affine.caseAssistant.allMandanten.kind.company']()}</option>
                              <option value="authority">{t['com.affine.caseAssistant.allMandanten.kind.authority']()}</option>
                              <option value="other">{t['com.affine.caseAssistant.allMandanten.kind.other']()}</option>
                            </select>
                          </div>
                          <div className={styles.editInputRow}>
                            <input
                              className={styles.editInput}
                              value={editDraft.primaryEmail}
                              onChange={e =>
                                setEditDraft(prev =>
                                  prev ? { ...prev, primaryEmail: e.target.value } : prev
                                )
                              }
                              placeholder={t['com.affine.caseAssistant.allMandanten.edit.placeholder.email']()}
                              aria-label={t['com.affine.caseAssistant.allMandanten.edit.aria.email']()}
                            />
                            <input
                              className={styles.editInput}
                              value={editDraft.primaryPhone}
                              onChange={e =>
                                setEditDraft(prev =>
                                  prev ? { ...prev, primaryPhone: e.target.value } : prev
                                )
                              }
                              placeholder={t['com.affine.caseAssistant.allMandanten.edit.placeholder.phone']()}
                              aria-label={t['com.affine.caseAssistant.allMandanten.edit.aria.phone']()}
                            />
                          </div>
                          <label className={styles.editCheckboxLabel}>
                            <input
                              type="checkbox"
                              checked={editDraft.archived}
                              onChange={e =>
                                setEditDraft(prev =>
                                  prev ? { ...prev, archived: e.target.checked } : prev
                                )
                              }
                            />
                            {t['com.affine.caseAssistant.allMandanten.edit.archived']()}
                          </label>
                        </div>
                        <span>
                          <span className={styles.aktenCount}>
                            {client.aktenCount}
                            {client.openAktenCount > 0
                              ? t.t('com.affine.caseAssistant.allMandanten.meta.openMatters', {
                                  count: client.openAktenCount,
                                })
                              : ''}
                          </span>
                          <span className={styles.docCountText}>
                            {t.t('com.affine.caseAssistant.allMandanten.meta.documents', {
                              count: client.docCount,
                            })}
                          </span>
                        </span>
                        <span className={styles.mandantMetaHideSm}>
                          {client.nextDeadlineLabel ? (
                            <span
                              className={styles.nextDeadlineText}
                              data-urgent={client.nextDeadlineUrgent ? 'true' : 'false'}
                            >
                              {client.nextDeadlineLabel}
                            </span>
                          ) : (
                            t['com.affine.caseAssistant.allMandanten.fallback.none']()
                          )}
                        </span>
                        <span className={styles.editActions}>
                          <button
                            type="button"
                            className={styles.editButtonPrimary}
                            onClick={() => void saveClientEdit()}
                            disabled={savingClientId === client.id}
                          >
                            {savingClientId === client.id
                              ? t['com.affine.caseAssistant.allMandanten.edit.saving']()
                              : t['com.affine.caseAssistant.allMandanten.edit.save']()}
                          </button>
                          <button
                            type="button"
                            className={styles.editButtonSecondary}
                            onClick={cancelEditClient}
                            disabled={savingClientId === client.id}
                          >
                            {t['com.affine.auth.sign-out.confirm-modal.cancel']()}
                          </button>
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      type="button"
                      key={client.id}
                      data-mandant-row-index={index}
                      className={[
                        styles.mandantRow,
                        client.criticalAlertsCount > 0
                          ? styles.mandantRowCritical
                          : client.nextDeadlineUrgent
                            ? styles.mandantRowUrgent
                            : '',
                        openingClientId === client.id ? styles.mandantRowOpening : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={event => {
                        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-compliance-target]');
                        if (target?.dataset.complianceTarget) {
                          event.preventDefault();
                          event.stopPropagation();
                          if (rowClickTimerRef.current) {
                            window.clearTimeout(rowClickTimerRef.current);
                            rowClickTimerRef.current = null;
                          }
                          handleOpenClientDetail(
                            client.id,
                            target.dataset.complianceTarget as ComplianceFocusTarget
                          );
                          return;
                        }

                        if (bulkSelection.isSelectionMode) {
                          bulkSelection.toggleWithRange(client.id, { shiftKey: (event as any).shiftKey });
                          return;
                        }
                        if (rowClickTimerRef.current) {
                          window.clearTimeout(rowClickTimerRef.current);
                        }
                        rowClickTimerRef.current = window.setTimeout(() => {
                          handleOpenClientDetail(client.id);
                          rowClickTimerRef.current = null;
                        }, 220);
                      }}
                      onDoubleClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (rowClickTimerRef.current) {
                          window.clearTimeout(rowClickTimerRef.current);
                          rowClickTimerRef.current = null;
                        }
                        startEditClient(client);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'F2') {
                          e.preventDefault();
                          startEditClient(client);
                        }
                        if ((e.key === 'Enter' || e.key === ' ') && bulkSelection.isSelectionMode) {
                          e.preventDefault();
                          bulkSelection.toggle(client.id);
                        }
                      }}
                      onFocus={() => setFocusedIndex(index)}
                      data-focused={focusedIndex === index ? 'true' : undefined}
                      aria-busy={openingClientId === client.id}
                      aria-label={t.t('com.affine.caseAssistant.allMandanten.aria.row', {
                        name: client.displayName,
                      })}
                      title={t['com.affine.caseAssistant.allMandanten.row.title']()}
                    >
                      <div className={styles.selectionCell} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={styles.selectionCheckbox}
                          checked={bulkSelection.isSelected(client.id)}
                          onChange={e => {
                            bulkSelection.toggleWithRange(client.id, {
                              shiftKey: (e.nativeEvent as any).shiftKey,
                            });
                          }}
                          onClick={e => e.stopPropagation()}
                          aria-label={`Mandant auswählen: ${client.displayName}`}
                        />
                      </div>
                      <div className={styles.mandantMainCell}>
                        <div className={styles.mandantNameRow}>
                          <span
                            className={`${styles.mandantKindIcon} ${mandantKindIconStyleMap[client.kind]}`}
                            aria-hidden="true"
                          >
                            {client.kind === 'person' ? (
                              <svg viewBox="0 0 20 20" fill="none">
                                <path
                                  d="M10 9a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 10 9Zm0 1.8c-3.1 0-5.8 1.8-6.7 4.5-.2.6.2 1.2.8 1.2h11.8c.6 0 1-.6.8-1.2-.9-2.7-3.6-4.5-6.7-4.5Z"
                                  fill="currentColor"
                                />
                              </svg>
                            ) : client.kind === 'company' ? (
                              <svg viewBox="0 0 20 20" fill="none">
                                <path
                                  d="M3 16.2h14v1.2H3v-1.2Zm2-1.8h2.2V9.6H5v4.8Zm3.4 0h2.2V6.8H8.4v7.6Zm3.4 0H14V4h-2.2v10.4ZM4.2 8.2l6-3.2 5.6 2.4-.5 1.1-5.1-2.2-5.4 2.9-.6-1Z"
                                  fill="currentColor"
                                />
                              </svg>
                            ) : client.kind === 'authority' ? (
                              <svg viewBox="0 0 20 20" fill="none">
                                <path
                                  d="m10 2 7 3.2v.9c0 4.3-2.7 8.1-7 9.9-4.3-1.8-7-5.6-7-9.9v-.9L10 2Zm0 2.2L5 6.5c.1 3.3 2 6.2 5 7.7 3-1.5 4.9-4.4 5-7.7L10 4.2Z"
                                  fill="currentColor"
                                />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 20 20" fill="none">
                                <path
                                  d="M10 2.6 3.5 6.3v7.4l6.5 3.7 6.5-3.7V6.3L10 2.6Zm0 1.5 5 2.8-5 2.8-5-2.8 5-2.8Zm-5 4.1 4.4 2.5v5L5 13.2v-5Zm5.6 7.5v-5l4.4-2.5v5l-4.4 2.5Z"
                                  fill="currentColor"
                                />
                              </svg>
                            )}
                          </span>
                          <div className={styles.mandantName}>
                            {client.displayName}
                            {client.archived
                              ? t['com.affine.caseAssistant.allMandanten.meta.archivedSuffix']()
                              : ''}
                          </div>
                        </div>
                        <div className={styles.mandantSubtitle}>
                          {[client.primaryEmail, client.primaryPhone]
                            .filter(Boolean)
                            .join(' · ') ||
                            t['com.affine.caseAssistant.allMandanten.fallback.none']()}
                        </div>
                        {compliance.vollmacht !== 'na' || compliance.ausweis !== 'na' ? (
                          <div className={styles.mandantComplianceRow}>
                            {compliance.vollmacht !== 'na' ? (
                              <span
                                className={`${styles.complianceBadge} ${
                                  compliance.vollmacht === 'ok'
                                    ? styles.complianceBadgeOk
                                    : styles.complianceBadgeMissing
                                }`}
                                data-compliance-target="vollmacht"
                                title="Zum Vollmacht-Bereich öffnen"
                              >
                                Vollmacht {compliance.vollmacht === 'ok' ? 'vorhanden' : 'fehlt'}
                              </span>
                            ) : null}
                            {compliance.ausweis !== 'na' ? (
                              <span
                                className={`${styles.complianceBadge} ${
                                  compliance.ausweis === 'ok'
                                    ? styles.complianceBadgeOk
                                    : styles.complianceBadgeMissing
                                }`}
                                data-compliance-target="ausweis"
                                title="Zum Ausweis-Bereich öffnen"
                              >
                                Ausweis {compliance.ausweis === 'ok' ? 'vorhanden' : 'fehlt'}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {client.linkedMattersPreview.length > 0 ? (
                          <div className={styles.linkedMatterRow}>
                            {client.linkedMattersPreview.map((item, labelIdx) => (
                              <span
                                key={`${client.id}-matter-${labelIdx}`}
                                className={`${styles.linkedMatterBadge} ${
                                  item.status === 'open'
                                    ? styles.linkedMatterBadgeOpen
                                    : item.status === 'closed'
                                      ? styles.linkedMatterBadgeClosed
                                      : styles.linkedMatterBadgeArchived
                                }`}
                              >
                                {item.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span>
                        <span className={styles.aktenCount}>
                          {client.aktenCount}
                          {client.openAktenCount > 0
                            ? t.t('com.affine.caseAssistant.allMandanten.meta.openMatters', {
                                count: client.openAktenCount,
                              })
                            : ''}
                        </span>
                        <span className={styles.docCountText}>
                          {t.t('com.affine.caseAssistant.allMandanten.meta.documents', {
                            count: client.docCount,
                          })}
                        </span>
                      </span>
                      <span className={styles.mandantMetaHideSm}>
                        {client.nextDeadlineLabel ? (
                          <span
                            className={styles.nextDeadlineText}
                            data-urgent={client.nextDeadlineUrgent ? 'true' : 'false'}
                          >
                            {client.nextDeadlineLabel}
                          </span>
                        ) : (
                          t['com.affine.caseAssistant.allMandanten.fallback.none']()
                        )}
                      </span>
                      <span className={styles.mandantMeta}>
                        <span className={styles.mandantMetaActions}>
                          <span
                            className={[
                              styles.clientStateBadge,
                              clientState.className,
                              client.criticalAlertsCount > 0 ? styles.clientStateCriticalStrong : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {clientState.label}
                          </span>
                          <span
                            className={`${styles.kindBadge} ${kindStyleMap[client.kind]}`}
                          >
                            {kindLabel[client.kind]}
                          </span>
                          <div
                            role="button"
                            tabIndex={0}
                            className={styles.rowEditTrigger}
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (rowClickTimerRef.current) {
                                window.clearTimeout(rowClickTimerRef.current);
                                rowClickTimerRef.current = null;
                              }
                              startEditClient(client);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                startEditClient(client);
                              }
                            }}
                            aria-label={t.t('com.affine.caseAssistant.allMandanten.edit.aria.trigger', {
                              name: client.displayName,
                            })}
                            title={t['com.affine.caseAssistant.allMandanten.edit.triggerTitle']()}
                          >
                            <svg
                              className={styles.rowEditTriggerIcon}
                              viewBox="0 0 20 20"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M4 14.5V16h1.5L14 7.5l-1.5-1.5L4 14.5Zm11.7-8.8a.8.8 0 0 0 0-1.1L14.4 3.3a.8.8 0 0 0-1.1 0l-1 1 2.6 2.6 1-1Z"
                                fill="currentColor"
                              />
                            </svg>
                          </div>
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <BulkActionBar
            containerName="mandanten-body"
            selectedCount={bulkSelection.selectedCount}
            selectionLabel={`${bulkSelection.selectedCount} Mandant(en) ausgewählt`}
            isRunning={isBulkDeletingClients}
            canDelete={bulkSelection.selectedCount > 0}
            deleteLabel="Ausgewählte löschen"
            onDelete={handleBulkDeleteClients}
            onClear={bulkSelection.clear}
          />
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AllMandantenPage />;
};

export default Component;
