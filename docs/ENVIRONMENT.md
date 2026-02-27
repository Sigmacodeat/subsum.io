# Environment Setup

This repo intentionally ignores `.env*` files at the git root (see `.gitignore`).

Use one of these approaches:

- Local development: create a local `.env.local` (untracked) in the app you run.
- Vercel: set environment variables in the Vercel project settings.

The canonical template lives in `docs/env.example`.

## Marketing (Next.js)

### Required for Quick-Check API route

- `QUICK_CHECK_UPSTREAM_URL`

### Optional

- `QUICK_CHECK_UPSTREAM_API_KEY`
- `QUICK_CHECK_UPSTREAM_TIMEOUT_MS`
- `QUICK_CHECK_UPSTREAM_RETRIES`
- `QUICK_CHECK_UPSTREAM_RETRY_DELAY_MS`
- `QUICK_CHECK_HANDOFF_SECRET`
- `QUICK_CHECK_APP_ORIGIN`

### Public

- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_SUBSUMIO_IOS_STORE_URL`
- `NEXT_PUBLIC_SUBSUMIO_ANDROID_STORE_URL`

## Electron

### Optional (Sentry)

- `SENTRY_DSN`
- `SENTRY_RELEASE`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

### Dev

- `DEV_SERVER_URL`

## Backend (NestJS server)

The full backend server is not deployed on Vercel in this repo setup. It expects its own runtime with secrets.

### Payments (Stripe)

- `STRIPE_PRICE_EXTRA_PAGES_MONTHLY`
- `STRIPE_PRICE_EXTRA_USERS_MONTHLY`
- `STRIPE_PRICE_PREMIUM_SUPPORT_MONTHLY`
- `STRIPE_PRICE_CUSTOM_TEMPLATES_ONETIME`
- `STRIPE_PRICE_MIGRATION_ONETIME`
- `STRIPE_PRICE_DEDICATED_INFRA_MONTHLY`
- `STRIPE_PRICE_AI_CREDITS_5M_MONTHLY`
- `STRIPE_PRICE_AI_CREDITS_20M_MONTHLY`

### DocuSign

- `DOCUSIGN_CLIENT_ID`
- `DOCUSIGN_USER_ID`
- `DOCUSIGN_ACCOUNT_ID`
- `DOCUSIGN_PRIVATE_KEY_PEM`
- `DOCUSIGN_OAUTH_BASE_URL`
- `DOCUSIGN_REST_BASE_URL`

### Copilot Providers (optional)

Set only what you use:

- `COPILOT_OPENAI_API_KEY`
- `COPILOT_ANTHROPIC_API_KEY`
- `COPILOT_PERPLEXITY_API_KEY`
- `COPILOT_EXA_API_KEY`
- `COPILOT_FAL_API_KEY`

## Resend

The Vercel API stub on `api.subsum.io` can send login verification emails via Resend.

### Required (production)

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `AUTH_OTP_SECRET`

If any of these are missing in production, `/api/auth/sign-in` will return an error and **no email will be delivered**.
