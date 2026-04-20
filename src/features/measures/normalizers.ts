import type { ActionItem, ActionPriority } from '../../types';
import { createId } from '../../shared/ids';

/**
 * Normalisiert einen ggf. veralteten oder unbekannten Priority-String
 * auf einen gueltigen ActionPriority-Wert. Default: 'mittel'.
 */
export function normalizeActionPriority(value: string | undefined): ActionPriority {
  if (value === 'kritisch' || value === 'hoch' || value === 'mittel' || value === 'niedrig') {
    return value;
  }
  return 'mittel';
}

/**
 * Normalisiert einen aus localStorage/Server geladenen Actions-Array.
 * Fehlende Pflichtfelder werden mit Defaults aufgefuellt, der fallbackModuleId
 * uebernimmt, wenn ein Eintrag keine eigene moduleId hat.
 */
export function normalizeLoadedActions(
  items: unknown,
  fallbackModuleId: string,
): ActionItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ActionItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('act'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      description: item.description ?? '',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      status: item.status ?? 'open',
      priority: normalizeActionPriority(item.priority),
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      notes: item.notes ?? '',
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}
