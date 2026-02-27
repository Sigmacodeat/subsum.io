import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const configPath = path.join(repoRoot, 'scripts/domain-policy.config.json');

const FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.yml',
  '.yaml',
  '.md',
]);
const URL_PATTERN = /https?:\/\/[^\s"'`)<]+/g;

function normalizeHost(host) {
  return host.toLowerCase().replace(/\.$/, '');
}

function hostMatchesSuffix(host, suffix) {
  const h = normalizeHost(host);
  const s = normalizeHost(suffix);
  return h === s || h.endsWith(`.${s}`);
}

function walkFiles(absolutePath) {
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [absolutePath];

  const out = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Domain policy config missing: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const config = loadConfig();
const forbiddenHostSuffixes = config.forbiddenHostSuffixes ?? [];
const scopeEntries = Object.entries(config.scopes ?? {});

const violations = [];

for (const [scopeName, scope] of scopeEntries) {
  const targets = scope.targets ?? [];
  const allowedHostSuffixes = scope.allowedHostSuffixes ?? [];
  const ignoredHostSuffixes = scope.ignoredHostSuffixes ?? [];

  for (const target of targets) {
    const absoluteTarget = path.join(repoRoot, target);
    if (!fs.existsSync(absoluteTarget)) continue;

    const files = walkFiles(absoluteTarget);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');

      for (const match of source.matchAll(URL_PATTERN)) {
        const rawUrl = match[0].replace(/[.,;:!?]+$/, '');
        let parsed;
        try {
          parsed = new URL(rawUrl);
        } catch {
          continue;
        }

        const host = normalizeHost(parsed.hostname);

        const ignored = ignoredHostSuffixes.some(s =>
          hostMatchesSuffix(host, s)
        );
        if (ignored) {
          continue;
        }

        const hitsForbidden = forbiddenHostSuffixes.some(s =>
          hostMatchesSuffix(host, s)
        );
        if (hitsForbidden) {
          violations.push({
            scope: scopeName,
            file: path.relative(repoRoot, file),
            line: lineNumberAt(source, match.index ?? 0),
            reason: 'forbidden_host',
            value: rawUrl,
          });
          continue;
        }

        const allowed = allowedHostSuffixes.some(s =>
          hostMatchesSuffix(host, s)
        );
        if (!allowed) {
          violations.push({
            scope: scopeName,
            file: path.relative(repoRoot, file),
            line: lineNumberAt(source, match.index ?? 0),
            reason: 'host_not_in_scope_allowlist',
            value: rawUrl,
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    '\n[domain-policy] ERROR: external domain policy violations found:\n'
  );
  for (const v of violations) {
    console.error(
      `- [${v.scope}] ${v.file}:${v.line} (${v.reason}) -> ${v.value}`
    );
  }
  console.error(
    '\nUpdate scripts/domain-policy.config.json allowlists only for intentional trusted domains.\n'
  );
  process.exit(1);
}

console.log(
  '[domain-policy] OK: all scoped external URLs comply with platform allowlists.'
);
