import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, globalStyle, keyframes, style } from '@vanilla-extract/css';

import {
  glassStroke,
  interactionTransition,
} from '../../../../layouts/workspace-list-shared-styles';

export const severityColorVar = createVar();

const sessionItemEnter = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(-4px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const rootSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  padding: 0,
  overflow: 'hidden',
  height: '100%',
  minHeight: 520,
  background: 'transparent',
  '@media': {
    '(max-width: 768px)': {
      minHeight: 400,
    },
  },
});

export const modelPickerFeaturedSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: '2px 2px 8px',
  borderBottom: '1px solid var(--affine-border-color)',
});

export const modelPickerFeaturedTitle = style({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.35,
  textTransform: 'uppercase',
  color: cssVarV2('text/secondary'),
  padding: '2px 4px',
});

export const modelPickerFeaturedList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const modelPickerPrimary = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const modelPickerSecondary = style({
  fontSize: 10,
  fontWeight: 600,
  opacity: 0.78,
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const casePicker = style({
  position: 'relative',
  minWidth: 260,
  width: '100%',
  '@media': {
    '(max-width: 768px)': {
      minWidth: 180,
    },
  },
});

export const casePickerButton = style({
  width: '100%',
  borderRadius: 14,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  fontWeight: 650,
  padding: '5px 12px',
  minHeight: 32,
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor: 'var(--affine-border-color)',
    },
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});

export const casePickerButtonLabel = style({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const casePickerDropdown = style({
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  zIndex: 120,
  borderRadius: 12,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-overlay-panel-color)',
  padding: 8,
  boxShadow: 'var(--affine-popover-shadow)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const caseSearchInput = style({
  width: '100%',
  borderRadius: 8,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  lineHeight: 1.4,
  padding: '8px 10px',
  outline: 'none',
  transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  selectors: {
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: '0 0 0 3px color-mix(in srgb, var(--affine-primary-color) 18%, transparent)',
    },
  },
});

export const casePickerList = style({
  maxHeight: 220,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const casePickerItem = style({
  border: `1px solid transparent`,
  background: 'transparent',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  borderRadius: 8,
  textAlign: 'left',
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
});

export const casePickerItemActive = style({
  borderColor: cssVarV2('button/primary'),
  background: 'color-mix(in srgb, var(--affine-primary-color) 12%, var(--affine-background-primary-color))',
});

export const casePickerItemLabel = style({
  fontSize: 12,
  fontWeight: 650,
  color: cssVarV2('text/primary'),
});

export const casePickerItemMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const casePickerEmpty = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  padding: '8px 10px',
});

export const caseSelectHint = style({
  fontSize: 11,
  lineHeight: 1.3,
  color: 'color-mix(in srgb, var(--affine-text-primary-color) 76%, var(--affine-text-secondary-color))',
  maxWidth: 260,
});

export const caseSelectWrap = style({
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  minHeight: 36,
  minWidth: 250,
  '@media': {
    '(max-width: 768px)': {
      minWidth: 0,
      width: '100%',
    },
  },
});

export const caseSelectLabel = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
});

export const caseSelect = style({
  borderRadius: 14,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  minHeight: 32,
  minWidth: 180,
  outline: 'none',
  transition: 'border-color 0.16s ease, background 0.16s ease',
  selectors: {
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});

export const newChatCta = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  borderRadius: 16,
  padding: '5px 14px 5px 11px',
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
  background:
    `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('button/primary')} 68%, var(--affine-background-primary-color) 32%) 0%, color-mix(in srgb, ${cssVarV2('button/primary')} 56%, var(--affine-background-primary-color) 44%) 100%)`,
  color: cssVarV2('button/pureWhiteText'),
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  minHeight: 32,
  transition:
    'background 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease, box-shadow 0.22s ease',
  selectors: {
    '&:hover': {
      opacity: 0.9,
    },
    '&:active': {
      opacity: 0.85,
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
  '@media': {
    '(max-width: 420px)': {
      padding: '5px 12px 5px 9px',
      fontSize: 12,
    },
  },
});

export const newChatCtaIcon = style({
  fontSize: 18,
  fontWeight: 300,
  lineHeight: 1,
  opacity: 0.9,
});

export const headerBar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '10px 20px',
  borderBottom: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  borderRadius: 0,
  flexWrap: 'nowrap',
  '@media': {
    '(max-width: 1200px)': {
      flexWrap: 'wrap',
      alignItems: 'stretch',
      padding: '10px 20px',
      gap: 10,
    },
    '(max-width: 900px)': {
      alignItems: 'flex-start',
    },
    '(max-width: 420px)': {
      padding: '8px 14px',
      gap: 8,
    },
  },
});

export const headerIcon = style({ fontSize: 18 });
export const iconSm = style({ fontSize: 10, opacity: 0.75 });
export const flex1 = style({ flex: '1 1 280px', minWidth: 0 });
export const headerTitleRow = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  minWidth: 0,
  '@media': {
    '(max-width: 640px)': {
      flexWrap: 'wrap',
      gap: 4,
    },
  },
});
export const headerTitle = style({ fontSize: 16, fontWeight: 760, lineHeight: 1.3, color: cssVarV2('text/primary'), letterSpacing: -0.2 });
export const headerSubtitle = style({
  fontSize: 13,
  color: 'color-mix(in srgb, var(--affine-text-primary-color) 86%, var(--affine-text-secondary-color))',
  marginTop: 0,
  lineHeight: 1.35,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  '@media': {
    '(max-width: 640px)': {
      whiteSpace: 'normal',
      textOverflow: 'clip',
    },
  },
});

