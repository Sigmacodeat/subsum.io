import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';

export const RSPACK_SUPPORTED_PACKAGES = [
  '@affine/admin',
  '@affine/web',
  '@affine/mobile',
  '@affine/ios',
  '@affine/android',
  '@affine/electron-renderer',
  '@affine/server',
] as const;

const rspackSupportedPackageSet = new Set<string>(RSPACK_SUPPORTED_PACKAGES);

export function isRspackSupportedPackageName(name: string) {
  return rspackSupportedPackageSet.has(name);
}

export function assertRspackSupportedPackageName(name: string) {
  if (isRspackSupportedPackageName(name)) {
    return;
  }

  throw new Error(
    `AFFINE_BUNDLER=rspack currently supports: ${Array.from(RSPACK_SUPPORTED_PACKAGES).join(', ')}. Use AFFINE_BUNDLER=webpack for ${name}.`
  );
}

const IN_CI = !!process.env.CI;
const httpProxyMiddlewareLogLevel = IN_CI ? 'silent' : 'error';

// Reserve :3000 for the public marketing site by default.
// Dashboard/web dev server can still be explicitly moved via PORT/DEV_PORT.
const DEV_SERVER_PORT = Number(process.env.PORT ?? process.env.DEV_PORT ?? 8080);

export const DEFAULT_DEV_SERVER_CONFIG: WebpackDevServerConfiguration = {
  host: '0.0.0.0',
  port: DEV_SERVER_PORT,
  allowedHosts: 'all',
  hot: false,
  liveReload: true,
  compress: !process.env.CI,
  setupExitSignals: true,
  client: {
    overlay: process.env.DISABLE_DEV_OVERLAY === 'true' ? false : undefined,
    logging: process.env.CI ? 'none' : 'error',
    // see: https://webpack.js.org/configuration/dev-server/#websocketurl
    // must be an explicit ws/wss URL because custom protocols (e.g. assets://)
    // cannot be used to construct WebSocket endpoints in Electron
    webSocketURL: `ws://0.0.0.0:${DEV_SERVER_PORT}/ws`,
  },
  historyApiFallback: {
    rewrites: [
      {
        from: /^\/admin(\/.*)?$/,
        to: (context: any) => {
          return context.parsedUrl.pathname;
        },
      },
      {
        from: /.*/,
        to: () => {
          return process.env.SELF_HOSTED === 'true'
            ? '/selfhost.html'
            : '/index.html';
        },
      },
    ],
  },
  proxy: [
    {
      context: '/admin',
      target: process.env.ADMIN_DEV_SERVER_URL ?? 'http://localhost:8081',
      changeOrigin: true,
      logLevel: httpProxyMiddlewareLogLevel,
    },
    {
      context: '/api',
      target: 'http://localhost:3010',
      logLevel: httpProxyMiddlewareLogLevel,
    },
    {
      context: '/socket.io',
      target: 'http://localhost:3010',
      ws: true,
      logLevel: httpProxyMiddlewareLogLevel,
    },
    {
      context: '/graphql',
      target: 'http://localhost:3010',
      logLevel: httpProxyMiddlewareLogLevel,
    },
  ],
};
