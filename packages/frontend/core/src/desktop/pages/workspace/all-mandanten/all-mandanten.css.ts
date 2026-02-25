import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, keyframes, style } from '@vanilla-extract/css';

import {
  filterChipLowPriorityStyle,
  filterChipStyle,
  filterGroupRightStyle,
  filterGroupStyle,
  filterRowStyle,
  filterSegmentStyle,
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
  srOnlyLiveStyle,
  statusBadgeCompactStyle,
  statusToneArchivedStyle,
  statusToneClosedStyle,
  statusToneErrorStyle,
  statusToneIdleStyle,
  statusToneOpenStyle,
  statusToneWarningStyle,
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

const criticalTone = cssVarV2('status/error');
const urgentTone = 'var(--affine-warning-color, #f59e0b)';

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  containerName: 'mandanten-body',
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
    'mandanten-body (width <= 500px)': {
      paddingLeft: `${layoutGutterMd}px`,
      paddingRight: `${layoutGutterMd}px`,
    },
    'mandanten-body (width <= 393px)': {
      paddingLeft: `${layoutGutterSm}px`,
      paddingRight: `${layoutGutterSm}px`,
    },
  },
});

export const mandantRowCritical = style({
  boxShadow: `inset 4px 0 0 ${criticalTone}`,
  background: `linear-gradient(90deg, color-mix(in srgb, ${criticalTone} 10%, transparent) 0%, color-mix(in srgb, ${criticalTone} 4%, transparent) 38%, transparent 100%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(90deg, color-mix(in srgb, ${criticalTone} 14%, transparent) 0%, color-mix(in srgb, ${criticalTone} 7%, transparent) 40%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(90deg, color-mix(in srgb, ${criticalTone} 16%, transparent) 0%, color-mix(in srgb, ${criticalTone} 8%, transparent) 42%, transparent 100%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(90deg, color-mix(in srgb, ${criticalTone} 22%, transparent) 0%, color-mix(in srgb, ${criticalTone} 12%, transparent) 45%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const mandantRowUrgent = style({
  boxShadow: `inset 3px 0 0 ${urgentTone}`,
  background: `linear-gradient(90deg, color-mix(in srgb, ${urgentTone} 9%, transparent) 0%, color-mix(in srgb, ${urgentTone} 4%, transparent) 36%, transparent 100%)`,
  selectors: {
    '&:hover, &:focus-visible': {
      background: `linear-gradient(90deg, color-mix(in srgb, ${urgentTone} 13%, transparent) 0%, color-mix(in srgb, ${urgentTone} 7%, transparent) 40%, var(--affine-hover-color) 100%)`,
    },
    '[data-theme="dark"] &': {
      background: `linear-gradient(90deg, color-mix(in srgb, ${urgentTone} 14%, transparent) 0%, color-mix(in srgb, ${urgentTone} 7%, transparent) 40%, transparent 100%)`,
    },
    '[data-theme="dark"] &:hover, [data-theme="dark"] &:focus-visible': {
      background: `linear-gradient(90deg, color-mix(in srgb, ${urgentTone} 18%, transparent) 0%, color-mix(in srgb, ${urgentTone} 10%, transparent) 44%, var(--affine-hover-color) 100%)`,
    },
  },
});

export const linkedMatterBadgeOpen = style(statusToneOpenStyle);

export const linkedMatterBadgeClosed = style(statusToneClosedStyle);

export const linkedMatterBadgeArchived = style(statusToneArchivedStyle);

export const toolbarControl = style(toolbarControlStyle);

export const toolbarLabel = style(toolbarLabelStyle);

export const toolbarSelect = style(toolbarSelectStyle);

export const toolbarSortDirectionButton = style(
  toolbarSortDirectionButtonStyle
);

export const filterChipLowPriority = style(
  filterChipLowPriorityStyle('mandanten-body')
);

export const rowEditTriggerIcon = style({
  width: 14,
  height: 14,
  display: 'block',
});

export const mandantEditRow = style({
  display: 'grid',
  gridTemplateColumns: '34px 1fr 100px 140px 180px',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 10,
  alignItems: 'start',
  background: cssVarV2('layer/background/secondary'),
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  '@container': {
    'mandanten-body (width <= 700px)': {
      gridTemplateColumns: '34px 1fr 80px 160px',
    },
    'mandanten-body (width <= 500px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const editPanel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const editInputRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  '@container': {
    'mandanten-body (width <= 450px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const editInput = style({
  width: '100%',
  minWidth: 0,
  padding: '6px 10px',
  borderRadius: 8,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),
  fontSize: 12,
  lineHeight: '18px',
  outline: 'none',
  selectors: {
    '&:focus': {
      borderColor: cssVarV2('button/primary'),
      boxShadow:
        '0 0 0 2px color-mix(in srgb, var(--affine-primary-color) 22%, transparent)',
    },
  },
});

export const editSelect = style([
  editInput,
  {
    cursor: 'pointer',
  },
]);

export const editCheckboxLabel = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const editActions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  '@container': {
    'mandanten-body (width <= 450px)': {
      flexDirection: 'row',
    },
  },
});

const editButtonBase = style({
  appearance: 'none',
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  selectors: {
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  },
});

export const editButtonPrimary = style([
  editButtonBase,
  {
    color: cssVarV2('button/pureWhiteText'),
    borderColor: 'transparent',
    background: cssVarV2('button/primary'),
  },
]);

export const editButtonSecondary = style([
  editButtonBase,
  {
    color: cssVarV2('text/secondary'),
    background: 'transparent',
  },
]);

export const nextDeadlineText = style({
  fontWeight: 400,
  color: cssVarV2('text/secondary'),
  selectors: {
    '&[data-urgent="true"]': {
      fontWeight: 800,
      letterSpacing: '0.005em',
      color: urgentTone,
    },
    '[data-theme="dark"] &[data-urgent="true"]': {
      color: `color-mix(in srgb, ${urgentTone} 78%, var(--affine-text-primary-color))`,
    },
  },
});

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
    'mandanten-body (width <= 500px)': {
      margin: `8px ${layoutGutterMd}px 0`,
    },
  },
});

export const srOnlyLive = style(srOnlyLiveStyle);

export const mandantRowOpening = style({
  opacity: 0.6,
  pointerEvents: 'none',
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
    'mandanten-body (width <= 500px)': {
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

export const filterBar = style(stickyFilterBarStyle('mandanten-body'));

export const filterRow = style(filterRowStyle);

export const filterGroup = style(filterGroupStyle);

export const filterSegment = style(filterSegmentStyle);

export const filterGroupRight = style(filterGroupRightStyle('mandanten-body'));

export const filterChip = style(filterChipStyle);

export const primaryActionChip = style({
  ...filterChipStyle,
  minHeight: 30,
  padding: '5px 12px',
  fontWeight: 700,
  color: cssVarV2('button/pureWhiteText'),
  borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
  background: cssVarV2('button/primary'),
  boxShadow: `0 2px 10px color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
  selectors: {
    '&:hover:not(:disabled)': {
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 88%, var(--affine-background-primary-color))`,
      borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 42%, transparent)`,
      transform: 'translateY(-0.5px)',
      boxShadow: `0 4px 14px color-mix(in srgb, ${cssVarV2('button/primary')} 40%, transparent)`,
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

export const topActionRow = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  marginLeft: 'auto',
});

export const searchWrap = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flex: '1 1 240px',
  minWidth: 120,
  maxWidth: 360,
});

