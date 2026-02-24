'use client';

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Gavel,
  Lock,
  Minus,
  Network,
  Search,
  Server,
  Shield,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { type ReactNode } from 'react';

import {
  FloatingElement,
  FloatingParticles,
  GradientBlob,
  MagneticButton,
  ScrollLightSweep,
  ScrollReveal,
  ScrollScale,
  ScrollTransform,
  TextRevealByWord,
  useResponsiveMotionScale,
  WaveDivider,
} from '@/components/animations';
import {
  ContradictionDetectorIllustration,
  DeadlineTimelineIllustration,
  DocumentBuilderIllustration,
  DocumentPipelineIllustration,
  EvidenceBoardIllustration,
  JudikaturSearchIllustration,
  JurisdictionMapIllustration,
  NeuralNetworkIllustration,
  TeamDashboardIllustration,
} from '@/components/feature-illustrations';
import { PrefooterCta } from '@/components/prefooter-cta';
import { Link } from '@/i18n/routing';

/* ═══════════════════════════════════════════════════════════════
   Feature definitions with unique illustrations
   ═══════════════════════════════════════════════════════════════ */
interface FeatureDef {
  icon: typeof Upload;
  tk: string;
  dk: string;
  slug: string;
  color: string;
  gradient: string;
  particleColors: string[];
  illustration: () => ReactNode;
}

const FEATURE_STAGE_LABELS = {
  de: [
    ['Upload', 'OCR', 'Semantik'],
    ['Quellen', 'Abgleich', 'Signal'],
    ['Ereignis', 'Frist', 'Erinnerung'],
    ['Suche', 'Treffer', 'Fundstelle'],
    ['Vorlage', 'Kontext', 'Entwurf'],
    ['Beleg', 'Bewertung', 'Luecke'],
    ['Norm', 'Abgleich', 'Sicherheit'],
    ['Mandat', 'Aufgabe', 'Status'],
    ['Wissen', 'Muster', 'Empfehlung'],
  ],
  en: [
    ['Upload', 'OCR', 'Semantics'],
    ['Sources', 'Cross-check', 'Signal'],
    ['Event', 'Deadline', 'Reminder'],
    ['Search', 'Match', 'Citation'],
    ['Template', 'Context', 'Draft'],
    ['Evidence', 'Rating', 'Gap'],
    ['Norms', 'Alignment', 'Certainty'],
    ['Client', 'Task', 'Status'],
    ['Knowledge', 'Pattern', 'Recommendation'],
  ],
} as const;

