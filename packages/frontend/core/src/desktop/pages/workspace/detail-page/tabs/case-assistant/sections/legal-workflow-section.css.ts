import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const inlineFieldMessage = style({
  fontSize: 10,
  lineHeight: 1.3,
  fontWeight: 600,
  display: 'block',
  marginTop: 2,
});

export const inlineFieldMessageError = style({
  color: cssVarV2('status/error'),
});

export const inlineFieldMessageWarning = style({
  color: cssVarV2('text/primary'),
});

export const fullWidthButton = style({
  width: '100%',
});

export const uploadZoneWrap = style({
  marginBottom: 10,
});

export const compactSummary = style({
  fontSize: 11,
});

export const inputError = style({
  borderColor: cssVarV2('status/error'),
});

export const inputWarning = style({
  borderColor: cssVarV2('text/primary'),
});

export const intakeQualityGate = style({
  marginTop: 10,
  marginBottom: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid color-mix(in srgb, ${glassStroke} 82%, var(--affine-border-color))`,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 94%, rgba(15,23,42,0.12)) 0%, color-mix(in srgb, var(--affine-background-primary-color) 89%, rgba(15,23,42,0.18)) 100%)',
  backdropFilter: 'blur(12px) saturate(135%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const intakeQualityHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 12,
  color: cssVarV2('text/primary'),
});

export const intakeQualityGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  '@media': {
    '(max-width: 1080px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '(max-width: 560px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const intakeMetricChip = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 30,
  borderRadius: 8,
  border: `1px solid color-mix(in srgb, ${glassStroke} 80%, var(--affine-border-color))`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, rgba(15,23,42,0.12))',
  padding: '6px 8px',
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

globalStyle(`${intakeQualityHeader} strong`, {
  fontWeight: 750,
});

globalStyle(`${intakeQualityHeader} span`, {
  color: cssVarV2('button/primary'),
  fontWeight: 700,
  whiteSpace: 'nowrap',
});

globalStyle(`${intakeMetricChip} strong`, {
  color: cssVarV2('text/primary'),
  fontWeight: 750,
});

export const intakeQualityHint = style({
  fontSize: 11,
  lineHeight: 1.45,
  color: cssVarV2('text/secondary'),
});

export const intakeQualityActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const normSuggestionCard = style({
  padding: '8px 10px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const normSuggestionTitle = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 6,
});

export const normSuggestionButton = style({
  display: 'flex',
  gap: 6,
  alignItems: 'flex-start',
  marginBottom: 5,
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'none',
  padding: 0,
});

export const normBadge = style({
  fontSize: 9,
  fontWeight: 700,
  color: cssVarV2('button/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  borderRadius: 3,
  padding: '2px 5px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  marginTop: 1,
});

export const normMain = style({
  flex: 1,
  minWidth: 0,
});

export const normName = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const normMeta = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  marginTop: 1,
});

export const intakeErrorBanner = style({
  fontSize: 11,
  color: cssVarV2('status/error'),
  fontWeight: 600,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'rgba(255, 59, 48, 0.10)',
  border: `0.5px solid rgba(255, 59, 48, 0.28)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const ocrProviderWrap = style({
  marginTop: 8,
});

export const docsHeaderTop = style({
  marginTop: 4,
});

export const docsTitleCompact = style({
  fontSize: 13,
});

export const caseCockpitCard = style({
  marginTop: 10,
  marginBottom: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid color-mix(in srgb, ${glassStroke} 82%, var(--affine-border-color))`,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 95%, rgba(15,23,42,0.10)) 0%, color-mix(in srgb, var(--affine-background-primary-color) 90%, rgba(15,23,42,0.16)) 100%)',
  backdropFilter: 'blur(12px) saturate(135%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const caseCockpitHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const caseCockpitTitle = style({
  fontSize: 12,
  fontWeight: 750,
  color: cssVarV2('text/primary'),
});

export const caseCockpitGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  '@media': {
    '(max-width: 860px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const caseCockpitPanel = style({
  borderRadius: 10,
  border: `1px solid color-mix(in srgb, ${glassStroke} 78%, var(--affine-border-color))`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 88%, rgba(15,23,42,0.10))',
  padding: '10px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
});

export const caseCockpitPanelTitle = style({
  fontSize: 10,
  fontWeight: 750,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: 0.3,
});

export const caseCockpitChipRow = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
});

export const caseCockpitChip = style({
  fontSize: 10,
  fontWeight: 650,
  color: cssVarV2('text/primary'),
  borderRadius: 999,
  padding: '4px 8px',
  border: `1px solid color-mix(in srgb, ${glassStroke} 76%, var(--affine-border-color))`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 85%, rgba(15,23,42,0.10))',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const caseCockpitList = style({
  margin: 0,
  paddingLeft: 16,
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  lineHeight: 1.35,
});

export const docFilterBar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 8,
  marginBottom: 8,
});

export const docFilterGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
});

export const docFilterInput = style({
  minWidth: 220,
  flex: '1 1 220px',
});

export const docFilterSelect = style({
  minWidth: 160,
});

export const documentMetaTop = style({
  marginTop: 2,
});
