# Subsumio – Kritische Produktanalyse & Risikoaudit

**Datum:** 2026-02-25  
**Autor:** Tech Lead / Produktarchitekt / Legal-Tech-Audit  
**Scope:** Vollständige Codebase-Analyse (Frontend + Backend + Datenmodell + KI + Security)

---

## 1. PRODUKTVERSTÄNDNIS

### Was Subsumio ist
Subsumio ist eine **KI-gestützte Kanzleisoftware** (Legal Practice Management), gebaut auf der AFFiNE-Plattform (Collaboration-/Docs-Engine). Sie richtet sich primär an **kleine bis mittelgroße Kanzleien in DACH** (DE/AT/CH) und bietet:

- **Mandanten- & Aktenverwaltung** (ClientRecord, MatterRecord) mit Multi-Mandant-Akten
- **Fristenmanagement** mit 4-Augen-Prinzip, automatischer Berechnung (ZPO, StPO, VwGO, KSchG, öZPO)
- **KI-Copilot** für Fallanalyse, Widerspruchserkennung, Normextraktion, Schriftsatzerstellung
- **Zeiterfassung & Rechnungswesen** (RVG, BRAGO-kompatibel, DATEV-Export)
- **Dokumentenverarbeitung** mit OCR, semantischem Chunking, Jurisdiktionserkennung
- **GwG/KYC-Compliance**, DSGVO-Compliance-Modul, Kollisionsprüfung
- **beA-Connector** (Elektronischer Rechtsverkehr), Kalender-Sync, Mandantenportal
- **Credit-basiertes Pricing** (Free → Solo → Kanzlei → Business → Enterprise)

### Implizite Annahmen im Design

| Annahme | Risiko |
|---------|--------|
| **Frontend-First-Architektur**: 78 Services im Frontend, nur 1 Backend-Modul (`legal-case/`) | Kritisch – Großteil der Geschäftslogik läuft clientseitig |
| **localStorage/IndexedDB als primärer Datenspeicher** für 60+ Entity-Typen | Kritisch – Datenverlust bei Browser-Reset |
| **Backend-Sync erst nachträglich implementiert** (`syncLegalDomainFromBackendBestEffort`) | Hoch – Nur Clients/Matters/Deadlines/TimeEntries/Invoices werden synchronisiert, 55+ Entity-Typen NICHT |
| **Rollenmodell clientseitig** (CaseAccessControlService liest Rolle aus Store) | Kritisch – Rolle kann im Browser manipuliert werden |
| **Kein Input-Validation am Backend** (Controller akzeptiert `body: any`) | Kritisch – Injection/Manipulation |
| **AFFiNE-Plattform als Unterbau** (Workspace = Kanzlei) | Risiko bei Legal-spezifischen Multi-Tenant-Anforderungen |

---

## 2. KRITISCHE WORKFLOW-ANALYSE

### 2.1 Mandanten-Onboarding
**Problem**: Der GwG-Compliance-Workflow (`gwg-compliance.ts`, 654 Zeilen) läuft vollständig client-seitig. PEP-Checks, Sanktionslisten-Abgleich, wirtschaftlich Berechtigte – alles in localStorage.

- **Kognitive Hürde**: Nutzer muss manuell GwG-Status setzen, keine automatische Warnung bei unvollständiger Identifizierung
- **Falsche Daten**: PEP-Status kann ohne Validierung auf "passed" gesetzt werden
- **Kein Audit-Trail am Server** für GwG-Entscheidungen

### 2.2 Fristenmanagement
**Problem**: Automatische Fristenerkennung (`deadline-automation.ts`) basiert auf **Regex-Pattern-Matching** gegen Dokumententext:
```typescript
trigger: /\b(zustellung|bescheid|verwaltungsakt|widerspruch)\b/i
```
- **False Positives**: "Zustellung" im Kontext einer Essensbestellung löst Widerspruchsfrist aus
- **False Negatives**: Umschreibungen wie "dem Kläger zugestellt am..." werden nicht erkannt
- **Kein Confidence-Threshold** – jede Regex-Übereinstimmung erzeugt eine Frist
- **Base-Event-Erkennung**: `baseEventHints` sind ebenfalls Regex – bei mehrdeutigen Daten wird das **falsche Basisdatum** berechnet

