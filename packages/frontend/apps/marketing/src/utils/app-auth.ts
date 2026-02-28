export const DEFAULT_APP_ORIGIN = 'https://app.subsum.io';

export const APP_SIGN_IN_PATH = '/sign-in';
export const APP_SIGN_UP_PATH = '/sign-in?intent=signup';
export const APP_DASHBOARD_PATH = '/';
export const APP_MEMBER_PROFILE_PATH = '/settings?tab=account';
export const APP_SIGN_OUT_PATH = '/api/auth/sign-out';

export function getConfiguredAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || DEFAULT_APP_ORIGIN;
}
