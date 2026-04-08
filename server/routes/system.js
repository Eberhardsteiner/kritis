import { asyncRoute } from './utils.js';

export function registerSystemRoutes(app, deps) {
  const {
    buildHealthResponse,
    nowIso,
    getPersistenceLayer,
    getAuthContext,
    ensureSystemAdmin,
    readPlatformSettings,
    writePlatformSettings,
    sanitizeObject,
    buildHostingReadinessSummary,
    buildIntegritySummaryForTenant,
    buildSecurityGateSummary,
    observability,
    listRestoreDrillSummaries,
    readApiClients,
    readTenants,
    sanitizeApiClientScopes,
    httpError,
    createApiClientSecret,
    hashPassword,
    sanitizeApiClientRecord,
    createId,
    maskSecret,
    writeApiClients,
    readJobRuns,
    runSystemJob,
    jobsArtifactsDir,
    fsSync,
    path,
  } = deps;

  app.get('/api/health', asyncRoute(async (_req, res) => {
    res.json(await buildHealthResponse());
  }));

  app.get('/api/health/live', (_req, res) => {
    res.json({ ok: true, serverTime: nowIso() });
  });

  app.get('/api/health/ready', asyncRoute(async (_req, res) => {
    const persistence = await getPersistenceLayer();
    res.json({
      ok: true,
      ready: Boolean(persistence?.driver),
      persistenceDriver: persistence?.driver || 'tenant-filesystem',
      serverTime: nowIso(),
    });
  }));

  app.get('/api/system/platform', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({
      ok: true,
      settings: await readPlatformSettings(),
    });
  }));

  app.put('/api/system/platform', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const current = await readPlatformSettings();
    const settings = await writePlatformSettings({
      ...current,
      ...sanitizeObject(req.body?.settings),
    });

    res.json({
      ok: true,
      settings,
    });
  }));

  app.get('/api/system/readiness', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({
      ok: true,
      summary: await buildHostingReadinessSummary(),
    });
  }));

  app.get('/api/system/integrity', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const summary = await buildIntegritySummaryForTenant(authContext.membership.tenantId);
    res.json({
      ok: true,
      summary,
    });
  }));

  app.get('/api/system/security-gates', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({ ok: true, summary: await buildSecurityGateSummary() });
  }));

  app.get('/api/system/observability', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({ ok: true, summary: observability.buildSummary() });
  }));

  app.get('/api/system/restore-drills', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({ ok: true, drills: await listRestoreDrillSummaries() });
  }));

  app.get('/api/system/api-clients', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const clients = await readApiClients();
    res.json({
      ok: true,
      clients,
    });
  }));

  app.post('/api/system/api-clients', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);

    const label = String(req.body?.label || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    const integrationType = ['reporting', 'backup', 'siem', 'bi', 'custom'].includes(req.body?.integrationType)
      ? req.body.integrationType
      : 'custom';
    const scopes = sanitizeApiClientScopes(req.body?.scopes);
    const expiresAt = String(req.body?.expiresAt || '').trim();
    const note = String(req.body?.note || '').trim();

    if (!label) {
      throw httpError(400, 'Bitte eine Bezeichnung für den API-Client angeben.');
    }

    const tenants = await readTenants();
    if (tenantId && !tenants.some((tenant) => tenant.id === tenantId)) {
      throw httpError(404, 'Der gewählte Mandant wurde nicht gefunden.');
    }

    const secret = createApiClientSecret();
    const secretData = hashPassword(secret);
    const clients = await readApiClients();
    const client = sanitizeApiClientRecord({
      id: createId('api'),
      label,
      tenantId,
      integrationType,
      scopes,
      status: 'active',
      createdAt: nowIso(),
      createdBy: authContext.account.name || authContext.account.email || 'System',
      lastUsedAt: '',
      expiresAt,
      secretHint: maskSecret(secret),
      note,
      secretSalt: secretData.salt,
      secretHash: secretData.hash,
    }, new Map(tenants.map((tenant) => [tenant.id, tenant])));

    clients.unshift(client);
    await writeApiClients(clients);

    res.json({
      ok: true,
      client,
      secret,
    });
  }));

  app.post('/api/system/api-clients/:clientId/rotate', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const clientId = String(req.params.clientId || '').trim();
    const secret = createApiClientSecret();
    const secretData = hashPassword(secret);
    const clients = await readApiClients();
    const index = clients.findIndex((client) => client.id === clientId);

    if (index < 0) {
      throw httpError(404, 'Der API-Client wurde nicht gefunden.');
    }

    clients[index] = {
      ...clients[index],
      status: 'active',
      secretHint: maskSecret(secret),
      secretSalt: secretData.salt,
      secretHash: secretData.hash,
      lastUsedAt: '',
    };
    await writeApiClients(clients);

    res.json({
      ok: true,
      client: clients[index],
      secret,
    });
  }));

  app.post('/api/system/api-clients/:clientId/revoke', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const clientId = String(req.params.clientId || '').trim();
    const clients = await readApiClients();
    const index = clients.findIndex((client) => client.id === clientId);

    if (index < 0) {
      throw httpError(404, 'Der API-Client wurde nicht gefunden.');
    }

    clients[index] = {
      ...clients[index],
      status: 'revoked',
    };
    await writeApiClients(clients);

    res.json({
      ok: true,
      client: clients[index],
    });
  }));

  app.get('/api/system/jobs', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({
      ok: true,
      jobs: await readJobRuns(),
    });
  }));

  app.post('/api/system/jobs/run', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const job = await runSystemJob(authContext, req.body || {});
    res.json({
      ok: true,
      job,
    });
  }));

  app.get('/api/system/jobs/:jobId/download', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const jobId = String(req.params.jobId || '').trim();
    const jobs = await readJobRuns();
    const job = jobs.find((entry) => entry.id === jobId);

    if (!job?.artifactFileName) {
      throw httpError(404, 'Für diesen Job ist kein Artefakt verfügbar.');
    }

    const filePath = path.join(jobsArtifactsDir, job.artifactFileName);
    if (!fsSync.existsSync(filePath)) {
      throw httpError(404, 'Das Job-Artefakt wurde nicht gefunden.');
    }

    const requestedName = String(req.query.download || job.artifactFileName || `${jobId}.json`).trim();
    res.download(filePath, requestedName);
  }));
}
