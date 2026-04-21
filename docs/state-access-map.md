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
| C2.10 · reporting | ReportView-Querschnitts-Reads |

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
