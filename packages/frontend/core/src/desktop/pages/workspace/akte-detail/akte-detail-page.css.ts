import { cssVarV2 } from '@toeverything/theme/v2';
import { keyframes, style } from '@vanilla-extract/css';

import {
  interactionTransition,
  statusBadgeBaseStyle,
  statusToneArchivedStyle,
  statusToneClosedStyle,
  statusToneOpenStyle,
} from '../layouts/workspace-list-shared-styles';

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS – SubSumio Cockpit v2
// ═══════════════════════════════════════════════════════════════════════════════
// Border: ultra-thin, low opacity – borders only where structurally needed
const borderSubtle = '1px solid var(--affine-border-color)';
const borderDivider = '1px solid var(--affine-border-color)';
// Accent
const accentBg =
  'color-mix(in srgb, var(--affine-primary-color) 11%, transparent)';
const accentBgHover =
  'color-mix(in srgb, var(--affine-primary-color) 15%, transparent)';
const accentBorder =
  'color-mix(in srgb, var(--affine-primary-color) 28%, transparent)';
// Surface layers (dark-mode tuned)
const surfaceBase = cssVarV2('layer/background/primary');
const surfaceRaised = cssVarV2('layer/background/secondary');
// Spacing scale
const sp = (n: number) => `${n * 4}px`; // 4px grid: sp(1)=4, sp(2)=8 …
const gutter = 20;
const gutterSm = 14;
const skeletonShimmer = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
});

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  width: '100%',
  containerName: 'akte-detail-body',
  containerType: 'size',
  background: 'var(--affine-background-primary-color)',
  overflow: 'hidden',
});

export const headerNavWrap = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: `0 ${gutter}px`,
});

/* ═══ Akte Header Card ═══ */
export const akteHeader = style({
  display: 'flex',
  flexDirection: 'column',
  gap: sp(2),
  padding: `${sp(4)} ${gutter}px ${sp(4)}`,
  borderBottom: borderDivider,
  background: 'var(--affine-background-primary-color)',
  '@container': {
    'akte-detail-body (width <= 500px)': {
      padding: `${sp(3)} ${gutterSm}px`,
    },
  },
});

export const docSelectCell = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const docSelectCheckbox = style({
  width: 14,
  height: 14,
  accentColor: 'var(--affine-primary-color)',
});

export const alertFilterBar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: sp(2),
  flexWrap: 'wrap',
});

export const alertFilterGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(1),
  flexWrap: 'wrap',
});

