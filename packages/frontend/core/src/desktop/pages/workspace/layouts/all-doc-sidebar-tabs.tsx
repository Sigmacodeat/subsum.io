import { Button, Scrollable } from '@affine/component';
import { ViewSidebarTab, WorkbenchService } from '@affine/core/modules/workbench';
import { CaseAssistantStore } from '@affine/core/modules/case-assistant/stores/case-assistant';
import { LegalCopilotWorkflowService } from '@affine/core/modules/case-assistant/services/legal-copilot-workflow';
import type { CaseDeadline, MatterRecord, ClientRecord, LegalDocumentRecord } from '@affine/core/modules/case-assistant/types';
import { TodayIcon, NotificationIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

import { sidebarScrollArea } from '../detail-page/detail-page.css';
import { EditorJournalPanel } from '../detail-page/tabs/journal';

import * as legalActivityStyles from './all-doc-sidebar-tabs.css';

/* ── helpers ─────────────────────────────────────────────── */

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `vor ${diffD} Tag${diffD > 1 ? 'en' : ''}`;
  return new Date(dateStr).toLocaleDateString('de-DE');
}

type PriorityTier = 'P1' | 'P2' | 'P3';

const PRIORITY_WEIGHTS = {
  criticalDeadline: 48,
  alertVolume: 7,
  alertVolumeCap: 28,
  severity: {
    critical: 32,
    warning: 22,
    soon: 12,
    normal: 4,
  },
  overduePerDay: 6,
  overdueCap: 36,
  dueToday: 22,
  dueSoon: 12,
  inactivity: {
    stale7d: 6,
    stale14d: 12,
    stale30d: 18,
  },
} as const;

function getPriorityTier(score: number): PriorityTier {
  if (score >= 95) return 'P1';
  if (score >= 55) return 'P2';
  return 'P3';
}

function computeMatterPriorityScore(input: {
  critical: number;
  total: number;
  nextSeverity: 'critical' | 'warning' | 'soon' | 'normal';
  nextDays: number;
  updatedAt: string;
}): number {
  const base =
    input.critical * PRIORITY_WEIGHTS.criticalDeadline +
    Math.min(
      PRIORITY_WEIGHTS.alertVolumeCap,
      input.total * PRIORITY_WEIGHTS.alertVolume
    ) +
    PRIORITY_WEIGHTS.severity[input.nextSeverity];

  const dueScore =
    input.nextDays < 0
      ? Math.min(
          PRIORITY_WEIGHTS.overdueCap,
          Math.abs(input.nextDays) * PRIORITY_WEIGHTS.overduePerDay
        )
      : input.nextDays === 0
        ? PRIORITY_WEIGHTS.dueToday
        : input.nextDays <= 3
          ? PRIORITY_WEIGHTS.dueSoon
          : 0;

  const updatedDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(input.updatedAt).getTime()) / 86400000)
  );

  const inactivityScore =
    updatedDays >= 30
      ? PRIORITY_WEIGHTS.inactivity.stale30d
      : updatedDays >= 14
        ? PRIORITY_WEIGHTS.inactivity.stale14d
        : updatedDays >= 7
          ? PRIORITY_WEIGHTS.inactivity.stale7d
          : 0;

  return base + dueScore + inactivityScore;
}

/* ── Legal Activity Panel ────────────────────────────────── */


