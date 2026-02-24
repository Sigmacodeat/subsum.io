# PERFECTER PROMPT FÜR FFG & AWS BUSINESSPLAN

## EINGABE FÜR KI (Copy-Paste Ready)

Du bist ein erfahrener österreichischer Fördermittelberater und Businessplan-Experte mit Spezialisierung auf FFG (Österreichische Forschungsförderungsgesellschaft) und AWS (Austria Wirtschaftsservice) Förderprogramme. Erstelle einen professionellen, förderfähigen Businessplan für eine innovative Legal-Tech Kanzleisoftware mit KI-Integration.

---

## UNTERNEHMENSDATEN
**Firmenname:** Subsumio
**Standort:** Wien Österreich
**Gründungsdatum:** 01.05.2026
**Rechtsform:** GmbH (Startup)
**Mitarbeiteranzahl:** 6 (inkl. Gründer-Team)
**UID-Nummer:** in Gründung

---

## HINTERGRUND & MOTIVATION (Problemursprung)
**Praxisnähe:** Der CEO arbeitet seit rund 10 Jahren intensiv mit Rechtsanwälten an komplexen Fällen und hat dabei wiederkehrende Schwachstellen in Kanzleiabläufen beobachtet (Dokumentenflut, manuelle Fehler, Fristenrisiko, unvollständige Aktenlage, fehlende Nachvollziehbarkeit von Entscheidungen).

**Parallelprojekt RCIID (Blockchain-Forensik):** Zusätzlich wird mit RCIID (Rocket Chain Investigation ID) eine professionelle Blockchain-Forensik-Plattform entwickelt, u.a. zur strukturierten Aufbereitung und Nachvollziehbarkeit großer Daten- und Dokumentenmengen in einem der größten österreichischen Krypto-Betrugsfälle (Optioment).

**Übertragbare Lessons Learned:** Aus dieser forensischen Arbeit leitet Subsumio zentrale Qualitätsprinzipien ab:
- **Traceability-by-Design:** Jede relevante Aussage/Schlussfolgerung muss auf Quellenstellen zurückführbar sein (Dokument, Fundstelle, Version, Zeitstempel).
- **Auditierbarkeit:** Entscheidungen und Bearbeitungsschritte müssen reproduzierbar dokumentiert sein (Audit-Trail).
- **Fehlerprävention statt Fehlerkorrektur:** Frühwarnsysteme (Fristen, Widersprüche, Evidenzlücken) reduzieren Haftungs- und Qualitätsrisiken.

---

## REFERENZPROJEKT: RCIID (Blockchain-Forensik) als Technologieträger
RCIID dient als Referenzprojekt für die Fähigkeit, große Mengen an Daten und Beweismitteln strukturiert, nachvollziehbar und gerichtstauglich aufzubereiten. Die dort eingesetzten Prinzipien (Chain-of-Custody, Auditierbarkeit, reproduzierbare Analysen) werden als Qualitäts- und Prozessstandard in Subsumio übertragen.

### Konzept-Erweiterung (strategisch sinnvoll für Subsumio): „Blockchain-Forensik-Connector“
Ziel ist eine optionale Pipeline, die Strafverfolgung und Kanzleien unterstützt, sobald in einer Akte Bitcoin-Adressen oder Transaktions-IDs auftreten.

**Trigger (Dokumenten-/Akte-Intake):**
- Detektion von **BTC-Adressen**, **TXIDs**, **Exchange-Deposit-Adressen** in hochgeladenen Dokumenten (OCR/Text) oder in Aktennotizen
- Klassifikation (Adresse vs. TXID vs. Exchange-Hinweis) + Confidence Score

**Automatisierte Erstanalysen (RCIID-Pipeline, modular):**
- „First Pass“: Adressprofil (Balance, UTXO-Set, Aktivitätsmuster)
- Graph-Expansion (Hop-basierte Verfolgung, Cluster-Heuristiken) als Vorschlag, nicht als endgültige Feststellung
- Ereignis-Logik: Alerts bei großen Abflüssen, Mixing-Indikatoren, Exchange-Treffer
- Ergebnisartefakte: Bericht + Quellen (TXIDs/Blockhöhe) + Zeitstempel + Versionierung

**Rechtssicherer Betrieb:**
- **Human-in-the-loop Pflicht:** automatische Ergebnisse werden als „Hinweise“ markiert und müssen juristisch/forensisch freigegeben werden
- **Audit-Trail:** jede Analyse (Input, Version, Parameter, Output) wird revisionssicher protokolliert
- **Datenschutz/Data Residency:** je nach Mandat Cloud / lokal / Airgap; Remote-Calls optional deaktivierbar

