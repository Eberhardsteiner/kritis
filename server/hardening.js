import crypto from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

function clampInteger(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || !values.length) {
    return 0;
  }

  const sorted = values
    .map((entry) => Number(entry) || 0)
    .filter((entry) => Number.isFinite(entry))
    .sort((left, right) => left - right);

  if (!sorted.length) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((ratio / 100) * sorted.length) - 1));
  return Math.round(sorted[index] * 10) / 10;
}

function average(values) {
  if (!Array.isArray(values) || !values.length) {
    return 0;
  }

  const numeric = values
    .map((entry) => Number(entry) || 0)
    .filter((entry) => Number.isFinite(entry));

  if (!numeric.length) {
    return 0;
  }

  return Math.round((numeric.reduce((sum, entry) => sum + entry, 0) / numeric.length) * 10) / 10;
}

function stableRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return `req_${crypto.randomUUID()}`;
  }
  return `req_${crypto.randomBytes(16).toString('hex')}`;
}

function pushRing(target, entry, limit) {
  target.unshift(entry);
  if (target.length > limit) {
    target.length = limit;
  }
}

export function evaluateRequestRisk(target, options = {}) {
  const input = String(target || '');
  const lower = input.toLowerCase();
  const rules = [];
  const maxUrlLength = clampInteger(options.maxUrlLength, 2048, 128, 16_384);
  const maxQueryLength = clampInteger(options.maxQueryLength, 1024, 64, 16_384);

  if (!input) {
    return { ok: true, rules };
  }

  if (input.length > maxUrlLength) {
    rules.push({
      id: 'url-length',
      detail: `Die URL überschreitet das Limit von ${maxUrlLength} Zeichen.`,
    });
  }

  const query = input.split('?')[1] || '';
  if (query.length > maxQueryLength) {
    rules.push({
      id: 'query-length',
      detail: `Die Query überschreitet das Limit von ${maxQueryLength} Zeichen.`,
    });
  }

  if (lower.includes('../') || lower.includes('..\\') || lower.includes('%2e%2e') || lower.includes('%252e%252e')) {
    rules.push({
      id: 'path-traversal',
      detail: 'Die Anfrage enthält Hinweise auf Path Traversal.',
    });
  }

  if (input.includes('\0') || /%00/i.test(input) || /[\u0000-\u001f]/.test(input)) {
    rules.push({
      id: 'control-bytes',
      detail: 'Die Anfrage enthält Nullbytes oder Steuerzeichen.',
    });
  }

  if (/(<script|%3cscript|union\s+select|drop\s+table|or\s+1=1)/i.test(lower)) {
    rules.push({
      id: 'payload-signature',
      detail: 'Die Anfrage enthält eine blockierte Signatur für offensichtliche Angriffsversuche.',
    });
  }

  return {
    ok: rules.length === 0,
    rules,
  };
}

