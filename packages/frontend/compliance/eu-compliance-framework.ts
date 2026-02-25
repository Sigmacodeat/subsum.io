// 🔒 EU DSGVO/COMPLIANCE FRAMEWORK - LÄNDERSPEZIFISCHE DATENSCHUTZANFORDERUNGEN

export interface EUCompliance {
  countryCode: string;
  language: string;
  dataProtectionAuthority: {
    name: string;
    website: string;
    contact: string;
  };
  legalBasis: {
    consent: string;
    contract: string;
    legal: string;
    vital: string;
    public: string;
  };
  cookiePolicy: {
    necessary: string;
    functional: string;
    analytics: string;
    marketing: string;
  };
  dataSubjectRights: {
    access: string;
    rectification: string;
    erasure: string;
    restriction: string;
    portability: string;
    objection: string;
    automated: string;
  };
  retentionPeriods: {
    clientData: string;
    caseFiles: string;
    financial: string;
    communications: string;
    analytics: string;
  };
  serverLocations: string[];
  thirdPartyProcessors: {
    name: string;
    purpose: string;
    location: string;
    dpa: boolean;
  }[];
  breachNotification: {
    threshold: number; // hours
    authority: boolean;
    individuals: boolean;
    content: string[];
  };
  localRequirements: {
    [key: string]: string;
  };
}

