export type ChatbotLang =
  | 'de'
  | 'en'
  | 'fr'
  | 'es'
  | 'it'
  | 'pl'
  | 'pt'
  | 'ja'
  | 'ko'
  | 'ar';

export function detectChatbotLang(pathname: string): ChatbotLang {
  const segment = (
    pathname.split('/').filter(Boolean)[0] ?? 'en'
  ).toLowerCase();
  if (segment.startsWith('de')) return 'de';
  if (segment.startsWith('fr')) return 'fr';
  if (segment.startsWith('es')) return 'es';
  if (segment.startsWith('it')) return 'it';
  if (segment.startsWith('pl')) return 'pl';
  if (segment.startsWith('pt')) return 'pt';
  if (segment.startsWith('ja')) return 'ja';
  if (segment.startsWith('ko')) return 'ko';
  if (segment.startsWith('ar')) return 'ar';
  return 'en';
}

export function isRtlLang(lang: ChatbotLang): boolean {
  return lang === 'ar';
}

export interface ChatbotStrings {
  botName: string;
  status: string;
  open: string;
  close: string;
  placeholder: string;
  send: string;
  poweredBy: string;
  typing: string;
  showMore: string;
  showLess: string;

  welcome: string;
  welcomeReturning: string;
  welcomePage: string;
  welcomeReturningPage: string;
  socialProof: string;

  roleVisitor: string;
  roleLawyer: string;
  roleJurist: string;
  roleConfirm: string;
  roleConfirmLawyer: string;
  roleConfirmJurist: string;
  roleConfirmVisitor: string;

  contextActive: string;
  pageLabels: Record<string, string>;

  nudges: Record<string, string>;

  actionContextHelp: string;
  actionDemo: string;
  actionPricing: string;
  actionFreeTrial: string;
  actionSubscribe: string;
  actionCredits: string;
  actionSupport: string;
  actionApi: string;

  intentContextHelp: Record<string, string>;
  intentDemo: string;
  intentPricing: string;
  intentRegister: string;
  intentSubscribe: string;
  intentCredits: string;
  intentApi: string;
  intentSupport: string;
  intentFallback: string;

  btnRequestDemo: string;
  btnReviewPricing: string;
  btnRegisterFree: string;
  btnOpenSubAssistant: string;
  btnAnnualBestValue: string;
  btnCredits500: string;
  btnCredits2000: string;
  btnApiQuickstart: string;
  btnSwaggerDocs: string;
  btnGraphql: string;
  btnContactSupport: string;
  btnGoPricing: string;
  btnToCheckout: string;
  btnStartSubAssistant: string;

  regComplete: string;
  subComplete: string;

  footerHint: string;

  regWelcomeTitle: string;
  regWelcomeSub: string;
  regPersonalTitle: string;
  regPersonalSub: string;
  regCompanyTitle: string;
  regCompanySub: string;
  regUseCaseTitle: string;
  regUseCaseSub: string;
  regEmail: string;
  regFirstName: string;
  regLastName: string;
  regCompany: string;
  regTrialBadge: string;
  regSkip: string;
  regNext: string;
  regStart: string;
  regStep: string;
  regFeatures: string[];
  regUseCases: string[];

  subTitle: string;
  subSubtitle: string;
  subMonthly: string;
  subAnnual: string;
  subSave: string;
  subPopular: string;
  subCustom: string;
  subPerMonth: string;
  subStarterName: string;
  subProName: string;
  subEnterpriseName: string;
  subStarterCta: string;
  subProCta: string;
  subEnterpriseCta: string;
  subStarterFeatures: string[];
  subProFeatures: string[];
  subEnterpriseFeatures: string[];
  subTrustRefund: string;
  subTrustInstant: string;
  subTrustFirms: string;
  subDecideLater: string;
  subStartNow: string;
  subContactUs: string;
}

const de: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'Online — antworte sofort',
  open: 'Chat starten',
  close: 'Chat schließen',
  placeholder: 'Schreib mir...',
  send: 'Senden',
  poweredBy: 'Subsumio AI',
  typing: 'tippt...',
  showMore: 'Mehr Optionen',
  showLess: 'Weniger',

  welcome:
    'Hey! 👋 Ich bin dein Subsumio Copilot. Sag mir kurz, wer du bist — dann zeig ich dir den besten nächsten Schritt.',
  welcomeReturning:
    'Hey, schön dich wiederzusehen! 👋 Was kann ich für dich tun?',
  welcomePage:
    'Hey! 👋 Du bist gerade auf der Seite „{page}“. Sag mir kurz, wer du bist — ich zeig dir den schnellsten Weg.',
  welcomeReturningPage:
    'Willkommen zurück! 👋 Du schaust dir gerade „{page}“ an. Wie kann ich helfen?',
  socialProof: '500+ Kanzleien nutzen Subsumio',

  roleVisitor: '👀 Ich schau mich um',
  roleLawyer: '⚖️ Anwält:in',
  roleJurist: '📚 Jurist:in / Steuerberater:in',
  roleConfirm: 'Top! Ich passe alles an deine Rolle an.',
  roleConfirmLawyer:
    'Perfekt — als Anwält:in zeig ich dir direkt die relevantesten Workflows und wie du sofort produktiv wirst. 🚀',
  roleConfirmJurist:
    'Super — für Jurist:innen habe ich spezielle Tipps zu Recherche, Analyse und Compliance parat. 📊',
  roleConfirmVisitor:
    'Cool! Ich zeig dir in 60 Sekunden, warum 500+ Kanzleien Subsumio nutzen. 👍',

  contextActive: 'Kontext',
  pageLabels: {
    home: 'Startseite',
    pricing: 'Preise & Pakete',
    features: 'Funktionen',
    tax: 'Steuer & Compliance',
    security: 'Sicherheit & Datenschutz',
    contact: 'Kontakt',
    systems: 'Plattform & Systeme',
    api: 'API & Entwickler',
    about: 'Über uns',
    docs: 'Dokumentation',
    'semantic-database': 'Semantische Datenbank',
    'quick-check': 'Quick-Check',
    legal: 'Rechtliches',
  },

  nudges: {
    home: '🚀 In 60 Sek. zum passenden Plan?',
    pricing: '💳 Welcher Plan passt zu dir?',
    features: '✨ Welches Feature brauchst du zuerst?',
    tax: '📈 Steuer-Workflows automatisieren?',
    security: '🔒 Fragen zu Datenschutz & Hosting?',
    contact: '📩 Wir antworten sofort!',
    systems: '🔌 Integration in 5 Minuten?',
    api: '🛠️ API-Quickstart in 2 Minuten?',
    default: '👋 Wie kann ich dir helfen?',
  },

  actionContextHelp: '🧭 Was empfiehlst du hier?',
  actionDemo: '🎬 Live-Demo buchen',
  actionPricing: '💳 Preise vergleichen',
  actionFreeTrial: '✨ Kostenlos testen',
  actionSubscribe: '🚀 Abo starten',
  actionCredits: '⚡ Credits kaufen',
  actionSupport: '🛠️ Support kontaktieren',
  actionApi: '🔌 API-Docs öffnen',

  intentContextHelp: {
    home: 'Mein Tipp: Starte mit dem 14-Tage-Trial — du kannst sofort mit echten Dokumenten arbeiten. Null Risiko. 🙌',
    pricing:
      'Du bist auf der Preisseite — ich help dir, den Plan zu finden, der zu deiner Kanzleigröße passt.',
    features:
      'Hier sind alle Funktionen. Welchen Bereich soll ich für dich priorisieren?',
    tax: 'Für Steuer-Workflows zeig ich dir den schnellsten Weg zur Automatisierung.',
    security:
      'Zu Sicherheit und Datenschutz beantworte ich alles — DSGVO, Hosting, Verschlüsselung.',
    contact:
      'Ich verbinde dich sofort mit dem richtigen Team: Sales, Support oder Enterprise.',
    systems:
      'Hier geht’s um Integrationen. Ich führ dich durch Setup, Workflows und API.',
    api: 'Für die API: Token erstellen, Endpunkte testen, Webhooks einrichten — ich zeig dir wie.',
    about: 'Hier erfährst du mehr über unser Team. Hast du eine Frage?',
    docs: 'In der Doku findest du Anleitungen und Referenzen. Wonach suchst du?',
    'quick-check':
      'Der Quick-Check zeigt dir in Minuten, ob Subsumio zu deinem Workflow passt.',
    'semantic-database':
      'Unsere semantische Datenbank ist das Herzstück der KI-Analyse. Willst du mehr wissen?',
  },
  intentDemo:
    'Nice! In einer 20-min Live-Demo zeigen wir den kompletten Workflow: Akten, Recherche, Fristen — alles End-to-End. 🎬',
  intentPricing:
    'Unsere Pläne sind auf Kanzlei-Reifegrade zugeschnitten: Solo, Kanzlei, Team, Enterprise. Wie groß ist dein Team?',
  intentRegister:
    'Starte jetzt deinen 14-Tage-Trial — keine Kreditkarte nötig, voller Funktionsumfang. ✨',
  intentSubscribe:
    'Empfohlener Weg: Trial starten → Team einladen → Abo aktivieren. Easy!',
  intentCredits:
    'Credits sind perfekt für Analyse-Spitzen. Wähl direkt ein Paket:',
  intentApi:
    'Für die API: Discovery via /meta, Bearer-Auth, paginierte Endpunkte. Hier die wichtigsten Links:',
  intentSupport:
    'Beschreib kurz dein Anliegen — ich leite dich sofort ans richtige Team weiter.',
  intentFallback:
    'Danke für deine Frage! Soll ich dir den schnellsten Lösungsweg zeigen? 🚀',

  btnRequestDemo: '🎬 Demo vereinbaren',
  btnReviewPricing: '💳 Preise ansehen',
  btnRegisterFree: '✨ Kostenlos registrieren',
  btnOpenSubAssistant: '🚀 Abo-Assistent öffnen',
  btnAnnualBestValue: '🏆 Jahresabo (20% sparen)',
  btnCredits500: '⚡ 500 Credits',
  btnCredits2000: '🔥 2.000 Credits',
  btnApiQuickstart: '📚 API-Quickstart',
  btnSwaggerDocs: '🧩 Swagger Docs',
  btnGraphql: '🛰️ GraphQL Endpoint',
  btnContactSupport: '🛠️ Support kontaktieren',
  btnGoPricing: '💳 Zur Preisübersicht',
  btnToCheckout: '🔒 Zum sicheren Checkout',
  btnStartSubAssistant: '🚀 Abo-Assistent starten',

  regComplete:
    'Dein Trial ist ready! 🎉 Soll ich dir direkt das passende Abo vorschlagen?',
  subComplete:
    'Alles vorbereitet! Ich leite dich jetzt zum sicheren Checkout. 🔒',

  footerHint: 'Registrierung & Abo direkt hier',

  regWelcomeTitle: 'Willkommen bei Subsumio! 👋',
  regWelcomeSub: '14 Tage free — voller Funktionsumfang',
  regPersonalTitle: 'Deine Daten',
  regPersonalSub: 'Damit wir dich optimal beraten können',
  regCompanyTitle: 'Deine Kanzlei',
  regCompanySub: 'Für ein maßgeschneidertes Erlebnis',
  regUseCaseTitle: 'Fast geschafft! 🎉',
  regUseCaseSub: 'Was willst du zuerst nutzen?',
  regEmail: 'E-Mail-Adresse',
  regFirstName: 'Vorname',
  regLastName: 'Nachname',
  regCompany: 'Kanzlei / Unternehmen',
  regTrialBadge: '🎉 14 Tage free — keine Kreditkarte nötig',
  regSkip: 'Überspringen',
  regNext: 'Weiter',
  regStart: 'Kostenlos starten',
  regStep: 'Schritt',
  regFeatures: [
    'KI-Dokumentenanalyse',
    'Automatische Fristen',
    'Sichere Cloud-Speicherung',
    'Team-Zusammenarbeit',
  ],
  regUseCases: [
    'Dokumentenanalyse & Recherche',
    'Fristen & Kalender',
    'Fallstrategie & Zusammenarbeit',
    'Mandantenverwaltung',
    'Anderes',
  ],

  subTitle: 'Wählen Sie Ihren Plan',
  subSubtitle: 'Entfalten Sie das volle Potenzial Ihrer Kanzlei',
  subMonthly: 'Monatlich',
  subAnnual: 'Jährlich',
  subSave: '20% sparen',
  subPopular: 'Beliebteste Wahl',
  subCustom: 'Individuell',
  subPerMonth: '/Monat',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'Kostenlos starten',
  subProCta: '14 Tage testen',
  subEnterpriseCta: 'Kontakt aufnehmen',
  subStarterFeatures: [
    'Bis zu 3 Nutzer',
    '100 Dokumente/Monat',
    'KI-Analyse',
    'E-Mail-Support',
  ],
  subProFeatures: [
    'Bis zu 10 Nutzer',
    'Unbegrenzte Dokumente',
    'Erweiterte KI',
    'Fristenverwaltung',
    'Prioritäts-Support',
    'API-Zugriff',
  ],
  subEnterpriseFeatures: [
    'Unbegrenzte Nutzer',
    'Alle Funktionen',
    'Dedizierter Manager',
    'Custom Integrationen',
    'On-Premise Option',
    'SLA-Garantie',
  ],
  subTrustRefund: '14 Tage Geld-zurück',
  subTrustInstant: 'Sofort aktiv',
  subTrustFirms: '500+ Kanzleien',
  subDecideLater: 'Später entscheiden',
  subStartNow: 'Jetzt starten',
  subContactUs: 'Kontakt aufnehmen',
};

