import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { glassStroke } from './layouts/workspace-list-shared-styles';

export const trashHeader = style({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '12px 24px 10px',
  borderBottom: `0.5px solid ${glassStroke}`,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 90%, transparent) 0%, color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent) 100%)',
  backdropFilter: 'blur(18px) saturate(145%)',
});

export const trashTitleWrap = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
});

export const trashTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 700,
  color: cssVarV2('text/primary'),
  letterSpacing: '-0.01em',
  userSelect: 'none',
});

export const trashSubtitle = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  height: '100%',
  width: '100%',
  background:
    'radial-gradient(120% 90% at 12% -18%, var(--affine-theme-bg-tint, transparent) 0%, transparent 55%), radial-gradient(90% 80% at 100% 0%, var(--affine-theme-accent-soft, transparent) 0%, transparent 58%), linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0%, rgba(255, 255, 255, 0) 36%)',
});
export const trashIcon = style({
  color: cssVarV2('icon/primary'),
  fontSize: 16,
});
