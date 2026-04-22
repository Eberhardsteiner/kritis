import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVALUATION_CATEGORIES,
  MEASURE_STATUSES,
  RESILIENCE_GOALS,
  RISK_CATEGORY_IDS,
  SCENARIO_PHASES,
  applyModuleOverlay,
  buildModuleCatalog,
  compareSemver,
  isSemver,
  parseImportedModulePack,
  sanitizeModulePackEntry,
  sortModulePackEntries,
} from './module-packs.js';

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(thisFile), '..');

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

// ============================================================================
// C5.1 · Format-Erweiterung: riskCatalogTemplates, resiliencePlanTemplate,
// tabletopScenarios. Alle drei Felder sind Templates für die gleichnamigen
// Feature-State-Strukturen aus src/features/{riskCatalog,resiliencePlan,
// tabletopExercise}/types.ts und werden beim "Übernehmen"-Klick in den
// Tenant-State kopiert (siehe docs/BRANCHEN-ENGINE.md).
// ============================================================================

function validRiskTemplate(overrides = {}) {
  return {
    id: 'risk_template_oxygen',
    categoryId: 'technical',
    subCategoryId: 'tech_infrastructure',
    titel: 'Ausfall der Sauerstoffversorgung',
    beschreibung: 'Zentrale Gasversorgung ist beeinträchtigt.',
    eintrittswahrscheinlichkeit: 2,
    auswirkung: 5,
    residualRisk: 3,
    reviewDate: '',
    owner: '',
    affectedAssetIds: [],
    affectedProcessIds: [],
    affectedInterdependencies: [],
    mitigationMeasureIds: [],
    ...overrides,
  };
}

function validResiliencePlanTemplate(overrides = {}) {
  return {
    templateId: 'resilience_template_healthcare',
    templateNote: 'Demo-Daten, Kontakte vor Go-Live ersetzen.',
    content: {
      scope: {
        operatorName: 'Klinikverbund Muster',
        sector: 'Gesundheit',
        criticalService: 'Stationäre Versorgung',
        locations: 'DE',
        employees: '500-1000',
        personsServed: '',
        scopeNote: '',
      },
      riskBasis: {
        methodology: 'All-Gefahren-Ansatz § 12 KRITISDachG',
        riskAnalysisReference: '',
        topRisks: [],
        riskBasisNote: '',
      },
      measuresByGoal: {
        prevent: [],
        protect: [],
        respond: [],
        recover: [],
      },
      governance: {
        managementBoardContact: '',
        programOwner: '',
        escalationPath: '',
        boardReviewCadence: '',
        governanceNote: '',
      },
      reporting: {
        incidentContact: '',
        incidentBackupContact: '',
        bsiPortalNote: '',
        firstReportingTimeline: '',
        reportingNote: '',
      },
      evidence: {
        evidenceReferences: [],
        reviewCycleYears: 2,
        equivalentProofsNote: '',
        evidenceNote: '',
      },
    },
    ...overrides,
  };
}

function validTabletopScenario(overrides = {}) {
  return {
    id: 'tabletop_kis_outage',
    version: '1.0.0',
    title: 'KIS-Ausfall',
    summary: 'Das Klinik-Informationssystem ist nicht erreichbar.',
    sectors: ['Gesundheit'],
    applicableRegimes: ['KRITISDachG'],
    durationMinutes: 90,
    roles: [
      { id: 'role_it', title: 'IT-Leitung', briefing: 'Technische Eskalation.' },
      { id: 'role_med', title: 'Ärztliche Leitung', briefing: 'Versorgungssteuerung.' },
    ],
    timeline: [
      {
        t: 0,
        phase: 'discovery',
        injects: [{ id: 'inj1', title: 'Meldung Helpdesk', description: 'KIS nicht erreichbar.' }],
        decisions: [
          {
            id: 'dec1',
            question: 'Wird das Downtime-Verfahren aktiviert?',
            options: [
              { id: 'opt_yes', label: 'Ja, sofort', scoreContribution: 3 },
              { id: 'opt_wait', label: 'Abwarten', scoreContribution: 0 },
            ],
          },
        ],
      },
      {
        t: 30,
        phase: 'early_response',
        injects: [],
        decisions: [],
      },
    ],
    evaluationCriteria: [
      { id: 'crit_reporting', description: 'Meldewege eingehalten', weight: 1, category: 'reporting' },
      { id: 'crit_ops', description: 'Versorgungspriorisierung', weight: 1.5, category: 'operations' },
    ],
    ...overrides,
  };
}

