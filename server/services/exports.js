/**
 * exports.js · Export-Package-Service (Tenant-Scoped).
 *
 * Extrahiert in C3.2 aus server/index.js. Sechs Funktionen für die
 * Verwaltung von Export-Paketen pro Tenant:
 *   - buildExportDownloadUrl: URL-Builder (pure).
 *   - presentExportEntry: Presentation-Wrapper mit Download-URL-Injection.
 *   - listExportEntries: Sortiert + präsentiert das Tenant-Export-Log.
 *   - persistExportPackage: Erzeugt Artefakt-Datei + Registry-Eintrag +
 *     Audit-Log-Entry. Kern-Lifecycle-Funktion.
 *   - releaseExportPackage: Setzt ein Export-Paket auf "released" + Audit.
 *     Neu extrahiert aus dem Inline-Handler /api/exports/:exportId/release.
 *   - readExportArtifact: Liefert für den Download-Flow den File-Pfad
 *     nach Path-Traversal-Isolation. Neu extrahiert aus dem Inline-Handler
 *     /api/exports/:exportId/download.
 *
 * ===========================================================================
 *  ZWEI-PHASEN-COMMIT-MUSTER IN persistExportPackage
 * ===========================================================================
 *
 *  Heutiges Verhalten: **Storage first, Registry second, kein Rollback**.
 *  Ablauf (byte-identisch aus der monolithischen Vor-C3.2-Version):
 *
 *    1. writeJsonFile(targetPath, filePayload)   ← Artefakt-Datei
 *    2. computeSha256 + fs.stat                  ← Checksum + Size
 *    3. Build Registry-Entry                     ← in-memory
 *    4. readExportLog + unshift + writeExportLog ← Registry-Update
 *    5. appendAuditLog                           ← Audit-Entry
 *
 *  Crash-Szenarien:
 *   - Zwischen Schritt 1 und 4: Orphan-Artefakt-Datei auf Platte, **kein
 *     Registry-Eintrag** → passive Reconciliation greift hier **nicht**.
 *   - Zwischen Schritt 4 und 5: Registry-Entry ohne Audit → nur über
 *     manuelle Inspektion diagnostizierbar.
 *
 *  Passive Reconciliation (an anderen Stellen in der Codebase):
 *   - buildExportInventoryPayload (C3.6-Kandidat in server/index.js):
 *     filtert Registry-Einträge, deren Artefakt-Datei nicht (mehr)
 *     existiert.
 *   - persistTenantBackupArtifacts (C3.6-Kandidat): analog.
 *
 *  **Wichtig**: Die passive Reconciliation deckt nur die
 *  **Registry-zu-Storage-Richtung** ab (fehlende Artefakte werden
 *  herausgefiltert). Die **Storage-zu-Registry-Richtung fehlt** —
 *  orphan Artefakte ohne Registry-Eintrag bleiben unentdeckt auf der
 *  Platte. In C6 (Supabase-Produktionspfad) muss das Muster für beide
 *  Richtungen bewertet werden: Registry-first-mit-Draft-Status +
 *  Storage-second + Registry-Finalize als dritter Schritt könnte die
 *  robustere Alternative sein. Das ist **nicht C3-Scope**, nur als
 *  Design-Entscheidung für die Supabase-Migration festgehalten.
 *
 * ===========================================================================
 *  DOWNLOAD-FLOW
 * ===========================================================================
 *
 *  Der /api/exports/:exportId/download-Pfad (readExportArtifact +
 *  res.sendFile im Route-Handler) hat folgende Eigenschaften:
 *
 *   - **Anonymous-fähig** (getAuthContext(req, true)). Keine
 *     Permission-Gate — Downloads sind für alle auth-erreichbaren
 *     Kontexte offen, auch Draft-Status.
 *   - **Kein Audit-Log-Entry** beim Download. Bewusst weggelassen, weil
 *     der Download-Pfad auf dem anonymen Lesemodus laufen kann und ein
 *     Audit-Entry pro GET das Log mit Noise fluten würde. Bei
 *     Pilotbetrieb mit höherer Compliance-Anforderung evtl. zu
 *     überarbeiten (siehe C4b-Meta-Review-Notiz).
 *   - **Content-Type implizit** durch res.sendFile + MIME-Detection
 *     (.json → application/json). Kein expliziter Header.
 *   - **Content-Disposition explizit** als attachment mit
 *     filename*=UTF-8''${encodedName}, damit UTF-8-Filenames sauber
 *     durchgereicht werden.
 *   - **E2E-Lücke**: Der Download-Endpoint wird von keinem Playwright-
 *     Szenario direkt getestet. Die Frontend-Konsumenten
 *     (handleDownloadRegisteredExport in useEvidenceHandlers +
 *     handleDownloadJobArtifact) sind ebenfalls ungecovert. C4b-
 *     Meta-Review-Kandidat mit mittel-hoher Priorität, weil der Pfad
 *     für Audit-Pack-, Certification-Dossier- und Handover-Bundle-
 *     Exports genutzt wird — Compliance-Impact bei Ausfall.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { createId, httpError, nowIso, slugify } from './ids.js';
import { sanitizeArray, sanitizeExportPackageType } from './sanitizers.js';
import {
  appendAuditLog,
  readExportLog,
  tenantPaths,
  writeExportLog,
  writeJsonFile,
} from './persistence-wrappers.js';
import { computeSha256 } from './file-utils.js';

export function buildExportDownloadUrl(exportId, fileName = '') {
  const requestedName = fileName || `${exportId}.json`;
  return `/api/exports/${encodeURIComponent(exportId)}/download?download=${encodeURIComponent(requestedName)}`;
}

export function presentExportEntry(entry) {
  return {
    ...entry,
    downloadUrl: buildExportDownloadUrl(entry.id, entry.fileName),
  };
}

export async function listExportEntries(tenantId) {
  return sanitizeArray(await readExportLog(tenantId))
    .sort((left, right) => String(right?.createdAt || '').localeCompare(String(left?.createdAt || '')))
    .map((entry) => presentExportEntry(entry));
}

export async function persistExportPackage(tenantId, authContext, payload) {
  const type = sanitizeExportPackageType(String(payload?.type || 'state_snapshot').trim());
  const title = String(payload?.title || '').trim() || 'Exportpaket';
  const note = String(payload?.note || '').trim();
  const signOffName = String(payload?.signOffName || '').trim();
  const signOffRole = String(payload?.signOffRole || '').trim();
  const moduleId = String(payload?.moduleId || '').trim();
  const moduleName = String(payload?.moduleName || '').trim();
  const companyName = String(payload?.companyName || '').trim();
  const relatedSnapshotId = String(payload?.relatedSnapshotId || '').trim();
  const sections = sanitizeArray(payload?.sections).filter((value) => typeof value === 'string' && value.trim()).map((value) => String(value).trim());
  const createdAt = nowIso();
  const exportId = createId('exp');
  const baseName = slugify(title) || type;
  const fileName = `${baseName}-${createdAt.slice(0, 10)}.json`;
  const filePayload = {
    meta: {
      id: exportId,
      tenantId,
      type,
      title,
      note,
      moduleId,
      moduleName,
      companyName,
      signOffName,
      signOffRole,
      relatedSnapshotId,
      createdAt,
      createdBy: authContext.account.id,
      userName: authContext.account.name,
      sections,
      manifestVersion: 1,
    },
    payload: payload?.payload ?? {},
  };

  const paths = tenantPaths(tenantId);
  const targetPath = path.join(paths.exportsDir, `${exportId}.json`);
  await writeJsonFile(targetPath, filePayload);
  const checksumSha256 = await computeSha256(targetPath);
  const stat = await fs.stat(targetPath);
  const entry = {
    id: exportId,
    tenantId,
    type,
    title,
    note,
    moduleId,
    moduleName,
    companyName,
    createdAt,
    createdBy: authContext.account.id,
    userName: authContext.account.name,
    signOffName,
    signOffRole,
    releaseStatus: 'draft',
    releasedAt: '',
    releasedBy: '',
    releaseNote: '',
    checksumSha256,
    sizeKb: Math.round((stat.size / 1024) * 10) / 10,
    fileName,
    downloadUrl: buildExportDownloadUrl(exportId, fileName),
    relatedSnapshotId: relatedSnapshotId || undefined,
    sections,
  };

  const exportLog = await readExportLog(tenantId);
  exportLog.unshift(entry);
  await writeExportLog(tenantId, exportLog);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: createdAt,
    userId: authContext.account.id,
    userName: authContext.account.name,
    action: 'Exportpaket erzeugt',
    resource: 'export',
    summary: `Exportpaket „${title}" (${type}) wurde registriert.`,
    sections: ['exports'],
  });

  return presentExportEntry(entry);
}

/**
 * Setzt ein Export-Paket auf releaseStatus='released' und schreibt
 * einen Audit-Log-Entry. Permissions-Gate liegt im Route-Handler
 * (sieht den Entry-Type vor dem Aufruf).
 *
 * Wirft 404, wenn das Export-Paket nicht existiert. Das Permission-
 * Gating muss VOR dem Aufruf erfolgen, sonst werden unautorisierte
 * Aufrufer mit 404 statt 403 beantwortet (Security-by-Obscurity
 * unerwünscht).
 */
