import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, keyframes, style } from '@vanilla-extract/css';

import {
  filterChipLowPriorityStyle,
  filterChipStyle,
  filterGroupRightStyle,
  filterGroupStyle,
  filterRowStyle,
  glassFill,
  glassStroke,
  interactionTransition,
  layoutGutter,
  layoutGutterMd,
  layoutGutterSm,
  listRowBaseStyle,
  rowDividerBorder,
  rowDividerColor,
  searchInputStyle,
  sortButtonStyle,
  statusBadgeBaseStyle,
  statusToneArchivedStyle,
  statusToneClosedStyle,
  statusToneOpenStyle,
  srOnlyLiveStyle,
  surfaceEnter,
  toolbarControlStyle,
  toolbarLabelStyle,
  toolbarSelectStyle,
  toolbarSortDirectionButtonStyle,
  stickyFilterBarStyle,
  workspaceAmbientBackground,
} from '../layouts/workspace-list-shared-styles';

const skeletonShimmer = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
});

const overdueTone = cssVarV2('status/error');
const todayTone =
  'color-mix(in srgb, var(--affine-theme-secondary, var(--affine-theme-link, #06b6d4)) 72%, var(--affine-text-primary-color))';
const soonTone =
  'color-mix(in srgb, var(--affine-theme-accent, var(--affine-primary-color)) 58%, var(--affine-text-primary-color))';

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  containerName: 'akten-body',
  containerType: 'size',
  background: workspaceAmbientBackground,
});

export const scrollArea = style({
  height: 0,
  flex: 1,
  paddingTop: '10px',
  paddingBottom: '14px',
  paddingLeft: `${layoutGutter}px`,
  paddingRight: `${layoutGutter}px`,
  overflowY: 'auto',
  '@container': {
    'akten-body (width <= 500px)': {
      paddingLeft: `${layoutGutterMd}px`,
      paddingRight: `${layoutGutterMd}px`,
    },
    'akten-body (width <= 393px)': {
      paddingLeft: `${layoutGutterSm}px`,
      paddingRight: `${layoutGutterSm}px`,
    },
  },
});

export const akteRowCritical = style({
  boxShadow: `inset 4px 0 0 ${overdueTone}`,
  background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 12%, transparent) 0%, color-mix(in srgb, ${overdueTone} 6%, transparent) 34%, transparent 74%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 18%, transparent) 0%, color-mix(in srgb, ${overdueTone} 10%, transparent) 38%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 18%, transparent) 0%, color-mix(in srgb, ${overdueTone} 10%, transparent) 36%, transparent 76%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 24%, transparent) 0%, color-mix(in srgb, ${overdueTone} 14%, transparent) 40%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const toolbarControl = style(toolbarControlStyle);

export const toolbarLabel = style(toolbarLabelStyle);

export const toolbarSelect = style(toolbarSelectStyle);

export const toolbarSortDirectionButton = style(toolbarSortDirectionButtonStyle);

export const filterChipLowPriority = style(filterChipLowPriorityStyle('akten-body'));

export const actionStatus = style({
  margin: `10px ${layoutGutter}px 0`,
  padding: '8px 12px',
  borderRadius: 10,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/secondary'),
  border: '1px solid var(--affine-border-color)',
  '@container': {
    'akten-body (width <= 500px)': {
      margin: `8px ${layoutGutterMd}px 0`,
    },
  },
});

export const quickstartRow = style({
  padding: `8px ${layoutGutter}px 0`,
  '@container': {
    'akten-body (width <= 500px)': {
      padding: `8px ${layoutGutterMd}px 0`,
    },
    'akten-body (width <= 393px)': {
      padding: `8px ${layoutGutterSm}px 0`,
    },
  },
});

export const quickstartCard = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '14px 18px',
  borderRadius: 14,
  border: `0.5px solid ${glassStroke}`,
  background: glassFill,
  backdropFilter: 'blur(12px) saturate(130%)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  selectors: {
    '&:hover': {
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 90%, var(--affine-primary-color))',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(255,255,255,0.06) inset',
    },
    '[data-theme="dark"] &': {
      boxShadow: '0 1px 4px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
    },
  },
});

export const quickstartText = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const quickstartTitle = style({
  fontSize: 13,
  fontWeight: 700,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.01em',
});

export const quickstartDescription = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  maxWidth: 720,
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 78%, var(--affine-text-secondary-color))',
    },
  },
});