export const headerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  rowGap: 6,
  flexWrap: 'nowrap',
  flex: '1 1 auto',
  minWidth: 0,
  justifyContent: 'flex-end',
  '@media': {
    '(max-width: 1200px)': {
      width: '100%',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
  },
});


export const headerActionButton = style({
  background: 'var(--affine-background-primary-color)',
  border: `1px solid ${glassStroke}`,
  borderRadius: 14,
  padding: '5px 12px',
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  minHeight: 32,
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color-filled)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  },
  '@media': {
    '(max-width: 420px)': {
      fontSize: 11,
      padding: '6px 10px',
    },
  },
});


export const sessionList = style({
  maxHeight: 'min(220px, 34vh)',
  overflowY: 'auto',
  padding: '8px 10px 10px',
  borderBottom: '1px solid var(--affine-border-color)',
  background: 'transparent',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  '@media': {
    '(max-width: 420px)': {
      maxHeight: 'min(180px, 30vh)',
      padding: '6px 8px',
    },
  },
});

export const contextQuickbar = style({
  padding: '8px 24px 10px',
  borderBottom: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  '@media': {
    '(max-width: 768px)': {
      padding: '8px 16px 10px',
    },
  },
});

export const contextQuickbarTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: 0.35,
  marginBottom: 6,
});

export const contextQuickbarGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 8,
  '@media': {
    '(max-width: 1200px)': {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    },
    '(max-width: 620px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
});

export const contextMetricChip = style({
  borderRadius: 10,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
});

// Target child elements with globalStyle
globalStyle(`${contextMetricChip} span`, {
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

globalStyle(`${contextMetricChip} strong`, {
  fontSize: 13,
  color: cssVarV2('text/primary'),
  fontWeight: 750,
});

export const contextStatusChip = style([
  contextMetricChip,
  {
    borderColor: cssVarV2('button/primary'),
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--affine-primary-color) 16%, var(--affine-background-primary-color)) 0%, color-mix(in srgb, var(--affine-primary-color) 10%, var(--affine-background-primary-color)) 100%)',
  },
]);

export const contextCompactBar = style({
  padding: '8px 20px',
  borderBottom: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  '@media': {
    '(max-width: 980px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8,
    },
    '(max-width: 420px)': {
      padding: '8px 14px',
    },
  },
});

export const contextCompactInfo = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const contextCompactTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: 0.3,
});

export const contextCompactMeta = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const contextCompactBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '2px 8px',
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 14%, transparent)`,
  color: cssVarV2('button/primary'),
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
});

export const contextCompactHint = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  opacity: 0.9,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const contextCompactActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
  '@media': {
    '(max-width: 560px)': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
    },
  },
});

export const contextCompactAction = style({
  borderRadius: 14,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  fontWeight: 650,
  minHeight: 32,
  padding: '5px 10px',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color-filled)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  },
});

export const labelXs = style({
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 4,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: 0.25,
});
export const emptyText = style({ fontSize: 12, color: cssVarV2('text/secondary'), padding: '10px 2px' });

export const sessionItem = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 6,
  padding: 0,
  borderRadius: 12,
  marginBottom: 2,
  minHeight: 48,
  animation: `${sessionItemEnter} 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both`,
  transition: 'background 0.16s ease, border-color 0.16s ease, box-shadow 0.18s ease',
  border: `1px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  selectors: {
    '&:hover': {
      borderColor: 'color-mix(in srgb, var(--affine-primary-color) 32%, var(--affine-border-color))',
      background: 'color-mix(in srgb, var(--affine-hover-color) 70%, var(--affine-background-primary-color))',
      boxShadow: '0 10px 20px -16px color-mix(in srgb, var(--affine-primary-color) 35%, transparent)',
    },
    '&:focus-within': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: '0 0 0 1px color-mix(in srgb, var(--affine-primary-color) 35%, transparent)',
    },
  },
});

