import { Button } from '@affine/component';
import {
  AllDocsIcon,
  CollaborationIcon,
  DateTimeIcon,
  EmailIcon,
  FolderIcon,
  JournalIcon,
  PageIcon,
  SettingsIcon,
  ViewLayersIcon,
} from '@blocksuite/icons/rc';
import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import * as styles from '../../case-assistant.css';
import type { SidebarSectionId } from '../panel-types';
import * as navStyles from './sidebar-links-section.css';

type Props = {
  onScrollToSection: (section: SidebarSectionId) => void;
  activeSection: SidebarSectionId;
  variant?: 'operations' | 'copilot';
};

type SidebarTab = { id: SidebarSectionId; label: string; title: string; icon?: ReactNode };

type SidebarGroup = {
  groupId: string;
  groupLabel: string;
  groupTitle: string;
  icon: ReactNode;
  items: SidebarTab[];
};

// ── Quick Actions — always visible at top ──
const QUICK_ACTIONS: SidebarTab[] = [
  {
    id: 'cockpit',
    label: 'Cockpit',
    title: 'Akten-Cockpit — KPIs & Schnellanalyse',
    icon: <ViewLayersIcon />,
  },
  {
    id: 'automation',
    label: 'Workflow',
    title: 'Dokumenten-Intake, OCR & KI-Workflow',
    icon: <AllDocsIcon />,
  },
  {
    id: 'alerts',
    label: 'Fristen',
    title: 'Fristen-Alerts & Erinnerungen',
    icon: <DateTimeIcon />,
  },
];

// ── Reorganized into 4 compact groups ──
const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    groupId: 'akte',
    groupLabel: 'Aktenarbeit',
    groupTitle: 'Akte bearbeiten & analysieren',
    icon: <FolderIcon />,
    items: [
      {
        id: 'mandanten',
        label: 'Mandanten',
        title: 'Mandantenverwaltung — Akten & Bearbeiter',
        icon: <CollaborationIcon />,
      },
      {
        id: 'legal-workflow',
        label: 'Jur. Werkzeuge',
        title: 'Normen, Kosten, Dokumente, Judikatur',
        icon: <ViewLayersIcon />,
      },
      {
        id: 'verfahrensstand',
        label: 'Verfahren',
        title: 'Phasen- und Instanzen-Tracking',
        icon: <DateTimeIcon />,
      },
      {
        id: 'kollision',
        label: 'Kollision',
        title: 'Interessenkonflikt-Check (§ 43a BRAO / § 9 RAO)',
        icon: <SettingsIcon />,
      },
    ],
  },
  {
    groupId: 'kommunikation',
    groupLabel: 'Kommunikation',
    groupTitle: 'E-Mail, beA & Nachrichten',
    icon: <EmailIcon />,
    items: [
      {
        id: 'bea-postfach',
        label: 'beA / webERV',
        title: 'Elektronischer Rechtsverkehr',
        icon: <EmailIcon />,
      },
      {
        id: 'email-inbox',
        label: 'E-Mail',
        title: 'E-Mail Postfach mit Vorlagen',
        icon: <EmailIcon />,
      },
    ],
  },
  {
    groupId: 'compliance',
    groupLabel: 'Compliance & DMS',
    groupTitle: 'Recht, Compliance & Dokumentenmanagement',
    icon: <PageIcon />,
    items: [
      {
        id: 'fristenkontrolle',
        label: '4-Augen',
        title: 'Fristenkontrolle (§ 85 Abs. 2 ZPO)',
        icon: <DateTimeIcon />,
      },
      {
        id: 'gwg-compliance',
        label: 'GwG / KYC',
        title: 'GwG-Compliance & Mandanten-Onboarding',
        icon: <SettingsIcon />,
      },
      {
        id: 'dsgvo-compliance',
        label: 'DSGVO',
        title: 'DSGVO Art. 15-21 & Aufbewahrung',
        icon: <SettingsIcon />,
      },
      {
        id: 'document-versioning',
        label: 'Versionen',
        title: 'Dokumentenversionierung & Review',
        icon: <AllDocsIcon />,
      },
    ],
  },
  {
    groupId: 'kanzlei',
    groupLabel: 'Kanzlei & System',
    groupTitle: 'Kanzleimanagement, Finanzen & Konfiguration',
    icon: <SettingsIcon />,
    items: [
      {
        id: 'kanzlei',
        label: 'Kanzleiprofil',
        title: 'Kanzleiprofil, Anwälte & Stammdaten',
        icon: <CollaborationIcon />,
      },
      {
        id: 'rechnungen',
        label: 'Finanzen',
        title: 'Rechnungen, Auslagen & Finanzsummary',
        icon: <JournalIcon />,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        title: 'Analytics & Monitoring',
        icon: <ViewLayersIcon />,
      },
      {
        id: 'einstellungen',
        label: 'Einstellungen',
        title: 'Connectoren, Rolle & Systemkonfiguration',
        icon: <SettingsIcon />,
      },
    ],
  },
];

const COPILOT_TABS: SidebarTab[] = [
  { id: 'copilot', label: 'Copilot', title: 'Legal Ops CoPilot KI-Copilot — Prompt, Entwurf & Freigabe' },
  { id: 'alerts', label: 'Fristen', title: 'Fristen-Alerts & Erinnerungen' },
];

