# KRITIS-Readiness App · Produktpaket P3

Produktpaket P3 hebt die App von der Identitätsschicht auf die nächste Betriebsstufe: **produktive Daten- und Evidenzplattform mit Objektablage und Retention**.

Die Branchen-Engine aus P1 und die produktive Identität aus P2 bleiben erhalten. P3 ergänzt nun den Lebenszyklus von Evidenzen:
- **Objektablage** über eine austauschbare Speicherabstraktion
- **Retention- und Review-Logik** je Mandant und Evidenz
- **geschützte Downloads** weiterhin über das Backend
- **Retentionsicht** im Plattformbereich

## Was P3 liefert

- **Objektablage-Abstraktion** für Evidenzen
  - `filesystem`
  - vorbereitete `supabase-storage`-Anbindung
- **Retention- und Review-Bewertung** für Evidenzen
- **serverseitige Upload- / Downloadlogik** über denselben Treiber
- **Retention Summary API** und neue Plattformsicht
- **erweiterte Dokumentledger-Daten** mit Speicher- und Lebenszyklusbezug
- **Systemjob `retention_review`**

## Start in Bolt

```bash
npm install --userconfig ./.npmrc
npm test
npm run build
npm run dev
```

## Wichtige Dateien

- `server/object-storage.js` – Speicherabstraktion für lokale Ablage und vorbereitete Supabase-Storage-Nutzung
- `server/evidence-platform.js` – Retention- und Review-Logik
- `server/object-storage.test.js` – Test für den lokalen Speicherpfad
- `server/evidence-platform.test.js` – Test für Retention- und Summary-Logik
- `server/index.js` – Upload-/Downloadpfade und Retention-Endpoint
- `src/views/PlatformView.tsx` – Plattformsicht mit Retention-Zusammenfassung
- `src/components/EvidenceCard.tsx` – Evidenzkarte mit Speicher- und Retentionsinfo
- `docs/OBJEKTABLAGE-UND-RETENTION.md` – Konfiguration und Architekturhinweise

## Umgebungsvariablen

Minimal für lokalen Betrieb:

```env
KRISENFEST_APP_MODE=demo
KRISENFEST_ANONYMOUS_ACCESS=true
```

Optional für Supabase Storage:

```env
KRISENFEST_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
KRISENFEST_SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
KRISENFEST_SUPABASE_STORAGE_BUCKET=krisenfest-evidence
KRISENFEST_SUPABASE_STORAGE_PREFIX=krisenfest-evidence
```

## Tests und Prüfpfad

```bash
npm test
npm run build
node --check server/index.js
node --check server/object-storage.js
node --check server/evidence-platform.js
```


## Formale Abschluss- und Übergabedokumente

- `P3-ABSCHLUSS.md` – formaler Abschluss von Produktpaket P3
- `UEBERGABEPROTOKOLL-GESAMTSTAND.md` – vollständiger Gesamtstand mit Zielbild, Ist-Stand, Restarbeit und Vorgehensplan
- `PHASEN-UND-SPRINTS.md` – verdichtete Phasen- und Paketübersicht

## Nächste sinnvolle Schritte

- **Produktpaket P4**: Refactoring, tiefere Observability, Pilotfreigabe und produktive Übergabe
