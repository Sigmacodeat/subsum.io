import { once } from 'lodash-es';

import { Logger } from './logger.js';
import { exec } from './process.js';
import type { YarnWorkspaceItem } from './types.js';
import type { PackageName } from './workspace.gen.js';

async function loadPackageList() {
  try {
    const packageList = await import('./workspace.gen.js');
    return packageList.PackageList;
  } catch (e) {
    console.log(e);
    new Logger('yarn').error('Failed to load package list');
    return [];
  }
}

export const PackageList = await loadPackageList();
export type { PackageName };

export const yarnList = once(() => {
  const output = exec('', 'yarn workspaces list -v --json', { silent: true });

  let packageList = JSON.parse(
    `[${output.trim().replace(/\r\n|\n/g, ',')}]`
  ) as YarnWorkspaceItem[];

  packageList.forEach(p => {
    p.location = p.location.replaceAll(/\\/g, '/');
    delete p['mismatchedWorkspaceDependencies'];
  });

  // ignore root package
  return packageList.filter(p => p.location !== '.');
});
