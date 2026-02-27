'use client';

import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Crown,
  FileCheck2,
  HelpCircle,
  Info,
  Minus,
  Plus,
  Quote,
  RotateCcw,
  Scale,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  FloatingParticles,
  GlowCard,
  GradientBlob,
  MagneticButton,
  Parallax,
  ScrollLightSweep,
  ScrollProgressBar,
  ScrollReveal,
  TextRevealByWord,
} from '@/components/animations';
import { PrefooterCta } from '@/components/prefooter-cta';
import { Link } from '@/i18n/routing';

export default function PricingContent() {
  const t = useTranslations('pricing');
  const tCta = useTranslations('cta');
  const tTest = useTranslations('testimonials');
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <ScrollProgressBar />
      <HeroSection t={t} yearly={yearly} setYearly={setYearly} />
      <SocialProofLogosSection t={t} />
      <PricingCardsSection t={t} yearly={yearly} />
      <MoneyBackBanner t={t} />
      <TrustBadgesSection t={t} />
      <PlanQuizSection t={t} />
      <InteractiveRoiCalculator t={t} />
      <ComparisonTableSection t={t} />
      <TestimonialCarouselSection t={t} tTestimonials={tTest} />
      <AddonsSection t={t} />
      <AffiliateSection />
      <FaqSection t={t} />
      <StickyCtaBar t={t} />
      <CtaSection t={tCta} />
    </>
  );
}

