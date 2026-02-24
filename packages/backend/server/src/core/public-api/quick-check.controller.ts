import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createHmac } from 'node:crypto';

import { Throttle } from '../../base';
import { Public } from '../auth';

// ─── Types ──────────────────────────────────────────────────────────────────

type Usage = 'single' | 'recurring' | 'team';
type Urgency = 'today' | 'week' | 'flexible';
type Depth = 'quick' | 'strategy' | 'full';

interface QuickCheckAnalyzeBody {
  usage?: Usage;
  urgency?: Urgency;
  depth?: Depth;
  locale?: string;
  fileNames?: string[];
  fileSizes?: number[];
  fileMimeTypes?: string[];
}

interface HandoffPayload {
  source: string;
  ts: string;
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
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'txt', 'eml', 'msg', 'rtf',
  'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp',
]);

const IMAGE_MIME_PREFIXES = ['image/'];

function isSupportedExt(name: string): boolean {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return SUPPORTED_EXTENSIONS.has(ext);
}

function isSupportedMime(mime: string): boolean {
  return IMAGE_MIME_PREFIXES.some(p => mime.startsWith(p));
}

function isLikelyScan(name: string, mime: string, sizeBytes: number): boolean {
  if (mime.startsWith('image/')) return true;
  if (name.toLowerCase().endsWith('.pdf') && sizeBytes > 8 * 1024 * 1024) return true;
  return false;
}

function recommendationFor(
  usage: Usage,
  depth: Depth
): { tier: 'credit' | 'trial' | 'kanzlei'; ctaHref: string } {
  if (usage === 'team' || depth === 'full') {
    return { tier: 'kanzlei', ctaHref: '/pricing' };
  }
  if (usage === 'single' && depth === 'quick') {
    return { tier: 'credit', ctaHref: '/pricing#addons' };
  }
  return { tier: 'trial', ctaHref: '/pricing' };
}

const MAX_FILES = 80;
const MAX_HANDOFF_AGE_MS = 10 * 60 * 1000; // 10 minutes

// ─── Controller ─────────────────────────────────────────────────────────────

@ApiTags('quick-check')
@Controller('/api/public/v1/quick-check')
export class QuickCheckController {
  private readonly logger = new Logger(QuickCheckController.name);

  // ── Analyze (called by marketing upstream or directly) ──────────────────

