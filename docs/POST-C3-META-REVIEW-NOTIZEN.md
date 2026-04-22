# Post-C3-Meta-Review-Notizen

> Stand: 2026-04-22, C3-Block abgeschlossen (Commits `c01f0bfb`
> bis `96ccb840`, kumulative Reduktion `server/index.js`
> 3906 → 131 Zeilen, −96.6 %).
>
> Diese Datei sammelt 15 Beobachtungen, die während der C3-Phase
> (Zerlegung `server/index.js`) auftauchten, aber nicht in einzelnen
> Iterations-Commits gelöst wurden. Die Meta-Review zu Beginn von
> **C7** (Pilotfreigabe-Dokumentation) arbeitet diese Liste ab.
>
> Format pro Punkt: kurze Benennung, Ort des Fundes, Symptom,
> geplante Auflösung. Die Liste ist eine Arbeitsvorlage — einzelne
> Punkte können in Polish-Commits gezogen werden, wenn sie
> mechanisch klein und isoliert sind.

## Inhaltsverzeichnis

| # | Titel | Kategorie |
|---|---|---|
| 1 | Zwei-Phasen-Commit-Muster in `persistExportPackage` und POST-Upload | C6-Architektur |
| 2 | Path-Traversal-Schutz in `readExportArtifact` dokumentieren | Polish |
| 3 | Explizite ESM-Imports decken latente Referenzfehler auf (+ Byte-Identitäts-Praxis) | Methode |
| 4 | Rate-Limit-Akkumulation in Dev-Sessions | Polish |
| 5 | Deps-Object-Muster retroaktiv auf Null-Deps (**erledigt im Polish-Commit nach C3.6**) | Erledigt |
| 6 | Pure-Logik-Module im `server/`-Root · Heimat-Kategorie klären | Post-C3 / C4-Anfang oder C7 |
| 7 | ESM-Hoisting-Fallen bei Test-Bootstrap | Methode |
| 8 | SQLite-Race bei parallelen Integration-Test-Subprozessen | C6/C7-Infrastruktur |
| 9 | Heavy-Tail-Kalibrierung hat breite Spanne | Methode |
| 10 | Backend-Test-Count am C3-Ende · reale Zahl und Nachtrag | BLOCK-C.md |
| 11 | Seed-Design-Regel für Integration-Tests | Konvention |
| 12 | Reine Service-Extraktion ist kalibrierungsstabilste Iteration-Form | Methode |
| 13 | ESM-Modul-Semantik als Singleton-Pattern | Konvention |
| 14 | Obsolete Imports skalieren mit Cross-Module-Integrations-Tiefe | Methode |
| 15 | Dokumentations-Overhead aus Iterations-Historie | Methode |
| 16 | Kalibrierungs-Faktor für schema-lastige Erweiterungen (Entwurf · landet in C5.4) | Methode |
| 17 | E2E-Tests fangen Integrations-Bugs, die Unit-Tests nicht sehen (Entwurf · landet in C5.4) | Methode |
| 18 | Content-Produktion als eigene Kalibrierungs-Kategorie (Entwurf · landet in C5-Abschluss-Commit) | Methode |

## Beobachtungen

### 1. Zwei-Phasen-Commit-Muster in `persistExportPackage` und POST-Upload
- **Fund:** C3.2-Analyse (Export-Service-Extraktion), C3.4-Analyse
  (Evidence-Route-Extraktion).
- **Symptom:**
  - `persistExportPackage` (C3.2): Storage-Ablage passiert zuerst,
    Registry-Write zweitens, kein Rollback bei Registry-Fehler.
  - POST `/api/evidence/:id/attachment` (C3.4, jetzt in
    `routes/evidence.js`): Gleiches Muster — `storage.storeTempFile`
    (Phase 1, File nach `server-storage/uploads/`) läuft vor
    `writeVersions` (Phase 2a) und `writeState` (Phase 2b). Bei Fehler
    zwischen Phase 1 und 2a entsteht ein **File-Orphan** (Datei liegt,
    keine Version-Referenz, keine State-Referenz). Bei Fehler zwischen
    2a und 2b entsteht ein Versions-Ledger-/State-Mismatch ohne
    File-Orphan.
  - Historisch gewachsen; im Happy-Path wirkungslos, im Fehlerpfad
    entstehen Orphan-Artefakte oder halb-persistierte Zustände.
- **Auflösung:** C6-Bewertung (Consistency-Refactor nach
  E2E-Stabilisierung). Mögliche Muster: (a) Compensating-Action
  (storage.removeObject bei writeVersions-Fehler), (b) Reconciler-Job,
  der regelmäßig uploads/ gegen den Versions-Ledger vergleicht, (c)
  optimistisch lassen und via Monitoring entdecken. Kein Blocker für C3.

### 2. Path-Traversal-Schutz in `readExportArtifact` dokumentieren
- **Fund:** C3.2-Analyse.
- **Symptom:** `path.basename(rawExportId).replace(/\.json$/i, '')` ist
  korrekt implementiert, aber ohne Inline-Kommentar zur Security-
  Intention. Spätere Wartung könnte das für reinen Slug-Sanitize
  halten und die defensive Schicht verlieren.
- **Auflösung:** Polish-Commit nach C3.7: Security-Kommentar ergänzen.

### 3. Explizite ESM-Imports decken latente Referenzfehler auf
- **Fund:** C3.1 (Module-Pack-Registry-Extraktion).
- **Symptom:** `presentModulePackEntry` und `upsertImportedModulePack`
  referenzierten `sanitizeModulePackEntry` ohne Import — der
  monolithische `server/index.js` hatte die Funktion im globalen
  Scope, die E2E-Registry-Szenarien liefen nie gegen leere Registry,
  daher unentdeckt. Extraktion zwang die explizite Import-Deklaration
  und fand den Bug automatisch.
- **Auflösung:** Methoden-Notiz für die Meta-Review — keine
  Code-Änderung. **Lektion:** Extraktion ist ein impliziter
  Static-Analysis-Pass.
- **Ergänzung nach C3.7a (Byte-Identitäts-Praxis als Self-Check):**
  Während der C3.7a-Extraktion habe ich unabsichtlich einen
  Logik-Wechsel eingebaut (`buildSeedState(...)` →
  `sanitizeState({...})` in `seedFreshSystemIfEmpty`). Das fiel
  beim direkten Byte-Vergleich mit dem Ist-Code auf, BEVOR der
  Commit geschrieben wurde — nicht erst im Test-Run. **Beide
  Funktionen hätten ähnlich-geshaped Ergebnisse geliefert**, aber
  mit unterschiedlichem Default-Fallback-Verhalten: `buildSeedState`
  trägt `runtime-Defaults` ein, `sanitizeState` sanitized nur
  das eingegebene Objekt. **Tests hätten das schwer gefangen**,
  weil der Demo-Tenant-State in beiden Varianten grundsätzlich
  funktionsfähig wäre — nur sehr subtile Field-Defaults-Unterschiede
  hätten sich irgendwann in Integrity-Scan-Tests gezeigt. Lektion:
  **Byte-identische Extraktion ist kein Ritual, sondern ein
  echter Schutz** — bei jedem Edit den Ist-Code direkt vergleichen,
  nicht auf Test-Coverage als Netz vertrauen. In C3.1–C3.6 hat
  dieses Muster wiederholt Logik-Drift-Bugs abgefangen, die
  durchs Test-Sieb gefallen wären.

