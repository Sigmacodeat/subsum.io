import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

export const accentVar = createVar();
export const surfaceVar = createVar();

export const conflictEventCard = style({
  vars: {
    [accentVar]: cssVarV2('text/secondary'),
    [surfaceVar]: cssVarV2('layer/background/secondary'),
  },
  background: surfaceVar,
  borderLeft: `3px solid ${accentVar}`,
});

export const sourceLabel = style({
  vars: { [accentVar]: cssVarV2('text/secondary') },
  color: accentVar,
});

export const timelineItem = style({
  vars: {
    [accentVar]: cssVarV2('text/secondary'),
    [surfaceVar]: cssVarV2('layer/background/secondary'),
  },
  background: surfaceVar,
  borderLeft: `3px solid ${accentVar}`,
});

export const timelineBadge = style({
  vars: {
    [accentVar]: cssVarV2('text/secondary'),
    [surfaceVar]: cssVarV2('layer/background/secondary'),
  },
  color: accentVar,
  background: surfaceVar,
});
