/**
 * evidence.js · Stateful Evidence-/Dokumenten-Service.
 *
 * Extrahiert in C3.4 aus server/index.js (~147 Zeilen Pure- und
 * I/O-Logik). Enthält sechs Funktionen rund um die tenant-scoped
 * Verwaltung von Nachweisen und Dokumentenversionen:
 *
 *   - attachmentFileNamesFromState:   Pure-Helper. Sammelt die aktiven
 *     storedFileName-Referenzen aus state.evidenceItems (Set).
 *   - versionFileNamesFromLedger:     Pure-Helper. Dto. aus dem
 *     document-versions-Ledger.
 *   - enrichAttachmentWithRetention:  Pure. Wrapper um
 *     buildEvidenceRetentionInfo, hängt Retention-Felder an ein
 *     Attachment-Objekt.
 *   - attachVersionMetadata:          I/O + Pure-Transform. Reichert
 *     state.evidenceItems[].serverAttachment mit Versions-Metadaten
 *     (historyCount, versionId, checksumSha256, storageDriver,
 *     Download-URL, Retention-Infos) an.
 *   - listEvidenceVersionEntries:     Pure. Sortiert und normalisiert
 *     Versions-Historie eines einzelnen Nachweises.
 *   - buildDocumentLedgerSummary:     I/O + Pure-Transform. Aggregat
 *     über das Versions-Ledger für den Dashboard-Endpoint.
 *
 * Abgrenzung:
 *   - server/evidence-platform.js (bestehend, ~115 Z.): Pure Logik für
 *     Retention-Berechnung (Review-Cadence, Retention-Status). Kein
 *     I/O. Ist Domain-Lib, nicht Service.
 *   - services/evidence.js (diese Datei): Stateful-Service-Schicht.
 *     Liest aus persistence-wrappers, konsumiert evidence-platform
 *     als Pure-Dependency.
 *
 * Parameter-Resolution (C3.0c-Nachzug):
 *   - buildStateEnvelope in server/index.js rief attachVersionMetadata
 *     früher über einen expliziten Parameter an buildSuccessfulAuthResponse.
 *     Nach C3.4 importiert server/index.js attachVersionMetadata direkt
 *     aus dieser Datei. Der buildStateEnvelope-Parameter an
 *     services/auth-session.js bleibt vorerst bestehen und wird in
 *     C3.5 aufgelöst, wenn buildStateEnvelope selbst mit dem state-
 *     Service umzieht.
 *
 * Two-Storage-Topologie:
 *   - Alle Funktionen dieses Moduls lesen nur Metadaten (state,
 *     versions-Ledger, tenant-settings). Keine File-I/O auf
 *     server-storage/uploads/. Die File-Lebenszyklus-Logik
 *     (Object-Storage-Put bei Upload, removeObject bei
 *     cleanupOrphanUploads) lebt in routes/evidence.js (Upload-
 *     Route) bzw. weiterhin in server/index.js (cleanupOrphanUploads,
 *     C3.5-Scope).
 */
import { defaultTenantSettings } from '../config/defaults.js';
import { buildEvidenceRetentionInfo } from '../evidence-platform.js'; // Pure-Logik-Lib, Heimkategorie in Post-C3-Meta-Review zu prüfen
import {
  readTenantSettings,
  readVersions,
} from './persistence-wrappers.js';
import { sanitizeArray } from './sanitizers.js';
import { buildDownloadUrl } from './file-utils.js';

