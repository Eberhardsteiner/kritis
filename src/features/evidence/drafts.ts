import type {
  EvidenceItem,
  QuestionDefinition,
  RequirementDefinition,
  SectorModuleDefinition,
  TenantPolicy,
} from '../../types';
import { getDateOffset } from '../../shared/dates';
import { guessEvidenceType } from './normalizers';

export interface EvidenceDraftContext {
  module: SectorModuleDefinition;
  tenantPolicy: TenantPolicy;
  documentFolders: string[];
}

/**
 * Manuell angelegter Evidence-Draft mit Mandanten-Defaults. Ein optionaler
 * `patch` ueberschreibt einzelne Felder -- z. B. fuer
 * `createEvidenceFromQuestionDefinition`, das ueber diesen Draft den
 * Basisentwurf baut und dann gezielt Titel/Typ/Quelle setzt.
 */
export function createEvidenceDraft(
  context: EvidenceDraftContext,
  patch: Partial<Omit<EvidenceItem, 'id' | 'createdAt'>> = {},
): Omit<EvidenceItem, 'id' | 'createdAt'> {
  const { module, tenantPolicy, documentFolders } = context;
  return {
    moduleId: module.id,
    title: '',
    type: 'other',
    owner: '',
    reviewer: '',
    version: '1.0',
    classification: tenantPolicy.defaultClassification,
    folder: documentFolders[0] ?? 'Allgemein',
    tags: [],
    externalId: '',
    link: '',
    status: 'missing',
    reviewDate: getDateOffset(60),
    validUntil: getDateOffset(365),
    reviewCycleDays: tenantPolicy.evidenceReviewCadenceDays,
    sourceType: 'manual',
    sourceLabel: 'Manuell',
    relatedQuestionIds: [],
    relatedRequirementIds: [],
    notes: '',
    attachment: undefined,
    ...patch,
  };
}

/**
 * Evidence-Draft fuer eine Assessment-Frage: Titel uebernimmt Frage-Titel
 * (plus "- Evidenz"-Suffix, falls ein evidenceHint gesetzt ist), Typ wird
 * heuristisch abgeleitet, Quelle = 'question'.
 */
export function createEvidenceFromQuestionDefinition(
  question: QuestionDefinition,
  context: EvidenceDraftContext,
): Omit<EvidenceItem, 'id' | 'createdAt'> {
  return createEvidenceDraft(context, {
    title: question.evidenceHint ? `${question.title} - Evidenz` : question.title,
    type: guessEvidenceType(`${question.evidenceHint ?? ''} ${question.title}`),
    sourceType: 'question',
    sourceId: question.id,
    sourceLabel: question.title,
    relatedQuestionIds: [question.id],
    notes: question.evidenceHint ?? question.guidance,
    tags: question.tags ?? [],
  });
}

/**
 * Evidence-Draft fuer ein Pflicht-Requirement: Typ heuristisch, Review-
 * Zyklus verkuerzt (45 Tage), Tag "KRITIS".
 */
export function createEvidenceFromRequirementDefinition(
  requirement: RequirementDefinition,
  context: EvidenceDraftContext,
): Omit<EvidenceItem, 'id' | 'createdAt'> {
  return createEvidenceDraft(context, {
    title: `Nachweis - ${requirement.title}`,
    type: guessEvidenceType(`${requirement.title} ${requirement.guidance}`),
    reviewDate: getDateOffset(45),
    sourceType: 'requirement',
    sourceId: requirement.id,
    sourceLabel: requirement.title,
    relatedRequirementIds: [requirement.id],
    notes: `${requirement.guidance}${requirement.dueHint ? ` | ${requirement.dueHint}` : ''}`,
    tags: ['KRITIS'],
  });
}
