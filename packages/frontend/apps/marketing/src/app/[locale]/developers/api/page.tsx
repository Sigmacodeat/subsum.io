import {
  ArrowRight,
  Globe,
  KeyRound,
  Layers3,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import type { Metadata } from 'next';
import Script from 'next/script';

import {
  GlowCard,
  ScrollProgressBar,
  ScrollReveal,
  TextRevealByWord,
} from '@/components/animations';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildLocaleBreadcrumbs } from '@/utils/breadcrumb-labels';
import { generatePageMetadata } from '@/utils/seo';
import {
  buildBreadcrumbJsonLd,
  buildServicePageJsonLd,
} from '@/utils/seo-schema';

type Copy = {
  title: string;
  subtitle: string;
  badge: string;
  endpointTitle: string;
  endpointBody: string;
  authTitle: string;
  authBody: string;
  coverageTitle: string;
  coverageBody: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaTertiary: string;
  endpointLabel: string;
  scopeTitle: string;
  scopeItems: string[];
  quickstartTitle: string;
  quickstartSubtitle: string;
  quickstartStep1: string;
  quickstartStep2: string;
  quickstartStep3: string;
  curlMetaLabel: string;
  curlMetaCommand: string;
  curlWorkspacesLabel: string;
  curlWorkspacesCommand: string;
  curlContentLabel: string;
  curlContentCommand: string;
  curlSearchLabel: string;
  curlSearchCommand: string;
  curlBlobLabel: string;
  curlBlobCommand: string;
  curlCreateDocLabel: string;
  curlCreateDocCommand: string;
  curlUpdateDocLabel: string;
  curlUpdateDocCommand: string;
  curlDeleteDocLabel: string;
  curlDeleteDocCommand: string;
  curlListWebhooksLabel: string;
  curlListWebhooksCommand: string;
  curlCreateWebhookLabel: string;
  curlCreateWebhookCommand: string;
  curlListDeliveriesLabel: string;
  curlListDeliveriesCommand: string;
  curlGetDeliveryLabel: string;
  curlGetDeliveryCommand: string;
  curlReplayDeliveryLabel: string;
  curlReplayDeliveryCommand: string;
  idempotencyHint: string;
  webhookSignatureHint: string;
  webhookRetryHint: string;
  errorTitle: string;
  errorItems: string[];
};

