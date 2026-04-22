import { asyncRoute } from './utils.js';
// C3.5: Lokaler Null-Deps-Nachzug nur für buildStateEnvelope. Die
// restlichen Deps (deps-Object-Pattern aus der Zeit vor der Foundation-
// Phase) bleiben bis zum retroaktiven Null-Deps-Nachzug in C3.6/C3.7
// (Meta-Review-Notiz 5).
import { buildStateEnvelope } from '../services/state.js';

export function registerIntegrationRoutes(app, deps) {
  const {
    getApiClientContext,
    assertApiClientScopes,
    buildIntegrationManifest,
    listTenantSummaries,
    readTenants,
    listExportEntries,
    httpError,
    readState,
  } = deps;

  app.get('/api/integration/manifest', asyncRoute(async (req, res) => {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['readiness:read'], apiContext);
    res.json(await buildIntegrationManifest(apiContext));
  }));

  app.get('/api/integration/tenant-summary', asyncRoute(async (req, res) => {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['tenant:read'], apiContext);
    const tenants = await listTenantSummaries();
    const scoped = apiContext.client.tenantId
      ? tenants.filter((tenant) => tenant.id === apiContext.client.tenantId)
      : tenants;

    res.json({
      ok: true,
      tenants: scoped,
    });
  }));

  app.get('/api/integration/exports', asyncRoute(async (req, res) => {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['exports:read'], apiContext);
    const tenants = await readTenants();
    const scopedTenants = apiContext.client.tenantId
      ? tenants.filter((tenant) => tenant.id === apiContext.client.tenantId)
      : tenants;
    const releaseOnly = String(req.query.releaseOnly || '').trim() === '1';
    const packages = [];

    for (const tenant of scopedTenants) {
      const entries = await listExportEntries(tenant.id);
      packages.push(...entries.filter((entry) => (releaseOnly ? entry.releaseStatus === 'released' : true)));
    }

    res.json({
      ok: true,
      packages,
    });
  }));

  app.get('/api/integration/state', asyncRoute(async (req, res) => {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['state:read'], apiContext);
    const requestedTenantId = String(req.query.tenantId || '').trim();
    const targetTenantId = apiContext.client.tenantId || requestedTenantId;

    if (!targetTenantId) {
      throw httpError(400, 'Für systemweite API-Clients muss ein tenantId-Parameter angegeben werden.');
    }

    const tenants = await readTenants();
    if (!tenants.some((tenant) => tenant.id === targetTenantId)) {
      throw httpError(404, 'Der angeforderte Mandant wurde nicht gefunden.');
    }

    const stateEnvelope = await buildStateEnvelope(targetTenantId, await readState(targetTenantId));
    res.json({
      ok: true,
      tenantId: targetTenantId,
      ...stateEnvelope,
    });
  }));
}
