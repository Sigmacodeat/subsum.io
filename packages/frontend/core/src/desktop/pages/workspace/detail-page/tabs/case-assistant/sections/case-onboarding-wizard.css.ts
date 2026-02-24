import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, keyframes, style } from '@vanilla-extract/css';

import { glassFill, glassStroke, surfaceEnter } from '../../../../layouts/workspace-list-shared-styles';

const overlayFadeIn = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

const stepEnterForward = keyframes({
  '0%': { opacity: 0, transform: 'translateX(28px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
});

const stepEnterBackward = keyframes({
  '0%': { opacity: 0, transform: 'translateX(-28px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
});

const stepFadeIn = keyframes({
  '0%': { opacity: 0, transform: 'translateY(6px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const heroGlow = keyframes({
  '0%': { boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)' },
  '100%': { boxShadow: '0 14px 36px rgba(0, 0, 0, 0.18)' },
});

const cardRise = keyframes({
  '0%': { opacity: 0, transform: 'translateY(10px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const priorityGlow = keyframes({
  '0%': { boxShadow: '0 0 0 rgba(0, 0, 0, 0)' },
  '100%': { boxShadow: `0 0 0 2px ${cssVarV2('button/primary')}` },
});

const dotPulse = keyframes({
  '0%': { boxShadow: `0 0 0 0 rgba(var(--affine-primary-color-rgb, 99, 102, 241), 0.45)` },
  '60%': { boxShadow: `0 0 0 7px rgba(var(--affine-primary-color-rgb, 99, 102, 241), 0)` },
  '100%': { boxShadow: `0 0 0 0 rgba(var(--affine-primary-color-rgb, 99, 102, 241), 0)` },
});

const lineFill = keyframes({
  '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
  '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
});

const commitReveal = keyframes({
  '0%': { opacity: 0, transform: 'translateY(8px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

 const surfaceExit = keyframes({
   '0%': { opacity: 1, transform: 'translateY(0)', maxHeight: '1400px' },
   '100%': { opacity: 0, transform: 'translateY(-6px)', maxHeight: '0px' },
 });

const workflowProgressPulse = keyframes({
  '0%': { boxShadow: `0 0 0 0 color-mix(in srgb, ${cssVarV2('button/primary')} 0%, transparent)` },
  '50%': { boxShadow: `0 0 0 6px color-mix(in srgb, ${cssVarV2('button/primary')} 14%, transparent)` },
  '100%': { boxShadow: `0 0 0 0 color-mix(in srgb, ${cssVarV2('button/primary')} 0%, transparent)` },
});

const progressSweep = keyframes({
  '0%': { transform: 'translateX(-115%)' },
  '100%': { transform: 'translateX(115%)' },
});

const spinRotate = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background:
    'radial-gradient(circle at 16% 20%, var(--affine-theme-secondary-soft, rgba(255, 255, 255, 0.06)), transparent 34%), radial-gradient(circle at 84% 14%, var(--affine-theme-accent-soft, rgba(255, 255, 255, 0.08)), transparent 42%), rgba(0, 0, 0, 0.68)',
  backdropFilter: 'blur(14px) saturate(125%)',
  padding: 24,
  animation: `${overlayFadeIn} 200ms ease-out`,
  '@media': {
    '(max-width: 768px)': {
      padding: 12,
    },
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const adoptionPreviewCard = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(12px) saturate(135%)',
  padding: '9px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

globalStyle(`${adoptionPreviewCard} > strong`, {
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const adoptionPreviewList = style({
  margin: 0,
  paddingLeft: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const adoptionPreviewItem = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.35,
});

export const finalFlowGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  '@media': {
    '(max-width: 960px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const finalFlowCard = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(12px) saturate(135%)',
  padding: '9px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  selectors: {
    '&[data-tone="review"]': {
      borderColor: 'color-mix(in srgb, #f59e0b 35%, transparent)',
    },
    '&[data-tone="impact"]': {
      borderColor: cssVarV2('button/primary'),
    },
  },
});

export const finalFlowCardTitle = style({
  fontSize: 11,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
});

export const finalFlowList = style({
  margin: 0,
  paddingLeft: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const finalFlowItem = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.35,
});

export const workflowQuickActions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const workflowQuickActionButton = style({
  fontSize: 11,
  borderRadius: 999,
});

export const uploadActionPrimary = style({
  selectors: {
    '&[disabled]': {
      opacity: 0.68,
    },
  },
});

export const uploadActionSecondary = style({
  selectors: {
    '&[disabled]': {
      opacity: 0.62,
    },
  },
});

export const uploadActionAll = style({
  selectors: {
    '&[disabled]': {
      opacity: 0.58,
    },
  },
});

export const subtitle = style({
  margin: 0,
  fontSize: 11,
  lineHeight: 1.35,
  color: cssVarV2('text/secondary'),
  overflow: 'visible',
  textOverflow: 'clip',
  whiteSpace: 'normal',
});

export const stepViewportInner = style({
  width: 'min(880px, 100%)',
  marginInline: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  '@media': {
    '(max-width: 768px)': {
      gap: 12,
    },
    '(min-width: 1024px)': {
      width: 'min(960px, 100%)',
      gap: 16,
    },
  },
});

export const stepPane = style({
  animation: `${stepFadeIn} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const stepPaneForward = style({
  animation: `${stepEnterForward} 260ms cubic-bezier(0.22, 1, 0.36, 1)`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const stepPaneBackward = style({
  animation: `${stepEnterBackward} 260ms cubic-bezier(0.22, 1, 0.36, 1)`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const card = style({
  background: 'transparent',
  backdropFilter: 'none',
  borderRadius: 22,
  width: 'min(1060px, calc(100vw - 48px))',
  maxHeight: 'calc(100vh - 48px)',
  overflow: 'hidden',
  padding: '22px 24px 18px',
  boxShadow: 'none',
  border: '1px solid transparent',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  '@media': {
    '(max-width: 768px)': {
      width: 'min(1060px, calc(100vw - 18px))',
      maxHeight: 'calc(100vh - 24px)',
      padding: '12px 12px 10px',
      borderRadius: 16,
      gap: 10,
    },
    '(min-width: 1024px)': {
      padding: '26px 30px 20px',
      gap: 16,
    },
  },
});

export const header = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 12,
  marginBottom: 6,
  width: 'min(880px, 100%)',
  marginInline: 'auto',
  padding: '2px 6px 0',
  borderRadius: 0,
  border: 'none',
  background: 'transparent',
  backdropFilter: 'none',
  position: 'relative',
  '@media': {
    '(max-width: 768px)': {
      padding: '2px 2px 0',
    },
    '(min-width: 1024px)': {
      width: 'min(960px, 100%)',
    },
  },
});

export const headerText = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: 640,
});

export const title = style({
  fontSize: 22,
  fontWeight: 850,
  color: cssVarV2('text/primary'),
  margin: 0,
  letterSpacing: '-0.02em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
  '@media': {
    '(max-width: 768px)': {
      fontSize: 17,
    },
    '(min-width: 1024px)': {
      fontSize: 23,
    },
  },
});

globalStyle(`${title}`, {
  backgroundImage: `linear-gradient(90deg, ${cssVarV2('text/primary')} 0%, color-mix(in srgb, ${cssVarV2('button/primary')} 70%, ${cssVarV2('text/primary')}) 55%, ${cssVarV2('text/primary')} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
});

export const closeButton = style({
  appearance: 'none',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 18,
  color: cssVarV2('text/secondary'),
  width: 40,
  height: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  position: 'absolute',
  top: -2,
  right: -2,
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

export const stepHeader = style({
  fontSize: 14,
  fontWeight: 700,
  color: cssVarV2('button/primary'),
  marginBottom: 0,
  textAlign: 'center',
  letterSpacing: '0.02em',
});

export const stepBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const stepProgressRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
});

export const stepStickyMeta = style({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  paddingBottom: 10,
  paddingTop: 6,
  background:
    `linear-gradient(180deg, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 94%, transparent) 76%, rgba(0, 0, 0, 0))`,
  borderBottom: `0.5px solid color-mix(in srgb, ${glassStroke} 70%, transparent)`,
  marginBottom: 4,
});

export const stepViewport = style({
  flex: 1,
  minHeight: 320,
  overflowY: 'auto',
  paddingRight: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  '@media': {
    '(max-width: 768px)': {
      minHeight: 240,
      paddingRight: 2,
      gap: 10,
    },
  },
});

export const helpText = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  margin: 0,
});

export const stepHeroCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background:
    `${glassFill}, linear-gradient(120deg, color-mix(in srgb, ${cssVarV2('button/primary')} 12%, transparent) 0%, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent) 100%)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '9px 11px',
});

export const stepHeroIcon = style({
  width: 32,
  height: 32,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  flexShrink: 0,
});

export const stepHeroText = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
});

export const stepHeroTitle = style({
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const stepHeroHint = style({
  fontSize: 11,
  lineHeight: 1.35,
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const recommendationCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  padding: '8px 10px',
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const recommendationCardTitle = style({
  fontSize: 11,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
});

export const formLabel = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const grid2 = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
});

export const row = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
});

export const flex1 = style({
  flex: 1,
});

export const hintMuted = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  margin: 0,
});

export const stepIntentText = style({
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  margin: 0,
});

export const kpiRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const kpiChip = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  borderRadius: 999,
  padding: '3px 8px',
});

export const bannerSuccess = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  fontWeight: 600,
  padding: '6px 10px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const bannerWarning = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const topProgressArea = style({
  width: 'min(760px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  paddingTop: 2,
  paddingBottom: 4,
  marginInline: 'auto',
});

export const stepIndicator = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginBottom: 2,
  overflowX: 'auto',
  padding: '2px 2px 6px',
  width: '100%',
  selectors: {
    '&::-webkit-scrollbar': {
      height: 0,
    },
  },
});

export const stepIndicatorItem = style({
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  flex: '1 0 168px',
  '@media': {
    '(max-width: 980px)': {
      flex: '0 0 auto',
      minWidth: 148,
    },
  },
});

export const stepIndicatorNode = style({
  appearance: 'none',
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 12,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '8px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  width: '100%',
  textAlign: 'left',
  transition: 'all 0.2s ease',
  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: 'color-mix(in srgb, var(--affine-primary-color) 44%, transparent)',
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
      transform: 'none',
    },
    '&[aria-current="step"]': {
      borderColor: cssVarV2('button/primary'),
      background:
        `linear-gradient(130deg, color-mix(in srgb, ${cssVarV2('button/primary')} 18%, transparent), color-mix(in srgb, var(--affine-background-primary-color) 90%, transparent))`,
      boxShadow: '0 8px 22px rgba(2, 6, 23, 0.26)',
    },
  },
});

export const stepIndicatorLabel = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  gap: 1,
  '@media': {
    '(max-width: 1180px)': {
      display: 'none',
    },
  },
});

export const stepIndicatorLabelTitle = style({
  fontSize: 11,
  lineHeight: 1.2,
  color: cssVarV2('text/primary'),
  fontWeight: 700,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const stepIndicatorLabelHint = style({
  fontSize: 10,
  lineHeight: 1.2,
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const stepIndicatorItemGrow = style({
  flex: 1,
});

export const stepIndicatorDot = style({
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  color: cssVarV2('text/secondary'),
  border: `1.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
  selectors: {
    '&[data-active="true"]': {
      background: cssVarV2('button/primary'),
      color: cssVarV2('button/pureWhiteText'),
      borderColor: cssVarV2('button/primary'),
      animation: `${dotPulse} 1.8s ease-out infinite`,
    },
    '&[data-done="true"]': {
      background: cssVarV2('status/success'),
      color: cssVarV2('button/pureWhiteText'),
      borderColor: cssVarV2('status/success'),
    },
  },
});

export const stepIndicatorLine = style({
  flex: 1,
  height: 2,
  background: 'color-mix(in srgb, rgba(255,255,255,0.18) 30%, rgba(148, 163, 184, 0.35))',
  marginLeft: 6,
  marginRight: 6,
  borderRadius: 2,
  overflow: 'hidden',
  position: 'relative',
  transition: 'background 0.3s ease',
  selectors: {
    '&[data-done="true"]': {
      background: cssVarV2('status/success'),
    },
    '&[data-done="true"]::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: cssVarV2('status/success'),
      animation: `${lineFill} 300ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
  },
});

export const simpleProgressRail = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 14px',
  borderBottom: `0.5px solid ${glassStroke}`,
  borderRadius: 14,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/primary')} 62%, transparent)`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const simpleProgressTrack = style({
  height: 4,
  borderRadius: 2,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  overflow: 'hidden',
});

export const simpleProgressFill = style({
  height: '100%',
  borderRadius: 2,
  background: cssVarV2('button/primary'),
  transition: 'width 300ms ease',
});

export const simpleStepHeader = style({
  padding: '16px 24px 12px',
  borderBottom: `0.5px solid ${glassStroke}`,
});

export const simpleStepTitle = style({
  fontSize: 16,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const simpleProgressCaption = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  textAlign: 'center',
  fontWeight: 500,
});

export const progressRail = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '7px 10px',
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  backdropFilter: 'blur(10px) saturate(132%)',
  width: '100%',
  marginInline: 'auto',
  '@media': {
    '(max-width: 768px)': {
      gap: 8,
    },
  },
});

export const progressTrack = style({
  flex: 1,
  height: 10,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const progressFill = style({
  height: '100%',
  borderRadius: 999,
  background: `linear-gradient(90deg, ${cssVarV2('button/primary')} 0%, ${cssVarV2('status/success')} 100%)`,
  transition: 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)',
});

export const progressCaption = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
  fontWeight: 600,
});

export const smallActionButton = style({
  fontSize: 9,
  padding: '2px 6px',
  flexShrink: 0,
});

export const fullWidthButton = style({
  width: '100%',
});

export const fullWidthPlainButton = style({
  width: '100%',
  fontSize: 11,
});

export const uploadWorkflowShell = style({
  borderRadius: 18,
  border: `0.5px solid ${glassStroke}`,
  background:
    `${glassFill}, linear-gradient(132deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 89%, transparent) 0%, color-mix(in srgb, ${cssVarV2('button/primary')} 13%, transparent) 100%)`,
  backdropFilter: 'blur(16px) saturate(145%)',
  padding: 'clamp(10px, 1.1vw, 14px) clamp(12px, 1.4vw, 16px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: `0 14px 34px color-mix(in srgb, ${cssVarV2('layer/background/primary')} 55%, transparent)`,
  selectors: {
    '&[data-tone="active"]': {
      borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 46%, ${glassStroke})`,
    },
    '&[data-tone="success"]': {
      borderColor: `color-mix(in srgb, ${cssVarV2('status/success')} 54%, ${glassStroke})`,
      background:
        `${glassFill}, linear-gradient(132deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 89%, transparent) 0%, color-mix(in srgb, ${cssVarV2('status/success')} 12%, transparent) 100%)`,
    },
    '&[data-tone="error"]': {
      borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 58%, ${glassStroke})`,
      background:
        `${glassFill}, linear-gradient(132deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 89%, transparent) 0%, color-mix(in srgb, ${cssVarV2('status/error')} 10%, transparent) 100%)`,
    },
  },
  '@media': {
    '(max-width: 768px)': {
      borderRadius: 14,
      gap: 10,
      padding: '10px 10px 11px',
    },
  },
});

export const uploadWorkflowHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  '@media': {
    '(max-width: 560px)': {
      alignItems: 'flex-start',
      flexDirection: 'column',
      gap: 6,
    },
  },
});

export const uploadWorkflowHeaderText = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
});

