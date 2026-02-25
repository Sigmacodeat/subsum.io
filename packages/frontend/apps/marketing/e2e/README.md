# Chatbot Widget E2E Tests

## Ziel

Automatisierte End-to-End-Tests für das Chatbot-Widget im Marketing-Frontend. Fokus: Accessibility, Mobile, Session-Restore, Keyboard-Workflow und Robustheit.

## Vorbereitung

```bash
yarn install
yarn dev  # in einem Terminal (Next.js auf Port 3000)
```

## Tests ausführen

```bash
# Alle Tests (Chromium + Mobile + Firefox)
yarn e2e

# Nur Chromium
yarn e2e --project chromium

# UI-Modus (interaktiv)
yarn e2e:ui

# Debug-Modus (breakpoints)
yarn e2e:debug
```

## Test-Szenarien

- ✅ Öffnen, Willkommensnachricht, Rollenauswahl
- ⌨️ Keyboard-Only: Focus Trap, Escape, Return Focus
- 💬 Nachricht senden + Bot-Antworten mit CTAs
- 👋 Gruß-Erkennung (Hallo) → kontextbezogene Antwort
- 🙏 Danke-Erkennung → Support-CTAs
- 🧩 Fallback mit Bullet-Optionen bei Unknown Input
- 🚫 Input-Limit + Leereingabe-Block
- 🏃 Schnelles Mehrfachsenden ohne Race Conditions
- 📱 Mobile Viewport + Onscreen-Keyboard
- 🔄 Session-Restore nach Reload
- 📋 Action-Liste Expand/Collapse (>3 Aktionen)
- ♿ Screenreader-Attribute (role=log, aria-live, aria-busy)

## Hinweise

- Tests laufen gegen `http://localhost:3000/de-AT`
- Im CI werden Tests headless und mit Retries ausgeführt
- Bei Fehlern: Screenshots, Videos und Traces werden gespeichert
