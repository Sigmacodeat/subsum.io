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
    .filter(f => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));
}

const files = getStagedFiles();
if (files.length === 0) {
  process.exit(0);
}

const quoted = files.map(f => JSON.stringify(f)).join(' ');

try {
  run(`oxlint --deny-warnings ${quoted}`);
} catch {
  console.error('\n[pre-commit] oxlint failed on staged files. Fix above errors and retry.');
  process.exit(1);
}
