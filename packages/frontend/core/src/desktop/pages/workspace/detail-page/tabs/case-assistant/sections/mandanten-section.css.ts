import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();

export const statsRow = style({
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
});

export const summaryWithBottom = style({
  marginBottom: 12,
});

export const filterRow = style({
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
  marginBottom: 14,
});

export const growLabel = style({
  flex: 1,
  marginBottom: 0,
});

export const nowrapButton = style({
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

export const emptyState = style({
  textAlign: 'center',
  padding: '28px 16px',
});

export const emptyIcon = style({
  fontSize: 32,
  marginBottom: 8,
});

export const emptyTitle = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const emptyHint = style({
  fontSize: 11,
  marginTop: 4,
  opacity: 0.65,
  color: cssVarV2('text/secondary'),
});

export const clientList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const clientCard = style({
  vars: {
    [accentColorVar]: cssVarV2('layer/insideBorder/border'),
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
    [borderVar]: glassStroke,
  },
  borderRadius: 10,
  border: `0.5px solid ${borderVar}`,
  background: surfaceVar,
  backdropFilter: 'blur(14px) saturate(140%)',
  overflow: 'hidden',
  boxShadow: `0 1px 4px color-mix(in srgb, ${accentColorVar} 14%, transparent)`,
  listStyle: 'none',
});

export const clientHeaderButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 14px',
  minHeight: 54,
});

export const kindIcon = style({
  fontSize: 22,
  flexShrink: 0,
  lineHeight: 1,
});

export const primaryTitle = style({
  fontSize: 13,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const secondaryMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  marginTop: 2,
});

export const chipRow = style({
  display: 'flex',
  gap: 5,
  alignItems: 'center',
  flexShrink: 0,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
});

export const neutralChip = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 6px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const positiveChip = style({
  color: cssVarV2('status/success'),
  fontWeight: 700,
});

export const archivedChip = style({
  color: cssVarV2('text/secondary'),
  fontWeight: 700,
});

export const caret = style({
  fontSize: 11,
  opacity: 0.45,
  marginLeft: 2,
  color: cssVarV2('text/secondary'),
});

export const statusBadge = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
    [surfaceVar]: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
    [borderVar]: glassStroke,
  },
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderRadius: 4,
  padding: '2px 7px',
  whiteSpace: 'nowrap',
  color: accentColorVar,
  background: surfaceVar,
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const anwaltChip = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('button/primary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 7px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  whiteSpace: 'nowrap',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const countChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 6px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  whiteSpace: 'nowrap',
});

export const tagPill = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 3,
  padding: '1px 5px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const contentCol = style({
  flex: 1,
  minWidth: 0,
});

export const headerSubline = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  marginTop: 2,
});

export const chipRowTight = style({
  display: 'flex',
  gap: 5,
  alignItems: 'center',
  flexShrink: 0,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
});

export const tagsWrap = style({
  paddingLeft: 14,
  paddingRight: 14,
  paddingBottom: 8,
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
});

export const noteBox = style({
  margin: '0 14px 10px',
  padding: '8px 10px',
  background: cssVarV2('layer/background/secondary'),
  borderRadius: 6,
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  borderLeft: `3px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const expandedBlock = style({
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  padding: '10px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const clientDetailGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
});

export const detailCard = style({
  borderRadius: 10,
  padding: 0,
  overflow: 'hidden',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(14px) saturate(140%)',
});

export const detailCardHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 12px',
  borderBottom: `0.5px solid ${glassStroke}`,
});

export const detailCardTitle = style({
  fontSize: 11,
  fontWeight: 800,
  color: cssVarV2('text/primary'),
});

export const statusPill = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  fontSize: 10,
  fontWeight: 800,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 999,
  padding: '3px 9px',
  border: `0.5px solid ${glassStroke}`,
  whiteSpace: 'nowrap',
});

export const detailCardBody = style({
  padding: '10px 12px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const detailMetaLine = style({
  fontSize: 11,
  color: cssVarV2('text/primary'),
  opacity: 0.92,
});

export const detailMetaHint = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  opacity: 0.75,
  lineHeight: 1.35,
});

export const detailActionRow = style({
  display: 'flex',
  justifyContent: 'flex-start',
  gap: 8,
  marginTop: 4,
});

export const compactEmpty = style({
  fontSize: 12,
  padding: '12px 0',
  textAlign: 'center',
});

export const compactEmptyIcon = style({
  fontSize: 20,
});

export const compactEmptyTitle = style({
  marginTop: 4,
  color: cssVarV2('text/primary'),
});

export const compactEmptyHint = style({
  fontSize: 11,
  opacity: 0.65,
  marginTop: 2,
  color: cssVarV2('text/secondary'),
});

export const matterCard = style({
  vars: {
    [borderVar]: cssVarV2('layer/insideBorder/border'),
    [surfaceVar]: 'transparent',
  },
  borderRadius: 8,
  border: `1.5px solid ${borderVar}`,
  background: surfaceVar,
  overflow: 'hidden',
});

export const matterHeaderButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 12px',
  minHeight: 46,
});

export const matterIcon = style({
  fontSize: 16,
  flexShrink: 0,
});

export const matterTitle = style({
  fontSize: 12,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const matterRef = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  marginTop: 1,
});

export const findingsChip = style({
  vars: {
    [accentColorVar]: cssVarV2('text/secondary'),
  },
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 10,
  fontWeight: 700,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 6px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  whiteSpace: 'nowrap',
});

export const matterMetaRow = style({
  padding: '0 12px 9px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const metaText = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const metaEllipsis = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 180,
});

export const matterOpenButton = style({
  fontSize: 11,
  padding: '3px 9px',
  marginLeft: 'auto',
  flexShrink: 0,
});

export const findingsSummary = style({
  margin: '0 12px 8px',
  padding: '8px 10px',
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const findingsSummaryTitle = style({
  fontSize: 10,
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  marginBottom: 4,
});

export const findingRow = style({
  fontSize: 10,
  color: cssVarV2('text/primary'),
  marginBottom: 2,
  display: 'flex',
  gap: 4,
  alignItems: 'flex-start',
});

export const findingIcon = style({
  flexShrink: 0,
});

export const findingTitle = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const findingMore = style({
  fontSize: 9,
  color: cssVarV2('text/secondary'),
  marginTop: 2,
});

export const documentsBlock = style({
  borderTop: `0.5px solid ${glassStroke}`,
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

export const documentRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 6,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const docRefBtn = style({
  padding: '7px 10px',
  borderRadius: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 86%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const documentIcon = style({
  fontSize: 14,
  flexShrink: 0,
  marginTop: 1,
});

export const documentBody = style({
  flex: 1,
  minWidth: 0,
});

export const documentTitle = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const documentMetaRow = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginTop: 3,
});

export const documentFileNo = style({
  fontSize: 10,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const documentRefs = style({
  marginTop: 3,
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});
