import {
  AddPageButton,
  AppDownloadButton,
  AppSidebar,
  MenuItem,
  MenuLinkItem,
  QuickSearchInput,
  SidebarContainer,
  SidebarScrollableContainer,
} from '@affine/core/modules/app-sidebar/views';
import { ExternalMenuLinkItem } from '@affine/core/modules/app-sidebar/views/menu-item/external-menu-link-item';
import {
  CREDIT_COSTS,
  CreditGatewayService,
  LegalChatService,
} from '@affine/core/modules/case-assistant';
import { AuthService, GraphQLService, ServerService } from '@affine/core/modules/cloud';
import {
  GlobalDialogService,
  WorkspaceDialogService,
} from '@affine/core/modules/dialogs';
import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import type { Workspace } from '@affine/core/modules/workspace';
import type { GraphQLQuery } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import type { Store } from '@blocksuite/affine/store';
import {
  AiOutlineIcon,
  AllDocsIcon,
  CollaborationIcon,
  DateTimeIcon,
  ExportIcon,
  FolderIcon,
  ImportIcon,
  JournalIcon,
  SettingsIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import {
  CollapsibleSection,
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelMigrationFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../desktop/components/navigation-panel';
import { WorkbenchService } from '../../modules/workbench';
import { WorkspaceNavigator } from '../workspace-selector';
import {
  aiCreditsAction,
  aiCreditsBody,
  aiCreditsCard,
  aiCreditsHeader,
  aiCreditsMeta,
  aiCreditsMetaLabel,
  aiCreditsMetaValue,
  aiCreditsMetaValueStrong,
  aiCreditsTier,
  bottomContainer,
  quickSearch,
  quickSearchAndNewPage,
  workspaceAndUserWrapper,
  workspaceWrapper,
} from './index.css';
import { InviteMembersButton } from './invite-members-button';
// Journals button replaced by FristenButton (inline above)
// import { AppSidebarJournalButton } from './journal-button';
import { NotificationButton } from './notification-button';
import { SidebarAudioPlayer } from './sidebar-audio-player';
import { TemplateDocEntrance } from './template-doc-entrance';
import { TrashButton } from './trash-button';
import { UpdaterButton } from './updater-button';
import UserInfo from './user-info';

type OrganizationSummary = {
  id: string;
  name: string;
};

const AFFILIATE_REF_STORAGE_KEY = 'affiliate_referral_code';

const captureAffiliateReferralMutation: GraphQLQuery = {
  id: 'captureAffiliateReferralFromUrlMutation',
  op: 'captureAffiliateReferral',
  query: `mutation captureAffiliateReferral($code: String!, $source: String) {
  captureAffiliateReferral(code: $code, source: $source)
}`,
};

const getOrganizationsQuery: GraphQLQuery = {
  id: 'organizationSidebarListQuery',
  op: 'getOrganizations',
  query: `query getOrganizations {
  organizations {
    id
    name
  }
}`,
};

const OrganizationSwitcher = ({
  isAuthenticated,
  onOpenOrganizationSettings,
}: {
  isAuthenticated: boolean;
  onOpenOrganizationSettings: () => void;
}) => {
  const gqlService = useService(GraphQLService);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState<string>('');

  useEffect(() => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setSelectedOrganizationId('');
      return;
    }

    let isCancelled = false;
    (async () => {
      try {
        const data = (await (gqlService.gql as any)({
          query: getOrganizationsQuery,
        })) as { organizations: OrganizationSummary[] };
        if (isCancelled) return;
        setOrganizations(data.organizations);
        if (data.organizations.length > 0) {
          setSelectedOrganizationId(data.organizations[0].id);
        }
      } catch {
        if (isCancelled) return;
        // expected when auth is temporarily unavailable (e.g. signed out/dev reload)
      }
    })().catch(console.error);
    return () => {
      isCancelled = true;
    };
  }, [gqlService, isAuthenticated]);

  if (organizations.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
      <select
        value={selectedOrganizationId}
        onChange={e => setSelectedOrganizationId(e.target.value)}
        style={{ width: '100%', height: 30 }}
      >
        {organizations.map(org => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onOpenOrganizationSettings}
        style={{
          border: '1px solid var(--affine-border-color)',
          borderRadius: 8,
          height: 30,
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Organization Settings
      </button>
    </div>
  );
};

export type RootAppSidebarProps = {
  isPublicWorkspace: boolean;
  onOpenQuickSearchModal: () => void;
  onOpenSettingModal: () => void;
  currentWorkspace: Workspace;
  openPage: (pageId: string) => void;
  createPage: () => Store;
  paths: {
    all: (workspaceId: string) => string;
    trash: (workspaceId: string) => string;
    shared: (workspaceId: string) => string;
  };
};

const AktenButton = () => {
  const { workbenchService } = useServices({ WorkbenchService });
  const workbench = workbenchService.workbench;
  const aktenActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/akten')
  );

  return (
    <MenuLinkItem icon={<FolderIcon />} active={aktenActive} to={'/akten'}>
      <span data-testid="all-akten">Akten</span>
    </MenuLinkItem>
  );
};

const MandantenButton = () => {
  const { workbenchService } = useServices({ WorkbenchService });
  const workbench = workbenchService.workbench;
  const mandantenActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/mandanten')
  );

  return (
    <MenuLinkItem
      icon={<CollaborationIcon />}
      active={mandantenActive}
      to={'/mandanten'}
    >
      <span data-testid="all-mandanten">Mandanten</span>
    </MenuLinkItem>
  );
};

const FristenButton = () => {
  const { workbenchService } = useServices({ WorkbenchService });
  const workbench = workbenchService.workbench;
  const fristenActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/fristen')
  );

  return (
    <MenuLinkItem
      icon={<DateTimeIcon />}
      active={fristenActive}
      to={'/fristen'}
    >
      <span data-testid="all-fristen">Fristen</span>
    </MenuLinkItem>
  );
};

