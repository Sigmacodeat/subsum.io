import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import {
  glassFill,
  glassStroke,
  interactionTransition,
  layoutGutter,
  layoutGutterMd,
  layoutGutterSm,
} from './workspace-list-shared-styles';

export const bar = style({
  position: 'sticky',
  bottom: 12,
  zIndex: 5,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  padding: `0 ${layoutGutter}px`,
  '@container': {
    'akten-body (width <= 500px)': {
      padding: `0 ${layoutGutterMd}px`,
    },
    'akten-body (width <= 393px)': {
      padding: `0 ${layoutGutterSm}px`,
    },
    'mandanten-body (width <= 500px)': {
      padding: `0 ${layoutGutterMd}px`,
    },
    'mandanten-body (width <= 393px)': {
      padding: `0 ${layoutGutterSm}px`,
    },
    'fristen-body (width <= 500px)': {
      padding: `0 ${layoutGutterMd}px`,
    },
    'fristen-body (width <= 393px)': {
      padding: `0 ${layoutGutterSm}px`,
    },
    'akte-detail-body (width <= 500px)': {
      padding: `0 ${layoutGutterMd}px`,
    },
    'akte-detail-body (width <= 393px)': {
      padding: `0 ${layoutGutterSm}px`,
    },
  },
});

export const card = style({
  pointerEvents: 'auto',
  width: 'min(920px, 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 16,
  border: `0.5px solid ${glassStroke}`,
  background: glassFill,
  backdropFilter: 'blur(14px) saturate(140%)',
  boxShadow:
    '0 20px 50px rgba(0, 0, 0, 0.12), 0 1px 0 rgba(255, 255, 255, 0.04) inset',
  transition: interactionTransition,
});

export const left = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
});

export const countBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 26,
  height: 26,
  padding: '0 8px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  color: cssVarV2('button/pureWhiteText'),
  background: cssVarV2('button/primary'),
  boxShadow: `0 10px 22px color-mix(in srgb, ${cssVarV2(
    'button/primary'
  )} 26%, transparent)`,
});

export const summary = style({
  fontSize: 13,
  fontWeight: 650,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const right = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
});

export const actionButton = style({
  appearance: 'none',
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 12,
  padding: '8px 12px',
  minHeight: 34,
  fontSize: 12,
  fontWeight: 750,
  lineHeight: '18px',
  cursor: 'pointer',
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 68%, transparent)',
  color: cssVarV2('text/primary'),
  backdropFilter: 'blur(10px) saturate(130%)',
  transition: interactionTransition,
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--affine-hover-color-filled)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
      transform: 'translateY(-0.5px)',
    },
    '&:active:not(:disabled)': {
      transform: 'translateY(0)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      opacity: 0.55,
      cursor: 'not-allowed',
      transform: 'none',
    },
  },
});

export const dangerButton = style([
  actionButton,
  {
    borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 34%, transparent)`,
    color: cssVarV2('status/error'),
    selectors: {
      '&:hover:not(:disabled)': {
        background: `color-mix(in srgb, ${cssVarV2('status/error')} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 48%, transparent)`,
      },
    },
  },
]);
