/**
 * sanitizers.test.js · C5.1-Backend-State-Tests.
 *
 * Verifiziert die Erweiterung von `sanitizeState` um die sechs neuen
 * Feature-State-Felder (riskEntries, resiliencePlan, archivedResiliencePlans,
 * currentTabletopSession, archivedTabletopSessions, importedTabletopScenarios)
 * sowie die Sub-Helfer `sanitizeResiliencePlan` und `sanitizeExerciseSession`.
 *
 * Kontext: Vor C5.1 hat `sanitizeState` unbekannte Felder beim PUT /api/state
 * kommentarlos gestrippt — die sechs Felder lebten nur im Frontend-RAM
 * (src/types.ts:1198-1203, WorkspaceStateContext). Mit C5.1 persistieren sie
 * im Document-Store, damit der "Übernehmen"-Flow aus Pack-Imports lauffähig
 * wird.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeExerciseSession,
  sanitizeResiliencePlan,
  sanitizeState,
} from './services/sanitizers.js';

// --- Round-Trip: leere Defaults bleiben erhalten ----------------------------

test('sanitizeState returns safe defaults for the six new C5.1 fields when input is empty', () => {
  const out = sanitizeState({});
  assert.deepEqual(out.riskEntries, []);
  assert.equal(out.resiliencePlan, null);
  assert.deepEqual(out.archivedResiliencePlans, []);
  assert.equal(out.currentTabletopSession, null);
  assert.deepEqual(out.archivedTabletopSessions, []);
  assert.deepEqual(out.importedTabletopScenarios, []);
});

// --- Round-Trip: populated state preserves all six fields -------------------

test('sanitizeState preserves populated C5.1 fields end-to-end', () => {
  const payload = {
    riskEntries: [
      {
        id: 'risk-1',
        categoryId: 'technical',
        subCategoryId: 'tech_infrastructure',
        titel: 'Sauerstoffversorgung',
        beschreibung: '',
        eintrittswahrscheinlichkeit: 2,
        auswirkung: 5,
        affectedAssetIds: [],
        affectedProcessIds: [],
        affectedInterdependencies: [],
        mitigationMeasureIds: [],
        residualRisk: 3,
        reviewDate: '',
        owner: '',
      },
    ],
    resiliencePlan: {
      id: 'plan-1',
      tenantId: 'tenant-demo',
      version: '1.0.0',
      status: 'review',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      content: {
        scope: { operatorName: 'Demo-Klinik' },
        riskBasis: { methodology: 'All-Gefahren' },
        measuresByGoal: {
          prevent: [],
          protect: [],
          respond: [],
          recover: [],
        },
        governance: {},
        reporting: {},
        evidence: { evidenceReferences: [], reviewCycleYears: 2 },
      },
    },
    archivedResiliencePlans: [
      {
        id: 'plan-archive-1',
        tenantId: 'tenant-demo',
        version: '0.9.0',
        status: 'archived',
        content: {
          scope: {}, riskBasis: { topRisks: [] }, measuresByGoal: { prevent: [], protect: [], respond: [], recover: [] },
          governance: {}, reporting: {}, evidence: { evidenceReferences: [] },
        },
      },
    ],
    currentTabletopSession: {
      id: 'session-1',
      scenarioId: 'scn-kis',
      scenarioVersion: '1.0.0',
      tenantId: 'tenant-demo',
      status: 'active',
      startedAt: '2026-04-22T10:00:00.000Z',
      currentStepIndex: 2,
      decisions: [{ decisionId: 'dec1', selectedOptionId: 'opt_yes', chosenAt: '2026-04-22T10:05:00.000Z' }],
      injectAcks: [{ injectId: 'inj1', acknowledgedAt: '2026-04-22T10:02:00.000Z' }],
      participantNotes: 'Downtime-Verfahren aktiviert.',
    },
    archivedTabletopSessions: [
      { id: 'session-archive-1', scenarioId: 'scn-mci', scenarioVersion: '1.0.0', tenantId: 'tenant-demo', status: 'completed', currentStepIndex: 5, decisions: [], injectAcks: [] },
    ],
    importedTabletopScenarios: [
      { id: 'scn-kis', version: '1.0.0', title: 'KIS-Ausfall' },
    ],
  };

  const out = sanitizeState(payload);

  assert.equal(out.riskEntries.length, 1);
  assert.equal(out.riskEntries[0].id, 'risk-1');

  assert.equal(out.resiliencePlan.id, 'plan-1');
  assert.equal(out.resiliencePlan.status, 'review');
  assert.equal(out.resiliencePlan.content.scope.operatorName, 'Demo-Klinik');
  assert.equal(out.resiliencePlan.content.evidence.reviewCycleYears, 2);

  assert.equal(out.archivedResiliencePlans.length, 1);
  assert.equal(out.archivedResiliencePlans[0].status, 'archived');

  assert.equal(out.currentTabletopSession.id, 'session-1');
  assert.equal(out.currentTabletopSession.status, 'active');
  assert.equal(out.currentTabletopSession.currentStepIndex, 2);
  assert.equal(out.currentTabletopSession.decisions.length, 1);

  assert.equal(out.archivedTabletopSessions.length, 1);
  assert.equal(out.archivedTabletopSessions[0].status, 'completed');

  assert.equal(out.importedTabletopScenarios.length, 1);
  assert.equal(out.importedTabletopScenarios[0].title, 'KIS-Ausfall');
});

// --- Invalid status values fall back to defaults ----------------------------

test('sanitizeResiliencePlan coerces invalid status to draft', () => {
  const plan = sanitizeResiliencePlan({
    id: 'p1',
    tenantId: 't1',
    version: '1.0.0',
    status: 'unknown_status',
    content: {
      scope: {}, riskBasis: {}, measuresByGoal: { prevent: [], protect: [], respond: [], recover: [] },
      governance: {}, reporting: {}, evidence: {},
    },
  });
  assert.equal(plan.status, 'draft');
});

test('sanitizeExerciseSession coerces invalid status to not_started', () => {
  const session = sanitizeExerciseSession({
    id: 's1',
    scenarioId: 'scn',
    scenarioVersion: '1.0.0',
    tenantId: 't1',
    status: 'foobar',
    currentStepIndex: 0,
  });
  assert.equal(session.status, 'not_started');
});

// --- archivedResiliencePlans filter: entries without id dropped ------------

test('sanitizeState drops archivedResiliencePlans entries without id', () => {
  const out = sanitizeState({
    archivedResiliencePlans: [
      { id: '', tenantId: 't1', version: '1.0.0', content: { scope: {}, riskBasis: {}, measuresByGoal: { prevent: [], protect: [], respond: [], recover: [] }, governance: {}, reporting: {}, evidence: {} } },
      { id: 'keep-me', tenantId: 't1', version: '1.0.0', status: 'archived', content: { scope: {}, riskBasis: {}, measuresByGoal: { prevent: [], protect: [], respond: [], recover: [] }, governance: {}, reporting: {}, evidence: {} } },
    ],
  });
  assert.equal(out.archivedResiliencePlans.length, 1);
  assert.equal(out.archivedResiliencePlans[0].id, 'keep-me');
});

// --- null passthrough for scalar fields -------------------------------------

test('sanitizeResiliencePlan returns null when input is null or undefined', () => {
  assert.equal(sanitizeResiliencePlan(null), null);
  assert.equal(sanitizeResiliencePlan(undefined), null);
});

test('sanitizeExerciseSession returns null when input is null or undefined', () => {
  assert.equal(sanitizeExerciseSession(null), null);
  assert.equal(sanitizeExerciseSession(undefined), null);
});
