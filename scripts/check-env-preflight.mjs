import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());

function loadEnvExample() {
  const examplePath = path.join(repoRoot, 'docs/env.example');
  const text = fs.readFileSync(examplePath, 'utf8');
  const keys = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    keys.push(key);
  }
  return Array.from(new Set(keys));
}

function pickMustHave(keys) {
  // Keep this intentionally small: only variables that are required for core
  // prod web flows in this repository.
  // Everything else is optional and should not block CI.
  const must = new Set([
    // marketing quick-check: without this endpoint returns error
    'QUICK_CHECK_UPSTREAM_URL',
  ]);

  return keys.filter(k => must.has(k));
}

const allKeys = loadEnvExample();
const mustHave = pickMustHave(allKeys);

const missing = mustHave.filter(k => !process.env[k] || String(process.env[k]).trim().length === 0);

if (missing.length > 0) {
  console.error('\n[env-preflight] ERROR: missing required environment variables:\n');
  for (const k of missing) {
    console.error(`- ${k}`);
  }
  console.error('\nSet them in your environment (Vercel project settings or local .env.local).');
  console.error('Template: docs/env.example\n');
  process.exit(1);
}

console.log('[env-preflight] OK: required environment variables are present.');
