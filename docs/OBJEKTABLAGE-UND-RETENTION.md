# Objektablage und Retention in Produktpaket P3

Produktpaket P3 führt eine austauschbare Speicherabstraktion für Evidenzen ein.

## Speicherpfade

Die App nutzt jetzt zwei Treibertypen:

- `filesystem`
  - lokal geprüft
  - Dateien liegen im tenantbezogenen Serverbereich
- `supabase-storage`
  - vorbereitet für Bolt / Supabase
  - Nutzung über den Backend-Server, nicht direkt aus dem Browser

## Auswahl des Speichertreibers

Reihenfolge:
1. Supabase Storage, wenn `KRISENFEST_SUPABASE_URL`, `KRISENFEST_SUPABASE_SERVICE_ROLE_KEY` und `KRISENFEST_SUPABASE_STORAGE_BUCKET` gesetzt sind
2. lokaler Dateispeicher

## Retention-Logik

Retention und Review werden aus zwei Ebenen abgeleitet:

- Mandantenrichtlinien
  - `retentionDays`
  - `evidenceReviewCadenceDays`
- Evidenzdaten
  - `reviewCycleDays`
  - `reviewDate`
  - Upload- / Erstellungsdatum

## Server-Endpunkte

- `GET /api/document-ledger/summary`
- `GET /api/evidence-retention/summary`
- `POST /api/evidence/:evidenceId/attachment`
- `GET /api/files/:storedFileName`

## Hinweise

- Der lokale Dateispeicher wurde technisch geprüft.
- Die Supabase-Storage-Anbindung ist vorbereitet, aber in dieser Umgebung nicht gegen ein Live-Projekt getestet.
- Downloads laufen weiterhin geschützt über den Server, damit keine Storage-Secrets im Browser landen.
