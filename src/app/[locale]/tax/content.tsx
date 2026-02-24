'use client';

import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileSearch,
  FileText,
  Scale,
  Shield,
  Sparkles,
  Star,
} from 'lucide-react';
import { useLocale } from 'next-intl';

import {
  FloatingParticles,
  GlowCard,
  GradientBlob,
  MagneticButton,
  ScrollLightSweep,
  ScrollProgressBar,
  ScrollReveal,
  ScrollScale,
  SmoothMarquee,
  TextRevealByWord,
} from '@/components/animations';
import { PrefooterCta } from '@/components/prefooter-cta';
import { Link } from '@/i18n/routing';

export default function TaxOSContent() {
  const locale = useLocale();
  const isDE = locale.startsWith('de');

  const features = [
    {
      icon: FileSearch,
      title: isDE ? 'Bescheid-Prüfer KI' : 'Tax Assessment AI',
      description: isDE
        ? 'Automatischer Abgleich von Steuerbescheiden mit Steuererklärungen. Erkennt Diskrepanzen und generiert fertige Einspruchstexte nach § 355 AO.'
        : 'Automatic comparison of tax assessments with returns. Detects discrepancies and generates ready-to-file objection letters.',
      badge: isDE ? 'KI-gestützt' : 'AI-Powered',
      color: 'from-primary-500 to-primary-700',
    },
    {
      icon: Clock,
      title: isDE ? 'Fristen-Cockpit' : 'Deadline Cockpit',
      description: isDE
        ? 'Automatisches Tracking aller steuerlichen Fristen: UStVA, LStA, ESt, KSt, GewSt, Jahresabschluss. Erinnerungen 30, 14, 7 und 1 Tag vor Fälligkeit.'
        : 'Automatic tracking of all tax deadlines: VAT returns, payroll tax, income tax, corporate tax, trade tax, annual accounts.',
      badge: 'Compliance',
      color: 'from-amber-500 to-amber-700',
    },
    {
      icon: Brain,
      title: isDE ? 'Steuer-Denker KI' : 'Tax Advisor AI',
      description: isDE
        ? '7 Denk-Modi: Steuerberatung, Betriebsprüfung, Buchhaltung, Fristen, Einspruch, Steuergestaltung, BFH-Rechtsprechung.'
        : '7 thinking modes: tax advice, audit, accounting, deadlines, objections, tax planning, BFH case law.',
      badge: 'Premium',
      color: 'from-cyan-500 to-cyan-700',
    },
    {
      icon: FileText,
      title: isDE ? 'Dokument-Generator' : 'Document Generator',
      description: isDE
        ? '7 professionelle Templates: Einspruch, Fristverlängerung, Mandantenanschreiben, Vollmacht, Begleitschreiben, Gutachten, Honorarrechnung.'
        : '7 professional templates: objection letters, extension requests, client letters, power of attorney, cover letters, expert opinions, fee invoices.',
      badge: isDE ? 'Automatisiert' : 'Automated',
      color: 'from-green-500 to-emerald-600',
    },
    {
      icon: Calculator,
      title: isDE ? 'Buchungskreis-Management' : 'Mandate Management',
      description: isDE
        ? 'Vollständiges CRUD für Mandate: ESt, UStG, KSt, GewSt, Jahresabschluss, Fibu, Betriebsprüfung. Automatische Mandatsnummern-Generierung.'
        : 'Complete CRUD for mandates: income tax, VAT, corporate tax, trade tax, annual accounts, bookkeeping, audits.',
      badge: isDE ? 'Vollständig' : 'Complete',
      color: 'from-indigo-500 to-blue-600',
    },
    {
      icon: Shield,
      title: isDE ? 'Datenschutz & Sicherheit' : 'Privacy & Security',
      description: isDE
        ? 'DSGVO-konform, Ende-zu-Ende-Verschlüsselung, mandantengetrennte Datenhaltung. Steuergeheimniskonform nach § 30 AO.'
        : 'GDPR-compliant, end-to-end encryption, client-separated data storage. Tax secrecy compliant per § 30 AO.',
      badge: 'DSGVO / GDPR',
      color: 'from-accent-500 to-accent-700',
    },
  ];

  const stats = [
    {
      value: '35+',
      label: isDE ? 'Steuerrechtsnormen' : 'Tax Law Norms',
      sub: 'AO, EStG, UStG, KStG, GewStG',
    },
    {
      value: '7',
      label: isDE ? 'KI-Denk-Modi' : 'AI Thinking Modes',
      sub: isDE ? 'Beratung bis BFH' : 'Advisory to BFH',
    },
    {
      value: '10',
      label: isDE ? 'Fristen-Templates' : 'Deadline Templates',
      sub: isDE ? 'UStVA bis Klagefrist' : 'VAT to court deadlines',
    },
    {
      value: '99%',
      label: isDE ? 'Extraktionsgenauigkeit' : 'Extraction Accuracy',
      sub: isDE ? 'Bescheide & Belege' : 'Assessments & receipts',
    },
  ];

  const workflowSteps = isDE
    ? [
        {
          step: '01',
          title: 'Mandant anlegen',
          desc: 'Steuernummer, Finanzamt, Veranlagungsjahre — alles in Sekunden erfasst.',
        },
        {
          step: '02',
          title: 'Buchungskreis erstellen',
          desc: 'ESt 2025, UStVA Q3, Betriebsprüfung — strukturiert und übersichtlich.',
        },
        {
          step: '03',
          title: 'Bescheide hochladen',
          desc: 'KI extrahiert automatisch Beträge, Steuernummern und Zeiträume.',
        },
        {
          step: '04',
          title: 'Abgleich & Einspruch',
          desc: 'Diskrepanzen werden sofort erkannt. Einspruchstext auf Knopfdruck.',
        },
      ]
    : [
        {
          step: '01',
          title: 'Create Client',
          desc: 'Tax ID, tax office, assessment years — captured in seconds.',
        },
        {
          step: '02',
          title: 'Create Mandate',
          desc: 'Income tax 2025, VAT Q3, audit — structured and clear.',
        },
        {
          step: '03',
          title: 'Upload Assessments',
          desc: 'AI automatically extracts amounts, tax IDs and periods.',
        },
        {
          step: '04',
          title: 'Compare & Object',
          desc: 'Discrepancies detected instantly. Objection letter at the click of a button.',
        },
      ];

  const testimonials = [
    {
      quote: isDE
        ? 'Der Bescheid-Prüfer hat uns in der ersten Woche drei Einsprüche identifiziert, die wir sonst übersehen hätten.'
        : 'The assessment checker identified three objections in the first week that we would have missed.',
      author: 'Dr. Sabine Keller',
      role: isDE ? 'Steuerberaterin, München' : 'Tax Advisor, Munich',
    },
    {
      quote: isDE
        ? 'Endlich eine Software, die die Sprache der Steuerberatung spricht. Keine Anwaltsbegriffe, keine Verwirrung.'
        : 'Finally software that speaks the language of tax advisory. No legal jargon, no confusion.',
      author: 'Thomas Bergmann',
      role: isDE ? 'Wirtschaftsprüfer, Hamburg' : 'Auditor, Hamburg',
    },
    {
      quote: isDE
        ? 'Das Fristen-Cockpit hat unsere Compliance-Rate auf 100% gebracht. Kein Mandant verpasst mehr eine UStVA-Frist.'
        : 'The deadline cockpit brought our compliance rate to 100%. No client misses a VAT return deadline anymore.',
      author: 'Maria Hofmann',
      role: isDE ? 'Kanzleileiterin, Wien' : 'Firm Director, Vienna',
    },
  ];

  const taxNorms = [
    '§ 355 AO',
    '§ 172 AO',
    '§ 15 EStG',
    '§ 18 UStG',
    '§ 7 GewStG',
    '§ 8b KStG',
    '§ 147 AO',
    '§ 4 EStG',
    '§ 20 EStG',
    '§ 21 EStG',
    '§ 19 UStG',
    '§ 164 AO',
  ];

  const discrepancies = [
    {
      pos: isDE ? 'Einkommensteuer' : 'Income Tax',
      bescheid: '12.450,00 €',
      erkl: '11.200,00 €',
      diff: '+1.250,00 €',
      sev: 'critical' as const,
    },
    {
      pos: isDE
        ? 'Arbeitszimmer (§ 4 Abs. 5 EStG)'
        : 'Home Office (§ 4 Abs. 5 EStG)',
      bescheid: '—',
      erkl: '1.250,00 €',
      diff: isDE ? 'Verweigert' : 'Rejected',
      sev: 'high' as const,
    },
    {
      pos: isDE ? 'Solidaritätszuschlag' : 'Solidarity Surcharge',
      bescheid: '685,00 €',
      erkl: '616,00 €',
      diff: '+69,00 €',
      sev: 'medium' as const,
    },
  ];

  const checklistItems = isDE
    ? [
        'Automatischer Bescheid ↔ Erklärung Abgleich',
        'Einspruchstext nach § 357 AO auf Knopfdruck',
        'Aussetzung der Vollziehung (§ 361 AO) automatisch',
        'Fristwarnung 14, 7, 3 und 1 Tag vor Ablauf',
      ]
    : [
        'Automatic assessment ↔ return comparison',
        'Objection letter per § 357 AO at one click',
        'Suspension of enforcement (§ 361 AO) automatic',
        'Deadline warnings 14, 7, 3 and 1 day before expiry',
      ];

  const sevColors = {
    critical: 'bg-red-50 border-red-200/60 text-red-600',
    high: 'bg-amber-50 border-amber-200/60 text-amber-600',
    medium: 'bg-primary-50 border-primary-200/60 text-primary-600',
  };

  return (
    <>
      <ScrollProgressBar />

      {/* ━━━ HERO ━━━ */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
        <div className="absolute inset-0 grid-pattern" />
        <ScrollLightSweep className="absolute inset-0" intensity={0.2} />
        <GradientBlob
          className="-top-44 -right-44 animate-breathe"
          size={600}
          colors={['#1E40AF', '#0E7490', '#dbeafe']}
        />
        <GradientBlob
          className="-bottom-60 -left-40"
          size={450}
          colors={['#0E7490', '#1E40AF', '#ecfeff']}
        />
        <FloatingParticles
          count={5}
          colors={['bg-primary-400/10', 'bg-cyan-400/10', 'bg-sky-300/8']}
        />

        <div className="container-wide relative">
          <div className="max-w-4xl">
            <ScrollReveal delay={80} direction="up" distance={18}>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-primary-100/80 text-primary-700 text-sm font-medium mb-8 shadow-sm">
                <Calculator className="w-4 h-4" />
                {isDE
                  ? 'Tax OS — Steuerberatungs-Suite'
                  : 'Tax OS — Tax Advisory Suite'}
              </div>
            </ScrollReveal>

            <ScrollReveal delay={160} direction="up" distance={26}>
              <TextRevealByWord
                text={
                  isDE
                    ? 'Das KI-Betriebssystem für Steuerberatungskanzleien'
                    : 'The AI Operating System for Tax Advisory Firms'
                }
                tag="h1"
                staggerMs={42}
                className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 text-balance leading-[1.06]"
              />
            </ScrollReveal>

            <ScrollReveal delay={300} direction="up" distance={20}>
              <p className="text-lg sm:text-xl text-slate-700 max-w-3xl mb-10 text-pretty leading-relaxed">
                {isDE
                  ? 'Automatischer Bescheid-Abgleich, KI-gestützte Steuerberatung nach EStG/UStG/AO, intelligentes Fristen-Cockpit und professionelle Dokumentengenerierung — alles in einer Plattform.'
                  : 'Automatic assessment comparison, AI-powered tax advice based on EStG/UStG/AO, intelligent deadline cockpit and professional document generation — all in one platform.'}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={420} direction="up" distance={16}>
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
                <MagneticButton strength={0.12}>
                  <Link
                    href="/pricing"
                    className="btn-primary text-lg !px-10 !py-5"
                  >
                    {isDE ? 'Kostenlos testen' : 'Start Free Trial'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </MagneticButton>
                <MagneticButton strength={0.12}>
                  <Link
                    href="/pricing"
                    className="btn-secondary text-lg !px-10 !py-5"
                  >
                    {isDE ? 'Preise ansehen' : 'View pricing'}
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Link>
                </MagneticButton>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={550} direction="up" distance={16}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mt-12">
                {stats.map(stat => (
                  <div key={stat.label} className="text-center">
                    <div className="text-3xl sm:text-4xl font-extrabold gradient-text">
                      {stat.value}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      {stat.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {stat.sub}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ━━━ NORM TICKER ━━━ */}
      <section className="py-4 bg-primary-50/40 border-y border-slate-100 overflow-hidden">
        <SmoothMarquee speed={30}>
          {taxNorms.map(norm => (
            <span
              key={norm}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full text-sm font-bold text-primary-700 border border-primary-100/80 shadow-sm flex-shrink-0"
            >
              <Scale className="w-3 h-3" /> {norm}
            </span>
          ))}
        </SmoothMarquee>
      </section>

      {/* ━━━ FEATURES ━━━ */}
      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-16">
              <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
                {isDE ? 'Funktionen' : 'Features'}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mt-4 mb-4 text-balance leading-[1.12]">
                {isDE
                  ? 'Alles, was Ihre Kanzlei braucht'
                  : 'Everything your firm needs'}
              </h2>
              <p className="text-lg text-slate-700 max-w-2xl mx-auto">
                {isDE
                  ? 'Gebaut für Steuerberater, Wirtschaftsprüfer und Buchhalter — nicht für Anwälte.'
                  : 'Built for tax advisors, auditors and accountants — not lawyers.'}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <ScrollScale
                key={feature.title}
                startScale={0.9}
                endScale={1}
                startOpacity={0}
                endOpacity={1}
                offsetPx={40 + (i % 3) * 30}
              >
                <GlowCard glowColor="rgba(30,64,175,0.1)" className="h-full">
                  <div className="glass-card p-7 h-full group hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-start justify-between mb-5">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300`}
                      >
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100/80">
                        {feature.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </GlowCard>
              </ScrollScale>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ WORKFLOW ━━━ */}
      <section className="section-padding bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-16">
              <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
                {'Workflow'}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mt-4 mb-4 text-balance leading-[1.12]">
                {isDE
                  ? 'In 4 Schritten zur perfekten Kanzlei'
                  : '4 steps to the perfect firm'}
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[12.5%] right-[12.5%] h-px">
              <div
                className="h-full w-full bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200"
                style={{
                  maskImage:
                    'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                }}
              />
            </div>
            {workflowSteps.map((step, i) => (
              <ScrollReveal
                key={step.step}
                delay={i * 180}
                direction={i % 2 === 0 ? 'left' : 'right'}
                distance={25}
                scale={0.92}
              >
                <div className="relative text-center group">
                  <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-600/20 relative z-10 group-hover:shadow-xl group-hover:shadow-primary-600/30 group-hover:scale-105 transition-all duration-300">
                    <span className="text-white font-extrabold text-lg">
                      {step.step}
                    </span>
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl gradient-primary opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 z-0" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600">{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ BESCHEID-PRÜFER HIGHLIGHT ━━━ */}
      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <div className="glass-card rounded-3xl p-8 md:p-12 bg-gradient-to-br from-primary-50/40 to-cyan-50/40 border-primary-100/60">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <ScrollReveal direction="left" distance={30}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-100 text-red-600 text-sm font-bold mb-6">
                  <AlertTriangle className="w-4 h-4" />
                  {isDE
                    ? 'Einspruchsfrist: 1 Monat (§ 355 AO)'
                    : 'Objection deadline: 1 month (§ 355 AO)'}
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-5 leading-[1.15]">
                  {isDE
                    ? 'Kein Einspruch mehr verpassen'
                    : 'Never miss an objection again'}
                </h2>
                <p className="text-slate-700 leading-relaxed mb-8">
                  {isDE
                    ? 'Der Bescheid-Prüfer vergleicht automatisch jeden Steuerbescheid mit der eingereichten Erklärung. Betragsabweichungen, verweigerte Ansätze und falsche Steuersätze werden sofort erkannt — inklusive fertigem Einspruchstext.'
                    : 'The assessment checker automatically compares every tax assessment with the filed return. Amount discrepancies, rejected deductions and wrong tax rates are detected instantly — including a ready-to-send objection letter.'}
                </p>
                <div className="space-y-3">
                  {checklistItems.map(item => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-accent-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-700">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollReveal>

              <ScrollReveal direction="right" distance={30} delay={150}>
                <div className="glass-card p-6 rounded-2xl">
                  <p className="text-sm font-bold text-slate-500 mb-4">
                    {isDE ? 'Erkannte Diskrepanzen' : 'Detected Discrepancies'}
                  </p>
                  <div className="space-y-3">
                    {discrepancies.map(row => (
                      <div
                        key={row.pos}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${sevColors[row.sev]}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {row.pos}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {isDE ? 'Bescheid' : 'Assessment'}: {row.bescheid} ·{' '}
                            {isDE ? 'Erklärung' : 'Return'}: {row.erkl}
                          </div>
                        </div>
                        <span className="text-sm font-bold flex-shrink-0">
                          {row.diff}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-4 px-4 py-3 rounded-xl bg-primary-50 border border-primary-200/80 text-sm font-bold text-primary-700 hover:bg-primary-100 transition-colors duration-300 flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {isDE
                      ? 'Einspruch generieren (§ 355 AO)'
                      : 'Generate Objection (§ 355 AO)'}
                  </button>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ TESTIMONIALS ━━━ */}
      <section className="section-padding bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-16">
              <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
                {isDE ? 'Stimmen' : 'Testimonials'}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mt-4 mb-4 text-balance leading-[1.12]">
                {isDE ? 'Was Steuerberater sagen' : 'What tax advisors say'}
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <ScrollReveal
                key={t.author}
                delay={i * 100}
                direction="up"
                distance={20}
              >
                <GlowCard glowColor="rgba(30,64,175,0.06)" className="h-full">
                  <div className="glass-card p-6 flex flex-col h-full group hover:-translate-y-1 transition-all duration-300">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, j) => (
                        <Star
                          key={j}
                          className="w-4 h-4 text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform duration-300"
                          style={{ transitionDelay: `${j * 30}ms` }}
                        />
                      ))}
                    </div>
                    <blockquote className="text-slate-700 leading-relaxed mb-6 flex-1 italic">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <div className="border-t border-slate-100 pt-4">
                      <div className="font-semibold text-slate-900 text-sm">
                        {t.author}
                      </div>
                      <div className="text-xs text-slate-500">{t.role}</div>
                    </div>
                  </div>
                </GlowCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <PrefooterCta
        title={
          isDE
            ? 'Bereit für die Zukunft der Steuerberatung?'
            : 'Ready for the future of tax advisory?'
        }
        subtitle={
          isDE
            ? '14 Tage kostenlos testen. 14 Tage Geld-zurück-Garantie. Keine Kreditkarte erforderlich.'
            : '14-day free trial. 14-day money-back guarantee. No credit card required.'
        }
        primaryAction={{
          href: '/pricing',
          label: isDE ? 'Jetzt kostenlos starten' : 'Start for free now',
        }}
        secondaryAction={{
          href: '/pricing',
          label: isDE ? 'Preise ansehen' : 'View pricing',
        }}
        meta={
          isDE
            ? '14 Tage kostenlos · 14 Tage Geld-zurück-Garantie · Sofortiger Zugang'
            : '14-day free trial · 14-day money-back guarantee · Instant access'
        }
        titleClassName="lg:text-5xl tracking-tight text-balance leading-[1.1]"
      />
    </>
  );
}
