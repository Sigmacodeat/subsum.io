# Global Localization & International SEO Architecture

## Objective

Build a country-ready and language-ready marketing architecture that can scale to all target markets with:

- locale-aware routing and metadata
- market-specific SEO signals (`hreflang`, canonical, `x-default`)
- strong data consistency checks in CI/local validation
- reusable content and SEO primitives for all pages

> Note: Rankings cannot be guaranteed by any system, but this architecture maximizes technical SEO correctness and local market relevance.

---

## 1) Data Layer (Source of Truth)

### Locale Catalog

Defined in `src/i18n/config.ts`:

- `locales`, `defaultLocale`
- `localeMarkets`: language, country, currency, timezone, region, legal jurisdiction
- `localeToSeoHreflang`: deterministic mapping (`de-DE`, `fr-CH`, etc.)
- resolvers:
  - `resolveLocaleMarket(locale)`
  - `resolveBaseMessagesLocale(locale)`
  - `resolveSeoHreflang(locale)`

This makes locale behavior deterministic and removes hidden logic from pages.

---

## 2) Routing & i18n Resolution

### Routing

- `src/i18n/routing.ts` defines locale routing via `next-intl`.
- `src/middleware.ts` consumes central locale list and enforces normalization redirects.

### Message fallback

- `src/i18n/request.ts` uses `resolveBaseMessagesLocale`.
- Base + override strategy:
  - base: `messages/<base>.json`
  - market override: `messages/<locale>.override.json`

This supports fast rollout of new markets while keeping content maintainable.

---

## 3) SEO Metadata Engine

### Reusable SEO utility

Implemented in `src/utils/seo.ts`:

- `normalizeLocale`, `normalizePath`, `buildLocaleUrl`
- `buildLanguageAlternates` (including `x-default`)
- `generatePageMetadata` (canonical, alternates, OG locale, robots, keywords)

### Integrity gate

- `assertLocalizationSeoIntegrity()` ensures locale/market/hreflang consistency before metadata generation.

---

## 4) Structured Data (JSON-LD)

Implemented with reusable schema factory:

- `src/utils/seo-schema.ts`
  - `buildHomepageJsonLd(locale, title, description)`

Homepage consumes this factory to avoid ad-hoc schema drift.

---

## 5) Crawlability & Indexing

### Sitemap

- `src/app/sitemap.ts`
- Generates all locale/page combinations from central route catalog (`src/utils/seo-routes.ts`)
- Includes hreflang alternates per URL

### Robots

- `src/app/robots.ts`
- declares sitemap and host

---

## 6) Validation & Quality Controls

### Validator script

- `scripts/validate-localization-seo.mjs`
- Validates:
  - locale presence and default locale
  - market coverage for all locales
  - hreflang uniqueness and market SEO fields
  - message source availability
  - SEO route correctness and uniqueness

### Package scripts

- `validate:localization-seo`
- `quality` = validator + lint

---

## 7) Rollout Model for New Countries

For each new market locale:

1. Add locale in `locales`
2. Add `localeMarkets` entry
3. Add message base/override files
4. Ensure route and metadata coverage
5. Run `validate:localization-seo`
6. Deploy and monitor indexing/ranking in Search Console

---

## 8) Operational KPIs

Track per locale/country:

- indexed pages vs expected pages
- `hreflang`/canonical errors
- impressions, CTR, avg position
- CWV quality on top landing pages
- conversion rate from organic traffic

---

## 9) Next Expansion Steps

1. Add market-specific LocalBusiness/Organization schema variants
2. Add per-market keyword clusters in data layer
3. Introduce locale-level content QA workflow (review state)
4. Add automatic sitemap partitioning when locale/page count grows
