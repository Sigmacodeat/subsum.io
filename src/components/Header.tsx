'use client';

import { clsx } from 'clsx';
import { ArrowUpRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BRAND_TAGLINE } from '@/brand';
import { Link, usePathname } from '@/i18n/routing';

import { MagneticButton } from './animations';
import BrandWordmark from './BrandWordmark';
import LanguageSwitcher from './LanguageSwitcher';
import LocBrandChip from './LocBrandChip';

const primaryNavLinks = [
  { href: '/features', key: 'features' },
  { href: '/semantic-database', key: 'semanticDatabase' },
  { href: '/quick-check', key: 'quickCheck' },
  { href: '/pricing', key: 'pricing' },
  { href: '/systems', key: 'download' },
] as const;

type RemoteAuthSession = {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.cookie
    .split('; ')
    .find(cookie => cookie.startsWith(`${name}=`))
    ?.split('=')[1];
}

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || 'https://app.subsum.io';
const APP_SIGN_IN_PATH = '/sign-in';
const APP_SIGN_UP_PATH = '/sign-in?redirect_uri=%2F&intent=signup';
const APP_DASHBOARD_PATH = '/';
const APP_MEMBER_PROFILE_PATH = '/settings?tab=account';
const APP_SIGN_OUT_PATH = '/api/auth/sign-out';
const APP_ORIGIN_CANDIDATES = Array.from(
  new Set([APP_ORIGIN, 'https://app.subsumio.com', 'https://app.subsum.io'])
);

