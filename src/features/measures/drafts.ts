import type {
  ActionItem,
  ActionTemplateDefinition,
  QuestionDefinition,
  RequirementDefinition,
  SectorModuleDefinition,
} from '../../types';
import { getDateOffset } from '../../shared/dates';

/**
 * Action-Draft-Faktory fuer eine kritische Assessment-Frage.
 * Due-Date gestaffelt nach Kritikalitaet (21 Tage kritisch, 35 sonst),
 * Prioritaet ebenso.
 */
export function createActionFromQuestionDefinition(
  question: QuestionDefinition,
  moduleId: string,
): Omit<ActionItem, 'id' | 'createdAt'> {
  return {
    moduleId,
    title: question.title,
    description: question.recommendation,
    owner: '',
    dueDate: getDateOffset(question.critical ? 21 : 35),
    status: 'open',
    priority: question.critical ? 'kritisch' : 'hoch',
    sourceType: 'question',
    sourceId: question.id,
    sourceLabel: question.title,
    relatedQuestionIds: [question.id],
    relatedRequirementIds: [],
    notes: question.guidance,
  };
}

/**
 * Action-Draft-Faktory aus einem Pflicht-Requirement. Prioritaet und
 * Due-Date abgestuft nach Requirement-Severity.
 */
export function createActionFromRequirementDefinition(
  requirement: RequirementDefinition,
  moduleId: string,
): Omit<ActionItem, 'id' | 'createdAt'> {
  return {
    moduleId,
    title: requirement.title,
    description: requirement.guidance,
    owner: '',
    dueDate: getDateOffset(requirement.severity === 'high' ? 21 : 45),
    status: 'open',
    priority:
      requirement.severity === 'high'
        ? 'kritisch'
        : requirement.severity === 'medium'
          ? 'hoch'
          : 'mittel',
    sourceType: 'requirement',
    sourceId: requirement.id,
    sourceLabel: requirement.title,
    relatedQuestionIds: [],
    relatedRequirementIds: [requirement.id],
    notes: requirement.dueHint ?? '',
  };
}

/**
 * Leerer, manueller Action-Draft fuer "Neue Maßnahme anlegen".
 */
export function createEmptyActionDraft(
  moduleId: string,
): Omit<ActionItem, 'id' | 'createdAt'> {
  return {
    moduleId,
    title: '',
    description: '',
    owner: '',
    dueDate: getDateOffset(30),
    status: 'open',
    priority: 'mittel',
    sourceType: 'manual',
    sourceLabel: 'Manuell',
    relatedQuestionIds: [],
    relatedRequirementIds: [],
    notes: '',
  };
}

/**
 * Action-Draft aus einem Modul-Template (aus moduleRegistry).
 * Notizen erhalten optional den Modul-Accent als Kontexthinweis.
 */
export function createActionFromTemplate(
  template: ActionTemplateDefinition,
  module: SectorModuleDefinition,
): Omit<ActionItem, 'id' | 'createdAt'> {
  return {
    moduleId: module.id,
    title: template.title,
    description: template.description,
    owner: template.ownerRole ?? '',
    dueDate: getDateOffset(35),
    status: 'planned',
    priority: template.priority ?? 'mittel',
    sourceType: 'module_template',
    sourceId: template.id,
    sourceLabel: template.title,
    relatedQuestionIds: template.relatedQuestionIds ?? [],
    relatedRequirementIds: template.relatedRequirementIds ?? [],
    notes: module.uiHints?.accentLabel
      ? `Modulkontext: ${module.uiHints.accentLabel}`
      : '',
  };
}
