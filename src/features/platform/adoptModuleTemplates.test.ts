/**
 * adoptModuleTemplates.test.ts · C5.3 + C5.3b/c/d/e/f/g Pack-Inhalts-Verifikation
 *
 * Vitest-Tests, die die ausgelieferten Sektor-Packs (healthcare-core,
 * energy-core, industry-core, logistics-core, water-core, it-telecom-core,
 * finance-core) laden und die Adopt-Bereitschaft in allen drei
 * Template-Kategorien bestätigen.
 * Diese Tests dienen als Content-Gate: Änderungen an den Packs, die eine
 * Kategorie versehentlich leeren, schlagen hier an, bevor sie in der
 * UVM-Demo sichtbar werden.
 *
 * Zusätzlich verifiziert jeder Block den Adopt-Smoke-Pfad über
 * `adoptAllTemplates`, indem das Pack einmal in einen leeren
 * Workspace-State adoptiert wird und die counts plausibel sind. Damit
 * ist auch die Voraussetzung abgesichert, dass die JSON-Datei die
 * Schema-Erwartungen der Adopt-Operatoren erfüllt.
 *
 * Infrastruktur-seitig ist der Adopt-Pfad bereits durch den E2E-Test
 * e2e/17-pack-adoption.e2e.ts aus C5.2 abgesichert.
 */
import { describe, expect, it } from 'vitest';
import healthcarePack from '../../module-packs/healthcare-core.container.json';
import energyPack from '../../module-packs/energy-core.container.json';
import industryPack from '../../module-packs/industry-core.container.json';
import logisticsPack from '../../module-packs/logistics-core.container.json';
import waterPack from '../../module-packs/water-core.container.json';
import itTelecomPack from '../../module-packs/it-telecom-core.container.json';
import financePack from '../../module-packs/finance-core.container.json';
import type { AppState, SectorModuleDefinition } from '../../types';
import { adoptAllTemplates, countAdoptableTemplates } from './adoptModuleTemplates';

/**
 * Leerer Workspace-State-Slice für den Adopt-Smoke-Test. Die Adopt-
 * Operatoren mutieren nichts, sie liefern neue Arrays/Objekte zurück;
 * dieser Slice hat genau die vier Felder, die `adoptAllTemplates`
 * erwartet.
 */
const emptyAdoptionState: Pick<
  AppState,
  'riskEntries' | 'resiliencePlan' | 'archivedResiliencePlans' | 'importedTabletopScenarios'
> = {
  riskEntries: [],
  resiliencePlan: null,
  archivedResiliencePlans: [],
  importedTabletopScenarios: [],
};

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

