# Update Pipeline Runbook (iOS, Android, Desktop)

> Source of truth for production-grade update and release operations in this repository.

## 1) Scope

This runbook covers:

- Desktop (macOS, Windows, Linux) release + auto-update feed
- iOS release to TestFlight
- Android release to Google Play (internal track draft)
- Version/channel strategy (`canary`, `beta`, `stable`)
- Operational quality gates, rollback, and incident response

Primary pipeline files:

- `.github/workflows/release.yml`
- `.github/workflows/release-desktop.yml`
- `.github/workflows/release-desktop-platform.yml`
- `.github/workflows/release-mobile.yml`
- `scripts/generate-release-yml.mjs`
- `packages/frontend/apps/electron/src/main/updater/electron-updater.ts`
- `packages/frontend/apps/electron/src/main/updater/affine-update-provider.ts`
- `packages/frontend/apps/ios/App/fastlane/Fastfile`

---

## 2) Current Architecture (as implemented)

### 2.1 Orchestrator

`release.yml` is the release orchestrator:

- prepares release metadata (`APP_VERSION`, `BUILD_TYPE`, `GIT_SHORT_HASH`)
- has canary dedup gate
- dispatches cloud + desktop + mobile workflows

### 2.2 Desktop

Desktop pipeline (`release-desktop*.yml`):

- builds macOS, Linux, Windows artifacts
- applies signing workflows (Apple + Windows signer flow)
- publishes GitHub release artifacts
- generates `latest.yml` / `latest-mac.yml` / `latest-linux.yml` via `scripts/generate-release-yml.mjs`
- desktop app update client consumes releases via
  `https://app.subsum.io/api/worker/releases?channel=<channel>&minimal=true`

### 2.3 iOS

Mobile pipeline (`release-mobile.yml` + Fastlane):

- builds web assets + Capacitor sync
- uses App Store Connect API key auth
- increments build number in Fastlane lane `beta`
- uploads to TestFlight when `BUILD_TARGET=distribution`
- supports stable App Store candidate upload via lane `appstore` when `ios-release-to-appstore=true`

### 2.4 Android

Mobile pipeline (`release-mobile.yml`):

- builds web assets + Capacitor sync
- uses GCP workload identity for Play API auth
- auto-bumps `versionCode`
- builds signed AAB
- uploads to Google Play `internal` track as `draft`
- optionally promotes to `alpha|beta|production` with `android-promote-track`
- supports staged rollout with `android-rollout-fraction`

### 2.5 Release controls and observability

- Go/No-Go artifact is generated and uploaded per release (`release-go-no-go-<version>`)
- desktop stable releases include manual rollout gate approval with rollout metadata percentage
- stable releases include Sentry release existence check (`observability-gate`)
- stable observability failures trigger automatic freeze escalation issue (`auto-freeze-on-observability-failure`)
- worker backend `/api/worker/releases` enforces stable desktop phased rollout by `rolloutBucket`

### 2.6 Desktop rollout cohort contract

Desktop updater requests now include deterministic cohort metadata:

- `cohortId`: stable UUID persisted per client install
- `rolloutBucket`: deterministic bucket `1..100` derived from (`cohortId`, `channel`)
- `platform` and `arch`

This allows the release API (`/api/worker/releases`) to enforce phased rollout by cohort bucket server-side.

---

## 3) Release Channels and Versioning Policy (State of the Art)

### 3.1 Channel mapping

- `canary`: high-frequency validation channel, internal/early testers
- `beta`: release-candidate channel, wider validation
- `stable`: production channel

### 3.2 Version format

- stable: `X.Y.Z`
- beta: `X.Y.Z-beta.N`
- canary: `X.Y.Z-canary.<shortsha-or-buildid>`

### 3.3 Promotion rule

Promotions are monotonic:

1. canary -> beta only after QA gate pass
2. beta -> stable only after release sign-off + metrics gate

No direct canary -> stable promotion.

---

## 4) End-to-End Release Procedure

## 4.1 Preflight Checklist (must pass)

1. CI green on target commit
2. Security checks green (dependencies, signing secrets available)
3. Release notes draft prepared
4. Store metadata readiness checked (if user-visible changes)
5. Rollback decision documented (previous known-good version per platform)

## 4.2 Trigger release

Use GitHub Actions workflow `Release` (`.github/workflows/release.yml`) with explicit platform flags:

- desktop_macos / desktop_windows / desktop_linux
- mobile
- optional `ios-app-version`
- optional `ios-release-to-appstore`
- optional `android-promote-track` (`none|alpha|beta|production`)
- optional `android-rollout-fraction` (`0.01-1.0`)
- optional `desktop-rollout-percentage` (rollout metadata)

## 4.3 Verify platform outputs

### Desktop

- GitHub release contains all expected artifacts per target platform
- `latest*.yml` files are attached and match artifact checksums
- app-side updater detects channel update in smoke test

### iOS

- build appears in TestFlight
- install and smoke test on real device

### Android

- AAB uploaded to Play internal track as draft
- internal testers can fetch build after publishing track edit

## 4.4 Post-release verification window

Within first 2 hours:

- monitor crash rate, startup failures, auth/login success, sync health
- verify update download/installation success signals on desktop
- if regression threshold exceeded: execute rollback section immediately

---

## 5) Rollback / Freeze Playbook

## 5.1 Desktop rollback

1. Mark problematic release as not promoted for target channel
2. Re-point release channel to previous known-good tag (latest release ordering and channel filtering)
3. Publish hotfix release if needed with incremented version
4. Communicate update freeze to support/ops

## 5.2 iOS rollback

- If only TestFlight affected: stop tester rollout / expire build usage guidance
- If App Store release went out (future lane): submit expedited hotfix build

## 5.3 Android rollback

- halt production promotion (if not yet promoted)
- promote previous known-good artifact or ship hotfix with higher `versionCode`

## 5.4 Global freeze criteria

Trigger freeze when one is true:

- P0 crash / data corruption / auth lockout
- update install loop
- severe legal/compliance issue

---

## 6) Security and Compliance Controls

1. Signing keys and API credentials only via GitHub secrets / OIDC
2. Provenance attestations must remain enabled for release artifacts
3. No local/manual unsigned artifact publication
4. Release actor accountability: every production promotion requires named approver

---

## 7) Known Gaps and Recommended Hardening

Implemented in this iteration:

1. **iOS production lane**: `fastlane appstore` + `ios-appstore` CI job
2. **Android staged rollout automation**: `android-promote` CI job + rollout fraction input
3. **Desktop rollout gate**: dedicated approval gate with rollout metadata input
4. **Observability gate**: stable release Sentry release existence validation
5. **Formal go/no-go artifact**: JSON+MD artifact generated and uploaded per release

Remaining hardening opportunities:

1. **SLO-driven automatic rollback**
   - auto-trigger rollback/freeze on post-release KPI threshold breach
2. **Unified release dashboard**
   - central UI for status across GitHub, stores, crash metrics, and rollout phase

---

## 8) Definition of Done for "fully integrated update pipeline"

A platform release is "production-ready integrated" only when all are true:

- reproducible CI workflow exists and is documented
- signed artifacts generated and verifiable
- update/install path validated on real device/environment
- rollback path tested and documented
- ownership + approval + communication path defined

---

## 9) Quick Command Reference

- Generate release yml files (desktop release job):

```bash
node ./scripts/generate-release-yml.mjs
```

- Primary workflow trigger point:

`GitHub Actions -> Release`

- Main docs for release operators:

- `docs/UPDATE-PIPELINE-RUNBOOK.md` (this file)
- `.windsurf/workflows/release-update-pipeline.md`
