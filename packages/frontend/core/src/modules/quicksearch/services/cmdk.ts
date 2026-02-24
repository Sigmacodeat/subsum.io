import { track } from '@affine/track';
import { Service } from '@toeverything/infra';

import type { DocsService } from '../../doc';
import type { WorkbenchService } from '../../workbench';
import { CollectionsQuickSearchSession } from '../impls/collections';
import { CommandsQuickSearchSession } from '../impls/commands';
import { CreationQuickSearchSession } from '../impls/creation';
import { DocsQuickSearchSession } from '../impls/docs';
import { LegalDeskQuickSearchSession } from '../impls/legal-desk';
import { LinksQuickSearchSession } from '../impls/links';
import { RecentDocsQuickSearchSession } from '../impls/recent-docs';
import { TagsQuickSearchSession } from '../impls/tags';
import type { QuickSearchService } from './quick-search';

export class CMDKQuickSearchService extends Service {
  constructor(
    private readonly quickSearchService: QuickSearchService,
    private readonly workbenchService: WorkbenchService,
    private readonly docsService: DocsService
  ) {
    super();
  }

  toggle() {
    if (this.quickSearchService.quickSearch.show$.value) {
      this.quickSearchService.quickSearch.hide();
    } else {
      this.quickSearchService.quickSearch.show(
        [
          this.framework.createEntity(RecentDocsQuickSearchSession),
          this.framework.createEntity(CollectionsQuickSearchSession),
          this.framework.createEntity(CommandsQuickSearchSession),
          this.framework.createEntity(CreationQuickSearchSession),
          this.framework.createEntity(DocsQuickSearchSession),
          this.framework.createEntity(LinksQuickSearchSession),
          this.framework.createEntity(TagsQuickSearchSession),
          this.framework.createEntity(LegalDeskQuickSearchSession),
        ],
        result => {
          if (!result) {
            return;
          }

          if (result.source === 'commands') {
            result.payload.run()?.catch(err => {
              console.error(err);
            });
            return;
          }

          if (result.source === 'link') {
            const { docId, blockIds, elementIds, mode } = result.payload;
            this.workbenchService.workbench.openDoc({
              docId,
              blockIds,
              elementIds,
              mode,
            });
            return;
          }

          if (result.source === 'recent-doc' || result.source === 'docs') {
            const doc: {
              docId?: string;
              blockId?: string;
            } = result.payload;

            if (!doc.docId) {
              return;
            }

            result.source === 'recent-doc' && track.$.cmdk.recent.recentDocs();
            result.source === 'docs' &&
              track.$.cmdk.results.searchResultsDocs();

            const options: { docId: string; blockIds?: string[] } = {
              docId: doc.docId,
            };

            if (doc.blockId) {
              options.blockIds = [doc.blockId];
            }

            this.workbenchService.workbench.openDoc(options);
            return;
          }

          if (result.source === 'collections') {
            this.workbenchService.workbench.openCollection(
              result.payload.collectionId
            );
            return;
          }

          if (result.source === 'tags') {
            this.workbenchService.workbench.openTag(result.payload.tagId);
            return;
          }

          if (result.source === 'creation') {
            if (result.id === 'creation:create-page') {
              const newDoc = this.docsService.createDoc({
                primaryMode: 'page',
                title: result.payload.title,
              });

              this.workbenchService.workbench.openDoc(newDoc.id);
            } else if (result.id === 'creation:create-edgeless') {
              const newDoc = this.docsService.createDoc({
                primaryMode: 'edgeless',
                title: result.payload.title,
              });
              this.workbenchService.workbench.openDoc(newDoc.id);
            }
            return;
          }

          if (result.source === 'legal-desk') {
            this._handleLegalDeskResult(result.payload);
            return;
          }
        },
        {
          placeholder: {
            i18nKey: 'com.affine.cmdk.docs.placeholder',
          },
        }
      );
    }
  }

  /**
   * Opens a legal-desk-scoped quick search that only searches across
   * Mandanten, Akten, and Rechtsdokumente. Used by the dedicated
   * "Akten-Suche" sidebar button.
   */
  toggleLegalDesk() {
    if (this.quickSearchService.quickSearch.show$.value) {
      this.quickSearchService.quickSearch.hide();
    } else {
      this.quickSearchService.quickSearch.show(
        [this.framework.createEntity(LegalDeskQuickSearchSession)],
        result => {
          if (!result) {
            return;
          }
          if (result.source === 'legal-desk') {
            this._handleLegalDeskResult(result.payload);
          }
        },
        {
          label: {
            key: 'Akten-Suche',
          } as any,
          placeholder: {
            key: 'Mandant, Aktenzahl, Stichwort …',
          } as any,
        }
      );
    }
  }

  private _handleLegalDeskResult(payload: {
    kind: string;
    clientId?: string;
    matterId?: string;
    docId?: string;
    label: string;
  }) {
    const params = new URLSearchParams();
    if (payload.matterId) {
      params.set('caMatterId', payload.matterId);
    }
    if (payload.clientId) {
      params.set('caClientId', payload.clientId);
    }
    if (params.size > 0) {
      this.workbenchService.workbench.open(`/chat?${params.toString()}`);
    }
  }
}
