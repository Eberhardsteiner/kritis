# Phase 3 – Erweiterung Governance, Audit und Zertifizierungssteuerung

## Neu in Phase 3

### 1. Governance & Struktur
- eigener Bereich für Rollen, Verantwortungen und Freigabebereiche
- Register für Stakeholder, Standorte und kritische Assets bzw. Services
- Review-Kalender mit Sponsor, Approver, nächstem Review und Auditfenster
- Standardrollen aus dem aktiven Branchenmodul ladbar

### 2. Benchmark- und Zielprofil
- Zielwerte je Branche und Domäne
- automatische Zielanpassung nach Unternehmensgröße
- Sicht auf größte Abweichungen zwischen Ist-Reife und Zielprofil

### 3. KRITIS-Auditlogik
- Audit-Checklist als interner Prüfkatalog
- Status je Prüfpunkt mit Notizen
- automatische Überführung offener Blocker in Audit-Feststellungen
- Feststellungen mit Schweregrad, Verantwortlichem, Termin und Status

### 4. Nachweisbibliothek
- Evidenzen um Version, Reviewer und Schutzklassifikation erweitert
- lokale Dateianhänge im Browser möglich
- Download und Entfernung einzelner Anhänge direkt an der Evidenz

### 5. Reporting
- erweitertes Management-Reporting
- CSV-Exporte für Stakeholder und Feststellungen
- formales Audit-HTML für Druck/PDF

## Technische Hinweise
- weiterhin React + Vite + TypeScript
- Bolt-freundlich vorbereitet
- `.npmrc` mit öffentlicher Registry enthalten
- bewusst ohne mitgeliefertes `package-lock.json`

## Nächste sinnvolle Ausbaustufe
- Benutzer- und Rollenrechte
- Dokumentenbibliothek mit Metadaten und Fristüberwachung
- Maßnahmen-Abhängigkeiten und Eskalationslogik
- PDF-Report mit Corporate Layout
- Mehrmandantenfähigkeit
