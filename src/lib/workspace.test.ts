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
