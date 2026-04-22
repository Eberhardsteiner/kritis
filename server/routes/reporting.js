/**
 * reporting.js · Route-Modul für Export-Packages.
 *
 * Extrahiert in C3.2. Enthält vier Endpoints:
 *   - GET  /api/exports                       (list, anonymous-fähig)
 *   - POST /api/exports/packages              (create, 'reports_export'
 *                                              + bei certification_dossier
 *                                              zusätzlich 'kritis_edit')
 *   - POST /api/exports/:exportId/release     (release, Permission
 *                                              abhängig vom Entry-Type)
 *   - GET  /api/exports/:exportId/download    (download, anonymous-fähig,
 *                                              kein Audit-Log)
 *
 * Null-Deps-Muster analog zu routes/modules.js (C3.1). Alle
 * Abhängigkeiten per Direkt-Import aus der Foundation.
 *
 * Der Namens-Hinweis: Das Route-Modul heißt `reporting.js` statt
 * `exports.js`, weil `exports` ein JS-Keyword-Homonym ist (ESM
 * `export`-Statements) und die Lesbarkeit bei der Code-Review
 * leidet. Der Service dahinter heißt `services/exports.js` — dort
 * ist die Lesbarkeit unkritisch, weil die Datei thematisch-eindeutig
 * benannt ist.
 */
import { asyncRoute } from './utils.js';
import { assertPermissions, getAuthContext } from '../services/auth-session.js';
import {
  listExportEntries,
  persistExportPackage,
  readExportArtifact,
  releaseExportPackage,
} from '../services/exports.js';
import { httpError } from '../services/ids.js';
import { readExportLog } from '../services/persistence-wrappers.js';
import { sanitizeExportPackageType } from '../services/sanitizers.js';

export function registerReportingRoutes(app) {
  app.get('/api/exports', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const packages = await listExportEntries(authContext.membership.tenantId);
    res.json({ ok: true, packages });
  }));

  app.post('/api/exports/packages', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const type = sanitizeExportPackageType(String(req.body?.type || 'state_snapshot'));
    const requiredPermissions = type === 'certification_dossier'
      ? ['reports_export', 'kritis_edit']
      : ['reports_export'];
    assertPermissions(requiredPermissions, authContext);
    const entry = await persistExportPackage(
      authContext.membership.tenantId,
      authContext,
      req.body || {},
    );
    res.json({ ok: true, entry });
  }));

  app.post('/api/exports/:exportId/release', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    // Peek-Read vor dem Permission-Gate, weil der Entry-Type das
    // erforderliche Permission-Set bestimmt (certification_dossier
    // braucht zusätzlich kritis_edit). Service-Funktionen bleiben
    // auth-agnostisch; das Permission-Gating passiert im Route-Handler.
    // Das führt zu einem Doppel-Read (Peek + releaseExportPackage
    // liest intern erneut); das ist akzeptabel, weil der Registry-
    // Read aus dem Document-Store billig ist.
    const log = await readExportLog(authContext.membership.tenantId);
    const currentEntry = log.find((item) => item?.id === req.params.exportId);
    if (!currentEntry) {
      throw httpError(404, 'Exportpaket wurde nicht gefunden.');
    }
    const requiredPermissions = currentEntry.type === 'certification_dossier'
      ? ['reports_export', 'kritis_edit']
      : ['reports_export'];
    assertPermissions(requiredPermissions, authContext);

    const entry = await releaseExportPackage(
      authContext.membership.tenantId,
      authContext,
      req.params.exportId,
      req.body?.releaseNote,
    );
    res.json({ ok: true, entry });
  }));

  app.get('/api/exports/:exportId/download', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const { filePath, fileName } = await readExportArtifact(
      authContext.membership.tenantId,
      req.params.exportId,
    );
    const requestedName = String(req.query.download || fileName);
    res.setHeader(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`,
    );
    res.sendFile(filePath);
  }));
}
