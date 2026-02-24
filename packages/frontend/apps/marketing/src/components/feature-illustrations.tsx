'use client';

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  Briefcase,
  CheckCircle2,
  File,
  FileSearch,
  FileText,
  Image,
  Network,
  Scale,
  Search,
  Shield,
  Star,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { type ReactNode } from 'react';

import {
  FloatingElement,
  OrbitingNodes,
  Parallax,
  PulseRing,
  ScrollReveal,
  ScrollTransform,
  useElementScrollProgress,
} from './animations';

const CINEMATIC_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/* ═══════════════════════════════════════════════════════════════
   Shared mini-component: Mockup Shell
   ═══════════════════════════════════════════════════════════════ */
function MockupShell({
  children,
  className = '',
  gradient = 'from-slate-50 to-slate-100',
}: {
  children: ReactNode;
  className?: string;
  gradient?: string;
}) {
  return (
    <ScrollTransform
      offsetPx={150}
      style={progress => {
        const p = Math.max(0, Math.min(1, progress));
        return {
          transform: `translateY(${(1 - p) * 18}px) scale(${0.97 + p * 0.03})`,
          opacity: 0.78 + p * 0.22,
          transition: `transform 260ms ${CINEMATIC_EASE}, opacity 260ms ${CINEMATIC_EASE}`,
          willChange: 'transform, opacity',
        };
      }}
    >
      <div
        className={`aspect-[5/4] sm:aspect-[4/3] rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} border border-slate-200/80 relative overflow-hidden group shadow-lg shadow-slate-900/5 transition-transform duration-500 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10 ${className}`}
      >
        {/* Atmospheric glow and scan light */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.65),transparent_45%)]" />
        <div
          className="absolute -inset-x-1/2 -top-1/2 h-[160%] w-[200%] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.35) 50%, transparent 62%)',
            animation: 'offsetTravel 2.4s ease-in-out infinite',
          }}
        />

        {/* Window chrome dots */}
        <div className="absolute top-3 left-3 sm:left-4 flex gap-1.5 z-10">
          <div className="w-2.5 h-2.5 rounded-full bg-red-300/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-300/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-300/60" />
        </div>
        <div className="absolute inset-0 pt-7 sm:pt-8">{children}</div>
      </div>
    </ScrollTransform>
  );
}

