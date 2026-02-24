import crypto from 'node:crypto';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { Package } from '@affine-tools/utils/workspace';
import { expect, type Page } from '@playwright/test';
import fs from 'fs-extra';
import type { ElectronApplication } from 'playwright';
import { _electron as electron } from 'playwright';

import { test as base, testResultDir } from './playwright';
import { removeWithRetry } from './utils/utils';

const electronRoot = new Package('@affine/electron').path;
const repoRoot = electronRoot.join('../../../..').value;

function generateUUID() {
  return crypto.randomUUID();
}

type RoutePath = 'setting';

const getPageId = async (page: Page) => {
  return page.evaluate(() => {
    return (window.__appInfo as any)?.viewId as string;
  });
};

const isActivePage = async (page: Page) => {
  return page.evaluate(async () => {
    return await (window as any).__apis?.ui.isActiveTab();
  });
};

const getActivePage = async (pages: Page[]) => {
  for (const page of pages) {
    if (await isActivePage(page)) {
      return page;
    }
  }
  return null;
};

export const test = base.extend<{
  electronApp: ElectronApplication;
  shell: Page;
  appInfo: {
    appPath: string;
    appData: string;
    sessionData: string;
  };
  views: {
    getActive: () => Promise<Page>;
  };
  router: {
    goto: (path: RoutePath) => Promise<void>;
  };
}>({
  shell: async ({ electronApp }, use) => {
    await expect.poll(() => electronApp.windows().length > 0, { timeout: 60_000 }).toBeTruthy();

    for (const page of electronApp.windows()) {
      const viewId = await getPageId(page);
      if (viewId === 'shell') {
        await use(page);
        break;
      }
    }
  },
  page: async ({ electronApp }, use) => {
    await expect
      .poll(
        () => {
          return electronApp.windows().length > 0;
        },
        {
          timeout: 60_000,
        }
      )
      .toBeTruthy();

    await expect
      .poll(
        async () => {
          const page = await getActivePage(electronApp.windows());
          return !!page;
        },
        {
          timeout: 60_000,
        }
      )
      .toBeTruthy();

    const page = await getActivePage(electronApp.windows());

    if (!page) {
      throw new Error('No active page found');
    }

    // wait for blocksuite to be loaded
    await page.waitForSelector('v-line');

    await use(page as Page);
  },
  views: async ({ electronApp, page }, use) => {
    void page; // makes sure page is a dependency
    await use({
      getActive: async () => {
        const view = await getActivePage(electronApp.windows());
        return view || page;
      },
    });
  },
  // oxlint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    try {
      // a random id to avoid conflicts between tests
      const id = generateUUID();
      const dist = electronRoot.join('dist').value;
      const clonedDist = electronRoot.join('e2e-dist-' + id).value;
      await fs.copy(dist, clonedDist);
      const packageJson = await fs.readJSON(
        electronRoot.join('package.json').value
      );
      // overwrite the app name
      packageJson.name = '@affine/electron-test-' + id;
      // dist/main/index.js is emitted as ESM; ensure Electron can load it.
      packageJson.type = 'module';
      // overwrite the path to the main script
      packageJson.main = './main.js';
      if (!(await fs.pathExists(electronRoot.join('dist/main/index.js').value))) {
        throw new Error(
          `Electron E2E launch entry not found: ${electronRoot.join('dist/main/index.js').value}`
        );
      }
      // write to the cloned dist
      await fs.writeJSON(clonedDist + '/package.json', packageJson);
      const pwUserDataDir = clonedDist + '/pw-user-data';
      await fs.ensureDir(pwUserDataDir);
      await fs.writeFile(
        clonedDist + '/main.js',
        "import path from 'node:path';\n" +
          "import { fileURLToPath } from 'node:url';\n" +
          "import { app } from 'electron';\n" +
          "const __dirname = path.dirname(fileURLToPath(import.meta.url));\n" +
          "const userDataPath = path.join(__dirname, 'pw-user-data');\n" +
          "app.setPath('userData', userDataPath);\n" +
          "app.setPath('sessionData', userDataPath);\n" +
          "// Playwright E2E runs must not be blocked by a running desktop instance.\n" +
          "// requestSingleInstanceLock() would quit immediately if another instance exists.\n" +
          "// We bypass it here in the shim before the real entry attaches listeners.\n" +
          "// eslint-disable-next-line @typescript-eslint/no-explicit-any\n" +
          "(app as any).requestSingleInstanceLock = () => true;\n" +
          "await import('./main/index.js');\n"
      );

      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value) {
          env[key] = value;
        }
      }
      env.DEBUG = 'pw:browser';

      const pnpPath = path.join(repoRoot, '.pnp.cjs');
      if (await fs.pathExists(pnpPath)) {
        const existingNodeOptions = env.NODE_OPTIONS?.trim();
        const pnpRequire = `--require ${pnpPath}`;
        env.NODE_OPTIONS = existingNodeOptions
          ? `${pnpRequire} ${existingNodeOptions}`
          : pnpRequire;
      }

      env.SKIP_ONBOARDING = '1';

      const electronApp = await electron.launch({
        args: [clonedDist],
        env,
        cwd: repoRoot,
        timeout: 300_000,
        recordVideo: {
          dir: testResultDir,
        },
        colorScheme: 'light',
      });

      const proc = electronApp.process();
      const logs: string[] = [];
      const pushLog = (prefix: string, chunk: unknown) => {
        const text = String(chunk ?? '');
        if (!text) return;
        logs.push(`${prefix}${text}`);
        if (logs.join('').length > 20_000) {
          logs.splice(0, Math.ceil(logs.length / 2));
        }
      };
      const pushAndEcho = (prefix: string, chunk: unknown) => {
        pushLog(prefix, chunk);
        const text = String(chunk ?? '').trimEnd();
        if (text) {
          // keep this reasonably small; detailed logs are still buffered above
          console.log(`${prefix}${text}`);
        }
      };
      proc?.stdout?.on('data', data => pushAndEcho('[electron:stdout] ', data));
      proc?.stderr?.on('data', data => pushAndEcho('[electron:stderr] ', data));
      proc?.once('exit', (code, signal) => {
        console.log(`[electron:exit] code=${code} signal=${signal}`);
        if (logs.length) {
          console.log(logs.join(''));
        }
      });

      // Fail fast with diagnostics if the app never creates a window.
      try {
        await expect
          .poll(
            () => {
              return electronApp.windows().length > 0;
            },
            { timeout: 120_000 }
          )
          .toBeTruthy();
      } catch {
        console.log(
          `[electron:e2e] no windows created within timeout; pid=${proc?.pid ?? 'n/a'}`
        );
        if (logs.length) {
          console.log('[electron:e2e] last logs:\n' + logs.join(''));
        }
        throw new Error('Electron launched but no windows were created');
      }

      await use(electronApp);
      const cleanup = async () => {
        const pages = electronApp.windows();
        for (const page of pages) {
          if (page.isClosed()) {
            continue;
          }
          await page.close();
        }
        await electronApp.close();
        await removeWithRetry(clonedDist);
      };
      await Promise.race([
        // cleanup may stuck and fail the test, but it should be fine.
        cleanup(),
        setTimeout(10000).then(() => {
          // kill the electron app if it is not closed after 10 seconds
          electronApp.process().kill();
        }),
      ]);
    } catch (error) {
      console.log(error);
      throw error;
    }
  },
  appInfo: async ({ electronApp }, use) => {
    const appInfo = await electronApp.evaluate(async ({ app }) => {
      return {
        appPath: app.getAppPath(),
        appData: app.getPath('appData'),
        sessionData: app.getPath('sessionData'),
      };
    });
    await use(appInfo);
  },
});
