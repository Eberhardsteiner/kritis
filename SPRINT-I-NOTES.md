# Sprint I – Sicherheitsbasis

## Umgesetzt
- sichtbare Umbenennung auf **KRITIS-Readiness** in den zentralen Oberflächen, Dossiers und Reportbezeichnungen
- Trennung zwischen Demo- und Produktivmodus über Runtime-Konfiguration
- offener Arbeitsbereich nur noch als **Lesemodus** ohne Anmeldung
- anonymer Serverkontext jetzt mit Viewer-Rechten statt Admin-Rechten
- geschützte Downloads ohne Session-Token in Query-Strings
- Server-Health und Bootstrap liefern App-Modus sowie Anonymous-Status zurück
- geschützte Systemendpunkte für Plattform, Readiness und Integrität
- CORS-Allowlist, Helmet-Headers und einfache Rate Limits
- Upload-Allowlist nach MIME-Typ und Dateiendung
- vorbereiteter Antivirus-Hook mit Mock-EICAR-Testmodus
- erste automatisierte Tests für Sicherheitshelfer

## Wichtige Betriebsmodi
- **Demo-Modus**: anonymer Lesemodus möglich, Bearbeitung erst nach Anmeldung
- **Produktivmodus**: Anmeldung standardmäßig erforderlich

## Hinweise für Bolt
```bash
npm install --userconfig ./.npmrc
npm test
npm run build
npm run dev
```
