import { describe, expect, it } from 'vitest';
import { generateDraft, validatePlan } from './generator';
import type { RiskEntry } from '../riskCatalog/types';
import type {
  ActionItem,
  CompanyProfile,
  ComplianceCalendar,
  EvidenceItem,
  RegulatoryProfile,
} from '../../types';

function makeCompanyProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    companyName: 'Stadtwerke Musterheim',
    industryLabel: 'Energie',
    locations: '3 Standorte',
    employees: '420',
    criticalService: 'Stromverteilung',
    personsServed: '520000',
    ...overrides,
  };
}

function makeRegulatoryProfile(overrides: Partial<RegulatoryProfile> = {}): RegulatoryProfile {
  return {
    jurisdiction: 'DE',
    scopeByRegime: {
      de_kritisdachg: 'in_scope',
      de_bsig_nis2: 'in_scope',
      at_nisg_2026: 'unknown',
      ch_bacs_ci: 'unknown',
    },
    bsigEntityClass: 'essential',
    lastReviewDate: '',
    owner: 'BCM-Leitung',
    notes: '',
    managementBoardContact: 'Dr. Muster (CEO)',
    ...overrides,
  };
}

function makeComplianceCalendar(overrides: Partial<ComplianceCalendar> = {}): ComplianceCalendar {
  return {
    registrationDate: '',
    lastRiskAssessmentDate: '',
    lastResiliencePlanUpdate: '',
    lastBsiEvidenceAuditDate: '',
    incidentContact: 'BCM-Leitstelle · +49 30 555-100',
    incidentBackupContact: 'CISO · +49 30 555-110',
    bsigRegistrationDate: '',
    lastCyberRiskAssessmentDate: '',
    lastIncidentExerciseDate: '',
    ...overrides,
  };
}

function makeAction(overrides: Partial<ActionItem>): ActionItem {
  return {
    id: `a-${Math.random().toString(36).slice(2, 7)}`,
    moduleId: '',
    title: '',
    description: '',
    owner: '',
    dueDate: '',
    status: 'open',
    priority: 'mittel',
    sourceType: 'manual',
    sourceLabel: '',
    relatedQuestionIds: [],
    relatedRequirementIds: [],
    notes: '',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: `e-${Math.random().toString(36).slice(2, 7)}`,
    moduleId: '',
    title: '',
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
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRisk(overrides: Partial<RiskEntry>): RiskEntry {
  return {
    id: `r-${Math.random().toString(36).slice(2, 7)}`,
    categoryId: 'nature',
    subCategoryId: 'flooding',
    titel: 'Testrisiko',
    beschreibung: '',
    eintrittswahrscheinlichkeit: 3,
    auswirkung: 3,
    affectedAssetIds: [],
    affectedProcessIds: [],
    affectedInterdependencies: [],
    mitigationMeasureIds: [],
    residualRisk: 2,
    reviewDate: '',
    owner: '',
    ...overrides,
  };
}

describe('generateDraft · Scope und Stammdaten', () => {
  it('befüllt die Scope-Section aus dem companyProfile', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [],
      evidenceItems: [],
      tenantId: 'demo',
      planId: 'plan-fixed',
      generatedAt: new Date('2026-04-20T10:00:00Z'),
    });
    expect(plan.id).toBe('plan-fixed');
    expect(plan.tenantId).toBe('demo');
    expect(plan.status).toBe('draft');
    expect(plan.content.scope.operatorName).toBe('Stadtwerke Musterheim');
    expect(plan.content.scope.criticalService).toBe('Stromverteilung');
    expect(plan.content.scope.personsServed).toBe('520000');
  });

  it('verwendet module.sectorCategory, wenn verfügbar', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile({ industryLabel: 'Produktion' }),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      module: { id: 'm', name: 'Energie', description: '', sectorCategory: 'Energie' } as never,
      riskEntries: [],
      actionItems: [],
      evidenceItems: [],
    });
    expect(plan.content.scope.sector).toBe('Energie');
  });
});

