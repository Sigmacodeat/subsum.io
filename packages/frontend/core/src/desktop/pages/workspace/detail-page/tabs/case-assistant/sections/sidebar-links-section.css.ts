import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const navRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  borderRadius: 14,
  padding: 8,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(14px) saturate(140%)',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 10px 24px rgba(0, 0, 0, 0.12)',
});

export const quickActionsLabel = style({
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: cssVarV2('text/secondary'),
  padding: '4px 8px 3px',
});

export const quickActionsBar = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 6,
  padding: '6px 4px 10px',
  borderBottom: `0.5px solid ${glassStroke}`,
  marginBottom: 4,
});

export const navButton = style({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 9,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '17px',
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(135%)',
  transition:
    'background 0.18s cubic-bezier(0.22, 1, 0.36, 1), color 0.18s ease, box-shadow 0.2s ease, border-color 0.18s ease, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
  textAlign: 'left',
  minHeight: 34,
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
      transform: 'translateY(-0.5px)',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const navButtonActive = style({
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/hoverOverlay'),
  border: `0.5px solid ${cssVarV2('button/primary')}`,
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 7px 18px rgba(0, 0, 0, 0.16)',
  transform: 'translateY(-0.5px)',
});

export const navButtonIcon = style({
  fontSize: 14,
  lineHeight: '16px',
  width: 16,
  textAlign: 'center',
  flexShrink: 0,
  color: cssVarV2('icon/secondary'),
  transition: 'color 0.16s ease',
  selectors: {
    [`${navButton}:is(:hover, [aria-pressed="true"]) &`]: {
      color: cssVarV2('icon/primary'),
    },
  },
});

export const groupHeaderButton = style({
  appearance: 'none',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.075em',
  color: cssVarV2('text/secondary'),
  padding: '10px 8px 5px',
  userSelect: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'transparent',
  border: 'none',
  width: '100%',
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
      background: cssVarV2('layer/background/hoverOverlay'),
      borderRadius: 7,
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
      borderRadius: 6,
    },
  },
});

export const groupHeaderActive = style({
  color: cssVarV2('button/primary'),
});

export const groupHeaderLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

export const groupHeaderIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  color: cssVarV2('icon/secondary'),
  flexShrink: 0,
  marginRight: 6,
  transition: 'color 0.16s ease',
  selectors: {
    [`${groupHeaderButton}:is(:hover, :focus-visible) &, ${groupHeaderActive} &`]: {
      color: cssVarV2('icon/primary'),
    },
  },
});

export const groupCollapseArrow = style({
  fontSize: 8,
  opacity: 0.4,
  transition: 'transform 0.15s ease',
});

export const groupCollapseArrowCollapsed = style({
  transform: 'rotate(-90deg)',
});

export const groupContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '1px 2px 4px',
});

export const tabButton = style({
  width: '100%',
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'flex-start',
  padding: '8px 10px',
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 550,
  lineHeight: '19px',
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(135%)',
  transition: 'background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, transform 0.16s ease',
  textAlign: 'left',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      transform: 'translateY(-0.5px)',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const tabButtonIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  color: cssVarV2('icon/secondary'),
  flexShrink: 0,
  selectors: {
    [`${tabButton}:is(:hover, [aria-selected="true"]) &`]: {
      color: cssVarV2('icon/primary'),
    },
  },
});

export const tabButtonActive = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/hoverOverlay'),
  border: `0.5px solid ${cssVarV2('button/primary')}`,
  boxShadow: '0 7px 18px rgba(0, 0, 0, 0.16)',
  transform: 'translateY(-0.5px)',
});
