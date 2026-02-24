import { useConfirmModal, usePromptModal } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  GerichtsterminService,
  TERMIN_STATUS_LABELS,
  TERMINART_LABELS,
} from '../../../../modules/case-assistant';
import { CaseAssistantStore } from '../../../../modules/case-assistant/stores/case-assistant';
import type {
  ClientRecord,
  Gerichtstermin,
  MatterRecord,
} from '../../../../modules/case-assistant/types';
import { ViewBody, ViewIcon, ViewTitle } from '../../../../modules/workbench';
import { WorkbenchService } from '../../../../modules/workbench';
import * as styles from '../all-fristen/all-fristen.css';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { BulkActionBar } from '../layouts/bulk-action-bar';
import { useBulkSelection } from '../layouts/use-bulk-selection';

type TerminFilterMode = 'all' | 'upcoming' | 'past' | 'cancelled';
type SortKey = 'datum' | 'gericht' | 'status' | 'terminart';
type SortDir = 'asc' | 'desc';
type ReviewFilter = 'all' | 'needs_review' | 'no_review';
type KategorieFilter =
  | 'all'
  | 'gerichtstermin'
  | 'gespraech'
  | 'sonstiger'
  | 'unknown';
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low' | 'unknown';

interface EnrichedTermin extends Gerichtstermin {
  matterTitle: string;
  matterExternalRef: string;
  clientName: string;
  clientId: string;
  matterStatus?: MatterRecord['status'];
  matterTrashedAt?: string;
  sourceDocTitles: string[];
  sourceDocRefs: { id: string; title: string }[];
}

function toDateKey(raw: string | undefined | null): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getTerminUrgency(
  item: Gerichtstermin
): 'critical' | 'soon' | 'normal' {
  if (item.status === 'abgesagt' || item.status === 'abgeschlossen') {
    return 'normal';
  }
  const dueAt = new Date(item.datum).getTime();
  if (!Number.isFinite(dueAt)) {
    return 'normal';
  }
  const now = Date.now();
  const diffHours = (dueAt - now) / (1000 * 60 * 60);
  if (dueAt < now || diffHours <= 48) {
    return 'critical';
  }
  if (diffHours <= 24 * 7) {
    return 'soon';
  }
  return 'normal';
}

function formatDateTime(datum: string, uhrzeit?: string, language = 'de') {
  const baseDate = new Date(datum);
  if (Number.isNaN(baseDate.getTime())) {
    return datum;
  }
  const day = baseDate.toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return uhrzeit ? `${day} ${uhrzeit}` : day;
}

function statusSortRank(status: Gerichtstermin['status']): number {
  switch (status) {
    case 'geplant':
      return 0;
    case 'bestaetigt':
      return 1;
    case 'verschoben':
      return 2;
    case 'abgeschlossen':
      return 3;
    case 'abgesagt':
    default:
      return 4;
  }
}

function parseDateTimeInput(
  raw: string
): { isoDate: string; time?: string } | null {
  const value = raw.trim();
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?$/);
  if (!match) {
    return null;
  }
  return {
    isoDate: `${match[1]}T00:00:00.000Z`,
    time: match[2] ?? undefined,
  };
}

function confidenceBucket(
  confidence?: number
): 'high' | 'medium' | 'low' | 'unknown' {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence))
    return 'unknown';
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

function confidenceLabel(confidence?: number) {
  const bucket = confidenceBucket(confidence);
  switch (bucket) {
    case 'high':
      return 'Confidence: hoch';
    case 'medium':
      return 'Confidence: mittel';
    case 'low':
      return 'Confidence: niedrig';
    default:
      return 'Confidence: unbekannt';
  }
}