export const uploadWorkflowTitle = style({
  fontSize: 'clamp(13px, 1.05vw, 15px)',
  fontWeight: 800,
  color: cssVarV2('text/primary'),
  lineHeight: 1.25,
  letterSpacing: '-0.005em',
});

export const uploadWorkflowHint = style({
  fontSize: 'clamp(10px, 0.84vw, 11px)',
  lineHeight: 1.4,
  color: cssVarV2('text/secondary'),
  wordBreak: 'break-word',
});

export const uploadWorkflowPercent = style({
  borderRadius: 999,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/primary'),
  fontSize: 'clamp(11px, 0.95vw, 12px)',
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
  minWidth: 52,
  textAlign: 'center',
  padding: '4px 9px',
  alignSelf: 'center',
  '@media': {
    '(max-width: 560px)': {
      alignSelf: 'flex-start',
    },
  },
});

export const uploadWorkflowPhaseRail = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 9,
  '@media': {
    '(max-width: 1024px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '(max-width: 640px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const uploadWorkflowPhaseItem = style({
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  padding: '8px 10px',
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  minHeight: 42,
  transition: 'border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease',
  selectors: {
    '&[data-active="true"]': {
      borderColor: cssVarV2('button/primary'),
      transform: 'translateY(-1px)',
      boxShadow: `0 10px 24px color-mix(in srgb, ${cssVarV2('button/primary')} 24%, transparent)`,
      animation: `${workflowProgressPulse} 1.8s ease-out infinite`,
    },
    '&[data-done="true"]': {
      borderColor: cssVarV2('status/success'),
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      selectors: {
        '&[data-active="true"]': {
          animation: 'none',
        },
      },
    },
  },
});

export const uploadWorkflowPhaseIndex = style({
  width: 24,
  height: 24,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 800,
  border: `0.5px solid ${glassStroke}`,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  flexShrink: 0,
  selectors: {
    [`${uploadWorkflowPhaseItem}[data-active="true"] &`]: {
      color: cssVarV2('button/pureWhiteText'),
      borderColor: cssVarV2('button/primary'),
      background: cssVarV2('button/primary'),
    },
    [`${uploadWorkflowPhaseItem}[data-done="true"] &`]: {
      color: cssVarV2('button/pureWhiteText'),
      borderColor: cssVarV2('status/success'),
      background: cssVarV2('status/success'),
    },
  },
});

export const uploadWorkflowPhaseText = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1.24,
});

