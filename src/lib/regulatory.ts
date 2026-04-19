import { regulatoryRegimeDefinitionsByJurisdiction } from '../data/kritisBase';
import { getChecklistProgress, getRequirementProgress } from './scoring';
import type {
  AuditChecklistItemDefinition,
  AuditChecklistState,
  CyberEntityClass,
  JurisdictionCode,
  KritisEntityStatus,
  KritisSectorOverrideRegime,
  RegulatoryProfile,
  RegulatoryRegimeDefinition,
  RegulatoryRegimeId,
  RegulatoryRegimeSummary,
  RegimeScopeStatus,
  RequirementDefinition,
  RequirementStatus,
} from '../types';

export const supportedJurisdictions: JurisdictionCode[] = ['DE', 'AT', 'CH'];
export const allRegimeIds: RegulatoryRegimeId[] = ['de_kritisdachg', 'de_bsig_nis2', 'at_nisg_2026', 'ch_bacs_ci'];

export const KRITIS_EARLIEST_REGISTRATION_DATE = '2026-07-17';
export const KRITIS_RISK_ANALYSIS_DELAY_MONTHS = 9;
export const KRITIS_RESILIENCE_MEASURES_DELAY_MONTHS = 10;

export const defaultRegulatoryProfile: RegulatoryProfile = {
  jurisdiction: 'DE',
  scopeByRegime: {
    de_kritisdachg: 'unknown',
    de_bsig_nis2: 'unknown',
    at_nisg_2026: 'unknown',
    ch_bacs_ci: 'unknown',
  },
  bsigEntityClass: 'unknown',
  lastReviewDate: '',
  owner: '',
  notes: '',
  kritisRegistrationDate: '',
  kritisEntityStatus: 'not_identified',
  kritisSectorOverrideRegime: 'none',
  managementBoardContact: '',
};

function normalizeScopeStatus(value: unknown): RegimeScopeStatus {
  return value === 'in_scope' || value === 'out_of_scope' || value === 'unknown' ? value : 'unknown';
}

function normalizeJurisdiction(value: unknown): JurisdictionCode {
  return value === 'AT' || value === 'CH' || value === 'DE' ? value : 'DE';
}

function normalizeEntityClass(value: unknown): CyberEntityClass {
  return value === 'important' || value === 'essential' || value === 'not_applicable' || value === 'unknown'
    ? value
    : 'unknown';
}

function normalizeKritisEntityStatus(value: unknown): KritisEntityStatus {
  return value === 'identified_not_registered' ||
    value === 'registered' ||
    value === 'obligations_active' ||
    value === 'not_identified'
    ? value
    : 'not_identified';
}

function normalizeKritisSectorOverride(value: unknown): KritisSectorOverrideRegime {
  return value === 'dora' || value === 'bsig_nis2' || value === 'none' ? value : 'none';
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? value : '';
}

export function normalizeRegulatoryProfile(input?: Partial<RegulatoryProfile>): RegulatoryProfile {
  const jurisdiction = normalizeJurisdiction(input?.jurisdiction);

  return {
    jurisdiction,
    scopeByRegime: {
      de_kritisdachg: normalizeScopeStatus(input?.scopeByRegime?.de_kritisdachg),
      de_bsig_nis2: normalizeScopeStatus(input?.scopeByRegime?.de_bsig_nis2),
      at_nisg_2026: normalizeScopeStatus(input?.scopeByRegime?.at_nisg_2026),
      ch_bacs_ci: normalizeScopeStatus(input?.scopeByRegime?.ch_bacs_ci),
    },
    bsigEntityClass: normalizeEntityClass(input?.bsigEntityClass),
    lastReviewDate: input?.lastReviewDate ?? '',
    owner: input?.owner ?? '',
    notes: input?.notes ?? '',
    kritisRegistrationDate: normalizeIsoDate(input?.kritisRegistrationDate),
    kritisEntityStatus: normalizeKritisEntityStatus(input?.kritisEntityStatus),
    kritisSectorOverrideRegime: normalizeKritisSectorOverride(input?.kritisSectorOverrideRegime),
    managementBoardContact: typeof input?.managementBoardContact === 'string' ? input.managementBoardContact : '',
  };
}

export interface KritisMilestones {
  earliestRegistrationAt: string;
  riskAnalysisDueAt?: string;
  resilienceMeasuresDueAt?: string;
  managementAccountabilityActiveAt?: string;
}

function addMonthsIso(base: Date, months: number): string {
  const result = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate()));
  return result.toISOString().slice(0, 10);
}

export function computeKritisMilestones(registrationDate?: string): KritisMilestones {
  const earliestRegistrationAt = KRITIS_EARLIEST_REGISTRATION_DATE;
  const normalized = normalizeIsoDate(registrationDate);
  if (!normalized) {
    return { earliestRegistrationAt };
  }
  const parsed = new Date(normalized);
  const floor = new Date(earliestRegistrationAt);
  const effective = parsed.getTime() < floor.getTime() ? floor : parsed;
  return {
    earliestRegistrationAt,
    riskAnalysisDueAt: addMonthsIso(effective, KRITIS_RISK_ANALYSIS_DELAY_MONTHS),
    resilienceMeasuresDueAt: addMonthsIso(effective, KRITIS_RESILIENCE_MEASURES_DELAY_MONTHS),
    managementAccountabilityActiveAt: addMonthsIso(effective, KRITIS_RESILIENCE_MEASURES_DELAY_MONTHS),
  };
}

export function getJurisdictionLabel(value: JurisdictionCode): string {
  if (value === 'AT') {
    return 'Österreich';
  }
  if (value === 'CH') {
    return 'Schweiz';
  }
  return 'Deutschland';
}