function buildContainer(moduleOverrides = {}) {
  return JSON.stringify({
    containerVersion: 1,
    manifest: {
      packId: 'test-pack',
      packType: 'module',
      moduleId: 'test-module',
      name: 'Test-Modul',
      version: '1.0.0',
      description: 'Test',
      engine: 'krisenfest-sector-engine',
      engineVersion: '1.0.0',
    },
    module: {
      schemaVersion: 1,
      id: 'test-module',
      name: 'Test-Modul',
      version: '1.0.0',
      description: 'Test',
      ...moduleOverrides,
    },
  });
}

// --- T1: riskCatalogTemplates happy path ------------------------------------

test('parseImportedModulePack accepts riskCatalogTemplates', () => {
  const result = parseImportedModulePack(buildContainer({
    riskCatalogTemplates: [validRiskTemplate(), validRiskTemplate({ id: 'risk_template_kis' })],
  }));
  assert.equal(result.valid, true, result.errors?.join(' · '));
  assert.equal(result.module.riskCatalogTemplates.length, 2);
  assert.equal(result.module.riskCatalogTemplates[0].categoryId, 'technical');
});

// --- T2: riskCatalogTemplates invalid categoryId ----------------------------

test('validateModuleDefinition rejects riskCatalogTemplates with invalid categoryId', () => {
  const result = parseImportedModulePack(buildContainer({
    riskCatalogTemplates: [validRiskTemplate({ categoryId: 'foobar' })],
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((msg) => msg.includes('categoryId')), result.errors.join(' · '));
});

// --- T3: riskCatalogTemplates out-of-range scoring --------------------------

test('validateModuleDefinition rejects riskCatalogTemplates with out-of-range scoring', () => {
  const result = parseImportedModulePack(buildContainer({
    riskCatalogTemplates: [validRiskTemplate({ auswirkung: 6 })],
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((msg) => msg.includes('auswirkung')), result.errors.join(' · '));
});

// --- T4: resiliencePlanTemplate happy path ----------------------------------

test('parseImportedModulePack accepts resiliencePlanTemplate with templateId and templateNote', () => {
  const result = parseImportedModulePack(buildContainer({
    resiliencePlanTemplate: validResiliencePlanTemplate(),
  }));
  assert.equal(result.valid, true, result.errors?.join(' · '));
  assert.equal(result.module.resiliencePlanTemplate.templateId, 'resilience_template_healthcare');
  assert.equal(result.module.resiliencePlanTemplate.content.scope.operatorName, 'Klinikverbund Muster');
  assert.equal(result.module.resiliencePlanTemplate.content.evidence.reviewCycleYears, 2);
});

// --- T5: resiliencePlanTemplate missing measuresByGoal ----------------------

test('validateModuleDefinition rejects resiliencePlanTemplate missing measuresByGoal', () => {
  const tpl = validResiliencePlanTemplate();
  delete tpl.content.measuresByGoal;
  const result = parseImportedModulePack(buildContainer({
    resiliencePlanTemplate: tpl,
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((msg) => msg.includes('measuresByGoal')), result.errors.join(' · '));
});

// --- T6: resiliencePlanTemplate unknown goal key ----------------------------

test('validateModuleDefinition rejects resiliencePlanTemplate with unknown goal key', () => {
  const tpl = validResiliencePlanTemplate();
  tpl.content.measuresByGoal.disasterMitigation = [];
  const result = parseImportedModulePack(buildContainer({
    resiliencePlanTemplate: tpl,
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((msg) => msg.includes('disasterMitigation')), result.errors.join(' · '));
});

// --- T7: tabletopScenarios happy path ---------------------------------------

test('parseImportedModulePack accepts tabletopScenarios with full timeline', () => {
  const result = parseImportedModulePack(buildContainer({
    tabletopScenarios: [validTabletopScenario()],
  }));
  assert.equal(result.valid, true, result.errors?.join(' · '));
  assert.equal(result.module.tabletopScenarios.length, 1);
  assert.equal(result.module.tabletopScenarios[0].timeline.length, 2);
  assert.equal(result.module.tabletopScenarios[0].evaluationCriteria[1].category, 'operations');
});

// --- T8: tabletopScenarios invalid timeline phase ---------------------------

test('validateModuleDefinition rejects tabletopScenarios with invalid timeline phase', () => {
  const scn = validTabletopScenario();
  scn.timeline[0].phase = 'emergency';
  const result = parseImportedModulePack(buildContainer({
    tabletopScenarios: [scn],
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((msg) => msg.includes('phase')), result.errors.join(' · '));
});

// --- T9: applyModuleOverlay merges riskCatalogTemplates by id --------------

test('applyModuleOverlay merges riskCatalogTemplates by id', () => {
  const merged = applyModuleOverlay({
    id: 'healthcare',
    name: 'Healthcare',
    version: '1.0.0',
    description: 'Base',
    riskCatalogTemplates: [
      validRiskTemplate({ id: 'r1', titel: 'Base 1' }),
      validRiskTemplate({ id: 'r2', titel: 'Base 2' }),
    ],
  }, {
    id: 'de-healthcare-overlay',
    version: '1.1.0',
    riskCatalogTemplates: [
      validRiskTemplate({ id: 'r2', titel: 'Overlay 2' }),
      validRiskTemplate({ id: 'r3', titel: 'Overlay 3' }),
    ],
  }, 'healthcare');
  assert.equal(merged.riskCatalogTemplates.length, 3);
  const byId = new Map(merged.riskCatalogTemplates.map((r) => [r.id, r.titel]));
  assert.equal(byId.get('r1'), 'Base 1');
  assert.equal(byId.get('r2'), 'Overlay 2'); // overlay gewinnt
  assert.equal(byId.get('r3'), 'Overlay 3');
});

// --- T10: applyModuleOverlay replaces resiliencePlanTemplate wholesale ----

test('applyModuleOverlay replaces resiliencePlanTemplate wholesale (scalar override)', () => {
  const baseTpl = validResiliencePlanTemplate({ templateId: 'base-plan' });
  const overlayTpl = validResiliencePlanTemplate({ templateId: 'overlay-plan' });
  overlayTpl.content.scope.operatorName = 'AT-Overlay-Betreiber';

  const merged = applyModuleOverlay({
    id: 'healthcare',
    name: 'Healthcare',
    version: '1.0.0',
    description: 'Base',
    resiliencePlanTemplate: baseTpl,
  }, {
    id: 'at-healthcare-overlay',
    version: '1.1.0',
    resiliencePlanTemplate: overlayTpl,
  }, 'healthcare');

  assert.equal(merged.resiliencePlanTemplate.templateId, 'overlay-plan');
  assert.equal(merged.resiliencePlanTemplate.content.scope.operatorName, 'AT-Overlay-Betreiber');
});

// --- T10b: applyModuleOverlay keeps base resiliencePlanTemplate when overlay has none

test('applyModuleOverlay keeps base resiliencePlanTemplate when overlay omits the field', () => {
  const baseTpl = validResiliencePlanTemplate({ templateId: 'base-plan' });
  const merged = applyModuleOverlay({
    id: 'healthcare',
    name: 'Healthcare',
    version: '1.0.0',
    description: 'Base',
    resiliencePlanTemplate: baseTpl,
  }, {
    id: 'de-empty-overlay',
    version: '1.0.0',
    additionalQuestions: [{ id: 'q1', title: 'Neu' }],
  }, 'healthcare');

  assert.equal(merged.resiliencePlanTemplate.templateId, 'base-plan');
});

// --- T11: applyModuleOverlay merges tabletopScenarios by id ---------------

test('applyModuleOverlay merges tabletopScenarios by id', () => {
  const merged = applyModuleOverlay({
    id: 'healthcare',
    name: 'Healthcare',
    version: '1.0.0',
    description: 'Base',
    tabletopScenarios: [
      validTabletopScenario({ id: 's1', title: 'Base Scenario 1' }),
    ],
  }, {
    id: 'de-healthcare-overlay',
    version: '1.1.0',
    tabletopScenarios: [
      validTabletopScenario({ id: 's1', title: 'Overlay Scenario 1 (de)' }),
      validTabletopScenario({ id: 's2', title: 'Overlay Scenario 2' }),
    ],
  }, 'healthcare');
  assert.equal(merged.tabletopScenarios.length, 2);
  const byId = new Map(merged.tabletopScenarios.map((s) => [s.id, s.title]));
  assert.equal(byId.get('s1'), 'Overlay Scenario 1 (de)');
  assert.equal(byId.get('s2'), 'Overlay Scenario 2');
});

// --- T12: Symmetrie-Self-Check gegen TS-Type-Drift --------------------------
//
// Dieser Test schützt dauerhaft vor unbemerkter Drift zwischen den
// TypeScript-Union-Typen in src/features/{riskCatalog,resiliencePlan,
// tabletopExercise}/types.ts und den Enum-Konstanten in module-packs.js.
// Wenn ein Entwickler eine neue Kategorie in z. B. RiskCategoryId
// hinzufügt, schlägt der Test an, bis die Enum hier nachgezogen wurde.

function extractUnionValues(source, typeName) {
  const pattern = new RegExp(`export type ${typeName}\\s*=([^;]+);`, 's');
  const match = source.match(pattern);
  if (!match) return null;
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('symmetry self-check · RISK_CATEGORY_IDS matches src/features/riskCatalog/types.ts', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'features', 'riskCatalog', 'types.ts'), 'utf8');
  const tsValues = extractUnionValues(source, 'RiskCategoryId');
  assert.ok(tsValues, 'RiskCategoryId not found in riskCatalog/types.ts');
  assert.deepEqual([...RISK_CATEGORY_IDS].sort(), [...tsValues].sort(),
    'RISK_CATEGORY_IDS in module-packs.js must match the TypeScript union RiskCategoryId');
});

test('symmetry self-check · SCENARIO_PHASES matches src/features/tabletopExercise/types.ts', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'features', 'tabletopExercise', 'types.ts'), 'utf8');
  const tsValues = extractUnionValues(source, 'ScenarioPhase');
  assert.ok(tsValues, 'ScenarioPhase not found in tabletopExercise/types.ts');
  assert.deepEqual([...SCENARIO_PHASES].sort(), [...tsValues].sort(),
    'SCENARIO_PHASES in module-packs.js must match the TypeScript union ScenarioPhase');
});

test('symmetry self-check · EVALUATION_CATEGORIES matches src/features/tabletopExercise/types.ts', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'features', 'tabletopExercise', 'types.ts'), 'utf8');
  const tsValues = extractUnionValues(source, 'EvaluationCategory');
  assert.ok(tsValues, 'EvaluationCategory not found in tabletopExercise/types.ts');
  assert.deepEqual([...EVALUATION_CATEGORIES].sort(), [...tsValues].sort(),
    'EVALUATION_CATEGORIES in module-packs.js must match the TypeScript union EvaluationCategory');
});

test('symmetry self-check · RESILIENCE_GOALS matches src/features/resiliencePlan/types.ts', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'features', 'resiliencePlan', 'types.ts'), 'utf8');
  const tsValues = extractUnionValues(source, 'ResilienceGoal');
  assert.ok(tsValues, 'ResilienceGoal not found in resiliencePlan/types.ts');
  assert.deepEqual([...RESILIENCE_GOALS].sort(), [...tsValues].sort(),
    'RESILIENCE_GOALS in module-packs.js must match the TypeScript union ResilienceGoal');
});

