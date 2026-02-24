import { expect, test } from 'vitest';

import type { CaseDeadline, CaseFile, LegalDocumentRecord } from '../types';
import { DeadlineAutomationService } from '../services/deadline-automation';

type DeadlineAutomationServiceLike = {
  deriveDeadlinesFromDocuments: (input: {
    caseId: string;
    workspaceId: string;
    docs: LegalDocumentRecord[];
  }) => CaseDeadline[];
  upsertAutoDeadlines: (input: {
    caseId: string;
    workspaceId: string;
    deadlines: CaseDeadline[];
  }) => Promise<number>;
  caseAssistantService: any;
};

function createDeadlineAutomationService(caseAssistantService: any = {}) {
  const service = Object.create(DeadlineAutomationService.prototype) as unknown as DeadlineAutomationServiceLike;
  service.caseAssistantService = caseAssistantService;
  return service;
}

function makeDoc(input: {
  id: string;
  title: string;
  text: string;
  jurisdiction?: LegalDocumentRecord['detectedJurisdiction'];
}): LegalDocumentRecord {
  const now = new Date().toISOString();
  return {
    id: input.id,
    workspaceId: 'ws-1',
    caseId: 'case-1',
    title: input.title,
    kind: 'pdf',
    status: 'indexed',
    processingStatus: 'ready',
    sourceMimeType: 'application/pdf',
    sourceSizeBytes: 1024,
    pageCount: 1,
    language: 'de',
    qualityScore: 0.9,
    extractionEngine: 'test',
    normalizedText: input.text,
    rawText: input.text,
    tags: [],
    createdAt: now,
    updatedAt: now,
    contentFingerprint: `fp:${input.id}`,
    detectedJurisdiction: input.jurisdiction,
  };
}

test('derives Fortfuehrungsantrag deadline from event date', () => {
  const service = createDeadlineAutomationService({});
  const docs = [
    makeDoc({
      id: 'doc-1',
      title: 'Einstellungsbescheid',
      jurisdiction: 'DE',
      text: [
        'Die Staatsanwaltschaft hat die Einstellung mit Bescheid mitgeteilt.',
        'Der Einstellungsbescheid wurde am 10.02.2026 zugestellt.',
        'Fortfuehrungsantrag wird geprueft.',
      ].join(' '),
    }),
  ];

  const deadlines = service.deriveDeadlinesFromDocuments({
    caseId: 'case-1',
    workspaceId: 'ws-1',
    docs,
  });

  const fortfuehrung = deadlines.find((item: CaseDeadline) =>
    item.title.includes('Fortführungsantrag')
  );
  expect(fortfuehrung).toBeTruthy();
  expect(fortfuehrung?.dueAt.startsWith('2026-02-24')).toBe(true);
  expect(fortfuehrung?.derivedFrom).toBe('auto_template');
  expect(fortfuehrung?.requiresReview).toBe(false);
  expect((fortfuehrung?.detectionConfidence ?? 0) >= 0.85).toBe(true);
  expect((fortfuehrung?.evidenceSnippets?.length ?? 0) > 0).toBe(true);
});

test('anchors Einspruch Strafbefehl on Zustellung date when multiple dates exist', () => {
  const service = createDeadlineAutomationService({});
  const docs = [
    makeDoc({
      id: 'doc-2',
      title: 'Strafbefehl',
      jurisdiction: 'DE',
      text: [
        'Sachverhalt vom 01.01.2024.',
        'Der Strafbefehl wurde am 14.02.2026 zugestellt.',
        'Einspruch ist innerhalb der Frist einzulegen.',
      ].join(' '),
    }),
  ];

  const deadlines = service.deriveDeadlinesFromDocuments({
    caseId: 'case-1',
    workspaceId: 'ws-1',
    docs,
  });

  const einspruch = deadlines.find((item: CaseDeadline) => item.title.includes('Strafbefehl'));
  expect(einspruch).toBeTruthy();
  expect(einspruch?.dueAt.startsWith('2026-03-02')).toBe(true);
  expect(einspruch?.derivedFrom).toBe('auto_template');
  expect(einspruch?.requiresReview).toBe(false);
});

test('upsertAutoDeadlines links persisted auto-deadlines into the case record', async () => {
  const now = new Date().toISOString();
  const baseCase: CaseFile = {
    id: 'case-1',
    workspaceId: 'ws-1',
    matterId: 'matter-1',
    title: 'Case 1',
    actorIds: [],
    issueIds: [],
    deadlineIds: ['deadline:existing'],
    memoryEventIds: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  const upsertedDeadlines: CaseDeadline[] = [];
  const captured: { caseFile?: Omit<CaseFile, 'createdAt' | 'updatedAt'> } = {};

  const service = createDeadlineAutomationService({
    graph$: {
      value: {
        cases: {
          'case-1': baseCase,
        },
      },
    },
    upsertDeadline: async (deadline: CaseDeadline) => {
      upsertedDeadlines.push(deadline);
      return deadline;
    },
    upsertCaseFile: async (caseFile: Omit<CaseFile, 'createdAt' | 'updatedAt'>) => {
      captured.caseFile = caseFile;
      return { ...baseCase, ...caseFile };
    },
  });

  const inputDeadlines: CaseDeadline[] = [
    {
      id: 'deadline:auto:new-1',
      title: 'Auto Frist',
      dueAt: '2026-03-01T09:00:00.000Z',
      sourceDocIds: ['doc-1'],
      status: 'open',
      priority: 'critical',
      reminderOffsetsInMinutes: [1440],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const count = await service.upsertAutoDeadlines({
    caseId: 'case-1',
    workspaceId: 'ws-1',
    deadlines: inputDeadlines,
  });

  expect(count).toBe(1);
  expect(upsertedDeadlines).toHaveLength(1);
  const linkedCase = captured.caseFile;
  expect(linkedCase).toBeTruthy();
  if (!linkedCase) {
    throw new Error('Expected case link update to run');
  }
  expect(linkedCase.deadlineIds).toEqual([
    'deadline:existing',
    'deadline:auto:new-1',
  ]);
});