export const sessionItemActive = style({
  borderColor: 'color-mix(in srgb, var(--affine-primary-color) 48%, var(--affine-border-color))',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--affine-primary-color) 10%, var(--affine-background-primary-color)) 0%, color-mix(in srgb, var(--affine-background-primary-color) 92%, transparent) 100%)',
  boxShadow: '0 0 0 1px color-mix(in srgb, var(--affine-primary-color) 24%, transparent)',
});
export const sessionItemSwiped = style({
  borderColor: 'color-mix(in srgb, var(--affine-primary-color) 42%, var(--affine-border-color))',
  boxShadow: '0 12px 20px -18px color-mix(in srgb, var(--affine-primary-color) 42%, transparent)',
});
export const sessionMainButton = style({
  width: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  minHeight: 48,
  padding: '10px 12px',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 11,
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -1,
    },
  },
});
export const sessionIcon = style({ fontSize: 11 });
export const sessionTitle = style({ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: cssVarV2('text/primary'), lineHeight: 1.3 });
export const sessionMeta = style({ fontSize: 11, color: cssVarV2('text/secondary'), marginTop: 3 });
export const sessionPreview = style({
  fontSize: 11,
  color: 'color-mix(in srgb, var(--affine-text-secondary-color) 88%, transparent)',
  marginTop: 3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 1.3,
});
export const sessionMetaRow = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 1,
});
export const sessionModeBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '1px 7px',
  border: '1px solid color-mix(in srgb, var(--affine-border-color) 88%, transparent)',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, transparent)',
  color: cssVarV2('text/secondary'),
  fontSize: 10,
  fontWeight: 650,
  lineHeight: 1.5,
});
export const sessionPinnedBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '1px 7px',
  border: '1px solid color-mix(in srgb, var(--affine-primary-color) 38%, transparent)',
  background: 'color-mix(in srgb, var(--affine-primary-color) 12%, transparent)',
  color: cssVarV2('button/primary'),
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.5,
});
export const sessionTimestamp = style({
  fontSize: 10,
  color: 'color-mix(in srgb, var(--affine-text-secondary-color) 86%, transparent)',
});
export const renameInput = style({
  width: '100%',
  fontSize: 12,
  border: `1px solid ${cssVarV2('button/primary')}`,
  borderRadius: 8,
  padding: '6px 8px',
  background: 'var(--affine-background-primary-color)',
  color: cssVarV2('text/primary'),
});
export const sessionActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  paddingRight: 8,
  opacity: 0,
  transform: 'translateX(4px)',
  pointerEvents: 'none',
  transition: 'opacity 0.16s ease, transform 0.16s ease',
  selectors: {
    [`${sessionItem}:hover &`]: {
      opacity: 1,
      transform: 'translateX(0)',
      pointerEvents: 'auto',
    },
    [`${sessionItem}:focus-within &`]: {
      opacity: 1,
      transform: 'translateX(0)',
      pointerEvents: 'auto',
    },
    [`${sessionItemSwiped} &`]: {
      opacity: 1,
      transform: 'translateX(0)',
      pointerEvents: 'auto',
    },
  },
  '@media': {
    '(hover: none)': {
      gap: 6,
      paddingRight: 6,
    },
  },
});

export const iconButton = style({
  background: 'var(--affine-background-primary-color)',
  border: '1px solid color-mix(in srgb, var(--affine-border-color) 86%, transparent)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 650,
  padding: '3px 7px',
  color: cssVarV2('text/secondary'),
  minHeight: 26,
  transition: 'background 0.12s ease, border-color 0.12s ease',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color-filled)',
      borderColor: 'color-mix(in srgb, var(--affine-primary-color) 28%, var(--affine-border-color))',
    },
    '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}`, outlineOffset: 2 },
  },
});
export const iconButtonDanger = style({
  color: cssVarV2('status/error'),
  borderColor: 'color-mix(in srgb, var(--affine-v2-status-error) 55%, transparent)',
  selectors: {
    '&:hover': {
      background: 'color-mix(in srgb, var(--affine-v2-status-error) 10%, var(--affine-background-primary-color))',
      borderColor: cssVarV2('status/error'),
    },
  },
});

export const messagesArea = style({
  flex: 1,
  overflowY: 'auto',
  padding: '28px 32px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minHeight: 240,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 97%, rgba(15,23,42,0.08)) 0%, color-mix(in srgb, var(--affine-background-primary-color) 92%, rgba(15,23,42,0.14)) 100%)',
  '@media': {
    '(max-width: 768px)': {
      padding: '20px 20px',
      gap: 14,
      minHeight: 200,
    },
    '(max-width: 420px)': {
      padding: '16px 16px',
      gap: 12,
      minHeight: 180,
    },
  },
});

export const messagesInner = style({
  width: '100%',
  maxWidth: 920,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
});

export const pendingBar = style({
  display: 'flex',
  gap: 8,
  padding: '10px 14px',
  background: cssVarV2('layer/background/secondary'),
  border: `1px solid ${cssVarV2('button/primary')}`,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  '@media': {
    '(max-width: 768px)': {
      justifyContent: 'flex-start',
      padding: '8px 10px',
    },
  },
});
export const pendingLabel = style({ fontSize: 13, fontWeight: 600, color: cssVarV2('button/primary') });
export const pendingAccept = style({
  padding: '5px 14px',
  borderRadius: 7,
  border: 'none',
  background: cssVarV2('status/success'),
  color: cssVarV2('layer/pureWhite'),
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  minHeight: 34,
  transition: 'transform 0.08s ease, filter 0.12s ease',
  selectors: {
    '&:hover': { filter: 'brightness(1.06)' },
    '&:active': { transform: 'translateY(0.5px)' },
  },
});
export const pendingCancel = style({
  padding: '5px 14px',
  borderRadius: 7,
  border: `1px solid ${cssVarV2('status/error')}`,
  background: 'transparent',
  color: cssVarV2('status/error'),
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  minHeight: 34,
  transition: 'background 0.12s ease, transform 0.08s ease',
  selectors: {
    '&:hover': {
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 10%, transparent)`,
    },
    '&:active': { transform: 'translateY(0.5px)' },
  },
});

export const centerState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  flex: 1,
  gap: 20,
  padding: '44px 32px 28px',
  '@media': {
    '(max-width: 768px)': {
      padding: '32px 20px 24px',
      gap: 16,
    },
    '(max-width: 420px)': {
      padding: '24px 16px 20px',
      gap: 14,
    },
  },
});
export const centerIconLg = style({ fontSize: 48 });
export const centerIconMd = style({ fontSize: 36 });
export const centerTitle = style({ fontSize: 22, fontWeight: 750, textAlign: 'center', color: cssVarV2('text/primary'), letterSpacing: -0.4, lineHeight: 1.3 });
export const centerBody = style({ fontSize: 14, color: cssVarV2('text/secondary'), textAlign: 'center', maxWidth: 560, lineHeight: 1.75 });
export const providerWarning = style({ marginTop: 16, padding: '14px 20px', background: cssVarV2('layer/background/secondary'), borderRadius: 12, border: `1px solid ${glassStroke}`, fontSize: 13, color: cssVarV2('text/secondary'), textAlign: 'center', maxWidth: 480, lineHeight: 1.6 });

export const suggestionGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  width: '100%',
  maxWidth: 920,
  marginTop: 12,
  '@media': {
    '(max-width: 980px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    '(max-width: 560px)': { gridTemplateColumns: '1fr' },
  },
});

export const suggestionCard = style({
  textAlign: 'left',
  padding: '16px 20px',
  borderRadius: 14,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color-filled)',
      borderColor: 'var(--affine-border-color)',
    },
    '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}`, outlineOffset: 2 },
  },
  '@media': {
    '(max-width: 420px)': {
      padding: '14px 16px',
    },
  },
});