  @Public()
  @Post('/analyze')
  @HttpCode(200)
  @Throttle('strict')
  @ApiOperation({
    summary: 'Analyze uploaded file metadata for quick-check scoring',
    description:
      'Accepts file metadata (names, sizes, mimetypes) plus qualification answers. ' +
      'Returns a readiness score, findings, and a recommendation tier. ' +
      'No actual file content is transferred — only metadata.',
  })
  @ApiResponse({ status: 200, description: 'Quick-check analysis result' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  analyze(@Body() body: QuickCheckAnalyzeBody) {
    const usage: Usage = body.usage ?? 'single';
    const urgency: Urgency = body.urgency ?? 'today';
    const depth: Depth = body.depth ?? 'quick';
    const locale = body.locale ?? 'en';
    const isGerman = locale.toLowerCase().startsWith('de');

    const names = (body.fileNames ?? []).slice(0, MAX_FILES);
    const sizes = (body.fileSizes ?? []).slice(0, MAX_FILES);
    const mimes = (body.fileMimeTypes ?? []).slice(0, MAX_FILES);
    const count = Math.min(names.length, sizes.length, mimes.length);

    if (count === 0) {
      throw new BadRequestException(
        isGerman
          ? 'Keine Datei-Metadaten übermittelt.'
          : 'No file metadata provided.'
      );
    }

    let supportedCount = 0;
    let unsupportedCount = 0;
    let likelyScanCount = 0;
    let totalBytes = 0;

    for (let i = 0; i < count; i++) {
      const name = names[i];
      const size = sizes[i];
      const mime = mimes[i];
      totalBytes += size;

      if (isSupportedExt(name) || isSupportedMime(mime)) {
        supportedCount++;
        if (isLikelyScan(name, mime, size)) {
          likelyScanCount++;
        }
      } else {
        unsupportedCount++;
      }
    }

    const totalMb = totalBytes / (1024 * 1024);

    let score = 100;
    score -= unsupportedCount * 8;
    score -= Math.max(0, likelyScanCount - 2) * 4;
    score -= totalMb > 300 ? 20 : totalMb > 150 ? 10 : 0;
    if (urgency === 'today' && likelyScanCount > 3) score -= 8;
    if (depth === 'full' && supportedCount < 3) score -= 6;
    score = Math.max(15, Math.min(99, Math.round(score)));

    const recommendation = recommendationFor(usage, depth);

    const findings: string[] = [
      unsupportedCount > 0
        ? isGerman
          ? `${unsupportedCount} Datei(en) nicht für die Analyse geeignet.`
          : `${unsupportedCount} file(s) not suitable for analysis.`
        : isGerman
          ? 'Alle Dateien im unterstützten Format.'
          : 'All files in supported formats.',
      likelyScanCount > 0
        ? isGerman
          ? `${likelyScanCount} OCR-intensive Datei(en) erkannt.`
          : `${likelyScanCount} OCR-heavy file(s) detected.`
        : isGerman
          ? 'Dokumentqualität geeignet für semantische Vorprüfung.'
          : 'Document quality suitable for semantic pre-check.',
      isGerman
        ? 'Quick-Check abgeschlossen. Nächster Schritt: Konto erstellen oder Credits erwerben.'
        : 'Quick check completed. Next step: create account or purchase credits.',
    ];

    return {
      ok: true,
      score,
      supported: supportedCount,
      unsupported: unsupportedCount,
      likelyScans: likelyScanCount,
      totalMb: Number(totalMb.toFixed(1)),
      findings,
      recommendation,
    };
  }

  // ── Handoff validation (called by app frontend on load) ─────────────────

  @Public()
  @Get('/validate-handoff')
  @Throttle('strict')
  @ApiOperation({
    summary: 'Validate a signed quick-check handoff token',
    description:
      'Decodes and validates the quickCheck query parameter from the marketing handoff URL. ' +
      'Checks HMAC signature, expiry, and returns the decoded payload for the app to use.',
  })
  @ApiQuery({ name: 'token', required: true, description: 'Base64url-encoded handoff payload' })
  @ApiQuery({ name: 'sig', required: false, description: 'HMAC-SHA256 signature' })
  @ApiResponse({ status: 200, description: 'Valid handoff payload' })
  @ApiResponse({ status: 400, description: 'Invalid or expired handoff' })
  validateHandoff(
    @Query('token') token?: string,
    @Query('sig') sig?: string
  ) {
    if (!token) {
      throw new BadRequestException('Missing handoff token');
    }

    // Decode payload
    let payload: HandoffPayload;
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      payload = JSON.parse(decoded) as HandoffPayload;
    } catch {
      throw new BadRequestException('Malformed handoff token');
    }

    // Validate required fields
    if (
      payload.source !== 'marketing-quick-check' ||
      typeof payload.score !== 'number' ||
      typeof payload.recommendationTier !== 'string'
    ) {
      throw new BadRequestException('Invalid handoff payload structure');
    }

    // Check signature if secret is configured
    const signingSecret = process.env.QUICK_CHECK_HANDOFF_SECRET?.trim();
    if (signingSecret) {
      if (!sig) {
        throw new BadRequestException('Missing handoff signature');
      }

      const expectedSig = createHmac('sha256', signingSecret)
        .update(token)
        .digest('base64url');

      if (sig !== expectedSig) {
        this.logger.warn(
          `[quick-check] Invalid handoff signature for token ts=${payload.ts}`
        );
        throw new BadRequestException('Invalid handoff signature');
      }
    }

    // Check expiry
    const tokenAge = Date.now() - new Date(payload.ts).getTime();
    if (tokenAge > MAX_HANDOFF_AGE_MS || tokenAge < -60_000) {
      throw new BadRequestException('Handoff token expired');
    }

    return {
      valid: true,
      payload: {
        usage: payload.usage,
        urgency: payload.urgency,
        depth: payload.depth,
        locale: payload.locale,
        score: payload.score,
        supported: payload.supported,
        unsupported: payload.unsupported,
        likelyScans: payload.likelyScans,
        totalMb: payload.totalMb,
        recommendationTier: payload.recommendationTier,
      },
    };
  }
}
