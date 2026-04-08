import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { SupabaseDocumentPersistence, hasSupabasePersistenceConfig, readSupabasePersistenceConfig } from './persistence-supabase.js';

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function readJsonFromDisk(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonToDisk(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

class FileMirrorPersistence {
  constructor(targetPath) {
    this.driver = 'tenant-filesystem';
    this.targetPath = targetPath;
    this.available = false;
    this.metaFilePath = `${targetPath}.fallback-meta.json`;
    this.metaIndex = null;
  }

  getMetaKey(ref) {
    if (ref.kind === 'system') {
      return `system:${ref.namespace}`;
    }
    return `tenant:${ref.tenantId}:${ref.namespace}`;
  }

  async loadMetaIndex() {
    if (this.metaIndex) {
      return this.metaIndex;
    }

    this.metaIndex = await readJsonFromDisk(this.metaFilePath, {});
    if (!this.metaIndex || typeof this.metaIndex !== 'object' || Array.isArray(this.metaIndex)) {
      this.metaIndex = {};
    }
    return this.metaIndex;
  }

  async saveMetaIndex() {
    await writeJsonToDisk(this.metaFilePath, this.metaIndex || {});
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.targetPath), { recursive: true });
    await this.loadMetaIndex();
    return this;
  }

  async close() {
    return undefined;
  }

  async hasDocument(ref, options = {}) {
    const meta = await this.loadMetaIndex();
    if (meta[this.getMetaKey(ref)]) {
      return true;
    }
    return Boolean(options.mirrorPath && fsSync.existsSync(options.mirrorPath));
  }

  async readDocument(ref, fallback, options = {}) {
    const meta = await this.loadMetaIndex();
    const entry = meta[this.getMetaKey(ref)] || null;

    if (options.mirrorPath && fsSync.existsSync(options.mirrorPath)) {
      return {
        value: await readJsonFromDisk(options.mirrorPath, fallback),
        version: Number(entry?.version || 0),
        updatedAt: String(entry?.updatedAt || ''),
        source: 'mirror',
      };
    }

    return {
      value: fallback,
      version: Number(entry?.version || 0),
      updatedAt: String(entry?.updatedAt || ''),
      source: 'fallback',
    };
  }

  async writeDocument(ref, value, options = {}) {
    const meta = await this.loadMetaIndex();
    const key = this.getMetaKey(ref);
    const current = meta[key] || { version: 0, updatedAt: '' };
    const expectedVersion = options.expectedVersion;

    if (Number.isFinite(expectedVersion) && Number(expectedVersion) !== Number(current.version || 0)) {
      const error = new Error('Dokumentkonflikt: Zwischenstand wurde bereits geändert.');
      error.code = 'VERSION_CONFLICT';
      error.currentVersion = Number(current.version || 0);
      error.currentUpdatedAt = String(current.updatedAt || '');
      throw error;
    }

    const updatedAt = options.updatedAt || nowIso();
    const version = Number(current.version || 0) + 1;
    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, value);
    }

    meta[key] = { version, updatedAt };
    await this.saveMetaIndex();

    return {
      value,
      version,
      updatedAt,
    };
  }

  async listAuditEvents(_tenantId, _options = {}) {
    return [];
  }

  async appendAuditEvent(_tenantId, entry, options = {}) {
    if (options.mirrorPath) {
      const current = await readJsonFromDisk(options.mirrorPath, []);
      const nextEntries = [entry, ...Array.isArray(current) ? current : []].slice(0, options.limit || 300);
      await writeJsonToDisk(options.mirrorPath, nextEntries);
      return nextEntries;
    }
    return [entry];
  }

  async replaceAuditEvents(_tenantId, entries, options = {}) {
    const nextEntries = Array.isArray(entries) ? entries.slice(0, options.limit || 300) : [];
    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, nextEntries);
    }
    return nextEntries;
  }

  async getDocumentMeta(ref, options = {}) {
    const meta = await this.loadMetaIndex();
    const entry = meta[this.getMetaKey(ref)] || null;
    if (entry) {
      return {
        version: Number(entry.version || 0),
        updatedAt: String(entry.updatedAt || ''),
      };
    }

    if (options.mirrorPath && fsSync.existsSync(options.mirrorPath)) {
      const stat = await fs.stat(options.mirrorPath).catch(() => null);
      if (stat) {
        return {
          version: 0,
          updatedAt: stat.mtime?.toISOString?.() || '',
        };
      }
    }

    return null;
  }
}

