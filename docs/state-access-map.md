# State Access Map

Planungsgrundlage für die Context-Einführung in **C2.11** (App-Shell).
Diese Datei dokumentiert, welche useState-Variablen und Refs aus
`src/App.tsx` von welchen Features gelesen oder geschrieben werden.

Die Karte wird iterativ befüllt: je Sub-Iteration in C2.7 (Platform-
Extraktion) kommen bestätigte Lesewege dazu. Noch offene Extraktionen
(C2.8 programRollout, C2.9 regulatory, C2.10 reporting) ergänzen
weitere Zugriffe. Auf dieser Basis entscheidet C2.11, welche State-
Variablen in einen React-Context wandern und welche als Props bzw.
Hook-Deps weitergereicht bleiben.

## Leseregeln

- **„Feature-intern"** heißt: nur die App-Shell schreibt und liest,
  kein Feature außerhalb ruft den Wert direkt ab.
- **„Handler-Dep"** heißt: der Wert wird als Dependency in
  `use<Feature>Handlers({...})` gereicht.
- **„View-Prop"** heißt: der Wert fließt über `buildActiveViewPanelProps`
  als JSX-Prop in die View.
- **„useEffect-Dep"** heißt: eine App-Shell- oder Feature-Hook-useEffect
  hängt am Wert als Dependency.

## Platform-useState → Konsumenten

