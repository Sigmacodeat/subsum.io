'use client';

import {
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  FileText,
  Gauge,
  LayoutDashboard,
  MousePointer2,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useElementScrollProgress,
  useResponsiveMotionScale,
} from './animations';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(Boolean(mq.matches));
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

function formatCountdown(dueAtIso: string) {
  const due = new Date(dueAtIso).getTime();
  const now = Date.now();
  const diff = due - now;
  if (!Number.isFinite(diff)) return '';
  const abs = Math.abs(diff);
  const days = Math.max(0, Math.round(abs / (1000 * 60 * 60 * 24)));
  const label = days === 1 ? 'Tag' : 'Tage';
  return diff < 0 ? `überfällig · ${days} ${label}` : `in ${days} ${label}`;
}

type PreviewMatter = {
  id: string;
  az: string;
  title: string;
  client: string;
  status: 'In Bearbeitung' | 'Wartet' | 'Abgeschlossen';
  priority: 'hoch' | 'mittel' | 'niedrig';
  assignedTo: string;
  updatedAtLabel: string;
};

type PreviewDeadline = {
  id: string;
  title: string;
  dueAtIso: string;
  kind: 'overdue' | 'soon' | 'upcoming';
};

type PreviewChat = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chips?: string[];
};

type PreviewActivity = {
  id: string;
  title: string;
  meta: string;
  tone: 'ok' | 'warn' | 'info';
};

type WorkflowStep = {
  id: string;
  label: string;
  x: number;
  y: number;
};

const DESKTOP_WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'search', label: 'Prüfung starten', x: 73, y: 11 },
  { id: 'copilot', label: 'Copilot validiert', x: 82, y: 44 },
  { id: 'matter', label: 'Akte priorisieren', x: 31, y: 56 },
  { id: 'export', label: 'Export freigeben', x: 84, y: 90 },
];

