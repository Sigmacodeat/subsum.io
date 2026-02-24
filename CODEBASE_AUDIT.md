# SaaS Codebase Improvement Audit — AFFiNE (subsumio)

**Datum:** 2026-02-20 | **Version:** 0.26.1 | **Scope:** Vollständiges Monorepo

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 7, Emotion, Yjs CRDT, BlockSuite Editor |
| Desktop/Mobile | Electron 39, Capacitor |
| Backend | NestJS 11, Express 5, Apollo GraphQL, Prisma 6, PostgreSQL+pgvector |
| Realtime | Socket.IO, Yjs, Redis Adapter |
| Jobs | BullMQ, @nestjs/schedule |
| AI | AI SDK (OpenAI/Anthropic/Google), MCP |
| Payment | Stripe, RevenueCat |
| Auth | Cookie Sessions, Magic Link OTP, OAuth, Bearer Tokens |
| Storage | S3-compat blob, SQLite (client nbstore) |
| Observability | OpenTelemetry, Prometheus, Winston |
| Tests | Playwright E2E, Vitest unit, AVA server, c8 coverage |
| Native | Rust NAPI-RS: y-octo, SQLite, PDF/DOCX parsing |

---

# A) System Blueprint

## A.1) Produktziel
AFFiNE ist eine privacy-first, open-source Knowledge-Plattform (Docs+Whiteboards+DBs), lokal oder Cloud, Echtzeit-Kollaboration, KI-gestützt, offline-first via Yjs CRDT.

### Aus User-Sicht (Jobs-to-be-done)

- **Erfassen**: Ideen/Notizen sofort erfassen (Text, Medien, Whiteboard)
- **Organisieren**: Inhalte strukturieren (Pages, Collections, Tags/Favoriten, Navigation)
- **Zusammenarbeiten**: In Echtzeit co-editing und presence/awareness
- **Teilen**: Selektiv teilen (public link, invite, role-based permissions)
- **Wiederfinden**: Suche, Kontext, Version/History
- **Erweitern**: AI Copilot für Schreiben/Recherche/Transformation
- **Monetarisieren (SaaS)**: Plan-Upgrade, Quotas, Teams/Seats

### Nicht-funktionale Ziele

- **Stabilität**: Keine silent failures in Sync/Auth/Payment
- **Security**: Least privilege, sichere Defaults, no data exfil
- **Performance**: niedrige Editor-Latenz, schnelle Sync-Roundtrips
- **A11y**: Keyboard-first, klare Focus States, Screenreader semantics

## A.2) Kern-Userflows

**Beginner:** Signup (Magic Link) → Workspace → Erstes Doc erstellen → Tippen → Reload (persistent)
**Normal:** Workspace erstellen → Members einladen → Collab → Publish → AI Copilot → Plan upgraden
**Power-User:** Keyboard-only Nav → 500-Block Docs → Offline→Online Sync → API Access Tokens → Multi-Account

### Golden Userflow (End-to-End)

1. **Signup/Login**
2. **Workspace erstellen**
3. **Dokument erstellen**
4. **Einladung an Member**
5. **Realtime-Coediting + Awareness**
6. **Publish/Share-Link**
7. **Blob Upload (Bild/Attachment)**
8. **Upgrade / Checkout / Subscription aktiv**
9. **(Optional) Copilot Session + Streaming Response**

### Flow-Qualitätskriterien

- **Beginner** scheitert nicht an unklaren Fehlermeldungen
- **Normal** hat klare Status-/Progress-Anzeigen (Invite/Sync/Upload/Billing)
- **Power User** bekommt deterministische Shortcuts, Undo/Redo, und konsistente Permission-Reaktionen

## A.3) Datenmodell

- **Docs:** Yjs CRDT Snapshots+Updates in PostgreSQL bytea, Client-Cache in IndexedDB/SQLite via SharedWorker
- **Auth:** Cookie-based Sessions (`affine_session`), CSRF Token, Access Tokens (Bearer)
- **Billing:** Stripe = Source of Truth → PostgreSQL Mirror via Webhooks
- **Blobs:** S3 + PostgreSQL Metadata mit SHA-256 Checksum Verification
- **Consistency:** Eventual (Docs via CRDT), Strong (Permissions via Prisma)

### Kritische Entitäten (aus Prisma-Schema abgeleitet)

- **Identity/Auth**: `User`, `Session`, `UserSession`, `VerificationToken`, `MagicLinkOtp`, `AccessToken`
- **Workspace/Permissions**: `Workspace`, `WorkspaceUserRole`, `WorkspaceDoc`, `WorkspaceDocUserRole`
- **Sync**: `Snapshot`, `Update`, `SnapshotHistory` (CRDT snapshots/updates)
- **Storage**: `Blob` (DB-Metadaten) + S3 Object (Payload)
- **AI**: `AiSession`, `AiSessionMessage`, `AiContext*Embedding` (pgvector)
- **Billing**: Stripe customer/subscription/invoice mirror (in Payment plugin)

### State-Management & Ownership (vereinfachtes Modell)

| Domain | Server Source of Truth | Client Source of Truth | Sync Mechanismus |
|--------|-------------------------|------------------------|------------------|
| Auth/Session | DB + cookies | in-memory + cookies | HTTP |
| Permissions | DB (Prisma) | derived cached | HTTP + WS invalidation (empfohlen) |
| Doc Content | DB (Updates/Snapshots) | nbstore (SQLite/IDB) | WS (Socket.IO) |
| Blobs | S3 + DB meta | browser cache | signed URLs / REST |
| Billing | Stripe | UI cache | Webhook → DB → API |
| Copilot | DB (sessions) | streaming state | SSE |

## A.4) Architektur

- **Flavor-System:** Server deploybar als `allinone|graphql|sync|renderer|doc|front|script`
- **CLS:** Request-Scoped Tracing + Prisma Transactions
- **Frontend DI:** `@toeverything/infra` Framework für Module/Services
- **nbstore SharedWorker:** Storage offloaded vom Main Thread

