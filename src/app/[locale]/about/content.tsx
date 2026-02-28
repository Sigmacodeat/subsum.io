'use client';

import { Brain, Eye, Shield, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  FloatingParticles,
  GlowCard,
  GradientBlob,
  Parallax,
  ScrollLightSweep,
  ScrollProgressBar,
  ScrollReveal,
  ScrollScale,
  TextRevealByWord,
} from '@/components/animations';
import { PrefooterCta } from '@/components/prefooter-cta';
import { APP_SIGN_UP_URL } from '@/utils/app-auth';

export default function AboutContent() {
  const t = useTranslations('about');

  const values = [
    { icon: Shield, tk: 'value1Title', dk: 'value1Desc' },
    { icon: Brain, tk: 'value2Title', dk: 'value2Desc' },
    { icon: Eye, tk: 'value3Title', dk: 'value3Desc' },
    { icon: Zap, tk: 'value4Title', dk: 'value4Desc' },
  ];

  const milestones = [1, 2, 3, 4, 5].map(i => ({
    date: t(`milestone${i}Date`),
    title: t(`milestone${i}Title`),
    desc: t(`milestone${i}Desc`),
  }));

  return (
    <>
      <ScrollProgressBar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
        <Parallax speed={0.05} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern" />
        </Parallax>
        <ScrollLightSweep className="absolute inset-0" intensity={0.2} />
        <FloatingParticles
          count={4}
          colors={['bg-primary-400/10', 'bg-cyan-400/8', 'bg-sky-300/8']}
        />
        <Parallax speed={0.03} className="absolute inset-0">
          <GradientBlob
            className="-top-40 -left-40 animate-breathe"
            size={500}
            colors={['#0E7490', '#1E40AF', '#ecfeff']}
          />
        </Parallax>
        <Parallax speed={0.06} className="absolute inset-0">
          <GradientBlob
            className="-bottom-60 -right-40"
            size={400}
            colors={['#1E40AF', '#0E7490', '#dbeafe']}
          />
        </Parallax>
        <div className="container-wide text-center relative">
          <ScrollReveal delay={100} direction="up" distance={18}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-primary-100/80 text-primary-700 text-sm font-medium mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 animate-pulse-slow" />
              {t('valuesTitle')}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200} direction="up" distance={26}>
            <TextRevealByWord
              text={t('pageTitle')}
              tag="h1"
              staggerMs={44}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 text-balance"
            />
          </ScrollReveal>
          <ScrollReveal delay={320} direction="up" distance={16}>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              {t('pageSubtitle')}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Mission */}
      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide max-w-4xl relative">
          <ScrollReveal direction="left" distance={30}>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              {t('missionTitle')}
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-12">
              {t('missionDesc')}
            </p>
          </ScrollReveal>
          <ScrollReveal direction="right" distance={30} delay={200}>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              {t('storyTitle')}
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              {t('storyDesc')}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <FloatingParticles
          count={3}
          colors={['bg-primary-300/8', 'bg-cyan-300/6', 'bg-slate-200/15']}
        />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-12">
              <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
                {t('valuesTitle')}
              </span>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <ScrollScale
                key={v.tk}
                startScale={0.9}
                endScale={1}
                startOpacity={0}
                endOpacity={1}
                offsetPx={40 + (i % 4) * 25}
              >
                <GlowCard glowColor="rgba(30,64,175,0.08)" className="h-full">
                  <div className="glass-card p-6 text-center h-full group hover:-translate-y-1 transition-all duration-300">
                    <div className="w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary-600/25 transition-all duration-300">
                      <v.icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {t(v.tk)}
                    </h3>
                    <p className="text-sm text-slate-600">{t(v.dk)}</p>
                  </div>
                </GlowCard>
              </ScrollScale>
            ))}
          </div>
        </div>
      </section>

      {/* Milestones Timeline */}
      <section className="section-padding bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-12">
              {t('milestonesTitle')}
            </h2>
          </ScrollReveal>
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 sm:left-1/2 sm:-translate-x-px overflow-hidden">
              <div className="h-full w-full bg-gradient-to-b from-primary-300 via-primary-400 to-cyan-400" />
            </div>
            {milestones.map((m, i) => (
              <ScrollReveal
                key={m.date}
                delay={i * 150}
                direction={i % 2 === 0 ? 'left' : 'right'}
                distance={30}
              >
                <div
                  className={`relative flex items-start gap-8 mb-14 ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}
                >
                  <div className="hidden sm:block flex-1" />
                  <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 mt-1.5 z-10">
                    <div className="w-4 h-4 bg-primary-600 rounded-full border-4 border-white shadow-md" />
                    <div className="absolute inset-0 w-4 h-4 bg-primary-400 rounded-full animate-ping opacity-20" />
                  </div>
                  <div className="flex-1 ml-12 sm:ml-0">
                    <div className="glass-card p-5 hover:-translate-y-0.5 transition-all duration-300">
                      <span className="text-xs font-bold text-primary-600 uppercase tracking-wider">
                        {m.date}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        {m.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">{m.desc}</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <PrefooterCta
        title={t('ctaTitle')}
        subtitle={t('ctaDesc')}
        primaryAction={{
          href: APP_SIGN_UP_URL,
          label: t('ctaButton'),
        }}
      />
    </>
  );
}
