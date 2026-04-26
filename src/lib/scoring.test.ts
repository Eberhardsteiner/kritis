/**
 * scoring.test.ts · Empty-State-Behandlung der Summary-Funktionen
 *
 * Fokus von C5.4.5: Trennung "noch nicht erfasst" vs. "erfasst,
 * aber Score 0". Greenfield-Tenants sollen am Demo-Anfang nicht
 * fälschlicherweise als „komplett unreif" erscheinen.
 *
 * Die Tests decken hier nur die `dataAvailable`-Heuristik ab; die
 * eigentlichen Score-Formeln werden indirekt über bestehende
 * Integrationstests in den Views verifiziert.
 */
import { describe, expect, it } from 'vitest';
import {
  getCertificationProgress,
  getEvidenceSummary,
  getGovernanceSummary,
  getResilienceSummary,
} from './scoring';
import type {
  AssetItem,
  BusinessProcessItem,
  CertificationState,
  DependencyItem,
  EvidenceItem,
  ExerciseItem,
  ReviewPlan,
  ScenarioItem,
  SiteItem,
  StakeholderItem,
} from '../types';

const emptyReviewPlan: ReviewPlan = {
  executiveSponsor: '',
  approver: '',
  nextInternalAuditDate: '',
  nextManagementReviewDate: '',
  nextExerciseDate: '',
  nextEvidenceReviewDate: '',
};

function makeStakeholder(overrides: Partial<StakeholderItem> = {}): StakeholderItem {
  return {
    id: 's-1',
    moduleId: 'm-1',
    name: 'Demo Tester',
    roleLabel: '',
    department: '',
    email: '',
    approvalScope: '',
    responsibilities: '',
    isPrimary: false,
    notes: '',
    ...overrides,
  };
}

function makeSite(overrides: Partial<SiteItem> = {}): SiteItem {
  return {
    id: 'site-1',
    moduleId: 'm-1',
    name: 'Demo-Standort',
    type: '',
    location: '',
    criticality: 'niedrig',
    primaryService: '',
    fallbackSite: '',
    notes: '',
    ...overrides,
  };
}

function makeAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    moduleId: 'm-1',
    siteId: '',
    name: 'Demo-Asset',
    type: '',
    criticality: 'niedrig',
    owner: '',
    rtoHours: '',
    fallback: '',
    dependencies: '',
    notes: '',
    ...overrides,
  };
}

function makeProcess(overrides: Partial<BusinessProcessItem> = {}): BusinessProcessItem {
  return {
    id: 'p-1',
    moduleId: 'm-1',
    title: 'Demo-Prozess',
    owner: '',
    criticality: 'niedrig',
    mtpdHours: '',
    rtoHours: '',
    rpoHours: '',
    manualWorkaround: false,
    dependencies: '',
    outputs: '',
    notes: '',
    ...overrides,
  };
}

function makeDependency(overrides: Partial<DependencyItem> = {}): DependencyItem {
  return {
    id: 'd-1',
    moduleId: 'm-1',
    title: 'Demo-Lieferant',
    category: 'lieferant',
    criticality: 'niedrig',
    singlePointOfFailure: false,
    fallback: '',
    contractReference: '',
    contact: '',
    notes: '',
    ...overrides,
  };
}