globalStyle(`${uploadWorkflowPhaseText} strong`, {
  fontSize: 'clamp(11px, 0.9vw, 12px)',
  color: cssVarV2('text/primary'),
  fontWeight: 700,
});

globalStyle(`${uploadWorkflowPhaseText} small`, {
  fontSize: 'clamp(10px, 0.84vw, 11px)',
  color: cssVarV2('text/secondary'),
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const uploadWorkflowProgressTrack = style({
  width: '100%',
  height: 10,
  borderRadius: 999,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  overflow: 'hidden',
  position: 'relative',
});

export const uploadWorkflowProgressFill = style({
  position: 'relative',
  height: '100%',
  borderRadius: 999,
  background: `linear-gradient(90deg, ${cssVarV2('button/primary')} 0%, ${cssVarV2('status/success')} 100%)`,
  transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)',
  selectors: {
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '-35% 0',
      width: '26%',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
      animation: `${progressSweep} 1.4s linear infinite`,
      pointerEvents: 'none',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      selectors: {
        '&::after': {
          animation: 'none',
        },
      },
    },
  },
});

export const uploadWorkflowMeta = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const uploadWorkflowMetaChip = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  borderRadius: 999,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  backdropFilter: 'blur(10px) saturate(130%)',
  padding: '3px 8px',
  selectors: {
    '&[data-tone="success"]': {
      color: cssVarV2('status/success'),
      borderColor: cssVarV2('status/success'),
      background: `color-mix(in srgb, ${cssVarV2('status/success')} 10%, ${cssVarV2('layer/background/primary')})`,
    },
    '&[data-tone="warning"]': {
      color: cssVarV2('button/primary'),
      borderColor: cssVarV2('button/primary'),
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 10%, ${cssVarV2('layer/background/primary')})`,
    },
    '&[data-tone="info"]': {
      color: cssVarV2('text/primary'),
      borderColor: `color-mix(in srgb, ${cssVarV2('text/primary')} 24%, ${glassStroke})`,
    },
    '&[data-tone="error"]': {
      color: cssVarV2('status/error'),
      borderColor: cssVarV2('status/error'),
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 10%, ${cssVarV2('layer/background/primary')})`,
    },
  },
});

