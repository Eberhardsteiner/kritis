# BLOCK-C.md – Wartbarkeit, Tests und Pilotfreigabe

> **Hinweis für Claude Code**: Diese Datei ist die Fortsetzung von `CLAUDE.md` und `BLOCK-B.md`. Die Stilvorgaben aus `CLAUDE.md` Abschnitt 5 und 6 gelten unverändert. Diese Datei ersetzt Abschnitt 3 für die Block-C-Phase.
> **Voraussetzung**: Block B ist vollständig abgeschlossen und auf `origin/main`. Die drei Feature-Module `src/features/resiliencePlan/`, `src/features/riskCatalog/` und `src/features/tabletopExercise/` existieren. Runtime-Dependencies: `docx ^9.6.1`, `zod ^4.3.6` sind installiert.

---

## 1 · Ziel von Block C

Aus dem fachlich vollständigen Prototyp wird eine **wartbare, testgestützte und pilotfähige Codebasis**. C entspricht dem im Übergabeprotokoll vorgesehenen **Produktpaket P4**.

**Was C nicht ist**: Keine neuen Fachinhalte. Keine neuen Regime. Keine neuen Features. Kein neues UI. Wer während C neue Funktionalität einbauen möchte, hat das Paket nicht verstanden – das kommt in einer späteren Produktrunde.

**Ist-Stand zu Beginn von C**:
- `src/App.tsx`: 5.227 Zeilen
- `server/index.js`: 3.906 Zeilen
- Backend-Tests: 38 (37 pass + 1 Windows-EBUSY-Flake in `security.test.js`)
- Frontend-Tests: 352/352 pass in 37 Dateien
- `src/features/`: `resiliencePlan`, `riskCatalog`, `tabletopExercise`
- `server/routes/`: `admin.js`, `auth.js`, `files.js`, `integration.js`, `system.js`, `utils.js`

**Ziel-Stand nach C**:
- `src/App.tsx`: **Zielkorridor 450–860 Zeilen** nach C2.11d. Die ursprüngliche 450–650-Marke war abstrakt gesetzt; nach konkreter C2.11d-Scoping-Analyse und Auftraggeber-Bestätigung wurde die Oberkante pragmatisch erweitert (Dr. Steiner, C2.11d-Freigabe): 860 ist die ehrliche Landezone unter Einhaltung der Regel "keine versteckten Kompositions-Hooks". Die 500-Zeilen-Grenze bleibt als Messlatte für spätere Meta-Review-Entscheidungen erhalten. Enthält nur noch App-Shell (AppProvider, AppShell-Komponente, Context-Reads, Feature-Hook-Kompositions-Zeilen, Prop-Assembly).
- `server/index.js`: unter 400 Zeilen, nur noch Bootstrap, Middleware-Bindung, Routen-Registrierung
- Backend-Tests: mindestens 60
- Frontend-Tests: mindestens 450
- E2E-Tests mit Playwright: mindestens 12 stabile Szenarien
- GitHub Actions CI: vollständig, mit Lint + Typecheck + Unit + E2E + Build als Pflicht-Gates vor Merge
- Express 5 und Vite 7 im Einsatz, React 18 bleibt
- Alle bestehenden JSON-Container-Formate (Branchen, Overlays, Szenarien, Resilienzplan) mit Zod validiert

## 2 · Reihenfolge und Begründung

Die sieben Pakete laufen in dieser Reihenfolge:

1. **C1 · Dependency-Update (moderat)** – Basis stabilisieren, bevor refactored wird
2. **C4a · E2E-Grundgerüst mit Playwright und CI-Pipeline** – Safety Net, bevor Zerlegung beginnt
3. **C2 · Zerlegung `App.tsx` (Feature-Slicing)** – parallel zu C3 möglich, ein Entwickler pro Datei
4. **C3 · Zerlegung `server/index.js`** – nutzt bestehende `server/routes/`-Struktur
5. **C4b · Component-Tests für Feature-Module** – nach der Zerlegung, weil jetzt die Einheiten sauber isoliert sind
6. **C5 · Schema-Validierung flächendeckend** – Zod auf alle JSON-Formate ausrollen
7. **C6 · Supabase-Produktionspfad scharfstellen** – RLS, Migrations-Prüfpfad, Backup-Restore-Drill
8. **C7 · Pilotfreigabe-Dokumentation** – UAT, Release-Notes, Betriebshandbuch, Härtungs-Checkliste

**Wichtige Regel**: C4a (E2E-Grundgerüst) muss vor C2/C3 stehen. Ohne E2E-Safety-Net ist die Zerlegung von 9.000+ Zeilen in neue Struktur ein Blindflug. Das ist die aus der Erfahrung teuerste Abkürzung, deshalb hier gar nicht erst zur Wahl gestellt.

## 3 · Akzeptanzkriterien Block C (Gesamt)

- `src/App.tsx` < 500 Zeilen, ausschließlich App-Shell
- `server/index.js` < 400 Zeilen, ausschließlich Bootstrap
- Alle 352+ Frontend-Tests bleiben grün während jeder einzelnen Paket-Fertigstellung
- Alle bis zu dem Zeitpunkt existierenden Backend-Tests bleiben grün
- E2E-Suite mit mindestens 12 Szenarien läuft reproduzierbar auf CI
- GitHub Actions durchläuft grün bei jedem PR (verbindliches Gate)
- Express 5, Vite 7 in Betrieb – Build und Dev-Server starten ohne Warnung
- Pilot-Durchlauf-Szenario (neuer Mandant → Scope → Risikoanalyse → Resilienzplan → Tabletop → Report-Export) läuft durchgängig und ist als E2E-Test abgebildet
- UVM hat ein UAT-Paket, eine Pilot-Einführungs-Checkliste und ein minimales Betriebshandbuch als Markdown im Repo

---

## C1 · Dependency-Update (moderat)

**Ziel**: Express und Vite auf aktuelle Major-Version. React bleibt auf 18. Zusätzlich: Bekannte npm-audit-Warnungen auflösen, wo im Kernpfad relevant.

**Scope**:
- `express 4.21.2 → 5.x` (aktuelle stable)
- `vite 5.4.21 → 7.x` (aktuelle stable)
- `@vitejs/plugin-react` und `@types/express` entsprechend mitziehen
- `concurrently`, `multer`, `helmet` auf aktuellste Patch-Versionen
- `jspdf` bleibt zunächst (PDF-Renderer-Wechsel ist eigenes Paket)
- **React und react-dom bleiben auf 18.3.1**
- npm-audit-Meldungen im Produktionspfad: beheben. Dev-Only-Meldungen: dokumentieren und ignorieren, wenn kein Remote-Risiko

**Konkrete Migrationsrisiken** (Claude Code muss damit rechnen):

Express 4 → 5:
- Error-Handling-Middleware: die Signatur bleibt, aber async-Handler werfen Fehler jetzt korrekt an das Error-Middleware weiter, ohne dass man `try/catch` um jeden Handler braucht. **Das ändert implizit das Verhalten** – alle bestehenden `try/catch`-Blöcke bleiben funktional, aber redundant. Prüfen, ob es Stellen gibt, die auf das alte Verhalten bauen (z. B. stille Fehler in Handlern).
- `req.body`-Parsing: bei Express 5 muss `express.json()` und `express.urlencoded()` explizit eingebunden sein. In `server/index.js` prüfen.
- Einige Middleware-Pakete haben Express-5-kompatible Versionen – `multer 2.x` ist kompatibel, `helmet 8.x` auch. Sollte laufen.

Vite 5 → 7:
- Node-Version-Anforderung steigt (mindestens Node 20.19 oder 22+). Prüfen, ob CI-Node-Version aktuell genug ist.
- Einige Plugin-APIs haben sich geändert – `@vitejs/plugin-react` auf passende Version mitziehen.
- Build-Output-Pfade bleiben, aber die Dev-Server-Performance verbessert sich deutlich.

**Vorgehen**:
1. Eigener Branch `chore/c1-dependency-update`
2. `npm outdated` als Referenz ausführen und dokumentieren
3. Express 5 zuerst, isoliert. `npm test` grün, `npm run dev` funktioniert, manueller Smoke-Test auf allen bestehenden API-Endpunkten
4. Vite 7 danach, isoliert. `npm run build` erfolgreich, `npm run dev` startet, die App lädt im Browser ohne Konsolenfehler
5. Rest (devDependencies) danach als ein Commit
6. Nach jedem Schritt `npm test` und `npm run build`