export const EUComplianceFramework: Record<string, EUCompliance> = {
  // 🇩🇪 DEUTSCHLAND - BDSG + DSGVO
  de: {
    countryCode: 'DE',
    language: 'de',
    dataProtectionAuthority: {
      name: 'Bundesbeauftragte für den Datenschutz und die Informationsfreiheit (BfDI)',
      website: 'https://www.bfdi.bund.de',
      contact: 'poststelle@bfdi.bund.de',
    },
    legalBasis: {
      consent: 'Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO',
      contract: 'Vertragserfüllung nach Art. 6 Abs. 1 lit. b DSGVO',
      legal: 'Rechtliche Verpflichtung nach Art. 6 Abs. 1 lit. c DSGVO',
      vital: 'Lebenswichtige Interessen nach Art. 6 Abs. 1 lit. d DSGVO',
      public: 'Öffentliches Interesse nach Art. 6 Abs. 1 lit. e DSGVO',
    },
    cookiePolicy: {
      necessary:
        'Technisch notwendige Cookies für die Funktionsfähigkeit der Website',
      functional: 'Funktionale Cookies für erweiterte Funktionalitäten',
      analytics: 'Analyse-Cookies zur Verbesserung unserer Website',
      marketing: 'Marketing-Cookies für personalisierte Werbung',
    },
    dataSubjectRights: {
      access: 'Auskunftsrecht nach Art. 15 DSGVO',
      rectification: 'Recht auf Berichtigung nach Art. 16 DSGVO',
      erasure: 'Recht auf Löschung nach Art. 17 DSGVO',
      restriction:
        'Recht auf Einschränkung der Verarbeitung nach Art. 18 DSGVO',
      portability: 'Recht auf Datenübertragbarkeit nach Art. 20 DSGVO',
      objection: 'Widerspruchsrecht nach Art. 21 DSGVO',
      automated:
        'Recht nicht automatisierter Entscheidungen unterworfen zu werden nach Art. 22 DSGVO',
    },
    retentionPeriods: {
      clientData: '10 Jahre nach Beendigung der Mandatsbeziehung (§ 10 BORA)',
      caseFiles: '30 Jahre nach Abschluss des Verfahrens (§ 10 BORA)',
      financial: '10 Jahre nach Steuerverordnung (§ 14b UStG)',
      communications: '10 Jahre nach Beendigung der Mandatsbeziehung',
      analytics: '26 Monate nach Erhebung (Google Analytics Standard)',
    },
    serverLocations: ['Frankfurt', 'Berlin', 'München'],
    thirdPartyProcessors: [
      {
        name: 'Google Cloud Platform',
        purpose: 'Hosting und Speicherung',
        location: 'Frankfurt, Deutschland',
        dpa: true,
      },
      {
        name: 'Stripe',
        purpose: 'Zahlungsabwicklung',
        location: 'Irland',
        dpa: true,
      },
      {
        name: 'SendGrid',
        purpose: 'E-Mail-Versand',
        location: 'Irland',
        dpa: true,
      },
    ],
    breachNotification: {
      threshold: 72,
      authority: true,
      individuals: true,
      content: [
        'Art der Verletzung',
        'Kategorien betroffener Daten',
        ' wahrscheinliche Folgen',
        'ergriffene Maßnahmen',
      ],
    },
    localRequirements: {
      BORA: 'Bundesrechtsanwaltsordnung',
      BDSG: 'Bundesdatenschutzgesetz',
      GoBD: 'Grundsätze zur ordnungsmäßigen Buchführung',
      StGB: 'Strafgesetzbuch (§ 203 Berufsgeheimnis)',
      ZPO: 'Zivilprozessordnung',
    },
  },

  // 🇫🇷 FRANKREICH - CNIL + RGPD
  fr: {
    countryCode: 'FR',
    language: 'fr',
    dataProtectionAuthority: {
      name: "Commission Nationale de l'Informatique et des Libertés (CNIL)",
      website: 'https://www.cnil.fr',
      contact: 'cnil@cnil.fr',
    },
    legalBasis: {
      consent: "Consentement selon l'article 6(1)(a) RGPD",
      contract: "Exécution du contrat selon l'article 6(1)(b) RGPD",
      legal: "Obligation légale selon l'article 6(1)(c) RGPD",
      vital: "Intérêts vitaux selon l'article 6(1)(d) RGPD",
      public: "Mission d'intérêt public selon l'article 6(1)(e) RGPD",
    },
    cookiePolicy: {
      necessary: 'Cookies techniques indispensables au fonctionnement du site',
      functional: 'Cookies fonctionnels pour fonctionnalités améliorées',
      analytics: "Cookies d'analyse pour améliorer notre site",
      marketing: 'Cookies marketing pour publicité personnalisée',
    },
    dataSubjectRights: {
      access: "Droit d'accès selon l'article 15 RGPD",
      rectification: "Droit de rectification selon l'article 16 RGPD",
      erasure: "Droit à l'effacement selon l'article 17 RGPD",
      restriction:
        "Droit à la limitation du traitement selon l'article 18 RGPD",
      portability: "Droit à la portabilité des données selon l'article 20 RGPD",
      objection: "Droit d'opposition selon l'article 21 RGPD",
      automated:
        "Droit de ne pas faire l'objet d'une décision automatisée selon l'article 22 RGPD",
    },
    retentionPeriods: {
      clientData: '10 ans après fin de la relation client (Code civil)',
      caseFiles: '30 ans après conclusion du procès (Code procédure civile)',
      financial: '10 ans après enregistrement comptable',
      communications: '10 ans après fin de la relation client',
      analytics: '26 mois après collecte (standard Google Analytics)',
    },
    serverLocations: ['Paris', 'Lyon', 'Marseille'],
    thirdPartyProcessors: [
      {
        name: 'Google Cloud Platform',
        purpose: 'Hébergement et stockage',
        location: 'Paris, France',
        dpa: true,
      },
      {
        name: 'Stripe',
        purpose: 'Traitement des paiements',
        location: 'Irlande',
        dpa: true,
      },
      {
        name: 'SendGrid',
        purpose: "Envoi d'emails",
        location: 'Irlande',
        dpa: true,
      },
    ],
    breachNotification: {
      threshold: 72,
      authority: true,
      individuals: true,
      content: [
        'Nature de la violation',
        'Catégories de données concernées',
        'conséquences probables',
        'mesures prises',
      ],
    },
    localRequirements: {
      CNIL: "Commission Nationale de l'Informatique et des Libertés",
      'Code civil': 'Code civil français',
      'Code procédure civile': 'Code de procédure civile',
      'Loi informatique': 'Loi Informatique et Libertés',
      RGPD: 'Règlement Général sur la Protection des Données',
    },
  },

  // 🇪🇸 SPANIEN - AEPD + LOPD
  es: {
    countryCode: 'ES',
    language: 'es',
    dataProtectionAuthority: {
      name: 'Agencia Española de Protección de Datos (AEPD)',
      website: 'https://www.aepd.es',
      contact: 'aepd@aepd.es',
    },
    legalBasis: {
      consent: 'Consentimiento según artículo 6(1)(a) RGPD',
      contract: 'Ejecución del contrato según artículo 6(1)(b) RGPD',
      legal: 'Obligación legal según artículo 6(1)(c) RGPD',
      vital: 'Intereses vitales según artículo 6(1)(d) RGPD',
      public: 'Misión de interés público según artículo 6(1)(e) RGPD',
    },
    cookiePolicy: {
      necessary: 'Cookies técnicos esenciales para el funcionamiento del sitio',
      functional: 'Cookies funcionales para funcionalidades mejoradas',
      analytics: 'Cookies de análisis para mejorar nuestro sitio',
      marketing: 'Cookies de marketing para publicidad personalizada',
    },
    dataSubjectRights: {
      access: 'Derecho de acceso según artículo 15 RGPD',
      rectification: 'Derecho de rectificación según artículo 16 RGPD',
      erasure: 'Derecho de supresión según artículo 17 RGPD',
      restriction:
        'Derecho de limitación del tratamiento según artículo 18 RGPD',
      portability: 'Derecho de portabilidad de datos según artículo 20 RGPD',
      objection: 'Derecho de oposición según artículo 21 RGPD',
      automated:
        'Derecho a no ser objeto de decisión automatizada según artículo 22 RGPD',
    },
    retentionPeriods: {
      clientData:
        '10 años después de finalizar la relación cliente (Código civil)',
      caseFiles: '30 años después de concluir el proceso (Ley procesal civil)',
      financial: '10 años después del registro contable',
      communications: '10 años después de finalizar la relación cliente',
      analytics:
        '26 meses después de la recolección (estándar Google Analytics)',
    },
    serverLocations: ['Madrid', 'Barcelona', 'Valencia'],
    thirdPartyProcessors: [
      {
        name: 'Google Cloud Platform',
        purpose: 'Alojamiento y almacenamiento',
        location: 'Madrid, España',
        dpa: true,
      },
      {
        name: 'Stripe',
        purpose: 'Procesamiento de pagos',
        location: 'Irlanda',
        dpa: true,
      },
      {
        name: 'SendGrid',
        purpose: 'Envío de correos',
        location: 'Irlanda',
        dpa: true,
      },
    ],
    breachNotification: {
      threshold: 72,
      authority: true,
      individuals: true,
      content: [
        'Naturaleza de la violación',
        'Categorías de datos afectados',
        'consecuencias probables',
        'medidas adoptadas',
      ],
    },
    localRequirements: {
      AEPD: 'Agencia Española de Protección de Datos',
      LOPD: 'Ley Orgánica de Protección de Datos',
      'Código civil': 'Código civil español',
      'Ley procesal': 'Ley de Enjuiciamiento Civil',
      RGPD: 'Reglamento General de Protección de Datos',
    },
  },

  // 🇮🇹 ITALIEN - GPDP + GDPR
  it: {
    countryCode: 'IT',
    language: 'it',
    dataProtectionAuthority: {
      name: 'Garante per la Protezione dei Dati Personali (GPDP)',
      website: 'https://www.garanteprivacy.it',
      contact: 'info@garanteprivacy.it',
    },
    legalBasis: {
      consent: 'Consenso secondo articolo 6(1)(a) GDPR',
      contract: 'Esecuzione del contratto secondo articolo 6(1)(b) GDPR',
      legal: 'Obbligo legale secondo articolo 6(1)(c) GDPR',
      vital: 'Interessi vitali secondo articolo 6(1)(d) GDPR',
      public: 'Missione di interesse pubblico secondo articolo 6(1)(e) GDPR',
    },
    cookiePolicy: {
      necessary: 'Cookie tecnici essenziali per il funzionamento del sito',
      functional: 'Cookie funzionali per funzionalità migliorate',
      analytics: 'Cookie analitici per migliorare il nostro sito',
      marketing: 'Cookie marketing per pubblicità personalizzata',
    },
    dataSubjectRights: {
      access: 'Diritto di accesso secondo articolo 15 GDPR',
      rectification: 'Diritto di rettifica secondo articolo 16 GDPR',
      erasure: 'Diritto alla cancellazione secondo articolo 17 GDPR',
      restriction:
        'Diritto di limitazione del trattamento secondo articolo 18 GDPR',
      portability: 'Diritto alla portabilità dei dati secondo articolo 20 GDPR',
      objection: 'Diritto di opposizione secondo articolo 21 GDPR',
      automated:
        'Diritto a non essere sottoposto a decisioni automatizzate secondo articolo 22 GDPR',
    },
    retentionPeriods: {
      clientData: '10 anni dopo la fine del rapporto cliente (Codice civile)',
      caseFiles:
        '30 anni dopo la conclusione del processo (Codice procedura civile)',
      financial: '10 anni dopo la registrazione contabile',
      communications: '10 anni dopo la fine del rapporto cliente',
      analytics: '26 mesi dopo la raccolta (standard Google Analytics)',
    },
    serverLocations: ['Milano', 'Roma', 'Torino'],
    thirdPartyProcessors: [
      {
        name: 'Google Cloud Platform',
        purpose: 'Hosting e archiviazione',
        location: 'Milano, Italia',
        dpa: true,
      },
      {
        name: 'Stripe',
        purpose: 'Elaborazione pagamenti',
        location: 'Irlanda',
        dpa: true,
      },
      {
        name: 'SendGrid',
        purpose: 'Invio email',
        location: 'Irlanda',
        dpa: true,
      },
    ],
    breachNotification: {
      threshold: 72,
      authority: true,
      individuals: true,
      content: [
        'Natura della violazione',
        'Categorie di dati interessate',
        'conseguenze probabili',
        'misure adottate',
      ],
    },
    localRequirements: {
      GPDP: 'Garante per la Protezione dei Dati Personali',
      'Codice privacy': 'Codice in materia di protezione dei dati personali',
      'Codice civile': 'Codice civile italiano',
      'Codice procedura': 'Codice di procedura civile',
      GDPR: 'Regolamento Generale sulla Protezione dei Dati',
    },
  },

  // 🇵🇱 POLEN - GIODO + GDPR
  pl: {
    countryCode: 'PL',
    language: 'pl',
    dataProtectionAuthority: {
      name: 'Urząd Ochrony Danych Osobowych (UODO)',
      website: 'https://www.uodo.gov.pl',
      contact: 'info@uodo.gov.pl',
    },
    legalBasis: {
      consent: 'Zgoda zgodnie z art. 6(1)(a) RODO',
      contract: 'Wykonanie umowy zgodnie z art. 6(1)(b) RODO',
      legal: 'Obowiązek prawny zgodnie z art. 6(1)(c) RODO',
      vital: 'Kluczowe interesy zgodnie z art. 6(1)(d) RODO',
      public: 'Zadanie w interesie publicznym zgodnie z art. 6(1)(e) RODO',
    },
    cookiePolicy: {
      necessary: 'Niezbędne pliki cookie techniczne do działania strony',
      functional: 'Funkcjonalne pliki cookie dla ulepszonych funkcji',
      analytics: 'Analityczne pliki cookie do poprawy naszej strony',
      marketing: 'Marketingowe pliki cookie dla spersonalizowanej reklamy',
    },
    dataSubjectRights: {
      access: 'Prawo dostępu zgodnie z art. 15 RODO',
      rectification: 'Prawo do sprostowania zgodnie z art. 16 RODO',
      erasure: 'Prawo do usunięcia zgodnie z art. 17 RODO',
      restriction: 'Prawo do ograniczenia przetwarzania zgodnie z art. 18 RODO',
      portability: 'Prawo do przenoszalności danych zgodnie z art. 20 RODO',
      objection: 'Prawo do sprzeciwu zgodnie z art. 21 RODO',
      automated:
        'Prawo do niepodlegania zautomatyzowanym decyzjom zgodnie z art. 22 RODO',
    },
    retentionPeriods: {
      clientData: '10 lat po zakończeniu relacji z klientem (Kodeks cywilny)',
      caseFiles:
        '30 lat po zakończeniu postępowania (Kodeks postępowania cywilnego)',
      financial: '10 lat po zapisie księgowym',
      communications: '10 lat po zakończeniu relacji z klientem',
      analytics: '26 miesięcy po zebraniu (standard Google Analytics)',
    },
    serverLocations: ['Warszawa', 'Kraków', 'Wrocław'],
    thirdPartyProcessors: [
      {
        name: 'Google Cloud Platform',
        purpose: 'Hosting i przechowywanie',
        location: 'Warszawa, Polska',
        dpa: true,
      },
      {
        name: 'Stripe',
        purpose: 'Przetwarzanie płatności',
        location: 'Irlandia',
        dpa: true,
      },
      {
        name: 'SendGrid',
        purpose: 'Wysyłanie emaili',
        location: 'Irlandia',
        dpa: true,
      },
    ],
    breachNotification: {
      threshold: 72,
      authority: true,
      individuals: true,
      content: [
        'Rodzaj naruszenia',
        'Kategorie dotyczyonych danych',
        'prawdopodobne konsekwencje',
        'podjęte środki',
      ],
    },
    localRequirements: {
      UODO: 'Urząd Ochrony Danych Osobowych',
      'Kodeks pracy': 'Kodeks pracy',
      'Kodeks cywilny': 'Kodeks cywilny polski',
      'Kodeks postępowania': 'Kodeks postępowania cywilnego',
      RODO: 'Rozporządzenie o Ochronie Danych Osobowych',
    },
  },

  // 🇳🇱 NIEDERLANDE - AP + AVG
  nl: {
    countryCode: 'NL',
    language: 'nl',
    dataProtectionAuthority: {
      name: 'Autoriteit Persoonsgegevens (AP)',
      website: 'https://www.autoriteitpersoonsgegevens.nl',
      contact: 'info@autoriteitpersoonsgegevens.nl',
    },
    legalBasis: {
      consent: 'Toestemming volgens artikel 6(1)(a) AVG',
      contract: 'Uitvoering overeenkomst volgens artikel 6(1)(b) AVG',
      legal: 'Wettelijke verplichting volgens artikel 6(1)(c) AVG',
      vital: 'Kritieke belangen volgens artikel 6(1)(d) AVG',
      public: 'Taak van algemeen belang volgens artikel 6(1)(e) AVG',
    },
    cookiePolicy: {
      necessary:
        'Technisch noodzakelijke cookies voor het functioneren van de site',
      functional: 'Functionele cookies voor verbeterde functionaliteiten',
      analytics: 'Analytische cookies om onze site te verbeteren',
      marketing: 'Marketing cookies voor gepersonaliseerde advertenties',
    },
    dataSubjectRights: {
      access: 'Recht op toegang volgens artikel 15 AVG',
      rectification: 'Recht op rectificatie volgens artikel 16 AVG',
      erasure: 'Recht op gegevenswissing volgens artikel 17 AVG',
      restriction: 'Recht op beperking van verwerking volgens artikel 18 AVG',
      portability: 'Recht op gegevensoverdraagbaarheid volgens artikel 20 AVG',
      objection: 'Recht van bezwaar volgens artikel 21 AVG',
      automated:
        'Recht niet onderworpen te zijn aan geautomatiseerde besluitvorming volgens artikel 22 AVG',
    },
    retentionPeriods: {
      clientData: '10 jaar na beëindiging relatie (Burgerlijk Wetboek)',
      caseFiles:
        '30 jaar na afronding procedure (Wetboek van Burgerlijke Rechtsvordering)',
      financial: '10 jaar na boeking',
      communications: '10 jaar na beëindiging relatie',
      analytics: '26 maanden na verzameling (Google Analytics standaard)',
    },
    serverLocations: ['Amsterdam', 'Rotterdam', 'Utrecht'],
    thirdPartyProcessors: [
      {
        name: 'Google Cloud Platform',
        purpose: 'Hosting en opslag',
        location: 'Amsterdam, Nederland',
        dpa: true,
      },
      {
        name: 'Stripe',
        purpose: 'Betaling verwerking',
        location: 'Ierland',
        dpa: true,
      },
      {
        name: 'SendGrid',
        purpose: 'E-mail verzending',
        location: 'Ierland',
        dpa: true,
      },
    ],
    breachNotification: {
      threshold: 72,
      authority: true,
      individuals: true,
      content: [
        'Aard van de inbreuk',
        'Categorieën betrokken gegevens',
        'waarschijnlijke gevolgen',
        'genomen maatregelen',
      ],
    },
    localRequirements: {
      AP: 'Autoriteit Persoonsgegevens',
      AVG: 'Algemene Verordening Gegevensbescherming',
      'Burgerlijk Wetboek': 'Nederlands Burgerlijk Wetboek',
      'Wetboek van Burgerlijke Rechtsvordering':
        'Nederlands Wetboek van Burgerlijke Rechtsvordering',
      Telecommunicatiewet: 'Telecommunicatiewet',
    },
  },
};