### 4. E2E-15-Flake · zwei unterschiedliche Phänomene im selben Szenario
- **Fund:** Debug-Zyklus während C3.2 (ursprünglich), präzisiert
  durch C3-Validierungs-Rerun am 2026-04-22.
- **Hintergrund:** Der C3-Validierungs-Rerun (Full-Suite mit allen
  16 Chromium-Szenarien) fiel zweimal in Folge mit identischem
  Fehler in Szenario 15 (Platform Login + Logout) auf. Der
  Isolations-Test-Lauf von Szenario 15 alleine war grün (7.4 s).
  Die saubere Trennung „Full-Suite rot, Isolation grün" zeigt,
  dass das Szenario zwei unterschiedliche Failure-Modi hat, die
  bisher unter dem Sammel-Begriff „E2E-15-Flake" liefen. Die
  präzisere Dokumentation spart einem späteren Debugger Zeit.

#### Teil A · Rate-Limit-Akkumulation in Dev-Sessions
- **Symptom:** Login-Rate-Limit (12 Versuche / 15 min) und
  API-Rate-Limit (180–300 Requests / 60 s) saturieren in
  Debug-Reruns und liefern 429. E2E-Log zeigt „Zu viele Anfragen",
  die Fehlerquelle wird als funktional fehlinterpretiert.
- **Reliably adressiert durch:** `KRISENFEST_LOGIN_RATE_LIMIT_MAX=500`
  + `KRISENFEST_RATE_LIMIT_MAX=5000` als Env-Variablen vor dem
  Playwright-Aufruf. Im C3-Validierungs-Rerun wurden diese Werte
  gesetzt — das 429-Pattern trat dabei **nicht** auf.
- **Auflösung:** Polish-Commit (nach C3) — permanentes Env-Var-Setup
  für Dev-/Test-Umgebung in `.env.development` oder einem
  `test:e2e`-npm-Script-Wrapper, damit die Env-Variablen nicht
  bei jedem Playwright-Aufruf manuell gesetzt werden müssen.

#### Teil B · Frontend-Notice-State-Akkumulation über 14 E2E-Szenarien
- **Fund:** Neu erkannt durch den C3-Validierungs-Rerun (2026-04-22).
- **Symptom:** Nach dem Logout-Click in Szenario 15 bleibt die
  alte Success-Notice `„Anmeldung für Mandant „Demo-Unternehmen"
  erfolgreich."` sichtbar. Die erwartete Logout-Notice
  `„Serversitzung wurde beendet. Der offene Arbeitsbereich bleibt
  nutzbar."` erscheint **nicht**. Die Session wurde serverseitig
  korrekt beendet (`Aktive Sitzungen: 0` im Page-Snapshot), die
  Status-Card wechselt in den Offline-Modus — nur die UI-Notice
  aktualisiert sich nicht.
- **Trennung zu Teil A:** Die Rate-Limit-Env-Vars waren gesetzt,
  der 429-Pfad greift nicht. Die Trennung zum Rate-Limit-Fehler
  ist klar — Teil B ist ein **Frontend-State-Update-Race**, kein
  Server-seitiger Fehler. Der `/api/auth/logout`-Endpoint liefert
  korrekt 200 (byte-identisch seit C3.0c in
  `services/auth-session.js` + C3.6-Polish in `routes/auth.js`).
- **Trennung zu C3-Regression:** Der Isolations-Test-Lauf grün
  (Szenario 15 alleine, frischer Server) beweist, dass der
  Logout-Flow korrekt funktioniert. **Der Fehler ist nicht durch
  C3 entstanden** — C3 hat kein Frontend-Code verändert. Das
  Phänomen ist State-Akkumulation aus den vorherigen 14 Szenarien.
- **Vermutliche Diagnose-Pfade:**
  - **Notice-Display-Component-Audit:** Die zentrale Notice-Queue
    (wahrscheinlich in `src/state/` oder `src/hooks/` via
    `useNoticeDispatch` o.ä.). Wenn alte Notices nicht sauber
    dismissed werden, können sie neue Notices verdrängen oder
    deren Sichtbarkeit unterdrücken.
  - **`usePlatformAuthHandlers.ts` Notice-Dispatching:** Die
    `showNotice(...)`-Aufrufe in `handleServerLogout` und
    `clearAuthenticatedContext` werden in schneller Reihenfolge
    dispatched. Möglicherweise kollidieren sie bei aufgebautem
    State-Queue.
  - **`beforeEach`/`afterEach`-Hooks der Szenarien 1–14
    auditieren:** Räumen alle Szenarien ihren Notice-State /
    Session-State korrekt auf? Wahrscheinlich Kandidaten für
    Cleanup-Lücken: Szenarien mit Login-Flow (z.B. 10, 12, 14)
    oder Szenarien, die State-Synchronisierungs-Fehler erzwingen.
  - **React-Devtools-Inspektion nach Szenario 14:** Notice-State
    snapshotten, Queue-Größe prüfen, Notice-Dismiss-Timer-Stati
    lesen.
- **Priorität:** **C6-Polish-Kandidat.** Kein Blocker für die
  C3-Block-Abschluss-Validierung (C3 ist formell durch: 15/16 grün
  ist im vor-C3-Stand identisch, Isolations-Test grün beweist
  Server-Korrektheit). Ticket für nach C3 priorisieren.
- **Temporärer Workaround (falls Rot-Runs störend werden):**
  Playwright-Retry-Flag für Szenario 15 via
  `test.describe.configure({ retries: 2 })`. Das ist keine
  Lösung, sondern eine Mitigation — die zugrundeliegende
  State-Akkumulation bleibt, nur wird sie nicht mehr als Rot
  reportet.

### 5. Deps-Object-Muster retroaktiv auf Null-Deps
- **Fund:** C3.1 (Kommentar in `routes/modules.js`).
- **Symptom:** Die fünf vor-Foundation-Route-Module (admin, auth,
  files, integration, system) nutzen noch das ältere Deps-Object-
  Muster mit `registerXRoutes(app, deps)` und 30+ explizit
  destrukturierten Dependencies. Die C3.1-C3.4-Route-Module nutzen
  Null-Deps (direkter Service-Import). Inkonsistenz zwischen den
  beiden Hälften.
- **Auflösung:** Polish-Commit nach C3.7 — retroaktive Umstellung
  der fünf alten Route-Module auf Null-Deps. Mechanisch klein
  (je Modul ca. 10-30 Zeilen Deps-Destrukturierung durch direkte
  Imports ersetzen), aber fünf separate Tests-Grün-Checks.
