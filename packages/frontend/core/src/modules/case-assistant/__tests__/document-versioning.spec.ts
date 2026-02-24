import { Framework } from '@toeverything/infra';
import { expect, test } from 'vitest';

import {
  DocumentVersioningService,
} from '../services/document-versioning';
import { CasePlatformOrchestrationService } from '../services/platform-orchestration';

function createOrchestrationMock() {
  return {
    async appendAuditEntry() {
      return;
    },
  };
}

function createService() {
  const framework = new Framework();
  framework.service(CasePlatformOrchestrationService, createOrchestrationMock() as any);
  framework.service(DocumentVersioningService, [CasePlatformOrchestrationService]);
  return framework.provider().get(DocumentVersioningService);
}

test('createDocumentGroup trims values and normalizes tags', async () => {
  const service = createService();

  const group = await service.createDocumentGroup({
    workspaceId: 'ws-1',
    matterId: 'matter-1',
    caseId: 'case-1',
    title: '  Klageschrift  ',
    documentType: '  schriftsatz  ',
    tags: ['entwurf', ' entwurf ', ' ', 'fristsache'],
    folderPath: '  /Akte/Schriftsaetze  ',
  });

  expect(group.title).toBe('Klageschrift');
  expect(group.documentType).toBe('schriftsatz');
  expect(group.tags).toEqual(['entwurf', 'fristsache']);
  expect(group.folderPath).toBe('/Akte/Schriftsaetze');
});

test('createVersion rejects mismatched workspace/group relation', async () => {
  const service = createService();

  const group = await service.createDocumentGroup({
    workspaceId: 'ws-1',
    matterId: 'matter-1',
    caseId: 'case-1',
    title: 'Vertrag',
    documentType: 'vertrag',
  });

  await expect(
    service.createVersion({
      workspaceId: 'ws-2',
      documentGroupId: group.id,
      matterId: 'matter-1',
      caseId: 'case-1',
      authorId: 'anwalt-1',
      authorName: 'Max Mustermann',
    })
  ).rejects.toThrow('Workspace-ID passt nicht zur Dokumentgruppe.');
});

test('markAsFinal supersedes other non-archived versions in group', async () => {
  const service = createService();

  const group = await service.createDocumentGroup({
    workspaceId: 'ws-1',
    matterId: 'matter-1',
    caseId: 'case-1',
    title: 'Berufung',
    documentType: 'schriftsatz',
  });

  const v1 = await service.createVersion({
    workspaceId: 'ws-1',
    documentGroupId: group.id,
    matterId: 'matter-1',
    caseId: 'case-1',
    authorId: 'anwalt-1',
    authorName: 'A1',
  });
  await service.submitForReview(v1.id);
  await service.reviewVersion(v1.id, true, 'anwalt-2', 'A2');

  const v2 = await service.createVersion({
    workspaceId: 'ws-1',
    documentGroupId: group.id,
    matterId: 'matter-1',
    caseId: 'case-1',
    authorId: 'anwalt-1',
    authorName: 'A1',
  });

  const finalized = await service.markAsFinal(v1.id);
  const versions = service.getVersionsForGroup(group.id);
  const superseded = versions.find(v => v.id === v2.id);

  expect(finalized?.status).toBe('final');
  expect(superseded?.status).toBe('superseded');
});

test('archiveVersion blocks in_review status', async () => {
  const service = createService();

  const group = await service.createDocumentGroup({
    workspaceId: 'ws-1',
    matterId: 'matter-1',
    caseId: 'case-1',
    title: 'Gutachten',
    documentType: 'gutachten',
  });

  const version = await service.createVersion({
    workspaceId: 'ws-1',
    documentGroupId: group.id,
    matterId: 'matter-1',
    caseId: 'case-1',
    authorId: 'anwalt-1',
    authorName: 'A1',
  });

  await service.submitForReview(version.id);

  await expect(service.archiveVersion(version.id)).rejects.toThrow(
    'Versionen in Prüfung können nicht archiviert werden.'
  );
});