const en: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'Online — instant help',
  open: 'Start chat',
  close: 'Close chat',
  placeholder: 'Your question...',
  send: 'Send',
  poweredBy: 'Subsumio AI',
  typing: 'typing...',
  showMore: 'More options',
  showLess: 'Show less',

  welcome:
    "Hey! \uD83D\uDC4B I'm your Subsumio Copilot. Tell me who you are and I'll show you the best next step.",
  welcomeReturning:
    'Hey, welcome back! \uD83D\uDC4B What can I do for you today?',
  welcomePage:
    'Hey! \uD83D\uDC4B You\'re on the \"{page}\" page. Tell me who you are — I\'ll find the fastest path for you.',
  welcomeReturningPage:
    'Welcome back! \uD83D\uDC4B You\'re checking out \"{page}\". How can I help?',
  socialProof: '500+ law firms trust Subsumio',

  roleVisitor: '\uD83D\uDC40 Just browsing',
  roleLawyer: '\u2696\uFE0F Lawyer',
  roleJurist: '\uD83D\uDCDA Jurist / Tax advisor',
  roleConfirm: "Great! I'll tailor my recommendations to your role now.",
  roleConfirmLawyer:
    "Perfect — as a lawyer, I'll show you the most relevant workflows and how to get productive right away. \uD83D\uDE80",
  roleConfirmJurist:
    'Awesome — for jurists, I have specialized tips on research, analysis, and compliance. \uD83D\uDCCA',
  roleConfirmVisitor:
    'Cool! Let me show you in 60 seconds why 500+ law firms use Subsumio. \uD83D\uDC4D',

  contextActive: 'Context',
  pageLabels: {
    home: 'Homepage',
    pricing: 'Pricing & Plans',
    features: 'Features',
    tax: 'Tax & Compliance',
    security: 'Security & Privacy',
    contact: 'Contact',
    systems: 'Platform & Systems',
    api: 'API & Developers',
    about: 'About Us',
    docs: 'Documentation',
    'semantic-database': 'Semantic Database',
    'quick-check': 'Quick Check',
    legal: 'Legal',
  },

  nudges: {
    home: 'Find your ideal plan in 60 sec?',
    pricing: 'Which plan fits your firm?',
    features: 'Which feature do you need first?',
    tax: 'Automate your tax workflows?',
    security: 'Questions about privacy & hosting?',
    contact: 'We reply instantly!',
    systems: 'Set up in 5 minutes?',
    api: 'API quickstart in 2 min?',
    default: 'How can I help you?',
  },

  actionContextHelp: 'What do you recommend here?',
  actionDemo: 'Book a live demo',
  actionPricing: 'Compare plans',
  actionFreeTrial: 'Start free trial',
  actionSubscribe: 'Start subscription',
  actionCredits: 'Buy credits',
  actionSupport: 'Contact support',
  actionApi: 'Open API docs',

  intentContextHelp: {
    home: 'I recommend starting with a free 14-day trial — work with real documents right away, no risk.',
    pricing:
      "You're on the pricing page. I'll help you find the plan that fits your firm size.",
    features: 'Here are all features. Which area should I prioritize for you?',
    tax: "For tax workflows, I'll show you the fastest path to automation.",
    security:
      'I can answer all security and privacy questions — GDPR, hosting, encryption.',
    contact:
      "I'll connect you with the right team: sales, support, or enterprise.",
    systems:
      "This is about integrations. I'll guide you through setup, workflows, and API.",
    api: "For API integration: create tokens, test endpoints, set up webhooks — I'll walk you through it.",
    about: 'Learn more about our team and mission. Any questions?',
    docs: 'The documentation has guides and references. What are you looking for?',
    'quick-check':
      'The Quick Check shows in minutes whether Subsumio fits your workflow.',
    'semantic-database':
      'Our semantic database powers the AI analysis. Want to learn more?',
  },
  intentDemo:
    'Great choice! In a 20-minute live demo we show the full workflow: cases, research, deadlines — end-to-end.',
  intentPricing:
    "Our plans match law-firm maturity levels: Solo, Kanzlei, Team, Enterprise. What's your team size?",
  intentRegister:
    'Start your free 14-day trial now — no credit card required, full feature access.',
  intentSubscribe:
    'Recommended path: start trial, invite your team, then activate the right subscription.',
  intentCredits:
    'Credits are perfect for analysis spikes. Choose a package directly:',
  intentApi:
    'For API integration: discovery via /meta, bearer auth, write endpoints (POST/PATCH/DELETE), webhooks under /workspaces/:id/webhooks, and Idempotency-Key for safe retries. Here are the key links:',
  intentSupport:
    "Briefly describe your issue — I'll route you to the right team immediately.",
  intentFallback:
    'Thanks for your question! Shall I suggest the fastest path forward?',

  btnRequestDemo: 'Request demo',
  btnReviewPricing: 'View pricing',
  btnRegisterFree: 'Register free',
  btnOpenSubAssistant: 'Open subscription assistant',
  btnAnnualBestValue: 'Annual plan (save 20%)',
  btnCredits500: '500 Credits',
  btnCredits2000: '2,000 Credits',
  btnApiQuickstart: 'API Quickstart',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'Contact support',
  btnGoPricing: 'Go to pricing',
  btnToCheckout: 'Go to secure checkout',
  btnStartSubAssistant: 'Start subscription assistant',

  regComplete:
    'Your trial is ready! Shall I suggest the best subscription for you?',
  subComplete:
    "All set! I'll route you to the secure checkout to complete your subscription.",

  footerHint: 'Sign up & subscribe directly here',

  regWelcomeTitle: 'Welcome to Subsumio!',
  regWelcomeSub: '14-day free trial — full feature access',
  regPersonalTitle: 'Your details',
  regPersonalSub: 'So we can serve you best',
  regCompanyTitle: 'Your firm',
  regCompanySub: 'For a tailored experience',
  regUseCaseTitle: 'Almost done!',
  regUseCaseSub: 'What would you like to use first?',
  regEmail: 'Email address',
  regFirstName: 'First name',
  regLastName: 'Last name',
  regCompany: 'Firm / Company',
  regTrialBadge: '14-day free trial — no credit card required',
  regSkip: 'Skip',
  regNext: 'Continue',
  regStart: 'Start for free',
  regStep: 'Step',
  regFeatures: [
    'AI document analysis',
    'Automatic deadlines',
    'Secure cloud storage',
    'Team collaboration',
  ],
  regUseCases: [
    'Document analysis & research',
    'Deadlines & calendar',
    'Case strategy & collaboration',
    'Client management',
    'Other',
  ],

  subTitle: 'Choose your plan',
  subSubtitle: 'Unlock the full potential of your firm',
  subMonthly: 'Monthly',
  subAnnual: 'Annual',
  subSave: 'Save 20%',
  subPopular: 'Most popular',
  subCustom: 'Custom',
  subPerMonth: '/month',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'Start free',
  subProCta: '14-day trial',
  subEnterpriseCta: 'Contact us',
  subStarterFeatures: [
    'Up to 3 users',
    '100 docs/month',
    'AI analysis',
    'Email support',
  ],
  subProFeatures: [
    'Up to 10 users',
    'Unlimited docs',
    'Advanced AI',
    'Deadline management',
    'Priority support',
    'API access',
  ],
  subEnterpriseFeatures: [
    'Unlimited users',
    'All features',
    'Dedicated manager',
    'Custom integrations',
    'On-premise option',
    'SLA guarantee',
  ],
  subTrustRefund: '14-day money-back',
  subTrustInstant: 'Instant activation',
  subTrustFirms: '500+ law firms',
  subDecideLater: 'Decide later',
  subStartNow: 'Start now',
  subContactUs: 'Contact us',
};

