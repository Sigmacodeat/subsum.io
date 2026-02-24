import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';
export const browserWarningStyle = style({
  backgroundColor: cssVar('backgroundWarningColor'),
  color: cssVar('warningColor'),
  width: '100%',
  padding: '8px 16px',
  fontSize: cssVar('fontSm'),
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'absolute',
  zIndex: 1,
});
export const closeButtonStyle = style({
  width: '36px',
  height: '36px',
  color: cssVar('iconColor'),
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  position: 'absolute',
  right: '16px',
});
export const closeIconStyle = style({
  width: '15px',
  height: '15px',
  position: 'relative',
  zIndex: 1,
});
export const tipsContainer = style({
  background:
    `linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)), ${cssVar('backgroundWarningColor')}`,
  color: cssVar('warningColor'),
  width: '100%',
  fontSize: cssVar('fontSm'),
  fontWeight: '600',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 14px',
  position: 'absolute',
  zIndex: 1,
  gap: '16px',
  borderBottom: `1px solid ${cssVar('borderColor')}`,
  containerType: 'inline-size',
  '@media': {
    'screen and (max-width: 520px)': {
      flexWrap: 'wrap',
    },
  },
});
export const tipsMessage = style({
  color: cssVar('warningColor'),
  lineHeight: 1.35,
  flexGrow: 1,
  flexShrink: 1,
});
export const tipsRightItem = style({
  display: 'flex',
  flexShrink: 0,
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  '@media': {
    'screen and (max-width: 520px)': {
      width: '100%',
    },
  },
});
