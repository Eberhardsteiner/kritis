/**
 * auth-session.js · Server-Auth-Session-Service.
 *
 * Extrahiert in C3.0c aus server/index.js (~330–400 Zeilen).
 * Enthält ~30 Funktionen rund um Accounts, Identities, Memberships,
 * Passwörter, Sessions, Tokens, OIDC, Anonymous-Context, Permission-
 * Gates und API-Client-Auth.
 *
 * ===========================================================================
 *  SICHERHEITS-INVARIANTEN (drei Kernregeln, die jeder Refactorer kennt)
 * ===========================================================================
 *
 *  (1) PBKDF2-Iterations sind 120.000, aus `config/defaults.js` als
 *      `PASSWORD_ITERATIONS` exportiert. **Eine Änderung dieser Zahl
 *      invalidiert alle bestehenden Passwort-Hashes** (bestehende
 *      Accounts können sich nicht mehr anmelden). Jede Anpassung
 *      erfordert eine Migrations-Strategie (Re-Hashing beim nächsten
 *      Login oder Forced-Password-Reset).
 *
 *  (2) `hashPassword` und `verifyPassword` verwenden
 *      **`crypto.pbkdf2Sync` synchron** — nicht die async-Variante.
 *      Das ist bewusste Wahl: Die Server-Laufzeit-Auth blockiert den
 *      Event-Loop ohnehin für die Dauer eines Requests (read-json,
 *      db-query, write-audit), und die synchrone pbkdf2-Aufruf-
 *      Semantik ist deutlich einfacher zu überblicken als ein
 *      async-Handler mit Promise-Chaining in der Verifikations-
 *      Kritik-Pfad.
 *
 *  (3) `verifyPassword` verwendet **`crypto.timingSafeEqual`** für den
 *      Vergleich von erwartetem und berechnetem Hash. Das ist die
 *      konstant-zeitliche Vergleichs-Primitive, die Timing-Attacks
 *      verhindert. **Ein naiver `===`- oder `Buffer.compare`-Vergleich
 *      wäre ein stiller Security-Bug**: ein Angreifer könnte
 *      anhand der Antwortzeit das Passwort byte-weise rekonstruieren.
 *      `timingSafeEqual` erfordert gleiche Pufferlänge — das wird
 *      durch den vorherigen Längen-Check abgesichert.
 *
 *  Kein Refactoring dieser drei Funktionen (hashPassword,
 *  verifyPassword, createSessionToken) ohne vorherigen Review
 *  dieser Invarianten und ohne Security-Gegenprobe.
 *
 * ===========================================================================
 *
 * ABHÄNGIGKEITS-AUFLÖSUNG (strukturelle Entscheidung in C3.0c):
 *  - Runtime-derived Werte (authStrategy, runtimeConfig,
 *    AUTHENTICATION_REQUIRED, ANONYMOUS_ACCESS_ENABLED, GUEST_*) werden
 *    aus `config/runtime.js` importiert — **null Parameter-Erweiterung**
 *    bei den 8 betroffenen Funktionen.
 *  - `buildStateEnvelope` wird seit C3.5 **direkt aus
 *    `services/state.js` importiert**. Der Parameter an
 *    `buildSuccessfulAuthResponse` und `consumeAuthCallbackTicket`
 *    ist entfallen. Historische Begründung (als Nachweis, warum das
 *    Plumbing in C3.4 noch stehen blieb): `buildStateEnvelope` ist
 *    state-scoped, nicht evidence-scoped — es ruft
 *    `attachVersionMetadata` (evidence-aware), gehört aber semantisch
 *    zu den state-PUT-Handlern und wanderte deshalb gemeinsam mit der
 *    state-Route in C3.5 nach `services/state.js`. In C3.4 war
 *    `attachVersionMetadata` schon dort, `buildStateEnvelope` aber
 *    noch in `server/index.js` — der Parameter-Pfad überbrückte diese
 *    eine Iteration.
 *  - `readPlatformSettings` in `getApiClientContext` nutzt den
 *    Raw-Wrapper aus `persistence-wrappers.js` mit expliziten
 *    `defaultPlatformSettings`-Import aus `config/runtime.js`.
 */