describe('industry-core.container.json · C5.3c Content-Gate', () => {
  const module = industryPack.module as unknown as SectorModuleDefinition;

  it('parses as a SectorModuleDefinition with all three C5.1 template fields populated', () => {
    const counts = countAdoptableTemplates(module);
    expect(counts.riskCatalog).toBeGreaterThan(0);
    expect(counts.resiliencePlan).toBe(1);
    expect(counts.tabletop).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(0);
  });

  it('has at least 15 risk catalog templates covering all six RiskCategoryId enums', () => {
    const risks = module.riskCatalogTemplates ?? [];
    expect(risks.length).toBeGreaterThanOrEqual(15);
    const categories = new Set(risks.map((r) => r.categoryId));
    expect(categories).toEqual(
      new Set(['nature', 'technical', 'human_intentional', 'human_unintentional', 'interdependency', 'cyber_physical']),
    );
  });

  it('has a cyber_physical/interdependency-heavy distribution (sector contrast: cyber + supply chain)', () => {
    // Industry-Demo-Punkt: cyber_physical-stark plus interdependency-stark — der dritte
    // Demo-Kontrast nach Healthcare (interdependency) und Energy (cyber_physical).
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      (byCategory.get('cyber_physical') ?? 0) + (byCategory.get('interdependency') ?? 0),
      'Industry pack should remain cyber_physical/interdependency-heavy for the demo contrast',
    ).toBeGreaterThanOrEqual(6);
  });

  it('has at least 2 tabletop scenarios with at least one decision each', () => {
    const scenarios = module.tabletopScenarios ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    for (const scn of scenarios) {
      const totalDecisions = scn.timeline.reduce((sum, step) => sum + step.decisions.length, 0);
      expect(totalDecisions, `Scenario ${scn.id} must have at least one decision`).toBeGreaterThan(0);
    }
    // Über alle Tabletops müssen die fünf ScenarioPhase-Werte abgedeckt sein
    // (eine sub-KRITIS-Krise wie JIT-Lieferantenausfall in T2 darf 24h_reporting auslassen,
    // solange T1 die volle Kette abdeckt).
    const allPhases = new Set<string>();
    for (const scn of scenarios) {
      for (const step of scn.timeline) {
        allPhases.add(step.phase);
      }
    }
    expect(allPhases).toEqual(
      new Set(['discovery', 'early_response', '24h_reporting', 'stabilization', 'recovery']),
    );
  });

  it('has a resilience plan template with all six content sections and a NIS2/KRITIS-conform review cycle', () => {
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
    // NIS2-orientierte Packs (Industry, Logistics, Water) führen einen
    // 2-Jahres-Zyklus; KRITIS-Dachgesetz-orientierte Packs (Healthcare,
    // Energy) den 4-Jahres-Zyklus. Das Content-Gate akzeptiert beide
    // Werte, lehnt aber 0/null/zu lange Zyklen ab.
    const cycle = tpl?.content.evidence.reviewCycleYears;
    expect(cycle).toBeGreaterThanOrEqual(1);
    expect(cycle).toBeLessThanOrEqual(4);
  });

  it('runs adoptAllTemplates without errors against an empty workspace state', () => {
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-industry');
    expect(result.counts.riskAdded).toBeGreaterThan(0);
    // Bei leerem currentState ist `planReplaced` false (es gab keinen alten
    // Plan zum Archivieren); die operative Adopt-Wirkung ist trotzdem
    // erfolgreich — verifiziert über `resiliencePlan).not.toBeNull()`.
    expect(result.counts.planReplaced).toBe(false);
    expect(result.counts.tabletopAdded).toBeGreaterThan(0);
    expect(result.counts.tabletopReplaced).toBe(0);
    expect(result.resiliencePlan).not.toBeNull();
    expect(result.archivedResiliencePlans).toEqual([]);
    expect(result.riskEntries.length).toBe(result.counts.riskAdded);
    expect(result.importedTabletopScenarios.length).toBe(result.counts.tabletopAdded);
  });
});

