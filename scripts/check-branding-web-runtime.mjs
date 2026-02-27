import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const TARGETS = [
  'deploy/api-vercel/api/graphql.ts',
  'packages/frontend/component/src/components/affine-other-page-layout',
  'packages/frontend/component/src/components/page-detail-skeleton',
  'packages/frontend/component/src/components/import-page',
  'packages/frontend/core/src/desktop/pages/auth',
  'packages/frontend/core/src/components/sign-in',
  'packages/frontend/core/src/components/hooks/affine/use-selfhost-login-version-guard.tsx',
  'packages/frontend/core/src/modules/open-in-app/views/open-in-app-page.tsx',
  'packages/frontend/core/src/modules/template-doc/view/template-list-menu.tsx',
  'packages/frontend/core/src/mobile/dialogs/setting/others/index.tsx',
  'packages/frontend/core/src/components/affine/ai-onboarding',
  'packages/frontend/core/src/components/affine/onboarding/articles/blog-link.tsx',
  'packages/frontend/core/src/components/root-app-sidebar/index.tsx',
  'packages/frontend/core/src/desktop/pages/workspace/share',
  'packages/frontend/core/src/desktop/dialogs/setting/general-setting/about/index.tsx',
  'packages/frontend/core/src/desktop/dialogs/setting/general-setting/plans/ai/ai-plan.tsx',
];

const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);
const FORBIDDEN_DOMAIN_PATTERNS = [
  /https?:\/\/[^\s"'`)]*affine\.(?:pro|site)[^\s"'`)]*/gi,
  /https?:\/\/[^\s"'`)]*subsumio\.ai[^\s"'`)]*/gi,
];

function walkFiles(absolutePath) {
  const stats = fs.statSync(absolutePath);
  if (stats.isFile()) {
    return [absolutePath];
  }

  const results = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      results.push(...walkFiles(path.join(absolutePath, entry.name)));
      continue;
    }

    const ext = path.extname(entry.name);
    if (FILE_EXTENSIONS.has(ext)) {
      results.push(path.join(absolutePath, entry.name));
    }
  }

  return results;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

const findings = [];

for (const target of TARGETS) {
  const absolute = path.join(repoRoot, target);
  if (!fs.existsSync(absolute)) continue;

  for (const file of walkFiles(absolute)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_DOMAIN_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        findings.push({
          file: path.relative(repoRoot, file),
          line: lineNumberAt(source, match.index ?? 0),
          value: match[0],
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error(
    '\n[branding-check] ERROR: forbidden branding domains found in web runtime scope:\n'
  );
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} -> ${finding.value}`);
  }
  console.error(
    '\nAllowed production branding domains in this scope should point to official subsumio.com destinations.\n'
  );
  process.exit(1);
}

console.log(
  '[branding-check] OK: no forbidden affine.pro/affine.site/subsumio.ai domains in guarded web runtime scope.'
);