const CINEMATIC_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const FEATURES: FeatureDef[] = [
  {
    icon: Upload,
    tk: 'feature1Title',
    dk: 'feature1Desc',
    slug: 'smart-document-processing',
    color: 'from-blue-500 to-indigo-600',
    gradient: 'from-blue-50/40 to-indigo-50/40',
    particleColors: ['bg-blue-300/15', 'bg-indigo-300/15', 'bg-cyan-300/15'],
    illustration: () => <DocumentPipelineIllustration />,
  },
  {
    icon: Eye,
    tk: 'feature2Title',
    dk: 'feature2Desc',
    slug: 'contradiction-detection',
    color: 'from-red-500 to-orange-600',
    gradient: 'from-red-50/30 to-orange-50/30',
    particleColors: ['bg-red-300/15', 'bg-orange-300/15', 'bg-amber-300/15'],
    illustration: () => <ContradictionDetectorIllustration />,
  },
  {
    icon: Clock,
    tk: 'feature3Title',
    dk: 'feature3Desc',
    slug: 'deadline-automation',
    color: 'from-amber-500 to-yellow-600',
    gradient: 'from-amber-50/30 to-yellow-50/30',
    particleColors: ['bg-amber-300/18', 'bg-yellow-300/16', 'bg-red-300/10'],
    illustration: () => <DeadlineTimelineIllustration />,
  },
  {
    icon: Search,
    tk: 'feature4Title',
    dk: 'feature4Desc',
    slug: 'case-law-research',
    color: 'from-cyan-500 to-sky-600',
    gradient: 'from-cyan-50/30 to-sky-50/30',
    particleColors: ['bg-cyan-300/16', 'bg-sky-300/14', 'bg-blue-300/12'],
    illustration: () => <JudikaturSearchIllustration />,
  },
  {
    icon: FileText,
    tk: 'feature5Title',
    dk: 'feature5Desc',
    slug: 'document-builder',
    color: 'from-green-500 to-emerald-600',
    gradient: 'from-green-50/30 to-emerald-50/30',
    particleColors: ['bg-green-300/15', 'bg-emerald-300/15', 'bg-teal-300/12'],
    illustration: () => <DocumentBuilderIllustration />,
  },
  {
    icon: FolderOpen,
    tk: 'feature6Title',
    dk: 'feature6Desc',
    slug: 'evidence-management',
    color: 'from-cyan-500 to-teal-600',
    gradient: 'from-cyan-50/30 to-teal-50/30',
    particleColors: ['bg-teal-300/14', 'bg-cyan-300/14', 'bg-emerald-300/12'],
    illustration: () => <EvidenceBoardIllustration />,
  },
  {
    icon: Gavel,
    tk: 'feature7Title',
    dk: 'feature7Desc',
    slug: 'multi-jurisdiction-support',
    color: 'from-indigo-500 to-blue-600',
    gradient: 'from-indigo-50/30 to-blue-50/30',
    particleColors: ['bg-indigo-300/15', 'bg-blue-300/12', 'bg-violet-300/10'],
    illustration: () => <JurisdictionMapIllustration />,
  },
  {
    icon: Users,
    tk: 'feature8Title',
    dk: 'feature8Desc',
    slug: 'firm-management',
    color: 'from-pink-500 to-rose-600',
    gradient: 'from-pink-50/30 to-rose-50/30',
    particleColors: ['bg-pink-300/15', 'bg-rose-300/15', 'bg-red-300/10'],
    illustration: () => <TeamDashboardIllustration />,
  },
  {
    icon: Network,
    tk: 'feature9Title',
    dk: 'feature9Desc',
    slug: 'collective-intelligence',
    color: 'from-emerald-500 to-cyan-600',
    gradient: 'from-emerald-50/30 to-cyan-50/30',
    particleColors: ['bg-emerald-300/15', 'bg-cyan-300/15', 'bg-teal-300/12'],
    illustration: () => <NeuralNetworkIllustration />,
  },
];

const COMP_ROWS = [
  'comp1',
  'comp2',
  'comp3',
  'comp4',
  'comp5',
  'comp6',
  'comp7',
  'comp8',
  'comp9',
  'comp10',
];

interface FeatureMotion {
  illustrationDistance: number;
  illustrationDuration: number;
  textDistance: number;
  textDuration: number;
  textDelay: number;
  titleStagger: number;
  sweepIntensity: number;
}

const FEATURE_MOTION: FeatureMotion[] = [
  {
    illustrationDistance: 34,
    illustrationDuration: 760,
    textDistance: 22,
    textDuration: 660,
    textDelay: 90,
    titleStagger: 42,
    sweepIntensity: 0.14,
  },
  {
    illustrationDistance: 40,
    illustrationDuration: 820,
    textDistance: 26,
    textDuration: 720,
    textDelay: 110,
    titleStagger: 46,
    sweepIntensity: 0.18,
  },
  {
    illustrationDistance: 36,
    illustrationDuration: 780,
    textDistance: 24,
    textDuration: 700,
    textDelay: 100,
    titleStagger: 44,
    sweepIntensity: 0.16,
  },
  {
    illustrationDistance: 38,
    illustrationDuration: 800,
    textDistance: 25,
    textDuration: 690,
    textDelay: 95,
    titleStagger: 43,
    sweepIntensity: 0.17,
  },
  {
    illustrationDistance: 35,
    illustrationDuration: 740,
    textDistance: 23,
    textDuration: 670,
    textDelay: 90,
    titleStagger: 41,
    sweepIntensity: 0.15,
  },
  {
    illustrationDistance: 39,
    illustrationDuration: 790,
    textDistance: 26,
    textDuration: 710,
    textDelay: 108,
    titleStagger: 45,
    sweepIntensity: 0.17,
  },
  {
    illustrationDistance: 37,
    illustrationDuration: 770,
    textDistance: 24,
    textDuration: 680,
    textDelay: 96,
    titleStagger: 42,
    sweepIntensity: 0.16,
  },
  {
    illustrationDistance: 40,
    illustrationDuration: 810,
    textDistance: 27,
    textDuration: 730,
    textDelay: 112,
    titleStagger: 47,
    sweepIntensity: 0.18,
  },
  {
    illustrationDistance: 38,
    illustrationDuration: 790,
    textDistance: 25,
    textDuration: 705,
    textDelay: 102,
    titleStagger: 44,
    sweepIntensity: 0.17,
  },
];