export const alertFilterChip = style({
  appearance: 'none',
  borderRadius: 999,
  border: borderSubtle,
  background: surfaceBase,
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 600,
  padding: `3px ${sp(2)}`,
  cursor: 'pointer',
  transition: 'all 0.14s ease',
  selectors: {
    '&:hover': {
      background: accentBg,
      color: cssVarV2('text/primary'),
      borderColor: accentBorder,
    },
    '&[data-active="true"]': {
      background: accentBg,
      color: cssVarV2('text/primary'),
      borderColor: accentBorder,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const akteHeaderTop = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: sp(3),
});

export const akteHeaderLeft = style({
  display: 'flex',
  flexDirection: 'column',
  gap: sp(1),
  flex: 1,
  minWidth: 0,
});

export const akteTitle = style({
  fontSize: 20,
  fontWeight: 700,
  lineHeight: '28px',
  letterSpacing: '-0.02em',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const akteTitleIcon = style({
  display: 'none',
});

export const akteSubtitle = style({
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  display: 'flex',
  alignItems: 'center',
  gap: sp(2),
  flexWrap: 'wrap',
});

export const akteMetaRow = style({
  display: 'flex',
  gap: sp(2),
  flexWrap: 'wrap',
  marginTop: sp(1),
});

export const akteMetaBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: sp(1),
  padding: `${sp(1)} ${sp(2)}`,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '16px',
  color: cssVarV2('text/primary'),
  background: surfaceRaised,
  letterSpacing: '-0.01em',
});

export const akteMetaBadgeLabel = style({
  fontSize: 10,
  fontWeight: 500,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  marginRight: 2,
});

export const akteMetaBadgeUrgent = style({
  background: 'rgba(255, 59, 48, 0.08)',
  color: cssVarV2('status/error'),
});

export const caseSummaryInline = style({
  marginTop: sp(2),
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 8,
  border: borderSubtle,
  background: surfaceRaised,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  maxWidth: 980,
});

export const statusBadge = style(statusBadgeBaseStyle);

export const statusOpen = style(statusToneOpenStyle);

export const statusClosed = style(statusToneClosedStyle);

export const statusArchived = style(statusToneArchivedStyle);

export const akteHeaderActions = style({
  display: 'flex',
  gap: sp(2),
  flexShrink: 0,
  alignItems: 'center',
});

export const headerButton = style({
  appearance: 'none',
  border: borderSubtle,
  borderRadius: 8,
  padding: `${sp(1)} ${sp(3)}`,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: '20px',
  cursor: 'pointer',
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  display: 'inline-flex',
  alignItems: 'center',
  gap: sp(1),
  transition: 'all 0.15s ease',
  selectors: {
    '&:hover': {
      background: surfaceRaised,
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const headerButtonPrimary = style({
  background: cssVarV2('button/primary'),
  color: cssVarV2('button/pureWhiteText'),
  borderColor: 'transparent',
  fontWeight: 600,
  selectors: {
    '&:hover': {
      opacity: 0.92,
      background: cssVarV2('button/primary'),
      borderColor: 'transparent',
    },
  },
});

/* ═══ Content Layout ═══ */
export const middleScrollArea = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  scrollbarWidth: 'thin' as any,
  scrollbarColor: `color-mix(in srgb, ${cssVarV2('text/secondary')} 20%, transparent) transparent`,
});

export const contentLayout = style({
  display: 'flex',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
});

export const alertCenter = style({
  margin: `${sp(2)} ${gutter}px ${sp(3)}`,
  padding: `${sp(3)} ${sp(4)}`,
  borderRadius: 12,
  border: borderSubtle,
  background: surfaceRaised,
  display: 'flex',
  flexDirection: 'column',
  gap: sp(3),
  '@container': {
    'akte-detail-body (width <= 500px)': {
      margin: `${sp(2)} ${gutterSm}px ${sp(3)}`,
      padding: `${sp(3)} ${sp(3)}`,
    },
  },
});

export const alertCenterHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: sp(3),
  flexWrap: 'wrap',
});

export const alertCenterTitle = style({
  margin: 0,
  fontSize: 16,
  lineHeight: '22px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: cssVarV2('text/primary'),
});

export const alertCenterSubtitle = style({
  margin: `${sp(1)} 0 0`,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  maxWidth: 760,
});

export const alertSummaryRow = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: sp(2),
  '@container': {
    'akte-detail-body (width <= 700px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const alertSummaryCard = style({
  borderRadius: 10,
  border: borderSubtle,
  background: surfaceBase,
  padding: `${sp(2)} ${sp(3)}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: sp(2),
});

export const alertSummaryLabel = style({
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: cssVarV2('text/secondary'),
});

export const alertSummaryValue = style({
  fontSize: 20,
  lineHeight: '24px',
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const alertGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: sp(3),
  '@container': {
    'akte-detail-body (width <= 1080px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const alertColumn = style({
  display: 'flex',
  flexDirection: 'column',
  gap: sp(2),
  minWidth: 0,
});

export const alertColumnTitle = style({
  margin: 0,
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.01em',
});

export const alertEmpty = style({
  borderRadius: 10,
  border: `1px dashed color-mix(in srgb, ${cssVarV2('layer/insideBorder/border')} 52%, transparent)`,
  background: surfaceBase,
  padding: `${sp(3)} ${sp(3)}`,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const alertCard = style({
  borderRadius: 10,
  border: borderSubtle,
  background: surfaceBase,
  padding: `${sp(2)} ${sp(3)}`,
  display: 'flex',
  flexDirection: 'column',
  gap: sp(1),
});

export const alertCardActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(1),
  marginTop: sp(1),
  flexWrap: 'wrap',
});

export const alertInlineButton = style({
  appearance: 'none',
  borderRadius: 6,
  border: borderSubtle,
  background: surfaceRaised,
  color: cssVarV2('text/primary'),
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 600,
  padding: `2px ${sp(2)}`,
  cursor: 'pointer',
  transition: 'all 0.14s ease',
  selectors: {
    '&:hover:not(:disabled)': {
      background: accentBg,
      borderColor: accentBorder,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const alertCardHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: sp(2),
});

export const alertCardTitle = style({
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const alertCardMeta = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
});

export const alertCardDescription = style({
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const alertCardSource = style({
  margin: 0,
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
});

export const alertCardQuote = style({
  margin: 0,
  borderLeft: `2px solid ${accentBorder}`,
  paddingLeft: sp(2),
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
});

export const alertTierBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 26,
  height: 18,
  borderRadius: 999,
  padding: '0 6px',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: '18px',
  background: surfaceRaised,
  color: cssVarV2('text/secondary'),
  selectors: {
    '&[data-tier="P1"]': {
      background: 'rgba(255, 59, 48, 0.14)',
      color: cssVarV2('status/error'),
    },
    '&[data-tier="P2"]': {
      background: 'rgba(255, 179, 64, 0.16)',
      color: 'rgb(200, 140, 20)',
    },
    '&[data-tier="P3"]': {
      background: 'rgba(52, 199, 89, 0.14)',
      color: 'rgb(52, 199, 89)',
    },
  },
});

export const nextActionsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: sp(2),
});

export const alertTimelineSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: sp(2),
});

export const alertTimelineList = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: sp(2),
  '@container': {
    'akte-detail-body (width <= 900px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const alertTimelineItem = style({
  borderRadius: 10,
  border: borderSubtle,
  background: surfaceBase,
  padding: `${sp(2)} ${sp(3)}`,
  display: 'flex',
  flexDirection: 'column',
  gap: sp(1),
});

export const nextActionButton = style({
  appearance: 'none',
  textAlign: 'left',
  width: '100%',
  border: borderSubtle,
  background: surfaceBase,
  borderRadius: 10,
  padding: `${sp(2)} ${sp(3)}`,
  cursor: 'pointer',
  transition: 'all 0.14s ease',
  selectors: {
    '&:hover': {
      background: accentBg,
      borderColor: accentBorder,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const mainPanel = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
  minWidth: 0,
});

export const sidePanel = style({
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--affine-background-secondary-color)',
  borderLeft: borderDivider,
});

export const sidePanelHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(1),
  padding: `${sp(2)} ${sp(3)}`,
  borderBottom: borderDivider,
  background: surfaceBase,
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  position: 'sticky',
  top: 0,
  zIndex: 2,
});

export const sidePanelTab = style({
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  padding: `${sp(1)} ${sp(2)}`,
  fontSize: 12,
  fontWeight: 500,
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: sp(1),
  selectors: {
    '&[data-active="true"]': {
      background: accentBg,
      color: cssVarV2('text/primary'),
      fontWeight: 600,
    },
    '&:hover:not([data-active="true"])': {
      background: surfaceRaised,
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -1,
    },
  },
});

export const sidePanelBody = style({
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
});

export const sidePanelTabBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  background: 'rgba(255, 59, 48, 0.12)',
  color: cssVarV2('status/error'),
});

/* ═══ Tabs ═══ */
export const tabBar = style({
  display: 'flex',
  gap: 0,
  padding: `0 ${gutter}px`,
  borderBottom: borderDivider,
  background: 'var(--affine-background-primary-color)',
  '@container': {
    'akte-detail-body (width <= 500px)': {
      padding: `0 ${gutterSm}px`,
    },
  },
});

export const tab = style({
  appearance: 'none',
  background: 'transparent',
  border: 0,
  borderBottom: '2px solid transparent',
  padding: `${sp(2)} ${sp(4)}`,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: '20px',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  transition: 'color 0.15s ease, border-color 0.15s ease',
  selectors: {
    '&[data-active="true"]': {
      color: cssVarV2('text/primary'),
      fontWeight: 600,
      borderBottomColor: cssVarV2('button/primary'),
    },
    '&:hover:not([data-active="true"])': {
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
});

export const tabCount = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  borderRadius: 9,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '18px',
  background: surfaceRaised,
  color: cssVarV2('text/secondary'),
  marginLeft: 6,
});

/* ═══ Document List ═══ */
export const scrollArea = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  // Modern thin scrollbar
  scrollbarWidth: 'thin' as any,
  scrollbarColor: `color-mix(in srgb, ${cssVarV2('text/secondary')} 20%, transparent) transparent`,
});

export const docListContainer = style({
  padding: `${sp(2)} ${gutter}px ${sp(6)}`,
  '@container': {
    'akte-detail-body (width <= 500px)': {
      padding: `${sp(2)} ${gutterSm}px ${sp(4)}`,
    },
  },
});

export const docListToolbar = style({
  display: 'flex',
  gap: sp(2),
  padding: `${sp(2)} ${gutter}px`,
  alignItems: 'center',
  flexWrap: 'wrap',
  borderBottom: borderDivider,
  background: surfaceBase,
  '@container': {
    'akte-detail-body (width <= 500px)': {
      padding: `${sp(2)} ${gutterSm}px`,
    },
  },
});

export const docBulkBar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: sp(2),
  padding: `${sp(2)} ${gutter}px`,
  borderBottom: borderDivider,
  background: accentBg,
});

export const docBulkLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(2),
  flexWrap: 'wrap',
});

export const docBulkCount = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const docBulkButtonDanger = style({
  appearance: 'none',
  border: `1px solid color-mix(in srgb, ${cssVarV2('status/error')} 30%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 10%, transparent)`,
  color: cssVarV2('status/error'),
  borderRadius: 8,
  padding: `${sp(1)} ${sp(3)}`,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.14s ease',
  selectors: {
    '&:hover:not(:disabled)': {
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 14%, transparent)`,
      borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 38%, transparent)`,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const docListCount = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const searchInput = style({
  flex: 1,
  minWidth: 120,
  maxWidth: 280,
  padding: `${sp(1)} ${sp(3)}`,
  borderRadius: 8,
  border: borderSubtle,
  background: surfaceRaised,
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  selectors: {
    '&::placeholder': {
      color: cssVarV2('text/secondary'),
    },
    '&:focus': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 0 0 2px ${accentBorder}`,
    },
  },
});

