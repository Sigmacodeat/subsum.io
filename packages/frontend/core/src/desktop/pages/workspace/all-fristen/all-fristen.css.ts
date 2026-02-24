import { cssVarV2 } from '@toeverything/theme/v2';
import { keyframes, style } from '@vanilla-extract/css';

import {
  filterChipLowPriorityStyle,
  filterChipStyle,
  filterGroupRightStyle,
  filterGroupStyle,
  filterRowStyle,
  interactionTransition,
  layoutGutter,
  layoutGutterMd,
  layoutGutterSm,
  listRowBaseStyle,
  rowDividerBorder,
  searchInputStyle,
  sortButtonStyle,
  srOnlyLiveStyle,
  statusBadgeCompactStyle,
  statusToneClosedStyle,
  statusToneErrorStyle,
  statusToneOpenStyle,
  stickyFilterBarStyle,
  surfaceEnter,
  toolbarControlStyle,
  toolbarLabelStyle,
  toolbarSelectStyle,
  toolbarSortDirectionButtonStyle,
  workspaceAmbientBackground,
} from '../layouts/workspace-list-shared-styles';

const skeletonShimmer = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
});

const hardAlertPulse = keyframes({
  '0%, 100%': {
    boxShadow: `0 0 0 0 color-mix(in srgb, ${cssVarV2('status/error')} 0%, transparent)`,
  },
  '50%': {
    boxShadow: `0 0 0 1px color-mix(in srgb, ${cssVarV2('status/error')} 18%, transparent)`,
  },
});

const overdueTone = cssVarV2('status/error');
const todayTone =
  'color-mix(in srgb, var(--affine-theme-link, var(--affine-primary-color)) 58%, var(--affine-text-primary-color))';
const soonTone =
  'color-mix(in srgb, var(--affine-theme-accent, var(--affine-primary-color)) 58%, var(--affine-text-primary-color))';
const lightTodayTextTone =
  'color-mix(in srgb, var(--affine-theme-link, var(--affine-primary-color)) 72%, var(--affine-text-primary-color))';
const lightSoonTextTone =
  'color-mix(in srgb, var(--affine-theme-accent, var(--affine-primary-color)) 70%, var(--affine-text-primary-color))';
const lightTodaySurfaceTone = `color-mix(in srgb, ${todayTone} 8%, transparent)`;
const lightSoonSurfaceTone = `color-mix(in srgb, ${soonTone} 6%, transparent)`;

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  containerName: 'fristen-body',
  containerType: 'size',
  background: workspaceAmbientBackground,
});

export const scrollArea = style({
  height: 0,
  flex: 1,
  paddingTop: '4px',
  paddingBottom: 'max(72px, env(safe-area-inset-bottom, 0px))',
  paddingLeft: `${layoutGutter}px`,
  paddingRight: `${layoutGutter}px`,
  scrollPaddingBottom: 'max(80px, env(safe-area-inset-bottom, 0px))',
  overflowY: 'auto',
  '@container': {
    'fristen-body (width <= 500px)': {
      paddingLeft: `${layoutGutterMd}px`,
      paddingRight: `${layoutGutterMd}px`,
    },
    'fristen-body (width <= 393px)': {
      paddingLeft: `${layoutGutterSm}px`,
      paddingRight: `${layoutGutterSm}px`,
    },
  },
});

export const urgencyCritical = style({
  color: `color-mix(in srgb, ${overdueTone} 92%, var(--affine-text-primary-color))`,
  fontWeight: 800,
  borderColor: `color-mix(in srgb, ${overdueTone} 46%, transparent)`,
  background: `color-mix(in srgb, ${overdueTone} 16%, transparent)`,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${overdueTone} 82%, var(--affine-text-primary-color))`,
      borderColor: `color-mix(in srgb, ${overdueTone} 54%, transparent)`,
      background: `color-mix(in srgb, ${overdueTone} 22%, transparent)`,
    },
  },
});

export const dueDateCritical = style({
  color: `color-mix(in srgb, ${cssVarV2('status/error')} 90%, var(--affine-text-primary-color))`,
  fontWeight: 800,
  letterSpacing: '0.012em',
  textTransform: 'uppercase',
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${cssVarV2('status/error')} 78%, var(--affine-text-primary-color))`,
    },
  },
});

