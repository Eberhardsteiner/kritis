/**
 * middleware-setup.js · Express-Middleware-Wiring + terminaler
 * Error-Handler für die Krisenfest-API.
 *
 * Extrahiert in C3.7b aus server/index.js (~100 Zeilen). Exportiert
 * zwei Funktionen:
 *
 *   - attachMiddleware(app):    registriert alle 11 Pre-Route-
 *     Middleware-Schritte (Express-App-Config + helmet + observability
 *     + request-hardening + cors + 3× rate-limit + json + cache-control)
 *     in byte-identischer Reihenfolge aus dem Ist-Code.
 *
 *   - attachErrorHandler(app):  registriert den terminalen
 *     Error-Handler mit 4-Parameter-Signatur (`(error, req, res, next)`),
 *     der VERSION_CONFLICT → HTTP 409 + `currentVersion` +
 *     `currentUpdatedAt`-Felder formt und Security-Events für alle
 *     Status >= 400 im observability-Store verzeichnet.
 *
 * ============================================================================
 *  AUFRUF-REIHENFOLGE · HARTE INVARIANTE
 * ============================================================================
 *
 *  `attachMiddleware(app)` MUSS **VOR** allen `register*Routes(app)`-
 *  Aufrufen laufen. `attachErrorHandler(app)` MUSS **NACH** allen
 *  Route-Registrierungen laufen.
 *
 *  **Diese Reihenfolge ist nicht verhandelbar — sie ist eine harte
 *  Invariante der Express-Architektur.**
 *
 *  Warum:
 *   - Pre-Route-Middleware greift pro Request, BEVOR Route-Handler
 *     laufen. Wenn sie nach Routes registriert wird, umgeht jeder
 *     Route-Handler die Middleware-Kette (Security-Header fehlen,
 *     Rate-Limits greifen nicht, CORS wird nicht geblockt).
 *   - Error-Handler mit 4-Parameter-Signatur werden von Express nur
 *     dann als Error-Handler erkannt, wenn sie NACH den Routes
 *     registriert sind. Vor Routes registriert → wirken als reguläre
 *     Middleware mit unused error-Param, dem tatsächlichen Error-Pfad
 *     entkoppelt.
 *
 *  Aufruf-Sequenz in server/index.js (byte-identisch seit C3.7b):
 *    const app = express();
 *    attachMiddleware(app);
 *    registerSystemRoutes(app);
 *    registerIntegrationRoutes(app);
 *    registerAuthRoutes(app);
 *    registerAdminRoutes(app);
 *    registerFileRoutes(app);
 *    registerModuleRoutes(app);
 *    registerReportingRoutes(app);
 *    registerTenantSettingsRoutes(app);
 *    registerEvidenceRoutes(app);
 *    registerStateRoutes(app);
 *    attachErrorHandler(app);
 *    await initializeStorage();
 *    app.listen(PORT, ...);
 *
 * ============================================================================
 *
 * Closure-Abhängigkeiten:
 *   - `observability` (ESM-Singleton aus services/observability.js)
 *     wird von 7 Middleware-Hooks und vom Error-Handler referenziert.
 *   - `readPlatformSettings` (lokale Binding auf
 *     defaultPlatformSettings) für Hardening + CORS — gleiche
 *     Binding wie in den anderen Service-Modulen (services/jobs.js,
 *     services/system-summaries.js, services/storage-init.js).
 *   - `runtimeConfig` für den `securityHeadersEnabled`-Gate (helmet)
 *     und die 3× Rate-Limit-Konfigurations-Lookups.
 */
import express from 'express';
import helmet from 'helmet';

import { MAX_JSON_SIZE } from '../config/defaults.js';
import { defaultPlatformSettings, runtimeConfig } from '../config/runtime.js';
import {
  createCorsMiddleware,
  createRateLimitMiddleware,
} from '../security.js';
import { createRequestHardeningMiddleware } from '../hardening.js';
import { observability } from './observability.js';
import { readPlatformSettings as readPlatformSettingsRaw } from './persistence-wrappers.js';

// Lokale Bindung der runtime-abhängigen platform-settings-Defaults
// (gleiches Muster wie in services/jobs.js, services/system-summaries.js,
// services/storage-init.js, services/system-summaries.js).
const readPlatformSettings = () => readPlatformSettingsRaw(defaultPlatformSettings);

/**
 * Registriert alle Pre-Route-Middleware in byte-identischer Reihenfolge
 * aus dem Ist-Code vor C3.7b. Muss vor allen `register*Routes(app)`-
 * Aufrufen gerufen werden (siehe Top-of-File-Invariante).
 */
