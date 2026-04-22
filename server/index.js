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

// Pre-Route-Middleware-Kette (services/middleware-setup.js).
attachMiddleware(app);

// Route-Module · alle folgen dem Null-Deps-Muster (siehe
// services/*/JSDoc-Präambeln für Konsumenten-Details). Reihenfolge
// hier ist nicht semantisch relevant — jede register*Routes-Funktion
// bindet unabhängig ihre Endpoints an die Express-App.
registerSystemRoutes(app);            // /api/health*, /api/system/* (C3.6, Polish)
registerIntegrationRoutes(app);       // /api/integration/* (C3.6-Polish)
registerAuthRoutes(app);              // /api/auth/* (C3.6-Polish)
registerAdminRoutes(app);             // /api/admin/* (C3.6-Polish)
registerFileRoutes(app);              // /api/files/* (C3.6-Polish)
registerModuleRoutes(app);            // /api/modules/registry (C3.1)
registerReportingRoutes(app);         // /api/exports (C3.2)
registerTenantSettingsRoutes(app);    // /api/tenant-settings (C3.3)
registerEvidenceRoutes(app);          // /api/evidence/*, /api/document-ledger/* (C3.4)
registerStateRoutes(app);             // /api/state, /api/snapshots/*, /api/audit-log (C3.5)

// Terminaler Error-Handler (services/middleware-setup.js).
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