export const uploadChecklist = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  background:
    `${glassFill}, linear-gradient(120deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent) 0%, color-mix(in srgb, ${cssVarV2('button/primary')} 9%, transparent) 100%)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  borderRadius: 12,
  padding: '10px 12px',
});

export const uploadPhaseRail = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  '@media': {
    '(max-width: 860px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const uploadPhaseStep = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  padding: '7px 10px',
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  backdropFilter: 'blur(10px) saturate(134%)',
  selectors: {
    '&[data-active="true"]': {
      borderColor: cssVarV2('button/primary'),
      color: cssVarV2('text/primary'),
      background:
        `linear-gradient(120deg, color-mix(in srgb, ${cssVarV2('button/primary')} 18%, transparent), color-mix(in srgb, var(--affine-background-primary-color) 88%, transparent))`,
      boxShadow: '0 8px 18px rgba(2, 6, 23, 0.2)',
    },
  },
});

export const uploadStagePanel = style({
  borderRadius: 14,
  border: '1px solid transparent',
  background: 'transparent',
  padding: 10,
  backdropFilter: 'none',
  animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
  selectors: {
    '&[data-substep="select"]': {
      animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const uploadStagePanelMuted = style({
  borderRadius: 12,
  border: '1px solid transparent',
  background: 'transparent',
  padding: 8,
  opacity: 0.92,
  selectors: {
    '&[data-substep="review"]': {
      animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
    '&[data-substep="commit"]': {
      animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const uploadSubstepSurface = style({
  willChange: 'transform, opacity',
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none !important',
      transition: 'none !important',
    },
  },
});

export const uploadSubstepSelect = style({
  animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
});

 export const uploadSubstepSelectExit = style({
   overflow: 'hidden',
   pointerEvents: 'none',
   animation: `${surfaceExit} 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
   willChange: 'transform, opacity, max-height',
   '@media': {
     '(prefers-reduced-motion: reduce)': {
       animation: 'none',
       maxHeight: 0,
       opacity: 0,
     },
   },
 });

export const uploadSubstepReview = style({
  animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
});

export const uploadSubstepCommit = style({
  animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
});

