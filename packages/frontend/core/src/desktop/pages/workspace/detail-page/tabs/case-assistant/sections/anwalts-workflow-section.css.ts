import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const root = style({
  padding: 12,
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 10,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(14px) saturate(140%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const title = style({
  margin: 0,
  marginBottom: 10,
  fontSize: 14,
  color: cssVarV2('text/primary'),
});

export const feedback = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  minHeight: 18,
});

export const tabList = style({
  display: 'flex',
  gap: 6,
  marginBottom: 10,
  flexWrap: 'wrap',
});

export const tabButton = style({
  appearance: 'none',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent)',
  color: cssVarV2('text/secondary'),
  transition: 'background 0.12s ease, border-color 0.12s ease',
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

export const tabButtonActive = style({
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  color: cssVarV2('text/primary'),
});

export const tabButtonDangerActive = style({
  background: 'rgba(255, 59, 48, 0.12)',
  color: cssVarV2('status/error'),
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

export const tabPanel = style({
  display: 'grid',
  gap: 8,
});

export const row = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
});

export const flex1 = style({
  flex: 1,
});

export const narrowInput = style({
  width: 90,
});

export const emptyText = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const listItemRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  borderTop: `0.5px solid ${glassStroke}`,
  paddingTop: 6,
  fontSize: 12,
});

export const listItemBlock = style({
  borderTop: `0.5px solid ${glassStroke}`,
  paddingTop: 6,
  fontSize: 12,
});

export const preWrap = style({
  whiteSpace: 'pre-wrap',
});