- **Kalibrierungs-Befund (C3.5):** Der Nachzug **kostet netto
  Zeilen** — grobe Schätzung **+20 bis +50 Zeilen** in Summe über
  die fünf Module. Hintergrund: Jeder Konsument, der bisher per
  Deps-Entry bedient wurde, braucht nach der Auflösung einen eigenen
  Import-Block (Import-Statement + Kommentar + ggf. Gruppierung).
  Bei 30+ Entries pro Modul × 5 Modulen summiert sich das. Die
  Parameter-Entfernung am Aufruf-Site (−1 Zeile pro Entry) wird von
  den +3–5 Zeilen pro neuem Import-Block überkompensiert.
  **Konsequenz:** Die Begründung für den Nachzug ist **strukturell**
  (Konsistenz mit dem seit C3.1 etablierten Muster, kein verstecktes
  Parameter-Durchreichen, leichtere Lesbarkeit der Abhängigkeiten),
  **nicht LoC-basiert**. Das ist kein Gegenargument — Konsistenz ist
  der Hauptgewinn — aber die Kommunikation muss das richtig
  einordnen.
- **Nachtrag nach Polish-Commit (2026-04-22):** Die
  C3.5-Projektion (+20 bis +50 netto) wurde im tatsächlichen
  Polish-Commit auf **−16 netto** gekippt — aber **nicht durch
  eine bessere als erwartete Deps-Auflösung**, sondern durch
  **zwei opportunistische Helfer-Umzüge** im selben Commit:
  `sanitizeAccountForResponse` nach `services/sanitizers.js`
  (Option B statt Option A) und `observability` nach
  `services/observability.js` als ESM-Singleton (für volle
  Null-Deps-Symmetrie von `routes/system.js`). Der reine
  Deps-Entry-Auflösungs-Anteil lag im projizierten Bereich;
  die beiden Helfer-Umzüge brachten zusätzlich ~40 Zeilen weg
  aus `server/index.js`. **Der Kalibrierungs-Befund bleibt
  valide für reine Deps-Entry-Auflösung** — opportunistische
  Helfer-Umzüge sind eine separate Wirkung, die bei Scope-
  Erweiterung die Netto-Bilanz kippen kann. Für zukünftige
  Refactorings heißt das: „Null-Deps-Nachzug" und „Helfer-
  Umzug" separat projizieren und im Commit-Titel klar trennen.

### 6. Pure-Logik-Module im `server/`-Root · Heimat-Kategorie klären
- **Fund:** C3.4-Vorspann (ursprünglich als isolierte Frage zu
  `evidence-platform.js` notiert; C3-Abschluss 2026-04-22 zur
  Kategorie-Entscheidung erweitert).
- **Symptom:** Acht Pure-Logik-Dateien liegen im `server/`-Root
  nebeneinander, ohne explizite Heimat-Kategorie:
  - `auth-provider.js` · OIDC-Primitive
  - `evidence-platform.js` · Retention-Berechnung
  - `hardening.js` · Request-Hardening + Security-Summaries
  - `module-packs.js` · Parse-/Validate-/Overlay-Engine
  - `object-storage.js` · Storage-Driver-Factory
  - `persistence.js` · Document-Store-Factory
  - `persistence-supabase.js` · Supabase-Driver
  - `regulatory-dach.js` · KRITIS-Regelwerk-Normalizer
  - `security.js` · Upload-Policy + Middleware-Factories

  Alle sind pure Logik ohne I/O-Seiteneffekte (bzw. mit
  Factory-Pattern für I/O). Die Foundation-Phase hat `services/`
  für stateful-I/O-Module und `config/` für Konstanten etabliert.
  Pure-Logik-Module haben in dieser Taxonomie **keinen klaren
  Heimplatz**.
- **Auflösung:** **Entscheidung auf Post-C3 verschoben**, damit
  die Kategorie **als Gesamtheit** bewertet werden kann. Eine
  Einzel-Entscheidung für `evidence-platform.js` würde die
  Konsistenz-Bewertung aller 8+ Pure-Logik-Module brechen. Der
  passende Zeitpunkt für die Kategorie-Entscheidung ist:
  - **Anfang C4** (wenn ein Feature-Block beginnt und neue
    Pure-Logik-Dateien hinzukommen würden — dann ist die
    Heimat-Frage in der Planungs-Phase natürlicher), ODER
  - **C7-Meta-Review** (als Teil der Gesamt-Architektur-
    Reflexion, die ohnehin anliegt).
