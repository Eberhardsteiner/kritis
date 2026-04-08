# Phase 6 – Mehrmandantenbetrieb, Anmeldung und Dokumentenrevision

## Neu in Phase 6
- serverseitige Anmeldung mit Sitzungen
- Mandantentrennung im Backend
- Zugriffskonten je Mandant
- versionierte Dokumentenablage mit SHA-256-Checksummen
- Wiederherstellung historischer Dokumentversionen
- erweiterter Plattformbereich für Login, Mandanten, Konten, Ledger und Snapshots
- Arbeitsprofil im Frontend wird bei aktiver Serversitzung aus der Anmeldung abgeleitet

## Technische Hinweise
- `npm run dev` startet Frontend und Backend gemeinsam
- der Backend-Port ist fest auf `8787` ausgerichtet, damit das Vite-Proxying in Bolt zuverlässig funktioniert
- `server-storage` wird beim ersten Start automatisch angelegt
- ohne vorhandene Daten wird ein Demo-Mandant mit Standardkonto erzeugt

## Demo-Zugang
- E-Mail: `admin@krisenfest.local`
- Passwort: `Krisenfest2026!`

## Bedienlogik
- ohne Serversitzung bleibt der Browser-Fallback aktiv
- mit Serversitzung sind Daten, Snapshots, Audit-Log und Dateiversionen mandantenspezifisch
- serverseitige Rollen begrenzen Änderungen zusätzlich zur Frontend-Ansicht

## Dokumentenhistorie
- neue Datei-Uploads erzeugen unveränderliche Versionseinträge
- die aktive Dateireferenz kann entfernt werden, historische Versionen bleiben erhalten
- historische Versionen können wieder als aktuelle Version gesetzt werden