export const EUComplianceLanguageFallback: Record<string, string> = {
  de: 'de',
  de_de: 'de',
  de_at: 'de',
  de_ch: 'de',
  fr: 'fr',
  fr_fr: 'fr',
  fr_ch: 'fr',
  es: 'es',
  es_es: 'es',
  it: 'it',
  it_it: 'it',
  pl: 'pl',
  pl_pl: 'pl',
  nl: 'nl',
  nl_nl: 'nl',
};

export function resolveEUComplianceLanguage(lang?: string): string {
  const normalized = (lang ?? 'de').trim().toLowerCase().replace('-', '_');
  if (EUComplianceFramework[normalized]) {
    return normalized;
  }
  return (
    EUComplianceLanguageFallback[normalized] ?? normalized.split('_')[0] ?? 'de'
  );
}

export function getEUCompliance(lang?: string): EUCompliance {
  const resolved = resolveEUComplianceLanguage(lang);
  return EUComplianceFramework[resolved] ?? EUComplianceFramework['de'];
}

// COMPLIANCE FUNCTIONS
export function generatePrivacyPolicy(lang: string): string {
  const compliance = getEUCompliance(lang);

  return `
# Datenschutzerklärung für ${compliance.countryCode}

## 1. Verantwortliche Stelle
**Subsumio GmbH**  
Technologiepark 18  
48149 Münster, Deutschland  
E-Mail: privacy@subsumio.de

## 2. Datenschutzbeauftragte
${compliance.dataProtectionAuthority.name}  
Website: ${compliance.dataProtectionAuthority.website}  
E-Mail: ${compliance.dataProtectionAuthority.contact}

## 3. Rechtsgrundlagen der Verarbeitung
- ${compliance.legalBasis.consent}
- ${compliance.legalBasis.contract}
- ${compliance.legalBasis.legal}
- ${compliance.legalBasis.vital}
- ${compliance.legalBasis.public}

## 4. Cookies und Tracking
- ${compliance.cookiePolicy.necessary}
- ${compliance.cookiePolicy.functional}
- ${compliance.cookiePolicy.analytics}
- ${compliance.cookiePolicy.marketing}

## 5. Ihre Rechte als betroffene Person
- ${compliance.dataSubjectRights.access}
- ${compliance.dataSubjectRights.rectification}
- ${compliance.dataSubjectRights.erasure}
- ${compliance.dataSubjectRights.restriction}
- ${compliance.dataSubjectRights.portability}
- ${compliance.dataSubjectRights.objection}
- ${compliance.dataSubjectRights.automated}

## 6. Aufbewahrungsfristen
- Mandantendaten: ${compliance.retentionPeriods.clientData}
- Fallakten: ${compliance.retentionPeriods.caseFiles}
- Finanzdaten: ${compliance.retentionPeriods.financial}
- Kommunikation: ${compliance.retentionPeriods.communications}
- Analysedaten: ${compliance.retentionPeriods.analytics}

## 7. Serverstandorte
Unsere Server befinden sich in: ${compliance.serverLocations.join(', ')}

## 8. Datenpannen-Meldung
Bei Datenpannen melden wir innerhalb von ${compliance.breachNotification.threshold} Stunden:
- An die Aufsichtsbehörde: ${compliance.breachNotification.authority ? 'Ja' : 'Nein'}
- An betroffene Personen: ${compliance.breachNotification.individuals ? 'Ja' : 'Nein'}

## 9. Lokale rechtliche Anforderungen
${Object.entries(compliance.localRequirements)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

## 10. Kontakt für Datenschutzfragen
E-Mail: privacy@subsumio.de  
Post: Subsumio GmbH, Technologiepark 18, 48149 Münster, Deutschland
`;
}

