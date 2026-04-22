/**
 * file-utils.js · Generische Datei-I/O-Helper.
 *
 * Eingeführt in C3.2. Kleine Utility-Datei, die Datei-Operationen
 * bündelt, die vom Export-Service (C3.2) UND vom Evidence-Service
 * (C3.4) genutzt werden. Statt die Funktion in einem der beiden
 * Service-Module zu duplizieren oder per Cross-Service-Import zu
 * verknüpfen, lebt sie hier als eigene kleine Utility-Schicht.
 *
 * Scope bewusst klein gehalten: nur echte I/O-Utilities, die in mehr
 * als einem Service gebraucht werden. Keine Sanitizer (→ sanitizers.js),
 * keine JSON-Fassaden (→ persistence-wrappers.js), keine Domain-Logik.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

/**
 * Berechnet den SHA-256-Hash einer Datei (hex-kodiert).
 *
 * Wird von services/exports.js (C3.2, Artefakt-Checksum beim
 * Export-Package-Write) und services/evidence.js (C3.4,
 * Attachment-Integrität) konsumiert.
 */
export async function computeSha256(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Baut die URL für Downloads aus dem File-Endpoint unter /api/files/.
 * Pure String-Konstruktion, kein I/O.
 *
 * Eingeführt in C3.4. Wird von services/evidence.js (Attachment-URLs,
 * Version-Download-Links, Ledger-Summary) konsumiert. Zukünftige
 * Konsumenten (Snapshot-Download, Export-Inline-Links) nutzen denselben
 * Builder statt eigener URL-Templates. Die Download-Semantik (filename-
 * als-download-query) ist damit an einer Stelle zentralisiert.
 */
export function buildDownloadUrl(storedFileName, originalName = '') {
  const filePart = encodeURIComponent(storedFileName);
  const namePart = encodeURIComponent(originalName || storedFileName);
  return `/api/files/${filePart}?download=${namePart}`;
}
