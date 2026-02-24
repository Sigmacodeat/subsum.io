import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar('accent-color');
export const tintBgVar = createVar('tint-bg');
export const barWidthVar = createVar('bar-width');
export const barHeightVar = createVar('bar-height');

export const periodRow = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginBottom: 8,
});

export const pillButton = style({
  appearance: 'none',
  padding: '3px 10px',
  fontSize: 10,
  fontWeight: 500,
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)',
  backdropFilter: 'blur(10px) saturate(130%)',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
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

export const pillButtonActive = style({
  fontWeight: 700,
  borderColor: cssVarV2('button/primary'),
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  color: cssVarV2('text/primary'),
});

export const tabRow = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginBottom: 10,
  borderBottom: `0.5px solid ${glassStroke}`,
  paddingBottom: 6,
});

export const tabButton = style({
  appearance: 'none',
  padding: '4px 10px',
  fontSize: 10,
  fontWeight: 500,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
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

export const tabButtonActive = style({
  fontWeight: 700,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('button/primary'),
});

export const contentStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const contentStackTight = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const blockTop = style({
  marginTop: 6,
});

export const sectionHeading = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 4,
});

export const sectionHeadingDanger = style({
  color: cssVarV2('status/error'),
});

export const mutedHeading = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
});

export const kpiValue = style({
  vars: {
    [accentColorVar]: cssVarV2('text/primary'),
  },
  color: accentColorVar,
});

export const kpiSub = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginTop: 1,
});

export const alertBanner = style({
  padding: '8px 10px',
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const alertTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const filterRow = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  alignItems: 'center',
});

export const listStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const chipRow = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  alignItems: 'center',
});

export const chip = style({
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const geoButton = style({
  width: '100%',
  textAlign: 'left',
  padding: '6px 8px',
  borderRadius: 10,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  backdropFilter: 'blur(12px) saturate(140%)',
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

export const geoFlag = style({
  fontSize: 14,
  flexShrink: 0,
});

export const geoCountry = style({
  fontSize: 11,
  fontWeight: 600,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/primary'),
});

export const geoMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const geoPercent = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('button/primary'),
  flexShrink: 0,
});

export const geoCities = style({
  marginLeft: 20,
  marginTop: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const geoCityRow = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  gap: 10,
  padding: '2px 6px',
});

export const geoCityName = style({
  fontWeight: 600,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/primary'),
});

export const headerRow = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
});

export const headerRowSpacer = style({
  marginLeft: 'auto',
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
});

export const microPill = style({
  appearance: 'none',
  padding: '2px 8px',
  fontSize: 10,
  borderRadius: 999,
  border: `0.5px solid ${glassStroke}`,
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
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

export const microPillActive = style({
  borderColor: cssVarV2('button/primary'),
  background: cssVarV2('layer/background/secondary'),
  color: cssVarV2('button/primary'),
  fontWeight: 700,
});

export const featureCard = style({
  padding: '8px 10px',
  borderRadius: 10,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const featureTopRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const featureName = style({
  fontSize: 11,
  fontWeight: 600,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/primary'),
});

export const featureMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const featureCount = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('button/primary'),
});

export const trendBadge = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 999,
  fontWeight: 600,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const adoptionRow = style({
  marginTop: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const adoptionLabel = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  width: 82,
});

export const adoptionTrack = style({
  flex: 1,
  height: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  borderRadius: 999,
  overflow: 'hidden',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const adoptionFill = style({
  vars: {
    [barWidthVar]: '0%',
  },
  width: barWidthVar,
  height: '100%',
  background: cssVarV2('button/primary'),
});

export const alertCountBadge = style({
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('status/error'),
  fontWeight: 700,
});

export const detailMetaRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginBottom: 8,
});

export const miniGhostButton = style({
  appearance: 'none',
  padding: '2px 8px',
  fontSize: 10,
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: 'transparent',
  cursor: 'pointer',
  color: cssVarV2('text/secondary'),
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

export const scoreGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
  gap: 8,
  marginBottom: 10,
});

export const alertRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 10,
  padding: '6px 8px',
  borderRadius: 8,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const alertMessage = style({
  vars: {
    [accentColorVar]: cssVarV2('text/primary'),
  },
  color: accentColorVar,
  fontWeight: 700,
  flex: 1,
});

export const scorePercent = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const scoreBarRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 4,
});

export const scoreTrendIcon = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  marginLeft: 4,
  color: accentColorVar,
});

export const retentionTableWrap = style({
  overflowX: 'auto',
});

export const retentionTable = style({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 10,
});

