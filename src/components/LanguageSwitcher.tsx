'use client';

import { clsx } from 'clsx';
import { ChevronDown, Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { type Locale, localeFlags, localeNames, locales } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/routing';

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 text-[12px] xl:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors focus-ring whitespace-nowrap max-w-[10.75rem] 2xl:max-w-none"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="language-switcher-listbox"
        aria-label="Select language"
      >
        <Globe className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
        <span className="hidden sm:inline">{localeFlags[locale]}</span>
        <span className="hidden 2xl:inline truncate">
          {localeNames[locale]}
        </span>
        <ChevronDown
          className={clsx(
            'w-3 h-3 xl:w-3.5 xl:h-3.5 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          id="language-switcher-listbox"
          className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-fade-in"
          role="listbox"
          aria-label="Languages"
        >
          {locales.map(l => (
            <button
              key={l}
              role="option"
              aria-selected={l === locale}
              onClick={() => switchLocale(l)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left focus-ring',
                l === locale
                  ? 'text-primary-600 bg-primary-50 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <span className="text-base flex-shrink-0">{localeFlags[l]}</span>
              <span className="truncate text-left flex-1 min-w-0">
                {localeNames[l]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