### Relevante Backend Entry Points (beobachtet)

- `packages/backend/server/src/index.ts`: Script vs Server
- `packages/backend/server/src/server.ts`: Nest bootstrap, middleware, guards, filters, Swagger
- `packages/backend/server/src/app.module.ts`: Flavor-basierter Modulaufbau

### Kritische Security Gates (beobachtet)

- **HTTP/WS Auth**: `core/auth/guard.ts` (Session + Token, Version checks)
- **Permissions**: `core/permission/types.ts`, `core/permission/workspace.ts`
- **Throttling**: `base/throttler/index.ts` (CloudThrottlerGuard)

### Kritische Realtime-Komponenten (beobachtet)

- **Space Sync Gateway**: `core/sync/gateway.ts`
  - `space:join`, `space:load-doc`, `space:push-doc-update`, awareness rooms
  - Protocol split: `sync-025` vs `sync-026`

---

## A.5) UI-Elemente & Interaktionen (Inventar)

### Auth / Onboarding

- **E-Mail Preflight**: `POST /api/auth/preflight`
  - **Success**: `registered`, `hasPassword`
  - **Error**: invalid email
- **Sign-in**: `POST /api/auth/sign-in`
  - **Password** oder **Magic Link**
  - **Throttle**: strict

**Interaktionen**

- **Klick**: Submit, OAuth provider
- **Focus**: initial focus auf email, OTP input focus-advance
- **Keyboard**: Enter submit, Escape schließt Modals

### Editor / Workspace

- **Doc Navigation**: Sidebar list → open doc
- **Editing**: Blocks, slash menu, toolbars
- **Presence/Awareness**: Cursor/avatars

**Interaktionen**

- **Drag/Drop**: Block reorder, file drop
- **Keyboard**: Undo/Redo, Quick search, navigation
- **Permission UI**: Readonly state, disabled actions, tooltips

### Billing

- **Checkout**: Stripe
- **Webhook**: `/api/stripe/webhook` (Public)

---

## A.6) Edge-Cases & Fehlerszenarien (priorisiert)

| Domain | Edge Case | Erwartetes Verhalten |
|--------|-----------|----------------------|
| Auth | Magic link OTP replay / brute-force | max attempts, token invalidation, audit log |
| Auth | Session expiry während Edit | graceful prompt + save/restore local changes |
| Sync | WS disconnect während push | retry/backoff, dedupe, no silent acceptance |
| Sync | Permission downgrade während Session | client becomes readonly immediately |
| Storage | Blob uploaded but DB meta write fails | cleanup job or eventual reconciliation |
| Payment | Webhook out-of-order/duplicate | idempotent state fetch-from-Stripe, dedupe |
| Copilot | SSE client disconnect | server cancels provider request, releases resources |
| GraphQL | deep query / expensive query | complexity limiter, rate limits |
| Config | flavors misconfigured | healthcheck fails fast with actionable error |

---

## A.7) Definition of Done (Audit Level)

- **Security**
  - CORS restricted
  - CSRF enforced for state-changing endpoints
  - WS auth failures visible in logs/metrics
  - GraphQL complexity limits
- **Data Integrity**
  - Doc update permission enforced
  - Stripe webhooks idempotent
  - Blob upload reconciliation path
- **UX**
  - Consistent loading/empty/error states
  - Permission changes reflect immediately
  - Offline/online transitions explain state
- **QA**
  - E2E golden flow
  - Negative tests for each P0 risk
  - Stress tests for WS/Sync/Storage/Payment

---

# B) Risk Map / Hotspot-Analyse

| # | Hotspot | Risiko | Impact | Likelihood | Score | Problem | Fix |
|---|---------|--------|--------|-----------|-------|---------|-----|
| 1 | `server.ts:23` `cors:true` | Security | 5 | 4 | **20** | Wildcard CORS → Cookie Theft | Origin-Whitelist |
| 2 | `sync/gateway.ts:562` Doc Update | Data Integrity | 5 | 3 | **15** | Permission Check auskommentiert (TODO) | Aktivieren mit Feature-Flag |
| 3 | `auth/controller.ts:268` CSRF | Security | 4 | 3 | **12** | CSRF optional für backward compat | Mandatory machen |
| 4 | `payment/controller.ts:45` | Security | 3 | 4 | **12** | `InternalServerError(err.message)` leakt Stripe-Details | Generic Message |
| 5 | `payment/webhook.ts` | Data Integrity | 5 | 2 | **10** | Keine Webhook Idempotency | Event-ID Dedup |
| 6 | `sync/gateway.ts:302` | Reliability | 3 | 3 | **9** | connectionCount nur lokal, nicht cluster-weit | Redis Counter |
| 7 | `auth/service.ts:278` Cookie | Security | 3 | 3 | **9** | `secure:false` auf user_id Cookie | `secure:config.https` |
| 8 | `auth/guard.ts:292` WS Auth | Security | 3 | 2 | **6** | Auth-Errors silent geswallowed | Loggen |
| 9 | GraphQL | Security/Perf | 4 | 2 | **8** | Kein Query Complexity Limiter | graphql-query-complexity |
| 10 | `schema.prisma` Snapshot bytea | Performance | 4 | 2 | **8** | Große CRDTs direkt in PG → Bloat | External Storage ab Threshold |

### Zusätzliche Hotspots (aus gelesenem Code abgeleitet)

