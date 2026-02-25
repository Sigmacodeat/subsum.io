import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('../../../', import.meta.url));

export default defineConfig({
  define: {
    BUILD_CONFIG: {
      isElectron: false,
      isCloud: false,
      isServer: false,
    },
  },
  test: {
    include: [
      'src/modules/case-assistant/__tests__/document-upload-edge.spec.ts',
      'src/modules/case-assistant/__tests__/e2e-pdf-pipeline.spec.ts',
      'src/modules/case-assistant/__tests__/legal-copilot-workflow.spec.ts',
      'src/modules/case-assistant/__tests__/anwalts-reminder.spec.ts',
      'src/modules/case-assistant/__tests__/deadline-alert-bridge.spec.ts',
      'src/modules/case-assistant/__tests__/platform-orchestration-sync.spec.ts',
    ],
    environment: 'node',
    globals: true,
    pool: 'forks',
    isolate: true,
    setupFiles: [
      resolve(rootDir, './scripts/setup/polyfill.ts'),
      resolve(rootDir, './scripts/setup/lit.ts'),
      resolve(rootDir, './scripts/setup/vi-mock.ts'),
      resolve(rootDir, './scripts/setup/global.ts'),
    ],
  },
});