function featureMotion(i: number): FeatureMotion {
  return FEATURE_MOTION[i] ?? FEATURE_MOTION[0];
}

/* ═══════════════════════════════════════════════════════════════
   Section background alternation
   ═══════════════════════════════════════════════════════════════ */
function sectionBg(i: number): string {
  if (i % 3 === 0) return 'bg-white';
  if (i % 3 === 1) return 'bg-slate-50/80';
  return 'bg-white';
}

function sectionPattern(i: number): string {
  if (i % 3 === 0) return 'dot-pattern';
  if (i % 3 === 1) return 'grid-pattern opacity-40';
  return 'dot-pattern';
}

/* ═══════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════ */
export default function FeaturesContent() {
  const locale = useLocale();
  const localeBucket = locale.startsWith('de') ? 'de' : 'en';
  const isGermanLocale = locale.startsWith('de');
  const t = useTranslations('features');
  const tCta = useTranslations('cta');
  const motionScale = useResponsiveMotionScale();
  const cinematicTempo =
    motionScale < 0.65 ? 0.84 : motionScale < 0.9 ? 0.94 : 1;
  const tempoMs = (baseMs: number) => Math.round(baseMs * cinematicTempo);
  const semanticDbLabel = locale.startsWith('de')
    ? 'Semantische KI-Datenbank erklärt'
    : 'Semantic AI database explained';
  const ctaTrustBadges = [
    { icon: Shield, label: 'DSGVO-konform' },
    { icon: Lock, label: 'AES-256' },
    { icon: Server, label: 'EU-Hosting' },
  ];
  const comparisonLabel = isGermanLocale ? 'Vergleich' : 'Comparison';

  return (
    <>
      {/* ━━━ HERO ━━━ */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
        <div className="absolute inset-0 grid-pattern" />
        <ScrollLightSweep className="absolute inset-0" intensity={0.2} />
        <GradientBlob
          className="-top-40 -right-40 animate-breathe"
          size={600}
          colors={['#1E40AF', '#0E7490', '#dbeafe']}
        />
        <GradientBlob
          className="-bottom-60 -left-40"
          size={400}
          colors={['#0E7490', '#1E40AF', '#ecfeff']}
        />

        {/* Floating feature icons in background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[Upload, Eye, Clock, Search, FileText, Gavel, Users, Network].map(
            (Icon, i) => (
              <FloatingElement
                key={i}
                amplitude={12 + i * 3}
                duration={7 + i * 0.8}
                delay={i * 0.5}
                className={`absolute ${i >= 4 ? 'hidden sm:block' : ''}`}
              >
                <div
                  style={{
                    left: `${8 + i * 11}%`,
                    top: `${15 + (i % 3) * 25}%`,
                    position: 'absolute',
                  }}
                >
                  <Icon
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-primary-300/20 sm:text-primary-300/24`}
                  />
                </div>
              </FloatingElement>
            )
          )}
        </div>

        <div className="container-wide text-center relative">
          <ScrollReveal delay={80} direction="up" distance={18} duration={640}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-primary-100/80 text-primary-700 text-sm font-medium mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 animate-pulse-slow" />9 {t('label')}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={160} direction="up" distance={26} duration={700}>
            <TextRevealByWord
              text={t('pageTitle')}
              tag="h1"
              staggerMs={tempoMs(36)}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 text-balance leading-[1.08]"
            />
          </ScrollReveal>

          <ScrollReveal delay={300} direction="up" distance={16} duration={660}>
            <ScrollTransform
              offsetPx={110}
              style={progress => {
                const p = Math.max(0, Math.min(1, progress));
                return {
                  transform: `translateY(${(1 - p) * 8}px)`,
                  opacity: 0.75 + p * 0.25,
                  transition: `transform ${tempoMs(220)}ms ${CINEMATIC_EASE}, opacity ${tempoMs(240)}ms ${CINEMATIC_EASE}`,
                };
              }}
            >
              <p className="text-base sm:text-lg lg:text-xl text-slate-700 max-w-3xl lg:max-w-4xl mx-auto mb-10 sm:mb-11 lg:mb-12 text-balance leading-relaxed">
                {t('pageSubtitle')}
              </p>
              <div className="flex items-center justify-center mb-4 sm:mb-5">
                <Link
                  href="/semantic-database"
                  className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-colors focus-ring"
                >
                  <Network className="w-4 h-4 text-primary-600" />
                  {semanticDbLabel}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </ScrollTransform>
          </ScrollReveal>

          <ScrollReveal delay={420} direction="up" distance={16} duration={640}>
            <div className="flex w-full flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-5">
              <MagneticButton strength={0.12}>
                <Link
                  href="/pricing"
                  className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[220px] text-lg !px-10 !py-5"
                >
                  {tCta('button')}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </MagneticButton>
              <MagneticButton strength={0.12}>
                <Link
                  href="#features-list"
                  className="btn-secondary inline-flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[220px] text-lg !px-10 !py-5"
                >
                  {tCta('details')}
                </Link>
              </MagneticButton>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ━━━ FEATURE BLOCKS — each with unique illustration ━━━ */}
      {FEATURES.map((f, i) => {
        const isEven = i % 2 === 0;
        const stageLabels =
          FEATURE_STAGE_LABELS[localeBucket][i] ??
          FEATURE_STAGE_LABELS[localeBucket][0];
        const bg = sectionBg(i);
        const pattern = sectionPattern(i);
        const motion = featureMotion(i);
        return (
          <section
            key={f.tk}
            id={i === 0 ? 'features-list' : undefined}
            className={`section-padding scroll-mt-24 ${bg} relative overflow-hidden group/feature`}
          >
            <div className={`absolute inset-0 ${pattern}`} />

            {/* Subtle gradient overlay matching feature color */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${f.gradient} pointer-events-none`}
            />
            <FloatingParticles
              className="opacity-80"
              count={4 + (i % 2)}
              colors={f.particleColors}
            />

            {/* Premium light sweep on scroll */}
            <ScrollLightSweep
              className="absolute inset-0"
              intensity={motion.sweepIntensity}
            />

            <div className="container-wide relative">
              <ScrollTransform
                offsetPx={132}
                style={progress => {
                  const p = Math.max(0, Math.min(1, progress));
                  return {
                    transform: `translateY(${(1 - p) * 10}px) scale(${0.988 + p * 0.012})`,
                    opacity: 0.8 + p * 0.2,
                    transition: `transform ${tempoMs(260)}ms ${CINEMATIC_EASE}, opacity ${tempoMs(260)}ms ${CINEMATIC_EASE}`,
                  };
                }}
              >
                <div
                  className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-10 md:gap-12 lg:gap-20`}
                >
                  {/* Illustration side */}
                  <ScrollReveal
                    direction={isEven ? 'left' : 'right'}
                    distance={motion.illustrationDistance}
                    duration={tempoMs(motion.illustrationDuration)}
                    threshold={0.18}
                    className="flex-1 w-full"
                  >
                    {f.illustration()}
                  </ScrollReveal>

                  {/* Text side */}
                  <ScrollReveal
                    direction={isEven ? 'right' : 'left'}
                    distance={motion.textDistance}
                    duration={tempoMs(motion.textDuration)}
                    delay={tempoMs(motion.textDelay)}
                    threshold={0.2}
                    className="flex-1"
                  >
                    {/* Feature badge */}
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className={`relative w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/10 transition-all duration-300 group-hover/feature:scale-105 bg-gradient-to-br ${f.color} border border-white/35`}
                      >
                        <div className="absolute inset-0 rounded-xl ring-1 ring-white/45 animate-pulse" />
                        <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/90 px-1 text-[10px] font-bold text-slate-700 shadow-sm">
                          {String(i + 1)}
                        </span>
                        <f.icon className="w-6 h-6 text-white relative z-10" />
                      </div>
                    </div>

                    <TextRevealByWord
                      text={t(f.tk)}
                      tag="h2"
                      staggerMs={tempoMs(motion.titleStagger)}
                      className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-4 leading-[1.12] max-w-[18ch] text-balance"
                    />
                    <p className="text-base sm:text-lg leading-relaxed mb-8 text-slate-700/95 max-w-[58ch]">
                      {t(f.dk)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mb-7">
                      {stageLabels.map((label, stageIndex) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-full border border-blue-200/70 bg-white/75 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800"
                        >
                          {label}
                          {stageIndex < stageLabels.length - 1 && (
                            <ArrowRight className="w-3 h-3 ml-1.5 text-blue-500" />
                          )}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
                      <MagneticButton strength={0.08}>
                        <Link
                          href={`/features/${f.slug}`}
                          className="btn-secondary inline-flex w-full sm:w-auto justify-center !px-6 !py-3"
                        >
                          {tCta('details')}
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Link>
                      </MagneticButton>
                    </div>
                  </ScrollReveal>
                </div>
              </ScrollTransform>
            </div>
          </section>
        );
      })}

      {/* ━━━ WAVE DIVIDER ━━━ */}
      <WaveDivider fillClassName="fill-slate-50" />

      {/* ━━━ COMPARISON TABLE ━━━ */}
      <section className="section-padding bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <FloatingParticles
          count={5}
          className="opacity-70"
          colors={['bg-primary-300/12', 'bg-cyan-300/10', 'bg-slate-200/20']}
        />
        <ScrollLightSweep className="absolute inset-0" intensity={0.16} />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={22} duration={680}>
            <div className="text-center mb-12">
              <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
                {comparisonLabel}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mt-4 mb-4">
                {t('comparisonTitle')}
              </h2>
              <p className="text-lg text-slate-700 max-w-2xl mx-auto">
                {t('comparisonSubtitle')}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" distance={16} duration={760}>
            <div className="max-w-4xl mx-auto overflow-x-auto">
              <ScrollScale
                startScale={0.96}
                endScale={1}
                startOpacity={0.75}
                endOpacity={1}
                offsetPx={150}
              >
                <div className="glass-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200/80 bg-gradient-to-r from-primary-50/50 to-cyan-50/50">
                        <th className="text-left py-5 px-6 font-semibold text-slate-900">
                          {t('comparisonFeature')}
                        </th>
                        <th className="text-center py-5 px-4">
                          <div className="font-bold text-primary-600">
                            {t('comparisonUs')}
                          </div>
                          <div className="text-[10px] text-primary-400 font-medium mt-0.5">
                            Premium
                          </div>
                        </th>
                        <th className="text-center py-5 px-4 font-semibold text-slate-600">
                          {t('comparisonTraditional')}
                        </th>
                        <th className="text-center py-5 px-4 font-semibold text-slate-600">
                          {t('comparisonOther')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMP_ROWS.map((row, i) => (
                        <ScrollReveal
                          key={row}
                          as="tr"
                          delay={70 + i * 56}
                          direction="up"
                          distance={8}
                          duration={460}
                          threshold={0.12}
                          className="border-b border-slate-100/80 hover:bg-primary-50/30 transition-colors duration-300 group"
                        >
                          <td className="py-4 px-6 font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                            {t(row)}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <CheckCircle2 className="w-5 h-5 text-accent-500 mx-auto drop-shadow-sm transition-transform duration-300 group-hover:scale-110" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            {[
                              'comp1',
                              'comp2',
                              'comp4',
                              'comp5',
                              'comp9',
                              'comp10',
                            ].includes(row) ? (
                              <X className="w-5 h-5 text-red-400 mx-auto" />
                            ) : (
                              <Minus className="w-5 h-5 text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            {['comp3', 'comp7', 'comp9', 'comp10'].includes(
                              row
                            ) ? (
                              <X className="w-5 h-5 text-red-400 mx-auto" />
                            ) : (
                              <Minus className="w-5 h-5 text-slate-300 mx-auto" />
                            )}
                          </td>
                        </ScrollReveal>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollScale>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ━━━ WAVE DIVIDER ━━━ */}
      <WaveDivider flip fillClassName="fill-slate-50" />

      <PrefooterCta
        title={tCta('title')}
        subtitle={tCta('subtitle')}
        primaryAction={{ href: '/pricing', label: tCta('button') }}
        secondaryAction={{ href: '/pricing', label: tCta('details') }}
        meta={tCta('note')}
        titleClassName="lg:text-6xl tracking-tight text-balance leading-[1.08]"
      >
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {ctaTrustBadges.map((badge, index) => (
            <FloatingElement
              key={badge.label}
              amplitude={4}
              duration={5.2 + index * 0.6}
              delay={index * 0.2}
            >
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium text-white border border-white/10 hover:border-white/25 hover:bg-white/15 transition-all duration-300">
                <badge.icon className="w-4 h-4 text-primary-200" />
                {badge.label}
              </span>
            </FloatingElement>
          ))}
        </div>
      </PrefooterCta>
    </>
  );
}
