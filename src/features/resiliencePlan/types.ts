/**
 * Typen für den Resilienzplan (§ 13 KRITISDachG).
 *
 * Der Plan folgt einer sechsteiligen Grundstruktur (Einleitung · Risikobasis ·
 * Resilienzziele und Maßnahmen · Governance · Meldewesen · Nachweise) und
 * kennzeichnet jede Maßnahme nach einem der vier Resilienzziele des § 13:
 * Verhindern, Schützen, Reagieren, Wiederherstellen.
 */

export type ResiliencePlanStatus = 'draft' | 'review' | 'approved' | 'archived';

export type ResilienceGoal = 'prevent' | 'protect' | 'respond' | 'recover';

export type MeasureStatus = 'planned' | 'active' | 'ready';

export interface ScopeSection {
  operatorName: string;
  sector: string;
  criticalService: string;
  locations: string;
  employees: string;
  personsServed: string;
  scopeNote: string;
}

export interface TopRiskReference {
  riskId?: string;
  title: string;
  category: string;
  initialScore: number;
  residualScore: number;
  criticality: string;
}

export interface RiskBasisSection {
  methodology: string;
  riskAnalysisReference: string;
  topRisks: TopRiskReference[];
  riskBasisNote: string;
}

export interface MeasureReference {
  id: string;
  title: string;
  description: string;
  goal: ResilienceGoal;
  linkedActionItemId?: string;
  owner: string;
  dueDate: string;
  status: MeasureStatus;
}

export interface MeasuresByGoal {
  prevent: MeasureReference[];
  protect: MeasureReference[];
  respond: MeasureReference[];
  recover: MeasureReference[];
}

export interface GovernanceSection {
  managementBoardContact: string;
  programOwner: string;
  escalationPath: string;
  boardReviewCadence: string;
  governanceNote: string;
}

export interface ReportingSection {
  incidentContact: string;
  incidentBackupContact: string;
  bsiPortalNote: string;
  firstReportingTimeline: string;
  reportingNote: string;
}

export interface EvidenceItemReference {
  title: string;
  type: string;
  sourceStandard?: string;
}

export interface EvidenceSection {
  evidenceReferences: EvidenceItemReference[];
  reviewCycleYears: number;
  equivalentProofsNote: string;
  evidenceNote: string;
}

export interface ResiliencePlanContent {
  scope: ScopeSection;
  riskBasis: RiskBasisSection;
  measuresByGoal: MeasuresByGoal;
  governance: GovernanceSection;
  reporting: ReportingSection;
  evidence: EvidenceSection;
}

export interface ResiliencePlan {
  id: string;
  tenantId: string;
  version: string;
  status: ResiliencePlanStatus;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  content: ResiliencePlanContent;
}

export interface ResiliencePlanValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ResiliencePlanValidationResult {
  valid: boolean;
  issues: ResiliencePlanValidationIssue[];
}