export function createRequestHardeningMiddleware({ resolveEnabled = () => true, maxUrlLength = 2048, maxQueryLength = 1024, onBlocked } = {}) {
  return async (req, res, next) => {
    try {
      const enabled = await Promise.resolve(resolveEnabled(req));
      if (!enabled) {
        next();
        return;
      }

      const result = evaluateRequestRisk(req.originalUrl || req.url || '', { maxUrlLength, maxQueryLength });
      if (result.ok) {
        next();
        return;
      }

      if (typeof onBlocked === 'function') {
        onBlocked({ req, result, at: nowIso() });
      }

      res.status(400).json({
        message: 'Die Anfrage wurde von der Request-Härtung blockiert.',
        details: result.rules.map((entry) => `${entry.id}: ${entry.detail}`),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createObservabilityStore({ recentEventLimit = 80, maxLatencySamplesPerRoute = 200 } = {}) {
  const safeRecentEventLimit = clampInteger(recentEventLimit, 80, 10, 500);
  const safeLatencyLimit = clampInteger(maxLatencySamplesPerRoute, 200, 20, 1000);
  const createdAt = Date.now();
  const routeStats = new Map();
  const recentEvents = [];
  let totalRequests = 0;
  let totalErrors = 0;
  let activeRequests = 0;
  let lastRequestAt = '';

  function getRouteKey(req) {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || req.route?.path || req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '/');
    return `${method} ${path}`;
  }

  function recordSecurityEvent({ requestId = '', route = '', status = 400, detail = '', severity = 'warn' } = {}) {
    pushRing(recentEvents, {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      kind: 'security',
      route: String(route || '/'),
      status: Number(status) || 0,
      detail: String(detail || '').trim() || 'Sicherheitsereignis',
      requestId: String(requestId || '').trim(),
      severity,
    }, safeRecentEventLimit);
  }

  function middleware(req, res, next) {
    const requestId = String(req.headers['x-request-id'] || '').trim() || stableRequestId();
    res.setHeader('x-request-id', requestId);
    req.requestId = requestId;
    res.locals.requestId = requestId;
    activeRequests += 1;
    const routeKey = getRouteKey(req);
    const started = process.hrtime.bigint();

    res.on('finish', () => {
      activeRequests = Math.max(0, activeRequests - 1);
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      totalRequests += 1;
      if (res.statusCode >= 400) {
        totalErrors += 1;
      }
      lastRequestAt = nowIso();

      const current = routeStats.get(routeKey) || {
        route: routeKey,
        count: 0,
        errorCount: 0,
        latencies: [],
        lastStatus: 0,
        lastSeenAt: '',
      };

      current.count += 1;
      current.errorCount += res.statusCode >= 400 ? 1 : 0;
      current.lastStatus = res.statusCode;
      current.lastSeenAt = lastRequestAt;
      current.latencies.push(durationMs);
      if (current.latencies.length > safeLatencyLimit) {
        current.latencies.splice(0, current.latencies.length - safeLatencyLimit);
      }
      routeStats.set(routeKey, current);

      pushRing(recentEvents, {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: lastRequestAt,
        kind: 'request',
        route: routeKey,
        status: res.statusCode,
        detail: `${Math.round(durationMs * 10) / 10} ms`,
        requestId,
      }, safeRecentEventLimit);
    });

    next();
  }

  function buildSummary() {
    const allLatencies = [];
    const routes = [...routeStats.values()]
      .map((entry) => {
        allLatencies.push(...entry.latencies);
        return {
          route: entry.route,
          count: entry.count,
          errorCount: entry.errorCount,
          averageLatencyMs: average(entry.latencies),
          p95LatencyMs: percentile(entry.latencies, 95),
          lastStatus: entry.lastStatus,
          lastSeenAt: entry.lastSeenAt,
        };
      })
      .sort((left, right) => right.count - left.count)
      .slice(0, 12);

    return {
      generatedAt: nowIso(),
      uptimeSeconds: Math.round((Date.now() - createdAt) / 1000),
      totalRequests,
      activeRequests,
      errorRatePercent: totalRequests ? Math.round((totalErrors / totalRequests) * 1000) / 10 : 0,
      p95LatencyMs: percentile(allLatencies, 95),
      lastRequestAt,
      routes,
      recentEvents: [...recentEvents],
    };
  }

  return {
    middleware,
    recordSecurityEvent,
    buildSummary,
  };
}

function verifyDefaultPassword(accounts, defaultPassword, verifyPassword) {
  if (!defaultPassword || typeof verifyPassword !== 'function') {
    return false;
  }

  return accounts.some((account) => account?.status !== 'inactive'
    && account?.passwordSalt
    && account?.passwordHash
    && verifyPassword(defaultPassword, account.passwordSalt, account.passwordHash));
}

export function buildSecurityGatesSummary({
  runtimeConfig,
  platformSettings,
  accounts = [],
  apiClients = [],
  jobs = [],
  verifyPassword,
  defaultDemoPassword = '',
  generatedBootstrapPassword = false,
} = {}) {
  const settings = platformSettings || {};
  const activeClients = apiClients.filter((entry) => entry?.status === 'active');
  const activeAdmins = accounts.filter((entry) => entry?.isSystemAdmin && entry?.status !== 'inactive');
  const defaultPasswordInUse = verifyDefaultPassword(accounts, defaultDemoPassword, verifyPassword);
  const lastRestoreDrill = jobs.find((entry) => entry?.type === 'restore_drill' && entry?.status === 'done')?.completedAt || '';
  const restoreWindowDays = clampInteger(settings.restoreDrillCadenceDays, 30, 1, 365);
  const restoreFresh = lastRestoreDrill
    ? (Date.now() - new Date(lastRestoreDrill).getTime()) <= (restoreWindowDays * 24 * 60 * 60 * 1000)
    : false;

  const gates = [
    {
      id: 'auth-mode',
      label: 'Anmeldung und Betriebsmodus',
      status: runtimeConfig?.appMode === 'production' && runtimeConfig?.authRequired ? 'ok' : 'warn',
      detail: runtimeConfig?.appMode === 'production'
        ? 'Produktivmodus mit erzwungener Anmeldung aktiv.'
        : 'Demo-Modus aktiv. Für Produktivbetrieb sollte Production Mode mit Pflichtanmeldung gesetzt werden.',
    },
    {
      id: 'anonymous-access',
      label: 'Offener Arbeitsbereich',
      status: runtimeConfig?.anonymousAccessEnabled ? 'warn' : 'ok',
      detail: runtimeConfig?.anonymousAccessEnabled
        ? 'Lesemodus ohne Anmeldung ist aktiv. Für Produktivbetrieb nur gezielt einsetzen.'
        : 'Kein anonymer Zugriff aktiv.',
    },
    {
      id: 'default-password',
      label: 'Standardpasswort',
      status: defaultPasswordInUse ? 'warn' : 'ok',
      detail: defaultPasswordInUse
        ? 'Mindestens ein Konto akzeptiert noch das bekannte Standardpasswort.'
        : 'Kein geprüftes Konto nutzt mehr das bekannte Standardpasswort.',
    },
    {
      id: 'bootstrap-password',
      label: 'Bootstrap-Secrets',
      status: runtimeConfig?.appMode === 'production' && generatedBootstrapPassword ? 'warn' : 'ok',
      detail: runtimeConfig?.appMode === 'production' && generatedBootstrapPassword
        ? 'Es wird ein temporär generiertes Bootstrap-Passwort verwendet. Secret Management hinterlegen.'
        : 'Bootstrap-Secrets sind ohne Offenlegung im API-Pfad gekapselt.',
    },
    {
      id: 'cors-origins',
      label: 'CORS-Allowlist',
      status: Array.isArray(settings.allowedOrigins) && settings.allowedOrigins.length
        ? (settings.allowedOrigins.includes('*') ? 'warn' : 'ok')
        : 'missing',
      detail: Array.isArray(settings.allowedOrigins) && settings.allowedOrigins.length
        ? settings.allowedOrigins.includes('*')
          ? 'Wildcard-Origin aktiv. Für Produktion auf konkrete Origins umstellen.'
          : `${settings.allowedOrigins.length} konkrete Origins konfiguriert.`
        : 'Es sind noch keine erlaubten Origins gepflegt.',
    },
    {
      id: 'signed-webhooks',
      label: 'Signierte Webhooks',
      status: settings.requireSignedWebhooks ? 'ok' : 'warn',
      detail: settings.requireSignedWebhooks
        ? 'Webhook-Signaturen sind erzwungen.'
        : 'Webhook-Signaturen sind deaktiviert.',
    },
    {
      id: 'public-api',
      label: 'Öffentliche API und API-Keys',
      status: settings.publicApiEnabled
        ? (activeClients.length ? 'ok' : 'warn')
        : 'ok',
      detail: settings.publicApiEnabled
        ? `${activeClients.length} aktive API-Clients freigeschaltet.`
        : 'Öffentliche API ist deaktiviert.',
    },
    {
      id: 'antivirus',
      label: 'Upload-Prüfung',
      status: runtimeConfig?.antivirus?.enabled && runtimeConfig?.antivirus?.mode !== 'off' ? 'ok' : 'warn',
      detail: runtimeConfig?.antivirus?.enabled && runtimeConfig?.antivirus?.mode !== 'off'
        ? `Upload-Prüfung aktiv (${runtimeConfig.antivirus.mode}).`
        : 'Antivirus-Hook ist nicht aktiv.',
    },
    {
      id: 'observability',
      label: 'Observability',
      status: settings.observabilityMode && settings.observabilityMode !== 'off' ? 'ok' : 'warn',
      detail: settings.observabilityMode && settings.observabilityMode !== 'off'
        ? `Observability-Modus: ${settings.observabilityMode}.`
        : 'Observability ist deaktiviert oder unvollständig konfiguriert.',
    },
    {
      id: 'waf-lite',
      label: 'Request-Härtung',
      status: settings.wafLiteEnabled ? 'ok' : 'warn',
      detail: settings.wafLiteEnabled
        ? 'Request-Härtung gegen Traversal, Nullbytes und triviale Payload-Signaturen aktiv.'
        : 'Request-Härtung ist deaktiviert.',
    },
    {
      id: 'restore-drills',
      label: 'Restore-Drills',
      status: restoreFresh ? 'ok' : lastRestoreDrill ? 'warn' : 'missing',
      detail: lastRestoreDrill
        ? `Letzter Restore-Drill: ${lastRestoreDrill}. Erwartete Kadenz: alle ${restoreWindowDays} Tage.`
        : 'Es wurde noch kein Restore-Drill registriert.',
    },
    {
      id: 'system-admins',
      label: 'Systemadministration',
      status: activeAdmins.length ? 'ok' : 'missing',
      detail: activeAdmins.length
        ? `${activeAdmins.length} aktive Systemadministrationskonten vorhanden.`
        : 'Es existiert kein aktives Systemadministrationskonto.',
    },
  ];

  const okCount = gates.filter((entry) => entry.status === 'ok').length;
  const warnings = gates.filter((entry) => entry.status === 'warn').length;
  const blockers = gates.filter((entry) => entry.status === 'missing').length;
  const overallScore = Math.round((okCount / gates.length) * 100);

  return {
    generatedAt: nowIso(),
    overallScore,
    status: overallScore >= 80 ? 'ready' : overallScore >= 50 ? 'progressing' : 'foundation',
    blockers,
    warnings,
    gates,
  };
}

export function summarizeRestoreDrills(jobs = [], artifactLookup = new Map()) {
  return jobs
    .filter((entry) => entry?.type === 'restore_drill')
    .map((job) => {
      const payload = artifactLookup.get(job.id) || {};
      const meta = payload?.meta || {};
      const tenants = Array.isArray(payload?.tenants) ? payload.tenants : [];
      const failed = tenants.filter((entry) => entry?.status === 'failed').length;
      const warning = tenants.filter((entry) => entry?.status === 'warning').length;
      const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
      const verifiedBackups = tenants.filter((entry) => entry?.latestBackupAvailable).length;
      const missingBackups = tenants.filter((entry) => !entry?.latestBackupAvailable).length;
      const staleBackups = tenants.filter((entry) => entry?.backupFresh === false).length;
      const missingSnapshots = tenants.filter((entry) => !entry?.latestSnapshotAvailable).length;

      return {
        jobId: job.id,
        createdAt: job.completedAt || job.startedAt || '',
        triggeredBy: job.triggeredBy || '',
        tenantScope: job.tenantName || 'Systemweit',
        overallStatus: failed ? 'failed' : warning ? 'warning' : 'passed',
        tenantCount: Number(meta.tenantCount || tenants.length || 0),
        verifiedBackups,
        missingBackups,
        staleBackups,
        missingSnapshots,
        recommendations,
        artifactFileName: job.artifactFileName || '',
        downloadUrl: job.downloadUrl || '',
      };
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}
