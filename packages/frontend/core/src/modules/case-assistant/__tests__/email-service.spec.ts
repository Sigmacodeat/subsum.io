import { Framework } from '@toeverything/infra';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ConnectorConfig, EmailRecord } from '../types';
import { CaseAccessControlService } from '../services/case-access-control';
import { EmailService } from '../services/email';
import { CasePlatformOrchestrationService } from '../services/platform-orchestration';

type FetchMock = ReturnType<typeof vi.fn>;

function createResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createConnectedMailConnector(overrides?: Partial<ConnectorConfig>): ConnectorConfig {
  const now = new Date().toISOString();
  return {
    id: 'conn-mail-1',
    workspaceId: 'ws-1',
    kind: 'mail',
    name: 'Mail Gateway',
    endpoint: 'https://mail.example.com',
    authType: 'none',
    enabled: true,
    status: 'connected',
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createServiceHarness(options?: {
  connectors?: ConnectorConfig[];
  graphClients?: Record<string, { id: string; displayName: string; primaryEmail?: string }>;
  existingEmails?: EmailRecord[];
  permissionResult?: { ok: boolean; role: string; requiredRole: string; message: string };
}) {
  const connectors = options?.connectors ?? [createConnectedMailConnector()];
  const graphClients = options?.graphClients ?? {
    'client-1': { id: 'client-1', displayName: 'Client One', primaryEmail: 'client.one@example.com' },
  };

  const emailStore: EmailRecord[] = [...(options?.existingEmails ?? [])];
  const upsertedEmails: EmailRecord[] = [];
  const upsertedConnectors: ConnectorConfig[] = [];
  const auditEntries: any[] = [];

  const orchestration = {
    connectors$: { value: connectors },
    emails$: { value: emailStore },
    async getEmails() {
      return [...emailStore];
    },
    async upsertEmail(record: EmailRecord) {
      upsertedEmails.push({
        ...record,
        metadata: record.metadata ? { ...record.metadata } : undefined,
      });
      const idx = emailStore.findIndex(e => e.id === record.id);
      if (idx >= 0) {
        emailStore[idx] = {
          ...record,
          metadata: record.metadata ? { ...record.metadata } : undefined,
        };
      } else {
        emailStore.unshift({
          ...record,
          metadata: record.metadata ? { ...record.metadata } : undefined,
        });
      }
      this.emails$.value = [...emailStore];
      return record;
    },
    async upsertConnector(connector: ConnectorConfig) {
      upsertedConnectors.push(connector);
      return connector;
    },
    async appendAuditEntry(entry: any) {
      auditEntries.push(entry);
      return;
    },
    async getGraph() {
      return { clients: graphClients };
    },
  };

  const accessControl = {
    async evaluate() {
      return (
        options?.permissionResult ??
        { ok: true, role: 'owner', requiredRole: 'operator', message: '' }
      );
    },
  };

  const framework = new Framework();
  framework.service(CasePlatformOrchestrationService, orchestration as any);
  framework.service(CaseAccessControlService, accessControl as any);
  framework.service(EmailService, [CasePlatformOrchestrationService, CaseAccessControlService]);

  const service = framework.provider().get(EmailService);

  return {
    service,
    orchestration,
    upsertedEmails,
    upsertedConnectors,
    auditEntries,
    emailStore,
  };
}

describe('EmailService reliability', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (globalThis as any).BUILD_CONFIG = {
      isElectron: false,
      appVersion: 'test',
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-20T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('syncInbox resumes with cursor and persists next cursor metadata', async () => {
    const connector = createConnectedMailConnector({
      metadata: { emailInboxCursor: 'cursor-1' },
    });

    const { service, upsertedConnectors, upsertedEmails } = createServiceHarness({
      connectors: [connector],
    });

    const fetchMock: FetchMock = vi.fn()
      .mockResolvedValueOnce(
        createResponse(200, {
          messages: [
            {
              id: 'msg-1',
              messageId: 'm-1',
              subject: 'A',
              senderEmail: 'court@example.com',
              recipientEmail: 'lawyer@example.com',
              status: 'sent',
              createdAt: '2026-02-20T06:00:00.000Z',
              updatedAt: '2026-02-20T06:00:00.000Z',
            },
          ],
          nextCursor: 'cursor-2',
          hasMore: true,
        })
      )
      .mockResolvedValueOnce(
        createResponse(200, {
          messages: [
            {
              id: 'msg-2',
              messageId: 'm-2',
              subject: 'B',
              senderEmail: 'opponent@example.com',
              recipientEmail: 'lawyer@example.com',
              status: 'sent',
              createdAt: '2026-02-20T06:30:00.000Z',
              updatedAt: '2026-02-20T06:30:00.000Z',
            },
          ],
          nextCursor: 'cursor-3',
          hasMore: false,
        })
      );

    globalThis.fetch = fetchMock as any;

    const result = await service.syncInbox({ workspaceId: 'ws-1', limit: 50 });

    expect(result.imported).toBe(2);
    expect(upsertedEmails).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const body1 = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const body2 = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body1.cursor).toBe('cursor-1');
    expect(body2.cursor).toBe('cursor-2');

    expect(upsertedConnectors).toHaveLength(1);
    const connectorUpdate = upsertedConnectors[0];
    expect(connectorUpdate.lastSyncedAt).toBeTruthy();
    expect(connectorUpdate.metadata?.emailInboxCursor).toBe('cursor-3');
    expect(connectorUpdate.metadata?.emailInboxCursorUpdatedAt).toBeTruthy();
  });

  test('syncInbox returns early when no connected mail connector exists', async () => {
    const { service } = createServiceHarness({
      connectors: [
        createConnectedMailConnector({ enabled: false, status: 'disconnected' }),
      ],
    });

    const fetchMock: FetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;

    const result = await service.syncInbox({ workspaceId: 'ws-1', limit: 20 });

    expect(result.imported).toBe(0);
    expect(result.message).toContain('Kein aktiver Mail-Connector');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('syncInbox writes warning audit when no new emails are found', async () => {
    const { service, auditEntries, upsertedConnectors } = createServiceHarness();

    const fetchMock: FetchMock = vi.fn().mockResolvedValue(
      createResponse(200, { messages: [], nextCursor: '', hasMore: false })
    );
    globalThis.fetch = fetchMock as any;

    const result = await service.syncInbox({ workspaceId: 'ws-1', limit: 20 });

    expect(result.imported).toBe(0);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].action).toBe('email.inbox.sync.empty');
    expect(auditEntries[0].severity).toBe('warning');
    expect(upsertedConnectors).toHaveLength(1);
  });

  test('syncInbox uses status rank tie-breaker when timestamps are equal', async () => {
    const existingEmail: EmailRecord = {
      id: 'email-existing',
      workspaceId: 'ws-1',
      templateType: 'custom',
      subject: 'Status update',
      bodyHtml: '<p>old</p>',
      bodyPlainText: 'old',
      recipientEmail: 'lawyer@example.com',
      recipientName: 'Lawyer',
      senderName: 'Court',
      senderEmail: 'court@example.com',
      status: 'failed',
      metadata: { externalMessageId: 'ext-1' },
      createdAt: '2026-02-20T06:00:00.000Z',
      updatedAt: '2026-02-20T06:30:00.000Z',
    };

    const { service, emailStore } = createServiceHarness({
      existingEmails: [existingEmail],
    });

    const fetchMock: FetchMock = vi.fn().mockResolvedValue(
      createResponse(200, {
        messages: [
          {
            messageId: 'ext-1',
            subject: 'Status update',
            bodyPlainText: 'new',
            senderEmail: 'court@example.com',
            recipientEmail: 'lawyer@example.com',
            status: 'sent',
            createdAt: '2026-02-20T06:00:00.000Z',
            updatedAt: '2026-02-20T06:30:00.000Z',
          },
        ],
      })
    );

    globalThis.fetch = fetchMock as any;

    await service.syncInbox({ workspaceId: 'ws-1', limit: 20 });

    const merged = emailStore.find(e => e.id === 'email-existing');
    expect(merged?.status).toBe('sent');
    expect(merged?.bodyPlainText).toBe('new');
  });

  test('sendEmail uses idempotencyKey and retries transient failures', async () => {
    const { service, upsertedEmails } = createServiceHarness();

    const fetchMock: FetchMock = vi.fn()
      .mockResolvedValueOnce(createResponse(500, { message: 'temporary error' }))
      .mockResolvedValueOnce(createResponse(200, { ok: true }));

    globalThis.fetch = fetchMock as any;

    const promise = service.sendEmail({
      workspaceId: 'ws-1',
      clientId: 'client-1',
      recipientEmail: 'client.one@example.com',
      recipientName: 'Client One',
      templateType: 'custom',
      subject: 'Test',
      bodyTemplate: 'Hello',
      senderName: 'Kanzlei',
      senderEmail: 'kanzlei@example.com',
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(firstBody.idempotencyKey).toBe(result.emailId);
    expect(secondBody.idempotencyKey).toBe(result.emailId);

    // queued + sending + sent
    expect(upsertedEmails.length).toBeGreaterThanOrEqual(1);
    expect(upsertedEmails[upsertedEmails.length - 1].status).toBe('sent');
  });

  test('sendEmail rejects missing recipient email and does not persist queue entry', async () => {
    const { service, upsertedEmails } = createServiceHarness({
      graphClients: {
        'client-1': { id: 'client-1', displayName: 'Client One' },
      },
    });

    const result = await service.sendEmail({
      workspaceId: 'ws-1',
      clientId: 'client-1',
      templateType: 'custom',
      subject: 'Test',
      bodyTemplate: 'Hello',
      senderName: 'Kanzlei',
      senderEmail: 'kanzlei@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Kein Empfänger-E-Mail-Adresse');
    expect(upsertedEmails).toHaveLength(0);
  });

  test('sendEmail returns permission denied without side effects', async () => {
    const { service, upsertedEmails, auditEntries } = createServiceHarness({
      permissionResult: {
        ok: false,
        role: 'viewer',
        requiredRole: 'operator',
        message: 'Berechtigung fehlt',
      },
    });

    const fetchMock: FetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;

    const result = await service.sendEmail({
      workspaceId: 'ws-1',
      clientId: 'client-1',
      recipientEmail: 'client.one@example.com',
      templateType: 'custom',
      subject: 'Test',
      bodyTemplate: 'Hello',
      senderName: 'Kanzlei',
      senderEmail: 'kanzlei@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Berechtigung verweigert');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsertedEmails).toHaveLength(0);
    expect(auditEntries).toHaveLength(0);
  });

  test('sendEmail without connected connector persists failed state and writes warning audit', async () => {
    const { service, upsertedEmails, auditEntries } = createServiceHarness({
      connectors: [
        createConnectedMailConnector({ enabled: false, status: 'disconnected' }),
      ],
    });

    const result = await service.sendEmail({
      workspaceId: 'ws-1',
      clientId: 'client-1',
      recipientEmail: 'client.one@example.com',
      recipientName: 'Client One',
      templateType: 'custom',
      subject: 'Test',
      bodyTemplate: 'Hello',
      senderName: 'Kanzlei',
      senderEmail: 'kanzlei@example.com',
    });

    expect(result.success).toBe(false);
    expect(upsertedEmails.length).toBeGreaterThanOrEqual(2);
    expect(upsertedEmails[0].status).toBe('queued');
    expect(upsertedEmails[upsertedEmails.length - 1].status).toBe('failed');
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].action).toBe('email.send.failed');
    expect(auditEntries[0].severity).toBe('warning');
  });
});