export const searchInput = style({
  ...searchInputStyle,
  width: '100%',
  '@container': {
    'mandanten-body (width <= 760px)': {
      maxWidth: '100%',
      minWidth: 0,
    },
  },
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

export const headerRow = style({
  display: 'grid',
  gridTemplateColumns: '34px 1fr 100px 140px 180px',
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
    'mandanten-body (width <= 700px)': {
      gridTemplateColumns: '34px 1fr 80px 160px',
    },
    'mandanten-body (width <= 500px)': {
      gridTemplateColumns: '34px 1fr 80px',
      padding: `6px ${layoutGutterMd}px 8px`,
    },
    'mandanten-body (width <= 393px)': {
      padding: `6px ${layoutGutterSm}px 8px`,
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

export const mandantRow = style({
  ...listRowBaseStyle,
  display: 'grid',
  gridTemplateColumns: '34px 1fr 100px 140px 180px',
  gap: 8,
  padding: `10px ${layoutGutter}px`,
  alignItems: 'center',
  borderBottom: rowDividerBorder,
  borderRadius: 0,
  selectors: {
    ...listRowBaseStyle.selectors,
    '&:last-child': {
      borderBottom: 'none',
    },
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor:
        'color-mix(in srgb, var(--affine-border-color) 70%, transparent)',
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
    'mandanten-body (width <= 700px)': {
      gridTemplateColumns: '34px 1fr 80px 160px',
    },
    'mandanten-body (width <= 500px)': {
      gridTemplateColumns: '34px 1fr 80px',
      padding: `10px ${layoutGutterMd}px`,
    },
    'mandanten-body (width <= 393px)': {
      padding: `10px ${layoutGutterSm}px`,
    },
  },
});

export const mandantMainCell = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
});

export const mandantNameRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
});

export const mandantKindIcon = style({
  width: 20,
  height: 20,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: `0.5px solid ${glassStroke}`,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
});

export const mandantKindIconPerson = style([
  mandantKindIcon,
  {
    color: cssVarV2('status/success'),
    background:
      'color-mix(in srgb, var(--affine-success-color, #10b981) 16%, var(--affine-background-primary-color))',
  },
]);

export const mandantKindIconCompany = style([
  mandantKindIcon,
  {
    color: cssVarV2('button/primary'),
    background:
      'color-mix(in srgb, var(--affine-primary-color) 14%, var(--affine-background-primary-color))',
  },
]);

export const mandantKindIconAuthority = style([
  mandantKindIcon,
  {
    color: cssVarV2('status/error'),
    background:
      'color-mix(in srgb, var(--affine-warning-color, #f59e0b) 18%, var(--affine-background-primary-color))',
  },
]);

export const mandantKindIconOther = style([
  mandantKindIcon,
  {
    color: cssVarV2('text/secondary'),
    background: cssVarV2('layer/background/secondary'),
  },
]);

export const mandantName = style({
  fontSize: 13,
  fontWeight: 600,
  lineHeight: '18px',
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.01em',
});

export const mandantSubtitle = style({
  fontSize: 12,
  lineHeight: '16px',
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

export const mandantMeta = style({
  fontSize: 12,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  overflow: 'visible',
  whiteSpace: 'normal',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 76%, var(--affine-text-secondary-color))',
    },
  },
  '@container': {
    'mandanten-body (width <= 700px)': {
      display: 'none',
    },
  },
});

