/**
 * adoptModuleTemplates.test.ts · C5.3 + C5.3b/c/d/e/f/g/h/i/j Pack-Inhalts-Verifikation
 *
 * Vitest-Tests, die die ausgelieferten Sektor-Packs (healthcare-core,
 * energy-core, industry-core, logistics-core, water-core, it-telecom-core,
 * finance-core, administration-core, kmu-basis-core, defence-core) laden
 * und die Adopt-Bereitschaft in allen drei Template-Kategorien bestätigen.
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
import administrationPack from '../../module-packs/administration-core.container.json';
import kmuBasisPack from '../../module-packs/kmu-basis-core.container.json';
import defencePack from '../../module-packs/defence-core.container.json';
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

describe('administration-core.container.json · C5.3h Content-Gate', () => {
  const module = administrationPack.module as unknown as SectorModuleDefinition;

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

  it('has an interdependency-/cyber_physical-heavy distribution (sector contrast: Bürger-Schnittstellen-Branche mit dezentral-föderaler IT-Abhängigkeit)', () => {
    // Verwaltungs-Demo-Punkt: Bürger-Service-Verfügbarkeit und Akten-
    // Integrität als achter Demo-Kontrast. cyber_physical-stark
    // (Ransomware-Hauptangriffsziel deutscher Kommunen 2021-2026,
    // Anhalt-Bitterfeld-Schablone) und interdependency-stark (kommunale
    // ITDZ-Abhängigkeit, Südwestfalen-IT-Schablone).
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      (byCategory.get('cyber_physical') ?? 0) + (byCategory.get('interdependency') ?? 0),
      'Administration pack should keep cyber_physical+interdependency >= 6 (Ransomware-Ziel + ITDZ-Abhängigkeit)',
    ).toBeGreaterThanOrEqual(6);
    expect(
      byCategory.get('interdependency') ?? 0,
      'Administration pack should have >= 3 interdependency risks (kommunale ITDZ-Verbund-Anbindung)',
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

  it('has a resilience plan template with all six content sections and a NIS2-/BSI-Grundschutz-conform review cycle', () => {
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
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-administration');
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

describe('administration-core · Resilience-Skeleton (C5.5.1 Pilot)', () => {
  const module = administrationPack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates (Substanz-Tiefe)', () => {
    const processes = module.processTemplates ?? [];
    expect(processes.length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    const deps = module.dependencyTemplates ?? [];
    expect(deps.length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates', () => {
    const scenarios = module.scenarioTemplates ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    const exercises = module.exerciseTemplates ?? [];
    expect(exercises.length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben gemischte Kritikalität (nicht alles "kritisch")', () => {
    const processes = module.processTemplates ?? [];
    const kritischCount = processes.filter((p) => p.criticality === 'kritisch').length;
    const hochCount = processes.filter((p) => p.criticality === 'hoch').length;
    const mittelCount = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritischCount).toBeGreaterThan(0);
    expect(hochCount).toBeGreaterThan(0);
    expect(mittelCount).toBeGreaterThan(0);
    // Keine 100%-kritisch-Verteilung — nicht alles auf maximaler Stufe.
    expect(kritischCount).toBeLessThan(processes.length);
  });

  it('processTemplates haben realistische MTPD/RTO/RPO-Werte (nicht alles 1h)', () => {
    const processes = module.processTemplates ?? [];
    const mtpdSet = new Set(processes.map((p) => p.mtpdHours));
    const rtoSet = new Set(processes.map((p) => p.rtoHours));
    // Mindestens 4 unterschiedliche MTPD-Werte und 3 unterschiedliche RTO-Werte
    // — wenn alle gleich wären, wären die Vorlagen nicht differenziert genug.
    expect(mtpdSet.size).toBeGreaterThanOrEqual(4);
    expect(rtoSet.size).toBeGreaterThanOrEqual(3);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedProcessTemplateIds ?? []) {
        if (!processIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked process "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle scenarioTemplates verlinken nur auf existierende dependencyTemplate-IDs', () => {
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedDependencyTemplateIds ?? []) {
        if (!depIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked dependency "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle exerciseTemplates verlinken auf existierende scenarioTemplate-IDs', () => {
    const scenarioIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exercises = module.exerciseTemplates ?? [];
    const orphans: string[] = [];
    for (const exercise of exercises) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung (Verkettungstiefe)', () => {
    const scenarios = module.scenarioTemplates ?? [];
    for (const scenario of scenarios) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('exerciseTemplates haben gemischte Kadenzen (nicht alles 12 Monate)', () => {
    const exercises = module.exerciseTemplates ?? [];
    const cadenceSet = new Set(exercises.map((e) => e.cadenceMonths));
    expect(cadenceSet.size).toBeGreaterThanOrEqual(3);
  });

  it('exerciseTemplates haben gemischte Übungs-Typen', () => {
    const exercises = module.exerciseTemplates ?? [];
    const typeSet = new Set(exercises.map((e) => e.exerciseType));
    // Mindestens 2 unterschiedliche Übungs-Typen (tabletop, simulation,
    // technical) — Diversität in der Übungs-Praxis.
    expect(typeSet.size).toBeGreaterThanOrEqual(2);
  });
});

describe('kmu-basis-core.container.json · C5.3i Content-Gate', () => {
  const module = kmuBasisPack.module as unknown as SectorModuleDefinition;

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

  it('has an interdependency-heavy distribution (sector contrast: Einsteiger-Pack mit dezentral-externer IT-Abhängigkeit)', () => {
    // KMU-Basis-Demo-Punkt: Geschäftskontinuität und NIS2-Mindest-Compliance
    // als neunter Demo-Kontrast. interdependency >= 4 (höchste interdependency-
    // Quote aller Packs) wegen MSP/MSSP/Konzern-Kunde/Bank als die vier
    // Mittelstands-Schicksals-Verbindungen. Pack-Pragmatik: kein Score-25,
    // höchster Score 20 für Ransomware-Geschäftsstillstand.
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      byCategory.get('interdependency') ?? 0,
      'KMU-Basis pack should have >= 4 interdependency risks (MSP/MSSP/Konzern-Kunde/Bank)',
    ).toBeGreaterThanOrEqual(4);
    expect(
      byCategory.get('cyber_physical') ?? 0,
      'KMU-Basis pack should have >= 4 cyber_physical risks (Ransomware/CEO-Fraud/Phishing/DDoS)',
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

  it('has a resilience plan template with all six content sections and a NIS2-/Mittelstand-conform review cycle', () => {
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
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-kmu-basis');
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

describe('defence-core.container.json · C5.3j Content-Gate', () => {
  const module = defencePack.module as unknown as SectorModuleDefinition;

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

  it('has a human_intentional-heavy distribution (sector contrast: Hochsicherheits-Branche mit gezielter staatlicher Bedrohung)', () => {
    // Defence-Demo-Punkt: Geheimhaltungs-Integrität und Lieferfähigkeit als
    // zehnter (und letzter) Demo-Kontrast. human_intentional >= 5 (höchste
    // Quote aller 10 Packs) wegen gezielter staatlicher Akteure als
    // strukturelle Sektor-Realität (APT28/GRU, China-MSS, gedrehter Insider,
    // Maulwurf, Korruption für Dual-Use-Export, Whistleblower).
    // Pack-Pragmatik: kein Score-25, EW=5 nicht vergeben (staatliche Akteure
    // sind regelmäßig aber nicht jährlich).
    const risks = module.riskCatalogTemplates ?? [];
    const byCategory = new Map<string, number>();
    for (const risk of risks) {
      byCategory.set(risk.categoryId, (byCategory.get(risk.categoryId) ?? 0) + 1);
    }
    expect(
      byCategory.get('human_intentional') ?? 0,
      'Defence pack should have >= 5 human_intentional risks (Insider/Maulwurf/Korruption/Sabotage/Whistleblower)',
    ).toBeGreaterThanOrEqual(5);
    expect(
      byCategory.get('cyber_physical') ?? 0,
      'Defence pack should have >= 4 cyber_physical risks (APT28/China-MSS/Lieferkette/Ransomware)',
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

  it('has a resilience plan template with all six content sections and a BMVg-CSA-conform 1-year review cycle', () => {
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
    const result = adoptAllTemplates(module, emptyAdoptionState, 'test-tenant-defence');
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

describe('healthcare-core · Resilience-Skeleton (C5.5.2)', () => {
  const module = healthcarePack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates (Substanz-Tiefe)', () => {
    const processes = module.processTemplates ?? [];
    expect(processes.length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    const deps = module.dependencyTemplates ?? [];
    expect(deps.length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates (Option A: 10 inkl. Bestand-Erhalt MANV + Sauerstoff)', () => {
    const scenarios = module.scenarioTemplates ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    const exercises = module.exerciseTemplates ?? [];
    expect(exercises.length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben gemischte Kritikalität (nicht alles "kritisch")', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBeGreaterThan(0);
    expect(hoch).toBeGreaterThan(0);
    expect(mittel).toBeGreaterThan(0);
    // Healthcare ist kritikalitätsstark, aber nicht alles auf maximaler Stufe.
    expect(kritisch).toBeLessThan(processes.length);
  });

  it('processTemplates haben gemischte MTPD/RTO-Werte inkl. Sub-Stunden für ITS', () => {
    const processes = module.processTemplates ?? [];
    const mtpdSet = new Set(processes.map((p) => p.mtpdHours));
    const rtoSet = new Set(processes.map((p) => p.rtoHours));
    expect(mtpdSet.size).toBeGreaterThanOrEqual(5);
    expect(rtoSet.size).toBeGreaterThanOrEqual(4);
    // Sub-Stunden-Wert für ITS: RTO 0.5h
    const its = processes.find((p) => p.id === 'hc_proc_its');
    expect(its).toBeDefined();
    expect(parseFloat(its!.rtoHours ?? '0')).toBeLessThan(1);
  });

  it('Bestands-IDs hc_proc_er, hc_proc_or, hc_dep_kis, hc_dep_oxygen, hc_dep_staff bleiben erhalten', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    expect(processIds.has('hc_proc_er')).toBe(true);
    expect(processIds.has('hc_proc_or')).toBe(true);
    expect(depIds.has('hc_dep_kis')).toBe(true);
    expect(depIds.has('hc_dep_oxygen')).toBe(true);
    expect(depIds.has('hc_dep_staff')).toBe(true);
  });

  it('Bestands-Szenario-IDs hc_scn_kis, hc_scn_mci, hc_scn_oxygen bleiben erhalten (Option A)', () => {
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    expect(scnIds.has('hc_scn_kis')).toBe(true);
    expect(scnIds.has('hc_scn_mci')).toBe(true);
    expect(scnIds.has('hc_scn_oxygen')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedProcessTemplateIds ?? []) {
        if (!processIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked process "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle scenarioTemplates verlinken nur auf existierende dependencyTemplate-IDs', () => {
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedDependencyTemplateIds ?? []) {
        if (!depIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked dependency "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle exerciseTemplates verlinken auf existierende scenarioTemplate-IDs', () => {
    const scenarioIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exercises = module.exerciseTemplates ?? [];
    const orphans: string[] = [];
    for (const exercise of exercises) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung (Verkettungstiefe)', () => {
    const scenarios = module.scenarioTemplates ?? [];
    for (const scenario of scenarios) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('exerciseTemplates haben gemischte Kadenzen', () => {
    const exercises = module.exerciseTemplates ?? [];
    const cadenceSet = new Set(exercises.map((e) => e.cadenceMonths));
    expect(cadenceSet.size).toBeGreaterThanOrEqual(3);
  });

  it('exerciseTemplates haben gemischte Übungs-Typen (Healthcare braucht tabletop+technical+simulation+alarm)', () => {
    const exercises = module.exerciseTemplates ?? [];
    const typeSet = new Set(exercises.map((e) => e.exerciseType));
    // Healthcare-Pack profitiert von 4 Übungs-Typen: tabletop für Krisen-Theorie,
    // technical für IT-Funktionstests, simulation für Live-Szenarien, alarm für MANV.
    expect(typeSet.size).toBeGreaterThanOrEqual(3);
  });

  it('Healthcare-Spezifika verifiziert: KIS als Prozess UND als Dependency (nicht doppelt, sondern zwei Sichten)', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    // hc_proc_kis = operative Sicht (wer ist verantwortlich, MTPD/RTO/RPO)
    // hc_dep_kis = Bedrohungs-Sicht (was passiert bei Ausfall)
    expect(processIds.has('hc_proc_kis')).toBe(true);
    expect(depIds.has('hc_dep_kis')).toBe(true);
  });

  it('ITS-Prozess hat Patientensicherheits-Disziplin als Notes-Kennzeichnung', () => {
    const its = (module.processTemplates ?? []).find((p) => p.id === 'hc_proc_its');
    expect(its).toBeDefined();
    expect(its!.notes).toMatch(/Patientensicherheit/i);
  });
});

describe('industry-core · Resilience-Skeleton (C5.5.3)', () => {
  const module = industryPack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates (Substanz-Tiefe)', () => {
    const processes = module.processTemplates ?? [];
    expect(processes.length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    const deps = module.dependencyTemplates ?? [];
    expect(deps.length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates (Option A: 9 inkl. Bestand-Erhalt manu_scenario_ot_remote_compromise)', () => {
    const scenarios = module.scenarioTemplates ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    const exercises = module.exerciseTemplates ?? [];
    expect(exercises.length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben gemischte Kritikalität (Spec-Verteilung 4 kritisch / 4 hoch / 2 mittel)', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBeGreaterThan(0);
    expect(hoch).toBeGreaterThan(0);
    expect(mittel).toBeGreaterThan(0);
    // Industry: Just-in-time-Druck macht viele Prozesse kritisch, aber nicht alle.
    expect(kritisch).toBeLessThan(processes.length);
  });

  it('processTemplates haben gemischte MTPD/RTO-Werte', () => {
    const processes = module.processTemplates ?? [];
    const mtpdSet = new Set(processes.map((p) => p.mtpdHours));
    const rtoSet = new Set(processes.map((p) => p.rtoHours));
    expect(mtpdSet.size).toBeGreaterThanOrEqual(5);
    expect(rtoSet.size).toBeGreaterThanOrEqual(4);
  });

  it('Bestands-IDs (mfg_*-Mix + manu_*-Mix) bleiben erhalten — keine Migration', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    // Bestand-Prozesse:
    expect(processIds.has('mfg_proc_line')).toBe(true);
    expect(processIds.has('mfg_proc_shipping')).toBe(true);
    expect(processIds.has('manu_process_quality_release')).toBe(true);
    // Bestand-Deps:
    expect(depIds.has('mfg_dep_power')).toBe(true);
    expect(depIds.has('mfg_dep_mes')).toBe(true);
    expect(depIds.has('mfg_dep_supplier')).toBe(true);
    expect(depIds.has('manu_dep_automation_vendor')).toBe(true);
    // Bestand-Szenarien:
    expect(scnIds.has('mfg_scn_blackout')).toBe(true);
    expect(scnIds.has('mfg_scn_mes')).toBe(true);
    expect(scnIds.has('mfg_scn_supplier')).toBe(true);
    expect(scnIds.has('manu_scenario_ot_remote_compromise')).toBe(true);
    // Bestand-Übungen:
    expect(exIds.has('mfg_ex_blackout')).toBe(true);
    expect(exIds.has('mfg_ex_mes')).toBe(true);
    expect(exIds.has('manu_exercise_ot_failover')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedProcessTemplateIds ?? []) {
        if (!processIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked process "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle scenarioTemplates verlinken nur auf existierende dependencyTemplate-IDs', () => {
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedDependencyTemplateIds ?? []) {
        if (!depIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked dependency "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle exerciseTemplates verlinken auf existierende scenarioTemplate-IDs', () => {
    const scenarioIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exercises = module.exerciseTemplates ?? [];
    const orphans: string[] = [];
    for (const exercise of exercises) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung (Verkettungstiefe)', () => {
    const scenarios = module.scenarioTemplates ?? [];
    for (const scenario of scenarios) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('exerciseTemplates haben gemischte Kadenzen', () => {
    const exercises = module.exerciseTemplates ?? [];
    const cadenceSet = new Set(exercises.map((e) => e.cadenceMonths));
    expect(cadenceSet.size).toBeGreaterThanOrEqual(2);
  });

  it('exerciseTemplates haben gemischte Übungs-Typen (Industry braucht tabletop+technical+simulation)', () => {
    const exercises = module.exerciseTemplates ?? [];
    const typeSet = new Set(exercises.map((e) => e.exerciseType));
    // Mindestens 3 unterschiedliche Übungs-Typen für Industry-Pack
    expect(typeSet.size).toBeGreaterThanOrEqual(3);
  });

  it('OT-Schwerpunkt-Verifikation: mfg_proc_ot existiert als eigener Prozess', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    expect(processIds.has('mfg_proc_ot')).toBe(true);
    const otProc = (module.processTemplates ?? []).find((p) => p.id === 'mfg_proc_ot');
    expect(otProc?.criticality).toBe('kritisch');
  });

  it('OT-Schwerpunkt-Verifikation: mindestens 2 Dependencies mit category="ot"', () => {
    const otDeps = (module.dependencyTemplates ?? []).filter((d) => d.category === 'ot');
    expect(otDeps.length).toBeGreaterThanOrEqual(2);
  });

  it('OT-Schwerpunkt-Verifikation: mindestens 3 OT-Cyber-Szenarien (Ransomware-OT-IT, ICS-Malware, Fernwartung)', () => {
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    expect(scnIds.has('mfg_scn_ransomware_ot_it')).toBe(true);
    expect(scnIds.has('mfg_scn_ics_malware')).toBe(true);
    expect(scnIds.has('manu_scenario_ot_remote_compromise')).toBe(true);
  });

  it('Wirtschaftsspionage-Disziplin: F&E-Prozess hat Continental-2022-Notes-Kennzeichnung', () => {
    const rd = (module.processTemplates ?? []).find((p) => p.id === 'mfg_proc_rd');
    expect(rd).toBeDefined();
    expect(rd!.notes).toMatch(/Continental|Wirtschaftsspionage/i);
  });

  it('OT-Verantwortungs-Rolle: realistisch als "IT-Leitung mit OT-Verantwortung"', () => {
    const otProc = (module.processTemplates ?? []).find((p) => p.id === 'mfg_proc_ot');
    expect(otProc?.ownerRole).toMatch(/IT-Leitung mit OT-Verantwortung/);
    // Reife-Indikator-Hinweis im Notes-Feld
    expect(otProc?.notes).toMatch(/Reifegrad|Trennung der Rollen/i);
  });
});

describe('kmu-basis-core · Resilience-Skeleton (C5.5.4)', () => {
  const module = kmuBasisPack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates (Substanz-Tiefe)', () => {
    const processes = module.processTemplates ?? [];
    expect(processes.length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    const deps = module.dependencyTemplates ?? [];
    expect(deps.length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates', () => {
    const scenarios = module.scenarioTemplates ?? [];
    expect(scenarios.length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    const exercises = module.exerciseTemplates ?? [];
    expect(exercises.length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben Mittelweg-Verteilung 6 kritisch / 3 hoch / 1 mittel', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBe(6);
    expect(hoch).toBe(3);
    expect(mittel).toBe(1);
  });

  it('Bestands-IDs (alle 12) bleiben erhalten — keine Migration', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    // 3 Bestand-Prozesse:
    expect(processIds.has('kmu_proc_buchhaltung')).toBe(true);
    expect(processIds.has('kmu_proc_kunden_service')).toBe(true);
    expect(processIds.has('kmu_proc_lohnabrechnung')).toBe(true);
    // 4 Bestand-Deps:
    expect(depIds.has('kmu_dep_msp_mssp')).toBe(true);
    expect(depIds.has('kmu_dep_cloud_provider')).toBe(true);
    expect(depIds.has('kmu_dep_bank')).toBe(true);
    expect(depIds.has('kmu_dep_grosskunde')).toBe(true);
    // 3 Bestand-Szenarien:
    expect(scnIds.has('kmu_scn_ransomware_msp')).toBe(true);
    expect(scnIds.has('kmu_scn_schluesselperson_ausfall')).toBe(true);
    expect(scnIds.has('kmu_scn_business_email_compromise')).toBe(true);
    // 2 Bestand-Übungen:
    expect(exIds.has('kmu_ex_ransomware_msp')).toBe(true);
    expect(exIds.has('kmu_ex_schluesselperson_ausfall')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedProcessTemplateIds ?? []) {
        if (!processIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked process "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle scenarioTemplates verlinken nur auf existierende dependencyTemplate-IDs', () => {
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scenarios = module.scenarioTemplates ?? [];
    const orphans: string[] = [];
    for (const scenario of scenarios) {
      for (const linkedId of scenario.linkedDependencyTemplateIds ?? []) {
        if (!depIds.has(linkedId)) {
          orphans.push(`scenario "${scenario.id}" linked dependency "${linkedId}"`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('alle exerciseTemplates verlinken auf existierende scenarioTemplate-IDs', () => {
    const scenarioIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exercises = module.exerciseTemplates ?? [];
    const orphans: string[] = [];
    for (const exercise of exercises) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung (Verkettungstiefe)', () => {
    const scenarios = module.scenarioTemplates ?? [];
    for (const scenario of scenarios) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('exerciseTemplates haben gemischte Kadenzen', () => {
    const exercises = module.exerciseTemplates ?? [];
    const cadenceSet = new Set(exercises.map((e) => e.cadenceMonths));
    expect(cadenceSet.size).toBeGreaterThanOrEqual(2);
  });

  it('exerciseTemplates haben gemischte Übungs-Typen', () => {
    const exercises = module.exerciseTemplates ?? [];
    const typeSet = new Set(exercises.map((e) => e.exerciseType));
    // KMU-Pack: tabletop + alarm (CEO-Fraud-Funktionstest) sind Mindeststandard
    expect(typeSet.size).toBeGreaterThanOrEqual(2);
  });

  it('Querschnittlichkeits-Verifikation: kmu_proc_kerngeschaeft ist branchenneutral formuliert', () => {
    const kerngeschaeft = (module.processTemplates ?? []).find((p) => p.id === 'kmu_proc_kerngeschaeft');
    expect(kerngeschaeft).toBeDefined();
    expect(kerngeschaeft!.title).toMatch(/branchenneutral/i);
    // Notes erwähnen mehrere Branchen-Beispiele
    expect(kerngeschaeft!.notes).toMatch(/Maschinenbau/i);
    expect(kerngeschaeft!.notes).toMatch(/Beratung/i);
    expect(kerngeschaeft!.notes).toMatch(/Software-Entwicklung|IT-H[äa]user/i);
  });

  it('Generationenwechsel-Triade-Verifikation: Senior 76 / Junior 41 / Buchhalterin 22 in Schlüsselperson-Szenario', () => {
    const sp = (module.scenarioTemplates ?? []).find((s) => s.id === 'kmu_scn_schluesselperson_ausfall');
    expect(sp).toBeDefined();
    expect(sp!.description).toMatch(/76/);
    expect(sp!.description).toMatch(/41/);
    expect(sp!.description).toMatch(/22/);
    expect(sp!.description).toMatch(/Senior/i);
    expect(sp!.description).toMatch(/Junior/i);
    expect(sp!.description).toMatch(/Buchhalterin/i);
  });

  it('NIS2-Marke-Verifikation: Großkunden-Audit-Szenario mit Investitions-Bandbreite 50-200 TEUR + Folgekosten', () => {
    const audit = (module.scenarioTemplates ?? []).find((s) => s.id === 'kmu_scn_grosskunden_audit');
    expect(audit).toBeDefined();
    expect(audit!.description).toMatch(/NIS2/);
    expect(audit!.playbook).toMatch(/50-200/);
    expect(audit!.playbook).toMatch(/20-50/);
  });

  it('Schadens-Bandbreiten-Verifikation: Liquiditäts-Krise-Szenario nennt drei Skalen', () => {
    const liq = (module.scenarioTemplates ?? []).find((s) => s.id === 'kmu_scn_liquiditaets_krise');
    expect(liq).toBeDefined();
    // Drei Skalen: typisch (100-500 TEUR), schwer (1-2 Mio), Worst-Case (5 Mio)
    expect(liq!.description).toMatch(/100-500/);
    expect(liq!.description).toMatch(/1-2 Mio|1\.67 Mio|1,67 Mio/);
    expect(liq!.description).toMatch(/5 Mio/);
  });

  it('Cloud-Provider-Schärfung: kmu_dep_cloud_provider ist auf kritisch hochgestuft', () => {
    const cloud = (module.dependencyTemplates ?? []).find((d) => d.id === 'kmu_dep_cloud_provider');
    expect(cloud).toBeDefined();
    expect(cloud!.criticality).toBe('kritisch');
    expect(cloud!.singlePointOfFailure).toBe(false);
  });

  it('Drei separate Cloud-bezogene Szenarien (Ransomware-MSP, Cloud-Outage, Phishing-Welle)', () => {
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    expect(scnIds.has('kmu_scn_ransomware_msp')).toBe(true);
    expect(scnIds.has('kmu_scn_cloud_outage')).toBe(true);
    expect(scnIds.has('kmu_scn_phishing_welle')).toBe(true);
  });

  it('MSP-Doppel-Rolle: kmu_proc_it ownerRole als "IT-Verantwortlicher / MSP"', () => {
    const it = (module.processTemplates ?? []).find((p) => p.id === 'kmu_proc_it');
    expect(it).toBeDefined();
    expect(it!.ownerRole).toMatch(/IT-Verantwortlicher.*MSP|MSP.*IT-Verantwortlicher/);
    expect(it!.notes).toMatch(/MSP-Verstrickung|kmu_dep_msp_mssp|kmu_scn_ransomware_msp/);
  });
});
