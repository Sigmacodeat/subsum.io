import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const sidebarContainerInner = style({
  display: 'flex',
  background: cssVar('backgroundPrimaryColor'),
  boxShadow: '-8px 0 20px rgba(15, 23, 42, 0.06)',
  flexDirection: 'column',
  overflow: 'hidden',
  height: '100%',
  minHeight: 0,
  width: '100%',
  borderRadius: 'inherit',
  selectors: {
    ['[data-theme="dark"] &']: {
      boxShadow: '-8px 0 22px rgba(0, 0, 0, 0.24)',
    },
    '&[data-is-floating="true"]': {
      height: '100dvh',
      maxHeight: '100dvh',
    },
    ['[data-client-border=true] &']: {
      borderRadius: 6,
      border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
    },
    ['[data-client-border=true][data-is-floating="true"] &']: {
      boxShadow: cssVar('shadow3'),
      border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
    },
  },
});

export const sidebarBodyTarget = style({
  display: 'flex',
  flexDirection: 'column',
  height: 0,
  flex: 1,
  minHeight: 0,
  width: '100%',
  alignItems: 'stretch',
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
});

export const borderTop = style({
  borderTop: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const sidebarBodyNoSelection = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  justifyContent: 'center',
  padding: 24,
  userSelect: 'none',
  color: cssVar('--affine-text-secondary-color'),
  alignItems: 'center',
  textAlign: 'center',
  lineHeight: 1.4,
  fontSize: 14,
});

export const visuallyHidden = style({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});