const fr: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'En ligne — aide immédiate',
  open: 'Ouvrir le chat',
  close: 'Fermer le chat',
  placeholder: 'Votre question...',
  send: 'Envoyer',
  poweredBy: 'Subsumio AI',
  typing: 'écrit...',
  showMore: "Plus d'options",
  showLess: "Moins d'options",

  welcome:
    'Bonjour ! 👋 Je suis votre Subsumio Copilot. Dites-moi qui vous êtes et je vous guide.',
  welcomeReturning: 'Rebonjour ! 👋 Comment puis-je vous aider ?',
  welcomePage:
    'Bonjour ! 👋 Vous êtes sur « {page} ». Dites-moi qui vous êtes — je trouve le chemin le plus rapide.',
  welcomeReturningPage:
    'Bon retour ! 👋 Vous consultez « {page} ». Comment puis-je aider ?',
  socialProof: '500+ cabinets font confiance à Subsumio',

  roleVisitor: '👀 Visiteur',
  roleLawyer: '⚖️ Avocat(e)',
  roleJurist: '📚 Juriste / Fiscaliste',
  roleConfirm: "Parfait ! J'adapte mes recommandations à votre profil.",
  roleConfirmLawyer:
    "Parfait — en tant qu'avocat(e), je vous montre les workflows les plus pertinents. 🚀",
  roleConfirmJurist:
    "Super — pour les juristes, j'ai des conseils spécialisés en recherche et conformité. 📊",
  roleConfirmVisitor:
    'Cool ! Je vous montre en 60 secondes pourquoi 500+ cabinets utilisent Subsumio. 👍',

  contextActive: 'Contexte',
  pageLabels: {
    home: 'Accueil',
    pricing: 'Tarifs & Formules',
    features: 'Fonctionnalités',
    tax: 'Fiscalité & Conformité',
    security: 'Sécurité & Confidentialité',
    contact: 'Contact',
    systems: 'Plateforme & Systèmes',
    api: 'API & Développeurs',
    about: 'À propos',
    docs: 'Documentation',
    'semantic-database': 'Base sémantique',
    'quick-check': 'Quick Check',
    legal: 'Mentions légales',
  },

  nudges: {
    home: 'Trouvez votre plan en 60 sec ?',
    pricing: 'Quel plan pour votre cabinet ?',
    features: "Quelle fonctionnalité d'abord ?",
    tax: 'Automatiser vos flux fiscaux ?',
    security: 'Questions sur la sécurité ?',
    contact: 'Nous répondons instantanément !',
    systems: 'Configuration en 5 minutes ?',
    api: 'API quickstart en 2 min ?',
    default: 'Comment puis-je vous aider ?',
  },

  actionContextHelp: 'Que recommandez-vous ici ?',
  actionDemo: 'Réserver une démo',
  actionPricing: 'Comparer les plans',
  actionFreeTrial: 'Essai gratuit',
  actionSubscribe: "S'abonner",
  actionCredits: 'Acheter des crédits',
  actionSupport: 'Contacter le support',
  actionApi: 'Ouvrir les docs API',

  intentContextHelp: {
    home: "Je recommande l'essai gratuit de 14 jours — travaillez avec vos vrais documents, sans risque.",
    pricing:
      'Vous êtes sur la page tarifs. Je vous aide à trouver la formule adaptée à votre cabinet.',
    features:
      'Voici toutes les fonctionnalités. Quel domaine dois-je prioriser pour vous ?',
    tax: "Pour les flux fiscaux, je vous montre le chemin le plus rapide vers l'automatisation.",
    security:
      'Je réponds à toutes vos questions sécurité — RGPD, hébergement, chiffrement.',
    contact:
      'Je vous connecte immédiatement à la bonne équipe : ventes, support ou entreprise.',
    systems:
      "Intégrations : je vous guide à travers la configuration, les workflows et l'API.",
    api: "Pour l'intégration API : création de tokens, test des endpoints, webhooks — je vous accompagne.",
    about: 'Découvrez notre équipe et notre mission. Des questions ?',
    docs: 'La documentation contient guides et références. Que cherchez-vous ?',
    'quick-check':
      'Le Quick Check montre en quelques minutes si Subsumio convient à votre workflow.',
    'semantic-database':
      "Notre base sémantique alimente l'analyse IA. Envie d'en savoir plus ?",
  },
  intentDemo:
    'Excellent choix ! En 20 minutes de démo live, nous montrons le workflow complet : dossiers, recherche, délais — de bout en bout.',
  intentPricing:
    "Nos formules correspondent aux niveaux de maturité : Solo, Kanzlei, Team, Enterprise. Quelle taille d'équipe ?",
  intentRegister:
    'Démarrez votre essai gratuit de 14 jours — sans carte bancaire, accès complet.',
  intentSubscribe:
    "Chemin recommandé : essai gratuit → inviter l'équipe → activer l'abonnement adapté.",
  intentCredits:
    "Les crédits sont parfaits pour les pics d'analyse. Choisissez un pack :",
  intentApi:
    "Pour l'API : discovery via /meta, auth bearer, endpoints paginés. Voici les liens essentiels :",
  intentSupport:
    'Décrivez brièvement votre problème — je vous redirige instantanément.',
  intentFallback:
    'Merci pour votre question ! Dois-je vous proposer la solution la plus rapide ?',

  btnRequestDemo: 'Demander une démo',
  btnReviewPricing: 'Voir les tarifs',
  btnRegisterFree: "S'inscrire gratuitement",
  btnOpenSubAssistant: "Ouvrir l'assistant abonnement",
  btnAnnualBestValue: 'Annuel (économisez 20%)',
  btnCredits500: '500 Crédits',
  btnCredits2000: '2 000 Crédits',
  btnApiQuickstart: 'API Quickstart',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'Contacter le support',
  btnGoPricing: 'Voir les tarifs',
  btnToCheckout: 'Aller au paiement sécurisé',
  btnStartSubAssistant: "Démarrer l'assistant",

  regComplete:
    'Votre essai est prêt ! Dois-je suggérer le meilleur abonnement ?',
  subComplete: 'Tout est prêt ! Je vous dirige vers le paiement sécurisé.',

  footerHint: 'Inscription et abonnement directement ici',

  regWelcomeTitle: 'Bienvenue chez Subsumio !',
  regWelcomeSub: '14 jours gratuits — accès complet',
  regPersonalTitle: 'Vos informations',
  regPersonalSub: 'Pour mieux vous accompagner',
  regCompanyTitle: 'Votre cabinet',
  regCompanySub: 'Pour une expérience sur mesure',
  regUseCaseTitle: 'Presque terminé !',
  regUseCaseSub: 'Que souhaitez-vous utiliser en premier ?',
  regEmail: 'Adresse e-mail',
  regFirstName: 'Prénom',
  regLastName: 'Nom',
  regCompany: 'Cabinet / Entreprise',
  regTrialBadge: '14 jours gratuits — sans carte bancaire',
  regSkip: 'Passer',
  regNext: 'Continuer',
  regStart: 'Démarrer gratuitement',
  regStep: 'Étape',
  regFeatures: [
    'Analyse IA de documents',
    'Gestion automatique des délais',
    'Stockage cloud sécurisé',
    "Collaboration d'équipe",
  ],
  regUseCases: [
    'Analyse documentaire & recherche',
    'Délais & calendrier',
    'Stratégie de cas & collaboration',
    'Gestion des clients',
    'Autre',
  ],

  subTitle: 'Choisissez votre formule',
  subSubtitle: 'Libérez le plein potentiel de votre cabinet',
  subMonthly: 'Mensuel',
  subAnnual: 'Annuel',
  subSave: 'Économisez 20%',
  subPopular: 'Le plus populaire',
  subCustom: 'Sur mesure',
  subPerMonth: '/mois',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'Démarrer gratuit',
  subProCta: 'Essai 14 jours',
  subEnterpriseCta: 'Nous contacter',
  subStarterFeatures: [
    "Jusqu'à 3 utilisateurs",
    '100 docs/mois',
    'Analyse IA',
    'Support e-mail',
  ],
  subProFeatures: [
    "Jusqu'à 10 utilisateurs",
    'Documents illimités',
    'IA avancée',
    'Gestion des délais',
    'Support prioritaire',
    'Accès API',
  ],
  subEnterpriseFeatures: [
    'Utilisateurs illimités',
    'Toutes fonctionnalités',
    'Manager dédié',
    'Intégrations sur mesure',
    'Option on-premise',
    'Garantie SLA',
  ],
  subTrustRefund: '14 jours satisfait ou remboursé',
  subTrustInstant: 'Activation immédiate',
  subTrustFirms: '500+ cabinets',
  subDecideLater: 'Décider plus tard',
  subStartNow: 'Commencer maintenant',
  subContactUs: 'Nous contacter',
};

