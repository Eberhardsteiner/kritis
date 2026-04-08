import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyModuleOverlay,
  buildModuleCatalog,
  compareSemver,
  isSemver,
  parseImportedModulePack,
  sanitizeModulePackEntry,
  sortModulePackEntries,
} from './module-packs.js';

test('semver helpers accept x.y.z and compare correctly', () => {
  assert.equal(isSemver('1.2.3'), true);
  assert.equal(isSemver('1.2'), false);
  assert.equal(compareSemver('1.10.0', '1.2.9') > 0, true);
  assert.equal(compareSemver('2.0.0', '2.0.0'), 0);
});

test('parseImportedModulePack validates container module payload', () => {
  const result = parseImportedModulePack(JSON.stringify({
    containerVersion: 1,
    manifest: {
      packId: 'sector-industry-core',
      packType: 'module',
      moduleId: 'industry-plus',
      name: 'Industrie Plus',
      version: '1.0.0',
      description: 'Erweitertes Industriemodul',
      engine: 'krisenfest-sector-engine',
      engineVersion: '1.0.0',
      compatibility: {
        minAppVersion: '1.8.0',
        minEngineVersion: '1.0.0',
      },
    },
    module: {
      schemaVersion: 1,
      id: 'industry-plus',
      name: 'Industrie Plus',
      version: '1.0.0',
      description: 'Erweitertes Industriemodul',
      documentFolders: ['Audit'],
    },
  }));

  assert.equal(result.valid, true);
  assert.equal(result.packType, 'module');
  assert.equal(result.format, 'container');
  assert.equal(result.manifest.packId, 'sector-industry-core');
  assert.equal(result.module.id, 'industry-plus');
});

test('parseImportedModulePack validates container overlay payload', () => {
  const result = parseImportedModulePack(JSON.stringify({
    containerVersion: 1,
    manifest: {
      packId: 'overlay-de-industry',
      packType: 'overlay',
      moduleId: 'overlay-de-industry',
      name: 'Overlay DE Industrie',
      version: '1.0.0',
      description: 'DE-Overlay',
      engine: 'krisenfest-sector-engine',
      engineVersion: '1.0.0',
      compatibility: {
        minAppVersion: '1.8.0',
        minEngineVersion: '1.0.0',
      },
    },
    targetModuleId: 'manufacturing',
    module: {
      id: 'overlay-de-industry',
      version: '1.0.0',
      additionalQuestions: [{ id: 'q-new', title: 'Neu' }],
    },
  }));

  assert.equal(result.valid, true);
  assert.equal(result.packType, 'overlay');
  assert.equal(result.format, 'container');
  assert.equal(result.targetModuleId, 'manufacturing');
});

test('parseImportedModulePack keeps legacy overlay compatibility', () => {
  const result = parseImportedModulePack(JSON.stringify({
    packType: 'overlay',
    targetModuleId: 'energy',
    module: {
      id: 'de-energy-overlay',
      version: '1.0.0',
      additionalQuestions: [{ id: 'q-new', title: 'Neu' }],
    },
  }));

  assert.equal(result.valid, true);
  assert.equal(result.packType, 'overlay');
  assert.equal(result.format, 'legacy');
  assert.equal(result.targetModuleId, 'energy');
});

test('applyModuleOverlay merges additive collections', () => {
  const merged = applyModuleOverlay({
    id: 'energy',
    name: 'Energy',
    version: '1.0.0',
    description: 'Basis',
    documentFolders: ['Audit'],
    additionalQuestions: [{ id: 'q-base', title: 'Basis' }],
  }, {
    id: 'de-energy-overlay',
    version: '1.1.0',
    documentFolders: ['Nachweise'],
    additionalQuestions: [{ id: 'q-de', title: 'DE' }],
  }, 'energy');

  assert.equal(merged.id, 'energy');
  assert.equal(merged.documentFolders.includes('Audit'), true);
  assert.equal(merged.documentFolders.includes('Nachweise'), true);
  assert.equal(merged.additionalQuestions.length, 2);
});

test('buildModuleCatalog replaces released module packs and applies overlays', () => {
  const catalog = buildModuleCatalog({
    builtInModules: [{ id: 'energy', name: 'Energy', version: '1.0.0', description: 'Basis', schemaVersion: 1 }],
    uploadedModules: [],
    registryEntries: [
      {
        id: 'pkg-1',
        packKey: 'module:energy',
        packType: 'module',
        moduleId: 'energy',
        moduleName: 'Energy',
        version: '1.2.0',
        status: 'released',
        uploadedAt: '2026-04-06T10:00:00.000Z',
        manifest: { packId: 'sector-energy-core', packType: 'module', moduleId: 'energy', name: 'Energy', version: '1.2.0', description: 'Basis neu' },
        module: { id: 'energy', name: 'Energy 1.2', version: '1.2.0', description: 'Basis neu', schemaVersion: 1 },
      },
      {
        id: 'pkg-2',
        packKey: 'overlay:energy:de-energy-overlay',
        packType: 'overlay',
        targetModuleId: 'energy',
        moduleId: 'de-energy-overlay',
        moduleName: 'DE Overlay',
        version: '1.0.0',
        status: 'released',
        uploadedAt: '2026-04-06T11:00:00.000Z',
        manifest: { packId: 'overlay-de-energy', packType: 'overlay', moduleId: 'de-energy-overlay', name: 'DE Overlay', version: '1.0.0', description: 'Overlay' },
        module: { id: 'de-energy-overlay', version: '1.0.0', additionalQuestions: [{ id: 'q-de', title: 'DE' }] },
      },
    ],
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].name, 'Energy 1.2');
  assert.equal(Array.isArray(catalog[0].additionalQuestions), true);
  assert.equal(catalog[0].additionalQuestions[0].id, 'q-de');
});

test('sanitizeModulePackEntry keeps container metadata', () => {
  const entry = sanitizeModulePackEntry({
    id: 'pkg-1',
    packKey: 'module:manufacturing',
    packType: 'module',
    moduleId: 'manufacturing',
    moduleName: 'Industrie',
    version: '1.1.0',
    format: 'container',
    containerVersion: 1,
    manifest: {
      packId: 'sector-industry-core',
      packType: 'module',
      moduleId: 'manufacturing',
      name: 'Industrie-Basismodul',
      version: '1.1.0',
      description: 'Industrie',
    },
  });

  assert.equal(entry.format, 'container');
  assert.equal(entry.containerVersion, 1);
  assert.equal(entry.manifest.packId, 'sector-industry-core');
});

test('sortModulePackEntries sorts by packKey and version descending', () => {
  const sorted = sortModulePackEntries([
    { id: 'b', packKey: 'module:energy', version: '1.0.0', uploadedAt: '2026-04-06T09:00:00.000Z' },
    { id: 'a', packKey: 'module:energy', version: '1.2.0', uploadedAt: '2026-04-06T10:00:00.000Z' },
  ]);
  assert.equal(sorted[0].version, '1.2.0');
});
