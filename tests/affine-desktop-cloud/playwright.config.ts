import { testResultDir } from '@affine-test/kit/playwright';
import type { PlaywrightTestConfig } from '@playwright/test';
// import { devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const playwrightBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080/';
const backendExternalUrl =
  process.env.AFFINE_SERVER_EXTERNAL_URL ??
  process.env.BACKEND_BASE_URL ??
  'http://localhost:3010';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  fullyParallel: true,
  timeout: process.env.CI ? 300_000 : 60_000,
  outputDir: testResultDir,
  use: {
    viewport: { width: 1440, height: 800 },
  },
  reporter: process.env.CI ? 'github' : 'list',
  webServer: [
    // Intentionally not building the web, reminds you to run it by yourself.
    {
      command: 'yarn run -T affine dev -p @affine/electron-renderer',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      env: {
        COVERAGE: process.env.COVERAGE || 'false',
        DISTRIBUTION: 'desktop',
      },
      url: new URL(playwrightBaseUrl).origin,
    },
    {
      command: 'yarn run -T affine dev -p @affine/server',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://affine:affine@localhost:5432/affine',
        NODE_ENV: 'test',
        AFFINE_ENV: process.env.AFFINE_ENV ?? 'dev',
        DEBUG: 'affine:*',
        FORCE_COLOR: 'true',
        DEBUG_COLORS: 'true',
        MAILER_SENDER: 'noreply@toeverything.info',
      },
      url: new URL(backendExternalUrl).origin + '/graphql',
    },
  ],
};

if (process.env.CI) {
  config.retries = 3;
  config.workers = '50%';
}

export default config;