const es: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'En línea — ayuda inmediata',
  open: 'Abrir chat',
  close: 'Cerrar chat',
  placeholder: 'Su pregunta...',
  send: 'Enviar',
  poweredBy: 'Subsumio AI',
  typing: 'escribiendo...',
  showMore: 'Más opciones',
  showLess: 'Menos opciones',

  welcome:
    '¡Hola! 👋 Soy tu Subsumio Copilot. Dime quién eres y te muestro el mejor siguiente paso.',
  welcomeReturning: '¡Hola de nuevo! 👋 ¿En qué puedo ayudarte hoy?',
  welcomePage:
    '¡Hola! 👋 Estás en «{page}». Dime quién eres — te encuentro el camino más rápido.',
  welcomeReturningPage:
    '¡Bienvenido/a de vuelta! 👋 Estás viendo «{page}». ¿Cómo puedo ayudar?',
  socialProof: '500+ despachos confían en Subsumio',

  roleVisitor: '👀 Visitante',
  roleLawyer: '⚖️ Abogado/a',
  roleJurist: '📚 Jurista / Asesor fiscal',
  roleConfirm: '¡Perfecto! Adapto mis recomendaciones a tu perfil.',
  roleConfirmLawyer:
    'Perfecto — como abogado/a, te muestro los workflows más relevantes. 🚀',
  roleConfirmJurist:
    'Genial — para juristas tengo consejos especializados en investigación y compliance. 📊',
  roleConfirmVisitor:
    '¡Cool! Te muestro en 60 segundos por qué 500+ despachos usan Subsumio. 👍',

  contextActive: 'Contexto',
  pageLabels: {
    home: 'Inicio',
    pricing: 'Precios y Planes',
    features: 'Funciones',
    tax: 'Fiscal y Cumplimiento',
    security: 'Seguridad y Privacidad',
    contact: 'Contacto',
    systems: 'Plataforma y Sistemas',
    api: 'API y Desarrolladores',
    about: 'Sobre nosotros',
    docs: 'Documentación',
    'semantic-database': 'Base semántica',
    'quick-check': 'Quick Check',
    legal: 'Legal',
  },

  nudges: {
    home: '¿Encuentra su plan en 60 seg?',
    pricing: '¿Qué plan se adapta a usted?',
    features: '¿Qué función necesita primero?',
    tax: '¿Automatizar flujos fiscales?',
    security: '¿Preguntas sobre privacidad?',
    contact: '¡Respondemos al instante!',
    systems: '¿Configuración en 5 min?',
    api: '¿API quickstart en 2 min?',
    default: '¿En qué puedo ayudarle?',
  },

  actionContextHelp: '¿Qué recomienda aquí?',
  actionDemo: 'Reservar demo en vivo',
  actionPricing: 'Comparar planes',
  actionFreeTrial: 'Prueba gratuita',
  actionSubscribe: 'Iniciar suscripción',
  actionCredits: 'Comprar créditos',
  actionSupport: 'Contactar soporte',
  actionApi: 'Abrir docs API',

  intentContextHelp: {
    home: 'Le recomiendo la prueba gratuita de 14 días — trabaje con documentos reales, sin riesgo.',
    pricing:
      'Está en la página de precios. Le ayudo a encontrar el plan perfecto para su despacho.',
    features: 'Aquí están todas las funciones. ¿Qué área debo priorizar?',
    tax: 'Para flujos fiscales, le muestro el camino más rápido a la automatización.',
    security:
      'Respondo todas sus preguntas de seguridad — RGPD, hosting, cifrado.',
    contact: 'Le conecto inmediatamente con el equipo adecuado.',
    systems: 'Integraciones: le guío en configuración, workflows y API.',
    api: 'Integración API: tokens, endpoints, webhooks — le acompaño paso a paso.',
    about: 'Conozca nuestro equipo y misión. ¿Alguna pregunta?',
    docs: 'La documentación tiene guías y referencias. ¿Qué busca?',
    'quick-check':
      'El Quick Check muestra en minutos si Subsumio encaja en su workflow.',
    'semantic-database':
      'Nuestra base semántica potencia el análisis IA. ¿Quiere saber más?',
  },
  intentDemo:
    '¡Gran elección! En 20 minutos de demo mostramos el flujo completo: casos, investigación, plazos — de principio a fin.',
  intentPricing:
    'Nuestros planes se adaptan a la madurez del despacho: Solo, Kanzlei, Team, Enterprise. ¿Cuál es el tamaño de su equipo?',
  intentRegister:
    'Inicie su prueba gratuita de 14 días — sin tarjeta, acceso completo.',
  intentSubscribe:
    'Ruta recomendada: prueba gratuita → invitar equipo → activar suscripción.',
  intentCredits:
    'Los créditos son perfectos para picos de análisis. Elija un paquete:',
  intentApi:
    'API: discovery via /meta, auth bearer, endpoints paginados. Aquí los enlaces clave:',
  intentSupport:
    'Describa brevemente su problema — le dirijo al equipo correcto al instante.',
  intentFallback: '¡Gracias por su pregunta! ¿Le sugiero el camino más rápido?',

  btnRequestDemo: 'Solicitar demo',
  btnReviewPricing: 'Ver precios',
  btnRegisterFree: 'Registrarse gratis',
  btnOpenSubAssistant: 'Abrir asistente de suscripción',
  btnAnnualBestValue: 'Anual (ahorre 20%)',
  btnCredits500: '500 Créditos',
  btnCredits2000: '2.000 Créditos',
  btnApiQuickstart: 'API Quickstart',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'Contactar soporte',
  btnGoPricing: 'Ir a precios',
  btnToCheckout: 'Ir al pago seguro',
  btnStartSubAssistant: 'Iniciar asistente',

  regComplete: '¡Su prueba está lista! ¿Le sugiero la mejor suscripción?',
  subComplete: '¡Todo listo! Le dirijo al pago seguro para completar.',

  footerHint: 'Registro y suscripción directamente aquí',

  regWelcomeTitle: '¡Bienvenido/a a Subsumio!',
  regWelcomeSub: '14 días gratis — acceso completo',
  regPersonalTitle: 'Sus datos',
  regPersonalSub: 'Para asesorarle mejor',
  regCompanyTitle: 'Su despacho',
  regCompanySub: 'Para una experiencia personalizada',
  regUseCaseTitle: '¡Casi listo!',
  regUseCaseSub: '¿Qué le gustaría usar primero?',
  regEmail: 'Correo electrónico',
  regFirstName: 'Nombre',
  regLastName: 'Apellido',
  regCompany: 'Despacho / Empresa',
  regTrialBadge: '14 días gratis — sin tarjeta de crédito',
  regSkip: 'Omitir',
  regNext: 'Continuar',
  regStart: 'Empezar gratis',
  regStep: 'Paso',
  regFeatures: [
    'Análisis IA de documentos',
    'Plazos automáticos',
    'Almacenamiento seguro en la nube',
    'Colaboración en equipo',
  ],
  regUseCases: [
    'Análisis documental e investigación',
    'Plazos y calendario',
    'Estrategia de casos',
    'Gestión de clientes',
    'Otro',
  ],

  subTitle: 'Elija su plan',
  subSubtitle: 'Libere todo el potencial de su despacho',
  subMonthly: 'Mensual',
  subAnnual: 'Anual',
  subSave: 'Ahorre 20%',
  subPopular: 'Más popular',
  subCustom: 'A medida',
  subPerMonth: '/mes',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'Empezar gratis',
  subProCta: 'Prueba 14 días',
  subEnterpriseCta: 'Contactar',
  subStarterFeatures: [
    'Hasta 3 usuarios',
    '100 docs/mes',
    'Análisis IA',
    'Soporte email',
  ],
  subProFeatures: [
    'Hasta 10 usuarios',
    'Docs ilimitados',
    'IA avanzada',
    'Gestión de plazos',
    'Soporte prioritario',
    'Acceso API',
  ],
  subEnterpriseFeatures: [
    'Usuarios ilimitados',
    'Todas las funciones',
    'Manager dedicado',
    'Integraciones custom',
    'Opción on-premise',
    'Garantía SLA',
  ],
  subTrustRefund: '14 días garantía',
  subTrustInstant: 'Activación inmediata',
  subTrustFirms: '500+ despachos',
  subDecideLater: 'Decidir después',
  subStartNow: 'Empezar ahora',
  subContactUs: 'Contactar',
};

const it: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'Online — aiuto immediato',
  open: 'Apri chat',
  close: 'Chiudi chat',
  placeholder: 'La sua domanda...',
  send: 'Invia',
  poweredBy: 'Subsumio AI',
  typing: 'sta scrivendo...',
  showMore: 'Altre opzioni',
  showLess: 'Mostra meno',

  welcome:
    'Ciao! 👋 Sono il tuo Subsumio Copilot. Dimmi chi sei e ti mostro il passo migliore.',
  welcomeReturning: 'Bentornato/a! 👋 Come posso aiutarti oggi?',
  welcomePage:
    'Ciao! 👋 Sei sulla pagina «{page}». Dimmi chi sei — trovo il percorso più veloce.',
  welcomeReturningPage:
    'Bentornato/a! 👋 Stai guardando «{page}». Come posso aiutare?',
  socialProof: '500+ studi legali si affidano a Subsumio',

  roleVisitor: '👀 Visitatore',
  roleLawyer: '⚖️ Avvocato/a',
  roleJurist: '📚 Giurista / Commercialista',
  roleConfirm: 'Perfetto! Adatto le raccomandazioni al tuo profilo.',
  roleConfirmLawyer:
    'Perfetto — come avvocato/a, ti mostro i workflow più rilevanti. 🚀',
  roleConfirmJurist:
    'Super — per i giuristi ho consigli specializzati su ricerca e compliance. 📊',
  roleConfirmVisitor:
    'Cool! Ti mostro in 60 secondi perché 500+ studi usano Subsumio. 👍',

  contextActive: 'Contesto',
  pageLabels: {
    home: 'Home',
    pricing: 'Prezzi e Piani',
    features: 'Funzionalità',
    tax: 'Fiscale e Compliance',
    security: 'Sicurezza e Privacy',
    contact: 'Contatto',
    systems: 'Piattaforma e Sistemi',
    api: 'API e Sviluppatori',
    about: 'Chi siamo',
    docs: 'Documentazione',
    'semantic-database': 'Database semantico',
    'quick-check': 'Quick Check',
    legal: 'Note legali',
  },

  nudges: {
    home: 'Il piano ideale in 60 sec?',
    pricing: 'Quale piano per il Suo studio?',
    features: 'Quale funzione Le serve?',
    tax: 'Automatizzare i flussi fiscali?',
    security: 'Domande sulla sicurezza?',
    contact: 'Rispondiamo subito!',
    systems: 'Configurazione in 5 min?',
    api: 'API quickstart in 2 min?',
    default: 'Come posso aiutarLa?',
  },

  actionContextHelp: 'Cosa consiglia qui?',
  actionDemo: 'Prenotare una demo',
  actionPricing: 'Confrontare i piani',
  actionFreeTrial: 'Prova gratuita',
  actionSubscribe: 'Iniziare abbonamento',
  actionCredits: 'Acquistare crediti',
  actionSupport: 'Contattare supporto',
  actionApi: 'Aprire docs API',

  intentContextHelp: {
    home: 'Le consiglio la prova gratuita di 14 giorni — lavori con documenti reali, senza rischi.',
    pricing:
      'È sulla pagina prezzi. La aiuto a trovare il piano perfetto per il Suo studio.',
    features: 'Ecco tutte le funzionalità. Quale area devo prioritizzare?',
    tax: "Per i flussi fiscali, Le mostro il percorso più rapido verso l'automazione.",
    security:
      'Rispondo a tutte le domande su sicurezza — GDPR, hosting, crittografia.',
    contact: 'La collego immediatamente al team giusto.',
    systems: 'Integrazioni: La guido nella configurazione, workflow e API.',
    api: 'Integrazione API: token, endpoint, webhook — La accompagno passo per passo.',
    about: 'Scopra il nostro team e la nostra missione. Domande?',
    docs: 'La documentazione contiene guide e riferimenti. Cosa cerca?',
    'quick-check':
      'Il Quick Check mostra in pochi minuti se Subsumio è adatto al Suo workflow.',
    'semantic-database':
      "Il nostro database semantico alimenta l'analisi IA. Vuole saperne di più?",
  },
  intentDemo:
    'Ottima scelta! In 20 minuti di demo live mostriamo il workflow completo: casi, ricerca, scadenze — end-to-end.',
  intentPricing:
    'I nostri piani corrispondono ai livelli di maturità: Solo, Kanzlei, Team, Enterprise. Qual è la dimensione del Suo team?',
  intentRegister:
    'Inizi la prova gratuita di 14 giorni — nessuna carta di credito, accesso completo.',
  intentSubscribe:
    "Percorso consigliato: prova gratuita → invitare il team → attivare l'abbonamento.",
  intentCredits:
    'I crediti sono perfetti per picchi di analisi. Scelga un pacchetto:',
  intentApi:
    'API: discovery via /meta, auth bearer, endpoint paginati. Ecco i link principali:',
  intentSupport:
    'Descriva brevemente il Suo problema — La indirizzo subito al team giusto.',
  intentFallback:
    'Grazie per la domanda! Le suggerisco il percorso più veloce?',

  btnRequestDemo: 'Richiedi demo',
  btnReviewPricing: 'Vedi prezzi',
  btnRegisterFree: 'Registrati gratis',
  btnOpenSubAssistant: 'Apri assistente abbonamento',
  btnAnnualBestValue: 'Annuale (risparmia 20%)',
  btnCredits500: '500 Crediti',
  btnCredits2000: '2.000 Crediti',
  btnApiQuickstart: 'API Quickstart',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'Contatta supporto',
  btnGoPricing: 'Vai ai prezzi',
  btnToCheckout: 'Vai al pagamento sicuro',
  btnStartSubAssistant: 'Avvia assistente',

  regComplete: 'La Sua prova è pronta! Le suggerisco il miglior abbonamento?',
  subComplete: 'Tutto pronto! La indirizzo al pagamento sicuro.',

  footerHint: 'Registrazione e abbonamento direttamente qui',

  regWelcomeTitle: 'Benvenuto/a in Subsumio!',
  regWelcomeSub: '14 giorni gratis — accesso completo',
  regPersonalTitle: 'I Suoi dati',
  regPersonalSub: 'Per consigliarLa al meglio',
  regCompanyTitle: 'Il Suo studio',
  regCompanySub: "Per un'esperienza personalizzata",
  regUseCaseTitle: 'Quasi fatto!',
  regUseCaseSub: 'Cosa vorrebbe usare per primo?',
  regEmail: 'Indirizzo e-mail',
  regFirstName: 'Nome',
  regLastName: 'Cognome',
  regCompany: 'Studio / Azienda',
  regTrialBadge: '14 giorni gratis — senza carta di credito',
  regSkip: 'Salta',
  regNext: 'Continua',
  regStart: 'Inizia gratis',
  regStep: 'Passo',
  regFeatures: [
    'Analisi IA documenti',
    'Scadenze automatiche',
    'Cloud sicuro',
    'Collaborazione team',
  ],
  regUseCases: [
    'Analisi documentale e ricerca',
    'Scadenze e calendario',
    'Strategia casi',
    'Gestione clienti',
    'Altro',
  ],

  subTitle: 'Scelga il Suo piano',
  subSubtitle: 'Liberi il pieno potenziale del Suo studio',
  subMonthly: 'Mensile',
  subAnnual: 'Annuale',
  subSave: 'Risparmia 20%',
  subPopular: 'Più popolare',
  subCustom: 'Su misura',
  subPerMonth: '/mese',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'Inizia gratis',
  subProCta: 'Prova 14 giorni',
  subEnterpriseCta: 'Contattaci',
  subStarterFeatures: [
    'Fino a 3 utenti',
    '100 docs/mese',
    'Analisi IA',
    'Supporto email',
  ],
  subProFeatures: [
    'Fino a 10 utenti',
    'Docs illimitati',
    'IA avanzata',
    'Gestione scadenze',
    'Supporto prioritario',
    'Accesso API',
  ],
  subEnterpriseFeatures: [
    'Utenti illimitati',
    'Tutte le funzionalità',
    'Manager dedicato',
    'Integrazioni custom',
    'Opzione on-premise',
    'Garanzia SLA',
  ],
  subTrustRefund: '14 giorni garanzia',
  subTrustInstant: 'Attivazione immediata',
  subTrustFirms: '500+ studi legali',
  subDecideLater: 'Decidere dopo',
  subStartNow: 'Inizia ora',
  subContactUs: 'Contattaci',
};

