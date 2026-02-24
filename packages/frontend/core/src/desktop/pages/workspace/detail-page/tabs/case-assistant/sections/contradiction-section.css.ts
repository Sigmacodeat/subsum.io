import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();

export const kpiRow = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginBottom: 8,
  marginTop: 4,
});

export const kpiChip = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
    [borderVar]: glassStroke,
  },
  padding: '3px 8px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  background: surfaceVar,
  color: accentColorVar,
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const filterRow = style({
  display: 'flex',
  gap: 4,
  marginBottom: 8,
  flexWrap: 'wrap',
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

export const emptyCompact = style({
  fontSize: 11,
  padding: '8px 0',
});

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

export const item = style({
  vars: {
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
    [borderVar]: glassStroke,
  },
  borderRadius: 6,
  border: `0.5px solid ${borderVar}`,
  background: surfaceVar,
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
  alignItems: 'flex-start',
  gap: 8,
});

export const itemMain = style({
  flex: 1,
  minWidth: 0,
});

export const badgeRow = style({
  display: 'flex',
  gap: 5,
  alignItems: 'center',
  marginBottom: 2,
  flexWrap: 'wrap',
});

export const severityBadge = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
    [borderVar]: glassStroke,
  },
  fontSize: 9,
  fontWeight: 700,
  color: accentColorVar,
  background: surfaceVar,
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  borderRadius: 3,
  padding: '1px 5px',
  flexShrink: 0,
});

export const categoryBadge = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 3,
  padding: '1px 5px',
  flexShrink: 0,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const confidence = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const description = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const descriptionExpanded = style({ whiteSpace: 'normal' });

export const caret = style({
  fontSize: 9,
  opacity: 0.4,
  flexShrink: 0,
  marginTop: 2,
  color: cssVarV2('text/secondary'),
});

export const expanded = style({
  padding: '0 10px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const compareRow = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
});

export const compareCard = style({
  flex: 1,
  minWidth: 120,
  padding: '5px 8px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  borderRadius: 4,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const compareTitle = style({
  fontSize: 9,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  marginBottom: 2,
});

export const compareName = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const compareExcerpt = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  marginTop: 2,
  fontStyle: 'italic',
});
