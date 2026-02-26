export const locales = [
  'en',
  'de-DE',
  'de-AT',
  'de-CH',
  'fr',
  'fr-FR',
  'fr-CH',
  'es',
  'it',
  'it-IT',
  'it-CH',
  'pl',
  'pt-BR',
  'pt-PT',
  'ja',
  'ko',
  'ar',
] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export type Region = 'EMEA' | 'AMER' | 'APAC' | 'GLOBAL';

export type LocaleMarket = {
  locale: Locale;
  language: string;
  country: string;
  currency: string;
  timezone: string;
  region: Region;
  seoLanguage: string;
  seoCountry?: string;
  legalJurisdiction: string;
};

export const localeMarkets: Record<Locale, LocaleMarket> = {
  en: {
    locale: 'en',
    language: 'en',
    country: 'US',
    currency: 'USD',
    timezone: 'America/New_York',
    region: 'GLOBAL',
    seoLanguage: 'en',
    legalJurisdiction: 'INT',
  },
  'de-DE': {
    locale: 'de-DE',
    language: 'de',
    country: 'DE',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    region: 'EMEA',
    seoLanguage: 'de',
    seoCountry: 'DE',
    legalJurisdiction: 'DE',
  },
  'de-AT': {
    locale: 'de-AT',
    language: 'de',
    country: 'AT',
    currency: 'EUR',
    timezone: 'Europe/Vienna',
    region: 'EMEA',
    seoLanguage: 'de',
    seoCountry: 'AT',
    legalJurisdiction: 'AT',
  },
  'de-CH': {
    locale: 'de-CH',
    language: 'de',
    country: 'CH',
    currency: 'CHF',
    timezone: 'Europe/Zurich',
    region: 'EMEA',
    seoLanguage: 'de',
    seoCountry: 'CH',
    legalJurisdiction: 'CH',
  },
  fr: {
    locale: 'fr',
    language: 'fr',
    country: 'FR',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    region: 'EMEA',
    seoLanguage: 'fr',
    legalJurisdiction: 'FR',
  },
  'fr-FR': {
    locale: 'fr-FR',
    language: 'fr',
    country: 'FR',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    region: 'EMEA',
    seoLanguage: 'fr',
    seoCountry: 'FR',
    legalJurisdiction: 'FR',
  },
  'fr-CH': {
    locale: 'fr-CH',
    language: 'fr',
    country: 'CH',
    currency: 'CHF',
    timezone: 'Europe/Zurich',
    region: 'EMEA',
    seoLanguage: 'fr',
    seoCountry: 'CH',
    legalJurisdiction: 'CH',
  },
  es: {
    locale: 'es',
    language: 'es',
    country: 'ES',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
    region: 'EMEA',
    seoLanguage: 'es',
    legalJurisdiction: 'ES',
  },
  it: {
    locale: 'it',
    language: 'it',
    country: 'IT',
    currency: 'EUR',
    timezone: 'Europe/Rome',
    region: 'EMEA',
    seoLanguage: 'it',
    legalJurisdiction: 'IT',
  },
  'it-IT': {
    locale: 'it-IT',
    language: 'it',
    country: 'IT',
    currency: 'EUR',
    timezone: 'Europe/Rome',
    region: 'EMEA',
    seoLanguage: 'it',
    seoCountry: 'IT',
    legalJurisdiction: 'IT',
  },
  'it-CH': {
    locale: 'it-CH',
    language: 'it',
    country: 'CH',
    currency: 'CHF',
    timezone: 'Europe/Zurich',
    region: 'EMEA',
    seoLanguage: 'it',
    seoCountry: 'CH',
    legalJurisdiction: 'CH',
  },
  pl: {
    locale: 'pl',
    language: 'pl',
    country: 'PL',
    currency: 'PLN',
    timezone: 'Europe/Warsaw',
    region: 'EMEA',
    seoLanguage: 'pl',
    legalJurisdiction: 'PL',
  },
  'pt-BR': {
    locale: 'pt-BR',
    language: 'pt',
    country: 'BR',
    currency: 'BRL',
    timezone: 'America/Sao_Paulo',
    region: 'AMER',
    seoLanguage: 'pt',
    seoCountry: 'BR',
    legalJurisdiction: 'BR',
  },
  'pt-PT': {
    locale: 'pt-PT',
    language: 'pt',
    country: 'PT',
    currency: 'EUR',
    timezone: 'Europe/Lisbon',
    region: 'EMEA',
    seoLanguage: 'pt',
    seoCountry: 'PT',
    legalJurisdiction: 'PT',
  },
  ja: {
    locale: 'ja',
    language: 'ja',
    country: 'JP',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    region: 'APAC',
    seoLanguage: 'ja',
    legalJurisdiction: 'JP',
  },
  ko: {
    locale: 'ko',
    language: 'ko',
    country: 'KR',
    currency: 'KRW',
    timezone: 'Asia/Seoul',
    region: 'APAC',
    seoLanguage: 'ko',
    legalJurisdiction: 'KR',
  },
  ar: {
    locale: 'ar',
    language: 'ar',
    country: 'SA',
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
    region: 'EMEA',
    seoLanguage: 'ar',
    legalJurisdiction: 'INT',
  },
};

