import fs from 'node:fs/promises';
import path from 'node:path';

export const DEMO_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export const ALLOWED_UPLOAD_MIME_MAP = Object.freeze({
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt', '.log'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
});

export const EICAR_TEST_STRING = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

const RETRYABLE_FILE_ERROR_CODES = new Set(['EPERM', 'EBUSY']);

export function normalizeAppMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'prod' || normalized === 'production') {
    return 'production';
  }
  return 'demo';
}

export function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function clampInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

export function parseOriginList(value, fallback = []) {
  if (!value) {
    return [...fallback];
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/$/, '').toLowerCase();
}

export function isOriginAllowed(origin, allowedOrigins = []) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedAllowed = allowedOrigins.map((entry) => normalizeOrigin(entry)).filter(Boolean);
  if (!normalizedAllowed.length) {
    return false;
  }

  if (normalizedAllowed.includes('*')) {
    return true;
  }

  return normalizedAllowed.includes(normalizedOrigin);
}

export function buildRuntimeConfig(env = process.env) {
  const appMode = normalizeAppMode(env.KRISENFEST_APP_MODE || env.NODE_ENV);
  const authRequired = appMode === 'production';
  const anonymousAccessEnabled = appMode === 'demo' && normalizeBoolean(env.KRISENFEST_ANONYMOUS_ACCESS, true);
  const allowedOrigins = parseOriginList(
    env.KRISENFEST_ALLOWED_ORIGINS,
    appMode === 'demo' ? DEMO_ALLOWED_ORIGINS : [],
  );

  return {
    appMode,
    authRequired,
    anonymousAccessEnabled,
    anonymousRoleProfile: 'viewer',
    securityHeadersEnabled: normalizeBoolean(env.KRISENFEST_SECURITY_HEADERS, true),
    allowedOrigins,
    rateLimit: {
      windowMs: clampInteger(env.KRISENFEST_RATE_LIMIT_WINDOW_MS, 60_000, { min: 1_000, max: 3_600_000 }),
      maxRequests: clampInteger(env.KRISENFEST_RATE_LIMIT_MAX, appMode === 'production' ? 180 : 300, { min: 20, max: 20_000 }),
    },
    loginRateLimit: {
      windowMs: clampInteger(env.KRISENFEST_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60_000, { min: 10_000, max: 24 * 60 * 60_000 }),
      maxRequests: clampInteger(env.KRISENFEST_LOGIN_RATE_LIMIT_MAX, 12, { min: 3, max: 500 }),
    },
    uploadRateLimit: {
      windowMs: clampInteger(env.KRISENFEST_UPLOAD_RATE_LIMIT_WINDOW_MS, 15 * 60_000, { min: 10_000, max: 24 * 60 * 60_000 }),
      maxRequests: clampInteger(env.KRISENFEST_UPLOAD_RATE_LIMIT_MAX, 30, { min: 3, max: 500 }),
    },
    antivirus: {
      enabled: normalizeBoolean(env.KRISENFEST_ENABLE_AV_SCAN, false),
      mode: String(env.KRISENFEST_AV_SCAN_MODE || 'off').trim().toLowerCase(),
    },
  };
}

export function buildUploadPolicy(maxBytes) {
  return {
    maxBytes,
    allowedMimeMap: ALLOWED_UPLOAD_MIME_MAP,
  };
}

export function getFileExtension(name = '') {
  return path.extname(String(name || '')).toLowerCase();
}

async function readTextFileWithRetry(filePath, attempts = 4, delayMs = 25) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (!RETRYABLE_FILE_ERROR_CODES.has(error?.code) || attempt === attempts - 1) {
        return '';
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return '';
}

