# Feature: Risikokatalog (B3 · All-Gefahren-Ansatz)

## Zweck

Strukturierte Erfassung und Bewertung einer Betreiber-Risikoanalyse nach **§ 12 KRITISDachG**
(All-Gefahren-Ansatz). UVM-Berater können in Kundenprojekten geführt Risiken identifizieren,
bewerten, verknüpfen und in einem § 12-konformen Dokument exportieren.

## Taxonomie

Sechs Hauptkategorien, jede mit 3–8 Unterkategorien:

| Kategorie | Beispiele |
|---|---|
| **Naturgefahren** | Hochwasser, Starkregen, Sturm, Schneelast, Erdbeben, Hitzewelle, Kältewelle, Waldbrand |
| **Technische Gefahren** | Stromausfall, Kommunikationsausfall, IT-Ausfall, Anlagenbrand, Explosion, Lieferkettenunterbrechung |
| **Menschliche Gefahren · intentional** | Sabotage, Terror, Insider-Angriff, physischer Einbruch, Drohnen-Vorfall |
| **Menschliche Gefahren · nicht intentional** | Bedienfehler, Fachkräftemangel, Streik, Pandemie |
| **Interdependenzen** | Kaskadeneffekte über Sektorgrenzen, Abhängigkeit von externen Dienstleistern |
| **Cyber-physische Kaskaden** | OT-Übergriff, Malware mit physischer Auswirkung, Ransomware auf Produktionssysteme |

Jede Unterkategorie trägt `id`, `label`, `beschreibung`, `typischeIndikatoren` und `verlinkungZu`
(verknüpfte Requirements oder Maßnahmen).

## Dateien

```
src/features/riskCatalog/
├── README.md          Dieser Überblick
├── types.ts           RiskEntry, RiskCategoryId, RiskSubCategory
├── taxonomy.ts        Die sechs Kategorien mit allen Unterkategorien (Data)
├── schema.ts          Zod-Schemas für RiskEntry und Import/Export
├── analysis.ts        (B3.2) 5×5-Matrix, Kritikalitätsklassen, Aggregation
├── views/             (B3.3) RiskMatrixView, RiskEntryForm, RiskRegisterView
└── export/            (B3.5) § 12-DOCX-Renderer
```

## Schemas und Validierung

`RiskEntrySchema` aus `schema.ts` validiert zur Laufzeit importierte oder serialisierte Risiken
mit Zod (v4). JSON-Schema-Export für externe Konsumenten folgt in einem späteren Schritt und
landet unter `docs/schemas/risk-entry.schema.json`.

## Verknüpfungen

Ein `RiskEntry` kann verweisen auf:
- **Assets** (`affectedAssetIds`) — aus dem Governance-Bereich
- **Prozesse** (`affectedProcessIds`) — aus dem Resilience-Bereich
- **Interdependenzen** (`affectedInterdependencies`) — aus dem Resilience-Bereich
- **Maßnahmen** (`mitigationMeasureIds`) — aus dem Maßnahmen-Bereich

## Status

B3.1 · Datenmodell vollständig, aber noch nicht in der UI verdrahtet. Integration folgt in B3.3/B3.4.
