/**
 * state.js · Route-Modul für State-, Snapshot- und Audit-Log-Endpoints.
 *
 * Extrahiert in C3.5 als fünfte Route-Iteration nach modules (C3.1),
 * reporting (C3.2), tenant-settings (C3.3) und evidence (C3.4). Enthält
 * sechs Endpoints:
 *
 *   - GET    /api/state
 *   - PUT    /api/state
 *   - GET    /api/audit-log
 *   - GET    /api/snapshots
 *   - POST   /api/snapshots
 *   - POST   /api/snapshots/:snapshotId/restore
 *
 * Null-Deps-Muster: alle Abhängigkeiten per direktem Service-/Config-
 * Import. Kein deps-Object, keine Parameter-Injection.
 *
 * ============================================================================
 *  ARCHITEKTUR-NOTIZEN
 * ============================================================================
 *
 *  (1) 409-Conflict-Mapping (PUT /api/state): Die Fehler-Behandlung
 *      konvertiert VERSION_CONFLICT aus der Persistence-Schicht in eine
 *      HTTP-409-Response mit den Feldern `currentVersion` und
 *      `currentUpdatedAt`. Die Message "Der Serverstand wurde
 *      zwischenzeitlich geändert. Bitte zuerst neu laden." ist
 *      **byte-identisch aus dem Ist-Stand**. Das Frontend vergleicht
 *      diesen Textsubstring in der Konfliktauflösungs-Logik (siehe
 *      C2.7c Server-Sync-Push-Loop-Invarianten) — eine Message-
 *      Änderung würde Frontend-Verhalten subtil brechen. Der
 *      Vorspann-Test in server/state-endpoints.test.js fängt eine
 *      solche Änderung per `assert.match(..., /zwischenzeitlich
 *      geändert/)` ab.
 *
 *  (2) Reihenfolge cleanupOrphanUploads → writeState: In PUT /api/state
 *      und POST /api/snapshots/:id/restore läuft cleanupOrphanUploads
 *      BEWUSST vor writeState. Der Cleanup operiert auf dem alten
 *      State, damit die Orphan-Detection die zu entfernenden Dateien
 *      korrekt identifiziert (previousNames = currentState-Attachments).
 *      Eine Umkehr der Reihenfolge würde die Semantik zerstören. Siehe
 *      Inline-Ankerkommentare an den Call-Sites — doppeltes Anchoring
 *      (Präambel + Inline), weil ein Präambel-Kommentar leicht
 *      überlesen wird und ein Inline-Kommentar beim Refactoring
 *      gelesen wird.
 *
 *  (3) Audit-Log-Texte byte-identisch übernommen:
 *      - "Synchronisierung" (PUT /api/state)
 *      - "Snapshot erstellt" (POST /api/snapshots)
 *      - "Snapshot wiederhergestellt" (POST /api/snapshots/:id/restore)
 *      Alle drei sind fachliche Aussagen, keine UI-Messages, und Teil
 *      des Compliance-Vertrags (Audit-Trail).
 *
 *  (4) SNAPSHOT_LIMIT-Trimming: Der POST /api/snapshots-Endpoint löscht
 *      überzählige alte Snapshots, wenn die Anzahl SNAPSHOT_LIMIT
 *      übersteigt. Byte-identisch — die Reihenfolge (reverse
 *      chronologisch, neueste bleiben) kommt aus listSnapshotFiles.
 * ============================================================================
 */
import path from 'node:path';
import fs from 'node:fs/promises';

import { asyncRoute } from './utils.js';
import { SNAPSHOT_LIMIT, sectionPermissionMap } from '../config/defaults.js';
import { assertPermissions, getAuthContext } from '../services/auth-session.js';
import {
  appendAuditLog,
  readAuditLog,
  readState,
  readStateMeta,
  tenantPaths,
  writeJsonFile,
  writeState,
} from '../services/persistence-wrappers.js';
import {
  buildStateEnvelope,
  cleanupOrphanUploads,
  getSnapshotPayload,
  listSnapshotFiles,
  listSnapshots,
} from '../services/state.js';
import { createId, httpError, nowIso, slugify } from '../services/ids.js';
import {
  buildWorkspaceUserSeedFromContext,
} from '../services/auth-session.js';
import { detectChangedSections, sanitizeState } from '../services/sanitizers.js';