export const commitSuccessReveal = style({
  animation: `${commitReveal} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
});

export const analysisHeroCard = style({
  padding: '12px 14px',
  borderRadius: 10,
  background: `${glassFill}, linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent) 0%, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent) 100%)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(16px) saturate(150%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  animation: `${heroGlow} 1.8s ease-in-out infinite alternate`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const analysisHeroTitle = style({
  fontSize: 13,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
});

export const analysisHeroMetrics = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const analysisActionDeck = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  '@media': {
    '(max-width: 900px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const analysisActionItem = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '10px 10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  animation: `${cardRise} 260ms cubic-bezier(0.22, 1, 0.36, 1)`,
  selectors: {
    '&[data-tone="primary"]': {
      borderColor: cssVarV2('button/primary'),
      background: `linear-gradient(180deg, ${cssVarV2('layer/background/secondary')} 0%, ${cssVarV2('layer/background/primary')} 100%)`,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const analysisActionTitle = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const analysisActionHint = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.35,
});

export const uploadCommitMetaChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  padding: '2px 8px',
  selectors: {
    '&[data-tone="success"]': {
      borderColor: 'color-mix(in srgb, var(--affine-success-color, #22c55e) 50%, transparent)',
      color: 'color-mix(in srgb, var(--affine-success-color, #22c55e) 70%, var(--affine-text-secondary-color))',
    },
    '&[data-tone="warning"]': {
      borderColor: 'color-mix(in srgb, var(--affine-warning-color, #f59e0b) 50%, transparent)',
      color: 'color-mix(in srgb, var(--affine-warning-color, #f59e0b) 70%, var(--affine-text-secondary-color))',
    },
    '&[data-tone="error"]': {
      borderColor: 'color-mix(in srgb, var(--affine-error-color, #ef4444) 50%, transparent)',
      color: 'color-mix(in srgb, var(--affine-error-color, #ef4444) 70%, var(--affine-text-secondary-color))',
    },
  },
});

export const analysisActionButtonPrimary = style({
  width: '100%',
});

export const analysisActionButtonSecondary = style({
  width: '100%',
  fontSize: 11,
});

export const failureDiagnosticsCard = style({
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(14px) saturate(145%)',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const failureDiagnosticsHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 10,
});

export const failureDiagnosticsTitle = style({
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
});

export const failureDiagnosticsMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const failureDiagnosticsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 180,
  overflowY: 'auto',
  paddingRight: 2,
});

export const failureDiagnosticsItem = style({
  borderRadius: 8,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('status/error')} 28%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/primary')} 88%, transparent)`,
  padding: '8px 9px',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
});

export const failureDiagnosticsReason = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.35,
});

export const failureDiagnosticsActions = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  '@media': {
    '(max-width: 760px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const analysisFailureHint = style({
  fontSize: 11,
  lineHeight: 1.4,
  color: cssVarV2('status/error'),
  borderRadius: 8,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('status/error')} 45%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 8%, ${cssVarV2('layer/background/secondary')})`,
  padding: '8px 10px',
});

export const uploadStatsGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
  selectors: {
    '&[data-commit-reveal="true"]': {
      animation: `${commitReveal} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
  },
  '@media': {
    '(max-width: 760px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
});

export const uploadStatCard = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  selectors: {
    '&[data-tone="warning"]': {
      borderColor: cssVarV2('button/primary'),
    },
    '&[data-tone="error"]': {
      borderColor: cssVarV2('status/error'),
    },
  },
});

export const uploadStatValue = style({
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
  fontVariantNumeric: 'tabular-nums',
});

export const uploadStatLabel = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontWeight: 700,
  letterSpacing: '0.01em',
});

