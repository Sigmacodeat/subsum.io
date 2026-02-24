'use client';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Gauge,
  Shield,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import {
  type ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  GlowCard,
  GradientBlob,
  ScrollProgressBar,
  ScrollReveal,
  TextRevealByWord,
} from '@/components/animations';
import {
  getMonetizationCards,
  getRecommendationCopy,
} from '@/content/pricing-offer';
import { Link } from '@/i18n/routing';

type QualificationAnswers = {
  usage: 'single' | 'recurring' | 'team';
  urgency: 'today' | 'week' | 'flexible';
  depth: 'quick' | 'strategy' | 'full';
};

type AnalyzeResult = {
  ok: boolean;
  score: number;
  supported: number;
  unsupported: number;
  likelyScans: number;
  totalMb: number;
  findings: string[];
  recommendation: {
    tier: 'credit' | 'trial' | 'kanzlei';
    ctaHref: string;
  };
  continueUrl?: string;
  pipelineMode?: 'local' | 'upstream' | 'fallback_local';
  message?: string;
};

function isLikelyScan(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return true;
  if (lower.endsWith('.pdf') && file.size > 8 * 1024 * 1024) return true;
  return false;
}

function isSupported(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    file.type.startsWith('image/') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.eml') ||
    lower.endsWith('.msg') ||
    lower.endsWith('.rtf')
  );
}