/* Mini floating badge */
function FloatBadge({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <FloatingElement amplitude={8} duration={5} delay={delay}>
      <div
        className={`px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200/60 shadow-lg text-xs font-semibold ${className}`}
      >
        {children}
      </div>
    </FloatingElement>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1. Document Pipeline — Upload → OCR → Semantic Chunks
   ═══════════════════════════════════════════════════════════════ */
export function DocumentPipelineIllustration() {
  const { ref, progress } = useElementScrollProgress(120);
  const p = Math.max(0, Math.min(1, progress));
  const inputPhase = Math.max(0, Math.min(1, (p - 0.02) / 0.28));
  const processPhase = Math.max(0, Math.min(1, (p - 0.24) / 0.42));
  const outputPhase = Math.max(0, Math.min(1, (p - 0.58) / 0.36));
  const cycleSeconds = 2.8;

  return (
    <Parallax speed={0.06}>
      <div ref={ref} className="relative">
        <MockupShell gradient="from-blue-50/80 to-indigo-50/80">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate3d(${(0.5 - p) * 10}px, ${(0.5 - p) * -6}px, 0)`,
              opacity: 0.2 + processPhase * 0.28,
              background:
                'radial-gradient(circle at 46% 52%, rgba(59,130,246,0.16), transparent 42%), radial-gradient(circle at 72% 46%, rgba(6,182,212,0.14), transparent 38%)',
              transition: `transform 240ms ${CINEMATIC_EASE}, opacity 240ms ${CINEMATIC_EASE}`,
            }}
          />
          {/* Input docs floating in from left */}
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 space-y-2"
            style={{
              transform: `translateY(-50%) translateX(${(1 - inputPhase) * -10}px)`,
              opacity: 0.55 + inputPhase * 0.45,
              transition: `transform 260ms ${CINEMATIC_EASE}, opacity 240ms ${CINEMATIC_EASE}`,
            }}
          >
            <FloatingElement amplitude={6} duration={4} delay={0}>
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white shadow-md border border-blue-100/80 transition-transform duration-500 group-hover:-translate-x-1">
                <File className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-medium text-slate-600">
                  Vertrag.pdf
                </span>
              </div>
            </FloatingElement>
            <FloatingElement
              amplitude={6}
              duration={4.5}
              delay={0.3}
              className="hidden sm:block"
            >
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white shadow-md border border-red-100/80 transition-transform duration-500 group-hover:-translate-x-1">
                <Image className="w-4 h-4 text-red-500" />
                <span className="text-[10px] font-medium text-slate-600">
                  Scan_001.jpg
                </span>
              </div>
            </FloatingElement>
            <FloatingElement
              amplitude={6}
              duration={5}
              delay={0.6}
              className="hidden sm:block"
            >
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white shadow-md border border-amber-100/80 transition-transform duration-500 group-hover:-translate-x-1">
                <FileText className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-medium text-slate-600">
                  Klage.docx
                </span>
              </div>
            </FloatingElement>
          </div>

          {/* Center: Processing engine */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              transform: `translate(-50%, -50%) scale(${0.96 + processPhase * 0.06})`,
              opacity: 0.72 + processPhase * 0.28,
              transition: `transform 260ms ${CINEMATIC_EASE}, opacity 240ms ${CINEMATIC_EASE}`,
            }}
          >
            <div
              className="relative"
              style={{
                filter: `drop-shadow(0 10px 22px rgba(59,130,246,${0.08 + processPhase * 0.12}))`,
              }}
            >
              <PulseRing
                color="rgba(30,64,175,0.12)"
                count={3}
                size={84}
                className="left-1/2 top-1/2 sm:[&>div]:!w-[90px] sm:[&>div]:!h-[90px]"
              />
              <div
                className="absolute inset-0 rounded-2xl border border-blue-200/70"
                style={{ animation: 'rotateBlob 9s linear infinite' }}
              />
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl relative z-10 group-hover:scale-110 transition-transform duration-500">
                <Brain className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              {/* Scan line */}
              <div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                style={{
                  animation: `scanLine ${cycleSeconds}s cubic-bezier(0.4,0,0.2,1) infinite`,
                  top: '0%',
                  opacity: 0.45 + processPhase * 0.55,
                }}
              />
            </div>
          </div>

          {/* Output chunks on right */}
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 space-y-1.5"
            style={{
              transform: `translateY(-50%) translateX(${(1 - outputPhase) * 10}px)`,
              opacity: 0.5 + outputPhase * 0.5,
              transition: `transform 260ms ${CINEMATIC_EASE}, opacity 240ms ${CINEMATIC_EASE}`,
            }}
          >
            {['§ 433 BGB', 'Parteien', 'Fristen', 'Klauseln'].map(
              (label, i) => (
                <FloatingElement
                  key={label}
                  amplitude={5}
                  duration={4}
                  delay={i * 0.2}
                  className={i > 1 ? 'hidden sm:block' : ''}
                >
                  <div
                    className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-white shadow-md transition-transform duration-500 group-hover:translate-x-1 ${
                      [
                        'bg-blue-500',
                        'bg-cyan-500',
                        'bg-amber-500',
                        'bg-green-500',
                      ][i]
                    }`}
                    style={{
                      animation: `chunkPulse ${cycleSeconds}s ease-in-out ${i * 0.16}s infinite`,
                    }}
                  >
                    {label}
                  </div>
                </FloatingElement>
              )
            )}
          </div>

          {/* Connection arrows */}
          <svg
            className="absolute inset-0 pointer-events-none"
            viewBox="0 0 400 300"
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="arrow-blue"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6" fill="rgba(59,130,246,0.4)" />
              </marker>
            </defs>
            <line
              x1="115"
              y1="150"
              x2="160"
              y2="150"
              stroke="rgba(59,130,246,0.3)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              markerEnd="url(#arrow-blue)"
              style={{
                animation: `arrowPulse ${cycleSeconds}s ease-in-out infinite`,
              }}
            />
            <line
              x1="240"
              y1="150"
              x2="285"
              y2="150"
              stroke="rgba(59,130,246,0.3)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              markerEnd="url(#arrow-blue)"
              style={{
                animation: `arrowPulse ${cycleSeconds}s ease-in-out 180ms infinite`,
              }}
            />

            <circle r="3.5" fill="rgba(59,130,246,0.65)">
              <animateMotion
                dur={`${cycleSeconds}s`}
                repeatCount="indefinite"
                path="M115 150 L160 150"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.12;0.88;1"
                dur={`${cycleSeconds}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle r="3.5" fill="rgba(59,130,246,0.65)">
              <animateMotion
                dur={`${cycleSeconds}s`}
                begin="0.18s"
                repeatCount="indefinite"
                path="M240 150 L285 150"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.12;0.88;1"
                dur={`${cycleSeconds}s`}
                begin="0.18s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </MockupShell>
      </div>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. Contradiction Detector — Split comparison with warning links
   ═══════════════════════════════════════════════════════════════ */
export function ContradictionDetectorIllustration() {
  return (
    <Parallax speed={0.05}>
      <MockupShell gradient="from-red-50/60 to-orange-50/60">
        {/* Left document */}
        <div className="absolute left-3 top-10 bottom-4 w-[42%] rounded-xl bg-white shadow-lg border border-slate-200/80 p-3 overflow-hidden">
          <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
            Zeuge A
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="h-1.5 bg-slate-100 rounded-full w-4/5" />
            <div className="h-1.5 bg-red-200 rounded-full w-full ring-1 ring-red-300/50" />
            <div className="h-1.5 bg-slate-100 rounded-full w-3/5" />
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="h-1.5 bg-red-200 rounded-full w-4/5 ring-1 ring-red-300/50" />
            <div className="h-1.5 bg-slate-100 rounded-full w-2/3" />
          </div>
        </div>

        {/* Right document */}
        <div className="absolute right-3 top-10 bottom-4 w-[42%] rounded-xl bg-white shadow-lg border border-slate-200/80 p-3 overflow-hidden">
          <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
            Zeuge B
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="h-1.5 bg-slate-100 rounded-full w-3/4" />
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="h-1.5 bg-red-200 rounded-full w-4/5 ring-1 ring-red-300/50" />
            <div className="h-1.5 bg-slate-100 rounded-full w-2/3" />
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="h-1.5 bg-red-200 rounded-full w-3/4 ring-1 ring-red-300/50" />
          </div>
        </div>

        {/* Warning connections SVG */}
        <svg
          className="absolute inset-0 pointer-events-none z-10"
          viewBox="0 0 400 300"
        >
          <line
            x1="180"
            y1="105"
            x2="220"
            y2="135"
            stroke="rgba(239,68,68,0.5)"
            strokeWidth="2"
            strokeDasharray="5 3"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="16"
              to="0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </line>
          <line
            x1="180"
            y1="155"
            x2="220"
            y2="185"
            stroke="rgba(239,68,68,0.5)"
            strokeWidth="2"
            strokeDasharray="5 3"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="16"
              to="0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </line>

          <circle r="3.5" fill="rgba(239,68,68,0.75)">
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path="M180 105 L220 135"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.15;0.85;1"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3.5" fill="rgba(239,68,68,0.75)">
            <animateMotion
              dur="1.5s"
              begin="0.25s"
              repeatCount="indefinite"
              path="M180 155 L220 185"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.15;0.85;1"
              dur="1.5s"
              begin="0.25s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>

        {/* Warning badges */}
        <FloatingElement
          amplitude={4}
          duration={3}
          delay={0}
          className="absolute left-1/2 -translate-x-1/2 top-[32%] z-20"
        >
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500 text-white text-[8px] sm:text-[9px] font-bold shadow-lg"
            style={{ animation: 'glow-pulse 2.8s ease-in-out infinite' }}
          >
            <AlertTriangle className="w-3 h-3" /> Widerspruch
          </div>
        </FloatingElement>
        <FloatingElement
          amplitude={4}
          duration={3.5}
          delay={0.5}
          className="absolute left-1/2 -translate-x-1/2 top-[58%] z-20 hidden sm:block"
        >
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500 text-white text-[9px] font-bold shadow-lg">
            <AlertTriangle className="w-3 h-3" /> Inkonsistenz
          </div>
        </FloatingElement>
      </MockupShell>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. Deadline Timeline — Animated calendar timeline
   ═══════════════════════════════════════════════════════════════ */
export function DeadlineTimelineIllustration() {
  return (
    <Parallax speed={0.07}>
      <MockupShell gradient="from-amber-50/60 to-yellow-50/60">
        {/* Timeline bar */}
        <div className="absolute left-5 sm:left-6 right-5 sm:right-6 top-[45%] h-1 bg-slate-200 rounded-full">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-amber-400 to-red-400 rounded-full origin-left"
            style={{
              ['--timeline-progress' as string]: '0.75',
              animation:
                'timelineFill 900ms cubic-bezier(0.16,1,0.3,1) 120ms both',
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.22)]"
            style={{
              animation: 'offsetTravel 3.4s ease-in-out infinite',
              offsetPath: 'path("M 0 0 L 280 0")',
            }}
          />
        </div>

        {/* Milestone dots */}
        {[
          {
            left: '10%',
            color: 'bg-green-500',
            label: 'Klage eingereicht',
            status: '✓',
            ring: 'ring-green-200',
          },
          {
            left: '35%',
            color: 'bg-green-500',
            label: 'Beweisantrag',
            status: '✓',
            ring: 'ring-green-200',
          },
          {
            left: '58%',
            color: 'bg-amber-500',
            label: 'Stellungnahme',
            status: '3d',
            ring: 'ring-amber-200',
          },
          {
            left: '82%',
            color: 'bg-red-400',
            label: 'Verhandlung',
            status: '14d',
            ring: 'ring-red-200',
          },
        ].map((m, i) => (
          <div
            key={i}
            className="absolute top-[45%] -translate-y-1/2"
            style={{ left: m.left }}
          >
            <FloatingElement amplitude={3} duration={4} delay={i * 0.3}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-5 h-5 rounded-full ${m.color} ${m.ring} ring-4 shadow-md flex items-center justify-center transition-transform duration-300 group-hover:scale-125`}
                >
                  <span className="text-[7px] text-white font-bold">
                    {m.status}
                  </span>
                </div>
                <div className="mt-2 px-2 py-1 rounded-md bg-white/90 shadow-sm border border-slate-100 text-[8px] font-medium text-slate-600 whitespace-nowrap hidden sm:block">
                  {m.label}
                </div>
              </div>
            </FloatingElement>
          </div>
        ))}

        {/* Alarm bell on urgent deadline */}
        <FloatingElement
          amplitude={5}
          duration={2}
          delay={0}
          className="absolute right-8 top-[18%] hidden sm:block"
        >
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 border border-red-200 text-red-600">
            <Bell
              className="w-3 h-3"
              style={{ animation: 'bellShake 2.6s ease-in-out infinite' }}
            />
            <span className="text-[9px] font-bold">Frist in 3 Tagen!</span>
          </div>
        </FloatingElement>

        {/* Calendar mini */}
        <div className="absolute left-4 top-10 w-16 h-14 rounded-lg bg-white shadow-md border border-slate-200/80 overflow-hidden">
          <div className="h-3 bg-amber-500 flex items-center justify-center">
            <span className="text-[6px] text-white font-bold">FEB 2026</span>
          </div>
          <div className="grid grid-cols-7 gap-0 p-0.5">
            {[...Array(14)].map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-sm text-center ${i === 5 ? 'bg-red-400' : i === 9 ? 'bg-amber-400' : 'bg-slate-100'}`}
              />
            ))}
          </div>
        </div>
      </MockupShell>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. Judikatur Search — Search interface with result cards
   ═══════════════════════════════════════════════════════════════ */
export function JudikaturSearchIllustration() {
  return (
    <Parallax speed={0.06}>
      <MockupShell gradient="from-cyan-50/60 to-sky-50/60">
        {/* Search bar */}
        <div className="mx-3 sm:mx-4 mt-2 flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-white shadow-md border border-cyan-100/80">
          <Search className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] text-slate-400 font-medium">
            Schadenersatz bei Vertragsverletzung...
          </span>
          <div className="w-[2px] h-3 bg-cyan-500 animate-pulse" />
        </div>

        {/* Result cards staggered */}
        <div className="mx-4 mt-3 space-y-2">
          {[
            {
              court: 'OGH',
              ref: '4 Ob 123/24k',
              score: '97%',
              color: 'border-l-cyan-500',
            },
            {
              court: 'BGH',
              ref: 'VIII ZR 45/23',
              score: '89%',
              color: 'border-l-indigo-500',
            },
            {
              court: 'EGMR',
              ref: 'Nr. 41088/05',
              score: '76%',
              color: 'border-l-blue-500',
            },
          ].map((r, i) => (
            <ScrollReveal
              key={r.ref}
              delay={i * 100}
              direction="up"
              distance={10}
              duration={400}
            >
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-sm border border-slate-100 border-l-4 ${r.color} group-hover:shadow-md transition-shadow duration-300 ${i === 2 ? 'hidden sm:flex' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 font-bold">
                      {r.court}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700">
                      {r.ref}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <div className="h-1 bg-slate-100 rounded-full w-20" />
                    <div className="h-1 bg-slate-100 rounded-full w-12" />
                  </div>
                </div>
                <div className="ml-auto">
                  <div
                    className="text-[10px] font-bold text-cyan-600"
                    style={{
                      animation: `chunkPulse 2.6s ease-in-out ${i * 0.16}s infinite`,
                    }}
                  >
                    {r.score}
                  </div>
                  <div className="w-8 h-1 bg-slate-200 rounded-full mt-0.5">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{
                        width: r.score,
                        animation: `timelineFill 1s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s both`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Floating badge */}
        <FloatBadge
          className="absolute right-3 top-10 text-cyan-700"
          delay={0.5}
        >
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 12.847
            Urteile
          </span>
        </FloatBadge>
      </MockupShell>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. Document Builder — Progressive doc generation
   ═══════════════════════════════════════════════════════════════ */
export function DocumentBuilderIllustration() {
  return (
    <Parallax speed={0.05}>
      <MockupShell gradient="from-green-50/60 to-emerald-50/60">
        {/* Document being built */}
        <div className="mx-4 sm:mx-6 mt-2 rounded-xl bg-white shadow-lg border border-slate-200/80 p-3 sm:p-4 h-[85%] overflow-hidden relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(120deg, transparent 35%, rgba(16,185,129,0.1) 50%, transparent 65%)',
              animation: 'offsetTravel 3.1s ease-in-out infinite',
            }}
          />
          {/* Letterhead */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center">
              <Scale className="w-3 h-3 text-white" />
            </div>
            <div>
              <div className="h-1.5 bg-slate-200 rounded-full w-20" />
              <div className="h-1 bg-slate-100 rounded-full w-14 mt-1" />
            </div>
          </div>

          {/* Content lines building up */}
          <div className="space-y-2">
            <div className="h-2 bg-green-100 rounded w-1/3 font-bold" />
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="h-1.5 bg-slate-100 rounded-full w-4/5" />
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="mt-2 h-2 bg-green-100 rounded w-2/5" />
            <div className="h-1.5 bg-slate-100 rounded-full w-full" />
            <div className="h-1.5 bg-slate-100 rounded-full w-3/4" />
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-bold">
                § 823 BGB
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-600 font-bold">
                § 249 BGB
              </span>
            </div>
          </div>

          {/* Writing cursor line */}
          <div className="absolute bottom-8 left-4 right-4 h-0.5 bg-gradient-to-r from-green-400 to-transparent opacity-60">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-green-500 animate-pulse" />
          </div>
        </div>

        {/* Template chips floating in */}
        <FloatingElement
          amplitude={5}
          duration={3.5}
          delay={0}
          className="absolute left-2 bottom-8 z-10"
        >
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500 text-white text-[8px] font-bold shadow-lg">
            <Zap className="w-2.5 h-2.5" /> Klageschrift
          </div>
        </FloatingElement>
        <FloatingElement
          amplitude={5}
          duration={4}
          delay={0.5}
          className="absolute right-2 bottom-12 z-10 hidden sm:block"
        >
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500 text-white text-[8px] font-bold shadow-lg">
            <CheckCircle2 className="w-2.5 h-2.5" /> Auto-Fill
          </div>
        </FloatingElement>
      </MockupShell>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. Evidence Board — Pinboard style with connections
   ═══════════════════════════════════════════════════════════════ */
export function EvidenceBoardIllustration() {
  return (
    <Parallax speed={0.06}>
      <MockupShell gradient="from-cyan-50/60 to-teal-50/60">
        {/* Pin board background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[length:12px_12px]" />

        {/* Evidence cards pinned */}
        {[
          {
            top: '12%',
            left: '5%',
            w: 'w-[38%]',
            label: 'Kaufvertrag',
            icon: FileText,
            strength: 90,
            color: 'bg-emerald-500',
          },
          {
            top: '10%',
            left: '55%',
            w: 'w-[40%]',
            label: 'Zeuge Müller',
            icon: Users,
            strength: 75,
            color: 'bg-blue-500',
          },
          {
            top: '55%',
            left: '8%',
            w: 'w-[36%]',
            label: 'Foto Schaden',
            icon: Image,
            strength: 60,
            color: 'bg-amber-500',
          },
          {
            top: '58%',
            left: '52%',
            w: 'w-[42%]',
            label: '???',
            icon: FileSearch,
            strength: 0,
            color: 'bg-slate-300',
            dashed: true,
          },
        ].map((card, i) => (
          <FloatingElement
            key={i}
            amplitude={3}
            duration={5 + i * 0.5}
            delay={i * 0.2}
            className={`absolute ${card.w} ${card.dashed ? 'hidden sm:block' : ''}`}
          >
            <div
              style={{ top: card.top, left: card.left, position: 'absolute' }}
              className={`p-2 rounded-lg bg-white shadow-md border ${card.dashed ? 'border-dashed border-slate-300' : 'border-slate-200/80'} transition-transform duration-300 group-hover:scale-105`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <card.icon
                  className={`w-3 h-3 ${card.dashed ? 'text-slate-400' : 'text-slate-600'}`}
                />
                <span
                  className={`text-[9px] font-semibold ${card.dashed ? 'text-slate-400' : 'text-slate-700'}`}
                >
                  {card.label}
                </span>
              </div>
              {card.strength > 0 && (
                <div className="w-full h-1 bg-slate-100 rounded-full">
                  <div
                    className={`h-full ${card.color} rounded-full transition-all duration-1000`}
                    style={{ width: `${card.strength}%` }}
                  />
                </div>
              )}
              {card.dashed && (
                <div className="text-[8px] text-slate-400 italic">
                  Beweislücke
                </div>
              )}
            </div>
          </FloatingElement>
        ))}

        {/* Connection threads SVG */}
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          viewBox="0 0 400 300"
        >
          <line
            x1="95"
            y1="75"
            x2="230"
            y2="65"
            stroke="rgba(16,185,129,0.3)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <line
            x1="80"
            y1="170"
            x2="230"
            y2="65"
            stroke="rgba(59,130,246,0.3)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <line
            x1="80"
            y1="170"
            x2="270"
            y2="195"
            stroke="rgba(245,158,11,0.25)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />

          <circle r="3" fill="rgba(16,185,129,0.55)">
            <animateMotion
              dur="2.8s"
              repeatCount="indefinite"
              path="M95 75 L230 65"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.12;0.88;1"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3" fill="rgba(59,130,246,0.55)">
            <animateMotion
              dur="3.2s"
              begin="0.2s"
              repeatCount="indefinite"
              path="M80 170 L230 65"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.12;0.88;1"
              dur="3.2s"
              begin="0.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3" fill="rgba(245,158,11,0.5)">
            <animateMotion
              dur="3.6s"
              begin="0.35s"
              repeatCount="indefinite"
              path="M80 170 L270 195"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.12;0.88;1"
              dur="3.6s"
              begin="0.35s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </MockupShell>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. Jurisdiction Map — Stylized AT/DE/EU flags + norms
   ═══════════════════════════════════════════════════════════════ */
export function JurisdictionMapIllustration() {
  return (
    <Parallax speed={0.07}>
      <MockupShell gradient="from-indigo-50/60 to-blue-50/60">
        {/* Stylized map circles */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Central hub */}
          <div className="relative">
            <PulseRing
              color="rgba(99,102,241,0.1)"
              count={2}
              size={160}
              className="left-1/2 top-1/2"
            />

            {/* EU center */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl z-10 relative group-hover:scale-110 transition-transform duration-500">
              <span className="text-white font-extrabold text-sm">EU</span>
            </div>

            {/* Country nodes orbiting */}
            {[
              { label: '🇦🇹', angle: -45, norms: 'ABGB, StGB' },
              { label: '🇩🇪', angle: 90, norms: 'BGB, StPO' },
              { label: '🇪🇺', angle: 210, norms: 'EMRK' },
            ].map((country, i) => {
              const rad = (country.angle * Math.PI) / 180;
              const r = 70;
              const x = Math.cos(rad) * r;
              const y = Math.sin(rad) * r;
              return (
                <FloatingElement
                  key={i}
                  amplitude={4}
                  duration={5}
                  delay={i * 0.4}
                  className="absolute z-20"
                >
                  <div
                    style={{
                      left: `calc(50% + ${x}px - 18px)`,
                      top: `calc(50% + ${y}px - 18px)`,
                      position: 'absolute',
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-white shadow-lg border-2 border-indigo-100 flex items-center justify-center text-lg">
                        {country.label}
                      </div>
                      <div
                        className="mt-1 px-1.5 py-0.5 rounded bg-white/90 shadow-sm text-[7px] font-medium text-indigo-600 whitespace-nowrap hidden sm:block"
                        style={{
                          animation: `chunkPulse 3s ease-in-out ${i * 0.14}s infinite`,
                        }}
                      >
                        {country.norms}
                      </div>
                    </div>
                  </div>
                </FloatingElement>
              );
            })}

            {/* Jurisdiction connection spokes with flowing signals */}
            <svg
              className="absolute inset-0 pointer-events-none"
              viewBox="0 0 400 300"
              aria-hidden="true"
            >
              {[315, 90, 210].map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = 200 + Math.cos(rad) * 24;
                const y1 = 150 + Math.sin(rad) * 24;
                const x2 = 200 + Math.cos(rad) * 74;
                const y2 = 150 + Math.sin(rad) * 74;
                return (
                  <g key={i}>
                    <line
                      x1={x1.toFixed(2)}
                      y1={y1.toFixed(2)}
                      x2={x2.toFixed(2)}
                      y2={y2.toFixed(2)}
                      stroke="rgba(99,102,241,0.26)"
                      strokeWidth="1.25"
                      strokeDasharray="4 4"
                    />
                    <circle r="2.8" fill="rgba(99,102,241,0.58)">
                      <animateMotion
                        dur="2.8s"
                        begin={`${i * 0.22}s`}
                        repeatCount="indefinite"
                        path={`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`}
                      />
                      <animate
                        attributeName="opacity"
                        values="0;1;1;0"
                        keyTimes="0;0.15;0.85;1"
                        dur="2.8s"
                        begin={`${i * 0.22}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Flowing § symbols */}
        {['§', '§', 'Art.'].map((sym, i) => (
          <div
            key={i}
            className="absolute text-indigo-300/40 font-bold text-lg pointer-events-none hidden sm:block"
            style={{
              left: `${20 + i * 30}%`,
              top: `${15 + i * 25}%`,
              animation: `floatElement ${6 + i}s ease-in-out ${-i * 2}s infinite`,
              ['--float-amplitude' as string]: '12px',
            }}
          >
            {sym}
          </div>
        ))}
      </MockupShell>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   8. Team Dashboard — Org chart with assignments
   ═══════════════════════════════════════════════════════════════ */
