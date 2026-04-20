import { buildRiskAggregate, classifyRiskEntry, computeRiskScore, getCriticalityLabel } from '../riskCatalog/analysis';
import { findSubCategory } from '../riskCatalog/taxonomy';
import type { RiskEntry } from '../riskCatalog/types';
import {
  ORDERED_RESILIENCE_GOALS,
  RESILIENCE_GOAL_LABELS,
  buildEmptyPlanContent,
} from './template';
import type {
  EvidenceSection,
  GovernanceSection,
  MeasureReference,
  MeasuresByGoal,
  ReportingSection,
  ResilienceGoal,
  ResiliencePlan,
  ResiliencePlanContent,
  ResiliencePlanValidationIssue,
  ResiliencePlanValidationResult,
  RiskBasisSection,
  ScopeSection,
} from './types';
import type {
  ActionItem,
  CompanyProfile,
  ComplianceCalendar,
  EvidenceItem,
  RegulatoryProfile,
  SectorModuleDefinition,
} from '../../types';

export interface GenerateDraftInput {
  companyProfile: CompanyProfile;
  regulatoryProfile: RegulatoryProfile;
  complianceCalendar: ComplianceCalendar;
  module?: SectorModuleDefinition;
  riskEntries: RiskEntry[];
  actionItems: ActionItem[];
  evidenceItems: EvidenceItem[];
  tenantId?: string;
  planId?: string;
  version?: string;
  generatedAt?: Date;
  topRiskLimit?: number;
}

const GOAL_KEYWORDS: Record<ResilienceGoal, string[]> = {
  prevent: [
    'prävent',
    'vorbeug',
    'härten',
    'redund',
    'sensibilisier',
    'schulung',
    'training',
    'awareness',
    'hochverf',
    'bauliche',
    'zutritt',
    'zaun',
    'überwachungszone',
  ],
  protect: [
    'schutz',
    'usv',
    'notstrom',
    'brandschutz',
    'firewall',
    'segment',
    'segregation',
    'hard',
    'abschirmung',
    'zutrittskontroll',
    'zugriffs',
  ],
  respond: [
    'reakt',
    'meld',
    'alarm',
    'eskalat',
    'krisenstab',
    'incident',
    'notfall',
    'vorfall',
    'playbook',
    'kommunikation',
    'bcm',
  ],
  recover: [
    'wiederherstel',
    'recover',
    'restore',
    'backup',
    'wiederan',
    'neuaufbau',
    'ersatz',
    'rto',
    'rpo',
    'lessons learned',
    'review',
  ],
};

function inferResilienceGoal(action: ActionItem): ResilienceGoal {
  if (action.resilienceGoal) {
    return action.resilienceGoal;
  }
  const haystack = `${action.title} ${action.description} ${action.sourceLabel}`.toLowerCase();
  for (const goal of ORDERED_RESILIENCE_GOALS) {
    if (GOAL_KEYWORDS[goal].some((keyword) => haystack.includes(keyword))) {
      return goal;
    }
  }
  // Fallback: der "Respond"-Eimer ist am wenigsten invasiv, weil er operative Planung ist.
  return 'respond';
}

function toMeasureStatus(status: ActionItem['status']): MeasureReference['status'] {
  if (status === 'done') {
    return 'ready';
  }
  if (status === 'in_progress') {
    return 'active';
  }
  return 'planned';
}

function buildMeasureReference(action: ActionItem, goal: ResilienceGoal): MeasureReference {
  return {
    id: action.id,
    title: action.title,
    description: action.description,
    goal,
    linkedActionItemId: action.id,
    owner: action.owner,
    dueDate: action.dueDate,
    status: toMeasureStatus(action.status),
  };
}

function groupActionsByGoal(actions: ActionItem[]): MeasuresByGoal {
  const grouped: MeasuresByGoal = {
    prevent: [],
    protect: [],
    respond: [],
    recover: [],
  };
  for (const action of actions) {
    const goal = inferResilienceGoal(action);
    grouped[goal].push(buildMeasureReference(action, goal));
  }
  return grouped;
}

function buildScope(input: GenerateDraftInput): ScopeSection {
  const { companyProfile, module } = input;
  return {
    operatorName: companyProfile.companyName,
    sector: module?.sectorCategory ?? companyProfile.industryLabel,
    criticalService: companyProfile.criticalService,
    locations: companyProfile.locations,
    employees: companyProfile.employees,
    personsServed: companyProfile.personsServed,
    scopeNote:
      'Der Geltungsbereich umfasst die oben genannte kritische Dienstleistung einschließlich der aufgeführten Standorte und ihrer wesentlichen technischen und organisatorischen Abhängigkeiten.',
  };
}

