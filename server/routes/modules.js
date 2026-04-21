/**
 * modules.js · Route-Modul für die Module-Pack-Registry.
 *
 * Extrahiert in C3.1 als erste Route-Extraktion nach der
 * Foundation-Phase. Enthält vier Endpoints:
 *   - GET  /api/modules/registry                       (list, anonymous-fähig)
 *   - POST /api/modules/registry/import                (import, 'modules_manage')
 *   - POST /api/modules/registry/:entryId/activate     (release, 'modules_manage')
 *   - POST /api/modules/registry/:entryId/retire       (retire,  'modules_manage')
 *
 * Null-Deps-Muster: Dieses Route-Modul übernimmt alle Abhängigkeiten
 * per direktem Service-Import aus der Foundation — `getAuthContext`
 * + `assertPermissions` aus `services/auth-session.js`,
 * `readModulePackRegistry` aus `services/persistence-wrappers.js`,
 * vier Registry-Lifecycle-Funktionen aus
 * `services/module-pack-registry.js`. Damit braucht
 * `registerModuleRoutes(app)` kein Deps-Object mehr.
 *
 * Die bestehenden fünf Route-Module (admin, auth, files, integration,
 * system) behalten vorerst ihre Deps-Object-Signatur aus der Zeit vor
 * der Foundation-Phase. Der retroaktive Nachzug auf dieses Null-Deps-
 * Muster ist als eigener Polish-Commit nach C3.7 geplant.
 */
import { asyncRoute } from './utils.js';
import { assertPermissions, getAuthContext } from '../services/auth-session.js';
import { readModulePackRegistry } from '../services/persistence-wrappers.js';
import {
  activateModulePackVersion,
  presentModulePackEntry,
  retireModulePackVersion,
  upsertImportedModulePack,
} from '../services/module-pack-registry.js';

export function registerModuleRoutes(app) {
  app.get('/api/modules/registry', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const entries = await readModulePackRegistry(authContext.membership.tenantId);
    res.json({ ok: true, entries: entries.map((entry) => presentModulePackEntry(entry)) });
  }));

  app.post('/api/modules/registry/import', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['modules_manage'], authContext);
    const entry = await upsertImportedModulePack(
      authContext.membership.tenantId,
      authContext,
      req.body || {},
    );
    res.status(201).json({
      ok: true,
      entry,
      entries: await readModulePackRegistry(authContext.membership.tenantId),
    });
  }));

  app.post('/api/modules/registry/:entryId/activate', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['modules_manage'], authContext);
    const entry = await activateModulePackVersion(
      authContext.membership.tenantId,
      authContext,
      req.params.entryId,
      String(req.body?.releaseNote || '').trim(),
    );
    res.json({
      ok: true,
      entry,
      entries: await readModulePackRegistry(authContext.membership.tenantId),
    });
  }));

  app.post('/api/modules/registry/:entryId/retire', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['modules_manage'], authContext);
    const entry = await retireModulePackVersion(
      authContext.membership.tenantId,
      authContext,
      req.params.entryId,
      String(req.body?.note || '').trim(),
    );
    res.json({
      ok: true,
      entry,
      entries: await readModulePackRegistry(authContext.membership.tenantId),
    });
  }));
}
