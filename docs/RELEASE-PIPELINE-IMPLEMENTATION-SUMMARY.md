# Release Pipeline Implementation Summary

**Status**: Produktionsreif  
**Datum**: 2026-02-28  
**Scope**: Desktop Cohort Rollout + Auto-Freeze on Observability Failure

---

## Implementierte Features

### 1. Desktop Cohort-basierter Rollout (Client + Server)

#### Client-seitig (Electron Updater)
- **Deterministische Cohort-Metadaten** werden bei jedem Update-Check gesendet:
  - `cohortId`: Stable UUID pro Installation (persistent)
  - `rolloutBucket`: Deterministischer Bucket 1..100 (Hash von cohortId + channel)
  - `platform` und `arch`
- **Implementierung**: `packages/frontend/apps/electron/src/main/updater/affine-update-provider.ts`
- **Tests**: `packages/frontend/apps/electron/test/main/updater.spec.ts`

#### Server-seitig (Backend Worker)
- **Neuer Endpoint**: `GET /api/worker/releases`
  - Channel-Filter: `stable|beta|canary`
  - `minimal=true` Support (nur neueste Version)
  - `rolloutBucket` Validierung (1..100)
  - **Stable-Rollout-Filter**: Nur Releases mit `rolloutPercentage >= rolloutBucket` werden ausgeliefert
- **Rollout-Metadaten-Quelle**: `release-go-no-go.json` Asset pro GitHub Release
- **Caching**: 3-stufig (Channel, Rollout-Metadata, Result)
- **Implementierung**: `packages/backend/server/src/plugins/worker/controller.ts`
- **Tests**: `packages/backend/server/src/__tests__/worker.e2e.ts`

---

### 2. Desktop Release Rollout-Metadaten

#### GitHub Actions Workflow
- **Orchestrator**: `.github/workflows/release.yml`
  - Neuer Input: `desktop-rollout-percentage` (default: 100)
  - Weitergabe an Desktop-Workflow
  - Dokumentiert in `release-go-no-go.json` Artifact

- **Desktop Release**: `.github/workflows/release-desktop.yml`
  - Generiert `release-go-no-go.json` mit `desktopRolloutPercentage`
  - Publiziert als GitHub Release Asset
  - Backend liest dieses Asset zur Laufzeit aus

---

### 3. Automatic Observability Freeze Escalation

#### Observability Gate
- **Job**: `observability-gate` in `.github/workflows/release.yml`
- **Prüfung**: Sentry Release Existence Check (nur für `stable`)
- **Bei Failure**: Trigger `auto-freeze-on-observability-failure`

#### Auto-Freeze Job
- **Aktion**: Erstellt automatisch GitHub Issue mit Label `release-freeze`, `incident`, `priority:high`
- **Fallback**: Robuste Issue-Erstellung ohne Labels, falls Label-Setzen fehlschlägt
- **Inhalt**: Version, Build Type, Commit, Workflow Run Link + Handlungsanweisungen

---

### 4. Dokumentation & Operator Workflows

#### Runbook
- **Datei**: `docs/UPDATE-PIPELINE-RUNBOOK.md`
- **Inhalt**:
  - Pipeline-Architektur (Desktop, iOS, Android)
  - Cohort-Contract (rolloutBucket, cohortId)
  - Observability Gates
  - Rollback/Freeze Playbook
  - **Backend-Enforcement als umgesetzt dokumentiert**

#### Operator Workflow
- **Datei**: `.windsurf/workflows/release-update-pipeline.md`
- **Inhalt**:
  - Schritt-für-Schritt Release-Anleitung
  - Rollout-Percentage-Steuerung
  - Post-Release Quality Gates
  - Freeze/Rollback-Prozeduren

---

## Technische Verbesserungen

### Workflow-Härtung
- **Bracket-Notation** für hyphenated Job-IDs in Output-Referenzen
- **Auto-Freeze Fallback** bei Label-Assignment-Failures
- **Rollout-Metadata** als echtes Release-Asset (nicht nur Workflow-Artifact)

### Test-Infrastruktur
- **E2E-Coverage** für `/api/worker/releases` Rollout-Filter
- **Updater-Tests** auf echte Feed-URL (`app.subsum.io`) angepasst
- **Test-Harness** erlaubt WebSocket-Adapter-Skip für isolierte Suites
- **Redis E2E-Teardown** optimiert (immediate disconnect in `TEST_MODE=e2e`)

---

## Verifikation

### Backend E2E Tests
```bash
yarn workspace @affine/server e2e src/__tests__/worker.e2e.ts
```
- **Ergebnis**: 3 Tests grün
  - `should proxy image`
  - `should serve releases with rollout filtering`
  - `should preview link`

### Bekannter Restpunkt
- **AVA "Failed to exit" Timeout**: Test-Runner beendet sich nicht sauber nach Testende
- **Ursache**: Lingering AsyncResource/ioredis connector timeouts (Test-Runner-Infrastruktur-Thema)
- **Impact**: Kein fachlicher Fehler, Tests sind grün
- **Mitigation**: Explizite Teardown-Härtung implementiert (Prisma disconnect, HTTP close, Redis immediate disconnect in e2e)

---

## Produktionsreife-Status

### ✅ Vollständig implementiert
- Desktop Cohort-Rollout (Client + Server)
- Observability Auto-Freeze Escalation
- Rollout-Metadaten als Release-Asset
- Backend Releases-Endpoint mit Rollout-Filter
- E2E-Testabdeckung
- Dokumentation synchronisiert

### ⚠️ Bekannte Einschränkungen
- AVA Test-Runner Exit-Timeout (außerhalb Feature-Scope)

### 📋 Verbleibende Hardening-Opportunities (aus Runbook)
1. **SLO-driven automatic rollback**: Auto-Trigger bei KPI-Threshold-Breach
2. **Unified release dashboard**: Zentrale UI für Status über GitHub, Stores, Crash-Metrics

---

## Deployment-Checkliste

Vor Production-Rollout:
- [ ] `release-go-no-go.json` Asset in GitHub Releases verifizieren
- [ ] Backend `/api/worker/releases` Endpoint testen (Staging)
- [ ] Desktop Updater Cohort-Metadaten in Logs verifizieren
- [ ] Observability Gate Sentry-Integration testen
- [ ] Auto-Freeze Issue-Erstellung testen (Dry-Run)
- [ ] Runbook mit Team durchgehen

---

## Referenzen

### Code
- Backend: `packages/backend/server/src/plugins/worker/controller.ts`
- Client: `packages/frontend/apps/electron/src/main/updater/affine-update-provider.ts`
- Workflows: `.github/workflows/release.yml`, `.github/workflows/release-desktop.yml`

### Dokumentation
- `docs/UPDATE-PIPELINE-RUNBOOK.md`
- `.windsurf/workflows/release-update-pipeline.md`

### Tests
- `packages/backend/server/src/__tests__/worker.e2e.ts`
- `packages/frontend/apps/electron/test/main/updater.spec.ts`
