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

### C6.5 · CI-Stabilisierung (Lock-File-Drift durch Bolt)

**Fundstelle**: Unmittelbar nach dem C5-Block-Abschluss-Push (Commits `1d2e7285` + `57846fd1` auf main, 2026-04-22) scheiterte die GitHub-Actions-CI bei den Jobs **Typecheck** und **Build** mit je drei Annotations — Root-Cause: `Cannot find module '@vitejs/plugin-react' or its corresponding type declarations` in `vite.config.ts:2`.

**Symptom**: Lokale Entwicklung mit `npm install`-Semantik (permissiv, löst Caret-Ranges zur neuesten kompatiblen Version auf) funktioniert grün. CI nutzt `npm ci`-Semantik (strikt, installiert exakt nach `package-lock.json`) und scheitert, weil der Lock-File-Stand nicht zur aktuellen `package.json` passt.

**Diagnose**: Bolt hat nach unserem Push automatisch **sechs Folge-Commits** gesetzt, darunter `2fc4e4bb "Updated package-lock.json"`. Dieser Commit ist kein einfacher Lock-File-Resync, sondern ein **Downgrade-Revert** der C1-Dependency-Upgrades:

| Package | `package.json` (unser Stand) | Bolt's Lock-File `2fc4e4bb` |
|---|---|---|
| `express` | `^5.2.1` (C1.1-Upgrade) | `4.21.2` (revertiert) |
| `vite` | `^7.3.2` (C1.2-Upgrade) | `5.4.21` (revertiert) |
| `@vitejs/plugin-react` | `^5.2.0` | `4.3.1` (revertiert) |
| `@playwright/test` | `^1.59.1` | **entfernt** |
| `supertest` | `^7.2.2` | **entfernt** |
| `concurrently` | `^9.2.1` | `9.0.1` (revertiert) |

Der CI-Lauf auf `2fc4e4bb` ging grün — aber nur, weil Bolt's Lock-File in sich konsistent ist. Der Code-Zustand entspricht einer inkonsistenten Mischform: Quelldateien erwarten Express 5 / Vite 7 / Playwright, die installierten `node_modules` sind eine regredierte Vorstufe.

**Warum jetzt und nicht früher**: Der ursprüngliche Lock-File-Stand (aus `c01f0bfb`, Mai 2025) war bereits mit `package.json` nur partiell konsistent — die C1-Upgrades waren im package.json, aber offenbar ohne sauberen `npm ci`-Reset des Lock-Files committed. Zwischen dem letzten CI-Lauf auf `af04dd9b` und unserem Push auf `57846fd1` lag kein Push, der einen neuen CI-Lauf ausgelöst hätte — die Inkonsistenz blieb latent. Unser Push hat durch die zusätzlichen npm-Scripts (`demo:reset:fresh` etc.) den Lock-File-Drift sichtbar gemacht.

**Behebungs-Optionen** (mit Aufwands-Schätzung):

- **Option A · Frische Lock-File-Regeneration (empfohlen)**: `rm -rf node_modules package-lock.json && npm install` gegen unser `package.json` (Express 5, Vite 7). Verifikation aller vier Build/Test-Pipelines. Commit auf neuem Branch, Review, Merge nach main. Aufwand: ~20 min.
- **Option B · Downgrade akzeptieren, C1 revertieren**: `package.json`-Dependencies auf Bolt's Versionen angleichen (Express 4.21.2, Vite 5.4.21, Playwright + supertest entfernen). Code auf Express-4-Kompatibilität prüfen. Aufwand: ~1 Stunde plus manuelle Review. **Nicht empfohlen** — wäre formales Reversal der C1-Upgrades.
- **Option C · Bolt-Config-Anpassung**: Herausfinden, was Bolt dazu bringt, den Lock-File zu überschreiben (Bolt-Registry-Mirror, npm-Pin-Regeln, `.npmrc`). `engines`-Feld in `package.json` setzen (Node 22, npm 10). `.nvmrc` anlegen. Prüfen, ob Bolt einen „Don't modify lock-file"-Modus hat. Aufwand: ~2–4 Stunden, unbestimmtes Ergebnis.

**Empfehlung**: **Option A nach der UVM-Demo**, auf separatem Branch. Falls Bolt erneut einen Counter-Commit pusht, Option C parallel untersuchen.

**Bolt-Verhaltens-Risiko**: Dr. Steiners Annahme ist, dass Bolt nach jedem main-Push seinen eigenen Lock-File-Stand durchsetzt. Falls das beim v0.9-Tag-Push erneut passiert, entsteht eine Regression-Schleife. In dem Fall ist Option C die belastbare Lösung, weil sie Bolt's Überschreibungs-Verhalten strukturell adressiert.

