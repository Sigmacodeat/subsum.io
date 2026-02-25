'use client';

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  FileSearch,
  FileText,
  Fingerprint,
  FolderOpen,
  Gauge,
  Gavel,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Network,
  Quote,
  Scale,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import Script from 'next/script';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AnimatedCounter,
  FloatingParticles,
  GlowCard,
  GradientBlob,
  MagneticButton,
  Parallax,
  ScrollLightSweep,
  ScrollProgressBar,
  ScrollReveal,
  ScrollScale,
  ScrollTransform,
  SmoothMarquee,
  TextRevealByWord,
} from '@/components/animations';
import { AppDashboardPreview } from '@/components/app-dashboard-preview';
import { PrefooterCta } from '@/components/prefooter-cta';
import { Link } from '@/i18n/routing';
import { buildHomepageJsonLd } from '@/utils/seo-schema';

const sectionHeadingClass =
  'text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mt-4 mb-4 text-balance leading-[1.12]';
const sectionHeadingLightClass = `${sectionHeadingClass} text-slate-900`;
const sectionHeadingDarkClass = `${sectionHeadingClass} text-white`;
const sectionSubtitleLightClass = 'text-lg text-slate-700 max-w-3xl mx-auto';
const sectionSubtitleDarkClass = 'text-lg text-slate-300 max-w-3xl mx-auto';
const cardTitleLightClass =
  'text-lg font-bold text-slate-900 mb-2 leading-snug';
const cardTitleDarkClass = 'text-lg font-bold text-white mb-2 leading-snug';
const cardBodyLightClass = 'text-sm text-slate-600 leading-relaxed';
const cardBodyDarkClass = 'text-sm text-slate-300 leading-relaxed';

