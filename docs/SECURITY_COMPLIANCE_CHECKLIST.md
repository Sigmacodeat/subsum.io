# Legal Ops CoPilot Security & Compliance Checklist (v1)

## A) Data handling

- [ ] Case data is scoped by workspace ID.
- [ ] Sensitive fields are not logged in plaintext.
- [ ] Connector payloads contain only required fields.
- [ ] Error messages shown to UI avoid secret leakage.

## B) Connector security

- [x] Connector endpoints are configurable per workspace.
- [x] Auth tokens are not hardcoded in source.
- [x] Secrets are encrypted and stored in workspace-scoped connector secret storage.
- [x] Healthchecks do not expose credentials.

## C) Auditability

- [ ] Every connector action appends audit entry.
- [ ] Every queue status change appends workflow event.
- [ ] Failed actions include actionable reason.
- [ ] Audit retention limits are defined and documented.

## D) Job execution safety

- [ ] Jobs support cancel and retry.
- [ ] Failed jobs do not corrupt case graph state.
- [ ] Queue writes are idempotent per job ID.
- [ ] Retry paths are bounded (no infinite loops).

## E) Access & permissions (next hardening)

- [x] Add role checks before connector mutate actions.
- [x] Add role checks for mail dispatch.
- [ ] Add workspace-level policy for allowed connectors.
- [ ] Add explicit permission gates for bulk actions.

## F) Legal/Compliance expectations

- [x] Immutable-orientierter Audit-Export verfügbar (JSON/CSV mit Hash-Chain je Eintrag).
- [ ] Data retention and deletion policy documented.
- [ ] E-mail dispatch includes opt-in/legal basis checks.
- [ ] External automation flow is traceable per case.

## G) QA gates before production

- [ ] E2E tests: enable connector -> healthcheck -> dispatch -> audit event.
- [ ] E2E tests: job queue lifecycle queued->running->completed/failed.
- [ ] Load test with concurrent ingestion requests.
- [ ] Chaos test for connector timeouts and unavailable endpoints.

## H) Current status snapshot

Implemented now:

- Connector + queue + audit/workflow persistence
- Connector healthcheck and dispatch stubs
- Retry/cancel controls in UI
- Encrypted workspace-scoped connector secret storage (separate from ConnectorConfig)
- Credential metadata visibility in UI (`updatedAt`) with rotation recommendation
- RBAC baseline for connector/job actions with deny-audit trail (`viewer`/`operator`/`admin`/`owner`)
- Audit export actions (JSON/CSV) with per-entry chain hashes (`previousHash`, `chainHash`)
- Audit verify action against persisted export anchors (scope-based integrity check)
- Legal-Copilot workflow actions RBAC-guarded (`document.*`, `copilot.execute`, `folder.*`) with audit deny traces

Still required for production-grade compliance:

- Authn/Authz enforcement
- Server-side immutable audit storage/export endpoint (WORM/signature authority)
- External secret backend integration (keychain/KMS/HSM) for enterprise deployments
- E2E compliance test suite
- Formal retention/erasure workflows
