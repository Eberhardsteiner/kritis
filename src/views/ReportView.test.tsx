/**
 * ReportView.test.tsx · C5.4.6 · Penalty-Gating + PT-Bandbreite
 *
 * Fokus-Tests für die zwei in C5.4.6 angegangenen Bugs:
 *  - Bug 1: Bußgeldrahmen-Card hängt jetzt am `SHOW_PENALTY_EXPOSURE`-
 *    Flag (analog zu KritisView), während die Geschäftsleitungshaftungs-
 *    Card weiterhin gerendert wird.
 *  - Bug 3: PT-Anzeige nutzt jetzt `formatPersonDaysRange` statt
 *    `totalPersonDays.toLocaleString` und zeigt damit eine Bandbreite
 *    (Min – Max) an, konsistent zu Dashboard und DOCX-Export.
 *
 * Die übrigen ReportView-Sektionen (Export-Pakete, Audit-Listings,
 * Freigabe-Workflow) sind nicht Teil dieses Bug-Fixes und werden hier
 * nicht abgedeckt.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ActionItem,
  AuditFindingSummary,
  AuthorityAssignmentResolved,
  BenchmarkSnapshot,
  CertificationProgress,
  ChecklistProgress,
  CompanyProfile,
  GapAnalysisSummary,
  RegulatoryProfile,
  RegulatoryRegimeId,
  RegulatoryRegimeSummary,
  DeadlineSummary,
  DocumentLibrarySummary,
  EvidenceSummary,
  ExportPackageEntry,
  GovernanceSummary,
  KritisApplicability,
  RequirementDefinition,
  RequirementStatus,
  ScoreSnapshot,
  SiteItem,
  StakeholderItem,
} from '../types';
import type { KritisMilestones } from '../lib/regulatory';
import type { PenaltyEstimate } from '../lib/penaltyCalculator';

// SHOW_PENALTY_EXPOSURE ist standardmäßig `false` (Demo-Phase). Tests,
// die das Pilot-Verhalten prüfen wollen, mocken das Modul lokal.
import { ReportView } from './ReportView';

// ─────────────────────────────────────────────────────────────────────
// Test-Fixtures
// ─────────────────────────────────────────────────────────────────────

const companyProfile: CompanyProfile = {
  companyName: 'Demo-Unternehmen',
  industryLabel: 'Produktion',
  employees: '250',
  locations: '3',
  criticalService: 'Notfallversorgung',
  personsServed: '750000',
};

const regulatoryProfile: RegulatoryProfile = {
  jurisdiction: 'DE',
  scopeByRegime: {
    de_kritisdachg: 'in_scope',
    de_bsig_nis2: 'unknown',
    at_nisg_2026: 'unknown',
    ch_bacs_ci: 'unknown',
  },
  bsigEntityClass: 'unknown',
  lastReviewDate: '',
  owner: 'CISO',
  notes: '',
  managementBoardContact: 'CEO Frau Müller',
  kritisEntityStatus: 'identified_not_registered',
};

const scoreSnapshot: ScoreSnapshot = {
  overallScore: 62,
  completion: 85,
  maturityLabel: 'Solide',
  domainScores: [],
  recommendations: [],
};

const benchmark: BenchmarkSnapshot = {
  sizeBand: 'mittel',
  overallTarget: 70,
  domainTargets: {},
  overallGap: 8,
  notes: [],
};

const governanceSummary: GovernanceSummary = {
  score: 65,
  stakeholderCoverage: 80,
  siteCoverage: 60,
  assetCoverage: 50,
  reviewCoverage: 70,
  dueReviews: 0,
  dataAvailable: true,
};

const evidenceSummary: EvidenceSummary = {
  total: 5,
  approved: 3,
  review: 1,
  draft: 1,
  missing: 0,
  coverage: 78,
  dataAvailable: true,
};

const documentLibrarySummary: DocumentLibrarySummary = {
  total: 0,
  attachedFiles: 0,
  dueReviews: 0,
  expired: 0,
  expiringSoon: 0,
  missingFolder: 0,
  byFolder: [],
};

const deadlineSummary: DeadlineSummary = {
  total: 0,
  overdue: 0,
  dueSoon: 0,
  regulatory: 0,
  nextItems: [],
};

const certificationProgress: CertificationProgress = {
  score: 50,
  readyStages: 1,
  stageCompletion: 33,
  dataAvailable: true,
};

const checklistProgress: ChecklistProgress = {
  score: 60,
  total: 10,
  evidenced: 6,
  readyLike: 6,
  blockers: 0,
};

const findingSummary: AuditFindingSummary = {
  total: 0,
  open: 0,
  overdue: 0,
  critical: 0,
};

const applicability: KritisApplicability = {
  status: 'wahrscheinlich',
  title: 'Wahrscheinlich KRITIS',
  text: 'Test-Begründung',
};

const kritisMilestones: KritisMilestones = {
  earliestRegistrationAt: '2026-06-30',
  managementAccountabilityActiveAt: '2027-01-01',
};

const kritisPenaltyEstimate: PenaltyEstimate = {
  upperBound: 1_800_000,
  rationale: ['Betreiber-Risikoanalyse fehlt', 'Resilienzplan fehlt'],
};

const noopHandler = () => {};

function buildRequiredProps(overrides: Partial<{
  gapAnalysisSummary: GapAnalysisSummary;
}> = {}) {
  const defaultGap: GapAnalysisSummary = {
    totalPersonDays: 8,
    minPersonDays: 6,
    maxPersonDays: 10,
    calendarWeeks: 2,
    entryCount: 2,
    byRegime: [
      {
        regimeId: 'de_kritisdachg',
        regimeLabel: 'KRITIS-DachG',
        totalPersonDays: 8,
        minPersonDays: 6,
        maxPersonDays: 10,
        byCategory: { risk: 8 },
        entries: [],
      },
    ],
  };
  return {
    companyProfile,
    regulatoryProfile,
    regimeSummaries: [] as RegulatoryRegimeSummary[],
    module: undefined,
    scoreSnapshot,
    benchmark,
    governanceSummary,
    applicability,
    requirementProgress: { score: 50, openCount: 5, readyCount: 3 },
    requirements: [] as RequirementDefinition[],
    requirementStates: {} as Record<string, RequirementStatus>,
    actionItems: [] as ActionItem[],
    evidenceSummary,
    documentLibrarySummary,
    deadlineSummary,
    certificationProgress,
    checklistProgress,
    findingSummary,
    stakeholders: [] as StakeholderItem[],
    sites: [] as SiteItem[],
    kritisMilestones,
    kritisPenaltyEstimate,
    authorityAssignmentsByRegime: {} as Record<RegulatoryRegimeId, AuthorityAssignmentResolved[]>,
    gapAnalysisSummary: overrides.gapAnalysisSummary ?? defaultGap,
    exportPackages: [] as ExportPackageEntry[],
    exportApprovalRequired: false,
    onExportMarkdown: noopHandler,
    onExportManagementPdf: noopHandler,
    onExportAuditPdf: noopHandler,
    onExportActionCsv: noopHandler,
    onExportEvidenceCsv: noopHandler,
    onExportStakeholderCsv: noopHandler,
    onExportFindingCsv: noopHandler,
    onExportFormalHtml: noopHandler,
    onCreateServerPackage: noopHandler,
    onReleaseExportPackage: noopHandler,
    onDownloadExportPackage: noopHandler,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe('ReportView · Penalty-Gating (C5.4.6 Bug 1)', () => {
  it('blendet Bußgeldrahmen-Card aus, wenn SHOW_PENALTY_EXPOSURE = false (Default für Demo-Phase)', () => {
    render(<ReportView {...buildRequiredProps()} />);
    expect(screen.queryByText(/Bußgeldrahmen/i)).toBeNull();
    expect(screen.queryByText(/Potenzielle Oberschwelle/i)).toBeNull();
  });

  it('rendert Geschäftsleitungshaftungs-Card auch bei SHOW_PENALTY_EXPOSURE = false (faktische Compliance-Info)', () => {
    render(<ReportView {...buildRequiredProps()} />);
    expect(screen.getByText(/Geschäftsleitungshaftung/i)).toBeInTheDocument();
  });
});

describe('ReportView · Penalty-Gating mit Pilot-Flag aktiv', () => {
  it('zeigt Bußgeldrahmen-Card, wenn SHOW_PENALTY_EXPOSURE = true', async () => {
    // Modul-Mock + dynamic import, damit SHOW_PENALTY_EXPOSURE für diesen
    // Test isoliert auf `true` umgesetzt wird, ohne andere Suites zu
    // beeinflussen.
    vi.resetModules();
    vi.doMock('../lib/featureFlags', () => ({
      SHOW_PENALTY_EXPOSURE: true,
      DEMO_MODE_ALL_PERMISSIONS: true,
    }));
    const { ReportView: ReportViewWithPenalty } = await import('./ReportView');
    render(<ReportViewWithPenalty {...buildRequiredProps()} />);
    expect(screen.getByText(/Bußgeldrahmen/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.800\.000 €/)).toBeInTheDocument();
    vi.doUnmock('../lib/featureFlags');
    vi.resetModules();
  });
});

describe('ReportView · PT-Bandbreite (C5.4.6 Bug 3)', () => {
  it('zeigt PT-Bandbreite (Min – Max) statt Single-Number, wenn min != max', () => {
    render(<ReportView {...buildRequiredProps()} />);
    // Default-Fixture hat min 6, max 10 → "6 – 10 PT". Anzeige sitzt in
    // der Eltern-<p>, weil "Geschätzter Restaufwand:" als <strong> rendert.
    const labelNode = screen.getByText(/Geschätzter Restaufwand:/);
    const paragraph = labelNode.closest('p');
    expect(paragraph).not.toBeNull();
    expect(paragraph!.textContent).toMatch(/6 – 10 PT/);
    expect(paragraph!.textContent).toMatch(/\(Mittelwert\)/);
  });

  it('zeigt eine einzelne PT-Zahl, wenn min == max (kein Bandbreiten-Strich)', () => {
    const single: GapAnalysisSummary = {
      totalPersonDays: 5,
      minPersonDays: 5,
      maxPersonDays: 5,
      calendarWeeks: 1,
      entryCount: 1,
      byRegime: [
        {
          regimeId: 'de_kritisdachg',
          regimeLabel: 'KRITIS-DachG',
          totalPersonDays: 5,
          minPersonDays: 5,
          maxPersonDays: 5,
          byCategory: { risk: 5 },
          entries: [],
        },
      ],
    };
    render(<ReportView {...buildRequiredProps({ gapAnalysisSummary: single })} />);
    const labelNode = screen.getByText(/Geschätzter Restaufwand:/);
    const paragraph = labelNode.closest('p');
    expect(paragraph).not.toBeNull();
    expect(paragraph!.textContent).toMatch(/5 PT/);
    // En-Dash zur Bandbreiten-Trennung darf nicht erscheinen
    expect(paragraph!.textContent).not.toMatch(/\d+ – \d+ PT/);
  });

  it('zeigt PT-Bandbreite auch pro Regime (Konsistenz zur Gesamt-Anzeige)', () => {
    render(<ReportView {...buildRequiredProps()} />);
    // KRITIS-DachG-Regime hat min 6, max 10 → "6 – 10 PT" auch pro Regime
    const items = screen.getAllByText(/6 – 10 PT/);
    // Mindestens zweimal: einmal Gesamt, einmal pro Regime
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('hat den aktualisierten Hilfetext mit Verweis auf Status-Ableitung aus Grundanalyse', () => {
    render(<ReportView {...buildRequiredProps()} />);
    expect(screen.getByText(/Aufwandsschätzung pro Anforderung mit Bandbreite/i)).toBeInTheDocument();
    expect(screen.getByText(/aus den Antworten der Grundanalyse abgeleitet/i)).toBeInTheDocument();
    // Alter Hilfetext mit "Heuristik" und "Basis je Kategorie" darf nicht mehr auftauchen
    expect(screen.queryByText(/Basis je Kategorie/)).toBeNull();
  });
});
