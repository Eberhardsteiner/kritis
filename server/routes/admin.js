import { asyncRoute } from './utils.js';

export function registerAdminRoutes(app, deps) {
  const {
    getAuthContext,
    ensureSystemAdmin,
    assertPermissions,
    listTenantSummaries,
    DEFAULT_DEMO_PASSWORD,
    httpError,
    readTenants,
    slugify,
    createId,
    buildSeedState,
    ensureTenantStorage,
    writeState,
    nowIso,
    writeTenants,
    readAccounts,
    sanitizeArray,
    hashPassword,
    writeAccounts,
    sanitizeObject,
    sanitizeTenantRecord,
    sanitizeAccountForResponse,
    normalizeAuthSource,
    sanitizeRoleProfile,
    sanitizeMembershipRecord,
    sanitizeAccountRecord,
    ensureWorkspaceUser,
  } = deps;

  app.get('/api/admin/tenants', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    const summaries = await listTenantSummaries(
      authContext.account.isSystemAdmin
        ? null
        : [authContext.tenant],
    );
    res.json({ ok: true, tenants: summaries });
  }));

  app.post('/api/admin/tenants', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);

    const name = String(req.body?.name || '').trim();
    const industryLabel = String(req.body?.industryLabel || '').trim();
    const adminName = String(req.body?.adminName || '').trim() || 'Mandantenadmin';
    const adminEmail = String(req.body?.adminEmail || '').trim().toLowerCase();
    const adminPassword = String(req.body?.adminPassword || '').trim() || DEFAULT_DEMO_PASSWORD;
    const requestedSlug = String(req.body?.slug || '').trim();

    if (!name || !adminEmail) {
      throw httpError(400, 'Bitte Mandantenname und Admin-E-Mail angeben.');
    }

    const tenants = await readTenants();
    const baseSlug = slugify(requestedSlug || name) || 'mandant';
    let tenantId = baseSlug;
    let suffix = 1;
    while (tenants.some((entry) => entry?.id === tenantId)) {
      tenantId = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const workspaceUserId = createId('usr');
    const initialState = buildSeedState({
      companyName: name,
      industryLabel,
      adminName,
      adminEmail,
      workspaceUserId,
      roleProfile: 'admin',
    });

    await ensureTenantStorage(tenantId, initialState);
    await writeState(tenantId, initialState);

    const tenantRecord = {
      id: tenantId,
      name,
      slug: tenantId,
      industryLabel,
      createdAt: nowIso(),
      active: true,
    };
    await writeTenants([...tenants, tenantRecord]);

    const accounts = await readAccounts();
    const normalizedEmail = adminEmail.toLowerCase();
    const existingAccount = accounts.find((entry) => String(entry?.email || '').toLowerCase() === normalizedEmail);

    let nextAccounts = [...accounts];
    if (existingAccount) {
      nextAccounts = nextAccounts.map((entry) => {
        if (entry.id !== existingAccount.id) {
          return entry;
        }
        const memberships = sanitizeArray(entry.memberships).some((membership) => membership?.tenantId === tenantId)
          ? sanitizeArray(entry.memberships)
          : [...sanitizeArray(entry.memberships), {
              tenantId,
              roleProfile: 'admin',
              workspaceUserId,
              scope: name,
            }];
        return {
          ...entry,
          name: entry.name || adminName,
          memberships,
        };
      });
    } else {
      const passwordData = hashPassword(adminPassword);
      nextAccounts.push({
        id: createId('acct'),
        name: adminName,
        email: normalizedEmail,
        status: 'active',
        isSystemAdmin: false,
        authSource: 'local',
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash,
        lastLoginAt: '',
        lastAuthProvider: '',
        identities: [],
        memberships: [{ tenantId, roleProfile: 'admin', workspaceUserId, scope: name }],
      });
    }

    nextAccounts = nextAccounts.map((entry) => {
      if (entry.id !== authContext.account.id) {
        return entry;
      }
      const memberships = sanitizeArray(entry.memberships).some((membership) => membership?.tenantId === tenantId)
        ? sanitizeArray(entry.memberships)
        : [...sanitizeArray(entry.memberships), {
            tenantId,
            roleProfile: 'admin',
            workspaceUserId: createId('usr'),
            scope: `${name} (Systemzugriff)`,
          }];
      return { ...entry, memberships };
    });

    await writeAccounts(nextAccounts);
    res.json({ ok: true, tenant: (await listTenantSummaries([tenantRecord]))[0] });
  }));

  app.put('/api/admin/tenants/:tenantId', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);

    const tenantId = String(req.params.tenantId || '').trim();
    const patch = sanitizeObject(req.body?.patch);
    const tenants = await readTenants();
    const index = tenants.findIndex((entry) => entry.id === tenantId);

    if (index < 0) {
      throw httpError(404, 'Der Mandant wurde nicht gefunden.');
    }

    const current = tenants[index];
    tenants[index] = sanitizeTenantRecord({
      ...current,
      ...patch,
      id: current.id,
      slug: current.slug,
      createdAt: current.createdAt,
    });

    await writeTenants(tenants);
    res.json({
      ok: true,
      tenant: (await listTenantSummaries([tenants[index]]))[0],
    });
  }));

  app.get('/api/admin/accounts', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);
    const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
    const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
    const visibleAccounts = sanitizeArray(accounts).filter((account) => (
      authContext.account.isSystemAdmin
        ? true
        : sanitizeArray(account.memberships).some((membership) => membership?.tenantId === authContext.membership.tenantId)
    ));

    res.json({
      ok: true,
      accounts: visibleAccounts.map((account) => sanitizeAccountForResponse(account, tenantLookup)),
    });
  }));

  app.post('/api/admin/accounts', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);

    const targetTenantId = authContext.account.isSystemAdmin
      ? String(req.body?.tenantId || authContext.membership.tenantId).trim()
      : authContext.membership.tenantId;
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();
    const roleProfile = sanitizeRoleProfile(String(req.body?.roleProfile || 'editor'));
    const authSource = normalizeAuthSource(String(req.body?.authSource || 'local').trim() || 'local');
    const status = String(req.body?.status || 'active').trim() || 'active';
    const scope = String(req.body?.scope || '').trim();
    const requestedWorkspaceUserId = String(req.body?.workspaceUserId || '').trim();

    if (!name || !email) {
      throw httpError(400, 'Bitte Name und E-Mail für das Zugriffskonto angeben.');
    }

    const tenants = await readTenants();
    const tenant = tenants.find((entry) => entry?.id === targetTenantId && entry?.active !== false);
    if (!tenant) {
      throw httpError(404, 'Der Zielmandant wurde nicht gefunden.');
    }

    const accounts = await readAccounts();
    const accountIndex = accounts.findIndex((entry) => String(entry?.email || '').toLowerCase() === email);
    const workspaceUserId = requestedWorkspaceUserId || createId('usr');
    const membershipPatch = sanitizeMembershipRecord({
      tenantId: targetTenantId,
      roleProfile,
      workspaceUserId,
      scope: scope || tenant.name || targetTenantId,
    });

    let account;
    if (accountIndex >= 0) {
      account = sanitizeAccountRecord(accounts[accountIndex]);
      const memberships = sanitizeArray(account.memberships).map((entry) => sanitizeMembershipRecord(entry));
      const membershipIndex = memberships.findIndex((entry) => entry?.tenantId === targetTenantId);
      if (membershipIndex >= 0) {
        memberships[membershipIndex] = { ...memberships[membershipIndex], ...membershipPatch };
      } else {
        memberships.push(membershipPatch);
      }

      account = sanitizeAccountRecord({
        ...account,
        name,
        status,
        authSource,
        memberships,
        passwordSalt: authSource === 'oidc' ? '' : account.passwordSalt,
        passwordHash: authSource === 'oidc' ? '' : account.passwordHash,
      });

      if ((authSource === 'local' || authSource === 'hybrid') && password) {
        const passwordData = hashPassword(password);
        account = sanitizeAccountRecord({
          ...account,
          passwordSalt: passwordData.salt,
          passwordHash: passwordData.hash,
        });
      }

      if ((authSource === 'local' || authSource === 'hybrid') && !password && !account.passwordHash) {
        throw httpError(400, 'Für lokale oder hybride Konten ist ein Passwort erforderlich.');
      }

      accounts[accountIndex] = account;
    } else {
      if ((authSource === 'local' || authSource === 'hybrid') && !password) {
        throw httpError(400, 'Für neue lokale oder hybride Zugriffskonten ist ein Initialpasswort erforderlich.');
      }

      const passwordData = password ? hashPassword(password) : { salt: '', hash: '' };
      account = sanitizeAccountRecord({
        id: createId('acct'),
        name,
        email,
        status,
        isSystemAdmin: false,
        authSource,
        passwordSalt: authSource === 'oidc' ? '' : passwordData.salt,
        passwordHash: authSource === 'oidc' ? '' : passwordData.hash,
        lastLoginAt: '',
        lastAuthProvider: '',
        identities: [],
        memberships: [membershipPatch],
      });
      accounts.push(account);
    }

    await writeAccounts(accounts);
    await ensureWorkspaceUser(targetTenantId, membershipPatch, account);
    const tenantLookup = new Map(tenants.map((entry) => [entry.id, entry]));
    res.json({ ok: true, account: sanitizeAccountForResponse(account, tenantLookup) });
  }));

  app.post('/api/admin/accounts/:accountId/reset-password', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);
    const password = String(req.body?.password || '').trim();
    if (!password) {
      throw httpError(400, 'Bitte ein neues Passwort angeben.');
    }

    const accounts = await readAccounts();
    const accountIndex = accounts.findIndex((entry) => entry?.id === req.params.accountId);
    if (accountIndex < 0) {
      throw httpError(404, 'Zugriffskonto wurde nicht gefunden.');
    }

    const account = sanitizeAccountRecord(accounts[accountIndex]);
    const hasTenantAccess = sanitizeArray(account.memberships).some((membership) => membership?.tenantId === authContext.membership.tenantId);
    if (!authContext.account.isSystemAdmin && !hasTenantAccess) {
      throw httpError(403, 'Das Passwort kann nur für Konten des eigenen Mandanten zurückgesetzt werden.');
    }

    const passwordData = hashPassword(password);
    accounts[accountIndex] = sanitizeAccountRecord({
      ...account,
      authSource: account.authSource === 'oidc' ? 'hybrid' : account.authSource,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
    });
    await writeAccounts(accounts);
    res.json({ ok: true });
  }));
}