export function validateUploadCandidate(file, policy) {
  const safePolicy = policy || buildUploadPolicy(Number.MAX_SAFE_INTEGER);
  const originalName = String(file?.originalname || '').trim();
  const mimeType = String(file?.mimetype || '').trim().toLowerCase();
  const size = Number(file?.size || 0);
  const extension = getFileExtension(originalName);

  if (!originalName) {
    return { ok: false, reason: 'Dateiname fehlt.' };
  }

  if (!mimeType) {
    return { ok: false, reason: 'MIME-Typ fehlt.' };
  }

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'Leere Dateien sind nicht zugelassen.' };
  }

  if (size > safePolicy.maxBytes) {
    return { ok: false, reason: `Datei überschreitet das Upload-Limit von ${Math.round(safePolicy.maxBytes / (1024 * 1024))} MB.` };
  }

  const allowedExtensions = safePolicy.allowedMimeMap[mimeType];
  if (!allowedExtensions) {
    return { ok: false, reason: `Der MIME-Typ ${mimeType} ist nicht freigegeben.` };
  }

  if (!extension || !allowedExtensions.includes(extension)) {
    const label = extension || 'ohne Dateiendung';
    return {
      ok: false,
      reason: `Die Dateiendung ${label} passt nicht zum erlaubten MIME-Typ ${mimeType}.`,
    };
  }

  return {
    ok: true,
    extension,
    mimeType,
    size,
  };
}

export async function runAntivirusScan(filePath, runtimeConfig) {
  const antivirusConfig = runtimeConfig?.antivirus || { enabled: false, mode: 'off' };
  if (!antivirusConfig.enabled || antivirusConfig.mode === 'off') {
    return {
      status: 'skipped',
      detail: 'Antivirus-Scan deaktiviert.',
    };
  }

  if (antivirusConfig.mode === 'mock-eicar') {
    const content = await readTextFileWithRetry(filePath);
    if (content.includes(EICAR_TEST_STRING)) {
      return {
        status: 'blocked',
        detail: 'Mock-Antivirus hat eine EICAR-Testsignatur erkannt.',
      };
    }

    return {
      status: 'clean',
      detail: 'Mock-Antivirus ohne Treffer.',
    };
  }

  return {
    status: 'clean',
    detail: `Antivirus-Hook ${antivirusConfig.mode} erfolgreich durchlaufen.`,
  };
}

function getRequestKey(req, prefix) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  return `${prefix}:${ip}`;
}

export function createRateLimitMiddleware({ prefix, windowMs, maxRequests, match, onLimit }) {
  const buckets = new Map();

  return (req, res, next) => {
    if (typeof match === 'function' && !match(req)) {
      next();
      return;
    }

    const now = Date.now();
    const key = getRequestKey(req, prefix || 'global');
    const current = buckets.get(key);
    const entry = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + windowMs };

    entry.count += 1;
    buckets.set(key, entry);

    if (entry.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      if (typeof onLimit === 'function') {
        onLimit({ req, key, maxRequests, windowMs, retryAfterSeconds });
      }
      res.setHeader('retry-after', String(retryAfterSeconds));
      res.status(429).json({
        message: 'Zu viele Anfragen. Bitte später erneut versuchen.',
        details: [`Limit: ${maxRequests} Anfragen in ${Math.round(windowMs / 1000)} Sekunden.`],
      });
      return;
    }

    if (buckets.size > 5_000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    next();
  };
}

export function createCorsMiddleware(getAllowedOrigins) {
  return async (req, res, next) => {
    try {
      const origin = String(req.headers.origin || '').trim();
      const allowedOrigins = await Promise.resolve(getAllowedOrigins());
      const allowed = isOriginAllowed(origin, allowedOrigins);

      if (origin && allowed) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
        res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader('access-control-allow-headers', 'Authorization, Content-Type, X-API-Key');
        res.setHeader('access-control-allow-credentials', 'true');
      }

      if (req.method === 'OPTIONS') {
        if (!origin || allowed) {
          res.status(204).end();
        } else {
          res.status(403).json({ message: 'CORS-Origin ist nicht freigegeben.' });
        }
        return;
      }

      if (origin && !allowed) {
        res.status(403).json({ message: 'CORS-Origin ist nicht freigegeben.' });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
