import { z } from 'zod';
import type { ResiliencePlan } from './types';

/**
 * Zod-Schemas für Import, Export und Versions-Migrationen des Resilienzplans.
 *
 * Harte Constraints:
 *   - Status muss aus der Vier-Werte-Union stammen
 *   - Jede Maßnahme trägt genau ein Resilienzziel
 *   - Ein approved-Plan MUSS approvedBy und approvedAt haben (im superRefine-Block)
 */

export const resilienceGoalSchema = z.enum(['prevent', 'protect', 'respond', 'recover']);

export const measureStatusSchema = z.enum(['planned', 'active', 'ready']);

export const planStatusSchema = z.enum(['draft', 'review', 'approved', 'archived']);

export const scopeSectionSchema = z.object({
  operatorName: z.string(),
  sector: z.string(),
  criticalService: z.string(),
  locations: z.string(),
  employees: z.string(),
  personsServed: z.string(),
  scopeNote: z.string(),
});

export const topRiskReferenceSchema = z.object({
  riskId: z.string().optional(),
  title: z.string().min(1),
  category: z.string(),
  initialScore: z.number().int().min(0).max(25),
  residualScore: z.number().int().min(0).max(25),
  criticality: z.string(),
});

export const riskBasisSectionSchema = z.object({
  methodology: z.string(),
  riskAnalysisReference: z.string(),
  topRisks: z.array(topRiskReferenceSchema).default([]),
  riskBasisNote: z.string(),
});

export const measureReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  goal: resilienceGoalSchema,
  linkedActionItemId: z.string().optional(),
  owner: z.string(),
  dueDate: z.string(),
  status: measureStatusSchema,
});

export const measuresByGoalSchema = z.object({
  prevent: z.array(measureReferenceSchema).default([]),
  protect: z.array(measureReferenceSchema).default([]),
  respond: z.array(measureReferenceSchema).default([]),
  recover: z.array(measureReferenceSchema).default([]),
});

export const governanceSectionSchema = z.object({
  managementBoardContact: z.string(),
  programOwner: z.string(),
  escalationPath: z.string(),
  boardReviewCadence: z.string(),
  governanceNote: z.string(),
});

export const reportingSectionSchema = z.object({
  incidentContact: z.string(),
  incidentBackupContact: z.string(),
  bsiPortalNote: z.string(),
  firstReportingTimeline: z.string(),
  reportingNote: z.string(),
});

export const evidenceItemReferenceSchema = z.object({
  title: z.string().min(1),
  type: z.string(),
  sourceStandard: z.string().optional(),
});

export const evidenceSectionSchema = z.object({
  evidenceReferences: z.array(evidenceItemReferenceSchema).default([]),
  reviewCycleYears: z.number().int().min(1).max(10),
  equivalentProofsNote: z.string(),
  evidenceNote: z.string(),
});

export const resiliencePlanContentSchema = z.object({
  scope: scopeSectionSchema,
  riskBasis: riskBasisSectionSchema,
  measuresByGoal: measuresByGoalSchema,
  governance: governanceSectionSchema,
  reporting: reportingSectionSchema,
  evidence: evidenceSectionSchema,
});

export const resiliencePlanSchema = z
  .object({
    id: z.string().min(1),
    tenantId: z.string(),
    version: z.string().min(1),
    status: planStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    approvedBy: z.string().optional(),
    approvedAt: z.string().optional(),
    content: resiliencePlanContentSchema,
  })
  .superRefine((plan, ctx) => {
    if (plan.status === 'approved') {
      if (!plan.approvedBy || plan.approvedBy.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['approvedBy'],
          message: 'Ein freigegebener Plan muss approvedBy gesetzt haben.',
        });
      }
      if (!plan.approvedAt || plan.approvedAt.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['approvedAt'],
          message: 'Ein freigegebener Plan muss approvedAt gesetzt haben.',
        });
      }
    }
  });

export const resiliencePlanExportSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  plan: resiliencePlanSchema,
});

export type ResiliencePlanExport = z.infer<typeof resiliencePlanExportSchema>;

export function parseResiliencePlan(raw: unknown): ResiliencePlan {
  return resiliencePlanSchema.parse(raw) as ResiliencePlan;
}

export function safeParseResiliencePlan(raw: unknown) {
  return resiliencePlanSchema.safeParse(raw);
}
