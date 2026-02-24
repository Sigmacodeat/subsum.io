import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

import {
  filterChipStyle,
  glassStroke,
  interactionTransition,
  surfaceEnter,
} from '../../layouts/workspace-list-shared-styles';

const themeAccent = 'var(--affine-theme-accent, #1E40AF)';
const themeAccentSoft =
  'var(--affine-theme-accent-soft, rgba(30, 64, 175, 0.18))';
const themeBackgroundTint =
  'var(--affine-theme-bg-tint, transparent)';

export const root = style({
  containerType: 'inline-size',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  minHeight: 0,
  overflow: 'auto',
  gap: 18,
  padding: '12px 16px 16px',
  height: '100%',
  color: cssVarV2('text/primary'),
  background: 'var(--affine-background-primary-color)',
  '@container': {
    '(min-width: 1100px)': {
      gridTemplateColumns: '260px minmax(0, 1fr) 320px',
      alignItems: 'start',
    },
  },
  '@media': {
    '(max-width: 768px)': {
      gap: 12,
      padding: '10px 10px 14px',
    },
  },
});

export const copilotWorkspaceTabButton = style({
  ...filterChipStyle,
  minHeight: 34,
  whiteSpace: 'nowrap',
  borderRadius: 9,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 66%, transparent)',
  selectors: {
    ...filterChipStyle.selectors,
    '&[aria-selected="true"]': {
      background:
        `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('button/primary')} 84%, var(--affine-theme-link, #22d3ee) 16%) 0%, color-mix(in srgb, var(--affine-theme-link, #22d3ee) 40%, ${cssVarV2('button/primary')} 60%) 100%)`,
      color: cssVarV2('button/pureWhiteText'),
      borderColor: 'color-mix(in srgb, var(--affine-theme-link, #22d3ee) 45%, transparent)',
      boxShadow: '0 10px 22px rgba(30, 64, 175, 0.28)',
    },
  },
});

export const onboardingButtonRow = style({
  display: 'grid',
  gap: 8,
  width: '100%',
  maxWidth: 560,
  marginInline: 'auto',
});

export const onboardingButtonSecondary = style({
  width: '100%',
  fontWeight: 600,
  padding: '10px 16px',
  fontSize: 13,
  cursor: 'pointer',
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/secondary'),
  color: cssVarV2('text/primary'),
  ':hover': {
    background: 'var(--affine-hover-color-filled)',
  },
  ':focus-visible': {
    outline: `1px solid ${cssVarV2('button/primary')}`,
    outlineOffset: 2,
  },
});

export const rightRailCopilot = style({
  '@container': {
    '(min-width: 900px)': {
      gridColumn: '2 / 3',
    },
    '(min-width: 1100px)': {
      gridColumn: '2 / 3',
      position: 'sticky',
      top: 12,
      alignSelf: 'start',
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'auto',
    },
  },
});

export const centeredSection = style({
  textAlign: 'center',
});

export const rootCopilotOnly = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'start',
  '@container': {
    '(min-width: 900px)': {
      gridTemplateColumns: 'minmax(0, 1fr) 300px',
      gap: 12,
    },
    '(min-width: 1100px)': {
      gridTemplateColumns: 'minmax(0, 1fr) 340px',
      gap: 14,
    },
  },
  '@media': {
    '(max-width: 768px)': {
      gap: 10,
    },
  },
});

export const copilotMain = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  '@container': {
    '(min-width: 900px)': {
      gridColumn: '1 / 2',
    },
    '(min-width: 1100px)': {
      gridColumn: '1 / 2',
    },
  },
  '@media': {
    '(max-width: 768px)': {
      gap: 10,
    },
  },
});

export const copilotWorkspaceTabs = style({
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 6,
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollSnapType: 'x proximity',
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
  scrollPaddingInline: 6,
  padding: '4px 2px 8px',
  borderRadius: 12,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/secondary'),
  scrollbarWidth: 'none',
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  '@media': {
    '(max-width: 768px)': {
      gap: 4,
      padding: '2px 4px 6px',
      scrollPaddingInline: 4,
    },
  },
});

