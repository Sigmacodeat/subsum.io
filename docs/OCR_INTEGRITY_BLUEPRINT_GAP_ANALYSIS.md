---
title: OCR Integrity Blueprint & GAP Analysis
domain: Legal Case Assistant
authoring: State-of-the-Art / Production-Ready
updatedAt: 2026-03-05
---

# 1) Systemziel (aus User-Sicht)

Ein hochzuverlässiger OCR→Chunking→Vector-Indexing-Flow, der **nachweisbar** sicherstellt, dass kein relevanter Dokumentinhalt zwischen PDF-Quelle, semantischen Chunks und Vektor-Datenbank verloren geht oder stillschweigend korrupt wird.

**User Outcome:**

- Jede verarbeitete Akte ist auditierbar.
- Jede Chunk-Repräsentation ist gegen die Quelle verifiziert.
- Integritätsabweichungen werden automatisch erkannt, protokolliert und als Review-Risiko sichtbar.

---

# 2) Kern-Userflows

## 2.1 Beginner Flow

1. Nutzer lädt PDF hoch.
2. OCR + Chunking laufen automatisch.
3. System indexiert Chunks in pgvector.
4. System führt Read-Back-Verifikation gegen erwartete Chunk-Hashes + Source-Hash durch.
5. Ergebnis:
   - **OK** → Dokument `ragIndexed=true`.
   - **Mismatch** → Audit-Warnung, Dokument bleibt nutzbar, aber mit klarer Risiko-Spur.

## 2.2 Normal Flow (mehrere Dokumente)

1. Batch-Upload mehrerer Dokumente.
2. Je Dokument wird separat verarbeitet und verifiziert.
3. Teilfehler werden granular protokolliert (`document.rag.verify_failed`) statt stillschweigend akzeptiert.
4. Team kann problematische Dokumente gezielt nachverarbeiten.

## 2.3 Power-User / QA Flow

1. QA liest Audit-Stream.
2. Prüft Mismatch-Typen (missing/hash/length/source-hash).
3. Korrelation mit OCR/Fidelity-Warnungen.
4. Entscheidet über Re-Indexing/Manuelle Prüfung.

---

# 3) UI-Elemente & Interaktionen

## Bereits implementiert

- Kein blockierender UI-Stop bei Verifikationswarnungen.
- Audit-Einträge für Verifikationsfehler mit strukturierter Metadata.

## Interaktionsmodell (State of the Art)

- **Click:** Öffnen von Audit/Verarbeitungsdetails je Dokument.
- **Hover:** Kurzinfo zu Integritätsstatus (Coverage, fehlende Chunks).
- **Focus/Keyboard:** Vollständig tastaturbedienbare Listen/Details (A11y-Standard).
- **Error Visibility:** Warnungen klar von harten Fehlern trennen.

> Hinweis: Die Kern-Integritätslogik ist implementiert; dedizierte UI-Badges/Dashboards für Integritätsmetriken sind als Erweiterung empfohlen.

---

# 4) Datenmodell & State-Management

## Eingangsseite (Frontend)

- `SemanticChunk[]` mit:
  - `index`
  - `text`
  - `category`
  - `keywords`
  - `qualityScore`
- `normalizedSourceText` als kanonischer OCR-Text.

## Verify Payload

- `chunks: [{ index, hash, length }]`
- `expectedSourceHash`

## Backend Verify Result

- `expectedCount`, `persistedCount`, `withEmbeddingCount`, `matchedCount`
- `missingChunkIndexes`, `hashMismatchIndexes`, `lengthMismatchIndexes`
- `sourceHashMatched`, `expectedSourceHash`, `persistedSourceHash`
- `coverage`, `ok`

## State-Übergänge

- `syncAndVerifyChunks` läuft asynchron nach Chunk-Persistenz.
- Erfolg: Dokument wird als `ragIndexed=true` markiert.
- Fehler/Mismatch: Audit-Warnung, kein stilles Überschreiben des Integritätsstatus.

---

# 5) Architekturentscheidungen

1. **Deterministische Canonicalization**
   - Zeilenumbrüche (`\r\n`→`\n`) vereinheitlicht.
   - Stabile Hash-Bildung über kanonisierten Inhalt.

2. **Duale Integritätsprüfung**
   - Chunk-level (index/hash/length).
   - Source-level (Gesamttext-Hash).

3. **Read-back aus Persistenz (nicht nur Write-Ack)**
   - Verifikation liest tatsächlich gespeicherte DB-Chunks zurück.
   - Verhindert "write reported success, data diverged"-Blindspot.

4. **Nicht-blockierende Produkt-UX mit auditierbarer Warnung**
   - Nutzerfluss bleibt robust.
   - Risiko wird transparent und maschinenlesbar markiert.

5. **Fail-Safe Availability**
   - Backend-Unverfügbarkeit führt zu kontrolliertem Fallback, nicht zu Crash.

---

# 6) Edge Cases & Fehlerszenarien

1. **Missing Chunks in DB**
   - Ursache: partieller Persistenzverlust.
   - Erkennung: `missingChunkIndexes`.

2. **Hash Mismatch trotz vorhandenem Chunk**
   - Ursache: Textmutation/Encoding-Issue.
   - Erkennung: `hashMismatchIndexes`.

