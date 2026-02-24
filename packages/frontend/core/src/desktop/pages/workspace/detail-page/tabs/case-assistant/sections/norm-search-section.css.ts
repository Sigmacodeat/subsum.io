import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();

export const filterRow = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginBottom: 8,
  marginTop: 4,
});

export const filterButton = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [borderVar]: glassStroke,
  },
  padding: '2px 8px',
  fontSize: 9,
  borderRadius: 4,
  cursor: 'pointer',
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  background: 'transparent',
  color: accentColorVar,
  fontWeight: 400,
});

export const filterButtonActive = style({
  fontWeight: 700,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const resultsList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

export const resultItem = style({
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  overflow: 'hidden',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const resultButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
});

export const resultMain = style({
  flex: 1,
  minWidth: 0,
});

export const badgeRow = style({
  display: 'flex',
  gap: 5,
  alignItems: 'center',
  marginBottom: 3,
  flexWrap: 'wrap',
});

export const lawBadge = style({
  vars: { [accentColorVar]: cssVarV2('button/primary') },
  fontSize: 10,
  fontWeight: 800,
  color: cssVarV2('button/pureWhiteText'),
  background: accentColorVar,
  borderRadius: 3,
  padding: '1px 6px',
  flexShrink: 0,
});

export const tinyMuted = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const typeBadge = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 3,
  padding: '1px 5px',
  flexShrink: 0,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const matchText = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 9,
  color: accentColorVar,
  fontWeight: 700,
  flexShrink: 0,
});

export const title = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const titleExpanded = style({
  whiteSpace: 'normal',
});

export const subtitle = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginTop: 2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const rightActions = style({
  display: 'flex',
  gap: 4,
  flexShrink: 0,
  alignItems: 'center',
});

export const copyButton = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: 'transparent',
  },
  padding: '2px 6px',
  fontSize: 9,
  borderRadius: 3,
  border: `0.5px solid ${glassStroke}`,
  background: surfaceVar,
  color: accentColorVar,
  cursor: 'pointer',
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

export const caret = style({
  fontSize: 9,
  opacity: 0.4,
  color: cssVarV2('text/secondary'),
});

export const expandedPanel = style({
  padding: '0 10px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const summaryBox = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  padding: '5px 8px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 4,
  lineHeight: 1.5,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const sectionLabel = style({
  fontSize: 9,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const prereqList = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const prereqItem = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  display: 'flex',
  gap: 5,
});

export const prereqIndex = style({
  color: cssVarV2('button/primary'),
  flexShrink: 0,
});

export const consequenceBox = style({
  padding: '4px 8px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 4,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const consequenceTitle = style({
  fontSize: 9,
  fontWeight: 700,
  color: cssVarV2('status/success'),
  marginBottom: 2,
});

export const consequenceText = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
});

export const metaLine = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const keywordsRow = style({
  display: 'flex',
  gap: 3,
  flexWrap: 'wrap',
});

export const keywordPill = style({
  fontSize: 9,
  padding: '1px 5px',
  borderRadius: 3,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  color: cssVarV2('button/primary'),
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const emptyCompact = style({
  fontSize: 11,
  padding: '8px 0',
});
