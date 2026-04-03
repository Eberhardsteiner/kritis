# Krisenfestigkeit Monitor - Paket 2

Lauffähiger React-/Vite-Prototyp für die Bewertung der Krisenfestigkeit von Unternehmen.

## Neu in Paket 2

- Maßnahmenplan mit Prioritäten, Verantwortlichen, Fälligkeiten und Status
- Nachweisregister für Dokumente, Tests, Übungen und Audit-Unterlagen
- Direkte Ableitung von Maßnahmen und Nachweisen aus Analysefragen und KRITIS-Bausteinen
- Interner KRITIS-Zertifizierungsworkflow mit sechs Stufen
- Reporting-Bereich mit Markdown-, CSV- und Druckexport
- Erweiterte JSON-Containerlösung für Branchenmodule
  - `recommendedActions`
  - `evidenceTemplates`
  - `uiHints`

## Projekt starten

```bash
npm install
npm run dev
```

## Build prüfen

```bash
npm run build
```

## Wichtige Hinweise

- Keine Server-Persistenz, Speicherung nur lokal im Browser
- Keine hoheitliche Zertifizierungslogik, sondern interne Audit- und Nachweisstrecke
- Branchenmodule werden per JSON importiert und validiert
- `package-lock.json` ist bewusst nicht enthalten, damit Bolt nicht auf eine falsche Registry festgelegt wird

## Struktur

- `src/views/DashboardView.tsx` - Managementübersicht
- `src/views/AssessmentView.tsx` - Bewertung und Filterlogik
- `src/views/MeasuresView.tsx` - Maßnahmenplan und Nachweisregister
- `src/views/KritisView.tsx` - KRITIS-Readiness und Zertifizierungsworkflow
- `src/views/ReportView.tsx` - Reporting und Exporte
- `src/lib/moduleRegistry.ts` - Modulvalidierung und Merge-Logik
- `src/lib/scoring.ts` - Bewertungs-, Nachweis- und Zertifizierungslogik
- `docs/custom-module-template.json` - Beispiel für eigene Branchenmodule
- `docs/module-schema.json` - JSON-Schema