export function generateCookieConsent(
  lang: string
): Record<
  string,
  { id: string; name: string; description: string; required: boolean }
> {
  const compliance = getEUCompliance(lang);

  return {
    necessary: {
      id: 'necessary',
      name: 'Notwendige Cookies',
      description: compliance.cookiePolicy.necessary,
      required: true,
    },
    functional: {
      id: 'functional',
      name: 'Funktionale Cookies',
      description: compliance.cookiePolicy.functional,
      required: false,
    },
    analytics: {
      id: 'analytics',
      name: 'Analyse-Cookies',
      description: compliance.cookiePolicy.analytics,
      required: false,
    },
    marketing: {
      id: 'marketing',
      name: 'Marketing-Cookies',
      description: compliance.cookiePolicy.marketing,
      required: false,
    },
  };
}

export function getDataRetentionSchedule(lang: string): Record<string, string> {
  return getEUCompliance(lang).retentionPeriods;
}

export function getThirdPartyProcessors(
  lang: string
): EUCompliance['thirdPartyProcessors'] {
  return getEUCompliance(lang).thirdPartyProcessors;
}

export function getBreachNotificationRequirements(
  lang: string
): EUCompliance['breachNotification'] {
  return getEUCompliance(lang).breachNotification;
}

export default {
  EUComplianceFramework,
  EUComplianceLanguageFallback,
  resolveEUComplianceLanguage,
  getEUCompliance,
  generatePrivacyPolicy,
  generateCookieConsent,
  getDataRetentionSchedule,
  getThirdPartyProcessors,
  getBreachNotificationRequirements,
};
