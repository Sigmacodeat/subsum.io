import { BRAND_SITE_URL } from '@/brand';
import type { Locale } from '@/i18n/config';
import { buildLocaleUrl } from '@/utils/seo';

type BreadcrumbLabel = { name: string; url: string };

const homeLabels: Record<Locale, string> = {
  en: 'Home',
  'de-DE': 'Startseite',
  'de-AT': 'Startseite',
  'de-CH': 'Startseite',
  fr: 'Accueil',
  'fr-FR': 'Accueil',
  'fr-CH': 'Accueil',
  es: 'Inicio',
  it: 'Home',
  'it-IT': 'Home',
  'it-CH': 'Home',
  pl: 'Strona główna',
  'pt-BR': 'Início',
  'pt-PT': 'Início',
  ja: 'ホーム',
  ko: '홈',
  ar: 'الرئيسية',
};

export function buildLocaleBreadcrumbs(
  locale: Locale,
  pages: Array<{ name: string; path: string }>
): BreadcrumbLabel[] {
  const home = homeLabels[locale] ?? 'Home';
  return [
    { name: home, url: buildLocaleUrl(locale, '') || BRAND_SITE_URL },
    ...pages.map(p => ({ name: p.name, url: buildLocaleUrl(locale, p.path) })),
  ];
}
