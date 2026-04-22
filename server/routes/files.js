/**
 * files.js · Route-Modul für Download-Endpoint.
 *
 * Null-Deps seit C3.6-Polish (retroaktiver Nachzug). Früher
 * deps-Object-Injection, jetzt direkte Service-Imports.
 */
import path from 'node:path';

import { asyncRoute } from './utils.js';
import { getAuthContext } from '../services/auth-session.js';
import { getObjectStorage, readVersions } from '../services/persistence-wrappers.js';
import { sanitizeArray } from '../services/sanitizers.js';

export function registerFileRoutes(app) {
  app.get('/api/files/:storedFileName', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const storedFileName = path.basename(req.params.storedFileName);
    const versions = await readVersions(authContext.membership.tenantId);
    const versionEntry = sanitizeArray(versions).find((entry) => entry?.storedFileName === storedFileName);
    const requestedName = String(req.query.download || versionEntry?.fileName || storedFileName);
    const storage = await getObjectStorage();
    const payload = await storage.getDownloadPayload({
      tenantId: authContext.membership.tenantId,
      storedFileName,
      objectKey: versionEntry?.objectKey,
    });

    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
    if (payload.type === 'file') {
      res.sendFile(payload.filePath);
      return;
    }

    if (payload.contentType) {
      res.setHeader('content-type', payload.contentType);
    }
    res.send(payload.buffer);
  }));
}