**Akzeptanzkriterien C1**:
- `npm test`: Backend 37 + Windows-Flake, Frontend 352/352
- `npm run build`: erfolgreich
- `npm run dev`: startet ohne Warnung, App im Browser lauffähig
- Alle 57 API-Endpunkte per manuellem Smoke-Test (oder einfachem Skript) reagieren wie vorher

**Aufwandsschätzung**: 0,5–1 Sprint. Express 5 ist schnell gemacht, Vite 7 kann im Config-Detail fummeln.

---

## C4a · E2E-Grundgerüst mit Playwright und CI-Pipeline

**Ziel**: Vor der Zerlegung ein belastbares End-to-End-Safety-Net schaffen. Zwölf Szenarien decken die kritischen Nutzerflüsse ab. GitHub Actions läuft als verbindliches Gate.

**Werkzeug**: Playwright (Standard für React+Vite, gute Integration, belastbare Flake-Kontrolle).

**Setup**:
- `@playwright/test` als devDependency installieren
- `playwright.config.ts` im Repo-Root mit sensiblen Defaults: Chrome + Firefox, Screenshot-on-failure, Trace-on-retry, HTML-Report
- Neuer Ordner `e2e/` mit Testfiles
- Neuer npm-Script `test:e2e` in `package.json`
- Fixture-Daten: ein Test-Mandant mit präparierten Seed-Daten, die vor jedem Test geladen werden (über die bestehende Container-Import-Logik)

**Die zwölf Pflicht-Szenarien**:

1. **Anonymer Scope-Flow**: App-Start → KRITIS-Dachgesetz-Scoping ausfüllen → Ergebnis korrekt angezeigt
2. **Mandanten-Login**: Einloggen mit lokalem Konto → Dashboard erscheint → mandantenspezifische Daten sichtbar
3. **Regime-Wechsel DE/AT/CH**: Jurisdiktion umstellen → Anforderungen und Checklisten wechseln korrekt
4. **Requirement-Bearbeitung**: Requirement öffnen → Status ändern → speichern → persistent nach Reload
5. **Evidenz-Upload**: Datei hochladen → erscheint im Register → Download funktioniert → Retention-Status wird angezeigt
6. **Risikoanalyse erstellen (B3)**: Risiko erfassen → in Matrix sichtbar → DOCX-Export erzeugt valide Datei
7. **Resilienzplan generieren (B4)**: Aus Risiken und Maßnahmen Plan erzeugen → DOCX/PDF/JSON-Exporte → Freigabe-Workflow draft → review → approved
8. **Tabletop-Exercise durchspielen (B5)**: Szenario starten → Entscheidungen treffen → Auswertung anzeigen → Evidenz angelegt
9. **Gap-Analyse anzeigen (B6)**: Dashboard öffnen → Restaufwand plausibel → Angebotsgrundlage-Export erzeugt DOCX
10. **Management-Report exportieren**: Report-View → PDF-Export → Datei enthält Regime-Summary, Bußgeldrahmen, Haftungshinweis
11. **Compliance-Kalender**: Registrierungsdatum eintragen → 9- und 10-Monats-Fristen erscheinen korrekt im Kalender
12. **Mandantenisolation**: Mit Mandant A einloggen → abmelden → mit Mandant B einloggen → keine Daten aus A sichtbar

**GitHub Actions CI** (`.github/workflows/ci.yml`, neu):

Jobs:
- `lint`: ESLint, Prettier-Check
- `typecheck`: `tsc -b`
- `unit-backend`: `npm run test:server`
- `unit-frontend`: `npm run test:ui`
- `build`: `npm run build` muss erfolgreich sein
- `e2e`: `npm run test:e2e` gegen den gebauten Build

Trigger: auf `pull_request` gegen `main`, alle Jobs müssen grün sein vor Merge. Branch-Protection-Rule in GitHub aktivieren.

**Umgang mit dem Windows-EBUSY-Flake**:
- Test-Suite in CI läuft auf Ubuntu → Flake tritt dort nicht auf
- Lokal auf Windows bleibt das Verhalten wie dokumentiert in `CLAUDE.md` Abschnitt 8
- Zusätzlich: Retry-Logik in `server/security.test.js` für den Cleanup (drei Versuche mit 200ms Pause) als C1-Begleitfix

**Akzeptanzkriterien C4a**:
- Alle zwölf E2E-Szenarien laufen reproduzierbar grün in drei aufeinanderfolgenden Läufen
- CI-Pipeline durchläuft in unter 10 Minuten
- Ein fehlerhafter PR (z. B. gebrochener Test) wird durch CI geblockt
- README enthält Abschnitt „Tests ausführen" mit den drei Befehlen (`test:server`, `test:ui`, `test:e2e`)

**Aufwandsschätzung**: 1,5 Sprints. Die zwölf Szenarien sind der Zeitfresser, CI-Setup ist in 1–2 Tagen fertig.

---

## C2 · Zerlegung `src/App.tsx` (Feature-Slicing)

**Ziel**: `App.tsx` von 5.227 Zeilen auf unter 500 Zeilen reduzieren. Feature-Slicing-Architektur: jedes Fach-Feature bekommt einen eigenen Ordner unter `src/features/` mit Views, Hooks, Services, Typen und Tests.

**Die Ziel-Struktur** für `src/features/`:

| Feature-Ordner | Inhalt |
|---|---|
| `regulatory/` | Regime-Management (KritisView, Jurisdiktionswechsel, RegimeSummary, Bußgeldrechner, ManagementLiability) |
| `assessment/` | AssessmentView, QuestionCard, ScoreSelector, Scoring-Anbindung – **ohne** ControlView (die zu platform/ gehört) |
| `governance/` | GovernanceView, Stakeholder, Sites, Assets, Roles |
| `evidence/` | Evidence-Management, Retention-Ansicht, EvidenceCard, Upload-Flow |
| `measures/` | MeasuresView, ActionCard, Maßnahmenzuordnung zu Requirements |
| `operations/` | ResilienceView (BIA, Prozesse, Abhängigkeiten, Krisenszenarien, Übungen) – **nicht zu verwechseln mit OperationsView**, die zu platform/ gehört |
| `reporting/` | ReportView, Exporter-Anbindung, Management-Report |
| `programRollout/` | ProgramView, RolloutView, Sprints, Zertifizierungsdossier |
| `platform/` | PlatformView, OperationsView (Hosting/API-Clients/System-Jobs) und ControlView-User-Teile inkl. der 5 User-Handler und UserCard, Tenant-/User-Management, System-Operations |
| `resiliencePlan/` | bleibt unverändert (B4) |
| `riskCatalog/` | bleibt unverändert (B3) |
| `tabletopExercise/` | bleibt unverändert (B5) |
| `gap/` | GapAnalysisDashboard + Logik (B6) |

Plus zwei Nicht-Feature-Ordner:
- `src/shared/` – Komponenten, die von mehreren Features genutzt werden (AppNotice, ProjectTopbar, Sidebar, StatCard)
- `src/app/` – App-Shell, Provider-Bäume, Routing, Top-Level-Layout

**Zerlegungsstrategie (iterativ, nicht Big-Bang)**:

Jede Iteration extrahiert **ein Feature** aus `App.tsx` in sein eigenes Modul, mit folgendem Muster:

1. Feature-Ordner anlegen mit `index.ts` als Public Entry Point
2. Relevante Komponenten, Hooks, Typen aus `App.tsx` und aus `src/views/`, `src/components/`, `src/hooks/` herausziehen
3. Öffentliche API des Features definieren (nur das wird von außen importiert)
4. `App.tsx` importiert nur noch das Feature-Bündel über `import { KritisFeature } from '@/features/regulatory'`
5. **Alle bestehenden Tests müssen grün bleiben** nach der Iteration
6. Ein Commit pro Feature-Extraktion

**Tatsächliche Reihenfolge** (überarbeitet nach Inspektion der Größenverhältnisse bei C2.1; kleine und klar abgegrenzte Features zuerst, damit das Muster sitzt, die großen Querschnitts-Features am Ende):