- **Optionen für die spätere Entscheidung:**
  - **(a)** neue Kategorie `server/lib/` oder `server/domain/`
    für Pure-Logik einführen, alle 8+ Dateien dorthin umziehen
  - **(b)** Pure-Logik-Module explizit im `server/`-Root
    belassen und das als dokumentierte Kategorie festhalten
    („`server/*.js` = Pure-Logik, `server/services/*.js` =
    stateful I/O, `server/routes/*.js` = HTTP-Handler,
    `server/config/*.js` = Konstanten")
  - **(c)** Fallweise Klassifizierung — manche Module bleiben
    (z.B. `security.js` wegen Express-Middleware-Factory-Nähe),
    andere ziehen um
- **Kein Blocker für C3.** C3-Scope war Extraktion aus
  `server/index.js`, nicht Umbau der Pure-Logik-Taxonomie.

### 7. ESM-Hoisting-Fallen bei Test-Bootstrap
- **Fund:** C3.4-Vorspann (Integration-Tests für Evidence-Endpoints).
- **Symptom:** Der erste Entwurf des `app.listen()`-Guards in
  `server/index.js` nutzte `if (!process.env.KRISENFEST_NO_LISTEN)`,
  die Test-Datei setzte die Env-Variable mit
  `process.env.KRISENFEST_NO_LISTEN = '1'` vor dem Import. Unter ESM
  werden `import`-Statements vor allen Body-Statements gehoisted —
  das Environment-Setup läuft also erst, nachdem `server/index.js`
  bereits geladen und `app.listen()` gestartet ist. Der Test
  funktionierte, aber die Express-App band einen echten Port (8787),
  was bei parallelen Runs zu `EADDRINUSE` geführt hätte.
- **Auflösung:** Kanonisches Muster im zu testenden Modul selbst:
  ```js
  import { pathToFileURL } from 'node:url';
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    app.listen(...);
  }
  ```
  In C3.4-Vorspann bereits umgesetzt. **Lektion für die
  Meta-Review:** Env-Var-Gates in importierten Modulen sind unter
  ESM unzuverlässig; Main-Module-Check ist die einzige robuste
  Primitive. Diese Notiz ist der Hilfe-Anker, wenn jemand später
  in ein ähnliches Problem läuft.

### 8. SQLite-Race bei parallelen Integration-Test-Subprozessen
- **Fund:** C3.5-Vorspann (zweites Integration-Test-File
  `state-endpoints.test.js` neben `evidence-endpoints.test.js`).
- **Symptom:** `node --test` spawnt pro Test-File einen Subprozess
  (Default-Concurrency = # cores − 1). Beide Integration-Test-Files
  schreiben parallel auf die zentrale
  `server-storage/system/krisenfest.sqlite` und die begleitenden
  JSON-Mirrors (`tenants.json`, `auth.json`). Ergebnis: `"database
  is locked"`-Fehler aus dem Login-Pfad, `ENOENT` beim atomaren
  `tenants.json.tmp → tenants.json`-Rename. Kein Ist-Stand-Bug —
  reine Test-Infrastruktur-Race-Condition.
- **Aktuelle Mitigation:** `--test-concurrency=1` im
  `test:server`-npm-Skript. Sequenzielle Ausführung kostet ~1.5s
  bei 48 Tests (5.3s → 6.4s) — vernachlässigbar.
- **Skalierungs-Problem:** Jeder weitere Vorspann-Commit (C3.6,
  C3.7, und darüber hinaus) fügt potentiell ein weiteres
  Integration-Test-File hinzu. Bei 6–8 Integration-Test-Files
  wird die sequenzielle Laufzeit spürbar (je Test-File ~2–3s
  Bootstrap + Tests). Bei 10+ Files ist die Laufzeit im
  CI-Feedback-Loop relevant.
- **Auflösung (C6 oder C7):** Zwei Kandidaten, beide adressieren
  die geteilte SQLite:
  - **(a) Test-spezifische SQLite-Datei pro Test-File via
    Env-Variable.** `KRISENFEST_PERSISTENCE_DB_PATH` o.ä. wird
    vor dem Import von `server/index.js` gesetzt, jeder
    Test-File bekommt einen eigenen `server-storage-test-<file>`-
    Baum. Braucht Lifecycle-Management (Setup/Teardown der
    Test-Verzeichnisse). Paralleler Lauf wieder möglich.
  - **(b) In-Memory-SQLite für Integration-Tests.**
    `better-sqlite3` + node:sqlite unterstützen `:memory:`.
    Keine Platten-I/O → keine Rename-Races. Aber: der Object-
    Storage-Filesystem-Driver bleibt datei-basiert; Orphan-
    Cleanup-Test braucht einen Mix aus In-Memory-DB +
    isoliertem Uploads-Ordner.
  - **Entscheidung in der Meta-Review.** (a) ist mechanisch
    einfacher, (b) ist sauberer von I/O-Perspektive.
- **Kein Blocker für C3.** Die `--test-concurrency=1`-Lösung
  trägt bis zum Ende des Blocks.

### 9. Heavy-Tail-Kalibrierung hat breite Spanne
- **Fund:** C3.1 bis C3.5 (fünf Iterationen mit expliziten
  Zeilen-Projektionen vor der Extraktion und Ist-Messungen nach
  dem Commit).
- **Symptom:** Die Abweichung zwischen Projektion und Ist-Reduktion
  von `server/index.js` variiert weit:

  | Iteration | Projektion | Ist | Abweichung |
  |---|---:|---:|---:|
  | C3.1 | ~100 | −128 | **+21 %** über Projektion |
  | C3.2 | ~250 | −195 | **−22 %** unter Projektion |
  | C3.3 | ~60 | −56 | **±0 %** (triviale Extraktion) |
  | C3.4 | −219 | −388 | **+77 %** über Projektion |
  | C3.5 | −301 | −202 | **−33 %** unter Projektion |

  Spanne insgesamt **−33 % bis +77 %**. Punktschätzungen sind
  unreliabel, weil mindestens **vier Wirkfaktoren** in beide
  Richtungen wirken und sich pro Iteration unterschiedlich mischen:

  - **(+Richtung, erhöht Reduktion) Audit-Log-Boilerplate pro
    Handler.** Audit-lastige Handler mit 8-Feld-Objekten (id, at,
    userId, userName, action, resource, summary, sections) sind
    länger als die grobe Heuristik „15–40 Zeilen pro Handler"
    suggeriert. Hauptgrund der C3.4-Überschreitung.
  - **(+Richtung) Overhead-Posten.** Leerzeilen zwischen Handlern,
    Import-Bereinigung, multer-Setup, Bootstrap-Wrapper — alles
    nicht pro-Handler in der Projektion erfasst. Bei 6 Handlern
    summiert sich das auf +30 bis +50 Zeilen.
  - **(−Richtung, reduziert Reduktion) Service-Layer-Wachstum bei
    Inline-Handler-Extraktion.** Neue `services/*`-Dateien bekommen
    JSDoc-Präambeln, explizite Import-Blöcke, gruppierende
    Kommentare. Pro neuer Datei +30 bis +50 Zeilen über der reinen
    Pure-Logik-Zeilenzahl.
  - **(−Richtung) Parameter-Auflösungs-Kosten bei Konsumenten.**
    Wenn ein Symbol bisher per Parameter/Deps-Object durchgereicht
    wurde und auf direkten Import umgestellt wird, braucht jeder
    Konsument einen eigenen Import-Block. Bei 3 Konsumenten
    +10 bis +15 Zeilen, die die −6 Zeilen Parameter-Entfernung
    überkompensieren. Hauptgrund der C3.5-Unterschreitung.

- **Auflösung (Kommunikations-Form für C3.6/C3.7):** Statt
  Punktschätzungen **Bandbreiten mit expliziten Wirkfaktoren**
  angeben. Beispiel: „C3.6-Reduktion **−300 bis −500 Zeilen**,
  abhängig von (a) Anzahl der extrahierten Job-Typen
  (jeder +15–25 Zeilen Overhead in services/jobs.js), (b) ob der
  retroaktive Null-Deps-Nachzug mit drinsteckt (+20 bis +50
  Zeilen), (c) Anzahl der Admin-Summary-Funktionen, die noch von
  index.js-Konsumenten re-importiert werden müssen." Der Leser
  kann dann die wahrscheinliche Position innerhalb der Bandbreite
  selbst abschätzen, und überraschende Überschreitungen/
  Unterschreitungen werden zu Kalibrierungs-Daten statt zu
  Scheitern der Projektion.
- **Kein Code-Fix.** Methoden-Notiz für die Meta-Review.

### 10. Backend-Test-Count am C3-Ende — reale Zahl und Nachtrag
- **Fund:** C3.6-Vorspann-Abschluss (2026-04-22).
- **Reale Zahl:** **56 Backend-Tests** nach C3.6-Vorspann,
  proportional zum Risiko-Profil der Iterationen. Das ursprüngliche
  60-Ziel aus `BLOCK-C.md` war auf Basis der Scoping-Projektion
  gesetzt und lag **nahe an der tatsächlichen Ausführung**
  (Abweichung 4 Tests = 7 %). C3.7 bekommt keinen Vorspann
  (mechanisches Aufräumen von Bootstrap + Middleware ohne
  Verhaltens-Risiko), daher bleibt 56 der Endstand.
- **Aufschlüsselung:**
  - 38 Baseline-Unit-Tests (security, persistence, module-packs,
    regulatory-dach, hardening, auth-provider, object-storage,
    evidence-platform — unverändert seit Block-Beginn)
  - 5 Evidence-Integration-Tests aus C3.4-Vorspann
  - 5 State-Integration-Tests aus C3.5-Vorspann
  - 5 Top-Level-Tests + 3 `t.test()`-Sub-Tests = 8 Test-Einheiten
    aus C3.6-Vorspann (`system-jobs-endpoints.test.js`)
- **`node:test`-Sub-Test-Zählung:** Der C3.6-Vorspann nutzt
  Variante C — das erste Top-Level-Test seedet einen Tenant und
  fährt darin drei separate `t.test()`-Sub-Tests für
  `integrity_scan`, `export_inventory` und die job-runs-Reihenfolge.
  `node:test` zählt jeden `t.test()`-Aufruf als eigenen Test in der
  Summary-Zeile. Deshalb 8 Test-Einheiten aus einem File, nicht 5.
  Der BLOCK-C.md-Nachtrag soll diese Zählkonvention explizit
  benennen, damit ein späterer Leser die Zahl 56 nachvollziehen
  kann, ohne den Quellcode der Tests anzuschauen.
- **Auflösung:** `BLOCK-C.md`-Nachtrag im **C3.7-Abschluss-Commit**
  (`docs: close out C3 and stage architecture findings for
  pre-pilot`). Zielmarke von 60 auf gemessenen Endstand 56
  korrigieren, plus Erklärung der Sub-Test-Zählung.

### 11. Seed-Design-Regel für Integration-Tests · Persistence-Reference vs. Raw-Artefakt
- **Fund:** C3.6-Vorspann-Debug (Test 3 `restore_drill` schlug
  initial fehl).
- **Symptom:** Ein Test-Seed schrieb die tenant-scoped
  `backup-log.json` direkt via `fs.writeFile`. Der konsumierende
  Service-Code (`buildRestoreDrillPayload`) las über `readJsonFile`,
  das zuerst den Persistence-Document-Store (SQLite) befragt und
  erst bei negativem Treffer auf den JSON-Mirror zurückfällt.
  Der Document-Store wusste nichts von der raw-geschriebenen Datei
  → `backupLog[0]` war `null` → `latestBackupAvailable=false`.
  Kein Ist-Stand-Bug, reines Seed-Design-Missverständnis.
- **Regel (architekturell, ab C3.6 verbindlich für alle
  Vorspann-Tests):**
  - **Files unter Persistence-Reference** (also alles, was
    `resolvePersistenceReference(filePath)` zu einem Reference-
    Objekt auflöst — state.json, audit-log.json, export-log.json,
    backup-log.json, versions.json, tenant-settings.json etc.):
    **Müssen via `writeJsonFile` geseedet werden.** Diese
    Funktion schreibt atomar Document-Store + Mirror und hält
    beide Quellen konsistent.
  - **Artefakt-Files ohne Persistence-Reference** (Snapshot-
    Files `snapshots/<id>.json`, Backup-Artefakt-Files
    `backups/<id>.json`, Job-Artefakt-Files `job-artifacts/
    <type>-<jobId>.json`): **Dürfen per `fs.writeFile`
    geschrieben werden.** Diese Pfade werden ausschließlich
    per-File gelesen (kein Document-Store-Lookup) —
    `readJsonFile` fällt hier auf den direkten FS-Read zurück
    (`resolvePersistenceReference` liefert `null`).
- **Prüfung im Zweifel:**
  `node -e "import('./server/services/persistence-wrappers.js').then(m => console.log(m.resolvePersistenceReference('/path/to/file.json')))"`.
  Liefert das ein Reference-Objekt, braucht der Seed
  `writeJsonFile`. Liefert es `null`, reicht `fs.writeFile`.
- **Auflösung:** Architektur-Regel. Kein Code-Fix, keine Doku-
  Korrektur außerhalb dieser Notiz — zukünftige Vorspann-Tests
  sollen diese Regel aus den Meta-Review-Notizen lesen (oder
  aus dem JSDoc-Hinweis im `__test__-helpers.js`, den ich
  in C3.7-Abschluss ergänze). **Kein Blocker.**
- **Kein Code-Fix.** Doku-Korrektur in `BLOCK-C.md`.

### 12. Reine Service-Extraktion ist die kalibrierungsstabilste Iteration-Form
- **Fund:** C3.6-Abschluss (2026-04-22).
- **Symptom:** Die Delta-Projektion für C3.6 (Bandbreite
  −700 bis −770 Zeilen in `server/index.js`) traf mit −2 %
  Abweichung fast genau — die engste Bandbreiten-Treue seit C3.3.
  Zusammen mit C3.3 (±0 %) zeigt sich ein Muster:

  | Iteration | Art | Abweichung von Projektion |
  |---|---|---:|
  | C3.1 | Service + Route + impliziter Import-Fix | +28 % |
  | C3.2 | Service + Route + Path-Traversal-Re-Design | −22 % |
  | C3.3 | Reine Route-Extraktion (minimal) | ±0 % |
  | C3.4 | Service + Route + Evidence-Handler | +77 % |
  | C3.5 | Service + Route + **3× Parameter-Auflösung** | **−33 %** |
  | C3.6 | Service-Extraktion ohne Parameter-Auflösung | −2 % |

- **Beobachtung:** Der dominierende Stör-Faktor bei
  Bandbreiten-Prognosen ist **nicht** Handler-Größe oder
  Service-Datei-Wachstum (beide sind kalkulierbar — Audit-
  Boilerplate ist zählbar, Präambel-Overhead ist konstant).
  Der Stör-Faktor ist die **Parameter-Auflösung**: Jeder
  Konsument, der bisher per Parameter/Deps-Object bedient wurde,
  braucht nach der Auflösung einen eigenen Import-Block
  (+3–5 Zeilen), der die −1 Zeile Parameter-Entfernung pro
  Call-Site überkompensiert. Bei 3 Konsumenten in C3.5 ergab
  das netto −33 % weniger Reduktion als projiziert.
- **Regel für künftige Refactorings (nach C3):**
  - Wenn die Iteration **reine Service-Extraktion** ist (kein
    Parameter-Plumbing geändert) → Bandbreiten-Prognose mit
    expliziten Wirkfaktoren trifft typisch auf ±5 %.
  - Wenn die Iteration **Parameter-Auflösung enthält** →
    pro betroffenen Konsumenten **+5 bis +10 Zeilen** im
    Import-Overhead einplanen, sonst unterschätzt die
    Projektion systematisch.
  - **Null-Deps-Nachzüge** (wie der Polish-Commit nach C3.6)
    sind strukturell **+Zeilen-Aktionen**, keine Reduktion.
    LoC darf nicht als Begründung genutzt werden — nur
    strukturelle Konsistenz.
- **Kein Code-Fix.** Methoden-Notiz für die Meta-Review und
  für C4/C5/C6-Block-Planung.

### 13. ESM-Modul-Semantik als Singleton-Pattern
- **Fund:** C3.6-Polish (zweite Anwendung des Musters, 2026-04-22).
- **Beobachtung:** Für cross-module-shared State, der genau
  eine Instanz haben soll, reicht ein **ESM-Modul mit
  Top-level-const-Export**. Node.js lädt Module per Spec nur
  **einmal pro Prozess**; alle Konsumenten teilen dieselbe
  Instanz.
  ```js
  // services/observability.js
  import { createObservabilityStore } from '../hardening.js';
  export const observability = createObservabilityStore({
    recentEventLimit: 120,
    maxLatencySamplesPerRoute: 240,
  });
  ```
  Jeder Konsument, der `import { observability } from
  './services/observability.js'` schreibt, bekommt dieselbe
  Instanz. Kein Dependency-Injection-Overhead, kein Factory-
  Pattern, keine Singleton-Klasse mit `getInstance()`-Methode.
- **Anwendungsfälle in C3:**
  - `persistenceLayerPromise` + `objectStoragePromise` in
    `services/persistence-wrappers.js` (C3.0b, lazy-init via
    Closure-Promise statt Top-level-const, weil der Init async
    ist und eine einmalige Init-Race-Prevention braucht).
  - `observability` in `services/observability.js` (C3.6-Polish,
    synchroner `createObservabilityStore`-Call → direktes
    Top-level-const-Export).
- **Wann NICHT verwenden:**
  - Wenn mehrere Konfigurationen pro Prozess nötig sind (z.B.
    Test-Mode mit gemockter Instanz). Dann Factory-Pattern
    oder explicit DI.
  - Wenn die Init Side-Effects hat, die beim Import nicht
    erwünscht sind (z.B. Netzwerk-Calls). Dann lazy-init über
    `getInstance()`-Helper oder ein module-lokales Promise.
- **Pattern-Bezeichnung für die Meta-Review:** „ESM-Top-Level-
  Singleton". Als Konvention für künftige C4/C5/C6-Blöcke
  festhalten, um gegen falsche DI-Reflex-Reaktionen
  („ich brauche Dependency-Injection") zu argumentieren.
- **Kein Code-Fix.** Methoden-Notiz.

### 14. Obsolete Imports skalieren mit Cross-Module-Integrations-Tiefe, nicht mit Funktions-Größe
- **Fund:** C3.7a-Abschluss (2026-04-22).
- **Symptom:** Die Delta-Projektion für C3.7a (Bandbreite
  −220 bis −245 Zeilen in `server/index.js`) wurde um −104 Zeilen
  unterschritten (Ist: −349). Der dominierende Wirkfaktor war
  **NICHT** die Funktions-Größe der vier extrahierten Bootstrap-
  Funktionen (die lagen korrekt im projizierten Rahmen ~−230),
  sondern die **stale-Imports-Ketten-Reaktion** nach der
  Extraktion: ~140 Zeilen obsolete Imports, die in der Projektion
  mit nur +8 bis +15 Zeilen angesetzt waren (**Faktor 10
  unterschätzt**).
- **Beobachtung:** Die Bootstrap-Kette hat eine
  **hohe Cross-Module-Integrations-Tiefe** — sie importiert aus
  `config/paths`, `config/runtime`, `services/persistence-wrappers`,
  `services/auth-session`, `services/sanitizers`, `services/ids`
  plus einige Node-Built-ins (`fs`, `fsSync`, `path`, `crypto`).
  Insgesamt ~40 Symbole aus ~12 Modulen. Diese Symbole waren alle
  in `server/index.js` importiert **ausschließlich für die vier
  extrahierten Funktionen** — kein anderer Code-Pfad konsumierte
  sie. Der Umzug nach `services/storage-init.js` machte sie
  schlagartig alle stale. Dieselbe Dynamik greift nicht bei
  schmalen Extraktionen: eine Funktion mit 3 Cross-Module-Imports
  erzeugt ~3 stale Imports, egal wie groß sie ist.
- **Regel für Bandbreiten-Projektionen:** „Obsolete Imports nach
  Extraktion" verdient **eine eigene Wirkfaktor-Dimension** mit
  separater Bandbreite je nach Integrations-Tiefe der
  extrahierten Funktion:

  | Integrations-Tiefe | Typische Anzahl Cross-Module-Imports | Projektierte stale-Imports-Reduktion |
  |---|---|---:|
  | Schmal | 1-3 Module | +3 bis +10 |
  | Mittel | 4-7 Module | +10 bis +40 |
  | **Breit** | **8+ Module** | **+30 bis +150** |

  Die Cross-Module-Integrations-Tiefe ist vor der Extraktion
  messbar (Grep auf Imports, die ausschließlich von den
  extraktions-Kandidaten genutzt werden), aber erfordert eine
  dedizierte Vorab-Analyse, die bisher in den C3-Projektionen
  implizit blieb.
- **Zusammenwirkung mit Notiz 12 (Service-Extraktion ist
  kalibrierungsstabil):** Die Aussage bleibt gültig — reine
  Service-Extraktion ohne Parameter-Auflösung ist die
  ±5 %-Bandbreite, **wenn** die Integrations-Tiefe korrekt
  eingepreist ist. C3.6 lag bei −2 % Abweichung, weil die
  7 extrahierten Symbole nur ~3 Module als Cross-Imports hatten
  (schmal). C3.7a lag bei −104 Zeilen Unter-Projektion, weil die
  Integrations-Tiefe nicht explizit adressiert war.
  **Konsequenz:** Ab C4/C5/C6 wird die Integrations-Tiefe **als
  expliziter Punkt in der Extraktions-Analyse** adressiert,
  idealerweise mit einem Grep-basierten „orphaned-after-extraction"-
  Check vor dem Commit.
- **Kein Code-Fix.** Methoden-Notiz.

### 15. Dokumentations-Overhead aus Iterations-Historie
- **Fund:** C3.7b-Abschluss (2026-04-22).
- **Symptom:** In iterativen Refactorings über mehr als 5
  Iterationen sammeln sich **pro Iteration 5–15 Zeilen
  Historien-Kommentare** in der zentralen Datei an. Muster:
  ```js
  // extrahiert nach services/X in C3.Y
  // bleibt in C3.Z
  // listXSummaries lebt seit C3.6 in ./services/system-summaries.js
  // (Re-Import weiter unten für die register*Routes-Deps-Entries).
  ```
  Über 7 Iterationen (C3.1–C3.7) summierte sich das in
  `server/index.js` auf **~130 Zeilen** — ein Dokumentations-
  Overhead, der neben dem reinen Code existiert. Beim
  C3.7b-Abschluss-Commit kam daraus ein Überschuss von
  −134 Zeilen gegenüber der Projektion (Projektion: −112 bis
  −140, Ist: −274). Die Notiz-14-Kategorie „obsolete Imports"
  erfasst diesen Effekt **nicht**, weil es sich um
  Kommentar-Zeilen handelt, nicht um Code-Imports.
- **Beobachtung · Wert während der Iterationen:** Die
  Kommentare sind während der Iterationen **wertvoll** — sie
  schützen vor versehentlichem Rückbau ("Ach, diese Funktion
  ist doch gar nicht mehr hier — ich lege sie neu an"),
  machen den Review-Prozess einfacher (explizite Verweise auf
  die neue Location) und dienen als inline-Git-Blame-Zeiger.
  Entfernung während der aktiven Iterations-Phase wäre ein
  Netto-Verlust.
- **Beobachtung · Ballast beim Abschluss:** Sobald der
  Refactoring-Block strukturell abgeschlossen ist, kippt der
  Kompromiss. Die Kommentare beschreiben dann einen Zustand,
  der im Git-Blame und in den Commit-Messages vollständig
  dokumentiert ist. Die zentrale Datei trägt das
  Dokumentations-Gewicht, obwohl es nicht mehr nötig ist.
- **Regel für künftige Refactoring-Blöcke:**
  - **Während der Iterationen:** Kommentare-Accumulation
    erlauben, sie sind aktive Orientierungshilfe.
  - **Beim Block-Abschluss-Commit:** Bewusste
    Kompaktierungs-Entscheidung — entweder auf
    1-Zeilen-Marker reduzieren (z.B. `// State-Routes
    (C3.5)`) oder in einen zentralen JSDoc-Block am Top der
    Datei zusammenfassen. Die ausführliche Geschichte bleibt
    in Git-Blame + Commit-Messages + Meta-Review-Notizen.
  - **Kommunikation:** In der Projektion des Abschluss-
    Commits die Kompaktierungs-Entscheidung explizit als
    Wirkfaktor nennen (+5 bis +15 Zeilen Reduktion pro
    Iteration). Für C3 wären das +35 bis +105 Zeilen
    zusätzliche Reduktion gewesen — nicht weit von den
    beobachteten ~130 Zeilen.
- **Kein Code-Fix im Projekt-Scope** — der C3-Abschluss-
  Commit führt die Kompaktierung für C3 durch. Methoden-Notiz
  für C4/C5/C6.

## Sechzehnte Beobachtung (Entwurfs-Stand)

**Kalibrierungs-Faktor für schema-lastige Erweiterungen
mit verschachtelter Validation.** Landet im nächsten größeren
Block-Abschluss (vermutlich C5.4).

- **Fundstelle:** C5.1 Status-Report, Abschnitt 2 „Heavy-Tail-
  Kalibrierung". Projektion 385–550 LoC (untere / obere
  Bandbreite), gemessen **1.229 LoC** — **+124 % über der
  oberen Bandbreite**.
- **Befund:** Bei Erweiterungen, die gleichzeitig Schema,
  Deep-Validation-Code und Test-Coverage berühren, greift die
  klassische Drei-Punkt-Schätzung (unten / Mittel / oben) zu
  eng. Die obere Bandbreite müsste mit einem **Kalibrierungs-
  Faktor von 1,5×–2,5×** multipliziert werden, um den tat-
  sächlichen Aufwand zu treffen.
- **Drei konkrete Treiber der Über-Schätzung:**
  - **Deep-Validation-Sub-Funktionen (~30 LoC pro Feld):**
    Die C5.1-Analyse unterschätzte den Code-Footprint von
    `validateRiskCatalogTemplate` + `validateResiliencePlan-
    Template` + `validateTabletopScenario`. Jeder Sub-
    Validator hat 20–45 Zeilen (Enum-Check + Pflicht-Feld-
    Check + Range-Check + Nested-Iteration). Für drei
    zusammen ~100 Zeilen allein.
  - **JSON-Schema-`$defs`-Auslagerung für Lesbarkeit
    (+50–80 LoC pro verschachtelter Struktur):** Sechs
    ResiliencePlan-Sub-Sektionen × 5–7 Felder mit klaren
    `required`-Listen und Enums = +180 Zeilen allein für den
    Resilienzplan-Teil. Die Projektion ging von inline-
    Structs aus; die ausgelagerten `$defs` für Lesbarkeit
    kosten aber zusätzlich.
  - **Symmetrie-Self-Check-Tests (1 Test-Anforderung wird
    oft zu 5–7 Test-Implementierungen):** Dr. Steiner bat
    um genau einen Test gegen TS-Type-Drift; umgesetzt als
    **fünf eigene Tests**, weil pro TS-Union-Type ein
    separater Test lesbarer ist und präzisere Fehler-
    meldungen liefert, wenn der Test rot wird. Projektions-
    Unterschätzungs-Faktor: **5×**.
- **Regel für künftige Analysen:**
  - **Bei schema-lastigen Erweiterungen:** Grund-Bandbreite
    schätzen wie bisher, dann **Kalibrierungs-Faktor 1,5×–
    2,5×** auf die obere Grenze aufschlagen als explizite
    Wirkfaktor-Zeile in der Delta-Schätzung. Dr. Steiner
    hat den Faktor in der C5.1-Freigaberunde selbst auf
    **1,5×–2,5×** für schema-lastig und **1,3×–1,5×** für
    UI-lastig beziffert; C5.2 ist der erste Datenpunkt zum
    Verifizieren des UI-Faktors.
  - **Symmetrie-Self-Checks explizit aufzählen:** Wenn
    eine Analyse-Forderung "X schützt gegen Type-Drift"
    lautet, im Test-Plan die Aufschlüsselung pro Union-Type
    vornehmen, nicht als ein Gesamt-Test listen.
  - **Inline vs. `$defs` als Entscheidung formulieren:**
    Bei verschachtelten Strukturen explizit dokumentieren,
    ob Schema inline oder via `$defs` ausgelagert wird —
    der LoC-Unterschied ist signifikant (Faktor 2–3).
- **Datenpunkt zum Verifizieren (C5.2):** Nach Abschluss
  C5.2 den UI-Kalibrierungs-Faktor (Prognose +30–50 %) mit
  der tatsächlichen Zahl vergleichen. Wenn die Zahl passt,
  steht ein belastbares zweites Kalibrierungs-Fenster für
  UI-lastige Arbeit.

## Siebzehnte Beobachtung (Entwurfs-Stand)

**E2E-Tests im Scope einer Feature-Extraktion fangen
Integrations-Bugs, die Unit-Tests nicht sehen.** Landet im
nächsten größeren Block-Abschluss (vermutlich C5.4).

- **Fundstelle:** C5.2-Implementierung, Debug-Runde 4 von 5.
  Der E2E-Test 17 (pack-adoption) zeigte reproduzierbar, dass
  der Master-Adopt-Button zwar enabled wurde und der Klick
  durchlief, der Server-State aber **null** blieb
  (`resiliencePlan: null, riskEntries: [], importedTabletopScenarios: []`).
- **Befund:** Die Helper-Funktion `resolveAdoptableModule` im
  Hook `usePlatformSystemHandlers.ts` suchte das Adopt-Ziel
  nur in **zwei** von **drei** relevanten Daten-Quellen:
  - ✓ `state.uploadedModules` (lokal importierte Pakete)
  - ✗ `ws.moduleRegistryEntries` (serverseitig freigegebene
    Packs — **genau der Pfad, den der Demo-Flow nimmt**)
  - ✓ `builtInModules` (Kerncontainer)
  Das freigegebene Test-Pack landete nach dem
  Release-Klick in der Registry, nicht in den `uploadedModules`
  — `resolveAdoptableModule` returnte `null`, der Handler brach
  still mit einer Info-Notice ab, keine Exception, kein roter
  Log-Eintrag. Der Button wirkte.
- **Warum Unit-Tests das nicht gefangen hätten:** Die Pure
  Functions in `adoptModuleTemplates.ts` (vier Copy-Operatoren
  + `countAdoptableTemplates`) sind isoliert **korrekt** — sie
  bekommen ein Modul-Objekt als Parameter und operieren darauf.
  Der Bug sitzt in der **Vorverarbeitung** (Modul-Lookup), die
  zwischen UI-Klick und Pure-Function-Aufruf liegt. Ein
  Unit-Test der Pure Function hätte das Modul direkt
  hingereicht und wäre grün geblieben. Der Integrations-Pfad
  (Klick → resolveAdoptableModule → adopt*Operator → setState
  → pushStateToServer → Server-State) hat den Fehler
  offengelegt.
- **Warum kein Server-Integrations-Test das gefangen hätte:**
  Die Server-State-Endpoints (83 Tests) prüfen die Server-
  Persistenz und die Sanitizer-Schicht. Der Lookup-Fehler
  sitzt **vor** dem Server-Call — der Server bekam kein
  fehlerhaftes Payload, er bekam **gar kein Payload**, weil der
  Client den Handler früh abbrach. Der Server-Test-Harness
  kann den "Client-hat-gar-nicht-gerufen"-Fall systematisch
  nicht erreichen.
- **Konsequenz für künftige Abschnitts-Implementierungen:**
  - **E2E-Tests für Feature-Flows gehören in denselben Commit
    wie die Feature-Implementierung**, nicht in einen
    separaten Test-Nachzieh-Commit. Die
    Debug-Iteration passiert dann innerhalb der Feature-
    Verifikations-Phase, nicht beim späteren Test-Ausbau —
    das spart einen zweiten Debug-Einstieg ins gleiche Feature.
  - **Ein E2E pro Feature-Flow reicht** (Dr. Steiners
    Formulierung aus der C5.2-Freigaberunde: „ein Test, keine
    breite Matrix"). Der eine Test deckt mehrere
    Integrations-Punkte ab — Permission-Gates, Modul-Lookup,
    Copy-Operator, Server-Sync, Reload-Persistenz — das ist
    genug Coverage-Breite, um Lookup-artige Bugs zu fangen.
  - **Unit-Tests auf Pure Functions bleiben wertvoll, sind
    aber keine Substitution für End-to-End-Flow-Tests.**
    Beide Test-Ebenen haben unterschiedliche Fang-Profile:
    Unit-Tests fangen Logik-Bugs *innerhalb* einer Funktion,
    E2E-Tests fangen Integrations-Bugs *zwischen* Funktionen.
- **Kosten-Analyse für den C5.2-Datenpunkt:**
  - E2E-Test-Entwicklung: ~2,5 Stunden (inkl. 5 Debug-
    Iterationen).
  - Davon Bug-Fang: Iteration 4 (~30 Minuten), die den
    `resolveAdoptableModule`-Fix erzwungen hat.
  - Bug-Finde-Kosten ohne E2E-Test: wahrscheinlich erst in der
    UVM-Demo sichtbar geworden. Peinlich, weil der Demo-Gast
    den stillen No-Op nicht als Bug erkennen könnte — er hätte
    nur gesehen „Klick passiert nichts". Reputations-Kosten:
    **hoch**. Reparatur-Kosten nach Demo: mindestens dieselben
    2,5 Stunden plus Erklärungs-Aufwand.
- **Verallgemeinerbare Regel:** Bei Features, die **mehrere
  Daten-Quellen zusammenführen** (z. B. Lookup-Resolver,
  Merge-Funktionen, Derived-State-Berechnungen), ist der
  E2E-Test überproportional wertvoll — er prüft genau die
  Quellen-Kombination, die Unit-Tests nicht sehen.

## Achtzehnte Beobachtung (Entwurfs-Stand)

**Content-Produktion als eigene Kalibrierungs-Kategorie.**
Landet im C5-Block-Abschluss-Commit nach Energy-Pack und Drehbuch.

- **Fundstelle:** C5.3-Status-Report, Abschnitt 3 "Kalibrierungs-
  Befund · Content-Produktion als neue Kategorie". Gemessene Zeit
  ca. **0,3–0,4** der Punkt-Schätzung (2,5–3 Tage projiziert, ~1
  Claude-Arbeitstag real).
- **Befund:** Bei vorgegebenem Struktur-Skelett (Schema aus C5.1,
  didaktische Muster aus C5.2) skaliert reine Inhalts-Produktion mit
  **Faktor 0,3–0,7** der ursprünglichen Punkt-Schätzung. Gegenüber
  schema-lastiger Arbeit (**+124 %** über Obergrenze, Notiz 16) und
  UI-lastiger Arbeit (**+83 %** über Obergrenze, Notiz 16) ist
  Content-Produktion der **verlässlichste Schätzungs-Boden** der drei
  beobachteten Kategorien.
- **Drei Ursachen der Unterschreitung:**
  - **Strukturelle Entscheidungen sind abgeschlossen.** Das Schema
    steht (C5.1), die Copy-Semantik steht (C5.2), die Tests laufen
    grün. Keine Architektur-Rückfragen bremsen den Durchlauf.
  - **Review-Runden reduzieren Verzweigungs-Freiheit früh.** Dr.
    Steiners Review nach 3.1 hat den Stil und die Tiefe kalibriert;
    3.2 und 3.3 profitierten von dem kalibrierten Stil, ohne dass
    grundsätzliche Richtungs-Entscheidungen nochmal aufkamen.
  - **Content-Tests sind deterministisch.** Kein E2E-Flakiness-Debug
    wie bei C5.2 (5 Debug-Iterationen), keine Test-Flakes (Notiz 4
    Teil B). Vitest-Content-Gates sind stabil, einmal richtig
    formuliert = grün.
- **Regel für künftige Analysen:** Wenn eine Arbeit primär
  Inhalts-Befüllung einer bestehenden Struktur ist, ist die Punkt-
  Schätzung mit **~0,5 zu multiplizieren**, nicht zu addieren. Das
  ist die Umkehrung der Notiz-16-Regel (dort: obere Bandbreite mit
  1,5–2,5 multiplizieren bei schema-lastiger Arbeit).
- **Abgrenzung zu Notiz 16 (schema-lastig) und 17 (UI-lastig):**
  Die drei Kategorien haben deutlich unterschiedliche Risiko-
  Profile. Bei Task-Zerlegung hilft frühe Kategorien-Zuordnung:
  - **Schema-lastig**: Schema-Definitionen, Validator-Code,
    Deep-Validation, JSON-Schema-Auslagerung → Faktor 1,5–2,5×
  - **UI-lastig**: React-Handler, Prop-Durchreichung, UI-Komponenten,
    E2E-Tests mit Permission-Gates → Faktor 1,3–1,5×
  - **Content-lastig**: JSON-Befüllung bestehender Felder, didaktische
    Entscheidungen innerhalb fixierter Strukturen → Faktor 0,3–0,7×
- **Datenpunkt zum Verifizieren (Energy-Pack 3b):** Nach Abschluss
  des zweiten inhaltlichen Pack-Blocks (Energy-Sektor, strukturell
  parallel zu Healthcare) den Faktor 0,3–0,7 bestätigen oder
  anpassen. Erwartung: Energy-Pack wird noch näher an 0,3–0,4
  landen als Healthcare, weil Dr. Steiners Review-Muster jetzt auch
  dort etabliert ist.

## Verweis

Die Meta-Review selbst folgt dem Muster des Abschnitts
„Meta-Review nach C2 · Arbeitsvorlage" in `BLOCK-C.md` (ab Zeile 513).
