import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import {
  glassFill,
  glassStroke,
  interactionTransition,
} from '../../../layouts/workspace-list-shared-styles';

export const container = style({
  width: '100%',
  padding: '8px 16px 10px',
  borderTop: `0.5px solid ${glassStroke}`,
  background:
    `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

export const trigger = style({
  minHeight: 32,
  padding: '4px 8px',
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)',
  transition: interactionTransition,
  flexShrink: 1,
  minWidth: 0,
  selectors: {
    '&:hover': {
      borderColor: cssVarV2('button/primary'),
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
});

export const menu = style({
  width: 280,
});

export const deletedText = style({
  textDecoration: 'line-through',
  color: cssVarV2.text.placeholder,
});
export const deletedIcon = style({
  color: cssVarV2.text.placeholder,
});
export const deletedTag = style({
  minHeight: 20,
  borderRadius: 8,
  border: `1px solid ${cssVarV2.button.error}`,
  color: cssVarV2.button.error,
  fontSize: 12,
  lineHeight: '20px',
  padding: '0 8px',
});
