/**
 * adoptModuleTemplates.ts · Pure Copy-Operators für den C5.2-Adopt-Flow.
 *
 * Kopiert die drei neuen C5.1-Template-Felder (`riskCatalogTemplates[]`,
 * `resiliencePlanTemplate`, `tabletopScenarios[]`) aus einem Pack-Modul
 * in den Tenant-State. Die Operatoren sind bewusst **Pure Functions**:
 * keine Hooks, kein React-State, kein setState — so können sie später
 * unit-getestet werden und der E2E-Test von C5.2 deckt den Orchestrierungs-
 * Pfad ab.
 *
 * Die drei Copy-Operator-Semantiken (bestätigt in der C5.2-Freigaberunde,
 * Entscheidung UX):
 *
 *   - riskEntries: **Append**. Jeder Template-Eintrag bekommt eine neue
 *     Instance-ID (Pack-Template-ID bleibt im Pack, die Kopie kriegt
 *     crypto.randomUUID()). Cross-Reference-Arrays bleiben leer
 *     (entsprechend B.1 aus C5.1 — Pack-Zeit-IDs sind nicht identisch
 *     mit Tenant-Zeit-IDs).
 *
 *   - resiliencePlan: **Replace mit Archiv-Backup**. Der bestehende
 *     aktive Plan wandert als Snapshot in `archivedResiliencePlans`
 *     (vorn anhängen, newest first — konsistent mit
 *     handleArchiveResiliencePlan). Ein neuer Plan wird aus dem
 *     Template-Content gebaut, mit frischen Lifecycle-Feldern
 *     (id, tenantId, version='1.0.0', status='draft', createdAt, updatedAt).
 *
 *   - importedTabletopScenarios: **MergeById**. Overlay-Semantik analog
 *     zum Server-seitigen applyModuleOverlay — gleiche ID überschreibt
 *     den alten Eintrag (letzter gewinnt). Keine ID-Regenerierung, weil
 *     Scenario-ID Pack-stabil bleibt und von ExerciseSession.scenarioId
 *     referenziert wird.
 *
 * Clone-Strategie: `structuredClone` für verschachtelte Arrays/Objekte.
 * Verhindert Referenz-Aliasing zwischen Pack-Template und Tenant-State
 * (Editieren des adoptierten Plans darf das Template im Modul nicht
 * mutieren). Build-Target ES2020 verträgt sich mit structuredClone,
 * weil structuredClone ein Browser-/Node-Global ist, kein TS-Keyword.
 */

import type { RiskEntry } from '../riskCatalog/types';
import type { ResiliencePlan } from '../resiliencePlan/types';
import type { Scenario } from '../tabletopExercise/types';
import type { AppState, SectorModuleDefinition } from '../../types';

// C5.1 hat die drei Template-Felder nativ in SectorModuleDefinition
// aufgenommen (siehe src/types.ts). Der Alias `ModuleWithTemplates` bleibt
// als semantische Markierung — Call-Sites, die einen Adopt-fähigen Modul-
// Kandidaten übergeben wollen, lesen sich mit diesem Namen klarer.
export type ModuleWithTemplates = SectorModuleDefinition;

/**
 * Zählt die Adopt-fähigen Elemente pro Kategorie — Grundlage für die
 * Disabled-State-Logik der UI-Buttons (§ 5 der C5.2-Analyse, R3).
 */
export interface AdoptionCounts {
  riskCatalog: number;
  resiliencePlan: number; // 0 oder 1
  tabletop: number;
  total: number;
}