const pl: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'Online — natychmiastowa pomoc',
  open: 'Otwórz czat',
  close: 'Zamknij czat',
  placeholder: 'Twoje pytanie...',
  send: 'Wyślij',
  poweredBy: 'Subsumio AI',
  typing: 'pisze...',
  showMore: 'Więcej opcji',
  showLess: 'Mniej opcji',

  welcome:
    'Cześć! 👋 Jestem Twoim Subsumio Copilot. Powiedz mi, kim jesteś — pokażę Ci najlepszą drogę.',
  welcomeReturning: 'Hej, znowu Ty! 👋 Jak mogę Ci dziś pomóc?',
  welcomePage:
    'Cześć! 👋 Jesteś na stronie „{page}”. Powiedz mi kim jesteś — znajdę najszybszą ścieżkę.',
  welcomeReturningPage:
    'Witaj ponownie! 👋 Przeglądasz „{page}”. Jak mogę pomóc?',
  socialProof: '500+ kancelarii ufa Subsumio',

  roleVisitor: '👀 Odwiedzający',
  roleLawyer: '⚖️ Adwokat / Radca',
  roleJurist: '📚 Prawnik / Doradca podatkowy',
  roleConfirm: 'Świetnie! Dostosowuję rekomendacje do Twojego profilu.',
  roleConfirmLawyer:
    'Świetnie — jako adwokat pokażę Ci najważniejsze workflow i jak zacząć od razu. 🚀',
  roleConfirmJurist:
    'Super — dla prawników mam specjalistyczne wskazówki dotyczące badań i compliance. 📊',
  roleConfirmVisitor:
    'Cool! Pokażę Ci w 60 sekund, dlaczego 500+ kancelarii korzysta z Subsumio. 👍',

  contextActive: 'Kontekst',
  pageLabels: {
    home: 'Strona główna',
    pricing: 'Cennik i Plany',
    features: 'Funkcje',
    tax: 'Podatkowy i Compliance',
    security: 'Bezpieczeństwo i Prywatność',
    contact: 'Kontakt',
    systems: 'Platforma i Systemy',
    api: 'API i Deweloperzy',
    about: 'O nas',
    docs: 'Dokumentacja',
    'semantic-database': 'Baza semantyczna',
    'quick-check': 'Quick Check',
    legal: 'Informacje prawne',
  },

  nudges: {
    home: 'Idealny plan w 60 sek?',
    pricing: 'Który plan pasuje do Ciebie?',
    features: 'Która funkcja najpierw?',
    tax: 'Automatyzacja procesów podatkowych?',
    security: 'Pytania o bezpieczeństwo?',
    contact: 'Odpowiadamy natychmiast!',
    systems: 'Konfiguracja w 5 min?',
    api: 'API quickstart w 2 min?',
    default: 'Jak mogę Ci pomóc?',
  },

  actionContextHelp: 'Co polecasz tutaj?',
  actionDemo: 'Zarezerwuj demo',
  actionPricing: 'Porównaj plany',
  actionFreeTrial: 'Bezpłatna próba',
  actionSubscribe: 'Rozpocznij subskrypcję',
  actionCredits: 'Kup kredyty',
  actionSupport: 'Kontakt z supportem',
  actionApi: 'Otwórz docs API',

  intentContextHelp: {
    home: 'Polecam bezpłatny 14-dniowy okres próbny — pracuj z prawdziwymi dokumentami, bez ryzyka.',
    pricing:
      'Jesteś na stronie cennika. Pomogę Ci znaleźć plan dopasowany do Twojej kancelarii.',
    features: 'Oto wszystkie funkcje. Który obszar priorytetyzować?',
    tax: 'Dla procesów podatkowych pokażę najszybszą drogę do automatyzacji.',
    security:
      'Odpowiadam na pytania o bezpieczeństwo — RODO, hosting, szyfrowanie.',
    contact: 'Połączę Cię od razu z odpowiednim zespołem.',
    systems: 'Integracje: przeprowadzę Cię przez konfigurację, workflow i API.',
    api: 'Integracja API: tokeny, endpointy, webhooki — prowadzę krok po kroku.',
    about: 'Poznaj nasz zespół i misję. Masz pytania?',
    docs: 'Dokumentacja zawiera przewodniki i referencje. Czego szukasz?',
    'quick-check':
      'Quick Check pokaże w kilka minut, czy Subsumio pasuje do Twojego workflow.',
    'semantic-database':
      'Nasza baza semantyczna napędza analizę AI. Chcesz wiedzieć więcej?',
  },
  intentDemo:
    'Świetny wybór! W 20-minutowym demo pokazujemy cały workflow: sprawy, badania, terminy — od A do Z.',
  intentPricing:
    'Nasze plany odpowiadają poziomom dojrzałości: Solo, Kanzlei, Team, Enterprise. Jaki jest rozmiar Twojego zespołu?',
  intentRegister:
    'Rozpocznij bezpłatny 14-dniowy okres próbny — bez karty kredytowej, pełny dostęp.',
  intentSubscribe:
    'Zalecana ścieżka: okres próbny → zaproś zespół → aktywuj subskrypcję.',
  intentCredits: 'Kredyty są idealne na szczyty analityczne. Wybierz pakiet:',
  intentApi:
    'API: discovery via /meta, auth bearer, paginowane endpointy. Oto kluczowe linki:',
  intentSupport:
    'Krótko opisz problem — przekieruję Cię natychmiast do odpowiedniego zespołu.',
  intentFallback: 'Dzięki za pytanie! Zasugerować najszybszą ścieżkę?',

  btnRequestDemo: 'Poproś o demo',
  btnReviewPricing: 'Zobacz cennik',
  btnRegisterFree: 'Zarejestruj się za darmo',
  btnOpenSubAssistant: 'Otwórz asystenta subskrypcji',
  btnAnnualBestValue: 'Roczny (oszczędź 20%)',
  btnCredits500: '500 Kredytów',
  btnCredits2000: '2 000 Kredytów',
  btnApiQuickstart: 'API Quickstart',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'Kontakt z supportem',
  btnGoPricing: 'Idź do cennika',
  btnToCheckout: 'Przejdź do bezpiecznej płatności',
  btnStartSubAssistant: 'Uruchom asystenta',

  regComplete:
    'Twój okres próbny jest gotowy! Zasugerować najlepszą subskrypcję?',
  subComplete: 'Wszystko gotowe! Przekierowuję do bezpiecznej płatności.',

  footerHint: 'Rejestracja i subskrypcja bezpośrednio tutaj',

  regWelcomeTitle: 'Witaj w Subsumio!',
  regWelcomeSub: '14 dni za darmo — pełny dostęp',
  regPersonalTitle: 'Twoje dane',
  regPersonalSub: 'Abyśmy mogli Ci lepiej doradzić',
  regCompanyTitle: 'Twoja kancelaria',
  regCompanySub: 'Dla spersonalizowanego doświadczenia',
  regUseCaseTitle: 'Prawie gotowe!',
  regUseCaseSub: 'Co chcesz użyć najpierw?',
  regEmail: 'Adres e-mail',
  regFirstName: 'Imię',
  regLastName: 'Nazwisko',
  regCompany: 'Kancelaria / Firma',
  regTrialBadge: '14 dni za darmo — bez karty kredytowej',
  regSkip: 'Pomiń',
  regNext: 'Dalej',
  regStart: 'Zacznij za darmo',
  regStep: 'Krok',
  regFeatures: [
    'Analiza AI dokumentów',
    'Automatyczne terminy',
    'Bezpieczna chmura',
    'Współpraca zespołowa',
  ],
  regUseCases: [
    'Analiza dokumentów i badania',
    'Terminy i kalendarz',
    'Strategia spraw',
    'Zarządzanie klientami',
    'Inne',
  ],

  subTitle: 'Wybierz swój plan',
  subSubtitle: 'Odblokuj pełny potencjał kancelarii',
  subMonthly: 'Miesięcznie',
  subAnnual: 'Rocznie',
  subSave: 'Oszczędź 20%',
  subPopular: 'Najpopularniejszy',
  subCustom: 'Na miarę',
  subPerMonth: '/mies.',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'Zacznij za darmo',
  subProCta: 'Próba 14 dni',
  subEnterpriseCta: 'Skontaktuj się',
  subStarterFeatures: [
    'Do 3 użytkowników',
    '100 docs/mies.',
    'Analiza AI',
    'Wsparcie email',
  ],
  subProFeatures: [
    'Do 10 użytkowników',
    'Bez limitu docs',
    'Zaawansowana AI',
    'Zarządzanie terminami',
    'Priorytetowe wsparcie',
    'Dostęp API',
  ],
  subEnterpriseFeatures: [
    'Bez limitu użytkowników',
    'Wszystkie funkcje',
    'Dedykowany manager',
    'Integracje custom',
    'Opcja on-premise',
    'Gwarancja SLA',
  ],
  subTrustRefund: '14 dni gwarancji',
  subTrustInstant: 'Natychmiastowa aktywacja',
  subTrustFirms: '500+ kancelarii',
  subDecideLater: 'Zdecyduj później',
  subStartNow: 'Zacznij teraz',
  subContactUs: 'Skontaktuj się',
};

