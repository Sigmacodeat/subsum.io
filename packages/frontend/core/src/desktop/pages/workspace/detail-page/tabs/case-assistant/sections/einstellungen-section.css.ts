import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

export const controlRowSpaced = style({
  marginBottom: 16,
});

export const summaryTight = style({
  marginTop: 4,
  fontSize: 12,
});

export const residencyToggleGrid = style({
  display: 'grid',
  gap: 8,
  marginTop: 6,
  marginBottom: 8,
});

export const residencyToggleLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const connectorsHeaderRow = style({
  marginTop: 8,
});

export const connectorsTitle = style({
  fontSize: 13,
});

export const connectorsIntro = style({
  fontSize: 12,
  marginBottom: 8,
});

export const connectorStatusBgVar = createVar('connector-status-bg');
export const connectorStatusFgVar = createVar('connector-status-fg');

export const connectorStatusChip = style({
  vars: {
    [connectorStatusBgVar]: cssVarV2('layer/background/secondary'),
    [connectorStatusFgVar]: cssVarV2('text/secondary'),
  },
  background: connectorStatusBgVar,
  color: connectorStatusFgVar,
});
