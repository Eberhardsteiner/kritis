# Sprint L · Umsetzungshinweise

## Inhalt des Sprints

Sprint L führt eine **serverseitige Pack-Registry** ein. Ziel ist, Branchenmodule und spätere Regulierungs-Overlays nicht nur lokal zu laden, sondern versioniert, freigegeben und wieder zurückrollbar im Serverkontext zu verwalten.

## Umgesetzte Deliverables

- Pack-Import für
  - **Vollmodule**
  - **Overlay-Pakete** mit `packType: "overlay"`
- **SemVer-Prüfung** für Paketversionen
- **Registry-Endpunkte** im Backend
- **Freigabe**, **Rollback** und **Stilllegung** von Paketversionen
- **wirksamer Modulkatalog** aus Basis + Uploads + Registry + Overlays
- **optionale Supabase-REST-Persistenz** als externer Datenbankpfad
- Pack- und Overlay-Tests im Backend

## Neue API-Routen

- `GET /api/modules/registry`
- `POST /api/modules/registry/import`
- `POST /api/modules/registry/:entryId/activate`
- `POST /api/modules/registry/:entryId/retire`

## JSON-Formate

### Vollmodul

Unverändert auf Basis des bestehenden Modulschemas.

### Overlay-Paket

Neues Envelope-Format:

```json
{
  "packType": "overlay",
  "targetModuleId": "energy",
  "module": {
    "id": "de-energy-kritis-overlay",
    "version": "1.0.0"
  }
}
```

## Persistenz ab Sprint L

Startreihenfolge:

1. **Supabase REST Store**
2. **SQLite-Dokumentenspeicher**
3. **Dateifallback**

## Prüflauf

Lokal erfolgreich ausgeführt:

```bash
npm test
npm run build
node --check server/index.js
node --check server/persistence.js
node --check server/persistence-supabase.js
node --check server/module-packs.js
```

## Nächster Schritt

**Sprint M** trennt die deutsche Regulatorik in zwei Regelregime:

- **BSIG / NIS2**
- **KRITIS-Dachgesetz**

Darauf aufbauend folgen Fristen, Meldeflüsse und Regime-spezifische Reports.