const pt: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'Online — ajuda imediata',
  open: 'Abrir chat',
  close: 'Fechar chat',
  placeholder: 'Sua pergunta...',
  send: 'Enviar',
  poweredBy: 'Subsumio AI',
  typing: 'digitando...',
  showMore: 'Mais opções',
  showLess: 'Menos opções',

  welcome:
    'Bem-vindo/a! Ajudo você a encontrar o melhor próximo passo. Quem é você?',
  welcomeReturning: 'Bem-vindo/a de volta! Como posso ajudar hoje?',
  welcomePage:
    'Olá! 👋 Você está na página "{page}". Diga quem você é e eu encontro o caminho mais rápido.',
  welcomeReturningPage:
    'Bem-vindo/a de volta! 👋 Você está vendo "{page}". Como posso ajudar?',
  socialProof: '500+ escritórios confiam no Subsumio',

  roleVisitor: '👀 Visitante',
  roleLawyer: '⚖️ Advogado/a',
  roleJurist: '📚 Jurista / Consultor fiscal',
  roleConfirm: 'Perfeito! Adapto minhas recomendações ao seu perfil.',
  roleConfirmLawyer:
    'Perfeito — como advogado/a, mostro os workflows mais relevantes. 🚀',
  roleConfirmJurist:
    'Show — para juristas tenho dicas especializadas de pesquisa e compliance. 📊',
  roleConfirmVisitor:
    'Legal! Mostro em 60 segundos por que 500+ escritórios usam Subsumio. 👍',

  contextActive: 'Contexto',
  pageLabels: {
    home: 'Início',
    pricing: 'Preços e Planos',
    features: 'Funcionalidades',
    tax: 'Fiscal e Compliance',
    security: 'Segurança e Privacidade',
    contact: 'Contato',
    systems: 'Plataforma e Sistemas',
    api: 'API e Desenvolvedores',
    about: 'Sobre nós',
    docs: 'Documentação',
    'semantic-database': 'Base semântica',
    'quick-check': 'Quick Check',
    legal: 'Legal',
  },

  nudges: {
    home: 'Plano ideal em 60 seg?',
    pricing: 'Qual plano para você?',
    features: 'Qual funcionalidade primeiro?',
    tax: 'Automatizar fluxos fiscais?',
    security: 'Perguntas sobre segurança?',
    contact: 'Respondemos na hora!',
    systems: 'Configuração em 5 min?',
    api: 'API quickstart em 2 min?',
    default: 'Como posso ajudar?',
  },

  actionContextHelp: 'O que recomenda aqui?',
  actionDemo: 'Agendar demo',
  actionPricing: 'Comparar planos',
  actionFreeTrial: 'Teste gratuito',
  actionSubscribe: 'Iniciar assinatura',
  actionCredits: 'Comprar créditos',
  actionSupport: 'Contatar suporte',
  actionApi: 'Abrir docs API',

  intentContextHelp: {
    home: 'Recomendo o teste gratuito de 14 dias — trabalhe com documentos reais, sem risco.',
    pricing:
      'Você está na página de preços. Ajudo a encontrar o plano ideal para seu escritório.',
    features: 'Aqui estão todas as funcionalidades. Qual área devo priorizar?',
    tax: 'Para fluxos fiscais, mostro o caminho mais rápido para automação.',
    security:
      'Respondo todas as perguntas de segurança — LGPD/GDPR, hospedagem, criptografia.',
    contact: 'Conecto você imediatamente à equipe certa.',
    systems: 'Integrações: guio na configuração, workflows e API.',
    api: 'Integração API: tokens, endpoints, webhooks — acompanho passo a passo.',
    about: 'Conheça nossa equipe e missão. Alguma pergunta?',
    docs: 'A documentação tem guias e referências. O que procura?',
    'quick-check':
      'O Quick Check mostra em minutos se o Subsumio se encaixa no seu workflow.',
    'semantic-database':
      'Nossa base semântica alimenta a análise IA. Quer saber mais?',
  },
  intentDemo:
    'Ótima escolha! Em 20 min de demo mostramos o workflow completo: casos, pesquisa, prazos — ponta a ponta.',
  intentPricing:
    'Nossos planos são para níveis de maturidade: Solo, Kanzlei, Team, Enterprise. Qual o tamanho da sua equipe?',
  intentRegister:
    'Comece seu teste gratuito de 14 dias — sem cartão, acesso completo.',
  intentSubscribe:
    'Caminho recomendado: teste → convidar equipe → ativar assinatura.',
  intentCredits:
    'Créditos são perfeitos para picos de análise. Escolha um pacote:',
  intentApi:
    'API: discovery via /meta, auth bearer, endpoints paginados. Aqui os links essenciais:',
  intentSupport: 'Descreva brevemente seu problema — encaminho imediatamente.',
  intentFallback: 'Obrigado pela pergunta! Devo sugerir o caminho mais rápido?',

  btnRequestDemo: 'Solicitar demo',
  btnReviewPricing: 'Ver preços',
  btnRegisterFree: 'Registrar grátis',
  btnOpenSubAssistant: 'Abrir assistente de assinatura',
  btnAnnualBestValue: 'Anual (economize 20%)',
  btnCredits500: '500 Créditos',
  btnCredits2000: '2.000 Créditos',
  btnApiQuickstart: 'API Quickstart',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'Contatar suporte',
  btnGoPricing: 'Ir para preços',
  btnToCheckout: 'Ir ao checkout seguro',
  btnStartSubAssistant: 'Iniciar assistente',

  regComplete: 'Seu teste está pronto! Sugiro a melhor assinatura?',
  subComplete: 'Tudo pronto! Encaminho ao checkout seguro.',

  footerHint: 'Registro e assinatura diretamente aqui',

  regWelcomeTitle: 'Bem-vindo/a ao Subsumio!',
  regWelcomeSub: '14 dias grátis — acesso completo',
  regPersonalTitle: 'Seus dados',
  regPersonalSub: 'Para melhor orientação',
  regCompanyTitle: 'Seu escritório',
  regCompanySub: 'Para uma experiência personalizada',
  regUseCaseTitle: 'Quase pronto!',
  regUseCaseSub: 'O que gostaria de usar primeiro?',
  regEmail: 'Endereço de e-mail',
  regFirstName: 'Nome',
  regLastName: 'Sobrenome',
  regCompany: 'Escritório / Empresa',
  regTrialBadge: '14 dias grátis — sem cartão de crédito',
  regSkip: 'Pular',
  regNext: 'Continuar',
  regStart: 'Começar grátis',
  regStep: 'Passo',
  regFeatures: [
    'Análise IA de documentos',
    'Prazos automáticos',
    'Nuvem segura',
    'Colaboração em equipe',
  ],
  regUseCases: [
    'Análise documental e pesquisa',
    'Prazos e calendário',
    'Estratégia de casos',
    'Gestão de clientes',
    'Outro',
  ],

  subTitle: 'Escolha seu plano',
  subSubtitle: 'Libere todo o potencial do seu escritório',
  subMonthly: 'Mensal',
  subAnnual: 'Anual',
  subSave: 'Economize 20%',
  subPopular: 'Mais popular',
  subCustom: 'Sob medida',
  subPerMonth: '/mês',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'Começar grátis',
  subProCta: 'Teste 14 dias',
  subEnterpriseCta: 'Fale conosco',
  subStarterFeatures: [
    'Até 3 usuários',
    '100 docs/mês',
    'Análise IA',
    'Suporte email',
  ],
  subProFeatures: [
    'Até 10 usuários',
    'Docs ilimitados',
    'IA avançada',
    'Gestão de prazos',
    'Suporte prioritário',
    'Acesso API',
  ],
  subEnterpriseFeatures: [
    'Usuários ilimitados',
    'Todas funcionalidades',
    'Manager dedicado',
    'Integrações custom',
    'Opção on-premise',
    'Garantia SLA',
  ],
  subTrustRefund: '14 dias garantia',
  subTrustInstant: 'Ativação imediata',
  subTrustFirms: '500+ escritórios',
  subDecideLater: 'Decidir depois',
  subStartNow: 'Começar agora',
  subContactUs: 'Fale conosco',
};

