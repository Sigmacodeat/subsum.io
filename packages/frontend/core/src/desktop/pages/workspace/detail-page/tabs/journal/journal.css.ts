import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style, styleVariants } from '@vanilla-extract/css';

import {
  glassFill,
  glassStroke,
  interactionTransition,
} from '../../../layouts/workspace-list-shared-styles';

const interactive = style({
  position: 'relative',
  cursor: 'pointer',
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      backgroundColor:
        'color-mix(in srgb, var(--affine-hover-color, rgba(255, 255, 255, 0.06)) 40%, transparent)',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      opacity: 0,
      borderRadius: 'inherit',
      boxShadow: `0 0 0 3px ${cssVar('primaryColor')}`,
      pointerEvents: 'none',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      boxShadow: `0 0 0 0px ${cssVar('primaryColor')}`,
      pointerEvents: 'none',
    },
    '&:focus-visible::before': {
      opacity: 0.2,
    },
    '&:focus-visible::after': {
      boxShadow: `0 0 0 1px ${cssVar('primaryColor')}`,
    },
  },
});
export const calendar = style({
  padding: '16px',
  paddingBottom: 0,
  marginBottom: 10,
  selectors: {
    '&[data-mobile=true]': {
      padding: '8px 16px',
      marginBottom: 0,
    },
  },
});
export const journalPanel = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  overflow: 'hidden',
});
export const dailyCount = style({
  height: 0,
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});
export const dailyCountHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  gap: 8,
});
export const dailyCountNav = style([
  interactive,
  {
    minHeight: 32,
    width: 0,
    flex: 1,
    fontWeight: 600,
    fontSize: 13,
    padding: '5px 10px',
    whiteSpace: 'nowrap',
    borderRadius: 10,
    border: `0.5px solid ${glassStroke}`,
    background:
      `${glassFill}, color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)`,
    color: cssVarV2('text/primary'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: interactionTransition,
    selectors: {
      '&[aria-selected="true"]': {
        background:
          `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('button/primary')} 68%, var(--affine-background-primary-color) 32%) 0%, color-mix(in srgb, ${cssVarV2('button/primary')} 56%, var(--affine-background-primary-color) 44%) 100%)`,
        color: cssVarV2('button/pureWhiteText'),
        borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
        boxShadow: '0 6px 16px color-mix(in srgb, var(--affine-primary-color) 18%, rgba(0, 0, 0, 0.16))',
      },
    },
  },
]);
export const dailyCountContainer = style({
  height: 0,
  flexGrow: 1,
  display: 'flex',
  width: `calc(var(--item-count) * 100%)`,
  transition: 'transform .15s ease',
  transform:
    'translateX(calc(var(--active-index) * 100% / var(--item-count) * -1))',
});
export const dailyCountItem = style({
  width: 'calc(100% / var(--item-count))',
  height: '100%',
});
export const dailyCountContent = style({
  padding: '8px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});
export const dailyCountEmpty = style({
  width: '100%',
  height: '100%',
  maxHeight: 220,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: '24px',
  fontSize: 15,
  color: cssVar('textSecondaryColor'),
  textAlign: 'center',
  padding: '0 70px',
  fontWeight: 400,
});

// page item
export const pageItem = style([
  interactive,
  {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 8,
    padding: '0 8px',
    gap: 8,
    minHeight: 32,
    border: `0.5px solid transparent`,
    selectors: {
      '&[aria-selected="true"]': {
        background:
          'color-mix(in srgb, var(--affine-hover-color, rgba(255, 255, 255, 0.06)) 40%, transparent)',
        borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
      },
    },
  },
]);
export const pageItemIcon = style({
  width: 20,
  height: 20,
  color: cssVar('iconColor'),
});
export const pageItemLabel = style({
  width: 0,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 500,
  fontSize: cssVar('fontSm'),
  color: cssVar('textPrimaryColor'),
  textAlign: 'left',
  selectors: {
    '[aria-selected="true"] &': {
      // TODO(@catsjuice): wait for design
      color: cssVar('primaryColor'),
    },
  },
  display: 'flex',
  gap: 6,
  alignItems: 'center',
});

// conflict
export const journalConflictBlock = style({
  padding: '0 16px 16px 16px',
});
export const journalConflictWrapper = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
  rowGap: 4,
  columnGap: 8,
});
export const journalConflictMoreTrigger = style([
  interactive,
  {
    color: cssVar('textSecondaryColor'),
    minHeight: 32,
    borderRadius: 8,
    border: `0.5px solid ${glassStroke}`,
    background:
      `${glassFill}, color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)`,
    padding: '0px 8px',
    fontSize: cssVar('fontSm'),
    display: 'flex',
    alignItems: 'center',
  },
]);
export const duplicateTag = style({
  padding: '0 8px',
  border: `1px solid ${cssVarV2('database/border')}`,
  background: cssVarV2('layer/background/error'),
  color: cssVarV2('toast/iconState/error'),
  borderRadius: 8,
  fontSize: cssVar('fontXs'),
  lineHeight: '20px',
  fontWeight: 400,
});

// customize date-picker cell
export const journalDateCell = style([
  interactive,
  {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    fontSize: cssVar('fontSm'),
    color: cssVar('textPrimaryColor'),
    fontWeight: 400,
    position: 'relative',

    selectors: {
      '&[data-is-today="true"]': {
        fontWeight: 600,
        color: cssVar('brandColor'),
      },
      '&[data-not-current-month="true"]': {
        color: cssVar('black10'),
      },
      '&[data-selected="true"]': {
        backgroundColor: cssVar('brandColor'),
        fontWeight: 500,
        color: cssVar('pureWhite'),
      },
      '&[data-is-journal="false"][data-selected="true"]': {
        backgroundColor: 'transparent',
        color: 'var(--affine-text-primary-color)',
        fontWeight: 500,
        border: `1px solid ${cssVar('primaryColor')}`,
      },

      '&[data-mobile=true]': {
        width: 34,
        height: 34,
        fontSize: 15,
        fontWeight: 400,
      },
    },
  },
]);
export const journalDateCellDotContainer = style({
  display: 'flex',
  gap: 4,
  justifyContent: 'center',
  marginTop: 4,
});
export const journalDateCellDot = style({
  width: 4,
  height: 4,
  borderRadius: '50%',
});
export const journalDateCellDotType = styleVariants({
  journal: {
    backgroundColor: cssVarV2.calendar.blue,
  },
  event: {
    backgroundColor: cssVarV2.calendar.green,
  },
  activity: {
    backgroundColor: cssVarV2.calendar.red,
  },
});
