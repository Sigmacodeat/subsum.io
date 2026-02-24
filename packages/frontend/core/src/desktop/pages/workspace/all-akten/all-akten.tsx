import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IconButton, Menu, MenuItem, useConfirmModal, usePromptModal } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { MoreVerticalIcon } from '@blocksuite/icons/rc';

import {
  ViewBody,
  ViewIcon,
  ViewTitle,
} from '../../../../modules/workbench';
import { WorkbenchService } from '../../../../modules/workbench';
import { DocsService } from '../../../../modules/doc';
import { LegalCopilotWorkflowService } from '../../../../modules/case-assistant/services/legal-copilot-workflow';
import { CasePlatformOrchestrationService } from '../../../../modules/case-assistant/services/platform-orchestration';
import { CaseAssistantService } from '../../../../modules/case-assistant/services/case-assistant';
import { CaseAssistantStore } from '../../../../modules/case-assistant/stores/case-assistant';
import { WorkspaceService } from '../../../../modules/workspace';
import type {
  MatterRecord,
  MatterStatus,
  ClientRecord,
  CaseDeadline,
  AnwaltProfile,
} from '../../../../modules/case-assistant/types';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { createLocalRecordId } from '../detail-page/tabs/case-assistant/utils';
import { BulkActionBar } from '../layouts/bulk-action-bar';
import { useBulkSelection } from '../layouts/use-bulk-selection';
import * as styles from './all-akten.css';

type SortKey = 'updatedAt' | 'title' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';
type AktenSavedView = 'focus' | 'review' | 'archive' | 'trash' | 'custom';
type MatterStatusFilter = MatterStatus | 'all' | 'trashed';

const STATUS_ORDER: Record<MatterStatus, number> = {
  open: 0,
  closed: 1,
  archived: 2,
};

const statusLabelKey: Record<MatterStatus, string> = {
  open: 'com.affine.caseAssistant.allAkten.status.open',
  closed: 'com.affine.caseAssistant.allAkten.status.closed',
  archived: 'com.affine.caseAssistant.allAkten.status.archived',
};

const statusStyleMap: Record<MatterStatus, string> = {
  open: styles.statusOpen,
  closed: styles.statusClosed,
  archived: styles.statusArchived,
};

const sortKeyLabelKey: Record<SortKey, string> = {
  updatedAt: 'com.affine.caseAssistant.allAkten.sort.updatedAt',
  title: 'com.affine.caseAssistant.allAkten.sort.title',
  status: 'com.affine.caseAssistant.allAkten.sort.status',
  createdAt: 'com.affine.caseAssistant.allAkten.sort.createdAt',
};

function relativeTime(dateStr: string, language: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (!Number.isFinite(then)) {
    return '—';
  }

  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 1) {
    return rtf.format(0, 'minute');
  }
  if (Math.abs(diffMin) < 60) {
    return rtf.format(-diffMin, 'minute');
  }

  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) {
    return rtf.format(-diffH, 'hour');
  }

  const diffD = Math.round(diffH / 24);
  if (Math.abs(diffD) < 7) {
    return rtf.format(-diffD, 'day');
  }

  const diffW = Math.round(diffD / 7);
  if (Math.abs(diffW) < 5) {
    return rtf.format(-diffW, 'week');
  }

  const diffM = Math.round(diffD / 30);
  if (Math.abs(diffM) < 12) {
    return rtf.format(-diffM, 'month');
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateStr));
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function hoursUntil(dateStr: string): number {
  const now = Date.now();
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    target.setHours(17, 0, 0, 0);
  }
  return (target.getTime() - now) / 3600000;
}