export const quickstartButton = style({
  appearance: 'none',
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 28%, transparent)`,
  borderRadius: 10,
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: '18px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  background: cssVarV2('button/primary'),
  color: cssVarV2('button/pureWhiteText'),
  boxShadow: `0 2px 8px color-mix(in srgb, ${cssVarV2('button/primary')} 32%, transparent)`,
  transition: 'transform 0.14s ease, opacity 0.14s ease, box-shadow 0.14s ease, background 0.15s ease',
  selectors: {
    '&:hover:not(:disabled)': {
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 88%, var(--affine-background-primary-color))`,
      borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 36%, transparent)`,
      transform: 'translateY(-0.5px)',
      boxShadow: `0 4px 14px color-mix(in srgb, ${cssVarV2('button/primary')} 36%, transparent)`,
    },
    '&:active:not(:disabled)': {
      transform: 'translateY(0)',
      boxShadow: 'none',
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

export const srOnlyLive = style(srOnlyLiveStyle);

export const akteRowOpening = style({
  opacity: 0.6,
  pointerEvents: 'none',
});

export const akteRowOverdue = style({
  boxShadow: `inset 4px 0 0 ${overdueTone}`,
  background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 12%, transparent) 0%, color-mix(in srgb, ${overdueTone} 6%, transparent) 34%, transparent 74%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 18%, transparent) 0%, color-mix(in srgb, ${overdueTone} 10%, transparent) 38%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 18%, transparent) 0%, color-mix(in srgb, ${overdueTone} 10%, transparent) 36%, transparent 76%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 24%, transparent) 0%, color-mix(in srgb, ${overdueTone} 14%, transparent) 40%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const akteRowToday = style({
  boxShadow: `inset 3px 0 0 ${todayTone}`,
  background: `color-mix(in srgb, ${todayTone} 3%, transparent)`,
  selectors: {
    '[data-theme="dark"] &': {
      background: `color-mix(in srgb, ${todayTone} 5%, transparent)`,
    },
  },
});

export const akteRowSoon = style({
  background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 5%, transparent) 0%, color-mix(in srgb, ${soonTone} 2%, transparent) 28%, transparent 68%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 8%, transparent) 0%, color-mix(in srgb, ${soonTone} 4%, transparent) 32%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 8%, transparent) 0%, color-mix(in srgb, ${soonTone} 4%, transparent) 30%, transparent 72%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 12%, transparent) 0%, color-mix(in srgb, ${soonTone} 6%, transparent) 36%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const akteRowTrashed = style({
  opacity: 0.65,
  borderColor: 'color-mix(in srgb, var(--affine-border-color) 50%, transparent)',
  selectors: {
    '&:hover, &:focus-visible': {
      opacity: 0.8,
    },
  },
});

export const sortButton = style(sortButtonStyle);

export const listContainer = style({
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  marginTop: 10,
  backdropFilter: 'none',
  boxShadow: 'none',
  overflow: 'visible',
  animation: `${surfaceEnter} 280ms cubic-bezier(0.22, 1, 0.36, 1) both`,
  transition: interactionTransition,
  '@container': {
    'akten-body (width <= 500px)': {
      borderRadius: 0,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
      transition: 'none',
    },
  },
});

export const filterBar = style(stickyFilterBarStyle('akten-body'));

export const filterRow = style(filterRowStyle);

export const filterGroup = style(filterGroupStyle);

export const filterGroupRight = style(filterGroupRightStyle('akten-body'));

export const filterChip = style(filterChipStyle);

export const akteRow = style({
  ...listRowBaseStyle,
  display: 'grid',
  gridTemplateColumns: '34px 1fr 140px 140px 120px 100px 40px',
  gap: 8,
  padding: `10px ${layoutGutter}px`,
  borderBottom: rowDividerBorder,
  borderRadius: 0,
  selectors: {
    ...listRowBaseStyle.selectors,
    '&:last-child': {
      borderBottom: 'none',
    },
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 70%, transparent)',
      borderBottomColor: rowDividerColor,
      borderRadius: 10,
    },
    '&:focus-visible': {
      outline: `1.5px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -1,
      background: 'var(--affine-hover-color)',
      borderColor: cssVarV2('button/primary'),
      borderRadius: 10,
    },
  },
  '@container': {
    'akten-body (width <= 700px)': {
      gridTemplateColumns: '34px 1fr 120px 100px 40px',
    },
    'akten-body (width <= 500px)': {
      gridTemplateColumns: '34px 1fr 100px 40px',
      padding: `10px ${layoutGutterMd}px`,
    },
    'akten-body (width <= 393px)': {
      padding: `10px ${layoutGutterSm}px`,
    },
  },
});

export const selectionCell = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const selectionCheckbox = style({
  width: 16,
  height: 16,
  margin: 0,
  cursor: 'pointer',
  accentColor: cssVarV2('button/primary'),
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
      borderRadius: 4,
    },
  },
});

export const actionsCell = style({
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
});

globalStyle(`${actionsCell} button`, {
  pointerEvents: 'auto',
});

export const akteTitle = style({
  fontSize: 13,
  fontWeight: 600,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.01em',
});

export const akteFolderMeta = style({
  marginTop: 4,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
});

