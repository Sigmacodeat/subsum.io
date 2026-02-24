import { WorkbenchLink } from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';

import * as styles from './navigation.css';

const items = [
  {
    value: 'docs',
    label: 'com.affine.docs.header',
    testId: 'workspace-docs-button',
    to: '/all',
  },
  {
    value: 'akten',
    label: 'Akten',
    testId: 'workspace-akten-button',
    to: '/akten',
    isRawLabel: true,
  },
  {
    value: 'mandanten',
    label: 'Mandanten',
    testId: 'workspace-mandanten-button',
    to: '/mandanten',
    isRawLabel: true,
  },
  {
    value: 'fristen',
    label: 'Fristen',
    testId: 'workspace-fristen-button',
    to: '/fristen',
    isRawLabel: true,
  },
  {
    value: 'termine',
    label: 'Termine',
    testId: 'workspace-termine-button',
    to: '/termine',
    isRawLabel: true,
  },
  {
    value: 'collections',
    label: 'com.affine.collections.header',
    testId: 'workspace-collections-button',
    to: '/collection',
  },
  {
    value: 'tags',
    label: 'Tags',
    testId: 'workspace-tags-button',
    to: '/tag',
  },
] as const;

type NavigationKey = (typeof items)[number]['value'];

export const ExplorerNavigation = ({ active }: { active: NavigationKey }) => {
  const t = useI18n();

  return (
    <div className={styles.container}>
      {items.map(item => (
        <WorkbenchLink
          key={item.value}
          data-testid={item.testId}
          data-active={active === item.value}
          to={item.to}
          onClick={() => {
            track.allDocs.header.navigation.navigateAllDocsRouter({
              control: item.value,
            });
          }}
          className={styles.item}
        >
          {'isRawLabel' in item && item.isRawLabel
            ? item.label
            : t[item.label]()}
        </WorkbenchLink>
      ))}
    </div>
  );
};
