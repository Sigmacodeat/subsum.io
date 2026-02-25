# Chatbot Widget Audit & GAP-Analyse (State of the Art)

## Scope

- Frontend chatbot widget (Marketing App)
- Antwortqualität, UX-Flow, Accessibility, Interaktionslogik
- Datei: `packages/frontend/apps/marketing/src/components/chatbot-widget.tsx`

## Phase 1 – System Blueprint

### 1) Ziel (User-Sicht)

Der Nutzer soll im Chat in < 1 Minute zur richtigen nächsten Aktion geführt werden (Demo, Trial, Pricing, API, Support), mit klaren Antworten, robustem Verhalten und barrierearmer Bedienung.

### 2) Kern-Userflows

1. **Beginner**: Widget öffnen → Rolle wählen → klare nächste Aktion ausführen.
2. **Normal**: freie Frage tippen → Intent wird erkannt → zielgerichtete Antwort + CTA.
3. **Power User**: API/Support/Pricing-Fragen mit Kontext → schnelle Navigation/externe Links/Flow-Start.

### 3) UI-Elemente & Interaktionen

- Klick: Open/Close, Quick Actions, Show More/Less, Send
- Keyboard: Enter Submit, Escape Close, Focus Trap im Dialog
- Focus: Return Focus zum Launcher beim Schließen
- Hover: CTA-Buttons mit visuellem Feedback
- Mobile: Full-height Panel mit stabilen Input-/Message-Bereichen

### 4) Datenmodell & State

- Session-Persistenz (`sessionStorage`) für persona/isOpen/messages
- UI-State: `isOpen`, `messages`, `persona`, `activeFlow`, `isTyping`, `expandedActions`
- Neu verbessert: Queue-State für Bot-Nachrichten über Refs

### 5) Architektur-Entscheidungen

- Regelbasierte Intent-Erkennung + Scoring statt nur First-Match
- Priorisierung über Page-Context + Persona
- Fallback-Antworten mit konkreten Top-Optionen statt generischer Einzeiler

### 6) Edge Cases & Fehler

- Leere/zu lange Eingaben (Limit + Trim)
- Mehrere pending Bot-Timer (Race- und Unmount-safe)
- Fokusverlust bei Dialog-Handling
- Ambige Eingaben: Scoring + CTA-basiertes Fallback

### 7) Definition of Done

- Intent-Erkennung robuster als vorher
- Fallback führt immer zu 2–3 konkreten nächsten Schritten
- Dialog keyboard-barrierearm (Trap + Focus Return + Live-Region)
- Keine Lint-Fehler auf der geänderten Datei

---

## Phase 2 – GAP-Analyse (vorher → nachher)

### A) Antwortqualität

- **Vorher:** Regel-Loop mit erstem Treffer; schwache Ambiguitätsbehandlung.
- **Jetzt:** Intent-Scoring + Kontextbias (Seite/Persona) + Greeting/Thanks-Sonderfälle.
- **Impact:** Höhere Relevanz und weniger Fehlklassifikation.

### B) Fallback-Qualität

- **Vorher:** Nur kurzer Fallback-Text.
- **Jetzt:** Fallback enthält priorisierte Top-CTAs als Bullet-Liste.
- **Impact:** Besserer Recovery-Flow, weniger Sackgassen.

### C) Chat-Workflow/Robustheit

- **Vorher:** Typing-Status potenziell fehleranfällig bei mehreren pending Antworten.
- **Jetzt:** Queue-basiertes Pending-Handling + Cleanup aller Timer beim Unmount.
- **Impact:** Stabileres Verhalten bei schnellen Interaktionen.

### D) Accessibility

- **Vorher:** Keine vollständige Fokus-Rückführung / kein Fokus-Trap / kein ARIA-Log.
- **Jetzt:** Fokus-Trap im offenen Dialog, Fokus-Restore zum Trigger, `role="log"` + `aria-live` + `aria-busy`.
- **Impact:** Bessere Keyboard- und Screenreader-Nutzbarkeit.

### E) Input UX

- **Vorher:** Enter + Button konnten doppelte Trigger begünstigen.
- **Jetzt:** Form-Submit als Single-Source, Input-Limit, besseres Labeling.
- **Impact:** Konsistenteres Submit-Verhalten.

---

## Phase 3 – Umgesetzte Maßnahmen (Code)

- `MAX_INPUT_LENGTH`, Greeting/Thanks-Pattern, robustere Intent-Analyse
- `buildFallbackReply()` mit Bullet-CTAs
- Pending Queue (`pendingBotMessagesRef`) + Timeout Cleanup
- Focus Trap + Focus Return
- Message Area als Live Log für A11y
- `whitespace-pre-line` für bessere Lesbarkeit von Antworten
- Formular-basierter Submit mit `type="submit"`

---

## Phase 4 – Selbst-Audit

### Check: „Was kann Nutzer noch nicht tun?“

- Kein echter LLM-Backchannel im Marketing-Widget (ist derzeit gewollt, regelbasiert).
- Keine Feedback-/Rating-Schleife pro Antwort.

### Check: Tote UI-Elemente?

- Keine identifiziert; alle Action-Buttons führen zu Intent/Navigation/Flow.

### Check: Inkonsistenzen?

- Kein funktionaler Bruch erkannt.
- Typing-Status jetzt konsistent bei mehreren Antworten.

### Check: Erstnutzer-Fail-Risiko?

- Deutlich reduziert durch bessere Fallbacks + klarere CTAs.

---

## Phase 5 – Edge-Case/Stress-Test (manuell empfohlen)

1. Sehr schnelles Mehrfachsenden hintereinander.
2. Nur Gruß/Thanks/unklare Eingaben.
3. Keyboard-only Navigation (Tab/Shift+Tab/Escape/Enter).
4. Mobile Viewport (kleine Höhe, Onscreen-Keyboard).

---

## Phase 6 – Finaler System-Audit

**Status:** `PRODUKTIONSREIF (für aktuellen regelbasierten Scope)`

### Verbleibende Next-Level Optionen (SOTA+)

1. Telemetrie pro Intent/CTA (CTR, Drop-off, false-intent rate)
2. Answer Policy Layer (Brevity/Structure/Tone pro Persona)
3. RAG-/LLM-Hybrid für freie Fragen mit Confidence-Gate
4. Automated Widget E2E (Playwright) für Keyboard + Mobile + Restore Session