### 2.3 Kollisionsprüfung
**Problem**: Rein **String-basierter Vergleich** (`legal-conflict.service.ts`):
```typescript
clientNames.some((name: string) => name.includes(term) || term.includes(name))
```
- "Dr. Müller GmbH" vs "Müller" → False Positive
- "Hans Schmidt" als Mandant, "Schmidt & Partner" als Gegner → wird NICHT erkannt
- **Kein Phonetik-/Fuzzy-Matching** (Soundex, Levenshtein)
- **Keine Aliase/Firmenverflechtungen** berücksichtigt

### 2.4 Zeiterfassung → Rechnung
**Rechnungsnummer-Race-Condition** (`legal-case.service.ts:705-717`):
```typescript
const count = await this.db.legalInvoice.count({ where: { ... } });
return `RE-${year}-${String(count + 1).padStart(4, '0')}`;
```
Bei paralleler Rechnungserstellung: **Doppelte Nummern möglich** (kein `UNIQUE` constraint, kein Sequence).

---

## 3. EDGE CASES

### 3.1 Unvollständige Mandantendaten
| Szenario | Auswirkung |
|----------|-----------|
| Mandant ohne E-Mail, aber Vollmacht-Request per E-Mail | Portal-Request schlägt still fehl |
| Mandant mit identischem Namen in 2 Workspaces | Kollisionsprüfung findet nichts (scope: workspace/org) |
| Mandant gleichzeitig Zeuge in anderer Akte | Kein Warnsystem, CaseActor-Rolle ist pro Akte isoliert |
| Mandant als juristische Person ohne wirtschaftlich Berechtigten | GwG-Check steht auf "pending", blockiert aber Aktenanlage NICHT |

### 3.2 Widersprüchliche Dokumente
| Szenario | Auswirkung |
|----------|-----------|
| Zwei Dokumente mit unterschiedlichem Zustelldatum | Fristenberechnung nimmt **das zuletzt gescannte Datum**, nicht das korrekte |
| OCR-Fehler ändert "14 Tage" in "44 Tage" | Frist wird mit falschem Offset berechnet, **keine Plausibilitätsprüfung** |
| Dokument in Akte A gehört eigentlich zu Akte B | Kein automatischer Cross-Akte-Check |

### 3.3 Parallele Bearbeitung durch mehrere Anwälte
| Szenario | Auswirkung |
|----------|-----------|
| 2 Anwälte bearbeiten gleiche Akte gleichzeitig | **Kein Conflict-Resolution** – Last-Write-Wins in localStorage/IndexedDB |
| Anwalt A schließt Frist ab, Anwalt B sieht Status "open" | Sync ist **eventual consistency** ohne Real-time-Push |
| 4-Augen-Prinzip: Gleicher User bestätigt 2x | Backend prüft korrekt (`confirmedByUserId === params.userId`), aber **Frontend prüft NICHT** |

### 3.4 Fristenkonflikte
| Szenario | Auswirkung |
|----------|-----------|
| 3 Fristen am selben Tag, unterschiedliche Akten | Kein Priority-Ranking über Akten hinweg |
| Automatisch erkannte Frist falsch, manuelle Frist korrekt | Keine Deduplizierung – beide existieren parallel |
| Feiertag in AT, aber Kanzlei in DE nutzt AT-Akte | Fristenberechnung kennt nur Kalendertage, **keine Feiertags-/Gerichtskalender-Integration** |

### 3.5 Mandanten mit mehreren Rollen
| Szenario | Auswirkung |
|----------|-----------|
| Mandant ist gleichzeitig Zeuge in anderer Sache | Keine systemseitige Warnung |
| Mandant kündigt Vollmacht, hat aber offene Fristen | Fristwarnung läuft weiter, keine Workflow-Unterbrechung |
| Erbengemeinschaft: 5 Mandanten in einer Akte, einer widerruft | `clientIds[]` wird manuell gepflegt, kein automatischer Status-Check |