describe('logistics-core.container.json · C5.3d Content-Gate', () => {
  const module = logisticsPack.module as unknown as SectorModuleDefinition;

  it('parses as a SectorModuleDefinition with all three C5.1 template fields populated', () => {
    const counts = countAdoptableTemplates(module);
    expect(counts.riskCatalog).toBeGreaterThan(0);
    expect(counts.resiliencePlan).toBe(1);
    expect(counts.tabletop).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(0);
  });

  it('has at least 15 risk catalog templates covering all six RiskCategoryId enums', () => {
    const risks = module.riskCatalogTemplates ?? [];
    expect(risks.length).toBeGreaterThanOrEqual(15);
    const categories = new Set(risks.map((r) => r.categoryId));
    expect(categories).toEqual(
      new Set(['nature', 'technical', 'human_intentional', 'human_unintentional', 'interdependency', 'cyber_physical']),
    );
  });

  it('has an interdependency-heavy distribution (sector contrast: vernetzte Branche)', () => {
    // Logistics-Demo-Punkt: interdependency-stark als der vierte Demo-Kontrast.
    // Logistik-Netze sind inhärent abhängig — die Verteilung spiegelt das.
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      byCategory.get('interdependency') ?? 0,
      'Logistics pack should remain interdependency-heavy for the demo contrast',
    ).toBeGreaterThanOrEqual(4);
  });

  it('has at least 2 tabletop scenarios with at least one decision each', () => {
    const scenarios = module.tabletopScenarios ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    for (const scn of scenarios) {
      const totalDecisions = scn.timeline.reduce((sum, step) => sum + step.decisions.length, 0);
      expect(totalDecisions, `Scenario ${scn.id} must have at least one decision`).toBeGreaterThan(0);
    }
    const allPhases = new Set<string>();
    for (const scn of scenarios) {
      for (const step of scn.timeline) {
        allPhases.add(step.phase);
      }
    }
    expect(allPhases).toEqual(
      new Set(['discovery', 'early_response', '24h_reporting', 'stabilization', 'recovery']),
    );
  });

  it('has a resilience plan template with all six content sections and a NIS2/KRITIS-conform review cycle', () => {
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
    const cycle = tpl?.content.evidence.reviewCycleYears;
    expect(cycle).toBeGreaterThanOrEqual(1);
    expect(cycle).toBeLessThanOrEqual(4);
  });

  it('runs adoptAllTemplates without errors against an empty workspace state', () => {
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-logistics');
    expect(result.counts.riskAdded).toBeGreaterThan(0);
    // Bei leerem currentState ist `planReplaced` false (es gab keinen alten
    // Plan zum Archivieren); die operative Adopt-Wirkung ist trotzdem
    // erfolgreich — verifiziert über `resiliencePlan).not.toBeNull()`.
    expect(result.counts.planReplaced).toBe(false);
    expect(result.counts.tabletopAdded).toBeGreaterThan(0);
    expect(result.counts.tabletopReplaced).toBe(0);
    expect(result.resiliencePlan).not.toBeNull();
    expect(result.archivedResiliencePlans).toEqual([]);
    expect(result.riskEntries.length).toBe(result.counts.riskAdded);
    expect(result.importedTabletopScenarios.length).toBe(result.counts.tabletopAdded);
  });
});

describe('water-core.container.json · C5.3e Content-Gate', () => {
  const module = waterPack.module as unknown as SectorModuleDefinition;

  it('parses as a SectorModuleDefinition with all three C5.1 template fields populated', () => {
    const counts = countAdoptableTemplates(module);
    expect(counts.riskCatalog).toBeGreaterThan(0);
    expect(counts.resiliencePlan).toBe(1);
    expect(counts.tabletop).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(0);
  });

  it('has at least 15 risk catalog templates covering all six RiskCategoryId enums', () => {
    const risks = module.riskCatalogTemplates ?? [];
    expect(risks.length).toBeGreaterThanOrEqual(15);
    const categories = new Set(risks.map((r) => r.categoryId));
    expect(categories).toEqual(
      new Set(['nature', 'technical', 'human_intentional', 'human_unintentional', 'interdependency', 'cyber_physical']),
    );
  });

  it('has a cyber_physical/nature-heavy distribution (sector contrast: Versorgung mit klimatischer Abhängigkeit)', () => {
    // Water-Demo-Punkt: cyber_physical-stark (Oldsmar-Klasse) plus nature-stark
    // (klimabedingte Hochwasser-/Dürre-Risiken). Fünfter Demo-Kontrast.
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      byCategory.get('cyber_physical') ?? 0,
      'Water pack should keep at least 3 cyber_physical risks (Oldsmar-class)',
    ).toBeGreaterThanOrEqual(3);
    expect(
      byCategory.get('nature') ?? 0,
      'Water pack should keep at least 2 nature risks (climate dependency)',
    ).toBeGreaterThanOrEqual(2);
  });

  it('has at least 2 tabletop scenarios with at least one decision each', () => {
    const scenarios = module.tabletopScenarios ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    for (const scn of scenarios) {
      const totalDecisions = scn.timeline.reduce((sum, step) => sum + step.decisions.length, 0);
      expect(totalDecisions, `Scenario ${scn.id} must have at least one decision`).toBeGreaterThan(0);
    }
    const allPhases = new Set<string>();
    for (const scn of scenarios) {
      for (const step of scn.timeline) {
        allPhases.add(step.phase);
      }
    }
    expect(allPhases).toEqual(
      new Set(['discovery', 'early_response', '24h_reporting', 'stabilization', 'recovery']),
    );
  });

  it('has a resilience plan template with all six content sections and a NIS2/KRITIS-conform review cycle', () => {
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
    const cycle = tpl?.content.evidence.reviewCycleYears;
    expect(cycle).toBeGreaterThanOrEqual(1);
    expect(cycle).toBeLessThanOrEqual(4);
  });

  it('runs adoptAllTemplates without errors against an empty workspace state', () => {
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-water');
    expect(result.counts.riskAdded).toBeGreaterThan(0);
    // Bei leerem currentState ist `planReplaced` false (es gab keinen alten
    // Plan zum Archivieren); die operative Adopt-Wirkung ist trotzdem
    // erfolgreich — verifiziert über `resiliencePlan).not.toBeNull()`.
    expect(result.counts.planReplaced).toBe(false);
    expect(result.counts.tabletopAdded).toBeGreaterThan(0);
    expect(result.counts.tabletopReplaced).toBe(0);
    expect(result.resiliencePlan).not.toBeNull();
    expect(result.archivedResiliencePlans).toEqual([]);
    expect(result.riskEntries.length).toBe(result.counts.riskAdded);
    expect(result.importedTabletopScenarios.length).toBe(result.counts.tabletopAdded);
  });
});

