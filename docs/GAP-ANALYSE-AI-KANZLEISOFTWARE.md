# GAP-Analyse: Subsumio als beste AI-Anwaltskanzlei-Software der Welt

> **Audit-Datum:** 2026-02-25
> **Status:** AKTIV – Feinschliff-Phase

---

## 1. IST-Zustand – Was bereits existiert

### 1.1 Backend (NestJS + Prisma + PostgreSQL) ✅

| Bereich                     | Status             | Details                                                          |
| --------------------------- | ------------------ | ---------------------------------------------------------------- |
| **Auth & Sessions**         | ✅ Produktionsreif | OAuth, Magic-Links, Multi-Session, CSRF                          |
| **Organizations (Kanzlei)** | ✅ Produktionsreif | Slug, Roles (Owner/Admin/Member), Invitations                    |
| **Workspaces**              | ✅ Produktionsreif | Feature-Flags, AI-Toggle, Doc-Embedding                          |
| **Document Storage**        | ✅ Produktionsreif | Y.js Snapshots, Updates, History, Blob-Storage                   |
| **AI/Copilot**              | ✅ Produktionsreif | OpenAI, Anthropic, Gemini, Perplexity, MCP, Embeddings, pgvector |
| **Calendar Sync**           | ✅ Produktionsreif | Google Calendar, CalDAV, Webhooks, Multi-Account                 |
| **Payment/Billing**         | ✅ Produktionsreif | Stripe Subscriptions, Add-ons, Credits, RevenueCat               |
| **Legal PDF Export**        | ✅ Funktional      | Playwright-basiert, Letterhead, Rubrum, A4                       |
| **DocuSign e-Signatur**     | ✅ Funktional      | JWT-Auth, Embedded Signing, Download                             |
| **Kanzlei-Profil**          | ✅ Funktional      | Name, Logo, Kontaktdaten, Footer                                 |
| **Permissions**             | ✅ Produktionsreif | Workspace/Doc/Org-Level RBAC                                     |
| **Notifications**           | ✅ Produktionsreif | In-App, Level-basiert                                            |
| **Comments**                | ✅ Produktionsreif | Threaded, Resolved-Flag                                          |
| **Indexer/Search**          | ✅ Produktionsreif | Volltext + Embedding-basiert                                     |
| **Affiliate-System**        | ✅ Produktionsreif | 2-Level, Stripe Connect, Compliance                              |
| **Webhooks**                | ✅ Produktionsreif | Retry, Attempts, Status-Tracking                                 |
| **License Management**      | ✅ Produktionsreif | Self-hosted Support                                              |

### 1.2 Frontend Case-Assistant (60+ Services) ⚠️

| Bereich                 | Status             | Problem                                     |
| ----------------------- | ------------------ | ------------------------------------------- |
| **Mandanten (Clients)** | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Akten (Matters)**     | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Case Files**          | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Fristen (Deadlines)** | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Zeiterfassung**       | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Rechnungen**          | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Aktennotizen**        | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Wiedervorlagen**      | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Vollmachten**         | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Gerichtstermine**     | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Audit Trail**         | ⚠️ Nur Client-Side | localStorage/IndexedDB, kein Backend        |
| **Fristenkontrolle**    | ⚠️ Nur Client-Side | 4-Augen-Prinzip ohne Server-Enforcement     |
| **GwG/KYC Compliance**  | ⚠️ Nur Client-Side | Keine Server-Validierung                    |
| **Kollisionsprüfung**   | ⚠️ Nur Client-Side | Keine Cross-Workspace-Prüfung               |
| **DSGVO Compliance**    | ⚠️ Nur Client-Side | Keine Server-seitige Löschfrist-Enforcement |

---

## 2. KRITISCHE GAPS (Sofort beheben)

### GAP-01: Keine Server-seitige Persistenz für Legal-Domain-Daten

- **Schwere:** KRITISCH
- **Beschreibung:** Alle Mandanten, Akten, Fristen, Zeiterfassung, Rechnungen etc. werden NUR im Browser gespeichert (localStorage + IndexedDB)
- **Risiko:** Datenverlust bei Browser-Wipe, kein Multi-Device, kein Multi-User, keine Backups
- **Lösung:** Prisma-Schema + REST/GraphQL API für alle Legal-Domain-Entities
- **Status:** 🔧 WIRD IMPLEMENTIERT

