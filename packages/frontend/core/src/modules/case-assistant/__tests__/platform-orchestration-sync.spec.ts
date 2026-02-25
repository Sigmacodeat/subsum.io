import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasePlatformOrchestrationService } from '../services/platform-orchestration';

describe('CasePlatformOrchestrationService - syncLegalDomainFromBackendBestEffort', () => {
  let service: any;
  let mockStore: any;
  let mockAccessControl: any;
  let mockResidencyPolicy: any;

  beforeEach(() => {
    mockStore = {
      getWorkspaceId: vi.fn().mockReturnValue('workspace:test'),
      getGraph: vi.fn().mockResolvedValue({
        clients: {},
        matters: {},
        deadlines: {},
        cases: {},
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      setGraph: vi.fn().mockResolvedValue(undefined),
      getTimeEntries: vi.fn().mockResolvedValue([]),
      setTimeEntries: vi.fn().mockResolvedValue(undefined),
      getRechnungen: vi.fn().mockResolvedValue([]),
      setRechnungen: vi.fn().mockResolvedValue(undefined),
    };

    mockAccessControl = {
      can: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue({ ok: true }),
      getRole: vi.fn().mockResolvedValue('owner'),
      setRole: vi.fn().mockResolvedValue(undefined),
    };

    mockResidencyPolicy = {
      getPolicy: vi.fn().mockResolvedValue({
        workspaceId: 'workspace:test',
        mode: 'default',
        allowCloudSync: true,
      }),
      setPolicy: vi.fn().mockResolvedValue({
        workspaceId: 'workspace:test',
        mode: 'default',
        allowCloudSync: true,
      }),
    };

    service = Object.create(CasePlatformOrchestrationService.prototype) as any;
    service['store'] = mockStore;
    service['accessControlService'] = mockAccessControl;
    service['residencyPolicyService'] = mockResidencyPolicy;
  });

  it('should not update graph if no data has changed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ items: [] }),
    }) as any;

    const result = await service.syncLegalDomainFromBackendBestEffort();

    expect(result).toBe(false);
    expect(mockStore.setGraph).not.toHaveBeenCalled();
  });

  it('should not persist graph if graph data is identical', async () => {
    const existingClient = {
      id: 'client:test',
      workspaceId: 'workspace:test',
      kind: 'person' as const,
      displayName: 'Test Client',
      identifiers: [],
      primaryEmail: 'test@example.com',
      primaryPhone: undefined,
      address: undefined,
      notes: undefined,
      tags: [],
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockStore.getGraph = vi.fn().mockResolvedValue({
      clients: { 'client:test': existingClient },
      matters: {},
      deadlines: {},
      cases: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/clients')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: 'client:test',
                  kind: 'person',
                  displayName: 'Test Client',
                  primaryEmail: 'test@example.com',
                  identifiers: [],
                  tags: [],
                  archived: false,
                  createdAt: '2024-01-01T00:00:00.000Z',
                  updatedAt: '2024-01-01T00:00:00.000Z',
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
    }) as any;

    const result = await service.syncLegalDomainFromBackendBestEffort();

    expect(result).toBe(false);
    expect(mockStore.setGraph).not.toHaveBeenCalled();
  });

  it('should update graph timestamp if data has changed', async () => {
    const existingClient = {
      id: 'client:test',
      workspaceId: 'workspace:test',
      kind: 'person' as const,
      displayName: 'Test Client',
      identifiers: [],
      primaryEmail: 'test@example.com',
      primaryPhone: undefined,
      address: undefined,
      notes: undefined,
      tags: [],
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockStore.getGraph = vi.fn().mockResolvedValue({
      clients: { 'client:test': existingClient },
      matters: {},
      deadlines: {},
      cases: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/clients')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: 'client:test',
                  kind: 'person',
                  displayName: 'Test Client Modified',
                  primaryEmail: 'test@example.com',
                  identifiers: [],
                  tags: [],
                  archived: false,
                  createdAt: '2024-01-01T00:00:00.000Z',
                  updatedAt: '2024-01-01T00:00:00.000Z',
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
    }) as any;

    const result = await service.syncLegalDomainFromBackendBestEffort();

    expect(result).toBe(true);
    expect(mockStore.setGraph).toHaveBeenCalled();

    const setGraphCall = vi.mocked(mockStore.setGraph).mock.calls[0][0];
    expect(setGraphCall.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
    expect(setGraphCall.clients?.['client:test'].displayName).toBe(
      'Test Client Modified'
    );
  });

  it('should not persist graph on subsequent sync when backend data is unchanged', async () => {
    const emptyGraph = {
      clients: {},
      matters: {},
      deadlines: {},
      cases: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const hydratedGraph = {
      ...emptyGraph,
      clients: {
        'client:test': {
          id: 'client:test',
          workspaceId: 'workspace:test',
          kind: 'person',
          displayName: 'Test Client',
          identifiers: [],
          primaryEmail: 'test@example.com',
          primaryPhone: undefined,
          address: undefined,
          notes: undefined,
          tags: [],
          archived: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    };

    mockStore.getGraph = vi
      .fn()
      .mockResolvedValueOnce(emptyGraph)
      .mockResolvedValueOnce(hydratedGraph);

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/clients')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: 'client:test',
                  kind: 'person',
                  displayName: 'Test Client',
                  primaryEmail: 'test@example.com',
                  identifiers: [],
                  tags: [],
                  archived: false,
                  createdAt: '2024-01-01T00:00:00.000Z',
                  updatedAt: '2024-01-01T00:00:00.000Z',
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
    }) as any;

    const first = await service.syncLegalDomainFromBackendBestEffort();
    const second = await service.syncLegalDomainFromBackendBestEffort();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(mockStore.setGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle missing workspaceId gracefully', async () => {
    mockStore.getWorkspaceId = vi.fn().mockReturnValue(null);

    global.fetch = vi.fn() as any;

    const result = await service.syncLegalDomainFromBackendBestEffort();

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockStore.setGraph).not.toHaveBeenCalled();
  });

  it('should update time entries without bumping graph timestamp', async () => {
    mockStore.getGraph = vi.fn().mockResolvedValue({
      clients: {},
      matters: {},
      deadlines: {},
      cases: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    mockStore.getTimeEntries = vi.fn().mockResolvedValue([]);

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/time-entries')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: 'time:test',
                  matterId: 'matter:test',
                  clientId: 'client:test',
                  anwaltId: 'user:test',
                  description: 'Call',
                  activityType: 'telefonat',
                  durationMinutes: 30,
                  hourlyRate: 100,
                  amount: 50,
                  date: '2024-01-02T00:00:00.000Z',
                  status: 'draft',
                  createdAt: '2024-01-02T00:00:00.000Z',
                  updatedAt: '2024-01-02T00:00:00.000Z',
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
    }) as any;

    const result = await service.syncLegalDomainFromBackendBestEffort();

    expect(result).toBe(true);
    expect(mockStore.setTimeEntries).toHaveBeenCalledTimes(1);
    expect(mockStore.setGraph).not.toHaveBeenCalled();
  });

  it('should update invoices without bumping graph timestamp', async () => {
    mockStore.getGraph = vi.fn().mockResolvedValue({
      clients: {},
      matters: {},
      deadlines: {},
      cases: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    mockStore.getRechnungen = vi.fn().mockResolvedValue([]);

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/invoices')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: 'inv:test',
                  matterId: 'matter:test',
                  clientId: 'client:test',
                  invoiceNumber: 'RE-0001',
                  status: 'draft',
                  subtotalCents: 0,
                  taxRateBps: 0,
                  taxAmountCents: 0,
                  totalCents: 0,
                  lineItems: [],
                  createdAt: '2024-01-02T00:00:00.000Z',
                  updatedAt: '2024-01-02T00:00:00.000Z',
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
    }) as any;

    const result = await service.syncLegalDomainFromBackendBestEffort();

    expect(result).toBe(true);
    expect(mockStore.setRechnungen).toHaveBeenCalledTimes(1);
    expect(mockStore.setGraph).not.toHaveBeenCalled();
  });
});
