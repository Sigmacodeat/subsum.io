import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';
export const linkItemRoot = style({
  color: 'inherit',
});
export const root = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '8px',
  textAlign: 'left',
  color: 'inherit',
  width: '100%',
  minHeight: '34px',
  userSelect: 'none',
  cursor: 'pointer',
  padding: '0 6px 0 0',
  fontSize: cssVar('fontSm'),
  fontWeight: 500,
  marginTop: '2px',
  position: 'relative',
  willChange: 'transform, box-shadow, background-color',
  transition:
    'background 0.22s cubic-bezier(0.22, 1, 0.36, 1), color 0.18s ease, box-shadow 0.22s ease, border-color 0.18s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), width 0.2s cubic-bezier(0.22, 1, 0.36, 1), padding 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
      color: cssVarV2.text.primary,
    },
    '&[data-active="true"]': {
      background: cssVarV2.layer.background.hoverOverlay,
      color: cssVarV2.text.primary,
      fontWeight: 600,
    },
    '&[data-active="true"]::before': {
      content: '""',
      position: 'absolute',
      left: '-8px',
      top: '7px',
      bottom: '7px',
      width: '3px',
      borderRadius: '0 3px 3px 0',
      background: cssVarV2.button.primary,
    },
    '&[data-disabled="true"]': {
      cursor: 'default',
      color: cssVarV2.text.disable,
      pointerEvents: 'none',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2.button.primary}`,
      outlineOffset: 2,
    },
    '&[data-collapsible="true"]': {
      paddingLeft: '4px',
      paddingRight: '4px',
    },
    '&[data-collapsible="false"]:is([data-active="true"], :hover)': {
      width: 'calc(100% + 8px + 8px)',
      transform: 'translate3d(-8px, 0, 0)',
      paddingLeft: '8px',
      paddingRight: '10px',
    },
    [`${linkItemRoot}:first-of-type &`]: {
      marginTop: '0px',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
      selectors: {
        '&:hover': {
          transform: 'none',
        },
      },
    },
  },
});
export const content = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
});
export const postfix = style({
  right: '4px',
  position: 'absolute',
  opacity: 0,
  pointerEvents: 'none',
  selectors: {
    [`${root}:hover &, &[data-postfix-display="always"]`]: {
      justifySelf: 'flex-end',
      position: 'initial',
      opacity: 1,
      pointerEvents: 'all',
    },
  },
});
export const icon = style({
  color: cssVarV2('icon/secondary'),
  fontSize: '18px',
  transition: 'color 0.16s ease',
  selectors: {
    [`${root}:is(:hover, [data-active="true"]) &`]: {
      color: cssVarV2('icon/primary'),
    },
  },
});
export const collapsedIconContainer = style({
  width: '16px',
  height: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '2px',
  transition: 'transform 0.2s ease, background 0.16s ease, color 0.16s ease',
  color: 'inherit',
  selectors: {
    '&[data-collapsed="true"]': {
      transform: 'rotate(-90deg)',
    },
    '&[data-disabled="true"]': {
      opacity: 0.3,
      pointerEvents: 'none',
    },
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
  },
});
export const iconsContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  width: '30px',
  flexShrink: 0,
  selectors: {
    '&[data-collapsible="true"]': {
      width: '40px',
    },
  },
});
export const collapsedIcon = style({
  transition: 'transform 0.2s ease-in-out',
  selectors: {
    '&[data-collapsed="true"]': {
      transform: 'rotate(-90deg)',
    },
  },
});
export const spacer = style({
  flex: 1,
});
