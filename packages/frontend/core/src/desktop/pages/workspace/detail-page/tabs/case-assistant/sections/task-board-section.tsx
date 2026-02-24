import type {
  CaseAssistantAction,
  CopilotTask,
  CopilotTaskStatus,
} from '@affine/core/modules/case-assistant';
import clsx from 'clsx';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './task-board-section.css';
import { priorityLabel } from '../panel-types';

type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';

const STATUS_CONFIG: Record<TaskStatus, { label: string; accent: string; bg: string; border: string }> = {
  open: {
    label: '○ Offen',
    accent: cssVarV2('text/secondary'),
    bg: cssVarV2('layer/background/secondary'),
    border: cssVarV2('layer/insideBorder/border'),
  },
  in_progress: {
    label: 'In Arbeit',
    accent: cssVarV2('button/primary'),
    bg: cssVarV2('layer/background/secondary'),
    border: cssVarV2('button/primary'),
  },
  blocked: {
    label: 'Blockiert',
    accent: cssVarV2('status/error'),
    bg: cssVarV2('layer/background/secondary'),
    border: cssVarV2('status/error'),
  },
  done: {
    label: '✓ Erledigt',
    accent: cssVarV2('status/success'),
    bg: cssVarV2('layer/background/secondary'),
    border: cssVarV2('status/success'),
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: cssVarV2('status/error'),
  high: cssVarV2('text/primary'),
  medium: cssVarV2('text/secondary'),
  low: cssVarV2('text/secondary'),
};

type Props = {
  caseTaskList: CopilotTask[];
  taskAssignees: Record<string, string>;
  canAction: (action: CaseAssistantAction) => boolean;
  isWorkflowBusy: boolean;
  onTaskAssigneeChange: (taskId: string, assignee: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
};

export const TaskBoardSection = memo((props: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CopilotTaskStatus | 'all'>('all');

  const tasks = props.caseTaskList;
  const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);

  const counts = {
    open: tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  const canManage = props.canAction('task.manage') && !props.isWorkflowBusy;

  return (
    <div className={styles.taskBoard}>
      <div className={styles.headerRow}>
        <h4 className={styles.sectionTitle}>Aufgaben-Board</h4>
        <span className={localStyles.headerMeta}>{tasks.length} Tasks</span>
      </div>

      {tasks.length === 0 ? (
        <div className={`${styles.empty} ${localStyles.emptyState}`}>
          <div className={localStyles.emptyIcon}></div>
          <div className={localStyles.emptyTitle}>Noch keine Aufgaben</div>
          <div className={localStyles.emptyHint}>Starte eine Fallanalyse, um automatisch Tasks zu generieren.</div>
        </div>
      ) : (
        <>
          {/* Status-Filter + KPI */}
          <div className={localStyles.filterRow}>
            <button type="button" onClick={() => setStatusFilter('all')}
              aria-pressed={statusFilter === 'all'}
              className={
                statusFilter === 'all'
                  ? `${localStyles.filterButton} ${localStyles.filterButtonActive}`
                  : localStyles.filterButton
              }
              style={assignInlineVars({
                [localStyles.accentColorVar]: cssVarV2('button/primary'),
                [localStyles.surfaceVar]: cssVarV2('layer/background/secondary'),
              })}
            >
              Alle ({tasks.length})
            </button>
            {(Object.entries(counts) as [TaskStatus, number][]).map(([st, cnt]) => {
              const cfg = STATUS_CONFIG[st];
              return (
                <button key={st} type="button" onClick={() => setStatusFilter(st)}
                  aria-pressed={statusFilter === st}
                  className={
                    statusFilter === st
                      ? `${localStyles.filterButton} ${localStyles.filterButtonActive}`
                      : localStyles.filterButton
                  }
                  style={assignInlineVars({
                    [localStyles.accentColorVar]: statusFilter === st ? cfg.accent : cssVarV2('text/secondary'),
                    [localStyles.surfaceVar]: statusFilter === st ? cfg.bg : 'transparent',
                  })}
                >
                  {cfg.label} ({cnt})
                </button>
              );
            })}
          </div>

          <ul className={localStyles.taskList}>
            {filtered.map(task => {
              const isExp = expandedId === task.id;
              const stCfg = STATUS_CONFIG[task.status as TaskStatus] ?? STATUS_CONFIG.open;
              const priColor = PRIORITY_COLOR[task.priority] ?? cssVarV2('text/secondary');

              return (
                <li
                  key={task.id}
                  className={localStyles.taskCard}
                  style={assignInlineVars({
                    [localStyles.borderVar]: stCfg.border,
                    [localStyles.surfaceVar]: stCfg.bg,
                  })}
                >
                  {/* Header */}
                  <button type="button" onClick={() => setExpandedId(isExp ? null : task.id)}
                    aria-expanded={isExp}
                    className={localStyles.taskHeaderButton}
                  >
                    <div className={localStyles.col}>
                      <div className={localStyles.headerTagRow}>
                        <span
                          className={localStyles.statusChip}
                          style={assignInlineVars({
                            [localStyles.accentColorVar]: stCfg.accent,
                            [localStyles.surfaceVar]: cssVarV2('layer/background/primary'),
                            [localStyles.borderVar]: stCfg.border,
                          })}
                        >
                          {stCfg.label}
                        </span>
                        <span
                          className={localStyles.priorityText}
                          style={assignInlineVars({ [localStyles.accentColorVar]: priColor })}
                        >
                          {priorityLabel[task.priority]}
                        </span>
                        {(props.taskAssignees[task.id] ?? task.assignee) ? (
                          <span className={localStyles.assignee}>
                            {props.taskAssignees[task.id] ?? task.assignee}
                          </span>
                        ) : null}
                      </div>
                      <div className={clsx(localStyles.taskTitle, isExp && localStyles.taskTitleExpanded)}>
                        {task.title}
                      </div>
                    </div>
                    <span className={localStyles.caret}>{isExp ? 'Schließen' : 'Öffnen'}</span>
                  </button>

                  {/* Expanded */}
                  {isExp ? (
                    <div className={localStyles.expandedBody}>
                      {task.description ? (
                        <div className={localStyles.description}>
                          {task.description}
                        </div>
                      ) : null}

                      {/* Assignee */}
                      <label className={localStyles.assigneeLabel}>
                        Zuständig
                        <input
                          className={`${styles.input} ${localStyles.assigneeInput}`}
                          value={props.taskAssignees[task.id] ?? task.assignee ?? ''}
                          onChange={e => props.onTaskAssigneeChange(task.id, e.target.value)}
                          placeholder="z. B. RA Müller"
                        />
                      </label>

                      {/* Status-Buttons */}
                      <div className={localStyles.statusButtons}>
                        {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(([st, cfg]) => (
                          <button key={st} type="button"
                            disabled={!canManage || task.status === st}
                            onClick={() => props.runAsyncUiAction(() => props.onUpdateTaskStatus(task.id, st), `task ${st} failed`)}
                            className={
                              task.status === st
                                ? `${localStyles.statusAction} ${localStyles.statusActionActive}`
                                : localStyles.statusAction
                            }
                            style={assignInlineVars({
                              [localStyles.accentColorVar]: cfg.accent,
                              [localStyles.borderVar]: cfg.border,
                              [localStyles.surfaceVar]: task.status === st ? cfg.bg : 'transparent',
                              [localStyles.opacityVar]: !canManage ? '0.5' : '1',
                            })}
                          >
                            {cfg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
});

TaskBoardSection.displayName = 'TaskBoardSection';
