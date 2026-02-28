import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, globalStyle, keyframes, style } from '@vanilla-extract/css';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();
export const widthVar = createVar();
export const opacityVar = createVar();

/* ═══════════════ Keyframes ═══════════════ */

const fadeIn = keyframes({
  '0%': { opacity: 0, transform: 'translateY(6px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const shimmer = keyframes({
  '0%': { backgroundPosition: '-200% 0' },
  '100%': { backgroundPosition: '200% 0' },
});

const pulseGlow = keyframes({
  '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.18)' },
  '50%': { boxShadow: '0 0 0 6px rgba(99,102,241,0)' },
});

const breathe = keyframes({
  '0%, 100%': { opacity: 0.5 },
  '50%': { opacity: 1 },
});

const dropPulse = keyframes({
  '0%, 100%': { borderColor: 'var(--affine-primary-color, #6366f1)' },
  '50%': {
    borderColor:
      'color-mix(in srgb, var(--affine-primary-color, #6366f1) 40%, transparent)',
  },
});

/* ═══════════════ Root ═══════════════ */

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  '@media': {
    '(max-width: 480px)': {
      gap: 14,
    },
    '(min-width: 1024px)': {
      gap: 14,
    },
  },
});

export const flowGuide = style({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  gap: 10,
  '@media': {
    '(max-width: 760px)': {
      justifyContent: 'flex-start',
    },
    '(min-width: 1024px)': {
      gap: 12,
    },
  },
});

export const flowStep = style({
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  backdropFilter: 'none',
  padding: '2px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  width: 'auto',
  selectors: {
    '&[data-active="true"]': {
      color: cssVarV2('text/primary'),
    },
    '&[data-done="true"]': {
      color: cssVarV2('text/primary'),
    },
  },
});

export const flowStepIndex = style({
  width: 18,
  height: 18,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 700,
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/secondary'),
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  selectors: {
    [`${flowStep}[data-active="true"] &`]: {
      background: cssVarV2('button/primary'),
      color: cssVarV2('button/pureWhiteText'),
      borderColor: 'transparent',
    },
    [`${flowStep}[data-done="true"] &`]: {
      background: cssVarV2('status/success'),
      color: cssVarV2('button/pureWhiteText'),
      borderColor: 'transparent',
    },
  },
});

/* ═══════════════ Drop Zone ═══════════════ */

export const dropZone = style({
  vars: {
    [borderVar]: cssVarV2('layer/insideBorder/border'),
    [surfaceVar]: cssVarV2('layer/background/secondary'),
    [opacityVar]: '1',
  },
  position: 'relative',
  width: '100%',
  maxWidth: 880,
  marginInline: 'auto',
  border: `1.5px dashed ${borderVar}`,
  borderRadius: 14,
  padding: '26px 18px',
  minHeight: 168,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  cursor: 'pointer',
  background: `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 96%, transparent), color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent))`,
  outline: 'none',
  opacity: opacityVar,
  transition:
    'border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease, transform 0.18s ease',
  '@media': {
    '(max-width: 760px)': {
      padding: '22px 16px',
      borderRadius: 14,
      minHeight: 156,
    },
    '(max-width: 480px)': {
      padding: '20px 14px',
      borderRadius: 12,
      minHeight: 148,
    },
    '(min-width: 1024px)': {
      padding: '30px 22px',
      borderRadius: 16,
      minHeight: 190,
    },
  },
  selectors: {
    '&:hover': {
      borderColor:
        'color-mix(in srgb, var(--affine-primary-color) 50%, var(--affine-border-color))',
      background: `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, var(--affine-primary-color, transparent)), color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 88%, transparent))`,
      boxShadow:
        '0 0 0 1px color-mix(in srgb, var(--affine-primary-color) 12%, transparent), 0 4px 16px rgba(0,0,0,0.08)',
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const dropZoneActive = style({
  borderStyle: 'solid',
  borderColor: 'var(--affine-primary-color, #6366f1)',
  background: `linear-gradient(135deg, color-mix(in srgb, var(--affine-primary-color, #6366f1) 6%, ${cssVarV2('layer/background/secondary')}), color-mix(in srgb, var(--affine-primary-color, #6366f1) 3%, ${cssVarV2('layer/background/secondary')}))`,
  boxShadow:
    '0 0 0 2px color-mix(in srgb, var(--affine-primary-color) 18%, transparent), 0 8px 24px rgba(0,0,0,0.12)',
  animation: `${dropPulse} 1.5s ease-in-out infinite`,
  transform: 'translateY(-2px)',
});

export const dropZoneCompact = style({
  padding: '12px 16px',
  minHeight: 68,
  selectors: {
    '&:hover': {
      transform: 'none',
    },
  },
});

/* ═══════════════ Hero ═══════════════ */

export const heroIcon = style({
  fontSize: 28,
  marginBottom: 4,
  opacity: 0.5,
  transition: 'opacity 0.2s ease, transform 0.2s ease',
  '@media': {
    '(max-width: 480px)': {
      fontSize: 26,
    },
    '(min-width: 1024px)': {
      fontSize: 30,
    },
  },
  selectors: {
    [`${dropZone}:hover &`]: { opacity: 0.8, transform: 'scale(1.05)' },
  },
});

export const heroTitle = style({
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 2,
  letterSpacing: '0.01em',
  textAlign: 'center',
  '@media': {
    '(max-width: 480px)': {
      fontSize: 13,
    },
    '(min-width: 1024px)': {
      fontSize: 14,
    },
  },
});

export const heroHint = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.5,
  opacity: 0.8,
  maxWidth: 560,
  marginInline: 'auto',
  '@media': {
    '(max-width: 480px)': {
      fontSize: 11,
    },
    '(min-width: 1024px)': {
      fontSize: 12,
    },
  },
});

export const compactHint = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  animation: `${breathe} 2s ease-in-out infinite`,
});

