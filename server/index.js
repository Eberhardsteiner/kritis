/**
 * index.js · Bootstrap-Entrypoint der Krisenfest-API.
 *
 * Nach C3.7b ist index.js ein dünner Orchestrator:
 *
 *   1. Express-App erzeugen
 *   2. attachMiddleware(app)         — Pre-Route-Middleware-Kette
 *   3. 10× register*Routes(app)      — alle Route-Module
 *   4. attachErrorHandler(app)        — terminaler Error-Handler
 *   5. await initializeStorage()      — Bootstrap-Sequenz (Migration,
 *      Seeding, System-File-Init)
 *   6. Main-Module-Check + app.listen(PORT)
 *   7. export { app } für Integration-Tests (supertest, KRISENFEST_
 *      NO_LISTEN-Guard via pathToFileURL-Check)
 *
 * Alle Fach-Logik lebt in services/*.js und routes/*.js. Die
 * Extraktions-Historie ist in docs/POST-C3-META-REVIEW-NOTIZEN.md
 * und in den JSDoc-Präambeln der Services dokumentiert.
 */
import express from 'express';
import { pathToFileURL } from 'node:url';

import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerEvidenceRoutes } from './routes/evidence.js';
import { registerFileRoutes } from './routes/files.js';
import { registerIntegrationRoutes } from './routes/integration.js';
import { registerModuleRoutes } from './routes/modules.js';
import { registerReportingRoutes } from './routes/reporting.js';
import { registerStateRoutes } from './routes/state.js';
import { registerSystemRoutes } from './routes/system.js';
import { registerTenantSettingsRoutes } from './routes/tenant-settings.js';
import {
  attachErrorHandler,
  attachMiddleware,
} from './services/middleware-setup.js';
import { initializeStorage } from './services/storage-init.js';

const PORT = Number(process.env.KRISENFEST_API_PORT || 8787);

const app = express();

// C3.7b: Pre-Route-Middleware-Kette (helmet, observability, WAF-Lite,
// CORS, 3× rate-limit, json-body, cache-control) lebt seit C3.7b in
// services/middleware-setup.js. Die 11 app.use-Aufrufe sind dort mit
// einem Inline-Kommentar-Block als harte Reihenfolge-Invariante
// dokumentiert.
attachMiddleware(app);

// C3.6-Polish: Null-Deps-Nachzug für die fünf Alt-Route-Module.
// Seit diesem Commit importieren admin, auth, files, integration und
// system ihre Abhängigkeiten direkt aus den jeweiligen services/*-
// Modulen. Die früheren deps-Object-Aufrufe (register*Routes(app, {...}))
// werden zu register*Routes(app) reduziert.

registerSystemRoutes(app);
registerIntegrationRoutes(app);
registerAuthRoutes(app);

// Die sechs State-/Snapshot-/Audit-Endpoints (GET/PUT /api/state,
// GET /api/audit-log, GET/POST /api/snapshots,
// POST /api/snapshots/:snapshotId/restore) leben seit C3.5 in
// ./routes/state.js — registriert über registerStateRoutes(app) weiter
// unten. Audit-Log-Texte byte-identisch: action="Synchronisierung" /
// "Snapshot erstellt" / "Snapshot wiederhergestellt". Das 409-
// Conflict-Mapping (VERSION_CONFLICT → HTTP 409 mit currentVersion +
// currentUpdatedAt) ist dort mit Architektur-Notiz und Test-Assertion
// abgesichert. Die Reihenfolge cleanupOrphanUploads → writeState ist
// dort mit Inline-Ankerkommentaren markiert.

// Die sechs Evidence-/Dokumenten-Endpoints (POST/DELETE attachment,
// GET versions, POST versions/:id/restore, GET document-ledger/summary,
// GET evidence-retention/summary) leben seit C3.4 in
// ./routes/evidence.js — registriert über registerEvidenceRoutes(app)
// weiter unten (Null-Deps-Muster). Audit-Log-Texte byte-identisch:
// action="Dateiversion hochgeladen" / "Aktive Dateireferenz entfernt" /
// "Dokumentenversion wiederhergestellt".

// Die zwei /api/tenant-settings-Endpoints leben seit C3.3 in
// ./routes/tenant-settings.js — registriert über
// registerTenantSettingsRoutes(app) weiter unten (Null-Deps-Muster).
// Audit-Log-Text byte-identisch: action="Mandantenrichtlinien aktualisiert".

// Die vier /api/modules/registry-Endpoints leben seit C3.1 in
// ./routes/modules.js — registriert über registerModuleRoutes(app)
// weiter unten (Null-Deps-Muster).

// Die vier /api/exports-Endpoints leben seit C3.2 in
// ./routes/reporting.js — registriert ueber registerReportingRoutes(app)
// weiter unten (Null-Deps-Muster).

registerAdminRoutes(app);
registerFileRoutes(app);

// C3.1: Null-Deps-Muster für neue Route-Module — keine Deps-Object-
// Durchreichung, alle Services per Direkt-Import in routes/modules.js.
registerModuleRoutes(app);

// C3.2: Reporting/Exports-Route-Modul, gleiches Null-Deps-Muster.
registerReportingRoutes(app);

// C3.3: Tenant-Settings-Route-Modul, gleiches Null-Deps-Muster.
registerTenantSettingsRoutes(app);

// C3.4: Evidence-/Dokumenten-Route-Modul, gleiches Null-Deps-Muster.
// multer + uploadPolicy leben innerhalb des Route-Moduls.
registerEvidenceRoutes(app);

// C3.5: State-/Snapshot-/Audit-Route-Modul. buildStateEnvelope,
// cleanupOrphanUploads, Snapshot-Helper leben in services/state.js.
registerStateRoutes(app);


// C3.7b: Terminaler Error-Handler (VERSION_CONFLICT → 409-Mapping mit
// currentVersion/currentUpdatedAt, Security-Event-Recording für
// Status >= 400) lebt seit C3.7b in services/middleware-setup.js.
attachErrorHandler(app);

await initializeStorage();
// Main-Module-Check: listen() nur starten, wenn die Datei direkt
// ausgeführt wurde — nicht beim Import aus Tests. Env-Variablen greifen
// unter ESM nicht, weil imports vor Statements gehoisted werden.
const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Krisenfest API läuft auf Port ${PORT}`);
  });
}

export { app };
