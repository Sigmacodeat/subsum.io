import { cssVarV2 } from '@toeverything/theme/v2';
import { style, styleVariants } from '@vanilla-extract/css';

import {
  glassFill,
  interactionTransition,
} from '../../../layouts/workspace-list-shared-styles';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '0 16px 12px 16px',
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 0 2px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2.text.secondary,
  userSelect: 'none',
});

export const sectionIcon = style({
  fontSize: 13,
  lineHeight: 1,
});

export const sectionCount = style({
  marginLeft: 'auto',
  fontSize: 10,
  fontWeight: 500,
  padding: '1px 5px',
  borderRadius: 6,
  background: 'color-mix(in srgb, currentColor 12%, transparent)',
});

export const item = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '5px 8px',
  borderRadius: 8,
  border: '0.5px solid transparent',
  background:
    `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  transition: interactionTransition,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      backgroundColor:
        'color-mix(in srgb, var(--affine-hover-color, rgba(255,255,255,0.06)) 40%, transparent)',
      borderColor:
        'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
    },
  },
});

const urgencyBase = style({
  width: 3,
  minHeight: 20,
  borderRadius: 2,
  flexShrink: 0,
});

export const urgencyBar = styleVariants({
  critical: [urgencyBase, { background: '#ef4444' }],
  soon: [urgencyBase, { background: '#f59e0b' }],
  normal: [urgencyBase, { background: cssVarV2.text.disable }],
});

export const itemContent = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
});

export const itemTitle = style({
  fontSize: 13,
  fontWeight: 500,
  lineHeight: '20px',
  color: cssVarV2.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const itemSublabel = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.secondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const itemTime = style({
  fontSize: 11,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

const statusBase = style({
  fontSize: 10,
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 4,
  lineHeight: '16px',
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

export const statusChip = styleVariants({
  danger: [statusBase, { background: '#fef2f2', color: '#dc2626' }],
  warning: [statusBase, { background: '#fffbeb', color: '#d97706' }],
  success: [statusBase, { background: '#f0fdf4', color: '#16a34a' }],
  neutral: [statusBase, { background: 'color-mix(in srgb, currentColor 8%, transparent)', color: cssVarV2.text.secondary }],
});

export const emptyState = style({
  padding: '12px 8px',
  fontSize: 12,
  color: cssVarV2.text.disable,
  textAlign: 'center',
});

export const statsBar = style({
  display: 'flex',
  gap: 8,
  padding: '4px 0 6px',
  flexWrap: 'wrap',
});

const statBase = style({
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 6,
  lineHeight: '18px',
});

export const statChip = styleVariants({
  critical: [statBase, { background: '#fef2f2', color: '#dc2626' }],
  high: [statBase, { background: '#fffbeb', color: '#d97706' }],
  normal: [statBase, { background: 'color-mix(in srgb, currentColor 8%, transparent)', color: cssVarV2.text.secondary }],
});