**Mehrwert für Subsumio:**
- Erweiterung der Kanzlei-Workflows um ein spezialisiertes Modul für Krypto-/Finanzermittlungen
- Höherer gesellschaftlicher Impact (Unterstützung von Aufklärung/Recovery) ohne die Kern-Kanzlei-Use-Cases zu verwässern

---

## PRODUKTBESCHREIBUNG (Legal-Tech SaaS Plattform)

### Kernfunktionen:
- **AI-gestützte Fallbearbeitung:** Automatisierte Dokumentenanalyse, OCR-Verarbeitung, semantische Suche
- **Intelligente Mandantenverwaltung:** Vollautomatisierte Aktenführung, Fristenmanagement, Zeiterfassung
- **Multi-Jurisdiktions-Support:** DE/AT/CH/EU-Rechtssysteme mit Normen-Datenbank
- **Cloud-basierte Kollaboration:** Real-time Zusammenarbeit, sichere Dokumenten-Sharing
- **Predictive Analytics:** KI-basierte Fallprognosen, Risikobewertung, Judikatur-Analyse
- **Automatisierte Rechnungslegung:** DATEV-Export, Treuhandkonto-Verwaltung, Honorarabrechnung

### Technologie-Stack:
- **Frontend:** React 18 / TypeScript 5.x, Progressive Web App (PWA), Electron für Desktop-App (Windows/macOS/Linux)
- **Backend:** Node.js (NestJS), PostgreSQL, Redis, GraphQL API
- **KI-Pipeline:** OpenAI GPT-4o / Anthropic Claude 4 Sonnet / Mistral Large / Google Gemini 2.5 Pro (Multi-Provider), proprietäre Fine-Tuning-Modelle für deutsche Rechtssprache, TF-IDF + Vector-Embeddings für semantische Suche
- **Dokumentenverarbeitung:** OCR-Pipeline (lokal + Remote-Fallback), 15+ Dateiformate (PDF, DOCX, XLSX, PPTX, EML, MSG, Bilder), Chunk-basierte semantische Ingestion
- **Infrastruktur:** EU-basierte Cloud-Server (DSGVO-konform), CDN, verschlüsselte Datenübertragung (TLS 1.3), lokale Verarbeitungsoption (Data Residency)
- **Qualitätssicherung:** 60+ Services, automatisierte Compliance-Prüfung, Audit-Trail (1.000+ Event-Typen)

### Zielmarkt:
- **Primär:** Rechtsanwaltskanzleien (Solo bis 50+ Anwälte) in DACH-Region
- **Sekundär:** Unternehmensjuristiken, Behörden, Legal Departments
- **Marktgröße:** €2.8 Mrd. Legal-Tech Markt Europa (2025, Statista/Grand View Research), CAGR 12.3% bis 2030
- **Adressierbarer Markt (SAM):** ~€420 Mio. (DACH-Region: ~67.000 Kanzleien in DE + ~6.200 in AT + ~12.000 in CH)
- **Erreichbarer Markt (SOM, 3 Jahre):** ~€15 Mio. (0,5% Marktpenetration DACH)

---

## WIRTSCHAFTLICHE DATEN

### Umsatzprognose 3 Jahre:
- **Jahr 1:** €85.000 (€12.000 MRR zum Jahresende) — Launch, Beta-Kunden, erste Kanzlei-Piloten
- **Jahr 2:** €480.000 (€55.000 MRR zum Jahresende) — Wachstum DACH, Marketing-Push
- **Jahr 3:** €1.440.000 (€150.000 MRR zum Jahresende) — Skalierung, Enterprise-Deals, CH-Markteintritt

### Umsatzherleitung (konservativ):
- **Jahr 1:** ~60 Solo-User (€49/Mo) + 22 Kanzleien (Ø 3 Seats × €99/Mo) + 1 Enterprise (10 Seats × €199/Mo)
- **Jahr 2:** ~180 Solo + 65 Kanzleien (Ø 4 Seats) + 5 Enterprise (Ø 20 Seats) → End-MRR: ~€54.500
- **Jahr 3:** ~300 Solo + 130 Kanzleien (Ø 5 Seats) + 15 Enterprise (Ø 25 Seats) → End-MRR: ~€153.700
- **Churn-Annahme:** 5% monatlich (Branchendurchschnitt Legal-SaaS: 3–7%)
- **Annual-Anteil:** 40% jährliche Abrechnung (20% Rabatt)

