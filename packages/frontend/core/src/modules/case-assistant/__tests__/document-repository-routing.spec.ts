import { describe, expect, test } from 'vitest';

import {
  resolveArtifactRepositoryRoute,
  resolveChatUploadFolderPath,
} from '../services/document-repository-routing';

describe('document repository routing', () => {
  test('uses default chat intake folder when folderPath is missing', () => {
    expect(resolveChatUploadFolderPath()).toBe('/akte/eingang/chat');
    expect(resolveChatUploadFolderPath('   ')).toBe('/akte/eingang/chat');
  });

  test('keeps provided chat upload folderPath', () => {
    expect(resolveChatUploadFolderPath('/akte/eingang/scans')).toBe(
      '/akte/eingang/scans'
    );
  });

  test('routes schriftsatz artifacts to centralized schriftsatz repository', () => {
    const route = resolveArtifactRepositoryRoute({
      kind: 'schriftsatz',
      templateName: 'Klageschrift',
    });

    expect(route.folderPath).toBe('/akte/schriftsaetze');
    expect(route.tags).toContain('schriftsatz');
  });

  test('routes knowledge-like artifacts to knowledge repository', () => {
    const route = resolveArtifactRepositoryRoute({
      kind: 'analyse',
      templateName: 'Knowledge Summary',
    });

    expect(route.folderPath).toBe('/knowledge/copilot');
    expect(route.tags).toContain('knowledge-base');
  });
});