globalStyle(`${copilotWorkspaceTabs} > *`, {
  flex: '0 0 auto',
  minHeight: 34,
  scrollSnapAlign: 'start',
  whiteSpace: 'nowrap',
});

globalStyle(`${copilotWorkspaceTabs} > *[aria-selected="true"]`, {
  boxShadow: '0 10px 22px rgba(30, 64, 175, 0.28)',
});

globalStyle(`${copilotWorkspaceTabs} > *`, {
  '@media': {
    '(max-width: 768px)': {
      minHeight: 38,
      fontSize: '12px',
      paddingLeft: '10px',
      paddingRight: '10px',
    },
    '(max-width: 420px)': {
      minHeight: 38,
      fontSize: '11px',
      paddingLeft: '8px',
      paddingRight: '8px',
    },
  },
});

export const destructiveDialogOverlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.35)',
  padding: 16,
});

export const destructiveDialogCard = style({
  width: 'min(520px, 100%)',
  borderRadius: 12,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-overlay-panel-color)',
  boxShadow: 'var(--affine-popover-shadow)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const destructiveDialogTitle = style({
  fontSize: 15,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const destructiveDialogBody = style({
  fontSize: 13,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.5,
});

export const destructiveDialogActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
});

export const mobileActionDock = style({
  display: 'none',
  '@media': {
    '(max-width: 768px)': {
      position: 'sticky',
      bottom: 8,
      zIndex: 5,
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: 6,
      borderRadius: 10,
      border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
      background: cssVarV2('layer/background/primary'),
      padding: 8,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    },
  },
});

globalStyle(`${mobileActionDock} > *`, {
  '@media': {
    '(max-width: 768px)': {
      minHeight: 38,
    },
  },
});

export const leftRail = style({
  '@container': {
    '(min-width: 1100px)': {
      gridColumn: '1 / 2',
      gridRow: '1 / 4',
    },
  },
});

export const centerRail = style({
  '@container': {
    '(min-width: 1100px)': {
      gridColumn: '2 / 3',
      gridRow: '1 / 4',
    },
  },
});

export const rightRail = style({
  '@container': {
    '(min-width: 1100px)': {
      gridColumn: '3 / 4',
      position: 'sticky',
      top: 12,
      alignSelf: 'start',
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'auto',
    },
  },
});

export const railStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minWidth: 0,
});

export const section = style({
  border: `1px solid ${glassStroke}`,
  borderRadius: 12,
  background: cssVarV2('layer/background/secondary'),
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
  animation: `${surfaceEnter} 300ms cubic-bezier(0.22, 1, 0.36, 1) both`,
  transition: interactionTransition,
  '@media': {
    '(max-width: 768px)': {
      borderRadius: 10,
      padding: 12,
      gap: 8,
    },
  },
});

export const sectionTitle = style({
  fontSize: 14,
  fontWeight: 650,
  color: cssVarV2('text/primary'),
  lineHeight: 1.3,
  letterSpacing: '0.006em',
  fontFamily: 'var(--affine-font-family)',
});

export const metrics = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
});

export const metricCard = style({
  borderRadius: 10,
  border: `1px solid ${glassStroke}`,
  padding: '9px 11px',
  background: cssVarV2('layer/background/primary'),
  transition: interactionTransition,
});

export const metricLabel = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
});

export const metricValue = style({
  fontSize: 17,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.005em',
});

export const summary = style({
  fontSize: 12,
  lineHeight: 1.6,
  color: cssVarV2('text/secondary'),
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});

export const status = style({
  fontSize: 11,
  lineHeight: 1.4,
  color: cssVarV2('text/secondary'),
  margin: 0,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});

export const statusInfo = style({
  color: cssVarV2('text/secondary'),
});

export const statusError = style({
  color: cssVarV2('status/error'),
  fontWeight: 600,
});