export function attachMiddleware(app) {
  // ==========================================================================
  // 11-Schritt-Middleware-Plan · byte-identisch aus dem Ist-Code vor C3.7b
  //
  //   1. app.disable('x-powered-by')     — Express-Info-Disclosure
  //   2. app.set('trust proxy', 1)        — Proxy-Header-Erkennung
  //   3. if (securityHeadersEnabled) helmet
  //   4. observability.middleware          — Request-ID vor allen Security-Events
  //   5. createRequestHardeningMiddleware   — WAF-Lite VOR CORS (drop bösartige Requests früh)
  //   6. createCorsMiddleware               — Origin-Check
  //   7. createRateLimitMiddleware('global')
  //   8. createRateLimitMiddleware('login') — match-basiert, nach global
  //   9. createRateLimitMiddleware('upload') — match-basiert, nach login
  //  10. express.json({ limit })           — Body-Parser, NACH Rate-Limits
  //  11. Cache-control-Middleware          — letzter app.use vor Routes
  //
  // Reihenfolge ist Security-relevant. Besonders kritisch:
  // Hardening VOR CORS (Schritt 5 vs. 6) — bösartige OPTIONS-Preflights
  // werden früh gedroppt, bevor CORS eigene OPTIONS-Antworten schreibt.
  // Die Umkehr würde die WAF-Lite-Drop-Regeln umgehen.
  // ==========================================================================

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  if (runtimeConfig.securityHeadersEnabled) {
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }));
  }
  app.use(observability.middleware);
  app.use(createRequestHardeningMiddleware({
    resolveEnabled: async () => (await readPlatformSettings()).wafLiteEnabled,
    onBlocked: ({ req, result }) => {
      observability.recordSecurityEvent({
        requestId: req.requestId || req.headers['x-request-id'] || '',
        route: `${req.method || 'GET'} ${req.path || req.originalUrl || req.url || '/'}`,
        status: 400,
        detail: result.rules.map((entry) => entry.id).join(', '),
        severity: 'danger',
      });
    },
  }));
  app.use(createCorsMiddleware(async () => (await readPlatformSettings()).allowedOrigins));
  app.use(createRateLimitMiddleware({
    prefix: 'global',
    windowMs: runtimeConfig.rateLimit.windowMs,
    maxRequests: runtimeConfig.rateLimit.maxRequests,
    onLimit: ({ req, retryAfterSeconds }) => {
      observability.recordSecurityEvent({
        requestId: req.requestId || '',
        route: `${req.method || 'GET'} ${req.path || req.originalUrl || req.url || '/'}`,
        status: 429,
        detail: `Globales Rate-Limit ausgelöst. Retry-After ${retryAfterSeconds}s.`,
      });
    },
  }));
  app.use(createRateLimitMiddleware({
    prefix: 'login',
    windowMs: runtimeConfig.loginRateLimit.windowMs,
    maxRequests: runtimeConfig.loginRateLimit.maxRequests,
    match: (req) => (req.method === 'POST' && req.path === '/api/auth/login')
      || (req.method === 'GET' && req.path === '/api/auth/oidc/start')
      || (req.method === 'POST' && req.path === '/api/auth/oidc/complete'),
    onLimit: ({ req, retryAfterSeconds }) => {
      observability.recordSecurityEvent({
        requestId: req.requestId || '',
        route: `${req.method || 'POST'} ${req.path || req.originalUrl || req.url || '/'}`,
        status: 429,
        detail: `Auth-Rate-Limit ausgelöst. Retry-After ${retryAfterSeconds}s.`,
        severity: 'danger',
      });
    },
  }));
  app.use(createRateLimitMiddleware({
    prefix: 'upload',
    windowMs: runtimeConfig.uploadRateLimit.windowMs,
    maxRequests: runtimeConfig.uploadRateLimit.maxRequests,
    match: (req) => req.method === 'POST' && /^\/api\/evidence\/[^/]+\/attachment$/.test(req.path),
    onLimit: ({ req, retryAfterSeconds }) => {
      observability.recordSecurityEvent({
        requestId: req.requestId || '',
        route: `${req.method || 'POST'} ${req.path || req.originalUrl || req.url || '/'}`,
        status: 429,
        detail: `Upload-Rate-Limit ausgelöst. Retry-After ${retryAfterSeconds}s.`,
        severity: 'danger',
      });
    },
  }));
  app.use(express.json({ limit: MAX_JSON_SIZE }));
  app.use((req, res, next) => {
    res.setHeader('cache-control', 'no-store');
    next();
  });
}

/**
 * Registriert den terminalen Error-Handler mit 4-Parameter-Signatur.
 * Muss NACH allen `register*Routes(app)`-Aufrufen gerufen werden
 * (siehe Top-of-File-Invariante).
 *
 * Verträge:
 *   - VERSION_CONFLICT-Fehler aus der Persistence-Schicht werden per
 *     `routes/state.js`-Gate zu `httpError(409, '...zwischenzeitlich
 *     geändert...')` transformiert. Dieser Handler formt die finale
 *     Response mit `currentVersion` + `currentUpdatedAt`-Feldern im
 *     Body (Frontend-Konfliktauflösungs-Kontrakt, siehe Notiz aus
 *     C3.5).
 *   - Für jede Status-Code >= 400 wird ein Security-Event im
 *     observability-Store verzeichnet (Severity: `danger` für >= 500,
 *     sonst `warn`).
 *   - Byte-identisch aus dem Ist-Code vor C3.7b übernommen.
 */
export function attachErrorHandler(app) {
  app.use((error, req, res, _next) => {
    const status = Number(error?.status || 500);
    const message = error?.message || 'Unbekannter Serverfehler';
    const details = Array.isArray(error?.details) ? error.details : undefined;
    const body = { message, details, requestId: res.locals?.requestId || req.requestId || '' };

    if (Number.isFinite(error?.currentVersion)) {
      body.currentVersion = Number(error.currentVersion);
    }
    if (typeof error?.currentUpdatedAt === 'string' && error.currentUpdatedAt) {
      body.currentUpdatedAt = error.currentUpdatedAt;
    }

    if (status >= 400) {
      observability.recordSecurityEvent({
        requestId: body.requestId,
        route: `${req.method || 'GET'} ${req.path || req.originalUrl || req.url || '/'}`,
        status,
        detail: message,
        severity: status >= 500 ? 'danger' : 'warn',
      });
    }

    res.status(status).json(body);
  });
}
