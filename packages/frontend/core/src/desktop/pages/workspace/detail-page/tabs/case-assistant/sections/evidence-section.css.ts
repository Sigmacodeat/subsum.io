import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const widthVar = createVar();

export const emptyCompact = style({
  fontSize: 11,
  padding: '10px 0',
});

export const tabRow = style({
  display: 'flex',
  gap: 4,
  marginBottom: 8,
  marginTop: 4,
});

export const tabButton = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  padding: '3px 10px',
  fontSize: 10,
  borderRadius: 4,
  cursor: 'pointer',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  background: 'transparent',
  color: accentColorVar,
  fontWeight: 400,
});

export const tabButtonActive = style({
  fontWeight: 700,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const item = style({
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  overflow: 'hidden',
});

export const itemButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  padding: '7px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const artIcon = style({
  fontSize: 11,
  flexShrink: 0,
});

export const itemTitle = style({
  flex: 1,
  fontSize: 11,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/primary'),
});

export const strengthRow = style({
  display: 'flex',
  gap: 4,
  alignItems: 'center',
  flexShrink: 0,
});

export const strengthTrack = style({
  width: 40,
  height: 4,
  borderRadius: 2,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  overflow: 'hidden',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const strengthFill = style({
  vars: {
    [widthVar]: '10%',
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  width: widthVar,
  height: '100%',
  background: accentColorVar,
  borderRadius: 2,
});

export const strengthLabel = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 9,
  color: accentColorVar,
  fontWeight: 700,
});

export const caret = style({
  fontSize: 9,
  opacity: 0.4,
  color: cssVarV2('text/secondary'),
});

export const expandedPanel = style({
  padding: '0 10px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
});

export const detailText = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
});

export const detailMuted = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const detailAccent = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('button/primary'),
});

export const gapItem = style({
  padding: '7px 10px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid rgba(255, 59, 48, 0.28)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const gapTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('status/error'),
  marginBottom: 2,
});

export const gapDesc = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
});

export const gapHint = style({
  fontSize: 10,
  color: cssVarV2('button/primary'),
  marginTop: 3,
});

export const noGaps = style({
  fontSize: 11,
  color: cssVarV2('status/success'),
  padding: '8px 0',
});