**Demo-Relevanz**: Die Bolt-Laufzeit funktioniert vermutlich trotzdem (Bolt's eigenes Build-System nutzt sein konsistentes Lock-File). Die Demo-Klick-Pfade aus C5.4 sind davon unberührt. Der CI-Fehler ist aktuell **Hygiene-Thema, nicht demo-blockierend**.

**Zeitplan**: C6.5 wird nach der Demo angegangen, zusammen mit C6.4 (SQLite-Race, Notiz 8) und C6.1 (Zwei-Phasen-Commit-Reconciler, Notiz 1), weil alle drei Test-/CI-Infrastruktur betreffen. Reihenfolge: **C6.5 vor C6.4**, weil C6.5 die Grundlage (stabile CI-Runs) für die Verifikation der anderen C6-Teile liefert.

#### Aktualisierung 2026-04-23 · CI-Workaround implementiert (`npm install`)

**Beobachtung nach zwei Force-Pushes auf main (2026-04-22 und 2026-04-23)**: Bolt setzt reproduzierbar Counter-Commits, die neben Lock-File-Regressionen auch Dokumentations-Änderungen (README-Abschnitt Playwright gelöscht) und SQLite-Fallback-Meta-Updates enthalten. Das Muster ist systematisch, nicht zufällig: Bolt synchronisiert das Repo gegen seinen eigenen, älteren Projekt-Zustand zurück. Jeder Push auf main löst einen Bolt-Sync aus, der Pre-C1-Dependencies (Express 4, Vite 5, kein Playwright) wiederherstellt.

**Folge für die CI**: Jeder Push auf main erzeugt einen CI-Lauf, der bei `npm ci` im Typecheck- und Build-Job bricht, weil `package-lock.json` (Bolt-Stand) und `package.json` (unser Stand) divergieren. Das erzeugt wiederkehrende GitHub-Actions-Failure-E-Mails und blockiert schlanke Demo-Vorbereitung.

**Workaround (ab 2026-04-23 in `.github/workflows/ci.yml` aktiv)**: Alle fünf CI-Jobs (Typecheck, Backend-Tests, Frontend-Tests, Build, E2E) nutzen `npm install` statt `npm ci`. Die permissive Install-Semantik löst Caret-Ranges zur neuesten kompatiblen Version auf und ignoriert Lock-File-Drift, solange die `package.json`-Constraints erfüllbar bleiben. Die Build-Reproduzierbarkeit sinkt damit formal — für den aktuellen Betriebsmodus (Einzelkunden-Demo, kein npm-Publish, keine Delivery-Pipeline mit strikten Versions-SLAs) akzeptabel.

**Commit**: `ci: switch typecheck and build to npm install (C6.5 bolt workaround)`

**Drei Langfrist-Optionen (Entscheidung nach der UVM-Demo)**:

- **Option X · Codebasis an Bolt-Dependencies anpassen**: Downgrade `package.json` auf Express 4, Vite 5, Playwright entfernen. Verlust der C1-Upgrades, aber volle Bolt-Kompatibilität. Risiko: C1 war eine bewusste Sicherheits-/Feature-Entscheidung (Express 5 mit automatischem Body-Parser-Limit, Vite 7 mit verbessertem Dev-Server). Aufwand: ~2–4 Stunden plus manuelle Code-Review.
- **Option Y · Bolt aus dem produktiven Workflow entfernen**: Bolt-Instanz bleibt als reine Demo-Anzeige (read-only-Klon). Entwicklung nur noch via lokale Claude-Code-Sessions + direkten Git-Push. Branch-Protection-Rules auf main (require-PR, dismiss-stale-reviews, restrict-push-to-admins). Bolt-Account aus den main-Push-Rechten ausbauen. Aufwand: ~1 Stunde (GitHub-Settings-Änderung plus Bolt-Zugriffs-Audit).
- **Option Z · `package-lock.json` in `.gitignore`**: Lock-File aus Repo entfernen, CI baut ausschließlich gegen `package.json`. Weniger reproduzierbare Builds (jeder CI-Lauf installiert potenziell andere Minor-/Patch-Versionen), für ein Produkt ohne npm-Publish und ohne strikte Versions-SLAs vertretbar. Aufwand: ~15 Minuten.

**Entscheidung**: Vertagt bis nach der Kollegen-Demo. Option Y wirkt strukturell am sauberstens (adressiert die Wurzel statt das Symptom), Option Z am günstigsten (schneller Ausstieg), Option X am disruptivsten (Reversal von C1-Arbeit). Die Entscheidung hängt von der Demo-Rückmeldung ab: Wenn die Kollegen Bolt als sinnvolles Anzeige-Werkzeug einstufen, wird Y bevorzugt; wenn Bolt als rein zufälliger Host dient, reicht Z.

**Verhältnis A/B/C ↔ X/Y/Z**: A/B/C (oben in diesem Abschnitt) beschreiben Optionen zur **akuten Lock-File-Konsistenz-Wiederherstellung** (z. B. vor einem npm-Publish-Release). X/Y/Z beschreiben Optionen zur **strukturellen Beseitigung der Bolt-Regression-Schleife**. Beide Achsen können kombiniert werden: z. B. Option Y (Bolt aus dem Workflow) plus Option A (sauberer Lock-File-Reset) nach der Demo.

### Gesamt-Aufwand C6 (aktualisiert)

| Teil | Charakter | Aufwand |
|---|---|---|
| C6.1 | Schema-lastig | 1–2 Tage |
| C6.2 | Content-lastig | 15 Min |
| C6.3 | UI-lastig, Debug-Risiko | 1–2 Tage |
| C6.4 | Infrastruktur | 0,5–1 Tag |
| C6.5 | CI-/Dependency-Management | 20 Min (Option A) — 4 Std. (Option C, falls nötig) |
| **Summe** | — | **2,75–5,5 Arbeitstage** |

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

1. **C6.5** (CI-Stabilisierung, 20 Min via Option A) — **muss zuerst**, weil alle anderen C6-Teile eine stabile CI-Pipeline für Verifikation brauchen
2. **C6.2** (Path-Traversal-Kommentar, 15 Min) — Aufwärm-Commit, risikoarm
3. **C6.4** (SQLite-Race, 0,5–1 Tag) — Test-Infrastruktur-Verbesserung, hebt die Parallelisierungs-Einschränkung
4. **C6.1** (Zwei-Phasen-Commit-Reconciler, 1–2 Tage) — Datenintegritäts-Konsolidierung, am besten nach C6.4 wegen Test-Anforderungen
5. **C6.3** (Frontend-Notice-Akkumulation, 1–2 Tage) — Der komplexeste Teil, Debug-Risiko; besser am Schluss, wenn andere C6-Teile bereits grün sind

Jeder C6-Teil bekommt einen eigenen Commit nach dem C3/C5-Muster (`C6.1: …`, `C6.2: …` etc.), mit Verweis auf die jeweilige Meta-Review-Notiz. Die Kalibrierungs-Regel-Dreiheit aus Notiz 16/17/18 hilft bei der Schätzung pro Teil.

## 5 · Akzeptanzkriterien C6

- ✅ CI-Pipeline stabilisiert (Typecheck + Build + Tests grün auf main, `npm ci` scheitert nicht mehr an Lock-File-Drift)
- ✅ Path-Traversal-Kommentar ergänzt
- ✅ SQLite-Race aufgehoben (`--test-concurrency=1` kann für Integration-Tests entfallen, Laufzeit messbar reduziert)
- ✅ Zwei-Phasen-Commit-Pattern hat definierte Konsistenz-Garantie (Compensating-Action, Reconciler oder dokumentiertes Monitoring)
- ✅ Full-E2E-Suite läuft stabil in 2 aufeinanderfolgenden Läufen (16/16 grün), ohne `test.skip` oder `test.retry`
- ✅ Supabase-Code-Pfad bleibt lauffähig (wird nicht unabsichtlich deaktiviert)
- ✅ Meta-Review-Notizen 1, 2, 4 Teil B, 8 als „erledigt" markiert; die übrigen Notizen (3, 5–7, 9–15, 16–18) bleiben offen für C7 oder spätere Iterationen
- ✅ C6.5-Befund zum Bolt-Verhalten dokumentiert (falls Counter-Commits auftreten, wurde Option C evaluiert)

## 6 · Abgrenzung zu C7

**C7 · Pilotfreigabe-Dokumentation** (siehe `BLOCK-C.md`) bleibt unverändert im Plan: UAT-Paket, Release-Notes, Betriebshandbuch, Härtungs-Checkliste. Die Meta-Review-Notizen, die in C6 bearbeitet werden, sind kein Teil von C7. C7 adressiert die verbleibenden, primär dokumentations-orientierten Notizen und die Produkt-Einführungs-Artefakte.

Reihenfolge-Empfehlung: **C6 vor C7**, weil C6 die letzten Code-seitigen Unregelmäßigkeiten räumt, bevor die Pilot-Dokumentation finalisiert wird. C6 sollte nicht mit einem offenen Bug im Test-Harness in den Pilotbetrieb gehen.
