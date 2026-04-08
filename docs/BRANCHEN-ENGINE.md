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
