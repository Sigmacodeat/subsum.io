import { IconButton } from '@affine/component';
import { AffineErrorBoundary } from '@affine/core/components/affine/affine-error-boundary';
import { RightSidebarIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { Suspense, useCallback } from 'react';
import { Outlet } from 'react-router-dom';

import { AppSidebarService } from '../../app-sidebar';
import { SidebarSwitch } from '../../app-sidebar/views/sidebar-header';
import { ViewService } from '../services/view';
import { WorkbenchService } from '../services/workbench';
import { getSidebarText } from './sidebar/sidebar-i18n';
import * as styles from './route-container.css';
import { useViewPosition } from './use-view-position';
import { ViewBodyTarget, ViewHeaderTarget } from './view-islands';

export interface Props {
  route: {
    Component: React.ComponentType;
  };
}

const ToggleButton = ({
  onToggle,
  className,
  show,
  sidebarOpen,
  controlsId,
}: {
  onToggle?: () => void;
  className: string;
  show: boolean;
  sidebarOpen: boolean;
  controlsId: string;
}) => {
  return (
    <IconButton
      id={controlsId.replace('workbench-right-sidebar-', 'workbench-right-sidebar-toggle-')}
      size="24"
      onClick={onToggle}
      className={className}
      data-show={show}
      data-testid="right-sidebar-toggle"
      aria-label={
        sidebarOpen
          ? getSidebarText('closeRightSidebar')
          : getSidebarText('openRightSidebar')
      }
      aria-expanded={sidebarOpen}
      aria-controls={controlsId}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      <RightSidebarIcon />
    </IconButton>
  );
};

export const RouteContainer = () => {
  const viewPosition = useViewPosition();
  const appSidebarService = useService(AppSidebarService).sidebar;
  const leftSidebarOpen = useLiveData(appSidebarService.open$);
  const workbench = useService(WorkbenchService).workbench;
  const view = useService(ViewService).view;
  const sidebarOpen = useLiveData(workbench.sidebarOpen$);
  const handleToggleSidebar = useCallback(() => {
    workbench.toggleSidebar();
  }, [workbench]);

  const showSwitch = !BUILD_CONFIG.isElectron && viewPosition.isFirst;

  return (
    <div className={styles.root}>
      <div
        className={styles.header}
        data-show-switch={showSwitch && !leftSidebarOpen}
      >
        {showSwitch && (
          <SidebarSwitch
            show={!leftSidebarOpen}
            className={styles.leftSidebarButton}
          />
        )}
        <ViewHeaderTarget
          viewId={view.id}
          className={styles.viewHeaderContainer}
        />
        {!BUILD_CONFIG.isElectron && viewPosition.isLast && (
          <ToggleButton
            show={!sidebarOpen}
            className={styles.rightSidebarButton}
            onToggle={handleToggleSidebar}
            sidebarOpen={!!sidebarOpen}
            controlsId={`workbench-right-sidebar-${view.id}`}
          />
        )}
      </div>

      <AffineErrorBoundary>
        <Suspense>
          <Outlet />
        </Suspense>
      </AffineErrorBoundary>
      <ViewBodyTarget viewId={view.id} className={styles.viewBodyContainer} />
    </div>
  );
};