| useState | Schreiber | Feature-Leser (ohne App-Shell) | Context-Kandidat für C2.11 |
|---|---|---|---|
| `authToken` | platform-auth-Hook (Login/Logout), App-Shell-Bootstrap | evidence-Hook (Upload/Delete/Versions), MeasuresView-Props (`serverVersioningEnabled`), KritisView (Download-Artifacts) | **ja** — fast alle Features wollen authentifiziert sein |
| `authSession` | platform-auth-Hook, App-Shell-Bootstrap | useAppDerivedState (`activeUser`), evidence-Hook (Upload-Flow), App-Handler (User-Sync-useEffect, jetzt in Hook) | **ja** — steuert Permissions überall |
| `serverMode` | platform-auth-Hook, pushStateToServer, Server-Sync-useEffect | evidence-Hook (3 Upload-Pfade), MeasuresView (`serverVersioningEnabled`), PlatformView, OperationsView | **ja** |
| `tenantPolicy` | platform-auth-Hook, App-Shell (Login-Hydration) | evidence-Hook (`defaultClassification`, `evidenceReviewCadenceDays`), KritisView (Zertifizierung), ReportView (`exportApprovalRequired`, `certificationAuthorityLabel`), RolloutView (Export-Approval) | **ja** |
| `exportPackages` | platform-auth-Hook (handleReleaseRegisteredExport etc.), C2.7c handleCreateServerExportPackage | PlatformView, OperationsView (handover-bundles), RolloutView, KritisView (certification-dossiers), ReportView | nein — Liste per Props reichen reicht |
| `evidenceVersionMap` | platform-auth-Hook (clearAuthenticatedContext), evidence-Hook (Upload/Delete/Restore) | MeasuresView (Versionsliste pro Evidenz) | **ja** — wird von zwei Hooks geschrieben, gemeinsamer Context schlanker als doppelter Setter |
| `documentLedger` | platform-auth-Hook (Login-Clear), App-Shell (refreshServerSideData) | PlatformView (Summary-Card), ReportView (Dokumentenübersicht) | **evtl.** — zwei Leser reichen ggf. über Props |
| `evidenceRetentionSummary` | platform-auth-Hook | PlatformView, evidence-Domain (retention warnings), ReportView | **evtl.** |
| `lastServerSyncAt` / `lastServerLoadAt` | platform-auth-Hook, Server-Sync | PlatformView, ProjectTopbar (Status-Indikator) | nein |
| `autoSyncEnabled` | platform-auth-Hook (Toggle) | Server-Sync-useEffect | nein — feature-intern |
| `syncError`, `serverStateVersion`, `serverStateUpdatedAt` | platform-auth-Hook + pushStateToServer | PlatformView (Conflict-Display) | nein |
| `availableTenants`, `accessAccounts`, `publicTenant`, `authProviders`, `authMode`, `serverAuthRequired` | platform-auth-Hook (Bootstrap-/Login-Updates) | PlatformView (Login-Form + Tenant-Switch) | nein — feature-intern |
| `serverHealth` | App-Shell-Bootstrap (`refreshServerSideData`) | PlatformView, OperationsView (Health-Status), ProjectTopbar | nein |
| `auditLogEntries`, `snapshots` | platform-auth-Hook + Snapshot-Handler | PlatformView | nein — feature-intern |
| `apiClients`, `systemJobs`, `integritySummary`, `systemSettings`, `issuedClientSecret`, `availableTenants` | platform-system-Hook (C2.7c) | OperationsView (System-Dashboard) | nein — feature-intern zu platform-System |
| `hostingReadiness`, `securityGateSummary`, `observabilitySummary`, `restoreDrills` | App-Shell `refreshServerSideData` | OperationsView (Read-Only-Panels) | nein — nur Leser, kein Schreiber ausserhalb App-Shell |
| `moduleRegistryEntries` | platform-auth-Hook (Login-Reset), Module-Handler | ModulesView, PlatformView | nein |
| `users`, `activeUserId` | platform-control-Hook (C2.7d), platform-auth-Hook (Login-User-Sync) | ControlView (UserCard-Liste), `useAppDerivedState.activeUser` (fast jede View) | **ja** — `activeUser` ist der stärkste Cross-Feature-Read |
| `complianceCalendar` | regulatory-Hook (C2.9, Option B) | ControlView (Compliance-Kalender-Formular, Panel bleibt visuell im platform-Slice), `useAppDerivedState.deadlineSummary` | nein — Schreiber und Leser sind jetzt sauber getrennt |
| `rolloutPlan` | programRollout-Hook (C2.8) | RolloutView (Plan-Formular), platform-system-Hook (handleCreateHandoverBundle liest `releaseVersion`/`decisionNote`), App.tsx `buildServerExportPackagePayload` (handover_bundle), serverPayload.ts | nein — nur drei Leser, Props reichen |
| `hardeningChecks`, `runbooks`, `releaseGates` | programRollout-Hook (C2.8) | RolloutView (Cluster-Listen), App.tsx `buildServerExportPackagePayload` (handover_bundle-Sections) | nein — feature-intern zu programRollout |
| `regulatoryProfile` | regulatory-Hook (C2.9) | KritisView (Kern-Render), useAppDerivedState (9 Derivate: regimeDefinitions, regimeSummaries, activeRequirements, effectiveRequirementStates, kritisApplicability, kritisMilestones, kritisPenaltyEstimate, authorityAssignmentsByRegime, violations), ReportView, features/resiliencePlan/generator.ts, features/riskCatalog/export/riskAnalysisDocx.ts, components/ManagementLiabilityCard.tsx, lib/scoring.ts, lib/penaltyCalculator.ts, lib/workspace.ts, features/platform/serverPayload.ts | **ja (Top-Context)** — 20+ Leser, größter Cross-Feature-Blast-Radius. C2.11 Top-Priorität zusammen mit `authToken`/`authSession`/`serverMode`. |
| `certificationState` | regulatory-Hook (C2.9) | KritisView (Stages + Decision), useAppDerivedState (certificationProgress), App.tsx buildServerExportPackagePayload (certification_dossier), serverPayload.ts | nein — drei Leser, Props reichen |
| `auditFindings` | regulatory-Hook (C2.9, primary writer), evidence-Hook (C2.9 Cross-Feature-Cleanup via Pure-Helper `clearEvidenceRefsFromFindings`) | KritisView (FindingCard-Liste), useAppDerivedState (currentFindings, findingSummary), serverPayload.ts | nein — Cross-Feature-Kopplung durch Pure-Helper aufgeloest, Atomaritaet gewahrt |
| `auditChecklistStates` | regulatory-Hook (C2.9) | KritisView (Checklist-Status), useAppDerivedState (checklistProgress) | nein — feature-intern |
| `riskEntries` | riskCatalog-Hook (C2.9) | KritisView (via RiskMatrixView/RiskEntryForm/RiskRegisterView), features/riskCatalog/export/riskAnalysisDocx.ts | nein — feature-intern zu riskCatalog |

## Noch offene Feature-Inventare

Ergänzt mit den jeweiligen Extraktionen:

| Iteration | Was ergänzt wird |
|---|---|
| ~~C2.7c · Platform-System (OperationsView)~~ | ✅ erledigt — `pushStateToServer`, useEffect #4, 20 System-Handler, OperationsView im `features/platform`-Slice. App.tsx -465 Z. |
| ~~C2.7d · User-Management (ControlView)~~ | ✅ erledigt — 5 User-Handler + `updateComplianceCalendar` (Transient) + `inferRoleProfileFromStakeholder` + ControlView + UserCard im `features/platform`-Slice. E2E 16 ergänzt. App.tsx -119 Z. |
| ~~C2.8 · programRollout~~ | ✅ erledigt — ProgramView + RolloutView + 13 Handler + 4 Normalizer + `defaultRolloutPlan` im `features/programRollout`-Slice. Cross-Feature-Read-Befund: KritisView und ReportView lesen **keinen** programRollout-State direkt, sodass C2.9 durch C2.8 entkoppelt bleibt. App.tsx -428 Z. |
| ~~C2.9 · regulatory + riskCatalog~~ | ✅ erledigt — 11 regulatory-Handler (inkl. `updateComplianceCalendar`-Migration) + 4 riskCatalog-Handler + Pure-Helper `clearEvidenceRefsFromFindings` fuer atomare Cross-Feature-Evidence-Delete-Kaskade. `regulatoryProfile` als Top-Context-Kandidat markiert (20+ Leser). KritisView bleibt in `src/views/` bis C4b — dokumentiert in features/regulatory/index.ts und BLOCK-C.md-Meta-Review. App.tsx -200 Z. |
| ~~C2.10 · reporting~~ | ✅ erledigt — 4 Export-Handler (Management-Report Markdown/PDF, Formaler Audit-Bericht HTML, Audit-Pack PDF) als `features/reporting/hooks/useReportingHandlers`. Lib-Exporter und ReportView bleiben wo sie sind (Multi-Consumer bzw. Querschnittsdaten). App.tsx -60 Z. Wichtige Architektur-Erkenntnis siehe unten. |
| ~~C2.11a · resiliencePlan + tabletopExercise + gap~~ | ✅ erledigt — 22 Handler aus drei B-Feature-Modulen in Hook-Schichten verschoben. 9 resiliencePlan-Handler, 12 tabletop-Handler + Pure-Helper `resolveActiveScenario`, 1 gap-Handler. Neue Public APIs für resiliencePlan + tabletopExercise, gap-API erweitert. `triggerFileDownload` nach `src/shared/download.ts` konsolidiert (Inline-Duplicate im Gap-Handler mitgefixt). Erste Cross-Feature-Hook-Kopplung: tabletop → evidence via `upsertEvidenceDrafts`. App.tsx -346 Z. |
| ~~C2.11b · State-Hydration-Layer~~ | ✅ erledigt — 17 Module-Level-Artefakte aus App.tsx ausgelagert: 4 Defaults + `buildAppStateFromLoaded`/`createInitialState`/`applyRemoteState` nach `src/app/state/`; `normalizeLoadedUsers`+`normalizeUserRoleProfile`+`normalizeUserStatus` nach `features/platform/userNormalization`; `normalizeCertificationState`+`normalizeComplianceCalendar`+`normalizeLoadedFindings` nach `features/regulatory/` (drei getrennte Pure-Helper-Files, bewusste Abweichung vom `normalization.ts`-Muster der anderen Features); `isApiStatus` nach `src/shared/httpError.ts`. 3 Dead-Code-Items gelöscht (`defaultReviewPlan`, `createDefaultCertificationState`, `normalizeLoadedRegulatoryProfile`-Wrapper, repository-wide grep bestätigt 0 external references). Dep-Durchgriff-Reduktion in 3 Hooks. App.tsx -319 Z. |
| ~~C2.11c · Server-Sync-Layer~~ | ✅ erledigt — `loadStateFromServer`, `refreshServerSideData`, `fetchAdminServerDetails`, `refreshModuleRegistry`, `updateServerStateMarkers` nach `src/app/serverSync/useServerSync.ts`. 3 Mini-Shell-Effects (initialLoad, notice-dismiss, localStorage) nach `src/app/effects/useAppShellEffects.ts`. Module-Selection-Guard als separater Custom-Hook `src/app/effects/useModuleSelectionGuard.ts` (fachlich modules-nah, nicht Shell-Infrastruktur). Cycle-Breaker via `clearAuthenticatedContextRef` in App.tsx (wird per useEffect nach usePlatformAuthHandlers-Return verdrahtet, vor dem Bootstrap-Effect feuert). Alle 5 Server-Sync-Push-Loop-Invarianten-Stellen byte-identisch extrahiert mit Inline-Kommentaren. Top-of-File-Invarianten-Block in `useServerSync.ts` verweist auf `usePlatformSystemHandlers.ts` als zweiten Ort — beide zusammen zu betrachten. Fokus-E2E: E2E 15 3× in Folge + E2E 14 1× isoliert, alle grün. App.tsx -248 Z. |