import crypto from 'node:crypto';

import { isTimedRecordActive } from '../auth-provider.js';
import {
  OIDC_PROVIDER_ID,
  PASSWORD_ITERATIONS,
  SESSION_HOURS,
} from '../config/defaults.js';
import {
  ANONYMOUS_ACCESS_ENABLED,
  GUEST_ACCOUNT_ID,
  GUEST_USER_ID,
  authStrategy,
  defaultPlatformSettings,
  runtimeConfig,
} from '../config/runtime.js';
import { createId, httpError, nowIso } from './ids.js';
import {
  buildSeedUser,
  getRolePermissions,
  isLocalLoginAllowed,
  sanitizeAccountRecord,
  sanitizeArray,
  sanitizeIdentityRecord,
  sanitizeMembershipRecord,
  sanitizeRoleProfile,
  stableEqual,
} from './sanitizers.js';
import {
  readAccounts,
  readApiClients,
  readAuthCallbackTickets,
  readPlatformSettings as readPlatformSettingsRaw,
  readSessions,
  readState,
  readTenants,
  readPendingAuthFlows,
  writeAccounts,
  writeApiClients,
  writeAuthCallbackTickets,
  writePendingAuthFlows,
  writeSessions,
  writeState,
  appendAuditLog,
} from './persistence-wrappers.js';
// C3.5: buildStateEnvelope direkt aus services/state.js — löst das
// Parameter-Plumbing der beiden Auth-Response-Builder auf.
import { buildStateEnvelope } from './state.js';

// === Password-Crypto (Invarianten 1, 2, 3) =================================

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// === Session-Token + Date-Utility ==========================================

export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function plusHours(value, hours) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

// === Request-Parsing =======================================================

