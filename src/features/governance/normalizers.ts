import type {
  AssetItem,
  ReviewPlan,
  SiteItem,
  StakeholderItem,
} from '../../types';
import { createId } from '../../shared/ids';

/**
 * Normalisiert einen aus localStorage/Server geladenen Stakeholder-Array.
 */
export function normalizeLoadedStakeholders(
  items: unknown,
  fallbackModuleId: string,
): StakeholderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<StakeholderItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('stk'),
      moduleId: item.moduleId ?? fallbackModuleId,
      name: item.name ?? '',
      roleLabel: item.roleLabel ?? '',
      department: item.department ?? '',
      email: item.email ?? '',
      approvalScope: item.approvalScope ?? '',
      responsibilities: item.responsibilities ?? '',
      isPrimary: item.isPrimary ?? false,
      notes: item.notes ?? '',
    }));
}

/**
 * Normalisiert einen aus localStorage/Server geladenen Sites-Array.
 */
export function normalizeLoadedSites(
  items: unknown,
  fallbackModuleId: string,
): SiteItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<SiteItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('site'),
      moduleId: item.moduleId ?? fallbackModuleId,
      name: item.name ?? '',
      type: item.type ?? '',
      location: item.location ?? '',
      criticality: item.criticality ?? 'mittel',
      primaryService: item.primaryService ?? '',
      fallbackSite: item.fallbackSite ?? '',
      notes: item.notes ?? '',
    }));
}

/**
 * Normalisiert einen aus localStorage/Server geladenen Assets-Array.
 */
export function normalizeLoadedAssets(
  items: unknown,
  fallbackModuleId: string,
): AssetItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<AssetItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('ast'),
      moduleId: item.moduleId ?? fallbackModuleId,
      siteId: item.siteId ?? '',
      name: item.name ?? '',
      type: item.type ?? '',
      criticality: item.criticality ?? 'mittel',
      owner: item.owner ?? '',
      rtoHours: item.rtoHours ?? '',
      fallback: item.fallback ?? '',
      dependencies: item.dependencies ?? '',
      notes: item.notes ?? '',
    }));
}

/**
 * Normalisiert einen aus localStorage/Server geladenen ReviewPlan.
 * Alle sechs Pflichtfelder fallen auf leeren String zurueck.
 */
export function normalizeReviewPlan(input?: Partial<ReviewPlan>): ReviewPlan {
  return {
    executiveSponsor: input?.executiveSponsor ?? '',
    approver: input?.approver ?? '',
    nextInternalAuditDate: input?.nextInternalAuditDate ?? '',
    nextManagementReviewDate: input?.nextManagementReviewDate ?? '',
    nextExerciseDate: input?.nextExerciseDate ?? '',
    nextEvidenceReviewDate: input?.nextEvidenceReviewDate ?? '',
  };
}