export const srOnly = style({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  border: 0,
  whiteSpace: 'nowrap',
});

export const skipLink = style({
  position: 'absolute',
  top: -40,
  left: 0,
  zIndex: 100,
  background: cssVarV2('layer/background/primary'),
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 14,
  color: cssVarV2('text/primary'),
  textDecoration: 'none',
  selectors: {
    '&:focus-visible': {
      top: 0,
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const breadcrumbNav = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexWrap: 'wrap',
  padding: '4px 2px 8px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  marginBottom: 2,
});

export const breadcrumbLink = style({
  appearance: 'none',
  background:
    'linear-gradient(180deg, rgba(255, 255, 255, 0.024), rgba(255, 255, 255, 0.008))',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  cursor: 'pointer',
  color: 'inherit',
  padding: '2px 8px',
  fontSize: 'inherit',
  borderRadius: 999,
  textDecoration: 'none',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)',
      borderColor:
        'color-mix(in srgb, var(--affine-theme-accent-soft, rgba(37, 99, 235, 0.2)) 70%, rgba(255, 255, 255, 0.2))',
    },
  },
});

export const breadcrumbDivider = style({
  opacity: 0.4,
});

export const breadcrumbCurrent = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const alertList = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const alertItem = style({
  borderRadius: 8,
  border: `1px solid ${glassStroke}`,
  padding: 10,
  background: cssVarV2('layer/background/primary'),
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color-filled)',
    },
  },
});

export const alertTitle = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflowWrap: 'anywhere',
  letterSpacing: '0.006em',
});

export const alertMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
});

export const empty = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  border: `1px dashed var(--affine-border-color)`,
  borderRadius: 8,
  padding: 12,
  background: cssVarV2('layer/background/secondary'),
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
});

export const controlRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
});

export const modeSwitcher = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  minWidth: 0,
});

export const chipRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const chip = style({
  borderRadius: 999,
  padding: '4px 10px',
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-primary-color)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: cssVarV2('text/secondary'),
});

export const connectorLine = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  flexWrap: 'wrap',
});

export const connectorForm = style({
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/secondary'),
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const formGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 8,
  '@media': {
    '(min-width: 720px) and (max-width: 1099px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
});

export const formLabel = style({
  fontSize: 11,
  fontWeight: 500,
  color: cssVarV2('text/secondary'),
  letterSpacing: '0.004em',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const input = style({
  border: '1px solid var(--affine-border-color)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  lineHeight: 1.4,
  color: cssVarV2('text/primary'),
  background: 'var(--affine-background-primary-color)',
  transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
  ':hover': {
    borderColor: cssVarV2('text/tertiary'),
  },
  ':focus-visible': {
    outline: `2px solid ${cssVarV2('button/primary')}`,
    outlineOffset: 1,
  },
});

export const formActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
  flexWrap: 'wrap',
});

export const jobList = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const jobItem = style({
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/primary'),
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const jobTitle = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  letterSpacing: '0.006em',
});

export const jobMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  overflowWrap: 'anywhere',
});

export const jobMetaStrong = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const jobProgressTrack = style({
  width: '100%',
  height: 8,
  borderRadius: 999,
  background: cssVarV2('layer/background/primary'),
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  overflow: 'hidden',
});

export const jobProgressFill = style({
  width: '0%',
  height: '100%',
  borderRadius: 999,
  background: cssVarV2('button/primary'),
  transition: 'width 0.2s ease',
});

export const warningText = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
  fontWeight: 600,
});

export const buttonRow = style({
  display: 'flex',
  justifyContent: 'flex-end',
  '@media': {
    '(max-width: 768px)': {
      justifyContent: 'flex-start',
      width: '100%',
    },
  },
});

export const quickActionRow = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  minWidth: 0,
});

