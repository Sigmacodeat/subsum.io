import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

const baseAction = style({
  display: 'flex',
  gap: 8,
  opacity: 0,
  transition: 'opacity 0.16s ease',
});

export const root = style({
  fontSize: 11,
  height: 24,
  width: 'calc(100%)',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 9px',
  borderRadius: 6,
  marginTop: 6,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  willChange: 'transform, background-color',
  transition:
    'background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1), color 0.18s ease, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
  selectors: {
    [`&[data-collapsible="true"]`]: {
      cursor: 'pointer',
    },
    [`&[data-collapsible="true"]:hover`]: {
      backgroundColor: cssVarV2('layer/background/hoverOverlay'),
      transform: 'translateY(-0.5px)',
    },
    [`&[data-collapsible="true"]:focus-visible`]: {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    [`&[data-collapsible="true"]:hover:has(${baseAction}:hover)`]: {
      backgroundColor: 'transparent',
      transform: 'none',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
      selectors: {
        [`&[data-collapsible="true"]:hover`]: {
          transform: 'none',
        },
      },
    },
  },
});

export const actions = style([
  baseAction,
  {
    selectors: {
      [`${root}:hover &`]: {
        opacity: 1,
      },
    },
  },
]);
export const label = style({
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
  lineHeight: '24px',
  flexGrow: '0',
  display: 'flex',
  gap: 4,
  alignItems: 'center',
  justifyContent: 'start',
  cursor: 'pointer',
  letterSpacing: '0.04em',
});

export const collapseIcon = style({
  vars: { '--y': '1px', '--r': '90deg' },
  color: cssVarV2('icon/tertiary'),
  transform: 'translateY(var(--y)) rotate(var(--r))',
  transition: 'transform 0.2s ease, color 0.16s ease',
  selectors: {
    [`${root}[data-collapsed="true"] &`]: {
      vars: { '--r': '0deg' },
    },
    [`${root}:is(:hover, :focus-visible) &`]: {
      color: cssVarV2('icon/primary'),
    },
  },
});
