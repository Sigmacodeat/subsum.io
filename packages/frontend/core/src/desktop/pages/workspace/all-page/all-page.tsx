import { Button, usePromptModal } from '@affine/component';
import {
  createDocExplorerContext,
  DocExplorerContext,
} from '@affine/core/components/explorer/context';
import { DocsExplorer } from '@affine/core/components/explorer/docs-view/docs-list';
import type { ExplorerDisplayPreference } from '@affine/core/components/explorer/types';
import { Filters } from '@affine/core/components/filter';
import { CaseAssistantStore } from '@affine/core/modules/case-assistant/stores/case-assistant';
import {
  CollectionService,
  PinnedCollectionService,
} from '@affine/core/modules/collection';
import { CollectionRulesService } from '@affine/core/modules/collection-rules';
import type { FilterParams } from '@affine/core/modules/collection-rules/types';
import { WorkspaceLocalState } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '../../../../modules/workbench';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './all-page.css';
import { AllDocsHeader } from './all-page-header';
import { MigrationAllDocsDataNotification } from './migration-data';
import { PinnedCollections } from './pinned-collections';

const DefaultDisplayPreference: {
  [key in ViewMode]: ExplorerDisplayPreference;
} = {
  grid: {
    view: 'grid',
    displayProperties: [
      'system:createdAt',
      'system:updatedAt',
      'system:createdBy',
      'system:tags',
    ],
    orderBy: {
      type: 'system',
      key: 'updatedAt',
      desc: true,
    },
    groupBy: undefined,
    showDocIcon: true,
    showDocPreview: true,
    quickFavorite: true,
    showDragHandle: true,
    showMoreOperation: true,
  },
  masonry: {
    view: 'masonry',
    displayProperties: [
      'system:createdAt',
      'system:updatedAt',
      'system:createdBy',
      'system:tags',
    ],
    orderBy: {
      type: 'system',
      key: 'updatedAt',
      desc: true,
    },
    groupBy: undefined,
    showDocIcon: true,
    showDocPreview: true,
    quickFavorite: true,
    showDragHandle: true,
    showMoreOperation: true,
  },
  list: {
    view: 'list',
    displayProperties: [
      'system:createdAt',
      'system:updatedAt',
      'system:createdBy',
      'system:tags',
    ],
    orderBy: {
      type: 'system',
      key: 'updatedAt',
      desc: true,
    },
    groupBy: {
      type: 'system',
      key: 'updatedAt',
    },
    showDocIcon: true,
    showDocPreview: true,
    quickFavorite: true,
    showDragHandle: true,
    showMoreOperation: true,
  },
};

type ViewMode = NonNullable<ExplorerDisplayPreference['view']>;
type AllDocsScope = 'all' | 'legal';

