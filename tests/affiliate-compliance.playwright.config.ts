import { defineConfig, devices } from '@playwright/test';

const playwrightBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: playwrightBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'yarn workspace @affine/web start',
    port: Number(new URL(playwrightBaseUrl).port || 80),
    reuseExistingServer: !process.env.CI,
  },
});
