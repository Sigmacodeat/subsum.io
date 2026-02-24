import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const section = style({
  padding: 12,
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 10,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(14px) saturate(140%)',
});

export const heading = style({
  margin: 0,
  marginBottom: 10,
  fontSize: 14,
  color: cssVarV2('text/primary'),
});

export const feedback = style({
  fontSize: 12,
  color: cssVarV2('text/primary'),
  minHeight: 18,
});

export const warningBox = style({
  fontSize: 12,
  color: cssVarV2('text/primary'),
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  borderRadius: 6,
  padding: 8,
});

export const formGrid = style({
  display: 'grid',
  gap: 8,
});

export const twoCol = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
});

export const control = style({
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  color: cssVarV2('text/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const actionRow = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
});

export const actionButton = style({
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  color: cssVarV2('text/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  cursor: 'pointer',
  selectors: {
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const activeBox = style({
  fontSize: 12,
  color: cssVarV2('text/primary'),
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  borderRadius: 6,
  padding: 8,
});

export const muted = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const historyItem = style({
  borderTop: `0.5px solid ${glassStroke}`,
  paddingTop: 6,
  fontSize: 12,
  color: cssVarV2('text/primary'),
});
