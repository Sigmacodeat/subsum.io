// 🇪🇺 EU SEO-INFRASTRUKTUR - HREFLANG & SITEMAP GENERATOR

interface EUMarket {
  code: string;
  name: string;
  domain: string;
  priority: number;
  changefreq: string;
  lastmod: string;
  alternates: string[];
}

export const EUMarkets: EUMarket[] = [
  // TIER 1: GROßMÄRKTE
  {
    code: 'de',
    name: 'Deutschland',
    domain: 'subsumio.de',
    priority: 1.0,
    changefreq: 'daily',
    lastmod: new Date().toISOString(),
    alternates: ['en', 'fr', 'pl', 'nl'],
  },
  {
    code: 'en',
    name: 'United Kingdom',
    domain: 'subsumio.co.uk',
    priority: 0.9,
    changefreq: 'daily',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'fr', 'es', 'it'],
  },
  {
    code: 'fr',
    name: 'France',
    domain: 'subsumio.fr',
    priority: 0.9,
    changefreq: 'daily',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'es', 'it'],
  },
  {
    code: 'es',
    name: 'España',
    domain: 'subsumio.es',
    priority: 0.9,
    changefreq: 'daily',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'fr', 'pt'],
  },
  {
    code: 'it',
    name: 'Italia',
    domain: 'subsumio.it',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'fr', 'es'],
  },
  {
    code: 'pl',
    name: 'Polska',
    domain: 'subsumio.pl',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'uk'],
  },
  {
    code: 'nl',
    name: 'Nederland',
    domain: 'subsumio.nl',
    priority: 0.7,
    changefreq: 'daily',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'fr'],
  },

  // TIER 2: WICHTIGE EU-MÄRKTE
  {
    code: 'sv-SE',
    name: 'Sverige',
    domain: 'subsumio.se',
    priority: 0.6,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'fi', 'no'],
  },
  {
    code: 'da',
    name: 'Danmark',
    domain: 'subsumio.dk',
    priority: 0.6,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'sv-SE', 'no'],
  },
  {
    code: 'fi',
    name: 'Suomi',
    domain: 'subsumio.fi',
    priority: 0.5,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'sv-SE'],
  },
  {
    code: 'el-GR',
    name: 'Ελλάδα',
    domain: 'subsumio.gr',
    priority: 0.5,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'it', 'tr'],
  },
  {
    code: 'pt-PT',
    name: 'Portugal',
    domain: 'subsumio.pt',
    priority: 0.5,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'es', 'fr'],
  },
  {
    code: 'cs',
    name: 'Česko',
    domain: 'subsumio.cz',
    priority: 0.5,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'sk', 'pl'],
  },
  {
    code: 'hu',
    name: 'Magyarország',
    domain: 'subsumio.hu',
    priority: 0.5,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'ro', 'sk'],
  },
  {
    code: 'ro',
    name: 'România',
    domain: 'subsumio.ro',
    priority: 0.5,
    changefreq: 'weekly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'hu', 'bg'],
  },

  // TIER 3: STRATEGISCHE MÄRKTE
  {
    code: 'bg',
    name: 'България',
    domain: 'subsumio.bg',
    priority: 0.3,
    changefreq: 'monthly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'ro', 'gr'],
  },
  {
    code: 'hr',
    name: 'Hrvatska',
    domain: 'subsumio.hr',
    priority: 0.3,
    changefreq: 'monthly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'si', 'it'],
  },
  {
    code: 'sk',
    name: 'Slovensko',
    domain: 'subsumio.sk',
    priority: 0.3,
    changefreq: 'monthly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'cz', 'hu'],
  },
  {
    code: 'sl',
    name: 'Slovenija',
    domain: 'subsumio.si',
    priority: 0.3,
    changefreq: 'monthly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'hr', 'it'],
  },
  {
    code: 'et',
    name: 'Eesti',
    domain: 'subsumio.ee',
    priority: 0.3,
    changefreq: 'monthly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'fi', 'lv'],
  },
  {
    code: 'lv',
    name: 'Latvija',
    domain: 'subsumio.lv',
    priority: 0.3,
    changefreq: 'monthly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'ee', 'lt'],
  },
  {
    code: 'lt',
    name: 'Lietuva',
    domain: 'subsumio.lt',
    priority: 0.3,
    changefreq: 'monthly',
    lastmod: new Date().toISOString(),
    alternates: ['de', 'en', 'lv', 'pl'],
  },
];

