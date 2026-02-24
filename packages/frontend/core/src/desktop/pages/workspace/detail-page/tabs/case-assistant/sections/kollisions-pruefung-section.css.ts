import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

import { glassFill, glassStroke } from '../../../../layouts/workspace-list-shared-styles';

export const accentColorVar = createVar();
export const surfaceVar = createVar();
export const borderVar = createVar();
export const opacityVar = createVar();

export const root = style({
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  backdropFilter: 'blur(14px) saturate(145%)',
  borderRadius: 10,
  border: `0.5px solid ${glassStroke}`,
  padding: '18px 20px',
  marginBottom: 16,
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
});

export const headerIcon = style({
  fontSize: 20,
});

export const headerTitle = style({
  fontWeight: 700,
  fontSize: 15,
  color: cssVarV2('text/primary'),
});

export const headerSubtitle = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const searchRow = style({
  display: 'flex',
  gap: 8,
  marginBottom: 14,
});

export const searchInput = style({
  flex: 1,
  padding: '8px 12px',
  borderRadius: 7,
  border: `0.5px solid ${glassStroke}`,
  fontSize: 13,
  outline: 'none',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/primary'),
});

export const searchButton = style({
  vars: {
    [surfaceVar]: cssVarV2('button/primary'),
    [accentColorVar]: cssVarV2('button/pureWhiteText'),
    [opacityVar]: '1',
  },
  padding: '8px 18px',
  borderRadius: 7,
  background: surfaceVar,
  color: accentColorVar,
  border: 'none',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  opacity: opacityVar,
});

export const statusBanner = style({
  vars: {
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
    [borderVar]: glassStroke,
  },
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 8,
  marginBottom: 14,
  background: surfaceVar,
  border: `0.5px solid ${borderVar}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const statusBannerIcon = style({
  fontSize: 18,
});

export const statusBannerTitle = style({
  vars: { [accentColorVar]: cssVarV2('text/primary') },
  fontWeight: 700,
  fontSize: 13,
  color: accentColorVar,
});

export const statusBannerMeta = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const kpiGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
  marginBottom: 14,
});

export const kpiCard = style({
  textAlign: 'center',
  padding: '8px 6px',
  borderRadius: 7,
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const kpiValue = style({
  vars: { [accentColorVar]: cssVarV2('text/primary') },
  fontSize: 18,
  fontWeight: 700,
  color: accentColorVar,
});

export const kpiLabel = style({
  fontSize: 10,
  color: cssVarV2('text/secondary'),
});

export const trefferList = style({
  marginBottom: 14,
});

export const trefferCard = style({
  vars: {
    [borderVar]: glassStroke,
    [surfaceVar]: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/primary')} 92%, transparent)`,
  },
  border: `0.5px solid ${borderVar}`,
  borderRadius: 8,
  marginBottom: 8,
  background: surfaceVar,
  backdropFilter: 'blur(14px) saturate(140%)',
  overflow: 'hidden',
});

export const trefferHeaderButton = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
});

export const trefferDot = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: accentColorVar,
  flexShrink: 0,
});

export const trefferName = style({
  fontWeight: 600,
  fontSize: 13,
  flex: 1,
  color: cssVarV2('text/primary'),
});

export const levelBadge = style({
  vars: { [accentColorVar]: cssVarV2('text/secondary') },
  fontSize: 11,
  fontWeight: 600,
  color: accentColorVar,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 7px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const rolleBadge = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  borderRadius: 4,
  padding: '2px 7px',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
});

export const caret = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  marginLeft: 4,
});

export const trefferBody = style({
  padding: '0 14px 12px 34px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const trefferMeta = style({
  fontSize: 12,
  color: cssVarV2('text/primary'),
});

export const trefferMetaMuted = style({
  color: cssVarV2('text/secondary'),
});

export const collisionWarning = style({
  fontSize: 12,
  color: cssVarV2('status/error'),
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  borderRadius: 6,
  padding: '6px 10px',
  marginTop: 4,
  border: `0.5px solid rgba(255, 59, 48, 0.28)`,
  backdropFilter: 'blur(12px) saturate(140%)',
});

export const ignoreButton = style({
  alignSelf: 'flex-start',
  marginTop: 4,
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  borderRadius: 5,
  padding: '3px 10px',
  cursor: 'pointer',
});

export const overrideBox = style({
  background: `${glassFill}, color-mix(in srgb, ${cssVarV2('layer/background/secondary')} 92%, transparent)`,
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(12px) saturate(140%)',
  borderRadius: 8,
  padding: '12px 14px',
});

export const overrideTitle = style({
  fontWeight: 600,
  fontSize: 13,
  color: cssVarV2('text/primary'),
  marginBottom: 8,
});

export const overrideHint = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  marginBottom: 10,
});

export const overrideInitButton = style({
  padding: '6px 14px',
  borderRadius: 6,
  background: cssVarV2('text/primary'),
  color: cssVarV2('button/pureWhiteText'),
  border: 'none',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
});

export const overrideStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const overrideTextarea = style({
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: `0.5px solid ${glassStroke}`,
  fontSize: 12,
  resize: 'vertical',
  boxSizing: 'border-box',
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 72%, transparent)',
  backdropFilter: 'blur(10px) saturate(135%)',
  color: cssVarV2('text/primary'),
  outline: 'none',
  selectors: {
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--affine-primary-color) 18%, transparent)',
    },
  },
});

export const overrideButtonRow = style({
  display: 'flex',
  gap: 8,
});

export const overrideConfirmButton = style({
  vars: {
    [surfaceVar]: cssVarV2('status/error'),
    [accentColorVar]: cssVarV2('button/pureWhiteText'),
    [opacityVar]: '1',
  },
  padding: '6px 14px',
  borderRadius: 6,
  background: surfaceVar,
  color: accentColorVar,
  border: 'none',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  opacity: opacityVar,
});

export const overrideCancelButton = style({
  padding: '6px 14px',
  borderRadius: 6,
  background: 'color-mix(in srgb, var(--affine-background-primary-color) 82%, transparent)',
  color: cssVarV2('text/primary'),
  border: `0.5px solid ${glassStroke}`,
  backdropFilter: 'blur(10px) saturate(135%)',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const overrideLoggedBanner = style({
  background: 'rgba(52, 199, 89, 0.10)',
  border: `0.5px solid rgba(52, 199, 89, 0.28)`,
  backdropFilter: 'blur(12px) saturate(140%)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 12,
  color: cssVarV2('status/success'),
});

export const emptyState = style({
  textAlign: 'center',
  padding: '24px 16px',
  color: cssVarV2('text/secondary'),
  fontSize: 13,
});

export const emptyIcon = style({
  fontSize: 28,
  marginBottom: 8,
});

export const emptyHint = style({
  fontSize: 11,
  marginTop: 6,
  color: cssVarV2('text/secondary'),
});
