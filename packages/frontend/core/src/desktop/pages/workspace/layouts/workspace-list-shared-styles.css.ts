import { cssVarV2 } from '@toeverything/theme/v2';
import { keyframes } from '@vanilla-extract/css';

export const glassStroke = 'var(--affine-border-color)';
export const glassFill =
  'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)';

export const surfaceEnter = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(6px) scale(0.996)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});

export const ambientShift = keyframes({
  '0%, 100%': {
    backgroundPosition: '0% 50%, 100% 0%, 0% 0%',
  },
  '50%': {
    backgroundPosition: '8% 56%, 96% 4%, 0% 0%',
  },
});

export const interactionTransition =
  'background 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1), transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';

export const workspaceAmbientBackground =
  'linear-gradient(180deg, var(--affine-background-primary-color) 0%, var(--affine-background-secondary-color) 100%)';

export const layoutGutter = 24;
export const layoutGutterMd = 20;
export const layoutGutterSm = 16;

export const toolbarControlStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  minHeight: 32,
  borderRadius: 14,
  border: `0.5px solid ${glassStroke}`,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent)',
  backdropFilter: 'blur(10px) saturate(130%)',
  transition: 'border-color 0.16s ease, background 0.16s ease',
  selectors: {
    '&:focus-within': {
      borderColor: cssVarV2('button/primary'),
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
} as const;

export const toolbarLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '16px',
  color: 'color-mix(in srgb, var(--affine-text-primary-color) 68%, var(--affine-text-secondary-color))',
} as const;

export const toolbarSelectStyle = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '18px',
  minHeight: 24,
  outline: 'none',
  cursor: 'pointer',
} as const;

export const toolbarSortDirectionButtonStyle = {
  appearance: 'none',
  borderRadius: 14,
  border: `0.5px solid ${glassStroke}`,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent)',
  backdropFilter: 'blur(10px) saturate(130%)',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '18px',
  width: 32,
  minWidth: 32,
  height: 32,
  padding: 0,
  cursor: 'pointer',
  transition: 'background 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease, transform 0.2s ease',
  selectors: {
    '&[data-dir="desc"]': {
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
      background: 'var(--affine-hover-color-filled)',
    },
    '&:hover': {
      background: 'var(--affine-hover-color-filled)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 80%, transparent)',
      transform: 'translateY(-0.5px)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
} as const;

export const filterRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
} as const;

export const filterGroupStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  minWidth: 0,
} as const;

export const filterGroupRightStyle = (containerName: string) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  marginLeft: 'auto',
  '@container': {
    [`${containerName} (width <= 900px)`]: {
      marginLeft: 0,
      width: '100%',
    },
  },
} as const);

export const filterChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 32,
  padding: '5px 12px',
  borderRadius: 16,
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 600,
  cursor: 'pointer',
  border: `0.5px solid ${glassStroke}`,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 68%, transparent)',
  color: cssVarV2('text/primary'),
  backdropFilter: 'blur(10px) saturate(130%)',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.02) inset',
  transition: interactionTransition,
  selectors: {
    '&[data-active="true"]': {
      background: cssVarV2('button/primary'),
      color: cssVarV2('button/pureWhiteText'),
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 10px 24px color-mix(in srgb, ${cssVarV2(
        'button/primary'
      )} 28%, transparent), 0 1px 0 rgba(255, 255, 255, 0.02) inset`,
    },
    '&:hover:not([data-active="true"])': {
      borderColor: 'var(--affine-border-color)',
      color: cssVarV2('text/primary'),
      background: 'var(--affine-hover-color-filled)',
    },
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 1,
    },
  },
} as const;

export const filterSegmentStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: 0,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  backdropFilter: 'none',
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
} as const;

export const stickyFilterBarStyle = (containerName: string) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: `12px ${layoutGutter}px 10px`,
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: 'var(--affine-background-primary-color)',
  backdropFilter: 'blur(8px) saturate(120%)',
  borderBottom: '1px solid var(--affine-border-color)',
  '@container': {
    [`${containerName} (width <= 500px)`]: {
      padding: `8px ${layoutGutterMd}px 10px`,
    },
  },
} as const);

export const searchInputStyle = {
  flex: '1 1 240px',
  minWidth: 120,
  maxWidth: 360,
  minHeight: 32,
  padding: '7px 12px',
  borderRadius: 8,
  border: `0.5px solid ${glassStroke}`,
  background:
    'color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent)',
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  outline: 'none',
  backdropFilter: 'blur(10px) saturate(135%)',
  transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  selectors: {
    '&::placeholder': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 56%, var(--affine-text-secondary-color))',
    },
    '&:focus': {
      borderColor: cssVarV2('button/primary'),
      boxShadow:
        '0 0 0 3px color-mix(in srgb, var(--affine-primary-color) 18%, transparent)',
    },
  },
} as const;

export const sortButtonStyle = {
  appearance: 'none',
  background: 'transparent',
  border: 0,
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  textTransform: 'inherit',
  letterSpacing: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  selectors: {
    '&:focus-visible': {
      outline: `1px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
      borderRadius: 4,
    },
  },
} as const;

