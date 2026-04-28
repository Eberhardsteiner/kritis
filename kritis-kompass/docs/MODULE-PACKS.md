# Pflege der Branchenmodule

Zehn Modulpakete decken die Sektoren des KRITIS-Kompass ab. Sie werden zur Laufzeit per `fetch` geladen und nicht in den JS-Bundle eingebacken.

## Liste der heutigen Packs

In [public/module-packs/](../public/module-packs/):

| Pack-ID                 | Branche                              |
|-------------------------|--------------------------------------|
| `energy-core`           | Energie                              |
| `water-core`            | Wasser (Trinkwasser & Abwasser)      |
| `healthcare-core`       | Gesundheit & Krankenhaus             |
| `finance-core`          | Finanzwesen                          |
| `it-telecom-core`       | IT & Telekommunikation               |
| `logistics-core`        | Transport & Verkehr                  |
| `industry-core`         | Industrie & Produktion               |
| `administration-core`   | Staat & Verwaltung                   |
| `defence-core`          | Verteidigung & Rüstung               |
| `kmu-basis-core`        | KMU-Basis (Querschnitt)              |

Das Manifest mit Labels, Icons und Kurzbeschreibungen für den SectorPicker liegt in [src/data/modulePackCatalog.ts](../src/data/modulePackCatalog.ts).

## Pack-Aufbau

Jedes Container-JSON hat die Struktur:

```jsonc
{
  "containerVersion": 1,
  "manifest": {
    "packId": "sector-finance-core",
    "name": "Finanz-Basismodul",
    "version": "1.0.0",
    "sectorCategory": "Finanz- und Versicherungswesen",
    // ...
  },
  "module": {
    "id": "finance",
    "name": "Finanz- und Versicherungswesen",
    "description": "...",
    "domainWeightAdjustments": {
      "cyber": 1.3,
      "operations": 1.25
    },
    "additionalQuestions": [ /* 4-6 QuestionDefinition */ ],
    "kritisExtension": {
      "hints": [ /* string[] */ ],
      "additionalRequirements": [ /* SectorAdditionalRequirement[] */ ]
    }
  }
}
```

[src/lib/loadModulePack.ts](../src/lib/loadModulePack.ts) extrahiert genau die Felder, die der Kompass braucht — Rest des JSONs wird ignoriert. Das ermöglicht, im Hauptprojekt _Krisenfest_ reichere Packs zu pflegen, ohne den Kompass nachzuziehen.

## Verbindung zum Hauptprojekt _Krisenfest_

Die Container-JSONs sind eine Untermenge der Packs aus dem Krisenfest-Hauptprojekt. Bei Updates dort:

1. Pack-JSON aus dem Krisenfest-Repo kopieren (`src/module-packs/<pack-id>.container.json`)
2. In [public/module-packs/](../public/module-packs/) einfügen, gleicher Dateiname
3. Falls die Pack-ID neu ist (selten): Eintrag in [src/data/modulePackCatalog.ts](../src/data/modulePackCatalog.ts) ergänzen, plus Mapping in [src/lib/sectorToModule.ts](../src/lib/sectorToModule.ts), falls passend
4. `npm test` laufen lassen — der `buildQuestionSet`-Test mit echtem Healthcare-Pack erwartet 28 Fragen, andere Packs dürfen abweichen
5. Im Browser den `/assessment`-Flow durchspielen mit dem aktualisierten Pack

## Was passiert, wenn ein Pack fehlt?

`loadModulePack` wirft einen Fehler, der in [src/context/AssessmentContext.tsx](../src/context/AssessmentContext.tsx) abgefangen wird. Die UI fällt auf "kein Modul" zurück — der User sieht eine graue "Kein Modul gewählt"-Pille im AssessmentView und kann ein anderes Modul wählen.

## Größe / Performance

Die 10 Packs zusammen sind ca. 1.6 MB roh. Beim Build werden sie unverändert aus `public/` nach `dist/module-packs/` kopiert (kein Bundling). Die App lädt **nur das gewählte Pack**, nicht alle. Im Schnitt 30-150 KB pro Fetch.