export default function QuickCheckContent() {
  const locale = useLocale();
  const isGerman = locale.toLowerCase().startsWith('de');

  const copy = {
    badge: isGerman
      ? 'Neue Akte in Minuten vorqualifizieren'
      : 'Qualify a new case file in minutes',
    title: isGerman
      ? 'Akte Quick-Check mit klarer Handlungsempfehlung'
      : 'Case file quick check with a clear action plan',
    subtitle: isGerman
      ? 'Laden Sie Dokumente hoch, prüfen Sie sofort Struktur- und Risikosignale und erhalten Sie die passende Analyse-Route: Credit-Pack, Trial oder Kanzlei-Flow.'
      : 'Upload documents, instantly assess structure and risk signals, and get the right analysis path: credit pack, trial, or firm workflow.',
    uploadTitle: isGerman ? '1) Dokumente hochladen' : '1) Upload documents',
    uploadHint: isGerman
      ? 'Unterstützt: PDF, DOCX, Bilder, E-Mail. Die Vorprüfung läuft lokal und DSGVO-orientiert.'
      : 'Supported: PDF, DOCX, images, email. The pre-check runs locally and privacy-first.',
    pickFiles: isGerman ? 'Dateien auswählen' : 'Select files',
    scoreTitle: isGerman
      ? '2) Qualitäts- und Risiko-Signale'
      : '2) Quality and risk signals',
    qualifyTitle: isGerman ? '3) Bedarf qualifizieren' : '3) Qualify your need',
    recommendationTitle: isGerman
      ? 'Empfohlener nächster Schritt'
      : 'Recommended next step',
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [answers, setAnswers] = useState<QualificationAnswers>({
    usage: 'single',
    urgency: 'today',
    depth: 'quick',
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(
    null
  );
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const onPickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected.slice(0, 80));
    setAnalyzeResult(null);
    setAnalyzeError(null);
  }, []);

  const runAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const formData = new FormData();
      formData.set('usage', answers.usage);
      formData.set('urgency', answers.urgency);
      formData.set('depth', answers.depth);
      formData.set('locale', locale);

      for (const file of files) {
        formData.append('files', file);
      }

      const response = await fetch('/api/quick-check/analyze', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json()) as AnalyzeResult;
      if (!response.ok || !payload.ok) {
        setAnalyzeError(
          payload.message ??
            (isGerman
              ? 'Quick-Check konnte nicht abgeschlossen werden.'
              : 'Quick check could not be completed.')
        );
        setAnalyzeResult(null);
        return;
      }

      setAnalyzeResult(payload);
    } catch {
      setAnalyzeError(
        isGerman
          ? 'Netzwerkfehler im Quick-Check. Bitte erneut versuchen.'
          : 'Network error during quick check. Please try again.'
      );
      setAnalyzeResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [answers.depth, answers.urgency, answers.usage, files, isGerman, locale]);

  const metrics = useMemo(() => {
    const supported = files.filter(isSupported);
    const unsupported = files.length - supported.length;
    const likelyScans = supported.filter(isLikelyScan).length;
    const totalBytes = supported.reduce((sum, file) => sum + file.size, 0);
    const totalMb = totalBytes / (1024 * 1024);

    let score = 100;
    score -= unsupported * 8;
    score -= Math.max(0, likelyScans - 2) * 4;
    score -= totalMb > 300 ? 20 : totalMb > 150 ? 10 : 0;
    score = Math.max(15, Math.min(99, Math.round(score)));

    return {
      supported: supported.length,
      unsupported,
      likelyScans,
      totalMb,
      score,
    };
  }, [files]);

  const effectiveMetrics = analyzeResult
    ? {
        score: analyzeResult.score,
        supported: analyzeResult.supported,
        unsupported: analyzeResult.unsupported,
        likelyScans: analyzeResult.likelyScans,
        totalMb: analyzeResult.totalMb,
      }
    : metrics;

  const recommendation = useMemo(() => {
    if (analyzeResult?.recommendation?.tier) {
      const tier = analyzeResult.recommendation.tier;
      const base = getRecommendationCopy(locale, tier);
      return {
        ...base,
        ctaHref: analyzeResult.recommendation.ctaHref || base.ctaHref,
      };
    }

    if (answers.usage === 'team' || answers.depth === 'full') {
      return getRecommendationCopy(locale, 'kanzlei');
    }

    if (answers.usage === 'single' && answers.depth === 'quick') {
      return getRecommendationCopy(locale, 'credit');
    }

    return getRecommendationCopy(locale, 'trial');
  }, [analyzeResult, answers, locale]);

  const monetizationCards = useMemo(
    () =>
      getMonetizationCards(locale).map(card => ({
        title: card.title,
        price: card.price,
        description: card.description,
        href: card.href,
        cta: card.cta,
      })),
    [locale]
  );

  return (
    <>
      <ScrollProgressBar />
      <section className="relative overflow-hidden pt-32 pb-16 lg:pt-40 lg:pb-24">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <GradientBlob
          className="-top-40 -right-24"
          size={420}
          colors={['#0ea5e9', '#1d4ed8', '#164e63']}
        />

        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={24}>
            <div className="mx-auto max-w-4xl text-center text-white">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.badge}
              </p>
              <TextRevealByWord
                text={copy.title}
                tag="h1"
                className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
              />
              <p className="mx-auto mt-6 max-w-3xl text-lg text-cyan-50/90">
                {copy.subtitle}
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-8 lg:grid-cols-12">
          <ScrollReveal direction="up" distance={18} className="lg:col-span-7">
            <GlowCard glowColor="rgba(14,165,233,0.14)">
              <div className="glass-card p-6 md:p-8">
                <h2 className="text-2xl font-bold text-slate-900">
                  {copy.uploadTitle}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{copy.uploadHint}</p>

                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onInputChange}
                    accept=".pdf,.docx,.doc,.txt,.eml,.msg,.rtf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp"
                  />
                  <button
                    type="button"
                    onClick={onPickFiles}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {copy.pickFiles}
                  </button>
                  <p className="mt-3 text-xs text-slate-500">
                    {isGerman
                      ? 'Max. 80 Dateien pro Vorprüfung. Für vollständige Analyse starten Sie danach den gesicherten Workflow im Produkt.'
                      : 'Up to 80 files per pre-check. For full analysis, continue in the secure product workflow.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      runAnalyze().catch(() => {
                        // handled in runAnalyze
                      });
                    }}
                    className="btn-secondary mt-4 inline-flex items-center gap-2"
                    disabled={isAnalyzing || files.length === 0}
                    aria-disabled={isAnalyzing || files.length === 0}
                  >
                    {isAnalyzing
                      ? isGerman
                        ? 'Quick-Check läuft...'
                        : 'Quick check running...'
                      : isGerman
                        ? 'Quick-Check starten'
                        : 'Run quick check'}
                  </button>
                  {analyzeError ? (
                    <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {analyzeError}
                    </p>
                  ) : null}
                </div>

                {files.length > 0 ? (
                  <div className="mt-6 space-y-2">
                    {files.slice(0, 6).map(file => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <span className="truncate pr-3 text-sm text-slate-700">
                          {file.name}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    ))}
                    {files.length > 6 ? (
                      <p className="text-xs text-slate-500">
                        {isGerman
                          ? `+ ${files.length - 6} weitere Datei(en)`
                          : `+ ${files.length - 6} more file(s)`}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </GlowCard>
          </ScrollReveal>

          <ScrollReveal
            direction="up"
            distance={18}
            delay={120}
            className="lg:col-span-5"
          >
            <GlowCard glowColor="rgba(30,64,175,0.12)">
              <div className="glass-card h-full p-6 md:p-8">
                <h3 className="text-xl font-bold text-slate-900">
                  {copy.scoreTitle}
                </h3>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">
                      {isGerman ? 'Readiness-Score' : 'Readiness score'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-sm font-bold text-primary-700">
                      <Gauge className="h-3.5 w-3.5" /> {effectiveMetrics.score}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <p>
                      {isGerman ? 'Unterstützte Dateien' : 'Supported files'}:{' '}
                      <strong>{effectiveMetrics.supported}</strong>
                    </p>
                    <p>
                      {isGerman ? 'Nicht unterstützt' : 'Unsupported'}:{' '}
                      <strong>{effectiveMetrics.unsupported}</strong>
                    </p>
                    <p>
                      {isGerman
                        ? 'Wahrscheinliche OCR-Dokumente'
                        : 'Likely OCR-heavy docs'}
                      : <strong>{effectiveMetrics.likelyScans}</strong>
                    </p>
                    <p>
                      {isGerman ? 'Datenvolumen' : 'Volume'}:{' '}
                      <strong>{effectiveMetrics.totalMb.toFixed(1)} MB</strong>
                    </p>
                  </div>
                </div>

                {analyzeResult?.findings?.length ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {isGerman
                        ? 'Quick-Check Findings'
                        : 'Quick-check findings'}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {analyzeResult.findings.map(item => (
                        <li key={item} className="text-sm text-slate-700">
                          - {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4" />
                    {isGerman
                      ? 'Sofort nutzbar für Vorprüfung, Priorisierung und Intake-Qualifizierung.'
                      : 'Ready for immediate pre-check, prioritization, and intake qualification.'}
                  </div>
                  <div className="flex items-start gap-3 text-amber-600">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <p className="text-sm leading-relaxed">
                      {isGerman
                        ? 'Für belastbare Tiefenanalyse werden OCR, semantische Verknüpfung und Quellenprüfung im gesicherten App-Flow ausgeführt.'
                        : 'For robust deep analysis, OCR, semantic linking, and source grounding run in the secure app workflow.'}
                    </p>
                  </div>
                </div>
              </div>
            </GlowCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-slate-50">
        <div className="container-wide grid gap-8 lg:grid-cols-12">
          <ScrollReveal direction="up" className="lg:col-span-7">
            <div className="glass-card p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900">
                {copy.qualifyTitle}
              </h3>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    {isGerman ? 'Nutzungsprofil' : 'Usage profile'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        id: 'single',
                        label: isGerman ? 'Einzelfall' : 'One-off case',
                      },
                      {
                        id: 'recurring',
                        label: isGerman
                          ? 'Regelmäßige Fälle'
                          : 'Recurring cases',
                      },
                      {
                        id: 'team',
                        label: isGerman ? 'Team / Kanzlei' : 'Team / firm',
                      },
                    ].map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          answers.usage === option.id
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                        onClick={() =>
                          setAnswers(prev => ({
                            ...prev,
                            usage: option.id as QualificationAnswers['usage'],
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    {isGerman ? 'Zeitdruck' : 'Time pressure'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'today', label: isGerman ? 'Heute' : 'Today' },
                      {
                        id: 'week',
                        label: isGerman ? 'Diese Woche' : 'This week',
                      },
                      {
                        id: 'flexible',
                        label: isGerman ? 'Flexibel' : 'Flexible',
                      },
                    ].map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          answers.urgency === option.id
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                        onClick={() =>
                          setAnswers(prev => ({
                            ...prev,
                            urgency:
                              option.id as QualificationAnswers['urgency'],
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    {isGerman ? 'Analyse-Tiefe' : 'Depth needed'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        id: 'quick',
                        label: isGerman ? 'Quick-Check' : 'Quick check',
                      },
                      {
                        id: 'strategy',
                        label: isGerman
                          ? 'Strategische Prüfung'
                          : 'Strategic review',
                      },
                      {
                        id: 'full',
                        label: isGerman
                          ? 'Volle Kanzlei-Analyse'
                          : 'Full firm analysis',
                      },
                    ].map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          answers.depth === option.id
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                        onClick={() =>
                          setAnswers(prev => ({
                            ...prev,
                            depth: option.id as QualificationAnswers['depth'],
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={120} className="lg:col-span-5">
            <div className="glass-card h-full p-6 md:p-8">
              <h4 className="text-lg font-bold text-slate-900">
                {copy.recommendationTitle}
              </h4>
              <div className="mt-4 rounded-2xl border border-primary-200 bg-primary-50 p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
                  {recommendation.label}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {recommendation.description}
                </p>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-700">
                <p className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 text-slate-500" />
                  {isGerman
                    ? 'Datenschutzorientiert: Vorprüfung lokal, Tiefenanalyse in gesicherter Umgebung.'
                    : 'Privacy-first: pre-check local, deep analysis in a secured environment.'}
                </p>
                <p className="flex items-start gap-2">
                  <FileSearch className="mt-0.5 h-4 w-4 text-slate-500" />
                  {isGerman
                    ? 'Dokumenten-first Workflow ohne manuelle Umwege.'
                    : 'Documents-first workflow without manual detours.'}
                </p>
              </div>

              <Link
                href={recommendation.ctaHref}
                className="btn-primary mt-6 inline-flex items-center gap-2"
              >
                {recommendation.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {analyzeResult?.continueUrl ? (
                <a
                  href={analyzeResult.continueUrl}
                  className="btn-secondary mt-3 inline-flex items-center gap-2"
                >
                  {isGerman
                    ? 'In App weiter zur Tiefenanalyse'
                    : 'Continue in app for deep analysis'}
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
              {analyzeResult?.pipelineMode ? (
                <p className="mt-3 text-xs text-slate-500">
                  {analyzeResult.pipelineMode === 'upstream'
                    ? isGerman
                      ? 'Pipeline-Modus: Produktive Upstream-Analyse angebunden.'
                      : 'Pipeline mode: connected to upstream production analysis.'
                    : analyzeResult.pipelineMode === 'fallback_local'
                      ? isGerman
                        ? 'Pipeline-Modus: Upstream temporär nicht erreichbar, lokale Vorqualifizierung aktiv.'
                        : 'Pipeline mode: upstream temporarily unavailable, local pre-qualification active.'
                      : isGerman
                        ? 'Pipeline-Modus: Lokale Vorqualifizierung mit sicherem App-Handoff.'
                        : 'Pipeline mode: local pre-qualification with secure app handoff.'}
                </p>
              ) : null}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide">
          <ScrollReveal direction="up" distance={18}>
            <div className="mb-8 text-center">
              <h3 className="text-2xl font-bold text-slate-900">
                {isGerman
                  ? 'Monetarisierungs-Route nach Ihrem Bedarf'
                  : 'Monetization route aligned to your need'}
              </h3>
              <p className="mt-2 text-slate-600">
                {isGerman
                  ? 'Kein One-Size-Fits-All: Wählen Sie den wirtschaftlich sinnvollsten Einstieg je Falltyp.'
                  : 'No one-size-fits-all model: choose the most efficient entry path per matter type.'}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-4 md:grid-cols-3">
            {monetizationCards.map(card => (
              <ScrollReveal key={card.title} direction="up" distance={16}>
                <div className="glass-card flex h-full flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">
                    {card.price}
                  </p>
                  <h4 className="mt-2 text-lg font-bold text-slate-900">
                    {card.title}
                  </h4>
                  <p className="mt-2 flex-1 text-sm text-slate-600">
                    {card.description}
                  </p>
                  <Link
                    href={card.href}
                    className="btn-secondary mt-4 inline-flex items-center gap-2"
                  >
                    {card.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
