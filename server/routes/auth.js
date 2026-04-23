/**
 * auth.js · Route-Modul für Login-, OIDC- und Session-Endpoints.
 *
 * Null-Deps seit C3.6-Polish (retroaktiver Nachzug). Alle Auth-Primitiven
 * direkt aus services/auth-session.js (16 Symbole), die OIDC-Primitive
 * aus ../auth-provider.js (6 Symbole).
 */
import { asyncRoute } from './utils.js';
import {
  buildOidcAuthorizationUrl,
  buildPublicAuthProviders,
  createAuthCallbackTicket,
  createOidcTransaction,
  exchangeOidcCode,
  extractOidcProfile,
  fetchOidcDiscovery,
  fetchOidcUserProfile,
} from '../auth-provider.js';
import { OIDC_PROVIDER_ID } from '../config/defaults.js';
import {
  ANONYMOUS_ACCESS_ENABLED,
  AUTHENTICATION_REQUIRED,
  DEFAULT_DEMO_PASSWORD,
  DEMO_SIMPLE_AUTH,
  authStrategy,
  defaultPlatformSettings,
  runtimeConfig,
} from '../config/runtime.js';
import {
  buildSuccessfulAuthResponse,
  buildWorkspaceUserSeedFromContext,
  cleanupExpiredAuthFlows,
  consumeAuthCallbackTicket,
  ensureWorkspaceUser,
  extractAuthToken,
  getAuthContext,
  resolveMembershipForAccount,
  resolveOidcLoginContext,
  verifyPassword,
} from '../services/auth-session.js';
import { httpError } from '../services/ids.js';
import {
  readAccounts,
  readAuthCallbackTickets,
  readPendingAuthFlows,
  readPlatformSettings as readPlatformSettingsRaw,
  readSessions,
  readTenants,
  writeAuthCallbackTickets,
  writePendingAuthFlows,
  writeSessions,
} from '../services/persistence-wrappers.js';
import {
  isLocalLoginAllowed,
  sanitizeArray,
} from '../services/sanitizers.js';
import { listTenantSummaries } from '../services/system-summaries.js';

// Lokale Bindung der runtime-abhängigen platform-settings-Defaults
// (gleiches Muster wie in services/jobs.js, services/system-summaries.js,
// server/index.js). Nur für die /api/auth/oidc/callback-Route.
const readPlatformSettings = () => readPlatformSettingsRaw(defaultPlatformSettings);