### 3.6 Extreme Datenmengen
| Szenario | Auswirkung |
|----------|-----------|
| 500+ Dokumente in einer Akte | `sanitizeLegalDocForStore` truncated bei 256KB – alle Documents im selben localStorage-Key |
| 10.000 Mandanten | Backend `listClients` hat `take: 100` default – Pagination funktioniert, aber UI? |
| 50MB PDF → OCR | Local OCR (`local-ocr-engine.ts`, 44KB!) blockiert Main Thread |
| CaseGraphRecord mit 1000+ Akten | JSON.stringify für localStorage → `RangeError: Invalid string length` |

### 3.7 Ausfall externer Services
| Service | Auswirkung bei Ausfall |
|---------|----------------------|
| beA (elektronischer Rechtsverkehr) | Keine Offline-Queue, Nachricht geht verloren |
| OCR-Provider (remote) | Lokaler Fallback existiert, aber Qualität? |
| LLM-Provider (OpenAI etc.) | Chat blockiert, keine Retry-Queue |
| Calendar Sync (Google/Outlook) | `startAutoSync()` ohne Error-Recovery |
| DATEV-Export | Rein clientseitig generiert, kein Server-Backup |

---

## 4. RISIKOANALYSE

### Matrix

| # | Risiko | Impact | Wahrscheinlichkeit | Erkennbarkeit | Bewertung |
|---|--------|--------|---------------------|---------------|-----------|
| R1 | **Datenverlust**: 55+ Entity-Typen nur in localStorage/IndexedDB | **KRITISCH** | **HOCH** (Browser-Reset, Cache-Clear, neues Gerät) | **NIEDRIG** (Nutzer merkt es erst bei Bedarf) | 🔴 BLOCKER |
| R2 | **Falsche Fristberechnung** durch Regex-/OCR-Fehler | **KRITISCH** | **MITTEL** (abhängig von Dokumentqualität) | **NIEDRIG** (kein Plausibilitäts-Check) | 🔴 BLOCKER |
| R3 | **Backend akzeptiert `body: any`** – keine Validierung | **HOCH** | **HOCH** (jeder API-Call) | **MITTEL** (Audit-Log existiert) | 🔴 KRITISCH |
| R4 | **RBAC nur clientseitig** – Rolle aus Store manipulierbar | **KRITISCH** | **MITTEL** (technisch versierter Nutzer) | **NIEDRIG** | 🔴 KRITISCH |
| R5 | **Rechnungsnummer-Duplikate** bei paralleler Erstellung | **HOCH** | **MITTEL** | **HOCH** (sichtbar bei DATEV-Export) | 🟡 HOCH |
| R6 | **GwG/KYC-Daten nur clientseitig** – kein Server-Audit | **KRITISCH** | **HOCH** (jede Kanzlei braucht GwG) | **NIEDRIG** (Prüfer sieht localStorage nicht) | 🔴 BLOCKER |
| R7 | **Keine Real-time-Sync** bei Multi-User | **HOCH** | **HOCH** (Kanzleien mit >1 Anwalt) | **MITTEL** | 🟡 HOCH |
| R8 | **Audit-Log-Append kann fehlschlagen** (try/catch → `return null`) | **HOCH** | **NIEDRIG** | **SEHR NIEDRIG** (Fehler wird nur geloggt) | 🟡 HOCH |
| R9 | **KI-Halluzinationen** in Schriftsätzen/Rechtsanalysen | **KRITISCH** | **HOCH** (LLM-inhärent) | **MITTEL** (Confidence-Score existiert) | 🔴 KRITISCH |
| R10 | **workspaceId nicht am Backend gegen User-Berechtigung geprüft** | **KRITISCH** | **HOCH** | **NIEDRIG** | 🔴 BLOCKER |

### Detailbewertung

**R1 – Datenverlust**: Die größte einzelne Bedrohung. Der `CaseAssistantStore` persistiert via `globalState` (localStorage) und `cacheStorage` (IndexedDB). Bei Browser-Wechsel, Gerätewechsel, oder wenn der Nutzer Browserdaten löscht: **Alle Vollmachten, Aktennotizen, Wiedervorlagen, Auslagen, Kassenbelege, Fiskal-Signaturen, Email-Drafts, Gerichtstermine, Gegner-Intelligence, Collective Intelligence, Judikatur-Vorschläge, Workflow-Events, Court Decisions, Semantic Chunks, Quality Reports etc. sind WEG.**

