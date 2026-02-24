import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassStroke } from '../layouts/workspace-list-shared-styles';

export const item = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '4px 12px',
  minWidth: '46px',
  minHeight: 28,
  lineHeight: '20px',
  fontSize: 13,
  fontWeight: 500,
  color: cssVarV2('text/secondary'),
  borderRadius: 16,
  border: `0.5px solid ${glassStroke}`,
  backgroundColor: 'color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)',
  backdropFilter: 'blur(10px) saturate(130%)',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'all 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
      borderColor: cssVarV2('button/primary'),
      transform: 'translateY(-0.5px)',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
    '&[data-active="true"]': {
      color: cssVarV2('button/pureWhiteText'),
      backgroundColor: cssVarV2('button/primary'),
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 10px 24px color-mix(in srgb, ${cssVarV2('button/primary')} 28%, transparent), 0 1px 0 rgba(255, 255, 255, 0.02) inset`,
      fontWeight: 600,
    },
    '&[data-active="true"]:hover': {
      transform: 'translateY(0)',
    },
  },
  '@media': {
    '(max-width: 700px)': {
      fontSize: 12,
      lineHeight: '18px',
      minHeight: 26,
    },
  },
});

export const itemContent = style({
  display: 'inline-block',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  textAlign: 'center',
  maxWidth: '128px',
  minWidth: '32px',
});

export const editIconButton = style({
  borderRadius: 999,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)',
  backdropFilter: 'blur(10px) saturate(130%)',
  color: cssVarV2('text/secondary'),
});

export const closeButton = style({
  borderRadius: 999,
  color: cssVarV2('text/secondary'),
});

export const container = style({
  display: 'flex',
  flexDirection: 'row',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
});

export const spacer = style({
  flex: 1,
  minWidth: 8,
});
