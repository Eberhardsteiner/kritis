# Krisenfest App Phase 10

Phase 10 schließt den aktuellen Entwicklungszyklus mit einer eigenständigen Go-Live- und Übergabeschicht ab. Der Fokus liegt auf Härtung, Release-Gates, Betriebsdokumentation, Integritätsprüfung und einem finalen, serverseitig registrierten Übergabebündel.

## Neu in Phase 10

- neuer Bereich **Go-Live & Übergabe**
- **Rollout-Plan** mit Release-Version, Freeze, Go-Live, Hypercare und Entscheidungsstatus
- **Härtungschecklisten** für Produktionsreife, Backup/Restore, Integration und Support
- **Runbooks** für Betrieb, Notfall, Deployment, Wiederherstellung und Nachweisführung
- **Release-Gates** für formale Freigaben vor dem Go-Live
- **Integritätsübersicht** für Uploads, Versionen, Exporte und Backup-Artefakte
- serverseitig registrierbares **Übergabebündel**
- aktualisierte **Programm- und Sprintübersicht** bis Phase 10

## Start in Bolt

```bash
npm install --userconfig ./.npmrc
npm run dev
```

## Zugang und Betriebsmodus

Normales Arbeiten im offenen Arbeitsbereich bleibt ohne Anmeldung möglich. Für systemweite Administrationsfunktionen in **Betrieb & APIs** ist weiterhin eine Systemadministrationssitzung erforderlich.

Demo-Zugang für Administration:
- E-Mail: `admin@krisenfest.local`
- Passwort: `Krisenfest2026!`

## Technischer Stand

- Frontend: React + Vite + TypeScript
- Backend: Express
- Persistenz: mandantenfähiger Dateispeicher mit serverseitiger Export-, Snapshot- und Dokumentenspur
- Abschlussbaustein: Rollout-Plan, Härtung, Runbooks, Release-Gates und Übergabebündel
- Integrität: serverseitiger Scan für Uploads, Versionen, Exporte und Backups

## Projektlogik Phase 10

Phase 1 bis 9 haben die fachliche, operative und technische Plattform aufgebaut. Phase 10 setzt darauf den finalen Abschlussbaustein: Der Go-Live wird planbar, freigabefähig und revisionsnäher dokumentiert, ohne den offenen Arbeitsmodus in Bolt aufzugeben.


## Sprint I – Sicherheitsbasis

Dieser Stand trennt zwischen Demo- und Produktivmodus:

- `KRISENFEST_APP_MODE=demo` aktiviert standardmäßig einen offenen **Lesemodus** ohne Anmeldung.
- `KRISENFEST_APP_MODE=production` verlangt standardmäßig eine Anmeldung.
- `KRISENFEST_ANONYMOUS_ACCESS=false` deaktiviert den offenen Lesemodus zusätzlich explizit.
- `KRISENFEST_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com` setzt eine feste CORS-Allowlist.
- `KRISENFEST_BOOTSTRAP_PASSWORD=...` definiert das initiale Administrationspasswort für frische Systeme.
- `KRISENFEST_ENABLE_AV_SCAN=true` aktiviert den Antivirus-Hook.
- `KRISENFEST_AV_SCAN_MODE=mock-eicar` aktiviert den mitgelieferten Testmodus für EICAR-Signaturen.

Standard für lokale Demo-Installationen:

- Konto: `admin@krisenfest.local`
- Passwort: `Krisenfest2026!`

Das Passwort wird aus Sicherheitsgründen nicht mehr über die Oberfläche oder den Bootstrap-Endpunkt ausgegeben.
