import type { Locale } from '@/i18n/config';
import type { SeoIndexablePath } from '@/utils/seo-routes';

export type SeoIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational';

export type SeoContentCluster = {
  cluster: string;
  intent: SeoIntent;
  primaryKeywords: string[];
  secondaryKeywords?: string[];
};

type LocaleClusters = Partial<Record<SeoIndexablePath, SeoContentCluster>>;

export const seoContentClusters: Partial<Record<Locale, LocaleClusters>> = {
  en: {
    '': {
      cluster: 'homepage-global',
      intent: 'navigational',
      primaryKeywords: ['legal ai platform', 'law firm software'],
      secondaryKeywords: ['ai document analysis', 'legal operations ai'],
    },
    '/pricing': {
      cluster: 'pricing-core',
      intent: 'commercial',
      primaryKeywords: ['legal ai pricing', 'tax advisory software pricing'],
      secondaryKeywords: [
        'compliance platform pricing',
        'ai workspace pricing',
      ],
    },
    '/contact': {
      cluster: 'contact-conversion',
      intent: 'transactional',
      primaryKeywords: ['book legal ai demo', 'contact legal ai team'],
    },
    '/security': {
      cluster: 'trust-security',
      intent: 'informational',
      primaryKeywords: ['legal ai security', 'gdpr compliant legal software'],
      secondaryKeywords: ['soc2 legal platform', 'law firm data protection'],
    },
    '/features': {
      cluster: 'features-core',
      intent: 'informational',
      primaryKeywords: ['legal ai features', 'document analysis ai'],
      secondaryKeywords: [
        'contradiction detection software',
        'case law research ai',
      ],
    },
    '/quick-check': {
      cluster: 'quick-check-core',
      intent: 'transactional',
      primaryKeywords: [
        'legal document quick check',
        'case file quick analysis',
      ],
      secondaryKeywords: [
        'legal intake qualification',
        'ai case risk pre check',
      ],
    },
    '/about': {
      cluster: 'about-brand',
      intent: 'navigational',
      primaryKeywords: ['legal ai company', 'law firm automation startup'],
    },
  },

  'de-DE': {
    '': {
      cluster: 'homepage-de',
      intent: 'navigational',
      primaryKeywords: [
        'juristische ki plattform',
        'kanzlei software deutschland',
      ],
      secondaryKeywords: [
        'ki dokumentenanalyse kanzlei',
        'rechtsanwalt software ki',
      ],
    },
    '/pricing': {
      cluster: 'pricing-de',
      intent: 'commercial',
      primaryKeywords: [
        'steuerberater software preise',
        'kanzlei software preise deutschland',
      ],
      secondaryKeywords: [
        'ki steuerberatung kosten',
        'rechtsanwalt software kosten',
      ],
    },
    '/contact': {
      cluster: 'contact-de',
      intent: 'transactional',
      primaryKeywords: [
        'steuer software demo buchen',
        'kanzlei software kontakt deutschland',
      ],
    },
    '/security': {
      cluster: 'trust-de',
      intent: 'informational',
      primaryKeywords: [
        'dsgvo konforme kanzlei software',
        'datenschutz rechtsanwalt software',
      ],
      secondaryKeywords: [
        'iso 27001 legal software deutschland',
        'eu rechenzentrum kanzlei',
      ],
    },
    '/features': {
      cluster: 'features-de',
      intent: 'informational',
      primaryKeywords: [
        'ki dokumentenanalyse kanzlei',
        'widerspruchserkennung software',
      ],
      secondaryKeywords: ['fristenverwaltung anwalt', 'judikatur recherche ki'],
    },
    '/quick-check': {
      cluster: 'quick-check-de',
      intent: 'transactional',
      primaryKeywords: ['akte quick check', 'aktenanalyse online'],
      secondaryKeywords: [
        'ki vorprüfung akte',
        'juristische dokumentenprüfung',
      ],
    },
  },

  'de-AT': {
    '': {
      cluster: 'homepage-at',
      intent: 'navigational',
      primaryKeywords: [
        'juristische ki plattform österreich',
        'kanzlei software wien',
      ],
    },
    '/pricing': {
      cluster: 'pricing-at',
      intent: 'commercial',
      primaryKeywords: [
        'steuerberater software österreich',
        'kanzlei software wien',
      ],
      secondaryKeywords: [
        'rechtsanwalt software österreich',
        'abgb ki analyse',
      ],
    },
    '/security': {
      cluster: 'trust-at',
      intent: 'informational',
      primaryKeywords: [
        'dsgvo österreich kanzlei software',
        'datenschutz anwalt österreich',
      ],
    },
    '/quick-check': {
      cluster: 'quick-check-at',
      intent: 'transactional',
      primaryKeywords: [
        'akte quick check österreich',
        'ki aktenanalyse österreich',
      ],
    },
  },

  'de-CH': {
    '': {
      cluster: 'homepage-ch-de',
      intent: 'navigational',
      primaryKeywords: [
        'juristische ki plattform schweiz',
        'treuhand software schweiz',
      ],
    },
    '/pricing': {
      cluster: 'pricing-ch-de',
      intent: 'commercial',
      primaryKeywords: ['treuhand software schweiz', 'anwalt software zürich'],
      secondaryKeywords: [
        'steuerberatung software schweiz',
        'or zgb ki analyse',
      ],
    },
    '/security': {
      cluster: 'trust-ch-de',
      intent: 'informational',
      primaryKeywords: [
        'revdsg konforme software',
        'datenschutz anwalt schweiz',
      ],
    },
    '/quick-check': {
      cluster: 'quick-check-ch-de',
      intent: 'transactional',
      primaryKeywords: [
        'akte quick check schweiz',
        'ki dokumentenprüfung schweiz',
      ],
    },
  },

  fr: {
    '': {
      cluster: 'homepage-fr',
      intent: 'navigational',
      primaryKeywords: ['logiciel ia juridique', 'logiciel cabinet avocat'],
    },
    '/pricing': {
      cluster: 'pricing-fr',
      intent: 'commercial',
      primaryKeywords: [
        'tarif logiciel avocat ia',
        'prix logiciel cabinet juridique',
      ],
      secondaryKeywords: [
        'logiciel compliance ia tarif',
        'logiciel expertise comptable ia',
      ],
    },
    '/security': {
      cluster: 'trust-fr',
      intent: 'informational',
      primaryKeywords: [
        'logiciel avocat rgpd',
        'sécurité données cabinet avocat',
      ],
    },
    '/contact': {
      cluster: 'contact-fr',
      intent: 'transactional',
      primaryKeywords: [
        'démo logiciel avocat ia',
        'contact logiciel juridique ia',
      ],
    },
    '/features': {
      cluster: 'features-fr',
      intent: 'informational',
      primaryKeywords: [
        'analyse documents ia avocat',
        'détection contradictions contrats',
      ],
    },
  },

  'fr-FR': {
    '/pricing': {
      cluster: 'pricing-fr-fr',
      intent: 'commercial',
      primaryKeywords: [
        'logiciel cabinet avocat france',
        'tarif logiciel juridique ia france',
      ],
      secondaryKeywords: [
        'logiciel expertise comptable ia',
        'rgpd logiciel juridique france',
      ],
    },
    '/security': {
      cluster: 'trust-fr-fr',
      intent: 'informational',
      primaryKeywords: [
        'rgpd logiciel avocat france',
        'iso 27001 logiciel juridique',
      ],
    },
  },

  'fr-CH': {
    '/pricing': {
      cluster: 'pricing-fr-ch',
      intent: 'commercial',
      primaryKeywords: [
        'logiciel avocat suisse romande',
        'logiciel fiduciaire suisse',
      ],
    },
    '/security': {
      cluster: 'trust-fr-ch',
      intent: 'informational',
      primaryKeywords: [
        'sécurité données juridiques suisse',
        'logiciel avocat suisse rgpd',
      ],
    },
  },

  es: {
    '': {
      cluster: 'homepage-es',
      intent: 'navigational',
      primaryKeywords: ['software ia juridico', 'software despacho abogados'],
    },
    '/pricing': {
      cluster: 'pricing-es',
      intent: 'commercial',
      primaryKeywords: [
        'precio software abogados ia',
        'software despacho juridico precio',
      ],
      secondaryKeywords: [
        'plataforma compliance ia precio',
        'software fiscal ia españa',
      ],
    },
    '/security': {
      cluster: 'trust-es',
      intent: 'informational',
      primaryKeywords: ['rgpd software abogados', 'seguridad datos juridicos'],
    },
    '/contact': {
      cluster: 'contact-es',
      intent: 'transactional',
      primaryKeywords: [
        'demo software abogados ia',
        'contacto software juridico ia',
      ],
    },
    '/features': {
      cluster: 'features-es',
      intent: 'informational',
      primaryKeywords: [
        'analisis documentos ia abogados',
        'deteccion contradicciones contratos',
      ],
    },
  },

  it: {
    '': {
      cluster: 'homepage-it',
      intent: 'navigational',
      primaryKeywords: ['software ia legale', 'software studio legale'],
    },
    '/pricing': {
      cluster: 'pricing-it',
      intent: 'commercial',
      primaryKeywords: [
        'prezzo software avvocati ia',
        'software studio legale prezzo',
      ],
      secondaryKeywords: [
        'piattaforma compliance ia prezzo',
        'software fiscale ia italia',
      ],
    },
    '/security': {
      cluster: 'trust-it',
      intent: 'informational',
      primaryKeywords: ['gdpr software avvocati', 'sicurezza dati legali'],
    },
    '/contact': {
      cluster: 'contact-it',
      intent: 'transactional',
      primaryKeywords: [
        'demo software avvocati ia',
        'contatto software legale ia',
      ],
    },
    '/features': {
      cluster: 'features-it',
      intent: 'informational',
      primaryKeywords: [
        'analisi documenti ia avvocati',
        'rilevamento contraddizioni contratti',
      ],
    },
  },

  'it-IT': {
    '/pricing': {
      cluster: 'pricing-it-it',
      intent: 'commercial',
      primaryKeywords: [
        'software studio legale italia',
        'prezzo software legale ia italia',
      ],
      secondaryKeywords: [
        'software commercialista ia',
        'gdpr software legale italia',
      ],
    },
  },

  'it-CH': {
    '/pricing': {
      cluster: 'pricing-it-ch',
      intent: 'commercial',
      primaryKeywords: [
        'software avvocato svizzera italiana',
        'software fiduciario svizzera',
      ],
    },
  },

  pl: {
    '': {
      cluster: 'homepage-pl',
      intent: 'navigational',
      primaryKeywords: [
        'oprogramowanie ai prawnicze',
        'oprogramowanie kancelaria prawna',
      ],
    },
    '/pricing': {
      cluster: 'pricing-pl',
      intent: 'commercial',
      primaryKeywords: [
        'cena oprogramowanie prawnicze ai',
        'oprogramowanie kancelaria cena',
      ],
      secondaryKeywords: [
        'platforma compliance ai cena',
        'oprogramowanie podatkowe ai polska',
      ],
    },
    '/security': {
      cluster: 'trust-pl',
      intent: 'informational',
      primaryKeywords: [
        'rodo oprogramowanie prawnicze',
        'bezpieczenstwo danych kancelaria',
      ],
    },
    '/contact': {
      cluster: 'contact-pl',
      intent: 'transactional',
      primaryKeywords: [
        'demo oprogramowanie prawnicze ai',
        'kontakt oprogramowanie prawnicze',
      ],
    },
    '/features': {
      cluster: 'features-pl',
      intent: 'informational',
      primaryKeywords: [
        'analiza dokumentow ai kancelaria',
        'wykrywanie sprzecznosci umowy',
      ],
    },
  },

  'pt-BR': {
    '': {
      cluster: 'homepage-pt-br',
      intent: 'navigational',
      primaryKeywords: [
        'software ia juridico brasil',
        'software escritorio advocacia',
      ],
    },
    '/pricing': {
      cluster: 'pricing-pt-br',
      intent: 'commercial',
      primaryKeywords: [
        'preco software advocacia ia brasil',
        'software juridico ia preco',
      ],
      secondaryKeywords: [
        'plataforma compliance ia brasil',
        'software contabilidade ia brasil',
      ],
    },
    '/security': {
      cluster: 'trust-pt-br',
      intent: 'informational',
      primaryKeywords: [
        'lgpd software advocacia',
        'seguranca dados juridicos brasil',
      ],
    },
    '/contact': {
      cluster: 'contact-pt-br',
      intent: 'transactional',
      primaryKeywords: [
        'demo software advocacia ia brasil',
        'contato software juridico ia',
      ],
    },
    '/features': {
      cluster: 'features-pt-br',
      intent: 'informational',
      primaryKeywords: [
        'analise documentos ia advocacia',
        'deteccao contradicoes contratos',
      ],
    },
  },

  'pt-PT': {
    '/pricing': {
      cluster: 'pricing-pt-pt',
      intent: 'commercial',
      primaryKeywords: [
        'software advogados portugal ia',
        'preco software juridico ia portugal',
      ],
      secondaryKeywords: [
        'software contabilidade ia portugal',
        'rgpd software juridico portugal',
      ],
    },
    '/security': {
      cluster: 'trust-pt-pt',
      intent: 'informational',
      primaryKeywords: [
        'rgpd software advogados portugal',
        'seguranca dados juridicos portugal',
      ],
    },
  },

  ja: {
    '': {
      cluster: 'homepage-ja',
      intent: 'navigational',
      primaryKeywords: ['法律AIプラットフォーム', '法律事務所ソフトウェア'],
    },
    '/pricing': {
      cluster: 'pricing-ja',
      intent: 'commercial',
      primaryKeywords: [
        '法律事務所 AI ソフトウェア 料金',
        '弁護士 AI ツール 価格',
      ],
      secondaryKeywords: [
        'コンプライアンス AI プラットフォーム',
        '税務 AI ソフトウェア',
      ],
    },
    '/security': {
      cluster: 'trust-ja',
      intent: 'informational',
      primaryKeywords: ['GDPR 法律ソフトウェア', '弁護士 データセキュリティ'],
    },
    '/contact': {
      cluster: 'contact-ja',
      intent: 'transactional',
      primaryKeywords: ['法律AI デモ予約', '弁護士ソフトウェア 問い合わせ'],
    },
    '/features': {
      cluster: 'features-ja',
      intent: 'informational',
      primaryKeywords: ['AI 文書分析 弁護士', '矛盾検出 契約書'],
    },
  },

  ko: {
    '': {
      cluster: 'homepage-ko',
      intent: 'navigational',
      primaryKeywords: ['법률 AI 플랫폼', '법률 사무소 소프트웨어'],
    },
    '/pricing': {
      cluster: 'pricing-ko',
      intent: 'commercial',
      primaryKeywords: [
        '법률 사무소 AI 소프트웨어 가격',
        '변호사 AI 도구 비용',
      ],
      secondaryKeywords: ['컴플라이언스 AI 플랫폼', '세무 AI 소프트웨어'],
    },
    '/security': {
      cluster: 'trust-ko',
      intent: 'informational',
      primaryKeywords: ['GDPR 법률 소프트웨어', '변호사 데이터 보안'],
    },
    '/contact': {
      cluster: 'contact-ko',
      intent: 'transactional',
      primaryKeywords: ['법률 AI 데모 예약', '변호사 소프트웨어 문의'],
    },
    '/features': {
      cluster: 'features-ko',
      intent: 'informational',
      primaryKeywords: ['AI 문서 분석 변호사', '모순 감지 계약서'],
    },
  },

  ar: {
    '': {
      cluster: 'homepage-ar',
      intent: 'navigational',
      primaryKeywords: [
        'منصة الذكاء الاصطناعي القانونية',
        'برنامج مكتب المحاماة',
      ],
    },
    '/pricing': {
      cluster: 'pricing-ar',
      intent: 'commercial',
      primaryKeywords: [
        'سعر برنامج محاماة ذكاء اصطناعي',
        'برنامج مكتب قانوني سعر',
      ],
      secondaryKeywords: [
        'منصة امتثال ذكاء اصطناعي',
        'برنامج ضريبي ذكاء اصطناعي',
      ],
    },
    '/security': {
      cluster: 'trust-ar',
      intent: 'informational',
      primaryKeywords: ['برنامج محاماة gdpr', 'أمان بيانات قانونية'],
    },
    '/contact': {
      cluster: 'contact-ar',
      intent: 'transactional',
      primaryKeywords: [
        'عرض توضيحي برنامج محاماة',
        'تواصل برنامج قانوني ذكاء اصطناعي',
      ],
    },
    '/features': {
      cluster: 'features-ar',
      intent: 'informational',
      primaryKeywords: [
        'تحليل مستندات ذكاء اصطناعي',
        'كشف التناقضات في العقود',
      ],
    },
  },
};

export function resolveSeoContentCluster(
  locale: Locale,
  path: string
): SeoContentCluster | null {
  const localeClusters = seoContentClusters[locale];
  if (!localeClusters) return null;
  return localeClusters[path as SeoIndexablePath] ?? null;
}
