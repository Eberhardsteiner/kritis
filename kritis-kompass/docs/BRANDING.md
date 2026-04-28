# Branding-Anpassung

Alle Marken-, Kontakt- und Farb-Konfiguration läuft über [src/config/branding.ts](../src/config/branding.ts). Wer dort sauber pflegt, ändert App, PDF und Privacy-View konsistent.

## Was hier konfiguriert wird

```ts
export const BRANDING = {
  appName: 'KRITIS-Kompass',
  tagline: 'Zukunftsfähigkeit ist kein Zufall.',
  partner1: { name, url, contactEmail },
  partner2: { name, url, contactEmail },
  colors: { bordeaux, deepBordeaux, black, offwhite, mauve, muted, bernstein, gruen },
  privacyUrl: '/privacy',
  consultingUrl: 'mailto:...',
  splash: { eyebrow, title, subtitle, primaryCta, helperQuestion, helperLink, privacy },
  dimensions: [ /* 8 Einträge mit key/label/short */ ],
};
```

## Wo die Werte landen

| Konfiguration                           | Sichtbar in                                                              |
|----------------------------------------|--------------------------------------------------------------------------|
| `appName`                               | AppHeader (alle Views), PDF-Cover, Privacy-View                          |
| `tagline`                               | PDF-Cover (italic Mauve unten)                                           |
| `partner1.name` / `partner2.name`       | AppHeader-Partner-Zeile, Splash-Footer, PDF-Cover-Wortmarken, PDF-Kontakt|
| `partner1.url` / `partner2.url`         | ConsultingCta-Sekundärbutton, PDF-Kontakt-Block, Privacy-Footer          |
| `partner1.contactEmail` / `partner2.…`  | Privacy-Footer, PDF-Kontakt-Block, EmailCapture-Dialog (Adresse für Kunde)|
| `colors.*`                              | PDF-Render (Cover, Status-Pills, Sektion-Titel, Akzent-Linien)           |
| `splash.*`                              | SplashView (alle Texte)                                                  |
| `consultingUrl`                         | ConsultingCta-Primärbutton, PDF-Beratungs-Block (mailto-Link)            |
| `dimensions[].label` / `.short`         | RadarBackground (Splash) — Voll-/Kurz-Labels je nach Viewport            |

**Wichtig zu Schäuble-Kontakten:** Solange `partner2.url` UND `partner2.contactEmail` leer sind, blendet die App den zweiten Partner überall **automatisch** aus (AppHeader, Splash-Footer, PDF, Privacy-View). Sobald einer der beiden Werte gesetzt ist, erscheint Schäuble in allen Block-Aufzählungen.

## Anpass-Workflow

1. `branding.ts` editieren
2. `npm run dev` starten — alle Views durchklicken (`/`, `/check`, `/assessment`, `/report`, `/privacy`)
3. PDF herunterladen über `/report` und in einem PDF-Viewer öffnen
4. `npm test` laufen lassen
5. `npm run build` — keine TypeScript-Fehler erwartet
6. Deploy

## Logo statt Wortmarken

Die App nutzt heute nur Wortmarken — keine SVG- oder Bitmap-Logos. Falls echte Logo-Dateien geliefert werden:

1. SVG nach `public/` ablegen (z.B. `public/logo-uvm.svg`, `public/logo-schaeuble.svg`)
2. In [src/components/AppHeader.tsx](../src/components/AppHeader.tsx) und [src/lib/pdfReport.ts](../src/lib/pdfReport.ts) den jeweiligen Block aus _Wortmarke_ auf _`<img>` / `pdf.addImage()`_ umstellen
3. PDF: jsPDF unterstützt `pdf.addImage(base64, 'PNG' | 'JPEG', x, y, w, h)`. SVG müsste vorher zu PNG konvertiert werden (z.B. via `<canvas>`).

## Farben

Die App-Farben leben **doppelt**: einmal in `branding.colors` (für PDF) und einmal in [tailwind.config.js](../tailwind.config.js) als Theme-Tokens (für UI). Bei Farbänderungen beide Stellen anpassen — die PDF-Render-Farben werden NICHT aus Tailwind gelesen.

| Tailwind-Token | Hex      | Verwendung                          |
|---------------|----------|-------------------------------------|
| `bordeaux`    | `#c43960` | Primärfarbe, CTAs, Akzente          |
| `schwarz`     | `#0a0510` | Splash-Hintergrund, Text            |
| `hellrosa`    | `#f5ebef` | App-Hintergrund, helle Akzente      |
| `mauve`       | `#b08090` | Sekundärtext, Outlines              |
| `bernstein`   | `#d09038` | Maturity "Reaktiv", Mid-Severity    |
| `gruen`       | `#4a8f5e` | Maturity "Resilient"                |

## Splash-Texte

Die Texte in `splash.*` sind sehr kurz und durch Letter-Spacing geprägt. Beim Editieren auf Lesbarkeit auf Mobile achten: zu lange Strings brechen das Layout.
