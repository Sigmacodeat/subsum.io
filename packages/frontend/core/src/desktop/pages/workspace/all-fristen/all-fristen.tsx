import { type DateCell, DatePicker, useConfirmModal, usePromptModal } from '@affine/component';
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
import {
  ViewBody,
  ViewIcon,
  ViewTitle,
} from '../../../../modules/workbench';
import { WorkbenchService } from '../../../../modules/workbench';
import { createLocalRecordId } from '../detail-page/tabs/case-assistant/utils';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { BulkActionBar } from '../layouts/bulk-action-bar';
import { useBulkSelection } from '../layouts/use-bulk-selection';
import * as styles from './all-fristen.css';

type DeadlineStatus = CaseDeadline['status'];
type UrgencyLevel = 'overdue' | 'critical' | 'today' | 'soon' | 'upcoming' | 'future';
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
  confidence: 'Erkennungsqualität (KI)',
};

const DETECTION_QUALITY_EXPLANATION =
  'Wie verlässlich die automatische Fristerkennung aus Dokumenten ist. 100% = sehr sicher, niedriger Wert = bitte prüfen.';

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

function getUrgencyLevel(days: number, hours: number, status: DeadlineStatus): UrgencyLevel {
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
  if (days === -1) return t['com.affine.caseAssistant.allFristen.dueDate.overdueYesterday']();
  if (days === 0) return t['com.affine.caseAssistant.allFristen.dueDate.today']();
  if (days === 1) return t['com.affine.caseAssistant.allFristen.dueDate.tomorrow']();
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

function shouldShowDetectionQuality(deadline: Pick<CaseDeadline, 'derivedFrom' | 'sourceDocIds' | 'requiresReview'>): boolean {
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
  const casePlatformOrchestrationService = useService(CasePlatformOrchestrationService);
  const workbench = useService(WorkbenchService).workbench;
  const { openPromptModal } = usePromptModal();
  const { openConfirmModal } = useConfirmModal();
  const authService = useService(AuthService);
  const currentUser = useLiveData(authService.session.account$);
  const graph = useLiveData(store.watchGraph());
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
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
  const [selectedDateKey, setSelectedDateKey] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [isCalendarDayFilterActive, setIsCalendarDayFilterActive] = useState(true);
  const [calendarCursor, setCalendarCursor] = useState(() => dayjs());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const actionStatusTimerRef = useRef<number | null>(null);
  const language = t.language || 'en';

  const sortKeyLabel = useMemo(
    () => ({
      dueAt: t[sortKeyLabelKey.dueAt](),
      title: t[sortKeyLabelKey.title](),
      status: t[sortKeyLabelKey.status](),
      confidence: sortKeyLabelKey.confidence,
    }),
    [t]
  );

  const statusLabel = useMemo<Record<DeadlineStatus, string>>(
    () => ({
      open: t['com.affine.caseAssistant.allFristen.status.open'](),
      alerted: 'Angemahnt',
      acknowledged: 'Bestätigt',
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
    if (actionStatusTimerRef.current) window.clearTimeout(actionStatusTimerRef.current);
    actionStatusTimerRef.current = window.setTimeout(() => setActionStatus(null), 4000);
  }, []);

  useEffect(() => () => {
    if (actionStatusTimerRef.current) window.clearTimeout(actionStatusTimerRef.current);
  }, []);

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
          document.querySelector<HTMLElement>(`[data-frist-row-index="${next}"]`)?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          document.querySelector<HTMLElement>(`[data-frist-row-index="${next}"]`)?.focus();
          return next;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedIndex(0);
        document.querySelector<HTMLElement>('[data-frist-row-index="0"]')?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = items.length - 1;
        setFocusedIndex(last);
        document.querySelector<HTMLElement>(`[data-frist-row-index="${last}"]`)?.focus();
      }
    },
    []
  );

  const allDeadlines = useMemo(() => Object.values(graph.deadlines ?? {}), [graph.deadlines]);
  const allMatters = useMemo(() => Object.values(graph.matters ?? {}), [graph.matters]);
  const allClients = useMemo(() => graph.clients ?? {}, [graph.clients]);
  const caseFiles = useMemo(() => Object.values(graph.cases ?? {}), [graph.cases]);

  useEffect(() => {
    const t = window.setTimeout(() => setShowInitialSkeleton(false), 420);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const cursor = dayjs(selectedDateKey);
    if (cursor.isValid() && !cursor.isSame(calendarCursor, 'day')) {
      setCalendarCursor(cursor);
    }
  }, [calendarCursor, selectedDateKey]);

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

  // Enrich deadlines
  const enrichedDeadlines: EnrichedDeadline[] = useMemo(() => {
    return allDeadlines.map(d => {
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
  }, [allDeadlines, deadlineCaseMap, matterMap, allClients]);

  // Stats
  const stats = useMemo(() => {
    const active = enrichedDeadlines.filter(
      d => d.status !== 'completed' && d.status !== 'expired'
    );
    const overdue = active.filter(d => d.daysRemaining < 0).length;
    const today = active.filter(d => d.daysRemaining === 0).length;
    const thisWeek = active.filter(d => d.daysRemaining > 0 && d.daysRemaining <= 7).length;
    const total = enrichedDeadlines.length;
    const completed = enrichedDeadlines.filter(d => d.status === 'completed').length;
    const needsReview = active.filter(deadline => deadline.requiresReview).length;
    const lowConfidence = active.filter(
      deadline => Number.isFinite(deadline.detectionConfidence) && (deadline.detectionConfidence ?? 1) < 0.7
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
      if (deepLinkMatterId && deadline.matterId !== deepLinkMatterId) return false;
      if (deepLinkClientId && deadline.clientId !== deepLinkClientId) return false;
      return true;
    });

    for (const deadline of filteredByContext) {
      const key = toDateKey(deadline.dueAt);
      if (!key) continue;
      const prev = map.get(key) ?? { count: 0, criticalCount: 0 };
      map.set(key, {
        count: prev.count + 1,
        criticalCount:
          prev.criticalCount + (deadline.urgency === 'critical' || deadline.urgency === 'overdue' ? 1 : 0),
      });
    }

    return map;
  }, [deepLinkClientId, deepLinkMatterId, enrichedDeadlines]);

  const selectedDayMeta = useMemo(() => {
    return calendarDayMeta.get(selectedDateKey) ?? { count: 0, criticalCount: 0 };
  }, [calendarDayMeta, selectedDateKey]);

  const selectedDateLabel = useMemo(() => {
    const parsed = dayjs(selectedDateKey);
    if (!parsed.isValid()) return selectedDateKey;
    return parsed.locale(language).format('ddd, DD.MM.YYYY');
  }, [language, selectedDateKey]);

  const handleCalendarDateSelect = useCallback((date: string) => {
    if (!date) return;
    setSelectedDateKey(date);
    setIsCalendarDayFilterActive(true);
    setSavedView('custom');
    setFilterMode('all');
  }, []);

  const handleJumpToToday = useCallback(() => {
    const todayKey = dayjs().format('YYYY-MM-DD');
    setSelectedDateKey(todayKey);
    setCalendarCursor(dayjs(todayKey));
    setIsCalendarDayFilterActive(true);
    setSavedView('custom');
    setFilterMode('all');
  }, []);

  const customCalendarDayRenderer = useCallback(
    (cell: DateCell) => {
      const dateKey = cell.date.format('YYYY-MM-DD');
      const meta = calendarDayMeta.get(dateKey);
      const isCriticalDay = (meta?.criticalCount ?? 0) > 0;

      return (
        <button
          type="button"
          className={styles.termineDateCell}
          data-selected={cell.selected}
          data-today={cell.isToday}
          data-not-current-month={cell.notCurrentMonth}
          data-has-items={(meta?.count ?? 0) > 0}
          data-critical={isCriticalDay}
          tabIndex={cell.focused ? 0 : -1}
          aria-label={`${cell.date.format('DD.MM.YYYY')}: ${meta?.count ?? 0} Frist(en)${isCriticalDay ? ', kritisch (unter 48 Stunden oder überfällig)' : ''}`}
        >
          <span>{cell.label}</span>
          {(meta?.count ?? 0) > 0 ? (
            <span className={styles.termineDateCount}>{meta!.count > 9 ? '9+' : String(meta!.count)}</span>
          ) : null}
          {isCriticalDay ? <span className={styles.termineDateAlarmDot} aria-hidden="true" /> : null}
        </button>
      );
    },
    [calendarDayMeta]
  );

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
      const effectiveFilterMode =
        savedView === 'critical'
          ? 'overdue'
          : savedView === 'week'
            ? 'today_week'
            : savedView === 'done'
              ? 'completed'
              : savedView === 'all'
                ? 'all'
                : filterMode;

      switch (effectiveFilterMode) {
        case 'overdue':
          result = result.filter(
            d => d.daysRemaining < 0 && d.status !== 'completed' && d.status !== 'expired'
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
          result = result.filter(d => d.status === 'completed' || d.status === 'expired');
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
  }, [deepLinkClientId, deepLinkMatterId, enrichedDeadlines, filterMode, isCalendarDayFilterActive, savedView, searchQuery, selectedDateKey]);

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
      title: 'Fristen als erledigt markieren?',
      description: `Du markierst ${targets.length} Frist(en) als erledigt.`,
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText: 'Erledigt markieren',
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm: async () => {
        if (isBulkCompleting) return;
        setIsBulkCompleting(true);
        try {
          const results = await Promise.all(
            targets.map(deadline => {
              return casePlatformOrchestrationService.markDeadlineCompleted(deadline.id);
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
  }, [bulkSelection, casePlatformOrchestrationService, graph.deadlines, isBulkCompleting, openConfirmModal, showActionStatus, sorted, t]);

  const handleMarkDeadlineCompleted = useCallback(
    async (deadline: EnrichedDeadline) => {
      openPromptModal({
        title: 'Extern erledigt',
        label: 'Notiz / Beleg (optional)',
        inputOptions: {
          placeholder: 'z.B. Schriftsatz eingereicht, Fax bestätigt, Zahlung erledigt…',
        },
        confirmText: 'Als erledigt markieren',
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm: async rawInput => {
          const updated = await casePlatformOrchestrationService.markDeadlineCompletedExternal(
            deadline.id,
            rawInput
          );
          showActionStatus(
            updated
              ? `Frist als erledigt markiert: ${deadline.title}`
              : `Frist konnte nicht als erledigt markiert werden: ${deadline.title}`
          );
        },
      });
    },
    [casePlatformOrchestrationService, openPromptModal, showActionStatus, t]
  );

  const handleReopenDeadline = useCallback(
    async (deadline: EnrichedDeadline) => {
      const updated = await casePlatformOrchestrationService.reopenDeadline(deadline.id);
      showActionStatus(
        updated
          ? `Frist wieder geöffnet: ${deadline.title}`
          : `Frist konnte nicht wieder geöffnet werden: ${deadline.title}`
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
      showActionStatus('Keine Review-Fristen in der Auswahl.');
      return;
    }

    openConfirmModal({
      title: 'Review-Fristen als geprüft bestätigen?',
      description: `Du bestätigst ${targets.length} Frist(en) als geprüft.`,
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText: 'Als geprüft bestätigen',
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
              const updated = await casePlatformOrchestrationService.upsertDeadline({
                ...base,
                requiresReview: false,
                detectionConfidence: Math.max(base.detectionConfidence ?? 0.78, 0.86),
                reviewedAt: now,
                reviewedBy: currentUser?.label || currentUser?.email || 'manual_user',
                updatedAt: now,
              });
              if (!updated) {
                return null;
              }
              await casePlatformOrchestrationService.appendAuditEntry({
                caseId: deadline.caseFileId || undefined,
                workspaceId: graph.cases?.[deadline.caseFileId]?.workspaceId ?? 'workspace:unknown',
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
              ? `Review bestätigt: ${succeeded} erfolgreich, ${failed} fehlgeschlagen.`
              : `Review bestätigt: ${targets.length} Frist(en) aktualisiert.`
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
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (availableCases.length === 0) {
      showActionStatus('Bitte zuerst eine Akte bzw. einen Case anlegen, bevor du eine Frist erstellst.');
      workbench.open('/all-akten');
      return;
    }

    const targetCase =
      (deepLinkMatterId
        ? availableCases.find(caseFile => caseFile.matterId === deepLinkMatterId)
        : undefined) ?? availableCases[0];

    openPromptModal({
      title: 'Neu+ Frist',
      label: 'Titel',
      inputOptions: {
        placeholder: 'z. B. Berufung einreichen @2026-03-10',
      },
      confirmText: 'Frist anlegen',
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm: async rawInput => {
        const input = rawInput.trim();
        if (!input) {
          showActionStatus('Bitte einen Fristtitel angeben.');
          return;
        }

        const parsed = input.match(/^(.*?)(?:\s*@\s*(\d{4}-\d{2}-\d{2}))?$/);
        const title = (parsed?.[1] ?? '').trim();
        const dueDateToken = parsed?.[2]?.trim();
        if (!title) {
          showActionStatus('Bitte einen Fristtitel angeben.');
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
          showActionStatus('Ungültiges Datumsformat. Bitte nutze YYYY-MM-DD, z. B. @2026-03-10.');
          return;
        }

        const created = await casePlatformOrchestrationService.upsertDeadline({
          id: createLocalRecordId('deadline'),
          title,
          dueAt: dueAtDate.toISOString(),
          derivedFrom: 'manual',
          detectionConfidence: 1,
          requiresReview: false,
          evidenceSnippets: ['Manuell erstellt über Fristen-Ansicht.'],
          sourceDocIds: [],
          priority: 'medium',
          reminderOffsetsInMinutes: [1440, 60, 15],
          status: 'open',
        });

        if (!created) {
          showActionStatus(`Frist konnte nicht angelegt werden: ${title}.`);
          return;
        }

        await store.upsertCaseFile({
          ...targetCase,
          deadlineIds: [...new Set([...(targetCase.deadlineIds ?? []), created.id])],
          updatedAt: new Date().toISOString(),
        });

        setSavedView('week');
        setFilterMode('today_week');
        setSearchQuery('');
        showActionStatus(
          `Frist angelegt: ${created.title} (fällig ${new Date(created.dueAt).toLocaleDateString(language)}).`
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
        `Frist ohne Aktenzuordnung: ${deadline.title}. Bitte Akte zuweisen, damit der Kalendereintrag direkt geöffnet werden kann.`
      );
      workbench.open('/akten');
    },
    [showActionStatus, t, workbench]
  );

  const handleMarkDeadlineReviewed = useCallback(
    async (deadline: EnrichedDeadline) => {
      const base = graph.deadlines?.[deadline.id];
      if (!base) {
        showActionStatus(`Frist konnte nicht geladen werden: ${deadline.title}`);
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
        showActionStatus(`Review-Status konnte nicht aktualisiert werden: ${deadline.title}`);
        return;
      }

      await casePlatformOrchestrationService.appendAuditEntry({
        caseId: deadline.caseFileId || undefined,
        workspaceId: graph.cases?.[deadline.caseFileId]?.workspaceId ?? 'workspace:unknown',
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

      showActionStatus(`Frist als geprüft markiert: ${deadline.title}`);
    },
    [casePlatformOrchestrationService, currentUser, graph.cases, graph.deadlines, showActionStatus]
  );

  const handleEditDeadline = useCallback(
    (deadline: EnrichedDeadline) => {
      openPromptModal({
        title: 'Frist bearbeiten',
        label: 'Titel und Fälligkeitsdatum',
        inputOptions: {
          placeholder: 'Titel @YYYY-MM-DD',
          defaultValue: `${deadline.title} @${deadline.dueAt.slice(0, 10)}`,
        },
        confirmText: 'Speichern',
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
            showActionStatus('Bitte Format nutzen: Titel @YYYY-MM-DD');
            return;
          }
          const dueAtDate = new Date(`${dueDateToken}T17:00:00`);
          if (Number.isNaN(dueAtDate.getTime())) {
            showActionStatus('Ungültiges Datum. Bitte YYYY-MM-DD verwenden.');
            return;
          }

          const base = graph.deadlines?.[deadline.id];
          if (!base) {
            showActionStatus(`Frist nicht gefunden: ${deadline.title}`);
            return;
          }

          const updated = await casePlatformOrchestrationService.upsertDeadline({
            ...base,
            title,
            dueAt: dueAtDate.toISOString(),
            updatedAt: new Date().toISOString(),
          });
          showActionStatus(
            updated
              ? `Frist aktualisiert: ${title}`
              : `Frist konnte nicht aktualisiert werden: ${deadline.title}`
          );
        },
      });
    },
    [casePlatformOrchestrationService, graph.deadlines, openPromptModal, showActionStatus, t]
  );

  const handleDeleteDeadline = useCallback(
    (deadline: EnrichedDeadline) => {
      openConfirmModal({
        title: 'Frist löschen?',
        description: `Die Frist "${deadline.title}" wird entfernt.`,
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmText: 'Löschen',
        confirmButtonOptions: {
          variant: 'error',
        },
        onConfirm: async () => {
          const ok = await casePlatformOrchestrationService.deleteDeadlineCascade(deadline.id);
          showActionStatus(
            ok
              ? `Frist gelöscht: ${deadline.title}`
              : `Frist konnte nicht gelöscht werden: ${deadline.title}`
          );
        },
      });
    },
    [casePlatformOrchestrationService, openConfirmModal, showActionStatus, t]
  );

  const handleBulkDeleteDeadlines = useCallback(() => {
    const targets = sorted.filter(deadline => bulkSelection.selectedIds.has(deadline.id));
    if (!targets.length) {
      showActionStatus('Keine Fristen ausgewählt.');
      return;
    }

    openConfirmModal({
      title: `${targets.length} Frist(en) löschen?`,
      description: 'Diese Fristen werden vollständig entfernt.',
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText: 'Löschen',
      confirmButtonOptions: {
        variant: 'error',
      },
      onConfirm: async () => {
        if (isBulkDeleting) return;
        setIsBulkDeleting(true);
        try {
          const results = await Promise.all(
            targets.map(target => casePlatformOrchestrationService.deleteDeadlineCascade(target.id))
          );
          const succeeded = results.filter(Boolean).length;
          const failed = targets.length - succeeded;
          showActionStatus(
            failed > 0
              ? `Fristen gelöscht: ${succeeded} erfolgreich, ${failed} fehlgeschlagen.`
              : `Fristen gelöscht: ${succeeded}.`
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
        return 'Kritisch (<48h)';
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
    { key: 'critical', label: t['com.affine.caseAssistant.allFristen.view.critical']() },
    { key: 'week', label: t['com.affine.caseAssistant.allFristen.view.week']() },
    { key: 'done', label: t['com.affine.caseAssistant.allFristen.view.done']() },
    { key: 'all', label: t['com.affine.caseAssistant.allFristen.view.all']() },
    { key: 'custom', label: 'Individuell' },
  ];

  return (
    <>
      <ViewTitle title={t['com.affine.caseAssistant.allFristen.title']()} />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div className={styles.body}>
          <div className={styles.srOnlyLive} aria-live="polite" aria-atomic="true">
            {actionStatus ??
              `${isCalendarDayFilterActive ? `Kalendertag aktiv: ${selectedDateLabel}.` : 'Kalendertag-Filter deaktiviert.'} ${sorted.length} Frist(en) sichtbar.${selectedDayMeta.criticalCount > 0 ? ` ${selectedDayMeta.criticalCount} kritisch (unter 48 Stunden oder überfällig).` : ''}`}
          </div>

          <section className={styles.termineCalendarPanel} aria-label="Fristen-Kalender">
            <div className={styles.termineCalendarHeader}>
              <div className={styles.termineCalendarTitleWrap}>
                <h3 className={styles.termineCalendarTitle}>Kalender</h3>
                <div className={styles.termineCalendarMeta}>
                  {selectedDateLabel} · {selectedDayMeta.count} Frist(en)
                  {selectedDayMeta.criticalCount > 0
                    ? ` · ${selectedDayMeta.criticalCount} kritisch (<48h oder überfällig)`
                    : ''}
                </div>
              </div>
              <div className={styles.termineCalendarHeaderActions}>
                <button
                  type="button"
                  className={styles.filterChipLowPriority}
                  onClick={() => setIsCalendarDayFilterActive(true)}
                  aria-pressed={isCalendarDayFilterActive}
                  aria-label="Kalendertag-Filter aktivieren"
                >
                  Tag aktivieren
                </button>
                <button
                  type="button"
                  className={styles.filterChipLowPriority}
                  onClick={() => setIsCalendarDayFilterActive(false)}
                  aria-pressed={!isCalendarDayFilterActive}
                  aria-label="Kalendertag-Filter deaktivieren, alle Fristen anzeigen"
                >
                  Alle anzeigen
                </button>
              </div>
            </div>
            <div className={styles.termineCalendarPickerWrap}>
              <DatePicker
                weekDays={t['com.affine.calendar-date-picker.week-days']()}
                monthNames={t['com.affine.calendar-date-picker.month-names']()}
                todayLabel={t['com.affine.calendar-date-picker.today']()}
                customDayRenderer={customCalendarDayRenderer}
                value={selectedDateKey}
                onChange={handleCalendarDateSelect}
                onCursorChange={setCalendarCursor}
                cellSize={34}
              />
            </div>
            <p className={styles.termineCalendarHint}>
              Klick auf einen Tag zeigt automatisch die verknüpften Fristen mit Detail-Link.
            </p>
          </section>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            {/* Row 1: Saved Views */}
            <div className={styles.filterRow}>
              <label className={styles.toolbarControl}>
                <span className={styles.toolbarLabel}>Ansicht</span>
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
                  aria-label={t['com.affine.caseAssistant.allFristen.aria.sortField']()}
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
                onClick={() => setIsCalendarDayFilterActive(current => !current)}
                aria-pressed={isCalendarDayFilterActive}
              >
                {isCalendarDayFilterActive ? `Kalendertag: ${selectedDateKey}` : 'Alle Kalendertage'}
              </button>
              <button className={`${styles.filterChip} ${styles.filterChipLowPriority}`} onClick={handleJumpToToday}>
                Heute
              </button>
            </div>

            {/* Row 2: Status filters + Sort controls + Search */}
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                {savedView !== 'all' ? (
                  <button
                    className={styles.filterChip}
                    data-active={filterMode === 'all'}
                    onClick={() => {
                      setSavedView('custom');
                      setFilterMode('all');
                    }}
                    aria-pressed={filterMode === 'all'}
                  >
                    {t.t('com.affine.caseAssistant.allFristen.filter.all', {
                      count: stats.total,
                    })}
                  </button>
                ) : null}

                {savedView !== 'critical' ? (
                  <button
                    className={styles.filterChip}
                    data-active={filterMode === 'overdue'}
                    onClick={() => {
                      setSavedView('custom');
                      setFilterMode('overdue');
                    }}
                    aria-pressed={filterMode === 'overdue'}
                  >
                    {t.t('com.affine.caseAssistant.allFristen.filter.overdue', {
                      count: stats.overdue,
                    })}
                  </button>
                ) : null}

                {savedView !== 'week' ? (
                  <button
                    className={styles.filterChip}
                    data-active={filterMode === 'today_week'}
                    onClick={() => {
                      setSavedView('custom');
                      setFilterMode('today_week');
                    }}
                    aria-pressed={filterMode === 'today_week'}
                  >
                    {t.t('com.affine.caseAssistant.allFristen.filter.todayWeek', {
                      count: stats.today + stats.thisWeek,
                    })}
                  </button>
                ) : null}

                {savedView !== 'done' ? (
                  <button
                    className={styles.filterChip}
                    data-active={filterMode === 'completed'}
                    onClick={() => {
                      setSavedView('custom');
                      setFilterMode('completed');
                    }}
                    aria-pressed={filterMode === 'completed'}
                  >
                    {t.t('com.affine.caseAssistant.allFristen.filter.completed', {
                      count: stats.completed,
                    })}
                  </button>
                ) : null}
                <button
                  className={styles.filterChip}
                  data-active={filterMode === 'needs_review'}
                  onClick={() => {
                    setSavedView('custom');
                    setFilterMode('needs_review');
                  }}
                  aria-pressed={filterMode === 'needs_review'}
                >
                  Review nötig ({stats.needsReview})
                </button>
                <button
                  className={styles.filterChip}
                  data-active={filterMode === 'low_confidence'}
                  onClick={() => {
                    setSavedView('custom');
                    setFilterMode('low_confidence');
                  }}
                  aria-pressed={filterMode === 'low_confidence'}
                >
                  Erkennungsqualität (KI) &lt; 70% ({stats.lowConfidence})
                </button>
                {reviewCandidateIds.length > 0 ? (
                  <button
                    className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                    onClick={() => {
                      bulkSelection.selectByIds(reviewCandidateIds);
                      showActionStatus(`Review-Auswahl geladen: ${reviewCandidateIds.length} Frist(en).`);
                    }}
                  >
                    Review-Fristen auswählen
                  </button>
                ) : null}
                {sorted.length > 0 ? (
                  <button
                    className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                    onClick={() => void handleBulkMarkCompleted()}
                  >
                    {t['com.affine.caseAssistant.allFristen.bulk.markCompleted']()}
                  </button>
                ) : null}
              </div>

              <div className={styles.filterGroupRight}>
                <button
                  className={styles.filterChip}
                  onClick={handleCreateDeadline}
                  aria-label="Neue Frist anlegen"
                >
                  Neu+ Frist
                </button>
                <label className={styles.toolbarControl}>
                  <span className={styles.toolbarLabel}>{t['com.affine.caseAssistant.allFristen.toolbar.sort']()}</span>
                  <select
                    className={styles.toolbarSelect}
                    value={sortKey}
                    onChange={event => setSortKey(event.target.value as SortKey)}
                    aria-label={t['com.affine.caseAssistant.allFristen.aria.sortField']()}
                  >
                    <option value="dueAt">{sortKeyLabel.dueAt}</option>
                    <option value="title">{sortKeyLabel.title}</option>
                    <option value="status">{sortKeyLabel.status}</option>
                    <option value="confidence">{sortKeyLabel.confidence}</option>
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.toolbarSortDirectionButton}
                  onClick={() => setSortDir(current => (current === 'desc' ? 'asc' : 'desc'))}
                  data-dir={sortDir}
                  aria-label={
                    sortDir === 'desc'
                      ? t['com.affine.caseAssistant.allFristen.aria.sortDirection.descToAsc']()
                      : t['com.affine.caseAssistant.allFristen.aria.sortDirection.ascToDesc']()
                  }
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
                <div className={styles.searchWrap}>
                  <input
                    ref={searchInputRef}
                    className={styles.searchInput}
                    type="text"
                    placeholder={t['com.affine.caseAssistant.allFristen.search.placeholder']()}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label={t['com.affine.caseAssistant.allFristen.aria.search']()}
                  />
                  {searchQuery ? (
                    <button
                      className={styles.searchClear}
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label={t['com.affine.caseAssistant.allFristen.aria.clearSearch']()}
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
                        el.indeterminate = bulkSelection.headerState.indeterminate;
                      }
                    }}
                    onChange={e => bulkSelection.selectAllVisible(e.target.checked)}
                    aria-label="Alle sichtbaren Fristen auswählen"
                  />
                </span>
                <span className={styles.sortButton} role="columnheader">{t['com.affine.caseAssistant.allFristen.header.deadlineAndCase']()}</span>
                <span className={styles.sortButton} role="columnheader">{t['com.affine.caseAssistant.allFristen.header.due']()}</span>
                <span className={styles.fristMeta}>{t['com.affine.caseAssistant.allFristen.header.client']()}</span>
                <span className={styles.fristMetaHideSm}>{t['com.affine.caseAssistant.allFristen.header.urgency']()}</span>
                <span className={styles.sortButton} role="columnheader">{t['com.affine.caseAssistant.allFristen.header.status']()}</span>
              </div>

              {isInitialLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div key={`fristen-skeleton-${index}`} className={styles.skeletonRow} role="row" aria-hidden="true" />
                ))
              ) : sorted.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyTitle}>
                    {isCalendarDayFilterActive
                      ? 'Keine Fristen für den gewählten Kalendertag'
                      : searchQuery || filterMode !== 'all'
                      ? t['com.affine.caseAssistant.allFristen.empty.filtered.title']()
                      : t['com.affine.caseAssistant.allFristen.empty.initial.title']()}
                  </div>
                  <div className={styles.emptyDescription}>
                    {isCalendarDayFilterActive
                      ? 'Wähle einen anderen Tag oder deaktiviere den Tagesfilter, um alle Fristen zu sehen.'
                      : searchQuery || filterMode !== 'all'
                      ? t['com.affine.caseAssistant.allFristen.empty.filtered.description']()
                      : t['com.affine.caseAssistant.allFristen.empty.initial.description']()}
                  </div>
                  <button
                    type="button"
                    className={styles.filterChip}
                    onClick={handleCreateDeadline}
                    aria-label="Neue Frist anlegen"
                  >
                    Neu+ Frist
                  </button>
                </div>
              ) : (
                sorted.map((deadline, index) => {
                  const canOpen = Boolean(deadline.caseFileId || deadline.matterId);
                  const hasEvidence = (deadline.evidenceSnippets?.length ?? 0) > 0;
                  const showDetectionQualityBadge = shouldShowDetectionQuality(deadline);
                  const confidenceLabel = formatConfidence(deadline.detectionConfidence);
                  const confidenceVariant = confidenceTone(deadline.detectionConfidence);
                  const reviewedAtLabel = formatReviewedAt(deadline.reviewedAt, language);
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
                      className={[styles.fristRow, urgencyRowClass(deadline.urgency)]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={event => {
                        if (bulkSelection.isSelectionMode) {
                          bulkSelection.toggleWithRange(deadline.id, { shiftKey: (event as any).shiftKey });
                          return;
                        }
                        handleOpenDeadlineInMainChat(deadline);
                      }}
                      onFocus={() => setFocusedIndex(index)}
                      data-focused={focusedIndex === index ? 'true' : undefined}
                      aria-label={t.t('com.affine.caseAssistant.allFristen.aria.row', {
                        title: deadline.title,
                        dueDate: formatDueDate(deadline.dueAt, language, t),
                        noCaseSuffix: canOpen
                          ? ''
                          : `, ${t['com.affine.caseAssistant.allFristen.aria.row.noCase']()}`,
                      })}
                    >
                    <div className={styles.selectionCell} onClick={e => e.stopPropagation()}>
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
                        aria-label={`Frist auswählen: ${deadline.title}`}
                      />
                    </div>
                    <div className={styles.fristMainCell}>
                      <div className={styles.fristTitle}>{deadline.title}</div>
                      <div className={styles.fristSubtitle}>
                        {deadline.matterExternalRef
                          ? `${deadline.matterExternalRef} — `
                          : ''}
                        {deadline.matterTitle || t['com.affine.caseAssistant.allFristen.fallback.none']()}
                      </div>
                      <div className={styles.deadlineInsightRow}>
                        {showDetectionQualityBadge ? (
                          <span
                            className={styles.deadlineConfidenceBadge}
                            data-tone={confidenceVariant}
                            title={DETECTION_QUALITY_EXPLANATION}
                            aria-label={`Erkennungsqualität (KI) für automatische Fristerkennung: ${confidenceLabel}`}
                          >
                            Erkennungsqualität (KI): {confidenceLabel}
                          </span>
                        ) : null}
                        {deadline.requiresReview ? (
                          <span className={styles.deadlineReviewBadge}>Review nötig</span>
                        ) : null}
                        {deadline.derivedFrom ? (
                          <span className={styles.deadlineSourceTag}>{deadline.derivedFrom}</span>
                        ) : null}
                        {deadline.requiresReview ? (
                          <button
                            type="button"
                            className={styles.deadlineReviewAction}
                            onClick={event => {
                              event.stopPropagation();
                              handleMarkDeadlineReviewed(deadline).catch(() => {
                                showActionStatus(`Review-Status konnte nicht aktualisiert werden: ${deadline.title}`);
                              });
                            }}
                          >
                            Als geprüft bestätigen
                          </button>
                        ) : null}

                        {deadline.status !== 'completed' && deadline.status !== 'expired' ? (
                          <button
                            type="button"
                            className={styles.deadlineReviewAction}
                            onClick={event => {
                              event.stopPropagation();
                              handleMarkDeadlineCompleted(deadline).catch(() => {
                                showActionStatus(`Frist konnte nicht als erledigt markiert werden: ${deadline.title}`);
                              });
                            }}
                          >
                            Extern erledigt
                          </button>
                        ) : null}

                        {deadline.status === 'completed' || deadline.status === 'expired' ? (
                          <button
                            type="button"
                            className={styles.deadlineReviewAction}
                            onClick={event => {
                              event.stopPropagation();
                              handleReopenDeadline(deadline).catch(() => {
                                showActionStatus(`Frist konnte nicht wieder geöffnet werden: ${deadline.title}`);
                              });
                            }}
                          >
                            Wieder öffnen
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
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className={styles.deadlineReviewAction}
                          onClick={event => {
                            event.stopPropagation();
                            handleDeleteDeadline(deadline);
                          }}
                        >
                          Löschen
                        </button>
                      </div>
                      {hasEvidence ? (
                        <div className={styles.deadlineEvidencePreview}>
                          Evidenz: {evidencePreview}
                        </div>
                      ) : null}
                      {!deadline.requiresReview && reviewedAtLabel ? (
                        <div className={styles.deadlineReviewedMeta}>
                          Geprüft: {reviewedAtLabel}
                          {deadline.reviewedBy ? ` • ${deadline.reviewedBy}` : ''}
                        </div>
                      ) : null}
                    </div>
                    <span className={[styles.dueDate, dueDateClass(deadline)].filter(Boolean).join(' ')}>
                      {formatDueDate(deadline.dueAt, language, t)}
                    </span>
                    <span className={styles.fristMeta}>
                      {deadline.clientName || t['com.affine.caseAssistant.allFristen.fallback.none']()}
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
            selectionLabel={`${bulkSelection.selectedCount} Frist(en) ausgewählt`}
            isRunning={isBulkCompleting || isBulkReviewing || isBulkDeleting}
            primaryLabel={
              bulkPrimaryMode === 'review'
                ? `Review bestätigen (${selectedReviewCount})`
                : 'Als erledigt markieren'
            }
            onPrimary={() =>
              void (bulkPrimaryMode === 'review'
                ? handleBulkMarkReviewed()
                : handleBulkMarkCompleted())
            }
            canDelete={bulkSelection.selectedCount > 0}
            deleteLabel="Löschen"
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
