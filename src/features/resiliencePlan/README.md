# Feature: Resilienzplan-Generator (B4 · Kern-USP)

## Zweck

Aus Risikoanalyse (B3), bestehenden Maßnahmen und Evidenzen entsteht ein **Resilienzplan-Entwurf
nach § 13 KRITISDachG** entlang der vier Resilienzziele: **Verhindern · Schützen · Reagieren ·
Wiederherstellen**. Export als DOCX (BBK-Muster-kompatibel), PDF (Management-Präsentation) und
JSON (maschinenlesbar, versionsstabil).

**Alleinstellungsmerkmal**: Das BBK sollte laut Gesetz bis 17. Januar 2026 ein amtliches Muster
veröffentlichen. Solange das Muster fehlt (Stand April 2026), ist dieser Generator ein echter
UVM-Alleinstellungsvorteil. Sobald das Muster erscheint, wird die Template-Struktur in
`template.ts` entsprechend kalibriert.

## Sechsteilige Grundstruktur

| # | Abschnitt | Inhalt |
|---|---|---|
| 1 | **Einleitung und Geltungsbereich** | Betreiber, Anlage, kritische Dienstleistung, Sektor, Standorte |
| 2 | **Risikobasis** | Verweis auf Risikoanalyse (B3), Top-Risiken, Methodik |
| 3 | **Resilienzziele und Maßnahmen** | Maßnahmen gruppiert nach den vier Zielen des § 13 |
| 4 | **Verantwortlichkeiten und Governance** | Rollen, Eskalation, Geschäftsleitung (§ 20) |
| 5 | **Meldewesen und Kommunikation** | Prozess nach § 18, Kontakte, 24-Stunden-Logik |
| 6 | **Nachweise und Aktualisierung** | Evidenzverweise, Review-Zyklen, § 17-Anrechnung |

## Dateien

```
src/features/resiliencePlan/
├── README.md          Dieser Überblick
├── types.ts           ResiliencePlan, ResiliencePlanContent, Sections
├── template.ts        Default-Text-Bausteine je Abschnitt + Struktur
├── schema.ts          Zod-Schemas für Import/Export und Freigabe-Workflow
├── generator.ts       (B4.2) generateDraft, validatePlan
├── renderers/         (B4.3) DOCX, PDF, JSON
└── views/             (B4.4) Editor, Preview, VersionHistory
```

## Freigabe-Workflow

```
draft ──(review anfragen)──▶ review ──(freigeben)──▶ approved
                                │
                                └──(zurückziehen)──▶ draft

approved ──(archivieren)──▶ archived
```

`approvedBy` und `approvedAt` werden bei Übergang nach `approved` gesetzt und bei
Rücknahme zurückgesetzt.

## Schemas

`resiliencePlanSchema` in `schema.ts` validiert Plan-Importe mit Zod (v4). JSON-Schema-Export
für externe Konsumenten folgt in B4.3.