function resolveCopy(locale: string): Copy {
  if (locale.toLowerCase().startsWith('de')) {
    return {
      title: 'Subsumio Public API für Integrationen',
      subtitle:
        'Binden Sie Subsumio in Kanzlei-Software, Portale und Automationen ein. Token-basiert, versionsklar und auf produktive Integrationsflüsse ausgelegt.',
      badge: 'Developer Platform',
      endpointTitle: 'Stabile API-Basis',
      endpointBody:
        'api.subsum.io als kanonischer Endpoint mit versionierten Public-Routen unter /api/public/v1.',
      authTitle: 'Sichere Authentifizierung',
      authBody:
        'Bearer Access Tokens mit Workspace- und Dokumentberechtigungen auf Basis des bestehenden Rollenmodells.',
      coverageTitle: 'Sofort nutzbare Endpunkte',
      coverageBody:
        'Workspaces auflisten, Workspace-Metadaten lesen, Dokumentlisten abrufen und Dokument-Metadaten für Downstream-Workflows konsumieren.',
      ctaPrimary: 'API-Basis öffnen',
      ctaSecondary: 'Swagger öffnen',
      ctaTertiary: 'GraphQL öffnen',
      endpointLabel: 'Produktions-Endpoint',
      scopeTitle: 'Aktueller Public-API-Scope (v1)',
      scopeItems: [
        'GET /api/public/v1/health',
        'GET /api/public/v1/meta',
        'GET /api/public/v1/workspaces',
        'GET /api/public/v1/workspaces/:workspaceId',
        'GET /api/public/v1/workspaces/:workspaceId/stats',
        'GET /api/public/v1/workspaces/:workspaceId/documents',
        'GET /api/public/v1/workspaces/:workspaceId/documents/:docId',
        'GET /api/public/v1/workspaces/:workspaceId/documents/:docId/content',
        'POST /api/public/v1/workspaces/:workspaceId/documents',
        'PATCH /api/public/v1/workspaces/:workspaceId/documents/:docId',
        'DELETE /api/public/v1/workspaces/:workspaceId/documents/:docId',
        'GET /api/public/v1/workspaces/:workspaceId/webhooks',
        'GET /api/public/v1/workspaces/:workspaceId/webhooks/:webhookId',
        'POST /api/public/v1/workspaces/:workspaceId/webhooks',
        'PATCH /api/public/v1/workspaces/:workspaceId/webhooks/:webhookId',
        'DELETE /api/public/v1/workspaces/:workspaceId/webhooks/:webhookId',
        'GET /api/public/v1/workspaces/:workspaceId/webhook-deliveries',
        'GET /api/public/v1/workspaces/:workspaceId/webhook-deliveries/:deliveryId',
        'POST /api/public/v1/workspaces/:workspaceId/webhook-deliveries/:deliveryId/replay',
        'GET /api/public/v1/workspaces/:workspaceId/search?query=...',
        'GET /api/public/v1/workspaces/:workspaceId/blobs/:blobKey',
      ],
      quickstartTitle: 'Quickstart für Integratoren',
      quickstartSubtitle:
        'In drei Schritten von Token zu produktivem Datenabruf.',
      quickstartStep1:
        '1) User Access Token erzeugen (im Konto / Workspace-Kontext).',
      quickstartStep2:
        '2) API-Discovery über /meta abrufen und verfügbare Ressourcen prüfen.',
      quickstartStep3:
        '3) Workspaces und Dokument-Metadaten paginiert konsumieren.',
      curlMetaLabel: 'Discovery (ohne Token)',
      curlMetaCommand: 'curl -s https://api.subsum.io/api/public/v1/meta',
      curlWorkspacesLabel: 'Workspaces abrufen (mit Bearer Token)',
      curlWorkspacesCommand:
        'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces?page=1&pageSize=25"',
      curlContentLabel: 'Dokument-Content als Markdown exportieren',
      curlContentCommand:
        'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents/<DOC_ID>/content"',
      curlSearchLabel: 'Workspace-Dokumente durchsuchen',
      curlSearchCommand:
        'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/search?query=deadline&limit=20"',
      curlBlobLabel: 'Blob-Download-URL für Attachments auflösen',
      curlBlobCommand:
        'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/blobs/<BLOB_KEY>"',
      curlCreateDocLabel: 'Dokument aus Markdown anlegen',
      curlCreateDocCommand:
        'curl -s -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"title\":\"Neue Akte\",\"content\":\"# Neue Akte\\nErster Entwurf\"}" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents"',
      curlUpdateDocLabel: 'Dokumenttitel/Content aktualisieren',
      curlUpdateDocCommand:
        'curl -s -X PATCH -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"title\":\"Neue Akte v2\",\"content\":\"# Neue Akte v2\\nAktualisiert\"}" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents/<DOC_ID>"',
      curlDeleteDocLabel: 'Dokument löschen',
      curlDeleteDocCommand:
        'curl -s -X DELETE -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents/<DOC_ID>"',
      curlListWebhooksLabel: 'Webhook-Subscriptions auflisten',
      curlListWebhooksCommand:
        'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhooks"',
      curlCreateWebhookLabel: 'Webhook-Subscription erstellen (idempotent)',
      curlCreateWebhookCommand:
        'curl -s -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Idempotency-Key: webhook-create-001" -H "Content-Type: application/json" -d "{\"url\":\"https://example.com/subsumio/webhook\",\"events\":[\"document.created\",\"document.updated\"]}" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhooks"',
      curlListDeliveriesLabel: 'Webhook-Delivery-Logs auflisten',
      curlListDeliveriesCommand:
        'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhook-deliveries?status=failed&page=1&pageSize=25"',
      curlGetDeliveryLabel: 'Einzelne Delivery mit Attempts abrufen',
      curlGetDeliveryCommand:
        'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhook-deliveries/<DELIVERY_ID>"',
      curlReplayDeliveryLabel: 'Fehlgeschlagene Delivery erneut zustellen',
      curlReplayDeliveryCommand:
        'curl -s -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Idempotency-Key: replay-delivery-001" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhook-deliveries/<DELIVERY_ID>/replay"',
      idempotencyHint:
        'Für mutierende Endpunkte (POST/PATCH/DELETE) den Header Idempotency-Key senden, damit Retries sicher dedupliziert werden.',
      webhookSignatureHint:
        'Webhook-Events kommen signiert über X-Subsumio-Signature (Format: v1=<hmac_sha256>). Zu verifizieren mit HMAC(secret, "<timestamp>.<raw_body>") und X-Subsumio-Event-Timestamp.',
      webhookRetryHint:
        'Delivery-Verhalten: bis zu 4 Zustellversuche mit Backoff (0s, 1.5s, 5s), Timeout pro Versuch 10s. Status: pending → running → succeeded/failed. Delivery-Logs dauerhaft in Postgres, abrufbar über /webhook-deliveries.',
      errorTitle: 'Fehler- und Integrationshinweise',
      errorItems: [
        '401/403: Token fehlt, ist ungültig oder hat keine ausreichenden Workspace-Rechte.',
        '404: Workspace oder Dokument existiert nicht (oder ist nicht zugreifbar).',
        '429: Throttling aktiv – Retry mit Backoff einplanen.',
      ],
    };
  }

  return {
    title: 'Subsumio Public API for Integrations',
    subtitle:
      'Integrate Subsumio into legal software, client portals, and workflow automation with a token-based, versioned, production-ready API surface.',
    badge: 'Developer Platform',
    endpointTitle: 'Stable API foundation',
    endpointBody:
      'api.subsum.io as canonical endpoint with versioned public routes under /api/public/v1.',
    authTitle: 'Secure authentication',
    authBody:
      'Bearer access tokens with workspace and document permissions based on the existing role model.',
    coverageTitle: 'Ready-to-use endpoints',
    coverageBody:
      'List workspaces, read workspace metadata, fetch document lists, and consume document metadata for downstream automation.',
    ctaPrimary: 'Open API endpoint',
    ctaSecondary: 'Open Swagger',
    ctaTertiary: 'Open GraphQL',
    endpointLabel: 'Production endpoint',
    scopeTitle: 'Current Public API scope (v1)',
    scopeItems: [
      'GET /api/public/v1/health',
      'GET /api/public/v1/meta',
      'GET /api/public/v1/workspaces',
      'GET /api/public/v1/workspaces/:workspaceId',
      'GET /api/public/v1/workspaces/:workspaceId/stats',
      'GET /api/public/v1/workspaces/:workspaceId/documents',
      'GET /api/public/v1/workspaces/:workspaceId/documents/:docId',
      'GET /api/public/v1/workspaces/:workspaceId/documents/:docId/content',
      'POST /api/public/v1/workspaces/:workspaceId/documents',
      'PATCH /api/public/v1/workspaces/:workspaceId/documents/:docId',
      'DELETE /api/public/v1/workspaces/:workspaceId/documents/:docId',
      'GET /api/public/v1/workspaces/:workspaceId/webhooks',
      'GET /api/public/v1/workspaces/:workspaceId/webhooks/:webhookId',
      'POST /api/public/v1/workspaces/:workspaceId/webhooks',
      'PATCH /api/public/v1/workspaces/:workspaceId/webhooks/:webhookId',
      'DELETE /api/public/v1/workspaces/:workspaceId/webhooks/:webhookId',
      'GET /api/public/v1/workspaces/:workspaceId/search?query=...',
      'GET /api/public/v1/workspaces/:workspaceId/blobs/:blobKey',
    ],
    quickstartTitle: 'Integrator quickstart',
    quickstartSubtitle:
      'Go from token to production-grade data retrieval in three steps.',
    quickstartStep1:
      '1) Create a user access token in account/workspace context.',
    quickstartStep2:
      '2) Fetch API discovery metadata via /meta and inspect resources.',
    quickstartStep3:
      '3) Consume workspaces and document metadata with pagination.',
    curlMetaLabel: 'Discovery (no token required)',
    curlMetaCommand: 'curl -s https://api.subsum.io/api/public/v1/meta',
    curlWorkspacesLabel: 'List workspaces (Bearer token)',
    curlWorkspacesCommand:
      'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces?page=1&pageSize=25"',
    curlContentLabel: 'Export document content as markdown',
    curlContentCommand:
      'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents/<DOC_ID>/content"',
    curlSearchLabel: 'Search workspace documents',
    curlSearchCommand:
      'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/search?query=deadline&limit=20"',
    curlBlobLabel: 'Resolve blob download URL for attachments',
    curlBlobCommand:
      'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/blobs/<BLOB_KEY>"',
    curlCreateDocLabel: 'Create document from markdown',
    curlCreateDocCommand:
      'curl -s -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"title\":\"New file\",\"content\":\"# New file\\nDraft text\"}" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents"',
    curlUpdateDocLabel: 'Update document title/content',
    curlUpdateDocCommand:
      'curl -s -X PATCH -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"title\":\"New file v2\",\"content\":\"# New file v2\\nUpdated text\"}" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents/<DOC_ID>"',
    curlDeleteDocLabel: 'Delete document',
    curlDeleteDocCommand:
      'curl -s -X DELETE -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/documents/<DOC_ID>"',
    curlListWebhooksLabel: 'List webhook subscriptions',
    curlListWebhooksCommand:
      'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhooks"',
    curlCreateWebhookLabel: 'Create webhook subscription (idempotent)',
    curlCreateWebhookCommand:
      'curl -s -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Idempotency-Key: webhook-create-001" -H "Content-Type: application/json" -d "{\"url\":\"https://example.com/subsumio/webhook\",\"events\":[\"document.created\",\"document.updated\"]}" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhooks"',
    curlListDeliveriesLabel: 'List webhook delivery logs',
    curlListDeliveriesCommand:
      'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhook-deliveries?status=failed&page=1&pageSize=25"',
    curlGetDeliveryLabel: 'Get single delivery with attempts',
    curlGetDeliveryCommand:
      'curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhook-deliveries/<DELIVERY_ID>"',
    curlReplayDeliveryLabel: 'Replay failed delivery',
    curlReplayDeliveryCommand:
      'curl -s -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Idempotency-Key: replay-delivery-001" "https://api.subsum.io/api/public/v1/workspaces/<WORKSPACE_ID>/webhook-deliveries/<DELIVERY_ID>/replay"',
    idempotencyHint:
      'Send Idempotency-Key on mutating endpoints (POST/PATCH/DELETE) to deduplicate safe retries.',
    webhookSignatureHint:
      'Webhook events are signed via X-Subsumio-Signature (format: v1=<hmac_sha256>). Verify using HMAC(secret, "<timestamp>.<raw_body>") with X-Subsumio-Event-Timestamp.',
    webhookRetryHint:
      'Delivery behavior: up to 4 attempts with backoff (0s, 1.5s, 5s), 10s timeout per attempt. Status: pending → running → succeeded/failed. Delivery logs persisted in Postgres, accessible via /webhook-deliveries.',
    errorTitle: 'Errors and integration guidance',
    errorItems: [
      '401/403: token missing, invalid, or lacks workspace/document permissions.',
      '404: workspace or document was not found (or not accessible).',
      '429: throttling active – implement retries with backoff.',
    ],
  };
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
    title: copy.title,
    description: copy.subtitle,
    path: '/developers/api',
  });
}

