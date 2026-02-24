import { cssVar, lightCssVariables } from '@toeverything/theme';
import { globalStyle, style } from '@vanilla-extract/css';

export const appStyle = style({
  width: '100%',
  position: 'relative',
  height: '100dvh',
  minHeight: 0,
  flexGrow: '1',
  display: 'flex',
  isolation: 'isolate',
  overflow: 'hidden',
  backgroundColor: cssVar('backgroundPrimaryColor'),
  backgroundImage:
    'radial-gradient(1200px 680px at 8% -8%, var(--affine-theme-accent-soft, transparent) 0%, transparent 58%), radial-gradient(900px 540px at 100% 0%, var(--affine-theme-bg-tint, transparent) 0%, transparent 62%), linear-gradient(180deg, var(--affine-theme-bg-tint, transparent) 0%, transparent 48%)',
  selectors: {
    '&.blur-background': {
      backgroundColor: 'transparent',
    },
    '&.noisy-background::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      opacity: `var(--affine-noise-opacity, 0)`,
      backgroundRepeat: 'repeat',
      backgroundSize: '50px',
      // TODO(@Peng): figure out how to use vanilla-extract webpack plugin to inject img url
      backgroundImage: `var(--noise-background)`,
      pointerEvents: 'none',
      zIndex: 0,
    },
  },
});
// Noise opacity & print fallback — per-variant values are set by
// applyThemeVariantVariables at runtime; CSS only provides the base defaults.
globalStyle(`html[data-theme="dark"] ${appStyle}`, {
  '@media': {
    print: {
      vars: lightCssVariables,
    },
  },
});

export const browserAppViewContainer = style({
  display: 'flex',
  flexFlow: 'row',
  height: '100%',
  width: '100%',
  position: 'relative',
});

export const desktopAppViewContainer = style({
  display: 'flex',
  flexFlow: 'column',
  height: '100%',
  minHeight: 0,
  width: '100%',
});

export const desktopAppViewMain = style({
  display: 'flex',
  flexFlow: 'row',
  width: '100%',
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  position: 'relative',
  transition: 'background-color .2s ease, background-image .2s ease',
  background:
    'linear-gradient(90deg, color-mix(in srgb, var(--affine-theme-bg-tint, transparent) 42%, var(--affine-background-secondary-color) 58%) 0%, color-mix(in srgb, var(--affine-background-primary-color) 92%, var(--affine-background-secondary-color) 8%) 22%, color-mix(in srgb, var(--affine-background-primary-color) 92%, var(--affine-background-secondary-color) 8%) 78%, color-mix(in srgb, var(--affine-theme-bg-tint, transparent) 42%, var(--affine-background-secondary-color) 58%) 100%)',
  selectors: {
    '[data-theme="dark"] &': {
      background: cssVar('backgroundPrimaryColor'),
    },
  },
});

export const desktopTabsHeader = style({
  display: 'flex',
  flexFlow: 'row',
  height: '44px',
  flexShrink: 0,
  zIndex: 2,
  width: '100%',
  overflow: 'hidden',
  background: 'color-mix(in srgb, var(--affine-background-secondary-color) 88%, transparent)',
  borderBottom: `0.5px solid ${cssVar('borderColor')}`,
  backdropFilter: 'blur(14px) saturate(1.1)',
});

export const mainContainerStyle = style({
  position: 'relative',
  zIndex: 0,
  width: '100%',
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flex: 1,
  maxWidth: '100%',
  backgroundColor:
    'color-mix(in srgb, var(--affine-background-primary-color) 92%, var(--affine-background-secondary-color) 8%)',
  transition: 'background-color .2s ease',

  selectors: {
    '[data-theme="dark"] &': {
      backgroundColor: cssVar('backgroundPrimaryColor'),
    },
    '&[data-client-border="true"]': {
      borderRadius: 12,
      padding: '10px',
      background:
        'linear-gradient(180deg, color-mix(in srgb, var(--affine-theme-bg-tint, transparent) 65%, transparent) 0%, transparent 100%)',
      '@media': {
        print: {
          overflow: 'visible',
          padding: '0px',
          borderRadius: '0px',
        },
      },
    },
    '&[data-client-border="true"][data-side-bar-open="true"]': {
      paddingLeft: 2,
    },
    '&[data-client-border="true"][data-is-desktop="true"]': {
      paddingTop: 0,
    },
    '&[data-client-border="false"][data-is-desktop="true"][data-side-bar-open="true"]':
      {
        borderTopLeftRadius: 6,
      },
    '&[data-client-border="false"][data-is-desktop="true"]': {
      borderTop: `0.5px solid ${cssVar('borderColor')}`,
      borderLeft: `0.5px solid ${cssVar('borderColor')}`,
    },
    '&[data-transparent=true]': {
      backgroundColor: 'transparent',
    },
  },
});
