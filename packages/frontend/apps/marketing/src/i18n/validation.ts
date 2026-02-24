import {
  defaultLocale,
  type Locale,
  localeMarkets,
  locales,
  localeToSeoHreflang,
} from './config';

let validated = false;

export function assertLocalizationSeoIntegrity() {
  if (validated) return;

  if (!locales.includes(defaultLocale)) {
    throw new Error(
      `Invalid i18n setup: default locale "${defaultLocale}" is not in locales[]`
    );
  }

  for (const locale of locales) {
    if (!localeMarkets[locale]) {
      throw new Error(`Missing locale market config for "${locale}"`);
    }
  }

  const hreflangSeen = new Map<string, Locale>();
  for (const locale of locales) {
    const hreflang = localeToSeoHreflang[locale];
    if (!hreflang) {
      throw new Error(`Missing hreflang mapping for "${locale}"`);
    }

    const existing = hreflangSeen.get(hreflang);
    if (existing && existing !== locale) {
      throw new Error(
        `Duplicate hreflang "${hreflang}" for locales "${existing}" and "${locale}"`
      );
    }

    hreflangSeen.set(hreflang, locale);
  }

  validated = true;
}
