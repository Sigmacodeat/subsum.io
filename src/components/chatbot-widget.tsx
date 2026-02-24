'use client';

import {
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  MessageCircle,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ChatbotLang,
  detectChatbotLang,
  getChatbotStrings,
  isRtlLang,
} from '@/components/chatbot-i18n';
import RegistrationFlow from '@/components/registration-flow';
import SubscriptionFlow from '@/components/subscription-flow';
import { PRICING_ROUTES } from '@/content/pricing-offer';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

interface ChatAction {
  id: string;
  label: string;
  type: ActionType;
  value: string;
  primary?: boolean;
}

type Persona = 'visitor' | 'lawyer' | 'jurist';
type Intent =
  | 'demo'
  | 'pricing'
  | 'support'
  | 'register'
  | 'subscribe'
  | 'credits'
  | 'api'
  | 'context-help';
type ActionType = 'intent' | 'navigate' | 'external' | 'set-persona' | 'flow';
type FlowType = 'registration' | 'subscription';

interface PersistedChatSession {
  persona: Persona;
  isOpen: boolean;
  messages: Array<{
    id: string;
    type: 'user' | 'bot';
    content: string;
    timestamp: string;
    actions?: ChatAction[];
  }>;
}

interface ChatbotWidgetProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const PROACTIVE_KEY = 'subsumio-chatbot:last-proactive';
const RETURNING_KEY = 'subsumio-chatbot:visited';
const SESSION_KEY = 'subsumio-chatbot:session:v1';
const MAX_VISIBLE_ACTIONS = 3;
const MAX_SESSION_MESSAGES = 50;

function extractLocale(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? 'de-AT';
}

function inferPageContext(pathname: string): { key: string; intent: Intent } {
  if (pathname.includes('/developers/api'))
    return { key: 'api', intent: 'api' };
  if (pathname.includes('/pricing'))
    return { key: 'pricing', intent: 'subscribe' };
  if (pathname.includes('/tax')) return { key: 'tax', intent: 'demo' };
  if (pathname.includes('/systems'))
    return { key: 'systems', intent: 'register' };
  if (pathname.includes('/security'))
    return { key: 'security', intent: 'demo' };
  if (pathname.includes('/contact'))
    return { key: 'contact', intent: 'support' };
  if (pathname.includes('/features'))
    return { key: 'features', intent: 'demo' };
  if (pathname.includes('/about')) return { key: 'about', intent: 'demo' };
  if (pathname.includes('/docs'))
    return { key: 'docs', intent: 'context-help' };
  if (pathname.includes('/semantic-database'))
    return { key: 'semantic-database', intent: 'demo' };
  if (pathname.includes('/quick-check'))
    return { key: 'quick-check', intent: 'register' };
  if (pathname.includes('/legal'))
    return { key: 'legal', intent: 'context-help' };
  return { key: 'home', intent: 'context-help' };
}

function getPagePrioritizedActions(pageKey: string): Intent[] {
  const map: Record<string, Intent[]> = {
    home: ['context-help', 'demo', 'register'],
    pricing: ['subscribe', 'credits', 'demo'],
    features: ['register', 'demo', 'pricing'],
    tax: ['demo', 'register', 'pricing'],
    security: ['demo', 'register', 'support'],
    contact: ['support', 'demo', 'register'],
    systems: ['register', 'api', 'demo'],
    api: ['api', 'register', 'demo'],
    about: ['demo', 'register', 'pricing'],
    docs: ['context-help', 'register', 'api'],
    'semantic-database': ['demo', 'register', 'pricing'],
    'quick-check': ['register', 'demo', 'pricing'],
    legal: ['context-help', 'support', 'demo'],
  };
  return map[pageKey] ?? ['context-help', 'demo', 'register'];
}

function getPersonaPrioritizedActions(persona: Persona): Intent[] {
  if (persona === 'lawyer') return ['demo', 'api', 'support'];
  if (persona === 'jurist') return ['context-help', 'api', 'credits'];
  return ['register', 'demo', 'pricing'];
}