export const suggestionTitle = style({
  fontSize: 14,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 6,
  lineHeight: 1.3,
});

export const suggestionBody = style({
  fontSize: 12,
  lineHeight: 1.6,
  color: cssVarV2('text/secondary'),
});

export const slashMenu = style({ padding: '6px 14px', borderTop: `1px solid ${glassStroke}`, background: 'transparent' });
export const slashList = style({ display: 'flex', flexWrap: 'wrap', gap: 4 });
export const slashCommandButton = style({ padding: '3px 8px', borderRadius: 5, border: `1px solid ${glassStroke}`, background: 'var(--affine-background-primary-color)', cursor: 'pointer', fontSize: 11, color: cssVarV2('text/primary') });
export const slashCommandDesc = style({ opacity: 0.7 });

export const inputBar = style({
  padding: '12px 20px 14px',
  borderTop: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  borderRadius: 0,
  '@media': {
    '(max-width: 768px)': {
      padding: '12px 20px 14px',
    },
    '(max-width: 420px)': {
      padding: '10px 16px 12px',
    },
  },
});

export const composerInner = style({
  width: '100%',
  maxWidth: 920,
  margin: '0 auto',
});
export const inputRow = style({
  display: 'flex',
  gap: 10,
  alignItems: 'flex-end',
  '@media': {
    '(max-width: 980px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    '(max-width: 420px)': {
      gap: 6,
      alignItems: 'stretch',
    },
  },
});
export const textarea = style({
  flex: 1,
  resize: 'none',
  padding: '11px 14px',
  borderRadius: 14,
  border: `1px solid ${glassStroke}`,
  fontSize: 14,
  lineHeight: 1.45,
  fontFamily: 'inherit',
  color: cssVarV2('text/primary'),
  background: 'var(--affine-background-primary-color)',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  selectors: {
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 0 0 3px color-mix(in srgb, ${cssVarV2('button/primary')} 12%, transparent)`,
    },
    '&::placeholder': {
      color: cssVarV2('text/secondary'),
      opacity: 0.7,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  minHeight: 46,
  '@media': {
    '(max-width: 768px)': {
      fontSize: 16,
      lineHeight: 1.4,
      padding: '10px 14px',
      minHeight: 44,
    },
  },
});

export const composerControls = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  '@media': {
    '(max-width: 980px)': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: 'minmax(96px, auto) minmax(190px, 1fr) minmax(110px, auto)',
      gap: 8,
      alignItems: 'stretch',
    },
    '(max-width: 560px)': {
      gridTemplateColumns: '1fr 1fr',
      gap: 6,
    },
  },
});

export const attachButton = style({
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 650,
  whiteSpace: 'nowrap',
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
  '@media': {
    '(max-width: 560px)': {
      minHeight: 36,
    },
  },
});

export const sendButton = style({
  minWidth: 110,
  height: 38,
  borderRadius: 10,
  fontWeight: 750,
  fontSize: 13,
  transition: 'transform 0.1s ease, opacity 0.15s ease, filter 0.15s ease',
  selectors: {
    '&:active:not(:disabled)': {
      transform: 'scale(0.97)',
    },
    '&:disabled': {
      opacity: 1,
      filter: 'saturate(0.82) brightness(0.9)',
      color: 'color-mix(in srgb, var(--affine-layer-pureWhite, #ffffff) 78%, var(--affine-text-secondary-color))',
    },
  },
  '@media': {
    '(max-width: 980px)': {
      width: '100%',
      minWidth: 0,
    },
    '(max-width: 560px)': {
      minWidth: 0,
      height: 36,
    },
    '(max-width: 420px)': {
      minWidth: 0,
      height: 36,
    },
  },
});
export const busyRow = style({
  fontSize: 12,
  color: 'color-mix(in srgb, var(--affine-text-primary-color) 86%, var(--affine-primary-color))',
  marginTop: 6,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const bubbleWrap = style({ display: 'flex', flexDirection: 'column', gap: 6 });
export const bubbleAlignUser = style({ alignItems: 'flex-end' });
export const bubbleAlignAssistant = style({ alignItems: 'flex-start' });
export const roleLabel = style({
  fontSize: 11,
  fontWeight: 650,
  color: 'color-mix(in srgb, var(--affine-text-primary-color) 72%, var(--affine-text-secondary-color))',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const bubble = style({
  maxWidth: '82%',
  padding: '14px 18px',
  borderRadius: '16px',
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: cssVarV2('layer/background/secondary'),
  color: cssVarV2('text/primary'),
  border: `1px solid ${glassStroke}`,
  position: 'relative',
  '@media': {
    '(max-width: 768px)': {
      maxWidth: '92%',
      padding: '12px 16px',
      lineHeight: 1.6,
    },
    '(max-width: 420px)': {
      maxWidth: '96%',
      padding: '10px 14px',
      fontSize: 13,
    },
  },
});
export const bubbleUser = style({
  borderRadius: '16px 16px 4px 16px',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--affine-primary-color) 88%, var(--affine-theme-secondary, #06b6d4) 12%) 0%, color-mix(in srgb, var(--affine-primary-color) 72%, #0b1220) 100%)',
  color: cssVarV2('layer/pureWhite'),
  borderColor: 'color-mix(in srgb, var(--affine-primary-color) 68%, var(--affine-theme-secondary, #06b6d4) 32%)',
});
export const bubbleAssistant = style({ borderRadius: '16px 16px 16px 4px' });
export const bubbleError = style({ color: cssVarV2('status/error'), borderColor: cssVarV2('status/error') });
export const bubblePending = style({ opacity: 0.6 });

export const bubbleActionRow = style({ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${glassStroke}` });
export const bubbleActionButton = style({ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  cursor: 'pointer', color: cssVarV2('button/primary'), fontWeight: 600, minHeight: 28,
  transition: 'background 0.12s ease',
  selectors: { '&:hover': { background: 'var(--affine-hover-color)' }, '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}`, outlineOffset: 2 } } });
export const bubbleActionButtonDanger = style({ color: cssVarV2('status/error') });

export const insightSaveStatus = style({
  marginTop: 8,
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const conflictPanel = style({
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 10,
  border: `0.5px solid ${cssVarV2('status/error')}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 70%, rgba(239,68,68,0.1))',
});

export const conflictTitle = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('status/error'),
  marginBottom: 4,
});

export const conflictText = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.5,
});

export const conflictRecommendation = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('button/primary'),
  marginTop: 6,
  padding: '4px 8px',
  borderRadius: 6,
  background: 'color-mix(in srgb, var(--affine-primary-color) 8%, transparent)',
  display: 'inline-block',
});

export const conflictActions = style({
  marginTop: 8,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

export const conflictActionButton = style({
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 10px',
  minHeight: 28,
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 75%, transparent)',
  color: cssVarV2('text/primary'),
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

export const conflictActionButtonRecommended = style({
  border: `1.5px solid ${cssVarV2('button/primary')}`,
  background: 'color-mix(in srgb, var(--affine-primary-color) 12%, var(--affine-background-primary-color))',
  color: cssVarV2('button/primary'),
  fontWeight: 800,
  selectors: {
    '&:hover': {
      background: 'color-mix(in srgb, var(--affine-primary-color) 18%, var(--affine-background-primary-color))',
    },
  },
});

export const reviewQueuePanel = style({
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${glassStroke}`,
  background: cssVarV2('layer/background/secondary'),
});

export const reviewQueueHeader = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
});

export const reviewQueueList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const reviewQueueItem = style({
  padding: '8px 10px',
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent)',
});

export const reviewQueueMetaRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 4,
});

export const reviewQueueEntity = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const reviewQueueConfidence = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const reviewQueueContent = style({
  fontSize: 12,
  lineHeight: 1.55,
  color: cssVarV2('text/secondary'),
});

export const reviewQueueActions = style({
  marginTop: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const reviewQueueSaveButton = style({
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 10px',
  minHeight: 28,
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 70%, transparent)',
  color: cssVarV2('button/primary'),
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      opacity: 0.55,
      cursor: 'not-allowed',
    },
  },
});