1. ✅ `gap/` – kleinster möglicher Echt-Refactor, bereits in B6 modular angelegt. Commit `f22d7bfc` (C2.1). Bestätigt, dass Ordnerstruktur, Public-Entry-Point-Muster und Import-Swap funktionieren.
2. ✅ `measures/` (klein-mittel) – Commit `7edc2668` (C2.2).
3. ✅ `governance/` (mittel) – Commit `b98aa08b` (C2.3).
4. ✅ `evidence/` (mittel) – Commit `a2704ae6` (C2.4).
5. ✅ `operations/` (mittel-groß) – Commit `80c8dbf2` (C2.5).
6. ✅ `assessment/` (klein) – C2.6.
7. 🔄 `platform/` – vier Sub-Iterationen C2.7a–d:
   - ✅ C2.7a: Pure-Transforms `serverPayload` + `authCallback`.
   - ✅ C2.7b: Auth-/Session-Handler + PlatformView + User-Sync-useEffect. Commit `49639862`. E2E 15 ergänzt (Commit `189447e6`).
   - ✅ C2.7c: OperationsView (1:1 Umzug, C4b-Kandidat für 6-Panel-Split) + `pushStateToServer` + useEffect #4 (Server-Sync-Push-Loop) + 20 System-Ops-Handler. Fünf Push-Loop-Invarianten als Top-of-File-Kommentar in `usePlatformSystemHandlers.ts`. App.tsx -465 Z.
   - ✅ C2.7d: ControlView + UserCard + 5 User-Handler + `updateComplianceCalendar` (Transient, regulatory-nah) + `inferRoleProfileFromStakeholder`-Pure-Helper. C4b-Kandidat für 2-Panel-Split (UserManagementPanel + ComplianceOverviewPanel). E2E 16 ergänzt. App.tsx -119 Z.
8. ✅ `programRollout/` – ProgramView (171 Z.) + RolloutView (790 Z.) + 13 Handler + 4 Normalizer + `defaultRolloutPlan` als `features/programRollout`-Slice extrahiert. Cross-Feature-Read-Befund: regulatory/KritisView liest **keinen** programRollout-State direkt, C2.9 bleibt entkoppelt. App.tsx -428 Z. Commit C2.8.
9. ✅ `regulatory/` – 11 Handler (3 Profil + 3 Certification/Checklist + 4 Findings + 1 Compliance-Kalender) sowie ein Pure-Helper fuer die Evidence-Delete-Kaskade als `features/regulatory`-Slice extrahiert (C2.9). Begleitet von der Extraktion von 4 Risk-Handlern nach `features/riskCatalog/hooks/useRiskCatalogHandlers.ts` im selben Commit. `updateComplianceCalendar`-Transient aus C2.7d ist **Option B** umgesetzt: Handler regulatory-intern, Panel bleibt visuell in ControlView. KritisView verbleibt in `src/views/` bis C4b — bewusste Ausnahme, in features/regulatory/index.ts und im Meta-Review-Eintrag dokumentiert. App.tsx -200 Z.
10. ✅ `reporting/` – 4 Export-Handler (Management-Report Markdown/PDF, Formaler Audit-Bericht HTML, Audit-Pack PDF) als `features/reporting/hooks/useReportingHandlers` extrahiert (C2.10). `lib/exporters.ts` bleibt in lib/ (Multi-Consumer: App.tsx + buildActiveViewPanelProps), ReportView bleibt in `src/views/` bis C4b (Querschnittsdaten aus fast allen Features, Panel-Split gehört in C4b). Reporting ist das **read-only**-Feature: setState und runWithPermission aus FeatureHandlerDependencies werden nicht genutzt, der Permission-Gate läuft über `hasPermission('reports_export')`. App.tsx -60 Z. Architektur-Erkenntnis für C2.11 (useAppDerivedState als Context-Provider) in docs/state-access-map.md verankert.
11. ✅ App-Shell `src/app/`: in vier Sub-Iterationen aufgeteilt (C2.11a–d). Zielkorridor siehe Abschnitt „Ziel-Stand nach C" (450–860 Zeilen):
    - ✅ **C2.11a**: Drei vergessene B-Feature-Extraktionen — `resiliencePlan/hooks/useResiliencePlanHandlers` (9 Handler) + `tabletopExercise/hooks/useTabletopExerciseHandlers` (12 Handler + Pure-Helper `resolveActiveScenario`) + `gap/hooks/useGapHandlers` (1 Handler). Plus `src/shared/download.ts` (Konsolidierung der Inline-Duplicate-Download-Logik). Neue Public-APIs für resiliencePlan und tabletopExercise, gap-API erweitert. Erste Cross-Feature-Hook-Kopplung (tabletop → evidence via `upsertEvidenceDrafts`). App.tsx -346 Z.
    - ✅ **C2.11b**: State-Hydration-Layer extrahiert. 17 Module-Level-Artefakte verlagert (`buildAppStateFromLoaded`, `createInitialState`, `applyRemoteState` + 4 Defaults nach `src/app/state/`; Feature-spezifische Normalizer in Feature-Heimat: `normalizeLoadedUsers`+`normalizeUserRoleProfile`+`normalizeUserStatus` nach `features/platform/userNormalization`, `normalizeCertificationState`+`normalizeComplianceCalendar`+`normalizeLoadedFindings` nach `features/regulatory/`; `isApiStatus` nach `src/shared/httpError.ts`). **3 Dead-Code-Items gelöscht** (repository-wide grep verifiziert): `defaultReviewPlan` + `createDefaultCertificationState` (Dead Code), `normalizeLoadedRegulatoryProfile`-Wrapper (Dead Indirection). Dep-Durchgriff-Reduktion in `usePlatformControlHandlers`, `usePlatformAuthHandlers`, `usePlatformSystemHandlers`. App.tsx -319 Z.
    - ✅ **C2.11c**: Server-Sync-Layer extrahiert. `useServerSync` in `src/app/serverSync/` bündelt `loadStateFromServer` (142 Z.), `refreshServerSideData` (103 Z.), `fetchAdminServerDetails` (internal), `refreshModuleRegistry`, `updateServerStateMarkers`. 37-Feld-Dep-Interface dokumentiert die Realität der Setter-Kopplung — C2.11d wird via Context ~70 % davon eliminieren. Die drei Shell-Effects (Bootstrap, Notice-Timer, LocalStorage-Persistenz) leben in `src/app/effects/useAppShellEffects.ts`. Der vierte Effect (Module-Selection-Guard) wohnt bewusst separat in `src/app/effects/useModuleSelectionGuard.ts`, weil fachlich modules-nah (Kandidat für einen späteren Umzug ins `features/modules/`-Feature). Cycle-Breaker via `clearAuthenticatedContextRef`: Ref in App.tsx, gewired per useEffect nach `usePlatformAuthHandlers`-Return. Alle fünf Server-Sync-Push-Loop-Invarianten-Stellen (3 Hydration-Stellen in loadStateFromServer, 2 401-Branches in loadStateFromServer + refreshServerSideData) byte-identisch übernommen mit Inline-Invarianten-Kommentaren. Top-of-File-Block in `useServerSync.ts` verweist auf `usePlatformSystemHandlers.ts` als zweiten Invarianten-Ort — beide zusammen zu betrachten. Fokus-E2E: E2E 15 3× in Folge + E2E 14 isoliert, alle grün. App.tsx -248 Z.
    - ✅ **C2.11d**: Context-Provider-Layer + Feature-Hook-Dep-Reduktion. Zwei Contexts (`WorkspaceStateContext` für State/Setter/Refs/Helpers/authenticated-User-Ableitungen, `AppDerivedStateContext` für `useAppDerivedState`-Return) in `src/app/context/`. `AppProvider` in `src/app/AppProvider.tsx` orchestriert 37 useState-Calls, drei Refs, vier Helpers und die Derived-State-Berechnung. Cycle-Breaker strukturell aufgelöst: der frühere `clearAuthenticatedContextRef` + wire-up-useEffect aus C2.11c ist durch den Pure-Helper `src/features/platform/clearAuthenticatedContext.ts` ersetzt — useServerSync und usePlatformAuthHandlers rufen den Helper jeweils direkt auf. Alle 15 Feature-Hooks migriert: Dep-Interfaces auf 0–2 Cross-Hook-Felder reduziert, State und Derived kommen aus Context. Begleit-Extraktion `buildServerExportPackagePayload` + `getExportTypeLabel` nach `src/features/platform/serverExportPayload.ts` (~180 Zeilen). Invariante 3 in `useServerSync.ts` + `usePlatformSystemHandlers.ts` auf die Kernaussage gekürzt ("ruft clearAuthenticatedContext direkt auf, nicht über Ref-Indirection"); die anderen vier Invarianten bleiben byte-identisch. App.tsx landet bei **665 Zeilen** (–813 ggü. C2.11c, innerhalb des 450–860-Korridors).

