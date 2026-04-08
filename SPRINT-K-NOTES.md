# Sprint K – Notizen

## Ziel

Sprint K stärkt die technische Basis der KRITIS-Readiness App dort, wo der bisherige Prototyp die größten Risiken hatte: dateibasierte Zustandsablage, konfliktanfällige Mehrnutzerbearbeitung und zu lose gekoppelter Tenant-Kontext.

## Umgesetzt

- neue Persistenzschicht in `server/persistence.js`
- bevorzugter Modus: `sqlite-document-store`
- Fallback-Modus: `tenant-filesystem`
- Spiegelung zentraler Dokumente in JSON-Dateien bleibt erhalten
- Version und Zeitstempel für State-Dokumente
- Konflikterkennung über `expectedVersion`
- HTTP-409-Konfliktantwort bei zwischenzeitlich geändertem Zustand
- Erweiterung des Frontends um `stateVersion` und `stateUpdatedAt`
- Rückgabe der Versionsmetadaten auch bei Snapshot-Restore und Evidenzaktionen
- tenantbezogene Backup-Artefakte und Backup-Logs
- aktualisierte Programm- und Sprintübersicht bis Sprint O

## Tests

Geprüft mit:

```bash
npm test
npm run build
node --check server/index.js
node --check server/persistence.js
```

Aktueller Teststand:
- 11 automatisierte Node-Tests erfolgreich

## Wichtige Einschränkung

Der bevorzugte SQLite-Pfad nutzt `node:sqlite`. Falls diese Laufzeitfunktion in der Zielumgebung fehlt, schaltet die App automatisch auf den vorhandenen Dateispeicher zurück. Der Arbeitsstand bleibt dann lauffähig, aber der SQLite-basierte Dokumentenspeicher steht dort nicht zur Verfügung.

## Nächster Schritt

Sprint L mit Pack-Registry, serverseitiger Versionierung, Freigabeprozess und Overlay-Engine.