class SqliteDocumentPersistence {
  constructor(dbPath, DatabaseSync, logger = console) {
    this.driver = 'sqlite-document-store';
    this.targetPath = dbPath;
    this.DatabaseSync = DatabaseSync;
    this.logger = logger;
    this.available = true;
    this.db = null;
  }

  initializeDatabase() {
    if (this.db) {
      return;
    }

    this.db = new this.DatabaseSync(this.targetPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS documents (
        scope_kind TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (scope_kind, scope_id, namespace)
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_sequence
      ON audit_events (tenant_id, sequence DESC);
    `);
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.targetPath), { recursive: true });
    this.initializeDatabase();
    return this;
  }

  async close() {
    if (!this.db) {
      return;
    }

    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // Best effort before closing on platforms that keep WAL files locked.
    }

    if (typeof this.db.close === 'function') {
      this.db.close();
    }
    this.db = null;
  }

  getScopeParts(ref) {
    if (ref.kind === 'system') {
      return { scopeKind: 'system', scopeId: 'system', namespace: ref.namespace };
    }

    return { scopeKind: 'tenant', scopeId: ref.tenantId, namespace: ref.namespace };
  }

  getDocumentRow(ref) {
    this.initializeDatabase();
    const { scopeKind, scopeId, namespace } = this.getScopeParts(ref);
    const statement = this.db.prepare(`
      SELECT payload_json, version, updated_at
      FROM documents
      WHERE scope_kind = ? AND scope_id = ? AND namespace = ?
      LIMIT 1
    `);
    return statement.get(scopeKind, scopeId, namespace) || null;
  }

  async hasDocument(ref) {
    return Boolean(this.getDocumentRow(ref));
  }

  async readDocument(ref, fallback) {
    const row = this.getDocumentRow(ref);
    if (!row) {
      return {
        value: fallback,
        version: 0,
        updatedAt: '',
        source: 'fallback',
      };
    }

    return {
      value: parseJson(row.payload_json, fallback),
      version: Number(row.version || 0),
      updatedAt: String(row.updated_at || ''),
      source: 'database',
    };
  }

  async getDocumentMeta(ref) {
    const row = this.getDocumentRow(ref);
    if (!row) {
      return null;
    }

    return {
      version: Number(row.version || 0),
      updatedAt: String(row.updated_at || ''),
    };
  }

  async writeDocument(ref, value, options = {}) {
    this.initializeDatabase();
    const { scopeKind, scopeId, namespace } = this.getScopeParts(ref);
    const current = this.getDocumentRow(ref);
    const expectedVersion = options.expectedVersion;

    if (Number.isFinite(expectedVersion) && Number(expectedVersion) !== Number(current?.version || 0)) {
      const error = new Error('Dokumentkonflikt: Zwischenstand wurde bereits geändert.');
      error.code = 'VERSION_CONFLICT';
      error.currentVersion = Number(current?.version || 0);
      error.currentUpdatedAt = String(current?.updated_at || '');
      throw error;
    }

    const nextVersion = current ? Number(current.version) + 1 : 1;
    const updatedAt = options.updatedAt || nowIso();
    const payloadJson = JSON.stringify(value);
    const statement = this.db.prepare(`
      INSERT INTO documents (scope_kind, scope_id, namespace, payload_json, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(scope_kind, scope_id, namespace)
      DO UPDATE SET payload_json = excluded.payload_json, version = excluded.version, updated_at = excluded.updated_at
    `);
    statement.run(scopeKind, scopeId, namespace, payloadJson, nextVersion, updatedAt);

    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, value);
    }

    return {
      value,
      version: nextVersion,
      updatedAt,
    };
  }

  async listAuditEvents(tenantId, options = {}) {
    this.initializeDatabase();
    const limit = Math.max(1, Math.min(Number(options.limit || 300), 1000));
    const rows = this.db.prepare(`
      SELECT payload_json
      FROM audit_events
      WHERE tenant_id = ?
      ORDER BY sequence DESC
      LIMIT ?
    `).all(tenantId, limit);

    return rows.map((row) => parseJson(row.payload_json, null)).filter(Boolean);
  }

  async appendAuditEvent(tenantId, entry, options = {}) {
    this.initializeDatabase();
    const createdAt = String(entry?.at || options.updatedAt || nowIso());
    this.db.prepare(`
      INSERT INTO audit_events (tenant_id, event_id, created_at, payload_json)
      VALUES (?, ?, ?, ?)
    `).run(tenantId, String(entry?.id || ''), createdAt, JSON.stringify(entry));

    const limit = Math.max(1, Math.min(Number(options.limit || 300), 1000));
    this.db.prepare(`
      DELETE FROM audit_events
      WHERE tenant_id = ?
        AND sequence NOT IN (
          SELECT sequence
          FROM audit_events
          WHERE tenant_id = ?
          ORDER BY sequence DESC
          LIMIT ?
        )
    `).run(tenantId, tenantId, limit);

    const entries = await this.listAuditEvents(tenantId, { limit });
    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, entries);
    }
    return entries;
  }

  async replaceAuditEvents(tenantId, entries, options = {}) {
    this.initializeDatabase();
    const normalizedEntries = Array.isArray(entries) ? entries.slice(0, options.limit || 300) : [];
    const deleteStatement = this.db.prepare('DELETE FROM audit_events WHERE tenant_id = ?');
    const insertStatement = this.db.prepare(`
      INSERT INTO audit_events (tenant_id, event_id, created_at, payload_json)
      VALUES (?, ?, ?, ?)
    `);

    this.db.exec('BEGIN');
    try {
      deleteStatement.run(tenantId);
      for (const entry of [...normalizedEntries].reverse()) {
        insertStatement.run(
          tenantId,
          String(entry?.id || ''),
          String(entry?.at || nowIso()),
          JSON.stringify(entry),
        );
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, normalizedEntries);
    }

    return normalizedEntries;
  }
}

export async function createPersistenceLayer({ dbPath, logger = console, forceFallback = false, env = process.env } = {}) {
  try {
    if (forceFallback) {
      throw new Error('Fallback-Persistenz explizit angefordert.');
    }

    if (hasSupabasePersistenceConfig(env)) {
      const config = readSupabasePersistenceConfig(env);
      logger?.info?.('KRITIS-Readiness Persistence: Supabase REST Store wird aktiviert.');
      const layer = new SupabaseDocumentPersistence(config, logger);
      await layer.initialize();
      return layer;
    }

    const sqliteModule = await import('node:sqlite');
    const DatabaseSync = sqliteModule?.DatabaseSync;
    if (!DatabaseSync) {
      throw new Error('node:sqlite ist in dieser Laufzeit nicht verfügbar.');
    }

    const layer = new SqliteDocumentPersistence(dbPath, DatabaseSync, logger);
    await layer.initialize();
    return layer;
  } catch (error) {
    logger?.warn?.(`KRITIS-Readiness Persistence: SQLite/Supabase nicht verfügbar, Fallback auf Dateispeicher. ${error instanceof Error ? error.message : String(error)}`);
    const fallback = new FileMirrorPersistence(dbPath);
    await fallback.initialize();
    return fallback;
  }
}

export async function readJsonFromDiskForTests(filePath, fallback) {
  return readJsonFromDisk(filePath, fallback);
}
