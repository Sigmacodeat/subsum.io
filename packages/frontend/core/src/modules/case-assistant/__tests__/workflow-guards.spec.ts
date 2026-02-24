import { expect, test } from 'vitest';
import { Framework } from '@toeverything/infra';

import { AktennotizService } from '../services/aktennotiz';
import { CasePlatformOrchestrationService } from '../services/platform-orchestration';
import { KalenderService } from '../services/kalender';
import { TimeTrackingService } from '../services/time-tracking';
import { VollmachtService } from '../services/vollmacht';
import { WiedervorlageService } from '../services/wiedervorlage';
import type {
  Aktennotiz,
  TimeEntry,
  Vollmacht,
  Wiedervorlage,
} from '../types';

function createOrchestrationMock() {
  const timeEntries: TimeEntry[] = [];
  const wiedervorlagen: Wiedervorlage[] = [];
  const aktennotizen: Aktennotiz[] = [];
  const vollmachten: Vollmacht[] = [];

  return {
    timeEntries$: { value: timeEntries },
    wiedervorlagen$: { value: wiedervorlagen },
    aktennotizen$: { value: aktennotizen },
    vollmachten$: { value: vollmachten },
    async upsertTimeEntry(entry: TimeEntry) {
      const idx = timeEntries.findIndex(e => e.id === entry.id);
      if (idx >= 0) timeEntries[idx] = entry;
      else timeEntries.push(entry);
    },
    async deleteTimeEntry(entryId: string) {
      const idx = timeEntries.findIndex(e => e.id === entryId);
      if (idx >= 0) timeEntries.splice(idx, 1);
    },
    async upsertWiedervorlage(entry: Wiedervorlage) {
      const idx = wiedervorlagen.findIndex(e => e.id === entry.id);
      if (idx >= 0) wiedervorlagen[idx] = entry;
      else wiedervorlagen.push(entry);
    },
    async deleteWiedervorlage(entryId: string) {
      const idx = wiedervorlagen.findIndex(e => e.id === entryId);
      if (idx >= 0) wiedervorlagen.splice(idx, 1);
    },
    async upsertAktennotiz(entry: Aktennotiz) {
      const idx = aktennotizen.findIndex(e => e.id === entry.id);
      if (idx >= 0) aktennotizen[idx] = entry;
      else aktennotizen.push(entry);
    },
    async deleteAktennotiz(entryId: string) {
      const idx = aktennotizen.findIndex(e => e.id === entryId);
      if (idx >= 0) aktennotizen.splice(idx, 1);
    },
    async upsertVollmacht(entry: Vollmacht) {
      const idx = vollmachten.findIndex(e => e.id === entry.id);
      if (idx >= 0) vollmachten[idx] = entry;
      else vollmachten.push(entry);
    },
    async deleteVollmacht(entryId: string) {
      const idx = vollmachten.findIndex(e => e.id === entryId);
      if (idx >= 0) vollmachten.splice(idx, 1);
    },
    async appendAuditEntry() {
      return;
    },
  };
}

function createServiceInFramework<T>(
  token: new (...args: any[]) => T,
  orchestration: ReturnType<typeof createOrchestrationMock>
): T {
  const framework = new Framework();
  framework.service(CasePlatformOrchestrationService, orchestration as any);

  if (token === (WiedervorlageService as unknown as new (...args: any[]) => T)) {
    framework.service(KalenderService, {
      upsertEventForSource: async () => {
        return;
      },
      deleteEventsForSource: async () => {
        return;
      },
    } as any);
    framework.service(token as any, [CasePlatformOrchestrationService, KalenderService]);
  } else {
    framework.service(token as any, [CasePlatformOrchestrationService]);
  }
  return framework.provider().get(token as any) as T;
}

test('WiedervorlageService validiert ungültiges Fälligkeitsdatum', async () => {
  const orchestration = createOrchestrationMock();
  const service = createServiceInFramework(WiedervorlageService, orchestration);

  await expect(
    service.createWiedervorlage({
      workspaceId: 'ws-1',
      caseId: 'case-1',
      matterId: 'matter-1',
      clientId: 'client-1',
      title: 'Nachfassen',
      dueAt: 'invalid-date',
      priority: 'high',
    })
  ).rejects.toThrow('Fälligkeitsdatum muss ein gültiges Datum sein.');
});

test('WiedervorlageService setzt/cleart completedAt konsistent', async () => {
  const orchestration = createOrchestrationMock();
  const service = createServiceInFramework(WiedervorlageService, orchestration);

  const created = await service.createWiedervorlage({
    workspaceId: 'ws-1',
    caseId: 'case-1',
    matterId: 'matter-1',
    clientId: 'client-1',
    title: 'Frist prüfen',
    dueAt: new Date().toISOString(),
    priority: 'medium',
  });

  const completed = await service.updateWiedervorlage(created.id, { status: 'completed' });
  expect(completed?.completedAt).toBeTruthy();

  const reopened = await service.updateWiedervorlage(created.id, { status: 'pending' });
  expect(reopened?.completedAt).toBeUndefined();
});

test('VollmachtService verhindert inkonsistente Gültigkeitsdaten', async () => {
  const orchestration = createOrchestrationMock();
  const service = createServiceInFramework(VollmachtService, orchestration);

  await expect(
    service.createVollmacht({
      workspaceId: 'ws-1',
      clientId: 'client-1',
      type: 'general',
      title: 'Generalvollmacht',
      grantedTo: 'actor-1',
      grantedToName: 'RA Beispiel',
      validFrom: '2026-02-20T00:00:00.000Z',
      validUntil: '2026-02-19T00:00:00.000Z',
    })
  ).rejects.toThrow('Gültig bis darf nicht vor Gültig von liegen.');
});

test('AktennotizService liefert bei leerer Suche keine Treffer', () => {
  const orchestration = createOrchestrationMock();
  const service = createServiceInFramework(AktennotizService, orchestration);

  expect(service.searchAktennotizen('   ')).toEqual([]);
});

test('TimeTrackingService recalculates amount when hourlyRate is set to 0', async () => {
  const orchestration = createOrchestrationMock();
  const service = createServiceInFramework(TimeTrackingService, orchestration);

  const entry = await service.createTimeEntry({
    workspaceId: 'ws-1',
    caseId: 'case-1',
    matterId: 'matter-1',
    clientId: 'client-1',
    anwaltId: 'anwalt-1',
    description: 'Telefonat',
    activityType: 'telefonat',
    durationMinutes: 30,
    hourlyRate: 200,
    date: new Date().toISOString(),
  });

  const updated = await service.updateTimeEntry(entry.id, { hourlyRate: 0 });
  expect(updated?.amount).toBe(0);
});
