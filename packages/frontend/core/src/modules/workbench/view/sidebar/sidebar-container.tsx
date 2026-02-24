import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ViewService } from '../../services/view';
import { WorkbenchService } from '../../services/workbench';
import { ViewSidebarTabBodyTarget } from '../view-islands';
import * as styles from './sidebar-container.css';
import { Header } from './sidebar-header';
import { getSidebarTabLabel, getSidebarText } from './sidebar-i18n';
import { SidebarHeaderSwitcher } from './sidebar-header-switcher';

export const SidebarContainer = ({
  className,
  ...props
}: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workbenchService = useService(WorkbenchService);
  const workbench = workbenchService.workbench;
  const viewService = useService(ViewService);
  const view = viewService.view;
  const sidebarOpen = useLiveData(workbench.sidebarOpen$);
  const sidebarTabs = useLiveData(view.sidebarTabs$);
  const activeSidebarTab = useLiveData(view.activeSidebarTab$);
  const activeSidebarLabel = getSidebarTabLabel(activeSidebarTab?.id);

  const isFloating = useMemo(() => {
    const v = (props as any)['data-is-floating'];
    return v === true || v === 'true';
  }, [props]);

  const handleToggleOpen = useCallback(() => {
    const wasOpen = !!sidebarOpen;
    workbench.toggleSidebar();
    if (wasOpen) {
      requestAnimationFrame(() => {
        const toggleEl = document.getElementById(
          `workbench-right-sidebar-toggle-${view.id}`
        ) as HTMLButtonElement | null;
        toggleEl?.focus();
      });
    }
  }, [sidebarOpen, view.id, workbench]);

  useEffect(() => {
    if (!isFloating || !sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      workbench.closeSidebar();
      requestAnimationFrame(() => {
        const toggleEl = document.getElementById(
          `workbench-right-sidebar-toggle-${view.id}`
        ) as HTMLButtonElement | null;
        toggleEl?.focus();
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFloating, sidebarOpen, view.id, workbench]);

  useEffect(() => {
    if (!isFloating || !sidebarOpen) return;
    const root = containerRef.current;
    if (!root) return;

    const getFocusable = () => {
      const nodes = root.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      return Array.from(nodes).filter(
        el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
    };

    requestAnimationFrame(() => {
      const focusables = getFocusable();
      focusables[0]?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [isFloating, sidebarOpen]);

  useEffect(() => {
    if (!isFloating || !sidebarOpen) return;
    const root = containerRef.current;
    if (!root) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || root.contains(target)) return;
      workbench.closeSidebar();
      requestAnimationFrame(() => {
        const toggleEl = document.getElementById(
          `workbench-right-sidebar-toggle-${view.id}`
        ) as HTMLButtonElement | null;
        toggleEl?.focus();
      });
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isFloating, sidebarOpen, view.id, workbench]);

  return (
    <div
      id={`workbench-right-sidebar-${view.id}`}
      role={isFloating ? 'dialog' : 'complementary'}
      aria-modal={isFloating ? true : undefined}
      aria-labelledby={`workbench-right-sidebar-title-${view.id}`}
      className={clsx(styles.sidebarContainerInner, className)}
      ref={containerRef}
      {...props}
    >
      <h2
        id={`workbench-right-sidebar-title-${view.id}`}
        className={styles.visuallyHidden}
      >
        {getSidebarText('rightSidebar')}: {activeSidebarLabel}
      </h2>
      <Header onToggle={handleToggleOpen}>
        <SidebarHeaderSwitcher />
      </Header>
      {sidebarTabs.length > 0 ? (
        sidebarTabs.map(sidebar => (
          <ViewSidebarTabBodyTarget
            tabId={sidebar.id}
            key={sidebar.id}
            style={{ display: activeSidebarTab === sidebar ? 'block' : 'none' }}
            viewId={view.id}
            className={clsx(
              styles.sidebarBodyTarget,
              !BUILD_CONFIG.isElectron && styles.borderTop
            )}
            data-testid={`sidebar-tab-content-${sidebar.id}`}
            role="region"
            aria-label={`${getSidebarText('rightSidebarPanelPrefix')}: ${getSidebarTabLabel(
              sidebar.id
            )}`}
            aria-hidden={activeSidebarTab !== sidebar}
          />
        ))
      ) : (
        <div className={styles.sidebarBodyNoSelection} aria-live="polite">
          {getSidebarText('selectItemToSeeDetails')}
        </div>
      )}
    </div>
  );
};
