import crypto from 'node:crypto';

export const MODULE_ENGINE_ID = 'krisenfest-sector-engine';
export const MODULE_ENGINE_VERSION = '1.0.0';
export const MODULE_ENGINE_APP_VERSION = '1.8.0';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeString(value) {
  return String(value || '').trim();
}

export function isSemver(value) {
  return /^\d+\.\d+\.\d+$/.test(sanitizeString(value));
}

export function compareSemver(left, right) {
  const parse = (value) => {
    const normalized = sanitizeString(value);
    if (!isSemver(normalized)) {
      return [0, 0, 0];
    }
    return normalized.split('.').map((part) => Number(part));
  };

  const [lMajor, lMinor, lPatch] = parse(left);
  const [rMajor, rMinor, rPatch] = parse(right);
  if (lMajor !== rMajor) return lMajor - rMajor;
  if (lMinor !== rMinor) return lMinor - rMinor;
  return lPatch - rPatch;
}

function uniqueStrings(values) {
  const seen = new Set();
  return sanitizeArray(values)
    .map((entry) => sanitizeString(entry))
    .filter((entry) => entry && !seen.has(entry) && seen.add(entry));
}

function mergeById(baseValues, overlayValues) {
  const map = new Map();
  sanitizeArray(baseValues)
    .filter((entry) => isPlainObject(entry) && sanitizeString(entry.id))
    .forEach((entry) => {
      map.set(sanitizeString(entry.id), entry);
    });

  sanitizeArray(overlayValues)
    .filter((entry) => isPlainObject(entry) && sanitizeString(entry.id))
    .forEach((entry) => {
      map.set(sanitizeString(entry.id), entry);
    });

  return [...map.values()];
}

function normalizeManifest(value) {
  const raw = isPlainObject(value) ? value : {};
  const compatibility = isPlainObject(raw.compatibility)
    ? {
        minAppVersion: sanitizeString(raw.compatibility.minAppVersion),
        minEngineVersion: sanitizeString(raw.compatibility.minEngineVersion),
      }
    : undefined;

  return {
    packId: sanitizeString(raw.packId),
    packType: sanitizeString(raw.packType) === 'overlay' ? 'overlay' : 'module',
    moduleId: sanitizeString(raw.moduleId),
    name: sanitizeString(raw.name),
    version: sanitizeString(raw.version),
    description: sanitizeString(raw.description),
    engine: sanitizeString(raw.engine),
    engineVersion: sanitizeString(raw.engineVersion),
    sectorCategory: sanitizeString(raw.sectorCategory),
    industryClass: sanitizeString(raw.industryClass),
    maintainer: sanitizeString(raw.maintainer),
    tags: uniqueStrings(raw.tags),
    capabilities: uniqueStrings(raw.capabilities),
    compatibility,
    releaseChannel: ['core', 'sector', 'overlay', 'custom'].includes(sanitizeString(raw.releaseChannel))
      ? sanitizeString(raw.releaseChannel)
      : undefined,
  };
}

function validateManifest(manifest) {
  const errors = [];
  if (!manifest.packId) {
    errors.push('manifest.packId fehlt oder ist leer.');
  }
  if (!['module', 'overlay'].includes(manifest.packType)) {
    errors.push('manifest.packType muss module oder overlay sein.');
  }
  if (!manifest.moduleId) {
    errors.push('manifest.moduleId fehlt oder ist leer.');
  }
  if (!manifest.name) {
    errors.push('manifest.name fehlt oder ist leer.');
  }
  if (!manifest.description) {
    errors.push('manifest.description fehlt oder ist leer.');
  }
  if (!isSemver(manifest.version)) {
    errors.push('manifest.version muss dem Format x.y.z entsprechen.');
  }
  if (manifest.engine && manifest.engine !== MODULE_ENGINE_ID) {
    errors.push(`manifest.engine muss ${MODULE_ENGINE_ID} sein.`);
  }
  if (manifest.engineVersion && !isSemver(manifest.engineVersion)) {
    errors.push('manifest.engineVersion muss dem Format x.y.z entsprechen.');
  }
  if (manifest.compatibility?.minAppVersion && !isSemver(manifest.compatibility.minAppVersion)) {
    errors.push('manifest.compatibility.minAppVersion muss dem Format x.y.z entsprechen.');
  }
  if (manifest.compatibility?.minEngineVersion && !isSemver(manifest.compatibility.minEngineVersion)) {
    errors.push('manifest.compatibility.minEngineVersion muss dem Format x.y.z entsprechen.');
  }
  if (manifest.compatibility?.minAppVersion && compareSemver(manifest.compatibility.minAppVersion, MODULE_ENGINE_APP_VERSION) > 0) {
    errors.push('manifest.compatibility.minAppVersion erfordert eine neuere App-Version.');
  }
  if (manifest.compatibility?.minEngineVersion && compareSemver(manifest.compatibility.minEngineVersion, MODULE_ENGINE_VERSION) > 0) {
    errors.push('manifest.compatibility.minEngineVersion erfordert eine neuere Engine-Version.');
  }
  return { valid: errors.length === 0, errors };
}

