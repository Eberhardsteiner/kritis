# Demo-Zugang · Login-Credentials für die UVM-Demo

> **Zweck**: Prominente Referenz der Demo-Zugangsdaten. Bei jeder Bolt-Preview, jedem `npm run demo:reset:fresh` und jedem `npm run demo:reset:ready` sind diese Credentials nach maximal 20 Sekunden funktionsfähig — abgesichert durch `seedDemoAdminIfMissing()` in `server/services/storage-init.js`.

## Primärer Demo-Admin

| Feld | Wert |
|---|---|
| E-Mail | `admin@krisenfest.demo` |
| Passwort | `Krisenfest2026!` |
| Rolle | `admin` |
| System-Admin | `true` |
| Tenant-Zuordnung | Erster verfügbarer Tenant (typisch `Demo-Unternehmen` oder `Klinikverbund Donau-Ries gGmbH`) |

## Login-Pfad in der App

1. App öffnen (lokal: `http://localhost:5173`; Bolt: Preview-URL aus dem Bolt-Container).
2. Sidebar → **Plattform & Sync**.
3. Sektion **Optionaler Login** → E-Mail und Passwort eingeben.
4. Nach erfolgreichem Login: die Admin-Topbar zeigt den Namen „Demo-Admin", Edit-Buttons werden aktiv, der Menüpunkt **Branchenmodule** erlaubt Pack-Import und Pack-Aktivierung.

## Garantien des Seed-Mechanismus

`seedDemoAdminIfMissing()` läuft bei jedem Server-Start (Teil von `initializeStorage`, unmittelbar nach `seedFreshSystemIfEmpty`):

- **Fehlt der Account**: wird mit den oben dokumentierten Werten neu angelegt und in den ersten verfügbaren Tenant als Admin eingebunden.
- **Existiert der Account**: wird das Passwort deterministisch auf `Krisenfest2026!` zurückgesetzt, `isSystemAdmin` und `status: 'active'` werden garantiert, Tenant-Membership wird wiederhergestellt, falls sie fehlt.

Das heißt: Selbst wenn das Passwort in einer früheren Demo geändert wurde oder Bolt's Sync den Account zurücksetzt, genügt ein Server-Restart (automatisch Teil jedes `npm run demo:reset:*`), um die dokumentierten Credentials wieder funktionsfähig zu machen.

## Sicherheits-Gate

Der Seed-Mechanismus ist **nicht** bedingungslos aktiv. Er greift nur, wenn eine der folgenden Bedingungen zutrifft:

- `runtimeConfig.appMode !== 'production'` (Dev, Demo, Bolt-Preview, Staging), **oder**
- `KRISENFEST_SEED_DEMO_ADMIN=true` (bzw. `1` oder `yes`) als Umgebungsvariable gesetzt ist.

In produktiven Installationen bei Pilotkunden ist der Demo-Admin damit **nicht automatisch vorhanden**. Dort kommt der reguläre Bootstrap-Pfad (`INITIAL_BOOTSTRAP_PASSWORD` aus `KRISENFEST_BOOTSTRAP_PASSWORD` oder einem zur Laufzeit generierten Base64-Random) zum Tragen — siehe `server/services/storage-init.js`, Abschnitt `seedFreshSystemIfEmpty`.

## Bolt-Hosting-Spezifika

Wenn Bolt den Container als `NODE_ENV=production` startet, muss zusätzlich `KRISENFEST_SEED_DEMO_ADMIN=true` in Bolt's Umgebungs-Config gesetzt werden, damit der Seed-Mechanismus greift. Ohne diese Variable bleibt der Demo-Admin in einer Produktions-Umgebung ungesät — bewusstes Verhalten zum Schutz echter Kundeninstallationen.

## Legacy-Seed (parallel aktiv)

Parallel legt `seedFreshSystemIfEmpty` bei komplett leerem System einen weiteren Admin an:

- E-Mail: `admin@krisenfest.local`
- Passwort: `Krisenfest2026!` (bzw. `KRISENFEST_BOOTSTRAP_PASSWORD`, wenn gesetzt)

Dieser Legacy-Admin ist keine Demo-Pflicht, sondern der initiale Tenant-Owner. Für die UVM-Demo ist **der Demo-Admin (`@krisenfest.demo`) der primäre Login**, weil er idempotent re-seeded wird und der `.local`-Account nach einer manuellen Passwort-Änderung oder einer Bolt-Regression evtl. nicht mehr funktioniert.

## Verifikation nach einem Reset

```bash
# 1. Reset ausführen
npm run demo:reset:fresh

# 2. Warten auf Health-Check (Teil des Scripts, ~12–20 s)

# 3. In der App einloggen
# Sidebar → "Plattform & Sync" → Login-Sektion → admin@krisenfest.demo / Krisenfest2026!

# 4. Prüfen: Admin-Topbar zeigt "Demo-Admin", Edit-Buttons aktiv,
#    Branchenmodule-Menü zeigt "Pack importieren"-Button.
```

Der Demo-Admin ist bei der Demo-Sitzung mit Kollegen **die einzige empfohlene Login-Kombination**. Alle in `docs/DEMO-CLICK-PATHS.md` beschriebenen Klick-Pfade starten nach diesem Login.
