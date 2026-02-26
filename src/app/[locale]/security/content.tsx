'use client';

import {
  AppWindow,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Eye,
  KeyRound,
  Lock,
  Network,
  Pause,
  Play,
  Radar,
  Server,
  Shield,
  Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

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

export default function SecurityContent() {
  const locale = useLocale();
  const t = useTranslations('security');
  const isGerman = locale.startsWith('de');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !isAutoPlaying) return;
    const timer = window.setInterval(() => {
      setActiveLayerIndex(prev => (prev + 1) % 5);
    }, 2300);

    return () => window.clearInterval(timer);
  }, [isAutoPlaying, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsAutoPlaying(false);
    }
  }, [prefersReducedMotion]);

  const features = [
    {
      icon: Shield,
      tk: 'feature1Title',
      dk: 'feature1Desc',
      color: 'from-green-500 to-green-700',
    },
    {
      icon: Lock,
      tk: 'feature2Title',
      dk: 'feature2Desc',
      color: 'from-blue-500 to-blue-700',
    },
    {
      icon: Server,
      tk: 'feature3Title',
      dk: 'feature3Desc',
      color: 'from-indigo-500 to-indigo-700',
    },
    {
      icon: ClipboardCheck,
      tk: 'feature4Title',
      dk: 'feature4Desc',
      color: 'from-cyan-500 to-cyan-700',
    },
    {
      icon: Users,
      tk: 'feature5Title',
      dk: 'feature5Desc',
      color: 'from-cyan-500 to-cyan-700',
    },
    {
      icon: Eye,
      tk: 'feature6Title',
      dk: 'feature6Desc',
      color: 'from-amber-500 to-amber-700',
    },
  ];

  const archPoints = [
    'TLS 1.3 encryption in transit',
    'AES-256 encryption at rest',
    'Zero-knowledge architecture',
    'EU-only data centers (Frankfurt)',
    'Role-based access control (RBAC)',
    'Cryptographic audit chain',
    'Annual penetration testing',
    'SOC 2 Type II certified',
    'GDPR Data Processing Agreements',
    'Automated vulnerability scanning',
  ];

  const architectureLayers = [
    {
      icon: Network,
      title: 'Edge & Transport',
      plainDesc: isGerman
        ? 'Hier startet jede Anfrage abgesichert.'
        : 'Every request starts through a secured edge.',
      desc: isGerman
        ? 'TLS 1.3, abgesicherte Verbindungen und gehärtete Entry-Points.'
        : 'TLS 1.3, hardened ingress, and secured edge connectivity.',
      color: 'from-cyan-500 to-blue-600',
    },
    {
      icon: KeyRound,
      title: isGerman ? 'Identity & Zugriff' : 'Identity & Access',
      plainDesc: isGerman
        ? 'Nur berechtigte Personen kommen an sensible Daten.'
        : 'Only authorized people can reach sensitive data.',
      desc: isGerman
        ? 'RBAC, SSO/SAML-Unterstützung und konsequentes Least-Privilege.'
        : 'RBAC, SSO/SAML support, and strict least-privilege enforcement.',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      icon: AppWindow,
      title: isGerman ? 'Applikationskontrollen' : 'Application Controls',
      plainDesc: isGerman
        ? 'Workflows prüfen Eingaben und blockieren riskante Aktionen.'
        : 'Workflows validate inputs and block risky actions.',
      desc: isGerman
        ? 'Validierung, Tenant-Isolation und sichere Workflow-Gates.'
        : 'Validation, tenant isolation, and secure workflow gates.',
      color: 'from-indigo-500 to-violet-600',
    },
    {
      icon: Database,
      title: isGerman ? 'Daten & Speicherung' : 'Data & Storage',
      plainDesc: isGerman
        ? 'Daten bleiben verschlüsselt und klar getrennt gespeichert.'
        : 'Data stays encrypted and cleanly segmented at rest.',
      desc: isGerman
        ? 'AES-256 at rest, Segmentierung und Wiederherstellungsstrategie.'
        : 'AES-256 at rest, segmented domains, and recovery strategy.',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      icon: Radar,
      title: 'Observability & Audit',
      plainDesc: isGerman
        ? 'Jeder wichtige Schritt ist sichtbar und prüfbar.'
        : 'Every important action is visible and auditable.',
      desc: isGerman
        ? 'Manipulationssichere Logs, Monitoring und Incident-Response.'
        : 'Tamper-aware logs, monitoring, and incident response workflows.',
      color: 'from-amber-500 to-orange-600',
    },
  ];

  const dataFlow = [
    {
      title: 'Ingestion',
      desc: isGerman
        ? 'Dateien werden validiert und sicher angenommen'
        : 'Files are validated and securely accepted',
      icon: Shield,
    },
    {
      title: 'Processing',
      desc: isGerman
        ? 'OCR/Extraktion und semantische Strukturierung'
        : 'OCR/extraction and semantic structuring',
      icon: ClipboardCheck,
    },
    {
      title: 'Indexing',
      desc: isGerman
        ? 'Aufbau der Retrieval- und Referenzschicht'
        : 'Retrieval and reference layer construction',
      icon: Database,
    },
    {
      title: 'Usage',
      desc: isGerman
        ? 'Analyse, Chat und Schriftsatz mit Quellenbezug'
        : 'Analysis, chat, and drafting with source grounding',
      icon: AppWindow,
    },
    {
      title: 'Governance',
      desc: isGerman
        ? 'Audit, Retention und kontrollierte Löschung'
        : 'Audit, retention, and controlled deletion',
      icon: Radar,
    },
  ];

  const architectureDiagramNodes = [
    { key: 'edge', layerIndex: 0, x: 126, y: 110 },
    { key: 'identity', layerIndex: 1, x: 336, y: 80 },
    { key: 'application', layerIndex: 2, x: 536, y: 110 },
    { key: 'storage', layerIndex: 3, x: 466, y: 262 },
    { key: 'observability', layerIndex: 4, x: 216, y: 262 },
  ] as const;

  const architectureDiagramEdges = [
    ['edge', 'identity'],
    ['identity', 'application'],
    ['application', 'storage'],
    ['storage', 'observability'],
    ['observability', 'edge'],
    ['identity', 'storage'],
    ['edge', 'application'],
  ] as const;

  const nodeByKey = Object.fromEntries(
    architectureDiagramNodes.map(node => [node.key, node])
  ) as Record<
    (typeof architectureDiagramNodes)[number]['key'],
    (typeof architectureDiagramNodes)[number]
  >;

  const architectureDiagramLabels: Record<
    (typeof architectureDiagramNodes)[number]['key'],
    string
  > = {
    edge: 'Edge + TLS',
    identity: 'Identity + RBAC',
    application: 'App',
    storage: isGerman ? 'Daten + Backup' : 'Data + Backup',
    observability: 'Audit + SIEM',
  };

  const architectureLegend = architectureLayers.map((layer, index) => ({
    ...layer,
    step: index + 1,
    iconBg:
      [
        'from-cyan-400/30 to-blue-500/30',
        'from-blue-400/30 to-indigo-500/30',
        'from-indigo-400/30 to-violet-500/30',
        'from-emerald-400/30 to-teal-500/30',
        'from-amber-400/30 to-orange-500/30',
      ][index] ?? 'from-cyan-400/30 to-blue-500/30',
    proof: isGerman
      ? [
          'Kontrollpunkt aktiv',
          'Protokolliert & nachvollziehbar',
          'Tenant-Isolation berücksichtigt',
        ][index % 3]
      : [
          'Control point active',
          'Logged and traceable',
          'Tenant isolation enforced',
        ][index % 3],
  }));

  const activeNodeKey =
    architectureDiagramNodes.find(node => node.layerIndex === activeLayerIndex)
      ?.key ?? 'edge';
  const activeFlowEdge =
    architectureDiagramEdges[activeLayerIndex] ?? architectureDiagramEdges[0];
  const activeFlowPath = `M ${nodeByKey[activeFlowEdge[0]].x} ${nodeByKey[activeFlowEdge[0]].y} L ${nodeByKey[activeFlowEdge[1]].x} ${nodeByKey[activeFlowEdge[1]].y}`;
  const activeLayer =
    architectureLegend[activeLayerIndex] ?? architectureLegend[0];
  const activeDataFlow = dataFlow[activeLayerIndex] ?? dataFlow[0];

  return (
    <>
      <ScrollProgressBar />

      <section className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-accent-50/30" />
        <Parallax speed={0.05} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern" />
        </Parallax>
        <ScrollLightSweep className="absolute inset-0" intensity={0.2} />
        <FloatingParticles
          count={4}
          colors={['bg-accent-400/10', 'bg-primary-400/8', 'bg-cyan-300/8']}
        />
        <Parallax speed={0.03} className="absolute inset-0">
          <GradientBlob
            className="-top-40 -right-40 animate-breathe"
            size={500}
            colors={['#059669', '#1E40AF', '#d1fae5']}
          />
        </Parallax>
        <Parallax speed={0.06} className="absolute inset-0">
          <GradientBlob
            className="-bottom-60 -left-40"
            size={400}
            colors={['#1E40AF', '#059669', '#ecfeff']}
          />
        </Parallax>
        <div className="container-wide text-center relative">
          <ScrollReveal delay={100} direction="up" distance={18}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-accent-100/80 text-accent-700 text-sm font-medium mb-8 shadow-sm">
              <Shield className="w-4 h-4" />
              {isGerman ? 'Enterprise-Sicherheit' : 'Enterprise Security'}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200} direction="up" distance={26}>
            <TextRevealByWord
              text={t('pageTitle')}
              tag="h1"
              staggerMs={44}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 text-balance"
            />
          </ScrollReveal>
          <ScrollReveal delay={320} direction="up" distance={16}>
            <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl lg:max-w-4xl mx-auto leading-relaxed text-balance">
              {t('pageSubtitle')}
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-16">
              <span className="section-label text-accent-700 bg-accent-50 border border-accent-100">
                {isGerman ? 'Sicherheitsfeatures' : 'Security Features'}
              </span>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
            {features.map((f, i) => (
              <ScrollScale
                key={f.tk}
                startScale={0.9}
                endScale={1}
                startOpacity={0}
                endOpacity={1}
                offsetPx={40 + (i % 3) * 30}
              >
                <GlowCard glowColor="rgba(5,150,105,0.08)" className="h-full">
                  <div className="glass-card p-7 lg:p-8 h-full group hover:-translate-y-1 transition-all duration-300">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300`}
                    >
                      <f.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">
                      {t(f.tk)}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">{t(f.dk)}</p>
                  </div>
                </GlowCard>
              </ScrollScale>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <FloatingParticles
          count={3}
          colors={['bg-accent-300/8', 'bg-primary-300/6', 'bg-slate-200/15']}
        />
        <div className="container-wide relative">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal direction="up" distance={25}>
              <div className="text-center mb-12">
                <span className="section-label text-slate-700 bg-white border border-slate-200">
                  {isGerman ? 'Architektur' : 'Architecture'}
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-4 mb-4 text-balance">
                  {t('architectureTitle')}
                </h2>
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed text-balance max-w-3xl mx-auto">
                  {t('architectureDesc')}
                </p>
              </div>
            </ScrollReveal>
            <ScrollScale
              startScale={0.96}
              endScale={1}
              startOpacity={0.7}
              endOpacity={1}
              offsetPx={80}
            >
              <div className="glass-card p-7 md:p-8">
                <div className="grid sm:grid-cols-2 gap-4">
                  {archPoints.map((point, i) => (
                    <ScrollReveal
                      key={point}
                      delay={i * 50}
                      direction="up"
                      distance={10}
                      duration={450}
                    >
                      <div className="flex items-center gap-3 group">
                        <CheckCircle2 className="w-5 h-5 text-accent-500 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                        <span className="text-sm font-medium text-slate-700">
                          {point}
                        </span>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              </div>
            </ScrollScale>
          </div>
        </div>
      </section>

      <section className="section-padding !py-16 lg:!py-24 xl:!py-20 2xl:!py-[4.75rem] bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(56,189,248,0.2),transparent_28%),radial-gradient(circle_at_92%_12%,rgba(37,99,235,0.24),transparent_34%)]" />
        <Parallax speed={0.04} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern opacity-20" />
        </Parallax>
        <FloatingParticles
          count={4}
          colors={['bg-cyan-300/10', 'bg-blue-300/10', 'bg-white/8']}
        />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={20}>
            <div className="max-w-3xl">
              <span className="section-label text-cyan-100 bg-white/10 border border-white/20">
                {isGerman ? 'System-Blueprint' : 'System Blueprint'}
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-3.5 mb-3 text-balance">
                {isGerman
                  ? 'So ist unsere Sicherheitsarchitektur sichtbar aufgebaut'
                  : 'How our security architecture is visibly structured'}
              </h2>
              <p className="text-slate-200/90 text-base sm:text-lg leading-relaxed text-balance">
                {isGerman
                  ? 'Eine klare Layer-Map zeigt, wie Schutzmechanismen von Edge bis Audit zusammenarbeiten.'
                  : 'A clear layer map shows how protection mechanisms work from edge to audit.'}
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-5 rounded-2xl border border-cyan-200/25 bg-white/5 px-3.5 py-2.5 xl:px-3 xl:py-2 2xl:px-2.5 2xl:py-1.5 flex flex-wrap items-center justify-between gap-2.5 xl:gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/90 font-semibold">
                {isGerman ? 'Gerade aktiv' : 'Now active'}
              </div>
              <div className="text-sm sm:text-base font-semibold text-white mt-1">
                {activeLayer.title}
              </div>
              <div className="text-xs sm:text-[13px] text-slate-200 mt-0.5">
                {activeLayer.plainDesc}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAutoPlaying(prev => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200/35 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 hover:bg-cyan-400/20 transition-colors focus-ring-on-dark"
                aria-pressed={isAutoPlaying}
                aria-label={
                  isAutoPlaying
                    ? isGerman
                      ? 'Sequenz pausieren'
                      : 'Pause sequence'
                    : isGerman
                      ? 'Sequenz starten'
                      : 'Start sequence'
                }
              >
                {isAutoPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {isAutoPlaying
                  ? isGerman
                    ? 'Auto läuft'
                    : 'Auto running'
                  : isGerman
                    ? 'Auto pausiert'
                    : 'Auto paused'}
              </button>

              <div className="flex items-center gap-1 rounded-xl border border-cyan-100/20 bg-slate-900/45 px-1.5 py-1 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.06)]">
                {architectureLegend.map((layer, idx) => (
                  <button
                    key={`${layer.title}-step-trigger`}
                    type="button"
                    onClick={() => {
                      setActiveLayerIndex(idx);
                      setIsAutoPlaying(false);
                    }}
                    className={`h-7 min-w-7 rounded-lg text-[10px] font-semibold transition-all duration-300 focus-ring-on-dark ${
                      idx === activeLayerIndex
                        ? 'bg-gradient-to-r from-cyan-400/40 to-blue-400/35 text-white border border-cyan-100/70 shadow-[0_6px_18px_-10px_rgba(103,232,249,0.85)]'
                        : 'text-cyan-100/75 hover:bg-white/10 border border-transparent'
                    }`}
                    aria-label={`${isGerman ? 'Schritt' : 'Step'} ${idx + 1}: ${layer.title}`}
                    aria-pressed={idx === activeLayerIndex}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4.5">
            <div>
              <ScrollScale
                startScale={0.95}
                endScale={1}
                startOpacity={0.2}
                endOpacity={1}
                offsetPx={48}
              >
                <div className="rounded-3xl border border-white/20 bg-slate-900/40 backdrop-blur-md p-3.5 sm:p-4 md:p-5 xl:p-4.5 2xl:p-4 mb-1">
                  <svg
                    viewBox="0 0 680 340"
                    className="w-full h-auto"
                    role="img"
                    aria-label={
                      isGerman
                        ? 'Visuelles Sicherheitsarchitektur-Diagramm'
                        : 'Visual security architecture diagram'
                    }
                  >
                    <defs>
                      <linearGradient
                        id="sec-edge-line"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="rgba(125,211,252,0.75)" />
                        <stop offset="100%" stopColor="rgba(56,189,248,0.16)" />
                      </linearGradient>
                      <marker
                        id="sec-arrow"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path
                          d="M 0 0 L 10 5 L 0 10 z"
                          fill="rgba(125,211,252,0.35)"
                        />
                      </marker>
                    </defs>

                    <rect
                      x="1"
                      y="1"
                      width="678"
                      height="338"
                      rx="22"
                      fill="rgba(15,23,42,0.38)"
                      stroke="rgba(148,163,184,0.25)"
                    />

                    {architectureDiagramEdges.map(([from, to], edgeIndex) => {
                      const fromNode = nodeByKey[from];
                      const toNode = nodeByKey[to];
                      const isActiveEdge = edgeIndex === activeLayerIndex;
                      return (
                        <line
                          key={`${from}-${to}`}
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={toNode.x}
                          y2={toNode.y}
                          stroke="url(#sec-edge-line)"
                          strokeWidth={isActiveEdge ? '3' : '2'}
                          opacity={isActiveEdge ? 1 : 0.62}
                          strokeLinecap="round"
                          markerEnd="url(#sec-arrow)"
                        />
                      );
                    })}

                    {!prefersReducedMotion ? (
                      <g key={`active-pulse-${activeLayerIndex}`}>
                        <circle r="3.2" fill="rgba(125,211,252,0.95)">
                          <animateMotion
                            dur="1.85s"
                            begin="0s"
                            repeatCount="indefinite"
                            path={activeFlowPath}
                          />
                          <animate
                            attributeName="opacity"
                            values="0;1;1;0"
                            dur="1.85s"
                            begin="0s"
                            repeatCount="indefinite"
                          />
                        </circle>
                        <circle r="6.6" fill="rgba(56,189,248,0.2)">
                          <animateMotion
                            dur="1.85s"
                            begin="0s"
                            repeatCount="indefinite"
                            path={activeFlowPath}
                          />
                          <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="1.85s"
                            begin="0s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      </g>
                    ) : null}

                    {architectureDiagramNodes.map(node => (
                      <g key={node.key}>
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="45"
                          fill={
                            node.key === activeNodeKey
                              ? 'rgba(8,47,73,0.96)'
                              : 'rgba(30,41,59,0.92)'
                          }
                          stroke={
                            node.key === activeNodeKey
                              ? 'rgba(103,232,249,0.95)'
                              : 'rgba(125,211,252,0.52)'
                          }
                          strokeWidth={
                            node.key === activeNodeKey ? '2.4' : '1.4'
                          }
                        />
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="33"
                          fill={
                            node.key === activeNodeKey
                              ? 'rgba(34,211,238,0.22)'
                              : 'rgba(14,165,233,0.14)'
                          }
                          stroke={
                            node.key === activeNodeKey
                              ? 'rgba(103,232,249,0.6)'
                              : 'rgba(125,211,252,0.34)'
                          }
                          strokeWidth="1"
                        />
                        <text
                          x={node.x}
                          y={node.y + 4}
                          fill="white"
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          letterSpacing="0.01em"
                        >
                          {architectureDiagramLabels[node.key]}
                        </text>
                      </g>
                    ))}

                    <text
                      x="24"
                      y="322"
                      fill="rgba(186,230,253,0.88)"
                      fontSize="12"
                      fontWeight="600"
                    >
                      {isGerman
                        ? 'Interaktive Layer-Map: gerichtete Signale + Status pro Schutzschicht'
                        : 'Interactive layer map: directed signals + per-layer protection status'}
                    </text>
                  </svg>

                  <div className="mt-2.5 rounded-2xl border border-cyan-200/20 bg-slate-950/45 p-3 md:p-3.5 xl:p-3 2xl:p-2.5">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-cyan-100/90">
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-400/10 px-3 py-1">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                        {isGerman
                          ? 'Laufpunkt = aktives Signal'
                          : 'Pulse = active signal'}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-white/5 px-3 py-1">
                        <span className="inline-flex h-[2px] w-5 bg-cyan-200/70" />
                        {isGerman
                          ? 'Pfeil = gesicherter Datenpfad'
                          : 'Arrow = secured data path'}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollScale>
            </div>
          </div>

          <ScrollReveal delay={140} direction="up" distance={16}>
            <div className="mt-5 rounded-2xl border border-cyan-200/25 bg-slate-900/60 p-3.5 sm:p-4 lg:p-5 xl:p-4.5 2xl:p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-cyan-100/90 font-semibold mb-3">
                {isGerman
                  ? 'Datenfluss mit Kontrollen'
                  : 'Data flow with controls'}
              </div>
              <div className="mb-2.5 rounded-lg border border-cyan-200/20 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 px-2.5 py-1.5 2xl:py-1 text-[11px] 2xl:text-[10px] leading-relaxed 2xl:leading-snug text-cyan-50/95">
                <span className="font-semibold tracking-[0.01em]">
                  {isGerman ? 'Aktueller Schritt:' : 'Current step:'}
                </span>{' '}
                <span className="text-cyan-50">{activeDataFlow.title}</span>
                <span className="text-cyan-100/75">
                  {' '}
                  — {activeDataFlow.desc}
                </span>
              </div>
              <div className="grid md:grid-cols-5 gap-2.5 xl:gap-2 2xl:gap-1.5">
                {dataFlow.map((step, idx) => (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => {
                      setActiveLayerIndex(idx);
                      setIsAutoPlaying(false);
                    }}
                    className={`rounded-xl border px-3 py-2.5 xl:px-2.5 xl:py-2 2xl:px-2 2xl:py-1.5 text-slate-100 relative min-h-[136px] xl:min-h-[124px] 2xl:min-h-[118px] text-left transition-all duration-300 focus-ring-on-dark ${
                      idx === activeLayerIndex
                        ? 'border-cyan-100/60 bg-cyan-400/18 shadow-[0_0_0_1px_rgba(103,232,249,0.22)]'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    aria-label={`${isGerman ? 'Datenfluss-Schritt anzeigen' : 'Show data flow step'}: ${step.title}`}
                    aria-pressed={idx === activeLayerIndex}
                  >
                    <span className="inline-flex h-5 w-5 xl:h-4.5 xl:w-4.5 2xl:h-4 2xl:w-4 rounded-full bg-cyan-500/25 border border-cyan-200/40 items-center justify-center text-[10px] font-semibold mb-2 xl:mb-1.5 2xl:mb-1">
                      {idx + 1}
                    </span>
                    <div className="inline-flex h-6 w-6 xl:h-5.5 xl:w-5.5 2xl:h-5 2xl:w-5 items-center justify-center rounded-lg border border-cyan-200/30 bg-cyan-400/10 mb-1.5 2xl:mb-1">
                      <step.icon
                        className="h-3.5 w-3.5 xl:h-3 xl:w-3 2xl:h-2.5 2xl:w-2.5 text-cyan-100"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-[12px] xl:text-[11px] 2xl:text-[10px] font-semibold text-white leading-tight">
                      {step.title}
                    </div>
                    <div className="mt-1 2xl:mt-0.5 text-[11px] xl:text-[10px] leading-relaxed 2xl:leading-snug text-slate-200/95">
                      {step.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <PrefooterCta
        title={t('ctaTitle')}
        subtitle={t('ctaDesc')}
        primaryAction={{
          href: '/docs/reference/security-architecture-factsheet',
          label: t('ctaButton'),
        }}
      />
    </>
  );
}