### GAP-02: Kein Server-seitiges Audit-Trail

- **Schwere:** KRITISCH (DSGVO/BRAO-Pflicht)
- **Beschreibung:** Audit-Log nur client-seitig, überlebt keinen Browser-Wipe
- **Risiko:** Compliance-Verstoß, Beweismittelverlust
- **Lösung:** Server-seitige `LegalAuditLog`-Tabelle mit unveränderlichen Einträgen
- **Status:** 🔧 WIRD IMPLEMENTIERT

### GAP-03: Keine Server-seitige Fristenkontrolle (4-Augen-Prinzip)

- **Schwere:** KRITISCH (BRAO §50 Abs. 1)
- **Beschreibung:** Fristenbestätigung nur client-seitig, kein zweiter Bestätiger auf Server-Ebene
- **Risiko:** Fristversäumnis ohne Nachweis der Kontrolle
- **Lösung:** Server-Endpoint mit Doppelbestätigung + Audit-Log
- **Status:** 🔧 WIRD IMPLEMENTIERT

### GAP-04: Keine Kollisionsprüfung auf Server-Ebene

- **Schwere:** HOCH (Berufsrecht)
- **Beschreibung:** Interessenkonflikt-Prüfung nur lokal, keine Cross-Workspace/Cross-Org-Prüfung
- **Risiko:** Berufsrechtsverletzung bei Mandatsannahme
- **Lösung:** Server-seitiger Conflict-Check über Organization-Scope
- **Status:** 🔧 WIRD IMPLEMENTIERT

---

## 3. HOHE PRIORITÄT GAPS

### GAP-05: beA-Integration fehlt auf Backend-Ebene

- **Schwere:** HOCH
- **Beschreibung:** BeA-Connector existiert als Frontend-Service, aber kein Backend-Proxy/API
- **Lösung:** Backend-Proxy für beA SAFE-ID-Authentifizierung + Nachrichtenversand

### GAP-06: DATEV-Export fehlt auf Backend-Ebene

- **Schwere:** HOCH
- **Beschreibung:** DATEV-Export nur client-seitig generiert
- **Lösung:** Server-seitiger DATEV-ASCII-Generator mit Download-API

### GAP-07: Automatische Fristenberechnung nach Rechtsgebiet

- **Schwere:** HOCH
- **Beschreibung:** Keine automatische Berechnung von Berufungs-/Revisions-/Klagefrist nach ZPO, StPO, VwGO
- **Lösung:** Server-seitiger Fristenrechner mit Feiertagslogik + Jurisdiktion

### GAP-08: E-Mail-Integration fehlt auf Backend-Ebene

- **Schwere:** HOCH
- **Beschreibung:** E-Mail-Service nur frontend-seitig, kein IMAP/SMTP auf Server
- **Lösung:** Backend IMAP-Connector + E-Mail-Ingestion Pipeline

### GAP-09: OCR-Pipeline fehlt auf Backend-Ebene

- **Schwere:** HOCH
- **Beschreibung:** Dokument-OCR nur client-seitig (Browser), nicht skalierbar
- **Lösung:** Server-seitiger OCR-Worker (Tesseract/Cloud Vision)

---

## 4. MITTLERE PRIORITÄT GAPS

### GAP-10: Mandantenportal-API

- Frontend-Service existiert, aber kein Backend-API für externen Zugang

### GAP-11: Treuhandkonto-Verwaltung

- Nur client-seitig, braucht server-seitige Buchführung

### GAP-12: Reporting/Analytics Dashboard

- Business Intelligence Service nur client-seitig

### GAP-13: Automatische Dokumentenklassifikation

- Norm-Extraktion und Klassifikation nur client-seitig

### GAP-14: Multi-Tenant Data Isolation

- Organization-Scope für Legal-Daten nicht enforced

### GAP-15: Verschlüsselung sensibler Daten at Rest

- Mandantendaten im Klartext in der DB

---

## 5. BENCHMARK: Weltklasse-Kanzleisoftware Features

