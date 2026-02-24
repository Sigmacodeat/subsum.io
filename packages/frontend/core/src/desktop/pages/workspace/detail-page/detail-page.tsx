import { Scrollable } from '@affine/component';
import { PageDetailLoading } from '@affine/component/page-detail-skeleton';
import type { AIChatParams } from '@affine/core/blocksuite/ai';
import { AIProvider } from '@affine/core/blocksuite/ai';
import type { AffineEditorContainer } from '@affine/core/blocksuite/block-suite-editor';
import { EditorOutlineViewer } from '@affine/core/blocksuite/outline-viewer';
import { AffineErrorBoundary } from '@affine/core/components/affine/affine-error-boundary';
// import { PageAIOnboarding } from '@affine/core/components/affine/ai-onboarding';
import { GlobalPageHistoryModal } from '@affine/core/components/affine/page-history-modal';
import { CommentSidebar } from '@affine/core/components/comment/sidebar';
import { useGuard } from '@affine/core/components/guard';
import { useAppSettingHelper } from '@affine/core/components/hooks/affine/use-app-setting-helper';
import { useEnableAI } from '@affine/core/components/hooks/affine/use-enable-ai';
import { useRegisterBlocksuiteEditorCommands } from '@affine/core/components/hooks/affine/use-register-blocksuite-editor-commands';
import { useActiveBlocksuiteEditor } from '@affine/core/components/hooks/use-block-suite-editor';
import { PageDetailEditor } from '@affine/core/components/page-detail-editor';
import { WorkspacePropertySidebar } from '@affine/core/components/properties/sidebar';
import { TrashPageFooter } from '@affine/core/components/pure/trash-page-footer';
import { TopTip } from '@affine/core/components/top-tip';
import { CaseAssistantService } from '@affine/core/modules/case-assistant';
import { CaseAssistantStore } from '@affine/core/modules/case-assistant/stores/case-assistant';
import type { MatterRecord } from '@affine/core/modules/case-assistant/types';
import { ServerService } from '@affine/core/modules/cloud';
import { DocService } from '@affine/core/modules/doc';
import { EditorService } from '@affine/core/modules/editor';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { GlobalContextService } from '@affine/core/modules/global-context';
import { JournalService } from '@affine/core/modules/journal';
import { PeekViewService } from '@affine/core/modules/peek-view';
import { RecentDocsService } from '@affine/core/modules/quicksearch';
import {
  useIsActiveView,
  ViewBody,
  ViewHeader,
  ViewService,
  ViewSidebarTab,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { isNewTabTrigger } from '@affine/core/utils';
import { ServerFeature } from '@affine/graphql';
import track from '@affine/track';
import { DisposableGroup } from '@blocksuite/affine/global/disposable';
import { RefNodeSlotsProvider } from '@blocksuite/affine/inlines/reference';
import { focusBlockEnd } from '@blocksuite/affine/shared/commands';
import { getLastNoteBlock } from '@blocksuite/affine/shared/utils';
import {
  AiIcon,
  ChartPanelIcon,
  CommentIcon,
  ExportIcon,
  FrameIcon,
  NotificationIcon,
  PropertyIcon,
  TocIcon,
  TodayIcon,
} from '@blocksuite/icons/rc';
import {
  FrameworkScope,
  useLiveData,
  useService,
  useServices,
} from '@toeverything/infra';
import clsx from 'clsx';
import { nanoid } from 'nanoid';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Subscription } from 'rxjs';

import { PageNotFound } from '../../404';
import * as styles from './detail-page.css';
import { DetailPageHeader } from './detail-page-header';
import { DetailPageWrapper } from './detail-page-wrapper';
import { EditorAdapterPanel } from './tabs/adapter';
import { EditorAnalyticsPanel } from './tabs/analytics';
import { EditorCaseAssistantPanel } from './tabs/case-assistant';
import type { SidebarSectionId } from './tabs/case-assistant/panel-types';
import { EditorChatPanel } from './tabs/chat';
import { EditorFramePanel } from './tabs/frame';
import { EditorJournalPanel } from './tabs/journal';
import { EditorOutlinePanel } from './tabs/outline';

const ANWALTS_WORKFLOW_TAB_IDS = [
  'wiedervorlage',
  'notizen',
  'vollmachten',
  'zeiten',
  'termine',
  'kalender',
  'finanzen',
  'konflikte',
] as const;
type AnwaltsWorkflowTabId = (typeof ANWALTS_WORKFLOW_TAB_IDS)[number];

function isAnwaltsWorkflowTabId(value: string): value is AnwaltsWorkflowTabId {
  return ANWALTS_WORKFLOW_TAB_IDS.includes(value as AnwaltsWorkflowTabId);
}