**R10 – Fehlende Workspace-Autorisierung am Backend**: Der Controller extrahiert `workspaceId` aus dem URL-Path, prüft aber NICHT, ob der `@CurrentUser()` überhaupt Zugang zu diesem Workspace hat:
```typescript
@Get('/workspaces/:workspaceId/clients')
async listClients(
  @CurrentUser() _user: CurrentUser, // _user wird NICHT gegen workspaceId geprüft!
  @Param('workspaceId') workspaceId: string,
```
→ **Jeder authentifizierte Nutzer kann Daten JEDES Workspace lesen/schreiben.**

---

## 5. KI-SPEZIFISCHE PROBLEME

### 5.1 Halluzinationen
- **LegalChat** (`legal-chat.ts`, 2650 Zeilen) nutzt LLM für Rechtsberatung. Confidence-Scores existieren, aber:
  - **Kein automatischer Disclaimer** bei niedrigem Score
  - **Kein Fact-Checking** gegen die Norm-Datenbank
  - `estimateTokens()` ist eine Approximation (`text.length / 3.5`) – bei langen Kontexten wird der Context abgeschnitten, **ohne Warnung**

### 5.2 Over-Automation
- **Deadline-Automation** erzeugt Fristen automatisch per Regex – max 8 pro Dokument (`MAX_AUTO_DEADLINES_PER_DOC = 8`)
  - Nutzer wird **nicht gefragt**, ob automatische Fristen korrekt sind
  - `requiresReview` Feld existiert, wird aber im UI nicht enforced
- **Copilot NLP-CRUD** (`copilot-nlp-crud.ts`, 93KB!) kann via Sprachbefehl Akten anlegen/ändern/löschen
  - **Kein Undo** für destruktive NLP-Operationen
  - Kein Confirmation-Dialog für `delete`-Intents

### 5.3 Fehlende Erklärbarkeit
- **Contradiction Detector** (`contradiction-detector.ts`) erzeugt Findings, aber:
  - Keine Erklärung, **warum** ein Widerspruch erkannt wurde
  - `citations` Feld existiert, aber `startOffset/endOffset` sind optional → UI kann betroffene Stelle nicht hervorheben
- **Jurisdiction Detection** basiert auf gewichteten Signalen, aber Gewichte sind hardcoded, nicht konfigurierbar

### 5.4 Bias in Empfehlungen
- **Judikatur-Research** (`judikatur-research.ts`) und **BGH-Crawler** priorisieren deutsche Rechtsprechung
- Österreichische/Schweizer Normen sind im `legal-norms.ts` (137KB!) enthalten, aber **mit weniger Tiefe**
- **Gegner-Intelligence** (`gegner-intelligence.ts`) baut Profile basierend auf vergangenen Fällen – Bias-Risiko bei kleiner Datenbasis

### 5.5 Falsche Priorisierung
- CasePriority ist `critical | high | medium | low` – aber:
  - **Keine kontextabhängige Priorisierung** (Streitwert, Mandantentyp, Fristablauf)
  - KI-generierte Priorities werden nicht gegen Business-Rules validiert
  - Kein **Eskalationsmechanismus** wenn kritische Findings ignoriert werden

---

## 6. SKALIERUNG & ARCHITEKTUR

### 6.1 Architektur-Schwäche: Frontend-Heavy
Die Architektur ist fundamentally **Client-first**:
- 78 Services (1.5+ MB TypeScript) im Frontend
- 1 Backend-Modul (6 Dateien, ~57KB) als nachträglicher Sync-Layer
- **Kein Microservice-Split** für Legal-Domain

### 6.2 Performance-Risiken

| Bereich | Problem | Schwelle |
|---------|---------|----------|
| **localStorage** | JSON.stringify des gesamten CaseGraph | ~5MB Browser-Limit |
| **IndexedDB** | Kein Index auf häufige Queries (matterId, clientId) | >1000 Entities |
| **Backend-Queries** | Kein Index-Hint, `findMany` ohne Cursor-Pagination | >10.000 Akten |
| **OCR** | `local-ocr-engine.ts` (44KB) im Main Thread | Jeder PDF >5 Seiten |
| **Semantic Chunking** | Alle Chunks in einem Store-Key | >100 Dokumente pro Akte |
| **Legal Norms** | 137KB TypeScript → wird bei jedem Page-Load geparst | Startup-Zeit |