/* ═══════════════ Hidden ═══════════════ */

export const hiddenInput = style({ display: 'none' });

export const srOnly = style({
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

export const selectionPanel = style({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  overflow: 'hidden',
  maxHeight: 720,
  opacity: 1,
  transform: 'translateY(0)',
  transition:
    'max-height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
});

export const selectionPanelCollapsed = style({
  maxHeight: 0,
  opacity: 0,
  transform: 'translateY(-6px)',
  pointerEvents: 'none',
});

/* ═══════════════ Staged Selection ═══════════════ */

export const stagedHeaderActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  '@media': {
    '(max-width: 480px)': {
      gap: 8,
    },
  },
});

export const selectCheckbox = style({
  width: 16,
  height: 16,
  margin: 0,
  flexShrink: 0,
  accentColor: cssVarV2('button/primary'),
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const stagedItemLabel = style({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  cursor: 'pointer',
  flex: 1,
  paddingBlock: 2,
  paddingInline: 2,
  borderRadius: 6,
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

/* ═══════════════ Action Row ═══════════════ */

export const actionRow = style({
  display: 'flex',
  gap: 10,
  animation: `${fadeIn} 0.3s ease both`,
  width: '100%',
  maxWidth: 880,
  marginInline: 'auto',
  '@media': {
    '(max-width: 480px)': {
      flexDirection: 'column',
      gap: 10,
    },
    '(min-width: 1024px)': {
      gap: 12,
    },
  },
});

export const primaryAction = style({
  flex: 1,
  fontSize: 12,
  minHeight: 42,
  fontWeight: 700,
  borderRadius: 10,
  transition: 'transform 0.15s ease, box-shadow 0.2s ease',
  '@media': {
    '(max-width: 480px)': {
      minHeight: 46,
      fontSize: 12,
      borderRadius: 12,
    },
    '(min-width: 1024px)': {
      minHeight: 44,
      fontSize: 13,
    },
  },
  selectors: {
    '&:hover:not(:disabled)': {
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    },
    '&:active:not(:disabled)': {
      transform: 'translateY(0)',
    },
  },
});

/* ═══════════════ Glass Card (shared) ═══════════════ */

export const glassCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  borderRadius: 12,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 97%, transparent), color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent))`,
  padding: '12px 14px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.03) inset',
  animation: `${fadeIn} 0.35s ease both`,
  '@media': {
    '(max-width: 480px)': {
      padding: '12px 12px',
      borderRadius: 12,
    },
    '(min-width: 1024px)': {
      padding: '14px 16px',
      borderRadius: 14,
    },
  },
});

export const glassCardLive = style({
  position: 'sticky',
  top: 4,
  zIndex: 3,
  borderColor:
    'color-mix(in srgb, var(--affine-primary-color) 40%, var(--affine-border-color))',
  boxShadow:
    '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 28px rgba(0,0,0,0.14)',
  animation: `${fadeIn} 0.35s ease both, ${pulseGlow} 2.5s ease-in-out infinite`,
});

/* ═══════════════ Progress Track ═══════════════ */

export const progressTrack = style({
  width: '100%',
  height: 5,
  borderRadius: 999,
  background: cssVarV2('layer/background/primary'),
  overflow: 'hidden',
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('layer/insideBorder/border')} 60%, transparent)`,
});

