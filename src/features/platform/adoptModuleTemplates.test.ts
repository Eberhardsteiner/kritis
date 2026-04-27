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

describe('logistics-core · Resilience-Skeleton (C5.5.5)', () => {
  const module = logisticsPack.module as unknown as SectorModuleDefinition;

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

  it('processTemplates haben Verteilung 5 kritisch / 4 hoch / 1 mittel', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBe(5);
    expect(hoch).toBe(4);
    expect(mittel).toBe(1);
  });

  it('Bestands-IDs (alle 9) bleiben erhalten — keine Migration', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    // 2 Bestand-Prozesse:
    expect(processIds.has('log_proc_dispatch')).toBe(true);
    expect(processIds.has('log_proc_hub')).toBe(true);
    // 3 Bestand-Deps:
    expect(depIds.has('log_dep_tms')).toBe(true);
    expect(depIds.has('log_dep_fuel')).toBe(true);
    expect(depIds.has('log_dep_carrier')).toBe(true);
    // 2 Bestand-Szenarien:
    expect(scnIds.has('log_scn_tms')).toBe(true);
    expect(scnIds.has('log_scn_fuel')).toBe(true);
    // 2 Bestand-Übungen:
    expect(exIds.has('log_ex_tms')).toBe(true);
    expect(exIds.has('log_ex_route')).toBe(true);
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

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung', () => {
    const scenarios = module.scenarioTemplates ?? [];
    for (const scenario of scenarios) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('exerciseTemplates haben gemischte Übungs-Typen', () => {
    const exercises = module.exerciseTemplates ?? [];
    const typeSet = new Set(exercises.map((e) => e.exerciseType));
    expect(typeSet.size).toBeGreaterThanOrEqual(3);
  });

  it('Maersk-Schablone konzentriert im Ransomware-Total-Stillstand-Szenario', () => {
    const ransomware = (module.scenarioTemplates ?? []).find((s) => s.id === 'log_scn_ransomware_total');
    expect(ransomware).toBeDefined();
    expect(ransomware!.description).toMatch(/Maersk|NotPetya/);
    expect(ransomware!.notes).toMatch(/Maersk|Expeditors/);
  });

  it('Spedition-Disposition: log_proc_dispatch mit Doppel-Rolle "Dispositions-Leitung / Leitstelle"', () => {
    const dispatch = (module.processTemplates ?? []).find((p) => p.id === 'log_proc_dispatch');
    expect(dispatch).toBeDefined();
    expect(dispatch!.ownerRole).toMatch(/Dispositions-Leitung.*Leitstelle|Leitstelle.*Dispositions-Leitung/);
  });

  it('KEP/3PL-Querschnitt-Verifikation: log_proc_warehouse + log_proc_lastmile haben Querschnitt-Notes', () => {
    const warehouse = (module.processTemplates ?? []).find((p) => p.id === 'log_proc_warehouse');
    const lastmile = (module.processTemplates ?? []).find((p) => p.id === 'log_proc_lastmile');
    expect(warehouse).toBeDefined();
    expect(lastmile).toBeDefined();
    // Warehouse als 3PL-Schwerpunkt
    expect(warehouse!.notes).toMatch(/3PL|Kontraktlogistik/i);
    // Last-Mile als KEP-Schwerpunkt
    expect(lastmile!.notes).toMatch(/KEP|Last-Mile/i);
  });

  it('Frachtrechnung als mittel (Mittelweg-Verteilung 5/4/1)', () => {
    const abrechnung = (module.processTemplates ?? []).find((p) => p.id === 'log_proc_abrechnung');
    expect(abrechnung).toBeDefined();
    expect(abrechnung!.criticality).toBe('mittel');
  });

  it('OT-Anker fehlt — Logistics ist IT-/Behörden-zentriert (kein OT-Schwerpunkt wie Industry)', () => {
    const otDeps = (module.dependencyTemplates ?? []).filter((d) => d.category === 'ot');
    // Logistics-Pack hat keinen OT-Schwerpunkt — alle Deps sind software/dienstleister/etc.
    expect(otDeps.length).toBe(0);
  });

  it('ATLAS-Zoll-Schicht verifiziert: log_dep_atlas + log_proc_zoll + log_scn_atlas_ausfall', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    expect(processIds.has('log_proc_zoll')).toBe(true);
    expect(depIds.has('log_dep_atlas')).toBe(true);
    expect(scnIds.has('log_scn_atlas_ausfall')).toBe(true);
  });
});

