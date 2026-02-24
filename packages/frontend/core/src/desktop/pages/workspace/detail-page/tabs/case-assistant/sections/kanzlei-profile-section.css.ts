import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const chipNotSetup = style({
  color: cssVarV2('text/secondary'),
});

export const interactiveSummary = style({
  cursor: 'pointer',
  userSelect: 'none',
  padding: '4px 0',
});

export const interactiveSummarySmall = style({
  cursor: 'pointer',
  userSelect: 'none',
  padding: '4px 0',
  fontSize: 11,
});

export const emptyCtaRow = style({
  marginTop: 8,
});

export const profileStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const logoBlock = style({
  marginBottom: 4,
});

export const logoImg = style({
  maxHeight: 56,
  maxWidth: 200,
  objectFit: 'contain',
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const profileName = style({
  fontWeight: 600,
  fontSize: 14,
  color: cssVarV2('text/primary'),
});

export const metaWrapRow = style({
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
});

export const logoRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 4,
  flexWrap: 'wrap',
});

export const logoPreviewImg = style({
  maxHeight: 48,
  maxWidth: 160,
  objectFit: 'contain',
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const logoPlaceholder = style({
  width: 80,
  height: 48,
  border: `2px dashed ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
});

export const logoButtonCol = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const logoButtonSmall = style({
  fontSize: 11,
});

export const dangerPlainButton = style({
  color: cssVarV2('status/error'),
});

export const hiddenFileInput = style({
  display: 'none',
});

export const logoHint = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginTop: 2,
});

export const detailsContentTop = style({
  marginTop: 6,
});

export const anwaltToggleButton = style({
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 10,
  padding: '6px 8px',
  borderRadius: 10,
  textAlign: 'left',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const anwaltIcon = style({
  fontSize: 14,
  flexShrink: 0,
});

export const anwaltName = style({
  flex: 1,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const anwaltRoleChipSmall = style({
  fontSize: 10,
});

export const collapseArrow = style({
  fontSize: 10,
  opacity: 0.5,
});

export const anwaltDetails = style({
  marginTop: 6,
  paddingLeft: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const formActionsTop = style({
  marginTop: 4,
});
