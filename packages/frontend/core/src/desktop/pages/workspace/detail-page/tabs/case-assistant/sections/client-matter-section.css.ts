import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const refRow = style({
  display: 'flex',
  gap: 4,
  alignItems: 'stretch',
});

export const refInputGrow = style({
  flex: 1,
});

export const nextAzButton = style({
  fontSize: 10,
  whiteSpace: 'nowrap',
  padding: '2px 6px',
});

export const matterClientsSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: `color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 50%, transparent)`,
});

export const matterClientsSectionLabel = style({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: cssVarV2('text/secondary'),
  lineHeight: '14px',
});

export const matterClientChipList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
});

export const matterClientChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  height: 24,
  padding: '0 6px 0 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '14px',
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  whiteSpace: 'nowrap',
  selectors: {
    '&[data-primary="true"]': {
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 10%, ${cssVarV2('layer/background/primary')})`,
      borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 28%, transparent)`,
    },
  },
});

export const matterClientChipLabel = style({
  fontSize: 11,
  lineHeight: '14px',
  maxWidth: 140,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const matterClientChipPrimaryTag = style({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.04em',
  color: cssVarV2('button/primary'),
  textTransform: 'uppercase',
});

export const matterClientChipRemove = style({
  appearance: 'none',
  background: 'transparent',
  border: 0,
  padding: 0,
  margin: 0,
  width: 14,
  height: 14,
  borderRadius: '50%',
  fontSize: 13,
  lineHeight: '14px',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'color 0.1s ease, background 0.1s ease',
  selectors: {
    '&:hover': {
      color: cssVarV2('status/error'),
      background: `color-mix(in srgb, ${cssVarV2('status/error')} 12%, transparent)`,
    },
  },
});

export const addClientToMatterRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
});

export const addClientToMatterLabel = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
});