| # | Hotspot | Risiko | Impact | Likelihood | Score | Problem | Fix |
|---|---------|--------|--------|-----------|-------|---------|-----|
| 11 | `payment/controller.ts:19-47` Public webhook | Security | 4 | 2 | **8** | Public endpoint; robust verification notwendig | strict signature verify + generic errors |
| 12 | `sync/gateway.ts:470-473` Client version gate | Reliability | 3 | 3 | **9** | inkompatible clients werden hart gekickt; UX needs guidance | explicit error event + upgrade prompt |
| 13 | `sync/gateway.ts:240-294` update merge/compress | Perf/Integrity | 3 | 3 | **9** | merge can throw; fallback ok, but metrics/limits needed | size/CPU guards + monitoring |
| 14 | `storage/wrappers/blob.ts:165-221` checksum verify | Perf/Cost | 3 | 2 | **6** | reads whole object to compute checksum → expensive on large blobs | upload checksum header / multipart etag strategy |
| 15 | `auth/controller.ts:181-203` DNS checks | Reliability | 2 | 3 | **6** | DNS resolution failures can block signup | timeouts + fallback policy |

---

# C) Verbesserungs-Backlog (25 Arbeitspakete)

## P0 — Security / Data Loss

**AP-01: CORS Origin Whitelist**
- Scope: `server.ts` — `cors:true` → `cors:{origin:config.allowedOrigins,credentials:true}`
- Test: Supertest mit fremder Origin → CORS blocked
- Rollout: Feature-Flag `strictCors`

**Akzeptanzkriterien**

- Given Cookie-authenticated request von unbekannter Origin
  - When API aufgerufen
  - Then kein `Access-Control-Allow-Origin` und Browser blockt
- Given erlaubte Origin
  - When API aufgerufen
  - Then `Access-Control-Allow-Origin` exakt diese Origin + `Access-Control-Allow-Credentials: true`

**Telemetry**

- Counter: `security.cors.blocked`

**AP-02: Doc Update Permission Check aktivieren**
- Scope: `sync/gateway.ts:562` — TODO-Kommentar → Permission-Check implementieren
- Test: Reader-User versucht push-doc-update → rejected
- Rollout: Feature-Flag, erst logging-only

**Akzeptanzkriterien**

- Given User ohne `Doc.Update`
  - When `space:push-doc-update`
  - Then server rejects + client receives explicit error event
- Given User mit `Doc.Update`
  - When update pushed
  - Then update accepted + broadcasted

**Telemetry**

- Counter: `sync.doc_update.denied`
- Counter: `sync.doc_update.accepted`

**AP-03: Stripe Webhook Idempotency**
- Scope: `payment/controller.ts`, `webhook.ts` — Event-ID Dedup via DB
- Test: Gleichen Event 2x senden → 1x verarbeitet

**Akzeptanzkriterien**

- Given identischer Stripe event `event.id`
  - When 2x geliefert
  - Then nur 1x side-effects (DB writes, feature unlock) und 2. wird als duplicate geloggt

**Telemetry**

- Counter: `payment.webhook.duplicate`

**AP-04: Stripe Error Leak fixen**
- Scope: `payment/controller.ts:45` — Generic Error statt `err.message`
- Test: Invalid Signature → keine Stripe-Details in Response

**Akzeptanzkriterien**

- Response enthält keine Stripe-internen Strings
- Logs enthalten detailierte Error Ursache (server-only)

**AP-05: CSRF mandatory auf Sign-Out**
- Scope: `auth/controller.ts:268-277` — Optional → Required
- Test: POST sign-out ohne CSRF → 403

**Akzeptanzkriterien**

- POST sign-out ohne Header → 403
- POST sign-out mit Header mismatch → 403
- POST sign-out mit korrektem token → 200

**AP-06: GraphQL Query Complexity Limiter**
- Scope: `base/graphql/` — Max Depth 10, Max Complexity 1000
- Test: Nested Query → 400 Error

**Akzeptanzkriterien**

- Deep query wird deterministisch rejected
- Error payload ist user-friendly (kein stacktrace)

**Telemetry**

- Counter: `graphql.query.rejected_complexity`

## P1 — Reliability / Performance / UX

**AP-07: WebSocket Reconnect Rate-Limiting**

- **Ziel**: Reconnect-Floods und WS-Connect-Spikes abfangen, ohne legitime Clients (mobile, flaky networks) zu hart zu bestrafen.
- **Abhängigkeiten**
  - Server: Socket.IO Adapter/Namespace (z.B. Redis Adapter), AuthGuard WS Path
  - Config: Grenzwerte pro IP/User
- **Betroffene Komponenten**
  - Backend: WebSocket bootstrap (Adapter), `core/sync/gateway.ts` connection lifecycle
  - Frontend: WS client reconnect/backoff (falls nicht schon implementiert)
- **State-Änderungen**
  - Server-side: ephemeral counters (Redis preferred) für `(ip, userId)`
- **Akzeptanzkriterien**
  - Given 1 Client reconnectet 50x/10s
    - When Threshold überschritten
    - Then weitere Connects werden abgelehnt (oder delayed) mit nachvollziehbarem Error-Code
  - Given normaler Reconnect (<=5/30s)
    - Then Connect succeeds
- **Tests**
  - Integration: Simulierter WS Connect/Disconnect Loop
  - E2E: Mobile-like network flaps (Playwright + network conditions)
- **Telemetry**
  - Counter: `websocket.connect.rate_limited`
  - Gauge: `websocket.connections.active`
- **Rollout**
  - Feature-Flag: `wsReconnectRateLimit`
  - Start mit Monitoring-only → anschließend enforce

**AP-08: Disabled User → Session sofort invalidieren**

- **Ziel**: Account-Disable wird sofort wirksam (API + WS), keine “Zombie Sessions”.
- **Abhängigkeiten**
  - User disable/update path muss Event triggern (oder zentraler Service)
- **Betroffene Komponenten**
  - Backend: AuthService Session revoke, WS gateway disconnect
  - Frontend: Session-refresh Handling, UI: “Account disabled” Message
- **State-Änderungen**
  - DB: alle `UserSession` invalidieren (revokedAt / expiresAt)
  - WS: active sockets dieses Users disconnect
