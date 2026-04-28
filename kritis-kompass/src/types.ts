// Subset der Typen aus der Quell-App (krisenfest-app-produktpaket-p3 v0.9.43).
// Bewusst auf das reduziert, was scoring.ts, baseDomains.ts, baseQuestions.ts
// und die Module-Pack-Loader benoetigen. Alles andere bleibt in der Altapp.

export type JurisdictionCode = 'DE' | 'AT' | 'CH';

export type AnswerScore = 0 | 1 | 2 | 3 | 4 | null;

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

export interface KritisApplicability {
  status: 'wahrscheinlich' | 'prüfbedürftig' | 'eher_unwahrscheinlich';
  title: string;
  text: string;
}

// Slim-Variante der SectorModuleDefinition aus der Altapp.
// Enthaelt nur Felder, die wir in Phase 1-5 wirklich lesen.
// TODO Phase 5+: Bei Bedarf um maturityProfile, auditChecklist usw. erweitern.

// In Phase 4 zurueckgeholter Stub aus der Altapp; bewusst schlanker
// als das volle RequirementDefinition (ohne mappedControls,
// effortBreakdown, regimeId, lawRef, dueHint, category).
export interface SectorAdditionalRequirement {
  id: string;
  title: string;
  description: string;
  guidance?: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SectorModuleDefinition {
  id: string;
  name: string;
  description?: string;
  sectorCategory?: string;
  domainWeightAdjustments?: Record<string, number>;
  additionalQuestions?: QuestionDefinition[];
  kritisExtension?: {
    eligibleSectors?: string[];
    hints?: string[];
    additionalRequirements?: SectorAdditionalRequirement[];
  };
}

// Was loadModulePack() aus dem Container-JSON extrahiert.
// `packId` = Pfad-Stamm in public/module-packs/<packId>.container.json.
// `id`     = Modul-Identifier aus JSON (z.B. 'finance', 'healthcare').
// Wir brauchen beide getrennt: der AssessmentContext speichert den
// packId zur Identifikation des geladenen Packs (Phase-4-Loader), waehrend
// scoring.getDomainWeight noch immer das `id`-Feld als SectorModuleDefinition.id liest.
export interface SectorModulePack {
  packId: string;
  id: string;
  name: string;
  sectorCategory?: string;
  description?: string;
  domainWeightAdjustments?: Record<string, number>;
  additionalQuestions?: QuestionDefinition[];
  kritisExtension?: SectorModuleDefinition['kritisExtension'];
}

// ---------------------------------------------------------------------------
// Phase 2: Indikatoren-basierter Betroffenheits-Check
// Quelle der Konfiguration: src/data/kritisIndicators.json
// ---------------------------------------------------------------------------

export type IndicatorType = 'select' | 'number' | 'boolean' | 'slider' | 'multiselect';

export interface IndicatorThreshold {
  value: number;
  level: 'high' | 'medium';
}

export interface IndicatorOption {
  value: string;
  label: string;
}

interface BaseIndicator {
  id: string;
  label: string;
  guidance?: string;
  required?: boolean;
}

export interface SelectIndicator extends BaseIndicator {
  type: 'select';
  options?: IndicatorOption[];
  optionsBySector?: Record<string, string[]>;
  dependsOn?: string;
  hideWhen?: Record<string, string>;
}

export interface NumberIndicator extends BaseIndicator {
  type: 'number';
  thresholds?: IndicatorThreshold[];
}

export interface BooleanIndicator extends BaseIndicator {
  type: 'boolean';
}

export interface SliderIndicator extends BaseIndicator {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  default: number;
  thresholds?: IndicatorThreshold[];
}

export interface MultiselectIndicator extends BaseIndicator {
  type: 'multiselect';
  options: IndicatorOption[];
}

export type Indicator =
  | SelectIndicator
  | NumberIndicator
  | BooleanIndicator
  | SliderIndicator
  | MultiselectIndicator;

export interface IndicatorStage {
  title: string;
  description: string;
  indicators: Indicator[];
}

export type IndicatorStageKey = 'stage1_direct' | 'stage2_supplier' | 'stage3_context';

export const INDICATOR_STAGE_KEYS: readonly IndicatorStageKey[] = [
  'stage1_direct',
  'stage2_supplier',
  'stage3_context',
] as const;

export interface IndicatorsConfig {
  version: string;
  lastReviewed: string;
  stage1_direct: IndicatorStage;
  stage2_supplier: IndicatorStage;
  stage3_context: IndicatorStage;
}

export type IndicatorAnswers = Record<IndicatorStageKey, Record<string, unknown>>;

// Ergebnis der Phase-2-Auswertung. Loest die Phase-1-only KritisApplicability
// in der App-State-Konsumstelle ab — die alte assessKritisApplicability bleibt
// fuer Phase 5/6-Reports verfuegbar.
export type ApplicabilityStatus =
  | 'direkt_betroffen'
  | 'pruefbeduerftig'
  | 'indirekt_betroffen'
  | 'eher_nicht_betroffen';

export interface ApplicabilityResult {
  status: ApplicabilityStatus;
  title: string;
  text: string;
  reasons: string[];
  recommendations: string[];
}