describe('generateDraft · Top-Risiken aus B3', () => {
  it('überträgt die Top-Risiken aus der Risikoanalyse mit Score und Kritikalität', () => {
    const risks = [
      makeRisk({ id: 'r1', titel: 'Ransomware', categoryId: 'cyber_physical', subCategoryId: 'ransomware_production', eintrittswahrscheinlichkeit: 5, auswirkung: 5, residualRisk: 3 }),
      makeRisk({ id: 'r2', titel: 'Hochwasser', categoryId: 'nature', subCategoryId: 'flooding', eintrittswahrscheinlichkeit: 3, auswirkung: 4, residualRisk: 2 }),
      makeRisk({ id: 'r3', titel: 'Lieferkette', categoryId: 'technical', subCategoryId: 'supply_chain_disruption', eintrittswahrscheinlichkeit: 4, auswirkung: 3, residualRisk: 2 }),
    ];
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: risks,
      actionItems: [],
      evidenceItems: [],
      topRiskLimit: 2,
    });
    expect(plan.content.riskBasis.topRisks).toHaveLength(2);
    expect(plan.content.riskBasis.topRisks[0].title).toBe('Ransomware');
    expect(plan.content.riskBasis.topRisks[0].initialScore).toBe(25);
    expect(plan.content.riskBasis.topRisks[0].criticality).toBe('Sofort handeln');
  });
});

describe('generateDraft · Maßnahmen-Zuordnung zu Resilienzzielen', () => {
  it('respektiert eine explizit gesetzte resilienceGoal', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [
        makeAction({ id: 'a1', title: 'Irgendwas', resilienceGoal: 'recover' }),
      ],
      evidenceItems: [],
    });
    expect(plan.content.measuresByGoal.recover).toHaveLength(1);
    expect(plan.content.measuresByGoal.prevent).toHaveLength(0);
  });

  it('ordnet Maßnahmen per Keyword-Heuristik zu, wenn goal fehlt', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [
        makeAction({ id: 'a1', title: 'Mitarbeiterschulung BCM', description: 'Awareness-Training' }),
        makeAction({ id: 'a2', title: 'USV installieren', description: 'Notstrom für Serverraum' }),
        makeAction({ id: 'a3', title: 'Incident-Playbook aktualisieren', description: 'Meldewege' }),
        makeAction({ id: 'a4', title: 'Backup-Restore-Test', description: 'Wiederherstellungsprozedur' }),
      ],
      evidenceItems: [],
    });
    expect(plan.content.measuresByGoal.prevent.map((m) => m.id)).toContain('a1');
    expect(plan.content.measuresByGoal.protect.map((m) => m.id)).toContain('a2');
    expect(plan.content.measuresByGoal.respond.map((m) => m.id)).toContain('a3');
    expect(plan.content.measuresByGoal.recover.map((m) => m.id)).toContain('a4');
  });

  it('übersetzt ActionStatus auf MeasureStatus', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [
        makeAction({ id: 'done', title: 'Wiederherstellung', status: 'done', resilienceGoal: 'recover' }),
        makeAction({ id: 'active', title: 'Segmentierung', status: 'in_progress', resilienceGoal: 'protect' }),
        makeAction({ id: 'planned', title: 'Schulung', status: 'open', resilienceGoal: 'prevent' }),
      ],
      evidenceItems: [],
    });
    expect(plan.content.measuresByGoal.recover[0].status).toBe('ready');
    expect(plan.content.measuresByGoal.protect[0].status).toBe('active');
    expect(plan.content.measuresByGoal.prevent[0].status).toBe('planned');
  });

  it('verlinkt die ActionItem-ID für spätere Navigation', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [makeAction({ id: 'a1', title: 'Wiederaufbau', resilienceGoal: 'recover' })],
      evidenceItems: [],
    });
    expect(plan.content.measuresByGoal.recover[0].linkedActionItemId).toBe('a1');
  });
});

describe('generateDraft · Governance, Reporting, Evidence', () => {
  it('übernimmt managementBoardContact und owner aus dem RegulatoryProfile', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [],
      evidenceItems: [],
    });
    expect(plan.content.governance.managementBoardContact).toBe('Dr. Muster (CEO)');
    expect(plan.content.governance.programOwner).toBe('BCM-Leitung');
  });

  it('übernimmt Meldekontakte aus dem ComplianceCalendar', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [],
      evidenceItems: [],
    });
    expect(plan.content.reporting.incidentContact).toContain('BCM-Leitstelle');
    expect(plan.content.reporting.incidentBackupContact).toContain('CISO');
  });

  it('klassifiziert Evidenzen nach Quellstandard via Titel/Notes', () => {
    const plan = generateDraft({
      companyProfile: makeCompanyProfile(),
      regulatoryProfile: makeRegulatoryProfile(),
      complianceCalendar: makeComplianceCalendar(),
      riskEntries: [],
      actionItems: [],
      evidenceItems: [
        makeEvidence({ id: 'e1', title: 'ISO 27001 Zertifikat 2025' }),
        makeEvidence({ id: 'e2', title: 'BSI IT-Grundschutz Basis-Audit' }),
        makeEvidence({ id: 'e3', title: 'Allgemeine Notfallpolicy' }),
      ],
    });
    const refs = plan.content.evidence.evidenceReferences;
    expect(refs.find((r) => r.title.includes('ISO 27001'))?.sourceStandard).toBe('ISO/IEC 27001:2022');
    expect(refs.find((r) => r.title.includes('Grundschutz'))?.sourceStandard).toBe('BSI IT-Grundschutz 2023');
    expect(refs.find((r) => r.title.includes('Allgemeine'))?.sourceStandard).toBeUndefined();
  });
});

describe('validatePlan', () => {
  const baseInput = {
    companyProfile: makeCompanyProfile(),
    regulatoryProfile: makeRegulatoryProfile(),
    complianceCalendar: makeComplianceCalendar(),
    riskEntries: [makeRisk({ id: 'r1', titel: 'Hochwasser' })],
    actionItems: [
      makeAction({ id: 'a1', title: 'Schulung', resilienceGoal: 'prevent' }),
      makeAction({ id: 'a2', title: 'USV', resilienceGoal: 'protect' }),
      makeAction({ id: 'a3', title: 'Playbook', resilienceGoal: 'respond' }),
      makeAction({ id: 'a4', title: 'Backup', resilienceGoal: 'recover' }),
    ],
    evidenceItems: [],
  };

  it('meldet valid=true, wenn alle Pflichtfelder besetzt sind', () => {
    const plan = generateDraft(baseInput);
    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('meldet Fehler bei fehlendem Betreibernamen und kritischer Dienstleistung', () => {
    const plan = generateDraft({
      ...baseInput,
      companyProfile: makeCompanyProfile({ companyName: '', criticalService: '' }),
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('content.scope.operatorName');
    expect(paths).toContain('content.scope.criticalService');
  });

  it('meldet Fehler bei fehlendem Geschäftsleitungskontakt (§ 20) und Meldekontakt (§ 18)', () => {
    const plan = generateDraft({
      ...baseInput,
      regulatoryProfile: makeRegulatoryProfile({ managementBoardContact: '' }),
      complianceCalendar: makeComplianceCalendar({ incidentContact: '' }),
    });
    const result = validatePlan(plan);
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('content.governance.managementBoardContact');
    expect(paths).toContain('content.reporting.incidentContact');
  });

  it('meldet Warnungen für fehlende Maßnahmen je Resilienzziel und leere Top-Risiken', () => {
    const plan = generateDraft({
      ...baseInput,
      actionItems: [],
      riskEntries: [],
    });
    const result = validatePlan(plan);
    const warnPaths = result.issues.filter((i) => i.severity === 'warning').map((i) => i.path);
    expect(warnPaths).toContain('content.measuresByGoal.prevent');
    expect(warnPaths).toContain('content.measuresByGoal.protect');
    expect(warnPaths).toContain('content.measuresByGoal.respond');
    expect(warnPaths).toContain('content.measuresByGoal.recover');
    expect(warnPaths).toContain('content.riskBasis.topRisks');
    expect(result.valid).toBe(true);
  });
});
