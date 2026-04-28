# KRITIS-Kompass

Selbstanalyse-App für KRITIS-Betroffenheit und Resilienz-Reife. Lead-Magnet für UVM-Institut und Schäuble Consulting GmbH.

## Was die App tut

Drei Schritte:

1. **Bin ich betroffen?** — 7-9 Indikator-Fragen, klares Ergebnis: direkt / prüfbedürftig / indirekt / nicht betroffen
2. **Wie bin ich aufgestellt?** — 24 Basis-Fragen über 8 Domänen + 4-6 branchenspezifische Zusatzfragen aus 10 Modulpaketen
3. **PDF-Bericht** — 9-seitiger Lead-Magnet mit Beratungs-CTA

Keine Anmeldung. Kein Server. Keine Tracker. Datenverbleib ist lokal im Browser.

## Technik

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS mit eigenem Bordeaux-Theme
- jsPDF für PDF-Generierung (clientseitig)
- React Context + useReducer für Zustand
- localStorage für Session-Persistenz

## Lokale Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # Vitest, alle Tests
npm run build    # Production-Build nach dist/
npm run preview  # Vorschau des Production-Builds
```

## Pflege der Indikatoren

Die KRITIS-Indikatoren leben in [src/data/kritisIndicators.json](src/data/kritisIndicators.json). Anpassbar **ohne Code-Änderung**:

- Schwellenwerte (versorgte Personen, Mitarbeitende, Umsatz)
- Sektor-Liste und sektorspezifische Dienstleistungen
- Lieferketten-Indikatoren

Nach Änderung: `version` und `lastReviewed` aktualisieren. Tests laufen lassen mit `npm test`.

Vor allem nach Inkrafttreten der KRITIS-Rechtsverordnung (sektorspezifische Schwellen): Schwellenwerte überprüfen und gegebenenfalls senken.

Detaillierte Anleitung: [docs/INDIKATOREN-PFLEGE.md](docs/INDIKATOREN-PFLEGE.md)

## Pflege der Branchenmodule

Die 10 Modulpakete liegen in [public/module-packs/](public/module-packs/) als JSON. Stammen aus dem Krisenfest-Hauptprojekt. Bei Updates dort: Datei kopieren und im Manifest [src/data/modulePackCatalog.ts](src/data/modulePackCatalog.ts) prüfen, ob neue oder veränderte Pack-IDs zu berücksichtigen sind.

Detaillierte Anleitung: [docs/MODULE-PACKS.md](docs/MODULE-PACKS.md)

## Branding-Anpassung

Alle Markennamen, Farben, Kontakt-E-Mails leben in [src/config/branding.ts](src/config/branding.ts):

- `partner1` / `partner2`: Name, URL, contactEmail
- `colors`: vier Bordeaux-Schattierungen + Akzentfarben
- `splash`: alle Splash-Texte
- `consultingUrl`: mailto-Link für Beratungsanfragen

Detaillierte Anleitung: [docs/BRANDING.md](docs/BRANDING.md)

## Deployment

Production-Build:

```bash
npm run build
```

Output liegt in `dist/`. Static-Hosting reicht — die App ist eine reine SPA ohne Backend.

Detaillierte Anleitung mit Vercel, Netlify, eigenem Webhost: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Datenschutz

Die App speichert ALLES nur im Browser (localStorage). Es gibt keinen Server, keinen Cookie, keinen Tracker. Die einzige Verbindung nach außen passiert beim Klick auf "Beratungsanfrage senden" — dann öffnet der Browser den Mail-Client, und der User entscheidet selbst, was er versendet.

Datenschutz-Erklärung in der App: [/privacy](http://localhost:5173/privacy)

## Verzeichnisstruktur

```
kritis-kompass/
├── public/
│   ├── favicon.svg
│   ├── og-image.svg
│   └── module-packs/         ← 10 Container-JSONs
├── src/
│   ├── components/           ← UI-Bausteine (32 Dateien)
│   ├── config/branding.ts    ← Markenkonfiguration
│   ├── context/              ← AssessmentContext
│   ├── data/                 ← baseDomains, baseQuestions, kritisIndicators.json
│   ├── lib/                  ← scoring, pdfReport, applicability, …
│   ├── views/                ← 5 Routen (Splash, Check, Assessment, Report, Privacy)
│   ├── App.tsx               ← Router
│   ├── main.tsx              ← Entry-Point + Smoke-Test-Hooks
│   ├── types.ts              ← Alle Typen
│   └── index.css             ← Tailwind + view-transition Keyframes
├── docs/                     ← Pflege-Anleitungen
├── tests via Vitest          ← src/**/*.test.ts
└── tailwind.config.js
```

## Tests

```bash
npm test
```

10 Vitest-Tests:

- `src/lib/applicability.test.ts` — Bewertungs-Engine (5 Tests)
- `src/lib/buildQuestionSet.test.ts` — Fragen-Set-Komposition mit Modul (5 Tests)

## Lizenz und Eigentum

© UVM-Institut · Schäuble Consulting GmbH

## Kontakt

- UVM-Institut: <info@uvm-akademie.de> · <https://uvm-akademie.de>
- Schäuble Consulting GmbH: _noch einzutragen in [src/config/branding.ts](src/config/branding.ts)_
