import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  Server,
  Shield,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';

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
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getConfiguredAppOrigin } from '@/utils/app-auth';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildDownloadCenterPageJsonLd,
  buildFaqPageJsonLd,
} from '@/utils/seo-schema';

const STABLE_RELEASE_URL =
  'https://github.com/subsumio/subsumio/releases/latest';
const DOWNLOAD_CENTER_URL = STABLE_RELEASE_URL;
const ALL_RELEASES_URL = 'https://github.com/subsumio/subsumio/releases';
const SOURCE_ARCHIVE_URL =
  'https://github.com/subsumio/subsumio/archive/refs/heads/main.zip';
const WEB_APP_URL = getConfiguredAppOrigin();
const GITHUB_LATEST_RELEASE_API =
  'https://api.github.com/repos/subsumio/subsumio/releases/latest';
const IOS_STORE_URL_RAW =
  process.env.NEXT_PUBLIC_SUBSUMIO_IOS_STORE_URL?.trim() || '';
const ANDROID_STORE_URL_RAW =
  process.env.NEXT_PUBLIC_SUBSUMIO_ANDROID_STORE_URL?.trim() || '';
const HAS_IOS_STORE_URL = IOS_STORE_URL_RAW.length > 0;
const HAS_ANDROID_STORE_URL = ANDROID_STORE_URL_RAW.length > 0;
const IOS_STORE_URL = HAS_IOS_STORE_URL ? IOS_STORE_URL_RAW : '/contact';
const ANDROID_STORE_URL = HAS_ANDROID_STORE_URL
  ? ANDROID_STORE_URL_RAW
  : '/contact';

type DownloadCard = {
  kind:
    | 'web'
    | 'mac'
    | 'windows'
    | 'linux'
    | 'ios'
    | 'ipados'
    | 'android'
    | 'server';
  title: string;
  body: string;
  platform: string;
  availability: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  tags: string[];
};

type LocalizedCopy = {
  pageTitle: string;
  pageSubtitle: string;
  heroKicker: string;
  releaseBadge: string;
  heroHighlights: string[];
  navFlowLabel: string;
  navJourney: string;
  navApps: string;
  navDirect: string;
  navVersions: string;
  navChannels: string;
  navRequirements: string;
  stepLabel: string;
  journeyEyebrow: string;
  journeyTitle: string;
  journeySubtitle: string;
  journeySteps: string[];
  sectionPlatformTitle: string;
  sectionPlatformSubtitle: string;
  cards: DownloadCard[];
  directTitle: string;
  directSubtitle: string;
  directFallbackNote: string;
  directRecommendedLabel: string;
  directIntegrityLabel: string;
  versionTitle: string;
  versionSubtitle: string;
  versionItems: Array<{
    channel: string;
    cadence: string;
    recommendation: string;
    ctaLabel: string;
    href: string;
  }>;
  channelsTitle: string;
  channelsSubtitle: string;
  stableTitle: string;
  stableBody: string;
  stableCta: string;
  canaryTitle: string;
  canaryBody: string;
  canaryCta: string;
  rolloutTitle: string;
  rolloutSubtitle: string;
  rolloutItems: string[];
  requirementsTitle: string;
  requirementsItems: string[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  faqTitle: string;
  faqItems: Array<{ question: string; answer: string }>;
};

type DirectDownloadAsset = {
  id: string;
  label: string;
  platform: string;
  href: string;
  sizeInBytes: number;
};

type DirectDownloadsResult = {
  assets: DirectDownloadAsset[];
  releaseUrl: string;
};

type RuntimePlatformHint = {
  os: 'windows' | 'macos' | 'linux' | 'other';
  arch: 'arm64' | 'x64' | 'other';
};

const DIRECT_DOWNLOAD_MATCHERS = [
  {
    id: 'windows-x64-nsis',
    label: 'Windows x64 (.nsis.exe)',
    platform: 'Windows',
    pattern: /windows-x64\.nsis\.exe$/i,
  },
  {
    id: 'windows-arm64-nsis',
    label: 'Windows ARM64 (.nsis.exe)',
    platform: 'Windows',
    pattern: /windows-arm64\.nsis\.exe$/i,
  },
  {
    id: 'macos-arm64-dmg',
    label: 'macOS Apple Silicon (.dmg)',
    platform: 'macOS',
    pattern: /macos-arm64\.dmg$/i,
  },
  {
    id: 'macos-x64-dmg',
    label: 'macOS Intel (.dmg)',
    platform: 'macOS',
    pattern: /macos-x64\.dmg$/i,
  },
  {
    id: 'linux-x64-appimage',
    label: 'Linux x64 (.appimage)',
    platform: 'Linux',
    pattern: /linux-x64\.appimage$/i,
  },
  {
    id: 'linux-x64-deb',
    label: 'Linux x64 (.deb)',
    platform: 'Linux',
    pattern: /linux-x64\.deb$/i,
  },
  {
    id: 'linux-x64-flatpak',
    label: 'Linux x64 (.flatpak)',
    platform: 'Linux',
    pattern: /linux-x64\.flatpak$/i,
  },
] as const;

function formatBytes(sizeInBytes: number): string {
  if (sizeInBytes <= 0) {
    return 'n/a';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(sizeInBytes) / Math.log(1024)),
    units.length - 1
  );
  const value = sizeInBytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function detectRuntimePlatform(userAgent: string): RuntimePlatformHint {
  const ua = userAgent.toLowerCase();
  const arch =
    ua.includes('arm64') || ua.includes('aarch64')
      ? 'arm64'
      : ua.includes('x86_64') ||
          ua.includes('win64') ||
          ua.includes('amd64') ||
          ua.includes('x64')
        ? 'x64'
        : 'other';

  if (ua.includes('windows')) {
    return { os: 'windows', arch };
  }
  if (ua.includes('mac os') || ua.includes('macintosh')) {
    return { os: 'macos', arch };
  }
  if (ua.includes('linux')) {
    return { os: 'linux', arch };
  }
  return { os: 'other', arch };
}

function isRecommendedAsset(
  assetId: string,
  hint: RuntimePlatformHint
): boolean {
  if (hint.os === 'other') {
    return false;
  }
  const matchesOs = assetId.startsWith(hint.os);
  const matchesArch = hint.arch === 'other' || assetId.includes(hint.arch);
  return matchesOs && matchesArch;
}

async function resolveDirectDownloadAssets(): Promise<DirectDownloadsResult> {
  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_API, {
      next: { revalidate: 3600 },
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      return {
        assets: [],
        releaseUrl: STABLE_RELEASE_URL,
      };
    }

    const payload = (await response.json()) as {
      html_url?: string;
      assets?: Array<{
        name?: string;
        browser_download_url?: string;
        size?: number;
      }>;
    };

    const assets = payload.assets ?? [];
    const resolvedAssets = DIRECT_DOWNLOAD_MATCHERS.flatMap(matcher => {
      const match = assets.find(asset => {
        if (!asset.name || !asset.browser_download_url) {
          return false;
        }
        return matcher.pattern.test(asset.name);
      });

      if (!match?.browser_download_url) {
        return [];
      }

      return [
        {
          id: matcher.id,
          label: matcher.label,
          platform: matcher.platform,
          href: match.browser_download_url,
          sizeInBytes: match.size ?? 0,
        },
      ];
    });

    return {
      assets: resolvedAssets,
      releaseUrl: payload.html_url || STABLE_RELEASE_URL,
    };
  } catch {
    return {
      assets: [],
      releaseUrl: STABLE_RELEASE_URL,
    };
  }
}

