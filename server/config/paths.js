/**
 * paths.js · Zentrale Pfad-Konstanten für den Server-Storage-Layer.
 *
 * Extrahiert in C3.0a aus server/index.js (Zeilen 70-93). Diese
 * Konstanten definieren die Verzeichnis- und Dateipfade, auf denen
 * die server-seitige Persistenz-Schicht operiert:
 *   - systemweite Datei-Collections (tenants.json, auth.json,
 *     sessions.json, pending-auth-flows.json,
 *     auth-callback-tickets.json, platform-settings.json,
 *     api-clients.json, job-runs.json, krisenfest.sqlite)
 *   - Tenant-Verzeichnis + Artefakt-Ordner (job-artifacts)
 *   - Upload-Tmp-Verzeichnis
 *   - Legacy-Pfade für die Storage-Migration (state.json,
 *     audit-log.json, uploads/, snapshots/)
 *
 * Bewusst in `server/config/` (nicht `server/services/`) abgelegt:
 * Pfade sind Konfiguration, keine Service-Logik. Die spätere
 * Migration auf Umgebungsvariablen (z.B. KRISENFEST_STORAGE_DIR)
 * hat damit einen klaren Einhak-Punkt.
 *
 * Konsumenten: persistence-wrappers (C3.0b), storage-init (C3.6),
 * system-summaries (C3.6), evidence-service (C3.4). Das
 * Bootstrap-Modul server/index.js importiert von hier und reicht
 * die Konstanten nicht mehr als Parameter weiter.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/config/paths.js liegt zwei Verzeichnisebenen unter dem Repo-Root.
export const rootDir = path.resolve(__dirname, '..', '..');
export const storageDir = path.join(rootDir, 'server-storage');
export const systemDir = path.join(storageDir, 'system');
export const tenantsDir = path.join(storageDir, 'tenants');
export const globalTmpDir = path.join(storageDir, 'tmp');

export const tenantsFile = path.join(systemDir, 'tenants.json');
export const accountsFile = path.join(systemDir, 'auth.json');
export const sessionsFile = path.join(systemDir, 'sessions.json');
export const pendingAuthFlowsFile = path.join(systemDir, 'pending-auth-flows.json');
export const authCallbackTicketsFile = path.join(systemDir, 'auth-callback-tickets.json');
export const platformSettingsFile = path.join(systemDir, 'platform-settings.json');
export const apiClientsFile = path.join(systemDir, 'api-clients.json');
export const jobsFile = path.join(systemDir, 'job-runs.json');
export const jobsArtifactsDir = path.join(systemDir, 'job-artifacts');
export const persistenceDbFile = path.join(systemDir, 'krisenfest.sqlite');

// Legacy-Pfade für die einmalige Migration beim ersten Start (siehe
// migrateLegacyStorageIfNeeded in server/index.js).
export const legacyStateFile = path.join(storageDir, 'state.json');
export const legacyAuditLogFile = path.join(storageDir, 'audit-log.json');
export const legacyUploadsDir = path.join(storageDir, 'uploads');
export const legacySnapshotsDir = path.join(storageDir, 'snapshots');