| Feature                 | Clio | Actionstep | PracticePanther | **Subsumio**   |
| ----------------------- | ---- | ---------- | --------------- | -------------- |
| Case Management         | ✅   | ✅         | ✅              | ⚠️ Client-only |
| Time Tracking           | ✅   | ✅         | ✅              | ⚠️ Client-only |
| Billing/Invoicing       | ✅   | ✅         | ✅              | ⚠️ Client-only |
| Calendar Integration    | ✅   | ✅         | ✅              | ✅ Server-side |
| Document Management     | ✅   | ✅         | ✅              | ✅ Server-side |
| E-Signatur              | ✅   | ✅         | ❌              | ✅ DocuSign    |
| AI Legal Analysis       | ❌   | ❌         | ❌              | ✅ **UNIQUE**  |
| AI Document Processing  | ❌   | ❌         | ❌              | ✅ **UNIQUE**  |
| Deadline Automation     | ✅   | ✅         | ✅              | ⚠️ Client-only |
| Conflict Check          | ✅   | ✅         | ✅              | ⚠️ Client-only |
| Trust Accounting        | ✅   | ✅         | ✅              | ⚠️ Client-only |
| Client Portal           | ✅   | ✅         | ✅              | ⚠️ Client-only |
| beA Integration         | ❌   | ❌         | ❌              | ⚠️ Client-only |
| DATEV Export            | ❌   | ❌         | ❌              | ⚠️ Client-only |
| Legal Norm Registry     | ❌   | ❌         | ❌              | ✅ **UNIQUE**  |
| Contradiction Detection | ❌   | ❌         | ❌              | ✅ **UNIQUE**  |
| Evidence Register       | ❌   | ❌         | ❌              | ✅ **UNIQUE**  |
| Judikatur Research      | ❌   | ❌         | ❌              | ✅ **UNIQUE**  |
| GwG/KYC Compliance      | ❌   | ❌         | ❌              | ⚠️ Client-only |

### USP von Subsumio (einzigartig in der Welt):

1. **AI-gestützte Rechtsanalyse** mit Norm-Erkennung
2. **Widerspruchserkennung** in juristischen Dokumenten
3. **Beweismittel-Register** mit KI-Indexierung
4. **Judikatur-Research** (BGH, HUDOC, RIS)
5. **Automatische Norm-Klassifikation** (NLP)
6. **Gegner-Intelligence** (Anwalts- & Richterprofile)
7. **Collective Intelligence** (kanzleiübergreifende Wissensbasis)
8. **Live-Timer** für Echtzeit-Zeiterfassung

---

## 6. IMPLEMENTIERUNGS-ROADMAP

### Phase 1: Backend-Schema ✅ ERLEDIGT

- [x] Prisma-Schema: 10 neue Tabellen + 12 Enums (schema.prisma ab Zeile 1555)
  - LegalClient, LegalMatter, LegalMatterClient, LegalCaseFile
  - LegalDeadline (mit 4-Augen-Prinzip-Feldern)
  - LegalTimeEntry, LegalInvoice
  - LegalAuditLog (unveränderlich)
  - LegalConflictCheck
- [x] Feiertagslogik DE/AT (2025-2027)
- [ ] `prisma generate` + `prisma migrate dev` ausführen

### Phase 2: Backend-API ✅ ERLEDIGT

- [x] NestJS Module: `LegalCaseModule` (src/plugins/legal-case/)
- [x] `LegalCaseService`: Vollständiges CRUD für alle Entities
- [x] `LegalAuditService`: Unveränderliches Audit-Log
- [x] `LegalConflictService`: Organization-weite Kollisionsprüfung
- [x] `LegalDeadlineCalculator`: ZPO, StPO, VwGO, KSchG, öZPO
- [x] `LegalCaseController`: 25+ REST Endpoints unter `/api/legal/`
- [x] Registriert in `app.module.ts`

### Phase 3: Feinschliff (NÄCHSTER SCHRITT)

- [ ] `prisma generate` + `prisma migrate dev` ausführen
- [ ] Frontend-Store → Backend-Sync-Layer (CaseAssistantStore → REST API)
- [ ] Server-seitige Deadline-Cron-Job für automatische Status-Updates
- [ ] E2E Tests für kritische Flows
- [ ] Rate Limiting per Organization

