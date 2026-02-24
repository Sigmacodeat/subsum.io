import { cssVarV2 } from '@toeverything/theme/v2';
import { style, createVar } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const barWidthVar = createVar();

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const title = style({
  fontSize: 14,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const emptyText = style({
  color: cssVarV2('text/secondary'),
  fontSize: 13,
  margin: '12px 0',
});

export const riskBanner = style({
  vars: {
    [accentColorVar]: cssVarV2('text/primary'),
  },
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 10,
  marginBottom: 12,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  boxShadow: `inset 3px 0 0 ${accentColorVar}`,
});

export const riskIcon = style({
  fontSize: 22,
});

export const riskMetaWrap = style({
  flex: 1,
});

export const riskLabel = style({
  vars: {
    [accentColorVar]: cssVarV2('text/primary'),
  },
  fontWeight: 600,
  fontSize: 14,
  color: accentColorVar,
});

export const riskSub = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  marginTop: 2,
});

export const riskScoreBubble = style({
  vars: {
    [accentColorVar]: cssVarV2('text/primary'),
  },
  width: 44,
  height: 44,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  fontWeight: 700,
  fontSize: 16,
  color: accentColorVar,
});

export const kpiGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  marginBottom: 14,
});

export const kpiCard = style({
  padding: '8px 10px',
  borderRadius: 8,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const kpiCardHighlight = style({
  background: cssVarV2('layer/background/secondary'),
  borderColor: cssVarV2('text/primary'),
});

export const kpiLabel = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const kpiValue = style({
  fontSize: 16,
  fontWeight: 700,
  marginTop: 2,
  color: cssVarV2('text/primary'),
});

export const tabRow = style({
  display: 'flex',
  gap: 2,
  marginBottom: 12,
  borderBottom: `0.5px solid ${glassStroke}`,
  overflowX: 'auto',
});

export const tabButton = style({
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 500,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
});

export const tabButtonActive = style({
  fontWeight: 700,
  borderBottomColor: cssVarV2('button/primary'),
  color: cssVarV2('text/primary'),
});

export const tabCount = style({
  marginLeft: 4,
  padding: '1px 6px',
  borderRadius: 999,
  fontSize: 10,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  fontWeight: 600,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const contentStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const sectionHeading = style({
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: cssVarV2('text/primary'),
});

export const sectionHeadingAccent = style({
  color: cssVarV2('text/primary'),
});

export const rowCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 8,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  marginBottom: 4,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const rowMeta = style({
  flex: 1,
  fontSize: 12,
  color: cssVarV2('text/primary'),
});

export const subText = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const emptyParagraph = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const borderedCard = style({
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  overflow: 'hidden',
});

export const borderedCardAccent = style({
  borderColor: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/secondary'),
});

export const accordionButton = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  textAlign: 'left',
});

export const accordionBody = style({
  padding: '8px 10px',
  borderTop: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const scoreWrap = style({
  width: 40,
  height: 6,
  borderRadius: 3,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  overflow: 'hidden',
  flexShrink: 0,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const scoreFill = style({
  vars: {
    [accentColorVar]: cssVarV2('button/primary'),
    [barWidthVar]: '0%',
  },
  width: barWidthVar,
  height: '100%',
  borderRadius: 3,
  background: accentColorVar,
});

export const scorePercent = style({
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const flex1 = style({
  flex: 1,
  minWidth: 0,
});

export const iconLg = style({
  fontSize: 16,
});

export const iconSm = style({
  fontSize: 10,
});

export const titleStrong = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const titleStrongWithBottom = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  marginBottom: 6,
});

export const titleXsStrong = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const text11 = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
});

export const text11Muted = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const text10Muted = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const text10Success = style({
  fontSize: 10,
  color: cssVarV2('status/success'),
});

export const text10Error = style({
  fontSize: 10,
  color: cssVarV2('status/error'),
});

export const text10Warn = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  fontWeight: 600,
});

export const marginTop2 = style({
  marginTop: 2,
});

export const marginTop4 = style({
  marginTop: 4,
});

export const marginTop6 = style({
  marginTop: 6,
});

export const stack4 = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const rowWrap = style({
  display: 'flex',
  gap: 12,
  fontSize: 11,
  flexWrap: 'wrap',
});

export const confidenceBadge = style({
  fontSize: 10,
  fontWeight: 600,
  borderRadius: 999,
  padding: '2px 8px',
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/secondary'),
});

export const confidenceHigh = style({
  color: cssVarV2('status/success'),
});

export const confidenceMedium = style({
  color: cssVarV2('text/primary'),
});

export const confidenceLow = style({
  color: cssVarV2('text/secondary'),
});

export const merkmalRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  marginBottom: 6,
  padding: '4px 6px',
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const requiredAsterisk = style({
  color: cssVarV2('status/error'),
  marginLeft: 4,
});

export const confidenceNowrap = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
});

export const qualifierCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const qualifierLevel = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('button/primary'),
});

export const recommendationBox = style({
  marginTop: 6,
  padding: '4px 8px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const gapItem = style({
  fontSize: 11,
  padding: '3px 6px',
  marginTop: 2,
  borderRadius: 4,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/primary'),
});

export const dotListItem = style({
  fontSize: 11,
  marginTop: 2,
  color: cssVarV2('text/secondary'),
});
