import {
  OAuthProviderType,
  ServerDeploymentType,
  ServerFeature,
} from '@affine/graphql';

import type { ServerConfig, ServerMetadata } from './types';

import { getSubsumioCanonicalOrigin } from '../../utils/subsumio-domains';

export const OFFICIAL_CLOUD_SERVER_ID = 'affine-cloud';
export const SUBSUMIO_CLOUD_NAME = 'Subsumio Cloud';
export const SUBSUMIO_SELF_HOSTED_CLOUD_NAME = 'Subsumio Self-Hosted Cloud';

export const resolveServerDisplayName = (
  serverId: string,
  serverType: ServerDeploymentType,
  serverName: string
) => {
  if (serverId !== OFFICIAL_CLOUD_SERVER_ID) {
    return serverName;
  }

  return serverType === ServerDeploymentType.Selfhosted
    ? SUBSUMIO_SELF_HOSTED_CLOUD_NAME
    : SUBSUMIO_CLOUD_NAME;
};

export const BUILD_IN_SERVERS: (ServerMetadata & { config: ServerConfig })[] =
  environment.isSelfHosted
    ? [
        {
          id: OFFICIAL_CLOUD_SERVER_ID,
          baseUrl: location.origin,
          // selfhosted baseUrl is `location.origin`
          // this is ok for web app, but not for desktop app
          // since we never build desktop app in selfhosted mode, so it's fine
          config: {
            serverName: SUBSUMIO_SELF_HOSTED_CLOUD_NAME,
            features: [],
            oauthProviders: [],
            type: ServerDeploymentType.Selfhosted,
            credentialsRequirement: {
              password: {
                minLength: 8,
                maxLength: 32,
              },
            },
          },
        },
      ]
    : BUILD_CONFIG.debug
      ? [
          {
            id: OFFICIAL_CLOUD_SERVER_ID,
            baseUrl: BUILD_CONFIG.isElectron
              ? 'http://localhost:8080'
              : location.origin,
            config: {
              serverName: SUBSUMIO_CLOUD_NAME,
              features: [
                ServerFeature.Indexer,
                ServerFeature.Copilot,
                ServerFeature.CopilotEmbedding,
                ServerFeature.OAuth,
                ServerFeature.Payment,
                ServerFeature.LocalWorkspace,
              ],
              oauthProviders: [
                OAuthProviderType.Google,
                OAuthProviderType.Apple,
              ],
              type: ServerDeploymentType.Affine,
              credentialsRequirement: {
                password: {
                  minLength: 8,
                  maxLength: 32,
                },
              },
            },
          },
        ]
      : BUILD_CONFIG.appBuildType === 'stable'
        ? [
            {
              id: OFFICIAL_CLOUD_SERVER_ID,
              baseUrl: BUILD_CONFIG.isNative
                ? BUILD_CONFIG.isIOS
                  ? 'https://apple.getaffineapp.com'
                  : getSubsumioCanonicalOrigin('app')
                : location.origin,
              config: {
                serverName: SUBSUMIO_CLOUD_NAME,
                features: [
                  ServerFeature.Indexer,
                  ServerFeature.Copilot,
                  ServerFeature.CopilotEmbedding,
                  ServerFeature.OAuth,
                  ServerFeature.Payment,
                  ServerFeature.LocalWorkspace,
                ],
                oauthProviders: [
                  OAuthProviderType.Google,
                  OAuthProviderType.Apple,
                ],
                type: ServerDeploymentType.Affine,
                credentialsRequirement: {
                  password: {
                    minLength: 8,
                    maxLength: 32,
                  },
                },
              },
            },
          ]
        : BUILD_CONFIG.appBuildType === 'beta'
          ? [
              {
                id: OFFICIAL_CLOUD_SERVER_ID,
                baseUrl: BUILD_CONFIG.isNative
                  ? BUILD_CONFIG.isIOS
                    ? 'https://apple.getaffineapp.com'
                    : getSubsumioCanonicalOrigin('app')
                  : location.origin,
                config: {
                  serverName: SUBSUMIO_CLOUD_NAME,
                  features: [
                    ServerFeature.Indexer,
                    ServerFeature.Copilot,
                    ServerFeature.CopilotEmbedding,
                    ServerFeature.OAuth,
                    ServerFeature.Payment,
                    ServerFeature.LocalWorkspace,
                  ],
                  oauthProviders: [
                    OAuthProviderType.Google,
                    OAuthProviderType.Apple,
                  ],
                  type: ServerDeploymentType.Affine,
                  credentialsRequirement: {
                    password: {
                      minLength: 8,
                      maxLength: 32,
                    },
                  },
                },
              },
            ]
          : BUILD_CONFIG.appBuildType === 'internal'
            ? [
                {
                  id: OFFICIAL_CLOUD_SERVER_ID,
                  baseUrl: getSubsumioCanonicalOrigin('app'),
                  config: {
                    serverName: SUBSUMIO_CLOUD_NAME,
                    features: [
                      ServerFeature.Indexer,
                      ServerFeature.Copilot,
                      ServerFeature.CopilotEmbedding,
                      ServerFeature.OAuth,
                      ServerFeature.Payment,
                      ServerFeature.LocalWorkspace,
                    ],
                    oauthProviders: [
                      OAuthProviderType.Google,
                      OAuthProviderType.Apple,
                    ],
                    type: ServerDeploymentType.Affine,
                    credentialsRequirement: {
                      password: {
                        minLength: 8,
                        maxLength: 32,
                      },
                    },
                  },
                },
              ]
            : BUILD_CONFIG.appBuildType === 'canary'
              ? [
                  {
                    id: OFFICIAL_CLOUD_SERVER_ID,
                    baseUrl: BUILD_CONFIG.isNative
                      ? getSubsumioCanonicalOrigin('app')
                      : location.origin,
                    config: {
                      serverName: SUBSUMIO_CLOUD_NAME,
                      features: [
                        ServerFeature.Indexer,
                        ServerFeature.Copilot,
                        ServerFeature.CopilotEmbedding,
                        ServerFeature.OAuth,
                        ServerFeature.Payment,
                        ServerFeature.LocalWorkspace,
                      ],
                      oauthProviders: [
                        OAuthProviderType.Google,
                        OAuthProviderType.Apple,
                      ],
                      type: ServerDeploymentType.Affine,
                      credentialsRequirement: {
                        password: {
                          minLength: 8,
                          maxLength: 32,
                        },
                      },
                    },
                  },
                ]
              : [];

export type TelemetryChannel =
  | 'stable'
  | 'beta'
  | 'internal'
  | 'canary'
  | 'local';

const OFFICIAL_TELEMETRY_ENDPOINTS: Record<TelemetryChannel, string> = {
  stable: getSubsumioCanonicalOrigin('app'),
  beta: getSubsumioCanonicalOrigin('app'),
  internal: getSubsumioCanonicalOrigin('app'),
  canary: getSubsumioCanonicalOrigin('app'),
  local: 'http://localhost:8080',
};

export function getOfficialTelemetryEndpoint(
  channel = BUILD_CONFIG.appBuildType
): string {
  if (BUILD_CONFIG.debug) {
    return BUILD_CONFIG.isNative
      ? OFFICIAL_TELEMETRY_ENDPOINTS.local
      : location.origin;
  } else if (['beta', 'internal', 'canary', 'stable'].includes(channel)) {
    return OFFICIAL_TELEMETRY_ENDPOINTS[channel];
  }

  return OFFICIAL_TELEMETRY_ENDPOINTS.stable;
}