function buildRiskBasis(input: GenerateDraftInput): RiskBasisSection {
  const empty = buildEmptyPlanContent().riskBasis;
  const aggregate = buildRiskAggregate(input.riskEntries, input.topRiskLimit ?? 5);
  return {
    ...empty,
    topRisks: aggregate.topRisks.map((entry) => ({
      riskId: entry.id,
      title: entry.titel || findSubCategory(entry.categoryId, entry.subCategoryId)?.label || entry.subCategoryId,
      category: entry.categoryId,
      initialScore: computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung),
      residualScore: computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.residualRisk),
      criticality: getCriticalityLabel(classifyRiskEntry(entry)),
    })),
  };
}

function buildGovernance(input: GenerateDraftInput): GovernanceSection {
  const empty = buildEmptyPlanContent().governance;
  return {
    ...empty,
    managementBoardContact: input.regulatoryProfile.managementBoardContact?.trim() ?? '',
    programOwner: input.regulatoryProfile.owner?.trim() ?? '',
  };
}

function buildReporting(input: GenerateDraftInput): ReportingSection {
  const empty = buildEmptyPlanContent().reporting;
  return {
    ...empty,
    incidentContact: input.complianceCalendar.incidentContact?.trim() ?? '',
    incidentBackupContact: input.complianceCalendar.incidentBackupContact?.trim() ?? '',
  };
}

function classifyEvidenceStandard(item: EvidenceItem): string | undefined {
  const haystack = `${item.title} ${item.notes} ${item.sourceLabel}`.toLowerCase();
  if (haystack.includes('iso 27001') || haystack.includes('iso/iec 27001')) {
    return 'ISO/IEC 27001:2022';
  }
  if (haystack.includes('grundschutz') || haystack.includes('bsi it-grundschutz')) {
    return 'BSI IT-Grundschutz 2023';
  }
  if (haystack.includes('iso 22301') || haystack.includes('iso/iec 22301')) {
    return 'ISO 22301:2019';
  }
  if (haystack.includes('§ 39 bsig') || haystack.includes('bsig') || haystack.includes('nis2')) {
    return 'BSIG / NIS2';
  }
  return undefined;
}

function buildEvidence(input: GenerateDraftInput): EvidenceSection {
  const empty = buildEmptyPlanContent().evidence;
  return {
    ...empty,
    evidenceReferences: input.evidenceItems.slice(0, 20).map((item) => ({
      title: item.title || 'Unbenannter Nachweis',
      type: item.type,
      sourceStandard: classifyEvidenceStandard(item),
    })),
  };
}

export function generateDraft(input: GenerateDraftInput): ResiliencePlan {
  const now = (input.generatedAt ?? new Date()).toISOString();
  const content: ResiliencePlanContent = {
    scope: buildScope(input),
    riskBasis: buildRiskBasis(input),
    measuresByGoal: groupActionsByGoal(input.actionItems),
    governance: buildGovernance(input),
    reporting: buildReporting(input),
    evidence: buildEvidence(input),
  };
  return {
    id: input.planId ?? `plan-${Date.now().toString(36)}`,
    tenantId: input.tenantId ?? '',
    version: input.version ?? '1.0.0',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    content,
  };
}

export function validatePlan(plan: ResiliencePlan): ResiliencePlanValidationResult {
  const issues: ResiliencePlanValidationIssue[] = [];
  const { content } = plan;

  if (!content.scope.operatorName.trim()) {
    issues.push({
      path: 'content.scope.operatorName',
      message: 'Betreibername im Abschnitt 1 ist erforderlich.',
      severity: 'error',
    });
  }
  if (!content.scope.criticalService.trim()) {
    issues.push({
      path: 'content.scope.criticalService',
      message: 'Kritische Dienstleistung im Abschnitt 1 ist erforderlich.',
      severity: 'error',
    });
  }

  if (content.riskBasis.topRisks.length === 0) {
    issues.push({
      path: 'content.riskBasis.topRisks',
      message: 'Es sollten mindestens die Top-Risiken aus § 12 referenziert werden.',
      severity: 'warning',
    });
  }

  for (const goal of ORDERED_RESILIENCE_GOALS) {
    if (content.measuresByGoal[goal].length === 0) {
      issues.push({
        path: `content.measuresByGoal.${goal}`,
        message: `Zu „${RESILIENCE_GOAL_LABELS[goal]}" fehlen noch Maßnahmen.`,
        severity: 'warning',
      });
    }
  }

  if (!content.governance.managementBoardContact.trim()) {
    issues.push({
      path: 'content.governance.managementBoardContact',
      message: 'Geschäftsleitungskontakt nach § 20 ist nicht gepflegt.',
      severity: 'error',
    });
  }

  if (!content.reporting.incidentContact.trim()) {
    issues.push({
      path: 'content.reporting.incidentContact',
      message: 'Meldekontakt für die 24-Stunden-Meldung nach § 18 fehlt.',
      severity: 'error',
    });
  }

  if (content.evidence.reviewCycleYears < 1 || content.evidence.reviewCycleYears > 4) {
    issues.push({
      path: 'content.evidence.reviewCycleYears',
      message: 'Review-Zyklus sollte zwischen 1 und 4 Jahren liegen (§ 12 Abs. 2 KRITISDachG).',
      severity: 'warning',
    });
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
