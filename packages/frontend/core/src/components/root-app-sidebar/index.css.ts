import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const workspaceAndUserWrapper = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  width: 'calc(100% + 12px)',
  height: 46,
  paddingRight: 6,
  alignSelf: 'center',
});
export const quickSearchAndNewPage = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 0',
  marginLeft: -8,
  marginRight: -6,
});
export const quickSearch = style({
  width: 0,
  flex: 1,
});

export const workspaceWrapper = style({
  width: 0,
  flex: 1,
});

export const bottomContainer = style({
  gap: 6,
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  paddingTop: 8,
  marginTop: 4,
});

export const aiCreditsCard = style({
  borderRadius: 10,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-primary-color)',
  padding: '10px 10px 9px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const aiCreditsHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  fontWeight: 750,
  lineHeight: 1.2,
  color: cssVarV2('text/primary'),
});

export const aiCreditsTier = style({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 20,
  borderRadius: 999,
  padding: '0 8px',
  border: '1px solid var(--affine-v2-badge-accent-border, rgba(6, 182, 212, 0.22))',
  background: 'var(--affine-v2-badge-accent-bg, rgba(6, 182, 212, 0.10))',
  color: 'var(--affine-v2-badge-accent-text, #0891b2)',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.2,
  textTransform: 'uppercase',
});

export const aiCreditsBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const aiCreditsMeta = style({
  margin: 0,
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 11,
  lineHeight: 1.4,
});

export const aiCreditsMetaLabel = style({
  color: cssVarV2('text/secondary'),
  fontWeight: 600,
});

export const aiCreditsMetaValue = style({
  color: cssVarV2('text/secondary'),
  fontWeight: 750,
  textAlign: 'right',
});

export const aiCreditsMetaValueStrong = style({
  color: cssVarV2('text/primary'),
  fontWeight: 800,
  textAlign: 'right',
});

export const aiCreditsAction = style({
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-hover-color)',
  color: cssVarV2('text/primary'),
  minHeight: 30,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease',
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
    '&:hover': {
      background: 'var(--affine-hover-color-filled)',
      borderColor: cssVarV2('button/primary'),
    },
  },
});
