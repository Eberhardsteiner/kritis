# C6 · Scope-Präzisierung (Quality Pass, Supabase pausiert)

> **Stand: 2026-04-22.** Festlegung nach dem C5-Block-Abschluss. Diese Datei ersetzt den in `BLOCK-C.md` Abschnitt „C6 · Supabase-Produktionspfad scharfstellen" dokumentierten ursprünglichen Scope nicht — sie präzisiert ihn und dokumentiert eine strategische Scope-Umstellung.

## 1 · Scope-Umstellung auf einen Blick

- **Ursprünglich geplant** (siehe `BLOCK-C.md` Abschnitt C6, ab Zeile 416): Supabase als Produktions-Persistenz scharfstellen (RLS-Policies, Migrations-Prüfpfad, Backup-Restore-Drill, Staging-Projekt).
- **Neu vereinbart** (nach Demo-Readiness-Entscheidung in C5 und Gesprächen mit Dr. Steiner): **Quality Pass auf vier offene Meta-Review-Notizen**. Supabase-Aktivierung wird **pausiert**, der Code-Pfad bleibt erhalten.
- **Re-Evaluation**: Wenn ein konkreter Pilotkunde Cloud-Hosting explizit fordert, wird der pausierte Scope reaktiviert. Bis dahin ist **SQLite-Document-Store das produktive Persistence-Modell**.

## 2 · C6-Scope · Quality Pass auf vier Meta-Review-Notizen

Die vier Notizen stammen aus `docs/POST-C3-META-REVIEW-NOTIZEN.md` und wurden während der C3-Phase identifiziert, aber in C3 nicht behoben (bewusst außerhalb der C3-Zerlegungs-Scope gelassen).

### C6.1 · Notiz 1 · Zwei-Phasen-Commit-Reconciler für Exports und Uploads

**Fundstelle**: Meta-Review-Notiz 1 (`persistExportPackage` und POST `/api/evidence/:id/attachment`).

**Symptom**: Storage-Ablage passiert zuerst, Registry-Write zweitens, kein Rollback bei Registry-Fehler. Bei Fehlern zwischen Phase 1 (Storage) und Phase 2 (Registry/State) entstehen File-Orphans oder halb-persistierte Zustände.

**Scope C6.1**: Kompensations-Mechanismus gegen Storage-Registry-Drift. Bewertung der drei in Notiz 1 genannten Optionen (Compensating-Action, Reconciler-Job, Monitoring-only) und Umsetzung der geeignetsten für den aktuellen Betriebs-Maßstab.

**Aufwandsschätzung**: 1–2 Arbeitstage (schema-lastig nach Notiz 16, Faktor 1,5–2,5× auf Obergrenze).

### C6.2 · Notiz 2 · Path-Traversal-Kommentar als Polish

**Fundstelle**: Meta-Review-Notiz 2 (`readExportArtifact` Path-Basename-Sanitize).

**Symptom**: Korrekt implementierter Path-Traversal-Schutz ohne Inline-Kommentar zur Security-Intention. Spätere Wartung könnte das für einen reinen Slug-Sanitize halten und die defensive Schicht verlieren.

**Scope C6.2**: Security-Kommentar mit expliziter Traversal-Schutz-Intention ergänzen.

**Aufwandsschätzung**: 15 Minuten (content-lastig nach Notiz 18, Faktor 0,3–0,7×).

### C6.3 · Notiz 4 Teil B · Frontend-Notice-State-Akkumulations-Bug

**Fundstelle**: Meta-Review-Notiz 4 Teil B, erkannt während C3-Validierungs-Rerun (2026-04-22).

**Symptom**: Nach dem Logout-Click in Szenario 15 bleibt die alte Success-Notice sichtbar, die erwartete Logout-Notice erscheint nicht. Der Bug tritt nur im Full-E2E-Suite-Lauf auf, nicht in der Isolation. Akkumulation über ca. 14 vorangegangene Szenarien. Aktuell blockiert dieser Bug eine stabile Full-E2E-Suite-CI-Integration.

**Scope C6.3**: Root-Cause-Analyse des Notice-State-Lebenszyklus, Fix des Akkumulations-Verhaltens (vermutlich im `showNotice`-Auto-Dismiss-Timer oder im `clearAuthenticatedContext`-Notice-Reset). Verifikation durch Full-E2E-Suite (16/16 grün in zwei aufeinanderfolgenden Läufen).

**Aufwandsschätzung**: 1–2 Arbeitstage (UI-lastig nach Notiz 17, Faktor 1,3–1,5×). Debug-Iterationen wahrscheinlich.

### C6.4 · Notiz 8 · SQLite-Race bei parallelen Integration-Tests

**Fundstelle**: Meta-Review-Notiz 8, identifiziert während C3.6-Arbeit.

**Symptom**: Parallele Integration-Test-Subprozesse greifen auf dieselbe SQLite-Datei zu, Race-Conditions führen zu flakigen Tests. Aktuell durch `--test-concurrency=1` gepacht, was die Test-Laufzeit verlängert.