- **Akzeptanzkriterien**
  - Given user wird disabled
    - When derselbe user macht API request
    - Then 401/403 mit user-friendly error
  - Given user hat aktive WS connection
    - Then server disconnects socket + client navigiert zu login
- **Tests**
  - Integration: disable → request denied
  - E2E: Admin disables user while user is editing
- **Telemetry**
  - Counter: `auth.user.disabled.session_revoked`
- **Rollout**
  - Direkt (kein client breaking), aber UI-Text hinzufügen

**AP-09: Expired Session Cleanup Cron**

- **Ziel**: DB Hygiene + Performance + Compliance (minimiert Session-Table growth).
- **Betroffene Komponenten**
  - Backend: Cron/Schedule module, Models Session API
- **State-Änderungen**
  - DB: delete/compact expired sessions
- **Akzeptanzkriterien**
  - Given 100k expired sessions
    - When Cron läuft
    - Then deletes in batches ohne long locks (bounded runtime)
- **Tests**
  - Unit: batch deletion logic
  - Integration: seed expired sessions → run job → verify counts
- **Telemetry**
  - Gauge: `auth.sessions.expired_remaining`
  - Counter: `auth.sessions.cleaned`
- **Rollout**
  - Direkt

**AP-10: Workspace Deletion → Client Notification**

- **Ziel**: User wird nicht in “dead workspace” gelassen; klare UX.
- **Betroffene Komponenten**
  - Backend: workspace delete event → WS broadcast
  - Frontend: router navigation + toast
- **State-Änderungen**
  - none (nur events)
- **Akzeptanzkriterien**
  - Given user ist in workspace view
    - When workspace deleted
    - Then client zeigt Toast + navigiert auf safe route (workspace list)
- **Tests**
  - E2E: 2 users, 1 deletes workspace, 1 observes redirect
- **Telemetry**
  - Counter: `workspace.deleted.broadcast`

**AP-11: Permission-Change Live-Propagation**

- **Ziel**: Permission changes wirken sofort, reduzieren “silent permission drift”.
- **Abhängigkeiten**
  - Permission service muss event `permission.changed` emitten
- **Betroffene Komponenten**
  - Backend: permission update paths, WS gateway
  - Frontend: permission store invalidation + UI toggles
- **Akzeptanzkriterien**
  - Given editor user wird zu reader downgraded
    - Then editor becomes readonly sofort (ohne reload)
  - Given reader user wird zu editor upgraded
    - Then UI enables editing ohne full refresh
- **Tests**
  - E2E: role change mid-session
- **Telemetry**
  - Counter: `permission.change.broadcast`

**AP-12: Blob Storage Quota Enforcement**

- **Ziel**: Kosten/Abuse kontrollieren; klare UX bei Limits.
- **Abhängigkeiten**
  - Quota/Plan Definitionen (payment features)
  - Blob total size (bereits vorhanden: `WorkspaceBlobStorage.totalSize()`)
- **Betroffene Komponenten**
  - Backend: blob upload endpoints (presign/put/complete)
  - Frontend: upload error handling + upgrade CTA
- **Akzeptanzkriterien**
  - Given workspace ist 99% voll
    - When upload exceeds quota
    - Then request rejected with clear error code
  - Given quota ausreichend
    - Then upload succeeds
- **Tests**
  - Integration: fake quota + upload
  - E2E: UI shows upgrade CTA
- **Telemetry**
  - Counter: `storage.quota.exceeded`

**AP-13: WebSocket Auth Error Logging**

- **Ziel**: Keine silent WS auth failures, bessere Incident-Diagnose.
- **Akzeptanzkriterien**
  - Given invalid token
    - Then warning log + metric increments
- **Tests**
  - Integration: connect with invalid cookie/token
- **Telemetry**
  - Counter: `websocket.auth.failed`

**AP-14: Frontend Permission-basierte UI**

- **Ziel**: UX: keine “click to get denied”, reduziert support load.
- **Betroffene Komponenten**
  - Frontend: action menus, editor toolbar, settings pages
- **State-Änderungen**
  - Client-side permission map cache per workspace/doc
- **Akzeptanzkriterien**
  - Given reader role
    - Then edit actions hidden/disabled mit tooltip
- **Tests**
  - E2E snapshots für role permutations
- **Telemetry**
  - Counter: `ui.action.disabled_by_permission`

**AP-15: Sub-Component Error Boundaries**

- **Ziel**: “Partial failure” statt white-screen-of-death.
- **Betroffene Komponenten**
  - Frontend: editor mount, sidebar, settings routes, copilot panel
- **Akzeptanzkriterien**
  - Given editor throws
    - Then fallback UI shown + retry option, app shell remains usable
- **Tests**
  - Unit: throw in child component, assert fallback
- **Telemetry**
  - Counter: `ui.error_boundary.triggered` (tag: component)

**AP-16: Magic Link OTP Max Attempts**

- **Ziel**: Explizite brute-force defense (zusätzlich zum throttle).
- **Abhängigkeiten**
  - `MagicLinkOtp.attempts` Feld existiert (Prisma)
- **Akzeptanzkriterien**
  - Given 5 invalid attempts
    - When 6th attempt
    - Then token invalidated + require re-send
- **Tests**
  - Unit: consume() increments attempts and blocks
- **Telemetry**
  - Counter: `auth.magic_link.blocked_attempts`

## P2 — Polish / DevEx

**AP-17: Consistent Loading Skeletons** — Shared Skeleton Component

- **Ziel**: perceived performance, weniger layout shift.
- **Akzeptanzkriterien**
  - Each lazy route has meaningful skeleton
- **Tests**
  - Visual regression screenshots

**AP-18: Consistent Empty States** — Icon+Text+CTA für alle leeren Views

- **Ziel**: Activation ↑, weniger "dead ends".
- **Akzeptanzkriterien**
  - Leerer workspace zeigt Create CTA + Shortcuts

