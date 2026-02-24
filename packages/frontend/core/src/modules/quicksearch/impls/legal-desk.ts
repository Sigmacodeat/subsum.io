import { DateTimeIcon, FolderIcon, PageIcon } from '@blocksuite/icons/rc';
import { Entity, LiveData } from '@toeverything/infra';
import Fuse from 'fuse.js';

import type { CaseAssistantService } from '../../case-assistant/services/case-assistant';
import type { LegalCopilotWorkflowService } from '../../case-assistant/services/legal-copilot-workflow';
import type {
  AnwaltProfile,
  CaseDeadline,
  ClientRecord,
  LegalDocumentRecord,
  MatterRecord,
} from '../../case-assistant/types';
import type { QuickSearchSession } from '../providers/quick-search-provider';
import type { QuickSearchGroup } from '../types/group';
import type { QuickSearchItem } from '../types/item';

export type LegalDeskResultKind = 'client' | 'matter' | 'legal-doc' | 'deadline' | 'anwalt';

export interface LegalDeskPayload {
  kind: LegalDeskResultKind;
  clientId?: string;
  matterId?: string;
  docId?: string;
  deadlineId?: string;
  anwaltId?: string;
  label: string;
  subLabel?: string;
}

const groupClients: QuickSearchGroup = {
  id: 'legal-clients',
  label: { key: 'Mandanten' } as any,
  score: 20,
};

const groupMatters: QuickSearchGroup = {
  id: 'legal-matters',
  label: { key: 'Akten' } as any,
  score: 18,
};

const groupDocs: QuickSearchGroup = {
  id: 'legal-docs',
  label: { key: 'Rechtsdokumente' } as any,
  score: 15,
};

const groupDeadlines: QuickSearchGroup = {
  id: 'legal-deadlines',
  label: { key: 'Fristen & Termine' } as any,
  score: 22,
};

const groupAnwaelte: QuickSearchGroup = {
  id: 'legal-anwaelte',
  label: { key: 'Anwälte' } as any,
  score: 12,
};

function highlight(text: string, indices: readonly [number, number][]): string {
  if (!indices.length) {
    return text;
  }
  let result = '';
  let cursor = 0;
  for (const [start, end] of indices) {
    result += text.slice(cursor, start);
    result += '<b>' + text.slice(start, end + 1) + '</b>';
    cursor = end + 1;
  }
  result += text.slice(cursor);
  return result;
}

interface FlatClient {
  id: string;
  displayName: string;
  primaryEmail: string;
  primaryPhone: string;
  tags: string;
  kind: string;
  _raw: ClientRecord;
}

interface FlatMatter {
  id: string;
  title: string;
  externalRef: string;
  description: string;
  tags: string;
  status: string;
  clientName: string;
  clientId: string;
  gericht: string;
  _raw: MatterRecord;
}

interface FlatDeadline {
  id: string;
  title: string;
  dueAt: string;
  status: string;
  caseTitle: string;
  matterTitle: string;
  daysUntil: number;
}

interface FlatAnwalt {
  id: string;
  fullName: string;
  fachgebiet: string;
  email: string;
  role: string;
  zulassungsnummer: string;
}

function daysUntilDate(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function formatDeadlineUrgency(days: number): string {
  if (days < 0) return `${Math.abs(days)}d überfällig ⚠`;
  if (days === 0) return 'Heute fällig ⚠';
  if (days <= 3) return `in ${days}d — dringend`;
  if (days <= 7) return `in ${days} Tagen`;
  if (days <= 30) return `in ${days} Tagen`;
  return new Date(Date.now() + days * 86400000).toLocaleDateString('de-DE');
}

interface FlatDoc {
  id: string;
  title: string;
  internalFileNumber: string;
  paragraphReferences: string;
  tags: string;
  kind: string;
  caseId: string;
  _raw: LegalDocumentRecord;
}

export class LegalDeskQuickSearchSession
  extends Entity
  implements QuickSearchSession<'legal-desk', LegalDeskPayload>
{
  constructor(
    private readonly caseAssistantService: CaseAssistantService,
    private readonly legalCopilotWorkflowService: LegalCopilotWorkflowService
  ) {
    super();
  }

  private readonly query$ = new LiveData('');

  isLoading$ = new LiveData(false);
  error$ = new LiveData<any>(null);

  items$: LiveData<QuickSearchItem<'legal-desk', LegalDeskPayload>[]> =
    LiveData.computed(get => {
      const query = get(this.query$).trim().toLowerCase();
      const graph = get(this.caseAssistantService.graph$);
      const legalDocs = get(this.legalCopilotWorkflowService.legalDocuments$) ?? [];

      if (!query || query.length < 1) {
        return [];
      }

      const clients: ClientRecord[] = Object.values(graph?.clients ?? {});
      const matters: MatterRecord[] = Object.values(graph?.matters ?? {});

      const clientMap = new Map<string, ClientRecord>(
        clients.map(c => [c.id, c])
      );

      const results: QuickSearchItem<'legal-desk', LegalDeskPayload>[] = [];

      // ── Clients ──────────────────────────────────────────────────────────
      const flatClients: FlatClient[] = clients.map(c => ({
        id: c.id,
        displayName: c.displayName,
        primaryEmail: c.primaryEmail ?? '',
        primaryPhone: c.primaryPhone ?? '',
        tags: (c.tags ?? []).join(' '),
        kind: c.kind,
        _raw: c,
      }));

      const fuseClients = new Fuse(flatClients, {
        keys: [
          { name: 'displayName', weight: 3 },
          { name: 'primaryEmail', weight: 1.5 },
          { name: 'primaryPhone', weight: 1 },
          { name: 'tags', weight: 1 },
        ],
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.35,
        minMatchCharLength: 1,
      });

      const clientResults = fuseClients.search(query);
      for (const { item, matches, score = 1 } of clientResults) {
        const titleMatch = matches?.find(m => m.key === 'displayName');
        const titleIndices = titleMatch?.indices ?? [];
        const subText = item.primaryEmail || item.primaryPhone || item.kind;

        results.push({
          id: 'legal-desk:client:' + item.id,
          source: 'legal-desk',
          group: groupClients,
          label: {
            title: highlight(item.displayName, titleIndices as [number, number][]),
            subTitle: subText,
          },
          score: 1 - score,
          icon: PageIcon,
          payload: {
            kind: 'client',
            clientId: item.id,
            label: item.displayName,
            subLabel: subText,
          },
        });
      }

      // ── Matters ───────────────────────────────────────────────────────────
      const flatMatters: FlatMatter[] = matters.map(m => ({
        id: m.id,
        title: m.title,
        externalRef: m.externalRef ?? '',
        description: m.description ?? '',
        tags: (m.tags ?? []).join(' '),
        status: m.status,
        clientName: clientMap.get(m.clientId)?.displayName ?? '',
        clientId: m.clientId,
        gericht: m.gericht ?? '',
        _raw: m,
      }));

      const fuseMatters = new Fuse(flatMatters, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'externalRef', weight: 3 },
          { name: 'clientName', weight: 2 },
          { name: 'gericht', weight: 2 },
          { name: 'description', weight: 1 },
          { name: 'tags', weight: 1 },
        ],
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.35,
        minMatchCharLength: 1,
      });

      const matterResults = fuseMatters.search(query);
      for (const { item, matches, score = 1 } of matterResults) {
        const titleMatch = matches?.find(m => m.key === 'title');
        const titleIndices = titleMatch?.indices ?? [];
        const refPart = item.externalRef ? `AZ: ${item.externalRef}` : '';
        const clientPart = item.clientName ? `Mandant: ${item.clientName}` : '';
        const subLabel = [refPart, clientPart].filter(Boolean).join(' · ');

        results.push({
          id: 'legal-desk:matter:' + item.id,
          source: 'legal-desk',
          group: groupMatters,
          label: {
            title: highlight(item.title, titleIndices as [number, number][]),
            subTitle: subLabel || item.status,
          },
          score: 1 - score,
          icon: FolderIcon,
          payload: {
            kind: 'matter',
            matterId: item.id,
            clientId: item.clientId,
            label: item.title,
            subLabel,
          },
        });
      }

      // ── Legal Documents ───────────────────────────────────────────────────
      const flatDocs: FlatDoc[] = legalDocs.map(d => ({
        id: d.id,
        title: d.title,
        internalFileNumber: d.internalFileNumber ?? '',
        paragraphReferences: (d.paragraphReferences ?? []).join(' '),
        tags: (d.tags ?? []).join(' '),
        kind: d.kind,
        caseId: d.caseId,
        _raw: d,
      }));

      const fuseDocs = new Fuse(flatDocs, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'internalFileNumber', weight: 2.5 },
          { name: 'paragraphReferences', weight: 1.5 },
          { name: 'tags', weight: 1 },
          { name: 'kind', weight: 0.5 },
        ],
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.35,
        minMatchCharLength: 1,
      });

      const docResults = fuseDocs.search(query);
      for (const { item, matches, score = 1 } of docResults) {
        const titleMatch = matches?.find(m => m.key === 'title');
        const titleIndices = titleMatch?.indices ?? [];
        const subParts: string[] = [];
        if (item.internalFileNumber) {
          subParts.push(`AZ: ${item.internalFileNumber}`);
        }
        if (item.kind) {
          subParts.push(item.kind);
        }

        results.push({
          id: 'legal-desk:doc:' + item.id,
          source: 'legal-desk',
          group: groupDocs,
          label: {
            title: highlight(item.title || 'Unbenanntes Dokument', titleIndices as [number, number][]),
            subTitle: subParts.join(' · ') || undefined,
          },
          score: 1 - score,
          icon: PageIcon,
          payload: {
            kind: 'legal-doc',
            docId: item.id,
            matterId: graph?.cases?.[item.caseId]?.matterId,
            label: item.title,
            subLabel: subParts.join(' · '),
          },
        });
      }

      // ── Deadlines / Fristen ─────────────────────────────────────────────
      const allDeadlines: CaseDeadline[] = Object.values(graph?.deadlines ?? {});
      const caseFiles = Object.values(graph?.cases ?? {});
      const matterMap = new Map<string, MatterRecord>(matters.map(m => [m.id, m]));

      // Build deadline → case/matter title lookup
      const deadlineCaseMap = new Map<string, { caseTitle: string; matterTitle: string }>();
      for (const c of caseFiles) {
        const matter = c.matterId ? matterMap.get(c.matterId) : undefined;
        for (const dId of c.deadlineIds ?? []) {
          deadlineCaseMap.set(dId, {
            caseTitle: c.title ?? c.id,
            matterTitle: matter?.title ?? '',
          });
        }
      }

      const flatDeadlines: FlatDeadline[] = allDeadlines
        .filter(d => d.dueAt && d.status !== 'completed' && d.status !== 'expired')
        .map(d => {
          const ctx = deadlineCaseMap.get(d.id) ?? { caseTitle: '', matterTitle: '' };
          return {
            id: d.id,
            title: d.title,
            dueAt: d.dueAt,
            status: d.status,
            caseTitle: ctx.caseTitle,
            matterTitle: ctx.matterTitle,
            daysUntil: daysUntilDate(d.dueAt),
          };
        });

      const fuseDeadlines = new Fuse(flatDeadlines, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'caseTitle', weight: 2 },
          { name: 'matterTitle', weight: 2 },
        ],
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.4,
        minMatchCharLength: 1,
      });

      const deadlineResults = fuseDeadlines.search(query);
      for (const { item, matches, score = 1 } of deadlineResults) {
        const titleMatch = matches?.find(m => m.key === 'title');
        const titleIndices = titleMatch?.indices ?? [];
        const urgency = formatDeadlineUrgency(item.daysUntil);
        const subParts: string[] = [urgency];
        if (item.matterTitle) subParts.push(item.matterTitle);

        results.push({
          id: 'legal-desk:deadline:' + item.id,
          source: 'legal-desk',
          group: groupDeadlines,
          label: {
            title: highlight(item.title, titleIndices as [number, number][]),
            subTitle: subParts.join(' · '),
          },
          score: (1 - score) + (item.daysUntil <= 3 ? 0.3 : item.daysUntil <= 7 ? 0.15 : 0),
          icon: DateTimeIcon,
          payload: {
            kind: 'deadline',
            deadlineId: item.id,
            label: item.title,
            subLabel: subParts.join(' · '),
          },
        });
      }

      // ── Anwälte ─────────────────────────────────────────────────────────
      const allAnwaelte: AnwaltProfile[] = Object.values(graph?.anwaelte ?? {});

      const flatAnwaelte: FlatAnwalt[] = allAnwaelte
        .filter(a => a.isActive !== false)
        .map(a => ({
          id: a.id,
          fullName: `${a.title ? a.title + ' ' : ''}${a.firstName} ${a.lastName}`,
          fachgebiet: a.fachgebiet ?? '',
          email: a.email ?? '',
          role: a.role ?? '',
          zulassungsnummer: a.zulassungsnummer ?? '',
        }));

      const fuseAnwaelte = new Fuse(flatAnwaelte, {
        keys: [
          { name: 'fullName', weight: 3 },
          { name: 'fachgebiet', weight: 2 },
          { name: 'email', weight: 1 },
          { name: 'zulassungsnummer', weight: 1 },
        ],
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.35,
        minMatchCharLength: 1,
      });

      const anwaltResults = fuseAnwaelte.search(query);
      for (const { item, matches, score = 1 } of anwaltResults) {
        const nameMatch = matches?.find(m => m.key === 'fullName');
        const nameIndices = nameMatch?.indices ?? [];
        const subParts: string[] = [];
        if (item.fachgebiet) subParts.push(item.fachgebiet);
        if (item.email) subParts.push(item.email);

        results.push({
          id: 'legal-desk:anwalt:' + item.id,
          source: 'legal-desk',
          group: groupAnwaelte,
          label: {
            title: highlight(item.fullName, nameIndices as [number, number][]),
            subTitle: subParts.join(' · ') || item.role,
          },
          score: 1 - score,
          icon: PageIcon,
          payload: {
            kind: 'anwalt',
            anwaltId: item.id,
            label: item.fullName,
            subLabel: subParts.join(' · '),
          },
        });
      }

      // Sort by score descending, then apply per-group caps to avoid one noisy
      // entity type dominating the top results.
      const GROUP_CAPS: Record<string, number> = {
        'legal-clients': 5,
        'legal-matters': 5,
        'legal-docs': 5,
        'legal-deadlines': 6,
        'legal-anwaelte': 4,
      };

      results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      const groupedCounts: Record<string, number> = {};
      const merged: QuickSearchItem<'legal-desk', LegalDeskPayload>[] = [];

      for (const item of results) {
        const groupId = item.group?.id ?? 'ungrouped';
        const cap = GROUP_CAPS[groupId] ?? 4;
        const used = groupedCounts[groupId] ?? 0;
        if (used >= cap) continue;
        groupedCounts[groupId] = used + 1;
        merged.push(item);
        if (merged.length >= 20) break;
      }

      return merged;
    });

  query(q: string) {
    this.query$.next(q);
  }
}
