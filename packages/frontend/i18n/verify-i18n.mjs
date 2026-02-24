#!/usr/bin/env node
/**
 * i18n verification guard
 *
 * - Ensures no EN fallback values remain in non-EN locales for required prefixes
 * - Ensures all required keys exist in every locale
 * - Fails with non-zero exit code if violations found
 *
 * Usage:
 *   node packages/frontend/i18n/verify-i18n.mjs
 *
 * Environment:
 *   REQUIRED_LOCALES (comma-separated) - defaults to all locales in resources/
 *   REQUIRED_PREFIXES (comma-separated) - defaults to com.affine.caseAssistant.uploadZone.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const RESOURCES_DIR = path.join(REPO_ROOT, 'packages/frontend/i18n/src/resources');

const REQUIRED_LOCALES = (process.env.REQUIRED_LOCALES ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const REQUIRED_PREFIXES = (process.env.REQUIRED_PREFIXES ?? 'com.affine.caseAssistant.uploadZone.')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function readResource(lang) {
  const filePath = path.join(RESOURCES_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing locale file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listLocales() {
  return fs.readdirSync(RESOURCES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.parse(f).name);
}

function main() {
  const locales = REQUIRED_LOCALES.length ? REQUIRED_LOCALES : listLocales();
  const en = readResource('en');

  // Collect all keys that match any required prefix
  const requiredKeys = new Set();
  for (const prefix of REQUIRED_PREFIXES) {
    for (const key of Object.keys(en)) {
      if (key.startsWith(prefix)) {
        requiredKeys.add(key);
      }
    }
  }

  if (!requiredKeys.size) {
    console.warn('⚠️ No required keys found for prefixes:', REQUIRED_PREFIXES.join(', '));
    return;
  }

  let violations = 0;

  for (const locale of locales) {
    if (locale === 'en') continue; // skip base language
    const obj = readResource(locale);
    for (const key of requiredKeys) {
      if (!(key in obj)) {
        console.error(`❌ ${locale}: missing key "${key}"`);
        violations++;
      } else if (obj[key] === en[key]) {
        console.error(`❌ ${locale}: key "${key}" is identical to EN (fallback)`);
        violations++;
      }
    }
  }

  if (violations) {
    console.error(`\n❌ i18n verification failed: ${violations} violation(s)`);
    console.error('Fix by running `yarn i18n:download` or add translations manually.');
    process.exit(1);
  } else {
    console.log(`✅ i18n verification passed for ${locales.length} locales, ${requiredKeys.size} keys`);
  }
}

main();
