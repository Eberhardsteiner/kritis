/**
 * adoptModuleTemplates.test.ts · C5.3 Healthcare-Pack-Inhalts-Verifikation
 *
 * Vitest-Test, der den Healthcare-Pack lädt und die Adopt-Bereitschaft
 * in allen drei Template-Kategorien bestätigt. Dieser Test dient als
 * Content-Gate: Änderungen am Pack, die eine Kategorie versehentlich
 * leeren, schlagen hier an, bevor sie in der UVM-Demo sichtbar werden.
 *
 * Infrastruktur-seitig ist der Adopt-Pfad bereits durch den E2E-Test
 * e2e/17-pack-adoption.e2e.ts aus C5.2 abgesichert.
 */
import { describe, expect, it } from 'vitest';
import healthcarePack from '../../module-packs/healthcare-core.container.json';
import type { SectorModuleDefinition } from '../../types';
import { countAdoptableTemplates } from './adoptModuleTemplates';

describe('healthcare-core.container.json · C5.3 Content-Gate', () => {
  const module = healthcarePack.module as unknown as SectorModuleDefinition;

  it('parses as a SectorModuleDefinition with all three C5.1 template fields populated', () => {
    const counts = countAdoptableTemplates(module);
    expect(counts.riskCatalog).toBeGreaterThan(0);
    expect(counts.resiliencePlan).toBe(1);
    expect(counts.tabletop).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(0);
  });

  it('has at least 8 risk catalog templates covering all six RiskCategoryId enums', () => {
    const risks = module.riskCatalogTemplates ?? [];
    expect(risks.length).toBeGreaterThanOrEqual(8);
    const categories = new Set(risks.map((r) => r.categoryId));
    expect(categories).toEqual(
      new Set(['nature', 'technical', 'human_intentional', 'human_unintentional', 'interdependency', 'cyber_physical']),
    );
  });

  it('has a resilience plan template with all six content sections and a four-year review cycle', () => {
    const tpl = module.resiliencePlanTemplate;
    expect(tpl).toBeDefined();
    expect(tpl?.templateId).toBeTruthy();
    expect(tpl?.content.scope.operatorName).toBeTruthy();
    expect(tpl?.content.riskBasis.topRisks.length).toBeGreaterThan(0);
    expect(tpl?.content.measuresByGoal.prevent.length).toBeGreaterThan(0);
    expect(tpl?.content.measuresByGoal.protect.length).toBeGreaterThan(0);
    expect(tpl?.content.measuresByGoal.respond.length).toBeGreaterThan(0);
    expect(tpl?.content.measuresByGoal.recover.length).toBeGreaterThan(0);
    expect(tpl?.content.governance).toBeDefined();
    expect(tpl?.content.reporting).toBeDefined();
    expect(tpl?.content.evidence.reviewCycleYears).toBe(4);
  });

  it('has at least one tabletop scenario covering all five ScenarioPhase enums across its timelines', () => {
    const scenarios = module.tabletopScenarios ?? [];
    expect(scenarios.length).toBeGreaterThan(0);

    const allPhases = new Set<string>();
    for (const scn of scenarios) {
      for (const step of scn.timeline) {
        allPhases.add(step.phase);
      }
    }
    expect(allPhases).toEqual(
      new Set(['discovery', 'early_response', '24h_reporting', 'stabilization', 'recovery']),
    );

    // Jedes Szenario hat mindestens eine Entscheidung.
    for (const scn of scenarios) {
      const totalDecisions = scn.timeline.reduce((sum, step) => sum + step.decisions.length, 0);
      expect(totalDecisions, `Scenario ${scn.id} must have at least one decision`).toBeGreaterThan(0);
    }
  });
});
