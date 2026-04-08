import fs from "node:fs/promises";
import path from "node:path";

function requireEnv(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} fehlt.`);
  }
  return normalized;
}

function sanitizeSegment(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
}

async function readBuffer(filePath) {
  return fs.readFile(filePath);
}

export class LocalObjectStorage {
  constructor(config = {}) {
    this.driver = 'filesystem';
    this.baseDir = config.baseDir;
    this.targetPath = this.baseDir;
  }

  async initialize() {
    await fs.mkdir(this.baseDir, { recursive: true });
    return this;
  }

  resolvePath(storedFileName) {
    return path.join(this.baseDir, path.basename(String(storedFileName || '')));
  }

  async storeTempFile(tempFilePath, { storedFileName }) {
    const targetPath = this.resolvePath(storedFileName);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rename(tempFilePath, targetPath);
    const stat = await fs.stat(targetPath);
    return {
      driver: this.driver,
      objectKey: path.basename(storedFileName),
      sizeBytes: stat.size,
    };
  }

  async removeObject({ storedFileName }) {
    await fs.unlink(this.resolvePath(storedFileName)).catch(() => undefined);
  }

  async getDownloadPayload({ storedFileName }) {
    const filePath = this.resolvePath(storedFileName);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile()) {
      const error = new Error('Datei wurde nicht gefunden.');
      error.status = 404;
      throw error;
    }
    return { type: 'file', filePath };
  }
}

export class SupabaseObjectStorage {
  constructor(config = {}) {
    this.driver = 'supabase-storage';
    this.url = requireEnv(config.url, 'KRISENFEST_SUPABASE_URL');
    this.key = requireEnv(config.serviceRoleKey, 'KRISENFEST_SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = requireEnv(config.bucket, 'KRISENFEST_SUPABASE_STORAGE_BUCKET');
    this.prefix = sanitizeSegment(config.pathPrefix || 'krisenfest-evidence');
    this.targetPath = `${this.url}/storage/v1/object/${this.bucket}/${this.prefix}`;
    this.headers = {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
    };
  }

  async initialize() {
    return this;
  }

  buildObjectPath(tenantId, storedFileName) {
    const tenantPart = sanitizeSegment(tenantId || 'public');
    return `${this.prefix}/${tenantPart}/${path.basename(String(storedFileName || ''))}`;
  }

  async request(relativePath, init = {}) {
    const response = await fetch(`${this.url}${relativePath}`, {
      ...init,
      headers: {
        ...this.headers,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(text || `Supabase Storage Fehler ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  }

  async storeTempFile(tempFilePath, { tenantId, storedFileName, mimeType = 'application/octet-stream' }) {
    const objectPath = this.buildObjectPath(tenantId, storedFileName);
    const payload = await readBuffer(tempFilePath);
    await this.request(`/storage/v1/object/${this.bucket}/${encodeURI(objectPath)}`.replace(/%5C/g, '/'), {
      method: 'POST',
      headers: {
        'content-type': mimeType,
        'x-upsert': 'true',
      },
      body: payload,
    });
    return {
      driver: this.driver,
      objectKey: objectPath,
      sizeBytes: payload.byteLength,
    };
  }

  async removeObject({ tenantId, storedFileName, objectKey }) {
    const resolvedKey = objectKey || this.buildObjectPath(tenantId, storedFileName);
    await this.request('/storage/v1/object/' + this.bucket, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [resolvedKey] }),
    }).catch(() => undefined);
  }

  async getDownloadPayload({ tenantId, storedFileName, objectKey }) {
    const resolvedKey = objectKey || this.buildObjectPath(tenantId, storedFileName);
    const response = await this.request(`/storage/v1/object/authenticated/${this.bucket}/${encodeURI(resolvedKey)}`.replace(/%5C/g, '/'), {
      method: 'GET',
    });
    const arrayBuffer = await response.arrayBuffer();
    return {
      type: 'buffer',
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    };
  }
}

export function hasSupabaseObjectStorageConfig(env = process.env) {
  return Boolean(
    String(env.KRISENFEST_SUPABASE_URL || '').trim()
    && String(env.KRISENFEST_SUPABASE_SERVICE_ROLE_KEY || '').trim()
    && String(env.KRISENFEST_SUPABASE_STORAGE_BUCKET || '').trim()
  );
}


export function readSupabaseObjectStorageConfig(env = process.env) {
  return {
    url: String(env.KRISENFEST_SUPABASE_URL || '').trim(),
    serviceRoleKey: String(env.KRISENFEST_SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    bucket: String(env.KRISENFEST_SUPABASE_STORAGE_BUCKET || '').trim(),
    pathPrefix: String(env.KRISENFEST_SUPABASE_STORAGE_PREFIX || 'krisenfest-evidence').trim() || 'krisenfest-evidence',
  };
}

export async function createObjectStorage(config = {}, logger = console) {
  if (config.supabase && hasSupabaseObjectStorageConfig(config.supabase)) {
    try {
      return await new SupabaseObjectStorage(config.supabase).initialize();
    } catch (error) {
      logger?.warn?.('Supabase Object Storage konnte nicht initialisiert werden, lokaler Speicher wird genutzt.', error);
    }
  }
  return await new LocalObjectStorage({ baseDir: config.localDir }).initialize();
}
