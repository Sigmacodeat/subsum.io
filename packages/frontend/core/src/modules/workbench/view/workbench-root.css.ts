import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const workbenchRootContainer = style({
  display: 'flex',
  height: '100%',
  flex: 1,
});

export const workbenchViewContainer = style({
  flex: 1,
  overflow: 'hidden',
  height: '100%',
});

export const workbenchSidebar = style({
  display: 'flex',
  flexShrink: 0,
  height: '100%',
  right: 0,
  transition: 'background-color .2s ease, box-shadow .2s ease',
  selectors: {
    [`&[data-client-border=true]`]: {
      paddingLeft: 10,
      borderRadius: 10,
    },
    [`&[data-client-border=false]`]: {
      borderLeft: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
      background: cssVarV2.layer.background.secondary,
      boxShadow: '-8px 0 18px rgba(15, 23, 42, 0.05)',
    },
    '[data-theme="dark"] &[data-client-border=false]': {
      boxShadow: '-8px 0 20px rgba(0, 0, 0, 0.2)',
    },
    '&[data-open="true"][data-is-floating="true"]': {
      zIndex: 101,
    },
  },
});

export const chatWidgetButton = style({
  position: 'fixed',
  right: 20,
  bottom: 20,
  zIndex: 60,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 999,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--affine-primary-color) 84%, #0ea5e9 16%) 0%, color-mix(in srgb, var(--affine-primary-color) 72%, #38bdf8 28%) 100%)',
  color: cssVarV2.text.primary,
  boxShadow: '0 14px 32px rgba(2, 6, 23, 0.24)',
  cursor: 'pointer',
  transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  selectors: {
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 18px 38px rgba(2, 6, 23, 0.3)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2.button.primary}`,
      outlineOffset: 2,
    },
  },
  '@media': {
    'screen and (max-width: 1024px)': {
      right: 14,
      bottom: 14,
      padding: '9px 12px',
    },
    print: {
      display: 'none',
    },
  },
});

export const chatWidgetLabel = style({
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 700,
  letterSpacing: '0.01em',
});

export const rightSidebarFloatMask = style({
  transition: 'opacity .15s',
  opacity: 0,
  pointerEvents: 'none',
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: cssVarV2.layer.background.modal,
  backdropFilter: 'blur(2px)',
  selectors: {
    '&[data-open="true"][data-is-floating="true"]': {
      opacity: 1,
      pointerEvents: 'auto',
      zIndex: 100,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    print: {
      display: 'none',
    },
  },
});
