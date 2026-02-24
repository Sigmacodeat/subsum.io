import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { AnwaltsReminderService } from '../services/anwalts-reminder';

const DEFAULT_PREFS = {
  criticalChannels: ['email', 'push', 'whatsapp'],
  highChannels: ['email', 'push'],
  normalChannels: ['email'],
  lowChannels: ['in_app'],
  morningBriefingTime: '07:30',
  morningBriefingEnabled: true,
  weeklySummaryDay: 'monday',
  weeklySummaryEnabled: true,
  deadlineReminderThresholds: [20160, 10080, 1440, 180, 60],
  courtDateReminderThresholds: [1440, 180, 60],
  disabledCategories: [],
} as const;

function createGraph(nowIso: string) {
  return {
    cases: {
      'case-1': {
        id: 'case-1',
        workspaceId: 'ws-1',
        matterId: 'matter-1',
        deadlineIds: ['deadline-1'],
      },
    },
    deadlines: {
      'deadline-1': {
        id: 'deadline-1',
        title: 'Frist A',
        dueAt: '2026-03-02T00:10:00+01:00',
        status: 'open',
        priority: 'high',
        sourceDocIds: [],
        reminderOffsetsInMinutes: [60],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    },
    termine: {},
    matters: {
      'matter-1': {
        id: 'matter-1',
        workspaceId: 'ws-1',
        title: 'Akte 1',
        externalRef: 'AZ-1',
      },
    },
    clients: {},
  } as any;
}

function createServiceHarness() {
  const runtimeStore: Record<string, unknown> = {};
  const nowIso = new Date().toISOString();
  const graph = createGraph(nowIso);

  const store = {
    async getGraph() {
      return graph;
    },
    async getAnwaltsReminderPreferences<T>() {
      return (runtimeStore.prefs as T) ?? null;
    },
    async setAnwaltsReminderPreferences(value: unknown) {
      runtimeStore.prefs = value;
    },
    async getAnwaltsReminderRuntime<T>() {
      return (runtimeStore.runtime as T) ?? null;
    },
    async setAnwaltsReminderRuntime(value: unknown) {
      runtimeStore.runtime = value;
    },
  } as any;

  const orchestration = {
    async appendAuditEntry() {
      return;
    },
  } as any;

  const kalender = {
    getAllEvents() {
      return [];
    },
    getUpcomingEvents() {
      return [];
    },
  } as any;

  const kanzleiProfile = {
    async getActiveAnwaelte() {
      return [];
    },
    async getKanzleiProfile() {
      return { email: 'kanzlei@example.com', phone: '+431111' };
    },
  } as any;

  const email = {
    async sendEmail() {
      return { success: true, message: 'ok' };
    },
  } as any;

  const adapter = {
    async dispatchN8nWorkflow() {
      return { ok: true, message: 'ok' };
    },
  } as any;

  const service = Object.create(AnwaltsReminderService.prototype) as any;
  service.store = store;
  service.orchestration = orchestration;
  service.kalenderService = kalender;
  service.kanzleiProfileService = kanzleiProfile;
  service.emailService = email;
  service.adapterService = adapter;

  service.remindersMap$ = new BehaviorSubject<Record<string, any>>({});
  service.preferences$ = new BehaviorSubject({ ...DEFAULT_PREFS });
  service.sentDedupKeys = new Map<string, number>();
  service.deferredDedupKeys = new Map<string, number>();
  service.poller = null;
  service.morningBriefingTimer = null;
  service.weeklySummaryTimer = null;
  service.lastBriefingDateKey = '';
  service.lastWeeklySummaryDateKey = '';
  service.resolvedAnwaltId = 'default-anwalt';
  service.resolvedAnwaltEmail = '';
  service.resolvedAnwaltPhone = '';

  return { service, runtimeStore };
}

describe('AnwaltsReminderService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('deferred reminders in quiet hours are flushed after quiet hours end', async () => {
    vi.setSystemTime(new Date('2026-03-01T23:30:00.000Z'));
    const { service } = createServiceHarness();

    // Keep deadline in quiet-hours window but outside critical threshold,
    // so reminder gets deferred (suppressed) and can be flushed afterwards.
    service.store.getGraph = async () => {
      const base = createGraph(new Date().toISOString());
      base.deadlines['deadline-1'].dueAt = '2026-03-02T09:10:00+01:00';
      return base;
    };

    service.updatePreferences({
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      criticalChannels: ['in_app'],
      highChannels: ['in_app'],
      normalChannels: ['in_app'],
      lowChannels: ['in_app'],
    });

    await service.start(120_000);
    const firstRun = service
      .getRecentReminders(20)
      .find((r: { dedupKey: string }) => r.dedupKey.startsWith('deadline_approaching:deadline-1'));
    expect(firstRun).toBeTruthy();
    expect(firstRun?.status).toBe('suppressed');

    vi.setSystemTime(new Date('2026-03-02T07:15:00.000Z'));
    await service.checkAndFireReminders();

    const afterFlush = service
      .getRecentReminders(20)
      .find((r: { id: string }) => r.id === firstRun?.id);
    expect(afterFlush).toBeTruthy();
    expect(afterFlush?.status).toBe('sent');

    service.stop();
  });

  test('weekly summary is deduped per day', async () => {
    vi.setSystemTime(new Date('2026-03-02T09:00:00+01:00'));
    const { service } = createServiceHarness();

    service.updatePreferences({
      weeklySummaryEnabled: true,
      criticalChannels: ['in_app'],
      highChannels: ['in_app'],
      normalChannels: ['in_app'],
      lowChannels: ['in_app'],
    });

    const first = await service.generateWeeklySummary();
    const second = await service.generateWeeklySummary();

    expect(first).toBeTruthy();
    expect(second).toBeNull();
  });
});