### Preisstrategie:
- **Solo:** €49/Monat (€39/Jahr)
- **Kanzlei:** €99/User/Monat (€79/Jahr)
- **Enterprise:** €199+/User/Monat (individuell)

### Kostenstruktur (Jahr 1):
- **Personal (6 FTE, brutto inkl. LNK 30%):** €360.000/Jahr
  - 3 Gründer (CEO, CTO, CLO): je €48.000–55.000 brutto
  - 2 Software Engineers: je €50.000 brutto
  - 1 Marketing & Business Development: €42.000 brutto
- **Marketing/Vertrieb:** €72.000/Jahr (Content, SEO, Events, Anwaltstage, Google Ads)
- **Technologie/Infrastruktur:** €48.000/Jahr (Cloud-Hosting EU, LLM-API-Credits, OCR-Services, Monitoring)
- **Sonstige:** €36.000/Jahr (Büro Wien, Rechtsberatung, Steuerberatung, Versicherung, Reisekosten)
- **Gesamt Jahr 1:** €516.000

### Kostenstruktur (Jahr 2): €680.000
- Personal (10 FTE): €520.000 | Marketing: €96.000 | Technologie: €36.000 | Sonstige: €28.000

### Kostenstruktur (Jahr 3): €920.000
- Personal (15 FTE): €720.000 | Marketing: €120.000 | Technologie: €48.000 | Sonstige: €32.000

### Finanzbedarf:
- **FFG Basisprogramm (beantragt):** €250.000 (für F&E: KI-Modelle, semantische Suche, Predictive Analytics)
- **AWS Gründerzuschuss (beantragt):** €50.000 (Gründungskosten, erstes Marketing)
- **AWS Förderdarlehen (beantragt):** €100.000 (Wachstumsfinanzierung Jahr 1–2)
- **Gesamt Förderbedarf:** €400.000
- **Eigenkapital (Gründer + Pre-Seed Angel-Runde):** €200.000
- **Gesamtfinanzierung (24 Monate):** €600.000

### Verwendungszweck (detailliert):
- **50% Produktentwicklung:** KI-Fine-Tuning, proprietäre Modelle, Infrastruktur, Security-Zertifizierung
- **25% Personal:** Aufbau Engineering-Team (4 zusätzliche Entwickler in Jahr 2)
- **15% Marketing & Vertrieb:** DACH Go-to-Market, Anwaltstage, Content-Marketing, SEO
- **10% Internationalisierung:** CH-Markteintritt (Rechtsanpassung, lokale Compliance, Vertriebspartner)

---

## INNOVATIONSHEFT & FORSCHUNGSKONZEPT

### Forschungsfragen:
1. **KI-gestützte Rechtserkennung:** Wie können Large Language Models juristische Dokumente in deutscher Rechtssprache mit 95%+ Genauigkeit analysieren, Normen extrahieren und nach Jurisdiktion klassifizieren? (Forschungslücke: Bestehende Modelle sind auf englisches Common Law trainiert; DACH-Zivilrecht erfordert domänenspezifisches Fine-Tuning)
2. **Semantische Rechtsuche:** Entwicklung von domänenspezifischen Vector-Embeddings für juristische Fachbegriffe, Normen und Judikatur — mit TF-IDF-gewichteter Cosinus-Similarität als effiziente Alternative zu General-Purpose-Embeddings (Forschungslücke: Keine existierende Embedding-Lösung für deutschsprachige Rechtsterminologie)
3. **Predictive Legal Analytics:** Maschinelles Lernen zur Vorhersage von Fallverläufen und Erfolgswahrscheinlichkeiten basierend auf anonymisierten Judikatur-Daten aus RIS (AT), BGH (DE) und HUDOC (EGMR) — Collective-Intelligence-Ansatz über Kanzleigrenzen hinweg
4. **Automatisierte Compliance:** DSGVO-konforme Verarbeitung sensibler Mandantendaten in Cloud-Architekturen mit Data-Residency-Optionen (lokal/Cloud/Self-Hosted) und automatisierter Anonymisierung personenbezogener Daten in KI-Kontexten (26+ Anonymisierungs-Patterns)
5. **Widerspruchserkennung:** Automatische Identifikation von inhaltlichen Widersprüchen zwischen juristischen Dokumenten innerhalb einer Akte — neuartiger Ansatz basierend auf semantischer Chunk-Analyse und Cross-Referenz-Matching

6. **Nachvollziehbarkeit & Evidenzketten (Chain-of-Custody für Wissen):** Wie kann ein System jede Analyse/Empfehlung transparent mit Dokumentstellen, Versionsstand und Bearbeitungsschritten verknüpfen, sodass menschliche Prüfer die Herleitung schnell auditieren können?

