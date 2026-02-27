import type { VercelRequest, VercelResponse } from '@vercel/node';

// ────────────────────────────────────────────────────────────
// Static GraphQL responses for critical frontend startup queries.
// These allow the SPA to boot and render the auth UI without a
// full NestJS backend.  Every response matches the schema the
// frontend @affine/graphql package expects.
// ────────────────────────────────────────────────────────────

const SERVER_CONFIG = {
  __typename: 'ServerConfigType',
  version: '0.26.1',
  baseUrl: 'https://app.subsum.io',
  name: 'Subsumio',
  features: ['LocalWorkspace'],
  type: 'Selfhosted',
  initialized: true,
  calendarProviders: [],
  credentialsRequirement: {
    __typename: 'CredentialsRequirementType',
    password: {
      __typename: 'PasswordLimitsType',
      minLength: 8,
      maxLength: 32,
    },
  },
};

const RESPONSES: Record<string, object> = {
  serverConfig: {
    data: { serverConfig: SERVER_CONFIG },
  },
  oauthProviders: {
    data: {
      serverConfig: { __typename: 'ServerConfigType', oauthProviders: [] },
    },
  },
  currentUser: {
    data: { currentUser: null },
  },
  getCurrentUser: {
    data: { currentUser: null },
  },
  getWorkspaces: {
    data: { workspaces: [] },
  },
  getServerRuntimeConfig: {
    data: { serverRuntimeConfig: {} },
  },
  listWorkspaces: {
    data: { workspaces: [] },
  },
  getInviteInfo: {
    data: null,
    errors: [
      { message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } },
    ],
  },
  getIsOwner: {
    data: null,
    errors: [
      { message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } },
    ],
  },
  quota: {
    data: { currentUser: null },
  },
  subscription: {
    data: { currentUser: null },
  },
  prices: {
    data: { prices: [] },
  },
};

function resolveOperationName(body: unknown): string {
  let parsed = body;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return '';
    }
  }
  if (parsed && typeof parsed === 'object') {
    const b = parsed as Record<string, unknown>;
    if (typeof b.operationName === 'string') return b.operationName;
    if (typeof b.op === 'string') return b.op;
  }
  return '';
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const opName = resolveOperationName(req.body);
  const known = RESPONSES[opName];

  if (known) {
    return res.status(200).json(known);
  }

  return res.status(200).json({
    data: null,
    errors: [
      {
        message: `Operation "${opName || 'unknown'}" is not available yet.`,
        extensions: { code: 'SERVICE_UNAVAILABLE' },
      },
    ],
  });
}