function normalizeOverlayShape(value) {
  const raw = isPlainObject(value) ? value : {};
  return {
    id: sanitizeString(raw.id),
    version: sanitizeString(raw.version),
    schemaVersion: Number.isFinite(Number(raw.schemaVersion)) ? Number(raw.schemaVersion) : undefined,
    name: sanitizeString(raw.name),
    description: sanitizeString(raw.description),
    sectorCategory: sanitizeString(raw.sectorCategory),
    domainWeightAdjustments: isPlainObject(raw.domainWeightAdjustments) ? raw.domainWeightAdjustments : {},
    additionalQuestions: sanitizeArray(raw.additionalQuestions),
    recommendedActions: sanitizeArray(raw.recommendedActions),
    evidenceTemplates: sanitizeArray(raw.evidenceTemplates),
    documentFolders: uniqueStrings(raw.documentFolders),
    roleTemplates: sanitizeArray(raw.roleTemplates),
    maturityProfile: isPlainObject(raw.maturityProfile) ? raw.maturityProfile : undefined,
    auditChecklist: sanitizeArray(raw.auditChecklist),
    processTemplates: sanitizeArray(raw.processTemplates),
    dependencyTemplates: sanitizeArray(raw.dependencyTemplates),
    scenarioTemplates: sanitizeArray(raw.scenarioTemplates),
    exerciseTemplates: sanitizeArray(raw.exerciseTemplates),
    uiHints: isPlainObject(raw.uiHints) ? raw.uiHints : undefined,
    kritisExtension: isPlainObject(raw.kritisExtension) ? raw.kritisExtension : undefined,
  };
}

function validateOverlayShape(value) {
  const overlay = normalizeOverlayShape(value);
  const errors = [];
  if (!overlay.id) {
    errors.push('module.id fehlt oder ist leer.');
  }
  if (!isSemver(overlay.version)) {
    errors.push('module.version muss dem Format x.y.z entsprechen.');
  }
  return { valid: errors.length === 0, errors, overlay };
}

