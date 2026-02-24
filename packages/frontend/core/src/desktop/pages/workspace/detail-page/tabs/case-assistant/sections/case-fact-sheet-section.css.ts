import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const tintBgVar = createVar();
export const tintBorderVar = createVar();
export const rowOpacityVar = createVar();

export const statusDot = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  display: 'inline-block',
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: accentColorVar,
  flexShrink: 0,
  marginTop: 2,
});

export const sectionCard = style({
  borderRadius: 8,
  overflow: 'hidden',
});

export const sectionSummaryRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
});

export const sectionSummaryTitle = style({
  flex: 1,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const sectionCount = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 9,
  fontWeight: 700,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  color: accentColorVar,
  borderRadius: 999,
  padding: '1px 7px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const sectionBody = style({
  padding: '6px 0',
});

export const headingMeta = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
});

export const kpiGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
  gap: 6,
  marginBottom: 10,
});

export const kpiCard = style({
  textAlign: 'center',
  padding: '8px 4px',
  borderRadius: 7,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const kpiValue = style({
  vars: { [accentColorVar]: cssVarV2('text/primary') },
  fontSize: 18,
  fontWeight: 800,
  color: accentColorVar,
  lineHeight: 1.2,
});

export const kpiLabel = style({
  fontSize: 8,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
  marginTop: 2,
});

export const partyGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4px 12px',
  fontSize: 11,
  padding: '0 4px',
});

export const labelStrong = style({
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const valueText = style({
  color: cssVarV2('text/primary'),
});

export const mt6Pad4 = style({
  marginTop: 6,
  padding: '0 4px',
});

export const subHeading = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 3,
});

export const rowText10 = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  marginBottom: 2,
});

export const mutedText = style({
  color: cssVarV2('text/secondary'),
});

export const listReset = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
});

export const rowItem = style({
  fontSize: 10,
  padding: '3px 6px',
  display: 'flex',
  gap: 6,
  alignItems: 'center',
});

export const rowItemLoose = style({
  fontSize: 10,
  padding: '4px 6px',
  borderRadius: 5,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  vars: {
    [tintBgVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
    [tintBorderVar]: glassStroke,
  },
  background: tintBgVar,
  border: `0.5px solid ${tintBorderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const nameStrong = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const roleChip = style({
  fontSize: 8,
  fontWeight: 700,
  color: cssVarV2('button/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 3,
  padding: '1px 5px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const tinyMuted = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
});

export const refsWrap = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  padding: '0 4px',
});

export const refPill = style({
  fontSize: 9,
  fontWeight: 600,
  color: cssVarV2('button/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 7px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const findingListItem = style({
  borderRadius: 5,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  overflow: 'hidden',
});

export const findingButton = style({
  vars: { [tintBgVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)' },
  background: tintBgVar,
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  padding: '5px 8px',
  display: 'flex',
  gap: 6,
  alignItems: 'flex-start',
  fontSize: 10,
  borderBottom: `0.5px solid ${glassStroke}`,
});

export const findingBody = style({
  vars: { [tintBgVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)' },
  padding: '4px 8px 8px',
  background: tintBgVar,
  fontSize: 10,
  color: cssVarV2('text/primary'),
});

export const findingTitle = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const findingTitleExpanded = style({
  whiteSpace: 'normal',
});

export const findingMeta = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  marginTop: 1,
});

export const caret = style({
  fontSize: 9,
  opacity: 0.4,
  flexShrink: 0,
});

export const taskTitle = style({
  flex: 1,
  fontWeight: 500,
  color: cssVarV2('text/primary'),
});

export const taskTitleDone = style({
  textDecoration: 'line-through',
});

export const taskPriority = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 8,
  fontWeight: 700,
  color: accentColorVar,
});

export const docStatus = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 8,
  color: accentColorVar,
  flexShrink: 0,
  fontWeight: 600,
});

export const summaryText = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
  padding: '0 4px',
  lineHeight: 1.5,
});

export const emptyState = style({
  padding: '20px 0',
  textAlign: 'center',
});

export const emptyIcon = style({
  fontSize: 28,
  marginBottom: 8,
  opacity: 0.5,
});

export const emptyTitle = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const emptyHint = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  marginTop: 4,
});

export const opacityDone = style({
  vars: { [rowOpacityVar]: '1' },
  opacity: rowOpacityVar,
});