export const docHeaderRow = style({
  display: 'grid',
  gridTemplateColumns: '28px 1fr 80px 100px 72px',
  gap: sp(2),
  padding: `${sp(2)} ${sp(2)}`,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  color: cssVarV2('text/secondary'),
  letterSpacing: '0.04em',
  borderBottom: borderDivider,
  '@container': {
    'akte-detail-body (width <= 600px)': {
      gridTemplateColumns: '28px 1fr 72px',
    },
  },
});

export const docRow = style({
  display: 'grid',
  gridTemplateColumns: '28px 1fr 80px 100px 72px',
  gap: sp(2),
  padding: `${sp(2)} ${sp(2)}`,
  borderRadius: 10,
  cursor: 'pointer',
  alignItems: 'center',
  transition: interactionTransition,
  selectors: {
    '&[data-selected="true"]': {
      background: accentBg,
    },
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&[data-selected="true"]:hover': {
      background: accentBgHover,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
  '@container': {
    'akte-detail-body (width <= 600px)': {
      gridTemplateColumns: '1fr 72px',
    },
  },
});

export const docIcon = style({
  display: 'none',
});

export const docTitle = style({
  fontSize: 13,
  fontWeight: 500,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
});

export const docTitleCol = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const docDigestSummary = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const docDigestToc = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(1),
  flexWrap: 'wrap',
});

