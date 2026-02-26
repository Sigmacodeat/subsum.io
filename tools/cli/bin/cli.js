#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runnerPath = join(dirname(fileURLToPath(import.meta.url)), 'runner.js');

spawnSync(process.execPath, [runnerPath, 'affine.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
