# Sprint O – Hardening und Betriebsreife

Sprint O erweitert den bereits fachlich ausgebauten Stand um eine technische Betriebs- und Sicherheitsbasis.

## Umgesetzt

- Security Gates im Bereich **Betrieb & APIs**
- Request-Telemetrie mit Request-IDs, Routenstatistik und Event-Feed
- Restore-Drills als neuer Systemjob
- Live- und Ready-Probes im Backend
- WAF-Lite / Request-Härtung gegen Traversal, Nullbytes und triviale Payload-Signaturen
- gehärtete Passwort- und Bootstrap-Logausgabe
- Korrektur der auswählbaren Persistenzoption **supabase-rest-store** im Systemprofil

## Serverseitige Endpunkte

- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/system/security-gates`
- `GET /api/system/observability`
- `GET /api/system/restore-drills`

## Tests

Erfolgreich geprüft wurden:

```bash
npm test
npm run build
node --check server/index.js
node --check server/hardening.js
```

Zusätzlich wurden die neuen Endpunkte sowie ein Restore-Drill gegen den laufenden Server getestet.

## Hinweise

- Der offene Arbeitsbereich bleibt lesbar, Admin-Betriebsfunktionen bleiben geschützt.
- Restore-Drills prüfen die vorhandenen Backup- und Snapshot-Artefakte und erzeugen ein eigenes JSON-Artefakt.
- Die Telemetrie ist bewusst leichtgewichtig und Bolt-kompatibel gehalten. Sie ersetzt noch kein vollwertiges zentrales Monitoring-System.