export const fristRowCritical = style({
  background: `linear-gradient(102deg, color-mix(in srgb, ${overdueTone} 9%, transparent) 0%, color-mix(in srgb, ${overdueTone} 4%, transparent) 28%, transparent 72%)`,
  borderColor: `color-mix(in srgb, ${overdueTone} 24%, var(--affine-border-color))`,
  animation: `${hardAlertPulse} 1.8s ease-in-out infinite`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(102deg, color-mix(in srgb, ${overdueTone} 12%, transparent) 0%, color-mix(in srgb, ${overdueTone} 5.5%, transparent) 32%, var(--affine-hover-color) 100%)`,
      borderColor: `color-mix(in srgb, ${overdueTone} 34%, var(--affine-border-color))`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(102deg, color-mix(in srgb, ${overdueTone} 13%, transparent) 0%, color-mix(in srgb, ${overdueTone} 6.5%, transparent) 34%, transparent 74%)`,
      borderColor: `color-mix(in srgb, ${overdueTone} 30%, var(--affine-border-color))`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(102deg, color-mix(in srgb, ${overdueTone} 16%, transparent) 0%, color-mix(in srgb, ${overdueTone} 8%, transparent) 36%, var(--affine-hover-color) 100%)`,
      borderColor: `color-mix(in srgb, ${overdueTone} 40%, var(--affine-border-color))`,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const deadlineInsightRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 4,
  alignItems: 'center',
});

export const deadlineConfidenceBadge = style({
  fontSize: 9,
  lineHeight: '13px',
  fontWeight: 700,
  borderRadius: 999,
  padding: '1px 7px',
  border: '1px solid transparent',
  color: cssVarV2('text/secondary'),
  selectors: {
    '&[data-tone="high"]': {
      color:
        'color-mix(in srgb, var(--affine-v2-status-success, #10b981) 68%, var(--affine-text-primary-color))',
      borderColor:
        'color-mix(in srgb, var(--affine-v2-status-success, #10b981) 36%, transparent)',
      background:
        'color-mix(in srgb, var(--affine-v2-status-success, #10b981) 12%, transparent)',
    },
    '&[data-tone="medium"]': {
      color:
        'color-mix(in srgb, var(--affine-v2-status-warning, #f59e0b) 72%, var(--affine-text-primary-color))',
      borderColor:
        'color-mix(in srgb, var(--affine-v2-status-warning, #f59e0b) 38%, transparent)',
      background:
        'color-mix(in srgb, var(--affine-v2-status-warning, #f59e0b) 12%, transparent)',
    },
    '&[data-tone="low"]': {
      color:
        'color-mix(in srgb, var(--affine-v2-status-error, #ef4444) 70%, var(--affine-text-primary-color))',
      borderColor:
        'color-mix(in srgb, var(--affine-v2-status-error, #ef4444) 38%, transparent)',
      background:
        'color-mix(in srgb, var(--affine-v2-status-error, #ef4444) 10%, transparent)',
    },
  },
});

export const deadlineReviewBadge = style({
  fontSize: 9,
  lineHeight: '13px',
  fontWeight: 700,
  borderRadius: 999,
  padding: '1px 7px',
  color: cssVarV2('text/primary'),
  border:
    '1px solid color-mix(in srgb, var(--affine-v2-status-warning, #f59e0b) 40%, transparent)',
  background:
    'color-mix(in srgb, var(--affine-v2-status-warning, #f59e0b) 14%, transparent)',
});

export const deadlineReviewAction = style({
  appearance: 'none',
  margin: 0,
  font: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 9,
  lineHeight: '13px',
  fontWeight: 700,
  borderRadius: 999,
  padding: '1px 7px',
  color: cssVarV2('button/primary'),
  border: `1px solid color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 11%, transparent)`,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 16%, transparent)`,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
      boxShadow: `0 0 0 1px color-mix(in srgb, ${cssVarV2('button/primary')} 24%, transparent)`,
    },
  },
});

