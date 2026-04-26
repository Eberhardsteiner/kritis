import { describe, expect, it } from 'vitest';
import { buildDeadlineSummary } from './workspace';
import { defaultRegulatoryProfile } from './regulatory';
import type {
  ComplianceCalendar,
  KritisApplicability,
  RegulatoryProfile,
  ReviewPlan,
} from '../types';

function makeReviewPlan(): ReviewPlan {
  return {
    executiveSponsor: '',
    approver: '',
    nextInternalAuditDate: '',
    nextManagementReviewDate: '',
    nextExerciseDate: '',
    nextEvidenceReviewDate: '',
  };
}

function makeComplianceCalendar(overrides: Partial<ComplianceCalendar> = {}): ComplianceCalendar {
  return {
    registrationDate: '',
    lastRiskAssessmentDate: '',
    lastResiliencePlanUpdate: '',
    lastBsiEvidenceAuditDate: '',
    incidentContact: '',
    incidentBackupContact: '',
    bsigRegistrationDate: '',
    lastCyberRiskAssessmentDate: '',
    lastIncidentExerciseDate: '',
    ...overrides,
  };
}

function makeApplicability(): KritisApplicability {
  return {
    status: 'wahrscheinlich',
    title: 'KRITIS-Relevanz',
    text: 'Testszenario',
  };
}

function makeProfile(overrides: Partial<RegulatoryProfile> = {}): RegulatoryProfile {
  return {
    ...defaultRegulatoryProfile,
    scopeByRegime: {
      ...defaultRegulatoryProfile.scopeByRegime,
      de_kritisdachg: 'in_scope',
      de_bsig_nis2: 'out_of_scope',
    },
    ...overrides,
  };
}

function summaryFor(profile: RegulatoryProfile, complianceCalendar?: ComplianceCalendar) {
  return buildDeadlineSummary({
    actionItems: [],
    evidenceItems: [],
    exercises: [],
    reviewPlan: makeReviewPlan(),
    complianceCalendar: complianceCalendar ?? makeComplianceCalendar(),
    applicability: makeApplicability(),
    regulatoryProfile: profile,
  });
}

describe('buildDeadlineSummary · KRITIS-Fristen aus Registrierungsdatum', () => {
  it('leitet Risikoanalyse-, Resilienzplan- und Geschäftsleitungs-Fristen aus kritisRegistrationDate ab', () => {
    const profile = makeProfile({ kritisRegistrationDate: '2026-09-01' });
    const summary = summaryFor(profile);

    const risk = summary.nextItems.find((item) => item.id === 'compliance-kritis-initial-risk-analysis');
    const plan = summary.nextItems.find((item) => item.id === 'compliance-kritis-initial-resilience-plan');
    const management = summary.nextItems.find((item) => item.id === 'compliance-kritis-management-active');

    expect(risk?.dueDate).toBe('2027-06-01');
    expect(risk?.sourceLabel).toBe('§ 12 KRITISDachG');
    expect(plan?.dueDate).toBe('2027-07-01');
    expect(plan?.sourceLabel).toBe('§ 13 KRITISDachG');
    expect(management?.dueDate).toBe('2027-07-01');
    expect(management?.sourceLabel).toBe('§ 20 KRITISDachG');
  });

  it('zeigt ohne Registrierungsdatum den Hinweis "Registrierung frühestens 17.07.2026"', () => {
    const profile = makeProfile({ kritisRegistrationDate: '' });
    const summary = summaryFor(profile);

    const registration = summary.nextItems.find((item) => item.id === 'compliance-kritis-registration');

    expect(registration).toBeDefined();
    expect(registration?.dueDate).toBe('2026-07-17');
    expect(registration?.description).toContain('2026-07-17');
    expect(registration?.description).toContain('frühestens');
  });

  it('erzeugt ohne Registrierungsdatum keine abgeleiteten Milestone-Fristen', () => {
    const profile = makeProfile({ kritisRegistrationDate: '' });
    const summary = summaryFor(profile);

    expect(summary.nextItems.find((item) => item.id === 'compliance-kritis-initial-risk-analysis')).toBeUndefined();
    expect(summary.nextItems.find((item) => item.id === 'compliance-kritis-initial-resilience-plan')).toBeUndefined();
    expect(summary.nextItems.find((item) => item.id === 'compliance-kritis-management-active')).toBeUndefined();
  });

  it('fällt auf complianceCalendar.registrationDate zurück, wenn profile.kritisRegistrationDate leer ist', () => {
    const profile = makeProfile({ kritisRegistrationDate: '' });
    const calendar = makeComplianceCalendar({ registrationDate: '2026-09-01' });
    const summary = summaryFor(profile, calendar);

    const risk = summary.nextItems.find((item) => item.id === 'compliance-kritis-initial-risk-analysis');
    expect(risk?.dueDate).toBe('2027-06-01');
  });

  it('floort ein Registrierungsdatum vor dem 17.07.2026 auf den gesetzlichen Floor', () => {
    const profile = makeProfile({ kritisRegistrationDate: '2026-04-19' });
    const summary = summaryFor(profile);

    const risk = summary.nextItems.find((item) => item.id === 'compliance-kritis-initial-risk-analysis');
    const management = summary.nextItems.find((item) => item.id === 'compliance-kritis-management-active');
    expect(risk?.dueDate).toBe('2027-04-17');
    expect(management?.dueDate).toBe('2027-05-17');
  });
});

