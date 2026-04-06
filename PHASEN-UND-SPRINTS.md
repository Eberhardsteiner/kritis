# Phasen und ihre Zugehörigkeit zu den Sprints

## Sprint 1

### Phase 1
- Projektgrundgerüst
- Grundanalyse über Resilienzdimensionen
- Scoring-Logik
- JSON-Import für Branchenmodule
- erste KRITIS-Readiness-Struktur

### Phase 2
- Maßnahmenmanagement
- Evidenzverwaltung
- verbesserte Analyseoberfläche
- Reporting-Grundlagen
- interner Audit- und Readiness-Workflow

## Sprint 2

### Phase 3
- Governance und Struktur
- Stakeholder, Standorte, Assets
- Zielprofil und Benchmark
- Auditchecklisten und Vor-Audit-Reife
- Nachweisbibliothek mit Versionierung im Frontend

### Phase 4
- Rollen- und Rechteoberfläche
- Compliance-Kalender
- Dokumentenbibliothek
- PDF-Exporte
- Erweiterung der JSON-Containerlogik um Dokumentenordner und Evidenzmetadaten

## Sprint 3

### Phase 5
- Express-Backend
- serverseitige Zustandsablage
- Uploads für Evidenzen
- Audit-Log
- Plattform- und Sync-Bereich

### Phase 6
- Sitzungen und Anmeldung im Backend
- echte Mandantentrennung
- Zugriffskonten je Mandant
- versionierte Dokumentenablage mit Prüfsummen
- Wiederherstellung historischer Versionen

## Sprint 4

### Phase 7
- offener Arbeitsbereich ohne Pflichtanmeldung
- optionaler Login nur für Administration
- BIA-Register
- Abhängigkeiten, Szenarien und Übungen
- operative Resilienzvorlagen je Branche

## Sprint 5

### Phase 8
- Programm- und Sprintsicht
- Exportregister mit revisionssicheren Paketen
- Freigabeworkflow für Berichtspakete
- KRITIS-Readiness-Dossiers
- Mandantenrichtlinien für Evidenzen, Klassifikation und Freigabe

## Sprint 6

### Phase 9
- Bereich **Betrieb & APIs**
- Systemprofil für Hosting-, Persistenz- und API-Parameter
- Hosting-Readiness mit technischer Prüfliste
- API-Clients mit Secret-Ausgabe, Rotation und Widerruf
- Integrationsendpunkte auf API-Key-Basis
- Systemjobs für Backup, Integritätsscan und Exportinventar
- erweiterte Mandantenverwaltung mit Region, Tier und Kontakten

### Phase 10
- Bereich **Go-Live & Übergabe**
- Rollout-Plan mit Release- und Freeze-Steuerung
- Härtungschecklisten, Runbooks und Release-Gates
- serverseitiger Integritätsscan
- finales Übergabebündel und Abschlussdokumentation

## Gesamtbild

- **Sprint 1 bis 6** sind inhaltlich abgebildet.
- **Phase 1 bis 10** sind umgesetzt.
- Der aktuelle Stand ist ein vollständiger Produktprototyp mit offener Nutzung in Bolt und optionalen Administrationsfunktionen.
- Weitere Arbeiten wären nun produktive Ausbauphasen, nicht mehr Teil des aktuellen Sprintplans.


## Sprint I
- Umbenennung der sichtbaren Fachsprache auf **KRITIS-Readiness**
- Trennung von Demo- und Produktivmodus
- offener Lesemodus ohne Anmeldung, Bearbeitung nur nach Login
- geschützte Downloads ohne Session-Token in URLs
- CORS-Allowlist, Sicherheits-Header, Rate Limits und Upload-Allowlist
- vorbereiteter Antivirus-Hook mit Mock-EICAR-Test