export function applyModuleOverlay(baseModule, overlayDefinition, targetModuleId = '') {
  const base = isPlainObject(baseModule) ? baseModule : {};
  const overlay = normalizeOverlayShape(overlayDefinition);
  const targetId = sanitizeString(targetModuleId || overlay.id || base.id);

  return {
    ...base,
    id: targetId || sanitizeString(base.id),
    name: overlay.name || sanitizeString(base.name),
    version: overlay.version
      ? `${sanitizeString(base.version || '0.0.0')}+overlay.${overlay.version}`
      : sanitizeString(base.version),
    description: overlay.description || sanitizeString(base.description),
    sectorCategory: overlay.sectorCategory || sanitizeString(base.sectorCategory),
    schemaVersion: Number.isFinite(overlay.schemaVersion)
      ? overlay.schemaVersion
      : (Number.isFinite(Number(base.schemaVersion)) ? Number(base.schemaVersion) : 1),
    domainWeightAdjustments: {
      ...(isPlainObject(base.domainWeightAdjustments) ? base.domainWeightAdjustments : {}),
      ...(isPlainObject(overlay.domainWeightAdjustments) ? overlay.domainWeightAdjustments : {}),
    },
    additionalQuestions: mergeById(base.additionalQuestions, overlay.additionalQuestions),
    recommendedActions: mergeById(base.recommendedActions, overlay.recommendedActions),
    evidenceTemplates: mergeById(base.evidenceTemplates, overlay.evidenceTemplates),
    documentFolders: uniqueStrings([...(base.documentFolders || []), ...overlay.documentFolders]),
    roleTemplates: mergeById(base.roleTemplates, overlay.roleTemplates),
    maturityProfile: overlay.maturityProfile
      ? {
          ...(isPlainObject(base.maturityProfile) ? base.maturityProfile : {}),
          ...overlay.maturityProfile,
          targetByDomain: {
            ...(isPlainObject(base.maturityProfile?.targetByDomain) ? base.maturityProfile.targetByDomain : {}),
            ...(isPlainObject(overlay.maturityProfile?.targetByDomain) ? overlay.maturityProfile.targetByDomain : {}),
          },
        }
      : base.maturityProfile,
    auditChecklist: mergeById(base.auditChecklist, overlay.auditChecklist),
    processTemplates: mergeById(base.processTemplates, overlay.processTemplates),
    dependencyTemplates: mergeById(base.dependencyTemplates, overlay.dependencyTemplates),
    scenarioTemplates: mergeById(base.scenarioTemplates, overlay.scenarioTemplates),
    exerciseTemplates: mergeById(base.exerciseTemplates, overlay.exerciseTemplates),
    uiHints: {
      ...(isPlainObject(base.uiHints) ? base.uiHints : {}),
      ...(overlay.uiHints || {}),
      focusAreas: uniqueStrings([
        ...(sanitizeArray(base.uiHints?.focusAreas)),
        ...(sanitizeArray(overlay.uiHints?.focusAreas)),
      ]),
    },
    kritisExtension: {
      ...(isPlainObject(base.kritisExtension) ? base.kritisExtension : {}),
      ...(overlay.kritisExtension || {}),
      eligibleSectors: uniqueStrings([
        ...(sanitizeArray(base.kritisExtension?.eligibleSectors)),
        ...(sanitizeArray(overlay.kritisExtension?.eligibleSectors)),
      ]),
      hints: uniqueStrings([
        ...(sanitizeArray(base.kritisExtension?.hints)),
        ...(sanitizeArray(overlay.kritisExtension?.hints)),
      ]),
      additionalRequirements: mergeById(
        base.kritisExtension?.additionalRequirements,
        overlay.kritisExtension?.additionalRequirements,
      ),
    },
  };
}

function validateModuleDefinition(module) {
  const errors = [];
  const raw = isPlainObject(module) ? module : null;
  if (!raw) {
    return { valid: false, errors: ['Das Modul muss ein JSON-Objekt sein.'] };
  }

  if (!Number.isFinite(Number(raw.schemaVersion))) {
    errors.push('schemaVersion muss numerisch sein.');
  }
  if (!sanitizeString(raw.id)) {
    errors.push('id fehlt oder ist leer.');
  }
  if (!sanitizeString(raw.name)) {
    errors.push('name fehlt oder ist leer.');
  }
  if (!sanitizeString(raw.description)) {
    errors.push('description fehlt oder ist leer.');
  }
  if (!isSemver(raw.version)) {
    errors.push('version muss dem Format x.y.z entsprechen.');
  }
  if (raw.additionalQuestions !== undefined && !Array.isArray(raw.additionalQuestions)) {
    errors.push('additionalQuestions muss ein Array sein.');
  }
  if (raw.recommendedActions !== undefined && !Array.isArray(raw.recommendedActions)) {
    errors.push('recommendedActions muss ein Array sein.');
  }
  if (raw.evidenceTemplates !== undefined && !Array.isArray(raw.evidenceTemplates)) {
    errors.push('evidenceTemplates muss ein Array sein.');
  }
  if (raw.documentFolders !== undefined && !Array.isArray(raw.documentFolders)) {
    errors.push('documentFolders muss ein Array sein.');
  }
  if (raw.roleTemplates !== undefined && !Array.isArray(raw.roleTemplates)) {
    errors.push('roleTemplates muss ein Array sein.');
  }
  if (raw.auditChecklist !== undefined && !Array.isArray(raw.auditChecklist)) {
    errors.push('auditChecklist muss ein Array sein.');
  }
  return { valid: errors.length === 0, errors };
}

