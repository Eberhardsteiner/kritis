# Feature: Tabletop-Exercise (B5 · Szenario-Engine)

## Zweck

Strukturierte Meldeketten- und Krisenübung nach **§ 18 KRITISDachG** als Tabletop-Exercise.
Rollen, Zeitachse, Injects, Entscheidungen und Bewertung werden in einem reproduzierbaren
Format abgebildet. Ergebnisse werden als Evidenz für § 18-Requirements hinterlegt.

## Synergie

Dr. Steiner hat für eine Feuerwehrschule bereits ein Planspiel-Muster entwickelt (JSON-
Szenarien, rollenbasiertes Gameplay). Das Grundmuster wird hier für den KRITISDachG-
Kontext adaptiert und als eigenständiges Feature-Modul aufgebaut.

## Szenario-Format (JSON)

```json
{
  "id": "scenario-cyber-supply-chain-energy-2026",
  "version": "1.0.0",
  "title": "Cyber-Angriff auf zentralen IT-Dienstleister eines Energieversorgers",
  "summary": "…",
  "sectors": ["Energie"],
  "applicableRegimes": ["de_kritisdachg", "de_bsig_nis2"],
  "durationMinutes": 120,
  "roles": [
    { "id": "ceo", "title": "Vorstandsvorsitzender", "briefing": "…" }
  ],
  "timeline": [
    {
      "t": 0,
      "phase": "discovery",
      "injects": [{ "id": "inj-1", "title": "…", "description": "…" }],
      "decisions": [
        {
          "id": "dec-1",
          "question": "…",
          "options": [
            { "id": "opt-a", "label": "…", "evaluationHints": ["timely_24h_report"] }
          ]
        }
      ]
    }
  ],
  "evaluationCriteria": [
    { "id": "timely_24h_report", "description": "…", "weight": 3 }
  ]
}
```

Die Timeline-Schritte folgen dem KRITIS-Meldungsrhythmus:

| Phase | Zeitraum | Fokus |
|---|---|---|
| `discovery` | t=0..15 min | Erkennung, Erstlage |
| `early_response` | t=15..60 min | Aktivierung, interne Eskalation |
| `24h_reporting` | t=60..120 min | Erstmeldung nach § 18 |
| `stabilization` | t=120..480 min | Stabilisierung, Lageaktualisierung |
| `recovery` | t=480+ min | Wiederanlauf, Lessons Learned |

## Dateien

```
src/features/tabletopExercise/
├── README.md          Dieser Überblick
├── types.ts           Scenario, Role, TimelineStep, Decision, ExerciseSession
├── schema.ts          Zod-Schemas für Import/Export (inkl. Strict-Mode)
├── engine.ts          (B5.2) Loader, Session-State-Machine, Bewertung
├── scenarios/         (B5.3) Drei Pflicht-Szenarien als JSON
└── views/             (B5.4) ScenarioLibrary, ExerciseSession, ExerciseReview
```

## Session-Lebenszyklus

```
not_started ──(Session starten)──▶ active ──(alle Schritte durchlaufen)──▶ completed
                                     │
                                     └─(Abbruch)──▶ abandoned
```

## Bewertung

Jede Entscheidung kann `evaluationHints` referenzieren — IDs aus `evaluationCriteria`. Nach
Abschluss berechnet die Engine aus den getroffenen Entscheidungen einen gewichteten Score
pro Kriterium und ein Gesamt­urteil:

| Prozent | Urteil |
|---|---|
| ≥ 80 % | bestanden |
| ≥ 60 % | bedingt bestanden |
| < 60 % | nicht bestanden |

## Evidenz-Anbindung

Abgeschlossene Übungen werden als `EvidenceItem` des Typs `test` mit Referenz auf
die § 18-Requirements angelegt (B5.5).