const TABLET_WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'search', label: 'Prüfung starten', x: 69, y: 14 },
  { id: 'copilot', label: 'Copilot validiert', x: 76, y: 40 },
  { id: 'matter', label: 'Akte priorisieren', x: 34, y: 58 },
  { id: 'export', label: 'Export freigeben', x: 74, y: 84 },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function AppDashboardPreview() {
  const reducedMotion = usePrefersReducedMotion();
  const motionScale = useResponsiveMotionScale();
  const isTabletMotion = motionScale < 0.95;
  const motionEaseScale = clamp((motionScale - 0.58) / 0.42, 0.58, 1);
  const [now] = useState(() => Date.now());
  const frameRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 2, ry: -3, gx: 50, gy: 30 });
  const [searchText, setSearchText] = useState('');
  const [searchTargetIndex, setSearchTargetIndex] = useState(0);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [workflowClick, setWorkflowClick] = useState(false);
  const { ref: scrollRef, progress } = useElementScrollProgress(80);

  const depth = useMemo(() => {
    const p = clamp(progress, 0, 1);
    const amp = motionEaseScale;
    return {
      p,
      mainY: (0.5 - p) * (14 * amp),
      kpiY: (0.5 - p) * (20 * amp),
      listY: (0.5 - p) * (26 * amp),
      rightY: (0.5 - p) * (32 * amp),
      sheenOpacity: clamp((p - 0.1) / 0.5, 0, 1),
    };
  }, [progress, motionEaseScale]);

  const motionTiming = useMemo(() => {
    const responseFactor = 1 - motionEaseScale;
    return {
      typingInitialDelayMs: Math.round(190 + responseFactor * 120),
      typingMs: Math.round(32 + responseFactor * 10),
      deletingMs: Math.round(26 + responseFactor * 8),
      typingPauseMs: Math.round(920 + responseFactor * 220),
      workflowCadenceMs: Math.round(1820 + responseFactor * 560),
      workflowClickMs: Math.round(220 + responseFactor * 90),
      panelShiftMs: Math.round(205 + responseFactor * 75),
      cursorTravelMs: Math.round(730 + responseFactor * 230),
    };
  }, [motionEaseScale]);

  const matters = useMemo<PreviewMatter[]>(
    () => [
      {
        id: 'm1',
        az: 'AZ 2026/014',
        title: 'Kaufvertrag · Gewährleistung',
        client: 'Muster GmbH',
        status: 'In Bearbeitung',
        priority: 'hoch',
        assignedTo: 'RA Schmidt',
        updatedAtLabel: 'vor 12 Min',
      },
      {
        id: 'm2',
        az: 'AZ 2026/008',
        title: 'Zahlungsklage · Werklohn',
        client: 'Bau & Co KG',
        status: 'Wartet',
        priority: 'mittel',
        assignedTo: 'RA Weber',
        updatedAtLabel: 'heute',
      },
      {
        id: 'm3',
        az: 'AZ 2025/112',
        title: 'Schadenersatz · Verkehrsunfall',
        client: 'Anna H.',
        status: 'In Bearbeitung',
        priority: 'mittel',
        assignedTo: 'RA Klein',
        updatedAtLabel: 'gestern',
      },
      {
        id: 'm4',
        az: 'AZ 2025/097',
        title: 'Mietrecht · Kündigung',
        client: 'Wohnbau AG',
        status: 'Wartet',
        priority: 'niedrig',
        assignedTo: 'RA Schmidt',
        updatedAtLabel: 'vor 3 Tagen',
      },
      {
        id: 'm5',
        az: 'AZ 2025/061',
        title: 'Arbeitsrecht · Abmahnung',
        client: 'Kleinhandel e.U.',
        status: 'Abgeschlossen',
        priority: 'niedrig',
        assignedTo: 'RA Weber',
        updatedAtLabel: 'vor 2 Wochen',
      },
    ],
    []
  );

  const deadlines = useMemo<PreviewDeadline[]>(
    () => [
      {
        id: 'd1',
        title: 'Stellungnahme (Gegenseite) einlangen',
        dueAtIso: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
        kind: 'overdue',
      },
      {
        id: 'd2',
        title: 'Frist: Klagebeantwortung finalisieren',
        dueAtIso: new Date(now + 1000 * 60 * 60 * 24 * 3).toISOString(),
        kind: 'soon',
      },
      {
        id: 'd3',
        title: 'Termin: Verhandlung vorbereiten',
        dueAtIso: new Date(now + 1000 * 60 * 60 * 24 * 14).toISOString(),
        kind: 'upcoming',
      },
    ],
    [now]
  );

  const searchTargets = useMemo(
    () => [
      'Gewährleistung § 437 BGB',
      'Frist: Klagebeantwortung',
      'Widerspruch Zeuge A ↔ B',
      'AZ 2026/014',
    ],
    []
  );

  const workflowSteps = useMemo<WorkflowStep[]>(
    () => (isTabletMotion ? TABLET_WORKFLOW_STEPS : DESKTOP_WORKFLOW_STEPS),
    [isTabletMotion]
  );

  useEffect(() => {
    if (reducedMotion) {
      setSearchText(searchTargets[0] ?? '');
      return;
    }

    const target =
      searchTargets[searchTargetIndex % searchTargets.length] ?? '';
    let isDeleting = false;
    let i = 0;
    let t: number | undefined;

    const tick = () => {
      const next = isDeleting ? target.slice(0, i - 1) : target.slice(0, i + 1);
      setSearchText(next);
      i = next.length;

      if (!isDeleting && i >= target.length) {
        t = window.setTimeout(() => {
          isDeleting = true;
          tick();
        }, motionTiming.typingPauseMs);
        return;
      }

      if (isDeleting && i <= 0) {
        setSearchTargetIndex(v => (v + 1) % searchTargets.length);
        return;
      }

      t = window.setTimeout(
        tick,
        isDeleting ? motionTiming.deletingMs : motionTiming.typingMs
      );
    };

    t = window.setTimeout(tick, motionTiming.typingInitialDelayMs);
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [reducedMotion, searchTargetIndex, searchTargets, motionTiming]);

  useEffect(() => {
    if (reducedMotion) {
      setActiveWorkflowStep(0);
      setWorkflowClick(false);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveWorkflowStep(prev => (prev + 1) % workflowSteps.length);
    }, motionTiming.workflowCadenceMs);

    return () => window.clearInterval(interval);
  }, [reducedMotion, workflowSteps.length, motionTiming.workflowCadenceMs]);

  useEffect(() => {
    if (reducedMotion) return;
    setWorkflowClick(true);
    const timeout = window.setTimeout(
      () => setWorkflowClick(false),
      motionTiming.workflowClickMs
    );
    return () => window.clearTimeout(timeout);
  }, [activeWorkflowStep, reducedMotion, motionTiming.workflowClickMs]);

  const onMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (reducedMotion) return;
      const el = frameRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((e.clientY - rect.top) / rect.height, 0, 1);

      const rx = (0.5 - py) * (8 * motionEaseScale);
      const ry = (px - 0.5) * (10 * motionEaseScale);

      setTilt({
        rx,
        ry,
        gx: Math.round(px * 100),
        gy: Math.round(py * 100),
      });
    },
    [reducedMotion, motionEaseScale]
  );

  const onMouseLeave = useCallback(() => {
    if (reducedMotion) return;
    setTilt({
      rx: 2 * motionEaseScale,
      ry: -3 * motionEaseScale,
      gx: 50,
      gy: 30,
    });
  }, [reducedMotion, motionEaseScale]);

  const chat = useMemo<PreviewChat[]>(
    () => [
      {
        id: 'c1',
        role: 'user',
        text: 'Check bitte, ob § 933 ABGB/§ 437 BGB für den Gewährleistungsanspruch passt.',
      },
      {
        id: 'c2',
        role: 'assistant',
        text: 'Ja. Für Gewährleistung: Anspruchsvoraussetzungen + Fristen sauber trennen. Ich habe dir 3 Argumentationslinien und die relevanten Normen extrahiert.',
        chips: ['§ 933 ABGB', '§ 437 BGB', 'Beweislage', 'Frist-Plan'],
      },
      {
        id: 'c3',
        role: 'assistant',
        text: 'Offene To‑dos: Beweisangebot (Fotos) verknüpfen, Fristwarnung bestätigen, Schriftsatz‑Entwurf starten.',
      },
    ],
    []
  );

  const activity = useMemo<PreviewActivity[]>(
    () => [
      {
        id: 'a1',
        title: 'OCR abgeschlossen: „Vertrag_2021.pdf“',
        meta: 'Qualität 94 · 18 Chunks',
        tone: 'ok',
      },
      {
        id: 'a2',
        title: 'Widerspruch gefunden',
        meta: 'Zeuge A ↔ Zeuge B · Severity: hoch',
        tone: 'warn',
      },
      {
        id: 'a3',
        title: 'Dokumentgenerator bereit',
        meta: 'Template: Klage · Auto‑Fill aktiv',
        tone: 'info',
      },
    ],
    []
  );

  const statusPill = (status: PreviewMatter['status']) => {
    if (status === 'In Bearbeitung')
      return 'bg-blue-50 text-blue-700 border-blue-100';
    if (status === 'Wartet')
      return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  };

  const priorityDot = (p: PreviewMatter['priority']) => {
    if (p === 'hoch') return 'bg-red-500';
    if (p === 'mittel') return 'bg-amber-500';
    return 'bg-slate-300';
  };

  const deadlinePill = (k: PreviewDeadline['kind']) => {
    if (k === 'overdue') return 'bg-red-50 text-red-700 border-red-100';
    if (k === 'soon') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const currentWorkflow = workflowSteps[activeWorkflowStep] ?? workflowSteps[0];

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label="Interaktive Produktvorschau des Legal Ops Dashboards mit Aktenliste, Fristen, Copilot und Aktivitätsfeed"
      className="relative rounded-[26px] border border-slate-200/90 bg-white shadow-[0_28px_90px_-30px_rgba(2,6,23,0.28)] overflow-hidden aspect-[16/9] group"
      style={{
        transform: reducedMotion ? undefined : 'perspective(1200px)',
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div
        aria-hidden="true"
        className="absolute -inset-[2px] rounded-[24px] opacity-70"
        style={{
          background:
            'linear-gradient(120deg, rgba(30,64,175,0.22), rgba(8,145,178,0.18), rgba(16,185,129,0.12), rgba(30,64,175,0.22))',
          backgroundSize: '200% 200%',
          animation: reducedMotion
            ? undefined
            : 'gradient-shift 10s ease-in-out infinite',
          filter: 'blur(8px)',
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-primary-50/80 via-white to-cyan-50/60"
      />

      <div
        aria-hidden="true"
        className="absolute -inset-10 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 20% 10%, rgba(30,64,175,0.20), transparent 35%), radial-gradient(circle at 85% 30%, rgba(8,145,178,0.14), transparent 40%), radial-gradient(circle at 50% 90%, rgba(59,130,246,0.10), transparent 45%)',
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 grid-pattern opacity-60"
      />

      <div
        aria-hidden="true"
        className="relative h-full w-full"
        style={{
          transform: reducedMotion ? undefined : 'translateZ(0)',
        }}
      >
        <div ref={scrollRef} className="absolute inset-0 p-4 sm:p-5">
          <div
            className="h-full rounded-[22px] border border-slate-200/75 bg-white/72 backdrop-blur-2xl overflow-hidden transition-transform duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:[transform:rotateX(0deg)_rotateY(0deg)]"
            style={{
              boxShadow:
                '0 22px 60px -32px rgba(15,23,42,0.4), inset 0 1px 0 rgba(255,255,255,0.55)',
              transform: reducedMotion
                ? undefined
                : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: `radial-gradient(520px circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.55), transparent 45%)`,
                mixBlendMode: 'soft-light',
              }}
            />
            <div
              className="pointer-events-none absolute -inset-12 opacity-60"
              style={{
                background:
                  'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.32) 50%, transparent 65%)',
                transform: reducedMotion ? undefined : 'translateX(-30%)',
                animation: reducedMotion
                  ? undefined
                  : 'marquee 8s linear infinite',
                filter: 'blur(0.5px)',
                opacity: reducedMotion
                  ? 0.25
                  : 0.25 + depth.sheenOpacity * 0.55,
              }}
            />

            <div className="flex h-full">
              <div className="hidden sm:flex w-[68px] bg-white/82 border-r border-slate-200/70 flex-col items-center py-3 gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary-600/25">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  {[LayoutDashboard, FileText, Users, Bell, BookOpen].map(
                    (I, idx) => {
                      const isActive = idx === 1;
                      return (
                        <div
                          key={idx}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                            isActive
                              ? 'bg-primary-600 text-white border-primary-300 shadow-md shadow-primary-600/20'
                              : 'bg-white/70 text-slate-500 border-slate-200/60 hover:bg-white hover:text-slate-700'
                          }`}
                        >
                          <I className="w-5 h-5" />
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="mt-auto w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shadow-md">
                  MS
                </div>
              </div>

              <div
                className="flex-1 min-w-0"
                style={{
                  transform: reducedMotion
                    ? undefined
                    : `translateY(${depth.mainY}px) translateZ(0)`,
                  transition: reducedMotion
                    ? undefined
                    : `transform ${motionTiming.panelShiftMs}ms cubic-bezier(0.16,1,0.3,1)`,
                  willChange: reducedMotion ? undefined : 'transform',
                }}
              >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/70 bg-white/65">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[11px] sm:text-xs font-bold text-slate-700 truncate">
                      Akten
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/5 text-slate-600 border border-slate-200/60 font-semibold">
                      28 aktiv
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <div
                      className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/75 border shadow-sm transition-all duration-300 ${
                        !reducedMotion && activeWorkflowStep === 0
                          ? 'border-primary-300/90 shadow-[0_8px_22px_-14px_rgba(37,99,235,0.7)]'
                          : 'border-slate-200/70'
                      }`}
                    >
                      <Search className="w-4 h-4 text-slate-400" />
                      <div className="text-[11px] text-slate-400 font-medium">
                        {searchText || 'Suche: Mandant, AZ, Norm…'}
                      </div>
                      <div
                        className="w-[2px] h-3 bg-primary-500/70"
                        style={{
                          animation: reducedMotion
                            ? undefined
                            : 'fadeIn 700ms ease-in-out infinite alternate',
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/75 border border-slate-200/70 shadow-sm">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center text-[10px] font-bold">
                        Kanzlei
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] h-[calc(100%-52px)]">
                  <div className="min-w-0 p-4">
                    <div
                      className="grid grid-cols-3 gap-3 mb-4"
                      style={{
                        transform: reducedMotion
                          ? undefined
                          : `translateY(${depth.kpiY}px) translateZ(0)`,
                        transition: reducedMotion
                          ? undefined
                          : `transform ${motionTiming.panelShiftMs}ms cubic-bezier(0.16,1,0.3,1)`,
                        willChange: reducedMotion ? undefined : 'transform',
                      }}
                    >
                      <div className="rounded-[14px] bg-white/82 border border-slate-200/70 p-3 shadow-sm">
                        <div className="text-[10px] text-slate-500 font-semibold">
                          Offene Akten
                        </div>
                        <div className="mt-1 flex items-end gap-2">
                          <div className="text-xl font-extrabold text-slate-900">
                            12
                          </div>
                          <div className="text-[10px] text-emerald-600 font-bold">
                            +2
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                            style={{
                              width: '72%',
                              animation: reducedMotion
                                ? undefined
                                : 'fadeIn 1.2s ease-out both',
                            }}
                          />
                        </div>
                      </div>
                      <div className="rounded-[14px] bg-white/82 border border-slate-200/70 p-3 shadow-sm">
                        <div className="text-[10px] text-slate-500 font-semibold">
                          Fristen (14d)
                        </div>
                        <div className="mt-1 flex items-end gap-2">
                          <div className="text-xl font-extrabold text-slate-900">
                            5
                          </div>
                          <div className="text-[10px] text-amber-600 font-bold">
                            kritisch
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                            style={{
                              width: '58%',
                              animation: reducedMotion
                                ? undefined
                                : 'fadeIn 1.2s ease-out 120ms both',
                            }}
                          />
                        </div>
                      </div>
                      <div className="rounded-[14px] bg-white/82 border border-slate-200/70 p-3 shadow-sm">
                        <div className="text-[10px] text-slate-500 font-semibold">
                          Quality Score
                        </div>
                        <div className="mt-1 flex items-end gap-2">
                          <div className="text-xl font-extrabold text-slate-900">
                            94
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            /100
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-600 to-cyan-600 rounded-full"
                            style={{
                              width: '94%',
                              animation: reducedMotion
                                ? undefined
                                : 'fadeIn 1.2s ease-out 240ms both',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-[16px] bg-white/82 border border-slate-200/70 shadow-sm overflow-hidden"
                      style={{
                        transform: reducedMotion
                          ? undefined
                          : `translateY(${depth.listY}px) translateZ(0)`,
                        transition: reducedMotion
                          ? undefined
                          : `transform ${motionTiming.panelShiftMs}ms cubic-bezier(0.16,1,0.3,1)`,
                        willChange: reducedMotion ? undefined : 'transform',
                      }}
                    >
                      <div className="px-4 py-3 border-b border-slate-200/70 bg-white/60 flex items-center">
                        <div className="text-[11px] font-bold text-slate-700">
                          Aktive Akten
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] px-2 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100 font-semibold">
                            Filter: Heute
                          </span>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 font-semibold">
                            Sort: Priorität
                          </span>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-200/60">
                        {matters.map((m, idx) => (
                          <div
                            key={m.id}
                            className={`px-4 py-3 flex items-center gap-3 transition-all duration-300 ${
                              !reducedMotion &&
                              activeWorkflowStep === 2 &&
                              idx === 0
                                ? 'bg-primary-50/70 shadow-[inset_0_0_0_1px_rgba(147,197,253,0.8)]'
                                : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${priorityDot(m.priority)} shadow-sm`}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="text-[11px] font-extrabold text-slate-900 truncate">
                                  {m.az}
                                </div>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusPill(m.status)}`}
                                >
                                  {m.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-medium truncate">
                                {m.title}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {m.client}
                              </div>
                            </div>

                            <div className="hidden md:flex flex-col items-end gap-1">
                              <div className="text-[10px] text-slate-500 font-semibold">
                                {m.assignedTo}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {m.updatedAtLabel}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    className="hidden lg:flex flex-col border-l border-slate-200/70 bg-white/55 p-4 gap-3"
                    style={{
                      transform: reducedMotion
                        ? undefined
                        : `translateY(${depth.rightY}px) translateZ(0)`,
                      transition: reducedMotion
                        ? undefined
                        : `transform ${motionTiming.panelShiftMs}ms cubic-bezier(0.16,1,0.3,1)`,
                      willChange: reducedMotion ? undefined : 'transform',
                    }}
                  >
                    <div
                      className={`rounded-[16px] bg-white/82 border shadow-sm overflow-hidden transition-all duration-300 ${
                        !reducedMotion && activeWorkflowStep === 1
                          ? 'border-primary-300/80 shadow-[0_14px_38px_-24px_rgba(37,99,235,0.75)]'
                          : 'border-slate-200/70'
                      }`}
                    >
                      <div className="px-4 py-3 border-b border-slate-200/70 bg-white/60 flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-slate-600" />
                        <div className="text-[11px] font-bold text-slate-700">
                          Copilot
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-slate-500 font-semibold">
                            online
                          </span>
                        </div>
                      </div>

                      <div className="p-3 space-y-2">
                        {chat.map(msg => (
                          <div
                            key={msg.id}
                            className={`rounded-xl border px-3 py-2 text-[10.5px] leading-relaxed shadow-sm ${
                              msg.role === 'assistant'
                                ? 'bg-primary-50/70 border-primary-100 text-slate-700'
                                : 'bg-white/80 border-slate-200/70 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                                  msg.role === 'assistant'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-slate-900 text-white'
                                }`}
                              >
                                {msg.role === 'assistant' ? (
                                  <Brain className="w-3.5 h-3.5" />
                                ) : (
                                  <Users className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="text-[10px] font-bold text-slate-700">
                                {msg.role === 'assistant' ? 'Copilot' : 'Du'}
                              </div>
                            </div>

                            <div>{msg.text}</div>

                            {msg.chips && msg.chips.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {msg.chips.slice(0, 4).map(c => (
                                  <span
                                    key={c}
                                    className="px-2 py-0.5 rounded-full bg-white/70 border border-slate-200/60 text-[9px] font-semibold text-slate-600"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        <div className="h-9 rounded-xl bg-white/70 border border-slate-200/70 flex items-center px-3">
                          <div className="text-[10px] text-slate-400 font-medium">
                            Schreibe eine Frage…
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary-500/70 animate-pulse" />
                            <div
                              className="w-14 h-6 rounded-lg gradient-primary shadow-sm"
                              style={{
                                animation:
                                  !reducedMotion && activeWorkflowStep === 1
                                    ? 'pulse 1.4s ease-in-out infinite'
                                    : undefined,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[16px] bg-white/82 border border-slate-200/70 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200/70 bg-white/60 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-slate-600" />
                        <div className="text-[11px] font-bold text-slate-700">
                          Fristen
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {deadlines.map(d => (
                          <div key={d.id} className="flex items-start gap-2">
                            <div
                              className={`mt-0.5 w-2 h-2 rounded-full ${d.kind === 'overdue' ? 'bg-red-500' : d.kind === 'soon' ? 'bg-amber-500' : 'bg-slate-300'}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10.5px] font-semibold text-slate-700 truncate">
                                {d.title}
                              </div>
                              <div className="text-[9.5px] text-slate-500 font-medium">
                                {formatCountdown(d.dueAtIso)}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${deadlinePill(d.kind)}`}
                              style={{
                                animation:
                                  !reducedMotion && d.kind === 'overdue'
                                    ? 'glow-pulse 2.4s ease-in-out infinite'
                                    : undefined,
                              }}
                            >
                              {d.kind === 'overdue'
                                ? 'OVERDUE'
                                : d.kind === 'soon'
                                  ? '7d'
                                  : '14d'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[16px] bg-white/82 border border-slate-200/70 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200/70 bg-white/60 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-600" />
                        <div className="text-[11px] font-bold text-slate-700">
                          Aktivität
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {activity.map((a, idx) => (
                          <div key={a.id} className="flex items-start gap-2">
                            <div
                              className={`mt-0.5 w-2 h-2 rounded-full ${
                                a.tone === 'warn'
                                  ? 'bg-red-500'
                                  : a.tone === 'ok'
                                    ? 'bg-emerald-500'
                                    : 'bg-blue-500'
                              }`}
                            />
                            <div
                              className="min-w-0 flex-1"
                              style={{
                                opacity: reducedMotion
                                  ? 1
                                  : clamp(
                                      (depth.p - 0.18 - idx * 0.1) / 0.25,
                                      0,
                                      1
                                    ),
                                transform: reducedMotion
                                  ? undefined
                                  : `translateY(${(1 - clamp((depth.p - 0.18 - idx * 0.1) / 0.25, 0, 1)) * 10}px)`,
                                transition: reducedMotion
                                  ? undefined
                                  : 'opacity 220ms ease, transform 220ms ease',
                              }}
                            >
                              <div className="text-[10.5px] font-semibold text-slate-700 truncate">
                                {a.title}
                              </div>
                              <div className="text-[9.5px] text-slate-500 font-medium truncate">
                                {a.meta}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.35) 100%)',
            opacity: 0,
            transition: 'opacity 500ms ease',
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[26px] ring-1 ring-inset ring-black/5"
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute top-6 left-6 w-40 h-9 rounded-xl bg-white/72 backdrop-blur-sm border border-slate-200/50 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)]"
        style={{
          animation: reducedMotion
            ? undefined
            : 'float-slow 7s ease-in-out infinite',
        }}
      >
        <div className="h-full w-full px-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
          <span className="text-[10px] font-semibold text-slate-700">Sync</span>
          <span className="ml-auto text-[10px] font-bold text-emerald-700">
            ✓
          </span>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute top-6 right-6 w-32 h-9 rounded-xl bg-white/72 backdrop-blur-sm border border-slate-200/50 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)]"
        style={{
          animation: reducedMotion
            ? undefined
            : 'float-slow 7s ease-in-out -2s infinite',
        }}
      >
        <div className="h-full w-full px-2.5 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-slate-900/5 border border-slate-200/60 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-700 truncate">
              Audit
            </div>
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute bottom-6 left-6 w-48 rounded-xl bg-white/72 backdrop-blur-sm border border-slate-200/50 shadow-[0_10px_24px_-14px_rgba(15,23,42,0.35)]"
        style={{
          height: 84,
          animation: reducedMotion
            ? undefined
            : 'float-slow 7s ease-in-out -4s infinite',
        }}
      >
        <div className="h-full w-full p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-primary-600/10 border border-primary-200/50 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-primary-700" />
            </div>
            <div className="text-[10px] font-bold text-slate-700">
              Nächste Schritte
            </div>
          </div>
          <div className="space-y-1">
            {['Beweis verknüpfen', 'Frist bestätigen', 'Entwurf starten'].map(
              (label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-slate-400"
                    style={{ opacity: 0.8 - i * 0.2 }}
                  />
                  <div
                    className="h-1.5 bg-slate-200 rounded-full"
                    style={{ width: `${76 - i * 10}%` }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute bottom-6 right-6 w-36 rounded-xl bg-white/72 backdrop-blur-sm border border-slate-200/50 shadow-[0_10px_24px_-14px_rgba(15,23,42,0.35)]"
        style={{
          height: 70,
          animation: reducedMotion
            ? undefined
            : 'float-slow 7s ease-in-out -6s infinite',
        }}
      >
        <div className="h-full w-full p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600/10 border border-emerald-200/50 flex items-center justify-center">
              <Gauge className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <div className="text-[10px] font-bold text-slate-700">Export</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold text-slate-600">
                PDF
              </span>
              <span className="text-[9px] font-bold text-slate-700">
                bereit
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
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

      {!reducedMotion && currentWorkflow && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20"
          >
            {workflowSteps.map((step, idx) => {
              const isActive = idx === activeWorkflowStep;
              return (
                <div
                  key={step.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${step.x}%`,
                    top: `${step.y}%`,
                    width: isActive ? 16 : 10,
                    height: isActive ? 16 : 10,
                    background: isActive
                      ? 'rgba(59,130,246,0.36)'
                      : 'rgba(148,163,184,0.22)',
                    border: isActive
                      ? '1px solid rgba(59,130,246,0.7)'
                      : '1px solid rgba(148,163,184,0.35)',
                    boxShadow: isActive
                      ? '0 0 0 7px rgba(59,130,246,0.12)'
                      : undefined,
                    transition: 'all 240ms ease',
                  }}
                />
              );
            })}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-30"
            style={{
              left: `${currentWorkflow.x}%`,
              top: `${currentWorkflow.y}%`,
              transform: `translate(-40%, -30%) scale(${workflowClick ? (isTabletMotion ? 0.95 : 0.92) : 1})`,
              transition: `left ${motionTiming.cursorTravelMs}ms cubic-bezier(0.16,1,0.3,1), top ${motionTiming.cursorTravelMs}ms cubic-bezier(0.16,1,0.3,1), transform 180ms ease`,
            }}
          >
            <div className="relative">
              <MousePointer2 className="h-5 w-5 fill-white text-slate-800 drop-shadow-[0_4px_10px_rgba(15,23,42,0.4)]" />
              <div
                className="absolute left-4 top-3 rounded-full border border-primary-200/80 bg-white/92 px-2 py-1 text-[9px] font-semibold text-primary-700 shadow-[0_8px_20px_-14px_rgba(37,99,235,0.65)]"
                style={{
                  whiteSpace: 'nowrap',
                  fontSize: isTabletMotion ? 8 : 9,
                }}
              >
                {currentWorkflow.label}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
