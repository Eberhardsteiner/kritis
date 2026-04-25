# Demo-Auth-Bypass · Ein-Klick-Admin-Zugang für die UVM-Demo

> **Zweck**: Radikal vereinfachter Login-Pfad für die Demo-Phase. Keine Tenant-Auswahl, kein SSO-Block, keine Provider-Chips. Der Demonstrator gibt eine E-Mail und ein Passwort ein, klickt einen Button und ist als Admin eingeloggt. Der vollständige Auth-Stack (OIDC, Multi-Tenant-Membership, Account-DB-Lookup) bleibt code-seitig erhalten und kann jederzeit reaktiviert werden.

## Umfang und Zweck

Der Demo-Bypass adressiert ein konkretes Problem: In der laufenden UVM-Demo-Phase verlangsamt die vollständige Auth-Kette (Bootstrap → Tenant-Dropdown füllen → Passwort validieren → Membership auflösen → State hydratisieren) die Narrative Dramaturgie. Dr. Steiner will eine Ein-Klick-Anmeldung, die die Demo sofort in den Arbeitszustand bringt.

Die Bestehende Auth-Architektur ist bewusst **stillgelegt, nicht gelöscht**: Jede Route, jede Funktion, jedes Type-Interface bleibt im Repo aktiv. Hinter einem Feature-Flag wird die UI-Oberfläche reduziert und ein zweiter Login-Endpoint bereitgestellt. Der Umschalter ist eine einzelne Umgebungsvariable.

## Die Credentials

Für die Demo gelten:

| Feld | Wert |
|---|---|
| E-Mail | `demo@krisenfest.local` (oder jede andere nicht-leere E-Mail) |
| Passwort | `Krisenfest2026!` |
| Login-Pfad | Sidebar → **Plattform & Sync** → Sektion **Optionaler Login** |
| Button | **Demo-Anmeldung** |