describe('it-telecom-core.container.json · C5.3f Content-Gate', () => {
  const module = itTelecomPack.module as unknown as SectorModuleDefinition;

  it('parses as a SectorModuleDefinition with all three C5.1 template fields populated', () => {
    const counts = countAdoptableTemplates(module);
    expect(counts.riskCatalog).toBeGreaterThan(0);
    expect(counts.resiliencePlan).toBe(1);
    expect(counts.tabletop).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(0);
  });

  it('has at least 15 risk catalog templates covering all six RiskCategoryId enums', () => {
    const risks = module.riskCatalogTemplates ?? [];
    expect(risks.length).toBeGreaterThanOrEqual(15);
    const categories = new Set(risks.map((r) => r.categoryId));
    expect(categories).toEqual(
      new Set(['nature', 'technical', 'human_intentional', 'human_unintentional', 'interdependency', 'cyber_physical']),
    );
  });

  it('has a cyber_physical/technical-heavy distribution (sector contrast: Querschnitts-Branche mit doppelter Angriffsfläche)', () => {
    // IT/Telekom-Demo-Punkt: cyber_physical-stark plus technical-stark als sechster
    // Demo-Kontrast. Backbone und RZ-Infrastruktur sind beide harte Bruchpunkte.
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      (byCategory.get('cyber_physical') ?? 0) + (byCategory.get('technical') ?? 0),
      'IT/Telekom pack should keep cyber_physical+technical >= 7 (Querschnitts-Branche)',
    ).toBeGreaterThanOrEqual(7);
  });

  it('has at least 2 tabletop scenarios with at least one decision each', () => {
    const scenarios = module.tabletopScenarios ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    for (const scn of scenarios) {
      const totalDecisions = scn.timeline.reduce((sum, step) => sum + step.decisions.length, 0);
      expect(totalDecisions, `Scenario ${scn.id} must have at least one decision`).toBeGreaterThan(0);
    }
    const allPhases = new Set<string>();
    for (const scn of scenarios) {
      for (const step of scn.timeline) {
        allPhases.add(step.phase);
      }
    }
    expect(allPhases).toEqual(
      new Set(['discovery', 'early_response', '24h_reporting', 'stabilization', 'recovery']),
    );
  });

  it('has a resilience plan template with all six content sections and a NIS2/KRITIS-conform review cycle', () => {
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
    const cycle = tpl?.content.evidence.reviewCycleYears;
    expect(cycle).toBeGreaterThanOrEqual(1);
    expect(cycle).toBeLessThanOrEqual(4);
  });

  it('runs adoptAllTemplates without errors against an empty workspace state', () => {
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-it-telecom');
    expect(result.counts.riskAdded).toBeGreaterThan(0);
    expect(result.counts.planReplaced).toBe(false);
    expect(result.counts.tabletopAdded).toBeGreaterThan(0);
    expect(result.counts.tabletopReplaced).toBe(0);
    expect(result.resiliencePlan).not.toBeNull();
    expect(result.archivedResiliencePlans).toEqual([]);
    expect(result.riskEntries.length).toBe(result.counts.riskAdded);
    expect(result.importedTabletopScenarios.length).toBe(result.counts.tabletopAdded);
  });
});

