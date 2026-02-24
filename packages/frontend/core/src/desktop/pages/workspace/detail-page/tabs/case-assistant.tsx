// ─── Public entry point ───────────────────────────────────────────────────────
// All implementation lives in ./case-assistant/ (modular sub-folder).
// This file is intentionally kept as a thin re-export so that all existing
// imports (e.g. detail-page.tsx) continue to resolve without any changes.
//
//   ./case-assistant/panel.tsx       ← EditorCaseAssistantPanel (component + hooks)
//   ./case-assistant/panel-types.ts  ← local types + constants
//   ./case-assistant/utils.ts        ← pure helper functions

export { EditorCaseAssistantPanel } from './case-assistant/panel';