type ActionLinkProps = {
  href: string;
  label: string;
  contextLabel: string;
  variant: 'primary' | 'secondary';
  leadingDownloadIcon?: boolean;
};

function ActionLink({
  href,
  label,
  contextLabel,
  variant,
  leadingDownloadIcon = false,
}: ActionLinkProps) {
  const isInternal = href.startsWith('/');
  const className =
    variant === 'primary'
      ? 'btn-primary inline-flex items-center gap-2'
      : 'btn-secondary inline-flex items-center gap-2';

  const content = (
    <>
      {leadingDownloadIcon ? (
        <Download className="w-4 h-4" aria-hidden="true" />
      ) : null}
      {label}
      {isInternal ? (
        !leadingDownloadIcon ? (
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        ) : null
      ) : (
        <ExternalLink className="w-4 h-4" aria-hidden="true" />
      )}
    </>
  );

  if (isInternal) {
    return (
      <Link
        href={href}
        className={className}
        aria-label={`${label} – ${contextLabel}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
      aria-label={`${label} – ${contextLabel}`}
    >
      {content}
    </a>
  );
}

function resolveCopy(locale: string): LocalizedCopy {
  const english: LocalizedCopy = {
    pageTitle: 'Download Subsumio Apps',
    pageSubtitle:
      'All production-ready apps in one launchpad. Download links are connected and ready for immediate rollout.',
    heroKicker: 'Production release hub',
    releaseBadge: 'Latest stable builds available now',
    heroHighlights: [
      'All major platforms covered',
      'Stable channel live',
      'Enterprise rollout support',
    ],
    navFlowLabel: 'Quick navigation',
    navJourney: 'Journey',
    navApps: 'Apps',
    navDirect: 'Direct',
    navVersions: 'Versions',
    navChannels: 'Channels',
    navRequirements: 'Requirements',
    stepLabel: 'Step',
    journeyEyebrow: 'Download Journey',
    journeyTitle: 'From download to rollout in 3 clear steps',
    journeySubtitle:
      'A clear path for legal teams: choose your setup, validate once, then scale confidently across all devices.',
    journeySteps: [
      'Choose your channel and platform (web, desktop, iOS/iPadOS, Android, Linux).',
      'Install on one pilot seat and validate login, sync, and document opening.',
      'Roll out team-wide with stable channel and keep web as instant fallback.',
    ],
    sectionPlatformTitle: 'All apps ready for download',
    sectionPlatformSubtitle:
      'Choose your target system and deploy instantly. Subsumio is available as Web SaaS, macOS, Windows, Linux, iPhone, iPad, Android, and self-managed stack.',
    cards: [
      {
        kind: 'web',
        title: 'Web SaaS',
        body: 'Use Subsumio instantly in the browser with zero install, SSO-ready access, and immediate team onboarding.',
        platform: 'Web',
        availability: 'Production',
        primaryLabel: 'Open Web SaaS',
        primaryHref: WEB_APP_URL,
        secondaryLabel: 'Status & Requirements',
        secondaryHref: '#requirements',
        tags: ['Chrome', 'Safari', 'Edge', 'Firefox'],
      },
      {
        kind: 'mac',
        title: 'macOS App',
        body: 'Native desktop build for law firms on Mac. Includes offline-friendly workflows and secure sync.',
        platform: 'macOS',
        availability: 'Stable + Canary',
        primaryLabel: 'Download for macOS',
        primaryHref: STABLE_RELEASE_URL,
        secondaryLabel: 'All Release Assets',
        secondaryHref: ALL_RELEASES_URL,
        tags: ['DMG', 'Apple Silicon', 'Intel'],
      },
      {
        kind: 'windows',
        title: 'Windows App',
        body: 'Enterprise rollout ready installers for modern Windows environments and managed devices.',
        platform: 'Windows',
        availability: 'Stable + Canary',
        primaryLabel: 'Download for Windows',
        primaryHref: STABLE_RELEASE_URL,
        secondaryLabel: 'All Release Assets',
        secondaryHref: ALL_RELEASES_URL,
        tags: ['EXE', 'MSI/NSIS', 'Enterprise rollout'],
      },
      {
        kind: 'linux',
        title: 'Linux Build',
        body: 'AppImage and archive builds for technical teams that run Linux workstations or managed legal desktops.',
        platform: 'Linux',
        availability: 'Stable + Canary',
        primaryLabel: 'Download Linux Assets',
        primaryHref: STABLE_RELEASE_URL,
        secondaryLabel: 'All Artifacts',
        secondaryHref: ALL_RELEASES_URL,
        tags: ['AppImage', 'Zip', 'Self-managed devices'],
      },
      {
        kind: 'ios',
        title: 'iOS Mobile',
        body: 'Access Subsumio on iPhone for case review, secure messaging, and on-the-go updates.',
        platform: 'iOS',
        availability: HAS_IOS_STORE_URL
          ? 'App Store live'
          : 'Store rollout in progress',
        primaryLabel: HAS_IOS_STORE_URL
          ? 'Open iOS Distribution'
          : 'Request iOS Rollout',
        primaryHref: IOS_STORE_URL,
        secondaryLabel: 'Mobile Rollout Support',
        secondaryHref: '/contact',
        tags: ['iPhone', 'Mobile access', 'Secure messaging'],
      },
      {
        kind: 'ipados',
        title: 'iPadOS Mobile',
        body: 'Use Subsumio on iPad for document-heavy review workflows, annotations, and secure collaboration.',
        platform: 'iPadOS',
        availability: HAS_IOS_STORE_URL
          ? 'App Store live'
          : 'Store rollout in progress',
        primaryLabel: HAS_IOS_STORE_URL
          ? 'Open iPadOS Distribution'
          : 'Request iPadOS Rollout',
        primaryHref: IOS_STORE_URL,
        secondaryLabel: 'Mobile Rollout Support',
        secondaryHref: '/contact',
        tags: ['iPad', 'Review workflows', 'Annotations'],
      },
      {
        kind: 'android',
        title: 'Android Mobile',
        body: 'Deploy Subsumio for Android teams with centralized access to release channel guidance and rollout support.',
        platform: 'Android',
        availability: HAS_ANDROID_STORE_URL
          ? 'Google Play live'
          : 'Store rollout in progress',
        primaryLabel: HAS_ANDROID_STORE_URL
          ? 'Open Android Distribution'
          : 'Request Android Rollout',
        primaryHref: ANDROID_STORE_URL,
        secondaryLabel: 'Mobile Rollout Support',
        secondaryHref: '/contact',
        tags: ['Android', 'Team rollout', 'Secure mobile'],
      },
      {
        kind: 'server',
        title: 'Self-Hosted / API Stack',
        body: 'For advanced IT teams: use release assets and source package for controlled environments and deeper integration.',
        platform: 'Server / API',
        availability: 'Technical deployment',
        primaryLabel: 'Open Source Package',
        primaryHref: SOURCE_ARCHIVE_URL,
        secondaryLabel: 'Deployment Releases',
        secondaryHref: ALL_RELEASES_URL,
        tags: ['Self-hosted', 'API-ready', 'Docker/K8s'],
      },
    ],
    directTitle: 'Direct installer links (latest stable)',
    directSubtitle:
      'For IT teams and power users: use direct installer assets by platform and architecture from the latest stable release.',
    directFallbackNote:
      'If a direct asset is temporarily unavailable, use the stable release page to access the full artifact list.',
    directRecommendedLabel: 'Recommended for this device',
    directIntegrityLabel:
      'Verify checksums and signatures in the release details',
    versionTitle: 'Version channels for every rollout stage',
    versionSubtitle:
      'Pick the release stream that matches your risk profile and deployment speed.',
    versionItems: [
      {
        channel: 'Stable',
        cadence: 'Production baseline',
        recommendation:
          'Recommended for all law firms and daily productive usage.',
        ctaLabel: 'Open stable',
        href: STABLE_RELEASE_URL,
      },
      {
        channel: 'Canary',
        cadence: 'Early access',
        recommendation:
          'For pilot users validating new features before team-wide rollout.',
        ctaLabel: 'Open canary list',
        href: ALL_RELEASES_URL,
      },
      {
        channel: 'Source',
        cadence: 'Build & integration',
        recommendation:
          'For self-managed environments and custom CI/CD deployment pipelines.',
        ctaLabel: 'Download source',
        href: SOURCE_ARCHIVE_URL,
      },
    ],
    channelsTitle: 'Release channels',
    channelsSubtitle:
      'Pick stable for production or canary for early access testing.',
    stableTitle: 'Stable channel',
    stableBody: 'Recommended for all production users and firm-wide rollout.',
    stableCta: 'Open stable',
    canaryTitle: 'Canary channel',
    canaryBody:
      'For pilot users validating new features before team-wide rollout.',
    canaryCta: 'Open canary list',
    rolloutTitle: 'Rollout checklist',
    rolloutSubtitle:
      'Use this flow to deploy quickly without support bottlenecks.',
    rolloutItems: [
      'Choose your channel (stable or canary) and install one pilot seat first.',
      'Validate login, workspace sync, and document opening in your environment.',
      'Roll out desktop or mobile apps team-wide and keep web app as fallback.',
      'Document internal install policy and support contact for smooth onboarding.',
    ],
    requirementsTitle: 'Technical baseline',
    requirementsItems: [
      'Current OS version and latest browser security updates',
      'Stable internet access for sync, uploads, and AI processing',
      'TLS-secured office and remote networks',
      'Role-based access model for team permissions and least-privilege access',
    ],
    ctaTitle: 'Need enterprise rollout support?',
    ctaSubtitle:
      'We can help you plan multi-device rollout, security hardening, and user onboarding for legal teams.',
    ctaPrimary: 'Request rollout support',
    ctaSecondary: 'Contact support',
    faqTitle: 'Download center FAQ',
    faqItems: [
      {
        question: 'Can we use Subsumio without installing anything?',
        answer:
          'Yes. The Web SaaS version is production-ready and can be used instantly in modern browsers.',
      },
      {
        question: 'Which desktop systems are supported?',
        answer:
          'Subsumio provides dedicated desktop release artifacts for macOS, Windows, and Linux.',
      },
      {
        question: 'Can we test before full rollout?',
        answer:
          'Yes. Use the canary channel for pilot users and keep stable for productive teams.',
      },
      {
        question: 'Do you support enterprise and self-managed deployments?',
        answer:
          'Yes. Release and source packages support advanced IT environments and controlled deployment workflows.',
      },
    ],
  };

  const language = locale.split('-')[0];
  const isGerman = locale.startsWith('de');

  if (isGerman) {
    return {
      pageTitle: 'Subsumio Apps herunterladen',
      pageSubtitle:
        'Alle produktionsreifen Apps in einem Launchpad. Download-Links sind verbunden und sofort einsatzbereit.',
      heroKicker: 'Produktions-Release-Hub',
      releaseBadge: 'Neueste stabile Builds sind live',
      heroHighlights: [
        'Alle Hauptplattformen abgedeckt',
        'Stable-Kanal live',
        'Enterprise Rollout-Support',
      ],
      navFlowLabel: 'Schnellnavigation',
      navJourney: 'Ablauf',
      navApps: 'Apps',
      navDirect: 'Direkt',
      navVersions: 'Versionen',
      navChannels: 'Kanäle',
      navRequirements: 'Voraussetzungen',
      stepLabel: 'Schritt',
      journeyEyebrow: 'Download-Ablauf',
      journeyTitle: 'Von Download bis Rollout in 3 klaren Schritten',
      journeySubtitle:
        'Ein klarer Ablauf für Kanzleien: Setup wählen, einmal validieren, dann sicher auf alle Geräte ausrollen.',
      journeySteps: [
        'Kanal und Plattform wählen (Web, Desktop, iOS/iPadOS, Android, Linux).',
        'Auf einem Pilot-Arbeitsplatz installieren und Login, Sync sowie Dokument-Öffnung prüfen.',
        'Teamweit mit Stable ausrollen und die Web App als Fallback behalten.',
      ],
      sectionPlatformTitle: 'Alle Apps sind downloadbereit',
      sectionPlatformSubtitle:
        'Wählen Sie Ihr Zielsystem und starten Sie sofort. Subsumio läuft als Web SaaS, macOS, Windows, Linux, iPhone, iPad, Android und Self-Managed Stack.',
      cards: [
        {
          kind: 'web',
          title: 'Web SaaS',
          body: 'Sofort im Browser nutzbar, ohne Installation, SSO-fähig und direkt für Kanzlei-Teams einsetzbar.',
          platform: 'Web',
          availability: 'Produktion',
          primaryLabel: 'Web SaaS öffnen',
          primaryHref: WEB_APP_URL,
          secondaryLabel: 'Status & Voraussetzungen',
          secondaryHref: '#requirements',
          tags: ['Chrome', 'Safari', 'Edge', 'Firefox'],
        },
        {
          kind: 'mac',
          title: 'macOS App',
          body: 'Native Desktop-Build für Kanzleien auf Mac inkl. offline-freundlicher Workflows und sicherem Sync.',
          platform: 'macOS',
          availability: 'Stable + Canary',
          primaryLabel: 'Für macOS herunterladen',
          primaryHref: STABLE_RELEASE_URL,
          secondaryLabel: 'Alle Release-Artefakte',
          secondaryHref: ALL_RELEASES_URL,
          tags: ['DMG', 'Apple Silicon', 'Intel'],
        },
        {
          kind: 'windows',
          title: 'Windows App',
          body: 'Enterprise-taugliche Installer für moderne Windows-Umgebungen und verwaltete Geräte.',
          platform: 'Windows',
          availability: 'Stable + Canary',
          primaryLabel: 'Für Windows herunterladen',
          primaryHref: STABLE_RELEASE_URL,
          secondaryLabel: 'Alle Release-Artefakte',
          secondaryHref: ALL_RELEASES_URL,
          tags: ['EXE', 'MSI/NSIS', 'Enterprise rollout'],
        },
        {
          kind: 'linux',
          title: 'Linux Build',
          body: 'AppImage- und Archiv-Builds für technische Teams mit Linux-Workstations oder verwalteten Legal-Desktops.',
          platform: 'Linux',
          availability: 'Stable + Canary',
          primaryLabel: 'Linux-Artefakte herunterladen',
          primaryHref: STABLE_RELEASE_URL,
          secondaryLabel: 'Alle Artefakte',
          secondaryHref: ALL_RELEASES_URL,
          tags: ['AppImage', 'Zip', 'Self-managed devices'],
        },
        {
          kind: 'ios',
          title: 'iOS Mobile',
          body: 'Subsumio auf iPhone für Aktenreview, sichere Kommunikation und Updates unterwegs.',
          platform: 'iOS',
          availability: HAS_IOS_STORE_URL
            ? 'App Store live'
            : 'Store-Rollout in Vorbereitung',
          primaryLabel: HAS_IOS_STORE_URL
            ? 'iOS-Distribution öffnen'
            : 'iOS-Rollout anfragen',
          primaryHref: IOS_STORE_URL,
          secondaryLabel: 'Mobile-Rollout Support',
          secondaryHref: '/contact',
          tags: ['iPhone', 'Mobile access', 'Secure messaging'],
        },
        {
          kind: 'ipados',
          title: 'iPadOS Mobile',
          body: 'Subsumio auf iPad für dokumentintensive Prüf-Workflows, Annotationen und sichere Zusammenarbeit.',
          platform: 'iPadOS',
          availability: HAS_IOS_STORE_URL
            ? 'App Store live'
            : 'Store-Rollout in Vorbereitung',
          primaryLabel: HAS_IOS_STORE_URL
            ? 'iPadOS-Distribution öffnen'
            : 'iPadOS-Rollout anfragen',
          primaryHref: IOS_STORE_URL,
          secondaryLabel: 'Mobile-Rollout Support',
          secondaryHref: '/contact',
          tags: ['iPad', 'Review-Workflows', 'Annotationen'],
        },
        {
          kind: 'android',
          title: 'Android Mobile',
          body: 'Rollout für Android-Teams mit zentralem Zugriff auf Release-Channel-Hinweise und Deployment-Support.',
          platform: 'Android',
          availability: HAS_ANDROID_STORE_URL
            ? 'Google Play live'
            : 'Store-Rollout in Vorbereitung',
          primaryLabel: HAS_ANDROID_STORE_URL
            ? 'Android-Distribution öffnen'
            : 'Android-Rollout anfragen',
          primaryHref: ANDROID_STORE_URL,
          secondaryLabel: 'Mobile-Rollout Support',
          secondaryHref: '/contact',
          tags: ['Android', 'Team rollout', 'Secure mobile'],
        },
        {
          kind: 'server',
          title: 'Self-Hosted / API Stack',
          body: 'Für IT-Teams: Release-Artefakte plus Source-Paket für kontrollierte Umgebungen und tiefere Integrationen.',
          platform: 'Server / API',
          availability: 'Technische Bereitstellung',
          primaryLabel: 'Source-Paket öffnen',
          primaryHref: SOURCE_ARCHIVE_URL,
          secondaryLabel: 'Deployment Releases',
          secondaryHref: ALL_RELEASES_URL,
          tags: ['Self-hosted', 'API-ready', 'Docker/K8s'],
        },
      ],
      directTitle: 'Direkte Installer-Links (neueste Stable-Version)',
      directSubtitle:
        'Für IT-Teams und Power-User: Nutzen Sie direkte Installer-Artefakte nach Plattform und Architektur aus dem neuesten Stable-Release.',
      directFallbackNote:
        'Falls ein direkter Download temporär fehlt, nutzen Sie die Stable-Release-Seite mit vollständiger Artefaktliste.',
      directRecommendedLabel: 'Empfohlen für dieses Gerät',
      directIntegrityLabel:
        'Checksummen und Signaturen in den Release-Details prüfen',
      versionTitle: 'Versionskanäle für jede Rollout-Phase',
      versionSubtitle:
        'Wählen Sie den Release-Stream passend zu Risiko-Profil und Ausroll-Geschwindigkeit.',
      versionItems: [
        {
          channel: 'Stable',
          cadence: 'Produktions-Baseline',
          recommendation:
            'Empfohlen für alle Kanzleien und den täglichen produktiven Einsatz.',
          ctaLabel: 'Stable öffnen',
          href: STABLE_RELEASE_URL,
        },
        {
          channel: 'Canary',
          cadence: 'Früher Zugriff',
          recommendation:
            'Für Pilot-Nutzer, die neue Features vor dem Team-Rollout validieren.',
          ctaLabel: 'Canary-Liste öffnen',
          href: ALL_RELEASES_URL,
        },
        {
          channel: 'Source',
          cadence: 'Build & Integration',
          recommendation:
            'Für Self-Managed Umgebungen und individuelle CI/CD-Deployment-Pipelines.',
          ctaLabel: 'Source herunterladen',
          href: SOURCE_ARCHIVE_URL,
        },
      ],
      channelsTitle: 'Release-Kanäle',
      channelsSubtitle:
        'Stabil für Produktion, Canary für frühe Tests neuer Funktionen.',
      stableTitle: 'Stable-Kanal',
      stableBody:
        'Empfohlen für produktive Nutzung und den Rollout in der gesamten Kanzlei.',
      stableCta: 'Stabiles Release öffnen',
      canaryTitle: 'Canary-Kanal',
      canaryBody:
        'Für Pilot-Nutzer, die neue Features vor dem breiten Einsatz validieren.',
      canaryCta: 'Release-Liste öffnen',
      rolloutTitle: 'Rollout-Checkliste',
      rolloutSubtitle:
        'Mit diesem Ablauf deployen Sie schnell und ohne Support-Stau.',
      rolloutItems: [
        'Kanal wählen (Stable oder Canary) und zuerst einen Pilot-Arbeitsplatz installieren.',
        'Login, Workspace-Sync und Dokument-Öffnung in Ihrer Umgebung prüfen.',
        'Desktop- oder Mobile-Rollout teamweit ausrollen und Web App als Fallback behalten.',
        'Interne Installationsrichtlinie und Support-Kontakt klar dokumentieren.',
      ],
      requirementsTitle: 'Technische Basis',
      requirementsItems: [
        'Aktuelles Betriebssystem und aktuelle Browser-Sicherheitsupdates',
        'Stabile Internetverbindung für Sync, Uploads und KI-Verarbeitung',
        'TLS-geschützte Netzwerke in Kanzlei und Homeoffice',
        'Rollenbasiertes Rechtekonzept mit Least-Privilege-Zugriff',
      ],
      ctaTitle: 'Sie brauchen Enterprise-Rollout-Support?',
      ctaSubtitle:
        'Wir unterstützen bei Multi-Device-Rollout, Security-Hardening und User-Onboarding für Kanzlei-Teams.',
      ctaPrimary: 'Rollout-Support anfragen',
      ctaSecondary: 'Support kontaktieren',
      faqTitle: 'FAQ zum Downloadcenter',
      faqItems: [
        {
          question: 'Können wir Subsumio ohne Installation nutzen?',
          answer:
            'Ja. Die Web-SaaS-Version ist produktionsreif und sofort in modernen Browsern nutzbar.',
        },
        {
          question: 'Welche Desktop-Systeme werden unterstützt?',
          answer:
            'Subsumio bietet dedizierte Desktop-Artefakte für macOS, Windows und Linux.',
        },
        {
          question: 'Können wir vor dem Voll-Rollout testen?',
          answer:
            'Ja. Nutzen Sie Canary für Pilot-Nutzer und Stable für den produktiven Betrieb.',
        },
        {
          question:
            'Gibt es Support für Enterprise- und Self-Managed-Deployments?',
          answer:
            'Ja. Release- und Source-Pakete unterstützen fortgeschrittene IT-Umgebungen und kontrollierte Deployments.',
        },
      ],
    };
  }

  if (language !== 'en') {
    return {
      ...english,
      pageTitle: english.pageTitle,
    };
  }

  return english;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = resolveCopy(locale);

  return generatePageMetadata({
    locale,
    title: copy.pageTitle,
    description: copy.pageSubtitle,
    keywords: [
      'download center',
      'subsumio download',
      'macOS app download',
      'windows app download',
      'microsoft windows app',
      'linux appimage',
      'ios app',
      'ipados app',
      'ipad app',
      'android app',
      'web saas',
    ],
    path: '/systems',
  });
}

export default async function SystemsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = resolveCopy(locale);
  const directDownloadResult = await resolveDirectDownloadAssets();
  const directDownloads = directDownloadResult.assets;
  const userAgent = (await headers()).get('user-agent') || '';
  const runtimeHint = detectRuntimePlatform(userAgent);

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: copy.pageTitle, path: '/systems' },
  ]);
  const downloadSchemaPlatforms = copy.cards.map(card => ({
    name: `${copy.pageTitle} – ${card.title}`,
    operatingSystem: card.platform,
    downloadUrl: card.primaryHref,
  }));

  return (
    <>
      <Script
        id="systems-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildDownloadCenterPageJsonLd({
            locale,
            pageTitle: copy.pageTitle,
            description: copy.pageSubtitle,
            path: '/systems',
            platforms: downloadSchemaPlatforms,
          })
        )}
      </Script>
      <Script
        id="systems-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>
      <Script
        id="systems-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildFaqPageJsonLd(copy.faqItems))}
      </Script>

      <ScrollProgressBar />

      <section className="relative pt-28 pb-14 sm:pt-32 sm:pb-16 lg:pt-40 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <Parallax speed={0.05} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern" />
        </Parallax>
        <ScrollLightSweep className="absolute inset-0" intensity={0.18} />
        <FloatingParticles
          count={4}
          colors={['bg-primary-400/8', 'bg-cyan-400/8', 'bg-sky-300/6']}
        />
        <Parallax speed={0.03} className="absolute inset-0">
          <GradientBlob
            className="-top-40 -right-40 animate-breathe"
            size={500}
            colors={['#1E40AF', '#0E7490', '#dbeafe']}
          />
        </Parallax>
        <Parallax speed={0.06} className="absolute inset-0">
          <GradientBlob
            className="-bottom-60 -left-40"
            size={380}
            colors={['#0E7490', '#1E40AF', '#ecfeff']}
          />
        </Parallax>

        <div className="container-wide text-center max-w-5xl relative">
          <ScrollReveal delay={100} direction="up" distance={18}>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-100/80 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm mb-6">
              <Sparkles className="w-4 h-4 animate-pulse-slow" />{' '}
              {copy.heroKicker}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200} direction="up" distance={26}>
            <TextRevealByWord
              text={copy.pageTitle}
              tag="h1"
              staggerMs={44}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 text-balance"
            />
          </ScrollReveal>
          <ScrollReveal delay={320} direction="up" distance={16}>
            <p className="text-base sm:text-lg lg:text-xl leading-relaxed text-slate-600 max-w-3xl mx-auto mb-8 text-balance">
              {copy.pageSubtitle}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={400} direction="up" distance={14}>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-50 border border-accent-100 px-4 py-2 text-sm font-semibold text-accent-700">
              <BadgeCheck className="w-4 h-4" /> {copy.releaseBadge}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={480} direction="up" distance={14}>
            <div className="mt-8 grid sm:grid-cols-3 gap-3 max-w-4xl mx-auto">
              {copy.heroHighlights.map(item => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:shadow-md hover:border-primary-200 transition-all duration-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={560} direction="up" distance={12}>
            <nav
              className="mt-8 flex flex-wrap items-center justify-center gap-2"
              aria-label={copy.navFlowLabel}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mr-1">
                {copy.navFlowLabel}
              </span>
              <a
                href="#journey"
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors focus-ring"
              >
                {copy.navJourney}
              </a>
              <a
                href="#apps"
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors focus-ring"
              >
                {copy.navApps}
              </a>
              <a
                href="#direct"
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors focus-ring"
              >
                {copy.navDirect}
              </a>
              <a
                href="#versions"
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors focus-ring"
              >
                {copy.navVersions}
              </a>
              <a
                href="#channels"
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors focus-ring"
              >
                {copy.navChannels}
              </a>
              <a
                href="#requirements"
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors focus-ring"
              >
                {copy.navRequirements}
              </a>
            </nav>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="journey"
        className="section-padding !pt-0 bg-white scroll-mt-28"
      >
        <div className="container-wide">
          <ScrollReveal direction="up" distance={20} duration={700}>
            <article className="rounded-3xl border border-slate-200 bg-white shadow-sm p-7 md:p-9 lg:p-11">
              <div className="max-w-3xl mb-9">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600 mb-2">
                  {copy.stepLabel} 1 · {copy.navJourney}
                </p>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700 mb-2">
                  {copy.journeyEyebrow}
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-3 text-balance">
                  {copy.journeyTitle}
                </h2>
                <p className="text-slate-600 leading-relaxed text-balance">
                  {copy.journeySubtitle}
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 lg:gap-5">
                {copy.journeySteps.map((step, index) => (
                  <ScrollReveal
                    key={step}
                    delay={index * 140}
                    direction={index % 2 === 0 ? 'left' : 'right'}
                    distance={20}
                    duration={600}
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 min-h-[160px] relative overflow-hidden hover:shadow-md hover:border-primary-200 transition-all duration-300">
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-200 to-transparent" />
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 text-white text-sm font-bold flex items-center justify-center mb-3 shadow-lg shadow-primary-600/20">
                        {index + 1}
                      </div>
                      <p className="text-slate-700 leading-relaxed text-[15px]">
                        {step}
                      </p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </article>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="apps"
        className="section-padding bg-white scroll-mt-28 relative overflow-hidden"
      >
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-14">
              <span className="section-label text-primary-700 bg-primary-50 border border-primary-100">
                {copy.stepLabel} 2 · {copy.navApps}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-4 mb-4 text-balance">
                {copy.sectionPlatformTitle}
              </h2>
              <p className="text-slate-600 max-w-3xl mx-auto leading-relaxed text-balance">
                {copy.sectionPlatformSubtitle}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {copy.cards.map((card, idx) => (
              <ScrollScale
                key={card.title}
                startScale={0.92}
                endScale={1}
                startOpacity={0}
                endOpacity={1}
                offsetPx={40 + (idx % 2) * 30}
              >
                <GlowCard glowColor="rgba(30,64,175,0.08)" className="h-full">
                  <article className="p-6 rounded-2xl h-full border border-slate-200/80 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    <div className="h-px w-full bg-slate-200 mb-4" />
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        {card.kind === 'web' ? (
                          <Globe className="w-7 h-7 text-slate-700" />
                        ) : card.kind === 'ios' ||
                          card.kind === 'ipados' ||
                          card.kind === 'android' ? (
                          <Smartphone className="w-7 h-7 text-slate-700" />
                        ) : card.kind === 'server' ? (
                          <Server className="w-7 h-7 text-slate-700" />
                        ) : (
                          <Laptop className="w-7 h-7 text-slate-700" />
                        )}
                        <h3 className="text-xl font-semibold text-slate-900">
                          {card.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="rounded-full bg-slate-100/80 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                          {card.availability}
                        </span>
                        <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                          {card.platform}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-600 leading-relaxed mb-5">
                      {card.body}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {card.tags.map(tag => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <ActionLink
                        href={card.primaryHref}
                        label={card.primaryLabel}
                        contextLabel={card.title}
                        variant="primary"
                        leadingDownloadIcon
                      />
                      <ActionLink
                        href={card.secondaryHref}
                        label={card.secondaryLabel}
                        contextLabel={card.title}
                        variant="secondary"
                      />
                    </div>
                  </article>
                </GlowCard>
              </ScrollScale>
            ))}
          </div>
        </div>
      </section>

      <section
        id="direct"
        className="section-padding !pt-0 bg-white scroll-mt-28"
      >
        <div className="container-wide">
          <ScrollReveal direction="up" distance={18}>
            <article className="rounded-3xl border border-slate-200 bg-slate-50/65 p-7 md:p-9 lg:p-11">
              <div className="max-w-3xl mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600 mb-2">
                  {copy.stepLabel} 3 · {copy.navDirect}
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-3 text-balance">
                  {copy.directTitle}
                </h2>
                <p className="text-slate-600 leading-relaxed text-balance">
                  {copy.directSubtitle}
                </p>
              </div>

              {directDownloads.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {directDownloads.map(asset => (
                    <a
                      key={asset.id}
                      href={asset.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`rounded-2xl border px-5 py-4 hover:shadow-md transition-all duration-300 ${
                        isRecommendedAsset(asset.id, runtimeHint)
                          ? 'border-primary-300 bg-primary-50/40 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-primary-300'
                      }`}
                      aria-label={`${asset.label} – ${asset.platform}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {asset.label}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {asset.platform} · {formatBytes(asset.sizeInBytes)}
                          </p>
                          {isRecommendedAsset(asset.id, runtimeHint) ? (
                            <p className="mt-2 inline-flex rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-800">
                              {copy.directRecommendedLabel}
                            </p>
                          ) : null}
                        </div>
                        <Download
                          className="w-4 h-4 text-primary-700 mt-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
                  {copy.directFallbackNote}{' '}
                  <a
                    href={STABLE_RELEASE_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-primary-700 hover:text-primary-800 transition-colors"
                  >
                    {copy.stableCta}
                  </a>
                  .
                </div>
              )}

              <p className="mt-5 text-xs text-slate-500">
                {copy.directIntegrityLabel}{' '}
                <a
                  href={directDownloadResult.releaseUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-primary-700 hover:text-primary-800 transition-colors"
                >
                  {copy.stableCta}
                </a>
                .
              </p>
            </article>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="versions"
        className="section-padding !pt-0 bg-white scroll-mt-28"
      >
        <div className="container-wide">
          <ScrollReveal direction="up" distance={20} duration={700}>
            <article className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm p-7 md:p-9 lg:p-11">
              <div className="max-w-3xl mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600 mb-2">
                  {copy.stepLabel} 4 · {copy.navVersions}
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-3 text-balance">
                  {copy.versionTitle}
                </h2>
                <p className="text-slate-600 leading-relaxed text-balance">
                  {copy.versionSubtitle}
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {copy.versionItems.map((item, index) => (
                  <ScrollReveal
                    key={item.channel}
                    delay={index * 100}
                    direction="up"
                    distance={16}
                    duration={600}
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 h-full flex flex-col">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                        {item.cadence}
                      </p>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        {item.channel}
                      </h3>
                      <p className="text-sm text-slate-600 flex-1">
                        {item.recommendation}
                      </p>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors"
                        aria-label={`${item.ctaLabel} – ${item.channel}`}
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                        {item.ctaLabel}
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      </a>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </article>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="channels"
        className="section-padding bg-slate-50 scroll-mt-28 relative overflow-hidden"
      >
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="container-wide relative grid lg:grid-cols-2 gap-8 items-stretch">
          <ScrollReveal direction="left" distance={25} duration={700}>
            <article className="p-7 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                {copy.stepLabel} 5 · {copy.navChannels}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                {copy.channelsTitle}
              </h2>
              <p className="text-slate-600 mb-6">{copy.channelsSubtitle}</p>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="font-semibold text-slate-900 mb-1">
                    {copy.stableTitle}
                  </p>
                  <p className="text-sm text-slate-600 mb-3">
                    {copy.stableBody}
                  </p>
                  <a
                    href={STABLE_RELEASE_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                    aria-label={`${copy.stableCta} – ${copy.stableTitle}`}
                  >
                    {copy.stableCta} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="font-semibold text-slate-900 mb-1">
                    {copy.canaryTitle}
                  </p>
                  <p className="text-sm text-slate-600 mb-3">
                    {copy.canaryBody}
                  </p>
                  <a
                    href={ALL_RELEASES_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                    aria-label={`${copy.canaryCta} – ${copy.canaryTitle}`}
                  >
                    {copy.canaryCta} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </article>
          </ScrollReveal>

          <ScrollReveal
            delay={120}
            direction="right"
            distance={25}
            duration={700}
          >
            <article className="p-7 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                {copy.rolloutTitle}
              </h2>
              <p className="text-slate-600 mb-6">{copy.rolloutSubtitle}</p>
              <div className="space-y-4">
                {copy.rolloutItems.map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-slate-500 mt-0.5" />
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </article>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="requirements"
        className="section-padding bg-white scroll-mt-28 relative overflow-hidden"
      >
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide max-w-4xl relative">
          <ScrollReveal direction="up" distance={25}>
            <div className="text-center mb-10">
              <span className="section-label text-slate-700 bg-slate-100 border border-slate-200">
                {copy.stepLabel} 6 · {copy.navRequirements}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-4 mb-4">
                {copy.requirementsTitle}
              </h2>
            </div>
          </ScrollReveal>

          <ScrollScale
            startScale={0.96}
            endScale={1}
            startOpacity={0.7}
            endOpacity={1}
            offsetPx={80}
          >
            <div className="glass-card p-8 rounded-2xl space-y-4">
              {copy.requirementsItems.map((item, i) => (
                <ScrollReveal
                  key={item}
                  delay={i * 80}
                  direction="up"
                  distance={12}
                  duration={500}
                >
                  <div className="flex items-start gap-3 group">
                    <CheckCircle2 className="w-5 h-5 text-accent-600 mt-0.5 group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-slate-700">{item}</span>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollScale>
        </div>
      </section>

      <section id="faq" className="section-padding !pt-0 bg-white scroll-mt-28">
        <div className="container-wide max-w-4xl">
          <ScrollReveal direction="up" distance={18}>
            <article className="rounded-3xl border border-slate-200 bg-white shadow-sm p-7 md:p-9 lg:p-11">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
                {copy.faqTitle}
              </h2>
              <div className="space-y-4">
                {copy.faqItems.map(item => (
                  <details
                    key={item.question}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4 group"
                  >
                    <summary className="cursor-pointer list-none text-slate-900 font-semibold flex items-center justify-between gap-3">
                      <span>{item.question}</span>
                      <span className="text-primary-700 text-xl leading-none group-open:rotate-45 transition-transform">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-slate-600 leading-relaxed">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </article>
          </ScrollReveal>
        </div>
      </section>

      <PrefooterCta
        icon={<Shield className="w-9 h-9 text-primary-300" />}
        title={copy.ctaTitle}
        subtitle={copy.ctaSubtitle}
        primaryAction={{ href: '/contact', label: copy.ctaPrimary }}
        secondaryAction={{ href: '/contact', label: copy.ctaSecondary }}
      />
    </>
  );
}
