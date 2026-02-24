import { Button } from '@affine/component';
import type {
  CaseAssistantAction,
  CaseDeadline,
  ClientRecord,
  MatterRecord,
} from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useState, type RefObject } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './cockpit-section.css';
import type { IngestionMode } from '../panel-types';
import { formatDue } from '../utils';

function hoursUntil(dateStr: string): number {
  const now = Date.now();
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  return (target.getTime() - now) / 3600000;
}

const DEADLINE_STATUS_STYLE: Record<string, { accent: string; bg: string; label: string }> = {
  open: { accent: cssVarV2('text/secondary'), bg: cssVarV2('layer/background/secondary'), label: '○ Offen' },
  acknowledged: { accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary'), label: 'Bestätigt' },
  completed: { accent: cssVarV2('status/success'), bg: cssVarV2('layer/background/secondary'), label: 'Erledigt' },
  overdue: { accent: cssVarV2('status/error'), bg: cssVarV2('layer/background/secondary'), label: 'Überfällig' },
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: cssVarV2('status/error'),
  high: cssVarV2('text/primary'),
  medium: cssVarV2('text/secondary'),
  low: cssVarV2('text/secondary'),
};

type Props = {
  sectionRef: RefObject<HTMLElement | null>;

  currentMatter: MatterRecord | null;
  matterOptions: MatterRecord[];
  clientsById: Map<string, ClientRecord>;
  matterSearchQuery: string;
  onMatterSearchQueryChange: (query: string) => void;
  showArchivedMatters: boolean;
  onToggleArchivedMatters: () => void;
  currentClient: ClientRecord | null;

  ingestionMode: IngestionMode;
  isIngesting: boolean;
  onIngestionModeChange: (mode: IngestionMode) => void;
  onQuickIngest: () => void;

  onSelectMatter: (matterId: string) => void;

  cockpit: {
    criticalIssueCount: number;
    openDeadlineCount: number;
    activeAlertCount: number;
    nextDeadlineAt?: string;
    summary?: string;
  } | null;

  caseDeadlines?: CaseDeadline[];
  onAcknowledgeDeadline?: (deadlineId: string) => Promise<void>;
  onPrepareDeadlineDocument?: (deadline: CaseDeadline) => void | Promise<void>;

  ingestionStatus: string | null;
  statusTone: 'info' | 'error';

  canAction: (action: CaseAssistantAction) => boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
};

const TodayBriefing = memo(({ deadlines, now }: { deadlines: CaseDeadline[]; now: number }) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayStartMs = todayStart.getTime();
  const todayEndMs = todayEnd.getTime();
  const criticalEndMs = now + 48 * 60 * 60 * 1000;

  const overdue = deadlines.filter(d => d.status === 'open' && new Date(d.dueAt).getTime() < now);
  const critical = deadlines.filter(d => {
    if (d.status !== 'open') return false;
    const due = new Date(d.dueAt).getTime();
    return due >= now && due <= criticalEndMs;
  });
  const dueToday = deadlines.filter(d => {
    const due = new Date(d.dueAt).getTime();
    return d.status === 'open' && due >= todayStartMs && due <= todayEndMs;
  });
  const dueSoon = deadlines.filter(d => {
    const due = new Date(d.dueAt).getTime();
    return d.status === 'open' && due > todayEndMs && due <= todayEndMs + 3 * 24 * 60 * 60 * 1000;
  });

  const totalUrgent = overdue.length + critical.length;
  if (totalUrgent === 0 && dueSoon.length === 0 && dueToday.length === 0) return null;

  const dateStr = todayStart.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const briefingBorder = overdue.length > 0 || critical.length > 0
    ? cssVarV2('status/error')
    : dueToday.length > 0
      ? cssVarV2('text/primary')
      : cssVarV2('status/success');

  return (
    <div
      className={localStyles.briefingCard}
      style={assignInlineVars({
        [localStyles.borderVar]: briefingBorder,
        [localStyles.surfaceVar]: cssVarV2('layer/background/secondary'),
      })}
    >
      <div className={localStyles.briefingHeader}>
        <div className={localStyles.briefingTitle}>
          Heute fällig — {dateStr}
        </div>
        <div className={localStyles.chipRow}>
          {overdue.length > 0 ? (
            <span
              className={localStyles.briefingChip}
              style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('status/error') })}
            >
              {overdue.length} überfällig
            </span>
          ) : null}
          {critical.length > 0 ? (
            <span
              className={localStyles.briefingChip}
              style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('status/error') })}
            >
              {critical.length} kritisch (&lt;48h)
            </span>
          ) : null}
          {dueToday.length > 0 ? (
            <span
              className={localStyles.briefingChip}
              style={assignInlineVars({ [localStyles.accentColorVar]: cssVarV2('text/primary') })}
            >
              {dueToday.length} heute
            </span>
          ) : null}
          {dueSoon.length > 0 ? (
            <span className={localStyles.briefingChip}>
              {dueSoon.length} in 3 Tagen
            </span>
          ) : null}
        </div>
      </div>

      {[...overdue, ...critical].length > 0 ? (
        <ul className={localStyles.briefingList}>
          {[...overdue, ...critical]
            .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
            .slice(0, 5)
            .map(d => {
            const isOverdue = new Date(d.dueAt).getTime() < now;
            const isCritical = !isOverdue && hoursUntil(d.dueAt) <= 48;
            return (
              <li
                key={d.id}
                className={localStyles.briefingItem}
                style={assignInlineVars({
                  [localStyles.accentColorVar]:
                    isOverdue || isCritical ? cssVarV2('status/error') : cssVarV2('text/primary'),
                })}
              >
                <span className={localStyles.briefingBang}>{isOverdue ? '!!' : isCritical ? '!' : '·'}</span>
                <span className={localStyles.briefingItemTitle}>{d.title}</span>
                <span className={localStyles.briefingItemDue}>{formatDue(d.dueAt)}</span>
              </li>
            );
          })}
          {[...overdue, ...critical].length > 5 ? (
            <li className={localStyles.briefingMore}>
              + {[...overdue, ...critical].length - 5} weitere…
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
});
TodayBriefing.displayName = 'TodayBriefing';

export const CockpitSection = memo((props: Props) => {
  const [deadlineExpanded, setDeadlineExpanded] = useState(false);
  const now = Date.now();
  const deadlines = props.caseDeadlines ?? [];
  const overdueCount = deadlines.filter(d => d.status === 'open' && new Date(d.dueAt).getTime() < now).length;
  const criticalCount = deadlines.filter(d => {
    if (d.status !== 'open') return false;
    const hours = hoursUntil(d.dueAt);
    return hours >= 0 && hours <= 48;
  }).length;

  return (
    <section ref={props.sectionRef} className={styles.section}>
      {/* ── H1: Morgen-Briefing "Heute fällig" ── */}
      <TodayBriefing deadlines={deadlines} now={now} />

      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Akten-Cockpit</h3>
        {props.currentClient ? (
          <span className={styles.chip}>{props.currentClient.displayName}</span>
        ) : null}
      </div>

      <div className={styles.controlRow}>
        <label className={styles.formLabel}>
          Aktive Akte
          <select
            className={styles.input}
            value={props.currentMatter?.id ?? ''}
            onChange={event => {
              props.onSelectMatter(event.target.value);
            }}
          >
            {props.matterOptions.length === 0 ? (
              <option value="">— Keine Akten vorhanden —</option>
            ) : null}
            {props.matterOptions.map((matter: MatterRecord) => {
              const client = props.clientsById.get(matter.clientId);
              const label = client ? `${client.displayName} — ${matter.title}` : matter.title;
              return (
                <option key={matter.id} value={matter.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>
        <label className={styles.formLabel}>
          Akten-Suche
          <input
            className={styles.input}
            value={props.matterSearchQuery}
            onChange={event => props.onMatterSearchQueryChange(event.target.value)}
            placeholder="Akte, Referenz, Tag suchen…"
          />
        </label>
        <Button
          variant={props.showArchivedMatters ? 'secondary' : 'plain'}
          aria-pressed={props.showArchivedMatters}
          onClick={props.onToggleArchivedMatters}
        >
          {props.showArchivedMatters ? '✓ Archivierte' : 'Archivierte'}
        </Button>
      </div>

      <div className={`${styles.modeSwitcher} ${localStyles.modeSwitcherTop}`}>
        <Button
          variant={props.ingestionMode === 'selection' ? 'secondary' : 'plain'}
          disabled={props.isIngesting}
          onClick={() => props.onIngestionModeChange('selection')}
        >
          Selektion
        </Button>
        <Button
          variant={props.ingestionMode === 'document' ? 'secondary' : 'plain'}
          disabled={props.isIngesting}
          onClick={() => props.onIngestionModeChange('document')}
        >
          Ganze Seite
        </Button>
        <Button
          variant="secondary"
          disabled={props.isIngesting}
          onClick={props.onQuickIngest}
        >
          {props.isIngesting ? 'Analysiere…' : 'Schnellanalyse'}
        </Button>
      </div>

      {props.cockpit ? (
        <>
          <div className={styles.metrics}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Kritische Punkte</div>
              <div className={styles.metricValue}>{props.cockpit.criticalIssueCount}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Offene Fristen</div>
              <div className={styles.metricValue}>{props.cockpit.openDeadlineCount}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Aktive Alerts</div>
              <div className={styles.metricValue}>{props.cockpit.activeAlertCount}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Nächste Frist</div>
              <div className={styles.metricValue}>
                {props.cockpit.nextDeadlineAt ? formatDue(props.cockpit.nextDeadlineAt) : '—'}
              </div>
            </div>
          </div>

          <p className={styles.summary}>
            {props.cockpit.summary ??
              'Noch keine automatisch generierte Aktenzusammenfassung verfügbar.'}
          </p>

          {/* Fristen-Liste */}
          {deadlines.length > 0 ? (
            <div className={localStyles.deadlinesBlock}>
              <button
                type="button"
                onClick={() => setDeadlineExpanded(v => !v)}
                aria-expanded={deadlineExpanded}
                className={localStyles.deadlinesToggle}
              >
                <span
                  className={localStyles.deadlinesHeading}
                  style={assignInlineVars({
                    [localStyles.accentColorVar]: overdueCount > 0 || criticalCount > 0 ? cssVarV2('status/error') : cssVarV2('text/secondary'),
                  })}
                >
                  Fristen ({deadlines.length})
                </span>
                {overdueCount > 0 ? (
                  <span className={localStyles.overdueBadge}>
                    {overdueCount} überfällig
                  </span>
                ) : null}
                {overdueCount === 0 && criticalCount > 0 ? (
                  <span className={localStyles.criticalBadge}>
                    {criticalCount} kritisch
                  </span>
                ) : null}
                <span className={localStyles.caret}>{deadlineExpanded ? 'Schließen' : 'Öffnen'}</span>
              </button>
              {deadlineExpanded ? (
                <ul className={localStyles.deadlinesList}>
                  {deadlines.map(d => {
                    const isOverdue = d.status === 'open' && new Date(d.dueAt).getTime() < now;
                    const statusKey = isOverdue ? 'overdue' : d.status;
                    const sty = DEADLINE_STATUS_STYLE[statusKey] ?? DEADLINE_STATUS_STYLE.open;
                    const priColor = PRIORITY_COLOR[d.priority] ?? cssVarV2('text/secondary');
                    return (
                      <li
                        key={d.id}
                        className={localStyles.deadlineItem}
                        style={assignInlineVars({
                          [localStyles.surfaceVar]: sty.bg,
                          [localStyles.borderVar]: sty.accent,
                        })}
                      >
                        <div className={localStyles.deadlineMain}>
                          <div className={localStyles.deadlineTitle}>{d.title}</div>
                          <div className={localStyles.deadlineMeta}>
                            <span
                              className={localStyles.deadlineStatus}
                              style={assignInlineVars({ [localStyles.accentColorVar]: sty.accent })}
                            >{sty.label}</span>
                            <span
                              className={localStyles.deadlinePriority}
                              style={assignInlineVars({ [localStyles.accentColorVar]: priColor })}
                            >{d.priority}</span>
                            <span>{formatDue(d.dueAt)}</span>
                          </div>
                        </div>
                        <div className={localStyles.chipRow}>
                          {d.status === 'open' && props.onPrepareDeadlineDocument ? (
                            <button
                              type="button"
                              title="Schreiben vorbereiten"
                              onClick={() =>
                                props.runAsyncUiAction(
                                  () => props.onPrepareDeadlineDocument!(d),
                                  'prepare deadline document failed'
                                )
                              }
                              className={localStyles.prepareButton}
                              aria-label={`Schreiben vorbereiten für Frist: ${d.title}`}
                            >
                              Schreiben vorbereiten
                            </button>
                          ) : null}
                          {d.status === 'open' && props.onAcknowledgeDeadline ? (
                            <button
                              type="button"
                              title="Frist bestätigen"
                              onClick={() =>
                                props.runAsyncUiAction(
                                  () => props.onAcknowledgeDeadline!(d.id),
                                  'acknowledge deadline failed'
                                )
                              }
                              className={localStyles.ackButton}
                            >
                              ✓
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}

          {props.ingestionStatus ? (
            <p
              className={`${styles.status} ${
                props.statusTone === 'error' ? styles.statusError : styles.statusInfo
              }`}
              aria-live="polite"
              role="status"
            >
              {props.ingestionStatus}
            </p>
          ) : null}
        </>
      ) : (
        <div className={styles.empty}>Akte wird initialisiert…</div>
      )}
    </section>
  );
});

CockpitSection.displayName = 'CockpitSection';