export function countAdoptableTemplates(module: ModuleWithTemplates | null | undefined): AdoptionCounts {
  const riskCatalog = Array.isArray(module?.riskCatalogTemplates) ? module!.riskCatalogTemplates.length : 0;
  const resiliencePlan = module?.resiliencePlanTemplate?.content ? 1 : 0;
  const tabletop = Array.isArray(module?.tabletopScenarios) ? module!.tabletopScenarios.length : 0;
  return {
    riskCatalog,
    resiliencePlan,
    tabletop,
    total: riskCatalog + resiliencePlan + tabletop,
  };
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  // Fallback für Build-Target-Umgebungen ohne structuredClone (sollte
  // in modernen Browsern ab 2022 und Node 17+ nicht greifen, aber als
  // defensive Baseline).
  return JSON.parse(JSON.stringify(value)) as T;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback — deterministisches aber kollisionsarmes Schema.
  return `adopt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// adoptRiskCatalogTemplates · Append-Semantik
// ============================================================================

export interface AdoptRiskResult {
  riskEntries: RiskEntry[];
  addedCount: number;
}

export function adoptRiskCatalogTemplates(
  module: ModuleWithTemplates,
  currentState: Pick<AppState, 'riskEntries'>,
): AdoptRiskResult {
  if (!Array.isArray(module.riskCatalogTemplates) || module.riskCatalogTemplates.length === 0) {
    return { riskEntries: currentState.riskEntries, addedCount: 0 };
  }
  const newEntries: RiskEntry[] = module.riskCatalogTemplates.map((tpl) => ({
    id: generateId(),
    categoryId: tpl.categoryId,
    subCategoryId: tpl.subCategoryId,
    titel: tpl.titel,
    beschreibung: tpl.beschreibung ?? '',
    eintrittswahrscheinlichkeit: tpl.eintrittswahrscheinlichkeit,
    auswirkung: tpl.auswirkung,
    // Cross-Reference-Arrays bewusst leer — Pack-Zeit-IDs sind nicht identisch
    // mit Tenant-Zeit-IDs (Entscheidung B.1 aus C5.1). Operator verknüpft
    // nach Adopt manuell im Frontend.
    affectedAssetIds: [],
    affectedProcessIds: [],
    affectedInterdependencies: [],
    mitigationMeasureIds: [],
    residualRisk: tpl.residualRisk,
    reviewDate: tpl.reviewDate ?? '',
    owner: tpl.owner ?? '',
  }));
  return {
    riskEntries: [...currentState.riskEntries, ...newEntries],
    addedCount: newEntries.length,
  };
}

// ============================================================================
// adoptResiliencePlanTemplate · Replace mit Archiv-Backup
// ============================================================================

export interface AdoptResilienceResult {
  resiliencePlan: ResiliencePlan | null;
  archivedResiliencePlans: ResiliencePlan[];
  replaced: boolean; // true wenn ein aktiver Plan archiviert wurde
}

export function adoptResiliencePlanTemplate(
  module: ModuleWithTemplates,
  currentState: Pick<AppState, 'resiliencePlan' | 'archivedResiliencePlans'>,
  tenantId: string,
): AdoptResilienceResult {
  if (!module.resiliencePlanTemplate?.content) {
    return {
      resiliencePlan: currentState.resiliencePlan,
      archivedResiliencePlans: currentState.archivedResiliencePlans,
      replaced: false,
    };
  }
  const now = new Date().toISOString();
  const newPlan: ResiliencePlan = {
    id: generateId(),
    tenantId,
    version: '1.0.0',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    content: deepClone(module.resiliencePlanTemplate.content),
  };
  // Bestehenden aktiven Plan nach vorn ins Archiv legen (konsistent mit
  // dem Muster aus useResiliencePlanHandlers.ts:213).
  const archivedNext = currentState.resiliencePlan
    ? [currentState.resiliencePlan, ...currentState.archivedResiliencePlans]
    : currentState.archivedResiliencePlans;
  return {
    resiliencePlan: newPlan,
    archivedResiliencePlans: archivedNext,
    replaced: Boolean(currentState.resiliencePlan),
  };
}

// ============================================================================
// adoptTabletopScenarios · MergeById
// ============================================================================

export interface AdoptTabletopResult {
  importedTabletopScenarios: Scenario[];
  addedCount: number;
  replacedCount: number;
}

export function adoptTabletopScenarios(
  module: ModuleWithTemplates,
  currentState: Pick<AppState, 'importedTabletopScenarios'>,
): AdoptTabletopResult {
  if (!Array.isArray(module.tabletopScenarios) || module.tabletopScenarios.length === 0) {
    return {
      importedTabletopScenarios: currentState.importedTabletopScenarios,
      addedCount: 0,
      replacedCount: 0,
    };
  }
  const existingById = new Map<string, Scenario>(
    currentState.importedTabletopScenarios.map((s) => [s.id, s]),
  );
  let addedCount = 0;
  let replacedCount = 0;
  for (const scenario of module.tabletopScenarios) {
    if (existingById.has(scenario.id)) {
      replacedCount += 1;
    } else {
      addedCount += 1;
    }
    existingById.set(scenario.id, deepClone(scenario));
  }
  return {
    importedTabletopScenarios: Array.from(existingById.values()),
    addedCount,
    replacedCount,
  };
}

// ============================================================================
// adoptAllTemplates · Master-Komposition der drei Einzel-Operatoren
// ============================================================================

export interface AdoptAllResult {
  riskEntries: RiskEntry[];
  resiliencePlan: ResiliencePlan | null;
  archivedResiliencePlans: ResiliencePlan[];
  importedTabletopScenarios: Scenario[];
  counts: {
    riskAdded: number;
    planReplaced: boolean;
    tabletopAdded: number;
    tabletopReplaced: number;
  };
}

export function adoptAllTemplates(
  module: ModuleWithTemplates,
  currentState: Pick<AppState, 'riskEntries' | 'resiliencePlan' | 'archivedResiliencePlans' | 'importedTabletopScenarios'>,
  tenantId: string,
): AdoptAllResult {
  const r1 = adoptRiskCatalogTemplates(module, currentState);
  const r2 = adoptResiliencePlanTemplate(
    module,
    { resiliencePlan: currentState.resiliencePlan, archivedResiliencePlans: currentState.archivedResiliencePlans },
    tenantId,
  );
  const r3 = adoptTabletopScenarios(module, currentState);
  return {
    riskEntries: r1.riskEntries,
    resiliencePlan: r2.resiliencePlan,
    archivedResiliencePlans: r2.archivedResiliencePlans,
    importedTabletopScenarios: r3.importedTabletopScenarios,
    counts: {
      riskAdded: r1.addedCount,
      planReplaced: r2.replaced,
      tabletopAdded: r3.addedCount,
      tabletopReplaced: r3.replacedCount,
    },
  };
}
