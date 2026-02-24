const defaultLocale = 'en';

const messages = {
  en: {
    openRightSidebar: 'Open right sidebar',
    closeRightSidebar: 'Close right sidebar',
    rightSidebar: 'Right sidebar',
    rightSidebarPanelPrefix: 'Right sidebar panel',
    rightSidebarPanels: 'Right sidebar panels',
    selectItemToSeeDetails: 'Select an item to see details',
    panel: 'Panel',
    tabs: {
      chat: 'Subsumio AI',
      'case-assistant': 'Subsumio AI',
      'chat-history': 'Chat history',
      'akte-panel': 'Akte',
      properties: 'Properties',
      journal: 'Journal',
      outline: 'Outline',
      frame: 'Frame',
      adapter: 'Adapter',
      comment: 'Comments',
      analytics: 'Analytics',
    },
  },
  de: {
    openRightSidebar: 'Rechte Seitenleiste öffnen',
    closeRightSidebar: 'Rechte Seitenleiste schließen',
    rightSidebar: 'Rechte Seitenleiste',
    rightSidebarPanelPrefix: 'Bereich der rechten Seitenleiste',
    rightSidebarPanels: 'Bereiche der rechten Seitenleiste',
    selectItemToSeeDetails: 'Element auswählen, um Details zu sehen',
    panel: 'Bereich',
    tabs: {
      chat: 'Subsumio AI',
      'case-assistant': 'Subsumio AI',
      'chat-history': 'Chat-Verlauf',
      'akte-panel': 'Akte',
      properties: 'Eigenschaften',
      journal: 'Journal',
      outline: 'Gliederung',
      frame: 'Frame',
      adapter: 'Adapter',
      comment: 'Kommentare',
      analytics: 'Analytik',
    },
  },
} as const;

type SupportedLocale = keyof typeof messages;

type SidebarI18nKey = Exclude<keyof (typeof messages)['en'], 'tabs'>;

const resolveLocale = (locale?: string): SupportedLocale => {
  const candidate = (locale ?? (typeof navigator !== 'undefined' ? navigator.language : defaultLocale)).toLowerCase();
  if (candidate.startsWith('de')) return 'de';
  return 'en';
};

export const getSidebarText = (key: SidebarI18nKey, locale?: string) => {
  const l = resolveLocale(locale);
  return messages[l][key] ?? messages.en[key];
};

export const getSidebarTabLabel = (tabId?: string, locale?: string) => {
  if (!tabId) {
    return getSidebarText('panel', locale);
  }
  const l = resolveLocale(locale);
  return messages[l].tabs[tabId as keyof (typeof messages)['en']['tabs']] ?? tabId;
};
