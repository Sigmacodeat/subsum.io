import { useConfirmModal, usePromptModal } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { CasePlatformOrchestrationService } from '../../../../modules/case-assistant/services/platform-orchestration';
import { CaseAssistantStore } from '../../../../modules/case-assistant/stores/case-assistant';
import type {
  CaseDeadline,
  ClientRecord,
  MatterRecord,
} from '../../../../modules/case-assistant/types';
import { AuthService } from '../../../../modules/cloud/services/auth';
import { ViewBody, ViewIcon, ViewTitle } from '../../../../modules/workbench';
import { WorkbenchService } from '../../../../modules/workbench';
import { createLocalRecordId } from '../detail-page/tabs/case-assistant/utils';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { BulkActionBar } from '../layouts/bulk-action-bar';
import { useBulkSelection } from '../layouts/use-bulk-selection';
import * as styles from './all-fristen.css';

type DeadlineStatus = CaseDeadline['status'];
type UrgencyLevel =
  | 'overdue'
  | 'critical'
  | 'today'
  | 'soon'
  | 'upcoming'
  | 'future';
type FilterMode =
  | 'all'
  | 'overdue'
  | 'today_week'
  | 'completed'
  | 'needs_review'
  | 'low_confidence';
type SortKey = 'dueAt' | 'title' | 'status' | 'confidence';
type SortDir = 'asc' | 'desc';
type FristenSavedView = 'critical' | 'week' | 'done' | 'all' | 'custom';

const sortKeyLabelKey: Record<SortKey, string> = {
  dueAt: 'com.affine.caseAssistant.allFristen.sort.dueAt',
  title: 'com.affine.caseAssistant.allFristen.sort.title',
  status: 'com.affine.caseAssistant.allFristen.sort.status',
  confidence: 'com.affine.caseAssistant.allFristen.sort.confidence',
};

const DETECTION_QUALITY_EXPLANATION_KEY =
  'com.affine.caseAssistant.allFristen.detectionQuality.explanation';

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function toDateKey(value?: string | null): string {
  if (!value) return '';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return '';
  return parsed.format('YYYY-MM-DD');
}

function hoursUntil(dateStr: string): number {
  const now = Date.now();
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  return (target.getTime() - now) / 3600000;
}

function getUrgencyLevel(
  days: number,
  hours: number,
  status: DeadlineStatus
): UrgencyLevel {
  if (status === 'completed' || status === 'expired') return 'future';
  if (hours < 0) return 'overdue';
  if (hours <= 48) return 'critical';
  if (days === 0) return 'today';
  if (days <= 7) return 'soon';
  if (days <= 30) return 'upcoming';
  return 'future';
}

