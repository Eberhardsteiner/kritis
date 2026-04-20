import { describe, expect, it } from 'vitest';
import {
  resiliencePlanExportSchema,
  resiliencePlanSchema,
  safeParseResiliencePlan,
} from './schema';
import {
  ORDERED_RESILIENCE_GOALS,
  PLAN_SECTION_LABELS,
  RESILIENCE_GOAL_LABELS,
  buildEmptyPlanContent,
} from './template';
import type { ResiliencePlan } from './types';

const validPlan: ResiliencePlan = {
  id: 'plan-1',
  tenantId: 'demo',
  version: '1.0.0',
  status: 'draft',
  createdAt: '2026-04-20T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
  content: buildEmptyPlanContent(),
};

describe('Template · Grundstruktur', () => {
  it('liefert ein Content-Objekt mit allen sechs Abschnitten', () => {
    const content = buildEmptyPlanContent();
    expect(Object.keys(content).sort()).toEqual(
      ['evidence', 'governance', 'measuresByGoal', 'reporting', 'riskBasis', 'scope'].sort(),
    );
  });

  it('listet die vier Resilienzziele in stabiler Reihenfolge', () => {
    expect(ORDERED_RESILIENCE_GOALS).toEqual(['prevent', 'protect', 'respond', 'recover']);
    for (const goal of ORDERED_RESILIENCE_GOALS) {
      expect(RESILIENCE_GOAL_LABELS[goal]).toBeDefined();
    }
  });

  it('beschriftet jeden Abschnitt nach § 13-Nummerierung', () => {
    expect(PLAN_SECTION_LABELS.scope).toMatch(/^1\./);
    expect(PLAN_SECTION_LABELS.evidence).toMatch(/^6\./);
  });

  it('baut leere Maßnahmenlisten für jedes Resilienzziel', () => {
    const content = buildEmptyPlanContent();
    expect(content.measuresByGoal.prevent).toEqual([]);
    expect(content.measuresByGoal.protect).toEqual([]);
    expect(content.measuresByGoal.respond).toEqual([]);
    expect(content.measuresByGoal.recover).toEqual([]);
  });

  it('setzt den Review-Zyklus auf vier Jahre (§ 12 Abs. 2 KRITISDachG)', () => {
    const content = buildEmptyPlanContent();
    expect(content.evidence.reviewCycleYears).toBe(4);
  });
});

describe('resiliencePlanSchema · Grundvalidierung', () => {
  it('akzeptiert einen gültigen Draft-Plan', () => {
    const result = resiliencePlanSchema.parse(validPlan);
    expect(result.id).toBe('plan-1');
  });

  it('lehnt einen unbekannten Status ab', () => {
    const result = safeParseResiliencePlan({ ...validPlan, status: 'phantasie' });
    expect(result.success).toBe(false);
  });

  it('lehnt eine Maßnahme mit unbekanntem Resilienzziel ab', () => {
    const brokenPlan = {
      ...validPlan,
      content: {
        ...validPlan.content,
        measuresByGoal: {
          ...validPlan.content.measuresByGoal,
          prevent: [
            {
              id: 'm1',
              title: 'Blitzschutz',
              description: '',
              goal: 'isolieren',
              owner: '',
              dueDate: '',
              status: 'planned',
            },
          ],
        },
      },
    };
    const result = safeParseResiliencePlan(brokenPlan);
    expect(result.success).toBe(false);
  });

  it('lehnt Top-Risiko mit Score > 25 ab', () => {
    const brokenPlan = {
      ...validPlan,
      content: {
        ...validPlan.content,
        riskBasis: {
          ...validPlan.content.riskBasis,
          topRisks: [
            {
              title: 'X',
              category: 'nature',
              initialScore: 99,
              residualScore: 3,
              criticality: 'sofort',
            },
          ],
        },
      },
    };
    const result = safeParseResiliencePlan(brokenPlan);
    expect(result.success).toBe(false);
  });
});

describe('resiliencePlanSchema · Freigabe-Constraints', () => {
  it('lehnt einen approved-Plan ohne approvedBy/approvedAt ab', () => {
    const result = safeParseResiliencePlan({ ...validPlan, status: 'approved' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('approvedBy');
      expect(paths).toContain('approvedAt');
    }
  });

  it('akzeptiert einen approved-Plan mit approvedBy und approvedAt', () => {
    const result = safeParseResiliencePlan({
      ...validPlan,
      status: 'approved',
      approvedBy: 'Dr. Muster (Geschäftsleitung)',
      approvedAt: '2026-05-01T09:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('akzeptiert archivierte Pläne ohne approvedBy (nicht zwingend)', () => {
    const result = safeParseResiliencePlan({ ...validPlan, status: 'archived' });
    expect(result.success).toBe(true);
  });
});

describe('resiliencePlanExportSchema · Container', () => {
  it('validiert einen Export-Container mit Version 1', () => {
    const container = {
      version: 1 as const,
      generatedAt: '2026-04-20T10:00:00Z',
      plan: validPlan,
    };
    const result = resiliencePlanExportSchema.parse(container);
    expect(result.plan.id).toBe('plan-1');
  });

  it('lehnt eine andere Schema-Version ab', () => {
    const container = {
      version: 99,
      generatedAt: '2026-04-20',
      plan: validPlan,
    };
    const result = resiliencePlanExportSchema.safeParse(container);
    expect(result.success).toBe(false);
  });
});