export default function Header() {
  const t = useTranslations('nav');
  const tb = useTranslations('brand');
  const pathname = usePathname();
  const logoutLabel = t.has('logout') ? t('logout') : 'Abmelden';
  const loggingOutLabel = t.has('loggingOut') ? t('loggingOut') : 'Abmelden...';
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthHydrated, setIsAuthHydrated] = useState(false);
  const [authOrigin, setAuthOrigin] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const revalidateAuthSession = useCallback(async () => {
    for (const origin of APP_ORIGIN_CANDIDATES) {
      try {
        const response = await fetch(`${origin}/api/auth/session`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          continue;
        }

        const session = (await response.json()) as RemoteAuthSession;
        if (session?.user) {
          setIsAuthenticated(true);
          setAuthOrigin(origin);
          setIsAuthHydrated(true);
          return;
        }
      } catch {
        continue;
      }
    }

    setIsAuthenticated(false);
    setAuthOrigin(null);
    setIsAuthHydrated(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const targetOrigin = authOrigin ?? APP_ORIGIN_CANDIDATES[0];
    const csrfToken = getCookieValue('affine_csrf_token');

    try {
      await fetch(`${targetOrigin}${APP_SIGN_OUT_PATH}`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: csrfToken
          ? {
              'x-affine-csrf-token': csrfToken,
            }
          : undefined,
      });
    } catch {
      // best effort; UI state is reset below to avoid stale authenticated actions
    } finally {
      setIsAuthenticated(false);
      setAuthOrigin(null);
      setIsAuthHydrated(true);
      setIsSigningOut(false);
    }
  }, [authOrigin, isSigningOut]);

  const activeAppOrigin = authOrigin ?? APP_ORIGIN_CANDIDATES[0];

  const isActivePath = useCallback(
    (href: string) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  );

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    );
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const openMobileMenu = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  // Focus management: focus first item on open, return focus to toggle on close
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isMobileOpen) {
      window.setTimeout(() => {
        const root = mobileMenuRef.current;
        if (!root) return;
        const firstFocusable = root.querySelector<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 0);
      return;
    }

    mobileToggleRef.current?.focus();
  }, [isMobileOpen]);

  // Focus trap inside mobile menu
  useEffect(() => {
    if (!isMobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const root = mobileMenuRef.current;
      if (!root) return;

      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (
        event.shiftKey &&
        (active === first || !root.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileOpen]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [closeMobileMenu]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1280) {
        closeMobileMenu();
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [closeMobileMenu]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;

    if (isMobileOpen) {
      const scrollbarCompensation =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarCompensation > 0) {
        document.body.style.paddingRight = `${scrollbarCompensation}px`;
      }
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isMobileOpen]);

  useEffect(() => {
    void revalidateAuthSession();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void revalidateAuthSession();
      }
    };

    window.addEventListener('focus', () => void revalidateAuthSession());
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', revalidateAuthSession);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [revalidateAuthSession]);

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-[70] transition-all duration-500',
        isScrolled
          ? 'bg-white/80 backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] border-b border-slate-200/50'
          : 'bg-transparent'
      )}
    >
      <div className="container-wide">
        <nav
          className="flex items-center h-14 sm:h-16 lg:h-[4.25rem] xl:h-[4.5rem] gap-1.5 sm:gap-2 lg:gap-2.5 xl:gap-3"
          aria-label={t('mainNavigationAriaLabel')}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-1 sm:gap-2 group focus-ring rounded-lg shrink-0"
            aria-label={tb('homeAriaLabel')}
          >
            <LocBrandChip
              className="shrink-0"
              label="SUB"
              title={tb('locTooltip')}
              ariaLabel={tb('locAriaLabel')}
            />
            <div className="flex flex-col min-w-0">
              <BrandWordmark className="text-[13px] min-[380px]:text-sm sm:text-[0.95rem] xl:text-base font-bold leading-tight text-slate-900" />
              <span className="text-[10px] font-medium text-primary-600 tracking-wider uppercase -mt-0.5 whitespace-nowrap hidden lg:block">
                {BRAND_TAGLINE}
              </span>
            </div>
          </Link>

          {/* Tablet Quick Nav */}
          <div className="hidden md:flex xl:hidden flex-1 items-center justify-center gap-0.5 lg:gap-0.5 min-w-0 px-1 lg:px-2">
            {primaryNavLinks.map(link => (
              <Link
                key={link.key}
                href={link.href}
                className={clsx(
                  'relative inline-flex items-center px-2 lg:px-2.5 py-1.5 text-[11.5px] lg:text-[12px] font-semibold tracking-[-0.01em] rounded-lg transition-all duration-300 focus-ring whitespace-nowrap',
                  isActivePath(link.href)
                    ? 'text-primary-700 bg-primary-50/80 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.16)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                )}
              >
                {t(link.key)}
              </Link>
            ))}
          </div>

          {/* Desktop Nav */}
          <div className="hidden xl:flex flex-1 items-center justify-center gap-0.5 min-w-0 px-1 2xl:px-4">
            {primaryNavLinks.map((link, index) => (
              <Link
                key={link.key}
                href={link.href}
                className={clsx(
                  'group relative inline-flex items-center px-2.5 xl:px-3 py-1.5 text-[12px] xl:text-[12.5px] font-semibold tracking-[-0.01em] rounded-xl transition-all duration-300 focus-ring whitespace-nowrap',
                  isActivePath(link.href)
                    ? 'text-primary-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70',
                  index === 0 && 'ml-0'
                )}
              >
                {t(link.key)}
                {/* Active indicator line */}
                <span
                  className={clsx(
                    'absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-primary-600 transition-all duration-300',
                    isActivePath(link.href)
                      ? 'w-6 opacity-100'
                      : 'w-0 opacity-0 group-hover:w-4 group-hover:opacity-70'
                  )}
                />
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden xl:flex items-center gap-1.5 2xl:gap-2.5 shrink-0 ml-auto">
            <LanguageSwitcher />
            {isAuthHydrated && isAuthenticated ? (
              <>
                <a
                  href={`${activeAppOrigin}${APP_MEMBER_PROFILE_PATH}`}
                  className="text-[13px] xl:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 xl:px-4 py-2 transition-colors duration-300 focus-ring rounded-lg whitespace-nowrap"
                >
                  {t('memberProfile')}
                </a>
                <a
                  href={`${activeAppOrigin}${APP_DASHBOARD_PATH}`}
                  className="btn-primary !px-4 xl:!px-5 !py-2.5 !text-[13px] xl:!text-sm focus-ring whitespace-nowrap inline-flex items-center gap-1.5"
                >
                  <span>{t('dashboard')}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="text-[13px] xl:text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-400 px-3 xl:px-4 py-2 transition-colors duration-300 focus-ring rounded-lg whitespace-nowrap"
                >
                  {isSigningOut ? loggingOutLabel : logoutLabel}
                </button>
              </>
            ) : isAuthHydrated ? (
              <>
                <a
                  href={`${activeAppOrigin}${APP_SIGN_IN_PATH}`}
                  className="text-[13px] xl:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 xl:px-4 py-2 transition-colors duration-300 focus-ring rounded-lg whitespace-nowrap"
                >
                  {t('login')}
                </a>
                <MagneticButton strength={0.15}>
                  <a
                    href={`${activeAppOrigin}${APP_SIGN_UP_PATH}`}
                    className="btn-primary !px-4 xl:!px-5 !py-2.5 !text-[13px] xl:!text-sm focus-ring whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <span>{t('startFree')}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </MagneticButton>
              </>
            ) : null}
          </div>

          {/* Tablet Actions */}
          <div className="hidden md:flex xl:hidden items-center gap-1.5 lg:gap-2 xl:gap-2.5 shrink-0 ml-auto">
            <LanguageSwitcher />
            {isAuthHydrated && isAuthenticated ? (
              <>
                <a
                  href={`${activeAppOrigin}${APP_DASHBOARD_PATH}`}
                  className="hidden lg:inline-flex items-center text-[12.5px] font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-2 transition-colors duration-300 focus-ring rounded-lg whitespace-nowrap"
                >
                  {t('dashboard')}
                </a>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="hidden lg:inline-flex items-center text-[12.5px] font-semibold text-slate-700 hover:text-slate-900 disabled:text-slate-400 px-2.5 py-2 transition-colors duration-300 focus-ring rounded-lg whitespace-nowrap"
                >
                  {isSigningOut ? loggingOutLabel : logoutLabel}
                </button>
              </>
            ) : isAuthHydrated ? (
              <a
                href={`${activeAppOrigin}${APP_SIGN_IN_PATH}`}
                className="hidden lg:inline-flex items-center text-[12.5px] font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-2 transition-colors duration-300 focus-ring rounded-lg whitespace-nowrap"
              >
                {t('login')}
              </a>
            ) : null}
          </div>

          {/* Mobile Toggle */}
          <button
            ref={mobileToggleRef}
            className={clsx(
              'md:hidden relative p-1.5 sm:p-2 rounded-lg transition-colors duration-300 ease-out-expo focus-ring ml-auto',
              isMobileOpen
                ? 'bg-primary-50 text-primary-700'
                : 'hover:bg-slate-100'
            )}
            onClick={() =>
              isMobileOpen ? closeMobileMenu() : openMobileMenu()
            }
            aria-expanded={isMobileOpen}
            aria-controls="main-mobile-menu"
            aria-haspopup="dialog"
            aria-label={isMobileOpen ? t('closeMenu') : t('openMenu')}
          >
            <div className="relative w-6 h-6">
              <span
                className={clsx(
                  'absolute left-0 w-6 h-0.5 bg-slate-700 rounded transition-all duration-500 ease-out-expo',
                  isMobileOpen ? 'top-[11px] rotate-45' : 'top-[5px] rotate-0'
                )}
              />
              <span
                className={clsx(
                  'absolute left-0 top-[11px] w-6 h-0.5 bg-slate-700 rounded transition-all duration-400 ease-out-expo',
                  isMobileOpen
                    ? 'opacity-0 scale-x-0'
                    : 'opacity-100 scale-x-100'
                )}
              />
              <span
                className={clsx(
                  'absolute left-0 w-6 h-0.5 bg-slate-700 rounded transition-all duration-500 ease-out-expo',
                  isMobileOpen ? 'top-[11px] -rotate-45' : 'top-[17px] rotate-0'
                )}
              />
            </div>
          </button>
        </nav>
      </div>

      {/* Mobile Menu — Slide-down overlay */}
      <button
        type="button"
        className={clsx(
          'md:hidden fixed inset-0 z-[72] bg-slate-950/30 backdrop-blur-[2px] transition-opacity duration-400 ease-out-expo',
          isMobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        )}
        aria-label={t('closeMenuOverlay')}
        onClick={closeMobileMenu}
      />

      <div
        id="main-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t('mobileMenuLabel')}
        ref={mobileMenuRef}
        className={clsx(
          'md:hidden fixed inset-x-0 top-16 sm:top-[4.5rem] lg:top-[4.75rem] xl:top-20 bottom-0 md:inset-x-4 lg:inset-x-6 md:top-[calc(4.5rem+0.5rem)] lg:top-[calc(4.75rem+0.5rem)] xl:top-[calc(5rem+0.5rem)] md:bottom-4 z-[75] origin-top border-b md:border border-slate-200/70 bg-white/95 backdrop-blur-2xl md:rounded-2xl shadow-[0_20px_48px_rgba(15,23,42,0.14)] transition-all duration-500 ease-out-expo',
          isMobileOpen
            ? 'opacity-100 translate-y-0 scale-y-100 pointer-events-auto'
            : 'opacity-0 -translate-y-4 scale-y-[0.98] pointer-events-none'
        )}
      >
        <div className="container-wide py-6 sm:py-8 md:py-7 lg:py-8 space-y-2 h-full overflow-y-auto">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
              {t('navigationLabel')}
            </span>
            <button
              type="button"
              onClick={closeMobileMenu}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors duration-200 focus-ring"
              aria-label={t('closeNavigationMenu')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-primary-200 to-transparent" />
          {primaryNavLinks.map((link, i) => (
            <Link
              key={link.key}
              href={link.href}
              className={clsx(
                'block px-4 lg:px-5 py-3.5 md:py-3.5 lg:py-4 text-[1.02rem] sm:text-lg md:text-[1.05rem] font-semibold tracking-[-0.01em] leading-6 rounded-xl transition-all duration-300 ease-out-expo focus-ring whitespace-nowrap',
                isActivePath(link.href)
                  ? 'text-primary-700 bg-primary-50/90 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.16)]'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              )}
              onClick={closeMobileMenu}
              style={{
                transitionDelay: prefersReducedMotion
                  ? '0ms'
                  : isMobileOpen
                    ? `${i * 50}ms`
                    : '0ms',
                opacity: prefersReducedMotion ? 1 : isMobileOpen ? 1 : 0,
                transform: prefersReducedMotion
                  ? 'none'
                  : isMobileOpen
                    ? 'translateX(0)'
                    : 'translateX(-10px)',
              }}
            >
              {t(link.key)}
            </Link>
          ))}
          <div
            className="pt-6 border-t border-slate-100 mt-4 space-y-3"
            style={{
              transitionDelay: prefersReducedMotion
                ? '0ms'
                : isMobileOpen
                  ? '280ms'
                  : '0ms',
              opacity: prefersReducedMotion ? 1 : isMobileOpen ? 1 : 0,
              transition: prefersReducedMotion
                ? 'none'
                : 'opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <LanguageSwitcher />
            {isAuthHydrated && isAuthenticated ? (
              <>
                <a
                  href={`${activeAppOrigin}${APP_MEMBER_PROFILE_PATH}`}
                  onClick={closeMobileMenu}
                  className="block text-center py-3 text-base font-semibold tracking-[-0.01em] text-slate-700 hover:text-slate-900 focus-ring rounded-lg whitespace-nowrap transition-colors duration-300"
                >
                  {t('memberProfile')}
                </a>
                <a
                  href={`${activeAppOrigin}${APP_DASHBOARD_PATH}`}
                  onClick={closeMobileMenu}
                  className="btn-primary w-full !text-base !font-semibold !tracking-[-0.01em] focus-ring whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                >
                  <span>{t('dashboard')}</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    void handleSignOut();
                  }}
                  disabled={isSigningOut}
                  className="w-full block text-center py-3 text-base font-semibold tracking-[-0.01em] text-slate-700 hover:text-slate-900 disabled:text-slate-400 focus-ring rounded-lg whitespace-nowrap transition-colors duration-300"
                >
                  {isSigningOut ? loggingOutLabel : logoutLabel}
                </button>
              </>
            ) : isAuthHydrated ? (
              <>
                <a
                  href={`${activeAppOrigin}${APP_SIGN_IN_PATH}`}
                  onClick={closeMobileMenu}
                  className="block text-center py-3 text-base font-semibold tracking-[-0.01em] text-slate-700 hover:text-slate-900 focus-ring rounded-lg whitespace-nowrap transition-colors duration-300"
                >
                  {t('login')}
                </a>
                <a
                  href={`${activeAppOrigin}${APP_SIGN_UP_PATH}`}
                  onClick={closeMobileMenu}
                  className="btn-primary w-full !text-base !font-semibold !tracking-[-0.01em] focus-ring whitespace-nowrap"
                >
                  {t('startFree')}
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
