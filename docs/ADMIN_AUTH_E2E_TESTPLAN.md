# Admin Auth, Membership & Security E2E Testplan

## Scope
- Registrierung/Login: Passwort, Magic Link, OAuth (Google)
- Admin Login mit MFA Step-up
- Session-Hardening (Admin TTL + Step-up Window)
- Membership-/Paket-Verknüpfung über Features/Quotas
- Admin-Guard-Rechte für kritische Bereiche

## Environments
- Local backend + frontend admin
- Test DB mit Redis aktiv (SessionCache)

## Core Flows

### 1) Standard Login (non-admin)
1. User mit Passwort anlegen.
2. `POST /api/auth/sign-in` mit `{ email, password }`.
3. Erwartung:
   - 200
   - gültige `affine_session` + `affine_csrf_token`
   - `GET /api/auth/session` liefert User.

### 2) Admin Login mit MFA Step-up
1. Admin-Feature auf User setzen (`administrator`).
2. `POST /api/auth/sign-in` mit `{ email, password, admin_step_up: true }`.
3. Erwartung:
   - 202
   - `mfaRequired=true`, `ticket`, `riskLevel`.
4. OTP aus Mail (SignIn-Template) nehmen.
5. `POST /api/auth/admin/verify-mfa` mit `{ ticket, otp }`.
6. Erwartung:
   - 201
   - Session gesetzt mit Admin-TTL.
   - `GET /api/auth/session` liefert Admin.

### 3) MFA Negative Cases
1. Falscher OTP:
   - `POST /api/auth/admin/verify-mfa` mit falschem `otp`.
   - Erwartung: 400 `INVALID_AUTH_STATE`.
2. Zu viele Fehlversuche:
   - Nach 5 falschen Versuchen Challenge invalid.
3. Fingerprint-Mismatch:
   - Challenge anlegen, Verify mit anderem UA/IP simulieren.
   - Erwartung: 400 `INVALID_AUTH_STATE`.
4. Reuse-Verify:
   - Ticket nach erfolgreicher Verifikation nochmal verwenden.
   - Erwartung: 400 `INVALID_AUTH_STATE`.

### 4) OAuth Replay Protection
1. `/api/oauth/preflight` aufrufen.
2. Callback einmal erfolgreich ausführen.
3. Dieselbe Callback-`state` erneut senden.
4. Erwartung: 400 `OAUTH_STATE_EXPIRED`.

### 5) Admin Session Hardening
1. Admin Session ohne Step-up Marker, Session älter als `adminSession.stepUpTtl`.
2. Admin-geschützte Query/Mutation aufrufen.
3. Erwartung: 403 `ActionForbidden`.
4. Mit frischer Step-up Session erneut testen:
   - Erwartung: Zugriff erlaubt.

### 6) Membership / Paket-Entitlements
1. Subscription-Events triggern (`user.subscription.activated/canceled`, `workspace.subscription.activated/canceled`).
2. Erwartung:
   - User-Features (z. B. `unlimited_copilot`, `pro_plan_v1`) korrekt gesetzt/entfernt.
   - Workspace-Features (`team_plan_v1`) korrekt gesetzt/entfernt.
3. Frontend `currentUser.features` / Quota-Verhalten verifizieren.

## Security Assertions
- OAuth state ist one-time.
- Admin MFA Challenge ist one-time + attempt-limited + fingerprint-bound.
- Non-admin Accounts werden im Admin-Frontend nicht persistent eingeloggt.
- CSRF Sign-out bleibt intakt.

## Recommended Automated Commands
- Backend fokussiert:
  - `yarn test src/__tests__/auth/controller.spec.ts src/__tests__/oauth/controller.spec.ts` (cwd: `packages/backend/server`)

## Release Checklist
- [ ] All auth tests green
- [ ] OAuth replay test green
- [ ] Admin MFA flow manuell verifiziert
- [ ] Admin frontend login + MFA UX auf Desktop/Mobile geprüft
- [ ] Membership entitlements nach Subscription-Events geprüft
- [ ] Keine Regression in Multi-Account Session Flow
