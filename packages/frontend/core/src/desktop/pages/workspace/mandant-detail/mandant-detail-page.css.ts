import { cssVarV2 } from '@toeverything/theme/v2';
import { keyframes, style } from '@vanilla-extract/css';

import {
  interactionTransition,
  listRowBaseStyle,
  statusBadgeBaseStyle,
  statusBadgeCompactStyle,
  statusToneArchivedStyle,
  statusToneClosedStyle,
  statusToneErrorStyle,
  statusToneIdleStyle,
  statusToneOpenStyle,
  statusToneWarningStyle,
} from '../layouts/workspace-list-shared-styles';

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Mandant Detail v2
// ═══════════════════════════════════════════════════════════════════════════════
const borderSubtle = '1px solid var(--affine-border-color)';
const accentBg = 'color-mix(in srgb, var(--affine-primary-color) 11%, transparent)';
const accentBorder = 'color-mix(in srgb, var(--affine-primary-color) 28%, transparent)';
const surfaceBase = cssVarV2('layer/background/primary');
const surfaceRaised = cssVarV2('layer/background/secondary');
const sp = (n: number) => `${n * 4}px`;
const gutter = 24;
const gutterSm = 16;

const fadeIn = keyframes({
  '0%': { opacity: 0, transform: 'translateY(6px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  width: '100%',
  containerName: 'mandant-detail-body',
  containerType: 'size',
  background: 'var(--affine-background-primary-color)',
  overflow: 'hidden',
});

export const scrollArea = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  scrollbarWidth: 'thin' as any,
  scrollbarColor: `color-mix(in srgb, ${cssVarV2('text/secondary')} 20%, transparent) transparent`,
});

export const content = style({
  maxWidth: 1200,
  margin: '0 auto',
  padding: `0 ${gutter}px ${sp(8)}`,
  animation: `${fadeIn} 0.3s ease`,
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      padding: `0 ${gutterSm}px ${sp(6)}`,
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// BREADCRUMB
// ═══════════════════════════════════════════════════════════════════════════════

export const breadcrumb = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  padding: `${sp(3)} 0 ${sp(1)}`,
});

export const breadcrumbButton = style({
  appearance: 'none',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  color: cssVarV2('text/secondary'),
  padding: '2px 6px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  transition: 'color 0.15s ease, background 0.15s ease',
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
      background: 'var(--affine-hover-color)',
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEADER CARD
// ═══════════════════════════════════════════════════════════════════════════════

export const headerCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: sp(3),
  padding: `${sp(4)} ${sp(5)}`,
  borderRadius: 14,
  border: borderSubtle,
  background: surfaceRaised,
  marginBottom: sp(4),
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      padding: `${sp(3)} ${sp(3)}`,
    },
  },
});

export const headerTop = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: sp(3),
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      flexDirection: 'column',
    },
  },
});

export const headerLeft = style({
  display: 'flex',
  gap: sp(3),
  alignItems: 'flex-start',
  flex: 1,
  minWidth: 0,
});

export const avatarCircle = style({
  flexShrink: 0,
  width: 52,
  height: 52,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: cssVarV2('button/pureWhiteText'),
  background: `linear-gradient(135deg, var(--affine-primary-color), color-mix(in srgb, var(--affine-primary-color) 70%, #06b6d4))`,
  userSelect: 'none',
});

export const headerInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flex: 1,
  minWidth: 0,
});

export const title = style({
  fontSize: 22,
  fontWeight: 700,
  lineHeight: '28px',
  letterSpacing: '-0.02em',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const subtitle = style({
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  display: 'flex',
  alignItems: 'center',
  gap: sp(2),
  flexWrap: 'wrap',
});

export const subtitleSep = style({
  width: 3,
  height: 3,
  borderRadius: '50%',
  background: cssVarV2('text/secondary'),
  opacity: 0.5,
  flexShrink: 0,
});

export const contactRow = style({
  display: 'flex',
  gap: sp(4),
  flexWrap: 'wrap',
  marginTop: sp(1),
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      flexDirection: 'column',
      gap: sp(1),
    },
  },
});

export const contactItem = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: sp(1),
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const contactItemValue = style({
  color: cssVarV2('text/primary'),
  fontWeight: 500,
});

export const headerActions = style({
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

export const tagsRow = style({
  display: 'flex',
  gap: sp(1),
  flexWrap: 'wrap',
});

export const tag = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `1px 8px`,
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-primary-color) 8%, transparent)',
  border: `0.5px solid color-mix(in srgb, var(--affine-primary-color) 18%, transparent)`,
});

// ═══════════════════════════════════════════════════════════════════════════════
// KPI STATS ROW
// ═══════════════════════════════════════════════════════════════════════════════

export const statsGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
  marginBottom: sp(4),
  '@container': {
    'mandant-detail-body (width <= 900px)': {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
    'mandant-detail-body (width <= 600px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
});

export const statCard = style({
  border: borderSubtle,
  borderRadius: 12,
  padding: `${sp(3)} ${sp(3)}`,
  background: surfaceBase,
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
      background: 'var(--affine-hover-color)',
    },
  },
});

export const statLabel = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  lineHeight: '14px',
});

export const statValue = style({
  fontSize: 22,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginTop: sp(1),
  lineHeight: '28px',
  letterSpacing: '-0.02em',
});

export const statValueAccent = style({
  color: cssVarV2('button/primary'),
});

export const statValueError = style({
  color: cssVarV2('status/error'),
});

export const statValueSuccess = style({
  color: cssVarV2('status/success'),
});

export const statUnit = style({
  fontSize: 12,
  fontWeight: 500,
  color: cssVarV2('text/secondary'),
  marginLeft: 2,
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════════════════════════════════════════════

export const tabBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(1),
  marginBottom: sp(4),
  borderBottom: borderSubtle,
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'none' as any,
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
});

export const tabButton = style({
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: `${sp(2)} ${sp(3)}`,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: '20px',
  color: cssVarV2('text/secondary'),
  borderBottom: '2px solid transparent',
  transition: 'color 0.15s ease, border-color 0.15s ease',
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
    },
    '&[data-active="true"]': {
      color: cssVarV2('text/primary'),
      borderBottomColor: cssVarV2('button/primary'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
      borderRadius: 4,
    },
  },
});

export const tabBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  lineHeight: '14px',
  marginLeft: 4,
  background: 'color-mix(in srgb, var(--affine-primary-color) 12%, transparent)',
  color: cssVarV2('button/primary'),
});

export const tabBadgeUrgent = style({
  background: 'color-mix(in srgb, var(--affine-error-color) 12%, transparent)',
  color: cssVarV2('status/error'),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAB CONTENT PANELS
// ═══════════════════════════════════════════════════════════════════════════════

export const tabPanel = style({
  animation: `${fadeIn} 0.2s ease`,
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION CARD (reusable)
// ═══════════════════════════════════════════════════════════════════════════════

export const sectionCard = style({
  border: borderSubtle,
  borderRadius: 12,
  background: surfaceRaised,
  marginBottom: sp(4),
  overflow: 'hidden',
});

export const focusHighlightCard = style({
  borderColor: cssVarV2('button/primary'),
  boxShadow:
    '0 0 0 1px color-mix(in srgb, var(--affine-primary-color) 55%, transparent), 0 16px 36px rgba(0, 0, 0, 0.18)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-primary-color) 7%, transparent), transparent 42%), var(--affine-background-secondary-color)',
  transition: 'border-color 220ms ease, box-shadow 220ms ease, background 220ms ease',
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: sp(2),
  padding: `${sp(3)} ${sp(4)}`,
  borderBottom: borderSubtle,
});

export const sectionTitle = style({
  fontSize: 14,
  fontWeight: 700,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.01em',
});

export const sectionAction = style({
  appearance: 'none',
  border: borderSubtle,
  background: surfaceBase,
  color: cssVarV2('text/secondary'),
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  padding: '4px 10px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
      borderColor: accentBorder,
      background: accentBg,
    },
  },
});

export const sectionBody = style({
  padding: sp(4),
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      padding: sp(3),
    },
  },
});

export const card = sectionCard;

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
});

export const listItemButton = style({
  ...listRowBaseStyle,
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 10,
  border: borderSubtle,
  background: surfaceBase,
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const rowTitle = style({
  fontSize: 13,
  fontWeight: 600,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const rowMeta = style({
  fontSize: 12,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  display: 'flex',
  alignItems: 'center',
  gap: sp(2),
  flexWrap: 'wrap',
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2-COLUMN LAYOUT (for Akten tab)
// ═══════════════════════════════════════════════════════════════════════════════

export const twoColGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: sp(3),
  '@container': {
    'mandant-detail-body (width <= 800px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// AKTEN LIST ITEM (card style)
// ═══════════════════════════════════════════════════════════════════════════════

export const akteCard = style({
  ...listRowBaseStyle,
  display: 'flex',
  flexDirection: 'column',
  gap: sp(2),
  padding: sp(3),
  border: borderSubtle,
  borderRadius: 10,
  background: surfaceBase,
});

export const akteCardTitle = style({
  fontSize: 14,
  fontWeight: 600,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const akteCardRef = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  letterSpacing: '0.02em',
});

export const akteCardMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: sp(2),
  flexWrap: 'wrap',
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  lineHeight: '16px',
});

export const akteCardMetaItem = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
});

// ═══════════════════════════════════════════════════════════════════════════════
// FINANZEN TABLE
// ═══════════════════════════════════════════════════════════════════════════════

export const finanzSummaryGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
  marginBottom: sp(4),
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
});

export const finanzMiniCard = style({
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 10,
  border: borderSubtle,
  background: surfaceBase,
});

export const finanzMiniLabel = style({
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2('text/secondary'),
  lineHeight: '14px',
});

export const finanzMiniValue = style({
  fontSize: 18,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginTop: 2,
  lineHeight: '24px',
  letterSpacing: '-0.01em',
});

export const tableWrap = style({
  overflowX: 'auto',
});

export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  lineHeight: '20px',
});