export const progressFill = style({
  vars: {
    [widthVar]: '0%',
    [accentColorVar]: cssVarV2('button/primary'),
  },
  width: widthVar,
  height: '100%',
  borderRadius: 999,
  background: `linear-gradient(90deg, ${accentColorVar}, color-mix(in srgb, ${accentColorVar} 70%, #818cf8))`,
  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
});

export const progressFillShimmer = style({
  position: 'relative',
  overflow: 'hidden',
  selectors: {
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '0',
      borderRadius: '999px',
      background:
        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
      backgroundSize: '200% 100%',
      animation: `${shimmer} 1.8s ease-in-out infinite`,
    },
  },
});

/* ═══════════════ Card Header ═══════════════ */

export const cardHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const cardTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  letterSpacing: '0.01em',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const cardPercent = style({
  fontSize: 12,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
  fontVariantNumeric: 'tabular-nums',
});

export const cardMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.5,
});

export const cardMetaDetails = style({
  marginTop: 2,
});

globalStyle(`${cardMetaDetails} > summary`, {
  cursor: 'pointer',
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  listStyle: 'none',
  userSelect: 'none',
});

globalStyle(`${cardMetaDetails} > summary::-webkit-details-marker`, {
  display: 'none',
});

/* ═══════════════ Stat Chips ═══════════════ */

export const chipRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
});

export const chip = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  borderRadius: 6,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  padding: '2px 7px',
  lineHeight: 1.4,
  fontVariantNumeric: 'tabular-nums',
  transition: 'background 0.2s ease',
});

export const chipSuccess = style({
  color: cssVarV2('status/success'),
  borderColor: `color-mix(in srgb, ${cssVarV2('status/success')} 30%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/success')} 6%, ${cssVarV2('layer/background/primary')})`,
});

export const chipError = style({
  color: cssVarV2('status/error'),
  borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 30%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 6%, ${cssVarV2('layer/background/primary')})`,
});

export const chipWarning = style({
  color: `color-mix(in srgb, ${cssVarV2('status/error')} 78%, ${cssVarV2('text/primary')})`,
  borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 22%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 4%, ${cssVarV2('layer/background/primary')})`,
});

/* ═══════════════ Live Indicator ═══════════════ */

export const liveDot = style({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: cssVarV2('button/primary'),
  display: 'inline-block',
  animation: `${breathe} 1.5s ease-in-out infinite`,
  flexShrink: 0,
});

/* ═══════════════ Error Box ═══════════════ */

export const errorBox = style({
  padding: '8px 10px',
  borderRadius: 10,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 6%, ${cssVarV2('layer/background/secondary')})`,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('status/error')} 40%, transparent)`,
  fontSize: 11,
  color: cssVarV2('status/error'),
  animation: `${fadeIn} 0.3s ease both`,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const errorEntry = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '4px 0',
  borderBottom: `0.5px dashed color-mix(in srgb, ${cssVarV2('status/error')} 25%, transparent)`,
  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

export const errorHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const errorSeverityChip = style({
  fontSize: 9,
  lineHeight: 1.2,
  padding: '1px 6px',
  borderRadius: 999,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
});

export const errorSeverityCritical = style({
  color: cssVarV2('status/error'),
  borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 45%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 12%, ${cssVarV2('layer/background/primary')})`,
});

export const errorSeverityWarning = style({
  color: `color-mix(in srgb, ${cssVarV2('status/error')} 75%, ${cssVarV2('text/primary')})`,
  borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 30%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 8%, ${cssVarV2('layer/background/primary')})`,
});

export const errorSeverityInfo = style({
  color: cssVarV2('text/secondary'),
  borderColor: `color-mix(in srgb, ${cssVarV2('text/secondary')} 35%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 75%, transparent)`,
});

export const integrityHint = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  padding: '6px 8px',
  borderRadius: 8,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 75%, transparent)`,
  lineHeight: 1.45,
});

export const resultWindow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  borderRadius: 12,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 95%, transparent), color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 88%, transparent))`,
  boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
  padding: '12px',
});

export const resultWindowHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
});

export const resultWindowTitle = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const resultWindowList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 260,
  overflowY: 'auto',
  paddingRight: 2,
});

export const resultWindowItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 8,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  padding: '8px',
});

export const resultWindowItemTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const resultWindowItemMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.45,
});

export const resultWindowMetaRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
});