function getPersonaIntentIntro(
  lang: ChatbotLang,
  persona: Persona,
  intent: Intent
): string {
  if (lang === 'de') {
    if (persona === 'lawyer') {
      if (intent === 'pricing') return 'Für Anwält:innen: ';
      if (intent === 'api') return 'Für Kanzlei-Integrationen: ';
      if (intent === 'demo') return 'Für deinen Kanzlei-Workflow: ';
    }
    if (persona === 'jurist') {
      if (intent === 'context-help') return 'Für juristische Präzision: ';
      if (intent === 'credits') return 'Für Analyse-Spitzen: ';
      if (intent === 'support') return 'Für fachliche Rückfragen: ';
    }
    if (persona === 'visitor') {
      if (intent === 'register') return 'Zum schnellen Start: ';
      if (intent === 'pricing') return 'Kurz & klar: ';
    }
    return '';
  }

  if (persona === 'lawyer') {
    if (intent === 'pricing') return 'For law-firm teams: ';
    if (intent === 'api') return 'For practice integrations: ';
    if (intent === 'demo') return 'For your legal workflow: ';
  }
  if (persona === 'jurist') {
    if (intent === 'context-help') return 'For legal precision: ';
    if (intent === 'credits') return 'For analysis peaks: ';
    if (intent === 'support') return 'For specialist questions: ';
  }
  if (persona === 'visitor') {
    if (intent === 'register') return 'Quick start: ';
    if (intent === 'pricing') return 'Short and clear: ';
  }
  return '';
}

const NLP_RULES: Array<{ pattern: RegExp; intent: Intent }> = [
  {
    pattern:
      /\b(preis|price|prix|precio|prezzo|cena|preco|kosten|cost|tarif)\b/i,
    intent: 'pricing',
  },
  {
    pattern: /\b(demo|vorführung|démo|demostración|dimostrazione)\b/i,
    intent: 'demo',
  },
  {
    pattern:
      /\b(abo|subscription|abonnement|suscripción|abbonamento|subskrypcja|assinatura)\b/i,
    intent: 'subscribe',
  },
  { pattern: /\b(credits?|kredite?|créditos?|crediti)\b/i, intent: 'credits' },
  { pattern: /\b(api|webhook|swagger|graphql|endpoint|sdk)\b/i, intent: 'api' },
  { pattern: /\b(integrat|intégrat|integración|integrazi)/, intent: 'api' },
  {
    pattern: /\b(support|hilfe|aide|ayuda|aiuto|pomoc|ajuda|サポート|지원)\b/i,
    intent: 'support',
  },
  { pattern: /\b(registr|anmeld|inscri|cadastr)/, intent: 'register' },
  {
    pattern:
      /\b(trial|testen|essai|prueba|prova|próba|kostenlos|free|gratis|무료|無料)\b/i,
    intent: 'register',
  },
  { pattern: /\b(token|bearer|auth)\b/i, intent: 'api' },
];