### 6.3 Datenbank-Engpässe
- **Keine Indizes** auf `workspaceId + status` Kombinationen in den Legal-Tabellen definiert (nur was Prisma default generiert)
- `getWorkspaceStats()` führt **7 parallele COUNT-Queries** aus – bei vielen Workspaces ein Problem
- **Kein Connection Pooling** sichtbar in der Prisma-Config
- **Audit-Log wächst unbegrenzt** – kein Archivierungs- oder Rotationsmechanismus

### 6.4 Multi-Tenant-Probleme
- `organizationId` existiert im Schema, wird aber **inkonsistent verwendet** (nur in Conflict-Check)
- **Keine Row-Level Security** – Workspace-Isolation nur durch WHERE-Clauses
- **Kein Tenant-Throttling** – ein Workspace mit 100K Dokumenten kann die DB für alle verlangsamen

---

## 7. SECURITY & COMPLIANCE

### 7.1 Zugriffskontrolle – **KRITISCHE LÜCKEN**

1. **Backend: Keine Workspace-Membership-Prüfung**
   - `@CurrentUser()` extrahiert nur die User-ID
   - **Kein Guard/Middleware** prüft, ob User Mitglied des Workspace ist
   - → Jeder Auth-User kann `/api/legal/workspaces/BELIEBIGE-ID/clients` aufrufen

2. **Frontend: RBAC-Bypass möglich**
   - `CaseAccessControlService.getRole()` liest aus `CaseAssistantStore` (localStorage)
   - → DevTools → Application → Local Storage → Rolle auf "owner" setzen

3. **Kein Per-Matter-Access-Control**
   - Chinese-Wall-Szenario: Anwalt A darf Akte X nicht sehen
   - System: Wer Workspace-Zugang hat, sieht ALLES

### 7.2 Rollenmodell
- **Workspace-Level**: Owner, Admin, Write, Read (AFFiNE-Plattform via GraphQL)
- **Case-Assistant-Level**: owner, admin, operator, viewer (eigenes System, clientseitig)
- **Problem**: Zwei separate, nicht verknüpfte Rollenmodelle. Ein Workspace-"Read"-User kann Case-Assistant-"owner" sein.

### 7.3 Mandantentrennung
- **Innerhalb eines Workspace**: Keine Trennung (alle Anwälte sehen alle Mandanten)
- **Zwischen Workspaces**: Backend-Lücke (siehe 7.1)
- **Cross-Organization**: Nur bei Conflict-Check relevant, dort implementiert

### 7.4 DSGVO-Risiken

| Problem | Schwere |
|---------|---------|
| DSGVO-Requests (`dsgvo-compliance.ts`) nur clientseitig gespeichert | KRITISCH |
| Kein automatisches Löschkonzept – `RetentionPolicy` ist nur ein lokaler Record | HOCH |
| Audit-Log am Server hat kein Integritäts-Siegel (Hash-Chain) | HOCH |
| `ipAddress` wird im Audit-Log gespeichert – Rechtsgrundlage? | MITTEL |
| Kein Verschlüsselungsnachweis für Daten at rest | MITTEL |
| `ResidencyPolicy` (`local_only` Mode) wird nur client-seitig enforced | KRITISCH |

### 7.5 Logging & Audit Trails
- **Server-seitig**: `LegalAuditService` – solide Basis, aber:
  - `append()` fängt Fehler mit try/catch und gibt `null` zurück → **stille Audit-Lücken**
  - Kein Integrity-Protection (Hash-Chain, WORM)
  - Kein Alert bei Audit-Failure
- **Client-seitig**: `ComplianceAuditEntry` in Store – keine Synchronisation zum Backend
  - `FiscalSignatureRecord` mit `chainHash`/`previousHash` → gutes Design, aber nur lokal!

---

## 8. FEHLENDE USE CASES

### Kanzlei-Situationen, die NICHT abgedeckt sind:

1. **Vertretungsregelung**: Anwalt ist krank/im Urlaub → wer übernimmt seine Fristen? Kein Stellvertreter-Mechanismus.

2. **Kanzlei-Wechsel eines Anwalts**: Anwalt verlässt Kanzlei → seine Akten müssen übergeben werden. Kein Handover-Workflow.

