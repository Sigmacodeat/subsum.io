import type { ChatArtifact } from '../types';

const DEFAULT_CHAT_UPLOAD_FOLDER_PATH = '/akte/eingang/chat';

export function resolveChatUploadFolderPath(folderPath?: string): string {
  const trimmed = folderPath?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : DEFAULT_CHAT_UPLOAD_FOLDER_PATH;
}

export function resolveArtifactRepositoryRoute(
  artifact: Pick<ChatArtifact, 'kind' | 'templateName'>
): {
  folderPath: string;
  tags: string[];
} {
  const template = (artifact.templateName ?? '').toLowerCase();
  const isKnowledgeArtifact =
    artifact.kind === 'analyse' ||
    artifact.kind === 'zusammenfassung' ||
    template.includes('wissens') ||
    template.includes('knowledge');

  if (isKnowledgeArtifact) {
    return {
      folderPath: '/knowledge/copilot',
      tags: ['chat-artifact', 'generated-document', 'knowledge-base'],
    };
  }

  if (artifact.kind === 'schriftsatz') {
    return {
      folderPath: '/akte/schriftsaetze',
      tags: ['chat-artifact', 'generated-document', 'schriftsatz'],
    };
  }

  return {
    folderPath: '/akte/generiert',
    tags: ['chat-artifact', 'generated-document'],
  };
}