export function registerAuthRoutes(app) {
  app.get('/api/auth/bootstrap', asyncRoute(async (_req, res) => {
    const tenants = await listTenantSummaries();
    const publicTenant = tenants.find((entry) => entry.active !== false) ?? tenants[0] ?? null;
    res.json({
      ok: true,
      appMode: runtimeConfig.appMode,
      authMode: authStrategy.mode,
      authenticationRequired: AUTHENTICATION_REQUIRED,
      authenticationOptional: !AUTHENTICATION_REQUIRED,
      anonymousAccessEnabled: ANONYMOUS_ACCESS_ENABLED,
      anonymousAccessMode: ANONYMOUS_ACCESS_ENABLED ? 'read_only' : 'disabled',
      localLoginEnabled: authStrategy.local.enabled,
      authProviders: buildPublicAuthProviders(authStrategy),
      publicTenant,
      tenants,
      // Demo-Simple-Auth-Flag · steuert das vereinfachte Frontend-Login
      // (nur E-Mail + Passwort, kein Tenant-Select, kein SSO). Siehe
      // runtime.js und docs/DEMO-AUTH-BYPASS.md für Reaktivierungs-Pfad.
      demoSimpleAuth: DEMO_SIMPLE_AUTH,
    });
  }));

  // Demo-Simple-Auth-Endpoint · Ein-Klick-Admin-Zugang für die UVM-Demo.
  //
  // Akzeptiert ein beliebiges E-Mail/Passwort-Paar, sofern das Passwort
  // dem DEFAULT_DEMO_PASSWORD (Default „Krisenfest2026!") entspricht.
  // Die eingegebene E-Mail wird für die Session-Anzeige verwendet, der
  // eigentliche Auth-Kontext wird mit dem bereits durch
  // `seedDemoAdminIfMissing` gesetzten Admin-Account gebildet — kein
  // zusätzlicher Account-Insert pro Login.
  //
  // Aktiv nur, wenn DEMO_SIMPLE_AUTH true ist. Bei false → 403, der
  // bestehende `/api/auth/login`-Endpoint bleibt die einzige gültige
  // Eingangsroute.
  app.post('/api/auth/demo-login', asyncRoute(async (req, res) => {
    if (!DEMO_SIMPLE_AUTH) {
      throw httpError(403, 'Demo-Login ist deaktiviert. Bitte regulären Login verwenden.');
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      throw httpError(400, 'Bitte E-Mail und Passwort eingeben.');
    }

    if (password !== DEFAULT_DEMO_PASSWORD) {
      throw httpError(401, 'Demo-Login fehlgeschlagen. Passwort ist nicht korrekt.');
    }

    // Default-Tenant auswählen (erster aktiver). Ohne Tenant kann keine
    // Session gebildet werden — der Bootstrap-Seed legt sonst bereits
    // `demo-unternehmen` an, sodass dieser Fall praktisch nie eintritt.
    const tenants = await readTenants();
    const activeTenants = new Map(sanitizeArray(tenants).filter((entry) => entry?.active !== false).map((entry) => [entry.id, entry]));
    const firstTenant = [...activeTenants.values()][0];
    if (!firstTenant) {
      throw httpError(503, 'Demo-Login nicht möglich: kein aktiver Mandant verfügbar.');
    }

    // Seeded Demo-Admin-Account suchen. `seedDemoAdminIfMissing` legt
    // admin@krisenfest.demo idempotent beim Server-Start an; wir finden
    // ihn hier als bestehenden Account. Fallback: jeder System-Admin
    // mit einer Membership im Default-Tenant.
    const accounts = await readAccounts();
    let adminAccount = accounts.find((entry) => (
      String(entry?.email || '').toLowerCase() === 'admin@krisenfest.demo'
      && entry?.status !== 'inactive'
    ));
    if (!adminAccount) {
      adminAccount = accounts.find((entry) => (
        entry?.isSystemAdmin === true
        && entry?.status !== 'inactive'
        && sanitizeArray(entry?.memberships).some((m) => m?.tenantId === firstTenant.id)
      ));
    }
    if (!adminAccount) {
      throw httpError(503, 'Demo-Login nicht möglich: kein Seed-Admin-Account im System vorhanden. Bitte seedDemoAdminIfMissing sicherstellen (Server-Restart).');
    }

    const membership = resolveMembershipForAccount(adminAccount, firstTenant.id, activeTenants);
    if (!membership) {
      throw httpError(503, 'Demo-Login nicht möglich: Seed-Admin hat keine Mitgliedschaft im Default-Tenant.');
    }

    res.json(await buildSuccessfulAuthResponse({
      account: adminAccount,
      membership,
      tenant: firstTenant,
      providerId: 'demo',
    }));
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    if (!authStrategy.local.enabled) {
      throw httpError(403, 'Lokale Passwortanmeldung ist für diese Instanz deaktiviert.');
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const requestedTenantId = String(req.body?.tenantId || '').trim();

    if (!email || !password) {
      throw httpError(400, 'Bitte E-Mail und Passwort angeben.');
    }

    const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
    const account = accounts.find((entry) => String(entry?.email || '').toLowerCase() === email && entry?.status !== 'inactive');
    if (!account) {
      throw httpError(401, 'Anmeldung fehlgeschlagen. Konto nicht gefunden oder deaktiviert.');
    }

    if (!isLocalLoginAllowed(account) || !account.passwordSalt || !account.passwordHash) {
      throw httpError(403, 'Dieses Zugriffskonto ist nur für SSO freigegeben.');
    }

    if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw httpError(401, 'Anmeldung fehlgeschlagen. Passwort ist nicht korrekt.');
    }

    const activeTenants = new Map(sanitizeArray(tenants).filter((entry) => entry?.active !== false).map((entry) => [entry.id, entry]));
    const membership = resolveMembershipForAccount(account, requestedTenantId, activeTenants);

    if (!membership) {
      throw httpError(403, 'Für den ausgewählten Mandanten besteht keine Berechtigung.');
    }

    const tenant = activeTenants.get(membership.tenantId);
    if (!tenant) {
      throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
    }

    res.json(await buildSuccessfulAuthResponse({
      account,
      membership,
      tenant,
      providerId: 'local',
    }));
  }));

  app.get('/api/auth/oidc/start', asyncRoute(async (req, res) => {
    if (!authStrategy.oidc.enabled || !authStrategy.oidc.configured) {
      throw httpError(503, 'OIDC / SSO ist für diese Instanz nicht konfiguriert.');
    }

    await cleanupExpiredAuthFlows();
    const tenantId = String(req.query.tenantId || '').trim();
    const discovery = await fetchOidcDiscovery(authStrategy.oidc);
    const transaction = {
      ...createOidcTransaction(authStrategy.oidc, tenantId),
      providerId: OIDC_PROVIDER_ID,
    };
    const flows = await readPendingAuthFlows();
    await writePendingAuthFlows([transaction, ...flows.filter((entry) => entry.state !== transaction.state)]);
    const redirectUrl = buildOidcAuthorizationUrl(authStrategy.oidc, discovery, transaction);

    res.json({
      ok: true,
      providerId: OIDC_PROVIDER_ID,
      redirectUrl,
      state: transaction.state,
      expiresAt: transaction.expiresAt,
    });
  }));

  app.get('/api/auth/oidc/callback', asyncRoute(async (req, res) => {
    if (!authStrategy.oidc.enabled || !authStrategy.oidc.configured) {
      throw httpError(503, 'OIDC / SSO ist für diese Instanz nicht konfiguriert.');
    }

    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    const errorCode = String(req.query.error || '').trim();
    const errorDescription = String(req.query.error_description || '').trim();
    const platformSettings = await readPlatformSettings();
    const callbackBase = platformSettings.appBaseUrl || 'http://localhost:5173';

    const redirectWithQuery = (params) => {
      const url = new URL(callbackBase);
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, String(value));
        }
      });
      res.redirect(302, url.toString());
    };

    if (errorCode) {
      redirectWithQuery({ auth_error: `${errorCode}${errorDescription ? `: ${errorDescription}` : ''}` });
      return;
    }

    await cleanupExpiredAuthFlows();
    const flows = await readPendingAuthFlows();
    const flow = flows.find((entry) => entry.state === state && entry.providerId === OIDC_PROVIDER_ID);
    if (!flow) {
      throw httpError(401, 'Die OIDC-Anmeldung konnte nicht zugeordnet werden oder ist abgelaufen.');
    }

    const discovery = await fetchOidcDiscovery(authStrategy.oidc);
    const tokenSet = await exchangeOidcCode(authStrategy.oidc, discovery, {
      code,
      codeVerifier: flow.codeVerifier,
    });
    const rawProfile = await fetchOidcUserProfile(authStrategy.oidc, discovery, tokenSet);
    const profile = extractOidcProfile(authStrategy.oidc, rawProfile);
    const loginContext = await resolveOidcLoginContext({
      profile,
      requestedTenantId: flow.tenantId,
    });

    const authResponse = await buildSuccessfulAuthResponse({
      account: loginContext.account,
      membership: loginContext.membership,
      tenant: loginContext.tenant,
      providerId: OIDC_PROVIDER_ID,
    });

    const ticket = createAuthCallbackTicket(authStrategy.oidc, authResponse.session.token);
    const tickets = await readAuthCallbackTickets();
    await writeAuthCallbackTickets([ticket, ...tickets]);
    await writePendingAuthFlows(flows.filter((entry) => entry.state !== flow.state));

    redirectWithQuery({ auth_ticket: ticket.id, auth_provider: OIDC_PROVIDER_ID });
  }));

  app.post('/api/auth/oidc/complete', asyncRoute(async (req, res) => {
    const ticketId = String(req.body?.ticket || '').trim();
    if (!ticketId) {
      throw httpError(400, 'Authentifizierungsticket fehlt.');
    }

    res.json(await consumeAuthCallbackTicket(ticketId));
  }));

  app.get('/api/auth/session', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    await ensureWorkspaceUser(authContext.membership.tenantId, authContext.membership, authContext.account);
    res.json({
      ok: true,
      session: authContext.sessionPublic,
      workspaceUserSeed: buildWorkspaceUserSeedFromContext(authContext),
    });
  }));

  app.post('/api/auth/logout', asyncRoute(async (req, res) => {
    const token = extractAuthToken(req);
    if (token) {
      const sessions = await readSessions();
      await writeSessions(sessions.filter((entry) => entry?.token !== token));
    }
    res.json({ ok: true });
  }));
}
