export type ThemeVariant = 'default';
export type ResolvedThemeMode = 'light' | 'dark';

export const themeVariantOptions: Array<{
  value: ThemeVariant;
  labelKey: 'com.affine.appearanceSettings.themeVariant.default.label';
  descriptionKey: 'com.affine.appearanceSettings.themeVariant.default.description';
  swatches: readonly [string, string, string];
}> = [
  {
    value: 'default',
    labelKey: 'com.affine.appearanceSettings.themeVariant.default.label',
    descriptionKey:
      'com.affine.appearanceSettings.themeVariant.default.description',
    swatches: ['#2563eb', '#06b6d4', '#1d4ed8'],
  },
];

export const normalizeThemeVariant = (_value?: string | null): ThemeVariant => {
  return 'default';
};

// ════════════════════════════════════════════════════════════════════
// PREMIUM DESIGN SYSTEM — State of the Art
//
// Design language inspired by Linear, Raycast, Vercel, Arc.
// Principles:
//   • Deep, rich backgrounds with subtle warmth (no cheap flat grays)
//   • Ultra-fine borders that whisper, not shout
//   • Layered depth via multi-stop soft shadows
//   • Generous breathing room between contrast levels
//   • Every surface has intentional hierarchy
// ════════════════════════════════════════════════════════════════════

const variantBaseVars: Record<ThemeVariant, Record<string, string>> = {
  default: {
    '--affine-theme-variant-name': 'default',
    '--affine-theme-accent': '#2563eb',
    '--affine-brand-color': '#2563eb',
    '--affine-primary-color': '#2563eb',
    '--affine-theme-secondary': '#06b6d4',
    '--affine-theme-link': '#06b6d4',
    '--affine-link-color': '#06b6d4',
    '--affine-v2-button-primary': '#2563eb',
    '--affine-v2-input-border-active': '#2563eb',
    '--affine-v2-text-link': '#06b6d4',
    '--affine-v2-icon-activated': '#2563eb',
    // Status colors — premium tinted
    '--affine-v2-status-success': '#10b981',
    '--affine-v2-status-warning': '#f59e0b',
    '--affine-v2-status-error': '#ef4444',
    '--affine-v2-status-info': '#06b6d4',
  },
};

// ────────────────────────────────────────────────────────────────────
// Mode-specific variables: full surface, border, text, shadow control
// ────────────────────────────────────────────────────────────────────

const variantModeVars: Record<
  ThemeVariant,
  Record<ResolvedThemeMode, Record<string, string>>
> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DEFAULT (Brand Blue/Cyan)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  default: {
    light: {
      // ── 2026 Law-Firm Light: Neutral surfaces, brand only on interactive ──

      // Accent overlays — used ONLY on interactive states
      '--affine-theme-accent-soft': 'rgba(37, 99, 235, 0.10)',
      '--affine-theme-secondary-soft': 'rgba(6, 182, 212, 0.08)',
      '--affine-theme-bg-tint': 'rgba(37, 99, 235, 0.02)',

      // V2 layer backgrounds — neutral warm daylight (no blue tint)
      '--affine-v2-layer-background-primary': '#f8f9fb',
      '--affine-v2-layer-background-secondary': '#f0f1f4',
      '--affine-v2-layer-background-tertiary': '#e8e9ed',
      '--affine-v2-layer-background-overlayPanel': '#ffffff',
      '--affine-v2-layer-background-modal': 'rgba(0, 0, 0, 0.44)',
      '--affine-v2-layer-background-hoverOverlay': 'rgba(0, 0, 0, 0.035)',
      '--affine-v2-layer-insideBorder-border': 'rgba(0, 0, 0, 0.08)',

      // Global backgrounds — neutral
      '--affine-background-primary-color': '#f8f9fb',
      '--affine-background-secondary-color': '#f0f1f4',
      '--affine-background-tertiary-color': '#e8e9ed',
      '--affine-background-overlay-panel-color': '#ffffff',
      '--affine-background-modal-color': 'rgba(0, 0, 0, 0.44)',

      // Borders — neutral, no blue
      '--affine-border-color': 'rgba(0, 0, 0, 0.09)',
      '--affine-divider-color': 'rgba(0, 0, 0, 0.06)',
      '--affine-black-10': 'rgba(0, 0, 0, 0.05)',
      '--affine-black-30': 'rgba(0, 0, 0, 0.14)',

      // Text — excellent WCAG AA contrast on neutral surfaces
      '--affine-text-primary-color': '#1a1a1e',
      '--affine-text-secondary-color': '#5c5c66',
      '--affine-text-disable-color': '#9c9ca6',
      '--affine-placeholder-color': '#9c9ca6',

      // Hover / active — subtle neutral lift
      '--affine-hover-color': 'rgba(0, 0, 0, 0.04)',
      '--affine-hover-color-filled': '#ededf0',

      // Icons — neutral gray scale
      '--affine-icon-color': '#5c5c66',
      '--affine-icon-secondary': '#9c9ca6',
      '--affine-v2-icon-primary': '#5c5c66',
      '--affine-v2-icon-secondary': '#9c9ca6',
      '--affine-v2-icon-tertiary': '#c0c0c8',

      // Text V2 — neutral
      '--affine-v2-text-primary': '#1a1a1e',
      '--affine-v2-text-secondary': '#5c5c66',
      '--affine-v2-text-tertiary': '#7a7a86',
      '--affine-v2-text-disable': '#c0c0c8',

      // Shadows — very soft, no blue tint
      '--affine-shadow-1':
        '0px 1px 2px rgba(0, 0, 0, 0.04), 0px 1px 3px rgba(0, 0, 0, 0.03)',
      '--affine-shadow-2':
        '0px 2px 6px rgba(0, 0, 0, 0.05), 0px 4px 12px rgba(0, 0, 0, 0.04)',
      '--affine-shadow-3':
        '0px 4px 12px rgba(0, 0, 0, 0.06), 0px 8px 24px rgba(0, 0, 0, 0.04)',
      '--affine-popover-shadow':
        '0px 4px 16px rgba(0, 0, 0, 0.08), 0px 10px 32px rgba(0, 0, 0, 0.05)',

      // Tooltips
      '--affine-tooltip-background': '#1a1a1e',
      '--affine-tooltip-color': '#f8f9fb',

      // Component surfaces — neutral
      '--affine-v2-layer-background-codeBlock': '#ededf0',
      '--affine-v2-layer-background-translucentUI': 'rgba(248, 249, 251, 0.88)',
      '--affine-v2-layer-background-linkedDocOnEdgeless': '#f0f1f4',

      // Component UI — neutral base, brand only on primary actions
      '--affine-v2-button-secondary': 'rgba(0, 0, 0, 0.04)',
      '--affine-v2-button-sidebarButton-background': 'rgba(0, 0, 0, 0.03)',
      '--affine-v2-button-siderbarPrimary-background': 'rgba(0, 0, 0, 0.05)',
      '--affine-v2-button-iconButtonSolid': 'rgba(0, 0, 0, 0.05)',
      '--affine-v2-input-background': 'rgba(0, 0, 0, 0.025)',
      '--affine-v2-input-border-default': 'rgba(0, 0, 0, 0.10)',

      // Button gradients — brand color preserved for primary CTAs
      '--affine-v2-button-primary-gradient': 'linear-gradient(135deg, #2563eb 0%, #1e50c8 50%, #1a47b8 100%)',
      '--affine-v2-button-primary-hover-gradient': 'linear-gradient(135deg, #3b76f0 0%, #2563eb 50%, #1e50c8 100%)',
      '--affine-v2-button-secondary-accent': 'rgba(6, 182, 212, 0.08)',

      // Badge / highlight — dezent, professional
      '--affine-v2-badge-accent-bg': 'rgba(6, 182, 212, 0.08)',
      '--affine-v2-badge-accent-border': 'rgba(6, 182, 212, 0.18)',
      '--affine-v2-badge-accent-text': '#0e7490',
      '--affine-v2-highlight-secondary': 'rgba(6, 182, 212, 0.05)',

      // Tabs — neutral surfaces
      '--affine-v2-tab-tabBackground-active': '#ffffff',
      '--affine-v2-tab-tabBackground-default': '#f0f1f4',
      '--affine-v2-tab-tabBackground-hover': '#e8e9ed',
      '--affine-v2-tab-divider-divider': 'rgba(0, 0, 0, 0.07)',

      // Other surfaces — neutral
      '--affine-v2-workspacePicker-border': 'rgba(0, 0, 0, 0.10)',
      '--affine-v2-workspacePicker-secondaryBackground': 'rgba(0, 0, 0, 0.03)',
      '--affine-v2-tableOfContent-background': '#f0f1f4',
      '--affine-v2-toast-cardLayer-second': '#f0f1f4',
      '--affine-v2-toast-cardLayer-third': '#f0f1f4',
      '--affine-v2-switch-switchBackground-background': '#e8e9ed',
      '--affine-v2-layer-insideBorder-blackBorder': 'rgba(0, 0, 0, 0.05)',
      '--affine-v2-layer-insideBorder-whiteBorder': 'rgba(0, 0, 0, 0.04)',
      '--affine-v2-tooltips-secondaryBackground': 'rgba(0, 0, 0, 0.05)',

      // Noise
      '--affine-noise-opacity': '0.12',
    },
    dark: {
      // ── 2026 Law-Firm Dark: Calm charcoal, brand only on interactive ──

      // Accent overlays — minimal, only for interactive states
      '--affine-theme-accent-soft': 'rgba(37, 99, 235, 0.14)',
      '--affine-theme-secondary-soft': 'rgba(6, 182, 212, 0.10)',
      '--affine-theme-bg-tint': 'rgba(37, 99, 235, 0.02)',

      // V2 layer backgrounds — neutral warm charcoal
      '--affine-v2-layer-background-primary': '#111113',
      '--affine-v2-layer-background-secondary': '#18181b',
      '--affine-v2-layer-background-tertiary': '#222225',
      '--affine-v2-layer-background-overlayPanel': '#18181b',
      '--affine-v2-layer-background-modal': 'rgba(0, 0, 0, 0.68)',
      '--affine-v2-layer-background-hoverOverlay': 'rgba(255, 255, 255, 0.04)',
      '--affine-v2-layer-insideBorder-border': 'rgba(255, 255, 255, 0.07)',

      // Global backgrounds — warm neutral
      '--affine-background-primary-color': '#111113',
      '--affine-background-secondary-color': '#18181b',
      '--affine-background-tertiary-color': '#222225',
      '--affine-background-overlay-panel-color': '#18181b',
      '--affine-background-modal-color': 'rgba(0, 0, 0, 0.68)',

      // Borders — neutral white-based
      '--affine-border-color': 'rgba(255, 255, 255, 0.08)',
      '--affine-divider-color': 'rgba(255, 255, 255, 0.05)',
      '--affine-black-10': 'rgba(255, 255, 255, 0.05)',
      '--affine-black-30': 'rgba(255, 255, 255, 0.11)',

      // Text — warm white/gray, excellent contrast
      '--affine-text-primary-color': '#ececf0',
      '--affine-text-secondary-color': '#8e8e96',
      '--affine-text-disable-color': '#52525a',
      '--affine-placeholder-color': '#52525a',

      // Hover / active — very subtle neutral lift
      '--affine-hover-color': 'rgba(255, 255, 255, 0.04)',
      '--affine-hover-color-filled': '#1f1f22',

      // Icons — neutral gray scale
      '--affine-icon-color': '#8e8e96',
      '--affine-icon-secondary': '#52525a',
      '--affine-v2-icon-primary': '#8e8e96',
      '--affine-v2-icon-secondary': '#606068',
      '--affine-v2-icon-tertiary': '#3e3e44',

      // Text V2 — neutral
      '--affine-v2-text-primary': '#ececf0',
      '--affine-v2-text-secondary': '#8e8e96',
      '--affine-v2-text-tertiary': '#606068',
      '--affine-v2-text-disable': '#3e3e44',

      // Shadows — soft, not aggressive
      '--affine-shadow-1':
        '0px 1px 2px rgba(0, 0, 0, 0.32), 0px 1px 4px rgba(0, 0, 0, 0.20)',
      '--affine-shadow-2':
        '0px 2px 8px rgba(0, 0, 0, 0.36), 0px 4px 14px rgba(0, 0, 0, 0.24)',
      '--affine-shadow-3':
        '0px 4px 14px rgba(0, 0, 0, 0.40), 0px 8px 28px rgba(0, 0, 0, 0.28)',
      '--affine-popover-shadow':
        '0px 4px 18px rgba(0, 0, 0, 0.44), 0px 12px 42px rgba(0, 0, 0, 0.28)',

      // Tooltips — dark neutral
      '--affine-tooltip-background': '#222225',
      '--affine-tooltip-color': '#ececf0',

      // Component surfaces — neutral
      '--affine-v2-layer-background-codeBlock': '#18181b',
      '--affine-v2-layer-background-translucentUI': 'rgba(17, 17, 19, 0.76)',
      '--affine-v2-layer-background-linkedDocOnEdgeless': '#18181b',

      // Component UI — neutral base, brand only on primary CTAs
      '--affine-v2-button-secondary': 'rgba(255, 255, 255, 0.05)',
      '--affine-v2-button-sidebarButton-background': 'rgba(255, 255, 255, 0.03)',
      '--affine-v2-button-siderbarPrimary-background': 'rgba(0, 0, 0, 0.20)',
      '--affine-v2-button-iconButtonSolid': 'rgba(255, 255, 255, 0.06)',
      '--affine-v2-input-background': 'rgba(255, 255, 255, 0.03)',
      '--affine-v2-input-border-default': 'rgba(255, 255, 255, 0.08)',

      // Button gradients — brand color preserved for primary CTAs
      '--affine-v2-button-primary-gradient': 'linear-gradient(135deg, #1e3a8a 0%, #155e75 50%, #0891b2 100%)',
      '--affine-v2-button-primary-hover-gradient': 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 50%, #0891b2 100%)',
      '--affine-v2-button-secondary-accent': 'rgba(6, 182, 212, 0.08)',

      // Badge / highlight — dezent, brand only here
      '--affine-v2-badge-accent-bg': 'rgba(6, 182, 212, 0.10)',
      '--affine-v2-badge-accent-border': 'rgba(6, 182, 212, 0.20)',
      '--affine-v2-badge-accent-text': '#22d3ee',
      '--affine-v2-highlight-secondary': 'rgba(6, 182, 212, 0.06)',

      // Tabs — neutral surfaces
      '--affine-v2-tab-tabBackground-active': '#222225',
      '--affine-v2-tab-tabBackground-default': '#18181b',
      '--affine-v2-tab-tabBackground-hover': '#1e1e21',
      '--affine-v2-tab-divider-divider': 'rgba(255, 255, 255, 0.07)',

      // Other surfaces — neutral
      '--affine-v2-workspacePicker-border': 'rgba(255, 255, 255, 0.08)',
      '--affine-v2-workspacePicker-secondaryBackground': 'rgba(255, 255, 255, 0.03)',
      '--affine-v2-tableOfContent-background': '#18181b',
      '--affine-v2-toast-cardLayer-second': '#18181b',
      '--affine-v2-toast-cardLayer-third': '#18181b',
      '--affine-v2-switch-switchBackground-background': '#222225',
      '--affine-v2-layer-insideBorder-blackBorder': 'rgba(255, 255, 255, 0.04)',
      '--affine-v2-layer-insideBorder-whiteBorder': 'rgba(255, 255, 255, 0.04)',
      '--affine-v2-tooltips-secondaryBackground': 'rgba(255, 255, 255, 0.06)',

      // Noise
      '--affine-noise-opacity': '0.30',
    },
  },
};

export const applyThemeVariantVariables = (
  variant: ThemeVariant,
  mode: ResolvedThemeMode = 'light'
) => {
  const normalized = normalizeThemeVariant(variant);
  const vars = {
    ...variantBaseVars[normalized],
    ...variantModeVars[normalized][mode],
  };
  Object.entries(vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.documentElement.dataset.themeVariant = normalized;
};
