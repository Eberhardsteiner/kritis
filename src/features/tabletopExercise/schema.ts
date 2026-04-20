import { z } from 'zod';
import type { Scenario } from './types';

/**
 * Zod-Schemas für Tabletop-Szenarien und Übungs-Sessions.
 *
 * scenarioSchema prüft:
 *   - Zeitreihen-Monotonie: t-Werte der timeline sind aufsteigend
 *   - Kriterien-Integrität: evaluationHints in Optionen verweisen nur auf
 *     existierende evaluationCriteria.id
 *   - Rollen-Integrität: roleId in Injects/Decisions verweisen nur auf
 *     existierende roles.id
 *
 * Import via parseScenario() liefert einen validierten Scenario-Typ.
 */

export const scenarioPhaseSchema = z.enum([
  'discovery',
  'early_response',
  '24h_reporting',
  'stabilization',
  'recovery',
]);

export const evaluationCategorySchema = z.enum([
  'reporting',
  'governance',
  'operations',
  'communication',
  'other',
]);

export const exerciseRoleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  briefing: z.string(),
});

export const timelineInjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  roleId: z.string().optional(),
});

export const timelineDecisionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  consequence: z.string().optional(),
  evaluationHints: z.array(z.string()).optional(),
  scoreContribution: z.number().int().min(0).max(5).optional(),
});

export const timelineDecisionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(timelineDecisionOptionSchema).min(2),
  roleId: z.string().optional(),
  relatedCriteria: z.array(z.string()).optional(),
  guidance: z.string().optional(),
});

export const timelineStepSchema = z.object({
  t: z.number().int().min(0),
  phase: scenarioPhaseSchema,
  injects: z.array(timelineInjectSchema).default([]),
  decisions: z.array(timelineDecisionSchema).default([]),
});

export const evaluationCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(1).max(5),
  category: evaluationCategorySchema.optional(),
});

export const scenarioSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    title: z.string().min(1),
    summary: z.string(),
    sectors: z.array(z.string()).min(1),
    applicableRegimes: z.array(z.string()).min(1),
    durationMinutes: z.number().int().min(15).max(1440),
    roles: z.array(exerciseRoleSchema).min(1),
    timeline: z.array(timelineStepSchema).min(1),
    evaluationCriteria: z.array(evaluationCriterionSchema).min(1),
  })
  .superRefine((scenario, ctx) => {
    const roleIds = new Set(scenario.roles.map((r) => r.id));
    const criteriaIds = new Set(scenario.evaluationCriteria.map((c) => c.id));

    // Aufsteigende t-Werte
    for (let i = 1; i < scenario.timeline.length; i += 1) {
      if (scenario.timeline[i].t < scenario.timeline[i - 1].t) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeline', i, 't'],
          message: `t-Werte müssen aufsteigend sein (Schritt ${i} kleiner als Schritt ${i - 1}).`,
        });
      }
    }

    // Rollen- und Kriterien-Verweise prüfen
    scenario.timeline.forEach((step, stepIndex) => {
      step.injects.forEach((inject, injectIndex) => {
        if (inject.roleId && !roleIds.has(inject.roleId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['timeline', stepIndex, 'injects', injectIndex, 'roleId'],
            message: `Unbekannte Rolle "${inject.roleId}" im Inject.`,
          });
        }
      });
      step.decisions.forEach((decision, decisionIndex) => {
        if (decision.roleId && !roleIds.has(decision.roleId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['timeline', stepIndex, 'decisions', decisionIndex, 'roleId'],
            message: `Unbekannte Rolle "${decision.roleId}" in der Entscheidung.`,
          });
        }
        decision.relatedCriteria?.forEach((critId, critIndex) => {
          if (!criteriaIds.has(critId)) {
            ctx.addIssue({
              code: 'custom',
              path: ['timeline', stepIndex, 'decisions', decisionIndex, 'relatedCriteria', critIndex],
              message: `Unbekanntes Bewertungskriterium "${critId}".`,
            });
          }
        });
        decision.options.forEach((option, optionIndex) => {
          option.evaluationHints?.forEach((hint, hintIndex) => {
            if (!criteriaIds.has(hint)) {
              ctx.addIssue({
                code: 'custom',
                path: [
                  'timeline',
                  stepIndex,
                  'decisions',
                  decisionIndex,
                  'options',
                  optionIndex,
                  'evaluationHints',
                  hintIndex,
                ],
                message: `Unbekanntes Bewertungskriterium "${hint}" im evaluationHint.`,
              });
            }
          });
        });
      });
    });
  });

export const exerciseSessionStatusSchema = z.enum(['not_started', 'active', 'completed', 'abandoned']);

export const exerciseDecisionRecordSchema = z.object({
  decisionId: z.string().min(1),
  selectedOptionId: z.string().min(1),
  chosenAt: z.string(),
});

export const exerciseInjectAckSchema = z.object({
  injectId: z.string().min(1),
  acknowledgedAt: z.string(),
});

export const exerciseCriterionScoreSchema = z.object({
  criterionId: z.string().min(1),
  score: z.number().min(0),
  weighted: z.number().min(0),
  rationale: z.array(z.string()).default([]),
});

export const exerciseVerdictSchema = z.enum(['bestanden', 'bedingt_bestanden', 'nicht_bestanden']);

export const exerciseResultSchema = z.object({
  totalScore: z.number().min(0),
  maxScore: z.number().min(0),
  percentage: z.number().min(0).max(100),
  verdict: exerciseVerdictSchema,
  perCriterion: z.array(exerciseCriterionScoreSchema),
  summary: z.string(),
});

export const exerciseSessionSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioVersion: z.string().min(1),
  tenantId: z.string(),
  status: exerciseSessionStatusSchema,
  startedAt: z.string(),
  endedAt: z.string().optional(),
  currentStepIndex: z.number().int().min(0),
  decisions: z.array(exerciseDecisionRecordSchema).default([]),
  injectAcks: z.array(exerciseInjectAckSchema).default([]),
  participantNotes: z.string(),
  result: exerciseResultSchema.optional(),
});

export const scenarioExportSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  scenarios: z.array(scenarioSchema),
});

export type ScenarioExport = z.infer<typeof scenarioExportSchema>;

export function parseScenario(raw: unknown): Scenario {
  return scenarioSchema.parse(raw) as Scenario;
}

export function safeParseScenario(raw: unknown) {
  return scenarioSchema.safeParse(raw);
}
