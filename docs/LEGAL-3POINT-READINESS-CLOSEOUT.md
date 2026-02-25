# Legal 3-Point Readiness Closeout

This document closes the 3 open readiness points for the legal workspace flows.

## Scope

1. E2E regression coverage for:
   - All Pages bulk selection / select-all / clear-all
   - Journal sidebar legal calendar rendering
   - No legacy document activity block in journal sidebar
2. Production-like load and failure scenarios
3. Real-world law-firm validation checklist (operator UAT)

---

## 1) E2E Regression Coverage

### Implemented tests

- `tests/affine-local/e2e/all-page.spec.ts`
  - `all page supports select mode toggle with select-all and clear-all`
  - Verifies:
    - Enter select mode from header toggle
    - Checkbox rendering for all visible docs
    - Select-all marks all visible docs selected
    - Second click clears all selection

- `tests/affine-local/e2e/journal-legal-events-smoke.spec.ts`
  - `journal sidebar renders legal calendar events block (empty-state smoke)`
  - Added regression checks:
    - No `Created` button
    - No `Updated` button

### Recommended CI target subset

```bash
yarn playwright test tests/affine-local/e2e/all-page.spec.ts
yarn playwright test tests/affine-local/e2e/journal-legal-events-smoke.spec.ts
```

---

## 2) Production-like Load & Failure Scenarios

Run these scenarios before release.

### A. High-volume All Pages selection

**Goal:** UI remains responsive with large visible document sets.

- Seed/prepare workspace with >= 500 docs
- Open All Pages
- Enter select mode
- Select-all, clear-all, repeat 10x
- Trigger bulk delete confirm (cancel and confirm branches)

**Pass criteria**

- No browser crash or frozen UI
- No missing selection state updates
- Confirm dialog text/count always matches selected count

### B. Journal sidebar under mixed legal data load

**Goal:** Calendar and legal events block remain stable with many deadlines/termine.

- Seed >= 300 deadlines and >= 150 termine across 90 days
- Open journal sidebar and move calendar cursor across months
- Expand/collapse legal sections repeatedly

**Pass criteria**

- Sidebar renders within acceptable UX time budget
- No duplicated section items
- Dot markers reflect legal data (not document activity)

### C. Failure-path verification

**Goal:** App behavior under service errors/partial data.

- Simulate failed legal data seeding / unavailable graph segments
- Open journal sidebar and All Pages selection flows

**Pass criteria**

- No uncaught runtime exceptions
- Empty states shown gracefully
- Selection mode can always be exited via Cancel/Escape

---

## 3) Law-Firm UAT Checklist (Live Validation)

Use this script with a legal operator (beginner + power user).

### Workflow 1: Deadline-first day planning

- Open Journal sidebar
- Confirm legal events block visibility
- Confirm no document activity controls (`Created`/`Updated`)
- Open a deadline item and verify linked matter context

### Workflow 2: Court appointment handling

- Verify a termin appears on the expected day
- Expand section via click and keyboard
- Navigate from item to matter/workflow context

### Workflow 3: Bulk cleanup in All Pages

- Enter select mode from header button
- Select-all, then clear-all
- Select a subset and execute bulk delete (with confirmation)

### Workflow 4: Error resilience

- Repeat Workflow 3 quickly (fast clicking)
- Verify no stuck selection state
- Verify Escape and Cancel always recover to clean state

### Sign-off template

For each workflow, capture:

- Result: PASS / FAIL
- Operator notes
- Repro steps for any failure
- Severity (Blocker / Major / Minor)

Release is **GO** only if no blocker remains.