export function registerStateRoutes(app) {
  app.get('/api/state', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const stateEnvelope = await buildStateEnvelope(authContext.membership.tenantId, await readState(authContext.membership.tenantId));
    res.json({
      ok: true,
      ...stateEnvelope,
      tenant: authContext.tenant,
      session: authContext.sessionPublic,
      workspaceUserSeed: buildWorkspaceUserSeedFromContext(authContext),
      accessMode: authContext.anonymous ? 'anonymous' : 'authenticated',
    });
  }));

  app.put('/api/state', async (req, res, next) => {
    try {
      const authContext = await getAuthContext(req, true);
      const incomingState = sanitizeState(req.body?.state);
      const expectedVersionRaw = Number(req.body?.expectedVersion);
      const expectedVersion = Number.isFinite(expectedVersionRaw) ? expectedVersionRaw : undefined;
      const currentState = await readState(authContext.membership.tenantId);
      const changedSections = detectChangedSections(currentState, incomingState);
      const requiredPermissions = [...new Set(changedSections.map((section) => sectionPermissionMap[section]).filter(Boolean))];
      assertPermissions(requiredPermissions, authContext);

      // cleanupOrphanUploads läuft bewusst VOR writeState: Cleanup operiert auf
      // dem alten State, bevor der neue persistiert wird. Reihenfolge kritisch
      // für Orphan-Detection-Semantik (siehe Präambel-Notiz 2).
      await cleanupOrphanUploads(currentState, incomingState, authContext.membership.tenantId);
      const savedAt = nowIso();
      const savedState = await writeState(authContext.membership.tenantId, incomingState, {
        expectedVersion,
        updatedAt: savedAt,
      });

      if (changedSections.length) {
        await appendAuditLog(authContext.membership.tenantId, {
          id: createId('audit'),
          at: savedAt,
          userId: authContext.account.id,
          userName: authContext.account.name,
          action: 'Synchronisierung',
          resource: 'state',
          summary: `${changedSections.length} Abschnitt(e) wurden aktualisiert.`,
          sections: changedSections,
        });
      }

      res.json({
        ok: true,
        ...(await buildStateEnvelope(authContext.membership.tenantId, savedState)),
        savedAt,
        changedSections,
      });
    } catch (error) {
      if (error?.code === 'VERSION_CONFLICT') {
        const conflict = httpError(409, 'Der Serverstand wurde zwischenzeitlich geändert. Bitte zuerst neu laden.');
        conflict.currentVersion = Number(error?.currentVersion || 0);
        conflict.currentUpdatedAt = String(error?.currentUpdatedAt || '');
        next(conflict);
        return;
      }
      next(error);
    }
  });

  app.get('/api/audit-log', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const entries = await readAuditLog(authContext.membership.tenantId);
    res.json({ ok: true, entries });
  }));

  app.get('/api/snapshots', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    res.json({ ok: true, snapshots: await listSnapshots(authContext.membership.tenantId) });
  }));

  app.post('/api/snapshots', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['workspace_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const name = String(req.body?.name || '').trim();
    const comment = String(req.body?.comment || '').trim();

    if (!name) {
      throw httpError(400, 'Bitte einen Snapshot-Namen angeben.');
    }

    const snapshotId = `${new Date().toISOString().slice(0, 10)}-${slugify(name) || 'snapshot'}-${Math.random().toString(36).slice(2, 6)}`;
    const snapshot = {
      id: snapshotId,
      name,
      comment,
      createdAt: nowIso(),
      createdBy: authContext.account.id,
      userName: authContext.account.name,
    };

    const paths = tenantPaths(authContext.membership.tenantId);
    await writeJsonFile(path.join(paths.snapshotsDir, `${snapshotId}.json`), {
      meta: snapshot,
      state: currentState,
    });

    const files = await listSnapshotFiles(authContext.membership.tenantId);
    if (files.length > SNAPSHOT_LIMIT) {
      const obsolete = files.slice(SNAPSHOT_LIMIT);
      await Promise.all(obsolete.map((fileName) => fs.unlink(path.join(paths.snapshotsDir, fileName)).catch(() => undefined)));
    }

    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: snapshot.createdAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Snapshot erstellt',
      resource: 'snapshot',
      summary: `Arbeitsstand „${name}“ gespeichert.`,
      sections: [],
    });

    res.json({ ok: true, snapshot });
  }));

  app.post('/api/snapshots/:snapshotId/restore', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['workspace_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const payload = await getSnapshotPayload(authContext.membership.tenantId, req.params.snapshotId);
    const restoredState = sanitizeState(payload.state);

    // cleanupOrphanUploads läuft bewusst VOR writeState: der alte State
    // referenziert möglicherweise Dateien, die im Restore-State nicht mehr
    // vorkommen. Reihenfolge kritisch für Orphan-Detection-Semantik (siehe
    // Präambel-Notiz 2).
    await cleanupOrphanUploads(currentState, restoredState, authContext.membership.tenantId);
    await writeState(authContext.membership.tenantId, restoredState);

    const restoredAt = nowIso();
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: restoredAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Snapshot wiederhergestellt',
      resource: 'snapshot',
      summary: `Arbeitsstand „${payload.meta.name}“ wurde eingespielt.`,
      sections: ['snapshot-restore'],
    });

    res.json({
      ok: true,
      snapshot: payload.meta,
      ...(await buildStateEnvelope(authContext.membership.tenantId, restoredState)),
    });
  }));
}