export const akteFolderMetaBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '1px 6px',
  fontSize: 10,
  lineHeight: '14px',
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-v2-highlight-secondary, rgba(6, 182, 212, 0.06)) 40%, color-mix(in srgb, var(--affine-background-primary-color) 76%, transparent))',
  border: `0.5px solid ${glassStroke}`,
  whiteSpace: 'nowrap',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 78%, var(--affine-text-secondary-color))',
      borderColor: 'color-mix(in srgb, var(--affine-theme-secondary-soft, rgba(6, 182, 212, 0.14)) 50%, rgba(255, 255, 255, 0.12))',
    },
    '&[data-alert="true"]': {
      color: 'var(--affine-v2-status-error, ' + cssVarV2('status/error') + ')',
      borderColor: `color-mix(in srgb, var(--affine-v2-status-error, ${cssVarV2('status/error')}) 34%, transparent)`,
      background: `color-mix(in srgb, var(--affine-v2-status-error, ${cssVarV2('status/error')}) 10%, transparent)`,
    },
    '&[data-critical="true"]': {
      color: 'var(--affine-v2-status-error, ' + cssVarV2('status/error') + ')',
      borderColor: `color-mix(in srgb, var(--affine-v2-status-error, ${cssVarV2('status/error')}) 44%, transparent)`,
      background: `color-mix(in srgb, var(--affine-v2-status-error, ${cssVarV2('status/error')}) 16%, transparent)`,
      fontWeight: 700,
    },
  },
});

export const akteSubtitle = style({
  fontSize: 12,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 80%, var(--affine-text-secondary-color))',
    },
  },
});

export const akteMeta = style({
  fontSize: 12,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 76%, var(--affine-text-secondary-color))',
    },
  },
  '@container': {
    'akten-body (width <= 700px)': {
      display: 'none',
    },
  },
});

export const akteMetaHideSm = style({
  fontSize: 12,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 76%, var(--affine-text-secondary-color))',
    },
  },
  '@container': {
    'akten-body (width <= 500px)': {
      display: 'none',
    },
  },
});

export const statusBadge = style(statusBadgeBaseStyle);

export const statusOpen = style(statusToneOpenStyle);

export const statusClosed = style(statusToneClosedStyle);

export const statusArchived = style(statusToneArchivedStyle);

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '80px 24px',
  textAlign: 'center',
});

export const emptyTitle = style({
  fontSize: 16,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const emptyDescription = style({
  fontSize: 14,
  color: cssVarV2('text/secondary'),
  maxWidth: 360,
  lineHeight: '22px',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 74%, var(--affine-text-secondary-color))',
    },
  },
});

export const searchInput = style({
  ...searchInputStyle,
  flex: 1,
  maxWidth: 360,
});

export const headerRow = style({
  display: 'grid',
  gridTemplateColumns: '34px 1fr 140px 140px 120px 100px 40px',
  gap: 8,
  padding: `6px ${layoutGutter}px 8px`,
  fontSize: 10,
  fontWeight: 700,
  lineHeight: '14px',
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: `1px solid color-mix(in srgb, var(--affine-border-color) 80%, transparent)`,
  '@container': {
    'akten-body (width <= 700px)': {
      gridTemplateColumns: '34px 1fr 120px 100px 40px',
    },
    'akten-body (width <= 500px)': {
      gridTemplateColumns: '34px 1fr 100px 40px',
      padding: `6px ${layoutGutterMd}px 8px`,
    },
    'akten-body (width <= 393px)': {
      padding: `6px ${layoutGutterSm}px 8px`,
    },
  },
});

export const deadlineBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '16px',
  color: cssVarV2('status/error'),
});

export const deadlineBadgeCritical = style({
  color: cssVarV2('status/error'),
  fontWeight: 800,
  letterSpacing: '0.01em',
});

export const skeletonRow = style({
  height: 52,
  borderRadius: 0,
  borderBottom: rowDividerBorder,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
  backgroundSize: '200% 100%',
  animation: `${skeletonShimmer} 1.2s ease-in-out infinite`,
});

export const searchWrap = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flex: '1 1 240px',
  minWidth: 120,
  maxWidth: 360,
});

export const searchClear = style({
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  appearance: 'none',
  background: 'transparent',
  border: 0,
  padding: '0 2px',
  margin: 0,
  font: 'inherit',
  fontSize: 16,
  lineHeight: 1,
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  selectors: {
    '&:hover': {
      color: cssVarV2('text/primary'),
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
});

export const undoButton = style({
  appearance: 'none',
  background: 'transparent',
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 4,
  padding: '2px 8px',
  marginLeft: 12,
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('button/primary'),
  cursor: 'pointer',
  transition: 'background 0.12s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const contextMenu = style({
  position: 'fixed',
  zIndex: 9999,
  minWidth: 180,
  background: 'var(--affine-background-overlay-panel-color)',
  border: `1px solid ${glassStroke}`,
  borderRadius: 12,
  boxShadow: 'var(--affine-popover-shadow)',
  padding: '4px 0',
  overflow: 'hidden',
});

export const contextMenuSection = style({
  padding: '6px 14px 4px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2('text/secondary'),
  userSelect: 'none',
});

export const contextMenuItem = style({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  appearance: 'none',
  background: 'transparent',
  border: 0,
  padding: '7px 14px',
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  transition: 'background 0.1s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
});

export const contextMenuItemDanger = style({
  color: cssVarV2('status/error'),
  selectors: {
    '&:hover': {
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 10%, transparent)`,
    },
  },
});

export const contextMenuDivider = style({
  height: 1,
  background: glassStroke,
  margin: '4px 0',
});
