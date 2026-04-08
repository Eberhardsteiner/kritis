# Sprint N · DACH-Overlays

Sprint N erweitert die KRITIS-Readiness App um eine belastbare DACH-Sicht.

Die App kann jetzt zwischen drei Jurisdiktionen umschalten:

- **Deutschland**
- **Österreich**
- **Schweiz**

Je nach Jurisdiktion werden Regime, Fristen, Hinweise, Reporting und Auditbausteine unterschiedlich dargestellt.

## Neu in Sprint N

- **Jurisdiktionsumschaltung** im Bereich **KRITIS-Readiness**
- DACH-Regime im Cockpit:
  - Deutschland: **KRITIS-Dachgesetz** und **BSIG / NIS2**
  - Österreich: **NISG 2026**
  - Schweiz: **BACS-Meldepflicht für kritische Infrastrukturen**
- **länderspezifische Anforderungen** und **Audit-Checklisten**
- **jurisdiktionsabhängige Fristenlogik** im Compliance-Kalender
- **jurisdiktionsabhängige Berichtstexte** in Reporting und Exporten
- neue serverseitige **DACH-Normalisierung** und **Tests**
- aktualisierte Sprint- und Phasenübersicht mit **Sprint N abgeschlossen**

## Technische Umsetzung

### Frontend

- `src/lib/regulatory.ts`
  - DACH-fähige Normalisierung des Regulatory Profiles
  - Regime-Definitionen je Jurisdiktion
  - länderspezifische Einordnungstexte
- `src/lib/workspace.ts`
  - Fristenlogik für DE, AT und CH
- `src/lib/scoring.ts`
  - Jurisdiktionslogik für erste regulatorische Relevanzbewertung
- `src/views/KritisView.tsx`
  - Jurisdiktion wählbar
  - Cockpit, Meldelogik und Auditstatus jetzt länderspezifisch
- `src/views/ReportView.tsx`
  - Reportingkarten mit länderspezifischer Regimeausgabe
- `src/lib/exporters.ts`
  - PDF-, Markdown- und HTML-Exporte mit DACH-Regimeabschnitten

### Datenbasis

- `src/data/kritisBase.ts`
  - neue Regime-Definitionen für Österreich und Schweiz
  - neue Anforderungen und Auditchecklisten
  - Zuordnung der Regime nach Jurisdiktion

### Backend

- `server/regulatory-dach.js`
  - serverseitige Normalisierung des Regulatory Profiles
  - DACH-Regime und Meldefenster
- `server/regulatory-dach.test.js`
  - Tests für Normalisierung, Regimefilterung und Meldefenster
- `server/index.js`
  - Anbindung an die neue DACH-Regellogik

## Tests und Prüfpfad

Erfolgreich geprüft wurden:

```bash
npm test
npm run build
node --check server/index.js
node --check server/regulatory-dach.js
```

## Inhaltlicher Status

Mit Sprint N sind umgesetzt:

- Deutschland-Regime getrennt
- Österreich-Overlay
- Schweiz-Overlay
- Jurisdiktionsabhängige Fristen und Reports

Offen bleibt danach noch **Sprint O** für Hardening, Observability, Restore-Drills und produktionsnahe Betriebsreife.
