/**
 * Maximale Dateigroessen fuer Evidenz-Attachments.
 *
 * - Local: In-Browser-DataURL (wird in evidenceItems[...].attachment
 *   gespeichert). Obergrenze klein gehalten, damit der localStorage nicht
 *   gesprengt wird -- Prototyp-Kompromiss.
 * - Server: multipart-Upload via /api/evidence/:id/attachment; der Wert
 *   muss zur server/index.js-Middleware passen.
 */
export const MAX_LOCAL_ATTACHMENT_BYTES = 450 * 1024;
export const MAX_SERVER_ATTACHMENT_BYTES = 12 * 1024 * 1024;