> **Hinweis zur ursprünglichen Plan-Reihenfolge**: `BLOCK-C.md` hat ursprünglich `platform/` als erste Extraktion empfohlen – auf Basis einer zu optimistischen Größenannahme. Tatsächliche Inspektion durch Claude Code bei C2.1 ergab: Platform ist mit 1.082 Zeilen in `PlatformView.tsx` plus 24 useState-Hooks und 15 Handlern in `App.tsx` eines der großen Features. Die Reihenfolge wurde entsprechend korrigiert.

**Routing**: Ab der dritten bis vierten Iteration wird ein echter Router (React Router v6 mit Data-API) eingeführt. Vorher reicht die bestehende State-basierte View-Umschaltung.

**State-Management**: Der bestehende Workspace-Context wird in `src/app/contexts/` gezogen und bleibt erhalten. Kein Umstieg auf Redux, Zustand o. ä. – das ist nicht Teil von C.

**Rollback-Strategie**: Jede Iteration ist ein eigener Commit und damit einzeln revertierbar. Wenn eine Extraktion in größere Probleme läuft, wird sie revertet und neu geplant.

**Akzeptanzkriterien C2**:
- `src/App.tsx` im **Zielkorridor 450–860 Zeilen** nach C2.11d (s. Abschnitt „Ziel-Stand nach C"); Endwert nach C2.11d: 665 Zeilen
- Keine Feature-Datei importiert direkt aus einem anderen Feature (nur über `shared/` oder Feature-Public-API)
- Alle 352+ Frontend-Tests grün
- Alle 12 E2E-Szenarien grün
- Build-Output-Größe nicht größer als vor C2 (±10 % Toleranz)

**Aufwandsschätzung**: 3 Sprints. Das ist das größte Paket in C. Planung: eine Feature-Extraktion pro 2–3 Arbeitstage.

### C2 · Abschluss-Vermerk

**Status**: ✅ abgeschlossen. **Messdatum**: 2026-04-21 (C2.11d-Commit `43ed4a4c`).

| Kennzahl | Vor C2 | Nach C2 | Delta |
|---|---:|---:|---:|
| `src/App.tsx` | 5.227 | 665 | −4.562 (−87,3 %) |
| Feature-Slices unter `src/features/` | 0 neu extrahiert | **elf** extrahiert (gap, measures, governance, evidence, operations, assessment, platform, programRollout, regulatory, riskCatalog, reporting) + zwei aus B fortgeführt und mit Handler-Hook vervollständigt (resiliencePlan, tabletopExercise) | — |
| Contexts | 0 | **zwei** (`WorkspaceStateContext`, `AppDerivedStateContext`) | +2 |
| Cycle-Breaker | Ref + wire-up-useEffect (C2.11c-Pragma) | strukturell aufgelöst über Pure-Helper `clearAuthenticatedContext` | — |
| Frontend-Tests | 352 grün | 359 grün | +7 |
| E2E-Szenarien | 12 Pflicht-Szenarien vorgesehen | 16 implementiert, 16/16 grün (Chromium 2× in Folge) | +4 |

**Strukturelle Ergebnisse über C2.1–C2.11d**:
- `src/app/`-Ebene: `state/` (Hydration-Layer), `serverSync/` (useServerSync), `effects/` (useAppShellEffects + useModuleSelectionGuard), `context/` (WorkspaceStateContext + AppDerivedStateContext), `AppProvider.tsx`.
- `src/features/`-Ebene: 13 Feature-Slices mit Public-API-Grenzen (`index.ts`), keine Feature-zu-Feature-Direkt-Imports (die einzige dokumentierte Ausnahme `measures` → `evidence/EvidenceCard` läuft über Public-API).
- Fünf Server-Sync-Push-Loop-Invarianten dokumentiert und konsistent in `useServerSync.ts` + `usePlatformSystemHandlers.ts`.

**Offene Punkte für die Meta-Review**: siehe Abschnitt „Meta-Review nach C2 · Arbeitsvorlage" am Ende dieses Dokuments. Die Meta-Review wird **nicht sofort** durchgeführt, sondern bewusst auf den Beginn von **C7** (Pilotfreigabe-Dokumentation) verschoben — für einen frischen Blick nach einer Distanz-Phase und zur Kopplung mit der Release-Notes-Durchsicht.

---

## C3 · Zerlegung `server/index.js`

**Ziel**: `server/index.js` von 3.906 Zeilen auf unter 400 Zeilen. Die Ziel-Struktur nutzt die bestehende `server/routes/`-Organisation und ergänzt sie.

**Bestehende Route-Module** (werden erweitert und aktiv eingebunden):
- `admin.js`, `auth.js`, `files.js`, `integration.js`, `system.js`, `utils.js`

**Zu ergänzende Route-Module**:
- `tenants.js` – Mandanten-Verwaltung (Tenant-Settings plus Admin-Overlap)
- `evidence.js` – Evidenzen, Retention, Upload/Download
- `reporting.js` – Report-Exports, Management-Report (Export-Register)
- `modules.js` – Container-Pack-Registry, Overlay-Management
- `state.js` – Tenant-State-Sync, Audit-Log, Snapshots

> **Plan-Korrektur (C3.0a-Freigabe)**: Die ursprünglich gelisteten Module `regulatory.js` und `assessments.js` sind gestrichen — diese Domänen haben keine dedizierten HTTP-Endpunkte. Regulatorik-Daten fließen über `/api/state` als Payload; die Regulatorik-Logik wohnt bereits in `server/regulatory-dach.js`. Assessments fließen ebenfalls über `/api/state` und die State-Sanitize-Kette. Kein Code-Move nötig.

**Zerlegungsstrategie**:

Analog zu C2 iterativ, eine Domäne pro Iteration. Jede Iteration:
1. Endpunkt-Gruppe identifizieren (z. B. alle Routen, die `/api/tenants/*` behandeln)
2. Route-Handler und zugehörige Service-Logik in neues Route-Modul extrahieren
3. In `server/index.js` durch `app.use('/api/tenants', tenantsRouter)` ersetzen
4. Bestehende Tests grün halten, ggf. neue Tests für das Route-Modul

**Service-Layer**: Wenn pro Domäne mehr als reine Routen-Logik extrahiert wird (DB-Zugriff, Business-Logik, Sanitizer), entsteht ein paralleler `server/services/`-Ordner. Faustregel: wenn eine Route-Handler-Funktion mehr als 50 Zeilen hat, wird die Business-Logik in einen Service ausgelagert. Zusätzlich entsteht `server/config/` für runtime-immutable Referenzdaten — drei Kategorien: `paths.js` (Pfad-Konstanten), `defaults.js` (statische Default-Objekte + Konstanten-Gruppen), `runtime.js` (runtime-derived Werte wie `runtimeConfig`, `authStrategy`, `defaultPlatformSettings`, `GUEST_*`). Die dritte Kategorie (runtime.js) ist in C3.0c hinzugekommen — ursprünglich im C3-Scoping-Plan nicht vorgesehen, als Alternative zum Factory-Pattern eingeführt, wenn Closure-Abhängigkeiten auf mehr als 2–3 Funktionen treffen.

**Tatsächliche Reihenfolge** (10 Sub-Iterationen, nach der C3.0a-Scoping-Analyse präzisiert; Foundation-Phase in drei Commits, weil die gemessene Foundation-Größe deutlich über der ursprünglichen C3-Scoping-Schätzung lag):

1. ✅ **C3.0a · Service-Foundation I** — Pure Helpers + Defaults + Paths. Neu: `config/paths.js` (18 Path-Konstanten), `config/defaults.js` (7 Default-/Konstanten-Blöcke plus OIDC-Provider-ID), `services/ids.js` (nowIso, createId, slugify, maskSecret, createApiClientSecret, httpError), `services/sanitizers.js` (~25 Pure-Funktionen inklusive sanitize*, normalize*, seed-Factories, stableEqual, detectChangedSections). Einziger Signatur-Change: `sanitizePlatformSettings(value, defaults)` nimmt runtime-abhängige Defaults explizit als zweiten Param. Commit `f6e5ec3e`. App-Server-Delta: `server/index.js` 3.906 → 3.439 Zeilen.
2. ✅ **C3.0b · Service-Foundation II** — Persistence-Wrappers: alle typisierten JSON-I/O-Fassaden (~32 Funktionen: readTenants, writeTenants, readState, writeState, readAuditLog, appendAuditLog, readVersions, readTenantSettings, readModulePackRegistry, readExportLog etc.) plus tenantPaths + ensureTenantStorage + Singleton-Fassade (getPersistenceLayer, getObjectStorage). `buildStateEnvelope` bleibt bewusst in `server/index.js` bis C3.4 (evidence-aware Ableitung). Sechs Persistenz-/Auth-/Upload-Limits (`MAX_AUDIT_ENTRIES`, `SNAPSHOT_LIMIT`, `MAX_JSON_SIZE`, `SESSION_HOURS`, `PASSWORD_ITERATIONS`, `MAX_UPLOAD_BYTES`) in drei thematischen Blöcken nach `config/defaults.js`. Sanitize-on-Write-Invariante byte-identisch bewahrt. Commit `0df911a7`. App-Server-Delta: 3.439 → 3.091 Zeilen (−348).
3. ✅ **C3.0c · Service-Foundation III** — Auth-Session-Service: ~30 Funktionen (getAuthContext, assertPermissions, ensureSystemAdmin, createServerSession, presentSession, cleanupExpiredSessions/AuthFlows/AuthCallbackTickets, resolveOidcLoginContext, buildAnonymousContext, hashPassword/verifyPassword/createSessionToken/plusHours, ensureWorkspaceUser, buildSuccessfulAuthResponse, consumeAuthCallbackTicket, extractAuthToken, findAccountByIdentity, upsertExternalIdentity, resolveMembershipForAccount, buildAutoCreatedMembership, buildWorkspaceUserSeedFromContext, getApiClientContext, assertApiClientScopes, getPublicTenant, buildAnonymousAccount/Membership, resolveOidcTargetTenant, ensureOidcCapableAccount, resolveOidcAccount, findActiveTenant). **Neue siebte Foundation-Datei `config/runtime.js`** mit acht runtime-derived Exports (`runtimeConfig`, `authStrategy`, `AUTHENTICATION_REQUIRED`, `ANONYMOUS_ACCESS_ENABLED`, `GUEST_ACCOUNT_ID`, `GUEST_USER_ID`, `DEFAULT_DEMO_PASSWORD`, `defaultPlatformSettings`). Acht Funktionen mit runtime-derived Closure-Abhängigkeiten (5× `authStrategy`, 3× `runtimeConfig`) werden durch direkte Imports aus `config/runtime.js` bedient — **null Parameter-Erweiterung** bei dieser Klasse. Nur zwei Funktionen (`buildSuccessfulAuthResponse`, `consumeAuthCallbackTicket`) bekommen `buildStateEnvelope` als expliziten Parameter, der in C3.4 rückwärts aufgelöst wird. Security-Invarianten-Block am Dateikopf von `auth-session.js` dokumentiert PBKDF2-Iterations + sync-Variante-Wahl + `crypto.timingSafeEqual`-Pflicht. Commit `<TBD>`. App-Server-Delta: 3.091 → ~2.540 Zeilen (−553).
4. **C3.1 · routes/modules.js + services/module-packs-extended.js** — 4 Endpoints (/api/modules/registry/*).
5. **C3.2 · routes/reporting.js + services/exports.js** — 4 Endpoints (/api/exports/*).
6. **C3.3 · routes/tenant-settings.js** — 2 Endpoints (/api/tenant-settings).
7. **C3.4 · routes/evidence.js + services/evidence.js** — 6 Endpoints (/api/evidence/*, /api/document-ledger/summary, /api/evidence-retention/summary). Vorab-Commit: `test(server): add integration tests for evidence endpoints` (3–5 supertest-Tests gegen monolithischen Ist-Stand, als Safety-Net).
8. **C3.5 · routes/state.js + services/snapshots.js** — 5 Endpoints (/api/state GET/PUT, /api/audit-log, /api/snapshots GET/POST/restore). Vorab-Commit: `test(server): add integration tests for state endpoints`.
9. **C3.6 · Service-Residuen** — tenants-service, system-summaries, storage-init, plus `runSystemJob` (~200-Zeilen-Switch-Funktion; eigener Risikopunkt, weil die Switch-Arms quer durch fast alle Domänen dispatchen: tenant_backup, integrity_scan, export_inventory, restore_drill, retention_review).
10. **C3.7 · Endreduktion `server/index.js`** — Imports konsolidieren, Konstanten-Reste aufräumen, Ziel <400 Zeilen.

**Express-5-Vorteile nutzen**:
- Async-Handler direkt, ohne manuelle `next(err)`-Weiterleitung
- Zentrale Error-Middleware am Ende von `server/index.js`
- Konsistente Fehlerantworten über ein `errorResponse`-Helper

**Akzeptanzkriterien C3**:
- `server/index.js` unter 400 Zeilen
- Jedes Route-Modul hat eine eigene Testdatei
- Alle 38+ Backend-Tests grün
- Backend-Tests erweitert auf mindestens 60 durch die Route-Modul-Tests und die Vorab-Integration-Tests (C3.4, C3.5)
- Alle 16 E2E-Szenarien grün (Chromium)

**Aufwandsschätzung**: 2,5 Sprints. Kann parallel zu C2 laufen, ist weniger verzahnt.

---

### C3-Abschluss · Nachtrag (2026-04-22)

C3 ist strukturell durch. **Kumulative Reduktion `server/index.js`: 3.906 → 76 Zeilen (−98 %)**, weit unter der <400-Zielmarke. 12 Commits über die Sub-Iterationen C3.0a/b/c, C3.1–C3.6, C3.6-Polish, C3.7a/b und Abschluss.

**Korrigierte Akzeptanzkriterien:**

- ✅ `server/index.js` **76 Zeilen** nach Block-Abschluss (Ziel <400 überschritten)
- ✅ Jedes Route-Modul hat Null-Deps-Muster; Integration-Tests für die drei risikoreichsten Route-Module (evidence C3.4, state C3.5, system-jobs C3.6) plus Unit-Test für `buildHostingReadinessSummary`-Check-IDs
- ✅ Backend-Tests: **58/58 grün** (38 Baseline + 18 Integration-Einheiten + 2 Unit-Tests). Die ursprüngliche Zielmarke „mindestens 60" wurde auf **tatsächlich 58** korrigiert (siehe `docs/POST-C3-META-REVIEW-NOTIZEN.md` Notiz 10). Die Abweichung ist marginal (3 Tests) und proportional zum Risiko-Profil der Iterationen: niedrig-Risiko-Extraktionen (C3.1–C3.3, C3.7) brauchten keinen Vorspann, weil die bestehende Unit-Test-Suite das Verhalten der zugrundeliegenden Services abdeckt. Die Sub-Test-Zählung von `node:test` zählt jede `t.test()`-Klausel einzeln — das C3.6-Vorspann-Pattern (Variante C) liefert 8 Test-Einheiten aus einem Top-Level-Test mit 3 Sub-Tests.
- E2E: 16 Chromium-Szenarien werden außerhalb dieses Block-Abschlusses im nächsten Schritt (C4a-Rerun) validiert — C3 ändert keine Endpoint-Signaturen.

**Meta-Review-Vorlage:** `docs/POST-C3-META-REVIEW-NOTIZEN.md` konsolidiert 15 Beobachtungen aus C3.1–C3.7. Die Meta-Review zu Beginn von **C7** (Pilotfreigabe-Dokumentation) arbeitet diese Liste ab. Enthält Methoden-Notizen (Heavy-Tail-Kalibrierung, ESM-Singleton-Pattern, byte-identische Extraktions-Praxis, Seed-Design-Regel), Architektur-Kandidaten (Pure-Logik-Heimat-Kategorie, Zwei-Phasen-Commit-Muster) und Infrastruktur-Nachträge (SQLite-Race bei parallelen Integration-Tests, Rate-Limit-Akkumulation in Dev-Sessions).

**Strukturelle Architektur-Lieferung (nicht nur LoC):**
- `server/services/` · 13 Module (ids, sanitizers, persistence-wrappers, auth-session, evidence, state, exports, module-pack-registry, file-utils, jobs, system-summaries, storage-init, middleware-setup, observability)
- `server/routes/` · 10 Module (alle mit Null-Deps-Muster: admin, auth, evidence, files, integration, modules, reporting, state, system, tenant-settings)
- `server/config/` · 3 Module (paths, defaults, runtime)
- `server/index.js` · 76 Zeilen reiner Orchestrator (Express-App-Create → attachMiddleware → 10× registerRoutes → attachErrorHandler → initializeStorage → listen)

---

## C4b · Component-Tests für Feature-Module

**Ziel**: Nach der Zerlegung bekommen die neuen Feature-Module dedizierte Component-Tests. Fokus auf die komplexeren, in B entstandenen Bausteine.

**Werkzeug**: Vitest + React Testing Library (ist bereits im Projekt).

**Priorisierte Component-Tests**:

1. **Gap-Analyse-Dashboard** (`features/gap/components/GapAnalysisDashboard.test.tsx`):
   - Restaufwand-Berechnung bei verschiedenen Reifegrad-Zuständen
   - Mapping-Einfluss (ISO 27001 reduziert Aufwand)
   - Reaktion auf Status-Änderung eines einzelnen Requirements

2. **Resilienzplan-Editor** (`features/resiliencePlan/views/ResiliencePlanEditor.test.tsx`):
   - Abschnitts-Navigation
   - Validierung gegen § 13-Pflichtabschnitte
   - Freigabe-Workflow-Übergänge

3. **Risikomatrix** (`features/riskCatalog/views/RiskMatrixView.test.tsx`):
   - Korrekte Einordnung eines Risikos in 5×5-Matrix
   - Restrisiko-Berechnung nach Maßnahmen-Zuordnung
   - Drill-down-Verhalten

4. **Tabletop-Session** (`features/tabletopExercise/views/ExerciseSession.test.tsx`):
   - Timer-Logik
   - Entscheidungs-Konsequenzen in späteren Injects
   - Auswertung gegen `evaluationCriteria`

5. **Bußgeldrechner** (`features/regulatory/components/PenaltyExposureCard.test.tsx`):
   - Korrekte Obergrenze bei verschiedenen Kombinationen offener Pflichten
   - Update bei Änderung des Requirement-Status

6. **Behörden-Auflösung** (`features/regulatory/lib/authorities.test.ts`):
   - Für alle 10 Sektoren × 2 DE-Regime mindestens eine Behörde
   - Korrekte Sonderbehandlung Finanzsektor (BaFin + DORA-Hinweis)
   - Länderbehörden bei Landesaufsicht

**C4b-Kandidaten aus dem Extraktionsfluss**:
- **ResilienceView → 4 Panels splitten** (BusinessProcessPanel, DependencyPanel, ScenarioPanel, ExercisePanel) mit Tests pro Panel (aus C2.5).
- **handleDeleteEvidence-Seiteneffekt auf `auditFindings.relatedEvidenceIds`** auf Unit-Ebene (aus C2.4 Phase 3, nicht E2E-sichtbar).

**Akzeptanzkriterien C4b**:
- Mindestens 100 zusätzliche Frontend-Tests
- Gesamtstand Frontend-Tests ≥ 450
- Alle neuen Tests laufen in unter 15 Sekunden

**Aufwandsschätzung**: 1,5 Sprints.

---

## C5 · Schema-Validierung flächendeckend

**Ziel**: Alle JSON-Container-Formate (Branchenmodule, Overlays, Szenarien, Resilienzpläne, Risikoanalyse-Exports) werden mit Zod validiert. Das verhindert, dass fehlerhafte JSON-Dateien die App in einen inkonsistenten Zustand bringen.

**C5.1 · Bestehende Container-Formate**:
- Branchenmodule (`src/data/builtInModulePacks.ts` + dynamisch importierte)
- Overlay-Templates (`docs/custom-overlay-template*.json`)
- Module-Payload-Schema (`docs/module-schema.json`)

Zu jedem Format:
- Zod-Schema in `src/schemas/` definieren
- JSON-Schema-Datei in `docs/schemas/` für externe Nutzer generieren (aus Zod)
- Validierung beim Import/Upload hart (fehlgeschlagene Validierung = Abweisung mit sprechender Fehlermeldung)
- Backend-Validierung in `server/services/moduleValidation.js`

**C5.2 · Mini-Migration `EvidenceItem.sourceType`**:

Wie im Ist-Stand von Block B notiert, nutzen Tabletop-Exercise-Evidenzen aktuell `sourceType: 'manual'`. In C5.2:
- Typ `EvidenceSourceType` erweitern um `'tabletop_exercise'`
- Migration: bestehende Evidenzen mit `sourceLabel` beginnend mit „Tabletop-Übung" werden beim Laden auf den neuen sourceType aktualisiert
- Dedup-Logik und Filter in Evidence-Register darauf vorbereiten
- Tests für Migration und Filter

**Akzeptanzkriterien C5**:
- Ein fehlerhafter Modul-Import wird mit sprechender Fehlermeldung abgewiesen, App bleibt stabil
- Alle drei Tabletop-Pflicht-Szenarien validieren gegen ihr Zod-Schema
- Evidence-Filter „Nur Tabletop-Übungen" funktioniert
- Dokumentation in `docs/schemas/README.md` zu Versionierung und Erweiterung der Schemas

**Aufwandsschätzung**: 1 Sprint.

---

## C6 · Supabase-Produktionspfad scharfstellen

**Ziel**: Supabase als echte Produktionspersistenz verdrahten, nicht nur vorbereitet. Mandantenisolation hart gegen böse Wille absichern.

**Scope**:
- **RLS-Policies** (Row Level Security) für alle Tabellen aus `docs/supabase-schema.sql`: kein Zugriff auf fremde Mandanten-Daten, auch nicht bei kompromittierten Service-Keys
- **Storage-RLS** analog für Evidenz-Objekte
- **Migrations-Prüfpfad**: `server-storage/system/` → Supabase-Migration dokumentiert und reproduzierbar
- **Backup-Restore-Drill**: ein Skript, das einen Mandanten exportiert, löscht und wiederherstellt – als Test im CI
- **Umgebungsprofile**: klare Trennung `development`, `staging`, `production` mit je eigenen Supabase-Projekten
- **Secret-Management**: Keys nicht im Repo, sondern über `.env.local` lokal und GitHub Secrets in CI

**Offene Eingabe aus dem Extraktionsfluss** (siehe `docs/open-decisions.md`):
- Demo-Mode-Sync-Verhalten schreibt ohne Auth-Gate — Reload überschreibt lokalen State mit Server-Leerstand (Beobachtungen aus C2.3 Phase 3 und C2.5 Fixture-Fix). In C6 auf Read-Only-Anonym umstellen, E2E-State per Staging-Projekt isolieren.

**Akzeptanzkriterien C6**:
- Staging-Umgebung läuft gegen eigenes Supabase-Projekt
- E2E-Tests laufen gegen Staging-Supabase (statt lokaler SQLite)
- RLS verhindert Mandanten-Datenzugriff nachweisbar in einem dedizierten Test
- Backup-Restore-Drill läuft automatisiert

**Aufwandsschätzung**: 1,5–2 Sprints. Abhängig davon, wie viel Policy-Arbeit vorher schon gemacht wurde.

---

## C7 · Pilotfreigabe-Dokumentation

**Ziel**: Ohne diese Dokumente gibt es keinen Pilotbetrieb. C7 ist reines Schreiben, aber notwendig.

**Artefakte**:

1. **`docs/PILOT-CHECKLISTE.md`** – von UVM auszufüllen vor Pilotstart (technische Vorbereitungen, Datenimport, Schulung, Go-Live-Kriterien)
2. **`docs/UAT-PAKET.md`** – Testszenarien, die der Pilotkunde zur Abnahme durchläuft (12 Szenarien analog zu den E2E-Tests, in Geschäftssprache)
3. **`docs/BETRIEBSHANDBUCH.md`** – Minimalversion: Installation, Konfiguration, Backup/Restore, Incident-Response (KRITIS-DachG-Kontext: die App muss selbst nicht 24/7 verfügbar sein, aber die Daten dürfen nicht verloren gehen)
4. **`docs/HAERTUNGS-CHECKLISTE.md`** – Sicherheitshärtung für Pilotkunden: HTTPS, Secret-Rotation, Logging-Aufbewahrung, RLS-Verifikation
5. **`docs/RELEASE-NOTES-v3.0.md`** – Release Notes für die Pilot-Version, klar getrennt nach „Neu in C", „Aus B übernommen", „Aus A übernommen"
6. **`README.md`** – Aktualisierung der Haupt-README auf Pilot-Stand, mit klaren Hinweisen für UVM-Berater und Pilotkunden

**Akzeptanzkriterien C7**:
- Alle sechs Artefakte im Repo
- UVM kann mit den Dokumenten eigenständig einen Pilotkunden einführen
- Die Release-Notes enthalten alle Paragraphen-Referenzen und Fristen korrekt (Querprüfung gegen `CLAUDE.md` Abschnitt 2)

**Aufwandsschätzung**: 1 Sprint.

---

## 4 · Prüfpfad nach jedem Paket

```bash
npm test
npm run test:e2e
npm run build
node --check server/index.js
```

Zusätzlich pro Paket:

| Paket | Spezifischer Check |
|---|---|
| C1 | Alle 57 API-Endpunkte per Smoke-Test reagieren wie vor Update |
| C4a | Alle 12 E2E-Szenarien 3× grün in Folge |
| C2 | Build-Output-Größe ±10 % gegenüber Vor-C2-Stand |
| C3 | `server/index.js` < 400 Zeilen, jede Route in eigenem Modul |
| C4b | Frontend-Tests ≥ 450 |
| C5 | Ein absichtlich kaputtes JSON-Modul wird abgewiesen |
| C6 | Mandanten-Isolationstest in Staging-Supabase grün |
| C7 | Alle sechs Dokumentations-Artefakte im Repo |

## 5 · Stil- und Qualitätsvorgaben

Gelten aus `CLAUDE.md` Abschnitt 5 unverändert weiter. Ergänzungen für C:

- **Kein neues Feature**: wenn Claude Code beim Refactoring merkt, dass etwas „man ja auch schöner machen könnte" – nein, das ist Produktinhalt, nicht C.
- **Ein Commit pro Zerlegungsschritt**: Commit-Message im Format `C2.3: Extract evidence feature from App.tsx` – damit Rollbacks einzeln möglich sind.
- **Test-Safety-Net vor jeder Zerlegung**: wenn ein Feature extrahiert wird, vorher prüfen, dass alle Tests grün sind. Nach Extraktion: prüfen, dass sie immer noch grün sind. Wenn nicht: rollback, Problem verstehen, neu planen.
- **Keine Parallel-Änderungen an `App.tsx` und `server/index.js`**: C2 und C3 laufen getrennt (ein Entwickler pro Datei), damit Merge-Konflikte minimal bleiben.

## 6 · Reihenfolge für die erste Session auf Block C

1. Lies `CLAUDE.md`, `BLOCK-B.md` und `BLOCK-C.md` vollständig.
2. Führe `npm test`, `npm run build`, `npm run dev` – Baseline muss bestätigt sein (37 Backend + 352 Frontend grün, App startet, Build läuft).
3. Starte mit **C1 · Dependency-Update**. Express 5 zuerst, isoliert, mit Zwischen-Tests. Dann Vite 7.
4. Zeige Dr. Steiner nach C1 einen kurzen Status: was wurde upgedatet, was hat Arbeit gekostet, was ist offen.
5. Danach **C4a · E2E-Grundgerüst**. Erst ein Szenario als Muster, dann die übrigen elf.
6. **C2 und C3 dürfen erst starten, wenn C4a mit 12 grünen E2E-Szenarien abgeschlossen ist.**

## 7 · Sprint-Aufteilung (Größenordnung)

| Sprint | Paket | Ergebnis |
|---|---|---|
| S1 | C1 | Express 5 und Vite 7 in Betrieb, alle Tests grün, manueller Smoke-Test bestanden |
| S2 | C4a Teil 1 | Playwright-Setup, CI-Pipeline, 6 von 12 E2E-Szenarien grün |
| S3 | C4a Teil 2 | Restliche 6 E2E-Szenarien, CI als verbindliches Gate aktiv |
| S4 + S5 | C2 Teil 1 | Feature-Extraktion: gap (C2.1, erledigt), measures, governance, evidence, operations, assessment |
| S6 | C2 Teil 2 | Feature-Extraktion: platform, programRollout, regulatory, reporting, App-Shell |
| S7 | C3 | `server/index.js`-Zerlegung in alle Route-Module + Service-Layer |
| S8 | C4b | Component-Tests für sechs priorisierte Feature-Bausteine |
| S9 | C5 | Zod-Validierung flächendeckend, `sourceType`-Migration |
| S10 + S11 | C6 | Supabase-Produktionspfad, RLS, Backup-Restore-Drill |
| S12 | C7 | Pilotfreigabe-Dokumentation |

**Realistische Gesamt-Timeline**: 12 Sprints. Bei Parallelisierung von C2 und C3 (zwei Entwickler) einsparbar auf 10. Mit den von Dir in den Sprint-Dokumentationen gezeigten Iterationsgeschwindigkeiten ist das ambitioniert, aber machbar.

## 8 · Kontextpunkte für Claude Code

- **Wenn ein Test unter Refactoring plötzlich rot wird**: nicht den Test anpassen, sondern verstehen warum. Meist ist es die richtige Stelle zur Korrektur.
- **Wenn `App.tsx` nach drei Iterationen immer noch über 3.000 Zeilen**: Extraktions-Schnitt ist zu klein gewählt, bitte Rückmeldung an Dr. Steiner.
- **Wenn E2E-Test flaky wird**: erst drei Wiederholungen prüfen, dann Trace analysieren. Wenn wirklich flaky: Test isolieren, Grund identifizieren, nicht pauschal Retry erhöhen.
- **Wenn eine Express-5-Migration an einem nicht trivialen Verhalten hängt**: zurück zum Plan, nicht die App umbauen, sondern den Pfad über Express 4 diskutieren (Rollback auf C1 möglich).
- **Bei Supabase-Arbeiten** (C6): RLS-Regeln immer in eigenem File verwalten, nie direkt im Dashboard klicken – sonst sind sie nicht versioniert.

## 9 · Nach Abschluss von C

- Pilotkunde auswählbar und einführbar
- Grundlage für **Produktpaket P5** (Produktionsplattform) ist gelegt
- **Produktpaket P6** (Pilotbetrieb und Rollout) ist der nächste Schritt nach C7 – dort wird die App beim ersten echten Kunden eingeführt

### Meta-Review nach C2 · Arbeitsvorlage

> **Zeitpunkt**: voraussichtlich zu Beginn von **C7** (Pilotfreigabe-Dokumentation), nicht unmittelbar nach C2. Die Entscheidung wurde bei C2-Abschluss (Dr. Steiner / UVM, 2026-04-21) getroffen: Nach intensivem C2 ist ein Perspektivwechsel wertvoller als sofortige Weiterarbeit am selben Material; Meta-Review-Qualität lebt von frischem Blick und Distanz. C7 koppelt die Meta-Review natürlich an die Release-Notes-Durchsicht.
>
> **Ergebnis**: ein einzelner Polish-Commit (keine funktionale Änderung), plus ggf. eigenständige Fix-Commits für die als „ja" beantworteten Punkte. Zeitbudget: 30–90 Minuten plus die in den einzelnen Punkten genannten Zusatzaufwände.
>
> **Erinnerungs-Anker**: Jeder der neun Punkte unten enthält eine präzise Entscheidungsfrage, die ohne C2-Kontext-Reaktivierung beantwortbar sein soll. Die Beschreibung gibt den Hintergrund, die Frage ist der Gate-Punkt.

#### a) Naming-Konsistenz über die elf Feature-Slices

**Beschreibung**: Die elf C2-extrahierten Feature-Slices plus zwei B-fortgeführte haben einheitliche Hook-Namen (`use<Feature>Handlers`), Handler-Return-Typen (`<Feature>Handlers`) und — soweit noch vorhanden — Dep-Interface-Namen (`<Feature>HandlerDependencies`). Nach der Context-Migration in C2.11d existieren Dep-Interfaces nur noch in den vier Hooks mit echten Cross-Hook-Kopplungen (Evidence, PlatformAuth, PlatformSystem, TabletopExercise).

**Entscheidungsfrage**: Sind alle Hook-, Handler-Return- und noch vorhandenen Dep-Interface-Namen konsistent dem Muster `use<Feature>Handlers` / `<Feature>Handlers` / `<Feature>HandlerDependencies` gefolgt? **Falls ja**: kein Änderungsbedarf. **Falls nein**: Liste der Abweichungen und Entscheidung pro Abweichung (angleichen vs. begründet stehen lassen).

#### b) Kommentar-Qualität (Gruppenkommentare, JSDoc, Top-of-File-Blöcke)

**Beschreibung**: Nach C2.11d sind die meisten Dep-Interfaces verschwunden oder auf 1–4 Felder geschrumpft. Dagegen sind einige Top-of-File-JSDoc-Blöcke der Hooks (z. B. in `useServerSync.ts`, `usePlatformSystemHandlers.ts`) sehr ausführlich und tragen die Invarianten-Dokumentation. Andere Hooks haben knappere JSDoc-Blöcke.

**Entscheidungsfrage**: Haben alle 13 Feature-Hooks (inkl. resiliencePlan, tabletopExercise) einen einheitlich strukturierten Top-of-File-JSDoc-Block (Zweck, Extraktions-Iteration, Besonderheiten)? **Falls ja**: akzeptieren. **Falls nein**: angleichen (ja/nein), und — falls ja — was ist die Zielstruktur?

#### c) Public-API-Homogenität der Feature-index.ts-Dateien

**Beschreibung**: Jede Feature-`index.ts` folgt grob dem Schema „Views → Hooks → Pure-Helper → Types". Die Reihenfolge und die JSDoc-Einleitungen sind nicht perfekt homogen — manche Features haben ausführliche Breadcrumb-Kommentare (regulatory, reporting, platform), andere sind minimaler (riskCatalog, gap).

**Entscheidungsfrage**: Folgen alle 13 Feature-`index.ts`-Dateien dem gleichen Aufbau (Re-Export-Reihenfolge, JSDoc-Kopfstruktur)? **Falls ja**: akzeptieren. **Falls nein**: angleichen (ja/nein)?

#### d) regulatory-Feature hat keine Views im Ordner

**Beschreibung**: `KritisView` (1.077 Zeilen) lebt weiter in `src/views/`, obwohl das zugehörige Feature `src/features/regulatory/` existiert. Begründung aus C2.9: Die View ist groß und Querschnitt zu mehreren Features (Risk, Standards-Mappings, Authorities, PenaltyExposure); ein 1:1-Umzug würde Panel-Splits vorwegnehmen, die in C4b geplant sind.

**Entscheidungsfrage**: Wird `KritisView` vor Pilotstart nach `features/regulatory/views/` verschoben? **ja**: nur File-Move in dieser Meta-Review (~15 min, keine Panel-Splits), **nein**: bleibt bis C4b in `src/views/` und wird dort aufgeteilt.

#### e) reporting-Feature hat keine Views im Ordner

**Beschreibung**: Analog zu (d) — `ReportView` (614 Zeilen) lebt weiter in `src/views/`. Begründung aus C2.10: 18 von 22 Read-Props kommen aus `useAppDerivedState`; ReportView ist strukturell ein **Konsument** der Feature-Slices, nicht selbst eine neue Fach-Domain. 1:1-Umzug wäre rein mechanisch möglich.

**Entscheidungsfrage**: Wird `ReportView` vor Pilotstart nach `features/reporting/views/` verschoben? **ja**: File-Move (~10 min), **nein**: bleibt bis C4b. Idealerweise symmetrisch zur (d)-Entscheidung beantworten, damit keine der beiden Slices als Sonderfall übrig bleibt.

#### f) CSV-Permission-Gap aus C2.10

**Beschreibung**: In `src/lib/buildActiveViewPanelProps.ts` (aktuell Zeilen ~911–914) sind vier CSV-Export-Callbacks als Inline-Lambdas verdrahtet:
```ts
onExportActionCsv: () => exportActionPlanAsCsv(currentActionItems),
onExportEvidenceCsv: () => exportEvidenceRegisterAsCsv(currentEvidenceItems),
onExportStakeholderCsv: () => exportStakeholderRegisterAsCsv(currentStakeholders),
onExportFindingCsv: () => exportFindingRegisterAsCsv(currentFindings),
```
Diese vier Callbacks haben **keinen** `hasPermission('reports_export')`-Gate, während die vier Haupt-Exporter (`handleExportMarkdown`, `handleExportFormalHtml`, `handleExportManagementPdf`, `handleExportAuditPdf`) in `useReportingHandlers` den Gate konsistent anwenden. Datenschutz-relevant bei Stakeholder- und Finding-CSV-Exporten.

**Entscheidungsfrage**: Werden die vier CSV-Exporter mit einem `hasPermission('reports_export')`-Gate + Error-Notice analog zum Muster der Haupt-Exporter ergänzt — d. h. als vollwertige Handler in `useReportingHandlers` implementiert und in `buildActiveViewPanelProps.ts` durch die Hook-Returns ersetzt? **ja** (~30 min Aufwand, datenschutz-relevant) / **nein** (bewusste Entscheidung, mit Begründung dokumentieren).

#### g) App.tsx-Endgröße: 665 Zeilen – Struktur oder Kompaktierung?

**Beschreibung**: App.tsx liegt nach C2.11d bei **665 Zeilen** — zwischen der ursprünglichen Wunschmarke (500) und der vom Auftraggeber erweiterten Pragmatik-Obergrenze (860). Die 665 Zeilen enthalten die explizite 15-Feature-Hook-Aufruf-Struktur (transparent, aber lang) und die ~260 Zeilen Prop-Assembly für `buildActiveViewPanelProps` (ebenfalls transparent, aber lang).

Die C2.11-Freigabe hat sich bewusst gegen Kompositions-Hooks während der Extraktion entschieden — Kompositions-Hooks verschleiern Feature-Abhängigkeiten, statt sie zu verwalten. Die Meta-Review entscheidet mit Blick auf das fertige Ergebnis neu, ohne Implementierungs-Risiko.

**Entscheidungsfrage**: Bleibt die aktuelle explizite 15-Feature-Hook-Struktur in AppShell so stehen (**„Struktur hat Vorrang"**, akzeptiere 665 Zeilen dauerhaft und dokumentiere 450–860 als finalen Zielkorridor)? Oder wird sie in ein oder mehrere Kompositions-Hooks (`useFeatureHandlers()`, `useAppProps()`) zusammengefasst, um Richtung 500 zu kommen (**„Kompaktierung hat Vorrang"**, Aufwand ~30–60 min Polish-Commit)?

#### h) handleExportJson-Extraktion aus AppShell nach features/reporting/

**Beschreibung**: In C2.11d wurde `buildServerExportPackagePayload` + `getExportTypeLabel` nach `src/features/platform/serverExportPayload.ts` extrahiert. Eine analoge Extraktion von `handleExportJson` (aktuell 34 Zeilen inline in AppShell) nach `features/reporting/handlers/exportJson.ts` wurde als optional eingestuft und im Umbau-Fluss nicht durchgeführt, weil sie keinen strukturellen Zwang hatte.

**Entscheidungsfrage**: Wird `handleExportJson` aus AppShell nach `features/reporting/handlers/exportJson.ts` (oder als Handler in `useReportingHandlers`) extrahiert? **ja** (−30 Zeilen in App.tsx, konsistentere Feature-Grenzen, ~15 min) / **nein** (bleibt als AppShell-UI-Glue wie `selectModule`, `setActiveView` etc.).

#### i) Performance-Selector-Pattern als Future-Work-Anker

**Beschreibung**: Die beiden in C2.11d eingeführten Contexts nutzen React-Standard-Bail-Out (keine Selector-Pattern-Optimierung). AppShell re-rendert heute schon auf jede State-Änderung; die Feature-Hooks laufen ohnehin in AppShell. Performance-Hotspots wurden empirisch nicht beobachtet. Mögliche zukünftige Optimierungen: `use-context-selector`-Library oder Split in `WorkspaceStateContext` + separaten `AppHandlersContext`.

**Entscheidungsfrage**: Wird für die Pilotfreigabe eine Context-Optimierung (use-context-selector oder Context-Split) umgesetzt? **ja**: nur wenn Profiling einen konkreten Bottleneck zeigt, den ein Selector-Pattern nachweislich entschärft (Aufwand mindestens 1–2 Tage). **nein (erwartet)**: Future-Work-Anker in `docs/state-access-map.md` behalten, aktuelle Implementierung unverändert lassen.

---

**Abschluss**: Die Meta-Review liefert entweder einen einzigen Polish-Commit (für die „ja"-Antworten auf a/b/c plus eventuell d/e/f/g/h) oder mehrere kleine Fix-Commits (wenn einzelne Punkte strukturell unterschiedlich sind, z. B. View-Move vs. CSV-Handler vs. Naming-Rename). Punkt (i) erzeugt keinen Code-Commit — nur die Doc-Notiz, dass Future-Work-Anker gesetzt ist.

Viel Erfolg bei der Meta-Review.