export default function HomePage() {
  const locale = useLocale();
  const meta = useTranslations('meta');

  const jsonLd = buildHomepageJsonLd({
    locale,
    title: meta('title'),
    description: meta('description'),
  });

  return (
    <>
      <Script
        id="jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(jsonLd)}
      </Script>
      <ScrollProgressBar />
      <HeroSection />
      <SocialProofSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <HowItWorksSection />
      <AiSection />
      <CollectiveIntelligenceSection />
      <SecuritySection />
      <TestimonialsSection />
      <PricingPreviewSection />
      <IntegrationSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}

function HeroSection() {
  const t = useTranslations('hero');
  const tCta = useTranslations('cta');
  return (
    <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-36 overflow-hidden">
      {/* Layered background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
      <div className="absolute inset-0 sm:hidden" aria-hidden="true">
        <div className="absolute inset-0 grid-pattern opacity-35" />
        <div className="absolute -top-28 -right-20 h-64 w-64 rounded-full blur-3xl bg-primary-300/20" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl bg-cyan-300/20" />
      </div>

      <div className="hidden sm:block" aria-hidden="true">
        <Parallax speed={0.05} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern" />
        </Parallax>
        <FloatingParticles
          count={5}
          colors={['bg-primary-400/10', 'bg-cyan-400/10', 'bg-sky-300/8']}
        />
        <Parallax speed={0.03} className="absolute inset-0">
          <GradientBlob
            className="-top-44 -right-44 animate-breathe"
            size={620}
            colors={['#1E40AF', '#0E7490', '#dbeafe']}
          />
        </Parallax>
        <Parallax speed={0.06} className="absolute inset-0">
          <GradientBlob
            className="-bottom-64 -left-44"
            size={520}
            colors={['#0E7490', '#1E40AF', '#ecfeff']}
          />
        </Parallax>
        <Parallax speed={0.09} className="absolute inset-0">
          <GradientBlob
            className="top-10 left-[58%] opacity-20"
            size={360}
            colors={['#14b8a6', '#3b82f6', '#0E7490']}
          />
        </Parallax>
        <ScrollLightSweep className="absolute inset-0" intensity={0.32} />
      </div>

      <div className="container-wide relative">
        <div className="max-w-5xl mx-auto text-center">
          <ScrollReveal delay={100} direction="up" distance={20}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-primary-100/80 text-primary-700 text-sm font-medium mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 animate-pulse-slow" />
              {t('badge')}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200} direction="up" distance={30}>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 text-balance leading-[1.06]">
              {t('title')}{' '}
              <span className="gradient-text">{t('titleHighlight')}</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={350} direction="up" distance={20}>
            <p className="text-lg sm:text-xl text-slate-700 max-w-3xl lg:max-w-4xl mx-auto mb-10 text-pretty leading-relaxed">
              {t('subtitle')}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={500} direction="up" distance={20}>
            <div className="flex w-full flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3 sm:gap-4 lg:gap-5 mb-5">
              <MagneticButton strength={0.12}>
                <Link
                  href="/pricing"
                  className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[220px] text-lg !px-10 !py-5"
                >
                  {t('ctaPrimary')}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </MagneticButton>
              <MagneticButton strength={0.12}>
                <Link
                  href="/features"
                  className="btn-secondary inline-flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[220px] text-lg !px-10 !py-5"
                >
                  {tCta('details')}
                </Link>
              </MagneticButton>
            </div>
            <p className="text-sm text-slate-500">{t('ctaNote')}</p>
          </ScrollReveal>

          <ScrollReveal delay={650} direction="up" distance={20}>
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto">
              {[
                { v: t('stat1Value'), l: t('stat1Label') },
                { v: t('stat2Value'), l: t('stat2Label') },
                { v: t('stat3Value'), l: t('stat3Label') },
              ].map(s => (
                <div key={s.l} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {s.v}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>

        {/* Dashboard Preview — dedicated mobile visual + desktop depth preview */}
        <div className="mt-14 sm:mt-20 max-w-5xl mx-auto">
          <div className="sm:hidden">
            <HeroMobileDashboardPreview />
          </div>

          <div className="hidden sm:block">
            <ScrollScale
              startScale={0.82}
              endScale={1}
              startOpacity={0.3}
              endOpacity={1}
              offsetPx={120}
            >
              <ScrollTransform
                offsetPx={100}
                style={p => {
                  const ease = 1 - Math.pow(1 - p, 3);
                  return {
                    transform: `perspective(1400px) rotateX(${(1 - ease) * 6}deg) translateY(${(1 - ease) * 30}px)`,
                    willChange: 'transform',
                    transition: 'transform 80ms linear',
                  };
                }}
              >
                <AppDashboardPreview />
              </ScrollTransform>
            </ScrollScale>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMobileDashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Mobile Vorschau des Subsumio Dashboards mit Sync-Status, KPI-Karten, nächsten Schritten und Export-Status"
      className="relative mx-auto max-w-[420px] rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_90px_-34px_rgba(2,6,23,0.28)] overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/70 via-white to-cyan-50/50" />
      <div className="absolute inset-0 grid-pattern opacity-45" />

      <div className="relative p-4">
        <div className="rounded-[22px] border border-slate-200/70 bg-white/80 backdrop-blur-xl p-3 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.3)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/70 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-semibold text-slate-700">
                Sync
              </span>
              <span className="text-[11px] font-bold text-emerald-700">✓</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/70 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-[11px] font-semibold text-slate-700">
                Audit
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl border border-slate-200/70 bg-white px-2.5 py-2 shadow-sm">
              <div className="text-[9px] text-slate-500 font-semibold">
                Offene Akten
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                12
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white px-2.5 py-2 shadow-sm">
              <div className="text-[9px] text-slate-500 font-semibold">
                Fristen
              </div>
              <div className="text-base font-extrabold text-amber-600 mt-0.5">
                5
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white px-2.5 py-2 shadow-sm">
              <div className="text-[9px] text-slate-500 font-semibold">
                Quality
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                94
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 rounded-md bg-primary-600/10 border border-primary-200/50 flex items-center justify-center">
                  <Brain className="w-3 h-3 text-primary-700" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">
                  Nächste Schritte
                </span>
              </div>
              <div className="space-y-1">
                {[74, 62, 48].map((w, i) => (
                  <div key={w} className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-slate-400"
                      style={{ opacity: 0.8 - i * 0.2 }}
                    />
                    <span
                      className="h-1.5 rounded-full bg-slate-200"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 rounded-md bg-emerald-600/10 border border-emerald-200/50 flex items-center justify-center">
                  <Gauge className="w-3 h-3 text-emerald-700" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">
                  Export
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px] mb-1">
                <span className="font-semibold text-slate-600">PDF</span>
                <span className="font-bold text-slate-700">bereit</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200/70 overflow-hidden mb-1.5">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: '92%' }}
                />
              </div>
              <div className="text-[9px] text-slate-500 font-medium">
                Signatur & Versand
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialProofSection() {
  const t = useTranslations('socialProof');
  const badges = [
    { icon: Shield, label: t('badge1') },
    { icon: ClipboardCheck, label: t('badge2') },
    { icon: Lock, label: t('badge3') },
    { icon: Server, label: t('badge4') },
  ];
  return (
    <section className="py-14 bg-slate-50/80 border-y border-slate-100 overflow-hidden">
      <div className="container-wide">
        <ScrollReveal direction="up" distance={15}>
          <p className="text-center text-sm text-slate-500 mb-8 tracking-wide uppercase">
            {t('trustedBy')}
          </p>
        </ScrollReveal>
        <SmoothMarquee speed={25} className="py-2">
          {badges.map(b => (
            <div
              key={b.label}
              className="flex items-center gap-2.5 px-5 py-3 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 flex-shrink-0"
            >
              <b.icon className="w-5 h-5 text-accent-600" />
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                {b.label}
              </span>
            </div>
          ))}
        </SmoothMarquee>
      </div>
    </section>
  );
}

function ProblemSection() {
  const t = useTranslations('problem');
  const pains = [
    {
      icon: Clock,
      tk: 'pain1Title',
      dk: 'pain1Desc',
      s: t('pain1Stat'),
      sl: t('pain1StatLabel'),
      c: 'text-red-500 bg-red-50',
      glow: 'rgba(239,68,68,0.08)',
    },
    {
      icon: Search,
      tk: 'pain2Title',
      dk: 'pain2Desc',
      s: t('pain2Stat'),
      sl: t('pain2StatLabel'),
      c: 'text-amber-500 bg-amber-50',
      glow: 'rgba(245,158,11,0.08)',
    },
    {
      icon: AlertTriangle,
      tk: 'pain3Title',
      dk: 'pain3Desc',
      s: t('pain3Stat'),
      sl: t('pain3StatLabel'),
      c: 'text-cyan-600 bg-cyan-50',
      glow: 'rgba(8,145,178,0.1)',
    },
  ];
  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-red-600 bg-red-50 border border-red-100">
              {t('label')}
            </span>
            <TextRevealByWord
              text={t('title')}
              tag="h2"
              className={sectionHeadingLightClass}
              staggerMs={50}
            />
            <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <div className="grid md:grid-cols-3 gap-8">
          {pains.map((p, i) => (
            <ScrollScale
              key={p.tk}
              startScale={0.88}
              endScale={1}
              startOpacity={0}
              endOpacity={1}
              offsetPx={60 + i * 40}
            >
              <GlowCard glowColor={p.glow} className="h-full">
                <div className="glass-card p-8 h-full hover:-translate-y-1 transition-transform duration-400">
                  <div
                    className={`w-14 h-14 rounded-xl ${p.c} flex items-center justify-center mb-6`}
                  >
                    <p.icon className="w-7 h-7" />
                  </div>
                  <div className="text-4xl font-extrabold text-slate-900 mb-1">
                    {p.s}
                  </div>
                  <div className="text-sm text-slate-500 mb-4">{p.sl}</div>
                  <h3 className={cardTitleLightClass}>{t(p.tk)}</h3>
                  <p className={cardBodyLightClass}>{t(p.dk)}</p>
                </div>
              </GlowCard>
            </ScrollScale>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  const t = useTranslations('solution');
  const cards = [
    {
      icon: Brain,
      tk: 'card1Title',
      dk: 'card1Desc',
      g: 'from-primary-500 to-primary-700',
    },
    {
      icon: Clock,
      tk: 'card2Title',
      dk: 'card2Desc',
      g: 'from-accent-500 to-accent-700',
    },
    {
      icon: Zap,
      tk: 'card3Title',
      dk: 'card3Desc',
      g: 'from-cyan-500 to-sky-700',
    },
  ];
  return (
    <section className="section-padding bg-gradient-to-br from-slate-900 via-slate-900 to-primary-950 text-white relative overflow-hidden noise-overlay">
      <FloatingParticles
        count={4}
        colors={['bg-primary-400/8', 'bg-cyan-400/8', 'bg-sky-300/5']}
      />
      <div className="container-wide relative z-10">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-accent-300 bg-accent-500/10 border border-accent-500/20">
              {t('label')}
            </span>
            <h2 className={sectionHeadingDarkClass}>{t('title')}</h2>
            <p className={sectionSubtitleDarkClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <div className="grid md:grid-cols-3 gap-8">
          {cards.map((c, i) => (
            <ScrollReveal
              key={c.tk}
              delay={i * 120}
              direction={(['left', 'up', 'right'] as const)[i % 3]}
              distance={35}
            >
              <div className="glass-card-dark p-8 h-full group hover:-translate-y-1 transition-all duration-400">
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${c.g} flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300`}
                >
                  <c.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className={cardTitleDarkClass}>{t(c.tk)}</h3>
                <p className={cardBodyDarkClass}>{t(c.dk)}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const t = useTranslations('features');
  const features = [
    { icon: Upload, tk: 'feature1Title', dk: 'feature1Desc' },
    { icon: Eye, tk: 'feature2Title', dk: 'feature2Desc' },
    { icon: Clock, tk: 'feature3Title', dk: 'feature3Desc' },
    { icon: Search, tk: 'feature4Title', dk: 'feature4Desc' },
    { icon: FileText, tk: 'feature5Title', dk: 'feature5Desc' },
    { icon: FolderOpen, tk: 'feature6Title', dk: 'feature6Desc' },
    { icon: Gavel, tk: 'feature7Title', dk: 'feature7Desc' },
    { icon: Users, tk: 'feature8Title', dk: 'feature8Desc' },
    { icon: Network, tk: 'feature9Title', dk: 'feature9Desc' },
  ];
  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
              {t('label')}
            </span>
            <h2 className={sectionHeadingLightClass}>{t('title')}</h2>
            <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <ScrollScale
              key={f.tk}
              startScale={0.9}
              endScale={1}
              startOpacity={0}
              endOpacity={1}
              offsetPx={40 + (i % 3) * 30}
            >
              <GlowCard glowColor="rgba(30,64,175,0.1)" className="h-full">
                <div className="group glass-card p-6 h-full hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary-600/25 transition-all duration-300">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className={cardTitleLightClass}>{t(f.tk)}</h3>
                  <p className={cardBodyLightClass}>{t(f.dk)}</p>
                </div>
              </GlowCard>
            </ScrollScale>
          ))}
        </div>
        <ScrollReveal delay={400} direction="up" distance={15}>
          <div className="text-center mt-12">
            <MagneticButton strength={0.1}>
              <Link href="/features" className="btn-secondary focus-ring">
                {t('viewAll')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </MagneticButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const t = useTranslations('howItWorks');
  const steps = [
    { n: '01', icon: Upload, tk: 'step1Title', dk: 'step1Desc' },
    { n: '02', icon: Brain, tk: 'step2Title', dk: 'step2Desc' },
    { n: '03', icon: BarChart3, tk: 'step3Title', dk: 'step3Desc' },
    { n: '04', icon: FileText, tk: 'step4Title', dk: 'step4Desc' },
  ];
  return (
    <section className="section-padding bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
              {t('label')}
            </span>
            <h2 className={sectionHeadingLightClass}>{t('title')}</h2>
            <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <div className="grid md:grid-cols-4 gap-8 relative">
          {/* Animated connecting line */}
          <div className="hidden md:block absolute top-16 left-[12.5%] right-[12.5%] h-px">
            <div
              className="h-full w-full bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200"
              style={{
                maskImage:
                  'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
              }}
            />
          </div>
          {steps.map((s, i) => (
            <ScrollReveal
              key={s.n}
              delay={i * 180}
              direction={i % 2 === 0 ? 'left' : 'right'}
              distance={25}
              scale={0.92}
            >
              <div className="relative text-center group">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-600/20 relative z-10 group-hover:shadow-xl group-hover:shadow-primary-600/30 group-hover:scale-105 transition-all duration-300">
                  <s.icon className="w-8 h-8 text-white" />
                </div>
                {/* Pulse ring behind icon */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl gradient-primary opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 z-0" />
                <div className="text-xs font-bold text-primary-600 mb-2 tracking-widest">
                  STEP {s.n}
                </div>
                <h3 className={cardTitleLightClass}>{t(s.tk)}</h3>
                <p className={cardBodyLightClass}>{t(s.dk)}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiSection() {
  const t = useTranslations('ai');
  const tCta = useTranslations('cta');
  const caps = [
    { tk: 'capability1', dk: 'capability1Desc', icon: Brain },
    { tk: 'capability2', dk: 'capability2Desc', icon: Eye },
    { tk: 'capability3', dk: 'capability3Desc', icon: Gavel },
    { tk: 'capability4', dk: 'capability4Desc', icon: FileText },
  ];
  return (
    <section className="section-padding bg-gradient-to-br from-primary-950 via-slate-900 to-cyan-950 text-white overflow-hidden relative noise-overlay">
      <FloatingParticles
        count={5}
        colors={['bg-primary-500/8', 'bg-cyan-500/8', 'bg-sky-400/5']}
      />
      <GradientBlob
        className="top-0 left-1/4 animate-breathe"
        size={400}
        colors={['#1E40AF', '#0891b2', '#164e63']}
      />
      <GradientBlob
        className="bottom-0 right-1/4"
        size={350}
        colors={['#0891b2', '#3b82f6', '#1E40AF']}
      />
      <div className="container-wide relative z-10">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
              {t('label')}
            </span>
            <TextRevealByWord
              text={t('title')}
              tag="h2"
              className={sectionHeadingDarkClass}
              staggerMs={45}
            />
            <p className={sectionSubtitleDarkClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {caps.map((c, i) => (
            <ScrollScale
              key={c.tk}
              startScale={0.88}
              endScale={1}
              startOpacity={0}
              endOpacity={1}
              offsetPx={50 + i * 25}
            >
              <div className="flex gap-4 p-6 rounded-2xl glass-card-dark group hover:-translate-y-0.5 transition-transform duration-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-primary-500 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg group-hover:shadow-cyan-500/20 group-hover:scale-105 transition-all duration-300">
                  <c.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={cardTitleDarkClass}>{t(c.tk)}</h3>
                  <p className={cardBodyDarkClass}>{t(c.dk)}</p>
                </div>
              </div>
            </ScrollScale>
          ))}
        </div>
        <ScrollReveal delay={220} direction="up" distance={15}>
          <div className="text-center mt-12">
            <MagneticButton strength={0.1}>
              <Link
                href="/features/collective-intelligence"
                className="btn-secondary !border-cyan-300/30 !text-cyan-100 hover:!text-white hover:!border-cyan-200/50"
              >
                {tCta('details')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </MagneticButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function CollectiveIntelligenceSection() {
  const t = useTranslations('collectiveIntelligence');

  const stats = [
    { v: t('stat1Value'), l: t('stat1Label') },
    { v: t('stat2Value'), l: t('stat2Label') },
    { v: t('stat3Value'), l: t('stat3Label') },
    { v: t('stat4Value'), l: t('stat4Label') },
  ];

  const benefits = [
    { icon: CheckCircle2, tk: 'benefit1Title', dk: 'benefit1Desc' },
    { icon: Scale, tk: 'benefit2Title', dk: 'benefit2Desc' },
    { icon: Gavel, tk: 'benefit3Title', dk: 'benefit3Desc' },
    { icon: Lightbulb, tk: 'benefit4Title', dk: 'benefit4Desc' },
    { icon: TrendingUp, tk: 'benefit5Title', dk: 'benefit5Desc' },
    { icon: LayoutDashboard, tk: 'benefit6Title', dk: 'benefit6Desc' },
  ];

  const privacyBadges = [
    { icon: ShieldCheck, label: t('privacyBadge1') },
    { icon: Lock, label: t('privacyBadge2') },
    { icon: Server, label: t('privacyBadge3') },
    { icon: Fingerprint, label: t('privacyBadge4') },
  ];

  const networkNodes = [
    { x: 20, y: 22, icon: Scale },
    { x: 78, y: 20, icon: Gavel },
    { x: 14, y: 50, icon: FileSearch },
    { x: 86, y: 50, icon: BarChart3 },
    { x: 24, y: 78, icon: Lightbulb },
    { x: 76, y: 80, icon: ShieldCheck },
  ];

  const connectionLines = networkNodes.map(node => {
    const dx = node.x - 50;
    const dy = node.y - 50;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      ...node,
      length,
      angle,
    };
  });

  return (
    <>
      {/* Hero block — dark gradient */}
      <section className="section-padding bg-gradient-to-br from-emerald-950 via-slate-900 to-cyan-950 text-white overflow-hidden relative noise-overlay">
        <FloatingParticles
          count={6}
          colors={['bg-emerald-500/8', 'bg-cyan-500/8', 'bg-teal-400/5']}
        />
        <GradientBlob
          className="top-0 left-1/3 animate-breathe"
          size={450}
          colors={['#059669', '#0891b2', '#134e4a']}
        />
        <GradientBlob
          className="bottom-0 right-1/4"
          size={350}
          colors={['#0891b2', '#059669', '#064e3b']}
        />

        <div className="container-wide relative z-10">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-12">
              <span className="section-label text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
                {t('label')}
              </span>
              <h2 className={sectionHeadingDarkClass}>{t('title')}</h2>
              <p className={sectionSubtitleDarkClass}>{t('subtitle')}</p>
            </div>
          </ScrollReveal>

          {/* Stats row */}
          <ScrollReveal delay={200} direction="up" distance={20}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-16">
              {stats.map((s, i) => (
                <div
                  key={i}
                  className="text-center glass-card-dark p-5 rounded-xl"
                >
                  <div className="text-3xl font-extrabold text-emerald-400">
                    {s.v}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>

          {/* Animated network visual */}
          <ScrollReveal delay={300} direction="up" distance={40}>
            <ScrollTransform
              offsetPx={90}
              style={p => {
                const eased = 1 - Math.pow(1 - p, 3);
                return {
                  transform: `translateY(${(1 - eased) * 18}px) scale(${0.96 + eased * 0.04})`,
                  opacity: 0.7 + eased * 0.3,
                  transition: 'transform 120ms linear, opacity 120ms linear',
                  willChange: 'transform, opacity',
                };
              }}
            >
              <div
                className="collective-network-shell mx-auto max-w-4xl"
                aria-hidden="true"
              >
                <div className="collective-network-grid" />
                <div className="collective-network-glow collective-network-glow--left" />
                <div className="collective-network-glow collective-network-glow--right" />
                <div className="collective-network-glow collective-network-glow--bottom" />

                <div className="collective-network-stage">
                  {connectionLines.map((line, i) => (
                    <div
                      key={`line-${i}`}
                      className="collective-network-line"
                      style={{
                        left: '50%',
                        top: '50%',
                        width: `${line.length}%`,
                        transform: `translateY(-50%) rotate(${line.angle}deg)`,
                      }}
                    >
                      <span className="collective-network-line-track" />
                      <span
                        className="collective-network-line-pulse"
                        style={{ animationDelay: `${i * 380}ms` }}
                      />
                    </div>
                  ))}

                  {networkNodes.map((node, i) => {
                    const Icon = node.icon;
                    return (
                      <div
                        key={`node-${i}`}
                        className="collective-network-node"
                        style={{
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          animationDelay: `${i * 160}ms`,
                        }}
                      >
                        <span className="collective-network-node-core">
                          <Icon className="h-3.5 w-3.5 text-emerald-100" />
                        </span>
                      </div>
                    );
                  })}

                  <div className="collective-network-center-ring" />
                  <div className="collective-network-center-ring collective-network-center-ring--delay" />
                  <div className="collective-network-center">
                    <Network className="h-10 w-10 text-white" />
                  </div>
                </div>
              </div>
            </ScrollTransform>
          </ScrollReveal>
        </div>
      </section>

      {/* Benefits grid — 6 cards */}
      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-16">
              <span className="section-label text-emerald-700 bg-emerald-50 border border-emerald-100">
                {t('benefitsTitle')}
              </span>
              <p className={`${sectionSubtitleLightClass} mt-4`}>
                {t('benefitsSubtitle')}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <ScrollReveal
                key={b.tk}
                delay={i * 100}
                direction="up"
                distance={25}
              >
                <GlowCard glowColor="rgba(5,150,105,0.08)" className="h-full">
                  <div className="glass-card p-6 h-full group hover:-translate-y-1 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-600/25 transition-all duration-300">
                      <b.icon className="w-6 h-6" />
                    </div>
                    <h3 className={cardTitleLightClass}>{t(b.tk)}</h3>
                    <p className={cardBodyLightClass}>{t(b.dk)}</p>
                  </div>
                </GlowCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy assurance + CTA */}
      <section className="section-padding bg-gradient-to-br from-emerald-600 via-emerald-700 to-cyan-700 text-white text-center relative overflow-hidden noise-overlay">
        <FloatingParticles
          count={3}
          colors={['bg-white/5', 'bg-white/5', 'bg-emerald-300/8']}
        />
        <div className="container-wide relative z-10">
          <ScrollReveal direction="up" distance={25}>
            <div className="flex items-center justify-center gap-2 mb-6">
              <Lock className="w-5 h-5 text-emerald-200" />
              <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
                {t('privacyTitle')}
              </h3>
            </div>
            <p className="text-lg text-emerald-100 max-w-3xl mx-auto mb-8 leading-relaxed">
              {t('privacyDesc')}
            </p>

            <div className="max-w-3xl mx-auto mb-10">
              <div className="glass-card-dark p-5 rounded-2xl border border-white/10 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-200" />
                  <div className="font-semibold text-white">
                    {t('complianceNoteTitle')}
                  </div>
                </div>
                <div className="text-sm text-emerald-50/90 leading-relaxed">
                  {t('complianceNoteDesc')}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {privacyBadges.map(badge => {
                const Icon = badge.icon;
                return (
                  <span
                    key={badge.label}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium text-white border border-white/10 hover:border-white/25 hover:bg-white/15 transition-all duration-300"
                  >
                    <Icon className="w-4 h-4 text-emerald-300" />
                    {badge.label}
                  </span>
                );
              })}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200} direction="up" distance={15}>
            <h2 className={sectionHeadingDarkClass}>{t('ctaTitle')}</h2>
            <p className="text-lg text-emerald-100 max-w-3xl mx-auto mb-8 leading-relaxed">
              {t('ctaDesc')}
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 px-8 py-4 text-base font-semibold text-white shadow-[0_18px_42px_-20px_rgba(16,185,129,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-400 hover:shadow-[0_24px_48px_-20px_rgba(16,185,129,1)] active:translate-y-0 active:shadow-[0_14px_32px_-18px_rgba(16,185,129,0.9)] sm:min-w-[220px] sm:px-10 sm:py-5 sm:text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-800"
            >
              {t('ctaButton')}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}

function SecuritySection() {
  const t = useTranslations('security');
  const feats = [
    { icon: Shield, tk: 'feature1Title', dk: 'feature1Desc' },
    { icon: Lock, tk: 'feature2Title', dk: 'feature2Desc' },
    { icon: Server, tk: 'feature3Title', dk: 'feature3Desc' },
    { icon: ClipboardCheck, tk: 'feature4Title', dk: 'feature4Desc' },
    { icon: Users, tk: 'feature5Title', dk: 'feature5Desc' },
    { icon: Eye, tk: 'feature6Title', dk: 'feature6Desc' },
  ];
  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-accent-700 bg-accent-50 border border-accent-100">
              {t('label')}
            </span>
            <h2 className={sectionHeadingLightClass}>{t('title')}</h2>
            <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {feats.map((f, i) => (
            <ScrollReveal
              key={f.tk}
              delay={i * 80}
              direction={i < 3 ? 'left' : 'right'}
              distance={20}
              scale={0.94}
            >
              <GlowCard glowColor="rgba(5,150,105,0.08)" className="h-full">
                <div className="glass-card p-6 h-full group hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center mb-4 group-hover:bg-accent-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent-600/25 transition-all duration-300">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className={cardTitleLightClass}>{t(f.tk)}</h3>
                  <p className={cardBodyLightClass}>{t(f.dk)}</p>
                </div>
              </GlowCard>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal delay={400} direction="up" distance={15}>
          <div className="text-center mt-10">
            <MagneticButton strength={0.1}>
              <Link href="/security" className="btn-secondary focus-ring">
                {t('ctaButton')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </MagneticButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const t = useTranslations('testimonials');
  const testimonials = [1, 2, 3, 4, 5, 6].map(i => ({
    quote: t(`quote${i}`),
    author: t(`author${i}`),
    role: t(`role${i}`),
    location: t(`location${i}`),
  }));

  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setActive(prev => (prev + 1) % testimonials.length);
    }, 5000);
  }, [testimonials.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
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
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <section className="section-padding bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
              {t('label')}
            </span>
            <h2 className={sectionHeadingLightClass}>{t('title')}</h2>
            <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" distance={20}>
          <div className="max-w-4xl mx-auto">
            <div className="glass-card p-8 sm:p-10 text-center min-h-[280px] flex flex-col items-center justify-center relative">
              <Quote className="w-8 h-8 text-primary-200 absolute top-6 left-6" />

              <div key={active} className="animate-fade-in">
                <div className="flex items-center justify-center gap-1 mb-5">
                  {[0, 1, 2, 3, 4].map(star => (
                    <Star
                      key={star}
                      className="w-5 h-5 text-amber-400 fill-current"
                    />
                  ))}
                </div>

                <blockquote className="text-lg sm:text-2xl text-slate-800 leading-relaxed mb-7 font-medium italic max-w-3xl text-balance">
                  &ldquo;{current.quote}&rdquo;
                </blockquote>

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
        </ScrollReveal>
      </div>
    </section>
  );
}

function PricingPreviewSection() {
  const t = useTranslations('pricing');

  const plans = [
    {
      name: 'soloName',
      desc: 'soloDesc',
      price: 'soloPrice',
      valueProp: 'soloValueProp',
      tokens: 'soloTokensMonth',
      cta: 'ctaSolo',
      href: '/pricing',
      feats: [
        'soloFeature1',
        'soloFeature2',
        'soloFeature3',
        'soloFeature5',
        'soloFeature7',
      ],
      highlighted: false,
      badge: null,
      isCustom: false,
    },
    {
      name: 'kanzleiName',
      desc: 'kanzleiDesc',
      price: 'kanzleiPrice',
      valueProp: 'kanzleiValueProp',
      tokens: 'kanzleiTokensMonth',
      cta: 'ctaKanzlei',
      href: '/pricing',
      feats: [
        'kanzleiFeature1',
        'kanzleiFeature2',
        'kanzleiFeature3',
        'kanzleiFeature4',
        'kanzleiFeature6',
        'kanzleiFeature9',
      ],
      highlighted: true,
      badge: t('popular'),
      isCustom: false,
    },
    {
      name: 'businessName',
      desc: 'businessDesc',
      price: 'businessPrice',
      valueProp: 'businessValueProp',
      tokens: 'businessTokensMonth',
      cta: 'ctaBusiness',
      href: '/pricing',
      feats: [
        'businessFeature1',
        'businessFeature2',
        'businessFeature3',
        'businessFeature5',
        'businessFeature9',
        'businessFeature10',
      ],
      highlighted: false,
      badge: t('bestValue'),
      isCustom: false,
    },
    {
      name: 'enterpriseName',
      desc: 'enterpriseDesc',
      price: 'enterprisePrice',
      valueProp: 'enterpriseValueProp',
      tokens: 'enterpriseTokensMonth',
      cta: 'ctaEnterprise',
      href: '/pricing',
      feats: [
        'enterpriseFeature1',
        'enterpriseFeature2',
        'enterpriseFeature3',
        'enterpriseFeature5',
        'enterpriseFeature6',
      ],
      highlighted: false,
      badge: null,
      isCustom: true,
    },
  ];

  return (
    <section className="section-padding bg-white">
      <div className="container-wide">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-primary-600 uppercase tracking-wider">
            {t('label')}
          </span>
          <h2 className={sectionHeadingLightClass}>{t('title')}</h2>
          <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            {t('guaranteed')}
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`glass-card p-7 flex flex-col relative ${plan.highlighted ? 'ring-2 ring-primary-600 shadow-xl' : ''}`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-white text-xs font-bold rounded-full whitespace-nowrap ${plan.highlighted ? 'bg-primary-600' : 'bg-accent-600'}`}
                >
                  {plan.badge}
                </div>
              )}
              <h3 className="text-lg font-bold text-slate-900 mb-1 leading-snug">
                {t(plan.name)}
              </h3>
              <p className="text-sm text-slate-500 mb-3 min-h-[36px]">
                {t(plan.desc)}
              </p>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-50 text-accent-700 rounded-lg text-xs font-semibold mb-4 w-fit">
                <Zap className="w-3.5 h-3.5" />
                {t(plan.valueProp)}
              </div>
              <div className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold mb-4 w-fit">
                <span title={t('creditsTooltip')}>{t(plan.tokens)}</span>
              </div>
              <div className="mb-5">
                {plan.isCustom ? (
                  <span className="text-3xl font-extrabold text-slate-900">
                    {t(plan.price)}
                  </span>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-slate-900">
                      &euro;{t(plan.price)}
                    </span>
                    <span className="text-slate-500 text-sm ml-1">
                      {t('perMonth')}
                    </span>
                  </>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.feats.map(k => (
                  <li
                    key={k}
                    className="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <CheckCircle2 className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" />
                    {t(k)}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`${plan.highlighted ? 'btn-primary' : 'btn-secondary'} w-full text-center ${plan.highlighted ? 'focus-ring-on-dark' : 'focus-ring'}`}
              >
                {t(plan.cta)}
              </Link>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            href="/pricing"
            className="text-primary-600 hover:text-primary-700 font-medium text-sm inline-flex items-center gap-1 focus-ring rounded-md px-1"
          >
            {t('comparisonCta')}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function IntegrationSection() {
  const t = useTranslations('integration');
  const tools = [
    'tool1',
    'tool2',
    'tool3',
    'tool4',
    'tool5',
    'tool6',
    'tool7',
    'tool8',
  ];
  return (
    <section className="section-padding bg-slate-50 overflow-hidden">
      <div className="container-wide">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-12">
            <h2 className={sectionHeadingLightClass}>{t('title')}</h2>
            <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <SmoothMarquee speed={35} className="py-4">
          {tools.map(tk => (
            <div
              key={tk}
              className="px-8 py-4 bg-white rounded-xl border border-slate-200/80 shadow-sm text-sm font-medium text-slate-700 hover:shadow-md hover:border-primary-200 hover:text-primary-700 transition-all duration-300 flex-shrink-0 cursor-default"
            >
              {t(tk)}
            </div>
          ))}
        </SmoothMarquee>
      </div>
    </section>
  );
}

function FaqSection() {
  const t = useTranslations('faq');
  const faqs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({
    q: `q${i}`,
    a: `a${i}`,
  }));
  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern" />
      <div className="container-wide relative">
        <ScrollReveal direction="up" distance={25}>
          <div className="text-center mb-16">
            <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
              {t('label')}
            </span>
            <h2 className={sectionHeadingLightClass}>{t('title')}</h2>
            <p className={sectionSubtitleLightClass}>{t('subtitle')}</p>
          </div>
        </ScrollReveal>
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, i) => (
            <ScrollReveal
              key={faq.q}
              delay={i * 60}
              direction="up"
              distance={15}
            >
              <details className="group glass-card overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-semibold text-slate-900 hover:text-primary-600 transition-colors duration-300 focus-ring rounded-xl">
                  {t(faq.q)}
                  <ChevronRight className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform duration-300 flex-shrink-0 ml-4" />
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  {t(faq.a)}
                </div>
              </details>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const t = useTranslations('cta');
  return (
    <PrefooterCta
      title={t('title')}
      subtitle={t('subtitle')}
      primaryAction={{ href: '/pricing', label: t('button') }}
      secondaryAction={{ href: '/features', label: t('details') }}
      meta={t('note')}
      titleClassName="lg:text-5xl tracking-tight text-balance leading-[1.1]"
    />
  );
}
