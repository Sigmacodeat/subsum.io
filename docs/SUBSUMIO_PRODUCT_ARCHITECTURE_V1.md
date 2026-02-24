---
title: Legal Ops CoPilot Product Architecture v1
date: 2026-02-18
status: draft-implemented-foundation
---

# 1) Zielbild (aus User-Sicht)

Legal Ops CoPilot ist ein legaler Arbeitsraum, in dem Kanzleien komplette Aktenflüsse in einem System bearbeiten:

- Aktenwissen aus Dokumenten aufbauen (Akteure, Fristen, Risiken, Widersprüche)
- Fristen und Risiken überwachen
- Ordner- und Bulk-Ingestion steuern
- Automationen auslösen (z. B. Workflows, Benachrichtigungen, Massenkommunikation)
- Compliance- und Audit-Spuren nachvollziehen

# 2) Kern-Userflows

## Beginner
1. Öffnet eine Akte
2. Klickt auf Schnellanalyse (Selektion oder ganze Seite)
3. Sieht Issues/Fristen/Alerts im Cockpit

## Normal
1. Konfiguriert Connectoren (Paperless, n8n, Mail)
2. Führt wiederholte Ingestion-Läufe aus
3. Prüft Job-Queue und Fehlerzustände

## Power-User
1. Nutzt Batch-Ingestion (Ordner/Uploads/extern)
2. Triggert Folge-Workflows (Automationen)
3. Nutzt Audit-Einträge zur Compliance-Nachverfolgung

# 3) UI-Module

- Case Assistant Tab (bestehend):
  - Akten-Cockpit
  - Alert-Center
  - Ingestion-Modus (Selektion/Ganze Seite)
- Neu erweitert:
  - IDE-ähnliche 3-Spalten-Architektur
    - Linke Spalte: Cockpit + Connector-Operationen
    - Mittlere Spalte: Queue + Automation Actions
    - Rechte Spalte: Fristen-Alerts
  - Legal Copilot Workflow Panel
    - Document Intake (manuell)
    - OCR-Verarbeitung
    - Case Analysis (Findings/Tasks/Blueprint)
    - Folder Search + Folder Summary
  - Connector-Chips (Status)
  - Ingestion Queue (letzte Jobs)

## Accessibility & Workflow-Qualität (v1)

- Landmark-Struktur über `aside/main/aside` für Screenreader-Navigation
- `aria-live="polite"` für Statusmeldungen (nicht-blockierende Rückmeldung)
- Fokus-Sichtbarkeit für Formularfelder (`:focus-visible`)
- Rollen-/Berechtigungsabhängige Button-States (disabled + Audit-Trail)
- Konsistente Action-Gruppierung nach Arbeitskontext (Konfiguration, Queue, Dispatch, Alerts)

# 4) Datenmodell (v1)

## Bereits vorhanden
- CaseFile, CaseActor, CaseIssue, CaseDeadline, CaseMemoryEvent
- DeadlineAlert, ConversationContextPack

## Neu eingeführt
- ConnectorConfig (paperless, n8n, mail)
- IngestionJob (queued/running/completed/failed/cancelled)
- LegalDocumentRecord + OcrJob
- LegalFinding + CopilotTask + CaseBlueprint + CopilotRun
- WorkflowEvent (job-/connector-/alert events)
- ComplianceAuditEntry (info/warning/error)

# 5) Architektur-Entscheidungen

- AFFiNE bleibt Core-Workspace und UX-Layer
- Case-Assistant-Modul bleibt vertikale Domänenschicht
- Externe Systeme (Paperless/n8n/Mail) über Connectoren + Orchestrierung
- Lokale Persistenz über CacheStorage pro Workspace
- Event-/Audit-Trails als First-Class-Daten für Compliance und Debugging

# 6) Edge Cases / Fehlerpfade

- Zu wenig Selektionstext => klare Nutzerhinweise
- Zu wenig Seiteninhalt => klare Nutzerhinweise
- Ingestion-Fehler => Job auf failed + Audit-Eintrag
- Nicht konfigurierte Connectoren => disconnected sichtbar
- OCR ohne passende Dokumente => Job auf failed mit Fehlergrund
- Folder Summary ohne Rechte/ohne Ankerdaten => deny/empty Status ohne Crash

# 7) Definition of Done (v1)

- [x] Case Assistant als produktionsnaher Sidebar-Tab
- [x] Ingestion mit Modus-Toggle (Selektion / ganze Seite)
- [x] Fristen-Alerts inkl. Ack-Flow
- [x] Connector-Konfigurationen im Store verfügbar
- [x] Ingestion-Queue mit Status-Transitions verfügbar
- [x] Workflow-/Audit-Ereignisse persistiert
- [x] Legal Copilot Workflow (Intake/OCR/Analyse/Folder Summary)
- [ ] Reale Adapter für Paperless/n8n/Mail
- [ ] End-to-End Tests für Queue + Connector + Error Recovery

# 8) Nächste Umsetzungsblöcke

1. Intake-Center UI (Queue-Management, Retry, Cancel, Filter)
2. Connector-Settings UI (Endpoint/Auth/Healthcheck)
3. Adapter-Implementierungen (Paperless API, n8n webhook, Mail gateway)
4. Batch-Pipeline (folder/upload/external sources)
5. Security & Compliance Hardening (RBAC, secrets, immutable audit export)
