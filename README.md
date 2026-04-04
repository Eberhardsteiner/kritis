# Krisenfestigkeit Monitor – Phase 6

Bolt-fähige React/Vite-Anwendung zur Bewertung der Krisenfestigkeit von Unternehmen mit Branchenmodulen, Maßnahmenmanagement, Nachweisbibliothek, KRITIS-Workflow sowie Mehrmandanten-Backend mit Anmeldung und revisionsfähiger Dokumentenhistorie.

## Start
```bash
npm install
npm run dev
```

`npm run dev` startet in Phase 6 sowohl das Vite-Frontend als auch das Express-Backend. Das Backend nutzt standardmäßig Port `8787`, damit das Vite-Proxying in Bolt stabil bleibt.

## Enthalten
- Grundanalyse über 8 Resilienzdimensionen
- Branchenmodule per JSON
- Maßnahmen- und Evidenzmanagement
- Governance, Rollen- und Rechteprofile
- KRITIS-Readiness, Audit-Checklist und Feststellungen
- Reporting, PDF-Exporte und Audit Pack
- Serverseitige Synchronisierung, Dateiuploads, Snapshots und Audit-Log
- Anmeldung, Mandantentrennung und serverseitige Zugriffskonten
- Versionierte Dokumentenhistorie mit Checksummen und Wiederherstellung

## Hinweise für Bolt
- ZIP lokal entpacken und die Dateien in ein leeres Projekt ziehen
- `.npmrc` ist enthalten
- kein problematisches `package-lock.json` mitliefern
- der Ordner `server-storage` wird beim ersten Start automatisch erzeugt
- Demo-Zugang nach Erststart: `admin@krisenfest.local` mit Passwort `Krisenfest2026!`
