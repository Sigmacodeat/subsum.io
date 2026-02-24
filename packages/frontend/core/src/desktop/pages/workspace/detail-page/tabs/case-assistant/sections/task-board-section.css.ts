import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();
export const opacityVar = createVar();

export const headerMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const emptyState = style({
  padding: '16px 0',
  textAlign: 'center',
});

export const emptyIcon = style({
  fontSize: 24,
  marginBottom: 6,
});

export const emptyTitle = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const emptyHint = style({
  fontSize: 11,
  opacity: 0.6,
  marginTop: 3,
  color: cssVarV2('text/secondary'),
});

export const filterRow = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginBottom: 10,
});

export const filterButton = style({
  padding: '3px 8px',
  fontSize: 9,
  borderRadius: 4,
  cursor: 'pointer',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  fontWeight: 500,
});

export const filterButtonActive = style({
  vars: {
    [accentColorVar]: cssVarV2('button/primary'),
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  },
  borderColor: accentColorVar,
  background: surfaceVar,
  color: accentColorVar,
  fontWeight: 700,
});

export const taskList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

export const taskCard = style({
  vars: {
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
    [borderVar]: glassStroke,
  },
  borderRadius: 7,
  border: `0.5px solid ${borderVar}`,
  background: surfaceVar,
  backdropFilter: 'blur(12px) saturate(140%)',
  overflow: 'hidden',
});

export const taskHeaderButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
});

export const col = style({
  flex: 1,
  minWidth: 0,
});

export const headerTagRow = style({
  display: 'flex',
  gap: 5,
  alignItems: 'center',
  marginBottom: 3,
  flexWrap: 'wrap',
});

export const statusChip = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
    [borderVar]: glassStroke,
  },
  fontSize: 9,
  fontWeight: 700,
  color: accentColorVar,
  background: surfaceVar,
  borderRadius: 3,
  padding: '1px 5px',
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  flexShrink: 0,
});

export const priorityText = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  fontSize: 9,
  fontWeight: 700,
  color: accentColorVar,
  flexShrink: 0,
});

export const assignee = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const taskTitle = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const taskTitleExpanded = style({
  whiteSpace: 'normal',
});

export const caret = style({
  fontSize: 9,
  opacity: 0.4,
  flexShrink: 0,
  marginTop: 2,
});

export const expandedBody = style({
  padding: '0 10px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const description = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  padding: '5px 8px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  borderRadius: 4,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const assigneeLabel = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const assigneeInput = style({
  fontSize: 10,
  padding: '3px 7px',
});

export const statusButtons = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
});

export const statusAction = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: 'transparent',
    [borderVar]: glassStroke,
    [opacityVar]: '1',
  },
  padding: '3px 8px',
  fontSize: 9,
  borderRadius: 4,
  cursor: 'pointer',
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  background: surfaceVar,
  color: accentColorVar,
  fontWeight: 500,
  opacity: opacityVar,
});

export const statusActionActive = style({
  fontWeight: 700,
});