---

## 7. Definition of Done

- [x] Alle Legal-Domain-Entities haben Server-seitige DB-Tabellen (10 Tabellen)
- [x] CRUD-API für alle Entities (25+ REST Endpoints)
- [x] Audit-Trail für alle Mutationen (DSGVO-konform, LegalAuditLog)
- [x] Fristenkontrolle mit 4-Augen-Prinzip auf Server (confirmDeadline)
- [x] Kollisionsprüfung auf Organization-Scope (LegalConflictService)
- [x] Automatische Fristenberechnung nach Rechtsgebiet (12 Fristtypen DE/AT)
- [x] Rechnungs-Auto-Nummerierung (RE-YYYY-NNNN)
- [ ] `prisma generate` + `prisma migrate` (User-Aktion)
- [ ] Frontend-Store → Backend-Sync-Layer
- [ ] E2E-Tests für kritische Flows

## 8. API-Referenz (implementiert)

### Clients (Mandanten)

| Method | Endpoint                                      | Beschreibung            |
| ------ | --------------------------------------------- | ----------------------- |
| GET    | `/api/legal/workspaces/:id/clients`           | Liste mit Filter/Suche  |
| GET    | `/api/legal/workspaces/:id/clients/:clientId` | Detail                  |
| POST   | `/api/legal/workspaces/:id/clients`           | Erstellen/Aktualisieren |
| DELETE | `/api/legal/workspaces/:id/clients/:clientId` | Soft-Delete             |

### Matters (Akten)

| Method | Endpoint                                              | Beschreibung            |
| ------ | ----------------------------------------------------- | ----------------------- |
| GET    | `/api/legal/workspaces/:id/matters`                   | Liste mit Status/Suche  |
| GET    | `/api/legal/workspaces/:id/matters/:matterId`         | Detail mit Relations    |
| POST   | `/api/legal/workspaces/:id/matters`                   | Erstellen/Aktualisieren |
| POST   | `/api/legal/workspaces/:id/matters/:matterId/trash`   | Zur Löschung markieren  |
| POST   | `/api/legal/workspaces/:id/matters/:matterId/restore` | Wiederherstellen        |

### Deadlines (Fristen)

| Method | Endpoint                                           | Beschreibung            |
| ------ | -------------------------------------------------- | ----------------------- |
| GET    | `/api/legal/workspaces/:id/deadlines`              | Liste mit Filter        |
| POST   | `/api/legal/workspaces/:id/deadlines`              | Erstellen/Aktualisieren |
| POST   | `/api/legal/workspaces/:id/deadlines/:id/confirm`  | 4-Augen-Bestätigung     |
| POST   | `/api/legal/workspaces/:id/deadlines/:id/complete` | Erledigt markieren      |
| POST   | `/api/legal/deadlines/calculate`                   | Automatische Berechnung |
| GET    | `/api/legal/deadlines/types`                       | Verfügbare Fristtypen   |

### Time Entries (Zeiterfassung)

| Method | Endpoint                                             | Beschreibung            |
| ------ | ---------------------------------------------------- | ----------------------- |
| GET    | `/api/legal/workspaces/:id/time-entries`             | Liste mit Filter        |
| POST   | `/api/legal/workspaces/:id/time-entries`             | Erstellen/Aktualisieren |
| POST   | `/api/legal/workspaces/:id/time-entries/:id/submit`  | Einreichen              |
| POST   | `/api/legal/workspaces/:id/time-entries/:id/approve` | Genehmigen              |
| POST   | `/api/legal/workspaces/:id/time-entries/:id/reject`  | Ablehnen                |

### Weitere

| Method | Endpoint                                   | Beschreibung       |
| ------ | ------------------------------------------ | ------------------ |
| GET    | `/api/legal/workspaces/:id/invoices`       | Rechnungen         |
| POST   | `/api/legal/workspaces/:id/invoices`       | Rechnung erstellen |
| POST   | `/api/legal/workspaces/:id/conflict-check` | Kollisionsprüfung  |
| GET    | `/api/legal/workspaces/:id/audit-log`      | Audit-Trail        |
| GET    | `/api/legal/workspaces/:id/stats`          | Statistiken        |