export const mandantMetaHideSm = style({
  fontSize: 12,
  lineHeight: '16px',
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
    'mandanten-body (width <= 500px)': {
      display: 'none',
    },
  },
});

export const kindBadge = style(statusBadgeCompactStyle);

export const clientStateBadge = style(statusBadgeCompactStyle);

export const clientStateActive = style(statusToneClosedStyle);

export const clientStateCritical = style(statusToneErrorStyle);

export const clientStateCriticalStrong = style({
  fontWeight: 800,
  letterSpacing: '0.01em',
});

export const clientStateArchived = style(statusToneArchivedStyle);

export const clientStateIdle = style(statusToneIdleStyle);

export const mandantMetaActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  width: '100%',
});

export const rowEditTrigger = style({
  appearance: 'none',
  border: `0.5px solid ${glassStroke}`,
  borderRadius: 999,
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  padding: 0,
  cursor: 'pointer',
  transition: 'all 0.12s ease',
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 82%, var(--affine-text-secondary-color))',
      borderColor:
        'color-mix(in srgb, var(--affine-theme-secondary-soft, rgba(6, 182, 212, 0.14)) 50%, rgba(255, 255, 255, 0.12))',
    },
    '&:hover': {
      color: cssVarV2('text/primary'),
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
});

export const kindPerson = style(statusToneOpenStyle);

export const kindCompany = style(statusToneClosedStyle);

export const kindAuthority = style(statusToneWarningStyle);

export const kindOther = style(statusToneIdleStyle);

export const aktenCount = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '18px',
  background: cssVarV2('layer/background/secondary'),
  color: cssVarV2('text/primary'),
});

export const docCountText = style({
  marginLeft: 8,
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  selectors: {
    '[data-theme="dark"] &': {
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 74%, var(--affine-text-secondary-color))',
    },
  },
});

export const linkedMatterRow = style({
  marginTop: 6,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
  minWidth: 0,
});

export const linkedMatterBadge = style({
  ...statusBadgeCompactStyle,
  maxWidth: 'min(260px, 100%)',
  minWidth: 0,
});

export const mandantComplianceRow = style({
  marginTop: 4,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
});

export const complianceBadge = style({
  ...statusBadgeCompactStyle,
  fontSize: 10,
  lineHeight: '14px',
});

export const complianceBadgeOk = style(statusToneOpenStyle);

export const complianceBadgeMissing = style(statusToneErrorStyle);

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
      color:
        'color-mix(in srgb, var(--affine-text-primary-color) 74%, var(--affine-text-secondary-color))',
    },
  },
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

// Global styles for SVG icons within mandantKindIcon
globalStyle(`${mandantKindIcon} svg`, {
  width: 12,
  height: 12,
  display: 'block',
});