3. **Rechtsschutzversicherung**: Deckungszusage einholen, Selbstbeteiligung tracken, RSV-Korrespondenz. EmailTemplate `rechtsschutzanfrage` existiert, aber kein RSV-Entity.

4. **Prozesskostenhilfe (PKH)**: Antrag, Bewilligung, Ratenzahlung. Fehlt komplett.

5. **Streitverkündung / Nebenintervention**: Dritte Partei tritt dem Verfahren bei. Kein Datenmodell.

6. **Revision / Verfassungsbeschwerde**: Workflow nach Berufung. Nur als Frist-Template vorhanden.

7. **Insolvenz eines Mandanten**: Forderungsanmeldung, Tabelle, Prüfungstermin. Fehlt.

8. **Internationales Privatrecht**: Zustellungskonventionen (HZÜ), Anerkennung ausländischer Urteile. Nicht implementiert.

9. **Elektronische Aktenführung (§ 130a ZPO)**: Formatvorgaben für elektronische Schriftsätze. beA-Connector existiert, aber keine Formatvalidierung.

10. **Kanzlei-Buchhaltung**: DATEV-Export existiert, aber: Sachkontenrahmen, Mandantenkontenabgleich, Mahnwesen fehlen.

11. **Gebührenrecht**: `CostCalculatorService` berechnet RVG, aber: Vergütungsvereinbarungen, Honorarvereinbarungen (§ 3a RVG), Erfolgshonorar fehlen.

12. **Korrespondenz-Protokoll**: Wer hat wann mit wem telefoniert? `Aktennotiz` existiert, aber kein strukturiertes Kommunikationsprotokoll.

13. **Dokumenten-Vorlagen**: `DocumentGeneratorService` existiert, aber: Kanzlei-spezifische Briefköpfe, Textbausteine, Vorlagen-Verwaltung nicht sichtbar.

14. **Archivierung nach § 50 BRAO**: 6-Jahres-Frist nach Mandatsende. `RetentionPolicy` existiert als Typ, aber kein automatischer Archivierungsjob.

---

## 9. UX-RISIKEN

### 9.1 Frustrationspunkte

| Problem | Betroffener Workflow |
|---------|---------------------|
| **78 Services** ohne klare Navigation → Feature-Overload | Alle |
| Automatische Fristen ohne Erklärung, warum sie erstellt wurden | Fristmanagement |
| KI-Analyse dauert lang (OCR + Chunking + NER + LLM) → kein Progress | Dokumenteneingang |
| Credit-System (`CreditGatewayService`) blockiert bei 0 Credits ohne Warnung | KI-Features |
| Kein **Onboarding-Wizard** für neue Kanzlei | Ersteinrichtung |
| Multi-Mandant-Akten (`clientIds[]`) erfordern manuelle Pflege | Aktenverwaltung |

### 9.2 Fehlendes Feedback

| Situation | Problem |
|-----------|---------|
| Backend-Sync fehlgeschlagen | `syncLegalDomainFromBackendBestEffort` – "BestEffort" = stille Fehler |
| Audit-Log-Write fehlgeschlagen | `return null` – kein UI-Feedback |
| Kollisionsprüfung: Potential Conflict | Keine forcierte Entscheidung (Nutzer kann einfach weitermachen) |
| GwG-Check unvollständig | Aktenanlage wird NICHT blockiert |
| DSGVO-Löschfrist abgelaufen | Kein automatischer Alert |

### 9.3 Fehlende Guardrails

- **Destruktive Aktionen ohne Bestätigung**: NLP-CRUD kann Akten löschen
- **Keine Undo-Funktion** für Bulk-Operationen
- **Kein Soft-Lock** bei Fristablauf (Frist kann nach Ablauf bearbeitet werden)
- **Kein Limit** für automatisch erstellte Entitäten (ein schlechtes PDF kann 8 falsche Fristen erzeugen)
- **Kein Warning** wenn Nutzer Frist ohne 4-Augen-Bestätigung als erledigt markiert

---

## 10. KONKRETE VERBESSERUNGSVORSCHLÄGE

### 🟢 Quick Wins (1-2 Wochen)