export const deadlineSourceTag = style({
  fontSize: 9,
  lineHeight: '13px',
  fontWeight: 600,
  borderRadius: 999,
  padding: '1px 7px',
  color: cssVarV2('text/secondary'),
  border:
    '1px solid color-mix(in srgb, var(--affine-border-color) 72%, transparent)',
  background:
    'color-mix(in srgb, var(--affine-background-secondary-color) 78%, transparent)',
});

export const deadlineEvidencePreview = style({
  marginTop: 3,
  fontSize: 9,
  lineHeight: '13px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 'min(640px, 72vw)',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 72%, var(--affine-text-secondary-color))',
    },
  },
});

export const deadlineReviewedMeta = style({
  marginTop: 3,
  fontSize: 9,
  lineHeight: '13px',
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 70%, var(--affine-text-secondary-color))',
    },
  },
});

export const toolbarControl = style({
  ...toolbarControlStyle,
  minHeight: 28,
  padding: '2px 8px',
  borderRadius: 11,
  gap: 4,
});

export const toolbarLabel = style({
  ...toolbarLabelStyle,
  fontSize: 11,
  lineHeight: '16px',
});

export const toolbarSelect = style({
  ...toolbarSelectStyle,
  fontSize: 11,
  lineHeight: '16px',
  minHeight: 20,
});

export const toolbarSortDirectionButton = style({
  ...toolbarSortDirectionButtonStyle,
  width: 28,
  minWidth: 28,
  height: 28,
  borderRadius: 11,
  fontSize: 11,
});

export const filterChipLowPriority = style(
  filterChipLowPriorityStyle('fristen-body')
);

export const srOnlyLive = style(srOnlyLiveStyle);

export const actionStatus = style({
  margin: `8px ${layoutGutter}px 0`,
  padding: '7px 11px',
  borderRadius: 10,
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/secondary'),
  border: '1px solid var(--affine-border-color)',
  '@container': {
    'fristen-body (width <= 500px)': {
      margin: `6px ${layoutGutterMd}px 0`,
    },
  },
});

export const filterBar = style({
  ...stickyFilterBarStyle('fristen-body'),
  marginTop: 6,
  paddingTop: 10,
  paddingBottom: 8,
  gap: 6,
  '@container': {
    'fristen-body (width <= 500px)': {
      marginTop: 4,
      padding: `7px ${layoutGutterMd}px 8px`,
    },
    'fristen-body (width <= 393px)': {
      marginTop: 3,
    },
  },
});

export const filterRow = style({
  ...filterRowStyle,
  gap: 6,
});

export const filterGroup = style({
  ...filterGroupStyle,
  gap: 5,
});

export const filterGroupRight = style({
  ...filterGroupRightStyle('fristen-body'),
  gap: 6,
});

export const filterChip = style({
  ...filterChipStyle,
  minHeight: 28,
  padding: '3px 9px',
  borderRadius: 13,
  fontSize: 11,
  lineHeight: '16px',
});

export const searchWrap = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flex: '1 1 200px',
  minWidth: 120,
  maxWidth: 280,
});