// HREFLANG GENERATOR
export function generateHrefLangTags(
  currentLang: string,
  currentPath: string = ''
): string {
  const currentMarket = EUMarkets.find(m => m.code === currentLang);
  if (!currentMarket) return '';

  let hrefLangTags = `
<!-- EU HREFLANG TAGS -->
<link rel="alternate" hreflang="x-default" href="https://subsumio.de${currentPath}" />
<link rel="alternate" hreflang="de" href="https://subsumio.de${currentPath}" />
<link rel="alternate" hreflang="en" href="https://subsumio.co.uk${currentPath}" />
`;

  // Add alternates for current market
  currentMarket.alternates.forEach(altLang => {
    const altMarket = EUMarkets.find(m => m.code === altLang);
    if (altMarket) {
      hrefLangTags += `<link rel="alternate" hreflang="${altLang}" href="https://${altMarket.domain}${currentPath}" />\n`;
    }
  });

  return hrefLangTags;
}

// EU SITEMAP GENERATOR
export function generateEUSitemap(): string {
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

  // Main pages for each market
  EUMarkets.forEach(market => {
    const mainPages = [
      { path: '/', priority: market.priority },
      { path: '/features', priority: market.priority * 0.9 },
      { path: '/pricing', priority: market.priority * 0.8 },
      { path: '/fristen', priority: market.priority * 0.9 },
      { path: '/contact', priority: market.priority * 0.7 },
    ];

    mainPages.forEach(page => {
      const url = `https://${market.domain}${page.path}`;

      sitemap += `  <url>
    <loc>${url}</loc>
    <lastmod>${market.lastmod}</lastmod>
    <changefreq>${market.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    
    <!-- EU Alternates -->
    <xhtml:link rel="alternate" hreflang="x-default" href="${url}" />
    <xhtml:link rel="alternate" hreflang="${market.code}" href="${url}" />
`;

      // Add alternates
      market.alternates.forEach(altLang => {
        const altMarket = EUMarkets.find(m => m.code === altLang);
        if (altMarket) {
          const altUrl = `https://${altMarket.domain}${page.path}`;
          sitemap += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${altUrl}" />\n`;
        }
      });

      sitemap += `  </url>\n`;
    });
  });

  sitemap += `</urlset>`;
  return sitemap;
}

// STRUCTURED DATA GENERATOR
export function generateEUStructuredData(
  lang: string,
  pageType: string
): string {
  const market = EUMarkets.find(m => m.code === lang);
  if (!market) return '';

  const baseStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Subsumio Kanzleisoftware',
    alternateName: `Subsumio ${market.name}`,
    description: `Professionelle Kanzleisoftware für ${market.name} - Fristenmanagement, Aktenverwaltung und Mandantenverwaltung`,
    url: `https://${market.domain}`,
    applicationCategory: 'Legal Software',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '29.00',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      priceValidUntil: '2025-12-31',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '150',
    },
    provider: {
      '@type': 'Organization',
      name: 'Subsumio GmbH',
      url: 'https://subsumio.de',
    },
  };

  return JSON.stringify(baseStructuredData, null, 2);
}