### Innovationsgrad:
- **Marktneuheit:** Im DACH-Markt sind End-to-End Plattformen, die generative KI, semantische Dokumentanalyse und Multi-Jurisdiktions-Unterstützung in einem integrierten Workflow kombinieren, bislang selten. Subsumio adressiert diese Lücke mit einem durchgängigen Dokumenten-zu-Workflow-Ansatz.
- **Technologischer Vorsprung:** Domänenspezifische Pipeline (OCR/Parsing → Chunking → Qualitätsbewertung → Retrieval) mit Multi-Provider-LLM-Architektur und semantischer Suche (TF-IDF + Embeddings), ausgelegt auf deutschsprachige Rechtssprache
- **Wettbewerbsvorteil quantifiziert:**
  - 10x schnellere Dokumentenanalyse vs. manuelle Verarbeitung
  - 95%+ Erkennungsgenauigkeit bei Normen und Fristen
  - 27 automatische Frist-Templates für 7 Jurisdiktionen (kein Konkurrent hat >1)
  - 8 spezialisierte KI-Chat-Modi (Richter-Perspektive, Gegner-Simulation, etc.) — einzigartig am Markt

### Patentfähigkeit / Schutzrechte:
- **Gebrauchsmuster (AT):** "Verfahren zur KI-gestützten automatisierten Analyse und Klassifikation juristischer Dokumente mit Multi-Jurisdiktions-Erkennung"
- **Softwarepatent (EPA-Prüfung):** "System zur semantischen Vektorsuche in juristischen Normendatenbanken mit TF-IDF-gewichteter Cosinus-Similarität"
- **Markenrecht:** "Subsumio" — Wort-/Bildmarke Anmeldung beim ÖPA geplant Q2 2026
- **Geschäftsgeheimnis:** Proprietäre Fine-Tuning-Datensätze für deutschsprachige Rechtssprache, Collective-Intelligence-Algorithmus
- **Hinweis:** Europäische Patentierbarkeit von Software ist eingeschränkt (EPA Art. 52). Fokus auf technischen Beitrag (Verarbeitungseffizienz, Erkennungsgenauigkeit) statt auf Geschäftsmethode.

---

## MARKTSTRATEGIE

### Vertriebskanäle:
- **Direct Sales:** B2B-Vertrieb an Kanzleien
- **Partnerprogramm:** Rechtsträger, IT-Dienstleister
- **Content Marketing:** Legal Tech Blog, Webinare, Fachartikel
- **Trade Shows:** LegalTech conferences, Anwaltstage

### Traktion (Go-to-Market Start):
- **Pilotkunden vorhanden:** Bestehende Anwaltskontakte als Early Adopters für bezahlte Piloten ab Launch
- **Validierungsansatz:** 3-monatige Pilotprojekte mit klaren KPI (Zeitersparnis, Dokument-Durchsatz, Fristenerkennungsrate, NPS)
- **Referenzaufbau:** Case Studies (DSGVO-konform anonymisiert) als Kernasset für DACH-Skalierung

### Wettbewerbsanalyse:
- **Direkte Konkurrenten DACH:** RA-MICRO (DE-Marktführer, ~30.000 Kanzleien), DATEV Anwalt Classic (DE, Steuerberater-Ökosystem), Advoware/STP (DE), j-lawyer.org (Open Source DE)
- **Internationale Konkurrenten:** Clio (US/Global, $49–$149/Mo, >150.000 Nutzer), Smokeball (AU/US), PracticePanther (US), MyCase (US)
- **Nischen-Konkurrenten AT:** Keine vergleichbare DACH-native Legal-Tech-Plattform mit KI-Integration
- **Unterscheidungsmerkmale Subsumio:**
  - Durchgängige KI- und Dokumentenpipeline (OCR/Parsing → semantische Ingestion → Analysen) mit Fokus auf DACH-Anwendungsfälle
  - Multi-Jurisdiktions-Support (DE/AT/CH/EU/EGMR) nativ integriert
  - Collective Intelligence: anonymisierte, kanzleiübergreifende Wissensbasis
  - Widerspruchserkennung, Beweislage-Analyse, automatische Fristableitung (27 Templates, 7 Jurisdiktionen)
  - 40–60% günstiger als Enterprise-Lösungen (Clio Advanced: $119/Mo vs. Subsumio Kanzlei: €99/Mo mit mehr Features)

---

## FORDERPROGRAMM-ANPASSUNG

