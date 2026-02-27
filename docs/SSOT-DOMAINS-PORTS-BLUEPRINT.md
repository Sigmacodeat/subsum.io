# SSOT Blueprint: Domains, Ports, Routing (Subsumio)

## 1) Ziel (aus User-Sicht)

- Als Nutzer will ich die **Kanzlei-SaaS** immer unter einer stabilen App-Domain erreichen (Login, Produkt, Daten): **`app.subsum.io`**.
- Als Interessent will ich die **Marketingseite** unter einer stabilen Website-Domain erreichen (SEO, Inhalte, Pricing): **`www.subsumio.com`**.
- Als Entwickler will ich lokal/CI/Staging **ohne Hardcodings** testen können; Tests sollen immer die richtige Oberfläche treffen.

---

## 2) Kern-Userflows

### Beginner

- **Marketing** öffnen (`www`) -> CTA „Anmelden/Registrieren“ -> Weiterleitung zur **App** (`app`) -> Login -> Workspace.

### Normal

- Nutzer ist eingeloggt in `app` -> arbeitet im Kanzlei-Workspace -> öffnet Kalender/Fristen/Termine -> Bulk-Selektion/Deletion.

### Power-User

- Multi-Tab, schnelles Klicken, Bulk-Aktionen, Keyboard (Escape), Range-Select (Shift).
- Staging/CI E2E laufen stabil gegen die korrekte `baseURL`.

---

## 3) UI-Elemente & Interaktionen (SSOT-relevant)

- **Marketing Header CTA**
  - Click: Navigiert zu `https://app.subsum.io/signIn` bzw. `.../signIn?redirect_uri=%2F&intent=signup`
- **App Login / Auth**
  - Cookie/Session nur auf `app.subsum.io`
- **E2E / QA**
  - Navigation in Tests erfolgt relativ (`page.goto('/')`, `page.goto('/404')`, ...)
  - Zielhost kommt ausschließlich aus Playwright `baseURL`.

---

## 4) Datenmodell & State-Management (SSOT-relevant)

- App und Marketing sind getrennte Deployments.
- Auth Sessions/Cookies dürfen nicht domain-wide (`.subsumio.com`) gesetzt werden.

---

## 5) Architektur-Entscheidungen

### SSOT Domains

- **App / SaaS (SSOT):** `app.subsum.io`
- **Marketing (SSOT):** `www.subsumio.com`

### Dev-Ports (lokal)

- **App UI:** `http://localhost:8080`
- **Marketing UI:** `http://localhost:3000`

### Tests

- Playwright `baseURL` entscheidet, ob App oder Marketing getestet wird.
- Keine Hardcodings auf `localhost:8080` oder `localhost:3000` in Shared Test-Utils.

---

## 6) Edge-Cases & Fehlerszenarien

- **Falsche `baseURL`** (z.B. Marketing statt App) -> E2E bricht früh ab, da App-spezifische TestIds fehlen.
- **Redirect Loops** zwischen `www` und `app` (z.B. Auth-Middleware falsch) -> muss durch Ingress/Next/Nest Konfig verhindert werden.
- **Cookies Scope**: Cookie auf `.subsumio.com` -> Marketing könnte Session sehen (unerwünscht).

---

## 7) Definition of Done (prüfbar)

- E2E Test-Utilities verwenden **keine** fest codierten `localhost:*` Origins.
- App-E2E läuft mit `baseURL=http://localhost:8080/` stabil.
- Marketing-Links verweisen konsistent auf `https://app.subsum.io`.
- Docs im Repo erklären klar: App vs Marketing (Domains + Dev-Ports).
