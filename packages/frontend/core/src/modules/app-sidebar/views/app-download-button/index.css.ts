import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export { closeIcon, ellipsisTextOverflow } from '../app-updater-button/index.css';

export const root = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '6px',
  fontSize: cssVar('fontSm'),
  width: '100%',
  height: '32px',
  userSelect: 'none',
  cursor: 'pointer',
  padding: '0 4px',
  position: 'relative',
  color: cssVarV2('text/secondary'),
  background: 'transparent',
  border: 'none',
  transition: 'background 0.12s ease, color 0.12s ease',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      color: cssVarV2('text/primary'),
    },
  },
});

export const rootPadding = style({
  padding: '0 4px',
});

export const icon = style({
  marginRight: '8px',
  color: 'inherit',
  fontSize: '18px',
  flexShrink: 0,
});

export const halo = style({});
export const particles = style({});

export const label = style({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: '100%',
  fontSize: cssVar('fontSm'),
  whiteSpace: 'nowrap',
  gap: 8,
});