export const AllPage = () => {
  const t = useI18n();

  const collectionService = useService(CollectionService);
  const pinnedCollectionService = useService(PinnedCollectionService);
  const caseAssistantStore = useService(CaseAssistantStore);
  const {
    viewMode,
    setViewMode,
    selectedCollectionId,
    setSelectedCollectionId,
    displayPreference,
    setDisplayPreference,
    docsScope,
    setDocsScope,
  } = useAllDocsOptions();

  const caseGraph = useLiveData(caseAssistantStore.watchGraph());
  const legalLinkedPageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const matter of Object.values(caseGraph?.matters ?? {})) {
      for (const pageId of matter.linkedPageIds ?? []) {
        ids.add(pageId);
      }
    }
    return Array.from(ids);
  }, [caseGraph?.matters]);

  const isCollectionDataReady = useLiveData(
    collectionService.collectionDataReady$
  );

  const isPinnedCollectionDataReady = useLiveData(
    pinnedCollectionService.pinnedCollectionDataReady$
  );

  const pinnedCollections = useLiveData(
    pinnedCollectionService.pinnedCollections$
  );

  const selectedCollection = useLiveData(
    selectedCollectionId
      ? collectionService.collection$(selectedCollectionId)
      : null
  );

  useEffect(() => {
    // if selected collection is not in pinned collections, set selected collection id to null
    if (
      isPinnedCollectionDataReady &&
      selectedCollectionId &&
      !pinnedCollections.some(c => c.collectionId === selectedCollectionId)
    ) {
      setSelectedCollectionId(null);
    }
  }, [
    isPinnedCollectionDataReady,
    pinnedCollections,
    selectedCollectionId,
    setSelectedCollectionId,
  ]);

  useEffect(() => {
    // if selected collection is not found, set selected collection id to null
    if (!selectedCollection && selectedCollectionId && isCollectionDataReady) {
      setSelectedCollectionId(null);
    }
  }, [
    isCollectionDataReady,
    selectedCollection,
    selectedCollectionId,
    setSelectedCollectionId,
  ]);

  const selectedCollectionInfo = useLiveData(
    selectedCollection ? selectedCollection.info$ : null
  );

  const [tempFilters, setTempFilters] = useState<FilterParams[] | null>(null);
  const [tempFiltersInitial, setTempFiltersInitial] =
    useState<FilterParams | null>(null);

  useEffect(() => {
    if (docsScope === 'legal' && selectedCollectionId) {
      setSelectedCollectionId(null);
    }
    if (docsScope === 'legal' && tempFilters !== null) {
      setTempFilters(null);
    }
  }, [docsScope, selectedCollectionId, setSelectedCollectionId, tempFilters]);

  const [explorerContextValue] = useState(() =>
    createDocExplorerContext(displayPreference)
  );
  const selectMode = useLiveData(explorerContextValue.selectMode$);
  const selectedDocIds = useLiveData(explorerContextValue.selectedDocIds$);
  const groups = useLiveData(explorerContextValue.groups$);
  const allDocIds = useMemo(() => groups.flatMap(g => g.items), [groups]);

  useEffect(() => {
    explorerContextValue.displayPreference$.next(displayPreference);
  }, [displayPreference, explorerContextValue]);

  const groupBy = displayPreference.groupBy;
  const orderBy = displayPreference.orderBy;

  const { openPromptModal } = usePromptModal();

  const collectionRulesService = useService(CollectionRulesService);
  useEffect(() => {
    const defaultNonTrashFilters: FilterParams[] = [
      {
        type: 'system',
        key: 'trash',
        method: 'is',
        value: 'false',
      },
    ];
    const baseFilters = selectedCollectionInfo
      ? selectedCollectionInfo.rules.filters
      : tempFilters && tempFilters.length > 0
        ? tempFilters
        : defaultNonTrashFilters;

    const subscription = collectionRulesService
      .watch({
        // In legal scope we rely on extraAllowList (= linked Akte pages) as source set.
        filters: docsScope === 'legal' ? [] : baseFilters,
        groupBy,
        orderBy,
        extraAllowList:
          docsScope === 'legal'
            ? legalLinkedPageIds
            : selectedCollectionInfo?.allowList,
        extraFilters: [
          {
            type: 'system',
            key: 'empty-journal',
            method: 'is',
            value: 'false',
          },
          {
            type: 'system',
            key: 'trash',
            method: 'is',
            value: 'false',
          },
        ],
      })
      .subscribe({
        next: result => {
          explorerContextValue.groups$.next(result.groups);
        },
        error: error => {
          console.error(error);
        },
      });
    return () => {
      subscription.unsubscribe();
    };
  }, [
    collectionRulesService,
    explorerContextValue,
    groupBy,
    orderBy,
    selectedCollection,
    selectedCollectionInfo,
    tempFilters,
    docsScope,
    legalLinkedPageIds,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        explorerContextValue.selectMode$.next(false);
        explorerContextValue.selectedDocIds$.next([]);
        explorerContextValue.prevCheckAnchorId$.next(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [explorerContextValue]);

  const handleFilterChange = useCallback((filters: FilterParams[]) => {
    setTempFilters(filters);
  }, []);

  const handleSelectCollection = useCallback(
    (collectionId: string) => {
      setSelectedCollectionId(collectionId);
      setTempFilters(null);
    },
    [setSelectedCollectionId]
  );

  const handleSelectAll = useCallback(() => {
    setSelectedCollectionId(null);
    setTempFilters(null);
  }, [setSelectedCollectionId]);

  const handleSaveFilters = useCallback(() => {
    if (selectedCollectionId) {
      collectionService.updateCollection(selectedCollectionId, {
        rules: {
          filters: tempFilters ?? [],
        },
      });
      setTempFilters(null);
    } else {
      openPromptModal({
        title: t['com.affine.editCollection.saveCollection'](),
        label: t['com.affine.editCollectionName.name'](),
        inputOptions: {
          placeholder: t['com.affine.editCollectionName.name.placeholder'](),
        },
        children: t['com.affine.editCollectionName.createTips'](),
        confirmText: t['com.affine.editCollection.save'](),
        cancelText: t['com.affine.editCollection.button.cancel'](),
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm(name) {
          const id = collectionService.createCollection({
            name,
            rules: {
              filters: tempFilters ?? [],
            },
          });
          pinnedCollectionService.addPinnedCollection({
            collectionId: id,
            index: pinnedCollectionService.indexAt('after'),
          });
          setTempFilters(null);
          setSelectedCollectionId(id);
        },
      });
    }
  }, [
    collectionService,
    openPromptModal,
    pinnedCollectionService,
    selectedCollectionId,
    setSelectedCollectionId,
    t,
    tempFilters,
  ]);

  const handleNewTempFilter = useCallback(
    (params: FilterParams) => {
      setSelectedCollectionId(null);
      setTempFilters([]);
      setTempFiltersInitial(params);
    },
    [setSelectedCollectionId]
  );

  const handleDisplayPreferenceChange = useCallback(
    (displayPreference: ExplorerDisplayPreference) => {
      setDisplayPreference(displayPreference);
    },
    [setDisplayPreference]
  );

  const handleToggleSelectMode = useCallback(() => {
    if (explorerContextValue.selectMode$.value) {
      explorerContextValue.selectMode$.next(false);
      explorerContextValue.selectedDocIds$.next([]);
      explorerContextValue.prevCheckAnchorId$.next(null);
      return;
    }
    explorerContextValue.selectMode$.next(true);
  }, [explorerContextValue]);

  const handleSelectAllDocs = useCallback(() => {
    const currentSelected = explorerContextValue.selectedDocIds$.value;
    if (currentSelected.length === allDocIds.length && allDocIds.length > 0) {
      explorerContextValue.selectedDocIds$.next([]);
    } else {
      explorerContextValue.selectedDocIds$.next([...allDocIds]);
      if (!explorerContextValue.selectMode$.value) {
        explorerContextValue.selectMode$.next(true);
      }
    }
  }, [explorerContextValue, allDocIds]);

  return (
    <DocExplorerContext.Provider value={explorerContextValue}>
      <ViewTitle title={t['All pages']()} />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <AllDocsHeader
          displayPreference={displayPreference}
          onDisplayPreferenceChange={handleDisplayPreferenceChange}
          view={viewMode}
          onViewChange={setViewMode}
          selectMode={!!selectMode}
          selectedCount={selectedDocIds.length}
          totalCount={allDocIds.length}
          onToggleSelectMode={handleToggleSelectMode}
          onSelectAll={handleSelectAllDocs}
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.body}>
          <MigrationAllDocsDataNotification />
          <div className={styles.topControls}>
            <div
              className={styles.scopeToggle}
              role="tablist"
              aria-label="Dokumentumfang"
            >
              <button
                type="button"
                className={styles.scopeToggleButton}
                data-active={docsScope === 'all'}
                role="tab"
                aria-selected={docsScope === 'all'}
                onClick={() => setDocsScope('all')}
              >
                Alle Dokumente
              </button>
              <button
                type="button"
                className={styles.scopeToggleButton}
                data-active={docsScope === 'legal'}
                role="tab"
                aria-selected={docsScope === 'legal'}
                onClick={() => setDocsScope('legal')}
              >
                Schriftstücke
              </button>
            </div>
            <div className={styles.pinnedCollection}>
              <PinnedCollections
                activeCollectionId={selectedCollectionId}
                onActiveAll={handleSelectAll}
                onActiveCollection={handleSelectCollection}
                onAddFilter={handleNewTempFilter}
                hiddenAdd={tempFilters !== null || docsScope === 'legal'}
              />
            </div>
            <div className={styles.filterArea}>
              {tempFilters !== null && (
                <div className={styles.filterInnerArea}>
                  <Filters
                    // When the selected collection changes, the filters internal state should be reset
                    key={selectedCollectionId ?? 'all'}
                    className={styles.filters}
                    filters={tempFilters}
                    onChange={handleFilterChange}
                    defaultDraftFilter={tempFiltersInitial}
                  />
                  <Button
                    variant="plain"
                    onClick={() => {
                      setTempFilters(null);
                    }}
                  >
                    {t['Cancel']()}
                  </Button>
                  <Button onClick={handleSaveFilters}>{t['save']()}</Button>
                </div>
              )}
            </div>
          </div>
          <div className={styles.scrollArea}>
            <div className={styles.docsSurface}>
              <DocsExplorer />
            </div>
          </div>
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </DocExplorerContext.Provider>
  );
};

