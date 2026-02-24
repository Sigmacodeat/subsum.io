# Cross-Device GAP Report: Fristen/Termine Parity

## Scope
- Desktop (Web/Desktop shell)
- Mobile Web (phone/tablet)
- iOS/Android apps (Capacitor using mobile router/pages)

## Target (1:1)
All users should have the same workflow entry points and core functionality for:
- Fristen
- Termine
- Critical urgency highlighting

---

## GAP Matrix

| Area | Before | Gap | Status |
|---|---|---|---|
| Mobile route `/fristen` | Missing | Fristen workflow unreachable on mobile surfaces | Fixed |
| Mobile route `/termine` | Missing | Termine workflow unreachable on mobile surfaces | Fixed |
| Mobile tab entry: Fristen | Missing | No direct access from mobile app tabs | Fixed |
| Mobile tab entry: Termine | Missing | No direct access from mobile app tabs | Fixed |
| Termine critical style mapping | Reused overdue styles | `<48h` not visually distinct as critical alarm | Fixed |
| Fristen critical style mapping | Added | Needed shared consistency check with Termine | Fixed |

---

## Implemented Changes

1) Added mobile workbench routes for parity:
- `/fristen`
- `/termine`

2) Added mobile page adapters to reuse full desktop Fristen/Termine workflow:
- `mobile/pages/workspace/fristen.tsx`
- `mobile/pages/workspace/termine.tsx`

3) Added direct mobile tab access to Fristen/Termine:
- app-tabs data updated

4) Corrected Termine urgency class mapping:
- `critical` now maps to dedicated `fristRowCritical` and `dueDateCritical`

---

## Files Changed
- `packages/frontend/core/src/mobile/workbench-router.ts`
- `packages/frontend/core/src/mobile/pages/workspace/fristen.tsx`
- `packages/frontend/core/src/mobile/pages/workspace/termine.tsx`
- `packages/frontend/core/src/mobile/components/app-tabs/data.tsx`
- `packages/frontend/core/src/desktop/pages/workspace/all-termine/all-termine.tsx`

---

## Acceptance Criteria
- Mobile routes `/fristen` and `/termine` open successfully.
- Fristen/Termine are reachable from mobile app tabs.
- Critical urgency (`<48h`) is visually distinct from overdue and soon.
- Core actions remain available across surfaces (open/filter/sort/bulk-actions where provided by shared page).

---

## Remaining Optional Work (not blocker)
- Dedicated native-mobile visual treatment for Fristen/Termine pages (currently functional parity via shared desktop page components).
- Add explicit e2e assertions for `/fristen` and `/termine` on mobile route set.
