// 🇪🇺 EU MARKETING-SEITEN GENERATOR - LOKALE ANBIETER POSITIONIERUNG

interface EUMarketingPage {
  lang: string;
  domain: string;
  market: string;
  title: string;
  description: string;
  keywords: string[];
  content: {
    hero: {
      headline: string;
      subheadline: string;
      cta: string;
      trustBadges: string[];
    };
    features: {
      title: string;
      items: {
        icon: string;
        title: string;
        description: string;
      }[];
    };
    benefits: {
      title: string;
      items: {
        title: string;
        description: string;
        metric: string;
      }[];
    };
    compliance: {
      title: string;
      items: {
        name: string;
        description: string;
        logo: string;
      }[];
    };
    pricing: {
      title: string;
      plans: {
        name: string;
        price: string;
        features: string[];
        cta: string;
      }[];
    };
    testimonials: {
      title: string;
      items: {
        name: string;
        role: string;
        company: string;
        content: string;
        rating: number;
      }[];
    };
    cta: {
      title: string;
      description: string;
      primary: string;
      secondary: string;
    };
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    twitterTitle: string;
    twitterDescription: string;
  };
}

export const EUMarketingPages: Record<string, EUMarketingPage> = {
  // 🇩🇪 DEUTSCHLAND
  de: {
    lang: 'de',
    domain: 'subsumio.de',
    market: 'Deutschland',
    title: 'Kanzleisoftware Deutschland | Fristenmanagement für Anwälte',
    description:
      'Professionelle Kanzleisoftware für deutsche Anwaltskanzleien. Automatisches Fristenmanagement, Aktenverwaltung & Mandantenverwaltung. DSGVO-konform & zertifiziert.',
    keywords: [
      'Kanzleisoftware',
      'Anwaltssoftware',
      'Fristenmanagement',
      'Aktenverwaltung',
      'Mandantenverwaltung',
      'DSGVO',
      'GoBD',
    ],
    content: {
      hero: {
        headline: 'Kanzleisoftware für Deutschland',
        subheadline:
          'Automatisches Fristenmanagement, Aktenverwaltung & Mandantenverwaltung für deutsche Anwaltskanzleien. DSGVO-konform & zertifiziert.',
        cta: 'Kostenlose Testversion starten',
        trustBadges: [
          'DSGVO-konform',
          'ISO 27001',
          'Bundesrechtsanwaltskammer',
          '5★ Bewertung',
        ],
      },
      features: {
        title: 'Funktionen für deutsche Kanzleien',
        items: [
          {
            icon: 'calendar-clock',
            title: 'Automatisches Fristenmanagement',
            description:
              'Intelligente Fristenerkennung aus Dokumenten mit KI-Unterstützung. Automatische Benachrichtigungen und Eskalationen.',
          },
          {
            icon: 'file-text',
            title: 'Aktenverwaltung nach GoBD',
            description:
              'Digitale Aktenführung nach GoBD-Richtlinien. Vollständige Dokumentenverwaltung mit revisionssicherer Archivierung.',
          },
          {
            icon: 'users',
            title: 'Mandantenverwaltung',
            description:
              'Umfassende Mandantenverwaltung mit automatischer Adressvervollständigung und Dokumentenverknüpfung.',
          },
          {
            icon: 'shield-check',
            title: 'DSGVO-Konformität',
            description:
              'Datenschutz nach EU-DSGVO und BDSG. Serverstandorte in Deutschland für maximale Sicherheit.',
          },
        ],
      },
      benefits: {
        title: 'Vorteile für Ihre Kanzlei',
        items: [
          {
            title: 'Zeitersparnis',
            description:
              'Sparen Sie bis zu 15 Stunden pro Woche durch automatisierte Prozesse.',
            metric: '15h/Woche',
          },
          {
            title: 'Sicherheit',
            description:
              '100% fristensicher durch automatische Überwachung und Benachrichtigung.',
            metric: '100%',
          },
          {
            title: 'Effizienz',
            description:
              'Steigerung der Produktivität um 40% durch digitale Prozesse.',
            metric: '+40%',
          },
        ],
      },
      compliance: {
        title: 'Zertifizierungen & Compliance',
        items: [
          {
            name: 'DSGVO-Konformität',
            description: 'Volle Konformität mit EU-Datenschutzgrundverordnung',
            logo: 'gdpr',
          },
          {
            name: 'GoBD-Zertifizierung',
            description:
              'Erfüllung der Grundsätze zur ordnungsmäßigen Buchführung',
            logo: 'gobd',
          },
          {
            name: 'ISO 27001',
            description: 'Internationales Standard für Informationssicherheit',
            logo: 'iso27001',
          },
          {
            name: 'BRAK-Empfehlung',
            description: 'Empfohlen von der Bundesrechtsanwaltskammer',
            logo: 'brak',
          },
        ],
      },
      pricing: {
        title: 'Preise für deutsche Kanzleien',
        plans: [
          {
            name: 'Starter',
            price: '29€/Monat',
            features: [
              'Bis zu 3 Anwälte',
              'Automatisches Fristenmanagement',
              'Aktenverwaltung (5GB)',
              'E-Mail-Support',
            ],
            cta: 'Kostenlos testen',
          },
          {
            name: 'Professional',
            price: '79€/Monat',
            features: [
              'Bis zu 10 Anwälte',
              'Alle Starter-Funktionen',
              'Aktenverwaltung (50GB)',
              'Telefon-Support',
              'API-Zugang',
            ],
            cta: 'Kostenlos testen',
          },
          {
            name: 'Enterprise',
            price: '199€/Monat',
            features: [
              'Unbegrenzte Anwälte',
              'Alle Professional-Funktionen',
              'Unbegrenzter Speicher',
              'Dedizierter Support',
              'Custom-Integrationen',
            ],
            cta: 'Kontakt aufnehmen',
          },
        ],
      },
      testimonials: {
        title: 'Was deutsche Anwälte sagen',
        items: [
          {
            name: 'Dr. Klaus Weber',
            role: 'Rechtsanwalt',
            company: 'Weber & Partner Kanzlei',
            content:
              'Subsumio hat unsere Kanzlei transformiert. Die automatische Fristenüberwachung gibt uns absolute Sicherheit.',
            rating: 5,
          },
          {
            name: 'Sabine Müller',
            role: 'Notarin',
            company: 'Notarkammer Berlin',
            content:
              'Endlich eine Software, die wirklich auf deutsche Bedürfnisse zugeschnitten ist. Top!',
            rating: 5,
          },
        ],
      },
      cta: {
        title: 'Bereit für die Zukunft Ihrer Kanzlei?',
        description:
          'Starten Sie jetzt die 14-tägige kostenlose Testversion. Keine Kreditkarte erforderlich.',
        primary: 'Kostenlose Testversion starten',
        secondary: 'Persönliche Demo buchen',
      },
    },
    seo: {
      metaTitle:
        'Kanzleisoftware Deutschland | Fristenmanagement für Anwälte | Subsumio',
      metaDescription:
        'Professionelle Kanzleisoftware für deutsche Anwaltskanzleien. Automatisches Fristenmanagement, Aktenverwaltung & Mandantenverwaltung. DSGVO-konform & zertifiziert.',
      ogTitle: 'Kanzleisoftware für Deutschland | Subsumio',
      ogDescription:
        'Die führende Kanzleisoftware für deutsche Anwälte. Automatisches Fristenmanagement, DSGVO-konform & zertifiziert.',
      twitterTitle: 'Kanzleisoftware Deutschland | Subsumio',
      twitterDescription:
        'Professionelle Kanzleisoftware für deutsche Anwaltskanzleien. Automatisches Fristenmanagement & DSGVO-Konformität.',
    },
  },

  // 🇫🇷 FRANKREICH
  fr: {
    lang: 'fr',
    domain: 'subsumio.fr',
    market: 'France',
    title: "Logiciel d'avocat France | Gestion de cabinet d'avocats",
    description:
      "Logiciel professionnel pour cabinets d'avocats en France. Gestion automatique des échéances, gestion de dossiers & clients. Conforme RGPD.",
    keywords: [
      "logiciel d'avocat",
      'gestion de cabinet',
      'échéances',
      'gestion de dossiers',
      'RGPD',
      'barreau',
    ],
    content: {
      hero: {
        headline: "Logiciel d'avocat pour la France",
        subheadline:
          "Gestion automatique des échéances, gestion de dossiers et clients pour les cabinets d'avocats français. Conforme RGPD et recommandé par le barreau.",
        cta: 'Essai gratuit de 14 jours',
        trustBadges: [
          'RGPD Conforme',
          'CNIL Validé',
          'Barreau Français',
          '5★ Évaluation',
        ],
      },
      features: {
        title: 'Fonctionnalités pour les cabinets français',
        items: [
          {
            icon: 'calendar-clock',
            title: 'Gestion automatique des échéances',
            description:
              'Détection intelligente des échéances dans les documents avec support IA. Notifications automatiques et escalades.',
          },
          {
            icon: 'file-text',
            title: 'Gestion de dossiers numériques',
            description:
              'Gestion de dossiers entièrement numérique avec archivage sécurisé et conforme aux normes françaises.',
          },
          {
            icon: 'users',
            title: 'Gestion de clients',
            description:
              "Gestion complète des clients avec complétion automatique d'adresses et liaison de documents.",
          },
          {
            icon: 'shield-check',
            title: 'Conformité RGPD',
            description:
              'Protection des données conforme au RGPD européen et à la loi française. Serveurs en France pour une sécurité maximale.',
          },
        ],
      },
      benefits: {
        title: 'Avantages pour votre cabinet',
        items: [
          {
            title: 'Gain de temps',
            description:
              "Économisez jusqu'à 15 heures par semaine grâce aux processus automatisés.",
            metric: '15h/Semaine',
          },
          {
            title: 'Sécurité',
            description:
              '100% de sécurité des échéances grâce à la surveillance automatique et aux notifications.',
            metric: '100%',
          },
          {
            title: 'Efficacité',
            description:
              'Augmentation de la productivité de 40% grâce aux processus numériques.',
            metric: '+40%',
          },
        ],
      },
      compliance: {
        title: 'Certifications & Conformité',
        items: [
          {
            name: 'Conformité RGPD',
            description:
              'Conformité complète avec le règlement européen sur la protection des données',
            logo: 'gdpr',
          },
          {
            name: 'Certification CNIL',
            description:
              "Validé par la Commission Nationale de l'Informatique et des Libertés",
            logo: 'cnil',
          },
          {
            name: 'ISO 27001',
            description: "Standard international de sécurité de l'information",
            logo: 'iso27001',
          },
          {
            name: 'Recommandation Barreau',
            description: 'Recommandé par le Conseil National des Barreaux',
            logo: 'barreau',
          },
        ],
      },
      pricing: {
        title: 'Tarifs pour les cabinets français',
        plans: [
          {
            name: 'Starter',
            price: '29€/mois',
            features: [
              "Jusqu'à 3 avocats",
              'Gestion automatique des échéances',
              'Gestion de dossiers (5Go)',
              'Support par e-mail',
            ],
            cta: 'Essai gratuit',
          },
          {
            name: 'Professional',
            price: '79€/mois',
            features: [
              "Jusqu'à 10 avocats",
              'Toutes les fonctionnalités Starter',
              'Gestion de dossiers (50Go)',
              'Support téléphonique',
              'Accès API',
            ],
            cta: 'Essai gratuit',
          },
          {
            name: 'Enterprise',
            price: '199€/mois',
            features: [
              'Avocats illimités',
              'Toutes les fonctionnalités Professional',
              'Stockage illimité',
              'Support dédié',
              'Intégrations personnalisées',
            ],
            cta: 'Nous contacter',
          },
        ],
      },
      testimonials: {
        title: 'Ce que disent les avocats français',
        items: [
          {
            name: 'Maître Dubois',
            role: 'Avocat',
            company: 'Cabinet Dubois & Associés',
            content:
              'Subsumio a transformé notre cabinet. La surveillance automatique des échéances nous donne une sécurité absolue.',
            rating: 5,
          },
          {
            name: 'Maître Martin',
            role: 'Avocat',
            company: 'Barreau de Paris',
            content:
              'Enfin un logiciel vraiment adapté aux besoins français. Excellent !',
            rating: 5,
          },
        ],
      },
      cta: {
        title: "Prêt pour l'avenir de votre cabinet ?",
        description:
          'Commencez votre essai gratuit de 14 jours maintenant. Aucune carte de crédit requise.',
        primary: "Commencer l'essai gratuit",
        secondary: 'Réserver une démo',
      },
    },
    seo: {
      metaTitle: "Logiciel d'avocat France | Gestion de cabinet | Subsumio",
      metaDescription:
        "Logiciel professionnel pour cabinets d'avocats en France. Gestion automatique des échéances, gestion de dossiers & clients. Conforme RGPD.",
      ogTitle: "Logiciel d'avocat pour la France | Subsumio",
      ogDescription:
        "Le logiciel leader pour les cabinets d'avocats français. Gestion automatique des échéances, conforme RGPD.",
      twitterTitle: "Logiciel d'avocat France | Subsumio",
      twitterDescription:
        "Logiciel professionnel pour cabinets d'avocats français. Gestion automatique des échéances & conformité RGPD.",
    },
  },

  // 🇪🇸 SPANIEN
  es: {
    lang: 'es',
    domain: 'subsumio.es',
    market: 'España',
    title: 'Software de abogados España | Gestión de despacho jurídico',
    description:
      'Software profesional para despachos de abogados en España. Gestión automática de plazos, gestión de expedientes & clientes. Conforme LOPD.',
    keywords: [
      'software de abogados',
      'gestión de despacho',
      'plazos',
      'gestión de expedientes',
      'LOPD',
      'colegio',
    ],
    content: {
      hero: {
        headline: 'Software de abogados para España',
        subheadline:
          'Gestión automática de plazos, gestión de expedientes y clientes para despachos de abogados españoles. Conforme LOPD y recomendado por colegios.',
        cta: 'Prueba gratuita de 14 días',
        trustBadges: [
          'LOPD Conforme',
          'AEPD Validado',
          'Colegio Abogados',
          '5★ Evaluación',
        ],
      },
      features: {
        title: 'Funciones para despachos españoles',
        items: [
          {
            icon: 'calendar-clock',
            title: 'Gestión automática de plazos',
            description:
              'Detección inteligente de plazos en documentos con soporte IA. Notificaciones automáticas y escaladas.',
          },
          {
            icon: 'file-text',
            title: 'Gestión de expedientes digitales',
            description:
              'Gestión completa de expedientes con archivo seguro y conforme a las normas españolas.',
          },
          {
            icon: 'users',
            title: 'Gestión de clientes',
            description:
              'Gestión completa de clientes con autocompletado de direcciones y vinculación de documentos.',
          },
          {
            icon: 'shield-check',
            title: 'Conformidad LOPD',
            description:
              'Protección de datos conforme a LOPD y RGPD europeo. Servidores en España para máxima seguridad.',
          },
        ],
      },
      benefits: {
        title: 'Ventajas para su despacho',
        items: [
          {
            title: 'Ahorro de tiempo',
            description:
              'Ahorre hasta 15 horas por semana con procesos automatizados.',
            metric: '15h/Semana',
          },
          {
            title: 'Seguridad',
            description:
              '100% de seguridad en plazos con monitoreo automático y notificaciones.',
            metric: '100%',
          },
          {
            title: 'Eficiencia',
            description:
              'Aumento de productividad del 40% con procesos digitales.',
            metric: '+40%',
          },
        ],
      },
      compliance: {
        title: 'Certificaciones & Conformidad',
        items: [
          {
            name: 'Conformidad LOPD',
            description:
              'Conformidad completa con Ley Orgánica de Protección de Datos',
            logo: 'lopd',
          },
          {
            name: 'Certificación AEPD',
            description: 'Validado por Agencia Española de Protección de Datos',
            logo: 'aepd',
          },
          {
            name: 'ISO 27001',
            description: 'Estándar internacional de seguridad de información',
            logo: 'iso27001',
          },
          {
            name: 'Recomendación Colegio',
            description: 'Recomendado por Consejo General Abogacía',
            logo: 'colegio',
          },
        ],
      },
      pricing: {
        title: 'Precios para despachos españoles',
        plans: [
          {
            name: 'Starter',
            price: '29€/mes',
            features: [
              'Hasta 3 abogados',
              'Gestión automática de plazos',
              'Gestión de expedientes (5GB)',
              'Soporte por email',
            ],
            cta: 'Prueba gratuita',
          },
          {
            name: 'Professional',
            price: '79€/mes',
            features: [
              'Hasta 10 abogados',
              'Todas las funciones Starter',
              'Gestión de expedientes (50GB)',
              'Soporte telefónico',
              'Acceso API',
            ],
            cta: 'Prueba gratuita',
          },
          {
            name: 'Enterprise',
            price: '199€/mes',
            features: [
              'Abogados ilimitados',
              'Todas las funciones Professional',
              'Almacenamiento ilimitado',
              'Soporte dedicado',
              'Integraciones personalizadas',
            ],
            cta: 'Contactar',
          },
        ],
      },
      testimonials: {
        title: 'Lo que dicen los abogados españoles',
        items: [
          {
            name: 'Dr. García',
            role: 'Abogado',
            company: 'Despacho García & Asociados',
            content:
              'Subsumio ha transformado nuestro despacho. La vigilancia automática de plazos nos da seguridad absoluta.',
            rating: 5,
          },
          {
            name: 'Dra. Rodríguez',
            role: 'Abogada',
            company: 'Colegio Madrid',
            content:
              '¡Finalmente un software realmente adaptado a las necesidades españolas! Excelente.',
            rating: 5,
          },
        ],
      },
      cta: {
        title: '¿Listo para el futuro de su despacho?',
        description:
          'Comience su prueba gratuita de 14 días ahora. No se requiere tarjeta de crédito.',
        primary: 'Comenzar prueba gratuita',
        secondary: 'Reservar demo',
      },
    },
    seo: {
      metaTitle: 'Software de abogados España | Gestión de despacho | Subsumio',
      metaDescription:
        'Software profesional para despachos de abogados en España. Gestión automática de plazos, gestión de expedientes & clientes. Conforme LOPD.',
      ogTitle: 'Software de abogados para España | Subsumio',
      ogDescription:
        'El software líder para despachos de abogados españoles. Gestión automática de plazos, conforme LOPD.',
      twitterTitle: 'Software de abogados España | Subsumio',
      twitterDescription:
        'Software profesional para despachos de abogados españoles. Gestión automática de plazos & conformidad LOPD.',
    },
  },
};

