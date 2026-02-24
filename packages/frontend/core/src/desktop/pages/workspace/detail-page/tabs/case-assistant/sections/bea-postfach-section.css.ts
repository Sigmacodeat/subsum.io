import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();

export const connectorRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const statusDot = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: accentColorVar,
  flexShrink: 0,
});

export const statusLabel = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 10,
  color: accentColorVar,
  fontWeight: 600,
});

export const unreadBadge = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('button/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '1px 6px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const statusText = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  color: accentColorVar,
});

export const disconnectedEmpty = style({
  textAlign: 'center',
});

export const disconnectedTitle = style({
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: cssVarV2('text/primary'),
});

export const disconnectedHint = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

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

export const searchInput = style({
  fontSize: 11,
});

export const messageList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const messageCard = style({
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  cursor: 'pointer',
});

export const messageCardUnread = style({
  borderLeft: `3px solid ${cssVarV2('button/primary')}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
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

export const subjectUnread = style({
  fontWeight: 700,
});

export const priorityBadge = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 9,
  fontWeight: 700,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 3,
  padding: '1px 5px',
  flexShrink: 0,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
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

export const courtRef = style({
  color: cssVarV2('button/primary'),
  fontWeight: 600,
});

export const pushRight = style({ marginLeft: 'auto' });

export const expandedPanel = style({
  padding: '8px 12px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: '0 0 8px 8px',
  border: `0.5px solid ${glassStroke}`,
  borderTop: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const detailsGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
  fontSize: 10,
  color: cssVarV2('text/primary'),
});

export const attachmentInfo = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  padding: '4px 8px',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const actionRow = style({
  display: 'flex',
  gap: 6,
  justifyContent: 'flex-end',
});

export const miniButton = style({
  fontSize: 10,
  padding: '3px 8px',
  minHeight: 24,
});

export const composeBox = style({
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

export const composeTextarea = style({
  resize: 'vertical',
  minHeight: 60,
});

export const composeActions = style({
  display: 'flex',
  gap: 6,
  justifyContent: 'flex-end',
});

export const composeButton = style({ fontSize: 11 });

export const footerActions = style({
  display: 'flex',
  gap: 6,
  justifyContent: 'flex-end',
  borderTop: `0.5px solid ${glassStroke}`,
  paddingTop: 8,
});

export const footerButton = style({
  fontSize: 11,
  padding: '5px 10px',
});
