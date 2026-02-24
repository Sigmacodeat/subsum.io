import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  alignItems: 'center',
  columnGap: '6px',
  padding: '0 2px',
});

export const button = style({
  width: '30px',
  height: '30px',
  flexShrink: 0,
  borderRadius: 8,
});