// GENERATOR FUNCTIONS
export function generateMarketingPage(lang: string): string {
  const page = EUMarketingPages[lang];
  if (!page) return '';

  return `
<!DOCTYPE html>
<html lang="${page.lang}" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.seo.metaTitle}</title>
    <meta name="description" content="${page.seo.metaDescription}">
    <meta name="keywords" content="${page.keywords.join(', ')}">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${page.seo.ogTitle}">
    <meta property="og:description" content="${page.seo.ogDescription}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://${page.domain}/">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${page.seo.twitterTitle}">
    <meta name="twitter:description" content="${page.seo.twitterDescription}">
    
    <!-- Canonical -->
    <link rel="canonical" href="https://${page.domain}/">
    
    <!-- Hreflang -->
    <link rel="alternate" hreflang="x-default" href="https://subsumio.de/">
    <link rel="alternate" hreflang="de" href="https://subsumio.de/">
    <link rel="alternate" hreflang="fr" href="https://subsumio.fr/">
    <link rel="alternate" hreflang="es" href="https://subsumio.es/">
</head>
<body>
    <header>
        <nav>
            <div class="logo">Subsumio</div>
            <div class="nav-links">
                <a href="#features">Funktionen</a>
                <a href="#pricing">Preise</a>
                <a href="#contact">Kontakt</a>
                <button class="cta-primary">${page.content.hero.cta}</button>
            </div>
        </nav>
    </header>

    <main>
        <section class="hero">
            <div class="hero-content">
                <h1>${page.content.hero.headline}</h1>
                <p>${page.content.hero.subheadline}</p>
                <button class="cta-primary">${page.content.hero.cta}</button>
                <div class="trust-badges">
                    ${page.content.hero.trustBadges.map(badge => `<span class="badge">${badge}</span>`).join('')}
                </div>
            </div>
        </section>

        <section id="features" class="features">
            <h2>${page.content.features.title}</h2>
            <div class="features-grid">
                ${page.content.features.items
                  .map(
                    item => `
                    <div class="feature-card">
                        <div class="icon">${item.icon}</div>
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </section>

        <section class="benefits">
            <h2>${page.content.benefits.title}</h2>
            <div class="benefits-grid">
                ${page.content.benefits.items
                  .map(
                    item => `
                    <div class="benefit-card">
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                        <div class="metric">${item.metric}</div>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </section>

        <section class="compliance">
            <h2>${page.content.compliance.title}</h2>
            <div class="compliance-grid">
                ${page.content.compliance.items
                  .map(
                    item => `
                    <div class="compliance-card">
                        <div class="logo">${item.logo}</div>
                        <h3>${item.name}</h3>
                        <p>${item.description}</p>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </section>

        <section id="pricing" class="pricing">
            <h2>${page.content.pricing.title}</h2>
            <div class="pricing-grid">
                ${page.content.pricing.plans
                  .map(
                    plan => `
                    <div class="pricing-card">
                        <h3>${plan.name}</h3>
                        <div class="price">${plan.price}</div>
                        <ul>
                            ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                        <button class="cta-primary">${plan.cta}</button>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </section>

        <section class="testimonials">
            <h2>${page.content.testimonials.title}</h2>
            <div class="testimonials-grid">
                ${page.content.testimonials.items
                  .map(
                    item => `
                    <div class="testimonial-card">
                        <div class="rating">${'★'.repeat(item.rating)}</div>
                        <p>"${item.content}"</p>
                        <div class="author">
                            <strong>${item.name}</strong>
                            <span>${item.role}, ${item.company}</span>
                        </div>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </section>

        <section class="cta">
            <h2>${page.content.cta.title}</h2>
            <p>${page.content.cta.description}</p>
            <div class="cta-buttons">
                <button class="cta-primary">${page.content.cta.primary}</button>
                <button class="cta-secondary">${page.content.cta.secondary}</button>
            </div>
        </section>
    </main>

    <footer>
        <div class="footer-content">
            <div class="footer-section">
                <h4>Subsumio</h4>
                <p>Kanzleisoftware für ${page.market}</p>
            </div>
            <div class="footer-section">
                <h4>Produkt</h4>
                <ul>
                    <li><a href="#features">Funktionen</a></li>
                    <li><a href="#pricing">Preise</a></li>
                    <li><a href="#security">Sicherheit</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h4>Unternehmen</h4>
                <ul>
                    <li><a href="/about">Über uns</a></li>
                    <li><a href="/contact">Kontakt</a></li>
                    <li><a href="/impressum">Impressum</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h4>Rechtliches</h4>
                <ul>
                    <li><a href="/privacy">Datenschutz</a></li>
                    <li><a href="/terms">AGB</a></li>
                    <li><a href="/compliance">Compliance</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2025 Subsumio GmbH. Alle Rechte vorbehalten.</p>
        </div>
    </footer>
</body>
</html>`;
}

export default {
  EUMarketingPages,
  generateMarketingPage,
};
