#!/usr/bin/env node
/**
 * Tolgee sync & download utilities
 *
 * - sync: push missing keys from en.json to Tolgee project
 * - download: fetch all translations for all languages and write to resources/*.json
 *
 * Environment:
 *   TOLGEE_API_URL (e.g. https://i18n.affine.pro)
 *   TOLGEE_API_KEY (required)
 *   TOLGEE_PROJECT_ID (required)
 *
 * Usage:
 *   node packages/frontend/i18n/tolgee-sync.mjs sync
 *   node packages/frontend/i18n/tolgee-sync.mjs download
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const RESOURCES_DIR = path.join(REPO_ROOT, 'packages/frontend/i18n/src/resources');

const { TOLGEE_API_URL, TOLGEE_API_KEY, TOLGEE_PROJECT_ID } = process.env;
if (!TOLGEE_API_URL || !TOLGEE_API_KEY || !TOLGEE_PROJECT_ID) {
  console.error('❌ Missing required env vars: TOLGEE_API_URL, TOLGEE_API_KEY, TOLGEE_PROJECT_ID');
  process.exit(2);
}

const API = `${TOLGEE_API_URL.replace(/\/$/, '')}/api/v1/projects/${TOLGEE_PROJECT_ID}`;

/**
 * Simple fetch wrapper with auth
 */
async function tolgeeFetch(path, options = {}) {
  const url = `${API}${path}`;
  const resp = await fetch(url, {
    headers: {
      'X-API-Key': TOLGEE_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Tolgee API error ${resp.status} ${resp.statusText}: ${text}`);
  }
  return resp.json();
}

/**
 * Get all languages in project
 */
async function getLanguages() {
  const langs = await tolgeeFetch('/languages');
  return langs.map(l => l.tag);
}

/**
 * Get all keys (including translations) for a language
 */
async function getTranslations(lang) {
  const data = await tolgeeFetch(`/translations?language=${lang}&size=1000`);
  // data._embedded.translations list
  const list = data._embedded?.translations ?? [];
  const map = {};
  for (const item of list) {
    map[item.key] = item.text;
  }
  return map;
}

/**
 * Push missing keys from en.json to Tolgee (sync)
 */
async function syncMissingKeys() {
  const enPath = path.join(RESOURCES_DIR, 'en.json');
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const existingKeys = new Set();

  // Fetch existing keys from Tolgee (paginated)
  let page = 0;
  const size = 500;
  while (true) {
    const data = await tolgeeFetch(`/keys?page=${page}&size=${size}`);
    const items = data._embedded?.keys ?? [];
    if (!items.length) break;
    for (const k of items) items.forEach(k => existingKeys.add(k.name));
    page++;
  }

  const missing = Object.keys(en).filter(k => !existingKeys.has(k));
  if (!missing.length) {
    console.log('✅ No missing keys to sync');
    return;
  }

  console.log(`📤 Syncing ${missing.length} missing keys to Tolgee...`);
  // Tolgee bulk create keys endpoint
  await tolgeeFetch('/keys/import', {
    method: 'POST',
    body: JSON.stringify({
      keys: missing.map(name => ({ name })),
    }),
  });
  console.log('✅ Keys synced');
}

/**
 * Download all translations and write to resources/*.json
 */
async function downloadAll() {
  const enPath = path.join(RESOURCES_DIR, 'en.json');
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  const languages = await getLanguages();
  console.log(`📥 Downloading translations for ${languages.length} languages...`);

  for (const lang of languages) {
    const translations = await getTranslations(lang);
    // Merge with en.json for missing keys (fallback)
    const merged = { ...en };
    for (const [k, v] of Object.entries(translations)) {
      if (v != null && v !== '') merged[k] = v;
    }
    const filePath = path.join(RESOURCES_DIR, `${lang}.json`);
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
    console.log(`✅ ${lang}.json written`);
  }
}

// CLI
const command = process.argv[2];
if (command === 'sync') {
  await syncMissingKeys();
} else if (command === 'download') {
  await downloadAll();
} else {
  console.error('Usage: node tolgee-sync.mjs [sync|download]');
  process.exit(3);
}
