import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');

const configSource = fs.readFileSync(
  path.join(srcRoot, 'i18n', 'config.ts'),
  'utf8'
);
const routesSource = fs.readFileSync(
  path.join(srcRoot, 'utils', 'seo-routes.ts'),
  'utf8'
);
const overridesSource = fs.readFileSync(
  path.join(srcRoot, 'content', 'seo-market-content.ts'),
  'utf8'
);

function parseStringArray(source, varName) {
  const regex = new RegExp(
    `export\\s+const\\s+${varName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`
  );
  const match = source.match(regex);
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']*)'/g)).map(m => m[1]);
}

function parseLocaleOverridePaths(source, locale) {
  const escapedLocale = locale.replace(/[-]/g, '\\-');
  // Match both quoted ('de-DE') and unquoted (en, fr) locale keys
  const localeBlockRegex = new RegExp(
    `(?:'${escapedLocale}'|(?<!['w])${escapedLocale}(?!['w]))\\s*:\\s*\\{([\\s\\S]*?)\\n  \\},?`,
    'm'
  );
  const block = source.match(localeBlockRegex)?.[1];
  if (!block) return [];
  return Array.from(block.matchAll(/'([^']*)'\s*:/g))
    .map(m => m[1])
    .filter(k => k === '' || k.startsWith('/'));
}

const locales = parseStringArray(configSource, 'locales');
const routes = parseStringArray(routesSource, 'seoIndexablePaths');

const lines = [];
lines.push('# Localization SEO Coverage Report');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push(`Locales: ${locales.length}`);
lines.push(`Indexable routes: ${routes.length}`);
lines.push('');
lines.push('| Locale | Override Routes | Missing Routes |');
lines.push('|---|---:|---:|');

let totalMissing = 0;

for (const locale of locales) {
  const overrideRoutes = parseLocaleOverridePaths(overridesSource, locale);
  const routeSet = new Set(overrideRoutes);
  const missing = routes.filter(route => !routeSet.has(route));
  totalMissing += missing.length;
  lines.push(`| ${locale} | ${overrideRoutes.length} | ${missing.length} |`);
}

lines.push('');
lines.push(`Total missing locale-route overrides: ${totalMissing}`);
lines.push('');
lines.push('## Guidance');
lines.push('- Prioritize transactional pages first: /pricing, /contact, /tax');
lines.push(
  '- Add locale-specific title/description/keywords where intent differs by market'
);
lines.push('- Keep legal pages accurate per jurisdiction');

const reportPath = path.join(appRoot, 'LOCALIZATION_SEO_COVERAGE.md');
fs.writeFileSync(reportPath, lines.join('\n'));

console.log(`[localization-seo] report written to ${reportPath}`);
