---
description: State-of-the-art release and update pipeline for desktop, iOS, and Android
---
# Workflow: Release / Update Pipeline

Use this workflow whenever you ship desktop/mobile updates or need to verify readiness.

## 1. Preflight

1. Confirm branch/tag and target channel (`canary`, `beta`, `stable`).
2. Confirm all required secrets are present (Apple, Google Play, signing certificates).
3. Confirm CI is green on release candidate commit.
4. Confirm rollback target version per platform is documented.

## 2. Trigger release orchestrator

1. Open GitHub Actions workflow: `.github/workflows/release.yml`.
2. Run `workflow_dispatch` with explicit flags:
   - `desktop_macos`, `desktop_windows`, `desktop_linux`
   - `mobile`
   - optional `ios-app-version`
   - optional `ios-release-to-appstore`
   - optional `android-promote-track`
   - optional `android-rollout-fraction`
   - optional `desktop-rollout-percentage`
3. Ensure `Prepare` and `Canary Gate` jobs succeed first.
4. Ensure `Release Readiness Artifact` and `Desktop Rollout Gate` complete before platform release jobs.

## 3. Verify desktop artifacts and update metadata

1. Ensure `release-desktop.yml` completed successfully for all selected targets.
2. Verify release assets include platform binaries + `latest.yml` / `latest-mac.yml` / `latest-linux.yml`.
3. Verify hashes/checksums are present and signed artifacts are published.
4. Smoke test desktop updater on one device per platform/channel.
5. Confirm updater request includes `cohortId`, `rolloutBucket`, `platform`, and `arch` query params.

## 4. Verify iOS pipeline

1. Ensure `release-mobile.yml` iOS jobs succeeded.
2. Confirm build appears in TestFlight.
3. If enabled, verify `ios-appstore` job uploaded App Store candidate.
4. Install build on real iOS device and run auth + sync + editor smoke tests.

## 5. Verify Android pipeline

1. Ensure `release-mobile.yml` Android job succeeded.
2. Confirm AAB uploaded to Play internal track (draft/edit).
3. If enabled, ensure `android-promote` moved release to target track.
4. Validate install/update from internal/target test track on real Android device.

## 6. Post-release quality gate

1. Watch first 2 hours for crash spikes, login/auth failures, update-install errors.
2. If critical regression appears:
   - freeze promotion
   - execute rollback/hotfix flow
3. If `observability-gate` fails on stable release:
   - `auto-freeze-on-observability-failure` will open a release freeze incident issue
   - treat rollout as frozen until issue is resolved and re-release decision is documented

## 7. Rollback/hotfix

1. Desktop: point users to last known-good release channel artifact and publish hotfix.
2. iOS: stop TestFlight rollout / ship fixed build.
3. Android: stop promotion; publish higher-versionCode hotfix.
4. Communicate status and ETA internally.

## 8. Release completion

Mark release as complete only if:

- artifacts are signed and verifiable
- update path works on real devices
- rollback path is available
- release notes and operator handoff are done
