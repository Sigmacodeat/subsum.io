import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const borderVar = createVar();

export const summaryGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
  gap: 6,
  marginBottom: 8,
});

export const summaryCard = style({
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 6,
  padding: '6px 8px',
  textAlign: 'center',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const summaryValue = style({
  fontSize: 18,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
});

export const summaryLabel = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 10,
  opacity: 0.8,
  color: accentColorVar,
});

export const runMeta = style({
  marginBottom: 4,
});

export const normAccordion = style({
  marginBottom: 6,
});

export const chipsRow = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  padding: '4px 0',
});

export const statusChip = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  color: accentColorVar,
});

export const tinyMeta = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginTop: 4,
});

export const categoryRow = style({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginBottom: 8,
});

export const categoryChip = style({
  fontSize: 10,
});

export const filterRow = style({
  display: 'flex',
  gap: 4,
  marginBottom: 8,
});

export const filterButton = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [borderVar]: glassStroke,
  },
  padding: '3px 8px',
  fontSize: 10,
  borderRadius: 4,
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  background: 'transparent',
  color: accentColorVar,
  cursor: 'pointer',
  fontWeight: 400,
});

export const filterButtonActive = style({
  fontWeight: 600,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const findingsList = style({
  gap: 2,
});

export const findingItem = style({
  vars: { [borderVar]: glassStroke },
  borderLeft: `3px solid ${borderVar}`,
  paddingLeft: 8,
});

export const findingButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  padding: '2px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const findingIcon = style({
  fontSize: 12,
});

export const findingTitle = style({
  flex: 1,
  fontSize: 12,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const typeChip = style({
  fontSize: 9,
});

export const findingCaret = style({
  fontSize: 9,
  opacity: 0.5,
  color: cssVarV2('text/secondary'),
});

export const findingBody = style({
  marginTop: 4,
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const citationsBox = style({
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 10,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const citationRow = style({
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 10,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const citationQuote = style({
  fontStyle: 'italic',
  color: cssVarV2('text/secondary'),
  marginTop: 1,
});