const TermineButton = () => {
  const { workbenchService } = useServices({ WorkbenchService });
  const workbench = workbenchService.workbench;
  const termineActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/termine')
  );

  return (
    <MenuLinkItem
      icon={<DateTimeIcon />}
      active={termineActive}
      to={'/termine'}
    >
      <span data-testid="all-termine">Termine</span>
    </MenuLinkItem>
  );
};

const AllDocsButton = () => {
  const t = useI18n();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const allPageActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/all')
  );

  return (
    <MenuLinkItem icon={<AllDocsIcon />} active={allPageActive} to={'/all'}>
      <span data-testid="all-pages">
        {t['com.affine.workspaceSubPath.all']()}
      </span>
    </MenuLinkItem>
  );
};

const AIChatButton = () => {
  const t = useI18n();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const aiChatActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/chat')
  );

  return (
    <MenuLinkItem icon={<AiOutlineIcon />} active={aiChatActive} to={'/chat'}>
      <span data-testid="ai-chat">
        {t['com.affine.workspaceSubPath.chat']()}
      </span>
    </MenuLinkItem>
  );
};

/**
 * This is for the whole affine app sidebar.
 * This component wraps the app sidebar in `@affine/component` with logic and data.
 *
 */
export const RootAppSidebar = memo((): ReactElement => {
  const {
    workbenchService,
    cMDKQuickSearchService,
    authService,
    graphQLService,
    serverService,
  } = useServices({
    WorkbenchService,
    CMDKQuickSearchService,
    AuthService,
    GraphQLService,
    ServerService,
  });

  const sessionStatus = useLiveData(authService.session.status$);
  const account = useLiveData(authService.session.account$);
  const serverFeatures = useLiveData(serverService.server.features$);
  const isAuthenticated =
    sessionStatus === 'authenticated' && Boolean(account?.id);
  const t = useI18n();
  const workspaceDialogService = useService(WorkspaceDialogService);
  const globalDialogService = useService(GlobalDialogService);
  const creditGateway = useService(CreditGatewayService);
  const legalChatService = useService(LegalChatService);
  const creditBalances = useLiveData(creditGateway.balances$) ?? [];
  const workbench = workbenchService.workbench;
  const workspaceSelectorOpen = useLiveData(workbench.workspaceSelectorOpen$);
  const onOpenQuickSearchModal = useCallback(() => {
    cMDKQuickSearchService.toggle();
  }, [cMDKQuickSearchService]);

  const onWorkspaceSelectorOpenChange = useCallback(
    (open: boolean) => {
      workbench.setWorkspaceSelectorOpen(open);
    },
    [workbench]
  );

  const onOpenSettingModal = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'appearance',
    });
    track.$.navigationPanel.$.openSettings();
  }, [workspaceDialogService]);

  const onOpenBillingModal = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'workspace:billing',
    });
  }, [workspaceDialogService]);

  const formatCredits = useCallback((amount: number): string => {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
    return String(amount);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !serverFeatures?.copilot) {
      return;
    }

    legalChatService.refreshAvailableModels().catch(() => {
      // no-op: fallback model list is already available
    });
  }, [isAuthenticated, legalChatService, serverFeatures?.copilot]);

  useLiveData(legalChatService.availableModels$);
  const selectedModel = legalChatService.getSelectedModel();
  const modelCreditMultiplier =
    typeof selectedModel.creditMultiplier === 'number'
      ? selectedModel.creditMultiplier
      : selectedModel.costTier === 'low'
        ? 0.5
        : selectedModel.costTier === 'high'
          ? 1.5
          : selectedModel.costTier === 'premium'
            ? 2.5
            : 1;
  const estimatedChatCreditCost = Math.max(
    1,
    Math.round(CREDIT_COSTS.chatMessage * modelCreditMultiplier)
  );

  const aiCreditEntries = creditBalances.filter(
    balance =>
      balance.addonType === 'extra_ai_credits_5m' ||
      balance.addonType === 'extra_ai_credits_20m'
  );
  const hasAiCreditAddon = aiCreditEntries.length > 0;
  const totalAiCredits = aiCreditEntries.reduce(
    (sum, balance) => sum + (balance.currentBalance ?? 0),
    0
  );

  const onOpenOrganizationSettingModal = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'organization:general',
    });
    track.$.navigationPanel.$.openSettings();
  }, [workspaceDialogService]);

  const handleOpenDocs = useCallback(
    (result: {
      docIds: string[];
      entryId?: string;
      isWorkspaceFile?: boolean;
    }) => {
      const { docIds, entryId, isWorkspaceFile } = result;
      // If the imported file is a workspace file, open the entry page.
      if (isWorkspaceFile && entryId) {
        workbench.openDoc(entryId);
      } else if (!docIds.length) {
        return;
      }
      // Open all the docs when there are multiple docs imported.
      if (docIds.length > 1) {
        workbench.openAll();
      } else {
        // Otherwise, open the only doc.
        workbench.openDoc(docIds[0]);
      }
    },
    [workbench]
  );

  const onOpenWorkspaceImport = useCallback(() => {
    track.$.navigationPanel.workspaceList.createWorkspace({
      control: 'import',
    });
    globalDialogService.open('import-workspace', undefined);
  }, [globalDialogService]);

  const onOpenWorkspaceExport = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'workspace:storage',
    });
    track.$.navigationPanel.$.openSettings();
  }, [workspaceDialogService]);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const refFromUrl = currentUrl.searchParams.get('ref');

    if (refFromUrl) {
      localStorage.setItem(AFFILIATE_REF_STORAGE_KEY, refFromUrl);
      currentUrl.searchParams.delete('ref');
      window.history.replaceState({}, '', currentUrl.toString());
    }

    if (!isAuthenticated) {
      return;
    }

    const ref = localStorage.getItem(AFFILIATE_REF_STORAGE_KEY);
    if (!ref) {
      return;
    }

    void (graphQLService.gql as any)({
      query: captureAffiliateReferralMutation,
      variables: {
        code: ref,
        source: 'pricing-url',
      },
    })
      .catch(() => {
        // expected during auth transitions (signed-out / session revalidation)
      })
      .finally(() => {
        localStorage.removeItem(AFFILIATE_REF_STORAGE_KEY);
      });
  }, [graphQLService, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !serverFeatures?.payment) {
      return;
    }

    const initialFetchTimer = globalThis.setTimeout(() => {
      creditGateway.fetchBalances().catch(() => {});
    }, 220);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        creditGateway.fetchBalances().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = globalThis.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      creditGateway.fetchBalances().catch(() => {});
    }, 60_000);

    return () => {
      globalThis.clearTimeout(initialFetchTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      globalThis.clearInterval(intervalId);
    };
  }, [creditGateway, isAuthenticated, serverFeatures?.payment]);

  return (
    <AppSidebar>
      <SidebarContainer>
        <div className={workspaceAndUserWrapper}>
          <div className={workspaceWrapper}>
            <WorkspaceNavigator
              showEnableCloudButton
              showSyncStatus
              open={workspaceSelectorOpen}
              onOpenChange={onWorkspaceSelectorOpenChange}
              dense
            />
            <OrganizationSwitcher
              isAuthenticated={isAuthenticated}
              onOpenOrganizationSettings={onOpenOrganizationSettingModal}
            />
          </div>
          <UserInfo />
        </div>
        <div className={quickSearchAndNewPage}>
          <QuickSearchInput
            className={quickSearch}
            data-testid="slider-bar-quick-search-button"
            data-event-props="$.navigationPanel.$.quickSearch"
            onClick={onOpenQuickSearchModal}
          />
          <AddPageButton />
        </div>
        <AllDocsButton />
        <AktenButton />
        <MandantenButton />
        <FristenButton />
        <TermineButton />
        {isAuthenticated && <NotificationButton />}
        <AIChatButton />
        <MenuItem
          data-testid="slider-bar-workspace-setting-button"
          icon={<SettingsIcon />}
          onClick={onOpenSettingModal}
        >
          <span data-testid="settings-modal-trigger">
            {t['com.affine.settingSidebar.title']()}
          </span>
        </MenuItem>
      </SidebarContainer>
      <SidebarScrollableContainer>
        <NavigationPanelFavorites />
        <NavigationPanelOrganize />
        <NavigationPanelMigrationFavorites />
        <NavigationPanelTags />
        <NavigationPanelCollections />
        <CollapsibleSection
          path={['others']}
          title={t['com.affine.rootAppSidebar.others']()}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          <TrashButton />
          {BUILD_CONFIG.isElectron ? (
            <>
              <MenuItem
                data-testid="slider-bar-import-button"
                icon={<ImportIcon />}
                onClick={onOpenWorkspaceImport}
              >
                <span data-testid="import-modal-trigger">
                  {t['com.affine.workspace.local.import']()}
                </span>
              </MenuItem>
              <MenuItem
                data-testid="slider-bar-workspace-export-button"
                icon={<ExportIcon />}
                onClick={onOpenWorkspaceExport}
              >
                <span data-testid="workspace-export-trigger">
                  {t['Full Backup']()}
                </span>
              </MenuItem>
            </>
          ) : (
            <MenuItem
              data-testid="slider-bar-import-button"
              icon={<ImportIcon />}
              onClick={() => {
                track.$.navigationPanel.importModal.open();
                workspaceDialogService.open('import', undefined, payload => {
                  if (!payload) {
                    return;
                  }
                  handleOpenDocs(payload);
                });
              }}
            >
              <span data-testid="import-modal-trigger">{t['Import']()}</span>
            </MenuItem>
          )}
          <InviteMembersButton />
          <TemplateDocEntrance />
          <ExternalMenuLinkItem
            href="https://subsumio.com/blog?tag=Release+Note"
            icon={<JournalIcon />}
            label={t['com.affine.app-sidebar.learn-more']()}
          />
        </CollapsibleSection>
      </SidebarScrollableContainer>
      <SidebarContainer className={bottomContainer}>
        <section
          className={aiCreditsCard}
          aria-live="polite"
          aria-label="AI Credits Übersicht"
        >
          <div className={aiCreditsHeader}>
            <span>AI Credits</span>
            <span className={aiCreditsTier}>{selectedModel.costTier}</span>
          </div>
          <div className={aiCreditsBody}>
            <p className={aiCreditsMeta}>
              <span className={aiCreditsMetaLabel}>Verfügbar</span>
              <span className={aiCreditsMetaValueStrong}>
                {hasAiCreditAddon ? formatCredits(totalAiCredits) : 'Free-Tier'}
              </span>
            </p>
            <p className={aiCreditsMeta}>
              <span className={aiCreditsMetaLabel}>Modell</span>
              <span className={aiCreditsMetaValue}>{selectedModel.label}</span>
            </p>
            <p className={aiCreditsMeta}>
              <span className={aiCreditsMetaLabel}>Kosten / Chat</span>
              <span className={aiCreditsMetaValueStrong}>
                ~{formatCredits(estimatedChatCreditCost)}
              </span>
            </p>
          </div>
          <button
            type="button"
            className={aiCreditsAction}
            onClick={onOpenBillingModal}
            aria-label="Abrechnung öffnen und AI Credits nachkaufen"
          >
            Credits nachkaufen
          </button>
        </section>
        <SidebarAudioPlayer />
        {BUILD_CONFIG.isElectron ? <UpdaterButton /> : <AppDownloadButton />}
      </SidebarContainer>
    </AppSidebar>
  );
});

RootAppSidebar.displayName = 'memo(RootAppSidebar)';
