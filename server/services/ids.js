/**
 * ids.js · Pure ID-/Timestamp-/Error-Helper.
 *
 * Extrahiert in C3.0a aus server/index.js (Zeilen 280-298, 445-458).
 * Sechs kleine Pure-Funktionen ohne Abhängigkeit zur Domänen-Schicht:
 *   - nowIso: ISO-Zeitstempel für Audit-Einträge, Sessions etc.
 *   - createId: Präfix-basierte ID-Generation (Millis + Random).
 *   - slugify: URL-/ID-sichere Kleinschreibung, max. 70 Zeichen.
 *   - maskSecret: sichere Vorschau eines Geheimnisses für UI/Logs.
 *   - createApiClientSecret: 32-Byte-Hex-Secret mit `kfapi_`-Präfix.
 *   - httpError: Error-Factory mit Status und optionalen Details.
 *
 * Bewusst nicht in `services/sanitizers.js`: diese Helper sind
 * Foundation-Layer für alle Sanitizer UND für die Route-Handler.
 * Separater Import-Weg hält die Dep-DAG zyklusfrei.
 */
import crypto from 'node:crypto';

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß_.-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

export function createApiClientSecret() {
  return `kfapi_${crypto.randomBytes(24).toString('hex')}`;
}

export function maskSecret(secret) {
  return secret ? `${secret.slice(0, 8)}…${secret.slice(-4)}` : '';
}

export function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}