### FFG (Basisprogramm/Innovationsvoucher):
- **Fokus:** Forschung, Entwicklung, Innovation (Unternehmensprojekte der *Experimentellen Entwicklung*)
- **Einreichung:** Laufend über eCall; Entscheidung in mehreren Fördersitzungen pro Jahr
- **Projektvolumen:** Bis zu ~€3 Mio je Projekt möglich
- **Förderlogik:** Finanzierung typischerweise als **Mix aus Zuschuss und Darlehen** (FFG-Basisprogramm), mit Barwert-Obergrenzen nach EU-Regeln
- **Förderquote (Richtwert):** In der Regel ~50% der anerkennbaren Projektkosten; bei **Startups in Gründungsphase bis max. ~70%** (abhängig von Unternehmensgröße, Barwert, ggf. Länderkooperation)
- **Schwerpunkte:** Digitalisierung, KI, SaaS-Innovation, skalierbare Dienstleistungen mit Verwertungspotenzial
- **Passung Subsumio:** F&E-Anteile sind klar abgrenzbar (NLP/Embeddings, Qualitätsmetriken, Widerspruchserkennung, Data-Residency & Anonymisierung)

### FFG Ergänzend (intelligent für Subsumio):
- **Basisprogramm Kleinprojekt 2026 (FFG):** Für „kleineres“ Projektvolumen (Experimentelle Entwicklung)
  - **Kostenrahmen:** Gesamtprojektkosten bis **€150.000**
  - **Förderung:** Zuschuss; je nach Unternehmensgröße **bis max. 60%** (mit Kooperation)
  - **Passung:** Ideal als schneller, risikoarmer Einstieg für einen klar abgegrenzten Forschungssprint (z.B. Widerspruchserkennung v1, Anonymisierung + Qualitätsmetriken)
- **Projekt.Start 2026 (FFG):** Förderung von Projektvorbereitungskosten
  - **Kostenrahmen:** bis **€10.000** anerkannte Kosten (externe Leistungen max. 40%)
  - **Förderung:** **60%**, max. **€6.000**
  - **Passung:** Für „Antragsreife“: saubere F&E-Projektstruktur, Arbeitspakete, Kostenplan, Evaluationskriterien

### AWS (Förderdarlehen/Gründerzuschuss):
- **Fokus:** Unternehmensgründung, Wachstum, Skalierung, Internationalisierung
- **Passende Programme (aktuell):**
  - **aws Preseed | Seedfinancing (Innovative Solutions / Deep Tech):** Frühphasen-Finanzierung für innovative bzw. forschungs-/entwicklungsintensive Gründungen; *Preseed* für sehr frühe Phase, *Seedfinancing* bis ~5 Jahre
  - **Seedfinancing – Deep Tech (aus FAQ ab 2024/2025):**
    - **Max. Förderbetrag:** **€889.000** (bis **€1.000.000** mit Gender-Bonus)
    - **Förderintensität:** max. **80%** (bis **90%** mit Gender-Bonus)
    - **Eigenmittel-Anforderung:** i.d.R. **10%** (bzw. **5%** mit Gender-Bonus) der förderfähigen Kosten in Cash
- **Schwerpunkte:** Technologie-Unternehmen, Verwertung, IP, Exportpotenzial, Arbeitsplatzaufbau
- **Passung Subsumio:** Markteintritt DACH, Aufbau Sales/CS, Produktisierung (Security, Self-hosted/Airgap) und Skalierung

---

## MARKTREIFE-KOSTENMODELL (Entwicklung & Betrieb)

### 1) Entwicklungsaufwand bis „Marktreife“ (12–18 Monate)
- **Produkt & Engineering (Core SaaS, Web + Desktop, Backend, Billing, Connectors):** 8–12 FTE-Monate pro Quartal in Year 1–2
- **KI-/Dokumentenpipeline (OCR, Chunking, Qualität, RAG, Multi-Provider-LLM, Anonymisierung):** 4–7 FTE-Monate zusätzlich
- **Security & Compliance (DSGVO, Audit-Trail, Pen-Test, Hardening, Incident-Prozesse):** 1–2 externe Audits/Jahr + laufende Engineering-Kapazität

### 2) Typische „All-in“ Kosten (konservativer Richtwert)
- **Entwicklungskosten (inkl. LNK/Overhead):** ~€90k–€140k pro FTE/Jahr (AT/DACH Startup)
- **Marktreife Gesamtbudget (12–18 Monate):**
  - **Lean (10 FTE Ø, fokusiert):** ~€0,9–€1,4 Mio
  - **Aggressiv (15 FTE Ø, schneller Skalierungsplan):** ~€1,6–€2,4 Mio

