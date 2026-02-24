import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const tabsRoot = style({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  gap: '8px',
});

export const tabsList = style({
  display: 'flex',
  gap: '8px',
  boxSizing: 'border-box',
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '4px',
  borderRadius: '12px',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--affine-background-primary-color) 88%, transparent) 0%, color-mix(in srgb, var(--affine-background-primary-color) 76%, transparent) 100%)',
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const tabsTrigger = style({
  all: 'unset',
  minHeight: '32px',
  padding: '5px 10px',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: cssVar('fontSm'),
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  borderRadius: '10px',
  border: `0.5px solid transparent`,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 74%, transparent)',
  transition:
    'background 0.18s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
  selectors: {
    '&:hover': {
      borderColor: 'color-mix(in srgb, var(--affine-theme-link, #22d3ee) 12%, var(--affine-border-color))',
      background:
        'color-mix(in srgb, var(--affine-theme-link, rgba(56, 189, 248, 0.08)) 14%, var(--affine-background-primary-color))',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
    '&[data-state="active"]': {
      color: cssVarV2('button/pureWhiteText'),
      borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
      background:
        `linear-gradient(135deg, color-mix(in srgb, ${cssVarV2('button/primary')} 68%, var(--affine-background-primary-color) 32%) 0%, color-mix(in srgb, ${cssVarV2('button/primary')} 56%, var(--affine-background-primary-color) 44%) 100%)`,
      boxShadow:
        '0 6px 16px color-mix(in srgb, var(--affine-primary-color) 18%, rgba(0, 0, 0, 0.16))',
    },
  },
});

export const tabsContent = style({
  display: 'flex',
  flexDirection: 'column',

  selectors: {
    '&[data-state="inactive"]': {
      display: 'none',
    },
  },
});