export default function ChatbotWidget({
  isOpen: controlledOpen,
  onToggle,
}: ChatbotWidgetProps) {
  const pathname = usePathname();
  const lang = useMemo<ChatbotLang>(
    () => detectChatbotLang(pathname),
    [pathname]
  );
  const locale = useMemo(() => extractLocale(pathname), [pathname]);
  const pageContext = useMemo(() => inferPageContext(pathname), [pathname]);
  const t = useMemo(() => getChatbotStrings(lang), [lang]);

  const isRtl = useMemo(() => isRtlLang(lang), [lang]);

  const [isOpen, setIsOpen] = useState(controlledOpen || false);
  const [persona, setPersona] = useState<Persona>('visitor');
  const [nudgeText, setNudgeText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeFlow, setActiveFlow] = useState<FlowType | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [expandedActions, setExpandedActions] = useState<
    Record<string, boolean>
  >({});
  const [isAnimatingOpen, setIsAnimatingOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [restoredFromSession, setRestoredFromSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledOpen !== undefined;
  const currentIsOpen = isControlled ? controlledOpen : isOpen;

  const isReturningVisitor = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const visited = window.localStorage.getItem(RETURNING_KEY);
    if (!visited) {
      window.localStorage.setItem(RETURNING_KEY, String(Date.now()));
      return false;
    }
    return true;
  }, []);

  const localizedHref = useCallback(
    (target: string) => {
      if (target.startsWith('http')) return target;
      return `/${locale}${target}`;
    },
    [locale]
  );

  const enqueueBotMessage = useCallback(
    (content: string, actions?: ChatAction[]) => {
      setIsTyping(true);
      const delay = 400 + Math.random() * 300;
      window.setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'bot',
            content,
            timestamp: new Date(),
            actions,
          },
        ]);
        setIsTyping(false);
      }, delay);
    },
    []
  );

  const buildRolePrompt = useCallback(
    (): ChatAction[] => [
      {
        id: 'persona-visitor',
        label: t.roleVisitor,
        type: 'set-persona',
        value: 'visitor',
      },
      {
        id: 'persona-lawyer',
        label: t.roleLawyer,
        type: 'set-persona',
        value: 'lawyer',
        primary: true,
      },
      {
        id: 'persona-jurist',
        label: t.roleJurist,
        type: 'set-persona',
        value: 'jurist',
      },
    ],
    [t]
  );

  const intentToAction = useCallback(
    (intent: Intent): ChatAction => {
      const map: Record<Intent, { label: string; primary?: boolean }> = {
        'context-help': { label: t.actionContextHelp },
        demo: { label: t.actionDemo, primary: true },
        pricing: { label: t.actionPricing },
        register: { label: t.actionFreeTrial, primary: true },
        subscribe: { label: t.actionSubscribe, primary: true },
        credits: { label: t.actionCredits },
        api: { label: t.actionApi },
        support: { label: t.actionSupport },
      };
      const entry = map[intent];
      return {
        id: `a-${intent}`,
        label: entry.label,
        type: 'intent',
        value: intent,
        primary: entry.primary,
      };
    },
    [t]
  );

  const buildSmartActions = useCallback((): ChatAction[] => {
    const personaPriorities = getPersonaPrioritizedActions(persona);
    const priorities = getPagePrioritizedActions(pageContext.key);
    const allIntents: Intent[] = [
      'context-help',
      'demo',
      'pricing',
      'register',
      'subscribe',
      'credits',
      'api',
      'support',
    ];
    const ordered = [
      ...personaPriorities,
      ...priorities,
      ...allIntents.filter(
        i => !priorities.includes(i) && !personaPriorities.includes(i)
      ),
    ];
    const unique = [...new Set(ordered)];
    return unique.map((intent, idx) => ({
      ...intentToAction(intent),
      primary: idx === 0,
    }));
  }, [intentToAction, pageContext.key, persona]);

  const buildIntentActions = useCallback(
    (intent: Intent): ChatAction[] => {
      const contactAction: ChatAction = {
        id: 'cta-contact',
        label: t.btnRequestDemo,
        type: 'navigate',
        value: '/contact',
        primary: true,
      };
      const supportContact: ChatAction = {
        id: 'cta-support',
        label: t.btnContactSupport,
        type: 'navigate',
        value: '/contact',
        primary: true,
      };
      const pricingPage: ChatAction = {
        id: 'cta-pricing',
        label: t.btnGoPricing,
        type: 'navigate',
        value: PRICING_ROUTES.root,
        primary: true,
      };
      const openRegister: ChatAction = {
        id: 'cta-register',
        label: t.btnRegisterFree,
        type: 'flow',
        value: 'registration',
        primary: true,
      };
      const openSubscribe: ChatAction = {
        id: 'cta-subscribe',
        label: t.btnOpenSubAssistant,
        type: 'flow',
        value: 'subscription',
        primary: true,
      };
      const apiGuide: ChatAction = {
        id: 'cta-api-guide',
        label: t.btnApiQuickstart,
        type: 'navigate',
        value: '/developers/api',
        primary: true,
      };
      const apiSwagger: ChatAction = {
        id: 'cta-api-swagger',
        label: t.btnSwaggerDocs,
        type: 'external',
        value: 'https://api.subsum.io/api/docs',
      };
      const apiGraphql: ChatAction = {
        id: 'cta-api-graphql',
        label: t.btnGraphql,
        type: 'external',
        value: 'https://api.subsum.io/graphql',
      };

      if (intent === 'demo') {
        if (persona === 'lawyer') {
          return [
            {
              ...contactAction,
              id: 'demo-contact',
              label: t.btnRequestDemo,
              primary: true,
            },
            { ...apiGuide, id: 'demo-api', primary: false },
            {
              id: 'demo-pricing',
              label: t.btnReviewPricing,
              type: 'navigate',
              value: PRICING_ROUTES.root,
            },
          ];
        }
        if (persona === 'jurist') {
          return [
            {
              ...contactAction,
              id: 'demo-contact',
              label: t.btnRequestDemo,
              primary: true,
            },
            {
              ...pricingPage,
              id: 'demo-pricing',
              label: t.btnReviewPricing,
              primary: false,
            },
            { ...openRegister, id: 'demo-register', primary: false },
          ];
        }
        return [
          {
            ...contactAction,
            id: 'demo-contact',
            label: t.btnRequestDemo,
            primary: true,
          },
          {
            id: 'demo-pricing',
            label: t.btnReviewPricing,
            type: 'navigate',
            value: PRICING_ROUTES.root,
          },
        ];
      }

      if (intent === 'pricing') {
        if (persona === 'lawyer') {
          return [
            { ...pricingPage, id: 'pricing-page', primary: true },
            { ...apiGuide, id: 'pricing-api', primary: false },
            {
              id: 'pricing-demo',
              label: t.btnRequestDemo,
              type: 'navigate',
              value: '/contact',
            },
          ];
        }
        if (persona === 'jurist') {
          return [
            { ...pricingPage, id: 'pricing-page', primary: true },
            {
              id: 'pricing-credits',
              label: t.actionCredits,
              type: 'intent',
              value: 'credits',
            },
            {
              id: 'pricing-subscribe',
              label: t.actionSubscribe,
              type: 'intent',
              value: 'subscribe',
            },
          ];
        }
        return [
          { ...pricingPage, id: 'pricing-page', primary: true },
          {
            id: 'pricing-subscribe',
            label: t.actionSubscribe,
            type: 'intent',
            value: 'subscribe',
          },
          {
            id: 'pricing-register',
            label: t.actionFreeTrial,
            type: 'intent',
            value: 'register',
          },
        ];
      }

      if (intent === 'register') {
        if (persona === 'lawyer') {
          return [
            { ...openRegister, id: 'register-go', primary: true },
            {
              id: 'register-pricing',
              label: t.btnReviewPricing,
              type: 'navigate',
              value: PRICING_ROUTES.root,
            },
          ];
        }
        return [{ ...openRegister, id: 'register-go', primary: true }];
      }

      if (intent === 'subscribe') {
        if (persona === 'lawyer') {
          return [
            { ...openSubscribe, id: 'sub-open-flow', primary: true },
            {
              id: 'sub-pricing',
              label: t.btnGoPricing,
              type: 'navigate',
              value: PRICING_ROUTES.chatbotSource,
            },
            {
              id: 'sub-contact',
              label: t.btnRequestDemo,
              type: 'navigate',
              value: '/contact',
            },
          ];
        }
        return [
          { ...openSubscribe, id: 'sub-open-flow', primary: true },
          {
            id: 'sub-yearly',
            label: t.btnAnnualBestValue,
            type: 'navigate',
            value: PRICING_ROUTES.chatbotYearly,
          },
        ];
      }

      if (intent === 'credits') {
        if (persona === 'jurist') {
          return [
            {
              id: 'credits-500',
              label: t.btnCredits500,
              type: 'navigate',
              value: PRICING_ROUTES.chatbotCredits500,
              primary: true,
            },
            {
              id: 'credits-2000',
              label: t.btnCredits2000,
              type: 'navigate',
              value: PRICING_ROUTES.chatbotCredits2000,
            },
            {
              id: 'credits-pricing',
              label: t.btnGoPricing,
              type: 'navigate',
              value: PRICING_ROUTES.chatbotSource,
            },
          ];
        }
        return [
          {
            id: 'credits-500',
            label: t.btnCredits500,
            type: 'navigate',
            value: PRICING_ROUTES.chatbotCredits500,
            primary: true,
          },
          {
            id: 'credits-2000',
            label: t.btnCredits2000,
            type: 'navigate',
            value: PRICING_ROUTES.chatbotCredits2000,
          },
        ];
      }

      if (intent === 'api') {
        if (persona === 'lawyer') {
          return [
            { ...apiGuide, id: 'api-guide', primary: true },
            {
              id: 'api-contact',
              label: t.btnRequestDemo,
              type: 'navigate',
              value: '/contact',
            },
            apiSwagger,
          ];
        }
        return [
          { ...apiGuide, id: 'api-guide', primary: true },
          apiSwagger,
          apiGraphql,
        ];
      }

      if (intent === 'support') {
        if (persona === 'lawyer') {
          return [
            { ...supportContact, id: 'support-contact', primary: true },
            {
              id: 'support-api',
              label: t.btnApiQuickstart,
              type: 'navigate',
              value: '/developers/api',
            },
          ];
        }
        return [{ ...supportContact, id: 'support-contact', primary: true }];
      }

      return buildSmartActions();
    },
    [buildSmartActions, persona, t]
  );

  const handleIntent = useCallback(
    (intent: Intent) => {
      const withPersona = (base: string, targetIntent: Intent) =>
        `${getPersonaIntentIntro(lang, persona, targetIntent)}${base}`;

      if (intent === 'context-help') {
        const contextMsg =
          t.intentContextHelp[pageContext.key] ?? t.intentContextHelp.home;
        enqueueBotMessage(
          withPersona(contextMsg, 'context-help'),
          buildSmartActions()
        );
        return;
      }

      if (intent === 'demo') {
        enqueueBotMessage(
          withPersona(t.intentDemo, 'demo'),
          buildIntentActions('demo')
        );
        return;
      }

      if (intent === 'pricing') {
        enqueueBotMessage(
          withPersona(t.intentPricing, 'pricing'),
          buildIntentActions('pricing')
        );
        return;
      }

      if (intent === 'register') {
        enqueueBotMessage(
          withPersona(t.intentRegister, 'register'),
          buildIntentActions('register')
        );
        return;
      }

      if (intent === 'subscribe') {
        enqueueBotMessage(
          withPersona(t.intentSubscribe, 'subscribe'),
          buildIntentActions('subscribe')
        );
        return;
      }

      if (intent === 'credits') {
        enqueueBotMessage(
          withPersona(t.intentCredits, 'credits'),
          buildIntentActions('credits')
        );
        return;
      }

      if (intent === 'api') {
        enqueueBotMessage(
          withPersona(t.intentApi, 'api'),
          buildIntentActions('api')
        );
        return;
      }

      enqueueBotMessage(
        withPersona(t.intentSupport, 'support'),
        buildIntentActions('support')
      );
    },
    [
      buildIntentActions,
      buildSmartActions,
      enqueueBotMessage,
      lang,
      pageContext.key,
      persona,
      t,
    ]
  );

  const handleAction = useCallback(
    (action: ChatAction) => {
      setHasInteracted(true);

      if (action.type === 'set-persona') {
        const selected = action.value as Persona;
        setPersona(selected);
        const personaConfirm =
          selected === 'lawyer'
            ? t.roleConfirmLawyer
            : selected === 'jurist'
              ? t.roleConfirmJurist
              : t.roleConfirmVisitor;
        enqueueBotMessage(personaConfirm, buildSmartActions());
        return;
      }

      if (action.type === 'intent') {
        handleIntent(action.value as Intent);
        return;
      }

      if (action.type === 'navigate') {
        window.location.assign(localizedHref(action.value));
        return;
      }

      if (action.type === 'flow') {
        setActiveFlow(action.value as FlowType);
        return;
      }

      window.open(
        action.value.startsWith('http')
          ? action.value
          : localizedHref(action.value),
        '_blank',
        'noopener,noreferrer'
      );
    },
    [buildSmartActions, enqueueBotMessage, handleIntent, localizedHref, t]
  );

  const onRegistrationComplete = useCallback(() => {
    setActiveFlow(null);
    enqueueBotMessage(t.regComplete, [
      {
        id: 'after-reg-sub',
        label: t.btnStartSubAssistant,
        type: 'flow',
        value: 'subscription',
        primary: true,
      },
    ]);
  }, [enqueueBotMessage, t]);

  const onSubscriptionComplete = useCallback(() => {
    setActiveFlow(null);
    enqueueBotMessage(t.subComplete, [
      {
        id: 'final-checkout',
        label: t.btnToCheckout,
        type: 'navigate',
        value: PRICING_ROUTES.chatbotCheckout,
        primary: true,
      },
    ]);
  }, [enqueueBotMessage, t]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedChatSession;
      if (
        !parsed ||
        !Array.isArray(parsed.messages) ||
        parsed.messages.length === 0
      ) {
        setIsHydrated(true);
        return;
      }

      const safePersona: Persona =
        parsed.persona === 'lawyer' ||
        parsed.persona === 'jurist' ||
        parsed.persona === 'visitor'
          ? parsed.persona
          : 'visitor';

      const restoredMessages: Message[] = parsed.messages
        .slice(-MAX_SESSION_MESSAGES)
        .map(msg => ({
          id: msg.id,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          actions: msg.actions,
        }));

      setMessages(restoredMessages);
      setPersona(safePersona);
      if (!isControlled) setIsOpen(Boolean(parsed.isOpen));
      setHasInteracted(restoredMessages.some(msg => msg.type === 'user'));
      setRestoredFromSession(true);
    } catch {
      // ignore invalid persisted payload
    } finally {
      setIsHydrated(true);
    }
  }, [isControlled]);

  useEffect(() => {
    if (!isHydrated) return;
    const payload: PersistedChatSession = {
      persona,
      isOpen: currentIsOpen,
      messages: messages.slice(-MAX_SESSION_MESSAGES).map(msg => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        actions: msg.actions,
      })),
    };
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }, [currentIsOpen, isHydrated, messages, persona]);

  useEffect(() => {
    if (!isHydrated || restoredFromSession) return;
    const pageLabel = t.pageLabels[pageContext.key] ?? '';
    const welcomeMsg = isReturningVisitor
      ? t.welcomeReturningPage.replace('{page}', pageLabel)
      : t.welcomePage.replace('{page}', pageLabel);
    setMessages([
      {
        id: 'boot',
        type: 'bot',
        content: welcomeMsg,
        timestamp: new Date(),
        actions: buildRolePrompt(),
      },
    ]);
    setHasInteracted(false);
    setNudgeText('');
    setExpandedActions({});
  }, [
    buildRolePrompt,
    isHydrated,
    isReturningVisitor,
    pageContext.key,
    pathname,
    restoredFromSession,
    t,
  ]);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === '#chat-support') {
        setIsOpen(true);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  useEffect(() => {
    const lastNudge = Number(window.localStorage.getItem(PROACTIVE_KEY) ?? 0);
    const now = Date.now();
    const isCooldown = now - lastNudge < 1000 * 60 * 20;
    if (currentIsOpen || isCooldown) return;

    const nudgeTimer = window.setTimeout(() => {
      const pageNudge = t.nudges[pageContext.key] ?? t.nudges.default;
      setNudgeText(pageNudge);
      window.localStorage.setItem(PROACTIVE_KEY, String(Date.now()));
    }, 10000);

    return () => window.clearTimeout(nudgeTimer);
  }, [currentIsOpen, pageContext.key, t.nudges]);

  useEffect(() => {
    if (!currentIsOpen || hasInteracted) return;
    const proactiveTimer = window.setTimeout(() => {
      handleIntent(pageContext.intent);
    }, 6000);
    return () => window.clearTimeout(proactiveTimer);
  }, [currentIsOpen, handleIntent, hasInteracted, pageContext.intent]);

  useEffect(() => {
    if (!currentIsOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleToggle();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [currentIsOpen]);

  useEffect(() => {
    if (currentIsOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [currentIsOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentIsOpen || window.innerWidth >= 640) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [currentIsOpen]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setHasInteracted(true);

    const normalized = userMessage.content.toLowerCase();

    for (const rule of NLP_RULES) {
      if (rule.pattern.test(normalized)) {
        handleIntent(rule.intent);
        return;
      }
    }

    enqueueBotMessage(t.intentFallback, buildSmartActions());
  };

  const handleToggle = () => {
    if (isControlled && onToggle) {
      onToggle();
    } else {
      if (!currentIsOpen) {
        setIsAnimatingOpen(true);
        setIsOpen(true);
        window.setTimeout(() => setIsAnimatingOpen(false), 350);
      } else {
        setIsOpen(false);
      }
    }
    if (!currentIsOpen) setNudgeText('');
  };

  const toggleActionsExpand = (messageId: string) => {
    setExpandedActions(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  if (!currentIsOpen) {
    return (
      <div
        data-subsumio-chatbot="1"
        className={`fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 ${isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'}`}
      >
        {nudgeText && (
          <div className="animate-fadeIn relative mr-1 max-w-[min(78vw,18rem)] rounded-xl bg-slate-900 px-3.5 py-2 text-[13px] leading-snug text-white shadow-lg sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm">
            {nudgeText}
            <div className="absolute -bottom-1.5 right-5 h-3 w-3 rotate-45 bg-slate-900" />
          </div>
        )}
        <button
          onClick={handleToggle}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-cyan-600 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl sm:h-16 sm:w-16"
          aria-label={t.open}
        >
          <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110 sm:h-7 sm:w-7" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={t.close}
        className="fixed inset-0 top-14 z-40 bg-slate-950/18 backdrop-blur-[1px] sm:hidden"
      />

      <section
        data-subsumio-chatbot="1"
        className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/98 shadow-[0_22px_60px_rgba(15,23,42,0.24)] backdrop-blur-lg transition-all duration-300 ${
          isAnimatingOpen ? 'animate-slideUpFade' : ''
        } ${isRtl ? 'left-3 sm:left-6 sm:right-auto' : 'right-3 sm:right-6 sm:left-auto'} left-3 top-[calc(3.5rem+0.5rem)] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:top-auto sm:bottom-6 sm:h-[min(82vh,700px)] sm:w-[min(96vw,420px)] sm:rounded-2xl sm:border sm:border-slate-200`}
        dir={isRtl ? 'rtl' : 'ltr'}
        aria-label={t.botName}
        role="dialog"
        aria-modal="true"
      >
      <div className="flex items-center justify-between bg-gradient-to-r from-primary-600 via-sky-600 to-cyan-600 p-3.5 text-white sm:rounded-t-2xl sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold sm:text-base">{t.botName}</h3>
            <p className="flex items-center gap-1.5 text-xs text-white/80">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              {t.status}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          aria-label={t.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3.5 py-1.5 text-[11px] text-slate-600 sm:px-4 sm:text-xs">
        <Globe className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" />
        <span className="font-medium text-primary-600">{t.contextActive}:</span>
        <span>{t.pageLabels[pageContext.key] ?? pageContext.key}</span>
      </div>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-3.5 space-y-3 sm:p-4 sm:space-y-4">
        <div className="mb-2 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
            <Zap className="h-3 w-3" />
            {t.socialProof}
          </span>
        </div>

        {messages.map(message => (
          <div
            key={message.id}
            className={`flex gap-2.5 animate-fadeIn ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.type === 'bot' && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-cyan-600">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[82%] ${message.type === 'user' ? 'order-first' : ''}`}
            >
              <div
                className={`rounded-2xl p-3 ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-primary-600 to-cyan-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-800 shadow-sm'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
              {message.actions && message.actions.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {message.actions
                    .slice(
                      0,
                      expandedActions[message.id]
                        ? undefined
                        : MAX_VISIBLE_ACTIONS
                    )
                    .map(action => (
                      <button
                        key={action.id}
                        onClick={() => handleAction(action)}
                        className={`flex w-full items-center gap-2 rounded-xl p-2.5 text-left text-sm transition-all ${
                          action.primary
                            ? 'bg-gradient-to-r from-primary-600 to-cyan-600 font-medium text-white shadow-md hover:shadow-lg'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        <span className="flex-1">{action.label}</span>
                        {action.type === 'external' && (
                          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                        )}
                      </button>
                    ))}
                  {message.actions.length > MAX_VISIBLE_ACTIONS && (
                    <button
                      onClick={() => toggleActionsExpand(message.id)}
                      className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-slate-500 transition-colors hover:text-primary-600"
                    >
                      {expandedActions[message.id] ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          {t.showLess}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          {t.showMore} (
                          {message.actions.length - MAX_VISIBLE_ACTIONS})
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
              <p className="mt-1 px-1 text-xs text-slate-400">
                {message.timestamp.toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            {message.type === 'user' && (
              <div className="order-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200">
                <User className="h-4 w-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2.5 justify-start animate-fadeIn">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-cyan-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-primary-400"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-primary-400"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-primary-400"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:p-4 sm:pb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={t.placeholder}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-cyan-600 text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t.send}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            {t.poweredBy}
          </span>
          <span>{t.footerHint}</span>
        </div>
      </div>

      {activeFlow && (
        <div className="absolute inset-0 z-20 flex items-end justify-center rounded-2xl bg-slate-950/40 p-3 backdrop-blur-sm sm:p-4">
          {activeFlow === 'registration' ? (
            <RegistrationFlow
              lang={lang}
              onComplete={onRegistrationComplete}
              onSkip={() => setActiveFlow(null)}
            />
          ) : (
            <SubscriptionFlow
              lang={lang}
              onComplete={onSubscriptionComplete}
              onSkip={() => setActiveFlow(null)}
            />
          )}
        </div>
      )}
      </section>
    </>
  );
}