export const tabRow = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'nowrap',
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 8,
  paddingTop: 4,
  minWidth: 0,
  scrollbarWidth: 'none',
  WebkitOverflowScrolling: 'touch',
  border: '1px solid var(--affine-border-color)',
  marginBottom: 4,
  background: cssVarV2('layer/background/secondary'),
  borderRadius: 10,
  paddingLeft: 6,
  paddingRight: 6,
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
});

globalStyle(`${tabRow} > *`, {
  flex: '0 0 auto',
  minHeight: 34,
  fontSize: '13px',
  fontWeight: 600,
  borderRadius: '9px',
  transition: 'transform 0.14s ease, box-shadow 0.14s ease',
});

globalStyle(`${tabRow} > *:hover`, {
  opacity: 0.85,
});

globalStyle(`${quickActionRow} > *`, {
  minWidth: 0,
});

globalStyle(`${quickActionRow} > *`, {
  '@media': {
    '(max-width: 768px)': {
      flex: '1 1 100%',
      minHeight: 40,
    },
  },
});

export const citationList = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const citationItem = style({
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/primary'),
  padding: '6px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const taskBoard = style({
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  paddingTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const blueprintEditor = style({
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  paddingTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const previewCard = style({
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/secondary'),
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const previewHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
});

export const previewMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  overflowWrap: 'anywhere',
});

export const reviewBadge = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
  borderRadius: 999,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/secondary'),
  padding: '2px 8px',
});

export const previewContent = style({
  margin: 0,
  maxHeight: 220,
  overflow: 'auto',
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  padding: '8px 10px',
  fontSize: 11,
  lineHeight: 1.5,
  color: cssVarV2('text/primary'),
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

export const legalPreviewContent = style({
  margin: 0,
  maxHeight: 280,
  overflow: 'auto',
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.65,
  color: cssVarV2('text/primary'),
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily:
    '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", "Times New Roman", serif',
  '@media': {
    '(max-width: 768px)': {
      maxHeight: 220,
      padding: '10px 11px',
      fontSize: 13,
      lineHeight: 1.58,
    },
  },
});

export const workflowSteps = style({
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const workflowStep = style({
  fontSize: 12,
  lineHeight: 1.5,
  color: cssVarV2('text/secondary'),
  overflowWrap: 'anywhere',
  '@media': {
    '(max-width: 768px)': {
      fontSize: 11,
      lineHeight: 1.45,
    },
  },
});

export const documentList = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const documentItem = style({
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: cssVarV2('layer/background/primary'),
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const documentItemHighlighted = style({
  borderRadius: 8,
  border: `1px solid ${themeAccent}`,
  background:
    `linear-gradient(180deg, ${themeAccentSoft}, ${themeBackgroundTint}), ${cssVarV2('layer/background/hoverOverlay')}`,
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  boxShadow: `0 0 0 2px ${themeAccentSoft}, 0 4px 10px rgba(0, 0, 0, 0.09)`,
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
});

export const documentTitle = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflowWrap: 'anywhere',
  letterSpacing: '0.006em',
});

export const documentMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  '@media': {
    '(max-width: 768px)': {
      gap: 6,
      flexDirection: 'column',
    },
  },
});

export const sectionReviewList = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const sectionReviewItem = style({
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background:
    `linear-gradient(180deg, rgba(255, 255, 255, 0.016), rgba(255, 255, 255, 0.005)), ${cssVarV2('layer/background/primary')}`,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 2px 8px rgba(0, 0, 0, 0.07)',
});

export const sectionReviewHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const warningBanner = style({
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background:
    `linear-gradient(180deg, color-mix(in srgb, var(--affine-primary-color) 13%, transparent), color-mix(in srgb, var(--affine-primary-color) 5%, transparent)), ${cssVarV2('layer/background/secondary')}`,
  color: cssVarV2('text/primary'),
  padding: '5px 9px',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.4,
  listStyle: 'none',
});

export const citationMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.4,
});

export const citationQuote = style({
  fontSize: 12,
  color: cssVarV2('text/primary'),
  fontStyle: 'italic',
  borderLeft: `3px solid ${themeAccent}`,
  paddingLeft: 8,
  lineHeight: 1.5,
  wordBreak: 'break-word',
});

