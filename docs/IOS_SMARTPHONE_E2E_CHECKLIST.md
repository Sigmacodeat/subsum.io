# iOS Smartphone E2E Checklist (Production Readiness)

## Scope
This checklist validates that the iOS app is fully usable for smartphone users across frontend-backend integration, authentication, workspace/document workflows, and failure handling.

## Preconditions
- iOS app build is installed from the latest release candidate.
- Backend target environment is reachable (stable or staging) with valid TLS.
- At least one test account exists with:
  - one workspace
  - read/write permissions to at least one doc
  - one account without write permissions for negative tests
- If payment is expected in this environment, payment feature is enabled server-side.

## Go/No-Go Definition
- **GO** only if all P0 and P1 items pass.
- **NO-GO** if any P0 fails or if 2+ P1 fail.

---

## P0 - Critical Flows

### 1) App Boot & Server Connectivity
- [ ] App launches without crash.
- [ ] Initial workspace route resolves correctly.
- [ ] API calls succeed with valid backend base URL.
- [ ] Network timeout errors show recoverable behavior (no frozen UI).

**Pass criteria:** no crash, no permanent loading deadlock, user can proceed to workspace.

### 2) Authentication End-to-End
- [ ] Password sign-in succeeds and session is established.
- [ ] Magic-link deep link sign-in succeeds.
- [ ] OAuth deep link sign-in succeeds.
- [ ] Deep link with `server` parameter signs into the correct server context.
- [ ] Invalid deep link payload is safely ignored (no crash).
- [ ] Sign-out works and session is cleared.

**Pass criteria:** successful auth methods; malformed deep links do not crash app.

### 3) Tokenized API Access (Frontend <-> Backend)
- [ ] Requests to protected endpoints include Authorization and return expected payloads.
- [ ] XHR-based and fetch-based flows both work after login.
- [ ] After app restart, persisted token is reused correctly.

**Pass criteria:** no unauthorized regressions in normal signed-in flows.

### 4) Workspace & Document Core Usage
- [ ] Open workspace home/all/search/journals.
- [ ] Open a document detail route directly.
- [ ] Read and edit a document with write permissions.
- [ ] Read-only behavior is correctly enforced without write permissions.
- [ ] Share/open-page navigation works from detail page.

**Pass criteria:** user can reliably read and edit docs; permissions are enforced.

### 5) Failure UX / NotFound / Permissions
- [ ] Unknown route shows real not-found page (not placeholder text).
- [ ] Missing collection route shows proper not-found UX.
- [ ] Missing/unauthorized document route shows proper no-permission UX.
- [ ] No empty white-screen fallback when resource is missing.

**Pass criteria:** every error path is intentional and user-understandable.

---

## P1 - Important Flows

### 6) Subscription/Paywall Behavior
- [ ] Subscription section appears only when user is logged in.
- [ ] Subscription section is hidden when server payment feature is disabled.
- [ ] Native paywall opens when supported and user taps CTA.

**Pass criteria:** no dead CTA on unsupported environments.

### 7) Journals Flow
- [ ] `/journals` with date routes correctly to existing journal doc when present.
- [ ] If no journal exists for date, placeholder flow is rendered and app remains responsive.
- [ ] Date switching updates route and content correctly.

### 8) Mobile UX Stability
- [ ] Keyboard appearance does not break editor layout.
- [ ] App remains responsive during rapid route switches.
- [ ] Back navigation from detail routes behaves correctly.

### 9) Offline / Recoverability
- [ ] Turning network off while in app does not crash app.
- [ ] Requests fail gracefully with visible recovery path.
- [ ] After network restore, user can continue without force reinstall.

---

## P2 - Nice-to-Have
- [ ] Verify haptics and gesture integrations feel consistent.
- [ ] Verify dark/light theme keyboard style updates correctly.
- [ ] Verify ATT permission prompt failure path logs but does not affect core usage.

---

## Regression Snapshot (Current Hardening)
- iOS deep-link auth parsing and server resolution hardened.
- XHR auth token injection fixed to use request origin from `open()`.
- Subscription panel now correctly hidden when payment feature is unsupported.
- Mobile not-found placeholders replaced with production not-found screens.

---

## Sign-off Template
- Build version:
- Backend environment:
- Device(s) tested:
- Tester:
- Date:
- P0 status: PASS / FAIL
- P1 status: PASS / FAIL
- Final decision: GO / NO-GO
- Notes:
