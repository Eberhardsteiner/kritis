import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.KRISENFEST_API_PORT || 8787);
const MAX_JSON_SIZE = '20mb';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_AUDIT_ENTRIES = 300;
const SNAPSHOT_LIMIT = 40;
const SESSION_HOURS = 12;
const PASSWORD_ITERATIONS = 120_000;
const DEFAULT_DEMO_PASSWORD = 'Krisenfest2026!';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const storageDir = path.join(rootDir, 'server-storage');
const systemDir = path.join(storageDir, 'system');
const tenantsDir = path.join(storageDir, 'tenants');
const globalTmpDir = path.join(storageDir, 'tmp');
const tenantsFile = path.join(systemDir, 'tenants.json');
const accountsFile = path.join(systemDir, 'auth.json');
const sessionsFile = path.join(systemDir, 'sessions.json');

const legacyStateFile = path.join(storageDir, 'state.json');
const legacyAuditLogFile = path.join(storageDir, 'audit-log.json');
const legacyUploadsDir = path.join(storageDir, 'uploads');
const legacySnapshotsDir = path.join(storageDir, 'snapshots');

const upload = multer({
  dest: globalTmpDir,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const collaborativeStateDefaults = {
  uploadedModules: [],
  answers: {},
  requirementStates: {},
  companyProfile: {
    companyName: '',
    industryLabel: '',
    locations: '',
    employees: '',
    criticalService: '',
    personsServed: '',
  },
  actionItems: [],
  evidenceItems: [],
  stakeholders: [],
  sites: [],
  assets: [],
  reviewPlan: {
    executiveSponsor: '',
    approver: '',
    nextInternalAuditDate: '',
    nextManagementReviewDate: '',
    nextExerciseDate: '',
    nextEvidenceReviewDate: '',
  },
  users: [],
  complianceCalendar: {
    registrationDate: '',
    lastRiskAssessmentDate: '',
    lastResiliencePlanUpdate: '',
    lastBsiEvidenceAuditDate: '',
    incidentContact: '',
    incidentBackupContact: '',
  },
  auditChecklistStates: {},
  auditFindings: [],
  certificationState: {
    auditLead: '',
    targetDate: '',
    decisionNote: '',
    stageStates: {},
  },
};

const rolePermissions = {
  admin: [
    'assessment_edit',
    'actions_edit',
    'evidence_edit',
    'governance_edit',
    'workspace_edit',
    'modules_manage',
    'kritis_edit',
    'reports_export',
  ],
  lead: [
    'assessment_edit',
    'actions_edit',
    'evidence_edit',
    'governance_edit',
    'workspace_edit',
    'kritis_edit',
    'reports_export',
  ],
  editor: [
    'assessment_edit',
    'actions_edit',
    'evidence_edit',
    'governance_edit',
    'kritis_edit',
    'reports_export',
  ],
  reviewer: ['evidence_edit', 'kritis_edit', 'reports_export'],
  auditor: ['reports_export'],
  viewer: [],
};

const sectionPermissionMap = {
  uploadedModules: 'modules_manage',
  answers: 'assessment_edit',
  requirementStates: 'kritis_edit',
  companyProfile: 'assessment_edit',
  actionItems: 'actions_edit',
  evidenceItems: 'evidence_edit',
  stakeholders: 'governance_edit',
  sites: 'governance_edit',
  assets: 'governance_edit',
  reviewPlan: 'governance_edit',
  users: 'workspace_edit',
  complianceCalendar: 'workspace_edit',
  auditChecklistStates: 'kritis_edit',
  auditFindings: 'kritis_edit',
  certificationState: 'kritis_edit',
};

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeObject(value) {
  return isPlainObject(value) ? value : {};
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß_.-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function sanitizeRoleProfile(value) {
  return rolePermissions[value] ? value : 'viewer';
}

function sanitizeState(input) {
  const raw = sanitizeObject(input);
  return {
    uploadedModules: sanitizeArray(raw.uploadedModules),
    answers: sanitizeObject(raw.answers),
    requirementStates: sanitizeObject(raw.requirementStates),
    companyProfile: {
      ...collaborativeStateDefaults.companyProfile,
      ...sanitizeObject(raw.companyProfile),
    },
    actionItems: sanitizeArray(raw.actionItems),
    evidenceItems: sanitizeArray(raw.evidenceItems),
    stakeholders: sanitizeArray(raw.stakeholders),
    sites: sanitizeArray(raw.sites),
    assets: sanitizeArray(raw.assets),
    reviewPlan: {
      ...collaborativeStateDefaults.reviewPlan,
      ...sanitizeObject(raw.reviewPlan),
    },
    users: sanitizeArray(raw.users),
    complianceCalendar: {
      ...collaborativeStateDefaults.complianceCalendar,
      ...sanitizeObject(raw.complianceCalendar),
    },
    auditChecklistStates: sanitizeObject(raw.auditChecklistStates),
    auditFindings: sanitizeArray(raw.auditFindings),
    certificationState: {
      ...collaborativeStateDefaults.certificationState,
      ...sanitizeObject(raw.certificationState),
      stageStates: sanitizeObject(raw?.certificationState?.stageStates),
    },
  };
}

function getRolePermissions(roleProfile) {
  return rolePermissions[sanitizeRoleProfile(roleProfile)] ?? rolePermissions.viewer;
}

function buildSeedUser({ id, name, email, roleProfile = 'admin', scope = 'Gesamtprogramm' }) {
  return {
    id,
    name,
    email,
    department: '',
    roleProfile,
    status: 'active',
    scope,
    notes: 'Automatisch angelegter Zugriff',
  };
}

function buildSeedState({ companyName, adminName, adminEmail, workspaceUserId, roleProfile = 'admin', industryLabel = '' }) {
  const state = sanitizeState({
    ...collaborativeStateDefaults,
    companyProfile: {
      ...collaborativeStateDefaults.companyProfile,
      companyName,
      industryLabel,
    },
    users: [buildSeedUser({
      id: workspaceUserId,
      name: adminName,
      email: adminEmail,
      roleProfile,
      scope: companyName || 'Gesamtprogramm',
    })],
  });

  return state;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function plusHours(value, hours) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function tenantPaths(tenantId) {
  const dir = path.join(tenantsDir, tenantId);
  return {
    dir,
    stateFile: path.join(dir, 'state.json'),
    auditLogFile: path.join(dir, 'audit-log.json'),
    snapshotsDir: path.join(dir, 'snapshots'),
    uploadsDir: path.join(dir, 'uploads'),
    versionsFile: path.join(dir, 'document-versions.json'),
  };
}

async function ensureTenantStorage(tenantId, initialState = undefined) {
  const paths = tenantPaths(tenantId);
  await ensureDir(paths.dir);
  await ensureDir(paths.snapshotsDir);
  await ensureDir(paths.uploadsDir);
  if (!fsSync.existsSync(paths.stateFile)) {
    await writeJsonFile(paths.stateFile, sanitizeState(initialState ?? collaborativeStateDefaults));
  }
  if (!fsSync.existsSync(paths.auditLogFile)) {
    await writeJsonFile(paths.auditLogFile, []);
  }
  if (!fsSync.existsSync(paths.versionsFile)) {
    await writeJsonFile(paths.versionsFile, []);
  }
}

async function readTenants() {
  return sanitizeArray(await readJsonFile(tenantsFile, []));
}

async function writeTenants(value) {
  await writeJsonFile(tenantsFile, sanitizeArray(value));
}

async function readAccounts() {
  return sanitizeArray(await readJsonFile(accountsFile, []));
}

async function writeAccounts(value) {
  await writeJsonFile(accountsFile, sanitizeArray(value));
}

async function readSessions() {
  return sanitizeArray(await readJsonFile(sessionsFile, []));
}

async function writeSessions(value) {
  await writeJsonFile(sessionsFile, sanitizeArray(value));
}

async function readState(tenantId) {
  const paths = tenantPaths(tenantId);
  const value = await readJsonFile(paths.stateFile, {});
  return sanitizeState(value);
}

async function writeState(tenantId, value) {
  const sanitized = sanitizeState(value);
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.stateFile, sanitized);
  return sanitized;
}

async function readAuditLog(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeArray(await readJsonFile(paths.auditLogFile, []));
}

async function appendAuditLog(tenantId, entry) {
  const paths = tenantPaths(tenantId);
  const auditEntries = sanitizeArray(await readJsonFile(paths.auditLogFile, []));
  auditEntries.unshift(entry);
  await writeJsonFile(paths.auditLogFile, auditEntries.slice(0, MAX_AUDIT_ENTRIES));
}

async function readVersions(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeArray(await readJsonFile(paths.versionsFile, []));
}

async function writeVersions(tenantId, value) {
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.versionsFile, sanitizeArray(value));
}

async function listSnapshotFiles(tenantId) {
  const paths = tenantPaths(tenantId);
  const files = await fs.readdir(paths.snapshotsDir).catch(() => []);
  return files.filter((fileName) => fileName.endsWith('.json')).sort().reverse();
}

async function listSnapshots(tenantId) {
  const paths = tenantPaths(tenantId);
  const files = await listSnapshotFiles(tenantId);
  const snapshots = [];

  for (const fileName of files) {
    const payload = await readJsonFile(path.join(paths.snapshotsDir, fileName), null);
    if (payload?.meta) {
      snapshots.push(payload.meta);
    }
  }

  return snapshots;
}

async function getSnapshotPayload(tenantId, snapshotId) {
  const paths = tenantPaths(tenantId);
  const snapshotPath = path.join(paths.snapshotsDir, `${snapshotId}.json`);
  const payload = await readJsonFile(snapshotPath, null);
  if (!payload?.meta || !payload?.state) {
    throw httpError(404, 'Snapshot wurde nicht gefunden.');
  }
  return payload;
}

function stableEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function detectChangedSections(currentState, nextState) {
  return Object.keys(sectionPermissionMap).filter((section) => !stableEqual(currentState?.[section], nextState?.[section]));
}

function extractAuthToken(req) {
  const authHeader = String(req.header('authorization') || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const queryToken = String(req.query.session || '').trim();
  return queryToken || '';
}

async function cleanupExpiredSessions() {
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

function presentSession({ session, account, membership, tenantName }) {
  return {
    token: session.token,
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
    status: account.status || 'active',
  };
}

async function getAuthContext(req) {
  const token = extractAuthToken(req);
  if (!token) {
    throw httpError(401, 'Bitte zuerst anmelden, um Serverfunktionen zu nutzen.');
  }

  await cleanupExpiredSessions();
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
  };
}

function assertPermissions(requiredPermissions, authContext) {
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

function ensureSystemAdmin(authContext) {
  if (!authContext.account?.isSystemAdmin) {
    throw httpError(403, 'Für diesen Vorgang wird ein systemweites Administratorkonto benötigt.');
  }
}

function attachmentFileNamesFromState(state) {
  const evidenceItems = sanitizeArray(state?.evidenceItems);
  return new Set(
    evidenceItems
      .map((item) => item?.serverAttachment?.storedFileName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

function versionFileNamesFromLedger(versions) {
  return new Set(
    sanitizeArray(versions)
      .map((entry) => entry?.storedFileName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

async function cleanupOrphanUploads(previousState, nextState, tenantId) {
  const previousNames = attachmentFileNamesFromState(previousState);
  const nextNames = attachmentFileNamesFromState(nextState);
  const versionNames = versionFileNamesFromLedger(await readVersions(tenantId));
  const paths = tenantPaths(tenantId);

  await Promise.all(
    [...previousNames]
      .filter((name) => !nextNames.has(name) && !versionNames.has(name))
      .map(async (name) => {
        try {
          await fs.unlink(path.join(paths.uploadsDir, name));
        } catch {
          // ignore cleanup failures
        }
      }),
  );
}

async function computeSha256(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function buildDownloadUrl(storedFileName, originalName = '') {
  const filePart = encodeURIComponent(storedFileName);
  const namePart = encodeURIComponent(originalName || storedFileName);
  return `/api/files/${filePart}?download=${namePart}`;
}

async function attachVersionMetadata(tenantId, state) {
  const versions = await readVersions(tenantId);
  const countByEvidenceId = sanitizeArray(versions).reduce((accumulator, entry) => {
    if (!entry?.evidenceId) {
      return accumulator;
    }
    accumulator[entry.evidenceId] = (accumulator[entry.evidenceId] || 0) + 1;
    return accumulator;
  }, {});

  return {
    ...state,
    evidenceItems: sanitizeArray(state.evidenceItems).map((item) => {
      if (!item?.serverAttachment) {
        return item;
      }

      const currentVersion = sanitizeArray(versions).find((entry) => entry?.id === item.serverAttachment?.versionId)
        ?? sanitizeArray(versions).find((entry) => entry?.evidenceId === item.id && entry?.current);

      return {
        ...item,
        serverAttachment: {
          ...item.serverAttachment,
          versionId: currentVersion?.id,
          checksumSha256: currentVersion?.checksumSha256,
          historyCount: countByEvidenceId[item.id] || 0,
          url: buildDownloadUrl(item.serverAttachment.storedFileName, item.serverAttachment.fileName),
        },
      };
    }),
  };
}

function listEvidenceVersionEntries(versions, evidenceId) {
  return sanitizeArray(versions)
    .filter((entry) => entry?.evidenceId === evidenceId)
    .sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')))
    .map((entry) => ({
      id: entry.id,
      evidenceId: entry.evidenceId,
      versionLabel: entry.versionLabel || '',
      fileName: entry.fileName,
      storedFileName: entry.storedFileName,
      mimeType: entry.mimeType,
      sizeKb: entry.sizeKb,
      uploadedAt: entry.uploadedAt,
      uploadedBy: entry.uploadedBy,
      checksumSha256: entry.checksumSha256,
      classification: entry.classification || 'intern',
      current: Boolean(entry.current),
      downloadUrl: buildDownloadUrl(entry.storedFileName, entry.fileName),
    }));
}

async function buildDocumentLedgerSummary(tenantId) {
  const versions = sanitizeArray(await readVersions(tenantId));
  const sorted = [...versions].sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')));
  const evidenceIds = new Set(sorted.map((entry) => entry?.evidenceId).filter(Boolean));
  const currentAttachments = sorted.filter((entry) => entry?.current).length;

  return {
    totalVersions: sorted.length,
    evidenceWithHistory: evidenceIds.size,
    currentAttachments,
    latestActivityAt: sorted[0]?.uploadedAt || '',
    recentEntries: sorted.slice(0, 10).map((entry) => ({
      id: entry.id,
      evidenceId: entry.evidenceId,
      versionLabel: entry.versionLabel || '',
      fileName: entry.fileName,
      storedFileName: entry.storedFileName,
      mimeType: entry.mimeType,
      sizeKb: entry.sizeKb,
      uploadedAt: entry.uploadedAt,
      uploadedBy: entry.uploadedBy,
      checksumSha256: entry.checksumSha256,
      classification: entry.classification || 'intern',
      current: Boolean(entry.current),
      downloadUrl: buildDownloadUrl(entry.storedFileName, entry.fileName),
    })),
  };
}

async function listTenantSummaries(tenantSubset = null) {
  const tenants = tenantSubset ?? await readTenants();
  const summaries = [];

  for (const tenant of sanitizeArray(tenants)) {
    const state = await readState(tenant.id);
    const audit = await readAuditLog(tenant.id);
    const versions = await readVersions(tenant.id);
    const stateStat = await fs.stat(tenantPaths(tenant.id).stateFile).catch(() => null);

    summaries.push({
      id: tenant.id,
      name: tenant.name || tenant.id,
      slug: tenant.slug || tenant.id,
      industryLabel: tenant.industryLabel || state.companyProfile?.industryLabel || '',
      companyName: state.companyProfile?.companyName || '',
      createdAt: tenant.createdAt || '',
      active: tenant.active !== false,
      userCount: sanitizeArray(state.users).length,
      evidenceCount: sanitizeArray(state.evidenceItems).length,
      actionCount: sanitizeArray(state.actionItems).length,
      snapshotCount: (await listSnapshotFiles(tenant.id)).length,
      versionCount: sanitizeArray(versions).length,
      auditLogCount: sanitizeArray(audit).length,
      updatedAt: stateStat?.mtime?.toISOString?.() || '',
    });
  }

  return summaries.sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

function sanitizeAccountForResponse(account, tenantLookup) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    status: account.status || 'active',
    isSystemAdmin: Boolean(account.isSystemAdmin),
    lastLoginAt: account.lastLoginAt || '',
    memberships: sanitizeArray(account.memberships).map((membership) => ({
      tenantId: membership.tenantId,
      tenantName: tenantLookup.get(membership.tenantId)?.name || membership.tenantId,
      roleProfile: sanitizeRoleProfile(membership.roleProfile),
      workspaceUserId: membership.workspaceUserId,
      scope: membership.scope || '',
    })),
  };
}

async function ensureWorkspaceUser(tenantId, membership, account) {
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

async function moveDirectoryContents(sourceDir, targetDir) {
  if (!fsSync.existsSync(sourceDir)) {
    return;
  }

  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir).catch(() => []);
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    try {
      await fs.rename(sourcePath, targetPath);
    } catch {
      const stat = await fs.stat(sourcePath).catch(() => null);
      if (stat?.isFile()) {
        await fs.copyFile(sourcePath, targetPath).catch(() => undefined);
        await fs.unlink(sourcePath).catch(() => undefined);
      }
    }
  }
}

async function migrateLegacyStorageIfNeeded() {
  const systemExists = fsSync.existsSync(tenantsFile) && fsSync.existsSync(accountsFile) && fsSync.existsSync(sessionsFile);
  if (systemExists) {
    return;
  }

  const hasLegacy = fsSync.existsSync(legacyStateFile)
    || fsSync.existsSync(legacyAuditLogFile)
    || fsSync.existsSync(legacyUploadsDir)
    || fsSync.existsSync(legacySnapshotsDir);

  if (!hasLegacy) {
    return;
  }

  const legacyState = sanitizeState(await readJsonFile(legacyStateFile, {}));
  const companyName = legacyState.companyProfile?.companyName || 'Standard-Mandant';
  const industryLabel = legacyState.companyProfile?.industryLabel || '';
  const firstUser = sanitizeArray(legacyState.users)[0] ?? null;
  const workspaceUserId = firstUser?.id || createId('usr');
  const adminName = firstUser?.name || 'Programmadmin';
  const adminEmail = firstUser?.email || 'admin@krisenfest.local';
  const tenantId = slugify(companyName) || 'standard-mandant';
  const stateWithAdmin = sanitizeState({
    ...legacyState,
    users: sanitizeArray(legacyState.users).length
      ? legacyState.users
      : [buildSeedUser({ id: workspaceUserId, name: adminName, email: adminEmail, roleProfile: 'admin', scope: companyName })],
  });

  await ensureTenantStorage(tenantId, stateWithAdmin);
  await writeState(tenantId, stateWithAdmin);
  await writeJsonFile(tenantPaths(tenantId).auditLogFile, sanitizeArray(await readJsonFile(legacyAuditLogFile, [])));
  await moveDirectoryContents(legacyUploadsDir, tenantPaths(tenantId).uploadsDir);
  await moveDirectoryContents(legacySnapshotsDir, tenantPaths(tenantId).snapshotsDir);

  await writeTenants([
    {
      id: tenantId,
      name: companyName,
      slug: tenantId,
      industryLabel,
      createdAt: nowIso(),
      active: true,
    },
  ]);

  const passwordData = hashPassword(DEFAULT_DEMO_PASSWORD);
  await writeAccounts([
    {
      id: createId('acct'),
      name: adminName,
      email: String(adminEmail).toLowerCase(),
      status: 'active',
      isSystemAdmin: true,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      lastLoginAt: '',
      memberships: [
        {
          tenantId,
          roleProfile: sanitizeRoleProfile(firstUser?.roleProfile || 'admin'),
          workspaceUserId,
          scope: companyName,
        },
      ],
    },
  ]);

  await writeSessions([]);
}

async function seedFreshSystemIfEmpty() {
  const tenants = await readTenants();
  if (tenants.length) {
    return;
  }

  const tenantId = 'demo-unternehmen';
  const adminName = 'Programmadmin';
  const adminEmail = 'admin@krisenfest.local';
  const workspaceUserId = createId('usr');
  const initialState = buildSeedState({
    companyName: 'Demo-Unternehmen',
    industryLabel: 'Produktion',
    adminName,
    adminEmail,
    workspaceUserId,
    roleProfile: 'admin',
  });

  await ensureTenantStorage(tenantId, initialState);
  await writeState(tenantId, initialState);
  await writeTenants([
    {
      id: tenantId,
      name: 'Demo-Unternehmen',
      slug: tenantId,
      industryLabel: 'Produktion',
      createdAt: nowIso(),
      active: true,
    },
  ]);

  const passwordData = hashPassword(DEFAULT_DEMO_PASSWORD);
  await writeAccounts([
    {
      id: createId('acct'),
      name: adminName,
      email: adminEmail,
      status: 'active',
      isSystemAdmin: true,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      lastLoginAt: '',
      memberships: [
        {
          tenantId,
          roleProfile: 'admin',
          workspaceUserId,
          scope: 'Demo-Unternehmen',
        },
      ],
    },
  ]);
  await writeSessions([]);
}

async function ensureStorage() {
  await ensureDir(storageDir);
  await ensureDir(systemDir);
  await ensureDir(tenantsDir);
  await ensureDir(globalTmpDir);
  await migrateLegacyStorageIfNeeded();
  if (!fsSync.existsSync(tenantsFile)) {
    await writeTenants([]);
  }
  if (!fsSync.existsSync(accountsFile)) {
    await writeAccounts([]);
  }
  if (!fsSync.existsSync(sessionsFile)) {
    await writeSessions([]);
  }
  await seedFreshSystemIfEmpty();
  await cleanupExpiredSessions();

  const tenants = await readTenants();
  for (const tenant of tenants) {
    await ensureTenantStorage(tenant.id);
  }
}

async function buildHealthResponse() {
  const [tenants, sessions] = await Promise.all([readTenants(), readSessions()]);
  let uploadCount = 0;
  let snapshotCount = 0;
  let auditLogCount = 0;

  for (const tenant of tenants) {
    const paths = tenantPaths(tenant.id);
    uploadCount += (await fs.readdir(paths.uploadsDir).catch(() => [])).length;
    snapshotCount += (await listSnapshotFiles(tenant.id)).length;
    auditLogCount += sanitizeArray(await readJsonFile(paths.auditLogFile, [])).length;
  }

  return {
    ok: true,
    serverTime: nowIso(),
    mode: 'tenant-filesystem',
    tenantCount: tenants.length,
    sessionCount: sessions.length,
    uploadCount,
    snapshotCount,
    auditLogCount,
    authRequired: true,
    features: ['auth', 'multitenancy', 'state-sync', 'audit-log', 'snapshots', 'versioned-attachment-storage'],
  };
}

const app = express();
app.use(express.json({ limit: MAX_JSON_SIZE }));
app.use((req, res, next) => {
  res.setHeader('cache-control', 'no-store');
  next();
});

app.get('/api/health', async (_req, res, next) => {
  try {
    res.json(await buildHealthResponse());
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/bootstrap', async (_req, res, next) => {
  try {
    res.json({
      ok: true,
      authenticationRequired: true,
      defaultPasswordHint: DEFAULT_DEMO_PASSWORD,
      tenants: await listTenantSummaries(),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
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

    if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw httpError(401, 'Anmeldung fehlgeschlagen. Passwort ist nicht korrekt.');
    }

    const memberships = sanitizeArray(account.memberships);
    const membership = requestedTenantId
      ? memberships.find((entry) => entry?.tenantId === requestedTenantId)
      : memberships[0];

    if (!membership) {
      throw httpError(403, 'Für den ausgewählten Mandanten besteht keine Berechtigung.');
    }

    const tenant = tenants.find((entry) => entry?.id === membership.tenantId && entry?.active !== false);
    if (!tenant) {
      throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
    }

    await ensureWorkspaceUser(membership.tenantId, membership, account);

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
      },
      ...(await readSessions()).filter((entry) => !(entry?.accountId === account.id && entry?.tenantId === membership.tenantId)),
    ];
    await writeSessions(nextSessions);

    const updatedAccounts = accounts.map((entry) => (
      entry.id === account.id ? { ...entry, lastLoginAt: createdAt } : entry
    ));
    await writeAccounts(updatedAccounts);

    const sessionPublic = presentSession({
      session: { token, expiresAt },
      account: { ...account, lastLoginAt: createdAt },
      membership,
      tenantName: tenant.name || membership.tenantId,
    });

    const state = await attachVersionMetadata(membership.tenantId, await readState(membership.tenantId));
    await appendAuditLog(membership.tenantId, {
      id: createId('audit'),
      at: createdAt,
      userId: account.id,
      userName: account.name,
      action: 'Anmeldung',
      resource: 'auth',
      summary: `Serveranmeldung für Mandant „${tenant.name || membership.tenantId}“.`,
      sections: ['auth'],
    });

    res.json({
      ok: true,
      session: sessionPublic,
      state,
      accessibleTenants: memberships.map((entry) => ({
        tenantId: entry.tenantId,
        tenantName: tenants.find((tenantEntry) => tenantEntry.id === entry.tenantId)?.name || entry.tenantId,
        roleProfile: sanitizeRoleProfile(entry.roleProfile),
      })),
      workspaceUserSeed: buildSeedUser({
        id: membership.workspaceUserId,
        name: account.name,
        email: account.email,
        roleProfile: sanitizeRoleProfile(membership.roleProfile),
        scope: membership.scope || tenant.name || membership.tenantId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    await ensureWorkspaceUser(authContext.membership.tenantId, authContext.membership, authContext.account);
    res.json({
      ok: true,
      session: authContext.sessionPublic,
      workspaceUserSeed: buildSeedUser({
        id: authContext.membership.workspaceUserId,
        name: authContext.account.name,
        email: authContext.account.email,
        roleProfile: sanitizeRoleProfile(authContext.membership.roleProfile),
        scope: authContext.membership.scope || authContext.tenant.name || authContext.membership.tenantId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const token = extractAuthToken(req);
    if (token) {
      const sessions = await readSessions();
      await writeSessions(sessions.filter((entry) => entry?.token !== token));
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/state', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    const state = await attachVersionMetadata(authContext.membership.tenantId, await readState(authContext.membership.tenantId));
    res.json({ ok: true, state, tenant: authContext.tenant, session: authContext.sessionPublic });
  } catch (error) {
    next(error);
  }
});

app.put('/api/state', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    const incomingState = sanitizeState(req.body?.state);
    const currentState = await readState(authContext.membership.tenantId);
    const changedSections = detectChangedSections(currentState, incomingState);
    const requiredPermissions = [...new Set(changedSections.map((section) => sectionPermissionMap[section]).filter(Boolean))];
    assertPermissions(requiredPermissions, authContext);

    await cleanupOrphanUploads(currentState, incomingState, authContext.membership.tenantId);
    const savedState = await writeState(authContext.membership.tenantId, incomingState);
    const savedAt = nowIso();

    if (changedSections.length) {
      await appendAuditLog(authContext.membership.tenantId, {
        id: createId('audit'),
        at: savedAt,
        userId: authContext.account.id,
        userName: authContext.account.name,
        action: 'Synchronisierung',
        resource: 'state',
        summary: `${changedSections.length} Abschnitt(e) wurden aktualisiert.`,
        sections: changedSections,
      });
    }

    res.json({
      ok: true,
      state: await attachVersionMetadata(authContext.membership.tenantId, savedState),
      savedAt,
      changedSections,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/audit-log', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    const entries = await readAuditLog(authContext.membership.tenantId);
    res.json({ ok: true, entries });
  } catch (error) {
    next(error);
  }
});

app.get('/api/snapshots', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    res.json({ ok: true, snapshots: await listSnapshots(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/snapshots', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const name = String(req.body?.name || '').trim();
    const comment = String(req.body?.comment || '').trim();

    if (!name) {
      throw httpError(400, 'Bitte einen Snapshot-Namen angeben.');
    }

    const snapshotId = `${new Date().toISOString().slice(0, 10)}-${slugify(name) || 'snapshot'}-${Math.random().toString(36).slice(2, 6)}`;
    const snapshot = {
      id: snapshotId,
      name,
      comment,
      createdAt: nowIso(),
      createdBy: authContext.account.id,
      userName: authContext.account.name,
    };

    const paths = tenantPaths(authContext.membership.tenantId);
    await writeJsonFile(path.join(paths.snapshotsDir, `${snapshotId}.json`), {
      meta: snapshot,
      state: currentState,
    });

    const files = await listSnapshotFiles(authContext.membership.tenantId);
    if (files.length > SNAPSHOT_LIMIT) {
      const obsolete = files.slice(SNAPSHOT_LIMIT);
      await Promise.all(obsolete.map((fileName) => fs.unlink(path.join(paths.snapshotsDir, fileName)).catch(() => undefined)));
    }

    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: snapshot.createdAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Snapshot erstellt',
      resource: 'snapshot',
      summary: `Arbeitsstand „${name}“ gespeichert.`,
      sections: [],
    });

    res.json({ ok: true, snapshot });
  } catch (error) {
    next(error);
  }
});

app.post('/api/snapshots/:snapshotId/restore', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const payload = await getSnapshotPayload(authContext.membership.tenantId, req.params.snapshotId);
    const restoredState = sanitizeState(payload.state);

    await cleanupOrphanUploads(currentState, restoredState, authContext.membership.tenantId);
    await writeState(authContext.membership.tenantId, restoredState);

    const restoredAt = nowIso();
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: restoredAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Snapshot wiederhergestellt',
      resource: 'snapshot',
      summary: `Arbeitsstand „${payload.meta.name}“ wurde eingespielt.`,
      sections: ['snapshot-restore'],
    });

    res.json({
      ok: true,
      snapshot: payload.meta,
      state: await attachVersionMetadata(authContext.membership.tenantId, restoredState),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/evidence/:evidenceId/attachment', upload.single('file'), async (req, res, next) => {
  const tempFilePath = req.file?.path;
  try {
    if (!req.file) {
      throw httpError(400, 'Bitte eine Datei hochladen.');
    }

    const authContext = await getAuthContext(req);
    assertPermissions(['evidence_edit'], authContext);
    const evidenceId = req.params.evidenceId;
    const currentState = await readState(authContext.membership.tenantId);
    const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === evidenceId);

    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const evidence = currentState.evidenceItems[evidenceIndex];
    const extension = path.extname(req.file.originalname || '').slice(0, 12);
    const storedFileName = `${Date.now()}-${slugify(path.basename(req.file.originalname, extension) || 'attachment')}-${Math.random().toString(36).slice(2, 6)}${extension}`;
    const paths = tenantPaths(authContext.membership.tenantId);
    const targetPath = path.join(paths.uploadsDir, storedFileName);
    await fs.rename(req.file.path, targetPath);

    const checksumSha256 = await computeSha256(targetPath);
    const versions = sanitizeArray(await readVersions(authContext.membership.tenantId)).map((entry) => (
      entry?.evidenceId === evidenceId ? { ...entry, current: false } : entry
    ));

    const versionEntry = {
      id: createId('ver'),
      evidenceId,
      versionLabel: String(evidence?.version || '').trim(),
      fileName: req.file.originalname,
      storedFileName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      sizeKb: Math.round((req.file.size / 1024) * 10) / 10,
      uploadedAt: nowIso(),
      uploadedBy: authContext.account.name,
      uploadedById: authContext.account.id,
      checksumSha256,
      classification: evidence?.classification || 'intern',
      current: true,
    };
    versions.unshift(versionEntry);
    await writeVersions(authContext.membership.tenantId, versions);

    const historyCount = versions.filter((entry) => entry?.evidenceId === evidenceId).length;
    const attachment = {
      id: createId('att'),
      fileName: req.file.originalname,
      storedFileName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      sizeKb: Math.round((req.file.size / 1024) * 10) / 10,
      url: buildDownloadUrl(storedFileName, req.file.originalname),
      uploadedAt: versionEntry.uploadedAt,
      uploadedBy: authContext.account.name,
      versionId: versionEntry.id,
      checksumSha256,
      historyCount,
    };

    currentState.evidenceItems[evidenceIndex] = {
      ...evidence,
      serverAttachment: attachment,
      attachment: undefined,
      status: evidence.status === 'missing' ? 'draft' : evidence.status,
    };

    await writeState(authContext.membership.tenantId, currentState);
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: versionEntry.uploadedAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Dateiversion hochgeladen',
      resource: 'evidence',
      summary: `Datei „${req.file.originalname}“ wurde als neue Version für Nachweis ${evidenceId} gespeichert.`,
      sections: ['evidenceItems', 'document-versions'],
    });

    res.json({ ok: true, attachment, evidenceId });
  } catch (error) {
    next(error);
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }
  }
});

app.delete('/api/evidence/:evidenceId/attachment', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['evidence_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === req.params.evidenceId);

    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const versions = sanitizeArray(await readVersions(authContext.membership.tenantId)).map((entry) => (
      entry?.evidenceId === req.params.evidenceId ? { ...entry, current: false } : entry
    ));
    await writeVersions(authContext.membership.tenantId, versions);

    currentState.evidenceItems[evidenceIndex] = {
      ...currentState.evidenceItems[evidenceIndex],
      serverAttachment: undefined,
    };

    await writeState(authContext.membership.tenantId, currentState);
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: nowIso(),
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Aktive Dateireferenz entfernt',
      resource: 'evidence',
      summary: `Aktive Server-Datei von Nachweis ${req.params.evidenceId} wurde entfernt. Historie bleibt erhalten.`,
      sections: ['evidenceItems', 'document-versions'],
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/evidence/:evidenceId/versions', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    const versions = await readVersions(authContext.membership.tenantId);
    res.json({ ok: true, versions: listEvidenceVersionEntries(versions, req.params.evidenceId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/evidence/:evidenceId/versions/:versionId/restore', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['evidence_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === req.params.evidenceId);
    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const versions = sanitizeArray(await readVersions(authContext.membership.tenantId));
    const selectedVersion = versions.find((entry) => entry?.id === req.params.versionId && entry?.evidenceId === req.params.evidenceId);
    if (!selectedVersion) {
      throw httpError(404, 'Die angeforderte Dokumentenversion wurde nicht gefunden.');
    }

    const nextVersions = versions.map((entry) => (
      entry?.evidenceId === req.params.evidenceId ? { ...entry, current: entry.id === selectedVersion.id } : entry
    ));
    await writeVersions(authContext.membership.tenantId, nextVersions);

    const restoredAttachment = {
      id: createId('att'),
      fileName: selectedVersion.fileName,
      storedFileName: selectedVersion.storedFileName,
      mimeType: selectedVersion.mimeType,
      sizeKb: selectedVersion.sizeKb,
      url: buildDownloadUrl(selectedVersion.storedFileName, selectedVersion.fileName),
      uploadedAt: selectedVersion.uploadedAt,
      uploadedBy: selectedVersion.uploadedBy,
      versionId: selectedVersion.id,
      checksumSha256: selectedVersion.checksumSha256,
      historyCount: nextVersions.filter((entry) => entry?.evidenceId === req.params.evidenceId).length,
    };

    currentState.evidenceItems[evidenceIndex] = {
      ...currentState.evidenceItems[evidenceIndex],
      serverAttachment: restoredAttachment,
    };
    await writeState(authContext.membership.tenantId, currentState);

    const savedState = await attachVersionMetadata(authContext.membership.tenantId, currentState);
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: nowIso(),
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Dokumentenversion wiederhergestellt',
      resource: 'evidence',
      summary: `Version ${selectedVersion.versionLabel || selectedVersion.id} für Nachweis ${req.params.evidenceId} wurde wieder als aktiv gesetzt.`,
      sections: ['evidenceItems', 'document-versions'],
    });

    res.json({
      ok: true,
      evidenceId: req.params.evidenceId,
      evidence: savedState.evidenceItems[evidenceIndex],
      versions: listEvidenceVersionEntries(nextVersions, req.params.evidenceId),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/document-ledger/summary', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    res.json({ ok: true, summary: await buildDocumentLedgerSummary(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/tenants', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    const summaries = await listTenantSummaries(
      authContext.account.isSystemAdmin
        ? null
        : [authContext.tenant],
    );
    res.json({ ok: true, tenants: summaries });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/tenants', async (req, res, next) => {
  try {
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
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash,
        lastLoginAt: '',
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
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/accounts', async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/accounts', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);

    const targetTenantId = authContext.account.isSystemAdmin
      ? String(req.body?.tenantId || authContext.membership.tenantId).trim()
      : authContext.membership.tenantId;
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();
    const roleProfile = sanitizeRoleProfile(String(req.body?.roleProfile || 'editor'));
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
    const membershipPatch = {
      tenantId: targetTenantId,
      roleProfile,
      workspaceUserId,
      scope: scope || tenant.name || targetTenantId,
    };

    let account;
    if (accountIndex >= 0) {
      account = accounts[accountIndex];
      const memberships = sanitizeArray(account.memberships);
      const membershipIndex = memberships.findIndex((entry) => entry?.tenantId === targetTenantId);
      if (membershipIndex >= 0) {
        memberships[membershipIndex] = { ...memberships[membershipIndex], ...membershipPatch };
      } else {
        memberships.push(membershipPatch);
      }
      accounts[accountIndex] = {
        ...account,
        name,
        status,
        memberships,
      };
      if (password) {
        const passwordData = hashPassword(password);
        accounts[accountIndex].passwordSalt = passwordData.salt;
        accounts[accountIndex].passwordHash = passwordData.hash;
      }
      account = accounts[accountIndex];
    } else {
      if (!password) {
        throw httpError(400, 'Für neue Zugriffskonten ist ein Initialpasswort erforderlich.');
      }
      const passwordData = hashPassword(password);
      account = {
        id: createId('acct'),
        name,
        email,
        status,
        isSystemAdmin: false,
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash,
        lastLoginAt: '',
        memberships: [membershipPatch],
      };
      accounts.push(account);
    }

    await writeAccounts(accounts);
    await ensureWorkspaceUser(targetTenantId, membershipPatch, account);
    const tenantLookup = new Map(tenants.map((entry) => [entry.id, entry]));
    res.json({ ok: true, account: sanitizeAccountForResponse(account, tenantLookup) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/accounts/:accountId/reset-password', async (req, res, next) => {
  try {
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

    const account = accounts[accountIndex];
    const hasTenantAccess = sanitizeArray(account.memberships).some((membership) => membership?.tenantId === authContext.membership.tenantId);
    if (!authContext.account.isSystemAdmin && !hasTenantAccess) {
      throw httpError(403, 'Das Passwort kann nur für Konten des eigenen Mandanten zurückgesetzt werden.');
    }

    const passwordData = hashPassword(password);
    accounts[accountIndex] = {
      ...account,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
    };
    await writeAccounts(accounts);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/files/:storedFileName', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    const storedFileName = path.basename(req.params.storedFileName);
    const filePath = path.join(tenantPaths(authContext.membership.tenantId).uploadsDir, storedFileName);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw httpError(404, 'Datei wurde nicht gefunden.');
    }

    const requestedName = String(req.query.download || storedFileName);
    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = Number(error?.status || 500);
  const message = error?.message || 'Unbekannter Serverfehler';
  const details = Array.isArray(error?.details) ? error.details : undefined;
  res.status(status).json({ message, details });
});

await ensureStorage();
app.listen(PORT, () => {
  console.log(`Krisenfest API läuft auf Port ${PORT}`);
});