**AP-19: Dev Environment Hardening** — Dev-Users nur mit explizitem Flag

- **Ziel**: Keine überraschenden Side-Effects im dev
- **Akzeptanzkriterien**
  - Dev users seed only when env flag set

**AP-20: Snapshot History GC** — Cron: DELETE expired SnapshotHistory

- **Ziel**: DB bloat reduzieren
- **Telemetry**
  - Counter: `doc.snapshot_history.cleaned`

**AP-21: User Cookie Secure Flag** — `secure:this.config.server.https`

- **Ziel**: Cookie security defaults correct on HTTPS

**AP-22: Structured Audit Logging** — Standardisierte Audit-Logs für kritische Aktionen

- **Ziel**: Forensics/Compliance/Support
- **Akzeptanzkriterien**
  - Each critical action emits audit event

**AP-23: Frontend Performance Monitoring** — Core Web Vitals + Custom Metrics

- **Ziel**: Performance regressions sichtbar machen
- **Telemetry**
  - LCP/CLS/FID + custom: doc load latency, sync latency

**AP-24: Redis Fallback (Graceful Degradation)** — In-memory Fallback bei Redis-Ausfall

- **Ziel**: Reduced blast radius
- **Akzeptanzkriterien**
  - Redis down → API still serves core flows (degraded)

**AP-25: Embedding Version Migration** — Versionierte Embeddings + Background Re-Index

- **Ziel**: Safe AI model upgrades
- **Akzeptanzkriterien**
  - Old embeddings still used until new ready

---

# D) QA Plan

## D.1) E2E Szenarien (Golden Flow + Regressions)

| ID | Szenario | Steps (kurz) | Expected Result | Observability / Logs |
|----|----------|--------------|-----------------|----------------------|
| E2E-01 | Signup via Magic Link | `POST /api/auth/sign-in` ohne password → OTP → `POST /api/auth/magic-link` | Session cookies gesetzt, redirect ok | `auth.magic_link.sent`, `auth.session.created` |
| E2E-02 | Workspace erstellen | UI: Create workspace | Workspace erscheint, membership korrekt | `workspace.created` audit log |
| E2E-03 | Doc erstellen + Persistenz | Create doc → tippen → reload | Content persistiert | `doc.created`, `doc.snapshot.saved` |
| E2E-04 | Multi-User Co-editing | User A+B öffnen doc, beide tippen | Updates <1s, keine Duplikate | `sync.doc_update.accepted`, `sync.doc_updates_broadcast` |
| E2E-05 | Awareness Rooms | Join awareness → update awareness | Presence updates broadcast | `sync.awareness.broadcast` |
| E2E-06 | Permission Downgrade mid-session | Admin setzt A: Editor→Reader | Editor wird readonly sofort, Toast | `permission.change.broadcast`, `ui.action.disabled_by_permission` |
| E2E-07 | Workspace Delete mid-session | Admin löscht workspace | Client redirected + toast, WS left | `workspace.deleted.broadcast` |
| E2E-08 | Blob Upload (image) | Drag-drop image | Upload succeeds, rendered, reload persists | `workspace.blob.sync`, `storage.blob.completed` |
| E2E-09 | Upgrade → Stripe Checkout | Checkout (test) + webhook | Features unlocked, subscription active | `stripe.*` events, `payment.subscription.updated` |
| E2E-10 | Offline→Online Sync | offline edits → reconnect | Edits merged, no loss, clear UI | `sync.reconnect`, `sync.merge.completed` |

**Wichtig (Qualitätsgates):**

- Für jedes E2E Szenario:
  - **Screenshots** (Playwright) für success + error variants
  - **Trace** speichern bei failure
  - **Server logs correlation id** (CLS) muss im Output auftauchen

## D.2) Negative / Abuse Tests

| ID | Szenario | Trigger | Expected Result | Observability |
|----|----------|---------|-----------------|--------------|
| NEG-01 | OTP brute-force | 10x wrong OTP | ab Attempt 6 block + require resend | `auth.magic_link.blocked_attempts` |
| NEG-02 | GraphQL complexity DoS | nested query depth>10 | rejected 4xx, no heavy resolver work | `graphql.query.rejected_complexity` |
| NEG-03 | WS invalid token | connect with bad token/cookie | rejected + warning log | `websocket.auth.failed` |
| NEG-04 | WS join wrong spaceType | `space:join` mit invalid `spaceType` | join rejected + disconnect | `sync.join.rejected` |
| NEG-05 | Push doc update ohne permission | Reader sends `push-doc-update` | rejected, no broadcast | `sync.doc_update.denied` |
| NEG-06 | Stripe webhook invalid signature | random payload | generic error, no internal leak | `payment.webhook.invalid_signature` |
| NEG-07 | Stripe webhook replay | same `event.id` 2x | 2nd ignored, no side effects | `payment.webhook.duplicate` |
| NEG-08 | CSRF missing on sign-out | missing header | 403 | `auth.csrf.missing` |
| NEG-09 | Oversized upload | >100MB | 413, UI shows explanation | `storage.upload.too_large` |
| NEG-10 | Callback URL abuse | magic link with disallowed callback | 403 | `auth.callback.disallowed` |

## D.3) Stress / Soak Tests

| ID | Test | Setup | Expected | Metrics |
|----|------|-------|----------|---------|
| SOAK-01 | Long editor session | 4h idle + edits | no memory leak, no perf degradation | heap, event loop lag |
| STRESS-01 | Doc update throughput | 1000 updates/10min | no dropped updates, bounded CPU | `doc_updates_broadcast`, CPU |
| STRESS-02 | Reconnect storm | 100 sockets reconnect loops | server stays responsive | `websocket.connect.rate_limited` |
| STRESS-03 | Blob concurrency | 50 parallel uploads | graceful queueing + quota enforcement | upload latency p95 |
| STRESS-04 | Payment webhook flood | 100 events/min | idempotent, bounded DB writes | webhook processing latency |

