import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import {
  glassFill,
  glassStroke,
  interactionTransition,
} from '../layouts/workspace-list-shared-styles';

export const root = style({
  position: 'relative',
  height: '100%',
  width: '100%',
  borderBottom: `0.5px solid ${glassStroke}`,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 90%, transparent) 0%, color-mix(in srgb, var(--affine-background-primary-color) 76%, transparent) 100%)',
  backdropFilter: 'blur(16px) saturate(145%)',
});

export const header = style({
  display: 'flex',
  height: '100%',
  width: '100%',
  alignItems: 'center',
  gap: 12,
  padding: '0 10px',
  containerName: 'detail-page-header',
  containerType: 'inline-size',
});
export const spacer = style({
  flexGrow: 1,
  minWidth: 12,
});
export const journalWeekPicker = style({
  minWidth: 100,
  flexGrow: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const iconButtonContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '2px 8px',
  borderRadius: 12,
  border: `0.5px solid ${glassStroke}`,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 90%, transparent)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  transition: interactionTransition,
});

export const dragHandle = style({
  cursor: 'grab',
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: -16,
  width: 16,
  opacity: 0,
  selectors: {
    [`${root}:hover &, ${root}[data-dragging="true"] &`]: {
      opacity: 1,
    },
  },
});

export const dragPreview = style({
  // see https://atlassian.design/components/pragmatic-drag-and-drop/web-platform-design-constraints/#native-drag-previews
  maxWidth: '280px',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  padding: '4px 16px',
  overflow: 'hidden',
  backgroundColor: cssVarV2('layer/background/primary'),
  borderRadius: '12px',
});

export const templateMark = style({
  backgroundColor: cssVarV2.button.templateLabelBackground,
  color: cssVarV2.button.primary,
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '20px',
});

export const journalTemplateMark = style({
  '@container': {
    '(width <= 400px)': {
      display: 'none',
    },
  },
});

export const verticalDivider = style({
  height: 20,
  marginLeft: 4,
});
