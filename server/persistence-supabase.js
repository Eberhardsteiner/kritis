import fs from 'node:fs/promises';
import path from 'node:path';

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw, fallback) {
  try {
    if (raw === null || raw === undefined || raw === '') {
      return fallback;
    }
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
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

function requireEnv(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} fehlt.`);
  }
  return normalized;
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value || ''));
}

function mapSupabaseError(payload, fallbackMessage) {
  const message = typeof payload?.message === 'string'
    ? payload.message
    : (typeof payload?.error_description === 'string' ? payload.error_description : fallbackMessage);
  const error = new Error(message || fallbackMessage);

  if (typeof message === 'string' && message.startsWith('VERSION_CONFLICT|')) {
    const [, version, updatedAt] = message.split('|');
    error.code = 'VERSION_CONFLICT';
    error.currentVersion = Number(version || 0);
    error.currentUpdatedAt = String(updatedAt || '');
  }

  error.details = Array.isArray(payload?.details) ? payload.details : undefined;
  error.status = Number(payload?.status || 500);
  return error;
}

export class SupabaseDocumentPersistence {
  constructor(config, logger = console) {
    this.driver = 'supabase-rest-store';
    this.targetPath = config.url;
    this.logger = logger;
    this.available = true;
    this.url = requireEnv(config.url, 'KRISENFEST_SUPABASE_URL');
    this.key = requireEnv(config.serviceRoleKey, 'KRISENFEST_SUPABASE_SERVICE_ROLE_KEY');
    this.schema = String(config.schema || 'public').trim() || 'public';
    this.headers = {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
      accept: 'application/json',
      'content-type': 'application/json',
      'accept-profile': this.schema,
      'content-profile': this.schema,
    };
  }

  async initialize() {
    return this;
  }

  async close() {
    return undefined;
  }

  getScopeParts(ref) {
    if (ref.kind === 'system') {
      return { scopeKind: 'system', scopeId: 'system', namespace: ref.namespace };
    }

    return { scopeKind: 'tenant', scopeId: ref.tenantId, namespace: ref.namespace };
  }

  async request(relativePath, init = {}, { allowEmpty = false } = {}) {
    const response = await fetch(`${this.url}${relativePath}`, {
      ...init,
      headers: {
        ...this.headers,
        ...(init.headers || {}),
      },
    });

    const text = await response.text();
    const payload = text ? parseJson(text, text) : (allowEmpty ? null : {});
    if (!response.ok) {
      const error = mapSupabaseError(typeof payload === 'object' ? payload : { message: String(payload || '') }, `Supabase-Fehler ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  async getDocumentRow(ref) {
    const { scopeKind, scopeId, namespace } = this.getScopeParts(ref);
    const path = `/rest/v1/krisenfest_documents?select=payload_json,version,updated_at&scope_kind=eq.${encodeFilterValue(scopeKind)}&scope_id=eq.${encodeFilterValue(scopeId)}&namespace=eq.${encodeFilterValue(namespace)}&limit=1`;
    const payload = await this.request(path, { method: 'GET' });
    return Array.isArray(payload) && payload.length ? payload[0] : null;
  }

  async hasDocument(ref) {
    return Boolean(await this.getDocumentRow(ref));
  }

  async readDocument(ref, fallback, options = {}) {
    const row = await this.getDocumentRow(ref);
    if (!row) {
      return {
        value: fallback,
        version: 0,
        updatedAt: '',
        source: 'fallback',
      };
    }

    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, parseJson(row.payload_json, fallback));
    }

    return {
      value: parseJson(row.payload_json, fallback),
      version: Number(row.version || 0),
      updatedAt: String(row.updated_at || ''),
      source: 'database',
    };
  }

  async getDocumentMeta(ref) {
    const row = await this.getDocumentRow(ref);
    if (!row) {
      return null;
    }
    return {
      version: Number(row.version || 0),
      updatedAt: String(row.updated_at || ''),
    };
  }

  async writeDocument(ref, value, options = {}) {
    const { scopeKind, scopeId, namespace } = this.getScopeParts(ref);
    const payload = await this.request('/rest/v1/rpc/krisenfest_upsert_document', {
      method: 'POST',
      body: JSON.stringify({
        p_scope_kind: scopeKind,
        p_scope_id: scopeId,
        p_namespace: namespace,
        p_payload_json: value,
        p_expected_version: Number.isFinite(options.expectedVersion) ? Number(options.expectedVersion) : null,
        p_updated_at: options.updatedAt || nowIso(),
      }),
    });

    const row = Array.isArray(payload) ? payload[0] : payload;
    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, value);
    }

    return {
      value: parseJson(row?.payload_json, value),
      version: Number(row?.version || 0),
      updatedAt: String(row?.updated_at || options.updatedAt || nowIso()),
    };
  }

  async listAuditEvents(tenantId, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 300), 1000));
    const path = `/rest/v1/krisenfest_audit_events?select=payload_json&tenant_id=eq.${encodeFilterValue(tenantId)}&order=sequence.desc&limit=${limit}`;
    const payload = await this.request(path, { method: 'GET' });
    return Array.isArray(payload)
      ? payload.map((row) => parseJson(row?.payload_json, null)).filter(Boolean)
      : [];
  }

  async appendAuditEvent(tenantId, entry, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 300), 1000));
    const payload = await this.request('/rest/v1/rpc/krisenfest_append_audit_event', {
      method: 'POST',
      body: JSON.stringify({
        p_tenant_id: tenantId,
        p_event: entry,
        p_limit: limit,
      }),
    });

    const entries = Array.isArray(payload)
      ? payload.map((row) => parseJson(row?.payload_json, null)).filter(Boolean)
      : [];

    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, entries);
    }
    return entries;
  }

  async replaceAuditEvents(tenantId, entries, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 300), 1000));
    const normalizedEntries = Array.isArray(entries) ? entries.slice(0, limit) : [];
    const payload = await this.request('/rest/v1/rpc/krisenfest_replace_audit_events', {
      method: 'POST',
      body: JSON.stringify({
        p_tenant_id: tenantId,
        p_entries: normalizedEntries,
        p_limit: limit,
      }),
    });

    const result = Array.isArray(payload)
      ? payload.map((row) => parseJson(row?.payload_json, null)).filter(Boolean)
      : [];

    if (options.mirrorPath) {
      await writeJsonToDisk(options.mirrorPath, result);
    }
    return result;
  }
}

export function hasSupabasePersistenceConfig(env = process.env) {
  return Boolean(String(env.KRISENFEST_SUPABASE_URL || '').trim() && String(env.KRISENFEST_SUPABASE_SERVICE_ROLE_KEY || '').trim());
}

export function readSupabasePersistenceConfig(env = process.env) {
  return {
    url: String(env.KRISENFEST_SUPABASE_URL || '').trim(),
    serviceRoleKey: String(env.KRISENFEST_SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    schema: String(env.KRISENFEST_SUPABASE_SCHEMA || 'public').trim() || 'public',
  };
}