export const docDigestTocItem = style({
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: 200,
  padding: `1px ${sp(1)}`,
  borderRadius: 4,
  border: borderSubtle,
  background: surfaceBase,
  fontSize: 10,
  lineHeight: '14px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const chunkCategory = style({
  fontWeight: 500,
});

export const chunkDocTitle = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const chunkKeywords = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const chunkMore = style({
  padding: sp(4),
  textAlign: 'center',
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const sidebarTabIcon = style({
  fontSize: 14,
  fontWeight: 700,
});

export const docKindBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `1px ${sp(1)}`,
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  marginLeft: sp(2),
  flexShrink: 0,
  background: surfaceRaised,
  color: cssVarV2('text/secondary'),
});

export const matterDescription = style({
  marginTop: sp(3),
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  lineHeight: '18px',
});

export const sidePanelEmptyState = style({
  padding: sp(6),
  textAlign: 'center',
  fontSize: 13,
  color: cssVarV2('text/secondary'),
  borderRadius: 10,
  border: `1px dashed color-mix(in srgb, ${cssVarV2('layer/insideBorder/border')} 50%, transparent)`,
  background: surfaceRaised,
});

export const deadlineRow = style({
  padding: `${sp(2)} 0`,
  borderBottom: borderDivider,
  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

export const deadlineTitle = style({
  fontSize: 13,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  selectors: {
    '&[data-urgent="true"]': {
      color: cssVarV2('status/error'),
    },
  },
});

export const deadlineMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  marginTop: 2,
});