function formatDueDate(
  dateStr: string,
  language: string,
  t: ReturnType<typeof useI18n>
): string {
  const days = daysUntil(dateStr);
  if (days < -1)
    return t.t('com.affine.caseAssistant.allFristen.dueDate.overdueDays', {
      count: Math.abs(days),
    });
  if (days === -1)
    return t['com.affine.caseAssistant.allFristen.dueDate.overdueYesterday']();
  if (days === 0)
    return t['com.affine.caseAssistant.allFristen.dueDate.today']();
  if (days === 1)
    return t['com.affine.caseAssistant.allFristen.dueDate.tomorrow']();
  if (days <= 7)
    return t.t('com.affine.caseAssistant.allFristen.dueDate.inDays', {
      count: days,
    });
  return new Date(dateStr).toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatConfidence(confidence?: number): string {
  if (!Number.isFinite(confidence)) {
    return '—';
  }
  const normalized = Math.max(0, Math.min(1, confidence ?? 0));
  return `${Math.round(normalized * 100)}%`;
}

function confidenceTone(confidence?: number): 'high' | 'medium' | 'low' {
  if (!Number.isFinite(confidence)) {
    return 'low';
  }
  if ((confidence ?? 0) >= 0.85) {
    return 'high';
  }
  if ((confidence ?? 0) >= 0.7) {
    return 'medium';
  }
  return 'low';
}

function shouldShowDetectionQuality(
  deadline: Pick<
    CaseDeadline,
    'derivedFrom' | 'sourceDocIds' | 'requiresReview'
  >
): boolean {
  if (deadline.derivedFrom && deadline.derivedFrom !== 'manual') {
    return true;
  }
  if ((deadline.sourceDocIds?.length ?? 0) > 0) {
    return true;
  }
  return Boolean(deadline.requiresReview);
}

function formatReviewedAt(value: string | undefined, language: string): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface EnrichedDeadline extends CaseDeadline {
  matterTitle: string;
  matterExternalRef: string;
  clientName: string;
  clientId: string;
  matterId: string;
  caseFileId: string;
  urgency: UrgencyLevel;
  daysRemaining: number;
  matterStatus?: MatterRecord['status'];
  matterTrashedAt?: string;
}

export const AllFristenPage = () => {
  const t = useI18n();
  const location = useLocation();
  const store = useService(CaseAssistantStore);
  const casePlatformOrchestrationService = useService(
    CasePlatformOrchestrationService
  );
  const workbench = useService(WorkbenchService).workbench;
  const { openPromptModal } = usePromptModal();
  const { openConfirmModal } = useConfirmModal();
  const authService = useService(AuthService);
  const currentUser = useLiveData(authService.session.account$);
  const graph = useLiveData(store.watchGraph());
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const deepLinkMatterId = query.get('matterId')?.trim() ?? '';
  const deepLinkClientId = query.get('clientId')?.trim() ?? '';

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [savedView, setSavedView] = useState<FristenSavedView>('critical');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('dueAt');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    dayjs().format('YYYY-MM-DD')
  );
  const [isCalendarDayFilterActive, setIsCalendarDayFilterActive] =
    useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const actionStatusTimerRef = useRef<number | null>(null);
  const orphanCleanupInFlightRef = useRef(false);
  const orphanCleanupSignatureRef = useRef('');
  const language = t.language || 'en';

  const sortKeyLabel = useMemo(
    () => ({
      dueAt: t[sortKeyLabelKey.dueAt](),
      title: t[sortKeyLabelKey.title](),
      status: t[sortKeyLabelKey.status](),
      confidence: t[sortKeyLabelKey.confidence](),
    }),
    [t]
  );

  const statusLabel = useMemo<Record<DeadlineStatus, string>>(
    () => ({
      open: t['com.affine.caseAssistant.allFristen.status.open'](),
      alerted: t['com.affine.caseAssistant.allFristen.status.alerted'](),
      acknowledged:
        t['com.affine.caseAssistant.allFristen.status.acknowledged'](),
      completed: t['com.affine.caseAssistant.allFristen.status.completed'](),
      expired: t['com.affine.caseAssistant.allFristen.status.expired'](),
    }),
    [t]
  );

  const statusClass = useMemo<Record<DeadlineStatus, string>>(
    () => ({
      open: styles.statusPending,
      alerted: styles.statusPending,
      acknowledged: styles.statusPending,
      completed: styles.statusCompleted,
      expired: styles.statusExpired,
    }),
    []
  );

  const showActionStatus = useCallback((msg: string) => {
    setActionStatus(msg);
    if (actionStatusTimerRef.current)
      window.clearTimeout(actionStatusTimerRef.current);
    actionStatusTimerRef.current = window.setTimeout(
      () => setActionStatus(null),
      4000
    );
  }, []);

  useEffect(
    () => () => {
      if (actionStatusTimerRef.current)
        window.clearTimeout(actionStatusTimerRef.current);
    },
    []
  );

  // "/" focuses search
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

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, items: EnrichedDeadline[]) => {
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, items.length - 1);
          document
            .querySelector<HTMLElement>(`[data-frist-row-index="${next}"]`)
            ?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          document
            .querySelector<HTMLElement>(`[data-frist-row-index="${next}"]`)
            ?.focus();
          return next;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedIndex(0);
        document
          .querySelector<HTMLElement>('[data-frist-row-index="0"]')
          ?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = items.length - 1;
        setFocusedIndex(last);
        document
          .querySelector<HTMLElement>(`[data-frist-row-index="${last}"]`)
          ?.focus();
      }
    },
    []
  );

  const allDeadlines = useMemo(
    () => Object.values(graph.deadlines ?? {}),
    [graph.deadlines]
  );
  const allMatters = useMemo(
    () => Object.values(graph.matters ?? {}),
    [graph.matters]
  );
  const allClients = useMemo(() => graph.clients ?? {}, [graph.clients]);
  const caseFiles = useMemo(
    () => Object.values(graph.cases ?? {}),
    [graph.cases]
  );
  const legalDocuments = useLiveData(store.watchLegalDocuments()) ?? [];

  useEffect(() => {
    const t = window.setTimeout(() => setShowInitialSkeleton(false), 420);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!deepLinkMatterId && !deepLinkClientId) return;
    setSavedView('custom');
    setFilterMode('all');
  }, [deepLinkMatterId, deepLinkClientId]);

  // Build matter map and deadline → case/matter lookup
  const matterMap = useMemo(
    () => new Map<string, MatterRecord>(allMatters.map(m => [m.id, m])),
    [allMatters]
  );

  const deadlineCaseMap = useMemo(() => {
    const map = new Map<string, { caseFileId: string; matterId: string }>();
    for (const c of caseFiles) {
      for (const dId of c.deadlineIds ?? []) {
        map.set(dId, { caseFileId: c.id, matterId: c.matterId ?? '' });
      }
    }
    return map;
  }, [caseFiles]);

  const activeDocumentIds = useMemo(() => {
    return new Set(
      legalDocuments.filter(doc => !doc.trashedAt).map(doc => doc.id)
    );
  }, [legalDocuments]);

  const activeDocumentCountByCaseId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of legalDocuments) {
      if (doc.trashedAt) continue;
      counts.set(doc.caseId, (counts.get(doc.caseId) ?? 0) + 1);
    }
    return counts;
  }, [legalDocuments]);

  useEffect(() => {
    if (orphanCleanupInFlightRef.current) {
      return;
    }

    const orphanDeadlineIds = allDeadlines
      .filter(deadline => {
        const ctx = deadlineCaseMap.get(deadline.id);
        if (!ctx?.caseFileId) {
          return true;
        }

        const linkedDocIds = (deadline.sourceDocIds ?? []).filter(Boolean);
        if (linkedDocIds.length === 0) {
          return true;
        }

        const hasActiveLinkedDoc = linkedDocIds.some(docId =>
          activeDocumentIds.has(docId)
        );
        if (!hasActiveLinkedDoc) {
          return true;
        }

        return (activeDocumentCountByCaseId.get(ctx.caseFileId) ?? 0) <= 0;
      })
      .map(deadline => deadline.id)
      .sort();

    if (orphanDeadlineIds.length === 0) {
      orphanCleanupSignatureRef.current = '';
      return;
    }

    const signature = orphanDeadlineIds.join('|');
    if (orphanCleanupSignatureRef.current === signature) {
      return;
    }
    orphanCleanupSignatureRef.current = signature;

    orphanCleanupInFlightRef.current = true;
    (async () => {
      try {
        let removed = 0;
        for (const deadlineId of orphanDeadlineIds) {
          const ok =
            await casePlatformOrchestrationService.deleteDeadlineCascade(
              deadlineId
            );
          if (ok) {
            removed += 1;
          }
        }
        if (removed > 0) {
          showActionStatus(
            t.t('com.affine.caseAssistant.allFristen.feedback.orphanCleanup', {
              count: removed,
            })
          );
        }
      } finally {
        orphanCleanupInFlightRef.current = false;
      }
    })().catch(console.error);
  }, [
    activeDocumentCountByCaseId,
    activeDocumentIds,
    allDeadlines,
    casePlatformOrchestrationService,
    deadlineCaseMap,
    showActionStatus,
  ]);

  // Enrich deadlines
  const enrichedDeadlines: EnrichedDeadline[] = useMemo(() => {
    return allDeadlines
      .filter(d => {
        const ctx = deadlineCaseMap.get(d.id);
        if (!ctx?.caseFileId) {
          return false;
        }

        // Product rule: deadlines are only valid if they are linked to existing documents.
        const linkedDocIds = (d.sourceDocIds ?? []).filter(Boolean);
        if (linkedDocIds.length === 0) {
          return false;
        }

        const hasAtLeastOneLinkedDocument = linkedDocIds.some(docId =>
          activeDocumentIds.has(docId)
        );
        if (!hasAtLeastOneLinkedDocument) {
          return false;
        }

        return (activeDocumentCountByCaseId.get(ctx.caseFileId) ?? 0) > 0;
      })
      .map(d => {
        const ctx = deadlineCaseMap.get(d.id);
        const matter = ctx?.matterId ? matterMap.get(ctx.matterId) : undefined;
        const client = matter?.clientId
          ? (allClients[matter.clientId] as ClientRecord | undefined)
          : undefined;
        const days = d.dueAt ? daysUntil(d.dueAt) : 9999;
        const hours = d.dueAt ? hoursUntil(d.dueAt) : Number.POSITIVE_INFINITY;
        return {
          ...d,
          matterTitle: matter?.title ?? '',
          matterExternalRef: matter?.externalRef ?? '',
          clientName: client?.displayName ?? '',
          clientId: client?.id ?? '',
          matterId: ctx?.matterId ?? '',
          caseFileId: ctx?.caseFileId ?? '',
          urgency: getUrgencyLevel(days, hours, d.status),
          daysRemaining: days,
          matterStatus: matter?.status,
          matterTrashedAt: matter?.trashedAt,
        };
      });
  }, [
    activeDocumentCountByCaseId,
    activeDocumentIds,
    allClients,
    allDeadlines,
    deadlineCaseMap,
    matterMap,
  ]);

  // Stats
  const stats = useMemo(() => {
    const active = enrichedDeadlines.filter(
      d => d.status !== 'completed' && d.status !== 'expired'
    );
    const overdue = active.filter(d => d.daysRemaining < 0).length;
    const today = active.filter(d => d.daysRemaining === 0).length;
    const thisWeek = active.filter(
      d => d.daysRemaining > 0 && d.daysRemaining <= 7
    ).length;
    const total = enrichedDeadlines.length;
    const completed = enrichedDeadlines.filter(
      d => d.status === 'completed'
    ).length;
    const needsReview = active.filter(
      deadline => deadline.requiresReview
    ).length;
    const lowConfidence = active.filter(
      deadline =>
        Number.isFinite(deadline.detectionConfidence) &&
        (deadline.detectionConfidence ?? 1) < 0.7
    ).length;
    return {
      total,
      overdue,
      today,
      thisWeek,
      completed,
      active: active.length,
      needsReview,
      lowConfidence,
    };
  }, [enrichedDeadlines]);

  const calendarDayMeta = useMemo(() => {
    const map = new Map<string, { count: number; criticalCount: number }>();
    const filteredByContext = enrichedDeadlines.filter(deadline => {
      if (!deepLinkMatterId && deadline.matterId) {
        if (deadline.matterTrashedAt) return false;
        if (deadline.matterStatus === 'archived') return false;
      }
      if (deepLinkMatterId && deadline.matterId !== deepLinkMatterId)
        return false;
      if (deepLinkClientId && deadline.clientId !== deepLinkClientId)
        return false;
      return true;
    });

    for (const deadline of filteredByContext) {
      const key = toDateKey(deadline.dueAt);
      if (!key) continue;
      const prev = map.get(key) ?? { count: 0, criticalCount: 0 };
      map.set(key, {
        count: prev.count + 1,
        criticalCount:
          prev.criticalCount +
          (deadline.urgency === 'critical' || deadline.urgency === 'overdue'
            ? 1
            : 0),
      });
    }

    return map;
  }, [deepLinkClientId, deepLinkMatterId, enrichedDeadlines]);

  const selectedDayMeta = useMemo(() => {
    return (
      calendarDayMeta.get(selectedDateKey) ?? { count: 0, criticalCount: 0 }
    );
  }, [calendarDayMeta, selectedDateKey]);

  const selectedDateLabel = useMemo(() => {
    const parsed = dayjs(selectedDateKey);
    if (!parsed.isValid()) return selectedDateKey;
    return parsed.locale(language).format('ddd, DD.MM.YYYY');
  }, [language, selectedDateKey]);

  const handleJumpToToday = useCallback(() => {
    const todayKey = dayjs().format('YYYY-MM-DD');
    setSelectedDateKey(todayKey);
    setIsCalendarDayFilterActive(true);
    setSavedView('custom');
    setFilterMode('all');
  }, []);

  const effectiveFilterMode: FilterMode =
    savedView === 'critical'
      ? 'overdue'
      : savedView === 'week'
        ? 'today_week'
        : savedView === 'done'
          ? 'completed'
          : savedView === 'all'
            ? 'all'
            : filterMode;

  // Filtering
  const filtered = useMemo(() => {
    let result = enrichedDeadlines;

    // Kanzlei-Logik: Fristen bleiben erhalten, aber bei archivierten/gelöschten Akten
    // werden sie aus produktiven Views ausgeblendet (Restore → wieder sichtbar).
    // Deep-Link auf eine konkrete Akte soll trotzdem alle zeigen.
    if (!deepLinkMatterId) {
      result = result.filter(d => {
        if (!d.matterId) return true;
        if (d.matterTrashedAt) return false;
        if (d.matterStatus === 'archived') return false;
        return true;
      });
    }

    if (isCalendarDayFilterActive) {
      result = result.filter(d => toDateKey(d.dueAt) === selectedDateKey);
    } else {
      switch (effectiveFilterMode) {
        case 'overdue':
          result = result.filter(
            d =>
              d.daysRemaining < 0 &&
              d.status !== 'completed' &&
              d.status !== 'expired'
          );
          break;
        case 'today_week':
          result = result.filter(
            d =>
              d.daysRemaining >= 0 &&
              d.daysRemaining <= 7 &&
              d.status !== 'completed' &&
              d.status !== 'expired'
          );
          break;
        case 'completed':
          result = result.filter(
            d => d.status === 'completed' || d.status === 'expired'
          );
          break;
        case 'needs_review':
          result = result.filter(
            d =>
              d.status !== 'completed' &&
              d.status !== 'expired' &&
              Boolean(d.requiresReview)
          );
          break;
        case 'low_confidence':
          result = result.filter(
            d =>
              d.status !== 'completed' &&
              d.status !== 'expired' &&
              Number.isFinite(d.detectionConfidence) &&
              (d.detectionConfidence ?? 1) < 0.7
          );
          break;
        case 'all':
        default:
          break;
      }
    }

    if (deepLinkMatterId) {
      result = result.filter(d => d.matterId === deepLinkMatterId);
    }
    if (deepLinkClientId) {
      result = result.filter(d => d.clientId === deepLinkClientId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        d =>
          d.title.toLowerCase().includes(q) ||
          d.matterTitle.toLowerCase().includes(q) ||
          d.matterExternalRef.toLowerCase().includes(q) ||
          d.clientName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [
    deepLinkClientId,
    deepLinkMatterId,
    effectiveFilterMode,
    enrichedDeadlines,
    isCalendarDayFilterActive,
    searchQuery,
    selectedDateKey,
  ]);

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
          cmp = a.status.localeCompare(b.status, language);
          break;
        case 'confidence':
          cmp = (a.detectionConfidence ?? -1) - (b.detectionConfidence ?? -1);
          break;
        case 'dueAt':
        default:
          cmp = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, language, sortKey, sortDir]);

  const reviewCandidateIds = useMemo(
    () =>
      sorted
        .filter(
          deadline =>
            deadline.status !== 'completed' &&
            deadline.status !== 'expired' &&
            Boolean(deadline.requiresReview)
        )
        .map(deadline => deadline.id),
    [sorted]
  );

  const bulkSelection = useBulkSelection({
    itemIds: useMemo(() => sorted.map(d => d.id), [sorted]),
  });

  const [isBulkCompleting, setIsBulkCompleting] = useState(false);
  const [isBulkReviewing, setIsBulkReviewing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkMarkCompleted = useCallback(async () => {
    const targets = sorted.filter(
      deadline =>
        bulkSelection.selectedIds.has(deadline.id) &&
        deadline.status !== 'completed' &&
        deadline.status !== 'expired'
    );
    if (!targets.length) {
      showActionStatus(t['com.affine.caseAssistant.allFristen.bulk.empty']());
      return;
    }

    openConfirmModal({
      title:
        t['com.affine.caseAssistant.allFristen.modal.bulkCompleted.title'](),
      description: t.t(
        'com.affine.caseAssistant.allFristen.modal.bulkCompleted.description',
        {
          count: targets.length,
        }
      ),
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText:
        t['com.affine.caseAssistant.allFristen.modal.bulkCompleted.confirm'](),
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm: async () => {
        if (isBulkCompleting) return;
        setIsBulkCompleting(true);
        try {
          const results = await Promise.all(
            targets.map(deadline => {
              return casePlatformOrchestrationService.markDeadlineCompleted(
                deadline.id
              );
            })
          );
          const succeeded = results.filter(Boolean).length;
          const failed = targets.length - succeeded;
          showActionStatus(
            failed > 0
              ? t.t('com.affine.caseAssistant.allFristen.bulk.partial', {
                  successCount: succeeded,
                  failedCount: failed,
                })
              : t.t('com.affine.caseAssistant.allFristen.bulk.success', {
                  count: targets.length,
                })
          );
          bulkSelection.clear();
        } finally {
          setIsBulkCompleting(false);
        }
      },
    });
  }, [
    bulkSelection,
    casePlatformOrchestrationService,
    graph.deadlines,
    isBulkCompleting,
    openConfirmModal,
    showActionStatus,
    sorted,
    t,
  ]);

  const handleMarkDeadlineCompleted = useCallback(
    async (deadline: EnrichedDeadline) => {
      openPromptModal({
        title:
          t[
            'com.affine.caseAssistant.allFristen.modal.externalCompleted.title'
          ](),
        label:
          t[
            'com.affine.caseAssistant.allFristen.modal.externalCompleted.label'
          ](),
        inputOptions: {
          placeholder:
            t[
              'com.affine.caseAssistant.allFristen.modal.externalCompleted.placeholder'
            ](),
        },
        confirmText:
          t[
            'com.affine.caseAssistant.allFristen.modal.externalCompleted.confirm'
          ](),
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm: async rawInput => {
          const updated =
            await casePlatformOrchestrationService.markDeadlineCompletedExternal(
              deadline.id,
              rawInput
            );
          showActionStatus(
            updated
              ? t.t('com.affine.caseAssistant.allFristen.feedback.completed', {
                  title: deadline.title,
                })
              : t.t(
                  'com.affine.caseAssistant.allFristen.feedback.completedFailed',
                  {
                    title: deadline.title,
                  }
                )
          );
        },
      });
    },
    [casePlatformOrchestrationService, openPromptModal, showActionStatus, t]
  );

  const handleReopenDeadline = useCallback(
    async (deadline: EnrichedDeadline) => {
      const updated = await casePlatformOrchestrationService.reopenDeadline(
        deadline.id
      );
      showActionStatus(
        updated
          ? t.t('com.affine.caseAssistant.allFristen.feedback.reopened', {
              title: deadline.title,
            })
          : t.t('com.affine.caseAssistant.allFristen.feedback.reopenFailed', {
              title: deadline.title,
            })
      );
    },
    [casePlatformOrchestrationService, showActionStatus]
  );

  const handleBulkMarkReviewed = useCallback(async () => {
    const targets = sorted.filter(
      deadline =>
        bulkSelection.selectedIds.has(deadline.id) &&
        deadline.status !== 'completed' &&
        deadline.status !== 'expired' &&
        Boolean(deadline.requiresReview)
    );
    if (!targets.length) {
      showActionStatus(
        t['com.affine.caseAssistant.allFristen.feedback.noReviewDeadlines']()
      );
      return;
    }

    openConfirmModal({
      title:
        t['com.affine.caseAssistant.allFristen.modal.reviewConfirmed.title'](),
      description: t.t(
        'com.affine.caseAssistant.allFristen.modal.reviewConfirmed.description',
        {
          count: targets.length,
        }
      ),
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText:
        t[
          'com.affine.caseAssistant.allFristen.modal.reviewConfirmed.confirm'
        ](),
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm: async () => {
        if (isBulkReviewing) return;
        setIsBulkReviewing(true);
        try {
          const now = new Date().toISOString();
          const results = await Promise.all(
            targets.map(async deadline => {
              const base = graph.deadlines?.[deadline.id];
              if (!base) return null;
              const updated =
                await casePlatformOrchestrationService.upsertDeadline({
                  ...base,
                  requiresReview: false,
                  detectionConfidence: Math.max(
                    base.detectionConfidence ?? 0.78,
                    0.86
                  ),
                  reviewedAt: now,
                  reviewedBy:
                    currentUser?.label || currentUser?.email || 'manual_user',
                  updatedAt: now,
                });
              if (!updated) {
                return null;
              }
              await casePlatformOrchestrationService.appendAuditEntry({
                caseId: deadline.caseFileId || undefined,
                workspaceId:
                  graph.cases?.[deadline.caseFileId]?.workspaceId ??
                  'workspace:unknown',
                action: 'deadline.review.confirmed',
                severity: 'info',
                details: `Frist wurde manuell geprüft: ${deadline.title}`,
                metadata: {
                  deadlineId: deadline.id,
                  confidence: String(updated.detectionConfidence ?? ''),
                  reviewedBy: updated.reviewedBy ?? 'unknown',
                  bulk: 'true',
                },
              });
              return updated;
            })
          );
          const succeeded = results.filter(Boolean).length;
          const failed = targets.length - succeeded;
          showActionStatus(
            failed > 0
              ? t.t(
                  'com.affine.caseAssistant.allFristen.feedback.reviewConfirmedPartial',
                  {
                    succeeded,
                    failed,
                  }
                )
              : t.t(
                  'com.affine.caseAssistant.allFristen.feedback.reviewConfirmed',
                  {
                    count: targets.length,
                  }
                )
          );
          bulkSelection.clear();
        } finally {
          setIsBulkReviewing(false);
        }
      },
    });
  }, [
    bulkSelection,
    casePlatformOrchestrationService,
    currentUser,
    graph.cases,
    graph.deadlines,
    isBulkReviewing,
    openConfirmModal,
    showActionStatus,
    sorted,
    t,
  ]);

  const selectedReviewCount = useMemo(
    () =>
      sorted.filter(
        deadline =>
          bulkSelection.selectedIds.has(deadline.id) &&
          deadline.status !== 'completed' &&
          deadline.status !== 'expired' &&
          Boolean(deadline.requiresReview)
      ).length,
    [bulkSelection.selectedIds, sorted]
  );

  const bulkPrimaryMode = selectedReviewCount > 0 ? 'review' : 'complete';

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === 'Escape' && bulkSelection.selectedCount > 0) {
        bulkSelection.clear();
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
  }, [bulkSelection]);

  const handleCreateDeadline = useCallback(() => {
    const availableCases = [...caseFiles].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (availableCases.length === 0) {
      showActionStatus(
        t['com.affine.caseAssistant.allFristen.feedback.createCaseFirst']()
      );
      workbench.open('/akten?caFocus=create-matter');
      return;
    }

    const targetCase =
      (deepLinkMatterId
        ? availableCases.find(
            caseFile => caseFile.matterId === deepLinkMatterId
          )
        : undefined) ?? availableCases[0];

    openPromptModal({
      title: t['com.affine.caseAssistant.allFristen.modal.create.title'](),
      label: t['com.affine.caseAssistant.allFristen.modal.create.label'](),
      inputOptions: {
        placeholder:
          t['com.affine.caseAssistant.allFristen.modal.create.placeholder'](),
      },
      confirmText:
        t['com.affine.caseAssistant.allFristen.modal.create.confirm'](),
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm: async rawInput => {
        const input = rawInput.trim();
        if (!input) {
          showActionStatus(
            t['com.affine.caseAssistant.allFristen.feedback.titleRequired']()
          );
          return;
        }

        const parsed = input.match(/^(.*?)(?:\s*@\s*(\d{4}-\d{2}-\d{2}))?$/);
        const title = (parsed?.[1] ?? '').trim();
        const dueDateToken = parsed?.[2]?.trim();
        if (!title) {
          showActionStatus(
            t['com.affine.caseAssistant.allFristen.feedback.titleRequired']()
          );
          return;
        }

        const dueAtDate = (() => {
          if (dueDateToken) {
            const manual = new Date(`${dueDateToken}T17:00:00`);
            return Number.isNaN(manual.getTime()) ? null : manual;
          }
          const fallback = new Date();
          fallback.setDate(fallback.getDate() + 7);
          fallback.setHours(17, 0, 0, 0);
          return fallback;
        })();

        if (!dueAtDate) {
          showActionStatus(
            t[
              'com.affine.caseAssistant.allFristen.feedback.invalidDateFormat'
            ]()
          );
          return;
        }

        const created = await casePlatformOrchestrationService.upsertDeadline({
          id: createLocalRecordId('deadline'),
          title,
          dueAt: dueAtDate.toISOString(),
          derivedFrom: 'manual',
          detectionConfidence: 1,
          requiresReview: false,
          evidenceSnippets: [
            t['com.affine.caseAssistant.allFristen.evidence.createdManually'](),
          ],
          sourceDocIds: [],
          priority: 'medium',
          reminderOffsetsInMinutes: [1440, 60, 15],
          status: 'open',
        });

        if (!created) {
          showActionStatus(
            t.t('com.affine.caseAssistant.allFristen.feedback.createFailed', {
              title: title,
            })
          );
          return;
        }

        await store.upsertCaseFile({
          ...targetCase,
          deadlineIds: [
            ...new Set([...(targetCase.deadlineIds ?? []), created.id]),
          ],
          updatedAt: new Date().toISOString(),
        });

        setSavedView('week');
        setFilterMode('today_week');
        setSearchQuery('');
        showActionStatus(
          t.t('com.affine.caseAssistant.allFristen.feedback.created', {
            title: created.title,
            date: new Date(created.dueAt).toLocaleDateString(language),
          })
        );
      },
    });
  }, [
    caseFiles,
    casePlatformOrchestrationService,
    deepLinkMatterId,
    language,
    openPromptModal,
    showActionStatus,
    store,
    t,
    workbench,
  ]);

  const handleOpenDeadlineInMainChat = useCallback(
    (deadline: EnrichedDeadline) => {
      if (deadline.matterId) {
        const params = new URLSearchParams({
          caMatterId: deadline.matterId,
          caSidebar: 'anwalts-workflow',
          caWorkflowTab: 'kalender',
          caDeadlineId: deadline.id,
        });
        if (deadline.clientId) {
          params.set('caClientId', deadline.clientId);
        }
        workbench.open(`/akten/${deadline.matterId}?${params.toString()}`);
        showActionStatus(
          t.t('com.affine.caseAssistant.allFristen.openDeadline.opening', {
            title: deadline.title,
          })
        );
        return;
      }

      showActionStatus(
        t.t('com.affine.caseAssistant.allFristen.feedback.noMatterAssignment', {
          title: deadline.title,
        })
      );
      workbench.open('/akten');
    },
    [showActionStatus, t, workbench]
  );

  const handleMarkDeadlineReviewed = useCallback(
    async (deadline: EnrichedDeadline) => {
      const base = graph.deadlines?.[deadline.id];
      if (!base) {
        showActionStatus(
          t.t('com.affine.caseAssistant.allFristen.feedback.loadFailed', {
            title: deadline.title,
          })
        );
        return;
      }

      const updated = await casePlatformOrchestrationService.upsertDeadline({
        ...base,
        requiresReview: false,
        detectionConfidence: Math.max(base.detectionConfidence ?? 0.78, 0.86),
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser?.label || currentUser?.email || 'manual_user',
        updatedAt: new Date().toISOString(),
      });

      if (!updated) {
        showActionStatus(
          t.t(
            'com.affine.caseAssistant.allFristen.feedback.reviewUpdateFailed',
            {
              title: deadline.title,
            }
          )
        );
        return;
      }

      await casePlatformOrchestrationService.appendAuditEntry({
        caseId: deadline.caseFileId || undefined,
        workspaceId:
          graph.cases?.[deadline.caseFileId]?.workspaceId ??
          'workspace:unknown',
        action: 'deadline.review.confirmed',
        severity: 'info',
        details: `Frist wurde manuell geprüft: ${deadline.title}`,
        metadata: {
          deadlineId: deadline.id,
          confidence: String(updated.detectionConfidence ?? ''),
          reviewedBy: updated.reviewedBy ?? 'unknown',
          derivedFrom: updated.derivedFrom ?? 'unknown',
        },
      });

      showActionStatus(
        t.t('com.affine.caseAssistant.allFristen.feedback.reviewed', {
          title: deadline.title,
        })
      );
    },
    [
      casePlatformOrchestrationService,
      currentUser,
      graph.cases,
      graph.deadlines,
      showActionStatus,
    ]
  );

  const handleEditDeadline = useCallback(
    (deadline: EnrichedDeadline) => {
      openPromptModal({
        title: t['com.affine.caseAssistant.allFristen.modal.edit.title'](),
        label: t['com.affine.caseAssistant.allFristen.modal.edit.label'](),
        inputOptions: {
          placeholder:
            t['com.affine.caseAssistant.allFristen.modal.edit.placeholder'](),
          defaultValue: `${deadline.title} @${deadline.dueAt.slice(0, 10)}`,
        },
        confirmText:
          t['com.affine.caseAssistant.allFristen.modal.edit.confirm'](),
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm: async rawInput => {
          const input = rawInput.trim();
          const parsed = input.match(/^(.*?)(?:\s*@\s*(\d{4}-\d{2}-\d{2}))?$/);
          const title = (parsed?.[1] ?? '').trim();
          const dueDateToken = parsed?.[2]?.trim();
          if (!title || !dueDateToken) {
            showActionStatus(
              t['com.affine.caseAssistant.allFristen.feedback.formatRequired']()
            );
            return;
          }
          const dueAtDate = new Date(`${dueDateToken}T17:00:00`);
          if (Number.isNaN(dueAtDate.getTime())) {
            showActionStatus(
              t['com.affine.caseAssistant.allFristen.feedback.invalidDate']()
            );
            return;
          }

          const base = graph.deadlines?.[deadline.id];
          if (!base) {
            showActionStatus(
              t.t('com.affine.caseAssistant.allFristen.feedback.notFound', {
                title: deadline.title,
              })
            );
            return;
          }

          const updated = await casePlatformOrchestrationService.upsertDeadline(
            {
              ...base,
              title,
              dueAt: dueAtDate.toISOString(),
              updatedAt: new Date().toISOString(),
            }
          );
          showActionStatus(
            updated
              ? t.t('com.affine.caseAssistant.allFristen.feedback.updated', {
                  title: title,
                })
              : t.t(
                  'com.affine.caseAssistant.allFristen.feedback.updateFailed',
                  {
                    title: deadline.title,
                  }
                )
          );
        },
      });
    },
    [
      casePlatformOrchestrationService,
      graph.deadlines,
      openPromptModal,
      showActionStatus,
      t,
    ]
  );

  const handleDeleteDeadline = useCallback(
    (deadline: EnrichedDeadline) => {
      openConfirmModal({
        title: t['com.affine.caseAssistant.allFristen.modal.delete.title'](),
        description: t.t(
          'com.affine.caseAssistant.allFristen.modal.delete.description',
          {
            title: deadline.title,
          }
        ),
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmText:
          t['com.affine.caseAssistant.allFristen.modal.delete.confirm'](),
        confirmButtonOptions: {
          variant: 'error',
        },
        onConfirm: async () => {
          const ok =
            await casePlatformOrchestrationService.deleteDeadlineCascade(
              deadline.id
            );
          showActionStatus(
            ok
              ? t.t('com.affine.caseAssistant.allFristen.feedback.deleted', {
                  title: deadline.title,
                })
              : t.t(
                  'com.affine.caseAssistant.allFristen.feedback.deleteFailed',
                  {
                    title: deadline.title,
                  }
                )
          );
        },
      });
    },
    [casePlatformOrchestrationService, openConfirmModal, showActionStatus, t]
  );

  const handleBulkDeleteDeadlines = useCallback(() => {
    const targets = sorted.filter(deadline =>
      bulkSelection.selectedIds.has(deadline.id)
    );
    if (!targets.length) {
      showActionStatus(
        t['com.affine.caseAssistant.allFristen.feedback.noSelection']()
      );
      return;
    }

    openConfirmModal({
      title: t.t('com.affine.caseAssistant.allFristen.modal.bulkDelete.title', {
        count: targets.length,
      }),
      description:
        t['com.affine.caseAssistant.allFristen.modal.bulkDelete.description'](),
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText:
        t['com.affine.caseAssistant.allFristen.modal.bulkDelete.confirm'](),
      confirmButtonOptions: {
        variant: 'error',
      },
      onConfirm: async () => {
        if (isBulkDeleting) return;
        setIsBulkDeleting(true);
        try {
          const results = await Promise.all(
            targets.map(target =>
              casePlatformOrchestrationService.deleteDeadlineCascade(target.id)
            )
          );
          const succeeded = results.filter(Boolean).length;
          const failed = targets.length - succeeded;
          showActionStatus(
            failed > 0
              ? t.t(
                  'com.affine.caseAssistant.allFristen.feedback.bulkDeletedPartial',
                  {
                    succeeded,
                    failed,
                  }
                )
              : t.t(
                  'com.affine.caseAssistant.allFristen.feedback.bulkDeleted',
                  {
                    count: succeeded,
                  }
                )
          );
          bulkSelection.clear();
        } finally {
          setIsBulkDeleting(false);
        }
      },
    });
  }, [
    bulkSelection,
    casePlatformOrchestrationService,
    isBulkDeleting,
    openConfirmModal,
    showActionStatus,
    sorted,
    t,
  ]);

  const dueDateClass = (deadline: EnrichedDeadline) => {
    if (deadline.urgency === 'critical') return styles.dueDateCritical;
    if (deadline.daysRemaining < 0) return styles.dueDateOverdue;
    if (deadline.daysRemaining === 0) return styles.dueDateToday;
    if (deadline.daysRemaining <= 3) return styles.dueDateSoon;
    return '';
  };

  const urgencyRowClass = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'overdue':
        return styles.fristRowOverdue;
      case 'critical':
        return styles.fristRowCritical;
      case 'today':
        return styles.fristRowToday;
      case 'soon':
        return styles.fristRowSoon;
      default:
        return '';
    }
  };

  const urgencyBadgeClass = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'overdue':
        return styles.urgencyOverdue;
      case 'critical':
        return styles.urgencyCritical;
      case 'today':
        return styles.urgencyToday;
      case 'soon':
        return styles.urgencySoon;
      default:
        return styles.urgencyNormal;
    }
  };

  const urgencyLabel = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'overdue':
        return t['com.affine.caseAssistant.allFristen.urgency.overdue']();
      case 'critical':
        return t['com.affine.caseAssistant.allFristen.urgency.critical']();
      case 'today':
        return t['com.affine.caseAssistant.allFristen.urgency.today']();
      case 'soon':
        return t['com.affine.caseAssistant.allFristen.urgency.soon']();
      case 'upcoming':
        return t['com.affine.caseAssistant.allFristen.urgency.upcoming']();
      default:
        return t['com.affine.caseAssistant.allFristen.urgency.future']();
    }
  };

  const isInitialLoading =
    showInitialSkeleton && allDeadlines.length === 0 && caseFiles.length === 0;

  const savedViewOptions: Array<{ key: FristenSavedView; label: string }> = [
    {
      key: 'critical',
      label: t['com.affine.caseAssistant.allFristen.view.critical'](),
    },
    {
      key: 'week',
      label: t['com.affine.caseAssistant.allFristen.view.week'](),
    },
    {
      key: 'done',
      label: t['com.affine.caseAssistant.allFristen.view.done'](),
    },
    { key: 'all', label: t['com.affine.caseAssistant.allFristen.view.all']() },
    {
      key: 'custom',
      label: t['com.affine.caseAssistant.allFristen.view.custom'](),
    },
  ];

  return (
    <>
      <ViewTitle title={t['com.affine.caseAssistant.allFristen.title']()} />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div className={styles.body}>
          <div
            className={styles.srOnlyLive}
            aria-live="polite"
            aria-atomic="true"
          >
            {actionStatus ??
              `${isCalendarDayFilterActive ? t.t('com.affine.caseAssistant.allFristen.calendar.active', { date: selectedDateLabel }) : t['com.affine.caseAssistant.allFristen.calendar.inactive']()} ${t.t('com.affine.caseAssistant.allFristen.sr.visible', { count: sorted.length })}${selectedDayMeta.criticalCount > 0 ? ` ${t.t('com.affine.caseAssistant.allFristen.sr.critical', { count: selectedDayMeta.criticalCount })}` : ''}`}
          </div>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            {/* Row 1: Saved Views */}
            <div className={styles.filterRow}>
              <label className={styles.toolbarControl}>
                <span className={styles.toolbarLabel}>
                  {t['com.affine.caseAssistant.allFristen.toolbar.view']()}
                </span>
                <select
                  className={styles.toolbarSelect}
                  value={savedView}
                  onChange={event => {
                    const nextView = event.target.value as FristenSavedView;
                    setSavedView(nextView);
                    if (nextView === 'critical') {
                      setFilterMode('overdue');
                    } else if (nextView === 'week') {
                      setFilterMode('today_week');
                    } else if (nextView === 'done') {
                      setFilterMode('completed');
                    } else {
                      setFilterMode('all');
                    }
                  }}
                  aria-label={t[
                    'com.affine.caseAssistant.allFristen.aria.sortField'
                  ]()}
                >
                  {savedViewOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={styles.filterChip}
                data-active={isCalendarDayFilterActive}
                onClick={() =>
                  setIsCalendarDayFilterActive(current => !current)
                }
                aria-pressed={isCalendarDayFilterActive}
              >
                {isCalendarDayFilterActive
                  ? t.t(
                      'com.affine.caseAssistant.allFristen.calendar.dayActive',
                      {
                        date: selectedDateKey,
                      }
                    )
                  : t['com.affine.caseAssistant.allFristen.calendar.allDays']()}
              </button>
              <button
                className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                onClick={handleJumpToToday}
              >
                {t['com.affine.caseAssistant.allFristen.today.button']()}
              </button>
            </div>

            {/* Row 2: Status filters + Sort controls + Search */}
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <label className={styles.toolbarControl}>
                  <span className={styles.toolbarLabel}>
                    {t['com.affine.caseAssistant.allFristen.toolbar.filter']()}
                  </span>
                  <select
                    className={styles.toolbarSelect}
                    value={effectiveFilterMode}
                    onChange={event => {
                      setSavedView('custom');
                      setFilterMode(event.target.value as FilterMode);
                    }}
                    aria-label={t[
                      'com.affine.caseAssistant.allFristen.filter.ariaLabel'
                    ]()}
                  >
                    <option value="all">
                      {t.t(
                        'com.affine.caseAssistant.allFristen.filter.allLabel',
                        {
                          count: stats.total,
                        }
                      )}
                    </option>
                    <option value="overdue">
                      {t.t(
                        'com.affine.caseAssistant.allFristen.filter.overdueLabel',
                        {
                          count: stats.overdue,
                        }
                      )}
                    </option>
                    <option value="today_week">
                      {t.t(
                        'com.affine.caseAssistant.allFristen.filter.todayWeekLabel',
                        {
                          count: stats.today + stats.thisWeek,
                        }
                      )}
                    </option>
                    <option value="completed">
                      {t.t(
                        'com.affine.caseAssistant.allFristen.filter.completedLabel',
                        {
                          count: stats.completed,
                        }
                      )}
                    </option>
                    <option value="needs_review">
                      {t.t(
                        'com.affine.caseAssistant.allFristen.filter.needsReviewLabel',
                        {
                          count: stats.needsReview,
                        }
                      )}
                    </option>
                    <option value="low_confidence">
                      {t.t(
                        'com.affine.caseAssistant.allFristen.filter.lowConfidenceLabel',
                        {
                          count: stats.lowConfidence,
                        }
                      )}
                    </option>
                  </select>
                </label>
              </div>

              <div className={styles.filterGroupRight}>
                <button
                  className={styles.primaryActionChip}
                  onClick={handleCreateDeadline}
                  aria-label={t[
                    'com.affine.caseAssistant.allFristen.create.ariaLabel'
                  ]()}
                >
                  {t['com.affine.caseAssistant.allFristen.create.label']()}
                </button>
                {reviewCandidateIds.length > 0 ? (
                  <button
                    className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                    onClick={() => {
                      bulkSelection.selectByIds(reviewCandidateIds);
                      showActionStatus(
                        t.t(
                          'com.affine.caseAssistant.allFristen.review.loadSelection',
                          {
                            count: reviewCandidateIds.length,
                          }
                        )
                      );
                    }}
                  >
                    {t[
                      'com.affine.caseAssistant.allFristen.review.selectButton'
                    ]()}
                  </button>
                ) : null}
                {sorted.length > 0 ? (
                  <button
                    className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                    onClick={() => void handleBulkMarkCompleted()}
                  >
                    {t[
                      'com.affine.caseAssistant.allFristen.bulk.markCompleted'
                    ]()}
                  </button>
                ) : null}
                <label className={styles.toolbarControl}>
                  <span className={styles.toolbarLabel}>
                    {t['com.affine.caseAssistant.allFristen.toolbar.sort']()}
                  </span>
                  <select
                    className={styles.toolbarSelect}
                    value={sortKey}
                    onChange={event =>
                      setSortKey(event.target.value as SortKey)
                    }
                    aria-label={t[
                      'com.affine.caseAssistant.allFristen.aria.sortField'
                    ]()}
                  >
                    <option value="dueAt">{sortKeyLabel.dueAt}</option>
                    <option value="title">{sortKeyLabel.title}</option>
                    <option value="status">{sortKeyLabel.status}</option>
                    <option value="confidence">
                      {sortKeyLabel.confidence}
                    </option>
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.toolbarSortDirectionButton}
                  onClick={() =>
                    setSortDir(current => (current === 'desc' ? 'asc' : 'desc'))
                  }
                  data-dir={sortDir}
                  aria-label={
                    sortDir === 'desc'
                      ? t[
                          'com.affine.caseAssistant.allFristen.aria.sortDirection.descToAsc'
                        ]()
                      : t[
                          'com.affine.caseAssistant.allFristen.aria.sortDirection.ascToDesc'
                        ]()
                  }
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
                <div className={styles.searchWrap}>
                  <input
                    ref={searchInputRef}
                    className={styles.searchInput}
                    type="text"
                    placeholder={t[
                      'com.affine.caseAssistant.allFristen.search.placeholder'
                    ]()}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label={t[
                      'com.affine.caseAssistant.allFristen.aria.search'
                    ]()}
                  />
                  {searchQuery ? (
                    <button
                      className={styles.searchClear}
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label={t[
                        'com.affine.caseAssistant.allFristen.aria.clearSearch'
                      ]()}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {actionStatus ? (
            <div className={styles.actionStatus} role="status">
              {actionStatus}
            </div>
          ) : null}

          {/* Table */}
          <div className={styles.scrollArea}>
            <div
              className={styles.listContainer}
              role="grid"
              onKeyDown={event => handleListKeyDown(event, sorted)}
              aria-label={t['com.affine.caseAssistant.allFristen.aria.grid']()}
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
                        el.indeterminate =
                          bulkSelection.headerState.indeterminate;
                      }
                    }}
                    onChange={e =>
                      bulkSelection.selectAllVisible(e.target.checked)
                    }
                    aria-label={t[
                      'com.affine.caseAssistant.allFristen.selection.selectAll'
                    ]()}
                  />
                </span>
                <span className={styles.sortButton} role="columnheader">
                  {t[
                    'com.affine.caseAssistant.allFristen.header.deadlineAndCase'
                  ]()}
                </span>
                <span className={styles.sortButton} role="columnheader">
                  {t['com.affine.caseAssistant.allFristen.header.due']()}
                </span>
                <span className={styles.fristMeta}>
                  {t['com.affine.caseAssistant.allFristen.header.client']()}
                </span>
                <span className={styles.fristMetaHideSm}>
                  {t['com.affine.caseAssistant.allFristen.header.urgency']()}
                </span>
                <span className={styles.sortButton} role="columnheader">
                  {t['com.affine.caseAssistant.allFristen.header.status']()}
                </span>
              </div>

              {isInitialLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`fristen-skeleton-${index}`}
                    className={styles.skeletonRow}
                    role="row"
                    aria-hidden="true"
                  />
                ))
              ) : sorted.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyTitle}>
                    {isCalendarDayFilterActive
                      ? t[
                          'com.affine.caseAssistant.allFristen.empty.calendarDay.title'
                        ]()
                      : searchQuery || filterMode !== 'all'
                        ? t[
                            'com.affine.caseAssistant.allFristen.empty.filtered.title'
                          ]()
                        : t[
                            'com.affine.caseAssistant.allFristen.empty.initial.title'
                          ]()}
                  </div>
                  <div className={styles.emptyDescription}>
                    {isCalendarDayFilterActive
                      ? t[
                          'com.affine.caseAssistant.allFristen.empty.calendarDay.description'
                        ]()
                      : searchQuery || filterMode !== 'all'
                        ? t[
                            'com.affine.caseAssistant.allFristen.empty.filtered.description'
                          ]()
                        : t[
                            'com.affine.caseAssistant.allFristen.empty.initial.description'
                          ]()}
                  </div>
                  <button
                    type="button"
                    className={styles.primaryActionChip}
                    onClick={handleCreateDeadline}
                    aria-label={t[
                      'com.affine.caseAssistant.allFristen.create.ariaLabel'
                    ]()}
                  >
                    {t['com.affine.caseAssistant.allFristen.create.label']()}
                  </button>
                </div>
              ) : (
                sorted.map((deadline, index) => {
                  const canOpen = Boolean(
                    deadline.caseFileId || deadline.matterId
                  );
                  const hasEvidence =
                    (deadline.evidenceSnippets?.length ?? 0) > 0;
                  const showDetectionQualityBadge =
                    shouldShowDetectionQuality(deadline);
                  const confidenceLabel = formatConfidence(
                    deadline.detectionConfidence
                  );
                  const confidenceVariant = confidenceTone(
                    deadline.detectionConfidence
                  );
                  const reviewedAtLabel = formatReviewedAt(
                    deadline.reviewedAt,
                    language
                  );
                  const evidencePreview =
                    deadline.evidenceSnippets
                      ?.slice(0, 2)
                      .map(item => item.trim())
                      .filter(Boolean)
                      .join(' • ') ?? '';
                  return (
                    <button
                      type="button"
                      key={deadline.id}
                      data-frist-row-index={index}
                      className={[
                        styles.fristRow,
                        urgencyRowClass(deadline.urgency),
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={event => {
                        if (bulkSelection.isSelectionMode) {
                          bulkSelection.toggleWithRange(deadline.id, {
                            shiftKey: (event as any).shiftKey,
                          });
                          return;
                        }
                        handleOpenDeadlineInMainChat(deadline);
                      }}
                      onFocus={() => setFocusedIndex(index)}
                      data-focused={focusedIndex === index ? 'true' : undefined}
                      aria-label={t.t(
                        'com.affine.caseAssistant.allFristen.aria.row',
                        {
                          title: deadline.title,
                          dueDate: formatDueDate(deadline.dueAt, language, t),
                          noCaseSuffix: canOpen
                            ? ''
                            : `, ${t['com.affine.caseAssistant.allFristen.aria.row.noCase']()}`,
                        }
                      )}
                    >
                      <div
                        className={styles.selectionCell}
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className={styles.selectionCheckbox}
                          checked={bulkSelection.isSelected(deadline.id)}
                          onChange={e => {
                            bulkSelection.toggleWithRange(deadline.id, {
                              shiftKey: (e.nativeEvent as any).shiftKey,
                            });
                          }}
                          onClick={e => e.stopPropagation()}
                          aria-label={t.t(
                            'com.affine.caseAssistant.allFristen.selection.ariaLabel',
                            {
                              title: deadline.title,
                            }
                          )}
                        />
                      </div>
                      <div className={styles.fristMainCell}>
                        <div className={styles.fristTitle}>
                          {deadline.title}
                        </div>
                        <div className={styles.fristSubtitle}>
                          {deadline.matterExternalRef
                            ? `${deadline.matterExternalRef} — `
                            : ''}
                          {deadline.matterTitle ||
                            t[
                              'com.affine.caseAssistant.allFristen.fallback.none'
                            ]()}
                        </div>
                        <div className={styles.deadlineInsightRow}>
                          {showDetectionQualityBadge ? (
                            <span
                              className={styles.deadlineConfidenceBadge}
                              data-tone={confidenceVariant}
                              title={t[DETECTION_QUALITY_EXPLANATION_KEY]()}
                              aria-label={t.t(
                                'com.affine.caseAssistant.allFristen.confidence.ariaLabel',
                                {
                                  confidence: confidenceLabel,
                                }
                              )}
                            >
                              {t.t(
                                'com.affine.caseAssistant.allFristen.confidence.label',
                                {
                                  confidence: confidenceLabel,
                                }
                              )}
                            </span>
                          ) : null}
                          {deadline.requiresReview ? (
                            <span className={styles.deadlineReviewBadge}>
                              {t[
                                'com.affine.caseAssistant.allFristen.review.badge'
                              ]()}
                            </span>
                          ) : null}
                          {deadline.derivedFrom ? (
                            <span className={styles.deadlineSourceTag}>
                              {deadline.derivedFrom}
                            </span>
                          ) : null}
                          {deadline.requiresReview ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={event => {
                                event.stopPropagation();
                                handleMarkDeadlineReviewed(deadline).catch(
                                  () => {
                                    showActionStatus(
                                      `Review-Status konnte nicht aktualisiert werden: ${deadline.title}`
                                    );
                                  }
                                );
                              }}
                            >
                              {t[
                                'com.affine.caseAssistant.allFristen.review.confirmButton'
                              ]()}
                            </button>
                          ) : null}

                          {deadline.status !== 'completed' &&
                          deadline.status !== 'expired' ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={event => {
                                event.stopPropagation();
                                handleMarkDeadlineCompleted(deadline).catch(
                                  () => {
                                    showActionStatus(
                                      t.t(
                                        'com.affine.caseAssistant.allFristen.feedback.completedFailed',
                                        {
                                          title: deadline.title,
                                        }
                                      )
                                    );
                                  }
                                );
                              }}
                            >
                              {t[
                                'com.affine.caseAssistant.allFristen.markCompleted.external'
                              ]()}
                            </button>
                          ) : null}

                          {deadline.status === 'completed' ||
                          deadline.status === 'expired' ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={event => {
                                event.stopPropagation();
                                handleReopenDeadline(deadline).catch(() => {
                                  showActionStatus(
                                    t.t(
                                      'com.affine.caseAssistant.allFristen.feedback.reopenFailed',
                                      {
                                        title: deadline.title,
                                      }
                                    )
                                  );
                                });
                              }}
                            >
                              {t[
                                'com.affine.caseAssistant.allFristen.reopen.button'
                              ]()}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className={styles.deadlineReviewAction}
                            onClick={event => {
                              event.stopPropagation();
                              handleEditDeadline(deadline);
                            }}
                          >
                            {t[
                              'com.affine.caseAssistant.allFristen.edit.button'
                            ]()}
                          </button>
                          <button
                            type="button"
                            className={styles.deadlineReviewAction}
                            onClick={event => {
                              event.stopPropagation();
                              handleDeleteDeadline(deadline);
                            }}
                          >
                            {t[
                              'com.affine.caseAssistant.allFristen.delete.button'
                            ]()}
                          </button>
                        </div>
                        {hasEvidence ? (
                          <div className={styles.deadlineEvidencePreview}>
                            {t.t(
                              'com.affine.caseAssistant.allFristen.evidence.label',
                              {
                                evidence: evidencePreview,
                              }
                            )}
                          </div>
                        ) : null}
                        {!deadline.requiresReview && reviewedAtLabel ? (
                          <div className={styles.deadlineReviewedMeta}>
                            {t.t(
                              'com.affine.caseAssistant.allFristen.reviewed.label',
                              {
                                date: reviewedAtLabel,
                              }
                            )}
                            {deadline.reviewedBy
                              ? ` • ${t.t(
                                  'com.affine.caseAssistant.allFristen.reviewed.by',
                                  {
                                    reviewedBy: deadline.reviewedBy,
                                  }
                                )}`
                              : ''}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={[styles.dueDate, dueDateClass(deadline)]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {formatDueDate(deadline.dueAt, language, t)}
                      </span>
                      <span className={styles.fristMeta}>
                        {deadline.clientName ||
                          t[
                            'com.affine.caseAssistant.allFristen.fallback.none'
                          ]()}
                      </span>
                      <span className={styles.fristMetaHideSm}>
                        <span
                          className={`${styles.urgencyBadge} ${urgencyBadgeClass(deadline.urgency)}`}
                        >
                          {urgencyLabel(deadline.urgency)}
                        </span>
                      </span>
                      <span>
                        <span
                          className={`${styles.statusBadge} ${statusClass[deadline.status]}`}
                        >
                          {statusLabel[deadline.status]}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <BulkActionBar
            containerName="fristen-body"
            selectedCount={bulkSelection.selectedCount}
            selectionLabel={t.t(
              'com.affine.caseAssistant.allFristen.bulk.selectionLabel',
              {
                count: bulkSelection.selectedCount,
              }
            )}
            isRunning={isBulkCompleting || isBulkReviewing || isBulkDeleting}
            primaryLabel={
              bulkPrimaryMode === 'review'
                ? t.t('com.affine.caseAssistant.allFristen.bulk.reviewLabel', {
                    count: selectedReviewCount,
                  })
                : t['com.affine.caseAssistant.allFristen.bulk.completeLabel']()
            }
            onPrimary={() =>
              void (bulkPrimaryMode === 'review'
                ? handleBulkMarkReviewed()
                : handleBulkMarkCompleted())
            }
            canDelete={bulkSelection.selectedCount > 0}
            deleteLabel={t[
              'com.affine.caseAssistant.allFristen.bulk.deleteLabel'
            ]()}
            onDelete={handleBulkDeleteDeadlines}
            onClear={bulkSelection.clear}
          />
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AllFristenPage />;
};

export default Component;