export const Component = () => {
  return <AllPage />;
};

/**
 * Since split view allows users to open multiple all docs simultaneously, each with its own state,
 * we only read the stored state once during useState initialization to maintain independent states.
 */
const useAllDocsOptions = () => {
  const workspaceLocalState = useService(WorkspaceLocalState);

  const readSavedViewMode = useCallback(() => {
    return workspaceLocalState.get<ViewMode>('allDocsMode') ?? 'list';
  }, [workspaceLocalState]);

  const readSavedDisplayPreference = useCallback(
    (mode: ViewMode) => {
      const saved = workspaceLocalState.get<ExplorerDisplayPreference>(
        'allDocsDisplayPreference:' + mode
      );
      return {
        ...DefaultDisplayPreference[mode],
        ...saved,
        view: mode,
      };
    },
    [workspaceLocalState]
  );

  const [viewMode, setViewMode] = useState(readSavedViewMode);
  const [displayPreference, setDisplayPreference] =
    useState<ExplorerDisplayPreference>(() =>
      readSavedDisplayPreference(viewMode)
    );
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    () =>
      workspaceLocalState.get<string | null>('allDocsSelectedCollectionId') ??
      null
  );
  const [docsScope, setDocsScope] = useState<AllDocsScope>(
    () => workspaceLocalState.get<AllDocsScope>('allDocsScope') ?? 'all'
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      workspaceLocalState.set('allDocsMode', mode);
      setViewMode(mode);
      setDisplayPreference(readSavedDisplayPreference(mode));
    },
    [workspaceLocalState, readSavedDisplayPreference]
  );

  const handleDisplayPreferenceChange = useCallback(
    (displayPreference: ExplorerDisplayPreference) => {
      workspaceLocalState.set(
        'allDocsDisplayPreference:' + viewMode,
        displayPreference
      );
      setDisplayPreference(displayPreference);
    },
    [viewMode, workspaceLocalState]
  );

  const handleSelectedCollectionIdChange = useCallback(
    (collectionId: string | null) => {
      workspaceLocalState.set('allDocsSelectedCollectionId', collectionId);
      setSelectedCollectionId(collectionId);
    },
    [workspaceLocalState]
  );

  const handleDocsScopeChange = useCallback(
    (scope: AllDocsScope) => {
      workspaceLocalState.set('allDocsScope', scope);
      setDocsScope(scope);
    },
    [workspaceLocalState]
  );

  return {
    viewMode,
    setViewMode: handleViewModeChange,
    displayPreference,
    setDisplayPreference: handleDisplayPreferenceChange,
    selectedCollectionId,
    setSelectedCollectionId: handleSelectedCollectionIdChange,
    docsScope,
    setDocsScope: handleDocsScopeChange,
  };
};