| # | Maßnahme | Aufwand |
|---|----------|--------|
| Q1 | **Backend: Workspace-Membership-Guard** als NestJS Middleware | 1 Tag |
| Q2 | **Backend: DTO-Validation** mit `class-validator` statt `body: any` | 2-3 Tage |
| Q3 | **Rechnungsnummer: Unique Constraint** + Retry-Loop im Service | 2 Stunden |
| Q4 | **Audit-Log: Fehler eskalieren** statt `return null` | 1 Stunde |
| Q5 | **Frontend: Confirmation-Dialog** für NLP-CRUD Delete-Operationen | 1 Tag |
| Q6 | **Deadline-Automation: `requiresReview: true` als Default** für auto-erkannte Fristen | 30 Min |
| Q7 | **Credit-Warning** bei <10% verbleibenden Credits | 1 Tag |

### 🟡 Mittelfristig (1-3 Monate)

| # | Maßnahme | Aufwand |
|---|----------|--------|
| M1 | **Backend-Sync für ALLE Entity-Typen** (nicht nur 5 von 60+) | 2-3 Wochen |
| M2 | **Server-seitiges RBAC** mit Workspace-Membership-Check | 1 Woche |
| M3 | **Feiertags-Kalender** in Fristenberechnung integrieren | 1 Woche |
| M4 | **Fuzzy-Matching** in Kollisionsprüfung (Levenshtein + Soundex) | 3 Tage |
| M5 | **Real-time Sync** (WebSocket/SSE) für Multi-User | 2 Wochen |
| M6 | **OCR in Worker Thread** statt Main Thread | 3 Tage |
| M7 | **Hash-Chain Integrity** für Server-Audit-Log | 1 Woche |
| M8 | **Per-Matter-Access-Control** (Chinese Wall) | 2 Wochen |
| M9 | **KI-Disclaimer** mit Confidence-basierter Warnstufe | 3 Tage |
| M10 | **Onboarding-Wizard** für Kanzlei-Ersteinrichtung | 1 Woche |

### 🔴 Strategisch (3-12 Monate)

| # | Maßnahme | Aufwand |
|---|----------|--------|
| S1 | **Backend-First-Architektur**: Alle Business-Logik auf Server verlagern | 3-6 Monate |
| S2 | **Multi-Tenant Row-Level Security** in PostgreSQL | 1 Monat |
| S3 | **Vector-DB Integration** für semantische Suche (statt Jaccard in JS) | 2 Monate |
| S4 | **E2E-Verschlüsselung** für Mandantendaten | 2 Monate |
| S5 | **Zertifizierung** (ISO 27001, TISAX, ERV-Konformität) | 6+ Monate |
| S6 | **Plugin-Architektur** für Rechtsgebiet-spezifische Module | 3 Monate |

---

## 11. „WAS WÜRDE SCHIEFGEHEN?" – Worst-Case-Szenarien

### Szenario 1: Fristversäumung mit Haftungsfolge
> Ein Anwalt lädt ein Urteil hoch. Die Regex-Automation erkennt "Berufungsfrist" und berechnet 1 Monat ab einem OCR-fehlerhaft erkannten Datum (15.03. statt 15.01.). Der Anwalt verlässt sich auf die automatisch berechnete Frist. Die echte Frist läuft ab. **→ Haftungsschaden, Regressanspruch, ggf. Strafbarkeit (§ 356 StGB bei schwerer Pflichtwidrigkeit).**

**Wahrscheinlichkeit**: MITTEL. **Impact**: EXISTENZIELL.

### Szenario 2: Datenverlust beim Browser-Wechsel
> Eine Kanzlei mit 3 Anwälten nutzt Subsumio. Anwalt A hat 200 Akten mit GwG-Daten, Vollmachten, Zeiterfassungen. Er wechselt auf einen neuen Laptop. Alle Daten aus localStorage/IndexedDB sind weg. Das Backend hat nur Clients/Matters/Deadlines – keine Vollmachten, keine GwG-Records, keine Kassenbelege, keine Fiskal-Signaturen. **→ Monate an Arbeit verloren. GwG-Compliance-Nachweis nicht führbar.**

**Wahrscheinlichkeit**: HOCH. **Impact**: KRITISCH.