## D.4) Accessibility QA

- **Axe (automated):**
  - Login page
  - Workspace dashboard
  - Editor page (Page + Edgeless)
  - Settings + Billing
- **Keyboard-only script:**
  - Tab order: sidebar → editor → toolbar → modals
  - No focus loss on route change
- **Screen reader:**
  - Roles/labels for:
    - Buttons, menus, dialogs
    - Document title
    - Presence indicators

---

# E) Konkrete Code-Änderungen (verifiziert)

## E.1) CORS Fix — `server.ts:23`

- **Datei**: `packages/backend/server/src/server.ts`
- **Ist-Zustand**: Nest bootstrap verwendet `cors: true` (Wildcard).
- **Soll-Zustand**:
  - `cors` als Objekt konfigurieren
  - `origin` per allowlist (Config)
  - `credentials: true`
- **Risiko**: breaking für externe Tools/Hosts wenn Origins nicht konfiguriert.
- **Verifikation**:
  - Integration-Test: erlaubte vs. nicht erlaubte Origin
  - Browser: cookie-auth request cross-site muss blocken

## E.2) Doc Permission — `sync/gateway.ts:562`

- **Datei**: `packages/backend/server/src/core/sync/gateway.ts`
- **Ist-Zustand**: doc-level permission check für `space:push-doc-update` ist auskommentiert.
- **Soll-Zustand**:
  - `Doc.Update` wieder server-side enforced
  - Für alte Clients: Feature-Flag `enforceDocUpdatePermission` + “warn-only” mode
- **Verifikation**:
  - Reader user kann nicht pushen
  - Editor user kann pushen
  - Keine Broadcasts bei deny

## E.3) Stripe Error Leak — `payment/controller.ts:44-46`

- **Datei**: `packages/backend/server/src/plugins/payment/controller.ts`
- **Ist-Zustand**: `InternalServerError(err.message)` leakt details.
- **Soll-Zustand**:
  - Generic error message nach außen
  - Voller error nur server-side log
- **Verifikation**:
  - invalid signature request liefert keine stripe internals

## E.4) WS Auth Logging — `auth/guard.ts:292`

- **Datei**: `packages/backend/server/src/core/auth/guard.ts`
- **Ist-Zustand**: WS auth errors werden geschluckt.
- **Soll-Zustand**:
  - warn log + metric
- **Verifikation**:
  - invalid auth erzeugt log line + counter

## E.5) Cookie Secure Flag — `auth/service.ts:278`

- **Datei**: `packages/backend/server/src/core/auth/service.ts`
- **Ist-Zustand**: user cookie wird immer `secure:false` gesetzt.
- **Soll-Zustand**: `secure` folgt `config.server.https`.
- **Verifikation**:
  - In HTTPS deployment: Cookie enthält `Secure`

## Empfohlene Deep-Dives (nicht gelesen)
- `base/graphql/` — Query Complexity
- `models/magic-link-otp.ts` — Max Attempts
- `plugins/payment/service.ts` (voll) — Subscription Races
- `core/doc/` — Snapshot Merge Memory
- `core/quota/` — Enforcement Logic
- `frontend/core/src/modules/permissions/` — Client Guards

---

# F) Self-Audit

| Bereich | Status | Handlungsbedarf |
|---------|--------|----------------|
| **CORS** | ⚠️ Wildcard | **P0 — AP-01** |
| **Doc Permissions (Sync)** | ⚠️ Auskommentiert | **P0 — AP-02** |
| **CSRF** | ⚠️ Optional | **P0 — AP-05** |
| **Error Leak** | ⚠️ Stripe Details exposed | **P0 — AP-04** |
| **Webhook Idempotency** | ⚠️ Nicht vorhanden | **P0 — AP-03** |
| **Query Complexity** | ⚠️ Kein Limiter | **P0 — AP-06** |
| **Session Cleanup** | ⚠️ Expired bleiben in DB | **P1 — AP-09** |
| **User Disable → Session** | ⚠️ Sessions bleiben aktiv | **P1 — AP-08** |
| **Loading/Empty States** | ⚠️ Inkonsistent | **P2 — AP-17/18** |
| **A11y** | ❓ Muss per Axe/Lighthouse verifiziert werden | Audit nötig |
| **Focus Trapping** | ❓ Modals/Dialogs unklar | Runtime-Test nötig |

**Empfohlene Reihenfolge:** AP-01 → AP-04 → AP-02 → AP-05 → AP-03 → AP-06 → AP-13 → AP-08 → AP-16

## Konkreter PR-Plan (nächste 3 PRs)

### PR-1 (Security Baseline)

- Implement: **AP-01 CORS allowlist**, **AP-04 Stripe error leak**, **AP-13 WS auth logging**
- Tests: Origin tests, webhook invalid signature test, ws invalid token test
- Rollout: `strictCors` Flag default-on in dev/staging, allow override

### PR-2 (Data Integrity Baseline)

- Implement: **AP-02 enforce Doc.Update** (warn-only → enforce), **AP-05 CSRF sign-out mandatory**
- E2E: permission flip + push-doc-update denied

### PR-3 (Revenue/Payments Hardening)

- Implement: **AP-03 webhook idempotency** + metrics
- Add: webhook processing latency metrics + duplicate counter

---

# G) Rollout / Release Engineering (SaaS-spezifisch)

## G.1) Prinzipien

- **Small, reversible PRs**: Jede PR muss rollbackbar sein (Feature-Flag oder safe default)
- **Instrumentation first**: P0 Fixes erst mit Metrics/Logs in Staging, dann in Prod
- **Staged rollout**: Canary → 10% → 50% → 100% (falls Infrastruktur vorhanden)

## G.2) Feature-Flags (empfohlen)

