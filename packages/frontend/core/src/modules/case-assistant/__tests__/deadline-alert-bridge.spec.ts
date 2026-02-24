import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DeadlineAlertService } from '../services/deadline-alert';

function createGraph(nowIso: string) {
  const dueAt = new Date(new Date(nowIso).getTime() + 30 * 60 * 1000).toISOString();
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
        dueAt,
        status: 'open',
        priority: 'high',
        reminderOffsetsInMinutes: [60],
      },
    },
    matters: {
      'matter-1': {
        id: 'matter-1',
        workspaceId: 'ws-1',
        clientId: 'client-1',
        title: 'Akte 1',
        externalRef: 'AZ-1',
      },
    },
  } as any;
}

describe('DeadlineAlertService bridge dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T00:00:00+01:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('syncNow dispatches both client notification and lawyer reminder', async () => {
    const nowIso = new Date().toISOString();
    const graph = createGraph(nowIso);

    const setAlerts = vi.fn(async () => undefined);

    const store = {
      async getGraph() {
        return graph;
      },
      async setAlerts() {
        await setAlerts();
      },
    } as any;

    const kalender = {
      getEventBySource() {
        return null;
      },
      getAllEvents() {
        return [];
      },
      async markReminderSent() {
        return;
      },
    } as any;

    const fireEvent = vi.fn(async () => []);
    const dispatchFromDeadlineAlert = vi.fn(async () => undefined);

    const notificationService = {
      fireEvent,
    } as any;

    const anwaltsReminderService = {
      dispatchFromDeadlineAlert,
    } as any;

    const service = Object.create(DeadlineAlertService.prototype) as any;
    service.store = store;
    service.kalenderService = kalender;
    service._notificationService = null;
    service._anwaltsReminderService = null;
    service._dispatchedAlertIds = new Set<string>();
    service._dispatchFailedAt = new Map<string, number>();
    service.wireNotificationServices(notificationService, anwaltsReminderService);

    await service.syncNow();

    expect(setAlerts).toHaveBeenCalledTimes(1);
    expect(fireEvent).toHaveBeenCalledTimes(1);
    expect(dispatchFromDeadlineAlert).toHaveBeenCalledTimes(1);
  });
});
