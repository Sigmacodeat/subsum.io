import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());

const SCOPES = {
  marketing_next: [
    'src',
    'packages/frontend/apps/marketing/src',
    'packages/frontend/apps/marketing/scripts',
  ],
  frontend_core: ['packages/frontend/core/src', 'packages/frontend/component/src'],
  backend_server: ['packages/backend/server/src'],
  electron: ['packages/frontend/apps/electron/src', 'packages/frontend/apps/electron/scripts'],
};

const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const ENV_RE = /process\.env\.([A-Z0-9_]+)/g;

function walkFiles(absPath) {
  if (!fs.existsSync(absPath)) return [];
  const stat = fs.statSync(absPath);
  if (stat.isFile()) return [absPath];

  const out = [];
  for (const entry of fs.readdirSync(absPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(absPath, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.next' ||
        entry.name === 'build' ||
        entry.name === 'coverage'
      ) {
        continue;
      }
      out.push(...walkFiles(full));
      continue;
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function scanScope(scopeName, roots) {
  const vars = new Map();

  for (const relRoot of roots) {
    const absRoot = path.join(repoRoot, relRoot);
    for (const file of walkFiles(absRoot)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(ENV_RE)) {
        const name = match[1];
        const list = vars.get(name) ?? [];
        if (list.length < 3) {
          list.push(path.relative(repoRoot, file));
        }
        vars.set(name, list);
      }
    }
  }

  return vars;
}

const result = {};
for (const [scopeName, roots] of Object.entries(SCOPES)) {
  const vars = scanScope(scopeName, roots);
  result[scopeName] = Object.fromEntries(
    [...vars.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );
}

console.log(JSON.stringify(result, null, 2));