export const reviewQueueUndoButton = style({
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 10px',
  minHeight: 28,
  borderRadius: 6,
  border: `0.5px solid ${cssVarV2('status/error')}`,
  background: 'transparent',
  color: cssVarV2('status/error'),
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: 'color-mix(in srgb, var(--affine-background-primary-color) 60%, rgba(239,68,68,0.12))',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('status/error')}`,
      outlineOffset: 2,
    },
  },
});

export const reviewQueueError = style({
  fontSize: 11,
  color: cssVarV2('status/error'),
  fontWeight: 600,
});

export const reviewQueueConflictActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

export const reviewQueueConflictButton = style({
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 8px',
  minHeight: 24,
  borderRadius: 6,
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
      outlineOffset: 1,
    },
  },
});

export const reviewQueueConflictButtonRecommended = style({
  border: `1.5px solid ${cssVarV2('button/primary')}`,
  background: 'color-mix(in srgb, var(--affine-primary-color) 10%, transparent)',
  color: cssVarV2('button/primary'),
  fontWeight: 800,
  selectors: {
    '&:hover': {
      background: 'color-mix(in srgb, var(--affine-primary-color) 16%, transparent)',
    },
  },
});

export const citationWrap = style({ paddingLeft: 4, marginTop: 4 });
export const citationToggle = style({ fontSize: 12, color: cssVarV2('button/primary'), fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.12s ease' });
export const citationPanel = style({ marginTop: 6, padding: '10px 14px', background: cssVarV2('layer/background/secondary'), borderRadius: 10, border: `1px solid ${glassStroke}`, display: 'flex', flexDirection: 'column', gap: 8 });
export const citationSectionTitle = style({ fontSize: 11, fontWeight: 700, marginBottom: 4, color: cssVarV2('text/secondary') });
export const citationRow = style({ fontSize: 12, padding: '4px 0', borderBottom: `0.5px solid ${glassStroke}` });
export const citationMeta = style({ fontSize: 11, color: cssVarV2('text/secondary'), marginTop: 2 });
export const citationSourceMetaRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginTop: 6,
});
export const citationCaseBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  border: `1px solid ${glassStroke}`,
  background: cssVarV2('layer/background/primary'),
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});
export const findingRow = style({ fontSize: 12, padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 });
export const severityDot = style({ vars: { [severityColorVar]: cssVarV2('text/secondary') }, display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: severityColorVar });

// ── Tool Call Cards v2 (Cascade-Style Workflow Steps) ────────────────────────

const toolSpinnerKeyframes = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const toolSlideInKeyframes = keyframes({
  '0%': { opacity: 0, transform: 'translateY(-4px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const toolProgressKeyframes = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
});

export const toolCallsWrap = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  marginBottom: 10,
});

export const toolCallGroupHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 0',
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/secondary'),
  letterSpacing: 0.15,
  cursor: 'pointer',
  userSelect: 'none',
  selectors: {
    '&:hover': { color: cssVarV2('text/primary') },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
      borderRadius: 6,
    },
  },
});

export const toolCallGroupChevron = style({
  width: 14,
  height: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 0.2s ease',
  fontSize: 10,
  flexShrink: 0,
});

export const toolCallGroupChevronOpen = style({
  transform: 'rotate(90deg)',
});

export const toolCallGroupBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingLeft: 4,
  overflow: 'hidden',
});

export const toolCallCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.4,
  transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
  minHeight: 34,
  animationName: toolSlideInKeyframes,
  animationDuration: '0.25s',
  animationTimingFunction: 'ease-out',
  animationFillMode: 'both',
  cursor: 'default',
  position: 'relative',
  overflow: 'hidden',
  selectors: {
    '&:hover': {
      background: 'color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)',
      borderColor: glassStroke,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
  '@media': {
    '(max-width: 560px)': {
      flexWrap: 'wrap',
      rowGap: 4,
    },
  },
});

export const toolCallRunning = style({
  borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 55%, transparent)`,
  background: `color-mix(in srgb, var(--affine-primary-color) 6%, var(--affine-background-primary-color) 82%)`,
});