function makeScenario(overrides: Partial<ScenarioItem> = {}): ScenarioItem {
  return {
    id: 'sc-1',
    moduleId: 'm-1',
    title: 'Demo-Szenario',
    category: '',
    description: '',
    likelihood: 1,
    impact: 1,
    owner: '',
    linkedProcessIds: [],
    linkedAssetIds: [],
    linkedDependencyIds: [],
    exerciseStatus: 'not_tested',
    playbook: '',
    lastExerciseDate: '',
    nextExerciseDate: '',
    notes: '',
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ExerciseItem> = {}): ExerciseItem {
  return {
    id: 'ex-1',
    moduleId: 'm-1',
    scenarioId: 'sc-1',
    title: 'Demo-Übung',
    exerciseType: 'tabletop',
    exerciseDate: '',
    owner: '',
    result: 'planned',
    participants: '',
    findings: '',
    followUpActionIds: [],
    nextExerciseDate: '',
    notes: '',
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: 'ev-1',
    moduleId: 'm-1',
    title: 'Demo-Evidenz',
    type: 'policy',
    owner: '',
    reviewer: '',
    version: '',
    classification: 'intern',
    folder: '',
    tags: [],
    externalId: '',
    link: '',
    status: 'draft',
    reviewDate: '',
    validUntil: '',
    reviewCycleDays: 0,
    sourceType: 'manual',
    sourceLabel: '',
    relatedQuestionIds: [],
    relatedRequirementIds: [],
    notes: '',
    createdAt: '',
    ...overrides,
  };
}

const emptyCertificationState: CertificationState = {
  auditLead: '',
  targetDate: '',
  decisionNote: '',
  stageStates: {},
};

describe('getGovernanceSummary · dataAvailable (C5.4.5)', () => {
  it('liefert dataAvailable=false bei vollständig leerem Tenant', () => {
    const summary = getGovernanceSummary([], [], [], emptyReviewPlan);
    expect(summary.dataAvailable).toBe(false);
    expect(summary.score).toBe(0);
  });

  it('liefert dataAvailable=true bei einem einzigen Stakeholder (auch wenn andere Listen leer)', () => {
    const summary = getGovernanceSummary([makeStakeholder()], [], [], emptyReviewPlan);
    expect(summary.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true bei einem einzigen Standort', () => {
    const summary = getGovernanceSummary([], [makeSite()], [], emptyReviewPlan);
    expect(summary.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true bei einem einzigen Asset', () => {
    const summary = getGovernanceSummary([], [], [makeAsset()], emptyReviewPlan);
    expect(summary.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true wenn nur reviewPlan.executiveSponsor gefüllt ist', () => {
    const summary = getGovernanceSummary([], [], [], { ...emptyReviewPlan, executiveSponsor: 'COO' });
    expect(summary.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true wenn nur reviewPlan.nextInternalAuditDate gefüllt ist', () => {
    const summary = getGovernanceSummary([], [], [], { ...emptyReviewPlan, nextInternalAuditDate: '2026-12-31' });
    expect(summary.dataAvailable).toBe(true);
  });

  it('Whitespace-only ReviewPlan-Felder zählen NICHT als erfasst', () => {
    const summary = getGovernanceSummary([], [], [], {
      ...emptyReviewPlan,
      executiveSponsor: '   ',
      approver: '\t\n',
    });
    expect(summary.dataAvailable).toBe(false);
  });
});

describe('getResilienceSummary · dataAvailable (C5.4.5)', () => {
  it('liefert dataAvailable=false bei leeren Listen', () => {
    const summary = getResilienceSummary([], [], [], []);
    expect(summary.dataAvailable).toBe(false);
    expect(summary.score).toBe(0);
  });

  it('liefert dataAvailable=true bei einem einzigen Prozess', () => {
    const summary = getResilienceSummary([makeProcess()], [], [], []);
    expect(summary.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true bei einer einzigen Dependency', () => {
    const summary = getResilienceSummary([], [makeDependency()], [], []);
    expect(summary.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true bei einem einzigen Szenario', () => {
    const summary = getResilienceSummary([], [], [makeScenario()], []);
    expect(summary.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true bei einer einzigen Übung', () => {
    const summary = getResilienceSummary([], [], [], [makeExercise()]);
    expect(summary.dataAvailable).toBe(true);
  });
});

describe('getEvidenceSummary · dataAvailable (C5.4.5)', () => {
  it('liefert dataAvailable=false bei leerer Evidenz-Liste', () => {
    const summary = getEvidenceSummary([]);
    expect(summary.dataAvailable).toBe(false);
    expect(summary.coverage).toBe(0);
  });

  it('liefert dataAvailable=true bei einer einzigen (auch missing) Evidenz', () => {
    const summary = getEvidenceSummary([makeEvidence({ status: 'missing' })]);
    expect(summary.dataAvailable).toBe(true);
  });
});

describe('getCertificationProgress · dataAvailable (C5.4.5)', () => {
  it('liefert dataAvailable=false bei leeren Stages und 0 % Sub-Scores', () => {
    const progress = getCertificationProgress(emptyCertificationState, 0, 0);
    expect(progress.dataAvailable).toBe(false);
    expect(progress.score).toBe(0);
  });

  it('liefert dataAvailable=true sobald requirementScore > 0', () => {
    const progress = getCertificationProgress(emptyCertificationState, 35, 0);
    expect(progress.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true sobald evidenceCoverage > 0', () => {
    const progress = getCertificationProgress(emptyCertificationState, 0, 12);
    expect(progress.dataAvailable).toBe(true);
  });

  it('liefert dataAvailable=true sobald eine Stage in_progress oder ready ist', () => {
    const stateWithStage: CertificationState = {
      auditLead: '',
      targetDate: '',
      decisionNote: '',
      stageStates: { scope: { status: 'in_progress', notes: '' } },
    };
    const progress = getCertificationProgress(stateWithStage, 0, 0);
    expect(progress.dataAvailable).toBe(true);
  });
});

describe('Verifikations-Tabelle Greenfield → Voll befüllt', () => {
  it('Greenfield-Tenant: alle dataAvailable=false, alle score=0', () => {
    const governance = getGovernanceSummary([], [], [], emptyReviewPlan);
    const resilience = getResilienceSummary([], [], [], []);
    const evidence = getEvidenceSummary([]);
    expect(governance.dataAvailable).toBe(false);
    expect(governance.score).toBe(0);
    expect(resilience.dataAvailable).toBe(false);
    expect(resilience.score).toBe(0);
    expect(evidence.dataAvailable).toBe(false);
    expect(evidence.coverage).toBe(0);
  });

  it('Ein-Stakeholder-Tenant: governance.dataAvailable=true, score legitim niedrig (~9 %)', () => {
    const governance = getGovernanceSummary([makeStakeholder()], [], [], emptyReviewPlan);
    expect(governance.dataAvailable).toBe(true);
    // Stakeholder-Coverage 25 % × 0.35 = ~9 — niedrig aber legitim.
    expect(governance.score).toBeGreaterThan(0);
    expect(governance.score).toBeLessThan(20);
  });
});
