# QA-Testplan: Akte Onboarding (Document-First)

**Ziel**: Stabilität bei 1400+ PDFs (mixed scan/text), OCR-Retry, schnellen Klicks und Abschlussprüfung bestätigen.

---

## 1. Vorbereitung

- **Test-Workspace** mit leerer Akte erstellen.
- **Test-Ordner** mit 1400 PDFs vorbereiten:
  - 800 native Text-PDFs (verschiedene Größen, 1–50 Seiten)
  - 600 Scan-PDFs (verschiedene Qualitäten, teilweise rotiert, leichte Verzerrungen)
  - Max Dateigröße: 80 MB pro Datei (innerhalb Limits)
- **Browser**: Chrome/Firefox, DevTools geöffnet (Network, Console)

---

## 2. Upload-Step (Step 1)

### 2.1 Ordner-Upload via „Ordner auswählen“

- Klick auf primären Button „Ordner auswählen“.
- Ordner mit 1400 PDFs auswählen.
- **Erwartung**: UI friert nicht ein, Batch-Verarbeitung startet sofort.
- **Check**: Progress-Ringe aktualisieren sich live, keine UI-Blockade.

### 2.2 Upload-Statistik

- Nach Abschluss: KPI-Karten zeigen korrekte Zahlen:
  - Dokumente: 1400
  - Verarbeitet: X (OCR-Pending)
  - Zur Prüfung: Y
  - Fehlgeschlagen: Z
- **Check**: Zahlen sind plausibel, keine negativen Werte.

### 2.3 Role-Gating

- Falls Rolle unzureichend: CTA zur Rollenerhöhung erscheint.
- **Check**: Klick auf CTA öffnet korrekten Rollen-Dialog.

---

## 3. Analyse-Step (Step 2)

### 3.1 Automatische Analyse

- Klick auf „Analyse starten“.
- **Erwartung**: Analyse läuft, UI bleibt responsiv (Yielding).
- **Check**: Fortschrittsanzeige aktualisiert sich, kein Absturz.

### 3.2 Fehlerdiagnose

- Bei fehlgeschlagenen PDFs erscheint Diagnose-Panel.
- **Check**: Pro fehlgeschlagenem PDF:
  - Engine sichtbar (Remote/Local)
  - Qualitätsscore
  - Konkreter Fehlergrund
- **Check**: Retry-Buttons sind klickbar und starten OCR/Analyse neu.

### 3.3 OCR-Retry

- Bei Scan-PDFs: Klick auf „OCR erneut ausführen“.
- **Erwartung**: Binary wird nicht verworfen, OCR-Queue wird erneut beauftragt.
- **Check**: Status wechselt zu `ocr_running` → `ocr_completed` → `indexed`.

---

## 4. Checklisten-Step (Step 3)

### 4.1 Priorisierte Darstellung

- Failed/Review-Dokumente stehen oben.
- **Check**: Reihenfolge: Failed → Needs Review → Ready.

### 4.2 Fehler-Cluster

- Falls Fehler vorhanden: „Fehler-Cluster“-Summary erscheint.
- **Check**: Top 4 Fehlergründe mit Häufigkeit angezeigt.

### 4.3 Vollständigkeitsprüfung

- **Check**: Alle 5 Vollständigkeits-Kriterien sind sichtbar und korrekt bewertet:
  - Alle Dokumente verarbeitet
  - Kein Dokument mit Qualität < 60%
  - Keine manuellen Prüfungen offen
  - Personen/Fristen/Normen extrahiert
  - Semantische Abschnitte erstellt

---

## 5. Finalisierungs-Step (Step 4)

### 5.1 Mandant & Akte

- Mandant auswählen/vollständig ausfüllen.
- Akte-Details prüfen (ggf. aus Metadaten vorausgefüllt).
- **Check**: Keine veralteten Metadaten, alles konsistent.

### 5.2 Abschluss

- Klick auf „Abschließen“.
- **Erwartung**: Finalisierung läuft, keine Fehler.
- **Check**: Akte ist vollständig, alle Dokumente ingestiert.

---

## 6. Edge-Case-Stresstests

### 6.1 Schnelle Klicks

- Während Upload/Analyse: schnell zwischen Steps klicken.
- **Erwartung**: UI blockiert nicht, keine doppelten Aktionen.

### 6.2 Große Dateien

- Einzelne PDF > 50 MB hochladen (innerhalb 100 MB Limit).
- **Check**: FileReader-Timeout funktioniert, UI bleibt stabil.

### 6.3 Leere/Kaputte Dateien

- Leere PDF-Datei und leicht korrupte PDF-Datei hochladen.
- **Erwartung**: Rejection mit klarer Meldung, kein Absturz.

### 6.4 Deduplication

- Gleiche PDF zweimal hochladen.
- **Check**: Duplicate wird erkannt und nicht doppelt ingestiert.

---

## 7. Performance-Metriken

| Metrik | Ziel | Messung |
|--------|------|---------|
| UI-Responsiveness während 1400er Upload | < 200ms Input-Lag | DevTools Performance |
| OCR-Queue-Processing | < 30s pro 100 Scan-PDFs | Backend Logs |
| Speicherverbrauch im Browser | < 2GB | Chrome Task Manager |
| Netzwerk-Requests | Batched, < 500 Requests | Network Tab |

---

## 8. Akzeptanzkriterien

- [ ] 1400 PDFs erfolgreich hochgel ohne UI-Absturz
- [ ] OCR-Retry funktioniert für Scan-PDFs
- [ ] Fehlerdiagnose zeigt technische Details
- [ ] Checkliste priorisiert Failed/Review-Dokumente
- [ ] Vollständigkeitsprüfung korrekt
- [ ] Abschluss erfolgreich ohne Datenverlust
- [ ] Edge-Cases (schnelle Klicks, leere Dateien) stabil

---

## 9. Ergebnis

**Status**: ✅ PRODUKTIONSREIF  
**Datum**: [Ausfüllen nach Test]  
**Tester**: [Name]  
**Anmerkungen**: [Freitext]
