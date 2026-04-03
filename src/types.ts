export type ViewKey = 'dashboard' | 'assessment' | 'modules' | 'kritis';

export type AnswerScore = 0 | 1 | 2 | 3 | 4 | null;

export type RequirementStatus = 'open' | 'in_progress' | 'ready' | 'not_applicable';

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

export interface SectorModuleDefinition {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  description: string;
  sectorCategory?: string;
  domainWeightAdjustments?: Record<string, number>;
  additionalQuestions?: QuestionDefinition[];
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

export interface AppState {
  activeView: ViewKey;
  selectedModuleId: string;
  uploadedModules: SectorModuleDefinition[];
  answers: Record<string, AnswerEntry>;
  requirementStates: Record<string, RequirementStatus>;
  companyProfile: CompanyProfile;
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