export function TeamDashboardIllustration() {
  return (
    <Parallax speed={0.05}>
      <MockupShell gradient="from-pink-50/60 to-rose-50/60">
        {/* Mini dashboard header */}
        <div className="mx-3 mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 border border-slate-100">
          <BarChart3 className="w-3 h-3 text-pink-500" />
          <span className="text-[9px] font-bold text-slate-600">
            Kanzlei-Übersicht
          </span>
          <div className="ml-auto flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          </div>
        </div>

        {/* Team members + assigned cases */}
        <div className="mx-3 mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              name: 'RA Schmidt',
              cases: 5,
              color: 'from-pink-500 to-rose-500',
            },
            { name: 'RA Weber', cases: 3, color: 'from-cyan-500 to-sky-500' },
            { name: 'RA Klein', cases: 7, color: 'from-rose-500 to-red-500' },
          ].map((member, i) => (
            <FloatingElement
              key={i}
              amplitude={2.6}
              duration={4.8}
              delay={i * 0.25}
              className={i === 2 ? 'hidden sm:block' : ''}
            >
              <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-center group-hover:shadow-md transition-shadow duration-300">
                <div
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${member.color} mx-auto mb-1 flex items-center justify-center shadow-md`}
                >
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="text-[8px] font-bold text-slate-700">
                  {member.name}
                </div>
                <div className="text-[7px] text-slate-400">
                  {member.cases} Akten
                </div>
              </div>
            </FloatingElement>
          ))}
        </div>

        {/* Case cards below */}
        <div className="mx-3 mt-2 space-y-1.5">
          {[
            {
              ref: 'AZ 2024/001',
              status: 'Aktiv',
              statusColor: 'bg-green-100 text-green-700',
            },
            {
              ref: 'AZ 2024/002',
              status: 'Frist',
              statusColor: 'bg-amber-100 text-amber-700',
            },
          ].map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/80 border border-slate-100 shadow-sm"
              style={{
                animation: `floatElement ${5 + i * 0.8}s ease-in-out ${i * 0.2}s infinite`,
                ['--float-amplitude' as string]: '4px',
              }}
            >
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3 h-3 text-slate-400" />
                <span className="text-[9px] font-medium text-slate-600">
                  {c.ref}
                </span>
              </div>
              <span
                className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${c.statusColor}`}
              >
                {c.status}
              </span>
            </div>
          ))}
        </div>

        {/* KPI bar */}
        <div className="absolute bottom-3 left-3 right-3 flex gap-1.5 sm:gap-2">
          {[
            { label: 'Erfolg', val: '87%', color: 'text-green-600' },
            { label: 'Fristen', val: '12', color: 'text-amber-600' },
            { label: 'Offen', val: '34', color: 'text-pink-600' },
          ].map((kpi, i) => (
            <div
              key={i}
              className="flex-1 px-1.5 sm:px-2 py-1 rounded-md bg-white/80 border border-slate-100 text-center"
              style={{
                animation: `chunkPulse 2.8s ease-in-out ${i * 0.2}s infinite`,
              }}
            >
              <div
                className={`text-[9px] sm:text-[10px] font-extrabold ${kpi.color}`}
              >
                {kpi.val}
              </div>
              <div className="text-[6px] sm:text-[7px] text-slate-400">
                {kpi.label}
              </div>
            </div>
          ))}
        </div>
      </MockupShell>
    </Parallax>
  );
}

