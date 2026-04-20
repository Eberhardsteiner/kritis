import { describe, expect, it } from 'vitest';
import { builtInScenarios, getBuiltInScenarioById } from './index';
import { scenarioSchema } from '../schema';
import { createSession, recordDecision, startSession, completeSession } from '../engine';

describe('Built-in scenarios · Inventar', () => {
  it('enthält genau drei Pflicht-Szenarien', () => {
    expect(builtInScenarios).toHaveLength(3);
    const ids = builtInScenarios.map((scenario) => scenario.id).sort();
    expect(ids).toEqual([
      'scenario-cyber-energy-2026',
      'scenario-flood-cascade-2026',
      'scenario-supply-chain-logistics-2026',
    ]);
  });

  it('liefert je eindeutige Kombination (id, version)', () => {
    const keys = builtInScenarios.map((scenario) => `${scenario.id}::${scenario.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('getBuiltInScenarioById findet alle und undefined bei unbekannter ID', () => {
    for (const scenario of builtInScenarios) {
      expect(getBuiltInScenarioById(scenario.id)?.title).toBe(scenario.title);
    }
    expect(getBuiltInScenarioById('phantom')).toBeUndefined();
  });
});

describe('Built-in scenarios · Schema-Integrität', () => {
  it.each(['scenario-cyber-energy-2026', 'scenario-flood-cascade-2026', 'scenario-supply-chain-logistics-2026'])(
    '"%s" validiert sauber gegen scenarioSchema',
    (id) => {
      const scenario = getBuiltInScenarioById(id);
      expect(scenario).toBeDefined();
      const result = scenarioSchema.safeParse(scenario);
      expect(result.success).toBe(true);
    },
  );

  it('jedes Szenario referenziert mindestens vier Rollen und vier Bewertungskriterien', () => {
    for (const scenario of builtInScenarios) {
      expect(scenario.roles.length, `roles in ${scenario.id}`).toBeGreaterThanOrEqual(4);
      expect(scenario.evaluationCriteria.length, `criteria in ${scenario.id}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('jedes Szenario hat mindestens eine Entscheidung pro Timeline-Schritt', () => {
    for (const scenario of builtInScenarios) {
      for (const step of scenario.timeline) {
        expect(
          step.injects.length + step.decisions.length,
          `step t=${step.t} in ${scenario.id}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('jedes Kriterium wird von mindestens einer Option referenziert (kein Dead-Code-Kriterium)', () => {
    for (const scenario of builtInScenarios) {
      const referencedHints = new Set<string>();
      for (const step of scenario.timeline) {
        for (const decision of step.decisions) {
          for (const option of decision.options) {
            option.evaluationHints?.forEach((hint) => referencedHints.add(hint));
          }
        }
      }
      for (const criterion of scenario.evaluationCriteria) {
        expect(
          referencedHints.has(criterion.id),
          `Kriterium "${criterion.id}" aus ${scenario.id} wird von keiner Option referenziert`,
        ).toBe(true);
      }
    }
  });

  it('enthält Szenarien für die drei KRITIS-Pilotbereiche (Energie, Wasser, Transport)', () => {
    const sectors = new Set(builtInScenarios.flatMap((scenario) => scenario.sectors));
    expect(sectors.has('Energie')).toBe(true);
    expect(sectors.has('Wasser (Trinkwasser und Abwasser)')).toBe(true);
    expect(sectors.has('Transport und Verkehr')).toBe(true);
  });
});

describe('Built-in scenarios · End-to-end-Durchlauf', () => {
  it.each(builtInScenarios)(
    'Szenario "$id" kann mit optimalen Entscheidungen vollständig durchlaufen werden',
    (scenario) => {
      let session = startSession(createSession({ scenario, tenantId: 'demo' }));
      for (const step of scenario.timeline) {
        for (const decision of step.decisions) {
          const bestOption = decision.options.reduce((best, current) => {
            const bestScore = best.scoreContribution ?? 0;
            const currentScore = current.scoreContribution ?? 0;
            return currentScore > bestScore ? current : best;
          });
          session = recordDecision(session, scenario, decision.id, bestOption.id);
        }
      }
      const completed = completeSession(session, scenario);
      expect(completed.status).toBe('completed');
      expect(completed.result?.verdict).toBe('bestanden');
      expect(completed.result?.percentage).toBeGreaterThanOrEqual(80);
    },
  );

  it.each(builtInScenarios)(
    'Szenario "$id" mit den schlechtesten Entscheidungen führt zu "nicht bestanden"',
    (scenario) => {
      let session = startSession(createSession({ scenario, tenantId: 'demo' }));
      for (const step of scenario.timeline) {
        for (const decision of step.decisions) {
          const worstOption = decision.options.reduce((worst, current) => {
            const worstScore = worst.scoreContribution ?? 0;
            const currentScore = current.scoreContribution ?? 0;
            return currentScore < worstScore ? current : worst;
          });
          session = recordDecision(session, scenario, decision.id, worstOption.id);
        }
      }
      const completed = completeSession(session, scenario);
      expect(completed.result?.percentage).toBeLessThan(60);
      expect(completed.result?.verdict).toBe('nicht_bestanden');
    },
  );
});
