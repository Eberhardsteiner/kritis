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

## Noch offene Feature-Inventare

Ergänzt mit den jeweiligen Extraktionen:

| Iteration | Was ergänzt wird |
|---|---|
| ~~C2.7c · Platform-System (OperationsView)~~ | ✅ erledigt — `pushStateToServer`, useEffect #4, 20 System-Handler, OperationsView im `features/platform`-Slice. App.tsx -465 Z. |
| C2.7d · User-Management (ControlView) | User-State-Reads aus ControlView + der 5 User-Handler |
| C2.8 · programRollout | ProgramView/RolloutView-Zugriffe auf `exportPackages`, `tenantPolicy`, `serverMode` |
| C2.9 · regulatory | KritisView-Zugriffe auf `tenantPolicy`, `authToken`, `authSession`, Bußgeldrechner-Datenflüsse |
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
