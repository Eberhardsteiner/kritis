# Phasen, Sprints und Produktpakete der KRITIS-Readiness App

## Umgesetzt

### Sprint 1 bis 6
- Phase 1 bis 10: fachliches Fundament, Maßnahmen, Evidenzen, Governance, Dokumente, Backend, Sync, BIA, Dossiers, Betrieb, Go-Live

### Sprint I bis O
- Sicherheitsbasis, Test- und Engineering-Basis, Persistenz, Pack-Registry, Deutschland-Regelwerk, DACH-Overlays, Hardening und produktionsnahe Betriebsreife

### Produktpaket P1
- Branchen-Engine mit standardisiertem Containerformat
- integrierte Kernmodule ebenfalls als Container
- erster referenzfähiger **Industrie-Kerncontainer**
- Registry versteht jetzt Container und Legacy-JSON
- Modulverwaltung zeigt Manifest, Herkunft, Format und Overlay-Wirkung

### Produktpaket P2
- produktive Identität mit lokalen Konten und **OIDC-SSO**
- sichtbare Auth-Provider im Bootstrap und in der Plattformsicht
- PKCE-, State- und Ticket-basierter Rückweg in die SPA
- serverseitige Rollen-, Mitgliedschafts- und Tenant-Zuordnung
- Kontotypen **local**, **oidc** und **hybrid**
- Identity-Linking für externe Benutzeridentitäten

### Produktpaket P3
- austauschbare Objektablage für Evidenzen
- lokaler Speichertreiber technisch geprüft
- vorbereiteter **Supabase-Storage**-Treiber
- Retention- und Review-Logik für Evidenzen
- neue Retention-Zusammenfassung in Plattform und API
- Dokumentledger mit Speicher- und Lebenszyklusbezug
- formaler Abschluss mit Übergabeprotokoll und Dokumentationsstand **2.0.1**

## Geplant

### Produktpaket P4
- Refactoring der großen Frontend- und Serverdateien
- Ausbau der Test- und Monitoringstrecke
- Pilotfreigabe für ersten Kundeneinsatz
- produktionsnahe Übergabe- und Betriebsdokumentation

## Gesamtbild

- **Sprint 1 bis 6** sind umgesetzt.
- **Sprint I bis O** sind umgesetzt.
- **Produktpaket P1** ist umgesetzt.
- **Produktpaket P2** ist umgesetzt.
- **Produktpaket P3** ist umgesetzt.
- Die App ist jetzt fachlich breit, als Branchen-Engine vorbereitet und um produktive Identitäts-, Speicher- und Evidenz-Lebenszyklusbausteine erweitert.
- Der nächste sinnvolle Schritt ist **P4** mit Refactoring, Pilotfreigabe und produktiver Übergabe.

## Empfohlene Folgepakete

### Produktpaket P5
- produktive Plattformanbindung außerhalb von Bolt
- finale DB- und Objektablageverdrahtung
- Secret-Management, externe Observability, Restore-Automatisierung

### Produktpaket P6
- Pilotbetrieb mit erstem Mandanten
- UAT, Schulung, Rollout- und Übergabestrecke
- geregelte Betriebs- und Supportpfade