const ja: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'オンライン — 即座にサポート',
  open: 'チャットを開く',
  close: 'チャットを閉じる',
  placeholder: 'ご質問をどうぞ...',
  send: '送信',
  poweredBy: 'Subsumio AI',
  typing: '入力中...',
  showMore: 'その他のオプション',
  showLess: '閉じる',

  welcome: 'ようこそ！最適な次のステップをご案内します。お客様のご職業は？',
  welcomeReturning: 'おかえりなさい！本日はどのようにお手伝いできますか？',
  welcomePage:
    'こんにちは！👋 現在「{page}」をご覧です。立場を教えていただければ最短ルートをご案内します。',
  welcomeReturningPage:
    'おかえりなさい！👋 「{page}」をご覧中です。どのようにお手伝いしましょうか？',
  socialProof: '500以上の法律事務所がSubsumioを信頼',

  roleVisitor: '👀 訪問者',
  roleLawyer: '⚖️ 弁護士',
  roleJurist: '📚 法律家 / 税理士',
  roleConfirm: '承知しました！お客様のプロフィールに合わせてご提案いたします。',
  roleConfirmLawyer:
    '弁護士の方向けに、最も関連性の高いワークフローをご案内します。🚀',
  roleConfirmJurist:
    '法律家の方向けに、リサーチとコンプライアンスの専門ティップをご用意しています。📊',
  roleConfirmVisitor:
    '60秒で500以上の事務所がSubsumioを選ぶ理由をお見せします。👍',

  contextActive: 'コンテキスト',
  pageLabels: {
    home: 'ホーム',
    pricing: '料金プラン',
    features: '機能',
    tax: '税務・コンプライアンス',
    security: 'セキュリティ',
    contact: 'お問い合わせ',
    systems: 'プラットフォーム',
    api: 'API・開発者',
    about: '会社概要',
    docs: 'ドキュメント',
    'semantic-database': 'セマンティックDB',
    'quick-check': 'クイックチェック',
    legal: '法的情報',
  },

  nudges: {
    home: '60秒で最適なプランを？',
    pricing: 'どのプランが最適ですか？',
    features: 'まず必要な機能は？',
    tax: '税務ワークフローの自動化？',
    security: 'セキュリティについて質問？',
    contact: '即座にお答えします！',
    systems: '5分でセットアップ？',
    api: 'APIクイックスタート2分？',
    default: 'どのようにお手伝いできますか？',
  },

  actionContextHelp: 'ここでのおすすめは？',
  actionDemo: 'デモを予約',
  actionPricing: 'プランを比較',
  actionFreeTrial: '無料トライアル',
  actionSubscribe: 'サブスクリプション開始',
  actionCredits: 'クレジット購入',
  actionSupport: 'サポートに連絡',
  actionApi: 'APIドキュメント',

  intentContextHelp: {
    home: '14日間の無料トライアルをおすすめします。実際の書類ですぐに作業できます。',
    pricing: '料金ページです。事務所の規模に合ったプランをお探しします。',
    features: 'すべての機能をご覧いただけます。どの分野を優先しますか？',
    tax: '税務ワークフローの最短自動化パスをご案内します。',
    security: 'セキュリティに関するすべてのご質問にお答えします。',
    contact: '適切なチームにすぐお繋ぎします。',
    systems:
      'インテグレーション：セットアップ、ワークフロー、APIをご案内します。',
    api: 'API統合：トークン作成、エンドポイントテスト、Webhook設定をサポートします。',
    about: '私たちのチームとミッションについて。ご質問はありますか？',
    docs: 'ドキュメントにはガイドとリファレンスがあります。何をお探しですか？',
    'quick-check':
      'クイックチェックで、Subsumioがワークフローに適しているか数分で確認できます。',
    'semantic-database':
      'セマンティックデータベースがAI分析を支えています。詳しくお知りになりたいですか？',
  },
  intentDemo:
    '素晴らしい選択です！20分のライブデモで、ケース管理、調査、期限管理の全ワークフローをお見せします。',
  intentPricing:
    'プランは事務所の成熟度に合わせています：Solo、Kanzlei、Team、Enterprise。チームの規模は？',
  intentRegister:
    '14日間の無料トライアルを今すぐ開始 — クレジットカード不要、フルアクセス。',
  intentSubscribe:
    'おすすめの手順：トライアル開始 → チーム招待 → サブスクリプション有効化。',
  intentCredits:
    'クレジットは分析のピーク時に最適です。パッケージをお選びください：',
  intentApi:
    'API統合：/meta経由のディスカバリー、Bearer認証、ページネーション対応エンドポイント。主要リンク：',
  intentSupport:
    'お問題を簡単にご説明ください。すぐに適切なチームにお繋ぎします。',
  intentFallback:
    'ご質問ありがとうございます！最短の解決方法をご提案しましょうか？',

  btnRequestDemo: 'デモをリクエスト',
  btnReviewPricing: '料金を見る',
  btnRegisterFree: '無料登録',
  btnOpenSubAssistant: 'サブスクリプションアシスタント',
  btnAnnualBestValue: '年間プラン（20%お得）',
  btnCredits500: '500クレジット',
  btnCredits2000: '2,000クレジット',
  btnApiQuickstart: 'APIクイックスタート',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'サポートに連絡',
  btnGoPricing: '料金ページへ',
  btnToCheckout: '安全な決済へ',
  btnStartSubAssistant: 'アシスタント開始',

  regComplete:
    'トライアルの準備ができました！最適なサブスクリプションをご提案しましょうか？',
  subComplete: '準備完了です！安全な決済ページへご案内します。',

  footerHint: '登録とサブスクリプションをここで直接',

  regWelcomeTitle: 'Subsumioへようこそ！',
  regWelcomeSub: '14日間無料 — フルアクセス',
  regPersonalTitle: 'お客様の情報',
  regPersonalSub: '最適なアドバイスのために',
  regCompanyTitle: 'お客様の事務所',
  regCompanySub: 'カスタマイズされた体験のために',
  regUseCaseTitle: 'もう少しです！',
  regUseCaseSub: 'まず何を使いたいですか？',
  regEmail: 'メールアドレス',
  regFirstName: '名',
  regLastName: '姓',
  regCompany: '事務所 / 会社',
  regTrialBadge: '14日間無料 — クレジットカード不要',
  regSkip: 'スキップ',
  regNext: '次へ',
  regStart: '無料で開始',
  regStep: 'ステップ',
  regFeatures: [
    'AI文書分析',
    '自動期限管理',
    '安全なクラウド',
    'チームコラボレーション',
  ],
  regUseCases: [
    '文書分析と調査',
    '期限とカレンダー',
    'ケース戦略',
    'クライアント管理',
    'その他',
  ],

  subTitle: 'プランを選択',
  subSubtitle: '事務所の可能性を最大限に',
  subMonthly: '月額',
  subAnnual: '年額',
  subSave: '20%お得',
  subPopular: '最も人気',
  subCustom: 'カスタム',
  subPerMonth: '/月',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: '無料開始',
  subProCta: '14日間試用',
  subEnterpriseCta: 'お問い合わせ',
  subStarterFeatures: [
    '最大3ユーザー',
    '月100文書',
    'AI分析',
    'メールサポート',
  ],
  subProFeatures: [
    '最大10ユーザー',
    '無制限文書',
    '高度なAI',
    '期限管理',
    '優先サポート',
    'APIアクセス',
  ],
  subEnterpriseFeatures: [
    '無制限ユーザー',
    '全機能',
    '専任マネージャー',
    'カスタム統合',
    'オンプレミス可',
    'SLA保証',
  ],
  subTrustRefund: '14日間返金保証',
  subTrustInstant: '即時アクティベーション',
  subTrustFirms: '500+事務所',
  subDecideLater: '後で決める',
  subStartNow: '今すぐ開始',
  subContactUs: 'お問い合わせ',
};

const ko: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: '온라인 — 즉시 지원',
  open: '채팅 열기',
  close: '채팅 닫기',
  placeholder: '질문을 입력하세요...',
  send: '전송',
  poweredBy: 'Subsumio AI',
  typing: '입력 중...',
  showMore: '더 보기',
  showLess: '접기',

  welcome:
    '안녕하세요! 👋 Subsumio Copilot입니다. 어떤 분이신지 알려주세요 — 최적의 경로를 안내해 드리겠습니다.',
  welcomeReturning: '다시 오셨군요! 👋 오늘 어떻게 도와드릴까요?',
  welcomePage:
    '안녕하세요! 👋 「{page}」 페이지에 계시네요. 어떤 분이신지 알려주세요 — 가장 빠른 경로를 찾아드리겠습니다.',
  welcomeReturningPage:
    '다시 오셨군요! 👋 「{page}」를 보고 계시네요. 어떻게 도와드릴까요?',
  socialProof: '500개 이상의 법률사무소가 Subsumio를 신뢰',

  roleVisitor: '👀 방문자',
  roleLawyer: '⚖️ 변호사',
  roleJurist: '📚 법률가 / 세무사',
  roleConfirm: '좋습니다! 프로필에 맞게 추천을 조정하겠습니다.',
  roleConfirmLawyer:
    '변호사님께 가장 관련성 높은 워크플로우를 안내해 드리겠습니다. 🚀',
  roleConfirmJurist:
    '법률가님을 위한 리서치와 컴플라이언스 전문 팁을 준비했습니다. 📊',
  roleConfirmVisitor:
    '60초 만에 500개 이상의 사무소가 Subsumio를 선택하는 이유를 보여드리겠습니다. 👍',

  contextActive: '컨텍스트',
  pageLabels: {
    home: '홈',
    pricing: '요금 및 플랜',
    features: '기능',
    tax: '세무 및 컴플라이언스',
    security: '보안 및 개인정보',
    contact: '문의',
    systems: '플랫폼 및 시스템',
    api: 'API 및 개발자',
    about: '소개',
    docs: '문서',
    'semantic-database': '시맨틱 DB',
    'quick-check': '퀵 체크',
    legal: '법적 정보',
  },

  nudges: {
    home: '60초 만에 최적 플랜?',
    pricing: '어떤 플랜이 맞으세요?',
    features: '어떤 기능이 먼저 필요하세요?',
    tax: '세무 워크플로 자동화?',
    security: '보안 관련 질문?',
    contact: '즉시 답변합니다!',
    systems: '5분 만에 설정?',
    api: 'API 퀵스타트 2분?',
    default: '어떻게 도와드릴까요?',
  },

  actionContextHelp: '여기서 추천하시는 건?',
  actionDemo: '라이브 데모 예약',
  actionPricing: '플랜 비교',
  actionFreeTrial: '무료 체험',
  actionSubscribe: '구독 시작',
  actionCredits: '크레딧 구매',
  actionSupport: '지원 문의',
  actionApi: 'API 문서 열기',

  intentContextHelp: {
    home: '14일 무료 체험을 추천합니다 — 실제 문서로 바로 작업하세요.',
    pricing: '요금 페이지입니다. 사무소 규모에 맞는 플랜을 찾아드리겠습니다.',
    features: '모든 기능을 확인하세요. 어떤 분야를 우선 안내할까요?',
    tax: '세무 워크플로의 가장 빠른 자동화 경로를 보여드리겠습니다.',
    security: '보안 관련 모든 질문에 답변합니다 — GDPR, 호스팅, 암호화.',
    contact: '적절한 팀으로 바로 연결해 드리겠습니다.',
    systems: '통합: 설정, 워크플로, API를 안내합니다.',
    api: 'API 통합: 토큰, 엔드포인트, 웹훅 — 단계별로 안내합니다.',
    about: '팀과 미션에 대해 알아보세요. 질문이 있으세요?',
    docs: '문서에 가이드와 레퍼런스가 있습니다. 무엇을 찾으세요?',
    'quick-check': '퀵 체크로 몇 분 만에 Subsumio가 맞는지 확인하세요.',
    'semantic-database':
      '시맨틱 데이터베이스가 AI 분석을 지원합니다. 더 알고 싶으세요?',
  },
  intentDemo:
    '좋은 선택입니다! 20분 라이브 데모에서 전체 워크플로를 보여드립니다.',
  intentPricing:
    '플랜은 사무소 성숙도에 맞춰져 있습니다: Solo, Kanzlei, Team, Enterprise. 팀 규모는?',
  intentRegister:
    '14일 무료 체험을 지금 시작하세요 — 신용카드 불필요, 전체 기능 이용.',
  intentSubscribe: '추천 경로: 체험 시작 → 팀 초대 → 구독 활성화.',
  intentCredits: '크레딧은 분석 피크에 이상적입니다. 패키지를 선택하세요:',
  intentApi:
    'API: /meta 디스커버리, Bearer 인증, 페이지네이션 엔드포인트. 주요 링크:',
  intentSupport: '문제를 간단히 설명해 주세요 — 즉시 적절한 팀으로 연결합니다.',
  intentFallback: '질문 감사합니다! 가장 빠른 경로를 제안할까요?',

  btnRequestDemo: '데모 요청',
  btnReviewPricing: '요금 보기',
  btnRegisterFree: '무료 등록',
  btnOpenSubAssistant: '구독 어시스턴트',
  btnAnnualBestValue: '연간 (20% 절약)',
  btnCredits500: '500 크레딧',
  btnCredits2000: '2,000 크레딧',
  btnApiQuickstart: 'API 퀵스타트',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: '지원 문의',
  btnGoPricing: '요금 페이지로',
  btnToCheckout: '안전한 결제로',
  btnStartSubAssistant: '어시스턴트 시작',

  regComplete: '체험이 준비되었습니다! 최적의 구독을 제안할까요?',
  subComplete: '모든 준비가 완료되었습니다! 안전한 결제 페이지로 안내합니다.',

  footerHint: '등록 및 구독을 여기서 직접',

  regWelcomeTitle: 'Subsumio에 오신 것을 환영합니다!',
  regWelcomeSub: '14일 무료 — 전체 기능 이용',
  regPersonalTitle: '개인 정보',
  regPersonalSub: '최적의 안내를 위해',
  regCompanyTitle: '소속 사무소',
  regCompanySub: '맞춤 경험을 위해',
  regUseCaseTitle: '거의 완료!',
  regUseCaseSub: '먼저 무엇을 사용하고 싶으세요?',
  regEmail: '이메일 주소',
  regFirstName: '이름',
  regLastName: '성',
  regCompany: '사무소 / 회사',
  regTrialBadge: '14일 무료 — 신용카드 불필요',
  regSkip: '건너뛰기',
  regNext: '계속',
  regStart: '무료로 시작',
  regStep: '단계',
  regFeatures: ['AI 문서 분석', '자동 기한 관리', '안전한 클라우드', '팀 협업'],
  regUseCases: [
    '문서 분석 및 조사',
    '기한 및 일정',
    '사건 전략',
    '고객 관리',
    '기타',
  ],

  subTitle: '플랜 선택',
  subSubtitle: '사무소의 잠재력을 극대화하세요',
  subMonthly: '월간',
  subAnnual: '연간',
  subSave: '20% 절약',
  subPopular: '가장 인기',
  subCustom: '맞춤',
  subPerMonth: '/월',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: '무료 시작',
  subProCta: '14일 체험',
  subEnterpriseCta: '문의하기',
  subStarterFeatures: ['최대 3명', '월 100건', 'AI 분석', '이메일 지원'],
  subProFeatures: [
    '최대 10명',
    '무제한 문서',
    '고급 AI',
    '기한 관리',
    '우선 지원',
    'API 접근',
  ],
  subEnterpriseFeatures: [
    '무제한 사용자',
    '모든 기능',
    '전담 매니저',
    '커스텀 통합',
    '온프레미스',
    'SLA 보증',
  ],
  subTrustRefund: '14일 환불 보증',
  subTrustInstant: '즉시 활성화',
  subTrustFirms: '500+ 사무소',
  subDecideLater: '나중에 결정',
  subStartNow: '지금 시작',
  subContactUs: '문의하기',
};