### 2b) Aufwand in Stunden (Realitätscheck für „perfekt funktioniert“)
 **Annahme:** 1 FTE-Monat = 160h, Produktreife in 12–18 Monaten, inkl. QA/Security/Go-Live.

 **Workstreams (Schätzung):**
 - **Core SaaS Plattform (Frontend/Backend/DB, Mandanten/Akten, Workflows):** 3.200–4.800h
 - **Dokumentenpipeline (Upload, OCR, Parsing, Chunking, Qualität, RAG-Basis):** 2.400–3.600h
 - **Legal Intelligence (Fristen, Normen, Widersprüche, Evidence/Warnings):** 1.600–2.800h
 - **Security & Compliance (DSGVO, Audit, RBAC, Logs, Pen-Test-Fixes):** 1.200–2.000h
 - **Billing/Exports/Integrationen (DATEV/BMD, Connector Framework, Mail/Portal):** 1.200–2.200h
 - **Airgap/Self-hosted (Packaging, Update-Strategie, Offline-Policy, Ops):** 800–1.600h
 - **QA & Release Engineering (E2E, Regression, Monitoring, Incident-Runbooks):** 1.200–2.200h
 - **Go-to-Market Enablement (Onboarding, Templates, Docs, Pilot-Support):** 600–1.200h

 **Gesamt (konservativ):** ~12.200h (≈ 76 FTE-Monate)
 **Gesamt (hoch, „enterprise-ready“):** ~20.400h (≈ 128 FTE-Monate)

 **Team-Rechnung (Beispiel):**
 - 10 FTE über 12 Monate → 10 × 12 × 160h = 19.200h (deckt „enterprise-ready“ nur knapp)
 - 10 FTE über 9 Monate → 14.400h (deckt konservative Marktreife)
 → Damit sind die in Abschnitt „Marktreife Gesamtbudget“ genannten Bandbreiten zeitlich konsistent.

### 3) Laufende Betriebskosten (OPEX) – Cloud vs. Airgap/Self-hosted
- **Cloud (EU-Hosting):**
  - Infrastruktur: €2k–€10k/Monat (Start → Wachstum) abhängig von Speicher, OCR-Volumen, LLM-Nutzung
  - Monitoring/Security/Backups: €500–€2k/Monat
  - LLM/OCR variable Kosten: abhängig vom Nutzungsverhalten; Steuerung via Credit-/Quota-Modell empfohlen
- **Airgap / Self-hosted (Kundenseitig):**
  - **Setup/Integration (einmalig):** 5–15 PT (Netzwerk, IdP, Policies, Updates, Backup-Konzept)
  - **Betrieb (jährlich):** Wartung + Security Updates + Supportvertrag; klare SLA-Levels definieren
  - **Hardware (kundenseitig, Richtwert):** 1–2 Server (CPU/RAM/Storage) je nach Dokumentvolumen; optional GPU nur bei lokalem Model-Inference

### 4) Preislogik für Airgap (Empfehlung als Add-on)
- **Self-hosted/Airgap Add-on:** Aufpreis auf Enterprise (z.B. +€49–€99/User/Monat) *oder* Pauschale + Wartungsvertrag
- **Einmaliges Setup:** z.B. €7.500–€25.000 (abhängig von Integrationskomplexität)

### 5) Unit Economics (SaaS + KI) — antragsreif & bankfähig
- **Ziel-Bruttomarge:** 75–85% (SaaS-Standard)
- **COGS-Komponenten:**
  - **Infra/Storage/Traffic:** planbar, skaliert mit aktiven Dokumenten und Speicher
  - **OCR:** variabel nach Scan-Volumen; Kostensteuerung über Batch/OCR-Queue + Limits
  - **LLM-Kosten:** variabel nach Token-Volumen; Kostensteuerung über Credits/Quotas (pro Plan)
- **Kostensteuerungs-Mechanik (operativ):**
  - Plan-basierte **AI-Credits** (Solo/Kanzlei/Enterprise) + Warnstufen (80%/95%)
  - Deduplizierung, Chunking-Limits, Quality-Gates, Anonymisierung vor Remote-Calls
  - **Airgap/Self-hosted:** Remote-OCR/Connectors optional deaktivierbar; ermöglicht sensible Kunden (Banken/Behörden)
  - **Human-in-the-loop:** KI liefert Vorschläge/Warnings, aber keine „automatische Rechtsentscheidung“; Freigaben, Quellenprüfung und Dokumentation bleiben beim Anwender
