import en from './en.json' with { type: 'json' };

export type Language =
  | 'en'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'fr'
  | 'es'
  | 'es-AR'
  | 'es-CL'
  | 'pl'
  | 'de'
  | 'ru'
  | 'ja'
  | 'it'
  | 'ca'
  | 'da'
  | 'hi'
  | 'sv-SE'
  | 'ur'
  | 'ar'
  | 'uk'
  | 'ko'
  | 'pt-BR'
  | 'fa'
  | 'nb-NO'
  | 'nl'
  | 'pt-PT'
  | 'fi'
  | 'cs'
  | 'hu'
  | 'ro'
  | 'bg'
  | 'hr'
  | 'sk'
  | 'si'
  | 'et'
  | 'lv'
  | 'lt'
  | 'ga'
  | 'mt';

export type LanguageResource = typeof en;
export const SUPPORTED_LANGUAGES: Record<
  Language,
  {
    name: string;
    originalName: string;
    flagEmoji: string;
    resource:
      | LanguageResource
      | (() => Promise<{ default: Partial<LanguageResource> }>);
  }
> = {
  en: {
    name: 'English',
    originalName: 'English',
    flagEmoji: '🇬🇧',
    resource: en,
  },
  ko: {
    name: 'Korean (South Korea)',
    originalName: '한국어(대한민국)',
    flagEmoji: '🇰🇷',
    resource: () => import('./ko.json'),
  },
  'pt-BR': {
    name: 'Portuguese (Brazil)',
    originalName: 'português (Brasil)',
    flagEmoji: '🇧🇷',
    resource: () => import('./pt-BR.json'),
  },
  'zh-Hans': {
    name: 'Simplified Chinese',
    originalName: '简体中文',
    flagEmoji: '🇨🇳',
    resource: () => import('./zh-Hans.json'),
  },
  'zh-Hant': {
    name: 'Traditional Chinese',
    originalName: '繁體中文',
    flagEmoji: '🇭🇰',
    resource: () => import('./zh-Hant.json'),
  },
  fr: {
    name: 'French',
    originalName: 'français',
    flagEmoji: '🇫🇷',
    resource: () => import('./fr.json'),
  },
  es: {
    name: 'Spanish',
    originalName: 'español',
    flagEmoji: '🇪🇸',
    resource: () => import('./es.json'),
  },
  'es-AR': {
    name: 'Spanish (Argentina)',
    originalName: 'español (Argentina)',
    flagEmoji: '🇦🇷',
    resource: () => import('./es-AR.json'),
  },
  'es-CL': {
    name: 'Spanish (Chile)',
    originalName: 'español (Chile)',
    flagEmoji: '🇨🇱',
    resource: () => import('./es-CL.json'),
  },
  pl: {
    name: 'Polish',
    originalName: 'Polski',
    flagEmoji: '🇵🇱',
    resource: () => import('./pl.json'),
  },
  de: {
    name: 'German',
    originalName: 'Deutsch',
    flagEmoji: '🇩🇪',
    resource: () => import('./de.json'),
  },
  ru: {
    name: 'Russian',
    originalName: 'русский',
    flagEmoji: '🇷🇺',
    resource: () => import('./ru.json'),
  },
  ja: {
    name: 'Japanese',
    originalName: '日本語',
    flagEmoji: '🇯🇵',
    resource: () => import('./ja.json'),
  },
  it: {
    name: 'Italian',
    originalName: 'italiano',
    flagEmoji: '🇮🇹',
    resource: () => import('./it.json'),
  },
  ca: {
    name: 'Catalan',
    originalName: 'català',
    flagEmoji: '🇦🇩',
    resource: () => import('./ca.json'),
  },
  da: {
    name: 'Danish',
    originalName: 'dansk',
    flagEmoji: '🇩🇰',
    resource: () => import('./da.json'),
  },
  hi: {
    name: 'Hindi',
    originalName: 'हिन्दी',
    flagEmoji: '🇮🇳',
    resource: () => import('./hi.json'),
  },
  'sv-SE': {
    name: 'Swedish (Sweden)',
    originalName: 'svenska (Sverige)',
    flagEmoji: '🇸🇪',
    resource: () => import('./sv-SE.json'),
  },
  ur: {
    name: 'Urdu',
    originalName: 'اردو',
    flagEmoji: '🇵🇰',
    resource: () => import('./ur.json'),
  },
  ar: {
    name: 'Arabic',
    originalName: 'العربية',
    flagEmoji: '🇸🇦',
    resource: () => import('./ar.json'),
  },
  fa: {
    name: 'Persian',
    originalName: 'فارسی',
    flagEmoji: '🇮🇷',
    resource: () => import('./fa.json'),
  },
  uk: {
    name: 'Ukrainian',
    originalName: 'українська',
    flagEmoji: '🇺🇦',
    resource: () => import('./uk.json'),
  },
  'nb-NO': {
    name: 'Norwegian',
    originalName: 'Norsk (Bokmål)',
    flagEmoji: '🇳🇴',
    resource: () => import('./nb-NO.json'),
  },
  nl: {
    name: 'Dutch',
    originalName: 'Nederlands',
    flagEmoji: '🇳🇱',
    resource: () => import('./nl.json'),
  },
  'pt-PT': {
    name: 'Portuguese (Portugal)',
    originalName: 'português (Portugal)',
    flagEmoji: '🇵🇹',
    resource: () => import('./pt-PT.json'),
  },
  fi: {
    name: 'Finnish',
    originalName: 'suomi',
    flagEmoji: '🇫🇮',
    resource: () => import('./fi.json'),
  },
  cs: {
    name: 'Czech',
    originalName: 'čeština',
    flagEmoji: '🇨🇿',
    resource: () => import('./cs.json'),
  },
  hu: {
    name: 'Hungarian',
    originalName: 'magyar',
    flagEmoji: '🇭🇺',
    resource: () => import('./hu.json'),
  },
  ro: {
    name: 'Romanian',
    originalName: 'română',
    flagEmoji: '🇷🇴',
    resource: () => import('./ro.json'),
  },
  bg: {
    name: 'Bulgarian',
    originalName: 'български',
    flagEmoji: '🇧🇬',
    resource: () => import('./bg.json'),
  },
  hr: {
    name: 'Croatian',
    originalName: 'hrvatski',
    flagEmoji: '🇭🇷',
    resource: () => import('./hr.json'),
  },
  sk: {
    name: 'Slovak',
    originalName: 'slovenčina',
    flagEmoji: '🇸🇰',
    resource: () => import('./sk.json'),
  },
  si: {
    name: 'Slovenian',
    originalName: 'slovenščina',
    flagEmoji: '🇸🇮',
    resource: () => import('./si.json'),
  },
  et: {
    name: 'Estonian',
    originalName: 'eesti',
    flagEmoji: '🇪🇪',
    resource: () => import('./et.json'),
  },
  lv: {
    name: 'Latvian',
    originalName: 'latviešu',
    flagEmoji: '🇱🇻',
    resource: () => import('./lv.json'),
  },
  lt: {
    name: 'Lithuanian',
    originalName: 'lietuvių',
    flagEmoji: '🇱🇹',
    resource: () => import('./lt.json'),
  },
  ga: {
    name: 'Irish',
    originalName: 'Gaeilge',
    flagEmoji: '🇬🇮',
    resource: () => import('./ga.json'),
  },
  mt: {
    name: 'Maltese',
    originalName: 'Malti',
    flagEmoji: '🇲🇹',
    resource: () => import('./mt.json'),
  },
};