function buildSyntheticManifestFromModule(module) {
  return {
    packId: `legacy-${sanitizeString(module?.id)}`,
    packType: 'module',
    moduleId: sanitizeString(module?.id),
    name: sanitizeString(module?.name),
    version: sanitizeString(module?.version),
    description: sanitizeString(module?.description),
    engine: MODULE_ENGINE_ID,
    engineVersion: MODULE_ENGINE_VERSION,
    sectorCategory: sanitizeString(module?.sectorCategory),
    capabilities: ['assessment', 'actions', 'evidence', 'governance', 'kritis', 'bia', 'documents', 'reporting'],
    compatibility: {
      minAppVersion: MODULE_ENGINE_APP_VERSION,
      minEngineVersion: MODULE_ENGINE_VERSION,
    },
    releaseChannel: 'custom',
  };
}

function normalizeContainer(value) {
  const raw = isPlainObject(value) ? value : null;
  if (!raw) {
    return null;
  }
  if (!Number.isFinite(Number(raw.containerVersion)) || !isPlainObject(raw.manifest) || !('module' in raw)) {
    return null;
  }
  return {
    containerVersion: Number(raw.containerVersion),
    manifest: normalizeManifest(raw.manifest),
    targetModuleId: sanitizeString(raw.targetModuleId),
    module: raw.module,
    raw,
  };
}

export function parseImportedModulePack(jsonText) {
  const trimmed = String(jsonText || '').trim();
  const checksumSha256 = crypto.createHash('sha256').update(trimmed).digest('hex');
  let parsed;
  try {
    parsed = JSON.parse(trimmed || '{}');
  } catch (error) {
    return {
      valid: false,
      errors: ['Die Datei enthält kein gültiges JSON.'],
      checksumSha256,
    };
  }

  const container = normalizeContainer(parsed);
  if (container) {
    const manifestValidation = validateManifest(container.manifest);
    const errors = [...manifestValidation.errors];
    if (container.containerVersion !== 1) {
      errors.push('containerVersion muss aktuell den Wert 1 haben.');
    }

    if (container.manifest.packType === 'overlay') {
      if (!container.targetModuleId) {
        errors.push('targetModuleId fehlt oder ist leer.');
      }
      const overlayValidation = validateOverlayShape(container.module);
      errors.push(...overlayValidation.errors);
      if (container.manifest.moduleId && container.manifest.moduleId !== overlayValidation.overlay.id) {
        errors.push('manifest.moduleId und module.id müssen bei Overlay-Paketen übereinstimmen.');
      }
      return {
        valid: errors.length === 0,
        errors,
        checksumSha256,
        format: 'container',
        containerVersion: container.containerVersion,
        manifest: container.manifest,
        packType: 'overlay',
        packKey: `overlay:${container.targetModuleId}:${overlayValidation.overlay.id}`,
        targetModuleId: container.targetModuleId,
        module: overlayValidation.overlay,
        raw: parsed,
      };
    }

    const moduleValidation = validateModuleDefinition(container.module);
    errors.push(...moduleValidation.errors);
    if (container.manifest.moduleId && container.manifest.moduleId !== sanitizeString(container.module?.id)) {
      errors.push('manifest.moduleId und module.id müssen übereinstimmen.');
    }

    return {
      valid: errors.length === 0,
      errors,
      checksumSha256,
      format: 'container',
      containerVersion: container.containerVersion,
      manifest: container.manifest,
      packType: 'module',
      packKey: `module:${sanitizeString(container.module?.id)}`,
      targetModuleId: '',
      module: container.module,
      raw: parsed,
    };
  }

  if (isPlainObject(parsed) && parsed.packType === 'overlay') {
    const overlayValidation = validateOverlayShape(parsed.module);
    const errors = [...overlayValidation.errors];
    const targetModuleId = sanitizeString(parsed.targetModuleId);
    if (!targetModuleId) {
      errors.push('targetModuleId fehlt oder ist leer.');
    }
    return {
      valid: errors.length === 0,
      errors,
      checksumSha256,
      format: 'legacy',
      containerVersion: undefined,
      manifest: {
        packId: `legacy-overlay-${overlayValidation.overlay.id}`,
        packType: 'overlay',
        moduleId: overlayValidation.overlay.id,
        name: overlayValidation.overlay.name || overlayValidation.overlay.id,
        version: overlayValidation.overlay.version,
        description: overlayValidation.overlay.description || 'Legacy-Overlay',
        engine: MODULE_ENGINE_ID,
        engineVersion: MODULE_ENGINE_VERSION,
        releaseChannel: 'overlay',
      },
      packType: 'overlay',
      packKey: `overlay:${targetModuleId}:${sanitizeString(parsed.module?.id)}`,
      targetModuleId,
      module: normalizeOverlayShape(parsed.module),
      raw: parsed,
    };
  }

  const validation = validateModuleDefinition(parsed);
  return {
    valid: validation.valid,
    errors: validation.errors,
    checksumSha256,
    format: 'legacy',
    containerVersion: undefined,
    manifest: validation.valid ? buildSyntheticManifestFromModule(parsed) : undefined,
    packType: 'module',
    packKey: `module:${sanitizeString(parsed?.id)}`,
    targetModuleId: '',
    module: parsed,
    raw: parsed,
  };
}

export function sanitizeModulePackEntry(entry) {
  const raw = isPlainObject(entry) ? entry : {};
  return {
    id: sanitizeString(raw.id),
    packKey: sanitizeString(raw.packKey),
    packType: raw.packType === 'overlay' ? 'overlay' : 'module',
    targetModuleId: sanitizeString(raw.targetModuleId),
    moduleId: sanitizeString(raw.moduleId),
    moduleName: sanitizeString(raw.moduleName),
    version: sanitizeString(raw.version),
    status: ['draft', 'released', 'superseded', 'retired'].includes(raw.status) ? raw.status : 'draft',
    fileName: sanitizeString(raw.fileName),
    checksumSha256: sanitizeString(raw.checksumSha256),
    uploadedAt: sanitizeString(raw.uploadedAt),
    uploadedBy: sanitizeString(raw.uploadedBy),
    changeNote: sanitizeString(raw.changeNote),
    releaseNote: sanitizeString(raw.releaseNote),
    releasedAt: sanitizeString(raw.releasedAt),
    releasedBy: sanitizeString(raw.releasedBy),
    supersededById: sanitizeString(raw.supersededById),
    retiredAt: sanitizeString(raw.retiredAt),
    retiredBy: sanitizeString(raw.retiredBy),
    sourceScope: sanitizeString(raw.sourceScope) || 'tenant',
    format: sanitizeString(raw.format) === 'container' ? 'container' : 'legacy',
    containerVersion: Number.isFinite(Number(raw.containerVersion)) ? Number(raw.containerVersion) : undefined,
    manifest: isPlainObject(raw.manifest) ? normalizeManifest(raw.manifest) : undefined,
    module: raw.module,
  };
}

export function sortModulePackEntries(entries) {
  return sanitizeArray(entries)
    .map((entry) => sanitizeModulePackEntry(entry))
    .filter((entry) => entry.id)
    .sort((left, right) => {
      if (left.packKey !== right.packKey) {
        return left.packKey.localeCompare(right.packKey);
      }
      const semverDiff = compareSemver(right.version, left.version);
      if (semverDiff !== 0) {
        return semverDiff;
      }
      return right.uploadedAt.localeCompare(left.uploadedAt);
    });
}

export function getReleasedPackEntries(entries) {
  return sortModulePackEntries(entries).filter((entry) => entry.status === 'released');
}

export function buildModuleCatalog({ builtInModules = [], uploadedModules = [], registryEntries = [] } = {}) {
  const catalog = new Map();

  sanitizeArray(builtInModules).forEach((module) => {
    if (isPlainObject(module) && sanitizeString(module.id)) {
      catalog.set(sanitizeString(module.id), module);
    }
  });

  sanitizeArray(uploadedModules).forEach((module) => {
    if (isPlainObject(module) && sanitizeString(module.id)) {
      catalog.set(sanitizeString(module.id), module);
    }
  });

  const releasedModuleEntries = getReleasedPackEntries(registryEntries);

  releasedModuleEntries
    .filter((entry) => entry.packType === 'module' && isPlainObject(entry.module))
    .forEach((entry) => {
      catalog.set(entry.moduleId, entry.module);
    });

  releasedModuleEntries
    .filter((entry) => entry.packType === 'overlay' && isPlainObject(entry.module))
    .forEach((entry) => {
      const targetId = entry.targetModuleId || entry.moduleId;
      const baseModule = catalog.get(targetId);
      if (baseModule) {
        catalog.set(targetId, applyModuleOverlay(baseModule, entry.module, targetId));
      }
    });

  return [...catalog.values()];
}