test('symmetry self-check · MEASURE_STATUSES matches src/features/resiliencePlan/types.ts', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'features', 'resiliencePlan', 'types.ts'), 'utf8');
  const tsValues = extractUnionValues(source, 'MeasureStatus');
  assert.ok(tsValues, 'MeasureStatus not found in resiliencePlan/types.ts');
  assert.deepEqual([...MEASURE_STATUSES].sort(), [...tsValues].sort(),
    'MEASURE_STATUSES in module-packs.js must match the TypeScript union MeasureStatus');
});

// --- T13: Abwärtskompatibilität · bestehendes healthcare-core.container.json

test('parseImportedModulePack keeps legacy healthcare-core.container.json byte-compatible', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'src', 'module-packs', 'healthcare-core.container.json'),
    'utf8',
  );
  const result = parseImportedModulePack(source);
  assert.equal(result.valid, true, result.errors?.join(' · '));
  assert.equal(result.packType, 'module');
  assert.equal(result.format, 'container');
  assert.equal(result.manifest.packId, 'sector-healthcare-core');
  assert.equal(result.module.id, 'healthcare');
  // Die drei neuen C5.1-Felder sind im Legacy-Pack nicht vorhanden —
  // Parser akzeptiert das als gültig und lässt die Felder undefined.
  assert.equal(result.module.riskCatalogTemplates, undefined);
  assert.equal(result.module.resiliencePlanTemplate, undefined);
  assert.equal(result.module.tabletopScenarios, undefined);
});