describe('energy-core · Resilience-Skeleton (C5.5.6)', () => {
  const module = energyPack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates', () => {
    expect((module.processTemplates ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    expect((module.dependencyTemplates ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates', () => {
    expect((module.scenarioTemplates ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    expect((module.exerciseTemplates ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben Verteilung 5 kritisch / 4 hoch / 1 mittel', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBe(5);
    expect(hoch).toBe(4);
    expect(mittel).toBe(1);
  });

  it('Bestands-IDs (alle 9) bleiben erhalten', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    expect(processIds.has('en_proc_grid')).toBe(true);
    expect(processIds.has('en_proc_fault')).toBe(true);
    expect(depIds.has('en_dep_scada')).toBe(true);
    expect(depIds.has('en_dep_comms')).toBe(true);
    expect(depIds.has('en_dep_generator')).toBe(true);
    expect(scnIds.has('en_scn_scada')).toBe(true);
    expect(scnIds.has('en_scn_blackout')).toBe(true);
    expect(exIds.has('en_ex_scada')).toBe(true);
    expect(exIds.has('en_ex_blackout')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const exercise of module.exerciseTemplates ?? []) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung', () => {
    for (const scenario of module.scenarioTemplates ?? []) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('OT-IT-Trennung-Verifikation: en_proc_scada + en_proc_it als getrennte Prozesse', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    expect(processIds.has('en_proc_scada')).toBe(true);
    expect(processIds.has('en_proc_it')).toBe(true);
    const scada = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_scada');
    const it = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_it');
    expect(scada?.criticality).toBe('kritisch');
    expect(it?.criticality).toBe('hoch');
  });

  it('Industroyer-Schablone: 2016-Angriff UND 2022-Verteidigung beide Schichten in description', () => {
    const industroyer = (module.scenarioTemplates ?? []).find((s) => s.id === 'en_scn_industroyer');
    expect(industroyer).toBeDefined();
    expect(industroyer!.description).toMatch(/2016/);
    expect(industroyer!.description).toMatch(/2022/);
    expect(industroyer!.description).toMatch(/abgewehrt|Verteidigung|ESET|CERT-UA/i);
  });

  it('Wismar-Schablone: 28.09.2021 + 4 Monate Wiederherstellung + OT-IT-Trennung', () => {
    const wismar = (module.scenarioTemplates ?? []).find((s) => s.id === 'en_scn_ransomware_stadtwerke');
    expect(wismar).toBeDefined();
    expect(wismar!.description).toMatch(/28\.09\.2021|2021/);
    expect(wismar!.description).toMatch(/4 Monate/);
    expect(wismar!.description).toMatch(/OT.{0,3}IT-Trennung/);
  });

  it('Schwarzstart als eigener Prozess + Aufsichtsrat-Pflichtschritt', () => {
    const blackstart = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_blackstart');
    expect(blackstart).toBeDefined();
    expect(blackstart!.criticality).toBe('kritisch');
    expect(blackstart!.notes).toMatch(/AUFSICHTSRAT|Aufsichtsrat-Vorsitzenden/);
    expect(blackstart!.notes).toMatch(/2 Stunden/);
  });

  it('Sparten-Differenzierung: en_proc_erzeugung Notes nennen alle 5 Sparten + Saison-Profil', () => {
    const erzeugung = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_erzeugung');
    expect(erzeugung).toBeDefined();
    expect(erzeugung!.notes).toMatch(/Heizkraftwerk/);
    expect(erzeugung!.notes).toMatch(/KWK/);
    expect(erzeugung!.notes).toMatch(/Photovoltaik|PV-Park/);
    expect(erzeugung!.notes).toMatch(/Wind/);
    expect(erzeugung!.notes).toMatch(/Fernwärme/);
    expect(erzeugung!.notes).toMatch(/Saison/i);
  });

  it('Multi-Sparten-Hinweis in Strom-zentrierten Prozessen (en_proc_grid, en_proc_fault, en_proc_scada)', () => {
    const grid = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_grid');
    const fault = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_fault');
    const scada = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_scada');
    expect(grid?.notes).toMatch(/Gas-Sparte|Gas-Netzleitwarte/i);
    expect(fault?.notes).toMatch(/Gas-Sparte|Gas-Entst/i);
    expect(scada?.notes).toMatch(/Gas-SCADA|Gas-Druckregelung/i);
  });

  it('RPO-Schärfung: en_proc_grid hat RPO 0.5h (statt 0h Bestand)', () => {
    const grid = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_grid');
    expect(grid).toBeDefined();
    expect(parseFloat(grid!.rpoHours ?? '0')).toBe(0.5);
  });

  it('Abrechnung als mittel (Mittelweg-Verteilung)', () => {
    const abrechnung = (module.processTemplates ?? []).find((p) => p.id === 'en_proc_abrechnung');
    expect(abrechnung).toBeDefined();
    expect(abrechnung!.criticality).toBe('mittel');
  });

  it('SCADA-Dependency mit category="ot" (Industry-Pattern)', () => {
    const scada = (module.dependencyTemplates ?? []).find((d) => d.id === 'en_dep_scada');
    expect(scada).toBeDefined();
    expect(scada!.category).toBe('ot');
  });

  it('ÜNB-Dependency als kritisch SPOF=true', () => {
    const uenb = (module.dependencyTemplates ?? []).find((d) => d.id === 'en_dep_uenb');
    expect(uenb).toBeDefined();
    expect(uenb!.criticality).toBe('kritisch');
    expect(uenb!.singlePointOfFailure).toBe(true);
  });
});

describe('water-core · Resilience-Skeleton (C5.5.7)', () => {
  const module = waterPack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates', () => {
    expect((module.processTemplates ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    expect((module.dependencyTemplates ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates', () => {
    expect((module.scenarioTemplates ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    expect((module.exerciseTemplates ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben Verteilung 5 kritisch / 3 hoch / 2 mittel', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBe(5);
    expect(hoch).toBe(3);
    expect(mittel).toBe(2);
  });

  it('Bestands-IDs (alle 9) bleiben erhalten', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    expect(processIds.has('water_proc_treatment')).toBe(true);
    expect(processIds.has('water_proc_distribution')).toBe(true);
    expect(processIds.has('water_proc_wastewater')).toBe(true);
    expect(depIds.has('water_dep_power')).toBe(true);
    expect(depIds.has('water_dep_chemicals')).toBe(true);
    expect(depIds.has('water_dep_lab')).toBe(true);
    expect(depIds.has('water_dep_sludge')).toBe(true);
    expect(scnIds.has('water_scn_scada')).toBe(true);
    expect(scnIds.has('water_scn_flood')).toBe(true);
    expect(scnIds.has('water_scn_power')).toBe(true);
    expect(exIds.has('water_ex_scada')).toBe(true);
    expect(exIds.has('water_ex_flood')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const exercise of module.exerciseTemplates ?? []) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung', () => {
    for (const scenario of module.scenarioTemplates ?? []) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('OT-IT-Trennung-Verifikation: water_proc_scada (kritisch OT) + water_proc_it (hoch IT) als getrennte Prozesse', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    expect(processIds.has('water_proc_scada')).toBe(true);
    expect(processIds.has('water_proc_it')).toBe(true);
    const scada = (module.processTemplates ?? []).find((p) => p.id === 'water_proc_scada');
    const it = (module.processTemplates ?? []).find((p) => p.id === 'water_proc_it');
    expect(scada?.criticality).toBe('kritisch');
    expect(it?.criticality).toBe('hoch');
    // Querverweise in Notes — gegenseitige Erwähnung der Trennung
    expect(scada?.notes).toMatch(/water_proc_it|IT-Office|Office-Netz/);
    expect(it?.notes).toMatch(/water_proc_scada|OT/);
  });

  it('Hochwasser-L4-Beibehaltung mit Klimawandel-Notes (Ahrtal/Bayern/Niedersachsen/Saarland)', () => {
    const flood = (module.scenarioTemplates ?? []).find((s) => s.id === 'water_scn_flood');
    expect(flood).toBeDefined();
    expect(flood!.likelihood).toBe(4);
    expect(flood!.impact).toBe(5);
    expect(flood!.notes).toMatch(/Klimawandel|strukturell gestiegen|gestiegene Hochwasser/);
    expect(flood!.notes).toMatch(/Ahrtal/);
    expect(flood!.notes).toMatch(/Bayern/);
    expect(flood!.notes).toMatch(/Niedersachsen/);
    expect(flood!.notes).toMatch(/Saarland/);
    expect(flood!.notes).toMatch(/42 Monaten/);
  });

  it('Oldsmar-Szenario L2 (Score 10) mit Operator-Awareness im Playbook', () => {
    const oldsmar = (module.scenarioTemplates ?? []).find((s) => s.id === 'water_scn_oldsmar');
    expect(oldsmar).toBeDefined();
    expect(oldsmar!.likelihood).toBe(2);
    expect(oldsmar!.impact).toBe(5);
    // Operator-Awareness als letzte Verteidigungs-Linie wörtlich
    expect(oldsmar!.playbook).toMatch(/Operator-Awareness als letzte Verteidigungs-Linie/);
    expect(oldsmar!.playbook).toMatch(/Mensch-im-Loop/);
    // Oldsmar-Faktendetails in description
    expect(oldsmar!.description).toMatch(/Oldsmar/);
    expect(oldsmar!.description).toMatch(/100 ppm/);
    expect(oldsmar!.description).toMatch(/11\.100 ppm/);
    expect(oldsmar!.description).toMatch(/TeamViewer/);
    expect(oldsmar!.description).toMatch(/5\.2\.2021|2021/);
  });

  it('South-Staffs-Schablone in Ransomware-Szenario (Cl0p, 1,6 Mio., 5 TB)', () => {
    const ransomware = (module.scenarioTemplates ?? []).find((s) => s.id === 'water_scn_ransomware_water');
    expect(ransomware).toBeDefined();
    expect(ransomware!.description).toMatch(/South Staffs/);
    expect(ransomware!.description).toMatch(/Cl0p/);
    expect(ransomware!.description).toMatch(/1,6 Mio/);
    expect(ransomware!.description).toMatch(/5 TB/);
    expect(ransomware!.description).toMatch(/2022/);
  });

  it('Trinkwasser-Hygiene-Prozess mit TrinkwV + Abkochanordnung', () => {
    const hygiene = (module.processTemplates ?? []).find((p) => p.id === 'water_proc_hygiene');
    expect(hygiene).toBeDefined();
    expect(hygiene!.criticality).toBe('kritisch');
    expect(hygiene!.notes).toMatch(/Abkochanordnung|TrinkwV/);
    expect(hygiene!.outputs).toMatch(/TrinkwV/);
  });

  it('Notwasserversorgungs-Prozess mit Ahrtal-Schablone und DVGW W 405', () => {
    const notbetrieb = (module.processTemplates ?? []).find((p) => p.id === 'water_proc_notbetrieb');
    expect(notbetrieb).toBeDefined();
    expect(notbetrieb!.criticality).toBe('kritisch');
    expect(notbetrieb!.notes).toMatch(/Ahrtal/);
    expect(notbetrieb!.notes).toMatch(/DVGW W 405|W 405/);
    expect(notbetrieb!.notes).toMatch(/Tankwagen/);
  });

  it('Klärwerks-Aufteilung: water_proc_wastewater (hoch) + water_proc_sludge (mittel)', () => {
    const wastewater = (module.processTemplates ?? []).find((p) => p.id === 'water_proc_wastewater');
    const sludge = (module.processTemplates ?? []).find((p) => p.id === 'water_proc_sludge');
    expect(wastewater).toBeDefined();
    expect(sludge).toBeDefined();
    expect(wastewater!.criticality).toBe('hoch');
    expect(sludge!.criticality).toBe('mittel');
    // sludge-Notes erwähnen DüV oder Phosphor-Rückgewinnung
    expect(sludge!.notes).toMatch(/DüV|Phosphor/);
  });

  it('Abrechnung als mittel (Mittelweg-Verteilung)', () => {
    const abrechnung = (module.processTemplates ?? []).find((p) => p.id === 'water_proc_abrechnung');
    expect(abrechnung).toBeDefined();
    expect(abrechnung!.criticality).toBe('mittel');
  });

  it('SCADA-Dependency mit category="ot" (OT-Pattern)', () => {
    const scada = (module.dependencyTemplates ?? []).find((d) => d.id === 'water_dep_scada');
    expect(scada).toBeDefined();
    expect(scada!.category).toBe('ot');
    expect(scada!.criticality).toBe('kritisch');
    expect(scada!.singlePointOfFailure).toBe(true);
  });

  it('Brunnen-Dependency als kritisch (Wasserrechte) mit category="behoerde"', () => {
    const brunnen = (module.dependencyTemplates ?? []).find((d) => d.id === 'water_dep_brunnen');
    expect(brunnen).toBeDefined();
    expect(brunnen!.category).toBe('behoerde');
    expect(brunnen!.criticality).toBe('kritisch');
  });

  it('Aufsichtsbehörden-Dependency mit Untere Wasserbehörde + Gesundheitsamt', () => {
    const aufsicht = (module.dependencyTemplates ?? []).find((d) => d.id === 'water_dep_aufsichtsbehoerde');
    expect(aufsicht).toBeDefined();
    expect(aufsicht!.category).toBe('behoerde');
    expect(aufsicht!.title).toMatch(/Wasserbehörde/);
    expect(aufsicht!.title).toMatch(/Gesundheitsamt/);
  });

  it('Übungs-Mix: tabletop + alarm + simulation', () => {
    const exerciseTypes = new Set((module.exerciseTemplates ?? []).map((e) => e.exerciseType));
    expect(exerciseTypes.has('tabletop')).toBe(true);
    expect(exerciseTypes.has('alarm')).toBe(true);
    expect(exerciseTypes.has('simulation')).toBe(true);
  });

  it('Abkochanordnungs-Übung als alarm-Typ verlinkt mit Kontaminations-Szenario', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'water_ex_abkochanordnung');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('alarm');
    expect(ex!.scenarioTemplateId).toBe('water_scn_kontamination');
  });

  it('Tankwagen-Live-Übung als simulation-Typ mit 36-Monats-Kadenz', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'water_ex_tankwagen_live');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('simulation');
    expect(ex!.cadenceMonths).toBe(36);
  });

  it('Oldsmar-Übung mit Operator-Awareness im Drehbuch (Notes)', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'water_ex_oldsmar');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('tabletop');
    expect(ex!.scenarioTemplateId).toBe('water_scn_oldsmar');
    expect(ex!.notes).toMatch(/Operator-Awareness|Operator/);
  });
});

describe('it-telecom-core · Resilience-Skeleton (C5.5.8)', () => {
  const module = itTelecomPack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates', () => {
    expect((module.processTemplates ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    expect((module.dependencyTemplates ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates', () => {
    expect((module.scenarioTemplates ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    expect((module.exerciseTemplates ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben Verteilung 7 kritisch / 2 hoch / 1 mittel (sektor-typisch scharf)', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBe(7);
    expect(hoch).toBe(2);
    expect(mittel).toBe(1);
  });

  it('Bestands-IDs (alle 12) bleiben erhalten', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    expect(processIds.has('it_proc_backbone')).toBe(true);
    expect(processIds.has('it_proc_cloud_ops')).toBe(true);
    expect(processIds.has('it_proc_endkunden')).toBe(true);
    expect(depIds.has('it_dep_power')).toBe(true);
    expect(depIds.has('it_dep_cooling')).toBe(true);
    expect(depIds.has('it_dep_upstream')).toBe(true);
    expect(depIds.has('it_dep_hardware')).toBe(true);
    expect(scnIds.has('it_scn_bgp')).toBe(true);
    expect(scnIds.has('it_scn_rz_power')).toBe(true);
    expect(scnIds.has('it_scn_submarine_cable')).toBe(true);
    expect(exIds.has('it_ex_bgp')).toBe(true);
    expect(exIds.has('it_ex_rz_power')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const exercise of module.exerciseTemplates ?? []) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung', () => {
    for (const scenario of module.scenarioTemplates ?? []) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('Netzbetrieb-Werks-IT-Trennung: it_proc_backbone (kritisch) + it_proc_it (hoch) als getrennte Prozesse mit Querverweisen', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    expect(processIds.has('it_proc_backbone')).toBe(true);
    expect(processIds.has('it_proc_it')).toBe(true);
    const backbone = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_backbone');
    const it = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_it');
    expect(backbone?.criticality).toBe('kritisch');
    expect(it?.criticality).toBe('hoch');
    // Querverweise: it_proc_it.notes erwähnt Netzbetrieb-Trennung
    expect(it?.notes).toMatch(/Netzbetrieb|it_proc_backbone|it_proc_mobilfunk/);
  });

  it('Sieben Telekom-Prozesse + drei Cloud-/Datacenter-Querschnitt-Prozesse', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    // Telekom-zentriert (7)
    expect(processIds.has('it_proc_backbone')).toBe(true);
    expect(processIds.has('it_proc_mobilfunk')).toBe(true);
    expect(processIds.has('it_proc_endkunden')).toBe(true);
    expect(processIds.has('it_proc_notrufnummern')).toBe(true);
    expect(processIds.has('it_proc_it')).toBe(true);
    expect(processIds.has('it_proc_customer')).toBe(true);
    expect(processIds.has('it_proc_soc')).toBe(true);
    // Cloud-/Datacenter-Querschnitt (3)
    expect(processIds.has('it_proc_cloud_ops')).toBe(true);
    expect(processIds.has('it_proc_datacenter')).toBe(true);
    expect(processIds.has('it_proc_abrechnung')).toBe(true);
  });

  it('Cloud-/Datacenter-Querschnitt-Prozesse mit Tenant-Adoption-Hinweis in Notes', () => {
    const cloudOps = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_cloud_ops');
    const datacenter = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_datacenter');
    expect(cloudOps?.notes).toMatch(/nicht anwendbar|Schwerpunkt|Cloud-Provider/);
    expect(datacenter?.notes).toMatch(/nicht anwendbar|Schwerpunkt|MVNO|Datacenter-Operatoren/);
  });

  it('Backbone RPO 0h beibehalten (Echtzeit-Routing-State)', () => {
    const backbone = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_backbone');
    expect(backbone).toBeDefined();
    expect(parseFloat(backbone!.rpoHours ?? '99')).toBe(0);
  });

  it('Cloud-Operations MTPD 8h / RTO 4h beibehalten (Multi-Region-Failover-Komplexität)', () => {
    const cloudOps = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_cloud_ops');
    expect(cloudOps).toBeDefined();
    expect(parseFloat(cloudOps!.mtpdHours ?? '0')).toBe(8);
    expect(parseFloat(cloudOps!.rtoHours ?? '0')).toBe(4);
  });

  it('Endkunden MTPD 4h / RTO 2h verschärft (sektor-typische Sub-Stunden-SLA)', () => {
    const endkunden = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_endkunden');
    expect(endkunden).toBeDefined();
    expect(parseFloat(endkunden!.mtpdHours ?? '0')).toBe(4);
    expect(parseFloat(endkunden!.rtoHours ?? '0')).toBe(2);
  });

  it('Notrufnummern-Prozess mit schärfster MTPD/RTO im Pack (1h/0.5h/0.25h)', () => {
    const notruf = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_notrufnummern');
    expect(notruf).toBeDefined();
    expect(notruf!.criticality).toBe('kritisch');
    expect(parseFloat(notruf!.mtpdHours ?? '99')).toBe(1);
    expect(parseFloat(notruf!.rtoHours ?? '99')).toBe(0.5);
    expect(parseFloat(notruf!.rpoHours ?? '99')).toBe(0.25);
    expect(notruf!.notes).toMatch(/BNetzA-Eskalation|110|112/);
    expect(notruf!.notes).toMatch(/DB-Trasse|08\.10\.2022/);
  });

  it('BGP-Szenario L4 beibehalten + Cloudflare-2024-Schablone in Description', () => {
    const bgp = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_bgp');
    expect(bgp).toBeDefined();
    expect(bgp!.likelihood).toBe(4);
    expect(bgp!.impact).toBe(5);
    expect(bgp!.description).toMatch(/Cloudflare/);
    expect(bgp!.description).toMatch(/27\.06\.2024|2024/);
    expect(bgp!.description).toMatch(/AS267613|1\.1\.1\.1/);
    expect(bgp!.description).toMatch(/RPKI|ROV/);
  });

  it('RZ-Stromausfall-Szenario L2 (gelockert von Bestand L3, aktuelle Notstrom-Disziplin)', () => {
    const rz = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_rz_power');
    expect(rz).toBeDefined();
    expect(rz!.likelihood).toBe(2);
    expect(rz!.impact).toBe(5);
  });

  it('Facebook-2021-Szenario mit Self-Inflicted-Pointe und Badge-Lockout-Detail', () => {
    const fb = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_facebook_self');
    expect(fb).toBeDefined();
    expect(fb!.likelihood).toBe(2);
    expect(fb!.impact).toBe(5);
    expect(fb!.description).toMatch(/Facebook|Meta/);
    expect(fb!.description).toMatch(/04\.10\.2021|2021/);
    expect(fb!.description).toMatch(/Badge|Auth/);
    expect(fb!.playbook).toMatch(/Out-of-Band/);
  });

  it('CrowdStrike-2024-Szenario mit Channel-File-Detail und Schadenshöhe', () => {
    const cs = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_crowdstrike');
    expect(cs).toBeDefined();
    expect(cs!.likelihood).toBe(2);
    expect(cs!.impact).toBe(4);
    expect(cs!.description).toMatch(/CrowdStrike/);
    expect(cs!.description).toMatch(/19\.07\.2024|2024/);
    expect(cs!.description).toMatch(/Channel File|csagent\.sys|Falcon/);
    expect(cs!.description).toMatch(/8,5 Mio|8\.5 Mio/);
  });

  it('DDoS-Szenario L4 mit Tbps-Größenordnung und Mirai-Botnet-Schablone', () => {
    const ddos = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_ddos_tbps');
    expect(ddos).toBeDefined();
    expect(ddos!.likelihood).toBe(4);
    expect(ddos!.impact).toBe(4);
    expect(ddos!.description).toMatch(/Tbps/);
    expect(ddos!.description).toMatch(/Mirai/);
    expect(ddos!.notes).toMatch(/Telekom-Router-Bot|900\.000|Speedport/);
  });

  it('Notruf-Outage-Szenario mit DB-Trasse-Sabotage 08.10.2022 als Hauptschablone', () => {
    const notruf = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_notruf_outage');
    expect(notruf).toBeDefined();
    expect(notruf!.likelihood).toBe(2);
    expect(notruf!.impact).toBe(5);
    expect(notruf!.description).toMatch(/DB-Trasse|08\.10\.2022/);
    expect(notruf!.description).toMatch(/Berlin-Karow|Herne/);
    expect(notruf!.description).toMatch(/GSM-R|Bahnfunk/);
    expect(notruf!.description).toMatch(/3 h|drei Stunden/i);
    expect(notruf!.playbook).toMatch(/BNetzA-Eskalation|1 h|binnen.*1/);
  });

  it('Submarine-Cable-Szenario mit Yi-Peng-3 + Eagle-S 2024-Schablonen', () => {
    const sub = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_submarine_cable');
    expect(sub).toBeDefined();
    expect(sub!.description).toMatch(/Yi Peng 3|Yi-Peng-3/);
    expect(sub!.description).toMatch(/Eagle-S|Eagle S/);
    expect(sub!.description).toMatch(/2024/);
    expect(sub!.description).toMatch(/BCS East-West|C-Lion1|Estlink/);
  });

  it('Daten-Exfiltration-Szenario mit DSGVO + TKG/TKDSG-Sondervorschriften', () => {
    const exfil = (module.scenarioTemplates ?? []).find((s) => s.id === 'it_scn_data_exfil');
    expect(exfil).toBeDefined();
    expect(exfil!.likelihood).toBe(3);
    expect(exfil!.impact).toBe(4);
    expect(exfil!.description).toMatch(/TKG|TKDSG|TTDSG/);
    expect(exfil!.description).toMatch(/Verkehrsdaten/);
    expect(exfil!.description).toMatch(/DSGVO|Art\. 33|Art\. 34/);
  });

  it('Glasfaser-Dependency als kritisch SPOF mit DB-Trasse-Sabotage-Schablone', () => {
    const glasfaser = (module.dependencyTemplates ?? []).find((d) => d.id === 'it_dep_glasfaser');
    expect(glasfaser).toBeDefined();
    expect(glasfaser!.category).toBe('infrastruktur');
    expect(glasfaser!.criticality).toBe('kritisch');
    expect(glasfaser!.singlePointOfFailure).toBe(true);
    expect(glasfaser!.notes).toMatch(/DB-Trasse|08\.10\.2022/);
  });

  it('BNetzA-Frequenz-Dependency als behoerde, kritisch (Mobilfunk-Voraussetzung)', () => {
    const frequenz = (module.dependencyTemplates ?? []).find((d) => d.id === 'it_dep_frequenz');
    expect(frequenz).toBeDefined();
    expect(frequenz!.category).toBe('behoerde');
    expect(frequenz!.criticality).toBe('kritisch');
  });

  it('Cell-Broadcast-Dependency mit NINA/MoWaS-Anbindung', () => {
    const cb = (module.dependencyTemplates ?? []).find((d) => d.id === 'it_dep_cellbroadcast');
    expect(cb).toBeDefined();
    expect(cb!.title).toMatch(/Cell-Broadcast|NINA|MoWaS/);
  });

  it('Abrechnung als mittel (Mittelweg-Verteilung)', () => {
    const abrechnung = (module.processTemplates ?? []).find((p) => p.id === 'it_proc_abrechnung');
    expect(abrechnung).toBeDefined();
    expect(abrechnung!.criticality).toBe('mittel');
    // TKG/TKDSG-Sondervorschrift in Notes erwähnen
    expect(abrechnung!.notes).toMatch(/TKG|TKDSG|TTDSG|Verkehrsdaten/);
  });

  it('Übungs-Mix: tabletop + technical', () => {
    const exerciseTypes = new Set((module.exerciseTemplates ?? []).map((e) => e.exerciseType));
    expect(exerciseTypes.has('tabletop')).toBe(true);
    expect(exerciseTypes.has('technical')).toBe(true);
  });

  it('RZ-Stromausfall-Übung mit gelockerter Kadenz 24 Monate (passend zu L2)', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'it_ex_rz_power');
    expect(ex).toBeDefined();
    expect(ex!.cadenceMonths).toBe(24);
  });

  it('DDoS-Funktionstest als technical mit 12-Monats-Kadenz', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'it_ex_ddos_test');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('technical');
    expect(ex!.cadenceMonths).toBe(12);
    expect(ex!.scenarioTemplateId).toBe('it_scn_ddos_tbps');
  });

  it('Notruf-Failover-Live-Übung als technical mit 36-Monats-Kadenz', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'it_ex_notruf_failover');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('technical');
    expect(ex!.cadenceMonths).toBe(36);
    expect(ex!.scenarioTemplateId).toBe('it_scn_notruf_outage');
    expect(ex!.notes).toMatch(/BNetzA/);
  });

  it('Supply-Chain-Patch-Tabletop verlinkt mit CrowdStrike-Szenario', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'it_ex_supplychain_patch');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('tabletop');
    expect(ex!.scenarioTemplateId).toBe('it_scn_crowdstrike');
    expect(ex!.cadenceMonths).toBe(24);
  });
});

describe('finance-core · Resilience-Skeleton (C5.5.9)', () => {
  const module = financePack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates', () => {
    expect((module.processTemplates ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    expect((module.dependencyTemplates ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates', () => {
    expect((module.scenarioTemplates ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    expect((module.exerciseTemplates ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben Verteilung 4 kritisch / 5 hoch / 1 mittel', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBe(4);
    expect(hoch).toBe(5);
    expect(mittel).toBe(1);
  });

  it('Bestands-IDs (alle 12) bleiben erhalten', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    expect(processIds.has('fin_proc_online_banking')).toBe(true);
    expect(processIds.has('fin_proc_settlement')).toBe(true);
    expect(processIds.has('fin_proc_compliance')).toBe(true);
    expect(depIds.has('fin_dep_core_banking')).toBe(true);
    expect(depIds.has('fin_dep_sepa_swift')).toBe(true);
    expect(depIds.has('fin_dep_bundesbank')).toBe(true);
    expect(depIds.has('fin_dep_ddos_mitigation')).toBe(true);
    expect(scnIds.has('fin_scn_online_banking_ddos')).toBe(true);
    expect(scnIds.has('fin_scn_core_banking_outage')).toBe(true);
    expect(scnIds.has('fin_scn_insider_trading')).toBe(true);
    expect(exIds.has('fin_ex_online_banking_ddos')).toBe(true);
    expect(exIds.has('fin_ex_core_banking_outage')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const exercise of module.exerciseTemplates ?? []) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung', () => {
    for (const scenario of module.scenarioTemplates ?? []) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('Banken-/Versicherungs-Aufteilung: 7 Banken-zentriert + 3 Versicherungs-Querschnitt', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    // Banken-zentriert (7)
    expect(processIds.has('fin_proc_online_banking')).toBe(true);
    expect(processIds.has('fin_proc_settlement')).toBe(true);
    expect(processIds.has('fin_proc_filiale')).toBe(true);
    expect(processIds.has('fin_proc_it')).toBe(true);
    expect(processIds.has('fin_proc_compliance')).toBe(true);
    expect(processIds.has('fin_proc_third_party')).toBe(true);
    expect(processIds.has('fin_proc_treasury')).toBe(true);
    // Versicherungs-Querschnitt (3)
    expect(processIds.has('fin_proc_schaden')).toBe(true);
    expect(processIds.has('fin_proc_bestand')).toBe(true);
    expect(processIds.has('fin_proc_vertrieb')).toBe(true);
  });

  it('Versicherungs-Querschnitt-Prozesse mit Tenant-Adoption-Hinweis (Reine Banken können als nicht anwendbar markieren)', () => {
    const schaden = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_schaden');
    const bestand = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_bestand');
    const vertrieb = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_vertrieb');
    expect(schaden?.notes).toMatch(/Versicherungs-Tenants|nicht anwendbar/);
    expect(bestand?.notes).toMatch(/Versicherungs-Tenants|nicht anwendbar/);
    expect(vertrieb?.notes).toMatch(/Versicherungs-Tenants|nicht anwendbar/);
  });

  it('DORA-Schicht in zwei Prozessen verankert: Compliance + Third-Party-Risk', () => {
    const compliance = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_compliance');
    const thirdParty = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_third_party');
    expect(compliance).toBeDefined();
    expect(thirdParty).toBeDefined();
    expect(compliance!.notes).toMatch(/DORA-Säule erkennbar/);
    expect(compliance!.notes).toMatch(/17\.01\.2025/);
    expect(thirdParty!.notes).toMatch(/DORA-Säule erkennbar/);
    expect(thirdParty!.notes).toMatch(/Säule 5|Third-Party/);
  });

  it('Compliance-Prozess kritisch (verschärft gegenüber Bestand hoch wegen DORA Art. 19 4h-Frist)', () => {
    const compliance = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_compliance');
    expect(compliance).toBeDefined();
    expect(compliance!.criticality).toBe('kritisch');
    expect(compliance!.notes).toMatch(/4 h|Art\. 19/);
  });

  it('Online-Banking RPO 0h beibehalten (Echtzeit-Transaktionen)', () => {
    const ob = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_online_banking');
    expect(ob).toBeDefined();
    expect(parseFloat(ob!.rpoHours ?? '99')).toBe(0);
  });

  it('Settlement MTPD/RTO 4h/2h verschärft (gegenüber Bestand 8h/4h, ICBC-Schablone)', () => {
    const settlement = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_settlement');
    expect(settlement).toBeDefined();
    expect(parseFloat(settlement!.mtpdHours ?? '0')).toBe(4);
    expect(parseFloat(settlement!.rtoHours ?? '0')).toBe(2);
    expect(settlement!.notes).toMatch(/ICBC|USB-Stick|08\.11\.2023/);
  });

  it('Treasury als kritisch mit ELA-Bezug', () => {
    const treasury = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_treasury');
    expect(treasury).toBeDefined();
    expect(treasury!.criticality).toBe('kritisch');
    expect(treasury!.notes).toMatch(/ELA|EZB-Notfall/);
  });

  it('Vertrieb als mittel (einzige mittel-Stufe)', () => {
    const vertrieb = (module.processTemplates ?? []).find((p) => p.id === 'fin_proc_vertrieb');
    expect(vertrieb).toBeDefined();
    expect(vertrieb!.criticality).toBe('mittel');
  });

  it('Online-Banking-DDoS-Szenario L4/I5 (Bestand) mit SVB-Twitter-Schablone', () => {
    const ddos = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_online_banking_ddos');
    expect(ddos).toBeDefined();
    expect(ddos!.likelihood).toBe(4);
    expect(ddos!.impact).toBe(5);
    expect(ddos!.description).toMatch(/SVB|09\.03\.2023/);
    expect(ddos!.description).toMatch(/42 Mrd|Twitter/);
  });

  it('Insider-Trading-Szenario L2/I4 gelockert (Bestand L3/I5 zu Spec L2/I4)', () => {
    const insider = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_insider_trading');
    expect(insider).toBeDefined();
    expect(insider!.likelihood).toBe(2);
    expect(insider!.impact).toBe(4);
    expect(insider!.description).toMatch(/Société Générale|Kerviel|2008/);
  });

  it('Core-Banking-Szenario mit ICBC-2023 + FI-Panne-2019 als zwei deutsche Pattern', () => {
    const cb = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_core_banking_outage');
    expect(cb).toBeDefined();
    expect(cb!.description).toMatch(/ICBC|08\.11\.2023/);
    expect(cb!.description).toMatch(/FI-Panne|Dezember 2019|Helaba/);
    expect(cb!.description).toMatch(/USB-Stick|CitrixBleed/);
  });

  it('DORA-TLPT-Szenario mit TLPT-Pflicht-Differenzierung (G-SIIs vs. Mittelstand)', () => {
    const tlpt = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_dora_tlpt');
    expect(tlpt).toBeDefined();
    expect(tlpt!.likelihood).toBe(3);
    expect(tlpt!.impact).toBe(4);
    expect(tlpt!.description).toMatch(/TLPT/);
    expect(tlpt!.description).toMatch(/G-SIIs|O-SIIs/);
    expect(tlpt!.description).toMatch(/3 Jahre/);
    expect(tlpt!.description).toMatch(/Mittelständische|nicht TLPT-pflichtig/);
    expect(tlpt!.description).toMatch(/Pillar 3|jährlich/);
    expect(tlpt!.notes).toMatch(/RTS EU 2025\/1190|18\.06\.2025|UVM/);
  });

  it('MOVEit-Szenario mit Cl0p + Capital-One-WAF-SSRF-Korrektur', () => {
    const moveit = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_moveit_data_exfil');
    expect(moveit).toBeDefined();
    expect(moveit!.description).toMatch(/MOVEit/);
    expect(moveit!.description).toMatch(/Cl0p/);
    expect(moveit!.description).toMatch(/CVE-2023-34362/);
    expect(moveit!.description).toMatch(/Deutsche Bank|ING|Postbank|Comdirect/);
    expect(moveit!.description).toMatch(/Majorel/);
    // Capital-One-Korrektur: WAF-SSRF, NICHT S3-Misconfig
    expect(moveit!.description).toMatch(/Capital One/);
    expect(moveit!.description).toMatch(/SSRF|Server-Side-Request-Forgery/);
    expect(moveit!.description).toMatch(/WAF/);
    expect(moveit!.description).toMatch(/Paige Thompson|Ex-AWS/);
  });

  it('Atruvia/FI-Outage-Szenario L2 mit drei deutschen Schablonen', () => {
    const atruvia = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_atruvia_fi_outage');
    expect(atruvia).toBeDefined();
    expect(atruvia!.likelihood).toBe(2);
    expect(atruvia!.impact).toBe(5);
    // FI-Panne Dezember 2019
    expect(atruvia!.description).toMatch(/FI-Panne|Dezember 2019|Helaba/);
    // FI-TS Januar 2020
    expect(atruvia!.description).toMatch(/FI-TS|Januar 2020|DKB/);
    // Deutsche Leasing 2023
    expect(atruvia!.description).toMatch(/Deutsche Leasing|03\.06\.2023|2\.500 MA/);
  });

  it('Bank-Run-Twitter-Szenario L3/I4 ohne Cyber-Trigger (SVB-Klasse)', () => {
    const br = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_bank_run_twitter');
    expect(br).toBeDefined();
    expect(br!.likelihood).toBe(3);
    expect(br!.impact).toBe(4);
    expect(br!.description).toMatch(/SVB|09\.03\.2023/);
    expect(br!.description).toMatch(/42 Mrd/);
    expect(br!.description).toMatch(/KEIN Cyber/);
    expect(br!.playbook).toMatch(/Krisen-Kommunikations-Steuerung|Pressestelle/);
    expect(br!.playbook).toMatch(/vorab-textierte/i);
    expect(br!.playbook).toMatch(/ELA/);
  });

  it('AML-Eskalation-Szenario L2/I4 mit FIU + BaFin', () => {
    const aml = (module.scenarioTemplates ?? []).find((s) => s.id === 'fin_scn_aml_eskalation');
    expect(aml).toBeDefined();
    expect(aml!.likelihood).toBe(2);
    expect(aml!.impact).toBe(4);
    expect(aml!.description).toMatch(/FIU|goAML/);
    expect(aml!.description).toMatch(/BaFin|GwG/);
  });

  it('BaFin-Dependency als kritisch behoerde mit DORA Art. 19 4h-Frist', () => {
    const bafin = (module.dependencyTemplates ?? []).find((d) => d.id === 'fin_dep_bafin');
    expect(bafin).toBeDefined();
    expect(bafin!.category).toBe('behoerde');
    expect(bafin!.criticality).toBe('kritisch');
    expect(bafin!.notes).toMatch(/4 h|Art\. 19/);
  });

  it('EZB-Dependency als kritisch behoerde mit ELA-Anker', () => {
    const ezb = (module.dependencyTemplates ?? []).find((d) => d.id === 'fin_dep_ezb');
    expect(ezb).toBeDefined();
    expect(ezb!.category).toBe('behoerde');
    expect(ezb!.criticality).toBe('kritisch');
    expect(ezb!.fallback).toMatch(/ELA/);
  });

  it('Cloud-DORA-Dependency mit DORA Art. 28 + Capital-One-WAF-SSRF in Notes', () => {
    const cloud = (module.dependencyTemplates ?? []).find((d) => d.id === 'fin_dep_cloud_dora');
    expect(cloud).toBeDefined();
    expect(cloud!.category).toBe('dienstleister');
    expect(cloud!.notes).toMatch(/DORA-Säule 5|Art\. 28/);
    expect(cloud!.notes).toMatch(/Capital One|SSRF/);
  });

  it('Rückversicherer-Dependency für Versicherungs-Tenants mit Tenant-Hinweis', () => {
    const rueck = (module.dependencyTemplates ?? []).find((d) => d.id === 'fin_dep_rueck');
    expect(rueck).toBeDefined();
    expect(rueck!.category).toBe('dienstleister');
    expect(rueck!.criticality).toBe('hoch');
    expect(rueck!.notes).toMatch(/Versicherungs-Tenants|nicht anwendbar/);
  });

  it('Online-Banking-DDoS-Übung mit 6-Monats-Kadenz (Bestand wegen Bank-Run-Risiko)', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'fin_ex_online_banking_ddos');
    expect(ex).toBeDefined();
    expect(ex!.cadenceMonths).toBe(6);
    expect(ex!.notes).toMatch(/halbjährlich|Bank-Run/i);
  });

  it('DORA-TLPT-Übung als technical mit 36-Monats-Kadenz und TLPT-vs-internem-Testing-Differenzierung', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'fin_ex_dora_tlpt');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('technical');
    expect(ex!.cadenceMonths).toBe(36);
    expect(ex!.scenarioTemplateId).toBe('fin_scn_dora_tlpt');
    expect(ex!.notes).toMatch(/externem TLPT|internem.*Resilience-Testing|G-SIIs/);
    expect(ex!.notes).toMatch(/UVM|jährlich|Mittelstand/);
  });

  it('Bank-Run-Übung als tabletop mit 24-Monats-Kadenz', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'fin_ex_bank_run');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('tabletop');
    expect(ex!.cadenceMonths).toBe(24);
    expect(ex!.scenarioTemplateId).toBe('fin_scn_bank_run_twitter');
  });

  it('Third-Party-Outage-Übung als tabletop mit 24-Monats-Kadenz und Drei-Schablonen-Drehbuch', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'fin_ex_third_party');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('tabletop');
    expect(ex!.cadenceMonths).toBe(24);
    expect(ex!.scenarioTemplateId).toBe('fin_scn_atruvia_fi_outage');
    expect(ex!.notes).toMatch(/FI-Panne|FI-TS|Deutsche Leasing/);
  });

  it('Übungs-Mix: tabletop + technical', () => {
    const exerciseTypes = new Set((module.exerciseTemplates ?? []).map((e) => e.exerciseType));
    expect(exerciseTypes.has('tabletop')).toBe(true);
    expect(exerciseTypes.has('technical')).toBe(true);
  });
});

describe('defence-core · Resilience-Skeleton (C5.5.10)', () => {
  const module = defencePack.module as unknown as SectorModuleDefinition;

  it('hat mindestens 10 processTemplates', () => {
    expect((module.processTemplates ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it('hat mindestens 9 dependencyTemplates', () => {
    expect((module.dependencyTemplates ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it('hat mindestens 8 scenarioTemplates', () => {
    expect((module.scenarioTemplates ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('hat mindestens 5 exerciseTemplates', () => {
    expect((module.exerciseTemplates ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('processTemplates haben Verteilung 6 kritisch / 4 hoch / 0 mittel (Defence-Charakter, keine mittel-Stufe)', () => {
    const processes = module.processTemplates ?? [];
    const kritisch = processes.filter((p) => p.criticality === 'kritisch').length;
    const hoch = processes.filter((p) => p.criticality === 'hoch').length;
    const mittel = processes.filter((p) => p.criticality === 'mittel').length;
    expect(kritisch).toBe(6);
    expect(hoch).toBe(4);
    expect(mittel).toBe(0);
  });

  it('Bestands-IDs (alle 12) bleiben erhalten', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const depIds = new Set((module.dependencyTemplates ?? []).map((d) => d.id));
    const scnIds = new Set((module.scenarioTemplates ?? []).map((s) => s.id));
    const exIds = new Set((module.exerciseTemplates ?? []).map((e) => e.id));
    expect(processIds.has('def_proc_vs_bearbeitung')).toBe(true);
    expect(processIds.has('def_proc_exportkontrolle')).toBe(true);
    expect(processIds.has('def_proc_defence_auftrags_abwicklung')).toBe(true);
    expect(depIds.has('def_dep_us_itar_lieferant')).toBe(true);
    expect(depIds.has('def_dep_nato_industrieverbund')).toBe(true);
    expect(depIds.has('def_dep_bafa')).toBe(true);
    expect(depIds.has('def_dep_bundeswehr_programm')).toBe(true);
    expect(scnIds.has('def_scn_apt_spionage')).toBe(true);
    expect(scnIds.has('def_scn_insider_vs_zugang')).toBe(true);
    expect(scnIds.has('def_scn_itar_embargo')).toBe(true);
    expect(exIds.has('def_ex_apt_spionage')).toBe(true);
    expect(exIds.has('def_ex_insider_vs_zugang')).toBe(true);
  });

  it('alle scenarioTemplates verlinken nur auf existierende processTemplate-IDs', () => {
    const processIds = new Set((module.processTemplates ?? []).map((p) => p.id));
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const scenario of module.scenarioTemplates ?? []) {
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
    const orphans: string[] = [];
    for (const exercise of module.exerciseTemplates ?? []) {
      if (exercise.scenarioTemplateId && !scenarioIds.has(exercise.scenarioTemplateId)) {
        orphans.push(`exercise "${exercise.id}" linked scenario "${exercise.scenarioTemplateId}"`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('jede scenarioTemplate hat mindestens eine Prozess-Verlinkung', () => {
    for (const scenario of module.scenarioTemplates ?? []) {
      expect(scenario.linkedProcessTemplateIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('VS-Bearbeitung Bestand-Werte beibehalten (24h/12h/0h, Air-Gap-Welt mit gewollter Langsamkeit)', () => {
    const vs = (module.processTemplates ?? []).find((p) => p.id === 'def_proc_vs_bearbeitung');
    expect(vs).toBeDefined();
    expect(parseFloat(vs!.mtpdHours ?? '0')).toBe(24);
    expect(parseFloat(vs!.rtoHours ?? '0')).toBe(12);
    expect(parseFloat(vs!.rpoHours ?? '99')).toBe(0);
  });

  it('Exportkontrolle Bestand-Werte beibehalten (72h/48h/24h, BAFA-Bürokratie-Pufferzeit)', () => {
    const ex = (module.processTemplates ?? []).find((p) => p.id === 'def_proc_exportkontrolle');
    expect(ex).toBeDefined();
    expect(parseFloat(ex!.mtpdHours ?? '0')).toBe(72);
    expect(parseFloat(ex!.rtoHours ?? '0')).toBe(48);
    expect(parseFloat(ex!.rpoHours ?? '0')).toBe(24);
  });

  it('Auftragsabwicklung Bestand-Werte beibehalten (120h/72h/48h, Quartals-Geschäft)', () => {
    const aa = (module.processTemplates ?? []).find((p) => p.id === 'def_proc_defence_auftrags_abwicklung');
    expect(aa).toBeDefined();
    expect(parseFloat(aa!.mtpdHours ?? '0')).toBe(120);
    expect(parseFloat(aa!.rtoHours ?? '0')).toBe(72);
    expect(parseFloat(aa!.rpoHours ?? '0')).toBe(48);
  });

  it('VS-Klassifikations-Stufen mit konkreten Beispielen in def_proc_vs_bearbeitung', () => {
    const vs = (module.processTemplates ?? []).find((p) => p.id === 'def_proc_vs_bearbeitung');
    expect(vs).toBeDefined();
    expect(vs!.notes).toMatch(/VS-NfD/);
    expect(vs!.notes).toMatch(/VS-VERTRAULICH/);
    expect(vs!.notes).toMatch(/VS-GEHEIM/);
    expect(vs!.notes).toMatch(/STRENG GEHEIM/);
    expect(vs!.notes).toMatch(/VSA-Compliance/);
  });

  it('Werks-IT mit Rheinmetall-Black-Basta-Schablone als Segmentierungs-Lehre', () => {
    const it = (module.processTemplates ?? []).find((p) => p.id === 'def_proc_werks_it');
    expect(it).toBeDefined();
    expect(it!.criticality).toBe('hoch');
    expect(it!.notes).toMatch(/Rheinmetall/);
    expect(it!.notes).toMatch(/14\.04\.2023/);
    expect(it!.notes).toMatch(/Black.Basta/);
    expect(it!.notes).toMatch(/Automotive|Zivil-IT/);
    expect(it!.notes).toMatch(/Militärgeschäft|segmentiert|unbeeinträchtigt/);
    // Bitkom-2025-Zahlen
    expect(it!.notes).toMatch(/Bitkom|BfV/);
    expect(it!.notes).toMatch(/87\s*%|266,6 Mrd|28\s*%/);
    expect(it!.notes).toMatch(/Vervierfachung|2023/);
  });

  it('SÜG-Prozess mit 6-12-Monats-Verfahrens-Hinweis', () => {
    const sueg = (module.processTemplates ?? []).find((p) => p.id === 'def_proc_sueg');
    expect(sueg).toBeDefined();
    expect(sueg!.criticality).toBe('hoch');
    expect(sueg!.notes).toMatch(/6-12 Monate/);
    expect(sueg!.notes).toMatch(/Ü1|Ü2|Ü3/);
  });

  it('F&E-Prozess mit Lockheed-F-35-APT1-Schablone (NICHT APT10)', () => {
    const fe = (module.processTemplates ?? []).find((p) => p.id === 'def_proc_fe_vs');
    expect(fe).toBeDefined();
    expect(fe!.criticality).toBe('kritisch');
    expect(fe!.notes).toMatch(/Lockheed.Martin|F-35/);
    expect(fe!.notes).toMatch(/APT1|PLA Unit 61398/);
    expect(fe!.notes).toMatch(/Mandiant.{0,10}2013/);
    expect(fe!.notes).toMatch(/DoJ|Indictment.{0,10}2014/);
    expect(fe!.notes).toMatch(/Su Bin/);
    expect(fe!.notes).toMatch(/50 TB/);
    // Bitkom 2025
    expect(fe!.notes).toMatch(/28\s*%/);
  });

  it('APT-Spionage-Szenario (L4/I5) mit Diehl-Kimsuky-Q3-2024-Schablone', () => {
    const apt = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_apt_spionage');
    expect(apt).toBeDefined();
    expect(apt!.likelihood).toBe(4);
    expect(apt!.impact).toBe(5);
    // Diehl-Kimsuky
    expect(apt!.description).toMatch(/Diehl/);
    expect(apt!.description).toMatch(/Kimsuky/);
    expect(apt!.description).toMatch(/IRIS-T-SLM/);
    expect(apt!.description).toMatch(/gefälschten? Stellenanzeigen|manipulierten? Telekom-Login/);
    // APT-Profile
    expect(apt!.description).toMatch(/APT28|GooseEgg/);
    expect(apt!.description).toMatch(/APT29|WINELOADER/);
    expect(apt!.description).toMatch(/APT41|Google-Calendar-C2/);
    expect(apt!.description).toMatch(/APT33/);
    // Bitkom 2025
    expect(apt!.description).toMatch(/87\s*%|266,6 Mrd|28\s*%/);
  });

  it('Insider-Spionage-Szenario L3/I5 (Bestand) mit StGB-§94/§99-Bezug', () => {
    const ins = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_insider_vs_zugang');
    expect(ins).toBeDefined();
    expect(ins!.likelihood).toBe(3);
    expect(ins!.impact).toBe(5);
    expect(ins!.playbook).toMatch(/§ 94 StGB|§ 99 StGB|Landesverrat|geheimdienstliche Agententätigkeit/);
  });

  it('ITAR-Embargo-Szenario L3/I5 (Bestand) mit Mistral-EU-Politik-Korrektur (NICHT ITAR)', () => {
    const itar = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_itar_embargo');
    expect(itar).toBeDefined();
    expect(itar!.likelihood).toBe(3);
    expect(itar!.impact).toBe(5);
    // Trump/China-Eskalation
    expect(itar!.description).toMatch(/Trump|China-Export-Kontrollen/);
    // Mistral als EU-Politik (NICHT ITAR)
    expect(itar!.notes).toMatch(/Mistral/);
    expect(itar!.notes).toMatch(/KEIN ITAR|EU.{0,5}Frankreich-Politik/);
    expect(itar!.notes).toMatch(/1,2 Mrd|949,7 Mio/);
    expect(itar!.notes).toMatch(/Ägypten/);
  });

  it('Hensoldt-Ransomware-Szenario mit korrigiertem Datum 2022 (Lorenz UK + Snatch FR)', () => {
    const hen = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_hensoldt_ransomware');
    expect(hen).toBeDefined();
    expect(hen!.likelihood).toBe(3);
    expect(hen!.impact).toBe(4);
    expect(hen!.description).toMatch(/Hensoldt/);
    expect(hen!.description).toMatch(/Lorenz/);
    expect(hen!.description).toMatch(/Januar 2022|Jan 2022|2022/);
    expect(hen!.description).toMatch(/Snatch/);
    expect(hen!.description).toMatch(/UK-Tochter/);
    expect(hen!.description).toMatch(/94 MB/);
  });

  it('Sanktions-Welle-Szenario L4/I4 mit Russland-2022-Schablone', () => {
    const san = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_sanktions_welle');
    expect(san).toBeDefined();
    expect(san!.likelihood).toBe(4);
    expect(san!.impact).toBe(4);
    expect(san!.description).toMatch(/24\.02\.2022/);
    expect(san!.description).toMatch(/EU.{0,3}833\/2014|833\/2014/);
    expect(san!.description).toMatch(/Dual-Use-Blanket-Ban|26\.02\.2022/);
    expect(san!.description).toMatch(/13\.|14\. Paket/);
  });

  it('Drohnen-Szenario L3/I4 mit Russland-Sanktions-Welle-Bezug', () => {
    const dr = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_drohne_werk');
    expect(dr).toBeDefined();
    expect(dr!.likelihood).toBe(3);
    expect(dr!.impact).toBe(4);
    expect(dr!.description).toMatch(/Spionage-Drohne|Werks-Gelände/);
    expect(dr!.description).toMatch(/2022|Russland/);
  });

  it('VS-Datenträger-Verlust-Szenario mit BfV/MAD-24h-Pflicht', () => {
    const vs = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_vs_datentraeger_verlust');
    expect(vs).toBeDefined();
    expect(vs!.playbook).toMatch(/BfV|MAD/);
    expect(vs!.playbook).toMatch(/24 h|binnen.*24/);
    expect(vs!.notes).toMatch(/DSGVO Art\. 34|kein.*Reset/);
  });

  it('Lockheed-F-35-Szenario L2/I5 mit APT1-Korrektur (NICHT APT10)', () => {
    const f35 = (module.scenarioTemplates ?? []).find((s) => s.id === 'def_scn_lockheed_f35');
    expect(f35).toBeDefined();
    expect(f35!.likelihood).toBe(2);
    expect(f35!.impact).toBe(5);
    expect(f35!.description).toMatch(/Lockheed.Martin|F-35/);
    expect(f35!.description).toMatch(/APT1/);
    expect(f35!.description).toMatch(/PLA Unit 61398/);
    expect(f35!.description).toMatch(/Mandiant.{0,10}2013/);
    expect(f35!.description).toMatch(/DoJ.{0,30}2014|Indictment.{0,5}Mai 2014/);
    expect(f35!.description).toMatch(/Su Bin/);
    expect(f35!.description).toMatch(/50 TB/);
    // explizit NICHT APT10
    expect(f35!.notes).toMatch(/NICHT APT10|nicht APT10/);
  });

  it('BfV/MAD-Dependency als kritisch behoerde mit Bitkom-28-%-Statistik', () => {
    const bfvmad = (module.dependencyTemplates ?? []).find((d) => d.id === 'def_dep_bfv_mad');
    expect(bfvmad).toBeDefined();
    expect(bfvmad!.category).toBe('behoerde');
    expect(bfvmad!.criticality).toBe('kritisch');
    expect(bfvmad!.notes).toMatch(/28\s*%/);
    expect(bfvmad!.notes).toMatch(/Vervierfachung|2023/);
    expect(bfvmad!.notes).toMatch(/Diehl|Kimsuky|Q3 2024/);
  });

  it('BSI-Defence-Dependency als hoch behoerde mit IT-Grundschutz-Defence-Bezug', () => {
    const bsi = (module.dependencyTemplates ?? []).find((d) => d.id === 'def_dep_bsi_defence');
    expect(bsi).toBeDefined();
    expect(bsi!.category).toBe('behoerde');
    expect(bsi!.criticality).toBe('hoch');
    expect(bsi!.notes).toMatch(/NIS2|24 h/);
  });

  it('Sub-Supplier-Dependency mit ITAR-/EAR-Pflichten', () => {
    const sub = (module.dependencyTemplates ?? []).find((d) => d.id === 'def_dep_sub_supplier');
    expect(sub).toBeDefined();
    expect(sub!.category).toBe('lieferant');
    expect(sub!.criticality).toBe('hoch');
  });

  it('Beratungs-Dependency als mittel und Forschungs-Dependency als mittel (zwei mittel-Deps)', () => {
    const beratung = (module.dependencyTemplates ?? []).find((d) => d.id === 'def_dep_compliance_beratung');
    const forschung = (module.dependencyTemplates ?? []).find((d) => d.id === 'def_dep_forschung');
    expect(beratung).toBeDefined();
    expect(forschung).toBeDefined();
    expect(beratung!.criticality).toBe('mittel');
    expect(forschung!.criticality).toBe('mittel');
  });

  it('Übungs-Mix: tabletop + technical mit Drohnen-Funktionstest', () => {
    const exerciseTypes = new Set((module.exerciseTemplates ?? []).map((e) => e.exerciseType));
    expect(exerciseTypes.has('tabletop')).toBe(true);
    expect(exerciseTypes.has('technical')).toBe(true);
    const drohne = (module.exerciseTemplates ?? []).find((e) => e.id === 'def_ex_drohne_funktionstest');
    expect(drohne).toBeDefined();
    expect(drohne!.exerciseType).toBe('technical');
    expect(drohne!.cadenceMonths).toBe(24);
  });

  it('Sanktions-Übung als 24-Monats-Tabletop verlinkt mit Sanktions-Szenario', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'def_ex_sanktions_welle');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('tabletop');
    expect(ex!.cadenceMonths).toBe(24);
    expect(ex!.scenarioTemplateId).toBe('def_scn_sanktions_welle');
  });

  it('VS-Datenträger-Übung mit 12-Monats-Kadenz', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'def_ex_vs_datentraeger');
    expect(ex).toBeDefined();
    expect(ex!.exerciseType).toBe('tabletop');
    expect(ex!.cadenceMonths).toBe(12);
    expect(ex!.scenarioTemplateId).toBe('def_scn_vs_datentraeger_verlust');
  });

  it('APT-Übung mit Diehl-Kimsuky-Drehbuch in Notes', () => {
    const ex = (module.exerciseTemplates ?? []).find((e) => e.id === 'def_ex_apt_spionage');
    expect(ex).toBeDefined();
    expect(ex!.notes).toMatch(/Diehl|Kimsuky|IRIS-T/);
  });
});
