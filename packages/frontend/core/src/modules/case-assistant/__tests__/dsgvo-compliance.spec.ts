import { Framework } from '@toeverything/infra';
import { expect, test } from 'vitest';

import { DSGVOComplianceService } from '../services/dsgvo-compliance';
import { CasePlatformOrchestrationService } from '../services/platform-orchestration';

function createService() {
  const framework = new Framework();
  framework.service(CasePlatformOrchestrationService, { appendAuditEntry: async () => {} } as any);
  framework.service(DSGVOComplianceService, [CasePlatformOrchestrationService]);
  return framework.provider().get(DSGVOComplianceService);
}

test('createRequest validates email and trims requestor fields', async () => {
  const service = createService();

  await expect(
    service.createRequest({
      workspaceId: 'ws-1',
      requestorName: 'Max',
      requestorEmail: 'invalid-email',
      type: 'auskunft',
      description: 'Anfrage',
    })
  ).rejects.toThrow('Anfragesteller E-Mail muss eine gültige E-Mail-Adresse sein.');

  const request = await service.createRequest({
    workspaceId: 'ws-1',
    requestorName: '  Max Mustermann  ',
    requestorEmail: '  max@example.com  ',
    type: 'auskunft',
    description: '  Bitte Datenauskunft  ',
    affectedMatterIds: [' matter-1 ', 'matter-1', ''],
  });

  expect(request.requestorName).toBe('Max Mustermann');
  expect(request.requestorEmail).toBe('max@example.com');
  expect(request.description).toBe('Bitte Datenauskunft');
  expect(request.affectedMatterIds).toEqual(['matter-1']);
});

test('addAction blocks rejected/completed requests', async () => {
  const service = createService();

  const request = await service.createRequest({
    workspaceId: 'ws-1',
    requestorName: 'Max Mustermann',
    requestorEmail: 'max@example.com',
    type: 'berichtigung',
    description: 'Korrektur',
  });

  await service.rejectRequest(request.id, 'nicht legitimiert', 'admin');

  await expect(service.addAction(request.id, 'nachfassen', 'admin')).rejects.toThrow(
    'Für abgeschlossene oder abgelehnte Anfragen können keine Aktionen mehr ergänzt werden.'
  );
});

test('completeRequest blocks rejected request and is idempotent on completed', async () => {
  const service = createService();

  const request = await service.createRequest({
    workspaceId: 'ws-1',
    requestorName: 'Anna Beispiel',
    requestorEmail: 'anna@example.com',
    type: 'widerspruch',
    description: 'Widerspruch',
  });

  const completed = await service.completeRequest(request.id, 'dpo-1');
  const completedAgain = await service.completeRequest(request.id, 'dpo-2');
  expect(completed?.status).toBe('completed');
  expect(completedAgain?.id).toBe(request.id);

  const rejected = await service.createRequest({
    workspaceId: 'ws-1',
    requestorName: 'John Doe',
    requestorEmail: 'john@example.com',
    type: 'loeschung',
    description: 'Löschung',
  });
  await service.rejectRequest(rejected.id, 'gesetzliche Aufbewahrungspflicht', 'dpo-1');

  await expect(service.completeRequest(rejected.id, 'dpo-1')).rejects.toThrow(
    'Abgelehnte Anfragen können nicht abgeschlossen werden.'
  );
});

test('retention deletion requires review + approval and keep reason when denied', async () => {
  const service = createService();
  await service.initializeDefaultPolicies('ws-1');

  const retention = await service.trackRetention({
    workspaceId: 'ws-1',
    entityType: 'document',
    entityId: 'doc-1',
    entityName: 'Klagebeilage A',
    category: 'mandatsakten',
    retentionStartDate: new Date().toISOString(),
  });

  await expect(service.markAsDeleted(retention.id)).rejects.toThrow(
    'Löschung muss erst geprüft werden.'
  );

  await expect(
    service.reviewForDeletion(retention.id, 'dpo-1', false)
  ).rejects.toThrow('Begründung zur Aufbewahrung darf nicht leer sein.');

  await service.reviewForDeletion(retention.id, 'dpo-1', true);
  const deleted = await service.markAsDeleted(retention.id);
  expect(deleted?.deleted).toBe(true);
});

test('getRetentionsExpiringSoon validates positive integer days', () => {
  const service = createService();
  expect(() => service.getRetentionsExpiringSoon(0)).toThrow('Tage muss eine positive ganze Zahl sein.');
});
