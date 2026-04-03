# Krisenfestigkeit Monitor – Phase 5

Bolt-fähige React/Vite-Anwendung zur Bewertung der Krisenfestigkeit von Unternehmen mit Branchenmodulen, Maßnahmenmanagement, Nachweisbibliothek, KRITIS-Workflow und leichtgewichtigem API-Backend.

## Start
```bash
npm install
npm run dev
```

`npm run dev` startet in Phase 5 sowohl das Vite-Frontend als auch das Express-Backend.

## Enthalten
- Grundanalyse über 8 Resilienzdimensionen
- Branchenmodule per JSON
- Maßnahmen- und Evidenzmanagement
- Governance, Rollen- und Rechteprofile
- KRITIS-Readiness, Audit-Checklist und Feststellungen
- Reporting, PDF-Exporte und Audit Pack
- Serverseitige Synchronisierung, Dateiuploads, Snapshots und Audit-Log

## Hinweise für Bolt
- ZIP lokal entpacken und die Dateien in ein leeres Projekt ziehen
- `.npmrc` ist enthalten
- kein problematisches `package-lock.json` mitliefern
- der Ordner `server-storage` wird beim ersten Start automatisch erzeugt
