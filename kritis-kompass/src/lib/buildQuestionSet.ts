import { baseQuestions } from '../data/baseQuestions';
import type { QuestionDefinition, SectorModulePack } from '../types';

// Fuegt Modul-spezifische Zusatzfragen an die 24 Basisfragen an.
// Reihenfolge: Basis zuerst, dann additionalQuestions in JSON-Reihenfolge.
// Phase 5+: Falls die Sortierung pro Domain wichtig wird, hier umsortieren.
export function buildQuestionSet(modulePack: SectorModulePack | undefined): QuestionDefinition[] {
  const additional = modulePack?.additionalQuestions ?? [];
  return [...baseQuestions, ...additional];
}