/* ═══════════════════════════════════════════════════════════════
   9. Neural Network — Collective intelligence brain
   ═══════════════════════════════════════════════════════════════ */
export function NeuralNetworkIllustration() {
  return (
    <Parallax speed={0.08}>
      <MockupShell gradient="from-emerald-50/60 to-cyan-50/60">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Outer orbiting ring */}
          <OrbitingNodes
            count={8}
            radius={100}
            duration={30}
            nodeSize={28}
            nodeClassName=""
            renderNode={i => (
              <div className="w-7 h-7 rounded-full bg-white shadow-md border border-emerald-100 flex items-center justify-center text-[10px]">
                {['🏛️', '⚖️', '📋', '🏢', '👨‍⚖️', '📊', '🔍', '💼'][i]}
              </div>
            )}
          />

          {/* Inner orbiting ring */}
          <OrbitingNodes
            count={5}
            radius={55}
            duration={20}
            reverse
            nodeSize={8}
            nodeClassName="bg-emerald-400/60 rounded-full shadow-sm"
          />

          {/* Central brain */}
          <div className="relative z-20">
            <PulseRing
              color="rgba(16,185,129,0.15)"
              count={3}
              size={70}
              className="left-1/2 top-1/2"
            />
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
              <Network className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Connection spokes */}
          <svg
            className="absolute inset-0 pointer-events-none"
            viewBox="0 0 400 300"
            aria-hidden="true"
          >
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x1 = 200 + Math.cos(rad) * 36;
              const y1 = 150 + Math.sin(rad) * 36;
              const x2 = 200 + Math.cos(rad) * 104;
              const y2 = 150 + Math.sin(rad) * 104;
              return (
                <line
                  key={i}
                  x1={x1.toFixed(2)}
                  y1={y1.toFixed(2)}
                  x2={x2.toFixed(2)}
                  y2={y2.toFixed(2)}
                  stroke="rgba(16,185,129,0.22)"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
              );
            })}
          </svg>

          {/* Data flow pulses traveling along actual connection lines */}
          <svg
            className="absolute inset-0 pointer-events-none z-10"
            viewBox="0 0 400 300"
            aria-hidden="true"
          >
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x1 = 200 + Math.cos(rad) * 36;
              const y1 = 150 + Math.sin(rad) * 36;
              const x2 = 200 + Math.cos(rad) * 104;
              const y2 = 150 + Math.sin(rad) * 104;
              return (
                <circle key={i} r="2.8" fill="rgba(52,211,153,0.8)">
                  <animateMotion
                    dur="2s"
                    begin={`${i * 0.28}s`}
                    repeatCount="indefinite"
                    path={`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`}
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.12;0.88;1"
                    dur="2s"
                    begin={`${i * 0.28}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}
          </svg>
        </div>

        {/* Stats floating */}
        <FloatBadge
          className="absolute left-3 top-10 text-emerald-700"
          delay={0}
        >
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" /> 500+ Kanzleien
          </span>
        </FloatBadge>
        <FloatBadge
          className="absolute right-3 bottom-6 text-cyan-700"
          delay={0.8}
        >
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" /> 50K+ Muster
          </span>
        </FloatBadge>
      </MockupShell>
    </Parallax>
  );
}
