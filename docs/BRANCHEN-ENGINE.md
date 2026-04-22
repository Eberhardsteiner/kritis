# Branchen-Engine und Inhaltscontainer

Die App arbeitet ab diesem Ausbaustand mit einem **einheitlichen Containerformat** für Brancheninhalte.

## Zielbild

Es gibt **eine Engine** und **beliebig viele Branchencontainer**. Ein Container wird als JSON geladen und enthält immer dieselbe Hülle:

- `containerVersion`
- `manifest`
- `module`
- optional `targetModuleId` bei Overlay-Containern

Damit können neue Branchen oder branchenspezifische Erweiterungen in die bestehende Engine eingespielt werden, ohne die App selbst fachlich umzubauen.

## Standardformat

### Vollständiges Branchenmodul

- `manifest.packType = "module"`
- `manifest.moduleId = module.id`
- `targetModuleId` wird **nicht** verwendet

### Overlay

- `manifest.packType = "overlay"`
- `manifest.moduleId = module.id`
- `targetModuleId` verweist auf das Basismodul, das erweitert werden soll

## Manifest

Das Manifest beschreibt den Container selbst, nicht den Fachinhalt.

Wichtige Felder:

- `packId`: eindeutige Container-ID
- `packType`: `module` oder `overlay`
- `moduleId`: fachliche Modul-ID
- `version`: SemVer des Containers
- `engine`: aktuell `krisenfest-sector-engine`
- `engineVersion`: Mindeststand der Container-Engine
- `compatibility.minAppVersion`: Mindeststand der App
- `sectorCategory`, `industryClass`, `tags`, `capabilities`

## Fachinhalt im Feld `module`

Der Inhalt bleibt für alle Branchen gleich strukturiert. Die Engine kann damit dieselben Bereiche bedienen:

- Zusatzfragen in der Analyse
- Maßnahmenvorlagen
- Evidenzvorlagen
- Rollen
- Audit-Checklisten
- Prozesse, Abhängigkeiten, Szenarien und Übungen
- KRITIS-Readiness-Erweiterungen
- **Risikokatalog-Templates (§ 12 KRITISDachG)** · Feld `riskCatalogTemplates[]`
- **Resilienzplan-Template (§ 13 KRITISDachG)** · Feld `resiliencePlanTemplate`
- **Tabletop-Übungsszenarien (§ 18 KRITISDachG)** · Feld `tabletopScenarios[]`

### Template-Felder für Risiken, Resilienzplan und Tabletops (C5.1)

Ab C5.1 trägt ein Pack zusätzlich fachliche Vorlagen für die drei Kernfeatures:

- `riskCatalogTemplates[]` — 5×5-Risikomatrix-Einträge mit Kategorie, Beschreibung und Initial-Scoring.
- `resiliencePlanTemplate` — vollständiger Resilienzplan-Inhalt mit sechs Sektionen (Scope, Risikobasis, Maßnahmen nach vier Resilienzzielen, Governance, Meldewesen, Nachweise).
- `tabletopScenarios[]` — komplette Tabletop-Szenarios mit Timeline, Injects, Entscheidungen und Bewertungskriterien.

Die Felder folgen **byte-identisch** den TypeScript-Typen in `src/features/{riskCatalog,resiliencePlan,tabletopExercise}/types.ts`. Ein Symmetrie-Self-Check-Test in `server/module-packs.test.js` schützt dauerhaft vor TS-Type-Drift: Sobald ein Feld in den Type-Dateien geändert wird, muss die Pack-Schema-Definition nachgezogen werden.

#### Cross-Reference-Felder: Pack-Autor lässt leer, Operator verknüpft

In Pack 1.0 werden Cross-Reference-Felder (`affectedAssetIds`, `affectedProcessIds`, `mitigationMeasureIds`, `affectedInterdependencies` in `riskCatalogTemplates`; `topRisks[].riskId`, `measuresByGoal[*][].linkedActionItemId` in `resiliencePlanTemplate`) **immer leer** gelassen. Grund: Pack-Zeit-IDs sind nicht mit Tenant-Zeit-IDs identisch; Assets/Prozesse/Maßnahmen entstehen erst nach Pack-Import im Tenant-State. Der Operator verknüpft die Einträge nach "Übernehmen" manuell.

#### Copy-Operator-Symmetrie (Template → Instanz)

Beim "Übernehmen"-Klick gelten folgende Regeln:

- `riskCatalogTemplates[i]` → `state.riskEntries[]`: Feld-für-Feld 1:1, nur die `id` wird neu generiert (Pack-ID bleibt als Pack-stabile Referenz für Overlay-Merger erhalten).
- `resiliencePlanTemplate.content` → `state.resiliencePlan.content`: Content-Subbaum 1:1. Lifecycle-Felder (`id`, `tenantId`, `version`, `status`, `createdAt`, `updatedAt`) setzt der Frontend-Operator.
- `tabletopScenarios[i]` → `state.importedTabletopScenarios[]`: komplett 1:1 inkl. ID. `ExerciseSession` entsteht separat beim Übungsstart.

#### Overlay-Merge-Regeln

- `riskCatalogTemplates`: `mergeById` (id-basiert, konsistent mit `scenarioTemplates` etc.)
- `resiliencePlanTemplate`: **scalar override** — Overlay ersetzt das Template komplett, keine Per-Sektion-Merges. Wer eine AT-Variante braucht, schreibt einen kompletten Ersatz-Template.
- `tabletopScenarios`: `mergeById`

## Geladene Inhalte

Der Standardpfad ist jetzt:

1. integrierte Kerncontainer
2. lokal importierte Branchenmodule
3. serverseitige Pack-Registry
4. freigegebene Overlays auf das Zielmodul

## Wichtige Dateien

- `docs/module-schema.json` – Schema für den Branchen-Container
- `docs/module-payload-schema-legacy.json` – altes Payload-Schema für Bestandskompatibilität
- `docs/custom-module-template.json` – generische Vorlage für neue Branchencontainer
- `docs/custom-overlay-template.json` – generische Vorlage für Overlay-Container
- `docs/example-industry-container.json` – konkretes Referenzbeispiel für das Industriemodul

## Hinweise für neue Branchen

Für neue Branchen sollte immer so vorgegangen werden:

1. neues Container-JSON auf Basis von `custom-module-template.json` anlegen
2. `manifest.packId`, `manifest.moduleId`, Version und Beschreibung vergeben
3. Fachinhalt im Feld `module` pflegen
4. Container importieren
5. in der Registry freigeben
6. optional spätere Overlays pro Land, Regime oder Unterbranche ergänzen

## Rückwärtskompatibilität

Legacy-JSON wird weiterhin eingelesen. Für neue Inhalte sollte aber nur noch das Containerformat verwendet werden.