// SEO META TAGS GENERATOR
export function generateEUMetaTags(lang: string, page: string): string {
  const market = EUMarkets.find(m => m.code === lang);
  if (!market) return '';

  const metaTags: Record<
    string,
    { title: string; description: string; keywords: string }
  > = {
    de: {
      title:
        'Kanzleisoftware Deutschland | Fristenmanagement & Aktenverwaltung',
      description:
        'Professionelle Kanzleisoftware für deutsche Anwaltskanzleien. Automatisches Fristenmanagement, Aktenverwaltung & Mandantenverwaltung. DSGVO-konform & zertifiziert.',
      keywords:
        'Kanzleisoftware, Anwaltssoftware, Fristenmanagement, Aktenverwaltung, Mandantenverwaltung, Deutschland, DSGVO',
    },
    fr: {
      title: "Logiciel d'avocat France | Gestion de cabinet & Échéances",
      description:
        "Logiciel professionnel pour cabinets d'avocats en France. Gestion automatique des échéances, gestion de dossiers & clients. Conforme RGPD.",
      keywords:
        "logiciel d'avocat, gestion de cabinet, échéances, gestion de dossiers, France, RGPD",
    },
    es: {
      title: 'Software de abogados España | Gestión de despacho & Plazos',
      description:
        'Software profesional para despachos de abogados en España. Gestión automática de plazos, gestión de expedientes & clientes. Conforme LOPD.',
      keywords:
        'software de abogados, gestión de despacho, plazos, gestión de expedientes, España, LOPD',
    },
    it: {
      title: 'Software per avvocati Italia | Gestione studio & Scadenze',
      description:
        'Software professionale per studi legali in Italia. Gestione automatica delle scadenze, gestione di fascicoli & clienti. Conforme GDPR.',
      keywords:
        'software per avvocati, gestione studio, scadenze, gestione fascicoli, Italia, GDPR',
    },
    pl: {
      title:
        'Oprogramowanie dla kancelarii Polska | Zarządzanie terminami & Sprawy',
      description:
        'Profesjonalne oprogramowanie dla kancelarii prawnych w Polsce. Automatyczne zarządzanie terminami, sprawami & klientami. Zgodne z RODO.',
      keywords:
        'oprogramowanie dla kancelarii, zarządzanie terminami, sprawy, Polska, RODO',
    },
    nl: {
      title: 'Advocatensoftware Nederland | Termijnbeheer & Dossierbeheer',
      description:
        'Professionele software voor advocatenkantoren in Nederland. Automatisch termijnbeheer, dossierbeheer & cliëntenbeheer. AVG-conform.',
      keywords:
        'advocatensoftware, termijnbeheer, dossierbeheer, Nederland, AVG',
    },
  };

  const tags = metaTags[lang as keyof typeof metaTags] || metaTags['de'];

  return `
<!-- EU SEO META TAGS -->
<title>${tags.title}</title>
<meta name="description" content="${tags.description}" />
<meta name="keywords" content="${tags.keywords}" />
<meta name="author" content="Subsumio GmbH" />
<meta name="robots" content="index, follow" />
<meta name="googlebot" content="index, follow" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content="https://${market.domain}${page}" />
<meta property="og:title" content="${tags.title}" />
<meta property="og:description" content="${tags.description}" />
<meta property="og:image" content="https://${market.domain}/og-image-${lang}.jpg" />

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content="https://${market.domain}${page}" />
<meta property="twitter:title" content="${tags.title}" />
<meta property="twitter:description" content="${tags.description}" />
<meta property="twitter:image" content="https://${market.domain}/og-image-${lang}.jpg" />

<!-- Geotargeting -->
<meta name="geo.region" content="${getGeoRegion(lang)}" />
<meta name="geo.placename" content="${market.name}" />
<meta name="ICBM" content="${getGeoCoordinates(lang)}" />

<!-- Language & Region -->
<html lang="${lang}" dir="ltr" />
<meta name="language" content="${lang}" />
<meta name="country" content="${getCountryCode(lang)}" />
`;
}

// Helper functions
function getGeoRegion(lang: string): string {
  const regions: Record<string, string> = {
    de: 'DE-BE',
    fr: 'FR-75',
    es: 'ES-MD',
    it: 'IT-RM',
    pl: 'PL-MZ',
    nl: 'NL-NH',
  };
  return regions[lang] || 'DE-BE';
}

function getGeoCoordinates(lang: string): string {
  const coords: Record<string, string> = {
    de: '52.5200;13.4050', // Berlin
    fr: '48.8566;2.3522', // Paris
    es: '40.4168;-3.7038', // Madrid
    it: '41.9028;12.4964', // Rome
    pl: '52.2297;21.0122', // Warsaw
    nl: '52.3676;4.9041', // Amsterdam
  };
  return coords[lang] || '52.5200;13.4050';
}

function getCountryCode(lang: string): string {
  const codes: Record<string, string> = {
    de: 'Germany',
    fr: 'France',
    es: 'Spain',
    it: 'Italy',
    pl: 'Poland',
    nl: 'Netherlands',
  };
  return codes[lang] || 'Germany';
}

export default {
  EUMarkets,
  generateHrefLangTags,
  generateEUSitemap,
  generateEUStructuredData,
  generateEUMetaTags,
};