export const retentionTh = style({
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const retentionThCenter = style({
  textAlign: 'center',
});

export const retentionThWeek = style({
  textAlign: 'center',
  padding: '6px 6px',
  borderBottom: `0.5px solid ${glassStroke}`,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
});

export const retentionTd = style({
  padding: '4px 8px',
  borderBottom: `0.5px solid ${glassStroke}`,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const retentionTdCenter = style({
  textAlign: 'center',
});

export const retentionTdEmpty = style({
  color: cssVarV2('text/secondary'),
  opacity: 0.5,
});

export const retentionTdHeat = style({
  vars: {
    [accentColorVar]: cssVarV2('button/primary'),
  },
  textAlign: 'center',
  fontWeight: 600,
  borderRadius: 6,
  background: accentColorVar,
  color: cssVarV2('text/primary'),
});

export const statusBanner = style({
  vars: {
    [accentColorVar]: cssVarV2('status/success'),
  },
  borderRadius: 10,
  border: `0.5px solid ${accentColorVar}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

export const statusLabel = style({
  vars: {
    [accentColorVar]: cssVarV2('status/success'),
  },
  fontSize: 11,
  fontWeight: 700,
  color: accentColorVar,
});

export const statusMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const statusMetaAuto = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginLeft: 'auto',
});

export const policyGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
});

export const policyCard = style({
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 10,
  padding: 12,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const policyHeading = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 10,
});

export const policyStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const policyLabel = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const policyInput = style({
  width: '100%',
  padding: '4px 8px',
  fontSize: 10,
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/primary'),
  selectors: {
    '&:focus': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
});

export const policyError = style({
  fontSize: 10,
  color: cssVarV2('status/error'),
});

export const incidentCard = style({
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  padding: '8px 10px',
  fontSize: 10,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const incidentTopRow = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
});

export const incidentTitle = style({
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  flex: 1,
});

export const incidentSeverityBadge = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  fontSize: 10,
  borderRadius: 999,
  padding: '2px 8px',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  color: accentColorVar,
  fontWeight: 600,
});

export const incidentStatus = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const incidentMeta = style({
  color: cssVarV2('text/secondary'),
  marginTop: 6,
  fontSize: 10,
});

export const auditTableWrap = style({
  overflowX: 'auto',
});

export const auditTable = style({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 10,
});

export const auditTh = style({
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: `0.5px solid ${glassStroke}`,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const auditTd = style({
  padding: '6px 8px',
  borderBottom: `0.5px solid ${glassStroke}`,
  color: cssVarV2('text/secondary'),
});

export const tintCard = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [tintBgVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  },
  borderRadius: 10,
  background: tintBgVar,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  boxShadow: `inset 3px 0 0 ${accentColorVar}`,
  overflow: 'hidden',
});

export const tintCardButton = style({
  width: '100%',
  textAlign: 'left',
  padding: '6px 8px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const tintCardTitle = style({
  fontSize: 11,
  fontWeight: 600,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/primary'),
});

export const tintBadge = style({
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 999,
  color: accentColorVar,
  fontWeight: 700,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const caret = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const tintCardBody = style({
  padding: '6px 8px 8px',
  borderTop: `0.5px solid ${glassStroke}`,
});

export const codeBlock = style({
  fontSize: 10,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  color: cssVarV2('text/primary'),
  padding: '8px 10px',
  borderRadius: 10,
  overflow: 'auto',
  maxHeight: 140,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  margin: '6px 0',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const inlineActionRow = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginTop: 6,
});

export const miniButton = style({
  appearance: 'none',
  padding: '2px 8px',
  fontSize: 10,
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  fontWeight: 600,
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

export const miniButtonPositive = style({
  borderColor: cssVarV2('status/success'),
  color: cssVarV2('status/success'),
});

export const inlineMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const barTrack = style({
  width: 60,
  height: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  borderRadius: 999,
  overflow: 'hidden',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const barFill = style({
  vars: {
    [barWidthVar]: '0%',
    [barHeightVar]: '0px',
  },
  width: barWidthVar,
  height: barHeightVar,
  background: accentColorVar,
});

export const chartRow = style({
  display: 'flex',
  gap: 2,
  alignItems: 'flex-end',
});

export const chartRowDaily = style({
  height: 40,
});

export const chartRowSessions = style({
  height: 50,
});

export const chartBar = style({
  flex: 1,
  minWidth: 2,
  borderRadius: '2px 2px 0 0',
  background: accentColorVar,
  opacity: 0.8,
  height: barHeightVar,
});

export const chartAxis = style({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  marginTop: 4,
});