export const searchInput = style({
  ...searchInputStyle,
  width: '100%',
  minHeight: 28,
  padding: '5px 9px',
  borderRadius: 6,
  fontSize: 11,
  lineHeight: '16px',
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
  fontSize: 11,
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

export const listContainer = style({
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  marginTop: 6,
  backdropFilter: 'none',
  boxShadow: 'none',
  overflow: 'visible',
  animation: `${surfaceEnter} 280ms cubic-bezier(0.22, 1, 0.36, 1) both`,
  transition: interactionTransition,
  '@container': {
    'fristen-body (width <= 500px)': {
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

export const headerRow = style({
  display: 'grid',
  gridTemplateColumns: '34px 1fr 140px 160px 120px 120px',
  gap: 5,
  padding: `5px ${layoutGutter}px 7px`,
  fontSize: 9,
  fontWeight: 700,
  lineHeight: '12px',
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: `1px solid color-mix(in srgb, var(--affine-border-color) 80%, transparent)`,
  '@container': {
    'fristen-body (width <= 700px)': {
      gridTemplateColumns: '34px 1fr 120px 120px',
    },
    'fristen-body (width <= 500px)': {
      gridTemplateColumns: '34px 1fr 120px',
      padding: `5px ${layoutGutterMd}px 7px`,
    },
    'fristen-body (width <= 393px)': {
      padding: `5px ${layoutGutterSm}px 7px`,
    },
  },
});

export const selectionCell = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const selectionCheckbox = style({
  width: 15,
  height: 15,
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

export const sortButton = style(sortButtonStyle);

export const fristRow = style({
  ...listRowBaseStyle,
  display: 'grid',
  gridTemplateColumns: '34px 1fr 140px 160px 120px 120px',
  gap: 5,
  padding: `7px ${layoutGutter}px`,
  border: rowDividerBorder,
  borderRadius: 10,
  selectors: {
    ...listRowBaseStyle.selectors,
    [`${headerRow} + &`]: {
      marginTop: 7,
    },
    '& + &': {
      marginTop: 10,
    },
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor:
        'color-mix(in srgb, var(--affine-border-color) 70%, transparent)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -1,
      background: 'var(--affine-hover-color)',
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 0 0 1px color-mix(in srgb, ${cssVarV2('button/primary')} 26%, transparent)`,
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  },
  '@container': {
    'fristen-body (width <= 700px)': {
      gridTemplateColumns: '34px 1fr 120px 120px',
    },
    'fristen-body (width <= 500px)': {
      gridTemplateColumns: '34px 1fr 120px',
      padding: `7px ${layoutGutterMd}px`,
    },
    'fristen-body (width <= 393px)': {
      padding: `7px ${layoutGutterSm}px`,
    },
  },
});

export const fristMainCell = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
});

export const fristRowOverdue = style({
  background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 4%, transparent) 0%, color-mix(in srgb, ${overdueTone} 1.8%, transparent) 26%, transparent 66%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 6.5%, transparent) 0%, color-mix(in srgb, ${overdueTone} 2.8%, transparent) 30%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 5%, transparent) 0%, color-mix(in srgb, ${overdueTone} 2%, transparent) 28%, transparent 68%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${overdueTone} 7%, transparent) 0%, color-mix(in srgb, ${overdueTone} 2.5%, transparent) 32%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const fristRowToday = style({
  background: `linear-gradient(100deg, color-mix(in srgb, ${todayTone} 9%, transparent) 0%, color-mix(in srgb, ${todayTone} 4.2%, transparent) 34%, transparent 74%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${todayTone} 12%, transparent) 0%, color-mix(in srgb, ${todayTone} 6%, transparent) 38%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${todayTone} 10%, transparent) 0%, color-mix(in srgb, ${todayTone} 5%, transparent) 34%, transparent 74%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${todayTone} 14%, transparent) 0%, color-mix(in srgb, ${todayTone} 7%, transparent) 38%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const fristRowSoon = style({
  background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 7%, transparent) 0%, color-mix(in srgb, ${soonTone} 3.2%, transparent) 32%, transparent 74%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 9.5%, transparent) 0%, color-mix(in srgb, ${soonTone} 4%, transparent) 36%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 8%, transparent) 0%, color-mix(in srgb, ${soonTone} 3%, transparent) 32%, transparent 72%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(100deg, color-mix(in srgb, ${soonTone} 11%, transparent) 0%, color-mix(in srgb, ${soonTone} 5%, transparent) 36%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const fristTitle = style({
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '15px',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.01em',
});

export const dueDate = style({
  fontSize: 10,
  fontWeight: 500,
  color: cssVarV2('text/primary'),
  lineHeight: '14px',
});

export const dueDateOverdue = style({
  color: `color-mix(in srgb, ${cssVarV2('status/error')} 82%, var(--affine-text-primary-color))`,
  fontWeight: 700,
  letterSpacing: '0.01em',
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${cssVarV2('status/error')} 62%, var(--affine-text-primary-color))`,
    },
  },
});

export const dueDateToday = style({
  color: lightTodayTextTone,
  fontWeight: 800,
  letterSpacing: '0.005em',
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${todayTone} 76%, var(--affine-text-primary-color))`,
    },
  },
});

export const dueDateSoon = style({
  color:
    'color-mix(in srgb, var(--affine-theme-accent, var(--affine-primary-color)) 66%, var(--affine-text-primary-color))',
  fontWeight: 700,
});

export const fristSubtitle = style({
  fontSize: 10,
  lineHeight: '14px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 80%, var(--affine-text-secondary-color))',
    },
  },
});

export const fristMeta = style({
  fontSize: 10,
  lineHeight: '14px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 76%, var(--affine-text-secondary-color))',
    },
  },
  '@container': {
    'fristen-body (width <= 700px)': {
      display: 'none',
    },
  },
});

export const fristMetaHideSm = style({
  fontSize: 10,
  lineHeight: '14px',
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 76%, var(--affine-text-secondary-color))',
    },
  },
  '@container': {
    'fristen-body (width <= 500px)': {
      display: 'none',
    },
  },
});

