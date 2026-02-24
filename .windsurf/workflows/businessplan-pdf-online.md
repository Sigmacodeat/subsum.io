---
description: Businessplan online + PDF Export
---

# Ziel

Aus `FFG-AWS-BUSINESSPLAN-PROMPT.md` eine Version erstellen, die:

- online sauber lesbar ist (Link für Partner/Förderstellen)
- als PDF exportiert werden kann (Einreichung/Anhang)

# Voraussetzungen

- Datei: `FFG-AWS-BUSINESSPLAN-PROMPT.md`
- Optional: `pandoc` installiert (empfohlen für reproduzierbares PDF)

# Workflow

## 1) Online-Version (ohne Build-System)

Variante A (schnell, ohne Hosting-Setup):

1. Committe `FFG-AWS-BUSINESSPLAN-PROMPT.md` in den Branch.
2. Nutze die Repo-Ansicht (GitHub/GitLab) als „Online“-Quelle.
3. Für Förderstellen: Link auf die konkrete Commit-URL verwenden (versioniert, unveränderlich).

Variante B (professionell, mit Pages):

1. Erstelle eine statische Seite (GitHub/GitLab Pages) mit Markdown-Renderer.
2. Hinterlege den Businessplan als eigene Seite.
3. Stelle sicher:
   - Inhaltsverzeichnis anklickbar
   - Druck-Styles (print CSS) aktiv

## 2) PDF-Export (empfohlen: Pandoc)

### 2.1 Vorbereitung

- Optional: Lege ein minimalistisches Template fest (Standard reicht für Förderstellen i.d.R.).
- Achte auf:
  - klare Überschriftenhierarchie (`#`, `##`, `###`)
  - Tabellen nicht zu breit

### 2.2 Export-Befehl (Pandoc)

Empfohlener Export (mit ToC):

```bash
pandoc FFG-AWS-BUSINESSPLAN-PROMPT.md \
  --toc --toc-depth=3 \
  -V geometry:margin=2.2cm \
  -V colorlinks=true \
  -o FFG-AWS-BUSINESSPLAN.pdf
```

Wenn du LaTeX nicht installiert hast, nutze eine der Alternativen:

- Export über VS Code Extension „Markdown PDF“ (inkl. ToC)
- Export über IDE/Preview „Print to PDF“

## 3) PDF-Qualitätscheck (Pflicht vor Einreichung)

- Inhaltsverzeichnis vorhanden und sinnvoll
- Keine abgeschnittenen Tabellen/Zeilen
- Seitenzahlen korrekt
- Kopf-/Fußzeilen konsistent
- Alle Platzhalterfelder (z.B. CLO-Name) befüllt

# Definition of Done

- Online-Link (Commit-URL oder Pages-URL) vorhanden
- PDF liegt als Datei vor und erfüllt Qualitätscheck
- PDF-Dateiname eindeutig (Datum/Version optional)