export function extractAuthToken(req) {
  const authHeader = String(req.header('authorization') || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

// === Account/Identity-Helper ===============================================

export function findAccountByIdentity(accounts, providerId, subject) {
  return sanitizeArray(accounts).find((account) => sanitizeArray(account.identities).some((identity) => identity?.providerId === providerId && identity?.subject === subject));
}

export function upsertExternalIdentity(account, profile, linkedAt = nowIso()) {
  const identities = sanitizeArray(account.identities).map((identity) => sanitizeIdentityRecord(identity));
  const nextIdentity = sanitizeIdentityRecord({
    providerId: profile.providerId,
    subject: profile.subject,
    issuer: profile.issuer,
    email: profile.email,
    linkedAt: identities.find((identity) => identity.providerId === profile.providerId && identity.subject === profile.subject)?.linkedAt || linkedAt,
    lastLoginAt: linkedAt,
    tenantHint: profile.tenantHint,
    roleHint: profile.roleHint,
    scopeHint: profile.scopeHint,
  });
  const index = identities.findIndex((identity) => identity.providerId === nextIdentity.providerId && identity.subject === nextIdentity.subject);
  if (index >= 0) {
    identities[index] = { ...identities[index], ...nextIdentity };
  } else {
    identities.push(nextIdentity);
  }

  return sanitizeAccountRecord({
    ...account,
    authSource: isLocalLoginAllowed(account) ? 'hybrid' : 'oidc',
    lastAuthProvider: profile.providerId,
    identities,
  });
}

export function resolveMembershipForAccount(account, requestedTenantId, tenantLookup) {
  const memberships = sanitizeArray(account.memberships).map((entry) => sanitizeMembershipRecord(entry));
  if (requestedTenantId) {
    const match = memberships.find((entry) => entry.tenantId === requestedTenantId);
    if (match) {
      return match;
    }
  }

  const activeMembership = memberships.find((entry) => tenantLookup.has(entry.tenantId));
  return activeMembership || memberships[0] || null;
}

export function buildAutoCreatedMembership(profile, tenantId, tenantName) {
  return sanitizeMembershipRecord({
    tenantId,
    roleProfile: sanitizeRoleProfile(profile.roleHint || authStrategy.oidc.defaultRoleProfile),
    workspaceUserId: createId('usr'),
    scope: profile.scopeHint || tenantName || tenantId,
  });
}

// === Session-Lifecycle =====================================================

export async function cleanupExpiredSessions() {
  const sessions = await readSessions();
  const now = Date.now();
  const active = sessions.filter((entry) => {
    const expiresAt = new Date(entry?.expiresAt || '').getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });

  if (active.length !== sessions.length) {
    await writeSessions(active);
  }
}

export async function cleanupExpiredAuthFlows() {
  const flows = await readPendingAuthFlows();
  const active = flows.filter((entry) => isTimedRecordActive(entry));
  if (active.length !== flows.length) {
    await writePendingAuthFlows(active);
  }
}

export async function cleanupExpiredAuthCallbackTickets() {
  const tickets = await readAuthCallbackTickets();
  const active = tickets.filter((entry) => isTimedRecordActive(entry));
  if (active.length !== tickets.length) {
    await writeAuthCallbackTickets(active);
  }
}

export async function createServerSession(account, membership, tenant, { providerId = 'local' } = {}) {
  const token = createSessionToken();
  const createdAt = nowIso();
  const expiresAt = plusHours(createdAt, SESSION_HOURS);
  const nextSessions = [
    {
      token,
      accountId: account.id,
      tenantId: membership.tenantId,
      createdAt,
      expiresAt,
      providerId,
    },
    ...(await readSessions()).filter((entry) => !(entry?.accountId === account.id && entry?.tenantId === membership.tenantId)),
  ];
  await writeSessions(nextSessions);
  return { token, createdAt, expiresAt };
}

export function presentSession({ session, account, membership, tenantName, includeToken = false }) {
  return {
    ...(includeToken ? { token: session.token } : {}),
    expiresAt: session.expiresAt,
    accountId: account.id,
    userId: membership.workspaceUserId,
    name: account.name,
    email: account.email,
    tenantId: membership.tenantId,
    tenantName,
    roleProfile: sanitizeRoleProfile(membership.roleProfile),
    permissions: getRolePermissions(membership.roleProfile),
    isSystemAdmin: Boolean(account.isSystemAdmin),
    authProvider: String(session.providerId || account.lastAuthProvider || 'local').trim() || 'local',
    status: account.status || 'active',
  };
}

// === Public/Anonymous-Tenant-Helper ========================================

export async function getPublicTenant(requestedTenantId = '') {
  const tenants = await readTenants();
  const activeTenants = sanitizeArray(tenants).filter((entry) => entry?.active !== false);
  if (!activeTenants.length) {
    throw httpError(503, 'Es ist noch kein Arbeitsbereich auf dem Server vorhanden.');
  }

  if (requestedTenantId) {
    const selected = activeTenants.find((entry) => entry?.id === requestedTenantId);
    if (selected) {
      return selected;
    }
  }

  return activeTenants[0];
}

export function buildAnonymousAccount() {
  return {
    id: GUEST_ACCOUNT_ID,
    name: 'Offener Lesemodus',
    email: '',
    status: 'active',
    isSystemAdmin: false,
  };
}

export function buildAnonymousMembership(tenant) {
  return {
    tenantId: tenant.id,
    roleProfile: runtimeConfig.anonymousRoleProfile,
    workspaceUserId: GUEST_USER_ID,
    scope: tenant.name || tenant.id,
  };
}

export function buildWorkspaceUserSeedFromContext(authContext) {
  return buildSeedUser({
    id: authContext.membership.workspaceUserId,
    name: authContext.account.name,
    email: authContext.account.email,
    roleProfile: sanitizeRoleProfile(authContext.membership.roleProfile),
    scope: authContext.membership.scope || authContext.tenant.name || authContext.membership.tenantId,
  });
}

export function findActiveTenant(tenants, tenantId) {
  return sanitizeArray(tenants).find((entry) => entry?.id === tenantId && entry?.active !== false) || null;
}

// === OIDC-Flow =============================================================

export function resolveOidcTargetTenant(tenants, requestedTenantId, profile) {
  const candidateIds = [requestedTenantId, profile?.tenantHint, authStrategy.oidc.defaultTenantId]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  for (const candidateId of candidateIds) {
    const tenant = findActiveTenant(tenants, candidateId);
    if (tenant) {
      return tenant;
    }
  }

  const activeTenants = sanitizeArray(tenants).filter((entry) => entry?.active !== false);
  if (activeTenants.length === 1) {
    return activeTenants[0];
  }

  return null;
}

export function ensureOidcCapableAccount(account, profile) {
  const nextName = String(account?.name || '').trim() || profile.name || profile.email || profile.subject;
  const nextEmail = String(account?.email || '').trim().toLowerCase() || profile.email;
  return sanitizeAccountRecord({
    ...account,
    name: nextName,
    email: nextEmail,
    authSource: isLocalLoginAllowed(account) ? 'hybrid' : 'oidc',
    lastAuthProvider: profile.providerId,
  });
}

export function resolveOidcAccount(accounts, profile) {
  const direct = findAccountByIdentity(accounts, profile.providerId, profile.subject);
  if (direct) {
    return { account: direct, resolution: 'identity' };
  }

  if (authStrategy.oidc.linkByEmail && profile.email) {
    const byEmail = sanitizeArray(accounts).find((entry) => entry?.email === profile.email && entry?.status !== 'inactive');
    if (byEmail) {
      return { account: byEmail, resolution: 'email' };
    }
  }

  return { account: null, resolution: 'none' };
}

export async function resolveOidcLoginContext({ profile, requestedTenantId }) {
  const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
  const tenantLookup = new Map(sanitizeArray(tenants).filter((entry) => entry?.active !== false).map((entry) => [entry.id, entry]));
  const resolved = resolveOidcAccount(accounts, profile);
  const loginAt = nowIso();

  let account = resolved.account ? ensureOidcCapableAccount(resolved.account, profile) : null;
  let accountIndex = account ? accounts.findIndex((entry) => entry.id === account.id) : -1;
  let created = false;
  let linked = false;

  if (!account) {
    if (!authStrategy.oidc.autoCreateAccounts) {
      throw httpError(403, 'Für diesen SSO-Benutzer ist noch kein Zugriffskonto freigegeben.');
    }
    const targetTenant = resolveOidcTargetTenant(tenants, requestedTenantId, profile);
    if (!targetTenant) {
      throw httpError(403, 'Der SSO-Benutzer konnte keinem aktiven Mandanten zugeordnet werden.');
    }
    if (!profile.email) {
      throw httpError(403, 'Das SSO-Profil enthält keine E-Mail-Adresse für die automatische Kontoanlage.');
    }

    const membership = buildAutoCreatedMembership(profile, targetTenant.id, targetTenant.name || targetTenant.id);
    account = sanitizeAccountRecord({
      id: createId('acct'),
      name: profile.name || profile.email,
      email: profile.email,
      status: 'active',
      isSystemAdmin: false,
      authSource: 'oidc',
      lastAuthProvider: profile.providerId,
      lastLoginAt: loginAt,
      memberships: [membership],
      identities: [],
    });
    accounts.unshift(account);
    accountIndex = 0;
    created = true;
  }

  account = upsertExternalIdentity(account, profile, loginAt);
  linked = resolved.resolution === 'email' || created;

  let membership = resolveMembershipForAccount(account, requestedTenantId || profile.tenantHint, tenantLookup);
  if (!membership) {
    const targetTenant = resolveOidcTargetTenant(tenants, requestedTenantId, profile);
    if (!targetTenant || !authStrategy.oidc.autoCreateAccounts) {
      throw httpError(403, 'Dem SSO-Benutzer ist kein aktiver Mandant zugeordnet.');
    }
    membership = buildAutoCreatedMembership(profile, targetTenant.id, targetTenant.name || targetTenant.id);
    account = sanitizeAccountRecord({
      ...account,
      memberships: [...sanitizeArray(account.memberships), membership],
    });
  }

  const tenant = findActiveTenant(tenants, membership.tenantId);
  if (!tenant) {
    throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
  }

  account = sanitizeAccountRecord({
    ...account,
    lastLoginAt: loginAt,
    lastAuthProvider: profile.providerId,
  });

  if (accountIndex >= 0) {
    accounts[accountIndex] = account;
  } else {
    accounts.unshift(account);
  }

  await writeAccounts(accounts);
  await ensureWorkspaceUser(membership.tenantId, membership, account);

  return {
    account,
    membership,
    tenant,
    created,
    linked,
  };
}

// === Context-Resolution (Anonymous + Authenticated) ========================

export async function buildAnonymousContext(req) {
  const requestedTenantId = String(req.query.tenantId || '').trim();
  const tenant = await getPublicTenant(requestedTenantId);
  const account = buildAnonymousAccount();
  const membership = buildAnonymousMembership(tenant);

  return {
    token: '',
    account,
    membership,
    tenant,
    session: null,
    sessionPublic: null,
    anonymous: true,
  };
}

export async function getAuthContext(req, allowAnonymous = false) {
  const token = extractAuthToken(req);
  if (!token) {
    if (allowAnonymous && ANONYMOUS_ACCESS_ENABLED) {
      return buildAnonymousContext(req);
    }
    throw httpError(401, 'Bitte zuerst anmelden, um Serverfunktionen zu nutzen.');
  }

  await Promise.all([cleanupExpiredSessions(), cleanupExpiredAuthFlows(), cleanupExpiredAuthCallbackTickets()]);
  const [sessions, accounts, tenants] = await Promise.all([readSessions(), readAccounts(), readTenants()]);
  const session = sessions.find((entry) => entry?.token === token);
  if (!session) {
    throw httpError(401, 'Die Serversitzung ist abgelaufen oder ungültig.');
  }

  const account = accounts.find((entry) => entry?.id === session.accountId && entry?.status !== 'inactive');
  if (!account) {
    throw httpError(401, 'Das Zugriffskonto ist nicht mehr verfügbar.');
  }

  const membership = sanitizeArray(account.memberships).find((entry) => entry?.tenantId === session.tenantId);
  if (!membership) {
    throw httpError(403, 'Für diesen Mandanten besteht keine gültige Mitgliedschaft mehr.');
  }

  const tenant = tenants.find((entry) => entry?.id === membership.tenantId);
  if (!tenant || tenant.active === false) {
    throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
  }

  return {
    token,
    account,
    membership,
    tenant,
    session,
    sessionPublic: presentSession({ session, account, membership, tenantName: tenant.name || membership.tenantId }),
    anonymous: false,
  };
}

// === Permission-Gates ======================================================

export function assertPermissions(requiredPermissions, authContext) {
  const granted = getRolePermissions(authContext.membership.roleProfile);
  const missing = requiredPermissions.filter((permission) => !granted.includes(permission));
  if (missing.length) {
    throw httpError(
      403,
      `Der angemeldete Nutzer ${authContext.account.name || authContext.account.email} darf diesen Schreibvorgang nicht ausführen.`,
      missing.map((permission) => `Fehlende Berechtigung: ${permission}`),
    );
  }
}

export function ensureSystemAdmin(authContext) {
  if (!authContext.account?.isSystemAdmin) {
    throw httpError(403, 'Für diesen Vorgang wird ein systemweites Administratorkonto benötigt.');
  }
}

// === API-Client-Auth =======================================================

export async function getApiClientContext(req) {
  const settings = await readPlatformSettingsRaw(defaultPlatformSettings);
  if (!settings.publicApiEnabled) {
    throw httpError(403, 'Die öffentliche Integrations-API ist aktuell deaktiviert.');
  }

  const authHeader = String(req.header('authorization') || '').trim();
  const headerToken = String(req.header('x-api-key') || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const token = headerToken || bearerToken;

  if (!token) {
    throw httpError(401, 'Für die Integrations-API ist ein gültiger API-Schlüssel erforderlich.');
  }

  const [clients, tenants] = await Promise.all([readApiClients(), readTenants()]);
  const clientIndex = clients.findIndex((client) => (
    client.status === 'active'
      && client.secretSalt
      && client.secretHash
      && verifyPassword(token, client.secretSalt, client.secretHash)
  ));

  if (clientIndex < 0) {
    throw httpError(401, 'Der API-Schlüssel ist ungültig oder wurde widerrufen.');
  }

  const client = clients[clientIndex];
  if (client.expiresAt) {
    const expiresAt = new Date(client.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      throw httpError(401, 'Der API-Schlüssel ist abgelaufen.');
    }
  }

  clients[clientIndex] = {
    ...client,
    lastUsedAt: nowIso(),
  };
  await writeApiClients(clients);

  const tenant = client.tenantId
    ? tenants.find((entry) => entry.id === client.tenantId) || null
    : null;

  return {
    client: clients[clientIndex],
    tenant,
    settings,
  };
}

export function assertApiClientScopes(requiredScopes, apiContext) {
  const missing = requiredScopes.filter((scope) => !sanitizeArray(apiContext.client.scopes).includes(scope));
  if (missing.length) {
    throw httpError(403, 'Dem API-Client fehlen erforderliche Scopes.', missing);
  }
}

// === Tenant-State-User-Merge ===============================================

export async function ensureWorkspaceUser(tenantId, membership, account) {
  const state = await readState(tenantId);
  const nextUsers = [...sanitizeArray(state.users)];
  const existingIndex = nextUsers.findIndex((user) => user?.id === membership.workspaceUserId || (user?.email && user.email === account.email));
  const nextUser = buildSeedUser({
    id: membership.workspaceUserId,
    name: account.name,
    email: account.email,
    roleProfile: sanitizeRoleProfile(membership.roleProfile),
    scope: membership.scope || state.companyProfile?.companyName || 'Gesamtprogramm',
  });

  if (existingIndex >= 0) {
    nextUsers[existingIndex] = {
      ...nextUsers[existingIndex],
      ...nextUser,
      id: membership.workspaceUserId,
    };
  } else {
    nextUsers.unshift(nextUser);
  }

  if (!stableEqual(nextUsers, state.users)) {
    await writeState(tenantId, {
      ...state,
      users: nextUsers,
    });
  }

  return nextUser;
}

// === Auth-Response-Builder (seit C3.5 buildStateEnvelope direkt importiert) ==
//
// Diese beiden Funktionen konsumieren buildStateEnvelope (state-scoped,
// evidence-aware Derivation). Seit C3.5 wird die Funktion direkt aus
// services/state.js importiert (siehe top-of-file). Das frühere
// Parameter-Plumbing ist entfallen — der historische Hintergrund steht
// im Doc-Block am Dateianfang (Abschnitt „Abhängigkeits-Auflösung").

export async function buildSuccessfulAuthResponse(
  { account, membership, tenant, providerId = 'local' },
) {
  await ensureWorkspaceUser(membership.tenantId, membership, account);
  const sessionData = await createServerSession(account, membership, tenant, { providerId });
  const updatedAccount = sanitizeAccountRecord({
    ...account,
    lastLoginAt: sessionData.createdAt,
    lastAuthProvider: providerId,
  });
  const accounts = await readAccounts();
  const nextAccounts = accounts.map((entry) => (entry.id === updatedAccount.id ? updatedAccount : entry));
  await writeAccounts(nextAccounts);

  const sessionPublic = presentSession({
    session: { token: sessionData.token, expiresAt: sessionData.expiresAt },
    account: updatedAccount,
    membership,
    tenantName: tenant.name || membership.tenantId,
    includeToken: true,
  });

  const stateEnvelope = await buildStateEnvelope(membership.tenantId, await readState(membership.tenantId));
  await appendAuditLog(membership.tenantId, {
    id: createId('audit'),
    at: sessionData.createdAt,
    userId: updatedAccount.id,
    userName: updatedAccount.name,
    action: providerId === OIDC_PROVIDER_ID ? 'SSO-Anmeldung' : 'Anmeldung',
    resource: 'auth',
    summary: `${providerId === OIDC_PROVIDER_ID ? 'SSO' : 'Server'}-Anmeldung für Mandant „${tenant.name || membership.tenantId}".`,
    sections: ['auth'],
  });

  const tenantLookup = new Map((await readTenants()).map((entry) => [entry.id, entry]));

  return {
    ok: true,
    session: sessionPublic,
    ...stateEnvelope,
    accessibleTenants: sanitizeArray(updatedAccount.memberships).map((entry) => ({
      tenantId: entry.tenantId,
      tenantName: tenantLookup.get(entry.tenantId)?.name || entry.tenantId,
      roleProfile: sanitizeRoleProfile(entry.roleProfile),
    })),
    workspaceUserSeed: buildWorkspaceUserSeedFromContext({ account: updatedAccount, membership, tenant }),
  };
}

export async function consumeAuthCallbackTicket(ticketId) {
  await cleanupExpiredAuthCallbackTickets();
  const tickets = await readAuthCallbackTickets();
  const ticket = tickets.find((entry) => entry.id === ticketId);
  if (!ticket) {
    throw httpError(401, 'Das Authentifizierungsticket ist abgelaufen oder wurde bereits verbraucht.');
  }

  const sessions = await readSessions();
  const session = sessions.find((entry) => entry?.token === ticket.sessionToken);
  if (!session) {
    throw httpError(401, 'Die vorbereitete Serversitzung konnte nicht mehr gefunden werden.');
  }

  const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
  const account = accounts.find((entry) => entry?.id === session.accountId && entry?.status !== 'inactive');
  if (!account) {
    throw httpError(401, 'Das zugehörige Zugriffskonto ist nicht mehr verfügbar.');
  }
  const membership = sanitizeArray(account.memberships).find((entry) => entry?.tenantId === session.tenantId);
  const tenant = tenants.find((entry) => entry?.id === session.tenantId && entry?.active !== false);
  if (!membership || !tenant) {
    throw httpError(403, 'Der vorbereitete Mandant ist nicht mehr aktiv.');
  }

  await writeAuthCallbackTickets(tickets.filter((entry) => entry.id !== ticketId));
  await ensureWorkspaceUser(membership.tenantId, membership, account);

  return {
    ok: true,
    session: presentSession({
      session,
      account,
      membership,
      tenantName: tenant.name || membership.tenantId,
      includeToken: true,
    }),
    ...(await buildStateEnvelope(membership.tenantId, await readState(membership.tenantId))),
    accessibleTenants: sanitizeArray(account.memberships).map((entry) => ({
      tenantId: entry.tenantId,
      tenantName: tenants.find((tenantEntry) => tenantEntry.id === entry.tenantId)?.name || entry.tenantId,
      roleProfile: sanitizeRoleProfile(entry.roleProfile),
    })),
    workspaceUserSeed: buildWorkspaceUserSeedFromContext({ account, membership, tenant }),
  };
}
