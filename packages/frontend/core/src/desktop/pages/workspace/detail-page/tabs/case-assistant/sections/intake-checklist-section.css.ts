import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const barWidthVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();

export const kpiGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 6,
  marginBottom: 10,
});

export const kpiCard = style({
  padding: '6px 8px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  textAlign: 'center',
});

export const kpiValue = style({
  vars: { [accentColorVar]: cssVarV2('text/primary') },
  fontSize: 16,
  fontWeight: 800,
  color: accentColorVar,
});

export const kpiLabel = style({
  fontSize: 8,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const qualityBarRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const qualityTrack = style({
  width: 60,
  height: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  borderRadius: 3,
  overflow: 'hidden',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const qualityFill = style({
  vars: {
    [barWidthVar]: '0%',
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  width: barWidthVar,
  height: '100%',
  background: accentColorVar,
  borderRadius: 3,
});

export const qualityLabel = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 10,
  fontWeight: 700,
  color: accentColorVar,
});

export const problemList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '6px 10px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  fontSize: 10,
  color: cssVarV2('text/primary'),
});

export const problemRow = style({
  display: 'flex',
  gap: 4,
  alignItems: 'flex-start',
});

export const checklistItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
  fontSize: 11,
});

export const checklistIcon = style({
  flexShrink: 0,
  fontSize: 12,
});

export const checklistLabel = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  flex: 1,
  color: accentColorVar,
  fontWeight: 400,
});

export const checklistLabelError = style({
  fontWeight: 600,
});

export const checklistDetail = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  maxWidth: 180,
  textAlign: 'right',
});

export const verifyButton = style({
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 9,
  color: cssVarV2('button/primary'),
  cursor: 'pointer',
  fontWeight: 600,
  flexShrink: 0,
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

export const verifiedBadge = style({
  fontSize: 9,
  color: cssVarV2('status/success'),
  fontWeight: 600,
  background: 'rgba(52, 199, 89, 0.10)',
  borderRadius: 3,
  padding: '1px 5px',
  flexShrink: 0,
});

export const documentCard = style({
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  overflow: 'hidden',
});

export const documentHeaderButton = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
});

export const chevron = style({
  fontSize: 12,
  flexShrink: 0,
});

export const documentTitle = style({
  flex: 1,
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const processingBadge = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: cssVarV2('layer/background/secondary'),
  },
  fontSize: 9,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 4,
  color: accentColorVar,
  background: surfaceVar,
  flexShrink: 0,
});

export const documentBody = style({
  padding: '0 12px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderTop: `0.5px solid ${glassStroke}`,
});

export const documentMeta = style({
  display: 'flex',
  gap: 12,
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  paddingTop: 8,
  flexWrap: 'wrap',
});

export const successMeta = style({
  color: cssVarV2('status/success'),
});

export const checklistStack = style({
  display: 'flex',
  flexDirection: 'column',
  padding: '6px 0',
});

export const checklistHeading = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 4,
});

export const legacyHint = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontStyle: 'italic',
});

export const emptyDocuments = style({
  padding: '16px',
  textAlign: 'center',
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  fontStyle: 'italic',
});

export const statsRow = style({
  display: 'flex',
  gap: 12,
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  marginBottom: 10,
  flexWrap: 'wrap',
});

export const statsHighlight = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  color: accentColorVar,
});

export const failureSummary = style({
  borderRadius: 8,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('status/error')} 35%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 7%, ${cssVarV2('layer/background/secondary')})`,
  padding: '8px 10px',
  marginBottom: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const failureSummaryTitle = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('status/error'),
});

export const failureSummaryList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const failureSummaryItem = style({
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: 8,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  alignItems: 'start',
});

export const completenessBox = style({
  padding: '8px 12px',
  borderRadius: 8,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  marginBottom: 10,
});

export const completenessTitle = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 6,
});

export const completenessRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 0',
  fontSize: 11,
});

export const completenessLabel = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  flex: 1,
  color: accentColorVar,
  fontWeight: 400,
});

export const completenessWarn = style({
  fontWeight: 600,
});

export const completenessDetail = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
});

export const documentList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const documentListHeading = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});