export default async function DeveloperApiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = resolveCopy(locale);

  const breadcrumbs = buildLocaleBreadcrumbs(locale as Locale, [
    { name: 'Developers', path: '/developers/api' },
    { name: 'API', path: '/developers/api' },
  ]);

  return (
    <>
      <Script
        id="developer-api-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(
          buildServicePageJsonLd({
            locale,
            name: copy.title,
            description: copy.subtitle,
            path: '/developers/api',
          })
        )}
      </Script>
      <Script
        id="developer-api-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(buildBreadcrumbJsonLd(breadcrumbs))}
      </Script>

      <ScrollProgressBar />

      <section className="relative section-padding bg-gradient-to-b from-slate-50 via-white to-slate-50 overflow-hidden">
        <div className="container-wide max-w-6xl">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700">
              <TerminalSquare className="h-4 w-4" />
              {copy.badge}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <TextRevealByWord
              text={copy.title}
              tag="h1"
              className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900"
            />
          </ScrollReveal>

          <ScrollReveal delay={220}>
            <p className="mt-5 text-lg text-slate-600 max-w-3xl">
              {copy.subtitle}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://api.subsum.io"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                {copy.ctaPrimary}
              </a>
              <a
                href="https://api.subsum.io/api/docs"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Layers3 className="h-4 w-4" />
                {copy.ctaSecondary}
              </a>
              <a
                href="https://api.subsum.io/graphql"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary inline-flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                {copy.ctaTertiary}
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Globe className="h-5 w-5 text-primary-600" />,
              title: copy.endpointTitle,
              body: copy.endpointBody,
            },
            {
              icon: <KeyRound className="h-5 w-5 text-primary-600" />,
              title: copy.authTitle,
              body: copy.authBody,
            },
            {
              icon: <ShieldCheck className="h-5 w-5 text-primary-600" />,
              title: copy.coverageTitle,
              body: copy.coverageBody,
            },
          ].map(item => (
            <GlowCard key={item.title} className="h-full">
              <article className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 border border-primary-100">
                  {item.icon}
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  {item.title}
                </h2>
                <p className="text-slate-600 leading-relaxed">{item.body}</p>
              </article>
            </GlowCard>
          ))}
        </div>
      </section>

      <section className="section-padding bg-slate-50">
        <div className="container-wide max-w-4xl">
          <article className="rounded-2xl border border-slate-200 bg-white p-7 md:p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 font-semibold mb-2">
              {copy.endpointLabel}
            </p>
            <p className="font-mono text-sm md:text-base text-primary-700 mb-6">
              https://api.subsum.io
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              {copy.scopeTitle}
            </h2>
            <ul className="space-y-2">
              {copy.scopeItems.map(item => (
                <li
                  key={item}
                  className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 font-mono text-sm text-slate-800"
                >
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <Link
                href="/contact"
                className="btn-primary inline-flex items-center gap-2"
              >
                Contact Integration Team <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide max-w-5xl">
          <article className="rounded-2xl border border-slate-200 bg-white p-7 md:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              {copy.quickstartTitle}
            </h2>
            <p className="text-slate-600 mb-6">{copy.quickstartSubtitle}</p>

            <ol className="space-y-2 mb-6 list-decimal pl-5 text-slate-700">
              <li>{copy.quickstartStep1}</li>
              <li>{copy.quickstartStep2}</li>
              <li>{copy.quickstartStep3}</li>
            </ol>

            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlMetaLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlMetaCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlWorkspacesLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlWorkspacesCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlContentLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlContentCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlSearchLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlSearchCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlBlobLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlBlobCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlCreateDocLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlCreateDocCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlUpdateDocLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlUpdateDocCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlDeleteDocLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlDeleteDocCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlListWebhooksLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlListWebhooksCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlCreateWebhookLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlCreateWebhookCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlListDeliveriesLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlListDeliveriesCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlGetDeliveryLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlGetDeliveryCommand}</code>
                </pre>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {copy.curlReplayDeliveryLabel}
                </p>
                <pre className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs sm:text-sm">
                  <code>{copy.curlReplayDeliveryCommand}</code>
                </pre>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              {copy.idempotencyHint}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {copy.webhookSignatureHint}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {copy.webhookRetryHint}
            </p>

            <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900 mb-2">
                {copy.errorTitle}
              </p>
              <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">
                {copy.errorItems.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