const DetailPageImpl = memo(function DetailPageImpl() {
  const {
    workbenchService,
    viewService,
    editorService,
    docService,
    workspaceService,
    globalContextService,
  } = useServices({
    WorkbenchService,
    ViewService,
    EditorService,
    DocService,
    WorkspaceService,
    GlobalContextService,
  });
  const workbench = workbenchService.workbench;
  const editor = editorService.editor;
  const view = viewService.view;
  const workspace = workspaceService.workspace;
  const globalContext = globalContextService.globalContext;
  const doc = docService.doc;

  const mode = useLiveData(editor.mode$);
  const activeSidebarTab = useLiveData(view.activeSidebarTab$);
  const location = useLocation();
  const navigate = useNavigate();

  const preselectedMatterId = new URLSearchParams(location.search).get('caMatterId') ?? undefined;
  const preselectedClientId = new URLSearchParams(location.search).get('caClientId') ?? undefined;
  const preselectedOnboardingFlow = (() => {
    const value = new URLSearchParams(location.search).get('caOnboarding');
    return value === 'documents-first' || value === 'manual'
      ? value
      : undefined;
  })();
  const preselectedSidebarSection = (() => {
    const value = new URLSearchParams(location.search).get('caSidebar');
    return value === 'anwalts-workflow'
      ? (value as SidebarSectionId)
      : undefined;
  })();
  const preselectedAnwaltsWorkflowTab = (() => {
    const value = new URLSearchParams(location.search).get('caWorkflowTab');
    if (!value) {
      return undefined;
    }
    return isAnwaltsWorkflowTabId(value) ? value : undefined;
  })();
  const preselectedDeadlineId =
    new URLSearchParams(location.search).get('caDeadlineId')?.trim() || undefined;

  // Persist matter/client IDs in state so they survive URL param cleanup
  const [persistedMatterId, setPersistedMatterId] = useState<string | undefined>(preselectedMatterId);
  const [persistedClientId, setPersistedClientId] = useState<string | undefined>(preselectedClientId);
  const [persistedOnboardingFlow, setPersistedOnboardingFlow] = useState<
    'manual' | 'documents-first' | undefined
  >(preselectedOnboardingFlow);
  const [persistedSidebarSection, setPersistedSidebarSection] = useState<SidebarSectionId | undefined>(
    preselectedSidebarSection
  );
  const [persistedAnwaltsWorkflowTab, setPersistedAnwaltsWorkflowTab] = useState<
    AnwaltsWorkflowTabId | undefined
  >(preselectedAnwaltsWorkflowTab);
  const [persistedDeadlineId, setPersistedDeadlineId] = useState<string | undefined>(
    preselectedDeadlineId
  );
  useEffect(() => {
    if (preselectedMatterId) setPersistedMatterId(preselectedMatterId);
    if (preselectedClientId) setPersistedClientId(preselectedClientId);
    if (preselectedOnboardingFlow) setPersistedOnboardingFlow(preselectedOnboardingFlow);
    if (preselectedSidebarSection) setPersistedSidebarSection(preselectedSidebarSection);
    if (preselectedAnwaltsWorkflowTab) {
      setPersistedAnwaltsWorkflowTab(preselectedAnwaltsWorkflowTab);
    }
    if (preselectedDeadlineId) setPersistedDeadlineId(preselectedDeadlineId);
  }, [
    preselectedMatterId,
    preselectedClientId,
    preselectedOnboardingFlow,
    preselectedSidebarSection,
    preselectedAnwaltsWorkflowTab,
    preselectedDeadlineId,
  ]);

  const caStore = useService(CaseAssistantStore);
  const caGraph = useLiveData(caStore.watchGraph());
  const akteContext = persistedMatterId
    ? (caGraph?.matters?.[persistedMatterId] as MatterRecord | undefined)
    : undefined;

  const hasAutoOpenedOnboardingSidebarRef = useRef(false);
  const hasAutoOpenedDeepLinkedSidebarRef = useRef(false);

  useEffect(() => {
    if (
      !preselectedMatterId &&
      !preselectedClientId &&
      !preselectedOnboardingFlow &&
      !preselectedSidebarSection &&
      !preselectedAnwaltsWorkflowTab &&
      !preselectedDeadlineId
    ) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const hadMatter = params.has('caMatterId');
    const hadClient = params.has('caClientId');
    const hadOnboarding = params.has('caOnboarding');
    const hadSidebar = params.has('caSidebar');
    const hadWorkflowTab = params.has('caWorkflowTab');
    const hadDeadlineId = params.has('caDeadlineId');
    params.delete('caMatterId');
    params.delete('caClientId');
    params.delete('caOnboarding');
    params.delete('caSidebar');
    params.delete('caWorkflowTab');
    params.delete('caDeadlineId');
    if (!hadMatter && !hadClient && !hadOnboarding && !hadSidebar && !hadWorkflowTab && !hadDeadlineId) {
      return;
    }

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true }
    );
  }, [
    location.pathname,
    location.search,
    navigate,
    preselectedClientId,
    preselectedMatterId,
    preselectedOnboardingFlow,
    preselectedSidebarSection,
    preselectedAnwaltsWorkflowTab,
    preselectedDeadlineId,
  ]);

  useEffect(() => {
    if (hasAutoOpenedOnboardingSidebarRef.current) {
      return;
    }
    if (!persistedOnboardingFlow) {
      return;
    }
    hasAutoOpenedOnboardingSidebarRef.current = true;
    workbench.openSidebar();
    view.activeSidebarTab('case-assistant');
  }, [persistedOnboardingFlow, view, workbench]);

  useEffect(() => {
    if (hasAutoOpenedDeepLinkedSidebarRef.current) {
      return;
    }
    if (!persistedSidebarSection && !persistedAnwaltsWorkflowTab && !persistedDeadlineId) {
      return;
    }
    hasAutoOpenedDeepLinkedSidebarRef.current = true;
    workbench.openSidebar();
    view.activeSidebarTab('case-assistant');
  }, [persistedSidebarSection, persistedAnwaltsWorkflowTab, persistedDeadlineId, view, workbench]);

  const isInTrash = useLiveData(doc.meta$.map(meta => meta.trash));
  const editorContainer = useLiveData(editor.editorContainer$);

  const isSideBarOpen = useLiveData(workbench.sidebarOpen$);
  const { appSettings } = useAppSettingHelper();

  const peekView = useService(PeekViewService).peekView;
  useService(CaseAssistantService);

  const isActiveView = useIsActiveView();
  // TODO(@eyhn): remove jotai here
  const [_, setActiveBlockSuiteEditor] = useActiveBlocksuiteEditor();

  const enableAI = useEnableAI();

  const featureFlagService = useService(FeatureFlagService);
  const enableAdapterPanel = useLiveData(
    featureFlagService.flags.enable_adapter_panel.$
  );

  const serverService = useService(ServerService);
  const serverConfig = useLiveData(serverService.server.config$);

  // comment may not be supported by the server
  const enableComment =
    workspace.flavour !== 'local' &&
    serverConfig.features.includes(ServerFeature.Comment);

  useEffect(() => {
    if (isActiveView) {
      setActiveBlockSuiteEditor(editorContainer);
    }
  }, [editorContainer, isActiveView, setActiveBlockSuiteEditor]);

  useEffect(() => {
    const disposables: Subscription[] = [];
    const openHandler = (params: AIChatParams | null) => {
      if (!params) {
        return;
      }
      workbench.openSidebar();
      view.activeSidebarTab('chat');
    };
    disposables.push(
      AIProvider.slots.requestOpenWithChat.subscribe(openHandler)
    );
    disposables.push(
      AIProvider.slots.requestSendWithChat.subscribe(openHandler)
    );
    return () => disposables.forEach(d => d.unsubscribe());
  }, [activeSidebarTab, view, workbench]);

  useEffect(() => {
    if (isActiveView) {
      globalContext.docId.set(doc.id);
      globalContext.isDoc.set(true);

      return () => {
        globalContext.docId.set(null);
        globalContext.isDoc.set(false);
      };
    }
    return;
  }, [doc, globalContext, isActiveView]);

  useEffect(() => {
    if (isActiveView) {
      globalContext.docMode.set(mode);

      return () => {
        globalContext.docMode.set(null);
      };
    }
    return;
  }, [doc, globalContext, isActiveView, mode]);

  useEffect(() => {
    if (isActiveView) {
      globalContext.isTrashDoc.set(!!isInTrash);

      return () => {
        globalContext.isTrashDoc.set(null);
      };
    }
    return;
  }, [globalContext, isActiveView, isInTrash]);

  useRegisterBlocksuiteEditorCommands(editor, isActiveView);

  const journalService = useService(JournalService);
  const isJournal = !!useLiveData(journalService.journalDate$(doc.id));

  const onLoad = useCallback(
    (editorContainer: AffineEditorContainer) => {
      const std = editorContainer.std;
      const disposable = new DisposableGroup();

      // Check if journal and handle accordingly to set focus on input block.
      if (isJournal) {
        const rafId = requestAnimationFrame(() => {
          try {
            if (!editorContainer.isConnected) return;
            const page = editorContainer.page;
            const note = getLastNoteBlock(page);
            const std = editorContainer.std;
            if (note) {
              const lastBlock = note.lastChild();
              if (lastBlock) {
                const focusBlock = std.view.getBlock(lastBlock.id) ?? undefined;
                std.command.exec(focusBlockEnd, { focusBlock, force: true });
                return;
              }
            }
            std.command.exec(focusBlockEnd, { force: true });
          } catch (error) {
            console.error('Failed to focus journal body', error);
          }
        });
        disposable.add(() => cancelAnimationFrame(rafId));
      }
      if (std) {
        const refNodeSlots = std.getOptional(RefNodeSlotsProvider);
        if (refNodeSlots) {
          disposable.add(
            // the event should not be emitted by AffineReference
            refNodeSlots.docLinkClicked.subscribe(
              ({ pageId, params, openMode, event, host }) => {
                if (host !== editorContainer.host) {
                  return;
                }
                openMode ??=
                  event && isNewTabTrigger(event)
                    ? 'open-in-new-tab'
                    : 'open-in-active-view';

                if (openMode === 'open-in-new-view') {
                  track.doc.editor.toolbar.openInSplitView();
                } else if (openMode === 'open-in-center-peek') {
                  track.doc.editor.toolbar.openInPeekView();
                } else if (openMode === 'open-in-new-tab') {
                  track.doc.editor.toolbar.openInNewTab();
                }

                if (openMode !== 'open-in-center-peek') {
                  const at = (() => {
                    if (openMode === 'open-in-active-view') {
                      return 'active';
                    }
                    // split view is only supported on electron
                    if (openMode === 'open-in-new-view') {
                      return BUILD_CONFIG.isElectron ? 'tail' : 'new-tab';
                    }
                    if (openMode === 'open-in-new-tab') {
                      return 'new-tab';
                    }
                    return 'active';
                  })();
                  workbench.openDoc(
                    {
                      docId: pageId,
                      mode: params?.mode,
                      blockIds: params?.blockIds,
                      elementIds: params?.elementIds,
                      refreshKey: nanoid(),
                    },
                    {
                      at: at,
                      show: true,
                    }
                  );
                } else {
                  peekView
                    .open({
                      docRef: {
                        docId: pageId,
                      },
                      ...params,
                    })
                    .catch(console.error);
                }
              }
            )
          );
        }
      }

      const unbind = editor.bindEditorContainer(
        editorContainer,
        (editorContainer as any).docTitle, // set from proxy
        scrollViewportRef.current
      );

      return () => {
        unbind();
        disposable.dispose();
      };
    },
    [editor, workbench, peekView, isJournal]
  );

  const [hasScrollTop, setHasScrollTop] = useState(false);

  const openOutlinePanel = useCallback(() => {
    workbench.openSidebar();
    view.activeSidebarTab('outline');
  }, [workbench, view]);

  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;

    const hasScrollTop = scrollTop > 0;
    setHasScrollTop(hasScrollTop);
  }, []);

  const [dragging, setDragging] = useState(false);

  const canEdit = useGuard('Doc_Update', doc.id);

  const readonly = !canEdit || isInTrash;

  return (
    <FrameworkScope scope={editor.scope}>
      <ViewHeader>
        <DetailPageHeader
          page={doc.blockSuiteDoc}
          workspace={workspace}
          onDragging={setDragging}
        />
      </ViewHeader>
      <ViewBody>
        <div
          className={styles.mainContainer}
          data-dynamic-top-border={BUILD_CONFIG.isElectron}
          data-has-scroll-top={hasScrollTop}
        >
          {/* Akte context banner – shows when document opened from Akte */}
          {akteContext && persistedMatterId && (
            <div className={styles.akteContextBanner}>
              <span>📁</span>
              <span>Dokument in Akte:</span>
              <span
                className={styles.akteContextLink}
                role="button"
                tabIndex={0}
                onClick={() => workbench.open(`/akten/${persistedMatterId}`)}
              >
                {akteContext.externalRef ? `${akteContext.externalRef} — ` : ''}
                {akteContext.title}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12 }}>
                <span
                  className={styles.akteContextLink}
                  role="button"
                  tabIndex={0}
                  onClick={() => workbench.open(`/akten/${persistedMatterId}`)}
                >
                  ← Zurück zur Akte
                </span>
              </span>
            </div>
          )}
          {/* Add a key to force rerender when page changed, to avoid error boundary persisting. */}
          <AffineErrorBoundary key={doc.id}>
            <TopTip pageId={doc.id} workspace={workspace} />
            <Scrollable.Root>
              <Scrollable.Viewport
                onScroll={handleScroll}
                ref={scrollViewportRef}
                data-dragging={dragging}
                className={clsx(
                  'affine-page-viewport',
                  styles.affineDocViewport,
                  styles.editorContainer,
                  { [styles.pageModeViewportContentBox]: mode === 'page' }
                )}
              >
                <PageDetailEditor onLoad={onLoad} readonly={readonly} />
              </Scrollable.Viewport>
              <Scrollable.Scrollbar
                className={clsx({
                  [styles.scrollbar]: !appSettings.clientBorder,
                })}
              />
            </Scrollable.Root>
            <EditorOutlineViewer
              editor={editorContainer?.host ?? null}
              show={mode === 'page' && !isSideBarOpen}
              openOutlinePanel={openOutlinePanel}
            />
          </AffineErrorBoundary>
          {isInTrash ? <TrashPageFooter /> : null}
        </div>
      </ViewBody>

      {enableAI && (
        <ViewSidebarTab
          tabId="chat"
          icon={<AiIcon />}
          unmountOnInactive={false}
        >
          <EditorChatPanel editor={editorContainer} />
        </ViewSidebarTab>
      )}

      <ViewSidebarTab
        tabId="case-assistant"
        icon={<NotificationIcon />}
        unmountOnInactive={false}
      >
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorCaseAssistantPanel
              caseId={doc.id}
              workspaceId={workspace.id}
              title={doc.title$.value ?? 'Untitled Case'}
              sourceDoc={doc.blockSuiteDoc}
              editorContainer={editorContainer}
              variant="operations"
              initialSidebarSection={persistedSidebarSection ?? 'cockpit'}
              initialSelectedMatterId={persistedMatterId}
              initialSelectedClientId={persistedClientId}
              initialOnboardingFlow={persistedOnboardingFlow}
              initialAnwaltsWorkflowTab={persistedAnwaltsWorkflowTab}
              initialDeadlineId={persistedDeadlineId}
            />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      <ViewSidebarTab tabId="properties" icon={<PropertyIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <WorkspacePropertySidebar />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      <ViewSidebarTab tabId="journal" icon={<TodayIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorJournalPanel />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      <ViewSidebarTab tabId="outline" icon={<TocIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorOutlinePanel editor={editorContainer?.host ?? null} />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      <ViewSidebarTab tabId="frame" icon={<FrameIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorFramePanel editor={editorContainer?.host ?? null} />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      {enableAdapterPanel && (
        <ViewSidebarTab tabId="adapter" icon={<ExportIcon />}>
          <Scrollable.Root className={styles.sidebarScrollArea}>
            <Scrollable.Viewport>
              <EditorAdapterPanel host={editorContainer?.host ?? null} />
            </Scrollable.Viewport>
          </Scrollable.Root>
        </ViewSidebarTab>
      )}

      {workspace.flavour !== 'local' && enableComment && (
        <ViewSidebarTab tabId="comment" icon={<CommentIcon />}>
          <Scrollable.Root className={styles.sidebarScrollArea}>
            <Scrollable.Viewport>
              <CommentSidebar />
            </Scrollable.Viewport>
            <Scrollable.Scrollbar />
          </Scrollable.Root>
        </ViewSidebarTab>
      )}

      {workspace.flavour === 'affine-cloud' && (
        <ViewSidebarTab tabId="analytics" icon={<ChartPanelIcon />}>
          <Scrollable.Root className={styles.sidebarScrollArea}>
            <Scrollable.Viewport>
              <EditorAnalyticsPanel workspaceId={workspace.id} docId={doc.id} />
            </Scrollable.Viewport>
            <Scrollable.Scrollbar />
          </Scrollable.Root>
        </ViewSidebarTab>
      )}

      <GlobalPageHistoryModal />
      {/* FIXME: wait for better ai, <PageAIOnboarding /> */}
    </FrameworkScope>
  );
});

export const Component = () => {
  const params = useParams();
  const recentPages = useService(RecentDocsService);

  useEffect(() => {
    if (params.pageId) {
      const pageId = params.pageId;
      localStorage.setItem('last_page_id', pageId);

      recentPages.addRecentDoc(pageId);
    }
  }, [params, recentPages]);

  const pageId = params.pageId;
  const canAccess = useGuard('Doc_Read', pageId ?? '');

  return pageId ? (
    <DetailPageWrapper
      pageId={pageId}
      canAccess={canAccess}
      skeleton={<PageDetailLoading />}
      notFound={<PageNotFound noPermission />}
    >
      <DetailPageImpl />
    </DetailPageWrapper>
  ) : null;
};