const SidebarGrouped = ({
  onScrollToSection,
  activeSection,
}: {
  onScrollToSection: (section: SidebarSectionId) => void;
  activeSection: SidebarSectionId;
}) => {
  const activeGroupId = useMemo(() => {
    for (const group of SIDEBAR_GROUPS) {
      if (group.items.some(item => item.id === activeSection)) {
        return group.groupId;
      }
    }
    return null;
  }, [activeSection]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const defaultCollapsed = new Set<string>(['kommunikation', 'compliance', 'kanzlei']);
    if (activeGroupId) {
      defaultCollapsed.delete(activeGroupId);
    }
    return defaultCollapsed;
  });

  // Keep the currently active section's group visible so navigation never feels broken.
  useEffect(() => {
    if (!activeGroupId) return;
    setCollapsedGroups(prev => {
      if (!prev.has(activeGroupId)) return prev;
      const next = new Set(prev);
      next.delete(activeGroupId);
      return next;
    });
  }, [activeGroupId]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const allTabs = useMemo(
    () => [...QUICK_ACTIONS, ...SIDEBAR_GROUPS.flatMap(g => g.items)],
    []
  );

  const onTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, tabId: SidebarSectionId) => {
      const index = allTabs.findIndex(tab => tab.id === tabId);
      if (index < 0) return;
      let targetIndex = index;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        targetIndex = (index + 1) % allTabs.length;
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        targetIndex = (index - 1 + allTabs.length) % allTabs.length;
      } else if (event.key === 'Home') {
        targetIndex = 0;
      } else if (event.key === 'End') {
        targetIndex = allTabs.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      const targetTab = allTabs[targetIndex];
      onScrollToSection(targetTab.id);
      const el = document.getElementById(`case-assistant-nav-tab-${targetTab.id}`);
      el?.focus();
    },
    [onScrollToSection, allTabs]
  );

  return (
    <nav aria-label="Case Assistant Navigation" className={navStyles.navRoot}>
      {/* ── Quick Actions ── */}
      <div className={navStyles.quickActionsLabel}>Schnellzugriff</div>
      <div className={navStyles.quickActionsBar} role="toolbar" aria-label="Schnellzugriff">
        {QUICK_ACTIONS.map(action => {
          const isActive = activeSection === action.id;
          return (
            <Button
              key={action.id}
              id={`case-assistant-nav-tab-${action.id}`}
              variant={isActive ? 'secondary' : 'plain'}
              className={clsx(navStyles.navButton, isActive && navStyles.navButtonActive)}
              onClick={() => onScrollToSection(action.id)}
              onKeyDown={event => onTabKeyDown(event, action.id)}
              title={action.title}
              aria-label={action.title}
              aria-pressed={isActive}
              aria-current={isActive ? 'page' : undefined}
              tabIndex={0}
            >
              <span className={navStyles.navButtonIcon} aria-hidden="true">
                {action.icon}
              </span>
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* ── Grouped Navigation ── */}
      {SIDEBAR_GROUPS.map(group => {
        const isCollapsed = collapsedGroups.has(group.groupId);
        const isActiveGroup = activeGroupId === group.groupId;
        return (
          <div key={group.groupId} role="group" aria-label={group.groupTitle}>
            <button
              type="button"
              className={clsx(
                navStyles.groupHeaderButton,
                isActiveGroup && navStyles.groupHeaderActive
              )}
              onClick={() => toggleGroup(group.groupId)}
              aria-expanded={!isCollapsed}
              title={group.groupTitle}
            >
              <span className={navStyles.groupHeaderIcon} aria-hidden="true">
                {group.icon}
              </span>
              <span className={navStyles.groupHeaderLabel}>{group.groupLabel}</span>
              <span
                className={clsx(
                  navStyles.groupCollapseArrow,
                  isCollapsed && navStyles.groupCollapseArrowCollapsed
                )}
              >
                ▾
              </span>
            </button>
            {!isCollapsed ? (
              <div
                className={navStyles.groupContent}
                role="tablist"
                aria-label={group.groupTitle}
              >
                {group.items.map(tab => {
                  const isActive = activeSection === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      id={`case-assistant-nav-tab-${tab.id}`}
                      role="tab"
                      aria-selected={isActive}
                      aria-label={tab.title}
                      title={tab.title}
                      tabIndex={isActive ? 0 : -1}
                      aria-current={isActive ? 'page' : undefined}
                      variant={isActive ? 'secondary' : 'plain'}
                      className={clsx(
                        navStyles.tabButton,
                        isActive && navStyles.tabButtonActive
                      )}
                      onKeyDown={event => onTabKeyDown(event, tab.id)}
                      onClick={() => onScrollToSection(tab.id)}
                    >
                      {tab.icon ? (
                        <span className={navStyles.tabButtonIcon} aria-hidden="true">
                          {tab.icon}
                        </span>
                      ) : null}
                      {tab.label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
};

export const SidebarLinksSection = ({
  onScrollToSection,
  activeSection,
  variant = 'operations',
}: Props) => {
  if (variant === 'copilot') {
    return (
      <nav aria-label="Legal Ops CoPilot Navigation">
        <div className={styles.tabRow} role="tablist" aria-label="Legal Ops CoPilot Bereiche">
          {COPILOT_TABS.map(tab => (
            <Button
              key={tab.id}
              id={`case-assistant-nav-tab-${tab.id}`}
              role="tab"
              aria-selected={activeSection === tab.id}
              aria-label={tab.title}
              title={tab.title}
              tabIndex={activeSection === tab.id ? 0 : -1}
              variant={activeSection === tab.id ? 'secondary' : 'plain'}
              onClick={() => onScrollToSection(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <SidebarGrouped
      onScrollToSection={onScrollToSection}
      activeSection={activeSection}
    />
  );
};