export const toolCallComplete = style({
  borderColor: `color-mix(in srgb, ${cssVarV2('status/success')} 40%, transparent)`,
});

export const toolCallError = style({
  borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 55%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 5%, var(--affine-background-primary-color) 82%)`,
});

export const toolCallAwaitingApproval = style({
  borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 60%, transparent)`,
  background: `color-mix(in srgb, var(--affine-primary-color) 10%, var(--affine-background-primary-color) 82%)`,
});

export const toolCallStatusIcon = style({
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 12,
  lineHeight: 1,
});

export const toolCallSpinner = style({
  width: 14,
  height: 14,
  border: `2px solid color-mix(in srgb, ${cssVarV2('button/primary')} 25%, transparent)`,
  borderTopColor: cssVarV2('button/primary'),
  borderRadius: '50%',
  animationName: toolSpinnerKeyframes,
  animationDuration: '0.7s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'linear',
});

export const toolCallIcon = style({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  padding: '3px 8px',
  borderRadius: 999,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const toolCallProgressBar = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 2,
  background: `linear-gradient(90deg, transparent, ${cssVarV2('button/primary')}, transparent)`,
  backgroundSize: '200% 100%',
  animationName: toolProgressKeyframes,
  animationDuration: '1.5s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
  borderRadius: '0 0 8px 8px',
});

export const toolCallProgressDeterminate = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  height: 2,
  background: cssVarV2('button/primary'),
  borderRadius: '0 0 8px 8px',
  transition: 'width 0.3s ease',
});

export const toolApprovalPanel = style({
  marginTop: 4,
  marginLeft: 26,
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 38%, ${glassStroke})`,
  background: 'color-mix(in srgb, var(--affine-primary-color) 5%, var(--affine-background-primary-color) 90%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const toolApprovalTitle = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const toolApprovalDescription = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.45,
});

export const toolApprovalField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const toolApprovalFieldLabel = style({
  fontSize: 11,
  fontWeight: 650,
  color: cssVarV2('text/secondary'),
});

export const toolApprovalInput = style({
  width: '100%',
  borderRadius: 8,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  padding: '7px 9px',
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
    '&:disabled': {
      opacity: 0.7,
      cursor: 'not-allowed',
    },
  },
});

export const toolApprovalActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const toolApprovalConfirm = style({
  borderRadius: 8,
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 45%, transparent)`,
  background: `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('button/primary')} 72%, var(--affine-background-primary-color) 28%) 0%, color-mix(in srgb, ${cssVarV2('button/primary')} 58%, var(--affine-background-primary-color) 42%) 100%)`,
  color: cssVarV2('button/pureWhiteText'),
  fontSize: 12,
  fontWeight: 700,
  minHeight: 30,
  padding: '5px 12px',
  cursor: 'pointer',
  selectors: {
    '&:disabled': {
      opacity: 0.55,
      cursor: 'not-allowed',
    },
  },
});

export const toolApprovalReject = style({
  borderRadius: 8,
  border: `1px solid color-mix(in srgb, ${cssVarV2('status/error')} 55%, transparent)`,
  background: 'var(--affine-background-primary-color)',
  color: cssVarV2('status/error'),
  fontSize: 12,
  fontWeight: 700,
  minHeight: 30,
  padding: '5px 12px',
  cursor: 'pointer',
  selectors: {
    '&:disabled': {
      opacity: 0.55,
      cursor: 'not-allowed',
    },
  },
});