describe('buildDeadlineSummary · undated vs overdue (C5.4.7 Bug 12)', () => {
  it('zählt Items mit Status "open" als undated, NICHT als overdue', () => {
    // Action ohne dueDate produziert Status 'open'.
    const summary = buildDeadlineSummary({
      actionItems: [
        {
          id: 'a1',
          moduleId: 'm-1',
          title: 'Aktion ohne Datum',
          owner: '',
          dueDate: '',
          status: 'open',
          priority: 'mittel',
          description: '',
          relatedQuestionIds: [],
          relatedRequirementIds: [],
          sourceType: 'manual',
          sourceLabel: '',
          notes: '',
          createdAt: '',
        },
      ],
      evidenceItems: [],
      exercises: [],
      reviewPlan: makeReviewPlan(),
      complianceCalendar: makeComplianceCalendar(),
      applicability: makeApplicability(),
      regulatoryProfile: makeProfile({ kritisRegistrationDate: '' }),
    });
    expect(summary.undated).toBeGreaterThan(0);
    // Vor C5.4.7 zählte das gleiche Item als overdue. Jetzt nicht mehr.
    expect(summary.overdue).toBe(0);
  });

  it('zählt Items mit dueDate in der Vergangenheit als overdue', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const summary = buildDeadlineSummary({
      actionItems: [
        {
          id: 'a1',
          moduleId: 'm-1',
          title: 'Überfällige Aktion',
          owner: '',
          dueDate: yesterday,
          status: 'open',
          priority: 'mittel',
          description: '',
          relatedQuestionIds: [],
          relatedRequirementIds: [],
          sourceType: 'manual',
          sourceLabel: '',
          notes: '',
          createdAt: '',
        },
      ],
      evidenceItems: [],
      exercises: [],
      reviewPlan: makeReviewPlan(),
      complianceCalendar: makeComplianceCalendar(),
      applicability: makeApplicability(),
      regulatoryProfile: makeProfile({ kritisRegistrationDate: '' }),
    });
    expect(summary.overdue).toBeGreaterThan(0);
  });

  it('Greenfield-Tenant ohne befüllte Aktionen: overdue=0 (nur Compliance-Milestones, ohne Vergangenheit)', () => {
    const summary = summaryFor(makeProfile({ kritisRegistrationDate: '' }));
    expect(summary.overdue).toBe(0);
    // undated ist >= 0 — leerer ReviewPlan erzeugt open-Items, das ist
    // korrekt und zählt jetzt unter `undated`, NICHT unter `overdue`.
    expect(summary.undated).toBeGreaterThanOrEqual(0);
  });
});
