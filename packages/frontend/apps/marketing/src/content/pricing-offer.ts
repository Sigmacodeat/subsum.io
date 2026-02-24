export type OfferTier = 'credit' | 'trial' | 'kanzlei';

export type OfferCopy = {
  tier: OfferTier;
  title: string;
  price: string;
  description: string;
  cta: string;
  href: string;
};

export const PRICING_ROUTES = {
  root: '/pricing',
  addons: '/pricing#addons',
  chatbotSource: '/pricing?source=chatbot',
  chatbotYearly: '/pricing?billing=yearly&source=chatbot',
  chatbotCredits500: '/pricing?credits=500&source=chatbot',
  chatbotCredits2000: '/pricing?credits=2000&source=chatbot',
  chatbotCheckout: '/pricing?checkout=1&source=chatbot',
} as const;

function isGermanLocale(locale: string) {
  return locale.toLowerCase().startsWith('de');
}

export function getOfferCopy(locale: string, tier: OfferTier): OfferCopy {
  const isGerman = isGermanLocale(locale);

  const byTier: Record<OfferTier, OfferCopy> = {
    credit: {
      tier: 'credit',
      title: isGerman
        ? 'Credit-Pack (Einzelfall)'
        : 'Credit pack (one-off case)',
      price: isGerman ? 'ab 29 EUR' : 'from EUR 29',
      description: isGerman
        ? 'Für 1-2 Akten mit direkter Tiefenanalyse ohne Abo-Bindung.'
        : 'For 1-2 matters with immediate deep analysis and no subscription lock-in.',
      cta: isGerman ? 'Credits ansehen' : 'View credits',
      href: PRICING_ROUTES.addons,
    },
    trial: {
      tier: 'trial',
      title: isGerman ? '14-Tage Reverse Trial' : '14-day reverse trial',
      price: isGerman ? '0 EUR Start' : 'EUR 0 start',
      description: isGerman
        ? 'Voller Premium-Umfang zuerst, danach geführter Übergang in Free-Workspace.'
        : 'Full premium capabilities first, then guided transition into free workspace.',
      cta: isGerman ? 'Trial starten' : 'Start trial',
      href: PRICING_ROUTES.root,
    },
    kanzlei: {
      tier: 'kanzlei',
      title: 'Kanzlei / Team',
      price: isGerman ? 'ab 399 EUR / Monat' : 'from EUR 399 / month',
      description: isGerman
        ? 'Für laufende Mandate, Team-Collaboration und planbare AI-Kapazität.'
        : 'For recurring matters, team collaboration, and predictable AI capacity.',
      cta: isGerman ? 'Plan wählen' : 'Choose plan',
      href: PRICING_ROUTES.root,
    },
  };

  return byTier[tier];
}

export function getMonetizationCards(locale: string): OfferCopy[] {
  return [
    getOfferCopy(locale, 'credit'),
    getOfferCopy(locale, 'trial'),
    getOfferCopy(locale, 'kanzlei'),
  ];
}

export function getRecommendationCopy(
  locale: string,
  tier: OfferTier
): {
  tier: OfferTier;
  label: string;
  description: string;
  cta: string;
  ctaHref: string;
} {
  const isGerman = isGermanLocale(locale);

  if (tier === 'kanzlei') {
    return {
      tier,
      label: isGerman
        ? 'Kanzlei-/Team-Flow starten'
        : 'Start Kanzlei/Team flow',
      description: isGerman
        ? 'Mehrere Nutzer, volle Tiefenanalyse und kollaborative Fallarbeit sind hier der beste Fit.'
        : 'Multiple users, full-depth analysis, and collaborative matter handling are your best fit.',
      cta: isGerman ? 'Pläne vergleichen' : 'Compare plans',
      ctaHref: PRICING_ROUTES.root,
    };
  }

  if (tier === 'credit') {
    return {
      tier,
      label: isGerman
        ? 'Credit-Pack für Einzelfälle'
        : 'Credit pack for one-off cases',
      description: isGerman
        ? 'Ideal für 1-2 Fälle: sofort starten, nur für tatsächliche Analyseleistung zahlen.'
        : 'Great for 1-2 cases: start instantly and pay only for actual analysis usage.',
      cta: isGerman ? 'Credit-Optionen ansehen' : 'View credit options',
      ctaHref: PRICING_ROUTES.addons,
    };
  }

  return {
    tier: 'trial',
    label: isGerman ? '14-Tage Reverse Trial' : '14-day reverse trial',
    description: isGerman
      ? 'Volle Funktionen testen und danach in den passenden Plan bzw. Credit-Flow wechseln.'
      : 'Test full capabilities and then transition into the right plan or credit flow.',
    cta: isGerman ? 'Trial starten' : 'Start trial',
    ctaHref: PRICING_ROUTES.root,
  };
}
