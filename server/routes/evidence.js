/**
 * evidence.js · Route-Modul für Nachweise und Dokumentenversionen.
 *
 * Extrahiert in C3.4 als vierte Route-Iteration nach modules (C3.1),
 * reporting (C3.2) und tenant-settings (C3.3). Enthält sechs Endpoints:
 *
 *   - POST   /api/evidence/:evidenceId/attachment            (upload + AV)
 *   - DELETE /api/evidence/:evidenceId/attachment            (soft detach)
 *   - GET    /api/evidence/:evidenceId/versions              (history)
 *   - POST   /api/evidence/:evidenceId/versions/:versionId/restore
 *   - GET    /api/document-ledger/summary
 *   - GET    /api/evidence-retention/summary
 *
 * Null-Deps-Muster: alle Abhängigkeiten per direktem Service-/Config-
 * Import. Kein deps-Object, keine Parameter-Injection.
 *
 * ============================================================================
 *  ARCHITEKTUR-NOTIZEN
 * ============================================================================
 *
 *  (1) multer und Upload-Policy leben in diesem Modul. Der POST-Upload-
 *      Endpoint ist heute der einzige Route-Handler im gesamten Server,
 *      der Multipart-Uploads annimmt. multer wird daher lokal initialisiert
 *      (globalTmpDir als dest, MAX_UPLOAD_BYTES als Limit). Kein Sharing
 *      mit anderen Routes.
 *
 *  (2) DELETE ist Soft-Detach, nicht Hard-Delete. Der Handler entfernt
 *      die aktive Referenz aus state.evidenceItems[i].serverAttachment
 *      und setzt alle Versions-Einträge dieser Evidence auf current=false,
 *      löscht aber NICHT die Datei aus server-storage/uploads/. Die Datei
 *      bleibt durch den Versions-Ledger referenziert (Soft-Delete als
 *      Audit-/History-Garantie). Object-Storage-Cleanup erfolgt zentral
 *      über cleanupOrphanUploads beim nächsten /api/state PUT oder
 *      /api/snapshots/:id/restore — diese Funktion lebt bis C3.5
 *      weiterhin in server/index.js.
 *
 *  (3) Der Audit-Log-Text "Aktive Dateireferenz entfernt. Historie
 *      bleibt erhalten." ist FACHLICHE Aussage, nicht nur UI-Message.
 *      Er dokumentiert den Soft-Detach-Charakter des Endpoints im
 *      Audit-Trail und ist Teil des Compliance-Vertrags. Ein späterer
 *      Refactorer sollte nicht versucht sein, den Text zu "vereinheitlichen"
 *      oder zu kürzen — das würde den fachlichen Informationsgehalt
 *      entfernen. Das gilt auch für die drei anderen Audit-Texte
 *      ("Dateiversion hochgeladen", "Dokumentenversion wiederhergestellt")
 *      — alle vier sind byte-identisch aus dem Ist-Stand übernommen.
 *
 *  (4) Two-Phase-Commit-Hole im POST-Upload: Zwischen
 *      storage.storeTempFile (Phase 1, File nach server-storage/uploads/)
 *      und writeVersions (Phase 2a, Versions-Ledger) bzw. writeState
 *      (Phase 2b, Evidence-State) gibt es theoretische Fehlerfenster,
 *      in denen Orphans oder State-/Ledger-Mismatches entstehen können.
 *      Byte-identisch aus dem Ist-Stand übernommen. Flaggen für
 *      C6-Bewertung in docs/POST-C3-META-REVIEW-NOTIZEN.md (Notiz 1,
 *      Zwei-Phasen-Commit-Muster).
 *
 * ============================================================================
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import multer from 'multer';

import { asyncRoute } from './utils.js';
import { globalTmpDir } from '../config/paths.js';
import { MAX_UPLOAD_BYTES } from '../config/defaults.js';
import { runtimeConfig } from '../config/runtime.js';
import { buildEvidenceRetentionSummary } from '../evidence-platform.js';
import {
  buildUploadPolicy,
  runAntivirusScan,
  validateUploadCandidate,
} from '../security.js';
import { assertPermissions, getAuthContext } from '../services/auth-session.js';
import {
  appendAuditLog,
  getObjectStorage,
  readState,
  readStateMeta,
  readTenantSettings,
  readVersions,
  writeState,
  writeVersions,
} from '../services/persistence-wrappers.js';
import {
  attachVersionMetadata,
  buildDocumentLedgerSummary,
  enrichAttachmentWithRetention,
  listEvidenceVersionEntries,
} from '../services/evidence.js';
import { buildDownloadUrl, computeSha256 } from '../services/file-utils.js';
import { createId, httpError, nowIso, slugify } from '../services/ids.js';
import { sanitizeArray } from '../services/sanitizers.js';

const uploadPolicy = buildUploadPolicy(MAX_UPLOAD_BYTES);
const upload = multer({
  dest: globalTmpDir,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export function registerEvidenceRoutes(app) {
  app.post('/api/evidence/:evidenceId/attachment', upload.single('file'), async (req, res, next) => {
    const tempFilePath = req.file?.path;
    try {
      if (!req.file) {
        throw httpError(400, 'Bitte eine Datei hochladen.');
      }

      const validation = validateUploadCandidate(req.file, uploadPolicy);
      if (!validation.ok) {
        throw httpError(400, validation.reason);
      }

      const authContext = await getAuthContext(req, true);
      assertPermissions(['evidence_edit'], authContext);
      const evidenceId = req.params.evidenceId;
      const currentState = await readState(authContext.membership.tenantId);
      const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === evidenceId);

      if (evidenceIndex < 0) {
        throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
      }

      const evidence = currentState.evidenceItems[evidenceIndex];
      const extension = validation.extension.slice(0, 12);
      const storedFileName = `${Date.now()}-${slugify(path.basename(req.file.originalname, extension) || 'attachment')}-${Math.random().toString(36).slice(2, 6)}${extension}`;

      const scanResult = await runAntivirusScan(req.file.path, runtimeConfig);
      if (scanResult.status === 'blocked') {
        await fs.unlink(req.file.path).catch(() => undefined);
        throw httpError(400, scanResult.detail);
      }

      const checksumSha256 = await computeSha256(req.file.path);
      const storage = await getObjectStorage();
      const storedObject = await storage.storeTempFile(req.file.path, {
        tenantId: authContext.membership.tenantId,
        storedFileName,
        mimeType: req.file.mimetype || 'application/octet-stream',
      });
      const versions = sanitizeArray(await readVersions(authContext.membership.tenantId)).map((entry) => (
        entry?.evidenceId === evidenceId ? { ...entry, current: false } : entry
      ));

      const versionEntry = {
        id: createId('ver'),
        evidenceId,
        versionLabel: String(evidence?.version || '').trim(),
        fileName: req.file.originalname,
        storedFileName,
        mimeType: req.file.mimetype || 'application/octet-stream',
        sizeKb: Math.round((req.file.size / 1024) * 10) / 10,
        uploadedAt: nowIso(),
        uploadedBy: authContext.account.name,
        uploadedById: authContext.account.id,
        checksumSha256,
        classification: evidence?.classification || 'intern',
        current: true,
        storageDriver: storedObject.driver || 'filesystem',
        objectKey: storedObject.objectKey || storedFileName,
      };
      versions.unshift(versionEntry);
      await writeVersions(authContext.membership.tenantId, versions);

      const historyCount = versions.filter((entry) => entry?.evidenceId === evidenceId).length;
      const tenantPolicy = await readTenantSettings(authContext.membership.tenantId);
      const attachment = enrichAttachmentWithRetention(evidence, {
        id: createId('att'),
        fileName: req.file.originalname,
        storedFileName,
        mimeType: req.file.mimetype || 'application/octet-stream',
        sizeKb: Math.round((req.file.size / 1024) * 10) / 10,
        url: buildDownloadUrl(storedFileName, req.file.originalname),
        uploadedAt: versionEntry.uploadedAt,
        uploadedBy: authContext.account.name,
        versionId: versionEntry.id,
        checksumSha256,
        historyCount,
        storageDriver: storedObject.driver || 'filesystem',
        objectKey: storedObject.objectKey || storedFileName,
      }, tenantPolicy);

      currentState.evidenceItems[evidenceIndex] = {
        ...evidence,
        serverAttachment: attachment,
        attachment: undefined,
        status: evidence.status === 'missing' ? 'draft' : evidence.status,
      };

      await writeState(authContext.membership.tenantId, currentState, {
        updatedAt: versionEntry.uploadedAt,
      });
      await appendAuditLog(authContext.membership.tenantId, {
        id: createId('audit'),
        at: versionEntry.uploadedAt,
        userId: authContext.account.id,
        userName: authContext.account.name,
        action: 'Dateiversion hochgeladen',
        resource: 'evidence',
        summary: `Datei „${req.file.originalname}“ wurde als neue Version für Nachweis ${evidenceId} gespeichert.${scanResult.status === 'clean' ? ' Antivirus-Scan ohne Treffer.' : ''}`,
        sections: ['evidenceItems', 'document-versions'],
      });

      const stateMeta = await readStateMeta(authContext.membership.tenantId);
      res.json({
        ok: true,
        attachment,
        evidenceId,
        stateVersion: stateMeta.version,
        stateUpdatedAt: stateMeta.updatedAt,
      });
    } catch (error) {
      next(error);
    } finally {
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => undefined);
      }
    }
  });

  app.delete('/api/evidence/:evidenceId/attachment', async (req, res, next) => {
    try {
      const authContext = await getAuthContext(req, true);
      assertPermissions(['evidence_edit'], authContext);
      const currentState = await readState(authContext.membership.tenantId);
      const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === req.params.evidenceId);

      if (evidenceIndex < 0) {
        throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
      }

      const versions = sanitizeArray(await readVersions(authContext.membership.tenantId)).map((entry) => (
        entry?.evidenceId === req.params.evidenceId ? { ...entry, current: false } : entry
      ));
      await writeVersions(authContext.membership.tenantId, versions);

      currentState.evidenceItems[evidenceIndex] = {
        ...currentState.evidenceItems[evidenceIndex],
        serverAttachment: undefined,
      };

      const detachedAt = nowIso();
      await writeState(authContext.membership.tenantId, currentState, {
        updatedAt: detachedAt,
      });
      await appendAuditLog(authContext.membership.tenantId, {
        id: createId('audit'),
        at: detachedAt,
        userId: authContext.account.id,
        userName: authContext.account.name,
        action: 'Aktive Dateireferenz entfernt',
        resource: 'evidence',
        summary: `Aktive Server-Datei von Nachweis ${req.params.evidenceId} wurde entfernt. Historie bleibt erhalten.`,
        sections: ['evidenceItems', 'document-versions'],
      });

      const stateMeta = await readStateMeta(authContext.membership.tenantId);
      res.json({ ok: true, stateVersion: stateMeta.version, stateUpdatedAt: stateMeta.updatedAt });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/evidence/:evidenceId/versions', async (req, res, next) => {
    try {
      const authContext = await getAuthContext(req, true);
      const [versions, tenantPolicy] = await Promise.all([
        readVersions(authContext.membership.tenantId),
        readTenantSettings(authContext.membership.tenantId),
      ]);
      res.json({ ok: true, versions: listEvidenceVersionEntries(versions, req.params.evidenceId, tenantPolicy) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/evidence/:evidenceId/versions/:versionId/restore', async (req, res, next) => {
    try {
      const authContext = await getAuthContext(req, true);
      assertPermissions(['evidence_edit'], authContext);
      const currentState = await readState(authContext.membership.tenantId);
      const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === req.params.evidenceId);
      if (evidenceIndex < 0) {
        throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
      }

      const versions = sanitizeArray(await readVersions(authContext.membership.tenantId));
      const selectedVersion = versions.find((entry) => entry?.id === req.params.versionId && entry?.evidenceId === req.params.evidenceId);
      if (!selectedVersion) {
        throw httpError(404, 'Die angeforderte Dokumentenversion wurde nicht gefunden.');
      }

      const nextVersions = versions.map((entry) => (
        entry?.evidenceId === req.params.evidenceId ? { ...entry, current: entry.id === selectedVersion.id } : entry
      ));
      await writeVersions(authContext.membership.tenantId, nextVersions);

      const tenantPolicy = await readTenantSettings(authContext.membership.tenantId);
      const restoredAttachment = enrichAttachmentWithRetention(currentState.evidenceItems[evidenceIndex], {
        id: createId('att'),
        fileName: selectedVersion.fileName,
        storedFileName: selectedVersion.storedFileName,
        mimeType: selectedVersion.mimeType,
        sizeKb: selectedVersion.sizeKb,
        url: buildDownloadUrl(selectedVersion.storedFileName, selectedVersion.fileName),
        uploadedAt: selectedVersion.uploadedAt,
        uploadedBy: selectedVersion.uploadedBy,
        versionId: selectedVersion.id,
        checksumSha256: selectedVersion.checksumSha256,
        historyCount: nextVersions.filter((entry) => entry?.evidenceId === req.params.evidenceId).length,
        storageDriver: selectedVersion.storageDriver || 'filesystem',
        objectKey: selectedVersion.objectKey || selectedVersion.storedFileName,
      }, tenantPolicy);

      currentState.evidenceItems[evidenceIndex] = {
        ...currentState.evidenceItems[evidenceIndex],
        serverAttachment: restoredAttachment,
      };
      const restoredAt = nowIso();
      await writeState(authContext.membership.tenantId, currentState, {
        updatedAt: restoredAt,
      });

      const savedState = await attachVersionMetadata(authContext.membership.tenantId, currentState);
      await appendAuditLog(authContext.membership.tenantId, {
        id: createId('audit'),
        at: restoredAt,
        userId: authContext.account.id,
        userName: authContext.account.name,
        action: 'Dokumentenversion wiederhergestellt',
        resource: 'evidence',
        summary: `Version ${selectedVersion.versionLabel || selectedVersion.id} für Nachweis ${req.params.evidenceId} wurde wieder als aktiv gesetzt.`,
        sections: ['evidenceItems', 'document-versions'],
      });

      const stateMeta = await readStateMeta(authContext.membership.tenantId);
      res.json({
        ok: true,
        evidenceId: req.params.evidenceId,
        evidence: savedState.evidenceItems[evidenceIndex],
        versions: listEvidenceVersionEntries(nextVersions, req.params.evidenceId, tenantPolicy),
        stateVersion: stateMeta.version,
        stateUpdatedAt: stateMeta.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/document-ledger/summary', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    res.json({ ok: true, summary: await buildDocumentLedgerSummary(authContext.membership.tenantId) });
  }));

  app.get('/api/evidence-retention/summary', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const [state, tenantPolicy] = await Promise.all([
      readState(authContext.membership.tenantId),
      readTenantSettings(authContext.membership.tenantId),
    ]);
    res.json({ ok: true, summary: buildEvidenceRetentionSummary(state, tenantPolicy) });
  }));
}