export const AllTerminePage = () => {
  const t = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const workbench = useService(WorkbenchService).workbench;
  const store = useService(CaseAssistantStore);
  const terminService = useService(GerichtsterminService);
  const { openPromptModal } = usePromptModal();
  const { openConfirmModal } = useConfirmModal();

  const graph = useLiveData(store.watchGraph());
  const legalDocs = useLiveData(store.watchLegalDocuments()) ?? [];
  const termine =
    useLiveData(
      useMemo(
        () => LiveData.from(terminService.termineList$, []),
        [terminService]
      )
    ) ?? [];

  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const deepLinkMatterId = query.get('matterId')?.trim() ?? '';
  const deepLinkClientId = query.get('clientId')?.trim() ?? '';
  const urlMode = query.get('mode')?.trim() ?? '';

  const [filterMode, setFilterMode] = useState<TerminFilterMode>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('datum');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [kategorieFilter, setKategorieFilter] =
    useState<KategorieFilter>('all');
  const [confidenceFilter, setConfidenceFilter] =
    useState<ConfidenceFilter>('all');
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    dayjs().format('YYYY-MM-DD')
  );
  const [isCalendarDayFilterActive, setIsCalendarDayFilterActive] =
    useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);

  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkReviewing, setIsBulkReviewing] = useState(false);

  const language = t.language || 'de';
  const actionStatusTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const timer = window.setTimeout(() => setShowInitialSkeleton(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

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

  const matters = useMemo(() => graph.matters ?? {}, [graph.matters]);
  const clients = useMemo(() => graph.clients ?? {}, [graph.clients]);
  const caseFiles = useMemo(() => graph.cases ?? {}, [graph.cases]);

  const applyReviewPreset = useCallback((mode: 'review' | 'default') => {
    if (mode === 'review') {
      setFilterMode('upcoming');
      setReviewFilter('needs_review');
      setKategorieFilter('all');
      setConfidenceFilter('all');
      setSearchQuery('');
    } else {
      setReviewFilter('all');
    }
  }, []);

  useEffect(() => {
    if (urlMode === 'review') {
      applyReviewPreset('review');
    }
  }, [applyReviewPreset, urlMode]);

  const legalDocTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of legalDocs) {
      map.set(doc.id, doc.title);
    }
    return map;
  }, [legalDocs]);

  const legalDocById = useMemo(() => {
    const map = new Map<string, (typeof legalDocs)[number]>();
    for (const doc of legalDocs) {
      map.set(doc.id, doc);
    }
    return map;
  }, [legalDocs]);

  const enriched: EnrichedTermin[] = useMemo(() => {
    return termine.map(termin => {
      const matter = matters[termin.matterId] as MatterRecord | undefined;
      const client = matter?.clientId
        ? (clients[matter.clientId] as ClientRecord | undefined)
        : undefined;
      const sourceDocTitles = (termin.sourceDocIds ?? [])
        .map((id: string) => legalDocTitleById.get(id) ?? `Dokument: ${id}`)
        .filter(Boolean);
      const sourceDocRefs = (termin.sourceDocIds ?? []).map((id: string) => ({
        id,
        title: legalDocTitleById.get(id) ?? `Dokument: ${id}`,
      }));
      return {
        ...termin,
        matterTitle: matter?.title ?? '',
        matterExternalRef: matter?.externalRef ?? '',
        clientName: client?.displayName ?? '',
        clientId: client?.id ?? '',
        matterStatus: matter?.status,
        matterTrashedAt: matter?.trashedAt,
        sourceDocTitles,
        sourceDocRefs,
      };
    });
  }, [clients, legalDocTitleById, matters, termine]);

  const handleOpenSourceDocument = useCallback(
    (docId: string, item: EnrichedTermin) => {
      const doc = legalDocById.get(docId);
      if (!doc) {
        showActionStatus(
          'Quelle nicht mehr verfügbar (Dokument wurde gelöscht oder ist nicht indexiert).'
        );
        return;
      }

      const params = new URLSearchParams({
        caMatterId: item.matterId,
        caClientId: item.clientId,
      });
      workbench.open(`/${doc.caseId}?${params.toString()}`);
      workbench.openSidebar();
      window.setTimeout(() => {
        workbench.activeView$.value?.activeSidebarTab('case-assistant');
      }, 0);
    },
    [legalDocById, showActionStatus, workbench]
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const upcoming = enriched.filter(item => {
      if (item.status === 'abgesagt' || item.status === 'abgeschlossen')
        return false;
      return new Date(item.datum).getTime() >= now;
    }).length;
    const past = enriched.filter(item => {
      if (item.status === 'abgeschlossen' || item.status === 'abgesagt')
        return true;
      return new Date(item.datum).getTime() < now;
    }).length;
    const cancelled = enriched.filter(
      item => item.status === 'abgesagt'
    ).length;
    return {
      total: enriched.length,
      upcoming,
      past,
      cancelled,
    };
  }, [enriched]);

  const calendarDayMeta = useMemo(() => {
    const map = new Map<string, { count: number; criticalCount: number }>();
    const filteredByContext = enriched.filter(item => {
      if (!deepLinkMatterId && item.matterId) {
        if (item.matterTrashedAt) return false;
        if (item.matterStatus === 'archived') return false;
      }
      if (deepLinkMatterId && item.matterId !== deepLinkMatterId) return false;
      if (deepLinkClientId && item.clientId !== deepLinkClientId) return false;
      return true;
    });

    for (const item of filteredByContext) {
      const key = toDateKey(item.datum);
      if (!key) continue;
      const prev = map.get(key) ?? { count: 0, criticalCount: 0 };
      const next = {
        count: prev.count + 1,
        criticalCount:
          prev.criticalCount + (getTerminUrgency(item) === 'critical' ? 1 : 0),
      };
      map.set(key, next);
    }

    return map;
  }, [deepLinkClientId, deepLinkMatterId, enriched]);

  const selectedDayMeta = useMemo(() => {
    return (
      calendarDayMeta.get(selectedDateKey) ?? { count: 0, criticalCount: 0 }
    );
  }, [calendarDayMeta, selectedDateKey]);

  const selectedDateLabel = useMemo(() => {
    const parsed = new Date(selectedDateKey);
    if (Number.isNaN(parsed.getTime())) return selectedDateKey;
    return parsed.toLocaleDateString(language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      weekday: 'short',
    });
  }, [language, selectedDateKey]);

  const handleJumpToToday = useCallback(() => {
    const todayKey = dayjs().format('YYYY-MM-DD');
    setSelectedDateKey(todayKey);
    setIsCalendarDayFilterActive(true);
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    let result = enriched;

    // Kanzlei-Logik: Termine von archivierten/gelöschten Akten sind nicht im Tagesgeschäft.
    // Restore bringt sie wieder zurück. Deep-Link auf eine konkrete Akte zeigt trotzdem alles.
    if (!deepLinkMatterId) {
      result = result.filter(item => {
        if (!item.matterId) return true;
        if (item.matterTrashedAt) return false;
        if (item.matterStatus === 'archived') return false;
        return true;
      });
    }

    if (isCalendarDayFilterActive) {
      result = result.filter(item => toDateKey(item.datum) === selectedDateKey);
    } else {
      switch (filterMode) {
        case 'upcoming':
          result = result.filter(item => {
            if (item.status === 'abgesagt' || item.status === 'abgeschlossen')
              return false;
            return new Date(item.datum).getTime() >= now;
          });
          break;
        case 'past':
          result = result.filter(item => {
            if (item.status === 'abgeschlossen' || item.status === 'abgesagt')
              return true;
            return new Date(item.datum).getTime() < now;
          });
          break;
        case 'cancelled':
          result = result.filter(item => item.status === 'abgesagt');
          break;
        case 'all':
        default:
          break;
      }
    }

    if (reviewFilter !== 'all') {
      result = result.filter(item => {
        const needsReview = Boolean(item.requiresReview);
        return reviewFilter === 'needs_review' ? needsReview : !needsReview;
      });
    }

    if (kategorieFilter !== 'all') {
      result = result.filter(item => {
        const k = item.kategorie ?? 'unknown';
        return k === kategorieFilter;
      });
    }

    if (confidenceFilter !== 'all') {
      result = result.filter(
        item => confidenceBucket(item.detectionConfidence) === confidenceFilter
      );
    }

    if (deepLinkMatterId) {
      result = result.filter(item => item.matterId === deepLinkMatterId);
    }
    if (deepLinkClientId) {
      result = result.filter(item => item.clientId === deepLinkClientId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        return (
          TERMINART_LABELS[item.terminart].toLowerCase().includes(q) ||
          item.gericht.toLowerCase().includes(q) ||
          item.matterTitle.toLowerCase().includes(q) ||
          item.clientName.toLowerCase().includes(q) ||
          item.sourceDocTitles.some(title => title.toLowerCase().includes(q)) ||
          (item.evidenceSnippets ?? []).some(snippet =>
            snippet.toLowerCase().includes(q)
          )
        );
      });
    }

    return result;
  }, [
    confidenceFilter,
    deepLinkClientId,
    deepLinkMatterId,
    enriched,
    filterMode,
    isCalendarDayFilterActive,
    kategorieFilter,
    reviewFilter,
    searchQuery,
    selectedDateKey,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'gericht':
          cmp = a.gericht.localeCompare(b.gericht, language);
          break;
        case 'status':
          cmp = statusSortRank(a.status) - statusSortRank(b.status);
          break;
        case 'terminart':
          cmp = TERMINART_LABELS[a.terminart].localeCompare(
            TERMINART_LABELS[b.terminart],
            language
          );
          break;
        case 'datum':
        default:
          cmp = new Date(a.datum).getTime() - new Date(b.datum).getTime();
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, language, sortDir, sortKey]);

  const hasAdvancedFiltersApplied =
    reviewFilter !== 'all' ||
    kategorieFilter !== 'all' ||
    confidenceFilter !== 'all' ||
    sortKey !== 'datum' ||
    sortDir !== 'asc' ||
    searchQuery.trim().length > 0;

  const bulkSelection = useBulkSelection({
    itemIds: useMemo(() => sorted.map(item => item.id), [sorted]),
  });

  const srSummaryText = useMemo(() => {
    const dayScope = isCalendarDayFilterActive
      ? `Kalendertag aktiv: ${selectedDateLabel}.`
      : 'Kalendertag-Filter deaktiviert.';
    const criticalText =
      selectedDayMeta.criticalCount > 0
        ? ` ${selectedDayMeta.criticalCount} kritisch (unter 48 Stunden oder überfällig).`
        : '';
    return `${dayScope} ${sorted.length} Termin(e) sichtbar.${criticalText}`;
  }, [
    isCalendarDayFilterActive,
    selectedDateLabel,
    selectedDayMeta.criticalCount,
    sorted.length,
  ]);

  const handleOpenTermin = useCallback(
    (item: EnrichedTermin) => {
      if (!item.matterId) {
        showActionStatus('Termin hat keine Aktenzuordnung.');
        return;
      }
      const params = new URLSearchParams({
        caMatterId: item.matterId,
        caSidebar: 'anwalts-workflow',
        caWorkflowTab: 'termine',
      });
      if (item.clientId) {
        params.set('caClientId', item.clientId);
      }
      workbench.open(`/akten/${item.matterId}?${params.toString()}`);
    },
    [showActionStatus, workbench]
  );

  const handleCreateTermin = useCallback(async () => {
    const allCases = Object.values(caseFiles);
    if (allCases.length === 0) {
      showActionStatus('Bitte zuerst eine Akte/Case anlegen.');
      workbench.open('/akten');
      return;
    }

    const targetCase =
      (deepLinkMatterId
        ? allCases.find(caseFile => caseFile.matterId === deepLinkMatterId)
        : undefined) ??
      [...allCases].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];

    if (!targetCase?.matterId) {
      showActionStatus('Kein gültiger Case mit Akte gefunden.');
      return;
    }
    const targetMatterId = targetCase.matterId;

    openPromptModal({
      title: 'Neu+ Termin',
      label: 'Gericht + Datum / Uhrzeit',
      inputOptions: {
        placeholder: 'z. B. LG Wien @2026-03-10 09:30',
      },
      confirmText: 'Termin anlegen',
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmButtonOptions: { variant: 'primary' },
      onConfirm: async rawValue => {
        const input = rawValue.trim();
        if (!input) {
          showActionStatus('Bitte Gericht und Terminzeit angeben.');
          return;
        }

        const parsed = input.match(
          /^(.*?)(?:\s*@\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?))?$/
        );
        const gerichtValue = (parsed?.[1] ?? '').trim();
        const dateToken = parsed?.[2]?.trim();

        if (!gerichtValue) {
          showActionStatus('Bitte Gericht angeben.');
          return;
        }

        const dateTime = dateToken ? parseDateTimeInput(dateToken) : null;
        const fallbackDate = dayjs().add(7, 'day').format('YYYY-MM-DD');

        const isoDate = dateTime?.isoDate ?? `${fallbackDate}T00:00:00.000Z`;
        const time = dateTime?.time ?? '09:00';

        await terminService.createTermin({
          workspaceId: targetCase.workspaceId,
          caseId: targetCase.id,
          matterId: targetMatterId,
          terminart: 'muendliche_verhandlung',
          datum: isoDate,
          uhrzeit: time,
          gericht: gerichtValue,
          teilnehmer: [],
        });

        showActionStatus('Termin angelegt.');
      },
    });
  }, [
    caseFiles,
    deepLinkMatterId,
    openPromptModal,
    showActionStatus,
    t,
    terminService,
    workbench,
  ]);

  const handleRescheduleTermin = useCallback(
    (item: EnrichedTermin) => {
      openPromptModal({
        title: 'Termin verschieben',
        label: 'Neues Datum / Uhrzeit',
        inputOptions: {
          placeholder: 'YYYY-MM-DD oder YYYY-MM-DD HH:MM',
        },
        confirmText: 'Verschieben',
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmButtonOptions: { variant: 'primary' },
        onConfirm: async rawValue => {
          const parsed = parseDateTimeInput(rawValue);
          if (!parsed) {
            showActionStatus(
              'Ungültiges Format. Bitte YYYY-MM-DD oder YYYY-MM-DD HH:MM nutzen.'
            );
            return;
          }
          await terminService.rescheduleTermin(
            item.id,
            parsed.isoDate,
            parsed.time
          );
          showActionStatus('Termin verschoben.');
        },
      });
    },
    [openPromptModal, showActionStatus, t, terminService]
  );

  const handleCancelTermin = useCallback(
    (item: EnrichedTermin) => {
      openPromptModal({
        title: 'Termin absagen',
        label: 'Grund (optional)',
        inputOptions: {
          placeholder: 'z. B. Terminkollision',
        },
        confirmText: 'Absagen',
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmButtonOptions: { variant: 'error' },
        onConfirm: async rawReason => {
          await terminService.cancelTermin(
            item.id,
            rawReason.trim() || undefined
          );
          showActionStatus('Termin abgesagt.');
        },
      });
    },
    [openPromptModal, showActionStatus, t, terminService]
  );

  const handleCompleteTermin = useCallback(
    (item: EnrichedTermin) => {
      openPromptModal({
        title: 'Termin abschließen',
        label: 'Ergebnis / Protokoll',
        inputOptions: {
          placeholder: 'Kurz zusammenfassen …',
        },
        confirmText: 'Abschließen',
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmButtonOptions: { variant: 'primary' },
        onConfirm: async rawResult => {
          const result = rawResult.trim();
          if (!result) {
            showActionStatus('Bitte Ergebnis eingeben.');
            return;
          }
          await terminService.completeTermin(item.id, result);
          showActionStatus('Termin abgeschlossen.');
        },
      });
    },
    [openPromptModal, showActionStatus, t, terminService]
  );

  const handleDeleteTermin = useCallback(
    (item: EnrichedTermin) => {
      openConfirmModal({
        title: 'Termin löschen?',
        description: `${TERMINART_LABELS[item.terminart]} am ${formatDateTime(item.datum, item.uhrzeit, language)} wird gelöscht.`,
        cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
        confirmText: 'Löschen',
        confirmButtonOptions: { variant: 'error' },
        onConfirm: async () => {
          await terminService.deleteTermin(item.id);
          showActionStatus('Termin gelöscht.');
        },
      });
    },
    [language, openConfirmModal, showActionStatus, t, terminService]
  );

  const handleBulkConfirm = useCallback(async () => {
    const targets = sorted.filter(
      item =>
        bulkSelection.selectedIds.has(item.id) && item.status === 'geplant'
    );
    if (!targets.length) {
      showActionStatus('Keine geplanten Termine in der Auswahl.');
      return;
    }
    setIsBulkConfirming(true);
    try {
      await Promise.all(
        targets.map(target => terminService.confirmTermin(target.id))
      );
      showActionStatus(`${targets.length} Termin(e) bestätigt.`);
      bulkSelection.clear();
    } finally {
      setIsBulkConfirming(false);
    }
  }, [bulkSelection, showActionStatus, sorted, terminService]);

  const handleMarkTerminReviewed = useCallback(
    async (item: EnrichedTermin) => {
      const base = graph.termine?.[item.id];
      if (!base) {
        showActionStatus('Termin nicht gefunden.');
        return;
      }
      const updated = await terminService.updateTermin(item.id, {
        requiresReview: false,
        detectionConfidence: Math.max(base.detectionConfidence ?? 0.72, 0.86),
      });
      showActionStatus(
        updated
          ? 'Review als erledigt markiert.'
          : 'Review konnte nicht aktualisiert werden.'
      );
    },
    [graph.termine, showActionStatus, terminService]
  );

  const handleBulkMarkReviewed = useCallback(() => {
    const targets = sorted.filter(
      item =>
        bulkSelection.selectedIds.has(item.id) && Boolean(item.requiresReview)
    );
    if (!targets.length) {
      showActionStatus('Keine Review-Termine in der Auswahl.');
      return;
    }

    openConfirmModal({
      title: 'Review-Termine als geprüft bestätigen?',
      description: `Du bestätigst ${targets.length} Termin(e) als geprüft.`,
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText: 'Als geprüft bestätigen',
      confirmButtonOptions: { variant: 'primary' },
      onConfirm: async () => {
        if (isBulkReviewing) return;
        setIsBulkReviewing(true);
        try {
          const results = await Promise.all(
            targets.map(async item => {
              const base = graph.termine?.[item.id];
              if (!base) return null;
              return await terminService.updateTermin(item.id, {
                requiresReview: false,
                detectionConfidence: Math.max(
                  base.detectionConfidence ?? 0.72,
                  0.86
                ),
              });
            })
          );
          const succeeded = results.filter(Boolean).length;
          const failed = targets.length - succeeded;
          showActionStatus(
            failed > 0
              ? `Review erledigt: ${succeeded} erfolgreich, ${failed} fehlgeschlagen.`
              : `Review erledigt: ${targets.length} Termin(e) aktualisiert.`
          );
          bulkSelection.clear();
        } finally {
          setIsBulkReviewing(false);
        }
      },
    });
  }, [
    bulkSelection,
    graph.termine,
    isBulkReviewing,
    openConfirmModal,
    showActionStatus,
    sorted,
    t,
    terminService,
  ]);

  const handleBulkDelete = useCallback(() => {
    const targets = sorted.filter(item =>
      bulkSelection.selectedIds.has(item.id)
    );
    if (!targets.length) {
      showActionStatus('Keine Termine ausgewählt.');
      return;
    }
    openConfirmModal({
      title: `${targets.length} Termin(e) löschen?`,
      description: 'Diese Aktion kann nicht rückgängig gemacht werden.',
      cancelText: t['com.affine.auth.sign-out.confirm-modal.cancel'](),
      confirmText: 'Löschen',
      confirmButtonOptions: { variant: 'error' },
      onConfirm: async () => {
        setIsBulkDeleting(true);
        try {
          await Promise.all(
            targets.map(target => terminService.deleteTermin(target.id))
          );
          showActionStatus(`${targets.length} Termin(e) gelöscht.`);
          bulkSelection.clear();
        } finally {
          setIsBulkDeleting(false);
        }
      },
    });
  }, [
    bulkSelection,
    openConfirmModal,
    showActionStatus,
    sorted,
    t,
    terminService,
  ]);

  const handleShowTerminDetails = useCallback(
    (item: EnrichedTermin) => {
      openConfirmModal({
        title: 'Termin-Details',
        cancelText: 'Schließen',
        confirmText: item.status === 'geplant' ? 'Bestätigen' : 'OK',
        confirmButtonOptions: { variant: 'primary' },
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600 }}>
                {TERMINART_LABELS[item.terminart]} —{' '}
                {formatDateTime(item.datum, item.uhrzeit, language)}
              </div>
              {item.gericht ? (
                <div style={{ opacity: 0.8 }}>{item.gericht}</div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {item.kategorie ? (
                  <span
                    className={`${styles.statusBadge} ${item.kategorie === 'gerichtstermin' ? styles.statusPending : styles.statusCompleted}`}
                  >
                    {item.kategorie === 'gerichtstermin'
                      ? 'Gericht'
                      : item.kategorie === 'gespraech'
                        ? 'Gespräch'
                        : 'Sonstiges'}
                  </span>
                ) : (
                  <span
                    className={`${styles.statusBadge} ${styles.statusPending}`}
                  >
                    Kategorie: unbekannt
                  </span>
                )}
                <span
                  className={`${styles.statusBadge} ${
                    confidenceBucket(item.detectionConfidence) === 'high'
                      ? styles.statusCompleted
                      : confidenceBucket(item.detectionConfidence) === 'medium'
                        ? styles.statusPending
                        : confidenceBucket(item.detectionConfidence) === 'low'
                          ? styles.statusExpired
                          : styles.statusPending
                  }`}
                >
                  {confidenceLabel(item.detectionConfidence)}
                </span>
                {item.requiresReview ? (
                  <span
                    className={`${styles.statusBadge} ${styles.statusExpired}`}
                  >
                    Review nötig
                  </span>
                ) : (
                  <span
                    className={`${styles.statusBadge} ${styles.statusCompleted}`}
                  >
                    Review ok
                  </span>
                )}
                {item.derivedFrom ? (
                  <span
                    className={`${styles.statusBadge} ${styles.statusPending}`}
                  >
                    Quelle: {item.derivedFrom}
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600 }}>Quellen</div>
              {item.sourceDocTitles.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {item.sourceDocRefs.map(ref => (
                    <li key={`${item.id}-source-${ref.id}`}>
                      <button
                        type="button"
                        className={styles.deadlineReviewAction}
                        onClick={e => {
                          e.preventDefault();
                          handleOpenSourceDocument(ref.id, item);
                        }}
                        aria-label={`Quelle öffnen: ${ref.title}`}
                      >
                        {ref.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ opacity: 0.75 }}>(keine Quelle gespeichert)</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600 }}>Evidence</div>
              {(item.evidenceSnippets ?? []).length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(item.evidenceSnippets ?? []).map((line, idx) => (
                    <li key={`${item.id}-evidence-${idx}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ opacity: 0.75 }}>(keine Evidence-Snippets)</div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 4,
              }}
            >
              {item.requiresReview ? (
                <button
                  type="button"
                  className={styles.deadlineReviewAction}
                  onClick={e => {
                    e.preventDefault();
                    handleMarkTerminReviewed(item).catch(() => {
                      showActionStatus(
                        'Review konnte nicht aktualisiert werden.'
                      );
                    });
                  }}
                >
                  Review erledigt
                </button>
              ) : null}
              {item.status !== 'abgesagt' && item.status !== 'abgeschlossen' ? (
                <button
                  type="button"
                  className={styles.deadlineReviewAction}
                  onClick={e => {
                    e.preventDefault();
                    handleRescheduleTermin(item);
                  }}
                >
                  Verschieben
                </button>
              ) : null}
              {item.status !== 'abgesagt' && item.status !== 'abgeschlossen' ? (
                <button
                  type="button"
                  className={styles.deadlineReviewAction}
                  onClick={e => {
                    e.preventDefault();
                    handleCancelTermin(item);
                  }}
                >
                  Absagen
                </button>
              ) : null}
              {item.status !== 'abgeschlossen' ? (
                <button
                  type="button"
                  className={styles.deadlineReviewAction}
                  onClick={e => {
                    e.preventDefault();
                    handleCompleteTermin(item);
                  }}
                >
                  Abschließen
                </button>
              ) : null}
              <button
                type="button"
                className={styles.deadlineReviewAction}
                onClick={e => {
                  e.preventDefault();
                  handleDeleteTermin(item);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        ),
        childrenContentClassName: undefined,
        onConfirm: async () => {
          if (item.status === 'geplant') {
            await terminService.confirmTermin(item.id);
            showActionStatus('Termin bestätigt.');
          }
        },
      });
    },
    [
      handleCancelTermin,
      handleCompleteTermin,
      handleDeleteTermin,
      handleMarkTerminReviewed,
      handleRescheduleTermin,
      language,
      openConfirmModal,
      showActionStatus,
      terminService,
    ]
  );

  const bulkPrimaryAction = useCallback(() => {
    const selected = sorted.filter(item =>
      bulkSelection.selectedIds.has(item.id)
    );
    if (selected.some(item => item.status === 'geplant')) {
      handleBulkConfirm().catch(() => {
        showActionStatus(
          'Bulk-Bestätigung fehlgeschlagen. Bitte erneut versuchen.'
        );
      });
      return;
    }
    if (selected.some(item => Boolean(item.requiresReview))) {
      handleBulkMarkReviewed();
      return;
    }
    showActionStatus('Keine passende Bulk-Aktion für die Auswahl.');
  }, [
    bulkSelection.selectedIds,
    handleBulkConfirm,
    handleBulkMarkReviewed,
    showActionStatus,
    sorted,
  ]);

  const bulkPrimaryLabel = useMemo(() => {
    const selected = sorted.filter(item =>
      bulkSelection.selectedIds.has(item.id)
    );
    if (selected.some(item => item.status === 'geplant')) return 'Bestätigen';
    if (selected.some(item => Boolean(item.requiresReview)))
      return 'Review erledigt';
    return 'Aktion';
  }, [bulkSelection.selectedIds, sorted]);

  const isInitialLoading = showInitialSkeleton && termine.length === 0;

  return (
    <>
      <ViewTitle title="Termine" />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div className={styles.body}>
          <div
            className={styles.srOnlyLive}
            aria-live="polite"
            aria-atomic="true"
          >
            {actionStatus ?? srSummaryText}
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <button
                  type="button"
                  className={styles.filterChip}
                  data-active={isCalendarDayFilterActive}
                  onClick={() =>
                    setIsCalendarDayFilterActive(current => !current)
                  }
                  aria-pressed={isCalendarDayFilterActive}
                  aria-label={
                    isCalendarDayFilterActive
                      ? 'Kalendertag-Filter deaktivieren'
                      : 'Kalendertag-Filter aktivieren'
                  }
                >
                  {isCalendarDayFilterActive
                    ? `Kalendertag: ${selectedDateKey}`
                    : 'Alle Tage'}
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                  onClick={handleJumpToToday}
                >
                  Heute
                </button>
                <label className={styles.toolbarControl}>
                  <span className={styles.toolbarLabel}>Ansicht</span>
                  <select
                    className={styles.toolbarSelect}
                    value={filterMode}
                    onChange={event =>
                      setFilterMode(event.target.value as TerminFilterMode)
                    }
                    aria-label="Termin-Statusfilter"
                  >
                    <option value="all">Alle ({stats.total})</option>
                    <option value="upcoming">Kommend ({stats.upcoming})</option>
                    <option value="past">Historie ({stats.past})</option>
                    <option value="cancelled">
                      Abgesagt ({stats.cancelled})
                    </option>
                  </select>
                </label>
              </div>
              <div className={styles.filterGroupRight}>
                <button
                  type="button"
                  className={styles.filterChip}
                  data-active={urlMode === 'review'}
                  onClick={() => {
                    const next = new URLSearchParams(location.search);
                    if (urlMode === 'review') {
                      applyReviewPreset('default');
                      next.delete('mode');
                    } else {
                      applyReviewPreset('review');
                      next.set('mode', 'review');
                    }
                    navigate({ search: next.toString() }, { replace: true });
                  }}
                >
                  {urlMode === 'review' ? 'Review-Queue: An' : 'Review-Queue'}
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                  data-active={showAdvancedFilters}
                  onClick={() => setShowAdvancedFilters(current => !current)}
                  aria-pressed={showAdvancedFilters}
                >
                  {showAdvancedFilters
                    ? 'Erweiterte Filter ausblenden'
                    : 'Erweiterte Filter'}
                </button>

                {!showAdvancedFilters && hasAdvancedFiltersApplied ? (
                  <>
                    <span className={styles.filterChip}>Filter aktiv</span>
                    <button
                      type="button"
                      className={`${styles.filterChip} ${styles.filterChipLowPriority}`}
                      onClick={() => {
                        setReviewFilter('all');
                        setKategorieFilter('all');
                        setConfidenceFilter('all');
                        setSortKey('datum');
                        setSortDir('asc');
                        setSearchQuery('');
                      }}
                    >
                      Filter zurücksetzen
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                {showAdvancedFilters ? (
                  <>
                    <label className={styles.toolbarControl}>
                      <span className={styles.toolbarLabel}>Review</span>
                      <select
                        className={styles.toolbarSelect}
                        value={reviewFilter}
                        onChange={event =>
                          setReviewFilter(event.target.value as ReviewFilter)
                        }
                      >
                        <option value="all">Alle</option>
                        <option value="needs_review">Review nötig</option>
                        <option value="no_review">Ohne Review</option>
                      </select>
                    </label>
                    <label className={styles.toolbarControl}>
                      <span className={styles.toolbarLabel}>Kategorie</span>
                      <select
                        className={styles.toolbarSelect}
                        value={kategorieFilter}
                        onChange={event =>
                          setKategorieFilter(
                            event.target.value as KategorieFilter
                          )
                        }
                      >
                        <option value="all">Alle</option>
                        <option value="gerichtstermin">Gericht</option>
                        <option value="gespraech">Gespräch</option>
                        <option value="sonstiger">Sonstiges</option>
                        <option value="unknown">Unbekannt</option>
                      </select>
                    </label>
                    <label className={styles.toolbarControl}>
                      <span className={styles.toolbarLabel}>Confidence</span>
                      <select
                        className={styles.toolbarSelect}
                        value={confidenceFilter}
                        onChange={event =>
                          setConfidenceFilter(
                            event.target.value as ConfidenceFilter
                          )
                        }
                      >
                        <option value="all">Alle</option>
                        <option value="high">Hoch</option>
                        <option value="medium">Mittel</option>
                        <option value="low">Niedrig</option>
                        <option value="unknown">Unbekannt</option>
                      </select>
                    </label>
                  </>
                ) : null}
              </div>
              <div className={styles.filterGroupRight}>
                <button
                  type="button"
                  className={styles.filterChip}
                  onClick={() => void handleCreateTermin()}
                >
                  Neu+ Termin
                </button>
                <label className={styles.toolbarControl}>
                  <span className={styles.toolbarLabel}>Sortierung</span>
                  <select
                    className={styles.toolbarSelect}
                    value={sortKey}
                    onChange={event =>
                      setSortKey(event.target.value as SortKey)
                    }
                  >
                    <option value="datum">Datum</option>
                    <option value="gericht">Gericht</option>
                    <option value="status">Status</option>
                    <option value="terminart">Terminart</option>
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.toolbarSortDirectionButton}
                  onClick={() =>
                    setSortDir(current => (current === 'desc' ? 'asc' : 'desc'))
                  }
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
                <div className={styles.searchWrap}>
                  <input
                    ref={searchInputRef}
                    className={styles.searchInput}
                    type="text"
                    placeholder="Termine durchsuchen"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery ? (
                    <button
                      className={styles.searchClear}
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {actionStatus ? (
            <div
              className={styles.actionStatus}
              role="status"
              aria-live="polite"
            >
              {actionStatus}
            </div>
          ) : null}

          <div className={styles.scrollArea}>
            <div
              className={styles.listContainer}
              role="grid"
              aria-label="Termine"
            >
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
                    aria-label="Alle sichtbaren Termine auswählen"
                  />
                </span>
                <span className={styles.sortButton} role="columnheader">
                  Termin
                </span>
                <span className={styles.sortButton} role="columnheader">
                  Datum
                </span>
                <span className={styles.fristMeta} role="columnheader">
                  Akte
                </span>
                <span className={styles.fristMetaHideSm} role="columnheader">
                  Mandant
                </span>
                <span className={styles.sortButton} role="columnheader">
                  Status
                </span>
              </div>

              {isInitialLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`termine-skeleton-${index}`}
                    className={styles.skeletonRow}
                    role="row"
                    aria-hidden="true"
                  />
                ))
              ) : sorted.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyTitle}>
                    Keine Termine gefunden
                  </div>
                  <div className={styles.emptyDescription}>
                    {isCalendarDayFilterActive
                      ? 'Für den ausgewählten Kalendertag wurden keine Termine gefunden.'
                      : 'Passe Filter an oder lege einen neuen Termin an.'}
                  </div>
                </div>
              ) : (
                sorted.map(item => {
                  const urgency = getTerminUrgency(item);
                  const rowUrgencyClass =
                    urgency === 'critical'
                      ? styles.fristRowCritical
                      : urgency === 'soon'
                        ? styles.fristRowSoon
                        : undefined;
                  const dueDateUrgencyClass =
                    urgency === 'critical'
                      ? styles.dueDateCritical
                      : urgency === 'soon'
                        ? styles.dueDateSoon
                        : undefined;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={[styles.fristRow, rowUrgencyClass]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleOpenTermin(item)}
                      aria-label={`Termin öffnen: ${TERMINART_LABELS[item.terminart]}`}
                    >
                      <div
                        className={styles.selectionCell}
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className={styles.selectionCheckbox}
                          checked={bulkSelection.isSelected(item.id)}
                          onChange={e => {
                            bulkSelection.toggleWithRange(item.id, {
                              shiftKey: (e.nativeEvent as any).shiftKey,
                            });
                          }}
                          onClick={e => e.stopPropagation()}
                          aria-label={`Termin auswählen: ${TERMINART_LABELS[item.terminart]}`}
                        />
                      </div>
                      <div className={styles.fristMainCell}>
                        <div className={styles.fristTitle}>
                          {TERMINART_LABELS[item.terminart]}
                        </div>
                        <div className={styles.fristSubtitle}>
                          {item.gericht}
                        </div>
                        <div className={styles.deadlineInsightRow}>
                          {item.kategorie ? (
                            <span
                              className={`${styles.statusBadge} ${item.kategorie === 'gerichtstermin' ? styles.statusPending : styles.statusCompleted}`}
                            >
                              {item.kategorie === 'gerichtstermin'
                                ? 'Gericht'
                                : item.kategorie === 'gespraech'
                                  ? 'Gespräch'
                                  : 'Sonstiges'}
                            </span>
                          ) : null}
                          {item.requiresReview ? (
                            <span
                              className={`${styles.statusBadge} ${styles.statusExpired}`}
                            >
                              Review nötig
                            </span>
                          ) : null}
                          <span
                            className={`${styles.statusBadge} ${
                              confidenceBucket(item.detectionConfidence) ===
                              'high'
                                ? styles.statusCompleted
                                : confidenceBucket(item.detectionConfidence) ===
                                    'medium'
                                  ? styles.statusPending
                                  : confidenceBucket(
                                        item.detectionConfidence
                                      ) === 'low'
                                    ? styles.statusExpired
                                    : styles.statusPending
                            }`}
                          >
                            {confidenceLabel(item.detectionConfidence)}
                          </span>
                          {item.sourceDocTitles.length > 0 ? (
                            <span
                              className={`${styles.statusBadge} ${styles.statusPending}`}
                            >
                              Quelle: {item.sourceDocTitles[0]}
                              {item.sourceDocTitles.length > 1
                                ? ` (+${item.sourceDocTitles.length - 1})`
                                : ''}
                            </span>
                          ) : null}
                          {item.status === 'geplant' ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={e => {
                                e.stopPropagation();
                                terminService
                                  .confirmTermin(item.id)
                                  .then(() => {
                                    showActionStatus('Termin bestätigt.');
                                  })
                                  .catch(() => {
                                    showActionStatus(
                                      'Termin konnte nicht bestätigt werden.'
                                    );
                                  });
                              }}
                            >
                              Bestätigen
                            </button>
                          ) : null}
                          {item.sourceDocTitles.length > 0 ||
                          (item.evidenceSnippets ?? []).length > 0 ||
                          item.derivedFrom ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={e => {
                                e.stopPropagation();
                                handleShowTerminDetails(item);
                              }}
                            >
                              Details
                            </button>
                          ) : null}
                          {item.status !== 'abgesagt' &&
                          item.status !== 'abgeschlossen' ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={e => {
                                e.stopPropagation();
                                handleRescheduleTermin(item);
                              }}
                            >
                              Verschieben
                            </button>
                          ) : null}
                          {item.status !== 'abgesagt' &&
                          item.status !== 'abgeschlossen' ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={e => {
                                e.stopPropagation();
                                handleCancelTermin(item);
                              }}
                            >
                              Absagen
                            </button>
                          ) : null}
                          {item.status !== 'abgeschlossen' ? (
                            <button
                              type="button"
                              className={styles.deadlineReviewAction}
                              onClick={e => {
                                e.stopPropagation();
                                handleCompleteTermin(item);
                              }}
                            >
                              Abschließen
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.deadlineReviewAction}
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteTermin(item);
                            }}
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                      <span
                        className={[styles.dueDate, dueDateUrgencyClass]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {formatDateTime(item.datum, item.uhrzeit, language)}
                      </span>
                      <span className={styles.fristMeta}>
                        {item.matterExternalRef
                          ? `${item.matterExternalRef} — `
                          : ''}
                        {item.matterTitle || '—'}
                      </span>
                      <span className={styles.fristMetaHideSm}>
                        {item.clientName || '—'}
                      </span>
                      <span>
                        <span
                          className={`${styles.statusBadge} ${item.status === 'abgesagt' ? styles.statusExpired : item.status === 'abgeschlossen' ? styles.statusCompleted : styles.statusPending}`}
                        >
                          {TERMIN_STATUS_LABELS[item.status]}
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
            selectionLabel={`${bulkSelection.selectedCount} Termin(e) ausgewählt`}
            isRunning={isBulkConfirming || isBulkDeleting || isBulkReviewing}
            primaryLabel={bulkPrimaryLabel}
            onPrimary={bulkPrimaryAction}
            canDelete={bulkSelection.selectedCount > 0}
            deleteLabel="Löschen"
            onDelete={handleBulkDelete}
            onClear={bulkSelection.clear}
          />
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AllTerminePage />;
};

export default Component;