export const docMeta = style({
  fontSize: 12,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '@container': {
    'akte-detail-body (width <= 600px)': {
      display: 'none',
    },
  },
});

export const docStatusBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: sp(1),
  padding: `2px ${sp(2)}`,
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: '14px',
  background: surfaceRaised,
});

export const docStatusReady = style({
  background: 'rgba(52, 199, 89, 0.10)',
  color: 'rgb(52, 199, 89)',
  selectors: {
    '[data-theme="dark"] &': {
      background: 'rgba(52, 199, 89, 0.12)',
      color: 'rgb(74, 222, 111)',
    },
  },
});

export const docStatusPending = style({
  background: 'rgba(255, 179, 64, 0.10)',
  color: 'rgb(200, 140, 20)',
  selectors: {
    '[data-theme="dark"] &': {
      background: 'rgba(255, 179, 64, 0.12)',
      color: 'rgb(255, 179, 64)',
    },
  },
});

export const docStatusFailed = style({
  background: 'rgba(255, 59, 48, 0.10)',
  color: cssVarV2('status/error'),
  selectors: {
    '[data-theme="dark"] &': {
      background: 'rgba(255, 59, 48, 0.12)',
    },
  },
});

export const docRowActions = style({
  display: 'flex',
  gap: sp(1),
  opacity: 0,
  transition: 'opacity 0.12s ease',
  selectors: {
    [`${docRow}:hover &`]: {
      opacity: 1,
    },
  },
});

export const docActionButton = style({
  appearance: 'none',
  background: 'transparent',
  border: 0,
  padding: `2px ${sp(1)}`,
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  color: cssVarV2('text/secondary'),
  transition: 'all 0.12s ease',
  selectors: {
    '&:hover': {
      background: surfaceRaised,
      color: cssVarV2('text/primary'),
    },
  },
});

/* ═══ Folder Section ═══ */
export const folderSection = style({
  marginBottom: sp(1),
});

export const folderHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(1),
  padding: `${sp(2)} ${sp(3)}`,
  cursor: 'pointer',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  color: cssVarV2('text/secondary'),
  transition: 'background 0.1s ease, color 0.1s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
    },
  },
});

export const folderIcon = style({
  display: 'none',
});

export const folderName = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const folderCount = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  fontWeight: 500,
});

export const folderChevron = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  transition: 'transform 0.15s ease',
  selectors: {
    '&[data-open="true"]': {
      transform: 'rotate(90deg)',
    },
  },
});

export const folderContent = style({
  paddingLeft: sp(3),
});

/* ═══ Empty State ═══ */
export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: sp(3),
  padding: `${sp(16)} ${sp(6)}`,
  textAlign: 'center',
});

export const emptyIcon = style({
  display: 'none',
});

export const emptyTitle = style({
  fontSize: 15,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.01em',
});

export const emptyDescription = style({
  fontSize: 13,
  color: cssVarV2('text/secondary'),
  maxWidth: 320,
  lineHeight: '20px',
});