const LegalActivityPanel = () => {
  const store = useService(CaseAssistantStore);
  const graph = useLiveData(store.watchGraph());
  const workbench = useService(WorkbenchService).workbench;
  const legalCopilotWorkflowService = useService(LegalCopilotWorkflowService);
  const legalDocs = useLiveData(legalCopilotWorkflowService.legalDocuments$) ?? [];
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const matters = useMemo(() => Object.values(graph.matters ?? {}), [graph.matters]);
  const clients = useMemo(() => graph.clients ?? {}, [graph.clients]);
  const cases = useMemo(() => graph.cases ?? {}, [graph.cases]);
  const deadlines = useMemo(() => Object.values(graph.deadlines ?? {}), [graph.deadlines]);

  // Build deadline → caseFile title lookup
  const deadlineCaseMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of Object.values(cases)) {
      for (const dId of c.deadlineIds ?? []) {
        map[dId] = c.title ?? c.id;
      }
    }
    return map;
  }, [cases]);

  // KPIs
  const openMatters = useMemo(() => matters.filter(m => m.status === 'open').length, [matters]);
  const totalClients = useMemo(() => Object.values(clients).filter(c => !c.archived).length, [clients]);

  // Upcoming deadlines (next 14 days, sorted by dueAt)
  const upcomingDeadlines = useMemo(() => {
    return (deadlines as CaseDeadline[])
      .filter(d => {
        if (!d.dueAt) return false;
        const days = daysUntil(d.dueAt);
        return days >= -3 && days <= 14 && d.status !== 'completed';
      })
      .sort((a, b) => {
        const daysA = daysUntil(a.dueAt);
        const daysB = daysUntil(b.dueAt);
        const rankA = daysA < 0 ? 0 : daysA === 0 ? 1 : daysA <= 3 ? 2 : 3;
        const rankB = daysB < 0 ? 0 : daysB === 0 ? 1 : daysB <= 3 ? 2 : 3;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [deadlines]);

  const visibleUpcomingDeadlines = useMemo(
    () => upcomingDeadlines.slice(0, 5),
    [upcomingDeadlines]
  );

  const criticalDeadlineCount = useMemo(
    () =>
      upcomingDeadlines.filter(d => {
        const days = daysUntil(d.dueAt);
        return days <= 0;
      }).length,
    [upcomingDeadlines]
  );

  // Recently updated matters (top 5)
  const recentMatters = useMemo(() => {
    return [...matters]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4);
  }, [matters]);

  const getDeadlineCaseTitle = (deadlineId: string): string => {
    return deadlineCaseMap[deadlineId] ?? '';
  };

  const getClientName = (matter: MatterRecord): string => {
    const client = clients[matter.clientId] as ClientRecord | undefined;
    return client?.displayName ?? '';
  };

  const openMainChatForContext = useCallback(
    (input: { caseId?: string; matterId?: string; clientId?: string; label: string }) => {
      const { caseId, matterId, clientId, label } = input;
      const params = new URLSearchParams();
      if (caseId) params.set('caCaseId', caseId);
      if (matterId) params.set('caMatterId', matterId);
      if (clientId) params.set('caClientId', clientId);
      if (params.size === 0) {
        return;
      }
      workbench.open(`/chat?${params.toString()}`);
      setActionStatus(`Öffne Hauptchat: ${label}`);
    },
    [workbench]
  );

  // Recent legal documents (top 5, sorted by updatedAt)
  const recentDocs = useMemo(() => {
    return [...(legalDocs as LegalDocumentRecord[])]
      .filter(d => d.status === 'indexed')
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
      .slice(0, 4);
  }, [legalDocs]);

  const navigateTo = useCallback((path: string) => {
    workbench.open(path);
  }, [workbench]);

  const caseByDeadlineId = useMemo(() => {
    const map = new Map<string, { caseId: string; matterId?: string; clientId?: string }>();
    for (const c of Object.values(cases)) {
      const matter = c.matterId ? (graph.matters?.[c.matterId] as MatterRecord | undefined) : undefined;
      for (const deadlineId of c.deadlineIds ?? []) {
        map.set(deadlineId, {
          caseId: c.id,
          matterId: c.matterId,
          clientId: matter?.clientId,
        });
      }
    }
    return map;
  }, [cases, graph.matters]);

  const alertsByMatter = useMemo(() => {
    const map = new Map<
      string,
      {
        matter: MatterRecord;
        total: number;
        critical: number;
        nextLabel: string;
        nextSeverity: 'critical' | 'warning' | 'soon' | 'normal';
        nextDays: number;
        priorityScore: number;
        priorityTier: PriorityTier;
        caseId?: string;
      }
    >();

    for (const deadline of deadlines) {
      if (!deadline.dueAt || deadline.status === 'completed' || deadline.status === 'expired') {
        continue;
      }
      const ctx = caseByDeadlineId.get(deadline.id);
      if (!ctx?.matterId) continue;
      const matter = graph.matters?.[ctx.matterId] as MatterRecord | undefined;
      if (!matter) continue;

      const days = daysUntil(deadline.dueAt);
      const severity: 'critical' | 'warning' | 'soon' | 'normal' =
        days < 0 ? 'critical' : days === 0 ? 'warning' : days <= 3 ? 'soon' : 'normal';
      const label =
        days < 0
          ? `${Math.abs(days)}d überfällig`
          : days === 0
            ? 'Heute'
            : `in ${days}d`;

      const prev = map.get(matter.id);
      if (!prev) {
        map.set(matter.id, {
          matter,
          total: 1,
          critical: days <= 0 ? 1 : 0,
          nextLabel: label,
          nextSeverity: severity,
          nextDays: days,
          priorityScore: 0,
          priorityTier: 'P3',
          caseId: ctx.caseId,
        });
        continue;
      }

      prev.total += 1;
      if (days <= 0) {
        prev.critical += 1;
      }

      const severityRank = { critical: 0, warning: 1, soon: 2, normal: 3 };
      if (severityRank[severity] < severityRank[prev.nextSeverity]) {
        prev.nextSeverity = severity;
        prev.nextLabel = label;
        prev.nextDays = days;
        prev.caseId = ctx.caseId;
      } else if (
        severityRank[severity] === severityRank[prev.nextSeverity] &&
        days < prev.nextDays
      ) {
        prev.nextLabel = label;
        prev.nextDays = days;
        prev.caseId = ctx.caseId;
      }
    }

    for (const item of map.values()) {
      item.priorityScore = computeMatterPriorityScore({
        critical: item.critical,
        total: item.total,
        nextSeverity: item.nextSeverity,
        nextDays: item.nextDays,
        updatedAt: item.matter.updatedAt,
      });
      item.priorityTier = getPriorityTier(item.priorityScore);
    }

    return [...map.values()]
      .sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        if (a.nextDays !== b.nextDays) {
          return a.nextDays - b.nextDays;
        }
        if (b.critical !== a.critical) return b.critical - a.critical;
        if (b.total !== a.total) return b.total - a.total;
        return new Date(b.matter.updatedAt).getTime() - new Date(a.matter.updatedAt).getTime();
      })
      .slice(0, 5);
  }, [caseByDeadlineId, deadlines, graph.matters]);

  const nextActions = useMemo(() => {
    const actions: Array<{
      key: string;
      title: string;
      detail: string;
      priorityTier: PriorityTier;
      score: number;
      onRun: () => void;
    }> = [];

    const firstCritical = upcomingDeadlines.find(d => daysUntil(d.dueAt) <= 0);
    if (firstCritical) {
      const ctx = caseByDeadlineId.get(firstCritical.id);
      if (ctx) {
        const days = daysUntil(firstCritical.dueAt);
        actions.push({
          key: `critical-${firstCritical.id}`,
          title: `Kritische Frist: ${firstCritical.title}`,
          detail:
            days < 0
              ? `${Math.abs(days)}d überfällig · jetzt prüfen`
              : 'heute fällig · jetzt prüfen',
          priorityTier: 'P1',
          score: 180 + Math.max(0, Math.abs(Math.min(0, days)) * 4),
          onRun: () =>
            openMainChatForContext({
              caseId: ctx.caseId,
              matterId: ctx.matterId,
              clientId: ctx.clientId,
              label: firstCritical.title,
            }),
        });
      }
    }

    const topAlertMatter = alertsByMatter[0];
    if (topAlertMatter) {
      actions.push({
        key: `matter-alert-${topAlertMatter.matter.id}`,
        title: `Akte mit Alerts: ${topAlertMatter.matter.title}`,
        detail: `${topAlertMatter.total} Termine · ${topAlertMatter.nextLabel}`,
        priorityTier: topAlertMatter.priorityTier,
        score: topAlertMatter.priorityScore + 20,
        onRun: () =>
          openMainChatForContext({
            caseId: topAlertMatter.caseId,
            matterId: topAlertMatter.matter.id,
            clientId: topAlertMatter.matter.clientId,
            label: topAlertMatter.matter.title,
          }),
      });
    }

    const latestMatter = recentMatters[0];
    if (latestMatter) {
      actions.push({
        key: `resume-${latestMatter.id}`,
        title: `Weiterarbeiten: ${latestMatter.title}`,
        detail: `Zuletzt aktiv · ${relativeTime(latestMatter.updatedAt)}`,
        priorityTier: 'P3',
        score: 24,
        onRun: () => {
          const latestCase = Object.values(cases)
            .filter(c => c.matterId === latestMatter.id)
            .sort((a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )[0];
          openMainChatForContext({
            caseId: latestCase?.id,
            matterId: latestMatter.id,
            clientId: latestMatter.clientId,
            label: latestMatter.title,
          });
        },
      });
    }

    const firstUpcoming = upcomingDeadlines.find(d => daysUntil(d.dueAt) > 0);
    if (firstUpcoming) {
      const ctx = caseByDeadlineId.get(firstUpcoming.id);
      if (ctx) {
        const days = daysUntil(firstUpcoming.dueAt);
        actions.push({
          key: `upcoming-${firstUpcoming.id}`,
          title: `Nächste Frist vorbereiten: ${firstUpcoming.title}`,
          detail: `in ${days}d · proaktiv bearbeiten`,
          priorityTier: days <= 3 ? 'P2' : 'P3',
          score: days <= 3 ? 82 : 50,
          onRun: () =>
            openMainChatForContext({
              caseId: ctx.caseId,
              matterId: ctx.matterId,
              clientId: ctx.clientId,
              label: firstUpcoming.title,
            }),
        });
      }
    }

    if (actions.length === 0) {
      actions.push({
        key: 'bootstrap-akten',
        title: 'Akte starten',
        detail: 'Erste Akte anlegen oder Dokumente hochladen',
        priorityTier: 'P3',
        score: 10,
        onRun: () => navigateTo('/akten'),
      });
    }

    const deduped = new Map<string, (typeof actions)[number]>();
    for (const action of actions) {
      if (!deduped.has(action.key)) {
        deduped.set(action.key, action);
      }
    }

    return [...deduped.values()]
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.title.localeCompare(b.title, 'de');
      })
      .slice(0, 3)
      .map(({ score: _score, ...rest }) => rest);
  }, [
    alertsByMatter,
    caseByDeadlineId,
    cases,
    navigateTo,
    openMainChatForContext,
    recentMatters,
    upcomingDeadlines,
  ]);

  return (
    <div className={legalActivityStyles.container} aria-label="Legal Activity Übersicht">
      <div className={legalActivityStyles.srOnlyLive} aria-live="polite" aria-atomic="true">
        {actionStatus ?? ''}
      </div>
      {/* Quick Navigation */}
      <div>
        <div className={legalActivityStyles.sectionTitle}>Schnellzugriff</div>
        <div className={legalActivityStyles.quickNavGrid}>
          <Button
            variant="plain"
            className={legalActivityStyles.quickNavButton}
            onClick={() => navigateTo('/akten')}
            title="Alle Akten"
            aria-label="Zu Akten wechseln"
          >
            <span className={legalActivityStyles.quickNavIcon} aria-hidden="true">
              📁
            </span>
            Akten
          </Button>
          <Button
            variant="plain"
            className={legalActivityStyles.quickNavButton}
            onClick={() => navigateTo('/mandanten')}
            title="Alle Mandanten"
            aria-label="Zu Mandanten wechseln"
          >
            <span className={legalActivityStyles.quickNavIcon} aria-hidden="true">
              👤
            </span>
            Mandanten
          </Button>
          <Button
            variant="plain"
            className={legalActivityStyles.quickNavButton}
            onClick={() => navigateTo('/fristen')}
            title="Fristen"
            aria-label="Zu Fristen wechseln"
          >
            <span className={legalActivityStyles.quickNavIcon} aria-hidden="true">
              📅
            </span>
            Fristen
          </Button>
          <Button
            variant="plain"
            className={legalActivityStyles.quickNavButton}
            onClick={() => navigateTo('/termine')}
            title="Termine"
            aria-label="Zu Terminen wechseln"
          >
            <span className={legalActivityStyles.quickNavIcon} aria-hidden="true">
              �️
            </span>
            Termine
          </Button>
        </div>
      </div>

      <div>
        <div className={legalActivityStyles.sectionTitle}>Nächste Schritte</div>
        <div className={legalActivityStyles.listCol}>
          {nextActions.map(action => (
            <button
              type="button"
              key={action.key}
              className={legalActivityStyles.matterItem}
              onClick={action.onRun}
              aria-label={`${action.title}, Aktion ausführen`}
            >
              <span className={legalActivityStyles.matterTitle}>{action.title}</span>
              <div className={legalActivityStyles.twoColMeta}>
                <span className={legalActivityStyles.itemMeta}>{action.detail}</span>
                <span
                  className={[
                    legalActivityStyles.severityBadge,
                    action.priorityTier === 'P1'
                      ? legalActivityStyles.severityCritical
                      : action.priorityTier === 'P2'
                        ? legalActivityStyles.severityWarning
                        : legalActivityStyles.severitySoon,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {action.priorityTier}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* KPI Overview */}
      <div>
        <div className={legalActivityStyles.sectionTitle}>Übersicht</div>
        <div className={legalActivityStyles.kpiRow}>
          <div className={legalActivityStyles.kpiCard}>
            <span className={legalActivityStyles.kpiValue}>{openMatters}</span>
            <span className={legalActivityStyles.kpiLabel}>Offene Akten</span>
          </div>
          <div className={legalActivityStyles.kpiCard}>
            <span className={legalActivityStyles.kpiValue}>{totalClients}</span>
            <span className={legalActivityStyles.kpiLabel}>Mandanten</span>
          </div>
          <div className={legalActivityStyles.kpiCard}>
            <span
              className={[
                legalActivityStyles.kpiValue,
                criticalDeadlineCount > 0 ? legalActivityStyles.kpiValueCritical : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {upcomingDeadlines.length}
            </span>
            <span className={legalActivityStyles.kpiLabel}>Fristen</span>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div>
        <div className={legalActivityStyles.sectionTitle}>
          Termine & Alerts
          {criticalDeadlineCount > 0 ? ` · ${criticalDeadlineCount} kritisch` : ''}
        </div>
        {visibleUpcomingDeadlines.length === 0 ? (
          <div className={legalActivityStyles.emptyHint}>Keine anstehenden Fristen</div>
        ) : (
          <div className={legalActivityStyles.listCol}>
            {visibleUpcomingDeadlines.map(d => {
              const days = daysUntil(d.dueAt);
              const isOverdue = days < 0;
              const isUrgent = days <= 3;
              const ctx = caseByDeadlineId.get(d.id);
              const severityClass = isOverdue
                ? legalActivityStyles.severityCritical
                : days === 0
                  ? legalActivityStyles.severityWarning
                  : isUrgent
                    ? legalActivityStyles.severitySoon
                    : '';
              return (
                <button
                  type="button"
                  key={d.id}
                  className={legalActivityStyles.deadlineItem}
                  disabled={!ctx}
                  aria-disabled={!ctx}
                  aria-label={`Frist ${d.title}${ctx ? ', im Hauptchat öffnen' : ', nicht verknüpft'}`}
                  onClick={() => {
                    if (!ctx) return;
                    openMainChatForContext({
                      caseId: ctx.caseId,
                      matterId: ctx.matterId,
                      clientId: ctx.clientId,
                      label: d.title,
                    });
                  }}
                >
                  <span className={legalActivityStyles.itemLabel}>{d.title}</span>
                  <div className={legalActivityStyles.itemRow}>
                    <span className={legalActivityStyles.itemMeta}>
                      {getDeadlineCaseTitle(d.id)}
                    </span>
                    <div className={legalActivityStyles.severityRow}>
                      <span
                        className={
                          isUrgent || isOverdue
                            ? legalActivityStyles.urgentMeta
                            : legalActivityStyles.itemMeta
                        }
                      >
                        {isOverdue
                          ? `${Math.abs(days)}d überfällig`
                          : days === 0
                            ? 'Heute'
                            : `in ${days}d`}
                      </span>
                      {severityClass ? (
                        <span
                          className={[legalActivityStyles.severityBadge, severityClass]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {isOverdue ? 'kritisch' : days === 0 ? 'heute' : 'bald'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
            {upcomingDeadlines.length > visibleUpcomingDeadlines.length ? (
              <div className={legalActivityStyles.emptyHint}>
                +{upcomingDeadlines.length - visibleUpcomingDeadlines.length} weitere Fristen im Zeitraum
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Akten with Alerts */}
      <div>
        <div className={legalActivityStyles.sectionTitle}>Akte-Alerts</div>
        {alertsByMatter.length === 0 ? (
          <div className={legalActivityStyles.emptyHint}>Keine Alerts je Akte</div>
        ) : (
          <div className={legalActivityStyles.listCol}>
            {alertsByMatter.map(item => {
              const clientName = getClientName(item.matter);
              return (
                <button
                  type="button"
                  key={item.matter.id}
                  className={legalActivityStyles.matterItem}
                  aria-label={`Akte ${item.matter.title} mit ${item.total} Termin-Alerts öffnen`}
                  onClick={() => {
                    openMainChatForContext({
                      caseId: item.caseId,
                      matterId: item.matter.id,
                      clientId: item.matter.clientId,
                      label: item.matter.title,
                    });
                  }}
                >
                  <span className={legalActivityStyles.matterTitle}>
                    {item.matter.externalRef ? `${item.matter.externalRef} — ` : ''}
                    {item.matter.title}
                  </span>
                  <div className={legalActivityStyles.twoColMeta}>
                    <span className={legalActivityStyles.itemMeta}>{clientName || 'Mandant offen'}</span>
                    <span
                      className={
                        item.critical > 0
                          ? legalActivityStyles.urgentMeta
                          : legalActivityStyles.itemMeta
                      }
                    >
                      {item.total} Termine · {item.nextLabel}
                    </span>
                    <span
                      className={[
                        legalActivityStyles.severityBadge,
                        item.priorityTier === 'P1'
                          ? legalActivityStyles.severityCritical
                          : item.priorityTier === 'P2'
                            ? legalActivityStyles.severityWarning
                            : legalActivityStyles.severitySoon,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {item.priorityTier} · {item.priorityScore}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Legal Documents */}
      <div>
        <div className={legalActivityStyles.sectionTitle}>Letzte Schriftsätze</div>
        {recentDocs.length === 0 ? (
          <div className={legalActivityStyles.emptyHint}>Noch keine Dokumente analysiert</div>
        ) : (
          <div className={legalActivityStyles.listCol}>
            {recentDocs.map(doc => (
              <button
                type="button"
                key={doc.id}
                className={legalActivityStyles.docItem}
                aria-label={`Dokument ${doc.title || 'Unbenannt'} im Hauptchat öffnen`}
                onClick={() => {
                  const caseRecord = cases[doc.caseId];
                  const matterId = caseRecord?.matterId;
                  const clientId = matterId
                    ? (graph.matters?.[matterId] as MatterRecord | undefined)?.clientId
                    : undefined;
                  openMainChatForContext({
                    caseId: doc.caseId,
                    matterId,
                    clientId,
                    label: doc.title || 'Dokument',
                  });
                }}
              >
                <div className={legalActivityStyles.itemLabel}>
                  {doc.title || 'Unbenannt'}
                </div>
                <div className={legalActivityStyles.docMetaRow}>
                  <span>
                    {relativeTime((doc.updatedAt ?? doc.createdAt) as string)}
                  </span>
                  <span>{doc.kind}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Matters */}
      <div>
        <div className={legalActivityStyles.sectionTitle}>Zuletzt bearbeitete Akten</div>
        {recentMatters.length === 0 ? (
          <div className={legalActivityStyles.emptyHint}>Noch keine Akten vorhanden</div>
        ) : (
          <div className={legalActivityStyles.listCol}>
            {recentMatters.map(m => (
              <button
                type="button"
                key={m.id}
                className={legalActivityStyles.matterItem}
                aria-label={`Akte ${m.title} im Hauptchat öffnen`}
                onClick={() => {
                  const latestCase = Object.values(cases)
                    .filter(c => c.matterId === m.id)
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
                  openMainChatForContext({
                    caseId: latestCase?.id,
                    matterId: m.id,
                    clientId: m.clientId,
                    label: m.title,
                  });
                }}
              >
                <span className={legalActivityStyles.matterTitle}>
                  {m.externalRef ? `${m.externalRef} — ` : ''}
                  {m.title}
                </span>
                <div className={legalActivityStyles.twoColMeta}>
                  <span className={legalActivityStyles.itemMeta}>
                    {getClientName(m)}
                  </span>
                  <span className={legalActivityStyles.itemMeta}>
                    {relativeTime(m.updatedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Sidebar Tabs Export ─────────────────────────────────── */

export const AllDocSidebarTabs = () => {
  return (
    <>
      <ViewSidebarTab tabId="all-docs-journal" icon={<TodayIcon />}>
        <Scrollable.Root className={sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorJournalPanel />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>
      <ViewSidebarTab tabId="legal-activity" icon={<NotificationIcon />}>
        <Scrollable.Root className={sidebarScrollArea}>
          <Scrollable.Viewport>
            <LegalActivityPanel />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>
    </>
  );
};