export const uploadBatchCard = style({
  borderRadius: 14,
  border: 'none',
  background: 'transparent',
  backdropFilter: 'none',
  padding: 'clamp(10px, 1vw, 12px) clamp(11px, 1.2vw, 14px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 11,
  selectors: {
    '&[data-substep="review"]': {
      animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
    '&[data-substep="commit"]': {
      animation: `${surfaceEnter} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
  },
  '@media': {
    '(max-width: 768px)': {
      borderRadius: 12,
      gap: 10,
    },
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const uploadBatchFooter = style({
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  marginTop: 2,
});

export const uploadBatchNextButton = style({
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/primary')} 74%, transparent)`,
  backdropFilter: 'blur(10px) saturate(135%)',
  padding: '8px 12px',
  fontWeight: 700,
  selectors: {
    '&:hover:not(:disabled)': {
      background: cssVarV2('layer/background/hoverOverlay'),
      borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 38%, ${glassStroke})`,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      opacity: 0.52,
      cursor: 'not-allowed',
    },
  },
});

export const uploadBatchHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 10,
  fontSize: 12,
  color: cssVarV2('text/primary'),
  fontWeight: 700,
  '@media': {
    '(max-width: 640px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 4,
    },
  },
});

export const uploadBatchStats = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
  lineHeight: 1.35,
});

export const uploadBatchActions = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 10,
  '@media': {
    '(max-width: 860px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
});

globalStyle(`${uploadBatchActions} button`, {
  minHeight: 42,
  width: '100%',
  justifyContent: 'center',
  paddingInline: 12,
  fontWeight: 700,
  '@media': {
    '(max-width: 900px)': {
      minHeight: 44,
    },
  },
});

globalStyle(`${uploadBatchActions} button:focus-visible`, {
  outline: `2px solid ${cssVarV2('button/primary')}`,
  outlineOffset: 2,
});

export const pipelineProgressCard = style({
  borderRadius: 16,
  border: `0.5px solid ${glassStroke}`,
  background: glassFill,
  backdropFilter: 'blur(14px) saturate(140%)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginBottom: 14,
});

export const pipelineProgressHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const pipelineStages = style({
  display: 'flex',
  gap: 8,
  marginTop: 4,
});

export const pipelineStage = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '8px 6px',
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 75%, transparent)',
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  transition: 'all 0.3s ease',
  selectors: {
    '&[data-active="true"]': {
      borderColor: cssVarV2('button/primary'),
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 12%, transparent)`,
      color: cssVarV2('text/primary'),
      animation: `${workflowProgressPulse} 2s ease-in-out infinite`,
    },
    '&[data-done="true"]': {
      borderColor: cssVarV2('status/success'),
      background: `color-mix(in srgb, ${cssVarV2('status/success')} 10%, transparent)`,
      color: cssVarV2('status/success'),
    },
  },
});

export const uploadCommitProgressCard = style({
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, linear-gradient(130deg, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent), color-mix(in srgb, ${cssVarV2('button/primary')} 12%, transparent))`,
  backdropFilter: 'blur(14px) saturate(145%)',
  padding: 'clamp(9px, 1vw, 11px) clamp(10px, 1.15vw, 12px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 9,
  '@media': {
    '(max-width: 640px)': {
      borderRadius: 10,
      gap: 8,
    },
  },
});

export const uploadCommitProgressHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const uploadCommitProgressHeaderOld = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  fontVariantNumeric: 'tabular-nums',
  '@media': {
    '(max-width: 560px)': {
      flexWrap: 'wrap',
      rowGap: 4,
    },
  },
});

export const uploadCommitProgressTrack = style({
  width: '100%',
  height: 9,
  borderRadius: 999,
  overflow: 'hidden',
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
});

export const uploadCommitProgressFill = style({
  position: 'relative',
  height: '100%',
  borderRadius: 999,
  background: `linear-gradient(90deg, ${cssVarV2('button/primary')} 0%, ${cssVarV2('status/success')} 100%)`,
  transition: 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)',
  selectors: {
    '&[data-active="true"]::after': {
      content: '""',
      position: 'absolute',
      inset: '-35% 0',
      width: '30%',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)',
      animation: `${progressSweep} 1.25s linear infinite`,
      pointerEvents: 'none',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      selectors: {
        '&[data-active="true"]::after': {
          animation: 'none',
        },
      },
    },
  },
});

export const uploadCommitProgressMeta = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.35,
});

export const commitTerminalPanel = style({
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: `color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)`,
  backdropFilter: 'blur(12px) saturate(135%)',
  padding: '8px 9px',
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
});

export const commitTerminalHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
});

export const commitTerminalToggle = style({
  border: 'none',
  background: 'transparent',
  padding: 0,
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  cursor: 'pointer',
  color: cssVarV2('text/primary'),
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '-0.01em',
});

globalStyle(`${commitTerminalToggle}:focus-visible`, {
  outline: `2px solid ${cssVarV2('button/primary')}`,
  outlineOffset: 2,
  borderRadius: 8,
});

export const commitTerminalHint = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
});

export const commitTerminalActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

export const commitTerminalCheckbox = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  userSelect: 'none',
});

globalStyle(`${commitTerminalCheckbox} input`, {
  accentColor: cssVarV2('button/primary'),
});

export const commitTerminalCopy = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `color-mix(in srgb, var(--affine-background-primary-color) 70%, transparent)`,
  padding: '6px 10px',
  fontSize: 10,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
});

globalStyle(`${commitTerminalCopy}:hover`, {
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 12%, var(--affine-background-primary-color))`,
  borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 35%, ${glassStroke})`,
});

globalStyle(`${commitTerminalCopy}:active`, {
  transform: 'translateY(0.5px)',
});

globalStyle(`${commitTerminalCopy}:disabled`, {
  cursor: 'not-allowed',
  opacity: 0.55,
});

globalStyle(`${commitTerminalCopy}:focus-visible`, {
  outline: `2px solid ${cssVarV2('button/primary')}`,
  outlineOffset: 2,
});

export const commitTerminalBody = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `linear-gradient(180deg, color-mix(in srgb, #000 26%, transparent), color-mix(in srgb, #000 10%, transparent)), color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)`,
  padding: '7px 8px',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 10,
  lineHeight: 1.4,
  color: 'color-mix(in srgb, var(--affine-text-primary-color) 92%, transparent)',
  maxHeight: 240,
  overflowY: 'auto',
  selectors: {
    '&[data-collapsed="true"]': {
      maxHeight: 92,
    },
  },
});

export const commitTerminalLine = style({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  padding: '1px 2px',
  borderRadius: 6,
  selectors: {
    '&[data-level="success"]': {
      color: `color-mix(in srgb, ${cssVarV2('status/success')} 86%, white)`,
    },
    '&[data-level="warn"]': {
      color: `color-mix(in srgb, ${cssVarV2('status/error')} 72%, ${cssVarV2('text/primary')})`,
    },
    '&[data-level="error"]': {
      color: `color-mix(in srgb, ${cssVarV2('status/error')} 86%, white)`,
    },
  },
});

globalStyle(`${commitTerminalLine}:hover`, {
  background: `color-mix(in srgb, var(--affine-hover-color) 38%, transparent)`,
});

export const recoveryActions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'flex-start',
});

export const recoveryDetails = style({
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: `color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '8px 10px',
});

export const recoverySummary = style({
  cursor: 'pointer',
  userSelect: 'none',
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  listStyle: 'none',
  outline: 'none',
  selectors: {
    '&::-webkit-details-marker': {
      display: 'none',
    },
    '&:hover': {
      color: cssVarV2('button/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
      borderRadius: 8,
    },
  },
});

export const prequalificationCard = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  padding: '9px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const prequalificationHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 11,
  color: cssVarV2('text/primary'),
  fontWeight: 700,
});

export const prequalificationStats = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const prequalificationRiskList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 120,
  overflowY: 'auto',
});

export const prequalificationRiskItem = style({
  borderRadius: 8,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('status/error')} 32%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 7%, ${cssVarV2('layer/background/primary')})`,
  padding: '6px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const analysisCard = style({
  padding: '10px 14px',
  borderRadius: 8,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  fontSize: 11,
  color: cssVarV2('text/primary'),
});

export const analysisCardAccent = style({
  color: cssVarV2('status/error'),
  fontWeight: 600,
});

