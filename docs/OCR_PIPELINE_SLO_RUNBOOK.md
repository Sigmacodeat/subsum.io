# OCR Pipeline SLO Runbook (Case Assistant)

> Production runbook for OCR reliability, stall recovery, telemetry quality, and incident response.

## 1) Scope

This runbook covers OCR operations in Case Assistant for:

- OCR queue execution (`processPendingOcr`)
- Stale job watchdog and auto-fail behavior
- Timeout behavior (job-level and stage-level)
- Structured failure telemetry and audit trails
- Go/No-Go production quality gates and incident triage

Primary implementation references:

- `packages/frontend/core/src/modules/case-assistant/services/legal-copilot-workflow.ts`
- `packages/frontend/core/src/modules/case-assistant/__tests__/legal-copilot-workflow.spec.ts`

---

## 2) Reliability architecture (as implemented)

### 2.1 Concurrency safety

- Per-case mutex prevents concurrent OCR runs for the same case:
  - `_runningOcrCases.has(caseId)` gate
  - avoids duplicate writes and queue races

### 2.2 Timeout hardening

Current timeout controls:

- `REMOTE_OCR_TIMEOUT_MS = 45_000`
- `OCR_JOB_TIMEOUT_BASE_MS = 90_000`
- `OCR_JOB_TIMEOUT_PER_PAGE_MS = 20_000`
- `OCR_JOB_TIMEOUT_MAX_MS = 8 * 60_000`
- `OCR_TEXT_LAYER_TIMEOUT_MS = 45_000`
- `OCR_POSTPROCESS_TIMEOUT_MS = 75_000`

Result: single-stage stalls are bounded and fail fast into recoverable job failure paths.

### 2.3 Watchdog + stale reaper behavior

Stale thresholds:

- Running stale threshold: `15 min`
- Queued stale threshold: `30 min`

Watchdog effects:

- stale OCR jobs are auto-marked `failed`
- corresponding document is marked `failed`
- audit entry `document.ocr.stale_job_failed` is written with stale metadata (`ageMs`, `thresholdMs`, heartbeat timestamps)

### 2.4 Failure isolation

- Job failures are isolated in per-job `try/catch`
- batch continues on crash/timeout of one document
- partial failures are explicitly audited (`document.ocr.partial_failure`)

### 2.5 Structured telemetry

Failure telemetry includes:

- `failureCode` (e.g. timeout/network/crash class)
- `errorSignature` (grouping)
- `stage`, `engine`, `documentId`, `jobId`, `ocrRunId`
- timing fields (`startedAt`, `failedAt`)

---

## 3) Operational SLOs (hard targets)

### 3.1 Batch completion SLO

- Target: `>= 99%` OCR runs finish within 15 minutes
- (finish means all jobs become completed/failed/cancelled, not stuck)

### 3.2 Stall-free SLO

- Target: `stuck_jobs_after_20min = 0`
- Any non-terminal OCR job beyond 20 minutes is an SLO breach

### 3.3 Recovery continuity SLO

- Target: `>= 99.5%` of runs continue processing after one job crash/timeout

### 3.4 Telemetry completeness SLO

- Target: `100%` of failed OCR jobs have non-empty:
  - `failureCode`, `stage`, `documentId`, `engine`, `ocrRunId`
- Minimum acceptable floor: `99%`

### 3.5 Latency SLO

- Target: p95 OCR job duration `< 120s`
- Target: p99 OCR job duration `< 300s`
- Evaluate with size/page normalization where applicable

---

## 4) Alert policy (severity mapping)

### SEV-1 (immediate page)

1. `stuck_jobs_after_20min > 0`
2. `batch_abort_rate > 0.5%` in rolling 30m
3. `telemetry_completeness < 98%` in rolling 30m

### SEV-2 (respond within 30m)

1. `ocr_timeout_rate > 5%` in rolling 1h
2. `stale_watchdog_trigger_rate > 3%` in rolling 1h
3. `p95_duration > 120s` sustained for 2h

### SEV-3 (backlog optimization)

1. local fallback ratio increases above 20% over 24h baseline
2. OCR quality median drops by >10 points over 24h baseline

---

## 5) Go/No-Go gate for production

## GO only if ALL are true

- [ ] 72h soak window completed
- [ ] `stuck_jobs_after_20min = 0`
- [ ] Batch completion SLO met (`>= 99%`)
- [ ] Recovery continuity SLO met (`>= 99.5%`)
- [ ] Telemetry completeness `>= 99%`
- [ ] No unresolved SEV-1 in last 24h
- [ ] Timeout + stale watchdog paths validated with representative problematic files

## NO-GO if ANY are false

- Freeze rollout
- Keep OCR available only with guarded mode (if policy requires)
- Open incident and run mitigation below

---

## 6) Incident triage and mitigation

### Symptom: progress hangs around ~10%

Checklist:

1. Check whether stuck jobs are terminalized by watchdog within threshold.
2. Inspect recent audit entries for:
   - `document.ocr.stale_job_failed`
   - `document.ocr.failed`
   - `document.ocr.partial_failure`
3. Verify failure code distribution (`ocr_timeout`, network, crash class).
4. Confirm batch summary logs still show progressing completed counts.
5. Validate retries do not create duplicate active jobs for same document.

Immediate mitigation:

- keep batch execution active (do not globally stop OCR)
- isolate failing docs, mark failed, continue remaining queue
- if timeout spike is external-provider related, prioritize local fallback path

### Symptom: many timeout failures in short interval

Checklist:

1. Compare remote OCR availability and latency with baseline.
2. Verify endpoint/config present and residency policy permits remote OCR.
3. Inspect timeout stages (text-layer vs full OCR vs postprocess).

Immediate mitigation:

- throttle remote dependence where feasible
- keep local-first behavior for binary payloads
- maintain audit traceability for all failed docs

### Symptom: failures not diagnosable

Checklist:

1. Sample failed jobs and verify required metadata fields exist.
2. Confirm `failureCode` and `errorSignature` are populated.
3. Confirm stage and engine fields are non-empty.

Immediate mitigation:

- treat as SEV-1 telemetry outage if completeness drops below floor
- patch telemetry before scaling traffic

---

## 7) Verification commands

From repository root:

```bash
yarn vitest run packages/frontend/core/src/modules/case-assistant/__tests__/legal-copilot-workflow.spec.ts
```

Optional targeted lint check:

```bash
yarn eslint packages/frontend/core/src/modules/case-assistant/services/legal-copilot-workflow.ts packages/frontend/core/src/modules/case-assistant/__tests__/legal-copilot-workflow.spec.ts
```

---

## 8) Escalation policy

1. SEV-1: page on-call immediately, open incident channel, publish initial status in <= 15m.
2. SEV-2: assign owner within 30m, mitigation ETA <= 2h.
3. SEV-3: create backlog issue with trend analysis and optimization proposal.

Post-incident mandatory outputs:

- root cause narrative
- metric deltas vs SLO
- corrective action list (owner + deadline)
- regression test additions where applicable

---

## 9) Definition of done (operational)

This runbook is considered operationally complete when:

- all SLO metrics are observable in dashboards/log queries
- alert routing exists for SEV-1/2 thresholds
- on-call can execute triage checklists without code changes
- weekly review validates SLO adherence and trend direction