export const resultWindowRecommendation = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.4,
  borderRadius: 6,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 75%, transparent)`,
  padding: '4px 6px',
});

export const resultWindowTimeline = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  borderRadius: 6,
  border: `0.5px dashed ${cssVarV2('layer/insideBorder/border')}`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 70%, transparent)`,
  padding: '6px',
});

export const resultWindowTimelineItem = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const resultWindowTimelineLabel = style({
  color: cssVarV2('text/primary'),
  fontWeight: 600,
});

export const resultWindowTimelineTime = style({
  color: cssVarV2('text/secondary'),
  fontVariantNumeric: 'tabular-nums',
});

export const resultWindowActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

/* ═══════════════ Staged Summary ═══════════════ */

export const stagedRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  width: '100%',
  maxWidth: 880,
  marginInline: 'auto',
  animation: `${fadeIn} 0.35s ease both`,
});

export const stagedHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
});

export const stagedTitle = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  letterSpacing: '0.01em',
});

export const clearButton = style({
  background: 'transparent',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  cursor: 'pointer',
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  padding: '3px 10px',
  borderRadius: 6,
  transition: 'all 0.18s ease',
  selectors: {
    '&:hover': {
      color: cssVarV2('status/error'),
      borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 40%, transparent)`,
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 5%, transparent)`,
    },
  },
});

export const stagedList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxHeight: 240,
  overflowY: 'auto',
  overflowX: 'hidden',
  '@media': {
    '(max-width: 480px)': {
      maxHeight: 220,
    },
    '(min-width: 1024px)': {
      maxHeight: 320,
    },
  },
});

export const largeSelectionRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const largeSelectionActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
});

export const largeSelectionWindow = style({
  borderRadius: 10,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 86%, transparent)`,
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 360,
});

export const largeSelectionPager = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
});

export const stagedItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 8,
  background: 'transparent',
  fontSize: 11,
  cursor: 'pointer',
  border: '0.5px solid transparent',
  transition: 'background 0.15s ease',
  animation: `${fadeIn} 0.25s ease both`,
  selectors: {
    '&:hover': {
      background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 80%, transparent)`,
    },
    '&[data-selected="true"]': {
      borderColor:
        'color-mix(in srgb, var(--affine-primary-color) 55%, transparent)',
      background: `linear-gradient(135deg, color-mix(in srgb, var(--affine-primary-color) 10%, ${cssVarV2('layer/background/secondary')}), color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent))`,
      boxShadow:
        '0 0 0 1px color-mix(in srgb, var(--affine-primary-color) 12%, transparent)',
    },
    '&[data-selected="true"]:hover': {
      background: `linear-gradient(135deg, color-mix(in srgb, var(--affine-primary-color) 14%, ${cssVarV2('layer/background/secondary')}), color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent))`,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const kindBadge = style({
  fontSize: 9,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/primary'),
  borderRadius: 4,
  padding: '1px 5px',
  flexShrink: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
});

export const fileName = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/primary'),
  fontWeight: 500,
});

export const fileSize = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
});

export const removeButton = style({
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  color: cssVarV2('text/secondary'),
  padding: '0 4px',
  lineHeight: 1,
  borderRadius: 4,
  opacity: 0,
  transition: 'opacity 0.15s ease, color 0.15s ease',
  selectors: {
    [`${stagedItem}:hover &`]: { opacity: 1 },
    '&:hover': { color: cssVarV2('status/error') },
  },
});

/* ═══════════════ Scan Hint ═══════════════ */

export const scanHint = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  padding: '6px 8px',
  borderRadius: 8,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 60%, transparent)`,
  animation: `${fadeIn} 0.3s ease both`,
});

/* ═══════════════ Legacy compat aliases ═══════════════ */

export const progressList = style({ display: 'none' });
export const progressRow = style({ display: 'none' });
export const ellipsis = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
export const prepareSummaryCard = glassCard;
export const prepareSummaryCardLive = glassCardLive;
export const prepareSummaryHeader = cardHeader;
export const prepareSummaryTitle = cardTitle;
export const prepareSummaryPercent = cardPercent;
export const prepareSummaryTrack = progressTrack;
export const prepareSummaryFill = progressFill;
export const prepareSummaryMeta = cardMeta;
export const summaryChipRow = chipRow;
export const summaryChip = chip;
export const folderBrowser = style({ display: 'none' });
export const folderBrowserTitle = style({ display: 'none' });
export const folderChipRow = style({ display: 'none' });
export const folderChip = style({ display: 'none' });
export const folderChipActive = style({ display: 'none' });