function generateFallbackAktenzeichen(existingMatters: MatterRecord[]) {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const matter of existingMatters) {
    const ref = matter.externalRef ?? '';
    const matches = ref.match(/\b(\d{1,6})\b/g);
    if (!matches) {
      continue;
    }
    for (const value of matches) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= maxSeq || parsed > 999999) {
        continue;
      }
      maxSeq = parsed;
    }
  }
  return `AZ-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

export const AllAktenPage = () => {
  const t = useI18n();
  const store = useService(CaseAssistantStore);
  const workbench = useService(WorkbenchService).workbench;
  const workspace = useService(WorkspaceService).workspace;
  const docsService = useService(DocsService);
  const caseAssistantService = useService(CaseAssistantService);
  const legalCopilotWorkflowService = useService(LegalCopilotWorkflowService);
  const casePlatformOrchestrationService = useService(CasePlatformOrchestrationService);

  const { openConfirmModal } = useConfirmModal();
  const { openPromptModal } = usePromptModal();

  const graph = useLiveData(store.watchGraph());

  const [statusFilter, setStatusFilter] = useState<MatterStatusFilter>('all');
  const [savedView, setSavedView] = useState<AktenSavedView>('focus');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openingMatterId, setOpeningMatterId] = useState<string | null>(null);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isStartingOnboarding, setIsStartingOnboarding] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const actionStatusTimerRef = useRef<number | null>(null);
  const language = t.language || 'en';

  const statusLabel = useMemo(
    () => ({
      open: t[statusLabelKey.open](),
      closed: t[statusLabelKey.closed](),
      archived: t[statusLabelKey.archived](),
    }),
    [t]
  );

  const sortKeyLabel = useMemo(
    () => ({
      updatedAt: t[sortKeyLabelKey.updatedAt](),
      title: t[sortKeyLabelKey.title](),
      status: t[sortKeyLabelKey.status](),
      createdAt: t[sortKeyLabelKey.createdAt](),
    }),
    [t]
  );

  const matters = useMemo(() => Object.values(graph.matters ?? {}), [graph.matters]);
  const clients = useMemo(() => graph.clients ?? {}, [graph.clients]);
  const deadlines = useMemo(() => graph.deadlines ?? {}, [graph.deadlines]);
  const anwaelte = useMemo(() => (graph as any).anwaelte ?? {}, [graph]);
  const caseFiles = useMemo(() => Object.values(graph.cases ?? {}), [graph.cases]);
  const legalDocs = useLiveData(legalCopilotWorkflowService.legalDocuments$) ?? [];

  const caseToMatterMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of caseFiles) {
      if (!c.matterId) continue;
      map.set(c.id, c.matterId);
    }
    return map;
  }, [caseFiles]);

  const caseCountByMatter = useMemo(() => {
    const map = new Map<string, number>();
    for (const caseFile of caseFiles) {
      if (!caseFile.matterId) continue;
      map.set(caseFile.matterId, (map.get(caseFile.matterId) ?? 0) + 1);
    }
    return map;
  }, [caseFiles]);

  // Real document count per matter via legal docs -> caseId -> matterId mapping.
  const docCountByMatter = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of legalDocs) {
      const matterId = caseToMatterMap.get(doc.caseId);
      if (!matterId) continue;
      map.set(matterId, (map.get(matterId) ?? 0) + 1);
    }
    return map;
  }, [caseToMatterMap, legalDocs]);

  useEffect(() => {
    const t = window.setTimeout(() => setShowInitialSkeleton(false), 420);
    return () => window.clearTimeout(t);
  }, []);

  // Auto-clear actionStatus after 4 s
  const showActionStatus = useCallback((msg: string) => {
    setActionStatus(msg);
    if (actionStatusTimerRef.current) window.clearTimeout(actionStatusTimerRef.current);
    actionStatusTimerRef.current = window.setTimeout(() => setActionStatus(null), 4000);
  }, []);

  useEffect(() => () => {
    if (actionStatusTimerRef.current) window.clearTimeout(actionStatusTimerRef.current);
  }, []);

  // "/" focuses search; Escape closes context menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const statusCounts = useMemo(() => {
    const nonTrashed = matters.filter(m => !m.trashedAt);
    const nonArchived = nonTrashed.filter(m => m.status !== 'archived');
    const trashed = matters.filter(m => m.trashedAt);
    return {
      all: nonArchived.length,
      open: nonTrashed.filter(m => m.status === 'open').length,
      closed: nonTrashed.filter(m => m.status === 'closed').length,
      archived: nonTrashed.filter(m => m.status === 'archived').length,
      trashed: trashed.length,
    };
  }, [matters]);

  // Filtering
  const filtered = useMemo(() => {
    let result = matters;

    const effectiveStatusFilter =
      savedView === 'focus'
        ? 'open'
        : savedView === 'review'
          ? 'closed'
          : savedView === 'archive'
            ? 'archived'
            : savedView === 'trash'
              ? 'trashed'
            : statusFilter;

    if (effectiveStatusFilter === 'trashed') {
      result = result.filter(m => Boolean(m.trashedAt));
    } else if (effectiveStatusFilter !== 'all') {
      result = result.filter(m => m.status === effectiveStatusFilter && !m.trashedAt);
    } else {
      // Default "all" view should focus productive Akten (open + closed).
      // Archived and trashed matters stay available via dedicated filters.
      result = result.filter(m => m.status !== 'archived' && !m.trashedAt);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(m => {
        const client = clients[m.clientId];
        return (
          m.title.toLowerCase().includes(q) ||
          (m.externalRef ?? '').toLowerCase().includes(q) ||
          (m.description ?? '').toLowerCase().includes(q) ||
          (client?.displayName ?? '').toLowerCase().includes(q) ||
          (client?.primaryEmail ?? '').toLowerCase().includes(q) ||
          (m.gericht ?? '').toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [clients, matters, savedView, searchQuery, statusFilter, t]);

  const isTrashView = useMemo(
    () => savedView === 'trash' || (savedView === 'custom' && statusFilter === 'trashed'),
    [savedView, statusFilter]
  );

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title, language);
          break;
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
        default:
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, language, sortKey, sortDir]);

  const bulkSelection = useBulkSelection({
    itemIds: useMemo(() => sorted.map(m => m.id), [sorted]),
  });

  const handleBulkStatus = useCallback(
    async (newStatus: MatterStatus) => {
      const targets = sorted.filter(matter => matter.status !== newStatus);
      if (!targets.length) {
        showActionStatus(t['com.affine.caseAssistant.allAkten.bulk.empty']());
        return;
      }
      const now = new Date().toISOString();
      const results = await Promise.all(
        targets.map(matter =>
          casePlatformOrchestrationService.upsertMatter({
            ...matter,
            status: newStatus,
            updatedAt: now,
          })
        )
      );
      const succeeded = results.filter(Boolean).length;
      const failed = targets.length - succeeded;
      showActionStatus(
        failed > 0
          ? t.t('com.affine.caseAssistant.allAkten.bulk.partial', {
              successCount: succeeded,
              failedCount: failed,
              status: statusLabel[newStatus],
            })
          : t.t('com.affine.caseAssistant.allAkten.bulk.success', {
              count: targets.length,
              status: statusLabel[newStatus],
            })
      );
    },
    [casePlatformOrchestrationService, showActionStatus, sorted, statusLabel, t]
  );

  const handleScheduleDeletion = useCallback(
    async (matter: MatterRecord) => {
      const result = await casePlatformOrchestrationService.scheduleMatterDeletion(matter.id);
      if (result) {
        const purgeDate = result.purgeAt ? new Date(result.purgeAt).toLocaleDateString('de-DE') : 'unbekannt';
        showActionStatus(
          `Akte "${matter.title}" zur Löschung markiert. Wird automatisch gelöscht am ${purgeDate}.`
        );
      } else {
        showActionStatus(`Akte "${matter.title}" konnte nicht zur Löschung markiert werden.`);
      }
    },
    [casePlatformOrchestrationService, showActionStatus]
  );

  const handleRestore = useCallback(
    async (matter: MatterRecord) => {
      const result = await casePlatformOrchestrationService.restoreMatter(matter.id);
      if (result) {
        showActionStatus(`Akte "${matter.title}" wiederhergestellt.`);
      } else {
        showActionStatus(`Akte "${matter.title}" konnte nicht wiederhergestellt werden.`);
      }
    },
    [casePlatformOrchestrationService, showActionStatus]
  );


  const handleArchive = useCallback(
    async (matter: MatterRecord) => {
      const result = await casePlatformOrchestrationService.archiveMatter(matter.id);
      showActionStatus(
        result
          ? t.t('com.affine.caseAssistant.allAkten.archive.success', { title: matter.title })
          : t['com.affine.caseAssistant.allAkten.archive.failed']()
      );
    },
    [casePlatformOrchestrationService, showActionStatus, t]
  );

  const handleCreateMatter = useCallback(() => {
    if (!workspace) {
      showActionStatus('Workspace nicht bereit. Bitte erneut versuchen.');
      return;
    }

    const availableClients = Object.values(clients);
    if (availableClients.length === 0) {
      showActionStatus('Bitte zuerst einen Mandanten anlegen, bevor du eine Akte erstellst.');
      workbench.open('/all-mandanten');
      return;
    }

    const preferredClient =
      [...availableClients]
        .filter(client => !client.archived)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0] ?? availableClients[0];
    const fallbackJurisdiction =
      [...matters]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .find(matter => Boolean(matter.jurisdiction))?.jurisdiction ?? 'AT';

    openPromptModal({
      title: 'Neu+ Akte',
      label: 'Titel',
      inputOptions: {
        placeholder: 'z. B. Kündigungsschutz 2026',
      },
      confirmText: 'Akte anlegen',
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm: async rawTitle => {
        const title = rawTitle.trim();
        if (!title) {
          showActionStatus('Bitte einen Akten-Titel angeben.');
          return;
        }

        const externalRef = generateFallbackAktenzeichen(matters);
        const created = await casePlatformOrchestrationService.upsertMatter({
          id: createLocalRecordId('matter'),
          workspaceId: workspace.id,
          clientId: preferredClient.id,
          clientIds: [preferredClient.id],
          title,
          externalRef,
          jurisdiction: fallbackJurisdiction,
          status: 'open',
          tags: [],
        });

        if (!created) {
          showActionStatus(`Akte konnte nicht angelegt werden: ${title}.`);
          return;
        }

        setSavedView('focus');
        setStatusFilter('open');
        setSearchQuery('');
        showActionStatus(
          `Akte angelegt: ${created.title} (${created.externalRef ?? externalRef}) · Mandant: ${preferredClient.displayName}.`
        );
      },
    });
  }, [
    casePlatformOrchestrationService,
    clients,
    matters,
    openPromptModal,
    showActionStatus,
    t,
    workbench,
    workspace,
  ]);

  const handleConfirmScheduleDeletion = useCallback(
    (matter: MatterRecord, linkedCaseCount: number) => {
      openConfirmModal({
        title: `Akte "${matter.title}" zur Löschung markieren?`,
        description:
          `Die Akte wird archiviert und nach 90 Tagen automatisch endgültig gelöscht.` +
          (linkedCaseCount > 0
            ? ` ${t.t('com.affine.caseAssistant.allAkten.confirmDelete.description.linkedCases', {
                count: linkedCaseCount,
              })}`
            : ''),
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmText: 'Zur Löschung markieren',
        confirmButtonOptions: {
          variant: 'error',
        },
        onConfirm: async () => {
          await handleScheduleDeletion(matter);
        },
      });
    },
    [
      handleScheduleDeletion,
      openConfirmModal,
      t,
    ]
  );

  const [isBulkDeletingMatters, setIsBulkDeletingMatters] = useState(false);

  const handleBulkDeleteMatters = useCallback(() => {
    const targets = sorted.filter(m => bulkSelection.selectedIds.has(m.id));
    if (targets.length === 0) {
      showActionStatus(t['com.affine.caseAssistant.allAkten.bulk.empty']());
      return;
    }

    openConfirmModal({
      title: t.t('com.affine.caseAssistant.allAkten.confirmDelete.title', {
        title: `${targets.length} Akte(n)`,
      }),
      description:
        t['com.affine.caseAssistant.allAkten.confirmDelete.description.base']() +
        ` ${t['com.affine.caseAssistant.allAkten.bulk.delete.confirm.description.suffix']()}`,
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText: t['com.affine.caseAssistant.allAkten.confirmDelete.confirm'](),
      confirmButtonOptions: {
        variant: 'error',
      },
      onConfirm: async () => {
        if (isBulkDeletingMatters) return;
        setIsBulkDeletingMatters(true);
        try {
          const result = await casePlatformOrchestrationService.deleteMattersCascadeBulk(
            targets.map(m => m.id)
          );
          const blockedSuffix =
            result.blockedIds.length > 0
              ? t.t('com.affine.caseAssistant.allAkten.bulk.delete.result.blockedSuffix', {
                  count: result.blockedIds.length,
                })
              : '';
          const failedSuffix =
            result.failedIds.length > 0
              ? t.t('com.affine.caseAssistant.allAkten.bulk.delete.result.failedSuffix', {
                  count: result.failedIds.length,
                })
              : '';

          showActionStatus(
            t.t('com.affine.caseAssistant.allAkten.bulk.delete.result', {
              succeeded: result.succeededIds.length,
              total: result.total,
              blockedSuffix,
              failedSuffix,
            })
          );

          bulkSelection.clear();
        } finally {
          setIsBulkDeletingMatters(false);
        }
      },
    });
  }, [bulkSelection, casePlatformOrchestrationService, isBulkDeletingMatters, openConfirmModal, showActionStatus, sorted, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        handleBulkDeleteMatters();
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
  }, [bulkSelection, handleBulkDeleteMatters]);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, items: MatterRecord[]) => {
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, items.length - 1);
          const el = document.querySelector<HTMLElement>(`[data-row-index="${next}"]`);
          el?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          const el = document.querySelector<HTMLElement>(`[data-row-index="${next}"]`);
          el?.focus();
          return next;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedIndex(0);
        document.querySelector<HTMLElement>('[data-row-index="0"]')?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = items.length - 1;
        setFocusedIndex(last);
        document.querySelector<HTMLElement>(`[data-row-index="${last}"]`)?.focus();
      }
    },
    []
  );

  const handleOpenMainChat = useCallback(
    (matter: MatterRecord) => {
      setOpeningMatterId(matter.id);
      showActionStatus(
        t.t('com.affine.caseAssistant.allAkten.openMainChat.status', {
          title: matter.title,
        })
      );
      const params = new URLSearchParams({
        caMatterId: matter.id,
        caClientId: matter.clientId,
      });
      const relatedCase = [...caseFiles]
        .filter(caseFile => caseFile.matterId === matter.id)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      if (relatedCase?.id) {
        params.set('caCaseId', relatedCase.id);
      }
      workbench.open(`/chat?${params.toString()}`);
      window.setTimeout(() => {
        setOpeningMatterId(null);
      }, 300);
    },
    [caseFiles, showActionStatus, t, workbench]
  );

  const handleOpenAkteDetail = useCallback(
    (matter: MatterRecord) => {
      setOpeningMatterId(matter.id);
      showActionStatus(t.t('com.affine.caseAssistant.allAkten.openDetail.status', {
        title: matter.title,
      }));
      workbench.openAkte(matter.id);
      window.setTimeout(() => {
        setOpeningMatterId(null);
      }, 250);
    },
    [showActionStatus, t, workbench]
  );

  const shouldSkipRowOpen = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(
      target.closest(
        'button, a, input, select, textarea, [role="menuitem"], [role="menu"], [data-no-row-open="true"]'
      )
    );
  }, []);

  const handleStartDocumentsFirstOnboarding = useCallback(async () => {
    if (isStartingOnboarding) {
      return;
    }
    setIsStartingOnboarding(true);
    try {
      if (!workspace) {
        showActionStatus(t['com.affine.caseAssistant.allAkten.quickstart.workspaceNotReady']());
        return;
      }

      showActionStatus(t['com.affine.caseAssistant.allAkten.quickstart.creatingImportCase']());
      const docRecord = docsService.createDoc();
      await caseAssistantService.upsertCaseFile({
        id: docRecord.id,
        workspaceId: workspace.id,
        title: t['com.affine.caseAssistant.allAkten.quickstart.importCaseTitle'](),
        actorIds: [],
        issueIds: [],
        deadlineIds: [],
        memoryEventIds: [],
        tags: [],
      });

      workbench.openSidebar();
      workbench.open(`/${docRecord.id}?caOnboarding=documents-first`);
      showActionStatus(t['com.affine.caseAssistant.allAkten.quickstart.openedWizard']());
    } catch (error) {
      console.error('[all-akten] start onboarding failed', error);
      showActionStatus(t['com.affine.caseAssistant.allAkten.quickstart.failed']());
    } finally {
      setIsStartingOnboarding(false);
    }
  }, [
    caseAssistantService,
    docsService,
    isStartingOnboarding,
    showActionStatus,
    t,
    workbench,
    workspace,
  ]);

  const getClientName = useCallback(
    (matter: MatterRecord): string => {
      const client = clients[matter.clientId] as ClientRecord | undefined;
      return client?.displayName ?? t['com.affine.caseAssistant.allAkten.fallback.none']();
    },
    [clients, t]
  );

  const getAnwaltName = useCallback(
    (matter: MatterRecord): string => {
      if (!matter.assignedAnwaltId) return t['com.affine.caseAssistant.allAkten.fallback.none']();
      const anwalt = anwaelte[matter.assignedAnwaltId] as AnwaltProfile | undefined;
      if (!anwalt) return t['com.affine.caseAssistant.allAkten.fallback.none']();
      return `${anwalt.title ? anwalt.title + ' ' : ''}${anwalt.firstName} ${anwalt.lastName}`;
    },
    [anwaelte, t]
  );

  const getNextDeadline = useCallback(
    (
      matter: MatterRecord
    ):
      | {
          label: string;
          urgent: boolean;
          severity: 'overdue' | 'critical' | 'today' | 'soon' | 'normal';
        }
      | null => {
      const allCases = caseFiles;

      // Find all cases belonging to this matter and collect their deadline IDs
      const matterDeadlineIds = allCases
        .filter(caseFile => caseFile.matterId === matter.id)
        .flatMap(caseFile => caseFile.deadlineIds);

      // Get the actual deadlines and filter by status
      const matterDeadlines = matterDeadlineIds
        .map(deadlineId => deadlines[deadlineId])
        .filter((deadline): deadline is CaseDeadline =>
          Boolean(deadline) &&
          deadline.status !== 'completed' &&
          deadline.status !== 'expired' &&
          Boolean(deadline.dueAt)
        )
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

      if (matterDeadlines.length === 0) return null;
      const next = matterDeadlines[0];
      const days = daysUntil(next.dueAt);
      const hours = hoursUntil(next.dueAt);
      if (hours < 0) {
        return {
          label: t.t('com.affine.caseAssistant.allAkten.deadline.overdue', {
            count: Math.abs(days),
          }),
          urgent: true,
          severity: 'overdue',
        };
      }
      if (hours <= 48) {
        const roundedHours = Math.max(1, Math.ceil(hours));
        return {
          label: `in ${roundedHours} Std.`,
          urgent: true,
          severity: 'critical',
        };
      }
      if (days === 0) return { label: t['com.affine.caseAssistant.allAkten.deadline.today'](), urgent: true, severity: 'today' };
      const futureLabel = t.t('com.affine.caseAssistant.allAkten.deadline.inDays', {
        count: days,
      });
      if (days <= 3) return { label: futureLabel, urgent: true, severity: 'soon' };
      if (days <= 7) return { label: futureLabel, urgent: false, severity: 'normal' };
      return { label: futureLabel, urgent: false, severity: 'normal' };
    },
    [caseFiles, deadlines, t]
  );

  const isInitialLoading =
    showInitialSkeleton &&
    matters.length === 0 &&
    Object.keys(clients).length === 0 &&
    caseFiles.length === 0;

  const showQuickstartUpload = !isInitialLoading && matters.length > 0;

  const savedViewOptions: Array<{ key: AktenSavedView; label: string }> = [
    { key: 'focus', label: t['com.affine.caseAssistant.allAkten.view.focus']() },
    { key: 'review', label: t['com.affine.caseAssistant.allAkten.view.review']() },
    { key: 'archive', label: t['com.affine.caseAssistant.allAkten.view.archive']() },
    { key: 'trash', label: `Papierkorb (${statusCounts.trashed})` },
    {
      key: 'custom',
      label: t.t('com.affine.caseAssistant.allAkten.status.allCount', {
        count: statusCounts.all,
      }),
    },
  ];

  return (
    <>
      <ViewTitle title={t['com.affine.caseAssistant.allAkten.title']()} />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div className={styles.body}>
          {/* SR live region */}
          <div className={styles.srOnlyLive} aria-live="polite" aria-atomic="true">
            {actionStatus ?? ''}
          </div>

          {/* Filter + Search Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <label className={styles.toolbarControl}>
                <span className={styles.toolbarLabel}>Ansicht</span>
                <select
                  className={styles.toolbarSelect}
                  value={savedView}
                  onChange={event => {
                    const nextView = event.target.value as AktenSavedView;
                    setSavedView(nextView);
                    if (nextView === 'focus') {
                      setStatusFilter('open');
                    } else if (nextView === 'review') {
                      setStatusFilter('closed');
                    } else if (nextView === 'archive') {
                      setStatusFilter('archived');
                    } else if (nextView === 'trash') {
                      setStatusFilter('trashed');
                    } else {
                      setStatusFilter('all');
                    }
                  }}
                  aria-label={t['com.affine.caseAssistant.allAkten.aria.statusFilter']()}
                >
                  {savedViewOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <button
                  className={styles.filterChip}
                  data-active={statusFilter === 'all'}
                  onClick={() => {
                    setSavedView('custom');
                    setStatusFilter('all');
                  }}
                  aria-pressed={statusFilter === 'all'}
                >
                  {t.t('com.affine.caseAssistant.allAkten.status.allCount', {
                    count: statusCounts.all,
                  })}
                </button>
              </div>

              <div className={styles.filterGroupRight}>
                <button
                  className={styles.filterChip}
                  onClick={handleCreateMatter}
                  aria-label="Neue Akte anlegen"
                >
                  Neu+ Akte
                </button>
                <label className={styles.toolbarControl}>
                  <span className={styles.toolbarLabel}>{t['com.affine.caseAssistant.allAkten.toolbar.status']()}</span>
                  <select
                    className={styles.toolbarSelect}
                    value={statusFilter}
                    onChange={event => {
                      setSavedView('custom');
                      setStatusFilter(event.target.value as MatterStatusFilter);
                    }}
                    aria-label={t['com.affine.caseAssistant.allAkten.aria.statusFilter']()}
                  >
                    <option value="all">{t.t('com.affine.caseAssistant.allAkten.status.allCount', { count: statusCounts.all })}</option>
                    <option value="open">{t.t('com.affine.caseAssistant.allAkten.status.openCount', { count: statusCounts.open })}</option>
                    <option value="closed">{t.t('com.affine.caseAssistant.allAkten.status.closedCount', { count: statusCounts.closed })}</option>
                    <option value="archived">{t.t('com.affine.caseAssistant.allAkten.status.archivedCount', { count: statusCounts.archived })}</option>
                    <option value="trashed">Papierkorb ({statusCounts.trashed})</option>
                  </select>
                </label>
                <label className={styles.toolbarControl}>
                  <span className={styles.toolbarLabel}>{t['com.affine.caseAssistant.allAkten.toolbar.sort']()}</span>
                  <select
                    className={styles.toolbarSelect}
                    value={sortKey}
                    onChange={event => setSortKey(event.target.value as SortKey)}
                    aria-label={t['com.affine.caseAssistant.allAkten.aria.sortField']()}
                  >
                    <option value="updatedAt">{sortKeyLabel.updatedAt}</option>
                    <option value="title">{sortKeyLabel.title}</option>
                    <option value="status">{sortKeyLabel.status}</option>
                    <option value="createdAt">{sortKeyLabel.createdAt}</option>
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.toolbarSortDirectionButton}
                  onClick={() => setSortDir(current => (current === 'desc' ? 'asc' : 'desc'))}
                  data-dir={sortDir}
                  aria-label={
                    sortDir === 'desc'
                      ? t['com.affine.caseAssistant.allAkten.aria.sortDirection.descToAsc']()
                      : t['com.affine.caseAssistant.allAkten.aria.sortDirection.ascToDesc']()
                  }
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
                {sorted.length > 0 ? (
                  savedView === 'custom' || savedView === 'trash' ? (
                    <>
                      {!isTrashView ? (
                        <>
                          <button
                            className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                            onClick={() => void handleBulkStatus('open')}
                          >
                            {t['com.affine.caseAssistant.allAkten.bulk.toOpen']()}
                          </button>
                          <button
                            className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                            onClick={() => void handleBulkStatus('archived')}
                          >
                            {t['com.affine.caseAssistant.allAkten.bulk.toArchived']()}
                          </button>
                        </>
                      ) : (
                        <button
                          className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                          onClick={async () => {
                            const targets = sorted.filter(m => bulkSelection.selectedIds.has(m.id) && m.trashedAt);
                            if (targets.length === 0) {
                              showActionStatus('Keine zur Löschung markierten Akten ausgewählt.');
                              return;
                            }
                            const result = await casePlatformOrchestrationService.restoreMattersBulk(
                              targets.map(m => m.id)
                            );
                            showActionStatus(
                              `${result.succeededIds.length} von ${result.total} Akte(n) wiederhergestellt.`
                            );
                            bulkSelection.clear();
                          }}
                        >
                          Wiederherstellen
                        </button>
                      )}
                      <button
                        className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                        onClick={handleBulkDeleteMatters}
                        disabled={isBulkDeletingMatters}
                        aria-disabled={isBulkDeletingMatters}
                      >
                        {t['com.affine.caseAssistant.allAkten.bulk.deletePermanent']()}
                      </button>
                    </>
                  ) : null
                ) : null}
                <div className={styles.searchWrap}>
                  <input
                    ref={searchInputRef}
                    className={styles.searchInput}
                    type="text"
                    placeholder={t['com.affine.caseAssistant.allAkten.search.placeholder']()}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label={t['com.affine.caseAssistant.allAkten.aria.search']()}
                  />
                  {searchQuery ? (
                    <button
                      className={styles.searchClear}
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label={t['com.affine.caseAssistant.allAkten.aria.clearSearch']()}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {showQuickstartUpload ? (
            <div className={styles.quickstartRow}>
              <div className={styles.quickstartCard} role="region" aria-label={t['com.affine.caseAssistant.allAkten.quickstart.regionAria']()}>
                <div className={styles.quickstartText}>
                  <div className={styles.quickstartTitle}>{t['com.affine.caseAssistant.allAkten.quickstart.title']()}</div>
                  <div className={styles.quickstartDescription}>
                    {t['com.affine.caseAssistant.allAkten.quickstart.description']()}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.quickstartButton}
                  onClick={() => {
                    void handleStartDocumentsFirstOnboarding();
                  }}
                  disabled={isStartingOnboarding}
                  aria-label={t['com.affine.caseAssistant.allAkten.quickstart.button.aria']()}
                >
                  {isStartingOnboarding
                    ? t['com.affine.caseAssistant.allAkten.quickstart.button.starting']()
                    : t['com.affine.caseAssistant.allAkten.quickstart.button.default']()}
                </button>
              </div>
            </div>
          ) : null}

          {/* Action status toast */}
          {actionStatus ? (
            <div className={styles.actionStatus}>
              {actionStatus}
            </div>
          ) : null}

          {/* Table */}
          <div className={styles.scrollArea}>
            <div
              className={styles.listContainer}
              role="grid"
              aria-label={t['com.affine.caseAssistant.allAkten.aria.grid']()}
              onKeyDown={e => handleListKeyDown(e, sorted)}
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
                    aria-label="Alle sichtbaren Akten auswählen"
                  />
                </span>
                <span className={styles.sortButton} role="columnheader">
                  {t['com.affine.caseAssistant.allAkten.header.caseAndClient']()}
                </span>
                <span className={`${styles.sortButton} ${styles.akteMeta}`} role="columnheader">
                  {t['com.affine.caseAssistant.allAkten.header.updatedAt']()}
                </span>
                <span className={styles.akteMeta} role="columnheader">{t['com.affine.caseAssistant.allAkten.header.lawyer']()}</span>
                <span className={styles.akteMetaHideSm} role="columnheader">{t['com.affine.caseAssistant.allAkten.header.deadline']()}</span>
                <span className={styles.sortButton} role="columnheader">
                  {t['com.affine.caseAssistant.allAkten.header.status']()}
                </span>
                <span className={styles.akteMeta} role="columnheader" aria-hidden="true" />
              </div>

              {isInitialLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div key={`akten-skeleton-${index}`} className={styles.skeletonRow} role="row" aria-hidden="true" />
                ))
              ) : sorted.length === 0 ? (
                <div className={styles.emptyState} role="row">
                  <div className={styles.emptyTitle}>
                    {searchQuery || statusFilter !== 'all'
                      ? t['com.affine.caseAssistant.allAkten.empty.filtered.title']()
                      : t['com.affine.caseAssistant.allAkten.empty.initial.title']()}
                  </div>
                  <div className={styles.emptyDescription}>
                    {searchQuery || statusFilter !== 'all'
                      ? t['com.affine.caseAssistant.allAkten.empty.filtered.description']()
                      : t['com.affine.caseAssistant.allAkten.empty.initial.description']()}
                  </div>
                  <button
                    type="button"
                    className={styles.filterChip}
                    onClick={handleCreateMatter}
                    aria-label="Neue Akte anlegen"
                  >
                    Neu+ Akte
                  </button>
                </div>
              ) : (
                sorted.map((matter, index) => {
                  const deadline = getNextDeadline(matter);
                  const caseCount = caseCountByMatter.get(matter.id) ?? 0;
                  const docCount = docCountByMatter.get(matter.id) ?? 0;
                  return (
                    <div
                      key={matter.id}
                      role="row"
                      data-row-index={index}
                      className={[
                        styles.akteRow,
                        openingMatterId === matter.id ? styles.akteRowOpening : '',
                        matter.trashedAt
                          ? styles.akteRowTrashed
                          : deadline?.severity === 'overdue'
                            ? styles.akteRowOverdue
                            : deadline?.severity === 'critical'
                              ? styles.akteRowCritical
                            : deadline?.severity === 'today'
                              ? styles.akteRowToday
                              : deadline?.severity === 'soon'
                                ? styles.akteRowSoon
                                : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      tabIndex={0}
                      onClick={event => {
                        if (shouldSkipRowOpen(event.target)) {
                          return;
                        }
                        if (bulkSelection.isSelectionMode) {
                          bulkSelection.toggleWithRange(matter.id, { shiftKey: (event as any).shiftKey });
                          return;
                        }
                        handleOpenAkteDetail(matter);
                      }}
                      onFocus={() => setFocusedIndex(index)}
                      data-focused={focusedIndex === index ? 'true' : undefined}
                      onKeyDown={e => {
                        if (shouldSkipRowOpen(e.target)) {
                          return;
                        }
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (bulkSelection.isSelectionMode) {
                            bulkSelection.toggle(matter.id);
                          } else {
                            handleOpenAkteDetail(matter);
                          }
                        }
                      }}
                      aria-busy={openingMatterId === matter.id}
                      aria-label={t.t('com.affine.caseAssistant.allAkten.aria.row', {
                        title: matter.title,
                        status: statusLabel[matter.status],
                      })}
                    >
                      <div className={styles.selectionCell} data-no-row-open="true">
                        <input
                          type="checkbox"
                          className={styles.selectionCheckbox}
                          checked={bulkSelection.isSelected(matter.id)}
                          onChange={e => {
                            bulkSelection.toggleWithRange(matter.id, {
                              shiftKey: (e.nativeEvent as any).shiftKey,
                            });
                          }}
                          onClick={e => {
                            e.stopPropagation();
                          }}
                          aria-label={`Akte auswählen: ${matter.title}`}
                        />
                      </div>
                      <div>
                        <div className={styles.akteTitle}>
                          {matter.externalRef ? `${matter.externalRef} — ` : ''}
                          {matter.title}
                        </div>
                        <div className={styles.akteSubtitle}>
                          {getClientName(matter)}
                          {matter.gericht ? ` · ${matter.gericht}` : ''}
                        </div>
                        <div className={styles.akteFolderMeta}>
                          <span className={styles.akteFolderMetaBadge}>
                            {t.t('com.affine.caseAssistant.allAkten.meta.caseFiles', {
                              count: caseCount,
                            })}
                          </span>
                          <span className={styles.akteFolderMetaBadge}>
                            {t.t('com.affine.caseAssistant.allAkten.meta.documents', {
                              count: docCount,
                            })}
                          </span>
                          {matter.trashedAt && matter.purgeAt ? (
                            <span
                              className={styles.akteFolderMetaBadge}
                              data-alert="true"
                              title={`Wird gelöscht am ${new Date(matter.purgeAt).toLocaleDateString('de-DE')}`}
                            >
                              🗑️ Löschen am {new Date(matter.purgeAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                            </span>
                          ) : deadline ? (
                            <span
                              className={styles.akteFolderMetaBadge}
                              data-alert={deadline.urgent ? 'true' : undefined}
                              data-critical={
                                deadline.severity === 'critical' || deadline.severity === 'overdue'
                                  ? 'true'
                                  : undefined
                              }
                            >
                              {deadline.urgent
                                ? t['com.affine.caseAssistant.allAkten.meta.alertPrefix']()
                                : t['com.affine.caseAssistant.allAkten.meta.deadlinePrefix']()}
                              {deadline.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className={styles.akteMeta}>
                        {relativeTime(matter.updatedAt, language)}
                      </span>
                      <span className={styles.akteMeta}>
                        {getAnwaltName(matter)}
                      </span>
                      <span className={styles.akteMetaHideSm}>
                        {deadline ? (
                          <span
                            className={[
                              deadline.urgent ? styles.deadlineBadge : '',
                              deadline.severity === 'critical' || deadline.severity === 'overdue'
                                ? styles.deadlineBadgeCritical
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {deadline.label}
                          </span>
                        ) : (
                          t['com.affine.caseAssistant.allAkten.fallback.none']()
                        )}
                      </span>
                      <span>
                        <span
                          className={`${styles.statusBadge} ${statusStyleMap[matter.status]}`}
                        >
                          {statusLabel[matter.status]}
                        </span>
                      </span>
                      <div className={styles.actionsCell} data-no-row-open="true">
                        <Menu
                          items={
                            <>
                              <MenuItem
                                onClick={() => handleOpenMainChat(matter)}
                              >
                                {t['com.affine.caseAssistant.allAkten.menu.openMainChat']()}
                              </MenuItem>
                              {matter.trashedAt ? (
                                <MenuItem
                                  onClick={() => void handleRestore(matter)}
                                >
                                  Wiederherstellen
                                </MenuItem>
                              ) : (
                                <>
                                  <MenuItem
                                    onClick={() => void handleArchive(matter)}
                                    disabled={matter.status === 'archived'}
                                  >
                                    {t['com.affine.caseAssistant.allAkten.menu.archive']()}
                                  </MenuItem>
                                  <MenuItem
                                    type="danger"
                                    onClick={() => handleConfirmScheduleDeletion(matter, caseCount)}
                                  >
                                    Zur Löschung markieren
                                  </MenuItem>
                                </>
                              )}
                            </>
                          }
                          contentOptions={{
                            align: 'end',
                          }}
                        >
                          <IconButton
                            aria-label={t.t('com.affine.caseAssistant.allAkten.aria.actions', {
                              title: matter.title,
                            })}
                            onClick={e => {
                              e.stopPropagation();
                            }}
                            onMouseDown={e => {
                              e.stopPropagation();
                            }}
                          >
                            <MoreVerticalIcon />
                          </IconButton>
                        </Menu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <BulkActionBar
            containerName="akten-body"
            selectedCount={bulkSelection.selectedCount}
            selectionLabel={`${bulkSelection.selectedCount} Akte(n) ausgewählt`}
            isRunning={isBulkDeletingMatters}
            canDelete={bulkSelection.selectedCount > 0}
            deleteLabel="Ausgewählte löschen"
            onDelete={handleBulkDeleteMatters}
            onClear={bulkSelection.clear}
          />
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AllAktenPage />;
};

export default Component;