/* ═══ Page Doc Rows (AFFiNE pages) ═══ */
export const pageDocRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(2),
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.12s ease',
  selectors: {
    '&[data-selected="true"]': {
      background: accentBg,
    },
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&[data-selected="true"]:hover': {
      background: accentBgHover,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
});

export const pageDocIcon = style({
  display: 'none',
});

export const pageDocTitle = style({
  flex: 1,
  fontSize: 13,
  fontWeight: 500,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const pageDocMeta = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

/* ═══ Action Status ═══ */
export const actionStatus = style({
  margin: `${sp(2)} ${gutter}px 0`,
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 8,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  border: borderSubtle,
  background: surfaceRaised,
});

/* ═══ Skeleton ═══ */
export const skeletonRow = style({
  height: 40,
  borderRadius: 8,
  margin: `${sp(1)} 0`,
  background: `linear-gradient(90deg, ${surfaceRaised} 25%, color-mix(in srgb, ${cssVarV2('text/secondary')} 6%, transparent) 50%, ${surfaceRaised} 75%)`,
  backgroundSize: '200% 100%',
  animation: `${skeletonShimmer} 1.2s ease-in-out infinite`,
});

/* ═══ Breadcrumb ═══ */
export const breadcrumb = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(1),
  padding: `${sp(2)} ${gutter}px`,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  '@container': {
    'akte-detail-body (width <= 500px)': {
      padding: `${sp(1)} ${gutterSm}px`,
    },
  },
});