export async function releaseExportPackage(tenantId, authContext, exportId, releaseNote = '') {
  const exportLog = await readExportLog(tenantId);
  const exportIndex = exportLog.findIndex((entry) => entry?.id === exportId);
  if (exportIndex < 0) {
    throw httpError(404, 'Exportpaket wurde nicht gefunden.');
  }

  const currentEntry = exportLog[exportIndex];
  const releasedAt = nowIso();
  exportLog[exportIndex] = {
    ...currentEntry,
    releaseStatus: 'released',
    releasedAt,
    releasedBy: authContext.account.name,
    releaseNote: String(releaseNote || '').trim(),
  };
  await writeExportLog(tenantId, exportLog);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: releasedAt,
    userId: authContext.account.id,
    userName: authContext.account.name,
    action: 'Exportpaket freigegeben',
    resource: 'export',
    summary: `Exportpaket „${currentEntry.title || currentEntry.id}" wurde freigegeben.`,
    sections: ['exports'],
  });

  return presentExportEntry(exportLog[exportIndex]);
}

/**
 * Liefert für den Download-Handler den validierten File-Pfad und den
 * vorgeschlagenen Response-Dateinamen.
 *
 * **Security**: Die Zeile
 *    `path.basename(rawExportId).replace(/\.json$/i, '')`
 * ist die Verteidigungslinie gegen **Path-Traversal-Angriffe**. Ein
 * Angreifer könnte sonst via `../../system/auth.json` oder
 * `../evidence/...` in andere Tenant-Verzeichnisse oder Systemdateien
 * eindringen. `path.basename` entfernt alle Pfad-Segmente; das
 * `.replace`-Idiom normalisiert eine optional mitgeschickte Extension.
 *
 * **Jede Vereinfachung dieser Zeile ohne Security-Review öffnet eine
 * Sicherheitslücke.** Security-relevanter Code, dessen Begründung
 * über den Code selbst hinausgeht.
 *
 * Wirft 404, wenn die erwartete Artefakt-Datei nicht (mehr) auf der
 * Platte liegt. Das ist auch bei Orphan-Registry-Einträgen der Fall
 * (Artefakt-Datei wurde manuell gelöscht, Registry-Eintrag blieb).
 */
export async function readExportArtifact(tenantId, rawExportId) {
  const exportId = path.basename(rawExportId).replace(/\.json$/i, '');
  const exportEntry = sanitizeArray(await readExportLog(tenantId)).find((entry) => entry?.id === exportId);
  const filePath = path.join(tenantPaths(tenantId).exportsDir, `${exportId}.json`);
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw httpError(404, 'Exportdatei wurde nicht gefunden.');
  }
  return {
    filePath,
    fileName: exportEntry?.fileName || `${exportId}.json`,
  };
}
