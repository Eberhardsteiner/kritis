/**
 * state.js · Tenant-scoped State- und Snapshot-Service.
 *
 * Extrahiert in C3.5 aus server/index.js. Enthält fünf Funktionen:
 *
 *   - buildStateEnvelope:       Pure-Derivation. Reichert den State
 *     mit attachVersionMetadata (evidence-aware) + StateMeta an.
 *   - listSnapshotFiles:        I/O. Liste der Snapshot-Dateien aus
 *     snapshotsDir, sortiert reverse-chronologisch.
 *   - listSnapshots:            I/O. Parsed Snapshot-Metadaten aus den
 *     Files und liefert die sortierte Liste.
 *   - getSnapshotPayload:       I/O. Liest einen einzelnen Snapshot;
 *     404 bei fehlerhafter Struktur oder fehlender Datei.
 *   - cleanupOrphanUploads:     I/O + Object-Storage. Entfernt Dateien
 *     aus server-storage/uploads/, die weder im neuen State noch im
 *     Versions-Ledger referenziert werden.
 *
 * Abgrenzung:
 *   - services/evidence.js (C3.4): enthält die Pure-Helper
 *     attachmentFileNamesFromState, versionFileNamesFromLedger,
 *     attachVersionMetadata. state.js importiert diese direkt.
 *   - services/persistence-wrappers.js: I/O-Fassade. state.js liest
 *     via readStateMeta, readVersions, getObjectStorage etc.
 *   - routes/state.js: HTTP-Shell. Konsumiert alle fünf Funktionen
 *     dieses Moduls.
 *
 * DAG-Position:
 *   evidence.js ← state.js ← auth-session.js (buildStateEnvelope direkt)
 *   state.js ← routes/state.js
 *   state.js ← routes/integration.js (nur buildStateEnvelope)
 *
 * Parameter-Auflösung (C3.5-Abschluss):
 *   Vor C3.5 wurde buildStateEnvelope als Parameter an
 *   buildSuccessfulAuthResponse und consumeAuthCallbackTicket gereicht
 *   (siehe services/auth-session.js-Präambel). Dieses Plumbing ist
 *   seit C3.5 aufgelöst — auth-session.js importiert direkt aus
 *   dieser Datei, keine Parameter-Durchreichung mehr.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  attachVersionMetadata,
  attachmentFileNamesFromState,
  versionFileNamesFromLedger,
} from './evidence.js';
import { httpError } from './ids.js';
import {
  getObjectStorage,
  readJsonFile,
  readStateMeta,
  readVersions,
  tenantPaths,
} from './persistence-wrappers.js';
import { sanitizeArray } from './sanitizers.js';

export async function buildStateEnvelope(tenantId, state) {
  const versionedState = await attachVersionMetadata(tenantId, state);
  const meta = await readStateMeta(tenantId);
  return {
    state: versionedState,
    stateVersion: meta.version,
    stateUpdatedAt: meta.updatedAt,
  };
}

export async function listSnapshotFiles(tenantId) {
  const paths = tenantPaths(tenantId);
  const files = await fs.readdir(paths.snapshotsDir).catch(() => []);
  return files.filter((fileName) => fileName.endsWith('.json')).sort().reverse();
}

export async function listSnapshots(tenantId) {
  const paths = tenantPaths(tenantId);
  const files = await listSnapshotFiles(tenantId);
  const snapshots = [];

  for (const fileName of files) {
    const payload = await readJsonFile(path.join(paths.snapshotsDir, fileName), null);
    if (payload?.meta) {
      snapshots.push(payload.meta);
    }
  }

  return snapshots;
}

export async function getSnapshotPayload(tenantId, snapshotId) {
  const paths = tenantPaths(tenantId);
  const snapshotPath = path.join(paths.snapshotsDir, `${snapshotId}.json`);
  const payload = await readJsonFile(snapshotPath, null);
  if (!payload?.meta || !payload?.state) {
    throw httpError(404, 'Snapshot wurde nicht gefunden.');
  }
  return payload;
}

/**
 * Entfernt Dateien aus dem zentralen Object-Storage
 * (server-storage/uploads/), die im previousState noch referenziert
 * waren, im nextState aber nicht mehr und auch nicht im Versions-Ledger
 * verankert sind.
 *
 * **Aufruf-Invariante:** cleanupOrphanUploads muss VOR dem writeState
 * laufen, sonst operiert die Orphan-Detection auf dem neuen State und
 * würde nichts mehr finden. Siehe Inline-Ankerkommentare an den
 * Call-Sites in routes/state.js.
 */
export async function cleanupOrphanUploads(previousState, nextState, tenantId) {
  const previousNames = attachmentFileNamesFromState(previousState);
  const nextNames = attachmentFileNamesFromState(nextState);
  const versions = await readVersions(tenantId);
  const versionNames = versionFileNamesFromLedger(versions);
  const storage = await getObjectStorage();

  await Promise.all(
    [...previousNames]
      .filter((name) => !nextNames.has(name) && !versionNames.has(name))
      .map(async (name) => {
        const matchingVersion = sanitizeArray(versions).find((entry) => entry?.storedFileName === name);
        await storage.removeObject({
          tenantId,
          storedFileName: name,
          objectKey: matchingVersion?.objectKey,
        }).catch(() => undefined);
      }),
  );
}
