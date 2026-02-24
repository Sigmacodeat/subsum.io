import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';
export const root = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '8px',
  fontSize: cssVar('fontSm'),
  width: '100%',
  height: '34px',
  userSelect: 'none',
  cursor: 'pointer',
  padding: '0 12px 0 10px',
  position: 'relative',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  transition: 'border-color 0.15s ease, background 0.15s ease',
  ':hover': {
    background: cssVarV2('layer/background/hoverOverlay'),
    borderColor: cssVarV2('layer/insideBorder/blackBorder'),
  },
});
export const icon = style({
  marginRight: '12px',
  color: cssVarV2('icon/primary'),
  fontSize: '20px',
});
export const spacer = style({
  flex: 1,
});
export const shortcutHint = style({
  color: cssVarV2('text/tertiary'),
  fontSize: cssVar('fontBase'),
});
export const quickSearchBarEllipsisStyle = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