function AffiliateSection() {
  const t = useTranslations('pricing');

  return (
    <section className="section-padding bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-950 text-white relative overflow-hidden">
      <div className="container-wide">
        <ScrollReveal direction="up" distance={25}>
          <div className="max-w-4xl mx-auto rounded-3xl border border-white/20 bg-white/10 p-8 md:p-12 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/20 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              {t('affiliateBadge')}
            </div>
            <h3 className="mt-5 text-3xl md:text-4xl font-extrabold text-balance">
              {t('affiliateTitle')}
            </h3>
            <p className="mt-4 text-lg text-emerald-50/90">
              {t('affiliateDescription')}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-wide text-emerald-200">
                  {t('affiliateCard1Label')}
                </div>
                <div className="text-2xl font-bold">
                  {t('affiliateCard1Value')}
                </div>
                <div className="text-sm text-emerald-100/80">
                  {t('affiliateCard1Desc')}
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-wide text-emerald-200">
                  {t('affiliateCard2Label')}
                </div>
                <div className="text-2xl font-bold">
                  {t('affiliateCard2Value')}
                </div>
                <div className="text-sm text-emerald-100/80">
                  {t('affiliateCard2Desc')}
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-wide text-emerald-200">
                  {t('affiliateCard3Label')}
                </div>
                <div className="text-2xl font-bold">
                  {t('affiliateCard3Value')}
                </div>
                <div className="text-sm text-emerald-100/80">
                  {t('affiliateCard3Desc')}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Link
                href="/contact?subject=subjectPartnership#contact-form"
                className="btn-accent w-full sm:w-auto justify-center !bg-emerald-400 !text-emerald-950 hover:!bg-emerald-300 focus-visible:!ring-2 focus-visible:!ring-white/70 focus-visible:!ring-offset-2 focus-visible:!ring-offset-emerald-950"
              >
                {t('affiliatePrimaryCta')}{' '}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link
                href="#faq"
                className="btn-secondary w-full sm:w-auto justify-center !bg-transparent !border-white/40 !text-white hover:!bg-white/15 active:!bg-white/20 focus-visible:!ring-2 focus-visible:!ring-white/70 focus-visible:!ring-offset-2 focus-visible:!ring-offset-emerald-950"
              >
                {t('affiliateSecondaryCta')}
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function HeroSection({
  t,
  yearly,
  setYearly,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
  yearly: boolean;
  setYearly: (v: boolean) => void;
}) {
  return (
    <section className="relative pt-28 pb-12 sm:pt-32 lg:pt-40 lg:pb-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
      <Parallax speed={0.05} className="absolute inset-0">
        <div className="absolute inset-0 grid-pattern" />
      </Parallax>
      <ScrollLightSweep className="absolute inset-0" intensity={0.18} />
      <FloatingParticles
        count={4}
        colors={['bg-primary-400/8', 'bg-cyan-400/8', 'bg-sky-300/6']}
      />
      <Parallax speed={0.03} className="absolute inset-0">
        <GradientBlob
          className="-top-40 right-0 animate-breathe"
          size={500}
          colors={['#1E40AF', '#0E7490', '#dbeafe']}
        />
      </Parallax>
      <Parallax speed={0.06} className="absolute inset-0">
        <GradientBlob
          className="-bottom-40 -left-40"
          size={350}
          colors={['#0E7490', '#1E40AF', '#ecfeff']}
        />
      </Parallax>
      <div className="container-wide text-center relative">
        <ScrollReveal delay={100} direction="up" distance={18}>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-primary-700/90 mb-4">
            {t('label')}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-50 border border-accent-100 text-accent-700 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 animate-pulse-slow" />
            {t('guaranteed')}
          </div>
        </ScrollReveal>
        <ScrollReveal delay={200} direction="up" distance={26}>
          <TextRevealByWord
            text={t('pageTitle')}
            tag="h1"
            staggerMs={44}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 text-balance leading-[1.08]"
          />
        </ScrollReveal>
        <ScrollReveal delay={320} direction="up" distance={16}>
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto mb-10 text-balance">
            {t('pageSubtitle')}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={420} direction="up" distance={15}>
          <BillingToggle yearly={yearly} setYearly={setYearly} t={t} />
          {yearly && (
            <p className="mt-4 text-sm font-medium text-primary-700 animate-fade-in">
              {t('yearlyBadge')}
            </p>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}

/* ─── Animated Sliding-Pill Billing Toggle ─── */
function BillingToggle({
  yearly,
  setYearly,
  t,
}: {
  yearly: boolean;
  setYearly: (v: boolean) => void;
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const monthlyRef = useRef<HTMLButtonElement>(null);
  const yearlyRef = useRef<HTMLButtonElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const updatePill = useCallback(() => {
    const activeRef = yearly ? yearlyRef : monthlyRef;
    const container = containerRef.current;
    const btn = activeRef.current;
    if (!container || !btn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPillStyle({ left: bRect.left - cRect.left, width: bRect.width });
  }, [yearly]);

  useEffect(() => {
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center gap-1 p-1.5 bg-slate-100 rounded-full"
      role="radiogroup"
      aria-label={t('billingAriaLabel')}
    >
      {/* Sliding pill indicator */}
      <div
        className="absolute top-1.5 h-[calc(100%-12px)] bg-white rounded-full shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"
        style={{ left: pillStyle.left, width: pillStyle.width }}
      />
      <button
        ref={monthlyRef}
        onClick={() => setYearly(false)}
        role="radio"
        aria-checked={!yearly}
        className={`relative z-10 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors duration-300 ${!yearly ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
      >
        {t('monthly')}
      </button>
      <button
        ref={yearlyRef}
        onClick={() => setYearly(true)}
        role="radio"
        aria-checked={yearly}
        className={`relative z-10 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors duration-300 flex items-center gap-2 ${yearly ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
      >
        {t('yearly')}
        <span className="px-2 py-0.5 bg-accent-100 text-accent-700 text-xs font-bold rounded-full">
          {t('yearlyDiscount')}
        </span>
      </button>
    </div>
  );
}

/* ─── Animated Number (spring-like price transition) ─── */
function AnimatedPrice({
  value,
  prefix = '€',
  suffix = '',
}: {
  value: string;
  prefix?: string;
  suffix?: string;
}) {
  const num = Number(value);
  const isNumeric = !Number.isNaN(num) && value.trim() !== '';
  const [displayed, setDisplayed] = useState(num);
  const prevRef = useRef(num);

  useEffect(() => {
    if (!isNumeric) return;
    const from = prevRef.current;
    const to = num;
    prevRef.current = to;
    if (from === to) return;
    const duration = 500;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Spring-like easeOutBack
      const t = 1 - Math.pow(1 - progress, 3);
      const overshoot =
        progress < 1 ? 1 + 0.08 * Math.sin(progress * Math.PI * 2) : 1;
      setDisplayed(from + (to - from) * t * overshoot);
      if (progress < 1) requestAnimationFrame(step);
      else setDisplayed(to);
    };
    requestAnimationFrame(step);
  }, [num, isNumeric]);

  if (!isNumeric) return <span>{value}</span>;
  return (
    <span>
      {prefix}
      {Math.round(displayed)}
      {suffix}
    </span>
  );
}

function PricingCardsSection({
  t,
  yearly,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
  yearly: boolean;
}) {
  const soloFeats = Array.from({ length: 10 }, (_, i) => `soloFeature${i + 1}`);
  const kanzleiFeats = Array.from(
    { length: 14 },
    (_, i) => `kanzleiFeature${i + 1}`
  );
  const businessFeats = Array.from(
    { length: 15 },
    (_, i) => `businessFeature${i + 1}`
  );
  const entFeats = Array.from(
    { length: 12 },
    (_, i) => `enterpriseFeature${i + 1}`
  );

  const plans = [
    {
      name: t('soloName'),
      desc: t('soloDesc'),
      price: yearly ? t('soloPriceYearly') : t('soloPrice'),
      monthlyPrice: t('soloPrice'),
      yearlyPrice: t('soloPriceYearly'),
      valueProp: t('soloValueProp'),
      tokens: t('soloTokensMonth'),
      features: soloFeats,
      cta: t('ctaSolo'),
      ctaHref: 'https://app.subsum.io/sign-in?redirect_uri=%2F&intent=signup',
      icon: Users,
      maxUsers: 1,
      highlighted: false,
      badge: null,
      includes: null,
      btnClass: 'btn-secondary',
      iconClass: 'bg-slate-100 text-slate-700',
    },
    {
      name: t('kanzleiName'),
      desc: t('kanzleiDesc'),
      price: yearly ? t('kanzleiPriceYearly') : t('kanzleiPrice'),
      monthlyPrice: t('kanzleiPrice'),
      yearlyPrice: t('kanzleiPriceYearly'),
      valueProp: t('kanzleiValueProp'),
      tokens: t('kanzleiTokensMonth'),
      features: kanzleiFeats,
      cta: t('ctaKanzlei'),
      ctaHref: 'https://app.subsum.io/sign-in?redirect_uri=%2F&intent=signup',
      icon: Building2,
      maxUsers: 10,
      highlighted: true,
      badge: t('popular'),
      includes: t('kanzleiIncludes'),
      btnClass: 'btn-primary',
      iconClass: 'bg-primary-100 text-primary-700',
    },
    {
      name: t('businessName'),
      desc: t('businessDesc'),
      price: yearly ? t('businessPriceYearly') : t('businessPrice'),
      monthlyPrice: t('businessPrice'),
      yearlyPrice: t('businessPriceYearly'),
      valueProp: t('businessValueProp'),
      tokens: t('businessTokensMonth'),
      features: businessFeats,
      cta: t('ctaBusiness'),
      ctaHref: 'https://app.subsum.io/sign-in?redirect_uri=%2F&intent=signup',
      icon: TrendingUp,
      maxUsers: 50,
      highlighted: false,
      badge: t('bestValue'),
      includes: t('businessIncludes'),
      btnClass: 'btn-secondary',
      iconClass: 'bg-cyan-100 text-cyan-700',
    },
    {
      name: t('enterpriseName'),
      desc: t('enterpriseDesc'),
      price: t('enterprisePrice'),
      monthlyPrice: t('enterprisePrice'),
      yearlyPrice: t('enterprisePrice'),
      valueProp: t('enterpriseValueProp'),
      tokens: t('enterpriseTokensMonth'),
      features: entFeats,
      cta: t('ctaEnterprise'),
      ctaHref: '/contact',
      icon: Crown,
      maxUsers: null,
      highlighted: false,
      badge: null,
      includes: t('enterpriseIncludes'),
      btnClass: 'btn-secondary',
      iconClass: 'bg-amber-100 text-amber-700',
      isCustom: true,
    },
  ];

  const pricePerSeatLabel = (
    price: string,
    maxUsers: number | null,
    isCustom?: boolean
  ) => {
    if (isCustom || !maxUsers || Number.isNaN(Number(price))) {
      return null;
    }
    const perSeat = Math.round((Number(price) / maxUsers) * 10) / 10;
    return `€${perSeat} ${t('perUser')}`;
  };

  return (
    <section className="section-padding bg-white !pt-16 lg:!pt-20 xl:!pt-24">
      <div className="container-wide">
        <div className="text-center mb-10">
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] font-semibold text-slate-500">
            {t('title')}
          </p>
        </div>
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 xl:gap-7 max-w-7xl mx-auto items-stretch">
          {plans.map((plan, idx) => {
            const isCustom = 'isCustom' in plan && plan.isCustom;
            const monthlyNum = Number(plan.monthlyPrice);
            const yearlyNum = Number(plan.yearlyPrice);
            const savingPct =
              !isCustom &&
              !Number.isNaN(monthlyNum) &&
              !Number.isNaN(yearlyNum) &&
              monthlyNum > 0
                ? Math.round((1 - yearlyNum / monthlyNum) * 100)
                : 0;

            return (
              <ScrollReveal
                key={plan.name}
                delay={idx * 80}
                direction="up"
                distance={20}
              >
                <GlowCard
                  glowColor={
                    plan.highlighted
                      ? 'rgba(30,64,175,0.12)'
                      : 'rgba(30,64,175,0.06)'
                  }
                  className="h-full"
                >
                  <div
                    className={`glass-card p-6 sm:p-7 pt-10 flex flex-col min-h-full relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      plan.highlighted
                        ? 'ring-2 ring-primary-600 shadow-xl z-10 xl:-translate-y-1'
                        : ''
                    }`}
                  >
                    {plan.badge && (
                      <div
                        className={`absolute top-2 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 text-white text-[11px] sm:text-xs font-bold rounded-full text-center leading-tight max-w-[calc(100%-1.5rem)] ${
                          plan.highlighted ? 'bg-primary-600' : 'bg-accent-600'
                        }`}
                      >
                        {plan.badge}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.iconClass}`}
                      >
                        <plan.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {plan.name}
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-slate-500 mb-4 min-h-[44px]">
                      {plan.desc}
                    </p>

                    {/* Value proposition */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-50 text-accent-700 rounded-lg text-xs font-semibold w-fit">
                        <Zap className="w-3.5 h-3.5" />
                        {plan.valueProp}
                      </div>
                      <div
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold w-fit"
                        title={t('creditsTooltip')}
                      >
                        {plan.tokens}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 mt-0 mb-4">
                      <span>{t('fairUseNote')} </span>
                      <a
                        href="#faq"
                        className="font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2"
                      >
                        {t('fairUseLink')}
                      </a>
                    </div>

                    {/* Price with spring animation */}
                    <div className="mb-1.5">
                      {isCustom ? (
                        <span className="text-4xl font-extrabold text-slate-900">
                          {plan.price}
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold text-slate-900">
                            <AnimatedPrice value={plan.price} />
                          </span>
                          <span className="text-slate-500 text-sm ml-1">
                            {t('perMonth')}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs text-slate-400">
                        {isCustom
                          ? '\u00A0'
                          : yearly
                            ? t('perYearBilled')
                            : t('perMonthBilled')}
                      </p>
                      {yearly && savingPct > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200 animate-fade-in">
                          <TrendingUp className="w-3 h-3" />
                          {t('savedPercent', { pct: savingPct })}
                        </span>
                      )}
                    </div>
                    {pricePerSeatLabel(plan.price, plan.maxUsers, isCustom) && (
                      <p className="text-xs font-medium text-slate-500 mb-5">
                        {pricePerSeatLabel(plan.price, plan.maxUsers, isCustom)}
                      </p>
                    )}

                    {/* Includes note */}
                    {plan.includes && (
                      <p className="text-xs font-semibold text-primary-600 mb-3">
                        {plan.includes}
                      </p>
                    )}

                    {/* Features */}
                    <ul className="space-y-2.5 mb-7 flex-1">
                      {plan.features.map(k => (
                        <li
                          key={k}
                          className="flex items-start gap-2 text-sm leading-relaxed text-slate-600"
                        >
                          <CheckCircle2 className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" />
                          <span>{t(k)}</span>
                        </li>
                      ))}
                    </ul>

                    <MagneticButton strength={0.1}>
                      <Link
                        href={plan.ctaHref}
                        className={`${plan.btnClass} w-full text-center`}
                      >
                        {plan.cta}
                      </Link>
                    </MagneticButton>
                  </div>
                </GlowCard>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TrustBadgesSection({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const badges = [
    { key: 'trustBadge1', icon: ShieldCheck },
    { key: 'trustBadge2', icon: BadgeCheck },
    { key: 'trustBadge3', icon: FileCheck2 },
    { key: 'trustBadge4', icon: Server },
    { key: 'trustBadge5', icon: Scale },
    { key: 'trustBadge6', icon: Briefcase },
  ];
  return (
    <section className="py-10 bg-slate-50 border-y border-slate-100 overflow-hidden">
      <div className="container-wide">
        <p className="text-center text-sm font-semibold text-slate-500 mb-6">
          {t('trustTitle')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {badges.map(badge => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.key}
                className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
              >
                <span className="w-6 h-6 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {t(badge.key)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ComparisonTableSection({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  type CellVal = string | boolean;
  // Premium comparison table with hover effects
  const categories: {
    cat: string;
    rows: {
      key: string;
      solo: CellVal;
      kanzlei: CellVal;
      business: CellVal;
      enterprise: CellVal;
    }[];
  }[] = [
    {
      cat: 'compCatAnalysis',
      rows: [
        {
          key: 'compPagesMonth',
          solo: 'compVal1000',
          kanzlei: 'compVal10000',
          business: 'compVal50000',
          enterprise: 'compValUnlimited',
        },
        {
          key: 'compTokensMonth',
          solo: 'compVal2M',
          kanzlei: 'compVal10MTokens',
          business: 'compVal30M',
          enterprise: 'compValUnlimitedTokens',
        },
        {
          key: 'compOCR',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compSemantic',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compQuality',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compEntity',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compContradiction',
          solo: 'compValBasic',
          kanzlei: 'compValAdvanced',
          business: 'compValAdvanced',
          enterprise: 'compValAdvanced',
        },
      ],
    },
    {
      cat: 'compCatLegal',
      rows: [
        {
          key: 'compPersonalIntelligence',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compCollectiveIntelligence',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compOpponentPatterns',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compCourtroomIntelligence',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compNormRecognition',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compNormClassification',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compTatbestand',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compQualChain',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compReclass',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compBeweislast',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compRiskScoring',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compCaseLaw',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compCostCalc',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compDeadlines',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compDeadlineJuris',
          solo: 'compVal1Juris',
          kanzlei: 'compValMultiJuris',
          business: 'compValMultiJuris',
          enterprise: 'compValMultiJuris',
        },
      ],
    },
    {
      cat: 'compCatDocuments',
      rows: [
        {
          key: 'compTemplates',
          solo: 'compVal5Templates',
          kanzlei: 'compVal13Templates',
          business: 'compVal13Templates',
          enterprise: 'compValCustom',
        },
        {
          key: 'compDocGen',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compEvidence',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compBulk',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compCustomTemplates',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compMultiParty',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
      ],
    },
    {
      cat: 'compCatTeam',
      rows: [
        {
          key: 'compUsers',
          solo: 'compVal1User',
          kanzlei: 'compVal10Users',
          business: 'compVal50Users',
          enterprise: 'compValUnlimited',
        },
        {
          key: 'compClientMatter',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compAnwalt',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compKanzlei',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compSSO',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compAPI',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compWebhooks',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compAnalytics',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
      ],
    },
    {
      cat: 'compCatSecurity',
      rows: [
        {
          key: 'compStorage',
          solo: 'compVal10GB',
          kanzlei: 'compVal100GB',
          business: 'compVal500GB',
          enterprise: 'compValUnlimitedStorage',
        },
        {
          key: 'compEncryption',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compAuditTrail',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compRBAC',
          solo: false,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compGDPR',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compSOC2',
          solo: true,
          kanzlei: true,
          business: true,
          enterprise: true,
        },
        {
          key: 'compSelfHosted',
          solo: false,
          kanzlei: false,
          business: false,
          enterprise: true,
        },
        {
          key: 'compDPA',
          solo: false,
          kanzlei: false,
          business: false,
          enterprise: true,
        },
      ],
    },
    {
      cat: 'compCatSupport',
      rows: [
        {
          key: 'compSupportLevel',
          solo: 'compValEmail',
          kanzlei: 'compValPriority',
          business: 'compValPriority',
          enterprise: 'compValPremium',
        },
        {
          key: 'compResponseTime',
          solo: 'compVal24h',
          kanzlei: 'compVal4h',
          business: 'compVal4h',
          enterprise: 'compVal1h',
        },
        {
          key: 'compOnboarding',
          solo: 'compValDocs',
          kanzlei: 'compValGuidedOnboard',
          business: 'compValFullOnboard',
          enterprise: 'compValCustomOnboard',
        },
        {
          key: 'compDedicatedManager',
          solo: false,
          kanzlei: false,
          business: true,
          enterprise: true,
        },
        {
          key: 'compOnSite',
          solo: false,
          kanzlei: false,
          business: false,
          enterprise: true,
        },
        {
          key: 'compWhiteLabel',
          solo: false,
          kanzlei: false,
          business: false,
          enterprise: true,
        },
      ],
    },
  ];

  const tooltipMap: Record<string, string> = {
    compPagesMonth: 'tipCompPagesMonth',
    compTokensMonth: 'tipCompTokensMonth',
    compOCR: 'tipCompOCR',
    compSemantic: 'tipCompSemantic',
    compQuality: 'tipCompQuality',
    compEntity: 'tipCompEntity',
    compContradiction: 'tipCompContradiction',
    compPersonalIntelligence: 'tipCompPersonalIntelligence',
    compCollectiveIntelligence: 'tipCompCollectiveIntelligence',
    compOpponentPatterns: 'tipCompOpponentPatterns',
    compCourtroomIntelligence: 'tipCompCourtroomIntelligence',
    compNormRecognition: 'tipCompNormRecognition',
    compNormClassification: 'tipCompNormClassification',
    compTatbestand: 'tipCompTatbestand',
    compDeadlines: 'tipCompDeadlines',
    compTemplates: 'tipCompTemplates',
    compDocGen: 'tipCompDocGen',
    compEvidence: 'tipCompEvidence',
    compUsers: 'tipCompUsers',
    compStorage: 'tipCompStorage',
    compEncryption: 'tipCompEncryption',
    compAuditTrail: 'tipCompAuditTrail',
    compRBAC: 'tipCompRBAC',
    compSSO: 'tipCompSSO',
    compAPI: 'tipCompAPI',
    compSupportLevel: 'tipCompSupportLevel',
    compResponseTime: 'tipCompResponseTime',
  };

  const renderCell = (val: CellVal) => {
    if (val === true)
      return <CheckCircle2 className="w-4 h-4 text-accent-500 mx-auto" />;
    if (val === false)
      return <span className="text-slate-300 text-sm">{t('compNo')}</span>;
    return <span className="text-sm font-medium text-slate-700">{t(val)}</span>;
  };

  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t('comparisonTitle')}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {t('comparisonSubtitle')}
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal direction="up" distance={30} delay={200}>
          <div className="max-w-6xl mx-auto overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table
              className="w-full border-collapse min-w-[700px]"
              aria-label={t('comparisonTitle')}
            >
              <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm shadow-[0_1px_0_0_theme(colors.slate.200)]">
                <tr>
                  <th className="text-left p-3 w-[35%] text-sm font-bold text-slate-600">
                    {t('comparisonFeatureHeader')}
                  </th>
                  <th className="text-center p-3 text-sm font-bold text-slate-900 w-[16.25%]">
                    {t('soloName')}
                  </th>
                  <th className="text-center p-3 text-sm font-bold text-primary-600 w-[16.25%] bg-primary-50/50">
                    {t('kanzleiName')}
                  </th>
                  <th className="text-center p-3 text-sm font-bold text-slate-900 w-[16.25%]">
                    {t('businessName')}
                  </th>
                  <th className="text-center p-3 text-sm font-bold text-slate-900 w-[16.25%]">
                    {t('enterpriseName')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <Fragment key={cat.cat}>
                    <tr className="bg-slate-50/80">
                      <td
                        colSpan={5}
                        className="p-3 text-sm font-bold text-slate-900"
                      >
                        {t(cat.cat)}
                      </td>
                    </tr>
                    {cat.rows.map(row => {
                      const tipKey = tooltipMap[row.key];
                      return (
                        <tr
                          key={row.key}
                          className="border-b border-slate-100 hover:bg-primary-50/30 transition-colors duration-200 group"
                        >
                          <td className="p-3 text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                            <span className="inline-flex items-center gap-1.5">
                              {t(row.key)}
                              {tipKey && (
                                <span className="relative group/tip cursor-help">
                                  <Info className="w-3.5 h-3.5 text-slate-400 group-hover/tip:text-primary-500 transition-colors" />
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity duration-200 w-56 text-center z-30 leading-relaxed">
                                    {t(tipKey)}
                                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
                                  </span>
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {renderCell(row.solo)}
                          </td>
                          <td className="p-3 text-center bg-primary-50/20">
                            {renderCell(row.kanzlei)}
                          </td>
                          <td className="p-3 text-center">
                            {renderCell(row.business)}
                          </td>
                          <td className="p-3 text-center">
                            {renderCell(row.enterprise)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function AddonsSection({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const addons = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({
    name: `addon${i}Name`,
    desc: `addon${i}Desc`,
    price: `addon${i}Price`,
  }));

  return (
    <section className="section-padding bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t('addonsTitle')}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {t('addonsSubtitle')}
            </p>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {addons.map((addon, i) => (
            <ScrollReveal
              key={addon.name}
              delay={i * 100}
              direction="up"
              distance={20}
            >
              <GlowCard glowColor="rgba(30,64,175,0.06)" className="h-full">
                <div className="glass-card p-6 h-full flex flex-col hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="w-5 h-5 text-primary-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      {t(addon.name)}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 flex-1">
                    {t(addon.desc)}
                  </p>
                  <p className="text-lg font-bold text-primary-600">
                    {t(addon.price)}
                  </p>
                </div>
              </GlowCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const faqs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => ({
    q: `faq${i}Q`,
    a: `faq${i}A`,
  }));
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="section-padding bg-white relative overflow-hidden"
    >
      <div className="absolute inset-0 dot-pattern" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            {t('faqTitle')}
          </h2>
        </ScrollReveal>
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <ScrollReveal
                key={faq.q}
                delay={i * 60}
                direction="up"
                distance={15}
              >
                <div className="glass-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between p-6 text-left font-semibold text-slate-900 hover:text-primary-600 transition-colors duration-300"
                    aria-expanded={isOpen}
                  >
                    {t(faq.q)}
                    <ChevronRight
                      className={`w-5 h-5 text-slate-400 flex-shrink-0 ml-4 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                        {t(faq.a)}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MoneyBackBanner({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const points = [t('guaranteed'), t('trustBadge1'), t('trustBadge2')];

  return (
    <section className="bg-gradient-to-r from-slate-950 via-primary-950 to-cyan-950 text-white py-8 border-y border-white/10">
      <div className="container-wide">
        <div className="rounded-2xl border border-white/15 bg-white/5 px-6 py-6 md:px-8 md:py-7 backdrop-blur-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-200">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
                  {t('moneyBackKicker')}
                </p>
                <h3 className="mt-1 text-xl font-bold text-white">
                  {t('moneyBackTitle')}
                </h3>
                <p className="mt-1 text-sm text-slate-200/90">
                  {t('moneyBackDescription')}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {points.map(point => (
                <div
                  key={point}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/90"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StickyCtaBar({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const [openFaq, setOpenFaq] = useState(false);
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const openChat = useCallback(() => {
    window.location.hash = 'chat-support';
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0.2 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const faqItems: { question: string; answer: ReactNode }[] = [
    {
      question: t('stickyFaq1Q'),
      answer: t('stickyFaq1A'),
    },
    {
      question: t('stickyFaq2Q'),
      answer: t('stickyFaq2A'),
    },
    {
      question: t('stickyFaq3Q'),
      answer: t('stickyFaq3A'),
    },
  ];

  return (
    <>
      <div ref={sentinelRef} className="h-24 sm:h-20" aria-hidden="true" />

      <aside
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-300 sm:px-5 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-label={t('stickyAriaLabel')}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t('stickyTitle')}
              </p>
              <p className="text-xs text-slate-600">
                {t('guaranteed')} · {t('stickyGuaranteeSuffix')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenFaq(v => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              aria-expanded={openFaq}
            >
              <HelpCircle className="h-4 w-4" />
              {t('stickyFaqButton')}
              {openFaq ? (
                <Minus className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={openChat}
              className="btn-secondary !py-2 !px-4 !text-sm"
            >
              {t('stickyChatButton')}
            </button>

            <a
              href="https://app.subsum.io/sign-in?redirect_uri=%2F&intent=signup"
              className="btn-primary !py-2 !px-4 !text-sm"
            >
              {t('ctaKanzlei')}
            </a>
          </div>
        </div>

        {openFaq ? (
          <div className="mx-auto mt-3 grid w-full max-w-7xl gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3 max-h-[40vh] overflow-auto">
            {faqItems.map(item => (
              <div
                key={item.question}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {item.question}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </aside>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Social Proof Logo Marquee — animated partner/client logos
   ═══════════════════════════════════════════════════════════════ */
function SocialProofLogosSection({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const logos = [1, 2, 3, 4, 5, 6, 7, 8].map(i => t(`logo${i}`));
  const doubled = [...logos, ...logos];

  return (
    <section className="py-10 bg-white border-b border-slate-100 overflow-hidden">
      <div className="container-wide">
        <ScrollReveal direction="up" distance={12}>
          <p className="text-center text-sm font-semibold text-slate-500 mb-8 uppercase tracking-[0.15em]">
            {t('logosTitle')}
          </p>
        </ScrollReveal>
        <div className="relative overflow-hidden motion-reduce:overflow-x-auto motion-reduce:pb-2">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee gap-8 items-center motion-reduce:animate-none motion-reduce:w-max">
            {doubled.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex-shrink-0 flex items-center gap-3 px-6 py-3.5 bg-slate-50 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition-all duration-300"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-primary-700" />
                </div>
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Plan Recommendation Quiz — 3 questions → suggested plan
   ═══════════════════════════════════════════════════════════════ */
function PlanQuizSection({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const questions = [
    {
      key: 'quizQ1',
      options: ['quizQ1O1', 'quizQ1O2', 'quizQ1O3', 'quizQ1O4'],
    },
    {
      key: 'quizQ2',
      options: ['quizQ2O1', 'quizQ2O2', 'quizQ2O3', 'quizQ2O4'],
    },
    { key: 'quizQ3', options: ['quizQ3O1', 'quizQ3O2', 'quizQ3O3'] },
  ];

  const recommend = useCallback(
    (a: number[]) => {
      const teamScore = a[0] ?? 0;
      const docScore = a[1] ?? 0;
      const jurisScore = a[2] ?? 0;
      const total = teamScore + docScore + jurisScore;
      if (total <= 1)
        return { plan: t('soloName'), desc: t('soloDesc'), href: '/' };
      if (total <= 4)
        return { plan: t('kanzleiName'), desc: t('kanzleiDesc'), href: '/' };
      if (total <= 7)
        return { plan: t('businessName'), desc: t('businessDesc'), href: '/' };
      return {
        plan: t('enterpriseName'),
        desc: t('enterpriseDesc'),
        href: '/contact',
      };
    },
    [t]
  );

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      const rec = recommend(newAnswers);
      setResult(rec.plan);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers([]);
    setResult(null);
  };

  const rec = result ? recommend(answers) : null;
  const progress = result
    ? 100
    : questions.length <= 1
      ? 0
      : (step / (questions.length - 1)) * 100;

  return (
    <section className="section-padding bg-gradient-to-br from-primary-50/50 via-white to-accent-50/30 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-medium mb-4">
              <HelpCircle className="w-4 h-4" />
              Plan Finder
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              {t('quizTitle')}
            </h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              {t('quizSubtitle')}
            </p>
          </div>
        </ScrollReveal>

        <div className="max-w-2xl mx-auto">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500 ease-out-expo"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">
              {result
                ? `${questions.length}/${questions.length}`
                : `${step + 1}/${questions.length}`}
            </p>
          </div>

          {!result ? (
            <div className="glass-card p-8 text-center" key={step}>
              <h3 className="text-xl font-bold text-slate-900 mb-6">
                {t(questions[step].key)}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {questions[step].options.map((optKey, idx) => (
                  <button
                    key={optKey}
                    onClick={() => handleAnswer(idx)}
                    className="p-4 rounded-xl border-2 border-slate-200 bg-white text-left hover:border-primary-400 hover:bg-primary-50/50 hover:shadow-md transition-all duration-200 group"
                  >
                    <span className="text-sm font-semibold text-slate-800 group-hover:text-primary-700">
                      {t(optKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-2">
                {t('quizResult')}
              </p>
              <h3 className="text-3xl font-extrabold text-slate-900 mb-3">
                {rec?.plan}
              </h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                {rec?.desc}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <MagneticButton strength={0.1}>
                  <Link
                    href={
                      rec?.href ??
                      'https://app.subsum.io/sign-in?redirect_uri=%2F&intent=signup'
                    }
                    className="btn-primary"
                  >
                    {t('quizResultCta')} <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </MagneticButton>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('quizRestart')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Interactive ROI Calculator — sliders + live calculation
   ═══════════════════════════════════════════════════════════════ */
function InteractiveRoiCalculator({
  t,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
}) {
  const locale = useLocale();
  const [teamSize, setTeamSize] = useState(5);
  const [docsMonth, setDocsMonth] = useState(5000);
  const [hourlyRate, setHourlyRate] = useState(180);

  const hoursPerDocManual = 0.15;
  const hoursPerDocAi = 0.01;
  const hoursSaved = Math.round(
    docsMonth * (hoursPerDocManual - hoursPerDocAi) * teamSize * 0.3
  );
  const costSaved = Math.round(hoursSaved * hourlyRate * 12);
  const planCost =
    teamSize <= 1 ? 149 : teamSize <= 10 ? 399 : teamSize <= 50 ? 899 : 2500;
  const roiMultiple =
    planCost > 0 ? Math.round((costSaved / (planCost * 12)) * 10) / 10 : 0;

  const recommendedPlan =
    teamSize <= 1
      ? t('soloName')
      : teamSize <= 10
        ? t('kanzleiName')
        : teamSize <= 50
          ? t('businessName')
          : t('enterpriseName');

  return (
    <section className="section-padding bg-gradient-to-br from-slate-900 via-slate-900 to-primary-950 text-white relative overflow-hidden noise-overlay">
      <FloatingParticles
        count={3}
        colors={['bg-primary-400/6', 'bg-cyan-400/6', 'bg-sky-300/4']}
      />
      <div className="container-wide relative z-10">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-500/15 border border-accent-500/25 text-accent-300 text-sm font-medium mb-4">
              <Calculator className="w-4 h-4" />
              ROI Calculator
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 text-balance">
              {t('calcTitle')}
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              {t('calcSubtitle')}
            </p>
          </div>
        </ScrollReveal>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
          {/* Sliders */}
          <ScrollReveal direction="left" distance={30}>
            <div className="space-y-8 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <SliderInput
                label={t('calcTeamSize')}
                unit={t('calcTeamUnit')}
                value={teamSize}
                min={1}
                max={100}
                step={1}
                onChange={setTeamSize}
              />
              <SliderInput
                label={t('calcDocs')}
                unit={t('calcDocsUnit')}
                value={docsMonth}
                min={100}
                max={100000}
                step={100}
                onChange={setDocsMonth}
              />
              <SliderInput
                label={t('calcRate')}
                unit={t('calcRateUnit')}
                value={hourlyRate}
                min={80}
                max={500}
                step={10}
                onChange={setHourlyRate}
              />
            </div>
          </ScrollReveal>

          {/* Results */}
          <ScrollReveal direction="right" distance={30} delay={150}>
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-6 mb-8">
                <ResultCard
                  label={t('calcResultTime')}
                  value={`${hoursSaved.toLocaleString(locale)}`}
                  suffix="h"
                  color="text-accent-300"
                />
                <ResultCard
                  label={t('calcResultCost')}
                  value={`€${costSaved.toLocaleString(locale)}`}
                  color="text-green-300"
                />
                <ResultCard
                  label={t('calcResultRoi')}
                  value={`${roiMultiple}x`}
                  color="text-amber-300"
                />
                <ResultCard
                  label={t('calcResultPlan')}
                  value={recommendedPlan}
                  color="text-primary-300"
                />
              </div>
              <MagneticButton strength={0.1}>
                <a
                  href="https://app.subsum.io/sign-in?redirect_uri=%2F&intent=signup"
                  className="btn-primary w-full text-center text-lg !py-4"
                >
                  {t('calcCta')} <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </MagneticButton>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function SliderInput({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const locale = useLocale();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-slate-200">{label}</label>
        <span className="text-lg font-bold text-white tabular-nums">
          {value.toLocaleString(locale)}{' '}
          <span className="text-xs font-normal text-slate-400">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700 accent-accent-400"
        style={{
          background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${pct}%, #334155 ${pct}%, #334155 100%)`,
        }}
      />
      <div className="flex justify-between mt-1.5 text-xs text-slate-500">
        <span>{min.toLocaleString(locale)}</span>
        <span>{max.toLocaleString(locale)}</span>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string;
  suffix?: string;
  color: string;
}) {
  return (
    <div className="text-center p-5 rounded-xl bg-white/5 border border-white/10">
      <div className={`text-2xl sm:text-3xl font-extrabold ${color} mb-1`}>
        {value}
        {suffix}
      </div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Testimonial Carousel — auto-rotating with stars & avatars
   ═══════════════════════════════════════════════════════════════ */
function TestimonialCarouselSection({
  t,
  tTestimonials,
}: {
  t: ReturnType<typeof useTranslations<'pricing'>>;
  tTestimonials: ReturnType<typeof useTranslations<'testimonials'>>;
}) {
  const testimonials = [1, 2, 3, 4, 5, 6].map(i => ({
    quote: tTestimonials(`quote${i}`),
    author: tTestimonials(`author${i}`),
    role: tTestimonials(`role${i}`),
    location: tTestimonials(`location${i}`),
  }));

  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive(prev => (prev + 1) % testimonials.length);
    }, 5000);
  }, [testimonials.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goTo = (idx: number) => {
    setActive(idx);
    startTimer();
  };

  const current = testimonials[active];
  const initials = current.author
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <section className="section-padding bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              {t('testimonialTitle')}
            </h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              {t('testimonialSubtitle')}
            </p>
          </div>
        </ScrollReveal>

        <div className="max-w-3xl mx-auto">
          {/* Card */}
          <div className="glass-card p-8 sm:p-10 text-center min-h-[280px] flex flex-col items-center justify-center relative">
            <Quote className="w-8 h-8 text-primary-200 absolute top-6 left-6" />

            <div key={active} className="animate-fade-in">
              {/* Stars */}
              <div className="flex items-center justify-center gap-1 mb-5">
                {[0, 1, 2, 3, 4].map(star => (
                  <Star
                    key={star}
                    className="w-5 h-5 text-amber-400 fill-current"
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-lg sm:text-xl text-slate-800 leading-relaxed mb-6 font-medium italic">
                &ldquo;{current.quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center justify-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {initials}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900">
                    {current.author}
                  </p>
                  <p className="text-xs text-slate-500">
                    {current.role} · {current.location}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dot navigation */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`Testimonial ${idx + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  idx === active
                    ? 'w-8 h-2.5 bg-primary-600'
                    : 'w-2.5 h-2.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection({ t }: { t: ReturnType<typeof useTranslations<'cta'>> }) {
  return (
    <PrefooterCta
      title={t('title')}
      subtitle={t('subtitle')}
      primaryAction={{
        href: 'https://app.subsum.io/sign-in?redirect_uri=%2F&intent=signup',
        label: t('button'),
      }}
    />
  );
}
