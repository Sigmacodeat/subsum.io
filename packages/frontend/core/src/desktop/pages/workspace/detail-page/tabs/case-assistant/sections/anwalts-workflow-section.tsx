import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useI18n } from '@affine/i18n';

import type {
  Aktennotiz,
  AktennotizKind,
  TimerSession,
  CasePriority,
  TimeEntry,
  Vollmacht,
  Wiedervorlage,
} from '@affine/core/modules/case-assistant';
import {
  AktennotizService,
  LiveTimerService,
  TimeTrackingService,
  VollmachtService,
  WiedervorlageService,
} from '@affine/core/modules/case-assistant';
import { useLiveData, useService } from '@toeverything/infra';

import { ConflictCenterSection } from './conflict-center-section';
import { GerichtsterminSection } from './gerichtstermin-section';
import { KalenderSection } from './kalender-section';
import { RechnungSection } from './rechnung-section';

import * as styles from './anwalts-workflow-section.css';

type TabId = 'wiedervorlage' | 'notizen' | 'vollmachten' | 'zeiten' | 'termine' | 'kalender' | 'finanzen' | 'konflikte';

export function AnwaltsWorkflowSection({
  sectionRef,
  workspaceId,
  caseId,
  matterId,
  clientId,
  anwaltId,
  caseClientName,
  activeAnwaltName,
  opposingPartyNames,
  initialTab,
  highlightedDeadlineId,
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  workspaceId: string;
  caseId: string;
  matterId?: string;
  clientId?: string;
  anwaltId?: string;
  caseClientName?: string | null;
  activeAnwaltName?: string | null;
  opposingPartyNames?: string[];
  initialTab?: TabId;
  highlightedDeadlineId?: string;
}) {
  const t = useI18n();
  const wiedervorlageService = useService(WiedervorlageService);
  const aktennotizService = useService(AktennotizService);
  const vollmachtService = useService(VollmachtService);
  const timeTrackingService = useService(TimeTrackingService);
  const liveTimerService = useService(LiveTimerService);

  const [tab, setTab] = useState<TabId>('wiedervorlage');
  const hasAppliedInitialTabRef = useRef(false);
  const hasAppliedDeadlineFocusRef = useRef(false);
  const [timerSessions, setTimerSessions] = useState<TimerSession[]>([]);
  const [timerTick, setTimerTick] = useState(Date.now());

  useEffect(() => {
    if (hasAppliedInitialTabRef.current) {
      return;
    }
    if (!initialTab) {
      return;
    }
    setTab(initialTab);
    hasAppliedInitialTabRef.current = true;
  }, [initialTab]);

  useEffect(() => {
    if (hasAppliedDeadlineFocusRef.current) {
      return;
    }
    if (!highlightedDeadlineId) {
      return;
    }
    setTab('kalender');
    hasAppliedDeadlineFocusRef.current = true;
  }, [highlightedDeadlineId]);

  const wiedervorlagen = ((useLiveData(wiedervorlageService.wiedervorlagen$) ?? []) as Wiedervorlage[])
    .filter(w => w.caseId === caseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notizen = ((useLiveData(aktennotizService.aktennotizen$) ?? []) as Aktennotiz[])
    .filter(n => n.caseId === caseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const vollmachten = ((useLiveData(vollmachtService.vollmachten$) ?? []) as Vollmacht[])
    .filter(v => v.caseId === caseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const zeiten = ((useLiveData(timeTrackingService.timeEntries$) ?? []) as TimeEntry[])
    .filter(t => t.caseId === caseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  useEffect(() => {
    const sessionsSub = liveTimerService.sessionsList$.subscribe(setTimerSessions);
    const tickSub = liveTimerService.tick$.subscribe(setTimerTick);
    return () => {
      sessionsSub.unsubscribe();
      tickSub.unsubscribe();
    };
  }, [liveTimerService]);

  const [wTitle, setWTitle] = useState('');
  const [wDueAt, setWDueAt] = useState('');
  const [wPriority, setWPriority] = useState<CasePriority>('medium');

  const [nTitle, setNTitle] = useState('');
  const [nContent, setNContent] = useState('');
  const [nKind, setNKind] = useState<AktennotizKind>('sonstiges');

  const [vTitle, setVTitle] = useState('');
  const [vType, setVType] = useState<Vollmacht['type']>('process');
  const [vGrantedTo, setVGrantedTo] = useState('');
  const [vFrom, setVFrom] = useState(new Date().toISOString().slice(0, 10));
  const [vUntil, setVUntil] = useState('');

  const [tDescription, setTDescription] = useState('');
  const [tType, setTType] = useState<TimeEntry['activityType']>('beratung');
  const [tMinutes, setTMinutes] = useState('60');
  const [tRate, setTRate] = useState('220');
  const [tDate, setTDate] = useState(new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState<string | null>(null);
  const language = t.language || 'en';

  const disabled = !matterId || !clientId;
  const effectiveAnwaltId = anwaltId ?? 'system';
  const activeTimer = timerSessions.find(
    session =>
      session.anwaltId === effectiveAnwaltId &&
      (session.status === 'running' || session.status === 'paused')
  ) ?? null;
  const activeTimerSnapshot = useMemo(
    () => (activeTimer ? liveTimerService.getTimerSnapshot(activeTimer.id) : null),
    [activeTimer, liveTimerService, timerTick]
  );

  const terminTeilnehmerDefault = Array.from(
    new Set(
      [
        caseClientName?.trim(),
        activeAnwaltName?.trim(),
        ...(opposingPartyNames ?? []).map(name => name.trim()),
      ].filter((value): value is string => Boolean(value))
    )
  );

  return (
    <section ref={sectionRef} className={styles.root}>
      <h4 className={styles.title}>{t['com.affine.caseAssistant.workflow.title']()}</h4>

      <div aria-live="polite" className={styles.feedback}>
        {feedback ?? ''}
      </div>

      <div role="tablist" aria-label={t['com.affine.caseAssistant.workflow.tabs.aria']()} className={styles.tabList}>
        <button
          id="anwalts-workflow-tab-wiedervorlage"
          type="button"
          role="tab"
          aria-selected={tab === 'wiedervorlage'}
          aria-controls="anwalts-workflow-panel-wiedervorlage"
          className={clsx(styles.tabButton, tab === 'wiedervorlage' && styles.tabButtonActive)}
          onClick={() => setTab('wiedervorlage')}
        >
          {t.t('com.affine.caseAssistant.workflow.tabs.wiedervorlage', {
            count: wiedervorlagen.length,
          })}
        </button>
        <button
          id="anwalts-workflow-tab-notizen"
          type="button"
          role="tab"
          aria-selected={tab === 'notizen'}
          aria-controls="anwalts-workflow-panel-notizen"
          className={clsx(styles.tabButton, tab === 'notizen' && styles.tabButtonActive)}
          onClick={() => setTab('notizen')}
        >
          {t.t('com.affine.caseAssistant.workflow.tabs.notizen', {
            count: notizen.length,
          })}
        </button>
        <button
          id="anwalts-workflow-tab-vollmachten"
          type="button"
          role="tab"
          aria-selected={tab === 'vollmachten'}
          aria-controls="anwalts-workflow-panel-vollmachten"
          className={clsx(styles.tabButton, tab === 'vollmachten' && styles.tabButtonActive)}
          onClick={() => setTab('vollmachten')}
        >
          {t.t('com.affine.caseAssistant.workflow.tabs.vollmachten', {
            count: vollmachten.length,
          })}
        </button>
        <button
          id="anwalts-workflow-tab-zeiten"
          type="button"
          role="tab"
          aria-selected={tab === 'zeiten'}
          aria-controls="anwalts-workflow-panel-zeiten"
          className={clsx(styles.tabButton, tab === 'zeiten' && styles.tabButtonActive)}
          onClick={() => setTab('zeiten')}
        >
          {t.t('com.affine.caseAssistant.workflow.tabs.zeiten', {
            count: zeiten.length,
          })}
        </button>

        <button
          id="anwalts-workflow-tab-termine"
          type="button"
          role="tab"
          aria-selected={tab === 'termine'}
          aria-controls="anwalts-workflow-panel-termine"
          className={clsx(styles.tabButton, tab === 'termine' && styles.tabButtonActive)}
          onClick={() => setTab('termine')}
        >
          {t['com.affine.caseAssistant.workflow.tabs.termine']()}
        </button>

        <button
          id="anwalts-workflow-tab-kalender"
          type="button"
          role="tab"
          aria-selected={tab === 'kalender'}
          aria-controls="anwalts-workflow-panel-kalender"
          className={clsx(styles.tabButton, tab === 'kalender' && styles.tabButtonActive)}
          onClick={() => setTab('kalender')}
        >
          {t['com.affine.caseAssistant.workflow.tabs.kalender']()}
        </button>

        <button
          id="anwalts-workflow-tab-finanzen"
          type="button"
          role="tab"
          aria-selected={tab === 'finanzen'}
          aria-controls="anwalts-workflow-panel-finanzen"
          className={clsx(styles.tabButton, tab === 'finanzen' && styles.tabButtonActive)}
          onClick={() => setTab('finanzen')}
        >
          {t['com.affine.caseAssistant.workflow.tabs.finanzen']()}
        </button>

        <button
          id="anwalts-workflow-tab-konflikte"
          type="button"
          role="tab"
          aria-selected={tab === 'konflikte'}
          aria-controls="anwalts-workflow-panel-konflikte"
          className={clsx(
            styles.tabButton,
            tab === 'konflikte' ? styles.tabButtonDangerActive : undefined
          )}
          onClick={() => setTab('konflikte')}
        >
          {t['com.affine.caseAssistant.workflow.tabs.konflikte']()}
        </button>
      </div>

      {disabled ? (
        <div className={styles.warningBox}>
          {t['com.affine.caseAssistant.workflow.warning.selectClientAndMatter']()}
        </div>
      ) : null}

      {tab === 'wiedervorlage' ? (
        <div
          id="anwalts-workflow-panel-wiedervorlage"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-wiedervorlage"
          className={styles.tabPanel}
        >
          <div className={styles.row}>
            <input
              aria-label={t['com.affine.caseAssistant.workflow.wiedervorlage.aria.title']()}
              value={wTitle}
              onChange={e => setWTitle(e.target.value)}
              placeholder={t['com.affine.caseAssistant.workflow.placeholder.title']()}
              className={styles.flex1}
            />
            <input aria-label={t['com.affine.caseAssistant.workflow.wiedervorlage.aria.dueAt']()} type="datetime-local" value={wDueAt} onChange={e => setWDueAt(e.target.value)} />
            <select aria-label={t['com.affine.caseAssistant.workflow.wiedervorlage.aria.priority']()} value={wPriority} onChange={e => setWPriority(e.target.value as CasePriority)}>
              <option value="critical">{t['com.affine.caseAssistant.workflow.priority.critical']()}</option>
              <option value="high">{t['com.affine.caseAssistant.workflow.priority.high']()}</option>
              <option value="medium">{t['com.affine.caseAssistant.workflow.priority.medium']()}</option>
              <option value="low">{t['com.affine.caseAssistant.workflow.priority.low']()}</option>
            </select>
            <button
              type="button"
              disabled={disabled || !wTitle.trim() || !wDueAt}
              onClick={() => {
                void wiedervorlageService.createWiedervorlage({
                  workspaceId,
                  caseId,
                  matterId: matterId!,
                  clientId: clientId!,
                  title: wTitle.trim(),
                  dueAt: new Date(wDueAt).toISOString(),
                  priority: wPriority,
                })
                  .then(() => {
                    setWTitle('');
                    setWDueAt('');
                    setFeedback(t['com.affine.caseAssistant.workflow.wiedervorlage.feedback.created']());
                  })
                  .catch((error: unknown) => {
                    setFeedback(
                      error instanceof Error
                        ? error.message
                        : t['com.affine.caseAssistant.workflow.wiedervorlage.feedback.createFailed']()
                    );
                  });
              }}
            >
              +
            </button>
          </div>
          {wiedervorlagen.length === 0 ? (
            <div className={styles.emptyText}>
              {t['com.affine.caseAssistant.workflow.wiedervorlage.empty']()}
            </div>
          ) : null}
          {wiedervorlagen.map(w => (
            <div key={w.id} className={styles.listItemRow}>
              <span>{w.title} · {new Date(w.dueAt).toLocaleString(language)}</span>
              <button type="button" disabled={w.status !== 'pending'} onClick={() => void wiedervorlageService.completeWiedervorlage(w.id)}>{t['com.affine.caseAssistant.workflow.action.complete']()}</button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'notizen' ? (
        <div
          id="anwalts-workflow-panel-notizen"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-notizen"
          className={styles.tabPanel}
        >
          <div className={styles.row}>
            <input
              aria-label={t['com.affine.caseAssistant.workflow.notizen.aria.title']()}
              value={nTitle}
              onChange={e => setNTitle(e.target.value)}
              placeholder={t['com.affine.caseAssistant.workflow.placeholder.title']()}
              className={styles.flex1}
            />
            <select aria-label={t['com.affine.caseAssistant.workflow.notizen.aria.kind']()} value={nKind} onChange={e => setNKind(e.target.value as AktennotizKind)}>
              <option value="telefonat">{t['com.affine.caseAssistant.workflow.noteKind.telefonat']()}</option>
              <option value="besprechung">{t['com.affine.caseAssistant.workflow.noteKind.besprechung']()}</option>
              <option value="beschluss">{t['com.affine.caseAssistant.workflow.noteKind.beschluss']()}</option>
              <option value="sonstiges">{t['com.affine.caseAssistant.workflow.noteKind.sonstiges']()}</option>
            </select>
            <button
              type="button"
              disabled={disabled || !nTitle.trim() || !nContent.trim()}
              onClick={() => {
                void aktennotizService.createAktennotiz({
                  workspaceId,
                  caseId,
                  matterId: matterId!,
                  clientId: clientId!,
                  title: nTitle.trim(),
                  content: nContent.trim(),
                  kind: nKind,
                  isInternal: true,
                  authorId: anwaltId ?? 'system',
                })
                  .then(() => {
                    setNTitle('');
                    setNContent('');
                    setFeedback(t['com.affine.caseAssistant.workflow.notizen.feedback.saved']());
                  })
                  .catch((error: unknown) => {
                    setFeedback(
                      error instanceof Error
                        ? error.message
                        : t['com.affine.caseAssistant.workflow.notizen.feedback.saveFailed']()
                    );
                  });
              }}
            >
              +
            </button>
          </div>
          <textarea aria-label={t['com.affine.caseAssistant.workflow.notizen.aria.content']()} value={nContent} onChange={e => setNContent(e.target.value)} placeholder={t['com.affine.caseAssistant.workflow.placeholder.content']()} rows={3} />
          {notizen.length === 0 ? (
            <div className={styles.emptyText}>{t['com.affine.caseAssistant.workflow.notizen.empty']()}</div>
          ) : null}
          {notizen.map(n => (
            <div key={n.id} className={styles.listItemBlock}>
              <div><b>{n.title}</b> ({n.kind})</div>
              <div className={styles.preWrap}>{n.content}</div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'vollmachten' ? (
        <div
          id="anwalts-workflow-panel-vollmachten"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-vollmachten"
          className={styles.tabPanel}
        >
          <div className={styles.row}>
            <input
              aria-label={t['com.affine.caseAssistant.workflow.vollmachten.aria.title']()}
              value={vTitle}
              onChange={e => setVTitle(e.target.value)}
              placeholder={t['com.affine.caseAssistant.workflow.placeholder.title']()}
              className={styles.flex1}
            />
            <input aria-label={t['com.affine.caseAssistant.workflow.vollmachten.aria.grantedTo']()} value={vGrantedTo} onChange={e => setVGrantedTo(e.target.value)} placeholder={t['com.affine.caseAssistant.workflow.vollmachten.placeholder.grantedTo']()} />
            <button
              type="button"
              disabled={disabled || !vTitle.trim() || !vGrantedTo.trim()}
              onClick={() => {
                void vollmachtService.createVollmacht({
                  workspaceId,
                  caseId,
                  matterId: matterId!,
                  clientId: clientId!,
                  type: vType,
                  title: vTitle.trim(),
                  grantedTo: anwaltId ?? 'system',
                  grantedToName: vGrantedTo.trim(),
                  validFrom: vFrom,
                  validUntil: vUntil || undefined,
                })
                  .then(() => {
                    setVTitle('');
                    setVGrantedTo('');
                    setFeedback(t['com.affine.caseAssistant.workflow.vollmachten.feedback.created']());
                  })
                  .catch((error: unknown) => {
                    setFeedback(
                      error instanceof Error
                        ? error.message
                        : t['com.affine.caseAssistant.workflow.vollmachten.feedback.createFailed']()
                    );
                  });
              }}
            >
              +
            </button>
          </div>
          <div className={styles.row}>
            <select aria-label={t['com.affine.caseAssistant.workflow.vollmachten.aria.type']()} value={vType} onChange={e => setVType(e.target.value as Vollmacht['type'])}>
              <option value="process">{t['com.affine.caseAssistant.workflow.vollmachten.type.process']()}</option>
              <option value="general">{t['com.affine.caseAssistant.workflow.vollmachten.type.general']()}</option>
              <option value="special">{t['com.affine.caseAssistant.workflow.vollmachten.type.special']()}</option>
              <option value="procuration">{t['com.affine.caseAssistant.workflow.vollmachten.type.procuration']()}</option>
            </select>
            <input aria-label={t['com.affine.caseAssistant.workflow.vollmachten.aria.validFrom']()} type="date" value={vFrom} onChange={e => setVFrom(e.target.value)} />
            <input aria-label={t['com.affine.caseAssistant.workflow.vollmachten.aria.validUntil']()} type="date" value={vUntil} onChange={e => setVUntil(e.target.value)} />
          </div>
          {vollmachten.length === 0 ? (
            <div className={styles.emptyText}>{t['com.affine.caseAssistant.workflow.vollmachten.empty']()}</div>
          ) : null}
          {vollmachten.map(v => (
            <div key={v.id} className={styles.listItemRow}>
              <span>{v.title} · {v.grantedToName} · {v.status}</span>
              <button type="button" disabled={v.status !== 'active'} onClick={() => void vollmachtService.revokeVollmacht(v.id)}>{t['com.affine.caseAssistant.workflow.action.revoke']()}</button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'zeiten' ? (
        <div
          id="anwalts-workflow-panel-zeiten"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-zeiten"
          className={styles.tabPanel}
        >
          <div className={styles.row}>
            <button
              type="button"
              disabled={disabled || Boolean(activeTimer) || !tDescription.trim()}
              onClick={() => {
                if (!matterId || !clientId) {
                  return;
                }
                void liveTimerService
                  .startTimer({
                    workspaceId,
                    caseId,
                    matterId,
                    clientId,
                    anwaltId: effectiveAnwaltId,
                    description: tDescription.trim(),
                    activityType: tType,
                    hourlyRate: Number(tRate),
                  })
                  .then(() => {
                    setFeedback('Live-Timer gestartet.');
                  })
                  .catch((error: unknown) => {
                    setFeedback(error instanceof Error ? error.message : 'Timer konnte nicht gestartet werden.');
                  });
              }}
            >
              Timer starten
            </button>
            <button
              type="button"
              disabled={!activeTimer || activeTimer.status !== 'running'}
              onClick={() => {
                if (!activeTimer) return;
                void liveTimerService.pauseTimer(activeTimer.id).then(() => {
                  setFeedback('Timer pausiert.');
                });
              }}
            >
              Pause
            </button>
            <button
              type="button"
              disabled={!activeTimer || activeTimer.status !== 'paused'}
              onClick={() => {
                if (!activeTimer) return;
                void liveTimerService.resumeTimer(activeTimer.id).then(() => {
                  setFeedback('Timer fortgesetzt.');
                });
              }}
            >
              Fortsetzen
            </button>
            <button
              type="button"
              disabled={!activeTimer}
              onClick={() => {
                if (!activeTimer) return;
                void liveTimerService.stopTimer(activeTimer.id).then(result => {
                  if (!result) {
                    setFeedback('Timer konnte nicht gestoppt werden.');
                    return;
                  }
                  setFeedback(
                    `Timer gestoppt: ${result.timeEntry.durationMinutes} Min · €${result.timeEntry.amount.toFixed(2)}`
                  );
                  setTDescription('');
                });
              }}
            >
              Stoppen & buchen
            </button>
            {activeTimerSnapshot ? (
              <span>
                Aktiv: {activeTimerSnapshot.formattedTime} · €
                {activeTimerSnapshot.currentAmount.toFixed(2)}
              </span>
            ) : null}
          </div>

          <div className={styles.row}>
            <input
              aria-label={t['com.affine.caseAssistant.workflow.zeiten.aria.description']()}
              value={tDescription}
              onChange={e => setTDescription(e.target.value)}
              placeholder={t['com.affine.caseAssistant.workflow.zeiten.placeholder.description']()}
              className={styles.flex1}
            />
            <select aria-label={t['com.affine.caseAssistant.workflow.zeiten.aria.activityType']()} value={tType} onChange={e => setTType(e.target.value as TimeEntry['activityType'])}>
              <option value="beratung">{t['com.affine.caseAssistant.workflow.activity.beratung']()}</option>
              <option value="schriftsatz">{t['com.affine.caseAssistant.workflow.activity.schriftsatz']()}</option>
              <option value="telefonat">{t['com.affine.caseAssistant.workflow.activity.telefonat']()}</option>
              <option value="termin">{t['com.affine.caseAssistant.workflow.activity.termin']()}</option>
              <option value="recherche">{t['com.affine.caseAssistant.workflow.activity.recherche']()}</option>
              <option value="akteneinsicht">{t['com.affine.caseAssistant.workflow.activity.akteneinsicht']()}</option>
              <option value="korrespondenz">{t['com.affine.caseAssistant.workflow.activity.korrespondenz']()}</option>
              <option value="sonstiges">{t['com.affine.caseAssistant.workflow.activity.sonstiges']()}</option>
            </select>
            <input aria-label={t['com.affine.caseAssistant.workflow.zeiten.aria.durationMinutes']()} type="number" min={1} value={tMinutes} onChange={e => setTMinutes(e.target.value)} className={styles.narrowInput} />
            <input aria-label={t['com.affine.caseAssistant.workflow.zeiten.aria.hourlyRate']()} type="number" min={1} value={tRate} onChange={e => setTRate(e.target.value)} className={styles.narrowInput} />
            <button
              type="button"
              disabled={disabled || !tDescription.trim()}
              onClick={() => {
                void timeTrackingService.createTimeEntry({
                  workspaceId,
                  caseId,
                  matterId: matterId!,
                  clientId: clientId!,
                  anwaltId: anwaltId ?? 'system',
                  description: tDescription.trim(),
                  activityType: tType,
                  durationMinutes: Number(tMinutes),
                  hourlyRate: Number(tRate),
                  date: tDate,
                })
                  .then(() => {
                    setTDescription('');
                    setFeedback(t['com.affine.caseAssistant.workflow.zeiten.feedback.created']());
                  })
                  .catch((error: unknown) => {
                    setFeedback(
                      error instanceof Error
                        ? error.message
                        : t['com.affine.caseAssistant.workflow.zeiten.feedback.createFailed']()
                    );
                  });
              }}
            >
              +
            </button>
          </div>
          <input aria-label={t['com.affine.caseAssistant.workflow.zeiten.aria.date']()} type="date" value={tDate} onChange={e => setTDate(e.target.value)} />
          {zeiten.length === 0 ? (
            <div className={styles.emptyText}>{t['com.affine.caseAssistant.workflow.zeiten.empty']()}</div>
          ) : null}
          {zeiten.map(timeEntry => (
            <div key={timeEntry.id} className={styles.listItemRow}>
              <span>
                {timeEntry.description} · {timeEntry.durationMinutes} min ·
                €{timeEntry.amount.toFixed(2)} · {timeEntry.status}
              </span>
              <button
                type="button"
                disabled={timeEntry.status !== 'draft'}
                onClick={() => void timeTrackingService.submitTimeEntry(timeEntry.id)}
              >
                {t['com.affine.caseAssistant.workflow.action.submit']()}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'termine' ? (
        <div
          id="anwalts-workflow-panel-termine"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-termine"
          className={styles.tabPanel}
        >
          <GerichtsterminSection
            workspaceId={workspaceId}
            caseId={caseId}
            matterId={matterId}
            teilnehmerDefault={terminTeilnehmerDefault}
          />
        </div>
      ) : null}

      {tab === 'kalender' ? (
        <div
          id="anwalts-workflow-panel-kalender"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-kalender"
          className={styles.tabPanel}
        >
          <KalenderSection
            workspaceId={workspaceId}
            matterId={matterId}
            highlightedDeadlineId={highlightedDeadlineId}
          />
        </div>
      ) : null}

      {tab === 'finanzen' ? (
        <div
          id="anwalts-workflow-panel-finanzen"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-finanzen"
          className={styles.tabPanel}
        >
          {matterId && clientId ? (
            <RechnungSection
              workspaceId={workspaceId}
              matterId={matterId}
              caseId={caseId}
              clientId={clientId}
            />
          ) : (
            <div className={styles.emptyText}>
              {t['com.affine.caseAssistant.workflow.warning.selectClientAndMatter']()}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'konflikte' ? (
        <div
          id="anwalts-workflow-panel-konflikte"
          role="tabpanel"
          aria-labelledby="anwalts-workflow-tab-konflikte"
          className={styles.tabPanel}
        >
          <ConflictCenterSection matterId={matterId} />
        </div>
      ) : null}
    </section>
  );
}