Der serverseitige Handler prüft nur das Passwort gegen den `DEFAULT_DEMO_PASSWORD` (Default „Krisenfest2026!", überschreibbar über `KRISENFEST_DEMO_ADMIN_PASSWORD`). Die eingegebene E-Mail ist kosmetisch — intern wird der durch `seedDemoAdminIfMissing` gepflegte Account `admin@krisenfest.demo` als Session-Träger verwendet.

## Das Feature-Flag

`KRISENFEST_DEMO_SIMPLE_AUTH` (Default: `true`).

- **`true`** (aktueller Default, Demo-Phase): Frontend zeigt nur E-Mail + Passwort + Demo-Anmeldung-Button. Der Endpoint `POST /api/auth/demo-login` akzeptiert das Paar. Der reguläre Endpoint `POST /api/auth/login` bleibt technisch erreichbar, wird aber von der UI nicht mehr angesprochen.
- **`false`** (Post-Demo-Modus): Frontend rendert wieder das vollständige Formular mit Tenant-Dropdown, SSO-Block und Provider-Chips. Der Endpoint `/api/auth/demo-login` antwortet mit `403 Demo-Login ist deaktiviert`.

Das Flag wird in `server/config/runtime.js` über die Hilfsfunktion `normalizeBoolean(process.env.KRISENFEST_DEMO_SIMPLE_AUTH, true)` aufgelöst und im Bootstrap-Endpoint `GET /api/auth/bootstrap` als Feld `demoSimpleAuth` zum Frontend durchgereicht. Das Frontend speichert den Wert in `WorkspaceStateContext.demoSimpleAuth` und pipet ihn bis in `PlatformView` durch.

## Was im Code passiert (für den späteren Leser)

**Backend:**

- `server/config/runtime.js`: neue exportierte Konstante `DEMO_SIMPLE_AUTH`.
- `server/routes/auth.js`:
  - `GET /api/auth/bootstrap` liefert zusätzlich `demoSimpleAuth: boolean`.
  - Neuer Handler `POST /api/auth/demo-login`:
    1. Wenn `DEMO_SIMPLE_AUTH === false` → `403`.
    2. Wenn E-Mail oder Passwort leer → `400`.
    3. Wenn Passwort ≠ `DEFAULT_DEMO_PASSWORD` → `401`.
    4. Wenn kein aktiver Tenant existiert → `503`.
    5. Wenn kein Seed-Admin vorhanden ist (seedDemoAdminIfMissing nicht gelaufen) → `503`.
    6. Sonst: `buildSuccessfulAuthResponse` mit dem seeded Admin-Account, erstem aktiven Tenant, `providerId: 'demo'`.

**Frontend:**

- `src/lib/serverApi.ts`:
  - `AuthBootstrapResponse` erweitert um optionales `demoSimpleAuth`.
  - Neue Funktion `fetchDemoLogin(email, password)` ruft `POST /api/auth/demo-login` auf und liefert dieselbe `AuthLoginResponse`-Form wie `loginToServer`.
- `src/app/AppProvider.tsx` + `src/app/context/WorkspaceStateContext.tsx`: neuer State `demoSimpleAuth` (Default `false`).
- `src/app/serverSync/useServerSync.ts`: setzt `demoSimpleAuth` aus der Bootstrap-Response.
- `src/features/platform/hooks/usePlatformAuthHandlers.ts`: neuer Handler `handleDemoLogin(email, password)`, strukturell parallel zu `handleServerLogin`.
- `src/features/platform/views/PlatformView.tsx`: Wenn `demoSimpleAuth === true`, wird statt des Full-Auth-Formulars nur der reduzierte Block (E-Mail + Passwort + Demo-Anmeldung-Button) gerendert. Andernfalls bleibt das bestehende Formular unverändert.
- Typen-Propagation via `src/lib/buildActiveViewPanelProps.ts` und `src/App.tsx`.

## Was bewusst NICHT geändert wurde

Alles Folgende bleibt im Repo und funktioniert exakt wie bisher, sobald `KRISENFEST_DEMO_SIMPLE_AUTH=false` gesetzt ist:

- `POST /api/auth/login` (Full-Auth-Endpoint)
- `GET /api/auth/oidc/start`, `GET /api/auth/oidc/callback`, `POST /api/auth/oidc/complete`
- `buildAuthStrategyConfig` (OIDC-Discovery, Hybrid-Mode-Toggle)
- `buildPublicAuthProviders` (Provider-Liste für die UI)
- Account-DB (`server-storage/system/auth.json`), Password-Hashing (`hashPassword`, `verifyPassword`), Session-Token-Lebenszyklus (`SESSION_HOURS`, Session-Cleanup)
- Tenant-Membership-Logik in `resolveMembershipForAccount`
- OIDC-Provider-Code in `server/auth-provider.js`
- Frontend-Handler `handleServerLogin`, `handleStartOidcLogin`, `handleCreateTenantOnServer`, `handleUpsertAccessAccount`, `handleResetAccessAccountPassword`

Der Demo-Bypass ist additiv, nicht substitutiv.

## Reaktivierungs-Checkliste (Post-Demo)

Die folgenden Punkte werden abgearbeitet, wenn die Demo-Phase endet und produktive Nutzung ansteht. Jeder Punkt ist ein eigener, nachvollziehbarer Schritt:

1. **Env-Flag umschalten**: `KRISENFEST_DEMO_SIMPLE_AUTH=false` setzen (oder die Variable ganz entfernen und Default in `runtime.js` auf `false` ändern).
2. **Tenant-Dropdown-Verifikation**: Im PlatformView-Login ist das Mandant-Dropdown wieder sichtbar, lädt alle aktiven Tenants, erlaubt Auswahl.
3. **Admin-Accounts produktiv anlegen**: Über `/api/admin/accounts`-Flow echte Nutzer mit echten Rollen anlegen. Keine `admin@krisenfest.demo`-Accounts in produktiven Deployments belassen.
4. **OIDC-Provider konfigurieren (optional)**: Falls SSO genutzt werden soll: `KRISENFEST_OIDC_*` Env-Variablen setzen. Der OIDC-Block erscheint automatisch im Login-Formular, sobald `oidcProvider.configured === true`.
5. **Demo-Admin-Seed deaktivieren**: In `server/services/storage-init.js` entweder `KRISENFEST_SEED_DEMO_ADMIN` ungesetzt lassen (in Produktion greift der Seed dann nicht) oder die Funktion `seedDemoAdminIfMissing` per separatem Commit entfernen. Empfohlen: erst in einer zweiten Welle nach der Reaktivierung, um den Rückweg (z. B. Staging-Demo) offen zu halten.
6. **Session-Management prüfen**: Session-Dauer (`SESSION_HOURS`), Token-Refresh-Pfad (aktuell keiner), Revocation-Mechanismus (nur über Logout). Für produktive Umgebungen evaluieren, ob ein Rotating-Refresh-Token-Flow nötig ist.
7. **Multi-Tenant-Membership verifizieren**: `resolveMembershipForAccount` korrekt parametrisieren. Sicherstellen, dass ein Account mit mehreren Memberships nach Login den richtigen Tenant auswählt (standardmäßig via `tenantId`-Input oder erste aktive Membership).
8. **Audit-Log-Bereinigung**: Einträge mit `userId: '<seeded-admin-id>'` und `providerId: 'demo'` identifizieren. Entscheidung: löschen (wenn die Demo-Phase aus dem Audit-Pfad getilgt werden soll) oder als historischer Nachweis behalten (wenn das Audit-Log als lückenlos gelten muss).
9. **Frontend-Branch-Review**: Den Code-Pfad in `PlatformView.tsx` inspizieren, der bei `demoSimpleAuth === false` greift. Sicherstellen, dass er in der Oberfläche identisch zum Pre-Demo-Stand funktioniert (Dropdown gefüllt, SSO-Block sichtbar wenn konfiguriert, Provider-Chips korrekt).
10. **Entscheidung: Code entfernen oder behalten?** Nach Abschluss der Reaktivierung kann der Demo-Bypass-Code entweder vollständig entfernt werden (mit einer eigenen Feature-Deletion-PR) oder als Bereitschaftsmechanismus für zukünftige Präsentations-Fälle belassen werden. Im zweiten Fall: das Flag dokumentiert im Ops-Handbuch vermerken.

## Sicherheits-Hinweis

Der Demo-Bypass ist **nicht produktionstauglich**. Er enthält ein hartcodiertes Passwort (`Krisenfest2026!` via `DEFAULT_DEMO_PASSWORD`), bindet jeden erfolgreichen Login an einen mit System-Admin-Rechten ausgestatteten Account, und akzeptiert jede beliebige E-Mail. In einer Internet-exponierten Instanz mit `KRISENFEST_DEMO_SIMPLE_AUTH=true` wäre der Server effektiv offen. Vor jedem Deployment jenseits der UVM-Demo-Umgebung muss das Flag auf `false` stehen.

Die gleiche Schutzfunktion greift auf zwei Ebenen:

- Der Seed-Mechanismus (`seedDemoAdminIfMissing`) ist nur aktiv in `runtimeConfig.appMode !== 'production'` oder mit explizitem `KRISENFEST_SEED_DEMO_ADMIN=true`. In Produktionsumgebungen ohne Opt-in gibt es also schon keinen Demo-Admin-Account.
- Der Demo-Login-Endpoint prüft `DEMO_SIMPLE_AUTH` bei jedem Request. Auch wenn der Account versehentlich existiert, ist der Endpoint ohne das Flag nicht nutzbar.

Beide Schichten müssen gemeinsam missbraucht werden, um die Demo-Backdoor in Produktion zu erreichen. Beide sind dokumentiert und über Umgebungsvariablen steuerbar.

## Frontend-Feature-Flags (parallel zum Auth-Bypass)

Während der Demo-Phase werden zusätzlich zum Auth-Bypass auch UI-Bestandteile via Frontend-Flags ausgeblendet, die für die Demo-Dramaturgie ablenkend wirken könnten. Die Flags wohnen in `src/lib/featureFlags.ts`. Konvention: Konstante als `const`, sodass Vite den abgeschalteten Pfad inline-toten kann.

| Flag | Default Demo | Wirkung wenn `false` | Reaktivierung |
|---|---|---|---|
| `SHOW_PENALTY_EXPOSURE` | `false` | KritisView blendet `ManagementLiabilityCard` + `PenaltyExposureCard` aus (Sanktionsrisiko + Bußgeldexposition) | In `src/lib/featureFlags.ts` auf `true` setzen — Komponenten und Datenpfad (`kritisPenaltyEstimate`, `regulatoryProfile`, `kritisMilestones`) sind unverändert vorhanden |

**Reaktivierungs-Checklist-Punkt für SHOW_PENALTY_EXPOSURE**: `SHOW_PENALTY_EXPOSURE` in `src/lib/featureFlags.ts` auf `true` setzen, um die Sanktionsrisiko-Anzeige in KritisView wieder zu aktivieren. Verifikation: KritisView öffnen, Abschnitt unter „Standards & Mappings" zeigt zwei Karten („Geschäftsführungs-Haftung", „Bußgeldexposition").

## Verweis auf das C6-Scope-Dokument

Die Reaktivierung ist als `C6.6 · Reaktivierung Full-Auth` in `docs/C6-SCOPE.md` geführt. Der zeitliche Rahmen ist bewusst offen — die Entscheidung „Full-Auth zurück oder Demo-Bypass als Dauerzustand akzeptieren" wird anhand der Kollegen-Demo und ggf. Pilot-Feedback getroffen.