## Architektur-Erkenntnis aus C2.10: Context-Einführung über `useAppDerivedState`-Return

Bei der Extraktion des reporting-Slices (C2.10) hat sich gezeigt, dass **18 von 22** Read-Props der ReportView aus `useAppDerivedState` kommen; nur 4 Felder werden direkt aus `state.*` gelesen (`companyProfile`, `requirementStates`, `certificationState`, `reviewPlan`). Kein einziger Read läuft über eine Feature-Public-API (`features/X/index.ts`).

Das ist die wichtigste Vorbereitungs-Erkenntnis für **C2.11**:

- **`useAppDerivedState` ist der de-facto State-Access-Layer der App.** Jede View, die mehr als ein oder zwei Felder braucht, konsumiert ihn bereits.
- Für C2.11 bedeutet das: Der natürliche **Context-Provider** ist nicht das rohe `state`-Objekt, sondern **das Return-Objekt von `useAppDerivedState`**. Damit wandern in einem Zug:
  - 30+ abgeleitete Summaries (regimeSummaries, scoreSnapshot, benchmark, governanceSummary, certificationProgress, checklistProgress, findingSummary, evidenceSummary, documentLibrarySummary, deadlineSummary, kritisMilestones, kritisPenaltyEstimate, kritisApplicability, authorityAssignmentsByRegime, gapAnalysisSummary, requirementProgress, …)
  - 8 Scope-gefilterte Listen (currentActionItems, currentEvidenceItems, currentStakeholders, currentSites, currentFindings, currentBusinessProcesses, currentDependencies, currentScenarios, currentExercises, currentHardeningChecks, currentRunbooks, currentReleaseGates)
  - Der normalisierte `regulatoryProfile`
  - `currentModule` und `activeUser`
- **Nicht im Context**: rohe `state.*`-Primitives, die nur ein einzelner Handler schreibt (z. B. `state.answers` schreibt nur der assessment-Hook). Diese bleiben als direkte `state`-Reads im Hook-Call.

Damit reduziert sich die Dep-Liste **jeder** bisherigen Feature-Hook drastisch:
- `ReportingHandlerDependencies`: 22 Felder → ~5 Felder (nur state-Primitives + hasPermission + showNotice)
- `PlatformSystemHandlerDependencies`: 35 Felder → ~12 Felder
- `EvidenceHandlerDependencies`: 23 Felder → ~10 Felder

**C2.11 Implementierungs-Leitbild**: `<AppDerivedStateProvider>` umschließt die Feature-Hooks; `useAppDerivedState()` wird zum Hook, den jeder Feature-Hook intern aufruft statt 20 Felder via Props zu bekommen. Die App.tsx-Bulk-Last kommt dann von State-Hydration (buildAppStateFromLoaded), useEffect-Bootstrap-Kette und den verbliebenen workspace-globalen Utilities (handleExportJson, selectModule, updateProfileField), nicht mehr von Handler-Hook-Dep-Verdrahtung.

## Verbundene Entscheidungen

- **`docs/open-decisions.md`**: Das Demo-Mode-Sync-Verhalten steht in enger
  Beziehung zur Context-Einführung — ein Context für `authToken` /
  `authSession` / `serverMode` würde den Reload-State-Leak bereits
  heute disziplinieren.
- **Hook-Deps-Reduktion**: Jeder Context-Wechsel reduziert die
  Dependency-Liste des entsprechenden Feature-Hooks. `EvidenceHandlerDependencies`
  (23 Felder) und `PlatformSystemHandlerDependencies` (35 Felder) sind
  die stärksten Indikatoren — ~10 Felder wandern in Context.
- **Server-Sync-Push-Loop-Invarianten**: Der Debounce-useEffect mit
  seinen fünf Schutzregeln (Suppress-Flag, lastSyncedPayloadRef,
  401-Immediacy, 409-No-setState, stabiles Dep-Array) liegt seit C2.7c
  als dokumentierter Kommentarblock im Kopf von
  `src/features/platform/hooks/usePlatformSystemHandlers.ts`.
  Bei einem späteren Context-Umbau für `authToken`/`serverMode` muss
  dieser Block zuerst erneut geprüft werden.
