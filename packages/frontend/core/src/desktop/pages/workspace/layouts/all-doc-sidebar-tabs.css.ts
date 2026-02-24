import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import {
  glassFill,
  glassStroke,
  interactionTransition,
} from './workspace-list-shared-styles';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 88%, transparent) 0%, color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent) 100%)',
  backdropFilter: 'blur(14px) saturate(140%)',
  borderLeft: `0.5px solid ${glassStroke}`,
});

export const srOnlyLive = style({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});

export const sectionTitle = style({
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: cssVarV2('text/secondary'),
  marginBottom: 4,
});

export const quickNavGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
  marginBottom: 4,
});

export const quickNavButton = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  padding: '7px 4px',
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)',
  backdropFilter: 'blur(10px) saturate(130%)',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
  color: 'color-mix(in srgb, var(--affine-text-primary-color) 74%, var(--affine-text-secondary-color))',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      borderColor: cssVarV2('button/primary'),
      color: cssVarV2('text/primary'),
      transform: 'translateY(-0.5px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const quickNavIcon = style({
  fontSize: 14,
  lineHeight: '16px',
});

export const kpiRow = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
});

export const kpiCard = style({
  flex: 1,
  minWidth: 70,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  padding: '8px 6px',
  borderRadius: 8,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 88%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const kpiValue = style({
  fontSize: 18,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const kpiValueCritical = style({
  color: cssVarV2('status/error'),
});

export const kpiLabel = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontWeight: 500,
});

export const emptyHint = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  padding: '8px 0',
});

export const listCol = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const deadlineItem = style({
  appearance: 'none',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 10px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      borderColor: cssVarV2('button/primary'),
      transform: 'translateY(-0.5px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  },
});

export const itemLabel = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const itemMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const urgentMeta = style({
  color: cssVarV2('status/error'),
  fontWeight: 700,
  fontSize: 11,
});

export const itemRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

export const severityRow = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

export const severityBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const severityCritical = style({
  color: cssVarV2('status/error'),
  borderColor: 'rgba(255, 59, 48, 0.28)',
});

export const severityWarning = style({
  color: cssVarV2('text/primary'),
  borderColor: 'rgba(255, 149, 0, 0.26)',
});

export const severitySoon = style({
  color: cssVarV2('text/primary'),
  borderColor: 'rgba(255, 204, 0, 0.26)',
});

export const docItem = style({
  appearance: 'none',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '6px 10px',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      borderColor: cssVarV2('button/primary'),
      transform: 'translateY(-0.5px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const docMetaRow = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  justifyContent: 'space-between',
});

export const matterItem = style({
  appearance: 'none',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 10px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      borderColor: cssVarV2('button/primary'),
      transform: 'translateY(-0.5px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const matterTitle = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const twoColMeta = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});
