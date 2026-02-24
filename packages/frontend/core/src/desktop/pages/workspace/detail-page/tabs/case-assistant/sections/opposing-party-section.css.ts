import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const emptyCompact = style({
  fontSize: 11,
  padding: '10px 0',
});

export const formCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 10,
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  marginBottom: 8,
});

export const formTitle = style({
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 2,
  color: cssVarV2('text/primary'),
});

export const resizeVertical = style({ resize: 'vertical' });

export const formActions = style({
  display: 'flex',
  gap: 6,
  marginTop: 4,
});

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const item = style({
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  overflow: 'hidden',
});

export const itemButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const partyIcon = style({
  fontSize: 14,
  flexShrink: 0,
});

export const partyName = style({
  flex: 1,
  fontSize: 11,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: cssVarV2('text/primary'),
});

export const repLabel = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  flexShrink: 0,
});

export const caret = style({
  fontSize: 9,
  opacity: 0.4,
  color: cssVarV2('text/secondary'),
});

export const expandedPanel = style({
  padding: '0 10px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
});

export const detailMuted = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const detailText = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
});

export const detailItalic = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  fontStyle: 'italic',
});

export const itemActions = style({
  display: 'flex',
  gap: 6,
  marginTop: 4,
});

export const dangerButton = style({
  color: cssVarV2('status/error'),
});
