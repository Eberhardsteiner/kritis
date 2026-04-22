/**
 * adoptModuleTemplates.test.ts · C5.3 + C5.3b Pack-Inhalts-Verifikation
 *
 * Vitest-Tests, die die ausgelieferten Sektor-Packs (healthcare-core,
 * energy-core) laden und die Adopt-Bereitschaft in allen drei Template-
 * Kategorien bestätigen. Diese Tests dienen als Content-Gate: Änderungen
 * an den Packs, die eine Kategorie versehentlich leeren, schlagen hier
 * an, bevor sie in der UVM-Demo sichtbar werden.
 *
 * Infrastruktur-seitig ist der Adopt-Pfad bereits durch den E2E-Test
 * e2e/17-pack-adoption.e2e.ts aus C5.2 abgesichert.
 */
import { describe, expect, it } from 'vitest';
import healthcarePack from '../../module-packs/healthcare-core.container.json';
import energyPack from '../../module-packs/energy-core.container.json';
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

describe('energy-core.container.json · C5.3b Content-Gate', () => {
  const module = energyPack.module as unknown as SectorModuleDefinition;

  it('parses as a SectorModuleDefinition with all three C5.1 template fields populated', () => {
    const counts = countAdoptableTemplates(module);
    expect(counts.riskCatalog).toBeGreaterThan(0);
    expect(counts.resiliencePlan).toBe(1);
    expect(counts.tabletop).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(0);
  });

  it('has at least 12 risk catalog templates covering all six RiskCategoryId enums', () => {
    const risks = module.riskCatalogTemplates ?? [];
    expect(risks.length).toBeGreaterThanOrEqual(12);
    const categories = new Set(risks.map((r) => r.categoryId));
    expect(categories).toEqual(
      new Set(['nature', 'technical', 'human_intentional', 'human_unintentional', 'interdependency', 'cyber_physical']),
    );
  });

  it('has a technical/cyber_physical-heavy category distribution (sector contrast to healthcare)', () => {
    // Der Demo-Punkt: Energy ist technical/cyber_physical-schwer, Healthcare ist
    // interdependency-schwer. Der Test friert diese Absicht ein — wenn jemand
    // versehentlich das Energy-Pack auf ein anderes Risiko-Profil umbaut,
    // schlägt der Content-Gate an.
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      (byCategory.get('technical') ?? 0) + (byCategory.get('cyber_physical') ?? 0),
      'Energy pack should remain technical/cyber_physical-heavy for the demo contrast',
    ).toBeGreaterThanOrEqual(6);
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

    for (const scn of scenarios) {
      const totalDecisions = scn.timeline.reduce((sum, step) => sum + step.decisions.length, 0);
      expect(totalDecisions, `Scenario ${scn.id} must have at least one decision`).toBeGreaterThan(0);
    }
  });
});
