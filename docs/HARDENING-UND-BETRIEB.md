# Hardening und Betrieb ab Sprint O

Sprint O ergänzt die KRITIS-Readiness App um einen produktionsnahen technischen Unterbau. Ziel ist keine vollständige Enterprise-Plattform, sondern ein belastbarer Mindeststandard für Härtung, Transparenz und Wiederanlauf.

## Enthaltene Betriebsbausteine

### 1. Security Gates

Die Security Gates verdichten zentrale technische Risiken in einer kompakten Übersicht. Bewertet werden unter anderem:

- Betriebsmodus und Pflichtanmeldung
- anonymer Zugriff
- Standardpasswörter
- Bootstrap-Secret-Handhabung
- CORS-Allowlist
- signierte Webhooks
- öffentliche API-Clients
- Upload-Prüfung / Antivirus-Hook
- Observability-Modus
- Request-Härtung
- vorhandene Restore-Drills
- Anzahl aktiver Systemadministrationskonten

### 2. Observability

Die App erhebt nun eine leichtgewichtige Telemetrie für den laufenden Betrieb:

- eindeutige Request-ID pro Anfrage
- Gesamtanzahl, aktive Requests und Fehlerquote
- Routenstatistik mit Mittelwert und P95-Latenz
- jüngste Sicherheits- und Fehlerereignisse

Diese Telemetrie ist bewusst lokal und anwendungsnah. Sie ist ein praktikabler Startpunkt für Bolt, ersetzt aber noch kein externes Log- oder Tracing-System.

### 3. Restore-Drills

Restore-Drills sind als eigener Systemjob umgesetzt. Sie prüfen je Mandant:

- ob ein lesbares Backup-Artefakt vorhanden ist
- ob das Backup aktuell genug ist
- ob Snapshots vorhanden sind
- welche Empfehlungen sich daraus für den Wiederanlauf ergeben

Das Ergebnis wird als Artefakt gespeichert und in der Betriebsansicht zusammengefasst.

### 4. Request-Härtung

Vor der eigentlichen Request-Verarbeitung greift eine einfache Schutzschicht gegen offensichtliche Angriffs- und Missbrauchsmuster. Abgedeckt sind insbesondere:

- Traversal-Sequenzen
- Nullbytes und Steuerzeichen
- triviale Payload-Signaturen
- Rate-Limit-Ereignisse mit Security-Logging

### 5. Live- und Ready-Probes

Für Hosting- und Integrationszwecke stellt das Backend zwei Betriebschecks bereit:

- `/api/health/live`
- `/api/health/ready`

Damit lässt sich unterscheiden, ob der Prozess läuft und ob die Anwendung betriebsbereit ist.

## Grenzen des jetzigen Stands

Sprint O ist eine starke technische Verbesserung, aber noch nicht die Endstufe einer Enterprise-Härtung. Noch nicht umgesetzt sind insbesondere:

- zentrales externes Monitoring mit OpenTelemetry oder SIEM-Anbindung
- vollwertiges Secret-Management außerhalb von `.env` / Plattform-Secrets
- WAF auf Infrastruktur- oder Reverse-Proxy-Ebene
- automatisierte Restore-Drills in einer produktiven Pipeline
- formale Disaster-Recovery-Protokolle mit echten Wiederanlaufproben auf Zielsystemen

## Nächste sinnvolle Produktivschritte

- Hosting-Zielarchitektur festlegen
- SSO/OIDC sauber einführen
- Secret-Verwaltung auf Plattformniveau absichern
- Datenbank und Objektablage produktiv anbinden
- Restore- und Backup-Prozesse in echte Betriebsroutinen überführen
- Observability nach außen anbinden
