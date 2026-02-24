# Case Assistant Runbook (Legal Ops CoPilot)

## Scope
This runbook covers the operational path for:

- Case ingestion jobs
- Connector operations (Paperless, n8n, Mail)
- Alerting and acknowledgements
- Basic incident triage

## 1) Local startup

1. Start AFFiNE frontend as usual.
2. Open a workspace document.
3. Open the `Case Assistant` sidebar tab.

> Server reminder: app runtime is expected on port `3000`.

## 2) First-time setup in UI

1. In Case Assistant, verify connector cards are visible:
   - Paperless-ngx
   - n8n Automation
   - Mail Gateway
2. Set role in the `Rolle` selector according to operation need:
   - `viewer`: read-only
   - `operator`: healthcheck, dispatch, rotate credential, queue cancel/retry
   - `admin`/`owner`: connector configuration, toggle enable, clear auth
3. For each connector, set:
   - Endpoint
   - Auth Type (`none` / `bearer` / `api-key`)
   - Header name (for `api-key`)
   - Rotation Tage (z. B. 30)
   - Rotation Modus (`soft` warnen / `hard` blockieren)
   - Credential in the secure credential field
4. Click `Save`.
5. Enable connector via `An` button.
6. Run `Check` healthcheck.
7. Validate status changes:
   - connected (healthy)
   - error (endpoint reachable issue / HTTP failure)
   - disconnected (disabled)

Notes:

- Credentials are stored encrypted per workspace in the connector secret store.
- `Clear Auth` removes the stored credential for that connector.
- If the UI shows `Rotation empfohlen`, replace the credential and save again.
- If the UI shows `Rotation fällig (..., Dispatch blockiert)` in `hard` mode, run
  `Rotate Now` before dispatch actions.
- If an action is denied by role, UI shows an explicit deny message and an audit
  entry is written with required/current role.

## 3) Ingestion operations

### Quick ingestion

1. Choose mode:
   - Selektion
   - Ganze Seite
2. Click `Schnellanalyse`.
3. Validate:
   - Case summary updates
   - Queue item created and status transitions
   - Alerts update after sync

### Queue actions

- `Abbrechen` allowed for queued/running jobs.
- `Retry` allowed for failed/cancelled jobs.

## 4) Automation actions

Use action buttons in `Automation Actions`:

- `Paperless Ingest`
- `n8n Dispatch`
- `Mail Dispatch`
- `Audit Export JSON`
- `Audit Export CSV`
- `Audit Verify`

Expected behavior:

- Action result appears in status message
- Workflow/Audit entries are appended
- Audit exports include chained hashes (`previousHash`, `chainHash`) per entry.
- `Audit Verify` prüft die aktuelle Kette gegen den letzten Export-Anker für den Scope.

RBAC note:

- Audit export requires role `admin` or `owner`.
- Audit verify requires role `operator` (oder höher).
- Falls kein Anker vorhanden ist, zuerst `Audit Export JSON` oder `Audit Export CSV` ausführen.

## 5) Legal Copilot Workflow

Use section `Legal Copilot Workflow` in Case Assistant:

1. Fill intake fields (`Titel`, `Dokumenttyp`, `Folder Path`, `Tags`, `Intake Inhalt`).
2. Run `Document Intake`.
3. Run `Process OCR` for pending scan docs.
4. Run `Analyze Case` (or `Full Workflow` for intake + OCR + analysis in one flow).
5. Optional:
   - `Folder Search` for scoped document lookup
   - `Folder Summary` for aggregated legal summary per folder scope

Expected behavior:

- Findings, tasks and blueprint are generated and visible in workflow section.
- Audit trail includes `folder.search.*`, `folder.summarize.*`, `copilot.execute.*`.
- Status line reflects deny/empty/success states.

RBAC note:

- `document.upload`, `document.ocr`, `document.analyze`, `copilot.execute`, `folder.summarize`: `operator`+
- `folder.search`: `viewer`+

## 6) Incident triage

### Symptom: connector stays error

Checklist:

1. Confirm endpoint URL format (`http://...`, `smtp://...`).
2. Confirm remote service is running.
3. Confirm connector credential is set (Auth status not empty).
4. Run healthcheck again.
5. Inspect audit entries for latest connector action.

### Symptom: connector says missing credential

Checklist:

1. Enter credential in connector form.
2. Click `Save`.
3. Re-run `Check`.
4. Retry dispatch action.

### Symptom: dispatch blocked because credential rotation is due

Checklist:

1. Verify connector shows `Rotation fällig` and mode `hard`.
2. Enter fresh credential and click `Rotate Now`.
3. Optional: lower strictness to `soft` only if policy allows it.
4. Retry dispatch action and verify audit entry.

### Symptom: job stuck in running

Checklist:

1. Use `Abbrechen` on job.
2. Trigger `Retry`.
3. Re-run ingestion with shorter input.

### Symptom: no alerts

Checklist:

1. Ensure deadlines are present in case graph.
2. Confirm `DeadlineAlertService` polling is active in panel lifecycle.
3. Trigger ingestion and sync again.

## 7) Verification commands

From repository root:

```bash
yarn eslint packages/frontend/core/src/modules/case-assistant/**/*.ts packages/frontend/core/src/desktop/pages/workspace/detail-page/tabs/case-assistant.tsx
```

Module tests:

```bash
cd packages/frontend/core/src/modules/case-assistant
yarn vitest run --config vitest.local.config.ts
```

## 8) Recovery decision tree

1. Connector-level issue -> disable connector, keep case operations local.
2. Ingestion-level issue -> cancel + retry.
3. Persistent endpoint issue -> fallback to local case ingestion only, log audit entry.

## 9) Operational notes

- Connector action failures should never break local case state.
- Every connector or job action should produce traceable audit/workflow records.
- Keep queue size bounded; avoid unbounded retries.
