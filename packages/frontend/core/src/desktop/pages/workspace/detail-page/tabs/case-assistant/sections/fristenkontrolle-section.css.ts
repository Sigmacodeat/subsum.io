import { createVar, style } from '@vanilla-extract/css';

export const widthVar = createVar();

export const approvalFill = style({
  vars: { [widthVar]: '0%' },
  width: widthVar,
});
