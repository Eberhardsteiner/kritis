# Post-C3-Meta-Review-Notizen · Entwurf

> Stand: 2026-04-22, Ende C3.4-Vorspann.
> Diese Datei sammelt Beobachtungen, die während der C3-Phase
> (Zerlegung `server/index.js`) auftauchen, aber nicht im aktuellen
> Commit gelöst werden sollen. Die Meta-Review zu Beginn von **C7**
> (Pilotfreigabe-Dokumentation) arbeitet diese Liste ab.
>
> Format pro Punkt: kurze Benennung, Ort des Fundes, Symptom, geplante
> Auflösung. Die Liste ist eine Arbeitsvorlage — einzelne Punkte können
> in spätere Polish-Commits (nach C3.7) gezogen werden, wenn sie
> mechanisch klein und isoliert sind.

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

### 4. Rate-Limit-Akkumulation in Dev-Sessions
- **Fund:** Debug-Zyklus während C3.2 (E2E-15-Flake).
- **Symptom:** Login-Rate-Limit (12 Versuche / 15 min) und
  API-Rate-Limit (180-300 Requests / 60s) saturieren in
  Debug-Reruns und liefern 429. E2E-Log zeigt "Zu viele Anfragen",
  die Fehlerquelle wird als funktional fehlinterpretiert.
- **Auflösung:** Polish-Commit nach C3.7 — permanentes Env-Var-Setup
  für Dev-/Test-Umgebung (`KRISENFEST_RATE_LIMIT_MAX=5000` etc.)
  in `.env.development` oder npm-Script-Wrapper.

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

### 6. `evidence-platform.js` als Kandidat für `services/`-Verschiebung
- **Fund:** C3.4-Vorspann.
- **Symptom:** `server/evidence-platform.js` liegt im `server/`-Root
  neben `auth-provider.js`, `hardening.js`, `module-packs.js`,
  `regulatory-dach.js`, `object-storage.js`, `security.js` — alles
  pure Logik ohne I/O. Die Foundation-Phase hat `services/` für
  stateful-I/O-Module und `config/` für Konstanten etabliert.
  Pure-Logik-Module haben in dieser Taxonomie keinen klaren
  Heimplatz.
- **Auflösung:** Meta-Review-Entscheidung: entweder (a)
  neue Kategorie `server/lib/` oder `server/domain/` für Pure-Logik
  einführen, oder (b) Pure-Logik-Module explizit im `server/`-Root
  belassen und das als Muster dokumentieren. Kein Blocker für C3.

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

## Verweis

Die Meta-Review selbst folgt dem Muster des Abschnitts
„Meta-Review nach C2 · Arbeitsvorlage" in `BLOCK-C.md` (ab Zeile 513).
