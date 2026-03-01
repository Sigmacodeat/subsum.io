export const DEFAULT_APP_ORIGIN = 'https://app.subsum.io';

export const APP_SIGN_IN_PATH = '/sign-in';
export const APP_SIGN_UP_PATH = '/sign-in?intent=signup';
export const APP_DASHBOARD_PATH = '/';
export const APP_MEMBER_PROFILE_PATH = '/settings?tab=account';
export const APP_SIGN_OUT_PATH = '/api/auth/sign-out';

export function getConfiguredAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || DEFAULT_APP_ORIGIN;
}

export const APP_ORIGIN = getConfiguredAppOrigin();

// Canonical entry URL for marketing CTAs.
// Routes to app root — lets the app handle auth state.
// If logged in → dashboard. If not → sign-in (without forcing signup intent).
export const APP_MARKETING_PRIMARY_CTA_URL = `${APP_ORIGIN}${APP_DASHBOARD_PATH}`;

// Explicit sign-up intent URL (only use where signup intent is mandatory).
export const APP_SIGN_UP_INTENT_URL = `${APP_ORIGIN}${APP_SIGN_UP_PATH}`;

// Backwards-compatible alias for marketing pages — points to app root.
export const APP_SIGN_UP_URL = APP_MARKETING_PRIMARY_CTA_URL;