| Flag | Default | Zweck | Rollback |
|------|---------|------|----------|
| `strictCors` | off→on | CORS allowlist erzwingen | switch off wenn third-party integrations brechen |
| `enforceDocUpdatePermission` | warn | Doc.Update enforcement | warn-only fallback |
| `requireCsrfOnSignOut` | warn | CSRF mandatory | warn-only fallback |
| `wsReconnectRateLimit` | monitor | WS connect throttling | disable wenn false positives |
| `stripeWebhookDedup` | on | idempotency | disable wenn dedup bug |
| `graphqlComplexityLimiter` | on | query DoS protection | raise thresholds temporarily |

## G.3) Rollback Playbook (minimal)

- **CORS**: fallback to previous allowlist or disable enforcement while investigating
- **CSRF**: warn-only mode für legacy clients (timeboxed)
- **Doc.Update permission**: warn-only mode bei unerwarteten denies (log denied docId/userId)
- **Stripe webhook dedup**: disable dedup und rely on service-level idempotency (Stripe object fetch)

---

# H) Konkretere Implementierungsskizzen (ohne unverified code)

Diese Sektion beschreibt konkrete Änderungen auf File/Service-Ebene, ohne Code zu erfinden. Wo exakte APIs noch unklar sind, ist die **Verifikations- und Discovery-Checkliste** mit enthalten.

## H.1) Stripe Webhook Idempotency (AP-03)

### Zielbild

- Jeder Stripe webhook `event.id` wird **einmal** verarbeitet.
- Duplicate events werden akzeptiert (200/2xx) aber **ohne side effects**.

### Implementation Plan

- **Backend**
  - Neue persistence: `stripe_webhook_events` (eventId PK, processedAt, type)
  - Im Controller `POST /api/stripe/webhook`:
    - signature verify
    - quick insert-or-ignore by eventId
    - wenn already exists → log + return early
  - In der async event handling pipeline:
    - fetch latest Stripe objects (bereits in `StripeWebhook` teilweise vorhanden)

### Verifikation

- Replay: 1 payload 10x senden → exakt 1x side effects
- Out-of-order: subscription.updated vor invoice.paid → state ends consistent (source of truth: retrieve latest object)

### Telemetry

- Counter: `payment.webhook.processed`
- Counter: `payment.webhook.duplicate`
- Histogram: `payment.webhook.processing_ms`

## H.2) CSRF Enforcement Sign-Out (AP-05)

### Zielbild

- State-changing endpoint `POST /api/auth/sign-out` erfordert CSRF header.

### Rollout-Strategie

1. **Phase 1 (warn-only)**
   - Requests ohne token → 200/403? (konfigurierbar), aber log metric `auth.csrf.missing`
2. **Phase 2 (enforce)**
   - Ohne token → 403
3. **Phase 3 (cleanup)**
   - Drop backward-compat branches

### Verifikation

- Unit/Integration tests: missing header, mismatch, correct
- Frontend: sign-out immer mit header

## H.3) GraphQL Complexity Limiter (AP-06)

### Zielbild

- Explizite Limits verhindern resolver explosion.

### Discovery

- Prüfen:
  - Wo ist GraphQL module konfiguriert (z.B. `GqlModule`)?
  - Gibt es bereits depth limits?
  - Welche Resolver sind teuer (workspace/docs list)?

### Verifikation

- Query depth>10 rejected
- Normal queries unaffected

---

# I) Audit Konsistenz-Check (final)

## I.1) Offene Annahmen

- Einige Implementierungsdetails (GraphQL module wiring, client reconnect/backoff) sind **nicht** in den gelesenen Files sichtbar. Deshalb:
  - Empfehlungen sind file-level + verifikationsgetrieben
  - Vor Umsetzung: Discovery checklist (siehe H.3)

## I.2) Was du nach diesem Audit sofort tun kannst

1. **PR-1** (Security Baseline) mergen
2. **PR-2** (Data Integrity) mergen
3. **PR-3** (Payments) mergen
4. Danach: WS rate limiting + quota + session cleanup

## I.3) Definition of Done (Projektweit)

- Alle P0 Punkte sind live, beobachtbar, mit Rollback
- E2E Golden Flow läuft stabil in CI
- Error budget: keine P0 incidents über 30 Tage

---

# Appendix A) Metrics / Logs Catalog (Operational Readiness)

## A.1) Metrics Naming Conventions

- Prefixe nach Domäne:
  - `auth.*`
  - `sync.*`
  - `payment.*`
  - `storage.*`
  - `graphql.*`
  - `ui.*`
  - `websocket.*`

## A.2) Must-have Counters / Gauges / Histograms

| Domain | Metric | Type | Labels | Warum |
|--------|--------|------|--------|-------|
| Auth | `auth.session.created` | counter | `method` | Signup/Login health |
| Auth | `auth.csrf.missing` | counter | `route` | CSRF rollout visibility |
| Auth | `auth.magic_link.blocked_attempts` | counter | `email_domain` | Brute-force signal |
| Sync | `sync.doc_update.accepted` | counter | `protocol` | throughput |
| Sync | `sync.doc_update.denied` | counter | `reason` | permission regressions |
| Sync | `sync.doc_updates_broadcast` | counter | `mode` | compression vs batch |
| WS | `websocket.connections.active` | gauge | `namespace` | capacity |
| WS | `websocket.connect.rate_limited` | counter | `ip_hash` | abuse/false positives |
| Payment | `payment.webhook.processed` | counter | `type` | revenue pipeline |
| Payment | `payment.webhook.duplicate` | counter | `type` | dedup correctness |
| Payment | `payment.webhook.processing_ms` | histogram | `type` | bottlenecks |
| Storage | `storage.quota.exceeded` | counter | `plan` | upsell & abuse |
| Storage | `storage.upload.too_large` | counter | `route` | UX friction |
| GraphQL | `graphql.query.rejected_complexity` | counter | `reason` | DoS protection |
| UI | `ui.error_boundary.triggered` | counter | `component` | stability signals |