// ── Tool Call Detail Lines (like Cascade's file change list) ────────────────

export const toolCallDetailsWrap = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  padding: '4px 0 2px 26px',
  animationName: toolSlideInKeyframes,
  animationDuration: '0.2s',
  animationTimingFunction: 'ease-out',
  animationFillMode: 'both',
});

export const toolCallDetailLine = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.35,
  transition: 'background 0.12s ease',
  selectors: {
    '&:hover': {
      background: 'color-mix(in srgb, var(--affine-background-primary-color) 70%, transparent)',
    },
  },
});

export const detailLineIcon = style({
  width: 16,
  height: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 11,
  opacity: 0.7,
});

export const detailLineLabel = style({
  fontWeight: 600,
  fontSize: 12,
  color: cssVarV2('text/primary'),
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const detailLineMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  opacity: 0.75,
  whiteSpace: 'nowrap',
});

export const detailLineDiffAdded = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('status/success'),
  whiteSpace: 'nowrap',
  marginLeft: 'auto',
});

export const detailLineDiffRemoved = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('status/error'),
  whiteSpace: 'nowrap',
});

// ── Chat Artifact Cards (generated documents, downloadable) ─────────────────

export const artifactsWrap = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginTop: 8,
});

export const artifactCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 30%, ${glassStroke})`,
  background: 'color-mix(in srgb, var(--affine-primary-color) 5%, var(--affine-background-primary-color) 88%)',
  transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease',
  animationName: toolSlideInKeyframes,
  animationDuration: '0.3s',
  animationTimingFunction: 'ease-out',
  animationFillMode: 'both',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2('button/primary'),
    },
  },
});

export const artifactIcon = style({
  width: 36,
  height: 36,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 18,
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 14%, transparent)`,
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 25%, transparent)`,
  color: cssVarV2('button/primary'),
});

export const artifactContent = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const artifactTitle = style({
  fontSize: 13,
  fontWeight: 650,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const artifactMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const artifactKindBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.15,
  textTransform: 'uppercase',
  color: cssVarV2('button/primary'),
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 12%, transparent)`,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('button/primary')} 30%, transparent)`,
});

export const artifactSavedBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('status/success'),
  background: `color-mix(in srgb, ${cssVarV2('status/success')} 10%, transparent)`,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('status/success')} 30%, transparent)`,
});

export const artifactActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
});

export const artifactActionButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '5px 10px',
  borderRadius: 6,
  border: `1px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  fontWeight: 650,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
      borderColor: cssVarV2('button/primary'),
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const artifactActionButtonPrimary = style({
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 14%, var(--affine-background-primary-color))`,
  borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 40%, transparent)`,
  color: cssVarV2('button/primary'),
  selectors: {
    '&:hover': {
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 22%, var(--affine-background-primary-color))`,
      borderColor: cssVarV2('button/primary'),
    },
  },
});

export const modelPickerTierBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 18,
  borderRadius: 999,
  padding: '0 7px',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.15,
  textTransform: 'uppercase',
  color: cssVarV2('button/primary'),
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 65%, transparent)`,
  background: 'color-mix(in srgb, var(--affine-primary-color) 16%, transparent)',
  flexShrink: 0,
});

export const modelPickerCostBadge = modelPickerTierBadge;

export const toolCallLabel = style({
  fontWeight: 600,
  fontSize: 12,
  color: cssVarV2('text/primary'),
  whiteSpace: 'nowrap',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const toolCallOutput = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 11,
  opacity: 0.75,
  fontWeight: 500,
});

export const toolCallDuration = style({
  fontSize: 10,
  fontWeight: 600,
  opacity: 0.55,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
});

export const toolCallChevron = style({
  width: 16,
  height: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 9,
  opacity: 0.5,
  transition: 'transform 0.2s ease, opacity 0.15s ease',
  cursor: 'pointer',
  selectors: {
    '&:hover': { opacity: 1 },
  },
});

export const toolCallChevronOpen = style({
  transform: 'rotate(90deg)',
});

// ── Model Picker ────────────────────────────────────────────────────────────

export const modelPickerWrap = style({
  position: 'relative',
  flexShrink: 0,
  minWidth: 210,
  '@media': {
    '(max-width: 980px)': {
      minWidth: 0,
      width: '100%',
    },
    '(max-width: 560px)': {
      gridColumn: '1 / -1',
    },
  },
});

export const modelPickerButton = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  gap: 1,
  minWidth: 210,
  padding: '7px 11px',
  borderRadius: 10,
  border: `1px solid ${glassStroke}`,
  background: 'var(--affine-background-primary-color)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 650,
  color: cssVarV2('text/secondary'),
  minHeight: 38,
  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  '@media': {
    '(max-width: 980px)': {
      width: '100%',
    },
  },
});

export const modelPickerDropdown = style({
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  right: 0,
  marginTop: 0,
  minWidth: 280,
  maxHeight: 360,
  overflowY: 'auto',
  padding: 8,
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: 'var(--affine-background-overlay-panel-color)',
  boxShadow: 'var(--affine-popover-shadow)',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  '@media': {
    '(max-width: 980px)': {
      left: 0,
      right: 0,
      minWidth: 0,
    },
  },
});

export const modelPickerGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

export const modelPickerGroupLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.35,
  textTransform: 'uppercase',
  color: cssVarV2('text/secondary'),
  padding: '2px 4px',
});

export const modelPickerGroupCount = style({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  minHeight: 18,
  borderRadius: 999,
  padding: '0 6px',
  border: `1px solid color-mix(in srgb, ${glassStroke} 70%, transparent)`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 78%, rgba(255,255,255,0.06))',
  color: cssVarV2('text/primary'),
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'none',
  letterSpacing: 0,
});

export const modelPickerGroupItems = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const modelPickerItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '9px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  border: `1px solid color-mix(in srgb, ${glassStroke} 55%, transparent)`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 80%, rgba(15,23,42,0.08))',
  textAlign: 'left',
  transition: 'background 0.12s ease, border-color 0.12s ease, transform 0.12s ease',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor: 'color-mix(in srgb, var(--affine-primary-color) 40%, transparent)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
});

export const modelPickerItemActive = style({
  borderColor: cssVarV2('button/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 72%, rgba(59,130,246,0.1))',
});

export const modelPickerItemLabel = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  fontSize: 13,
  fontWeight: 650,
  color: cssVarV2('text/primary'),
});

export const modelPickerItemDesc = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.4,
});

export const modelPickerItemMeta = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  opacity: 0.9,
  marginTop: 2,
});

export const modelPickerGroupBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 16,
  borderRadius: 999,
  padding: '0 7px',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.15,
  textTransform: 'uppercase',
  border: `1px solid color-mix(in srgb, ${glassStroke} 65%, transparent)`,
  background: `color-mix(in srgb, ${glassStroke} 22%, transparent)`,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const modelPickerPriorityBadge = modelPickerGroupBadge;

// ── Streaming / Thinking Indicator (Cascade-style with step label) ──────────

const pulseDotKeyframes = keyframes({
  '0%, 100%': { opacity: 0.3, transform: 'scale(1)' },
  '50%': { opacity: 1, transform: 'scale(1.3)' },
});

export const thinkingWrap = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 8,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('button/primary')} 30%, transparent)`,
  background: `color-mix(in srgb, var(--affine-primary-color) 4%, var(--affine-background-primary-color) 86%)`,
  marginBottom: 6,
  animationName: toolSlideInKeyframes,
  animationDuration: '0.2s',
  animationTimingFunction: 'ease-out',
  animationFillMode: 'both',
});