### Szenario 3: Cross-Workspace Data Breach
> Ein böswilliger Nutzer erstellt einen Free-Account. Er kennt oder errät eine Workspace-ID. Er ruft `/api/legal/workspaces/{target-id}/clients` auf. **→ Er erhält die gesamte Mandantenliste einer fremden Kanzlei.** DSGVO-Verstoß. Meldepflicht an Aufsichtsbehörde. Reputationsschaden.

**Wahrscheinlichkeit**: HOCH (kein Guard). **Impact**: EXISTENZIELL.

### Szenario 4: KI-Halluzination in Schriftsatz
> Der Copilot generiert einen Schriftsatz und zitiert "§ 823a BGB" (existiert nicht) oder ein BGH-Urteil mit falschem Aktenzeichen. Der Anwalt reicht den Schriftsatz ungeprüft ein. **→ Richter weist auf Fehler hin. Standesrechtliche Konsequenzen möglich.**

**Wahrscheinlichkeit**: HOCH (LLM-inhärent). **Impact**: HOCH.

### Szenario 5: Kollisionsprüfung versagt
> Mandant "Dr. Hans Müller-Schmidt" gegen "Müller-Schmidt GmbH". Die String-basierte Prüfung erkennt keinen Konflikt (exakter Substring-Match schlägt fehl). Die Kanzlei vertritt beide Seiten. **→ Standesrechtlicher Verstoß (§ 43a Abs. 4 BRAO). Mandatsniederlage. Schadensersatz.**

**Wahrscheinlichkeit**: MITTEL. **Impact**: EXISTENZIELL.

### Szenario 6: Audit-Log-Manipulation
> Ein Nutzer mit Datenbankzugang ändert Audit-Log-Einträge. Da keine Hash-Chain existiert, ist die Manipulation nicht nachweisbar. Bei einem DSGVO-Audit oder Haftungsfall kann die Kanzlei ihre Compliance nicht belegen. **→ Bußgeld bis zu 4% des Jahresumsatzes.**

**Wahrscheinlichkeit**: NIEDRIG. **Impact**: KRITISCH.

---

## ZUSAMMENFASSUNG: TOP-5 SOFORTMASSNAHMEN

| Prio | Maßnahme | Begründung |
|------|----------|-----------|
| **P0** | **Backend Workspace-Auth-Guard** | Jeder Auth-User kann fremde Workspace-Daten lesen |
| **P0** | **Backend Input-Validation (DTOs)** | SQL-Injection/Data-Corruption via `body: any` |
| **P0** | **Server-Persistierung ALLER Entity-Typen** | Datenverlust bei Browser-Reset |
| **P1** | **Fristen: Pflicht-Review für automatisch erkannte Fristen** | Haftungsrisiko |
| **P1** | **Server-seitiges RBAC** (nicht nur client-seitig) | Privilege-Escalation |

---

## GEZIELTE FRAGEN (wo Informationen fehlen)

1. **Prisma-Migration**: Wurde `prisma migrate` für die Legal-Tabellen jemals ausgeführt? Existieren die Tabellen in Production?
2. **LLM-Provider**: Welcher Provider wird genutzt? OpenAI, Azure, Anthropic, Self-hosted? → Datenschutz-Implikation
3. **beA-Anbindung**: Ist die beA-Integration (`bea-connector.ts`) live oder Mock? Produktionsreife?
4. **Deployment-Modell**: SaaS-only oder Self-Hosted Option? → Mandantentrennung-Anforderungen
5. **Backup-Strategie**: Gibt es DB-Backups? Wie oft? Wiederherstellungszeit?
6. **Penetration-Test**: Wurde ein Security-Audit durchgeführt?
7. **Testabdeckung**: Wie hoch ist die Testabdeckung für die 78 Frontend-Services? Nur `__tests__/` (20 Items) sichtbar.
8. **OCR-Qualität**: Welche Erkennungsrate hat die lokale OCR bei handschriftlichen Dokumenten / Fax-Scans?
9. **Preismodell**: Werden Enterprise-Kunden Daten-Residency-Garantien gegeben? → `residency-policy.ts` ist nur clientseitig enforced
10. **Haftungsausschluss**: Gibt es einen rechtlichen Disclaimer für KI-generierte Inhalte in den AGB?