- **Pricing-Fit (aus Repo):**
  - Solo: €49/User/Monat | Kanzlei: €99/User/Monat | Enterprise: ab €199/User/Monat
  - Airgap als Enterprise Add-on (Aufpreis oder Setup+Maintenance) → Deckung zusätzlicher Support-/Security-Kosten

---

## ONLINE-VERSION & PDF (Antrags-Ready)

### Ziel
- **Online ansehen:** Ein sauber gerendertes, versionierbares Dokument (Link für Förderstellen/Partner)
- **PDF-Download:** Identischer Inhalt als PDF für Einreichung/Anhang

### Empfohlener Workflow (ohne Spezial-Tooling)
1. **Markdown als Single Source of Truth** (dieses Dokument)
2. **PDF-Export:** via Pandoc (Markdown → PDF) oder VS Code/IDE Markdown-PDF Export
3. **Online-Hosting:** z.B. GitHub/GitLab Pages oder eine einfache Marketing-Unterseite (statisches Rendern)

### Akzeptanzkriterium
- PDF enthält korrektes Inhaltsverzeichnis, Seitenzahlen, konsistente Tabellenformatierung und keine abgeschnittenen Zeilen.

---

## AUFGABE

Erstelle einen vollständigen Businessplan mit folgenden Kapiteln:

1. **Executive Summary** (1 Seite)
2. **Unternehmensbeschreibung** (2-3 Seiten)
3. **Marktanalyse** (3-4 Seiten)
4. **Produkt/Technologie** (3-4 Seiten)
5. **Business Modell** (2-3 Seiten)
6. **Marketing & Vertrieb** (2-3 Seiten)
7. **Team & Organisation** (2 Seiten)
8. **Finanzplanung** (3-4 Seiten)
9. **Innovationskonzept** (2-3 Seiten)
10. **Risikoanalyse** (1-2 Seiten)
11. **Fördermittel-Argumentation** (1-2 Seiten)

**Besondere Anforderungen:**
- FFG-konform: Fokus auf Forschung, Innovation, Technologie
- AWS-konform: Fokus auf Wirtschaftlichkeit, Wachstum, Arbeitsplätze
- Österreichische Gesetzgebung: DSGVO, Rechtsform, Steuern
- Professioneller Ton: Fördermittel-gerechte Sprache, keine Marketing-Slogans
- Zahlenbasiert: Alle Aussagen mit Kennzahlen untermauern
- Realistisch: Konservative Annahmen, nachvollziehbare Planung

**Format:** Strukturiert mit Überschriften, Bullet Points, Tabellen für Finanzdaten
**Länge:** 15-20 Seiten gesamt
**Sprache:** Deutsch (österreichisches Business-Deutsch)

---

## NOTWENDIGE RESSOURCEN

### **FFG Links:**
- www.ffg.at
- FFG Basisprogramm: www.ffg.at/basisprogramm
- FFG Innovationsvoucher: www.ffg.at/innovationsvoucher

### **AWS Links:**
- www.aws.at
- AWS Förderdarlehen: www.aws.at/foerderdarlehen
- AWS Gründerzuschuss: www.aws.at/gruenderzuschuss

### **Beratungsstellen:**
- Wirtschaftskammer Österreich (WKÖ)
- Austrian Business Agency (ABA)
- Standortagentur Österreich
- Regionalentwicklungsgesellschaften

---

## MUSTER-STRUKTUR (Copy-Paste Vorlage)

```
# Businessplan [Firmenname] - Legal Tech SaaS mit KI

## 1. Executive Summary
[Kurzbeschreibung 1 Seite]

## 2. Unternehmensbeschreibung
[Firmenprofil, Vision, Mission]

## 3. Marktanalyse
[Marktgröße, Wettbewerb, Zielgruppe]

## 4. Produkt & Technologie
[Innovation, USPs, Roadmap]

## 5. Business Modell
[Umsatzströme, Preisstrategie]

## 6. Marketing & Vertrieb
[Go-to-Market Strategie]

## 7. Team & Organisation
[Gründer, Berater, Struktur]

## 8. Finanzplanung
[Umsatz, Kosten, ROI]

## 9. Innovationskonzept
[Forschungsfragen, Patentstrategie]

## 10. Risikoanalyse
[Risiken, Maßnahmen]

## 11. Fördermittel-Argumentation
[Warum FFG/AWS, Verwendungszweck]
```

Hinweis: Vor finaler Einreichung sollten alle verbleibenden Platzhalter (z.B. CLO, Beirat, Quellenzitate) vervollständigt und die Zahlen im Excel-Finanzplan gespiegelt werden.

---