export const governanceCard = style({
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background:
    `linear-gradient(180deg, rgba(255, 255, 255, 0.022), rgba(255, 255, 255, 0.007)), ${cssVarV2('layer/background/secondary')}`,
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 2px 8px rgba(0, 0, 0, 0.07)',
});

export const governanceList = style({
  margin: 0,
  paddingLeft: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const governanceItem = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  lineHeight: 1.4,
});

export const toolAccordion = style({
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background:
    `linear-gradient(180deg, rgba(255, 255, 255, 0.022), rgba(255, 255, 255, 0.007)), ${cssVarV2('layer/background/secondary')}`,
  padding: 0,
  marginBottom: 8,
  overflow: 'hidden',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 2px 8px rgba(0, 0, 0, 0.08)',
  selectors: {
    '&[open]': {
      paddingBottom: 10,
    },
  },
});

// ── UX-Polish: Global focus-visible ring for all interactive elements ──
globalStyle(`${root} button:focus-visible, ${root} a:focus-visible, ${root} select:focus-visible, ${root} textarea:focus-visible, ${root} [role="tab"]:focus-visible, ${root} [role="button"]:focus-visible`, {
  outline: `1px solid ${cssVarV2('button/primary')}`,
  outlineOffset: 1,
  borderRadius: 8,
});

globalStyle(`html[data-theme="dark"] ${root} button:focus-visible, html[data-theme="dark"] ${root} a:focus-visible, html[data-theme="dark"] ${root} select:focus-visible, html[data-theme="dark"] ${root} textarea:focus-visible, html[data-theme="dark"] ${root} [role="tab"]:focus-visible, html[data-theme="dark"] ${root} [role="button"]:focus-visible`, {
  outlineColor: 'color-mix(in srgb, var(--affine-primary-color) 68%, var(--affine-border-color))',
  boxShadow: '0 0 0 1px color-mix(in srgb, var(--affine-primary-color) 26%, transparent)',
});

globalStyle(`${root} button, ${root} [role="button"], ${root} [role="tab"]`, {
  borderRadius: '10px',
  minHeight: '36px',
  paddingLeft: '10px',
  paddingRight: '10px',
  fontWeight: 600,
  letterSpacing: '0.004em',
  transition:
    'box-shadow 0.14s ease, background 0.16s ease, border-color 0.16s ease, transform 0.14s ease',
});

globalStyle(`${root} button:hover, ${root} [role="button"]:hover, ${root} [role="tab"]:hover`, {
  background: cssVarV2('layer/background/hoverOverlay'),
});

// ── UX-Polish: Reduced motion preference ──
globalStyle(`${root} *`, {
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none !important',
      animation: 'none !important',
    },
  },
});

export const onboardingButton = style({
  width: '100%',
  fontWeight: 700,
  padding: '10px 16px',
  fontSize: 13,
  cursor: 'pointer',
  borderRadius: 8,
  border: `1px solid ${cssVarV2('button/primary')}`,
  background: cssVarV2('button/primary'),
  color: 'white',
  ':hover': {
    opacity: 0.9,
  },
  ':focus-visible': {
    outline: `2px solid ${cssVarV2('button/primary')}`,
    outlineOffset: 2,
  },
});

export const toolAccordionSummary = style({
  fontSize: 13,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  padding: '10px 12px',
  minHeight: 42,
  userSelect: 'none',
  listStyle: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  selectors: {
    '&::-webkit-details-marker': {
      display: 'none',
    },
    '&::before': {
      content: '"▸"',
      fontSize: 11,
      transition: 'transform 0.15s ease',
    },
    'details[open] > &::before': {
      transform: 'rotate(90deg)',
    },
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
  '@media': {
    '(max-width: 768px)': {
      padding: '11px 12px',
      minHeight: 44,
      fontSize: 12,
    },
  },
});
