# Pflege der KRITIS-Indikatoren

Die Indikatoren-Konfiguration steuert den Betroffenheits-Check. Sie wird zur Laufzeit gelesen — keine Code-Änderung notwendig, nur ein Build + Deploy.

## Was hier konfiguriert wird

[src/data/kritisIndicators.json](../src/data/kritisIndicators.json) enthält:

- **Stage 1 (direkt)**: Sektor-Liste, sektorspezifische kritische Dienstleistungen, Schwellenwerte für versorgte Personen, Mitarbeitende, Umsatz
- **Stage 2 (Lieferkette)**: Umsatzanteil-Slider, Vertrags-Pflichten-Booleans, Single-Source-Boolean, KRITIS-Kunden-Sektoren, Service-Typen
- **Stage 3 (Kontext)**: NIS2-/DORA-Status, Behördenkontakt-Flag

Plus zwei Metadaten-Felder oben:

- `version`: kurzer String wie `"2026-04"`. Wird im PDF-Disclaimer als "Stand der Indikatoren-Konfiguration" angezeigt.
- `lastReviewed`: ISO-Datum des letzten fachlichen Reviews. Erscheint in der Privacy-View als "Stand".

## Typische Änderungen

### Schwellenwert ändern

Beispiel: Personenschwelle von 500.000 auf 100.000 absenken (sektorspezifische KRITIS-Verordnung tritt in Kraft):

```json
{
  "id": "personsServed",
  "type": "number",
  "label": "Wie viele Personen versorgen Sie pro Jahr (geschätzt)?",
  "thresholds": [
    { "value": 100000, "level": "high" },
    { "value": 25000, "level": "medium" }
  ]
}
```

**Wichtig:** Die Engine [src/lib/applicability.ts](../src/lib/applicability.ts) hat die "magischen Zahlen" 500000 / 100000 / 50 / 250 etc. heute teilweise hartcodiert (nicht aus dem JSON gelesen). Nach einer Schwellen-Änderung müssen ggf. die Vergleichswerte in `evaluateApplicability()` angepasst werden. Die Tests in [src/lib/applicability.test.ts](../src/lib/applicability.test.ts) decken diese Werte ab.

### Sektor hinzufügen

Im `stage1_direct.indicators` → `sector` → `options` einen neuen Eintrag ergänzen:

```json
{ "value": "neuer_sektor", "label": "Neuer Sektor" }
```

Plus im `criticalService.optionsBySector` einen neuen Schlüssel mit den sektorspezifischen Diensten.

Außerdem in [src/lib/sectorToModule.ts](../src/lib/sectorToModule.ts) eine Modul-Empfehlung hinterlegen, damit der SectorPicker einen Vorschlag macht.

### Indikator-Typ wechseln

Erlaubte Typen: `select` | `number` | `boolean` | `slider` | `multiselect`. Die Discriminated Union in [src/types.ts](../src/types.ts) (`Indicator`) zeigt die Felder pro Typ. Wenn ein neuer Typ ergänzt wird:

1. Type in `Indicator`-Union aufnehmen
2. `IndicatorRenderer` ([src/components/IndicatorRenderer.tsx](../src/components/IndicatorRenderer.tsx)) um den neuen Branch ergänzen
3. Eigene Input-Komponente in `src/components/inputs/` anlegen

## Test-Workflow

1. JSON-Änderung machen
2. `npm test` laufen lassen — 5 `applicability`-Tests dürfen nicht brechen
3. `npm run dev` starten und im Browser den `/check`-Flow durchspielen
4. `version` + `lastReviewed` bumpen
5. `git commit` + Deploy

## Wer pflegt das?

**Empfehlung:** Quartalsweises Review durch Dr. Steiner oder einen fachkundigen Reviewer. Plus ad-hoc bei:

- Inkrafttreten der KRITIS-Rechtsverordnung (sektorspezifische Schwellen)
- Änderungen am NIS2-Anwendungsbereich
- Änderungen an DORA-Schwellen für den Finanzsektor
- Änderungen an der österreichischen NISG / Schweizer ISG (heute nur in `assessKritisApplicability` aus Phase 1 abgebildet, nicht im JSON)

## Weitere Hooks

Die `KritisApplicability`-Funktion in [src/lib/scoring.ts](../src/lib/scoring.ts) (aus Phase 1) deckt zusätzlich AT/CH-Jurisdiktion ab. Wenn diese aktiv genutzt werden soll, ist eine Verzweigung in der UI nötig (heute Default `'DE'`).
