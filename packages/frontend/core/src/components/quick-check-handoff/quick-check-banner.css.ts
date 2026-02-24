import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const banner = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  borderRadius: 8,
  margin: '8px 16px',
  background: cssVarV2.layer.background.hoverOverlay,
  border: `1px solid ${cssVar('borderColor')}`,
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2.text.primary,
  transition: 'opacity 0.2s',
});

export const scoreChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 40,
  height: 28,
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  color: '#fff',
  flexShrink: 0,
});

export const scoreHigh = style({
  background: '#16a34a',
});

export const scoreMedium = style({
  background: '#f59e0b',
});

export const scoreLow = style({
  background: '#ef4444',
});

export const content = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const title = style({
  fontWeight: 600,
  fontSize: 13,
});

export const subtitle = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
});

export const actions = style({
  display: 'flex',
  gap: 8,
  flexShrink: 0,
});

export const actionButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  transition: 'background 0.15s, opacity 0.15s',
  ':hover': {
    opacity: 0.85,
  },
});

export const primaryAction = style({
  background: cssVar('primaryColor'),
  color: '#fff',
});

export const dismissAction = style({
  background: 'transparent',
  color: cssVarV2.text.secondary,
  ':hover': {
    background: cssVarV2.layer.background.hoverOverlay,
  },
});