export function attachmentFileNamesFromState(state) {
  const evidenceItems = sanitizeArray(state?.evidenceItems);
  return new Set(
    evidenceItems
      .map((item) => item?.serverAttachment?.storedFileName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

export function versionFileNamesFromLedger(versions) {
  return new Set(
    sanitizeArray(versions)
      .map((entry) => entry?.storedFileName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

export function enrichAttachmentWithRetention(evidence, attachment, policy) {
  if (!attachment) {
    return attachment;
  }
  const retention = buildEvidenceRetentionInfo({ ...evidence, serverAttachment: attachment }, policy);
  return {
    ...attachment,
    storageDriver: attachment.storageDriver || retention.storageDriver,
    retentionUntil: retention.retentionUntil,
    retentionStatus: retention.retentionStatus,
  };
}

export async function attachVersionMetadata(tenantId, state) {
  const [versions, tenantPolicy] = await Promise.all([readVersions(tenantId), readTenantSettings(tenantId)]);
  const countByEvidenceId = sanitizeArray(versions).reduce((accumulator, entry) => {
    if (!entry?.evidenceId) {
      return accumulator;
    }
    accumulator[entry.evidenceId] = (accumulator[entry.evidenceId] || 0) + 1;
    return accumulator;
  }, {});

  return {
    ...state,
    evidenceItems: sanitizeArray(state.evidenceItems).map((item) => {
      if (!item?.serverAttachment) {
        return item;
      }

      const currentVersion = sanitizeArray(versions).find((entry) => entry?.id === item.serverAttachment?.versionId)
        ?? sanitizeArray(versions).find((entry) => entry?.evidenceId === item.id && entry?.current);

      return {
        ...item,
        serverAttachment: enrichAttachmentWithRetention(item, {
          ...item.serverAttachment,
          versionId: currentVersion?.id,
          checksumSha256: currentVersion?.checksumSha256,
          historyCount: countByEvidenceId[item.id] || 0,
          storageDriver: currentVersion?.storageDriver || item.serverAttachment?.storageDriver || 'filesystem',
          url: buildDownloadUrl(item.serverAttachment.storedFileName, item.serverAttachment.fileName),
        }, tenantPolicy),
      };
    }),
  };
}

export function listEvidenceVersionEntries(versions, evidenceId, tenantPolicy = defaultTenantSettings) {
  return sanitizeArray(versions)
    .filter((entry) => entry?.evidenceId === evidenceId)
    .sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')))
    .map((entry) => {
      const retention = buildEvidenceRetentionInfo({
        id: entry.evidenceId,
        createdAt: entry.uploadedAt,
        reviewCycleDays: tenantPolicy?.evidenceReviewCadenceDays || 0,
        serverAttachment: {
          uploadedAt: entry.uploadedAt,
          storageDriver: entry.storageDriver || 'filesystem',
        },
      }, tenantPolicy);
      return {
        id: entry.id,
        evidenceId: entry.evidenceId,
        versionLabel: entry.versionLabel || '',
        fileName: entry.fileName,
        storedFileName: entry.storedFileName,
        mimeType: entry.mimeType,
        sizeKb: entry.sizeKb,
        uploadedAt: entry.uploadedAt,
        uploadedBy: entry.uploadedBy,
        checksumSha256: entry.checksumSha256,
        classification: entry.classification || 'intern',
        current: Boolean(entry.current),
        storageDriver: entry.storageDriver || 'filesystem',
        retentionUntil: retention.retentionUntil,
        retentionStatus: retention.retentionStatus,
        downloadUrl: buildDownloadUrl(entry.storedFileName, entry.fileName),
      };
    });
}

export async function buildDocumentLedgerSummary(tenantId) {
  const [versions, tenantPolicy] = await Promise.all([readVersions(tenantId), readTenantSettings(tenantId)]);
  const normalizedVersions = sanitizeArray(versions);
  const versionsByDriver = normalizedVersions.reduce((accumulator, entry) => {
    const driver = String(entry?.storageDriver || 'filesystem');
    accumulator[driver] = (accumulator[driver] || 0) + 1;
    return accumulator;
  }, {});
  const sorted = [...normalizedVersions].sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')));
  const evidenceIds = new Set(sorted.map((entry) => entry?.evidenceId).filter(Boolean));
  const currentAttachments = sorted.filter((entry) => entry?.current).length;

  return {
    totalVersions: sorted.length,
    evidenceWithHistory: evidenceIds.size,
    currentAttachments,
    latestActivityAt: sorted[0]?.uploadedAt || '',
    versionsByStorageDriver: Object.entries(versionsByDriver).map(([driver, count]) => ({ driver, count })),
    recentEntries: sorted.slice(0, 10).map((entry) => ({
      id: entry.id,
      evidenceId: entry.evidenceId,
      versionLabel: entry.versionLabel || '',
      fileName: entry.fileName,
      storedFileName: entry.storedFileName,
      mimeType: entry.mimeType,
      sizeKb: entry.sizeKb,
      uploadedAt: entry.uploadedAt,
      uploadedBy: entry.uploadedBy,
      checksumSha256: entry.checksumSha256,
      classification: entry.classification || 'intern',
      current: Boolean(entry.current),
      storageDriver: entry.storageDriver || 'filesystem',
      retentionUntil: buildEvidenceRetentionInfo({ createdAt: entry.uploadedAt, serverAttachment: { uploadedAt: entry.uploadedAt, storageDriver: entry.storageDriver || 'filesystem' } }, tenantPolicy).retentionUntil,
      retentionStatus: buildEvidenceRetentionInfo({ createdAt: entry.uploadedAt, serverAttachment: { uploadedAt: entry.uploadedAt, storageDriver: entry.storageDriver || 'filesystem' } }, tenantPolicy).retentionStatus,
      downloadUrl: buildDownloadUrl(entry.storedFileName, entry.fileName),
    })),
  };
}