**Scope C6.4**: Zwei Varianten prüfen und die geeignete umsetzen — (a) pro Test-Prozess eine eigene SQLite-Datei mit eindeutigem Namen, (b) SQLite in-memory für Tests (`:memory:`) mit gleichbleibender Adapter-Schicht. Ziel: `--test-concurrency=1` aufgeben können, Test-Laufzeit verkürzen.

**Aufwandsschätzung**: 0,5–1 Arbeitstag (schema-/infrastrukturlastig, Faktor 1,5–2,5×).

### Gesamt-Aufwand C6

| Teil | Charakter | Aufwand |
|---|---|---|
| C6.1 | Schema-lastig | 1–2 Tage |
| C6.2 | Content-lastig | 15 Min |
| C6.3 | UI-lastig, Debug-Risiko | 1–2 Tage |
| C6.4 | Infrastruktur | 0,5–1 Tag |
| **Summe** | — | **2,75–5 Arbeitstage** |

## 3 · C6-Ausschluss · Supabase-Produktionspfad pausiert

### Strategische Positionierung

Die Aktivierung des Supabase-Pfads als produktive Persistenz wird **pausiert, nicht verworfen**. Der Code-Pfad bleibt im Repo erhalten, bleibt typisiert, bleibt mit den bestehenden Adapter-Interfaces kompatibel. Das ist wichtig: Die Entscheidung ist **strategisch**, nicht **dogmatisch**.

### Begründung (für den späteren Leser in 6 Monaten)

Der KRITIS-Zielmarkt — Krankenhausverbünde, Energieversorger, Wasserwerke, Telekommunikationsbetreiber, Transport-/Logistik-Infrastrukturen — hat als faktische Marktanforderung folgende Eigenschaften, die bei einem Cloud-First-Persistence-Modell mit US-basierter Anbieter-Infrastruktur kollidieren:

1. **Datenhoheit als vertragliche Kernanforderung.** KRITIS-Betreiber verlangen üblicherweise, dass Daten (insbesondere personenbezogene Daten nach Art. 9 DSGVO, Betriebs- und Geschäftsgeheimnisse, Betriebsdokumentation mit KRITIS-Relevanz) in einem physisch und rechtlich kontrollierten Rahmen liegen. Das bedeutet in der Praxis: EU-Server, EU-Betreiber, nachweisbare Trennung von außereuropäischen Zugriffsketten. Supabase-Cloud (US-Entity, auch bei EU-Region-Wahl) erfüllt diesen Anspruch in der aktuellen Ausgestaltung nicht automatisch.

2. **CLOUD Act als Rechtsrisiko.** Der US-CLOUD Act von 2018 verpflichtet US-Unternehmen (und deren Töchter), Daten auf Anforderung von US-Behörden herauszugeben — auch wenn die Daten außerhalb der USA gespeichert sind. Für KRITIS-Betreiber, die oft sicherheits- oder versorgungsrelevante Daten verarbeiten, ist dieses Rechtsrisiko typischerweise ein Ausschlusskriterium in IT-Governance-Prüfungen. Der Rechtsakt kann operative Risikoabwägungen verändern, die in Ausschreibungen und in internen Compliance-Reviews von KRITIS-Kunden prägnant bewertet werden.

3. **Regulatorik-Verträglichkeit mit Kunden-IT-Policies.** Viele KRITIS-Betreiber haben interne IT-Policies, die Cloud-Dienste US-amerikanischer Anbieter entweder ganz ausschließen oder nur nach zusätzlichem, mehrwöchigem Prüfprozess zulassen (EU-spezifische Schrems-II-Prüfung, Transfer Impact Assessment, Auftragsverarbeitungs-Vertrag mit Standardvertragsklauseln, zusätzliche technische Maßnahmen). Ein Produkt, das diese Policies aus der Box erfüllt (SQLite-Document-Store im On-Premises-Betrieb des Kunden, keine externe Datenübertragung), überspringt diese Prüfprozesse vollständig und erreicht kürzere Piloteinführungs-Zeiten.

### Schlussfolgerung für das C6-Scope

Solange kein konkreter Pilotkunde Cloud-Hosting explizit **fordert** oder akzeptiert, ist die Aktivierung des Supabase-Pfads eine Vorleistung ohne nachweisbaren Produkt-Vorteil. Der Aufwand (RLS-Policies, Staging-Projekt, Migrations-Drill, Backup-Restore, Secret-Management) wäre in C6 gebunden, ohne dass er einen Pilot-Meilenstein erreicht. Der Aufwand für C6.1–C6.4 hingegen adressiert bekannte Schwächen der aktuellen Codebase, die in jeder Betriebsform (On-Premises SQLite oder später Cloud) auftreten.

### Was konkret pausiert ist

