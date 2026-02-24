import { cssVarV2 } from '@toeverything/theme/v2';
import { keyframes, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../layouts/workspace-list-shared-styles';

const cardReveal = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(3px) scale(0.996)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});

const pulseGlow = keyframes({
  '0%, 100%': {
    boxShadow: `0 0 0 1px color-mix(in srgb, ${cssVarV2('button/primary')} 24%, transparent)`,
  },
  '50%': {
    boxShadow: `0 0 0 1px color-mix(in srgb, ${cssVarV2('button/primary')} 42%, transparent), 0 8px 16px color-mix(in srgb, ${cssVarV2('button/primary')} 18%, transparent)`,
  },
});

export const chatRoot = style({
  width: '100%',
  height: '100%',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 94%, rgba(2,6,23,0.24)) 0%, color-mix(in srgb, var(--affine-background-primary-color) 90%, rgba(2,6,23,0.12)) 100%)',
});

export const sidebarStatusRail = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '16px 14px',
  minWidth: 0,
  borderLeft: `1px solid color-mix(in srgb, ${glassStroke} 75%, var(--affine-border-color))`,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 86%, rgba(15,23,42,0.2)) 0%, color-mix(in srgb, var(--affine-background-primary-color) 80%, rgba(15,23,42,0.14)) 100%)',
});

export const contextPanelStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
});

export const statusCard = style({
  borderRadius: 12,
  border: `1px solid color-mix(in srgb, ${glassStroke} 75%, var(--affine-border-color))`,
  padding: '14px 16px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 93%, rgba(2,6,23,0.14))`,
  backdropFilter: 'blur(14px) saturate(140%)',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  animation: `${cardReveal} 220ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
  transition: 'border-color 0.18s ease, box-shadow 0.2s ease, transform 0.18s ease',
  selectors: {
    '&:hover': {
      borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 36%, ${glassStroke})`,
      boxShadow: '0 14px 34px rgba(15, 23, 42, 0.16)',
      transform: 'translateY(-1px)',
    },
  },
});

export const statusTitle = style({
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.01em',
});

export const statusValue = style({
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.3,
  color: cssVarV2('text/primary'),
});

export const statusMeta = style({
  margin: 0,
  fontSize: 12,
  lineHeight: '20px',
  color: cssVarV2('text/secondary'),
});

export const statusSessionList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 260,
  overflowY: 'auto',
  paddingRight: 2,
});

export const statusSessionItem = style({
  borderRadius: 10,
  border: `1px solid color-mix(in srgb, ${glassStroke} 72%, var(--affine-border-color))`,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 84%, rgba(15, 23, 42, 0.12))',
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  transition: 'border-color 0.16s ease, background 0.16s ease, transform 0.12s ease',
  selectors: {
    '&:hover': {
      transform: 'translateY(-1px)',
    },
  },
});

export const statusSessionItemActive = style({
  borderColor: cssVarV2('button/primary'),
  boxShadow: `0 0 0 1px color-mix(in srgb, ${cssVarV2('button/primary')} 36%, transparent)`,
  animation: `${pulseGlow} 2.2s ease-in-out infinite`,
});

export const statusSessionSelect = style({
  border: 'none',
  background: 'transparent',
  color: cssVarV2('text/primary'),
  textAlign: 'left',
  padding: 0,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
      borderRadius: 6,
    },
  },
});

export const statusSessionTitle = style({
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const statusSessionMeta = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
});

export const statusSessionActions = style({
  display: 'flex',
  gap: 6,
});

export const statusMiniAction = style({
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  color: cssVarV2('text/secondary'),
  minHeight: 28,
  padding: '0 8px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease, transform 0.08s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
    },
    '&:active': {
      transform: 'translateY(0.5px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
});

export const statusMiniActionDanger = style([
  statusMiniAction,
  {
    color: cssVarV2('status/error'),
    borderColor: cssVarV2('status/error'),
  },
]);

export const statusModeGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
});

export const statusModeButton = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  color: cssVarV2('text/secondary'),
  minHeight: 36,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease, transform 0.1s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
      transform: 'translateY(-0.5px)',
    },
    '&:active': {
      transform: 'translateY(0.5px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const statusModeButtonActive = style({
  borderColor: cssVarV2('button/primary'),
  color: cssVarV2('text/primary'),
  background: 'color-mix(in srgb, var(--affine-primary-color) 16%, transparent)',
});