const ar: ChatbotStrings = {
  botName: 'Subsumio Copilot',
  status: 'متصل — مساعدة فورية',
  open: 'فتح المحادثة',
  close: 'إغلاق المحادثة',
  placeholder: 'سؤالك...',
  send: 'إرسال',
  poweredBy: 'Subsumio AI',
  typing: 'يكتب...',
  showMore: 'خيارات أخرى',
  showLess: 'عرض أقل',

  welcome: 'مرحباً! سأساعدك في إيجاد أفضل خطوة تالية. من أنت؟',
  welcomeReturning: 'مرحباً بعودتك! كيف يمكنني مساعدتك اليوم؟',
  welcomePage:
    'مرحباً! 👋 أنت الآن في صفحة "{page}". أخبرني بدورك وسأرشدك لأسرع مسار.',
  welcomeReturningPage:
    'مرحباً بعودتك! 👋 أنت تتصفح "{page}" الآن. كيف يمكنني المساعدة؟',
  socialProof: 'أكثر من 500 مكتب محاماة يثقون بـ Subsumio',

  roleVisitor: '👀 زائر',
  roleLawyer: '⚖️ محامي/ة',
  roleJurist: '📚 قانوني / مستشار ضريبي',
  roleConfirm: 'ممتاز! سأخصص توصياتي لملفك.',
  roleConfirmLawyer: 'سأعرض لك أهم سير العمل كمحامي/ة وكيف تبدأ فوراً. 🚀',
  roleConfirmJurist: 'للقانونيين، لدي نصائح متخصصة في البحث والامتثال. 📊',
  roleConfirmVisitor: 'سأريك في 60 ثانية لماذا 500+ مكتب يستخدم Subsumio. 👍',

  contextActive: 'السياق',
  pageLabels: {
    home: 'الرئيسية',
    pricing: 'الأسعار والباقات',
    features: 'الميزات',
    tax: 'الضرائب والامتثال',
    security: 'الأمان والخصوصية',
    contact: 'اتصل بنا',
    systems: 'المنصة والأنظمة',
    api: 'API والمطورين',
    about: 'من نحن',
    docs: 'التوثيق',
    'semantic-database': 'قاعدة البيانات الدلالية',
    'quick-check': 'فحص سريع',
    legal: 'قانوني',
  },

  nudges: {
    home: 'الباقة المثالية في 60 ثانية؟',
    pricing: 'أي باقة تناسبك؟',
    features: 'أي ميزة تحتاجها أولاً؟',
    tax: 'أتمتة سير العمل الضريبي؟',
    security: 'أسئلة حول الأمان؟',
    contact: 'نرد فوراً!',
    systems: 'إعداد في 5 دقائق؟',
    api: 'بدء سريع API في دقيقتين؟',
    default: 'كيف يمكنني مساعدتك؟',
  },

  actionContextHelp: 'ماذا تنصح هنا؟',
  actionDemo: 'حجز عرض مباشر',
  actionPricing: 'مقارنة الباقات',
  actionFreeTrial: 'تجربة مجانية',
  actionSubscribe: 'بدء الاشتراك',
  actionCredits: 'شراء أرصدة',
  actionSupport: 'الاتصال بالدعم',
  actionApi: 'فتح مستندات API',

  intentContextHelp: {
    home: 'أوصي بالتجربة المجانية لمدة 14 يوماً — ابدأ العمل مع مستندات حقيقية فوراً.',
    pricing: 'أنت في صفحة الأسعار. سأساعدك في إيجاد الباقة المناسبة لمكتبك.',
    features: 'إليك جميع الميزات. أي مجال يجب أن أولي الأولوية له؟',
    tax: 'لسير العمل الضريبي، سأريك أسرع طريق للأتمتة.',
    security: 'أجيب على جميع أسئلة الأمان — GDPR، الاستضافة، التشفير.',
    contact: 'سأوصلك فوراً بالفريق المناسب.',
    systems: 'التكاملات: سأرشدك خلال الإعداد وسير العمل وAPI.',
    api: 'تكامل API: الرموز، نقاط النهاية، Webhooks — سأرشدك خطوة بخطوة.',
    about: 'تعرف على فريقنا ومهمتنا. هل لديك أسئلة؟',
    docs: 'التوثيق يحتوي على أدلة ومراجع. ماذا تبحث عنه؟',
    'quick-check':
      'الفحص السريع يوضح في دقائق ما إذا كان Subsumio مناسباً لسير عملك.',
    'semantic-database':
      'قاعدة بياناتنا الدلالية تغذي تحليل الذكاء الاصطناعي. هل تريد معرفة المزيد؟',
  },
  intentDemo:
    'خيار ممتاز! في عرض مباشر مدته 20 دقيقة نعرض سير العمل الكامل: القضايا، البحث، المواعيد.',
  intentPricing:
    'خططنا مصممة حسب نضج المكتب: Solo، Kanzlei، Team، Enterprise. ما حجم فريقك؟',
  intentRegister:
    'ابدأ تجربتك المجانية لمدة 14 يوماً الآن — بدون بطاقة ائتمان، وصول كامل.',
  intentSubscribe:
    'المسار الموصى: تجربة مجانية → دعوة الفريق → تفعيل الاشتراك.',
  intentCredits: 'الأرصدة مثالية لذروات التحليل. اختر حزمة:',
  intentApi:
    'API: اكتشاف عبر /meta، مصادقة Bearer، نقاط نهاية مرقمة. الروابط الرئيسية:',
  intentSupport: 'صف مشكلتك باختصار — سأوجهك فوراً للفريق المناسب.',
  intentFallback: 'شكراً لسؤالك! هل أقترح أسرع مسار للحل؟',

  btnRequestDemo: 'طلب عرض',
  btnReviewPricing: 'عرض الأسعار',
  btnRegisterFree: 'تسجيل مجاني',
  btnOpenSubAssistant: 'مساعد الاشتراك',
  btnAnnualBestValue: 'سنوي (وفر 20%)',
  btnCredits500: '500 رصيد',
  btnCredits2000: '2,000 رصيد',
  btnApiQuickstart: 'بدء سريع API',
  btnSwaggerDocs: 'Swagger Docs',
  btnGraphql: 'GraphQL Endpoint',
  btnContactSupport: 'اتصل بالدعم',
  btnGoPricing: 'إلى الأسعار',
  btnToCheckout: 'إلى الدفع الآمن',
  btnStartSubAssistant: 'بدء المساعد',

  regComplete: 'تجربتك جاهزة! هل أقترح أفضل اشتراك لك؟',
  subComplete: 'كل شيء جاهز! سأوجهك إلى صفحة الدفع الآمن.',

  footerHint: 'التسجيل والاشتراك مباشرة هنا',

  regWelcomeTitle: 'مرحباً بك في Subsumio!',
  regWelcomeSub: '14 يوماً مجاناً — وصول كامل',
  regPersonalTitle: 'بياناتك',
  regPersonalSub: 'لتقديم أفضل نصيحة',
  regCompanyTitle: 'مكتبك',
  regCompanySub: 'لتجربة مخصصة',
  regUseCaseTitle: 'تقريباً انتهينا!',
  regUseCaseSub: 'ماذا تريد استخدامه أولاً؟',
  regEmail: 'البريد الإلكتروني',
  regFirstName: 'الاسم الأول',
  regLastName: 'اسم العائلة',
  regCompany: 'المكتب / الشركة',
  regTrialBadge: '14 يوماً مجاناً — بدون بطاقة ائتمان',
  regSkip: 'تخطي',
  regNext: 'التالي',
  regStart: 'ابدأ مجاناً',
  regStep: 'خطوة',
  regFeatures: [
    'تحليل المستندات بالذكاء الاصطناعي',
    'مواعيد تلقائية',
    'سحابة آمنة',
    'تعاون الفريق',
  ],
  regUseCases: [
    'تحليل المستندات والبحث',
    'المواعيد والتقويم',
    'استراتيجية القضايا',
    'إدارة العملاء',
    'أخرى',
  ],

  subTitle: 'اختر باقتك',
  subSubtitle: 'أطلق الإمكانات الكاملة لمكتبك',
  subMonthly: 'شهري',
  subAnnual: 'سنوي',
  subSave: 'وفر 20%',
  subPopular: 'الأكثر شعبية',
  subCustom: 'مخصص',
  subPerMonth: '/شهر',
  subStarterName: 'Solo',
  subProName: 'Kanzlei',
  subEnterpriseName: 'Enterprise',
  subStarterCta: 'ابدأ مجاناً',
  subProCta: 'تجربة 14 يوماً',
  subEnterpriseCta: 'اتصل بنا',
  subStarterFeatures: [
    'حتى 3 مستخدمين',
    '100 مستند/شهر',
    'تحليل AI',
    'دعم البريد',
  ],
  subProFeatures: [
    'حتى 10 مستخدمين',
    'مستندات غير محدودة',
    'AI متقدم',
    'إدارة المواعيد',
    'دعم أولوية',
    'وصول API',
  ],
  subEnterpriseFeatures: [
    'مستخدمون غير محدودون',
    'جميع الميزات',
    'مدير مخصص',
    'تكاملات مخصصة',
    'خيار محلي',
    'ضمان SLA',
  ],
  subTrustRefund: 'ضمان 14 يوماً',
  subTrustInstant: 'تفعيل فوري',
  subTrustFirms: '500+ مكتب',
  subDecideLater: 'قرر لاحقاً',
  subStartNow: 'ابدأ الآن',
  subContactUs: 'اتصل بنا',
};

const allStrings: Record<ChatbotLang, ChatbotStrings> = {
  de,
  en,
  fr,
  es,
  it,
  pl,
  pt,
  ja,
  ko,
  ar,
};

export function getChatbotStrings(lang: ChatbotLang): ChatbotStrings {
  return allStrings[lang] ?? en;
}
