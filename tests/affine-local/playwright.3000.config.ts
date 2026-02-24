import { testResultDir } from '@affine-test/kit/playwright';
import type {
  PlaywrightTestConfig,
  PlaywrightWorkerOptions,
} from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  fullyParallel: false,
  timeout: process.env.CI ? 180_000 : 180_000,
  outputDir: testResultDir,
  use: {
    baseURL: 'http://localhost:3000/',
    browserName:
      (process.env.BROWSER as PlaywrightWorkerOptions['browserName']) ??
      'chromium',
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    locale: 'de-DE',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  // IMPORTANT: no webServer here — user runs app on :3000
};

export default config;