export const localeNames: Record<Locale, string> = {
  en: 'English',
  'de-DE': 'Deutsch (Deutschland)',
  'de-AT': 'Deutsch (Österreich)',
  'de-CH': 'Deutsch (Schweiz)',
  fr: 'Français',
  'fr-FR': 'Français (France)',
  'fr-CH': 'Français (Suisse)',
  es: 'Español',
  it: 'Italiano',
  'it-IT': 'Italiano (Italia)',
  'it-CH': 'Italiano (Svizzera)',
  pl: 'Polski',
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  'de-DE': '🇩🇪',
  'de-AT': '🇦🇹',
  'de-CH': '🇨🇭',
  fr: '🇫🇷',
  'fr-FR': '🇫🇷',
  'fr-CH': '🇨🇭',
  es: '🇪🇸',
  it: '🇮🇹',
  'it-IT': '🇮🇹',
  'it-CH': '🇨🇭',
  pl: '🇵🇱',
  'pt-BR': '🇧🇷',
  'pt-PT': '🇵🇹',
  ja: '🇯🇵',
  ko: '🇰🇷',
  ar: '🇸🇦',
};

/**
 * Maps each locale to its primary legal jurisdiction.
 * Used for SEO, legal content adaptation, and SaaS configuration.
 */
export const localeJurisdiction: Record<Locale, string> = {
  en: localeMarkets.en.legalJurisdiction,
  'de-DE': localeMarkets['de-DE'].legalJurisdiction,
  'de-AT': localeMarkets['de-AT'].legalJurisdiction,
  'de-CH': localeMarkets['de-CH'].legalJurisdiction,
  fr: localeMarkets.fr.legalJurisdiction,
  'fr-FR': localeMarkets['fr-FR'].legalJurisdiction,
  'fr-CH': localeMarkets['fr-CH'].legalJurisdiction,
  es: localeMarkets.es.legalJurisdiction,
  it: localeMarkets.it.legalJurisdiction,
  'it-IT': localeMarkets['it-IT'].legalJurisdiction,
  'it-CH': localeMarkets['it-CH'].legalJurisdiction,
  pl: localeMarkets.pl.legalJurisdiction,
  'pt-BR': localeMarkets['pt-BR'].legalJurisdiction,
  'pt-PT': localeMarkets['pt-PT'].legalJurisdiction,
  ja: localeMarkets.ja.legalJurisdiction,
  ko: localeMarkets.ko.legalJurisdiction,
  ar: localeMarkets.ar.legalJurisdiction,
};

export const rtlLocales: Locale[] = ['ar'];

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export const localeToSeoHreflang: Record<Locale, string> = Object.fromEntries(
  locales.map(locale => {
    const market = localeMarkets[locale];
    return [
      locale,
      market.seoCountry
        ? `${market.seoLanguage}-${market.seoCountry}`
        : market.seoLanguage,
    ];
  })
) as Record<Locale, string>;

export function resolveSeoHreflang(locale: Locale): string {
  return localeToSeoHreflang[locale];
}

export function resolveLocaleMarket(locale: string): LocaleMarket {
  if (locale in localeMarkets) {
    return localeMarkets[locale as Locale];
  }
  return localeMarkets[defaultLocale];
}

const localeMessageBaseMap: Record<Locale, string> = {
  en: 'en',
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
  fr: 'fr',
  'fr-FR': 'fr',
  'fr-CH': 'fr',
  es: 'es',
  it: 'it',
  'it-IT': 'it',
  'it-CH': 'it',
  pl: 'pl',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-BR',
  ja: 'ja',
  ko: 'ko',
  ar: 'ar',
};

export function resolveBaseMessagesLocale(locale: string): string {
  const normalized = normalizeLocaleOrDefault(locale);
  return localeMessageBaseMap[normalized];
}

export function normalizeLocaleOrDefault(locale: string): Locale {
  return locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;
}
