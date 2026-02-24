import { AllDocsIcon, DateTimeIcon, HomeIcon, TodayIcon } from '@blocksuite/icons/rc';

import { AppTabCreate } from './create';
import { AppTabJournal } from './journal';
import type { Tab } from './type';

export const tabs: Tab[] = [
  {
    key: 'home',
    to: '/home',
    Icon: HomeIcon,
  },
  {
    key: 'all',
    to: '/all',
    Icon: AllDocsIcon,
  },
  {
    key: 'fristen',
    to: '/fristen',
    Icon: DateTimeIcon,
  },
  {
    key: 'termine',
    to: '/termine',
    Icon: TodayIcon,
  },
  {
    key: 'journal',
    custom: AppTabJournal,
  },
  {
    key: 'new',
    custom: AppTabCreate,
  },
];