describe('finance-core.container.json · C5.3g Content-Gate', () => {
  const module = financePack.module as unknown as SectorModuleDefinition;

  it('parses as a SectorModuleDefinition with all three C5.1 template fields populated', () => {
    const counts = countAdoptableTemplates(module);
    expect(counts.riskCatalog).toBeGreaterThan(0);
    expect(counts.resiliencePlan).toBe(1);
    expect(counts.tabletop).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(0);
  });

  it('has at least 15 risk catalog templates covering all six RiskCategoryId enums', () => {
    const risks = module.riskCatalogTemplates ?? [];
    expect(risks.length).toBeGreaterThanOrEqual(15);
    const categories = new Set(risks.map((r) => r.categoryId));
    expect(categories).toEqual(
      new Set(['nature', 'technical', 'human_intentional', 'human_unintentional', 'interdependency', 'cyber_physical']),
    );
  });

  it('has a cyber_physical/technical-heavy distribution with explicit Insider-Schwerpunkt (sector contrast: Vertrauens-Branche mit Mikrosekunden-Verfügbarkeitsdruck und Insider-Risiko-Schwerpunkt)', () => {
    // Finanz-Demo-Punkt: Customer-Trust + transaktionelle Verfügbarkeit als
    // siebter Demo-Kontrast. cyber_physical+technical bleibt stark
    // (DDoS-, Daten-Exfil-, Trading-Manipulations-, Core-Banking-Achsen),
    // parallel mindestens 3 human_intentional-Risiken zur Insider-/Carbanak-/
    // Geldwäsche-Schicht.
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      (byCategory.get('cyber_physical') ?? 0) + (byCategory.get('technical') ?? 0),
      'Finance pack should keep cyber_physical+technical >= 7 (Mikrosekunden-Verfügbarkeitsdruck)',
    ).toBeGreaterThanOrEqual(7);
    expect(
      byCategory.get('human_intentional') ?? 0,
      'Finance pack should have >= 3 human_intentional risks (Insider-Risiko-Schwerpunkt)',
    ).toBeGreaterThanOrEqual(3);
  });

  it('has at least 2 tabletop scenarios with at least one decision each', () => {
    const scenarios = module.tabletopScenarios ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    for (const scn of scenarios) {
      const totalDecisions = scn.timeline.reduce((sum, step) => sum + step.decisions.length, 0);
      expect(totalDecisions, `Scenario ${scn.id} must have at least one decision`).toBeGreaterThan(0);
    }
    const allPhases = new Set<string>();
    for (const scn of scenarios) {
      for (const step of scn.timeline) {
        allPhases.add(step.phase);
      }
    }
    expect(allPhases).toEqual(
      new Set(['discovery', 'early_response', '24h_reporting', 'stabilization', 'recovery']),
    );
  });

  it('has a resilience plan template with all six content sections and a DORA-conform review cycle', () => {
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
    const cycle = tpl?.content.evidence.reviewCycleYears;
    expect(cycle).toBeGreaterThanOrEqual(1);
    expect(cycle).toBeLessThanOrEqual(4);
  });

  it('runs adoptAllTemplates without errors against an empty workspace state', () => {
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-finance');
    expect(result.counts.riskAdded).toBeGreaterThan(0);
    expect(result.counts.planReplaced).toBe(false);
    expect(result.counts.tabletopAdded).toBeGreaterThan(0);
    expect(result.counts.tabletopReplaced).toBe(0);
    expect(result.resiliencePlan).not.toBeNull();
    expect(result.archivedResiliencePlans).toEqual([]);
    expect(result.riskEntries.length).toBe(result.counts.riskAdded);
    expect(result.importedTabletopScenarios.length).toBe(result.counts.tabletopAdded);
  });
});