export const tableHead = style({
  borderBottom: borderSubtle,
});

export const th = style({
  textAlign: 'left',
  padding: `${sp(2)} ${sp(3)}`,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
});

export const thRight = style({
  textAlign: 'right',
});

export const td = style({
  padding: `${sp(2)} ${sp(3)}`,
  color: cssVarV2('text/primary'),
  borderBottom: `0.5px solid color-mix(in srgb, var(--affine-border-color) 50%, transparent)`,
  verticalAlign: 'middle',
});

export const tdRight = style({
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
});

export const tdBold = style({
  fontWeight: 600,
});

export const tdSecondary = style({
  color: cssVarV2('text/secondary'),
  fontSize: 12,
});

export const tableRow = style({
  transition: 'background 0.12s ease',
  cursor: 'default',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRISTEN TIMELINE ITEM
// ═══════════════════════════════════════════════════════════════════════════════

export const deadlineList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
});

export const deadlineRow = style({
  display: 'grid',
  gridTemplateColumns: '80px 1fr auto',
  gap: sp(3),
  alignItems: 'center',
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 8,
  transition: 'background 0.12s ease',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
    },
  },
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      gridTemplateColumns: '60px 1fr auto',
      gap: sp(2),
    },
  },
});

export const deadlineDate = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  fontVariantNumeric: 'tabular-nums',
});

export const deadlineDateUrgent = style({
  color: cssVarV2('status/error'),
  fontWeight: 700,
});

export const deadlineInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
});

export const deadlineTitle = style({
  fontSize: 13,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const deadlineMatter = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOKUMENTE LIST
// ═══════════════════════════════════════════════════════════════════════════════

export const docGroup = style({
  marginBottom: sp(3),
});

export const docGroupTitle = style({
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2('text/secondary'),
  padding: `${sp(1)} ${sp(3)}`,
  marginBottom: sp(1),
});

export const docRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  gap: sp(3),
  alignItems: 'center',
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 8,
  transition: 'background 0.12s ease',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
    },
  },
});

export const docName = style({
  fontSize: 13,
  fontWeight: 500,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const docMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIZEN & VOLLMACHTEN
// ═══════════════════════════════════════════════════════════════════════════════

export const noteCard = style({
  padding: sp(3),
  borderRadius: 10,
  border: borderSubtle,
  background: surfaceBase,
  display: 'flex',
  flexDirection: 'column',
  gap: sp(1),
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
      background: 'var(--affine-hover-color)',
    },
  },
});

export const noteTitle = style({
  fontSize: 13,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const noteContent = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
});

export const noteMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  alignItems: 'center',
  gap: sp(2),
  marginTop: sp(1),
});

export const vollmachtCard = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: sp(3),
  padding: `${sp(2)} ${sp(3)}`,
  borderRadius: 10,
  border: borderSubtle,
  background: surfaceBase,
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
      background: 'var(--affine-hover-color)',
    },
  },
});

export const vollmachtInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
  flex: 1,
});

export const vollmachtTitle = style({
  fontSize: 13,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const vollmachtMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ZEITERFASSUNG (TIME ENTRIES)
// ═══════════════════════════════════════════════════════════════════════════════

export const timeEntryGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: sp(3),
  '@container': {
    'mandant-detail-body (width <= 600px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGES
// ═══════════════════════════════════════════════════════════════════════════════

export const statusBadge = style(statusBadgeBaseStyle);
export const statusBadgeCompact = style(statusBadgeCompactStyle);

export const statusOpen = style(statusToneOpenStyle);
export const statusClosed = style(statusToneClosedStyle);
export const statusArchived = style(statusToneArchivedStyle);
export const statusPending = style(statusToneIdleStyle);
export const statusExpired = style(statusToneErrorStyle);
export const statusCompleted = style(statusToneClosedStyle);
export const statusWarning = style(statusToneWarningStyle);
export const statusError = style(statusToneErrorStyle);

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

export const empty = style({
  fontSize: 13,
  color: cssVarV2('text/secondary'),
  padding: `${sp(6)} ${sp(4)}`,
  textAlign: 'center',
});

export const emptyInline = style({
  fontSize: 13,
  color: cssVarV2('text/secondary'),
  padding: `${sp(2)} 0`,
});
