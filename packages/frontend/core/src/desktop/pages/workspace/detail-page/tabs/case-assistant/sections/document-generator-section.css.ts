import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const contextBadge = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  flexWrap: 'wrap',
});

export const contextBadgeTitle = style({
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const metaText = style({
  color: cssVarV2('text/secondary'),
});

export const stepBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 0 4px',
});

export const stepBlockSeparated = style({
  borderTop: `0.5px solid ${glassStroke}`,
});

export const stepLabel = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const infoBanner = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  padding: '8px 10px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const warnBanner = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  padding: '8px 10px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const inlineRow = style({
  display: 'flex',
  gap: 6,
  alignItems: 'center',
});

export const grow = style({
  flex: 1,
});

export const compactSelect = style({
  width: 'auto',
  minWidth: 44,
  fontSize: 10,
  padding: '2px 6px',
});

export const autoMetaRow = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  padding: '6px 10px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const autoMetaSpacer = style({
  marginLeft: 'auto',
  fontStyle: 'italic',
});

export const previewCardSpaced = style({
  marginTop: 4,
});
