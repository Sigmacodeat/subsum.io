import { execSync } from 'node:child_process';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function getStagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(f => !f.split('/').some(seg => seg.startsWith('.')))
    .filter(f => /\.(ts|tsx|js|jsx|mjs)$/.test(f));
}

const files = getStagedFiles();
if (files.length === 0) {
  process.exit(0);
}

// Run eslint in a memory-safe way (single process) against staged files only.
// Note: eslint ignores unknown files; we already filter extensions.
const quoted = files.map(f => JSON.stringify(f)).join(' ');

try {
  run(
    `cross-env NODE_OPTIONS="--max-old-space-size=8192" eslint --cache --max-warnings=0 ${quoted}`
  );
} catch {
  // If eslint ever crashes (OOM or otherwise), fail the commit with a clear message.
  console.error(
    '\n[pre-commit] ESLint failed on staged files. Fix above errors and retry.'
  );
  process.exit(1);
}