export const thinkingSpinner = style({
  width: 14,
  height: 14,
  border: `2px solid color-mix(in srgb, ${cssVarV2('button/primary')} 25%, transparent)`,
  borderTopColor: cssVarV2('button/primary'),
  borderRadius: '50%',
  flexShrink: 0,
  animationName: toolSpinnerKeyframes,
  animationDuration: '0.7s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'linear',
});

export const thinkingLabel = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('button/primary'),
});

export const thinkingTimer = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  opacity: 0.65,
  marginLeft: 'auto',
  fontVariantNumeric: 'tabular-nums',
});

export const streamingDots = style({
  display: 'inline-flex',
  gap: 3,
  alignItems: 'center',
  height: 16,
});

export const streamingDot = style({
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: cssVarV2('button/primary'),
  opacity: 0.4,
  animationName: pulseDotKeyframes,
  animationDuration: '1.2s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
  selectors: {
    '&:nth-child(2)': { animationDelay: '0.2s' },
    '&:nth-child(3)': { animationDelay: '0.4s' },
  },
});

// ── Model badge in message ──────────────────────────────────────────────────

export const modelBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 10,
  fontWeight: 600,
  padding: '2px 7px',
  borderRadius: 5,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 78%, transparent)',
  color: cssVarV2('text/secondary'),
  marginLeft: 6,
});

export const markdownRoot = style({});

globalStyle(`${markdownRoot} h3`, { fontSize: 16, fontWeight: 700, margin: '14px 0 6px', lineHeight: 1.3 });
globalStyle(`${markdownRoot} h4`, { fontSize: 14, fontWeight: 700, margin: '10px 0 4px', lineHeight: 1.3 });
globalStyle(`${markdownRoot} code`, { background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)', padding: '2px 6px', borderRadius: 4, fontSize: 13, border: `0.5px solid ${glassStroke}` });
globalStyle(`${markdownRoot} pre`, { background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)', padding: '12px 16px', borderRadius: 10, border: `0.5px solid ${glassStroke}`, overflowX: 'auto', margin: '10px 0' });
globalStyle(`${markdownRoot} pre code`, { background: 'none', padding: 0, border: 'none', fontSize: 12, lineHeight: 1.6 });
globalStyle(`${markdownRoot} blockquote`, { borderLeft: `3px solid ${cssVarV2('button/primary')}`, paddingLeft: 14, margin: '8px 0', color: cssVarV2('text/secondary'), fontStyle: 'italic' });
globalStyle(`${markdownRoot} li`, { marginLeft: 20, marginBottom: 2 });
globalStyle(`${markdownRoot} hr`, { border: 'none', borderTop: `0.5px solid ${glassStroke}`, margin: '12px 0' });
globalStyle(`${markdownRoot} table`, { width: '100%', borderCollapse: 'collapse', fontSize: 12, margin: '10px 0' });
globalStyle(`${markdownRoot} th`, { padding: '6px 10px', borderBottom: `1px solid ${glassStroke}`, fontWeight: 700, textAlign: 'left', fontSize: 11 });
globalStyle(`${markdownRoot} td`, { padding: '5px 10px', borderBottom: `0.5px solid ${glassStroke}` });
globalStyle(`${markdownRoot} details`, { margin: '6px 0', padding: '4px 0' });
globalStyle(`${markdownRoot} summary`, { cursor: 'pointer', fontWeight: 600, fontSize: 13 });
