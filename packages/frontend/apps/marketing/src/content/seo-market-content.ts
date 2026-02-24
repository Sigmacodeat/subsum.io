import type { Locale } from '@/i18n/config';
import type { SeoIndexablePath } from '@/utils/seo-routes';

export type SeoMarketOverride = {
  title?: string;
  description?: string;
  keywords?: string[];
  noindex?: boolean;
};

type LocaleSeoOverrides = Partial<Record<SeoIndexablePath, SeoMarketOverride>>;

export const seoMarketOverrides: Partial<Record<Locale, LocaleSeoOverrides>> = {
  en: {
    '': {
      keywords: [
        'legal ai platform',
        'law firm software',
        'ai document analysis',
      ],
    },
    '/about': {
      title: 'About Subsumio',
      description:
        'Learn about Subsumio — the AI platform built for legal and tax professionals.',
      keywords: ['about subsumio', 'legal ai company', 'legal tech platform'],
    },
    '/features': {
      title: 'Features – Subsumio',
      description:
        'Explore Subsumio features: AI document analysis, structured extraction, compliance, and workflow automation.',
      keywords: [
        'legal ai features',
        'ai document analysis',
        'workflow automation',
      ],
    },
    '/quick-check': {
      title: 'Legal Quick Check – Analyze case files in minutes',
      description:
        'Run a fast AI-assisted quick check for legal case files: detect risk signals, deadline pressure, and contradictions before deep analysis.',
      keywords: [
        'legal quick check',
        'case file ai analysis',
        'legal intake qualification',
      ],
    },
    '/pricing': {
      keywords: [
        'legal ai pricing',
        'tax advisory software pricing',
        'ai legal operations',
        'compliance platform cost',
      ],
    },
    '/security': {
      keywords: [
        'gdpr compliant legal software',
        'legal ai security',
        'law firm data protection',
        'soc2 legal platform',
      ],
    },
    '/contact': {
      keywords: [
        'legal ai demo',
        'book law firm software demo',
        'contact legal ai team',
      ],
    },
    '/tax': {
      keywords: [
        'tax ai software',
        'tax assessment ai',
        'deadline management tax',
        'tax objection software',
      ],
    },
    '/legal/imprint': {
      title: 'Imprint',
      description: 'Legal notice and company information for Subsumio.',
      keywords: ['imprint', 'legal notice', 'company information'],
    },
    '/legal/privacy': {
      title: 'Privacy Policy',
      description:
        'Privacy policy for Subsumio, including GDPR information and data handling details.',
      keywords: ['privacy policy', 'gdpr', 'data protection'],
    },
    '/legal/terms': {
      title: 'Terms of Service',
      description: 'Terms of service for using Subsumio.',
      keywords: ['terms of service', 'terms', 'subsumio terms'],
    },
  },

  'de-DE': {
    '': {
      keywords: [
        'juristische ki plattform',
        'kanzlei software deutschland',
        'ki dokumentenanalyse',
      ],
    },
    '/about': {
      title: 'Über Subsumio',
      description:
        'Erfahre mehr über Subsumio – die KI-Plattform für Rechtsanwälte und Steuerberater.',
      keywords: ['über subsumio', 'legal tech', 'kanzlei software anbieter'],
    },
    '/features': {
      title: 'Funktionen – Subsumio',
      description:
        'Alle Features von Subsumio: KI-Dokumentenanalyse, Extraktion, Compliance und Workflow-Automatisierung.',
      keywords: [
        'funktionen kanzlei software',
        'ki dokumentenanalyse',
        'workflow automations software',
      ],
    },
    '/quick-check': {
      title: 'Akte Quick-Check – Risiken, Fristen und Widersprüche in Minuten',
      description:
        'Schneller KI-gestützter Quick-Check für Akten: priorisiert Risiken, Fristen und Widersprüche vor der vollständigen Tiefenanalyse.',
      keywords: [
        'akte quick-check',
        'aktenanalyse online',
        'kanzlei intake qualifizierung',
      ],
    },
    '/pricing': {
      title: 'Preise – KI-Kanzleisoftware für Deutschland',
      description:
        'Transparente Preise für Subsumio – die KI-Plattform für Steuerberater und Rechtsanwälte in Deutschland. Jetzt 14 Tage kostenlos testen.',
      keywords: [
        'steuerberater software preise',
        'kanzlei software deutschland',
        'steuerkanzlei ki kosten',
        'bescheid prüfung software',
        'rechtsanwalt software preise',
      ],
    },
    '/tax': {
      title: 'Tax OS – KI für Steuerberater in Deutschland',
      description:
        'Tax OS von Subsumio: Automatische Bescheid-Prüfung, Fristen-Cockpit und KI-Steuerberatung für Steuerkanzleien in Deutschland.',
      keywords: [
        'tax os deutschland',
        'bescheid prüfer software',
        'einspruch steuerbescheid automatisch',
        'fristenkalender steuerberater',
        'steuerberater ki software',
      ],
    },
    '/security': {
      title: 'Datenschutz & Sicherheit – DSGVO-konforme Kanzleisoftware',
      description:
        'Subsumio erfüllt höchste Sicherheitsstandards: DSGVO-konform, ISO 27001, SOC 2 Typ II, EU-Rechenzentren. Ihre Mandantendaten sind sicher.',
      keywords: [
        'dsgvo konforme kanzlei software',
        'datenschutz rechtsanwalt software',
        'iso 27001 legal software',
        'eu rechenzentrum kanzlei',
      ],
    },
    '/contact': {
      keywords: [
        'steuer software demo buchen',
        'kanzlei software kontakt deutschland',
        'subsumio demo anfragen',
      ],
    },
    '/legal/imprint': {
      title: 'Impressum',
      description: 'Impressum und Anbieterkennzeichnung für Subsumio.',
      keywords: ['impressum', 'anbieterkennzeichnung', 'kontakt'],
    },
    '/legal/privacy': {
      title: 'Datenschutzerklärung',
      description:
        'Datenschutzerklärung für Subsumio (DSGVO): Verarbeitung, Speicherung und Rechte.',
      keywords: ['datenschutzerklärung', 'dsgvo', 'datenschutz'],
    },
    '/legal/terms': {
      title: 'Nutzungsbedingungen',
      description: 'Nutzungsbedingungen für Subsumio.',
      keywords: ['nutzungsbedingungen', 'agb', 'bedingungen'],
    },
  },

  'de-AT': {
    '': {
      keywords: [
        'juristische ki plattform österreich',
        'kanzlei software wien',
        'ki dokumentenanalyse österreich',
      ],
    },
    '/about': {
      title: 'Über Subsumio',
      description:
        'Subsumio – die KI-Plattform für Rechtsanwälte und Steuerberater in Österreich.',
      keywords: [
        'über subsumio',
        'legal tech österreich',
        'kanzlei software wien',
      ],
    },
    '/features': {
      title: 'Funktionen – Subsumio',
      description:
        'Subsumio Features für Österreich: KI-Dokumentenanalyse, Extraktion, Compliance und Automatisierung.',
      keywords: [
        'funktionen kanzlei software',
        'ki dokumentenanalyse österreich',
        'workflow automatisierung',
      ],
    },
    '/quick-check': {
      title: 'Akte Quick-Check für Österreich – Sofortige Vorprüfung mit KI',
      description:
        'Prüfen Sie Akten in wenigen Minuten auf Risiko- und Fristsignale und leiten Sie direkt den passenden Analyse-Workflow ein.',
      keywords: [
        'akte quick-check österreich',
        'ki aktenanalyse österreich',
        'vorprüfung akte',
      ],
    },
    '/pricing': {
      title: 'Preise – KI-Kanzleisoftware für Österreich',
      description:
        'Subsumio Preise für österreichische Rechtsanwälte und Steuerberater. ABGB, ZPO, AVG – vollständig unterstützt. Jetzt kostenlos testen.',
      keywords: [
        'steuerberater software österreich',
        'kanzlei software wien',
        'rechtsanwalt software österreich',
        'abgb ki analyse',
      ],
    },
    '/tax': {
      keywords: [
        'steuerberater software österreich',
        'finanzamt bescheid prüfung österreich',
        'fristen österreich steuer',
      ],
    },
    '/security': {
      keywords: [
        'dsgvo österreich kanzlei software',
        'datenschutz anwalt österreich',
        'eu hosting österreich',
      ],
    },
    '/contact': {
      keywords: ['kanzlei software demo österreich', 'subsumio kontakt wien'],
    },
    '/legal/imprint': {
      title: 'Impressum',
      description: 'Impressum und Anbieterkennzeichnung für Subsumio.',
      keywords: ['impressum', 'anbieterkennzeichnung', 'kontakt'],
    },
    '/legal/privacy': {
      title: 'Datenschutzerklärung',
      description:
        'Datenschutzerklärung für Subsumio (DSGVO): Verarbeitung, Speicherung und Rechte.',
      keywords: ['datenschutzerklärung', 'dsgvo', 'datenschutz'],
    },
    '/legal/terms': {
      title: 'Nutzungsbedingungen',
      description: 'Nutzungsbedingungen für Subsumio.',
      keywords: ['nutzungsbedingungen', 'agb', 'bedingungen'],
    },
  },

  'de-CH': {
    '': {
      keywords: [
        'juristische ki plattform schweiz',
        'kanzlei software zürich',
        'treuhand software schweiz',
      ],
    },
    '/about': {
      title: 'Über Subsumio',
      description:
        'Subsumio – KI-Plattform für Schweizer Anwaltskanzleien und Treuhandbüros.',
      keywords: ['über subsumio', 'legal tech schweiz', 'treuhand software'],
    },
    '/features': {
      title: 'Funktionen – Subsumio',
      description:
        'Subsumio Features in der Schweiz: KI-Dokumentenanalyse, Extraktion, Compliance und Automatisierung.',
      keywords: [
        'funktionen kanzlei software',
        'ki dokumentenanalyse schweiz',
        'compliance workflow',
      ],
    },
    '/quick-check': {
      title: 'Akte Quick-Check für die Schweiz – KI-Vorprüfung für Kanzleien',
      description:
        'Schneller Akten-Quick-Check für Schweizer Kanzleien: frühe Risikoindikatoren, Fristsignale und klare nächste Schritte.',
      keywords: [
        'akte quick-check schweiz',
        'ki dokumentenprüfung schweiz',
        'vorprüfung kanzlei',
      ],
    },
    '/pricing': {
      title: 'Preise – KI-Software für Anwälte und Treuhänder in der Schweiz',
      description:
        'Subsumio Preise für Schweizer Anwaltskanzleien und Treuhandbüros. OR, ZGB, StGB – vollständig unterstützt. Jetzt kostenlos testen.',
      keywords: [
        'treuhand software schweiz',
        'steuerberatung software schweiz',
        'anwalt software zürich',
        'or zgb ki analyse',
      ],
    },
    '/tax': {
      keywords: [
        'steuerberater software schweiz',
        'steuererklärung software schweiz',
        'fristen schweiz steuer',
      ],
    },
    '/security': {
      keywords: [
        'dsgvo schweiz kanzlei software',
        'datenschutz anwalt schweiz',
        'revdsg konforme software',
      ],
    },
    '/contact': {
      keywords: ['kanzlei software demo schweiz', 'subsumio kontakt zürich'],
    },
    '/legal/imprint': {
      title: 'Impressum',
      description: 'Impressum und Anbieterkennzeichnung für Subsumio.',
      keywords: ['impressum', 'anbieterkennzeichnung', 'kontakt'],
    },
    '/legal/privacy': {
      title: 'Datenschutzerklärung',
      description:
        'Datenschutzerklärung für Subsumio: Datenschutz, Verarbeitung und Rechte.',
      keywords: ['datenschutzerklärung', 'datenschutz', 'revdsg'],
    },
    '/legal/terms': {
      title: 'Nutzungsbedingungen',
      description: 'Nutzungsbedingungen für Subsumio.',
      keywords: ['nutzungsbedingungen', 'bedingungen', 'agb'],
    },
  },

  fr: {
    '': {
      keywords: [
        'logiciel ia juridique',
        'logiciel cabinet avocat',
        'analyse documents ia',
      ],
    },
    '/about': {
      title: 'À propos – Subsumio',
      description:
        'Découvrez Subsumio, la plateforme IA pour avocats et experts-comptables.',
      keywords: [
        'à propos subsumio',
        'entreprise legal tech',
        'plateforme ia juridique',
      ],
    },
    '/features': {
      title: 'Fonctionnalités – Subsumio',
      description:
        'Fonctionnalités Subsumio : analyse IA de documents, extraction, conformité et automatisation.',
      keywords: [
        'fonctionnalités logiciel avocat',
        'analyse documents ia',
        'automatisation workflows',
      ],
    },
    '/pricing': {
      title: "Tarifs – Logiciel IA pour cabinets d'avocats",
      description:
        'Tarifs transparents pour Subsumio – la plateforme IA pour avocats et experts-comptables. Essai gratuit 14 jours.',
      keywords: [
        'tarif logiciel avocat ia',
        'prix logiciel cabinet juridique',
        'logiciel compliance ia tarif',
      ],
    },
    '/security': {
      keywords: [
        'logiciel avocat rgpd',
        'sécurité données cabinet avocat',
        'hébergement eu logiciel juridique',
      ],
    },
    '/contact': {
      keywords: ['démo logiciel avocat ia', 'contact logiciel juridique ia'],
    },
    '/tax': {
      title: 'Fiscalité – IA pour cabinets',
      description:
        'Outils IA pour la fiscalité : gestion des échéances, contrôle et analyse des dossiers.',
      keywords: [
        'logiciel fiscalité ia',
        'gestion délais fiscaux',
        'audit fiscal ia',
      ],
    },
    '/legal/imprint': {
      title: 'Mentions légales',
      description:
        "Mentions légales et informations de l'éditeur pour Subsumio.",
      keywords: ['mentions légales', 'éditeur', 'informations société'],
    },
    '/legal/privacy': {
      title: 'Politique de confidentialité',
      description:
        'Politique de confidentialité Subsumio : RGPD, traitement des données et vos droits.',
      keywords: ['confidentialité', 'rgpd', 'protection des données'],
    },
    '/legal/terms': {
      title: "Conditions d'utilisation",
      description: "Conditions d'utilisation de Subsumio.",
      keywords: ['conditions', "conditions d'utilisation", 'cgu'],
    },
  },

  'fr-FR': {
    '': {
      keywords: [
        'logiciel ia juridique france',
        'logiciel cabinet avocat france',
        'analyse documents ia',
      ],
    },
    '/about': {
      title: 'À propos – Subsumio France',
      description:
        "Subsumio en France : plateforme IA pour cabinets d'avocats et experts-comptables.",
      keywords: [
        'legal tech france',
        'plateforme ia juridique',
        'logiciel cabinet avocat',
      ],
    },
    '/features': {
      title: 'Fonctionnalités – Subsumio',
      description:
        'Fonctionnalités IA pour cabinets : analyse de documents, extraction et workflows.',
      keywords: [
        'fonctionnalités logiciel avocat',
        'analyse documents ia',
        'automatisation juridique',
      ],
    },
    '/pricing': {
      title: 'Tarifs – Logiciel IA juridique en France',
      description:
        "Subsumio : tarifs pour cabinets d'avocats et experts-comptables en France. Conforme RGPD, hébergé en UE.",
      keywords: [
        'logiciel cabinet avocat france',
        'tarif logiciel juridique ia france',
        'logiciel expertise comptable ia',
        'rgpd logiciel juridique france',
      ],
    },
    '/security': {
      keywords: [
        'rgpd logiciel avocat france',
        'sécurité données juridiques france',
        'iso 27001 logiciel juridique',
      ],
    },
    '/tax': {
      keywords: [
        'logiciel fiscalité ia france',
        'gestion délais fiscaux france',
        'contrôle fiscal ia',
      ],
    },
    '/contact': {
      keywords: [
        'démo logiciel avocat ia',
        'contact équipe subsumio',
        'prendre rendez-vous démo',
      ],
    },
    '/legal/imprint': {
      title: 'Mentions légales',
      description: 'Mentions légales Subsumio (France).',
      keywords: ['mentions légales', 'éditeur', 'coordonnées'],
    },
    '/legal/privacy': {
      title: 'Politique de confidentialité',
      description:
        'Politique de confidentialité Subsumio : RGPD et protection des données.',
      keywords: ['confidentialité', 'rgpd', 'données personnelles'],
    },
    '/legal/terms': {
      title: "Conditions d'utilisation",
      description: "Conditions d'utilisation de Subsumio.",
      keywords: ['conditions', 'cgu', "conditions d'utilisation"],
    },
  },

  'fr-CH': {
    '': {
      keywords: [
        'logiciel ia juridique suisse',
        'logiciel avocat suisse romande',
        'analyse documents ia',
      ],
    },
    '/about': {
      title: 'À propos – Subsumio Suisse',
      description:
        'Subsumio en Suisse : plateforme IA pour cabinets et fiduciaires.',
      keywords: [
        'legal tech suisse',
        'logiciel avocat suisse',
        'logiciel fiduciaire',
      ],
    },
    '/features': {
      title: 'Fonctionnalités – Subsumio',
      description:
        'Analyse IA de documents, extraction, conformité et automatisation pour la Suisse.',
      keywords: [
        'analyse documents ia',
        'fonctionnalités logiciel avocat',
        'automatisation',
      ],
    },
    '/pricing': {
      keywords: [
        'logiciel avocat suisse romande',
        'tarif logiciel juridique suisse',
        'logiciel fiduciaire suisse',
      ],
    },
    '/security': {
      keywords: [
        'lgpd suisse logiciel avocat',
        'sécurité données juridiques suisse',
      ],
    },
    '/contact': {
      keywords: [
        'démo logiciel avocat suisse',
        'contact subsumio',
        'rendez-vous démo',
      ],
    },
    '/tax': {
      keywords: [
        'logiciel fiscalité ia suisse',
        'délais fiscaux suisse',
        'audit fiscal ia',
      ],
    },
    '/legal/imprint': {
      title: 'Mentions légales',
      description: "Mentions légales et informations de l'éditeur.",
      keywords: ['mentions légales', 'éditeur', 'coordonnées'],
    },
    '/legal/privacy': {
      title: 'Politique de confidentialité',
      description:
        'Politique de confidentialité Subsumio : traitement des données et sécurité.',
      keywords: ['confidentialité', 'protection des données', 'rgpd'],
    },
    '/legal/terms': {
      title: "Conditions d'utilisation",
      description: "Conditions d'utilisation de Subsumio.",
      keywords: ['conditions', 'cgu', "conditions d'utilisation"],
    },
  },

  es: {
    '': {
      keywords: [
        'software ia juridico',
        'software despacho abogados',
        'analisis documentos ia',
      ],
    },
    '/about': {
      title: 'Acerca de – Subsumio',
      description:
        'Conoce Subsumio, la plataforma de IA para despachos de abogados y asesorías.',
      keywords: ['acerca de subsumio', 'legal tech', 'plataforma ia jurídica'],
    },
    '/features': {
      title: 'Funciones – Subsumio',
      description:
        'Funciones de Subsumio: análisis de documentos con IA, extracción, cumplimiento y automatización.',
      keywords: [
        'funciones software abogados',
        'analisis documentos ia',
        'automatización workflows',
      ],
    },
    '/pricing': {
      title: 'Precios – Software IA para despachos de abogados',
      description:
        'Precios transparentes de Subsumio para abogados y asesores fiscales. Prueba gratuita 14 días.',
      keywords: [
        'precio software abogados ia',
        'software despacho juridico precio',
        'plataforma compliance ia precio',
        'software fiscal ia españa',
      ],
    },
    '/security': {
      keywords: [
        'rgpd software abogados',
        'seguridad datos juridicos',
        'hosting ue software juridico',
      ],
    },
    '/contact': {
      keywords: ['demo software abogados ia', 'contacto software juridico ia'],
    },
    '/tax': {
      keywords: [
        'software fiscal ia',
        'gestion plazos fiscales',
        'inspeccion fiscal ia',
      ],
    },
    '/legal/imprint': {
      title: 'Aviso legal',
      description: 'Aviso legal e información de la empresa de Subsumio.',
      keywords: ['aviso legal', 'información empresa', 'contacto legal'],
    },
    '/legal/privacy': {
      title: 'Política de privacidad',
      description:
        'Política de privacidad de Subsumio: RGPD, tratamiento de datos y derechos.',
      keywords: ['política de privacidad', 'rgpd', 'protección de datos'],
    },
    '/legal/terms': {
      title: 'Términos de servicio',
      description: 'Términos de servicio de Subsumio.',
      keywords: ['términos', 'términos de servicio', 'condiciones'],
    },
  },

  it: {
    '': {
      keywords: [
        'software ia legale',
        'software studio legale',
        'analisi documenti ia',
      ],
    },
    '/about': {
      title: 'Chi siamo – Subsumio',
      description:
        'Scopri Subsumio, la piattaforma IA per studi legali e commercialisti.',
      keywords: ['chi siamo subsumio', 'legal tech', 'piattaforma ia legale'],
    },
    '/features': {
      title: 'Funzionalità – Subsumio',
      description:
        'Funzionalità Subsumio: analisi documenti con IA, estrazione, compliance e automazione.',
      keywords: [
        'funzionalità software legale',
        'analisi documenti ia',
        'automazione workflow',
      ],
    },
    '/pricing': {
      title: 'Prezzi – Software IA per studi legali',
      description:
        'Prezzi trasparenti di Subsumio per avvocati e commercialisti. Prova gratuita 14 giorni.',
      keywords: [
        'prezzo software avvocati ia',
        'software studio legale prezzo',
        'piattaforma compliance ia prezzo',
        'software fiscale ia italia',
      ],
    },
    '/security': {
      keywords: [
        'gdpr software avvocati',
        'sicurezza dati legali',
        'hosting ue software legale',
      ],
    },
    '/contact': {
      keywords: ['demo software avvocati ia', 'contatto software legale ia'],
    },
    '/tax': {
      keywords: [
        'software fiscale ia',
        'gestione scadenze fiscali',
        'accertamento fiscale ia',
      ],
    },
    '/legal/imprint': {
      title: 'Note legali',
      description: 'Informazioni legali e societarie di Subsumio.',
      keywords: ['note legali', 'informazioni azienda', 'contatti legali'],
    },
    '/legal/privacy': {
      title: 'Informativa sulla privacy',
      description: 'Privacy Subsumio: GDPR, trattamento dei dati e diritti.',
      keywords: ['privacy', 'gdpr', 'protezione dati'],
    },
    '/legal/terms': {
      title: 'Termini di servizio',
      description: 'Termini di servizio di Subsumio.',
      keywords: ['termini', 'termini di servizio', 'condizioni'],
    },
  },

  'it-IT': {
    '': {
      keywords: [
        'software ia legale italia',
        'software studio legale italia',
        'analisi documenti ia',
      ],
    },
    '/about': {
      title: 'Chi siamo – Subsumio Italia',
      description:
        'Subsumio in Italia: piattaforma IA per studi legali e commercialisti.',
      keywords: [
        'legal tech italia',
        'piattaforma ia legale',
        'software studio legale',
      ],
    },
    '/features': {
      title: 'Funzionalità – Subsumio',
      description:
        'Analisi documenti con IA, estrazione e workflow per professionisti in Italia.',
      keywords: [
        'funzionalità software legale',
        'analisi documenti ia',
        'workflow',
      ],
    },
    '/pricing': {
      title: 'Prezzi – Software IA per studi legali in Italia',
      description:
        'Subsumio: prezzi per avvocati e commercialisti in Italia. Conforme GDPR, ospitato in UE.',
      keywords: [
        'software studio legale italia',
        'prezzo software legale ia italia',
        'software commercialista ia',
        'gdpr software legale italia',
      ],
    },
    '/tax': {
      keywords: [
        'software fiscale ia italia',
        'gestione scadenze agenzia entrate',
        'accertamento fiscale ia italia',
      ],
    },
    '/security': {
      keywords: [
        'gdpr software legale italia',
        'sicurezza dati legali',
        'hosting ue',
      ],
    },
    '/contact': {
      keywords: [
        'demo software legale ia',
        'contatto subsumio',
        'prenota demo',
      ],
    },
    '/legal/imprint': {
      title: 'Note legali',
      description: 'Informazioni legali e societarie di Subsumio.',
      keywords: ['note legali', 'informazioni azienda', 'contatti'],
    },
    '/legal/privacy': {
      title: 'Informativa sulla privacy',
      description: 'Privacy Subsumio: GDPR e trattamento dei dati.',
      keywords: ['privacy', 'gdpr', 'protezione dati'],
    },
    '/legal/terms': {
      title: 'Termini di servizio',
      description: 'Termini di servizio di Subsumio.',
      keywords: ['termini', 'condizioni', 'termini di servizio'],
    },
  },

  'it-CH': {
    '': {
      keywords: [
        'software ia legale svizzera',
        'software avvocato ticino',
        'analisi documenti ia',
      ],
    },
    '/about': {
      title: 'Chi siamo – Subsumio Svizzera',
      description:
        'Subsumio: piattaforma IA per studi legali e fiduciari in Svizzera.',
      keywords: [
        'legal tech svizzera',
        'software avvocato ticino',
        'software fiduciario',
      ],
    },
    '/features': {
      title: 'Funzionalità – Subsumio',
      description:
        'Analisi documenti con IA, estrazione e compliance per la Svizzera.',
      keywords: [
        'analisi documenti ia',
        'funzionalità software legale',
        'compliance',
      ],
    },
    '/pricing': {
      keywords: [
        'software avvocato svizzera italiana',
        'prezzo software legale svizzera',
        'software fiduciario svizzera',
      ],
    },
    '/security': {
      keywords: ['sicurezza dati legali', 'protezione dati', 'hosting ue'],
    },
    '/contact': {
      keywords: ['demo software avvocati', 'contatto subsumio', 'prenota demo'],
    },
    '/tax': {
      keywords: [
        'software fiscale ia svizzera',
        'scadenze fiscali svizzera',
        'audit fiscale ia',
      ],
    },
    '/legal/imprint': {
      title: 'Note legali',
      description: 'Informazioni legali e societarie di Subsumio.',
      keywords: ['note legali', 'informazioni azienda', 'contatti'],
    },
    '/legal/privacy': {
      title: 'Informativa sulla privacy',
      description: 'Privacy Subsumio: trattamento dei dati e sicurezza.',
      keywords: ['privacy', 'protezione dati', 'gdpr'],
    },
    '/legal/terms': {
      title: 'Termini di servizio',
      description: 'Termini di servizio di Subsumio.',
      keywords: ['termini', 'condizioni', 'termini di servizio'],
    },
  },

  pl: {
    '': {
      keywords: [
        'oprogramowanie ai prawnicze',
        'oprogramowanie kancelaria prawna',
        'analiza dokumentow ai',
      ],
    },
    '/about': {
      title: 'O nas – Subsumio',
      description:
        'Poznaj Subsumio, platformę AI dla kancelarii prawnych i doradców podatkowych.',
      keywords: ['o nas subsumio', 'legal tech', 'platforma ai prawnicza'],
    },
    '/features': {
      title: 'Funkcje – Subsumio',
      description:
        'Funkcje Subsumio: analiza dokumentów AI, ekstrakcja, compliance i automatyzacja.',
      keywords: [
        'funkcje oprogramowanie prawnicze',
        'analiza dokumentow ai',
        'automatyzacja workflow',
      ],
    },
    '/pricing': {
      title: 'Cennik – Oprogramowanie AI dla kancelarii prawnych',
      description:
        'Przejrzyste ceny Subsumio dla prawników i doradców podatkowych w Polsce. Bezpłatny okres próbny 14 dni.',
      keywords: [
        'cena oprogramowanie prawnicze ai',
        'oprogramowanie kancelaria cena',
        'platforma compliance ai cena',
        'oprogramowanie podatkowe ai polska',
      ],
    },
    '/security': {
      keywords: [
        'rodo oprogramowanie prawnicze',
        'bezpieczenstwo danych kancelaria',
        'hosting ue oprogramowanie prawnicze',
      ],
    },
    '/contact': {
      keywords: [
        'demo oprogramowanie prawnicze ai',
        'kontakt oprogramowanie prawnicze ai',
      ],
    },
    '/tax': {
      keywords: [
        'oprogramowanie podatkowe ai',
        'zarzadzanie terminami podatkowymi',
        'kontrola podatkowa ai',
      ],
    },
    '/legal/imprint': {
      title: 'Imprint',
      description: 'Informacje prawne i dane firmy Subsumio.',
      keywords: ['imprint', 'informacje prawne', 'dane firmy'],
    },
    '/legal/privacy': {
      title: 'Polityka prywatności',
      description:
        'Polityka prywatności Subsumio: RODO, przetwarzanie danych i prawa.',
      keywords: ['polityka prywatności', 'rodo', 'ochrona danych'],
    },
    '/legal/terms': {
      title: 'Warunki korzystania',
      description: 'Warunki korzystania z Subsumio.',
      keywords: ['warunki', 'regulamin', 'warunki korzystania'],
    },
  },

  'pt-BR': {
    '': {
      keywords: [
        'software ia juridico brasil',
        'software escritorio advocacia',
        'analise documentos ia',
      ],
    },
    '/about': {
      title: 'Sobre – Subsumio',
      description:
        'Conheça a Subsumio, plataforma de IA para escritórios de advocacia e contabilidade.',
      keywords: ['sobre subsumio', 'legal tech', 'plataforma ia jurídica'],
    },
    '/features': {
      title: 'Recursos – Subsumio',
      description:
        'Recursos da Subsumio: análise de documentos com IA, extração, compliance e automação.',
      keywords: [
        'recursos software jurídico',
        'analise documentos ia',
        'automação workflow',
      ],
    },
    '/pricing': {
      title: 'Preços – Software IA para escritórios de advocacia',
      description:
        'Preços transparentes do Subsumio para advogados e contadores no Brasil. Teste grátis por 14 dias.',
      keywords: [
        'preco software advocacia ia brasil',
        'software juridico ia preco',
        'plataforma compliance ia brasil',
        'software contabilidade ia brasil',
      ],
    },
    '/security': {
      keywords: [
        'lgpd software advocacia',
        'seguranca dados juridicos brasil',
        'software juridico lgpd',
      ],
    },
    '/contact': {
      keywords: [
        'demo software advocacia ia brasil',
        'contato software juridico ia',
      ],
    },
    '/tax': {
      keywords: [
        'software fiscal ia brasil',
        'gestao prazos receita federal',
        'auditoria fiscal ia',
      ],
    },
    '/legal/imprint': {
      title: 'Aviso legal',
      description: 'Informações legais e empresariais da Subsumio.',
      keywords: ['aviso legal', 'informações legais', 'empresa'],
    },
    '/legal/privacy': {
      title: 'Política de privacidade',
      description:
        'Política de privacidade Subsumio: LGPD, tratamento de dados e direitos.',
      keywords: ['política de privacidade', 'lgpd', 'proteção de dados'],
    },
    '/legal/terms': {
      title: 'Termos de serviço',
      description: 'Termos de serviço da Subsumio.',
      keywords: ['termos', 'termos de serviço', 'condições'],
    },
  },

  'pt-PT': {
    '': {
      keywords: [
        'software ia jurídico',
        'software escritório de advogados',
        'análise de documentos ia',
      ],
    },
    '/about': {
      title: 'Sobre – Subsumio Portugal',
      description:
        'Subsumio em Portugal: plataforma IA para advogados e contabilistas.',
      keywords: [
        'legal tech portugal',
        'plataforma ia jurídica',
        'software advogados',
      ],
    },
    '/features': {
      title: 'Funcionalidades – Subsumio',
      description:
        'Funcionalidades: análise de documentos com IA, extração, compliance e automação.',
      keywords: [
        'funcionalidades software jurídico',
        'análise documentos ia',
        'automação workflow',
      ],
    },
    '/pricing': {
      title: 'Preços – Software IA para escritórios de advogados em Portugal',
      description:
        'Subsumio: preços para advogados e contabilistas em Portugal. Conforme RGPD, alojado na UE.',
      keywords: [
        'software advogados portugal ia',
        'preco software juridico ia portugal',
        'software contabilidade ia portugal',
        'rgpd software juridico portugal',
      ],
    },
    '/security': {
      keywords: [
        'rgpd software advogados portugal',
        'seguranca dados juridicos portugal',
      ],
    },
    '/tax': {
      keywords: [
        'software fiscal ia portugal',
        'gestao prazos at portugal',
        'inspecao tributaria ia',
      ],
    },
    '/contact': {
      keywords: [
        'demo software jurídico ia',
        'contacto subsumio',
        'marcar demo',
      ],
    },
    '/legal/imprint': {
      title: 'Aviso legal',
      description: 'Informações legais e empresariais da Subsumio.',
      keywords: ['aviso legal', 'informações legais', 'empresa'],
    },
    '/legal/privacy': {
      title: 'Política de privacidade',
      description:
        'Política de privacidade Subsumio: RGPD, tratamento de dados e direitos.',
      keywords: ['política de privacidade', 'rgpd', 'proteção de dados'],
    },
    '/legal/terms': {
      title: 'Termos de serviço',
      description: 'Termos de serviço da Subsumio.',
      keywords: ['termos', 'termos de serviço', 'condições'],
    },
  },

  ja: {
    '': {
      keywords: [
        '法律AIプラットフォーム',
        '法律事務所ソフトウェア',
        'AI文書分析',
      ],
    },
    '/about': {
      title: 'Subsumioについて',
      description:
        'Subsumioは法律・税務プロフェッショナル向けのAIプラットフォームです。',
      keywords: ['subsumio 会社', '法律 ai', 'リーガルテック'],
    },
    '/tax': {
      title: '税務 – AIツール',
      description: '税務向けAI：期限管理、レビュー、監査支援。',
      keywords: ['税務 ai', '期限管理', '税務監査'],
    },
    '/pricing': {
      title: '料金 – 法律事務所向けAIソフトウェア',
      description:
        'Subsumioの料金プラン – 弁護士・税理士向けAIプラットフォーム。14日間無料トライアル。',
      keywords: [
        '法律事務所 AI ソフトウェア 料金',
        '弁護士 AI ツール 価格',
        'コンプライアンス AI プラットフォーム',
        '税務 AI ソフトウェア',
      ],
    },
    '/security': {
      keywords: [
        'GDPR 法律ソフトウェア',
        '弁護士 データセキュリティ',
        'EU ホスティング 法律プラットフォーム',
      ],
    },
    '/contact': {
      keywords: ['法律AI デモ予約', '弁護士ソフトウェア 問い合わせ'],
    },
    '/features': {
      keywords: ['AI 文書分析 弁護士', '矛盾検出 契約書', '期限管理 法律 AI'],
    },
    '/legal/imprint': {
      title: '特定商取引法に基づく表記',
      description: 'Subsumioの事業者情報。',
      keywords: ['事業者情報', '表記', '会社情報'],
    },
    '/legal/privacy': {
      title: 'プライバシーポリシー',
      description: 'Subsumioのプライバシーポリシー（GDPR等）。',
      keywords: ['プライバシーポリシー', '個人情報', 'GDPR'],
    },
    '/legal/terms': {
      title: '利用規約',
      description: 'Subsumioの利用規約。',
      keywords: ['利用規約', '規約', '条件'],
    },
  },

  ko: {
    '': {
      keywords: ['법률 AI 플랫폼', '법률 사무소 소프트웨어', 'AI 문서 분석'],
    },
    '/about': {
      title: '회사 소개 – Subsumio',
      description: 'Subsumio는 법률/세무 전문가를 위한 AI 플랫폼입니다.',
      keywords: ['subsumio 소개', '리걸테크', '법률 ai 회사'],
    },
    '/tax': {
      title: '세무 – AI 도구',
      description: '세무를 위한 AI: 기한 관리, 검토, 감사 지원.',
      keywords: ['세무 ai', '기한 관리', '세무 감사'],
    },
    '/pricing': {
      title: '가격 – 법률 사무소를 위한 AI 소프트웨어',
      description:
        'Subsumio 가격 플랜 – 변호사 및 세무사를 위한 AI 플랫폼. 14일 무료 체험.',
      keywords: [
        '법률 사무소 AI 소프트웨어 가격',
        '변호사 AI 도구 비용',
        '컴플라이언스 AI 플랫폼',
        '세무 AI 소프트웨어',
      ],
    },
    '/security': {
      keywords: [
        'GDPR 법률 소프트웨어',
        '변호사 데이터 보안',
        'EU 호스팅 법률 플랫폼',
      ],
    },
    '/contact': {
      keywords: ['법률 AI 데모 예약', '변호사 소프트웨어 문의'],
    },
    '/features': {
      keywords: [
        'AI 문서 분석 변호사',
        '모순 감지 계약서',
        '기한 관리 법률 AI',
      ],
    },
    '/legal/imprint': {
      title: '법적 고지',
      description: 'Subsumio 회사 및 법적 정보.',
      keywords: ['법적 고지', '회사 정보', '사업자 정보'],
    },
    '/legal/privacy': {
      title: '개인정보 처리방침',
      description: 'Subsumio 개인정보 처리방침 (GDPR 등).',
      keywords: ['개인정보 처리방침', 'GDPR', '데이터 보호'],
    },
    '/legal/terms': {
      title: '이용약관',
      description: 'Subsumio 이용약관.',
      keywords: ['이용약관', '약관', '조건'],
    },
  },

  ar: {
    '': {
      keywords: [
        'منصة الذكاء الاصطناعي القانونية',
        'برنامج مكتب المحاماة',
        'تحليل المستندات بالذكاء الاصطناعي',
      ],
    },
    '/about': {
      title: 'حول Subsumio',
      description:
        'تعرّف على Subsumio، منصة ذكاء اصطناعي للمحامين والمستشارين الضريبيين.',
      keywords: ['حول subsumio', 'تقنية قانونية', 'منصة ذكاء اصطناعي قانونية'],
    },
    '/pricing': {
      title: 'الأسعار – برنامج الذكاء الاصطناعي للمحامين',
      description:
        'أسعار Subsumio الشفافة للمحامين والمستشارين الضريبيين. تجربة مجانية لمدة 14 يومًا.',
      keywords: [
        'سعر برنامج محاماة ذكاء اصطناعي',
        'برنامج مكتب قانوني سعر',
        'منصة امتثال ذكاء اصطناعي',
        'برنامج ضريبي ذكاء اصطناعي',
      ],
    },
    '/security': {
      keywords: [
        'برنامج محاماة gdpr',
        'أمان بيانات قانونية',
        'استضافة أوروبية برنامج قانوني',
      ],
    },
    '/contact': {
      keywords: [
        'عرض توضيحي برنامج محاماة',
        'تواصل برنامج قانوني ذكاء اصطناعي',
      ],
    },
    '/features': {
      keywords: [
        'تحليل مستندات ذكاء اصطناعي',
        'كشف التناقضات في العقود',
        'إدارة المواعيد القانونية',
      ],
    },
    '/tax': {
      keywords: [
        'برنامج ضريبي ذكاء اصطناعي',
        'إدارة مواعيد ضريبية',
        'تدقيق ضريبي ذكاء اصطناعي',
      ],
    },
    '/legal/imprint': {
      title: 'إشعار قانوني',
      description: 'معلومات قانونية ومعلومات الشركة الخاصة بـ Subsumio.',
      keywords: ['إشعار قانوني', 'معلومات الشركة', 'بيانات قانونية'],
    },
    '/legal/privacy': {
      title: 'سياسة الخصوصية',
      description:
        'سياسة الخصوصية لـ Subsumio: معالجة البيانات وحقوق المستخدم.',
      keywords: ['سياسة الخصوصية', 'حماية البيانات', 'GDPR'],
    },
    '/legal/terms': {
      title: 'شروط الخدمة',
      description: 'شروط خدمة Subsumio.',
      keywords: ['شروط', 'شروط الخدمة', 'الأحكام'],
    },
  },
};

export function resolveSeoMarketOverride(
  locale: Locale,
  path: string
): SeoMarketOverride | null {
  const marketOverrides = seoMarketOverrides[locale];
  if (!marketOverrides) return null;
  return marketOverrides[path as SeoIndexablePath] ?? null;
}
