'use client';

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileSearch,
  Gavel,
  Lock,
  Network,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLocale } from 'next-intl';

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
import { Link } from '@/i18n/routing';
import { APP_SIGN_UP_URL } from '@/utils/app-auth';

export default function SemanticDatabaseContent() {
  const locale = useLocale();
  const isGerman = locale.toLowerCase().startsWith('de');

  const copy = {
    pageTitle: isGerman ? 'Semantische KI-Datenbank' : 'Semantic AI database',
    pageSubtitle: isGerman
      ? 'Subsumio speichert nicht nur Dokumente — es baut eine semantische Wissensbasis Ihrer Akten, damit KI Zusammenhänge versteht, Risiken erkennt und Ergebnisse nachvollziehbar belegen kann.'
      : "Subsumio doesn't just store documents — it builds a semantic case knowledge base so AI can understand context, detect risk, and ground results in verifiable sources.",

    conceptLabel: isGerman ? 'Das Konzept' : 'The concept',
    conceptTitle: isGerman
      ? 'Verstehen statt Keyword-Suche'
      : 'Understanding instead of keyword search',
    conceptDesc: isGerman
      ? 'Klassische Systeme speichern Dateien und Metadaten. Subsumio bildet Bedeutung ab: Aussagen, Rollen, Ereignisse, Normen und Beweisketten werden in einer semantischen Struktur verknüpft — damit die KI im Fallkontext arbeiten kann.'
      : 'Traditional systems store files and metadata. Subsumio models meaning: statements, roles, events, norms, and evidence chains are linked in a semantic structure — so AI can operate in case context.',

    pillarsLabel: isGerman ? 'Der Mehrwert' : 'The value',
    pillar1Title: isGerman
      ? 'Findet, was Sie meinen — nicht nur, was Sie tippen'
      : 'Finds what you mean — not just what you type',
    pillar1Desc: isGerman
      ? 'Semantische Suche versteht Synonyme, juristische Formulierungen und Kontext. Das reduziert Treffer-Lotterie und spart Zeit bei komplexen Akten.'
      : 'Semantic search understands synonyms, legal phrasing, and context — reducing “hit-or-miss” results and saving time in complex matters.',
    pillar2Title: isGerman
      ? 'Querprüfung über die gesamte Akte'
      : 'Cross-check across the entire case',
    pillar2Desc: isGerman
      ? 'Widersprüche, Zeitlinien, Parteienrollen und Beweisbezüge werden aktenweit abgeglichen. Das senkt das Risiko, kritische Details zu übersehen.'
      : 'Contradictions, timelines, party roles, and evidence references are cross-checked across the case — lowering the risk of missing critical details.',
    pillar3Title: isGerman
      ? 'Belegbar und auditierbar'
      : 'Grounded and auditable',
    pillar3Desc: isGerman
      ? 'Ergebnisse sind an Quellenstellen gekoppelt. In Verbindung mit Audit-Trail und Rollenrechten ist das für Kanzlei-Compliance deutlich sicherer als reine Chat-Antworten.'
      : 'Outputs are tied to sources. Combined with audit trails and role-based access, this is substantially safer for compliance than ungrounded chat answers.',

    compareLabel: isGerman ? 'Vergleich' : 'Comparison',
    compareTitle: isGerman
      ? 'Traditionelle Datenbank vs. Semantische Wissensbasis'
      : 'Traditional database vs. semantic knowledge base',

    learnLabel: isGerman ? 'Warum wird es besser?' : 'Why it improves',
    learnTitle: isGerman
      ? 'Jeder Fall macht die Plattform smarter — ohne Mandantenrisiko'
      : 'Every case makes it smarter — without client risk',
    learnDesc: isGerman
      ? 'Wenn Akten verarbeitet werden, entstehen abstrahierte Muster (z.B. typische Argumentationsketten, Normverweise, Frist- und Ereignisstrukturen). Diese Muster können — anonymisiert und aggregiert — die Qualität der Vorschläge erhöhen. Rohdokumente werden nicht zwischen Kanzleien geteilt.'
      : 'When matters are processed, the system derives abstracted patterns (e.g., typical argument chains, norm references, deadline and event structures). These patterns can — anonymized and aggregated — improve suggestion quality. Raw documents are not shared across firms.',

    trustLabel: isGerman ? 'Sicherheit' : 'Security',
    trustTitle: isGerman
      ? 'Sicherheitsprinzipien, die Anwälte erwarten'
      : 'Security principles lawyers expect',

    ctaTitle: isGerman
      ? 'Bereit, Ihre Akten in Wissen zu verwandeln?'
      : 'Ready to turn case files into knowledge?',
    ctaSubtitle: isGerman
      ? 'Starten Sie mit einer Akte. Erleben Sie, wie semantisches Verständnis Recherche, Querprüfung und Dokumentarbeit spürbar sicherer macht.'
      : 'Start with one matter. Experience how semantic understanding makes research, cross-checking, and drafting noticeably safer.',

    ctaPrimary: isGerman ? 'Kostenlos testen' : 'Start free trial',
    ctaSecondary: isGerman ? 'Sicherheit ansehen' : 'View security',
  };

  const compareRows = [
    {
      left: isGerman
        ? 'Index: Schlüsselwörter/Metadaten'
        : 'Index: keywords/metadata',
      right: isGerman
        ? 'Index: Bedeutung + Kontext (semantisch)'
        : 'Index: meaning + context (semantic)',
    },
    {
      left: isGerman
        ? 'Suche: Treffer-Liste, viel manuelles Filtern'
        : 'Search: hit list, manual filtering',
      right: isGerman
        ? 'Suche: kontextbewusst, weniger Fehl-Treffer'
        : 'Search: context-aware, fewer false hits',
    },
    {
      left: isGerman
        ? 'Verknüpfung: Dateien/Ordner, wenig Querlogik'
        : 'Linking: folders/files, little cross-logic',
      right: isGerman
        ? 'Verknüpfung: Akte als Graph (Rollen/Ereignisse/Beweise)'
        : 'Linking: case graph (roles/events/evidence)',
    },
    {
      left: isGerman
        ? 'Risiko: Details werden leicht übersehen'
        : 'Risk: details are easy to miss',
      right: isGerman
        ? 'Risiko: automatische Querprüfung + Evidenzbezug'
        : 'Risk: automated cross-check + evidence linkage',
    },
  ];

  const trustPoints = [
    {
      icon: Shield,
      text: isGerman
        ? 'EU-Hosting & DSGVO-orientiert'
        : 'EU hosting & GDPR-oriented',
    },
    {
      icon: Lock,
      text: isGerman
        ? 'Verschlüsselung in Transit & at Rest'
        : 'Encryption in transit & at rest',
    },
    {
      icon: Network,
      text: isGerman
        ? 'Rollenrechte & Mandantentrennung'
        : 'Role-based access & separation',
    },
    {
      icon: CheckCircle2,
      text: isGerman
        ? 'Audit-Trail & Nachvollziehbarkeit'
        : 'Audit trails & traceability',
    },
  ];

  return (
    <>
      <ScrollProgressBar />

      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
        <Parallax speed={0.05} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern" />
        </Parallax>
        <ScrollLightSweep className="absolute inset-0" intensity={0.22} />
        <FloatingParticles
          count={5}
          colors={['bg-primary-400/10', 'bg-cyan-400/10', 'bg-sky-300/8']}
        />
        <Parallax speed={0.03} className="absolute inset-0">
          <GradientBlob
            className="-top-44 -right-44 animate-breathe"
            size={560}
            colors={['#1E40AF', '#0E7490', '#dbeafe']}
          />
        </Parallax>
        <Parallax speed={0.06} className="absolute inset-0">
          <GradientBlob
            className="-bottom-64 -left-44"
            size={420}
            colors={['#0E7490', '#1E40AF', '#ecfeff']}
          />
        </Parallax>

        <div className="container-wide relative">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal delay={90} direction="up" distance={18}>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-primary-100/80 text-primary-700 text-sm font-medium mb-8 shadow-sm">
                <Sparkles className="w-4 h-4 animate-pulse-slow" />
                {copy.conceptLabel}
              </div>
            </ScrollReveal>

            <ScrollReveal delay={180} direction="up" distance={26}>
              <TextRevealByWord
                text={copy.pageTitle}
                tag="h1"
                staggerMs={44}
                className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 text-balance leading-[1.06]"
              />
            </ScrollReveal>

            <ScrollReveal delay={280} direction="up" distance={16}>
              <p className="text-lg sm:text-xl text-slate-700 max-w-3xl mx-auto mb-10 text-balance leading-relaxed">
                {copy.pageSubtitle}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={380} direction="up" distance={16}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/pricing"
                  className="btn-primary text-lg !px-10 !py-5"
                >
                  {copy.ctaPrimary}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
                <Link
                  href="/security"
                  className="btn-secondary text-lg !px-10 !py-5"
                >
                  {copy.ctaSecondary}
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-14">
              <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
                {copy.conceptLabel}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mt-4 mb-4 text-balance leading-[1.12]">
                {copy.conceptTitle}
              </h2>
              <p className="text-lg text-slate-700 max-w-3xl mx-auto">
                {copy.conceptDesc}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: FileSearch,
                title: copy.pillar1Title,
                desc: copy.pillar1Desc,
                glow: 'rgba(30,64,175,0.10)',
              },
              {
                icon: Network,
                title: copy.pillar2Title,
                desc: copy.pillar2Desc,
                glow: 'rgba(14,116,144,0.10)',
              },
              {
                icon: BookOpen,
                title: copy.pillar3Title,
                desc: copy.pillar3Desc,
                glow: 'rgba(5,150,105,0.10)',
              },
            ].map((p, i) => (
              <ScrollScale
                key={p.title}
                startScale={0.9}
                endScale={1}
                startOpacity={0}
                endOpacity={1}
                offsetPx={40 + i * 30}
              >
                <GlowCard glowColor={p.glow} className="h-full">
                  <div className="glass-card p-7 h-full group hover:-translate-y-1 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary-600/25 transition-all duration-300">
                      <p.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {p.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </GlowCard>
              </ScrollScale>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-12">
              <span className="section-label text-slate-700 bg-white border border-slate-200">
                {copy.compareLabel}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-4 mb-4">
                {copy.compareTitle}
              </h2>
            </div>
          </ScrollReveal>

          <div className="max-w-4xl mx-auto">
            <ScrollScale
              startScale={0.96}
              endScale={1}
              startOpacity={0.7}
              endOpacity={1}
              offsetPx={80}
            >
              <div className="glass-card overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-7 border-b md:border-b-0 md:border-r border-slate-200/70 bg-white/70">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
                      <Database className="w-4 h-4" />
                      {isGerman ? 'Traditionell' : 'Traditional'}
                    </div>
                    <ul className="space-y-3">
                      {compareRows.map(r => (
                        <li
                          key={r.left}
                          className="text-sm text-slate-700 flex gap-2"
                        >
                          <span className="mt-0.5">•</span>
                          <span>{r.left}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-7 bg-gradient-to-br from-primary-50/60 to-cyan-50/50">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary-700 mb-4">
                      <Network className="w-4 h-4" />
                      {isGerman
                        ? 'Semantische Wissensbasis'
                        : 'Semantic knowledge base'}
                    </div>
                    <ul className="space-y-3">
                      {compareRows.map(r => (
                        <li
                          key={r.right}
                          className="text-sm text-slate-800 flex gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-accent-600 mt-0.5 flex-shrink-0" />
                          <span>{r.right}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </ScrollScale>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-12">
              <span className="section-label text-emerald-700 bg-emerald-50 border border-emerald-100">
                {copy.learnLabel}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mt-4 mb-4 text-balance leading-[1.12]">
                {copy.learnTitle}
              </h2>
              <p className="text-lg text-slate-700 max-w-3xl mx-auto">
                {copy.learnDesc}
              </p>
            </div>
          </ScrollReveal>

          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: isGerman
                  ? 'Schnelleres Onboarding neuer Akten'
                  : 'Faster onboarding for new matters',
                desc: isGerman
                  ? 'Wiederkehrende Muster beschleunigen die Orientierung — vom ersten Upload bis zur Handlungsempfehlung.'
                  : 'Recurring patterns speed up orientation — from first upload to actionable guidance.',
              },
              {
                icon: Gavel,
                title: isGerman
                  ? 'Bessere Normanwendung im Kontext'
                  : 'Better norm application in context',
                desc: isGerman
                  ? 'Hinweise werden kontextbewusster, weil ähnliche Struktur- und Argumentmuster erkannt werden.'
                  : 'Suggestions become more context-aware as similar structural and argument patterns are recognized.',
              },
              {
                icon: Lock,
                title: isGerman ? 'Governance-fähig' : 'Governance-ready',
                desc: isGerman
                  ? 'Anonymisierung und Aggregation sind Voraussetzung — Compliance bleibt Teil der Architektur.'
                  : 'Anonymization and aggregation are prerequisites — compliance remains part of the architecture.',
              },
            ].map((b, i) => (
              <ScrollScale
                key={b.title}
                startScale={0.9}
                endScale={1}
                startOpacity={0}
                endOpacity={1}
                offsetPx={40 + i * 30}
              >
                <div className="glass-card p-7 h-full group hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-600/25 transition-all duration-300">
                    <b.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    {b.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {b.desc}
                  </p>
                </div>
              </ScrollScale>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-gradient-to-br from-slate-900 via-slate-900 to-primary-950 text-white relative overflow-hidden noise-overlay">
        <FloatingParticles
          count={4}
          colors={['bg-primary-400/8', 'bg-cyan-400/8', 'bg-sky-300/5']}
        />
        <div className="container-wide relative z-10">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-10">
              <span className="section-label text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
                {copy.trustLabel}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-4 mb-4">
                {copy.trustTitle}
              </h2>
            </div>
          </ScrollReveal>

          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4">
            {trustPoints.map(p => (
              <ScrollReveal key={p.text} direction="up" distance={18}>
                <div className="flex items-start gap-3 p-5 rounded-2xl glass-card-dark">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                    <p.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed">
                    {p.text}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <PrefooterCta
        title={copy.ctaTitle}
        subtitle={copy.ctaSubtitle}
        primaryAction={{
          href: APP_SIGN_UP_URL,
          label: copy.ctaPrimary,
        }}
        secondaryAction={{ href: '/security', label: copy.ctaSecondary }}
        meta={
          isGerman
            ? 'EU-Hosting · Verschlüsselung · Audit-Trail'
            : 'EU hosting · encryption · audit trail'
        }
      />
    </>
  );
}
