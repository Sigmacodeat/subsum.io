import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import {
  glassFill,
  glassStroke,
  layoutGutter,
  layoutGutterMd,
  layoutGutterSm,
} from '../layouts/workspace-list-shared-styles';

export const header = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  minHeight: 44,
  gap: 8,
  padding: `8px ${layoutGutter}px`,
  borderBottom: `0.5px solid ${glassStroke}`,
  background:
    `linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 92%, transparent) 0%, color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent) 100%), ${glassFill}`,
  backdropFilter: 'blur(18px) saturate(145%)',
  '@media': {
    '(max-width: 700px)': {
      flexWrap: 'wrap',
      rowGap: 6,
      padding: `6px ${layoutGutterMd}px`,
    },
    '(max-width: 393px)': {
      padding: `6px ${layoutGutterSm}px`,
    },
  },
});

export const actions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  '@media': {
    '(max-width: 700px)': {
      width: '100%',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      rowGap: 6,
    },
  },
});

export const viewToggle = style({
  backgroundColor: 'transparent',
});
export const viewToggleItem = style({
  padding: 0,
  fontSize: 16,
  width: 24,
  color: cssVarV2.icon.primary,
  selectors: {
    '&[data-state=checked]': {
      color: cssVarV2.icon.primary,
    },
  },
});

export const newPageButtonLabel = style({
  fontSize: '12px',
  color: cssVarV2.text.primary,
  fontWeight: 500,
  '@media': {
    '(max-width: 700px)': {
      fontSize: '11px',
    },
  },
});
