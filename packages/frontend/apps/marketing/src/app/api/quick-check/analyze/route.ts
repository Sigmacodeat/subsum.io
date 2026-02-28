import { createHmac, randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { DEFAULT_APP_ORIGIN } from '@/utils/app-auth';

type Usage = 'single' | 'recurring' | 'team';
type Urgency = 'today' | 'week' | 'flexible';
type Depth = 'quick' | 'strategy' | 'full';

const MAX_FILES = 80;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 12_000;
const DEFAULT_UPSTREAM_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 350;

const SUPPORTED_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'doc',
  'txt',
  'eml',
  'msg',
  'rtf',
  'png',
  'jpg',
  'jpeg',
  'tiff',
  'tif',
  'bmp',
  'webp',
]);

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() ?? '';
  return file.type.startsWith('image/') || SUPPORTED_EXTENSIONS.has(ext);
}

function toBase64Url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseEnvNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function createUpstreamPayload(input: {
  usage: Usage;
  urgency: Urgency;
  depth: Depth;
  locale: string;
  files: File[];
}) {
  const form = new FormData();
  form.set('usage', input.usage);
  form.set('urgency', input.urgency);
  form.set('depth', input.depth);
  form.set('locale', input.locale);
  for (const file of input.files) {
    form.append('files', file);
  }
  return form;
}

function buildAppContinueUrl(params: {
  usage: Usage;
  urgency: Urgency;
  depth: Depth;
  locale: string;
  score: number;
  supported: number;
  unsupported: number;
  likelyScans: number;
  totalMb: number;
  recommendationTier: 'credit' | 'trial' | 'kanzlei';
}) {
  const appOrigin =
    process.env.QUICK_CHECK_APP_ORIGIN?.trim() || DEFAULT_APP_ORIGIN;
  const handoffPayload = {
    source: 'marketing-quick-check',
    ts: new Date().toISOString(),
    ...params,
  };
  const payloadEncoded = toBase64Url(JSON.stringify(handoffPayload));

  const signingSecret = process.env.QUICK_CHECK_HANDOFF_SECRET?.trim();
  const signature = signingSecret
    ? createHmac('sha256', signingSecret)
        .update(payloadEncoded)
        .digest('base64url')
    : null;

  const url = new URL('/', appOrigin);
  url.searchParams.set('quickCheck', payloadEncoded);
  url.searchParams.set('source', 'marketing');
  if (signature) {
    url.searchParams.set('sig', signature);
  }

  return url.toString();
}

