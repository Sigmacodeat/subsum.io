import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();

export const briefingCard = style({
  vars: {
    [borderVar]: glassStroke,
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  },
  borderRadius: 10,
  border: `0.5px solid ${borderVar}`,
  background: surfaceVar,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const briefingHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const briefingTitle = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const chipRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

export const briefingChip = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 10,
  fontWeight: 700,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 6px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const briefingList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

export const briefingItem = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 0',
  color: accentColorVar,
});

export const briefingBang = style({
  fontWeight: 700,
  flexShrink: 0,
});

export const briefingItemTitle = style({
  fontWeight: 600,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const briefingItemDue = style({
  fontSize: 10,
  opacity: 0.7,
  flexShrink: 0,
});

export const briefingMore = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontStyle: 'italic',
});

export const modeSwitcherTop = style({
  marginTop: 8,
});

export const deadlinesBlock = style({
  marginTop: 8,
});

export const deadlinesToggle = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const deadlinesHeading = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 11,
  fontWeight: 700,
  color: accentColorVar,
});

export const overdueBadge = style({
  vars: { [accentColorVar]: cssVarV2('status/error') },
  fontSize: 9,
  fontWeight: 700,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 3,
  padding: '1px 5px',
  border: `0.5px solid rgba(255, 59, 48, 0.28)`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const criticalBadge = style({
  vars: { [accentColorVar]: cssVarV2('status/error') },
  fontSize: 9,
  fontWeight: 700,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 3,
  padding: '1px 5px',
  border: `0.5px solid rgba(255, 59, 48, 0.28)`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const caret = style({
  fontSize: 9,
  opacity: 0.4,
  marginLeft: 'auto',
  color: cssVarV2('text/secondary'),
});

export const deadlinesList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const deadlineItem = style({
  vars: {
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
    [borderVar]: glassStroke,
  },
  padding: '7px 9px',
  borderRadius: 5,
  background: surfaceVar,
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const deadlineMain = style({
  flex: 1,
  minWidth: 0,
});

export const deadlineTitle = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const deadlineMeta = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  marginTop: 1,
  display: 'flex',
  gap: 6,
});

export const deadlineStatus = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  color: accentColorVar,
  fontWeight: 700,
});

export const deadlinePriority = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  color: accentColorVar,
  fontWeight: 600,
});

export const ackButton = style({
  padding: '2px 6px',
  fontSize: 9,
  borderRadius: 3,
  border: `0.5px solid ${glassStroke}`,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  flexShrink: 0,
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const prepareButton = style({
  padding: '2px 8px',
  fontSize: 9,
  borderRadius: 4,
  border: `0.5px solid color-mix(in srgb, ${cssVarV2('button/primary')} 36%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 10%, transparent)`,
  color: cssVarV2('button/primary'),
  cursor: 'pointer',
  flexShrink: 0,
  fontWeight: 700,
  selectors: {
    '&:hover': {
      background: `color-mix(in srgb, ${cssVarV2('button/primary')} 16%, transparent)`,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});
