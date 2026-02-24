import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const mainContainer = style({
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
  borderTop: `0.5px solid transparent`,
  transition: 'border-color 0.2s',
  selectors: {
    '&[data-dynamic-top-border="false"]': {
      borderColor: cssVar('borderColor'),
    },
    '&[data-has-scroll-top="true"]': {
      borderColor: cssVar('borderColor'),
    },
  },
});

export const editorContainer = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  zIndex: 0,
});
// brings styles of .affine-page-viewport from blocksuite
export const affineDocViewport = style({
  display: 'flex',
  flexDirection: 'column',
  containerName: 'viewport',
  containerType: 'inline-size',
  background: cssVar('backgroundPrimaryColor'),
  selectors: {
    '&[data-dragging="true"]': {
      backgroundColor: cssVarV2.layer.background.hoverOverlay,
    },
    '[data-theme="light"] &': {
      background:
        'linear-gradient(180deg, rgba(30, 150, 252, 0.04) 0%, rgba(255, 255, 255, 0) 240px), ' +
        cssVar('backgroundPrimaryColor'),
    },
    '[data-theme="dark"] &': {
      background:
        'linear-gradient(180deg, rgba(30, 150, 252, 0.06) 0%, rgba(0, 0, 0, 0) 260px), ' +
        cssVar('backgroundPrimaryColor'),
    },
  },
  '@media': {
    print: {
      display: 'none',
      zIndex: -1,
    },
  },
});

export const pageModeViewportContentBox = style({});
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>[data-affine-editor-container])`,
  { display: 'table !important', minWidth: '100%' }
);
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>[data-editor-loading="true"]) > [data-editor-loading="true"]`,
  { flex: 1, minHeight: '100%' }
);

export const scrollbar = style({
  marginRight: '4px',
});

export const sidebarScrollArea = style({
  height: '100%',
});

export const akteContextBanner = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 16px',
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2('text/secondary'),
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 90%, transparent) 0%, color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent) 100%)',
  backdropFilter: 'blur(14px) saturate(140%)',
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  flexShrink: 0,
});

export const akteContextLink = style({
  cursor: 'pointer',
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});
