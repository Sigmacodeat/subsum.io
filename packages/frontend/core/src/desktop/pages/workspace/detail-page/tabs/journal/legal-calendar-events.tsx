import { Tooltip, toast } from '@affine/component';
import { useService, useServiceOptional } from '@toeverything/infra';
import { WorkbenchService } from '@affine/core/modules/workbench';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AnwaltsTagesjournalService,
  type TagesjournalEntry,
  type TagesjournalItem,
  type TagesjournalSection,
} from '../../../../../../modules/case-assistant';

import * as styles from './legal-calendar-events.css';

/**
 * LegalCalendarEvents — Subsumio Kalender-Events in der Journal-Sidebar
 *
 * Zeigt für den gewählten Tag:
 * - Überfällige Fristen (rot)
 * - Heutige Fristen
 * - Gerichtstermine
 * - Wiedervorlagen
 * - Weitere Kalender-Events
 * - Wochenvorschau (collapsed)
 *
 * Integriert sich nahtlos neben AFFiNEs CalendarEvents.
 */
export const LegalCalendarEvents = ({ date }: { date: Dayjs }) => {
  const tagesjournalService = useServiceOptional(AnwaltsTagesjournalService);
  const workbench = useService(WorkbenchService).workbench;

  const [journal, setJournal] = useState<TagesjournalEntry | null>(null);
  const [collapsedBySection, setCollapsedBySection] = useState<
    Partial<Record<TagesjournalSection['kind'], boolean>>
  >({});
  const dateKey = useMemo(() => date.format('YYYY-MM-DD'), [date]);

  useEffect(() => {
    if (!tagesjournalService) return;
    let cancelled = false;

    tagesjournalService.getJournalForDate(dateKey).then(entry => {
      if (!cancelled) setJournal(entry);
    }).catch(() => {
      // Silently fail — service may not be initialized yet
    });

    return () => { cancelled = true; };
  }, [dateKey, tagesjournalService]);

  const handleItemClick = useCallback(
    (item: TagesjournalItem) => {
      if (!item.matterId) {
        toast('Dieser Eintrag ist keiner Akte zugeordnet.');
        return;
      }

      const params = new URLSearchParams({
        caMatterId: item.matterId,
        caSidebar: 'anwalts-workflow',
      });

      if (item.linkType === 'deadline') {
        params.set('caWorkflowTab', 'fristen');
      } else if (item.linkType === 'termin') {
        params.set('caWorkflowTab', 'termine');
      }

      workbench.open(`/akten/${item.matterId}?${params.toString()}`);
    },
    [workbench]
  );

  if (!journal) return null;

  // Only show sections that have items (except notes)
  const visibleSections = journal.sections.filter(
    s => s.items.length > 0 && s.kind !== 'notes' && s.kind !== 'active_matters_summary'
  );

  if (visibleSections.length === 0) {
    return (
      <div className={styles.container} data-testid="legal-calendar-events">
        <div className={styles.emptyState} data-testid="legal-calendar-events-empty">
          Keine juristischen Termine oder Fristen für diesen Tag.
        </div>
      </div>
    );
  }

  const toggleSection = (kind: TagesjournalSection['kind'], initialCollapsed: boolean) => {
    setCollapsedBySection(prev => ({
      ...prev,
      [kind]: !(prev[kind] ?? initialCollapsed),
    }));
  };

  const stats = journal.stats;
  const hasCritical = stats.overdueDeadlines > 0;
  const hasItems = stats.todayDeadlines > 0 || stats.todayTermine > 0 || stats.todayWiedervorlagen > 0;

  return (
    <div className={styles.container} data-testid="legal-calendar-events">
      {/* Stats summary */}
      {(hasCritical || hasItems) && (
        <div className={styles.statsBar}>
          {stats.overdueDeadlines > 0 && (
            <span className={styles.statChip.critical}>
              {stats.overdueDeadlines} überfällig
            </span>
          )}
          {stats.todayDeadlines > 0 && (
            <span className={styles.statChip.high}>
              {stats.todayDeadlines} Fristen
            </span>
          )}
          {stats.todayTermine > 0 && (
            <span className={styles.statChip.high}>
              {stats.todayTermine} Termine
            </span>
          )}
          {stats.todayWiedervorlagen > 0 && (
            <span className={styles.statChip.normal}>
              {stats.todayWiedervorlagen} WV
            </span>
          )}
        </div>
      )}

      {/* Sections */}
      {visibleSections.map(section => (
        <LegalSection
          key={section.kind}
          section={section}
          collapsed={collapsedBySection[section.kind] ?? (section.collapsed ?? false)}
          onToggle={() => toggleSection(section.kind, section.collapsed ?? false)}
          onItemClick={handleItemClick}
        />
      ))}
    </div>
  );
};

const LegalSection = ({
  section,
  collapsed,
  onToggle,
  onItemClick,
}: {
  section: TagesjournalSection;
  collapsed: boolean;
  onToggle: () => void;
  onItemClick: (item: TagesjournalItem) => void;
}) => {
  const panelId = `legal-journal-section-${section.kind}`;

  return (
    <div>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={panelId}
        data-testid={`legal-calendar-events-section-${section.kind}`}
      >
        <span className={styles.sectionIcon}>{section.icon}</span>
        <span>{section.title}</span>
        <span className={styles.sectionCount}>{section.items.length}</span>
      </button>

      <div id={panelId} role="region" aria-label={section.title}>
        {!collapsed &&
          section.items.map(item => (
            <LegalEventItem
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
            />
          ))}
      </div>
    </div>
  );
};

const LegalEventItem = ({
  item,
  onClick,
}: {
  item: TagesjournalItem;
  onClick: () => void;
}) => {
  const urgency = item.urgency ?? 'normal';

  return (
    <Tooltip
      content={
        item.sublabel
          ? `${item.label}\n${item.sublabel}`
          : item.label
      }
      options={{ sideOffset: 8 }}
    >
      <button
        type="button"
        className={styles.item}
        onClick={onClick}
        aria-label={item.label}
        data-testid="legal-calendar-events-item"
      >
        <div className={styles.urgencyBar[urgency]} />

        <div className={styles.itemContent}>
          <div className={styles.itemTitle}>{item.label}</div>
          {item.sublabel && (
            <div className={styles.itemSublabel}>{item.sublabel}</div>
          )}
        </div>

        {item.time && (
          <span className={styles.itemTime}>{item.time}</span>
        )}

        {item.statusText && item.statusVariant && (
          <span className={styles.statusChip[item.statusVariant]}>
            {item.statusText}
          </span>
        )}
      </button>
    </Tooltip>
  );
};