## A.3) Minimum Structured Logs (Audit Trail)

**Format (empfohlen):** JSON log payload

- `timestamp`
- `level`
- `requestId` (CLS correlation)
- `actorUserId` (wenn vorhanden)
- `action`
- `resourceType`, `resourceId`
- `metadata` (role changes, stripe ids, workspaceId, docId)

**Events (Minimum):**

- `user.sign_in`, `user.sign_out`, `user.disabled`
- `workspace.created`, `workspace.deleted`, `workspace.member.invited`, `workspace.member.role_changed`
- `doc.created`, `doc.deleted`, `doc.permission.denied_update`
- `payment.webhook.received`, `payment.webhook.duplicate`, `payment.subscription.updated`

---

# Appendix B) Alerting (SLO-first)

## B.1) P0 Alerts

| Alert | Signal | Threshold | Action |
|-------|--------|-----------|--------|
| WS Auth Fail Spike | `websocket.auth.failed` | >50/min | Check auth cookies/tokens, recent deploy |
| Stripe Webhook Fail | logs: verification failed | >5/min | Check webhook key rotation, signature verify |
| Doc Update Denied Spike | `sync.doc_update.denied` | >N/min | Permission regression or abusive client |
| GraphQL Complexity Reject Spike | `graphql.query.rejected_complexity` | >100/min | DoS / scraper, tighten WAF |
| Storage Quota Exceeded Spike | `storage.quota.exceeded` | >N/min | abuse or plan misconfig |

## B.2) Latency Alerts

- `payment.webhook.processing_ms` p95 > 2000ms
- API p95 > 800ms (per route)
- WS broadcast backlog (if measurable)

---

# Appendix C) Test Matrix (Risk → Test Coverage)

| Risk | P0/P1 | Test Type | Test Case IDs |
|------|-------|----------|---------------|
| CORS wildcard | P0 | integration + browser | AP-01, E2E-01 |
| Doc permission bypass | P0 | E2E + integration | NEG-05, E2E-06 |
| CSRF optional | P0 | integration | NEG-08 |
| Stripe error leak | P0 | integration | NEG-06 |
| Stripe duplicate webhooks | P0 | integration + load | NEG-07, STRESS-04 |
| GraphQL DoS | P0 | integration | NEG-02 |
| WS reconnect storm | P1 | load | STRESS-02 |
| Blob quota | P1 | integration + E2E | E2E-08, STRESS-03 |

---

# Appendix D) File Hotspot Index (observed)

## Backend

- `packages/backend/server/src/index.ts` — server/cli entry
- `packages/backend/server/src/server.ts` — Nest bootstrap, global guards, middleware
- `packages/backend/server/src/app.module.ts` — flavor-based module graph
- `packages/backend/server/src/core/auth/guard.ts` — Auth guard (HTTP + WS)
- `packages/backend/server/src/core/auth/controller.ts` — `/api/auth/*` endpoints
- `packages/backend/server/src/core/auth/service.ts` — cookies/sessions
- `packages/backend/server/src/core/permission/types.ts` — actions/roles mapping
- `packages/backend/server/src/core/permission/workspace.ts` — access controller
- `packages/backend/server/src/core/sync/gateway.ts` — Socket.IO sync gateway
- `packages/backend/server/src/base/throttler/index.ts` — throttling guard
- `packages/backend/server/src/plugins/payment/controller.ts` — stripe webhook entry
- `packages/backend/server/src/plugins/payment/webhook.ts` — stripe event handlers
- `packages/backend/server/src/core/storage/wrappers/blob.ts` — blob meta + checksum verification

## Frontend

- `packages/frontend/apps/web/src/index.tsx` — app mount
- `packages/frontend/apps/web/src/app.tsx` — framework root + router
- `packages/frontend/apps/web/src/setup.ts` — bootstrap
- `packages/frontend/core/src/desktop/router.tsx` — routes

---

# Appendix E) Minimal Runbooks (P0 Incidents)

## E.1) Incident: Users can’t login (Auth outage)

- **Symptoms**
  - Spike: `auth.session.created` drops to ~0
  - Spike: `websocket.auth.failed`
- **Immediate actions**
  - Check recent deploys for `AuthGuard`, cookie config, CORS changes
  - Validate `/api/auth/session` returns expected payload for a known-good session
  - Validate CORS allowlist includes the production frontend origin
- **Rollback**
  - Disable `strictCors` temporarily
  - Revert cookie `secure` change if HTTPS detection misconfigured

## E.2) Incident: Realtime sync broken

- **Symptoms**
  - Clients reconnect loop
  - Doc updates not appearing
  - Spike: `sync.doc_update.denied` or drop in `sync.doc_update.accepted`
- **Immediate actions**
  - Check WS gateway logs for join rejects / version rejects
  - Validate supported client versions list
  - Inspect error rates in `SpaceSyncGateway` broadcast metrics
- **Rollback**
  - Set `enforceDocUpdatePermission=warn` if denies are unexpected
  - Disable `wsReconnectRateLimit` if false positives

## E.3) Incident: Stripe webhooks failing / subscriptions not updating

- **Symptoms**
  - No updates in subscription state
  - Logs: webhook verification failed
  - Drop: `payment.webhook.processed`
- **Immediate actions**
  - Verify webhook secret configured (`config.payment.stripe.webhookKey`)
  - Verify raw body parsing is active (Stripe requires raw body)
  - Replay last webhook in Stripe dashboard
- **Rollback**
  - If dedup buggy: disable `stripeWebhookDedup` (but keep signature verify)

---

# Final Checklist (Audit Completion)

- [ ] P0 issues mapped to PRs with acceptance criteria
- [ ] Every recommendation has verification steps
- [ ] Rollout + rollback covered for each P0 change
- [ ] E2E/Negative/Stress plan exists and is traceable to risks
- [ ] Observability signals defined (metrics + logs)
