import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { interactionTransition } from '../../../desktop/pages/workspace/layouts/workspace-list-shared-styles';

export const container = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: 0,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  backdropFilter: 'none',
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'none',
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
});

export const item = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 30,
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 600,
  cursor: 'pointer',
  border: '0.5px solid transparent',
  background: 'transparent',
  color: cssVarV2.text.secondary,
  transition: interactionTransition,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  selectors: {
    '&:hover': {
      color: cssVarV2.text.primary,
      background:
        'color-mix(in srgb, var(--affine-hover-color, rgba(255, 255, 255, 0.06)) 40%, transparent)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 60%, transparent)',
      transform: 'translateY(-0.5px)',
    },
    '&[data-active="true"]': {
      background:
        `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2.button.primary} 68%, var(--affine-background-primary-color) 32%) 0%, color-mix(in srgb, ${cssVarV2.button.primary} 56%, var(--affine-background-primary-color) 44%) 100%)`,
      color: cssVarV2.button.pureWhiteText,
      borderColor: `color-mix(in srgb, ${cssVarV2.button.primary} 34%, transparent)`,
      boxShadow: '0 4px 12px color-mix(in srgb, var(--affine-primary-color) 18%, rgba(0, 0, 0, 0.16))',
      fontWeight: 600,
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2.button.primary}`,
      outlineOffset: 1,
    },
  },
});