export function getRegimeDefinitions(jurisdiction: JurisdictionCode = 'DE'): RegulatoryRegimeDefinition[] {
  return [...(regulatoryRegimeDefinitionsByJurisdiction[jurisdiction] ?? [])];
}

export function getCurrentRegimeIds(profile: RegulatoryProfile): RegulatoryRegimeId[] {
  return getRegimeDefinitions(normalizeRegulatoryProfile(profile).jurisdiction).map((definition) => definition.id);
}

export function getRegimeScopeLabel(value: RegimeScopeStatus): string {
  if (value === 'in_scope') {
    return 'im Scope';
  }
  if (value === 'out_of_scope') {
    return 'derzeit nicht im Scope';
  }
  return 'Einordnung offen';
}

export function shouldShowEntityClass(profile: RegulatoryProfile): boolean {
  const jurisdiction = normalizeRegulatoryProfile(profile).jurisdiction;
  return jurisdiction === 'DE' || jurisdiction === 'AT';
}

export function getEntityClassFieldLabel(profile: RegulatoryProfile): string {
  const jurisdiction = normalizeRegulatoryProfile(profile).jurisdiction;
  if (jurisdiction === 'AT') {
    return 'NISG-2026 Einordnung';
  }
  if (jurisdiction === 'CH') {
    return 'Einordnung';
  }
  return 'BSIG / NIS2 Einordnung';
}

export function getBsigEntityClassLabel(value: CyberEntityClass, profile?: RegulatoryProfile): string {
  const jurisdiction = profile ? normalizeRegulatoryProfile(profile).jurisdiction : 'DE';
  if (value === 'essential') {
    return jurisdiction === 'AT' ? 'wesentliche Einrichtung' : 'besonders wichtig';
  }
  if (value === 'important') {
    return jurisdiction === 'AT' ? 'wichtige Einrichtung' : 'wichtig';
  }
  if (value === 'not_applicable') {
    return 'nicht anwendbar';
  }
  return 'noch nicht zugeordnet';
}

export function isRegimeOutOfScope(profile: RegulatoryProfile, regimeId: RegulatoryRegimeId): boolean {
  return normalizeRegulatoryProfile(profile).scopeByRegime[regimeId] === 'out_of_scope';
}

export function isRegimeExplicitlyInScope(profile: RegulatoryProfile, regimeId: RegulatoryRegimeId): boolean {
  return normalizeRegulatoryProfile(profile).scopeByRegime[regimeId] === 'in_scope';
}

export function filterRequirementsByRegime(
  requirements: RequirementDefinition[],
  regimeId?: RegulatoryRegimeId,
): RequirementDefinition[] {
  return regimeId ? requirements.filter((item) => item.regimeId === regimeId) : requirements;
}

export function filterChecklistByRegime(
  checklist: AuditChecklistItemDefinition[],
  regimeId?: RegulatoryRegimeId,
): AuditChecklistItemDefinition[] {
  return regimeId ? checklist.filter((item) => item.regimeId === regimeId) : checklist;
}

export function filterActiveRequirements(
  requirements: RequirementDefinition[],
  profile: RegulatoryProfile,
): RequirementDefinition[] {
  const normalized = normalizeRegulatoryProfile(profile);
  const currentIds = new Set(getCurrentRegimeIds(normalized));
  return requirements.filter((item) => {
    if (!item.regimeId) {
      return true;
    }
    if (!currentIds.has(item.regimeId)) {
      return false;
    }
    return normalized.scopeByRegime[item.regimeId] !== 'out_of_scope';
  });
}

export function filterActiveChecklist(
  checklist: AuditChecklistItemDefinition[],
  profile: RegulatoryProfile,
): AuditChecklistItemDefinition[] {
  const normalized = normalizeRegulatoryProfile(profile);
  const currentIds = new Set(getCurrentRegimeIds(normalized));
  return checklist.filter((item) => {
    if (!item.regimeId) {
      return true;
    }
    if (!currentIds.has(item.regimeId)) {
      return false;
    }
    return normalized.scopeByRegime[item.regimeId] !== 'out_of_scope';
  });
}

export function buildRegimeSummaries(params: {
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  checklist: AuditChecklistItemDefinition[];
  checklistStates: Record<string, AuditChecklistState>;
  regulatoryProfile: RegulatoryProfile;
}): RegulatoryRegimeSummary[] {
  const profile = normalizeRegulatoryProfile(params.regulatoryProfile);

  return getRegimeDefinitions(profile.jurisdiction).map((definition) => {
    const regimeRequirements = filterRequirementsByRegime(params.requirements, definition.id);
    const regimeChecklist = filterChecklistByRegime(params.checklist, definition.id);
    const requirementProgress = getRequirementProgress(regimeRequirements, params.requirementStates);
    const checklistProgress = getChecklistProgress(regimeChecklist, params.checklistStates);
    const scopeStatus = profile.scopeByRegime[definition.id];

    return {
      regimeId: definition.id,
      jurisdiction: definition.jurisdiction,
      label: definition.label,
      shortLabel: definition.shortLabel,
      focus: definition.focus,
      scopeStatus,
      requirementScore: requirementProgress.score,
      checklistScore: checklistProgress.score,
      totalRequirements: regimeRequirements.filter((item) => (params.requirementStates[item.id] ?? 'open') !== 'not_applicable').length,
      openRequirements: requirementProgress.openCount,
      readyRequirements: requirementProgress.readyCount,
      checklistTotal: checklistProgress.total,
      checklistBlockers: checklistProgress.blockers,
      entityClassLabel: shouldShowEntityClass(profile) ? getBsigEntityClassLabel(profile.bsigEntityClass, profile) : undefined,
    };
  });
}
