# Phase 2 - umgesetzt

## Enthalten

- neue Navigation: Maßnahmen & Nachweise, Reporting
- Filter in der Grundanalyse
- direkte Ableitung von Maßnahmen und Nachweisen aus Fragen
- Maßnahmenplan mit Priorität, Status, Verantwortlichen, Termin
- Nachweisregister mit Typ, Status, Review-Datum und Referenz
- KRITIS-Zertifizierungsworkflow mit 6 internen Stufen
- Berichtszentrum mit Markdown-, CSV- und Druckexport
- erweiterte JSON-Containerlösung
  - recommendedActions
  - evidenceTemplates
  - uiHints
- integrierte Branchenmodule um Vorlagen erweitert

## Build-Status

Lokal erfolgreich geprüft mit:

```bash
env -u npm_config_registry npm install --userconfig ./.npmrc
env -u npm_config_registry npm run build
```

## Empfohlener Check in Bolt

1. Navigation und neue Views öffnen
2. in der Analyse Filter testen
3. aus einer Frage eine Maßnahme und einen Nachweis erzeugen
4. in KRITIS eine Anforderung auf "Nachweisfähig" setzen
5. Reporting öffnen und Exporte prüfen
6. eigenes JSON-Modul mit `recommendedActions` und `evidenceTemplates` testen

## Sinnvoll für Phase 3

- PDF-Export mit formalem Berichtslayout
- Rollen / Reviewer / Freigaben
- Multi-Standort- und Anlagenstruktur
- Mandantenfähigkeit / Backend / Benutzerverwaltung
- Dokument-Upload statt nur Referenzen
- Benchmarking nach Branche und Unternehmensgröße
