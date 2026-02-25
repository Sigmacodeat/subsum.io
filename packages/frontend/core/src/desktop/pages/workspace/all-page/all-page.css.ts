import { style } from '@vanilla-extract/css';

import {
  interactionTransition,
  layoutGutter,
  layoutGutterMd,
  layoutGutterSm,
  stickyFilterBarStyle,
  surfaceEnter,
  workspaceAmbientBackground,
} from '../layouts/workspace-list-shared-styles';

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  containerName: 'docs-body',
  containerType: 'size',
  background: workspaceAmbientBackground,
});

export const topControls = style({
  ...stickyFilterBarStyle('docs-body'),
  gap: 10,
  paddingTop: 12,
  paddingBottom: 10,
  '@container': {
    'docs-body (width <= 500px)': {
      gap: 8,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: `${layoutGutterMd}px`,
      paddingRight: `${layoutGutterMd}px`,
    },
  },
});

export const scopeToggle = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: `0 ${layoutGutter}px`,
  '@container': {
    'docs-body (width <= 500px)': {
      padding: `0 ${layoutGutterMd}px`,
    },
    'docs-body (width <= 393px)': {
      padding: `0 ${layoutGutterSm}px`,
    },
  },
});

export const scopeToggleButton = style({
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&[data-active="true"]': {
      background: 'var(--affine-primary-color)',
      borderColor: 'var(--affine-primary-color)',
      color: 'var(--affine-white)',
    },
    '&:hover': {
      borderColor: 'var(--affine-primary-color)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--affine-primary-color)',
      outlineOffset: 1,
    },
  },
});

export const scrollArea = style({
  height: 0,
  flex: 1,
  paddingTop: '10px',
  paddingBottom: '14px',
  paddingLeft: `${layoutGutter}px`,
  paddingRight: `${layoutGutter}px`,
  overflowY: 'auto',
  '@container': {
    'docs-body (width <= 500px)': {
      paddingLeft: `${layoutGutterMd}px`,
      paddingRight: `${layoutGutterMd}px`,
    },
    'docs-body (width <= 393px)': {
      paddingLeft: `${layoutGutterSm}px`,
      paddingRight: `${layoutGutterSm}px`,
    },
  },
});

// group

export const pinnedCollection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: `0 ${layoutGutter}px`,
  '@container': {
    'docs-body (width <= 500px)': {
      padding: `0 ${layoutGutterMd}px`,
    },
    'docs-body (width <= 393px)': {
      padding: `0 ${layoutGutterSm}px`,
    },
  },
});

export const filterArea = style({
  padding: `0 ${layoutGutter}px`,
  '@container': {
    'docs-body (width <= 500px)': {
      padding: `0 ${layoutGutterMd}px`,
    },
    'docs-body (width <= 393px)': {
      padding: `0 ${layoutGutterSm}px`,
    },
  },
});

export const filterInnerArea = style({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
});

export const filters = style({
  flex: 1,
});

export const docsSurface = style({
  minHeight: '100%',
  borderRadius: 0,
  border: 'none',
  background: 'transparent',
  backdropFilter: 'none',
  boxShadow: 'none',
  overflow: 'visible',
  animation: `${surfaceEnter} 280ms cubic-bezier(0.22, 1, 0.36, 1) both`,
  transition: interactionTransition,
  '@container': {
    'docs-body (width <= 500px)': {
      borderRadius: 0,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
      transition: 'none',
    },
  },
});
