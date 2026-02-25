import type { DateCell } from '@affine/component';
import {
  DatePicker,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  useConfirmModal,
} from '@affine/component';
import { Guard } from '@affine/core/components/guard';
import { MoveToTrash } from '@affine/core/components/page-list';
import { CaseAssistantStore } from '@affine/core/modules/case-assistant/stores/case-assistant';
import { WorkspaceServerService } from '@affine/core/modules/cloud';
import {
  type DocRecord,
  DocService,
  DocsService,
} from '@affine/core/modules/doc';
import { DocDisplayMetaService } from '@affine/core/modules/doc-display-meta';
import { IntegrationService } from '@affine/core/modules/integration';
import { JournalService } from '@affine/core/modules/journal';
import {
  ViewService,
  WorkbenchLink,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import { CalendarXmarkIcon, EditIcon } from '@blocksuite/icons/rc';
import {
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import clsx from 'clsx';
import dayjs from 'dayjs';
import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CalendarEvents } from './calendar-events';
import * as styles from './journal.css';
import { LegalCalendarEvents } from './legal-calendar-events';
import { JournalTemplateOnboarding } from './template-onboarding';
import { JournalTemplateSetting } from './template-setting';

/**
 * @internal
 */
const CountDisplay = ({
  count,
  max = 99,
  ...attrs
}: { count: number; max?: number } & HTMLAttributes<HTMLSpanElement>) => {
  return <span {...attrs}>{count > max ? `${max}+` : count}</span>;
};
interface PageItemProps extends Omit<
  HTMLAttributes<HTMLAnchorElement>,
  'onClick'
> {
  docId: string;
  right?: ReactNode;
  duplicate?: boolean;
}
const PageItem = ({
  docId,
  right,
  duplicate,
  className,
  ...attrs
}: PageItemProps) => {
  const i18n = useI18n();
  const docDisplayMetaService = useService(DocDisplayMetaService);
  const Icon = useLiveData(docDisplayMetaService.icon$(docId));
  const title = useLiveData(docDisplayMetaService.title$(docId));

  return (
    <WorkbenchLink
      data-testid="journal-conflict-item"
      aria-label={title}
      to={`/${docId}`}
      className={clsx(className, styles.pageItem)}
      {...attrs}
    >
      <div className={styles.pageItemIcon}>
        <Icon width={20} height={20} />
      </div>
      <div className={styles.pageItemLabel}>
        {title}
        {duplicate ? (
          <div className={styles.duplicateTag}>
            {i18n['com.affine.page-properties.property.journal-duplicated']()}
          </div>
        ) : null}
      </div>
      {right}
    </WorkbenchLink>
  );
};

interface JournalBlockProps {
  date: dayjs.Dayjs;
}

type DateDotType = 'journal' | 'event' | 'legal';

const mobile = environment.isMobile;
export const EditorJournalPanel = () => {
  const t = useI18n();
  const doc = useServiceOptional(DocService)?.doc;
  const workbench = useService(WorkbenchService).workbench;
  const viewService = useService(ViewService);
  const journalService = useService(JournalService);
  const calendar = useService(IntegrationService).calendar;
  const workspaceServerService = useService(WorkspaceServerService);
  const server = useLiveData(workspaceServerService.server$);
  const location = useLiveData(viewService.view.location$);
  const journalDateStr = useLiveData(
    doc ? journalService.journalDate$(doc.id) : null
  );
  const journalDate = journalDateStr ? dayjs(journalDateStr) : null;
  const isJournal = !!journalDate;
  const routeDate = useMemo(() => {
    if (!location.pathname.startsWith('/journals')) return null;
    const searchParams = new URLSearchParams(location.search);
    const rawDate = searchParams.get('date');
    return rawDate ? dayjs(rawDate) : dayjs();
  }, [location.pathname, location.search]);
  const [selectedDate, setSelectedDate] = useState(() => {
    return journalDate ?? routeDate ?? dayjs();
  });
  const [calendarCursor, setCalendarCursor] = useState(selectedDate);
  const calendarCursorMonthKey = useMemo(() => {
    return calendarCursor.format('YYYY-MM');
  }, [calendarCursor]);
  const calendarCursorMonthStart = useMemo(() => {
    return dayjs(`${calendarCursorMonthKey}-01`);
  }, [calendarCursorMonthKey]);
  const calendarCursorMonthEnd = useMemo(() => {
    return dayjs(`${calendarCursorMonthKey}-01`).endOf('month');
  }, [calendarCursorMonthKey]);
  const caseAssistantStore = useService(CaseAssistantStore);
  const allJournalDates = useLiveData(journalService.allJournalDates$);
  const eventDates = useLiveData(calendar.eventDates$);
  const workspaceCalendars = useLiveData(calendar.workspaceCalendars$);
  const workspaceCalendarId = workspaceCalendars[0]?.id;

  useEffect(() => {
    if (journalDate && !journalDate.isSame(selectedDate, 'day')) {
      setSelectedDate(journalDate);
    }
  }, [journalDate, selectedDate]);

  useEffect(() => {
    if (journalDate || !routeDate) return;
    if (!routeDate.isSame(selectedDate, 'day')) {
      setSelectedDate(routeDate);
    }
  }, [journalDate, routeDate, selectedDate]);

  useEffect(() => {
    setCalendarCursor(selectedDate);
  }, [selectedDate]);

  const openJournal = useCallback(
    (date: string) => {
      const docs = journalService.journalsByDate$(date).value;
      if (docs.length > 0) {
        workbench.openDoc(docs[0].id, { at: 'active' });
      } else {
        workbench.open(`/journals?date=${date}`, { at: 'active' });
      }
    },
    [journalService, workbench]
  );

  const onDateSelect = useCallback(
    (date: string) => {
      if (dayjs(date).isSame(selectedDate, 'day')) return;
      setSelectedDate(dayjs(date));
      openJournal(date);
    },
    [openJournal, selectedDate]
  );

  const caseGraph = useLiveData(caseAssistantStore.watchGraph());
  const legalDates = useMemo(() => {
    const dates = new Set<string>();
    const deadlines = Object.values(caseGraph?.deadlines ?? {}) as Array<{
      dueAt: string;
      status: string;
    }>;
    for (const d of deadlines) {
      if (d.status === 'completed' || d.status === 'expired') continue;
      if (d.dueAt) {
        dates.add(dayjs(d.dueAt).format('YYYY-MM-DD'));
      }
    }
    const termine = Object.values(caseGraph?.termine ?? {}) as Array<{
      datum: string;
      status: string;
    }>;
    for (const t of termine) {
      if (t.status === 'abgesagt' || t.status === 'abgeschlossen') continue;
      if (t.datum) {
        dates.add(dayjs(t.datum).format('YYYY-MM-DD'));
      }
    }
    return dates;
  }, [caseGraph?.deadlines, caseGraph?.termine]);

  useEffect(() => {
    calendar.revalidateWorkspaceCalendars().catch(() => undefined);
    calendar.loadAccountCalendars().catch(() => undefined);
  }, [calendar, server]);

  useEffect(() => {
    const update = () => {
      calendar
        .revalidateEventsRange(calendarCursorMonthStart, calendarCursorMonthEnd)
        .catch(() => undefined);
    };
    update();
    const interval = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [
    calendar,
    calendarCursorMonthEnd,
    calendarCursorMonthStart,
    workspaceCalendarId,
  ]);

  const getDotType = useCallback(
    (dateKey: string): DateDotType[] => {
      const dotTypes: DateDotType[] = [];
      if (allJournalDates.has(dateKey)) {
        dotTypes.push('journal');
      }
      if (eventDates.has(dateKey)) {
        dotTypes.push('event');
      }
      if (legalDates.has(dateKey)) {
        dotTypes.push('legal');
      }
      return dotTypes;
    },
    [allJournalDates, legalDates, eventDates]
  );

  const customDayRenderer = useCallback(
    (cell: DateCell) => {
      const dateKey = cell.date.format('YYYY-MM-DD');
      const dotTypes = getDotType(dateKey);
      return (
        <button
          className={styles.journalDateCell}
          data-is-date-cell
          tabIndex={cell.focused ? 0 : -1}
          data-is-today={cell.isToday}
          data-not-current-month={cell.notCurrentMonth}
          data-selected={cell.selected}
          data-is-journal={isJournal}
          data-has-journal={allJournalDates.has(dateKey)}
          data-mobile={mobile}
        >
          {cell.label}
          {!cell.selected && dotTypes.length ? (
            <div className={styles.journalDateCellDotContainer}>
              {dotTypes.map(dotType => (
                <div
                  key={dotType}
                  className={clsx(
                    styles.journalDateCellDot,
                    styles.journalDateCellDotType[dotType]
                  )}
                />
              ))}
            </div>
          ) : null}
        </button>
      );
    },
    [allJournalDates, getDotType, isJournal]
  );

  return (
    <div
      className={styles.journalPanel}
      data-is-journal={isJournal}
      data-testid="sidebar-journal-panel"
    >
      <div data-mobile={mobile} className={styles.calendar}>
        <DatePicker
          weekDays={t['com.affine.calendar-date-picker.week-days']()}
          monthNames={t['com.affine.calendar-date-picker.month-names']()}
          todayLabel={t['com.affine.calendar-date-picker.today']()}
          customDayRenderer={customDayRenderer}
          value={selectedDate.format('YYYY-MM-DD')}
          onChange={onDateSelect}
          onCursorChange={setCalendarCursor}
          cellSize={34}
        />
      </div>
      <JournalTemplateOnboarding />
      <JournalConflictBlock date={selectedDate} />
      <CalendarEvents date={selectedDate} />
      <LegalCalendarEvents date={selectedDate} />
      <JournalTemplateSetting />
    </div>
  );
};

export const sortPagesByDate = (
  docs: DocRecord[],
  field: 'updatedDate' | 'createDate',
  order: 'asc' | 'desc' = 'desc'
) => {
  return [...docs].sort((a, b) => {
    return (
      (order === 'asc' ? 1 : -1) *
      dayjs(b.meta$.value[field]).diff(dayjs(a.meta$.value[field]))
    );
  });
};

const MAX_CONFLICT_COUNT = 5;
interface ConflictListProps
  extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  docRecords: DocRecord[];
}
const ConflictList = ({
  docRecords,
  children,
  className,
  ...attrs
}: ConflictListProps) => {
  const t = useI18n();
  const currentDocId = useServiceOptional(DocService)?.doc.id;
  const journalService = useService(JournalService);
  const { openConfirmModal } = useConfirmModal();

  const handleOpenTrashModal = useCallback(
    (docRecord: DocRecord) => {
      openConfirmModal({
        title: t['com.affine.moveToTrash.confirmModal.title'](),
        description: t['com.affine.moveToTrash.confirmModal.description']({
          title: docRecord.title$.value || t['Untitled'](),
        }),
        cancelText: t['com.affine.confirmModal.button.cancel'](),
        confirmButtonOptions: {
          variant: 'error',
        },
        confirmText: t.Delete(),
        onConfirm: () => {
          docRecord.moveToTrash();
        },
      });
    },
    [openConfirmModal, t]
  );
  const handleRemoveJournalMark = useCallback(
    (docId: string) => {
      journalService.removeJournalDate(docId);
    },
    [journalService]
  );

  return (
    <div
      data-testid="journal-conflict-list"
      className={clsx(styles.journalConflictWrapper, className)}
      {...attrs}
    >
      {docRecords.map(docRecord => {
        const isCurrent = currentDocId ? docRecord.id === currentDocId : false;
        return (
          <PageItem
            aria-selected={isCurrent}
            docId={docRecord.id}
            key={docRecord.id}
            duplicate
            right={
              <Menu
                contentOptions={{
                  style: { width: 237, maxWidth: '100%' },
                  align: 'end',
                  alignOffset: -4,
                  sideOffset: 8,
                }}
                items={
                  <>
                    <Guard docId={docRecord.id} permission="Doc_Update">
                      {canEdit => (
                        <MenuItem
                          prefixIcon={<CalendarXmarkIcon />}
                          onClick={e => {
                            e.stopPropagation();
                            handleRemoveJournalMark(docRecord.id);
                          }}
                          data-testid="journal-conflict-remove-mark"
                          disabled={!canEdit}
                        >
                          {t[
                            'com.affine.page-properties.property.journal-remove'
                          ]()}
                        </MenuItem>
                      )}
                    </Guard>
                    <MenuSeparator />
                    <Guard docId={docRecord.id} permission="Doc_Trash">
                      {canTrash => (
                        <MoveToTrash
                          onSelect={() => handleOpenTrashModal(docRecord)}
                          disabled={!canTrash}
                        />
                      )}
                    </Guard>
                  </>
                }
              >
                <IconButton
                  data-testid="journal-conflict-edit"
                  icon={<EditIcon />}
                />
              </Menu>
            }
          />
        );
      })}
      {children}
    </div>
  );
};
const JournalConflictBlock = ({ date }: JournalBlockProps) => {
  const t = useI18n();
  const docRecordList = useService(DocsService).list;
  const journalService = useService(JournalService);
  const dateString = date.format('YYYY-MM-DD');
  const docs = useLiveData(
    useMemo(
      () => journalService.journalsByDate$(dateString),
      [dateString, journalService]
    )
  );
  const docRecords = useLiveData(
    docRecordList.docs$.map(records =>
      records.filter(v => {
        return docs.some(doc => doc.id === v.id);
      })
    )
  );

  if (docs.length <= 1) return null;

  return (
    <ConflictList
      className={styles.journalConflictBlock}
      docRecords={docRecords.slice(0, MAX_CONFLICT_COUNT)}
    >
      {docs.length > MAX_CONFLICT_COUNT ? (
        <Menu
          items={
            <ConflictList docRecords={docRecords.slice(MAX_CONFLICT_COUNT)} />
          }
        >
          <div className={styles.journalConflictMoreTrigger}>
            {t['com.affine.journal.conflict-show-more']({
              count: (docRecords.length - MAX_CONFLICT_COUNT).toFixed(0),
            })}
          </div>
        </Menu>
      ) : null}
    </ConflictList>
  );
};