3. **Length Mismatch**
   - Ursache: Normalisierung/Trunkierung.
   - Erkennung: `lengthMismatchIndexes`.

4. **Source Hash Mismatch**
   - Ursache: Reihenfolge-/Join-Probleme, OCR-Textabweichung.
   - Erkennung: `sourceHashMatched=false`.

5. **Embedding fehlt, Chunk vorhanden**
   - Sichtbar über `withEmbeddingCount` vs `persistedCount`.

6. **Backend Timeout/Netzfehler**
   - Keine App-Blockade, aber fehlende Verifikation muss im Betrieb beobachtet werden.

---

# 7) Definition of Done (prüfbar)

Ein Dokument gilt als **integritätsverifiziert**, wenn:

1. `expectedCount === persistedCount`
2. `missingChunkIndexes.length === 0`
3. `hashMismatchIndexes.length === 0`
4. `lengthMismatchIndexes.length === 0`
5. `sourceHashMatched === true` (wenn erwarteter Source-Hash übergeben)
6. `coverage === 1`

Zusätzlich:

- Verifikationsfehler erzeugen Audit-Event `document.rag.verify_failed` mit Detail-Metadaten.
- Linting/Static Checks auf geänderten Dateien ohne Fehler.

---

# 8) GAP-Analyse (Soll vs. Ist)

## 8.1 Vor der Implementierung

- Chunk-Persistenz vorhanden, aber keine verpflichtende DB-Read-Back-Verifikation.
- Kein deterministischer End-to-End-Abgleich Chunk ↔ Quelle ↔ DB.
- Fehlender standardisierter Audit-Trail für Verifikationsmismatches.

## 8.2 Jetzt umgesetzt

- Backend Verify-Endpoint: `/api/legal/workspaces/:workspaceId/rag/verify`.
- Service-seitige Verifikation mit mismatch-spezifischen Feldern.
- Frontend `syncAndVerifyChunks(...)` inkl. Payload-Building.
- Integration in beide OCR-Pfade (Intake + Pending OCR).
- Audit-Warnungen bei Verifikationsfehlern.

## 8.3 Verbleibende Rest-Gaps (Empfohlen)

1. **Integritäts-SLO Dashboard**
   - KPIs: verify-success-rate, mismatch-rate, source-hash-mismatch-rate, p95 verify latency.
2. **Auto-Remediation Policy**
   - Bei Mismatch: automatisches Re-Indexing (max N Versuche), danach manuelle Queue.
3. **E2E-Regressionstests**
   - Intentional corruption tests (fehlende Chunks, manipulierte Inhalte).
4. **UI-Badge pro Dokument**
   - Sichtbarer Integritätsstatus (`verified`, `warning`, `unverified`).
5. **Tamper-evident Audit chaining**
   - Optional kryptografische Verkettung der Audit-Einträge für forensische Nachvollziehbarkeit.

---

# 9) Arbeitspakete (atomar)

## WP-1: Deterministic Hashing & Canonicalization

- Ziel: Reproduzierbare Hashwerte für Chunk/Quelle.
- Abhängigkeiten: Keine.
- Komponenten: `legal-rag-sync.service.ts`, `legal-rag.service.ts`.
- Akzeptanz: Gleicher Input → gleicher Hash in Frontend/Backend.

## WP-2: Verify API + Read-Back Compare

- Ziel: Persistierte Daten gegen erwartete Daten prüfen.
- Abhängigkeiten: WP-1.
- Komponenten: `legal-rag.service.ts`, `legal-case.controller.ts`.
- Akzeptanz: Vollständiger Verify-Result inklusive mismatch arrays.

## WP-3: OCR Pipeline Integration

- Ziel: Automatischer Sync+Verify in Intake + Pending OCR.
- Abhängigkeiten: WP-2.
- Komponenten: `legal-copilot-workflow.ts`.
- Akzeptanz: Beide Pfade triggern Verify; success/fail Verhalten korrekt.

## WP-4: Audit Instrumentation

- Ziel: Forensisch verwertbare Warnungen bei Integritätsabweichungen.
- Abhängigkeiten: WP-3.
- Komponenten: `legal-copilot-workflow.ts`.
- Akzeptanz: `document.rag.verify_failed` mit Mismatch-Metadaten.

## WP-5: Quality Gate / Static Checks

- Ziel: Konsistenz und Build-Hygiene.
- Abhängigkeiten: WP-1..4.
- Komponenten: geänderte Dateien.
- Akzeptanz: Lint-Check ohne Fehler.

---

# 10) Selbst-Audit

- Tote UI-Elemente eingeführt? **Nein**.
- Inkonsistentes Verhalten zwischen OCR-Pfaden? **Nein** (beide Pfade auf Sync+Verify umgestellt).
- Erstnutzer kann scheitern ohne Hinweis? **Risiko reduziert** durch Audit-Warnungen; empfohlen: sichtbare UI-Badges.
- Moderne SaaS-Standards erfüllt? **Ja, Kernpfad** (Verifikation + Audit + nicht-blockierende UX).

---

# 11) Produktionsstatus

**Status: Produktionsreif für Integritäts-Kernpfad**

Mit den verbleibenden Rest-Gaps (Dashboard, Auto-Remediation, E2E-Corruption-Suite, UI-Statusbadge) kann die Lösung zusätzlich auf Enterprise/Compliance-Niveau gehärtet werden.