async function tryUpstreamQuickCheck(input: {
  usage: Usage;
  urgency: Urgency;
  depth: Depth;
  locale: string;
  files: File[];
  requestId: string;
}): Promise<{
  data: null | {
    score: number;
    supported: number;
    unsupported: number;
    likelyScans: number;
    totalMb: number;
    findings: string[];
  };
  attempts: number;
  durationMs: number;
  error: string | null;
}> {
  const startedAt = Date.now();
  const upstreamUrl = process.env.QUICK_CHECK_UPSTREAM_URL?.trim();
  if (!upstreamUrl) {
    return {
      data: null,
      attempts: 0,
      durationMs: Date.now() - startedAt,
      error: null,
    };
  }

  const headers: HeadersInit = {};
  const apiKey = process.env.QUICK_CHECK_UPSTREAM_API_KEY?.trim();
  if (apiKey) {
    headers['authorization'] = `Bearer ${apiKey}`;
  }

  const timeoutMs = parseEnvNumber(
    process.env.QUICK_CHECK_UPSTREAM_TIMEOUT_MS,
    DEFAULT_UPSTREAM_TIMEOUT_MS
  );
  const retries = parseEnvNumber(
    process.env.QUICK_CHECK_UPSTREAM_RETRIES,
    DEFAULT_UPSTREAM_RETRIES
  );
  const retryDelayMs = parseEnvNumber(
    process.env.QUICK_CHECK_UPSTREAM_RETRY_DELAY_MS,
    DEFAULT_RETRY_DELAY_MS
  );

  let attempts = 0;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    attempts = attempt;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'x-request-id': input.requestId,
          'x-quick-check-attempt': String(attempt),
        },
        body: createUpstreamPayload(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        if (attempt <= retries && isRetryableStatus(response.status)) {
          await sleep(retryDelayMs * attempt);
          continue;
        }
        return {
          data: null,
          attempts,
          durationMs: Date.now() - startedAt,
          error: lastError,
        };
      }

      const data = (await response.json().catch(() => null)) as null | {
        score?: number;
        supported?: number;
        unsupported?: number;
        likelyScans?: number;
        totalMb?: number;
        findings?: string[];
      };

      if (!data || typeof data.score !== 'number') {
        lastError = 'Invalid upstream payload';
        if (attempt <= retries) {
          await sleep(retryDelayMs * attempt);
          continue;
        }
        return {
          data: null,
          attempts,
          durationMs: Date.now() - startedAt,
          error: lastError,
        };
      }

      return {
        data: {
          score: data.score,
          supported: typeof data.supported === 'number' ? data.supported : 0,
          unsupported:
            typeof data.unsupported === 'number' ? data.unsupported : 0,
          likelyScans:
            typeof data.likelyScans === 'number' ? data.likelyScans : 0,
          totalMb: typeof data.totalMb === 'number' ? data.totalMb : 0,
          findings:
            Array.isArray(data.findings) &&
            data.findings.every(item => typeof item === 'string')
              ? data.findings
              : [
                  input.locale.toLowerCase().startsWith('de')
                    ? 'Upstream-Analyse abgeschlossen.'
                    : 'Upstream analysis completed.',
                ],
        },
        attempts,
        durationMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.name === 'AbortError'
            ? `Timeout after ${timeoutMs}ms`
            : error.message
          : 'Unknown upstream error';

      if (attempt <= retries) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return {
    data: null,
    attempts,
    durationMs: Date.now() - startedAt,
    error: lastError,
  };
}

function isLikelyScan(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return true;
  if (lowerName.endsWith('.pdf') && file.size > 8 * 1024 * 1024) return true;
  return false;
}

