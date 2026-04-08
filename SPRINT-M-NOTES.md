# Sprint M · Deutschland-Regelwerk

## Ziel

Sprint M trennt das deutsche Regelwerk in der App sauber in zwei Regime:

- **KRITIS-Dachgesetz** für physische und organisatorische Resilienz
- **BSIG / NIS2** für Cyber-Risikomanagement, Vorfallmeldungen und IT-bezogene Nachweise

Damit werden Pflichten, Fristen, Checklisten und Reports nicht mehr als ein einheitlicher Block behandelt.

## Neu in Sprint M

- **Regelwerks-Cockpit Deutschland** im Bereich **KRITIS-Readiness**
- eigener **Scope-Status je Regime**
- eigener **Owner**, Review-Datum und Hinweise für das Deutschland-Profil
- neue **BSIG-Einstufung** im Profil
- getrennte **Anforderungslisten** für:
  - KRITIS-Dachgesetz
  - BSIG / NIS2
- getrennte **Audit-Checklisten** für beide Regime
- getrennte **Fristenlogik** im Compliance-Kalender
- getrennte **Reportabschnitte** für Management- und Audit-Exporte
- serverseitige **Normalisierung des Regulatory Profiles**
- neue **Backend-Tests** für Regime-Logik und Meldezeiträume

## Fachliche Wirkung

Die App unterscheidet jetzt explizit zwischen:

1. **Resilienzpflichten nach KRITIS-Dachgesetz**
   - Registrierung und Scoping
   - Risikoanalyse
   - Resilienzmaßnahmen
   - Resilienzplan
   - Nachweise, Audits und Prüfpfad

2. **Cyber-Pflichten nach BSIG / NIS2**
   - Entity-Klassifikation
   - Registrierung
   - Cyber-Risikomanagement
   - gestufte Vorfallmeldungen
   - IT-bezogene Nachweise und Audits

## Wichtige technische Dateien

- `src/data/kritisBase.ts`
- `src/lib/regulatory.ts`
- `src/lib/workspace.ts`
- `src/views/KritisView.tsx`
- `src/views/ReportView.tsx`
- `src/lib/exporters.ts`
- `server/regulatory-germany.js`
- `server/regulatory-germany.test.js`
- `server/index.js`

## Validierung

Im Sprint-M-Stand wurden erfolgreich ausgeführt:

```bash
npm test
npm run build
node --check server/index.js
node --check server/regulatory-germany.js
```

## Nächster sinnvoller Schritt

**Sprint N**:

- DACH-Overlays
- Österreich: NISG 2026
- Schweiz: Meldeoverlay
- Jurisdiktionswechsel in Report- und Pflichtlogik