| Supabase-Scope | Status |
|---|---|
| RLS-Policies für alle Tabellen aus `docs/supabase-schema.sql` | **Pausiert**. Schema bleibt im Repo. |
| Storage-RLS für Evidenz-Objekte | **Pausiert**. |
| Migrations-Prüfpfad SQLite → Supabase | **Pausiert**. Migrationsweg konzeptuell dokumentiert, nicht implementiert. |
| Backup-Restore-Drill in CI | **Pausiert**. |
| Umgebungsprofile `development` / `staging` / `production` mit je eigenen Supabase-Projekten | **Pausiert**. Aktuell nur lokales `development`. |
| Secret-Management über GitHub Secrets für Supabase-Keys | **Pausiert**. |

### Was bleibt aktiv

- Der Supabase-Adapter-Code (`server/services/persistence-wrappers.js`-Fassade, ggf. Adapter-Hooks) bleibt im Repo erhalten, typisiert und mit den anderen Adaptern (SQLite, JSON-Filesystem) konsistent.
- Das `docs/supabase-schema.sql`-Referenz-Schema bleibt als Designvorlage im Repo.
- Der Code-Pfad ist nicht aktiv, aber weder gelöscht noch deaktiviert. Eine spätere Aktivierung ist technisch einfach.

### Re-Evaluation-Triggers

Die Supabase-Pause wird **automatisch neu bewertet**, wenn mindestens eines der folgenden Kriterien erfüllt ist:

- Ein konkreter Pilotkunde fordert explizit Cloud-Hosting als Vertrags-Bestandteil.
- Eine regulatorische Entwicklung ändert die CLOUD-Act-Risikobewertung substanziell (etwa durch eine belastbare Schrems-III-Ersatzlösung mit Bestandsschutz für EU-Datenübertragungen).
- Ein EU-basierter Supabase-Anbieter (nicht nur EU-Region, sondern EU-Entity) kommt mit vergleichbarer Feature-Parität auf den Markt und bietet einen Kompatibilitäts-Pfad.

Bis zu einem solchen Trigger ist der Default: **SQLite-Document-Store, On-Premises-Betrieb beim Kunden, keine externe Datenübertragung**.

## 4 · Reihenfolge der C6-Arbeit

Empfohlene Reihenfolge nach Risiko und Dringlichkeit:

1. **C6.2** (Path-Traversal-Kommentar, 15 Min) — Aufwärm-Commit, risikoarm
2. **C6.4** (SQLite-Race, 0,5–1 Tag) — Test-Infrastruktur-Verbesserung, hebt die Parallelisierungs-Einschränkung
3. **C6.1** (Zwei-Phasen-Commit-Reconciler, 1–2 Tage) — Datenintegritäts-Konsolidierung, am besten nach C6.4 wegen Test-Anforderungen
4. **C6.3** (Frontend-Notice-Akkumulation, 1–2 Tage) — Der komplexeste Teil, Debug-Risiko; besser am Schluss, wenn andere C6-Teile bereits grün sind

Jeder C6-Teil bekommt einen eigenen Commit nach dem C3/C5-Muster (`C6.1: …`, `C6.2: …` etc.), mit Verweis auf die jeweilige Meta-Review-Notiz. Die Kalibrierungs-Regel-Dreiheit aus Notiz 16/17/18 hilft bei der Schätzung pro Teil.

## 5 · Akzeptanzkriterien C6

- ✅ Path-Traversal-Kommentar ergänzt
- ✅ SQLite-Race aufgehoben (`--test-concurrency=1` kann für Integration-Tests entfallen, Laufzeit messbar reduziert)
- ✅ Zwei-Phasen-Commit-Pattern hat definierte Konsistenz-Garantie (Compensating-Action, Reconciler oder dokumentiertes Monitoring)
- ✅ Full-E2E-Suite läuft stabil in 2 aufeinanderfolgenden Läufen (16/16 grün), ohne `test.skip` oder `test.retry`
- ✅ Supabase-Code-Pfad bleibt lauffähig (wird nicht unabsichtlich deaktiviert)
- ✅ Meta-Review-Notizen 1, 2, 4 Teil B, 8 als „erledigt" markiert; die übrigen Notizen (3, 5–7, 9–15, 16–18) bleiben offen für C7 oder spätere Iterationen

## 6 · Abgrenzung zu C7

**C7 · Pilotfreigabe-Dokumentation** (siehe `BLOCK-C.md`) bleibt unverändert im Plan: UAT-Paket, Release-Notes, Betriebshandbuch, Härtungs-Checkliste. Die Meta-Review-Notizen, die in C6 bearbeitet werden, sind kein Teil von C7. C7 adressiert die verbleibenden, primär dokumentations-orientierten Notizen und die Produkt-Einführungs-Artefakte.

Reihenfolge-Empfehlung: **C6 vor C7**, weil C6 die letzten Code-seitigen Unregelmäßigkeiten räumt, bevor die Pilot-Dokumentation finalisiert wird. C6 sollte nicht mit einem offenen Bug im Test-Harness in den Pilotbetrieb gehen.