export const srOnlyLiveStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export const filterChipLowPriorityStyle = (containerName: string) => ({
  '@container': {
    [`${containerName} (width <= 900px)`]: {
      display: 'none',
    },
  },
} as const);

export const statusBadgeBaseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '16px',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
  border: `0.5px solid ${glassStroke}`,
} as const;

export const statusToneOpenStyle = {
  background: `color-mix(in srgb, ${cssVarV2('button/primary')} 14%, transparent)`,
  color: cssVarV2('button/primary'),
  borderColor: `color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
} as const;

export const statusToneClosedStyle = {
  background: `color-mix(in srgb, ${cssVarV2('status/success')} 12%, transparent)`,
  color: cssVarV2('status/success'),
  borderColor: `color-mix(in srgb, ${cssVarV2('status/success')} 34%, transparent)`,
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${cssVarV2('status/success')} 88%, white)`,
    },
  },
} as const;

export const statusToneArchivedStyle = {
  background: 'color-mix(in srgb, #f59e0b 12%, transparent)',
  color: 'color-mix(in srgb, #f59e0b 78%, var(--affine-text-primary-color))',
  borderColor: 'color-mix(in srgb, #f59e0b 34%, transparent)',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, #fbbf24 86%, white)',
    },
  },
} as const;

export const statusToneErrorStyle = {
  color: cssVarV2('status/error'),
  borderColor: `color-mix(in srgb, ${cssVarV2('status/error')} 34%, transparent)`,
  background: `color-mix(in srgb, ${cssVarV2('status/error')} 12%, transparent)`,
  selectors: {
    '[data-theme="dark"] &': {
      color: `color-mix(in srgb, ${cssVarV2('status/error')} 86%, white)`,
    },
  },
} as const;

export const statusToneWarningStyle = {
  borderColor: 'color-mix(in srgb, #f59e0b 34%, transparent)',
  color: 'color-mix(in srgb, #f59e0b 78%, var(--affine-text-primary-color))',
  background: 'color-mix(in srgb, #f59e0b 12%, transparent)',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, #fbbf24 86%, white)',
    },
  },
} as const;

export const statusToneIdleStyle = {
  color: cssVarV2('text/secondary'),
  borderColor: 'rgba(142, 142, 147, 0.28)',
  background: 'rgba(142, 142, 147, 0.10)',
  selectors: {
    '[data-theme="dark"] &': {
      color: 'color-mix(in srgb, var(--affine-text-primary-color) 74%, var(--affine-text-secondary-color))',
    },
  },
} as const;

export const rowDividerColor = 'color-mix(in srgb, var(--affine-border-color) 60%, transparent)';
export const rowDividerBorder = `0.5px solid ${rowDividerColor}`;

export const statusBadgeCompactStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '1px 6px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  lineHeight: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  border: `0.5px solid ${glassStroke}`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
} as const;

export const listRowBaseStyle = {
  appearance: 'none',
  background: 'transparent',
  width: '100%',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  borderRadius: 10,
  cursor: 'pointer',
  alignItems: 'center',
  border: `0.5px solid transparent`,
  transition: interactionTransition,
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor: 'color-mix(in srgb, var(--affine-border-color) 70%, transparent)',
    },
    '&:focus-visible': {
      outline: `1.5px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -1,
      background: 'var(--affine-hover-color)',
      borderColor: cssVarV2('button/primary'),
    },
  },
} as const;