export const urgencyBadge = style({
  ...statusBadgeCompactStyle,
  background: cssVarV2('layer/background/primary'),
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor:
    'color-mix(in srgb, var(--affine-border-color) 74%, transparent)',
  fontWeight: 700,
});

export const urgencyOverdue = style({
  color: `color-mix(in srgb, ${overdueTone} 86%, var(--affine-text-primary-color))`,
  fontWeight: 700,
  borderColor: `color-mix(in srgb, ${overdueTone} 30%, transparent)`,
  background: `color-mix(in srgb, ${overdueTone} 10%, transparent)`,
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${overdueTone} 64%, var(--affine-text-primary-color))`,
      borderColor: `color-mix(in srgb, ${overdueTone} 32%, transparent)`,
      background: `color-mix(in srgb, ${overdueTone} 10%, transparent)`,
    },
  },
});

export const urgencyToday = style({
  color: lightTodayTextTone,
  fontWeight: 800,
  borderColor: `color-mix(in srgb, ${todayTone} 40%, transparent)`,
  background: lightTodaySurfaceTone,
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${todayTone} 74%, var(--affine-text-primary-color))`,
      borderColor: `color-mix(in srgb, ${todayTone} 42%, transparent)`,
    },
  },
});

export const urgencySoon = style({
  color: lightSoonTextTone,
  fontWeight: 600,
  borderColor: `color-mix(in srgb, ${soonTone} 40%, transparent)`,
  background: lightSoonSurfaceTone,
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${soonTone} 72%, var(--affine-text-primary-color))`,
      borderColor: `color-mix(in srgb, ${soonTone} 42%, transparent)`,
    },
  },
});

export const urgencyNormal = style({
  color: cssVarV2('text/primary'),
  borderColor:
    'color-mix(in srgb, var(--affine-v2-status-success, #10b981) 34%, transparent)',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 82%, var(--affine-text-secondary-color))',
    },
  },
});

export const statusBadge = style(statusBadgeCompactStyle);

export const statusPending = style(statusToneOpenStyle);

export const statusCompleted = style(statusToneClosedStyle);

export const statusExpired = style(statusToneErrorStyle);

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '56px 24px',
  textAlign: 'center',
});

export const emptyTitle = style({
  fontSize: 16,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.01em',
});

export const emptyDescription = style({
  fontSize: 14,
  color: cssVarV2('text/secondary'),
  maxWidth: 360,
  lineHeight: '22px',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 74%, var(--affine-text-secondary-color))',
    },
  },
});

export const skeletonRow = style({
  height: 40,
  borderRadius: 0,
  borderBottom: rowDividerBorder,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
  backgroundSize: '200% 100%',
  animation: `${skeletonShimmer} 1.2s ease-in-out infinite`,
});