export const analysisStatus = style({
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 6,
  fontWeight: 500,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/secondary'),
});

export const analysisStatusError = style({
  color: cssVarV2('status/error'),
});

export const bannerOk = style({
  fontSize: 10,
  fontWeight: 600,
  padding: '6px 10px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  color: cssVarV2('text/primary'),
  selectors: {
    '&[data-commit-reveal="true"]': {
      animation: `${commitReveal} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const bannerWarn = style({
  fontSize: 11,
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  color: cssVarV2('text/primary'),
});

export const statsRow = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const navBar = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 10,
  marginTop: 12,
  padding: 0,
  borderTop: 'none',
  background: 'transparent',
  '@media': {
    '(max-width: 768px)': {
      alignItems: 'stretch',
      flexDirection: 'column',
      paddingTop: 0,
    },
  },
});

export const navMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flexWrap: 'wrap',
});

export const navRight = style({
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  '@media': {
    '(max-width: 768px)': {
      width: '100%',
    },
  },
});

export const skipButton = style({
  fontSize: 11,
});

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

export const evidenceList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  borderRadius: 8,
  padding: '8px 10px',
});

export const filtersRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

export const filterChipButton = style({
  fontSize: 11,
  borderRadius: 999,
  selectors: {
    '&[data-active="true"]': {
      borderColor: cssVarV2('button/primary'),
      background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
      backdropFilter: 'blur(10px) saturate(135%)',
      color: cssVarV2('text/primary'),
      boxShadow: `0 10px 24px color-mix(in srgb, ${cssVarV2(
        'button/primary'
      )} 28%, transparent), 0 0 0 1px ${cssVarV2('button/primary')}`,
    },
  },
});

export const reviewDocList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 210,
  overflowY: 'auto',
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 8,
  padding: '8px 10px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const reviewDocItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 11,
  color: cssVarV2('text/primary'),
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  padding: '7px 8px',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  animation: `${cardRise} 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
  selectors: {
    '&[data-tone="failed"]': {
      borderColor: cssVarV2('status/error'),
    },
    '&[data-tone="review"]': {
      borderColor: cssVarV2('button/primary'),
    },
    '&[data-tone="ready"]': {
      borderColor: cssVarV2('status/success'),
    },
    '&[data-priority="true"]': {
      borderColor: cssVarV2('button/primary'),
      animation: `${cardRise} 220ms cubic-bezier(0.22, 1, 0.36, 1), ${priorityGlow} 260ms ease-out both`,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const reviewDocTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  wordBreak: 'break-word',
});

export const reviewDocMetaRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
});

export const reviewDocStatusBadge = style({
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 999,
  padding: '2px 7px',
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/secondary'),
  selectors: {
    '&[data-tone="failed"]': {
      borderColor: cssVarV2('status/error'),
      color: cssVarV2('status/error'),
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 12%, transparent)`,
    },
    '&[data-tone="review"]': {
      borderColor: 'color-mix(in srgb, #f59e0b 34%, transparent)',
      color: 'color-mix(in srgb, #f59e0b 78%, var(--affine-text-primary-color))',
      background: 'color-mix(in srgb, #f59e0b 12%, transparent)',
    },
    '&[data-tone="ready"]': {
      borderColor: cssVarV2('status/success'),
      color: cssVarV2('status/success'),
      background: `color-mix(in srgb, ${cssVarV2('status/success')} 12%, transparent)`,
    },
  },
});

export const reviewDocPriorityPill = style({
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 999,
  padding: '2px 7px',
  color: cssVarV2('button/pureWhiteText'),
  background: cssVarV2('button/primary'),
});

export const reviewDocChunkMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const finalizeExplanationCard = style({
  borderRadius: 14,
  border: `0.5px solid ${glassStroke}`,
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 8%, transparent)`,
  backdropFilter: 'blur(12px) saturate(135%)',
  padding: 14,
  marginBottom: 14,
});

export const finalizeExplanationTitle = style({
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 10,
  display: 'block',
});

export const finalizeExplanationList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const finalizeExplanationItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

// Apply larger font size to the first span in finalizeExplanationItem
globalStyle(`${finalizeExplanationItem} > span:first-child`, {
  fontSize: 14,
  flexShrink: 0,
});

export const priorityBadge = style({
  display: 'inline-block',
  fontSize: 9,
  fontWeight: 700,
  borderRadius: 4,
  padding: '2px 5px',
  marginRight: 8,
  color: cssVarV2('button/pureWhiteText'),
  background: cssVarV2('text/secondary'),
  verticalAlign: 'middle',
  selectors: {
    '[data-priority="P1"] &': {
      background: '#ef4444',
    },
    '[data-priority="P2"] &': {
      background: '#f59e0b',
    },
    '[data-priority="P3"] &': {
      background: cssVarV2('text/tertiary'),
    },
  },
});

export const aktenzeichenConfirmationBanner = style({
  borderRadius: 16,
  border: `1px solid ${cssVarV2('button/primary')}`,
  background: `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('button/primary')} 15%, transparent), color-mix(in srgb, ${cssVarV2('button/primary')} 8%, transparent))`,
  backdropFilter: 'blur(14px) saturate(140%)',
  padding: 16,
  marginBottom: 16,
  boxShadow: `0 8px 24px color-mix(in srgb, ${cssVarV2('button/primary')} 18%, transparent)`,
  animation: `${cardRise} 400ms cubic-bezier(0.22, 1, 0.36, 1)`,
});

export const aktenzeichenConfirmationHeader = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 14,
});

globalStyle(`${aktenzeichenConfirmationHeader} > strong`, {
  fontSize: 14,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

globalStyle(`${aktenzeichenConfirmationHeader} > span`, {
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const aktenzeichenConfirmationBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const metadataResolutionPanel = style({
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const metadataResolutionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
});

globalStyle(`${metadataResolutionHeader} > strong`, {
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const metadataResolutionBadges = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
});

export const metadataResolutionBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '3px 8px',
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  selectors: {
    '&[data-tone="high"]': {
      borderColor: cssVarV2('status/success'),
      color: cssVarV2('status/success'),
      background: `color-mix(in srgb, ${cssVarV2('status/success')} 12%, transparent)`,
    },
    '&[data-tone="medium"]': {
      borderColor: 'color-mix(in srgb, #f59e0b 34%, transparent)',
      color: 'color-mix(in srgb, #f59e0b 78%, var(--affine-text-primary-color))',
      background: 'color-mix(in srgb, #f59e0b 12%, transparent)',
    },
    '&[data-tone="low"]': {
      borderColor: cssVarV2('status/error'),
      color: cssVarV2('status/error'),
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 12%, transparent)`,
    },
    '&[data-tone="conflict"]': {
      borderColor: cssVarV2('status/error'),
      color: cssVarV2('status/error'),
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 10%, transparent)`,
    },
    '&[data-tone="review"]': {
      borderColor: 'color-mix(in srgb, #f59e0b 34%, transparent)',
      color: 'color-mix(in srgb, #f59e0b 78%, var(--affine-text-primary-color))',
      background: 'color-mix(in srgb, #f59e0b 12%, transparent)',
    },
    '&[data-tone="stable"]': {
      borderColor: cssVarV2('button/primary'),
      color: cssVarV2('button/primary'),
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 10%, transparent)`,
    },
  },
});

export const metadataCandidateBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

globalStyle(`${metadataCandidateBlock} > strong`, {
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const metadataCandidateList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

export const metadataCandidateItem = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '3px 8px',
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
});

export const metadataEvidenceDetails = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  padding: '8px 10px',
});

globalStyle(`${metadataEvidenceDetails} > summary`, {
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  outline: 'none',
});

export const metadataEvidenceList = style({
  marginTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

export const metadataEvidenceItem = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.35,
});

export const aktenzeichenConfirmationActions = style({
  display: 'flex',
  gap: 10,
  marginTop: 4,
  '@media': {
    '(max-width: 560px)': {
      flexDirection: 'column',
    },
  },
});

export const stammdatenOverviewCard = style({
  borderRadius: 14,
  border: `0.5px solid ${glassStroke}`,
  background: glassFill,
  backdropFilter: 'blur(12px) saturate(135%)',
  padding: 14,
  marginBottom: 14,
});

export const stammdatenOverviewHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
});

globalStyle(`${stammdatenOverviewHeader} > strong`, {
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const stammdatenOverviewGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 10,
});

export const stammdatenOverviewItem = style({
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  gap: 10,
  fontSize: 12,
  '@media': {
    '(max-width: 560px)': {
      gridTemplateColumns: '1fr',
      gap: 4,
    },
  },
});

export const stammdatenOverviewLabel = style({
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const stammdatenOverviewValue = style({
  color: cssVarV2('text/primary'),
  wordBreak: 'break-word',
});

export const optionalFieldsWarnings = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 14,
});

export const bannerInfo = style({
  borderRadius: 12,
  border: `0.5px solid ${cssVarV2('button/primary')}`,
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 6%, transparent)`,
  backdropFilter: 'blur(10px) saturate(130%)',
  padding: 12,
  fontSize: 12,
  color: cssVarV2('text/primary'),
});

export const reviewConfirmationRow = style({
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  fontSize: 11,
  color: cssVarV2('text/primary'),
});

export const reviewReadinessCard = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  selectors: {
    '&[data-tone="ready"]': {
      borderColor: cssVarV2('status/success'),
    },
    '&[data-tone="review"]': {
      borderColor: cssVarV2('button/primary'),
    },
    '&[data-tone="blocked"]': {
      borderColor: cssVarV2('status/error'),
    },
  },
});

export const reviewReadinessTitle = style({
  fontSize: 12,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
});

export const reviewReadinessText = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.35,
});

