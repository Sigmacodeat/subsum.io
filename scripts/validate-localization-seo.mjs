import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');
const messagesRoot = path.join(srcRoot, 'messages');
const configSource = fs.readFileSync(
  path.join(srcRoot, 'i18n', 'config.ts'),
  'utf8'
);
const routesSource = fs.readFileSync(
  path.join(srcRoot, 'utils', 'seo-routes.ts'),
  'utf8'
);

function fail(message) {
  console.error(`\n[localization-seo] ERROR: ${message}\n`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseStringArray(source, varName) {
  const regex = new RegExp(
    `export\\s+const\\s+${varName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`
  );
  const match = source.match(regex);
  if (!match) {
    fail(`Could not parse ${varName} from source`);
  }

  return Array.from(match[1].matchAll(/'([^']*)'/g)).map(m => m[1]);
}

function parseDefaultLocale(source) {
  const match = source.match(
    /export\s+const\s+defaultLocale:\s*Locale\s*=\s*'([^']+)'/
  );
  if (!match) fail('Could not parse defaultLocale from config.ts');
  return match[1];
}

function parseRecordKeys(source, varName) {
  const regex = new RegExp(
    `export\\s+const\\s+${varName}\\s*:\\s*Record<[^>]+>\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`
  );
  const match = source.match(regex);
  if (!match) {
    fail(`Could not parse ${varName} from source`);
  }

  return Array.from(
    match[1].matchAll(/(?:'([^']+)'|([a-zA-Z][a-zA-Z0-9_-]*))\s*:/g)
  )
    .map(m => m[1] || m[2])
    .filter(Boolean);
}

const locales = parseStringArray(configSource, 'locales');
const defaultLocale = parseDefaultLocale(configSource);
const localeMarketKeys = parseRecordKeys(configSource, 'localeMarkets');
const seoIndexablePaths = parseStringArray(routesSource, 'seoIndexablePaths');

assert(
  Array.isArray(locales) && locales.length > 0,
  'locales[] must be defined and non-empty'
);
assert(
  locales.includes(defaultLocale),
  'defaultLocale must exist in locales[]'
);

for (const locale of locales) {
  assert(
    localeMarketKeys.includes(locale),
    `Missing localeMarkets entry for ${locale}`
  );
}

assert(
  configSource.includes('export const localeToSeoHreflang') &&
    configSource.includes('locales.map(locale =>') &&
    configSource.includes('market.seoCountry'),
  'localeToSeoHreflang generator is missing or malformed'
);

const hreflangSet = new Set();
for (const locale of locales) {
  const marketBlockRegex = new RegExp(
    `(?:'${locale}'|${locale})\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?`,
    'm'
  );
  const marketBlock = configSource.match(marketBlockRegex)?.[1] ?? '';
  const seoLanguage = marketBlock.match(/seoLanguage:\s*'([^']+)'/)?.[1];
  const seoCountry = marketBlock.match(/seoCountry:\s*'([^']+)'/)?.[1];
  assert(
    Boolean(seoLanguage),
    `Missing seoLanguage in localeMarkets for ${locale}`
  );
  const hreflang = seoCountry ? `${seoLanguage}-${seoCountry}` : seoLanguage;
  assert(!hreflangSet.has(hreflang), `Duplicate hreflang value: ${hreflang}`);
  hreflangSet.add(hreflang);

  const language = locale.split('-')[0];
  const baseMessagePath = path.join(messagesRoot, `${language}.json`);
  const localeMessagePath = path.join(messagesRoot, `${locale}.json`);
  const localeOverridePath = path.join(messagesRoot, `${locale}.override.json`);

  const hasBase = fs.existsSync(baseMessagePath);
  const hasLocale = fs.existsSync(localeMessagePath);
  const hasOverride = fs.existsSync(localeOverridePath);

  assert(
    hasBase || hasLocale || hasOverride,
    `No message source found for locale ${locale}. Expected one of: ${path.basename(baseMessagePath)}, ${path.basename(localeMessagePath)}, ${path.basename(localeOverridePath)}`
  );
}

const routeSet = new Set();
for (const route of seoIndexablePaths) {
  assert(
    route === '' || route.startsWith('/'),
    `Invalid SEO route "${route}" (must be '' or start with /)`
  );
  assert(
    !routeSet.has(route),
    `Duplicate SEO route in seoIndexablePaths: ${route}`
  );
  routeSet.add(route);
}

console.log(
  `[localization-seo] OK: ${locales.length} locales, ${seoIndexablePaths.length} indexable routes validated.`
);
