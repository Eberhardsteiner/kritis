import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.API_PORT || 8787);
const MAX_JSON_SIZE = '16mb';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_AUDIT_ENTRIES = 300;
const SNAPSHOT_LIMIT = 40;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const storageDir = path.join(rootDir, 'server-storage');
const uploadsDir = path.join(storageDir, 'uploads');
const snapshotsDir = path.join(storageDir, 'snapshots');
const tmpDir = path.join(storageDir, 'tmp');
const stateFile = path.join(storageDir, 'state.json');
const auditLogFile = path.join(storageDir, 'audit-log.json');

const upload = multer({
  dest: tmpDir,
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeObject(value) {
  return isPlainObject(value) ? value : {};
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

async function ensureStorage() {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(snapshotsDir, { recursive: true });
  await fs.mkdir(tmpDir, { recursive: true });

  if (!fsSync.existsSync(stateFile)) {
    await writeJsonFile(stateFile, {});
  }
  if (!fsSync.existsSync(auditLogFile)) {
    await writeJsonFile(auditLogFile, []);
  }
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

async function readState() {
  const value = await readJsonFile(stateFile, {});
  return sanitizeState(value);
}

async function writeState(value) {
  const sanitized = sanitizeState(value);
  await writeJsonFile(stateFile, sanitized);
  return sanitized;
}

function extractUsers(state) {
  return Array.isArray(state?.users) ? state.users : [];
}

function getRolePermissions(roleProfile) {
  return rolePermissions[roleProfile] ?? rolePermissions.viewer;
}

function getRequestUser(currentState, incomingState, userId) {
  const currentUsers = extractUsers(currentState);
  const incomingUsers = extractUsers(incomingState);
  const users = currentUsers.length ? currentUsers : incomingUsers;

  if (!users.length) {
    return {
      id: userId || 'anonymous',
      name: 'Unbekannt',
      roleProfile: 'viewer',
      permissions: rolePermissions.viewer,
    };
  }

  const user = users.find((entry) => entry.id === userId) ?? users[0];
  return {
    id: user.id,
    name: user.name || user.email || 'Unbekannt',
    roleProfile: user.roleProfile || 'viewer',
    permissions: getRolePermissions(user.roleProfile),
  };
}

function stableEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function detectChangedSections(currentState, nextState) {
  return Object.keys(sectionPermissionMap).filter((section) => !stableEqual(currentState?.[section], nextState?.[section]));
}

function buildMissingPermissionDetails(missingPermissions) {
  return missingPermissions.map((permission) => `Fehlende Berechtigung: ${permission}`);
}

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function assertPermissions(requiredPermissions, currentState, incomingState, userId) {
  const requestUser = getRequestUser(currentState, incomingState, userId);
  const missingPermissions = requiredPermissions.filter((permission) => !requestUser.permissions.includes(permission));

  if (missingPermissions.length) {
    throw httpError(
      403,
      `Der aktive Nutzer ${requestUser.name} darf diesen Schreibvorgang nicht ausführen.`,
      buildMissingPermissionDetails(missingPermissions),
    );
  }

  return requestUser;
}

async function appendAuditLog(entry) {
  const auditEntries = await readJsonFile(auditLogFile, []);
  auditEntries.unshift(entry);
  await writeJsonFile(auditLogFile, auditEntries.slice(0, MAX_AUDIT_ENTRIES));
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

function attachmentFileNamesFromState(state) {
  const evidenceItems = sanitizeArray(state?.evidenceItems);
  return new Set(
    evidenceItems
      .map((item) => item?.serverAttachment?.storedFileName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

async function cleanupOrphanUploads(previousState, nextState) {
  const previousNames = attachmentFileNamesFromState(previousState);
  const nextNames = attachmentFileNamesFromState(nextState);

  await Promise.all(
    [...previousNames]
      .filter((name) => !nextNames.has(name))
      .map(async (name) => {
        const filePath = path.join(uploadsDir, name);
        try {
          await fs.unlink(filePath);
        } catch {
          // orphan might already be gone
        }
      }),
  );
}

async function listSnapshotFiles() {
  const files = await fs.readdir(snapshotsDir);
  return files.filter((fileName) => fileName.endsWith('.json')).sort().reverse();
}

async function listSnapshots() {
  const files = await listSnapshotFiles();
  const snapshots = [];

  for (const fileName of files) {
    const payload = await readJsonFile(path.join(snapshotsDir, fileName), null);
    if (payload?.meta) {
      snapshots.push(payload.meta);
    }
  }

  return snapshots;
}

async function getSnapshotPayload(snapshotId) {
  const snapshotPath = path.join(snapshotsDir, `${snapshotId}.json`);
  const payload = await readJsonFile(snapshotPath, null);
  if (!payload?.meta || !payload?.state) {
    throw httpError(404, 'Snapshot wurde nicht gefunden.');
  }
  return payload;
}

async function buildHealthResponse() {
  const [auditEntries, snapshots] = await Promise.all([
    readJsonFile(auditLogFile, []),
    listSnapshots(),
  ]);
  const savedAt = fsSync.existsSync(stateFile)
    ? (await fs.stat(stateFile)).mtime.toISOString()
    : '';
  const uploadCount = (await fs.readdir(uploadsDir)).length;

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    mode: 'filesystem',
    savedAt,
    uploadCount,
    snapshotCount: snapshots.length,
    auditLogCount: Array.isArray(auditEntries) ? auditEntries.length : 0,
    features: ['state-sync', 'audit-log', 'snapshots', 'attachment-storage'],
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

app.get('/api/state', async (_req, res, next) => {
  try {
    const state = await readState();
    const hasContent = Object.values(state).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (isPlainObject(value)) {
        return Object.keys(value).length > 0;
      }
      return Boolean(value);
    });

    res.json({ ok: true, state: hasContent ? state : null });
  } catch (error) {
    next(error);
  }
});

app.put('/api/state', async (req, res, next) => {
  try {
    const incomingState = sanitizeState(req.body?.state);
    const currentState = await readState();
    const changedSections = detectChangedSections(currentState, incomingState);
    const requiredPermissions = [...new Set(changedSections.map((section) => sectionPermissionMap[section]).filter(Boolean))];
    const requestUser = assertPermissions(requiredPermissions, currentState, incomingState, req.header('x-user-id'));

    await cleanupOrphanUploads(currentState, incomingState);
    const savedState = await writeState(incomingState);
    const savedAt = new Date().toISOString();

    if (changedSections.length) {
      await appendAuditLog({
        id: createId('audit'),
        at: savedAt,
        userId: requestUser.id,
        userName: requestUser.name,
        action: 'Synchronisierung',
        resource: 'state',
        summary: `${changedSections.length} Abschnitt(e) wurden aktualisiert.`,
        sections: changedSections,
      });
    }

    res.json({
      ok: true,
      state: savedState,
      savedAt,
      changedSections,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/audit-log', async (_req, res, next) => {
  try {
    const entries = await readJsonFile(auditLogFile, []);
    res.json({ ok: true, entries: Array.isArray(entries) ? entries : [] });
  } catch (error) {
    next(error);
  }
});

app.get('/api/snapshots', async (_req, res, next) => {
  try {
    res.json({ ok: true, snapshots: await listSnapshots() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/snapshots', async (req, res, next) => {
  try {
    const currentState = await readState();
    const requestUser = assertPermissions(['workspace_edit'], currentState, currentState, req.header('x-user-id'));
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
      createdAt: new Date().toISOString(),
      createdBy: requestUser.id,
      userName: requestUser.name,
    };

    await writeJsonFile(path.join(snapshotsDir, `${snapshotId}.json`), {
      meta: snapshot,
      state: currentState,
    });

    const files = await listSnapshotFiles();
    if (files.length > SNAPSHOT_LIMIT) {
      const obsolete = files.slice(SNAPSHOT_LIMIT);
      await Promise.all(obsolete.map((fileName) => fs.unlink(path.join(snapshotsDir, fileName)).catch(() => undefined)));
    }

    await appendAuditLog({
      id: createId('audit'),
      at: snapshot.createdAt,
      userId: requestUser.id,
      userName: requestUser.name,
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
    const currentState = await readState();
    const requestUser = assertPermissions(['workspace_edit'], currentState, currentState, req.header('x-user-id'));
    const payload = await getSnapshotPayload(req.params.snapshotId);
    const restoredState = sanitizeState(payload.state);

    await cleanupOrphanUploads(currentState, restoredState);
    await writeState(restoredState);

    const restoredAt = new Date().toISOString();
    await appendAuditLog({
      id: createId('audit'),
      at: restoredAt,
      userId: requestUser.id,
      userName: requestUser.name,
      action: 'Snapshot wiederhergestellt',
      resource: 'snapshot',
      summary: `Arbeitsstand „${payload.meta.name}“ wurde eingespielt.`,
      sections: ['snapshot-restore'],
    });

    res.json({ ok: true, snapshot: payload.meta, state: restoredState });
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

    const currentState = await readState();
    const requestUser = assertPermissions(['evidence_edit'], currentState, currentState, req.header('x-user-id'));
    const evidenceId = req.params.evidenceId;
    const evidenceIndex = currentState.evidenceItems.findIndex((item) => item?.id === evidenceId);

    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const previousAttachment = currentState.evidenceItems[evidenceIndex]?.serverAttachment;
    if (previousAttachment?.storedFileName) {
      await fs.unlink(path.join(uploadsDir, previousAttachment.storedFileName)).catch(() => undefined);
    }

    const extension = path.extname(req.file.originalname || '').slice(0, 12);
    const storedFileName = `${Date.now()}-${slugify(path.basename(req.file.originalname, extension) || 'attachment')}${extension}`;
    const targetPath = path.join(uploadsDir, storedFileName);
    await fs.rename(req.file.path, targetPath);

    const attachment = {
      id: createId('att'),
      fileName: req.file.originalname,
      storedFileName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      sizeKb: Math.round((req.file.size / 1024) * 10) / 10,
      url: `/api/files/${encodeURIComponent(storedFileName)}?download=${encodeURIComponent(req.file.originalname)}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: requestUser.name,
    };

    currentState.evidenceItems[evidenceIndex] = {
      ...currentState.evidenceItems[evidenceIndex],
      serverAttachment: attachment,
      attachment: undefined,
      status: currentState.evidenceItems[evidenceIndex].status === 'missing'
        ? 'draft'
        : currentState.evidenceItems[evidenceIndex].status,
    };

    await writeState(currentState);
    await appendAuditLog({
      id: createId('audit'),
      at: attachment.uploadedAt,
      userId: requestUser.id,
      userName: requestUser.name,
      action: 'Datei hochgeladen',
      resource: 'evidence',
      summary: `Datei „${req.file.originalname}“ wurde für Nachweis ${evidenceId} gespeichert.`,
      sections: ['evidenceItems'],
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
    const currentState = await readState();
    const requestUser = assertPermissions(['evidence_edit'], currentState, currentState, req.header('x-user-id'));
    const evidenceIndex = currentState.evidenceItems.findIndex((item) => item?.id === req.params.evidenceId);

    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const existingAttachment = currentState.evidenceItems[evidenceIndex]?.serverAttachment;
    if (existingAttachment?.storedFileName) {
      await fs.unlink(path.join(uploadsDir, existingAttachment.storedFileName)).catch(() => undefined);
    }

    currentState.evidenceItems[evidenceIndex] = {
      ...currentState.evidenceItems[evidenceIndex],
      serverAttachment: undefined,
    };

    await writeState(currentState);
    await appendAuditLog({
      id: createId('audit'),
      at: new Date().toISOString(),
      userId: requestUser.id,
      userName: requestUser.name,
      action: 'Datei entfernt',
      resource: 'evidence',
      summary: `Server-Datei von Nachweis ${req.params.evidenceId} wurde entfernt.`,
      sections: ['evidenceItems'],
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/files/:storedFileName', async (req, res, next) => {
  try {
    const storedFileName = path.basename(req.params.storedFileName);
    const filePath = path.join(uploadsDir, storedFileName);
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