export const reviewReadinessMetrics = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
});

export const finalSnapshotGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  '@media': {
    '(max-width: 900px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '(max-width: 560px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const finalSnapshotCard = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(12px) saturate(135%)',
  padding: '9px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const finalSnapshotLabel = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
});

export const finalSnapshotValue = style({
  fontSize: 15,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
  lineHeight: 1.1,
});

export const missingFieldList = style({
  marginTop: 8,
  marginBottom: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
});

export const documentReviewDetails = style({
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '8px 10px',
});

export const documentReviewSummary = style({
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
  outline: 'none',
  selectors: {
    '&::-webkit-details-marker': {
      color: cssVarV2('text/secondary'),
    },
  },
});

// ── GAP-4: Failed document per-row styles ──

export const failedDocRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 0',
  borderBottom: `1px solid color-mix(in srgb, ${cssVarV2('text/tertiary')} 40%, transparent)`,
  selectors: {
    '&:last-of-type': {
      borderBottom: 'none',
    },
  },
});

export const failedDocInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  overflow: 'hidden',
  flex: 1,
  minWidth: 0,
});

export const failedDocTitle = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const failedDocReason = style({
  fontSize: 11,
  color: cssVarV2('text/tertiary'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const failedDocActions = style({
  display: 'flex',
  gap: 4,
  flexShrink: 0,
});

// ── GAP-6: Detection spinner ──

export const detectionSpinner = style({
  display: 'inline-block',
  width: 14,
  height: 14,
  border: `2px solid ${cssVarV2('text/secondary')}`,
  borderTopColor: cssVarV2('button/primary'),
  borderRadius: '50%',
  animation: `${spinRotate} 0.7s linear infinite`,
  marginRight: 6,
  verticalAlign: 'middle',
  flexShrink: 0,
});