## NACH DER KI-ANTWORT: WICHTIGE NÄCHSTE SCHRITTE

### 1. **Verbleibende Platzhalter befüllen (manuell nötig):**
- ✅ Finanzielle Daten, Kostenstruktur, Umsatzprognose — FERTIG
- ✅ Wettbewerbsanalyse, Marktgrößen, Technologie-Stack — FERTIG
- ✅ CEO/CTO Namen eingetragen — Lebensläufe ergänzen
- ✅ CLO eingetragen — Dr. Mag. Fromhold (Lebenslauf ergänzen)
- ⬜ **Wissenschaftlicher Beirat** — Konkrete Personen anfragen (Uni Wien, TU Wien, Kanzlei-Partner)
- ⬜ **Aktuelle Marktstudien** — Statista/Grand View Research Zitate mit exakten Quellennummern belegen
- ⬜ **Eigenkapitalnachweis** — Bankbestätigung oder Letter of Intent der Angel-Investoren

### 2. **FFG-Spezifische Anpassungen:**
- **Innovationsvoucher:** €5.000-50.000 für KMU
- **Basisprogramm:** €50.000-500.000 für F&E
- **Ergebnisprogramm:** €500.000-2 Mio für Marktreife

### 3. **AWS-Spezifische Anpassungen:**
- **Gründerzuschuss:** Bis zu €50.000 für Jungunternehmer
- **Förderdarlehen:** Bis zu €2 Mio für Wachstum
- **Exportförderung:** Bis zu €200.000 für Internationalisierung

### 4. **Bewerbungsfristen:**
- **FFG:** Laufende Einreichung (je nach Programm)
- **AWS:** Quartalsweise Einreichung (März, Juni, September, Dezember)

### 5. **Benötigte Unterlagen:**
- Unternehmensregisterauszug
- Finanzplan (Excel)
- Lebensläufe des Gründerteams
- Technologische Beschreibung
- Referenzen/Kundenstimmen

---

## PROFESSIONELLE TIPPS

### **FFG-Erfolgsfaktoren:**
✅ Hoher Innovationsgrad betonen
✅ Forschungsfragen klar formulieren
✅ Technologischer Mehrwert nachweisen
✅ Patentfähigkeit prüfen
✅ Wissenschaftliche Partner einbeziehen

### **AWS-Erfolgsfaktoren:**
✅ Wirtschaftliche Nachhaltigkeit zeigen
✅ Arbeitsplatzschaffung quantifizieren
✅ Exportpotential nachweisen
✅ Finanzplan realistisch halten
✅ Eigenkapital nachweisen

### **Allgemeine Tipps:**
✅ Professionelle Formatierung verwenden
✅ Kurze, prägnante Sätze
✅ Alle Annahmen belegen
✅ Realistische Zeitpläne
✅ Experten-Feedback einholen

---

## NOTWENDIGE RESSOURCEN

### **FFG Links:**
- www.ffg.at
- FFG Basisprogramm: www.ffg.at/basisprogramm
- FFG Innovationsvoucher: www.ffg.at/innovationsvoucher

### **AWS Links:**
- www.aws.at
- AWS Förderdarlehen: www.aws.at/foerderdarlehen
- AWS Gründerzuschuss: www.aws.at/gruenderzuschuss

### **Beratungsstellen:**
- Wirtschaftskammer Österreich (WKÖ)
- Austrian Business Agency (ABA)
- Standortagentur Österreich
- Regionalentwicklungsgesellschaften

---

## MUSTER-STRUKTUR (Copy-Paste Vorlage)

```
# Businessplan [Firmenname] - Legal Tech SaaS mit KI

## 1. Executive Summary
[Kurzbeschreibung 1 Seite]

## 2. Unternehmensbeschreibung
[Firmenprofil, Vision, Mission]

## 3. Marktanalyse
[Marktgröße, Wettbewerb, Zielgruppe]

## 4. Produkt & Technologie
[Innovation, USPs, Roadmap]

## 5. Business Modell
[Umsatzströme, Preisstrategie]

## 6. Marketing & Vertrieb
[Go-to-Market Strategie]

## 7. Team & Organisation
[Gründer, Berater, Struktur]

## 8. Finanzplanung
[Umsatz, Kosten, ROI]

## 9. Innovationskonzept
[Forschungsfragen, Patentstrategie]

## 10. Risikoanalyse
[Risiken, Maßnahmen]

## 11. Fördermittel-Argumentation
[Warum FFG/AWS, Verwendungszweck]
```

Dieser Prompt ist perfekt strukturiert für FFG und AWS Förderungen in Österreich!
