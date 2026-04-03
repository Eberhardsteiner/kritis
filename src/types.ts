export type ViewKey = 'dashboard' | 'assessment' | 'measures' | 'modules' | 'kritis' | 'report';

export type AnswerScore = 0 | 1 | 2 | 3 | 4 | null;

export type RequirementStatus = 'open' | 'in_progress' | 'ready' | 'not_applicable';
export type ActionStatus = 'open' | 'planned' | 'in_progress' | 'done';
export type ActionPriority = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';
export type EvidenceStatus = 'missing' | 'draft' | 'review' | 'approved';
export type EvidenceType =
  | 'policy'
  | 'plan'
  | 'report'
  | 'test'
  | 'training'
  | 'contract'
  | 'backup'
  | 'other';
export type CertificationStageStatus = 'not_started' | 'in_progress' | 'ready';

export interface DomainDefinition {
  id: string;
  label: string;
  description: string;
}

export interface QuestionDefinition {
  id: string;
  domainId: string;
  title: string;
  prompt: string;
  guidance: string;
  recommendation: string;
  weight: number;
  critical?: boolean;
  evidenceHint?: string;
  tags?: string[];
  lawRefs?: string[];
}

export interface RequirementDefinition {
  id: string;
  title: string;
  description: string;
  guidance: string;
  lawRef?: string;
  dueHint?: string;
  severity?: 'high' | 'medium' | 'low';
}

export interface ActionTemplateDefinition {
  id: string;
  title: string;
  description: string;
  priority?: ActionPriority;
  ownerRole?: string;
  relatedQuestionIds?: string[];
  relatedRequirementIds?: string[];
}

export interface EvidenceTemplateDefinition {
  id: string;
  title: string;
  type: EvidenceType;
  ownerRole?: string;
  reviewCycleHint?: string;
  relatedQuestionIds?: string[];
  relatedRequirementIds?: string[];
}

export interface SectorModuleDefinition {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  description: string;
  sectorCategory?: string;
  domainWeightAdjustments?: Record<string, number>;
  additionalQuestions?: QuestionDefinition[];
  recommendedActions?: ActionTemplateDefinition[];
  evidenceTemplates?: EvidenceTemplateDefinition[];
  uiHints?: {
    focusAreas?: string[];
    accentLabel?: string;
  };
  kritisExtension?: {
    eligibleSectors?: string[];
    hints?: string[];
    additionalRequirements?: RequirementDefinition[];
  };
}

export interface AnswerEntry {
  score: AnswerScore;
  note: string;
}

export interface CompanyProfile {
  companyName: string;
  industryLabel: string;
  locations: string;
  employees: string;
  criticalService: string;
  personsServed: string;
}

export interface AssessmentFilters {
  search: string;
  domainId: string;
  showOnlyCritical: boolean;
  showOnlyUnanswered: boolean;
  showOnlyGaps: boolean;
}

export interface ActionItem {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  status: ActionStatus;
  priority: ActionPriority;
  sourceType: 'question' | 'requirement' | 'module_template' | 'manual';
  sourceId?: string;
  sourceLabel: string;
  relatedQuestionIds: string[];
  relatedRequirementIds: string[];
  notes: string;
  createdAt: string;
}

export interface EvidenceItem {
  id: string;
  moduleId: string;
  title: string;
  type: EvidenceType;
  owner: string;
  link: string;
  status: EvidenceStatus;
  reviewDate: string;
  sourceType: 'question' | 'requirement' | 'module_template' | 'manual';
  sourceId?: string;
  sourceLabel: string;
  relatedQuestionIds: string[];
  relatedRequirementIds: string[];
  notes: string;
  createdAt: string;
}

export interface CertificationStageDefinition {
  id: string;
  label: string;
  description: string;
}

export interface CertificationStageState {
  status: CertificationStageStatus;
  notes: string;
}

export interface CertificationState {
  auditLead: string;
  targetDate: string;
  decisionNote: string;
  stageStates: Record<string, CertificationStageState>;
}

export interface AppState {
  activeView: ViewKey;
  selectedModuleId: string;
  uploadedModules: SectorModuleDefinition[];
  answers: Record<string, AnswerEntry>;
  requirementStates: Record<string, RequirementStatus>;
  companyProfile: CompanyProfile;
  actionItems: ActionItem[];
  evidenceItems: EvidenceItem[];
  certificationState: CertificationState;
  assessmentFilters: AssessmentFilters;
}

export interface DomainScore {
  domainId: string;
  label: string;
  score: number;
  completion: number;
  answeredCount: number;
  totalCount: number;
}

export interface RecommendationItem {
  questionId: string;
  title: string;
  domainId: string;
  domainLabel: string;
  urgency: 'hoch' | 'mittel' | 'niedrig';
  action: string;
  rationale: string;
}

export interface ScoreSnapshot {
  overallScore: number;
  completion: number;
  maturityLabel: string;
  domainScores: DomainScore[];
  recommendations: RecommendationItem[];
}

export interface ModuleValidationResult {
  valid: boolean;
  errors: string[];
  module?: SectorModuleDefinition;
}

export interface KritisApplicability {
  status: 'wahrscheinlich' | 'prüfbedürftig' | 'eher_unwahrscheinlich';
  title: string;
  text: string;
}

export interface ActionSummary {
  total: number;
  open: number;
  planned: number;
  inProgress: number;
  done: number;
  overdue: number;
}

export interface EvidenceSummary {
  total: number;
  approved: number;
  review: number;
  draft: number;
  missing: number;
  coverage: number;
}

export interface CertificationProgress {
  score: number;
  readyStages: number;
  stageCompletion: number;
}