function recommendationFor(
  usage: Usage,
  depth: Depth
): { tier: 'credit' | 'trial' | 'kanzlei'; ctaHref: string } {
  if (usage === 'team' || depth === 'full') {
    return {
      tier: 'kanzlei',
      ctaHref: '/pricing',
    };
  }

  if (usage === 'single' && depth === 'quick') {
    return {
      tier: 'credit',
      ctaHref: '/pricing#addons',
    };
  }

  return {
    tier: 'trial',
    ctaHref: '/pricing',
  };
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const requestId =
    request.headers.get('x-request-id')?.trim() ||
    request.headers.get('x-correlation-id')?.trim() ||
    randomUUID();

  try {
    const formData = await request.formData();
    const usage = (formData.get('usage') as Usage | null) ?? 'single';
    const urgency = (formData.get('urgency') as Urgency | null) ?? 'today';
    const depth = (formData.get('depth') as Depth | null) ?? 'quick';
    const locale = (formData.get('locale') as string | null) ?? 'en';
    const isGerman = locale.toLowerCase().startsWith('de');

    const files = formData
      .getAll('files')
      .filter(
        (entry): entry is File =>
          typeof File !== 'undefined' && entry instanceof File
      )
      .slice(0, MAX_FILES);

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          message: isGerman
            ? 'Das Gesamtvolumen ist zu hoch. Bitte reduzieren Sie die Upload-Menge.'
            : 'Total upload volume is too high. Please reduce the number or size of files.',
        },
        { status: 413 }
      );
    }

    const supported = files.filter(isSupportedFile);
    const unsupported = files.length - supported.length;
    const likelyScans = supported.filter(isLikelyScan).length;
    const totalMb = totalBytes / (1024 * 1024);

    let score = 100;
    score -= unsupported * 8;
    score -= Math.max(0, likelyScans - 2) * 4;
    score -= totalMb > 300 ? 20 : totalMb > 150 ? 10 : 0;
    if (urgency === 'today' && likelyScans > 3) score -= 8;
    if (depth === 'full' && supported.length < 3) score -= 6;
    score = Math.max(15, Math.min(99, Math.round(score)));

    const recommendation = recommendationFor(usage, depth);
    const localFindings = [
      unsupported > 0
        ? isGerman
          ? `${unsupported} Datei(en) sind nicht für die Analyse geeignet und wurden ausgeschlossen.`
          : `${unsupported} file(s) are not suitable for analysis and were excluded.`
        : isGerman
          ? 'Alle Dateien sind im unterstützten Analyseformat.'
          : 'All uploaded files are in supported analysis formats.',
      likelyScans > 0
        ? isGerman
          ? `${likelyScans} Datei(en) werden als OCR-intensiv eingestuft; Tiefenanalyse benötigt zusätzliche Verarbeitung.`
          : `${likelyScans} file(s) are OCR-heavy; deep analysis will require extra processing.`
        : isGerman
          ? 'Die Dokumentqualität ist für eine schnelle semantische Vorprüfung geeignet.'
          : 'Document quality is suitable for a fast semantic pre-check.',
      isGerman
        ? 'Empfohlen: Start mit Quick-Check und anschließend abgestufter Upgrade-Pfad.'
        : 'Recommended: start with quick check followed by staged upgrade path.',
    ];

    const upstream = await tryUpstreamQuickCheck({
      usage,
      urgency,
      depth,
      locale,
      files,
      requestId,
    });

    const finalScore = upstream.data?.score ?? score;
    const finalSupported = upstream.data?.supported ?? supported.length;
    const finalUnsupported = upstream.data?.unsupported ?? unsupported;
    const finalLikelyScans = upstream.data?.likelyScans ?? likelyScans;
    const finalTotalMb = upstream.data?.totalMb ?? Number(totalMb.toFixed(1));
    const findings = upstream.data?.findings ?? localFindings;
    const pipelineMode = upstream.data
      ? 'upstream'
      : upstream.error
        ? 'fallback_local'
        : 'local';

    const continueUrl = buildAppContinueUrl({
      usage,
      urgency,
      depth,
      locale,
      score: finalScore,
      supported: finalSupported,
      unsupported: finalUnsupported,
      likelyScans: finalLikelyScans,
      totalMb: finalTotalMb,
      recommendationTier: recommendation.tier,
    });

    const totalDurationMs = Date.now() - requestStartedAt;
    if (pipelineMode === 'upstream') {
      console.info(
        `[quick-check] request_id=${requestId} mode=upstream attempts=${upstream.attempts} duration_ms=${totalDurationMs} files=${files.length}`
      );
    } else if (pipelineMode === 'fallback_local') {
      console.warn(
        `[quick-check] request_id=${requestId} mode=fallback_local attempts=${upstream.attempts} upstream_error="${upstream.error}" duration_ms=${totalDurationMs}`
      );
    } else {
      console.info(
        `[quick-check] request_id=${requestId} mode=local duration_ms=${totalDurationMs} files=${files.length}`
      );
    }

    return NextResponse.json({
      ok: true,
      score: finalScore,
      supported: finalSupported,
      unsupported: finalUnsupported,
      likelyScans: finalLikelyScans,
      totalMb: finalTotalMb,
      findings,
      recommendation,
      continueUrl,
      pipelineMode,
      observability: {
        requestId,
        totalDurationMs,
        upstream: {
          attempts: upstream.attempts,
          durationMs: upstream.durationMs,
          error: upstream.error,
        },
      },
    });
  } catch (error) {
    const totalDurationMs = Date.now() - requestStartedAt;
    console.error(
      `[quick-check] request_id=${requestId} mode=error duration_ms=${totalDurationMs}`,
      error
    );
    return NextResponse.json(
      {
        ok: false,
        requestId,
        message:
          error instanceof Error
            ? error.message
            : 'Unexpected quick-check pipeline error.',
      },
      { status: 500 }
    );
  }
}
