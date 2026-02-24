import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const tabList = style({
  display: 'flex',
  gap: 4,
  marginBottom: 8,
  marginTop: 4,
  flexWrap: 'wrap',
});

export const tabButton = style({
  appearance: 'none',
  padding: '4px 10px',
  fontSize: 10,
  borderRadius: 6,
  cursor: 'pointer',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(130%)',
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  fontWeight: 500,
  transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const tabButtonActive = style({
  borderColor: cssVarV2('button/primary'),
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/primary'),
  fontWeight: 700,
});

export const panel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const panelHelp = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginBottom: 2,
});

export const textarea = style({
  resize: 'vertical',
});

export const fieldset = style({
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 8,
  padding: '8px 10px',
  margin: 0,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const legend = style({
  fontSize: 10,
  fontWeight: 700,
  padding: '0 4px',
  color: cssVarV2('text/secondary'),
});

export const fieldsetActions = style({
  display: 'flex',
  gap: 6,
  marginBottom: 6,
  flexWrap: 'wrap',
});

export const microButton = style({
  appearance: 'none',
  fontSize: 10,
  padding: '3px 8px',
  cursor: 'pointer',
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/secondary'),
  transition: 'background 0.12s ease, color 0.12s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const optionList = style({
  maxHeight: 160,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const optionRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 6,
  border: `1px solid transparent`,
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-within': {
      borderColor: cssVarV2('button/primary'),
    },
  },
});

export const optionMeta = style({
  color: cssVarV2('text/secondary'),
  fontSize: 10,
});

export const optionMetaAuto = style({
  marginLeft: 'auto',
});

export const optionMetaDanger = style({
  color: cssVarV2('status/error'),
});

export const matterList = style({
  maxHeight: 180,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const matterCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '6px 8px',
  borderRadius: 8,
  border: `1px solid transparent`,
  background: 'transparent',
  selectors: {
    '&[data-selected="true"]': {
      background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
      borderColor: glassStroke,
      backdropFilter: 'blur(10px) saturate(135%)',
    },
  },
});

export const matterMainRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  cursor: 'pointer',
});

export const matterTitle = style({
  fontWeight: 600,
});

export const matterDetails = style({
  marginLeft: 22,
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const inlineWarn = style({
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const infoBanner = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  padding: '8px 10px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const warnBanner = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
  padding: '8px 10px',
  background: cssVarV2('status/error'),
  borderRadius: 8,
  border: `0.5px solid rgba(255, 59, 48, 0.30)`,
});

export const emptyCompact = style({
  fontSize: 12,
  padding: '10px 0',
});

export const statusChipBgVar = createVar('status-chip-bg');
export const statusChipFgVar = createVar('status-chip-fg');
export const accentColorVar = createVar('accent-color');
export const progressWidthVar = createVar('progress-width');

export const statusChip = style({
  vars: {
    [statusChipBgVar]: cssVarV2('layer/background/secondary'),
    [statusChipFgVar]: cssVarV2('text/secondary'),
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  background: statusChipBgVar,
  color: statusChipFgVar,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const opCard = style({
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  boxShadow: `inset 3px 0 0 ${accentColorVar}`,
});

export const opHeaderRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
  flexWrap: 'wrap',
});

export const opBadge = style({
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 999,
  background: statusChipBgVar,
  color: statusChipFgVar,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const opTitle = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const progressTrack = style({
  width: '100%',
  height: 6,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  overflow: 'hidden',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const progressFill = style({
  vars: {
    [progressWidthVar]: '0%',
  },
  width: progressWidthVar,
  height: '100%',
  borderRadius: 999,
  background: accentColorVar,
  transition: 'width 0.3s ease',
});

export const opSummary = style({
  marginTop: 6,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const opDetails = style({
  marginTop: 8,
});

export const opDetailsSummary = style({
  fontSize: 10,
  cursor: 'pointer',
  color: cssVarV2('text/secondary'),
});

export const resultsList = style({
  listStyle: 'none',
  margin: '8px 0 0',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const resultItemSuccess = style({
  fontSize: 10,
  color: cssVarV2('status/success'),
});

export const resultItemFail = style({
  fontSize: 10,
  color: cssVarV2('status/error'),
});

export const resultItemMore = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});