export const breadcrumbLink = style({
  appearance: 'none',
  border: 0,
  background: 'transparent',
  padding: `2px ${sp(2)}`,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  transition: 'all 0.12s ease',
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
      background: surfaceRaised,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const breadcrumbSep = style({
  color: cssVarV2('text/secondary'),
  opacity: 0.4,
  fontSize: 11,
});

export const breadcrumbCurrent = style({
  color: cssVarV2('text/primary'),
  fontWeight: 500,
  fontSize: 12,
});

/* ═══ Inline Create ═══ */
export const inlineCreate = style({
  display: 'flex',
  gap: sp(2),
  alignItems: 'center',
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 8,
  border: `1px dashed color-mix(in srgb, ${cssVarV2('layer/insideBorder/border')} 50%, transparent)`,
  margin: `${sp(2)} 0`,
  transition: 'border-color 0.15s ease',
  selectors: {
    '&:focus-within': {
      borderColor: accentBorder,
    },
  },
});

export const inlineCreateInput = style({
  flex: 1,
  appearance: 'none',
  border: 0,
  background: 'transparent',
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  outline: 'none',
  selectors: {
    '&::placeholder': {
      color: cssVarV2('text/secondary'),
    },
  },
});

export const inlineCreateButton = style({
  appearance: 'none',
  background: cssVarV2('button/primary'),
  color: cssVarV2('button/pureWhiteText'),
  border: 0,
  borderRadius: 6,
  padding: `3px ${sp(3)}`,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.12s ease',
  selectors: {
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    '&:hover:not(:disabled)': {
      opacity: 0.9,
    },
  },
});

/* ═══ Context info section ═══ */
export const contextInfoSection = style({
  padding: `${sp(3)} ${sp(4)}`,
});

export const contextInfoRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${sp(1)} ${sp(2)}`,
  fontSize: 12,
  lineHeight: '18px',
  borderRadius: 6,
  selectors: {
    '&:nth-child(odd)': {
      background: surfaceRaised,
    },
  },
});

export const contextInfoLabel = style({
  color: cssVarV2('text/secondary'),
  fontWeight: 400,
});

export const contextInfoValue = style({
  color: cssVarV2('text/primary'),
  fontWeight: 500,
  textAlign: 'right',
});

/* ═══ Chat Mode Buttons ═══ */
export const chatModeButton = style({
  appearance: 'none',
  padding: `3px ${sp(2)}`,
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 500,
  border: 'none',
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  transition: 'all 0.12s ease',
  letterSpacing: '-0.01em',
  selectors: {
    '&:hover': {
      background: surfaceRaised,
      color: cssVarV2('text/primary'),
    },
  },
});

export const chatModeButtonActive = style({
  appearance: 'none',
  padding: `3px ${sp(2)}`,
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  border: 'none',
  background: accentBg,
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  letterSpacing: '-0.01em',
});

/* ═══ Chat Empty State ═══ */
export const chatEmptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: sp(2),
  padding: `${sp(8)} ${sp(4)}`,
  textAlign: 'center',
});

export const chatEmptyTitle = style({
  fontSize: 15,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.02em',
});

export const chatEmptySubtitle = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  lineHeight: '18px',
  maxWidth: 220,
});

export const chatEmptyModes = style({
  display: 'flex',
  gap: sp(1),
  flexWrap: 'wrap',
  justifyContent: 'center',
  marginTop: sp(2),
});

export const chatRoot = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
});

export const chatModeBar = style({
  display: 'flex',
  gap: sp(1),
  padding: `${sp(2)} ${sp(3)}`,
  flexWrap: 'wrap',
  borderBottom: borderDivider,
  background: surfaceBase,
});

export const chatSessionBar = style({
  display: 'flex',
  gap: sp(1),
  padding: `${sp(1)} ${sp(3)}`,
  overflowX: 'auto',
  borderBottom: borderDivider,
  background: surfaceBase,
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
});

export const chatSessionChip = style({
  appearance: 'none',
  padding: `2px ${sp(2)}`,
  borderRadius: 6,
  fontSize: 11,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/secondary'),
  fontWeight: 500,
  transition: 'all 0.12s ease',
  selectors: {
    '&[data-active="true"]': {
      background: accentBg,
      color: cssVarV2('text/primary'),
      fontWeight: 600,
    },
    '&:hover:not([data-active="true"])': {
      background: surfaceRaised,
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -1,
    },
  },
});

export const chatSessionAdd = style({
  appearance: 'none',
  padding: `2px ${sp(2)}`,
  borderRadius: 6,
  fontSize: 11,
  border: `1px dashed color-mix(in srgb, ${cssVarV2('layer/insideBorder/border')} 50%, transparent)`,
  background: 'transparent',
  cursor: 'pointer',
  color: cssVarV2('text/secondary'),
  transition: 'all 0.12s ease',
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
      background: surfaceRaised,
      borderColor: accentBorder,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -1,
    },
  },
});

export const chatMessagesArea = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: `${sp(2)} ${sp(3)}`,
  scrollbarWidth: 'thin' as any,
  scrollbarColor: `color-mix(in srgb, ${cssVarV2('text/secondary')} 20%, transparent) transparent`,
});

export const chatHint = style({
  textAlign: 'center',
  padding: sp(6),
  fontSize: 13,
  color: cssVarV2('text/secondary'),
});

export const chatMessage = style({
  marginBottom: sp(2),
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 10,
  background: surfaceRaised,
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
});

export const chatMessageUser = style({
  background: accentBg,
});

export const chatMessageMeta = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  marginBottom: 3,
});

export const chatMessageContent = style({
  whiteSpace: 'pre-wrap',
});

export const chatCitations = style({
  marginTop: sp(1),
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const chatInputBar = style({
  padding: `${sp(2)} ${sp(3)}`,
  borderTop: borderDivider,
  display: 'flex',
  gap: sp(2),
  alignItems: 'flex-end',
  background: surfaceBase,
});

export const chatTextarea = style({
  flex: 1,
  resize: 'none',
  border: borderSubtle,
  borderRadius: 10,
  padding: `${sp(2)} ${sp(3)}`,
  fontSize: 13,
  lineHeight: '20px',
  background: surfaceRaised,
  color: cssVarV2('text/primary'),
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  selectors: {
    '&:focus': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 0 0 2px ${accentBorder}`,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const chatSendButton = style({
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 10,
  border: 0,
  background: cssVarV2('button/primary'),
  color: cssVarV2('button/pureWhiteText'),
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.12s ease',
  selectors: {
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    '&:hover:not(:disabled)': {
      opacity: 0.9,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const chatBusyHint = style({
  padding: `2px ${sp(3)} ${sp(2)}`,
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});
