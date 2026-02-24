import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();

export const headerMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const headerActions = style({
  display: 'flex',
  gap: 6,
  alignItems: 'center',
});

export const headerButton = style({
  fontSize: 10,
  padding: '3px 8px',
  minHeight: 24,
});

export const statusText = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  color: accentColorVar,
});

export const composeCard = style({
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const composeTitle = style({
  fontSize: 11,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const gridTwo = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
});

export const textarea = style({
  resize: 'vertical',
  minHeight: 60,
});

export const actionRowRight = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
});

export const button11 = style({ fontSize: 11 });

export const tabsRow = style({
  display: 'flex',
  gap: 4,
  borderBottom: `0.5px solid ${glassStroke}`,
  paddingBottom: 6,
});

export const tabButton = style({
  fontSize: 11,
  padding: '4px 8px',
  minHeight: 26,
});

export const tabCount = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 9,
  fontWeight: 700,
  marginLeft: 4,
  color: accentColorVar,
});

export const searchInput = style({ fontSize: 11 });

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const threadCard = style({
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  overflow: 'hidden',
});

export const threadHeader = style({
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  cursor: 'pointer',
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const subject = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const countBadge = style({
  fontSize: 9,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const stateBadge = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  },
  fontSize: 9,
  color: accentColorVar,
  background: surfaceVar,
  borderRadius: 3,
  padding: '1px 5px',
  fontWeight: 600,
  flexShrink: 0,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const metaRow = style({
  display: 'flex',
  gap: 8,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  flexWrap: 'wrap',
});

export const matterText = style({
  color: cssVarV2('button/primary'),
  fontWeight: 600,
});

export const mlAuto = style({ marginLeft: 'auto' });

export const expanded = style({
  borderTop: `0.5px solid ${glassStroke}`,
  padding: '8px 12px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const messageCard = style({
  padding: '6px 8px',
  borderRadius: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 84%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const messageMeta = style({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginBottom: 4,
});

export const statusStrong = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  color: accentColorVar,
  fontWeight: 600,
});

export const messageBody = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  maxHeight: 120,
  overflow: 'auto',
});

export const errorText = style({
  fontSize: 10,
  color: cssVarV2('status/error'),
  marginTop: 4,
  fontWeight: 600,
});

export const miniButton = style({
  fontSize: 10,
  padding: '3px 8px',
  minHeight: 24,
});
