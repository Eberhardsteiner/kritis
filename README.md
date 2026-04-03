# Krisenfestigkeit Monitor – Paket 1

## Für Bolt/StackBlitz

1. **Nicht die ZIP als einzelne Datei in den Chat hängen**, sondern die Dateien bzw. den entpackten Projektordner in den Editor importieren.
2. Wenn Bolt/StackBlitz nicht automatisch startet: `npm install` und danach `npm run dev`.
3. Falls die Vorschau leer bleibt, die Dev-Server-Konsole öffnen und neu starten.


Dieses erste Paket ist als direkt nutzbarer Frontend-Prototyp für Bolt gedacht.

## Inhalt von Paket 1

- lauffähige React-/Vite-App mit moderner Oberfläche
- Grundanalyse zur Krisenfestigkeit über 8 Domänen
- Gewichtungs- und Scoring-Engine
- Branchenmodule als JSON-Container
- integrierte Beispielmodule für:
  - Produktion & Industrie
  - Gesundheit & Krankenhaus
  - Energie & Versorgung
  - Logistik & Transport
- KRITIS-Readiness-Bereich mit interner Audit- und Nachweislogik
- lokales Speichern im Browser
- JSON-Export des aktuellen Stands

## Wichtige fachliche Einordnung

Der KRITIS-Bereich ist in diesem Paket bewusst als **Readiness-, Audit- und Nachweisstrecke** umgesetzt.
Er soll eine belastbare interne Prüfung und Dokumentationslogik ermöglichen.
Er behauptet nicht, dass bereits ein hoheitliches Zertifizierungsverfahren technisch abgebildet wird.

## Technischer Stack

- React
- TypeScript
- Vite
- lucide-react
- eigenes CSS, keine UI-Library-Abhängigkeit

## Start in Bolt oder lokal

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Grundlogik der App

### 1. Grundanalyse

Die App bewertet 8 Kerndomänen:

1. Führung & Governance
2. Betrieb & Prozesse
3. Personal & Fähigkeiten
4. Standorte & physische Sicherheit
5. IT, Daten & Cyber
6. Lieferkette & Abhängigkeiten
7. Finanzen, Recht & Versicherung
8. Krisenmanagement & Kommunikation

Die Bewertung erfolgt auf einer Skala von 0 bis 4:

- 0 = nicht vorhanden
- 1 = ad hoc
- 2 = teilweise
- 3 = etabliert
- 4 = belastbar

### 2. Branchenmodule

Ein Branchenmodul kann im Paket 1:

- Domänengewichte anpassen
- zusätzliche Fragen laden
- KRITIS-Hinweise ergänzen
- zusätzliche Audit-Anforderungen ergänzen

### 3. KRITIS-Bereich

Der KRITIS-Bereich arbeitet mit:

- Relevanz-Indikation
- Prüfbausteinen
- Statuslogik für Nachweisfähigkeit
- interner Zertifizierungslogik für Ihr Beratungsmodell

## JSON-Container für Branchenmodule

Die Referenzdateien liegen hier:

- `docs/module-schema.json`
- `docs/custom-module-template.json`

### Unterstützte Felder in v1

```json
{
  "schemaVersion": 1,
  "id": "custom-module",
  "name": "Eigenes Modul",
  "version": "0.1.0",
  "description": "Beschreibung",
  "sectorCategory": "Eigene Branche",
  "domainWeightAdjustments": {
    "operations": 1.2
  },
  "additionalQuestions": [],
  "kritisExtension": {
    "eligibleSectors": [],
    "hints": [],
    "additionalRequirements": []
  }
}
```

## Empfehlung für Paket 2

Nach Ihrer Freigabe würde ich als Nächstes folgende Bausteine umsetzen:

1. Mandanten- und Projektverwaltung
2. PDF-Report mit Management Summary
3. Maßnahmen-Backlog mit Verantwortlichen und Fristen
4. Evidence Vault / Dokumentenlogik
5. Reifegrad-Historie und Versionsstände
6. Rollen- und Rechtekonzept
7. Backend mit Persistenz
8. Zertifizierungsworkflow mit Auditphasen

## Hinweis zu Grenzen von Paket 1

Paket 1 ist bewusst schnell und robust gehalten.
Es ist stark genug für erste Fachtests in Bolt, aber noch kein vollständiges Produktivsystem.

Noch nicht enthalten:

- Backend
- Datenbank
- Benutzerverwaltung
- PDF-Export
- echte Dokumentenablage
- Workflow-Engine
- behördenspezifische Schnittstellen
