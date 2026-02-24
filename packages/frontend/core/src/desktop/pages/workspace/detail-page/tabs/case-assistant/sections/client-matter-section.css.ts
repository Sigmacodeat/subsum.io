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
